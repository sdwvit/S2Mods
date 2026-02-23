import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

type PublishPlatform = "steam" | "modio";
type PlatformFilter = PublishPlatform | "any";

type GitLogEntry = {
  sha: string;
  committedAt: string;
  subject: string;
};

type PublishMarker = {
  tag: string;
  tagDate: string;
  platform: PublishPlatform;
  modName: string;
  commit: GitLogEntry;
};

type ModStatus = {
  modName: string;
  latestChange: GitLogEntry | null;
  latestPublish: PublishMarker | null;
  published: boolean;
};

const projectRoot = path.resolve(import.meta.dirname, "..");
const modsRoot = path.join(projectRoot, "Mods");

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  const platformArg =
    args.has("--steam") ? "steam" : args.has("--modio") ? "modio" : (args.has("--any") ? "any" : "any");
  const showAll = args.has("--all");
  const json = args.has("--json");

  return {
    platform: platformArg as PlatformFilter,
    showAll,
    json,
  };
}

function git(args: string[]) {
  return execFileSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitOrNull(args: string[]) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

function gitLines(args: string[]) {
  const out = gitOrNull(args);
  return out ? out.split("\n").map((line) => line.trim()).filter(Boolean) : [];
}

function parseGitLogEntry(raw: string | null): GitLogEntry | null {
  if (!raw) return null;
  const [sha = "", committedAt = "", ...subjectParts] = raw.split("\t");
  if (!sha || !committedAt) return null;
  return { sha, committedAt, subject: subjectParts.join("\t") };
}

function parseCurrentPublishTag(tagName: string) {
  const match = tagName.match(/^publish-(.+)-(steam|modio)-\d{8}-\d{9}Z$/);
  if (!match) return null;
  return {
    modName: match[1],
    platform: match[2] as PublishPlatform,
  };
}

function getTagDate(tagName: string) {
  return gitOrNull(["for-each-ref", `refs/tags/${tagName}`, "--format=%(taggerdate:iso8601-strict)"]) ?? "";
}

function getCommitEntry(commitSha: string): GitLogEntry | null {
  return parseGitLogEntry(gitOrNull(["show", "-s", "--format=%H\t%cI\t%s", commitSha]));
}

function buildPublishMarkers(): PublishMarker[] {
  const tags = gitLines(["tag", "--list", "publish-*"]);
  return tags
    .map((tag) => {
      const parsedTag = parseCurrentPublishTag(tag);
      if (!parsedTag) return null;

      const commitSha = gitOrNull(["rev-list", "-n", "1", tag]);
      if (!commitSha) return null;

      const commit = getCommitEntry(commitSha);
      if (!commit) return null;

      return {
        tag,
        tagDate: getTagDate(tag),
        platform: parsedTag.platform,
        modName: parsedTag.modName,
        commit,
      } satisfies PublishMarker;
    })
    .filter((marker): marker is PublishMarker => Boolean(marker));
}

async function getModNames() {
  const entries = await fs.readdir(modsRoot, { withFileTypes: true });
  const modNames: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = path.join(modsRoot, entry.name, "meta.mts");
    try {
      await fs.access(metaPath);
      modNames.push(entry.name);
    } catch {
      // Ignore non-mod folders/assets under Mods/
    }
  }
  return modNames.sort((a, b) => a.localeCompare(b));
}

function getLatestChangeForMod(modName: string) {
  return parseGitLogEntry(gitOrNull(["log", "-n", "1", "--format=%H\t%cI\t%s", "--", `Mods/${modName}`]));
}

function pickLatestPublish(markers: PublishMarker[], modName: string, platform: PlatformFilter) {
  const filtered = markers.filter((marker) => {
    if (marker.modName !== modName) return false;
    if (platform === "any") return true;
    return marker.platform === platform;
  });

  filtered.sort((a, b) => {
    const aTs = Date.parse(a.tagDate || a.commit.committedAt || "1970-01-01T00:00:00.000Z");
    const bTs = Date.parse(b.tagDate || b.commit.committedAt || "1970-01-01T00:00:00.000Z");
    return bTs - aTs;
  });

  return filtered[0] ?? null;
}

function isChangeIncludedInPublish(latestChange: GitLogEntry | null, latestPublish: PublishMarker | null) {
  if (!latestChange) return true;
  if (!latestPublish) return false;
  const code = gitOrNull(["merge-base", "--is-ancestor", latestChange.sha, latestPublish.commit.sha]);
  return code !== null;
}

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return iso.replace("T", " ").replace(/\.\d+Z$/, "Z");
}

function printTable(statuses: ModStatus[], platform: PlatformFilter) {
  const header = platform === "any" ? "any platform" : platform;
  console.log(`Checking unpublished mods against latest ${header} publish tags`);
  console.log("");

  if (statuses.length === 0) {
    console.log("No mods matched.");
    return;
  }

  for (const status of statuses) {
    const latestChange = status.latestChange;
    const latestPublish = status.latestPublish;
    const state = status.published ? "PUBLISHED" : "UNPUBLISHED";
    console.log(`${state.padEnd(11)} ${status.modName}`);
    console.log(`  change   ${formatShortDate(latestChange?.committedAt)}  ${latestChange?.sha.slice(0, 10) ?? "-"}  ${latestChange?.subject ?? "-"}`);
    console.log(
      `  publish  ${formatShortDate(latestPublish?.tagDate || latestPublish?.commit.committedAt)}  ${latestPublish?.tag ?? "-"}${latestPublish?.platform ? ` (${latestPublish.platform})` : ""}`,
    );
  }
}

async function main() {
  const { platform, showAll, json } = parseArgs();
  const modNames = await getModNames();
  const publishMarkers = buildPublishMarkers();

  const statuses: ModStatus[] = modNames.map((modName) => {
    const latestChange = getLatestChangeForMod(modName);
    const latestPublish = pickLatestPublish(publishMarkers, modName, platform);
    const published = isChangeIncludedInPublish(latestChange, latestPublish);
    return { modName, latestChange, latestPublish, published };
  });

  const filtered = showAll ? statuses : statuses.filter((status) => !status.published);

  if (json) {
    console.log(
      JSON.stringify(
        filtered.map((status) => ({
          modName: status.modName,
          status: status.published ? "published" : "unpublished",
          latestChange: status.latestChange,
          latestPublish: status.latestPublish
            ? {
                tag: status.latestPublish.tag,
                tagDate: status.latestPublish.tagDate,
                platform: status.latestPublish.platform,
                commit: status.latestPublish.commit,
              }
            : null,
        })),
        null,
        2,
      ),
    );
    return;
  }

  printTable(filtered, platform);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
