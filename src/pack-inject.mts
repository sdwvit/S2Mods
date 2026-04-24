import "./ensure-env.mts";
import { modFolderSteamStruct } from "./mod-meta-paths.mts";
import { spawnSync } from "child_process";
import { injectIntoGame } from "./inject-into-game.mts";
import { getPackFileName, pack } from "./pack.mts";
import path from "path";
import { maybeLaunchStalker2 } from "./launch-stalker2.mts";

await pack();

await injectIntoGame(path.join(await modFolderSteamStruct, await getPackFileName()));

spawnSync("paplay", ["./pop.wav"]);

maybeLaunchStalker2();
spawnSync("echo", [new Date().toISOString()]);
