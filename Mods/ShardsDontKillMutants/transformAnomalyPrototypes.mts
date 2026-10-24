import type { AnomalyPrototype } from "s2cfgtojson";

const DIRECT_DAMAGE_EFFECTS = new Set(["RazorAnomalyDamageDPSLow", "RazorAnomalyDamageDPSHigh"]);

/**
 * Shards (RazorAnomaly) deal speed-scaled direct damage that kills small mutants on contact.
 * Effects can't tell mutants from the player, so the direct-damage effects are dropped for every
 * target and the bleeding and gear corrosion stay. The list is re-emitted whole (no bpatch) so the
 * removed entries are gone.
 */
export function transformAnomalyPrototypes(struct: AnomalyPrototype) {
  if (struct.SID !== "RazorAnomaly") {
    return null;
  }
  const fork = struct.fork();
  const effects = struct.InteractionEffectPrototypeSIDs.clone();
  const kept = effects.entries().filter(([, sid]) => !DIRECT_DAMAGE_EFFECTS.has(sid));
  effects.entries().forEach(([key]) => delete effects[key]);
  kept.forEach(([, sid], i) => (effects[i] = sid));
  fork.InteractionEffectPrototypeSIDs = effects;
  return fork;
}

transformAnomalyPrototypes.files = ["/AnomalyPrototypes.cfg"];
