import { modFolder, modName } from "./base-paths.mjs";
import path from "node:path";
import { MetaType } from "./meta-type.mts";
import { Struct } from "s2cfgtojson";
import { existsSync, writeFileSync } from "node:fs";
import { mkdirSync } from "fs";
const metaPath = path.join(modFolder, "meta.mts");
if (!existsSync(metaPath)) {
  mkdirSync(modFolder, { recursive: true });
  writeFileSync(
    metaPath,
    `
import { MetaType } from "../../src/metaType.mjs";

export const meta: MetaType<Struct> = {
  description: \`
Title
[hr][/hr]
Description 1[h1][/h1]
Description 2[h1][/h1]
[hr][/hr]
Footer
\`,
  changenote: "Initial release",
  structTransformers: [structTransformer],
};

function structTransformer(struct: Struct) {
  if (struct.SID !== "Hard") {
    return null;
  }
  return Object.assign(struct.fork(), {});
}
 
structTransformer.files = [ todo ];`,
  );
}
export const metaPromise = import(path.join(modFolder, "meta.mts")) as Promise<{ meta: MetaType<Struct> }>;
