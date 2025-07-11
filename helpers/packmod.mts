import path from "node:path";
import childProcess from "node:child_process";
import * as fs from "node:fs";

const root = path.join(import.meta.dirname, "../Mods");
const stalkerModsPath =
  "'/home/sdwvit/MX500-900/games/SteamLibrary/steamapps/common/S.T.A.L.K.E.R. 2 Heart of Chornobyl/Stalker2/Content/Paks/~mods/'";
const cmd = (name) => {
  const modRoot = path.join(root, name);
  const packName = `${name}.pak`;

  const folderStructure = path.join("Stalker2", "Mods", name, "Content", "Paks", "Windows");
  const destinationPath = path.join(root, name, "steamworkshop", folderStructure);
  const rawPath = path.join(modRoot, "raw");
  const destinationFullPath = path.join(destinationPath, `${name}Stalker2-Windows.pak`);
  if (!fs.existsSync(destinationPath)) {
    fs.mkdirSync(destinationPath, { recursive: true });
  }
  return [
    `/home/sdwvit/.cargo/bin/repak pack`,
    rawPath,
    packName,
    `&& cp`,
    packName,
    stalkerModsPath,
    "&& mv -f",
    packName,
    destinationFullPath,
  ].join(" ");
};

childProcess.execSync(cmd("IncreaseNumberOfQuests"), {
  stdio: "inherit",
  cwd: root,
  shell: "/usr/bin/bash",
});
