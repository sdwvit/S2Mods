import { ArmorPrototype } from "s2cfgtojson";
import { allDefaultArmorDefs } from "../../src/consts.mjs";

const maxDurability = Math.max(...Object.values(allDefaultArmorDefs).map((a) => a.BaseDurability ?? 0));
const minDurability = Math.min(...Object.values(allDefaultArmorDefs).map((a) => a.BaseDurability ?? 10000));
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

export function calculateArmorScore(armor: ArmorPrototype): number {
  const protectionScore = Object.keys(protectionScales).reduce((sum, key) => {
    const normalized = (protectionScales[key] * armor.Protection[key]) / protectionNormalization[key];
    return sum + normalized / 100;
  }, 0);
  const durabilityScore = ((armor.BaseDurability || minDurability) - minDurability) / (maxDurability - minDurability);
  const weightScore = Math.atan(10e10) - Math.atan((armor.Weight + 4.31) / 6.73);
  const blockHeadScore = armor.bBlockHead ? 1 : 0;
  const speedScore = armor.IncreaseSpeedCoef ?? 0; // always 1
  const noiseScore = armor.NoiseCoef ?? 0; // always 1
  const slotsScore =
    ((armor.ArtifactSlots ?? 0) +
      Object.values(armor.UpgradePrototypeSIDs || {})
        .filter((u) => typeof u === "string")
        .filter((u) => u.toLowerCase().includes("container") || u.toLowerCase().includes("_artifact")).length) /
    10; // 1 to 2
  const preventLimping =
    armor.bPreventFromLimping &&
    !Object.values(armor.UpgradePrototypeSIDs || {}).find((u) => typeof u === "string" && u.includes("AddRunEffect"))
      ? 0
      : 1;

  const costScore = Math.atan(10e10) - Math.atan((armor.Cost + 27025) / 42000);

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
