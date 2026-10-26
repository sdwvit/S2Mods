import { Struct } from "s2cfgtojson";

/**
 * The Expansion need is the drive that sends a squad out of its lair to take another one. Vanilla spreads it
 * unevenly: humans start at 65 (+6-10/min), zombies at 0 (+1-3/min, squads of 3-5), MutantGenericNeedsPreset at
 * 80 (+7-11/min), and Militaries, Noon, Spark, Corpus and nine mutant species (MutantGenericNeedsNoExpansionPreset)
 * don't have it at all; Scientists have no goal needs.
 *
 * Every preset here gets the same goal needs and resolvers, emitted whole (no bpatch) so the vanilla [*] entries
 * are replaced instead of appended to. The need starts at its threshold and refills within a minute, so a squad
 * leaves as soon as its lair has the population the resolver asks for (MinSquadSize).
 *
 * Children that inherit HumanGenericNeedsPreset by refkey are listed too, so they don't depend on how refkey
 * inheritance and patches are ordered. Guards (*_Guard) have empty goal needs in vanilla (they hold
 * a post), and QuestNPCNeedsPreset belongs to quest characters: those keep vanilla. Scientists expand too.
 */
export const EXPANSION_PRESETS = new Set([
  "HumanGenericNeedsPreset",
  "DutyNeedsPreset",
  "BanditsNeedsPreset",
  "FreedomsNeedsPreset",
  "VartaNeedsPreset",
  "NeutralsNeedsPreset",
  "MilitariesNeedsPreset",
  "NoonNeedsPreset",
  "MercenariesNeedsPreset",
  "SparkNeedsPreset",
  "ScientistsNeedsPreset",
  "CorpusNeedsPreset",
  "MonolitNeedsPreset",
  "ZombieNeedsPreset",
  "MutantGenericNeedsPreset",
  "MutantGenericNeedsNoExpansionPreset",
]);

export const EXPANSION_NEED = {
  InitialNeedValue: 100.0,
  MinIncreasePerMinute: 100.0,
  MaxIncreasePerMinute: 100.0,
  NeedSatisfactionThreshold: 100.0,
};
export const EXPANSION_SQUAD = { MinSquadSize: 2, MaxSquadSize: 4 };

const array = (...items: Struct[]) => {
  const s = new Struct();
  items.forEach((item) => s.addNode(item));
  s.__internal__.useAsterisk = true;
  return s;
};

const goalNeeds = () =>
  array(
    new Struct({
      NeedTag: "AI.Need.ReuniteWithLair",
      InitialNeedValue: 100.0,
      MinIncreasePerMinute: 0.0,
      MaxIncreasePerMinute: 0.0,
      NeedSatisfactionThreshold: 100.0,
    }),
    new Struct({ NeedTag: "AI.Need.Expansion", ...EXPANSION_NEED }),
  );

const needsResolvers = () =>
  array(
    new Struct({
      IdentificationTag: "AI.NeedResolver.Expansion",
      ResolverFactory: "ExpansionResolverFactory",
      ExpansionResolverFactory: new Struct(EXPANSION_SQUAD),
      OnCompleted: array(new Struct({ NeedTag: "AI.Need.Expansion", SatisfactionAmount: "100.f" })),
    }),
    new Struct({
      IdentificationTag: "AI.NeedResolver.ReuniteWithLair",
      ResolverFactory: "ReuniteWithLairResolverFactory",
      ReuniteWithLairResolverFactory: new Struct({ MinSquadSize: 1, MaxSquadSize: 4 }),
      OnCompleted: array(new Struct({ NeedTag: "AI.Need.ReuniteWithLair", SatisfactionAmount: "0.f" })),
    }),
  );

export function transformNPCNeedsPresetPrototypes(struct: Struct) {
  if (!EXPANSION_PRESETS.has(struct.SID)) {
    return null;
  }
  const fork = struct.fork();
  fork.GoalNeeds = goalNeeds();
  fork.NeedsResolvers = needsResolvers();
  return fork;
}

transformNPCNeedsPresetPrototypes.files = ["/NPCNeedsPresetPrototypes.cfg"];
