import { ArmorPrototype, EItemGenerationCategory, ERank, Internal } from "s2cfgtojson";
import dotEnv from "dotenv";
import path from "node:path";
import { allDefaultArmorDefs } from "./allDefaultArmorDefs.mjs";
export type DeeplyPartial<T> = {
  [P in Exclude<keyof T, Internal | "toString">]?: T[P] extends object ? DeeplyPartial<T[P]> : T[P];
};

dotEnv.config({ path: path.join(import.meta.dirname, "..", ".env") });
type ArmorDescriptor = {
  __internal__: {
    refkey: string;
    _extras?: {
      keysForRemoval?: Record<string, string | number | string[] | number[]>;
      ItemGenerator?: { Category: `${EItemGenerationCategory}`; PlayerRank: `${ERank}` };
      isDroppable?: boolean;
    };
  };
} & DeeplyPartial<ArmorPrototype>;

export const newArmors = {
  BattleExoskeleton_Varta_Armor_HeadlessArmors_headless: {
    __internal__: {
      refkey: "BattleExoskeleton_Varta_Armor",
      _extras: {
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs["BattleExoskeleton_Varta_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `BattleExoskeleton_Varta_Armor_HeadlessArmors_headless`,
    LocalizationSID: "BattleExoskeleton_Varta_Armor",

    bBlockHead: false,
    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_BattleExoskeleton_Varta_Armor_headless.T_IFI_BattleExoskeleton_Varta_Armor_headless'",
    Weight: 8.5,
    Cost: 58000,
    Protection: {
      Radiation: 25,
      PSY: 0,
    },
  } satisfies ArmorDescriptor,
  Exoskeleton_Mercenaries_Armor_HeadlessArmors_headless: {
    __internal__: {
      refkey: "Exoskeleton_Mercenaries_Armor",
      _extras: {
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs["Exoskeleton_Mercenaries_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `Exoskeleton_Mercenaries_Armor_HeadlessArmors_headless`,
    LocalizationSID: "Exoskeleton_Mercenaries_Armor",

    bBlockHead: false,
    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Mercenaries_Armor_headless.T_IFI_Exoskeleton_Mercenaries_Armor_headless'",
    Weight: 7.5,
    Cost: 50500,
    Protection: { Radiation: 20, PSY: 0 },
  } satisfies ArmorDescriptor,
  Exoskeleton_Monolith_Armor_HeadlessArmors_headless: {
    __internal__: {
      refkey: "Exoskeleton_Monolith_Armor",
      _extras: {
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs["Exoskeleton_Monolith_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `Exoskeleton_Monolith_Armor_HeadlessArmors_headless`,
    LocalizationSID: "Exoskeleton_Monolith_Armor",

    bBlockHead: false,
    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Monolith_Armor_headless.T_IFI_Exoskeleton_Monolith_Armor_headless'",
    Weight: 7.5,
    Cost: 53000,
    Protection: { Radiation: 30, PSY: 0 },
  } satisfies ArmorDescriptor,
  Exoskeleton_Neutral_Armor_HeadlessArmors_headless: {
    __internal__: {
      refkey: "Exoskeleton_Neutral_Armor",
      _extras: {
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs.Exoskeleton_Neutral_Armor.UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },

    SID: `Exoskeleton_Neutral_Armor_HeadlessArmors_headless`,
    LocalizationSID: "Exoskeleton_Neutral_Armor",

    bBlockHead: false,
    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Neutral_Armor_headless.T_IFI_Exoskeleton_Neutral_Armor_headless'",
    Weight: 12,
    Cost: 55500,
    Protection: { Radiation: 20, PSY: 0 },
  } satisfies ArmorDescriptor,
  Exoskeleton_Svoboda_Armor_HeadlessArmors_headless: {
    __internal__: {
      refkey: "Exoskeleton_Svoboda_Armor",
      _extras: {
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs["Exoskeleton_Svoboda_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `Exoskeleton_Svoboda_Armor_HeadlessArmors_headless`,
    LocalizationSID: "Exoskeleton_Svoboda_Armor",

    bBlockHead: false,
    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Svoboda_Armor_headless.T_IFI_Exoskeleton_Svoboda_Armor_headless'",
    Weight: 7.5,
    Cost: 80000,
    Protection: { Radiation: 25, PSY: 0 },
  } satisfies ArmorDescriptor,
  Heavy_Dolg_Armor_HeadlessArmors_headless: {
    __internal__: {
      refkey: "Heavy_Dolg_Armor",
      _extras: {
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs["Heavy_Dolg_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `Heavy_Dolg_Armor_HeadlessArmors_headless`,
    LocalizationSID: "Heavy_Dolg_Armor",

    bBlockHead: false,
    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_FOL_DOL_03_headless.T_IFI_FOL_DOL_03_headless'",
    Weight: 7,
    Cost: 35000,
    Protection: { Radiation: 10, PSY: 0 },
  } satisfies ArmorDescriptor,
  Heavy2_Military_Armor_HeadlessArmors_headless: {
    __internal__: {
      refkey: "Heavy2_Military_Armor",
      _extras: {
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs["Heavy2_Military_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `Heavy2_Military_Armor_HeadlessArmors_headless`,
    LocalizationSID: "Heavy2_Military_Armor",

    bBlockHead: false,
    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_FOL_MIL_04_headless.T_IFI_FOL_MIL_04_headless'",
    Weight: 6,
    Cost: 32000,
    Protection: { Radiation: 10, PSY: 0 },
  } satisfies ArmorDescriptor,
  HeavyAnomaly_Monolith_Armor_HeadlessArmors_headless: {
    __internal__: {
      refkey: "HeavyAnomaly_Monolith_Armor",
      _extras: {
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs["HeavyAnomaly_Monolith_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `HeavyAnomaly_Monolith_Armor_HeadlessArmors_headless`,
    LocalizationSID: "HeavyAnomaly_Monolith_Armor",

    bBlockHead: false,
    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_FOL_MON_04_headless.T_IFI_FOL_MON_04_headless'",
    Weight: 7,
    Cost: 42500,
    Protection: { Radiation: 15, PSY: 0 },
  } satisfies ArmorDescriptor,
  Exoskeleton_Dolg_Armor_HeadlessArmors_headless: {
    __internal__: {
      refkey: "Exoskeleton_Dolg_Armor",
      _extras: {
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs["Exoskeleton_Dolg_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `Exoskeleton_Dolg_Armor_HeadlessArmors_headless`,
    LocalizationSID: "Exoskeleton_Dolg_Armor",

    bBlockHead: false,
    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_FOL_STA_05_headless.T_IFI_FOL_STA_05_headless'",
    Weight: 8.5,
    Cost: 70000,
    Protection: { Radiation: 20, PSY: 0 },
  } satisfies ArmorDescriptor,
  Heavy_Svoboda_Armor_HeadlessArmors_headless: {
    __internal__: {
      refkey: "Heavy_Svoboda_Armor",
      _extras: {
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs["Heavy_Svoboda_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `Heavy_Svoboda_Armor_HeadlessArmors_headless`,
    LocalizationSID: "Heavy_Svoboda_Armor",

    bBlockHead: false,
    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_FOL_SVO_02_headless.T_IFI_FOL_SVO_02_headless'",
    Weight: 7,
    Cost: 37000,
    Protection: { Radiation: 15, PSY: 0 },
  } satisfies ArmorDescriptor,
  Heavy_Mercenaries_Armor_HeadlessArmors_headless: {
    __internal__: {
      refkey: "Heavy_Mercenaries_Armor",
      _extras: {
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs["Heavy_Mercenaries_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `Heavy_Mercenaries_Armor_HeadlessArmors_headless`,
    LocalizationSID: "Heavy_Mercenaries_Armor",

    bBlockHead: false,
    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Heavy_Mercenaries_Armor_headless.T_IFI_Heavy_Mercenaries_Armor_headless'",
    Weight: 5,
    Cost: 25500,
    Protection: { Radiation: 10, PSY: 0 },
  } satisfies ArmorDescriptor,
  HeavyBattle_Spark_Armor_HeadlessArmors_headless: {
    __internal__: {
      refkey: "HeavyBattle_Spark_Armor",
      _extras: {
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs["HeavyBattle_Spark_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `HeavyBattle_Spark_Armor_HeadlessArmors_headless`,
    LocalizationSID: "HeavyBattle_Spark_Armor",

    bBlockHead: false,
    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_HeavyBattle_Spark_Armor_headless.T_IFI_HeavyBattle_Spark_Armor_headless'",
    Weight: 7,
    Cost: 40500,
    Protection: { Radiation: 15, PSY: 0 },
  } satisfies ArmorDescriptor,
  HeavyExoskeleton_Dolg_Armor_HeadlessArmors_headless: {
    __internal__: {
      refkey: "HeavyExoskeleton_Dolg_Armor",
      _extras: {
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs["HeavyExoskeleton_Dolg_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `HeavyExoskeleton_Dolg_Armor_HeadlessArmors_headless`,
    LocalizationSID: "HeavyExoskeleton_Dolg_Armor",

    bBlockHead: false,
    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_HeavyExoskeleton_Dolg_Armor_headless.T_IFI_HeavyExoskeleton_Dolg_Armor_headless'",
    Weight: 16,
    Cost: 51000,
    Protection: { Radiation: 20, PSY: 0 },
  } satisfies ArmorDescriptor,
  HeavyExoskeleton_Monolith_Armor_HeadlessArmors_headless: {
    __internal__: {
      refkey: "HeavyExoskeleton_Monolith_Armor",
      _extras: {
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs["HeavyExoskeleton_Monolith_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `HeavyExoskeleton_Monolith_Armor_HeadlessArmors_headless`,
    LocalizationSID: "HeavyExoskeleton_Monolith_Armor",

    bBlockHead: false,
    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_HeavyExoskeleton_Monolith_Armor_headless.T_IFI_HeavyExoskeleton_Monolith_Armor_headless'",
    Weight: 16,
    Cost: 55000,
    Protection: { Radiation: 30, PSY: 0 },
  } satisfies ArmorDescriptor,
  HeavyExoskeleton_Svoboda_Armor_HeadlessArmors_headless: {
    __internal__: {
      refkey: "HeavyExoskeleton_Svoboda_Armor",
      _extras: {
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs["HeavyExoskeleton_Svoboda_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `HeavyExoskeleton_Svoboda_Armor_HeadlessArmors_headless`,
    LocalizationSID: "HeavyExoskeleton_Svoboda_Armor",

    bBlockHead: false,
    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_HeavyExoskeleton_Svoboda_Armor_headless.T_IFI_HeavyExoskeleton_Svoboda_Armor_headless'",
    Weight: 16,
    Cost: 50000,
    Protection: { Radiation: 25, PSY: 0 },
  } satisfies ArmorDescriptor,
  HeavyExoskeleton_Varta_Armor_HeadlessArmors_headless: {
    __internal__: {
      refkey: "BattleExoskeleton_Varta_Armor",
      _extras: {
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs["BattleExoskeleton_Varta_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `HeavyExoskeleton_Varta_Armor_HeadlessArmors_headless`,
    LocalizationSID: "BattleExoskeleton_Varta_Armor",

    bBlockHead: false,
    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_HeavyExoskeleton_Varta_Armor_headless.T_IFI_HeavyExoskeleton_Varta_Armor_headless'",
    Weight: 12,
    Cost: 45500,
    Protection: { Radiation: 25, PSY: 0 },
  } satisfies ArmorDescriptor,
  Exoskeleton_Mercenaries_Helmet_HeadlessArmors: {
    __internal__: {
      refkey: "Heavy_Svoboda_Helmet",
      _extras: {
        ItemGenerator: { Category: "EItemGenerationCategory::Head", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `Exoskeleton_Mercenaries_Helmet_HeadlessArmors`,
    LocalizationSID: "Exoskeleton_Mercenaries_Armor",

    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Merc_Helmet.T_IFI_Exoskeleton_Merc_Helmet'",
    Weight: 5,
    Cost: 45000,
    Protection: { Radiation: 40, PSY: 20, Strike: 4 },
  } satisfies ArmorDescriptor,
  Exoskeleton_Monolith_Helmet_HeadlessArmors: {
    __internal__: {
      refkey: "Heavy_Svoboda_Helmet",
      _extras: {
        ItemGenerator: { Category: "EItemGenerationCategory::Head", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `Exoskeleton_Monolith_Helmet_HeadlessArmors`,
    LocalizationSID: "Exoskeleton_Monolith_Armor",

    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Monolith_Helmet.T_IFI_Exoskeleton_Monolith_Helmet'",
    Weight: 5,
    Cost: 45000,
    Protection: { Radiation: 50, PSY: 20, Strike: 4 },
  } satisfies ArmorDescriptor,
  Exoskeleton_Neutral_Helmet_HeadlessArmors: {
    __internal__: {
      refkey: "Heavy_Svoboda_Helmet",
      _extras: {
        ItemGenerator: { Category: "EItemGenerationCategory::Head", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `Exoskeleton_Neutral_Helmet_HeadlessArmors`,
    LocalizationSID: "Exoskeleton_Neutral_Armor",

    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Neutral_Helmet.T_IFI_Exoskeleton_Neutral_Helmet'",
    Weight: 5,
    Cost: 40000,
    Protection: { Radiation: 40, PSY: 50, Strike: 4 },
  } satisfies ArmorDescriptor,
  Exoskeleton_Spark_Helmet_HeadlessArmors: {
    __internal__: {
      refkey: "Heavy_Svoboda_Helmet",
      _extras: {
        ItemGenerator: { Category: "EItemGenerationCategory::Head", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `Exoskeleton_Spark_Helmet_HeadlessArmors`,
    LocalizationSID: "HeavyBattle_Spark_Armor",

    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Spark_Helmet.T_IFI_Exoskeleton_Spark_Helmet'",
    Weight: 5,
    Cost: 40000,
    Protection: { Radiation: 35, PSY: 40, Strike: 4 },
  } satisfies ArmorDescriptor,
  Exoskeleton_Duty_Helmet_HeadlessArmors: {
    __internal__: {
      refkey: "Heavy_Svoboda_Helmet",
      _extras: {
        ItemGenerator: { Category: "EItemGenerationCategory::Head", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `Exoskeleton_Duty_Helmet_HeadlessArmors`,
    LocalizationSID: "HeavyExoskeleton_Dolg_Armor",

    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Duty_Helmet.T_IFI_Exoskeleton_Duty_Helmet'",
    Weight: 5,
    Cost: 40000,
    Protection: { Radiation: 40, PSY: 20, Strike: 4 },
  } satisfies ArmorDescriptor,
  Exoskeleton_Svoboda_Helmet_HeadlessArmors: {
    __internal__: {
      refkey: "Heavy_Svoboda_Helmet",
      _extras: {
        ItemGenerator: { Category: "EItemGenerationCategory::Head", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `Exoskeleton_Svoboda_Helmet_HeadlessArmors`,
    LocalizationSID: "Heavy_Svoboda_Helmet",

    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Svoboda_Helmet.T_IFI_Exoskeleton_Svoboda_Helmet'",
    Weight: 5,
    Cost: 40000,
    Protection: { Radiation: 45, PSY: 40, Strike: 4 },
  } satisfies ArmorDescriptor,
  HeavyBattle_Spark_Helmet_HeadlessArmors: {
    __internal__: {
      refkey: "Battle_Military_Helmet",
      _extras: {
        ItemGenerator: { Category: "EItemGenerationCategory::Head", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `HeavyBattle_Spark_Helmet_HeadlessArmors`,
    LocalizationSID: "Battle_Military_Helmet",

    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_HeavyBattle_Spark_Helmet.T_IFI_HeavyBattle_Spark_Helmet'",
  } satisfies ArmorDescriptor,
  HeavyBattle_Merc_Helmet_HeadlessArmors: {
    __internal__: {
      refkey: "Battle_Military_Helmet",
      _extras: {
        ItemGenerator: { Category: "EItemGenerationCategory::Head", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `HeavyBattle_Merc_Helmet_HeadlessArmors`,
    LocalizationSID: "Battle_Military_Helmet",

    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_HeavyBattle_Merc_Helmet.T_IFI_HeavyBattle_Merc_Helmet'",
  } satisfies ArmorDescriptor,
  HeavyBattle_Dolg_Helmet_HeadlessArmors: {
    __internal__: {
      refkey: "Battle_Military_Helmet",
      _extras: {
        ItemGenerator: { Category: "EItemGenerationCategory::Head", PlayerRank: "ERank::Veteran, ERank::Master" },
      },
    },
    SID: `HeavyBattle_Dolg_Helmet_HeadlessArmors`,
    LocalizationSID: "Battle_Military_Helmet",

    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_HeavyBattle_Dolg_Helmet.T_IFI_HeavyBattle_Dolg_Helmet'",
  } satisfies ArmorDescriptor,
  SkinCloak_Bandit_Armor_HeadlessArmors: {
    __internal__: {
      refkey: "SkinJacket_Bandit_Armor",
      _extras: {
        ItemGenerator: {
          Category: "EItemGenerationCategory::BodyArmor",
          PlayerRank: "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master",
        },
      },
    },
    SID: `SkinCloak_Bandit_Armor_HeadlessArmors`,
    LocalizationSID: "SkinJacket_Bandit_Armor",

    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Cape_Bandit_Armor.T_IFI_Cape_Bandit_Armor'",
    MeshGenerator: { "0": { MeshGeneratorPrototypeSID: "BAN_03_a_MeshGenerator" } },
    bBlockHead: true,
  } satisfies ArmorDescriptor,
  SkinCloak_Bandit_Armor2_HeadlessArmors_headless: {
    __internal__: {
      refkey: "SkinJacket_Bandit_Armor",
      _extras: {
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs["SkinJacket_Bandit_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
        ItemGenerator: {
          Category: "EItemGenerationCategory::BodyArmor",
          PlayerRank: "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master",
        },
      },
    },
    SID: `SkinCloak_Bandit_Armor2_HeadlessArmors_headless`,
    Icon: "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Cape2_Bandit_Armor.T_IFI_Cape2_Bandit_Armor'",
    LocalizationSID: "SkinJacket_Bandit_Armor",

    MeshGenerator: { "0": { MeshGeneratorPrototypeSID: "BAN_04_a_MeshGenerator" } },
  } satisfies ArmorDescriptor,
  Battle_Dolg_End_Armor_HeadlessArmors_headless: {
    __internal__: {
      refkey: "Battle_Dolg_End_Armor",
      _extras: {
        ItemGenerator: {
          Category: "EItemGenerationCategory::BodyArmor",
          PlayerRank: "ERank::Veteran, ERank::Master",
        },
        keysForRemoval: {
          UpgradePrototypeSIDs: allDefaultArmorDefs["Anomaly_Scientific_Armor"].UpgradePrototypeSIDs.entries()
            .map(([_, k]) => k)
            .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
        },
      },
    },
    SID: `Battle_Dolg_End_Armor_HeadlessArmors_headless`,
    LocalizationSID: "Battle_Dolg_End_Armor",

    bBlockHead: false,
    Protection: { Radiation: 40, PSY: 0 },
    Cost: 70000,
  } satisfies ArmorDescriptor,
};

export const extraArmorsByFaction: {
  spark: ArmorDescriptor[];
  neutral: ArmorDescriptor[];
  bandit: ArmorDescriptor[];
  mercenary: ArmorDescriptor[];
  military: ArmorDescriptor[];
  corpus: ArmorDescriptor[];
  scientist: ArmorDescriptor[];
  freedom: ArmorDescriptor[];
  duty: ArmorDescriptor[];
  monolith: ArmorDescriptor[];
  varta: ArmorDescriptor[];
} = {
  spark: [
    {
      __internal__: {
        refkey: "HeavyBattle_Spark_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `HeavyBattle_Spark_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Battle_Spark_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Newbie, ERank::Experienced",
          },
        },
      },
      SID: `Battle_Spark_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "HeavyAnomaly_Spark_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran" },
        },
      },
      SID: `HeavyAnomaly_Spark_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "SEVA_Spark_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran" },
        },
      },
      SID: `SEVA_Spark_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "NPC_HeavyExoskeleton_Spark_Armor",
        _extras: { ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Master" } },
      },
      SID: `NPC_HeavyExoskeleton_Spark_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "NPC_Spark_Armor",
        _extras: {
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `NPC_Spark_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "NPC_Anomaly_Spark_Armor",
        _extras: {
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Newbie, ERank::Experienced",
          },
        },
      },
      SID: `NPC_Anomaly_Spark_Armor_HeadlessArmors_NPC`,
    },
    newArmors.HeavyBattle_Spark_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Spark_Helmet_HeadlessArmors,
    newArmors.HeavyBattle_Spark_Helmet_HeadlessArmors,
  ],
  neutral: [
    {
      __internal__: {
        refkey: "Jemmy_Neutral_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Newbie" },
        },
      },
      SID: `Jemmy_Neutral_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Newbee_Neutral_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Newbie" },
        },
      },
      SID: `Newbee_Neutral_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Nasos_Neutral_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Experienced" },
        },
      },
      SID: `Nasos_Neutral_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Zorya_Neutral_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Experienced" },
        },
      },
      SID: `Zorya_Neutral_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "SEVA_Neutral_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran" },
        },
      },
      SID: `SEVA_Neutral_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Exoskeleton_Neutral_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Master",
          },
        },
      },
      SID: `Exoskeleton_Neutral_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "NPC_Sel_Neutral_Armor",
        _extras: { ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Newbie" } },
      },
      SID: `NPC_Sel_Neutral_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "NPC_Cloak_Heavy_Neutral_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran" },
        },
      },
      SID: `NPC_Cloak_Heavy_Neutral_Armor_HeadlessArmors_NPC`,
    },
    newArmors.Exoskeleton_Neutral_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Neutral_Helmet_HeadlessArmors,
  ],
  bandit: [
    {
      __internal__: {
        refkey: "SkinJacket_Bandit_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Newbie" },
        },
      },
      SID: `SkinJacket_Bandit_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Jacket_Bandit_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Experienced, ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `Jacket_Bandit_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Middle_Bandit_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Experienced, ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `Middle_Bandit_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "NPC_SkinCloak_Bandit_Armor",
        _extras: { ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Newbie" } },
      },
      SID: `NPC_SkinCloak_Bandit_Armor_HeadlessArmors_NPC`,
    },
    newArmors.SkinCloak_Bandit_Armor_HeadlessArmors,
    newArmors.SkinCloak_Bandit_Armor2_HeadlessArmors_headless,
  ],
  mercenary: [
    {
      __internal__: {
        refkey: "Light_Mercenaries_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Newbie" },
        },
      },
      SID: `Light_Mercenaries_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Exoskeleton_Mercenaries_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Master" },
        },
      },
      SID: `Exoskeleton_Mercenaries_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Heavy_Mercenaries_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `Heavy_Mercenaries_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "NPC_HeavyExoskeleton_Mercenaries_Armor",
        _extras: { ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Master" } },
      },
      SID: `NPC_HeavyExoskeleton_Mercenaries_Armor_HeadlessArmors_NPC`,
    },
    newArmors.Heavy_Mercenaries_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Mercenaries_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Mercenaries_Helmet_HeadlessArmors,
    newArmors.HeavyBattle_Merc_Helmet_HeadlessArmors,
  ],
  military: [
    {
      __internal__: {
        refkey: "Default_Military_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Newbie, ERank::Experienced",
          },
        },
      },
      SID: `Default_Military_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Heavy2_Military_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `Heavy2_Military_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "NPC_Heavy_Military_Armor",
        _extras: {
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `NPC_Heavy_Military_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "NPC_Cloak_Heavy_Military_Armor",
        _extras: {
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `NPC_Cloak_Heavy_Military_Armor_HeadlessArmors_NPC`,
    },
    newArmors.Heavy2_Military_Armor_HeadlessArmors_headless,
  ],
  corpus: [
    {
      __internal__: {
        refkey: "NPC_Heavy_Corps_Armor",
        _extras: {
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `NPC_Heavy_Corps_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "NPC_Heavy3_Corps_Armor",
        _extras: {
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `NPC_Heavy3_Corps_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "NPC_Heavy2_Coprs_Armor",
        _extras: {
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `NPC_Heavy2_Coprs_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "NPC_Heavy3Exoskeleton_Coprs_Armor",
        _extras: {
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `NPC_Heavy3Exoskeleton_Coprs_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "NPC_Exoskeleton_Coprs_Armor",
        _extras: {
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `NPC_Exoskeleton_Coprs_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Battle_Dolg_End_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Master" },
        },
      },
      SID: `Battle_Dolg_End_Armor_HeadlessArmors_NPC`,
    },
  ],
  scientist: [
    {
      __internal__: {
        refkey: "Anomaly_Scientific_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Newbie, ERank::Experienced",
          },
        },
      },
      SID: `Anomaly_Scientific_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "HeavyAnomaly_Scientific_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Experienced, ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `HeavyAnomaly_Scientific_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "SciSEVA_Scientific_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `SciSEVA_Scientific_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "NPC_Sci_Armor",
        _extras: {
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `NPC_Sci_Armor_HeadlessArmors_NPC`,
    },
  ],
  freedom: [
    {
      __internal__: {
        refkey: "Rook_Svoboda_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Newbie" },
        },
      },
      SID: `Rook_Svoboda_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Battle_Svoboda_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Experienced" },
        },
      },
      SID: `Battle_Svoboda_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "SEVA_Svoboda_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran" },
        },
      },
      SID: `SEVA_Svoboda_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Heavy_Svoboda_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `Heavy_Svoboda_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "HeavyExoskeleton_Svoboda_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Master" },
        },
      },
      SID: `HeavyExoskeleton_Svoboda_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Exoskeleton_Svoboda_Armor",
        _extras: { ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Master" } },
      },
      SID: `Exoskeleton_Svoboda_Armor_HeadlessArmors_NPC`,
    },
    newArmors.Exoskeleton_Svoboda_Armor_HeadlessArmors_headless,
    newArmors.HeavyExoskeleton_Svoboda_Armor_HeadlessArmors_headless,
    newArmors.Heavy_Svoboda_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Svoboda_Helmet_HeadlessArmors,
  ],
  duty: [
    {
      __internal__: {
        refkey: "Rook_Dolg_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Newbie" },
        },
      },
      SID: `Rook_Dolg_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Battle_Dolg_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Experienced" },
        },
      },
      SID: `Battle_Dolg_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "SEVA_Dolg_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Experienced" },
        },
      },
      SID: `SEVA_Dolg_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Heavy_Dolg_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `Heavy_Dolg_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "HeavyExoskeleton_Dolg_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Master" },
        },
      },
      SID: `HeavyExoskeleton_Dolg_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Exoskeleton_Dolg_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Master" },
        },
      },
      SID: `Exoskeleton_Dolg_Armor_HeadlessArmors_NPC`,
    },
    newArmors.Exoskeleton_Dolg_Armor_HeadlessArmors_headless,
    newArmors.HeavyExoskeleton_Dolg_Armor_HeadlessArmors_headless,
    newArmors.Heavy_Dolg_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Duty_Helmet_HeadlessArmors,
    newArmors.HeavyBattle_Dolg_Helmet_HeadlessArmors,
    newArmors.Battle_Dolg_End_Armor_HeadlessArmors_headless,
  ],
  monolith: [
    {
      __internal__: {
        refkey: "NPC_Battle_Noon_Armor",
        _extras: {
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Newbie, ERank::Experienced",
          },
        },
      },
      SID: `NPC_Battle_Noon_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "NPC_HeavyAnomaly_Noon_Armor",
        _extras: {
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `NPC_HeavyAnomaly_Noon_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "NPC_HeavyExoskeleton_Noon_Armor",
        _extras: { ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Master" } },
      },
      SID: `NPC_HeavyExoskeleton_Noon_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "NPC_Exoskeleton_Noon_Armor",
        _extras: { ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Master" } },
      },
      SID: `NPC_Exoskeleton_Noon_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Battle_Monolith_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Newbie, ERank::Experienced",
          },
        },
      },
      SID: `Battle_Monolith_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "HeavyAnomaly_Monolith_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `HeavyAnomaly_Monolith_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "HeavyExoskeleton_Monolith_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `HeavyExoskeleton_Monolith_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "Exoskeleton_Monolith_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `Exoskeleton_Monolith_Armor_HeadlessArmors_NPC`,
    },
    newArmors.Exoskeleton_Monolith_Armor_HeadlessArmors_headless,
    newArmors.HeavyExoskeleton_Monolith_Armor_HeadlessArmors_headless,
    newArmors.HeavyAnomaly_Monolith_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Monolith_Helmet_HeadlessArmors,
  ],
  varta: [
    {
      __internal__: {
        refkey: "Battle_Varta_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `Battle_Varta_Armor_HeadlessArmors_NPC`,
    },
    {
      __internal__: {
        refkey: "BattleExoskeleton_Varta_Armor",
        _extras: {
          isDroppable: false,
          ItemGenerator: {
            Category: "EItemGenerationCategory::BodyArmor",
            PlayerRank: "ERank::Veteran, ERank::Master",
          },
        },
      },
      SID: `BattleExoskeleton_Varta_Armor_HeadlessArmors_NPC`,
    },
    newArmors.BattleExoskeleton_Varta_Armor_HeadlessArmors_headless,
    newArmors.HeavyExoskeleton_Varta_Armor_HeadlessArmors_headless,
  ],
};

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
