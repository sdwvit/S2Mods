import { allValidMods } from "./base-paths.mts";
import { spawnSync } from "child_process";
import { cmdSync } from "./cmd.mts";

cmdSync(["git", "checkout", "master"].join(" "));
cmdSync(["git", "pull"].join(" "));

allValidMods.forEach((mod) => {
  cmdSync(["git", "checkout", "-b", mod].join(" "));
  cmdSync(["git", "checkout", mod].join(" "));
  cmdSync(["git", "branch", "--set-upstream-to=origin/master", mod].join(" "));
  cmdSync(["git", "pull"].join(" "));
});
cmdSync(["git", "checkout", "master"].join(" "));

spawnSync("paplay", ["./pop.wav"]);

// delete all local branches:
// git branch | grep -v "^\*" | awk '{print $1}' | xargs git branch -D
