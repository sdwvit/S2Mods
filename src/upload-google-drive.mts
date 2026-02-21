import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { logger } from "./logger.mts";

const DRIVE_UPLOAD_FIELDS = "id,name,webViewLink";
const DRIVE_UPLOAD_URL = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=${DRIVE_UPLOAD_FIELDS}`;
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API_URL = "https://www.googleapis.com/drive/v3/files";
const OAUTH_PLAYGROUND_URL = "https://developers.google.com/oauthplayground/#step1&scopes=https://www.googleapis.com/auth/drive.file";
const TOKEN_CACHE_PATH = path.resolve(process.cwd(), ".gdrive.access-token.cache.json");
const TOKEN_CACHE_TTL_MS = 60 * 60 * 1000;

type DriveFile = { id: string; name?: string };
type DriveListResponse = { files?: DriveFile[] };
type DriveUploadResponse = { id?: string; name?: string; webViewLink?: string };
type GoogleTokenResponse = { access_token?: string; expires_in?: number };
type GoogleTokenCache = {
  accessToken: string;
  expiresAt: number;
};

function getDriveFolderId() {
  const folderId = process.env.GDRIVE_FOLDER_ID?.trim();
  if (!folderId) {
    throw new Error("Google Drive folder is not configured. Set GDRIVE_FOLDER_ID in .env.");
  }
  return folderId;
}

function canPromptForInput() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY && !process.env.CI);
}

async function prompt(question: string) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

function tryOpenBrowser(url: string) {
  const commands: Array<[string, string[]]> =
    process.platform === "win32" ? [["cmd", ["/c", "start", "", url]]] : process.platform === "darwin" ? [["open", [url]]] : [["xdg-open", [url]]];

  for (const [cmd, args] of commands) {
    const result = spawnSync(cmd, args, { stdio: "ignore" });
    if (!result.error && result.status === 0) {
      return true;
    }
  }
  return false;
}

async function configureGoogleDriveAuthInteractively() {
  if (!canPromptForInput()) {
    return;
  }

  const openBrowserAnswer = (await prompt("Google Drive auth missing. Open OAuth Playground in browser now? [Y/n]: ")).toLowerCase();
  if (openBrowserAnswer === "" || openBrowserAnswer === "y" || openBrowserAnswer === "yes") {
    if (tryOpenBrowser(OAUTH_PLAYGROUND_URL)) {
      logger.log("Opened OAuth Playground. Scope to use: https://www.googleapis.com/auth/drive.file");
    } else {
      logger.warn("Could not open browser automatically.");
      logger.log(`Open this URL manually: ${OAUTH_PLAYGROUND_URL}`);
    }
  }

  const token = await prompt("Paste GDRIVE_ACCESS_TOKEN to continue this run (or press Enter to cancel): ");
  if (token) {
    process.env.GDRIVE_ACCESS_TOKEN = token;
    await writeTokenCache(token, TOKEN_CACHE_TTL_MS);
    logger.log("Using provided GDRIVE_ACCESS_TOKEN for current run.");
  }
}

async function readTokenCache() {
  try {
    const raw = await fs.readFile(TOKEN_CACHE_PATH, "utf8");
    const json = JSON.parse(raw) as GoogleTokenCache;
    if (!json?.accessToken || !json?.expiresAt) {
      return null;
    }
    if (Date.now() >= json.expiresAt) {
      return null;
    }
    return json.accessToken;
  } catch {
    return null;
  }
}

async function writeTokenCache(accessToken: string, ttlMs: number) {
  const cache: GoogleTokenCache = {
    accessToken,
    expiresAt: Date.now() + ttlMs,
  };
  await fs.writeFile(TOKEN_CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

async function clearTokenCache() {
  try {
    await fs.unlink(TOKEN_CACHE_PATH);
  } catch {
    // ignore missing cache
  }
}

function hasRefreshCredentials() {
  return Boolean(process.env.GDRIVE_CLIENT_ID && process.env.GDRIVE_CLIENT_SECRET && process.env.GDRIVE_REFRESH_TOKEN);
}

async function getAccessToken(forceRefresh = false) {
  if (process.env.GDRIVE_ACCESS_TOKEN) {
    return process.env.GDRIVE_ACCESS_TOKEN;
  }

  if (!forceRefresh) {
    const cachedToken = await readTokenCache();
    if (cachedToken) {
      return cachedToken;
    }
  }

  const clientId = process.env.GDRIVE_CLIENT_ID;
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GDRIVE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    await configureGoogleDriveAuthInteractively();
    if (process.env.GDRIVE_ACCESS_TOKEN) {
      return process.env.GDRIVE_ACCESS_TOKEN;
    }
    throw new Error(
      "Google Drive auth is not configured. Set GDRIVE_ACCESS_TOKEN or GDRIVE_CLIENT_ID + GDRIVE_CLIENT_SECRET + GDRIVE_REFRESH_TOKEN.",
    );
  }

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to obtain Google OAuth access token (${response.status} ${response.statusText})`);
  }

  const json = (await response.json()) as GoogleTokenResponse;
  if (!json.access_token) {
    throw new Error("Google OAuth token response did not include access_token.");
  }

  const ttlMs = Math.min(TOKEN_CACHE_TTL_MS, (json.expires_in || 3600) * 1000);
  await writeTokenCache(json.access_token, ttlMs);
  return json.access_token;
}

function buildDriveSearchQuery(folderId: string, fileName: string) {
  const escapedFileName = fileName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `'${folderId}' in parents and name='${escapedFileName}' and trashed=false`;
}

function buildMultipartBody(boundary: string, metadata: string, fileBuffer: Buffer) {
  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/zip\r\n\r\n`,
    "utf8",
  );
  const closing = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  return Buffer.concat([preamble, fileBuffer, closing]);
}

export async function uploadFileToGoogleDrive(filePath: string) {
  let token = await getAccessToken();
  const folderId = getDriveFolderId();
  const fileName = path.basename(filePath);
  const fileBuffer = await fs.readFile(filePath);
  const boundary = `----S2ModsDriveBoundary${Date.now()}`;
  const searchQuery = buildDriveSearchQuery(folderId, fileName);

  async function authorizedFetch(url: string, init: RequestInit = {}, retry = true) {
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(url, { ...init, headers });

    if (response.status === 401 && retry) {
      await clearTokenCache();
      if (!hasRefreshCredentials()) {
        throw new Error("Google Drive token expired and refresh credentials are missing. Configure GDRIVE_CLIENT_ID/SECRET/REFRESH_TOKEN.");
      }
      token = await getAccessToken(true);
      return authorizedFetch(url, init, false);
    }

    return response;
  }

  const findExistingUrl = `${DRIVE_API_URL}?q=${encodeURIComponent(searchQuery)}` + "&fields=files(id,name)&orderBy=modifiedTime desc";
  const findExistingResponse = await authorizedFetch(findExistingUrl, { method: "GET" });

  if (!findExistingResponse.ok) {
    const payload = await findExistingResponse.text();
    throw new Error(`Failed to query existing Google Drive files (${findExistingResponse.status} ${findExistingResponse.statusText}): ${payload}`);
  }

  const existingFiles = ((await findExistingResponse.json()) as DriveListResponse).files || [];
  const existingFileToOverwrite = existingFiles[0];

  const metadata = JSON.stringify({
    name: fileName,
    ...(existingFileToOverwrite ? {} : { parents: [folderId] }),
  });
  const body = buildMultipartBody(boundary, metadata, fileBuffer);

  const uploadUrl = existingFileToOverwrite
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileToOverwrite.id}?uploadType=multipart&fields=${DRIVE_UPLOAD_FIELDS}`
    : DRIVE_UPLOAD_URL;
  const uploadMethod = existingFileToOverwrite ? "PATCH" : "POST";
  logger.log(
    existingFileToOverwrite
      ? `Overwriting ${fileName} in Google Drive folder ${folderId} (fileId=${existingFileToOverwrite.id})...`
      : `Uploading ${fileName} to Google Drive folder ${folderId}...`,
  );
  const response = await authorizedFetch(uploadUrl, {
    method: uploadMethod,
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Google Drive upload failed (${response.status} ${response.statusText}): ${payload}`);
  }

  const json = (await response.json()) as DriveUploadResponse;
  logger.log("Google Drive upload complete:", json.name || fileName, json.id || "(no id)");
  if (json.webViewLink) {
    logger.log("Google Drive link:", json.webViewLink);
  }

  for (const duplicate of existingFiles.slice(1)) {
    const deleteResponse = await authorizedFetch(`${DRIVE_API_URL}/${duplicate.id}`, { method: "DELETE" });
    if (!deleteResponse.ok) {
      logger.warn(`Failed to remove duplicate Google Drive file ${duplicate.id} (${duplicate.name || "unknown"}).`);
    }
  }
}
