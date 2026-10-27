import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, type Page } from "playwright";
import "../ensure-env.mts";
import { modFolder, modName, projectRoot } from "../base-paths.mts";
import { modMeta } from "../mod-meta-paths.mts";
import { logger } from "../logger.mts";
import { getModifiedFilesLink } from "../get-modified-files.mts";
import { NEXUS_GAME_DOMAIN, api, getStoredIds, publishToNexus, storeIds } from "./publish-nexus.mts";

/**
 * Drives the Nexus Mods page editor for what the v3 API can't do: create a mod page and edit its
 * name/descriptions. File uploads go through the API (publish-nexus.mts).
 *
 *   create       new page (name, short + full description, category, logo), first file through
 *                the API, then Publish; resumes a draft an earlier run left unfinished
 *   publish      presses Publish on an existing draft
 *   description  rewrites name, short and full description of an existing page from meta.mts
 *
 * Runs Chrome headed with its own profile in .nexusmods-browser/: log in there once, the
 * session is kept for later runs. NEXUS_NO_SAVE=1 fills the forms without saving.
 * NEXUS_RENAME=1 makes description also reset the page name. NEXUS_CATEGORY picks the page category (default: NEXUSMODS_CATEGORY_ID from .env, or Gameplay).
 */

const meta = await modMeta;
const GAME_URL = `https://www.nexusmods.com/games/${NEXUS_GAME_DOMAIN}`;
/** Public mod pages live without the `/games/` segment, which 404s there; the editor pages need it. */
const PAGE_URL = `https://www.nexusmods.com/${NEXUS_GAME_DOMAIN}`;
const PROFILE_DIR = path.join(projectRoot, ".nexusmods-browser");
const noSave = !!process.env.NEXUS_NO_SAVE;
const author = meta.originalAuthor || process.env.STEAM_USER || "sdwvit";

/** Nexus names allow only letters, digits, spaces and _ ' ( ) . - */
const modTitle = `${(meta.nameOverride || modName).replace(/([a-z0-9])([A-Z])|([A-Z])([A-Z][a-z])/g, "$1$3 $2$4")} by ${author}`
  .replace(/\s*:\s*/g, " - ")
  .replace(/[^\w\s'().-]/g, "");

/**
 * Steam BBCode to the Nexus editor's: it has no headings or [hr]. Descriptions use empty
 * [h1][/h1]/[h2][/h2] as blank lines.
 */
function toNexusBBCode(steam: string) {
  const sizes = { 1: 5, 2: 4, 3: 3 };
  return steam
    .replace(/\[h([123])]\s*\[\/h\1]/g, "\n")
    .replace(/\[h([123])]([\s\S]*?)\[\/h\1]/g, (_, n, text) => `[size=${sizes[n]}][b]${text.trim()}[/b][/size]`)
    .replace(/\[hr]\s*\[\/hr]/g, "[line]")
    .replace(/\n[ \t]+/g, "\n");
}

const fullDescription = toNexusBBCode(
  meta.description.trim() +
  `\n[hr][/hr]This mod is open source and hosted on [url=https://github.com/sdwvit/S2Mods/tree/master/Mods/${modName}]github[/url].[hr][/hr]
[h3]Mod compatibility[/h3]
This mod bPatches files, so it is compatible with other mods that don't modify the same lines. Modified files are listed on ${getModifiedFilesLink("steam")}.`,
);

/** The card text: the description without BBCode, cut to Nexus's 350 characters. */
function shortDescription() {
  const plain = meta.description
    .replace(/\[\/?[a-z0-9*]+(=[^\]]*)?]/gi, " ")
    // The draft dialog's Create button does nothing on a short description with emoji.
    .replace(/\p{Extended_Pictographic}️?/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  // An ASCII ellipsis: with "…" a cut description is refused by the draft dialog.
  return plain.length <= 350 ? plain : plain.slice(0, 347).replace(/\s+\S*$/, "") + "...";
}

async function ensureLoggedIn(page: Page) {
  await page.goto(GAME_URL);
  const profileMenu = page.locator("#profile-menu");
  if (await profileMenu.waitFor({ state: "attached", timeout: 15_000 }).then(() => true, () => false)) return;
  logger.log("Log in to Nexus Mods in the opened Chrome window; waiting up to 10 minutes…");
  await profileMenu.waitFor({ state: "attached", timeout: 10 * 60_000 });
}

/** Headless UI combobox: typing opens and filters it, then click the option with this exact text. */
async function pickComboOption(page: Page, input: ReturnType<Page["locator"]>, option: string) {
  await input.pressSequentially(option);
  await page.getByRole("option", { name: option, exact: true }).first().click();
}

/** The full description is an SCEditor in BBCode mode: write it through its source view. */
async function fillFullDescription(page: Page, bbcode: string) {
  // The sticky preview panel overlaps the toolbar, so the click goes to the button itself.
  const sourceToggle = page.getByTitle(/^View source/);
  await sourceToggle.dispatchEvent("click");
  const source = page.locator(".sceditor-container textarea:visible");
  await source.fill(bbcode);
  await sourceToggle.dispatchEvent("click");
}

/** NEXUS_NO_SAVE: a screenshot of the filled form instead of saving it. */
async function save(page: Page) {
  if (noSave) {
    const shot = path.join(os.tmpdir(), `nexus-${modName}-${new URL(page.url()).pathname.split("/").pop()}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    const editor = page.locator(".sceditor-container");
    if (await editor.count()) {
      await editor.screenshot({ path: shot.replace(/\.png$/, "-description.png") });
    }
    const saveButton = page.getByRole("button", { name: "Save", exact: true }).first();
    const dirty = (await saveButton.count()) ? await saveButton.isEnabled() : "n/a";
    logger.log(`NEXUS_NO_SAVE set: not saving (Save enabled: ${dirty}). Filled form: ${shot}`);
    return;
  }
  // The sticky preview panel overlaps the Save buttons, so the click goes to the button itself.
  const saved = page.waitForResponse((res) => res.request().method() !== "GET" && /nexusmods\.com/.test(res.url()));
  await page.getByRole("button", { name: "Save", exact: true }).first().dispatchEvent("click");
  const res = await saved;
  if (!res.ok()) throw new Error(`Save failed: ${res.status()} ${await res.text()}`);
  await page.waitForLoadState("networkidle");
}

/** The page name is set when the draft is created and kept after, so a rename on Nexus sticks. */
async function fillGeneral(page: Page, gameScopedId: string, setName = false) {
  await page.goto(`${GAME_URL}/mods/${gameScopedId}/edit/general`);
  if (setName) await page.locator("#mod-name").fill(modTitle);
  await page.locator("#author-name").fill(author);
  await page.locator("#short-description").fill(shortDescription());
  await fillFullDescription(page, fullDescription);
  await save(page);
}

async function uploadLogo(page: Page, gameScopedId: string) {
  const logo = ["1024.png", "512.png"].map((f) => path.join(modFolder, f)).find((f) => fs.existsSync(f));
  if (!logo) return;
  await page.goto(`${GAME_URL}/mods/${gameScopedId}/edit/media`);
  // The first file input is the page header, the second the image gallery (whose first image is the thumbnail).
  await page.locator('input[type=file][accept*="image/png"]').nth(1).setInputFiles(logo);
  await page.waitForLoadState("networkidle");
  await save(page);
}

async function createDraft(page: Page) {
  await page.goto(GAME_URL);
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await page.getByRole("button", { name: "Upload mod", exact: true }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Create your draft mod page" });
  await dialog.locator("#mod-name").fill(modTitle);
  await dialog.locator("#short-description").fill(shortDescription());
  const category = process.env.NEXUS_CATEGORY || process.env.NEXUSMODS_CATEGORY_ID || "Gameplay";
  await pickComboOption(page, dialog.getByPlaceholder("Select category"), category);
  if (noSave) {
    await save(page);
    return null;
  }
  await dialog.getByRole("button", { name: "Create draft" }).click();
  await page.waitForURL(/\/mods\/\d+\/edit\//);
  return page.url().match(/\/mods\/(\d+)\/edit\//)![1];
}

/** Presses the editor's Publish (and its confirmation, if any), then waits for the API to report the page published. */
async function publishPage(page: Page, gameScopedId: string) {
  const status = async () =>
    (await api<{ status: string }>(`/games/${NEXUS_GAME_DOMAIN}/mods/${gameScopedId}`)).status;
  if ((await status()) === "published") return;
  if (noSave) {
    logger.log("NEXUS_NO_SAVE set: not publishing.");
    return;
  }
  await page.goto(`${GAME_URL}/mods/${gameScopedId}/edit/general`);
  // A synthetic click event doesn't trigger it; at the 1600px viewport nothing covers the button.
  await page.getByRole("button", { name: "Publish", exact: true }).first().click();
  const confirm = page.getByRole("dialog").getByRole("button", { name: /^Publish/ });
  if (await confirm.waitFor({ timeout: 5000 }).then(() => true, () => false)) {
    await confirm.click();
  }
  for (let attempt = 0; attempt < 15; attempt++) {
    const current = await status();
    if (current === "published") return;
    await page.waitForTimeout(2000);
  }
  throw new Error(`Mod ${gameScopedId} is still "${await status()}" after pressing Publish`);
}

const mode = process.argv.slice(2).find((arg) => ["create", "description", "publish"].includes(arg));
if (!mode) {
  throw new Error("Usage: npm run nexus-page -- create|description|publish --mod <Mod>");
}
const ids = getStoredIds();
if (mode === "create" && ids?.fileId) throw new Error(`${modName} already has a Nexus page: mods/${ids.gameScopedId}`);
if (mode !== "create" && !ids) throw new Error(`${modName} has no Nexus page yet: run create first.`);

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  channel: "chrome",
  // Headless never gets past Cloudflare's challenge, even on a logged-in profile.
  headless: false,
  // A narrow window gets the mobile layout, which has no Publish/Save buttons in the header.
  viewport: { width: 1600, height: 1000 },
  // Cloudflare's challenge never passes for an automation-flagged browser: drop Playwright's
  // --enable-automation and navigator.webdriver, and send the UA of a plain Chrome.
  ignoreDefaultArgs: ["--enable-automation"],
  // Headed but off-screen (positioned after launch), and never throttled in the background.
  args: [
    "--disable-blink-features=AutomationControlled",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
  ],
  userAgent:
    process.env.NEXUS_USER_AGENT ||
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
});
const page = context.pages()[0] ?? (await context.newPage());
// Out of sight: a minimized window stops rendering and the Publish click times out, so park it off-screen.
const cdp = await context.newCDPSession(page);
const { windowId } = await cdp.send("Browser.getWindowForTarget");
await cdp.send("Browser.setWindowBounds", { windowId, bounds: { left: -4000, top: 0, width: 1600, height: 1000 } });
// Leaving an edited form asks "leave site?"; the form was saved (or deliberately not) by then.
page.on("dialog", (dialog) => dialog.accept());
// The Hotjar survey popup sits over the form's buttons.
await context.route(/hotjar/, (route) => route.abort());
try {
  await ensureLoggedIn(page);
  if (mode === "publish") {
    await publishPage(page, ids!.gameScopedId);
    logger.log(`Nexus page published ${PAGE_URL}/mods/${ids!.gameScopedId}`);
  } else if (mode === "description") {
    await fillGeneral(page, ids!.gameScopedId, !!process.env.NEXUS_RENAME);
    if (!noSave) logger.log(`Nexus page updated ${PAGE_URL}/mods/${ids!.gameScopedId}`);
  } else {
    // A draft without a file is an earlier create that stopped part way: finish that one.
    const gameScopedId = ids?.gameScopedId ?? (await createDraft(page));
    if (gameScopedId) {
      if (!ids) storeIds({ gameScopedId });
      logger.log(`Draft ${ids ? "resumed" : "created"} ${GAME_URL}/mods/${gameScopedId}/edit/general`);
      await fillGeneral(page, gameScopedId, true);
      await uploadLogo(page, gameScopedId);
      await publishToNexus();
      // Permissions are optional on Nexus; the page keeps the site defaults.
      await publishPage(page, gameScopedId);
      logger.log(`Nexus page published ${PAGE_URL}/mods/${gameScopedId}`);
    }
  }
} catch (error) {
  const shot = path.join(os.tmpdir(), `nexus-${modName}-error.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  logger.log(`Failed on ${page.url()}, screenshot: ${shot}`);
  throw error;
} finally {
  await context.close().catch(() => {});
}
