/**
 * Regenerates `raw/Stalker2/Content/DecoupledRanks-Localization2.uasset` from this mod's own item
 * definitions: the level counter, the four rank indicators, and the faction patches it ships
 * alongside FactionPatches.
 *
 * The patch flavour text - including the per-faction descriptions - comes straight from
 * `FactionPatches/writeLocalization.mts`: both mods add the same prototypes, and each ships its
 * text asset independently, so the strings are shared rather than duplicated. Here it is keyed off
 * the *non-quest* patch SIDs, because those are the patches the player actually keeps.
 *
 * The quest variants - both the faction patches and the mutant parts - are removed from the
 * inventory the instant they are picked up, and exist only to hand the quest graph an XP amount.
 * Their name and description therefore say nothing but how much XP they are worth, in place of a
 * name and flavour text the player would never get to read.
 *
 * Not runnable on its own: `writeDecoupledRanksLocalization()` is called from the
 * `transformKeyItemPrototypes` transformer, inside its once-guard, so the asset is only ever
 * rewritten as part of a `prepare-configs` run.
 */
import type { ERank } from "s2cfgtojson";
import {
  itemLocalization,
  writeModLocalization,
  type TemplateByLanguage,
} from "../../src/localization/text.mts";
import type { LocalizedTextEntry } from "../../src/localization/uasset.mts";
import { factionPatchLocalization } from "../FactionPatches/writeLocalization.mts";
import { FactionPatchDefinitions } from "../FactionPatches/addFactionPatchItems.mts";
import {
  getNonQuestFactionPatchSID,
  LEVEL_COUNTER_ITEM_SID,
  RANK_INDICATOR_ITEM_SIDS,
} from "./transformKeyItemPrototypes.mts";
import { NPCRank } from "./transformQuestNodePrototypes.mts";
import { MutantLootDefinitions } from "./addMutantPartItems.mts";

const LEVEL_NAME: TemplateByLanguage = {
  English: "Skif's Level",
  Ukrainian: "Рівень Скіфа",
  German: "Skifs Stufe",
  French: "Niveau de Skif",
  SpanishEuropean: "Nivel de Skif",
  Italian: "Livello di Skif",
  Polish: "Poziom Skifa",
  Czech: "Skifova úroveň",
  Turkish: "Skif'in Seviyesi",
  Serbian: "Ниво Скифа",
  PortugalBrazilian: "Nível de Skif",
  SpanishLatinoAmerican: "Nivel de Skif",
  Arabic: "مستوى سكيف",
  ChineseSimplified: "斯基夫的等级",
  ChineseTraditional: "斯基夫的等級",
  Japanese: "スキフのレベル",
  Korean: "스키프의 레벨",
};

const LEVEL_DESCRIPTION: TemplateByLanguage = {
  English:
    "The stack count is your current level. Experience comes from faction patches taken off the dead and parts cut from mutants.",
  Ukrainian:
    "Кількість показує поточний рівень. Щоб досягти наступного рівня, збирай шеврони і частини мутантів.",
  German:
    "Die Stapelanzahl ist deine aktuelle Stufe. Erfahrung bringen Fraktionsabzeichen von Gefallenen und Teile getöteter Mutanten.",
  French:
    "Le nombre dans la pile est votre niveau actuel. L'expérience vient des écussons pris sur les morts et des parties découpées sur les mutants.",
  SpanishEuropean:
    "La cantidad apilada es tu nivel actual. La experiencia viene de los parches de los caídos y de las partes de los mutantes.",
  Italian:
    "La quantità nella pila è il tuo livello attuale. L'esperienza arriva dalle toppe dei caduti e dalle parti dei mutanti.",
  Polish:
    "Liczba w stosie to twój obecny poziom. Doświadczenie dają naszywki zdjęte z poległych i części zabitych mutantów.",
  Czech:
    "Počet ve stohu je tvá aktuální úroveň. Zkušenosti dávají nášivky z padlých a části zabitých mutantů.",
  Turkish:
    "Yığındaki sayı mevcut seviyendir. Deneyim, ölülerden alınan armalardan ve mutant parçalarından gelir.",
  Serbian:
    "Број у гомили је твој тренутни ниво. Искуство доносе ознаке са палих и делови убијених мутаната.",
  PortugalBrazilian:
    "A quantidade na pilha é seu nível atual. A experiência vem dos emblemas tirados dos mortos e das partes dos mutantes.",
  SpanishLatinoAmerican:
    "La cantidad apilada es tu nivel actual. La experiencia viene de los parches de los caídos y de las partes de los mutantes.",
  Arabic: "العدد في الحزمة هو مستواك الحالي. تأتي الخبرة من شعارات القتلى وأجزاء المتحوّلين.",
  ChineseSimplified:
    "堆叠数量就是你当前的等级。经验来自从尸体上取下的派系臂章和从变异体身上割下的部件。",
  ChineseTraditional:
    "堆疊數量就是你目前的等級。經驗來自從屍體上取下的派系臂章和從變異體身上割下的部件。",
  Japanese:
    "スタック数が現在のレベルだ。経験は死体から剥がした派閥のパッチと、ミュータントから切り取った部位で得られる。",
  Korean:
    "묶음 수량이 현재 레벨이다. 경험치는 시체에서 떼어낸 진영 패치와 돌연변이에게서 잘라낸 부위로 얻는다.",
};

/** `{r}` is the rank name from `RANK_NAMES`. */
const RANK_NAME: TemplateByLanguage = {
  English: "Rank: {r}",
  Ukrainian: "Звання: {r}",
  German: "Rang: {r}",
  French: "Rang : {r}",
  SpanishEuropean: "Rango: {r}",
  Italian: "Grado: {r}",
  Polish: "Ranga: {r}",
  Czech: "Hodnost: {r}",
  Turkish: "Rütbe: {r}",
  Serbian: "Ранг: {r}",
  PortugalBrazilian: "Patente: {r}",
  SpanishLatinoAmerican: "Rango: {r}",
  Arabic: "الرتبة: {r}",
  ChineseSimplified: "级别：{r}",
  ChineseTraditional: "級別：{r}",
  Japanese: "階級：{r}",
  Korean: "계급: {r}",
};

/**
 * One description per rank, and each one names what rank actually changes in the game data rather
 * than striking a pose: lair population and respawn timers (`LairPrototypes.cfg`,
 * `SpawnSettingsPerPlayerRanks`), which squads may spawn at all (`Min/MaxSpawnRank`), what the
 * rank-gated loot packs hold (`PackOfItemsGroupPrototypes.cfg`), and the trade modifiers in
 * `TradePrototypes.cfg` - traders pay 15/20/25% more and charge 3/5/10% less at
 * Experienced/Veteran/Master. Kept in plain words: it is item text, not a changelog.
 */
const RANK_DESCRIPTIONS = {
  "ERank::Newbie": {
    English:
      "The Zone still counts you as nobody. Mutant lairs nearby stay thin, stashes and bodies give up the cheapest kit, and traders offer you no better price than anyone else.",
    Ukrainian:
      "Зона поки що не вважає тебе за когось. Лігва поблизу тримають найменші виводки, зі схованок і тіл падає найдешевше майно, а торговці не дають тобі кращої ціни, ніж будь-кому.",
    German:
      "Die Zone hält dich noch für niemanden. Nester in der Nähe bleiben dünn besetzt, Verstecke und Leichen geben nur billiges Zeug her, und Händler machen dir keinen besseren Preis als allen anderen.",
    French:
      "La Zone ne te compte encore pour rien. Les nids alentour restent peu peuplés, les caches et les corps ne rendent que du matériel bon marché, et les marchands ne t'offrent pas un meilleur prix qu'aux autres.",
    SpanishEuropean:
      "La Zona todavía no te cuenta como nadie. Las madrigueras cercanas siguen escasas, los escondrijos y los cadáveres solo sueltan equipo barato, y los comerciantes no te dan mejor precio que a nadie.",
    Italian:
      "La Zona non ti considera ancora nessuno. Le tane vicine restano poco popolate, nascondigli e cadaveri rendono solo roba da poco, e i mercanti non ti fanno un prezzo migliore che agli altri.",
    Polish:
      "Zona wciąż nie liczy cię za nikogo. Legowiska w okolicy są słabo obsadzone, ze skrytek i ciał leci najtańszy sprzęt, a handlarze nie dają ci lepszej ceny niż komukolwiek.",
    Czech:
      "Zóna tě pořád nepočítá za nikoho. Doupata v okolí zůstávají slabě obsazená, ze skrýší a mrtvol padá jen nejlevnější výstroj a obchodníci ti nedají lepší cenu než komukoli jinému.",
    Turkish:
      "Bölge seni hâlâ kimse saymıyor. Yakındaki inler seyrek kalıyor, zulalardan ve cesetlerden yalnızca ucuz teçhizat çıkıyor, tüccarlar da sana kimseden iyi fiyat vermiyor.",
    Serbian:
      "Зона те још не сматра никим. Јазбине у близини остају проређене, из скровишта и с тела пада само најјефтинија опрема, а трговци ти не дају бољу цену од било кога.",
    PortugalBrazilian:
      "A Zona ainda não te conta como ninguém. Os covis por perto ficam ralos, esconderijos e corpos só soltam equipamento barato, e os comerciantes não te dão preço melhor que a ninguém.",
    SpanishLatinoAmerican:
      "La Zona todavía no te cuenta como nadie. Las madrigueras cercanas siguen escasas, los escondrijos y los cadáveres solo sueltan equipo barato, y los comerciantes no te dan mejor precio que a nadie.",
    Arabic:
      "المنطقة لا تعدّك أحدًا بعد. الأوجار القريبة تبقى قليلة العدد، والمخابئ والجثث لا تمنح إلا أرخص العتاد، والتجار لا يعطونك سعرًا أفضل من أي أحد.",
    ChineseSimplified:
      "区域还没把你当成个人物。附近的巢穴稀稀落落，藏货点和尸体上只有最便宜的装备，商人给你的价钱也和别人一样。",
    ChineseTraditional:
      "區域還沒把你當成個人物。附近的巢穴稀稀落落，藏貨點和屍體上只有最便宜的裝備，商人給你的價錢也和別人一樣。",
    Japanese:
      "ゾーンはまだお前を誰とも思っていない。近くの巣は数が少なく、隠し場所や死体からは安物しか出ず、商人の値も他の連中と変わらない。",
    Korean:
      "존은 아직 너를 아무것도 아닌 자로 여긴다. 근처 소굴은 수가 적고, 은닉처와 시체에서는 가장 값싼 장비만 나오며, 상인도 남들과 다를 바 없는 값을 부른다.",
  },
  "ERank::Experienced": {
    English:
      "The Zone begins to take you seriously. Lairs hold more mutants, better gear turns up in stashes and on bodies, and traders pay about 15% more for your loot while asking a little less for theirs.",
    Ukrainian:
      "Зона починає брати тебе до уваги. У лігвах більше мутантів, зі схованок і тіл трапляється краще майно, а торговці платять приблизно на 15% більше за твій хабар і трохи менше просять за свій товар.",
    German:
      "Die Zone nimmt dich langsam ernst. Nester sind stärker besetzt, in Verstecken und auf Leichen liegt besseres Zeug, und Händler zahlen etwa 15 % mehr für deine Beute und verlangen ein wenig weniger für ihre Ware.",
    French:
      "La Zone commence à te prendre au sérieux. Les nids sont plus peuplés, on trouve du meilleur matériel dans les caches et sur les corps, et les marchands paient environ 15 % de plus ta camelote tout en baissant un peu leurs prix.",
    SpanishEuropean:
      "La Zona empieza a tomarte en serio. Las madrigueras están más pobladas, aparece mejor equipo en escondrijos y cadáveres, y los comerciantes pagan un 15% más por tu botín y te cobran algo menos.",
    Italian:
      "La Zona inizia a prenderti sul serio. Le tane sono più popolate, in nascondigli e sui cadaveri trovi roba migliore, e i mercanti pagano circa il 15% in più il tuo bottino chiedendo un po' meno per il loro.",
    Polish:
      "Zona zaczyna brać cię na poważnie. W legowiskach jest więcej mutantów, w skrytkach i na ciałach trafia się lepszy sprzęt, a handlarze płacą około 15% więcej za twój łup i biorą trochę mniej za swój towar.",
    Czech:
      "Zóna tě začíná brát vážně. V doupatech je víc mutantů, ve skrýších a na mrtvolách se najde lepší výstroj a obchodníci platí asi o 15 % víc za tvůj lup a chtějí o něco méně za svoje zboží.",
    Turkish:
      "Bölge seni ciddiye almaya başlıyor. İnlerde daha çok mutant var, zulalarda ve cesetlerde daha iyi teçhizat çıkıyor, tüccarlar ganimetine yaklaşık %15 fazla ödeyip kendi mallarını biraz daha ucuza veriyor.",
    Serbian:
      "Зона почиње да те узима за озбиљно. У јазбинама је више мутаната, у скровиштима и на телима налазиш бољу опрему, а трговци плаћају око 15% више за твој плен и мало мање траже за свој.",
    PortugalBrazilian:
      "A Zona começa a te levar a sério. Os covis têm mais mutantes, aparece equipamento melhor em esconderijos e corpos, e os comerciantes pagam cerca de 15% mais pelo seu espólio e cobram um pouco menos pelo deles.",
    SpanishLatinoAmerican:
      "La Zona empieza a tomarte en serio. Las madrigueras están más pobladas, aparece mejor equipo en escondrijos y cadáveres, y los comerciantes pagan un 15% más por tu botín y te cobran algo menos.",
    Arabic:
      "بدأت المنطقة تأخذك على محمل الجد. الأوجار أكثر سكانًا، والمخابئ والجثث تجود بعتاد أفضل، والتجار يدفعون نحو 15% أكثر مقابل غنيمتك ويطلبون أقل قليلًا مقابل سلعهم.",
    ChineseSimplified:
      "区域开始把你当回事。巢穴里的变异体变多了，藏货点和尸体上能翻出更好的装备，商人收你的货多给约 15%，卖你的货也便宜一点。",
    ChineseTraditional:
      "區域開始把你當回事。巢穴裡的變異體變多了，藏貨點和屍體上能翻出更好的裝備，商人收你的貨多給約 15%，賣你的貨也便宜一點。",
    Japanese:
      "ゾーンがお前を少しは真面目に扱いだした。巣のミュータントは増え、隠し場所や死体からはましな装備が出る。商人は戦利品に約15%上乗せし、自分の品は少し値を下げる。",
    Korean:
      "존이 너를 진지하게 보기 시작한다. 소굴의 돌연변이가 늘고, 은닉처와 시체에서 더 좋은 장비가 나오며, 상인은 네 전리품에 약 15%를 더 주고 자기 물건은 조금 싸게 넘긴다.",
  },
  "ERank::Veteran": {
    English:
      "Your name travels ahead of you. Lairs come back fuller and faster, squads that never used to appear start showing up, what you find in stashes climbs a tier, and traders pay a fifth more for anything you sell.",
    Ukrainian:
      "Твоє ім'я йде поперед тебе. Лігва відновлюються швидше й повнішими, з'являються загони, яких раніше тут не бувало, зі схованок іде вже інший клас майна, а торговці платять на п'яту частину більше за все, що ти продаєш.",
    German:
      "Dein Name läuft dir voraus. Nester füllen sich schneller und voller, Trupps treten auf, die es hier vorher nicht gab, aus Verstecken kommt eine Klasse besseres Zeug, und Händler zahlen ein Fünftel mehr für alles, was du verkaufst.",
    French:
      "Ton nom te précède. Les nids se remplissent plus vite et plus fort, des escouades qui n'apparaissaient jamais se montrent, les caches livrent une classe au-dessus, et les marchands paient un cinquième de plus tout ce que tu vends.",
    SpanishEuropean:
      "Tu nombre va por delante de ti. Las madrigueras se repueblan más rápido y más llenas, aparecen escuadras que antes nunca salían, los escondrijos dan un nivel más de equipo, y los comerciantes pagan una quinta parte más por todo lo que vendes.",
    Italian:
      "Il tuo nome ti precede. Le tane si ripopolano più in fretta e più piene, compaiono squadre che prima non c'erano, i nascondigli danno una classe in più, e i mercanti pagano un quinto in più tutto ciò che vendi.",
    Polish:
      "Twoje imię idzie przed tobą. Legowiska odbudowują się szybciej i pełniej, pojawiają się oddziały, których wcześniej tu nie było, ze skrytek idzie sprzęt o klasę lepszy, a handlarze płacą o piątą część więcej za wszystko, co sprzedasz.",
    Czech:
      "Tvé jméno jde před tebou. Doupata se plní rychleji a víc, objevují se skupiny, které tu dřív nebývaly, ze skrýší chodí výstroj o třídu lepší a obchodníci platí o pětinu víc za vše, co prodáš.",
    Turkish:
      "Adın senden önce gidiyor. İnler daha hızlı ve daha dolu doluyor, eskiden hiç görünmeyen ekipler ortaya çıkıyor, zulalardan bir sınıf üstü teçhizat geliyor ve tüccarlar sattığın her şeye beşte bir fazla ödüyor.",
    Serbian:
      "Твоје име иде пре тебе. Јазбине се пуне брже и гушће, појављују се одреди којих пре овде није било, из скровишта излази опрема класу боља, а трговци плаћају петину више за све што продаш.",
    PortugalBrazilian:
      "Seu nome chega antes de você. Os covis se repovoam mais rápido e mais cheios, aparecem esquadras que antes nunca surgiam, os esconderijos dão equipamento uma classe acima, e os comerciantes pagam um quinto mais por tudo que você vende.",
    SpanishLatinoAmerican:
      "Tu nombre va por delante de ti. Las madrigueras se repueblan más rápido y más llenas, aparecen escuadras que antes nunca salían, los escondrijos dan un nivel más de equipo, y los comerciantes pagan una quinta parte más por todo lo que vendes.",
    Arabic:
      "اسمك يسبقك. الأوجار تعود أكثر امتلاءً وأسرع، وتظهر فرق لم تكن تأتي إلى هنا، والمخابئ تجود بعتاد أعلى طبقة، والتجار يدفعون خُمسًا أكثر مقابل كل ما تبيعه.",
    ChineseSimplified:
      "你的名声先你一步到场。巢穴回填得更快也更满，从前根本不会出现的小队开始冒头，藏货点里的装备升了一档，商人收你的东西多付五分之一。",
    ChineseTraditional:
      "你的名聲先你一步到場。巢穴回填得更快也更滿，從前根本不會出現的小隊開始冒頭，藏貨點裡的裝備升了一檔，商人收你的東西多付五分之一。",
    Japanese:
      "名前が先に届く。巣はより速く、より多く埋まり、以前は現れなかった分隊が姿を見せる。隠し場所の装備は一段上がり、商人は売り物に五分の一多く払う。",
    Korean:
      "이름이 너보다 먼저 도착한다. 소굴은 더 빠르고 더 빽빽하게 다시 채워지고, 전에는 나타나지 않던 분대가 등장하며, 은닉처의 장비는 한 등급 올라가고, 상인은 네가 파는 모든 것에 5분의 1을 더 준다.",
  },
  "ERank::Master": {
    English:
      "You are a name in the Zone. The worst it can send is cleared to spawn against you, emptied lairs refill almost as fast as you clear them, the best gear finally shows up in stashes, and traders pay a quarter more and charge a tenth less.",
    Ukrainian:
      "Ти - ім'я в Зоні. Проти тебе випускають найгірше, що вона має, спустошені лігва заповнюються майже так само швидко, як ти їх вичищаєш, у схованках нарешті трапляється найкраще майно, а торговці платять на четвертину більше й беруть на десяту частину менше.",
    German:
      "Du bist ein Name in der Zone. Gegen dich wird das Schlimmste losgelassen, was sie hat, geleerte Nester füllen sich fast so schnell, wie du sie räumst, in Verstecken liegt endlich das beste Zeug, und Händler zahlen ein Viertel mehr und verlangen ein Zehntel weniger.",
    French:
      "Tu es un nom dans la Zone. Elle lâche contre toi ce qu'elle a de pire, les nids vidés se remplissent presque aussi vite que tu les nettoies, le meilleur matériel apparaît enfin dans les caches, et les marchands paient un quart de plus et facturent un dixième de moins.",
    SpanishEuropean:
      "Eres un nombre en la Zona. Contra ti se suelta lo peor que tiene, las madrigueras vaciadas se llenan casi tan rápido como las limpias, el mejor equipo aparece por fin en los escondrijos, y los comerciantes pagan un cuarto más y cobran un décimo menos.",
    Italian:
      "Sei un nome nella Zona. Contro di te viene mandato il peggio che ha, le tane svuotate si riempiono quasi alla velocità con cui le ripulisci, nei nascondigli compare finalmente il meglio, e i mercanti pagano un quarto in più e chiedono un decimo in meno.",
    Polish:
      "Jesteś w Zonie nazwiskiem. Puszczają na ciebie najgorsze, co ma, opróżnione legowiska zapełniają się prawie tak szybko, jak je czyścisz, w skrytkach trafia się w końcu najlepszy sprzęt, a handlarze płacą o ćwierć więcej i biorą o dziesiątą część mniej.",
    Czech:
      "V Zóně jsi jméno. Pouštějí na tebe to nejhorší, co má, vyprázdněná doupata se plní skoro tak rychle, jak je čistíš, ve skrýších se konečně objevuje to nejlepší a obchodníci platí o čtvrtinu víc a chtějí o desetinu méně.",
    Turkish:
      "Bölge'de artık bir isimsin. Sana karşı elindeki en kötüsü salınıyor, boşalttığın inler neredeyse temizlediğin hızda doluyor, zulalarda sonunda en iyi teçhizat çıkıyor, tüccarlar çeyrek fazla ödeyip onda bir eksik istiyor.",
    Serbian:
      "Ти си име у Зони. На тебе пуштају најгоре што има, испражњене јазбине се пуне готово онолико брзо колико их чистиш, у скровиштима се напокон појављује најбоља опрема, а трговци плаћају четврт више и траже десетину мање.",
    PortugalBrazilian:
      "Você é um nome na Zona. Contra você soltam o pior que ela tem, os covis esvaziados se enchem quase na velocidade em que você os limpa, o melhor equipamento finalmente aparece nos esconderijos, e os comerciantes pagam um quarto mais e cobram um décimo menos.",
    SpanishLatinoAmerican:
      "Eres un nombre en la Zona. Contra ti se suelta lo peor que tiene, las madrigueras vaciadas se llenan casi tan rápido como las limpias, el mejor equipo aparece por fin en los escondrijos, y los comerciantes pagan un cuarto más y cobran un décimo menos.",
    Arabic:
      "صرت اسمًا في المنطقة. يُطلق عليك أسوأ ما لديها، والأوجار التي تفرغها تعود تمتلئ بسرعة تكاد تساوي سرعة تنظيفك لها، وأفضل العتاد يظهر أخيرًا في المخابئ، والتجار يدفعون رُبعًا أكثر ويطلبون عُشرًا أقل.",
    ChineseSimplified:
      "你在区域里已是个名号。它把最凶的东西放出来对付你，被清空的巢穴几乎你刚扫完就又填满，最好的装备终于出现在藏货点里，商人多付四分之一、少收十分之一。",
    ChineseTraditional:
      "你在區域裡已是個名號。它把最凶的東西放出來對付你，被清空的巢穴幾乎你剛掃完就又填滿，最好的裝備終於出現在藏貨點裡，商人多付四分之一、少收十分之一。",
    Japanese:
      "お前はゾーンで名の通った男だ。最悪のものが解き放たれ、空にした巣は掃除する速さとほぼ同じで埋まり直す。隠し場所にはついに最上の装備が現れ、商人は四分の一多く払い、十分の一安く売る。",
    Korean:
      "너는 이제 존에서 이름난 자다. 존은 가진 것 중 가장 흉악한 것을 풀어놓고, 비운 소굴은 네가 치우는 속도와 거의 같게 다시 채워지며, 은닉처에는 드디어 최상급 장비가 나오고, 상인은 4분의 1을 더 주고 10분의 1을 덜 받는다.",
  },
} as Record<ERank, TemplateByLanguage>;

/**
 * `ERank` display names; `{r}` in the templates above. Cast rather than annotated, as
 * `transformKeyItemPrototypes` does: `ERank` also contains the engine's comma-joined
 * multi-rank members, which no per-rank table ever wants keys for.
 */
const RANK_NAMES = {
  "ERank::Newbie": {
    English: "Newbie",
    Ukrainian: "Новачок",
    German: "Anfänger",
    French: "Bleu",
    SpanishEuropean: "Novato",
    Italian: "Novellino",
    Polish: "Nowicjusz",
    Czech: "Nováček",
    Turkish: "Çaylak",
    Serbian: "Новајлија",
    PortugalBrazilian: "Novato",
    SpanishLatinoAmerican: "Novato",
    Arabic: "مبتدئ",
    ChineseSimplified: "新手",
    ChineseTraditional: "新手",
    Japanese: "新人",
    Korean: "신입",
  },
  "ERank::Experienced": {
    English: "Experienced",
    Ukrainian: "Досвідчений",
    German: "Erfahrener",
    French: "Expérimenté",
    SpanishEuropean: "Experimentado",
    Italian: "Esperto",
    Polish: "Doświadczony",
    Czech: "Zkušený",
    Turkish: "Deneyimli",
    Serbian: "Искусни",
    PortugalBrazilian: "Experiente",
    SpanishLatinoAmerican: "Experimentado",
    Arabic: "متمرّس",
    ChineseSimplified: "老手",
    ChineseTraditional: "老手",
    Japanese: "熟練者",
    Korean: "숙련자",
  },
  "ERank::Veteran": {
    English: "Veteran",
    Ukrainian: "Ветеран",
    German: "Veteran",
    French: "Vétéran",
    SpanishEuropean: "Veterano",
    Italian: "Veterano",
    Polish: "Weteran",
    Czech: "Veterán",
    Turkish: "Kıdemli",
    Serbian: "Ветеран",
    PortugalBrazilian: "Veterano",
    SpanishLatinoAmerican: "Veterano",
    Arabic: "مخضرم",
    ChineseSimplified: "老兵",
    ChineseTraditional: "老兵",
    Japanese: "ベテラン",
    Korean: "베테랑",
  },
  "ERank::Master": {
    English: "Master",
    Ukrainian: "Майстер",
    German: "Meister",
    French: "Maître",
    SpanishEuropean: "Maestro",
    Italian: "Maestro",
    Polish: "Mistrz",
    Czech: "Mistr",
    Turkish: "Üstat",
    Serbian: "Мајстор",
    PortugalBrazilian: "Mestre",
    SpanishLatinoAmerican: "Maestro",
    Arabic: "خبير",
    ChineseSimplified: "大师",
    ChineseTraditional: "大師",
    Japanese: "マスター",
    Korean: "마스터",
  },
} as Record<ERank, TemplateByLanguage>;

/**
 * Name of a pickup that only exists to be converted into XP. `{n}` is the amount. Deliberately the
 * same in every language: it is a number and the game's own "XP" shorthand, and it has to stay
 * readable in the one-line pickup toast.
 */
const XP_NAME: TemplateByLanguage = { English: "+{n} XP" };

/** Description of an XP pickup; `{n}` is the amount it is worth. */
const XP_DESCRIPTION: TemplateByLanguage = {
  English: "Worth {n} XP toward your next level. Counted the moment you pick it up.",
  Ukrainian: "Дає {n} XP до наступного рівня. Зараховується щойно ти його підбираєш.",
  German: "{n} XP für die nächste Stufe. Wird beim Aufheben sofort angerechnet.",
  French: "Vaut {n} XP pour ton prochain niveau. Comptabilisé dès le ramassage.",
  SpanishEuropean: "Vale {n} XP para tu siguiente nivel. Se cuenta en cuanto lo recoges.",
  Italian: "Vale {n} XP per il prossimo livello. Conteggiato nel momento in cui lo raccogli.",
  Polish: "Daje {n} XP do następnego poziomu. Liczy się w chwili podniesienia.",
  Czech: "Má hodnotu {n} XP k dalšímu levelu. Započítá se v okamžiku sebrání.",
  Turkish: "Sonraki seviye için {n} XP değerinde. Aldığın anda sayılır.",
  Serbian: "Вреди {n} XP до следећег нивоа. Рачуна се чим га подигнеш.",
  PortugalBrazilian:
    "Vale {n} XP para o próximo nível. Contabilizado no momento em que você o pega.",
  SpanishLatinoAmerican: "Vale {n} XP para tu siguiente nivel. Se cuenta en cuanto lo recoges.",
  Arabic: "يساوي {n} نقطة خبرة نحو مستواك التالي. يُحتسب لحظة التقاطه.",
  ChineseSimplified: "价值 {n} 点经验，计入下一级进度。拾取的瞬间即刻结算。",
  ChineseTraditional: "價值 {n} 點經驗，計入下一級進度。拾取的瞬間即刻結算。",
  Japanese: "次のレベルへ{n}XP分。拾った瞬間に加算される。",
  Korean: "다음 레벨까지 {n} XP에 해당한다. 줍는 즉시 반영된다.",
};

/** Name and description for one XP pickup SID. */
const xpLocalization = (sid: string, xp: number) =>
  itemLocalization(sid, { name: XP_NAME, description: XP_DESCRIPTION }, { n: String(xp) });

/** Every entry this mod's text asset holds. */
export const decoupledRanksLocalization = () => [
  ...itemLocalization(LEVEL_COUNTER_ITEM_SID, {
    name: LEVEL_NAME,
    description: LEVEL_DESCRIPTION,
  }),
  ...Object.entries(RANK_INDICATOR_ITEM_SIDS).flatMap(([rank, sid]) =>
    itemLocalization(
      sid,
      { name: RANK_NAME, description: RANK_DESCRIPTIONS[rank as ERank] },
      { r: RANK_NAMES[rank as ERank] },
    ),
  ),
  // The quest patch of a faction is worth that faction's NPC rank in XP; the quest mutant part is
  // worth the amount its definition carries. Both are read from the same tables the quest graph's
  // XP nodes use, so the text can never claim an amount the graph does not award.
  ...FactionPatchDefinitions.flatMap(({ SID, Faction }) => xpLocalization(SID, NPCRank[Faction])),
  ...MutantLootDefinitions.flatMap(({ questSID, xp }) => xpLocalization(questSID, xp)),
  ...onNonQuestSIDs(factionPatchLocalization()),
];

/**
 * Re-keys the per-faction patch entries onto the non-quest SIDs - the patch the player keeps -
 * leaving the template prototype's own entries where they are. The quest SIDs carry the XP text
 * written above instead.
 */
const onNonQuestSIDs = (entries: LocalizedTextEntry[]): LocalizedTextEntry[] => {
  const nonQuestBySID = new Map<string, string>(
    FactionPatchDefinitions.map(({ SID }) => [SID, getNonQuestFactionPatchSID(SID)]),
  );
  return entries.map((entry) => {
    const [, sid, suffix] = entry.SID.match(/^sid_items_(.+)_(name|description)$/) ?? [];
    const nonQuestSID = sid === undefined ? undefined : nonQuestBySID.get(sid);
    return nonQuestSID ? { ...entry, SID: `sid_items_${nonQuestSID}_${suffix}` } : entry;
  });
};

/**
 * Rewrites the mod's text asset with the complete entry list. Idempotent: everything is derived
 * from the item definitions, so the bytes only change when an item or a translation does.
 */
export const writeDecoupledRanksLocalization = () =>
  writeModLocalization(import.meta.url, decoupledRanksLocalization(), "DecoupledRanks-Localization2");
