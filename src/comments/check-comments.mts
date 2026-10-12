/**
 * Lists new user comments on every published mod, on mod.io and Steam Workshop.
 *
 *   npm run check-comments                 # new comments since the last --mark-seen (read-only)
 *   npm run check-comments -- --mark-seen  # acknowledge everything the previous run reported
 *   npm run check-comments -- --since 7d   # ignore saved state, look back 7 days (also: 12h, 2026-10-01)
 *   npm run check-comments -- --mod UberToz --context 5
 *   npm run check-comments -- --json
 *
 * Mod ids come from Mods/<Mod>/.modio and the publishedfileid in Mods/<Mod>/workshopitem.vdf.
 * The report run never moves the "seen" watermark; it writes .comments-pending.json, and
 * --mark-seen promotes that file into .comments-seen.json (both git-ignored, repo root).
 */
import fs from "node:fs";
import path from "node:path";
import * as VDF from "@node-steam/vdf";
import { projectRoot } from "../ensure-env.mts";

const MODIO_GAME_ID = "5761";
const STEAM_ID64_BASE = 76561197960265728n;
const FIRST_RUN_LOOKBACK_S = 14 * 24 * 3600;
const SEEN_FILE = path.join(projectRoot, ".comments-seen.json");
const PENDING_FILE = path.join(projectRoot, ".comments-pending.json");
const modsDir = path.join(projectRoot, "Mods");

type Platform = "modio" | "steam";
type Comment = {
  id: string;
  author: string;
  own: boolean;
  time: number;
  text: string;
  replyTo?: string;
};
type ItemReport = {
  mod: string;
  platform: Platform;
  itemId: string;
  url: string;
  newComments: Comment[];
  context: Comment[];
  latest: number;
};
// { modio: { [modId]: unixSeconds }, steam: { [publishedFileId]: unixSeconds } }
type Watermarks = Record<Platform, Record<string, number>>;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

if (flag("mark-seen")) {
  const pending = readJson<Watermarks | null>(PENDING_FILE, null);
  if (!pending) {
    console.log("Nothing pending; run check-comments first.");
    process.exit(0);
  }
  const seen = readJson<Watermarks>(SEEN_FILE, { modio: {}, steam: {} });
  for (const platform of ["modio", "steam"] as const) {
    for (const [id, t] of Object.entries(pending[platform] ?? {})) {
      seen[platform][id] = Math.max(seen[platform][id] ?? 0, t);
    }
  }
  fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2));
  fs.rmSync(PENDING_FILE);
  console.log(
    `Marked as seen: ${Object.keys(pending.modio).length} mod.io, ${Object.keys(pending.steam).length} Steam items.`,
  );
  process.exit(0);
}

function parseSince(value: string): number {
  const rel = /^(\d+)([hd])$/.exec(value);
  if (rel) return Math.floor(Date.now() / 1000) - Number(rel[1]) * (rel[2] === "h" ? 3600 : 86400);
  const abs = Date.parse(value);
  if (Number.isNaN(abs)) throw new Error(`Bad --since value: ${value}`);
  return Math.floor(abs / 1000);
}

const sinceOverride = option("since") ? parseSince(option("since")!) : undefined;
const onlyMod = option("mod");
const contextCount = Number(option("context") ?? 3);
const seen = readJson<Watermarks>(SEEN_FILE, { modio: {}, steam: {} });
const firstRunSince = Math.floor(Date.now() / 1000) - FIRST_RUN_LOOKBACK_S;
const sinceFor = (platform: Platform, id: string) =>
  sinceOverride ?? seen[platform][id] ?? firstRunSince;

function readFileIds() {
  const result: { mod: string; modio?: string; steam?: string }[] = [];
  for (const mod of fs.readdirSync(modsDir).sort()) {
    if (onlyMod && mod !== onlyMod) continue;
    const dir = path.join(modsDir, mod);
    const modioFile = path.join(dir, ".modio");
    const vdfFile = path.join(dir, "workshopitem.vdf");
    const modio = fs.existsSync(modioFile)
      ? fs.readFileSync(modioFile, "utf8").trim() || undefined
      : undefined;
    let steam: string | undefined;
    if (fs.existsSync(vdfFile)) {
      const id = String(
        VDF.parse(fs.readFileSync(vdfFile, "utf8")).workshopitem?.publishedfileid ?? "0",
      );
      steam = id !== "0" ? id : undefined;
    }
    if (modio || steam) result.push({ mod, modio, steam });
  }
  return result;
}

async function getJson(url: string, init?: RequestInit, attempt = 0): Promise<any> {
  const res = await fetch(url, init);
  if (res.status === 429 && attempt < 4) {
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    return getJson(url, init, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url.split("?")[0]}`);
  return res.json();
}

/* ------------------------------ mod.io ------------------------------ */

const modioHeaders = {
  Authorization: `Bearer ${process.env.MODIO_API_SECRET}`,
  Accept: "application/json",
};

async function fetchModioComments(modId: string, ownerId: number | undefined, since: number) {
  const base = `${process.env.MODIO_API}/games/${MODIO_GAME_ID}/mods/${modId}/comments`;
  const toComment = (c: any): Comment => ({
    id: String(c.id),
    author: c.user?.username ?? "?",
    own: c.user?.id === ownerId,
    time: c.date_added,
    text: String(c.content ?? "").trim(),
    replyTo: c.reply_id ? String(c.reply_id) : undefined,
  });
  const all: Comment[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await getJson(`${base}?_sort=-date_added&_limit=100&_offset=${offset}`, {
      headers: modioHeaders,
    });
    all.push(...page.data.map(toComment));
    const oldest = page.data.at(-1)?.date_added ?? 0;
    if (
      page.data.length < 100 ||
      (oldest <= since && all.filter((c) => c.time <= since).length >= contextCount)
    )
      break;
  }
  // A new reply to an old thread is meaningless without the comment it answers.
  const known = new Set(all.map((c) => c.id));
  const missingParents = new Set(
    all.filter((c) => c.time > since && c.replyTo && !known.has(c.replyTo)).map((c) => c.replyTo!),
  );
  for (const id of missingParents) {
    const parent = await getJson(`${base}/${id}`, { headers: modioHeaders }).catch(() => null);
    if (parent) all.push(toComment(parent));
  }
  return all;
}

async function modioOwners(): Promise<Map<string, number>> {
  const owners = new Map<string, number>();
  for (let offset = 0; ; offset += 100) {
    const page = await getJson(
      `${process.env.MODIO_API}/me/mods?game_id=${MODIO_GAME_ID}&_limit=100&_offset=${offset}`,
      {
        headers: modioHeaders,
      },
    );
    for (const m of page.data) owners.set(String(m.id), m.submitted_by?.id);
    if (page.data.length < 100) return owners;
  }
}

/* ------------------------------ Steam ------------------------------- */

async function steamCreators(fileIds: string[]): Promise<Map<string, string>> {
  const body = new URLSearchParams({ itemcount: String(fileIds.length) });
  fileIds.forEach((id, i) => body.append(`publishedfileids[${i}]`, id));
  const json = await getJson(
    "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/",
    {
      method: "POST",
      body,
    },
  );
  return new Map(
    json.response.publishedfiledetails.map((d: any) => [
      String(d.publishedfileid),
      String(d.creator),
    ]),
  );
}

const decodeEntities = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

function parseSteamComments(html: string, creatorAccountId: string): Comment[] {
  return html
    .split(/(?=<div[^>]*class="commentthread_comment[ "])/)
    .slice(1)
    .map((block) => {
      const textHtml =
        /class="commentthread_comment_text"[^>]*>([\s\S]*?)<\/div>/.exec(block)?.[1] ?? "";
      return {
        id: /id="comment_(\d+)"/.exec(block)?.[1] ?? "?",
        author: decodeEntities(/<bdi>([\s\S]*?)<\/bdi>/.exec(block)?.[1] ?? "?"),
        own: /data-miniprofile="(\d+)"/.exec(block)?.[1] === creatorAccountId,
        time: Number(/data-timestamp="(\d+)"/.exec(block)?.[1] ?? 0),
        text: decodeEntities(textHtml.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).trim(),
      };
    });
}

async function fetchSteamComments(fileId: string, creator: string, since: number) {
  const accountId = String(BigInt(creator) - STEAM_ID64_BASE);
  const all: Comment[] = [];
  for (let start = 0; ; start += 50) {
    const page = await getJson(
      `https://steamcommunity.com/comment/PublishedFile_Public/render/${creator}/${fileId}/`,
      {
        method: "POST",
        body: new URLSearchParams({ start: String(start), count: "50" }),
      },
    );
    const comments = parseSteamComments(page.comments_html ?? "", accountId);
    all.push(...comments);
    const oldest = comments.at(-1)?.time ?? 0;
    if (
      start + 50 >= page.total_count ||
      (oldest <= since && all.filter((c) => c.time <= since).length >= contextCount)
    )
      break;
  }
  return all;
}

/* ------------------------------ report ------------------------------ */

function toReport(
  mod: string,
  platform: Platform,
  itemId: string,
  url: string,
  all: Comment[],
  since: number,
): ItemReport {
  const newest = all.filter((c) => c.time > since).sort((a, b) => a.time - b.time);
  const replyParents = new Set(newest.map((c) => c.replyTo));
  const older = all
    .filter((c) => c.time <= since)
    .sort((a, b) => b.time - a.time)
    .filter((c, i) => i < contextCount || replyParents.has(c.id))
    .reverse();
  return {
    mod,
    platform,
    itemId,
    url,
    newComments: newest,
    context: older,
    latest: Math.max(since, ...all.map((c) => c.time)),
  };
}

async function inBatches<T>(tasks: (() => Promise<T>)[], size = 10) {
  const results: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < tasks.length; i += size) {
    results.push(...(await Promise.allSettled(tasks.slice(i, i + size).map((t) => t()))));
  }
  return results;
}

const items = readFileIds();
const [owners, creators] = await Promise.all([
  modioOwners().catch((e) => {
    console.error(`mod.io owner lookup failed: ${e.message}`);
    return new Map<string, number>();
  }),
  steamCreators(items.flatMap((i) => (i.steam ? [i.steam] : []))),
]);

const tasks: (() => Promise<ItemReport>)[] = [];
for (const { mod, modio, steam } of items) {
  if (modio) {
    const since = sinceFor("modio", modio);
    tasks.push(async () =>
      toReport(
        mod,
        "modio",
        modio,
        `https://mod.io/g/stalker2/m/${modio}`,
        await fetchModioComments(modio, owners.get(modio), since),
        since,
      ),
    );
  }
  if (steam && creators.get(steam)) {
    const since = sinceFor("steam", steam);
    tasks.push(async () =>
      toReport(
        mod,
        "steam",
        steam,
        `https://steamcommunity.com/sharedfiles/filedetails/comments/${steam}`,
        await fetchSteamComments(steam, creators.get(steam)!, since),
        since,
      ),
    );
  }
}

const settled = await inBatches(tasks);
const reports = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
const failures = settled.flatMap((r) =>
  r.status === "rejected" ? [String(r.reason?.message ?? r.reason)] : [],
);
const withNew = reports.filter((r) => r.newComments.some((c) => !c.own));

const pending: Watermarks = { modio: {}, steam: {} };
for (const r of reports) pending[r.platform][r.itemId] = r.latest;
if (!sinceOverride) fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2));

if (flag("json")) {
  console.log(JSON.stringify({ items: withNew, failures }, null, 2));
} else {
  const fmt = (c: Comment) => {
    const when = new Date(c.time * 1000).toISOString().slice(0, 16).replace("T", " ");
    const who = c.own ? `${c.author} (you)` : c.author;
    const reply = c.replyTo ? ` ↳ reply to ${c.replyTo}` : "";
    return `- [${when}] **${who}** (#${c.id}${reply}):\n${c.text.replace(/^/gm, "  > ")}`;
  };
  console.log(
    `# New mod comments — ${withNew.length} item(s) with new user comments, ${reports.length} checked\n`,
  );
  for (const r of withNew) {
    console.log(`## ${r.mod} — ${r.platform === "modio" ? "mod.io" : "Steam"}\n${r.url}\n`);
    if (r.context.length)
      console.log(`Earlier (context):\n${r.context.map(fmt).join("\n")}\n\nNew:`);
    console.log(`${r.newComments.map(fmt).join("\n")}\n`);
  }
  if (failures.length)
    console.log(`## Fetch failures\n${failures.map((f) => `- ${f}`).join("\n")}`);
  if (!sinceOverride)
    console.log(`\nRun \`npm run check-comments -- --mark-seen\` once these are handled.`);
}
