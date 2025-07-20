#!/usr/bin/node

import { Entries, Struct } from "s2cfgtojson";
import path from "node:path";
import * as fs from "node:fs";
import dotEnv from "dotenv";

dotEnv.config();
// scan all local .cfg files
const rootDir = path.join(import.meta.dirname, "..");
const baseCfgDir = path.join("Stalker2", "Content", "GameLite");
export type Meta = {
  changenote: string;
  description: string;
  entriesTransformer(
    entries: { SID: string },
    context: { s: Struct<typeof entries>; i: number; arr: Struct[]; file: string },
  ): Entries | null;
  interestingContents: string[];
  interestingFiles: string[];
  interestingIds: string[];
  prohibitedIds: string[];
};
const emptyMeta = `
  import { Struct, Entries } from "s2cfgtojson";
  type StructType = Struct<{}>;
  export const meta = {
    interestingFiles: [],
    interestingContents: [],
    prohibitedIds: [],
    interestingIds: [],
    description: "",
    changenote: "",
    entriesTransformer: (entries: Entries) => entries,
  };
`.trim();

const readOneFile = (file: string) => {
  return fs.readFileSync(file, "utf8");
};

function getCfgFiles() {
  const cfgFiles = [];
  function scanAllDirs(start: string) {
    const files = fs.readdirSync(start);
    for (const file of files) {
      if (fs.lstatSync(path.join(start, file)).isDirectory()) {
        scanAllDirs(path.join(start, file));
      } else if (file.endsWith(".cfg")) {
        cfgFiles.push(path.join(start, file));
      }
    }
  }

  scanAllDirs(path.join(rootDir, baseCfgDir));
  return cfgFiles;
}

const MOD_NAME = process.env.MOD_NAME;
const modFolder = path.join(rootDir, "Mods", MOD_NAME);
const modFolderRaw = path.join(modFolder, "raw");
const modFolderSteam = path.join(modFolder, "steamworkshop");

if (!fs.existsSync(modFolderSteam)) fs.mkdirSync(modFolderSteam, { recursive: true });

const metaPath = path.join(modFolder, "meta.mts");
if (!fs.existsSync(metaPath)) fs.writeFileSync(metaPath, emptyMeta);

const { meta } = (await import(metaPath)) as { meta: Meta };
const { interestingIds, interestingFiles, interestingContents, prohibitedIds, entriesTransformer } = meta;

const total = getCfgFiles()
  .filter((file) => interestingFiles.some((i) => file.includes(i)))
  .map((file) => {
    const content = readOneFile(file);
    if (interestingContents.length && !interestingContents.some((i) => content.includes(i))) {
      return;
    }
    // console.log(`Reading file: ${file}`);
    const pathToSave = path.parse(file.slice(path.join(rootDir, baseCfgDir).length + 1));
    const cfgEnclosingFolder = path.join(modFolderRaw, baseCfgDir, pathToSave.dir, pathToSave.name);

    const structs = Struct.fromString<Struct<{ SID?: string }>>(content)
      .filter(
        (s): s is Struct<{ SID: string }> =>
          s.entries.SID &&
          (interestingIds.length ? interestingIds.some((id) => s.entries.SID.includes(id)) : true) &&
          prohibitedIds.every((id) => !s.entries.SID.includes(id)),
      )
      .map((s, i, arr) => {
        s.refurl = "../" + pathToSave.base;
        s.refkey = s.entries.SID;
        s._id = `${MOD_NAME}${idIsArrayIndex(s._id) ? "" : `_${s._id}`}`;
        if (entriesTransformer) (s as Struct).entries = entriesTransformer(s.entries, { s, i, arr, file });
        if (!s.entries) {
          return null;
        }
        return s;
      })
      .filter(Boolean);

    if (structs.length) {
      if (!fs.existsSync(cfgEnclosingFolder)) fs.mkdirSync(cfgEnclosingFolder, { recursive: true });
      fs.writeFileSync(
        path.join(cfgEnclosingFolder, `${MOD_NAME}${pathToSave.base}`),
        structs.map((s) => s.toString()).join("\n\n"),
      );
    }
    return structs;
  });

console.log(`Total: ${total.length} files processed.`);
const writtenFiles = total.filter((s) => s?.length > 0);
console.log(`Total: ${writtenFiles.flat().length} structs in ${writtenFiles.length} files written.`);
console.log("Now packing the mod and injecting into the game...");
await import("./packmod.mjs");

function idIsArrayIndex(id: string): boolean {
  return id && Struct.isNumber(Struct.extractKeyFromBrackets(id));
}
