import { allValidMods } from "./base-paths.mts";
import { cmd, node } from "./cmd.mts";

allValidMods.forEach((mod) => {
  cmd(["git", "checkout", mod].join(" "));
  cmd(["git", "pull"].join(" "));
  node("./cook-inject.mts");
  node("./zip-for-xbox.mts");
});
