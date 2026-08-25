import type { ObjPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<ObjPrototype> = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
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
  
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Update for 1.8.1",
  structTransformers: [entriesTransformer],
};

function entriesTransformer(struct: ObjPrototype) {
  if (struct.SID === "NPCBase" || struct.SID === "Player") {
    const fork = struct.fork();
    fork.CanBeKnockedDown = false;
    return fork;
  }
}

entriesTransformer.files = ["GameData/ObjPrototypes.cfg", "ObjPrototypes/GeneralNPCObjPrototypes.cfg"];
