import fs from "node:fs";
import path from "node:path";
import type {
  GenericLairPrototype,
  ItemGeneratorPrototype,
  ObjPrototype,
  SpawnActorPrototype,
} from "s2cfgtojson";
import { Struct } from "s2cfgtojson";
import { baseCfgDir } from "../../src/base-paths.mts";
import { getCfgFiles, getDlcCfgFiles } from "../../src/get-cfg-files.mts";
import { readFileAndGetStructs } from "../../src/read-file-and-get-structs.mts";

/**
 * Lair tiers, one per player rank, all inside the vanilla lair prototypes: the game spawns from the
 * `SpawnSettingsPerPlayerRanks` block of the player's rank, and DecoupledRanks sets that rank from the level
 * (Newbie 1-9, Experienced 10-19, Veteran 20-29, Master 30). Each rank block gets the tier of its rank's first
 * level: a spread of enemy ranks (vanilla per-rank archetypes and gear) with HP scaled by that level.
 * No copies, no quests: until 2026-11-01 six tiers were stacked lair copies switched by ~8,000 quest nodes.
 * See DesignDocs/LairTiers.md.
 */
export const RANKS = ["Newbie", "Experienced", "Veteran", "Master"] as const;
export type RankName = (typeof RANKS)[number];
/** Tier n is the block of RANKS[n]. */
export const TIER_COUNT = RANKS.length;
export const TIERS = Array.from({ length: TIER_COUNT }, (_, n) => n);
/** DecoupledRanks level at which the player reaches each rank (its `XSwitchPlayerRank` thresholds). */
const RANK_START_LEVELS = [1, 10, 20, 30];

/** First DecoupledRanks level of a tier. */
export const tierStartLevel = (tier: number) => RANK_START_LEVELS[tier];

/** Scaling follows the tier's first level: 0 at level 1, 1 at 10, 2.1 at 20, 3.2 at 30. */
const tierProgress = (tier: number) => (tierStartLevel(tier) - 1) / 9;

/** Human HP (and weak mutants' HP): 1x as Newbie, 2x Experienced, 3.1x Veteran, 4.2x Master. */
export const tierMultiplier = (tier: number) => 1 + tierProgress(tier);

/**
 * Mutants scale by rank through their attack cooldowns, divided by this (a Master attacks twice as often).
 * Movement speed is not scaled: on-screen NPC movement follows the locomotion animation, so faster
 * MovementParams (and MovementSpeedCoef) only sped up off-screen movement and the NPC appeared to
 * teleport closer whenever the player looked away (2026-10-23 test). No cfg field sets animation speed.
 */
export const MUTANT_COOLDOWN_DIVISOR_BY_RANK: Record<RankName, number> = {
  Newbie: 1,
  Experienced: 4 / 3,
  Veteran: 5 / 3,
  Master: 2,
};
/** Mutants below this vanilla MaxHP also get the tier HP multiplier. */
export const WEAK_MUTANT_MAX_HP = 200;

/**
 * Share of each enemy rank in a tier: a Gaussian around rank index (first level - 1) / 9 (sigma 1), so
 * Master shows up from level 1 (0.6%) and takes over late (about half from level 26).
 */
export function rankShares(tier: number): number[] {
  const centre = tierProgress(tier);
  const raw = RANKS.map((_, r) => Math.exp(-((r - centre) ** 2) / 2));
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / total);
}

const dominantRank = (tier: number): RankName => {
  const shares = rankShares(tier);
  return RANKS[shares.indexOf(Math.max(...shares))];
};

export const rankItemGeneratorSID = (generatorSID: string, rank: RankName) =>
  `${generatorSID}_LT${rank}`;

const rel = (fullPath: string) => path.relative(path.join(baseCfgDir, "GameData"), fullPath);

// ---------------------------------------------------------------------------------------------
// Lairs some quest (base game or DLC) switches on and off: the mod leaves their ActiveLair alone.

const toggledLairsIn = (text: string) =>
  text
    .split(/\n(?=\S+\s*:\s*struct\.begin)/)
    .filter((node) => node.includes("EQuestNodeType::ToggleLairActivity"))
    .map((node) => node.match(/TargetQuestGuid\s*=\s*(\w+)/)?.[1])
    .filter(Boolean) as string[];
const questToggledLairs = new Set<string>();
for (const file of [
  ...(await getCfgFiles("/QuestNodePrototypes/", true)).filter((f) => f.includes("/GameData/QuestNodePrototypes/")),
  ...(await getDlcCfgFiles("/QuestNodePrototypes.cfg")),
]) {
  const text = fs.readFileSync(file, "utf8");
  if (text.includes("EQuestNodeType::ToggleLairActivity")) toggledLairsIn(text).forEach((guid) => questToggledLairs.add(guid));
}

// ---------------------------------------------------------------------------------------------
// Lair prototypes and the archetypes they spawn.

export const vanillaLairPrototypes: Record<string, GenericLairPrototype> = Object.fromEntries(
  (await readFileAndGetStructs<GenericLairPrototype>("LairPrototypes/GenericLairPrototypes.cfg")).map(
    (s) => [s.__internal__.rawName, s],
  ),
);

/**
 * Spawn-pool additions for specific lairs. The listed lairs use a variant of their lair prototype,
 * `<prototype>_<name>`: a new prototype that inherits the vanilla one (`refkey`) and restates only the tiered
 * archetype lists of `faction`, with `archetype` added at the weight `weightOf` has there.
 */
const LAIR_POOL_ADDITIONS = [
  {
    name: "ZatonMoldy",
    prototype: "Blinddog",
    faction: "Blinddog",
    archetype: "MoldyBlinddog",
    weightOf: "Blinddog",
    // The two Blinddog lairs in Zaton (nearest MarkerPrototypes region marker: zaton, near Sultansk).
    lairs: ["29834FB5486FBE264ED8B5926C5F5AD4", "B3831AC34577433791000F81FC7635FA"],
  },
];
/** Lair SID -> the variant lair prototype it uses instead of its own. */
const lairPrototypeOverride: Record<string, string> = {};
/** Variant lair prototype SID -> its addition. */
const variants: Record<string, (typeof LAIR_POOL_ADDITIONS)[number]> = {};
for (const add of LAIR_POOL_ADDITIONS) {
  const sid = `${add.prototype}_${add.name}`;
  variants[sid] = add;
  add.lairs.forEach((lair) => (lairPrototypeOverride[lair] = sid));
}
/** The vanilla prototype a lair prototype SID stands for (a variant's base, else itself). */
const vanillaOf = (sid: string) => vanillaLairPrototypes[variants[sid]?.prototype ?? sid];

type Archetypes = Array<[string, { MinQuantityPerArchetype?: number; SpawnWeight?: number }]>;
/** A faction's vanilla archetype list per player-rank block. */
type RankArchetypes = Partial<Record<RankName, Archetypes>>;

function archetypesOf(block: Struct | undefined): Archetypes {
  const result: Archetypes = [];
  (block as any)?.SpawnSettingsPerArchetypes?.forEach(([key, value]) => {
    if (value instanceof Struct) result.push([String(key), value]);
  });
  return result;
}

/** Per faction key, its archetype lists per rank; a variant's addition joins its faction's lists. */
function factionArchetypes(sid: string) {
  const add = variants[sid];
  const result: Record<string, RankArchetypes> = {};
  vanillaOf(sid)?.Preset?.PossibleInhabitantFactions?.forEach(([factionKey, faction]) => {
    const ranks: RankArchetypes = {};
    faction?.SpawnSettingsPerPlayerRanks?.forEach(([rank, block]) => {
      if (!RANKS.includes(rank as RankName) || !(block instanceof Struct)) return;
      const archetypes = archetypesOf(block);
      const like = add?.faction === factionKey && archetypes.find(([key]) => key === add.weightOf);
      if (like) archetypes.push([add.archetype, { MinQuantityPerArchetype: 0, SpawnWeight: like[1].SpawnWeight }]);
      ranks[rank as RankName] = archetypes;
    });
    result[String(factionKey)] = ranks;
  });
  return result;
}

const spawnsArchetypes = (sid: string) =>
  Object.values(factionArchetypes(sid)).some((ranks) => Object.values(ranks).some((list) => list!.length > 0));

// ---------------------------------------------------------------------------------------------
// Enemy prototypes (archetypes) and their item generators.

const objPrototypeFiles = (await getCfgFiles("/ObjPrototypes", true)).filter(
  (f) => f.includes("/GameData/ObjPrototypes/") || f.endsWith("/GameData/ObjPrototypes.cfg"),
);
type ObjEntry = { file: string; struct: ObjPrototype };
const objByFileAndKey: Record<string, Record<string, ObjPrototype>> = {};
const objsByFile: Record<string, ObjPrototype[]> = {};
const objByKey: Record<string, ObjEntry> = {};
for (const file of objPrototypeFiles) {
  const structs = await readFileAndGetStructs<ObjPrototype>(rel(file));
  objByFileAndKey[file] = Object.fromEntries(structs.map((s) => [s.__internal__.rawName, s]));
  objsByFile[file] = structs;
  if (!file.includes("/GameData/ObjPrototypes/")) continue;
  structs.forEach((s) => (objByKey[s.__internal__.rawName] = { file, struct: s }));
}

/**
 * A refkey names a struct in the file; `[n]` with no struct of that name is the n-th top-level struct
 * (`Poltergeist_Toxic {refkey=[1]}` inherits Poltergeist_Electro, `PseudoDog {refkey=[0]}` PseudoDogBase).
 */
function resolveRefkey(file: string, refkey: string) {
  const named = objByFileAndKey[file]?.[refkey];
  if (named) return named;
  const index = refkey.match(/^\[(\d+)\]$/)?.[1];
  return index === undefined ? undefined : objsByFile[file]?.[Number(index)];
}

/** Walks refkey/refurl from an archetype to its ancestors (archetype first). */
function objChain(key: string): ObjPrototype[] {
  const chain: ObjPrototype[] = [];
  let file = objByKey[key]?.file;
  let current = objByKey[key]?.struct;
  while (current && chain.length < 10) {
    chain.push(current);
    const { refurl, refkey } = current.__internal__;
    if (refkey === undefined) break;
    if (refurl) file = path.resolve(path.dirname(file), refurl);
    current = resolveRefkey(file, String(refkey));
  }
  return chain;
}

export function resolveObjField<T>(key: string, read: (s: ObjPrototype) => T | undefined): T | undefined {
  for (const s of objChain(key)) {
    const value = read(s);
    if (value !== undefined) return value;
  }
}

/** Keys of a nested struct merged along the inheritance chain (children override by key). */
function resolveObjKeys(key: string, read: (s: ObjPrototype) => Struct | undefined) {
  const keys = new Set<string>();
  objChain(key).forEach((s) => read(s)?.forEach(([k]) => keys.add(String(k))));
  return [...keys];
}

const num = (value: unknown) => parseFloat(String(value ?? ""));

/** Everything that is not a GeneralNPC (humans and zombies) is a mutant here. */
export const isMutant = (archetype: string) => !objByKey[archetype].file.endsWith("/GeneralNPCObjPrototypes.cfg");
export const isZombie = (archetype: string) => String(resolveObjField(archetype, (s) => s.IsZombie)) === "true";
const isWeakMutant = (archetype: string) =>
  num(resolveObjField(archetype, (s) => s.VitalParams?.MaxHP)) < WEAK_MUTANT_MAX_HP;

// ---------------------------------------------------------------------------------------------
// Mutant abilities: attack cooldowns live in AbilityPrototypes (`TriggeredCooldowns[*].Duration`).

type AbilityEntry = { file: string; struct: Struct & Record<string, any> };
const abilitiesBySID: Record<string, AbilityEntry> = {};
const abilitiesByFileAndKey: Record<string, Record<string, AbilityEntry["struct"]>> = {};
for (const file of (await getCfgFiles("/AbilityPrototypes/", true)).filter((f) =>
  f.includes("/GameData/AbilityPrototypes/"),
)) {
  const structs = await readFileAndGetStructs<AbilityEntry["struct"]>(rel(file));
  abilitiesByFileAndKey[file] = Object.fromEntries(structs.map((s) => [s.__internal__.rawName, s]));
  structs.forEach((s) => (abilitiesBySID[String(s.SID ?? s.__internal__.rawName)] = { file, struct: s }));
}

/** Ability and its same-file ancestors (refurl leads to the AbilityPrototypes.cfg base, which holds no cooldowns). */
function abilityChain(sid: string) {
  const entry = abilitiesBySID[sid];
  const chain: AbilityEntry["struct"][] = [];
  let current = entry?.struct;
  while (current && chain.length < 10) {
    chain.push(current);
    const { refurl, refkey } = current.__internal__;
    if (refkey === undefined || refurl) break;
    current = abilitiesByFileAndKey[entry.file][String(refkey)];
  }
  return chain;
}

const ABILITY_COOLDOWN_FIELDS = ["MinCooldown", "MaxCooldown", "CooldownMin", "CooldownMax"] as const;

/** Combat abilities get shorter cooldowns; roars, berserk toggles and behaviour helpers keep theirs. */
const COMBAT_ABILITY_TYPES = new Set([
  "Attack",
  "AoEAttack",
  "AOEAttackPassive",
  "Charge",
  "LongJump",
  "PSYStrike",
  "Throw",
  "ThrowQueue",
  "Summon",
  "Shield",
  "BlinkTeleport",
  "ActivateAnomaly",
]);

/**
 * Cooldowns that keep vanilla timings. Without `tag` the whole ability stays vanilla; with one, only that
 * TriggeredCooldowns entry does (the rest of the ability still scales).
 */
const VANILLA_COOLDOWNS: Array<{ ability: RegExp; tag?: string }> = [
  // Poltergeists (all variants): passive area damage, anomaly activation, throw. Their Shield scales.
  { ability: /^Poltergeist_(\w*AOEPassiveAttack|Activate\w*Anomaly|Throw)$/ },
  { ability: /^Cat_BlinkTeleport$/ },
  // Growl is set by the cat's attacks; the Chimera's Growl still scales.
  { ability: /^Cat_/, tag: "Ability.Cooldown.Growl" },
  // The grenade volley (Burer_ThrowQueue_Grenades) and the Shield still scale.
  { ability: /^Burer_Throw$/ },
  // Roar is set by the bloodsuckers' attacks (MistBloodsucker included).
  { ability: /^(Mist)?Bloodsucker_/, tag: "Ability.Cooldown.Roar" },
];

const keepsVanilla = (sid: string, tag?: string) =>
  VANILLA_COOLDOWNS.some((rule) => rule.ability.test(sid) && (rule.tag === undefined || rule.tag === tag));

/** Resolved cooldowns of a combat ability, or undefined when it has none to scale. */
export function abilityCooldowns(sid: string) {
  if (keepsVanilla(sid)) return undefined;
  const chain = abilityChain(sid);
  const type = String(chain.find((s) => s.AbilityType !== undefined)?.AbilityType ?? "").replace("EAbility::", "");
  if (!COMBAT_ABILITY_TYPES.has(type)) return undefined;
  const triggered = chain.find((s) => s.TriggeredCooldowns instanceof Struct)?.TriggeredCooldowns as Struct | undefined;
  const entries: Array<{ tag: string; duration: number; vanilla: boolean }> = [];
  triggered?.forEach(([, e]: [string, any]) => {
    const tag = String(e.CooldownTag);
    entries.push({ tag, duration: num(e.Duration), vanilla: keepsVanilla(sid, tag) });
  });
  const fields: Partial<Record<(typeof ABILITY_COOLDOWN_FIELDS)[number], number>> = {};
  ABILITY_COOLDOWN_FIELDS.forEach((field) => {
    const value = chain.find((s) => s[field] !== undefined)?.[field];
    if (value !== undefined && !isNaN(num(value))) fields[field] = num(value);
  });
  if (!entries.some((e) => e.duration > 0 && !e.vanilla) && !Object.keys(fields).length) return undefined;
  return { entries, fields };
}

export const abilityRankSID = (abilitySID: string, rank: RankName) => `${abilitySID}_LT${rank}`;
/** Ability clones to emit: clone SID -> source ability + rank. */
export const abilityClones: Record<string, { ability: string; rank: RankName; file: string }> = {};

/** A mutant's abilities (key -> ability SID), merged along its inheritance chain. */
function mutantAbilities(archetype: string) {
  const abilities: Record<string, string> = {};
  [...objChain(archetype)].reverse().forEach((s) =>
    (s as any).Abilities?.forEach(([key, value]) => {
      if (value?.SID) abilities[String(key)] = String(value.SID);
    }),
  );
  return abilities;
}

/** Registers rank clones of a mutant's cooldown abilities; returns key -> clone SID for those only. */
function rankAbilities(archetype: string, rank: RankName) {
  const result: Record<string, string> = {};
  Object.entries(mutantAbilities(archetype)).forEach(([key, sid]) => {
    if (!abilityCooldowns(sid)) return;
    const clone = abilityRankSID(sid, rank);
    abilityClones[clone] ??= { ability: sid, rank, file: abilitiesBySID[sid].file };
    result[key] = clone;
  });
  return result;
}

/**
 * `<Ability>_LT<Rank>`: inherits the ability, cooldowns divided by the rank's speed. Only the TriggeredCooldowns
 * entries that change are restated, by index (`[0]`, `[1]`, ...), the way vanilla children override array entries.
 */
export function buildAbilityClone(cloneSID: string) {
  const { ability, rank } = abilityClones[cloneSID];
  const factor = 1 / MUTANT_COOLDOWN_DIVISOR_BY_RANK[rank];
  const { entries, fields } = abilityCooldowns(ability)!;
  const source = abilitiesBySID[ability].struct;
  const clone = new Struct() as AbilityEntry["struct"];
  clone.__internal__.rawName = cloneSID;
  clone.__internal__.isRoot = true;
  clone.__internal__.refkey = source.__internal__.rawName;
  clone.SID = cloneSID;
  // Merges with the inherited list by index, so only the entries that change are restated.
  const triggered = new Struct();
  entries.forEach(({ duration, vanilla }, index) => {
    if (!vanilla && duration > 0) triggered.addNode(new Struct({ Duration: round(duration * factor) }), index);
  });
  if (triggered.entries().length) clone.TriggeredCooldowns = triggered;
  Object.entries(fields).forEach(([field, value]) => (clone[field] = round(value * factor)));
  return clone;
}

export const abilityClonesByAbility: Record<string, string[]> = {};

const itemGenerators: Record<string, { file: string; struct: ItemGeneratorPrototype }> = {};
for (const file of (await getCfgFiles("ItemGeneratorPrototypes", true)).filter((f) =>
  f.includes("/GameData/ItemGeneratorPrototypes"),
)) {
  (await readFileAndGetStructs<ItemGeneratorPrototype>(rel(file))).forEach(
    (s) => (itemGenerators[s.__internal__.rawName] = { file, struct: s }),
  );
}

const subGeneratorsOf = (generator: ItemGeneratorPrototype) => {
  const subs: string[] = [];
  generator.ItemGenerator?.forEach(([, entry]) =>
    entry?.PossibleItems?.forEach(([, item]) => {
      if (item?.ItemGeneratorPrototypeSID) subs.push(item.ItemGeneratorPrototypeSID);
    }),
  );
  return subs;
};

const hasRankEntries = (generator: ItemGeneratorPrototype) => {
  let any = false;
  generator.ItemGenerator?.forEach(([, entry]) => (any ||= !!entry?.PlayerRank));
  return any;
};

const needsRankCloneMemo: Record<string, boolean> = {};
/** A generator needs per-rank clones when it, or a sub-generator it rolls, is keyed by player rank. */
function needsRankClone(generatorSID: string, seen = new Set<string>()): boolean {
  if (generatorSID in needsRankCloneMemo) return needsRankCloneMemo[generatorSID];
  const generator = itemGenerators[generatorSID]?.struct;
  if (!generator || seen.has(generatorSID)) return false;
  seen.add(generatorSID);
  const result =
    hasRankEntries(generator) || subGeneratorsOf(generator).some((sub) => needsRankClone(sub, seen));
  needsRankCloneMemo[generatorSID] = result;
  return result;
}

// ---------------------------------------------------------------------------------------------
// Tier lair prototypes: the archetype mix every player-rank block of a tier gets.

type ArchetypeSettings = { MinQuantityPerArchetype: number; SpawnWeight: number };

/** ObjPrototype clones to emit: key -> what to emit. */
export const enemyClones: Record<
  string,
  { archetype: string; rank?: RankName; tier: number; file: string; mutant: boolean }
> = {};
/** Generators that need a clone per rank, by SID. */
export const rankedGenerators = new Set<string>();

function archetypeGenerator(archetype: string) {
  const generator = resolveObjField(archetype, (s) => s.ItemGeneratorPrototypeSID);
  return generator && generator !== "empty" && needsRankClone(generator) ? generator : undefined;
}

function collectRankedGenerators(generatorSID: string) {
  if (rankedGenerators.has(generatorSID) || !needsRankClone(generatorSID)) return;
  rankedGenerators.add(generatorSID);
  subGeneratorsOf(itemGenerators[generatorSID].struct).forEach(collectRankedGenerators);
}

/**
 * The enemy a tier lair spawns for a vanilla archetype of a given rank.
 * Humans: rank gear, HP by tier. Mutants: speed and cooldowns by rank; weak ones also HP by tier.
 */
function enemyFor(archetype: string, rank: RankName, tier: number) {
  // Guards never scale, wherever a lair lists them.
  if (archetype.startsWith("GuardNPC_")) return archetype;
  const file = objByKey[archetype].file;
  if (isMutant(archetype)) {
    const byTier = isWeakMutant(archetype);
    const key = byTier ? `${archetype}_LT${rank}T${tier}` : `${archetype}_LT${rank}`;
    if (!enemyClones[key]) {
      rankAbilities(archetype, rank);
      enemyClones[key] = { archetype, rank, tier: byTier ? tier : 0, file, mutant: true };
    }
    return key;
  }
  const generator = archetypeGenerator(archetype);
  const ranked = !!generator;
  if (!ranked && tier === 0) return archetype;
  const key = ranked ? `${archetype}_LT${rank}T${tier}` : `${archetype}_LT${tier}`;
  if (generator) collectRankedGenerators(generator);
  enemyClones[key] ??= { archetype, rank: ranked ? rank : undefined, tier, file, mutant: false };
  return key;
}

const round = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Vanilla turns some archetypes off with `SpawnWeight = 0` (Bandit Heavy at every rank, Monolith
 * Sniper at Newbie, ...). They spawn here at the weight of the rarest enabled archetype in the block
 * (1 when the whole block is zero).
 */
function effectiveWeights(archetypes: ReturnType<typeof archetypesOf>) {
  const weights = archetypes.map(([, s]) => Number(s.SpawnWeight ?? 0));
  const rarest = Math.min(...weights.filter((w) => w > 0));
  return weights.map((w) => (w > 0 ? w : Number.isFinite(rarest) ? rarest : 1));
}

/**
 * Archetype mix for one faction of a tier lair. Each enemy rank R contributes the archetypes of the
 * vanilla block R at `SpawnWeight / blockTotal x share(R)`. Minimum quantities come from the
 * player-rank block being filled, carried over to the tier's dominant rank.
 */
export function tierArchetypeMix(ranks: RankArchetypes, own: Archetypes, tier: number) {
  const shares = rankShares(tier);
  const usable = RANKS.map((rank, r) => {
    const archetypes = ranks[rank] ?? [];
    const weights = effectiveWeights(archetypes);
    const total = weights.reduce((sum, w) => sum + w, 0);
    return { rank, share: total > 0 ? shares[r] : 0, archetypes, weights, total };
  });
  const shareTotal = usable.reduce((sum, u) => sum + u.share, 0);
  const mix: Record<string, ArchetypeSettings> = {};
  usable.forEach(({ rank, share, archetypes, weights, total }) => {
    if (!share) return;
    archetypes.forEach(([archetype], i) => {
      const weight = (weights[i] / total) * (share / shareTotal);
      if (!weight) return;
      const key = enemyFor(archetype, rank, tier);
      mix[key] ??= { MinQuantityPerArchetype: 0, SpawnWeight: 0 };
      mix[key].SpawnWeight = round(mix[key].SpawnWeight + weight);
    });
  });
  const dominant = dominantRank(tier);
  own.forEach(([archetype, s]) => {
    const min = Number(s.MinQuantityPerArchetype ?? 0);
    if (!min) return;
    const key = enemyFor(archetype, dominant, tier);
    mix[key] ??= { MinQuantityPerArchetype: 0, SpawnWeight: 0 };
    mix[key].MinQuantityPerArchetype = Math.max(mix[key].MinQuantityPerArchetype, min);
  });
  return mix;
}

/** The tier mixes of a lair prototype: per faction key and player rank, the new `SpawnSettingsPerArchetypes`. */
function tierArchetypeLists(sid: string) {
  const result: Record<string, Partial<Record<RankName, Struct>>> = {};
  Object.entries(factionArchetypes(sid)).forEach(([factionKey, ranks]) => {
    result[factionKey] = {};
    Object.entries(ranks).forEach(([rank, own]) => {
      const archetypes = new Struct();
      Object.entries(tierArchetypeMix(ranks, own!, RANKS.indexOf(rank as RankName))).forEach(([key, settings]) =>
        archetypes.addNode(new Struct(settings), key),
      );
      result[factionKey][rank as RankName] = archetypes;
    });
  });
  return result;
}

// ---------------------------------------------------------------------------------------------
// Lairs on the world map.

export type Lair = {
  sid: string;
  file: string;
  lairPrototypeSID: string;
  /** Off in vanilla and no quest switches it on: the mod switches it on. */
  enabledByMod: boolean;
  /** World position (UE units). */
  position: { X: number; Y: number; Z: number };
};

const spawnActorFiles = (await getCfgFiles("/SpawnActorPrototypes/WorldMap_WP/", true)).filter((f) =>
  f.includes("/GameData/SpawnActorPrototypes/WorldMap_WP/"),
);
/** World-map lairs with tiers (not guards, not resting lairs, not quest-spawned). */
export const lairs: Lair[] = [];
for (const file of spawnActorFiles) {
  if (!fs.readFileSync(file, "utf8").includes("ESpawnType::LairSpawner")) continue;
  for (const s of await readFileAndGetStructs<SpawnActorPrototype>(rel(file))) {
    if (s.SpawnType !== "ESpawnType::LairSpawner") continue;
    const sid = s.__internal__.rawName;
    // Guard lairs (hub guards) are left exactly as vanilla has them.
    if (String(s.LairPrototypeSID).startsWith("Guard")) continue;
    const lairPrototypeSID = lairPrototypeOverride[sid] ?? s.LairPrototypeSID;
    if (!vanillaOf(lairPrototypeSID) || !spawnsArchetypes(lairPrototypeSID)) continue;
    // Spawned by quest nodes on demand.
    if (String(s.SpawnOnStart) === "false") continue;
    lairs.push({
      sid,
      file,
      lairPrototypeSID,
      // A quest decides when a quest-toggled lair starts; the rest of the vanilla-off lairs are switched on.
      enabledByMod: String(s.ActiveLair) === "false" && !questToggledLairs.has(sid),
      position: { X: Number(s.PositionX), Y: Number(s.PositionY), Z: Number(s.PositionZ) },
    });
  }
}
export const lairsBySID = Object.fromEntries(lairs.map((l) => [l.sid, l]));

/**
 * Tier mixes by lair prototype SID, built once so enemyClones/rankedGenerators are complete up front: every
 * vanilla prototype that spawns archetypes (guards excepted, as everywhere) and the spawn-pool variants.
 */
export const tierArchetypes: Record<string, ReturnType<typeof tierArchetypeLists>> = {};
for (const sid of [...Object.keys(vanillaLairPrototypes), ...Object.keys(variants)]) {
  if (!sid.startsWith("Guard") && spawnsArchetypes(sid)) tierArchetypes[sid] = tierArchetypeLists(sid);
}

/** SIDs of the variant prototypes the mod adds. */
export const variantPrototypeSIDs = Object.keys(variants);

/**
 * A variant prototype: inherits its vanilla prototype (patched with tiers, sizes and factions in the same file)
 * and restates only the tiered archetype lists of the faction it adds to.
 */
export function variantPrototype(sid: string) {
  const { prototype, faction } = variants[sid];
  const ranks = new Struct();
  Object.entries(tierArchetypes[sid][faction]).forEach(([rank, archetypes]) =>
    ranks.addNode(new Struct({ SpawnSettingsPerArchetypes: archetypes }), rank),
  );
  const variant = new Struct({ SID: sid }) as GenericLairPrototype;
  Object.assign(variant.__internal__, { rawName: sid, isRoot: true, refkey: prototype });
  variant.Preset = new Struct({
    PossibleInhabitantFactions: new Struct({ [faction]: new Struct({ SpawnSettingsPerPlayerRanks: ranks }) }),
  }) as any;
  return variant;
}

export const enemyCloneFileSuffixes = [
  ...new Set(Object.values(enemyClones).map((c) => c.file.slice(c.file.indexOf("/ObjPrototypes/")))),
];

/** Enemy clones grouped by the vanilla archetype key they inherit from. */
export const enemyClonesByArchetype: Record<string, string[]> = {};
Object.entries(enemyClones).forEach(([key, { archetype }]) =>
  (enemyClonesByArchetype[archetype] ??= []).push(key),
);

Object.entries(abilityClones).forEach(([clone, { ability }]) =>
  (abilityClonesByAbility[ability] ??= []).push(clone),
);
export const abilityCloneFileSuffixes = [
  ...new Set(Object.values(abilityClones).map((c) => c.file.slice(c.file.indexOf("/AbilityPrototypes/")))),
];

/** Nested structs inherit field by field (vanilla zombies restate only `VitalParams.MaxHP`). */
export function buildEnemyClone(key: string) {
  const { archetype, rank, tier, mutant } = enemyClones[key];
  const clone = new Struct() as ObjPrototype;
  clone.__internal__.rawName = key;
  clone.__internal__.isRoot = true;
  clone.__internal__.refkey = archetype;
  clone.SID = key;
  const generator = archetypeGenerator(archetype);
  if (!mutant && rank && generator) clone.ItemGeneratorPrototypeSID = rankItemGeneratorSID(generator, rank);
  const maxHP = num(resolveObjField(archetype, (s) => s.VitalParams?.MaxHP));
  if (maxHP && tier > 0 && (!mutant || maxHP < WEAK_MUTANT_MAX_HP)) {
    clone.VitalParams = new Struct({ MaxHP: round(maxHP * tierMultiplier(tier)) }) as any;
  }
  if (mutant && rank) Object.assign(clone, mutantRankFields(archetype, rank));
  return clone;
}

function mutantRankFields(archetype: string, rank: RankName) {
  const divisor = MUTANT_COOLDOWN_DIVISOR_BY_RANK[rank];
  const fields: Record<string, Struct> = {};

  const attacks = new Struct();
  resolveObjKeys(archetype, (s) => (s as any).MutantAttackParams).forEach((attack) => {
    const cooldown = num(resolveObjField(archetype, (s) => (s as any).MutantAttackParams?.[attack]?.Cooldown));
    if (cooldown > 0) attacks[attack] = new Struct({ Cooldown: round(cooldown / divisor) });
  });
  if (attacks.entries().length) fields.MutantAttackParams = attacks;

  const abilities = new Struct();
  Object.entries(rankAbilities(archetype, rank)).forEach(([abilityKey, sid]) => {
    abilities[abilityKey] = new Struct({ SID: sid });
  });
  if (abilities.entries().length) fields.Abilities = abilities;
  return fields;
}

/**
 * `<Gen>_LT<Rank>`: the vanilla generator keeping only entries for that rank (or no rank), with
 * `PlayerRank` dropped and ranked sub-generators swapped for their own rank clones.
 */
export function buildRankItemGenerator(generator: ItemGeneratorPrototype, rank: RankName) {
  const sid = rankItemGeneratorSID(generator.__internal__.rawName, rank);
  const clone = generator.clone();
  clone.__internal__.rawName = sid;
  clone.__internal__.isRoot = true;
  clone.SID = sid;
  const entries = clone.ItemGenerator.clone();
  entries.entries().forEach(([key]) => delete entries[key]);
  clone.ItemGenerator.forEach(([key, entry]) => {
    if (!(entry instanceof Struct)) return;
    const playerRank = String(entry.PlayerRank ?? "");
    if (playerRank && !playerRank.split(",").some((r) => r.trim() === `ERank::${rank}`)) return;
    delete entry.PlayerRank;
    entry.PossibleItems?.forEach(([, item]) => {
      const sub = item?.ItemGeneratorPrototypeSID;
      if (sub && rankedGenerators.has(sub)) item.ItemGeneratorPrototypeSID = rankItemGeneratorSID(sub, rank);
    });
    entries.addNode(entry, /^\d+$/.test(String(key)) ? undefined : String(key));
  });
  clone.ItemGenerator = entries;
  return clone;
}

/**
 * Bpatch of a vanilla lair prototype that puts the tiers into its player-rank blocks: each block's
 * `SpawnSettingsPerArchetypes` replaced whole (no bpatch on it) by the tier's mix. Null when the prototype has
 * no tiers (guards, prototypes that spawn nothing). LairTiers emits this alone; LairWars merges it with its
 * own changes.
 */
export function tierPatch(struct: GenericLairPrototype) {
  const tiered = tierArchetypes[struct.__internal__.rawName];
  const factions = struct.Preset?.PossibleInhabitantFactions;
  if (!tiered || !factions) return null;
  const patched = <T extends Struct>(s: T) => {
    const fork = s.fork();
    fork.__internal__.bpatch = true;
    return fork;
  };
  const fork = struct.fork();
  fork.Preset = patched(struct.Preset);
  fork.Preset.PossibleInhabitantFactions = patched(factions);
  factions.forEach(([factionKey, faction]) => {
    const ranks = (faction as any)?.SpawnSettingsPerPlayerRanks as Struct | undefined;
    if (!ranks) return;
    const factionFork = patched(faction as Struct) as any;
    factionFork.SpawnSettingsPerPlayerRanks = patched(ranks);
    ranks.forEach(([rankKey, rank]) => {
      const archetypes = tiered[String(factionKey)]?.[rankKey as RankName];
      if (!archetypes) return;
      const rankFork = patched(rank as Struct) as any;
      rankFork.SpawnSettingsPerArchetypes = archetypes;
      factionFork.SpawnSettingsPerPlayerRanks[rankKey] = rankFork;
    });
    (fork.Preset.PossibleInhabitantFactions as any)[factionKey] = factionFork;
  });
  return fork;
}
