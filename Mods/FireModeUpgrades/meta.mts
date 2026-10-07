import type { MetaType, StructTransformer } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import type { EffectPrototype, UpgradePrototype, WeaponGeneralSetupPrototype } from "s2cfgtojson";
import { writeFireModeUpgradesLocalization } from "./writeLocalization.mts";

/**
 * New fire-type effects. `ChangeFireTypes` replaces the weapon's whole FireTypes list, so each
 * effect spells out the weapon's vanilla modes plus the added one - nothing is ever taken away.
 * `LocalizationSID` picks the effect line shown in the upgrade tooltip
 * (`sid_effects_<LocalizationSID>_name`): the vanilla "Automatic firing mode" when auto is added,
 * this mod's "Semi-automatic firing mode" when single fire is added.
 */
export const FIRE_TYPE_EFFECTS = {
  ChangeFireTypeAddAutoToSemiBurstEffect: {
    fireTypes: ["SemiAutomatic", "Queue", "Automatic"],
    localizationSID: "change_fireType_semiAuto",
  },
  ChangeFireTypeAddSemiToBurstEffect: {
    fireTypes: ["SemiAutomatic", "Queue"],
    localizationSID: "FireModeUpgrades_semi",
  },
  ChangeFireTypeAddSemiToAutoEffect: {
    fireTypes: ["SemiAutomatic", "Automatic"],
    localizationSID: "FireModeUpgrades_semi",
  },
} as const;

type FireModeUpgrade = {
  sid: string;
  /** The base weapon plus its unique variants, which inherit its fire modes and upgrade tree. */
  weapons: string[];
  /** Vanilla upgrade of the same weapon: technicians and toolbox quest nodes that offer it get this one too. */
  anchor: string;
  effect: string;
  cost: number;
  part: "Body" | "PistolGrip";
  horizontal: number;
  vertical: "Top" | "Down";
  required?: string[];
  image: string;
};

const upgradeImage = (path: string) => `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/PDA/Upgrades/Weapons/${path}'`;

// Each sits in a cell the vanilla tree leaves empty. Costs are pitched at the weapon's own tier
// prices for that column.
export const FIRE_MODE_UPGRADES: FireModeUpgrade[] = [
  {
    // G36-pattern rifle: vanilla V2 is semi + burst, the plain GP37 already has auto.
    sid: "GunG37V2_Upgrade_FireMode_Auto",
    weapons: ["GunG37V2_ST"],
    anchor: "GunG37_Upgrade_Body_1_2",
    effect: "ChangeFireTypeAddAutoToSemiBurstEffect",
    cost: 3200,
    part: "Body",
    horizontal: 1,
    vertical: "Top",
    required: ["GunG37_Upgrade_Body_1_1", "GunG37_Upgrade_Body_1_2"],
    image: upgradeImage("Assault/G37/Body/Upgrade/T_GP_upgr_2.T_GP_upgr_2"),
  },
  {
    // Stechkin APB: real selector is single/auto, vanilla only bursts.
    sid: "GunAPB_Upgrade_FireMode_Semi",
    weapons: ["GunAPB_HG", "Gun_Encourage_HG_GS"],
    anchor: "GunAPB_Upgrade_Body_1_1",
    effect: "ChangeFireTypeAddSemiToBurstEffect",
    cost: 2100,
    part: "Body",
    horizontal: 0,
    vertical: "Down",
    image: upgradeImage("Handgun/APB/Body/Upgrade/T_APBU_b_2.T_APBU_b_2"),
  },
  {
    // MAC-10: real gun has a semi/auto selector, vanilla is auto only.
    sid: "GunM10_Upgrade_FireMode_Semi",
    weapons: ["GunM10_HG", "Gun_GStreet_HG_GS"],
    anchor: "GunM10_Upgrade_Grip_1",
    effect: "ChangeFireTypeAddSemiToAutoEffect",
    cost: 1300,
    part: "PistolGrip",
    horizontal: 0,
    vertical: "Down",
    image: upgradeImage("Handgun/M10/Grip/Upgrade/T_M10U_b_1.T_M10U_b_1"),
  },
  {
    // SVU-AS is select-fire, and the game's own SVU magazine text calls it an automatic sniper rifle.
    sid: "GunSVU_Upgrade_FireMode_Auto",
    weapons: ["GunSVU_SP", "Gun_Whip_SR_GS"],
    anchor: "GunSVU_Upgrade_Grip_1_1",
    effect: "ChangeFireTypeSemiAutoEffect", // vanilla: [SemiAutomatic, Automatic]
    cost: 7000,
    part: "Body",
    horizontal: 0,
    vertical: "Top",
    image: upgradeImage("Sniper/SVU/Grip/Upgrade/T_SVUU_c_1.T_SVUU_c_1"),
  },
];

const UPGRADE_ICON = `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/PDA/Upgrades/Icons/T_PDA_Upgrades_Icon_Autosh.T_PDA_Upgrades_Icon_Autosh'`;

// Indexed arrays: append under numeric keys well above vanilla (and above DurabilityTiers' 500 /
// 9000), never under SID-named keys - those corrupt the array on merge.
const WEAPON_INDEX_BASE = 600;
const TECHNICIAN_INDEX_BASE = 9600;

const rootStruct = <T,>(sid: string, refkey: string, fields: object) => {
  const s = new Struct({ SID: sid, ...fields });
  s.__internal__.rawName = sid;
  s.__internal__.isRoot = true;
  s.__internal__.refkey = refkey;
  return s as T;
};

const listStruct = (values: string[]) => {
  const s = new Struct();
  values.forEach((v, i) => s.addNode(v, i));
  s.__internal__.isArray = true;
  return s;
};

let effectsInjected = false;
const transformEffectPrototypes: StructTransformer<EffectPrototype> = () => {
  if (effectsInjected) return null;
  effectsInjected = true;
  return Object.entries(FIRE_TYPE_EFFECTS).map(([sid, { fireTypes, localizationSID }]) =>
    rootStruct<EffectPrototype>(sid, "ChangeFireTypeTemplate", {
      LocalizationSID: localizationSID,
      FireTypes: listStruct(fireTypes.map((t) => `EFireType::${t}`)),
      ShowUpgradeEffectValue: false,
    }),
  );
};
transformEffectPrototypes.files = ["/EffectPrototypes.cfg"];

let upgradesInjected = false;
const transformUpgradePrototypes: StructTransformer<UpgradePrototype> = () => {
  if (upgradesInjected) return null;
  upgradesInjected = true;
  writeFireModeUpgradesLocalization();
  return FIRE_MODE_UPGRADES.map((u) =>
    rootStruct<UpgradePrototype>(u.sid, "[0]", {
      Text: `sid_upgrades_${u.sid}_name`,
      Hint: `sid_upgrades_${u.sid}_description`,
      Image: u.image,
      Icon: UPGRADE_ICON,
      BaseCost: u.cost,
      ...(u.horizontal ? { HorizontalPosition: u.horizontal } : {}),
      VerticalPosition: `EUpgradeVerticalPosition::${u.vertical}`,
      UpgradeTargetPart: `EUpgradeTargetPartType::${u.part}`,
      EffectPrototypeSIDs: listStruct([u.effect]),
      ...(u.required ? { RequiredUpgradePrototypeSIDs: listStruct(u.required) } : {}),
    }),
  );
};
transformUpgradePrototypes.files = ["/UpgradePrototypes.cfg"];

const transformWeaponGeneralSetupPrototypes: StructTransformer<WeaponGeneralSetupPrototype> = (struct) => {
  const upgrades = FIRE_MODE_UPGRADES.filter((u) => u.weapons.includes(struct.SID));
  if (!upgrades.length || !struct.UpgradePrototypeSIDs) return null;
  const fork = struct.fork();
  fork.UpgradePrototypeSIDs = struct.UpgradePrototypeSIDs.fork();
  fork.UpgradePrototypeSIDs.__internal__.isArray = true;
  upgrades.forEach((u, i) => fork.UpgradePrototypeSIDs.addNode(u.sid, WEAPON_INDEX_BASE + i));
  return fork;
};
transformWeaponGeneralSetupPrototypes.files = ["/WeaponGeneralSetupPrototypes.cfg"];

/** Every technician offering the anchor upgrade offers the new one, with the same Enabled state. */
const transformNPCPrototypes: StructTransformer<any> = (struct) => {
  if (!struct.Upgrades) return null;
  const added: Struct[] = [];
  struct.Upgrades.forEach(([, entry]) => {
    const u = FIRE_MODE_UPGRADES.find((u) => u.anchor === entry?.UpgradePrototypeSID);
    if (u) added.push(new Struct({ UpgradePrototypeSID: u.sid, Enabled: entry.Enabled }));
  });
  if (!added.length) return null;
  const fork = struct.fork();
  fork.Upgrades = struct.Upgrades.fork();
  fork.Upgrades.__internal__.isArray = true;
  // Some vanilla technician lists are written as `[*]`, which fork() carries over; emit explicit indices instead.
  fork.Upgrades.__internal__.useAsterisk = false;
  added.forEach((s, i) => fork.Upgrades.addNode(s, TECHNICIAN_INDEX_BASE + i));
  return fork;
};
transformNPCPrototypes.files = ["/NPCPrototypes.cfg"];

/** Kazkovy's toolbox deliveries unlock upgrade batches; unlock the new ones alongside their anchors. */
const transformKazkovyHubQuestNodePrototypes: StructTransformer<any> = (struct) => {
  if (struct.NodeType !== "EQuestNodeType::AddTechnicianSkillOrUpgrade" || !struct.UpgradeSIDs) return null;
  const added: string[] = [];
  struct.UpgradeSIDs.forEach(([, sid]) => {
    const u = FIRE_MODE_UPGRADES.find((u) => u.anchor === sid);
    if (u) added.push(u.sid);
  });
  if (!added.length) return null;
  const fork = struct.fork();
  fork.UpgradeSIDs = struct.UpgradeSIDs.fork();
  fork.UpgradeSIDs.__internal__.isArray = true;
  added.forEach((sid, i) => fork.UpgradeSIDs.addNode(sid, TECHNICIAN_INDEX_BASE + i));
  return fork;
};
transformKazkovyHubQuestNodePrototypes.files = ["/Kazkovy_Hub.cfg"];

export const meta: MetaType<any> = {
  description: `
[b]This mod is alpha version.[/b]
[hr][/hr]
Adds technician upgrades that unlock the fire modes these guns have in real life but lack in game. Existing fire modes are never removed.
[hr][/hr]
[list]
 [*] GP37 V2: Full-Auto Trigger Group - adds automatic fire to single/burst. Body, tier 2. 3200 coupons.
 [*] APSB and Encourage: Fire Selector Restoration - adds single fire to burst. Body. 2100 coupons.
 [*] M10 Gordon and Gangster: Semi-Auto Sear - adds single fire to automatic. Grip. 1300 coupons.
 [*] SVU-MK S-3 and Whip: Automatic Trigger Mechanism - adds automatic fire to single. Body. 7000 coupons.
[/list]
Available at every technician that sells that weapon's other upgrades, including the ones unlocked by delivering toolboxes.
[hr][/hr]
bPatches:
[list]
 [*] EffectPrototypes.cfg
 [*] UpgradePrototypes.cfg
 [*] WeaponGeneralSetupPrototypes.cfg
 [*] NPCPrototypes.cfg
 [*] Kazkovy_Hub.cfg
[/list]

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release: fire mode upgrades for GP37 V2 (auto), APSB and Encourage (single), M10 Gordon and Gangster (single), SVU-MK S-3 and Whip (auto).",
  structTransformers: [
    transformEffectPrototypes,
    transformUpgradePrototypes,
    transformWeaponGeneralSetupPrototypes,
    transformNPCPrototypes,
    transformKazkovyHubQuestNodePrototypes,
  ] as any,
};
