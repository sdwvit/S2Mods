import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type {
  GenericLairPrototype,
  ItemGeneratorPrototype,
  ObjPrototype,
  SpawnActorPrototype,
} from "s2cfgtojson";
import { Struct } from "s2cfgtojson";
import { baseCfgDir, modName } from "../../src/base-paths.mts";
import { getCfgFiles, getDlcCfgFiles } from "../../src/get-cfg-files.mts";
import { readFileAndGetStructs } from "../../src/read-file-and-get-structs.mts";

/**
 * Lair tiers: every LEVELS_PER_TIER DecoupledRanks levels each lair moves one tier up.
 * Tier 0 is the vanilla lair (repointed at its `_LT0` prototype), tiers 1..9 are copies stacked on
 * the same spot and switched on by quest nodes. A tier prototype spawns a spread of enemy ranks
 * (vanilla per-rank archetypes and gear) and the enemies' HP scales with the tier.
 * See DesignDocs/LairTiers.md.
 */
export const TIER_COUNT = 10;
export const LEVELS_PER_TIER = 3;
export const TIERS = Array.from({ length: TIER_COUNT }, (_, n) => n);
export const RANKS = ["Newbie", "Experienced", "Veteran", "Master"] as const;
export type RankName = (typeof RANKS)[number];

/** Human HP (and weak mutants' HP): 1x at level 1, 2x at 10, 3x at 19-21, 4x at 28-30. */
export const tierMultiplier = (tier: number) => 1 + tier / 3;

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

/** First DecoupledRanks level of a tier. */
export const tierStartLevel = (tier: number) => tier * LEVELS_PER_TIER + 1;

/**
 * Share of each enemy rank in a tier: a Gaussian around rank index tier/3 (sigma 1), so Master
 * shows up from level 1 (0.6%) and takes over late (57% at tier 9).
 */
export function rankShares(tier: number): number[] {
  const centre = tier / 3;
  const raw = RANKS.map((_, r) => Math.exp(-((r - centre) ** 2) / 2));
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / total);
}

const dominantRank = (tier: number): RankName => {
  const shares = rankShares(tier);
  return RANKS[shares.indexOf(Math.max(...shares))];
};

export const tierLairPrototypeSID = (lairPrototypeSID: string, tier: number) =>
  `${lairPrototypeSID}_LT${tier}`;
export const rankItemGeneratorSID = (generatorSID: string, rank: RankName) =>
  `${generatorSID}_LT${rank}`;

/** Deterministic GUID-shaped SID for a lair copy, so regenerating keeps save references valid. */
export const lairCopySID = (lairSID: string, tier: number) =>
  tier === 0
    ? lairSID
    : createHash("md5").update(`${modName}:${lairSID}:T${tier}`).digest("hex").toUpperCase();

/** Per-lair flag: 1 while a vanilla quest holds the lair switched off. */
export const lairHeldOffVariableSID = (lairSID: string) => `${modName}HeldOff_${lairSID}`;
export const LAIR_TIER_GLOBAL_VARIABLE_SID = `${modName}Applied`;
/** Per-lair tier currently switched on (0 = the vanilla lair). */
export const lairTierVariableSID = (lairSID: string) => `${modName}Lair_${lairSID}`;

const rel = (fullPath: string) => path.relative(path.join(baseCfgDir, "GameData"), fullPath);

// ---------------------------------------------------------------------------------------------
// Vanilla quests that switch lairs on and off.

const questNodeFiles = (await getCfgFiles("/QuestNodePrototypes/", true)).filter((f) =>
  f.includes("/GameData/QuestNodePrototypes/"),
);
/** Quest node files that hold at least one ToggleLairActivity node. */
export const lairToggleQuestFiles: string[] = [];
/** Lairs that some vanilla quest switches off with ForceDespawn = true. */
export const forceDespawnLairs = new Set<string>();
const toggledLairsIn = (text: string) => {
  const guids: string[] = [];
  for (const block of text.split(/\n(?=\S+\s*:\s*struct\.begin)/)) {
    if (!block.includes("EQuestNodeType::ToggleLairActivity")) continue;
    const guid = block.match(/TargetQuestGuid\s*=\s*(\w+)/)?.[1];
    if (!guid) continue;
    guids.push(guid);
    if (/ForceDespawn\s*=\s*true/.test(block)) forceDespawnLairs.add(guid);
  }
  return guids;
};
const questToggledLairs = new Set<string>();
for (const file of questNodeFiles) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes("EQuestNodeType::ToggleLairActivity")) continue;
  lairToggleQuestFiles.push(file);
  toggledLairsIn(text).forEach((guid) => questToggledLairs.add(guid));
}

/**
 * Base-game lairs that DLC quests switch (DLC1 24, Deluxe 2). Their toggles would have to be mirrored
 * from a `dlc` companion mod, so these lairs keep only tier 0 (no stacked copies a DLC scene can't
 * switch off).
 */
const dlcToggledLairs = new Set<string>();
for (const file of await getDlcCfgFiles("/QuestNodePrototypes.cfg")) {
  toggledLairsIn(fs.readFileSync(file, "utf8")).forEach((guid) => dlcToggledLairs.add(guid));
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
 * `<prototype>_<name>`, with `archetype` added to every player-rank block of `faction` at the weight
 * `weightOf` has there. The variant only feeds the tier prototypes (`<prototype>_<name>_LT<n>`).
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
/** Variant lair prototype SID -> the vanilla prototype it is emitted next to. */
export const lairPrototypeVariantBase: Record<string, string> = {};
for (const add of LAIR_POOL_ADDITIONS) {
  const sid = `${add.prototype}_${add.name}`;
  const variant = vanillaLairPrototypes[add.prototype].clone();
  variant.__internal__.rawName = sid;
  variant.SID = sid;
  forEachFaction(variant, (factionKey, blocks) => {
    if (factionKey !== add.faction) return;
    Object.values(blocks).forEach((block) => {
      const archetypes = (block as any).SpawnSettingsPerArchetypes as Struct | undefined;
      const like = archetypes?.[add.weightOf];
      if (!like) return;
      archetypes.addNode(new Struct({ MinQuantityPerArchetype: 0, SpawnWeight: like.SpawnWeight }), add.archetype);
    });
  });
  vanillaLairPrototypes[sid] = variant;
  lairPrototypeVariantBase[sid] = add.prototype;
  add.lairs.forEach((lair) => (lairPrototypeOverride[lair] = sid));
}

type RankBlocks = Partial<Record<RankName, Struct>>;

function forEachFaction(
  lairPrototype: GenericLairPrototype,
  callback: (factionKey: string, blocks: RankBlocks) => void,
) {
  lairPrototype.Preset?.PossibleInhabitantFactions?.forEach(([factionKey, faction]) => {
    const blocks: RankBlocks = {};
    faction?.SpawnSettingsPerPlayerRanks?.forEach(([rank, block]) => {
      if (RANKS.includes(rank as RankName) && block instanceof Struct) blocks[rank as RankName] = block;
    });
    callback(String(factionKey), blocks);
  });
}

function archetypesOf(block: Struct | undefined): Array<[string, { MinQuantityPerArchetype?: number; SpawnWeight?: number }]> {
  const result = [];
  (block as any)?.SpawnSettingsPerArchetypes?.forEach(([key, value]) => {
    if (value instanceof Struct) result.push([String(key), value]);
  });
  return result;
}

const spawnsArchetypes = (lairPrototype: GenericLairPrototype) => {
  let any = false;
  forEachFaction(lairPrototype, (_, blocks) => {
    Object.values(blocks).forEach((block) => (any ||= archetypesOf(block).length > 0));
  });
  return any;
};

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
 * `<Ability>_LT<Rank>`: inherits the ability, cooldowns divided by the rank's speed. TriggeredCooldowns
 * are restated by index (`[0]`, `[1]`, ...), the way vanilla children override array entries.
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
  if (entries.length) {
    const triggered = new Struct();
    entries.forEach(({ tag, duration, vanilla }) =>
      triggered.addNode(new Struct({ CooldownTag: tag, Duration: vanilla ? duration : round(duration * factor) })),
    );
    clone.TriggeredCooldowns = triggered;
  }
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
export function tierArchetypeMix(blocks: RankBlocks, playerRankBlock: Struct, tier: number) {
  const shares = rankShares(tier);
  const usable = RANKS.map((rank, r) => {
    const archetypes = archetypesOf(blocks[rank]);
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
  archetypesOf(playerRankBlock).forEach(([archetype, s]) => {
    const min = Number(s.MinQuantityPerArchetype ?? 0);
    if (!min) return;
    const key = enemyFor(archetype, dominant, tier);
    mix[key] ??= { MinQuantityPerArchetype: 0, SpawnWeight: 0 };
    mix[key].MinQuantityPerArchetype = Math.max(mix[key].MinQuantityPerArchetype, min);
  });
  return mix;
}

/** Builds `<LairProto>_LT<n>`: the vanilla prototype with every block's archetypes replaced. */
export function buildTierLairPrototype(lairPrototype: GenericLairPrototype, tier: number) {
  const sid = tierLairPrototypeSID(lairPrototype.__internal__.rawName, tier);
  const clone = lairPrototype.clone();
  clone.__internal__.rawName = sid;
  clone.__internal__.isRoot = true;
  clone.SID = sid;
  const vanillaBlocks: Record<string, RankBlocks> = {};
  forEachFaction(lairPrototype, (factionKey, blocks) => (vanillaBlocks[factionKey] = blocks));
  forEachFaction(clone, (factionKey, blocks) => {
    Object.values(blocks).forEach((block) => {
      const mix = tierArchetypeMix(vanillaBlocks[factionKey], block, tier);
      const archetypes = new Struct() as any;
      Object.entries(mix).forEach(([key, settings]) => archetypes.addNode(new Struct(settings), key));
      (block as any).SpawnSettingsPerArchetypes = archetypes;
    });
  });
  return clone;
}

// ---------------------------------------------------------------------------------------------
// Lairs on the world map.

export type Lair = {
  sid: string;
  file: string;
  lairPrototypeSID: string;
  /** A vanilla quest switches it on/off, so it gets a held-off flag. */
  questToggled: boolean;
  /** Initial flag value: vanilla starts it switched off. */
  startsHeldOff: boolean;
  /** Only tier 0 (repointed vanilla lair), see dlcToggledLairs. */
  tierZeroOnly: boolean;
  /** Off in vanilla and no quest switches it on: the mod switches the vanilla lair on. */
  enabledByMod: boolean;
  /** World position (UE units), for the "player within 1 km" check. */
  position: { X: number; Y: number; Z: number };
};

const spawnActorFiles = (await getCfgFiles("/SpawnActorPrototypes/WorldMap_WP/", true)).filter((f) =>
  f.includes("/GameData/SpawnActorPrototypes/WorldMap_WP/"),
);
export const lairs: Lair[] = [];
for (const file of spawnActorFiles) {
  if (!fs.readFileSync(file, "utf8").includes("ESpawnType::LairSpawner")) continue;
  for (const s of await readFileAndGetStructs<SpawnActorPrototype>(rel(file))) {
    if (s.SpawnType !== "ESpawnType::LairSpawner") continue;
    const sid = s.__internal__.rawName;
    // Guard lairs (hub guards) are left exactly as vanilla has them.
    if (String(s.LairPrototypeSID).startsWith("Guard")) continue;
    const lairPrototypeSID = lairPrototypeOverride[sid] ?? s.LairPrototypeSID;
    const lairPrototype = vanillaLairPrototypes[lairPrototypeSID];
    if (!lairPrototype || !spawnsArchetypes(lairPrototype)) continue;
    // Spawned by quest nodes on demand; a stacked copy would never be spawned.
    if (String(s.SpawnOnStart) === "false") continue;
    const questToggled = questToggledLairs.has(sid);
    const inactive = String(s.ActiveLair) === "false";
    lairs.push({
      sid,
      file,
      lairPrototypeSID,
      questToggled,
      // A quest decides when a quest-toggled lair starts; the rest of the vanilla-off lairs are switched on.
      startsHeldOff: inactive && questToggled,
      tierZeroOnly: dlcToggledLairs.has(sid),
      enabledByMod: inactive && !questToggled,
      position: { X: Number(s.PositionX), Y: Number(s.PositionY), Z: Number(s.PositionZ) },
    });
  }
}
export const lairsBySID = Object.fromEntries(lairs.map((l) => [l.sid, l]));
/** Lairs with stacked tier copies. */
export const tieredLairs = lairs.filter((l) => !l.tierZeroOnly);
export const lairFileSuffixes = [
  ...new Set(lairs.map((l) => l.file.slice(l.file.indexOf("/SpawnActorPrototypes/")))),
];

/** Tier lair prototypes, built once so enemyClones/rankedGenerators are complete up front. */
export const tierLairPrototypes: Record<string, GenericLairPrototype[]> = {};
for (const lairPrototypeSID of new Set(lairs.map((l) => l.lairPrototypeSID))) {
  tierLairPrototypes[lairPrototypeSID] = TIERS.map((tier) =>
    buildTierLairPrototype(vanillaLairPrototypes[lairPrototypeSID], tier),
  );
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
