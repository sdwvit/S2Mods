import { describe, expect, it } from "vitest";
import {
  isRecentQuestNodesJsDebugOutput,
  renderQuestJsGlobalFunctionStub,
  resolveQuestNodesToJsInputPath,
  shouldSkipRecentQuestNodesJsDebugRegeneration,
} from "./quest/js-gen-utils.mts";

describe("renderQuestJsGlobalFunctionStub", () => {
  it("renders inventory-aware ItemAdd stub", () => {
    const out = renderQuestJsGlobalFunctionStub("ItemAdd", "");
    expect(out).toContain("const ItemAdd = (...args) =>");
    expect(out).toContain("\n  const [actor, itemSid, count = 1] = args;\n");
    expect(out).toContain("__questAddItem(itemSid, count, actor)");
    expect(out).toContain("__questLogStub(`ItemAdd(${__questFmtArgs(args)})`);");
    expect(out.endsWith("};")).toBe(true);
  });

  it("renders inventory-aware ItemRemove stub", () => {
    const out = renderQuestJsGlobalFunctionStub("ItemRemove", "");
    expect(out).toContain("const ItemRemove = (...args) =>");
    expect(out).toContain("\n  const [actor, itemSid, count = 1] = args;\n");
    expect(out).toContain("__questRemoveItem(itemSid, count, actor)");
    expect(out).toContain("__questLogStub(`ItemRemove(${__questFmtArgs(args)})`);");
    expect(out.endsWith("};")).toBe(true);
  });

  it("renders inventory-aware isItemInInventory stub", () => {
    const out = renderQuestJsGlobalFunctionStub("isItemInInventory", "");
    expect(out).toContain("const isItemInInventory = (itemSid, count = 1)");
    expect(out).toContain("__questIsItemInInventory(itemSid, count, 'Skif')");
  });

  it("prefers provided implementation for non-special globals", () => {
    const out = renderQuestJsGlobalFunctionStub("FooBar", "() => 42;");
    expect(out).toBe("const FooBar = () => 42;");
  });

  it("creates logging stub for generic globals without implementation", () => {
    const out = renderQuestJsGlobalFunctionStub("ShowFadeScreen", "");
    expect(out).toContain("const ShowFadeScreen = (...args) =>");
    expect(out).toContain("\n  __questLogStub(");
    expect(out).toContain("return 'ShowFadeScreen';");
    expect(out.endsWith("};")).toBe(true);
  });
});

describe("resolveQuestNodesToJsInputPath", () => {
  const cfgRoot = "/sdk/Stalker2/Content/GameLite";

  it("supports absolute filesystem paths and derives context path from /GameData/", () => {
    const out = resolveQuestNodesToJsInputPath(
      "/repo/Mods/DecoupledRanks/raw/Stalker2/Content/GameLite/GameData/QuestNodePrototypes/Arch_L/Arch_L_patch_DecoupledRanks.cfg",
      cfgRoot,
    );
    expect(out.contextFilePath).toBe("/QuestNodePrototypes/Arch_L/Arch_L_patch_DecoupledRanks.cfg");
    expect(out.sourceFilePath).toBe(
      "/repo/Mods/DecoupledRanks/raw/Stalker2/Content/GameLite/GameData/QuestNodePrototypes/Arch_L/Arch_L_patch_DecoupledRanks.cfg",
    );
    expect(out.outputFilePath).toBe(
      "/repo/Mods/DecoupledRanks/raw/Stalker2/Content/GameLite/GameData/QuestNodePrototypes/Arch_L/Arch_L_patch_DecoupledRanks.cfg.js",
    );
  });

  it("supports /QuestNodePrototypes/... game-data relative paths", () => {
    const out = resolveQuestNodesToJsInputPath("/QuestNodePrototypes/Arch_L.cfg", cfgRoot);
    expect(out.contextFilePath).toBe("/QuestNodePrototypes/Arch_L.cfg");
    expect(out.sourceFilePath).toBe("/sdk/Stalker2/Content/GameLite/GameData/QuestNodePrototypes/Arch_L.cfg");
  });

  it("supports /GameData/... paths", () => {
    const out = resolveQuestNodesToJsInputPath("/GameData/QuestNodePrototypes/Arch_L.cfg", cfgRoot);
    expect(out.contextFilePath).toBe("/QuestNodePrototypes/Arch_L.cfg");
    expect(out.sourceFilePath).toBe("/sdk/Stalker2/Content/GameLite/GameData/QuestNodePrototypes/Arch_L.cfg");
  });

  it("supports GameData/... paths", () => {
    const out = resolveQuestNodesToJsInputPath("GameData/QuestNodePrototypes/Arch_L.cfg", cfgRoot);
    expect(out.contextFilePath).toBe("/QuestNodePrototypes/Arch_L.cfg");
    expect(out.sourceFilePath).toBe("/sdk/Stalker2/Content/GameLite/GameData/QuestNodePrototypes/Arch_L.cfg");
  });

  it("supports SDK GameLite relative paths", () => {
    const out = resolveQuestNodesToJsInputPath("Stalker2/Content/GameLite/GameData/QuestNodePrototypes/Arch_L.cfg", cfgRoot);
    expect(out.contextFilePath).toBe("/QuestNodePrototypes/Arch_L.cfg");
    expect(out.sourceFilePath).toBe("/sdk/Stalker2/Content/GameLite/GameData/QuestNodePrototypes/Arch_L.cfg");
  });

  it("supports bare QuestNodePrototypes/... paths", () => {
    const out = resolveQuestNodesToJsInputPath("QuestNodePrototypes/Arch_L.cfg", cfgRoot);
    expect(out.contextFilePath).toBe("/QuestNodePrototypes/Arch_L.cfg");
    expect(out.sourceFilePath).toBe("/sdk/Stalker2/Content/GameLite/GameData/QuestNodePrototypes/Arch_L.cfg");
  });

  it("supports bare file names by assuming QuestNodePrototypes/", () => {
    const out = resolveQuestNodesToJsInputPath("Arch_L.cfg", cfgRoot);
    expect(out.contextFilePath).toBe("/QuestNodePrototypes/Arch_L.cfg");
    expect(out.sourceFilePath).toBe("/sdk/Stalker2/Content/GameLite/GameData/QuestNodePrototypes/Arch_L.cfg");
  });

  it("normalizes Windows-style separators", () => {
    const out = resolveQuestNodesToJsInputPath("GameData\\QuestNodePrototypes\\Arch_L.cfg", cfgRoot);
    expect(out.contextFilePath).toBe("/QuestNodePrototypes/Arch_L.cfg");
    expect(out.sourceFilePath).toBe("/sdk/Stalker2/Content/GameLite/GameData/QuestNodePrototypes/Arch_L.cfg");
  });
});

describe("quest nodes js debug regeneration guard", () => {
  it("skips recent outputs by default", () => {
    expect(shouldSkipRecentQuestNodesJsDebugRegeneration()).toBe(true);
  });

  it("can be disabled with env value 0", () => {
    expect(shouldSkipRecentQuestNodesJsDebugRegeneration("0")).toBe(false);
  });

  it("does not treat missing output as recent", async () => {
    expect(await isRecentQuestNodesJsDebugOutput("/definitely/missing/file.js")).toBe(false);
  });
});
