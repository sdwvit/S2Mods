import type { MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import type {
  AttachPrototype,
  PlayerWeaponAttributesPrototype,
  PlayerWeaponSettingsPrototype,
  WeaponPrototype,
} from "s2cfgtojson";

const S15_PLAYER_ATTRS_SID = "Gun_S15_AR_Player";
const S15_PLAYER_SETTINGS_SID = "Gun_S15_AR_Player_Settings";

const s15PlayerAttrs = new Struct({
  SID: S15_PLAYER_ATTRS_SID,
  DefaultWeaponSettingsSID: S15_PLAYER_SETTINGS_SID,
}) as PlayerWeaponAttributesPrototype;
s15PlayerAttrs.__internal__.isRoot = true;
s15PlayerAttrs.__internal__.rawName = S15_PLAYER_ATTRS_SID;
s15PlayerAttrs.__internal__.refkey = "GunGrim_ST_Player";

const s15PlayerSettings = new Struct({
  SID: S15_PLAYER_SETTINGS_SID,
  DurabilityDamagePerShot: 1.76 / 5,
}) as PlayerWeaponSettingsPrototype;
s15PlayerSettings.__internal__.isRoot = true;
s15PlayerSettings.__internal__.rawName = S15_PLAYER_SETTINGS_SID;
s15PlayerSettings.__internal__.refkey = "GunGrim_ST_Player";

export const meta: MetaType<Struct> = {
  description: `
Rebalances the Grim S-15 assault rifle.[h3][/h3]
[list]
  [*] Durability doubled: 2700 → 5400
  [*] Durability damage per shot reduced 5x
  [*] Default magazine: 30 rounds
  [*] Increased magazine: 45 rounds
  [*] Large magazine: 60 rounds
[/list]
`,
  changenote: "Initial release",
  structTransformers: [
    transformWeaponPrototypes,
    transformPlayerWeaponAttrs,
    transformPlayerWeaponSettings,
    transformAttachPrototypes,
  ],
};

function transformWeaponPrototypes(struct: WeaponPrototype) {
  if (struct.SID === "Gun_S15_AR") {
    const fork = struct.fork();
    fork.BaseDurability = 5400;
    fork.PlayerWeaponAttributes = S15_PLAYER_ATTRS_SID;
    return fork;
  }
  return null;
}

transformWeaponPrototypes.files = ["/WeaponPrototypes.cfg"];

function transformPlayerWeaponAttrs(struct: PlayerWeaponAttributesPrototype) {
  if (struct.SID === "GunGrim_ST_Player") {
    return s15PlayerAttrs;
  }
}

transformPlayerWeaponAttrs.files = ["/PlayerWeaponAttributesPrototypes.cfg"];

function transformPlayerWeaponSettings(struct: PlayerWeaponSettingsPrototype) {
  if (struct.SID === "GunGrim_ST_Player") {
    return s15PlayerSettings;
  }
}

transformPlayerWeaponSettings.files = ["/PlayerWeaponSettingsPrototypes.cfg"];

const magSizes: Record<string, number> = {
  GunS15_MagDefault: 30,
  GunGrim_MagIncreased: 45,
  GunGrim_MagLarge: 60,
};

function transformAttachPrototypes(struct: AttachPrototype) {
  const maxAmmo = magSizes[struct.SID];
  if (!maxAmmo) return null;
  const fork = struct.fork();
  fork.Magazine = struct.Magazine.fork();
  fork.Magazine.MaxAmmo = maxAmmo;
  return fork;
}

transformAttachPrototypes.files = ["/AttachPrototypes.cfg"];
