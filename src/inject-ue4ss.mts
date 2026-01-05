import { existsSync } from "node:fs";
import path from "node:path";
import { gameUE4SSModsFolder, modFolder, modName } from "./base-paths.mts";
import { logger } from "./logger.mts";
import { spawnSync } from "child_process";
import { cp, readFile, writeFile } from "node:fs/promises";

const ue4ssFolder = path.join(modFolder, "ue4ss");
if (!existsSync(ue4ssFolder)) {
  logger.error("Missing `ue4ss` folder for the mod", ue4ssFolder);
  process.exit(1);
}
if (!existsSync(path.join(ue4ssFolder, "main.lua"))) {
  logger.error("Missing `main.lua` for the mod");
  process.exit(1);
}

const cpPromise = cp(ue4ssFolder, path.join(gameUE4SSModsFolder, modName, "Scripts"), { recursive: true, force: true });
const modsJsonPath = path.join(gameUE4SSModsFolder, "mods.json");
const modsTxtPath = path.join(gameUE4SSModsFolder, "mods.txt");
const [modsJson, modsTxt] = await Promise.all([readFile(modsJsonPath), readFile(modsTxtPath)]);

const modsJsonMap = Object.fromEntries<boolean>(JSON.parse(modsJson.toString()).map((e) => [e.mod_name, e.mod_enabled]));

const modsTxtSet = new Set([modName]).union(
  new Set(
    modsTxt
      .toString()
      .split("\n")
      .map((e) => e.replace(/;.*/, "").trim())
      .filter((e) => e)
      .map((e) => e.split(":")[0].trim()),
  ),
);

modsJsonMap[modName] = true;

await Promise.all([
  writeFile(
    modsJsonPath,
    JSON.stringify(
      Object.entries(modsJsonMap).map(([mod_name, mod_enabled]) => ({
        mod_name,
        mod_enabled,
      })),
      null,
      4,
    ),
  ),
  writeFile(modsTxtPath, [...modsTxtSet].map((e) => `${e} : 1`).join("\n")),
  cpPromise,
]);

spawnSync("paplay", ["./pop.wav"]);
