import type { EffectPrototype } from "s2cfgtojson";

/**
 * Attachment effects that lower ADS movement speed (AimingMovementNeg*, ScopeAimingMovementNeg*)
 * become 0%. The Scope* ones also read a value provider, zeroed in transformWeaponFloatProviderPrototypes.
 */
export function transformEffectPrototypes(struct: EffectPrototype) {
  if (!/^(Scope)?AimingMovementNeg\d+Effect$/.test(String(struct.SID))) return null;
  const fork = struct.fork();
  fork.ValueMin = "0%" as unknown as number;
  fork.ValueMax = "0%" as unknown as number;
  return fork;
}

transformEffectPrototypes.files = ["GameData/EffectPrototypes.cfg"];
