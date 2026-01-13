import path from "node:path";
import childProcess from "node:child_process";
import dotEnv from "dotenv";
import { logger } from "./logger.mjs";
import { spawnSync } from "child_process";
import { existsSync } from "node:fs";
import { projectRoot, sdkModFolder, sdkModName } from "./base-paths.mts";

dotEnv.config({ path: path.join(import.meta.dirname, "..", ".env") });
export const getNTPath = (p: string) => p.replaceAll("\\", "/").replaceAll("/media/", "U:/");

export async function createMod() {
  const UAT_PATH = getNTPath(path.join(process.env.SDK_PATH, "Engine", "Build", "BatchFiles", "RunUAT.bat"));
  const PROJECT_PATH = getNTPath(path.join(process.env.SDK_PATH, "Stalker2", "Stalker2.uproject"));
  const cmd = [process.env.WINE, `"${UAT_PATH}"`, "GSCCreateEmptyMod", `"-Project=${PROJECT_PATH}"`, `-ModName=${await sdkModName}`].join(" ");
  logger.log(cmd + "\n\nExecuting...\n");
  childProcess.execSync(cmd, {
    stdio: "inherit",
    cwd: projectRoot,
    shell: "/usr/bin/bash",
  });
}

export async function cookMod() {
  const UAT_PATH = getNTPath(path.join(process.env.SDK_PATH, "Engine", "Build", "BatchFiles", "RunUAT.bat"));
  const PROJECT_PATH = getNTPath(path.join(process.env.SDK_PATH, "Stalker2", "Stalker2.uproject"));
  const PLUGIN_PATH = getNTPath(path.join(process.env.SDK_PATH, "Stalker2", "Mods", await sdkModName, `${await sdkModName}.uplugin`));
  const UNREAL_EXE_PATH = getNTPath(path.join(process.env.SDK_PATH, "Stalker2", "Binaries", "Win64", "Stalker2ModEditor-Win64-Shipping-Cmd.exe"));
  if (!existsSync(await sdkModFolder)) {
    logger.log("Mod doesn't exist, creating...");
    await createMod();
  }
  logger.log("Now packing the mod using command: ");
  const fullCmd = [
    "time",
    process.env.WINE,
    `"${UAT_PATH}"`,
    "CookMod",
    `"-Project=${PROJECT_PATH}"`,
    `"-PluginPath=${PLUGIN_PATH}"`,
    `-TargetPlatform=Win64`,
    `"-UnrealExe=${UNREAL_EXE_PATH}"`,
  ].join(" ");
  logger.log(fullCmd + "\n\nExecuting...\n");
  childProcess.execSync(fullCmd, {
    stdio: "inherit",
    cwd: projectRoot,
    shell: "/usr/bin/bash",
  });
  spawnSync("paplay", ["./pop.wav"]);
}
