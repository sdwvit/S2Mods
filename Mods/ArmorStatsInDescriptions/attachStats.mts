/**
 * Every weapon attachment (base game) with what it changes, from `AttachPrototypes.cfg` and the
 * effects it lists (`EffectPrototypeSIDs`, resolved in `EffectPrototypes.cfg`):
 * - magazines: `Magazine.MaxAmmo`, and `IsTwinMagazine` for coupled pairs;
 * - scopes: zoom, read off the `AimingFOVX<n>Effect` they carry;
 * - every effect with a value: aiming speed, moving while aiming, recoil, sway, loudness, range,
 *   bullet velocity, flatness, weapon wear.
 * Muzzle brakes, compensators, grips and lasers carry no effects in the cfgs, so they get nothing.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { Struct } from "s2cfgtojson";
import { baseCfgDir } from "../../src/base-paths.mts";

export type AttachEffect = {
  /** `LocalizationSID` of the effect (its vanilla label is `sid_effects_<id>_name`), or one of
   * this mod's own keys for effects the game never labels: `loudness`, `sway`. */
  label: string;
  /** Percent, signed as the cfg has it. */
  percent: number;
  /** The effect's `Positive`: whether the game counts it as an upgrade. */
  beneficial: boolean | undefined;
};

export type AttachStats = {
  SID: string;
  textSID: string;
  /** Rounds per magazine; 0 for a non-magazine. */
  capacity: number;
  twinMagazine: boolean;
  /** Scope magnification; 0 for no scope. */
  zoom: number;
  effects: AttachEffect[];
};

const gameData = path.join(baseCfgDir, "GameData");

const readFile = (file: string) => {
  const byName = new Map<string, Struct>();
  Struct.fromString<Struct>(readFileSync(path.join(gameData, file), "utf8")).forEach((s) =>
    byName.set(s.__internal__.rawName ?? s.SID, s),
  );
  const resolve = (struct: Struct | undefined, key: string): any => {
    for (let s = struct, depth = 0; s && depth < 20; depth++) {
      if (s[key] !== undefined) return s[key];
      s = byName.get(String(s.__internal__.refkey));
    }
    return undefined;
  };
  return { byName, resolve };
};

/** "-20%" -> -20, "0.2" -> 20 (a bare fraction is a share). */
const percentOf = (value: unknown) => {
  const text = String(value ?? 0).trim();
  const number = parseFloat(text) || 0;
  return text.endsWith("%") ? number : number * 100;
};

export function readAttachStats(): AttachStats[] {
  const attach = readFile("ItemPrototypes/AttachPrototypes.cfg");
  const effects = readFile("EffectPrototypes.cfg");

  const effectRows = (sids: string[]): AttachEffect[] => {
    const rows: AttachEffect[] = [];
    for (const sid of sids) {
      const effect = effects.byName.get(sid);
      if (!effect) continue;
      const type = String(effects.resolve(effect, "Type"));
      const loc = String(effects.resolve(effect, "LocalizationSID") ?? "Empty");
      const positive = String(effects.resolve(effect, "Positive"));
      const beneficial =
        positive === "EBeneficial::Positive"
          ? true
          : positive === "EBeneficial::Negative"
            ? false
            : undefined;
      const percent = percentOf(effects.resolve(effect, "ValueMin"));
      if (type === "EEffectType::AimingFOV" || type === "EEffectType::FlagEffect") continue;
      // Sway comes as an X and a Y effect with the same value: one row.
      if (type === "EEffectType::IdleSwayYModifier") continue;
      if (type === "EEffectType::IdleSwayXModifier") {
        rows.push({ label: "sway", percent, beneficial: true });
      } else if (type === "EEffectType::FireLoudness") {
        rows.push({ label: "loudness", percent, beneficial });
      } else if (loc !== "Empty") {
        rows.push({ label: loc, percent, beneficial });
      }
    }
    return rows;
  };

  return [...attach.byName.values()]
    .filter((s) => s.SID && !s.SID.includes("Template"))
    .map((s) => {
      const sids = Object.values(attach.resolve(s, "EffectPrototypeSIDs") ?? {}).filter(
        (v): v is string => typeof v === "string",
      );
      const magazine = s["Magazine" as string] as Struct | undefined;
      const fov = sids.find((sid) => /^AimingFOVX\d+Effect$/.test(sid));
      const loc = attach.resolve(s, "LocalizationSID");
      return {
        SID: s.SID,
        textSID: typeof loc === "string" && loc && loc !== "empty" ? loc : s.SID,
        capacity: parseFloat(String(magazine?.["MaxAmmo" as string] ?? 0)) || 0,
        twinMagazine: String(magazine?.["IsTwinMagazine" as string]) === "true",
        zoom: fov ? parseInt(fov.replace(/\D/g, ""), 10) : 0,
        effects: effectRows(sids),
      };
    });
}
