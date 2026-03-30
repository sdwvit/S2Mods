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
Removes the need to recharge Weird Flower and Weird Bolt uber artifacts.
[list]
[*] Weird Flower: effects are always active without needing to wake it up in an anomaly
[*] Weird Bolt: charge capacity massively increased so it effectively never runs out
[/list]
bPatches ArtifactPrototypes.cfg`,
  changenote: "Initial release",
};
