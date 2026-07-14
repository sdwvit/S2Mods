import type { MetaType } from "../../src/meta-type.mts";
import { Struct, type AttachPrototype } from "s2cfgtojson";

export const meta: MetaType = {
  description: `
[h1]Deprecated in 2.0[/h1]
Increases the Viper and Shakh Viper extended magazine capacity from 40 to 50 rounds.
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Also fix Shakh Viper extended magazine",
  structTransformers: [transformAttachPrototypes],
};

const targetSIDs = ["GunViper_MagIncreased", "Gun_Shakh_MagIncreased"];

function transformAttachPrototypes(struct: AttachPrototype) {
  if (!targetSIDs.includes(struct.SID)) return null;
  const fork = struct.fork();
  if (struct.Magazine) {
    fork.Magazine = struct.Magazine.fork();
  } else {
    fork.Magazine = new Struct() as any;
  }
  fork.Magazine.MaxAmmo = 50;
  return fork;
}
transformAttachPrototypes.files = ["/AttachPrototypes.cfg"];
