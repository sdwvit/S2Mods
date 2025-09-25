import { ArmorPrototype, DynamicItemGenerator, ERank, GetStructType, Struct } from "s2cfgtojson";
import { Meta, WithSID } from "../../helpers/prepare-configs.mjs";

import { allDefaultArmorDefs, allExtraArmors, backfillArmorDef, extraArmorsByFaction, newArmors } from "./armors.util.mjs";
import path from "node:path";
import dotEnv from "dotenv";
import { deepMerge } from "../../helpers/deepMerge.mjs";
import { factions } from "./factions.mjs";
import { semiRandom } from "../../helpers/semi-random.mts";
import { adjustButDontDrop } from "./adjustButDontDrop.mjs";

dotEnv.config({ path: path.join(import.meta.dirname, "..", ".env") });
const oncePerFile = new Set<string>();

const get = (obj: any, path: `${string}.${string}` | string) => {
  return path.split(".").reduce((o, i) => (o || {})[i], obj);
};

/**
 * Adds armor that doesn't block head, but also removes any psy protection. Allows player to use helmets.
 */
const transformArmorPrototypes: Meta["entriesTransformer"] = (entries: ArmorPrototype["entries"], context) => {
  if (entries.SID.toLowerCase().includes("helmet") || bannedids.has(entries.SID)) {
    return null;
  }

  if (!oncePerFile.has(context.filePath)) {
    oncePerFile.add(context.filePath);
    allExtraArmors.forEach((descriptor) => {
      const original = descriptor.refkey;
      const newSID = descriptor.entries.SID;
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
        if (newArmors[newSID]) {
          backfillArmorDef(newArmor);
          const overrides = { ...newArmors[newSID] };
          if (overrides._extras?.keysForRemoval) {
            Object.keys(overrides._extras.keysForRemoval).forEach((p) => {
              const e = get(newArmor, p) || {};
              const key = Object.keys(e).find((k) => e[k] === overrides._extras.keysForRemoval[p]) || overrides._extras.keysForRemoval[p];
              delete e[key];
            });
            delete overrides._extras;
          }
          deepMerge(newArmor, overrides);
        } else {
          newArmor.entries.Invisible = true;
          newArmor.entries.ItemGridWidth = 1;
          newArmor.entries.ItemGridHeight = 1;
        }
        context.extraStructs.push(Struct.fromString(newArmor.toString())[0] as WithSID);
      }
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
    .forEach((itemGenerator, i) => {
      /**
       * Allows NPCs to drop armor and helmets.
       */
      // noinspection FallThroughInSwitchStatementJS
      switch (itemGenerator.entries?.Category) {
        case "EItemGenerationCategory::Head":
          itemGenerator.entries.PlayerRank = "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master" as ERank;
        case "EItemGenerationCategory::BodyArmor":
          {
            const options = Object.values(itemGenerator.entries.PossibleItems.entries).filter((pi) => pi.entries && allArmorAdjustedCost[pi.entries.ItemPrototypeSID]);
            if (!options.length) {
              return;
            }
            const weights = Object.fromEntries(
              options.map((pi) => {
                const key = pi.entries.ItemPrototypeSID;
                return [key, getChanceForSID(key)];
              }),
            );

            const droppableArmors = options.filter((pi) => !adjustButDontDrop.has(pi.entries.ItemPrototypeSID));
            const invisibleArmors = options.filter((pi) => adjustButDontDrop.has(pi.entries.ItemPrototypeSID));

            const faction = entries.SID.split("_").find((f) => factions[f.toLowerCase()]) || "neutral";
            const extraArmors = extraArmorsByFaction[factions[faction.toLowerCase()] as keyof typeof extraArmorsByFaction];
            extraArmors
              .filter((descriptor) => (descriptor.PlayerRank && itemGenerator.entries.PlayerRank ? descriptor.PlayerRank.split(",").some((r) => itemGenerator.entries.PlayerRank.includes(r)) : true))
              .forEach((descriptor) => {
                const originalSID = descriptor.refkey;
                const newArmorSID = descriptor.entries.SID as string;
                const dummyPossibleItem = new (Struct.createDynamicClass(newArmorSID))() as GetStructType<PossibleItem>;
                dummyPossibleItem.entries = { ItemPrototypeSID: newArmorSID } as GetStructType<PossibleItem>["entries"];
                weights[newArmorSID] = getChanceForSID(allArmorAdjustedCost[newArmorSID] ? newArmorSID : originalSID);
                const maybeNewArmor = newArmors[newArmorSID];

                if (
                  itemGenerator.entries?.Category === (maybeNewArmor?._extras?.ItemGenerator?.Category || "EItemGenerationCategory::BodyArmor") &&
                  (itemGenerator.entries.PlayerRank && maybeNewArmor?._extras?.ItemGenerator?.PlayerRank
                    ? maybeNewArmor._extras.ItemGenerator.PlayerRank.split(",").some((r) => itemGenerator.entries.PlayerRank.includes(r))
                    : true)
                ) {
                  let i = 0;
                  while (itemGenerator.entries.PossibleItems.entries[i]) {
                    i++;
                  }
                  itemGenerator.entries.PossibleItems.entries[i] = dummyPossibleItem as any;
                  if (maybeNewArmor) {
                    droppableArmors.push(dummyPossibleItem as any);
                  } else {
                    invisibleArmors.push(dummyPossibleItem as any);
                  }
                }
              });
            const maxAB = Math.max(0, ...droppableArmors.map((pi) => weights[pi.entries.ItemPrototypeSID]));

            const abSum = droppableArmors.reduce((acc, pi) => acc + weights[pi.entries.ItemPrototypeSID], 0);
            const cdSum = invisibleArmors.reduce((acc, pi) => acc + weights[pi.entries.ItemPrototypeSID], 0);

            const x = cdSum ? abSum / maxAB : abSum;
            const y = cdSum / (1 - maxAB);
            droppableArmors.forEach((pi) => {
              pi.entries.Chance = precision(weights[pi.entries.ItemPrototypeSID]);
              pi.entries.Weight = precision(weights[pi.entries.ItemPrototypeSID] / x);
              pi.entries.MinDurability = precision(semiRandom(i) * 0.1 + 0.01);
              pi.entries.MaxDurability = precision(pi.entries.MinDurability + (semiRandom(i) * weights[pi.entries.ItemPrototypeSID]) / 0.15);
            });
            invisibleArmors.forEach((pi) => {
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
        const SID = e.entries.SID;
        const refkey = e.refkey;
        const dummy = new (Struct.createDynamicClass(SID))() as ArmorPrototype & { entries: { SID: string } };
        dummy.entries = { SID } as any;
        dummy.refkey = refkey;

        return [SID, dummy] as [string, ArmorPrototype & { entries: { SID: string } }];
      }),
    ),
    ...newArmors,
  })
    .filter((armor) => !armor.entries.SID.includes("Template"))
    .map((armor) => {
      const backfilled = backfillArmorDef(JSON.parse(JSON.stringify(armor))) as ArmorPrototype & { entries: { SID: string } };
      return [armor.entries.SID, calculateArmorScore(backfilled)] as [string, number];
    })
    .sort((a, b) => a[0].localeCompare(b[0])),
);

const minimumArmorCost = Object.values(allArmorAdjustedCost).reduce((a, b) => Math.min(a, b), Infinity);
const maximumArmorCost = Object.values(allArmorAdjustedCost).reduce((a, b) => Math.max(a, b), -Infinity);

function getChanceForSID(sid: string) {
  const zeroToOne = 1 - (allArmorAdjustedCost[sid] - minimumArmorCost) / (maximumArmorCost - minimumArmorCost); // 1 means cheapest armor, 0 means most expensive armor
  return zeroToOne * 0.14 + 0.01; // 1% to 15%
}

export const meta: Meta = {
  interestingFiles: ["ArmorPrototypes.cfg", "DynamicItemGenerator.cfg"],
  description: `
    This mod adds armor that does not include helmets, forcing players to wear helmets to have adequate protection.[h2][/h2]
    It also adds corresponding helmets for exoskeleton and heavy armors, to balance things out.[h2][/h2]
    The armor has no psi and reduced radiation protection, you need to rely on helmets for that.[h2][/h2]
    NPCs can now drop armor and helmets, traders don't sell them.[h2][/h2]
    These are mostly post-SIRCAA armors and helmets. Thus you can't see them in the first half of the game[h2][/h2]
    The chance of NPCs dropping armor is based on the armor's overall effectiveness, with cheaper armors being more likely to drop.[h2][/h2]
    [h2][/h2]
    For your convenience, here is a set of console commands to spawn the new headless armors directly:[h2][/h2]
    [noparse]
    Armors:
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
    
    Helmets: 
    XSpawnItemNearPlayerBySID Exoskeleton_Neutral_Helmet_HeadlessArmors
    XSpawnItemNearPlayerBySID Exoskeleton_Mercenaries_Helmet_HeadlessArmors
    XSpawnItemNearPlayerBySID HeavyBattle_Merc_Helmet_HeadlessArmors
    XSpawnItemNearPlayerBySID Exoskeleton_Svoboda_Helmet_HeadlessArmors
    XSpawnItemNearPlayerBySID Exoskeleton_Duty_Helmet_HeadlessArmors
    XSpawnItemNearPlayerBySID HeavyBattle_Dolg_Helmet_HeadlessArmors
    XSpawnItemNearPlayerBySID Exoskeleton_Monolith_Helmet_HeadlessArmors
    XSpawnItemNearPlayerBySID Exoskeleton_Spark_Helmet_HeadlessArmors
    XSpawnItemNearPlayerBySID HeavyBattle_Spark_Helmet_HeadlessArmors
   [/noparse]
   [h2][/h2]
   Modified configs through refkeys: DynamicItemGenerator.cfg and ArmorPrototypes.cfg
  `,
  changenote: "Update for 1.6",
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
