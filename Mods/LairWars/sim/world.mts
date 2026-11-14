import fs from "node:fs";
import path from "node:path";
import { Struct, type SpawnActorPrototype } from "s2cfgtojson";
import { baseCfgDir } from "../../../src/base-paths.mts";
import { readFileAndGetStructs } from "../../../src/read-file-and-get-structs.mts";
import { lairs as tieredLairs, RANKS } from "../lairTiers.mts";
import { hubLairs, lairActorFiles } from "../hubLairs.mts";
import { regionTier } from "../regionTiers.mts";
import { mutantLairs } from "../mutantLairs.mts";
import { EXPANDING_FACTIONS } from "../openLairs.mts";

/**
 * The world the simulation runs on, read from the same modules and generated cfg the mod builds from, so it always
 * matches the current LairWars build:
 * - vanilla lairs with tiers (lairTiers.mts `lairs`: no guards, resting lairs or quest-spawned lairs), their
 *   starting owner (`InitialInhabitantFaction` of the spawn actor) and whether they start active;
 * - the new wild lairs (mutantLairs.json);
 * - lair sizes per prototype, faction and player rank from the built GenericLairPrototypes patch (raw/), falling back
 *   to vanilla where the patch doesn't set a value;
 * - faction hierarchy and lair attack rules (AttackLairRestrictions) from vanilla RelationPrototypes.cfg.
 *
 * Positions are in metres (UE units / 100), like the Living Zone Tracker.
 */

export type WorldLair = {
  id: string;
  x: number;
  y: number;
  /**
   * Starting population (recorded worlds). When absent the lair starts empty and fills by its prototype's spawn
   * timing, like a fresh game (see `startTiming`).
   */
  pop?: number;
  /** Region tier 1-4 (regionTiers.mts). */
  region: number;
  prototype: string;
  owner: string;
  capturable: boolean;
  active: boolean;
  wild: boolean;
};

const PATCH = new URL(
  "../raw/Stalker2/Content/GameLite/GameData/LairPrototypes/GenericLairPrototypes/GenericLairPrototypes_patch_LairWars.cfg",
  import.meta.url,
);

/** Spawn actors of every world-map lair, by SID (for the starting owner and ActiveLair). */
async function lairActorsBySID() {
  const out: Record<string, SpawnActorPrototype> = {};
  for (const file of lairActorFiles) {
    for (const s of await readFileAndGetStructs<SpawnActorPrototype>(
      path.relative(path.join(baseCfgDir, "GameData"), file),
    )) {
      if (s.SpawnType === "ESpawnType::LairSpawner") out[s.__internal__.rawName] = s;
    }
  }
  return out;
}

export async function loadWorld() {
  const actors = await lairActorsBySID();
  const lairs: WorldLair[] = [];
  for (const l of tieredLairs) {
    const actor = actors[l.sid];
    const owner = String(actor?.InitialInhabitantFaction ?? l.lairPrototypeSID);
    lairs.push({
      id: l.sid,
      x: l.position.X / 100,
      y: l.position.Y / 100,
      region: hubLairs.has(l.sid) ? 1 : regionTier(l.position.X, l.position.Y),
      prototype: l.lairPrototypeSID,
      owner,
      capturable: !hubLairs.has(l.sid),
      active: String(actor?.ActiveLair) !== "false" || l.enabledByMod,
      wild: false,
    });
  }
  for (const m of mutantLairs) {
    lairs.push({
      id: m.seed,
      x: m.x / 100,
      y: m.y / 100,
      region: regionTier(m.x, m.y),
      prototype: m.owner,
      owner: m.faction,
      capturable: true,
      active: true,
      wild: true,
    });
  }

  const sizes = await loadSizes();
  const relations = await loadRelations();
  return {
    lairs,
    capacity: sizes.capacity,
    startTiming: sizes.startTiming as typeof sizes.startTiming | undefined,
    missingSizes: sizes.missing,
    ...relations,
    expanding: new Set(EXPANDING_FACTIONS),
    /** Rule values that differ from the current build (a recorded world from an older build). */
    overrides: {} as Record<string, number>,
  };
}

/** MaxSpawnQuantity of `faction` in lair prototype `sid` at rank tier `tier` (0-3), as the built mod sets it. */
async function loadSizes() {
  const patch = Object.fromEntries(
    Struct.fromString(fs.readFileSync(PATCH, "utf8")).map((s) => [s.__internal__.rawName, s]),
  );
  const vanilla = Object.fromEntries(
    (await readFileAndGetStructs<Struct>("LairPrototypes/GenericLairPrototypes.cfg")).map((s) => [
      s.__internal__.rawName,
      s,
    ]),
  );
  const factionBlock = (proto: Struct | undefined, faction: string) => {
    const factions = proto?.Preset?.PossibleInhabitantFactions as Struct | undefined;
    if (!factions) return undefined;
    if (factions[faction] instanceof Struct) return factions[faction] as Struct;
    return factions
      .entries()
      .find(([, f]) => f instanceof Struct && String(f.Faction) === faction)?.[1] as
      | Struct
      | undefined;
  };
  const read = (proto: Struct | undefined, faction: string, rank: string, field = "MaxSpawnQuantity") => {
    const n = factionBlock(proto, faction)?.SpawnSettingsPerPlayerRanks?.[rank]?.[field];
    return n === undefined ? undefined : Number(n);
  };
  /** A rank field of a faction block: patch -> refkey chain in the patch -> vanilla prototype of the same name. */
  const lookup = (sid: string, faction: string, rank: string, field: string) => {
    let n: number | undefined;
    let seen = 0;
    for (
      let s: string | undefined = sid;
      s && n === undefined && seen++ < 8;
      s = patch[s]?.__internal__.refkey as string | undefined
    ) {
      n = read(patch[s], faction, rank, field) ?? read(vanilla[s], faction, rank, field);
    }
    return n;
  };
  const missing = new Set<string>();
  const cache = new Map<string, number>();
  /** 0 when the lair prototype has no block for the faction (it can't move in). */
  const capacity = (sid: string, faction: string, tier: number): number => {
    const key = `${sid}|${faction}|${tier}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let n = lookup(sid, faction, RANKS[tier], "MaxSpawnQuantity");
    if (n === undefined) {
      missing.add(`${sid}/${faction}`);
      n = 0; // the lair has no block for this faction: it can't live there
    }
    cache.set(key, n);
    return n;
  };
  /**
   * How an empty lair first fills (vanilla values as defaults): InitialSpawnQuantityPercent of its size after
   * InitialSpawnQuantityRespawnTimeSeconds, full after MaxSpawnQuantityRespawnTimeSeconds.
   */
  const startTiming = (sid: string, faction: string, tier: number) => {
    const rank = RANKS[tier];
    return {
      initialShare: lookup(sid, faction, rank, "InitialSpawnQuantityPercent") ?? 0.5,
      initialAt: lookup(sid, faction, rank, "InitialSpawnQuantityRespawnTimeSeconds") ?? 180,
      fullAt: lookup(sid, faction, rank, "MaxSpawnQuantityRespawnTimeSeconds") ?? 480,
    };
  };
  return { capacity, startTiming, missing };
}

/** Faction parents and AttackLairRestrictions from vanilla RelationPrototypes.cfg. */
export async function loadRelations() {
  const [def] = (await readFileAndGetStructs<Struct>("RelationPrototypes.cfg")).filter(
    (s) => s.SID === "Default",
  );
  const parent: Record<string, string> = {};
  for (const [k, v] of (def.Factions as Struct).entries()) parent[k] = String(v ?? "").trim();
  const byLower = Object.fromEntries(Object.keys(parent).map((k) => [k.toLowerCase(), k]));
  /** The relations' spelling of a faction id (recordings say BlindDog, the cfg Blinddog). */
  const canon = (f: string) => byLower[f.toLowerCase()] ?? f;
  const attack = new Set<string>();
  const named = new Set<string>();
  for (const [k, v] of (def.ExpansionPolicies?.AttackLairRestrictions as Struct).entries()) {
    const [a, d] = k.split("->");
    named.add(a).add(d);
    if (String(v) === "true") attack.add(`${a}->${d}`);
  }
  const ancestors = (f: string) => {
    const out: string[] = [];
    for (let x: string | undefined = f; x && out.length < 10; x = parent[x]) out.push(x);
    return out;
  };
  /** Name the restriction table uses for a faction: itself or its nearest ancestor that the table names. */
  const policyName = (f: string) => ancestors(f).find((x) => named.has(x)) ?? f;
  /** May a squad of `a` move into a lair `d` holds (a fight)? Same faction never. */
  const mayAttack = (a: string, d: string) =>
    a !== d && attack.has(`${policyName(a)}->${policyName(d)}`);
  const ROOTS = new Set(["", "Humanoid", "FreeStalkers", "Army", "Mutant"]);
  /** Faction group shown to the player (as the tracker does): climb until the parent is a root. */
  const group = (f: string) => {
    let x = f;
    while (parent[x] !== undefined && !ROOTS.has(parent[x])) x = parent[x];
    return x;
  };
  const isMutant = (f: string) => ancestors(f).includes("Mutant");
  return { mayAttack, group, isMutant, canon };
}

export type World = Awaited<ReturnType<typeof loadWorld>>;
