import type { MetaContext, MetaType } from "../../src/meta-type.mts";
import type { QuestNodePrototype } from "s2cfgtojson";
import { rerouteQuestNode } from "../../src/struct-utils.mts";

export const meta: MetaType<QuestNodePrototype> = {
  description: `
Side Quest Keep Bodies
[hr][/hr]
Prevents kill/eliminate quest targets from despawning on quest completion.[h1][/h1]
Affected quests: Kill Zombies, Kill Mutants, Kill Bandits, Kill Stalkers, Eliminate Squad — all vendors.[h1][/h1]
Now you can loot the bodies after completing the quest.[h1][/h1]

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Updated for 2.0: patches regenerated against 2.0 game data. Cover all vendor kill quests (Sidorovich, Rostok Barmen, Malahit, Harpy).",
  structTransformers: [structTransformer],
};

let toReroute: Set<string> | undefined;
let lastFilePath: string | undefined;

function structTransformer(struct: QuestNodePrototype, context: MetaContext<QuestNodePrototype>) {
  if (lastFilePath !== context.filePath) {
    lastFilePath = context.filePath;
    toReroute = new Set(
      context.array.filter((s) => s.NodeType === "EQuestNodeType::Despawn").map((s) => s.SID),
    );
  }

  if (toReroute!.has(struct.SID)) {
    return rerouteQuestNode(struct, context, toReroute!);
  }
}

structTransformer.files = [
  // Sidorovich
  "/QuestNodePrototypes/RSQ06_C01___K_Z.cfg",
  "/QuestNodePrototypes/RSQ06_C02___K_M.cfg",
  "/QuestNodePrototypes/RSQ06_C03___K_B.cfg",
  "/QuestNodePrototypes/RSQ06_C04___K_S.cfg",
  // Tsemzavod Barmen
  "/QuestNodePrototypes/RSQ07_C01_K_Z.cfg",
  "/QuestNodePrototypes/RSQ07_C02_K_M.cfg",
  "/QuestNodePrototypes/RSQ07_C03_K_M.cfg",
  "/QuestNodePrototypes/RSQ07_C04_K_B.cfg",
  "/QuestNodePrototypes/RSQ07_C09_S_P.cfg",
  // Rostok Barmen
  "/QuestNodePrototypes/RSQ08_C01_K_M.cfg",
  "/QuestNodePrototypes/RSQ08_C02_K_B.cfg",
  "/QuestNodePrototypes/RSQ08_C03_K_S.cfg",
  // Malahit
  "/QuestNodePrototypes/RSQ09_C01_K_M.cfg",
  "/QuestNodePrototypes/RSQ09_C02_K_M.cfg",
  "/QuestNodePrototypes/RSQ09_C03_K_M.cfg",
  "/QuestNodePrototypes/RSQ09_C04_K_S.cfg",
  // Harpy
  "/QuestNodePrototypes/RSQ10_C01_K_M.cfg",
  "/QuestNodePrototypes/RSQ10_C02_K_M.cfg",
  "/QuestNodePrototypes/RSQ10_C03_K_S.cfg",
  "/QuestNodePrototypes/RSQ10_C04_K_S.cfg",
];
