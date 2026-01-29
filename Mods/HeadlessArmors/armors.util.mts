import "../../src/ensure-dot-env.mts";
import { ArmorPrototype, ERank, Struct } from "s2cfgtojson";

import {
  ALL_RANK,
  allDefaultArmorPrototypesRecord,
  allDefaultDroppableArmorsByFaction,
  ArmorDescriptor,
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
      __internal__: { refkey: refSID, refurl: "../ArmorPrototypes.cfg" },
      Icon: iconFn(refSID),
      SID: `${refSID}${suffix}`,
      Protection: { PSY: 0 },
      bBlockHead: false,
      ...s,
    },
    rank,
    extras,
  );
};
type CreateFn = (ref: ArmorPrototype, s: any, extras?: ArmorDescriptor["__internal__"]["_extras"], rank?: ERank) => ArmorPrototype;
const createHeadlessArmor: CreateFn = createItem.bind(null, getDroppableArmor, "_MasterMod_headless", getArmorIcon);
const createHelmet: CreateFn = createItem.bind(null, getDroppableHelmet, "_Helmet_MasterMod", getHelmetIcon);

export const newArmors = {
  BattleExoskeleton_Varta_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.BattleExoskeleton_Varta_Armor, {
    Weight: 8.5,
    Cost: 58000,
  }),
  Exoskeleton_Mercenaries_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Exoskeleton_Mercenaries_Armor, {
    Weight: 7.5,
    Cost: 50500,
  }),
  Exoskeleton_Monolith_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Exoskeleton_Monolith_Armor, {
    Weight: 7.5,
    Cost: 53000,
  }),
  Exoskeleton_Neutral_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Exoskeleton_Neutral_Armor, {
    Weight: 12,
    Cost: 55500,
  }),
  Exoskeleton_Svoboda_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Exoskeleton_Svoboda_Armor, {
    Weight: 7.5,
    Cost: 80000,
  }),
  Heavy_Dolg_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Heavy_Dolg_Armor, {
    Weight: 7,
    Cost: 35000,
  }),
  Heavy2_Military_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Heavy2_Military_Armor, {
    Weight: 6,
    Cost: 32000,
  }),
  HeavyAnomaly_Monolith_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.HeavyAnomaly_Monolith_Armor, {
    Weight: 7,
    Cost: 42500,
  }),
  Exoskeleton_Dolg_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Exoskeleton_Dolg_Armor, {
    Weight: 8.5,
    Cost: 70000,
  }),
  Heavy_Svoboda_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Heavy_Svoboda_Armor, {
    Weight: 7,
    Cost: 37000,
  }),
  Heavy_Mercenaries_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Heavy_Mercenaries_Armor, {
    Weight: 5,
    Cost: 25500,
  }),
  HeavyBattle_Spark_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.HeavyBattle_Spark_Armor, {
    Weight: 7,
    Cost: 40500,
  }),
  HeavyExoskeleton_Dolg_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.HeavyExoskeleton_Dolg_Armor, {
    Weight: 16,
    Cost: 51000,
  }),
  HeavyExoskeleton_Monolith_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.HeavyExoskeleton_Monolith_Armor, {
    Weight: 16,
    Cost: 55000,
  }),
  HeavyExoskeleton_Svoboda_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.HeavyExoskeleton_Svoboda_Armor, {
    Weight: 16,
    Cost: 50000,
  }),

  Battle_Dolg_End_Armor_MasterMod_headless: createHeadlessArmor(allDefaultArmorPrototypesRecord.Battle_Dolg_End_Armor, {
    Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Armor/T_IFI_Battle_Dolg_End_Armor.T_IFI_Battle_Dolg_End_Armor'`,
    Cost: 70000,
  }),
  // helme, ts
  Exoskeleton_Mercenaries_Helmet_MasterMod: createHelmet(
    allDefaultArmorPrototypesRecord.Heavy_Svoboda_Helmet,
    {
      Icon: `${ICON_ROOT}Exoskeleton_Merc_Helmet.T_IFI_Exoskeleton_Merc_Helmet'`,
      SID: "Exoskeleton_Mercenaries_Helmet_MasterMod",
      Weight: 5,
      Cost: 45000,
      Protection: { Radiation: 40, PSY: 20, Strike: 4 },
    },
    {},
  ),
  Exoskeleton_Monolith_Helmet_MasterMod: createHelmet(
    allDefaultArmorPrototypesRecord.Heavy_Svoboda_Helmet,
    {
      Icon: `${ICON_ROOT}Exoskeleton_Monolith_Helmet.T_IFI_Exoskeleton_Monolith_Helmet'`,
      SID: "Exoskeleton_Monolith_Helmet_MasterMod",
      Weight: 5,
      Cost: 45000,
      Protection: { Radiation: 50, PSY: 20, Strike: 4 },
    },
    {},
  ),
  Exoskeleton_Neutral_Helmet_MasterMod: createHelmet(
    allDefaultArmorPrototypesRecord.Heavy_Svoboda_Helmet,
    {
      Icon: `${ICON_ROOT}Exoskeleton_Neutral_Helmet.T_IFI_Exoskeleton_Neutral_Helmet'`,
      SID: "Exoskeleton_Neutral_Helmet_MasterMod",
      Weight: 5,
      Cost: 40000,
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
      Cost: 40000,
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
      Cost: 40000,
      Protection: { Radiation: 40, PSY: 20, Strike: 4 },
    },
    {},
  ),
  Exoskeleton_Svoboda_Helmet_MasterMod: createHelmet(
    allDefaultArmorPrototypesRecord.Heavy_Svoboda_Helmet,
    {
      Icon: `${ICON_ROOT}Exoskeleton_Svoboda_Helmet.T_IFI_Exoskeleton_Svoboda_Helmet'`,
      SID: "Exoskeleton_Svoboda_Helmet_MasterMod",
      Weight: 5,
      Cost: 40000,
      Protection: { Radiation: 45, PSY: 40, Strike: 4 },
    },
    {},
  ),
  HeavyBattle_Spark_Helmet_MasterMod: createHelmet(
    allDefaultArmorPrototypesRecord.Battle_Military_Helmet,
    {
      Icon: `${ICON_ROOT}HeavyBattle_Spark_Helmet.T_IFI_HeavyBattle_Spark_Helmet'`,
      SID: "HeavyBattle_Spark_Helmet_MasterMod",
      Protection: allDefaultArmorPrototypesRecord.Battle_Military_Helmet.Protection,
    },
    {},
  ),
  HeavyBattle_Merc_Helmet_MasterMod: createHelmet(
    allDefaultArmorPrototypesRecord.Battle_Military_Helmet,
    {
      Icon: `${ICON_ROOT}HeavyBattle_Merc_Helmet.T_IFI_HeavyBattle_Merc_Helmet'`,
      SID: "HeavyBattle_Merc_Helmet_MasterMod",
      Protection: allDefaultArmorPrototypesRecord.Battle_Military_Helmet.Protection,
    },
    {},
  ),
  HeavyBattle_Dolg_Helmet_MasterMod: createHelmet(
    allDefaultArmorPrototypesRecord.Battle_Military_Helmet,
    {
      Icon: `${ICON_ROOT}HeavyBattle_Dolg_Helmet.T_IFI_HeavyBattle_Dolg_Helmet'`,
      SID: "HeavyBattle_Dolg_Helmet_MasterMod",
      Protection: allDefaultArmorPrototypesRecord.Battle_Military_Helmet.Protection,
    },
    {},
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
  bandit: [],
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
  freedom: [
    newArmors.Exoskeleton_Svoboda_Armor_MasterMod_headless,
    newArmors.Exoskeleton_Svoboda_Armor_HeadlessArmors_headless,
    newArmors.HeavyExoskeleton_Svoboda_Armor_MasterMod_headless,
    newArmors.HeavyExoskeleton_Svoboda_Armor_HeadlessArmors_headless,
    newArmors.Heavy_Svoboda_Armor_MasterMod_headless,
    newArmors.Heavy_Svoboda_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Svoboda_Helmet_MasterMod,
    newArmors.Exoskeleton_Svoboda_Helmet_HeadlessArmors,
  ],
  mercenary: [
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
  military: [
    getNPCArmorDescriptor("NPC_Heavy_Military_Armor", VETERAN_MASTER_RANK),
    getNPCArmorDescriptor("NPC_Cloak_Heavy_Military_Armor", VETERAN_MASTER_RANK),
    newArmors.Heavy2_Military_Armor_MasterMod_headless,
    newArmors.Heavy2_Military_Armor_HeadlessArmors_headless,
  ],
  monolith: [
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
  neutral: [
    getNPCArmorDescriptor("NPC_Sel_Neutral_Armor", ALL_RANK),
    getNPCArmorDescriptor("NPC_Cloak_Heavy_Neutral_Armor", VETERAN_MASTER_RANK),
    newArmors.Exoskeleton_Neutral_Armor_MasterMod_headless,
    newArmors.Exoskeleton_Neutral_Armor_HeadlessArmors_headless,
    newArmors.Exoskeleton_Neutral_Helmet_MasterMod,
    newArmors.Exoskeleton_Neutral_Helmet_HeadlessArmors,
  ],
  scientist: [getNPCArmorDescriptor("NPC_Sci_Armor", ALL_RANK)],
  spark: [
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
  varta: [newArmors.BattleExoskeleton_Varta_Armor_MasterMod_headless, newArmors.BattleExoskeleton_Varta_Armor_HeadlessArmors_headless],
};

Object.entries(allDefaultDroppableArmorsByFaction).forEach(([faction, defs]) => {
  extraArmorsByFaction[faction] = [
    ...extraArmorsByFaction[faction],
    ...defs.map((def) => getNPCArmorDescriptor(def.SID, def.__internal__._extras?.ItemGenerator?.PlayerRank as ERank)),
  ];
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
