import { describe, expect, it } from "vitest";
import { renderBooleanComparison, renderConditionResultBlock, shouldDeclareResultVar } from "./codegen.mts";

describe("renderBooleanComparison", () => {
  it("keeps positive boolean comparisons as direct expressions", () => {
    expect(renderBooleanComparison("isItemInInventory(Foo, 1)", ">=")).toBe("isItemInInventory(Foo, 1)");
    expect(renderBooleanComparison("wasTriggered()", "===")).toBe("wasTriggered()");
  });

  it("simplifies negative boolean comparisons to negation", () => {
    expect(renderBooleanComparison("isItemInInventory(Foo, 1)", "<")).toBe("!(isItemInInventory(Foo, 1))");
    expect(renderBooleanComparison("hasNote('x')", "!==")).toBe("!(hasNote('x'))");
    expect(renderBooleanComparison("isOnline()", "<=")).toBe("!(isOnline())");
  });

  it("falls back to explicit comparison for unknown operators", () => {
    expect(renderBooleanComparison("foo()", "??")).toBe("foo() ?? true");
  });
});

describe("renderConditionResultBlock", () => {
  it("formats Condition node result without spacing artifacts", () => {
    expect(renderConditionResultBlock("isItemInInventory(Foo, 1) ", false)).toBe("result = isItemInInventory(Foo, 1);\nif (!result) return;");
  });

  it("formats If node result as a single statement", () => {
    expect(renderConditionResultBlock(" foo() && bar() ", true)).toBe("result = foo() && bar();");
  });
});

describe("shouldDeclareResultVar", () => {
  it("returns true when node body references result", () => {
    expect(shouldDeclareResultVar("result = foo();", false)).toBe(true);
    expect(shouldDeclareResultVar("if (!result) return;", false)).toBe(true);
  });

  it("returns true when launches branch on result", () => {
    expect(shouldDeclareResultVar("ShowFadeScreen();", true)).toBe(true);
  });

  it("returns false for simple action nodes without result usage", () => {
    expect(shouldDeclareResultVar("ItemAdd(x, 1);", false)).toBe(false);
  });
});
