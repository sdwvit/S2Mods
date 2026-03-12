import path from "node:path";

import * as fs from "node:fs";
import { logger } from "./logger.mts";
import { modFolderRaw, sdkModFolder } from "./base-paths.mts";
import { cpSync } from "node:fs";
import { withSdkMutationLock } from "./sdk-mutation-lock.mts";

async function pullAssets() {
  await withSdkMutationLock("pull-assets", async () => {
    const sourcePath = path.join(await sdkModFolder);
    const destinationPath = path.join(modFolderRaw, "Stalker2");
    logger.log(`Pulling mod assets from ${sourcePath}...`);
    if (fs.readdirSync(sourcePath).length === 0) {
      console.error(`No files found in source path: ${sourcePath}`);
      return;
    }

    cpSync(sourcePath, destinationPath, { recursive: true, force: true });
  });
}

await pullAssets();
