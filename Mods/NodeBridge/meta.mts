import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType = {
  description: `
NodeBridge — runs Node.js code inside Stalker 2.
[hr][/hr]
A proxy DLL (takes the dwmapi.dll slot) that loads into the game process, spawns bundled node.exe, and routes RPC between the game and per-mod JS entry points.[h1][/h1]
This mod is the carrier for the bridge runtime. Author your JS in Mods/<YourMod>/nodebridge/main.mjs.[h1][/h1]
[hr][/hr]
Not compatible with UE4SS (same DLL slot).
`,
  changenote: "Initial release",
  structTransformers: [],
};
