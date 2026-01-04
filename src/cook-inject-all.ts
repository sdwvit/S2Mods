import { allValidMods } from "./base-paths.mts";
import { cmdSync, nodeSync } from "./cmd.mts";

allValidMods.forEach((mod) => {
  cmdSync(["git", "checkout", mod].join(" "));
  cmdSync(["git", "pull"].join(" "));
  nodeSync("./cook-inject.mts");
});
