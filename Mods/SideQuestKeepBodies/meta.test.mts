import { describe, expect, it } from "vitest";
import { Struct } from "s2cfgtojson";
import type { QuestNodePrototype } from "s2cfgtojson";
import type { MetaContext } from "../../src/meta-type.mts";
import { getLaunchers } from "../../src/struct-utils.mts";
import { meta } from "./meta.mts";

const structTransformer = meta.structTransformers[0];

function makeNode(
  sid: string,
  nodeType: string,
  connectionGroups?: string[][],
): QuestNodePrototype {
  const node = new Struct() as any as QuestNodePrototype;
  node.SID = sid;
  node.NodeType = nodeType as any;
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
  filePath: string,
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

function getConnectionSIDs(struct: QuestNodePrototype): string[][] {
  const groups: string[][] = [];
  struct.Launchers?.forEach?.(([, launcher]) => {
    const sids: string[] = [];
    launcher.Connections.forEach(([, c]) => sids.push(c.SID));
    groups.push(sids);
  });
  return groups;
}

describe("SideQuestKeepBodies", () => {
  // Simulate: PreTech → Despawn_A, Despawn_B → PostTech → Finish
  // Launchers = incoming connections, so:
  // Despawn_A.Launchers = [{SID: PreTech}]
  // Despawn_B.Launchers = [{SID: PreTech}]
  // PostTech.Launchers = [{SID: Despawn_A}, {SID: Despawn_B}]
  function buildQuestGraph(filePath: string) {
    const preTech = makeNode("Q_Technical_24", "EQuestNodeType::Technical", [["Q_Finish"]]);
    const despawnA = makeNode("Q_Despawn_A", "EQuestNodeType::Despawn", [["Q_Technical_24"]]);
    const despawnB = makeNode("Q_Despawn_B", "EQuestNodeType::Despawn", [["Q_Technical_24"]]);
    const postTech = makeNode("Q_Technical_25", "EQuestNodeType::Technical", [
      ["Q_Despawn_A"],
      ["Q_Despawn_B"],
    ]);
    const finish = makeNode("Q_Finish", "EQuestNodeType::SetJournal", [["Q_Technical_25"]]);
    return makeContext([preTech, despawnA, despawnB, postTech, finish], filePath);
  }

  it("strips Launchers from Despawn nodes", () => {
    const ctx = buildQuestGraph("/QuestNodePrototypes/RSQ07_C02_K_M.cfg");
    const despawnA = ctx.structsById["Q_Despawn_A"];

    const result = structTransformer(despawnA, ctx) as Struct[];

    expect(Array.isArray(result)).toBe(true);
    // First element is the forked despawn with empty Launchers
    const forkedDespawn = result[0] as any as QuestNodePrototype;
    expect(forkedDespawn.Launchers.entries()).toHaveLength(0);
  });

  it("rewires post-despawn Technical to get pre-despawn Technical's launchers", () => {
    const ctx = buildQuestGraph("/QuestNodePrototypes/RSQ07_C02_K_M.cfg");
    const despawnA = ctx.structsById["Q_Despawn_A"];

    const result = structTransformer(despawnA, ctx) as Struct[];

    expect(Array.isArray(result)).toBe(true);
    // Result includes forked despawnA + forked postTech (dependant)
    expect(result.length).toBeGreaterThanOrEqual(2);

    // The dependant (postTech) should get despawnA's launcher connections (to Q_Technical_24)
    const forkedPostTech = result[1] as any as QuestNodePrototype;
    const connections = getConnectionSIDs(forkedPostTech);
    const allSids = connections.flat();
    expect(allSids).toContain("Q_Technical_24");
  });

  it("preserves downstream flow: Finish is not modified", () => {
    const ctx = buildQuestGraph("/QuestNodePrototypes/RSQ07_C02_K_M.cfg");

    // Process both despawn nodes
    structTransformer(ctx.structsById["Q_Despawn_A"], ctx);
    structTransformer(ctx.structsById["Q_Despawn_B"], ctx);

    // Finish node should not be modified (it depends on PostTech, not Despawn)
    const finishResult = structTransformer(ctx.structsById["Q_Finish"], ctx);
    expect(finishResult).toBeUndefined();
  });

  it("does not touch non-Despawn nodes", () => {
    const ctx = buildQuestGraph("/QuestNodePrototypes/RSQ07_C02_K_M.cfg");
    const preTech = ctx.structsById["Q_Technical_24"];

    const result = structTransformer(preTech, ctx);
    expect(result).toBeUndefined();
  });

  it("does nothing for C09 (no Despawn nodes)", () => {
    const start = makeNode("RSQ07_C09_S_P_Start", "EQuestNodeType::Technical");
    const end = makeNode("RSQ07_C09_S_P_End", "EQuestNodeType::End", [["RSQ07_C09_S_P_Start"]]);
    const ctx = makeContext([start, end], "/QuestNodePrototypes/RSQ07_C09_S_P.cfg");

    expect(structTransformer(start, ctx)).toBeUndefined();
    expect(structTransformer(end, ctx)).toBeUndefined();
  });

  it("handles different files independently", () => {
    const ctx1 = buildQuestGraph("/QuestNodePrototypes/RSQ07_C01_K_Z.cfg");
    const ctx2 = buildQuestGraph("/QuestNodePrototypes/RSQ07_C02_K_M.cfg");

    const result1 = structTransformer(ctx1.structsById["Q_Despawn_A"], ctx1) as Struct[];
    expect(Array.isArray(result1)).toBe(true);

    const result2 = structTransformer(ctx2.structsById["Q_Despawn_A"], ctx2) as Struct[];
    expect(Array.isArray(result2)).toBe(true);
  });
});
