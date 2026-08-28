import path from "node:path";

import * as fs from "node:fs";
import { pathToFileURL } from "node:url";
import { logger } from "./logger.mts";
import { modFolderRaw } from "./base-paths.mts";
import { primarySdkModTarget } from "./mod-meta-paths.mts";
import { cpSync } from "node:fs";

/**
 * Copy the SDK mod folder back over raw/. This MUTATES raw/, so anything that fingerprints raw/
 * (see ensure-cooked.mts) has to run it first - fingerprinting before the pull records a hash
 * that the pull immediately invalidates, and the next publisher then re-cooks for nothing.
 */
export async function pullAssets() {
  // Only the half that owns the mod's own SDK name: it is the one the Mod Editor authors assets
  // in, and the one whose .uplugin belongs in raw/. Pulling the cfg half back would copy its
  // <Mod>Cfg.uplugin into raw/ and its own .cfgs over the generated ones.
  const sourcePath = (await primarySdkModTarget).modFolder;
  const destinationPath = path.join(modFolderRaw, "Stalker2");
  logger.log(`Pulling mod assets from ${sourcePath}...`);
  if (!fs.existsSync(sourcePath) || fs.readdirSync(sourcePath).length === 0) {
    console.error(`No files found in source path: ${sourcePath}`);
    return;
  }

  // preserveTimestamps keeps raw/ dated by the SDK sources rather than by this copy - without it
  // the pull makes raw/ look newer than the staged cook, and the next publisher re-cooks for nothing.
  cpSync(sourcePath, destinationPath, { recursive: true, force: true, preserveTimestamps: true });
}

// Only when run as a script (`pnpm pull-assets`): importers call pullAssets() themselves, and a
// top-level pull would double-copy for them.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await pullAssets();
