import { EffectPrototype } from "s2cfgtojson";
import { EntriesTransformer } from "../../src/meta-type.mts";

/**
 * Makes some consumables last longer.
 * Also negates KillVolumeEffect (borderguard instakill)
 */
export const transformEffectPrototypes: EntriesTransformer<EffectPrototype> = async (struct) => {
  if (struct.SID === "WaterDeadlyDamage") {
    return Object.assign(struct.fork(), {
      Type: "EEffectType::None",
    });
  }
};
transformEffectPrototypes.files = ["/EffectPrototypes.cfg"];
