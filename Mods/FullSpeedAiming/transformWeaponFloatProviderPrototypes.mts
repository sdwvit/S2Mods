import type { Struct } from "s2cfgtojson";

/** The scope ADS movement penalty (-10, scaled by how far you are out of canted aim) becomes 0. */
export function transformWeaponFloatProviderPrototypes(struct: Struct & { SID?: string; Value?: number }) {
  if (struct.SID !== "ScopeAimingMovementNeg10ConstValue") return null;
  const fork = struct.fork() as typeof struct;
  fork.Value = 0;
  return fork;
}

transformWeaponFloatProviderPrototypes.files = ["FloatProviderPrototypes/WeaponFloatProviderPrototypes.cfg"];
