import type { SpawnActorPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { factionWarActors, LAIR_BANDITS, LAIR_FREEDOM } from "./factionWarActors.mts";
import { FW_LAIR_PROTOTYPE } from "./transformLairPrototypes.mts";

/**
 * The one lair pair near Rostok that satisfies every capture gate found in the
 * retail binary: CanBeCaptured, a multi-faction prototype listing both Freedom
 * and Bandits, ALifeLair, active, Newbie-Master spawn rank.
 * 258 m apart, 2.9 m elevation delta, 0.39 km from the Rostok fast-travel point.
 */
const SIDES: Record<string, string> = {
  [LAIR_FREEDOM]: "Freedom",
  [LAIR_BANDITS]: "Bandits",
};

export const transformSpawnActorPrototypes: StructTransformer<SpawnActorPrototype> = (struct) => {
  const sid = String(struct.SID);
  const faction = SIDES[sid];
  if (!faction) return null;

  const fork = struct.fork();
  fork.InitialInhabitantFaction = faction;

  // Off the vanilla BigLivingSpace/SmallLivingSpace prototypes and onto the one whose
  // archetypes carry bParticipatesInFactionWar. Vanilla archetypes are never dispatched.
  fork.SpawnedPrototypeSID = FW_LAIR_PROTOTYPE;
  fork.LairPrototypeSID = FW_LAIR_PROTOTYPE;

  // Already true in vanilla on both actors; set explicitly so the mod does not
  // silently depend on that and so the intent is readable.
  fork.CanBeCaptured = true;
  fork.CanAttack = true;
  fork.CanDefend = true;

  // Never let player rank gate either side out of existence.
  fork.MinSpawnRank = "ERank::Newbie";
  fork.MaxSpawnRank = "ERank::Master";

  // Emit the dispatch chain once, alongside the Freedom lair's patch file.
  // Without a FactionWar controller, UnitSpawners and Reinforcers, nothing ever
  // sends an attacking squad — the lair flags alone only permit capture.
  if (sid === LAIR_FREEDOM) return [fork, ...factionWarActors()];
  return fork;
};

transformSpawnActorPrototypes.files = ["/SpawnActorPrototypes/"];
transformSpawnActorPrototypes.contains = true;
transformSpawnActorPrototypes.contents = ["ESpawnType::LairSpawner"];
