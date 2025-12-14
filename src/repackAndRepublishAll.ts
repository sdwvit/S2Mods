import { validMods } from "./base-paths.mts";
import { spawnSync } from "child_process";
import { logger } from "./logger.mts";
import { cookMod } from "./cook.ts";

validMods.map((mod) => {
  spawnNode("./prepare-configs.mts", { MOD_NAME: mod });
  logger.log(`\n\n=== Packing Mod: ${mod} ===\n\n`);
  cookMod(mod);
  spawnNode("./publish-steam.mts", { MOD_NAME: mod, CHANGENOTE: "Repack for a new patch" });
});

function spawnNode(tsFile: string, env: Record<string, string>) {
  const fullCmd = `node --import file:${process.env.NODE_TS_TRANSFORMER} ${tsFile}`;
  logger.log("Using command: " + fullCmd + "\n\nExecuting...\n");

  spawnSync(fullCmd, {
    stdio: "inherit",
    cwd: import.meta.dirname,
    shell: "/usr/bin/bash",
    env: { ...process.env, ...env },
  });
}
