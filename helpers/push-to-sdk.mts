import path from "node:path";
import childProcess from "node:child_process";

import dotEnv from "dotenv";
import * as fs from "node:fs";

dotEnv.config();
const MODS_PATH = path.join(import.meta.dirname, "../Mods");
const SDK_PATH = "/media/nvme2/STALKER2ZoneKit";
const SDK_MODS_PATH = path.join(SDK_PATH, "Stalker2", "Mods");

const cmd = (name: string) => {
  const destinationPath = path.join(SDK_MODS_PATH, name, "Content");
  const sourcePath = path.join(MODS_PATH, name, "raw", "Stalker2", "Content");
  console.log(`Pushing raw mod from ${sourcePath} to ${destinationPath}...`);
  if (fs.readdirSync(sourcePath).length === 0) {
    console.error(`No files found in source path: ${sourcePath}`);
    process.exit(1);
  }
  return ["mkdir", "-p", destinationPath, "&&", "cp", "-r", path.join(sourcePath, "*"), destinationPath].join(" ");
};

childProcess.execSync(cmd(process.env.MOD_NAME), {
  stdio: "inherit",
  cwd: MODS_PATH,
  shell: "/usr/bin/bash",
});
