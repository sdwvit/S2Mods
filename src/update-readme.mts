import path from "node:path";
import { modFolder } from "./base-paths.mts";
import { getModifiedFiles } from "./get-modified-files.mts";
import { logger } from "./logger.mts";
import { writeFileSync } from "node:fs";

const readmePath = path.join(modFolder, "readme.md");
const maxRenderedFiles = 10;

function truncateModifiedFilesMarkdown(markdown: string, maxFiles: number) {
  const lines = markdown.split("\n");
  const truncatedLines: string[] = [];
  let renderedFiles = 0;
  let didTruncate = false;

  for (const line of lines) {
    if (line.startsWith(" - ")) {
      if (renderedFiles < maxFiles) {
        truncatedLines.push(line);
        renderedFiles++;
        continue;
      }
      if (!didTruncate) {
        truncatedLines.push(" - ...");
        didTruncate = true;
      }
      continue;
    }

    if (didTruncate) {
      continue;
    }

    truncatedLines.push(line);
  }

  return truncatedLines.join("\n");
}

const modifiedFilesMarkdown = truncateModifiedFilesMarkdown(getModifiedFiles("markdown"), maxRenderedFiles);

const readmeContent = `
### Mod compatibility:

Here is a list of extended files (this mod bPatches files, so it is compatible with other mods that don't modify the same lines):

${modifiedFilesMarkdown}`.trim();

logger.log("Updating readme.md...");
writeFileSync(readmePath, readmeContent, "utf8");
