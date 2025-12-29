import "./ensure-dot-env.mts";
import { modName } from "./base-paths.mjs";
import { spawnSync } from "child_process";
import { cookMod, getStagedPath } from "./cook.mts";
import { injectIntoGame } from "./inject-into-game.mts";
import path from "node:path";

cookMod(modName);

injectIntoGame(path.join(getStagedPath(modName), "*"));

spawnSync("paplay", ["./pop.wav"]);
