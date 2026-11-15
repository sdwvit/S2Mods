import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformPassiveDetectorPrototypes } from "./transformPassiveDetectorPrototypes.mts";

export const meta: MetaType<Struct> = {
  description: `
Makes the razor anomaly easier to spot from a distance, and detectors now beep near it.
`,
  changenote: "Detectors now beep near the razor anomaly.",
  structTransformers: [transformPassiveDetectorPrototypes] as MetaType<Struct>["structTransformers"],
};
