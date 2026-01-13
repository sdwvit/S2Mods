import "./ensure-dot-env.mts";
import { modFolderSteamStruct, modName } from "./base-paths.mjs";
import { spawnSync } from "child_process";
import { injectIntoGame } from "./inject-into-game.mts";
import { getPackFileName, pack } from "./pack.mts";
import path from "path";

await pack();

injectIntoGame(path.join(await modFolderSteamStruct, await getPackFileName()));

spawnSync("paplay", ["./pop.wav"]);
