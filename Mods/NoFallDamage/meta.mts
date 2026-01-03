import { ObjPrototype, Struct } from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<ObjPrototype> = {
  structTransformers: [entriesTransformer],
  description: ` 
  This mode does only one thing: Eliminates all damage from falling at any height. [h1][/h1]
[hr][/hr]
[list]
[*] This mod is here to save you from the soul-crushing horror of fall damage. 
[*] It’s the perfect balance of “I’m too old for this schite” and “I just want to explore without crying.”
[*] Now you can leap off cliffs, drop into radioactive sewers, or just… y’know, accidentally walk into a wall at 100 mph - and emerge completely unscathed.
[*] No more “Oh no, I died because I tried to be a ninja” moments. No more grinding through 20 minutes of gameplay only to fall off a ladder and get a 10/10 on the “I Hate My Life” scale.
[/list] 
[hr][/hr]
It is meant to be used in other collections of mods. [h1][/h1]
I consider this mod to be a bit cheaty, and/or useful for debugging other mods.
  `,
  changenote: "Fixed bug with property IDs",
};

function entriesTransformer(struct: ObjPrototype) {
  if (struct.SID === "NPCBase" || struct.SID === "Player") {
    const fork = struct.fork();
    fork.Protection = new Struct() as ObjPrototype["Protection"];
    fork.Protection.__internal__.bpatch = true;
    fork.Protection.Fall = 100;
    return fork;
  }
}

entriesTransformer.files = ["GameData/ObjPrototypes.cfg", "ObjPrototypes/GeneralNPCObjPrototypes.cfg"];
