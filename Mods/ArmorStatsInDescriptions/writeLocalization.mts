/**
 * Overrides every vanilla armor, helmet and firearm description (`sid_items_<SID>_description`)
 * with the game's own text plus the item's base stats, one line per stat, labelled with the
 * inventory tooltip's own wording: protection and durability for armor; damage, damage per
 * second, rate of fire, penetration, range and durability for weapons. Stats come from the cfgs at
 * build time, text from `vanillaText.json` (see `extractVanillaText.mts`); only the damage per
 * second label and the per-minute unit are translated here.
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
import { readWeaponStats, type WeaponStats } from "./weaponStats.mts";
import vanillaText from "./vanillaText.json" with { type: "json" };

const labels = vanillaText.labels as Record<string, TemplateByLanguage>;
const descriptions = vanillaText.descriptions as Record<string, TemplateByLanguage>;

/** One decimal, always with a decimal point, in every language. */
const formatNumber = (value: number) => String(Math.round(value * 10) / 10);

/**
 * Protections, penetration and range are shown on a 0-5 scale, the five segments of the inventory
 * tooltip's bars:
 * - anomaly protections: the tooltip bar is full at 100;
 * - physical protection and penetration: both on the game's 0-4 armor-piercing scale, so they
 *   share one divisor and a weapon can still be read against a suit;
 * - range: the cfg's own 0-1 bar fill (`RangeUI`).
 * Damage, damage per second, rate of fire and durability are absolute numbers.
 */
const SCALE = 5;
const PIERCING_MAX = 4;
const ANOMALY_PROTECTION_MAX = 100;

const scaled = (value: number, max: number) => formatNumber(Math.min(SCALE, (value / max) * SCALE));
const protectionScaled = (key: ProtectionKey, value: number) =>
  scaled(value, key === "Strike" ? PIERCING_MAX : ANOMALY_PROTECTION_MAX);

const line = (labelKey: string, language: Language, value: string) =>
  `${textFor(labels[labelKey], language)}: ${value}`;

/** The game has no "damage per second" string, so this one label is translated here. */
const DPS_LABEL: TemplateByLanguage = {
  English: "Damage per second",
  Ukrainian: "Шкода за секунду",
  German: "Schaden pro Sekunde",
  French: "Dégâts par seconde",
  SpanishEuropean: "Daño por segundo",
  Italian: "Danni al secondo",
  Polish: "Obrażenia na sekundę",
  Czech: "Poškození za sekundu",
  Turkish: "Saniye başına hasar",
  Serbian: "Штета у секунди",
  PortugalBrazilian: "Dano por segundo",
  SpanishLatinoAmerican: "Daño por segundo",
  Arabic: "الضرر في الثانية",
  ChineseSimplified: "每秒伤害",
  ChineseTraditional: "每秒傷害",
  Japanese: "毎秒ダメージ",
  Korean: "초당 피해량",
  Russian: "Урон в секунду",
};

/** Shots-per-minute unit, appended to the rate of fire. */
const PER_MINUTE: TemplateByLanguage = {
  English: "/min",
  Ukrainian: "/хв",
  German: "/min",
  French: "/min",
  SpanishEuropean: "/min",
  Italian: "/min",
  Polish: "/min",
  Czech: "/min",
  Turkish: "/dk",
  Serbian: "/мин",
  PortugalBrazilian: "/min",
  SpanishLatinoAmerican: "/min",
  Arabic: "/دقيقة",
  ChineseSimplified: "发/分钟",
  ChineseTraditional: "發/分鐘",
  Japanese: "発/分",
  Korean: "발/분",
  Russian: "/мин",
};

/** The armor stat block: protections, then durability when known, in `language`. */
export const protectionText = (
  protection: Record<ProtectionKey, number>,
  language: Language,
  durability?: number,
) =>
  [
    ...PROTECTION_KEYS.map((key) =>
      line(key, language, protectionScaled(key, protection[key] ?? 0)),
    ),
    ...(durability ? [line("durability", language, String(Math.round(durability)))] : []),
  ].join("\n");

const appendToEach = (strings: Record<string, string>, block: (language: Language) => string) =>
  Object.fromEntries(
    Object.entries(strings).map(([key, text]) => {
      const language = key.replace("ELocalizationLanguage::", "") as Language;
      return [key, `${text}\n\n${block(language)}`];
    }),
  );

/**
 * Appends the stat block to every language of a `LanguagesToLocalizedStrings` map. Other mods that
 * write their own armor text (HeadlessArmors) use this so their items read the same as vanilla's.
 */
export const withProtectionStats = (
  strings: Record<string, string>,
  protection: Record<ProtectionKey, number>,
  durability?: number,
) => appendToEach(strings, (language) => protectionText(protection, language, durability));

/** The weapon stat block, in `language`. Rate of fire and DPS only where the cfgs set them. */
const weaponText = (weapon: WeaponStats, language: Language) => {
  const spm = weapon.shotsPerMinute;
  return [
    line("damage", language, formatNumber(weapon.damage)),
    ...(spm
      ? [
          `${textFor(DPS_LABEL, language)}: ${Math.round((weapon.damage * spm) / 60)}`,
          line("fire_rate", language, `${Math.round(spm)}${textFor(PER_MINUTE, language)}`),
        ]
      : []),
    line("penetration", language, scaled(weapon.penetration, PIERCING_MAX)),
    line("distance", language, scaled(weapon.rangeUI, 1)),
    line("durability", language, String(Math.round(weapon.durability))),
  ].join("\n");
};

export function writeArmorStatsLocalization() {
  const seen = new Set<string>();
  const entries: LocalizedTextEntry[] = [];
  const add = (
    textSID: string,
    withStats: (strings: Record<string, string>) => Record<string, string>,
  ) => {
    const SID = `sid_items_${textSID}_description`;
    const vanilla = descriptions[SID];
    if (!vanilla || seen.has(SID)) return;
    seen.add(SID);
    entries.push({
      SID,
      LanguagesToLocalizedStrings: withStats(localized(vanilla)),
    });
  };
  for (const armor of readArmorStats()) {
    add(armor.textSID, (strings) =>
      withProtectionStats(strings, armor.protection, armor.durability),
    );
  }
  for (const weapon of readWeaponStats()) {
    add(weapon.textSID, (strings) =>
      appendToEach(strings, (language) => weaponText(weapon, language)),
    );
  }
  writeModLocalization(import.meta.url, entries);
}
