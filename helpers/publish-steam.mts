import path from "node:path";
import childProcess from "node:child_process";
import * as fs from "node:fs";
import * as VDF from "@node-steam/vdf";

import dotEnv from "dotenv";

dotEnv.config();
const MODS_PATH = path.join(import.meta.dirname, "../Mods");
const STALKER_STEAM_ID = "1643320";
const vdfTemplate = (modPath, title, description, changenote = "Initial release") => `
"workshopitem"
{
	"appid"		"${STALKER_STEAM_ID}"
	"publishedfileid"		"0"
	"contentfolder"		"${path.join(modPath, "steamworkshop")}"
	"previewfile"			"${path.join(modPath, "512.png")}"
	"title"		"${title}"
	"description"		"${description}"
	"changenote"		"${changenote}"
}
`;
const sanitize = (str) => str.replace(/\n/g, "\\n").replace(/"/g, '\\"');
const STEAMSH_PATH = "/home/sdwvit/IdeaProjects/steamcmd/steamcmd.sh";

const cmd = (name: string) => {
  let title = `${process.env.MOD_NAME.replace(/([A-Z])/g, " $1")} by sdwvit`;
  let description = "";
  let changenote = "Initial release";
  const modFolder = path.join(MODS_PATH, name);
  const vdfFilePath = path.join(modFolder, `${name}.vdf`);
  const metaPath = path.join(modFolder, "meta.json");

  if (fs.existsSync(metaPath)) {
    const metaContent = fs.readFileSync(metaPath, "utf8");
    const metaData = JSON.parse(metaContent);
    description ||= metaData.description;
    changenote ||= metaData.changenote;
  }

  if (fs.existsSync(vdfFilePath)) {
    const vdfContent = fs.readFileSync(vdfFilePath, "utf8");
    const vdfData = VDF.parse(vdfContent);
    vdfData.workshopitem.title ||= title;
    vdfData.workshopitem.description ||= description;
    vdfData.workshopitem.changenote = changenote;
    vdfData.workshopitem.title = sanitize(vdfData.workshopitem.title);
    vdfData.workshopitem.description = sanitize(vdfData.workshopitem.description);
    vdfData.workshopitem.changenote = sanitize(vdfData.workshopitem.changenote);

    fs.writeFileSync(vdfFilePath, VDF.stringify(vdfData), "utf8");
  } else {
    title = sanitize(title);
    description = sanitize(description);
    changenote = sanitize(changenote);
    fs.writeFileSync(vdfFilePath, vdfTemplate(modFolder, title, description, changenote).trim(), "utf8");
  }

  return [STEAMSH_PATH, "+login", "sdwvit", "$STEAM_PASS", "+workshop_build_item", `"${vdfFilePath}"`, "+quit"].join(
    " ",
  );
};

childProcess.execSync(cmd(process.env.MOD_NAME), {
  stdio: "inherit",
  cwd: MODS_PATH,
  shell: "/usr/bin/bash",
  env: process.env,
});
