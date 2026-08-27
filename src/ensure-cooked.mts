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

/**
 * Only these need the cooker. Everything else in raw/ - the .cfg patches, the .uplugin - is a
 * loose file that UnrealPak stages directly, so a change to it can be shipped by repacking the
 * existing cooked tree instead of paying a ~43 min cook for a ~1.1s packaging step.
 */
const COOKABLE_EXTENSIONS = new Set([".uasset", ".uexp", ".umap", ".ubulk", ".uptnl"]);

/**
 * Fingerprint raw/ in two halves, so we can tell "the assets changed" (needs the cooker) from
 * "only loose files changed" (needs only the packaging tail). Same per-file content hashing as
 * hashRaw for the same reason - mtimes churn while bytes do not.
 */
export function hashRawSplit(): { cookable: string; loose: string } {
  const hashes = { cookable: createHash("sha1"), loose: createHash("sha1") };
  for (const file of walk(modFolderRaw)) {
    const half = COOKABLE_EXTENSIONS.has(path.extname(file).toLowerCase()) ? "cookable" : "loose";
    hashes[half].update(path.relative(modFolderRaw, file));
    hashes[half].update(readFileSync(file));
  }
  return { cookable: hashes.cookable.digest("hex"), loose: hashes.loose.digest("hex") };
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

  const split = hashRawSplit();
  const fingerprint = JSON.stringify({ raw: rawHash, ...split });

  if (stagedExists) {
    if (!existsSync(hashFile)) {
      // Pre-existing cook from before hashing, or one restored by hand. Trust it and record
      // the fingerprint rather than burning 40 minutes to prove it is current.
      writeFileSync(hashFile, fingerprint);
      logger.log(`Staged cook found with no fingerprint - adopting it (${hashFile}).`);
      return;
    }
    const recorded = readFileSync(hashFile, "utf8").trim();
    // The fingerprint used to be a bare sha1 of all of raw/; keep reading those.
    const previous: { raw: string; cookable?: string; loose?: string } = recorded.startsWith("{")
      ? JSON.parse(recorded)
      : { raw: recorded };

    if (previous.raw === rawHash) {
      logger.log("Staged cook matches raw/, skipping cook.");
      return;
    }
    // The cooked .uasset/.uexp are still current and only loose files moved, so the cooker has
    // nothing to do - replay just the two UnrealPak calls that write the shipped containers.
    // ~9s instead of ~43 min; see src/repack.mts for how that equivalence was verified.
    if (previous.cookable && previous.cookable === split.cookable) {
      logger.log("Only loose files changed since the staged cook - repacking instead of cooking.");
      const { repackMod } = await import("./repack.mts");
      await repackMod();
      writeFileSync(hashFile, fingerprint);
      return;
    }
  }

  logger.log(
    stagedExists
      ? "raw/ changed since the staged cook, re-cooking..."
      : "No staged cook found, cooking...",
  );
  await cookMod();
  writeFileSync(hashFile, fingerprint);
}
