/**
 * Makes some consumables last longer.
 * @param entries
 * @param file
 */
export function transformEffectPrototypes(entries: { SID: string; Duration: number }, { file }: { file: string }) {
  if (!file.includes("EffectPrototypes.cfg")) {
    return entries;
  }
  if (!consumables.has(entries.SID)) {
    return null;
  }
  return { Duration: entries.Duration * 10 };
}
const consumables = new Set([
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
