import "./ensure-env.mts";
import { logger } from "./logger.mts";
import { spawnSync } from "child_process";
import { spawn } from "node:child_process";

function getNodeCommand() {
  return process.env.NODE_PATH || process.execPath;
}

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
  cmdSync(`${getNodeCommand()} ${tsFile}`, env);
}
export function node(tsFile: string, env = {}) {
  return cmd(`${getNodeCommand()} ${tsFile}`, env);
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
