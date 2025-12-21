import {
  AmmoPrototype,
  ArmorPrototype,
  AttachPrototype,
  ConsumablePrototype,
  EItemGenerationCategory,
  ERank,
  GrenadePrototype,
  Internal,
  NPCWeaponSettingsPrototype,
  SpawnActorPrototype,
  WeaponGeneralSetupPrototype,
  WeaponPrototype,
} from "s2cfgtojson";
import { readFileAndGetStructs } from "./read-file-and-get-structs.mjs";

export const ALL_RANK = "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master" as ERank;
export const MASTER_RANK = "ERank::Master" as ERank;
export const VETERAN_MASTER_RANK = "ERank::Veteran, ERank::Master" as ERank;
export const EXPERIENCED_MASTER_RANK = "ERank::Experienced, ERank::Veteran, ERank::Master" as ERank;

export const ALL_RANKS_ARR = ALL_RANK.split(", ") as ERank[];
export const ALL_RANKS_SET = new Set(ALL_RANKS_ARR);

export const allDefaultWeaponGeneralSetupPrototypes = await readFileAndGetStructs<WeaponGeneralSetupPrototype>(
  "WeaponData/WeaponGeneralSetupPrototypes.cfg",
);
export const allDefaultPlayerWeaponSettingsPrototypes = await readFileAndGetStructs<NPCWeaponSettingsPrototype>(
  "WeaponData/CharacterWeaponSettingsPrototypes/PlayerWeaponSettingsPrototypes.cfg",
);

export const allDefaultArmorPrototypes = await readFileAndGetStructs<ArmorPrototype>(
  "ItemPrototypes/ArmorPrototypes.cfg",
);
export const allDefaultArtifactPrototypes = await readFileAndGetStructs<SpawnActorPrototype>(`/ArtifactPrototypes.cfg`);
export const allDefaultNightVisionGogglesPrototypes = await readFileAndGetStructs<ArmorPrototype>(
  "ItemPrototypes/NightVisionGogglesPrototypes.cfg",
);
export const allDefaultAmmoPrototypes = await readFileAndGetStructs<AmmoPrototype>("ItemPrototypes/AmmoPrototypes.cfg");
export const allDefaultConsumablePrototypes = await readFileAndGetStructs<ConsumablePrototype>(
  "ItemPrototypes/ConsumablePrototypes.cfg",
);
export const allDefaultGrenadePrototypes = await readFileAndGetStructs<GrenadePrototype>(
  "ItemPrototypes/GrenadePrototypes.cfg",
);

export const allDefaultQuestItemPrototypes =
  await readFileAndGetStructs<SpawnActorPrototype>(`/QuestItemPrototypes.cfg`);

export const allDefaultWeaponPrototypes = await readFileAndGetStructs<WeaponPrototype>(
  "ItemPrototypes/WeaponPrototypes.cfg",
);
export const allDefaultWeaponDefs = Object.fromEntries(allDefaultWeaponPrototypes.map((e) => [e.SID, e]));
export const allDefaultAttachPrototypes = await readFileAndGetStructs<AttachPrototype>(
  "ItemPrototypes/AttachPrototypes.cfg",
);

export const allDefaultArmorDefs = Object.fromEntries(allDefaultArmorPrototypes.map((e) => [e.SID, e] as const));
export const allDefaultNightVisionGogglesDefs = Object.fromEntries(
  allDefaultNightVisionGogglesPrototypes.map((e) => [e.SID, e] as const),
);
export type DeeplyPartial<T> = {
  [P in Exclude<keyof T, Internal | "toString">]?: T[P] extends object ? DeeplyPartial<T[P]> : T[P];
};
export type ArmorDescriptor = {
  __internal__: {
    refkey?: string | number;
    _extras?: {
      keysForRemoval?: Record<string, string | number | string[] | number[]>;
      ItemGenerator?: { Category: `${EItemGenerationCategory}`; PlayerRank: `${ERank}` };
      isDroppable?: boolean;
    };
  };
} & DeeplyPartial<ArmorPrototype>;

const getDefaultDroppableArmorDescriptor = (struct: ArmorPrototype, PlayerRank: ERank) => {
  const clone = struct.clone();
  return Object.assign(clone, {
    __internal__: Object.assign(clone.__internal__, {
      _extras: {
        isDroppable: true,
        ItemGenerator: {
          Category: "EItemGenerationCategory::BodyArmor" as EItemGenerationCategory,
          PlayerRank,
        },
      },
    }),
  });
};
export const allDefaultDroppableArmorsByFaction: {
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
  bandit: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Light_Bandit_Helmet, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.SkinJacket_Bandit_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Jacket_Bandit_Armor, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Middle_Bandit_Armor, EXPERIENCED_MASTER_RANK),
  ],
  corpus: [],
  duty: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Light_Duty_Helmet, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Heavy_Duty_Helmet, EXPERIENCED_MASTER_RANK),

    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Rook_Dolg_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Battle_Dolg_Armor, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.SEVA_Dolg_Armor, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Heavy_Dolg_Armor, VETERAN_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.HeavyExoskeleton_Dolg_Armor, MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Exoskeleton_Dolg_Armor, MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Battle_Dolg_End_Armor, MASTER_RANK),
  ],
  freedom: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Heavy_Svoboda_Helmet, VETERAN_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Rook_Svoboda_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Battle_Svoboda_Armor, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.SEVA_Svoboda_Armor, VETERAN_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Heavy_Svoboda_Armor, VETERAN_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.HeavyExoskeleton_Svoboda_Armor, MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Exoskeleton_Svoboda_Armor, MASTER_RANK),
  ],
  mercenary: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Light_Mercenaries_Helmet, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Light_Mercenaries_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Heavy_Mercenaries_Armor, VETERAN_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Exoskeleton_Mercenaries_Armor, MASTER_RANK),
  ],
  military: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Heavy_Military_Helmet, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Light_Military_Helmet, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Battle_Military_Helmet, VETERAN_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Default_Military_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Heavy2_Military_Armor, VETERAN_MASTER_RANK),
  ],
  monolith: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Battle_Monolith_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.HeavyAnomaly_Monolith_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.HeavyExoskeleton_Monolith_Armor, VETERAN_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Exoskeleton_Monolith_Armor, ALL_RANK),
  ],
  neutral: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Light_Neutral_Helmet, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Jemmy_Neutral_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Newbee_Neutral_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Nasos_Neutral_Armor, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Zorya_Neutral_Armor, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.SEVA_Neutral_Armor, VETERAN_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Exoskeleton_Neutral_Armor, MASTER_RANK),
  ],
  scientist: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Anomaly_Scientific_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.HeavyAnomaly_Scientific_Armor, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.SciSEVA_Scientific_Armor, VETERAN_MASTER_RANK),
  ],
  spark: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Battle_Spark_Armor, VETERAN_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.SEVA_Spark_Armor, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.HeavyAnomaly_Spark_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.HeavyBattle_Spark_Armor, VETERAN_MASTER_RANK),
  ],
  varta: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Heavy_Varta_Helmet, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.Battle_Varta_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorDefs.BattleExoskeleton_Varta_Armor, VETERAN_MASTER_RANK),
  ],
};

export const RSQLessThan3QuestNodesSIDs = new Set([
  "RSQ01_If_LessThen3Tasks",
  "RSQ04_If_LessThen3Tasks",
  "RSQ05_If_LessThen3Tasks",
  "RSQ06_C00___SIDOROVICH_If_LessThen3Tasks",
  "RSQ07_C00_TSEMZAVOD_If_LessThen3Tasks",
  "RSQ08_C00_ROSTOK_If_LessThen3Tasks",
  "RSQ09_C00_MALAHIT_If_LessThen3Tasks",
  "RSQ10_C00_HARPY_If_LessThen3Tasks",
]);
export const RSQSetDialogQuestNodesSIDs = new Set([
  "RSQ01_SetDialog_WarlockRSQ",
  "RSQ04_SetDialog_DrabadanRSQ_1",
  "RSQ05_SetDialog_SichRSQ",
  "RSQ06_C00___SIDOROVICH_SetDialog_SichRSQ",
  "RSQ07_C00_TSEMZAVOD_SetDialog_SichRSQ",
  "RSQ08_C00_ROSTOK_SetDialog_SichRSQ",
  "RSQ09_C00_MALAHIT_SetDialog_SichRSQ",
  "RSQ10_C00_HARPY_SetDialog_SichRSQ",
]);
export const RSQRandomizerQuestNodesSIDs = [
  "RSQ01_Random",
  "RSQ04_Random",
  "RSQ05_Random",
  "RSQ06_C00___SIDOROVICH_Random",
  "RSQ07_C00_TSEMZAVOD_Random",
  "RSQ08_C00_ROSTOK_Random",
  "RSQ09_C00_MALAHIT_Random",
  "RSQ10_C00_HARPY_Random",
];
