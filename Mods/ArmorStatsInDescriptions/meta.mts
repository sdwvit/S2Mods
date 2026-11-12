import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { writeArmorStatsLocalization } from "./writeLocalization.mts";

export const meta: MetaType<Struct> = {
  nameOverride: "Armor Stats in Description",
  description: `
Adds protection values to the descriptions of every suit and helmet. Upgrades are not reflected.

Handy for comparing broken armor before you pay to fix it.
`,
  changenote: "Initial release.",
  structTransformers: [] as MetaType<Struct>["structTransformers"],
  onFinish: writeArmorStatsLocalization,
};
