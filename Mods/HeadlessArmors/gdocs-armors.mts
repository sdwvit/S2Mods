import "../../src/ensure-env.mts";
import { ArmorPrototype, Struct } from "s2cfgtojson";
import { ArmorDescriptor } from "../../src/consts.mts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { logger } from "../../src/logger.mts";

const GDOCS_ARMORS_CSV_URL = process.env.GDOCS_ARMORS_CSV_URL;
const GDOCS_CACHE_PATH = new URL("./.gdocs.armors.cache.json", import.meta.url);

let gdocsDataPromise: Promise<GdocsArmorData> | null = null;

export type GdocsArmorData = {
  overrides: Record<string, Partial<ArmorPrototype>>;
  descriptors: ArmorDescriptor[];
};

type GdocsArmorCache = {
  etag?: string;
  lastModified?: string;
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
  if (!GDOCS_ARMORS_CSV_URL) {
    throw new Error("Missing GDOCS_ARMORS_CSV_URL in .env");
  }

  const cache = readGdocsCache();
  const headers: Record<string, string> = {};
  if (cache?.etag) {
    headers["If-None-Match"] = cache.etag;
  }
  if (cache?.lastModified) {
    headers["If-Modified-Since"] = cache.lastModified;
  }

  let response: Response;
  try {
    response = await fetch(GDOCS_ARMORS_CSV_URL, { headers });
  } catch (error) {
    if (cache?.data) {
      logger.warn(`Failed to fetch gdocs armor table, using cached data: ${(error as Error).message}`);
      return cache.data;
    }
    throw error;
  }

  if (response.status === 304 && cache?.data) {
    logger.log(`Gdocs armor table unchanged, using cache (${Object.keys(cache.data.overrides).length} overrides)`);
    return cache.data;
  }

  if (!response.ok) {
    if (cache?.data) {
      logger.warn(`Failed to fetch gdocs armor table (HTTP ${response.status}), using cached data`);
      return cache.data;
    }
    throw new Error(`Failed to fetch gdocs armor table. HTTP ${response.status}`);
  }

  const csv = await response.text();
  const data = parseDataFromCsv(csv);
  writeGdocsCache({
    etag: response.headers.get("etag") || cache?.etag,
    lastModified: response.headers.get("last-modified") || cache?.lastModified,
    fetchedAt: new Date().toISOString(),
    data,
  });

  logger.log(`Loaded ${Object.keys(data.overrides).length} armor overrides from gdocs`);
  return data;
}

function parseDataFromCsv(csv: string): GdocsArmorData {
  const rows = parseCsv(csv);
  if (!rows.length) {
    throw new Error("Gdocs armor CSV is empty");
  }

  const header = rows[0].map((h) => h.trim());
  const byHeader = Object.fromEntries(header.map((h, i) => [h, i]));
  const sidIndex = byHeader.SID;
  if (sidIndex === undefined) {
    throw new Error("Gdocs armor CSV has no SID column");
  }
  const refkeyIndex = byHeader.refkey;
  if (refkeyIndex === undefined) {
    throw new Error("Gdocs armor CSV has no refkey column");
  }

  const overrides: Record<string, Partial<ArmorPrototype>> = {};
  const descriptorsBySid: Record<string, ArmorDescriptor> = {};
  const duplicateSIDs = new Set<string>();
  for (const rawRow of rows.slice(1)) {
    const row = rawRow.map((v) => v.trim());
    const sid = row[sidIndex];
    if (!sid) {
      continue;
    }
    const refkey = row[refkeyIndex];
    if (!refkey) {
      continue;
    }

    if (descriptorsBySid[sid]) {
      duplicateSIDs.add(sid);
    }
    descriptorsBySid[sid] = { SID: sid, __internal__: { refkey } } as ArmorDescriptor;

    const override: Partial<ArmorPrototype> & { Protection?: Partial<ArmorPrototype["Protection"]> } = {};
    assignIfDefined(override, "LocalizationSID", parseScalar(row[byHeader.LocalizationSID]));
    assignIfDefined(override, "Icon", parseScalar(row[byHeader.Icon]));

    const protectionKeys: Array<keyof NonNullable<ArmorPrototype["Protection"]>> = [
      "PSY",
      "Burn",
      "Shock",
      "ChemicalBurn",
      "Radiation",
      "Strike",
      "Fall",
    ];
    for (const key of protectionKeys) {
      const value = parseScalar(row[byHeader[`Protection.${key}`]]);
      if (value !== undefined) {
        override.Protection ||= new Struct() as ArmorPrototype["Protection"];
        (override.Protection as any)[key] = value;
      }
    }
    assignIfDefined(override, "Cost", parseScalar(row[byHeader.Cost]));
    assignIfDefined(override, "Weight", parseScalar(row[byHeader.Weight]));
    assignIfDefined(override, "bBlockHead", parseScalar(row[byHeader.bBlockHead]));
    const invisibleValue = parseScalar(row[byHeader.Invisible]);
    assignIfDefined(override, "Invisible", invisibleValue);

    if (Object.keys(override).length) {
      overrides[sid] = override;
    }
  }
  if (duplicateSIDs.size) {
    logger.warn(`Duplicate SIDs found in gdocs armor table (${[...duplicateSIDs]}). Using last occurrence per SID.`);
  }
  const descriptors = Object.values(descriptorsBySid);
  return { overrides, descriptors };
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
