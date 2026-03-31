import { Struct } from "s2cfgtojson";
import type { ItemGeneratorPrototype } from "s2cfgtojson";
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
const DETECTORS_SUB_GEN_SID = "RareNPCDrops_Detectors_SubItemGenerator";
const ARTIFACTS_SUB_GEN_SID = "RareNPCDrops_Artifacts_SubItemGenerator";

const detectors = [
  { sid: "Echo", chance: Math.min(1, 0.01 / SUB_GEN_CHANCE) },
  { sid: "Gilka", chance: Math.min(1, 0.0001 / SUB_GEN_CHANCE) },
  { sid: "Bear", chance: Math.min(1, 0.000001 / SUB_GEN_CHANCE) },
  { sid: "Veles", chance: Math.min(1, 0.00000001 / SUB_GEN_CHANCE) },
];

const artifactDrops = allDefaultArtifactPrototypes
  .filter((a) => {
    const sid = a.SID;
    return sid && a.Cost && !sid.includes("_Fake") && !sid.startsWith("Template") && !sid.startsWith("AA") && !sid.startsWith("PQuest") && !sid.startsWith("CProlog");
  })
  .map((a) => ({
    sid: a.SID,
    chance: precision(Math.min(1, BASE_ARTIFACT_CHANCE / Math.pow(10, Math.log2(a.Cost / BASE_COST)) / SUB_GEN_CHANCE), 1e6),
  }));

function buildDetectorEntries() {
  return detectors
    .map(
      (d, i) => `
            [${i}] : struct.begin
               ItemPrototypeSID = ${d.sid}
               Chance = ${d.chance}
               Weight = 1
               MinCount = 1
            struct.end`,
    )
    .join("\n");
}

function buildArtifactEntries() {
  return artifactDrops
    .map(
      (a, i) => `
            [${i}] : struct.begin
               ItemPrototypeSID = ${a.sid}
               Chance = ${a.chance}
               Weight = 1
               MinCount = 1
               MaxCount = 1
            struct.end`,
    )
    .join("\n");
}

const detectorSubGenCfg = `${DETECTORS_SUB_GEN_SID} : struct.begin
   SID = ${DETECTORS_SUB_GEN_SID}
   ItemGenerator : struct.begin
      RareDetectorDrop : struct.begin
         Category = EItemGenerationCategory::Detector
         PossibleItems : struct.begin${buildDetectorEntries()}
         struct.end
      struct.end
   struct.end
struct.end`;

const artifactSubGenCfg = `${ARTIFACTS_SUB_GEN_SID} : struct.begin
   SID = ${ARTIFACTS_SUB_GEN_SID}
   ItemGenerator : struct.begin
      RareArtifactDrop : struct.begin
         Category = EItemGenerationCategory::Artifact
         PossibleItems : struct.begin${buildArtifactEntries()}
         struct.end
      struct.end
   struct.end
struct.end`;

const detectorSubGenStruct = Struct.fromString<ItemGeneratorPrototype>(detectorSubGenCfg)[0];
const artifactSubGenStruct = Struct.fromString<ItemGeneratorPrototype>(artifactSubGenCfg)[0];

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

let emittedSubGen = false;

export const transformItemGenerators: StructTransformer<ItemGeneratorPrototype> = (struct) => {
  if (!shouldProcessStruct(struct)) return;

  const cfg = `${struct.SID} : struct.begin {bpatch}
   ItemGenerator : struct.begin {bpatch}
      RareNPCDrops_Detectors : struct.begin
         Category = EItemGenerationCategory::SubItemGenerator
         PossibleItems : struct.begin
            [0] : struct.begin
               ItemGeneratorPrototypeSID = ${DETECTORS_SUB_GEN_SID}
               Chance = ${SUB_GEN_CHANCE}
            struct.end
         struct.end
      struct.end
      RareNPCDrops_Artifacts : struct.begin
         Category = EItemGenerationCategory::SubItemGenerator
         PossibleItems : struct.begin
            [0] : struct.begin
               ItemGeneratorPrototypeSID = ${ARTIFACTS_SUB_GEN_SID}
               Chance = ${SUB_GEN_CHANCE}
            struct.end
         struct.end
      struct.end
   struct.end
struct.end`;

  const result = Struct.fromString<ItemGeneratorPrototype>(cfg)[0];

  if (!emittedSubGen) {
    emittedSubGen = true;
    return [result, detectorSubGenStruct, artifactSubGenStruct];
  }

  return result;
};
transformItemGenerators.files = ["/DynamicItemGenerator.cfg"];
