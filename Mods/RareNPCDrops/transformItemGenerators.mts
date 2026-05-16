import { Struct } from "s2cfgtojson";
import type { EItemGenerationCategory, ERank, ItemGeneratorPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import {
  allDefaultArtifactPrototypes,
  allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID,
  allDefaultQuestObjPrototypesRecordByItemGeneratorPrototypeSID,
} from "../../src/consts.mts";
import { precision } from "../../src/precision.mts";

const SUB_GEN_CHANCE = 0.01;

const RANKS = ["Newbie", "Experienced", "Veteran", "Master"] as const;
type Rank = (typeof RANKS)[number];

const RANK_ERANKS: Record<Rank, ERank> = {
  Newbie: "ERank::Newbie" as ERank,
  Experienced: "ERank::Experienced" as ERank,
  Veteran: "ERank::Veteran" as ERank,
  Master: "ERank::Master" as ERank,
};

const detectors = [
  { sid: "Echo", chance: 1 },
  { sid: "Gilka", chance: 0.1 },
  { sid: "Bear", chance: 0.01 },
  { sid: "Veles", chance: 0.001 },
];

const artRanks = {
  12000: 1,
  20000: 0.1,
  36000: 0.01,
  70000: 0.001,
  80000: 0.0001,
};

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
    chance: ((n) => {
      for (const rank in artRanks) {
        if (n <= Number(rank)) {
          return artRanks[rank];
        }
      }
    })(a.Cost),
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
      Weight: detectors[i].chance,
    });
  }
  return new Struct({
    __internal__: { isRoot: true, rawName: sid },
    SID: sid,
    ItemGenerator: new Struct({
      0: new Struct({
        Category: "EItemGenerationCategory::Junk" satisfies EItemGenerationCategory,
        PossibleItems: new Struct(possibleItems),
        bAllowSameCategoryGeneration: true,
      }),
    }),
  }) as ItemGeneratorPrototype;
}

function buildArtifactSubGen(rank: Rank): ItemGeneratorPrototype {
  const idx = rankIndex(rank);
  const sid = `RareNPCDrops_Artifacts_${rank}_SubItemGenerator`;
  const arts = artifactQuarters[idx];
  const possibleItems = new Struct();
  for (let i = 0; i < arts.length; i++) {
    possibleItems.addNode({
      ItemPrototypeSID: arts[i].sid,
      Weight: arts[i].chance,
    });
  }
  return new Struct({
    __internal__: { isRoot: true, rawName: sid },
    SID: sid,
    ItemGenerator: {
      0: {
        Category: "EItemGenerationCategory::Junk" satisfies EItemGenerationCategory,
        PossibleItems: possibleItems,
        bAllowSameCategoryGeneration: true,
      },
    },
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
