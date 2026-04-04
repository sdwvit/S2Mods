import { Struct } from "s2cfgtojson";
import type { EItemGenerationCategory, ERank, ItemGeneratorPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import {
  allDefaultArtifactPrototypes,
  allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID,
  allDefaultQuestObjPrototypesRecordByItemGeneratorPrototypeSID,
} from "../../src/consts.mts";
import { precision } from "../../src/precision.mts";

const BASE_COST = 12000;
const BASE_ARTIFACT_CHANCE = 0.001;
const SUB_GEN_CHANCE = 0.001;

const RANKS = ["Newbie", "Experienced", "Veteran", "Master"] as const;
type Rank = (typeof RANKS)[number];

const RANK_ERANKS: Record<Rank, ERank> = {
  Newbie: "ERank::Newbie" as ERank,
  Experienced: "ERank::Experienced" as ERank,
  Veteran: "ERank::Veteran" as ERank,
  Master: "ERank::Master" as ERank,
};

const detectors = [
  { sid: "Echo", chance: Math.min(1, 0.01 / SUB_GEN_CHANCE) },
  { sid: "Gilka", chance: Math.min(1, 0.0001 / SUB_GEN_CHANCE) },
  { sid: "Bear", chance: Math.min(1, 0.000001 / SUB_GEN_CHANCE) },
  { sid: "Veles", chance: Math.min(1, 0.00000001 / SUB_GEN_CHANCE) },
];

const artifactDrops = allDefaultArtifactPrototypes
  .filter((a) => {
    const sid = a.SID;
    return (
      sid &&
      a.Cost &&
      !sid.includes("_Fake") &&
      !sid.startsWith("Template") &&
      !sid.startsWith("AA") &&
      !sid.startsWith("PQuest") &&
      !sid.startsWith("CProlog")
    );
  })
  .sort((a, b) => a.Cost - b.Cost)
  .map((a) => ({
    sid: a.SID,
    cost: a.Cost,
    chance: precision(
      Math.min(
        1,
        BASE_ARTIFACT_CHANCE / Math.pow(10, Math.log2(a.Cost / BASE_COST)) / SUB_GEN_CHANCE,
      ),
      1e6,
    ),
  }));

const quarterSize = Math.ceil(artifactDrops.length / 4);
const artifactQuarters = [
  artifactDrops.slice(0, quarterSize),
  artifactDrops.slice(0, quarterSize * 2),
  artifactDrops.slice(0, quarterSize * 3),
  artifactDrops,
];

function rankIndex(rank: Rank): number {
  return RANKS.indexOf(rank);
}

function buildDetectorSubGen(rank: Rank): ItemGeneratorPrototype {
  const idx = rankIndex(rank);
  const sid = `RareNPCDrops_Detectors_${rank}_SubItemGenerator`;
  const possibleItems: Record<string, unknown> = {};
  for (let i = 0; i <= idx; i++) {
    possibleItems[i] = new Struct({
      ItemPrototypeSID: detectors[i].sid,
      Chance: detectors[i].chance,
      Weight: 1,
      MinCount: 1,
    });
  }
  return new Struct({
    __internal__: { isRoot: true, rawName: sid },
    SID: sid,
    ItemGenerator: new Struct({
      RareDetectorDrop: new Struct({
        Category: "EItemGenerationCategory::Detector" satisfies EItemGenerationCategory,
        PossibleItems: new Struct(possibleItems),
      }),
    }),
  }) as ItemGeneratorPrototype;
}

function buildArtifactSubGen(rank: Rank): ItemGeneratorPrototype {
  const idx = rankIndex(rank);
  const sid = `RareNPCDrops_Artifacts_${rank}_SubItemGenerator`;
  const arts = artifactQuarters[idx];
  const possibleItems: Record<string, unknown> = {};
  for (let i = 0; i < arts.length; i++) {
    possibleItems[i] = new Struct({
      ItemPrototypeSID: arts[i].sid,
      Chance: arts[i].chance,
      Weight: 1,
      MinCount: 1,
      MaxCount: 1,
    });
  }
  return new Struct({
    __internal__: { isRoot: true, rawName: sid },
    SID: sid,
    ItemGenerator: new Struct({
      RareArtifactDrop: new Struct({
        Category: "EItemGenerationCategory::Artifact" satisfies EItemGenerationCategory,
        PossibleItems: new Struct(possibleItems),
      }),
    }),
  }) as ItemGeneratorPrototype;
}

const subGenStructs = RANKS.flatMap((rank) => [
  buildDetectorSubGen(rank),
  buildArtifactSubGen(rank),
]);

function shouldProcessStruct(struct: ItemGeneratorPrototype) {
  if (!struct?.ItemGenerator) return false;
  if (struct.SID === "empty" || struct.SID === "EmptyQuest") return false;
  if (/^all/i.test(struct.SID) || /^msdemo/i.test(struct.SID)) return false;
  if (/(trade|trader|bartender|medic|technician)/i.test(struct.SID)) return false;
  if (/_NVG$/i.test(struct.SID)) return false;
  if (/(stash|body|corpse|reward|queststash|stashbody)/i.test(struct.SID)) return false;

  return (
    allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID[struct.SID] ||
    allDefaultQuestObjPrototypesRecordByItemGeneratorPrototypeSID[struct.SID]
  );
}

let emittedSubGens = false;

export const transformItemGenerators: StructTransformer<ItemGeneratorPrototype> = (struct) => {
  if (!shouldProcessStruct(struct)) return;

  const fork = struct.fork();

  fork.ItemGenerator = new Struct() as ItemGeneratorPrototype["ItemGenerator"];
  fork.ItemGenerator.__internal__.bpatch = true;

  for (const rank of RANKS) {
    const detectorSubGenSID = `RareNPCDrops_Detectors_${rank}_SubItemGenerator`;
    const artifactSubGenSID = `RareNPCDrops_Artifacts_${rank}_SubItemGenerator`;

    fork.ItemGenerator.addNode(
      new Struct({
        Category: "EItemGenerationCategory::SubItemGenerator" satisfies EItemGenerationCategory,
        PlayerRank: RANK_ERANKS[rank],
        PossibleItems: new Struct({
          0: new Struct({
            ItemGeneratorPrototypeSID: detectorSubGenSID,
            Chance: SUB_GEN_CHANCE,
          }),
        }),
      }),
      `RareNPCDrops_Detectors_${rank}`,
    );

    fork.ItemGenerator.addNode(
      new Struct({
        Category: "EItemGenerationCategory::SubItemGenerator" satisfies EItemGenerationCategory,
        PlayerRank: RANK_ERANKS[rank],
        PossibleItems: new Struct({
          0: new Struct({
            ItemGeneratorPrototypeSID: artifactSubGenSID,
            Chance: SUB_GEN_CHANCE,
          }),
        }),
      }),
      `RareNPCDrops_Artifacts_${rank}`,
    );
  }

  if (!emittedSubGens) {
    emittedSubGens = true;
    return [fork, ...subGenStructs];
  }

  return fork;
};
transformItemGenerators.files = ["/DynamicItemGenerator.cfg"];
