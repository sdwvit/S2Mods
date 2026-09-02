import path from "node:path";
import { pathToFileURL } from "node:url";

import { logger } from "./logger.mts";
import { modFolderRaw, modFolderSdkLink } from "./base-paths.mts";
import {
  modClassification,
  modMeta,
  primarySdkModTarget,
  sdkModTargetFor,
  sdkModTargets,
} from "./mod-meta-paths.mts";
import { mkdirSync, cpSync, existsSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { createMod } from "./cook.mts";
import { recursiveCfgFind } from "./recursive-cfg-find.mts";
import { withSdkMutationLock } from "./sdk-mutation-lock.mts";

/** Exported so the SDK-mod creation and cfg routing can be tested without the Mod Editor. */
export async function pushToSdk() {
  await withSdkMutationLock("push-to-sdk", async () => {
    const meta = await modMeta;
    const sourcePath = path.join(modFolderRaw, "Stalker2", "Content");
    // This push only ever moves .cfg patches (recursiveCfgFind): cooked assets are authored in
    // the Mod Editor and travel the other way, via pull-assets. So the destination is the SDK
    // mod that owns the cfg half - a separate one from the assets half for a split mod.
    const target = modClassification.cfgFiles.length
      ? await sdkModTargetFor("cfgs")
      : await primarySdkModTarget;
    const destinationPath = path.join(target.modFolder, "Content");
    logger.log(`Pushing raw mod from ${sourcePath} to ${destinationPath}...`);
    // Create every SDK mod this repo mod is built as, not just the push destination: for a split
    // mod the assets half is where the Mod Editor authors .uassets, and it has to exist (and be
    // what the `sdk` symlink points at) before anyone can open it there. Only the missing ones -
    // GSCCreatePlainMod on an existing mod folder is not something to run for nothing.
    for (const t of await sdkModTargets) {
      if (existsSync(t.modFolder)) continue;
      logger.log(`SDK mod ${t.name} doesn't exist, creating...`);
      await createMod(t);
    }
    if (readdirSync(sourcePath).length === 0) {
      console.error(`No files found in source path: ${sourcePath}`);
      return;
    }
    // The `sdk` symlink points at the half that carries the mod's own SDK name, so opening it in
    // the Mod Editor still lands on the assets the editor is used for.
    if (!existsSync(modFolderSdkLink)) {
      symlinkSync((await primarySdkModTarget).modFolder, modFolderSdkLink);
    }
    // Clear stale cfgs out of EVERY target, not just the destination: a split mod used to keep
    // its cfgs inside the assets SDK mod, and leftovers there would be packed into the assets
    // pak as well and shadow the cfg half's copy. This is also the migration step for the mods
    // that were built before the split.
    if (meta.structTransformers.length) {
      for (const other of await sdkModTargets) {
        const content = path.join(other.modFolder, "Content");
        if (!existsSync(content)) continue;
        logger.log(`Cleaning stale cfgs out of ${content}...`);
        recursiveCfgFind(content, (file) => rmSync(file));
      }
    }
    mkdirSync(destinationPath, { recursive: true });

    recursiveCfgFind(sourcePath, (f, folder, shortFile) => {
      const fromRaw = path.relative(sourcePath, folder);
      const destinationFolder = path.join(destinationPath, fromRaw);
      if (!existsSync(destinationFolder)) {
        mkdirSync(destinationFolder, { recursive: true });
      }
      cpSync(f, path.join(destinationFolder, shortFile));
    });

    logger.log(`Done copying files to ${destinationPath}`);
  });
}

// Only when run as a script; importers call pushToSdk() themselves.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await pushToSdk();
