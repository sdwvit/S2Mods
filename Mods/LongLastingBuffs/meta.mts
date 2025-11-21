import { EffectPrototype } from "s2cfgtojson";
import { MetaType } from "../../src/metaType.mjs";

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
  if (interestingSIDs.has(struct.SID)) {
    const fork = struct.fork();
    return Object.assign(fork, {
      Duration: struct.Duration * 10,
    });
  }
  return null;
}

transformEffectPrototypes.files = ["/EffectPrototypes.cfg"];
transformEffectPrototypes._name = "transformEffectPrototypes";

export const meta: MetaType<EffectPrototype> = {
  structTransformers: [transformEffectPrototypes],
  description: `
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
  bPatches EffectPrototypes.cfg`,
  changenote: "Compatible with 1.7",
};
