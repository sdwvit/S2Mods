import path from "node:path";
import fs from "node:fs";
import { logger } from "./logger.mts";
import childProcess from "node:child_process";
import { modFolderRaw, modFolderSteamStruct, projectRoot } from "./base-paths.mts";

export function getPackFileName(modName: string) {
  return `${modName}Stalker2-Windows.pak`;
}

export function pack(modName: string) {
  const packName = getPackFileName(modName);

  if (!fs.existsSync(modFolderSteamStruct)) {
    fs.mkdirSync(modFolderSteamStruct, { recursive: true });
  }
  const fullCmd = [process.env.REPAK_PATH, "pack", modFolderRaw, packName, "&&", "mv", path.join(projectRoot, packName), modFolderSteamStruct].join(
    " ",
  );

  logger.log("Now packing the resource mod...");

  childProcess.execSync(fullCmd, {
    stdio: "inherit",
    cwd: projectRoot,
    shell: "/usr/bin/bash",
  });
}
