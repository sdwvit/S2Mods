import path from "node:path";
import { existsSync, readFileSync, statSync, writeFileSync, openSync, readSync, closeSync } from "node:fs";
import { logger } from "./logger.mts";
import { projectRoot } from "./base-paths.mts";

/**
 * `Stalker2/Releases/<Version>/Windows/AssetRegistry.bin` is the registry the mod cook is
 * based on (`-BasedOnReleaseVersion`), and the authority on which packages the shipped game
 * already has. It ships with the SDK, so unlike the editor's `CachedAssetRegistry_*.bin` it
 * exists whether or not the Mod Editor has ever been opened.
 */
export const referenceRegistryPath = (release = "Latest") =>
  path.join(process.env.SDK_PATH, "Stalker2", "Releases", release, "Windows", "AssetRegistry.bin");

const cachePath = path.join(projectRoot, ".asset-registry-cache.json");

/** FNameHash::AlgorithmId, written as the name batch's hash version. */
const NAME_HASH_ALGORITHM_ID = 0xc1640000n;
const NAME_BATCH_OFFSET = 0x18;

/**
 * Parse the `LoadNameBatch` block at the head of the registry: every FName in the shipped
 * game, and the only part we need. The ~1.2 GB of asset entries that follow are skipped.
 *
 * The block is `count`, `stringBytes`, a uint64 hash array, a parallel array of
 * `FSerializedNameHeader` (big-endian: high bit = UTF-16, low 15 bits = length), then one
 * concatenated blob with no separators. The lengths have to come from those headers - a
 * substring search over the blob reports `/Game/A/Foo` as present because `/Game/A/FooBar` is.
 */
function readNameBatch(file: string): string[] {
  const fd = openSync(file, "r");
  try {
    const head = Buffer.alloc(NAME_BATCH_OFFSET + 16);
    readSync(fd, head, 0, head.length, 0);
    const count = head.readUInt32LE(NAME_BATCH_OFFSET);
    const stringBytes = head.readInt32LE(NAME_BATCH_OFFSET + 4);
    const hashVersion = head.readBigUInt64LE(NAME_BATCH_OFFSET + 8);
    if (hashVersion !== NAME_HASH_ALGORITHM_ID) {
      throw new Error(
        `unexpected name hash version 0x${hashVersion.toString(16)} in ${file} - ` +
          "the registry format changed, the classifier needs revisiting",
      );
    }

    const headersAt = NAME_BATCH_OFFSET + 16 + count * 8; // past the uint64 hash array
    const headers = Buffer.alloc(count * 2);
    readSync(fd, headers, 0, headers.length, headersAt);
    const blob = Buffer.alloc(stringBytes);
    readSync(fd, blob, 0, stringBytes, headersAt + headers.length);

    const names: string[] = new Array(count);
    let pos = 0;
    for (let i = 0; i < count; i++) {
      const b0 = headers[2 * i];
      const length = ((b0 & 0x7f) << 8) | headers[2 * i + 1];
      if (b0 & 0x80) {
        names[i] = blob.toString("utf16le", pos, pos + length * 2);
        pos += length * 2;
      } else {
        names[i] = blob.toString("utf8", pos, pos + length);
        pos += length;
      }
    }
    if (pos !== stringBytes) {
      throw new Error(`name blob under-read in ${file}: consumed ${pos} of ${stringBytes}`);
    }
    return names;
  } finally {
    closeSync(fd);
  }
}

let memo: Set<string> | null = null;

/**
 * Every `/Game/...` package name in the reference registry, lowercased - Unreal compares
 * package names case-insensitively, so callers must lowercase their query too.
 *
 * Parsing costs a second or two, so the result is cached in the project root and invalidated
 * on the registry's size and mtime. Returns null when the registry is missing.
 */
export function baseGamePackages(release = "Latest"): Set<string> | null {
  if (memo) return memo;
  const file = referenceRegistryPath(release);
  if (!existsSync(file)) {
    logger.warn(`Reference asset registry not found at ${file}.`);
    return null;
  }
  const { size, mtimeMs } = statSync(file);
  const stamp = `${size}:${mtimeMs}`;

  if (existsSync(cachePath)) {
    try {
      const cached = JSON.parse(readFileSync(cachePath, "utf8")) as {
        stamp: string;
        packages: string[];
      };
      if (cached.stamp === stamp) return (memo = new Set(cached.packages));
    } catch {
      // fall through and rebuild
    }
  }

  const packages = new Set<string>();
  for (const name of readNameBatch(file)) {
    if (!name.startsWith("/Game/")) continue;
    // Object paths (/Game/Foo/Bar.Bar_C) name a package too - keep the part before the dot.
    const dot = name.indexOf(".", name.lastIndexOf("/"));
    packages.add((dot < 0 ? name : name.slice(0, dot)).toLowerCase());
  }
  writeFileSync(cachePath, JSON.stringify({ stamp, packages: [...packages].sort() }));
  logger.log(`Parsed ${packages.size} base-game package names from ${path.basename(file)}.`);
  return (memo = packages);
}

/**
 * Does the base game ship a package at `/Game/<tail>`? `tail` is a path below a Content root
 * with the extension dropped, e.g. `_STALKER2/Weapons/SM_Toz`.
 *
 * The whole package path is one FName, and Unreal splits a trailing `_<number>` off an FName
 * into its numeric part, which the name batch does not store. So the shipped
 * `.../Hub/BP_100_Rads_Bar_120` is only in the batch as `.../Hub/BP_100_Rads_Bar`, and an exact
 * test alone would call a mod that overrides it new content. Fall back to the stripped base:
 * at worst that claims an override for a mod adding `Foo_2` where the game has only `Foo`, which
 * is the safer direction to be wrong in - a suffixed name is nearly always an existing sibling.
 *
 * Returns null when the registry could not be read, so callers can warn instead of guessing.
 */
export function hasBaseGamePackage(tail: string): boolean | null {
  const packages = baseGamePackages();
  if (!packages) return null;
  const name = `/game/${tail.toLowerCase()}`;
  if (packages.has(name)) return true;
  // Only a suffix without leading zeros is a number to Unreal; `AS_Foo_01` stays one string.
  const base = /^(.*)_[1-9]\d*$/.exec(name)?.[1];
  return base ? packages.has(base) : false;
}
