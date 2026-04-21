import type { SpawnActorPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformSpawnActorPrototypes } from "./transformSpawnActorPrototypes.mts";

export const meta: MetaType<SpawnActorPrototype> = {
  description: `
Expands the territory of mutant/NPC lairs and makes them active from the earliest player rank.[h1][/h1]
[hr][/hr]
[list]
[*] Lair RestrictionRadius increased 10x — lairs cover dramatically larger territory.
[*] MinSpawnRank lowered to ERank::Newbie — lairs spawn from the start of the game regardless of player rank.
[*] Monolith lairs are skipped to avoid early-game over-encounters with endgame faction.
[/list]
[hr][/hr]
bPatches: SpawnActorPrototypes/**/*.cfg (LairSpawner only)
  `,
  changenote: "Initial release",
  structTransformers: [transformSpawnActorPrototypes],
};
