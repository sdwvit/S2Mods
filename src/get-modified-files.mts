import fs from "node:fs";
import path from "node:path";
import { modFolder } from "./base-paths.mts";

function getModifiedFilesInternal() {
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
        modifiedFiles.add(`Modified or added assets/${path.basename(p).replace(".uasset", "")}`);
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

const mappers: Record<string, { li: (s: string) => string; ul: (s: string[]) => string }> = {
  markdown: { li: (s: string) => ` - ${s}`, ul: (s: string[]) => `${s.join("\n")}\n` },
  steam: { li: (s: string) => ` [*] ${s}\n`, ul: (s: string[]) => `[list]${s.join("\n")}[/list]` },
  html: { li: (s: string) => `<li>${s}</li>`, ul: (s: string[]) => `<ul>${s.join("\n")}</ul>` },
};

export function getModifiedFiles(as: "html" | "markdown" | "steam") {
  const { li, ul } = mappers[as];
  const code = (s: string) => `\`${s}\``;
  return ul(
    Object.entries(getModifiedFilesInternal()).map(([folder, files]) => {
      const filesMapped = files.map((file) => li(code(file)));
      return `${code(folder)}:\n${ul(filesMapped)}`;
    }),
  );
}
