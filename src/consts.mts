import {
  AmmoPrototype,
  ArmorPrototype,
  AttachPrototype,
  ConsumablePrototype,
  EItemGenerationCategory,
  ERank,
  GeneralNPCObjPrototype,
  GrenadePrototype,
  Internal,
  NPCWeaponSettingsPrototype,
  QuestObjPrototype,
  SpawnActorPrototype,
  Struct,
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
export let allDefaultGeneralNPCObjPrototypes: GeneralNPCObjPrototype[];
export let allDefaultQuestObjPrototypes: QuestObjPrototype[];
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
  allDefaultGeneralNPCObjPrototypes,
  allDefaultQuestObjPrototypes,
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
  readFileAndGetStructs<GeneralNPCObjPrototype>("ObjPrototypes/GeneralNPCObjPrototypes.cfg"),
  readFileAndGetStructs<QuestObjPrototype>("ObjPrototypes/QuestObjPrototypes.cfg"),
]);

// Records:
export const getRecord = <T extends { SID: string }>(arr: T[]) => Object.fromEntries(arr.map((e) => [e.SID, e]));
export const getRecordByKey = <const K extends string, T extends Record<K, string>>(arr: T[], key: K) =>
  Object.fromEntries(arr.map((e) => [e[key], e]));
export const allDefaultArmorPrototypesRecord = getRecord(allDefaultArmorPrototypes);
export const allDefaultArtifactPrototypesRecord = getRecord(allDefaultArtifactPrototypes);
export const allDefaultNightVisionGogglesPrototypesRecord = getRecord(allDefaultNightVisionGogglesPrototypes);
export const allDefaultAmmoPrototypesRecord = getRecord(allDefaultAmmoPrototypes);
export const allDefaultConsumablePrototypesRecord = getRecord(allDefaultConsumablePrototypes);
export const allDefaultGrenadePrototypesRecord = getRecord(allDefaultGrenadePrototypes);
export const allDefaultQuestItemPrototypesRecord = getRecord(allDefaultQuestItemPrototypes);
export const allDefaultWeaponPrototypesRecord = getRecord(allDefaultWeaponPrototypes);
export const allDefaultPlayerWeaponSettingsPrototypesRecord = getRecord(allDefaultPlayerWeaponSettingsPrototypes);
export const allDefaultAttachPrototypesRecord = getRecord(allDefaultAttachPrototypes);
export const allDefaultGeneralNPCObjPrototypesRecord = getRecord(allDefaultGeneralNPCObjPrototypes);
export const allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID = getRecordByKey(
  allDefaultGeneralNPCObjPrototypes,
  "ItemGeneratorPrototypeSID",
);
export const allDefaultQuestObjPrototypesRecord = getRecord(allDefaultQuestObjPrototypes);
export const allDefaultQuestObjPrototypesRecordByItemGeneratorPrototypeSID = getRecordByKey(
  allDefaultQuestObjPrototypes,
  "ItemGeneratorPrototypeSID",
);

export type ArmorDescriptor = {
  __internal__: {
    refkey?: string | number;
    _extras?: {
      keysForRemoval?: Record<string, string | number | string[] | number[]>;
      ItemGenerator?: { Category: `${EItemGenerationCategory}`; PlayerRank: `${ERank}` };
      isDroppable?: boolean;
    };
  };
} & DeeplyPartial<ArmorPrototype> & { SID: string };

const getDescriptor = (
  isDroppable = true,
  Category: EItemGenerationCategory = "EItemGenerationCategory::BodyArmor",
  struct: ArmorPrototype,
  PlayerRank: ERank = VETERAN_MASTER_RANK,
  extras: ArmorDescriptor["__internal__"]["_extras"] = {},
) => {
  if (!(struct instanceof Struct)) {
    struct = new Struct(struct) as ArmorPrototype;
  }
  const clone = struct.clone();
  clone.__internal__.isRoot = true;
  clone.__internal__.rawName = struct.SID;
  return Object.assign(clone, {
    __internal__: Object.assign(clone.__internal__, { _extras: { isDroppable, ItemGenerator: { Category, PlayerRank }, ...extras } }),
  });
};

export type DescriptorFn = (s: ArmorPrototype | any, pr?: ERank, e?: ArmorDescriptor["__internal__"]["_extras"]) => ArmorPrototype;

export const getDroppableArmor: DescriptorFn = getDescriptor.bind(null, true, "EItemGenerationCategory::BodyArmor" as EItemGenerationCategory);
export const getNonDroppableArmor: DescriptorFn = getDescriptor.bind(null, false, "EItemGenerationCategory::BodyArmor" as EItemGenerationCategory);
export const getDroppableHelmet: DescriptorFn = getDescriptor.bind(null, true, "EItemGenerationCategory::Head" as EItemGenerationCategory);

export const allDefaultDroppableArmorsByFaction: Record<Exclude<CoreFaction, "Mutant">, ArmorDescriptor[]> = {
  Bandits: [
    getDroppableArmor(allDefaultArmorPrototypesRecord.Light_Bandit_Helmet, ALL_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.SkinJacket_Bandit_Armor, ALL_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Jacket_Bandit_Armor, EXPERIENCED_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Middle_Bandit_Armor, EXPERIENCED_MASTER_RANK),
  ],
  Corpus: [],
  Duty: [
    getDroppableArmor(allDefaultArmorPrototypesRecord.Light_Duty_Helmet, ALL_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Heavy_Duty_Helmet, EXPERIENCED_MASTER_RANK),

    getDroppableArmor(allDefaultArmorPrototypesRecord.Rook_Dolg_Armor, ALL_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Battle_Dolg_Armor, EXPERIENCED_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.SEVA_Dolg_Armor, EXPERIENCED_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Heavy_Dolg_Armor, VETERAN_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.HeavyExoskeleton_Dolg_Armor, MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Exoskeleton_Dolg_Armor, MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Battle_Dolg_End_Armor, MASTER_RANK),
  ],
  FreeStalkers: [],
  Freedom: [
    getDroppableArmor(allDefaultArmorPrototypesRecord.Heavy_Svoboda_Helmet, VETERAN_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Rook_Svoboda_Armor, ALL_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Battle_Svoboda_Armor, EXPERIENCED_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.SEVA_Svoboda_Armor, VETERAN_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Heavy_Svoboda_Armor, VETERAN_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.HeavyExoskeleton_Svoboda_Armor, MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Exoskeleton_Svoboda_Armor, MASTER_RANK),
  ],
  Mercenaries: [
    getDroppableArmor(allDefaultArmorPrototypesRecord.Light_Mercenaries_Helmet, ALL_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Light_Mercenaries_Armor, ALL_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Heavy_Mercenaries_Armor, VETERAN_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Exoskeleton_Mercenaries_Armor, MASTER_RANK),
  ],
  Militaries: [
    getDroppableArmor(allDefaultArmorPrototypesRecord.Heavy_Military_Helmet, EXPERIENCED_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Light_Military_Helmet, ALL_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Battle_Military_Helmet, VETERAN_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Default_Military_Armor, ALL_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Heavy2_Military_Armor, VETERAN_MASTER_RANK),
  ],
  Monolith: [
    getDroppableArmor(allDefaultArmorPrototypesRecord.Battle_Monolith_Armor, ALL_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.HeavyAnomaly_Monolith_Armor, ALL_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.HeavyExoskeleton_Monolith_Armor, VETERAN_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Exoskeleton_Monolith_Armor, ALL_RANK),
  ],
  Neutrals: [
    getDroppableArmor(allDefaultArmorPrototypesRecord.Light_Neutral_Helmet, ALL_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Jemmy_Neutral_Armor, ALL_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Newbee_Neutral_Armor, ALL_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Nasos_Neutral_Armor, EXPERIENCED_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Zorya_Neutral_Armor, EXPERIENCED_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.SEVA_Neutral_Armor, VETERAN_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Exoskeleton_Neutral_Armor, MASTER_RANK),
  ],
  Noon: [],
  Scientists: [
    getDroppableArmor(allDefaultArmorPrototypesRecord.Anomaly_Scientific_Armor, ALL_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.HeavyAnomaly_Scientific_Armor, EXPERIENCED_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.SciSEVA_Scientific_Armor, VETERAN_MASTER_RANK),
  ],
  Spark: [
    getDroppableArmor(allDefaultArmorPrototypesRecord.Battle_Spark_Armor, VETERAN_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.SEVA_Spark_Armor, EXPERIENCED_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.HeavyAnomaly_Spark_Armor, ALL_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.HeavyBattle_Spark_Armor, VETERAN_MASTER_RANK),
  ],
  Varta: [
    getDroppableArmor(allDefaultArmorPrototypesRecord.Heavy_Varta_Helmet, EXPERIENCED_MASTER_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.Battle_Varta_Armor, ALL_RANK),
    getDroppableArmor(allDefaultArmorPrototypesRecord.BattleExoskeleton_Varta_Armor, VETERAN_MASTER_RANK),
  ],
};
allDefaultDroppableArmorsByFaction.FreeStalkers = allDefaultDroppableArmorsByFaction.Neutrals;
allDefaultDroppableArmorsByFaction.Noon = allDefaultDroppableArmorsByFaction.Monolith;

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

export const MalachiteMutantQuestPartsQuestsDoneNode = "BodyParts_Malahit_SetDialog_EQ197_QD_Orders";
export const MalachiteMutantQuestPartsQuestsDoneDialogs = [
  "EQ197_QD_Orders_Done_73061",
  "EQ197_QD_Orders_Done2_73167",
  "EQ197_QD_Orders_Done3_73169",
  "EQ197_QD_Orders_Done_73061_1",
  "EQ197_QD_Orders_Done2_73167_1",
  "EQ197_QD_Orders_Done3_73169_1",
  "EQ197_QD_Orders_Done_73061_2",
  "EQ197_QD_Orders_Done2_73167_2",
  "EQ197_QD_Orders_Done3_73169_2",
  "EQ197_QD_Orders_Done_73061_3",
  "EQ197_QD_Orders_Done2_73167_3",
  "EQ197_QD_Orders_Done3_73169_3",
  "EQ197_QD_Orders_Done_73061_4",
  "EQ197_QD_Orders_Done2_73167_4",
];

export const Factions = {
  // core factions
  Bandits: "Bandits",
  Monolith: "Monolith",
  FreeStalkers: "FreeStalkers",
  Duty: "Duty",
  Freedom: "Freedom",
  Varta: "Varta",
  Neutrals: "Neutrals",
  Militaries: "Militaries",
  Noon: "Noon",
  Scientists: "Scientists",
  Mercenaries: "Mercenaries",
  Spark: "Spark",
  Corpus: "Corpus",
  Mutant: "Mutant",
  // derived
  Army: "Militaries",
  Player: "Neutrals",
  Flame: "FreeStalkers",
  Law: "Militaries",
  WildBandits: "Bandits",
  GarmataMilitaries: "Militaries",
  SphereMilitaries: "Militaries",
  NeutralBandits: "Bandits",
  VaranBandits: "Bandits",
  RooseveltBandits: "Bandits",
  ShahBandits: "Bandits",
  LokotBandits: "Bandits",
  DepoBandits: "Bandits",
  DepoVictims: "Neutrals",
  DocentBandits: "Bandits",
  VaranStashBandits: "Bandits",
  Diggers: "Neutrals",
  KosakBandits: "Bandits",
  AzimutVarta: "Varta",
  UdavMercenaries: "Mercenaries",
  SafariHunters: "Neutrals",
  AzimuthMilitaries: "Militaries",
  SultanBandits: "Bandits",
  ShevchenkoStalkers: "Neutrals",
  VartaLesnichestvo: "Varta",
  SparkLesnichestvo: "Spark",
  IkarVarta: "Varta",
  KabanBandits: "Bandits",
  CrazyGuardians: "Spark",
  ArenaEnemy: "Neutrals",
  ArenaFriend: "Neutrals",
  DrozdMilitaries: "Militaries",
  EnemyVarta: "Varta",
  NeutralMSOP: "Militaries",
  YanovCorpus: "Corpus",
  MoleStalkers: "Neutrals",
  Controller: "Mutant",
  Poltergeist: "Mutant",
  Bloodsucker: "Mutant",
  Zombie: "Mutant",
  Chimera: "Mutant",
  Burer: "Mutant",
  Pseudogiant: "Mutant",
  Anamorph: "Mutant",
  Sinister: "Mutant",
  Pseudobear: "Mutant",
  Snork: "Mutant",
  Pseudodog: "Mutant",
  Boar: "Mutant",
  Flesh: "Mutant",
  Beaver: "Mutant",
  Ratwolf: "Mutant",
  Deer: "Mutant",
  Rat: "Mutant",
  Tushkan: "Mutant",
  Stickman: "Mutant",
  Blinddog: "Mutant",
  Bayun: "Mutant",
  CorpusStorm: "Corpus",
  DocileLabMutants: "Mutant",
  VartaSIRCAA: "Varta",
  YantarZombie: "Mutant",
  FriendlyBlinddog: "Mutant",
  Lessy: "Mutant",
  AlliedMutants: "Mutant",
  NoahLesya: "Neutrals",
  KlenMercenaries: "Mercenaries",
  SIRCAA_Scientist: "Scientists",
  MALACHITE_Scientist: "Scientists",
  NoonFaustians: "Noon",
  SQ89_SidorMercs: "Bandits",
  ScarBoss_Faction: "Spark",
  KorshunovBoss_Faction: "Varta",
  StrelokBoss_Faction: "Mutant",
  FaustBoss_Faction: "Monolith",
} as const;

export type CoreFaction = (typeof Factions)[keyof typeof Factions];

function guessGeneralNPC(itemGeneratorPrototypeSID: string) {
  let npc = allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID[itemGeneratorPrototypeSID];
  if (!npc) {
    return;
  }
  while (!!allDefaultGeneralNPCObjPrototypesRecord[npc.__internal__.refkey] && !npc.Faction) {
    npc = allDefaultGeneralNPCObjPrototypesRecord[npc.__internal__.refkey];
  }
  return npc;
}
function guessQuestNPC(itemGeneratorPrototypeSID: string) {
  let npc = allDefaultQuestObjPrototypesRecordByItemGeneratorPrototypeSID[itemGeneratorPrototypeSID];
  if (!npc) {
    return;
  }
  while (!!allDefaultQuestObjPrototypes[npc.__internal__.refkey] && !npc.Faction) {
    npc = allDefaultQuestObjPrototypes[npc.__internal__.refkey];
  }
  return npc;
}

export function getFactionFromItemGeneratorSID(itemGeneratorPrototypeSID: string): CoreFaction | undefined {
  if (itemGeneratorFactionMapFallback[itemGeneratorPrototypeSID]) {
    return itemGeneratorFactionMapFallback[itemGeneratorPrototypeSID];
  }

  const npc = guessGeneralNPC(itemGeneratorPrototypeSID) || guessQuestNPC(itemGeneratorPrototypeSID);

  if (!npc) {
    // this may happen if quest npc gets assigned item generator. at this point we can just skip these.
    return;
  }

  const coreFaction = Factions[npc.Faction];
  if (!coreFaction) {
    return;
  }
  return coreFaction;
}

const itemGeneratorFactionMapFallback: Record<string, CoreFaction> = {
  BanditExperiencedItemGenerator: "Bandits",
  BanditGosan_ItemGenerator: "Bandits",
  BanditKesaOtbitok_ItemGenerator: "Bandits",
  BanditMasterItemGenerator: "Bandits",
  BanditNewbieItemGenerator: "Bandits",
  BanditVentil_ItemGenerator: "Bandits",
  BanditVeteranItemGenerator: "Bandits",
  BartenderNoon_Cosnsumables_ItemGenerator: "Noon",
  CorpusExperiencedItemGenerator: "Corpus",
  CorpusMasterItemGenerator: "Corpus",
  CorpusNewbieItemGenerator: "Corpus",
  CorpusVeteranItemGenerator: "Corpus",
  DutyExperiencedItemGenerator: "Duty",
  DutyMasterItemGenerator: "Duty",
  DutyNewbieItemGenerator: "Duty",
  DutyVeteranItemGenerator: "Duty",
  E07_SQ01_MykolaichStash1: "Neutrals",
  E07_SQ01_MykolaichStash2: "Neutrals",
  E07_SQ01_MykolaichStash3: "Neutrals",
  EmptyQuest: "Neutrals",
  FreedomExperiencedItemGenerator: "Freedom",
  FreedomMasterItemGenerator: "Freedom",
  FreedomNewbieItemGenerator: "Freedom",
  FreedomShurup_technican_ItemGenerator: "Freedom",
  FreedomVeteranItemGenerator: "Freedom",
  GeneralNPC_Bandit_Armor: "Bandits",
  GeneralNPC_Bandit_NVG: "Bandits",
  GeneralNPC_Corpus_Armor: "Corpus",
  GeneralNPC_Corpus_NVG: "Corpus",
  GeneralNPC_Duty_Armor: "Duty",
  GeneralNPC_Duty_Armor_Experienced_var1: "Duty",
  GeneralNPC_Duty_Armor_Experienced_var2: "Duty",
  GeneralNPC_Duty_NVG: "Duty",
  GeneralNPC_Freedom_Armor: "Freedom",
  GeneralNPC_Freedom_NVG: "Freedom",
  GeneralNPC_Mercenaries_Armor: "Mercenaries",
  GeneralNPC_Mercenaries_NVG: "Mercenaries",
  GeneralNPC_Militaries_Armor: "Militaries",
  GeneralNPC_Militaries_Armor_var1: "Militaries",
  GeneralNPC_Militaries_Armor_var2: "Militaries",
  GeneralNPC_Militaries_NVG: "Militaries",
  GeneralNPC_Monolith_Armor: "Monolith",
  GeneralNPC_Monolith_NVG: "Monolith",
  GeneralNPC_Neutral_CloseCombat_ItemGenerator_Prolog_Medkit: "Neutrals",
  GeneralNPC_Neutral_NVG: "Neutrals",
  GeneralNPC_Noon_Armor: "Noon",
  GeneralNPC_Scientists_Armor: "Scientists",
  GeneralNPC_Spark_Armor: "Spark",
  GeneralNPC_Spark_NVG: "Spark",
  GeneralNPC_Varta_Armor: "Varta",
  GeneralNPC_Varta_NVG: "Varta",
  General_Neutral_Experienced: "Neutrals",
  General_Neutral_Newbie: "Neutrals",
  Gonta_ItemGenerator: "Neutrals",
  Granit_CloseCombat_ItemGenerator: "Monolith",
  Granit_Sniper_Itemgenerator: "Monolith",
  Granit_Stormtrooper_ItemGenerator: "Monolith",
  HAVAYEC_01_ItemGenerator: "Neutrals",
  IKAR_DoctorKrivenko_ItemGenerator: "Scientists",
  IskraKogut_ItemGenerator: "Spark",
  LabPetrushko_ItemGenerator: "Scientists",
  LieutenantBudnik_ItemGenerator: "Militaries",
  MainNPCItemGenerator: "Neutrals",
  MercenaryExperiencedItemGenerator: "Mercenaries",
  MercenaryMasterItemGenerator: "Mercenaries",

  MercenaryNewbieItemGenerator: "Mercenaries",
  MercenaryVeteranItemGenerator: "Mercenaries",
  MilitaryExperiencedItemGenerator: "Militaries",
  MilitaryMasterItemGenerator: "Militaries",
  MilitaryNewbieItemGenerator: "Militaries",
  MilitaryVeteranItemGenerator: "Militaries",
  MonolithExperiencedItemGenerator: "Monolith",
  MonolithMasterItemGenerator: "Monolith",
  MonolithNewbieItemGenerator: "Monolith",
  MonolithVeteranItemGenerator: "Monolith",
  NeutralExperiencedItemGenerator: "Neutrals",
  NeutralMasterItemGenerator: "Neutrals",
  NeutralNewbieItemGenerator: "Neutrals",
  NeutralTaktik_ItemGenerator: "Neutrals",
  NeutralVeteranItemGenerator: "Neutrals",
  NoonExperiencedItemGenerator: "Noon",
  NoonFaustianFoma_ItemGenerator: "Noon",
  NoonMasterItemGenerator: "Noon",
  NoonNewbieItemGenerator: "Noon",
  NoonVeteranItemGenerator: "Noon",
  Richter_ItemGenerator: "Neutrals",
  RoosveltE11Itemgen: "Duty",
  ScientistExperiencedItemGenerator: "Scientists",
  ScientistMasterItemGenerator: "Scientists",
  ScientistNewbieItemGenerator: "Scientists",
  ScientistVeteranItemGenerator: "Scientists",
  SolderItemGen: "Militaries",
  SparkExperiencedItemGenerator: "Spark",
  SparkLeaderZmeevik_ItemGenerator: "Spark",
  SparkMasterItemGenerator: "Spark",
  SparkNewbieItemGenerator: "Spark",
  SparkVeteranItemGenerator: "Spark",
  Strelok_ItemGenerator: "Neutrals",
  VartaColonelKorshunovBoss_ItemGenerator: "Varta",
  VartaExperiencedItemGenerator: "Varta",
  VartaMasterItemGenerator: "Varta",
  VartaNewbieItemGenerator: "Varta",
  VartaVeteranItemGenerator: "Varta",
  ZalesieBartender_ItemGenerator: "Neutrals",
  Zhuzha_ItemGenerator: "Neutrals",
  ZombieFoster_ItemGenerator: "Bandits",
  ZombieIgor_petrusko_ItemGenerator: "Militaries",
  ZombieLevsa_ItemGenerator: "Bandits",
  ZombiePetkaBelak_ItemGenerator: "Bandits",
  ZombieZombirovannyj_1_ItemGenerator: "Neutrals",
  AllHeadsGenerator: 'Neutrals',
   _ItemGenerator: "Neutrals",
  elma_0_ItemGenerator: "Neutrals",
  upack_guide_vozatyj_0_ItemGenerator: "Mercenaries",
  upack_trader_selma_0_ItemGenerator: "Neutrals",
};

function guessArmor(SID: string | number, refkey?: string | number) {
  if (allDefaultArmorPrototypesRecord[SID]) {
    return allDefaultArmorPrototypesRecord[SID];
  }

  return allDefaultArmorPrototypesRecord[refkey];
}
function guessNVG(SID: string | number, refkey?: string | number) {
  if (allDefaultNightVisionGogglesPrototypesRecord[SID]) {
    return allDefaultNightVisionGogglesPrototypesRecord[SID];
  }

  return allDefaultNightVisionGogglesPrototypesRecord[refkey];
}

export function getCorePrototype(descriptor: { SID: string | number; __internal__: { refkey?: string | number } }) {
  const SID = descriptor.SID;
  const refkey = descriptor.__internal__.refkey;
  return guessArmor(SID, refkey) || guessNVG(SID, refkey);
}
