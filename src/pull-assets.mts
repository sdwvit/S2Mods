import path from "node:path";

import * as fs from "node:fs";
import { pathToFileURL } from "node:url";
import { logger } from "./logger.mts";
import { modFolderRaw } from "./base-paths.mts";
import { primarySdkModTarget } from "./mod-meta-paths.mts";
import { isTransientCookArtifact } from "./mod-kinds.mts";
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
  // The filter keeps the cooker's own scratch packages out of raw/: they are regenerated with a new
  // id every cook, so pulling them in would invalidate the fingerprint the cook just recorded.
  // Localization assets are deliberately NOT filtered out any more: writeModLocalization writes
  // the generated one into raw/ *and* over the SDK's copy, so the pull is a no-op for it - while
  // an asset authored in the Mod Editor and never generated here (a mod with no
  // writeLocalization.mts) has to reach raw/ like any other .uasset, or it is never committed and
  // never packed.
  cpSync(sourcePath, destinationPath, {
    recursive: true,
    force: true,
    preserveTimestamps: true,
    filter: (source) => !isTransientCookArtifact(source),
  });

  // Earlier pulls (and the commits they produced) may already have left one in raw/. Drop it, or
  // it keeps counting as authored content for everything that reads raw/ off disk directly.
  for (const stale of findTransientCookArtifacts(destinationPath)) {
    logger.log(`Removing stale cook artifact from raw/: ${path.relative(modFolderRaw, stale)}`);
    fs.rmSync(stale, { force: true });
  }
}

function findTransientCookArtifacts(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return findTransientCookArtifacts(full);
    return isTransientCookArtifact(full) ? [full] : [];
  });
}

// Only when run as a script (`pnpm pull-assets`): importers call pullAssets() themselves, and a
// top-level pull would double-copy for them.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await pullAssets();
