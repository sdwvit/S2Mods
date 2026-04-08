import type { SpawnActorPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

/**
 * Removes OverrideRank from spawn actors so NPC loot is determined by the player's rank,
 * not a hardcoded NPC rank. Without this, HeadlessArmors can drop high-tier gear
 * (e.g. exoskeletons) from quest NPCs even when the player is at a low rank.
 */
export const transformSpawnActors: StructTransformer<SpawnActorPrototype> = (struct) => {
  if (!struct.OverrideRank) {
    return null;
  }
  const fork = struct.fork();
  fork.OverrideRank = false;
  return fork;
};

transformSpawnActors.files = ["/SpawnActorPrototypes/"];
transformSpawnActors.contains = true;

