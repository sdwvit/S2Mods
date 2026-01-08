import { allValidMods } from "./base-paths.mts";
import { spawnSync } from "child_process";
import { cmd } from "./cmd.mts";

const promises = [...allValidMods, "master"].map((mod) => cmd(["git", "fetch", "origin", `master:${mod}`].join(" ")));
await Promise.all(promises);
await cmd(["git", "checkout", "master"].join(" "));
spawnSync("paplay", ["./pop.wav"]);
