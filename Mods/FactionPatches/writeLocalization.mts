/**
 * Regenerates `raw/Stalker2/Content/FactionPatches-Localization3.uasset` from the faction patch
 * definitions: one `sid_items_<SID>_name` / `sid_items_<SID>_description` pair per patch, in every
 * language the SDK's `ELocalizationLanguage` enum offers.
 *
 * Faction proper names are left in their English (game-canonical) form in every language except
 * Ukrainian, where the series' own established names exist. Only the surrounding words are
 * translated - guessing an official per-language rendering of "Duty" or "The Ward" would be worse
 * than leaving the name the player already sees on the faction wheel.
 *
 * The language list, the `{f}` substitution and the write step live in
 * `src/localization/text.mts`; the Russian slot is served Ukrainian text there.
 *
 * Not runnable on its own: the only entry point is `writeFactionPatchLocalization()`, called from
 * the `addFactionPatchItems` transformer, so the asset is only ever rewritten as part of a
 * `prepare-configs` run. `factionPatchLocalization()` is exported separately because DecoupledRanks
 * ships the same patches and so needs the same entries in its own text asset.
 */
import {
  itemLocalization,
  writeModLocalization,
  type TemplateByLanguage,
} from "../../src/localization/text.mts";
import { FactionPatchDefinitions, FactionPatchSID } from "./addFactionPatchItems.mts";
import type { CoreFaction } from "../../src/consts.mts";
import type { LocalizedTextEntry } from "../../src/localization/uasset.mts";

/**
 * Faction display names. `English` is what the game itself shows (`sid_misc_faction_*`), and every
 * language falls back to it; `Ukrainian` overrides with the series' own names.
 */
const FACTION_NAMES: Record<CoreFaction | typeof FactionPatchSID, TemplateByLanguage> = {
  Bandits: { English: "Bandit", Ukrainian: "бандитів" },
  Corpus: { English: "Corps", Ukrainian: "«Корпусу»" },
  Duty: { English: "Duty", Ukrainian: "«Долгу»" },
  FreeStalkers: {
    English: "Free Stalker",
    Ukrainian: "вільних сталкерів",
  },
  Freedom: { English: "Freedom", Ukrainian: "«Волі»" },
  Mercenaries: { English: "Mercenary", Ukrainian: "найманців" },
  Militaries: { English: "IPSF", Ukrainian: "МСОП" },
  Monolith: { English: "Monolith", Ukrainian: "«Моноліту»" },
  Neutrals: {
    English: "Lone Stalker",
    Ukrainian: "сталкерів-одинаків",
  },
  Noon: { English: "Noontide", Ukrainian: "«Полудня»" },
  Scientists: { English: "Scientist", Ukrainian: "учених" },
  Spark: { English: "Spark", Ukrainian: "«Іскри»" },
  Varta: { English: "Ward", Ukrainian: "«Варти»" },
  Mutant: { English: "Mutant", Ukrainian: "мутантів" },
  // Spelled out rather than `[FactionPatchSID]`: addFactionPatchItems.mts imports this module, so
  // a computed key would read that binding while it is still in its TDZ. The key type below is
  // `typeof FactionPatchSID`, so a rename still fails to compile.
  FactionPatch: { English: "Faction", Ukrainian: "фракції" },
};

/** `{f}` is the faction name from `FACTION_NAMES`. */
const NAME_TEMPLATE: TemplateByLanguage = {
  English: "{f} Patch",
  Ukrainian: "Шеврон {f}",
  German: "{f}-Abzeichen",
  French: "Écusson {f}",
  SpanishEuropean: "Parche de {f}",
  Italian: "Toppa {f}",
  Polish: "Naszywka {f}",
  Czech: "Nášivka {f}",
  Turkish: "{f} Arması",
  Serbian: "Ознака „{f}“",
  PortugalBrazilian: "Emblema {f}",
  SpanishLatinoAmerican: "Parche de {f}",
  Arabic: "شعار {f}",
  ChineseSimplified: "{f}臂章",
  ChineseTraditional: "{f}臂章",
  Japanese: "{f}のパッチ",
  Korean: "{f} 패치",
};

const DESCRIPTION_TEMPLATE: TemplateByLanguage = {
  English:
    "A cloth patch bearing the {f} emblem. Proof of allegiance to its wearer, a trophy to everyone else.",
  Ukrainian: "Нашивка з емблемою {f}. Для власника - знак приналежності, для решти - трофей.",
  German:
    "Ein Stoffabzeichen mit dem Emblem der Fraktion {f}. Für den Träger ein Zeichen der Zugehörigkeit, für alle anderen eine Trophäe.",
  French:
    "Un écusson en tissu portant l'emblème de {f}. Un signe d'allégeance pour son porteur, un trophée pour les autres.",
  SpanishEuropean:
    "Un parche de tela con el emblema de {f}. Para quien lo lleva es señal de lealtad; para los demás, un trofeo.",
  Italian:
    "Una toppa di stoffa con l'emblema di {f}. Per chi la indossa è un segno di appartenenza, per tutti gli altri un trofeo.",
  Polish:
    "Materiałowa naszywka z godłem frakcji {f}. Dla właściciela znak przynależności, dla innych trofeum.",
  Czech:
    "Textilní nášivka s emblémem frakce {f}. Pro nositele znak příslušnosti, pro ostatní trofej.",
  Turkish:
    "{f} amblemini taşıyan bez arma. Taşıyanı için bağlılık işareti, diğerleri için ganimet.",
  Serbian:
    "Платнена ознака са амблемом фракције {f}. Носиоцу знак припадности, свима другима трофеј.",
  PortugalBrazilian:
    "Um emblema de tecido com o símbolo de {f}. Para quem o usa, sinal de lealdade; para os outros, um troféu.",
  SpanishLatinoAmerican:
    "Un parche de tela con el emblema de {f}. Para quien lo lleva es señal de lealtad; para los demás, un trofeo.",
  Arabic: "شعار من القماش يحمل رمز {f}. دليل انتماء لمن يحمله، وغنيمة لغيره.",
  ChineseSimplified: "绣有{f}徽记的布制臂章。对佩戴者是归属的证明，对其他人只是战利品。",
  ChineseTraditional: "繡有{f}徽記的布製臂章。對佩戴者是歸屬的證明，對其他人只是戰利品。",
  Japanese: "{f}の紋章が入った布製のパッチ。持ち主には所属の証、他の者には戦利品にすぎない。",
  Korean: "{f} 문장이 새겨진 천 패치. 착용자에게는 소속의 증표, 그 외에는 전리품일 뿐이다.",
};

/**
 * Per-faction patch descriptions. Each says something only that faction's patch could say - who
 * wore it, what they answered to, what they lost - drawn from the Ukrainian faction almanac on
 * lorebase.info (`/api/almanach?lang=uk`). A faction without an entry here falls back to the
 * generic `DESCRIPTION_TEMPLATE` above.
 */
const FACTION_DESCRIPTIONS = {
  Bandits: {
    English:
      "Torn off a jacket that has changed owners more than once. Its wearer answered to a bugor out on the Garbage and cared about nothing but the price of your kit.",
    Ukrainian:
      "Зірваний з куртки, що не раз змінювала власника. Її господар слухався якогось бугра на Смітнику й цікавився лише тим, скільки коштує твоє снаряження.",
    German:
      "Von einer Jacke gerissen, die schon mehr als einen Besitzer hatte. Ihr Träger gehorchte irgendeinem Bugor auf der Müllhalde und interessierte sich nur dafür, was deine Ausrüstung wert ist.",
    French:
      "Arraché d'une veste qui a changé de propriétaire plus d'une fois. Son porteur obéissait à un bougor de la Décharge et ne s'intéressait qu'au prix de ton équipement.",
    SpanishEuropean:
      "Arrancado de una chaqueta que ha cambiado de dueño más de una vez. Quien la llevaba obedecía a algún bugor del Vertedero y solo le importaba cuánto valía tu equipo.",
    Italian:
      "Strappata da un giubbotto che ha cambiato padrone più di una volta. Chi la portava obbediva a un bugor della Discarica e badava solo a quanto valeva il tuo equipaggiamento.",
    Polish:
      "Zdarta z kurtki, która nieraz zmieniała właściciela. Jej posiadacz słuchał jakiegoś bugra na Wysypisku i interesowało go tylko to, ile wart jest twój sprzęt.",
    Czech:
      "Stržená z bundy, která už nejednou změnila majitele. Její nositel poslouchal nějakého bugra na Smetišti a zajímalo ho jen to, kolik stojí tvoje výstroj.",
    Turkish:
      "Birden fazla el değiştirmiş bir montun üzerinden sökülmüş. Sahibi Çöplük'teki bir çete babasının emrindeydi ve yalnızca teçhizatının kaç para ettiğiyle ilgileniyordu.",
    Serbian:
      "Одрана с јакне која је више пута мењала власника. Њен носилац слушао је неког бугра на Сметлишту и занимало га је само колико вреди твоја опрема.",
    PortugalBrazilian:
      "Arrancado de uma jaqueta que já trocou de dono mais de uma vez. Quem a usava obedecia a algum bugor no Lixão e só se importava com quanto valia o seu equipamento.",
    SpanishLatinoAmerican:
      "Arrancado de una chaqueta que ha cambiado de dueño más de una vez. Quien la llevaba obedecía a algún bugor del Vertedero y solo le importaba cuánto valía tu equipo.",
    Arabic:
      "مقطوع من سترة تبدّل أصحابها أكثر من مرة. صاحبها كان يطيع أحد زعماء العصابات في المزبلة، ولا يهمّه سوى ثمن عتادك.",
    ChineseSimplified:
      "从一件几经转手的夹克上撕下来的。它的主人听命于垃圾场的某个匪首，只关心你的装备能卖多少钱。",
    ChineseTraditional:
      "從一件幾經轉手的夾克上撕下來的。它的主人聽命於垃圾場的某個匪首，只關心你的裝備能賣多少錢。",
    Japanese:
      "何度も持ち主が変わった上着から剥ぎ取った物。その持ち主はゴミ捨て場の頭目に従い、お前の装備がいくらになるかしか考えていなかった。",
    Korean:
      "여러 번 주인이 바뀐 재킷에서 떼어낸 것. 그 주인은 쓰레기장의 두목 밑에 있었고, 네 장비가 얼마에 팔릴지에만 관심이 있었다.",
  },
  Corpus: {
    English:
      "Corps colours from the Rubizh line. Degtyarev's men hold Pripyat and its secrets, and pick fights only with bandits, Monolithians and Ward troopers who wander too far north.",
    Ukrainian:
      "Шеврон Корпусу з Рубежу. Бійці Дегтярьова тримають Прип'ять і її таємниці, а воюють лише з бандитами, монолітівцями та вартівцями, що необачно зайшли на їхню територію.",
    German:
      "Corps-Abzeichen von der Rubisch-Linie. Degtjarjows Leute halten Prypjat und seine Geheimnisse und legen sich nur mit Banditen, Monolithanhängern und Ward-Soldaten an, die zu weit nach Norden geraten.",
    French:
      "Écusson du Corps, venu de la ligne Roubij. Les hommes de Degtiarev tiennent Pripiat et ses secrets, et ne s'en prennent qu'aux bandits, aux Monolithiens et aux soldats de la Garde qui montent trop au nord.",
    SpanishEuropean:
      "Emblema del Cuerpo, de la línea Rubizh. Los hombres de Degtyarev guardan Prípiat y sus secretos, y solo pelean con bandidos, monolitianos y soldados de la Guardia que se adentran demasiado al norte.",
    Italian:
      "Toppa del Corpo, dalla linea Rubizh. Gli uomini di Degtyarev tengono Pripyat e i suoi segreti, e se la prendono solo con banditi, monolitiani e soldati della Guardia che salgono troppo a nord.",
    Polish:
      "Naszywka Korpusu z linii Rubież. Ludzie Diegtiariowa trzymają Prypeć i jej sekrety, a zadzierają tylko z bandytami, monolitowcami i wartowcami, którzy zapuszczą się za daleko na północ.",
    Czech:
      "Nášivka Korpusu z linie Rubiž. Děgťarjovovi lidé drží Pripjať a její tajemství a pouštějí se jen do banditů, monolitovců a vartovců, kteří zajdou příliš na sever.",
    Turkish:
      "Rubij hattından bir Kolordu arması. Degtyarev'in adamları Pripyat'ı ve sırlarını tutuyor; yalnızca kuzeye fazla sokulan haydutlar, Monolit yanlıları ve Muhafız askerleriyle çatışıyorlar.",
    Serbian:
      "Ознака Корпуса са линије Рубеж. Дегтјарјовљеви људи држе Припјат и његове тајне, а сукобљавају се само с бандитима, монолитовцима и вартовцима који зађу предалеко на север.",
    PortugalBrazilian:
      "Emblema do Corpo, da linha Rubizh. Os homens de Degtyarev guardam Pripyat e seus segredos, e só brigam com bandidos, monolitianos e soldados da Guarda que sobem demais ao norte.",
    SpanishLatinoAmerican:
      "Emblema del Cuerpo, de la línea Rubizh. Los hombres de Degtyarev guardan Prípiat y sus secretos, y solo pelean con bandidos, monolitianos y soldados de la Guardia que se adentran demasiado al norte.",
    Arabic:
      "شعار الفيلق من خط روبيج. رجال ديغتياريف يحرسون بريبيات وأسرارها، ولا يقاتلون إلا العصابات وأتباع المونوليث وجنود الحرس الذين يتوغلون شمالًا أكثر من اللازم.",
    ChineseSimplified:
      "来自「边界线」的军团臂章。捷格佳廖夫的人守着普里皮亚季和它的秘密，只与土匪、石碑教徒和越界北上的守卫军交手。",
    ChineseTraditional:
      "來自「邊界線」的軍團臂章。捷格佳廖夫的人守著普里皮亞季和它的祕密，只與土匪、石碑教徒和越界北上的守衛軍交手。",
    Japanese:
      "ルビージ線から持ち出された軍団のパッチ。デグチャレフの部隊はプリピャチとその秘密を守り、盗賊、モノリス信者、そして北へ踏み込みすぎたワードの兵にしか手を出さない。",
    Korean:
      "루비즈 방어선에서 나온 군단 패치. 데그차료프의 병사들은 프리피야트와 그 비밀을 지키며, 산적과 모놀리스 신도, 북쪽으로 너무 들어온 와드 병사만 상대한다.",
  },
  Duty: {
    English:
      "Duty colours, worn by men who hold that the Zone must be wiped off the map. Their mutant raids have saved more lone stalkers than Duty would ever admit.",
    Ukrainian:
      "Шеврон Долгу - його носять ті, хто вважає, що Зону треба знищити. Їхні рейди на мутантів урятували більше одинаків, ніж Долг колись визнає.",
    German:
      "Duty-Abzeichen, getragen von Leuten, für die die Zone von der Karte verschwinden muss. Ihre Mutantenjagden haben mehr Einzelgänger gerettet, als Duty je zugeben würde.",
    French:
      "Écusson de Duty, porté par ceux qui estiment que la Zone doit être rayée de la carte. Leurs raids contre les mutants ont sauvé plus de solitaires que Duty ne l'admettra jamais.",
    SpanishEuropean:
      "Emblema de Duty, de quienes sostienen que la Zona debe borrarse del mapa. Sus redadas contra mutantes han salvado a más solitarios de los que Duty admitirá jamás.",
    Italian:
      "Toppa di Duty, portata da chi ritiene che la Zona vada cancellata dalla mappa. Le loro battute ai mutanti hanno salvato più solitari di quanti Duty ammetterà mai.",
    Polish:
      "Naszywka Duty, noszona przez tych, którzy uważają, że Zonę trzeba zetrzeć z mapy. Ich rajdy na mutanty uratowały więcej samotników, niż Duty kiedykolwiek przyzna.",
    Czech:
      "Nášivka Duty, kterou nosí ti, podle nichž musí Zóna zmizet z mapy. Jejich výpady na mutanty zachránily víc samotářů, než kdy Duty přizná.",
    Turkish:
      "Bölge'nin haritadan silinmesi gerektiğine inananların taşıdığı bir Duty arması. Mutant baskınları, Duty'nin kabul edeceğinden çok daha fazla yalnız stalker kurtardı.",
    Serbian:
      "Ознака Дужности, коју носе они који сматрају да Зону треба збрисати с карте. Њихови походи на мутанте спасли су више самаца него што ће Дужност икада признати.",
    PortugalBrazilian:
      "Emblema do Duty, usado por quem acha que a Zona deve ser apagada do mapa. Suas incursões contra mutantes salvaram mais solitários do que o Duty jamais vai admitir.",
    SpanishLatinoAmerican:
      "Emblema de Duty, de quienes sostienen que la Zona debe borrarse del mapa. Sus redadas contra mutantes han salvado a más solitarios de los que Duty admitirá jamás.",
    Arabic:
      "شعار الواجب، يحمله من يرى أن المنطقة يجب أن تُمحى من الخريطة. حملاتهم على المتحوّلين أنقذت من الوحيدين أكثر مما سيعترف به الواجب يومًا.",
    ChineseSimplified:
      "义务的臂章，戴着它的人认为区域必须从地图上抹去。他们清剿变异体的行动救过的独行者，比义务愿意承认的多得多。",
    ChineseTraditional:
      "義務的臂章，戴著它的人認為區域必須從地圖上抹去。他們清剿變異體的行動救過的獨行者，比義務願意承認的多得多。",
    Japanese:
      "ゾーンは地図から消すべきだと信じる者たちのデューティのパッチ。彼らのミュータント掃討は、デューティ自身が認める以上に多くの一匹狼を救ってきた。",
    Korean:
      "존은 지도에서 지워져야 한다고 믿는 자들의 듀티 패치. 그들의 돌연변이 소탕은 듀티가 인정하는 것보다 훨씬 많은 외톨이를 살렸다.",
  },
  FreeStalkers: {
    English:
      "Nobody hands these out. Free stalkers are the largest crowd in the Zone and the least organised - everyone here answers only to himself.",
    Ukrainian:
      "Такі шеврони ніхто не видає. Вільні сталкери - найчисленніші в Зоні й найменш організовані: кожен тут відповідає лише за себе.",
    German:
      "Die gibt niemand aus. Freie Stalker sind die größte und die unorganisierteste Menge der Zone - jeder hier hat nur sich selbst zu gehorchen.",
    French:
      "Personne ne distribue ceux-là. Les stalkers libres sont les plus nombreux de la Zone et les moins organisés : ici, chacun ne répond que de lui-même.",
    SpanishEuropean:
      "Estos no los reparte nadie. Los stalkers libres son los más numerosos de la Zona y los menos organizados: aquí cada uno responde solo ante sí mismo.",
    Italian:
      "Queste non le distribuisce nessuno. Gli stalker liberi sono i più numerosi della Zona e i meno organizzati: qui ognuno risponde solo a se stesso.",
    Polish:
      "Takich nikt nie wydaje. Wolni stalkerzy są najliczniejsi w Zonie i najmniej zorganizowani - każdy odpowiada tu tylko przed sobą.",
    Czech:
      "Tyhle nikdo nerozdává. Volní stalkeři jsou v Zóně nejpočetnější a nejméně organizovaní - každý se tu zodpovídá jen sám sobě.",
    Turkish:
      "Bunları kimse dağıtmaz. Özgür stalker'lar Bölge'nin en kalabalık ve en örgütsüz topluluğu - burada herkes yalnızca kendine hesap verir.",
    Serbian:
      "Овакве нико не издаје. Слободни сталкери су најмногобројнији у Зони и најмање организовани - овде свако одговара само себи.",
    PortugalBrazilian:
      "Esses ninguém distribui. Os stalkers livres são os mais numerosos da Zona e os menos organizados: aqui cada um responde só a si mesmo.",
    SpanishLatinoAmerican:
      "Estos no los reparte nadie. Los stalkers libres son los más numerosos de la Zona y los menos organizados: aquí cada uno responde solo ante sí mismo.",
    Arabic:
      "لا أحد يوزّع هذه. الستالكرات الأحرار هم الأكثر عددًا في المنطقة والأقل تنظيمًا - كل واحد هنا لا يحاسبه إلا نفسه.",
    ChineseSimplified:
      "这种臂章没人发。自由潜行者是区域里人数最多、也最没组织的一群——在这儿每个人只对自己负责。",
    ChineseTraditional:
      "這種臂章沒人發。自由潛行者是區域裡人數最多、也最沒組織的一群——在這兒每個人只對自己負責。",
    Japanese:
      "これを配る者はいない。フリーストーカーはゾーンで最も数が多く、最もまとまりがない。ここでは誰もが自分にだけ責任を負う。",
    Korean:
      "이런 건 누구도 나눠 주지 않는다. 자유 스토커는 존에서 가장 수가 많고 가장 조직되지 않은 무리다. 여기서는 각자 자기 자신에게만 책임을 진다.",
  },
  Freedom: {
    English:
      "Freedom colours: anarchists on the outside, a strict chain of command underneath. Since Myklukha's coupons they have been the richest faction in the Zone - and the most divided.",
    Ukrainian:
      "Шеврон Волі: назовні - анархісти, а всередині - чітка ієрархія. Після того, як Миклуха ввів купони, вони стали найзаможнішою фракцією Зони - і найбільш розколотою.",
    German:
      "Freedom-Abzeichen: nach außen Anarchisten, darunter eine strikte Befehlskette. Seit Mykluchas Kupons sind sie die reichste Fraktion der Zone - und die zerrissenste.",
    French:
      "Écusson de Freedom : des anarchistes en façade, une hiérarchie stricte en dessous. Depuis les coupons de Mykloukha, c'est la faction la plus riche de la Zone - et la plus divisée.",
    SpanishEuropean:
      "Emblema de Freedom: anarquistas por fuera, una jerarquía estricta por dentro. Desde los cupones de Myklukha son la facción más rica de la Zona, y la más dividida.",
    Italian:
      "Toppa di Freedom: anarchici in facciata, gerarchia rigida sotto. Dai coupon di Myklukha sono la fazione più ricca della Zona - e la più divisa.",
    Polish:
      "Naszywka Freedom: na zewnątrz anarchiści, pod spodem twarda hierarchia. Od kuponów Miklucha są najbogatszą frakcją Zony - i najbardziej podzieloną.",
    Czech:
      "Nášivka Freedom: navenek anarchisté, pod tím tvrdá hierarchie. Od Mykluchových kuponů jsou nejbohatší frakcí Zóny - a nejrozdělenější.",
    Turkish:
      "Freedom arması: dışarıdan anarşist, altında sıkı bir emir zinciri. Myklukha'nın kuponlarından beri Bölge'nin en zengin - ve en bölünmüş - hizbi onlar.",
    Serbian:
      "Ознака Слободе: споља анархисти, испод строга хијерархија. Од Миклухиних купона они су најбогатија фракција Зоне - и најподељенија.",
    PortugalBrazilian:
      "Emblema do Freedom: anarquistas por fora, uma hierarquia rígida por dentro. Desde os cupons de Myklukha são a facção mais rica da Zona - e a mais dividida.",
    SpanishLatinoAmerican:
      "Emblema de Freedom: anarquistas por fuera, una jerarquía estricta por dentro. Desde los cupones de Myklukha son la facción más rica de la Zona, y la más dividida.",
    Arabic:
      "شعار الحرية: فوضويون في الظاهر، وتسلسل قيادي صارم في الباطن. منذ كوبونات ميكلوخا صاروا أغنى فصائل المنطقة - وأكثرها انقسامًا.",
    ChineseSimplified:
      "自由的臂章：表面是无政府主义者，底下是严格的指挥体系。自米克鲁哈发行票券以来，他们成了区域最富的派系——也是最分裂的。",
    ChineseTraditional:
      "自由的臂章：表面是無政府主義者，底下是嚴格的指揮體系。自米克魯哈發行票券以來，他們成了區域最富的派系——也是最分裂的。",
    Japanese:
      "フリーダムのパッチ。表向きは無政府主義者、その下には厳格な指揮系統がある。ミクルーハがクーポンを流してから、ゾーンで最も豊かで、最も分裂した派閥だ。",
    Korean:
      "프리덤 패치. 겉으로는 무정부주의자, 그 아래에는 엄격한 지휘 체계. 미클루하의 쿠폰 이후 존에서 가장 부유한, 그리고 가장 분열된 진영이 되었다.",
  },
  Mercenaries: {
    English:
      "Mercenary colours. They take contracts from anyone who pays and trust no faction - least of all the Ward, which once gunned them down at a «negotiation».",
    Ukrainian:
      "Шеврон найманців. Вони беруть контракти від будь-кого, хто платить, і не довіряють жодній фракції - а «Варті», яка колись розстріляла їх на перемовинах, найменше.",
    German:
      "Söldner-Abzeichen. Sie nehmen Aufträge von jedem, der zahlt, und trauen keiner Fraktion - der Ward am wenigsten, die sie einst bei «Verhandlungen» niederschoss.",
    French:
      "Écusson de mercenaire. Ils acceptent les contrats de quiconque paie et ne font confiance à aucune faction - surtout pas à la Garde, qui les a fauchés lors d'une «négociation».",
    SpanishEuropean:
      "Emblema mercenario. Aceptan contratos de cualquiera que pague y no confían en ninguna facción, menos aún en la Guardia, que los acribilló en una «negociación».",
    Italian:
      "Toppa dei mercenari. Accettano contratti da chiunque paghi e non si fidano di nessuna fazione - meno che mai della Guardia, che li falciò durante una «trattativa».",
    Polish:
      "Naszywka najemników. Biorą kontrakty od każdego, kto płaci, i nie wierzą żadnej frakcji - najmniej Warcie, która wystrzelała ich na «rozmowach».",
    Czech:
      "Nášivka žoldáků. Berou kontrakty od každého, kdo platí, a nevěří žádné frakci - nejméně Vartě, která je postřílela při «vyjednávání».",
    Turkish:
      "Paralı asker arması. Parayı verenden iş alırlar ve hiçbir hizbe güvenmezler - en az da bir «görüşme»de onları biçen Muhafızlara.",
    Serbian:
      "Ознака плаћеника. Прихватају послове од свакога ко плати и не верују ни једној фракцији - најмање Варти, која их је покосила на «преговорима».",
    PortugalBrazilian:
      "Emblema mercenário. Aceitam contratos de quem pagar e não confiam em facção alguma - muito menos na Guarda, que os fuzilou numa «negociação».",
    SpanishLatinoAmerican:
      "Emblema mercenario. Aceptan contratos de cualquiera que pague y no confían en ninguna facción, menos aún en la Guardia, que los acribilló en una «negociación».",
    Arabic:
      "شعار المرتزقة. يقبلون العقود من كل من يدفع ولا يثقون بأي فصيل - وأقلهم ثقةً الحرس الذي حصدهم في «مفاوضات».",
    ChineseSimplified:
      "雇佣兵的臂章。谁付钱就替谁干活，对哪个派系都不信——最不信守卫军，那伙人曾在一次「谈判」上把他们成排射倒。",
    ChineseTraditional:
      "傭兵的臂章。誰付錢就替誰幹活，對哪個派系都不信——最不信守衛軍，那伙人曾在一次「談判」上把他們成排射倒。",
    Japanese:
      "傭兵のパッチ。金を出す者の仕事を受け、どの派閥も信じない――「交渉」の席で彼らを撃ち倒したワードは、なおさらだ。",
    Korean:
      "용병 패치. 돈을 내는 자의 일을 맡고 어떤 진영도 믿지 않는다 - 「협상」 자리에서 그들을 쓸어버린 와드는 특히.",
  },
  Militaries: {
    English:
      "IPSF colours - the international cordon on the Perimeter. Since Operation Fairway failed they stopped sending military stalkers inward and left the deep Zone to others.",
    Ukrainian:
      "Шеврон МСОП - міжнародної служби, що тримає Периметр. Після провалу операції «Фарватер» вони припинили посилати військових сталкерів углиб і залишили глибоку Зону іншим.",
    German:
      "IPSF-Abzeichen - der internationale Kordon am Perimeter. Seit dem Scheitern der Operation Fahrwasser schicken sie keine Militärstalker mehr ins Innere und lassen die tiefe Zone anderen.",
    French:
      "Écusson de l'IPSF - le cordon international du Périmètre. Depuis l'échec de l'opération Chenal, ils n'envoient plus de stalkers militaires à l'intérieur et laissent la Zone profonde aux autres.",
    SpanishEuropean:
      "Emblema del IPSF, el cordón internacional del Perímetro. Desde que fracasó la operación Fairway dejaron de enviar stalkers militares al interior y cedieron la Zona profunda a otros.",
    Italian:
      "Toppa dell'IPSF, il cordone internazionale del Perimetro. Dal fallimento dell'operazione Fairway non mandano più stalker militari all'interno e lasciano la Zona profonda ad altri.",
    Polish:
      "Naszywka IPSF - międzynarodowego kordonu na Perymetrze. Od klęski operacji Fairway nie wysyłają już wojskowych stalkerów w głąb i zostawili głęboką Zonę innym.",
    Czech:
      "Nášivka IPSF - mezinárodního kordonu na Perimetru. Od nezdaru operace Fairway už neposílají vojenské stalkery do hloubky a hlubokou Zónu nechali ostatním.",
    Turkish:
      "IPSF arması - Çevre Hattı'ndaki uluslararası kordon. Fairway harekâtı başarısız olduğundan beri içeriye askerî stalker göndermiyor, derin Bölge'yi başkalarına bırakıyorlar.",
    Serbian:
      "Ознака МСОП-а - међународног кордона на Периметру. Од пропасти операције «Фарватер» више не шаљу војне сталкере у дубину и дубоку Зону су оставили другима.",
    PortugalBrazilian:
      "Emblema do IPSF, o cordão internacional do Perímetro. Desde o fracasso da operação Fairway pararam de mandar stalkers militares para dentro e deixaram a Zona profunda para outros.",
    SpanishLatinoAmerican:
      "Emblema del IPSF, el cordón internacional del Perímetro. Desde que fracasó la operación Fairway dejaron de enviar stalkers militares al interior y cedieron la Zona profunda a otros.",
    Arabic:
      "شعار قوة حماية المحيط الدولية على الطوق الخارجي. بعد فشل عملية «الممر» توقفوا عن إرسال الستالكرات العسكريين إلى الداخل وتركوا عمق المنطقة لغيرهم.",
    ChineseSimplified:
      "国际边界警卫队的臂章。自「航道」行动失败后，他们不再往深处派遣军方潜行者，把区域深处留给了别人。",
    ChineseTraditional:
      "國際邊界警衛隊的臂章。自「航道」行動失敗後，他們不再往深處派遣軍方潛行者，把區域深處留給了別人。",
    Japanese:
      "外周を封鎖する国際警備隊のパッチ。「航路」作戦の失敗以降、彼らは軍属ストーカーを奥地へ送るのをやめ、深部を他者に委ねた。",
    Korean:
      "경계선을 지키는 국제 경비대 패치. 「페어웨이」 작전이 실패한 뒤로 그들은 군 소속 스토커를 안쪽으로 보내지 않고, 깊은 존을 다른 이들에게 맡겼다.",
  },
  Monolith: {
    English:
      "Cut off a fanatic. They hold that the Zone must be shielded from outsiders, and their god is not one to argue with.",
    Ukrainian:
      "Зрізаний з фанатика. Вони вважають, що Зону треба захистити від чужих, а з їхнім богом не посперечаєшся.",
    German:
      "Von einem Fanatiker geschnitten. Für sie muss die Zone vor Fremden geschützt werden, und mit ihrem Gott diskutiert man nicht.",
    French:
      "Découpé sur un fanatique. Pour eux, la Zone doit être protégée des étrangers, et on ne discute pas avec leur dieu.",
    SpanishEuropean:
      "Cortado de un fanático. Para ellos la Zona debe protegerse de los forasteros, y con su dios no se discute.",
    Italian:
      "Tagliata da un fanatico. Per loro la Zona va protetta dagli estranei, e col loro dio non si discute.",
    Polish:
      "Odcięta fanatykowi. Uważają, że Zonę trzeba chronić przed obcymi, a z ich bogiem się nie dyskutuje.",
    Czech:
      "Odříznutá fanatikovi. Podle nich je třeba Zónu chránit před cizími a s jejich bohem se nediskutuje.",
    Turkish:
      "Bir fanatikten kesilmiş. Onlara göre Bölge yabancılardan korunmalı ve tanrılarıyla tartışılmaz.",
    Serbian:
      "Одсечена с фанатика. Сматрају да Зону треба заштитити од туђина, а с њиховим богом се не расправља.",
    PortugalBrazilian:
      "Cortado de um fanático. Para eles a Zona precisa ser protegida dos de fora, e com o deus deles não se discute.",
    SpanishLatinoAmerican:
      "Cortado de un fanático. Para ellos la Zona debe protegerse de los forasteros, y con su dios no se discute.",
    Arabic: "مقتطع من متعصّب. يرون أن المنطقة يجب أن تُصان من الغرباء، ولا يُجادَل إلههم.",
    ChineseSimplified: "从一名狂信徒身上割下。他们认定区域必须与外人隔绝，而他们的神不容置辩。",
    ChineseTraditional: "從一名狂信徒身上割下。他們認定區域必須與外人隔絕，而他們的神不容置辯。",
    Japanese:
      "狂信者から切り取った物。ゾーンは余所者から守られねばならないと信じ、その神に異を唱える余地はない。",
    Korean:
      "광신자에게서 잘라낸 것. 그들은 존을 외부인으로부터 지켜야 한다고 믿으며, 그들의 신에게는 반론이 없다.",
  },
  Neutrals: {
    English:
      "Off a loner's jacket. Most of the Zone's legends came out of this crowd, and most of them died before anyone learned their names.",
    Ukrainian:
      "З куртки одинака. З-поміж цих людей вийшла більшість легенд Зони, і більшість із них загинула, поки ніхто ще не знав їхніх імен.",
    German:
      "Von der Jacke eines Einzelgängers. Aus diesen Leuten kamen die meisten Legenden der Zone, und die meisten starben, bevor jemand ihre Namen kannte.",
    French:
      "Pris sur la veste d'un solitaire. La plupart des légendes de la Zone sont sorties de ces rangs, et la plupart sont mortes avant qu'on retienne leur nom.",
    SpanishEuropean:
      "De la chaqueta de un solitario. De esta gente salieron casi todas las leyendas de la Zona, y casi todas murieron antes de que nadie supiera su nombre.",
    Italian:
      "Dal giubbotto di un solitario. Da questa gente sono uscite quasi tutte le leggende della Zona, e quasi tutte sono morte prima che qualcuno ne sapesse il nome.",
    Polish:
      "Z kurtki samotnika. Z tych ludzi wyszła większość legend Zony i większość zginęła, zanim ktokolwiek poznał ich imiona.",
    Czech:
      "Z bundy samotáře. Z těchto lidí vyšla většina legend Zóny a většina z nich zemřela, než někdo poznal jejich jména.",
    Turkish:
      "Bir yalnızın montundan. Bölge'nin efsanelerinin çoğu bu kalabalıktan çıktı ve çoğu, adları öğrenilmeden öldü.",
    Serbian:
      "С јакне самца. Из ових људи изашла је већина легенди Зоне, а већина њих је погинула пре него што им је ико запамтио име.",
    PortugalBrazilian:
      "Da jaqueta de um solitário. Quase todas as lendas da Zona saíram dessa gente, e quase todas morreram antes de alguém saber seus nomes.",
    SpanishLatinoAmerican:
      "De la chaqueta de un solitario. De esta gente salieron casi todas las leyendas de la Zona, y casi todas murieron antes de que nadie supiera su nombre.",
    Arabic:
      "من سترة وحيد. معظم أساطير المنطقة خرجوا من بين هؤلاء، ومعظمهم مات قبل أن يعرف أحد أسماءهم.",
    ChineseSimplified:
      "从一名独行者的夹克上取下。区域里的大多数传奇都出自这群人，而多数人死时还没人知道他们的名字。",
    ChineseTraditional:
      "從一名獨行者的夾克上取下。區域裡的大多數傳奇都出自這群人，而多數人死時還沒人知道他們的名字。",
    Japanese:
      "一匹狼の上着から取った物。ゾーンの伝説の多くはこの層から生まれ、その多くは名を知られる前に死んだ。",
    Korean:
      "외톨이의 재킷에서 떼어낸 것. 존의 전설 대부분이 이 무리에서 나왔고, 그 대부분은 이름이 알려지기도 전에 죽었다.",
  },
  Noon: {
    English:
      "Noontide colours from the Wild Island. Former Monolithians looking for a place in the world again: some follow Brodyaga, others listen to the preacher Faust.",
    Ukrainian:
      "Шеврон Полудня з Дикого острова. Колишні монолітівці, які знову шукають себе у світі: одні йдуть за Бродягою, інші слухають проповідника Фауста.",
    German:
      "Noontide-Abzeichen von der Wilden Insel. Ehemalige Monolithanhänger, die wieder einen Platz in der Welt suchen: die einen folgen Brodjaga, die anderen hören auf den Prediger Faust.",
    French:
      "Écusson de Noontide, de l'Île sauvage. D'anciens Monolithiens qui cherchent de nouveau leur place : certains suivent Brodiaga, d'autres écoutent le prêcheur Faust.",
    SpanishEuropean:
      "Emblema de Noontide, de la Isla Salvaje. Antiguos monolitianos que buscan de nuevo su lugar: unos siguen a Brodyaga, otros escuchan al predicador Faust.",
    Italian:
      "Toppa di Noontide, dall'Isola Selvaggia. Ex monolitiani che cercano di nuovo un posto nel mondo: alcuni seguono Brodyaga, altri ascoltano il predicatore Faust.",
    Polish:
      "Naszywka Noontide z Dzikiej Wyspy. Byli monolitowcy, którzy znów szukają swojego miejsca: jedni idą za Brodiagą, inni słuchają kaznodziei Fausta.",
    Czech:
      "Nášivka Noontide z Divokého ostrova. Bývalí monolitovci, kteří znovu hledají své místo: jedni jdou za Broďagou, druzí poslouchají kazatele Fausta.",
    Turkish:
      "Vahşi Ada'dan bir Noontide arması. Dünyada yeniden yer arayan eski Monolit üyeleri: kimi Brodyaga'nın peşinden gider, kimi vaiz Faust'u dinler.",
    Serbian:
      "Ознака Поднева с Дивљег острва. Некадашњи монолитовци који поново траже своје место: једни иду за Бродјагом, други слушају проповедника Фауста.",
    PortugalBrazilian:
      "Emblema do Noontide, da Ilha Selvagem. Ex-monolitianos à procura de um lugar no mundo outra vez: uns seguem Brodyaga, outros ouvem o pregador Faust.",
    SpanishLatinoAmerican:
      "Emblema de Noontide, de la Isla Salvaje. Antiguos monolitianos que buscan de nuevo su lugar: unos siguen a Brodyaga, otros escuchan al predicador Faust.",
    Arabic:
      "شعار الظهيرة من الجزيرة المتوحشة. أتباع مونوليث سابقون يبحثون عن مكان لهم من جديد: بعضهم يتبع برودياغا، وبعضهم يسمع للواعظ فاوست.",
    ChineseSimplified:
      "来自野岛的正午臂章。曾经的石碑教徒重新寻找自己的位置：有人跟着流浪者，有人听信传教士浮士德。",
    ChineseTraditional:
      "來自野島的正午臂章。曾經的石碑教徒重新尋找自己的位置：有人跟著流浪者，有人聽信傳教士浮士德。",
    Japanese:
      "ワイルド島のヌーンタイドのパッチ。世界での居場所を探し直す元モノリス信者たち。ブロジャーガに従う者もいれば、説教師ファウストに耳を貸す者もいる。",
    Korean:
      "와일드 아일랜드에서 나온 눈타이드 패치. 다시 세상에서 자리를 찾는 전직 모놀리스 신도들. 누구는 브로쟈가를 따르고, 누구는 설교자 파우스트의 말을 듣는다.",
  },
  Scientists: {
    English:
      "Institute colours. Some scientists never leave their labs; the Malachite crowd would rather pay a stalker to fetch a mutant or an artifact than go out after it.",
    Ukrainian:
      "Шеврон учених. Одні вчені не покидають лабораторій, а ті, що з «Малахіту», радше заплатять сталкеру за мутанта чи артефакт, ніж полізуть по нього самі.",
    German:
      "Wissenschaftler-Abzeichen. Manche verlassen ihre Labore nie; die vom Malachit zahlen lieber einem Stalker für einen Mutanten oder ein Artefakt, als selbst hinauszugehen.",
    French:
      "Écusson des scientifiques. Certains ne quittent jamais leur laboratoire ; ceux de Malachite préfèrent payer un stalker pour un mutant ou un artefact plutôt que d'aller le chercher.",
    SpanishEuropean:
      "Emblema de los científicos. Algunos no salen nunca del laboratorio; los de Malaquita prefieren pagar a un stalker por un mutante o un artefacto antes que ir a buscarlo.",
    Italian:
      "Toppa degli scienziati. Alcuni non lasciano mai il laboratorio; quelli di Malachite preferiscono pagare uno stalker per un mutante o un artefatto piuttosto che andarlo a prendere.",
    Polish:
      "Naszywka naukowców. Niektórzy nie wychodzą z laboratorium; ci z Malachitu wolą zapłacić stalkerowi za mutanta albo artefakt, niż ruszyć po niego sami.",
    Czech:
      "Nášivka vědců. Někteří laboratoř nikdy neopustí; ti z Malachitu radši zaplatí stalkerovi za mutanta nebo artefakt, než by šli sami.",
    Turkish:
      "Bilim insanlarının arması. Bazıları laboratuvardan hiç çıkmaz; Malahit'tekiler bir mutant ya da artefakt için kendi gitmek yerine stalker'a para vermeyi yeğler.",
    Serbian:
      "Ознака научника. Неки никад не изађу из лабораторије; они из «Малахита» пре ће платити сталкеру за мутанта или артефакт него што ће сами кренути.",
    PortugalBrazilian:
      "Emblema dos cientistas. Alguns nunca saem do laboratório; o pessoal do Malaquita prefere pagar um stalker por um mutante ou artefato a ir buscá-lo.",
    SpanishLatinoAmerican:
      "Emblema de los científicos. Algunos no salen nunca del laboratorio; los de Malaquita prefieren pagar a un stalker por un mutante o un artefacto antes que ir a buscarlo.",
    Arabic:
      "شعار العلماء. بعضهم لا يخرج من مختبره أبدًا؛ وجماعة «الملكيت» يفضّلون أن يدفعوا لستالكر مقابل متحوّل أو قطعة أثرية على أن يخرجوا بأنفسهم.",
    ChineseSimplified:
      "科学家的臂章。有些人从不走出实验室；「孔雀石」的那批人宁可花钱请潜行者带回变异体或造物，也不亲自出门。",
    ChineseTraditional:
      "科學家的臂章。有些人從不走出實驗室；「孔雀石」的那批人寧可花錢請潛行者帶回變異體或造物，也不親自出門。",
    Japanese:
      "科学者のパッチ。研究室から一歩も出ない者もいる。マラカイトの連中は、自分で取りに行くより、ミュータントやアーティファクトをストーカーに金で運ばせる。",
    Korean:
      "과학자 패치. 어떤 이는 실험실에서 나오지도 않고, 말라카이트 쪽은 직접 나서기보다 스토커에게 돈을 주고 돌연변이나 아티팩트를 가져오게 한다.",
  },
  Spark: {
    English:
      "Spark colours. The Ward took their Chemical Plant, so they live out of hidden caches now and hit back wherever they can reach.",
    Ukrainian:
      "Шеврон Іскри. Хімзавод у них забрала «Варта», тож відтоді вони живуть по криївках і б'ють у відповідь, де дістануть.",
    German:
      "Spark-Abzeichen. Die Ward nahm ihnen das Chemiewerk, also leben sie aus versteckten Depots und schlagen zurück, wo sie hinkommen.",
    French:
      "Écusson de Spark. La Garde leur a pris l'usine chimique ; ils vivent depuis de caches dissimulées et frappent partout où ils peuvent atteindre.",
    SpanishEuropean:
      "Emblema de Spark. La Guardia les quitó la Planta Química, así que ahora viven de escondrijos y golpean donde alcanzan.",
    Italian:
      "Toppa di Spark. La Guardia gli ha preso lo stabilimento chimico, così ora vivono di nascondigli e colpiscono dove arrivano.",
    Polish:
      "Naszywka Spark. Warta odebrała im Zakłady Chemiczne, więc żyją teraz po skrytkach i oddają ciosy tam, gdzie sięgną.",
    Czech:
      "Nášivka Spark. Varta jim vzala Chemičku, takže teď žijí ze skrýší a vracejí rány tam, kam dosáhnou.",
    Turkish:
      "Spark arması. Muhafızlar Kimya Fabrikası'nı ellerinden aldı; artık gizli zulalardan geçiniyor ve ulaşabildikleri her yerde karşılık veriyorlar.",
    Serbian:
      "Ознака Искре. Варта им је узела Хемијски комбинат, па сад живе по скровиштима и враћају ударце где могу да дохвате.",
    PortugalBrazilian:
      "Emblema do Spark. A Guarda tomou a Fábrica Química deles, então agora vivem de esconderijos e revidam onde conseguem alcançar.",
    SpanishLatinoAmerican:
      "Emblema de Spark. La Guardia les quitó la Planta Química, así que ahora viven de escondrijos y golpean donde alcanzan.",
    Arabic:
      "شعار الشرارة. أخذ الحرس مصنعهم الكيميائي، فصاروا يعيشون من مخابئ سرّية ويردّون الضربة حيث تصل أيديهم.",
    ChineseSimplified:
      "火花的臂章。化工厂被守卫军夺走后，他们只能靠隐藏的补给点过活，能打到哪里就在哪里还手。",
    ChineseTraditional:
      "火花的臂章。化工廠被守衛軍奪走後，他們只能靠隱藏的補給點過活，能打到哪裡就在哪裡還手。",
    Japanese:
      "スパークのパッチ。化学工場をワードに奪われて以来、隠し倉庫を頼りに暮らし、手の届く場所で反撃を続けている。",
    Korean:
      "스파크 패치. 화학 공장을 와드에게 빼앗긴 뒤로 숨겨 둔 보관소에 의지해 살아가며, 닿는 곳마다 반격한다.",
  },
  Varta: {
    English:
      "Ward colours. Funded from the mainland, they keep order in the Zone as they see fit - with the best weapons here and the only helicopters that still fly.",
    Ukrainian:
      "Шеврон «Варти». За гроші з Великої Землі вони наводять у Зоні свій порядок - і мають для цього найкращу зброю та єдині гелікоптери, що досі літають.",
    German:
      "Ward-Abzeichen. Vom Festland finanziert, halten sie in der Zone die Ordnung, wie es ihnen passt - mit den besten Waffen hier und den einzigen Helikoptern, die noch fliegen.",
    French:
      "Écusson de la Garde. Financés depuis le continent, ils font régner l'ordre à leur idée - avec les meilleures armes du coin et les seuls hélicoptères qui volent encore.",
    SpanishEuropean:
      "Emblema de la Guardia. Financiados desde el continente, imponen el orden en la Zona a su manera, con las mejores armas de aquí y los únicos helicópteros que siguen volando.",
    Italian:
      "Toppa della Guardia. Finanziati dalla terraferma, impongono l'ordine nella Zona a modo loro - con le armi migliori e gli unici elicotteri ancora in volo.",
    Polish:
      "Naszywka Warty. Finansowani z Wielkiej Ziemi, zaprowadzają w Zonie porządek po swojemu - najlepszą bronią w okolicy i jedynymi śmigłowcami, które tu jeszcze latają.",
    Czech:
      "Nášivka Varty. Financovaní z Velké země zavádějí v Zóně pořádek po svém - s nejlepšími zbraněmi tady a jedinými vrtulníky, které ještě létají.",
    Turkish:
      "Muhafız arması. Ana karadan finanse ediliyorlar ve Bölge'de düzeni kendi bildikleri gibi kuruyorlar - buradaki en iyi silahlarla ve hâlâ uçan tek helikopterlerle.",
    Serbian:
      "Ознака Варте. Финансирани с Велике земље, у Зони заводе ред како им се чини - с најбољим оружјем овде и јединим хеликоптерима који још лете.",
    PortugalBrazilian:
      "Emblema da Guarda. Financiados do continente, impõem ordem na Zona como bem entendem - com as melhores armas daqui e os únicos helicópteros que ainda voam.",
    SpanishLatinoAmerican:
      "Emblema de la Guardia. Financiados desde el continente, imponen el orden en la Zona a su manera, con las mejores armas de aquí y los únicos helicópteros que siguen volando.",
    Arabic:
      "شعار الحرس. يُموّلون من البرّ الكبير، ويفرضون في المنطقة نظامهم كما يرونه - بأفضل الأسلحة هنا وبالمروحيات الوحيدة التي ما زالت تطير.",
    ChineseSimplified:
      "守卫军的臂章。有大陆的资金支持，他们按自己的规矩在区域里维持秩序——凭着这里最好的枪，和唯一还能飞的直升机。",
    ChineseTraditional:
      "守衛軍的臂章。有本土的資金支持，他們按自己的規矩在區域裡維持秩序——憑著這裡最好的槍，和唯一還能飛的直升機。",
    Japanese:
      "ワードのパッチ。本土からの資金を背に、彼らは自分たちの流儀でゾーンの秩序を保つ――ここで最良の銃と、いまだ飛ぶ唯一のヘリを使って。",
    Korean:
      "와드 패치. 본토의 자금을 등에 업고 자기들 방식대로 존의 질서를 유지한다 - 이곳 최고의 총과, 아직 떠 있는 유일한 헬기로.",
  },
  FactionPatch: {
    English:
      "A cloth patch with no emblem on it - stitched for a faction that never existed. Somebody in the Zone will still buy it.",
    Ukrainian:
      "Нашивка без емблеми - пошита для фракції, якої ніколи не існувало. У Зоні на неї все одно знайдеться покупець.",
    German:
      "Ein Stoffabzeichen ohne Emblem - genäht für eine Fraktion, die es nie gab. In der Zone findet sich trotzdem ein Käufer.",
    French:
      "Un écusson en tissu sans emblème - cousu pour une faction qui n'a jamais existé. Il trouvera quand même acheteur dans la Zone.",
    SpanishEuropean:
      "Un parche de tela sin emblema, cosido para una facción que nunca existió. En la Zona igual encuentra comprador.",
    Italian:
      "Una toppa di stoffa senza emblema, cucita per una fazione che non è mai esistita. Nella Zona un compratore si trova comunque.",
    Polish:
      "Materiałowa naszywka bez godła - zszyta dla frakcji, która nigdy nie istniała. W Zonie i tak znajdzie się nabywca.",
    Czech:
      "Textilní nášivka bez emblému - ušitá pro frakci, která nikdy neexistovala. V Zóně se na ni kupec i tak najde.",
    Turkish:
      "Amblemsiz bir bez arma - hiç var olmamış bir hizip için dikilmiş. Bölge'de yine de alıcısı çıkar.",
    Serbian:
      "Платнена ознака без амблема - сашивена за фракцију која никада није постојала. У Зони ће се купац ипак наћи.",
    PortugalBrazilian:
      "Um emblema de tecido sem símbolo algum - costurado para uma facção que nunca existiu. Na Zona ainda assim aparece comprador.",
    SpanishLatinoAmerican:
      "Un parche de tela sin emblema, cosido para una facción que nunca existió. En la Zona igual encuentra comprador.",
    Arabic: "شعار من القماش بلا رمز - خيط لفصيل لم يوجد قطّ. ومع ذلك سيجد له مشتريًا في المنطقة.",
    ChineseSimplified: "一块没有徽记的布制臂章——为一个从未存在的派系缝制。在区域里照样有人肯买。",
    ChineseTraditional: "一塊沒有徽記的布製臂章——為一個從未存在的派系縫製。在區域裡照樣有人肯買。",
    Japanese:
      "紋章のない布製のパッチ――存在しない派閥のために縫われた物。それでもゾーンでは買い手がつく。",
    Korean:
      "문장이 없는 천 패치 - 존재하지도 않았던 진영을 위해 지은 것. 그래도 존에서는 사려는 자가 있다.",
  },
} as Partial<Record<CoreFaction | typeof FactionPatchSID, TemplateByLanguage>>;

/** Name and description for every faction patch item, template prototype included. */
export const factionPatchLocalization = (): LocalizedTextEntry[] =>
  // The template prototype is a real item SID too, so it gets a name of its own rather than
  // showing up as a raw SID if anything ever spawns it.
  [
    { SID: FactionPatchSID, Faction: FactionPatchSID as CoreFaction },
    ...FactionPatchDefinitions,
  ].flatMap(({ SID, Faction }) =>
    itemLocalization(
      SID,
      { name: NAME_TEMPLATE, description: FACTION_DESCRIPTIONS[Faction] ?? DESCRIPTION_TEMPLATE },
      { f: FACTION_NAMES[Faction] },
    ),
  );

/**
 * Rewrites the mod's text asset with the complete entry list. Idempotent: the entries are derived
 * from `FactionPatchDefinitions`, so the bytes only change when a patch or a translation does.
 */
export const writeFactionPatchLocalization = () =>
  writeModLocalization(import.meta.url, factionPatchLocalization(), "FactionPatches-Localization3");
