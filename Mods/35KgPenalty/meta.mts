import { CoreVariable, ObjWeightParamsPrototype } from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType = {
  description: `
This mod was commissioned by a mod.io user. Reduces threshold for carry weight movement penalty by 35kg.
[hr][/hr]
Maximum immersion[h1][/h1]
`,
  changenote: "Initial release",
  structTransformers: [structTransformer, coreVarsTransformer],
};

const PENALTY = 35.0; // kg

function structTransformer(struct: ObjWeightParamsPrototype) {
  if (struct.SID !== "DefaultWeightParams") {
    return;
  }

  const fork = struct.fork();
  fork.InventoryPenaltyLessWeight = (struct.InventoryPenaltyLessWeight * 100 - PENALTY * 100) / 100;
  fork.MaxInventoryMass = struct.MaxInventoryMass - PENALTY;
  fork.WeightEffectParams = struct.WeightEffectParams.map(([_, e]) => {
    const fork = e.fork();
    fork.Threshold = e.Threshold - PENALTY;
    return fork;
  });
  return fork;
}

structTransformer.files = ["/ObjWeightParamsPrototypes.cfg"];

function coreVarsTransformer(struct: CoreVariable) {
  if (struct.__internal__.rawName !== "DefaultConfig") {
    return;
  }
  const fork = struct.fork();
  fork.InventoryPenaltyLessWeight = struct.InventoryPenaltyLessWeight - PENALTY;
  fork.MediumEffectStartUI = struct.MediumEffectStartUI - PENALTY;
  fork.CriticalEffectStartUI = struct.CriticalEffectStartUI - PENALTY;
  return fork;
}

coreVarsTransformer.files = [];
