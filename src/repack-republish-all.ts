import { validMods } from "./base-paths.mts";
import { logger } from "./logger.mts";
import { cmd } from "./cmd.mts";

validMods.forEach((mod) => {
  cmd(["git", "checkout", mod].join(" "));
  spawnNode("./publish-modio.mts", { CHANGENOTE: "Initial release" });
});
function spawnNode(tsFile: string, env: Record<string, string>) {
  const fullCmd = `node --import file:${process.env.NODE_TS_TRANSFORMER} ${tsFile}`;
  logger.log("Using command: " + fullCmd + "\n\nExecuting...\n");

  cmd(fullCmd, env);
}
