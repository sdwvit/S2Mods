import { allValidMods } from "./base-paths.mts";
import { spawnSync } from "child_process";
import { cmd } from "./cmd.mts";

cmd(["git", "checkout", "master"].join(" "));
cmd(["git", "pull"].join(" "));

allValidMods.forEach((mod) => {
  cmd(["git", "checkout", "-b", mod].join(" "));
  cmd(["git", "checkout", mod].join(" "));
  cmd(["git", "branch", "--set-upstream-to=origin/master", mod].join(" "));
  cmd(["git", "pull"].join(" "));
});
cmd(["git", "checkout", "master"].join(" "));

spawnSync("paplay", ["./pop.wav"]);

// delete all local branches:
// git branch | grep -v "^\*" | awk '{print $1}' | xargs git branch -D
