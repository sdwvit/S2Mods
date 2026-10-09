import { modName } from "./base-paths.mts";

/** The mod's raw/ on GitHub: lists every shipped asset with its path, where a name list would run to hundreds of lines. */
const rawUrl = `https://github.com/sdwvit/S2Mods/tree/master/Mods/${modName}/raw`;

const links: Record<"html" | "markdown" | "steam", (url: string, text: string) => string> = {
  markdown: (url, text) => `[${text}](${url})`,
  steam: (url, text) => `[url=${url}]${text}[/url]`,
  html: (url, text) => `<a href="${url}">${text}</a>`,
};

/** Readme and published descriptions link to the mod's raw/ on GitHub, which lists every patched cfg and asset. */
export function getModifiedFilesLink(as: "html" | "markdown" | "steam", text = "GitHub") {
  return links[as](rawUrl, text);
}
