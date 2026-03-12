import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

dotenv.config({ path: path.join(projectRoot, ".env") });

const [entryFile, ...args] = process.argv.slice(2);

if (!entryFile) {
  console.error("Expected a script path");
  process.exit(1);
}

const nodePath = process.env.NODE_PATH || process.execPath;
const spawnArgs = [];

if (process.env.NODE_TS_TRANSFORMER) {
  spawnArgs.push("--import", `file:${process.env.NODE_TS_TRANSFORMER}`);
}

spawnArgs.push(entryFile, ...args);

const result = spawnSync(nodePath, spawnArgs, {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
