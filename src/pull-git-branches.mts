import { allValidMods } from "./base-paths.mts";
import { spawnSync } from "child_process";
import { cmd } from "./cmd.mts";

const promises = allValidMods.map((mod) => cmd(["git", "fetch", "origin", `master:${mod}`].join(" ")));
promises.push(cmd(["git", "checkout", "master"].join(" ")).then(() => cmd(["git", "pull"].join(" "))));
await Promise.all(promises);

spawnSync("paplay", ["./pop.wav"]);
