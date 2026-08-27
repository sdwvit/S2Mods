import fs from "node:fs";
import path from "node:path";
import { isCfgFile } from "./mod-kinds.mts";

export function recursiveCfgFind(folder: string, cb: (f: string, folder: string, shortFile: string) => void) {
  fs.readdirSync(folder).forEach((shortFile) => {
    const file = path.join(folder, shortFile);
    if (fs.statSync(file).isDirectory()) {
      return recursiveCfgFind(file, cb);
    }
    // isCfgFile, not endsWith(".cfg"): the extension-less `CoreVariables.cfg_patch_<Mod>` form is
    // a real cfg patch the engine reads, and matching only the trailing extension silently left it
    // out of the SDK push - so repack packed a mod without it (or found nothing to pack at all).
    if (isCfgFile(file)) {
      cb(file, folder, shortFile);
    }
  });
}
