import { lstatSync, readdirSync } from "node:fs";
import path from "node:path";
import { modFolder, modName } from "./base-paths.mts";

const ASSETS_FOLDER = "Modified or added assets";
/** The mod's raw/ on GitHub: lists every shipped asset with its path, where a name list would run to hundreds of lines. */
const rawUrl = `https://github.com/sdwvit/S2Mods/tree/master/Mods/${modName}/raw`;

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
        modifiedFiles.add(ASSETS_FOLDER);
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

const mappers: Record<
  string,
  { code: (s: string) => string; li: (s: string) => string; ul: (s: string[]) => string; link: (url: string, text: string) => string }
> = {
  markdown: { code: (s) => `\`${s}\``, li: (s) => ` - ${s}`, ul: (s) => `${s.join("\n")}\n`, link: (url, text) => `[${text}](${url})` },
  steam: { code: (s) => s, li: (s) => ` [*] ${s}\n`, ul: (s) => `[list]${s.join("\n")}[/list]`, link: (url, text) => `[url=${url}]${text}[/url]` },
  html: { code: (s) => s, li: (s) => `<li>${s}</li>`, ul: (s) => `<ul>${s.join("\n")}</ul>`, link: (url, text) => `<a href="${url}">${text}</a>` },
};

/** Published descriptions link to the mod's raw/ on GitHub, which lists every patched cfg and asset. */
export function getModifiedFilesLink(as: "html" | "steam") {
  return mappers[as].link(rawUrl, "GitHub");
}

export function getModifiedFiles(as: "html" | "markdown" | "steam") {
  const { li, ul, code, link } = mappers[as];
  return ul(
    Object.entries(getModifiedFilesInternal()).map(([folder, files]) => {
      if (folder === ASSETS_FOLDER) {
        return `${code(folder)}: ${link(rawUrl, "see the mod's raw/ folder on GitHub")}\n`;
      }
      const filesMapped = files.map((file) => li(code(file)));
      return `${code(folder)}${filesMapped.length ? `:\n${ul(filesMapped)}` : "\n"}`;
    }),
  );
}
