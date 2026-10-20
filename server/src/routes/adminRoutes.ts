// Admin routes: users and project ownership. Every route needs a signed-in admin (the ADMIN_EMAILS list). Mounted at /api/admin.
import { Router } from "express";
import { actorOf, loadProject, parseObjectId } from "../lib/http.js";
import { deleteUserSchema, listUsersQuerySchema, transferProjectSchema } from "../lib/validation.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireDb } from "../middleware/requireDb.js";
import { requireUser } from "../middleware/requireUser.js";
import { deleteUser, listUsers, transferProject } from "../services/adminService.js";

const router = Router();
router.use(requireDb, requireUser, requireAdmin);

router.get("/users", async (req, res) => {
  res.json(await listUsers(actorOf(req), listUsersQuerySchema.parse(req.query)));
});

// Body: { transferTo?: userId }. Without it the user's projects are deleted with them.
router.delete("/users/:userId", async (req, res) => {
  const input = deleteUserSchema.parse(req.body ?? {});
  res.json(await deleteUser(actorOf(req), parseObjectId(req.params.userId, "user id"), input.transferTo ? parseObjectId(input.transferTo) : null));
});

router.post("/projects/:projectId/transfer", async (req, res) => {
  const actor = actorOf(req);
  const input = transferProjectSchema.parse(req.body ?? {});
  const project = await loadProject(actor, req.params.projectId, "manage");
  res.json(await transferProject(project, parseObjectId(input.userId), actor));
});

export default router;
