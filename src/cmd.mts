import { logger } from "./logger.mts";
import { spawnSync } from "child_process";
import { spawn } from "node:child_process";

export const cmdSync = (c: string, env = {}) => {
  logger.log("-- Executing command", c);
  return spawnSync(c, {
    stdio: "inherit",
    cwd: import.meta.dirname,
    shell: "/usr/bin/bash",
    env: { ...process.env, ...env },
  });
};

export function nodeSync(tsFile: string, env = {}) {
  cmdSync(`node --import file:${process.env.NODE_TS_TRANSFORMER} ${tsFile}`, env);
}

export async function cmd(c: string, env = {}) {
  logger.log("-- Executing command", c);
  return new Promise((resolve) => {
    const proc = spawn(c, {
      stdio: "inherit",
      cwd: import.meta.dirname,
      shell: "/usr/bin/bash",
      env: { ...process.env, ...env },
    });

    proc.on("exit", resolve);
  });
}
