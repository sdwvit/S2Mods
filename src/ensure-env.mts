import dotEnv from "dotenv";
import path from "node:path";

let visited = false;
export const projectRoot = path.join(import.meta.dirname, "..");
if (!visited) {
  visited = true;
  dotEnv.config({ path: path.join(projectRoot, ".env") });
  if (Number(process.versions.node.split(".")[0]) < 24) {
    throw new Error("This repo requires Node.js 24+ with native TypeScript support.");
  }
  if (process.env.NODE_TS_TRANSFORMER) {
    throw new Error("NODE_TS_TRANSFORMER is no longer supported. Remove it from .env and run with native Node.js 24+. Do not use the IntelliJ TypeScript loader: it caused recursive esbuild process spawning.");
  }
}
