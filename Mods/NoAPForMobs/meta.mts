import { MutantBase } from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";
import { getTransformMobs } from "../MasterMod/transformMobs.mts";

export const meta: MetaType<MutantBase> = {
  description: `
This mode does only one thing: mobs don't wear armor![h1][/h1]
Specifically: sets Strike AP to 0 for mutants, making expansive ammo truly the best for killing them.[h1][/h1]
Meant to be used in other collections of mods.[h1][/h1]
[h1][/h1]
Compatibility: this mods does not modify any existing .cfg files, only extends mutant's object prototypes via new files.
 `,
  changenote: "Deduplicate code",
  structTransformers: [getTransformMobs(1)],
};
