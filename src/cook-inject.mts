import "./ensure-env.mts";
import { sdkStagedPakFolder } from "./mod-meta-paths.mts";
import { spawnSync } from "child_process";
import { cookMod } from "./cook.mts";
import { injectIntoGame } from "./inject-into-game.mts";
import path from "node:path";

await cookMod();

await injectIntoGame(path.join(await sdkStagedPakFolder, "*"));

spawnSync("paplay", ["./pop.wav"]);
spawnSync("echo", [new Date().toISOString()]);
