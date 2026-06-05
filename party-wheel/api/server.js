// Vercel serverless entry point.
// Imports the pre-compiled Express app (no vite/rollup in module graph).
import app from "../dist/app.js";
export default app;
