import { describe, expect, it } from "vitest";
import { Struct } from "s2cfgtojson";
import type { QuestNodePrototype } from "s2cfgtojson";
import type { MetaContext } from "../../src/meta-type.mts";
import { getLaunchers } from "../../src/struct-utils.mts";
import { meta } from "./meta.mts";

const structTransformer = meta.structTransformers[0];

/**
 * Build a QuestNodePrototype with the given SID and optional launcher connection groups.
 * Each inner array is one launcher item containing connections to those SIDs.
 */
function makeNode(sid: string, connectionGroups?: string[][]): QuestNodePrototype {
  const node = new Struct() as any as QuestNodePrototype;
  node.SID = sid;
  if (connectionGroups) {
    node.Launchers = getLaunchers(
      connectionGroups.map((group) =>
        group.map((csid) => ({ SID: csid, Name: "" })),
      ),
    );
  }
  return node;
}

function makeContext(
  nodes: QuestNodePrototype[],
  filePath = "/QuestNodePrototypes/E01_MQ01.cfg",
): MetaContext<QuestNodePrototype> {
  return {
    fileIndex: 0,
    index: 0,
    array: nodes,
    extraStructs: [],
    filePath,
    structsById: Object.fromEntries(nodes.map((n) => [n.SID, n])),
  };
}

/** Extract connection SIDs from a result struct's Launchers */
function getAddedConnectionSIDs(struct: QuestNodePrototype): string[][] {
  const groups: string[][] = [];
  struct.Launchers?.forEach?.(([, launcher]) => {
    const sids: string[] = [];
    launcher.Connections.forEach(([, c]) => sids.push(c.SID));
    groups.push(sids);
  });
  return groups;
}

describe("SkipLesserZoneCutscenes reroute", () => {
  it("returns undefined for non-reroute node", () => {
    const node = makeNode("SomeRandomNode", [["Target"]]);
    const ctx = makeContext([node]);
    const result = structTransformer(node, ctx);
    expect(result).toBeUndefined();
  });

  it("returns undefined for toReroute node without Launchers", () => {
    const node = makeNode("E01_MQ01_PlayVideo");
    const ctx = makeContext([node]);
    const result = structTransformer(node, ctx);
    expect(result).toBeUndefined();
  });

  it("reroutes a simple node: dependant gets the launchers", () => {
    const nodeA = makeNode("E01_MQ01_PlayVideo", [["NodeTarget"]]);
    const nodeTarget = makeNode("NodeTarget");
    const nodeC = makeNode("NodeC", [["E01_MQ01_PlayVideo"]]);
    const ctx = makeContext([nodeA, nodeTarget, nodeC]);

    const result = structTransformer(nodeA, ctx) as Struct[];

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);

    // First: forked A with empty Launchers
    const forkedA = result[0] as any as QuestNodePrototype;
    expect(forkedA.Launchers.entries()).toHaveLength(0);

    // Second: forked C with A's launcher (connection to NodeTarget) added
    const forkedC = result[1] as any as QuestNodePrototype;
    const connections = getAddedConnectionSIDs(forkedC);
    expect(connections).toContainEqual(["NodeTarget"]);
  });

  it("expands through chain when dependant is also in toReroute", () => {
    // A (toReroute) launches to FinalTarget
    // B (toReroute) depends on A (has launcher connection to A)
    // C (not in toReroute) depends on B
    // Result: C should get A's launchers (to FinalTarget)
    const nodeA = makeNode("E01_MQ01_PlayVideo", [["FinalTarget"]]);
    const nodeB = makeNode("E01_MQ01_SetItemGenerator_Player_Empty", [
      ["E01_MQ01_PlayVideo"],
    ]);
    const nodeC = makeNode("NodeC", [["E01_MQ01_SetItemGenerator_Player_Empty"]]);
    const finalTarget = makeNode("FinalTarget");
    const ctx = makeContext([nodeA, nodeB, nodeC, finalTarget]);

    const result = structTransformer(nodeA, ctx) as Struct[];

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);

    // First: forked A with empty Launchers
    expect((result[0] as any).Launchers.entries()).toHaveLength(0);

    // Second: forked C with A's launcher to FinalTarget
    const forkedC = result[1] as any as QuestNodePrototype;
    const connections = getAddedConnectionSIDs(forkedC);
    expect(connections).toContainEqual(["FinalTarget"]);
  });

  it("skips launcher entirely when all connections are to toReroute nodes", () => {
    // A has two launchers:
    // Launcher 0: only connects to another toReroute node (all filtered)
    // Launcher 1: connects to NodeTarget (kept)
    const nodeA = makeNode("E01_MQ01_PlayVideo", [
      ["E01_MQ01_Cutscene_Napadenie"],
      ["NodeTarget"],
    ]);
    const nodeCutscene = makeNode("E01_MQ01_Cutscene_Napadenie");
    const nodeTarget = makeNode("NodeTarget");
    const nodeC = makeNode("NodeC", [["E01_MQ01_PlayVideo"]]);
    const ctx = makeContext([nodeA, nodeCutscene, nodeTarget, nodeC]);

    const result = structTransformer(nodeA, ctx) as Struct[];

    expect(Array.isArray(result)).toBe(true);
    const forkedC = result[1] as any as QuestNodePrototype;
    const connections = getAddedConnectionSIDs(forkedC);
    // Only the launcher with NodeTarget should be added
    expect(connections).toHaveLength(1);
    expect(connections[0]).toEqual(["NodeTarget"]);
  });

  it("does not reroute to structs that are themselves in toReroute", () => {
    // A launches to both a toReroute node (B) and a safe node (NodeTarget)
    // B is a real struct present in the context and also in toReroute
    // C depends on A
    // → C must only get connection to NodeTarget, never to B
    const nodeA = makeNode("E01_MQ01_PlayVideo", [
      ["E01_MQ01_Cutscene_Napadenie", "E01_MQ01_SetItemGenerator_Player_Empty", "NodeTarget"],
    ]);
    const nodeB = makeNode("E01_MQ01_Cutscene_Napadenie", [["SomeDownstream"]]);
    const nodeB2 = makeNode("E01_MQ01_SetItemGenerator_Player_Empty", [["OtherDownstream"]]);
    const nodeTarget = makeNode("NodeTarget");
    const nodeC = makeNode("NodeC", [["E01_MQ01_PlayVideo"]]);
    const ctx = makeContext([nodeA, nodeB, nodeB2, nodeTarget, nodeC]);

    const result = structTransformer(nodeA, ctx) as Struct[];

    expect(Array.isArray(result)).toBe(true);
    const allConnectionSIDs = (result.slice(1) as any as QuestNodePrototype[]).flatMap((s) =>
      getAddedConnectionSIDs(s).flat(),
    );
    expect(allConnectionSIDs).toContain("NodeTarget");
    expect(allConnectionSIDs).not.toContain("E01_MQ01_Cutscene_Napadenie");
    expect(allConnectionSIDs).not.toContain("E01_MQ01_SetItemGenerator_Player_Empty");
  });

  it("handles multiple dependants", () => {
    const nodeA = makeNode("E01_MQ01_PlayVideo", [["NodeTarget"]]);
    const nodeTarget = makeNode("NodeTarget");
    const nodeC = makeNode("NodeC", [["E01_MQ01_PlayVideo"]]);
    const nodeD = makeNode("NodeD", [["E01_MQ01_PlayVideo"]]);
    const ctx = makeContext([nodeA, nodeTarget, nodeC, nodeD]);

    const result = structTransformer(nodeA, ctx) as Struct[];

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3); // forked A + forked C + forked D

    // Both dependants get A's launcher
    const forkedC = result[1] as any as QuestNodePrototype;
    const forkedD = result[2] as any as QuestNodePrototype;
    expect(getAddedConnectionSIDs(forkedC)).toContainEqual(["NodeTarget"]);
    expect(getAddedConnectionSIDs(forkedD)).toContainEqual(["NodeTarget"]);
  });
});
