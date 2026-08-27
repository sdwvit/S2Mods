import path from "node:path";

import * as fs from "node:fs";
import { logger } from "./logger.mts";
import { modFolderRaw } from "./base-paths.mts";
import { sdkModFolder } from "./mod-meta-paths.mts";
import { cpSync } from "node:fs";
async function pullAssets() {
  const sourcePath = path.join(await sdkModFolder);
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
