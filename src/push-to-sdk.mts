import path from "node:path";

import * as fs from "node:fs";
import { logger } from "./logger.mjs";
import { modName, sdkModsFolder, modFolderRaw } from "./base-paths.mjs";
import { mkdirSync } from "fs";
import { cpSync, existsSync } from "node:fs";
import { createMod } from "./cook.ts";

const cmd = () => {
  const destinationPath = path.join(sdkModsFolder, modName, "Content", "GameLite", "GameData");
  const sourcePath = path.join(modFolderRaw, "Stalker2", "Content", "GameLite", "GameData");
  logger.log(`Pushing raw mod from ${sourcePath} to ${destinationPath}...`);
  if (fs.readdirSync(sourcePath).length === 0) {
    console.error(`No files found in source path: ${sourcePath}`);
    process.exit(1);
  }
  if (!existsSync(path.join(process.env.SDK_PATH, "Stalker2", "Mods", modName))) {
    logger.log("Mod doesn't exist, creating...");
    createMod(modName);
  }
  if (fs.existsSync(destinationPath)) {
    logger.log(`Destination path ${destinationPath} exists... cleaning up`);
    fs.rmSync(destinationPath, { recursive: true, force: true });
  }
  mkdirSync(destinationPath, { recursive: true });
  cpSync(path.join(sourcePath), path.join(destinationPath), { recursive: true });
  logger.log(`Done copying files to ${destinationPath}`);
};

cmd();
