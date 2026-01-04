import { ExplosionPrototypes } from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";
import { logger } from "../../src/logger.mts";
import { MergedStructs } from "../../src/merged-structs.mts";
import { precision } from "../../src/precision.mts";

export const meta: MetaType<ExplosionPrototypes> = {
  description: `
Changes RGD5 and F1 explosion radius to 15 and 30 meters respectively.
[hr][/hr]
This aligns better with IRL.
`,
  changenote: "Initial release",
  structTransformers: [structTransformer],
  onFinish(): void | Promise<void> {
    logger.log(Object.keys(MergedStructs).length);
  },
};

function structTransformer(struct: ExplosionPrototypes) {
  if (struct.SID === "ExplosionRGD5") {
    const fork = struct.fork();
    fork.Radius = 1500; // 15m
    fork.DamagePlayer = Math.max(struct.DamagePlayer, struct.DamageNPC);
    fork.ConcussionRadius = precision((struct.ConcussionRadius * fork.Radius) / struct.Radius);
    return fork;
  }
  if (struct.SID === "ExplosionF1") {
    const fork = struct.fork();
    fork.Radius = 3000; // 30m
    fork.DamagePlayer = Math.max(struct.DamagePlayer, struct.DamageNPC);
    fork.ConcussionRadius = precision((struct.ConcussionRadius * fork.Radius) / struct.Radius);
    return fork;
  }
}

structTransformer.files = ["ExplosionPrototypes.cfg"];
