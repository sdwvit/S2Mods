import path from "node:path";
import childProcess from "node:child_process";
import dotEnv from "dotenv";
import { logger } from "./logger.mts";
import { spawnSync } from "child_process";
import { existsSync, rmSync } from "node:fs";
import { projectRoot } from "./base-paths.mts";
import { primarySdkModTarget, type SdkModTarget, sdkModTargets } from "./mod-meta-paths.mts";
import { withSdkMutationLock } from "./sdk-mutation-lock.mts";
import { writePackageClassifierLists } from "./package-classifier.mts";

dotEnv.config({ path: path.join(import.meta.dirname, "..", ".env") });
export const getNTPath = (p: string) => p.replaceAll("\\", "/").replaceAll("/media/", "U:/");

/**
 * `target` selects which SDK mod to act on. A mod with both .cfg patches and cooked assets is
 * driven as two SDK mods (see SdkModTarget); everything else has exactly one, and omitting the
 * argument addresses it - the same folder these functions have always addressed.
 */
export async function createMod(target?: SdkModTarget) {
  const { name } = target ?? (await primarySdkModTarget);
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
      `-ModName=${name}`,
    ].join(" ");
    logger.log(cmd + "\n\nExecuting...\n");
    childProcess.execSync(cmd, {
      stdio: "inherit",
      cwd: projectRoot,
      shell: "/usr/bin/bash",
    });
  });
}

/** Cook every SDK mod this repo mod is built as - one, or two for a split mod. */
export async function cookAllTargets() {
  for (const target of await sdkModTargets) await cookMod(target);
}

export async function cookMod(target?: SdkModTarget) {
  const resolved = target ?? (await primarySdkModTarget);
  // .cfg files never reach the cooker, so a cfg-only SDK mod has nothing to cook: the ~22 min
  // editor round-trip would hand back an empty IoStore container and the same cfgs it started
  // with. Pack those directly instead - ~10s, same output. See planCfgOnlyVariant.
  if (resolved.kind === "cfgs") {
    const { repackMod } = await import("./repack.mts");
    return repackMod(resolved);
  }
  const { name: sdkModName, modFolder, packageClassifierFolder } = resolved;
  return withSdkMutationLock("cookMod", async () => {
    const UAT_PATH = getNTPath(
      path.join(process.env.SDK_PATH, "Engine", "Build", "BatchFiles", "RunUAT.bat"),
    );
    const PROJECT_PATH = getNTPath(
      path.join(process.env.SDK_PATH, "Stalker2", "Stalker2.uproject"),
    );
    const PLUGIN_PATH = getNTPath(
      path.join(process.env.SDK_PATH, "Stalker2", "Mods", sdkModName, `${sdkModName}.uplugin`),
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
    if (!existsSync(modFolder)) {
      logger.log(`SDK mod ${sdkModName} doesn't exist, creating...`);
      await createMod(target);
    }
    // GSCCookMod is the parent command the Mod Editor's Package button runs: it drives both
    // halves of the mod (NewContent for assets it adds, OverrideContent for files it replaces),
    // 3 files each in their own staged folder. The children are steered by the PackageClassifier
    // lists, so cooking them directly would produce a half-empty container.
    const classifierDir = packageClassifierFolder;
    const { newPackages } = await writePackageClassifierLists(target);

    // Each pass costs ~21 min almost entirely in `Refreshing mounted config path 'BaseGame'` -
    // parsing the 151k .cfg files of the base GameData tree - regardless of how much the mod
    // actually ships. With no new packages the NewContent pass has nothing to cook: its output
    // is the .uplugin plus a stub AssetRegistry.bin, identical for every mod. So run only the
    // OverrideContent child, exactly as the SDK's own PakPlainMod.bat does, and halve the cook.
    // Its pak is the one that carries the loose .cfg patches, so it always has to run.
    const overrideOnly = newPackages.length === 0;
    if (overrideOnly) {
      logger.log(
        "No new packages - cooking OverrideContent only and skipping the NewContent pass.",
      );
      // The parent GSCCookMod wipes SavedMods/{Cooked,Staged}/<mod> before it starts; a child
      // run only clears its own variant. Drop a NewContent tree left by an earlier full cook,
      // or pull-staged would ship a stale half.
      for (const dir of ["Cooked", "Staged"]) {
        const stale = path.join(
          process.env.SDK_PATH,
          "Stalker2",
          "SavedMods",
          dir,
          sdkModName,
          "Windows",
          "NewContent",
        );
        if (existsSync(stale)) {
          logger.log(`Removing stale ${dir}/NewContent from a previous full cook.`);
          rmSync(stale, { recursive: true, force: true });
        }
      }
    }
    logger.log("Now cooking using command: ");
    const fullCmd = [
      "time",
      process.env.WINE,
      `"${UAT_PATH}"`,
      ...(overrideOnly
        ? [
            "GSCCookModOverrideContent",
            `-CustomConfig=ModCookOverrideContent`,
            // The parent hands each child one list to cook and the other to never cook. Passing
            // them explicitly is what -PackageClassifierOutputDir does for the parent.
            `"-AssetsToCookWithDLCList=${getNTPath(path.join(classifierDir, "OverridePackages.txt"))}"`,
            `"-AssetsToNeverCookWithDLCList=${getNTPath(path.join(classifierDir, "NewPackages.txt"))}"`,
          ]
        : ["GSCCookMod", `"-PackageClassifierOutputDir=${getNTPath(classifierDir)}"`]),
      `"-Project=${PROJECT_PATH}"`,
      `"-PluginPath=${PLUGIN_PATH}"`,
      `-TargetPlatform=Win64`,
      `-BasedOnReleaseVersion=Latest`,
      `"-UnrealExe=${UNREAL_EXE_PATH}"`,
      // RunUAT rebuilds AutomationTool and the project's script modules on every invocation
      // otherwise. The SDK's own PakPlainMod.bat passes both, so the installed build is
      // expected to be used as-is.
      "-nocompile",
      "-nocompileuat",
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
