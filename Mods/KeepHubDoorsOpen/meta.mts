import { Struct } from "s2cfgtojson";
import type { QuestNodePrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<QuestNodePrototype> = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
Keep Hub Doors Open[h1][/h1]
Prevents hub doors from closing during attacks.
[hr][/hr]
Normally when a hub is attacked, doors slam shut and lock you out (or in). This mod disables the door-closing and door-locking signals across all hubs that use them: Concrete Plant, DK Energetic, Himzavod, IKAR Camp, Noon Base, Rookie Village, Terricon, and Yanov.

The attack events still happen — NPCs still fight, the radio announcements still play — but the doors stay open.

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
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

