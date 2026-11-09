import { Struct, type ObjPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<ObjPrototype> = {
  description: `
This mode does only one thing: mobs don't wear armor![h1][/h1]
Specifically: sets Strike AP to 0 for mutants, making expansive ammo truly the best for killing them.[h1][/h1]
Meant to be used in other collections of mods.[h1][/h1]
[h1][/h1]
Compatibility: this mods does not modify any existing .cfg files, only extends mutant's object prototypes via new files.
 
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Every mutant variant now has zero bullet armor too, including the ones that inherit it from another mutant.",
  structTransformers: [transformMobs],
};

/**
 * Sets bullet (Strike) protection to ~0 on every mutant prototype. Children that inherit Protection
 * (Poltergeist_Fire from Poltergeist_Electro, Bayun_Collar, MistBloodsucker...) keep their parent's vanilla value
 * when only the parent is bpatched, so every struct in the mutant files gets its own bpatch.
 */
async function transformMobs(struct: ObjPrototype) {
  const fork = struct.fork();
  fork.__internal__.bpatch = true;
  fork.Protection = new Struct({ Strike: STRIKE }) as ObjPrototype["Protection"];
  fork.Protection.__internal__.bpatch = true;
  return fork;
}
const STRIKE = 0.0001;
transformMobs.files = [
  "/AshyBloodsucker.cfg",
  "/BlindDog.cfg",
  "/Bloodsucker.cfg",
  "/Boar.cfg",
  "/BoggyFlesh.cfg",
  "/Burer.cfg",
  "/Cat.cfg",
  "/Chimera.cfg",
  "/Controller.cfg",
  "/Deer.cfg",
  "/Flesh.cfg",
  "/HelmedBoar.cfg",
  "/MoldyBlindDog.cfg",
  "/MutantBase.cfg",
  "/Poltergeist.cfg",
  "/PorcupineBoar.cfg",
  "/PrologueBloodsucker.cfg",
  "/PseudoDog.cfg",
  "/Pseudogiant.cfg",
  "/RatSwarm.cfg",
  "/Snork.cfg",
  "/Tushkan.cfg",
];
