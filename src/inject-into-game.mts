import { logger } from "./logger.mts";
import path from "node:path";
import { getStagedPath } from "./cook.ts";
import { modName, projectRoot } from "./base-paths.mts";
import childProcess from "node:child_process";

export function injectIntoGame(sourcePath: string) {
  logger.log("Injecting into the game using command: ");

  const fullCmd = ["cp", sourcePath, `'${process.env.STALKER2_MODS_FOLDER}'`, "&&", "open", `'${process.env.STALKER2_MODS_FOLDER}'`].join(" ");

  logger.log(fullCmd + "\n\nExecuting...\n");

  childProcess.execSync(fullCmd, {
    stdio: "inherit",
    cwd: projectRoot,
    shell: "/usr/bin/bash",
  });
}
