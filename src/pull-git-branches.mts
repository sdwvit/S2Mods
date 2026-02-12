import { allValidMods } from "./base-paths.mts";
import { spawnSync } from "child_process";
import { cmd } from "./cmd.mts";

function getCurrentBranch() {
  const result = spawnSync("git", ["branch", "--show-current"], {
    cwd: import.meta.dirname,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

const initialBranch = getCurrentBranch();
const promises = [...allValidMods, "master"].map((mod) => cmd(["git", "fetch", "origin", `master:${mod}`].join(" ")));
await Promise.all(promises);
if (initialBranch) {
  await cmd(["git", "checkout", initialBranch].join(" "));
}
spawnSync("paplay", ["./pop.wav"]);
