import fs from "node:fs";
import path from "node:path";
import type { MetaType } from "../meta-type.mts";
import { modFolder } from "../base-paths.mts";

/** The mod's Nexus page from Mods/<Mod>/.nexusmods (written by publish-nexus), if it has one. */
export function nexusPageUrl(): string | undefined {
  const file = path.join(modFolder, ".nexusmods");
  if (!fs.existsSync(file)) return undefined;
  const { gameScopedId } = JSON.parse(fs.readFileSync(file, "utf8"));
  return gameScopedId ? `https://www.nexusmods.com/stalker2heartofchornobyl/mods/${gameScopedId}` : undefined;
}

export const DONATE =
  "[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.";

/**
 * The mod's description as published: meta.description, then `previousVersion` (plus a link to the
 * Nexus page that hosts it, outside Nexus), then the donation footer (not for other authors' mods or `noDonate`).
 */
export function publishedDescription(
  meta: Pick<MetaType, "description" | "originalAuthor" | "noDonate" | "previousVersion">,
  platform: "nexus" | "steam" | "modio",
) {
  const nexusUrl = nexusPageUrl();
  let description = meta.description.trim();
  if (meta.previousVersion) {
    description += "\n" + meta.previousVersion.trim();
    if (platform !== "nexus" && nexusUrl)
      description += `\nThe previous version is under Optional files on Nexus: [url=${nexusUrl}]${nexusUrl}[/url]`;
  }
  return meta.originalAuthor || meta.noDonate ? description : `${description}\n${DONATE}\n`;
}
