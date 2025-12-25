import dotEnv from "dotenv";
import path from "node:path";

let visited = false;

if (!visited) {
  visited = true;
  dotEnv.config({ path: path.join(import.meta.dirname, "..", ".env") });
}
