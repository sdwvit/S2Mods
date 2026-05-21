import { describe, expect, it } from "vitest";
import { Struct } from "s2cfgtojson";
import type { QuestNodePrototype } from "s2cfgtojson";
import type { MetaContext } from "../meta-type.mts";
import { buildQuestGraphData } from "./graph-data.mts";

describe("buildQuestGraphData", () => {
  it("extracts nodes, launcher edges, and bridge-event edges", () => {
    const structs = Struct.fromString<QuestNodePrototype>(`
QuestStart : struct.begin
   SID = QuestStart
   NodeType = EQuestNodeType::Technical
   LaunchOnQuestStart = true
struct.end
QuestMiddle : struct.begin
   SID = QuestMiddle
   NodeType = EQuestNodeType::Technical
   Launchers : struct.begin
      Start : struct.begin
         Connections : struct.begin
            StartOut : struct.begin
               SID = QuestStart
               Name = Start
            struct.end
         struct.end
      struct.end
   struct.end
struct.end
QuestBridge : struct.begin
   SID = QuestBridge
   NodeType = EQuestNodeType::BridgeEvent
   LinkedNodePrototypeSID = QuestMiddle
struct.end
QuestEnd : struct.begin
   SID = QuestEnd
   NodeType = EQuestNodeType::End
   Launchers : struct.begin
      Complete : struct.begin
         Connections : struct.begin
            Next : struct.begin
               SID = QuestMiddle
               Name = Done
            struct.end
         struct.end
      struct.end
   struct.end
struct.end
    `).map((struct) => struct.clone());

    const context: MetaContext<QuestNodePrototype> = {
      fileIndex: 0,
      index: 0,
      array: structs,
      extraStructs: [],
      filePath: "/QuestNodePrototypes/Test.cfg",
      fileName: "Test.cfg",
      structsById: Object.fromEntries(structs.map((struct) => [struct.__internal__.rawName, struct])),
    };

    const graph = buildQuestGraphData(context);

    expect(graph.nodeCount).toBe(4);
    expect(graph.edgeCount).toBe(3);
    expect(graph.nodes.find((node) => node.id === "QuestStart")?.isStart).toBe(true);
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "QuestStart", target: "QuestMiddle", label: "Start" }),
        expect.objectContaining({ source: "QuestMiddle", target: "QuestEnd", label: "Done" }),
        expect.objectContaining({ source: "QuestMiddle", target: "QuestBridge", label: "" }),
      ]),
    );
  });
});
