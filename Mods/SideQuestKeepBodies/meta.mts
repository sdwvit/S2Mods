import type { MetaContext, MetaType } from "../../src/meta-type.mts";
import type { QuestNodePrototype } from "s2cfgtojson";
import { rerouteQuestNode } from "../../src/struct-utils.mts";

export const meta: MetaType<QuestNodePrototype> = {
  description: `
Side Quest Keep Bodies
[hr][/hr]
Prevents kill/eliminate quest targets from despawning on quest completion.[h1][/h1]
Affected quests: Kill Zombies, Kill Mutants, Kill Bandits, Eliminate Squad.[h1][/h1]
Now you can loot the bodies after completing the quest.[h1][/h1]
`,
  changenote: "Prevent explicit ForceDespawn nodes from running.",
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
  "/QuestNodePrototypes/RSQ07_C01_K_Z.cfg",
  "/QuestNodePrototypes/RSQ07_C02_K_M.cfg",
  "/QuestNodePrototypes/RSQ07_C03_K_M.cfg",
  "/QuestNodePrototypes/RSQ07_C04_K_B.cfg",
  "/QuestNodePrototypes/RSQ07_C09_S_P.cfg",
];
