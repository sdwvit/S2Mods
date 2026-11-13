import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { writeArmorStatsLocalization } from "./writeLocalization.mts";

export const meta: MetaType<Struct> = {
  nameOverride: "Stats in Descriptions",
  description: `
Adds stats to item descriptions, so you can compare gear at a glance.
[h1][/h1]
Suits and helmets: protection values and durability.
[h1][/h1]
Firearms: damage, rate of fire, penetration, range and durability. Under damage, four more lines give it against 1, 2, 3 and 4 points of strike protection on a human, body shot. Damage is for standard rounds (FMJ or buckshot). Semi-auto rate of fire assumes fast clicking (6 shots a second) unless the gun cycles slower. Upgrades and attachments are not included.
[h1][/h1]
Ammo: how each round changes the gun, with standard rounds as ×1 for comparison: damage, damage against armor (which includes the round's penetration), weapon wear, flatness, spread and pellets per shot.
[h1][/h1]
Attachments: magazine size, scope zoom and what they change in handling, recoil, sound and ballistics.
[h1][/h1]
Grenades: blast-centre damage, against armor and to you.
[h1][/h1]
Detectors: detection range, the distance at which artifacts appear, and anomaly scan range.
[h1][/h1]
Protection, penetration and range use a 0-5 scale like the inventory bars.
[h1][/h1]
Handy for comparing broken gear before you pay to fix it.
`,
  changenote:
    "Ammo, detectors, attachments and grenades now show their stats too, firearms show damage against four levels of armor, and stats line up in a column.",
  structTransformers: [] as MetaType<Struct>["structTransformers"],
  onFinish: writeArmorStatsLocalization,
};
