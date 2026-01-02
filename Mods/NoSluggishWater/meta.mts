import { ObjPrototype, Struct } from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType = {
  description: `
      Water does not slow you down.
      [hr][/hr]
      This mod changes Player config to remove slowness effect in shallow water.[h1][/h1]
      It still can kill you tho if you go too deep.[h1][/h1]
  `,
  changenote: "Update to 1.8.1",
  structTransformers: [transformObjPrototypes],
};

/**
 * Prevents NPCs from being knocked down.
 * Also removes Fall damage.
 * @param struct
 */
export function transformObjPrototypes(struct: ObjPrototype) {
  if (struct.SID === "Player") {
    const fork = struct.fork();
    fork.WaterContactInfo = struct.WaterContactInfo.fork();
    fork.WaterContactInfo.SingleCurveEffects = struct.WaterContactInfo.SingleCurveEffects.map(([_, e]) => {
      const fork = e.fork();
      fork.EffectSID = "empty";
      return fork;
    });
    fork.WaterContactInfo.SingleCurveEffects.__internal__.bpatch = true;
    fork.WaterContactInfo.DualCurveEffects = struct.WaterContactInfo.DualCurveEffects.map(([_, e]) => {
      const fork = e.fork();
      fork.EffectSID = "empty";
      return fork;
    });
    fork.WaterContactInfo.DualCurveEffects.__internal__.bpatch = true;
    return fork;
  }
}

transformObjPrototypes.files = ["/GameData/ObjPrototypes.cfg"];
