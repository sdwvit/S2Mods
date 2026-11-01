import type { MetaContext } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";

/**
 * The Expansion need is the drive that sends a squad out of its lair to take another one. Vanilla refills it at
 * 6-10/min for humans, 1-3/min for zombies and 7-11/min for MutantGenericNeedsPreset.
 *
 * - Presets that declare the need (HumanGenericNeedsPreset, whose refkey children inherit it, ZombieNeedsPreset,
 *   MutantGenericNeedsPreset): only the rate changes, its AI.Need.Expansion entry is bpatched in place, so it
 *   refills within a minute.
 * - Presets without it (`ADD_EXPANSION`: Militaries, Noon, Spark, Corpus and the mutants on
 *   MutantGenericNeedsNoExpansionPreset: Controller, Pseudodog, Poltergeist, Pseudogiant, Burer, rat swarms,
 *   Cat/Bayun, Deer, Chimera) get the need and its ExpansionResolverFactory resolver added at the next index, copied from the generic preset of their kind, at the same rate. Their `_Guard` presets restate
 *   GoalNeeds and NeedsResolvers and stay without it. Scientists stay without it: they are not an A-Life
 *   faction (ALifePopulationManagerFactionPrototypes), so the population manager never moves them.
 */
export const EXPANSION_INCREASE_PER_MINUTE = 100.0;
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
  need.MinIncreasePerMinute = EXPANSION_INCREASE_PER_MINUTE;
  need.MaxIncreasePerMinute = EXPANSION_INCREASE_PER_MINUTE;
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
