import { allValidMods } from "./mod-context.mts";
import { cmdSync, nodeSync } from "./cmd.mts";

nodeSync("./gitbranches/pull-git-branches.mts");
allValidMods.forEach((mod) => {
  cmdSync(["git", "checkout", mod].join(" "));
  nodeSync("./publish/zip-for-xbox.mts");
});
