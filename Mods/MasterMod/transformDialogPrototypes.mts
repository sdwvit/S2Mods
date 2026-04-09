import { Struct } from "s2cfgtojson";
import type { DialogPrototype } from "s2cfgtojson";

import type { StructTransformer } from "../../src/meta-type.mts";
import { deepMerge } from "../../src/deep-merge.mts";
const MALACHITE_BRIBE = 50000;

export const transformDialogPrototypes: StructTransformer<DialogPrototype> = async (struct, context) => {
  if (struct.SID === "Malahit_Hub_DialogueOnEntrance_Bribe_62758") {
    return adjustMalahitBribe(struct);
  }
  if (struct.SID === "Malahit_Hub_DialogueOnEntrance_WaitForReply") {
    return adjustMalahitBribeDialogValue(struct);
  }
};
transformDialogPrototypes.files = [
  "/DialogPrototypes/Malahit_Hub_DialogueOnEntrance.cfg",
];

function adjustMalahitBribe(struct: DialogPrototype) {
  const fork = struct.fork();

  return deepMerge(fork, {
    DialogActions: new Struct({
      "0": new Struct({ DialogActionParam: new Struct({ VariableValue: MALACHITE_BRIBE }) }),
    }),
    DialogAnswerActions: new Struct({
      "0": new Struct({ DialogActionParam: new Struct({ VariableValue: MALACHITE_BRIBE }) }),
    }),
    TopicAvailabilityConditions: new Struct({
      "0": new Struct({ "0": new Struct({ Money: new Struct({ VariableValue: MALACHITE_BRIBE }) }) }),
    }),
  }).fork(true);
}

function adjustMalahitBribeDialogValue(struct: DialogPrototype) {
  const fork = struct.fork();
  return deepMerge(fork, {
    NextDialogOptions: new Struct({
      "2": new Struct({
        Conditions: new Struct({
          0: new Struct({ 0: new Struct({ Money: new Struct({ VariableValue: MALACHITE_BRIBE }) }) }),
        }),
      }),
    }),
  }).fork(true);
}
