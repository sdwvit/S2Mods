/**
 * Offline duels. Two rules, chosen with run.mts --combat:
 *
 * - `vanilla` (OfflineCombatSatisfier): each side rolls rand(0..OfflineCombatWeight), the higher roll wins, the loser
 *   dies and the winner is untouched.
 * - `ttk`: the patched exe (src/exe-patches/offline-combat-ttk/cave.c), ported line by line. Shorter time-to-kill
 *   wins, equal time to kill kills both, OfflineCombatWeight is ignored; the winner keeps the damage it took
 *   (HP stays >= 1).
 *
 * The patch reads each unit live from the game. The sim has no inventories, so for humans the loadout is assumed
 * (HUMAN_LOADOUT below). Mutant HP, attack and weight come from GameLite cfgs and cave.c's attacks.h.
 */
import { tierMultiplier, monolithHpBonus } from "../lairTiers.mts";
// the mod's near-equal OfflineCombatWeight, from the vanilla one
import { offlineCombatWeight, MONOLITH_WEIGHT_BONUS } from "../transformEnemyObjPrototypes.mts";

/** Vanilla OfflineCombatWeight (GameLite ObjPrototypes cfgs); humans are NPCBase (10). */
const VANILLA_WEIGHT: Record<string, number> = {
  Rat: 1, // RatSwarm
  Tushkan: 2,
  Zombie: 4, // GeneralZombie_*
  Blinddog: 5,
  Flesh: 8, // MutantBase
  Boar: 18,
  Snork: 20,
  Poltergeist: 20,
  Bayun: 25, // Cat
  Bloodsucker: 25,
  Pseudodog: 30,
  Burer: 40,
  Controller: 60,
  Deer: 75,
  Chimera: 75,
  Pseudogiant: 100,
};

export type Combat = "vanilla" | "ttk";

export type Fighter = {
  weight: number;
  hp: number;
  mutant: boolean;
  rank: number; // 0-3
  /** best weapon (humans) or strongest attack ability (mutants) */
  dmg: number;
  ap: number;
  prot: number; // Strike protection, capped at PROT_CAP
  coef: number; // ObjPrototype damage coef the patch reads at +0x58a
  medhp: number;
  burst: number;
};

// cave.c tuning
const MEDKIT_HP = 50;
const GRENADE_DMG = 40;
const GRENADE_VS_MUTANT = 0.5;
const MUTANT_BASE_DMG = 16;
const PROT_CAP = 4.5;
const RAND_SPREAD = 0.25;
const NO_KILL = 1e9;
const RANK_ACC = [0.6, 0.7, 0.8, 0.9];

/** Vanilla MaxHP (ObjPrototypes cfgs) and strongest attack: Damage, ArmorPiercing (cave.c attacks.h). */
const MUTANT: Record<string, { hp: number; dmg: number; ap: number }> = {
  Rat: { hp: 60, dmg: 0, ap: 0 }, // no attack in the table: MUTANT_BASE_DMG
  Tushkan: { hp: 19, dmg: 10, ap: 0 },
  Flesh: { hp: 280, dmg: 20, ap: 1 },
  Blinddog: { hp: 300, dmg: 10, ap: 1 }, // MutantBase HP
  Boar: { hp: 300, dmg: 30, ap: 1 },
  Snork: { hp: 150, dmg: 25, ap: 3 },
  Bayun: { hp: 400, dmg: 24, ap: 3 },
  Pseudodog: { hp: 300, dmg: 10, ap: 3 },
  Bloodsucker: { hp: 500, dmg: 32, ap: 2 },
  Burer: { hp: 400, dmg: 30, ap: 4 },
  Poltergeist: { hp: 400, dmg: 0, ap: 0 }, // not in the table
  Controller: { hp: 500, dmg: 30, ap: 4 },
  Deer: { hp: 600, dmg: 30, ap: 3 },
  Pseudogiant: { hp: 2500, dmg: 45, ap: 3 },
  Chimera: { hp: 1400, dmg: 45, ap: 4 },
};

/**
 * Assumed: a human's loadout per rank tier (Newbie..Master), standing in for the inventory the patch reads.
 * Weapon BaseDamage / ArmorPiercing of a typical rifle at that rank, armor Strike protection, medkits, grenades.
 */
const HUMAN_LOADOUT = [
  { dmg: 9, ap: 2, prot: 1, medkits: 1, grenades: 0 },
  { dmg: 10, ap: 3, prot: 2, medkits: 2, grenades: 1 },
  { dmg: 11, ap: 3.5, prot: 3, medkits: 3, grenades: 1 },
  { dmg: 12, ap: 4, prot: 4, medkits: 4, grenades: 2 },
];
/** Assumed: the ObjPrototype coef the patch reads (+0x58a); its cfg field isn't identified. */
const COEF = 1.25;
const HUMAN_HP = 100;

export function fighter(group: string, tier: number, isMutant: boolean): Fighter {
  const weight = offlineCombatWeight(VANILLA_WEIGHT[group] ?? (isMutant ? 8 : 10)) + (group === "Monolith" ? MONOLITH_WEIGHT_BONUS : 0);
  if (isMutant) {
    const m = MUTANT[group] ?? { hp: 300, dmg: 0, ap: 0 };
    // LairWars: weak mutants (vanilla HP under 200) get the tier HP multiplier
    const hp = m.hp < 200 ? m.hp * tierMultiplier(tier) : m.hp;
    return { weight, hp, mutant: true, rank: tier, dmg: m.dmg, ap: m.ap, prot: 0, coef: COEF, medhp: 0, burst: 0 };
  }
  const l = HUMAN_LOADOUT[tier];
  return {
    weight,
    hp: HUMAN_HP * tierMultiplier(tier) * (group === "Monolith" ? monolithHpBonus(tier) : 1), // LairWars rank HP
    mutant: false,
    rank: tier,
    dmg: l.dmg,
    ap: l.ap,
    prot: Math.min(PROT_CAP, l.prot),
    coef: COEF,
    medhp: MEDKIT_HP * Math.min(5, l.medkits),
    burst: GRENADE_DMG * Math.min(3, l.grenades),
  };
}

function damage(s: Fighter, e: Fighter) {
  let best = 0;
  if (!s.mutant) best = s.dmg * e.coef ** (s.ap - e.prot) * RANK_ACC[s.rank];
  else if (s.dmg > 0) best = s.dmg * e.coef ** (s.ap - e.prot);
  if (best <= 0) best = MUTANT_BASE_DMG * (1 - 0.1 * e.prot);
  return best; // the patch ignores OfflineCombatWeight
}

const ttk = (s: Fighter, dmg: number, e: Fighter) => {
  const left = e.hp + e.medhp - s.burst * (e.mutant ? GRENADE_VS_MUTANT : 1);
  return left <= 0 ? 0 : dmg > 0.001 ? left / dmg : NO_KILL;
};

const wound = (w: Fighter, l: Fighter, dmgL: number, ttkW: number) => {
  const taken = l.burst * (w.mutant ? GRENADE_VS_MUTANT : 1) + dmgL * ttkW - w.medhp;
  if (taken > 0) w.hp = Math.max(1, w.hp - taken);
};

/** "a" or "t" wins, or "both" die (ttk: equal time to kill). `ttk` wounds the winner in place. */
export function duel(a: Fighter, t: Fighter, combat: Combat, rand: () => number): "a" | "t" | "both" {
  if (combat === "vanilla") {
    const ra = rand() * a.weight;
    const rt = rand() * t.weight;
    return ra > rt || (ra === rt && rand() < 0.5) ? "a" : "t";
  }
  const da = damage(a, t) * (1 - RAND_SPREAD + 2 * RAND_SPREAD * rand());
  const dt = damage(t, a) * (1 - RAND_SPREAD + 2 * RAND_SPREAD * rand());
  const ta = ttk(a, da, t);
  const tt = ttk(t, dt, a);
  if (ta === tt) return "both";
  if (ta < tt) wound(a, t, dt, ta);
  else wound(t, a, da, tt);
  return ta < tt ? "a" : "t";
}
