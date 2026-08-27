import path from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { logger } from "./logger.mts";
import { baseCfgDir, modFolderRaw, modName } from "./base-paths.mts";
import { withSdkMutationLock } from "./sdk-mutation-lock.mts";

/**
 * A cook costs ~43 min, of which ~40 is the Game Data Editor plugin enumerating the 151k loose
 * .cfg files below GameLite/GameData - twice per pass, two passes. Wine needs 38s just to walk
 * that tree where native Linux needs 0.16s with everything already in the page cache, so the
 * cost is per-file Wine syscall overhead and scales with FILE COUNT, not bytes. Caching buys
 * nothing; removing files from the walk is the only lever.
 *
 * 130,520 of those 151,363 files (86%) sit under one subdirectory, SpawnActorPrototypes, and
 * only a handful of mods touch it. So for every other mod we can rename that subtree aside for
 * the duration of the cook and put it back afterwards.
 *
 * This mutates the user's SDK install, so every operation here is a same-filesystem rename
 * (never a copy, never a delete) and every move is recorded in a marker file so a fresh process
 * can undo it after a hard kill.
 */

/** Subtree names below GameLite/GameData, hidden in this order and restored in reverse. */
const DEFAULT_HIDDEN_SUBTREES = ["SpawnActorPrototypes"];

export const gameDataDir = path.join(baseCfgDir, "GameData");
/** Sibling of GameData's grandparent, inside SDK_PATH, so a rename can never cross a device. */
const hiddenRoot = path.join(process.env.SDK_PATH ?? "", ".s2mods-hidden-gamedata");
/** Kept outside hiddenRoot: recovery has to be able to read it when the move half-happened. */
const markerFile = path.join(process.env.SDK_PATH ?? "", ".s2mods-hidden-gamedata.json");

type Move = { subtree: string; from: string; to: string };
type Marker = { pid: number; label: string; startedAt: string; moves: Move[] };

/** `TRIM_GAMEDATA=1` opts in. Off by default - it moves 565 MB of the user's SDK around. */
const isEnabled = () => Boolean(process.env.TRIM_GAMEDATA);

/** `TRIM_GAMEDATA_SUBTREES=A,B` overrides which GameData children get hidden. */
export function hiddenSubtrees(): string[] {
  const override = process.env.TRIM_GAMEDATA_SUBTREES?.trim();
  if (!override) return DEFAULT_HIDDEN_SUBTREES;
  return override
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function countCfgs(dir: string): number {
  return walk(dir).filter((f) => f.toLowerCase().endsWith(".cfg")).length;
}

// ---------------------------------------------------------------------------------------------
// marker + recovery
// ---------------------------------------------------------------------------------------------

function readMarker(): Marker | null {
  if (!existsSync(markerFile)) return null;
  try {
    const parsed = JSON.parse(readFileSync(markerFile, "utf8")) as Marker;
    return Array.isArray(parsed?.moves) ? parsed : null;
  } catch {
    // A truncated marker is the one case we must not shrug off: something was moved and we no
    // longer know where. Better to stop than to cook against a tree in an unknown state.
    throw new Error(
      `Unreadable GameData trim marker ${markerFile}. Restore the moved subtree(s) from ` +
        `${hiddenRoot} by hand before cooking again.`,
    );
  }
}

function writeMarker(marker: Marker) {
  writeFileSync(markerFile, JSON.stringify(marker, null, 2));
}

function dropMarker() {
  if (existsSync(markerFile)) unlinkSync(markerFile);
  // Only if we emptied it - never recursively, it may still hold an unrestored subtree.
  if (existsSync(hiddenRoot) && !readdirSync(hiddenRoot).length) rmdirSync(hiddenRoot);
}

/**
 * Put back anything a previous (or current) run moved aside. Idempotent and synchronous, so it
 * can also be called from a signal handler, and safe to call when nothing was ever moved.
 *
 * Never deletes and never overwrites: if both the original and the hidden copy exist we have no
 * way to tell which one is authoritative, so we refuse and tell the user.
 */
export function restoreGameData(): Move[] {
  const marker = readMarker();
  if (!marker) return [];

  const restored: Move[] = [];
  for (const move of [...marker.moves].reverse()) {
    const hiddenExists = existsSync(move.to);
    const originalExists = existsSync(move.from);
    if (hiddenExists && originalExists) {
      throw new Error(
        `Cannot restore ${move.subtree}: both ${move.from} and ${move.to} exist. Merge or ` +
          `remove one by hand - refusing to overwrite either.`,
      );
    }
    if (!hiddenExists) continue; // already restored, or never moved
    mkdirSync(path.dirname(move.from), { recursive: true });
    renameSync(move.to, move.from);
    restored.push(move);
    logger.log(`[trim-gamedata] restored ${move.subtree} -> ${move.from}`);
  }

  dropMarker();
  return restored;
}

// ---------------------------------------------------------------------------------------------
// guards
// ---------------------------------------------------------------------------------------------

/**
 * Would hiding `subtrees` change what this mod cooks? Two ways a mod can depend on a subtree:
 * it ships files under it, or one of its .cfg patches points a `refurl=` into it. The second
 * case is the one that bites - a mod can reference SpawnActorPrototypes without shipping a
 * single file there.
 */
export function modReferencesHiddenSubtrees(
  subtrees: string[],
  rawFolder = modFolderRaw,
): string[] {
  const files = walk(rawFolder);
  const hits = new Set<string>();

  const gameDataPrefixes = subtrees.map((s) => ({
    subtree: s,
    needle: `GameData/${s}/`.toLowerCase(),
  }));

  // The directory alone is enough: NoPreplacedArmors' SpawnActorPrototypes tree is empty until
  // prepare-configs regenerates it, and a mod that has the folder plainly means to patch there.
  for (const subtree of subtrees) {
    const own = path.join(rawFolder, "Stalker2", "Content", "GameLite", "GameData", subtree);
    if (existsSync(own)) hits.add(`${subtree} (has raw/.../GameData/${subtree})`);
  }

  for (const file of files) {
    const posix = file.replaceAll(path.sep, "/").toLowerCase();
    for (const { subtree, needle } of gameDataPrefixes) {
      if (posix.includes(needle)) hits.add(`${subtree} (ships ${path.basename(file)})`);
    }
  }

  for (const file of files.filter((f) => f.toLowerCase().endsWith(".cfg"))) {
    let contents: string;
    try {
      contents = readFileSync(file, "utf8");
    } catch {
      continue; // not text - nothing to resolve
    }
    for (const match of contents.matchAll(/refurl\s*=\s*([^;}\s"]+)/gi)) {
      const target = match[1];
      // refurls are written relative to the .cfg holding them (`../ItemPrototypes.cfg`), so
      // resolve against the file's own directory before testing; also test the literal text,
      // for the occasional GameData-rooted form.
      const resolved = path.resolve(path.dirname(file), target).replaceAll(path.sep, "/");
      const literal = target.replaceAll("\\", "/").toLowerCase();
      for (const subtree of subtrees) {
        const needle = `gamedata/${subtree.toLowerCase()}/`;
        if (
          resolved.toLowerCase().includes(needle) ||
          literal.includes(`${subtree.toLowerCase()}/`)
        ) {
          hits.add(`${subtree} (refurl ${target} in ${path.basename(file)})`);
        }
      }
    }
  }

  return [...hits].sort();
}

export type TrimPlan =
  | { trim: false; reason: string }
  | { trim: true; moves: Move[]; before: number; after: number };

/** Everything that decides whether to trim, with no side effects - handy for tests and DRY. */
export function planTrim(subtrees = hiddenSubtrees()): TrimPlan {
  if (!isEnabled()) return { trim: false, reason: "TRIM_GAMEDATA is not set" };
  if (!process.env.SDK_PATH) return { trim: false, reason: "SDK_PATH is not set" };
  if (!subtrees.length) return { trim: false, reason: "TRIM_GAMEDATA_SUBTREES is empty" };
  if (!existsSync(gameDataDir)) return { trim: false, reason: `${gameDataDir} does not exist` };

  const references = modReferencesHiddenSubtrees(subtrees);
  if (references.length) {
    // A mod like CratesDontDropAnything hits this ~3000 times; the first few name the reason.
    const shown = references.slice(0, 3).join(", ");
    const rest = references.length > 3 ? ` (+${references.length - 3} more)` : "";
    return { trim: false, reason: `${modName} references ${shown}${rest}` };
  }

  const present = subtrees.filter((s) => existsSync(path.join(gameDataDir, s)));
  if (!present.length) {
    return { trim: false, reason: `none of ${subtrees.join(", ")} exist under ${gameDataDir}` };
  }

  // A rename across filesystems fails with EXDEV *after* we have decided to move; check first.
  const sdkDev = statSync(process.env.SDK_PATH).dev;
  const gameDataDev = statSync(gameDataDir).dev;
  if (sdkDev !== gameDataDev) {
    return {
      trim: false,
      reason:
        `${gameDataDir} is on a different filesystem than ${process.env.SDK_PATH} - a ` +
        `rename would have to become a 565 MB copy`,
    };
  }

  const before = countCfgs(gameDataDir);
  const hiddenCount = present.reduce((sum, s) => sum + countCfgs(path.join(gameDataDir, s)), 0);
  return {
    trim: true,
    before,
    after: before - hiddenCount,
    moves: present.map((subtree) => ({
      subtree,
      from: path.join(gameDataDir, subtree),
      to: path.join(hiddenRoot, subtree),
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// the wrapper
// ---------------------------------------------------------------------------------------------

let handlersInstalled = false;

/**
 * A hard kill would leave 130k files parked under a dot-directory with nothing pointing at
 * them, so restore from every exit path we can observe. The marker covers the paths we cannot
 * (SIGKILL, power loss) - the next run reads it and restores before doing anything else.
 */
function installEmergencyHandlers() {
  if (handlersInstalled) return;
  handlersInstalled = true;

  const emergency = (why: string) => () => {
    try {
      if (readMarker()) {
        logger.warn(`[trim-gamedata] ${why} - restoring GameData before exiting.`);
        restoreGameData();
      }
    } catch (error) {
      logger.error(`[trim-gamedata] restore during ${why} failed:`, error);
    }
  };

  // `exit` is the one that also covers an explicit process.exit(); `beforeExit` does not fire
  // there. Both are safe to install because restoreGameData() is idempotent and synchronous.
  process.on("exit", emergency("exit"));
  process.on("beforeExit", emergency("beforeExit"));
  process.on("uncaughtException", (error) => {
    emergency("uncaughtException")();
    throw error;
  });
  process.on("unhandledRejection", (reason) => {
    emergency("unhandledRejection")();
    logger.error("[trim-gamedata] unhandled rejection:", reason);
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      emergency(signal)();
      process.exit(signal === "SIGINT" ? 130 : 143);
    });
  }
}

/**
 * Hide the configured GameData subtrees, run `fn`, restore. Falls straight through to `fn` when
 * trimming is disabled or unsafe for this mod, so callers never have to branch.
 *
 * Takes the SDK mutation lock around the whole window: the tree must not be half-moved while
 * another script cooks or injects. `withSdkMutationLock` is re-entrant, so the cook's own
 * acquire nests harmlessly inside this one.
 */
export async function withTrimmedGameData<T>(label: string, fn: () => Promise<T> | T): Promise<T> {
  if (!isEnabled()) {
    // Still worth a recovery pass: the flag may have been turned off after a crashed run.
    restoreGameData();
    return await fn();
  }

  return withSdkMutationLock(`trim-gamedata:${label}`, async () => {
    // Anything left over from a previous hard kill goes back before we look at the tree, or the
    // file counts and the guard below would be measured against a mutilated GameData.
    restoreGameData();

    const plan = planTrim();
    if (plan.trim === false) {
      logger.log(`[trim-gamedata] skipped for ${label}: ${plan.reason}`);
      return await fn();
    }

    const saved = plan.before - plan.after;
    const percent = plan.before ? ((saved / plan.before) * 100).toFixed(1) : "0.0";
    logger.log(
      `[trim-gamedata] hiding ${plan.moves.map((m) => m.subtree).join(", ")}: ` +
        `${plan.before} -> ${plan.after} .cfg files (-${saved}, ${percent}%). The plugin walks ` +
        `this tree 4x per cook, so expect roughly the same proportion off the ~40 min scan.`,
    );

    if (process.env.DRY) {
      logger.log("[trim-gamedata] DRY - not moving anything.");
      return await fn();
    }

    installEmergencyHandlers();
    mkdirSync(hiddenRoot, { recursive: true });

    // Marker first, then move. The other order loses the record if we die mid-rename.
    const marker: Marker = {
      pid: process.pid,
      label,
      startedAt: new Date().toISOString(),
      moves: plan.moves,
    };
    writeMarker(marker);

    try {
      for (const move of plan.moves) {
        if (existsSync(move.to)) {
          throw new Error(`${move.to} already exists - refusing to overwrite a hidden subtree.`);
        }
        renameSync(move.from, move.to);
        logger.log(`[trim-gamedata] hid ${move.subtree} -> ${move.to}`);
      }
      return await fn();
    } finally {
      restoreGameData();
    }
  });
}

/** `node ./src/trim-gamedata.mts` restores by hand, and reports the plan for the current mod. */
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const restored = restoreGameData();
  logger.log(
    restored.length
      ? `Restored ${restored.length} subtree(s).`
      : "Nothing to restore - GameData is intact.",
  );
  const plan = planTrim();
  logger.log(
    plan.trim === true
      ? `Would hide ${plan.moves.map((m) => m.subtree).join(", ")} for ${modName}: ` +
          `${plan.before} -> ${plan.after} .cfg files.`
      : `Would not trim for ${modName}: ${plan.reason}`,
  );
}

/** Paths and helpers the verifier and the tests reach for; not part of the cook-time API. */
export const _internals = { hiddenRoot, markerFile, countCfgs };
