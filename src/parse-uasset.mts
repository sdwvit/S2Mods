import { readFileSync } from "node:fs";
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
};

export type Uasset = {
  summary: UassetSummary;
  names: string[];
  imports: UassetImport[];
  exports: UassetExport[];
};

const PACKAGE_FILE_TAG = 0x9e2a83c1;

/** `EPropertyTagFlags` (UE 5.4). */
const TAG_HAS_ARRAY_INDEX = 1 << 0;
const TAG_HAS_PROPERTY_GUID = 1 << 1;
const TAG_HAS_PROPERTY_EXTENSIONS = 1 << 2;
const TAG_HAS_BINARY_OR_NATIVE_SERIALIZE = 1 << 3;
const TAG_BOOL_TRUE = 1 << 4;
/**
 * Native structs (`Guid`, vectors, ...) serialise as opaque binary rather than tagged properties,
 * and there is no schema in the package to tell us their layout. Those are surfaced as raw bytes
 * rather than silently dropped, keyed by this field.
 */
export const RAW_BYTES = "__rawBytes";

class Reader {
  constructor(
    readonly buf: Buffer,
    public pos = 0,
  ) {}

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
  const fileVersionUE5 = r.i32();
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
  r.i32(); // SoftObjectPathsCount
  r.i32(); // SoftObjectPathsOffset
  const localizationId = r.fstring();
  r.i32(); // GatherableTextDataCount
  r.i32(); // GatherableTextDataOffset
  const exportCount = r.i32();
  const exportOffset = r.i32();
  const importCount = r.i32();
  const importOffset = r.i32();
  const dependsOffset = r.i32();

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
  };
}

const readNameTable = (r: Reader, summary: UassetSummary) => {
  r.pos = summary.nameOffset;
  const names: string[] = [];
  for (let i = 0; i < summary.nameCount; i++) {
    names.push(r.fstring());
    r.pos += 4; // FNameEntry hashes
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
  if (exportCount === 0) return [];
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
      className: classIndex < 0 ? (imports[-classIndex - 1]?.objectName ?? null) : null,
      serialOffset,
      serialSize,
    });
  }
  return exports;
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
    if (flags & TAG_HAS_PROPERTY_EXTENSIONS) r.u8();

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
      // Serialises as an FName when the tag names an enum, as a raw byte otherwise.
      return end - r.pos === 8 ? readName(r, names) : r.buf.readUInt8(r.pos++);
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
  const exports = readExports(r, summary, names, imports);

  for (const exp of exports) {
    if (!exp.serialSize) continue;
    r.pos = exp.serialOffset;
    r.u8(); // __SerializationControlExtensions
    try {
      exp.properties = readTaggedProperties(r, names, exp.serialOffset + exp.serialSize);
    } catch (e) {
      logger.warn(`could not read properties of export ${exp.objectName}: ${(e as Error).message}`);
    }
  }

  return { summary, names, imports, exports };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [file] = process.argv.slice(2);
  if (!file) {
    logger.error("usage: parse-uasset.mts <file.uasset>");
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
