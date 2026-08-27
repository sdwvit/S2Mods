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

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
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
