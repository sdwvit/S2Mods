import type { QuestNodePrototype, QuestNodePrototypeToggleLairActivity } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { getLairTierNodes, getLairToggleMirrorNodes } from "./lairTierQuestNodes.mts";
import { lairToggleQuestFiles } from "./lairTiers.mts";

let once = false;

/** The LairTiers quest (from rootgraph) and mirrors of every vanilla lair toggle. */
export const transformQuestNodePrototypes: StructTransformer<QuestNodePrototype> = (struct, context) => {
  const extraStructs: QuestNodePrototype[] = [];
  if (context.filePath.endsWith("/QuestNodePrototypes/rootgraph.cfg") && !once) {
    once = true;
    extraStructs.push(...getLairTierNodes(struct.QuestSID));
  }
  if (struct.NodeType === "EQuestNodeType::ToggleLairActivity") {
    extraStructs.push(...getLairToggleMirrorNodes(struct as QuestNodePrototypeToggleLairActivity));
  }
  return extraStructs;
};

transformQuestNodePrototypes.files = [
  ...new Set([
    "/QuestNodePrototypes/rootgraph.cfg",
    ...lairToggleQuestFiles.map((f) => f.slice(f.indexOf("/QuestNodePrototypes/"))),
  ]),
];
