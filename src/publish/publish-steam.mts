import path from "node:path";
import childProcess from "node:child_process";
import * as fs from "node:fs";
import * as VDF from "@node-steam/vdf";
import "../ensure-env.mts";
const STALKER_STEAM_ID = "1643320";
import { spawnSync } from "child_process";
import { modFolder, modFolderSteam, modName } from "../base-paths.mts";
import { modMeta } from "../mod-meta-paths.mts";
import { sanitize } from "../sanitize.mts";
import { logger } from "../logger.mts";
import { getModifiedFiles } from "../get-modified-files.mts";
import { finalizePublish } from "./publish-tracker.mts";
import { ensureCooked } from "../ensure-cooked.mts";
const meta = await modMeta;
const cmd = () => {
  const vdfFilePath = path.join(modFolder, `workshopitem.vdf`);
  const vdfData = fs.existsSync(vdfFilePath)
    ? VDF.parse(fs.readFileSync(vdfFilePath, "utf8"))
    : { workshopitem: {} };

  vdfData.workshopitem.appid = STALKER_STEAM_ID;
  vdfData.workshopitem.publishedfileid ||= "0"; // This will be set by SteamCMD
  vdfData.workshopitem.contentfolder = modFolderSteam;
  vdfData.workshopitem.previewfile = path.join(modFolder, "512.png");
  vdfData.workshopitem.title = sanitize(
    `${(meta.nameOverride || modName).replace(/([A-Z]\w])/g, " $1").trim()} by ${meta.originalAuthor || "sdwvit"}`,
  );
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
  const publishedAt = new Date();
  const publishNote = process.env.CHANGENOTE || meta.changenote || "Update";
  if (process.env.WRITE_VDF_ONLY) {
    cmd(); // writes the workshopitem.vdf (title/description/changenote) without invoking steamcmd
    logger.log(`Wrote vdf only for ${modName}`);
    return;
  }
  // A description-only refresh re-uploads the already staged content folder untouched, so
  // cooking (and pulling SDK output over raw/) would only risk replacing shipped content.
  if (!process.env.DESC_ONLY) {
    await ensureCooked();
    await Promise.allSettled([import("../pull-assets.mts"), import("../pull-staged.mts")]);
  }
  childProcess.execSync(cmd(), {
    stdio: "inherit",
    cwd: modFolder,
    shell: "/usr/bin/bash",
    env: process.env,
  });

  spawnSync("paplay", ["./pop.wav"]);
  // Description-only refresh is not a new version — skip finalizePublish (no git commit/tag).
  if (!process.env.DESC_ONLY) {
    finalizePublish("steam", publishNote, publishedAt);
  }
}

await publishToSteam();
