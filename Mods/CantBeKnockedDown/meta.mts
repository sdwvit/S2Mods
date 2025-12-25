import { ObjPrototype } from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<ObjPrototype> = {
  description: `
This mode does only one thing: it makes you unable to be knocked down by any NPCs, or mutants, including bosses. [h1][/h1]
Bloodsuckers won't bully you anymore.
[hr][/hr]
[list]
[*] 🤠 Because life’s too short to be tossed around like a ragdoll. 
[*] 🤠 The Zone’s worst nightmares can’t even push you into a puddle.
[*] 🤠 No More "Oh No" Moments: Because nothing says "I’m a bad ass" like standing firm while everyone else is flying *winks at patch 1.5*.
[/list]
[hr][/hr]
It is meant to be used in other collections of mods. Does not conflict with anything. It's a combo of two one-line patches: one for player and one for npcs, sets CanBeKnockedDown to false. 
  `,
  changenote: "Update for 1.7.1",
  structTransformers: [entriesTransformer],
};

function entriesTransformer(struct: ObjPrototype) {
  if (struct.SID === "NPCBase" || struct.SID === "Player") {
    return Object.assign(struct.fork(), { CanBeKnockedDown: false });
  }
}

entriesTransformer.files = ["GameData/ObjPrototypes.cfg", "ObjPrototypes/GeneralNPCObjPrototypes.cfg"];
