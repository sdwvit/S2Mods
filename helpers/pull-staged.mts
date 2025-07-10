import path from "node:path";
import childProcess from "node:child_process";

const MODS_PATH = path.join(import.meta.dirname, "../Mods");
const SDK_PATH = "/media/nvme1/STALKER2ZoneKit";
const STAGED_PATH = path.join(SDK_PATH, "Stalker2", "SavedMods", "Staged");

const cmd = (name) => {
  const folderStructure = path.join("Stalker2", "Mods", name, "Content", "Paks", "Windows");
  const sourcePath = path.join(STAGED_PATH, name, "Windows", folderStructure);
  const destinationPath = path.join(MODS_PATH, name, "steamworkshop", folderStructure);

  return ["mkdir", "-p", destinationPath, "&&", "cp", path.join(sourcePath, "*"), destinationPath].join(" ");
};

childProcess.execSync(cmd("NoFallDamage"), {
  stdio: "inherit",
  cwd: MODS_PATH,
  shell: "/usr/bin/bash",
});
