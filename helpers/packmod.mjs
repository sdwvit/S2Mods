import path from "node:path";
import childProcess from "node:child_process";

const root = path.join(import.meta.dirname, "..");
const stalkerModsPath =
  "'/home/sdwvit/MX500-900/games/SteamLibrary/steamapps/common/S.T.A.L.K.E.R. 2 Heart of Chornobyl/Stalker2/Content/Paks/~mods/'";
const cmd = (
  name,
  fullName = path.join(root, name),
  packName = `${fullName}.pak`,
) =>
  [
    `/home/sdwvit/.cargo/bin/repak pack`,
    fullName,
    packName,
    `&& mv`,
    packName,
    stalkerModsPath,
  ].join(" ");

childProcess.execSync(cmd("GlassCannon"), {
  stdio: "inherit",
  cwd: root,
  shell: "/usr/bin/bash",
});
