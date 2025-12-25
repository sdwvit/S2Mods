import { ObjPrototype, Struct } from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<Struct> = {
  description: `
      Water does not slow you down.
      [hr][/hr]
      This mod changes Player config to remove slowness effect in shallow water.[h1][/h1]
      It still can kill you tho if you go too deep.[h1][/h1]
      [hr][/hr]
      Uses bpatch on ObjPrototypes.cfg
  `,
  changenote: "Update to 1.7.x",
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
    fork.WaterContactInfo.SingleCurveEffects = struct.WaterContactInfo.SingleCurveEffects.fork(true).map(
      () => Object.assign(new Struct(), { EffectSID: "empty" }) as any,
    );
    fork.WaterContactInfo.DualCurveEffects = struct.WaterContactInfo.DualCurveEffects.fork(true).map(
      () => Object.assign(new Struct(), { EffectSID: "empty" }) as any,
    );
    return fork;
  }
}

transformObjPrototypes.files = ["/GameData/ObjPrototypes.cfg"];
