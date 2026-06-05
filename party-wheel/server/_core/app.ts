import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";

// Pure production Express app — no vite, no rollup, no dev tooling in this
// module graph. Imported by api/server.js (Vercel) and dist/index.js (local).
const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

registerOAuthRoutes(app);
app.use(
  "/api/trpc",
  createExpressMiddleware({ router: appRouter, createContext })
);

// Static serving for pnpm start (local production).
// On Vercel, vercel.json routes non-API requests to static files directly —
// this block is a no-op there because /api/* is the only path that hits this function.
const distPath = path.resolve(import.meta.dirname, "public");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

export default app;
