import { modName, projectRoot, validMods } from "./base-paths.mts";
import { spawnSync } from "child_process";
import fs from "node:fs";
import path from "node:path";

const cmd = (c: string) =>
  spawnSync(c, {
    stdio: "inherit",
    cwd: import.meta.dirname,
    shell: "/usr/bin/bash",
    env: { ...process.env },
  });

validMods.forEach((mod) => {
  cmd(["git", "checkout", mod].join(" "));
  const envFile = path.join(projectRoot, ".env.modname");
  fs.writeFileSync(envFile, `MOD_NAME=${modName}\n`);
  cmd(["git", "add", envFile].join(" "));
  cmd(["git", "commit", "-m", "'Add new mod'"].join(" "));
  cmd(["git", "push", "--set-upstream", "origin", modName].join(" "));
  cmd(["git", "checkout", "master"].join(" "));
});

spawnSync("paplay", ["./pop.wav"]);

// delete all local branches:
// git branch | grep -v "^\*" | awk '{print $1}' | xargs git branch -D
