import { MutantBase } from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<MutantBase> = {
  description: `
This mode does only one thing: mobs don't wear armor![h1][/h1]
Specifically: sets Strike AP to 0 for mutants, making expansive ammo truly the best for killing them.[h1][/h1]
Meant to be used in other collections of mods.[h1][/h1]
[h1][/h1]
Compatibility: this mods does not modify any existing .cfg files, only extends mutant's object prototypes via new files.
 `,
  changenote: "Deduplicate code",
  structTransformers: [transformMobs],
};

/**
 * Sets bullet (Strike) protection to 0 for all mobs and .
 */
async function transformMobs(struct: MutantBase) {
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
