import fs, { rmSync } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";
import "../ensure-env.mts";
import { modFolder, modName } from "../base-paths.mts";
import { modMeta } from "../mod-meta-paths.mts";
import { createModZip } from "./zip.mts";
import { logger } from "../logger.mts";
import { finalizePublish } from "./publish-tracker.mts";

/**
 * Uploads steamworkshop/ (the build publish-steam last shipped) as a new version of the mod's
 * main file through the Nexus Mods v3 Upload API, the same flow as Nexus-Mods/upload-action.
 * The API can't create a mod page or edit its description: a mod without a page needs
 * `npm run nexus-page -- create --mod <Mod>` first (src/publish/nexus-page.mts, a browser automation).
 */

const meta = await modMeta;

const API_BASE = "https://api.nexusmods.com/v3";
export const NEXUS_GAME_DOMAIN = "stalker2heartofchornobyl";
const API_KEY = process.env.NEXUSMODS_API_KEY!;
const NEXUS_FILE = path.join(modFolder, ".nexusmods");

export type NexusIds = {
  /** The number in the page URL, nexusmods.com/stalker2heartofchornobyl/mods/<gameScopedId>. */
  gameScopedId: string;
  /** The file to add versions to; when missing, the first upload creates it. */
  fileId?: string;
};

export function getStoredIds(): NexusIds | null {
  if (!fs.existsSync(NEXUS_FILE)) return null;
  return JSON.parse(fs.readFileSync(NEXUS_FILE, "utf8"));
}

export function storeIds(ids: NexusIds) {
  fs.writeFileSync(NEXUS_FILE, JSON.stringify(ids, null, 2) + "\n", "utf8");
}

export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: API_KEY,
      "User-Agent": "sdwvit/S2Mods",
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${url} failed: ${res.status} ${await res.text()}`);
  }
  return ((await res.json()) as { data: T }).data;
}

/* -------------------------------------------------- */
/* UPLOAD (multipart to presigned URLs)                */
/* -------------------------------------------------- */
async function upload(zipPath: string) {
  const { size } = fs.statSync(zipPath);
  const session = await api<{
    id: string;
    part_size_bytes: number;
    part_presigned_urls: string[];
    complete_presigned_url: string;
  }>("/uploads/multipart", {
    method: "POST",
    body: JSON.stringify({ filename: path.basename(zipPath), size_bytes: String(size) }),
  });

  const file = await open(zipPath, "r");
  const parts: { partNumber: number; etag: string }[] = [];
  try {
    for (const [i, url] of session.part_presigned_urls.entries()) {
      const buffer = Buffer.alloc(session.part_size_bytes);
      const { bytesRead } = await file.read(buffer, 0, session.part_size_bytes, i * session.part_size_bytes);
      logger.log(`Uploading part ${i + 1}/${session.part_presigned_urls.length} (${bytesRead} bytes)`);
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: buffer.subarray(0, bytesRead),
      });
      const etag = res.headers.get("ETag");
      if (!res.ok || !etag) throw new Error(`Part ${i + 1} failed: ${res.status} ${await res.text()}`);
      parts.push({ partNumber: i + 1, etag: etag.replace(/"/g, "") });
    }
  } finally {
    await file.close();
  }

  const xml = `<CompleteMultipartUpload>${parts
    .map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag}</ETag></Part>`)
    .join("")}</CompleteMultipartUpload>`;
  const completed = await fetch(session.complete_presigned_url, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: xml,
  });
  if (!completed.ok) throw new Error(`Completing upload failed: ${completed.status} ${await completed.text()}`);

  await api(`/uploads/${session.id}/finalise`, { method: "POST" });
  for (let attempt = 0; attempt < 60; attempt++) {
    const { state } = await api<{ state: string }>(`/uploads/${session.id}`);
    if (state === "available") return session.id;
    await new Promise((resolve) => setTimeout(resolve, Math.min(2000 * 1.5 ** attempt, 30000)));
  }
  throw new Error(`Upload ${session.id} never became available`);
}

/* -------------------------------------------------- */
/* MAIN FLOW                                           */
/* -------------------------------------------------- */
export async function publishToNexus() {
  if (process.env.DRY) {
    logger.log(`${import.meta.filename} dry run`);
    return;
  }
  const ids = getStoredIds();
  if (!ids) {
    throw new Error(`No ${NEXUS_FILE}: create the Nexus page first (npm run nexus-page -- create --mod ${modName}).`);
  }
  const publishedAt = new Date();
  const publishNote = process.env.CHANGENOTE || meta.changenote || "Update";
  // Nexus shows the version on the page; the same timestamp format as the earlier manual uploads.
  const version = publishedAt.toISOString().replace(/:/g, "");

  const mod = await api<{ id: string }>(`/games/${NEXUS_GAME_DOMAIN}/mods/${ids.gameScopedId}`);
  const outputZip = await createModZip(undefined, modName, `${modName}-nexus`);
  try {
    const uploadId = await upload(outputZip);
    const fileFields = {
      upload_id: uploadId,
      name: "Main",
      version,
      file_category: "main",
      primary_mod_manager_download: true,
      allow_mod_manager_download: true,
      show_requirements_pop_up: false,
      update_mod_version: true,
    };
    if (ids.fileId) {
      await api(`/mod-files/${ids.fileId}/versions`, {
        method: "POST",
        body: JSON.stringify({ ...fileFields, archive_existing_file: true }),
      });
    } else {
      await api("/mod-files", {
        method: "POST",
        body: JSON.stringify({ ...fileFields, mod_id: mod.id }),
      });
      // The create response's id is not the one /mod-files/{id}/versions takes: read it from the file list.
      const { mod_files } = await api<{ mod_files: { id: string; is_active: boolean }[] }>(`/mods/${mod.id}/files`);
      storeIds({ ...ids, fileId: mod_files.find((file) => file.is_active)!.id });
    }
    await api(`/mods/${mod.id}/changelogs`, {
      method: "POST",
      body: JSON.stringify({ version, changelog: publishNote }),
    });
  } finally {
    rmSync(outputZip);
  }
  logger.log(
    `Nexus publish complete https://www.nexusmods.com/${NEXUS_GAME_DOMAIN}/mods/${ids.gameScopedId}?tab=files`,
  );
  finalizePublish("nexus", publishNote, publishedAt);
}

if (import.meta.main) {
  await publishToNexus();
}
