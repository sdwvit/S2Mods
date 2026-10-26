import type { MetaType } from "../../src/meta-type.mts";
import { makeTransformCoreVariables } from "./transformCoreVariables.mts";

export const meta: MetaType = {
  description: `
Shay's Distant Horizons - 250m
[hr][/hr]
This is an approved release of Shay's Distant Horizons mod (Release 21), updated for 2.0.[h1][/h1]
It turns on the game's dynamic A-Life streaming range on every platform and raises its maximum to 250m, so NPCs and mutants come online and stay simulated further from the player. Vanilla PC stops at 200m.
[list]
[*] 250m, 300m and 350m presets are released as separate mods, install only one. 350m is Shay's own preset.
[*] The range grows and shrinks with available memory and the online NPC budget, so it backs off on its own when the system is under load.
[*] Binoculars magnify and identify further to match the larger range.
[*] Anomaly VFX stay visible up to the streaming distance.
[*] Raises the UObject limit for the extra NPCs (applies after a game restart).
[/list]
More info here: [url=https://www.nexusmods.com/stalker2heartofchornobyl/mods/1879?tab=description]nexus[/url]

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  nameOverride: "Distant Horizons 2.1 - 250m",
  originalAuthor: "Shay",
  changenote: "Updated to Shay's Release 21 for 2.0, now a 250m dynamic A-Life streaming range preset.",
  structTransformers: [makeTransformCoreVariables(250)],
};
