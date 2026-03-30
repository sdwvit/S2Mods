import type { EffectPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<EffectPrototype> = {
  description: `
Replaces psy NPC stalker spawns with phantom creature spawns at high PSY damage.[h1][/h1]
[hr][/hr]
[list]
[*] At 30+ PSY points, phantom creatures spawn instead of psy stalker NPCs
[*] At 85+ PSY points, phantom creatures still spawn as in vanilla
[*] Result: double phantom creature spawn rate at 85+ PSY
[/list]
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
