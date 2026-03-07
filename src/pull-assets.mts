import path from "node:path";

import * as fs from "node:fs";
import { logger } from "./logger.mjs";
import { modFolderRaw, sdkModFolder } from "./base-paths.mjs";
import { cpSync } from "node:fs";

async function pullAssets() {
  const sourcePath = path.join(await sdkModFolder);
  const destinationPath = path.join(modFolderRaw, "Stalker2");
  logger.log(`Pulling mod assets from ${sourcePath}...`);
  if (fs.readdirSync(sourcePath).length === 0) {
    console.error(`No files found in source path: ${sourcePath}`);
    return;
  }

  cpSync(sourcePath, destinationPath, { recursive: true, force: true });
}

await pullAssets();
