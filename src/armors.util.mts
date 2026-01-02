import "./ensure-dot-env.mts";
import { EItemGenerationCategory, ERank, Internal } from "s2cfgtojson";

import {
  ALL_RANK,
  allDefaultArmorPrototypesRecord,
  allDefaultDroppableArmorsByFaction,
  ArmorDescriptor,
  MASTER_RANK,
  VETERAN_MASTER_RANK,
} from "./consts.mts";
import { backfillDef } from "./backfill-def.mts";
export type DeeplyPartial<T> = {
  [P in Exclude<keyof T, Internal | "toString">]?: T[P] extends object ? DeeplyPartial<T[P]> : T[P];
};

const getHeadlessArmorCommonProps = (refkey: string, modName) => ({
  __internal__: {
    refkey,
    _extras: {
      isDroppable: true,
      keysForRemoval: {
        UpgradePrototypeSIDs: backfillDef(allDefaultArmorPrototypesRecord[refkey])
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
  SID: `${refkey}_MasterMod_headless`,
  LocalizationSID: refkey,
  Protection: { PSY: 0 },
  bBlockHead: false,
  Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_${refkey}_headless.T_IFI_${refkey}_headless'`,
});
const getHelmetInternal = (refkey: string) => ({
  refkey,
  _extras: {
    ItemGenerator: {
      Category: "EItemGenerationCategory::Head" as EItemGenerationCategory,
      PlayerRank: VETERAN_MASTER_RANK as ERank,
    },
  },
});
const ICON_ROOT = "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_";

export const newArmors = {
  BattleExoskeleton_Varta_Armor_MasterMod_headless: {
    ...getHeadlessArmorCommonProps("BattleExoskeleton_Varta_Armor", "MasterMod"),
    Weight: 8.5,
    Cost: 58000,
  },
  Exoskeleton_Mercenaries_Armor_MasterMod_headless: {
    ...getHeadlessArmorCommonProps("Exoskeleton_Mercenaries_Armor", "MasterMod"),
    Weight: 7.5,
    Cost: 50500,
  },
  Exoskeleton_Monolith_Armor_MasterMod_headless: {
    ...getHeadlessArmorCommonProps("Exoskeleton_Monolith_Armor", "MasterMod"),
    Weight: 7.5,
    Cost: 53000,
  },
  Exoskeleton_Neutral_Armor_MasterMod_headless: {
    ...getHeadlessArmorCommonProps("Exoskeleton_Neutral_Armor", "MasterMod"),
    Weight: 12,
    Cost: 55500,
  },
  Exoskeleton_Svoboda_Armor_MasterMod_headless: {
    ...getHeadlessArmorCommonProps("Exoskeleton_Svoboda_Armor", "MasterMod"),
    Weight: 7.5,
    Cost: 80000,
  },
  Heavy_Dolg_Armor_MasterMod_headless: {
    ...getHeadlessArmorCommonProps("Heavy_Dolg_Armor", "MasterMod"),
    Weight: 7,
    Cost: 35000,
  },
  Heavy2_Military_Armor_MasterMod_headless: {
    ...getHeadlessArmorCommonProps("Heavy2_Military_Armor", "MasterMod"),
    Weight: 6,
    Cost: 32000,
  },
  HeavyAnomaly_Monolith_Armor_MasterMod_headless: {
    ...getHeadlessArmorCommonProps("HeavyAnomaly_Monolith_Armor", "MasterMod"),
    Weight: 7,
    Cost: 42500,
  },
  Exoskeleton_Dolg_Armor_MasterMod_headless: {
    ...getHeadlessArmorCommonProps("Exoskeleton_Dolg_Armor", "MasterMod"),
    Weight: 8.5,
    Cost: 70000,
  },
  Heavy_Svoboda_Armor_MasterMod_headless: {
    ...getHeadlessArmorCommonProps("Heavy_Svoboda_Armor", "MasterMod"),
    Weight: 7,
    Cost: 37000,
  },
  Heavy_Mercenaries_Armor_MasterMod_headless: {
    ...getHeadlessArmorCommonProps("Heavy_Mercenaries_Armor", "MasterMod"),
    Weight: 5,
    Cost: 25500,
  },
  HeavyBattle_Spark_Armor_MasterMod_headless: {
    ...getHeadlessArmorCommonProps("HeavyBattle_Spark_Armor", "MasterMod"),
    Weight: 7,
    Cost: 40500,
  },
  HeavyExoskeleton_Dolg_Armor_MasterMod_headless: {
    ...getHeadlessArmorCommonProps("HeavyExoskeleton_Dolg_Armor", "MasterMod"),
    Weight: 16,
    Cost: 51000,
  },
  HeavyExoskeleton_Monolith_Armor_MasterMod_headless: {
    ...getHeadlessArmorCommonProps("HeavyExoskeleton_Monolith_Armor", "MasterMod"),
    Weight: 16,
    Cost: 55000,
  },
  HeavyExoskeleton_Svoboda_Armor_MasterMod_headless: {
    ...getHeadlessArmorCommonProps("HeavyExoskeleton_Svoboda_Armor", "MasterMod"),
    Weight: 16,
    Cost: 50000,
  },
  HeavyExoskeleton_Varta_Armor_MasterMod_headless: {
    ...getHeadlessArmorCommonProps("BattleExoskeleton_Varta_Armor", "MasterMod"),
    Weight: 12,
    Cost: 45500,
  },
  Battle_Dolg_End_Armor_MasterMod_headless: {
    ...getHeadlessArmorCommonProps("Battle_Dolg_End_Armor", "MasterMod"),
    Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Battle_Dolg_End_Armor.T_IFI_Battle_Dolg_End_Armor'`,
    Cost: 70000,
  },

  Exoskeleton_Mercenaries_Helmet_MasterMod: {
    __internal__: getHelmetInternal("Heavy_Svoboda_Helmet"),
    SID: `Exoskeleton_Mercenaries_Helmet_MasterMod`,
    LocalizationSID: "Exoskeleton_Mercenaries_Armor",
    Icon: `${ICON_ROOT}Exoskeleton_Merc_Helmet.T_IFI_Exoskeleton_Merc_Helmet'`,
    Weight: 5,
    Cost: 45000,
    Protection: { Radiation: 40, PSY: 20, Strike: 4 },
  },
  Exoskeleton_Monolith_Helmet_MasterMod: {
    __internal__: getHelmetInternal("Heavy_Svoboda_Helmet"),
    SID: `Exoskeleton_Monolith_Helmet_MasterMod`,
    LocalizationSID: "Exoskeleton_Monolith_Armor",
    Icon: `${ICON_ROOT}Exoskeleton_Monolith_Helmet.T_IFI_Exoskeleton_Monolith_Helmet'`,
    Weight: 5,
    Cost: 45000,
    Protection: { Radiation: 50, PSY: 20, Strike: 4 },
  },
  Exoskeleton_Neutral_Helmet_MasterMod: {
    __internal__: getHelmetInternal("Heavy_Svoboda_Helmet"),
    SID: `Exoskeleton_Neutral_Helmet_MasterMod`,
    LocalizationSID: "Exoskeleton_Neutral_Armor",
    Icon: `${ICON_ROOT}Exoskeleton_Neutral_Helmet.T_IFI_Exoskeleton_Neutral_Helmet'`,
    Weight: 5,
    Cost: 40000,
    Protection: { Radiation: 40, PSY: 50, Strike: 4 },
  },
  Exoskeleton_Spark_Helmet_MasterMod: {
    __internal__: getHelmetInternal("Heavy_Svoboda_Helmet"),
    SID: `Exoskeleton_Spark_Helmet_MasterMod`,
    LocalizationSID: "HeavyBattle_Spark_Armor",
    Icon: `${ICON_ROOT}Exoskeleton_Spark_Helmet.T_IFI_Exoskeleton_Spark_Helmet'`,
    Weight: 5,
    Cost: 40000,
    Protection: { Radiation: 35, PSY: 40, Strike: 4 },
  },
  Exoskeleton_Duty_Helmet_MasterMod: {
    __internal__: getHelmetInternal("Heavy_Svoboda_Helmet"),
    SID: `Exoskeleton_Duty_Helmet_MasterMod`,
    LocalizationSID: "HeavyExoskeleton_Dolg_Armor",
    Icon: `${ICON_ROOT}Exoskeleton_Duty_Helmet.T_IFI_Exoskeleton_Duty_Helmet'`,
    Weight: 5,
    Cost: 40000,
    Protection: { Radiation: 40, PSY: 20, Strike: 4 },
  },
  Exoskeleton_Svoboda_Helmet_MasterMod: {
    __internal__: getHelmetInternal("Heavy_Svoboda_Helmet"),
    SID: `Exoskeleton_Svoboda_Helmet_MasterMod`,
    LocalizationSID: "Heavy_Svoboda_Helmet",
    Icon: `${ICON_ROOT}Exoskeleton_Svoboda_Helmet.T_IFI_Exoskeleton_Svoboda_Helmet'`,
    Weight: 5,
    Cost: 40000,
    Protection: { Radiation: 45, PSY: 40, Strike: 4 },
  },
  HeavyBattle_Spark_Helmet_MasterMod: {
    __internal__: getHelmetInternal("Battle_Military_Helmet"),
    SID: `HeavyBattle_Spark_Helmet_MasterMod`,
    LocalizationSID: "Battle_Military_Helmet",
    Icon: `${ICON_ROOT}HeavyBattle_Spark_Helmet.T_IFI_HeavyBattle_Spark_Helmet'`,
  },
  HeavyBattle_Merc_Helmet_MasterMod: {
    __internal__: getHelmetInternal("Battle_Military_Helmet"),
    SID: `HeavyBattle_Merc_Helmet_MasterMod`,
    LocalizationSID: "Battle_Military_Helmet",
    Icon: `${ICON_ROOT}HeavyBattle_Merc_Helmet.T_IFI_HeavyBattle_Merc_Helmet'`,
  },
  HeavyBattle_Dolg_Helmet_MasterMod: {
    __internal__: getHelmetInternal("Battle_Military_Helmet"),
    SID: `HeavyBattle_Dolg_Helmet_MasterMod`,
    LocalizationSID: "Battle_Military_Helmet",
    Icon: `${ICON_ROOT}HeavyBattle_Dolg_Helmet.T_IFI_HeavyBattle_Dolg_Helmet'`,
  },
  SkinCloak_Bandit_Armor_MasterMod: {
    __internal__: {
      refkey: "SkinJacket_Bandit_Armor",
      _extras: {
        ItemGenerator: {
          Category: "EItemGenerationCategory::BodyArmor" as EItemGenerationCategory,
          PlayerRank: ALL_RANK as ERank,
        },
      },
    },
    SID: `SkinCloak_Bandit_Armor_MasterMod`,
    LocalizationSID: "SkinJacket_Bandit_Armor",
    bBlockHead: true,
  },
  SkinCloak_Bandit_Armor2_MasterMod_headless: {
    __internal__: {
      refkey: "SkinJacket_Bandit_Armor",
      _extras: {
        isDroppable: false,
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorPrototypesRecord["SkinJacket_Bandit_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: {
          Category: "EItemGenerationCategory::BodyArmor" as EItemGenerationCategory,
          PlayerRank: ALL_RANK,
        },
      },
    },
    SID: `SkinCloak_Bandit_Armor2_MasterMod_headless`,
    LocalizationSID: "SkinJacket_Bandit_Armor",
  },
};

Object.assign(
  newArmors,
  Object.fromEntries(
    [
      ...[
        "BattleExoskeleton_Varta_Armor",
        "Exoskeleton_Mercenaries_Armor",
        "Exoskeleton_Monolith_Armor",
        "Exoskeleton_Neutral_Armor",
        "Exoskeleton_Svoboda_Armor",
        "Heavy_Dolg_Armor",
        "Heavy2_Military_Armor",
        "HeavyAnomaly_Monolith_Armor",
        "Exoskeleton_Dolg_Armor",
        "Heavy_Svoboda_Armor",
        "Heavy_Mercenaries_Armor",
        "HeavyBattle_Spark_Armor",
        "HeavyExoskeleton_Dolg_Armor",
        "HeavyExoskeleton_Monolith_Armor",
        "HeavyExoskeleton_Svoboda_Armor",
        "HeavyExoskeleton_Varta_Armor",
        "Battle_Dolg_End_Armor",
        "SkinCloak_Bandit_Armor2",
      ].map((e) => e + "_HeadlessArmors_headless"),
      ...[
        "Exoskeleton_Mercenaries",
        "Exoskeleton_Monolith",
        "Exoskeleton_Neutral",
        "Exoskeleton_Spark",
        "Exoskeleton_Duty",
        "Exoskeleton_Svoboda",
        "HeavyBattle_Spark",
        "HeavyBattle_Merc",
        "HeavyBattle_Dolg",
      ].map((e) => e + "_Helmet_HeadlessArmors"),
      "SkinCloak_Bandit_Armor_HeadlessArmors",
    ].map((e) => [e, { SID: e, __internal__: { refkey: e.replace("HeadlessArmors", "MasterMod") } }]),
  ),
);

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
  SID: `${refkey}_MasterMod_NPC`,
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
  bandit: [newArmors.SkinCloak_Bandit_Armor_MasterMod, newArmors.SkinCloak_Bandit_Armor2_MasterMod_headless],
  corpus: [
    getNPCArmorDescriptor("NPC_Heavy_Corps_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_Heavy3_Corps_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_Heavy2_Coprs_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_Heavy3Exoskeleton_Coprs_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_Exoskeleton_Coprs_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("Battle_Dolg_End_Armor", MASTER_RANK),
  ],
  duty: [
    newArmors.Exoskeleton_Dolg_Armor_MasterMod_headless,
    newArmors.HeavyExoskeleton_Dolg_Armor_MasterMod_headless,
    newArmors.Heavy_Dolg_Armor_MasterMod_headless,
    newArmors.Exoskeleton_Duty_Helmet_MasterMod,
    newArmors.HeavyBattle_Dolg_Helmet_MasterMod,
    newArmors.Battle_Dolg_End_Armor_MasterMod_headless,
  ],
  freedom: [
    newArmors.Exoskeleton_Svoboda_Armor_MasterMod_headless,
    newArmors.HeavyExoskeleton_Svoboda_Armor_MasterMod_headless,
    newArmors.Heavy_Svoboda_Armor_MasterMod_headless,
    newArmors.Exoskeleton_Svoboda_Helmet_MasterMod,
  ],
  mercenary: [
    getNPCArmorDescriptor("NPC_HeavyExoskeleton_Mercenaries_Armor", MASTER_RANK),
    newArmors.Heavy_Mercenaries_Armor_MasterMod_headless,
    newArmors.Exoskeleton_Mercenaries_Armor_MasterMod_headless,
    newArmors.Exoskeleton_Mercenaries_Helmet_MasterMod,
    newArmors.HeavyBattle_Merc_Helmet_MasterMod,
  ],
  military: [
    getNPCArmorDescriptor("NPC_Heavy_Military_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_Cloak_Heavy_Military_Armor", VETERAN_MASTER_RANK),
    newArmors.Heavy2_Military_Armor_MasterMod_headless,
  ],
  monolith: [
    getNPCArmorDescriptor("NPC_Battle_Noon_Armor", ALL_RANK),
    getNPCArmorDescriptor("NPC_HeavyAnomaly_Noon_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_HeavyExoskeleton_Noon_Armor", MASTER_RANK),
    getNPCArmorDescriptor("NPC_Exoskeleton_Noon_Armor", MASTER_RANK),
    newArmors.Exoskeleton_Monolith_Armor_MasterMod_headless,
    newArmors.HeavyExoskeleton_Monolith_Armor_MasterMod_headless,
    newArmors.HeavyAnomaly_Monolith_Armor_MasterMod_headless,
    newArmors.Exoskeleton_Monolith_Helmet_MasterMod,
  ],
  neutral: [
    getNPCArmorDescriptor("NPC_Sel_Neutral_Armor", ALL_RANK),
    getNPCArmorDescriptor("NPC_Cloak_Heavy_Neutral_Armor", VETERAN_MASTER_RANK),
    newArmors.Exoskeleton_Neutral_Armor_MasterMod_headless,
    newArmors.Exoskeleton_Neutral_Helmet_MasterMod,
  ],
  scientist: [getNPCArmorDescriptor("NPC_Sci_Armor", ALL_RANK)],
  spark: [
    getNPCArmorDescriptor("NPC_HeavyExoskeleton_Spark_Armor", MASTER_RANK),
    getNPCArmorDescriptor("NPC_Spark_Armor", ALL_RANK),
    getNPCArmorDescriptor("NPC_Anomaly_Spark_Armor", ALL_RANK),
    newArmors.HeavyBattle_Spark_Armor_MasterMod_headless,
    newArmors.Exoskeleton_Spark_Helmet_MasterMod,
    newArmors.HeavyBattle_Spark_Helmet_MasterMod,
  ],
  varta: [newArmors.BattleExoskeleton_Varta_Armor_MasterMod_headless, newArmors.HeavyExoskeleton_Varta_Armor_MasterMod_headless],
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
