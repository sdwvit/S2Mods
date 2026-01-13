import "./ensure-dot-env.mts";
import { sdkStagedPakFolder } from "./base-paths.mjs";
import { spawnSync } from "child_process";
import { cookMod } from "./cook.mts";
import { injectIntoGame } from "./inject-into-game.mts";
import path from "node:path";

await cookMod();

injectIntoGame(path.join(await sdkStagedPakFolder, "*"));

spawnSync("paplay", ["./pop.wav"]);
