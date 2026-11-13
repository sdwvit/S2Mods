/**
 * Hand grenades (base game) with their explosion's damage, from `GrenadePrototypes.cfg` ->
 * `ExplosionPrototypeSID` -> `ExplosionPrototypes.cfg` (`DamageNPC`, `DamagePlayer`), and the
 * armor resistance table `StrikeGrenadeResistCoefs` from `CoreVariables.cfg`. Damage is at the
 * blast centre; it falls off over the blast radius the tooltip already shows.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { Struct } from "s2cfgtojson";
import { baseCfgDir } from "../../src/base-paths.mts";

export type GrenadeStats = {
  SID: string;
  textSID: string;
  damage: number;
  damageToPlayer: number;
};

const gameData = path.join(baseCfgDir, "GameData");
const parse = (file: string) =>
  Struct.fromString<Struct>(readFileSync(path.join(gameData, file), "utf8"));

/** Share of grenade damage armor stops at strike protection 1-4 (index = protection). */
export function readGrenadeResist(): number[] {
  const text = readFileSync(path.join(gameData, "CoreVariables.cfg"), "utf8");
  const block = text.slice(text.indexOf("StrikeGrenadeResistCoefs"));
  const resist: number[] = [];
  for (const match of block.matchAll(
    /ProtectionStrike\s*=\s*([\d.]+)f?\s*GrenadeDamageResist\s*=\s*([\d.]+)f?/g,
  )) {
    resist[Math.round(parseFloat(match[1]))] = parseFloat(match[2]);
    if (resist.length > 4) break;
  }
  return resist;
}

export function readGrenadeStats(): GrenadeStats[] {
  const explosions = new Map<string, Struct>();
  parse("ExplosionPrototypes.cfg").forEach((s) => explosions.set(s.SID, s));
  return parse("ItemPrototypes/GrenadePrototypes.cfg")
    .filter((s) => s.SID && !s.SID.startsWith("Template"))
    .flatMap((s) => {
      const explosion = explosions.get(String(s["ExplosionPrototypeSID" as string]));
      if (!explosion) return [];
      const num = (key: string) => parseFloat(String(explosion[key as string] ?? 0)) || 0;
      return [
        {
          SID: s.SID,
          textSID: s.SID,
          damage: num("DamageNPC"),
          damageToPlayer: num("DamagePlayer"),
        },
      ];
    });
}
