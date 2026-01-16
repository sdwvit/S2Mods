import fs, { rmSync } from "node:fs";
import path from "node:path";
import "./ensure-dot-env.mts";
import { modFolder, modMeta, modName } from "./base-paths.mts";
import { sanitize } from "./sanitize.mts";
import { createModZip } from "./zip.mts";
import { logger } from "./logger.mts";
import { getModifiedFiles } from "./get-modified-files.mts";

const meta = await modMeta;

const API_BASE = process.env.NEXUSMODS_API || "https://api.nexusmods.com/v1";
const GAME_DOMAIN = process.env.NEXUSMODS_GAME_DOMAIN || "stalker2heartofchornobyl";
const API_KEY = process.env.NEXUSMODS_API_KEY;

const NEXUS_FILE = path.join(modFolder, ".nexusmods");

function getStoredModInfo(): { modId: string | null; categoryId: string | null } {
  if (!fs.existsSync(NEXUS_FILE)) return { modId: null, categoryId: null };
  const lines = fs
    .readFileSync(NEXUS_FILE, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return { modId: null, categoryId: null };

  let modId: string | null = null;
  let categoryId: string | null = null;

  const line1 = lines[0];
  if (line1.includes(",")) {
    const [id, cat] = line1.split(",").map((s) => s.trim());
    modId = id || null;
    categoryId = cat || null;
  } else {
    modId = line1;
  }

  if (!categoryId && lines[1]) {
    const [cat] = lines[1].split(",").map((s) => s.trim());
    categoryId = cat || null;
  }

  return { modId, categoryId };
}

function storeModInfo(modId: string, categoryId?: string) {
  const contents = categoryId ? `${modId}\n${categoryId}` : modId;
  fs.writeFileSync(NEXUS_FILE, contents, "utf8");
}

function modTitle() {
  return sanitize(
    `${(meta.nameOverride || modName).replace(/([A-Z]\w])/g, " $1").trim()} by ${meta.originalAuthor || process.env.STEAM_USER || "sdwvit"}`,
  );
}

function modDescription() {
  return sanitize(
    meta.description +
      `[hr][/hr]This mod is open source and hosted on [url=https://github.com/sdwvit/S2Mods/tree/master/Mods/${modName}]github[/url].[hr][/hr]
      Mod compatibility:
      Here is a list of extended files (this mod bPatches files, so it is compatible with other mods that don't modify the same lines): ${getModifiedFiles("nexus")}
      `,
  );
}

async function uploadModFile(modId: string, categoryId: string, zipPath: string) {
  if (!API_KEY) {
    throw new Error("Missing NEXUSMODS_API_KEY");
  }

  const form = new FormData();
  await getFormFile(form, "file", zipPath, "application/zip");
  form.append("name", modTitle());
  form.append("version", new Date().toISOString());
  form.append("category_id", categoryId);
  form.append("description", sanitize(meta.changenote ?? "Update"));
  form.append("changelog", sanitize(meta.changenote ?? "Update"));
  form.append("summary", modDescription());

  const res = await fetch(`${API_BASE}/games/${GAME_DOMAIN}/mods/${modId}/files.json`, {
    method: "POST",
    headers: {
      apikey: API_KEY,
      Accept: "application/json",
    },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Upload modfile failed: ${res.status} ${await res.text()}`);
  }

  logger.log("Uploaded, ", await res.json());
}

async function publishToNexusMods() {
  if (process.env.DRY) {
    logger.log(`${import.meta.filename} dry run`);
    return;
  }
  await Promise.allSettled([import("./pull-assets.mjs"), import("./pull-staged.mjs")]);

  const stored = getStoredModInfo();
  const modId = process.env.NEXUSMODS_MOD_ID || stored.modId;
  const categoryId = stored.categoryId || process.env.NEXUSMODS_CATEGORY_ID;
  if (!modId) {
    throw new Error("Missing NEXUSMODS_MOD_ID or .nexusmods file");
  }
  if (!categoryId) {
    throw new Error("Missing NEXUSMODS_CATEGORY_ID or .nexusmods file");
  }
  if ((process.env.NEXUSMODS_MOD_ID || process.env.NEXUSMODS_CATEGORY_ID) && (!stored.modId || !stored.categoryId)) {
    storeModInfo(modId, categoryId);
  }

  const outputZip = await createModZip();
  await uploadModFile(modId, categoryId, outputZip);
  rmSync(outputZip);
  logger.log(`Nexus Mods publish complete https://www.nexusmods.com/${GAME_DOMAIN}/mods/${modId}`);
}

async function getFormFile(form = new FormData(), field: string, filePath: string, fileType: string) {
  const buffer = await fs.promises.readFile(filePath);
  const blob = new Blob([buffer], { type: fileType });

  form.append(field, blob, path.parse(filePath).name);
  return form.get(field);
}

await publishToNexusMods();
