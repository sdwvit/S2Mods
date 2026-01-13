import path from "node:path";

import * as fs from "node:fs";
import { logger } from "./logger.mjs";
import { modFolderRaw, sdkModFolder, sdkModsFolder } from "./base-paths.mjs";
import { cpSync } from "node:fs";
import { metaPromise } from "./meta-promise.mts";
const {meta} = await metaPromise;
const pullAssets = () => {
  const resolvedSdkModFolder = path.join(sdkModsFolder, meta.sdkModNameOverride) || sdkModFolder;
  const sourcePath = path.join(resolvedSdkModFolder, "Content");
  const destinationPath = path.join(modFolderRaw, "Stalker2", "Content");
  logger.log(`Pulling mod assets from ${sourcePath}...`);
  if (fs.readdirSync(sourcePath).length === 0) {
    console.error(`No files found in source path: ${sourcePath}`);
    process.exit(1);
  }

  cpSync(sourcePath, destinationPath, { recursive: true, force: true });
};

pullAssets();
