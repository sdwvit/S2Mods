/**
 * Scaffolds a new mod in one step: Mods/<Mod>/{package.json, meta.mts, transformer stubs, icon}.
 *
 *   npm run create-mod -- <ModName> [--files <cfg>[,<cfg>...]]... [--description "<text>"] [--prepare]
 *
 * --files      one transformer per flag (`transform<File>.mts`), `.files` set to the given paths
 *              (relative to GameData/, substrings allowed). Each path is checked against GameLite.
 * --prepare    run prepare-configs with SKIP_SDK_PUSH=1 afterwards: raw/ and readme.md only,
 *              nothing is written to the SDK.
 *
 * Does not create a git branch or a .uplugin (push-to-sdk creates the SDK mod on its first run).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { projectRoot } from "./ensure-env.mts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    files: { type: "string", multiple: true, default: [] },
    description: { type: "string", default: "" },
    prepare: { type: "boolean", default: false },
  },
});

const modName = positionals[0];
if (!modName || !/^[A-Z][A-Za-z0-9]*$/.test(modName)) {
  console.error('Usage: npm run create-mod -- <ModName> [--files "<cfg>,<cfg>"]... [--description "..."] [--prepare]');
  console.error("ModName: PascalCase, letters and digits only.");
  process.exit(1);
}

const modsFolder = path.join(projectRoot, "Mods");
const modFolder = path.join(modsFolder, modName);
if (fs.existsSync(modFolder)) {
  console.error(`Mods/${modName} already exists.`);
  process.exit(1);
}

const DONATE =
  "[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.";

const transformers = values.files.map((group) => {
  const files = group
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  const base = path.basename(files[0], ".cfg").replace(/[^A-Za-z0-9]/g, "");
  const name = `transform${base.charAt(0).toUpperCase()}${base.slice(1)}`;
  return { name, files };
});

const names = transformers.map((t) => t.name);
const duplicate = names.find((n, i) => names.indexOf(n) !== i);
if (duplicate) {
  console.error(`Two --files groups map to ${duplicate}: combine them into one --files flag (one transformer per cfg).`);
  process.exit(1);
}

warnUnmatchedFiles(transformers.flatMap((t) => t.files));

fs.mkdirSync(modFolder, { recursive: true });

const scripts = ["prepare-configs", "update-readme", "cook-inject"].map((s) => [s, `./src/${s}.mts`]);
scripts.push(
  ...["publish-steam", "publish-modio", "publish-nexus", "zip-for-xbox"].map((s) => [s, `./src/publish/${s}.mts`]),
);
writeFile("package.json", JSON.stringify({
  name: `@s2mods/${modName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`,
  private: true,
  scripts: Object.fromEntries(scripts.map(([s, script]) => [s, `S2_MOD=${modName} node ../.${script}`])),
}, null, 2) + "\n");

for (const { name, files } of transformers) {
  writeFile(
    `${name}.mts`,
    `import type { Struct } from "s2cfgtojson";

export function ${name}(struct: Struct) {
  // Return struct.fork() with the changed fields, or null to skip this struct.
  return null;
}

${name}.files = ${JSON.stringify(files)};
`,
  );
}

writeFile(
  "meta.mts",
  `import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
${transformers.map(({ name }) => `import { ${name} } from "./${name}.mts";\n`).join("")}
export const meta: MetaType<Struct> = {
  description: \`
${values.description || modName}[h1][/h1]
[hr][/hr]
[list]
[*] TODO
[/list]
${DONATE}
\`,
  changenote: "Initial release.",
  structTransformers: [${names.join(", ")}] as MetaType<Struct>["structTransformers"],
};
`,
);

copyIcon();
spawnSync(path.join(projectRoot, "node_modules", ".bin", "prettier"), ["--write", "--log-level=warn", "*.mts"], {
  cwd: modFolder,
  stdio: "inherit",
});

console.log(`Created Mods/${modName}: ${fs.readdirSync(modFolder).join(", ")}`);

if (values.prepare) {
  const result = spawnSync(process.execPath, [path.join(projectRoot, "src", "prepare-configs.mts")], {
    cwd: modFolder,
    stdio: "inherit",
    env: { ...process.env, S2_MOD: modName, SKIP_SDK_PUSH: "1" },
  });
  process.exit(result.status ?? 1);
}

function writeFile(file: string, content: string) {
  fs.writeFileSync(path.join(modFolder, file), content);
}

/** Icon128.png is git-ignored, so take any existing mod's copy. */
function copyIcon() {
  const source = fs
    .readdirSync(modsFolder)
    .map((mod) => path.join(modsFolder, mod, "raw", "Stalker2", "Resources", "Icon128.png"))
    .find((icon) => fs.existsSync(icon));
  if (!source) return console.warn("No Icon128.png found in other mods; add raw/Stalker2/Resources/Icon128.png by hand.");
  const target = path.join(modFolder, "raw", "Stalker2", "Resources", "Icon128.png");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

/** A typo in `.files` otherwise only shows up as "0 structs written" after a full prepare. */
function warnUnmatchedFiles(files: string[]) {
  if (!files.length || !process.env.SDK_PATH) return;
  const gameData = path.join(process.env.SDK_PATH, "Stalker2", "Content", "GameLite", "GameData");
  if (!fs.existsSync(gameData)) return console.warn(`Skipping --files check: ${gameData} not found.`);
  const cfgs = (fs.readdirSync(gameData, { recursive: true }) as string[])
    .filter((f) => f.endsWith(".cfg"))
    .map((f) => `/${f.split(path.sep).join("/")}`);
  for (const file of files) {
    const needle = file.replace(/^\/?GameData\//, "/");
    if (!cfgs.some((cfg) => cfg.includes(needle))) console.warn(`Warning: no GameLite cfg matches "${file}".`);
  }
}
