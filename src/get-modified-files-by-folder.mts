import fs from "node:fs";
import path from "node:path";
import { modFolder } from "./base-paths.mts";

export function getModifiedFilesByFolder() {
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

  return [...modifiedFiles].reduce(
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
}

export function getModifiedFilesString() {
  return Object.entries(getModifiedFilesByFolder())
    .map(([folder, files]) => `- \`${folder}\`:\n  ${files.map((file) => `- \`${file}\``).join("\n  ")}`)
    .join("\n");
}
