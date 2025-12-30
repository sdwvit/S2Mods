import { validMods } from "./base-paths.mts";
import { cmd, node } from "./cmd.mts";

validMods.forEach((mod) => {
  cmd(["git", "checkout", mod].join(" "));
  cmd(["git", "pull"].join(" "));
  node("./cook-inject.mts");
  node("./publish-modio.mts", { CHANGENOTE: "Update" });
});
