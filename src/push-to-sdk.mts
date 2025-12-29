import path from "node:path";

import { logger } from "./logger.mjs";
import { modName, sdkModsFolder, modFolderRaw, modFolderSdkSrc, sdkModFolder } from "./base-paths.mjs";
import { mkdirSync } from "fs";
import { cpSync, existsSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { createMod } from "./cook.mts";
import { recursiveCfgFind } from "./recursive-cfg-find.mts";

const cmd = () => {
  const destinationPath = path.join(sdkModsFolder, modName, "Content");
  const sourcePath = path.join(modFolderRaw, "Stalker2", "Content");
  logger.log(`Pushing raw mod from ${sourcePath} to ${destinationPath}...`);
  if (readdirSync(sourcePath).length === 0) {
    console.error(`No files found in source path: ${sourcePath}`);
    process.exit(1);
  }
  if (!existsSync(path.join(process.env.SDK_PATH, "Stalker2", "Mods", modName))) {
    logger.log("Mod doesn't exist, creating...");
    createMod(modName);
  }
  if (!existsSync(modFolderSdkSrc)) {
    symlinkSync(sdkModFolder, modFolderSdkSrc);
  }
  if (existsSync(destinationPath)) {
    logger.log(`Destination path ${destinationPath} exists... cleaning up`);
    recursiveCfgFind(destinationPath, (file) => rmSync(file));
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
};

cmd();
