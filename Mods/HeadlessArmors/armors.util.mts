import { ArmorPrototype, Struct } from "s2cfgtojson";
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
        fs.readFileSync(path.join(BASE_CFG_DIR, "DLCGameData", "Deluxe", "ItemPrototypes", "ArmorPrototypes.cfg"), "utf8"),
        fs.readFileSync(path.join(BASE_CFG_DIR, "DLCGameData", "PreOrder", "ItemPrototypes", "ArmorPrototypes.cfg"), "utf8"),
        fs.readFileSync(path.join(BASE_CFG_DIR, "DLCGameData", "Ultimate", "ItemPrototypes", "ArmorPrototypes.cfg"), "utf8"),
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

export const newHeadlessArmors = {
  BattleExoskeleton_Varta_Armor_MasterMod_headless: {
    refkey: "BattleExoskeleton_Varta_Armor",
    entries: {
      SID: "BattleExoskeleton_Varta_Armor_MasterMod_headless",
      LocalizationSID: "BattleExoskeleton_Varta_Armor",
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
  Exoskeleton_Mercenaries_Armor_MasterMod_headless: {
    refkey: "Exoskeleton_Mercenaries_Armor",
    entries: {
      SID: "Exoskeleton_Mercenaries_Armor_MasterMod_headless",
      LocalizationSID: "Exoskeleton_Mercenaries_Armor",
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
  Exoskeleton_Monolith_Armor_MasterMod_headless: {
    refkey: "Exoskeleton_Monolith_Armor",
    entries: {
      SID: "Exoskeleton_Monolith_Armor_MasterMod_headless",
      LocalizationSID: "Exoskeleton_Monolith_Armor",
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
  Exoskeleton_Neutral_Armor_MasterMod_headless: {
    refkey: "Exoskeleton_Neutral_Armor",
    entries: {
      SID: "Exoskeleton_Neutral_Armor_MasterMod_headless",
      LocalizationSID: "Exoskeleton_Neutral_Armor",
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
  Exoskeleton_Svoboda_Armor_MasterMod_headless: {
    refkey: "Exoskeleton_Svoboda_Armor",
    entries: {
      SID: "Exoskeleton_Svoboda_Armor_MasterMod_headless",
      LocalizationSID: "Exoskeleton_Svoboda_Armor",
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
  Heavy_Dolg_Armor_MasterMod_headless: {
    refkey: "Heavy_Dolg_Armor",
    entries: {
      SID: "Heavy_Dolg_Armor_MasterMod_headless",
      LocalizationSID: "Heavy_Dolg_Armor",
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
  Heavy2_Military_Armor_MasterMod_headless: {
    refkey: "Heavy2_Military_Armor",
    entries: {
      SID: "Heavy2_Military_Armor_MasterMod_headless",
      LocalizationSID: "Heavy2_Military_Armor",
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
  HeavyAnomaly_Monolith_Armor_MasterMod_headless: {
    refkey: "HeavyAnomaly_Monolith_Armor",
    entries: {
      SID: "HeavyAnomaly_Monolith_Armor_MasterMod_headless",
      LocalizationSID: "HeavyAnomaly_Monolith_Armor",
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
  Exoskeleton_Dolg_Armor_MasterMod_headless: {
    refkey: "Exoskeleton_Dolg_Armor",
    entries: {
      SID: "Exoskeleton_Dolg_Armor_MasterMod_headless",
      LocalizationSID: "Exoskeleton_Dolg_Armor",
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
  Heavy_Svoboda_Armor_MasterMod_headless: {
    refkey: "Heavy_Svoboda_Armor",
    entries: {
      SID: "Heavy_Svoboda_Armor_MasterMod_headless",
      LocalizationSID: "Heavy_Svoboda_Armor",
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
  Heavy_Mercenaries_Armor_MasterMod_headless: {
    refkey: "Heavy_Mercenaries_Armor",
    entries: {
      SID: "Heavy_Mercenaries_Armor_MasterMod_headless",
      LocalizationSID: "Heavy_Mercenaries_Armor",
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
  HeavyBattle_Spark_Armor_MasterMod_headless: {
    refkey: "HeavyBattle_Spark_Armor",
    entries: {
      SID: "HeavyBattle_Spark_Armor_MasterMod_headless",
      LocalizationSID: "HeavyBattle_Spark_Armor",
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
  HeavyExoskeleton_Dolg_Armor_MasterMod_headless: {
    refkey: "HeavyExoskeleton_Dolg_Armor",
    entries: {
      SID: "HeavyExoskeleton_Dolg_Armor_MasterMod_headless",
      LocalizationSID: "HeavyExoskeleton_Dolg_Armor",
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
  NPC_HeavyExoskeleton_Mercenaries_Armor_MasterMod_headless: {
    refkey: "NPC_HeavyExoskeleton_Mercenaries_Armor",
    entries: {
      SID: "NPC_HeavyExoskeleton_Mercenaries_Armor_MasterMod_headless",
      LocalizationSID: "NPC_HeavyExoskeleton_Mercenaries_Armor",
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_HeavyExoskeleton_Mercenaries_Armor_headless.T_IFI_HeavyExoskeleton_Mercenaries_Armor_headless'`,
      Weight: 5,
      Cost: 58000,
      Protection: {
        entries: {
          Radiation: 5,
          PSY: 0,
        },
      },
    },
  },
  HeavyExoskeleton_Monolith_Armor_MasterMod_headless: {
    refkey: "HeavyExoskeleton_Monolith_Armor",
    entries: {
      SID: "HeavyExoskeleton_Monolith_Armor_MasterMod_headless",
      LocalizationSID: "HeavyExoskeleton_Monolith_Armor",
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
  HeavyExoskeleton_Svoboda_Armor_MasterMod_headless: {
    refkey: "HeavyExoskeleton_Svoboda_Armor",
    entries: {
      SID: "HeavyExoskeleton_Svoboda_Armor_MasterMod_headless",
      LocalizationSID: "HeavyExoskeleton_Svoboda_Armor",
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
  HeavyExoskeleton_Varta_Armor_MasterMod_headless: {
    refkey: "HeavyExoskeleton_Varta_Armor",
    entries: {
      SID: "HeavyExoskeleton_Varta_Armor_MasterMod_headless",
      LocalizationSID: "HeavyExoskeleton_Varta_Armor",
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
} as const;

export const extraArmorsByFaction = {
  spark: [
    ["HeavyBattle_Spark_Armor", "HeavyBattle_Spark_Armor_MasterMod_NPC"],
    ["Battle_Spark_Armor", "Battle_Spark_Armor_MasterMod_NPC"],
    ["HeavyAnomaly_Spark_Armor", "HeavyAnomaly_Spark_Armor_MasterMod_NPC"],
    ["SEVA_Spark_Armor", "SEVA_Spark_Armor_MasterMod_NPC"],
    ["NPC_HeavyExoskeleton_Spark_Armor", "NPC_HeavyExoskeleton_Spark_Armor_MasterMod_NPC"],
    ["NPC_Spark_Armor", "NPC_Spark_Armor_MasterMod_NPC"],
    ["NPC_Anomaly_Spark_Armor", "NPC_Anomaly_Spark_Armor_MasterMod_NPC"],
    [newHeadlessArmors.HeavyBattle_Spark_Armor_MasterMod_headless.refkey, "HeavyBattle_Spark_Armor_MasterMod_headless"],
  ],
  neutral: [
    ["Jemmy_Neutral_Armor", "Jemmy_Neutral_Armor_MasterMod_NPC"],
    ["Newbee_Neutral_Armor", "Newbee_Neutral_Armor_MasterMod_NPC"],
    ["Nasos_Neutral_Armor", "Nasos_Neutral_Armor_MasterMod_NPC"],
    ["Zorya_Neutral_Armor", "Zorya_Neutral_Armor_MasterMod_NPC"],
    ["SEVA_Neutral_Armor", "SEVA_Neutral_Armor_MasterMod_NPC"],
    ["Exoskeleton_Neutral_Armor", "Exoskeleton_Neutral_Armor_MasterMod_NPC"],
    ["NPC_Sel_Neutral_Armor", "NPC_Sel_Neutral_Armor_MasterMod_NPC"],
    ["NPC_Cloak_Heavy_Neutral_Armor", "NPC_Cloak_Heavy_Neutral_Armor_MasterMod_NPC"],
    [newHeadlessArmors.Exoskeleton_Neutral_Armor_MasterMod_headless.refkey, "Exoskeleton_Neutral_Armor_MasterMod_headless"],
  ],
  bandit: [
    ["SkinJacket_Bandit_Armor", "SkinJacket_Bandit_Armor_MasterMod_NPC"],
    ["Jacket_Bandit_Armor", "Jacket_Bandit_Armor_MasterMod_NPC"],
    ["Middle_Bandit_Armor", "Middle_Bandit_Armor_MasterMod_NPC"],
    ["NPC_SkinCloak_Bandit_Armor", "NPC_SkinCloak_Bandit_Armor_MasterMod_NPC"],
  ],
  mercenary: [
    ["Light_Mercenaries_Armor", "Light_Mercenaries_Armor_MasterMod_NPC"],
    ["Exoskeleton_Mercenaries_Armor", "Exoskeleton_Mercenaries_Armor_MasterMod_NPC"],
    ["Heavy_Mercenaries_Armor", "Heavy_Mercenaries_Armor_MasterMod_NPC"],
    ["NPC_HeavyExoskeleton_Mercenaries_Armor", "NPC_HeavyExoskeleton_Mercenaries_Armor_MasterMod_NPC"],
    [newHeadlessArmors.NPC_HeavyExoskeleton_Mercenaries_Armor_MasterMod_headless.refkey, "NPC_HeavyExoskeleton_Mercenaries_Armor_MasterMod_headless"],
    [newHeadlessArmors.Heavy_Mercenaries_Armor_MasterMod_headless.refkey, "Heavy_Mercenaries_Armor_MasterMod_headless"],
    [newHeadlessArmors.Exoskeleton_Mercenaries_Armor_MasterMod_headless.refkey, "Exoskeleton_Mercenaries_Armor_MasterMod_headless"],
  ],
  military: [
    ["Default_Military_Armor", "Default_Military_Armor_MasterMod_NPC"],
    ["Heavy2_Military_Armor", "Heavy2_Military_Armor_MasterMod_NPC"],
    ["NPC_Heavy_Military_Armor", "NPC_Heavy_Military_Armor_MasterMod_NPC"],
    ["NPC_Cloak_Heavy_Military_Armor", "NPC_Cloak_Heavy_Military_Armor_MasterMod_NPC"],
    [newHeadlessArmors.Heavy2_Military_Armor_MasterMod_headless.refkey, "Heavy2_Military_Armor_MasterMod_headless"],
  ],
  corpus: [
    ["NPC_Heavy_Corps_Armor", "NPC_Heavy_Corps_Armor_MasterMod_NPC"],
    ["NPC_Heavy3_Corps_Armor", "NPC_Heavy3_Corps_Armor_MasterMod_NPC"],
    ["NPC_Heavy2_Coprs_Armor", "NPC_Heavy2_Coprs_Armor_MasterMod_NPC"],
    ["NPC_Heavy3Exoskeleton_Coprs_Armor", "NPC_Heavy3Exoskeleton_Coprs_Armor_MasterMod_NPC"],
    ["NPC_Exoskeleton_Coprs_Armor", "NPC_Exoskeleton_Coprs_Armor_MasterMod_NPC"],
  ],
  scientist: [
    ["Anomaly_Scientific_Armor", "Anomaly_Scientific_Armor_MasterMod_NPC"],
    ["HeavyAnomaly_Scientific_Armor", "HeavyAnomaly_Scientific_Armor_MasterMod_NPC"],
    ["SciSEVA_Scientific_Armor", "SciSEVA_Scientific_Armor_MasterMod_NPC"],
    ["Anomaly_Scientific_Armor_PSY_preinstalled", "Anomaly_Scientific_Armor_PSY_preinstalled_MasterMod_NPC"],
    ["NPC_Sci_Armor", "NPC_Sci_Armor_MasterMod_NPC"],
  ],
  freedom: [
    ["Rook_Svoboda_Armor", "Rook_Svoboda_Armor_MasterMod_NPC"],
    ["Battle_Svoboda_Armor", "Battle_Svoboda_Armor_MasterMod_NPC"],
    ["SEVA_Svoboda_Armor", "SEVA_Svoboda_Armor_MasterMod_NPC"],
    ["Heavy_Svoboda_Armor", "Heavy_Svoboda_Armor_MasterMod_NPC"],
    ["HeavyExoskeleton_Svoboda_Armor", "HeavyExoskeleton_Svoboda_Armor_MasterMod_NPC"],
    ["Exoskeleton_Svoboda_Armor", "Exoskeleton_Svoboda_Armor_MasterMod_NPC"],
    [newHeadlessArmors.Exoskeleton_Svoboda_Armor_MasterMod_headless.refkey, "Exoskeleton_Svoboda_Armor_MasterMod_headless"],
    [newHeadlessArmors.HeavyExoskeleton_Svoboda_Armor_MasterMod_headless.refkey, "HeavyExoskeleton_Svoboda_Armor_MasterMod_headless"],
    [newHeadlessArmors.Heavy_Svoboda_Armor_MasterMod_headless.refkey, "Heavy_Svoboda_Armor_MasterMod_headless"],
  ],
  duty: [
    ["Rook_Dolg_Armor", "Rook_Dolg_Armor_MasterMod_NPC"],
    ["Battle_Dolg_Armor", "Battle_Dolg_Armor_MasterMod_NPC"],
    ["SEVA_Dolg_Armor", "SEVA_Dolg_Armor_MasterMod_NPC"],
    ["Heavy_Dolg_Armor", "Heavy_Dolg_Armor_MasterMod_NPC"],
    ["HeavyExoskeleton_Dolg_Armor", "HeavyExoskeleton_Dolg_Armor_MasterMod_NPC"],
    ["Exoskeleton_Dolg_Armor", "Exoskeleton_Dolg_Armor_MasterMod_NPC"],
    ["Battle_Dolg_End_Armor", "Battle_Dolg_End_Armor_MasterMod_NPC"],
    [newHeadlessArmors.Exoskeleton_Dolg_Armor_MasterMod_headless.refkey, "Exoskeleton_Dolg_Armor_MasterMod_headless"],
    [newHeadlessArmors.HeavyExoskeleton_Dolg_Armor_MasterMod_headless.refkey, "HeavyExoskeleton_Dolg_Armor_MasterMod_headless"],
    [newHeadlessArmors.Heavy_Dolg_Armor_MasterMod_headless.refkey, "Heavy_Dolg_Armor_MasterMod_headless"],
  ],
  monolith: [
    ["NPC_Battle_Noon_Armor", "NPC_Battle_Noon_Armor_MasterMod_NPC"],
    ["NPC_HeavyAnomaly_Noon_Armor", "NPC_HeavyAnomaly_Noon_Armor_MasterMod_NPC"],
    ["NPC_HeavyExoskeleton_Noon_Armor", "NPC_HeavyExoskeleton_Noon_Armor_MasterMod_NPC"],
    ["NPC_Exoskeleton_Noon_Armor", "NPC_Exoskeleton_Noon_Armor_MasterMod_NPC"],
    ["Battle_Monolith_Armor", "Battle_Monolith_Armor_MasterMod_NPC"],
    ["HeavyAnomaly_Monolith_Armor", "HeavyAnomaly_Monolith_Armor_MasterMod_NPC"],
    ["HeavyExoskeleton_Monolith_Armor", "HeavyExoskeleton_Monolith_Armor_MasterMod_NPC"],
    ["Exoskeleton_Monolith_Armor", "Exoskeleton_Monolith_Armor_MasterMod_NPC"],
    [newHeadlessArmors.Exoskeleton_Monolith_Armor_MasterMod_headless.refkey, "Exoskeleton_Monolith_Armor_MasterMod_headless"],
    [newHeadlessArmors.HeavyExoskeleton_Monolith_Armor_MasterMod_headless.refkey, "HeavyExoskeleton_Monolith_Armor_MasterMod_headless"],
    [newHeadlessArmors.HeavyAnomaly_Monolith_Armor_MasterMod_headless.refkey, "HeavyAnomaly_Monolith_Armor_MasterMod_headless"],
  ],
  varta: [
    ["Battle_Varta_Armor", "Battle_Varta_Armor_MasterMod_NPC"],
    ["BattleExoskeleton_Varta_Armor", "BattleExoskeleton_Varta_Armor_MasterMod_NPC"],
    [newHeadlessArmors.BattleExoskeleton_Varta_Armor_MasterMod_headless.refkey, "BattleExoskeleton_Varta_Armor_MasterMod_headless"],
    [newHeadlessArmors.HeavyExoskeleton_Varta_Armor_MasterMod_headless.refkey, "HeavyExoskeleton_Varta_Armor_MasterMod_headless"],
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
