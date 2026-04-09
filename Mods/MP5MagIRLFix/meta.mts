import type { MetaType } from "../../src/meta-type.mts";
import type { AttachPrototype } from "s2cfgtojson";

export const meta: MetaType = {
  description: `Increases the Viper extended magazine capacity from 40 to 50 rounds.`,
  changenote: "Initial release",
  structTransformers: [transformAttachPrototypes],
};

function transformAttachPrototypes(struct: AttachPrototype) {
  if (struct.SID !== "GunViper_MagIncreased") return null;
  const fork = struct.fork();
  fork.Magazine = struct.Magazine.fork();
  fork.Magazine.MaxAmmo = 50;
  return fork;
}
transformAttachPrototypes.files = ["/AttachPrototypes.cfg"];
