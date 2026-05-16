import { allDefaultArmorPrototypesRecord } from "../../src/consts.mts";
import type { ArmorPrototype } from "s2cfgtojson";

const maxDurability = Math.max(
  ...Object.values(allDefaultArmorPrototypesRecord).map((a) => a.BaseDurability ?? 0),
);
const minDurability = Math.min(
  ...Object.values(allDefaultArmorPrototypesRecord).map((a) => a.BaseDurability ?? 10000),
);

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
  const protectionScales = {
    Burn: 5,
    Shock: 7,
    ChemicalBurn: 5,
    Radiation: 10,
    PSY: 10,
    Strike: 63,
    Fall: 1,
  };
  const protectionScore = Object.keys(protectionScales).reduce((sum, key) => {
    const normalized =
      (protectionScales[key] * (e.Protection?.[key] ?? 0)) / protectionNormalization[key];
    return sum + normalized / 100;
  }, 0);
  const durabilityScore =
    ((e.BaseDurability || minDurability) - minDurability) / (maxDurability - minDurability);
  const weightScore = Math.atan(10e10) - Math.atan(((e.Weight ?? 0) + 4.31) / 6.73);
  const blockHeadScore = e.bBlockHead ? 1 : 0;
  const speedScore = e.IncreaseSpeedCoef ?? 0;
  const noiseScore = e.NoiseCoef ?? 0;
  const slotsScore =
    ((e.ArtifactSlots ?? 0) +
      Object.values(e.UpgradePrototypeSIDs || {})
        .filter((u) => typeof u === "string")
        .filter(
          (u) => u.toLowerCase().includes("container") || u.toLowerCase().includes("_artifact"),
        ).length) /
    10;
  const preventLimping =
    e.bPreventFromLimping &&
    !Object.values(e.UpgradePrototypeSIDs || {}).find(
      (u) => typeof u === "string" && u.includes("AddRunEffect"),
    )
      ? 0
      : 1;

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

// 0.001% for diamond exo this % for bandit skin jacket
export const maxDropChance = 0.15;
const lowestPossibleScore = calculateArmorScore(
  allDefaultArmorPrototypesRecord.SkinJacket_Bandit_Armor,
);
const highestPossibleScore = calculateArmorScore(
  allDefaultArmorPrototypesRecord.BattleExoskeleton_Varta_Armor,
);

export function getDropChance(prototype: ArmorPrototype, maxChance = maxDropChance) {
  const score =
    (calculateArmorScore(prototype) - lowestPossibleScore) /
    (highestPossibleScore - lowestPossibleScore); // 1 means good, 0 means bad armor
  const normalScore = getNormalDistribution(score);
  const normalScaled =
    (normalScore - getNormalDistribution(1)) /
    (getNormalDistribution(0) - getNormalDistribution(1));
  return maxChance * normalScaled;
}

function getNormalDistribution(score: number, omegaSq = 0.5) {
  const pi = Math.PI;
  const mu = 0;

  const a = 1 / Math.sqrt(2 * pi * omegaSq);
  const b = Math.exp(-((score - mu) ** 2) / (2 * omegaSq));

  return a * b;
}
