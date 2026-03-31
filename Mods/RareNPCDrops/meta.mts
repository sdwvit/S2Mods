import type { ItemGeneratorPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformItemGenerators } from "./transformItemGenerators.mts";

export const meta: MetaType<ItemGeneratorPrototype> = {
  description: `Adds a tiny chance for detectors and artifacts to drop from NPC corpses.
    [h2][/h2]
    Detector drop chances:[h2][/h2]
    [list]
    [*] Echo: 1/100
    [*] Gilka: 1/1,000
    [*] Bear: 1/10,000
    [*] Veles: 1/100,000
    [/list]
    [h2][/h2]
    Artifacts also have a tiny chance to drop, scaling logarithmically by their cost (cheaper artifacts drop more often).
  `,
  changenote: "Initial release",
  structTransformers: [transformItemGenerators],
};
