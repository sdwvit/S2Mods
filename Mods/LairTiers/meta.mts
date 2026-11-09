import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformAbilityPrototypes } from "../LairWars/transformAbilityPrototypes.mts";
import { transformEnemyObjPrototypes } from "../LairWars/transformEnemyObjPrototypes.mts";
import { transformItemGenerators } from "../LairWars/transformItemGenerators.mts";
import { transformGenericLairPrototypes } from "./transformGenericLairPrototypes.mts";
import { transformSpawnActorPrototypes } from "./transformSpawnActorPrototypes.mts";

/** The tiers half of LairWars on its own; the code lives in Mods/LairWars (lairTiers.mts). */
export const meta: MetaType<Struct> = {
  description: `
Lairs grow tougher as your rank goes up.[h1][/h1]
[hr][/hr]
[list]
[*] Each time your rank goes up, every lair moves up a tier.
[*] A tier mixes enemies of every rank, each carrying their own rank's weapons and armor. Higher-ranked enemies show up more often as you rank up, and you may rarely meet one even as a newbie.
[*] Human enemy health scales with the tier, up to about four times vanilla.
[*] Higher-ranked mutants attack more often, up to twice as often. Weak mutants also gain health with the tier.
[*] Areas that quests clear of enemies stay clear.
[/list]
[hr][/hr]
Requires [b]Decoupled Ranks[/b], which ties your rank to your level.[h1][/h1]
Already part of [b]Lair Wars[/b]: use one or the other.
`,
  nameOverride: "Decoupled Ranks Lair Extension",
  changenote: "Lairs now move up a tier with your rank, built into the lair data with no background quests.",
  structTransformers: [
    transformGenericLairPrototypes,
    transformSpawnActorPrototypes,
    transformEnemyObjPrototypes,
    transformAbilityPrototypes,
    transformItemGenerators,
  ] as MetaType<Struct>["structTransformers"],
};
