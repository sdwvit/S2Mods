import { allDefaultArmorPrototypesRecord, allDefaultNightVisionGogglesPrototypesRecord } from "../../src/consts.mts";
import { ArmorPrototype, Struct } from "s2cfgtojson";
import { backfillDef } from "../../src/backfill-def.mts";
import { logger } from "../../src/logger.mts";
import { getGdocsArmorData } from "./gdocs-armors.mts";

const maxDurability = Math.max(...Object.values(allDefaultArmorPrototypesRecord).map((a) => a.BaseDurability ?? 0));
const minDurability = Math.min(...Object.values(allDefaultArmorPrototypesRecord).map((a) => a.BaseDurability ?? 10000));

function calculateArmorScore(armor: ArmorPrototype): number {
  const e = armor;
  const protectionNormalization = {
    Burn: 100,
    Shock: 100,
    ChemicalBurn: 100,
    Radiation: 100,
    PSY: 100,
    Strike: 5,
    Fall: 100,
  };
  const protectionScales = { Burn: 5, Shock: 7, ChemicalBurn: 5, Radiation: 10, PSY: 10, Strike: 63, Fall: 1 };
  const protectionScore = Object.keys(protectionScales).reduce((sum, key) => {
    const normalized = (protectionScales[key] * (e.Protection?.[key] ?? 0)) / protectionNormalization[key];
    return sum + normalized / 100;
  }, 0);
  const durabilityScore = ((e.BaseDurability || minDurability) - minDurability) / (maxDurability - minDurability);
  const weightScore = Math.atan(10e10) - Math.atan(((e.Weight ?? 0) + 4.31) / 6.73);
  const blockHeadScore = e.bBlockHead ? 1 : 0;
  const speedScore = e.IncreaseSpeedCoef ?? 0;
  const noiseScore = e.NoiseCoef ?? 0;
  const slotsScore =
    ((e.ArtifactSlots ?? 0) +
      Object.values(e.UpgradePrototypeSIDs || {})
        .filter((u) => typeof u === "string")
        .filter((u) => u.toLowerCase().includes("container") || u.toLowerCase().includes("_artifact")).length) /
    10;
  const preventLimping =
    e.bPreventFromLimping && !Object.values(e.UpgradePrototypeSIDs || {}).find((u) => typeof u === "string" && u.includes("AddRunEffect")) ? 0 : 1;

  let costScore = Math.atan(10e10) - Math.atan((e.Cost + 27025) / 42000);
  if (e.SID.includes("NVG_")) {
    costScore = 10 * (1 - costScore);
  }
  const scoreScales = {
    costScore: 7.5,
    protectionScore: 50,
    durabilityScore: 7.5,
    weightScore: 5,
    slotsScore: 25,
    blockHeadScore: 2.5,
    preventLimping: 2.5,
    speedScore: 0,
    noiseScore: 0,
  };
  const scoreKeys = {
    costScore,
    protectionScore,
    durabilityScore,
    weightScore,
    slotsScore,
    blockHeadScore,
    preventLimping,
    speedScore,
    noiseScore,
  };
  const score = Object.keys(scoreKeys).reduce((sum, k) => sum + scoreKeys[k] * scoreScales[k], 0);
  return score / 100;
}

let allItemRankPromise: Promise<Record<string, number>> | null = null;

export async function getAllItemRank(): Promise<Record<string, number>> {
  if (!allItemRankPromise) {
    allItemRankPromise = buildAllItemRank();
  }
  return allItemRankPromise;
}

async function buildAllItemRank(): Promise<Record<string, number>> {
  const gdocs = await getGdocsArmorData();

  const sheetArmorPrototypes: Record<string, ArmorPrototype> = {};
  for (const descriptor of gdocs.descriptors) {
    const sid = descriptor.SID;
    sheetArmorPrototypes[sid] = new Struct({ SID: sid, __internal__: { refkey: descriptor.__internal__.refkey }, ...(gdocs.overrides[sid] || {}) }) as ArmorPrototype;
  }

  const backfillCache: Record<string, ArmorPrototype> = {};
  const allItems = Object.values({
    ...allDefaultNightVisionGogglesPrototypesRecord,
    ...allDefaultArmorPrototypesRecord,
    ...sheetArmorPrototypes,
  }).filter((armor) => !armor.SID.includes("Template"));

  return Object.fromEntries(
    allItems
      .map((armor) => {
        const backfilled = backfillDef(
          armor as any,
          { ...allDefaultArmorPrototypesRecord, ...sheetArmorPrototypes, ...backfillCache },
          armor.SID.toLowerCase().includes("helmet") ? "Heavy_Svoboda_Helmet" : undefined,
        );
        backfillCache[armor.SID] = backfilled;
        return [armor.SID, calculateArmorScore(backfilled)] as [string, number];
      })
      .filter((a) => {
        if (!a[1]) {
          logger.warn(`${a[0]} doesn't have a valid set of properties or was not backfilled. Score = '${a[1]}'`);
        }
        return !!a[1];
      })
      .sort((a, b) => a[0].localeCompare(b[0])),
  );
}
