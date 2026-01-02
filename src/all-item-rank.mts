import { allDefaultArmorPrototypesRecord, allDefaultNightVisionGogglesPrototypesRecord } from "./consts.mjs";
import { allExtraArmors, newArmors } from "./armors.util.mjs";
import { ArmorPrototype, Struct } from "s2cfgtojson";
import { backfillDef } from "./backfill-def.mts";
import { logger } from "./logger.mts";

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
  const speedScore = e.IncreaseSpeedCoef ?? 0; // always 1
  const noiseScore = e.NoiseCoef ?? 0; // always 1
  const slotsScore =
    ((e.ArtifactSlots ?? 0) +
      Object.values(e.UpgradePrototypeSIDs || {})
        .filter((u) => typeof u === "string")
        .filter((u) => u.toLowerCase().includes("container") || u.toLowerCase().includes("_artifact")).length) /
    10; // 1 to 2
  const preventLimping =
    e.bPreventFromLimping && !Object.values(e.UpgradePrototypeSIDs || {}).find((u) => typeof u === "string" && u.includes("AddRunEffect")) ? 0 : 1;

  let costScore = Math.atan(10e10) - Math.atan((e.Cost + 27025) / 42000);
  if (e.SID.includes("NVG_")) {
    costScore = 10 * (1 - costScore); // nvgs progress with price. easier to do than to parse active effects and compare those.
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
  const score = Object.keys(scoreKeys).reduce((sum, e) => sum + scoreKeys[e] * scoreScales[e], 0);
  return score / 100; // 0 to 1
}

export const allItemRank = Object.fromEntries(
  Object.values({
    ...allDefaultNightVisionGogglesPrototypesRecord,
    ...allDefaultArmorPrototypesRecord,
    ...Object.fromEntries(
      allExtraArmors.map((e) => {
        const SID = e.SID;
        const refkey = e.__internal__.refkey;
        const dummy = new Struct({ SID }) as ArmorPrototype;
        dummy.SID = SID;
        dummy.__internal__.refkey = refkey;

        return [SID, dummy] as [string, ArmorPrototype];
      }),
    ),
    ...newArmors,
  })
    .filter((armor) => !armor.SID.includes("Template"))
    .map((armor) => {
      const backfilled = backfillDef(
        armor as any,
        allDefaultArmorPrototypesRecord,
        armor.SID.toLowerCase().includes("helmet") ? "Heavy_Svoboda_Helmet" : undefined,
      );
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
