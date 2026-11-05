import fs from "node:fs";
import path from "node:path";
import { createModZip, type ZipSource } from "./zip.mts";
import { uploadFileToGoogleDrive } from "../upload-google-drive.mts";
import { modFolderRaw, modName, sdkModsFolder } from "../base-paths.mts";

// XBOX_ZIP_FROM_SDK=1: zip the SDK plugin folder <Mod> (with its Wwise project), the Content of
// <Mod>Cfg, and the mod's source WAVs from <ZoneKit>/O/Voices/<lang>/<Mod>, laid out like the
// Zone Kit root (the .wproj's Originals is ..\..\..\..\O). Otherwise zip raw/Stalker2.
const sources: ZipSource[] = [];
if (process.env.XBOX_ZIP_FROM_SDK === "1") {
  sources.push({ dir: path.join(sdkModsFolder, modName) });
  const cfgDir = path.join(sdkModsFolder, `${modName}Cfg`);
  if (fs.existsSync(cfgDir)) sources.push({ dir: cfgDir, glob: "Content/**" });
  const voicesDir = path.join(process.env.SDK_PATH, "O", "Voices");
  for (const lang of fs.existsSync(voicesDir) ? fs.readdirSync(voicesDir) : []) {
    const wavDir = path.join(voicesDir, lang, modName);
    if (fs.existsSync(wavDir)) sources.push({ dir: wavDir, prefix: `O/Voices/${lang}/${modName}` });
  }
} else {
  sources.push({ dir: path.join(modFolderRaw, "Stalker2") });
}

const zipPath = await createModZip(sources);
await uploadFileToGoogleDrive(zipPath);
