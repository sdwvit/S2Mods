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
 * Each inhabitant has its own need, and squads (2-4) form from those who reach 100. A lair that loads online
 * spawns everyone at the same start value, so one shared rate sends the whole lair out at once. A wide random
 * rate from 0 staggers it: the first squad leaves after ~3 min, the slowest inhabitants after ~20 min, while
 * the lair refills behind them.
 */
export const EXPANSION_INITIAL_NEED = 0.0;
export const EXPANSION_MIN_INCREASE_PER_MINUTE = 5.0;
export const EXPANSION_MAX_INCREASE_PER_MINUTE = 35.0;
/** Expansion squad size of MutantGenericNeedsNoExpansionPreset (Chimera, Pseudogiant, Controller, Burer, Poltergeist, Deer, rats). */
export const LONER_SQUAD_SIZE = { min: 1, max: 3 };
const LONER_PRESET = "MutantGenericNeedsNoExpansionPreset";
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

export function transformNPCNeedsPresetPrototypes(struct: Struct, context: MetaContext<Struct>) {
  const source = context.structsById[ADD_EXPANSION[struct.__internal__.rawName]];
  if (source) {
    const need = entryWith(source.GoalNeeds, "NeedTag", EXPANSION_NEED)![1].clone();
    const resolver = entryWith(source.NeedsResolvers, "IdentificationTag", EXPANSION_RESOLVER)![1].clone();
    if (struct.__internal__.rawName === LONER_PRESET) {
      resolver.ExpansionResolverFactory.MinSquadSize = LONER_SQUAD_SIZE.min;
      resolver.ExpansionResolverFactory.MaxSquadSize = LONER_SQUAD_SIZE.max;
    }
    const fork = struct.fork();
    fork.GoalNeeds = appended(struct.GoalNeeds, fasterNeed(need));
    fork.NeedsResolvers = appended(struct.NeedsResolvers, resolver);
    return fork;
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
  return fork;
}

transformNPCNeedsPresetPrototypes.files = ["/NPCNeedsPresetPrototypes.cfg"];
transformNPCNeedsPresetPrototypes.inheritDuplicates = true;
