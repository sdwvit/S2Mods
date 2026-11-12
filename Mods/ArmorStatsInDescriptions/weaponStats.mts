/**
 * Every player-visible firearm, base game and DLC, with its base stats resolved through the
 * `refkey`/`refurl` chains of three cfg families:
 *
 *   WeaponPrototypes            -> GeneralWeaponSetup (FireInterval, FireTypes, AmmoCaliber),
 *                                  PlayerWeaponAttributes
 *   PlayerWeaponAttributes      -> DefaultWeaponSettingsSID
 *   PlayerWeaponSettings        -> BaseDamage, ArmorPiercing, DamageUI, RangeUI
 *
 * `DamageUI` and `RangeUI` are the 0-1 fills of the inventory tooltip's bars.
 * Damage is for the caliber's default round (FMJ, or buckshot for 12 gauge): `BaseDamage` x the
 * round's `DamageMod` x its `FractionCount` (pellets). Upgrades and attachments are not reflected.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { Struct } from "s2cfgtojson";
import { baseCfgDir } from "../../src/base-paths.mts";

export type WeaponStats = {
  SID: string;
  /** The key the game reads text under: `LocalizationSID` when set, else `SID`. */
  textSID: string;
  /** Damage of one shot with the default round (all pellets for buckshot). */
  damage: number;
  /** The tooltip's range bar, 0-1. */
  rangeUI: number;
  /** `ArmorPiercing`, on the same 0-4 scale as an armor's physical protection. */
  penetration: number;
  /**
   * 60 / `FireInterval`, or undefined when that interval does not set the real rate: semi-auto
   * guns fire as fast as you click and many inherit the template's 0.1 s, so only full-auto guns
   * and slow cyclers (pump, bolt, revolver: 0.3 s and up) get one.
   */
  shotsPerMinute?: number;
  /** `BaseDurability`, the item's condition points when new. */
  durability: number;
};

const projectRoot = path.join(import.meta.dirname, "../..");
const gameData = path.join(baseCfgDir, "GameData");
const DLCS = ["Deluxe", "Ultimate", "PreOrder", "DLC1"].map((dlc) =>
  path.join(projectRoot, "DLCGameData", dlc),
);

const FILES = [
  path.join(gameData, "ItemPrototypes.cfg"),
  path.join(gameData, "ItemPrototypes/WeaponPrototypes.cfg"),
  path.join(gameData, "ItemPrototypes/AmmoPrototypes.cfg"),
  path.join(gameData, "WeaponData/WeaponGeneralSetupPrototypes.cfg"),
  path.join(gameData, "WeaponData/WeaponAttributesPrototypes.cfg"),
  path.join(gameData, "WeaponData/WeaponAttributesPrototypes/PlayerWeaponAttributesPrototypes.cfg"),
  path.join(gameData, "WeaponData/CharacterWeaponSettingsPrototypes.cfg"),
  path.join(
    gameData,
    "WeaponData/CharacterWeaponSettingsPrototypes/PlayerWeaponSettingsPrototypes.cfg",
  ),
  ...DLCS.flatMap((dlc) => [
    path.join(dlc, "ItemPrototypes.cfg"),
    path.join(dlc, "WeaponData/WeaponGeneralSetupPrototypes.cfg"),
    path.join(dlc, "WeaponData/WeaponAttributesPrototypes.cfg"),
    path.join(dlc, "WeaponData/CharacterWeaponSettingsPrototypes.cfg"),
  ]),
];

type Node = { struct: Struct; file: string };

const readNodes = () => {
  const byFile = new Map<string, Map<string, Node>>();
  const all: Node[] = [];
  for (const file of FILES) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const local = new Map<string, Node>();
    Struct.fromString<Struct>(text).forEach((struct) => {
      const node = { struct, file };
      local.set(struct.__internal__.rawName ?? struct.SID, node);
      all.push(node);
    });
    byFile.set(file, local);
  }
  return { byFile, all };
};

export function readWeaponStats(): WeaponStats[] {
  const { byFile, all } = readNodes();
  // A refurl names its target by a path relative to the game's own tree; the basename is enough
  // to find it among the base-game files (DLC structs never point at other DLC files).
  const baseFileNamed = (name: string) =>
    FILES.find((f) => f.startsWith(gameData) && path.basename(f) === name);

  const parentOf = (node: Node): Node | undefined => {
    const { refkey, refurl } = node.struct.__internal__;
    if (!refkey) return undefined;
    const file = refurl ? (baseFileNamed(path.basename(refurl)) ?? node.file) : node.file;
    return byFile.get(file)?.get(String(refkey));
  };
  const chain = (node: Node) => {
    const out: Node[] = [];
    for (let n: Node | undefined = node; n && out.length < 20; n = parentOf(n)) out.push(n);
    return out;
  };
  const resolve = (node: Node | undefined, key: string) => {
    if (!node) return undefined;
    for (const n of chain(node)) if (n.struct[key] !== undefined) return n.struct[key];
    return undefined;
  };
  const num = (v: unknown) => parseFloat(String(v ?? 0)) || 0;

  /** Structs of one family by SID; later files (DLC) win. */
  const family = (match: (file: string) => boolean) => {
    const map = new Map<string, Node>();
    for (const node of all) if (match(node.file) && node.struct.SID) map.set(node.struct.SID, node);
    return map;
  };
  const setups = family((f) => f.includes("WeaponGeneralSetup"));
  const attributes = family((f) => f.includes("WeaponAttributes"));
  const settings = family((f) => f.includes("CharacterWeaponSettings"));

  /** Default round per caliber: `DamageMod` x `FractionCount`. */
  const roundDamage = new Map<string, number>();
  for (const node of all) {
    if (!node.file.endsWith("AmmoPrototypes.cfg")) continue;
    if (resolve(node, "AmmoType") !== "EAmmoType::Default") continue;
    const caliber = String(resolve(node, "Caliber"));
    if (!roundDamage.has(caliber)) {
      roundDamage.set(
        caliber,
        num(resolve(node, "DamageMod") ?? 1) * num(resolve(node, "FractionCount") ?? 1),
      );
    }
  }

  /** The first non-empty `FireTypes` in the setup's chain (an empty one inherits). */
  const fireTypes = (setup: Node) => {
    for (const n of chain(setup)) {
      const list = n.struct["FireTypes" as string];
      const types = Object.values(list ?? {}).filter(
        (v): v is string => typeof v === "string" && v.startsWith("EFireType::"),
      );
      if (types.length) return types.map((v) => v.replace(/\{.*$/, ""));
    }
    return [];
  };

  return all
    .filter((node) => {
      const sid = node.struct.SID;
      if (!sid || sid.startsWith("Template") || !/(Item|Weapon)Prototypes\.cfg$/.test(node.file)) {
        return false;
      }
      const types = chain(node).map((n) => n.struct.SID);
      // Launchers deal explosion damage that BaseDamage does not describe.
      if (sid.endsWith("_GL") || sid.includes("Launch")) return false;
      return types.includes("TemplateWeapon") && !types.includes("MeleeStub");
    })
    .flatMap((node) => {
      const attrSID = resolve(node, "PlayerWeaponAttributes");
      const settingsSID = resolve(attributes.get(String(attrSID)), "DefaultWeaponSettingsSID");
      const weaponSettings = settings.get(String(settingsSID));
      const setup = setups.get(String(resolve(node, "GeneralWeaponSetup")));
      if (!weaponSettings || !setup) return [];
      const fireInterval = num(resolve(setup, "FireInterval"));
      const automatic = fireTypes(setup).includes("EFireType::Automatic");
      const caliber = String(resolve(setup, "AmmoCaliber"));
      const loc = resolve(node, "LocalizationSID");
      return [
        {
          SID: node.struct.SID,
          textSID: typeof loc === "string" && loc && loc !== "empty" ? loc : node.struct.SID,
          damage: num(resolve(weaponSettings, "BaseDamage")) * (roundDamage.get(caliber) ?? 1),
          rangeUI: num(resolve(weaponSettings, "RangeUI")),
          penetration: num(resolve(weaponSettings, "ArmorPiercing")),
          shotsPerMinute:
            fireInterval > 0 && (automatic || fireInterval >= 0.3) ? 60 / fireInterval : undefined,
          durability: num(resolve(node, "BaseDurability")),
        },
      ];
    });
}
