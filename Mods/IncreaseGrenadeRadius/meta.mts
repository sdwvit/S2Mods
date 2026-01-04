import { ExplosionPrototypes } from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";
import { logger } from "../../src/logger.mts";
import { MergedStructs } from "../../src/merged-structs.mts";
import { precision } from "../../src/precision.mts";

export const meta: MetaType<ExplosionPrototypes> = {
  description: `
Title
[hr][/hr]
Description 1[h1][/h1]
Description 2[h1][/h1]
[hr][/hr]
Footer
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
