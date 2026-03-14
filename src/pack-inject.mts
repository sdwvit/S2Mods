import "./ensure-env.mts";
import { modName } from "./base-paths.mts";
import { modFolderSteamStruct } from "./mod-meta-paths.mts";
import { spawnSync } from "child_process";
import { injectIntoGame } from "./inject-into-game.mts";
import { getPackFileName, pack } from "./pack.mts";
import path from "path";

await pack();

await injectIntoGame(path.join(await modFolderSteamStruct, await getPackFileName()));

spawnSync("paplay", ["./pop.wav"]);
