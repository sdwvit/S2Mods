/**
 * Overrides every vanilla armor, helmet, firearm, ammo and detector description
 * (`sid_items_<SID>_description`) with the game's own text plus the item's base stats, one line
 * per stat: label on the left, value padded out to a common column. Labels the inventory tooltip
 * already has come from `vanillaText.json` (see `extractVanillaText.mts`); the rest are translated
 * here. Stats come from the cfgs at build time.
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
import { readAmmoStats, type AmmoStats } from "./ammoStats.mts";
import { readAttachStats, type AttachStats } from "./attachStats.mts";
import { readGrenadeResist, readGrenadeStats, type GrenadeStats } from "./grenadeStats.mts";
import { readDetectorStats, type DetectorStats } from "./detectorStats.mts";
import { readWeaponStats, type WeaponStats } from "./weaponStats.mts";
import glyphWidths from "./glyphWidths.json" with { type: "json" };
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
 * Damage, rate of fire and durability are absolute numbers.
 */
const SCALE = 5;
const PIERCING_MAX = 4;
const ANOMALY_PROTECTION_MAX = 100;

const scaled = (value: number, max: number) => formatNumber(Math.min(SCALE, (value / max) * SCALE));
const protectionScaled = (key: ProtectionKey, value: number) =>
  scaled(value, key === "Strike" ? PIERCING_MAX : ANOMALY_PROTECTION_MAX);

const label = (key: string, language: Language) => textFor(labels[key], language);

/** Space between the widest row's label and its value, in spaces. */
const COLUMN_GAP = 8;

const SPACE = glyphWidths.widths[" "];
/** CJK, kana and hangul are full width; anything else missing from the table is average. */
const glyphWidth = (char: string) =>
  (glyphWidths.widths as Record<string, number>)[char] ??
  (char.codePointAt(0)! >= 0x2e80 ? glyphWidths.wide : glyphWidths.default);
const textWidth = (text: string) => [...text].reduce((sum, char) => sum + glyphWidth(char), 0);

/**
 * Rows as `label   value`, the spaces sized by the tooltip font's letter widths
 * (`glyphWidths.json`) so every value ends at about the same point. Spaces come in whole steps,
 * so a value can still sit up to half a space off. Right-to-left text needs no mirroring: the
 * label comes first in reading order and so renders on the right.
 */
const padded = (rows: [string, string][]) => {
  const width = Math.max(...rows.map(([l, v]) => textWidth(l) + textWidth(v))) + COLUMN_GAP * SPACE;
  return rows
    .map(([l, v]) => {
      const spaces = Math.max(2, Math.round((width - textWidth(l) - textWidth(v)) / SPACE));
      return l + " ".repeat(spaces) + v;
    })
    .join("\n");
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

/** Starts each line under damage that gives it against one level of strike protection. */
const VS_PROTECTION: TemplateByLanguage = {
  English: "vs protection",
  Ukrainian: "проти захисту",
  German: "gegen Schutz",
  French: "contre protection",
  SpanishEuropean: "contra protección",
  Italian: "contro protezione",
  Polish: "przeciw ochronie",
  Czech: "proti ochraně",
  Turkish: "koruma",
  Serbian: "против заштите",
  PortugalBrazilian: "contra proteção",
  SpanishLatinoAmerican: "contra protección",
  Arabic: "ضد حماية",
  ChineseSimplified: "对防护",
  ChineseTraditional: "對防護",
  Japanese: "防護",
  Korean: "방호",
  Russian: "против защиты",
};

/** Labels the inventory tooltip has no string for. */
const TEXT = {
  damageVsArmor: {
    English: "Damage vs armor",
    Ukrainian: "Шкода проти броні",
    German: "Schaden gegen Panzerung",
    French: "Dégâts contre armure",
    SpanishEuropean: "Daño contra armadura",
    Italian: "Danni contro armatura",
    Polish: "Obrażenia przeciw pancerzowi",
    Czech: "Poškození proti brnění",
    Turkish: "Zırha karşı hasar",
    Serbian: "Штета против оклопа",
    PortugalBrazilian: "Dano contra armadura",
    SpanishLatinoAmerican: "Daño contra armadura",
    Arabic: "الضرر ضد الدروع",
    ChineseSimplified: "对护甲伤害",
    ChineseTraditional: "對護甲傷害",
    Japanese: "対装甲ダメージ",
    Korean: "방어구 상대 피해",
    Russian: "Урон по броне",
  },
  pellets: {
    English: "Pellets",
    Ukrainian: "Дробин",
    German: "Schrotkugeln",
    French: "Plombs",
    SpanishEuropean: "Perdigones",
    Italian: "Pallini",
    Polish: "Śruciny",
    Czech: "Broky",
    Turkish: "Saçma",
    Serbian: "Сачме",
    PortugalBrazilian: "Projéteis",
    SpanishLatinoAmerican: "Perdigones",
    Arabic: "الكريات",
    ChineseSimplified: "弹丸",
    ChineseTraditional: "彈丸",
    Japanese: "散弾数",
    Korean: "산탄 수",
    Russian: "Дробин",
  },
  weaponWear: {
    English: "Weapon wear",
    Ukrainian: "Знос зброї",
    German: "Waffenverschleiß",
    French: "Usure de l'arme",
    SpanishEuropean: "Desgaste del arma",
    Italian: "Usura dell'arma",
    Polish: "Zużycie broni",
    Czech: "Opotřebení zbraně",
    Turkish: "Silah aşınması",
    Serbian: "Хабање оружја",
    PortugalBrazilian: "Desgaste da arma",
    SpanishLatinoAmerican: "Desgaste del arma",
    Arabic: "تآكل السلاح",
    ChineseSimplified: "武器磨损",
    ChineseTraditional: "武器磨損",
    Japanese: "武器の摩耗",
    Korean: "무기 마모",
    Russian: "Износ оружия",
  },
  flatness: {
    English: "Flatness",
    Ukrainian: "Настильність",
    German: "Rasanz",
    French: "Tension de trajectoire",
    SpanishEuropean: "Rasante",
    Italian: "Radenza",
    Polish: "Płaskość toru",
    Czech: "Plochost dráhy",
    Turkish: "Yörünge düzlüğü",
    Serbian: "Положеност путање",
    PortugalBrazilian: "Trajetória rasante",
    SpanishLatinoAmerican: "Rasante",
    Arabic: "استواء المسار",
    ChineseSimplified: "弹道平直度",
    ChineseTraditional: "彈道平直度",
    Japanese: "弾道の低伸性",
    Korean: "탄도 직진성",
    Russian: "Настильность",
  },
  spread: {
    English: "Spread",
    Ukrainian: "Розкид",
    German: "Streuung",
    French: "Dispersion",
    SpanishEuropean: "Dispersión",
    Italian: "Dispersione",
    Polish: "Rozrzut",
    Czech: "Rozptyl",
    Turkish: "Dağılım",
    Serbian: "Расипање",
    PortugalBrazilian: "Dispersão",
    SpanishLatinoAmerican: "Dispersión",
    Arabic: "التشتت",
    ChineseSimplified: "散布",
    ChineseTraditional: "散布",
    Japanese: "拡散",
    Korean: "탄퍼짐",
    Russian: "Разброс",
  },
  detectionRange: {
    English: "Detection range",
    Ukrainian: "Дальність виявлення",
    German: "Erfassungsreichweite",
    French: "Portée de détection",
    SpanishEuropean: "Alcance de detección",
    Italian: "Raggio di rilevamento",
    Polish: "Zasięg wykrywania",
    Czech: "Dosah detekce",
    Turkish: "Algılama menzili",
    Serbian: "Домет детекције",
    PortugalBrazilian: "Alcance de detecção",
    SpanishLatinoAmerican: "Alcance de detección",
    Arabic: "مدى الكشف",
    ChineseSimplified: "探测范围",
    ChineseTraditional: "探測範圍",
    Japanese: "探知範囲",
    Korean: "탐지 범위",
    Russian: "Дальность обнаружения",
  },
  artifactReveal: {
    English: "Artifact reveal",
    Ukrainian: "Проявлення артефакту",
    German: "Artefakt sichtbar ab",
    French: "Révélation d'artefact",
    SpanishEuropean: "Revelado de artefacto",
    Italian: "Rivelazione artefatto",
    Polish: "Odsłonięcie artefaktu",
    Czech: "Zviditelnění artefaktu",
    Turkish: "Artefakt görünürlüğü",
    Serbian: "Откривање артефакта",
    PortugalBrazilian: "Revelação de artefato",
    SpanishLatinoAmerican: "Revelado de artefacto",
    Arabic: "إظهار القطعة الأثرية",
    ChineseSimplified: "神器显形",
    ChineseTraditional: "神器顯形",
    Japanese: "アーティファクト可視化",
    Korean: "아티팩트 드러남",
    Russian: "Проявление артефакта",
  },
  anomalyScan: {
    English: "Anomaly scan",
    Ukrainian: "Сканування аномалій",
    German: "Anomalie-Scan",
    French: "Scan d'anomalies",
    SpanishEuropean: "Escaneo de anomalías",
    Italian: "Scansione anomalie",
    Polish: "Skan anomalii",
    Czech: "Sken anomálií",
    Turkish: "Anomali taraması",
    Serbian: "Скенирање аномалија",
    PortugalBrazilian: "Varredura de anomalias",
    SpanishLatinoAmerican: "Escaneo de anomalías",
    Arabic: "مسح الشذوذات",
    ChineseSimplified: "异常扫描",
    ChineseTraditional: "異常掃描",
    Japanese: "アノマリースキャン",
    Korean: "이상 현상 스캔",
    Russian: "Сканирование аномалий",
  },
  damageToYou: {
    English: "Damage to you",
    Ukrainian: "Шкода вам",
    German: "Schaden an dir",
    French: "Dégâts sur vous",
    SpanishEuropean: "Daño a ti",
    Italian: "Danni a te",
    Polish: "Obrażenia dla ciebie",
    Czech: "Poškození vám",
    Turkish: "Sana verdiği hasar",
    Serbian: "Штета вама",
    PortugalBrazilian: "Dano a você",
    SpanishLatinoAmerican: "Daño a ti",
    Arabic: "الضرر عليك",
    ChineseSimplified: "对你的伤害",
    ChineseTraditional: "對你的傷害",
    Japanese: "自分へのダメージ",
    Korean: "자신에게 피해",
    Russian: "Урон по вам",
  },
  zoom: {
    English: "Zoom",
    Ukrainian: "Кратність",
    German: "Vergrößerung",
    French: "Grossissement",
    SpanishEuropean: "Aumento",
    Italian: "Ingrandimento",
    Polish: "Powiększenie",
    Czech: "Zvětšení",
    Turkish: "Büyütme",
    Serbian: "Увећање",
    PortugalBrazilian: "Ampliação",
    SpanishLatinoAmerican: "Aumento",
    Arabic: "التكبير",
    ChineseSimplified: "放大倍率",
    ChineseTraditional: "放大倍率",
    Japanese: "倍率",
    Korean: "배율",
    Russian: "Кратность",
  },
  loudness: {
    English: "Loudness",
    Ukrainian: "Гучність пострілу",
    German: "Schusslautstärke",
    French: "Bruit du tir",
    SpanishEuropean: "Ruido del disparo",
    Italian: "Rumore dello sparo",
    Polish: "Głośność strzału",
    Czech: "Hlasitost výstřelu",
    Turkish: "Atış sesi",
    Serbian: "Јачина пуцња",
    PortugalBrazilian: "Ruído do disparo",
    SpanishLatinoAmerican: "Ruido del disparo",
    Arabic: "صوت الطلقة",
    ChineseSimplified: "射击音量",
    ChineseTraditional: "射擊音量",
    Japanese: "発砲音",
    Korean: "사격 소음",
    Russian: "Громкость выстрела",
  },
  sway: {
    English: "Weapon sway",
    Ukrainian: "Хитання зброї",
    German: "Waffenschwanken",
    French: "Balancement de l'arme",
    SpanishEuropean: "Balanceo del arma",
    Italian: "Oscillazione dell'arma",
    Polish: "Kołysanie broni",
    Czech: "Kývání zbraně",
    Turkish: "Silah sallanması",
    Serbian: "Њихање оружја",
    PortugalBrazilian: "Balanço da arma",
    SpanishLatinoAmerican: "Balanceo del arma",
    Arabic: "تمايل السلاح",
    ChineseSimplified: "武器晃动",
    ChineseTraditional: "武器晃動",
    Japanese: "武器の揺れ",
    Korean: "무기 흔들림",
    Russian: "Покачивание оружия",
  },
  coupled: {
    English: "coupled",
    Ukrainian: "спарений",
    German: "gekoppelt",
    French: "jumelés",
    SpanishEuropean: "acoplados",
    Italian: "accoppiati",
    Polish: "sprzężone",
    Czech: "spojené",
    Turkish: "çift",
    Serbian: "спојени",
    PortugalBrazilian: "acoplados",
    SpanishLatinoAmerican: "acoplados",
    Arabic: "مزدوج",
    ChineseSimplified: "双联",
    ChineseTraditional: "雙聯",
    Japanese: "連結",
    Korean: "결합",
    Russian: "спаренный",
  },
  metres: {
    English: " m",
    Ukrainian: " м",
    German: " m",
    French: " m",
    SpanishEuropean: " m",
    Italian: " m",
    Polish: " m",
    Czech: " m",
    Turkish: " m",
    Serbian: " м",
    PortugalBrazilian: " m",
    SpanishLatinoAmerican: " m",
    Arabic: " م",
    ChineseSimplified: "米",
    ChineseTraditional: "米",
    Japanese: "m",
    Korean: "m",
    Russian: " м",
  },
} satisfies Record<string, TemplateByLanguage>;

/** The armor stat block: protections, then durability when known, in `language`. */
export const protectionText = (
  protection: Record<ProtectionKey, number>,
  language: Language,
  durability?: number,
) =>
  padded([
    ...PROTECTION_KEYS.map((key): [string, string] => [
      label(key, language),
      protectionScaled(key, protection[key] ?? 0),
    ]),
    ...(durability
      ? [[label("durability", language), String(Math.round(durability))] as [string, string]]
      : []),
  ]);

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

/** `ArmorDifferenceCoefProjectiles` of human NPCs: each point of strike protection above the
 * bullet's piercing halves its damage, each point below doubles it. */
const ARMOR_DIFFERENCE_COEF = 2;

/**
 * Rows for `value` against 1-4 points of strike protection: a body shot on a human, deflects
 * left out. The game skips the armor term for a round with no piercing at all.
 */
const tiers = (value: number, penetration: number, language: Language): [string, string][] =>
  [1, 2, 3, 4].map((strike) => [
    ` - ${textFor(VS_PROTECTION, language)} ${strike}`,
    formatNumber(penetration ? value * ARMOR_DIFFERENCE_COEF ** (penetration - strike) : value),
  ]);

/** The weapon stat block, in `language`. */
const weaponText = (weapon: WeaponStats, language: Language) =>
  padded([
    [label("damage", language), formatNumber(weapon.damage)],
    ...tiers(weapon.damage, weapon.penetration, language),
    [
      label("fire_rate", language),
      `${Math.round(weapon.shotsPerMinute)}${textFor(PER_MINUTE, language)}`,
    ],
    [label("penetration", language), scaled(weapon.penetration, PIERCING_MAX)],
    [label("distance", language), scaled(weapon.rangeUI, 1)],
    [label("durability", language), String(Math.round(weapon.durability))],
  ]);

/** Two decimals at most, trailing zeros dropped. */
const short = (value: number) => String(Math.round(value * 100) / 100);
const times = (value: number) => `×${short(value)}`;

/**
 * The ammo stat block, in `language`: how the round changes the gun that fires it. Every round
 * lists the same stats, standard ones as ×1, so boxes can be compared side by side; pellets come
 * last. The round's penetration change is shown only folded into
 * damage vs armor (each armor-scale point doubles or halves damage), which also multiplies the
 * gun's "vs protection" lines directly.
 */
const ammoText = (ammo: AmmoStats, language: Language) =>
  padded([
    [label("damage", language), times(ammo.damage)],
    [
      textFor(TEXT.damageVsArmor, language),
      times(ammo.damage * ARMOR_DIFFERENCE_COEF ** ammo.penetration),
    ],
    [textFor(TEXT.weaponWear, language), times(ammo.weaponWear)],
    [textFor(TEXT.flatness, language), times(ammo.flatness)],
    [textFor(TEXT.spread, language), times(ammo.spread)],
    [textFor(TEXT.pellets, language), String(ammo.pellets)],
  ]);

/** A signed percentage: "+15%", "−10%". */
const signedPercent = (sign: number, magnitude: number) =>
  `${sign < 0 ? "−" : "+"}${short(Math.abs(magnitude))}%`;

/**
 * The attachment stat block, in `language`: magazine size (and "coupled" for a taped pair), scope
 * zoom, then every effect. Effects the game labels as improvements ("Aiming speed", "Recoil
 * decrease", "Bullet velocity"...) are signed + when they help and − when they hurt, the way the
 * label reads; weapon wear, loudness and sway keep the cfg's own sign (+ is more of it).
 * Undefined when the attachment changes nothing the cfgs record.
 */
const attachText = (attach: AttachStats, language: Language) => {
  const rows: [string, string][] = [];
  if (attach.capacity) {
    const coupled = attach.twinMagazine ? ` (${textFor(TEXT.coupled, language)})` : "";
    rows.push([label("magazine", language), `${attach.capacity}${coupled}`]);
  }
  if (attach.zoom) rows.push([textFor(TEXT.zoom, language), `${attach.zoom}x`]);
  for (const effect of attach.effects) {
    if (effect.label === "loudness" || effect.label === "sway") {
      const text = effect.label === "loudness" ? TEXT.loudness : TEXT.sway;
      rows.push([textFor(text, language), signedPercent(effect.percent, effect.percent)]);
    } else if (effect.label === "weapon_wearingExternal") {
      rows.push([
        textFor(TEXT.weaponWear, language),
        signedPercent(effect.percent, effect.percent),
      ]);
    } else if (labels[`effect_${effect.label}`]) {
      const sign = effect.beneficial === false ? -1 : effect.beneficial ? 1 : effect.percent;
      rows.push([label(`effect_${effect.label}`, language), signedPercent(sign, effect.percent)]);
    }
  }
  return rows.length ? padded(rows) : undefined;
};

/**
 * The grenade stat block, in `language`: damage at the blast centre, then against strike
 * protection 1-4 (`StrikeGrenadeResistCoefs`), then what it does to you.
 */
const grenadeText = (grenade: GrenadeStats, resist: number[], language: Language) =>
  padded([
    [label("damage", language), String(Math.round(grenade.damage))],
    ...[1, 2, 3, 4].map((strike): [string, string] => [
      ` - ${textFor(VS_PROTECTION, language)} ${strike}`,
      String(Math.round(grenade.damage * (1 - (resist[strike] ?? 0)))),
    ]),
    [textFor(TEXT.damageToYou, language), String(Math.round(grenade.damageToPlayer))],
  ]);

/** The detector stat block, in `language`. */
const detectorText = (detector: DetectorStats, language: Language) => {
  const metres = (value: number) => `${formatNumber(value)}${textFor(TEXT.metres, language)}`;
  return padded([
    [textFor(TEXT.detectionRange, language), metres(detector.detectionRange)],
    [textFor(TEXT.artifactReveal, language), metres(detector.artifactReveal)],
    ...(detector.anomalyScan
      ? [[textFor(TEXT.anomalyScan, language), metres(detector.anomalyScan)] as [string, string]]
      : []),
  ]);
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
  for (const ammo of readAmmoStats()) {
    add(ammo.textSID, (strings) => appendToEach(strings, (language) => ammoText(ammo, language)));
  }
  for (const detector of readDetectorStats()) {
    add(detector.textSID, (strings) =>
      appendToEach(strings, (language) => detectorText(detector, language)),
    );
  }
  for (const attach of readAttachStats()) {
    if (!attachText(attach, "English")) continue;
    add(attach.textSID, (strings) =>
      appendToEach(strings, (language) => attachText(attach, language) ?? ""),
    );
  }
  const resist = readGrenadeResist();
  for (const grenade of readGrenadeStats()) {
    add(grenade.textSID, (strings) =>
      appendToEach(strings, (language) => grenadeText(grenade, resist, language)),
    );
  }
  writeModLocalization(import.meta.url, entries);
}
