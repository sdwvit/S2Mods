import { execSync } from "node:child_process";
import { projectRoot } from "./base-paths.mts";
import { logger } from "./logger.mts";

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

function hasUncommittedChanges() {
  const status = execSync("git status --porcelain", {
    cwd: projectRoot,
    encoding: "utf8",
    shell: "/usr/bin/bash",
    env: process.env,
  });
  return status.trim().length > 0;
}

export function commitAndPushIfDirty(platform: PublishPlatform, publishedAt = new Date()) {
  if (!hasUncommittedChanges()) {
    logger.log("No local changes to commit before publish.");
    return;
  }
  const isoTimestamp = publishedAt.toISOString();
  runGit("git add -A");
  runGit(`git commit -m "publish: ${platform} ${isoTimestamp}"`);
  runGit("git push");
}

function createAndPushPublishTag(platform: PublishPlatform, publishedAt: Date) {
  const tagName = `publish-${formatTagTimestamp(publishedAt)}`;
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
