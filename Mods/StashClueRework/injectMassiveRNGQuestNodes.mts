import { modName } from "../../src/base-paths.mts";
import { waitFor } from "../../src/wait-for.mts";
import { transformSpawnActorPrototypes } from "./transformSpawnActorPrototypes.mts";
import {
  QuestNodePrototype,
  QuestNodePrototypeConsoleCommand,
  QuestNodePrototypeGiveCache,
  QuestNodePrototypeItemAdd,
  QuestNodePrototypeRandom,
  QuestNodePrototypeSetItemGenerator,
  QuestNodePrototypeSpawn,
  Struct,
} from "s2cfgtojson";
import { allStashes } from "./stashes.mts";
import { precision } from "../../src/precision.mts";
import { getLaunchers } from "../../src/struct-utils.mts";

const RandomStashQuestName = `RandomStashQuest`; // if you change this, also change Blueprint in SDK
const RandomStashQuestNodePrefix = `${modName}_RandomStashQuest`;

const getStashSpawnerSID = (stashKey: string) => `${RandomStashQuestNodePrefix}_Random_${stashKey}_Spawn`;

function getCacheNotif(key: string, i: number) {
  const cacheNotifSID = `${RandomStashQuestNodePrefix}_Random_${i}`;
  const cacheNotif = new Struct({
    __internal__: { rawName: cacheNotifSID, isRoot: true },
  }) as QuestNodePrototypeGiveCache;

  cacheNotif.SID = cacheNotifSID;
  cacheNotif.QuestSID = `${RandomStashQuestName}`;
  cacheNotif.NodeType = `EQuestNodeType::GiveCache`;
  cacheNotif.TargetQuestGuid = `${key}`;
  cacheNotif.Launchers = getLaunchers([{ SID: getRandomNodeSID(), Name: String(i) }]);
  return cacheNotif;
}

function getSpawner(key: string, i: number) {
  const spawnerSID = getStashSpawnerSID(key);
  const spawner = new Struct({ __internal__: { rawName: spawnerSID, isRoot: true } }) as QuestNodePrototypeSpawn;
  spawner.SID = spawnerSID;
  spawner.QuestSID = RandomStashQuestName;
  spawner.NodeType = `EQuestNodeType::Spawn`;
  spawner.TargetQuestGuid = key;
  spawner.IgnoreDamageType = `EIgnoreDamageType::None`;
  spawner.SpawnHidden = false;
  spawner.SpawnNodeExcludeType = `ESpawnNodeExcludeType::SeamlessDespawn`;
  spawner.Launchers = getLaunchers([{ SID: getRandomNodeSID(), Name: String(i) }]);
  return spawner;
}

function getRandomNode() {
  const randomNode = new Struct({ __internal__: { rawName: getRandomNodeSID(), isRoot: true } }) as QuestNodePrototypeRandom;
  randomNode.SID = getRandomNodeSID();
  randomNode.QuestSID = `${RandomStashQuestName}`;
  randomNode.NodeType = `EQuestNodeType::Random`;
  const stashes = Object.keys(allStashes);

  stashes.forEach((_, i) => {
    randomNode.OutputPinNames ||= new Struct() as any;
    randomNode.OutputPinNames.addNode(i);
    randomNode.PinWeights ||= new Struct() as any;
    randomNode.PinWeights.addNode(precision(1 - (i + 1) / stashes.length, 1e6));
  });
  return randomNode;
}

function getRandomNodeSID() {
  return `${RandomStashQuestNodePrefix}_Random`;
}

export async function injectMassiveRNGQuestNodes(finishedTransformers: Set<string>) {
  await waitFor(() => finishedTransformers.has(transformSpawnActorPrototypes.name), 180000);
  const extraStructs: QuestNodePrototype[] = [];

  extraStructs.push(getRandomNode());
  Object.keys(allStashes).forEach((key, i) => {
    extraStructs.push(getSpawner(key, i));
    extraStructs.push(getCacheNotif(key, i));
  });
  return extraStructs;
}

/**
 * ConsoleCommand start a quest node for giving a clue.
 */
export function hookRewardStashClue(struct: QuestNodePrototypeSetItemGenerator, Name = "") {
  const sid = `${struct.SID}_${Name ? Name + "_" : ""}Give_Cache`;
  const stashClueReward = new Struct({ __internal__: { rawName: sid, isRoot: true } }) as QuestNodePrototypeConsoleCommand;

  stashClueReward.SID = sid;
  stashClueReward.QuestSID = struct.QuestSID;
  stashClueReward.NodeType = `EQuestNodeType::ConsoleCommand`;
  stashClueReward.ConsoleCommand = `XStartQuestNodeBySID ${RandomStashQuestNodePrefix}_Random`;
  stashClueReward.Launchers = struct.Launchers;
  return stashClueReward;
}

export async function hookStashSpawners(struct: QuestNodePrototypeItemAdd, finishedTransformers: Set<string>) {
  await waitFor(() => finishedTransformers.has(transformSpawnActorPrototypes.name), 180000);

  // only quest stashes that are hidden by this mod are interesting here
  if (!allStashes[struct.TargetQuestGuid]) {
    return;
  }

  const spawnStash = new Struct() as QuestNodePrototypeConsoleCommand;
  spawnStash.SID = `${struct.QuestSID}_Spawn_${struct.TargetQuestGuid}`;
  spawnStash.__internal__.isRoot = true;
  spawnStash.__internal__.rawName = spawnStash.SID;

  spawnStash.NodeType = "EQuestNodeType::ConsoleCommand";
  spawnStash.QuestSID = struct.QuestSID;
  spawnStash.ConsoleCommand = `XStartQuestNodeBySID ${getStashSpawnerSID(struct.TargetQuestGuid)}`;
  spawnStash.Launchers = struct.Launchers;

  const fork = struct.fork();
  fork.Launchers = getLaunchers([{ SID: spawnStash.SID, Name: "" }]);
  delete spawnStash.__internal__.bpatch;
  delete spawnStash.__internal__.refurl;
  delete spawnStash.__internal__.refkey;
  return [spawnStash, fork];
}
