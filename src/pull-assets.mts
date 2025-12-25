import path from "node:path";
import { modFolder, modName, sdkModsFolder } from "./base-paths.mts";
import { logger } from "./logger.mts";
import fs from "node:fs";
import childProcess from "node:child_process";

export async function pullAssets() {
  const sourcePath = path.join(sdkModsFolder, modName, "Content");
  const destinationPath = path.join(modFolder, "raw", "Stalker2", "Content");
  logger.log(`Pulling asset files from ${sourcePath}...`);
  if (fs.readdirSync(sourcePath).length === 0) {
    console.error(`No files found in source path: ${sourcePath}`);
    process.exit(1);
  }

  childProcess.execSync(["mkdir", "-p", destinationPath, "&&", "cp", "-r", path.join(sourcePath, "*"), destinationPath].join(" "), {
    stdio: "inherit",
    cwd: modFolder,
    shell: "/usr/bin/bash",
  });
}
