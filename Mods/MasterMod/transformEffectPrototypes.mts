import { EffectPrototype } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";

/**
 * Makes some consumables last longer.
 * Also negates KillVolumeEffect (borderguard instakill)
 */
export const transformEffectPrototypes: StructTransformer<EffectPrototype> = async (struct) => {
  if (struct.SID === "WaterDeadlyDamage") {
    return Object.assign(struct.fork(), {
      Type: "EEffectType::None",
    });
  }
};
transformEffectPrototypes.files = ["/EffectPrototypes.cfg"];
