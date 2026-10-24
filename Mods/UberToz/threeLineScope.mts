/**
 * The Three-Line Rifle's PU 3.5X scope as a standalone, detachable attachment. Vanilla always ships it
 * hidden inside the rifle, with no icon, price or text.
 *
 * Shared by UberToz (TOZ-34) and ScopedDrahunka: each mod ships these same patches, so either works on
 * its own, and with both installed the duplicate patches agree. Keep every value here identical for both;
 * only the icon path (each mod cooks its own copy of the same art) and the guns each mod adds to
 * `FittingWeaponsSIDs` differ.
 */
import { Struct } from "s2cfgtojson";
import type { AttachPrototype, WeaponGeneralSetupPrototype } from "s2cfgtojson";
import { itemLocalization, type TemplateByLanguage } from "../../src/localization/text.mts";

export const THREE_LINE_SCOPE_SID = "GunThreeLine_Scope";

/**
 * The names follow each language's own vanilla PSO 4X name ("4Х" with a Cyrillic Х, "X4" in Spanish,
 * "4KY" in Turkish...), and the Three-Line Rifle is spelled the way vanilla spells it.
 */
const name: TemplateByLanguage = {
  English: "PU 3.5X Scope",
  Ukrainian: "Приціл ПУ 3,5Х",
  German: "PU-3,5X-Zielfernrohr",
  French: "Lunette PU 3,5X",
  SpanishEuropean: "Visor PU X3,5",
  Italian: "Mirino PU 3,5X",
  Polish: "Luneta PU 3,5X",
  Czech: "Optika PU 3,5X",
  Turkish: "PU 3,5KY Dürbün",
  Serbian: "ПУ нишан (3,5x)",
  PortugalBrazilian: "Luneta PU 3,5X",
  SpanishLatinoAmerican: "Mira telescópica PU 3.5X",
  Arabic: "منظار PU 3.5X",
  ChineseSimplified: "PU 3.5 倍瞄准镜",
  ChineseTraditional: "PU 3.5倍瞄準鏡",
  Japanese: "PU 3.5Xスコープ",
  Korean: "PU 3.5X 조준경",
};

/**
 * Real-world facts (PU = "shortened sight": built for the SVT-40 in 1940, on Mosin 91/30 sniper rifles from
 * 1942, elevation drum 0-1300 m). No list of guns: the "Fits:" line shows them, and which ones depends on the
 * installed mods. No real weight either (270 g), the item weighs more.
 */
const description: TemplateByLanguage = {
  English:
    "A Soviet PU 3.5x telescopic sight, made short and simple for mass production. Designed in 1940 for the SVT-40 and fitted to three-line sniper rifles from 1942. The elevation drum is graduated up to 1,300 meters.",
  Ukrainian:
    "Радянський оптичний приціл ПУ зі збільшенням 3,5х, короткий і простий у масовому виробництві. Створений 1940 року для СВТ-40, з 1942 року встановлювався на снайперські трилінійки. Барабан вертикальних поправок розмічений до 1300 метрів.",
  German:
    "Sowjetisches Zielfernrohr PU mit 3,5-facher Vergrößerung, kurz und einfach in Massenfertigung herzustellen. 1940 für das SWT-40 entwickelt und ab 1942 auf Dreilinien-Scharfschützengewehre montiert. Die Höhenverstellung ist bis 1.300 Meter skaliert.",
  French:
    "Lunette soviétique PU de grossissement 3,5x, courte et simple à produire en masse. Conçue en 1940 pour le SVT-40 et montée sur les fusils de précision Trois lignes à partir de 1942. Son tambour de hausse est gradué jusqu’à 1 300 mètres.",
  SpanishEuropean:
    "Visor soviético PU de aumento x3,5, corto y sencillo de fabricar en masa. Diseñado en 1940 para el SVT-40 y montado en fusiles de francotirador de tres líneas desde 1942. Su tambor de elevación está graduado hasta 1300 metros.",
  Italian:
    "Mirino telescopico sovietico PU con ingrandimento 3,5x, corto e semplice da produrre in massa. Progettato nel 1940 per l'SVT-40 e montato sui fucili da cecchino a tre linee dal 1942. Il tamburo dell'alzo è graduato fino a 1300 metri.",
  Polish:
    "Radziecka luneta PU o zbliżeniu 3,5x, krótka i prosta w masowej produkcji. Zaprojektowana w 1940 roku do SWT-40, od 1942 roku montowana na trzyliniowych karabinach snajperskich. Bęben nastaw wysokości ma podziałkę do 1300 metrów.",
  Czech:
    "Sovětský puškohled PU s 3,5x zvětšením, krátký a jednoduchý pro sériovou výrobu. Navržen v roce 1940 pro SVT-40, od roku 1942 montován na odstřelovačské třířadé pušky. Výškový buben je cejchován do 1 300 metrů.",
  Turkish:
    "Sovyet yapımı 3,5 kat yakınlaştırmalı PU dürbünü; kısa ve seri üretimi kolay. 1940'ta SVT-40 için tasarlandı, 1942'den itibaren Üç Çizikli keskin nişancı tüfeklerine takıldı. Yükseklik ayar tamburu 1.300 metreye kadar derecelendirilmiştir.",
  Serbian:
    "Совјетски оптички нишан ПУ са увећањем од 3,5x, кратак и једноставан за масовну производњу. Пројектован 1940. за СВТ-40, а од 1942. постављан на снајперске тролинијке. Добош за висину је градуисан до 1.300 метара.",
  PortugalBrazilian:
    "Luneta soviética PU com ampliação de 3,5x, curta e simples de produzir em massa. Projetada em 1940 para o SVT-40 e montada em rifles de precisão de Três Linhas a partir de 1942. O tambor de elevação é graduado até 1.300 metros.",
  SpanishLatinoAmerican:
    "Mira telescópica soviética PU con aumento de 3.5x, corta y sencilla de fabricar en masa. Diseñada en 1940 para el SVT-40 y montada en rifles de francotirador de tres líneas desde 1942. Su tambor de elevación está graduado hasta 1,300 metros.",
  Arabic:
    "منظار تلسكوبي سوفيتي من طراز PU بتكبير 3.5x، قصير وسهل الإنتاج بكميات كبيرة. صُمم عام 1940 لبندقية SVT-40، ورُكّب على بنادق القنص ثلاثية الخطوط منذ عام 1942. أسطوانة ضبط الارتفاع مدرّجة حتى 1300 متر.",
  ChineseSimplified:
    "苏制 PU 3.5 倍瞄准镜，短小且便于大量生产。1940 年为 SVT-40 设计，1942 年起装配于莫辛-纳甘狙击步枪。高低调节转轮刻度可达 1300 米。",
  ChineseTraditional:
    "蘇聯製PU 3.5倍瞄準鏡，短小且便於大量生產。1940年為SVT-40設計，1942年起裝配於三線狙擊步槍。高低調整轉輪刻度可達1300公尺。",
  Japanese:
    "ソビエト製の3.5倍PUスコープ。短く、大量生産しやすい設計。1940年にSVT-40用に設計され、1942年からスリーライン狙撃銃にも搭載された。エレベーションダイヤルは1300メートルまで目盛りが刻まれている。",
  Korean:
    "소련제 3.5배율 PU 조준경으로, 짧고 대량 생산하기 쉽게 만들어졌습니다. 1940년 SVT-40용으로 설계되었고, 1942년부터 쓰리 라인 저격 소총에 장착되었습니다. 고저 조절 다이얼은 1,300미터까지 눈금이 새겨져 있습니다.",
};

/** Name and description entries, for the calling mod's own `writeModLocalization`. */
export function threeLineScopeLocalization() {
  return itemLocalization(THREE_LINE_SCOPE_SID, { name, description });
}

/**
 * The scope's AttachPrototype patch: icon, price, weight, and the calling mod's guns on the "Fits:" line
 * (keyed the way vanilla keys it, by a gun's LocalizationSID or SID).
 */
export function forkThreeLineScope(struct: AttachPrototype, icon: string, fitsKeys: string[]) {
  const fork = struct.fork();
  fork.Icon = icon;
  fork.Cost = 9500.0;
  fork.Weight = 0.6;
  fork.FittingWeaponsSIDs = struct.FittingWeaponsSIDs.fork();
  for (const key of fitsKeys) {
    fork.FittingWeaponsSIDs.addNode(key, key);
  }
  return fork;
}

/** A shipped PreinstalledAttachmentsItemPrototypeSIDs list as a plain (non-bpatch) array, keeping its bskipref (see AGENTS.md). */
export function wholePreinstalledList(struct: WeaponGeneralSetupPrototype) {
  const list = new Struct(
    {},
  ) as WeaponGeneralSetupPrototype["PreinstalledAttachmentsItemPrototypeSIDs"];
  list.__internal__.isArray = true;
  list.__internal__.bskipref =
    struct.PreinstalledAttachmentsItemPrototypeSIDs.__internal__.bskipref;
  list.__internal__.bpatch = false;
  struct.PreinstalledAttachmentsItemPrototypeSIDs.forEach(([_k, e], i) =>
    list.addNode(e.clone(), i),
  );
  return list;
}

/** GunThreeLine_SP_GS: shows the built-in scope in the inventory, so it can be detached, sold and moved. */
export function forkThreeLineSetupWithVisibleScope(struct: WeaponGeneralSetupPrototype) {
  const fork = struct.fork();
  fork.PreinstalledAttachmentsItemPrototypeSIDs = wholePreinstalledList(struct);
  fork.PreinstalledAttachmentsItemPrototypeSIDs["0"].bHiddenInInventory = false;
  return fork;
}
