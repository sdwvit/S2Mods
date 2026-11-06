/**
 * S.T.A.L.K.E.R. 2 .sav files.
 *
 * A .sav is a little-endian uint32 uncompressed size followed by one Oodle Kraken stream. The decompressed
 * save opens with the installed paks (UTF-16) and ends with the quest-node name table: uint16 count, then
 * count x (uint16 length + chars, no NUL) up to EOF. The body refers to quest nodes by uint16 index,
 * so past 65,535 names the count wraps and the save can't be loaded (DesignDocs/SaveNameTableLimit.md).
 *
 * Oodle is the SDK's liboo2corelinux64.so.9, called through koffi.
 */
import koffi from "koffi";
import { existsSync } from "node:fs";
import path from "node:path";
import "../ensure-env.mts";

export const OODLE_REL = "Engine/Binaries/DotNET/AutomationTool/liboo2corelinux64.so.9";
export const STEAM_APP_ID = "1643320";
export const SAVES_REL = "pfx/drive_c/users/steamuser/AppData/Local/Stalker2/Saved/STEAM/SaveGames";
/** Last bytes before the name table in the saves checked on 2026-10-31. */
export const TABLE_MARKER = Buffer.from("GlassToy_14_Christmas\0\0", "latin1");
/** Bytes scanned back from EOF when the marker is missing; a 53,917-name table is ~1.7 MB. */
export const TABLE_WINDOW = 8 << 20;

const KRAKEN = 8;
const LEVEL_NORMAL = 4;

type Oodle = {
  decompress: (...a: unknown[]) => number;
  compress: (...a: unknown[]) => number;
  sizeNeeded: (compressor: number, rawLen: number) => number;
};
let oodleLib: Oodle | undefined;

export const oodlePath = (): string | undefined =>
  process.env.OODLE_LIB ||
  (process.env.SDK_PATH ? path.join(process.env.SDK_PATH, OODLE_REL) : undefined);

export const hasOodle = (): boolean => {
  const p = oodlePath();
  return !!p && existsSync(p);
};

const oodle = (): Oodle => {
  if (oodleLib) return oodleLib;
  const p = oodlePath();
  if (!p || !existsSync(p))
    throw new Error(`Oodle library not found (set SDK_PATH or OODLE_LIB): ${p}`);
  const lib = koffi.load(p);
  oodleLib = {
    decompress: lib.func(
      "int64_t OodleLZ_Decompress(const void *comp, int64_t compLen, void *raw, int64_t rawLen, int fuzz, int crc, int verbosity, void *dec, int64_t decSize, void *cb, void *cbData, void *scratch, int64_t scratchSize, int threadPhase)",
    ),
    compress: lib.func(
      "int64_t OodleLZ_Compress(int compressor, const void *raw, int64_t rawLen, void *comp, int level, void *opts, void *dict, void *lrm, void *scratch, int64_t scratchSize)",
    ),
    sizeNeeded: lib.func(
      "int64_t OodleLZ_GetCompressedBufferSizeNeeded(int compressor, int64_t rawLen)",
    ),
  };
  return oodleLib;
};

export function decompress(sav: Buffer): Buffer {
  if (sav.length < 5) throw new Error("file too short for a save");
  const size = sav.readUInt32LE(0);
  const out = Buffer.alloc(Math.max(size, 1));
  const got = Number(
    oodle().decompress(
      sav.subarray(4),
      sav.length - 4,
      out,
      size,
      1,
      0,
      0,
      null,
      0,
      null,
      null,
      null,
      0,
      3,
    ),
  );
  if (got !== size) throw new Error(`Oodle decompress failed: got ${got}, header says ${size}`);
  return out.subarray(0, size);
}

export function compress(raw: Buffer, level = LEVEL_NORMAL): Buffer {
  const o = oodle();
  const out = Buffer.alloc(Number(o.sizeNeeded(KRAKEN, raw.length)));
  const n = Number(o.compress(KRAKEN, raw, raw.length, out, level, null, null, null, null, 0));
  if (n <= 0) throw new Error("Oodle compress failed");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(raw.length);
  return Buffer.concat([header, out.subarray(0, n)]);
}

export type NameTable = { offset: number; names: string[] };

/** Names of the table whose uint16 count sits at `offset`, or undefined unless its entries end exactly at EOF. */
export function readTableAt(d: Buffer, offset: number): string[] | undefined {
  if (offset + 2 > d.length) return undefined;
  const count = d.readUInt16LE(offset);
  const names: string[] = [];
  let p = offset + 2;
  for (let i = 0; i < count; i++) {
    if (p + 2 > d.length) return undefined;
    const len = d.readUInt16LE(p);
    if (p + 2 + len > d.length) return undefined;
    names.push(d.toString("latin1", p + 2, p + 2 + len).replace(/\0+$/, ""));
    p += 2 + len;
  }
  return p === d.length ? names : undefined;
}

/**
 * Slow path: the longest run of (uint16 len + chars) entries that ends exactly at EOF and is preceded by its
 * own uint16 count (mod 65,536, so an overflowed table is found with its wrapped count).
 */
export function scanNameTable(d: Buffer, window = TABLE_WINDOW): NameTable | undefined {
  const n = d.length;
  const lo = Math.max(0, n - window);
  const run = new Int32Array(n - lo + 1).fill(-1); // run[p-lo] = entries from p to EOF, -1 if p isn't an entry start
  run[n - lo] = 0;
  for (let p = n - 2; p >= lo; p--) {
    const e = p + 2 + (d[p] | (d[p + 1] << 8));
    if (e <= n && run[e - lo] >= 0) run[p - lo] = run[e - lo] + 1;
  }
  let best: { offset: number; count: number } | undefined;
  for (let p = lo + 2; p < n - 1; p++) {
    const k = run[p - lo];
    if (k > 0 && (d[p - 2] | (d[p - 1] << 8)) === (k & 0xffff) && (!best || k > best.count))
      best = { offset: p - 2, count: k };
  }
  if (!best) return undefined;
  const names = readTableAt(d, best.offset);
  return names && { offset: best.offset, names };
}

/** The quest-node name table at the end of a decompressed save. */
export function nameTable(d: Buffer, window = TABLE_WINDOW): NameTable | undefined {
  const i = d.lastIndexOf(TABLE_MARKER);
  if (i >= 0) {
    const offset = i + TABLE_MARKER.length;
    const names = readTableAt(d, offset);
    if (names) return { offset, names };
  }
  return scanNameTable(d, window);
}

/** `<steamapps>/compatdata/1643320/.../SaveGames/Data`, with steamapps two levels above STALKER2_FOLDER. */
export function defaultSavesDir(gameFolder = process.env.STALKER2_FOLDER): string | undefined {
  if (!gameFolder) return undefined;
  const steamapps = path.dirname(path.dirname(path.normalize(gameFolder).replace(/\/+$/, "")));
  return path.join(steamapps, "compatdata", STEAM_APP_ID, SAVES_REL, "Data");
}

export type SaveString = { offset: number; text: string; encoding: "ascii" | "utf16" };
export type StringsOptions = { min?: number; encoding?: "ascii" | "utf16" | "both" };

const printable = (b: number) => (b >= 0x20 && b < 0x7f) || b === 0x09;
/** Ukrainian/Russian letters: А-я, Ё ё, Є є, І і, Ї ї, Ґ ґ (the rest of U+04xx shows up in binary noise). */
const isCyrillic = (u: number) =>
  (u >= 0x0410 && u <= 0x044f) ||
  [0x0401, 0x0451, 0x0404, 0x0454, 0x0406, 0x0456, 0x0407, 0x0457, 0x0490, 0x0491].includes(u);

/**
 * Readable text in a decompressed save, in file order, like `strings` + `strings -el`: ASCII runs, and
 * UTF-16LE runs of printable ASCII or Ukrainian/Russian letters at either byte alignment. Text is how the save
 * names most things (quest, prototype and global-variable IDs, paks); the values around it are binary.
 *
 * Most strings in a save are a uint16 length + chars with no NUL, so a printable length byte would stick to
 * the text: the next string's length at the end ("LairWars*"), or in UTF-16 the string's own length at the
 * start ("&CantBeKnockedDown..."). Both are trimmed when the number matches the neighbouring text.
 */
export function extractStrings(
  d: Buffer,
  { min = 6, encoding = "both" }: StringsOptions = {},
): SaveString[] {
  const out: SaveString[] = [];
  const near = (n: number, len: number) => n >= len - 1 && n <= len + 1;
  if (encoding !== "utf16") {
    const runs: [number, number][] = [];
    let start = -1;
    for (let p = 0; p <= d.length; p++) {
      if (p < d.length && printable(d[p])) {
        if (start < 0) start = p;
      } else if (start >= 0) {
        runs.push([start, p]);
        start = -1;
      }
    }
    runs.forEach(([s, e], i) => {
      // Trailing length byte: "<text><len>\0<next string of ~len chars>".
      const next = runs[i + 1];
      if (e - s > 1 && d[e] === 0 && next && next[0] === e + 1 && near(d[e - 1], next[1] - next[0]))
        e--;
      if (e - s >= min)
        out.push({ offset: s, text: d.toString("latin1", s, e), encoding: "ascii" });
    });
  }
  if (encoding !== "ascii") {
    const isUnit = (p: number) =>
      p + 1 < d.length && (d[p + 1] === 0 ? printable(d[p]) : isCyrillic(d.readUInt16LE(p)));
    for (const align of [0, 1]) {
      const runs: [number, number][] = [];
      let start = -1;
      for (let p = align; p < d.length + 2; p += 2) {
        if (isUnit(p)) {
          if (start < 0) start = p;
        } else if (start >= 0) {
          runs.push([start, p]);
          start = -1;
        }
      }
      runs.forEach(([s, e], i) => {
        // Leading length unit(s): the string's own length, possibly after an outer size.
        for (let k = 0; k < 3 && s + 2 * k < e; k++) {
          if (near(d.readUInt16LE(s + 2 * k), (e - s) / 2 - k - 1)) {
            s += 2 * (k + 1);
            break;
          }
        }
        // Trailing length unit: the next string's length.
        const next = runs[i + 1];
        if (
          e - s > 2 &&
          next &&
          next[0] === e &&
          near(d.readUInt16LE(e - 2), (next[1] - next[0]) / 2 - 1)
        )
          e -= 2;
        if ((e - s) / 2 >= min)
          out.push({ offset: s, text: d.toString("utf16le", s, e), encoding: "utf16" });
      });
    }
  }
  return out.sort((a, b) => a.offset - b.offset);
}

/** `hexdump -C`-style lines for `length` bytes at `offset` (negative counts back from the end). */
export function hexDump(d: Buffer, offset = 0, length = 256): string[] {
  const from = Math.max(0, offset < 0 ? d.length + offset : offset);
  const to = Math.min(d.length, from + length);
  const lines: string[] = [];
  for (let p = from; p < to; p += 16) {
    const row = d.subarray(p, Math.min(p + 16, to));
    const hex = Array.from(row, (b) => b.toString(16).padStart(2, "0"));
    const left = hex.slice(0, 8).join(" ").padEnd(23);
    const right = hex.slice(8).join(" ").padEnd(23);
    const ascii = Array.from(row, (b) =>
      b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".",
    ).join("");
    lines.push(`${p.toString(16).padStart(8, "0")}  ${left}  ${right}  |${ascii}|`);
  }
  return lines;
}

/** Distinct strings found in only one of two saves (sorted). */
export function diffStrings(a: Buffer, b: Buffer, opts: StringsOptions = {}) {
  const set = (d: Buffer) => new Set(extractStrings(d, opts).map((s) => s.text));
  const sa = set(a);
  const sb = set(b);
  return {
    onlyA: [...sa].filter((s) => !sb.has(s)).sort(),
    onlyB: [...sb].filter((s) => !sa.has(s)).sort(),
  };
}
