import type { SpawnActorPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

export const transformSpawnActorPrototypes: StructTransformer<SpawnActorPrototype> = (struct) => {
  if (struct.SpawnType !== "ESpawnType::LairSpawner") return null;
  if (struct.LairPrototypeSID === "Monolith") return null;

  const fork = struct.fork();
  if (typeof struct.RestrictionRadius === "number") {
    fork.RestrictionRadius = struct.RestrictionRadius * 10;
  }
  fork.MinSpawnRank = "ERank::Newbie";
  return fork;
};

transformSpawnActorPrototypes.files = ["/SpawnActorPrototypes/"];
transformSpawnActorPrototypes.contains = true;
transformSpawnActorPrototypes.contents = ["ESpawnType::LairSpawner"];
