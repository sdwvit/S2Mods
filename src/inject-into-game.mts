import { logger } from "./logger.mts";
import { gameModsFolder, modName } from "./base-paths.mts";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { withSdkMutationLock } from "./sdk-mutation-lock.mts";
import { modClassification, sdkModTargets } from "./mod-meta-paths.mts";
import { purgeLooseCfgsForMod, purgePaksForMod } from "./inject-raw.mts";

/**
 * Install a cooked mod the way the game expects it: the whole staged tree (one folder per cook
 * variant) under a folder named after the mod, rather than loose paks in the mods root.
 */
export async function injectStagedIntoGame() {
  const targets = await sdkModTargets;
  await withSdkMutationLock(`inject-staged:${modName}`, async () => {
    await purgePaksForMod();
    purgeLooseCfgsForMod();
    const destination = path.join(gameModsFolder, modName);
    mkdirSync(gameModsFolder, { recursive: true });
    // One folder in notmods/ per repo mod, holding every SDK mod it is built as. The two halves
    // of a split mod land in different Stalker2/Mods/<sdkName> subfolders of the same tree, so
    // this is a plain overlay - nothing of one half can overwrite the other, and the game mounts
    // both containers.
    rmSync(destination, { recursive: true, force: true });
    for (const target of targets) {
      const label = modClassification.isSplit ? ` (${target.kind})` : "";
      logger.log(
        `Injecting cooked mod${label} from ${target.stagedModFolder} into ${destination}...`,
      );
      cpSync(target.stagedModFolder, path.join(destination, "Windows"), { recursive: true });
    }
    logger.log("Done.");
  });
}
