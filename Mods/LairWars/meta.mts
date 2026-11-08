import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformNPCNeedsPresetPrototypes } from "./transformNPCNeedsPresetPrototypes.mts";
import { transformGenericLairPrototypes } from "./transformGenericLairPrototypes.mts";
import { transformALifePopulationManagerFactionPrototypes } from "./transformALifePopulationManagerFactionPrototypes.mts";
import { transformSpawnActorPrototypes } from "./transformSpawnActorPrototypes.mts";
import { transformAbilityPrototypes } from "./transformAbilityPrototypes.mts";
import { transformEnemyObjPrototypes } from "./transformEnemyObjPrototypes.mts";
import { transformItemGenerators } from "./transformItemGenerators.mts";
import { transformALifePolicyPrototypes } from "./transformALifePolicyPrototypes.mts";

export const meta: MetaType<Struct> = {
  description: `
Every faction and every mutant species can move out and take over other lairs, and lairs grow tougher as you level up.[h1][/h1]
Requires [b]Decoupled Ranks[/b], which ties your rank to your level.[h1][/h1]
[hr][/hr]
[list]
[*] Humans, zombies and all mutants share one urge to expand: squads leave a few at a time while the lair refills behind them, so territory shifts as you play and home is never left empty.
[*] Big mutants (chimeras, pseudogiants, controllers, burers, poltergeists) set out alone or in twos and threes; packs, including bayuns and pseudodogs, move in groups of two to four.
[*] Lairs hold more inhabitants and refill about three times faster, even near you, and the Zone allows twice as many living units, so a lair can send squads out without leaving home empty. Guard posts and rat nests stay vanilla.
[*] Every move into an occupied lair ends in a fight, and the Zone checks for moves far more often.
[*] Factions and species never switch to defending what they hold, so a winning side keeps pushing and can take over the Zone.
[*] Every lair outside the hubs can be captured, and any faction or mutant species can move into it.
[*] Each time your rank goes up, every lair moves up a tier: tougher inhabitants with better gear.
[/list]
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Lairs grow bigger and refill faster even near you, squads leave a few at a time so lairs keep defenders, big mutants can set out alone, and winning factions and species keep expanding until one side can take over the Zone.",
  structTransformers: [
    transformNPCNeedsPresetPrototypes,
    transformGenericLairPrototypes,
    transformALifePopulationManagerFactionPrototypes,
    transformSpawnActorPrototypes,
    transformEnemyObjPrototypes,
    transformAbilityPrototypes,
    transformItemGenerators,
    transformALifePolicyPrototypes,
  ] as MetaType<Struct>["structTransformers"],
};
