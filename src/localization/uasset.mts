import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../logger.mts";

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
  /** Byte position of `PackageName`'s length prefix - a rename resizes the summary from here. */
  packageNameAt: number;
  /** ...and of `LocalizationId`'s, which a rename rewrites in place (same length). */
  localizationIdAt: number;
  /** `NameOffset` is the one header offset a name-table resize does *not* move, so it is separate. */
  nameOffsetAt: number;
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
  /**
   * Byte offset *of* `AssetRegistryDataOffset`. The section it points at opens with an `int64`
   * offset to the package's dependency data, which the writer must shift along with the section.
   */
  assetRegistryDataOffsetAt: number | null;
  /** Byte offset of `NameCount`, so a writer that appends names can correct it. */
  nameCountAt: number;
  /** Every `Generations[i].NameCount`: a second copy of the name count the writer must keep true. */
  generationNameCountsAt: number[];
  /**
   * Byte offset of `NamesReferencedFromExportDataCount`, or `null` before UE5 1001. It is a hint
   * for the cooker's name batching, not a real bound, so a writer that appends names referenced
   * from export data just raises it to the new name count.
   */
  namesReferencedFromExportDataCountAt: number | null;
  /**
   * Every summary field holding a file offset that lies *after* the name table, so inserting name
   * entries can shift them all. `bulkDataStartOffsetAt` / `payloadTocOffsetAt` are excluded - they
   * point past the export data and so also move with the export payload, and are patched
   * separately. `NameOffset` itself is excluded: the table does not move, it only grows.
   */
  postNameOffsetFieldsAt: { at: number; bytes: 4 | 8 }[];
};

export type Uasset = {
  summary: UassetSummary;
  /** First byte after the last name entry - where a writer appends new ones. */
  nameTableEnd: number;
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
  const offsets: { at: number; bytes: 4 | 8 }[] = [];
  /** Reads an offset field, remembering where it was so the writer can shift it. */
  const offset32 = () => {
    offsets.push({ at: r.pos, bytes: 4 });
    return r.i32();
  };
  r.i32(); // SoftPackageReferencesCount
  offset32(); // SoftPackageReferencesOffset
  offset32(); // SearchableNamesOffset
  offset32(); // ThumbnailTableOffset
  r.guid(); // Guid
  if (!(packageFlags & PKG_FILTER_EDITOR_ONLY)) r.guid(); // PersistentGuid
  // Generations: (ExportCount, NameCount) each. The last generation's NameCount mirrors the
  // summary's - the editor trusts it, so a writer that grows the name table has to grow it too.
  const generationCount = r.i32();
  const generationNameCountsAt: number[] = [];
  for (let i = 0; i < generationCount; i++) {
    r.i32(); // ExportCount
    generationNameCountsAt.push(r.pos);
    r.i32(); // NameCount
  }
  readEngineVersion(r); // SavedByEngineVersion
  readEngineVersion(r); // CompatibleWithEngineVersion
  r.u32(); // CompressionFlags
  r.skip(r.i32() * 16); // CompressedChunks - always empty in modern packages
  r.u32(); // PackageSource
  r.skip(r.i32() * 4); // AdditionalPackagesToCook - FString array, always empty
  const assetRegistryDataOffsetAt = r.pos;
  offset32(); // AssetRegistryDataOffset
  const bulkDataStartOffsetAt = r.pos;
  r.i64();
  offset32(); // WorldTileInfoDataOffset
  r.skip(r.i32() * 4); // ChunkIDs
  r.i32(); // PreloadDependencyCount
  offset32(); // PreloadDependencyOffset
  let namesReferencedFromExportDataCountAt: number | null = null;
  if (ue5 >= UE5_NAMES_REFERENCED_FROM_EXPORT_DATA) {
    namesReferencedFromExportDataCountAt = r.pos;
    r.i32();
  }
  const payloadTocOffsetAt = ue5 >= UE5_PAYLOAD_TOC ? r.pos : null;
  if (payloadTocOffsetAt !== null) r.i64();
  if (ue5 >= UE5_DATA_RESOURCES) offset32(); // DataResourceOffset
  return {
    generationNameCountsAt,
    assetRegistryDataOffsetAt,
    bulkDataStartOffsetAt,
    payloadTocOffsetAt,
    namesReferencedFromExportDataCountAt,
    offsets,
    end: r.pos,
  };
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

  const postNameOffsetFieldsAt: { at: number; bytes: 4 | 8 }[] = [];
  /** Reads an offset field, remembering where it was so the writer can shift it. */
  const offset32 = () => {
    postNameOffsetFieldsAt.push({ at: r.pos, bytes: 4 });
    return r.i32();
  };

  // TotalHeaderSize is the end of the header, so it moves with everything the name table pushes.
  const totalHeaderSize = offset32();
  const packageNameAt = r.pos;
  const packageName = r.fstring();
  const packageFlags = r.u32();
  const nameCountAt = r.pos;
  const nameCount = r.i32();
  const nameOffsetAt = r.pos;
  const nameOffset = r.i32();
  if (fileVersionUE5 >= UE5_ADD_SOFTOBJECTPATH_LIST) {
    r.i32(); // SoftObjectPathsCount
    offset32(); // SoftObjectPathsOffset
  }
  const localizationIdAt = r.pos;
  const localizationId = r.fstring();
  r.i32(); // GatherableTextDataCount
  offset32(); // GatherableTextDataOffset
  const exportCount = r.i32();
  const exportOffset = offset32();
  const importCount = r.i32();
  const importOffset = offset32();
  const dependsOffset = offset32();

  // The tail is only trustworthy if it lands exactly on the name table; if it does not, we
  // mis-modelled some field and the writer must refuse rather than corrupt the summary.
  let tail: ReturnType<typeof readSummaryTail> | null = null;
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
    packageNameAt,
    localizationIdAt,
    nameOffsetAt,
    packageFlags,
    localizationId,
    nameCount,
    nameOffset,
    exportCount,
    exportOffset,
    importCount,
    importOffset,
    dependsOffset,
    assetRegistryDataOffsetAt: tail?.assetRegistryDataOffsetAt ?? null,
    bulkDataStartOffsetAt: tail?.bulkDataStartOffsetAt ?? null,
    payloadTocOffsetAt: tail?.payloadTocOffsetAt ?? null,
    nameCountAt,
    generationNameCountsAt: tail?.generationNameCountsAt ?? [],
    namesReferencedFromExportDataCountAt: tail?.namesReferencedFromExportDataCountAt ?? null,
    postNameOffsetFieldsAt: [...postNameOffsetFieldsAt, ...(tail?.offsets ?? [])],
  };
}

const readNameTable = (r: Reader, summary: UassetSummary) => {
  r.pos = summary.nameOffset;
  const names: string[] = [];
  for (let i = 0; i < summary.nameCount; i++) {
    names.push(r.fstring());
    r.skip(4); // FNameEntry hashes: two uint16 (case-preserving and not)
  }
  return { names, end: r.pos };
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
  const { names, end: nameTableEnd } = readNameTable(r, summary);
  const imports = readImports(r, summary, names);
  const { exports, stride: exportStride } = readExports(r, summary, names, imports);

  // Tagged property values are only readable here in the UE 5.4 complete-type-name format; the
  // legacy Type/InnerType/StructName layout is a different parser and not implemented.
  if (summary.fileVersionUE5 < UE5_PROPERTY_TAG_COMPLETE_TYPE_NAME) {
    logger.warn(
      `${file}: FileVersionUE5 ${summary.fileVersionUE5} predates complete property type names,` +
        ` reading header only`,
    );
    return { summary, nameTableEnd, exportStride, names, imports, exports };
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

  return { summary, nameTableEnd, exportStride, names, imports, exports };
}

/**
 * Writing is supported for the two localization asset shapes only:
 *
 * - `LocalizationModTextToolAsset` - the SDK's per-mod text asset, authored in the Mod Editor's
 *   Text Tool, whose single export is a `LocalizedTexts` array of
 *   `{ SID, LanguagesToLocalizedStrings }`. This is the mod's *source* of text.
 * - `ModLocalizationDatabaseDataAsset` - the `Autogenerated_<n>_LocalizationDatabase` package the
 *   Mod Editor emits at cook time by gathering the above, whose single export is a
 *   `LocalizationDatabase` map from SID to the same language map. This is what the *game* reads.
 *
 * That one export is re-serialised and spliced back in, patching the handful of offsets that move
 * as a result; everything else in the package is copied through untouched. Deliberately does not
 * generalise to arbitrary asset types - there is no general property writer here.
 */

export type LocalizedTextEntry = {
  SID: string;
  LanguagesToLocalizedStrings: Record<string, string>;
};

const EXPORT_SERIAL_SIZE_AT = 28;
const EXPORT_SERIAL_OFFSET_AT = 36;
/**
 * `ScriptSerializationEndOffset`: where the export's tagged-property block ends, relative to the
 * export's own data. It is `SerialSize - 4` in every asset the Mod Editor has written here, so it
 * moves with the payload; left stale, the editor stops reading properties mid-entry.
 */
const EXPORT_SCRIPT_SERIALIZATION_END_AT = 104;

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

/**
 * Resolves an FName to its table index, appending it to `names` if it is not there yet - the SDK
 * hands out a text asset whose name table holds nothing but the package's own names, so every
 * language key and property name has to be added on the first write.
 */
const nameIndex = (names: string[], name: string) => {
  const i = names.indexOf(name);
  return i === -1 ? names.push(name) - 1 : i;
};

/** CRC table for `FCrc::Strihash_DEPRECATED`: polynomial 0x04C11DB7, MSB-first. */
const STRIHASH_TABLE = Array.from({ length: 256 }, (_, i) => {
  let c = i << 24;
  for (let bit = 0; bit < 8; bit++) c = c & 0x8000_0000 ? (c << 1) ^ 0x04c1_1db7 : c << 1;
  return c >>> 0;
});

/** Standard reflected CRC-32 table, as `FCrc::CRCTablesSB8[0]` used by `FCrc::StrCrc32`. */
const CRC32_TABLE = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let bit = 0; bit < 8; bit++) c = c & 1 ? (c >>> 1) ^ 0xedb8_8320 : c >>> 1;
  return c >>> 0;
});

/**
 * `FCrc::Strihash_DEPRECATED` - the case-insensitive hash `FNameEntrySerialized` stores first.
 * One byte per character (all FNames in these packages are ASCII, which `assertAscii` enforces).
 */
const strihash = (name: string) => {
  let hash = 0;
  for (const ch of name.toUpperCase())
    hash = (((hash >>> 8) & 0x00ff_ffff) ^ STRIHASH_TABLE[(hash ^ ch.charCodeAt(0)) & 0xff]) >>> 0;
  return hash & 0xffff;
};

/** `FCrc::StrCrc32` - the case-preserving hash, four bytes per character. */
const strCrc32 = (name: string) => {
  let crc = 0xffff_ffff;
  for (const ch of name) {
    let v = ch.charCodeAt(0);
    for (let byte = 0; byte < 4; byte++) {
      crc = ((crc >>> 8) ^ CRC32_TABLE[(crc ^ v) & 0xff]) >>> 0;
      v >>>= 8;
    }
  }
  return ~crc & 0xffff;
};

/**
 * How the editor orders the export-data half of the name table: case-insensitively, with case as
 * the tiebreak. Only the order has to match - nothing reads the names positionally - but matching
 * it keeps a rewritten asset byte-identical to one the editor saved.
 */
const compareNames = (a: string, b: string) =>
  a.toLowerCase() < b.toLowerCase()
    ? -1
    : a.toLowerCase() > b.toLowerCase()
      ? 1
      : a < b
        ? -1
        : a > b
          ? 1
          : 0;

/** FName index positions inside an import record, relative to the record's start. */
const IMPORT_NAME_FIELDS_AT = [0, 8, 20, 28];
/** ...and inside an export record: `ObjectName`. */
const EXPORT_OBJECT_NAME_AT = 16;
/** `PackageMetaData`'s payload is not tagged properties; its two FName fields sit at these bytes. */
const METADATA_NAME_FIELDS_AT = [1, 21];

/**
 * The names referenced by every export's data *except* the localization payload - i.e. the part of
 * `NamesReferencedFromExportData` a rewrite has to preserve without knowing what the old payload
 * used. Only `PackageMetaData` has any in this package shape.
 */
const metadataNames = (original: Buffer, parsed: Uasset): string[] =>
  parsed.exports
    .filter((e) => e.className === "MetaData")
    .flatMap((e) =>
      METADATA_NAME_FIELDS_AT.map((at) => parsed.names[original.readInt32LE(e.serialOffset + at)]),
    )
    .filter((name) => name !== undefined);

/** An `FNameEntrySerialized`: the string, then its non-case-preserving and case-preserving hash. */
const serializeNameEntries = (names: string[]) => {
  const w = new Writer();
  for (const name of names) {
    if (!/^[\x00-\x7f]*$/.test(name)) throw new Error(`cannot hash non-ASCII FName "${name}"`);
    w.fstring(name);
    const hashes = Buffer.alloc(4);
    hashes.writeUInt16LE(strihash(name), 0);
    hashes.writeUInt16LE(strCrc32(name), 2);
    w.raw(hashes);
  }
  return w.toBuffer();
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

/**
 * Serialises the `LocalizedTexts` export's bytes. `names` is the package name table and is
 * **mutated**: any FName the payload needs and the table lacks is appended, so the caller can
 * splice the new entries into the table afterwards (see `writeLocalizedTexts`).
 */
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

/**
 * Serialises the `LocalizationDatabase` export's bytes - the *other* shape of this data: where the
 * text asset holds an array of `{ SID, LanguagesToLocalizedStrings }`, the database asset holds a
 * `TMap<FString, FModLocalizationLocalizedStringsContainer>` keyed by the SID, with the same
 * language map inside. `names` is mutated exactly as `serializeLocalizedTexts` mutates it.
 */
export function serializeLocalizationDatabase(
  names: string[],
  entries: LocalizedTextEntry[],
): Buffer {
  const map = new Writer();
  map.i32(0); // KeysToRemove
  map.i32(entries.length);
  for (const entry of entries) {
    map.fstring(entry.SID); // the key: a bare StrProperty value, no tag of its own
    const langs = new Writer();
    langs.i32(0); // KeysToRemove
    const pairs = Object.entries(entry.LanguagesToLocalizedStrings);
    langs.i32(pairs.length);
    for (const [language, text] of pairs) {
      writeName(langs, names, language);
      langs.fstring(text);
    }
    writeTag(
      map,
      names,
      "LanguagesToLocalizedStrings",
      () => {
        writeName(map, names, "MapProperty");
        map.i32(2);
        writeTypeName(map, names, "EnumProperty", [
          ["ELocalizationLanguage", "/Script/Stalker2"],
          ["ByteProperty"],
        ]);
        writeTypeName(map, names, "StrProperty");
      },
      langs.toBuffer(),
    );
    writeName(map, names, "None"); // end of the container struct
  }

  const out = new Writer();
  out.u8(0); // __SerializationControlExtensions
  writeTag(
    out,
    names,
    "LocalizationDatabase",
    () => {
      writeName(out, names, "MapProperty");
      out.i32(2);
      writeTypeName(out, names, "StrProperty");
      writeTypeName(out, names, "StructProperty", [
        ["ModLocalizationLocalizedStringsContainer", "/Script/Stalker2"],
      ]);
    },
    map.toBuffer(),
  );
  writeName(out, names, "None"); // end of export
  out.i32(0); // same trailer the text asset carries
  return out.toBuffer();
}

/** An `FString` as the summary and the asset registry store it: length prefix, bytes, NUL. */
const fstringBytes = (value: string) => {
  if (/[^\x20-\x7e]/.test(value)) throw new Error(`${value}: package names must be ASCII`);
  const out = Buffer.alloc(4 + value.length + 1);
  out.writeInt32LE(value.length + 1, 0);
  out.write(value, 4, "latin1");
  return out;
};

/** Replace `[at, at + length)` with `bytes`. */
type ByteEdit = { at: number; length: number; bytes: Buffer };

/**
 * Splice non-overlapping `edits` into `original` and hand back a `shift()` that maps any byte
 * position in the original to where it ended up. Every offset stored in the package - in the
 * summary, in the export table, inside the asset registry section - is patched through it, so a
 * rename does not have to know which of its edits sits in front of which offset.
 */
function applyEdits(original: Buffer, edits: ByteEdit[]) {
  const sorted = [...edits].sort((a, b) => a.at - b.at);
  const parts: Buffer[] = [];
  let at = 0;
  for (const edit of sorted) {
    if (edit.at < at) throw new Error(`overlapping edit at ${edit.at}`);
    parts.push(original.subarray(at, edit.at), edit.bytes);
    at = edit.at + edit.length;
  }
  parts.push(original.subarray(at));
  const shift = (pos: number) =>
    pos +
    sorted
      .filter((edit) => edit.at < pos)
      .reduce((delta, edit) => delta + edit.bytes.length - edit.length, 0);
  return { out: Buffer.concat(parts), shift };
}

/**
 * Write `file` out as `dest` under a new package name, i.e. mint a new text asset from an existing
 * one. This is what lets a mod's first localization asset be generated instead of created by hand
 * in the Mod Editor: the fixture in `fixtures/empty-localization.uasset` is some other mod's
 * package, and this rewrites every place its identity is spelled.
 *
 * `packageName` is the mount path the cooker will address the asset by: `/<SdkModName>/<AssetName>`
 * for a package sitting at the root of the SDK mod's `Content/`.
 *
 * The identity is in four kinds of places, and the last one is the reason this cannot be a string
 * replace: the summary's `PackageName` and the asset registry's `ObjectPath`/asset-name strings are
 * length-prefixed `FString`s, the name table holds both the full path and the short name as
 * `FName`s (hashed, and the export-data half is sorted, so a rename can reorder it), and
 * `LocalizationId` namespaces the package's gathered text - two mods must not share one, so it is
 * derived from the new name rather than inherited.
 */
export function renameLocalizationPackage(file: string, packageName: string, dest: string) {
  const original = readFileSync(file);
  const parsed = parseUasset(file);
  const { summary } = parsed;
  if (summary.bulkDataStartOffsetAt === null)
    throw new Error(`${file}: summary tail did not decode, refusing to write`);
  if (summary.packageName === packageName) {
    if (dest !== file) writeFileSync(dest, original);
    return original.length;
  }

  const shortOf = (name: string) => name.slice(name.lastIndexOf("/") + 1);
  const spellings: [string, string][] = [
    [summary.packageName, packageName],
    [shortOf(summary.packageName), shortOf(packageName)],
  ];
  const rename = (name: string) => spellings.find(([from]) => from === name)?.[1] ?? name;

  // The name table: substitute, then re-sort the export-data half the way the editor keeps it.
  const nrefAt = summary.namesReferencedFromExportDataCountAt;
  const oldRef = nrefAt === null ? parsed.names.length : original.readInt32LE(nrefAt);
  const names = [
    ...parsed.names.slice(0, oldRef).map(rename).sort(compareNames),
    ...parsed.names.slice(oldRef).map(rename),
  ];
  if (new Set(names).size !== names.length)
    throw new Error(
      `${file}: renaming to ${packageName} collides with a name already in the table`,
    );
  const remap = new Map(parsed.names.map((name, i) => [i, names.indexOf(rename(name))]));

  const edits: ByteEdit[] = [
    {
      at: summary.packageNameAt,
      length: fstringBytes(summary.packageName).length,
      bytes: fstringBytes(packageName),
    },
    {
      at: summary.nameOffset,
      length: parsed.nameTableEnd - summary.nameOffset,
      bytes: serializeNameEntries(names),
    },
  ];

  // The localization id, in the summary and again in PackageMetaData's
  // PackageLocalizationNamespace. Same length, so this shifts nothing.
  const localizationId = createHash("md5").update(packageName).digest("hex").toUpperCase();
  if (localizationId.length !== summary.localizationId.length)
    throw new Error(`${file}: unexpected localization id ${summary.localizationId}`);
  for (
    let at = original.indexOf(summary.localizationId, 0, "latin1");
    at !== -1;
    at = original.indexOf(summary.localizationId, at + 1, "latin1")
  )
    edits.push({
      at,
      length: localizationId.length,
      bytes: Buffer.from(localizationId, "latin1"),
    });

  // The asset registry section spells the asset out again, as plain FStrings. They sit between the
  // depends table and the end of the header; anything matching a spelling *and* carrying the right
  // length prefix is one of them.
  for (const [from, to] of spellings)
    for (
      let at = original.indexOf(`${from}\0`, summary.dependsOffset, "latin1");
      at !== -1 && at < summary.totalHeaderSize;
      at = original.indexOf(`${from}\0`, at + 1, "latin1")
    ) {
      if (original.readInt32LE(at - 4) !== from.length + 1) continue;
      edits.push({ at: at - 4, length: from.length + 5, bytes: fstringBytes(to) });
    }

  const { out, shift } = applyEdits(original, edits);

  /** Patch a stored file offset: both the field's own position and its value have moved. */
  const shiftStoredOffset = (at: number, bytes: 4 | 8) => {
    const to = shift(at);
    const value = bytes === 4 ? out.readInt32LE(to) : Number(out.readBigInt64LE(to));
    if (value <= 0) return; // absent tables store 0 or INDEX_NONE; shifting one invents an offset
    if (bytes === 4) out.writeInt32LE(shift(value), to);
    else out.writeBigInt64LE(BigInt(shift(value)), to);
  };

  shiftStoredOffset(summary.nameOffsetAt, 4);
  for (const { at, bytes } of summary.postNameOffsetFieldsAt) shiftStoredOffset(at, bytes);
  for (const at of [summary.bulkDataStartOffsetAt, summary.payloadTocOffsetAt]) {
    if (at !== null) shiftStoredOffset(at, 8);
  }
  for (let i = 0; i < parsed.exports.length; i++) {
    shiftStoredOffset(summary.exportOffset + i * parsed.exportStride + EXPORT_SERIAL_OFFSET_AT, 8);
  }
  // The asset registry section opens with a file offset to its dependency data, and the four bytes
  // in front of the section are one too.
  const sectionAt = original.readInt32LE(summary.assetRegistryDataOffsetAt!);
  if (sectionAt > 0) {
    shiftStoredOffset(sectionAt - 4, 4);
    shiftStoredOffset(sectionAt, 8);
  }

  // Every FName index outside the name table points into the old ordering.
  const remapAt = (at: number) => {
    const to = shift(at);
    const index = remap.get(out.readInt32LE(to));
    if (index === undefined || index < 0) throw new Error(`${file}: name index at ${at} is bad`);
    out.writeInt32LE(index, to);
  };
  const importStride =
    summary.importCount > 0
      ? (summary.exportOffset - summary.importOffset) / summary.importCount
      : 0;
  for (let i = 0; i < summary.importCount; i++)
    for (const at of IMPORT_NAME_FIELDS_AT) remapAt(summary.importOffset + i * importStride + at);
  for (let i = 0; i < parsed.exports.length; i++)
    remapAt(summary.exportOffset + i * parsed.exportStride + EXPORT_OBJECT_NAME_AT);
  for (const e of parsed.exports)
    if (e.className === "MetaData")
      for (const field of METADATA_NAME_FIELDS_AT) remapAt(e.serialOffset + field);

  writeFileSync(dest, out);
  return out.length;
}

/**
 * Re-serialises the one export of `file` whose class is `className` from `entries` and splices it
 * back in, patching the offsets, sizes and name indices that move as a result; `file` is only ever
 * read, so a mod can keep a template package as the input and put the result somewhere else.
 *
 * Both localization asset shapes go through here - they differ only in which export to replace and
 * how its payload serialises, which is what `serialize` supplies.
 */
function rewriteTextExport(
  file: string,
  className: string,
  serialize: (names: string[], entries: LocalizedTextEntry[]) => Buffer,
  entries: LocalizedTextEntry[],
  dest: string,
) {
  const original = readFileSync(file);
  const parsed = parseUasset(file);
  const { summary, exportStride, nameTableEnd } = parsed;
  if (summary.bulkDataStartOffsetAt === null)
    throw new Error(`${file}: summary tail did not decode, refusing to write`);
  const index = parsed.exports.findIndex((e) => e.className === className);
  if (index === -1) throw new Error(`${file} has no ${className} export`);
  const target = parsed.exports[index];

  // The editor lays the name table out in two parts: the names the export data references, sorted,
  // then the rest (package name, import and export object names) in load order.
  // `NamesReferencedFromExportDataCount` is the length of that first part, so a writer cannot just
  // append new names at the end - the count would have to cover the header names too, and the
  // editor errors on the mismatch. Rebuild both parts instead and remap every index that pointed
  // into the old table.
  const nrefAt = summary.namesReferencedFromExportDataCountAt;
  const oldRef = nrefAt === null ? parsed.names.length : original.readInt32LE(nrefAt);
  // What the payload alone references: serialising against an empty table collects exactly that.
  const payloadNames: string[] = [];
  serialize(payloadNames, entries);
  // The other exports' export data references names too (`MetaData` uses two) and those have to
  // stay. Take exactly those rather than the whole old prefix: keeping the prefix would carry
  // every name the *previous* entries used into the new table, so rewriting an asset with fewer
  // texts would leave orphans behind and the bytes would depend on what the file held before.
  const head = [...new Set([...metadataNames(original, parsed), ...payloadNames])].sort(
    compareNames,
  );
  const headSet = new Set(head);
  // A name can move from the tail into the prefix - `/Script/ModKitEditor` does, once export data
  // names it - and must not then appear twice.
  const names = [...head, ...parsed.names.slice(oldRef).filter((n) => !headSet.has(n))];
  const nameIndexBefore = names.length;
  const payload = serialize(names, entries);
  if (names.length !== nameIndexBefore) throw new Error(`${file}: name table grew while writing`);
  const newTable = serializeNameEntries(names);
  const nameDelta = newTable.length - (nameTableEnd - summary.nameOffset);
  const remap = new Map(parsed.names.map((name, i) => [i, names.indexOf(name)]));
  const delta = payload.length - target.serialSize;
  const out = Buffer.concat([
    original.subarray(0, summary.nameOffset),
    newTable,
    original.subarray(nameTableEnd, target.serialOffset),
    payload,
    original.subarray(target.serialOffset + target.serialSize),
  ]);

  out.writeInt32LE(names.length, summary.nameCountAt);
  for (const at of summary.generationNameCountsAt) out.writeInt32LE(names.length, at);
  if (nrefAt !== null) out.writeInt32LE(head.length, nrefAt);

  // Everything behind the name table shifts by `nameDelta`, and everything behind the rewritten
  // export by `delta` as well: the later exports' payloads, plus the two summary offsets that
  // point past the export data. Every other offset lives in the summary, which we walked to find.
  for (const { at, bytes } of summary.postNameOffsetFieldsAt) {
    const value = bytes === 4 ? out.readInt32LE(at) : Number(out.readBigInt64LE(at));
    // Absent tables use 0 or INDEX_NONE; shifting a sentinel would turn it into an offset.
    if (value <= 0) continue;
    if (bytes === 4) out.writeInt32LE(value + nameDelta, at);
    else out.writeBigInt64LE(BigInt(value + nameDelta), at);
  }

  const exportField = (i: number, at: number) =>
    summary.exportOffset + nameDelta + i * exportStride + at;
  out.writeBigInt64LE(BigInt(payload.length), exportField(index, EXPORT_SERIAL_SIZE_AT));
  const scriptEndAt = exportField(index, EXPORT_SCRIPT_SERIALIZATION_END_AT);
  out.writeInt32LE(out.readInt32LE(scriptEndAt) + delta, scriptEndAt);
  for (let i = 0; i < parsed.exports.length; i++) {
    const at = exportField(i, EXPORT_SERIAL_OFFSET_AT);
    const shift = nameDelta + (i > index ? delta : 0);
    out.writeBigInt64LE(BigInt(parsed.exports[i].serialOffset + shift), at);
  }
  // Every FName index outside the payload we just rebuilt points into the old table, so move them
  // all onto the new one. These are the only places this package shape stores one.
  const remapAt = (at: number) => {
    const to = remap.get(out.readInt32LE(at));
    if (to === undefined || to < 0) throw new Error(`${file}: name index at ${at} is out of range`);
    out.writeInt32LE(to, at);
  };
  const importStride =
    summary.importCount > 0
      ? (summary.exportOffset - summary.importOffset) / summary.importCount
      : 0;
  for (let i = 0; i < summary.importCount; i++)
    for (const at of IMPORT_NAME_FIELDS_AT)
      remapAt(summary.importOffset + nameDelta + i * importStride + at);
  for (let i = 0; i < parsed.exports.length; i++) remapAt(exportField(i, EXPORT_OBJECT_NAME_AT));
  for (let i = 0; i < parsed.exports.length; i++) {
    if (i === index || parsed.exports[i].className !== "MetaData") continue;
    const at = parsed.exports[i].serialOffset + nameDelta + (i > index ? delta : 0);
    for (const field of METADATA_NAME_FIELDS_AT) remapAt(at + field);
  }

  // The asset registry section is not just a blob: its first field is an `int64` file offset to
  // the package's dependency data, which sits at the end of the same section. It moves with the
  // name table like every other header offset, and leaving it stale makes the editor seek into the
  // name table and read garbage counts ("SerializeAssetRegistryDependencyData").
  if (summary.assetRegistryDataOffsetAt !== null) {
    const sectionAt = out.readInt32LE(summary.assetRegistryDataOffsetAt);
    if (sectionAt > 0) {
      // The four bytes in front of the section are a file offset too (`DependsOffset + 12` in every
      // asset the editor has written here), and nothing in the summary points at them.
      const before = out.readInt32LE(sectionAt - 4);
      if (before > 0 && before < summary.totalHeaderSize)
        out.writeInt32LE(before + nameDelta, sectionAt - 4);
      const dependencyDataOffset = Number(out.readBigInt64LE(sectionAt));
      if (dependencyDataOffset > 0)
        out.writeBigInt64LE(BigInt(dependencyDataOffset + nameDelta), sectionAt);
    }
  }

  for (const at of [summary.bulkDataStartOffsetAt, summary.payloadTocOffsetAt]) {
    if (at === null) continue; // PayloadTocOffset predates this package's engine version
    const value = Number(out.readBigInt64LE(at));
    if (value > 0) out.writeBigInt64LE(BigInt(value + nameDelta + delta), at);
  }

  writeFileSync(dest, out);
  return out.length;
}

/**
 * Write `entries` as the complete `LocalizedTexts` array of `file`, into `dest` (`file` itself by
 * default). `file` is only ever read, so a mod can keep a template package as the input and put
 * the result somewhere else - see `writeModLocalization` in `text.mts`.
 */
export const writeLocalizedTexts = (
  file: string,
  entries: LocalizedTextEntry[],
  dest: string = file,
) =>
  rewriteTextExport(file, "LocalizationModTextToolAsset", serializeLocalizedTexts, entries, dest);

/**
 * Write `entries` as the complete `LocalizationDatabase` map of `file`, into `dest`. This is the
 * asset the Mod Editor autogenerates at cook time (`Autogenerated_<n>_LocalizationDatabase`) by
 * gathering every `LocalizationModTextToolAsset` in the mod - and the one the *game* actually
 * reads, so generating it is what lets a text-carrying mod be packed without a cook.
 */
export const writeLocalizationDatabase = (
  file: string,
  entries: LocalizedTextEntry[],
  dest: string = file,
) =>
  rewriteTextExport(
    file,
    "ModLocalizationDatabaseDataAsset",
    serializeLocalizationDatabase,
    entries,
    dest,
  );

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [file] = process.argv.slice(2);
  if (!file) {
    logger.error("usage: localization/uasset.mts <file.uasset>");
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
