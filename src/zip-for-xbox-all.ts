import { allValidMods } from "./mod-context.mts";
import { cmdSync, nodeSync } from "./cmd.mts";

nodeSync("./pull-git-branches.mts");
allValidMods.forEach((mod) => {
  cmdSync(["git", "checkout", mod].join(" "));
  nodeSync("./zip-for-xbox.mts");
});
