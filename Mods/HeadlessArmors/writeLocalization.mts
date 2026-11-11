/**
 * Regenerates `raw/Stalker2/Content/HeadlessArmors-localization.uasset`: one
 * `sid_items_<SID>_name` / `sid_items_<SID>_description` pair for every item the mod adds, in every
 * language the game ships.
 *
 * Every name is built from the official name of the vanilla suit the item belongs to, read from
 * `vanillaSuitText.json` (extracted from the retail `.locres` files, so each language keeps the
 * game's own wording). A helmetless suit keeps the vanilla description with a note appended.
 *
 * Not runnable on its own: `transformArmorPrototypes` calls `writeHeadlessArmorsLocalization()`
 * once per `prepare-configs` run, so the text can't drift from the item list.
 */
import {
  itemLocalization,
  writeModLocalization,
  type TemplateByLanguage,
} from "../../src/localization/text.mts";
import type { LocalizedTextEntry } from "../../src/localization/uasset.mts";
import vanillaSuitText from "./vanillaSuitText.json" with { type: "json" };
import type { ProtectionKey } from "../ArmorStatsInDescriptions/armorStats.mts";
import { withProtectionStats } from "../ArmorStatsInDescriptions/writeLocalization.mts";

type SuitText = { name: TemplateByLanguage; description: TemplateByLanguage };
const VANILLA_SUITS = vanillaSuitText as Record<string, SuitText>;

const HEADLESS_SUFFIX = "_headless";

/** Helmets whose SID doesn't name their suit: the suit each one is made for. */
const HELMET_SUITS: Record<string, string> = {
  Exoskeleton_Duty_Helmet: "Exoskeleton_Dolg_Armor",
  Exoskeleton_Mercenaries_Helmet: "Exoskeleton_Mercenaries_Armor",
  Exoskeleton_Monolith_Helmet: "Exoskeleton_Monolith_Armor",
  Exoskeleton_Neutral_Helmet: "Exoskeleton_Neutral_Armor",
  Exoskeleton_Svoboda_Helmet: "Exoskeleton_Svoboda_Armor",
  HeavyBattle_Dolg_Helmet: "Heavy_Dolg_Armor",
  HeavyBattle_Merc_Helmet: "Heavy_Mercenaries_Armor",
  HeavyBattle_Spark_Helmet: "HeavyBattle_Spark_Armor",
};

/**
 * Spark has no vanilla exoskeleton, so its helmet names one: the game's Spark faction name
 * (`sid_misc_faction_spark`) with its exoskeleton noun (`sid_items_Exoskeleton_Neutral_Armor_name`).
 */
const SPARK_EXOSKELETON: TemplateByLanguage = {
  English: "Spark Exoskeleton",
  Ukrainian: "Екзоскелет «Іскри»",
  German: "Funken-Panzerung",
  French: "Exosquelette Spark",
  SpanishEuropean: "Exoesqueleto de Centella",
  Italian: "Esoscheletro Spark",
  Polish: "Egzoszkielet Iskry",
  Czech: "Exoskelet Jiskry",
  Turkish: "Kıvılcım Dış İskeleti",
  Serbian: "Егзоскелет Искре",
  PortugalBrazilian: "Exoesqueleto da Centelha",
  SpanishLatinoAmerican: "Exoesqueleto de Centella",
  Arabic: "هيكل الشرارة الخارجي",
  ChineseSimplified: "星火外骨骼",
  ChineseTraditional: "斯派克動力裝甲",
  Japanese: "スパーク・エクソスケルトン",
  Korean: "스파크 외골격 전투복",
};

/** `{s}` is the suit's vanilla name. The suffix form keeps every language's grammar intact. */
const HEADLESS_NAME: TemplateByLanguage = {
  English: "{s} (No Helmet)",
  Ukrainian: "{s} (без шолома)",
  German: "{s} (ohne Helm)",
  French: "{s} (sans casque)",
  SpanishEuropean: "{s} (sin casco)",
  Italian: "{s} (senza casco)",
  Polish: "{s} (bez hełmu)",
  Czech: "{s} (bez přilby)",
  Turkish: "{s} (Başlıksız)",
  Serbian: "{s} (без шлема)",
  PortugalBrazilian: "{s} (sem capacete)",
  SpanishLatinoAmerican: "{s} (sin casco)",
  Arabic: "{s} (بدون خوذة)",
  ChineseSimplified: "{s}（无头盔）",
  ChineseTraditional: "{s}（無頭盔）",
  Japanese: "{s}（ヘルメットなし）",
  Korean: "{s} (헬멧 없음)",
};

/** `{d}` is the suit's vanilla description. Psi wording follows `sid_effects_armor_protectionPsi_name`. */
const HEADLESS_DESCRIPTION: TemplateByLanguage = {
  English: "{d}\n\nThis version comes without a helmet and has no psi-protection. Wear a separate helmet.",
  Ukrainian: "{d}\n\nЦя версія без шолома і не має псі-захисту. Носіть окремий шолом.",
  German: "{d}\n\nDiese Version hat keinen Helm und bietet keinen Psi-Schutz. Trage einen separaten Helm.",
  French: "{d}\n\nCette version est sans casque et n'offre aucune protection psi. Portez un casque à part.",
  SpanishEuropean: "{d}\n\nEsta versión no tiene casco ni protección psi. Usa un casco aparte.",
  Italian: "{d}\n\nQuesta versione è priva di casco e non offre protezione psionica. Indossa un casco a parte.",
  Polish: "{d}\n\nTa wersja nie ma hełmu ani ochrony psionicznej. Załóż osobny hełm.",
  Czech: "{d}\n\nTato verze nemá přilbu ani psí-ochranu. Noste samostatnou přilbu.",
  Turkish: "{d}\n\nBu sürüm başlıksızdır ve Psi Koruması yoktur. Ayrı bir başlık takın.",
  Serbian: "{d}\n\nОва верзија нема шлем ни пси-заштиту. Носите засебан шлем.",
  PortugalBrazilian: "{d}\n\nEsta versão vem sem capacete e não tem psicoproteção. Use um capacete separado.",
  SpanishLatinoAmerican: "{d}\n\nEsta versión no tiene casco ni psiprotección. Usa un casco aparte.",
  Arabic: "{d}\n\nتأتي هذه النسخة بدون خوذة ولا توفر الوقاية من انبعاثات Psi. ارتدِ خوذة منفصلة.",
  ChineseSimplified: "{d}\n\n此版本不带头盔，没有心灵防护。请另外佩戴头盔。",
  ChineseTraditional: "{d}\n\n此版本不含頭盔，沒有心靈保護。請另外佩戴頭盔。",
  Japanese: "{d}\n\nこのバージョンはヘルメットが付属せず、プサイ防護がない。別途ヘルメットを着用すること。",
  Korean: "{d}\n\n이 버전은 헬멧이 없으며 정신파 방호력이 없습니다. 별도의 헬멧을 착용하세요.",
};

/** `{s}` is the suit's vanilla name. */
const HELMET_NAME: TemplateByLanguage = {
  English: "{s} Helmet",
  Ukrainian: "{s} — шолом",
  German: "{s} – Helm",
  French: "{s} – casque",
  SpanishEuropean: "{s} – casco",
  Italian: "{s} – casco",
  Polish: "{s} – hełm",
  Czech: "{s} – přilba",
  Turkish: "{s} – Başlık",
  Serbian: "{s} – шлем",
  PortugalBrazilian: "{s} – capacete",
  SpanishLatinoAmerican: "{s} – casco",
  Arabic: "خوذة {s}",
  ChineseSimplified: "{s}头盔",
  ChineseTraditional: "{s}頭盔",
  Japanese: "{s}用ヘルメット",
  Korean: "{s} 헬멧",
};

const HELMET_DESCRIPTION: TemplateByLanguage = {
  English:
    "A standalone helmet that matches the {s}. Suits without a helmet have no psi-protection, and this helmet provides it.",
  Ukrainian: "Окремий шолом. Пасує до: {s}. Костюми без шолома не мають псі-захисту, а цей шолом його дає.",
  German: "Ein separater Helm. Passend zu: {s}. Anzüge ohne Helm bieten keinen Psi-Schutz – dieser Helm gleicht das aus.",
  French: "Un casque indépendant. Assorti à : {s}. Les tenues sans casque n'offrent aucune protection psi, ce casque y remédie.",
  SpanishEuropean:
    "Un casco independiente. A juego con: {s}. Los trajes sin casco no ofrecen protección psi; este casco la proporciona.",
  Italian:
    "Un casco a sé stante. Abbinato a: {s}. Le tute senza casco non offrono protezione psionica; questo casco la fornisce.",
  Polish: "Osobny hełm. Pasuje do: {s}. Kombinezony bez hełmu nie zapewniają ochrony psionicznej, a ten hełm ją daje.",
  Czech: "Samostatná přilba. Hodí se k: {s}. Obleky bez přilby nemají psí-ochranu; tato přilba ji poskytuje.",
  Turkish: "Ayrı bir başlık. Uyumlu olduğu donanım: {s}. Başlıksız kıyafetlerin Psi Koruması yoktur; bu başlık bunu sağlar.",
  Serbian: "Засебан шлем. Пристаје уз: {s}. Одела без шлема немају пси-заштиту, а овај шлем је пружа.",
  PortugalBrazilian:
    "Um capacete avulso. Combina com: {s}. Trajes sem capacete não oferecem psicoproteção; este capacete a fornece.",
  SpanishLatinoAmerican:
    "Un casco independiente. Combina con: {s}. Los trajes sin casco no ofrecen psiprotección; este casco la proporciona.",
  Arabic: "خوذة منفصلة. تناسب: {s}. البدلات التي بدون خوذة لا توفر الوقاية من انبعاثات Psi، وهذه الخوذة توفرها.",
  ChineseSimplified: "独立头盔，与{s}搭配。无头盔的护甲没有心灵防护，这顶头盔可以弥补。",
  ChineseTraditional: "獨立頭盔，與{s}搭配。無頭盔的護甲沒有心靈保護，這頂頭盔可以彌補。",
  Japanese: "単体のヘルメット。対応装備：{s}。ヘルメットなしのスーツにはプサイ防護がないため、このヘルメットで補える。",
  Korean: "별도의 헬멧입니다. 어울리는 장비: {s}. 헬멧이 없는 전투복은 정신파 방호력이 없으며, 이 헬멧이 이를 보완합니다.",
};

function suitText(suitSID: string): SuitText {
  const text = VANILLA_SUITS[suitSID];
  if (!text) {
    throw new Error(`HeadlessArmors: no vanilla text for '${suitSID}' in vanillaSuitText.json`);
  }
  return text;
}

function helmetSuitName(SID: string): TemplateByLanguage {
  if (SID === "Exoskeleton_Spark_Helmet") return SPARK_EXOSKELETON;
  const suitSID = HELMET_SUITS[SID] ?? SID.replace(/_Helmet$/, "");
  return suitText(suitSID).name;
}

export function headlessArmorsLocalization(itemSIDs: string[]): LocalizedTextEntry[] {
  return itemSIDs.flatMap((SID) => {
    if (SID.endsWith(HEADLESS_SUFFIX)) {
      const suit = suitText(SID.slice(0, -HEADLESS_SUFFIX.length));
      return itemLocalization(
        SID,
        { name: HEADLESS_NAME, description: HEADLESS_DESCRIPTION },
        { s: suit.name, d: suit.description },
      );
    }
    if (SID.endsWith("_Helmet")) {
      return itemLocalization(
        SID,
        { name: HELMET_NAME, description: HELMET_DESCRIPTION },
        { s: helmetSuitName(SID) },
      );
    }
    throw new Error(`HeadlessArmors: don't know how to name '${SID}'`);
  });
}

/**
 * `protectionOf` gives each item's final protection values; every description gets them appended
 * as the same stat block ArmorStatsInDescriptions adds to vanilla armor.
 */
export function writeHeadlessArmorsLocalization(
  itemSIDs: string[],
  protectionOf: (SID: string) => Record<ProtectionKey, number>,
) {
  const entries = headlessArmorsLocalization(itemSIDs).map((entry) => {
    const SID = entry.SID.match(/^sid_items_(.+)_description$/)?.[1];
    if (!SID) return entry;
    return {
      ...entry,
      LanguagesToLocalizedStrings: withProtectionStats(entry.LanguagesToLocalizedStrings, protectionOf(SID)),
    };
  });
  return writeModLocalization(import.meta.url, entries);
}
