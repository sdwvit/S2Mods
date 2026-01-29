import { QuestNodePrototype, QuestNodePrototypeConsoleCommand, QuestNodePrototypeItemAdd, Struct } from "s2cfgtojson";
import { MetaContext } from "../../src/meta-type.mts";
import { finishedTransformers } from "./meta.mts";
import { getStashSpawnerSID, injectMassiveRNGQuestNodes, RandomStashQuestNodePrefix } from "./injectMassiveRNGQuestNodes.mts";
import { getLaunchers } from "../../src/struct-utils.mts";
import { transformSpawnActorPrototypes } from "./transformSpawnActorPrototypes.mts";
import { waitFor } from "../../src/wait-for.mts";
import { allStashes } from "./stashes.mts";
import { MalachiteMutantQuestPartsQuestsDoneDialogs, MalachiteMutantQuestPartsQuestsDoneNode } from "../../src/consts.mts";

export const recurringQuestsFilenames = ["BodyParts_Malahit", "RSQ01", "RSQ04", "RSQ05", "RSQ06", "RSQ07", "RSQ08", "RSQ09", "RSQ10"];

let oncePerTransformer = false;
let oncePerBodyParts_Malahit = false;
/**
 * Removes timeout for repeating quests.
 */
export async function transformQuestNodePrototypes(struct: QuestNodePrototype, context: MetaContext<QuestNodePrototype>) {
  let promises: Promise<QuestNodePrototype[] | QuestNodePrototype>[] = [];
  const fork = struct.fork();
  // applies to all quest nodes that add items (i.e., stash clues)
  if (struct.NodeType === "EQuestNodeType::ItemAdd") {
    promises.push(hookStashSpawners(struct as QuestNodePrototypeItemAdd, fork as QuestNodePrototypeConsoleCommand, finishedTransformers));
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
          hookRewardStashClue({ SID: MalachiteMutantQuestPartsQuestsDoneNode, QuestSID: struct.QuestSID }, dialog),
        ),
      ),
    );
  }

  const res = await Promise.all(promises).then((results) => results.flat());
  if ((fork as Struct).entries().length) {
    res.push(fork);
  }

  return res;
}

transformQuestNodePrototypes.files = ["/QuestNodePrototypes/"];
transformQuestNodePrototypes.contents = ["EQuestNodeType::ItemAdd", "EQuestNodeType::SetItemGenerator", "BodyParts_Malahit_Start"];
transformQuestNodePrototypes.contains = true;

/**
 * ConsoleCommand start a quest node for giving a clue.
 */
export function hookRewardStashClue(struct: { SID: string; QuestSID: string }, Name = "") {
  const sid = `${struct.SID}_${Name ? Name + "_" : ""}Give_Cache`;
  const stashClueReward = new Struct(`
      ${sid} : struct.begin
         SID = ${sid}
         QuestSID = ${struct.QuestSID}
         NodeType = EQuestNodeType::ConsoleCommand
         ConsoleCommand = XStartQuestNodeBySID ${RandomStashQuestNodePrefix}_Random
      struct.end
    `) as QuestNodePrototypeConsoleCommand;

  stashClueReward.Launchers = getLaunchers([{ SID: struct.SID, Name }]);
  return stashClueReward;
}

export async function hookStashSpawners(
  struct: QuestNodePrototypeItemAdd,
  fork: QuestNodePrototypeConsoleCommand,
  finishedTransformers: Set<string>,
) {
  await waitFor(() => finishedTransformers.has(transformSpawnActorPrototypes.name), 180000);

  // only quest stashes that are hidden by this mod are interesting here
  if (!allStashes[struct.TargetQuestGuid]) {
    return;
  }

  const spawnStash = struct.fork() as QuestNodePrototype as QuestNodePrototypeConsoleCommand;
  spawnStash.SID = `${struct.QuestSID}_Spawn_${struct.TargetQuestGuid}`;
  spawnStash.NodeType = "EQuestNodeType::ConsoleCommand";
  spawnStash.QuestSID = struct.QuestSID;
  spawnStash.ConsoleCommand = `XStartQuestNodeBySID ${getStashSpawnerSID(struct.TargetQuestGuid)}`;
  spawnStash.Launchers = struct.Launchers;
  fork.Launchers ||= getLaunchers([{ SID: spawnStash.SID, Name: "" }]);
  spawnStash.__internal__.rawName = spawnStash.SID;
  delete spawnStash.__internal__.bpatch;
  delete spawnStash.__internal__.refurl;
  delete spawnStash.__internal__.refkey;
  return spawnStash;
}
