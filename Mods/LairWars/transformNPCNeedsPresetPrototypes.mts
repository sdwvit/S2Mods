import { Struct } from "s2cfgtojson";

/**
 * The Expansion need is the drive that sends a squad out of its lair to take another one. Vanilla refills it at
 * 6-10/min for humans, 1-3/min for zombies and 7-11/min for MutantGenericNeedsPreset; presets without the need
 * (Militaries, Noon, Spark, Corpus, MutantGenericNeedsNoExpansionPreset, Scientists) keep it off.
 *
 * Only the rate changes: the AI.Need.Expansion entry of GoalNeeds is bpatched in every preset that declares one
 * (HumanGenericNeedsPreset, whose refkey children inherit it, ZombieNeedsPreset, MutantGenericNeedsPreset), so it
 * refills within a minute. Every other vanilla field and resolver is untouched.
 */
export const EXPANSION_INCREASE_PER_MINUTE = 100.0;

export function transformNPCNeedsPresetPrototypes(struct: Struct) {
  const goalNeeds = struct.GoalNeeds as Struct | undefined;
  if (!goalNeeds) {
    return null;
  }
  let expansionKey: string | number | undefined;
  goalNeeds.entries().forEach(([key, need]) => {
    if (need instanceof Struct && need.NeedTag === "AI.Need.Expansion") {
      expansionKey = key;
    }
  });
  if (expansionKey === undefined) {
    return null;
  }
  const need = goalNeeds[expansionKey].fork();
  need.MinIncreasePerMinute = EXPANSION_INCREASE_PER_MINUTE;
  need.MaxIncreasePerMinute = EXPANSION_INCREASE_PER_MINUTE;
  const needs = goalNeeds.fork();
  // Vanilla writes the list as [*]; a [*] in a bpatch appends, so emit the real index to patch in place.
  needs.__internal__.useAsterisk = false;
  needs[expansionKey] = need;
  const fork = struct.fork();
  fork.GoalNeeds = needs;
  return fork;
}

transformNPCNeedsPresetPrototypes.files = ["/NPCNeedsPresetPrototypes.cfg"];
