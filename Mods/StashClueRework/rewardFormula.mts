import { readFileSync } from "fs";
import path from "node:path";

function parseCsv<T>(csv: string): T[] {
  const lines = csv
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const result = [];
  const headers = lines[0].split("\t").map((header) => header.trim());
  for (let i = 1; i < lines.length; i++) {
    const obj: any = {};
    const currentline = lines[i].split("\t").map((value) => value.trim());
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = currentline[j];
    }
    result.push(obj);
  }
  return result;
}

export const QuestDataTable = parseCsv<{
  "#": string;
  Vendor: string;
  "Quest idea": string;
  "Containered Quest SID": string;
  "Dialog SID": string;
  "Variant Quest Node SID": string;
  "Reward Gen SID": string;
  "Base ~Reward": string;
  "Cost of travel": string;
  "Suggested Reward": string;
  TargetX: string;
  TargetY: string;
  TargetZ: string;
  VendorX: string;
  VendorY: string;
  VendorZ: string;
  "Price per unit travelled": string;
  Distance: string;
  "Danger / Chore Factor": string;
  Target: string;
  Bandit: string;
  BlindDog: string;
  Bloodsucker: string;
  Boar: string;
  Burer: string;
  Cat: string;
  Chimera: string;
  Controller: string;
  Deer: string;
  Duty: string;
  Flesh: string;
  Freedom: string;
  Mercenaries: string;
  Package: string;
  Poltergeist: string;
  PseudoDog: string;
  Pseudogiant: string;
  Rat: string;
  Snork: string;
  Stalker: string;
  Tushkan: string;
  Zombie: string;
}>(readFileSync(path.join(import.meta.dirname, "./QuestDataTable.tsv"), "utf-8"));
export const QuestDataTableByQuestSID = QuestDataTable.reduce(
  (acc, curr) => {
    acc[curr["Containered Quest SID"]] ||= [];
    acc[curr["Containered Quest SID"]].push(curr);
    return acc;
  },
  {} as Record<string, typeof QuestDataTable>,
);
export const QuestDataTableByDialogSID = QuestDataTable.reduce(
  (acc, curr) => {
    acc[curr["Dialog SID"]] ||= [];
    acc[curr["Dialog SID"]].push(curr);
    return acc;
  },
  {} as Record<string, typeof QuestDataTable>,
);
