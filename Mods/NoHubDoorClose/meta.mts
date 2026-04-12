import { Struct } from "s2cfgtojson";
import type { QuestNodePrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<QuestNodePrototype> = {
  description: `
No Hub Door Close[h1][/h1]
Prevents hub doors from closing during attacks.
[hr][/hr]
Normally when a hub is attacked, doors slam shut and lock you out (or in). This mod disables the door-closing signals across all hubs that use them: Concrete Plant, DK Energetic, Himzavod, IKAR Camp, Noon Base, Rookie Village, Terricon, and Yanov.

The attack events still happen — NPCs still fight, the radio announcements still play — but the doors stay open.
`,
  changenote: "Initial release",
  structTransformers: [noHubDoorCloseTransformer],
};

function noHubDoorCloseTransformer(struct: QuestNodePrototype) {
  if (struct.__internal__.rawName.includes("CloseDoorReceiver")) {
    const fork = struct.fork();
    fork.Launchers = new Struct() as any;
    return fork;
  }
}

noHubDoorCloseTransformer.files = ["/QuestNodePrototypes/"];
noHubDoorCloseTransformer.contains = true;
noHubDoorCloseTransformer.contents = ["CloseDoorReceiver"];
