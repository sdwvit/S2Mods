/**
 * Regenerates `vanillaText.json` from the repo's `locale/` dump (git-ignored, see the
 * eng-localization skill): every armor's and firearm's vanilla description and the inventory
 * tooltip's protection and weapon stat labels, in all eighteen languages. The build reads only the committed JSON, so a checkout without
 * `locale/` still builds. Rerun after a game patch changes the shipped wording:
 *
 *   node Mods/ArmorStatsInDescriptions/extractVanillaText.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LANGUAGES, type Language } from "../../src/localization/text.mts";
import { PROTECTION_KEYS, readArmorStats } from "./armorStats.mts";
import { readWeaponStats } from "./weaponStats.mts";

const CULTURES: Record<Language, string> = {
  English: "en",
  Ukrainian: "uk",
  German: "de",
  French: "fr",
  SpanishEuropean: "es",
  Italian: "it",
  Polish: "pl",
  Czech: "cs",
  Turkish: "tr",
  Serbian: "sr",
  PortugalBrazilian: "pt-BR",
  SpanishLatinoAmerican: "es-419",
  Arabic: "ar",
  ChineseSimplified: "zh-Hans",
  ChineseTraditional: "zh-Hant",
  Japanese: "ja",
  Korean: "ko",
  Russian: "ru",
};

const localeDir = path.join(import.meta.dirname, "../../locale");
const dumps = Object.fromEntries(
  LANGUAGES.map((language) => [
    language,
    JSON.parse(readFileSync(path.join(localeDir, `${CULTURES[language]}.json`), "utf8")) as Record<
      string,
      string
    >,
  ]),
) as Record<Language, Record<string, string>>;

const byLanguage = (sid: string) =>
  Object.fromEntries(LANGUAGES.filter((l) => dumps[l][sid]).map((l) => [l, dumps[l][sid]]));

const labels = Object.fromEntries([
  ...PROTECTION_KEYS.map((key) => [
    key,
    byLanguage(`sid_misc_item_tooltip_protection_damage_${key}`),
  ]),
  ...["damage", "penetration", "distance", "fire_rate", "durability"].map((key) => [
    key,
    byLanguage(`sid_misc_item_tooltip_${key}`),
  ]),
]);

const descriptions: Record<string, Record<string, string>> = {};
for (const { textSID } of [...readArmorStats(), ...readWeaponStats()]) {
  const sid = `sid_items_${textSID}_description`;
  if (dumps.English[sid]) descriptions[sid] = byLanguage(sid);
}

writeFileSync(
  path.join(import.meta.dirname, "vanillaText.json"),
  JSON.stringify({ labels, descriptions }, null, 2) + "\n",
);
console.log(`vanillaText.json: ${Object.keys(descriptions).length} descriptions`);
