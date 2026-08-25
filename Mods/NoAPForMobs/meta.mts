import type { ObjPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<ObjPrototype> = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
This mode does only one thing: mobs don't wear armor![h1][/h1]
Specifically: sets Strike AP to 0 for mutants, making expansive ammo truly the best for killing them.[h1][/h1]
Meant to be used in other collections of mods.[h1][/h1]
[h1][/h1]
Compatibility: this mods does not modify any existing .cfg files, only extends mutant's object prototypes via new files.
 
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Improved compatibility with recent game updates.",
  structTransformers: [transformMobs],
};

/**
 * Sets bullet (Strike) protection to 0 for all mobs and .
 */
async function transformMobs(struct: ObjPrototype) {
  if (!struct.Protection) {
    return null;
  }
  const fork = struct.fork();
  fork.Protection = struct.Protection.fork();
  fork.Protection.Strike = 0.0001; // Set Strike protection to 0 for all mobs
  return fork;
}
transformMobs.files = [
  "/BlindDog.cfg",
  "/Bloodsucker.cfg",
  "/Boar.cfg",
  "/Burer.cfg",
  "/Cat.cfg",
  "/Chimera.cfg",
  "/Controller.cfg",
  "/Deer.cfg",
  "/Flesh.cfg",
  "/MutantBase.cfg",
  "/Poltergeist.cfg",
  "/PseudoDog.cfg",
  "/Pseudogiant.cfg",
  "/Snork.cfg",
  "/Tushkan.cfg",
];
