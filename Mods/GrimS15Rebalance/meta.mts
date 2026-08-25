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
  DurabilityDamagePerShot: 1.76 / 2,
}) as PlayerWeaponSettingsPrototype;
s15PlayerSettings.__internal__.isRoot = true;
s15PlayerSettings.__internal__.rawName = S15_PLAYER_SETTINGS_SID;
s15PlayerSettings.__internal__.refkey = "GunGrim_ST_Player";

export const meta: MetaType<Struct> = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
Rebalances the Grim S-15 assault rifle.[h3][/h3]
[list]
  [*] Durability damage per shot reduced 2x
  [*] Default magazine: 30 rounds
  [*] Increased magazine: 45 rounds
  [*] Large magazine: 60 rounds
[/list]

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Removed base durability increase; now only reduces durability damage per shot",
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
