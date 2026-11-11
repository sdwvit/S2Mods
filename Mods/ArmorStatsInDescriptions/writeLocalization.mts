/**
 * Overrides every vanilla armor and helmet description (`sid_items_<SID>_description`) with the
 * game's own text plus the item's base protection values, one line per type, labelled with the
 * inventory tooltip's own wording. Stats come from the cfgs at build time, text from
 * `vanillaText.json` (see `extractVanillaText.mts`), so nothing here is translated by hand.
 *
 * Called from the mod's `meta.onFinish`, so the asset is rewritten by `prepare-configs`.
 */
import {
  localized,
  textFor,
  writeModLocalization,
  type Language,
  type TemplateByLanguage,
} from "../../src/localization/text.mts";
import type { LocalizedTextEntry } from "../../src/localization/uasset.mts";
import { PROTECTION_KEYS, readArmorStats, type ProtectionKey } from "./armorStats.mts";
import vanillaText from "./vanillaText.json" with { type: "json" };

const labels = vanillaText.labels as Record<string, TemplateByLanguage>;
const descriptions = vanillaText.descriptions as Record<string, TemplateByLanguage>;

/** Up to two decimals, always with a decimal point, in every language. */
const formatNumber = (value: number) => String(Math.round(value * 100) / 100);

/** The stat block: one `<tooltip label>: <value>` line per protection type, in `language`. */
export const protectionText = (protection: Record<ProtectionKey, number>, language: Language) =>
  PROTECTION_KEYS.map(
    (key) => `${textFor(labels[key], language)}: ${formatNumber(protection[key] ?? 0)}`,
  ).join("\n");

/**
 * Appends the stat block to every language of a `LanguagesToLocalizedStrings` map. Other mods that
 * write their own armor text (HeadlessArmors) use this so their items read the same as vanilla's.
 */
export const withProtectionStats = (
  strings: Record<string, string>,
  protection: Record<ProtectionKey, number>,
) =>
  Object.fromEntries(
    Object.entries(strings).map(([key, text]) => {
      const language = key.replace("ELocalizationLanguage::", "") as Language;
      return [key, `${text}\n\n${protectionText(protection, language)}`];
    }),
  );

export function writeArmorStatsLocalization() {
  const seen = new Set<string>();
  const entries: LocalizedTextEntry[] = [];
  for (const armor of readArmorStats()) {
    const SID = `sid_items_${armor.textSID}_description`;
    const vanilla = descriptions[SID];
    if (!vanilla || seen.has(SID)) continue;
    seen.add(SID);
    entries.push({
      SID,
      LanguagesToLocalizedStrings: withProtectionStats(localized(vanilla), armor.protection),
    });
  }
  writeModLocalization(import.meta.url, entries);
}
