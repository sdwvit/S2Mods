import type { ExplosionPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { precision } from "../../src/precision.mts";
import { allDefaultExplosionPrototypesRecord, getCorePrototype } from "../../src/consts.mts";

export const meta: MetaType<ExplosionPrototype> = {
  description: `
Changes RGD5, F1, VOG-25, and M203 explosion radius to 12, 20, 10, and 10 meters respectively.
[hr][/hr]
This aligns better with IRL danger/injury radii.

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Updated for 2.0: patches regenerated against 2.0 game data.",
  structTransformers: [structTransformer],
  onFinish(): void | Promise<void> {},
};

function structTransformer(struct: ExplosionPrototype) {
  if (struct.SID === "ExplosionRGD5") return withRadius(struct, 12);
  if (struct.SID === "ExplosionF1") return withRadius(struct, 20);
  if (struct.SID === "ExplosionVOG25") return withRadius(struct, 10);
  if (struct.SID === "ExplosionM203") return withRadius(struct, 10);
}

structTransformer.files = ["ExplosionPrototypes.cfg"]; //

function withRadius(struct: ExplosionPrototype, radiusMeters: number) {
  const base = getCorePrototype(
    struct.SID,
    allDefaultExplosionPrototypesRecord,
    (item) => item.DamagePlayer,
  );
  const fork = struct.fork();
  fork.Radius = 100 * radiusMeters;
  fork.DamagePlayer = Math.max(
    struct.DamagePlayer || base.DamagePlayer,
    struct.DamageNPC || base.DamageNPC,
  );
  fork.ConcussionRadius = precision(
    (struct.ConcussionRadius || base.ConcussionRadius) *
      (1 + fork.Radius / (struct.Radius || base.Radius)),
  );
  return fork;
}
