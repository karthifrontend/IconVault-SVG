// Project routes: list, create, read, update, delete and duplicate. Every route needs a signed-in user. Mounted at /api/projects.
import { Router } from "express";
import multer from "multer";
import { BadRequestError } from "../lib/errors.js";
import { actorOf, loadProject, parseObjectId, sendDownload } from "../lib/http.js";
import { buildFontSchema, createProjectSchema, listProjectsQuerySchema, updateProjectSchema } from "../lib/validation.js";
import { requireDb } from "../middleware/requireDb.js";
import { requireUser } from "../middleware/requireUser.js";
import { canEdit } from "../lib/permissions.js";
import { buildFont, iconsForFont, zipFontBuild } from "../services/fontService.js";
import { exportProject, importProject } from "../services/projectArchive.js";
import { buildProjectSprite } from "../services/spriteService.js";
import { createProject, deleteProject, duplicateProject, getProjectDetail, listProjects, updateProject } from "../services/projectService.js";

const router = Router();
const archive = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024, files: 1 } });
router.use(requireDb, requireUser);

// The projects the user may see (their own plus public ones; everything for admins), with counts and sample icons.
router.get("/", async (req, res) => {
  res.json(await listProjects(actorOf(req), listProjectsQuerySchema.parse(req.query)));
});

router.post("/", async (req, res) => {
  const input = createProjectSchema.parse(req.body ?? {});
  res.status(201).json(await createProject(actorOf(req), input));
});

// Create a new private project from a ZIP made by the export (multipart field "file"). Declared before the /:projectId routes.
router.post("/import", archive.single("file"), async (req, res) => {
  if (!req.file) throw new BadRequestError('Attach the export ZIP in the "file" field.');
  const result = await importProject(actorOf(req), req.file.buffer);
  res.status(201).json(result);
});

router.get("/:projectId", async (req, res) => {
  const actor = actorOf(req);
  const project = await loadProject(actor, req.params.projectId, "view");
  res.json(await getProjectDetail(project, actor));
});

// Rename, change colour/prefix/description, visibility or archive state. Owner or admin only.
router.patch("/:projectId", async (req, res) => {
  const actor = actorOf(req);
  const input = updateProjectSchema.parse(req.body ?? {});
  const project = await loadProject(actor, req.params.projectId, "manage");
  res.json(await updateProject(project, input, actor));
});

router.delete("/:projectId", async (req, res) => {
  const project = await loadProject(actorOf(req), req.params.projectId, "manage");
  res.json(await deleteProject(project));
});

// Anyone who can see a project can copy it into a new private project of their own.
router.post("/:projectId/duplicate", async (req, res) => {
  const actor = actorOf(req);
  const source = await loadProject(actor, req.params.projectId, "view");
  res.status(201).json(await duplicateProject(source, actor));
});

// The whole project (settings, folders, icons) as one ZIP that /import can read back. Anyone who can see the project can export it.
router.get("/:projectId/export", async (req, res) => {
  const project = await loadProject(actorOf(req), req.params.projectId, "view");
  sendDownload(res, await exportProject(project));
});

// Builds an icon font and returns what the page needs to preview it (a small WOFF2 plus the stylesheet and the character for every icon). Anyone who can see the project may build; only editors get the new codepoints saved on the icons.
router.post("/:projectId/font/build", async (req, res) => {
  const actor = actorOf(req);
  const project = await loadProject(actor, req.params.projectId, "view");
  const input = buildFontSchema.parse(req.body ?? {});
  const icons = await iconsForFont(project._id, input);
  const build = await buildFont(project._id, icons, input, canEdit(actor, project));
  res.json({ fontName: build.fontName, prefix: build.prefix, iconCount: build.iconCount, warnings: build.warnings, codepoints: build.codepoints, css: build.css, preview: build.preview, sizes: build.sizes });
});

// The same build as a ZIP: the chosen font files, stylesheet, SCSS, glyph map, a specimen page and a README.
router.post("/:projectId/font/download", async (req, res) => {
  const actor = actorOf(req);
  const project = await loadProject(actor, req.params.projectId, "view");
  const input = buildFontSchema.parse(req.body ?? {});
  const icons = await iconsForFont(project._id, input);
  const build = await buildFont(project._id, icons, input, canEdit(actor, project));
  sendDownload(res, { filename: `${build.fontName}-font.zip`, contentType: "application/zip", body: zipFontBuild(build) });
});

// The icons compiled into one SVG sprite. Optional query: folderId (a folder and its subfolders) or folderId=root (uncategorized only).
router.get("/:projectId/sprite", async (req, res) => {
  const project = await loadProject(actorOf(req), req.params.projectId, "view");
  const folderId = typeof req.query.folderId === "string" ? req.query.folderId : undefined;
  const folder = folderId === undefined ? null : folderId === "root" ? "root" : parseObjectId(folderId, "folder id");
  const built = await buildProjectSprite(project._id, project.prefix ?? "icon", folder);
  res.setHeader("X-Sprite-Symbols", String(built.ids.length));
  sendDownload(res, { filename: `${project.prefix ?? "sprite"}.svg`, contentType: "image/svg+xml", body: Buffer.from(built.xml, "utf8") });
});

export default router;
