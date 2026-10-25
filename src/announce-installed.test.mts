import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { parseUasset } from "./localization/uasset.mts";
import { findWorldSubsystemClasses } from "./world-subsystem-data.mts";
import {
  ANNOUNCE_BLUEPRINT,
  ANNOUNCE_TEMPLATE,
  GAME_START_COMMAND_PLACEHOLDER,
  asAnnounceTemplate,
  installedEffect,
  withGameStartCommand,
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
    const home = parseUasset(ANNOUNCE_TEMPLATE).summary.packageName.split("/")[1];
    expect(readFileSync(path.join(raw, ANNOUNCE_BLUEPRINT)).includes(home)).toBe(false);
  });

  it("leaves an up-to-date copy untouched", () => {
    const [raw] = dirs(1);
    writeAnnounceBlueprint([raw], "RareNPCDrops");
    const file = path.join(raw, ANNOUNCE_BLUEPRINT);
    utimesSync(file, new Date(0), new Date(0));
    writeAnnounceBlueprint([raw], "RareNPCDrops");
    expect(statSync(file).mtimeMs).toBe(0);
  });

  it("writes the mod's game start command into its copy, and the template comes back from it", () => {
    const [raw] = dirs(1);
    const command = "XStartQuestNodeBySID RareNPCDrops_OnWorldLoad";
    writeAnnounceBlueprint([raw], "RareNPCDrops", command);
    const copy = readFileSync(path.join(raw, ANNOUNCE_BLUEPRINT));
    expect(copy.includes(GAME_START_COMMAND_PLACEHOLDER)).toBe(false);
    expect(copy.includes(command.padEnd(GAME_START_COMMAND_PLACEHOLDER.length, " "))).toBe(true);
    expect(asAnnounceTemplate(copy, command).includes(GAME_START_COMMAND_PLACEHOLDER)).toBe(true);
  });

  it("writes the template's own mod too", () => {
    const [raw] = dirs(1);
    const home = parseUasset(ANNOUNCE_TEMPLATE).summary.packageName.split("/")[1];
    writeAnnounceBlueprint([raw], home);
    expect(parseUasset(path.join(raw, ANNOUNCE_BLUEPRINT)).summary.packageName).toBe(`/${home}/announce_mod_is_active`);
  });
});

describe("withGameStartCommand", () => {
  const blueprint = Buffer.from(`head\0${GAME_START_COMMAND_PLACEHOLDER}\0tail`, "latin1");

  it("swaps the placeholder for the command, padded to the same length", () => {
    const out = withGameStartCommand(blueprint, "XStartQuestNodeBySID Foo");
    expect(out.length).toBe(blueprint.length);
    expect(out.toString("latin1")).toBe(`head\0${"XStartQuestNodeBySID Foo".padEnd(159, " ")}\0tail`);
  });

  it("blanks the placeholder for a mod without a command", () => {
    expect(withGameStartCommand(blueprint).toString("latin1")).toBe(`head\0${" ".repeat(159)}\0tail`);
  });

  it("refuses a command that doesn't fit or a template without the placeholder", () => {
    expect(() => withGameStartCommand(blueprint, "x".repeat(160))).toThrow();
    expect(() => withGameStartCommand(Buffer.from("no placeholder"), "XFoo")).toThrow();
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
