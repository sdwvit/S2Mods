/**
 * Extra loot cuts on top of MasterMod's general consumable reduction.
 * Each entry divides that item's drop chance (NPC bodies, item generators, stashes).
 * Traders are untouched.
 */
const scarcityDivisors: Record<string, number> = {
  AntiRad: 7,
  Bandage: 8,
  GrenadeRGD5: 10,
  GrenadeF1: 10,
  Energetic: 5,
  Energetic_Limited: 5,
};

export const scarcityDivisor = (sid: string | undefined) => (sid && scarcityDivisors[sid]) || 1;

export const scarceChance = (sid: string | undefined, chance: number) => {
  const divisor = scarcityDivisor(sid);
  return divisor === 1 ? chance : parseFloat((chance / divisor).toFixed(5));
};

/**
 * Stash item sets roll one MaxSpawnChance, then pick an item by Weight.
 * Scale the set chance by the weight-averaged cut so each listed item drops that much less.
 */
export const scarceSetFactor = (items: { ItemPrototypeSID?: string; Weight?: number }[]) => {
  const total = items.reduce((s, i) => s + (i.Weight || 0), 0);
  if (!total) return 1;
  return items.reduce((s, i) => s + (i.Weight || 0) / scarcityDivisor(i.ItemPrototypeSID), 0) / total;
};
