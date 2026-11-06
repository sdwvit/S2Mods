import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformMarkerPrototypes } from "./transformMarkerPrototypes.mts";
import { transformSpawnActorPrototypes } from "./transformSpawnActorPrototypes.mts";
import { transformQuestNodePrototypes } from "./transformQuestNodePrototypes.mts";
import { transformQuestPrototypes } from "./transformQuestPrototypes.mts";

export const meta: MetaType<Struct> = {
  description: `
Test mod: map markers on every lair in the Zone, named after the faction holding it.[h1][/h1]
[hr][/hr]
[list]
[*] A squad leader map marker on every lair in the Zone.
[*] Every few minutes each marker is renamed after the faction holding its lair.
[/list]
`,
  changenote: "Initial release.",
  structTransformers: [
    transformMarkerPrototypes,
    transformSpawnActorPrototypes,
    transformQuestPrototypes,
    transformQuestNodePrototypes,
  ] as MetaType<Struct>["structTransformers"],
};
