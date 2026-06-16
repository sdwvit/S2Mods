import { Struct } from "s2cfgtojson";
import type { ObjPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<ObjPrototype> = {
  structTransformers: [entriesTransformer],
  description: `
Doubles the player's maximum stamina from 100 to 200.
[hr][/hr]
[list]
[*] Player MaxSP increased from 100 to 200.
[*] No changes to NPCs or any other stats.
[/list]
`,
  changenote: "Initial release",
};

function entriesTransformer(struct: ObjPrototype) {
  if (struct.SID !== "Player") return;
  const fork = struct.fork();
  fork.VitalParams = new Struct() as ObjPrototype["VitalParams"];
  fork.VitalParams.__internal__.bpatch = true;
  fork.VitalParams.MaxSP = 200;
  return fork;
}

entriesTransformer.files = ["GameData/ObjPrototypes.cfg"];
