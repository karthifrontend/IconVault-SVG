// Project routes: list, create, read, update, delete and duplicate. Every route needs a signed-in user. Mounted at /api/projects.
import { Router } from "express";
import { actorOf, loadProject } from "../lib/http.js";
import { createProjectSchema, listProjectsQuerySchema, updateProjectSchema } from "../lib/validation.js";
import { requireDb } from "../middleware/requireDb.js";
import { requireUser } from "../middleware/requireUser.js";
import { createProject, deleteProject, duplicateProject, getProjectDetail, listProjects, updateProject } from "../services/projectService.js";

const router = Router();
router.use(requireDb, requireUser);

// The projects the user may see (their own plus public ones; everything for admins), with counts and sample icons.
router.get("/", async (req, res) => {
  res.json(await listProjects(actorOf(req), listProjectsQuerySchema.parse(req.query)));
});

router.post("/", async (req, res) => {
  const input = createProjectSchema.parse(req.body ?? {});
  res.status(201).json(await createProject(actorOf(req), input));
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

export default router;
