import * as fs from "node:fs";
import { spawnSync } from "child_process";
import { modFolderRaw, modFolderSteam } from "./base-paths.mjs";
import { logger } from "./logger.mjs";
import { onL2Finish } from "./l2-cache.mjs";
import { onL3Finish } from "./l3-cache.mjs";
import { onL1Finish } from "./l1-cache.mjs";
import { metaPromise } from "./meta-promise.mts";
import { processOneTransformer } from "./process-one-transformer.mjs";
import { recursiveCfgFind } from "./recursive-cfg-find.mts";
import { rmSync } from "node:fs";
console.time();

const { meta } = await metaPromise;

if (fs.existsSync(modFolderRaw)) {
  recursiveCfgFind(modFolderRaw, (f) => rmSync(f));
}
if (!fs.existsSync(modFolderSteam)) {
  fs.mkdirSync(modFolderSteam, { recursive: true });
}

const total = await Promise.all(meta.structTransformers.map((t) => processOneTransformer(t).finally(() => meta.onTransformerFinish?.(t))));

await meta.onFinish?.();
console.timeEnd();

logger.log(`Total: ${total.length} transformers processed.`);
const writtenFiles = total.flat().filter((s) => s?.length > 0);
logger.log(`Total: ${writtenFiles.flat().length} structs in ${writtenFiles.length} files written.`);

await import("./update-readme.mts");
await import("./push-to-sdk.mts");
await onL1Finish();
await onL2Finish();
await onL3Finish();
spawnSync("paplay", ["./pop.wav"]);
