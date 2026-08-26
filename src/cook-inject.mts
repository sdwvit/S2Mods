import "./ensure-env.mts";
import { spawnSync } from "child_process";
import { cookMod } from "./cook.mts";
import { injectStagedIntoGame } from "./inject-into-game.mts";
import { injectRawIntoGame, isCfgOnlyMod } from "./inject-raw.mts";
import { maybeLaunchStalker2 } from "./launch-stalker2.mts";
import { logger } from "./logger.mts";

if (isCfgOnlyMod() && !process.env.FORCE_COOK) {
  logger.log("Mod has no cookable assets, skipping the cook and injecting loose configs.");
  await injectRawIntoGame();
} else {
  await cookMod();
  await injectStagedIntoGame();
}

maybeLaunchStalker2();

spawnSync("paplay", ["./pop.wav"]);
spawnSync("echo", [new Date().toISOString()]);
