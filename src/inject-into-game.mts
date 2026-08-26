import { logger } from "./logger.mts";
import { gameModsFolder, modName } from "./base-paths.mts";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { withSdkMutationLock } from "./sdk-mutation-lock.mts";
import { sdkStagedModFolder } from "./mod-meta-paths.mts";
import { purgePaksForMod } from "./inject-raw.mts";

/**
 * Install a cooked mod the way the game expects it: the whole staged tree (one folder per cook
 * variant) under a folder named after the mod, rather than loose paks in the mods root.
 */
export async function injectStagedIntoGame() {
  const source = await sdkStagedModFolder;
  await withSdkMutationLock(`inject-staged:${modName}`, async () => {
    await purgePaksForMod();
    const destination = path.join(gameModsFolder, modName);
    logger.log(`Injecting cooked mod from ${source} into ${destination}...`);
    mkdirSync(gameModsFolder, { recursive: true });
    rmSync(destination, { recursive: true, force: true });
    cpSync(source, path.join(destination, "Windows"), { recursive: true });
    logger.log("Done.");
  });
}
