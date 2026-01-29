import { waitFor } from "../../src/wait-for.mts";
import { QuestNodePrototype, QuestNodePrototypeGiveCache, QuestNodePrototypeRandom, QuestNodePrototypeSpawn, Struct } from "s2cfgtojson";
import { allStashes } from "./stashes.mts";
import { precision } from "../../src/precision.mts";
import { getLaunchers } from "../../src/struct-utils.mts";
import { transformSpawnActorPrototypes } from "./transformSpawnActorPrototypes.mts";

const RandomStashQuestName = `RandomStashQuest`; // if you change this, also change Blueprint in SDK
export const RandomStashQuestNodePrefix = RandomStashQuestName;
export const getStashSpawnerSID = (stashKey: string) => `${RandomStashQuestNodePrefix}_Random_${stashKey}_Spawn`;

export async function injectMassiveRNGQuestNodes(finishedTransformers: Set<string>) {
  await waitFor(() => finishedTransformers.has(transformSpawnActorPrototypes.name), 180000);
  const extraStructs: QuestNodePrototype[] = [];
  const stashes = Object.keys(allStashes);
  const randomNode = new Struct(`
    ${RandomStashQuestNodePrefix}_Random : struct.begin
        SID = ${RandomStashQuestNodePrefix}_Random
        QuestSID = ${RandomStashQuestName}
        NodeType = EQuestNodeType::Random
    struct.end`) as QuestNodePrototypeRandom;
  extraStructs.push(randomNode);
  stashes.forEach((key, i) => {
    randomNode.OutputPinNames ||= new Struct() as any;
    randomNode.OutputPinNames.addNode(i);
    randomNode.PinWeights ||= new Struct() as any;
    randomNode.PinWeights.addNode(precision(1 - (i + 1) / stashes.length, 1e6));

    const spawnerSID = getStashSpawnerSID(key);
    const spawner = new Struct(`
      ${spawnerSID} : struct.begin
         SID = ${spawnerSID}
         QuestSID = ${RandomStashQuestName}
         NodeType = EQuestNodeType::Spawn
         TargetQuestGuid = ${key}
         IgnoreDamageType = EIgnoreDamageType::None
         SpawnHidden = false
         SpawnNodeExcludeType = ESpawnNodeExcludeType::SeamlessDespawn
      struct.end
    `) as QuestNodePrototypeSpawn;
    const launcherConfig = [{ SID: `${RandomStashQuestNodePrefix}_Random`, Name: String(i) }];
    spawner.Launchers = getLaunchers(launcherConfig);

    extraStructs.push(spawner);
    const cacheNotif = new Struct(`
        ${RandomStashQuestNodePrefix}_Random_${i} : struct.begin
           SID = ${RandomStashQuestNodePrefix}_Random_${i}
           QuestSID = ${RandomStashQuestName}
           NodeType = EQuestNodeType::GiveCache
           TargetQuestGuid = ${key}
        struct.end
      `) as QuestNodePrototypeGiveCache;
    cacheNotif.Launchers = getLaunchers([{ SID: `${RandomStashQuestNodePrefix}_Random`, Name: String(i) }]);

    extraStructs.push(cacheNotif);
  });
  return extraStructs;
}
