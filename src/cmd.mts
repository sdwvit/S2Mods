import { logger } from "./logger.mts";
import { spawnSync } from "child_process";

export const cmd = (c: string, env = {}) => {
  logger.log("-- Executing command", c);
  return spawnSync(c, {
    stdio: "inherit",
    cwd: import.meta.dirname,
    shell: "/usr/bin/bash",
    env: { ...process.env, ...env },
  });
};

export function node(tsFile: string, env = {}) {
  cmd(`node --import file:${process.env.NODE_TS_TRANSFORMER} ${tsFile}`, env);
}
