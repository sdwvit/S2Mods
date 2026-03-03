import path from "node:path";
import { modFolder } from "./base-paths.mts";
import { getModifiedFiles } from "./get-modified-files.mts";
import { logger } from "./logger.mts";
import { writeFileSync } from "node:fs";

const readmePath = path.join(modFolder, "readme.md");
const maxRenderedFiles = 10;

function truncateModifiedFilesMarkdown(markdown: string, maxFilesPerCategory: number) {
  const lines = markdown.split("\n");
  const truncatedLines: string[] = [];
  let renderedFilesInCategory = 0;
  let didTruncateCategory = false;
  let currentCategory = "";

  for (const line of lines) {
    if (line.startsWith(" - ")) {
      if (currentCategory === "GameData") {
        truncatedLines.push(line);
        continue;
      }

      if (renderedFilesInCategory < maxFilesPerCategory) {
        truncatedLines.push(line);
        renderedFilesInCategory++;
        continue;
      }
      if (!didTruncateCategory) {
        truncatedLines.push(" - ...");
        didTruncateCategory = true;
      }
      continue;
    }

    // Non-list line means a new category header (or a separator/blank line).
    renderedFilesInCategory = 0;
    didTruncateCategory = false;
    currentCategory = line.match(/^`([^`]+)`:?$/)?.[1] ?? "";
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
