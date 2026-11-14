import {
  STOP_EXTINCTION,
  TRIGGER_EXTINCTION,
  FULL_WIPE_REFILL_COOLDOWN,
  PARTIAL_WIPE_REFILL_COOLDOWN,
} from "../transformALifePolicyPrototypes.mts";
import {
  LAIR_EXPANSION_TIME,
  EXPANSION_BATTLE_CHANCE,
} from "../transformALifePopulationManagerFactionPrototypes.mts";
import {
  EXPANSION_INITIAL_NEED,
  EXPANSION_MIN_INCREASE_PER_MINUTE,
  EXPANSION_MAX_INCREASE_PER_MINUTE,
  EXPANSION_MIN_SQUAD_SIZE,
  LONER_SQUAD_SIZE,
} from "../transformNPCNeedsPresetPrototypes.mts";
import { tierMultiplier, MUTANT_COOLDOWN_DIVISOR_BY_RANK, RANKS } from "../lairTiers.mts";

/**
 * Rules of the simulation. `fromMod` values are imported from the LairWars transformers, so they follow the build.
 * `assumed` values are not known from the game files or the binary yet: each says where it came from. Calibrate them
 * against Living Zone Tracker session recordings (session_logs/*.zip) before trusting absolute numbers.
 */
export const fromMod = {
  triggerExtinction: TRIGGER_EXTINCTION,
  stopExtinction: STOP_EXTINCTION,
  /** Real seconds (a vanilla 120 s partial cooldown matched a 133 s median gap between refills in a recording). */
  fullWipeRefillCooldown: FULL_WIPE_REFILL_COOLDOWN,
  partialWipeRefillCooldown: PARTIAL_WIPE_REFILL_COOLDOWN,
  /** Seconds between the population manager's expansion checks. */
  expansionCheck: LAIR_EXPANSION_TIME,
  battleChance: EXPANSION_BATTLE_CHANCE / 100,
  needStart: EXPANSION_INITIAL_NEED,
  needRateMin: EXPANSION_MIN_INCREASE_PER_MINUTE,
  needRateMax: EXPANSION_MAX_INCREASE_PER_MINUTE,
  minSquad: EXPANSION_MIN_SQUAD_SIZE,
  lonerMaxSquad: LONER_SQUAD_SIZE.max,
  /** ALifeLairExpansionRadius, vanilla 500000 cm. */
  expansionRadiusM: 5000,
};

export const assumed = {
  /** Game minutes per real minute, measured from a tracker recording (2026-11-13 session: median 13.7). */
  gameTimeScale: 13.7,
  /** Expansion need rises per real minute (the cfg says "per minute"; which clock is unknown). */
  needClock: "real" as "real" | "game",
  /**
   * Offline squad travel speed, m/s real time, over the straight line (detour 1). Measured: 266 capture trips in
   * recordings of 11-08..11-13, start distance / moving time, median 0.83 m/s (quartiles 0.35-1.78).
   */
  travelSpeed: 0.85,
  detour: 1,
  /** Target choice among reachable lairs: weight 1 / distance^p over the `targetPool` nearest. Unknown. */
  targetDistancePower: 2,
  targetPool: 12,
  /**
   * How often a lair with ready inhabitants actually sends a squad. "perLair": each lair, each check, with
   * `expansionChance`. "global": the population manager looks at `expansionsPerCheck` random lairs per check.
   * Unknown; fitted against recordings (see calibrate.mts).
   */
  /** Unit of ALifeLairExpansionTime (mod 5, vanilla 50): real seconds or game minutes. Unknown. */
  checkUnit: "seconds" as "seconds" | "gameMinutes",
  expansionMode: "perLair" as "perLair" | "global",
  // fitted: 0.0003 per 5 s check matches 16.8 captures/h over 8 recordings (calibrate.mts, 2026-11-14)
  expansionChance: 0.0003,
  expansionsPerCheck: 1,
  /** Inhabitants a lair keeps at home when a squad forms. The mod's design says home is never left empty. */
  keepHome: 1,
  /** A squad that finds no target: its members' need drops back to the start value. */
  resetNeedWithoutTarget: true,
  /**
   * Offline battle: P(attacker wins) = A^k / (A^k + D^k), A and D the summed power of each side. The winner loses
   * min(1, (loser / winner) * lossScale) of its units. Not known from the binary: a Lanchester-style guess.
   */
  battleExponent: 1.5,
  lossScale: 0.6,
  /** What-if: a mutant that takes a lair holds as many as its own species' lair would (not the lair's size). */
  sizeByOccupant: false,
  /** A lair coming back after a full wipe spawns this share of its capacity at once; the rest refills one by one. */
  fullWipeRespawnShare: 1,
  /** Starting expansion need of the inhabitants at the start of a run: random in [0, startNeedMax). */
  startNeedMax: 100,
};

/** Max squad size by faction kind (meta.mts description: loners up to 3, packs and people 4, zombies 5). */
const LONERS = new Set([
  "Chimera",
  "Pseudogiant",
  "Controller",
  "Burer",
  "Poltergeist",
  "Deer",
  "Rat",
]);
export const maxSquad = (faction: string, isMutant: boolean) =>
  LONERS.has(faction) ? fromMod.lonerMaxSquad : faction === "Zombie" ? 5 : isMutant ? 4 : 4;

/**
 * Power of one inhabitant: BetterQuestRewards' base reward per enemy (Mods/BetterQuestRewards quest table),
 * scaled by rank. Entries marked (assumed) are not in the quest table.
 */
const BASE_POWER: Record<string, number> = {
  Tushkan: 87.5,
  Flesh: 175,
  Blinddog: 187.5,
  Boar: 200,
  Zombie: 200,
  Snork: 250,
  Rat: 250,
  Bayun: 375,
  Pseudodog: 500,
  Burer: 750,
  Poltergeist: 875,
  Bloodsucker: 1000,
  Controller: 1750,
  Deer: 2250,
  Pseudogiant: 3250,
  Chimera: 4000, // (assumed) not in the quest table; above the pseudogiant
  Bandits: 250,
  Neutrals: 250,
  Duty: 350,
  Freedom: 350,
  Mercenaries: 400, // from the one Owl quest with mercenaries: (3450 - 4 x 175) / 7
  Monolith: 350, // (assumed)
  Varta: 350, // (assumed)
  Militaries: 350, // (assumed)
  Noon: 350, // (assumed)
  Spark: 350, // (assumed)
  Corpus: 350, // (assumed)
  Scientists: 150, // (assumed)
};

/** Humans and weak mutants get the tier HP multiplier; strong mutants the attack-speed divisor (lairTiers.mts). */
export function unitPower(group: string, tier: number, isMutant: boolean) {
  const base = BASE_POWER[group] ?? 300;
  const weak = !isMutant || base <= 250;
  return base * (weak ? tierMultiplier(tier) : MUTANT_COOLDOWN_DIVISOR_BY_RANK[RANKS[tier]]);
}

/** Species tier S1-S4 (BetterQuestRewards bands), for the report. Humans get 0. */
export function speciesTier(group: string, isMutant: boolean) {
  if (!isMutant) return 0;
  const p = BASE_POWER[group] ?? 300;
  return p <= 200 ? 1 : p <= 500 ? 2 : p <= 1750 ? 3 : 4;
}
