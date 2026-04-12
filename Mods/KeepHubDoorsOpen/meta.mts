import { Struct } from "s2cfgtojson";
import type { QuestNodePrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<QuestNodePrototype> = {
  description: `
Keep Hub Doors Open[h1][/h1]
Prevents hub doors from closing during attacks.
[hr][/hr]
Normally when a hub is attacked, doors slam shut and lock you out (or in). This mod disables the door-closing and door-locking signals across all hubs that use them: Concrete Plant, DK Energetic, Himzavod, IKAR Camp, Noon Base, Rookie Village, Terricon, and Yanov.

The attack events still happen — NPCs still fight, the radio announcements still play — but the doors stay open.
`,
  changenote: "Also disable LockDoorReceiver nodes (e.g. Nestor's door at Slag Heap). Remove unnecessary Rostok_Radio patches.",
  structTransformers: [keepHubDoorsOpenTransformer],
};

function keepHubDoorsOpenTransformer(struct: QuestNodePrototype) {
  if (struct.__internal__.rawName.includes("CloseDoorReceiver") ||
      struct.__internal__.rawName.includes("LockDoorReceiver")) {
    const fork = struct.fork();
    fork.Launchers = new Struct() as any;
    return fork;
  }
}

keepHubDoorsOpenTransformer.files = [
  "/QuestNodePrototypes/ConcretePlant_Hub.cfg",
  "/QuestNodePrototypes/DKEnergetic_Hub.cfg",
  "/QuestNodePrototypes/Himzavod_Hub.cfg",
  "/QuestNodePrototypes/IKARCamp_Hub.cfg",
  "/QuestNodePrototypes/NoonBase_Hub.cfg",
  "/QuestNodePrototypes/RookieVillage_Hub.cfg",
  "/QuestNodePrototypes/Terricon_Hub.cfg",
  "/QuestNodePrototypes/Yanov_Hub.cfg",
];

