import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { sdkModTargetShape, type ModContentKind, type SdkModTarget } from "./sdk-target-shape.mts";

// base-paths / mod-meta-paths resolve S2_MOD, SDK_PATH and the mod's meta.mts at import time, so
// only the values pull-staged reads are provided.
const state = vi.hoisted(() => ({
  steamFolder: "",
  targets: [] as unknown[],
  isSplit: false,
}));

vi.mock("./logger.mts", () => ({ logger: { log: () => {} } }));
vi.mock("./base-paths.mts", () => ({
  get modFolderSteam() {
    return state.steamFolder;
  },
}));
vi.mock("./mod-meta-paths.mts", () => ({
  get sdkModTargets() {
    return Promise.resolve(state.targets);
  },
  get modClassification() {
    return { isSplit: state.isSplit };
  },
}));

let tmp: string;
let sdkPath: string;

function target(kind: ModContentKind, name: string): SdkModTarget {
  return sdkModTargetShape(kind, name, sdkPath);
}

/** Stage one half exactly as a cook leaves it: one folder per variant, containers named by mod. */
function stage(t: SdkModTarget, variants = ["NewContent", "OverrideContent"]) {
  for (const variant of variants) {
    const pakFolder = t.stagedPakFolderFor(variant);
    fs.mkdirSync(pakFolder, { recursive: true });
    for (const ext of ["pak", "utoc", "ucas"]) {
      fs.writeFileSync(path.join(pakFolder, `${t.name}Stalker2-Windows-${variant}.${ext}`), t.name);
    }
  }
}

/** Every file below dir, as paths relative to it. */
function tree(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? tree(path.join(dir, e.name)).map((p) => path.join(e.name, p)) : [e.name],
    )
    .sort();
}

const publishedTree = () => tree(path.join(state.steamFolder, "Windows"));

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pull-staged-test-"));
  sdkPath = path.join(tmp, "sdk");
  state.steamFolder = path.join(tmp, "steamworkshop");
  state.targets = [];
  state.isSplit = false;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

const copyStaged = async () => (await import("./pull-staged.mts")).copyStaged();

describe("copyStaged - single-half mod", () => {
  it("mirrors the staged tree into steamworkshop/Windows", async () => {
    const t = target("cfgs", "MasterMod");
    state.targets = [t];
    stage(t);

    await copyStaged();

    expect(publishedTree()).toEqual([
      "NewContent/Windows/Stalker2/Mods/MasterMod/Content/Paks/Windows/MasterModStalker2-Windows-NewContent.pak",
      "NewContent/Windows/Stalker2/Mods/MasterMod/Content/Paks/Windows/MasterModStalker2-Windows-NewContent.ucas",
      "NewContent/Windows/Stalker2/Mods/MasterMod/Content/Paks/Windows/MasterModStalker2-Windows-NewContent.utoc",
      "OverrideContent/Windows/Stalker2/Mods/MasterMod/Content/Paks/Windows/MasterModStalker2-Windows-OverrideContent.pak",
      "OverrideContent/Windows/Stalker2/Mods/MasterMod/Content/Paks/Windows/MasterModStalker2-Windows-OverrideContent.ucas",
      "OverrideContent/Windows/Stalker2/Mods/MasterMod/Content/Paks/Windows/MasterModStalker2-Windows-OverrideContent.utoc",
    ]);
  });

  it("wipes stale output of a previous publish instead of overlaying it", async () => {
    const t = target("cfgs", "MasterMod");
    state.targets = [t];
    stage(t, ["OverrideContent"]);
    const stale = path.join(state.steamFolder, "Windows", "NewContent", "Windows", "leftover.pak");
    fs.mkdirSync(path.dirname(stale), { recursive: true });
    fs.writeFileSync(stale, "old");

    await copyStaged();

    expect(publishedTree().some((p) => p.includes("leftover.pak"))).toBe(false);
  });

  it("does nothing when nothing is staged", async () => {
    state.targets = [target("cfgs", "MasterMod")];
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    await copyStaged();

    expect(fs.existsSync(path.join(state.steamFolder, "Windows"))).toBe(false);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe("copyStaged - split mod merges both halves", () => {
  /** The assets half keeps the mod's name; the cfg half is the suffixed one. */
  function splitTargets() {
    const assets = target("assets", "MasterMod");
    const cfgs = target("cfgs", "MasterModCfg");
    state.targets = [assets, cfgs];
    state.isSplit = true;
    return { assets, cfgs };
  }

  it("publishes one payload holding both Stalker2/Mods/<name> subtrees", async () => {
    const { assets, cfgs } = splitTargets();
    stage(assets);
    stage(cfgs);

    await copyStaged();

    const published = publishedTree();
    // Both halves land under the same variant folders, differing only in their Mods/<name>
    // subfolder and container basenames - so the merge is a pure overlay with no collision.
    for (const variant of ["NewContent", "OverrideContent"]) {
      for (const name of ["MasterMod", "MasterModCfg"]) {
        expect(published).toContain(
          path.join(
            variant,
            "Windows/Stalker2/Mods",
            name,
            "Content/Paks/Windows",
            `${name}Stalker2-Windows-${variant}.pak`,
          ),
        );
      }
    }
    expect(published).toHaveLength(12);
  });

  it("neither half overwrites the other", async () => {
    const { assets, cfgs } = splitTargets();
    stage(assets);
    stage(cfgs);

    await copyStaged();

    const read = (name: string) =>
      fs.readFileSync(
        path.join(
          state.steamFolder,
          "Windows/OverrideContent/Windows/Stalker2/Mods",
          name,
          "Content/Paks/Windows",
          `${name}Stalker2-Windows-OverrideContent.pak`,
        ),
        "utf8",
      );
    expect(read("MasterMod")).toBe("MasterMod");
    expect(read("MasterModCfg")).toBe("MasterModCfg");
  });

  it("refuses to publish half a mod when only one half is staged", async () => {
    const { assets } = splitTargets();
    stage(assets);

    await expect(copyStaged()).rejects.toThrow(/Only 1\/2 halves/);
    await expect(copyStaged()).rejects.toThrow(/cfgs=MasterModCfg/);
  });

  it("leaves the previous payload untouched when it refuses", async () => {
    const { assets } = splitTargets();
    stage(assets);
    const previous = path.join(state.steamFolder, "Windows", "OverrideContent", "previous.pak");
    fs.mkdirSync(path.dirname(previous), { recursive: true });
    fs.writeFileSync(previous, "shipped");

    await expect(copyStaged()).rejects.toThrow();
    expect(fs.readFileSync(previous, "utf8")).toBe("shipped");
  });
});
