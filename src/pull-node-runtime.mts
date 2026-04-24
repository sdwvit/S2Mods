import "./ensure-env.mts";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { projectRoot } from "./ensure-env.mts";
import { logger } from "./logger.mts";

const distDir = path.join(projectRoot, "src", "nodebridge", "dist");
const nodeDistDir = path.join(distDir, "node");
const tmpDir = path.join(distDir, ".tmp");

const DIST_BASE = "https://nodejs.org/dist";

type NodeRelease = {
  version: string;
  files: string[];
  lts: string | false;
};

async function resolveVersion(): Promise<string> {
  const pinned = process.env.NODE_VERSION?.trim();
  if (pinned) {
    const v = pinned.startsWith("v") ? pinned : `v${pinned}`;
    logger.log(`[pull-node-runtime] pinned NODE_VERSION=${v}`);
    return v;
  }
  const res = await fetch(`${DIST_BASE}/index.json`);
  if (!res.ok) throw new Error(`GET ${DIST_BASE}/index.json → ${res.status}`);
  const list = (await res.json()) as NodeRelease[];
  const latest = list.find((r) => r.files.includes("win-x64-zip"));
  if (!latest) throw new Error("No Node release advertises win-x64-zip");
  logger.log(`[pull-node-runtime] latest release: ${latest.version}`);
  return latest.version;
}

async function downloadTo(url: string, dest: string): Promise<void> {
  logger.log(`[pull-node-runtime] fetch ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`GET ${url} → ${res.status}`);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const out = fs.createWriteStream(dest);
  await finished(Readable.fromWeb(res.body as any).pipe(out));
}

function sha256(file: string): string {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(file));
  return h.digest("hex");
}

function parseShasums(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.trim().match(/^([0-9a-f]{64})\s+(.+)$/i);
    if (m) out[m[2]] = m[1].toLowerCase();
  }
  return out;
}

function assertCmd(cmd: string): void {
  const r = spawnSync("which", [cmd], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`Required command "${cmd}" not found on PATH`);
}

async function main(): Promise<void> {
  assertCmd("unzip");
  const version = await resolveVersion();
  const zipName = `node-${version}-win-x64.zip`;
  const url = `${DIST_BASE}/${version}/${zipName}`;
  const sumsUrl = `${DIST_BASE}/${version}/SHASUMS256.txt`;

  await fsp.mkdir(tmpDir, { recursive: true });
  const zipPath = path.join(tmpDir, zipName);
  const sumsPath = path.join(tmpDir, `SHASUMS256-${version}.txt`);

  await Promise.all([downloadTo(url, zipPath), downloadTo(sumsUrl, sumsPath)]);

  const sums = parseShasums(await fsp.readFile(sumsPath, "utf8"));
  const expected = sums[zipName];
  if (!expected) throw new Error(`${zipName} absent from SHASUMS256.txt`);
  const actual = sha256(zipPath);
  if (actual !== expected) {
    throw new Error(`sha256 mismatch for ${zipName}\n  expected ${expected}\n  actual   ${actual}`);
  }
  logger.log(`[pull-node-runtime] checksum OK (${expected.slice(0, 16)}…)`);

  if (fs.existsSync(nodeDistDir)) await fsp.rm(nodeDistDir, { recursive: true, force: true });
  await fsp.mkdir(nodeDistDir, { recursive: true });

  const extractTmp = path.join(tmpDir, `extract-${version}`);
  if (fs.existsSync(extractTmp)) await fsp.rm(extractTmp, { recursive: true, force: true });
  await fsp.mkdir(extractTmp, { recursive: true });
  const unzip = spawnSync("unzip", ["-q", zipPath, "-d", extractTmp], { stdio: "inherit" });
  if (unzip.status !== 0) throw new Error(`unzip exited ${unzip.status}`);

  const topLevel = (await fsp.readdir(extractTmp)).filter((e) => !e.startsWith("."));
  if (topLevel.length !== 1) throw new Error(`Unexpected zip layout: ${topLevel.join(", ")}`);
  const topDir = path.join(extractTmp, topLevel[0]);
  for (const entry of await fsp.readdir(topDir)) {
    await fsp.rename(path.join(topDir, entry), path.join(nodeDistDir, entry));
  }

  await fsp.writeFile(path.join(nodeDistDir, "VERSION.txt"), `${version}\n`);
  await fsp.rm(tmpDir, { recursive: true, force: true });
  logger.log(`[pull-node-runtime] ready at ${nodeDistDir} (${version})`);
}

await main();
