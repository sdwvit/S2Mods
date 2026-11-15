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
import { transformRelationPrototypes } from "./transformRelationPrototypes.mts";

export const meta: MetaType<Struct> = {
  description: `
Every faction and mutant species can spread across the Zone and take over other lairs. Lairs get tougher as you level up and travel farther from Zalissya.

[b]Decoupled Ranks[/b] is optional but recommended. It ties your rank to your level.

[hr][/hr]
[size=4][b]Main file: current version[/b][/size]
[list]
[*] Humans, zombies and mutants all expand their territory. Squads head out a few at a time while their home lair refills, so they can keep spreading without leaving it empty.
[*] Squads can leave with just one member. Large mutants—chimeras, pseudogiants, controllers, burers and poltergeists—travel alone or in groups of two or three. Other mutants and humans travel in groups of up to four, and zombies up to five.
[*] Moving into an occupied lair always starts a fight. The Zone also checks for new moves much more often.
[*] Factions and mutants keep pushing after taking a lair. They won't settle down to defend their territory, so one side can eventually take over the Zone.
[*] Any lair outside the hubs can be captured by any faction or mutant species, regardless of location.
[*] Each time your rank increases, every lair goes up a tier, with tougher inhabitants and better gear.
[*] Regions also have a minimum tier. Each lair uses your rank or the region's minimum, whichever is higher, regardless of who holds it:
[list]
[*] Lesser Zone, Cordon, Garbage: follows your rank.
[*] Chemical Plant, Rostok, Cement Factory: at least tier two.
[*] Wild Island, Burnt Forest, Zaton, SIRCAA, Cooling Towers, Yantar, Iron Forest, Malachite: at least tier three.
[*] Swamps, Duga, Yaniv, Red Forest, Jupiter, Pripyat, Chornobyl NPP, Generators: top tier from the start.
[/list]
[*] Over 800 new mutant lairs, placed in the wild away from hubs, camps and anomalies. Each starts with a species suited to the region: tushkans, fleshes, dogs and boars near the starting areas; bloodsuckers and controllers farther in; chimeras and pseudogiants mostly in the north.
[*] Lair populations depend on the species and grow with your rank. Tushkans and blind dogs gather in large numbers; fleshes and boars around a dozen; snorks 15–20; pseudodogs and bayuns 3–5; bloodsuckers 4–6; burers 3–5; poltergeists 2–4; controllers 2–8; deer 3–6; chimeras and pseudogiants 2–6; rats 2–3. Human camps also hold more people than in vanilla. Guard posts and rat swarms are unchanged.
[*] Lairs refill even while you're nearby (but never within 25 m of you): 30 minutes after a full wipe, or 10 minutes after a partial wipe.
[*] The Zone can support up to 15,000 living units, so roaming squads aren't removed before they reach their destination.
[/list]
`,
  previousVersion: `
[hr][/hr]
[size=4][b]Optional file: previous version[/b][/size]

Same as the main file, with these differences:
[list]
[*] No 800+ new mutant lairs. Uses vanilla lairs only.
[*] No regional minimum tiers. Lair difficulty follows your rank everywhere.
[*] Large mutants travel alone or in groups of two or three. Pack mutants, including bayuns and pseudodogs, travel in groups of two to four.
[*] Lairs hold more inhabitants than vanilla and refill about three times faster, even while you're nearby.
[*] The living-unit limit is twice vanilla rather than 15,000.
[/list]

Guard posts and rat nests are unchanged. Install only one version.
`,
  changenote: "Far regions have far fewer snork lairs with weaker mutants mixed in, and lairs no longer refill within 25 m of you.",
  structTransformers: [
    transformNPCNeedsPresetPrototypes,
    transformGenericLairPrototypes,
    transformALifePopulationManagerFactionPrototypes,
    transformSpawnActorPrototypes,
    transformEnemyObjPrototypes,
    transformAbilityPrototypes,
    transformItemGenerators,
    transformALifePolicyPrototypes,
    transformRelationPrototypes,
  ] as MetaType<Struct>["structTransformers"],
};
