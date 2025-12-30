import fs, { rmSync } from "node:fs";
import path from "node:path";
import { modFolder, modFolderSteam, modFolderSteamStruct, modName, stagedFolderStruct } from "./base-paths.mts";
import { sanitize } from "./sanitize.mts";
import { metaPromise } from "./meta-promise.mts";
import { createModZip } from "./zip.mts";

const { meta } = await metaPromise;

const API_BASE = process.env.MODIO_API!;
const GAME_ID = "5761";
const AUTH_TOKEN = `Bearer ${process.env.MODIO_API_SECRET}`;

const MODIO_FILE = path.join(modFolder, ".modio");

function getStoredModId(): string | null {
  if (!fs.existsSync(MODIO_FILE)) return null;
  const id = fs.readFileSync(MODIO_FILE, "utf8").trim();
  return id.length ? id : null;
}

function storeModId(modId: string) {
  fs.writeFileSync(MODIO_FILE, modId, "utf8");
}

/* -------------------------------------------------- */
/* CREATE MOD (once)                                   */
/* -------------------------------------------------- */
async function createMod() {
  console.log("Creating mod.io mod…");
  const form = new FormData();
  form.append("name", sanitize(`${modName.replace(/([A-Z]\w])/g, " $1").trim()} by sdwvit`));
  form.append("summary", "Mod by sdwvit");
  form.append(
    "description",
    sanitize(
      convertToHtml(
        meta.description +
          `[hr][/hr]This mod is open source and hosted on [url=https://github.com/sdwvit/S2Mods/tree/master/Mods/${modName}]github[/url].[h3][/h3]`,
      ),
    ),
  );
  let logoPath = path.join(modFolder, "1024.png");
  if (!fs.existsSync(logoPath)) {
    logoPath = path.join(modFolder, "512.png");
  }
  await getFormFile(form, "logo", logoPath, "image/png");

  const res = await fetch(`${API_BASE}/games/${GAME_ID}/mods`, {
    method: "POST",
    headers: {
      Authorization: AUTH_TOKEN,
      Accept: "application/json",
    },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Create mod failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { id: string };
  storeModId(String(data.id));
  return data.id;
}

/* -------------------------------------------------- */
/* EDIT MOD (title / summary / description / visible) */
/* https://docs.mod.io/restapi/docs/edit-mod          */
/* -------------------------------------------------- */
async function updateMod(modId: string, makePublic = false) {
  console.log("Updating mod metadata…");
  const form = new FormData();

  form.append("name", sanitize(`${modName.replace(/([A-Z]\w])/g, " $1").trim()} by sdwvit`));
  form.append("summary", "Mod by sdwvit");
  form.append(
    "description",
    sanitize(
      convertToHtml(
        meta.description +
          `[hr][/hr]This mod is open source and hosted on [url=https://github.com/sdwvit/S2Mods/tree/master/Mods/${modName}]github[/url].[h3][/h3]`,
      ),
    ),
  );

  if (makePublic) {
    form.append("visible", "1");
  }

  const res = await fetch(`${API_BASE}/games/${GAME_ID}/mods/${modId}`, {
    method: "POST",
    headers: {
      //"Content-Type": "multipart/form-data",
      Authorization: AUTH_TOKEN,
      Accept: "application/json",
    },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Update mod failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

/* -------------------------------------------------- */
/* UPLOAD LOGO                                         */
/* -------------------------------------------------- */
async function uploadModLogo(modId: string) {
  console.log("Uploading logo…");
  let logoPath = path.join(modFolder, "1024.png");
  if (!fs.existsSync(logoPath)) {
    logoPath = path.join(modFolder, "512.png");
  }
  if (!fs.existsSync(logoPath)) return;

  const form = new FormData();
  await getFormFile(form, "logo", logoPath, "image/png");
  const res = await fetch(`${API_BASE}/games/${GAME_ID}/mods/${modId}/media`, {
    method: "POST",
    headers: {
      Authorization: AUTH_TOKEN,
      Accept: "application/json",
    },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Logo upload failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

const convertToHtml = (str: string) => {
  return str
    .replaceAll(/\[h\d]\[\/h\d]/g, "<br/>")
    .replaceAll(/\[h(\d)](.+)\[\/h\d]/g, "<h$1>$2</h$1>")
    .replaceAll(/\[hr]\[\/hr]/g, "<hr/>")
    .replaceAll(/\[list]/g, "<ul>")
    .replaceAll(/\[\/list]/g, "</ul>")
    .replaceAll(/\[\*](.+)/g, "<li>$1</li>")
    .replaceAll(/\[url=(.+)](.+)\[\/url]/g, '<a href="$1">$2</a>');
};

/* -------------------------------------------------- */
/* UPLOAD MODFILE                                      */
/* -------------------------------------------------- */
async function uploadModfile(modId: string, zipPath: string) {
  console.log("Uploading modfile…");
  const form = new FormData();
  await getFormFile(form, "filedata", zipPath, "application/zip");
  form.append("version", new Date().toISOString());
  form.append("changelog", sanitize(meta.changenote ?? "Update"));
  //  form.append("platforms", [{ platform: "windows" }, { platform: "xboxseriesx" }]);

  const res = await fetch(`${API_BASE}/games/${GAME_ID}/mods/${modId}/files`, {
    method: "POST",
    headers: {
      Authorization: AUTH_TOKEN,
      Accept: "application/json",
    },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Upload modfile failed: ${res.status} ${await res.text()}`);
  }

  console.log("Uploaded, ", await res.json());
}

/* -------------------------------------------------- */
/* MAIN FLOW                                           */
/* -------------------------------------------------- */
export async function publishToModIO() {
  await Promise.allSettled([import("./pull-assets.mjs"), import("./pull-staged.mjs")]);

  const [outputZip, modId] = await Promise.all([createModZip(), Promise.resolve(getStoredModId() || createMod())]);
  await Promise.allSettled([updateMod(modId, true), uploadModfile(modId, outputZip)]);

  rmSync(outputZip);
  console.log(`mod.io publish complete https://mod.io/g/stalker2/m/${modName.toLowerCase()}-by-sdwvit`);
}

async function getFormFile(form = new FormData(), field: string, filePath: string, fileType: string) {
  const buffer = await fs.promises.readFile(filePath);
  const blob = new Blob([buffer], { type: fileType });

  form.append(field, blob, path.parse(filePath).name);
  return form.get(field);
}

await publishToModIO();
