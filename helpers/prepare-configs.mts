#!/usr/bin/node

import { Struct } from "s2cfgtojson";
import path from "node:path";
import * as fs from "node:fs";

import dotEnv from "dotenv";

dotEnv.config();
// scan all local .cfg files
const rootDir = path.join(import.meta.dirname, "..");
const baseCfgDir = path.join("Stalker2", "Content", "GameLite");
const readOneFile = (file) => fs.readFileSync(file, "utf8");

function getCfgFiles() {
  function scanAllDirs(start: string, cb: (file: string) => void) {
    const files = fs.readdirSync(start);
    for (const file of files) {
      if (fs.lstatSync(path.join(start, file)).isDirectory()) {
        scanAllDirs(path.join(start, file), cb);
      } else if (file.endsWith(".cfg")) {
        cb(path.join(start, file));
      }
    }
  }

  const cfgFiles = [];
  scanAllDirs(path.join(rootDir, baseCfgDir), (file) => {
    cfgFiles.push(file);
  });
  return cfgFiles;
}
const MOD_NAME = process.env.MOD_NAME;
const interestingFiles = [];
const modFolder = path.join(rootDir, "Mods", MOD_NAME);
const modFolderRaw = path.join(modFolder, "raw");
const modFolderSteam = path.join(modFolder, "steamworkshop");
if (!fs.existsSync(modFolderSteam)) {
  fs.mkdirSync(modFolderSteam, { recursive: true });
}
getCfgFiles()
  .filter((file) => interestingFiles.some((i) => file.includes(i)))
  .map((file) => {
    console.log(`Parsing ${file}`);
    const pathToSave = path.parse(file.slice(path.join(rootDir, baseCfgDir).length + 1));

    const cfgEnclosingFolder = path.join(modFolderRaw, baseCfgDir, pathToSave.dir, pathToSave.name);
    if (!fs.existsSync(cfgEnclosingFolder)) {
      fs.mkdirSync(cfgEnclosingFolder, { recursive: true });
    }

    const structs = Struct.fromString<Struct & { entries: { SID?: string } }>(readOneFile(file))
      .filter((s) => s.entries.SID)
      .map((s) => {
        s.refurl = "../" + pathToSave.base;
        s.refkey = s.entries.SID;
        s._id = `${MOD_NAME}${idIsArrayIndex(s._id) ? "" : `_${s._id}`}`;
        return s.toString();
      });
    fs.writeFileSync(path.join(cfgEnclosingFolder, `${MOD_NAME}${pathToSave.base}`), structs.join("\n\n"));
  });

function idIsArrayIndex(id: string): boolean {
  return id && Struct.isNumber(Struct.extractKeyFromBrackets(id));
}
