import { Entries, GetStructType } from "s2cfgtojson";

/**
 * Does not allow traders to sell gear.
 * Allows NPCs to drop armor.
 * @param entries
 * @param file
 */
export function transformDynamicItemGenerator(entries: DynamicItemGenerator["entries"], { file }: { file: string }) {
  if (!file.includes("DynamicItemGenerator.cfg")) {
    return entries;
  }

  if (entries.SID.includes("Trade")) {
    Object.values(entries.ItemGenerator.entries)
      .filter((e) => e.entries)
      .forEach((e) => {
        if (itemGenerationCategories.has(e.entries?.Category)) {
          e.entries = { ReputationThreshold: 1000000 } as typeof e.entries;
        } else {
          (e.entries as Entries) = {};
        }
      });
  } else {
    Object.values(entries.ItemGenerator.entries)
      .filter((e) => e.entries)
      .forEach((e) => {
        if (e.entries?.Category === "EItemGenerationCategory::BodyArmor") {
          Object.values(e.entries.PossibleItems.entries)
            .filter((pi) => pi.entries)
            .forEach((pi) => {
              if (!armorAliasMap[pi.entries.ItemPrototypeSID] && !allArmorCosts[pi.entries.ItemPrototypeSID]) {
                (pi.entries as Entries) = {};
                return;
              }
              pi.entries.Weight ||= 1;
              pi.entries.MinDurability = 0.01 + Math.random() * 0.04;
              if (allArmorCosts[pi.entries.ItemPrototypeSID]) {
                pi.entries.MaxDurability = pi.entries.MinDurability + 5000 / allArmorCosts[pi.entries.ItemPrototypeSID];
                pi.entries.Chance = 500 / allArmorCosts[pi.entries.ItemPrototypeSID];
              } else {
                console.warn(`Unknown armor cost for ${pi.entries.ItemPrototypeSID}, using fallback values.`);

                pi.entries.MaxDurability =
                  pi.entries.MinDurability + 5000 / allArmorCosts[armorAliasMap[pi.entries.ItemPrototypeSID]];
                pi.entries.Chance = 500 / allArmorCosts[armorAliasMap[pi.entries.ItemPrototypeSID]];
                pi.entries.ItemPrototypeSID ||= armorAliasMap[pi.entries.ItemPrototypeSID];
              }
              pi.entries.MinDurability = Math.round(pi.entries.MinDurability * 1e5) / 1e5;
              pi.entries.MaxDurability = Math.round(pi.entries.MaxDurability * 1e5) / 1e5;
              pi.entries.Chance = Math.round(pi.entries.Chance * 1e5) / 1e5;
            });
        } else {
          (e.entries as Entries) = {};
        }
      });
  }
  if (Object.values(entries.ItemGenerator.entries).every((e) => Object.keys(e.entries || {}).length === 0)) {
    return null;
  }
  return entries;
}
const itemGenerationCategories = new Set([
  "EItemGenerationCategory::WeaponPrimary",
  "EItemGenerationCategory::BodyArmor",
  "EItemGenerationCategory::Head",
  "EItemGenerationCategory::WeaponPistol",
  "EItemGenerationCategory::WeaponSecondary",
]);
export type DynamicItemGenerator = GetStructType<{
  SID: "GeneralNPC_Neutral_CloseCombat_ItemGenerator";
  ItemGenerator: {
    Category?: "EItemGenerationCategory::BodyArmor";
    ReputationThreshold?: number;
    PossibleItems?: {
      ItemPrototypeSID: "SEVA_Neutral_Armor";
      Weight: 4;
      MinDurability: number;
      MaxDurability: number;
      Chance: number;
    }[];
  }[];
}>;
export const allArmorCosts = {
  Jemmy_Neutral_Armor: 11600,
  Newbee_Neutral_Armor: 13500,
  Nasos_Neutral_Armor: 21700,
  Zorya_Neutral_Armor: 36000,
  SEVA_Neutral_Armor: 48000,
  Exoskeleton_Neutral_Armor: 65500,
  SkinJacket_Bandit_Armor: 17200,
  Jacket_Bandit_Armor: 17200,
  Middle_Bandit_Armor: 24000,
  Light_Mercenaries_Armor: 20200,
  Exoskeleton_Mercenaries_Armor: 63000,
  Heavy_Mercenaries_Armor: 42500,
  Default_Military_Armor: 14000,
  Heavy2_Military_Armor: 46000,
  Anomaly_Scientific_Armor: 39000,
  HeavyAnomaly_Scientific_Armor: 52000,
  SciSEVA_Scientific_Armor: 54000,
  Rook_Svoboda_Armor: 17100,
  Battle_Svoboda_Armor: 36000,
  SEVA_Svoboda_Armor: 53000,
  Heavy_Svoboda_Armor: 50000,
  HeavyExoskeleton_Svoboda_Armor: 68000,
  Exoskeleton_Svoboda_Armor: 95000,
  Rook_Dolg_Armor: 19100,
  Battle_Dolg_Armor: 36500,
  SEVA_Dolg_Armor: 46000,
  Heavy_Dolg_Armor: 46000,
  HeavyExoskeleton_Dolg_Armor: 63000,
  Exoskeleton_Dolg_Armor: 90000,
  Battle_Monolith_Armor: 51000,
  HeavyAnomaly_Monolith_Armor: 57500,
  HeavyExoskeleton_Monolith_Armor: 69000,
  Exoskeleton_Monolith_Armor: 68000,
  Battle_Varta_Armor: 37500,
  BattleExoskeleton_Varta_Armor: 62500,
  Battle_Spark_Armor: 41000,
  HeavyAnomaly_Spark_Armor: 42500,
  SEVA_Spark_Armor: 50000,
  HeavyBattle_Spark_Armor: 53500,
  Battle_Dolg_End_Armor: 80000,
  NPC_Sel_Armor: 3000,
  NPC_Sel_Neutral_Armor: 3000,
  NPC_Tec_Armor: 3000,
  NPC_Cloak_Heavy_Neutral_Armor: 30000,
  NPC_SkinCloak_Bandit_Armor: 17200,
  NPC_HeavyExoskeleton_Mercenaries_Armor: 63000,
  NPC_Heavy_Military_Armor: 30000,
  NPC_Cloak_Heavy_Military_Armor: 30000,
  NPC_Sci_Armor: 3250,
  NPC_Battle_Noon_Armor: 10000,
  NPC_HeavyAnomaly_Noon_Armor: 30000,
  NPC_HeavyExoskeleton_Noon_Armor: 90000,
  NPC_Exoskeleton_Noon_Armor: 100000,
  NPC_Spark_Armor: 2500,
  NPC_Anomaly_Spark_Armor: 2500,
  NPC_HeavyExoskeleton_Spark_Armor: 90000,
  NPC_Heavy_Corps_Armor: 31000,
  NPC_Heavy2_Coprs_Armor: 32000,
  NPC_Heavy3_Corps_Armor: 35000,
  NPC_Heavy3Exoskeleton_Coprs_Armor: 90000,
  NPC_Exoskeleton_Coprs_Armor: 85000,
  NPC_Richter_Armor: 3750,
  NPC_Korshunov_Armor: 25000,
  NPC_Korshunov_Armor_2: 130000,
  NPC_Dalin_Armor: 3750,
  NPC_Agata_Armor: 3750,
  NPC_Faust_Armor: 3750,
  NPC_Kaymanov_Armor: 3750,
  NPC_Shram_Armor: 40000,
  NPC_Dekhtyarev_Armor: 40000,
  NPC_Sidorovich_Armor: 3750,
  NPC_Barmen_Armor: 3750,
  NPC_Batya_Armor: 3750,
  NPC_Tyotya_Armor: 3750,
  Light_Duty_Helmet: 12300,
  Heavy_Duty_Helmet: 25800,
  Heavy_Svoboda_Helmet: 32600,
  Heavy_Varta_Helmet: 18000,
  Heavy_Military_Helmet: 36300,
  Light_Mercenaries_Helmet: 19800,
  Light_Military_Helmet: 16100,
  Battle_Military_Helmet: 24700,
  Light_Bandit_Helmet: 7500,
  Light_Neutral_Helmet: 10500,
};

export const armorAliasMap = {
  DutyArmor_3_U1: "Battle_Dolg_Armor",
  Exosekeleton_Neutral_Armor: "Exoskeleton_Neutral_Armor",
  Seva_Dolg_Armor: "SEVA_Dolg_Armor",
  Seva_Neutral_Armor: "SEVA_Neutral_Armor",
  Seva_Svoboda_Armor: "SEVA_Svoboda_Armor",
};
