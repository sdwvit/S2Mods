#!/usr/bin/node

import { Struct } from "./Struct.ts";
import path from "node:path";
import * as fs from "node:fs";

// scan all local .cfg files
const rootDir = path.join(import.meta.dirname, "..");
const dirPath = path.join("Stalker2", "Content", "GameLite");
const readOneFile = (file) => fs.readFileSync(file, "utf8");
/*

function parseOne(fileContent) {
  const lines = fileContent.split("\n").map((line) => line.trim());

  const leftParts = lines
    .map((line) =>
      [...line.matchAll(/([A-Z]\w+)\s*=\s*[\w:\[\]]+/g)].map(([_, m]) => m),
    )
    .flat()
    .filter(filterPrimitives);

  const rightParts = lines
    .map((line) =>
      [...line.matchAll(/\w+\s*=\s*([A-Z][^=\[\];{}'\\\/]+)/g)].map(
        ([_, m]) => m,
      ),
    )
    .flat()
    .filter(filterPrimitives);

  const structs = lines
    .map((line) => [...line.matchAll(/([A-Z]\w+) : .+/g)].map(([_, m]) => m))
    .flat()
    .filter(filterPrimitives);
  return { leftParts, rightParts, structs };
}

/**
 * Removes entries from dict1 that are present in dict2.
 * Returns a new dictionary with the remaining entries from dict1.
 *\/
const dedup = (arr1, arr2) => {
  const set2 = new Set(arr2);

  return arr1.filter((item) => !set2.has(item));
};
const filterPrimitives = (r) =>
  r !== "true" &&
  r !== "false" &&
  r.split("").filter((l) => l.toUpperCase() !== l.toLowerCase()).length > 2 &&
  !r.includes("_") &&
  !r.includes(" ");
const pickTop = (arr) =>
  Object.values(
    arr.flat().reduce((mem, v) => {
      mem[v] ||= [0, v];
      mem[v][0] += 1;
      return mem;
    }, {}),
  )
    .sort((a, b) => b[0] - a[0])
    .filter((v) => v[0] >= 3)
    .map((v) => v[1])
    .sort();
*/

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
  scanAllDirs(path.join(rootDir, dirPath), (file) => {
    cfgFiles.push(file);
  });
  return cfgFiles;
}
const MOD_NAME = "GlassCannon";
const interestingFiles = [];
const res = getCfgFiles()
  .filter((file) => interestingFiles.some((i) => file.includes(i)))
  .map((file) => {
    console.log(`Parsing ${file}`);
    const pathToSave = path.parse(
      file.slice(path.join(rootDir, dirPath).length + 1),
    );

    const modFileRoot = path.join(rootDir, MOD_NAME, dirPath);
    const modFileDir = path.join(modFileRoot, pathToSave.dir, pathToSave.name);
    if (!fs.existsSync(modFileDir)) {
      fs.mkdirSync(modFileDir, { recursive: true });
    }
    const structs = Struct.fromString(readOneFile(file)).map((s) => {
      s.refurl = "../" + pathToSave.base;
      s.refkey = s._id;
      s._id = `${MOD_NAME}${s._id ? `_${s._id}` : ""}`;
      return s.toString();
    });
    fs.writeFileSync(
      path.join(modFileDir, `${MOD_NAME}${pathToSave.base}`),
      structs.join("\n\n"),
    );
    /*
    fs.writeFileSync(
      path.join(modFileDir, `${pathToSave.name}.json`),
      `[${Struct.fromString(readOneFile(file)).map((s) => s.toTs()).join(",\n")}]`,
    );*/
  });

/*

const leftParts = pickTop(res.map((p) => p.leftParts));
const structs = dedup(pickTop(res.map((p) => p.structs)), leftParts);
const rightParts = dedup(pickTop(res.map((parsed) => parsed.rightParts)), [
  ...structs,
  ...leftParts,
]);

fs.writeFileSync(
  path.join(import.meta.dirname, "leftParts.txt"),
  leftParts.join("\n"),
);
fs.writeFileSync(
  path.join(import.meta.dirname, "structs.txt"),
  structs.join("\n"),
);
fs.writeFileSync(
  path.join(import.meta.dirname, "rightParts.txt"),
  rightParts.join("\n"),
);
*/
