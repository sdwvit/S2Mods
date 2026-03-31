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

const detectors = [
  { sid: "Echo", chance: 0.01 },
  { sid: "Gilka", chance: 0.0001 },
  { sid: "Bear", chance: 0.000001 },
  { sid: "Veles", chance: 0.00000001 },
];

const artifactDrops = allDefaultArtifactPrototypes
  .filter((a) => {
    const sid = a.SID;
    return sid && a.Cost && !sid.includes("_Fake") && !sid.startsWith("Template") && !sid.startsWith("AA") && !sid.startsWith("PQuest") && !sid.startsWith("CProlog");
  })
  .map((a) => ({
    sid: a.SID,
    chance: precision(BASE_ARTIFACT_CHANCE / Math.pow(10, Math.log2(a.Cost / BASE_COST)), 1e6),
  }));

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

function buildDetectorEntries() {
  return detectors
    .map(
      (d, i) => `
            [${i}] : struct.begin
               ItemPrototypeSID = ${d.sid}
               Chance = ${d.chance}
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
               MinCount = 1
               MaxCount = 1
            struct.end`,
    )
    .join("\n");
}

const detectorCfg = buildDetectorEntries();
const artifactCfg = buildArtifactEntries();

export const transformItemGenerators: StructTransformer<ItemGeneratorPrototype> = (struct) => {
  if (!shouldProcessStruct(struct)) return;

  const cfg = `${struct.SID} : struct.begin {bpatch}
   ItemGenerator : struct.begin {bpatch}
      RareDetectorDrop : struct.begin
         Category = EItemGenerationCategory::Detector
         PossibleItems : struct.begin${detectorCfg}
         struct.end
      struct.end
      RareArtifactDrop : struct.begin
         Category = EItemGenerationCategory::Artifact
         PossibleItems : struct.begin${artifactCfg}
         struct.end
      struct.end
   struct.end
struct.end`;

  return Struct.fromString<ItemGeneratorPrototype>(cfg)[0];
};
transformItemGenerators.files = ["/DynamicItemGenerator.cfg"];
