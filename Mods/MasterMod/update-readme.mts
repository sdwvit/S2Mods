import path from "node:path";
import { modFolder } from "../../src/base-paths.mts";
import fs from "node:fs";
import { logger } from "../../src/logger.mts";

const readmePath = path.join(modFolder, "readme.md");

const modifiedFiles = new Set<string>();
const findModifiedFiles = (p: string, parent: string) => {
  if (p.includes("WorldMap_WP")) {
    return;
  }
  if (fs.lstatSync(p).isDirectory()) {
    for (const file of fs.readdirSync(p)) {
      findModifiedFiles(path.join(p, file), p);
    }
  } else {
    if (p.endsWith(".cfg")) {
      modifiedFiles.add(path.relative(path.resolve(p, "..", "..", ".."), parent));
    }
    if (p.endsWith(".uasset")) {
      modifiedFiles.add(`Modified assets/${path.basename(p).replace(".uasset", "")}`);
    }
  }
};
findModifiedFiles(path.join(modFolder, "raw"), modFolder);
const modifiedFilesByFolder = [...modifiedFiles].reduce(
  (acc, file) => {
    const [folder, name] = file.split("/");
    if (!acc[folder]) {
      acc[folder] = [];
    }
    acc[folder].push(name);
    return acc;
  },
  {} as Record<string, string[]>,
);

const readmeContent = `
# Code generator for my Stalker 2 mod config files

## Requirements:

- Node.js [24 or later](https://nodejs.org/en/download/current) (with \*.mts typescript loader support).
- The official [STALKER2ZoneKit](https://store.epicgames.com/en-US/p/stalker-2-zone-kit).
- [Optional] https://github.com/trumank/repak if you want to quickly test pre 1.6 mods
- [Optional] if you fork it and want to publish with own modifications https://developer.valvesoftware.com/wiki/SteamCMD

## Usage

1. Install the required tools.
2. Install the dependencies:
   \`\`\`bash
   npm install
   \`\`\`
3. Run the generator:
   \`\`\`bash
    npm run prepare
    \`\`\`

---
### Mod compatibility:

Here is a list of extended files (this mod uses new files, so it is compatible with other mods that don't modify the same SIDs):

${Object.entries(modifiedFilesByFolder)
  .map(([folder, files]) => `- \`${folder}\`:\n  ${files.map((file) => `- \`${file}\``).join("\n  ")}`)
  .join("\n")}

## License

Free for non-commercial use. For commercial use, please contact GSC - authors of this game - for a license.
Copying or modifying the code should keep the author mentioned in the comments (https://github.com/sdwvit).
`.trim();

logger.log("Updating readme.md...");
fs.writeFileSync(readmePath, readmeContent, "utf8");
