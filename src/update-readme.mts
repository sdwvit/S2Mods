import path from "node:path";
import { modFolder } from "./base-paths.mts";
import { getModifiedFilesLink } from "./get-modified-files.mts";
import { logger } from "./logger.mts";
import { writeFileSync } from "node:fs";

const readmePath = path.join(modFolder, "readme.md");

const readmeContent = `
### Mod compatibility:

Here is a list of extended files (this mod bPatches files, so it is compatible with other mods that don't modify the same lines):

\`Modified or added assets\`: ${getModifiedFilesLink("markdown", "see the mod's raw/ folder on GitHub")}`.trim();

logger.log("Updating readme.md...");
writeFileSync(readmePath, readmeContent, "utf8");
