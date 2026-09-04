/**
 * Shared machinery for authoring a mod's localized text: the language list the SDK's text assets
 * are keyed by, per-language templates with `{placeholder}` substitution, and the write step that
 * puts the result in `raw/Stalker2/Content/<ModName>-Localization<N>.uasset`.
 *
 * The bytes are written by `uasset.mts`; everything here is about the text itself, so
 * a mod's own `writeLocalization.mts` only has to hold its strings.
 */
import { copyFileSync, existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseUasset,
  renameLocalizationPackage,
  writeLocalizationDatabase,
  writeLocalizedTexts,
  type LocalizedTextEntry,
} from "./uasset.mts";
import { logger } from "../logger.mts";

/**
 * An empty `LocalizationModTextToolAsset` package, exactly as the Mod Editor's Text Tool creates
 * one. It is FactionPatches' asset by birth; `renameLocalizationPackage` mints every other mod's
 * from it, so this is the only reason the Text Tool ever had to be opened.
 */
const EMPTY_TEMPLATE = path.join(import.meta.dirname, "fixtures/empty-localization.uasset");

/**
 * An empty `ModLocalizationDatabaseDataAsset` package, as the Mod Editor autogenerates one at cook
 * time. DecoupledRanks' asset by birth, emptied; `renameLocalizationPackage` mints every mod's
 * from it, exactly as with the text asset above.
 */
const EMPTY_DATABASE_TEMPLATE = path.join(
  import.meta.dirname,
  "fixtures/empty-localization-database.uasset",
);

/** `ELocalizationLanguage` members, as they appear in a text asset's name table. */
export const LANGUAGES = [
  "English",
  "Ukrainian",
  "German",
  "French",
  "SpanishEuropean",
  "Italian",
  "Polish",
  "Czech",
  "Turkish",
  "Serbian",
  "PortugalBrazilian",
  "SpanishLatinoAmerican",
  "Arabic",
  "ChineseSimplified",
  "ChineseTraditional",
  "Japanese",
  "Korean",
  "Russian",
] as const;

export type Language = (typeof LANGUAGES)[number];

/** Per-language text; `English` is the fallback for anything left out. */
export type TemplateByLanguage = { English: string } & Partial<Record<Language, string>>;

/**
 * Languages deliberately served another language's text. Russian-speaking players get the
 * Ukrainian strings - the enum member still exists in the asset, so the key has to be written.
 */
export const TEXT_ALIASES: Partial<Record<Language, Language>> = { Russian: "Ukrainian" };

/** Resolves a language to the text it should actually show, following `TEXT_ALIASES`. */
export const textFor = (template: TemplateByLanguage, language: Language) =>
  template[TEXT_ALIASES[language] ?? language] ?? template.English;

/** Values a `{placeholder}` can take: one string for every language, or per-language text. */
export type TemplateVars = Record<string, string | TemplateByLanguage>;

/**
 * One `LanguagesToLocalizedStrings` map: every language the enum offers, with `{placeholder}`s
 * filled from `vars` in that same language.
 */
export const localized = (template: TemplateByLanguage, vars: TemplateVars = {}) =>
  Object.fromEntries(
    LANGUAGES.map((language) => {
      const text = Object.entries(vars).reduce(
        (acc, [key, value]) =>
          acc.replaceAll(`{${key}}`, typeof value === "string" ? value : textFor(value, language)),
        textFor(template, language),
      );
      return [`ELocalizationLanguage::${language}`, text];
    }),
  );

/**
 * The name/description pair for an item. The game derives both SIDs from the prototype's own `SID`
 * (or its `LocalizationSID`, when it sets one), so these are the only two keys an item needs.
 */
export const itemLocalization = (
  sid: string,
  text: { name: TemplateByLanguage; description: TemplateByLanguage },
  vars: TemplateVars = {},
): LocalizedTextEntry[] => [
  { SID: `sid_items_${sid}_name`, LanguagesToLocalizedStrings: localized(text.name, vars) },
  {
    SID: `sid_items_${sid}_description`,
    LanguagesToLocalizedStrings: localized(text.description, vars),
  },
];

/**
 * Generates `<mod>/raw/Stalker2/Content/<ModName>-Localization<N>.uasset` from `entries`.
 *
 * The mod's `writeLocalization.mts` is the only place this text is authored: the `.uasset` is
 * build output that happens to be committed (it is what gets packed, and a checkout has to be
 * able to build without the SDK). So the existing asset is never read for its *content* - only an
 * existing package is used as the template it is written from, and `writeLocalizedTexts` rebuilds
 * the name table from `entries` alone, making the bytes a function of the entries and the
 * package's identity and nothing else.
 *
 * That template is the SDK's copy when the mod's `sdk` symlink is live, because the SDK's copy is
 * the one the Mod Editor created and registered, and the result is copied back over it: the asset
 * has to be in the SDK mod for the cook to pick it up, and `pull-assets` copies the SDK folder
 * over `raw/` at the start of every cook, so a raw-only copy would be clobbered. With no SDK
 * checked out, the committed `raw/` copy is the template and stays where it is.
 *
 * `moduleUrl` is the calling module's `import.meta.url`, so the asset is found relative to the mod
 * rather than through the environment. `fileName` overrides the asset name for mods that ship more
 * than one localization asset (the `.uasset` extension is added if missing).
 */
export function writeModLocalization(
  moduleUrl: string,
  entries: LocalizedTextEntry[],
  fileName?: string,
) {
  const modDir = path.dirname(fileURLToPath(moduleUrl));
  const modName = path.basename(modDir);
  const sdkLink = path.join(modDir, "sdk");
  const assetName = fileName
    ? fileName.endsWith(".uasset")
      ? fileName
      : `${fileName}.uasset`
    : `${modName}-localization.uasset`;
  const asset = path.join(modDir, "raw/Stalker2/Content", assetName);
  const sdkAsset = path.join(modDir, "sdk", "Content", assetName);
  // The SDK mod's own name, which the package path has to spell: the `sdk` symlink points at it,
  // so it survives a `sdkModNameOverride` in the mod's meta. Without the symlink the repo folder
  // name is what `sdkModName` falls back to anyway.
  const sdkModName = existsSync(sdkLink) ? path.basename(realpathSync(sdkLink)) : modName;
  // Where the asset lives *is* its name: `/<SdkModName>/<AssetName>`, the path the cooker
  // addresses the package by. Deriving it rather than trusting the template's own is what lets the
  // fixture - FactionPatches' package by birth - stand in for a mod that has no asset yet, and it
  // repairs a copy someone made from another mod's asset by renaming the file.
  const packageName = `/${sdkModName}/${path.basename(assetName, ".uasset")}`;
  const template = existsSync(sdkAsset) ? sdkAsset : existsSync(asset) ? asset : EMPTY_TEMPLATE;
  if (parseUasset(template).summary.packageName === packageName) {
    writeLocalizedTexts(template, entries, asset);
  } else {
    logger.info(`${modName}: naming ${path.relative(modDir, template)} as ${packageName}`);
    renameLocalizationPackage(template, packageName, asset);
    writeLocalizedTexts(asset, entries, asset);
  }
  const size = statSync(asset).size;
  // The asset has to be in the SDK mod for the cook to pick it up, and pull-assets copies the SDK
  // folder over raw/ at the start of every cook, so a raw-only copy would be clobbered by the
  // stub. Both copies identical also makes that pull a no-op for this file.
  if (existsSync(path.dirname(sdkAsset))) copyFileSync(asset, sdkAsset);

  logger.info(`${modName}: wrote ${entries.length} localization entries (${size} bytes)`);
  writeModLocalizationDatabase(moduleUrl);
  return entries;
}

/**
 * The order the Mod Editor's gather emits a language map in: Ukrainian first, then every other
 * language in the order the source text asset holds it. Observed in both database assets the
 * editor has written here, and applied only so a generated database is byte-identical to the
 * editor's - nothing reads a `TMap` positionally, so the order does not change what the game shows.
 */
const databaseOrder = (map: Record<string, string>) => {
  const ukrainian = "ELocalizationLanguage::Ukrainian";
  const keys = Object.keys(map);
  return Object.fromEntries(
    (keys.includes(ukrainian) ? [ukrainian, ...keys.filter((k) => k !== ukrainian)] : keys).map(
      (k) => [k, map[k]],
    ),
  );
};

/** Every `LocalizationModTextToolAsset` in the mod's `raw/Stalker2/Content`, in load order. */
const modTextAssets = (contentDir: string) =>
  existsSync(contentDir)
    ? readdirSync(contentDir)
        .filter((f) => f.endsWith(".uasset") && !f.includes("LocalizationDatabase"))
        .sort()
        .map((f) => path.join(contentDir, f))
        .filter((f) =>
          parseUasset(f).exports.some((e) => e.className === "LocalizationModTextToolAsset"),
        )
    : [];

/**
 * Generates the mod's `Autogenerated_<n>_LocalizationDatabase.uasset` - the package the Mod Editor
 * emits at cook time, and the one the *game* reads. Generating it is what lets a mod that ships new
 * text be packed without a cook: the text asset alone is only the source the editor gathers from.
 *
 * The entries are gathered off disk from every text asset in the mod's `Content`, which is what the
 * editor does too (`LogModAssetCache: Loading and caching N ModTextToolAsset assets at '/<Mod>'`),
 * so the database cannot drift from the text it is built from and a mod shipping several text
 * assets needs no special handling. `writeModLocalization` calls this after every write.
 *
 * The `<n>` in the name is a Unix timestamp when the editor picks it; here it is derived from the
 * package name so re-running produces the same bytes, and an existing asset's number is kept so a
 * committed database is rewritten in place rather than orphaned.
 */
export function writeModLocalizationDatabase(moduleUrl: string) {
  const modDir = path.dirname(fileURLToPath(moduleUrl));
  const modName = path.basename(modDir);
  const contentDir = path.join(modDir, "raw/Stalker2/Content");
  const sources = modTextAssets(contentDir);
  if (!sources.length) return [];
  const entries: LocalizedTextEntry[] = sources.flatMap((file) =>
    parseUasset(file)
      .exports.filter((e) => e.className === "LocalizationModTextToolAsset")
      .flatMap((e) => (e.properties?.LocalizedTexts ?? []) as LocalizedTextEntry[])
      .map(({ SID, LanguagesToLocalizedStrings }) => ({
        SID,
        LanguagesToLocalizedStrings: databaseOrder(LanguagesToLocalizedStrings),
      })),
  );

  const sdkLink = path.join(modDir, "sdk");
  const sdkModName = existsSync(sdkLink) ? path.basename(realpathSync(sdkLink)) : modName;
  const existing = [contentDir, path.join(modDir, "sdk", "Content")]
    .filter(existsSync)
    .flatMap((dir) => readdirSync(dir))
    .find((f) => /^Autogenerated_\d+_LocalizationDatabase\.uasset$/.test(f));
  const assetName =
    existing ??
    `Autogenerated_${createHash("md5").update(sdkModName).digest().readUInt32BE(0)}_LocalizationDatabase.uasset`;
  const asset = path.join(contentDir, assetName);
  const sdkAsset = path.join(modDir, "sdk", "Content", assetName);
  const packageName = `/${sdkModName}/${path.basename(assetName, ".uasset")}`;

  const template = existsSync(asset)
    ? asset
    : existsSync(sdkAsset)
      ? sdkAsset
      : EMPTY_DATABASE_TEMPLATE;
  if (parseUasset(template).summary.packageName === packageName) {
    writeLocalizationDatabase(template, entries, asset);
  } else {
    logger.info(`${modName}: naming ${path.basename(template)} as ${packageName}`);
    renameLocalizationPackage(template, packageName, asset);
    writeLocalizationDatabase(asset, entries, asset);
  }
  if (existsSync(path.dirname(sdkAsset))) copyFileSync(asset, sdkAsset);

  logger.info(
    `${modName}: wrote ${assetName} with ${entries.length} entries from` +
      ` ${sources.map((f) => path.basename(f)).join(", ")} (${statSync(asset).size} bytes)`,
  );
  return entries;
}
