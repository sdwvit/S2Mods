import path from "node:path";

import * as fs from "node:fs";
import { logger } from "./logger.mts";
import { modFolderRaw } from "./base-paths.mts";
import { primarySdkModTarget } from "./mod-meta-paths.mts";
import { cpSync } from "node:fs";
async function pullAssets() {
  // Only the half that owns the mod's own SDK name: it is the one the Mod Editor authors assets
  // in, and the one whose .uplugin belongs in raw/. Pulling the cfg half back would copy its
  // <Mod>Cfg.uplugin into raw/ and its own .cfgs over the generated ones.
  const sourcePath = (await primarySdkModTarget).modFolder;
  const destinationPath = path.join(modFolderRaw, "Stalker2");
  logger.log(`Pulling mod assets from ${sourcePath}...`);
  if (fs.readdirSync(sourcePath).length === 0) {
    console.error(`No files found in source path: ${sourcePath}`);
    return;
  }

  // preserveTimestamps keeps raw/ dated by the SDK sources rather than by this copy - without it
  // the pull makes raw/ look newer than the staged cook, and the next publisher re-cooks for nothing.
  cpSync(sourcePath, destinationPath, { recursive: true, force: true, preserveTimestamps: true });
}

await pullAssets();
