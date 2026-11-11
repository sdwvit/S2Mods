import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { writeArmorStatsLocalization } from "./writeLocalization.mts";

export const meta: MetaType<Struct> = {
  nameOverride: "Armor Stats in Description",
  description: `
Armor and helmet descriptions list their protection numbers.[h1][/h1]
[hr][/hr]
[list]
[*] Every suit and helmet you can pick up, base game and DLC editions, gets its physical, thermal, electrical, chemical, radiation and psi protection appended to its description as plain numbers.
[*] Labels are the game's own tooltip wording and descriptions are the game's own text, in all 18 languages.
[*] Values are the suit's base stats, before upgrades, with a decimal point in every language.
[*] Text only, no item data is changed. Mods that change armor stats will not be reflected.
[/list]
`,
  changenote: "Initial release.",
  structTransformers: [] as MetaType<Struct>["structTransformers"],
  onFinish: writeArmorStatsLocalization,
};
