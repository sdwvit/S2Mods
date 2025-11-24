import { EItemGenerationCategory, ERank } from "s2cfgtojson";
import dotEnv from "dotenv";
import path from "node:path";
import { backfillArmorDef } from "./backfillArmorDef.mjs";
import { ALL_RANK, MASTER_RANK, VETERAN_MASTER_RANK } from "./addMissingCategories.mjs";
import { allDefaultArmorDefs, allDefaultDroppableArmorsByFaction, ArmorDescriptor } from "../../src/consts.mjs";

dotEnv.config({ path: path.join(import.meta.dirname, "..", ".env") });

const getHeadlessArmorCommonProps = (refkey: string) => ({
  __internal__: {
    refkey,
    _extras: {
      isDroppable: true,
      keysForRemoval: {
        UpgradePrototypeSIDs: backfillArmorDef(allDefaultArmorDefs[refkey])
          .UpgradePrototypeSIDs.entries()
          .map(([_, k]) => k)
          .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
      },
      ItemGenerator: {
        Category: "EItemGenerationCategory::BodyArmor" as EItemGenerationCategory,
        PlayerRank: VETERAN_MASTER_RANK as ERank,
      },
    },
  },
  SID: `${refkey}_HeadlessArmors_headless`,
  LocalizationSID: refkey,
  bBlockHead: false,
  Protection: { PSY: 0 },
  Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_${refkey}_headless.T_IFI_${refkey}_headless'`,
});

const getHelmetInternal = (refkey: string) => ({
  refkey,
  _extras: {
    isDroppable: true,
    ItemGenerator: {
      Category: "EItemGenerationCategory::Head" as EItemGenerationCategory,
      PlayerRank: VETERAN_MASTER_RANK as ERank,
    },
  },
});
const ICON_ROOT = "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_";

export const newArmors = {
  BattleExoskeleton_Varta_Armor_HeadlessArmors_headless: {
    ...getHeadlessArmorCommonProps("BattleExoskeleton_Varta_Armor"),
    Weight: 8.5,
    Cost: 58000,
  },
  Exoskeleton_Mercenaries_Armor_HeadlessArmors_headless: {
    ...getHeadlessArmorCommonProps("Exoskeleton_Mercenaries_Armor"),
    Weight: 7.5,
    Cost: 50500,
  },
  Exoskeleton_Monolith_Armor_HeadlessArmors_headless: {
    ...getHeadlessArmorCommonProps("Exoskeleton_Monolith_Armor"),
    Weight: 7.5,
    Cost: 53000,
  },
  Exoskeleton_Neutral_Armor_HeadlessArmors_headless: {
    ...getHeadlessArmorCommonProps("Exoskeleton_Neutral_Armor"),
    Weight: 12,
    Cost: 55500,
  },
  Exoskeleton_Svoboda_Armor_HeadlessArmors_headless: {
    ...getHeadlessArmorCommonProps("Exoskeleton_Svoboda_Armor"),
    Weight: 7.5,
    Cost: 80000,
  },
  Heavy_Dolg_Armor_HeadlessArmors_headless: {
    ...getHeadlessArmorCommonProps("Heavy_Dolg_Armor"),
    Weight: 7,
    Cost: 35000,
  },
  Heavy2_Military_Armor_HeadlessArmors_headless: {
    ...getHeadlessArmorCommonProps("Heavy2_Military_Armor"),
    Weight: 6,
    Cost: 32000,
  },
  HeavyAnomaly_Monolith_Armor_HeadlessArmors_headless: {
    ...getHeadlessArmorCommonProps("HeavyAnomaly_Monolith_Armor"),
    Weight: 7,
    Cost: 42500,
  },
  Exoskeleton_Dolg_Armor_HeadlessArmors_headless: {
    ...getHeadlessArmorCommonProps("Exoskeleton_Dolg_Armor"),
    Weight: 8.5,
    Cost: 70000,
  },
  Heavy_Svoboda_Armor_HeadlessArmors_headless: {
    ...getHeadlessArmorCommonProps("Heavy_Svoboda_Armor"),
    Weight: 7,
    Cost: 37000,
  },
  Heavy_Mercenaries_Armor_HeadlessArmors_headless: {
    ...getHeadlessArmorCommonProps("Heavy_Mercenaries_Armor"),
    Weight: 5,
    Cost: 25500,
  },
  HeavyBattle_Spark_Armor_HeadlessArmors_headless: {
    ...getHeadlessArmorCommonProps("HeavyBattle_Spark_Armor"),
    Weight: 7,
    Cost: 40500,
  },
  HeavyExoskeleton_Dolg_Armor_HeadlessArmors_headless: {
    ...getHeadlessArmorCommonProps("HeavyExoskeleton_Dolg_Armor"),
    Weight: 16,
    Cost: 51000,
  },
  HeavyExoskeleton_Monolith_Armor_HeadlessArmors_headless: {
    ...getHeadlessArmorCommonProps("HeavyExoskeleton_Monolith_Armor"),
    Weight: 16,
    Cost: 55000,
  },
  HeavyExoskeleton_Svoboda_Armor_HeadlessArmors_headless: {
    ...getHeadlessArmorCommonProps("HeavyExoskeleton_Svoboda_Armor"),
    Weight: 16,
    Cost: 50000,
  },
  HeavyExoskeleton_Varta_Armor_HeadlessArmors_headless: {
    ...getHeadlessArmorCommonProps("BattleExoskeleton_Varta_Armor"),
    Weight: 12,
    Cost: 45500,
  },
  Battle_Dolg_End_Armor_HeadlessArmors_headless: {
    ...getHeadlessArmorCommonProps("Battle_Dolg_End_Armor"),
    Cost: 70000,
  },

  Exoskeleton_Mercenaries_Helmet_HeadlessArmors: {
    __internal__: getHelmetInternal("Heavy_Svoboda_Helmet"),
    SID: `Exoskeleton_Mercenaries_Helmet_HeadlessArmors`,
    LocalizationSID: "Exoskeleton_Mercenaries_Armor",
    Icon: `${ICON_ROOT}Exoskeleton_Merc_Helmet.T_IFI_Exoskeleton_Merc_Helmet'`,
    Weight: 5,
    Cost: 45000,
    Protection: { Radiation: 40, PSY: 20, Strike: 4 },
  },
  Exoskeleton_Monolith_Helmet_HeadlessArmors: {
    __internal__: getHelmetInternal("Heavy_Svoboda_Helmet"),
    SID: `Exoskeleton_Monolith_Helmet_HeadlessArmors`,
    LocalizationSID: "Exoskeleton_Monolith_Armor",
    Icon: `${ICON_ROOT}Exoskeleton_Monolith_Helmet.T_IFI_Exoskeleton_Monolith_Helmet'`,
    Weight: 5,
    Cost: 45000,
    Protection: { Radiation: 50, PSY: 20, Strike: 4 },
  },
  Exoskeleton_Neutral_Helmet_HeadlessArmors: {
    __internal__: getHelmetInternal("Heavy_Svoboda_Helmet"),
    SID: `Exoskeleton_Neutral_Helmet_HeadlessArmors`,
    LocalizationSID: "Exoskeleton_Neutral_Armor",
    Icon: `${ICON_ROOT}Exoskeleton_Neutral_Helmet.T_IFI_Exoskeleton_Neutral_Helmet'`,
    Weight: 5,
    Cost: 40000,
    Protection: { Radiation: 40, PSY: 50, Strike: 4 },
  },
  Exoskeleton_Spark_Helmet_HeadlessArmors: {
    __internal__: getHelmetInternal("Heavy_Svoboda_Helmet"),
    SID: `Exoskeleton_Spark_Helmet_HeadlessArmors`,
    LocalizationSID: "HeavyBattle_Spark_Armor",
    Icon: `${ICON_ROOT}Exoskeleton_Spark_Helmet.T_IFI_Exoskeleton_Spark_Helmet'`,
    Weight: 5,
    Cost: 40000,
    Protection: { Radiation: 35, PSY: 40, Strike: 4 },
  },
  Exoskeleton_Duty_Helmet_HeadlessArmors: {
    __internal__: getHelmetInternal("Heavy_Svoboda_Helmet"),
    SID: `Exoskeleton_Duty_Helmet_HeadlessArmors`,
    LocalizationSID: "HeavyExoskeleton_Dolg_Armor",
    Icon: `${ICON_ROOT}Exoskeleton_Duty_Helmet.T_IFI_Exoskeleton_Duty_Helmet'`,
    Weight: 5,
    Cost: 40000,
    Protection: { Radiation: 40, PSY: 20, Strike: 4 },
  },
  Exoskeleton_Svoboda_Helmet_HeadlessArmors: {
    __internal__: getHelmetInternal("Heavy_Svoboda_Helmet"),
    SID: `Exoskeleton_Svoboda_Helmet_HeadlessArmors`,
    LocalizationSID: "Heavy_Svoboda_Helmet",
    Icon: `${ICON_ROOT}Exoskeleton_Svoboda_Helmet.T_IFI_Exoskeleton_Svoboda_Helmet'`,
    Weight: 5,
    Cost: 40000,
    Protection: { Radiation: 45, PSY: 40, Strike: 4 },
  },
  HeavyBattle_Spark_Helmet_HeadlessArmors: {
    __internal__: getHelmetInternal("Battle_Military_Helmet"),
    SID: `HeavyBattle_Spark_Helmet_HeadlessArmors`,
    LocalizationSID: "Battle_Military_Helmet",
    Icon: `${ICON_ROOT}HeavyBattle_Spark_Helmet.T_IFI_HeavyBattle_Spark_Helmet'`,
  },
  HeavyBattle_Merc_Helmet_HeadlessArmors: {
    __internal__: getHelmetInternal("Battle_Military_Helmet"),
    SID: `HeavyBattle_Merc_Helmet_HeadlessArmors`,
    LocalizationSID: "Battle_Military_Helmet",
    Icon: `${ICON_ROOT}HeavyBattle_Merc_Helmet.T_IFI_HeavyBattle_Merc_Helmet'`,
  },
  HeavyBattle_Dolg_Helmet_HeadlessArmors: {
    __internal__: getHelmetInternal("Battle_Military_Helmet"),
    SID: `HeavyBattle_Dolg_Helmet_HeadlessArmors`,
    LocalizationSID: "Battle_Military_Helmet",
    Icon: `${ICON_ROOT}HeavyBattle_Dolg_Helmet.T_IFI_HeavyBattle_Dolg_Helmet'`,
  },
  SkinCloak_Bandit_Armor_HeadlessArmors: {
    __internal__: {
      refkey: "SkinJacket_Bandit_Armor",
      _extras: {
        isDroppable: false,
        ItemGenerator: {
          Category: "EItemGenerationCategory::BodyArmor" as EItemGenerationCategory,
          PlayerRank: ALL_RANK as ERank,
        },
      },
    },
    SID: `SkinCloak_Bandit_Armor_HeadlessArmors`,
    LocalizationSID: "SkinJacket_Bandit_Armor",
    bBlockHead: true,
  },
  SkinCloak_Bandit_Armor2_HeadlessArmors_headless: {
    __internal__: {
      refkey: "SkinJacket_Bandit_Armor",
      _extras: {
        isDroppable: false,
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs["SkinJacket_Bandit_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: {
          Category: "EItemGenerationCategory::BodyArmor" as EItemGenerationCategory,
          PlayerRank: ALL_RANK,
        },
      },
    },
    SID: `SkinCloak_Bandit_Armor2_HeadlessArmors_headless`,
    LocalizationSID: "SkinJacket_Bandit_Armor",
  },
};

const getNPCArmorDescriptor = (refkey: string, playerRanks: ERank) => ({
  __internal__: {
    refkey,
    _extras: {
      isDroppable: false,
      ItemGenerator: {
        Category: "EItemGenerationCategory::BodyArmor" as EItemGenerationCategory,
        PlayerRank: playerRanks,
      },
    },
  },
  SID: `${refkey}_HeadlessArmors_NPC`,
});

export const extraArmorsByFaction: {
  bandit: ArmorDescriptor[];
  corpus: ArmorDescriptor[];
  duty: ArmorDescriptor[];
  freedom: ArmorDescriptor[];
  mercenary: ArmorDescriptor[];
  military: ArmorDescriptor[];
  monolith: ArmorDescriptor[];
  neutral: ArmorDescriptor[];
  scientist: ArmorDescriptor[];
  spark: ArmorDescriptor[];
  varta: ArmorDescriptor[];
} = {
  bandit: [newArmors.SkinCloak_Bandit_Armor_HeadlessArmors, newArmors.SkinCloak_Bandit_Armor2_HeadlessArmors_headless],
  corpus: [
    getNPCArmorDescriptor("NPC_Heavy_Corps_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_Heavy3_Corps_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_Heavy2_Coprs_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_Heavy3Exoskeleton_Coprs_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_Exoskeleton_Coprs_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("Battle_Dolg_End_Armor", MASTER_RANK),
  ],
  duty: [
    newArmors.Exoskeleton_Dolg_Armor_HeadlessArmors_headless,
    newArmors.HeavyExoskeleton_Dolg_Armor_HeadlessArmors_headless,
    newArmors.Heavy_Dolg_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Duty_Helmet_HeadlessArmors,
    newArmors.HeavyBattle_Dolg_Helmet_HeadlessArmors,
    newArmors.Battle_Dolg_End_Armor_HeadlessArmors_headless,
  ],
  freedom: [
    newArmors.Exoskeleton_Svoboda_Armor_HeadlessArmors_headless,
    newArmors.HeavyExoskeleton_Svoboda_Armor_HeadlessArmors_headless,
    newArmors.Heavy_Svoboda_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Svoboda_Helmet_HeadlessArmors,
  ],
  mercenary: [
    getNPCArmorDescriptor("NPC_HeavyExoskeleton_Mercenaries_Armor", MASTER_RANK),
    newArmors.Heavy_Mercenaries_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Mercenaries_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Mercenaries_Helmet_HeadlessArmors,
    newArmors.HeavyBattle_Merc_Helmet_HeadlessArmors,
  ],
  military: [
    getNPCArmorDescriptor("NPC_Heavy_Military_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_Cloak_Heavy_Military_Armor", VETERAN_MASTER_RANK),
    newArmors.Heavy2_Military_Armor_HeadlessArmors_headless,
  ],
  monolith: [
    getNPCArmorDescriptor("NPC_Battle_Noon_Armor", ALL_RANK),
    getNPCArmorDescriptor("NPC_HeavyAnomaly_Noon_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_HeavyExoskeleton_Noon_Armor", MASTER_RANK),
    getNPCArmorDescriptor("NPC_Exoskeleton_Noon_Armor", MASTER_RANK),
    newArmors.Exoskeleton_Monolith_Armor_HeadlessArmors_headless,
    newArmors.HeavyExoskeleton_Monolith_Armor_HeadlessArmors_headless,
    newArmors.HeavyAnomaly_Monolith_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Monolith_Helmet_HeadlessArmors,
  ],
  neutral: [
    getNPCArmorDescriptor("NPC_Sel_Neutral_Armor", ALL_RANK),
    getNPCArmorDescriptor("NPC_Cloak_Heavy_Neutral_Armor", VETERAN_MASTER_RANK),
    newArmors.Exoskeleton_Neutral_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Neutral_Helmet_HeadlessArmors,
  ],
  scientist: [getNPCArmorDescriptor("NPC_Sci_Armor", ALL_RANK)],
  spark: [
    getNPCArmorDescriptor("NPC_HeavyExoskeleton_Spark_Armor", MASTER_RANK),
    getNPCArmorDescriptor("NPC_Spark_Armor", ALL_RANK),
    getNPCArmorDescriptor("NPC_Anomaly_Spark_Armor", ALL_RANK),
    newArmors.HeavyBattle_Spark_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Spark_Helmet_HeadlessArmors,
    newArmors.HeavyBattle_Spark_Helmet_HeadlessArmors,
  ],
  varta: [
    newArmors.BattleExoskeleton_Varta_Armor_HeadlessArmors_headless,
    newArmors.HeavyExoskeleton_Varta_Armor_HeadlessArmors_headless,
  ],
};
Object.entries(allDefaultDroppableArmorsByFaction).forEach(([faction, defs]) => {
  extraArmorsByFaction[faction].push(
    ...defs.map((def) => getNPCArmorDescriptor(def.SID, def.__internal__._extras?.ItemGenerator?.PlayerRank as ERank)),
  );
});

export const allExtraArmors = [
  ...extraArmorsByFaction.neutral,
  ...extraArmorsByFaction.bandit,
  ...extraArmorsByFaction.mercenary,
  ...extraArmorsByFaction.military,
  ...extraArmorsByFaction.corpus,
  ...extraArmorsByFaction.scientist,
  ...extraArmorsByFaction.freedom,
  ...extraArmorsByFaction.duty,
  ...extraArmorsByFaction.monolith,
  ...extraArmorsByFaction.varta,
  ...extraArmorsByFaction.spark,
];
