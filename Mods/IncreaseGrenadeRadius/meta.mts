import type { ExplosionPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { precision } from "../../src/precision.mts";

export const meta: MetaType<ExplosionPrototype> = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
Changes RGD5, F1, VOG-25, and M203 explosion radius to 12, 20, 10, and 10 meters respectively.
[hr][/hr]
This aligns better with IRL danger/injury radii.

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Improved compatibility with recent game updates.",
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
  const fork = struct.fork();
  fork.Radius = 100 * radiusMeters;
  fork.DamagePlayer = Math.max(struct.DamagePlayer, struct.DamageNPC);
  fork.ConcussionRadius = precision(struct.ConcussionRadius * (1 + fork.Radius / struct.Radius));
  return fork;
}
