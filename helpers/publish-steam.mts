import path from "node:path";
import childProcess from "node:child_process";
import * as fs from "node:fs";
import * as VDF from "@node-steam/vdf";

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

const STEAMSH_PATH = "/home/sdwvit/IdeaProjects/steamcmd/steamcmd.sh";

const cmd = (name: string, title: string, description: string, changenote = "") => {
  const modPath = path.join(MODS_PATH, name);
  const vdfFilePath = path.join(modPath, `${name}.vdf`);

  if (fs.existsSync(vdfFilePath)) {
    const vdfContent = fs.readFileSync(vdfFilePath, "utf8");
    const vdfData = VDF.parse(vdfContent);
    vdfData.workshopitem.title = title;
    vdfData.workshopitem.description = description.replace(/\n/g, "\\n").replace(/"/g, '\\"');
    vdfData.workshopitem.changenote = changenote;

    fs.writeFileSync(vdfFilePath, VDF.stringify(vdfData), "utf8");
  } else {
    fs.writeFileSync(vdfFilePath, vdfTemplate(modPath, title, description, changenote).trim(), "utf8");
  }

  return [STEAMSH_PATH, "+login", "sdwvit", "$STEAM_PASS", "+workshop_build_item", `"${vdfFilePath}"`, "+quit"].join(
    " ",
  );
};

childProcess.execSync(
  cmd(
    "GlassCannon",
    "Glass Cannon by sdwvit",
    `This mode does only one thing: increases weapons damage by a lot. Here’s the deal, kiddo - this mod makes you a glass cannon, so you’re basically one-shotting everything, at the same time you’ll get wrecked by every bullet, every mutant, every *thing* that’s not you. It’s brutal as hell… but *so* much more satisfying when you pull through. It’s not for the weak. If you’re struggling? Just switch to Normal mode for that one fight - no shame in that. This thing’s all about fun, not suffering. Maybe you’re a noob, but you’ve got this. Now go prove it. It is meant to be used in other collections of mods. Does not conflict with anything.`,
    "Rename the mod, and update icon",
  ),
  {
    stdio: "inherit",
    cwd: MODS_PATH,
    shell: "/usr/bin/bash",
    env: process.env,
  },
);
