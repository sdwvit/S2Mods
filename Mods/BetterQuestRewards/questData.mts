import "../../src/ensure-env.mts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { logger } from "../../src/logger.mts";

function parseCsv<T>(csv: string): T[] {
  const lines = csv
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const result = [];
  const headers = lines[0].split("\t").map((header) => header.trim());
  for (let i = 1; i < lines.length; i++) {
    const obj: any = {};
    const currentline = lines[i].split("\t").map((value) => value.trim());
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = currentline[j];
    }
    result.push(obj);
  }
  return result;
}

const GDOCS_CACHE_PATH = new URL("./.gdocs.quest-data-table.cache.json", import.meta.url);
const QUEST_DATA_TABLE_EDIT_URL = process.env.MASTERMOD_QUEST_DATA_TABLE_URL;

type GdocsCache = {
  etag?: string;
  lastModified?: string;
  fetchedAt: string;
  sourceUrl: string;
  tsv: string;
};

function toGoogleTsvExportUrl(url: string) {
  if (url.includes("/export?")) {
    return url;
  }

  const match = url.match(/\/d\/([^/]+)/);
  if (!match) {
    return url;
  }

  let gid = "0";
  try {
    const parsed = new URL(url);
    gid = parsed.searchParams.get("gid") || parsed.hash.match(/gid=(\d+)/)?.[1] || gid;
  } catch {
    gid = url.match(/gid=(\d+)/)?.[1] || gid;
  }

  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=tsv&gid=${gid}`;
}

function readGdocsCache(): GdocsCache | null {
  if (!existsSync(GDOCS_CACHE_PATH)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(GDOCS_CACHE_PATH, "utf-8")) as GdocsCache;
  } catch {
    return null;
  }
}

function writeGdocsCache(cache: GdocsCache) {
  writeFileSync(GDOCS_CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");
}

async function getQuestDataTableRawTsv() {
  if (!QUEST_DATA_TABLE_EDIT_URL) {
    throw new Error("Missing MASTERMOD_QUEST_DATA_TABLE_URL in .env");
  }

  const gdocsTsvUrl = toGoogleTsvExportUrl(QUEST_DATA_TABLE_EDIT_URL);
  const cache = readGdocsCache();
  const cacheExists = !!cache?.tsv;
  const headers: Record<string, string> = {};

  if (cache?.etag) {
    headers["If-None-Match"] = cache.etag;
  }
  if (cache?.lastModified) {
    headers["If-Modified-Since"] = cache.lastModified;
  }

  try {
    const response = await fetch(gdocsTsvUrl, { headers });

    if (response.status === 304 && cache?.tsv) {
      logger.log("BetterQuestRewards quest table unchanged in gdocs, using cache");
      return cache.tsv;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const tsv = await response.text();
    writeGdocsCache({
      etag: response.headers.get("etag") || cache?.etag,
      lastModified: response.headers.get("last-modified") || cache?.lastModified,
      fetchedAt: new Date().toISOString(),
      sourceUrl: gdocsTsvUrl,
      tsv,
    });
    logger.log("Loaded BetterQuestRewards quest table from gdocs");
    return tsv;
  } catch (error) {
    if (cache?.tsv) {
      logger.warn(`Failed to fetch BetterQuestRewards quest table from gdocs, using cache: ${(error as Error).message}`);
      return cache.tsv;
    }
    throw new Error(`Failed to fetch BetterQuestRewards quest table from gdocs and no cache is available: ${(error as Error).message}`);
  }
}

export type QuestDataTableEntry = {
  "#": string;
  Vendor: string;
  "Quest idea": string;
  "Containered Quest SID": string;
  "Dialog SID": string;
  "Variant Quest Node SID": string;
  "Reward Gen SID": string;
  "Base ~Reward": string;
  "Cost of travel": string;
  "Suggested Reward": string;
  TargetX: string;
  TargetY: string;
  TargetZ: string;
  VendorX: string;
  VendorY: string;
  VendorZ: string;
  "Price per unit travelled": string;
  Distance: string;
  "Danger / Chore Factor": string;
  Target: string;
  Bandit: string;
  BlindDog: string;
  Bloodsucker: string;
  Boar: string;
  Burer: string;
  Cat: string;
  Chimera: string;
  Controller: string;
  Deer: string;
  Duty: string;
  Flesh: string;
  Freedom: string;
  Mercenaries: string;
  Package: string;
  Poltergeist: string;
  PseudoDog: string;
  Pseudogiant: string;
  Rat: string;
  Snork: string;
  Stalker: string;
  Tushkan: string;
  Zombie: string;
};

export const QuestDataTable = parseCsv<QuestDataTableEntry>(await getQuestDataTableRawTsv());

export const QuestDataTableByQuestSID = QuestDataTable.reduce(
  (acc, curr) => {
    acc[curr["Containered Quest SID"]] ||= [];
    acc[curr["Containered Quest SID"]].push(curr);
    return acc;
  },
  {} as Record<string, typeof QuestDataTable>,
);
export const QuestDataTableByDialogSID = QuestDataTable.reduce(
  (acc, curr) => {
    acc[curr["Dialog SID"]] ||= [];
    acc[curr["Dialog SID"]].push(curr);
    return acc;
  },
  {} as Record<string, typeof QuestDataTable>,
);

const spread = [0.8, 1.2];

export const rewardFormula = (base: number) => spread.map((factor) => Math.round(base * factor));

export const recurringQuestsFilenames = ["BodyParts_Malahit", "RSQ01", "RSQ04", "RSQ05", "RSQ06", "RSQ07", "RSQ08", "RSQ09", "RSQ10"];
