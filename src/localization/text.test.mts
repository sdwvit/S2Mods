import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseUasset } from "./uasset.mts";
import { writeModLocalization } from "./text.mts";

/** A mod folder as `writeModLocalization` expects to find one: `raw/Stalker2/Content` under it. */
const scratchMod = (name: string) => {
  const modDir = path.join(mkdtempSync(path.join(tmpdir(), "s2-mod-")), name);
  mkdirSync(path.join(modDir, "raw/Stalker2/Content"), { recursive: true });
  // The module URL is what the function resolves the mod from, not the cwd.
  return { modDir, moduleUrl: pathToFileURL(path.join(modDir, "writeLocalization.mts")).href };
};

const entries = [
  { SID: "sid_items_Thing_name", LanguagesToLocalizedStrings: { English: "Thing" } },
];

describe("writeModLocalization", () => {
  it("creates a mod's first localization asset without the Mod Editor", () => {
    const { modDir, moduleUrl } = scratchMod("BrandNewMod");
    writeModLocalization(moduleUrl, entries);

    const asset = path.join(modDir, "raw/Stalker2/Content/BrandNewMod-localization.uasset");
    const parsed = parseUasset(asset);
    // The package is named after where it lives, so the cooker addresses it under this mod.
    expect(parsed.summary.packageName).toBe("/BrandNewMod/BrandNewMod-localization");
    expect(parsed.exports[0].properties).toEqual({ LocalizedTexts: entries });
    expect(readFileSync(asset).includes("FactionPatches")).toBe(false);
  });

  it("honours the asset name a mod shipping several assets asks for", () => {
    const { modDir, moduleUrl } = scratchMod("MultiAssetMod");
    writeModLocalization(moduleUrl, entries, "MultiAssetMod-Localization3");

    const asset = path.join(modDir, "raw/Stalker2/Content/MultiAssetMod-Localization3.uasset");
    expect(parseUasset(asset).summary.packageName).toBe(
      "/MultiAssetMod/MultiAssetMod-Localization3",
    );
  });

  it("rewrites an asset it already created without renaming it again", () => {
    const { modDir, moduleUrl } = scratchMod("SecondRunMod");
    writeModLocalization(moduleUrl, entries);
    const asset = path.join(modDir, "raw/Stalker2/Content/SecondRunMod-localization.uasset");
    const first = readFileSync(asset);

    writeModLocalization(moduleUrl, entries);

    // Same entries, same bytes: the committed artifact does not churn on every prepare run.
    expect(readFileSync(asset)).toEqual(first);
  });

  it("does not write into a mod with no SDK folder", () => {
    const { modDir, moduleUrl } = scratchMod("NoSdkMod");
    writeModLocalization(moduleUrl, entries);

    expect(existsSync(path.join(modDir, "sdk"))).toBe(false);
  });
});
