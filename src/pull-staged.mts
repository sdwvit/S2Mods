import path from "node:path";
import childProcess from "node:child_process";

import * as fs from "node:fs";
import { logger } from "./logger.mjs";
import { modFolder, sdkStagedPakFolder, stagedFolderStruct } from "./base-paths.mjs";

const copyPaks = async () => {
  const folderStructure = await stagedFolderStruct;
  const sourcePath = await sdkStagedPakFolder;
  const destinationPath = path.join(modFolder, "steamworkshop", folderStructure);
  logger.log(`Pulling staged mod from ${sourcePath}...`);
  if (fs.readdirSync(sourcePath).length === 0) {
    console.error(`No files found in source path: ${sourcePath}`);
    return;
  }

  childProcess.execSync(["mkdir", "-p", destinationPath, "&&", "cp", path.join(sourcePath, "*"), destinationPath].join(" "), {
    stdio: "inherit",
    cwd: modFolder,
    shell: "/usr/bin/bash",
  });
};

await copyPaks();
