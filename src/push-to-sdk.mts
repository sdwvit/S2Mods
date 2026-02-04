import path from "node:path";

import { logger } from "./logger.mjs";
import { modFolderRaw, modFolderSdkLink, modMeta, sdkModFolder } from "./base-paths.mjs";
import { mkdirSync, cpSync, existsSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { createMod } from "./cook.mts";
import { recursiveCfgFind } from "./recursive-cfg-find.mts";

async function cmd() {
  const meta = await modMeta;
  const destinationPath = path.join(await sdkModFolder, "Content");
  const sourcePath = path.join(modFolderRaw, "Stalker2", "Content");
  logger.log(`Pushing raw mod from ${sourcePath} to ${destinationPath}...`);
  if (!existsSync(path.join(await sdkModFolder))) {
    logger.log("Mod doesn't exist, creating...");
    await createMod();
  }
  if (readdirSync(sourcePath).length === 0) {
    console.error(`No files found in source path: ${sourcePath}`);
    return;
  }
  if (!existsSync(modFolderSdkLink)) {
    symlinkSync(await sdkModFolder, modFolderSdkLink);
  }
  if (existsSync(destinationPath) && meta.structTransformers.length) {
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
}

await cmd();
