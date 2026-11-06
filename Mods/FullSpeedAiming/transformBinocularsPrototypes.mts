import type { BinocularsPrototype } from "s2cfgtojson";

/** Raises the binoculars' movement penalty while looking through them (< 1) to 1. */
export function transformBinocularsPrototypes(struct: BinocularsPrototype) {
  const value = struct.AimingMovementSpeedModifier;
  if (typeof value !== "number" || value >= 1) return null;
  const fork = struct.fork();
  fork.AimingMovementSpeedModifier = 1;
  return fork;
}

transformBinocularsPrototypes.files = ["ItemPrototypes/BinocularsPrototypes.cfg"];
