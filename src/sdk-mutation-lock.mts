import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { logger } from "./logger.mts";

const SDK_MUTATION_LOCK_DIR = path.join(os.tmpdir(), "s2mods-sdk-mutation.lock");
const SDK_MUTATION_LOCK_INFO = path.join(SDK_MUTATION_LOCK_DIR, "owner.json");
const SDK_MUTATION_WAIT_MS = 1000;
/**
 * Has to exceed the longest operation the lock guards, which is a cook (~22 min, ~43 for a split
 * mod). At the old 5 min a second publisher stole the lock out from under a running cook and
 * started its own concurrently - the exact double-cook the lock exists to prevent. Press Y to
 * force-release earlier when the holder really is dead.
 */
const SDK_MUTATION_FORCE_RELEASE_MS = 60 * 60 * 1000;

let localDepth = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function tryAcquireLock(label: string) {
  try {
    await fs.mkdir(SDK_MUTATION_LOCK_DIR);
    await fs.writeFile(SDK_MUTATION_LOCK_INFO, JSON.stringify({ pid: process.pid, label, startedAt: new Date().toISOString() }, null, 2), "utf8");
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return false;
    }
    throw error;
  }
}

async function waitForLock(label: string) {
  let cycle = 0;
  let yPressed = false;

  const onData = (chunk: Buffer) => {
    if (chunk.toString().trim().toLowerCase() === "y") {
      yPressed = true;
    }
  };

  const tty = process.stdin.isTTY;
  if (tty) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
  }

  try {
    while (!(await tryAcquireLock(label))) {
      logger.log(
        `[sdk-lock] waiting for SDK/game mutation lock before ${label}` +
          (tty ? " (press Y to force-release)" : ` (rm -rf ${SDK_MUTATION_LOCK_DIR} to release)`)
      );
      await sleep(SDK_MUTATION_WAIT_MS);
      cycle++;
      if (yPressed || cycle * SDK_MUTATION_WAIT_MS > SDK_MUTATION_FORCE_RELEASE_MS) {
        logger.log(`[sdk-lock] force-releasing lock before ${label}`);
        await releaseLock();
        yPressed = false;
        cycle = 0;
      }
    }
  } finally {
    if (tty) {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
  }
}

async function releaseLock() {
  await fs.rm(SDK_MUTATION_LOCK_DIR, { recursive: true, force: true });
}

export async function withSdkMutationLock<T>(label: string, fn: () => Promise<T> | T) {
  if (localDepth > 0) {
    localDepth += 1;
    try {
      return await fn();
    } finally {
      localDepth -= 1;
    }
  }

  await waitForLock(label);
  localDepth = 1;
  logger.log(`[sdk-lock] acquired for ${label}`);
  try {
    return await fn();
  } finally {
    localDepth = 0;
    await releaseLock();
    logger.log(`[sdk-lock] released for ${label}`);
  }
}
