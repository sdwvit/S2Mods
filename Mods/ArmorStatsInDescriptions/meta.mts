import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { writeArmorStatsLocalization } from "./writeLocalization.mts";

export const meta: MetaType<Struct> = {
  nameOverride: "Stats in Descriptions",
  description: `
Adds protection values and durability to the descriptions of every suit and helmet, and damage, rate of fire, penetration, range and durability to every firearm. Semi-auto rate of fire assumes fast clicking (6 shots a second) unless the gun cycles slower. Protection, penetration and range use a 0-5 scale like the inventory bars. Damage is for standard rounds (FMJ or buckshot). Under damage, four more lines give it against 1, 2, 3 and 4 points of strike protection on a human, body shot. Ammo descriptions show how each round changes the gun, with standard rounds as ×1 for comparison: damage, damage against armor (which includes the round's penetration), weapon wear, flatness, spread and pellets per shot. Detector descriptions show detection range, the distance at which artifacts appear, and anomaly scan range. Attachment descriptions show magazine size, scope zoom and what they change in handling, recoil, sound and ballistics. Grenade descriptions show blast-centre damage, against armor and to you. Weapon stats do not include upgrades or attachments.

Handy for comparing broken gear before you pay to fix it.
`,
  changenote:
    "Ammo, detectors, attachments and grenades now show their stats too, firearms show damage against four levels of armor, and stats line up in a column.",
  structTransformers: [] as MetaType<Struct>["structTransformers"],
  onFinish: writeArmorStatsLocalization,
};
