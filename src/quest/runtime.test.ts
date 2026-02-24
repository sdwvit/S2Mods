import { describe, expect, it } from "vitest";
import { getRuntimeSource, RUNTIME_SOURCE } from "./runtime.mts";

describe("RUNTIME_SOURCE", () => {
  it("includes inventory simulation helpers", () => {
    expect(RUNTIME_SOURCE).toContain("const DEBUG_QUEST_JS = globalThis.DEBUG_QUEST_JS ?? true;");
    expect(RUNTIME_SOURCE).toContain('const DEBUG_QUEST_JS_LEVEL = globalThis.DEBUG_QUEST_JS_LEVEL ?? "full";');
    expect(RUNTIME_SOURCE).toContain("const DEBUG_QUEST_JS_NODE_LOGS = globalThis.DEBUG_QUEST_JS_NODE_LOGS ?? false;");
    expect(RUNTIME_SOURCE).toContain("let __questDepth = 0;");
    expect(RUNTIME_SOURCE).toContain("const __questLog = (...args) =>");
    expect(RUNTIME_SOURCE).toContain("const __questLogFull = (...args) =>");
    expect(RUNTIME_SOURCE).toContain("const __questIndent = (extra = 0) =>");
    expect(RUNTIME_SOURCE).toContain("const __questLogIndented = (message, extra = 0) =>");
    expect(RUNTIME_SOURCE).toContain("const __questLogFullIndented = (message, extra = 0) =>");
    expect(RUNTIME_SOURCE).toContain("const __questLogStub = (message) =>");
    expect(RUNTIME_SOURCE).toContain("const __questFmtArg = (arg) =>");
    expect(RUNTIME_SOURCE).toContain("const __questFmtArgs = (args) =>");
    expect(RUNTIME_SOURCE).toContain("const inventoryByActor = Object.create(null);");
    expect(RUNTIME_SOURCE).toContain("function __questAddItem(");
    expect(RUNTIME_SOURCE).toContain("function __questRemoveItem(");
    expect(RUNTIME_SOURCE).toContain("function __questIsItemInInventory(");
    expect(RUNTIME_SOURCE).toContain("function __questNodeInit(f, caller, name)");
    expect(RUNTIME_SOURCE).toContain("function __questNodeComplete(f, result)");
  });

  it("keeps waitForCallers helper", () => {
    expect(RUNTIME_SOURCE).toContain("function waitForCallers(timeout, questFn, caller)");
    expect(RUNTIME_SOURCE).toContain("intervals.push(interval);");
  });

  it("can omit optional helper functions", () => {
    const runtime = getRuntimeSource({
      includeHasQuestNodeExecuted: false,
      includeWaitForCallers: false,
    });
    expect(runtime).not.toContain("function hasQuestNodeExecuted(");
    expect(runtime).not.toContain("function waitForCallers(");
  });

  it("does not contain transpiler helper artifacts", () => {
    expect(RUNTIME_SOURCE).not.toContain("__name(");
  });

  it("routes runtime logging through __questLog", () => {
    expect(RUNTIME_SOURCE).toContain("__questLogIndented(`inventory add");
    expect(RUNTIME_SOURCE).toContain("__questLogIndented(`inventory remove");
    expect(RUNTIME_SOURCE).toContain("__questLogIndented(`isItemInInventory(");
    expect(RUNTIME_SOURCE).toContain("__questLogIndented(`hasQuestNodeExecuted(");
  });

  it("exposes full-log gating helper", () => {
    expect(RUNTIME_SOURCE).toContain('DEBUG_QUEST_JS_LEVEL === "full"');
  });

  it("prefixes stub logs with indentation", () => {
    expect(RUNTIME_SOURCE).toContain("__questLogFullIndented(message, 1);");
  });

  it("tracks node depth on init/complete", () => {
    expect(RUNTIME_SOURCE).toContain("if (DEBUG_QUEST_JS_NODE_LOGS) __questLogIndented(`// ${f.name}(${callerName}${name ? `, ${name}` : \"\"});`);");
    expect(RUNTIME_SOURCE).toContain("__questDepth += 1;");
    expect(RUNTIME_SOURCE).toContain("__questDepth = Math.max(0, __questDepth - 1);");
  });
});
