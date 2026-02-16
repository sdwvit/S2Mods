import { modName } from "../../src/base-paths.mts";
import { waitFor } from "../../src/wait-for.mts";
import { transformSpawnActorPrototypes } from "./transformSpawnActorPrototypes.mts";
import {
  QuestNodePrototype,
  QuestNodePrototypeConsoleCommand,
  QuestNodePrototypeGiveCache,
  QuestNodePrototypeItemAdd,
  QuestNodePrototypeRandom,
  QuestNodePrototypeSpawn,
  Struct,
} from "s2cfgtojson";
import { allStashes } from "./stashes.mts";
import { precision } from "../../src/precision.mts";
import { getLaunchers } from "../../src/struct-utils.mts";

const RandomStashQuestName = `RandomStashQuest`; // if you change this, also change Blueprint in SDK
const RandomStashQuestNodePrefix = `${modName}_RandomStashQuest`;

const getStashSpawnerSID = (stashKey: string) => `${RandomStashQuestNodePrefix}_Random_${stashKey}_Spawn`;

export async function injectMassiveRNGQuestNodes(finishedTransformers: Set<string>) {
  await waitFor(() => finishedTransformers.has(transformSpawnActorPrototypes.name), 180000);
  const extraStructs: QuestNodePrototype[] = [];
  const stashes = Object.keys(allStashes);

  const randomNodeSID = `${RandomStashQuestNodePrefix}_Random`;
  const randomNode = new Struct({ __internal__: { rawName: randomNodeSID, isRoot: true } }) as QuestNodePrototypeRandom;
  randomNode.SID = randomNodeSID;
  randomNode.QuestSID = `${RandomStashQuestName}`;
  randomNode.NodeType = `EQuestNodeType::Random`;
  extraStructs.push(randomNode);
  stashes.forEach((key, i) => {
    randomNode.OutputPinNames ||= new Struct() as any;
    randomNode.OutputPinNames.addNode(i);
    randomNode.PinWeights ||= new Struct() as any;
    randomNode.PinWeights.addNode(precision(1 - (i + 1) / stashes.length, 1e6));

    const spawnerSID = getStashSpawnerSID(key);
    const spawner = new Struct({ __internal__: { rawName: spawnerSID, isRoot: true } }) as QuestNodePrototypeSpawn;
    spawner.SID = spawnerSID;
    spawner.QuestSID = RandomStashQuestName;
    spawner.NodeType = `EQuestNodeType::Spawn`;
    spawner.TargetQuestGuid = key;
    spawner.IgnoreDamageType = `EIgnoreDamageType::None`;
    spawner.SpawnHidden = false;
    spawner.SpawnNodeExcludeType = `ESpawnNodeExcludeType::SeamlessDespawn`;
    spawner.Launchers = getLaunchers([{ SID: randomNode.SID, Name: String(i) }]);

    extraStructs.push(spawner);
    const cacheNotifSID = `${RandomStashQuestNodePrefix}_Random_${i}`;
    const cacheNotif = new Struct({ __internal__: { rawName: cacheNotifSID, isRoot: true } }) as QuestNodePrototypeGiveCache;

    cacheNotif.SID = cacheNotifSID;
    cacheNotif.QuestSID = `${RandomStashQuestName}`;
    cacheNotif.NodeType = `EQuestNodeType::GiveCache`;
    cacheNotif.TargetQuestGuid = `${key}`;
    cacheNotif.Launchers = getLaunchers([{ SID: randomNodeSID, Name: String(i) }]);

    extraStructs.push(cacheNotif);
  });
  return extraStructs;
}

/**
 * ConsoleCommand start a quest node for giving a clue.
 */
export function hookRewardStashClue(struct: { SID: string; QuestSID: string }, Name = "") {
  const sid = `${struct.SID}_${Name ? Name + "_" : ""}Give_Cache`;
  const stashClueReward = new Struct({ __internal__: { rawName: sid, isRoot: true } }) as QuestNodePrototypeConsoleCommand;

  stashClueReward.SID = sid;
  stashClueReward.QuestSID = struct.QuestSID;
  stashClueReward.NodeType = `EQuestNodeType::ConsoleCommand`;
  stashClueReward.ConsoleCommand = `XStartQuestNodeBySID ${RandomStashQuestNodePrefix}_Random`;
  stashClueReward.Launchers = getLaunchers([{ SID: struct.SID, Name }]);
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
