import type { EffectPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

const interestingSIDs = new Set<string>([
  "EnergeticStamina",
  "EnergeticLimitedStamina",
  "EnergeticSleepiness",
  "BandageBleeding4",
  "MedkitBleeding2",
  "Antirad4",
  "AnomalyVodkaRadiation",
  "HerculesWeight",
  "CinnamonDegenBleeding",
  "BeerAntirad1",
  "VodkaAntirad3",
  "PSYBlockerIncreaseRegen",
  "ArmyMedkitBleeding3",
  "EcoMedkitAntirad3",
  "EcoMedkitBleeding2",
  "WaterStamina2",
  "MagicVodkaPSYProtection",
  "EnergeticStaminaPerAction1",
  "WaterStaminaPerAction1",
  "HerculesWeight_Penalty",
]);

function transformEffectPrototypes(struct: EffectPrototype) {
  if (!interestingSIDs.has(struct.SID)) {
    return null;
  }
  const fork = struct.fork();
  fork.Duration = struct.Duration * 10 + 1;
  return fork;
}

transformEffectPrototypes.files = ["/EffectPrototypes.cfg"];

export const meta: MetaType<EffectPrototype> = {
  structTransformers: [transformEffectPrototypes],
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
  [h3]Makes some consumables last longer, with the same value (antirad remove radiation slowly).[/h3]
    [list]
  [*] 🔋 Limited Edition Energy Drink: Stamina buff duration increased from 30 seconds to 300 seconds
  [*] 🔋 Energy Drink: Reduced Cost of Stamina Per Action duration increased from 30 seconds to 300 seconds
  [*] 🔋 Energy Drink: Stamina buff duration increased from 45 seconds to 450 seconds
  [*] 😴 Energy Drink: Sleepiness reduction duration increased from 3 seconds to 30 seconds
  [*] 🔋 Water: Stamina buff duration increased from 5 seconds to 50 seconds
  [*] 🔋 Water: Reduced Cost of Stamina Per Action duration increased from 30 seconds to 300 seconds
  [*] 🩸 Bandage: Bleeding control duration increased from 2 seconds to 20 seconds
  [*] 🩸 Barvinok: Bleeding control duration increased from 3 minutes to 30 minutes
  [*] 🩸 Medkit: Bleeding control duration increased from 2 seconds to 20 seconds
  [*] 🩸 Army Medkit: Bleeding control duration increased from 2 seconds to 20 seconds
  [*] 🩸 Scientist Medkit: Bleeding control duration increased from 2 seconds to 20 seconds
  [*] ☢️ Scientist Medkit: Radiation reduction duration increased from 2 seconds to 20 seconds
  [*] ☢️ Antirad: Radiation reduction duration increased from 2 seconds to 20 seconds
  [*] ☢️ Beer: Radiation reduction duration increased from 2 seconds to 20 seconds
  [*] ☢️ Vodka: Radiation reduction duration increased from 2 seconds to 20 seconds
  [*] ☢️ Dvupalov Vodka: Radiation reduction duration increased from 10 seconds to 100 seconds
  [*] 🧠 Dvupalov Vodka: PSY Protection duration increased from 90 seconds to 900 seconds
  [*] 🧠 PSY Block: PSY Protection duration increased from 1 minute to 10 minutes
  [*] 🏋️ Hercules: Weight buff duration increased from 5 minutes to 50 minutes
  [/list]
  bPatches EffectPrototypes.cfg
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Compatible with 1.8.x",
};
