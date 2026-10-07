import { Struct } from "s2cfgtojson";
import type { ObjPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<ObjPrototype> = {
  structTransformers: [amokTransformer],
  description: `
Makes Amok's whole body worth shooting, instead of only the modules on his back.[h1][/h1]
Amok is not actually invulnerable anywhere — he just has [b]24000 HP[/b], nearly ten times the Pseudogiant (2500) and seventeen times the Chimera (1400), on top of boss-tier armour. Body hits land and register, they simply move the health bar so little that the back modules feel like the only thing that works.[h1][/h1]
This mod brings him down to boss-tier numbers so that shooting him anywhere actually kills him:[h1][/h1]
[list]
[*] MaxHP 24000 -> 6000 (still well above every other big mutant).
[*] ArmorDifferenceCoefProjectiles 1.6 -> 1.4, the normal range for mutants — roughly 1.5x more damage per bullet.
[*] BoneDamageCoefficients: head 0.5 -> 1.0 and limbs 0.7 -> 1.0, so every body part takes full damage. By default a headshot on Amok did [b]half[/b] the damage of a body shot.
[/list]
The back modules are untouched, so the phase transitions they drive still happen normally.[h1][/h1]
Protection is left alone (4 across the board, the same as Pseudogiant, Burer and Controller), and the back modules are untouched — destroying them still drives the phases.[h1][/h1]
DLC1 (Iron Forest) only. No other mutant is affected.[h1][/h1]

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release",
};

function amokTransformer(struct: ObjPrototype) {
  if (struct.SID !== "Object68") return null;

  const fork = struct.fork();

  fork.VitalParams = new Struct() as ObjPrototype["VitalParams"];
  fork.VitalParams.__internal__.bpatch = true;
  fork.VitalParams.MaxHP = 6000;

  fork.ArmorDifferenceCoefProjectiles = 1.4;

  // Every bone takes full damage. Vanilla is head 0.5 / body 1.0 / limbs 0.7, so a headshot
  // was worth half a body shot.
  const bones = struct.BoneDamageCoefficients.clone();
  bones.entries().forEach(([key]) => {
    bones[key].DamageCoef = 1;
  });
  fork.BoneDamageCoefficients = bones;

  return fork;
}

// Object68 declares `{refurl=MutantBaseDLC.cfg}`, a DLC-local file that is not part of the
// extracted DLCGameData, so it is that refurl — not an ObjPrototypes path — that both the
// file scan and the per-struct DLC filter match on.
amokTransformer.files = ["MutantBaseDLC.cfg"];
amokTransformer.contains = true;
amokTransformer.dlc = true;
