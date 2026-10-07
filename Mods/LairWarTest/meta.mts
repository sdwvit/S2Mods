import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformSpawnActorPrototypes } from "./transformSpawnActorPrototypes.mts";
import { transformLairPrototypes } from "./transformLairPrototypes.mts";
import { transformALifePopulationManagerFactionPrototypes } from "./transformALifePopulationManagerFactionPrototypes.mts";
import { transformRootgraph, transformQuestPrototypes } from "./transformRootgraph.mts";
import { transformNPCNeedsPresets } from "./transformNPCNeedsPresets.mts";
import { transformNPCArchetypes } from "./transformNPCArchetypes.mts";
import { transformAIGlobals } from "./transformAIGlobals.mts";

export const meta: MetaType<Struct> = {
  description: `
Test mod. Stages a capturable two-lair territorial fight between Freedom and Bandits near Rostok, to observe whether A-Life lairs actually change hands.[h1][/h1]
[hr][/hr]
[list]
[*] Two adjacent capturable lairs at Rostok are reassigned: one to Freedom, one to Bandits. 69m apart, 0.7m elevation delta, both ~0.05km from the Rostok fast-travel point. Both are human ALifeLair camps that spawn from their core volume.
[*] Both keep CanBeCaptured/CanAttack/CanDefend enabled and are forced to Newbie-Master spawn rank so neither side can be ranked out of existence.
[*] Both lairs are repointed at a new prototype whose archetypes are faction-war eligible. This is the part with no vanilla equivalent: bParticipatesInFactionWar appears nowhere in the base game, only on DLC1's two FW needs presets, and an NPC without it is never dispatched as a war squad. The mod rebuilds DLC1's chain - needs preset -> archetype -> lair prototype - on base-game parents.
[*] Lair refill cut to 20s so camps stay manned, but wipe timeout raised to 600s so a cleared lair stays empty long enough to actually be captured.
[*] No DLC required. Everything used - the bParticipatesInFactionWar field, HumanFWHearingSensor, the FactionWar spawn and quest node types - is in the base game. Only the map markers are DLC1-only, so they are off.
[*] A FactionWar controller, two UnitSpawners and two Reinforcers are created in config so both lairs actually dispatch attack squads (MinTimerForAttack 20-30s, attack squads of 3-6). Lair flags alone only permit capture - they never send anyone.
[*] All five new actors carry PlaceholderMapPath pointing at WorldMap_WP. Without it the engine parses the prototype but never places the actor, so the controller does not exist at runtime and nothing can reference it.
[*] A dedicated quest (LairWarTest_Main) is registered in QuestPrototypes and started by a ConsoleCommand node hung off rootgraph_Start. Its OnTick node then fires FWChangePreset, switching the controller from its inert Off preset to the active war preset.
[*] Freedom and Bandits forced into the Aggressive expansion tactic with 100% lair-battle chance; A-Life simulation starts immediately instead of after 48 in-game hours. MinLairs/MaxLairs stay vanilla - they select which band applies, they are not caps.
[*] AIGlobals MaxAgentsCount raised 52 -> 200. This is the real ceiling: it caps concurrent online agents for the entire world, so no lair setting can exceed it. Garrisons are 100 per side at 90% initial fill, attack squads 8-16, reinforcements 6-12, 20 defenders. A test mod, not a balance pass.
[*] The A-Life bubble is widened from ~25/30m to ~125/150m. The two lairs are 69m apart, so at vanilla range only the camp you stand in is ever online and the war is unobservable even when it runs.
[/list]
[hr][/hr]
No relationship edits: Freedom and Bandits are already Enemy (-800) in vanilla and already permit attacking each other's lairs.
[hr][/hr]
bPatches: NPCNeedsPresetPrototypes.cfg, ObjPrototypes/GeneralNPCObjPrototypes.cfg, QuestPrototypes/rootgraph.cfg, QuestNodePrototypes/rootgraph.cfg, SpawnActorPrototypes/**/*.cfg (LairSpawner only), LairPrototypes/GenericLairPrototypes.cfg, ALifePrototypes/ALifePopulationManagerFactionPrototypes.cfg
  `,
  changenote:
    "Fixed the mod spawning nothing. Three separate causes. The two lairs were wrong - the Freedom side was a Blinddog mutant den in the himzavod region, not a Rostok human camp; both are now real capturable human lairs 69m apart at Rostok. Squads could never be dispatched because bParticipatesInFactionWar exists only on DLC1's FW needs presets and nowhere in the base game, so the mod rebuilds DLC1's needs-preset -> archetype -> lair-prototype chain on base-game parents. And AIGlobals capped the whole world at 52 concurrent agents, which no lair setting can exceed - now 200, with the A-Life bubble widened from ~25/30m to ~125/150m so both camps are online at once. Also fixed: A-Life goal bands had been widened to 1-900 each, making three overlapping bands and breaking tactic lookup; the new spawn actors were missing PlaceholderMapPath; and the FWChangePreset node had no running quest. No DLC required - lair markers are off because their prototypes are DLC1-only.",
  structTransformers: [
    transformSpawnActorPrototypes,
    transformLairPrototypes,
    transformALifePopulationManagerFactionPrototypes,
    transformRootgraph,
    transformQuestPrototypes,
    transformNPCNeedsPresets,
    transformNPCArchetypes,
    transformAIGlobals,
  ],
};
