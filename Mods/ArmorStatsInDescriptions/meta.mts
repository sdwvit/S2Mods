import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { writeArmorStatsLocalization } from "./writeLocalization.mts";

export const meta: MetaType<Struct> = {
  nameOverride: "Armor and Weapon Stats in Description",
  description: `
Adds protection values and durability to the descriptions of every suit and helmet, and damage, penetration, range and durability to every firearm, plus damage per second and rate of fire where the gun's cycle sets them. Protection, penetration and range use a 0-5 scale like the inventory bars. Damage is for standard rounds (FMJ or buckshot). Upgrades and attachments are not reflected.

Handy for comparing broken gear before you pay to fix it.
`,
  changenote:
    "Weapons now list their stats too, protection uses a 0-5 scale, and durability is shown.",
  structTransformers: [] as MetaType<Struct>["structTransformers"],
  onFinish: writeArmorStatsLocalization,
};
