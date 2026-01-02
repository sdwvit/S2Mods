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
export type DeeplyPartial<T> = {
  [P in Exclude<keyof T, Internal | "toString">]?: T[P] extends object ? DeeplyPartial<T[P]> : T[P];
};
export const ALL_RANK = "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master" as ERank;
export const MASTER_RANK = "ERank::Master" as ERank;
export const VETERAN_MASTER_RANK = "ERank::Veteran, ERank::Master" as ERank;
export const EXPERIENCED_MASTER_RANK = "ERank::Experienced, ERank::Veteran, ERank::Master" as ERank;

export const ALL_RANKS_ARR = ALL_RANK.split(", ") as ERank[];
export const ALL_RANKS_SET = new Set(ALL_RANKS_ARR);

export let allDefaultWeaponGeneralSetupPrototypes: WeaponGeneralSetupPrototype[];
export let allDefaultPlayerWeaponSettingsPrototypes: NPCWeaponSettingsPrototype[];
export let allDefaultArmorPrototypes: ArmorPrototype[];
export let allDefaultArtifactPrototypes: SpawnActorPrototype[];
export let allDefaultNightVisionGogglesPrototypes: ArmorPrototype[];
export let allDefaultAmmoPrototypes: AmmoPrototype[];
export let allDefaultConsumablePrototypes: ConsumablePrototype[];
export let allDefaultGrenadePrototypes: GrenadePrototype[];
export let allDefaultQuestItemPrototypes: SpawnActorPrototype[];
export let allDefaultWeaponPrototypes: WeaponPrototype[];
export let allDefaultAttachPrototypes: AttachPrototype[];

[
  allDefaultWeaponGeneralSetupPrototypes,
  allDefaultPlayerWeaponSettingsPrototypes,
  allDefaultArmorPrototypes,
  allDefaultArtifactPrototypes,
  allDefaultNightVisionGogglesPrototypes,
  allDefaultAmmoPrototypes,
  allDefaultConsumablePrototypes,
  allDefaultGrenadePrototypes,
  allDefaultQuestItemPrototypes,
  allDefaultWeaponPrototypes,
  allDefaultAttachPrototypes,
] = await Promise.all([
  readFileAndGetStructs<WeaponGeneralSetupPrototype>("WeaponData/WeaponGeneralSetupPrototypes.cfg"),
  readFileAndGetStructs<NPCWeaponSettingsPrototype>("WeaponData/CharacterWeaponSettingsPrototypes/PlayerWeaponSettingsPrototypes.cfg"),
  readFileAndGetStructs<ArmorPrototype>("ItemPrototypes/ArmorPrototypes.cfg"),
  readFileAndGetStructs<SpawnActorPrototype>(`/ArtifactPrototypes.cfg`),
  readFileAndGetStructs<ArmorPrototype>("ItemPrototypes/NightVisionGogglesPrototypes.cfg"),
  readFileAndGetStructs<AmmoPrototype>("ItemPrototypes/AmmoPrototypes.cfg"),
  readFileAndGetStructs<ConsumablePrototype>("ItemPrototypes/ConsumablePrototypes.cfg"),
  readFileAndGetStructs<GrenadePrototype>("ItemPrototypes/GrenadePrototypes.cfg"),
  readFileAndGetStructs<SpawnActorPrototype>(`/QuestItemPrototypes.cfg`),
  readFileAndGetStructs<WeaponPrototype>("ItemPrototypes/WeaponPrototypes.cfg"),
  readFileAndGetStructs<AttachPrototype>("ItemPrototypes/AttachPrototypes.cfg"),
]);

// Records:
const getRecord = <T extends { SID: string }>(arr: T[]) => Object.fromEntries(arr.map((e) => [e.SID, e]));
export const allDefaultArmorPrototypesRecord = getRecord(allDefaultArmorPrototypes);
export const allDefaultArtifactPrototypesRecord = getRecord(allDefaultArtifactPrototypes);
export const allDefaultNightVisionGogglesPrototypesRecord = getRecord(allDefaultNightVisionGogglesPrototypes);
export const allDefaultAmmoPrototypesRecord = getRecord(allDefaultAmmoPrototypes);
export const allDefaultConsumablePrototypesRecord = getRecord(allDefaultConsumablePrototypes);
export const allDefaultGrenadePrototypesRecord = getRecord(allDefaultGrenadePrototypes);
export const allDefaultQuestItemPrototypesRecord = getRecord(allDefaultQuestItemPrototypes);
export const allDefaultWeaponPrototypesRecord = getRecord(allDefaultWeaponPrototypes);
export const allDefaultAttachPrototypesRecord = getRecord(allDefaultAttachPrototypes);

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
  clone.__internal__.isRoot = true;
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
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Light_Bandit_Helmet, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.SkinJacket_Bandit_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Jacket_Bandit_Armor, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Middle_Bandit_Armor, EXPERIENCED_MASTER_RANK),
  ],
  corpus: [],
  duty: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Light_Duty_Helmet, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Heavy_Duty_Helmet, EXPERIENCED_MASTER_RANK),

    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Rook_Dolg_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Battle_Dolg_Armor, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.SEVA_Dolg_Armor, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Heavy_Dolg_Armor, VETERAN_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.HeavyExoskeleton_Dolg_Armor, MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Exoskeleton_Dolg_Armor, MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Battle_Dolg_End_Armor, MASTER_RANK),
  ],
  freedom: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Heavy_Svoboda_Helmet, VETERAN_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Rook_Svoboda_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Battle_Svoboda_Armor, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.SEVA_Svoboda_Armor, VETERAN_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Heavy_Svoboda_Armor, VETERAN_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.HeavyExoskeleton_Svoboda_Armor, MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Exoskeleton_Svoboda_Armor, MASTER_RANK),
  ],
  mercenary: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Light_Mercenaries_Helmet, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Light_Mercenaries_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Heavy_Mercenaries_Armor, VETERAN_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Exoskeleton_Mercenaries_Armor, MASTER_RANK),
  ],
  military: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Heavy_Military_Helmet, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Light_Military_Helmet, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Battle_Military_Helmet, VETERAN_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Default_Military_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Heavy2_Military_Armor, VETERAN_MASTER_RANK),
  ],
  monolith: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Battle_Monolith_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.HeavyAnomaly_Monolith_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.HeavyExoskeleton_Monolith_Armor, VETERAN_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Exoskeleton_Monolith_Armor, ALL_RANK),
  ],
  neutral: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Light_Neutral_Helmet, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Jemmy_Neutral_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Newbee_Neutral_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Nasos_Neutral_Armor, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Zorya_Neutral_Armor, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.SEVA_Neutral_Armor, VETERAN_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Exoskeleton_Neutral_Armor, MASTER_RANK),
  ],
  scientist: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Anomaly_Scientific_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.HeavyAnomaly_Scientific_Armor, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.SciSEVA_Scientific_Armor, VETERAN_MASTER_RANK),
  ],
  spark: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Battle_Spark_Armor, VETERAN_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.SEVA_Spark_Armor, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.HeavyAnomaly_Spark_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.HeavyBattle_Spark_Armor, VETERAN_MASTER_RANK),
  ],
  varta: [
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Heavy_Varta_Helmet, EXPERIENCED_MASTER_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.Battle_Varta_Armor, ALL_RANK),
    getDefaultDroppableArmorDescriptor(allDefaultArmorPrototypesRecord.BattleExoskeleton_Varta_Armor, VETERAN_MASTER_RANK),
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
export const guideQuestObjectPrototypeSIDs = new Set([
  "vozatyj_0",
  "TerriconGuider",
  "ZalesieGuider",
  "ShevchenkoGuider",
  "HimzavodGuider",
  "MalachitGuider",
  "RostokGuider",
  "ConcretePlantGuider",
  "MagnetMemoryPlantGuider",
  "KorogodCampGuider",
  "HoghouseGuider",
  "RookieVillageGuider",
  "LesnikBaseGuider",
  "NoonBaseGuider",
  "SkadovskGuider",
  "ShipyardGuider",
  "NeutralVolk",
  "NeutralGarik",
  "NeutralDadaLena",
  "ScientistViktorKoska",
  "NeutralMuhomor",
  "DutyMarsal",
  "FreedomLaguha",
  "CorpusTelegraf",
]);

export const generalTradersTradeItemGenerators = new Set([
  "AsylumTrader_TradeItemGenerator",
  "IkarTrader_TradeItemGenerator",
  "SultanskTrader_TradeItemGenerator",
  "ShevchenkoTrader_TradeItemGenerator",
  "NewbeeVillageTrader_TradeItemGenerator",
  "MalakhitTrader_TradeItemGenerator",
  "CementPlantTrader_TradeItemGenerator",
  "YanovTrader_TradeItemGenerator",
  "PripyatTrader_TradeItemGenerator",
  "RedForestTrader_TradeItemGenerator",
  "EgerTrader_TradeItemGenerator",
  "VartaTrader_TradeItemGenerator",
  "TraderZalesie_TradeItemGenerator",
  "TraderChemicalPlant_TradeItemGenerator",
  "TraderTerikon_TradeItemGenerator",
  "TraderSuska_TradeItemGenerator",
  "SelmaTrader_TradeItemGenerator",
]);

export const generalTradersTradePrototypes = new Set([
  "Trader_Zalesie_TradePrototype",
  "Trader_ChemicalPlant_TradePrototype",
  "Trader_Terikon_TradePrototype",
  "Asylum_Trader_TradePrototype",
  "Trader_Ikar_TradePrototype",
  "Trader_Sultansk_TradePrototype",
  "Trader_Shevchenko_TradePrototype",
  "Trader_NewbeeVillage_TradePrototype",
  "Trader_Malakhit_TradePrototype",
  "Trader_CementPlant_TradePrototype",
  "Trader_Armor_Rostok_TradePrototype",
  "Trader_NATO_Rostok_TradePrototype",
  "Trader_Soviet_Rostok_TradePrototype",
  "Trader_Yanov_TradePrototype",
  "Trader_Pripyat_TradePrototype",
  "Trader_RedForest_TradePrototype",
  "EgerTrader_TradePrototype",
  "TraderSuska_TradePrototype",
  "VartaTrader_TradePrototype",
  "SelmaTrader_TradePrototype",
]);

export const bartendersTradePrototypes = new Set([
  "Bartender_Zalesie_TradePrototype",
  "Bartender_ChemicalPlant_TradePrototype",
  "Bartender_Terricon_TradePrototype",
  "Bartender_Sultansk_TradePrototype",
  "BartenderBanditSultansk_TradePrototype",
  "Bartender_Shevchenko_TradePrototype",
  "Bartender_Malakhit_TradePrototype",
  "Bartender_CementPlant_TradePrototype",
  "Bartender_Rostok_TradePrototype",
  "Bartender_RostokArena_TradePrototype",
  "Bartender_Yanov_TradePrototype",
]);

export const medicsTradePrototypes = new Set([
  "Medic_Zalesie_TradePrototype",
  "Medic_ChemicalPlant_TradePrototype",
  "Medic_Terricon_TradePrototype",
  "Asylum_Medic_TradePrototype",
  "Ikar_Medic_TradePrototype",
  "Sultansk_Medic_TradePrototype",
  "NewbieVillage_Medic_TradePrototype",
  "Malakhit_Medic_TradePrototype",
  "CementPlant_Medic_TradePrototype",
  "Rostok_Medic_TradePrototype",
  "Yanov_Medic_TradePrototype",
]);

export const technicianQuestObjectPrototypeSIDs = new Set([
  "RostokTechnician",
  "DiggerKonder",
  "ZalesieTechnician",
  "SkadovskTechnician",
  "ShipyardTechnician",
  "HimzavodTechnician",
  "MalachitTechnician",
  "ConcretePlantTechnician",
  "MagnetMemoryPlantTechnician",
  "SparkWorkshopTechnician",
  "Hors",
  "Lesnik",
  "Kardan",
  "FlameStepsel",
  "AzimutVartaAntonMarusin",
  "VartaSerzEremeev",
  "VartaSergeantVeremeev",
  "NeutralDadkaAr",
  "SIRCAATechnician",
  "NeutralKovyraska",
  "VartaSerzantIvajlov",
  "CorpMedlak",
  "FlameStepsel_Pripyat",
  "VartaSerzantIvajlov_Pripyat",
  "NeutralMultik",
  "NeutralSemenyc",
  "DutySerzantHmaruk",
  "CorpusGarpia",
  "CorpusMedlak",
  "banzai",
]);

/**
 * Technician_ChemicalPlant_TradePrototype // sells T2-T3 attachments
 * PowerPlugTechnician_TradeItemGenerator// T2-T4 attachments
 * Asylum_Technician_TradePrototype // T2
 */
export const technicianTradePrototypes = new Set([
  "Asylum_Technician_TradePrototype",
  "Ikar_Technician_TradePrototype",
  "Backwater_Technician_TradePrototype",
  "ZalesieTechnician_TradePrototype",
  "TerriconTechnician_TradePrototype",
  "PowerPlugTechnician_TradePrototype",
  "VartaTechnician_TradePrototype",
  "Technician_NewbieVillage_TradePrototype",
  "Technician_Malakhit_TradePrototype",
  "Technician_ChemicalPlant_TradePrototype",
  "TechnicianChemicalPlant_TradeItemGenerator",
  "AsylumTechnician_TradeItemGenerator",
  "BackwaterTechnician_TradeItemGenerator",
  "Technician_Sultansk_TradePrototype",
  "SultanskTechnician_TradeItemGenerator",
  "NewbeeVillageTechnician_TradeItemGenerator",
  "Technician_CementPlant_TradePrototype",
  "Technician_Rostok_TradePrototype",
  "RostokTechnician_TradeItemGenerator",
  "Technician_Yanov_TradePrototype",
  "YanovTechnician_TradeItemGenerator",
  "Technician_Pripyat_TradePrototype",
  "PripyatTechnician_TradeItemGenerator",
  "ZalesieTechnician_TradeItemGenerator",
  "TerriconTechnician_TradeItemGenerator",
  "PowerPlugTechnician_TradeItemGenerator",
  "VartaTechnician_TradeItemGenerator",
]);
