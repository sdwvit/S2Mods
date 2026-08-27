import type { EffectPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

const newValues: Record<string, number> = {
  RadiationLevel7Damage: 2.5,
  RadiationLevel8Damage: 2.8,
  RadiationLevel9Damage: 3.0,
  RadiationLevel10Damage: 3.2,
  DeadlyRadiationDamage: 3.33,
};

function transformEffectPrototypes(struct: EffectPrototype) {
  const newValue = newValues[struct.SID];
  if (newValue === undefined) return null;

  const fork = struct.fork();
  fork.ValueMin = `${newValue}f`;
  fork.ValueMax = `${newValue}f`;
  return fork;
}

transformEffectPrototypes.files = ["/EffectPrototypes.cfg"];

export const meta: MetaType<EffectPrototype> = {
  structTransformers: [transformEffectPrototypes],
  description: `
  [h3]Slows down radiation damage at higher levels so you have time to react.[/h3]
[hr][/hr]
Vanilla radiation damage ramps up exponentially at higher radiation levels, killing you in under 3 seconds at 90%+ radiation. This mod flattens the curve so that even at maximum radiation, it takes about 30 seconds to die from full health.
[list]
[*] Radiation levels 1-6 (up to 50%) are unchanged
[*] Level 7 (60%): 4.18 → 2.5 DPS (~40s to die)
[*] Level 8 (70%): 8.37 → 2.8 DPS (~36s to die)
[*] Level 9 (80%): 17.58 → 3.0 DPS (~33s to die)
[*] Level 10 (90%): 38.67 → 3.2 DPS (~31s to die)
[*] Deadly (99%): 20.0 → 3.33 DPS (~30s to die)
[/list]
[hr][/hr]
This gives you a realistic window to pop an antirad or escape the zone before dying.
  
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release",
};
