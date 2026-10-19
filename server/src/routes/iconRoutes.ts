// Icon routes: upload (SVG files and ZIPs), paste, copy between projects, list, search, edit, versions, trash, batch actions and downloads. Mounted at /api. Project-scoped routes sit behind the project router's sign-in check (mounted first); /icons/* has its own.
import { Router, type Request } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { BadRequestError, NotFoundError } from "../lib/errors.js";
import { actorOf, loadProject, parseObjectId } from "../lib/http.js";
import {
  batchDeleteSchema,
  batchMoveSchema,
  batchTagSchema,
  copyIconsSchema,
  iconIdsSchema,
  iconSearchQuerySchema,
  listIconsQuerySchema,
  parseUploadFields,
  pasteIconSchema,
  updateIconSchema,
} from "../lib/validation.js";
import { requireDb } from "../middleware/requireDb.js";
import { requireUser } from "../middleware/requireUser.js";
import Icon from "../models/Icon.js";
import { assertFolderInProject } from "../services/folderService.js";
import {
  MAX_ICONS_PER_UPLOAD,
  batchDelete,
  batchMove,
  batchOptimize,
  batchRestore,
  batchTag,
  copyIcons,
  deletePermanently,
  downloadIcons,
  emptyTrash,
  importSvg,
  importUpload,
  listIcons,
  listVersions,
  moveToTrash,
  optimizeIcon,
  restoreFromTrash,
  restoreVersion,
  searchIcons,
  serializeIcon,
  updateIcon,
} from "../services/iconService.js";

const router = Router();
router.use("/icons", requireDb, requireUser);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 200 } });

const toIds = (ids: string[]) => ids.map((id) => new mongoose.Types.ObjectId(id));

async function loadIcon(req: Request, need: "view" | "edit") {
  const actor = actorOf(req);
  const icon = await Icon.findById(parseObjectId(req.params.iconId, "icon id"));
  if (!icon) throw new NotFoundError("Icon not found.");
  await loadProject(actor, icon.projectId, need);
  return icon;
}

// ---- Within a project ----

router.get("/projects/:projectId/icons", async (req, res) => {
  const project = await loadProject(actorOf(req), req.params.projectId, "view");
  const q = listIconsQuerySchema.parse(req.query);
  const folder = q.folderId === undefined ? "all" : q.folderId === "root" ? "root" : parseObjectId(q.folderId, "folder id");
  res.json(
    await listIcons(project._id, {
      folder,
      includeSubfolders: q.includeSubfolders,
      search: q.search,
      tag: q.tag,
      trash: q.trash,
      sort: q.sort,
      page: q.page,
      limit: q.limit,
      withSvg: q.svg,
    }),
  );
});

// Upload SVG files and ZIP archives (multipart field "files"). Fields: folderId, strategy (rename|replace|skip), optimize, tags.
router.post("/projects/:projectId/icons/upload", upload.array("files", 200), async (req, res) => {
  const project = await loadProject(actorOf(req), req.params.projectId, "edit");
  const fields = parseUploadFields(req.body as Record<string, unknown> | undefined);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) throw new BadRequestError('Attach at least one file in the "files" field.');
  const folderId = fields.folderId ? parseObjectId(fields.folderId, "folder id") : null;
  const optimize = typeof fields.optimize === "boolean" ? fields.optimize : fields.optimize === "true";
  const summary = await importUpload(
    project._id,
    files.map((f) => ({ originalname: f.originalname, mimetype: f.mimetype, buffer: f.buffer })),
    { strategy: fields.strategy, optimize, folderId, tags: fields.tags },
  );
  res.status(summary.created.length > 0 ? 201 : 200).json({ ...summary, limitPerUpload: MAX_ICONS_PER_UPLOAD });
});

router.post("/projects/:projectId/icons/paste", async (req, res) => {
  const project = await loadProject(actorOf(req), req.params.projectId, "edit");
  const input = pasteIconSchema.parse(req.body ?? {});
  const folderId = input.folderId ? parseObjectId(input.folderId, "folder id") : null;
  await assertFolderInProject(project._id, folderId);
  const outcome = await importSvg(
    project._id,
    { name: input.name, raw: input.rawSvg, folderId, tags: input.tags },
    { strategy: input.strategy, optimize: input.optimize },
  );
  if (outcome.status === "skipped") {
    res.json({ outcome: "skipped", reason: outcome.reason });
    return;
  }
  res.status(outcome.status === "created" ? 201 : 200).json({ outcome: outcome.status, icon: serializeIcon(outcome.icon) });
});

// Copy icons from a project the user can view into this one (which they must be able to edit).
router.post("/projects/:projectId/icons/copy", async (req, res) => {
  const actor = actorOf(req);
  const input = copyIconsSchema.parse(req.body ?? {});
  const target = await loadProject(actor, req.params.projectId, "edit");
  const source = await loadProject(actor, input.sourceProjectId, "view");
  const summary = await copyIcons(target._id, source._id, toIds(input.iconIds), {
    strategy: input.strategy,
    optimize: input.optimize,
    folderId: input.folderId ? parseObjectId(input.folderId, "folder id") : null,
  });
  res.status(summary.created.length > 0 ? 201 : 200).json(summary);
});

// One icon downloads as an SVG, several as a ZIP.
router.post("/projects/:projectId/icons/download", async (req, res) => {
  const project = await loadProject(actorOf(req), req.params.projectId, "view");
  const input = iconIdsSchema.parse(req.body ?? {});
  const file = await downloadIcons(project._id, toIds(input.iconIds));
  sendDownload(res, file);
});

router.post("/projects/:projectId/icons/batch/move", async (req, res) => {
  const project = await loadProject(actorOf(req), req.params.projectId, "edit");
  const input = batchMoveSchema.parse(req.body ?? {});
  res.json(await batchMove(project._id, toIds(input.iconIds), input.folderId ? parseObjectId(input.folderId, "folder id") : null));
});

router.post("/projects/:projectId/icons/batch/tag", async (req, res) => {
  const project = await loadProject(actorOf(req), req.params.projectId, "edit");
  const input = batchTagSchema.parse(req.body ?? {});
  res.json(await batchTag(project._id, toIds(input.iconIds), input.tags, input.mode));
});

// Moves to the trash; with "permanent": true it deletes icons that are already in the trash for good.
router.post("/projects/:projectId/icons/batch/delete", async (req, res) => {
  const project = await loadProject(actorOf(req), req.params.projectId, "edit");
  const input = batchDeleteSchema.parse(req.body ?? {});
  res.json(await batchDelete(project._id, toIds(input.iconIds), input.permanent));
});

router.post("/projects/:projectId/icons/batch/restore", async (req, res) => {
  const project = await loadProject(actorOf(req), req.params.projectId, "edit");
  const input = iconIdsSchema.parse(req.body ?? {});
  res.json(await batchRestore(project._id, toIds(input.iconIds)));
});

router.post("/projects/:projectId/icons/batch/optimize", async (req, res) => {
  const project = await loadProject(actorOf(req), req.params.projectId, "edit");
  const input = iconIdsSchema.parse(req.body ?? {});
  res.json(await batchOptimize(project._id, toIds(input.iconIds)));
});

router.delete("/projects/:projectId/icons/trash", async (req, res) => {
  const project = await loadProject(actorOf(req), req.params.projectId, "edit");
  res.json(await emptyTrash(project._id));
});

// ---- Single icons and search ----

// Defined before /icons/:iconId so "search" is not read as an id.
router.get("/icons/search", async (req, res) => {
  const q = iconSearchQuerySchema.parse(req.query);
  res.json(await searchIcons(actorOf(req), q.q, q.page, q.limit));
});

router.get("/icons/:iconId", async (req, res) => {
  const icon = await loadIcon(req, "view");
  res.json({ ...serializeIcon(icon), versions: await listVersions(icon._id) });
});

router.get("/icons/:iconId/download", async (req, res) => {
  const icon = await loadIcon(req, "view");
  sendDownload(res, { filename: `${icon.slug}.svg`, contentType: "image/svg+xml", body: Buffer.from(icon.svg, "utf8") });
});

router.patch("/icons/:iconId", async (req, res) => {
  const input = updateIconSchema.parse(req.body ?? {});
  const icon = await loadIcon(req, "edit");
  res.json({ ...serializeIcon(await updateIcon(icon, input)) });
});

router.post("/icons/:iconId/optimize", async (req, res) => {
  const icon = await loadIcon(req, "edit");
  const { icon: updated, ...stats } = await optimizeIcon(icon);
  res.json({ icon: serializeIcon(updated), ...stats });
});

router.get("/icons/:iconId/versions", async (req, res) => {
  const icon = await loadIcon(req, "view");
  res.json({ versions: await listVersions(icon._id) });
});

router.post("/icons/:iconId/versions/:versionId/restore", async (req, res) => {
  const icon = await loadIcon(req, "edit");
  const restored = await restoreVersion(icon, parseObjectId(req.params.versionId, "version id"));
  res.json({ ...serializeIcon(restored), versions: await listVersions(restored._id) });
});

// Moves to the trash; add ?permanent=true to delete an icon that is already in the trash for good.
router.delete("/icons/:iconId", async (req, res) => {
  const icon = await loadIcon(req, "edit");
  if (req.query.permanent === "true") {
    await deletePermanently(icon);
    res.json({ deleted: true });
    return;
  }
  res.json(serializeIcon(await moveToTrash(icon), false));
});

router.post("/icons/:iconId/restore", async (req, res) => {
  const icon = await loadIcon(req, "edit");
  const { icon: restored, adjusted } = await restoreFromTrash(icon);
  res.json({ icon: serializeIcon(restored), adjusted });
});

// Sends a file for download. The restrictive headers matter: an SVG opened directly could otherwise run in the page's origin.
function sendDownload(res: import("express").Response, file: { filename: string; contentType: string; body: Buffer }) {
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename.replace(/[^\w.-]/g, "_")}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.send(file.body);
}

export default router;
