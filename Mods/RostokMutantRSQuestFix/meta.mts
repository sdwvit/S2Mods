import type { MetaType } from "../../src/meta-type.mts";
import type { QuestNodePrototype, QuestNodePrototypeRandom } from "s2cfgtojson";
import { getConditions } from "../../src/struct-utils.mts";

export const meta: MetaType<QuestNodePrototype> = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
    Rostok Mutant RS Quest Fix
    [hr][/hr]
    This mod fixes the bug with the Bar mutant quest auto finishes moment after you start it.
    [hr][/hr]
    bpatches RSQ08_C01_K_M.cfg

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
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
