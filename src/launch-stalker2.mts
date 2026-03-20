import { spawn } from "node:child_process";
import { logger } from "./logger.mts";

const STALKER2_STEAM_ID = "1643320";

export function maybeLaunchStalker2() {
  if (process.env.DRY || process.env.LAUNCH_STALKER2_AFTER_INJECT !== "1") {
    return;
  }

  const child = spawn("steam", [`steam://run/${STALKER2_STEAM_ID}`], {
    stdio: "ignore",
    detached: true,
    env: process.env,
  });
  child.unref();
  logger.log(`Requested Steam launch for app ${STALKER2_STEAM_ID}`);
}
