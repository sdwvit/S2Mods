import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { sdkModTargetShape, type ModContentKind, type SdkModTarget } from "./sdk-target-shape.mts";
import { classifyRawContent } from "./mod-kinds.mts";

// base-paths / mod-meta-paths resolve S2_MOD and import the mod's meta.mts on import; createMod
// shells out to wine. Only what push-to-sdk reads is provided.
const state = vi.hoisted(() => ({
  raw: "",
  sdkLink: "",
  targets: [] as unknown[],
  classification: {} as unknown,
  transformers: [] as unknown[],
}));
const createMod = vi.hoisted(() => vi.fn());

vi.mock("./logger.mts", () => ({ logger: { log: () => {} } }));
vi.mock("./sdk-mutation-lock.mts", () => ({
  withSdkMutationLock: (_name: string, fn: () => unknown) => fn(),
}));
vi.mock("./cook.mts", () => ({ createMod }));
vi.mock("./base-paths.mts", () => ({
  get modFolderRaw() {
    return state.raw;
  },
  get modFolderSdkLink() {
    return state.sdkLink;
  },
}));
vi.mock("./mod-meta-paths.mts", () => ({
  get modMeta() {
    return Promise.resolve({ structTransformers: state.transformers });
  },
  get modClassification() {
    return state.classification;
  },
  get sdkModTargets() {
    return Promise.resolve(state.targets);
  },
  get primarySdkModTarget() {
    return Promise.resolve(state.targets[0]);
  },
  sdkModTargetFor: (kind: ModContentKind) =>
    Promise.resolve((state.targets as SdkModTarget[]).find((t) => t.kind === kind)!),
}));

let tmp: string;
let sdkPath: string;

/** Write one file into the fake mod's raw/Stalker2/Content tree. */
function writeRaw(relative: string, contents = "data") {
  const full = path.join(state.raw, "Stalker2", "Content", relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
}

function target(kind: ModContentKind, name: string): SdkModTarget {
  return sdkModTargetShape(kind, name, sdkPath);
}

/** Point the mocked mod-meta-paths at the targets classifyRawContent implies for raw/. */
function resolveTargets() {
  const classification = classifyRawContent(state.raw);
  state.classification = classification;
  const kinds = classification.kinds.length ? classification.kinds : (["assets"] as const);
  state.targets = kinds.map((kind) =>
    target(kind, kind === "cfgs" && classification.isSplit ? "MasterModCfg" : "MasterMod"),
  );
  state.transformers = classification.cfgFiles.map(() => () => {});
}

// createMod is what really creates the SDK mod folder; the mock does the folder part only.
createMod.mockImplementation(async (t: SdkModTarget) =>
  fs.mkdirSync(path.join(t.modFolder, "Content"), { recursive: true }),
);

const pushToSdk = async () => (await import("./push-to-sdk.mts")).pushToSdk();

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "push-to-sdk-test-"));
  sdkPath = path.join(tmp, "sdk");
  state.raw = path.join(tmp, "mod", "raw");
  state.sdkLink = path.join(tmp, "mod", "sdk");
  fs.mkdirSync(state.raw, { recursive: true });
  createMod.mockClear();
  vi.resetModules();
});

afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

const created = () => createMod.mock.calls.map(([t]) => (t as SdkModTarget).name).sort();

describe("pushToSdk - SDK mod creation", () => {
  it("creates both halves of a split mod when neither exists", async () => {
    writeRaw("GameLite/GameData/Foo_patch_MasterMod.cfg");
    writeRaw("_STALKER2/Foo.uasset");
    resolveTargets();

    await pushToSdk();

    expect(created()).toEqual(["MasterMod", "MasterModCfg"]);
  });

  it("creates only the missing half", async () => {
    writeRaw("GameLite/GameData/Foo_patch_MasterMod.cfg");
    writeRaw("_STALKER2/Foo.uasset");
    resolveTargets();
    fs.mkdirSync(target("cfgs", "MasterModCfg").modFolder, { recursive: true });

    await pushToSdk();

    expect(created()).toEqual(["MasterMod"]);
  });

  it("creates nothing when both halves already exist", async () => {
    writeRaw("GameLite/GameData/Foo_patch_MasterMod.cfg");
    writeRaw("_STALKER2/Foo.uasset");
    resolveTargets();
    for (const name of ["MasterMod", "MasterModCfg"]) {
      fs.mkdirSync(target("assets", name).modFolder, { recursive: true });
    }

    await pushToSdk();

    expect(createMod).not.toHaveBeenCalled();
  });

  it("creates the single target of a cfg-only mod, not a second half", async () => {
    writeRaw("GameLite/GameData/Foo_patch_MasterMod.cfg");
    resolveTargets();

    await pushToSdk();

    expect(created()).toEqual(["MasterMod"]);
  });
});

describe("pushToSdk - what gets pushed", () => {
  it("copies .cfg patches into the cfg half only, preserving their tree", async () => {
    writeRaw("GameLite/GameData/ItemPrototypes/Foo_patch_MasterMod.cfg", "cfg");
    writeRaw("_STALKER2/Foo.uasset", "asset");
    resolveTargets();

    await pushToSdk();

    const cfgHalf = target("cfgs", "MasterModCfg").modFolder;
    expect(
      fs.readFileSync(
        path.join(cfgHalf, "Content/GameLite/GameData/ItemPrototypes/Foo_patch_MasterMod.cfg"),
        "utf8",
      ),
    ).toBe("cfg");
    // Assets travel the other way, via pull-assets: the push must not put them anywhere.
    expect(fs.existsSync(path.join(cfgHalf, "Content/_STALKER2/Foo.uasset"))).toBe(false);
    const assetsHalf = target("assets", "MasterMod").modFolder;
    expect(fs.existsSync(path.join(assetsHalf, "Content/_STALKER2/Foo.uasset"))).toBe(false);
  });

  it("clears stale cfgs out of the assets half too - the pre-split layout", async () => {
    writeRaw("GameLite/GameData/Foo_patch_MasterMod.cfg", "new");
    writeRaw("_STALKER2/Foo.uasset");
    resolveTargets();
    // A mod built before the split kept its cfgs inside the assets SDK mod, where they would be
    // packed into the assets pak and shadow the cfg half's copy.
    const stale = path.join(
      target("assets", "MasterMod").modFolder,
      "Content/GameLite/GameData/Foo_patch_MasterMod.cfg",
    );
    fs.mkdirSync(path.dirname(stale), { recursive: true });
    fs.writeFileSync(stale, "old");

    await pushToSdk();

    expect(fs.existsSync(stale)).toBe(false);
  });

  it("symlinks mod/sdk at the half owning the mod's own name", async () => {
    writeRaw("GameLite/GameData/Foo_patch_MasterMod.cfg");
    writeRaw("_STALKER2/Foo.uasset");
    resolveTargets();

    await pushToSdk();

    expect(fs.realpathSync(state.sdkLink)).toBe(
      fs.realpathSync(target("assets", "MasterMod").modFolder),
    );
  });
});
