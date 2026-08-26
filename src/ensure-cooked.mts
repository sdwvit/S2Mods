import path from "node:path";
import { existsSync, readdirSync, statSync } from "node:fs";
import { logger } from "./logger.mts";
import { modFolderRaw } from "./base-paths.mts";
import { sdkStagedModFolder } from "./mod-meta-paths.mts";
import { cookMod } from "./cook.mts";

function newestMtime(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).reduce((newest, entry) => {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    return Math.max(newest, stat.isDirectory() ? newestMtime(full) : stat.mtimeMs);
  }, 0);
}

/**
 * Published mods always ship cooked paks - loose configs are a local-injection shortcut only.
 * Cooks unless the staged output is already newer than everything in raw/, so calling this from
 * several publishers in one run costs nothing.
 */
export async function ensureCooked() {
  const staged = await sdkStagedModFolder;
  const stagedAt = newestMtime(staged);
  if (stagedAt && stagedAt >= newestMtime(modFolderRaw)) {
    logger.log("Staged cook is up to date with raw/, skipping cook.");
    return;
  }
  logger.log(
    stagedAt ? "Staged cook is older than raw/, re-cooking..." : "No staged cook found, cooking...",
  );
  await cookMod();
}
