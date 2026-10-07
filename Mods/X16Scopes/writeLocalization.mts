/**
 * Regenerates `raw/Stalker2/Content/X16Scopes-localization.uasset`: a `sid_items_<SID>_name` /
 * `sid_items_<SID>_description` pair for each of the two new scopes, in every language the SDK's
 * `ELocalizationLanguage` enum offers.
 *
 * The names are the vanilla X8 names with the magnification swapped, spelled the way each
 * language's own X8 name spells it ("8Х" with a Cyrillic Х, "X8" in Spanish, "8KY" in Turkish...).
 * The descriptions open with the vanilla X8 description's wording and add a line about the 16x zoom.
 * The Russian slot is served Ukrainian text by `src/localization/text.mts`.
 *
 * Not runnable on its own: the only entry point is `writeX16ScopesLocalization()`, called from the
 * `getX16AttachPrototypes` transformer, so the asset is only rewritten by `prepare-configs`.
 */
import {
  itemLocalization,
  writeModLocalization,
  type TemplateByLanguage,
} from "../../src/localization/text.mts";

const SCOPE_TEXT: Record<
  "EN_X16Scope_1" | "UA_X16Scope_1",
  { name: TemplateByLanguage; description: TemplateByLanguage }
> = {
  EN_X16Scope_1: {
    name: {
      English: "Storm Falcon 16X Scope",
      Ukrainian: "Приціл Storm Falcon 16Х",
      German: "Sturmfalke-16X-Zielfernrohr",
      French: "Lunette Storm Falcon 16X",
      SpanishEuropean: "Visor Storm Falcon X16",
      Italian: "Mirino 16X Storm Falcon",
      Polish: "Luneta Storm Falcon 16X",
      Czech: "Optika Storm Falcon 16X",
      Turkish: "Fırtına Şahini 16KY Dürbün",
      Serbian: "Нишан „Storm Falcon” (16x)",
      PortugalBrazilian: "Luneta Storm Falcon 16X",
      SpanishLatinoAmerican: "Mira telescópica Storm Falcon 16X",
      Arabic: "منظار ستورم فالكون 16X",
      ChineseSimplified: "风暴猎鹰 16 倍瞄准镜",
      ChineseTraditional: "「風暴獵鷹」16倍瞄準鏡",
      Japanese: "ストームファルコン16Xスコープ",
      Korean: "스톰 팔콘 16X 조준경",
    },
    description: {
      English:
        "A very high-magnification scope designed to be mounted on a Picatinny rail. Its 16x zoom lets you pick off mutants and humans at extreme range, but it is unwieldy at close quarters.",
      Ukrainian:
        "Приціл надвисокої кратності встановлюється на рейку Пікатінні. Збільшення 16Х дає змогу влучати в мутантів і людей на граничній дистанції, але в ближньому бою він незручний.",
      German:
        "Dieses Zielfernrohr mit sehr hoher Vergrößerung wird auf einer Picatinny-Schiene montiert. Mit 16-facher Vergrößerung trifft man Mutanten und Menschen auf extreme Distanzen, im Nahkampf ist es jedoch unhandlich.",
      French:
        "Cette lunette à très fort grossissement se monte sur un rail Picatinny. Son grossissement 16x permet d'abattre mutants et humains à très longue distance, mais elle est peu maniable au corps à corps.",
      SpanishEuropean:
        "Este visor de aumento muy elevado se monta en un riel Picatinny. Sus 16 aumentos permiten abatir mutantes y humanos a distancias extremas, aunque resulta poco manejable en combate cercano.",
      Italian:
        "Questo mirino ad altissimo ingrandimento si monta su una slitta Picatinny. L'ingrandimento 16x permette di colpire mutanti e umani a distanze estreme, ma è poco maneggevole negli scontri ravvicinati.",
      Polish:
        "Ta luneta o bardzo dużym zbliżeniu montowana jest na szynie Picatinny. Zbliżenie 16x pozwala trafiać mutanty i ludzi z ekstremalnych odległości, ale w walce na krótkim dystansie jest nieporęczna.",
      Czech:
        "Tato optika s velmi velkým zvětšením je určená pro lištu Picatinny. Šestnáctinásobné zvětšení umožňuje zasáhnout mutanty i lidi na extrémní vzdálenost, v boji zblízka je však nepraktická.",
      Turkish:
        "Pikatini raya takılan bu çok yüksek yakınlaştırmalı dürbün, 16 kat büyütmesiyle mutantları ve insanları çok uzak mesafeden vurmanızı sağlar; ancak yakın dövüşte kullanışsızdır.",
      Serbian:
        "Нишан са веома великим увећањем који се поставља на Пикатинијеву шину. Увећање од 16x омогућава погађање мутаната и људи на екстремним даљинама, али је незграпан у блиској борби.",
      PortugalBrazilian:
        "Esta luneta de ampliação muito alta é montada em um trilho Picatinny. A ampliação de 16X permite abater mutantes e humanos a distâncias extremas, mas é pouco prática em combate a curta distância.",
      SpanishLatinoAmerican:
        "Esta mira telescópica de aumento muy alto se monta en un riel Picatinny. Su aumento de 16X permite abatir mutantes y humanos a distancias extremas, aunque es poco práctica en combate cercano.",
      Arabic:
        "منظار فائق التكبير مصمّم للتركيب على سكّة بيكاتيني. يتيح تكبيره 16 مرة إصابة المسوخ والبشر من مسافات بعيدة جدًا، لكنه غير عملي في القتال القريب.",
      ChineseSimplified:
        "专门安装在皮卡汀尼导轨上的超高倍瞄准镜。16 倍放大可在极远距离猎杀变异体和人类，但在近战中十分笨重。",
      ChineseTraditional:
        "這種設計安裝在皮卡汀尼導軌上的超高倍率瞄準鏡，16倍放大能在極遠距離獵殺變異體和人類，但在近戰中相當笨重。",
      Japanese:
        "ピカティニーレールへの搭載用に設計された超高倍率スコープ。16倍の倍率で超遠距離からミュータントや人間を狙えるが、近接戦闘では扱いにくい。",
      Korean:
        "피카티니 레일에 장착할 수 있는 초고배율 조준경입니다. 16배율로 돌연변이와 인간을 초장거리에서 저격할 수 있지만, 근접전에서는 다루기 불편합니다.",
    },
  },
  UA_X16Scope_1: {
    name: {
      English: "POS 16X Scope",
      Ukrainian: "Приціл ПОС 16Х",
      German: "POS-16X-Zielfernrohr",
      French: "Lunette POS 16X",
      SpanishEuropean: "Visor POS X16",
      Italian: "Mirino POS 16X",
      Polish: "Luneta POS 16X",
      Czech: "Optika POS 16X",
      Turkish: "POS 16KY Dürbün",
      Serbian: "ПОС нишан (16x)",
      PortugalBrazilian: "Luneta PSO 16X",
      SpanishLatinoAmerican: "Mira telescópica POS 16X",
      Arabic: "منظار POS 16X",
      ChineseSimplified: "POS 16 倍瞄准镜",
      ChineseTraditional: "PSO 16倍瞄準鏡",
      Japanese: "POS 16Xスコープ",
      Korean: "POS 16X 조준경",
    },
    description: {
      English:
        "A very high-magnification Soviet scope designed to fit on a dovetail mount. Its 16x zoom is made for extreme-range shooting; it is of little use at close quarters.",
      Ukrainian:
        "Радянський приціл надвисокої кратності. Установлюється на «ластівчин хвіст». Збільшення 16Х призначене для стрільби на граничну дистанцію, у ближньому бою від нього мало користі.",
      German:
        "Ein sowjetisches Zielfernrohr mit sehr hoher Vergrößerung für eine Schwalbenschwanzmontage. Die 16-fache Vergrößerung ist für Schüsse auf extreme Distanzen gedacht, im Nahkampf nützt es wenig.",
      French:
        "Lunette soviétique à très fort grossissement conçue pour être montée sur une queue d'aronde. Son grossissement 16x est fait pour le tir à très longue distance ; elle est peu utile à courte portée.",
      SpanishEuropean:
        "Un visor soviético de aumento muy elevado diseñado para encajar en un riel de cola de milano. Sus 16 aumentos están pensados para el tiro a distancias extremas; a corta distancia es poco útil.",
      Italian:
        "Mirino ad altissimo ingrandimento di produzione sovietica, progettato per un innesto a coda di rondine. L'ingrandimento 16x è pensato per il tiro a distanze estreme; a distanza ravvicinata serve a poco.",
      Polish:
        "Radziecka luneta o bardzo dużym zbliżeniu zaprojektowana do montażu typu jaskółczy ogon. Zbliżenie 16x służy do strzelania na ekstremalne odległości; na krótkim dystansie jest mało przydatna.",
      Czech:
        "Sovětská optika s velmi velkým zvětšením navržená pro rybinovou lištu. Šestnáctinásobné zvětšení je určené pro střelbu na extrémní vzdálenost; zblízka je téměř k ničemu.",
      Turkish:
        "Eski tip raya uyacak şekilde tasarlanmış, çok yüksek yakınlaştırma sağlayan bir Sovyet dürbünü. 16 kat büyütmesi çok uzak mesafeli atışlar içindir; yakın mesafede pek işe yaramaz.",
      Serbian:
        "Совјетски нишан са веома великим увећањем. Поставља се на носач „ластин реп”. Увећање од 16x намењено је гађању на екстремним даљинама; изблиза је од мале користи.",
      PortugalBrazilian:
        "Uma luneta soviética de ampliação muito alta, projetada para encaixar em um trilho em cauda de andorinha. A ampliação de 16X é feita para tiros a distâncias extremas; a curta distância é pouco útil.",
      SpanishLatinoAmerican:
        "Una mira telescópica soviética de aumento muy alto, diseñada para encajar en un riel de cola de milano. Su aumento de 16X está pensado para disparar a distancias extremas; a corta distancia es poco útil.",
      Arabic:
        "منظار سوفيتي فائق التكبير مصمّم ليتوافق مع التركيبة بشكل مشبك. تكبيره 16 مرة مخصّص للرماية من مسافات بعيدة جدًا، وفائدته قليلة في القتال القريب.",
      ChineseSimplified:
        "专为燕尾导轨安装位设计的苏制超高倍率瞄准镜。16 倍放大专为极远距离射击设计，近距离作战用处不大。",
      ChineseTraditional:
        "蘇聯超高倍率瞄準鏡，設計用於安裝在鳩尾座上。16倍放大專為極遠距離射擊設計，近距離作戰用處不大。",
      Japanese:
        "蟻継型マウントにフィットするように設計されたソビエト製の超高倍率スコープ。16倍の倍率は超遠距離射撃向けで、近距離ではほとんど役に立たない。",
      Korean:
        "도브테일 마운트에 장착할 용도로 설계된 소련제 초고배율 조준경입니다. 16배율은 초장거리 사격용이며, 근거리에서는 별 쓸모가 없습니다.",
    },
  },
};

export function writeX16ScopesLocalization() {
  writeModLocalization(
    import.meta.url,
    Object.entries(SCOPE_TEXT).flatMap(([sid, text]) => itemLocalization(sid, text)),
  );
}
