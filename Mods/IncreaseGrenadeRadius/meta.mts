import type { ExplosionPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { logger } from "../../src/logger.mts";
import { MergedStructs } from "../../src/merged-structs.mts";
import { precision } from "../../src/precision.mts";

export const meta: MetaType<ExplosionPrototype> = {
  description: `
Changes RGD5, F1, VOG-25, and M203 explosion radius to 12, 20, 10, and 10 meters respectively.
[hr][/hr]
This aligns better with IRL danger/injury radii.
`,
  changenote: "Improved compatibility with recent game updates.",
  structTransformers: [structTransformer],
  onFinish(): void | Promise<void> {
    logger.log(Object.keys(MergedStructs).length);
  },
};

function structTransformer(struct: ExplosionPrototype) {
  if (struct.SID === "ExplosionRGD5") return withRadius(struct, 12);
  if (struct.SID === "ExplosionF1") return withRadius(struct, 20);
  if (struct.SID === "ExplosionVOG25") return withRadius(struct, 10);
  if (struct.SID === "ExplosionM203") return withRadius(struct, 10);
}

structTransformer.files = ["ExplosionPrototypes.cfg"]; //

function withRadius(struct: ExplosionPrototype, radiusMeters: number) {
  const fork = struct.fork();
  fork.Radius = 100 * radiusMeters;
  fork.DamagePlayer = Math.max(struct.DamagePlayer, struct.DamageNPC);
  fork.ConcussionRadius = precision(struct.ConcussionRadius * (1 + fork.Radius / struct.Radius));
  return fork;
}
