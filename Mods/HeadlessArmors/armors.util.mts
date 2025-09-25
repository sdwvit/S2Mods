import { ArmorPrototype, EItemGenerationCategory, ERank, Struct } from "s2cfgtojson";
import fs from "node:fs";
import path from "node:path";

import dotEnv from "dotenv";
dotEnv.config({ path: path.join(import.meta.dirname, "..", ".env") });
const nestedDir = path.join("Stalker2", "Content", "GameLite");
const BASE_CFG_DIR = path.join(process.env.SDK_PATH, nestedDir);
export const allDefaultArmorDefs = Object.fromEntries(
  (
    Struct.fromString(
      [
        fs.readFileSync(path.join(BASE_CFG_DIR, "GameData", "ItemPrototypes", "ArmorPrototypes.cfg"), "utf8"),
        //  fs.readFileSync(path.join(BASE_CFG_DIR, "DLCGameData", "Deluxe", "ItemPrototypes", "ArmorPrototypes.cfg"), "utf8"),
        //  fs.readFileSync(path.join(BASE_CFG_DIR, "DLCGameData", "PreOrder", "ItemPrototypes", "ArmorPrototypes.cfg"), "utf8"),
        //  fs.readFileSync(path.join(BASE_CFG_DIR, "DLCGameData", "Ultimate", "ItemPrototypes", "ArmorPrototypes.cfg"), "utf8"),
      ].join("\n"),
    ) as ArmorPrototype[]
  ).map((e) => [e.entries.SID, e] as const),
);
const defaultKeys = new Set(["_isArray", "_useAsterisk"]);
export function backfillArmorDef(armor: { refkey?: string | number }): ArmorPrototype {
  const deepWalk = (obj: any, cb, path = []) =>
    Object.entries(obj)
      .filter((e) => !defaultKeys.has(e[0]))
      .forEach(([k, v]) => {
        cb(path.concat(k));
        if (typeof v === "object" && v !== null) {
          deepWalk(v, cb, path.concat(k));
        }
      });
  const get = (obj: any, path: string[]) => path.reduce((o, k) => o && o[k], obj);
  const set = (obj: any, path: string[], value: any) => {
    const lastKey = path.pop();
    const parent = get(obj, path);
    if (parent && lastKey) {
      parent[lastKey] = value;
    }
  };
  deepWalk(allDefaultArmorDefs.HeavyExoskeleton_Svoboda_Armor, (path: string[]) => {
    let a = armor as ArmorPrototype;
    while (get(a, path) === undefined) {
      a = allDefaultArmorDefs[a.refkey];
      if (!a) {
        return;
      }
    }
    set(armor, path, get(a, path));
  });

  return armor as ArmorPrototype;
}

export const newArmors = {
  BattleExoskeleton_Varta_Armor_HeadlessArmors_headless: {
    refkey: "BattleExoskeleton_Varta_Armor",
    _extras: {
      keysForRemoval: { "entries.UpgradePrototypeSIDs.entries": "FaustPsyResist_Quest_1_1" },
      ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "BattleExoskeleton_Varta_Armor_HeadlessArmors_headless",
      LocalizationSID: "BattleExoskeleton_Varta_Armor",
      bBlockHead: false,
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_BattleExoskeleton_Varta_Armor_headless.T_IFI_BattleExoskeleton_Varta_Armor_headless'`,
      Weight: 8.5,
      Cost: 58000,
      Protection: {
        entries: {
          Radiation: 25,
          PSY: 0,
        },
      },
    },
  },
  Exoskeleton_Mercenaries_Armor_HeadlessArmors_headless: {
    refkey: "Exoskeleton_Mercenaries_Armor",
    _extras: {
      keysForRemoval: { "entries.UpgradePrototypeSIDs.entries": "FaustPsyResist_Quest_1_1" },
      ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "Exoskeleton_Mercenaries_Armor_HeadlessArmors_headless",
      LocalizationSID: "Exoskeleton_Mercenaries_Armor",
      bBlockHead: false,
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Mercenaries_Armor_headless.T_IFI_Exoskeleton_Mercenaries_Armor_headless'`,
      Weight: 7.5,
      Cost: 50500,
      Protection: {
        entries: {
          Radiation: 20,
          PSY: 0,
        },
      },
    },
  },
  Exoskeleton_Monolith_Armor_HeadlessArmors_headless: {
    refkey: "Exoskeleton_Monolith_Armor",
    _extras: {
      keysForRemoval: { "entries.UpgradePrototypeSIDs.entries": "FaustPsyResist_Quest_1_1" },
      ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "Exoskeleton_Monolith_Armor_HeadlessArmors_headless",
      LocalizationSID: "Exoskeleton_Monolith_Armor",
      bBlockHead: false,
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Monolith_Armor_headless.T_IFI_Exoskeleton_Monolith_Armor_headless'`,
      Weight: 7.5,
      Cost: 53000,
      Protection: {
        entries: {
          Radiation: 30,
          PSY: 0,
        },
      },
    },
  },
  Exoskeleton_Neutral_Armor_HeadlessArmors_headless: {
    refkey: "Exoskeleton_Neutral_Armor",
    _extras: {
      keysForRemoval: { "entries.UpgradePrototypeSIDs.entries": "FaustPsyResist_Quest_1_1" },
      ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "Exoskeleton_Neutral_Armor_HeadlessArmors_headless",
      LocalizationSID: "Exoskeleton_Neutral_Armor",
      bBlockHead: false,
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Neutral_Armor_headless.T_IFI_Exoskeleton_Neutral_Armor_headless'`,
      Weight: 12,
      Cost: 55500,
      Protection: {
        entries: {
          Radiation: 20,
          PSY: 0,
        },
      },
    },
  },
  Exoskeleton_Svoboda_Armor_HeadlessArmors_headless: {
    refkey: "Exoskeleton_Svoboda_Armor",
    _extras: {
      keysForRemoval: { "entries.UpgradePrototypeSIDs.entries": "FaustPsyResist_Quest_1_1" },
      ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "Exoskeleton_Svoboda_Armor_HeadlessArmors_headless",
      LocalizationSID: "Exoskeleton_Svoboda_Armor",
      bBlockHead: false,
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Svoboda_Armor_headless.T_IFI_Exoskeleton_Svoboda_Armor_headless'`,
      Weight: 7.5,
      Cost: 80000,
      Protection: {
        entries: {
          Radiation: 25,
          PSY: 0,
        },
      },
    },
  },
  Heavy_Dolg_Armor_HeadlessArmors_headless: {
    refkey: "Heavy_Dolg_Armor",
    _extras: {
      keysForRemoval: { "entries.UpgradePrototypeSIDs.entries": "FaustPsyResist_Quest_1_1" },
      ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "Heavy_Dolg_Armor_HeadlessArmors_headless",
      LocalizationSID: "Heavy_Dolg_Armor",
      bBlockHead: false,
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_FOL_DOL_03_headless.T_IFI_FOL_DOL_03_headless'`,
      Weight: 7,
      Cost: 35000,
      Protection: {
        entries: {
          Radiation: 10,
          PSY: 0,
        },
      },
    },
  },
  Heavy2_Military_Armor_HeadlessArmors_headless: {
    refkey: "Heavy2_Military_Armor",
    _extras: {
      keysForRemoval: { "entries.UpgradePrototypeSIDs.entries": "FaustPsyResist_Quest_1_1" },
      ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "Heavy2_Military_Armor_HeadlessArmors_headless",
      LocalizationSID: "Heavy2_Military_Armor",
      bBlockHead: false,
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_FOL_MIL_04_headless.T_IFI_FOL_MIL_04_headless'`,
      Weight: 6,
      Cost: 32000,
      Protection: {
        entries: {
          Radiation: 10,
          PSY: 0,
        },
      },
    },
  },
  HeavyAnomaly_Monolith_Armor_HeadlessArmors_headless: {
    refkey: "HeavyAnomaly_Monolith_Armor",
    _extras: {
      keysForRemoval: { "entries.UpgradePrototypeSIDs.entries": "FaustPsyResist_Quest_1_1" },
      ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "HeavyAnomaly_Monolith_Armor_HeadlessArmors_headless",
      LocalizationSID: "HeavyAnomaly_Monolith_Armor",
      bBlockHead: false,
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_FOL_MON_04_headless.T_IFI_FOL_MON_04_headless'`,
      Weight: 7,
      Cost: 42500,
      Protection: {
        entries: {
          Radiation: 15,
          PSY: 0,
        },
      },
    },
  },
  Exoskeleton_Dolg_Armor_HeadlessArmors_headless: {
    refkey: "Exoskeleton_Dolg_Armor",
    _extras: {
      keysForRemoval: { "entries.UpgradePrototypeSIDs.entries": "FaustPsyResist_Quest_1_1" },
      ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "Exoskeleton_Dolg_Armor_HeadlessArmors_headless",
      LocalizationSID: "Exoskeleton_Dolg_Armor",
      bBlockHead: false,
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_FOL_STA_05_headless.T_IFI_FOL_STA_05_headless'`,
      Weight: 8.5,
      Cost: 70000,
      Protection: {
        entries: {
          Radiation: 20,
          PSY: 0,
        },
      },
    },
  },
  Heavy_Svoboda_Armor_HeadlessArmors_headless: {
    refkey: "Heavy_Svoboda_Armor",
    _extras: {
      keysForRemoval: { "entries.UpgradePrototypeSIDs.entries": "FaustPsyResist_Quest_1_1" },
      ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "Heavy_Svoboda_Armor_HeadlessArmors_headless",
      LocalizationSID: "Heavy_Svoboda_Armor",
      bBlockHead: false,
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_FOL_SVO_02_headless.T_IFI_FOL_SVO_02_headless'`,
      Weight: 7,
      Cost: 37000,
      Protection: {
        entries: {
          Radiation: 15,
          PSY: 0,
        },
      },
    },
  },
  Heavy_Mercenaries_Armor_HeadlessArmors_headless: {
    refkey: "Heavy_Mercenaries_Armor",
    _extras: {
      keysForRemoval: { "entries.UpgradePrototypeSIDs.entries": "FaustPsyResist_Quest_1_1" },
      ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "Heavy_Mercenaries_Armor_HeadlessArmors_headless",
      LocalizationSID: "Heavy_Mercenaries_Armor",
      bBlockHead: false,
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Heavy_Mercenaries_Armor_headless.T_IFI_Heavy_Mercenaries_Armor_headless'`,
      Weight: 5,
      Cost: 25500,
      Protection: {
        entries: {
          Radiation: 10,
          PSY: 0,
        },
      },
    },
  },
  HeavyBattle_Spark_Armor_HeadlessArmors_headless: {
    refkey: "HeavyBattle_Spark_Armor",
    _extras: {
      keysForRemoval: { "entries.UpgradePrototypeSIDs.entries": "FaustPsyResist_Quest_1_1" },
      ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "HeavyBattle_Spark_Armor_HeadlessArmors_headless",
      LocalizationSID: "HeavyBattle_Spark_Armor",
      bBlockHead: false,
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_HeavyBattle_Spark_Armor_headless.T_IFI_HeavyBattle_Spark_Armor_headless'`,
      Weight: 7,
      Cost: 40500,
      Protection: {
        entries: {
          Radiation: 15,
          PSY: 0,
        },
      },
    },
  },
  HeavyExoskeleton_Dolg_Armor_HeadlessArmors_headless: {
    refkey: "HeavyExoskeleton_Dolg_Armor",
    _extras: {
      keysForRemoval: { "entries.UpgradePrototypeSIDs.entries": "FaustPsyResist_Quest_1_1" },
      ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "HeavyExoskeleton_Dolg_Armor_HeadlessArmors_headless",
      LocalizationSID: "HeavyExoskeleton_Dolg_Armor",
      bBlockHead: false,
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_HeavyExoskeleton_Dolg_Armor_headless.T_IFI_HeavyExoskeleton_Dolg_Armor_headless'`,
      Weight: 16,
      Cost: 51000,
      Protection: {
        entries: {
          Radiation: 20,
          PSY: 0,
        },
      },
    },
  },
  HeavyExoskeleton_Monolith_Armor_HeadlessArmors_headless: {
    refkey: "HeavyExoskeleton_Monolith_Armor",
    _extras: {
      keysForRemoval: { "entries.UpgradePrototypeSIDs.entries": "FaustPsyResist_Quest_1_1" },
      ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "HeavyExoskeleton_Monolith_Armor_HeadlessArmors_headless",
      LocalizationSID: "HeavyExoskeleton_Monolith_Armor",
      bBlockHead: false,
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_HeavyExoskeleton_Monolith_Armor_headless.T_IFI_HeavyExoskeleton_Monolith_Armor_headless'`,
      Weight: 16,
      Cost: 55000,
      Protection: {
        entries: {
          Radiation: 30,
          PSY: 0,
        },
      },
    },
  },
  HeavyExoskeleton_Svoboda_Armor_HeadlessArmors_headless: {
    refkey: "HeavyExoskeleton_Svoboda_Armor",
    _extras: {
      keysForRemoval: { "entries.UpgradePrototypeSIDs.entries": "FaustPsyResist_Quest_1_1" },
      ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "HeavyExoskeleton_Svoboda_Armor_HeadlessArmors_headless",
      LocalizationSID: "HeavyExoskeleton_Svoboda_Armor",
      bBlockHead: false,
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_HeavyExoskeleton_Svoboda_Armor_headless.T_IFI_HeavyExoskeleton_Svoboda_Armor_headless'`,
      Weight: 16,
      Cost: 50000,
      Protection: {
        entries: {
          Radiation: 25,
          PSY: 0,
        },
      },
    },
  },
  HeavyExoskeleton_Varta_Armor_HeadlessArmors_headless: {
    refkey: "HeavyExoskeleton_Varta_Armor",
    _extras: {
      keysForRemoval: { "entries.UpgradePrototypeSIDs.entries": "FaustPsyResist_Quest_1_1" },
      ItemGenerator: { Category: "EItemGenerationCategory::BodyArmor", PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "HeavyExoskeleton_Varta_Armor_HeadlessArmors_headless",
      LocalizationSID: "HeavyExoskeleton_Varta_Armor",
      bBlockHead: false,
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_HeavyExoskeleton_Varta_Armor_headless.T_IFI_HeavyExoskeleton_Varta_Armor_headless'`,
      Weight: 12,
      Cost: 45500,
      Protection: {
        entries: {
          Radiation: 25,
          PSY: 0,
        },
      },
    },
  },

  Exoskeleton_Mercenaries_Helmet_HeadlessArmors: {
    refkey: "Heavy_Svoboda_Helmet",
    _extras: {
      ItemGenerator: { Category: "EItemGenerationCategory::Head" as EItemGenerationCategory, PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "Exoskeleton_Mercenaries_Helmet_HeadlessArmors",
      LocalizationSID: "Exoskeleton_Mercenaries_Armor",
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Merc_Helmet.T_IFI_Exoskeleton_Merc_Helmet'`,
      Weight: 5,
      Cost: 45000,
      Protection: {
        entries: {
          Radiation: 40.0,
          PSY: 20.0,
          Strike: 4,
        },
      },
    },
  },
  Exoskeleton_Monolith_Helmet_HeadlessArmors: {
    refkey: "Heavy_Svoboda_Helmet",
    _extras: {
      ItemGenerator: { Category: "EItemGenerationCategory::Head" as EItemGenerationCategory, PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "Exoskeleton_Monolith_Helmet_HeadlessArmors",
      LocalizationSID: "Exoskeleton_Monolith_Armor",
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Monolith_Helmet.T_IFI_Exoskeleton_Monolith_Helmet'`,
      Weight: 5,
      Cost: 45000,
      Protection: {
        entries: {
          Radiation: 50.0,
          PSY: 20.0,
          Strike: 4,
        },
      },
    },
  },
  Exoskeleton_Neutral_Helmet_HeadlessArmors: {
    refkey: "Heavy_Svoboda_Helmet",
    _extras: {
      ItemGenerator: { Category: "EItemGenerationCategory::Head" as EItemGenerationCategory, PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "Exoskeleton_Neutral_Helmet_HeadlessArmors",
      LocalizationSID: "Exoskeleton_Neutral_Armor",
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Neutral_Helmet.T_IFI_Exoskeleton_Neutral_Helmet'`,
      Weight: 5,
      Cost: 40000,
      Protection: {
        entries: {
          Radiation: 40.0,
          PSY: 50.0,
          Strike: 4,
        },
      },
    },
  },
  Exoskeleton_Spark_Helmet_HeadlessArmors: {
    refkey: "Heavy_Svoboda_Helmet",
    _extras: {
      ItemGenerator: { Category: "EItemGenerationCategory::Head" as EItemGenerationCategory, PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "Exoskeleton_Spark_Helmet_HeadlessArmors",
      LocalizationSID: "HeavyBattle_Spark_Armor",
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Spark_Helmet.T_IFI_Exoskeleton_Spark_Helmet'`,
      Weight: 5,
      Cost: 40000,
      Protection: {
        entries: {
          Radiation: 35.0,
          PSY: 40.0,
          Strike: 4,
        },
      },
    },
  },
  Exoskeleton_Duty_Helmet_HeadlessArmors: {
    refkey: "Heavy_Svoboda_Helmet",
    _extras: {
      ItemGenerator: { Category: "EItemGenerationCategory::Head" as EItemGenerationCategory, PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "Exoskeleton_Duty_Helmet_HeadlessArmors",
      LocalizationSID: "HeavyExoskeleton_Dolg_Armor",
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Duty_Helmet.T_IFI_Exoskeleton_Duty_Helmet'`,
      Weight: 5,
      Cost: 40000,
      Protection: {
        entries: {
          Radiation: 40.0,
          PSY: 20.0,
          Strike: 4,
        },
      },
    },
  },
  Exoskeleton_Svoboda_Helmet_HeadlessArmors: {
    refkey: "Heavy_Svoboda_Helmet",
    _extras: {
      ItemGenerator: { Category: "EItemGenerationCategory::Head", PlayerRank: "ERank::Veteran, ERank::Master" },
    },
    entries: {
      SID: "Exoskeleton_Svoboda_Helmet_HeadlessArmors",
      LocalizationSID: "Heavy_Svoboda_Helmet",
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Exoskeleton_Svoboda_Helmet.T_IFI_Exoskeleton_Svoboda_Helmet'`,
      Weight: 5,
      Cost: 40000,
      Protection: {
        entries: {
          Radiation: 45.0,
          PSY: 40.0,
          Strike: 4,
        },
      },
    },
  },
  HeavyBattle_Spark_Helmet_HeadlessArmors: {
    refkey: "Battle_Military_Helmet",
    _extras: { ItemGenerator: { Category: "EItemGenerationCategory::Head", PlayerRank: "ERank::Veteran, ERank::Master" } },
    entries: {
      SID: "HeavyBattle_Spark_Helmet_HeadlessArmors",
      LocalizationSID: "Battle_Military_Helmet",
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_HeavyBattle_Spark_Helmet.T_IFI_HeavyBattle_Spark_Helmet'`,
    },
  },
  HeavyBattle_Merc_Helmet_HeadlessArmors: {
    refkey: "Battle_Military_Helmet",
    _extras: { ItemGenerator: { Category: "EItemGenerationCategory::Head", PlayerRank: "ERank::Veteran, ERank::Master" } },
    entries: {
      SID: "HeavyBattle_Merc_Helmet_HeadlessArmors",
      LocalizationSID: "Battle_Military_Helmet",
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_HeavyBattle_Merc_Helmet.T_IFI_HeavyBattle_Merc_Helmet'`,
    },
  },
  HeavyBattle_Dolg_Helmet_HeadlessArmors: {
    refkey: "Battle_Military_Helmet",
    _extras: { ItemGenerator: { Category: "EItemGenerationCategory::Head", PlayerRank: "ERank::Veteran, ERank::Master" } },
    entries: {
      SID: "HeavyBattle_Dolg_Helmet_HeadlessArmors",
      LocalizationSID: "Battle_Military_Helmet",
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_HeavyBattle_Dolg_Helmet.T_IFI_HeavyBattle_Dolg_Helmet'`,
    },
  },
} as const;

type ArmorDescriptor = {
  refkey: string;
  _extras?: {
    keysForRemoval?: { [path: string]: any };
    [key: string]: any;
  };
  PlayerRank?: ERank;
  entries: any;
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
    { refkey: "HeavyBattle_Spark_Armor", entries: { SID: "HeavyBattle_Spark_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Veteran, ERank::Master" },
    { refkey: "Battle_Spark_Armor", entries: { SID: "Battle_Spark_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Newbie, ERank::Experienced" },
    { refkey: "HeavyAnomaly_Spark_Armor", entries: { SID: "HeavyAnomaly_Spark_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Veteran" },
    { refkey: "SEVA_Spark_Armor", entries: { SID: "SEVA_Spark_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Veteran" },
    {
      refkey: "NPC_HeavyExoskeleton_Spark_Armor",
      entries: { SID: "NPC_HeavyExoskeleton_Spark_Armor_HeadlessArmors_NPC" },
      PlayerRank: "ERank::Master",
    },
    {
      refkey: "NPC_Spark_Armor",
      entries: { SID: "NPC_Spark_Armor_HeadlessArmors_NPC" },
      PlayerRank: "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master",
    },
    { refkey: "NPC_Anomaly_Spark_Armor", entries: { SID: "NPC_Anomaly_Spark_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Newbie, ERank::Experienced" },
    { refkey: newArmors.HeavyBattle_Spark_Armor_HeadlessArmors_headless.refkey, entries: { SID: "HeavyBattle_Spark_Armor_HeadlessArmors_headless" } },
    { refkey: newArmors.Exoskeleton_Spark_Helmet_HeadlessArmors.refkey, entries: { SID: "Exoskeleton_Spark_Helmet_HeadlessArmors" } },
    { refkey: newArmors.HeavyBattle_Spark_Helmet_HeadlessArmors.refkey, entries: { SID: "HeavyBattle_Spark_Helmet_HeadlessArmors" } },
  ],
  neutral: [
    { refkey: "Jemmy_Neutral_Armor", entries: { SID: "Jemmy_Neutral_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Newbie" },
    { refkey: "Newbee_Neutral_Armor", entries: { SID: "Newbee_Neutral_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Newbie" },
    { refkey: "Nasos_Neutral_Armor", entries: { SID: "Nasos_Neutral_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Experienced" },
    { refkey: "Zorya_Neutral_Armor", entries: { SID: "Zorya_Neutral_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Experienced" },
    { refkey: "SEVA_Neutral_Armor", entries: { SID: "SEVA_Neutral_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Veteran" },
    { refkey: "Exoskeleton_Neutral_Armor", entries: { SID: "Exoskeleton_Neutral_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Master" },
    { refkey: "NPC_Sel_Neutral_Armor", entries: { SID: "NPC_Sel_Neutral_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Newbie" },
    { refkey: "NPC_Cloak_Heavy_Neutral_Armor", entries: { SID: "NPC_Cloak_Heavy_Neutral_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Veteran" },
    { refkey: newArmors.Exoskeleton_Neutral_Armor_HeadlessArmors_headless.refkey, entries: { SID: "Exoskeleton_Neutral_Armor_HeadlessArmors_headless" } },
    { refkey: newArmors.Exoskeleton_Neutral_Helmet_HeadlessArmors.refkey, entries: { SID: "Exoskeleton_Neutral_Helmet_HeadlessArmors" } },
  ],
  bandit: [
    { refkey: "SkinJacket_Bandit_Armor", entries: { SID: "SkinJacket_Bandit_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Newbie" },
    {
      refkey: "Jacket_Bandit_Armor",
      entries: { SID: "Jacket_Bandit_Armor_HeadlessArmors_NPC" },
      PlayerRank: "ERank::Experienced, ERank::Veteran, ERank::Master",
    },
    {
      refkey: "Middle_Bandit_Armor",
      entries: { SID: "Middle_Bandit_Armor_HeadlessArmors_NPC" },
      PlayerRank: "ERank::Experienced, ERank::Veteran, ERank::Master",
    },
    { refkey: "NPC_SkinCloak_Bandit_Armor", entries: { SID: "NPC_SkinCloak_Bandit_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Newbie" },
  ],
  mercenary: [
    { refkey: "Light_Mercenaries_Armor", entries: { SID: "Light_Mercenaries_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Newbie" },
    { refkey: "Exoskeleton_Mercenaries_Armor", entries: { SID: "Exoskeleton_Mercenaries_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Master" },
    { refkey: "Heavy_Mercenaries_Armor", entries: { SID: "Heavy_Mercenaries_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Veteran, ERank::Master" },
    {
      refkey: "NPC_HeavyExoskeleton_Mercenaries_Armor",
      entries: { SID: "NPC_HeavyExoskeleton_Mercenaries_Armor_HeadlessArmors_NPC" },
      PlayerRank: "ERank::Master",
    },
    { refkey: newArmors.Heavy_Mercenaries_Armor_HeadlessArmors_headless.refkey, entries: { SID: "Heavy_Mercenaries_Armor_HeadlessArmors_headless" } },
    {
      refkey: newArmors.Exoskeleton_Mercenaries_Armor_HeadlessArmors_headless.refkey,
      entries: { SID: "Exoskeleton_Mercenaries_Armor_HeadlessArmors_headless" },
    },
    { refkey: newArmors.Exoskeleton_Mercenaries_Helmet_HeadlessArmors.refkey, entries: { SID: "Exoskeleton_Mercenaries_Helmet_HeadlessArmors" } },
    { refkey: newArmors.HeavyBattle_Merc_Helmet_HeadlessArmors.refkey, entries: { SID: "HeavyBattle_Merc_Helmet_HeadlessArmors" } },
  ],
  military: [
    { refkey: "Default_Military_Armor", entries: { SID: "Default_Military_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Newbie, ERank::Experienced" },
    { refkey: "Heavy2_Military_Armor", entries: { SID: "Heavy2_Military_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Veteran, ERank::Master" },
    { refkey: "NPC_Heavy_Military_Armor", entries: { SID: "NPC_Heavy_Military_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Veteran, ERank::Master" },
    {
      refkey: "NPC_Cloak_Heavy_Military_Armor",
      entries: { SID: "NPC_Cloak_Heavy_Military_Armor_HeadlessArmors_NPC" },
      PlayerRank: "ERank::Veteran, ERank::Master",
    },
    { refkey: newArmors.Heavy2_Military_Armor_HeadlessArmors_headless.refkey, entries: { SID: "Heavy2_Military_Armor_HeadlessArmors_headless" } },
  ],
  corpus: [
    { refkey: "NPC_Heavy_Corps_Armor", entries: { SID: "NPC_Heavy_Corps_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Veteran, ERank::Master" },
    { refkey: "NPC_Heavy3_Corps_Armor", entries: { SID: "NPC_Heavy3_Corps_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Veteran, ERank::Master" },
    { refkey: "NPC_Heavy2_Coprs_Armor", entries: { SID: "NPC_Heavy2_Coprs_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Veteran, ERank::Master" },
    {
      refkey: "NPC_Heavy3Exoskeleton_Coprs_Armor",
      entries: { SID: "NPC_Heavy3Exoskeleton_Coprs_Armor_HeadlessArmors_NPC" },
      PlayerRank: "ERank::Veteran, ERank::Master",
    },
    {
      refkey: "NPC_Exoskeleton_Coprs_Armor",
      entries: { SID: "NPC_Exoskeleton_Coprs_Armor_HeadlessArmors_NPC" },
      PlayerRank: "ERank::Veteran, ERank::Master",
    },
    { refkey: "Battle_Dolg_End_Armor", entries: { SID: "Battle_Dolg_End_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Master" },
  ],
  scientist: [
    {
      refkey: "Anomaly_Scientific_Armor",
      entries: { SID: "Anomaly_Scientific_Armor_HeadlessArmors_NPC" },
      PlayerRank: "ERank::Newbie, ERank::Experienced",
    },
    {
      refkey: "HeavyAnomaly_Scientific_Armor",
      entries: { SID: "HeavyAnomaly_Scientific_Armor_HeadlessArmors_NPC" },
      PlayerRank: "ERank::Experienced, ERank::Veteran, ERank::Master",
    },
    { refkey: "SciSEVA_Scientific_Armor", entries: { SID: "SciSEVA_Scientific_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Veteran, ERank::Master" },
    {
      refkey: "NPC_Sci_Armor",
      entries: { SID: "NPC_Sci_Armor_HeadlessArmors_NPC" },
      PlayerRank: "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master",
    },
  ],
  freedom: [
    { refkey: "Rook_Svoboda_Armor", entries: { SID: "Rook_Svoboda_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Newbie" },
    { refkey: "Battle_Svoboda_Armor", entries: { SID: "Battle_Svoboda_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Experienced" },
    { refkey: "SEVA_Svoboda_Armor", entries: { SID: "SEVA_Svoboda_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Veteran" },
    { refkey: "Heavy_Svoboda_Armor", entries: { SID: "Heavy_Svoboda_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Veteran, ERank::Master" },
    { refkey: "HeavyExoskeleton_Svoboda_Armor", entries: { SID: "HeavyExoskeleton_Svoboda_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Master" },
    { refkey: "Exoskeleton_Svoboda_Armor", entries: { SID: "Exoskeleton_Svoboda_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Master" },
    { refkey: newArmors.Exoskeleton_Svoboda_Armor_HeadlessArmors_headless.refkey, entries: { SID: "Exoskeleton_Svoboda_Armor_HeadlessArmors_headless" } },
    {
      refkey: newArmors.HeavyExoskeleton_Svoboda_Armor_HeadlessArmors_headless.refkey,
      entries: { SID: "HeavyExoskeleton_Svoboda_Armor_HeadlessArmors_headless" },
    },
    { refkey: newArmors.Heavy_Svoboda_Armor_HeadlessArmors_headless.refkey, entries: { SID: "Heavy_Svoboda_Armor_HeadlessArmors_headless" } },
    { refkey: newArmors.Exoskeleton_Svoboda_Helmet_HeadlessArmors.refkey, entries: { SID: "Exoskeleton_Svoboda_Helmet_HeadlessArmors" } },
  ],
  duty: [
    { refkey: "Rook_Dolg_Armor", entries: { SID: "Rook_Dolg_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Newbie" },
    { refkey: "Battle_Dolg_Armor", entries: { SID: "Battle_Dolg_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Experienced" },
    { refkey: "SEVA_Dolg_Armor", entries: { SID: "SEVA_Dolg_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Experienced" },
    { refkey: "Heavy_Dolg_Armor", entries: { SID: "Heavy_Dolg_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Veteran, ERank::Master" },
    { refkey: "HeavyExoskeleton_Dolg_Armor", entries: { SID: "HeavyExoskeleton_Dolg_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Master" },
    { refkey: "Exoskeleton_Dolg_Armor", entries: { SID: "Exoskeleton_Dolg_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Master" },
    { refkey: newArmors.Exoskeleton_Dolg_Armor_HeadlessArmors_headless.refkey, entries: { SID: "Exoskeleton_Dolg_Armor_HeadlessArmors_headless" } },
    { refkey: newArmors.HeavyExoskeleton_Dolg_Armor_HeadlessArmors_headless.refkey, entries: { SID: "HeavyExoskeleton_Dolg_Armor_HeadlessArmors_headless" } },
    { refkey: newArmors.Heavy_Dolg_Armor_HeadlessArmors_headless.refkey, entries: { SID: "Heavy_Dolg_Armor_HeadlessArmors_headless" } },
    { refkey: newArmors.Exoskeleton_Duty_Helmet_HeadlessArmors.refkey, entries: { SID: "Exoskeleton_Duty_Helmet_HeadlessArmors" } },
    { refkey: newArmors.HeavyBattle_Dolg_Helmet_HeadlessArmors.refkey, entries: { SID: "HeavyBattle_Dolg_Helmet_HeadlessArmors" } },
  ],
  monolith: [
    { refkey: "NPC_Battle_Noon_Armor", entries: { SID: "NPC_Battle_Noon_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Newbie, ERank::Experienced" },
    {
      refkey: "NPC_HeavyAnomaly_Noon_Armor",
      entries: { SID: "NPC_HeavyAnomaly_Noon_Armor_HeadlessArmors_NPC" },
      PlayerRank: "ERank::Veteran, ERank::Master",
    },
    { refkey: "NPC_HeavyExoskeleton_Noon_Armor", entries: { SID: "NPC_HeavyExoskeleton_Noon_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Master" },
    { refkey: "NPC_Exoskeleton_Noon_Armor", entries: { SID: "NPC_Exoskeleton_Noon_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Master" },
    { refkey: "Battle_Monolith_Armor", entries: { SID: "Battle_Monolith_Armor_HeadlessArmors_NPC" }, PlayerRank: "ERank::Newbie, ERank::Experienced" },
    {
      refkey: "HeavyAnomaly_Monolith_Armor",
      entries: { SID: "HeavyAnomaly_Monolith_Armor_HeadlessArmors_NPC" },
      PlayerRank: "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master",
    },
    {
      refkey: "HeavyExoskeleton_Monolith_Armor",
      entries: { SID: "HeavyExoskeleton_Monolith_Armor_HeadlessArmors_NPC" },
      PlayerRank: "ERank::Veteran, ERank::Master",
    },
    {
      refkey: "Exoskeleton_Monolith_Armor",
      entries: { SID: "Exoskeleton_Monolith_Armor_HeadlessArmors_NPC" },
      PlayerRank: "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master",
    },
    { refkey: newArmors.Exoskeleton_Monolith_Armor_HeadlessArmors_headless.refkey, entries: { SID: "Exoskeleton_Monolith_Armor_HeadlessArmors_headless" } },
    {
      refkey: newArmors.HeavyExoskeleton_Monolith_Armor_HeadlessArmors_headless.refkey,
      entries: { SID: "HeavyExoskeleton_Monolith_Armor_HeadlessArmors_headless" },
    },
    { refkey: newArmors.HeavyAnomaly_Monolith_Armor_HeadlessArmors_headless.refkey, entries: { SID: "HeavyAnomaly_Monolith_Armor_HeadlessArmors_headless" } },
    { refkey: newArmors.Exoskeleton_Monolith_Helmet_HeadlessArmors.refkey, entries: { SID: "Exoskeleton_Monolith_Helmet_HeadlessArmors" } },
  ],
  varta: [
    {
      refkey: "Battle_Varta_Armor",
      entries: { SID: "Battle_Varta_Armor_HeadlessArmors_NPC" },
      PlayerRank: "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master",
    },
    {
      refkey: "BattleExoskeleton_Varta_Armor",
      entries: { SID: "BattleExoskeleton_Varta_Armor_HeadlessArmors_NPC" },
      PlayerRank: "ERank::Veteran, ERank::Master",
    },
    {
      refkey: newArmors.BattleExoskeleton_Varta_Armor_HeadlessArmors_headless.refkey,
      entries: { SID: "BattleExoskeleton_Varta_Armor_HeadlessArmors_headless" },
    },
    { refkey: newArmors.HeavyExoskeleton_Varta_Armor_HeadlessArmors_headless.refkey, entries: { SID: "HeavyExoskeleton_Varta_Armor_HeadlessArmors_headless" } },
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
