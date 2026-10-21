import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { parseUasset } from "./localization/uasset.mts";
import { findWorldSubsystemClasses } from "./world-subsystem-data.mts";
import {
  ANNOUNCE_BLUEPRINT,
  ANNOUNCE_TEMPLATE,
  installedEffect,
  writeAnnounceBlueprint,
} from "./announce-installed.mts";

const dirs = (n: number) => {
  const root = mkdtempSync(path.join(tmpdir(), "announce-installed-test-"));
  return Array.from({ length: n }, (_, i) => {
    const dir = path.join(root, String(i));
    mkdirSync(dir);
    return dir;
  });
};

describe("writeAnnounceBlueprint", () => {
  it("renames the template into the mod and registers it as the mod's subsystem", () => {
    const [raw, sdk] = dirs(2);
    writeAnnounceBlueprint([raw, sdk], "RareNPCDrops");
    for (const dir of [raw, sdk]) {
      const file = path.join(dir, ANNOUNCE_BLUEPRINT);
      expect(parseUasset(file).summary.packageName).toBe("/RareNPCDrops/announce_mod_is_active");
      expect(findWorldSubsystemClasses(dir, "RareNPCDrops")).toEqual([
        "/RareNPCDrops/announce_mod_is_active.announce_mod_is_active_C",
      ]);
    }
    expect(readFileSync(path.join(raw, ANNOUNCE_BLUEPRINT)).includes("HeadlessArmors")).toBe(false);
  });

  it("leaves an up-to-date copy untouched", () => {
    const [raw] = dirs(1);
    writeAnnounceBlueprint([raw], "RareNPCDrops");
    const file = path.join(raw, ANNOUNCE_BLUEPRINT);
    utimesSync(file, new Date(0), new Date(0));
    writeAnnounceBlueprint([raw], "RareNPCDrops");
    expect(statSync(file).mtimeMs).toBe(0);
  });

  it("never overwrites the template's own mod, where the blueprint is edited", () => {
    const [raw] = dirs(1);
    writeAnnounceBlueprint([raw], parseUasset(ANNOUNCE_TEMPLATE).summary.packageName.split("/")[1]);
    expect(() => statSync(path.join(raw, ANNOUNCE_BLUEPRINT))).toThrow();
  });
});

describe("installedEffect", () => {
  it("is a permanent, non-stacking flag named after the SDK mod", () => {
    const text = installedEffect("RareNPCDrops").toString();
    expect(text).toContain("RareNPCDropsInstalled : struct.begin {refkey=[0]}");
    expect(text).toContain("Type = EEffectType::FlagEffect");
    expect(text).toContain("bIsPermanent = true");
    expect(text).toContain("DuplicationType = EDuplicateResolveType::KeepOld");
  });
});
