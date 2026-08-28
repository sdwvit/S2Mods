import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { logger } from "./logger.mts";
import { modFolderRaw } from "./base-paths.mts";
import { modClassification, sdkModTargets, type SdkModTarget } from "./mod-meta-paths.mts";
import { COOKABLE_EXTENSIONS, isCfgFile, walkRaw } from "./mod-kinds.mts";
import { cookMod } from "./cook.mts";

/**
 * Fingerprint of raw/ by content, not by mtime: the publish pipeline itself rewrites raw/
 * (pull-assets copies the SDK mod folder back over it) and prepare-configs regenerates the
 * .cfg files, so timestamps churn constantly while the bytes stay identical.
 */
export function hashRaw(files: string[] = walkRaw(modFolderRaw)): string {
  const hash = createHash("sha1");
  for (const file of files) {
    hash.update(path.relative(modFolderRaw, file));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

/**
 * Fingerprint raw/ in two halves, so we can tell "the assets changed" (needs the cooker) from
 * "only loose files changed" (needs only the packaging tail). Same per-file content hashing as
 * hashRaw for the same reason - mtimes churn while bytes do not.
 */
export function hashRawSplit(files: string[] = walkRaw(modFolderRaw)): {
  cookable: string;
  loose: string;
} {
  const hashes = { cookable: createHash("sha1"), loose: createHash("sha1") };
  for (const file of files) {
    const half = COOKABLE_EXTENSIONS.has(path.extname(file).toLowerCase()) ? "cookable" : "loose";
    hashes[half].update(path.relative(modFolderRaw, file));
    hashes[half].update(readFileSync(file));
  }
  return { cookable: hashes.cookable.digest("hex"), loose: hashes.loose.digest("hex") };
}

/**
 * The raw/ files one SDK mod is responsible for. A single-target mod owns all of raw/ - the
 * fingerprint then stays exactly what it was before the split existed, so no mod gets re-cooked
 * just for adopting this code. A split mod's cfg half owns the .cfg patches and its assets half
 * owns everything else.
 */
function filesOwnedBy(target: SdkModTarget): string[] {
  const files = walkRaw(modFolderRaw);
  if (!modClassification.isSplit) return files;
  return files.filter((file) => (target.kind === "cfgs") === isCfgFile(file));
}

/** Sits beside the staged output, not inside Windows/, so pull-staged never ships it. */
export const hashFileFor = (staged: string) => path.join(path.dirname(staged), ".raw-hash");

/**
 * Published mods always ship cooked paks - loose configs are a local-injection shortcut only.
 * Cooks only when raw/ has actually changed since the staged output was produced, so running
 * several publishers back to back costs one cook at most.
 *
 * Runs once per SDK mod: a mod holding both .cfg patches and cooked assets is two of them, and
 * they are fingerprinted independently - which is the whole point of the split. Editing a .cfg
 * of such a mod now touches only the cfg half's fingerprint, and that half has no cookable files
 * at all, so it is always served by the ~9s repack instead of a ~22 min cook.
 */
export async function ensureCooked() {
  for (const target of await sdkModTargets) await ensureCookedTarget(target);
}

async function ensureCookedTarget(target: SdkModTarget) {
  // A cfg-only SDK mod has no cookable files at all, so the cooker has nothing to do for it and
  // never will - its ~22 min would produce an empty IoStore container and nothing else. Pack it
  // straight from the cfgs instead, whether or not anything is staged. See planCfgOnlyVariant.
  const staged = target.stagedModFolder;
  const hashFile = hashFileFor(staged);
  const stagedExists = existsSync(staged) && readdirSync(staged).length > 0;
  const owned = filesOwnedBy(target);
  const rawHash = hashRaw(owned);

  const split = hashRawSplit(owned);
  const fingerprint = JSON.stringify({ raw: rawHash, ...split });
  const label = modClassification.isSplit ? `[${target.kind}: ${target.name}] ` : "";

  if (target.kind === "cfgs") {
    logger.log(`${label}Nothing cookable - packing the cfgs directly (~10s).`);
    const { repackMod } = await import("./repack.mts");
    await repackMod(target);
    writeFileSync(hashFile, fingerprint);
    return;
  }

  if (stagedExists) {
    if (!existsSync(hashFile)) {
      // Pre-existing cook from before hashing, or one restored by hand. Trust it and record
      // the fingerprint rather than burning 40 minutes to prove it is current.
      writeFileSync(hashFile, fingerprint);
      logger.log(`${label}Staged cook found with no fingerprint - adopting it (${hashFile}).`);
      return;
    }
    const recorded = readFileSync(hashFile, "utf8").trim();
    // The fingerprint used to be a bare sha1 of all of raw/; keep reading those.
    const previous: { raw: string; cookable?: string; loose?: string } = recorded.startsWith("{")
      ? JSON.parse(recorded)
      : { raw: recorded };

    if (previous.raw === rawHash) {
      logger.log(`${label}Staged cook matches raw/, skipping cook.`);
      return;
    }
    // The cooked .uasset/.uexp are still current and only loose files moved, so the cooker has
    // nothing to do - replay just the two UnrealPak calls that write the shipped containers.
    // ~9s instead of ~43 min; see src/repack.mts for how that equivalence was verified.
    //
    // This is also what carries the 9 both-mods through their first split run: dropping the
    // cfgs out of the assets half changes its `raw` hash but not its `cookable` one, so the
    // assets half is repacked (without the cfgs) rather than re-cooked.
    if (previous.cookable && previous.cookable === split.cookable) {
      logger.log(
        `${label}Only loose files changed since the staged cook - repacking instead of cooking.`,
      );
      const { repackMod } = await import("./repack.mts");
      await repackMod(target);
      writeFileSync(hashFile, fingerprint);
      return;
    }
  }

  logger.log(
    stagedExists
      ? `${label}raw/ changed since the staged cook, re-cooking...`
      : `${label}No staged cook found, cooking...`,
  );
  await cookMod(target);
  writeFileSync(hashFile, fingerprint);
}
