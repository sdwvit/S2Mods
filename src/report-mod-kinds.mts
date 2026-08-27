import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { modsFolder, allValidMods } from "./mod-context.mts";
import { classifyRawContent, sdkModNameForKind, type ModContentKind } from "./mod-kinds.mts";
import { logger } from "./logger.mts";

/**
 * Dry report: what every mod in Mods/ classifies as, and which SDK mod(s) it is therefore built
 * as. Reads nothing but the repo - no SDK, no cook, no game - so the effect of the cfg/asset
 * split can be inspected before anything is run.
 *
 *   node src/report-mod-kinds.mts            # table
 *   node src/report-mod-kinds.mts --json     # machine-readable
 *   node src/report-mod-kinds.mts --split    # only the mods that need two SDK mods
 */

/**
 * sdkModNameOverride, scraped rather than imported: importing 85 meta.mts files pulls in
 * s2cfgtojson and every transformer's module-level work, and this report must stay side-effect
 * free. The field is always a plain string literal.
 */
function sdkModNameOverrideOf(mod: string): string | null {
  const metaPath = path.join(modsFolder, mod, "meta.mts");
  if (!existsSync(metaPath)) return null;
  return (
    /sdkModNameOverride\s*:\s*["'`]([^"'`]+)["'`]/.exec(readFileSync(metaPath, "utf8"))?.[1] ?? null
  );
}

type Row = {
  mod: string;
  kind: string;
  assets: number;
  cfgs: number;
  other: number;
  sdkMods: { kind: ModContentKind; name: string }[];
};

const rows: Row[] = allValidMods.sort().map((mod) => {
  const classification = classifyRawContent(path.join(modsFolder, mod, "raw"));
  const base = sdkModNameOverrideOf(mod) ?? mod;
  const kinds = classification.kinds.length
    ? classification.kinds
    : (["assets"] as ModContentKind[]);
  return {
    mod,
    kind: classification.kind,
    assets: classification.assetFiles.length,
    cfgs: classification.cfgFiles.length,
    other: classification.otherFiles.length,
    sdkMods: kinds.map((kind) => ({
      kind,
      name: sdkModNameForKind(base, kind, classification.isSplit),
    })),
  };
});

const selected = process.argv.includes("--split")
  ? rows.filter(({ kind }) => kind === "both")
  : rows;

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(selected, null, 2));
} else {
  const columns: [string, (row: Row) => string][] = [
    ["MOD", ({ mod }) => mod],
    ["KIND", ({ kind }) => kind],
    ["ASSETS", ({ assets }) => String(assets)],
    ["CFGS", ({ cfgs }) => String(cfgs)],
    ["OTHER", ({ other }) => String(other)],
    [
      "SDK MOD(S)",
      ({ sdkMods }) => sdkMods.map(({ kind, name }) => `${name} [${kind}]`).join(" + "),
    ],
  ];
  const widths = columns.map(([header, get]) =>
    Math.max(header.length, ...selected.map((row) => get(row).length)),
  );
  const line = (cells: string[]) => cells.map((cell, i) => cell.padEnd(widths[i])).join("  ");
  logger.log(line(columns.map(([header]) => header)));
  for (const row of selected) logger.log(line(columns.map(([, get]) => get(row))));

  const counts = rows.reduce<Record<string, number>>(
    (acc, { kind }) => ({ ...acc, [kind]: (acc[kind] ?? 0) + 1 }),
    {},
  );
  logger.log(
    `\n${rows.length} mods: ` +
      Object.entries(counts)
        .map(([kind, count]) => `${count} ${kind}`)
        .join(", "),
  );

  // Several repo mods deliberately share one SDK mod via sdkModNameOverride (the three
  // ShaysDistantHorizons* variants are all Release_Render). Their cfg halves share the suffixed
  // name in exactly the same way, so this is informational - but it is worth seeing.
  const owners = new Map<string, string[]>();
  for (const { mod, sdkMods } of rows) {
    for (const { name } of sdkMods) owners.set(name, [...(owners.get(name) ?? []), mod]);
  }
  for (const [name, mods] of owners) {
    if (mods.length > 1) logger.log(`shared SDK mod ${name}: ${mods.join(", ")}`);
  }
}
