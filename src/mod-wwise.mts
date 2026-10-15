import path from "node:path";
import { pathToFileURL } from "node:url";
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { logger } from "./logger.mts";
import { modFolder } from "./base-paths.mts";
import { primarySdkModTarget } from "./mod-meta-paths.mts";
import { walkRaw } from "./mod-kinds.mts";

/**
 * A Wwise audio mod's inputs, kept in the repo because the SDK can't be trusted to hold them.
 *
 *   Mods/<Mod>/wwise/GeneratedSoundBanks/Windows/{Event,Media}/...   -> $SDK/Stalker2/S2_WwiseProject/GeneratedSoundBanks/...
 *   Mods/<Mod>/wwise/S2_WwiseProject/<work unit path>.wwu            -> $SDK/Stalker2/Mods/<Mod>/S2_WwiseProject/...
 *
 * The cook bundles each checked-out AkAudioEvent's bank and media out of the *shared*
 * GeneratedSoundBanks folder; raw/ only holds the 2 KB event .uassets. Every mod's Wwise project
 * writes into that one folder, so regenerating banks for any other mod silently puts vanilla
 * banks back. The repo copy is the source of truth: it goes into the SDK before every cook
 * (installModWwiseBanks) and on push-to-sdk (installModWwiseProject), and nothing copies it back
 * automatically - pulling would capture whatever another mod last generated. After generating new
 * banks for this mod, save them with `node ../../src/mod-wwise.mts --pull` from Mods/<Mod>.
 *
 * The .wwu files are the edited work units of the per-mod Wwise project (the full project is a
 * 256 MB copy of GSC's and stays out of git), so the banks can be regenerated later. See the
 * eng-wwise skill for generating banks on the Wwise trial licence.
 */
export const modWwiseFolder = path.join(modFolder, "wwise");
const banksSubdir = "GeneratedSoundBanks";
const projectSubdir = "S2_WwiseProject";
const sdkBanksFolder = () =>
  path.join(process.env.SDK_PATH, "Stalker2", "S2_WwiseProject", banksSubdir);
const sdkProjectFolder = async () => path.join((await primarySdkModTarget).modFolder, projectSubdir);

/** Bank and media files this mod ships, sorted; [] for a mod with no Wwise content. */
export const modWwiseBankFiles = (): string[] => walkRaw(path.join(modWwiseFolder, banksSubdir));
const modWwiseProjectFiles = (): string[] => walkRaw(path.join(modWwiseFolder, projectSubdir));

/** Copy each file under `fromRoot` to the same relative path under `toRoot`, if its bytes differ. */
function copyTree(files: string[], fromRoot: string, toRoot: string, what: string) {
  let copied = 0;
  for (const file of files) {
    const target = path.join(toRoot, path.relative(fromRoot, file));
    if (existsSync(target) && readFileSync(target).equals(readFileSync(file))) continue;
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(file, target, { preserveTimestamps: true });
    copied++;
  }
  if (files.length) logger.log(`[wwise] ${what}: ${copied}/${files.length} file(s) updated in ${toRoot}`);
}

/** Before a cook: put this mod's banks and media into the shared GeneratedSoundBanks folder. */
export function installModWwiseBanks() {
  copyTree(modWwiseBankFiles(), path.join(modWwiseFolder, banksSubdir), sdkBanksFolder(), "banks");
}

/**
 * On push-to-sdk: put the edited work units into the SDK mod's Wwise project. Skipped while that
 * project doesn't exist yet - the Zone Kit creates it on the first Audio Modding -> Open Wwise
 * Project, and the files can only land in a full copy.
 */
export async function installModWwiseProject() {
  const files = modWwiseProjectFiles();
  if (!files.length) return;
  const target = await sdkProjectFolder();
  if (!existsSync(path.join(target, "S2_WwiseProject.wproj"))) {
    logger.log(
      `[wwise] ${target} doesn't exist yet - open the Wwise project from the Mod Editor once, then push again.`,
    );
    return;
  }
  copyTree(files, path.join(modWwiseFolder, projectSubdir), target, "work units");
}

/** Save freshly generated banks and edited work units back into the repo (the files it already tracks). */
export async function pullModWwise() {
  const pull = (files: string[], repoRoot: string, sdkRoot: string, what: string) => {
    const fromSdk = files
      .map((file) => path.join(sdkRoot, path.relative(repoRoot, file)))
      .filter((file) => existsSync(file));
    copyTree(fromSdk, sdkRoot, repoRoot, what);
  };
  pull(modWwiseBankFiles(), path.join(modWwiseFolder, banksSubdir), sdkBanksFolder(), "banks");
  pull(modWwiseProjectFiles(), path.join(modWwiseFolder, projectSubdir), await sdkProjectFolder(), "work units");
}

// Only when run as a script: `--pull` saves the SDK copies into the repo, default installs both.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--pull")) {
    await pullModWwise();
  } else {
    installModWwiseBanks();
    await installModWwiseProject();
  }
}
