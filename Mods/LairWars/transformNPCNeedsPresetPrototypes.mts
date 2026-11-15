import type { MetaContext } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";

/**
 * The Expansion need is the drive that sends a squad out of its lair to take another one. Vanilla refills it at
 * 6-10/min for humans, 1-3/min for zombies and 7-11/min for MutantGenericNeedsPreset.
 *
 * - Presets that declare the need (HumanGenericNeedsPreset, whose refkey children inherit it, ZombieNeedsPreset,
 *   MutantGenericNeedsPreset): only the start value and rate change, its AI.Need.Expansion entry is bpatched in
 *   place.
 * - Presets without it (`ADD_EXPANSION`: Militaries, Noon, Spark, Corpus and the mutants on
 *   MutantGenericNeedsNoExpansionPreset: Controller, Poltergeist, Pseudogiant, Burer, rat swarms, Deer, Chimera)
 *   get the need and its ExpansionResolverFactory resolver added at the next index, copied from the generic preset
 *   of their kind, at the same rate. Their `_Guard` presets restate GoalNeeds and NeedsResolvers and stay without
 *   it. Scientists stay without it: they are not an A-Life faction (ALifePopulationManagerFactionPrototypes), so
 *   the population manager never moves them.
 * - The mutants on MutantGenericNeedsNoExpansionPreset are the big loners: their expansion squads are
 *   `LONER_SQUAD_SIZE` (1-3), where the generic mutant preset sends 2-4. Bayun and Pseudodog were on it too and
 *   move to the generic preset (transformEnemyObjPrototypes.mts).
 *
 * Expansion squads leave from 1 inhabitant up (`EXPANSION_MIN_SQUAD_SIZE`; vanilla 2, zombies 3); maximums stay
 * vanilla. The resolver is bpatched in HumanGenericNeedsPreset (its refkey children inherit it), ZombieNeedsPreset
 * and MutantGenericNeedsPreset, and set on the resolvers copied into the `ADD_EXPANSION` presets.
 *
 * Each inhabitant has its own need, and squads form from those who reach 100. A lair that loads online
 * spawns everyone at the same start value, so one shared rate sends the whole lair out at once. A wide random
 * rate from 0 staggers it: the first squad leaves after ~3 min, the slowest inhabitants after ~20 min, while
 * the lair refills behind them.
 */
export const EXPANSION_INITIAL_NEED = 0.0;
export const EXPANSION_MIN_INCREASE_PER_MINUTE = 5.0;
export const EXPANSION_MAX_INCREASE_PER_MINUTE = 35.0;
/** Smallest expansion squad of every preset. */
export const EXPANSION_MIN_SQUAD_SIZE = 1;
/** Expansion squad size of MutantGenericNeedsNoExpansionPreset (Chimera, Pseudogiant, Controller, Burer, Poltergeist, Deer, rats). */
export const LONER_SQUAD_SIZE = { min: EXPANSION_MIN_SQUAD_SIZE, max: 3 };
const LONER_PRESET = "MutantGenericNeedsNoExpansionPreset";
/**
 * Chimeras, pseudogiants and deer expand 1-2 at a time: their own preset inherits the loner preset (root refkey,
 * so it gets the Expansion need added below) and restates only the expansion resolver's MaxSquadSize. With
 * HP that outlasts most other units in offline fights, bigger squads let them take over the Zone (sim/).
 */
export const BIG_MUTANT_PRESET = "LairWarsBigMutantNeedsPreset";
export const BIG_MUTANT_SQUAD_SIZE = { min: EXPANSION_MIN_SQUAD_SIZE, max: 2 };
/**
 * Monolith dominates the other humans: its preset (MonolitNeedsPreset, which inherits HumanGenericNeedsPreset's
 * Expansion need and resolver, both at [0]) restates the need rate x1.5 and squads of up to 8 (vanilla 4).
 * MonolitNeedsPreset_Guard inherits it.
 */
const MONOLITH_PRESET = "MonolitNeedsPreset";
export const MONOLITH_EXPANSION_SPEED = 1.5;
export const MONOLITH_SQUAD_SIZE = { min: EXPANSION_MIN_SQUAD_SIZE, max: 8 };
const EXPANSION_NEED = "AI.Need.Expansion";
const EXPANSION_RESOLVER = "AI.NeedResolver.Expansion";

/** Preset without the Expansion need -> preset to copy the need and its resolver from. */
const ADD_EXPANSION: Record<string, string> = {
  MilitariesNeedsPreset: "HumanGenericNeedsPreset",
  NoonNeedsPreset: "HumanGenericNeedsPreset",
  SparkNeedsPreset: "HumanGenericNeedsPreset",
  CorpusNeedsPreset: "HumanGenericNeedsPreset",
  MutantGenericNeedsNoExpansionPreset: "MutantGenericNeedsPreset",
};

const entryWith = (list: Struct | undefined, field: string, value: string) =>
  list?.entries().find(([, entry]) => entry instanceof Struct && entry[field] === value);

const fasterNeed = (need: Struct) => {
  need.InitialNeedValue = EXPANSION_INITIAL_NEED;
  need.MinIncreasePerMinute = EXPANSION_MIN_INCREASE_PER_MINUTE;
  need.MaxIncreasePerMinute = EXPANSION_MAX_INCREASE_PER_MINUTE;
  return need;
};

/**
 * A bpatch of a `[*]` list that adds `entry` after vanilla's entries. Vanilla's `[*]` entries are `[0]`, `[1]`,
 * ... in order, so the new one gets the next index: a `[*]` in a bpatch would append again every time the patch
 * applies, an index adds the entry once.
 */
function appended(list: Struct, entry: Struct) {
  const index = list.entries().length;
  const fork = list.fork();
  fork.__internal__.bpatch = true;
  fork.__internal__.useAsterisk = false;
  entry.__internal__.rawName = String(index);
  fork.addNode(entry, index);
  return fork;
}

/**
 * The big mutants' preset: a full copy of the vanilla loner preset plus the expansion need and resolver. A refkey to
 * the loner preset would inherit only its bpatch block from this same file (no vanilla needs) and crash on load.
 */
function bigMutantPreset(vanilla: Struct, need: Struct, resolver: Struct) {
  const preset = vanilla.clone();
  preset.__internal__.rawName = BIG_MUTANT_PRESET;
  preset.__internal__.isRoot = true;
  preset.__internal__.bpatch = false;
  preset.SID = BIG_MUTANT_PRESET;
  const own = resolver.clone();
  own.ExpansionResolverFactory.MaxSquadSize = BIG_MUTANT_SQUAD_SIZE.max;
  const full = (list: Struct, entry: Struct) => {
    const copy = list.clone();
    const index = copy.entries().length;
    entry.__internal__.rawName = String(index);
    copy.addNode(entry, index);
    return copy;
  };
  preset.GoalNeeds = full(vanilla.GoalNeeds, fasterNeed(need.clone()));
  preset.NeedsResolvers = full(vanilla.NeedsResolvers, own);
  return preset;
}

function monolithPreset(struct: Struct) {
  const fork = struct.fork();
  fork.__internal__.bpatch = true;
  const needs = new Struct();
  needs.__internal__.useAsterisk = false;
  const need = new Struct({
    MinIncreasePerMinute: EXPANSION_MIN_INCREASE_PER_MINUTE * MONOLITH_EXPANSION_SPEED,
    MaxIncreasePerMinute: EXPANSION_MAX_INCREASE_PER_MINUTE * MONOLITH_EXPANSION_SPEED,
  });
  need.__internal__.rawName = "0";
  needs.addNode(need, 0);
  fork.GoalNeeds = needs;
  const resolvers = new Struct();
  resolvers.__internal__.useAsterisk = false;
  const resolver = new Struct({ ExpansionResolverFactory: new Struct({ MaxSquadSize: MONOLITH_SQUAD_SIZE.max }) });
  resolver.__internal__.rawName = "0";
  resolvers.addNode(resolver, 0);
  fork.NeedsResolvers = resolvers;
  return fork;
}

export function transformNPCNeedsPresetPrototypes(struct: Struct, context: MetaContext<Struct>) {
  if (struct.__internal__.rawName === MONOLITH_PRESET) return monolithPreset(struct);
  const source = context.structsById[ADD_EXPANSION[struct.__internal__.rawName]];
  if (source) {
    const need = entryWith(source.GoalNeeds, "NeedTag", EXPANSION_NEED)![1].clone();
    const resolver = entryWith(source.NeedsResolvers, "IdentificationTag", EXPANSION_RESOLVER)![1].clone();
    resolver.ExpansionResolverFactory.MinSquadSize = EXPANSION_MIN_SQUAD_SIZE;
    if (struct.__internal__.rawName === LONER_PRESET) resolver.ExpansionResolverFactory.MaxSquadSize = LONER_SQUAD_SIZE.max;
    const fork = struct.fork();
    fork.GoalNeeds = appended(struct.GoalNeeds, fasterNeed(need));
    fork.NeedsResolvers = appended(struct.NeedsResolvers, resolver);
    return struct.__internal__.rawName === LONER_PRESET ? [fork, bigMutantPreset(struct, need, resolver)] : fork;
  }

  const goalNeeds = struct.GoalNeeds as Struct | undefined;
  const expansion = entryWith(goalNeeds, "NeedTag", EXPANSION_NEED);
  if (!goalNeeds || !expansion) return null;
  const needs = goalNeeds.fork();
  // Vanilla writes the list as [*]; a [*] in a bpatch appends, so emit the real index to patch in place.
  needs.__internal__.useAsterisk = false;
  needs[expansion[0]] = fasterNeed(goalNeeds[expansion[0]].fork());
  const fork = struct.fork();
  fork.GoalNeeds = needs;
  const resolvers = struct.NeedsResolvers as Struct | undefined;
  const resolver = entryWith(resolvers, "IdentificationTag", EXPANSION_RESOLVER);
  if (resolvers && resolver) {
    const resolversFork = resolvers.fork();
    resolversFork.__internal__.useAsterisk = false;
    const resolverFork = resolvers[resolver[0]].fork();
    resolverFork.ExpansionResolverFactory = resolver[1].ExpansionResolverFactory.fork();
    resolverFork.ExpansionResolverFactory.MinSquadSize = EXPANSION_MIN_SQUAD_SIZE;
    resolversFork[resolver[0]] = resolverFork;
    fork.NeedsResolvers = resolversFork;
  }
  return fork;
}

transformNPCNeedsPresetPrototypes.files = ["/NPCNeedsPresetPrototypes.cfg"];
// No inheritDuplicates: it writes dotted sub-struct refkeys, which the game doesn't resolve (transformEnemyObjPrototypes.mts).
transformNPCNeedsPresetPrototypes.splitNewStructs = true;
