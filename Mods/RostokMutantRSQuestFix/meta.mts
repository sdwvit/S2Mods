import { MetaType } from "../../src/meta-type.mts";
import { QuestNodePrototype, QuestNodePrototypeRandom } from "s2cfgtojson";
import { getConditions } from "../../src/struct-utils.mts";

export const meta: MetaType<QuestNodePrototype> = {
  description: `
    Rostok Mutant RS Quest Fix
    [hr][/hr]
    This mod fixes the bug with the Bar mutant quest auto finishes moment after you start it.
    [hr][/hr]
    bpatches RSQ08_C01_K_M.cfg
`,
  changenote: "Initial release",
  structTransformers: [structTransformer],
};

function structTransformer(struct: QuestNodePrototypeRandom) {
  if (struct.SID === "RSQ08_C01_K_M_Random_3") {
    return Object.assign(struct.fork(), { PinWeights: Object.assign(struct.PinWeights.fork(), { 0: 0.5 }) });
  }
  if (struct.SID === "RSQ08_C01_K_M_Technical_STL4939_Pin_0") {
    const newConditions = Object.assign(struct.fork(), {
      Conditions: getConditions([
        {
          ConditionType: "EQuestConditionType::NodeState",
          ConditionComparance: "EConditionComparance::Equal",
          TargetNode: "RSQ08_C01_K_M_SetDialog_RSQ08_Dialog_Barmen_C01_Finish",
          NodeState: "EQuestNodeState::Finished",
        },
      ]),
    });
    newConditions.Conditions.__internal__.bpatch = false;
    return newConditions;
  }

  return null;
}

structTransformer.files = ["/RSQ08_C01_K_M.cfg"];
