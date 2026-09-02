import { readFileSync, writeFileSync } from "node:fs";
import { parseUasset } from "./parse-uasset.mts";

/**
 * Writer for `LocalizationModTextToolAsset` packages only - the SDK's per-mod text assets, whose
 * single export is a `LocalizedTexts` array of `{ SID, LanguagesToLocalizedStrings }`.
 *
 * It re-serialises that one export and splices it back in, patching the handful of offsets that
 * move as a result. Anything else in the package is copied through untouched, so this deliberately
 * does not generalise to other asset types - see `parse-uasset.mts` for the format notes.
 */

export type LocalizedTextEntry = {
  SID: string;
  LanguagesToLocalizedStrings: Record<string, string>;
};

/** Byte offsets of the summary fields that point past the export data. */
const BULK_DATA_START_OFFSET_AT = 286;
const PAYLOAD_TOC_OFFSET_AT = 314;
const EXPORT_ENTRY_STRIDE = 112;
const EXPORT_SERIAL_SIZE_AT = 28;
const EXPORT_SERIAL_OFFSET_AT = 36;

class Writer {
  private parts: Buffer[] = [];
  get length() {
    return this.parts.reduce((n, b) => n + b.length, 0);
  }
  raw(b: Buffer) {
    this.parts.push(b);
    return this;
  }
  u8(v: number) {
    return this.raw(Buffer.from([v]));
  }
  i32(v: number) {
    const b = Buffer.alloc(4);
    b.writeInt32LE(v);
    return this.raw(b);
  }
  /** `FString`: ASCII goes out as UTF-8, anything else as UTF-16LE with a negated length. */
  fstring(s: string) {
    if (s === "") return this.i32(0);
    if (/^[\x00-\x7f]*$/.test(s)) {
      this.i32(Buffer.byteLength(s, "utf8") + 1);
      return this.raw(Buffer.concat([Buffer.from(s, "utf8"), Buffer.from([0])]));
    }
    const body = Buffer.from(s, "utf16le");
    this.i32(-(body.length / 2 + 1));
    return this.raw(Buffer.concat([body, Buffer.from([0, 0])]));
  }
  toBuffer() {
    return Buffer.concat(this.parts);
  }
}

/** Resolves an FName to its table index; these assets never need to grow the name table. */
const nameIndex = (names: string[], name: string) => {
  const i = names.indexOf(name);
  if (i === -1) throw new Error(`"${name}" is not in the package name table`);
  return i;
};

const writeName = (w: Writer, names: string[], name: string) =>
  w.i32(nameIndex(names, name)).i32(0);

/** `FPropertyTypeName`: an FName followed by its parameter list. */
const writeTypeName = (w: Writer, names: string[], type: string, params: string[][] = []) => {
  writeName(w, names, type);
  w.i32(params.length);
  for (const [head, ...rest] of params)
    writeTypeName(
      w,
      names,
      head,
      rest.map((p) => [p]),
    );
};

/** A property tag: name, type, value size, then `EPropertyTagFlags` (always 0 for these). */
const writeTag = (
  w: Writer,
  names: string[],
  name: string,
  writeType: () => void,
  value: Buffer,
) => {
  writeName(w, names, name);
  writeType();
  w.i32(value.length).u8(0).raw(value);
};

export function serializeLocalizedTexts(names: string[], entries: LocalizedTextEntry[]): Buffer {
  const elements = new Writer();
  elements.i32(entries.length);
  for (const entry of entries) {
    const sid = new Writer().fstring(entry.SID).toBuffer();
    writeTag(elements, names, "SID", () => writeTypeName(elements, names, "StrProperty"), sid);

    const map = new Writer();
    map.i32(0); // KeysToRemove
    const langs = Object.entries(entry.LanguagesToLocalizedStrings);
    map.i32(langs.length);
    for (const [language, text] of langs) {
      writeName(map, names, language);
      map.fstring(text);
    }
    writeTag(
      elements,
      names,
      "LanguagesToLocalizedStrings",
      () => {
        writeName(elements, names, "MapProperty");
        elements.i32(2);
        writeTypeName(elements, names, "EnumProperty", [
          ["ELocalizationLanguage", "/Script/Stalker2"],
          ["ByteProperty"],
        ]);
        writeTypeName(elements, names, "StrProperty");
      },
      map.toBuffer(),
    );
    writeName(elements, names, "None"); // end of struct element
  }

  const out = new Writer();
  out.u8(0); // __SerializationControlExtensions
  writeTag(
    out,
    names,
    "LocalizedTexts",
    () => {
      writeName(out, names, "ArrayProperty");
      out.i32(1);
      writeTypeName(out, names, "StructProperty", [
        ["ModTextToolLocalizedText", "/Script/ModKitEditor"],
      ]);
    },
    elements.toBuffer(),
  );
  writeName(out, names, "None"); // end of export
  // Observed trailer on every export of this type, after the property list terminator.
  out.i32(0);
  return out.toBuffer();
}

/** Rewrite `file` in place with `entries` as its complete `LocalizedTexts` array. */
export function writeLocalizedTexts(file: string, entries: LocalizedTextEntry[]) {
  const original = readFileSync(file);
  const parsed = parseUasset(file);
  const index = parsed.exports.findIndex((e) => e.className === "LocalizationModTextToolAsset");
  if (index === -1) throw new Error(`${file} has no LocalizationModTextToolAsset export`);
  const target = parsed.exports[index];

  const payload = serializeLocalizedTexts(parsed.names, entries);
  const delta = payload.length - target.serialSize;
  const out = Buffer.concat([
    original.subarray(0, target.serialOffset),
    payload,
    original.subarray(target.serialOffset + target.serialSize),
  ]);

  // Everything after this export shifts by `delta`: the later exports' payloads, plus the two
  // summary offsets that point past the export data.
  out.writeBigInt64LE(
    BigInt(payload.length),
    parsed.summary.exportOffset + index * EXPORT_ENTRY_STRIDE + EXPORT_SERIAL_SIZE_AT,
  );
  for (let i = index + 1; i < parsed.exports.length; i++) {
    const at = parsed.summary.exportOffset + i * EXPORT_ENTRY_STRIDE + EXPORT_SERIAL_OFFSET_AT;
    out.writeBigInt64LE(BigInt(parsed.exports[i].serialOffset + delta), at);
  }
  out.writeBigInt64LE(
    BigInt(Number(out.readBigInt64LE(BULK_DATA_START_OFFSET_AT)) + delta),
    BULK_DATA_START_OFFSET_AT,
  );
  out.writeBigInt64LE(
    BigInt(Number(out.readBigInt64LE(PAYLOAD_TOC_OFFSET_AT)) + delta),
    PAYLOAD_TOC_OFFSET_AT,
  );

  writeFileSync(file, out);
  return out.length;
}
