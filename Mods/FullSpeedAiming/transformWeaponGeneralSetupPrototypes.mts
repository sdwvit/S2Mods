import type { WeaponGeneralSetupPrototype } from "s2cfgtojson";

/**
 * Raises every per-weapon ADS movement penalty (AimingMovementSpeedModifier < 1) to 1.
 * Values above 1 (pistols, some SMGs) are kept.
 */
export function transformWeaponGeneralSetupPrototypes(struct: WeaponGeneralSetupPrototype) {
  const value = struct.AimingMovementSpeedModifier;
  if (typeof value !== "number" || value >= 1) return null;
  const fork = struct.fork();
  fork.AimingMovementSpeedModifier = 1;
  return fork;
}

transformWeaponGeneralSetupPrototypes.files = ["WeaponData/WeaponGeneralSetupPrototypes.cfg"];
