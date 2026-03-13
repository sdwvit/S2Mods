import { Struct } from "s2cfgtojson";
import type { EQuestNodeType } from "s2cfgtojson";
import type { QuestNodePrototype, QuestNodePrototypeConsoleCommand, QuestNodePrototypeContainer, QuestNodePrototypeEnd, QuestNodePrototypeGiveCache, QuestNodePrototypeItemAdd, QuestNodePrototypeRandom, QuestNodePrototypeSetItemGenerator, QuestNodePrototypeSpawn, QuestNodePrototypeTechnical } from "s2cfgtojson";
import type { MetaContext } from "../../src/meta-type.mts";
import { finishedTransformers } from "./meta.mts";
import { modName } from "../../src/base-paths.mts";
import { waitFor } from "../../src/wait-for.mts";
import { allStashes, transformSpawnActorPrototypes } from "./transformSpawnActorPrototypes.mts";
import { precision } from "../../src/precision.mts";
import { getLaunchers } from "../../src/struct-utils.mts";

let oncePerTransformer = false;

const RandomStashQuestName = modName;
const RandomStashQuestNodePrefix = modName;
const randomNodeSID = `${RandomStashQuestNodePrefix}_Random`;
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

  if (!oncePerTransformer && context.filePath.endsWith("/A-life_interrupts.cfg")) {
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

  return Promise.all(promises).then((results) => results.flat());
}

export const recurringQuestsFilenames = ["BodyParts_Malahit", "RSQ01", "RSQ04", "RSQ05", "RSQ06", "RSQ07", "RSQ08", "RSQ09", "RSQ10"];

export async function injectMassiveRNGQuestNodes(finishedTransformers: Set<string>) {
  await waitFor(() => finishedTransformers.has(transformSpawnActorPrototypes.name), 180000);
  const extraStructs: QuestNodePrototype[] = [];

  const questStart = getQuestStart();
  const questEnd = getQuestEnd();
  extraStructs.push(questStart);
  extraStructs.push(questEnd);
  const randomNode = getRandomNode(questStart.SID);
  extraStructs.push(randomNode);

  allStashes.forEach((i, stashId) => {
    const spawner = getSpawner(stashId, i);
    const cacheDelay = getGiveCacheDelay(i);

    extraStructs.push(spawner);
    extraStructs.push(cacheDelay);
    const cacheNotif = getCacheNotif(stashId, i);

    extraStructs.push(cacheNotif);
  });
  return extraStructs;
}

/**
 * start a quest node for giving a clue.
 */
export function hookRewardStashClue(struct: { SID: string; QuestSID: string }, Name = "") {
  const SID = `${struct.SID}_${Name ? Name + "_" : ""}Give_Cache`;

  const node = new Struct({
    SID,
    QuestSID: struct.QuestSID,
    NodeType: "EQuestNodeType::ConsoleCommand" satisfies EQuestNodeType,
    Repeatable: true,
    Launchers: getLaunchers([{ SID: struct.SID, Name }]),
    ConsoleCommand: `XStartQuestNodeBySID ${QuestStartSID}`,
  }) as QuestNodePrototypeConsoleCommand;
  node.__internal__.isRoot = true;
  node.__internal__.rawName = SID;
  return node;
}

export async function hookStashSpawners(struct: QuestNodePrototypeItemAdd, finishedTransformers: Set<string>) {
  await waitFor(() => finishedTransformers.has(transformSpawnActorPrototypes.name), 180000);

  // only quest stashes that are hidden by this mod are interesting here
  if (!allStashes.has(struct.TargetQuestGuid) || !struct.Launchers) {
    return;
  }
  const extraStructs = [];

  const i = allStashes.get(struct.TargetQuestGuid);

  const spawnStash = getSpawner(struct.TargetQuestGuid, i, struct.QuestSID);
  spawnStash.Launchers = struct.Launchers.clone();
  extraStructs.push(spawnStash);

  const itemDelay = getItemAddDelayNode(struct);
  itemDelay.Launchers = struct.Launchers.clone();
  extraStructs.push(itemDelay);

  const fork = struct.fork();
  fork.Launchers = getLaunchers([{ SID: itemDelay.SID }]);
  extraStructs.push(fork);

  return extraStructs;
}

const getStashSpawnerSID = (i: number, prefix: string) => `${prefix}_Spawn_${i}`;
const getGiveCacheSID = (i: number) => `${RandomStashQuestNodePrefix}_GiveCache_${i}`;
const getGiveCacheDelaySID = (i: number) => `${RandomStashQuestNodePrefix}_GiveCacheDelay_${i}`;

function getCacheNotif(key: string, i: number, QuestSID = RandomStashQuestName) {
  const SID = getGiveCacheSID(i);

  const cacheNotif = new Struct(`
        ${SID} : struct.begin
           SID = ${SID}
           QuestSID = ${QuestSID}
           NodeType = EQuestNodeType::GiveCache
           TargetQuestGuid = ${key}
        struct.end
      `) as QuestNodePrototypeGiveCache;
  cacheNotif.Launchers = getLaunchers([{ SID: getGiveCacheDelaySID(i) }]);
  return cacheNotif;
}

function getGiveCacheDelay(i: number, QuestSID = RandomStashQuestName) {
  const SID = getGiveCacheDelaySID(i);
  const delay = new Struct(`
      ${SID} : struct.begin
         SID = ${SID}
         QuestSID = ${QuestSID}
         NodeType = EQuestNodeType::Technical
         StartDelay = 0.1
      struct.end
    `) as QuestNodePrototypeTechnical;
  delay.Launchers = getLaunchers([{ SID: randomNodeSID, Name: String(i) }]);
  return delay;
}

function getItemAddDelayNode(struct: QuestNodePrototypeItemAdd) {
  const SID = `${struct.SID}_SpawnDelay`;
  const delay = new Struct(`
      ${SID} : struct.begin
         SID = ${SID}
         QuestSID = ${struct.QuestSID}
         NodeType = EQuestNodeType::Technical
         StartDelay = 1.0
      struct.end
    `) as QuestNodePrototypeTechnical;
  return delay;
}

function getSpawner(key: string, i: number, QuestSID = RandomStashQuestName, launcherConfig = [{ SID: randomNodeSID, Name: String(i) }]) {
  const spawnerSID = getStashSpawnerSID(i, QuestSID);
  const spawner = new Struct(`
      ${spawnerSID} : struct.begin
         SID = ${spawnerSID}
         QuestSID = ${QuestSID}
         NodeType = EQuestNodeType::Spawn
         TargetQuestGuid = ${key}
         IgnoreDamageType = EIgnoreDamageType::None
         SpawnHidden = false
         SpawnNodeExcludeType = ESpawnNodeExcludeType::SeamlessDespawn
      struct.end
    `) as QuestNodePrototypeSpawn;
  spawner.Launchers = getLaunchers(launcherConfig);
  return spawner;
}

function getRandomNode(launcherSid: string) {
  const node = new Struct(`
    ${randomNodeSID} : struct.begin
        SID = ${randomNodeSID}
        QuestSID = ${RandomStashQuestName}
        NodeType = EQuestNodeType::Random
    struct.end`) as QuestNodePrototypeRandom;
  allStashes.forEach((i) => {
    const index = i;
    node.OutputPinNames ||= new Struct() as any;
    node.OutputPinNames.addNode(!index ? index : allStashes.size - index, index);

    node.PinWeights ||= new Struct() as any;
    node.PinWeights.addNode(precision(1 - (index + 1) / allStashes.size, 1e6));
  });
  node.Launchers = getLaunchers([{ SID: launcherSid }]);
  node.Repeatable = true;
  return node;
}
const QuestStartSID = `${RandomStashQuestName}_Start`;
function getQuestStart() {
  return new Struct({
    __internal__: { isRoot: true, rawName: QuestStartSID },
    SID: QuestStartSID,
    QuestSID: RandomStashQuestName,
    NodeType: "EQuestNodeType::Technical",
    StartDelay: 0,
    LaunchOnQuestStart: true,
  }) as QuestNodePrototypeTechnical;
}
function getQuestEnd() {
  const SID = `${RandomStashQuestName}_End`;
  return new Struct({
    __internal__: { isRoot: true, rawName: SID },
    SID,
    QuestSID: RandomStashQuestName,
    NodeType: "EQuestNodeType::End",

    ExcludeAllNodesInContainer: false,
    Launchers: getLaunchers(
      [...allStashes.values()].map((i) => ({
        SID: getGiveCacheSID(i),
      })),
    ),
  }) as QuestNodePrototypeEnd;
}

transformQuestNodePrototypes.files = [
  "/QuestNodePrototypes/A-life_interrupts.cfg",
  "/QuestNodePrototypes/ANCQ01.cfg",
  "/QuestNodePrototypes/ANCQ01_P.cfg",
  "/QuestNodePrototypes/ANCQ27.cfg",
  "/QuestNodePrototypes/BodyParts_Malahit.cfg",
  "/QuestNodePrototypes/E03_MQ05.cfg",
  "/QuestNodePrototypes/E05_SQ01.cfg",
  "/QuestNodePrototypes/E07_MQ01.cfg",
  "/QuestNodePrototypes/E07_SQ01.cfg",
  "/QuestNodePrototypes/E09_EQ02.cfg",
  "/QuestNodePrototypes/E10_MQ01_C01.cfg",
  "/QuestNodePrototypes/E11_MQ01.cfg",
  "/QuestNodePrototypes/E14_MQ01_C02.cfg",
  "/QuestNodePrototypes/E14_MQ02.cfg",
  "/QuestNodePrototypes/EQ48.cfg",
  "/QuestNodePrototypes/EQ67.cfg",
  "/QuestNodePrototypes/EQ110_P.cfg",
  "/QuestNodePrototypes/EQ150.cfg",
  "/QuestNodePrototypes/Rostok_L_ScarTemp_Camp.cfg",
  "/QuestNodePrototypes/RSQ01_C01.cfg",
  "/QuestNodePrototypes/RSQ01_C02.cfg",
  "/QuestNodePrototypes/RSQ01_C03.cfg",
  "/QuestNodePrototypes/RSQ01_C04.cfg",
  "/QuestNodePrototypes/RSQ01_C05.cfg",
  "/QuestNodePrototypes/RSQ01_C06.cfg",
  "/QuestNodePrototypes/RSQ04_C01.cfg",
  "/QuestNodePrototypes/RSQ04_C02.cfg",
  "/QuestNodePrototypes/RSQ04_C03.cfg",
  "/QuestNodePrototypes/RSQ04_C04.cfg",
  "/QuestNodePrototypes/RSQ04_C05.cfg",
  "/QuestNodePrototypes/RSQ04_C06.cfg",
  "/QuestNodePrototypes/RSQ04_C07.cfg",
  "/QuestNodePrototypes/RSQ04_C08.cfg",
  "/QuestNodePrototypes/RSQ04_C09.cfg",
  "/QuestNodePrototypes/RSQ04_C10.cfg",
  "/QuestNodePrototypes/RSQ05_C01.cfg",
  "/QuestNodePrototypes/RSQ05_C02.cfg",
  "/QuestNodePrototypes/RSQ05_C04.cfg",
  "/QuestNodePrototypes/RSQ05_C05.cfg",
  "/QuestNodePrototypes/RSQ05_C07.cfg",
  "/QuestNodePrototypes/RSQ05_C08.cfg",
  "/QuestNodePrototypes/RSQ05_C09.cfg",
  "/QuestNodePrototypes/RSQ05_C10.cfg",
  "/QuestNodePrototypes/RSQ06_C01___K_Z.cfg",
  "/QuestNodePrototypes/RSQ06_C02___K_M.cfg",
  "/QuestNodePrototypes/RSQ06_C03___K_B.cfg",
  "/QuestNodePrototypes/RSQ06_C04___K_S.cfg",
  "/QuestNodePrototypes/RSQ06_C05___B_B.cfg",
  "/QuestNodePrototypes/RSQ06_C06___B_A.cfg",
  "/QuestNodePrototypes/RSQ06_C07___B_A.cfg",
  "/QuestNodePrototypes/RSQ06_C08___B_A.cfg",
  "/QuestNodePrototypes/RSQ06_C09___S_P.cfg",
  "/QuestNodePrototypes/RSQ07_C01_K_Z.cfg",
  "/QuestNodePrototypes/RSQ07_C02_K_M.cfg",
  "/QuestNodePrototypes/RSQ07_C03_K_M.cfg",
  "/QuestNodePrototypes/RSQ07_C04_K_B.cfg",
  "/QuestNodePrototypes/RSQ07_C05_B_B.cfg",
  "/QuestNodePrototypes/RSQ07_C06_B_A.cfg",
  "/QuestNodePrototypes/RSQ07_C07_B_A.cfg",
  "/QuestNodePrototypes/RSQ07_C08_B_A.cfg",
  "/QuestNodePrototypes/RSQ07_C09_S_P.cfg",
  "/QuestNodePrototypes/RSQ08_C01_K_M.cfg",
  "/QuestNodePrototypes/RSQ08_C02_K_B.cfg",
  "/QuestNodePrototypes/RSQ08_C03_K_S.cfg",
  "/QuestNodePrototypes/RSQ08_C04_B_B.cfg",
  "/QuestNodePrototypes/RSQ08_C05_B_B.cfg",
  "/QuestNodePrototypes/RSQ08_C06_B_A.cfg",
  "/QuestNodePrototypes/RSQ08_C07_B_A.cfg",
  "/QuestNodePrototypes/RSQ08_C08_B_A.cfg",
  "/QuestNodePrototypes/RSQ08_C09_S_P.cfg",
  "/QuestNodePrototypes/RSQ09_C01_K_M.cfg",
  "/QuestNodePrototypes/RSQ09_C02_K_M.cfg",
  "/QuestNodePrototypes/RSQ09_C03_K_M.cfg",
  "/QuestNodePrototypes/RSQ09_C04_K_S.cfg",
  "/QuestNodePrototypes/RSQ09_C05_B_B.cfg",
  "/QuestNodePrototypes/RSQ09_C06_B_A.cfg",
  "/QuestNodePrototypes/RSQ09_C07_B_A.cfg",
  "/QuestNodePrototypes/RSQ09_C08_B_A.cfg",
  "/QuestNodePrototypes/RSQ09_C09_S_P.cfg",
  "/QuestNodePrototypes/RSQ10_C01_K_M.cfg",
  "/QuestNodePrototypes/RSQ10_C02_K_M.cfg",
  "/QuestNodePrototypes/RSQ10_C03_K_S.cfg",
  "/QuestNodePrototypes/RSQ10_C04_K_S.cfg",
  "/QuestNodePrototypes/RSQ10_C05_B_B.cfg",
  "/QuestNodePrototypes/RSQ10_C06_B_A.cfg",
  "/QuestNodePrototypes/RSQ10_C07_B_A.cfg",
  "/QuestNodePrototypes/RSQ10_C08_B_A.cfg",
  "/QuestNodePrototypes/RSQ10_C09_S_P.cfg",
  "/QuestNodePrototypes/SEQ09.cfg",
  "/QuestNodePrototypes/SQ03_P.cfg",
  "/QuestNodePrototypes/SQ25.cfg",
  "/QuestNodePrototypes/SQ87_P.cfg",
  "/QuestNodePrototypes/SQ94.cfg",
  "/QuestNodePrototypes/SQ95.cfg",
  "/QuestNodePrototypes/SQ96_P.cfg",
  "/QuestNodePrototypes/SQ101_C01.cfg",
  "/QuestNodePrototypes/SQ101_C02.cfg",
  "/QuestNodePrototypes/SQ102.cfg",
  "/QuestNodePrototypes/Swamp_L_E05_MQ03.cfg",
];
