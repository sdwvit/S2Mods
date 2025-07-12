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
const interestingFiles = ["DynamicItemGenerator"];
const modFolder = path.join(rootDir, "Mods", MOD_NAME);
const modFolderRaw = path.join(modFolder, "raw");
const modFolderSteam = path.join(modFolder, "steamworkshop");
if (!fs.existsSync(modFolderSteam)) {
  fs.mkdirSync(modFolderSteam, { recursive: true });
}
const prohibitedIds = [
  "Zombie_",
  "GeneralNPC",
  "DeadBody",
  "Corpse",
  "CloseCombat",
  "Guard",
  "Granit",
  "Sniper",
  "Bartender",
  "Attachments",
  "Ammo",
  "Cosnsumables",
  "Medic",
  "Techician",
  "Techncian",
  "Techinican",
  "Technician",
];

const total = getCfgFiles()
  .filter((file) => interestingFiles.some((i) => file.includes(i)))
  .map((file) => {
    console.log(`Parsing ${file}`);
    const pathToSave = path.parse(file.slice(path.join(rootDir, baseCfgDir).length + 1));

    const cfgEnclosingFolder = path.join(modFolderRaw, baseCfgDir, pathToSave.dir, pathToSave.name);

    const structs = Struct.fromString<
      Struct & {
        entries: {
          SID?: string;
          ItemGenerator: Struct;
        };
      }
    >(readOneFile(file))
      .filter((s) => s.entries.SID && prohibitedIds.every((id) => !s.entries.SID.includes(id)))
      .map((s) => {
        s.refurl = "../" + pathToSave.base;
        s.refkey = s.entries.SID;
        s._id = `${MOD_NAME}${idIsArrayIndex(s._id) ? "" : `_${s._id}`}`;
        const interestingCategories = new Set([
          "EItemGenerationCategory::WeaponPistol",
          "EItemGenerationCategory::WeaponPrimary",
          "EItemGenerationCategory::WeaponSecondary",
          "EItemGenerationCategory::Head",
          "EItemGenerationCategory::BodyArmor",
        ]);
        const interesetingItemGenerators = new Set([
          "Trader_T1_Guns_ItemGenerator",
          "Trader_T2_Guns_ItemGenerator",
          "Trader_T3_Guns_ItemGenerator",
          "Trader_T4_Guns_ItemGenerator",
        ]);
        Object.values(s.entries.ItemGenerator.entries)
          .filter((e) => e instanceof Struct)
          .forEach((e) => {
            if (interestingCategories.has(e.entries.Category)) {
              e.entries = { ReputationThreshold: "1000000" };
              return;
            }
            if (e.entries.Category === "EItemGenerationCategory::SubItemGenerator") {
              // e.entries = {};
              Object.values(e.entries.PossibleItems.entries).forEach((item) => {
                if (item instanceof Struct) {
                  if (interesetingItemGenerators.has(item.entries.ItemGeneratorPrototypeSID)) {
                    item.entries.Chance = 0;
                  } else {
                    item.entries = {};
                  }
                }
              });
              return;
            }
            e.entries = {};
          });

        return s;
      });

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
total.forEach((s) => {
  console.log(s.refkey);
});

function idIsArrayIndex(id: string): boolean {
  return id && Struct.isNumber(Struct.extractKeyFromBrackets(id));
}
