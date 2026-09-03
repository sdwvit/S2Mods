import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "./logger.mts";

/**
 * Minimal reader for UE5 `.uasset` packages as written by the STALKER 2 Mod SDK
 * (`LegacyFileVersion -8`, `FileVersionUE4 522`, `FileVersionUE5 1013` - UE 5.4 era).
 *
 * Two things differ from the older `.uasset` layouts most parsers implement:
 *
 * 1. The summary puts `SoftObjectPaths` count/offset between `NameOffset` and `LocalizationId`.
 * 2. Property tags carry UE 5.4's recursive `FPropertyTypeName` (an FName plus a parameter list)
 *    instead of the old `Type`/`InnerType`/`StructName` fields, and end with
 *    `Size:int32, Flags:uint8` - an `EPropertyTagFlags` bitfield. `ArrayIndex` and the property
 *    GUID are only present when the flags say so, a `bool`'s value *is* one of the flags, and
 *    natively-serialised structs (`Color`, `Guid`, ...) are marked there rather than by name.
 *
 * The SDK's own JSON dump (`.utxt`) is the reference for both; this parser reproduces its
 * `Exports.<name>.Properties.__Value` tree exactly.
 */

/** A parsed `FPropertyTypeName`: `MapProperty(EnumProperty(ELocalizationLanguage(...)),StrProperty)`. */
export type PropertyTypeName = { name: string; params: PropertyTypeName[] };

export type PropertyValue = unknown;

export type UassetImport = {
  classPackage: string;
  className: string;
  outerIndex: number;
  objectName: string;
  packageName: string;
};

export type UassetExport = {
  objectName: string;
  className: string | null;
  serialOffset: number;
  serialSize: number;
  /** `undefined` when the export's bytes are not tagged properties we could read. */
  properties?: Record<string, PropertyValue>;
};

export type UassetSummary = {
  legacyFileVersion: number;
  fileVersionUE4: number;
  fileVersionUE5: number;
  fileVersionLicenseeUE4: number;
  customVersions: { key: string; version: number }[];
  totalHeaderSize: number;
  packageName: string;
  packageFlags: number;
  localizationId: string;
  nameCount: number;
  nameOffset: number;
  exportCount: number;
  exportOffset: number;
  importCount: number;
  importOffset: number;
  dependsOffset: number;
  /**
   * Byte offsets *of* the two summary fields that point past the export data, so the writer can
   * patch them without guessing. `null` when the summary tail did not decode to exactly
   * `nameOffset`, i.e. we lost alignment and must not write to this package at all.
   */
  bulkDataStartOffsetAt: number | null;
  payloadTocOffsetAt: number | null;
};

export type Uasset = {
  summary: UassetSummary;
  /** Derived from the table bounds, not hardcoded - see `readExports`. */
  exportStride: number;
  names: string[];
  imports: UassetImport[];
  exports: UassetExport[];
};

const PACKAGE_FILE_TAG = 0x9e2a83c1;

/**
 * `EUnrealEngineObjectUE5Version` values the summary layout and the property-tag layout hinge on.
 * The SDK writes 1013; older hand-made assets in this repo are 1008, which is *before* complete
 * property type names, so their exports use the legacy tag format this parser does not implement.
 */
const UE5_NAMES_REFERENCED_FROM_EXPORT_DATA = 1001;
const UE5_PAYLOAD_TOC = 1002;
const UE5_ADD_SOFTOBJECTPATH_LIST = 1008;
const UE5_DATA_RESOURCES = 1009;
const UE5_PROPERTY_TAG_COMPLETE_TYPE_NAME = 1012;

/** `EPropertyTagFlags` (UE 5.4). */
const TAG_HAS_ARRAY_INDEX = 1 << 0;
const TAG_HAS_PROPERTY_GUID = 1 << 1;
const TAG_HAS_PROPERTY_EXTENSIONS = 1 << 2;
const TAG_HAS_BINARY_OR_NATIVE_SERIALIZE = 1 << 3;
const TAG_BOOL_TRUE = 1 << 4;
/** `EPropertyTagExtension::OverridableInformation`. */
const TAG_EXT_OVERRIDABLE_INFORMATION = 1 << 0;
/**
 * Native structs (`Guid`, vectors, ...) serialise as opaque binary rather than tagged properties,
 * and there is no schema in the package to tell us their layout. Those are surfaced as raw bytes
 * rather than silently dropped, keyed by this field.
 */
export const RAW_BYTES = "__rawBytes";

/** Export classes whose bytes are not a tagged property list at all. */
const NATIVELY_SERIALISED_EXPORTS = new Set([
  "MetaData",
  "AssetImportData",
  "InterchangeAssetImportData",
]);

class Reader {
  // Spelled out rather than as constructor parameter properties: these .mts files are run by
  // `node` directly, whose type-stripping does not support them.
  readonly buf: Buffer;
  pos: number;

  constructor(buf: Buffer, pos = 0) {
    this.buf = buf;
    this.pos = pos;
  }

  /** `this.pos += n` is a trap here: it reads the old `pos` before evaluating `n`. */
  skip(n: number) {
    this.pos += n;
  }
  u8() {
    return this.buf.readUInt8(this.pos++);
  }
  i32() {
    const v = this.buf.readInt32LE(this.pos);
    this.pos += 4;
    return v;
  }
  u32() {
    const v = this.buf.readUInt32LE(this.pos);
    this.pos += 4;
    return v;
  }
  i64() {
    const v = this.buf.readBigInt64LE(this.pos);
    this.pos += 8;
    return Number(v);
  }
  f32() {
    const v = this.buf.readFloatLE(this.pos);
    this.pos += 4;
    return v;
  }
  f64() {
    const v = this.buf.readDoubleLE(this.pos);
    this.pos += 8;
    return v;
  }
  guid() {
    const v = this.buf.subarray(this.pos, this.pos + 16).toString("hex");
    this.pos += 16;
    return v;
  }

  /** `FString`: positive length is UTF-8, negative length is UTF-16LE. Both are NUL-terminated. */
  fstring() {
    const len = this.i32();
    if (len === 0) return "";
    if (len < 0) {
      const bytes = -len * 2;
      const v = this.buf.toString("utf16le", this.pos, this.pos + bytes - 2);
      this.pos += bytes;
      return v;
    }
    const v = this.buf.toString("utf8", this.pos, this.pos + len - 1);
    this.pos += len;
    return v;
  }
}

/** `FName` is an index into the package name table plus a 1-based "number" suffix. */
const readName = (r: Reader, names: string[]) => {
  const index = r.u32();
  const number = r.u32();
  const base = names[index];
  // Out of range means we are no longer aligned to a real FName - bail loudly instead of
  // inventing a name and letting the caller wander off into the rest of the file.
  if (base === undefined)
    throw new Error(`name index ${index} out of range at offset ${r.pos - 8}`);
  return number === 0 ? base : `${base}_${number - 1}`;
};

const MAX_TYPE_PARAMS = 8;

const readTypeName = (r: Reader, names: string[]): PropertyTypeName => {
  const name = readName(r, names);
  const paramCount = r.u32();
  if (paramCount > MAX_TYPE_PARAMS)
    throw new Error(`implausible type parameter count ${paramCount}`);
  const params: PropertyTypeName[] = [];
  for (let i = 0; i < paramCount; i++) params.push(readTypeName(r, names));
  return { name, params };
};

export const formatTypeName = (t: PropertyTypeName): string =>
  t.params.length ? `${t.name}(${t.params.map(formatTypeName).join(",")})` : t.name;

/** `PKG_FilterEditorOnly` - set on cooked packages, and drops a handful of summary fields. */
const PKG_FILTER_EDITOR_ONLY = 0x8000_0000;

/** `FEngineVersion`: major/minor/patch as uint16, changelist as uint32, then the branch name. */
const readEngineVersion = (r: Reader) => {
  r.skip(2 * 3 + 4); // major, minor, patch (uint16), changelist (uint32)
  r.fstring(); // branch
};

/**
 * The tail of `FPackageFileSummary` past `DependsOffset`. Nothing in it is interesting to read,
 * but two of its fields (`BulkDataStartOffset`, `PayloadTocOffset`) are the only offsets in the
 * package that point *past* the export data, so the writer has to patch them - and their byte
 * positions move with the length of every FString ahead of them (the package name, the
 * localization id, the two engine-version branch names). Hence: walk it, record where they landed.
 */
function readSummaryTail(r: Reader, packageFlags: number, ue5: number) {
  r.skip(4 * 2); // SoftPackageReferencesCount, SoftPackageReferencesOffset
  r.i32(); // SearchableNamesOffset
  r.i32(); // ThumbnailTableOffset
  r.guid(); // Guid
  if (!(packageFlags & PKG_FILTER_EDITOR_ONLY)) r.guid(); // PersistentGuid
  r.skip(r.i32() * 8); // Generations: (ExportCount, NameCount) each
  readEngineVersion(r); // SavedByEngineVersion
  readEngineVersion(r); // CompatibleWithEngineVersion
  r.u32(); // CompressionFlags
  r.skip(r.i32() * 16); // CompressedChunks - always empty in modern packages
  r.u32(); // PackageSource
  r.skip(r.i32() * 4); // AdditionalPackagesToCook - FString array, always empty
  r.i32(); // AssetRegistryDataOffset
  const bulkDataStartOffsetAt = r.pos;
  r.i64();
  r.i32(); // WorldTileInfoDataOffset
  r.skip(r.i32() * 4); // ChunkIDs
  r.i32(); // PreloadDependencyCount
  r.i32(); // PreloadDependencyOffset
  if (ue5 >= UE5_NAMES_REFERENCED_FROM_EXPORT_DATA) r.i32(); // NamesReferencedFromExportDataCount
  const payloadTocOffsetAt = ue5 >= UE5_PAYLOAD_TOC ? r.pos : null;
  if (payloadTocOffsetAt !== null) r.i64();
  if (ue5 >= UE5_DATA_RESOURCES) r.i32(); // DataResourceOffset
  return { bulkDataStartOffsetAt, payloadTocOffsetAt, end: r.pos };
}

function readSummary(r: Reader): UassetSummary {
  const tag = r.u32();
  if (tag !== PACKAGE_FILE_TAG) {
    throw new Error(
      `not a .uasset: expected tag 0x${PACKAGE_FILE_TAG.toString(16)}, got 0x${tag.toString(16)}`,
    );
  }
  const legacyFileVersion = r.i32();
  if (legacyFileVersion !== -4) r.i32(); // LegacyUE3Version
  const fileVersionUE4 = r.i32();
  // Only packages at LegacyFileVersion -8 or older carry a separate UE5 version.
  const fileVersionUE5 = legacyFileVersion <= -8 ? r.i32() : 0;
  const fileVersionLicenseeUE4 = r.i32();

  const customVersions: { key: string; version: number }[] = [];
  const customVersionCount = r.i32();
  for (let i = 0; i < customVersionCount; i++) {
    customVersions.push({ key: r.guid(), version: r.i32() });
  }

  const totalHeaderSize = r.i32();
  const packageName = r.fstring();
  const packageFlags = r.u32();
  const nameCount = r.i32();
  const nameOffset = r.i32();
  if (fileVersionUE5 >= UE5_ADD_SOFTOBJECTPATH_LIST) {
    r.i32(); // SoftObjectPathsCount
    r.i32(); // SoftObjectPathsOffset
  }
  const localizationId = r.fstring();
  r.i32(); // GatherableTextDataCount
  r.i32(); // GatherableTextDataOffset
  const exportCount = r.i32();
  const exportOffset = r.i32();
  const importCount = r.i32();
  const importOffset = r.i32();
  const dependsOffset = r.i32();

  // The tail is only trustworthy if it lands exactly on the name table; if it does not, we
  // mis-modelled some field and the writer must refuse rather than corrupt the summary.
  let tail: { bulkDataStartOffsetAt: number; payloadTocOffsetAt: number | null } | null = null;
  try {
    const t = readSummaryTail(r, packageFlags, fileVersionUE5);
    if (t.end === nameOffset) tail = t;
    else logger.warn(`summary tail ended at ${t.end}, expected name table at ${nameOffset}`);
  } catch (e) {
    logger.warn(`could not read summary tail: ${(e as Error).message}`);
  }

  return {
    legacyFileVersion,
    fileVersionUE4,
    fileVersionUE5,
    fileVersionLicenseeUE4,
    customVersions,
    totalHeaderSize,
    packageName,
    packageFlags,
    localizationId,
    nameCount,
    nameOffset,
    exportCount,
    exportOffset,
    importCount,
    importOffset,
    dependsOffset,
    bulkDataStartOffsetAt: tail?.bulkDataStartOffsetAt ?? null,
    payloadTocOffsetAt: tail?.payloadTocOffsetAt ?? null,
  };
}

const readNameTable = (r: Reader, summary: UassetSummary) => {
  r.pos = summary.nameOffset;
  const names: string[] = [];
  for (let i = 0; i < summary.nameCount; i++) {
    names.push(r.fstring());
    r.skip(4); // FNameEntry hashes: two uint16 (case-preserving and not)
  }
  return names;
};

/**
 * Import and export entries are fixed-stride records whose exact field list drifts between engine
 * versions, so the stride is derived from the table bounds instead of hardcoded - only the leading
 * fields we actually use are decoded.
 */
function readImports(r: Reader, summary: UassetSummary, names: string[]): UassetImport[] {
  const { importOffset, importCount, exportOffset } = summary;
  if (importCount === 0) return [];
  const stride = (exportOffset - importOffset) / importCount;
  const imports: UassetImport[] = [];
  for (let i = 0; i < importCount; i++) {
    r.pos = importOffset + i * stride;
    imports.push({
      classPackage: readName(r, names),
      className: readName(r, names),
      outerIndex: r.i32(),
      objectName: readName(r, names),
      packageName: readName(r, names),
    });
  }
  return imports;
}

function readExports(r: Reader, summary: UassetSummary, names: string[], imports: UassetImport[]) {
  const { exportOffset, exportCount, dependsOffset } = summary;
  if (exportCount === 0) return { exports: [], stride: 0 };
  const stride = (dependsOffset - exportOffset) / exportCount;
  const exports: UassetExport[] = [];
  for (let i = 0; i < exportCount; i++) {
    r.pos = exportOffset + i * stride;
    const classIndex = r.i32();
    r.i32(); // SuperIndex
    r.i32(); // TemplateIndex
    r.i32(); // OuterIndex
    const objectName = readName(r, names);
    r.u32(); // ObjectFlags
    const serialSize = r.i64();
    const serialOffset = r.i64();
    exports.push({
      objectName,
      // FPackageIndex: negative is an import, positive a (1-based) export, 0 is null.
      className: classIndex < 0 ? (imports[-classIndex - 1]?.objectName ?? null) : null,
      serialOffset,
      serialSize,
    });
  }
  return { exports, stride };
}

function readTaggedProperties(
  r: Reader,
  names: string[],
  end: number,
): Record<string, PropertyValue> {
  const out: Record<string, PropertyValue> = {};
  while (r.pos < end) {
    const name = readName(r, names);
    if (name === "None") break;
    const type = readTypeName(r, names);
    const size = r.i32();
    const flags = r.u8();
    if (flags & TAG_HAS_ARRAY_INDEX) r.i32();
    if (flags & TAG_HAS_PROPERTY_GUID) r.guid();
    if (flags & TAG_HAS_PROPERTY_EXTENSIONS) {
      // `EPropertyTagExtension` bitfield; `OverridableInformation` adds an operation byte and a
      // bool after it. Never seen in these packages, but mis-sizing it would desynchronise the
      // whole property list rather than a single value.
      const ext = r.u8();
      if (ext & TAG_EXT_OVERRIDABLE_INFORMATION) r.skip(2);
    }

    // A bool carries its value in the flags and occupies no bytes at all.
    if (type.name === "BoolProperty" && size === 0) {
      out[name] = (flags & TAG_BOOL_TRUE) !== 0;
      continue;
    }

    const valueEnd = r.pos + size;
    let value: PropertyValue;
    try {
      value =
        flags & TAG_HAS_BINARY_OR_NATIVE_SERIALIZE
          ? undefined
          : readValue(r, names, type, valueEnd);
    } catch {
      value = undefined;
    }
    if (value === undefined || r.pos !== valueEnd) {
      // Natively serialised, undecodable, or decoded to the wrong length. Either way the tag told
      // us how long the value is, so keep its bytes and resynchronise rather than lose the export.
      value = { [RAW_BYTES]: r.buf.subarray(valueEnd - size, valueEnd).toString("hex") };
      r.pos = valueEnd;
    }
    out[name] = value;
  }
  return out;
}

function readValue(r: Reader, names: string[], type: PropertyTypeName, end: number): PropertyValue {
  switch (type.name) {
    case "Int8Property":
      return r.buf.readInt8(r.pos++);
    case "ByteProperty":
      // Serialises as an FName when the property has an enum, as a raw byte otherwise. UE 5.4's
      // complete type names carry the enum as a parameter (`ByteProperty(EFoo)`), so ask the type
      // rather than guessing from the remaining length - which would be wrong for every element
      // but the last inside an array or map of byte enums.
      return type.params.length ? readName(r, names) : r.buf.readUInt8(r.pos++);
    case "EnumProperty":
      return readName(r, names);
    case "Int16Property": {
      const v = r.buf.readInt16LE(r.pos);
      r.pos += 2;
      return v;
    }
    case "UInt16Property": {
      const v = r.buf.readUInt16LE(r.pos);
      r.pos += 2;
      return v;
    }
    case "IntProperty":
      return r.i32();
    case "UInt32Property":
      return r.u32();
    case "Int64Property":
      return r.i64();
    case "FloatProperty":
      return r.f32();
    case "DoubleProperty":
      return r.f64();
    case "NameProperty":
      return readName(r, names);
    case "StrProperty":
      return r.fstring();
    case "ObjectProperty":
      return r.i32(); // FPackageIndex: >0 export, <0 import, 0 null
    case "ArrayProperty": {
      const count = r.i32();
      const items: PropertyValue[] = [];
      for (let i = 0; i < count; i++) items.push(readValue(r, names, type.params[0], end));
      return items;
    }
    case "SetProperty": {
      const removedCount = r.i32();
      for (let i = 0; i < removedCount; i++) readValue(r, names, type.params[0], end);
      const count = r.i32();
      const items: PropertyValue[] = [];
      for (let i = 0; i < count; i++) items.push(readValue(r, names, type.params[0], end));
      return items;
    }
    case "MapProperty": {
      const [keyType, valueType] = type.params;
      // The SDK's JSON dump calls these `KeysToRemove` and `Entries`; removals only appear in
      // packages saved over an existing map, but they shift every following byte when they do.
      const removedCount = r.i32();
      for (let i = 0; i < removedCount; i++) readValue(r, names, keyType, end);
      const count = r.i32();
      const map: Record<string, PropertyValue> = {};
      for (let i = 0; i < count; i++) {
        const key = readValue(r, names, keyType, end);
        map[String(key)] = readValue(r, names, valueType, end);
      }
      return map;
    }
    case "StructProperty":
      return readTaggedProperties(r, names, end);
    default:
      throw new Error(`unhandled property type ${formatTypeName(type)} at offset ${r.pos}`);
  }
}

/** Parse a `.uasset` file into its summary, name table, imports and exports-with-properties. */
export function parseUasset(file: string): Uasset {
  const r = new Reader(readFileSync(file));
  const summary = readSummary(r);
  const names = readNameTable(r, summary);
  const imports = readImports(r, summary, names);
  const { exports, stride: exportStride } = readExports(r, summary, names, imports);

  // Tagged property values are only readable here in the UE 5.4 complete-type-name format; the
  // legacy Type/InnerType/StructName layout is a different parser and not implemented.
  if (summary.fileVersionUE5 < UE5_PROPERTY_TAG_COMPLETE_TYPE_NAME) {
    logger.warn(
      `${file}: FileVersionUE5 ${summary.fileVersionUE5} predates complete property type names,` +
        ` reading header only`,
    );
    return { summary, exportStride, names, imports, exports };
  }

  for (const exp of exports) {
    if (!exp.serialSize) continue;
    // These serialise natively (MetaData is a TMap<FName, TMap<FName, FString>>), so attempting a
    // tagged-property read only produces a warning about garbage.
    if (exp.className && NATIVELY_SERIALISED_EXPORTS.has(exp.className)) continue;
    r.pos = exp.serialOffset;
    r.u8(); // __SerializationControlExtensions
    try {
      exp.properties = readTaggedProperties(r, names, exp.serialOffset + exp.serialSize);
    } catch (e) {
      logger.warn(`could not read properties of export ${exp.objectName}: ${(e as Error).message}`);
    }
  }

  return { summary, exportStride, names, imports, exports };
}

/**
 * Writing is supported for `LocalizationModTextToolAsset` packages only - the SDK's per-mod text
 * assets, whose single export is a `LocalizedTexts` array of `{ SID, LanguagesToLocalizedStrings }`.
 *
 * That one export is re-serialised and spliced back in, patching the handful of offsets that move
 * as a result; everything else in the package is copied through untouched. Deliberately does not
 * generalise to other asset types - there is no general property writer here.
 */

export type LocalizedTextEntry = {
  SID: string;
  LanguagesToLocalizedStrings: Record<string, string>;
};

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
  const { summary, exportStride } = parsed;
  if (summary.bulkDataStartOffsetAt === null)
    throw new Error(`${file}: summary tail did not decode, refusing to write`);
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
  // summary offsets that point past the export data. Every other offset in the package lives
  // inside the header, which we do not touch.
  const exportField = (i: number, at: number) => summary.exportOffset + i * exportStride + at;
  out.writeBigInt64LE(BigInt(payload.length), exportField(index, EXPORT_SERIAL_SIZE_AT));
  for (let i = index + 1; i < parsed.exports.length; i++) {
    const at = exportField(i, EXPORT_SERIAL_OFFSET_AT);
    out.writeBigInt64LE(BigInt(parsed.exports[i].serialOffset + delta), at);
  }
  for (const at of [summary.bulkDataStartOffsetAt, summary.payloadTocOffsetAt]) {
    if (at === null) continue; // PayloadTocOffset predates this package's engine version
    const value = Number(out.readBigInt64LE(at));
    // Both fields use INDEX_NONE when absent; shifting a sentinel would turn it into an offset.
    if (value > 0) out.writeBigInt64LE(BigInt(value + delta), at);
  }

  writeFileSync(file, out);
  return out.length;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [file] = process.argv.slice(2);
  if (!file) {
    logger.error("usage: localization-uasset.mts <file.uasset>");
    process.exit(1);
  }
  const { summary, imports, exports } = parseUasset(file);
  logger.log(
    JSON.stringify(
      {
        summary,
        imports,
        exports: Object.fromEntries(exports.map((e) => [e.objectName, e])),
      },
      (_k, v) => (typeof v === "bigint" ? Number(v) : v),
      2,
    ),
  );
}
