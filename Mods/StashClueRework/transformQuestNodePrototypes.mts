import { QuestNodePrototype, QuestNodePrototypeItemAdd, QuestNodePrototypeSetItemGenerator } from "s2cfgtojson";
import { MetaContext } from "../../src/meta-type.mts";
import { hookRewardStashClue, hookStashSpawners, injectMassiveRNGQuestNodes } from "./injectMassiveRNGQuestNodes.mts";
import { finishedTransformers } from "./meta.mts";

let oncePerTransformer = false;

export const MalachiteMutantQuestPartsQuestsDoneNode = "BodyParts_Malahit_SetDialog_EQ197_QD_Orders";
export const MalachiteMutantQuestPartsQuestsDoneDialogs = [
  "EQ197_QD_Orders_Done_73061",
  "EQ197_QD_Orders_Done2_73167",
  "EQ197_QD_Orders_Done3_73169",
  "EQ197_QD_Orders_Done_73061_1",
  "EQ197_QD_Orders_Done2_73167_1",
  "EQ197_QD_Orders_Done3_73169_1",
  "EQ197_QD_Orders_Done_73061_2",
  "EQ197_QD_Orders_Done2_73167_2",
  "EQ197_QD_Orders_Done3_73169_2",
  "EQ197_QD_Orders_Done_73061_3",
  "EQ197_QD_Orders_Done2_73167_3",
  "EQ197_QD_Orders_Done3_73169_3",
  "EQ197_QD_Orders_Done_73061_4",
  "EQ197_QD_Orders_Done2_73167_4",
];
let oncePerBodyParts_Malahit = false;
/**
 * Removes timeout for repeating quests.
 */
export async function transformQuestNodePrototypes(
  struct: QuestNodePrototypeItemAdd | QuestNodePrototypeSetItemGenerator,
  context: MetaContext<QuestNodePrototype>,
) {
  let promises: Promise<QuestNodePrototype[] | QuestNodePrototype>[] = [];
  // applies to all quest nodes that add items (i.e., stash clues)
  if (struct.NodeType === "EQuestNodeType::ItemAdd") {
    promises.push(hookStashSpawners(struct, finishedTransformers));
  }

  if (!oncePerTransformer) {
    oncePerTransformer = true;
    promises.push(injectMassiveRNGQuestNodes(finishedTransformers));
  }

  // applies only to recurring quests
  if (recurringQuestsFilenames.some((p) => context.filePath.includes(p))) {
    if (struct.NodeType === "EQuestNodeType::SetItemGenerator") {
      if (struct.ItemGeneratorSID.includes("reward_var")) {
        promises.push(Promise.resolve(hookRewardStashClue(struct)));
      }
    }
  }

  if (!oncePerBodyParts_Malahit && context.filePath.endsWith("/BodyParts_Malahit.cfg")) {
    oncePerBodyParts_Malahit = true;

    promises.push(
      Promise.resolve(
        MalachiteMutantQuestPartsQuestsDoneDialogs.map((dialog) =>
          hookRewardStashClue(context.structsById[MalachiteMutantQuestPartsQuestsDoneNode] as QuestNodePrototypeSetItemGenerator, dialog),
        ),
      ),
    );
  }

  return Promise.all(promises).then((results) => results.flat());
}

export const recurringQuestsFilenames = ["BodyParts_Malahit", "RSQ01", "RSQ04", "RSQ05", "RSQ06", "RSQ07", "RSQ08", "RSQ09", "RSQ10"];

transformQuestNodePrototypes.files = ["/QuestNodePrototypes/"];
transformQuestNodePrototypes.contents = ["EQuestNodeType::ItemAdd", "EQuestNodeType::SetItemGenerator", "BodyParts_Malahit_Start"];
transformQuestNodePrototypes.contains = true;
