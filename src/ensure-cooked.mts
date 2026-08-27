import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { logger } from "./logger.mts";
import { modFolderRaw } from "./base-paths.mts";
import { sdkStagedModFolder } from "./mod-meta-paths.mts";
import { cookMod } from "./cook.mts";

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .flatMap((entry) => {
      const full = path.join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : [full];
    })
    .sort();
}

/**
 * Fingerprint of raw/ by content, not by mtime: the publish pipeline itself rewrites raw/
 * (pull-assets copies the SDK mod folder back over it) and prepare-configs regenerates the
 * .cfg files, so timestamps churn constantly while the bytes stay identical.
 */
export function hashRaw(): string {
  const hash = createHash("sha1");
  for (const file of walk(modFolderRaw)) {
    hash.update(path.relative(modFolderRaw, file));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

/** Sits beside the staged output, not inside Windows/, so pull-staged never ships it. */
export const hashFileFor = (staged: string) => path.join(path.dirname(staged), ".raw-hash");

/**
 * Published mods always ship cooked paks - loose configs are a local-injection shortcut only.
 * Cooks only when raw/ has actually changed since the staged output was produced, so running
 * several publishers back to back costs one cook at most.
 */
export async function ensureCooked() {
  const staged = await sdkStagedModFolder;
  const hashFile = hashFileFor(staged);
  const stagedExists = existsSync(staged) && readdirSync(staged).length > 0;
  const rawHash = hashRaw();

  if (stagedExists) {
    if (!existsSync(hashFile)) {
      // Pre-existing cook from before hashing, or one restored by hand. Trust it and record
      // the fingerprint rather than burning 40 minutes to prove it is current.
      writeFileSync(hashFile, rawHash);
      logger.log(`Staged cook found with no fingerprint - adopting it (${hashFile}).`);
      return;
    }
    if (readFileSync(hashFile, "utf8").trim() === rawHash) {
      logger.log("Staged cook matches raw/, skipping cook.");
      return;
    }
  }

  logger.log(
    stagedExists
      ? "raw/ changed since the staged cook, re-cooking..."
      : "No staged cook found, cooking...",
  );
  await cookMod();
  writeFileSync(hashFile, rawHash);
}
