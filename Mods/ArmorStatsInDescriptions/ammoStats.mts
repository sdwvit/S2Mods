/**
 * Every bullet and shell (base game; DLC adds none) with how it changes the gun that fires it,
 * resolved through the `refkey` chain of `AmmoPrototypes.cfg`. Grenades and rockets
 * (`DamageSource = Explosion`) are left out: their damage is not a modifier of the gun's.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { Struct } from "s2cfgtojson";
import { baseCfgDir } from "../../src/base-paths.mts";

export type AmmoStats = {
  SID: string;
  textSID: string;
  /** Multiplier on the gun's damage, all pellets together. */
  damage: number;
  /** Pellets per shot; 1 for a bullet or slug. */
  pellets: number;
  /** Added to the gun's `ArmorPiercing`, on the 0-4 armor scale. */
  penetration: number;
  /** Multiplier on the gun's wear per shot (`WeaponExhaustionMod`). */
  weaponWear: number;
  flatness: number;
  spread: number;
};

const FILE = path.join(baseCfgDir, "GameData/ItemPrototypes/AmmoPrototypes.cfg");

export function readAmmoStats(): AmmoStats[] {
  const byName = new Map<string, Struct>();
  Struct.fromString<Struct>(readFileSync(FILE, "utf8")).forEach((struct) =>
    byName.set(struct.__internal__.rawName ?? struct.SID, struct),
  );
  const resolve = (struct: Struct | undefined, key: string): unknown => {
    for (let s = struct, depth = 0; s && depth < 20; depth++) {
      if (s[key] !== undefined) return s[key];
      s = byName.get(String(s.__internal__.refkey));
    }
    return undefined;
  };
  const num = (struct: Struct, key: string, fallback: number) =>
    parseFloat(String(resolve(struct, key) ?? fallback)) || fallback;

  return [...byName.values()]
    .filter(
      (s) =>
        s.SID &&
        !s.SID.startsWith("Template") &&
        resolve(s, "DamageSource") !== "EDamageSource::Explosion",
    )
    .map((s) => {
      const pellets = num(s, "FractionCount", 1);
      const loc = resolve(s, "LocalizationSID");
      return {
        SID: s.SID,
        textSID: typeof loc === "string" && loc && loc !== "empty" ? loc : s.SID,
        damage: num(s, "DamageMod", 1) * pellets,
        pellets,
        penetration: parseFloat(String(resolve(s, "ArmorPiercingMod") ?? 0)) || 0,
        weaponWear: num(s, "WeaponExhaustionMod", 1),
        flatness: num(s, "FlatnessMod", 1),
        spread: num(s, "DispersionMod", 1),
      };
    });
}
