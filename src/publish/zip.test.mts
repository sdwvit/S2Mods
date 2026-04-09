import { describe, expect, it } from "vitest";
import { createModZip } from "./zip.mts";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

function listZipEntries(zipPath: string): string[] {
  return execSync(`unzip -l "${zipPath}"`, { encoding: "utf8" })
    .split("\n")
    .filter((l) => l.match(/^\s+\d/))
    .map((l) => l.trim().split(/\s+/).pop()!)
    .filter((e) => !e.endsWith("/"));
}

describe("createModZip", () => {
  it("with dest=false, files are at zip root", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zip-test-"));
    const srcDir = path.join(tmp, "src");
    fs.mkdirSync(path.join(srcDir, "Content", "GameLite"), { recursive: true });
    fs.writeFileSync(path.join(srcDir, "Content", "GameLite", "test.cfg"), "data");

    const zipPath = await createModZip(srcDir, false);
    const entries = listZipEntries(zipPath);

    expect(entries).toContain("Content/GameLite/test.cfg");
    expect(entries.every((e) => !e.startsWith("Windows/"))).toBe(true);

    fs.rmSync(tmp, { recursive: true });
    fs.rmSync(zipPath);
  });

  it("with dest string, files are nested under dest", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zip-test-"));
    const srcDir = path.join(tmp, "src");
    fs.mkdirSync(path.join(srcDir), { recursive: true });
    fs.writeFileSync(path.join(srcDir, "mod.pak"), "data");

    const zipPath = await createModZip(srcDir, "Windows/Stalker2/Mods/Test/Content/Paks/Windows");
    const entries = listZipEntries(zipPath);

    expect(entries).toContain("Windows/Stalker2/Mods/Test/Content/Paks/Windows/mod.pak");

    fs.rmSync(tmp, { recursive: true });
    fs.rmSync(zipPath);
  });
});
