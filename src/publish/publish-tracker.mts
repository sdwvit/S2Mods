import { execSync } from "node:child_process";
import { modName, projectRoot } from "../base-paths.mts";
import { logger } from "../logger.mts";

type PublishPlatform = "steam" | "modio";

function normalizeNote(note: string) {
  return note.replace(/\s+/g, " ").trim();
}

function formatTagTimestamp(date: Date) {
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  const millis = pad(date.getUTCMilliseconds(), 3);
  return `${year}${month}${day}-${hours}${minutes}${seconds}${millis}Z`;
}

function runGit(command: string) {
  execSync(command, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: "/usr/bin/bash",
    env: process.env,
  });
}

function runGitAndRead(command: string) {
  return execSync(command, {
    cwd: projectRoot,
    encoding: "utf8",
    shell: "/usr/bin/bash",
    env: process.env,
  }).trim();
}

function quoteForBash(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function getModFolderPath() {
  return `Mods/${modName}`;
}

function hasUncommittedChangesInModFolder() {
  const status = runGitAndRead(`git status --porcelain -- ${quoteForBash(getModFolderPath())}`);
  return status.trim().length > 0;
}

function resolvePushCommand() {
  const currentBranch = runGitAndRead("git rev-parse --abbrev-ref HEAD");
  try {
    const upstream = runGitAndRead("git rev-parse --abbrev-ref --symbolic-full-name @{u}");
    const upstreamMatch = upstream.match(/^([^/]+)\/(.+)$/);
    if (!upstreamMatch) {
      return `git push origin HEAD`;
    }
    const [, remote, upstreamBranch] = upstreamMatch;
    logger.log(`Pushing HEAD (${currentBranch}) to upstream ${upstream}.`);
    return `git push ${remote} HEAD:${upstreamBranch}`;
  } catch {
    logger.log(`No upstream detected for ${currentBranch}; pushing to origin/${currentBranch}.`);
    return "git push origin HEAD";
  }
}

export function commitAndPushIfDirty(platform: PublishPlatform, publishedAt = new Date()) {
  const modFolderPath = getModFolderPath();
  if (!hasUncommittedChangesInModFolder()) {
    logger.log(`No local changes to commit in ${modFolderPath} before publish.`);
    return;
  }
  const isoTimestamp = publishedAt.toISOString();
  runGit(`git add -A -- ${quoteForBash(modFolderPath)}`);
  runGit(`git commit -m "publish: ${modName} ${platform} ${isoTimestamp}"`);
  runGit(resolvePushCommand());
}

function createAndPushPublishTag(platform: PublishPlatform, publishedAt: Date) {
  const safeModName = modName.replace(/[^A-Za-z0-9._-]/g, "-");
  const tagName = `publish-${safeModName}-${platform}-${formatTagTimestamp(publishedAt)}`;
  runGit(`git tag -a "${tagName}" -m "publish ${platform} ${publishedAt.toISOString()}"`);
  runGit(`git push origin "${tagName}"`);
  return tagName;
}

export function recordPublishSuccess(platform: PublishPlatform, note: string, publishedAt = new Date()) {
  const isoTimestamp = publishedAt.toISOString();
  const normalizedNote = normalizeNote(note) || "Update";
  const tagName = createAndPushPublishTag(platform, publishedAt);
  logger.log(`Recorded ${platform} publish at ${isoTimestamp} (${tagName}): ${normalizedNote}`);
}

export function finalizePublish(platform: PublishPlatform, note: string, publishedAt = new Date()) {
  commitAndPushIfDirty(platform, publishedAt);
  recordPublishSuccess(platform, note, publishedAt);
}
