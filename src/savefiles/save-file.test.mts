import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  compress,
  decompress,
  defaultSavesDir,
  diffStrings,
  extractStrings,
  hasOodle,
  hexDump,
  nameTable,
  SAVES_REL,
  scanNameTable,
} from "./save-file.mts";
import { main } from "./s2sav.mts";

const table = (names: string[], count = names.length) =>
  Buffer.concat([
    Buffer.from([count & 0xff, count >> 8]),
    ...names.map((n) => {
      const s = Buffer.from(n, "latin1"); // the game writes no NUL
      return Buffer.concat([Buffer.from([s.length & 0xff, s.length >> 8]), s]);
    }),
  ]);

const body = (len: number) => Buffer.from(Array.from({ length: len }, (_, i) => (i * 7 + 3) % 251));
const fakeSave = (names: string[], bodyLen = 4000, count?: number) =>
  Buffer.concat([
    body(bodyLen),
    Buffer.from("GlassToy_14_Christmas\0\0", "latin1"),
    table(names, count),
  ]);

describe("nameTable", () => {
  it("finds the table after the marker", () => {
    const names = Array.from({ length: 500 }, (_, i) => `Quest_${i}_Node`);
    const d = fakeSave(names);
    const t = nameTable(d)!;
    expect(t.names).toEqual(names);
    expect(d.subarray(t.offset - 2, t.offset)).toEqual(Buffer.from([0, 0]));
  });

  it("reports the wrapped count of an overflowed table", () => {
    // What the game writes past 65,535 names: count mod 65,536, and only that many entries.
    const names = Array.from({ length: 66_400 - 65_536 }, (_, i) => `N${i}`);
    expect(nameTable(fakeSave(names))!.names).toHaveLength(864);
  });

  it("rejects a table whose count doesn't match its entries", () => {
    expect(nameTable(fakeSave(["A", "B", "C"], 4000, 7))).toBeUndefined();
  });

  it("keeps empty names", () => {
    expect(nameTable(fakeSave(["", "X", ""]))!.names).toEqual(["", "X", ""]);
  });

  it("scans for the table when the marker is missing", () => {
    const names = Array.from({ length: 400 }, (_, i) => `Node_${i}`);
    const noMarker = Buffer.concat([
      Buffer.from(Array.from({ length: 4000 }, (_, i) => i % 200)),
      table(names),
    ]);
    expect(nameTable(noMarker)!.names).toEqual(names);
    expect(scanNameTable(fakeSave(names))!.names).toEqual(names);
  });

  it("returns undefined without a table", () => {
    expect(nameTable(Buffer.alloc(1000, 0xff))).toBeUndefined();
  });
});

// The game's usual string framing: uint16 length + chars, no NUL.
const ascii = (t: string) =>
  Buffer.concat([Buffer.from([t.length & 0xff, t.length >> 8]), Buffer.from(t, "latin1")]);
// UTF-16 framing seen in the pak list: uint16 char count (incl. NUL) + UTF-16LE chars + NUL.
const utf16 = (t: string) =>
  Buffer.concat([Buffer.from([t.length + 1, 0]), Buffer.from(t, "utf16le"), Buffer.alloc(2)]);

describe("extractStrings", () => {
  it("finds ASCII and UTF-16 text in file order, with offsets", () => {
    const d = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      utf16("Mod-Windows.pak"),
      Buffer.from([1, 2, 3]),
      ascii("LairWarsInstalled"),
    ]);
    expect(extractStrings(d)).toEqual([
      { offset: 4, text: "Mod-Windows.pak", encoding: "utf16" },
      { offset: d.indexOf("LairWarsInstalled"), text: "LairWarsInstalled", encoding: "ascii" },
    ]);
  });

  it("drops a length byte that sticks to the text", () => {
    // "LairWars*" in a real save: the '*' is the next string's length (42).
    const next = "X".repeat(42);
    const d = Buffer.concat([Buffer.from([0x90]), ascii("LairWars"), ascii(next)]);
    expect(extractStrings(d).map((s) => s.text)).toEqual(["LairWars", next]);
  });

  it("drops a UTF-16 string's own length unit", () => {
    // "&CantBeKnockedDown..." in a real save: '&' (38) is the char count of the 37-char name + NUL.
    const name = "CantBeKnockedDownStalker2-Windows.pak";
    const d = Buffer.concat([Buffer.from([0xff, 0xff, 0x68, 0x00]), utf16(name)]);
    expect(extractStrings(d, { encoding: "utf16" }).map((s) => s.text)).toEqual([name]);
  });

  it("reads Ukrainian text and skips other U+04xx noise", () => {
    const d = Buffer.concat([
      Buffer.from([0xff, 0xff]),
      utf16("Сталкер Ґудзь"),
      Buffer.from("\u0401!\u0402!\u0404!\u0403!", "utf16le"),
    ]);
    expect(extractStrings(d, { encoding: "utf16" }).map((s) => s.text)).toEqual(["Сталкер Ґудзь"]);
  });

  it("respects min and encoding", () => {
    const d = Buffer.concat([ascii("short"), Buffer.from([0xff]), utf16("LongEnough")]);
    expect(extractStrings(d, { min: 6 }).map((s) => s.text)).toEqual(["LongEnough"]);
    expect(extractStrings(d, { min: 4, encoding: "ascii" }).map((s) => s.text)).toEqual(["short"]);
  });
});

describe("hexDump", () => {
  const d = Buffer.from("0123456789abcdefXYZ\x00", "latin1");
  it("formats like hexdump -C", () => {
    expect(hexDump(d, 0, 20)).toEqual([
      "00000000  30 31 32 33 34 35 36 37  38 39 61 62 63 64 65 66  |0123456789abcdef|",
      "00000010  58 59 5a 00                                       |XYZ.|",
    ]);
  });
  it("counts a negative offset from the end and clamps to the file", () => {
    expect(hexDump(d, -4)).toEqual([
      "00000010  58 59 5a 00                                       |XYZ.|",
    ]);
    expect(hexDump(d, 100)).toEqual([]);
  });
});

describe("diffStrings", () => {
  it("lists text found in only one save", () => {
    const a = Buffer.concat([ascii("SharedQuest_Node"), ascii("OnlyInA_Quest")]);
    const b = Buffer.concat([
      ascii("SharedQuest_Node"),
      ascii("OnlyInB_Quest"),
      ascii("AnotherInB_Node"),
    ]);
    expect(diffStrings(a, b)).toEqual({
      onlyA: ["OnlyInA_Quest"],
      onlyB: ["AnotherInB_Node", "OnlyInB_Quest"],
    });
  });
});

describe("defaultSavesDir", () => {
  it("derives the Proton save folder from the game folder", () => {
    expect(defaultSavesDir("/lib/steamapps/common/S.T.A.L.K.E.R. 2 Heart of Chornobyl/")).toBe(
      `/lib/steamapps/compatdata/1643320/${SAVES_REL}/Data`,
    );
    expect(defaultSavesDir("")).toBeUndefined();
  });
});

describe.skipIf(!hasOodle())("Oodle (needs SDK_PATH)", () => {
  it("round-trips compress/decompress", () => {
    const raw = fakeSave(
      Array.from({ length: 2000 }, (_, i) => `Node_${i}`),
      200_000,
    );
    const sav = compress(raw);
    expect(sav.readUInt32LE(0)).toBe(raw.length);
    expect(sav.length).toBeLessThan(raw.length);
    expect(decompress(sav)).toEqual(raw);
  });

  it("throws on a truncated save", () => {
    const sav = compress(fakeSave(Array(100).fill("A"), 50_000));
    expect(() => decompress(sav.subarray(0, sav.length >> 1))).toThrow(/decompress failed/);
  });

  it("CLI: unpack, pack, names, list", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "s2sav-test-"));
    const names = Array.from({ length: 300 }, (_, i) => `Q${i}`);
    const raw = fakeSave(names);
    const savA = path.join(dir, "A.sav");
    writeFileSync(savA, compress(raw));
    const out: string[] = [];
    const run = (...a: string[]) => {
      out.length = 0;
      main(a, (s) => out.push(s));
      return out.join("\n");
    };

    run("unpack", savA, "-o", path.join(dir, "out"));
    expect(readFileSync(path.join(dir, "out", "A.sav.raw"))).toEqual(raw);

    const savB = path.join(dir, "B.sav");
    run("pack", path.join(dir, "out", "A.sav.raw"), "-o", savB);
    expect(decompress(readFileSync(savB))).toEqual(raw);

    expect(run("names", savA)).toMatch(/A\.sav {2}300 names at 0x/);
    expect(run("names", "--dump", path.join(dir, "out", "A.sav.raw"))).toContain("299\tQ299");
    expect(run("strings", savA, "-n", "4", "--grep", "^Q29[0-9]$").split("\n")).toHaveLength(10);
    expect(run("strings", savA, "--offsets", "--grep", "Glass")).toMatch(
      /^[0-9a-f]{8} a GlassToy_14_Christmas$/,
    );
    expect(run("hex", savA, "--at", "end-2")).toMatch(/\|Q299\|$|\|99\|$/);
    expect(run("hex", savA, "--at=-16", "--length", "16").split("\n")).toHaveLength(1);
    writeFileSync(savB, compress(fakeSave([...names, "NewNode_X"])));
    expect(run("diff", savA, savB)).toBe("+ NewNode_X");

    utimesSync(savA, new Date(2026, 0, 1), new Date(2026, 0, 1));
    const lines = run("list", dir).split("\n");
    expect(lines[0]).toMatch(/\s301 {2}B\.sav$/); // newest first; B gained a name in the diff step
    expect(lines[1]).toMatch(/^2026-01-01 00:00 .*\s300 {2}A\.sav$/);
  });

  it.skipIf(!process.env.S2_TEST_SAVE)("reads a real save (S2_TEST_SAVE)", () => {
    const t = nameTable(decompress(readFileSync(process.env.S2_TEST_SAVE!)));
    expect(t?.names.length).toBeGreaterThan(0);
  });
});
