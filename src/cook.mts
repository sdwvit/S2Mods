import path from "node:path";
import childProcess from "node:child_process";
import dotEnv from "dotenv";
import { logger } from "./logger.mts";
import { spawnSync } from "child_process";
import { existsSync } from "node:fs";
import { projectRoot } from "./base-paths.mts";
import { sdkModFolder, sdkModName, sdkPackageClassifierFolder } from "./mod-meta-paths.mts";
import { withSdkMutationLock } from "./sdk-mutation-lock.mts";

dotEnv.config({ path: path.join(import.meta.dirname, "..", ".env") });
export const getNTPath = (p: string) => p.replaceAll("\\", "/").replaceAll("/media/", "U:/");

export async function createMod() {
  return withSdkMutationLock("createMod", async () => {
    const UAT_PATH = getNTPath(
      path.join(process.env.SDK_PATH, "Engine", "Build", "BatchFiles", "RunUAT.bat"),
    );
    const PROJECT_PATH = getNTPath(
      path.join(process.env.SDK_PATH, "Stalker2", "Stalker2.uproject"),
    );
    const cmd = [
      process.env.WINE,
      `"${UAT_PATH}"`,
      "GSCCreatePlainMod",
      `"-Project=${PROJECT_PATH}"`,
      `-ModName=${await sdkModName}`,
    ].join(" ");
    logger.log(cmd + "\n\nExecuting...\n");
    childProcess.execSync(cmd, {
      stdio: "inherit",
      cwd: projectRoot,
      shell: "/usr/bin/bash",
    });
  });
}

export async function cookMod() {
  return withSdkMutationLock("cookMod", async () => {
    const UAT_PATH = getNTPath(
      path.join(process.env.SDK_PATH, "Engine", "Build", "BatchFiles", "RunUAT.bat"),
    );
    const PROJECT_PATH = getNTPath(
      path.join(process.env.SDK_PATH, "Stalker2", "Stalker2.uproject"),
    );
    const PLUGIN_PATH = getNTPath(
      path.join(
        process.env.SDK_PATH,
        "Stalker2",
        "Mods",
        await sdkModName,
        `${await sdkModName}.uplugin`,
      ),
    );
    const UNREAL_EXE_PATH = getNTPath(
      path.join(
        process.env.SDK_PATH,
        "Stalker2",
        "Binaries",
        "Win64",
        "Stalker2ModEditor-Win64-Shipping-Cmd.exe",
      ),
    );
    if (!existsSync(await sdkModFolder)) {
      logger.log("Mod doesn't exist, creating...");
      await createMod();
    }
    // GSCCookMod is the parent command the Mod Editor's Package button runs: it drives both
    // halves of the mod (NewContent for assets it adds, OverrideContent for files it replaces),
    // 3 files each in their own staged folder. The children are steered by the PackageClassifier
    // lists, so cooking them directly would produce a half-empty container.
    const classifierDir = await sdkPackageClassifierFolder;
    if (!existsSync(classifierDir)) {
      logger.log(
        `No PackageClassifier lists at ${classifierDir} - GSCCookMod is expected to generate them. ` +
          `If the cook comes out empty, open the mod in the Mod Editor and hit Package once to produce them.`,
      );
    }
    logger.log("Now cooking using command: ");
    const fullCmd = [
      "time",
      process.env.WINE,
      `"${UAT_PATH}"`,
      "GSCCookMod",
      `"-Project=${PROJECT_PATH}"`,
      `"-PluginPath=${PLUGIN_PATH}"`,
      `"-PackageClassifierOutputDir=${getNTPath(classifierDir)}"`,
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
  });
}
