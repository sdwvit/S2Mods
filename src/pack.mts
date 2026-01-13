import path from "node:path";
import fs from "node:fs";
import { logger } from "./logger.mts";
import childProcess from "node:child_process";
import { modFolderRaw, modFolderSteamStruct, projectRoot, sdkModName } from "./base-paths.mts";

export async function getPackFileName() {
  return `${await sdkModName}Stalker2-Windows.pak`;
}

export async function pack() {
  const packName = await getPackFileName();

  if (!fs.existsSync(await modFolderSteamStruct)) {
    fs.mkdirSync(await modFolderSteamStruct, { recursive: true });
  }
  const fullCmd = [
    process.env.REPAK_PATH,
    "pack",
    modFolderRaw,
    packName,
    "&&",
    "mv",
    path.join(projectRoot, packName),
    await modFolderSteamStruct,
  ].join(" ");

  logger.log("Now packing the resource mod...");

  childProcess.execSync(fullCmd, {
    stdio: "inherit",
    cwd: projectRoot,
    shell: "/usr/bin/bash",
  });
}
