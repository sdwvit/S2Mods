import "./ensure-env.mts";
import { spawnSync } from "child_process";
import { ensureCooked } from "./ensure-cooked.mts";
import { injectStagedIntoGame } from "./inject-into-game.mts";
import { injectRawIntoGame, isCfgOnlyMod } from "./inject-raw.mts";
import { maybeLaunchStalker2 } from "./launch-stalker2.mts";
import { logger } from "./logger.mts";

if (isCfgOnlyMod() && !process.env.COOK_CFG_MODS) {
  logger.log("Mod has no cookable assets, skipping the cook and injecting loose configs.");
  await injectRawIntoGame();
} else {
  // Both halves of a split mod, so the install is never half of a mod. ensureCooked skips the
  // ~22 min editor round-trip when raw/ is unchanged since the staged cook, and downgrades it to
  // the ~9s repack when only loose files moved - the common case for a cfg edit on a mod that
  // also ships assets.
  await ensureCooked();
  await injectStagedIntoGame();
}

maybeLaunchStalker2();

spawnSync("paplay", ["./pop.wav"]);
spawnSync("echo", [new Date().toISOString()]);
