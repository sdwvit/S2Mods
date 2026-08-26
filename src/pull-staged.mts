import path from "node:path";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { logger } from "./logger.mts";
import { modFolderSteam } from "./base-paths.mts";
import { sdkStagedModFolder } from "./mod-meta-paths.mts";

/**
 * Mirror the staged tree into steamworkshop/ so releases ship the shape the game installs:
 * Windows/<variant>/Windows/Stalker2/Mods/<mod>/Content/Paks/Windows, one folder per cook variant.
 */
const copyStaged = async () => {
  const sourcePath = await sdkStagedModFolder;
  const destinationPath = path.join(modFolderSteam, "Windows");

  logger.log(`Pulling staged mod from ${sourcePath}...`);
  if (!existsSync(sourcePath) || readdirSync(sourcePath).length === 0) {
    console.error(`No files found in source path: ${sourcePath}`);
    return;
  }

  rmSync(destinationPath, { recursive: true, force: true });
  mkdirSync(path.dirname(destinationPath), { recursive: true });
  cpSync(sourcePath, destinationPath, { recursive: true });
  logger.log(`Staged mod copied to ${destinationPath}`);
};

await copyStaged();
