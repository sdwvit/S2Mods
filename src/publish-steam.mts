import path from "node:path";
import childProcess from "node:child_process";
import * as fs from "node:fs";
import * as VDF from "@node-steam/vdf";

await import("./pull-staged.mjs");
const STALKER_STEAM_ID = "1643320";
import { metaPromise } from "./metaPromise.mjs";
import { spawnSync } from "child_process";
import { modFolder, modFolderSteam, modName } from "./base-paths.mjs";
import { writeFileSync } from "node:fs";
const { meta } = await metaPromise;
const sanitize = (str: string) => str.replace(/\n/g, "").replace(/"/g, '\\"');

const cmd = () => {
  const vdfFilePath = path.join(modFolder, `workshopitem.vdf`);
  const vdfData = fs.existsSync(vdfFilePath) ? VDF.parse(fs.readFileSync(vdfFilePath, "utf8")) : { workshopitem: {} };

  vdfData.workshopitem.appid = STALKER_STEAM_ID;
  vdfData.workshopitem.publishedfileid ||= "0"; // This will be set by SteamCMD
  vdfData.workshopitem.contentfolder = modFolderSteam;
  vdfData.workshopitem.previewfile = path.join(modFolder, "512.png");
  vdfData.workshopitem.title = sanitize(`${modName.replace(/([A-Z]\w])/g, " $1").trim()} by sdwvit`);
  vdfData.workshopitem.description = sanitize(
    meta.description +
      `[hr][/hr]This mod is open source and hosted on [url=https://github.com/sdwvit/S2Mods/tree/master/Mods/${modName}]github[/url].[h3][/h3]`,
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

childProcess.execSync(cmd(), {
  stdio: "inherit",
  cwd: modFolder,
  shell: "/usr/bin/bash",
  env: process.env,
});

spawnSync("paplay", ["./pop.wav"]);
