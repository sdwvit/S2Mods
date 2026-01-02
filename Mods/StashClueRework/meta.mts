import { EntriesTransformer, MetaContext, MetaType } from "../../src/meta-type.mts";
import { CluePrototype, QuestNodePrototype, SpawnActorPrototype, Struct } from "s2cfgtojson";
import { allStashes } from "./stashes.mts";
import { modName } from "../../src/base-paths.mts";
import { getLaunchers } from "../../src/struct-utils.mts";
import { waitFor } from "../../src/wait-for.mts";
import { precision } from "../../src/precision.mts";
import { QuestDataTable } from "../MasterMod/rewardFormula.mts";

const finishedTransformers = new Set<string>();

export const meta: MetaType = {
  description: `
This mod reworks the stash clues system and makes exploring stashes a bit more interesting.
[hr][/hr]
First, it makes all existing stashes to not spawn on game start (new game required).[h1][/h1]
Second, it injects 100 variables corresponding to localizations for stashes.[h1][/h1]
It is then uses those variables and despawned stashes to make them quest stashes instead.[h1][/h1]
Once you finish any recurring quest from base vendors, apart from monetary reward, they give you a stash clue to a random stash grabbed in the first step.[h1][/h1]
[hr][/hr]
bPatches: SpawnActorPrototypes/WorldMap_WP/*.cfg, CluePrototypes.cfg,
`,
  changenote: "Mutant Quest Parts quest now gives stashes too",
  structTransformers: [transformSpawnActorPrototypes, transformCluePrototypes, transformQuestNodePrototypes],
  onTransformerFinish(transformer: EntriesTransformer<Struct>) {
    finishedTransformers.add(transformer.name);
  },
};

function transformSpawnActorPrototypes(struct: SpawnActorPrototype, context: MetaContext<SpawnActorPrototype>) {
  if (struct.SpawnType === "ESpawnType::ItemContainer") {
    return rememberAndEmptyStash(struct, context);
  }

  return null;
}

export function rememberAndEmptyStash(struct: SpawnActorPrototype, context: MetaContext<SpawnActorPrototype>) {
  if (struct.ClueVariablePrototypeSID !== "EmptyInherited" || !containers.has(struct.SpawnedPrototypeSID)) {
    return;
  }
  const fork = struct.fork();
  allStashes[struct.SID] = struct;

  fork.ClueVariablePrototypeSID = getGeneratedStashSID((context.fileIndex % 100) + 1);
  fork.SpawnOnStart = false;

  return fork;
}

export const containers = new Set([
  "BlueBox",
  "BigSafe",
  "SmallSafe",
  "Bag",
  "Backpack",
  "BackpackGrave_g",
  "BackpackGrave_h",
  "BackpackGrave_i",
  "BackpackGrave_j",
  "PackOfItemsBase",
  "BasicFoodCache",
  "BasicClueStatsCache",
  "BasicMixedCache",
  "NewbieCacheContainer",
  "ExperiencedCacheContainer",
  "VeteranCacheContainer",
  "MasterCacheContainer",
  "CarouselExplosionBag",
]);

transformSpawnActorPrototypes.files = ["GameLite/GameData/SpawnActorPrototypes/WorldMap_WP/"];
transformSpawnActorPrototypes.contains = true;
transformSpawnActorPrototypes.contents = [...containers, "ESpawnType::ItemContainer"];

let transformCluePrototypesOncePerFile = false;
export const getGeneratedStashSID = (i: number) => `Gen_Stash${i}`;

// ----

/**
 * Injects 100 generated stash clue prototypes into CluePrototypes.cfg
 * Each generated struct uses `SID` = `Gen_Stash{n}` and minimal internal metadata.
 * Returns `null` to indicate no modification to the original entries.
 */
export function transformCluePrototypes() {
  if (transformCluePrototypesOncePerFile) {
    return null;
  }

  transformCluePrototypesOncePerFile = true;
  const extraStructs: CluePrototype[] = [];
  [...new Set(QuestDataTable.map((q) => `${q.Vendor.replace(/\W/g, "")}_latest_quest_variant`))].forEach((SID) => {
    extraStructs.push(
      new Struct(`
          ${SID} : struct.begin {refkey=[0]}
             SID = ${SID}
             Type = EGlobalVariableType::Int
             DefaultValue = 0
          struct.end
      `) as CluePrototype,
    );
  });
  for (let i = 1; i <= 100; i++) {
    extraStructs.push(
      new Struct({
        __internal__: {
          refkey: "[0]",
          rawName: getGeneratedStashSID(i),
          isRoot: true,
        },
        SID: getGeneratedStashSID(i),
      }) as CluePrototype,
    );
  }
  return extraStructs;
}

transformCluePrototypes.files = ["/CluePrototypes.cfg"];

// ---

let oncePerTransformer = false;
const RandomStashQuestName = `RandomStashQuest`; // if you change this, also change Blueprint in SDK
const RandomStashQuestNodePrefix = `${modName}_RandomStashQuest`;

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
async function transformQuestNodePrototypes(struct: QuestNodePrototype, context: MetaContext<QuestNodePrototype>) {
  let promises: Promise<QuestNodePrototype[] | QuestNodePrototype>[] = [];
  const fork = struct.fork();
  // applies to all quest nodes that add items (i.e., stash clues)
  if (struct.NodeType === "EQuestNodeType::ItemAdd") {
    promises.push(hookStashSpawners(struct, fork, finishedTransformers));
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
  if (fork.entries().length) {
    res.push(fork);
  }

  return res;
}

export const recurringQuestsFilenames = ["BodyParts_Malahit", "RSQ01", "RSQ04", "RSQ05", "RSQ06", "RSQ07", "RSQ08", "RSQ09", "RSQ10"];

transformQuestNodePrototypes.files = ["/QuestNodePrototypes/"];
transformQuestNodePrototypes.contents = ["EQuestNodeType::ItemAdd", "EQuestNodeType::SetItemGenerator", "BodyParts_Malahit_Start"];
transformQuestNodePrototypes.contains = true;

const getStashSpawnerSID = (stashKey: string) => `${RandomStashQuestNodePrefix}_Random_${stashKey}_Spawn`;

export async function injectMassiveRNGQuestNodes(finishedTransformers: Set<string>) {
  await waitFor(() => finishedTransformers.has(transformSpawnActorPrototypes.name), 180000);
  const extraStructs: QuestNodePrototype[] = [];
  const stashes = Object.keys(allStashes);
  const randomNode = new Struct(`
    ${RandomStashQuestNodePrefix}_Random : struct.begin
        SID = ${RandomStashQuestNodePrefix}_Random
        QuestSID = ${RandomStashQuestName}
        NodeType = EQuestNodeType::Random
    struct.end`) as QuestNodePrototype;
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
    `) as QuestNodePrototype;
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
      `) as QuestNodePrototype;
    cacheNotif.Launchers = getLaunchers([{ SID: `${RandomStashQuestNodePrefix}_Random`, Name: String(i) }]);

    extraStructs.push(cacheNotif);
  });
  return extraStructs;
}

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
    `) as QuestNodePrototype;

  stashClueReward.Launchers = getLaunchers([{ SID: struct.SID, Name }]);
  return stashClueReward;
}

export async function hookStashSpawners(struct: QuestNodePrototype, fork: QuestNodePrototype, finishedTransformers: Set<string>) {
  await waitFor(() => finishedTransformers.has(transformSpawnActorPrototypes.name), 180000);

  // only quest stashes that are hidden by this mod are interesting here
  if (!allStashes[struct.TargetQuestGuid]) {
    return;
  }

  const spawnStash = struct.fork();
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
