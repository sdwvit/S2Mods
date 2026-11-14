import type { World } from "./world.mts";
import { fromMod as modRules, assumed, maxSquad, unitPower, speciesTier } from "./rules.mts";

/**
 * Offline A-Life of the whole Zone at lair level, stepped every expansion check (5 s real time):
 * 1. every inhabitant's expansion need rises at its own rate (start value, per-minute range from the mod);
 * 2. a lair whose ready inhabitants (need 100) can form a squad sends it at a reachable lair: empty, or held by a
 *    faction its policy may attack (AttackLairRestrictions), within the expansion radius;
 * 3. on arrival: own lair -> joins; empty -> captured; enemy -> battle (always, battle chance 100%), the winner
 *    holds the lair; a lair that became friendly meanwhile -> the squad walks home;
 * 0. lairs start empty and fill by their prototype's spawn timing (a fresh game), unless the world carries recorded
 *    populations;
 * 4. lairs below capacity refill one inhabitant per partial-wipe cooldown, a wiped lair comes back after the full
 *    cooldown; captured lairs refill as their new owner;
 * 5. above the extinction trigger, units picked uniformly from every living unit (lairs and squads on the move) are
 *    removed down to the stop value.
 * The player is not simulated (all of it runs offline). See rules.mts for what is known and what is assumed.
 */

type Unit = { need: number; rate: number; power: number };
type Lair = {
  i: number;
  id: string;
  x: number;
  y: number;
  region: number;
  prototype: string;
  owner: string;
  group: string;
  capturable: boolean;
  active: boolean;
  tier: number;
  cap: number;
  units: Unit[];
  wipedAt: number | null;
  lastRefill: number;
  near: Array<[number, number]>; // [lair index, distance m], nearest first, within the expansion radius
  /** Filling for the first time (fresh game): spawn timing of its prototype, until it is full or taken. */
  fresh: { initialShare: number; initialAt: number; fullAt: number } | null;
};
type Squad = {
  from: number;
  to: number;
  faction: string;
  units: Unit[];
  arrive: number;
  returning: boolean;
};

export type Options = { days: number; rankTier: number; seed: number; snapshotsPerDay?: number };

export type Event = {
  t: number;
  kind: "capture" | "battle" | "takeEmpty";
  lair: string;
  from: string;
  to: string;
  won?: boolean;
  dist: number;
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulate(world: World, opt: Options) {
  const rand = rng(opt.seed);
  const fromMod = { ...modRules, ...world.overrides };
  const realSeconds = (opt.days * 86400) / assumed.gameTimeScale;
  // seconds between expansion checks; the cfg value's unit is unknown (assumed.checkUnit)
  const dt =
    fromMod.expansionCheck * (assumed.checkUnit === "gameMinutes" ? 60 / assumed.gameTimeScale : 1);
  const needPerSecond = (perMinute: number) =>
    (perMinute / 60) * (assumed.needClock === "game" ? assumed.gameTimeScale : 1);
  const effTier = (region: number) => Math.max(opt.rankTier, region - 1);

  const newUnit = (l: Lair, need = fromMod.needStart): Unit => ({
    need,
    rate: needPerSecond(fromMod.needRateMin + rand() * (fromMod.needRateMax - fromMod.needRateMin)),
    power: unitPower(l.group, l.tier, world.isMutant(l.owner)),
  });
  /**
   * Lair size for a holder. As built, a lair's block for a faction that moved in is sized for the lair's own species
   * (a tushkan lair taken by chimeras holds 30-45). With assumed.sizeByOccupant a mutant holder gets the size of its
   * own species' lair prototype instead (what-if for a fix in the mod).
   */
  const capFor = (l: Lair, owner: string) => {
    const own = world.capacity(l.prototype, owner, l.tier);
    if (!assumed.sizeByOccupant || !world.isMutant(owner)) return own;
    const species = world.capacity(world.group(owner), world.group(owner), l.tier);
    return own > 0 && species > 0 ? species : own;
  };
  const setOwner = (l: Lair, owner: string) => {
    l.owner = owner;
    l.group = world.group(owner);
    l.cap = capFor(l, owner);
  };

  const lairs: Lair[] = world.lairs.map((w, i) => {
    const tier = effTier(w.region);
    const l: Lair = {
      ...w,
      i,
      group: "",
      tier,
      cap: 0,
      units: [],
      wipedAt: null,
      lastRefill: 0,
      near: [],
      fresh: null,
    };
    setOwner(l, w.owner);
    if (!l.active) return l;
    if (w.pop !== undefined)
      for (let n = 0; n < w.pop; n++) l.units.push(newUnit(l, rand() * assumed.startNeedMax));
    else
      l.fresh = world.startTiming?.(l.prototype, l.owner, l.tier) ?? {
        initialShare: 0.5,
        initialAt: 180,
        fullAt: 480,
      };
    return l;
  });
  const R = fromMod.expansionRadiusM;
  for (const a of lairs) {
    for (const b of lairs) {
      if (a === b || !b.active || !b.capturable) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d <= R) a.near.push([b.i, d]);
    }
    a.near.sort((p, q) => p[1] - q[1]);
  }

  const start = snapshotLairs(lairs);
  const squads: Squad[] = [];
  const events: Event[] = [];
  const counters = {
    squads: 0,
    squadUnits: 0,
    noTarget: 0,
    battles: 0,
    attackerWins: 0,
    captures: 0,
    emptyTakes: 0,
    joins: 0,
    returns: 0,
    battleDeaths: 0,
    culled: 0,
    refilled: 0,
    respawned: 0,
  };
  const deathsByGroup: Record<string, number> = {};
  const kill = (group: string, n: number) =>
    (deathsByGroup[group] = (deathsByGroup[group] ?? 0) + n);
  const timeline: Array<Record<string, number>> = [];
  const perSnapshot = opt.snapshotsPerDay ?? 1;
  const snapEvery = realSeconds / opt.days / perSnapshot;
  let nextSnap = 0;

  const alive = () =>
    lairs.reduce((s, l) => s + l.units.length, 0) + squads.reduce((s, q) => s + q.units.length, 0);
  const pickTarget = (l: Lair) => {
    const cands: Array<[number, number]> = [];
    for (const [j, d] of l.near) {
      const t = lairs[j];
      if (t.owner === l.owner) continue;
      if (world.capacity(t.prototype, l.owner, t.tier) <= 0) continue; // no block for this faction in that lair
      if (t.units.length > 0 && !world.mayAttack(l.owner, t.owner)) continue;
      cands.push([j, d]);
      if (cands.length >= assumed.targetPool) break;
    }
    if (!cands.length) return null;
    const w = cands.map(([, d]) => 1 / Math.max(d, 10) ** assumed.targetDistancePower);
    let r = rand() * w.reduce((a, b) => a + b, 0);
    for (let k = 0; k < cands.length; k++) if ((r -= w[k]) <= 0) return cands[k];
    return cands[cands.length - 1];
  };
  const removeRandom = (arr: Unit[], n: number) => {
    for (let k = 0; k < n && arr.length; k++) arr.splice(Math.floor(rand() * arr.length), 1);
  };
  const power = (us: Unit[]) => us.reduce((s, u) => s + u.power, 0);

  for (let t = 0; t <= realSeconds; t += dt) {
    // 1-2. needs and squads. Which lairs the population manager looks at in this check: see assumed.expansionMode.
    const chosen =
      assumed.expansionMode === "global"
        ? new Set(
            Array.from({ length: assumed.expansionsPerCheck }, () =>
              Math.floor(rand() * lairs.length),
            ),
          )
        : null;
    for (const l of lairs) {
      if (!l.active || !l.units.length) continue;
      let ready = 0;
      for (const u of l.units) {
        if (u.need < 100) u.need = Math.min(100, u.need + u.rate * dt);
        if (u.need >= 100) ready++;
      }
      if (chosen ? !chosen.has(l.i) : rand() >= assumed.expansionChance) continue;
      if (ready < fromMod.minSquad || !world.expanding.has(l.owner)) continue;
      const size = Math.min(
        ready,
        maxSquad(l.group, world.isMutant(l.owner)),
        l.units.length - assumed.keepHome,
      );
      if (size < fromMod.minSquad) continue;
      const target = pickTarget(l);
      if (!target) {
        counters.noTarget++;
        if (assumed.resetNeedWithoutTarget)
          for (const u of l.units) if (u.need >= 100) u.need = fromMod.needStart;
        continue;
      }
      const out: Unit[] = [];
      for (let k = l.units.length - 1; k >= 0 && out.length < size; k--) {
        if (l.units[k].need >= 100) out.push(...l.units.splice(k, 1));
      }
      for (const u of out) u.need = fromMod.needStart;
      const [to, d] = target;
      squads.push({
        from: l.i,
        to,
        faction: l.owner,
        units: out,
        arrive: t + (d * assumed.detour) / assumed.travelSpeed,
        returning: false,
      });
      counters.squads++;
      counters.squadUnits += out.length;
    }

    // 3. arrivals
    for (let k = squads.length - 1; k >= 0; k--) {
      const q = squads[k];
      if (q.arrive > t) continue;
      squads.splice(k, 1);
      if (!q.units.length) continue; // culled on the way
      const l = lairs[q.to];
      const dist = Math.hypot(l.x - lairs[q.from].x, l.y - lairs[q.from].y);
      if (l.owner === q.faction) {
        l.units.push(...q.units);
        counters.joins++;
        continue;
      }
      if (q.returning) {
        // home was lost while away: the squad is gone with it
        kill(world.group(q.faction), q.units.length);
        continue;
      }
      const from = l.owner;
      if (!l.units.length) {
        l.fresh = null;
        setOwner(l, q.faction);
        l.units = q.units;
        l.wipedAt = null;
        l.lastRefill = t;
        counters.emptyTakes++;
        counters.captures++;
        events.push({ t, kind: "takeEmpty", lair: l.id, from, to: q.faction, dist });
        continue;
      }
      if (!world.mayAttack(q.faction, l.owner) || rand() >= fromMod.battleChance) {
        squads.push({
          ...q,
          from: q.to,
          to: q.from,
          returning: true,
          arrive: t + (dist * assumed.detour) / assumed.travelSpeed,
        });
        counters.returns++;
        continue;
      }
      counters.battles++;
      const A = power(q.units);
      const D = power(l.units);
      const k_ = assumed.battleExponent;
      const attackerWins = rand() < A ** k_ / (A ** k_ + D ** k_);
      const [win, lose, winPow, losePow] = attackerWins
        ? [q.units, l.units, A, D]
        : [l.units, q.units, D, A];
      const winLoss = Math.round(win.length * Math.min(1, (losePow / winPow) * assumed.lossScale));
      kill(attackerWins ? l.group : world.group(q.faction), lose.length);
      kill(attackerWins ? world.group(q.faction) : l.group, winLoss);
      counters.battleDeaths += lose.length + winLoss;
      removeRandom(win, winLoss);
      events.push({ t, kind: "battle", lair: l.id, from, to: q.faction, won: attackerWins, dist });
      if (attackerWins && win.length) {
        l.fresh = null;
        setOwner(l, q.faction);
        l.units = win;
        l.wipedAt = null;
        l.lastRefill = t;
        counters.attackerWins++;
        counters.captures++;
        events.push({ t, kind: "capture", lair: l.id, from, to: q.faction, dist });
      } else if (attackerWins) {
        l.units = [];
      }
    }

    // 4. refill
    for (const l of lairs) {
      if (!l.active) continue;
      if (l.fresh) {
        // first fill: nothing before initialAt, the initial share then, rising linearly to full at fullAt
        const { initialShare, initialAt, fullAt } = l.fresh;
        const initial = Math.max(1, Math.round(l.cap * initialShare));
        const want =
          t < initialAt
            ? 0
            : t >= fullAt
              ? l.cap
              : Math.round(initial + ((l.cap - initial) * (t - initialAt)) / Math.max(1, fullAt - initialAt));
        for (let k = l.units.length; k < Math.min(want, l.cap); k++) l.units.push(newUnit(l));
        if (t >= fullAt) {
          l.fresh = null;
          l.lastRefill = t;
        }
        continue;
      }
      if (l.units.length === 0) {
        if (l.wipedAt === null) l.wipedAt = t;
        else if (t - l.wipedAt >= fromMod.fullWipeRefillCooldown) {
          const n = Math.max(1, Math.round(l.cap * assumed.fullWipeRespawnShare));
          for (let k = 0; k < n; k++) l.units.push(newUnit(l));
          l.wipedAt = null;
          l.lastRefill = t;
          counters.respawned += n;
        }
      } else if (l.units.length < l.cap && t - l.lastRefill >= fromMod.partialWipeRefillCooldown) {
        l.units.push(newUnit(l));
        l.lastRefill = t;
        counters.refilled++;
      } else if (l.units.length >= l.cap) {
        l.lastRefill = t;
      }
    }

    // 5. extinction
    // Victims are picked uniformly from every living unit, in lairs and in squads on the move. The game's rule is
    // unknown (assumed): see "Culling" in README.md.
    let n = alive();
    if (n > fromMod.triggerExtinction) {
      const pool: Array<[Unit[], string]> = [
        ...lairs.filter((l) => l.units.length).map((l): [Unit[], string] => [l.units, l.group]),
        ...squads.map((q): [Unit[], string] => [q.units, world.group(q.faction)]),
      ];
      while (n > fromMod.stopExtinction) {
        let r = Math.floor(rand() * n);
        const hit = pool.find(([us]) => (r -= us.length) < 0)!;
        hit[0].splice(Math.floor(rand() * hit[0].length), 1);
        kill(hit[1], 1);
        counters.culled++;
        n--;
      }
    }

    if (t >= nextSnap) {
      timeline.push({
        gameDay: +((t * assumed.gameTimeScale) / 86400).toFixed(2),
        alive: alive(),
        squadsOut: squads.length,
        captures: counters.captures,
        battles: counters.battles,
      });
      nextSnap += snapEvery;
    }
  }

  return {
    realSeconds,
    start,
    end: snapshotLairs(lairs),
    counters,
    deathsByGroup,
    events,
    timeline,
    lairs,
    world,
  };

  function snapshotLairs(ls: Lair[]) {
    return ls.map((l) => ({
      id: l.id,
      owner: l.owner,
      group: l.group,
      cap: l.cap,
      pop: l.units.length,
      region: l.region,
      s: speciesTier(l.group, world.isMutant(l.owner)),
    }));
  }
}

export type Result = ReturnType<typeof simulate>;
