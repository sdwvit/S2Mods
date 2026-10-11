/**
 * Upgrades that turn the TOZ-34 into a slug sniper, sized against the Three-Line Rifle
 * (`GunThreeLine_SP_Player` in PlayerWeaponSettingsPrototypes.cfg).
 *
 * | stat                          | TOZ base | with upgrades            | Three-Line |
 * |-------------------------------|----------|--------------------------|------------|
 * | EffectiveFireDistance         | 2100     | +10% (Barrel_2_1) +80%   | 4000       |
 * | DistanceDropOffLength         | 1500     | +170%                    | 4000       |
 * | MinBulletDistanceDamageModifier | 0.1    | +500%                    | 0.6        |
 * | projectile Speed (P012F)      | 20000    | -50% BulletSpeedSlowdown | 40000      |
 * | BulletDropLength              | 4000     | +20%, x1.9 slug Flatness | 10000      |
 *
 * Both barrel upgrades hang off vanilla `GunTOZ_Upgrade_Barrel_2_1`, which already locks the gun
 * to slugs (`ChangeAmmoTypesNoBuckEffect`). Equip speed has no setup field: every weapon inherits
 * `ShowEquipmentTime = 1.0` and the difference is the equip animation, so the action upgrade uses
 * the largest vanilla readiness bonus (+30%).
 *
 * The effects are new root structs with every template field spelled out (no refkey), the same
 * way X16Scopes adds `AimingFOVX16Effect`.
 */
import { Struct } from "s2cfgtojson";
import type { EffectPrototype, UpgradePrototype } from "s2cfgtojson";

const root = <T extends Struct>(s: T) => {
  s.__internal__.isRoot = true;
  s.__internal__.rawName = (s as any).SID;
  return s;
};

const permanentEffect = (SID: string, Type: string, value: string, LocalizationSID?: string) =>
  root(
    new Struct({
      SID,
      ...(LocalizationSID ? { LocalizationSID } : {}),
      Type,
      ValueMin: value,
      ValueMax: value,
      bIsPermanent: true,
      Positive: "EBeneficial::Positive",
    }) as EffectPrototype,
  );

export const slugEffects = [
  permanentEffect("UberToz_FireDistancePos80Effect", "EEffectType::EffectiveFireDistance", "80%", "weapon_range"),
  permanentEffect("UberToz_DistanceDropOffLengthPos170Effect", "EEffectType::DistanceDropOffLength", "170%"),
  permanentEffect("UberToz_DamageFalloffPos500Effect", "EEffectType::MinBulletDistanceDamage", "500%", "weapon_damageDrop"),
  // BulletSpeedSlowdown: a negative slowdown is a speed-up (vanilla ProjectileSpeedPos*Effect)
  permanentEffect("UberToz_ProjectileSpeedPos50Effect", "EEffectType::BulletSpeedSlowdown", "-50%", "weapon_velocity"),
];

const TOZ_UPGRADE_IMAGE = (path: string) =>
  `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/PDA/Upgrades/Weapons/Shotgun/TOZ/${path}'`;

const upgrade = (fields: Record<string, unknown>, effects: string[], required: string[]) =>
  root(
    new Struct({
      ...fields,
      Text: `sid_upgrades_${fields.SID}_name`,
      Hint: `sid_upgrades_${fields.SID}_description`,
      // vanilla upgrades inherit these from UpgradePrototypes.cfg's [0]; a new root struct must set them
      DiscountCoefficient: "0.f",
      RepairCostModifier: "0.2f",
      IsModification: false,
      EffectPrototypeSIDs: new Struct(Object.fromEntries(effects.map((e, i) => [i, e]))),
      RequiredUpgradePrototypeSIDs: new Struct(Object.fromEntries(required.map((e, i) => [i, e]))),
    }) as UpgradePrototype,
  );

export const SLUG_BARREL_SID = "GunTOZ_Upgrade_Barrel_4_1";
export const RIFLED_LINER_SID = "GunTOZ_Upgrade_Barrel_4_2";
export const POLISHED_ACTION_SID = "GunTOZ_Upgrade_Body_2";

export const slugUpgrades = [
  upgrade(
    {
      SID: SLUG_BARREL_SID,
      Image: TOZ_UPGRADE_IMAGE("Barrel/Upgrade/T_TOZU_a_a1.T_TOZU_a_a1"),
      BaseCost: 3000,
      HorizontalPosition: 2,
      VerticalPosition: "EUpgradeVerticalPosition::Top",
      UpgradeTargetPart: "EUpgradeTargetPartType::Barrel",
      ConnectionLines: new Struct({ 0: "EConnectionLineState::Down" }),
    },
    ["UberToz_FireDistancePos80Effect", "UberToz_DistanceDropOffLengthPos170Effect", "UberToz_DamageFalloffPos500Effect"],
    ["GunTOZ_Upgrade_Barrel_2_1"],
  ),
  upgrade(
    {
      SID: RIFLED_LINER_SID,
      Image: TOZ_UPGRADE_IMAGE("Barrel/Upgrade/T_TOZU_a_a.T_TOZU_a_a"),
      BaseCost: 2500,
      HorizontalPosition: 2,
      VerticalPosition: "EUpgradeVerticalPosition::Down",
      UpgradeTargetPart: "EUpgradeTargetPartType::Barrel",
      ConnectionLines: new Struct({ 0: "EConnectionLineState::Top" }),
    },
    ["UberToz_ProjectileSpeedPos50Effect", "BulletFalloffPos20Effect"],
    ["GunTOZ_Upgrade_Barrel_2_1"],
  ),
  upgrade(
    {
      SID: POLISHED_ACTION_SID,
      Image: TOZ_UPGRADE_IMAGE("Body/Upgrade/T_TOZU_c_1.T_TOZU_c_1"),
      BaseCost: 1200,
      HorizontalPosition: 1,
      VerticalPosition: "EUpgradeVerticalPosition::Top",
      UpgradeTargetPart: "EUpgradeTargetPartType::Body",
      ConnectionLines: new Struct({ 0: "EConnectionLineState::Down" }),
    },
    ["WeaponWithdrawPos30ShowEffect", "WeaponWithdrawPos30HideEffect"],
    ["GunTOZ_Upgrade_Body_1"],
  ),
];
