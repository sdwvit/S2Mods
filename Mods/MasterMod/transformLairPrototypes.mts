import { LairPrototype, LairPrototypeMaster, LairPrototypePossibleInhabitantFactionsItem } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";

/**
 * increase zombie population in lairs, also add controllers occasionally
 */
export const transformLairPrototypes: StructTransformer<LairPrototype> = async (struct) => {
  if (struct.Preset.InitialInhabitantFaction !== "Zombie") {
    return null;
  }

  const fork = struct.fork();
  fork.Preset = struct.fork() as any;
  fork.Preset.PossibleInhabitantFactions = struct.fork() as any;
  struct.Preset.PossibleInhabitantFactions.forEach(([faction, v]: [`${number}`, LairPrototypePossibleInhabitantFactionsItem]) => {
    const inhabitantFork = v.fork() as any;
    inhabitantFork.SpawnSettingsPerPlayerRanks = struct.fork() as any;
    fork.Preset.PossibleInhabitantFactions[faction] = inhabitantFork;
    v.SpawnSettingsPerPlayerRanks.forEach(([rankKey, rankValue]) => {
      const newRv = rankValue.fork() as LairPrototypeMaster;
      newRv.MaxSpawnQuantity = rankValue.MaxSpawnQuantity * 2;
      newRv.SpawnSettingsPerArchetypes = rankValue.fork() as any;
      newRv.SpawnSettingsPerArchetypes.Controller = rankValue.SpawnSettingsPerArchetypes.entries()[0][1].fork(true);
      newRv.SpawnSettingsPerArchetypes.Controller.MinQuantityPerArchetype = 0;
      newRv.SpawnSettingsPerArchetypes.Controller.SpawnWeight = 1;
      rankValue.SpawnSettingsPerArchetypes.forEach(([k, v]) => {
        if (!v.MinQuantityPerArchetype) {
          newRv.SpawnSettingsPerArchetypes[k] = v.fork();
          newRv.SpawnSettingsPerArchetypes[k].MinQuantityPerArchetype = 1;
        }
      });

      inhabitantFork.SpawnSettingsPerPlayerRanks[rankKey] = newRv;
    });
  });

  return fork;
};

transformLairPrototypes.files = ["LairPrototypes/GenericLairPrototypes.cfg"];
