import { ArmorPrototype, DynamicItemGenerator, Entries, ERank, GetStructType, Struct } from "s2cfgtojson";
import { Meta, WithSID } from "../../helpers/prepare-configs.mjs";

import { allDefaultArmorDefs, allExtraArmors, backfillArmorDef, extraArmorsByFaction, newHeadlessArmors } from "./armors.util.mjs";
import path from "node:path";
import dotEnv from "dotenv";
import { deepMerge } from "../../helpers/deepMerge.mjs";
import { factions } from "./factions.mjs";
import { semiRandom } from "../../helpers/semi-random.mts";

dotEnv.config({ path: path.join(import.meta.dirname, "..", ".env") });
const oncePerFile = new Set<string>();

/**
 * Adds armor that doesn't block head, but also removes any psy protection. Allows player to use helmets.
 */
const transformArmorPrototypes: Meta["entriesTransformer"] = (entries: ArmorPrototype["entries"], context) => {
  if (entries.SID.toLowerCase().includes("helmet") || bannedids.has(entries.SID)) {
    return null;
  }

  if (!oncePerFile.has(context.filePath)) {
    allExtraArmors.forEach(([original, newSID]) => {
      if (!context.structsById[original]) {
        return;
      }
      const armor = allDefaultArmorDefs[original];
      if (armor) {
        const newArmor = new (Struct.createDynamicClass(newSID))() as ArmorPrototype & WithSID;
        newArmor.entries = { SID: newSID } as ArmorPrototype["entries"];
        newArmor.refkey = original;
        newArmor.refurl = context.struct.refurl;
        if (!newArmor.refurl) {
          return;
        }
        newArmor._id = newSID;
        newArmor.isRoot = true;
        if (newHeadlessArmors[newSID]) {
          backfillArmorDef(newArmor);
          deepMerge(newArmor, newHeadlessArmors[newSID]);
          const keyToDelete = Object.keys(newArmor.entries.UpgradePrototypeSIDs.entries).find((e) => newArmor.entries.UpgradePrototypeSIDs.entries[e] === "FaustPsyResist_Quest_1_1");
          delete newArmor.entries.UpgradePrototypeSIDs.entries[keyToDelete];
          newArmor.entries.bBlockHead = false;
        } else {
          newArmor.entries.Invisible = true;
          newArmor.entries.ItemGridWidth = 1;
          newArmor.entries.ItemGridHeight = 1;
        }
        context.extraStructs.push(newArmor);
      }
      oncePerFile.add(context.filePath);
    });
  }

  return null;
};

const bannedids = new Set([
  "NPC_Richter_Armor",
  "NPC_Korshunov_Armor",
  "NPC_Korshunov_Armor_2",
  "NPC_Dalin_Armor",
  "NPC_Agata_Armor",
  "NPC_Faust_Armor",
  "NPC_Kaymanov_Armor",
  "NPC_Shram_Armor",
  "NPC_Dekhtyarev_Armor",
  "NPC_Sidorovich_Armor",
  "NPC_Barmen_Armor",
  "NPC_Batya_Armor",
  "NPC_Tyotya_Armor",
]);

const precision = (e: number) => Math.round(e * 1e3) / 1e3;

/**
 * Does not allow traders to sell gear.
 * Allows NPCs to drop armor.
 */
export const transformDynamicItemGenerator: Meta["entriesTransformer"] = (entries: DynamicItemGenerator["entries"]) => {
  if (entries.SID.includes("Trade")) {
    return;
  }

  let keepo = null;
  Object.values(entries.ItemGenerator.entries)
    .filter((e) => e.entries)
    .forEach((e, i) => {
      /**
       * Allows NPCs to drop armor and helmets.
       */
      // noinspection FallThroughInSwitchStatementJS
      switch (e.entries?.Category) {
        case "EItemGenerationCategory::Head":
          e.entries.PlayerRank = "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master" as ERank;
        case "EItemGenerationCategory::BodyArmor":
          {
            const options = Object.values(e.entries.PossibleItems.entries).filter((pi) => pi.entries && allArmorAdjustedCost[pi.entries.ItemPrototypeSID]);
            if (!options.length) {
              return;
            }
            const weights = Object.fromEntries(
              options.map((pi) => {
                const key = pi.entries.ItemPrototypeSID;
                return [key, getChanceForSID(key)];
              }),
            );

            const ab = options.filter((pi) => !adjustButDontDrop.has(pi.entries.ItemPrototypeSID));
            const cd = options.filter((pi) => adjustButDontDrop.has(pi.entries.ItemPrototypeSID));

            if (!cd.length && e.entries?.Category === "EItemGenerationCategory::BodyArmor") {
              const faction = entries.SID.split("_").find((f) => factions[f.toLowerCase()]);
              if (faction) {
                const extraArmors = extraArmorsByFaction[factions[faction.toLowerCase()]];
                extraArmors.forEach(([originalSID, newArmorSID]) => {
                  const dummyPossibleItem = new (Struct.createDynamicClass(newArmorSID))() as GetStructType<PossibleItem>;
                  dummyPossibleItem.entries = { ItemPrototypeSID: newArmorSID } as GetStructType<PossibleItem>["entries"];
                  weights[newArmorSID] = getChanceForSID(allArmorAdjustedCost[newArmorSID] ? newArmorSID : originalSID);
                  let i = 0;
                  while (e.entries.PossibleItems.entries[i]) {
                    i++;
                  }
                  e.entries.PossibleItems.entries[i] = dummyPossibleItem;
                  if (newHeadlessArmors[newArmorSID]) {
                    ab.push(dummyPossibleItem);
                  } else {
                    cd.push(dummyPossibleItem);
                  }
                });
              }
            }

            const maxAB = Math.max(0, ...ab.map((pi) => weights[pi.entries.ItemPrototypeSID]));

            const abSum = ab.reduce((acc, pi) => acc + weights[pi.entries.ItemPrototypeSID], 0);
            const cdSum = cd.reduce((acc, pi) => acc + weights[pi.entries.ItemPrototypeSID], 0);

            const x = cdSum ? abSum / maxAB : abSum;
            const y = cdSum / (1 - maxAB);
            if (!ab.length && !cd.length) {
              return;
            }
            ab.forEach((pi) => {
              pi.entries.Chance = precision(weights[pi.entries.ItemPrototypeSID]);
              pi.entries.Weight = precision(weights[pi.entries.ItemPrototypeSID] / x);
              pi.entries.MinDurability = precision(semiRandom(i) * 0.04 + 0.01);
              pi.entries.MaxDurability = precision(pi.entries.MinDurability + weights[pi.entries.ItemPrototypeSID] * 0.5);
            });
            cd.forEach((pi) => {
              pi.entries.Chance = 1; // make sure it always spawns on npc
              pi.entries.Weight = precision(weights[pi.entries.ItemPrototypeSID] / y);
            });
            keepo = entries;
          }
          break;

        case "EItemGenerationCategory::SubItemGenerator":
          break;
        default:
          break;
      }
    });

  if (
    Object.values(entries.ItemGenerator.entries).every(
      (e) =>
        Object.keys(e.entries || {}).length === 0 ||
        Object.values(e.entries.PossibleItems.entries)
          .filter((k) => k.entries)
          .every((k) => k.entries.ItemPrototypeSID === "empty"),
    )
  ) {
    return null;
  }
  return keepo;
};

type PossibleItem = {
  ItemGeneratorPrototypeSID?: string;
  ItemPrototypeSID: string;
  Weight: number;
  MinDurability: number;
  MaxDurability: number;
  Chance: number;
  AmmoMinCount?: number;
  AmmoMaxCount?: number;
};

function calculateArmorScore(armor: ArmorPrototype): number {
  const e = armor.entries;
  const protectionNormalization = { Burn: 100, Shock: 100, ChemicalBurn: 100, Radiation: 100, PSY: 100, Strike: 5, Fall: 100 };
  const protectionScales = { Burn: 5, Shock: 7, ChemicalBurn: 5, Radiation: 10, PSY: 10, Strike: 63, Fall: 1 };
  const protectionScore = Object.keys(protectionScales).reduce((sum, key) => {
    const normalized = (protectionScales[key] * e.Protection.entries[key]) / protectionNormalization[key];
    return sum + normalized / 100;
  }, 0);
  const durabilityScore = ((e.BaseDurability || minDurability) - minDurability) / (maxDurability - minDurability);
  const weightScore = Math.atan(10e10) - Math.atan((e.Weight + 4.31) / 6.73);
  const blockHeadScore = e.bBlockHead ? 1 : 0;
  const speedScore = e.IncreaseSpeedCoef ?? 0; // always 1
  const noiseScore = e.NoiseCoef ?? 0; // always 1
  const slotsScore =
    ((e.ArtifactSlots ?? 0) +
      Object.values(e.UpgradePrototypeSIDs?.entries || {})
        .filter((u) => typeof u === "string")
        .filter((u) => u.toLowerCase().includes("container") || u.toLowerCase().includes("_artifact")).length) /
    10; // 1 to 2
  const preventLimping = e.bPreventFromLimping && !Object.values(e.UpgradePrototypeSIDs?.entries || {}).find((u) => typeof u === "string" && u.includes("AddRunEffect")) ? 0 : 1;

  const costScore = Math.atan(10e10) - Math.atan((e.Cost + 27025) / 42000);
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
  const scoreKeys = { costScore, protectionScore, durabilityScore, weightScore, slotsScore, blockHeadScore, preventLimping, speedScore, noiseScore };
  const score = Object.keys(scoreKeys).reduce((sum, e) => sum + scoreKeys[e] * scoreScales[e], 0);
  return score / 100; // 0 to 1
}

const maxDurability = Math.max(...Object.values(allDefaultArmorDefs).map((a) => a.entries.BaseDurability ?? 0));
const minDurability = Math.min(...Object.values(allDefaultArmorDefs).map((a) => a.entries.BaseDurability ?? 10000));

export const allArmorAdjustedCost = Object.fromEntries(
  Object.values({
    ...allDefaultArmorDefs,
    ...Object.fromEntries(
      allExtraArmors.map((e) => {
        const dummy = new (Struct.createDynamicClass(e[1]))() as ArmorPrototype & { entries: { SID: string } };
        dummy.entries = { SID: e[1] } as any;
        dummy.refkey = e[0];

        return [e[1], dummy];
      }),
    ),
    ...newHeadlessArmors,
  })
    .filter((armor) => !armor.entries.SID.includes("Template"))
    .map((armor) => {
      const backfilled = backfillArmorDef({ ...armor });
      return [armor.entries.SID, calculateArmorScore(backfilled)] as [string, number];
    })
    .sort((a, b) => a[0].localeCompare(b[0])),
);

const minimumArmorCost = Object.values(allArmorAdjustedCost).reduce((a, b) => Math.min(a, b), Infinity);
const maximumArmorCost = Object.values(allArmorAdjustedCost).reduce((a, b) => Math.max(a, b), -Infinity);

const adjustButDontDrop = new Set([
  "NPC_Sel_Armor",
  "NPC_Sel_Neutral_Armor",
  "NPC_Tec_Armor",
  "NPC_Cloak_Heavy_Neutral_Armor",
  "NPC_SkinCloak_Bandit_Armor",
  "NPC_HeavyExoskeleton_Mercenaries_Armor",
  "NPC_Heavy_Military_Armor",
  "NPC_Cloak_Heavy_Military_Armor",
  "NPC_Sci_Armor",
  "NPC_Battle_Noon_Armor",
  "NPC_HeavyAnomaly_Noon_Armor",
  "NPC_HeavyExoskeleton_Noon_Armor",
  "NPC_Exoskeleton_Noon_Armor",
  "NPC_Spark_Armor",
  "NPC_Anomaly_Spark_Armor",
  "NPC_HeavyExoskeleton_Spark_Armor",
  "NPC_Heavy_Corps_Armor",
  "NPC_Heavy2_Coprs_Armor",
  "NPC_Heavy3_Corps_Armor",
  "NPC_Heavy3Exoskeleton_Coprs_Armor",
  "NPC_Exoskeleton_Coprs_Armor",
  "NPC_Richter_Armor",
  "NPC_Korshunov_Armor",
  "NPC_Korshunov_Armor_2",
  "NPC_Dalin_Armor",
  "NPC_Agata_Armor",
  "NPC_Faust_Armor",
  "NPC_Kaymanov_Armor",
  "NPC_Shram_Armor",
  "NPC_Dekhtyarev_Armor",
  "NPC_Sidorovich_Armor",
  "NPC_Barmen_Armor",
  "NPC_Batya_Armor",
  "NPC_Tyotya_Armor",
]);

function getChanceForSID(sid: string) {
  const zeroToOne = 1 - (allArmorAdjustedCost[sid] - minimumArmorCost) / (maximumArmorCost - minimumArmorCost); // 1 means cheapest armor, 0 means most expensive armor
  return zeroToOne * 0.14 + 0.01; // 1% to 15%
}

export const meta: Meta = {
  onFinish(): void {},
  interestingFiles: ["ArmorPrototypes.cfg", "DynamicItemGenerator.cfg"],
  interestingContents: [],
  description: `
    This mod adds armor that does not include helmets, forcing players to wear helmets to have adequate protection. The armor has no psi protection, so players will need to rely on helmets for that.

    NPCs can now drop armor and helmets, but traders will not sell them. The chance of NPCs dropping armor is based on the armor's overall effectiveness, with cheaper armors being more likely to drop.

    For your convenience, here is a set of console commands to spawn the new headless armors directly:
  
    [noparse]
    XSpawnItemNearPlayerBySID BattleExoskeleton_Varta_Armor_HeadlessArmors_headless
    XSpawnItemNearPlayerBySID Exoskeleton_Mercenaries_Armor_HeadlessArmors_headless
    XSpawnItemNearPlayerBySID Exoskeleton_Monolith_Armor_HeadlessArmors_headless
    XSpawnItemNearPlayerBySID Exoskeleton_Neutral_Armor_HeadlessArmors_headless
    XSpawnItemNearPlayerBySID Exoskeleton_Svoboda_Armor_HeadlessArmors_headless
    XSpawnItemNearPlayerBySID Heavy_Dolg_Armor_HeadlessArmors_headless
    XSpawnItemNearPlayerBySID Heavy2_Military_Armor_HeadlessArmors_headless
    XSpawnItemNearPlayerBySID HeavyAnomaly_Monolith_Armor_HeadlessArmors_headless
    XSpawnItemNearPlayerBySID Exoskeleton_Dolg_Armor_HeadlessArmors_headless
    XSpawnItemNearPlayerBySID Heavy_Svoboda_Armor_HeadlessArmors_headless
    XSpawnItemNearPlayerBySID Heavy_Mercenaries_Armor_HeadlessArmors_headless
    XSpawnItemNearPlayerBySID HeavyBattle_Spark_Armor_HeadlessArmors_headless
    XSpawnItemNearPlayerBySID HeavyExoskeleton_Dolg_Armor_HeadlessArmors_headless
    XSpawnItemNearPlayerBySID NPC_HeavyExoskeleton_Mercenaries_Armor_HeadlessArmors_headless
    XSpawnItemNearPlayerBySID HeavyExoskeleton_Monolith_Armor_HeadlessArmors_headless
    XSpawnItemNearPlayerBySID HeavyExoskeleton_Svoboda_Armor_HeadlessArmors_headless
    XSpawnItemNearPlayerBySID HeavyExoskeleton_Varta_Armor_HeadlessArmors_headless
   [/noparse]
  `,
  changenote: "",
  entriesTransformer: (entries, context) => {
    if (context.filePath.endsWith("ArmorPrototypes.cfg")) {
      return transformArmorPrototypes(entries as ArmorPrototype["entries"], context);
    }
    if (context.filePath.endsWith("DynamicItemGenerator.cfg")) {
      return transformDynamicItemGenerator(entries as DynamicItemGenerator["entries"], context);
    }
    return null;
  },
};
