import path from "node:path";
import childProcess from "node:child_process";
import * as fs from "node:fs";
import * as VDF from "@node-steam/vdf";
import "./ensure-dot-env.mts";
const STALKER_STEAM_ID = "1643320";
import { metaPromise } from "./meta-promise.mts";
import { spawnSync } from "child_process";
import { modFolder, modFolderSteam, modName } from "./base-paths.mjs";
import { sanitize } from "./sanitize.mts";
import { logger } from "./logger.mts";
import { getModifiedFiles } from "./get-modified-files.mts";
const { meta } = await metaPromise;

const cmd = () => {
  const vdfFilePath = path.join(modFolder, `workshopitem.vdf`);
  const vdfData = fs.existsSync(vdfFilePath) ? VDF.parse(fs.readFileSync(vdfFilePath, "utf8")) : { workshopitem: {} };

  vdfData.workshopitem.appid = STALKER_STEAM_ID;
  vdfData.workshopitem.publishedfileid ||= "0"; // This will be set by SteamCMD
  vdfData.workshopitem.contentfolder = modFolderSteam;
  vdfData.workshopitem.previewfile = path.join(modFolder, "512.png");
  vdfData.workshopitem.title = sanitize(`${(meta.nameOverride || modName).replace(/([A-Z]\w])/g, " $1").trim()} ${meta.notOwned ? "" : "by sdwvit"}`);
  vdfData.workshopitem.description = sanitize(
    meta.description +
      `[hr][/hr]This mod is open source and hosted on [url=https://github.com/sdwvit/S2Mods/tree/master/Mods/${modName}]github[/url].[hr][/hr]
      Mod compatibility:

      Here is a list of extended files (this mod bPatches files, so it is compatible with other mods that don't modify the same lines): ${getModifiedFiles("steam")} 
      `,
  );
  vdfData.workshopitem.changenote = process.env.CHANGENOTE || sanitize(meta.changenote);

  fs.writeFileSync(vdfFilePath, VDF.stringify(vdfData), "utf8");

  return [
    process.env.STEAMCMD_PATH,
    "+login",
    `"${process.env.STEAM_USER}"`,
    `"${process.env.STEAM_PASS}"`,
    "+workshop_build_item",
    `"${vdfFilePath}"`,
    "+quit",
  ].join(" ");
};

async function publishToSteam() {
  if (process.env.DRY) {
    logger.log(`${import.meta.filename} dry run`);
    return;
  }
  await import("./pull-assets.mjs");
  await import("./pull-staged.mjs");
  childProcess.execSync(cmd(), {
    stdio: "inherit",
    cwd: modFolder,
    shell: "/usr/bin/bash",
    env: process.env,
  });

  spawnSync("paplay", ["./pop.wav"]);
}

await publishToSteam();
