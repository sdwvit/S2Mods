import "../../src/ensure-dot-env.mts";
import { ArmorPrototype, ERank, Struct } from "s2cfgtojson";

import {
  ALL_RANK,
  allDefaultArmorPrototypesRecord,
  allDefaultDroppableArmorsByFaction,
  ArmorDescriptor,
  CoreFaction,
  DescriptorFn,
  getDroppableArmor,
  getDroppableHelmet,
  getNonDroppableArmor,
  MASTER_RANK,
  VETERAN_MASTER_RANK,
} from "../../src/consts.mts";
import { backfillDef } from "../../src/backfill-def.mts";
import { logger } from "../../src/logger.mts";

const ICON_ROOT = "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_";

const getArmorIcon = (refkey: string) => `${ICON_ROOT}${refkey}_headless.T_IFI_${refkey}_headless'`;

const getHelmetIcon = () => ``;

const getArmorKeysForRemoval = (ref: ArmorPrototype) => ({
  UpgradePrototypeSIDs: backfillDef(ref)
    .UpgradePrototypeSIDs.entries()
    .map(([_, k]) => k)
    .filter((k) => !!k.toLowerCase().match(/psyresist|_ps[iy]_/g)),
});
const getArmorExtras = (ref: ArmorPrototype, overrides?: ArmorDescriptor["__internal__"]["_extras"]) => {
  const keysForRemoval = getArmorKeysForRemoval(ref);
  if (!keysForRemoval && !overrides) {
    return undefined;
  }
  return { ...overrides, ...(keysForRemoval ? { keysForRemoval } : {}) };
};

const createItem = (
  fn: DescriptorFn,
  suffix: string,
  iconFn: (r: string) => string,
  costFactor: number,
  weightFactorA: number,
  weightAdditionC: number,
  ref: ArmorPrototype,
  s: any,
  extras = getArmorExtras(ref),
  rank: ERank = VETERAN_MASTER_RANK,
): ArmorPrototype => {
  if (!ref) {
    logger.error(`Missing ref '${ref}'`);
    return;
  }
  const { SID: refSID } = ref;
  return fn(
    {
      LocalizationSID: refSID,
      __internal__: { refkey: refSID },
      Icon: iconFn(refSID),
      SID: `${refSID}${suffix}`,
      Protection: { PSY: 0 },
      bBlockHead: false,
      Cost: costFactor * ref.Cost,
      Weight: weightFactorA * ref.Weight + weightAdditionC,
      ...s,
    },
    rank,
    extras,
  );
};
type CreateFn = (ref: ArmorPrototype, s?: any, extras?: ArmorDescriptor["__internal__"]["_extras"], rank?: ERank) => ArmorPrototype;
const createHeadlessArmor: CreateFn = createItem.bind(null, getDroppableArmor, "_MasterMod_headless", getArmorIcon, 0.8, 1, -5);
const createHelmet: CreateFn = createItem.bind(null, getDroppableHelmet, "_Helmet_MasterMod", getHelmetIcon, 1.45, 1, 0);

export const newArmors = {
  BattleExoskeleton_Varta_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.BattleExoskeleton_Varta_Armor),
  Exoskeleton_Mercenaries_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Exoskeleton_Mercenaries_Armor),
  Exoskeleton_Monolith_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Exoskeleton_Monolith_Armor),
  Exoskeleton_Neutral_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Exoskeleton_Neutral_Armor),
  Exoskeleton_Svoboda_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Exoskeleton_Svoboda_Armor),
  Exoskeleton_Dolg_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Exoskeleton_Dolg_Armor),
  HeavyExoskeleton_Dolg_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.HeavyExoskeleton_Dolg_Armor),
  HeavyExoskeleton_Monolith_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.HeavyExoskeleton_Monolith_Armor),
  HeavyExoskeleton_Svoboda_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.HeavyExoskeleton_Svoboda_Armor),

  Heavy_Dolg_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Heavy_Dolg_Armor, {
    Weight: allDefaultArmorPrototypesRecord.Heavy_Dolg_Armor.Weight - 3,
  }),
  Heavy2_Military_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Heavy2_Military_Armor, {
    Weight: allDefaultArmorPrototypesRecord.Heavy2_Military_Armor.Weight - 3,
  }),
  HeavyAnomaly_Monolith_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.HeavyAnomaly_Monolith_Armor, {
    Weight: allDefaultArmorPrototypesRecord.HeavyAnomaly_Monolith_Armor.Weight - 3,
  }),
  Heavy_Svoboda_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Heavy_Svoboda_Armor, {
    Weight: allDefaultArmorPrototypesRecord.Heavy_Svoboda_Armor.Weight - 3,
  }),
  Heavy_Mercenaries_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Heavy_Mercenaries_Armor, {
    Weight: allDefaultArmorPrototypesRecord.Heavy_Mercenaries_Armor.Weight - 3,
  }),
  HeavyBattle_Spark_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.HeavyBattle_Spark_Armor, {
    Weight: allDefaultArmorPrototypesRecord.HeavyBattle_Spark_Armor.Weight - 3,
  }),

  Battle_Dolg_End_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Battle_Dolg_End_Armor, {
    Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Battle_Dolg_End_Armor.T_IFI_Battle_Dolg_End_Armor'`,
    Cost: allDefaultArmorPrototypesRecord.Battle_Dolg_End_Armor.Cost,
  }),

  // helmets
  Exoskeleton_Mercenaries_Helmet_MasterMod: createHelmet(
    allDefaultArmorPrototypesRecord.Heavy_Svoboda_Helmet,
    {
      Icon: `${ICON_ROOT}Exoskeleton_Merc_Helmet.T_IFI_Exoskeleton_Merc_Helmet'`,
      SID: "Exoskeleton_Mercenaries_Helmet_MasterMod",
      Weight: 5,
      Protection: { Radiation: 40, PSY: 20, Strike: 3.6 },
    },
    {},
  ),
  Exoskeleton_Monolith_Helmet_MasterMod: createHelmet(
    allDefaultArmorPrototypesRecord.Heavy_Svoboda_Helmet,
    {
      Icon: `${ICON_ROOT}Exoskeleton_Monolith_Helmet.T_IFI_Exoskeleton_Monolith_Helmet'`,
      SID: "Exoskeleton_Monolith_Helmet_MasterMod",
      Weight: 5,
      Protection: { Radiation: 50, PSY: 20, Strike: 3.4 },
    },
    {},
  ),
  Exoskeleton_Neutral_Helmet_MasterMod: createHelmet(
    allDefaultArmorPrototypesRecord.Heavy_Svoboda_Helmet,
    {
      Icon: `${ICON_ROOT}Exoskeleton_Neutral_Helmet.T_IFI_Exoskeleton_Neutral_Helmet'`,
      SID: "Exoskeleton_Neutral_Helmet_MasterMod",
      Weight: 5,
      Protection: { Radiation: 40, PSY: 50, Strike: 4 },
    },
    {},
  ),
  Exoskeleton_Spark_Helmet_MasterMod: createHelmet(
    allDefaultArmorPrototypesRecord.Heavy_Svoboda_Helmet,
    {
      Icon: `${ICON_ROOT}Exoskeleton_Spark_Helmet.T_IFI_Exoskeleton_Spark_Helmet'`,
      SID: "Exoskeleton_Spark_Helmet_MasterMod",
      Weight: 5,
      Protection: { Radiation: 35, PSY: 40, Strike: 4 },
    },
    {},
  ),
  Exoskeleton_Duty_Helmet_MasterMod: createHelmet(
    allDefaultArmorPrototypesRecord.Heavy_Svoboda_Helmet,
    {
      Icon: `${ICON_ROOT}Exoskeleton_Duty_Helmet.T_IFI_Exoskeleton_Duty_Helmet'`,
      SID: "Exoskeleton_Duty_Helmet_MasterMod",
      Weight: 5,
      Protection: { Radiation: 40, PSY: 20, Strike: 4 },
    },
    {}, // do not remove
  ),
  Exoskeleton_Svoboda_Helmet_MasterMod: createHelmet(
    allDefaultArmorPrototypesRecord.Heavy_Svoboda_Helmet,
    {
      Icon: `${ICON_ROOT}Exoskeleton_Svoboda_Helmet.T_IFI_Exoskeleton_Svoboda_Helmet'`,
      SID: "Exoskeleton_Svoboda_Helmet_MasterMod",
      Weight: 5,
      Protection: { Radiation: 45, PSY: 40, Strike: 4 },
    },
    {}, // do not remove
  ),
  HeavyBattle_Spark_Helmet_MasterMod: createHelmet(
    allDefaultArmorPrototypesRecord.Battle_Military_Helmet,
    {
      Icon: `${ICON_ROOT}HeavyBattle_Spark_Helmet.T_IFI_HeavyBattle_Spark_Helmet'`,
      SID: "HeavyBattle_Spark_Helmet_MasterMod",
      Protection: allDefaultArmorPrototypesRecord.Battle_Military_Helmet.Protection,
    },
    {}, // do not remove
  ),
  HeavyBattle_Merc_Helmet_MasterMod: createHelmet(
    allDefaultArmorPrototypesRecord.Battle_Military_Helmet,
    {
      Icon: `${ICON_ROOT}HeavyBattle_Merc_Helmet.T_IFI_HeavyBattle_Merc_Helmet'`,
      SID: "HeavyBattle_Merc_Helmet_MasterMod",
      Protection: allDefaultArmorPrototypesRecord.Battle_Military_Helmet.Protection,
    },
    {}, // do not remove
  ),
  HeavyBattle_Dolg_Helmet_MasterMod: createHelmet(
    allDefaultArmorPrototypesRecord.Battle_Military_Helmet,
    {
      Icon: `${ICON_ROOT}HeavyBattle_Dolg_Helmet.T_IFI_HeavyBattle_Dolg_Helmet'`,
      SID: "HeavyBattle_Dolg_Helmet_MasterMod",
      Protection: allDefaultArmorPrototypesRecord.Battle_Military_Helmet.Protection,
    },
    {}, // do not remove
  ),

  // copies of headless
  BattleExoskeleton_Varta_Armor_HeadlessArmors_headless: getDroppableArmor({
    __internal__: { refkey: "BattleExoskeleton_Varta_Armor_MasterMod_headless" },
    SID: "BattleExoskeleton_Varta_Armor_HeadlessArmors_headless",
  }),
  Exoskeleton_Mercenaries_Armor_HeadlessArmors_headless: getDroppableArmor({
    __internal__: { refkey: "Exoskeleton_Mercenaries_Armor_MasterMod_headless" },
    SID: "Exoskeleton_Mercenaries_Armor_HeadlessArmors_headless",
  }),
  Exoskeleton_Monolith_Armor_HeadlessArmors_headless: getDroppableArmor({
    __internal__: { refkey: "Exoskeleton_Monolith_Armor_MasterMod_headless" },
    SID: "Exoskeleton_Monolith_Armor_HeadlessArmors_headless",
  }),
  Exoskeleton_Neutral_Armor_HeadlessArmors_headless: getDroppableArmor({
    __internal__: { refkey: "Exoskeleton_Neutral_Armor_MasterMod_headless" },
    SID: "Exoskeleton_Neutral_Armor_HeadlessArmors_headless",
  }),
  Exoskeleton_Svoboda_Armor_HeadlessArmors_headless: getDroppableArmor({
    __internal__: { refkey: "Exoskeleton_Svoboda_Armor_MasterMod_headless" },
    SID: "Exoskeleton_Svoboda_Armor_HeadlessArmors_headless",
  }),
  Heavy_Dolg_Armor_HeadlessArmors_headless: getDroppableArmor({
    __internal__: { refkey: "Heavy_Dolg_Armor_MasterMod_headless" },
    SID: "Heavy_Dolg_Armor_HeadlessArmors_headless",
  }),
  Heavy2_Military_Armor_HeadlessArmors_headless: getDroppableArmor({
    __internal__: { refkey: "Heavy2_Military_Armor_MasterMod_headless" },
    SID: "Heavy2_Military_Armor_HeadlessArmors_headless",
  }),
  HeavyAnomaly_Monolith_Armor_HeadlessArmors_headless: getDroppableArmor({
    __internal__: { refkey: "HeavyAnomaly_Monolith_Armor_MasterMod_headless" },
    SID: "HeavyAnomaly_Monolith_Armor_HeadlessArmors_headless",
  }),
  Exoskeleton_Dolg_Armor_HeadlessArmors_headless: getDroppableArmor({
    __internal__: { refkey: "Exoskeleton_Dolg_Armor_MasterMod_headless" },
    SID: "Exoskeleton_Dolg_Armor_HeadlessArmors_headless",
  }),
  Heavy_Svoboda_Armor_HeadlessArmors_headless: getDroppableArmor({
    __internal__: { refkey: "Heavy_Svoboda_Armor_MasterMod_headless" },
    SID: "Heavy_Svoboda_Armor_HeadlessArmors_headless",
  }),
  Heavy_Mercenaries_Armor_HeadlessArmors_headless: getDroppableArmor({
    __internal__: { refkey: "Heavy_Mercenaries_Armor_MasterMod_headless" },
    SID: "Heavy_Mercenaries_Armor_HeadlessArmors_headless",
  }),
  HeavyBattle_Spark_Armor_HeadlessArmors_headless: getDroppableArmor({
    __internal__: { refkey: "HeavyBattle_Spark_Armor_MasterMod_headless" },
    SID: "HeavyBattle_Spark_Armor_HeadlessArmors_headless",
  }),
  HeavyExoskeleton_Dolg_Armor_HeadlessArmors_headless: getDroppableArmor({
    __internal__: { refkey: "HeavyExoskeleton_Dolg_Armor_MasterMod_headless" },
    SID: "HeavyExoskeleton_Dolg_Armor_HeadlessArmors_headless",
  }),
  HeavyExoskeleton_Monolith_Armor_HeadlessArmors_headless: getDroppableArmor({
    __internal__: { refkey: "HeavyExoskeleton_Monolith_Armor_MasterMod_headless" },
    SID: "HeavyExoskeleton_Monolith_Armor_HeadlessArmors_headless",
  }),
  HeavyExoskeleton_Svoboda_Armor_HeadlessArmors_headless: getDroppableArmor({
    __internal__: { refkey: "HeavyExoskeleton_Svoboda_Armor_MasterMod_headless" },
    SID: "HeavyExoskeleton_Svoboda_Armor_HeadlessArmors_headless",
  }),
  Battle_Dolg_End_Armor_HeadlessArmors_headless: getDroppableArmor({
    __internal__: { refkey: "Battle_Dolg_End_Armor_MasterMod_headless" },
    SID: "Battle_Dolg_End_Armor_HeadlessArmors_headless",
  }),
  Exoskeleton_Mercenaries_Helmet_HeadlessArmors: getDroppableHelmet({
    __internal__: { refkey: "Exoskeleton_Mercenaries_Helmet_MasterMod" },
    SID: "Exoskeleton_Mercenaries_Helmet_HeadlessArmors",
  }),
  Exoskeleton_Monolith_Helmet_HeadlessArmors: getDroppableHelmet({
    __internal__: { refkey: "Exoskeleton_Monolith_Helmet_MasterMod" },
    SID: "Exoskeleton_Monolith_Helmet_HeadlessArmors",
  }),
  Exoskeleton_Neutral_Helmet_HeadlessArmors: getDroppableHelmet({
    __internal__: { refkey: "Exoskeleton_Neutral_Helmet_MasterMod" },
    SID: "Exoskeleton_Neutral_Helmet_HeadlessArmors",
  }),
  Exoskeleton_Spark_Helmet_HeadlessArmors: getDroppableHelmet({
    __internal__: { refkey: "Exoskeleton_Spark_Helmet_MasterMod" },
    SID: "Exoskeleton_Spark_Helmet_HeadlessArmors",
  }),
  Exoskeleton_Duty_Helmet_HeadlessArmors: getDroppableHelmet({
    __internal__: { refkey: "Exoskeleton_Duty_Helmet_MasterMod" },
    SID: "Exoskeleton_Duty_Helmet_HeadlessArmors",
  }),
  Exoskeleton_Svoboda_Helmet_HeadlessArmors: getDroppableHelmet({
    __internal__: { refkey: "Exoskeleton_Svoboda_Helmet_MasterMod" },
    SID: "Exoskeleton_Svoboda_Helmet_HeadlessArmors",
  }),
  HeavyBattle_Spark_Helmet_HeadlessArmors: getDroppableHelmet({
    __internal__: { refkey: "HeavyBattle_Spark_Helmet_MasterMod" },
    SID: "HeavyBattle_Spark_Helmet_HeadlessArmors",
  }),
  HeavyBattle_Merc_Helmet_HeadlessArmors: getDroppableHelmet({
    __internal__: { refkey: "HeavyBattle_Merc_Helmet_MasterMod" },
    SID: "HeavyBattle_Merc_Helmet_HeadlessArmors",
  }),
  HeavyBattle_Dolg_Helmet_HeadlessArmors: getDroppableHelmet({
    __internal__: { refkey: "HeavyBattle_Dolg_Helmet_MasterMod" },
    SID: "HeavyBattle_Dolg_Helmet_HeadlessArmors",
  }),
};

const getNPCArmorDescriptor = (refkey: string, playerRanks: ERank) =>
  getNonDroppableArmor(new Struct({ __internal__: { refkey }, SID: `${refkey}_MasterMod_NPC` }) as ArmorPrototype, playerRanks);

export const extraArmorsByFaction: typeof allDefaultDroppableArmorsByFaction = {
  Bandits: [],
  FreeStalkers: [],
  Noon: [],
  Corpus: [
    getNPCArmorDescriptor("NPC_Heavy_Corps_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_Heavy3_Corps_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_Heavy2_Coprs_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_Heavy3Exoskeleton_Coprs_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_Exoskeleton_Coprs_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("Battle_Dolg_End_Armor", MASTER_RANK),
  ],
  Duty: [
    newArmors.Exoskeleton_Dolg_Armor_MasterMod_headless,
    newArmors.Exoskeleton_Dolg_Armor_HeadlessArmors_headless,
    newArmors.HeavyExoskeleton_Dolg_Armor_MasterMod_headless,
    newArmors.HeavyExoskeleton_Dolg_Armor_HeadlessArmors_headless,
    newArmors.Heavy_Dolg_Armor_MasterMod_headless,
    newArmors.Heavy_Dolg_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Duty_Helmet_MasterMod,
    newArmors.Exoskeleton_Duty_Helmet_HeadlessArmors,
    newArmors.HeavyBattle_Dolg_Helmet_MasterMod,
    newArmors.HeavyBattle_Dolg_Helmet_HeadlessArmors,
    newArmors.Battle_Dolg_End_Armor_MasterMod_headless,
    newArmors.Battle_Dolg_End_Armor_HeadlessArmors_headless,
  ],
  Freedom: [
    newArmors.Exoskeleton_Svoboda_Armor_MasterMod_headless,
    newArmors.Exoskeleton_Svoboda_Armor_HeadlessArmors_headless,
    newArmors.HeavyExoskeleton_Svoboda_Armor_MasterMod_headless,
    newArmors.HeavyExoskeleton_Svoboda_Armor_HeadlessArmors_headless,
    newArmors.Heavy_Svoboda_Armor_MasterMod_headless,
    newArmors.Heavy_Svoboda_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Svoboda_Helmet_MasterMod,
    newArmors.Exoskeleton_Svoboda_Helmet_HeadlessArmors,
  ],
  Mercenaries: [
    getNPCArmorDescriptor("NPC_HeavyExoskeleton_Mercenaries_Armor", MASTER_RANK),
    newArmors.Heavy_Mercenaries_Armor_MasterMod_headless,
    newArmors.Heavy_Mercenaries_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Mercenaries_Armor_MasterMod_headless,
    newArmors.Exoskeleton_Mercenaries_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Mercenaries_Helmet_MasterMod,
    newArmors.Exoskeleton_Mercenaries_Helmet_HeadlessArmors,
    newArmors.HeavyBattle_Merc_Helmet_MasterMod,
    newArmors.HeavyBattle_Merc_Helmet_HeadlessArmors,
  ],
  Militaries: [
    getNPCArmorDescriptor("NPC_Heavy_Military_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_Cloak_Heavy_Military_Armor", VETERAN_MASTER_RANK),
    newArmors.Heavy2_Military_Armor_MasterMod_headless,
    newArmors.Heavy2_Military_Armor_HeadlessArmors_headless,
  ],
  Monolith: [
    getNPCArmorDescriptor("NPC_Battle_Noon_Armor", ALL_RANK),
    getNPCArmorDescriptor("NPC_HeavyAnomaly_Noon_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_HeavyExoskeleton_Noon_Armor", MASTER_RANK),
    getNPCArmorDescriptor("NPC_Exoskeleton_Noon_Armor", MASTER_RANK),
    newArmors.Exoskeleton_Monolith_Armor_MasterMod_headless,
    newArmors.Exoskeleton_Monolith_Armor_HeadlessArmors_headless,
    newArmors.HeavyExoskeleton_Monolith_Armor_MasterMod_headless,
    newArmors.HeavyExoskeleton_Monolith_Armor_HeadlessArmors_headless,
    newArmors.HeavyAnomaly_Monolith_Armor_MasterMod_headless,
    newArmors.HeavyAnomaly_Monolith_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Monolith_Helmet_MasterMod,
    newArmors.Exoskeleton_Monolith_Helmet_HeadlessArmors,
  ],
  Neutrals: [
    getNPCArmorDescriptor("NPC_Sel_Neutral_Armor", ALL_RANK),
    getNPCArmorDescriptor("NPC_Cloak_Heavy_Neutral_Armor", VETERAN_MASTER_RANK),
    newArmors.Exoskeleton_Neutral_Armor_MasterMod_headless,
    newArmors.Exoskeleton_Neutral_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Neutral_Helmet_MasterMod,
    newArmors.Exoskeleton_Neutral_Helmet_HeadlessArmors,
  ],
  Scientists: [getNPCArmorDescriptor("NPC_Sci_Armor", ALL_RANK)],
  Spark: [
    getNPCArmorDescriptor("NPC_HeavyExoskeleton_Spark_Armor", MASTER_RANK),
    getNPCArmorDescriptor("NPC_Spark_Armor", ALL_RANK),
    getNPCArmorDescriptor("NPC_Anomaly_Spark_Armor", ALL_RANK),
    newArmors.HeavyBattle_Spark_Armor_MasterMod_headless,
    newArmors.HeavyBattle_Spark_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Spark_Helmet_MasterMod,
    newArmors.Exoskeleton_Spark_Helmet_HeadlessArmors,
    newArmors.HeavyBattle_Spark_Helmet_MasterMod,
    newArmors.HeavyBattle_Spark_Helmet_HeadlessArmors,
  ],
  Varta: [newArmors.BattleExoskeleton_Varta_Armor_MasterMod_headless, newArmors.BattleExoskeleton_Varta_Armor_HeadlessArmors_headless],
};
extraArmorsByFaction.FreeStalkers = extraArmorsByFaction.Neutrals;
extraArmorsByFaction.Noon = extraArmorsByFaction.Monolith;

Object.entries(allDefaultDroppableArmorsByFaction).forEach(([faction, defs]) => {
  extraArmorsByFaction[faction] = [
    ...extraArmorsByFaction[faction],
    ...defs.map((def) => getNPCArmorDescriptor(def.SID, def.__internal__._extras?.ItemGenerator?.PlayerRank as ERank)),
  ];
});

export const allExtraArmors = [
  ...extraArmorsByFaction.Neutrals,
  ...extraArmorsByFaction.Bandits,
  ...extraArmorsByFaction.Mercenaries,
  ...extraArmorsByFaction.Militaries,
  ...extraArmorsByFaction.Corpus,
  ...extraArmorsByFaction.Scientists,
  ...extraArmorsByFaction.Freedom,
  ...extraArmorsByFaction.Duty,
  ...extraArmorsByFaction.Monolith,
  ...extraArmorsByFaction.Varta,
  ...extraArmorsByFaction.Spark,
]
  .filter((a) => {
    const check = !allDefaultArmorPrototypesRecord[a.__internal__.refkey] && !newArmors[a.__internal__.refkey];
    if (check) {
      logger.warn(`Can't find default armor for id '${a.__internal__.refkey}'`);
    }
    return !check;
  })
  .sort((a, b) => {
    if (allDefaultArmorPrototypesRecord[a.__internal__.refkey] && allDefaultArmorPrototypesRecord[b.__internal__.refkey]) {
      return 0;
    }
    if (allDefaultArmorPrototypesRecord[a.__internal__.refkey]) {
      return -1;
    }
    if (allDefaultArmorPrototypesRecord[b.__internal__.refkey]) {
      return 1;
    }

    if (a.__internal__.refkey === b.__internal__.refkey) {
      return 0;
    }
    if (b.__internal__.refkey === a.SID) {
      return -1;
    }
    if (a.__internal__.refkey === b.SID) {
      return 1;
    }

    return 0;
  });
