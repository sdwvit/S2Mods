console.time("Took");
import * as fs from "node:fs";
import { spawnSync } from "child_process";
import { modFolderRaw, modFolderSteam } from "./base-paths.mts";
import { modMeta } from "./mod-meta-paths.mts";
import { logger } from "./logger.mts";
import { onL2Finish } from "./cache/l2-cache.mts";
import { onL3Finish } from "./cache/l3-cache.mts";
import { onL1Finish } from "./cache/l1-cache.mts";
import { processOneTransformer } from "./process-one-transformer.mts";
import { recursiveCfgFind } from "./recursive-cfg-find.mts";
import { rmSync } from "node:fs";
import { onL1GlobalFinish } from "./cache/l1global-cache.mts";

if (fs.existsSync(modFolderRaw)) {
  recursiveCfgFind(modFolderRaw, (f) => rmSync(f));
}
if (!fs.existsSync(modFolderSteam)) {
  fs.mkdirSync(modFolderSteam, { recursive: true });
}
const meta = await modMeta;
const total = await Promise.all(
  meta.structTransformers.map((t) =>
    processOneTransformer(t).finally(() => meta.onTransformerFinish?.(t)),
  ),
);

await meta.onFinish?.();
console.timeEnd("Took");

logger.log(`Total: ${total.length} transformers processed.`);
const writtenFiles = total.flat().filter((s) => s?.length > 0);
logger.log(`Total: ${writtenFiles.flat().length} structs in ${writtenFiles.length} files written.`);

// SKIP_SDK_PUSH=1 regenerates raw/ only: no readme, no SDK push (a full build), no asset pull.
// Useful for sweeping many cfg-only mods against a freshly extracted GameLite.
if (!process.env.SKIP_SDK_PUSH) {
  await Promise.allSettled([import("./update-readme.mts"), import("./push-to-sdk.mts")]).then(() =>
    import("./pull-assets.mts").then((m) => m.pullAssets()),
  );
}
await Promise.allSettled([onL1Finish(), onL2Finish(), onL3Finish(), onL1GlobalFinish()]);

spawnSync("paplay", ["./pop.wav"]);
