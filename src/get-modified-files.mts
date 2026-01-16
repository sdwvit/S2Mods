import { lstatSync, readdirSync } from "node:fs";
import path from "node:path";
import { modFolder } from "./base-paths.mts";

function getModifiedFilesInternal() {
  const modifiedFiles = new Set<string>();
  const findModifiedFiles = (p: string, parent: string) => {
    if (p.includes("WorldMap_WP")) {
      modifiedFiles.add("SpawnActorPrototypes/");
      return;
    }
    if (p.includes("/QuestNodePrototypes/")) {
      modifiedFiles.add("QuestNodePrototypes/");
      return;
    }
    if (lstatSync(p).isDirectory()) {
      for (const file of readdirSync(p)) {
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
      if (name) {
        acc[folder].push(name);
      }
      return acc;
    },
    {} as Record<string, string[]>,
  );
}

const mappers: Record<string, { code: (s: string) => string; li: (s: string) => string; ul: (s: string[]) => string }> = {
  markdown: { code: (s) => `\`${s}\``, li: (s) => ` - ${s}`, ul: (s) => `${s.join("\n")}\n` },
  steam: { code: (s) => s, li: (s) => ` [*] ${s}\n`, ul: (s) => `[list]${s.join("\n")}[/list]` },
  nexus: { code: (s) => s, li: (s) => ` [*] ${s}\n`, ul: (s) => `[list]${s.join("\n")}[/list]` },
  html: { code: (s) => s, li: (s) => `<li>${s}</li>`, ul: (s) => `<ul>${s.join("\n")}</ul>` },
};

export function getModifiedFiles(as: "html" | "markdown" | "steam" | "nexus") {
  const { li, ul, code } = mappers[as];
  return ul(
    Object.entries(getModifiedFilesInternal()).map(([folder, files]) => {
      const filesMapped = files.map((file) => li(code(file)));
      return `${code(folder)}${filesMapped.length ? `:\n${ul(filesMapped)}` : "\n"}`;
    }),
  );
}
