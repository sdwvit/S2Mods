import type { EffectPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<EffectPrototype> = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
Replaces psy NPC stalker spawns with phantom creature spawns at high PSY damage.[h1][/h1]
[hr][/hr]
[list]
[*] At 30+ PSY points, phantom creatures spawn instead of psy stalker NPCs
[*] At 85+ PSY points, phantom creatures still spawn as in vanilla
[*] Result: double phantom creature spawn rate at 85+ PSY
[/list]
  
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release",
  structTransformers: [transformConditionalSpawn],
};

function transformConditionalSpawn(struct: EffectPrototype) {
  if (struct.SID !== "ConditionalSpawnPSYNPC") return null;
  const fork = struct.fork();
  fork.FalseEffectSID = "SpawnPSYPhantoms";
  return fork;
}

transformConditionalSpawn.files = ["/EffectPrototypes.cfg"];
