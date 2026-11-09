import fs from "node:fs";
import path from "node:path";
import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

// flushestpoem4's cfg, shipped as he made it (plus the 2.0 fixes he approved). prepare-configs wipes
// every cfg in raw/ first, so onFinish copies it back in.
const cfgName = "New_NPC_Loadouts.cfg";
const source = path.join(import.meta.dirname, "cfg", cfgName);
const target = path.join(
  import.meta.dirname,
  "raw/Stalker2/Content/GameLite/GameData/ItemGeneratorPrototypes",
  cfgName,
);

export const meta: MetaType<Struct> = {
  description: `
Better NPC Progressive Loadouts - Complete Variety[h1][/h1]
[hr][/hr]
This is an approved release of flushestpoem4's mod, built on PriestSL's BNPL (Better NPC Progressive Loadouts). All credit for the loadouts goes to them.[h1][/h1]
Version 1.1, Faction Alliances: NPC patrols get more varied, with factions sending mixed patrols and sharing gear.
[list]
[*] Loners and Bandits use each other's gear, mostly in the lower tiers.
[*] Freedom employs low and mid-tier Mercenaries.
[*] Ward, IPSF and Corps patrols can escort Ecologists, and Ecologist patrols usually include IPSF.
[*] Monolith patrols sometimes wear other factions' gear as a disguise.
[*] Duty patrols can include Ward troops before SIRCAA and IPSF troops after.
[*] Spark wears OZK Explorer suits alongside its faction gear.
[*] Every faction has its own Master-tier loadouts for more variety in the endgame.
[/list]
Not made for balance: expect an easier endgame with plenty of early gear around.
You can build your own loadouts with PriestSL's [url=https://dev.s2-loadout-creator.cc/]loadout creator[/url].
`,
  nameOverride: "BNPL Complete Variety",
  originalAuthor: "flushestpoem4",
  changenote: "Initial release.",
  structTransformers: [] as MetaType<Struct>["structTransformers"],
  onFinish() {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  },
};
