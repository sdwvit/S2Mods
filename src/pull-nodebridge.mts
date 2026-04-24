import "./ensure-env.mts";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { projectRoot } from "./ensure-env.mts";
import { logger } from "./logger.mts";

const distDir = path.join(projectRoot, "src", "nodebridge", "dist");

// Override via env:
//   NODEBRIDGE_REPO=owner/repo (defaults to the git origin if we can parse it)
//   NODEBRIDGE_TAG=nodebridge-vX.Y.Z (defaults to "latest")
//   GITHUB_TOKEN=... (optional — raises rate limit, required for private repos)

function resolveRepo(): string {
  if (process.env.NODEBRIDGE_REPO) return process.env.NODEBRIDGE_REPO.trim();
  try {
    const url = fs.readFileSync(path.join(projectRoot, ".git", "config"), "utf8");
    const m = url.match(/github\.com[:/](.+?)\.git/);
    if (m) return m[1];
  } catch {}
  throw new Error("Cannot resolve repo. Set NODEBRIDGE_REPO=owner/repo.");
}

async function githubJson(url: string): Promise<any> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function downloadTo(url: string, dest: string): Promise<void> {
  const headers: Record<string, string> = { Accept: "application/octet-stream" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`GET ${url} → ${res.status}`);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await finished(Readable.fromWeb(res.body as any).pipe(fs.createWriteStream(dest)));
}

async function main(): Promise<void> {
  const repo = resolveRepo();
  const tag = process.env.NODEBRIDGE_TAG?.trim();
  const api = `https://api.github.com/repos/${repo}/releases/${tag ? `tags/${tag}` : "latest"}`;
  logger.log(`[pull-nodebridge] fetching ${api}`);

  const release = await githubJson(api);
  const assets = (release.assets ?? []) as { name: string; id: number; url: string }[];
  const pick = (name: string) => assets.find((a) => a.name === name);
  const dll = pick("dwmapi.dll");
  if (!dll) throw new Error(`release ${release.tag_name} missing dwmapi.dll asset`);
  const pdb = pick("dwmapi.pdb");

  await fsp.mkdir(distDir, { recursive: true });
  await downloadTo(dll.url, path.join(distDir, "dwmapi.dll"));
  if (pdb) await downloadTo(pdb.url, path.join(distDir, "dwmapi.pdb"));
  await fsp.writeFile(path.join(distDir, "VERSION.txt"), `${release.tag_name}\n`);
  logger.log(`[pull-nodebridge] ready at ${distDir} (${release.tag_name})`);
}

await main();
