import path from "node:path";
import { modFolder } from "./base-paths.mts";
import { getModifiedFiles } from "./get-modified-files.mts";
import { logger } from "./logger.mts";
import fs from "node:fs";

const readmePath = path.join(modFolder, "readme.md");

const readmeContent = `
### Mod compatibility:

Here is a list of extended files (this mod bPatches files, so it is compatible with other mods that don't modify the same lines):

${getModifiedFiles("markdown")}`.trim();

logger.log("Updating readme.md...");
fs.writeFileSync(readmePath, readmeContent, "utf8");
