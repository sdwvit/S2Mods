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
const interestingFiles = ["DynamicItemGenerator.cfg"];
const prohibitedIds = ["Trader"];
const interstingIds = new Set([
  "EItemGenerationCategory::BodyArmor",
  "EItemGenerationCategory::Head",
  "EItemGenerationCategory::Attach",
]);

const modFolder = path.join(rootDir, "Mods", MOD_NAME);
const modFolderRaw = path.join(modFolder, "raw");
const modFolderSteam = path.join(modFolder, "steamworkshop");
if (!fs.existsSync(modFolderSteam)) {
  fs.mkdirSync(modFolderSteam, { recursive: true });
}

const total = getCfgFiles()
  .filter((file) => interestingFiles.some((i) => file.includes(i)))
  //.filter((file) => {
  //  const oneFile = readOneFile(file);
  //  return oneFile.includes("Medkit");
  //})
  .map((file) => {
    console.log(`Parsing ${file}`);
    const pathToSave = path.parse(file.slice(path.join(rootDir, baseCfgDir).length + 1));

    const cfgEnclosingFolder = path.join(modFolderRaw, baseCfgDir, pathToSave.dir, pathToSave.name);

    const structs = Struct.fromString<
      Struct<{
        ItemGenerator: Struct<{
          [key: `[${number | string}]`]: Struct<{
            Category: string;
            PossibleItems: Struct<{
              [key: `[${number | string}]`]: Struct<{
                ItemPrototypeSID: string;
                Weight: number | string;
                MinDurability?: number | string;
                MaxDurability?: number | string;
                AmmoMinCount?: number;
                AmmoMaxCount?: number;
                Chance?: number;
              }>;
            }>;
          }>;
        }>;
        SpawnOnStart?: boolean;
        SID?: string;
      }>
    >(readOneFile(file))
      .filter((s) => s.entries.SID && prohibitedIds.every((id) => !s.entries.SID.includes(id)))
      .map((s) => {
        s.refurl = "../" + pathToSave.base;
        s.refkey = s.entries.SID;
        s._id = `${MOD_NAME}${idIsArrayIndex(s._id) ? "" : `_${s._id}`}`;
        let keep = false;
        Object.values(s.entries.ItemGenerator.entries).forEach((item) => {
          if (interstingIds.has(item.entries?.Category)) {
            Object.values(item.entries.PossibleItems.entries).forEach((pos) => {
              if (pos.entries) {
                if (pos.entries.ItemPrototypeSID === "empty") {
                  pos.entries = {} as typeof pos.entries;
                } else {
                  keep =
                    pos.entries.Weight == null ||
                    pos.entries.MinDurability == null ||
                    pos.entries.MaxDurability == null;

                  const newObj = {
                    ItemPrototypeSID: pos.entries.ItemPrototypeSID,
                  } as typeof pos.entries;
                  // newObj.Weight = pos.entries.Weight || 1;
                  if (item.entries?.Category !== "EItemGenerationCategory::Attach") {
                    newObj.MinDurability = pos.entries.MinDurability || 0;
                    newObj.MaxDurability =
                      pos.entries.MaxDurability ||
                      (Math.random() * 0.5 + parseFloat(newObj.MinDurability.toString())).toFixed(3);
                  }

                  newObj.Chance =
                    parseFloat(pos.entries.Chance?.toString()) ||
                    parseFloat((pos.entries.Weight || 1).toString()) / 1000;

                  pos.entries = newObj;
                }
              }
            });
          } else {
            if (item.entries) item.entries = {} as typeof item.entries; // remove non-interesting categories
          }
        });
        return keep ? s : null;
      })
      .filter((_) => _);

    if (structs.length) {
      if (!fs.existsSync(cfgEnclosingFolder)) {
        fs.mkdirSync(cfgEnclosingFolder, { recursive: true });
      }
      fs.writeFileSync(
        path.join(cfgEnclosingFolder, `${MOD_NAME}${pathToSave.base}`),
        structs.map((s) => s.toString()).join("\n\n"),
      );
    }
    return structs;
  })
  .flat();

console.log(`Total: ${total.length} structs processed.`);

function idIsArrayIndex(id: string): boolean {
  return id && Struct.isNumber(Struct.extractKeyFromBrackets(id));
}
