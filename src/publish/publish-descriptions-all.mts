import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { logger } from "../logger.mts";

/**
 * Description-only refresh for every published mod, run as two independent
 * queues that progress in parallel:
 *   - the mod.io queue runs publish-modio in DESC_ONLY mode (updates
 *     name/summary/description without rebuilding or re-uploading the modfile
 *     artifact),
 *   - the Steam queue runs publish-steam (workshop_build_item re-syncs the
 *     content folder; zip-for-xbox is intentionally skipped).
 * Each queue processes mods sequentially within itself, but both queues run
 * concurrently so a slow Steam upload never blocks the mod.io queue.
 *
 * Optionally restrict to specific mods by passing names as CLI args.
 * SKIP_STEAM=1 / SKIP_MODIO=1 disable a queue entirely.
 */

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const modsFolder = path.resolve(srcDir, "../../Mods");
const cwd = path.resolve(srcDir, "..");

const only = process.argv.slice(2);

function isPublished(modDir: string) {
  return fs.existsSync(path.join(modDir, ".modio")) && fs.existsSync(path.join(modDir, "workshopitem.vdf"));
}

const mods = fs
  .readdirSync(modsFolder, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => (only.length ? only.includes(name) : true))
  .filter((name) => isPublished(path.join(modsFolder, name)));

function runStep(tag: string, script: string, modName: string, extraEnv: Record<string, string> = {}) {
  return new Promise<boolean>((resolve) => {
    const child = spawn("node", [path.join(srcDir, script)], {
      cwd,
      env: { ...process.env, S2_MOD: modName, ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const prefix = (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) {
        if (line.length) logger.log(`[${tag}] ${line}`);
      }
    };
    child.stdout.on("data", prefix);
    child.stderr.on("data", prefix);
    child.on("close", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

/** Process the whole mod list sequentially through one platform script. */
async function queue(tag: string, script: string, extraEnv: Record<string, string>, failures: string[]) {
  for (const [i, modName] of mods.entries()) {
    logger.log(`[${tag}] ===== (${i + 1}/${mods.length}) ${modName} =====`);
    const ok = await runStep(tag, script, modName, extraEnv);
    if (!ok) {
      failures.push(`${modName} (${tag})`);
      logger.log(`[${tag}] publish failed for ${modName}; continuing.`);
    }
  }
  logger.log(`[${tag}] queue complete.`);
}

const steamFailures: string[] = [];
const modioFailures: string[] = [];

const queues: Promise<void>[] = [];
if (!process.env.SKIP_STEAM) queues.push(queue("STEAM", "publish-steam.mts", { DESC_ONLY: "1" }, steamFailures));
if (!process.env.SKIP_MODIO) queues.push(queue("MODIO", "publish-modio.mts", { DESC_ONLY: "1" }, modioFailures));

logger.log(`Description publish for ${mods.length} mod(s) across ${queues.length} parallel queue(s).`);

await Promise.all(queues);

const failures = [...steamFailures, ...modioFailures];
const total = mods.length * queues.length;
logger.log(`\nDone. ${total - failures.length}/${total} publishes succeeded.`);
if (failures.length) {
  logger.log(`Failures:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
