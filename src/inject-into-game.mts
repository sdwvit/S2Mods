import { logger } from "./logger.mts";
import { gameModsFolder, modName, projectRoot } from "./base-paths.mts";
import childProcess from "node:child_process";
import { withSdkMutationLock } from "./sdk-mutation-lock.mts";

export async function injectIntoGame(sourcePath: string) {
  await withSdkMutationLock(`inject-into-game:${modName}`, async () => {
    logger.log("Injecting into the game using command: ");

    const fullCmd = ["cp", sourcePath, `'${gameModsFolder}'`].join(" ");

    logger.log(fullCmd + "\n\nExecuting...\n");

    childProcess.execSync(fullCmd, {
      stdio: "inherit",
      cwd: projectRoot,
      shell: "/usr/bin/bash",
    });
  });
}
