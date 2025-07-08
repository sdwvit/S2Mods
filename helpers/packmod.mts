import path from "node:path";
import childProcess from "node:child_process";

const root = path.join(import.meta.dirname, "../Mods");
const stalkerModsPath =
  "'/home/sdwvit/MX500-900/games/SteamLibrary/steamapps/common/S.T.A.L.K.E.R. 2 Heart of Chornobyl/Stalker2/Content/Paks/~mods/'";
const cmd = (name) => {
  const fullName = path.join(root, name);
  const packName = `${fullName}.pak`;

  const folderStructure = path.join("Stalker2", "Mods", name, "Content", "Paks", "Windows");
  const destinationPath = path.join(root, name, "steamworkshop", folderStructure);
  return [
    `/home/sdwvit/.cargo/bin/repak pack`,
    path.join(fullName, "raw"),
    packName,
    `&& cp`,
    packName,
    stalkerModsPath,
    "&& mv -f",
    packName,
    path.join(destinationPath, `${name}Stalker2-Windows.pak`),
  ].join(" ");
};

childProcess.execSync(cmd("GlassCannon"), {
  stdio: "inherit",
  cwd: root,
  shell: "/usr/bin/bash",
});
