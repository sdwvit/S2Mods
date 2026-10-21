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
  /**
   * Byte offsets of `SoftObjectPathsCount` (UE5 1008+) and `SoftPackageReferencesCount`; each is
   * followed by its table's offset. `null` when the package predates the field or the tail did not
   * decode.
   */
  softObjectPathsCountAt: number | null;
  softPackageReferencesCountAt: number | null;
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
  const softPackageReferencesCountAt = r.pos;
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
    softPackageReferencesCountAt,
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
  let softObjectPathsCountAt: number | null = null;
  if (fileVersionUE5 >= UE5_ADD_SOFTOBJECTPATH_LIST) {
    softObjectPathsCountAt = r.pos;
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
    softObjectPathsCountAt,
    softPackageReferencesCountAt: tail?.softPackageReferencesCountAt ?? null,
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
    // Opt-in: keep each tag's complete type name too, for writing a serialiser for a new shape.
    if (process.env.UASSET_TYPES) out[`${name}@type`] = formatTypeName(type);
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

/**
 * A *value* FName, split the way `FName` stores it: a trailing `_<digits>` (no leading zero, fits an
 * int32) is the number part, kept out of the name table and written as number + 1. So `volk_1` is
 * table entry `volk` with number 2 - the editor writes NameProperty values this way. Property and
 * type names never end in a number, so `writeName` keeps writing those whole.
 */
const writeFName = (w: Writer, names: string[], name: string) => {
  const m = /^(.*)_(0|[1-9]\d{0,9})$/.exec(name);
  if (!m || Number(m[2]) > 0x7fff_ffff) return writeName(w, names, name);
  return w.i32(nameIndex(names, m[1])).i32(Number(m[2]) + 1);
};

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
/** A `StrProperty` tag. */
const writeStrTag = (w: Writer, names: string[], name: string, value: string) =>
  writeTag(w, names, name, () => writeTypeName(w, names, "StrProperty"), new Writer().fstring(value).toBuffer());

/** The fields of one `ModTextToolLocalizedText` - `SID` and its language map - without the `None`. */
const writeLocalizedTextFields = (w: Writer, names: string[], entry: LocalizedTextEntry) => {
  writeStrTag(w, names, "SID", entry.SID);

  const map = new Writer();
  map.i32(0); // KeysToRemove
  const langs = Object.entries(entry.LanguagesToLocalizedStrings);
  map.i32(langs.length);
  for (const [language, text] of langs) {
    writeName(map, names, language);
    map.fstring(text);
  }
  writeTag(
    w,
    names,
    "LanguagesToLocalizedStrings",
    () => {
      writeName(w, names, "MapProperty");
      w.i32(2);
      writeTypeName(w, names, "EnumProperty", [
        ["ELocalizationLanguage", "/Script/Stalker2"],
        ["ByteProperty"],
      ]);
      writeTypeName(w, names, "StrProperty");
    },
    map.toBuffer(),
  );
};

export function serializeLocalizedTexts(names: string[], entries: LocalizedTextEntry[]): Buffer {
  const elements = new Writer();
  elements.i32(entries.length);
  for (const entry of entries) {
    writeLocalizedTextFields(elements, names, entry);
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

/** One spoken line: `SID` is `<label SID>_<NNN>`, its text `sid_phrase_<SID>`. */
export type DialogPhraseText = {
  SID: string;
  PhraseText: LocalizedTextEntry;
  /** Speaker, a character SID such as `volk_1`; `None` when unset. */
  Character: string;
};

/**
 * One reply option and the lines that follow it: `SID` is `<topic SID>_<TextToolLabelName>`, its
 * option text `sid_label_<SID>`. This grouping is how the game finds a phrase's label - the phrase
 * SID minus its `_<NNN>`.
 */
export type DialogLabelText = {
  TextToolLabelName: string;
  SID: string;
  LabelWFR: LocalizedTextEntry;
  Phrases: DialogPhraseText[];
};

/** One dialog topic: `SID` is `<ModName>_<TextToolTopicName>`, its menu text `sid_topic_<SID>`. */
export type DialogTopicText = {
  TextToolTopicName: string;
  SID: string;
  GlobalWFR: LocalizedTextEntry;
  TopicCharacterSIDs: string[];
  Labels: DialogLabelText[];
};

const MODKIT = "/Script/ModKitEditor";

/** A `StructProperty` tag whose value is a tagged-property struct. */
const writeStructTag = (
  w: Writer,
  names: string[],
  name: string,
  struct: string,
  writeFields: (v: Writer) => void,
) => {
  const v = new Writer();
  writeFields(v);
  writeName(v, names, "None");
  writeTag(w, names, name, () => writeTypeName(w, names, "StructProperty", [[struct, MODKIT]]), v.toBuffer());
};

/** An `ArrayProperty` of structs, each element its tagged fields and a `None`. */
const writeStructArrayTag = <T,>(
  w: Writer,
  names: string[],
  name: string,
  struct: string,
  items: T[],
  writeFields: (v: Writer, item: T) => void,
) => {
  const v = new Writer();
  v.i32(items.length);
  for (const item of items) {
    writeFields(v, item);
    writeName(v, names, "None");
  }
  writeTag(
    w,
    names,
    name,
    () => {
      writeName(w, names, "ArrayProperty");
      w.i32(1);
      writeTypeName(w, names, "StructProperty", [[struct, MODKIT]]);
    },
    v.toBuffer(),
  );
};

const writeLocalizedTextTag = (w: Writer, names: string[], name: string, entry: LocalizedTextEntry) =>
  writeStructTag(w, names, name, "ModTextToolLocalizedText", (v) => writeLocalizedTextFields(v, names, entry));

/**
 * Serialises a `DialogModTextToolAsset` export: the `Dialogs` array, field for field in the order
 * the Mod Editor writes it. `names` is mutated as in `serializeLocalizedTexts`.
 */
export function serializeDialogs(names: string[], topics: DialogTopicText[]): Buffer {
  const out = new Writer();
  out.u8(0); // __SerializationControlExtensions
  writeStructArrayTag(out, names, "Dialogs", "DialogTopicTextTool_ModEditor", topics, (t, topic) => {
    writeStrTag(t, names, "TextToolTopicName", topic.TextToolTopicName);
    writeStrTag(t, names, "SID", topic.SID);
    writeLocalizedTextTag(t, names, "GlobalWFR", topic.GlobalWFR);
    const characters = new Writer();
    characters.i32(topic.TopicCharacterSIDs.length);
    for (const c of topic.TopicCharacterSIDs) writeFName(characters, names, c);
    writeTag(
      t,
      names,
      "TopicCharacterSIDs",
      () => {
        writeName(t, names, "ArrayProperty");
        t.i32(1);
        writeTypeName(t, names, "NameProperty");
      },
      characters.toBuffer(),
    );
    writeStructArrayTag(t, names, "Labels", "DialogLabelTextTool_ModEditor", topic.Labels, (l, label) => {
      writeStrTag(l, names, "TextToolLabelName", label.TextToolLabelName);
      writeStrTag(l, names, "SID", label.SID);
      writeLocalizedTextTag(l, names, "LabelWFR", label.LabelWFR);
      writeStructArrayTag(l, names, "Phrases", "DialogPhraseTextTool_ModEditor", label.Phrases, (p, phrase) => {
        writeStrTag(p, names, "SID", phrase.SID);
        writeLocalizedTextTag(p, names, "PhraseText", phrase.PhraseText);
        writeTag(
          p,
          names,
          "Character",
          () => writeTypeName(p, names, "NameProperty"),
          writeFName(new Writer(), names, phrase.Character).toBuffer(),
        );
      });
    });
  });
  writeName(out, names, "None"); // end of export
  out.i32(0); // same trailer as the LocalizationModTextToolAsset export
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

/**
 * Serialises the `ModWorldSubsystemDataAsset` export's bytes: its one property,
 * `ModWorldSubsystems`, a `TArray<FString>` of blueprint class paths
 * (`/<Mod>/<Asset>.<Asset>_C`). The game creates one `ModWorldSubsystem` per listed class; see
 * DesignDocs/DetectInstalledModSpec.md. `names` is mutated exactly as `serializeLocalizedTexts`
 * mutates it.
 */
export function serializeWorldSubsystems(names: string[], classPaths: string[]): Buffer {
  const elements = new Writer();
  elements.i32(classPaths.length);
  for (const classPath of classPaths) elements.fstring(classPath);

  const out = new Writer();
  out.u8(0); // __SerializationControlExtensions
  writeTag(
    out,
    names,
    "ModWorldSubsystems",
    () => {
      writeName(out, names, "ArrayProperty");
      out.i32(1);
      writeTypeName(out, names, "StrProperty");
    },
    elements.toBuffer(),
  );
  writeName(out, names, "None"); // end of export
  out.i32(0); // same trailer the text assets carry
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
/**
 * Start of the ASCII `FString` (int32 length incl. NUL, then the bytes) that holds the `length`
 * bytes at `at`, or null when they aren't inside one.
 */
function enclosingFString(buf: Buffer, at: number, length: number): number | null {
  const printable = (c: number) => c >= 0x20 && c <= 0x7e;
  let body = at;
  while (body > 4 && printable(buf[body - 1])) body--;
  const start = body - 4;
  const end = body + buf.readInt32LE(start); // one past the NUL
  if (end < at + length + 1 || end > buf.length || buf[end - 1] !== 0) return null;
  return buf.subarray(body, end - 1).every(printable) ? start : null;
}

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
export function renameLocalizationPackage(
  file: string,
  packageName: string,
  dest: string,
  { keepNameOrder = false } = {},
) {
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
  // Re-sorting moves name indices, and only the import/export tables and MetaData get remapped
  // below; a package whose export data holds FNames of its own (a blueprint's property tags) has to
  // keep its order, or the cook reads indices out of range and never finishes.
  const nrefAt = summary.namesReferencedFromExportDataCountAt;
  const oldRef = nrefAt === null ? parsed.names.length : original.readInt32LE(nrefAt);
  const exportDataNames = parsed.names.slice(0, oldRef).map(rename);
  const names = [
    ...(keepNameOrder ? exportDataNames : exportDataNames.sort(compareNames)),
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

  // Tag values name objects *inside* the package by full path, e.g. a blueprint's GeneratedClass
  // tag `/Script/Engine.BlueprintGeneratedClass'/Pkg/Name.Name_C'`. Rewrite the package part of
  // every FString there that spells `<package>.`.
  const objectPath = `${summary.packageName}.`;
  const rewritten = new Set<number>();
  for (
    let at = original.indexOf(objectPath, summary.dependsOffset, "latin1");
    at !== -1 && at < summary.totalHeaderSize;
    at = original.indexOf(objectPath, at + 1, "latin1")
  ) {
    const start = enclosingFString(original, at, objectPath.length);
    if (start === null || rewritten.has(start)) continue;
    rewritten.add(start);
    const value = original.toString("latin1", start + 4, start + 4 + original.readInt32LE(start) - 1);
    edits.push({
      at: start,
      length: value.length + 5,
      bytes: fstringBytes(value.replaceAll(objectPath, `${packageName}.`)),
    });
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
function rewriteTextExport<T>(
  file: string,
  className: string,
  serialize: (names: string[], entries: T[]) => Buffer,
  entries: T[],
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
 * Replace `from` with `to` inside every top-level `StrProperty` value of `file`'s exports, into
 * `dest`. `renameLocalizationPackage` renames the package and its FNames; this is for the plain
 * strings a template spells its mod name in (a GameFeatureData's `ConfigPath` and `DisplayName`).
 *
 * A tag stores its value's size right before the value (`Size` int32, then the `Flags` byte), so
 * an FString only counts when that size matches it. A length change moves the tag size, the
 * export's `SerialSize` and `ScriptSerializationEndOffset`, and every offset behind it.
 */
export function replaceExportStrings(file: string, from: string, to: string, dest: string = file) {
  const original = readFileSync(file);
  const parsed = parseUasset(file);
  const { summary, exportStride } = parsed;
  const edits: ByteEdit[] = [];
  const growth = new Map<number, number>();
  parsed.exports.forEach((e, i) => {
    const end = e.serialOffset + e.serialSize;
    for (let at = original.indexOf(from, e.serialOffset, "latin1"); at !== -1 && at < end; at = original.indexOf(from, at + 1, "latin1")) {
      const start = enclosingFString(original, at, from.length);
      if (start === null || edits.some((edit) => edit.at === start)) continue;
      const length = original.readInt32LE(start);
      if (original.readInt32LE(start - 5) !== length + 4 || original[start - 1] !== 0) continue;
      const value = original.toString("latin1", start + 4, start + 3 + length);
      const bytes = fstringBytes(value.replaceAll(from, to));
      const sizeTag = Buffer.alloc(4);
      sizeTag.writeInt32LE(bytes.length);
      edits.push({ at: start - 5, length: 4, bytes: sizeTag }, { at: start, length: length + 4, bytes });
      growth.set(i, (growth.get(i) ?? 0) + bytes.length - length - 4);
    }
  });
  const { out, shift } = applyEdits(original, edits);

  parsed.exports.forEach((e, i) => {
    const field = (at: number) => summary.exportOffset + i * exportStride + at;
    out.writeBigInt64LE(BigInt(shift(e.serialOffset)), field(EXPORT_SERIAL_OFFSET_AT));
    const delta = growth.get(i) ?? 0;
    if (!delta) return;
    out.writeBigInt64LE(BigInt(e.serialSize + delta), field(EXPORT_SERIAL_SIZE_AT));
    const scriptEnd = out.readInt32LE(field(EXPORT_SCRIPT_SERIALIZATION_END_AT));
    if (scriptEnd > 0) out.writeInt32LE(scriptEnd + delta, field(EXPORT_SCRIPT_SERIALIZATION_END_AT));
  });
  for (const at of [summary.bulkDataStartOffsetAt, summary.payloadTocOffsetAt]) {
    if (at === null) continue;
    const value = Number(out.readBigInt64LE(at));
    if (value > 0) out.writeBigInt64LE(BigInt(shift(value)), at);
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
 * Write `topics` as the complete `Dialogs` array of the `DialogModTextToolAsset` in `file`, into
 * `dest` (`file` itself by default) - the Mod Editor's dialog text asset, whose topics, labels and
 * phrases name their own `sid_topic_` / `sid_label_` / `sid_phrase_` keys.
 */
export const writeDialogTexts = (file: string, topics: DialogTopicText[], dest: string = file) =>
  rewriteTextExport(file, "DialogModTextToolAsset", serializeDialogs, topics, dest);

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

/**
 * Write `classPaths` as the complete `ModWorldSubsystems` array of `file`, into `dest`. This is the
 * asset the Mod Editor autogenerates at packaging time (`Autogenerated_<n>_WorldSubsystemData`)
 * from the mod's `ModWorldSubsystem` blueprints; the CLI cook never runs that step.
 */
export const writeWorldSubsystemData = (file: string, classPaths: string[], dest: string = file) =>
  rewriteTextExport(file, "ModWorldSubsystemDataAsset", serializeWorldSubsystems, classPaths, dest);

/** One `NameToAsset_AssetContainer` entry (`_Voiceover`): a phrase key and the event it plays. */
export type DialogRuntimeAsset = { key: string; path: string };
/** One `NameAndLocalizationToAsset_AssetContainer` entry (`_FaceAnimation`): a phrase key and its anim per language. */
export type DialogRuntimeFaceAsset = { key: string; paths: { Ukrainian: string; English: string } };
const runtimePaths = (e: DialogRuntimeAsset | DialogRuntimeFaceAsset) =>
  "path" in e ? [e.path] : [e.paths.Ukrainian, e.paths.English];

/** A property type as `FPropertyTypeName` nests it: `[name, ...params]`, to any depth. */
type TypeTree = [string, ...TypeTree[]];
const writeTypeTree = (w: Writer, names: string[], [name, ...params]: TypeTree) => {
  writeName(w, names, name);
  w.i32(params.length);
  for (const p of params) writeTypeTree(w, names, p);
};

/** `/Pkg/Path/Asset.Asset` -> the package and asset FNames a soft object path entry stores. */
const splitObjectPath = (objectPath: string) => {
  const dot = objectPath.lastIndexOf(".");
  if (dot === -1 || objectPath.lastIndexOf("/") > dot) throw new Error(`${objectPath}: not /Package.Asset`);
  return { pkg: objectPath.slice(0, dot), asset: objectPath.slice(dot + 1) };
};

/**
 * `DialogRuntimeData`'s export: `AssetType` (an FName) and `AssetContainer`, the 1-based export index of
 * its container subobject.
 */
const serializeDialogRuntimeData = (names: string[], assetType: string, containerExport: number) => {
  const out = new Writer();
  out.u8(0); // __SerializationControlExtensions
  const name = new Writer();
  writeFName(name, names, assetType);
  writeTag(out, names, "AssetType", () => writeTypeTree(out, names, ["NameProperty"]), name.toBuffer());
  writeTag(out, names, "AssetContainer", () => writeTypeTree(out, names, ["ObjectProperty"]),
    Buffer.from(new Int32Array([containerExport]).buffer));
  writeName(out, names, "None");
  out.i32(0);
  return out.toBuffer();
};

/**
 * `NameToAsset_AssetContainer`'s export: `Assets`, a `TMap<FName, FSoftObjectPath>`. The paths are
 * natively serialised (tag flag 8) as indices into the package's `SoftObjectPaths` list.
 */
const serializeNameToAssetContainer = (names: string[], entries: DialogRuntimeAsset[], pathIndex: (p: string) => number) => {
  const map = new Writer();
  map.i32(0); // keys to remove
  map.i32(entries.length);
  for (const { key, path: p } of entries) {
    writeFName(map, names, key);
    map.i32(pathIndex(p));
  }
  const value = map.toBuffer();
  const out = new Writer();
  out.u8(0);
  writeName(out, names, "Assets");
  writeTypeTree(out, names, ["MapProperty", ["NameProperty"], ["StructProperty", ["SoftObjectPath", ["/Script/CoreUObject"]]]]);
  out.i32(value.length).u8(8).raw(value); // EPropertyTagFlags::HasBinaryOrNativeSerialize
  writeName(out, names, "None");
  out.i32(0);
  return out.toBuffer();
};

/** A property tag with explicit `EPropertyTagFlags` (8 = natively serialised value, e.g. a soft object path map). */
const writeTagTree = (w: Writer, names: string[], name: string, type: TypeTree, value: Buffer, flags = 0) => {
  writeName(w, names, name);
  writeTypeTree(w, names, type);
  w.i32(value.length).u8(flags).raw(value);
};

const STALKER2 = ["/Script/Stalker2"] as TypeTree;
const SOFT_PATH: TypeTree = ["StructProperty", ["SoftObjectPath", ["/Script/CoreUObject"]]];

/**
 * `NameAndLocalizationToAsset_AssetContainer`'s export: `VoiceLocalizedAssetsContainer`, phrase key ->
 * `VoiceTypeToLocalizedAssets { LocalizedAssetsContainer: None -> LocalizedAssets { AssetsContainer:
 * ELocalizationLanguage -> SoftObjectPath } }`, Ukrainian first as the editor writes it.
 */
const serializeFaceAnimationContainer = (names: string[], entries: DialogRuntimeFaceAsset[], pathIndex: (p: string) => number) => {
  const outer = new Writer();
  outer.i32(0).i32(entries.length);
  for (const { key, paths } of entries) {
    writeFName(outer, names, key);
    const langs = new Writer();
    langs.i32(0).i32(2);
    for (const [lang, p] of [["Ukrainian", paths.Ukrainian], ["English", paths.English]] as const) {
      writeName(langs, names, `ELocalizationLanguage::${lang}`);
      langs.i32(pathIndex(p));
    }
    const localized = new Writer(); // LocalizedAssets struct
    writeTagTree(localized, names, "AssetsContainer",
      ["MapProperty", ["EnumProperty", ["ELocalizationLanguage", STALKER2], ["ByteProperty"]], SOFT_PATH], langs.toBuffer(), 8);
    writeName(localized, names, "None");
    const byVoiceType = new Writer(); // the LocalizedAssetsContainer map: a single None key
    byVoiceType.i32(0).i32(1);
    writeName(byVoiceType, names, "None");
    byVoiceType.raw(localized.toBuffer());
    writeTagTree(outer, names, "LocalizedAssetsContainer",
      ["MapProperty", ["NameProperty"], ["StructProperty", ["LocalizedAssets", STALKER2]]], byVoiceType.toBuffer());
    writeName(outer, names, "None"); // end of VoiceTypeToLocalizedAssets
  }
  const out = new Writer();
  out.u8(0);
  writeTagTree(out, names, "VoiceLocalizedAssetsContainer",
    ["MapProperty", ["NameProperty"], ["StructProperty", ["VoiceTypeToLocalizedAssets", STALKER2]]], outer.toBuffer());
  writeName(out, names, "None");
  out.i32(0);
  return out.toBuffer();
};

/**
 * Write a `<ChainSID>_Voiceover` `DialogRuntimeData` package: the asset the game looks a dialog chain's
 * voice lines up by, mapping each phrase key (`<ChainSID>_..._<NNN>`, the phrase SID without
 * `sid_phrase_`) to an `AkAudioEvent` by soft object path.
 *
 * `template` is a vanilla `_Voiceover` package saved by the editor (UE5 1013): exports
 * `DialogRuntimeData`, `PackageMetaData` and the `NameToAsset_AssetContainer` subobject, no imports
 * beyond the three classes. It is renamed to `packageName` (name order kept, so the export data's FName
 * indices stay valid), then the name table, the `SoftObjectPaths` list, the `SoftPackageReferences` list
 * and both property exports are rebuilt from `entries`, and every offset, count and name index that
 * moves is patched. Written from its own entries the template comes back byte-identical.
 */
export function writeDialogRuntimeData(
  template: string,
  packageName: string,
  entries: DialogRuntimeAsset[] | DialogRuntimeFaceAsset[],
  dest: string,
) {
  renameLocalizationPackage(template, packageName, dest, { keepNameOrder: true });
  const original = readFileSync(dest);
  const parsed = parseUasset(dest);
  const { summary } = parsed;
  const { softObjectPathsCountAt: objAt, softPackageReferencesCountAt: pkgAt, namesReferencedFromExportDataCountAt: nrefAt } = summary;
  if (summary.bulkDataStartOffsetAt === null || objAt === null || pkgAt === null || nrefAt === null)
    throw new Error(`${template}: summary did not decode, refusing to write`);
  const runtimeIndex = parsed.exports.findIndex((e) => e.className === "DialogRuntimeData");
  const containerIndex = parsed.exports.findIndex((e) => e.className?.endsWith("_AssetContainer"));
  if (runtimeIndex === -1 || containerIndex === -1) throw new Error(`${template} is not a DialogRuntimeData package`);
  const face = parsed.exports[containerIndex].className === "NameAndLocalizationToAsset_AssetContainer";
  if (entries.some((e) => ("paths" in e) !== face)) throw new Error(`${template}: entries don't match its container`);
  const assetType = String(parsed.exports[runtimeIndex].properties?.AssetType);

  const paths = [...new Set(entries.flatMap(runtimePaths))];
  const packages = [...new Set(paths.map((p) => splitObjectPath(p).pkg))];
  const softObjectPaths = (names: string[]) => {
    const w = new Writer();
    for (const p of paths) {
      const { pkg, asset } = splitObjectPath(p);
      writeFName(w, names, pkg);
      writeFName(w, names, asset);
      w.i32(0); // SubPathString
    }
    return w.toBuffer();
  };
  const softPackages = (names: string[]) => {
    const w = new Writer();
    for (const pkg of packages) writeFName(w, names, pkg);
    return w.toBuffer();
  };
  const payloads = (names: string[]) => ({
    runtime: serializeDialogRuntimeData(names, assetType, containerIndex + 1),
    container: face
      ? serializeFaceAnimationContainer(names, entries as DialogRuntimeFaceAsset[], (p) => paths.indexOf(p))
      : serializeNameToAssetContainer(names, entries as DialogRuntimeAsset[], (p) => paths.indexOf(p)),
    objects: softObjectPaths(names),
    packages: softPackages(names),
  });

  // Name table: what the export data and the soft path lists reference, sorted, then the header's
  // names (package, imports, export objects) in their old order.
  const oldRef = original.readInt32LE(nrefAt);
  const used: string[] = [...metadataNames(original, parsed)];
  payloads(used);
  const head = [...new Set(used)].sort(compareNames);
  const headSet = new Set(head);
  const names = [...head, ...parsed.names.slice(oldRef).filter((n) => !headSet.has(n))];
  const built = payloads(names);
  if (names.length !== head.length + parsed.names.slice(oldRef).filter((n) => !headSet.has(n)).length)
    throw new Error(`${template}: name table grew while writing`);

  const objOffset = original.readInt32LE(objAt + 4);
  const pkgOffset = original.readInt32LE(pkgAt + 4);
  const runtime = parsed.exports[runtimeIndex];
  const container = parsed.exports[containerIndex];
  // The registry's dependency data (the tail of the asset registry section) holds two bit arrays,
  // ImportUsedInGame and SoftPackageUsedInGame, each an int32 bit count plus uint32 words. The second
  // one has to match the soft package list, or the editor drops the package as unloadable
  // ("SerializeAssetRegistryDependencyData") and no QuestAssetLabel picks it up.
  const dependencyAt = Number(original.readBigInt64LE(original.readInt32LE(summary.assetRegistryDataOffsetAt!)));
  const softBitsAt = dependencyAt + 4 + 4 * Math.ceil(original.readInt32LE(dependencyAt) / 32);
  const oldSoftBits = original.readInt32LE(softBitsAt);
  const softBits = Buffer.alloc(4 + 4 * Math.ceil(packages.length / 32));
  softBits.writeInt32LE(packages.length, 0);
  for (let i = 0; i < packages.length; i++) softBits[4 + (i >> 3)] |= 1 << (i & 7); // every soft package is used in game
  const { out, shift } = applyEdits(original, [
    { at: summary.nameOffset, length: parsed.nameTableEnd - summary.nameOffset, bytes: serializeNameEntries(names) },
    { at: objOffset, length: original.readInt32LE(objAt) * 20, bytes: built.objects },
    { at: pkgOffset, length: original.readInt32LE(pkgAt) * 8, bytes: built.packages },
    { at: runtime.serialOffset, length: runtime.serialSize, bytes: built.runtime },
    { at: container.serialOffset, length: container.serialSize, bytes: built.container },
    { at: softBitsAt, length: 4 + 4 * Math.ceil(oldSoftBits / 32), bytes: softBits },
  ]);

  const shiftStoredOffset = (at: number, bytes: 4 | 8) => {
    const to = shift(at);
    const value = bytes === 4 ? out.readInt32LE(to) : Number(out.readBigInt64LE(to));
    if (value <= 0) return;
    if (bytes === 4) out.writeInt32LE(shift(value), to);
    else out.writeBigInt64LE(BigInt(shift(value)), to);
  };
  for (const { at, bytes } of summary.postNameOffsetFieldsAt) shiftStoredOffset(at, bytes);
  for (const at of [summary.bulkDataStartOffsetAt, summary.payloadTocOffsetAt]) if (at !== null) shiftStoredOffset(at, 8);
  for (let i = 0; i < parsed.exports.length; i++)
    shiftStoredOffset(summary.exportOffset + i * parsed.exportStride + EXPORT_SERIAL_OFFSET_AT, 8);
  const sectionAt = original.readInt32LE(summary.assetRegistryDataOffsetAt!);
  if (sectionAt > 0) {
    shiftStoredOffset(sectionAt - 4, 4);
    shiftStoredOffset(sectionAt, 8);
  }

  // Counts. All of these fields sit in the summary in front of every edit, so they did not move.
  out.writeInt32LE(names.length, summary.nameCountAt);
  for (const at of summary.generationNameCountsAt) out.writeInt32LE(names.length, at);
  out.writeInt32LE(head.length, nrefAt);
  out.writeInt32LE(paths.length, objAt);
  out.writeInt32LE(packages.length, pkgAt);
  for (const [i, bytes] of [[runtimeIndex, built.runtime], [containerIndex, built.container]] as const) {
    const record = shift(summary.exportOffset) + i * parsed.exportStride;
    out.writeBigInt64LE(BigInt(bytes.length), record + EXPORT_SERIAL_SIZE_AT);
    const old = parsed.exports[i].serialSize;
    out.writeInt32LE(out.readInt32LE(record + EXPORT_SCRIPT_SERIALIZATION_END_AT) + bytes.length - old, record + EXPORT_SCRIPT_SERIALIZATION_END_AT);
  }

  // Name indices outside the rebuilt parts still point into the old table.
  const remap = new Map(parsed.names.map((name, i) => [i, names.indexOf(name)]));
  const remapAt = (at: number) => {
    const to = shift(at);
    const index = remap.get(out.readInt32LE(to));
    if (index === undefined || index < 0) throw new Error(`${template}: name index at ${at} is bad`);
    out.writeInt32LE(index, to);
  };
  const importStride = summary.importCount > 0 ? (summary.exportOffset - summary.importOffset) / summary.importCount : 0;
  for (let i = 0; i < summary.importCount; i++)
    for (const at of IMPORT_NAME_FIELDS_AT) remapAt(summary.importOffset + i * importStride + at);
  for (let i = 0; i < parsed.exports.length; i++) remapAt(summary.exportOffset + i * parsed.exportStride + EXPORT_OBJECT_NAME_AT);
  for (const e of parsed.exports)
    if (e.className === "MetaData") for (const field of METADATA_NAME_FIELDS_AT) remapAt(e.serialOffset + field);

  writeFileSync(dest, out);
  return out.length;
}

/**
 * Write `dest` as a copy of the vanilla `QuestAssetLabel` `template` (`PAK_Quest_BaseGame`) with `objectPaths`
 * (`/Mod/<Chain>_Voiceover.<Chain>_Voiceover`, ...) appended to its `DialogRuntimeDatas` and to its
 * `DialogRuntimeData` asset bundle - the list the game reads a base-game (`DLC = None`) chain's runtime data from.
 * A mod's own QuestAssetLabel is never consulted for those chains (tested 2026-10-19/20).
 *
 * The template is 7 MB with 15k entries, so nothing is re-serialised: the new entries are spliced onto the ends of
 * the lists and every size, count and offset in front of or around them is patched:
 * - name table: the new package/asset names go at the end of the export-data half (`NamesReferencedFromExportData`),
 *   so no export-data index moves; only the header-only tail (imports, export and package names) shifts.
 * - SoftObjectPaths / SoftPackageReferences: one entry each per path; the registry's SoftPackageUsedInGame bits.
 * - export data: `DialogRuntimeDatas` (soft path indices), `AssetBundleData.Bundles[0].BundleAssets` (same) and
 *   `.AssetPaths` (tagged TopLevelAssetPath structs, cloned from the first entry), plus every enclosing tag size.
 * - the registry tag `AssetBundleData`, the same bundle as text.
 */
export function appendQuestLabelRuntimeData(template: string, objectPaths: string[], dest: string) {
  const original = readFileSync(template);
  const parsed = parseUasset(template);
  const { summary } = parsed;
  const { softObjectPathsCountAt: objAt, softPackageReferencesCountAt: pkgAt, namesReferencedFromExportDataCountAt: nrefAt } = summary;
  if (objAt === null || pkgAt === null || nrefAt === null || summary.assetRegistryDataOffsetAt === null)
    throw new Error(`${template}: summary did not decode, refusing to write`);
  const label = parsed.exports.find((e) => e.className === "QuestAssetLabel");
  if (!label) throw new Error(`${template} is not a QuestAssetLabel package`);
  const paths = objectPaths.map(splitObjectPath);
  const added = [...new Set(paths.flatMap(({ pkg, asset }) => [pkg, asset]))].filter((n) => !parsed.names.includes(n));
  if (added.length !== paths.length * 2) throw new Error(`${template}: some of these paths are in the label already`);

  const nref = original.readInt32LE(nrefAt);
  const names = [...parsed.names.slice(0, nref), ...added, ...parsed.names.slice(nref)];
  const at = (n: string) => names.indexOf(n);
  const fname = (n: string) => {
    const b = Buffer.alloc(8);
    b.writeInt32LE(at(n), 0);
    return b;
  };
  const int32 = (v: number) => {
    const b = Buffer.alloc(4);
    b.writeInt32LE(v, 0);
    return b;
  };
  // Appending at the very end of a list would put the bytes at the next section's start offset, which `shift`
  // leaves alone: every append instead replaces the list's last element with itself plus the new ones.
  const append = (end: number, last: number, bytes: Buffer) => ({
    at: end - last,
    length: last,
    bytes: Buffer.concat([original.subarray(end - last, end), bytes]),
  });

  // Name table: the byte offset of entry `nref`.
  let nameAt = summary.nameOffset;
  for (let i = 0; i < nref; i++) {
    const len = original.readInt32LE(nameAt);
    nameAt += 4 + (len < 0 ? -len * 2 : len) + 4;
  }
  const lastNameLen = (() => {
    let p = summary.nameOffset;
    let last = 0;
    for (let i = 0; i < nref; i++) {
      const len = original.readInt32LE(p);
      last = 4 + (len < 0 ? -len * 2 : len) + 4;
      p += last;
    }
    return last;
  })();

  const objCount = original.readInt32LE(objAt), objOffset = original.readInt32LE(objAt + 4);
  const pkgCount = original.readInt32LE(pkgAt), pkgOffset = original.readInt32LE(pkgAt + 4);
  const newObjects = Buffer.concat(paths.map(({ pkg, asset }) => Buffer.concat([fname(pkg), fname(asset), int32(0)])));
  const newPackages = Buffer.concat(paths.map(({ pkg }) => fname(pkg)));
  const newIndices = Buffer.concat(paths.map((_, i) => int32(objCount + i)));

  // Export data: walk the tags to the three lists (the export opens with a one-byte serialization control flag).
  const tags = new Map<string, { sizeAt: number; valueAt: number; size: number }>();
  let p = label.serialOffset + 1;
  const readName = () => {
    const n = parsed.names[original.readInt32LE(p)];
    p += 8;
    return n;
  };
  const skipType = (): void => {
    p += 8;
    const c = original.readInt32LE(p);
    p += 4;
    for (let i = 0; i < c; i++) skipType();
  };
  const walk = (prefix: string, end: number) => {
    while (p < end) {
      const name = readName();
      if (name === "None") return;
      skipType();
      const sizeAt = p;
      const size = original.readInt32LE(p);
      p += 5; // size, flags (no array index / guid / extensions in this asset)
      const valueAt = p;
      tags.set(prefix + name, { sizeAt, valueAt, size });
      if (prefix + name === "AssetBundleData") walk("AssetBundleData.", valueAt + size);
      else if (prefix + name === "AssetBundleData.Bundles") {
        p += 4; // element count: one bundle
        walk("AssetBundleData.Bundles.", valueAt + size);
      }
      p = valueAt + size;
    }
  };
  walk("", label.serialOffset + label.serialSize);
  const tag = (n: string) => {
    const t = tags.get(n);
    if (!t) throw new Error(`${template}: no ${n}`);
    return t;
  };
  const datas = tag("DialogRuntimeDatas"), bundleData = tag("AssetBundleData"), bundles = tag("AssetBundleData.Bundles");
  const bundleAssets = tag("AssetBundleData.Bundles.BundleAssets"), assetPaths = tag("AssetBundleData.Bundles.AssetPaths");
  // One AssetPaths element: PackageName tag + AssetName tag + None, each tag's value an FName 25 bytes in.
  const firstPath = assetPaths.valueAt + 4;
  const assetNameTag = firstPath + 33;
  if (parsed.names[original.readInt32LE(firstPath)] !== "PackageName" || parsed.names[original.readInt32LE(assetNameTag)] !== "AssetName")
    throw new Error(`${template}: unexpected AssetPaths element layout`);
  const element = original.subarray(firstPath, firstPath + 74);
  const remapHeaderName = (b: Buffer, offs: number[]) => {
    for (const o of offs) b.writeInt32LE(at(parsed.names[b.readInt32LE(o)]), o);
  };
  const newPathElements = Buffer.concat(
    paths.map(({ pkg, asset }) => {
      const b = Buffer.from(element);
      remapHeaderName(b, [0, 8, 33, 41, 66]); // the tag and type names (all export-data names: unchanged indices)
      b.writeInt32LE(at(pkg), 25);
      b.writeInt32LE(0, 29);
      b.writeInt32LE(at(asset), 58);
      b.writeInt32LE(0, 62);
      return b;
    }),
  );
  const listEnd = (t: { valueAt: number; size: number }) => t.valueAt + t.size;
  const grow = { datas: newIndices.length, assets: newIndices.length, paths: newPathElements.length };
  const bundleGrow = grow.assets + grow.paths;

  // Registry: SoftPackageUsedInGame bits, and the AssetBundleData tag text.
  const sectionAt = original.readInt32LE(summary.assetRegistryDataOffsetAt);
  const dependencyAt = Number(original.readBigInt64LE(sectionAt));
  const softBitsAt = dependencyAt + 4 + 4 * Math.ceil(original.readInt32LE(dependencyAt) / 32);
  const oldBits = original.readInt32LE(softBitsAt);
  const bitCount = oldBits + paths.length;
  const softBits = Buffer.alloc(4 + 4 * Math.ceil(bitCount / 32));
  softBits.writeInt32LE(bitCount, 0);
  original.copy(softBits, 4, softBitsAt + 4, softBitsAt + 4 + 4 * Math.ceil(oldBits / 32));
  for (let i = oldBits; i < bitCount; i++) softBits[4 + (i >> 3)] |= 1 << (i & 7);
  const marker = Buffer.from('(Bundles=((BundleName="DialogRuntimeData",AssetPaths=(', "latin1");
  const markerAt = original.indexOf(marker, sectionAt);
  const tagAt = markerAt < 0 ? null : enclosingFString(original, markerAt, marker.length);
  if (tagAt === null) throw new Error(`${template}: no AssetBundleData registry tag`);
  const tagText = original.toString("latin1", tagAt + 4, tagAt + 4 + original.readInt32LE(tagAt) - 1);
  // `(Bundles=((BundleName="...",AssetPaths=(<path>,<path>))))`: the paths go in front of the closing run (AssetPaths,
  // the entry, the Bundles array, the struct).
  const closing = /\)\)\)\)$/.exec(tagText);
  if (!closing) throw new Error(`${template}: unexpected AssetBundleData tag text`);
  const newTagText = tagText.slice(0, closing.index) + paths.map(({ pkg, asset }) => `,${pkg}.${asset}`).join("") + closing[0];
  const tagBytes = Buffer.alloc(4 + newTagText.length + 1);
  tagBytes.writeInt32LE(newTagText.length + 1, 0);
  tagBytes.write(newTagText, 4, "latin1");

  const sizeEdit = (t: { sizeAt: number; size: number }, by: number) => ({ at: t.sizeAt, length: 4, bytes: int32(t.size + by) });
  const countEdit = (t: { valueAt: number }, by: number) => ({ at: t.valueAt, length: 4, bytes: int32(original.readInt32LE(t.valueAt) + by) });
  const { out, shift } = applyEdits(original, [
    append(nameAt, lastNameLen, serializeNameEntries(added)),
    append(objOffset + objCount * 20, 20, newObjects),
    append(pkgOffset + pkgCount * 8, 8, newPackages),
    sizeEdit(datas, grow.datas),
    countEdit(datas, paths.length),
    append(listEnd(datas), 4, newIndices),
    sizeEdit(bundleData, bundleGrow),
    sizeEdit(bundles, bundleGrow),
    sizeEdit(bundleAssets, grow.assets),
    countEdit(bundleAssets, paths.length),
    append(listEnd(bundleAssets), 4, newIndices),
    sizeEdit(assetPaths, grow.paths),
    countEdit(assetPaths, paths.length),
    append(listEnd(assetPaths), 74, newPathElements),
    { at: tagAt, length: 4 + tagText.length + 1, bytes: tagBytes },
    { at: softBitsAt, length: 4 + 4 * Math.ceil(oldBits / 32), bytes: softBits },
  ]);

  const shiftStoredOffset = (pos: number, bytes: 4 | 8) => {
    const to = shift(pos);
    const value = bytes === 4 ? out.readInt32LE(to) : Number(out.readBigInt64LE(to));
    if (value <= 0) return;
    if (bytes === 4) out.writeInt32LE(shift(value), to);
    else out.writeBigInt64LE(BigInt(shift(value)), to);
  };
  for (const { at: pos, bytes } of summary.postNameOffsetFieldsAt) shiftStoredOffset(pos, bytes);
  for (const pos of [summary.bulkDataStartOffsetAt, summary.payloadTocOffsetAt]) if (pos !== null) shiftStoredOffset(pos, 8);
  for (let i = 0; i < parsed.exports.length; i++)
    shiftStoredOffset(summary.exportOffset + i * parsed.exportStride + EXPORT_SERIAL_OFFSET_AT, 8);
  shiftStoredOffset(sectionAt - 4, 4);
  shiftStoredOffset(sectionAt, 8);

  out.writeInt32LE(names.length, summary.nameCountAt);
  for (const pos of summary.generationNameCountsAt) out.writeInt32LE(names.length, pos);
  out.writeInt32LE(nref + added.length, nrefAt);
  out.writeInt32LE(objCount + paths.length, objAt);
  out.writeInt32LE(pkgCount + paths.length, pkgAt);
  const labelIndex = parsed.exports.indexOf(label);
  const record = shift(summary.exportOffset) + labelIndex * parsed.exportStride;
  const exportGrow = grow.datas + bundleGrow;
  out.writeBigInt64LE(BigInt(label.serialSize + exportGrow), record + EXPORT_SERIAL_SIZE_AT);
  out.writeInt32LE(out.readInt32LE(record + EXPORT_SCRIPT_SERIALIZATION_END_AT) + exportGrow, record + EXPORT_SCRIPT_SERIALIZATION_END_AT);

  // The header-only tail of the name table moved up by `added.length`.
  const remapAt = (pos: number) => {
    const to = shift(pos);
    const old = out.readInt32LE(to);
    if (old >= nref) out.writeInt32LE(old + added.length, to);
  };
  const importStride = summary.importCount > 0 ? (summary.exportOffset - summary.importOffset) / summary.importCount : 0;
  for (let i = 0; i < summary.importCount; i++)
    for (const f of IMPORT_NAME_FIELDS_AT) remapAt(summary.importOffset + i * importStride + f);
  for (let i = 0; i < parsed.exports.length; i++) remapAt(summary.exportOffset + i * parsed.exportStride + EXPORT_OBJECT_NAME_AT);
  for (const e of parsed.exports)
    if (e.className === "MetaData") for (const f of METADATA_NAME_FIELDS_AT) remapAt(e.serialOffset + f);

  writeFileSync(dest, out);
  return { added: paths.length, names: names.length };
}

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
