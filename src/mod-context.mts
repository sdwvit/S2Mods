import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { projectRoot } from "./ensure-env.mts";

export const modsFolder = path.join(projectRoot, "Mods");
export const allValidMods = fs.readdirSync(modsFolder).filter((file) => fs.statSync(path.join(modsFolder, file)).isDirectory());

function getCliOption(name: string) {
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === name) {
      return args[index + 1];
    }
    if (arg.startsWith(`${name}=`)) {
      return arg.slice(name.length + 1);
    }
  }
}

function getBranchModName() {
  const branchName = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).stdout.trim();
  return branchName === "master" ? "MasterMod" : branchName;
}

export function resolveModName() {
  const modName = getCliOption("--mod") || process.env.S2_MOD || getBranchModName();
  if (!allValidMods.includes(modName)) {
    throw new Error(`Unknown mod "${modName}". Expected one of: ${allValidMods.sort().join(", ")}`);
  }
  return modName;
}
