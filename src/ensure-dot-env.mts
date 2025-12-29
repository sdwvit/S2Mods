import dotEnv from "dotenv";
import path from "node:path";

let visited = false;
export const projectRoot = path.join(import.meta.dirname, "..");

if (!visited) {
  visited = true;
  dotEnv.config({ path: path.join(projectRoot, ".env") });
}
