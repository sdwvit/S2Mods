import type { MetaType } from "../meta-type.mts";

export const DONATE =
  "[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.";

/** The mod's description as published: meta.description plus the donation footer (not for other authors' mods or `noDonate`). */
export function publishedDescription(meta: Pick<MetaType, "description" | "originalAuthor" | "noDonate">) {
  const description = meta.description.trim();
  return meta.originalAuthor || meta.noDonate ? description : `${description}\n${DONATE}\n`;
}
