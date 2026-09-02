import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ModContentKind, SdkModTarget } from "./sdk-target-shape.mts";
import { sdkModTargetShape } from "./sdk-target-shape.mts";

// cook.mts shells out to wine/RunUAT and takes the SDK-wide mutation lock; both are replaced so
// the tests can assert on the *command* that would run. Everything else (path derivation, the
// cfg-only short circuit, the overrideOnly branch) is exercised for real against a temp SDK.
const execSync = vi.hoisted(() => vi.fn());
const spawnSync = vi.hoisted(() => vi.fn());
const repackMod = vi.hoisted(() => vi.fn(async () => "repacked"));
const writePackageClassifierLists = vi.hoisted(() => vi.fn(async () => ({ newPackages: [] })));
const targets = vi.hoisted(() => ({ list: [] as unknown[] }));

vi.mock("node:child_process", () => ({ default: { execSync }, execSync }));
vi.mock("child_process", () => ({ default: { execSync, spawnSync }, execSync, spawnSync }));
vi.mock("./repack.mts", () => ({ repackMod }));
vi.mock("./package-classifier.mts", () => ({ writePackageClassifierLists }));
vi.mock("./logger.mts", () => ({ logger: { log: () => {} } }));
vi.mock("./sdk-mutation-lock.mts", () => ({
  withSdkMutationLock: (_name: string, fn: () => unknown) => fn(),
}));
// base-paths reads SDK_PATH at import time; only projectRoot is used by cook.mts.
vi.mock("./base-paths.mts", () => ({ projectRoot: "/repo" }));
// mod-meta-paths cannot be imported for real here: it resolves S2_MOD and imports the selected
// mod's meta.mts at import time. Only the two values cook.mts reads are provided.
vi.mock("./mod-meta-paths.mts", () => {
  return {
    get sdkModTargets() {
      return Promise.resolve(targets.list);
    },
    get primarySdkModTarget() {
      return Promise.resolve(targets.list[0]);
    },
  };
});

let sdkPath: string;

/** A target pointing into the temp SDK, derived the way mod-meta-paths derives it. */
function target(kind: ModContentKind, name: string): SdkModTarget {
  return sdkModTargetShape(kind, name, sdkPath);
}

beforeEach(() => {
  sdkPath = fs.mkdtempSync(path.join(os.tmpdir(), "cook-test-sdk-"));
  process.env.SDK_PATH = sdkPath;
  process.env.WINE = "/wine/bin/wine";
  targets.list = [];
  execSync.mockReset();
  spawnSync.mockReset();
  repackMod.mockClear();
  writePackageClassifierLists.mockReset();
  writePackageClassifierLists.mockResolvedValue({ newPackages: [] });
});

afterEach(() => {
  fs.rmSync(sdkPath, { recursive: true, force: true });
});

const lastCmd = () => String(execSync.mock.calls.at(-1)![0]);

describe("getNTPath", () => {
  it("maps the wine drive and normalizes separators", async () => {
    const { getNTPath } = await import("./cook.mts");
    expect(getNTPath("/media/nvme/STALKER2ZoneKit/Stalker2")).toBe(
      "U:/nvme/STALKER2ZoneKit/Stalker2",
    );
    expect(getNTPath("C:\\a\\b")).toBe("C:/a/b");
    expect(getNTPath("/home/user/sdk")).toBe("/home/user/sdk");
  });
});

describe("createMod", () => {
  it("runs GSCCreatePlainMod for the given target's name", async () => {
    const { createMod } = await import("./cook.mts");
    await createMod(target("cfgs", "MasterModCfg"));

    expect(execSync).toHaveBeenCalledTimes(1);
    expect(lastCmd()).toContain("GSCCreatePlainMod");
    expect(lastCmd()).toContain("-ModName=MasterModCfg");
    expect(lastCmd()).toContain(process.env.WINE);
  });

  it("defaults to the primary target when none is given", async () => {
    targets.list = [target("assets", "MasterMod"), target("cfgs", "MasterModCfg")];
    const { createMod } = await import("./cook.mts");
    await createMod();

    expect(lastCmd()).toContain("-ModName=MasterMod");
  });
});

describe("cookMod", () => {
  /** The assets half has to exist, or cookMod creates it first and that extra call skews counts. */
  function existingAssetsTarget(name = "MasterMod") {
    const t = target("assets", name);
    fs.mkdirSync(t.modFolder, { recursive: true });
    return t;
  }

  it("repacks a cfg-only target instead of cooking it", async () => {
    const { cookMod } = await import("./cook.mts");
    const t = target("cfgs", "MasterModCfg");

    await expect(cookMod(t)).resolves.toBe("repacked");
    expect(repackMod).toHaveBeenCalledWith(t);
    expect(execSync).not.toHaveBeenCalled();
    expect(writePackageClassifierLists).not.toHaveBeenCalled();
  });

  it("runs the full GSCCookMod parent when the mod has new packages", async () => {
    writePackageClassifierLists.mockResolvedValue({ newPackages: ["/MasterMod/Foo"] });
    const { cookMod } = await import("./cook.mts");
    const t = existingAssetsTarget();
    await cookMod(t);

    const cmd = lastCmd();
    expect(cmd).toContain("GSCCookMod ");
    expect(cmd).toContain(`"-PackageClassifierOutputDir=${t.packageClassifierFolder}"`);
    expect(cmd).not.toContain("GSCCookModOverrideContent");
    expect(cmd).not.toContain("-AssetsToCookWithDLCList");
    // Mandatory on an installed build: no UnrealEditor-Cmd.exe, and RunUAT would otherwise
    // rebuild AutomationTool and the project script modules on every invocation.
    expect(cmd).toContain("Stalker2ModEditor-Win64-Shipping-Cmd.exe");
    expect(cmd).toContain("-nocompile");
    expect(cmd).toContain("-nocompileuat");
    expect(cmd).toContain(`-PluginPath=${path.join(t.modFolder, "MasterMod.uplugin")}`);
  });

  it("cooks OverrideContent only when there are no new packages", async () => {
    const { cookMod } = await import("./cook.mts");
    const t = existingAssetsTarget();
    await cookMod(t);

    const cmd = lastCmd();
    expect(cmd).toContain("GSCCookModOverrideContent");
    expect(cmd).toContain("-CustomConfig=ModCookOverrideContent");
    expect(cmd).toContain(
      `"-AssetsToCookWithDLCList=${path.join(t.packageClassifierFolder, "OverridePackages.txt")}"`,
    );
    expect(cmd).toContain(
      `"-AssetsToNeverCookWithDLCList=${path.join(t.packageClassifierFolder, "NewPackages.txt")}"`,
    );
    expect(cmd).not.toContain("-PackageClassifierOutputDir");
  });

  it("drops a NewContent tree left by an earlier full cook when cooking OverrideContent only", async () => {
    const stale = ["Cooked", "Staged"].map((dir) =>
      path.join(sdkPath, "Stalker2", "SavedMods", dir, "MasterMod", "Windows", "NewContent"),
    );
    const kept = path.join(
      sdkPath,
      "Stalker2",
      "SavedMods",
      "Staged",
      "MasterMod",
      "Windows",
      "OverrideContent",
    );
    for (const dir of [...stale, kept]) fs.mkdirSync(dir, { recursive: true });

    const { cookMod } = await import("./cook.mts");
    await cookMod(existingAssetsTarget());

    for (const dir of stale) expect(fs.existsSync(dir)).toBe(false);
    // Only the skipped pass's output is stale - the pass that does run must keep its own.
    expect(fs.existsSync(kept)).toBe(true);
  });

  it("keeps NewContent when the full parent cook runs", async () => {
    writePackageClassifierLists.mockResolvedValue({ newPackages: ["/MasterMod/Foo"] });
    const newContent = path.join(
      sdkPath,
      "Stalker2",
      "SavedMods",
      "Staged",
      "MasterMod",
      "Windows",
      "NewContent",
    );
    fs.mkdirSync(newContent, { recursive: true });

    const { cookMod } = await import("./cook.mts");
    await cookMod(existingAssetsTarget());

    expect(fs.existsSync(newContent)).toBe(true);
  });

  it("creates the SDK mod first when its folder is missing", async () => {
    const { cookMod } = await import("./cook.mts");
    await cookMod(target("assets", "BrandNewMod"));

    expect(execSync.mock.calls.map((c) => String(c[0]))).toEqual([
      expect.stringContaining("GSCCreatePlainMod"),
      expect.stringContaining("GSCCookModOverrideContent"),
    ]);
  });
});

describe("cookAllTargets", () => {
  it("drives both halves of a split mod: cook for the assets half, repack for the cfg half", async () => {
    const assets = target("assets", "MasterMod");
    fs.mkdirSync(assets.modFolder, { recursive: true });
    const cfgs = target("cfgs", "MasterModCfg");
    targets.list = [assets, cfgs];

    const { cookAllTargets } = await import("./cook.mts");
    await cookAllTargets();

    expect(execSync).toHaveBeenCalledTimes(1);
    expect(lastCmd()).toContain("-PluginPath");
    expect(lastCmd()).toContain("MasterMod.uplugin");
    expect(repackMod).toHaveBeenCalledExactlyOnceWith(cfgs);
  });
});
