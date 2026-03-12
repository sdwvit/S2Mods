import dotEnv from "dotenv";
import path from "node:path";
import { spawn } from "node:child_process";

let visited = false;
export const projectRoot = path.join(import.meta.dirname, "..");

function runPullGitBranchesInBackground() {
  if (process.env.S2_SKIP_ASYNC_PULL_GIT_BRANCHES === "1") {
    return;
  }

  const entryFileName = process.argv[1] ? path.basename(process.argv[1]) : "";
  if (entryFileName === "pull-git-branches.mts") {
    return;
  }

  const child = spawn(
    process.execPath,
    [
      ...(process.env.NODE_TS_TRANSFORMER ? ["--import", `file:${process.env.NODE_TS_TRANSFORMER}`] : []),
      path.join(import.meta.dirname, "pull-git-branches.mts"),
    ],
    {
      cwd: import.meta.dirname,
      stdio: "ignore",
      detached: true,
      env: { ...process.env, S2_SKIP_ASYNC_PULL_GIT_BRANCHES: "1" },
    },
  );
  child.unref();
}

if (!visited) {
  visited = true;
  dotEnv.config({ path: path.join(projectRoot, ".env") });
  runPullGitBranchesInBackground();
}
