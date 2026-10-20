// Builds the Express app (middleware, routes, error handling) without starting a server, so the entry point and the tests can both use it.
import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import authRouter from "./routes/authRoutes.js";
import meRouter from "./routes/sessionUserRoutes.js";
import projectRouter from "./routes/projectRoutes.js";
import folderRouter from "./routes/folderRoutes.js";
import iconRouter from "./routes/iconRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import { errorHandler } from "./lib/errors.js";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "5mb" }));

  app.get("/", (_req: Request, res: Response) => {
    res.send("Backend Running");
  });

  app.use("/api/auth", authRouter);
  app.use("/api/auth/me", meRouter);
  app.use("/api/projects", projectRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api", folderRouter);
  app.use("/api", iconRouter);

  // Keep the runtime quiet if someone hits a path we don't serve.
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Turns thrown errors (validation, permissions, bad ids) into JSON responses. Must stay after all routes.
  app.use(errorHandler);

  return app;
}
