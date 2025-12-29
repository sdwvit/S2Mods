import { validMods } from "./base-paths.mts";
import { spawnSync } from "child_process";
import { logger } from "./logger.mts";

const cmd = (c: string) => {
  logger.log("-- Executing command", c);
  return spawnSync(c, {
    stdio: "inherit",
    cwd: import.meta.dirname,
    shell: "/usr/bin/bash",
    env: { ...process.env },
  });
};

cmd(["git", "checkout", "master"].join(" "));
validMods.forEach((mod) => {
  cmd(["git", "checkout", "-b", mod].join(" "));
  cmd(["git", "checkout", mod].join(" "));
  cmd(["git", "branch", "--set-upstream-to=origin/master", mod].join(" "));
  cmd(["git", "pull"].join(" "));
});
cmd(["git", "checkout", "master"].join(" "));

spawnSync("paplay", ["./pop.wav"]);

// delete all local branches:
// git branch | grep -v "^\*" | awk '{print $1}' | xargs git branch -D
