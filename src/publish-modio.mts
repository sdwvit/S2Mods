import fs, { rmSync } from "node:fs";
import path from "node:path";
import archiver from "archiver";
import { modFolder, modFolderSteam, modFolderSteamStruct, modName, stagedFolderStruct } from "./base-paths.mts";
import { sanitize } from "./sanitize.mts";
import { metaPromise } from "./meta-promise.mts";

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
  const logoPath = path.join(modFolder, "1024.png");
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
  const logoPath = path.join(modFolder, "1024.png");
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

  return res.json();
}

export async function createModZip(outZipPath: string) {
  const sourceDir = modFolderSteamStruct;

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source folder does not exist: ${sourceDir}`);
  }

  await fs.promises.mkdir(path.dirname(outZipPath), { recursive: true });

  const output = fs.createWriteStream(outZipPath);
  const archive = archiver.create("zip", {
    zlib: { level: 9 }, // maximum compression
  });

  return new Promise<void>((resolve, reject) => {
    output.on("close", () => resolve());
    archive.on("error", reject);

    archive.pipe(output);

    archive.directory(sourceDir, path.join("Windows", stagedFolderStruct));

    archive.finalize();
  });
}

/* -------------------------------------------------- */
/* MAIN FLOW                                           */
/* -------------------------------------------------- */
export async function publishToModIO() {
  await import("./pull-assets.mjs");
  await import("./pull-staged.mjs");

  let modId = getStoredModId();

  if (!modId) {
    console.log("Creating mod.io mod…");
    modId = await createMod();
  } else {
    // console.log("Updating mod metadata…");
    // await updateMod(modId);
    // console.log("Uploading logo…");
    // await uploadModLogo(modId);
  }

  const zipPath = path.join(modFolderSteam, `${modName}.zip`);

  console.log("Creating mod ZIP…");
  await createModZip(zipPath);
  console.log("ZIP ready:", zipPath);

  console.log("Uploading modfile…");
  const f = await uploadModfile(modId, zipPath);
  console.log("Uploaded, ", f);
  rmSync(zipPath);

  console.log("Making mod public…");
  await updateMod(modId, true);

  console.log(`mod.io publish complete https://mod.io/g/stalker2/m/${modName.toLowerCase()}-by-sdwvit`);
}

async function getFormFile(form = new FormData(), field: string, filePath: string, fileType: string) {
  const buffer = await fs.promises.readFile(filePath);
  const blob = new Blob([buffer], { type: fileType });

  form.append(field, blob, path.parse(filePath).name);
  return form.get(field);
}

await publishToModIO();
