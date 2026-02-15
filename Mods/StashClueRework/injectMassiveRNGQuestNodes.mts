import { waitFor } from "../../src/wait-for.mts";
import {
  QuestNodePrototype,
  QuestNodePrototypeGiveCache,
  QuestNodePrototypeLaunchers,
  QuestNodePrototypeRandom,
  QuestNodePrototypeSpawn,
  QuestNodePrototypeTechnical,
  Struct,
} from "s2cfgtojson";
import { allStashes } from "./stashes.mts";
import { precision } from "../../src/precision.mts";
import { getLaunchers } from "../../src/struct-utils.mts";
import { transformSpawnActorPrototypes } from "./transformSpawnActorPrototypes.mts";

export const QuestSID = "StashClueRework"; // if you edit this, also edit bp in sdk editor
export const RNGGenSID = `${QuestSID}_Random`;
const MaxPinsPerRandomNode = 12;
export const getStashSpawnerSID = (pin: number) => `${RNGGenSID}_${pin}_Spawn`;
export const getStashDelaySID = (pin: number) => `${RNGGenSID}_${pin}_Delay`;
export const getCacheNotificationSID = (pin: number) => `${RNGGenSID}_${pin}_Clue`;
const getBucketSID = (layer: number, bucketIndex: number) => `${RNGGenSID}_Bucket_${layer}_${bucketIndex}`;

async function injectMassiveRNGQuestNodes(finishedTransformers: Set<string>) {
  await waitFor(() => finishedTransformers.has(transformSpawnActorPrototypes.name), 180000);
  const extraStructs: Record<string, QuestNodePrototype> = {};
  const stashes = Object.keys(allStashes);

  extraStructs[RNGGenSID] = getRNGNode(RNGGenSID);
  const leafSpawnerSIDs: string[] = [];

  stashes.forEach((key, pin) => {
    const spawnerSID = getStashSpawnerSID(pin);
    extraStructs[spawnerSID] = getSpawnerNode(key, pin);
    extraStructs[getCacheNotificationSID(pin)] = getCacheNotificationNode(key, pin);
    leafSpawnerSIDs.push(spawnerSID);
  });

  buildRandomTree(extraStructs, leafSpawnerSIDs);
  return Object.values(extraStructs);
}

export default injectMassiveRNGQuestNodes;

function getRNGNode(sid: string) {
  const randomNode = new Struct() as QuestNodePrototypeRandom;
  randomNode.SID = sid;
  randomNode.QuestSID = QuestSID;
  randomNode.NodeType = "EQuestNodeType::Random";
  randomNode.__internal__.isRoot = true;
  randomNode.__internal__.rawName = randomNode.SID;
  // randomNode.Repeatable = true;
  randomNode.OutputPinNames ||= new Struct() as any;
  randomNode.PinWeights ||= new Struct() as any;

  return randomNode;
}

function setRandomPins(randomNode: QuestNodePrototypeRandom, count: number) {
  for (let pin = 0; pin < count; pin++) {
    randomNode.OutputPinNames.addNode(pin);
    randomNode.PinWeights.addNode(precision(1 - (pin + 1) / count, 1e6));
  }
}

function buildRandomTree(extraStructs: Record<string, QuestNodePrototype>, leafSpawnerSIDs: string[]) {
  let layer = leafSpawnerSIDs;
  let layerIndex = 0;

  while (layer.length > MaxPinsPerRandomNode) {
    const nextLayer: string[] = [];
    for (let i = 0; i < layer.length; i += MaxPinsPerRandomNode) {
      const chunk = layer.slice(i, i + MaxPinsPerRandomNode);
      const bucketIndex = Math.floor(i / MaxPinsPerRandomNode);
      const bucketSID = getBucketSID(layerIndex, bucketIndex);
      const bucketNode = getRNGNode(bucketSID);
      setRandomPins(bucketNode, chunk.length);
      extraStructs[bucketSID] = bucketNode;
      nextLayer.push(bucketSID);

      chunk.forEach((childSID, pin) => {
        setLauncher(extraStructs[childSID] as QuestNodePrototypeRandom, bucketSID, pin);
      });
    }
    layer = nextLayer;
    layerIndex++;
  }

  const root = extraStructs[RNGGenSID] as QuestNodePrototypeRandom;
  setRandomPins(root, layer.length);
  layer.forEach((childSID, pin) => {
    setLauncher(extraStructs[childSID] as QuestNodePrototypeRandom, RNGGenSID, pin);
  });
}

function setLauncher(node: { Launchers: QuestNodePrototypeLaunchers }, launcherSID: string, launcherPin: number) {
  node.Launchers = getLaunchers([{ SID: launcherSID, Name: String(launcherPin) }]);
}

function getSpawnerNode(stashKey: string, pin: number) {
  const spawner = new Struct() as QuestNodePrototypeSpawn;
  spawner.SID = getStashSpawnerSID(pin);
  spawner.__internal__.rawName = spawner.SID;
  spawner.__internal__.isRoot = true;
  spawner.QuestSID = QuestSID;
  spawner.NodeType = `EQuestNodeType::Spawn`;
  spawner.TargetQuestGuid = stashKey;
  spawner.IgnoreDamageType = `EIgnoreDamageType::None`;
  spawner.SpawnHidden = false;
  spawner.SpawnNodeExcludeType = `ESpawnNodeExcludeType::SeamlessDespawn`;

  return spawner;
}

function getDelayNode(pin: number) {
  const delayNode = new Struct() as QuestNodePrototypeTechnical;
  delayNode.SID = getStashDelaySID(pin);
  delayNode.__internal__.rawName = delayNode.SID;
  delayNode.__internal__.isRoot = true;
  delayNode.QuestSID = QuestSID;
  delayNode.NodeType = "EQuestNodeType::Technical";
  delayNode.StartDelay = 1.0;
  (delayNode as any).Launchers = getLaunchers([{ SID: getStashSpawnerSID(pin), Name: "" }]);
  return delayNode;
}

function getCacheNotificationNode(stashKey: string, pin: number) {
  const cacheNotif = new Struct() as QuestNodePrototypeGiveCache;
  cacheNotif.SID = getCacheNotificationSID(pin);
  cacheNotif.__internal__.rawName = cacheNotif.SID;
  cacheNotif.__internal__.isRoot = true;
  cacheNotif.QuestSID = QuestSID;
  cacheNotif.NodeType = `EQuestNodeType::GiveCache`;
  cacheNotif.TargetQuestGuid = stashKey;
  cacheNotif.Launchers = getLaunchers([{ SID: getStashSpawnerSID(pin), Name: "" }]);
  return cacheNotif;
}
