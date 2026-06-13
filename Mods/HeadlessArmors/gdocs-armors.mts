import "../../src/ensure-env.mts";
import { Struct } from "s2cfgtojson";
import type { ERank } from "s2cfgtojson";
import type { ArmorPrototype, ArmorPrototypeProtection } from "s2cfgtojson";
import type { CoreFaction } from "../../src/consts.mts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { logger } from "../../src/logger.mts";

const HEADLESS_ARMORS_DATA_TABLE_URL = process.env.HEADLESS_ARMORS_DATA_TABLE_URL;
const HEADLESS_ARMORS_MESH_TABLE_URL = process.env.HEADLESS_ARMORS_MESH_TABLE_URL;
const GDOCS_CACHE_PATH = new URL("./.gdocs.armors.cache.json", import.meta.url);

let gdocsDataPromise: Promise<GdocsArmorData> | null = null;

export type GdocsMeshDescriptor = {
  SID: string;
  MeshPath: string;
  Materials: Array<{ MaterialSlot: number; MaterialPath: string }>;
};

export type GdocsArmorData = {
  overrides: Record<string, ArmorPrototype>;
  descriptors: Record<string, { Faction: CoreFaction; Rank: ERank; SID: string }>;
  meshPrototypes: Record<string, GdocsMeshDescriptor>;
};

type GdocsArmorCache = {
  etag?: string;
  lastModified?: string;
  meshEtag?: string;
  meshLastModified?: string;
  fetchedAt: string;
  data: GdocsArmorData;
};

export async function getGdocsArmorData(): Promise<GdocsArmorData> {
  if (!gdocsDataPromise) {
    gdocsDataPromise = fetchGdocsData();
  }
  return gdocsDataPromise;
}

async function fetchGdocsData(): Promise<GdocsArmorData> {
  if (!HEADLESS_ARMORS_DATA_TABLE_URL) {
    throw new Error("Missing HEADLESS_ARMORS_DATA_TABLE_URL in .env");
  }
  if (!HEADLESS_ARMORS_MESH_TABLE_URL) {
    throw new Error("Missing HEADLESS_ARMORS_MESH_TABLE_URL in .env");
  }

  const cache = readGdocsCache();

  const armorHeaders: Record<string, string> = {};
  if (cache?.etag) armorHeaders["If-None-Match"] = cache.etag;
  if (cache?.lastModified) armorHeaders["If-Modified-Since"] = cache.lastModified;

  const meshHeaders: Record<string, string> = {};
  if (cache?.meshEtag) meshHeaders["If-None-Match"] = cache.meshEtag;
  if (cache?.meshLastModified) meshHeaders["If-Modified-Since"] = cache.meshLastModified;

  let armorResponse: Response;
  let meshResponse: Response;
  try {
    [armorResponse, meshResponse] = await Promise.all([
      fetch(HEADLESS_ARMORS_DATA_TABLE_URL, { headers: armorHeaders }),
      fetch(HEADLESS_ARMORS_MESH_TABLE_URL, { headers: meshHeaders }),
    ]);
  } catch (error) {
    if (cache?.data) {
      logger.warn(`Failed to fetch gdocs tables, using cached data: ${(error as Error).message}`);
      return cache.data;
    }
    throw error;
  }

  let overrides: GdocsArmorData["overrides"];
  let descriptors: GdocsArmorData["descriptors"];
  let meshPrototypes: GdocsArmorData["meshPrototypes"];
  let newEtag = cache?.etag;
  let newLastModified = cache?.lastModified;
  let newMeshEtag = cache?.meshEtag;
  let newMeshLastModified = cache?.meshLastModified;

  if (armorResponse.status === 304 && cache?.data) {
    logger.log(`Gdocs armor table unchanged (${Object.keys(cache.data.overrides).length} overrides)`);
    overrides = cache.data.overrides;
    descriptors = cache.data.descriptors;
  } else if (armorResponse.ok) {
    const parsed = parseArmorDataFromCsv(await armorResponse.text());
    overrides = parsed.overrides;
    descriptors = parsed.descriptors;
    newEtag = armorResponse.headers.get("etag") ?? cache?.etag;
    newLastModified = armorResponse.headers.get("last-modified") ?? cache?.lastModified;
    logger.log(`Loaded ${Object.keys(overrides).length} armor overrides from gdocs`);
  } else if (cache?.data) {
    logger.warn(`Failed to fetch gdocs armor table (HTTP ${armorResponse.status}), using cached data`);
    overrides = cache.data.overrides;
    descriptors = cache.data.descriptors;
  } else {
    throw new Error(`Failed to fetch gdocs armor table. HTTP ${armorResponse.status}`);
  }

  if (meshResponse.status === 304 && cache?.data?.meshPrototypes) {
    logger.log(`Gdocs mesh table unchanged`);
    meshPrototypes = cache.data.meshPrototypes;
  } else if (meshResponse.ok) {
    meshPrototypes = parseMeshDataFromCsv(await meshResponse.text());
    newMeshEtag = meshResponse.headers.get("etag") ?? cache?.meshEtag;
    newMeshLastModified = meshResponse.headers.get("last-modified") ?? cache?.meshLastModified;
    logger.log(`Loaded ${Object.keys(meshPrototypes).length} mesh prototypes from gdocs`);
  } else if (cache?.data?.meshPrototypes) {
    logger.warn(`Failed to fetch gdocs mesh table (HTTP ${meshResponse.status}), using cached data`);
    meshPrototypes = cache.data.meshPrototypes;
  } else {
    throw new Error(`Failed to fetch gdocs mesh table. HTTP ${meshResponse.status}`);
  }

  const data: GdocsArmorData = { overrides: overrides!, descriptors: descriptors!, meshPrototypes: meshPrototypes! };
  writeGdocsCache({
    etag: newEtag,
    lastModified: newLastModified,
    meshEtag: newMeshEtag,
    meshLastModified: newMeshLastModified,
    fetchedAt: new Date().toISOString(),
    data,
  });
  return data;
}

const PROTECTION_KEYS = ["PSY", "Burn", "Shock", "ChemicalBurn", "Radiation", "Strike", "Fall"];

const EXPECTED_ARMOR_HEADER = new Set([
  "SID",
  "Sort priority",
  "refkey",
  "Invisible",
  "Protection.PSY",
  "Protection.Burn",
  "Protection.Shock",
  "Protection.ChemicalBurn",
  "Protection.Radiation",
  "Protection.Strike",
  "Protection.Fall",
  "Weight",
  "Cost",
  "bBlockHead",
  "Icon",
  "LocalizationSID",
  "MeshPrototypeSID",
  "Faction",
  "Rank",
]);

const EXPECTED_MESH_HEADER = new Set(["SID", "MeshPath", "MaterialSlot", "MaterialPath"]);

function parseArmorDataFromCsv(csv: string): Omit<GdocsArmorData, "meshPrototypes"> {
  const rows = parseCsv(csv);
  if (!rows.length) {
    throw new Error("Gdocs armor CSV is empty");
  }

  const header = rows[0].map((h) => h.trim());

  if (EXPECTED_ARMOR_HEADER.difference(new Set(header)).size) {
    throw new Error(
      `Header doesn't match the schema: missing '${[...EXPECTED_ARMOR_HEADER.difference(new Set(header))]}', extra fields ${[...new Set(header).difference(EXPECTED_ARMOR_HEADER)]}`,
    );
  }

  const byHeader = Object.fromEntries(header.map((h, i) => [h, i]));
  const sidIndex = byHeader.SID;
  if (sidIndex === undefined) {
    throw new Error("Gdocs armor CSV has no SID column");
  }
  const refkeyIndex = byHeader.refkey;
  if (refkeyIndex === undefined) {
    throw new Error("Gdocs armor CSV has no refkey column");
  }
  const factionIndex = byHeader.Faction;
  const ranksIndex = byHeader.Rank;

  const descriptors: Record<string, GdocsArmorData["descriptors"][number]> = {};
  const overrides: Record<string, GdocsArmorData["overrides"][string]> = {};
  const duplicateSIDs = new Set<string>();

  for (const rawRow of rows.slice(1)) {
    const row = rawRow.map((v) => v.trim());
    const SID = row[sidIndex];
    if (!SID) {
      continue;
    }
    const refkey = row[refkeyIndex];
    if (!refkey) {
      continue;
    }

    if (descriptors[SID]) {
      duplicateSIDs.add(SID);
    }
    descriptors[SID] = { SID, Faction: row[factionIndex] as CoreFaction, Rank: row[ranksIndex] as ERank };

    const armorDef: ArmorPrototype = new Struct() as ArmorPrototype;

    armorDef.Protection ||= new Struct() as ArmorPrototypeProtection;
    for (const key of PROTECTION_KEYS) {
      const value = parseScalar(row[byHeader[`Protection.${key}`]]);
      if (value !== undefined) {
        armorDef.Protection[key] = Number(value);
      }
    }
    armorDef.SID = SID;
    armorDef.__internal__.refkey = refkey;
    armorDef.__internal__.rawName = SID;
    assignIfDefined(armorDef, "LocalizationSID", parseScalar(row[byHeader.LocalizationSID]));
    assignIfDefined(armorDef, "Icon", parseScalar(row[byHeader.Icon]));
    assignIfDefined(armorDef, "Cost", parseScalar(row[byHeader.Cost]));
    assignIfDefined(armorDef, "Weight", parseScalar(row[byHeader.Weight]));
    assignIfDefined(armorDef, "bBlockHead", parseScalar(row[byHeader.bBlockHead]));
    assignIfDefined(armorDef, "Invisible", parseScalar(row[byHeader.Invisible]));
    assignIfDefined(armorDef, "MeshPrototypeSID", parseScalar(row[byHeader.MeshPrototypeSID]));

    if (Object.keys(armorDef).length) {
      overrides[SID] = armorDef;
    }
  }
  if (duplicateSIDs.size) {
    logger.warn(`Duplicate SIDs found in gdocs armor table (${[...duplicateSIDs]}). Using last occurrence per SID.`);
  }

  return { overrides, descriptors };
}

function parseMeshDataFromCsv(csv: string): Record<string, GdocsMeshDescriptor> {
  const rows = parseCsv(csv);
  if (!rows.length) {
    throw new Error("Gdocs mesh CSV is empty");
  }

  const header = rows[0].map((h) => h.trim());
  if (EXPECTED_MESH_HEADER.difference(new Set(header)).size) {
    throw new Error(
      `Mesh header doesn't match the schema: missing '${[...EXPECTED_MESH_HEADER.difference(new Set(header))]}', extra fields ${[...new Set(header).difference(EXPECTED_MESH_HEADER)]}`,
    );
  }

  const byHeader = Object.fromEntries(header.map((h, i) => [h, i]));
  const result: Record<string, GdocsMeshDescriptor> = {};

  for (const rawRow of rows.slice(1)) {
    const row = rawRow.map((v) => v.trim());
    const SID = row[byHeader.SID];
    if (!SID) continue;
    const MeshPath = row[byHeader.MeshPath];
    if (!MeshPath) continue;
    const MaterialPath = row[byHeader.MaterialPath];
    if (!MaterialPath) continue;
    const MaterialSlot = Number(row[byHeader.MaterialSlot] ?? 0);

    if (!result[SID]) {
      result[SID] = { SID, MeshPath, Materials: [] };
    }
    result[SID].Materials.push({ MaterialSlot, MaterialPath });
  }

  return result;
}

function assignIfDefined<T extends object>(target: T, key: keyof T, value: unknown) {
  if (value !== undefined) {
    (target as any)[key] = value;
  }
}

function parseScalar(raw?: string): string | number | boolean | undefined {
  if (raw === undefined) {
    return undefined;
  }
  let value = raw.trim();
  if (!value) {
    return undefined;
  }
  if (value.startsWith("(") && value.endsWith(")")) {
    return undefined;
  }

  const lower = value.toLowerCase();
  if (lower === "true") {
    return true;
  }
  if (lower === "false") {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  return value;
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const c = input[i];

    if (c === '"') {
      if (inQuotes && input[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && c === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (c === "\n" || c === "\r")) {
      if (c === "\r" && input[i + 1] === "\n") {
        i++;
      }
      row.push(field);
      field = "";
      if (row.some((v) => v.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += c;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((v) => v.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function readGdocsCache(): GdocsArmorCache | null {
  if (!existsSync(GDOCS_CACHE_PATH)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(GDOCS_CACHE_PATH, "utf8")) as GdocsArmorCache;
  } catch (error) {
    logger.warn(`Failed to read gdocs armor cache: ${(error as Error).message}`);
    return null;
  }
}

function writeGdocsCache(cache: GdocsArmorCache) {
  try {
    writeFileSync(GDOCS_CACHE_PATH, JSON.stringify(cache));
  } catch (error) {
    logger.warn(`Failed to write gdocs armor cache: ${(error as Error).message}`);
  }
}
