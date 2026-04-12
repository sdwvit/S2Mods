import type { MetaType } from "../../src/meta-type.mts";
import { Struct, type AttachPrototype } from "s2cfgtojson";

export const meta: MetaType = {
  description: `Increases the Viper and Shakh Viper extended magazine capacity from 40 to 50 rounds.`,
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
