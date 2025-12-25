import "./ensure-dot-env.mts";
import { modFolderSteamStruct, modName } from "./base-paths.mjs";
import { spawnSync } from "child_process";
import { injectIntoGame } from "./inject-into-game.mts";
import { getPackFileName, pack } from "./pack.mts";
import path from "path";

pack(modName);

injectIntoGame(path.join(modFolderSteamStruct, getPackFileName(modName)));

spawnSync("paplay", ["./pop.wav"]);
