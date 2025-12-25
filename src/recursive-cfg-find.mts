import fs from "node:fs";
import path from "node:path";

export function recursiveCfgFind(folder: string, cb: (f: string, folder: string, shortFile: string) => void) {
  fs.readdirSync(folder).forEach((shortFile) => {
    const file = path.join(folder, shortFile);
    if (fs.statSync(file).isDirectory()) {
      return recursiveCfgFind(file, cb);
    }
    if (file.endsWith(".cfg")) {
      cb(file, folder, shortFile);
    }
  });
}
