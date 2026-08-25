import { Struct } from "s2cfgtojson";
import type { ArtifactPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

function transformArtifactPrototypes(struct: ArtifactPrototype) {
  if (struct.SID === "AArtifactWeirdFlower") {
    const fork = struct.fork();
    fork.EffectsDuration = 31536000;
    fork.EffectPrototypeSIDs = fork.EffectPrototypeSIDs.fork();
    fork.EffectPrototypeSIDs.addNode("FlairDistanceModifierEffect", "FlairDistanceModifierEffect");
    return fork;
  }

  if (struct.SID === "AArtifactWeirdBolt") {
    const fork = struct.fork();
    fork.MaxCharge = 999999.0;
    return fork;
  }
}

transformArtifactPrototypes.files = ["/ArtifactPrototypes.cfg"];

export const meta: MetaType<ArtifactPrototype> = {
  structTransformers: [transformArtifactPrototypes],
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
Removes the need to recharge Weird Flower and Weird Bolt uber artifacts.
[list]
[*] Weird Flower: effects are always active without needing to wake it up in an anomaly
[*] Weird Bolt: charge capacity massively increased so it effectively never runs out
[/list]
bPatches ArtifactPrototypes.cfg
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release",
};
