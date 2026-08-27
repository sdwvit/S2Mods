import type { AnomalyPrototype, EffectPrototype, ObjPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType = {
  structTransformers: [anomalyTransformer, hitTransformer],
  description: `
Nerfs the Clicker (Flashbang) anomaly so it's far less punishing.
[hr][/hr]
[list]
[*] ParticleMaxCount reduced from 20 to 1.
[*] ParticleCooldownTime increased from 4s to 10s.
[*] ClickerAnomalyHit damage changed to a 10-80 range (was a flat 105).
[/list]

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release",
};

function anomalyTransformer(struct: AnomalyPrototype) {
  if (struct.SID !== "ClickerAnomaly") return;
  const fork = struct.fork();
  fork.ParticleMaxCount = 1 as any;
  fork.ParticleCooldownTime = 10.0;
  return fork;
}

anomalyTransformer.files = ["AnomalyPrototypes.cfg"];

function hitTransformer(struct: EffectPrototype) {
  if (struct.SID !== "ClickerAnomalyHit") return;
  const fork = struct.fork();
  fork.ValueMin = 10 as any;
  fork.ValueMax = 80 as any;
  return fork;
}

hitTransformer.files = ["EffectPrototypes.cfg"];
