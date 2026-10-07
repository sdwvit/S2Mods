/**
 * Regenerates `raw/Stalker2/Content/FireModeUpgrades-localization.uasset`: the name/hint pair of
 * each fire mode upgrade (`sid_upgrades_<SID>_name` / `_description`, as the upgrades' `Text` and
 * `Hint` point there), plus the "Semi-automatic firing mode" effect line. The auto-adding effects
 * reuse the vanilla "Automatic firing mode" line, so they need nothing here.
 *
 * The effect label follows each language's vanilla "Automatic firing mode" wording with the mode
 * swapped. The Russian slot is served Ukrainian text by `src/localization/text.mts`.
 *
 * Not runnable on its own: called from the `transformUpgradePrototypes` once-guard, so the asset is
 * only rewritten by `prepare-configs`.
 */
import { localized, writeModLocalization, type TemplateByLanguage } from "../../src/localization/text.mts";
import type { LocalizedTextEntry } from "../../src/localization/uasset.mts";

const SEMI_EFFECT_NAME: TemplateByLanguage = {
  English: "Semi-automatic firing mode",
  Ukrainian: "Напівавтоматичний режим стрільби",
  German: "Halbautomatischer Feuermodus",
  French: "Mode de tir semi-automatique",
  SpanishEuropean: "Modo de disparo semiautomático",
  Italian: "Modalità di fuoco semiautomatica",
  Polish: "Tryb półautomatycznego strzelania",
  Czech: "Poloautomatický palebný režim",
  Turkish: "Yarı Otomatik Atış Modu",
  Serbian: "Полуаутоматска паљба",
  PortugalBrazilian: "Modo de tiro semiautomático",
  SpanishLatinoAmerican: "Modo de disparo semiautomático",
  Arabic: "وضع الإطلاق شبه التلقائي",
  ChineseSimplified: "半自动射击模式",
  ChineseTraditional: "半自動射擊模式",
  Japanese: "セミオート射撃モード",
  Korean: "반자동 사격 모드",
};

const UPGRADE_TEXT: Record<string, { name: TemplateByLanguage; description: TemplateByLanguage }> = {
  GunG37V2_Upgrade_FireMode_Auto: {
    name: {
      English: "Full-Auto Trigger Group",
      Ukrainian: "Ударно-спусковий механізм з автоматичним вогнем",
      German: "Vollautomatische Abzugsgruppe",
      French: "Mécanisme de détente à tir automatique",
      SpanishEuropean: "Grupo de disparo automático",
      Italian: "Gruppo di scatto automatico",
      Polish: "Mechanizm spustowy z ogniem ciągłym",
      Czech: "Spoušťový mechanismus s automatickou palbou",
      Turkish: "Tam Otomatik Tetik Grubu",
      Serbian: "Механизам окидања за аутоматску паљбу",
      PortugalBrazilian: "Grupo de gatilho automático",
      SpanishLatinoAmerican: "Grupo de gatillo automático",
      Arabic: "مجموعة زناد للإطلاق التلقائي",
      ChineseSimplified: "全自动击发组件",
      ChineseTraditional: "全自動擊發組件",
      Japanese: "フルオート・トリガーグループ",
      Korean: "완전 자동 방아쇠 뭉치",
    },
    description: {
      English:
        "Replaces the burst-limiting sear with the standard GP37 trigger group. The rifle keeps its single and burst modes and regains fully automatic fire.",
      Ukrainian:
        "Замінює шептало з обмеженням черги на стандартний ударно-спусковий механізм GP37. Гвинтівка зберігає одиночний вогонь і черги з відсіченням та знову отримує автоматичний вогонь.",
      German:
        "Ersetzt den Feuerstoßbegrenzer durch die Standard-Abzugsgruppe des GP37. Das Gewehr behält Einzel- und Feuerstoßmodus und erhält wieder Dauerfeuer.",
      French:
        "Remplace la gâchette à rafales limitées par le mécanisme de détente standard du GP37. Le fusil conserve le tir au coup par coup et en rafales et retrouve le tir entièrement automatique.",
      SpanishEuropean:
        "Sustituye el fiador limitador de ráfagas por el grupo de disparo estándar del GP37. El fusil conserva los modos de tiro a tiro y ráfaga y recupera el fuego automático.",
      Italian:
        "Sostituisce il dente di arresto a raffica limitata con il gruppo di scatto standard del GP37. Il fucile mantiene le modalità a colpo singolo e a raffica e recupera il fuoco automatico.",
      Polish:
        "Zastępuje zaczep ograniczający serię standardowym mechanizmem spustowym GP37. Karabin zachowuje ogień pojedynczy i seriami ograniczonymi, a do tego odzyskuje ogień ciągły.",
      Czech:
        "Nahrazuje záchyt omezující dávky standardním spoušťovým mechanismem GP37. Puška si ponechává jednotlivou palbu i dávky a znovu získává plně automatickou palbu.",
      Turkish:
        "Seri atış sınırlayıcı tetik kolunu standart GP37 tetik grubuyla değiştirir. Tüfek tekli ve seri atış modlarını korur ve tam otomatik atışı yeniden kazanır.",
      Serbian:
        "Замењује окидач са ограничењем рафала стандардним механизмом окидања GP37. Пушка задржава појединачну паљбу и рафале и поново добија аутоматску паљбу.",
      PortugalBrazilian:
        "Substitui a trava limitadora de rajada pelo grupo de gatilho padrão do GP37. O fuzil mantém os modos de tiro único e rajada e recupera o tiro totalmente automático.",
      SpanishLatinoAmerican:
        "Reemplaza el fiador limitador de ráfagas por el grupo de gatillo estándar del GP37. El rifle conserva los modos de tiro único y ráfaga y recupera el disparo automático.",
      Arabic:
        "يستبدل آلية تحديد الدفعات بمجموعة الزناد القياسية لبندقية GP37. تحتفظ البندقية بوضعي الطلقة المفردة والدفعة وتستعيد الإطلاق التلقائي الكامل.",
      ChineseSimplified: "用 GP37 的标准击发组件替换限制点射的阻铁。步枪保留单发和点射模式，并恢复全自动射击。",
      ChineseTraditional: "以 GP37 的標準擊發組件替換限制點射的阻鐵。步槍保留單發與點射模式，並恢復全自動射擊。",
      Japanese:
        "バースト制限シアをGP37標準のトリガーグループに交換する。単発とバーストはそのままに、フルオート射撃が復活する。",
      Korean: "점사 제한 시어를 GP37 표준 방아쇠 뭉치로 교체합니다. 단발과 점사 모드는 그대로 유지되며 완전 자동 사격이 다시 가능해집니다.",
    },
  },
  GunAPB_Upgrade_FireMode_Semi: {
    name: {
      English: "Fire Selector Restoration",
      Ukrainian: "Відновлення перемикача режимів вогню",
      German: "Wiederhergestellter Feuerwahlhebel",
      French: "Restauration du sélecteur de tir",
      SpanishEuropean: "Restauración del selector de tiro",
      Italian: "Ripristino del selettore di fuoco",
      Polish: "Przywrócenie przełącznika rodzaju ognia",
      Czech: "Obnovený přepínač režimů palby",
      Turkish: "Atış Seçici Onarımı",
      Serbian: "Обновљени прекидач режима паљбе",
      PortugalBrazilian: "Restauração do seletor de tiro",
      SpanishLatinoAmerican: "Restauración del selector de disparo",
      Arabic: "استعادة محدد وضع الإطلاق",
      ChineseSimplified: "射击模式选择器修复",
      ChineseTraditional: "射擊模式選擇器修復",
      Japanese: "セレクター復元",
      Korean: "조정간 복원",
    },
    description: {
      English:
        "Restores the single-shot position on the fire selector for aimed single shots that save ammo. Burst fire stays available.",
      Ukrainian:
        "Повертає положення одиночного вогню на перемикачі. Прицільні одиночні постріли заощаджують набої. Стрільба чергами лишається доступною.",
      German:
        "Stellt die Einzelfeuer-Stellung am Feuerwahlhebel wieder her. Gezielte Einzelschüsse sparen Munition. Feuerstöße bleiben verfügbar.",
      French:
        "Rétablit la position coup par coup sur le sélecteur de tir. Les tirs ajustés au coup par coup économisent les munitions. Le tir en rafales reste disponible.",
      SpanishEuropean:
        "Restaura la posición de tiro a tiro en el selector. Los disparos individuales precisos ahorran munición. El fuego en ráfaga sigue disponible.",
      Italian:
        "Ripristina la posizione a colpo singolo sul selettore di fuoco. I colpi singoli mirati fanno risparmiare munizioni. La raffica resta disponibile.",
      Polish:
        "Przywraca pozycję ognia pojedynczego na przełączniku. Celne pojedyncze strzały oszczędzają amunicję. Ogień seriami pozostaje dostępny.",
      Czech:
        "Obnovuje polohu jednotlivé palby na přepínači. Mířené jednotlivé výstřely šetří střelivo. Palba dávkami zůstává k dispozici.",
      Turkish:
        "Atış seçicideki tekli atış konumunu geri getirir. Nişanlı tekli atışlar mühimmat tasarrufu sağlar. Seri atış kullanılabilir kalır.",
      Serbian:
        "Враћа положај за појединачну паљбу на прекидачу. Нишањени појединачни хици штеде муницију. Рафална паљба остаје доступна.",
      PortugalBrazilian:
        "Restaura a posição de tiro único no seletor. Tiros únicos precisos economizam munição. O tiro em rajada continua disponível.",
      SpanishLatinoAmerican:
        "Restaura la posición de tiro único en el selector. Los disparos únicos precisos ahorran munición. El disparo en ráfaga sigue disponible.",
      Arabic:
        "يعيد وضع الطلقة المفردة إلى محدد الإطلاق. توفّر الطلقات المفردة المصوّبة الذخيرة. يبقى وضع الدفعات متاحًا.",
      ChineseSimplified: "恢复快慢机上的单发档位。精确的单发射击可以节省弹药。点射模式依然保留。",
      ChineseTraditional: "恢復快慢機上的單發檔位。精準的單發射擊可以節省彈藥。點射模式依然保留。",
      Japanese: "セレクターの単発位置を復元する。狙いすました単発射撃で弾薬を節約できる。バースト射撃も引き続き使用可能。",
      Korean: "조정간의 단발 위치를 복원합니다. 정조준 단발 사격으로 탄약을 아낄 수 있습니다. 점사 사격도 그대로 사용할 수 있습니다.",
    },
  },
  GunM10_Upgrade_FireMode_Semi: {
    name: {
      English: "Semi-Auto Sear",
      Ukrainian: "Шептало одиночного вогню",
      German: "Halbautomatik-Abzugsstollen",
      French: "Gâchette semi-automatique",
      SpanishEuropean: "Fiador semiautomático",
      Italian: "Dente di arresto semiautomatico",
      Polish: "Zaczep ognia pojedynczego",
      Czech: "Záchyt pro jednotlivou palbu",
      Turkish: "Yarı Otomatik Tetik Kolu",
      Serbian: "Окидач за појединачну паљбу",
      PortugalBrazilian: "Trava semiautomática",
      SpanishLatinoAmerican: "Fiador semiautomático",
      Arabic: "ماسك الإطلاق شبه التلقائي",
      ChineseSimplified: "半自动阻铁",
      ChineseTraditional: "半自動阻鐵",
      Japanese: "セミオート・シア",
      Korean: "반자동 시어",
    },
    description: {
      English:
        "Adds a semi-automatic sear and a fire selector to the open-bolt mechanism. Single shots tame the gun at range and stretch the ammo supply; automatic fire stays available.",
      Ukrainian:
        "Додає до механізму з відкритим затвором шептало одиночного вогню та перемикач режимів. Одиночні постріли приборкують зброю на дистанції й заощаджують набої; автоматичний вогонь лишається доступним.",
      German:
        "Ergänzt den zuschießenden Verschluss um einen Halbautomatik-Abzugsstollen und einen Feuerwahlhebel. Einzelschüsse bändigen die Waffe auf Distanz und schonen die Munition; Dauerfeuer bleibt verfügbar.",
      French:
        "Ajoute une gâchette semi-automatique et un sélecteur de tir au mécanisme à culasse ouverte. Le coup par coup dompte l'arme à distance et économise les munitions ; le tir automatique reste disponible.",
      SpanishEuropean:
        "Añade un fiador semiautomático y un selector de tiro al mecanismo de cerrojo abierto. El tiro a tiro doma el arma a distancia y ahorra munición; el fuego automático sigue disponible.",
      Italian:
        "Aggiunge un dente di arresto semiautomatico e un selettore di fuoco al meccanismo a otturatore aperto. I colpi singoli domano l'arma a distanza e fanno durare le munizioni; il fuoco automatico resta disponibile.",
      Polish:
        "Dodaje do mechanizmu z otwartym zamkiem zaczep ognia pojedynczego i przełącznik rodzaju ognia. Pojedyncze strzały ujarzmiają broń na dystansie i oszczędzają amunicję; ogień ciągły pozostaje dostępny.",
      Czech:
        "Přidává k mechanismu s otevřeným závěrem záchyt pro jednotlivou palbu a přepínač režimů. Jednotlivé výstřely zkrotí zbraň na dálku a šetří střelivo; automatická palba zůstává k dispozici.",
      Turkish:
        "Açık sürgü mekanizmasına yarı otomatik tetik kolu ve atış seçici ekler. Tekli atışlar silahı uzak mesafede dizginler ve mühimmatı idareli kullanır; otomatik atış kullanılabilir kalır.",
      Serbian:
        "Додаје механизму са отвореним затварачем окидач за појединачну паљбу и прекидач режима. Појединачни хици кроте оружје на даљину и штеде муницију; аутоматска паљба остаје доступна.",
      PortugalBrazilian:
        "Adiciona uma trava semiautomática e um seletor de tiro ao mecanismo de ferrolho aberto. Tiros únicos domam a arma à distância e economizam munição; o tiro automático continua disponível.",
      SpanishLatinoAmerican:
        "Agrega un fiador semiautomático y un selector de disparo al mecanismo de cerrojo abierto. Los tiros únicos dominan el arma a distancia y ahorran munición; el disparo automático sigue disponible.",
      Arabic:
        "يضيف ماسك إطلاق شبه تلقائي ومحدد وضع الإطلاق إلى آلية الترباس المفتوح. تروّض الطلقات المفردة السلاح على المسافات البعيدة وتوفّر الذخيرة، مع بقاء الإطلاق التلقائي متاحًا.",
      ChineseSimplified: "为开膛待击机构加装半自动阻铁和快慢机。单发射击可在远距离驯服这把枪并节省弹药；全自动射击依然保留。",
      ChineseTraditional: "為開膛待擊機構加裝半自動阻鐵與快慢機。單發射擊可在遠距離馴服這把槍並節省彈藥；全自動射擊依然保留。",
      Japanese:
        "オープンボルト機構にセミオート・シアとセレクターを追加する。単発なら遠距離でも扱いやすく、弾薬も節約できる。フルオート射撃も引き続き使用可能。",
      Korean:
        "오픈 볼트 기관에 반자동 시어와 조정간을 추가합니다. 단발 사격으로 원거리에서도 총을 다루기 쉬워지고 탄약을 아낄 수 있으며, 자동 사격도 그대로 사용할 수 있습니다.",
    },
  },
  GunSVU_Upgrade_FireMode_Auto: {
    name: {
      English: "Automatic Trigger Mechanism",
      Ukrainian: "Ударно-спусковий механізм автоматичного вогню",
      German: "Vollautomatischer Abzugsmechanismus",
      French: "Mécanisme de détente automatique",
      SpanishEuropean: "Mecanismo de disparo automático",
      Italian: "Meccanismo di scatto automatico",
      Polish: "Mechanizm spustowy ognia ciągłego",
      Czech: "Spoušťový mechanismus automatické palby",
      Turkish: "Otomatik Tetik Mekanizması",
      Serbian: "Механизам окидања за аутоматску паљбу",
      PortugalBrazilian: "Mecanismo de gatilho automático",
      SpanishLatinoAmerican: "Mecanismo de gatillo automático",
      Arabic: "آلية زناد للإطلاق التلقائي",
      ChineseSimplified: "全自动击发机构",
      ChineseTraditional: "全自動擊發機構",
      Japanese: "フルオート・トリガー機構",
      Korean: "자동 방아쇠 기관",
    },
    description: {
      English:
        "A trigger mechanism from the select-fire variant of the rifle. Adds automatic fire for close-range emergencies while keeping the single-shot mode; controlling the recoil is another matter.",
      Ukrainian:
        "Ударно-спусковий механізм від модифікації гвинтівки з перемикачем режимів вогню. Додає автоматичний вогонь для екстрених ситуацій на близькій дистанції та зберігає одиночний; утримати віддачу — вже інша справа.",
      German:
        "Ein Abzugsmechanismus aus der Variante des Gewehrs mit Feuerwahlhebel. Ergänzt Dauerfeuer für Notfälle auf kurze Distanz und behält den Einzelfeuermodus; den Rückstoß zu bändigen, ist eine andere Sache.",
      French:
        "Un mécanisme de détente issu de la variante à tir sélectif du fusil. Ajoute le tir automatique pour les urgences à courte portée tout en conservant le coup par coup ; maîtriser le recul est une autre histoire.",
      SpanishEuropean:
        "Un mecanismo de disparo de la variante de fuego selectivo del fusil. Añade fuego automático para emergencias a corta distancia y conserva el tiro a tiro; controlar el retroceso ya es otra cosa.",
      Italian:
        "Un meccanismo di scatto della variante a fuoco selettivo del fucile. Aggiunge il fuoco automatico per le emergenze a distanza ravvicinata mantenendo il colpo singolo; controllare il rinculo è un'altra faccenda.",
      Polish:
        "Mechanizm spustowy z odmiany karabinu z przełącznikiem rodzaju ognia. Dodaje ogień ciągły na awaryjne sytuacje z bliska i zachowuje ogień pojedynczy; opanowanie odrzutu to już inna sprawa.",
      Czech:
        "Spoušťový mechanismus z varianty pušky s volbou režimu palby. Přidává automatickou palbu pro krizové situace na krátkou vzdálenost a zachovává jednotlivou palbu; zvládnout zpětný ráz je jiná věc.",
      Turkish:
        "Tüfeğin atış seçicili versiyonundan alınmış bir tetik mekanizması. Tekli atış modunu korurken yakın mesafe acil durumları için otomatik atış ekler; geri tepmeyi kontrol etmek ise başka bir mesele.",
      Serbian:
        "Механизам окидања из варијанте пушке са избором режима паљбе. Додаје аутоматску паљбу за хитне ситуације на блиској даљини и задржава појединачну паљбу; обуздати трзај је већ друга прича.",
      PortugalBrazilian:
        "Um mecanismo de gatilho da variante de tiro seletivo do fuzil. Adiciona tiro automático para emergências a curta distância e mantém o tiro único; controlar o recuo já é outra história.",
      SpanishLatinoAmerican:
        "Un mecanismo de gatillo de la variante de fuego selectivo del rifle. Agrega disparo automático para emergencias a corta distancia y conserva el tiro único; controlar el retroceso ya es otro asunto.",
      Arabic:
        "آلية زناد مأخوذة من طراز البندقية ذي محدد وضع الإطلاق. تضيف الإطلاق التلقائي لحالات الطوارئ على المسافات القريبة مع الإبقاء على وضع الطلقة المفردة، أما السيطرة على الارتداد فمسألة أخرى.",
      ChineseSimplified: "取自该步枪可选射击型号的击发机构。在保留单发模式的同时加入全自动射击，用于近距离应急；至于能否压住后坐力，那就是另一回事了。",
      ChineseTraditional: "取自該步槍可選射擊型號的擊發機構。在保留單發模式的同時加入全自動射擊，用於近距離應急；至於能否壓住後座力，那就是另一回事了。",
      Japanese:
        "セレクティブファイア仕様のバリエーションから流用したトリガー機構。単発モードはそのままに、近距離の緊急時に使えるフルオート射撃を追加する。反動を制御できるかは別問題だ。",
      Korean:
        "이 소총의 조정간 장착형에서 가져온 방아쇠 기관입니다. 단발 모드는 유지한 채 근거리 비상 상황을 위한 자동 사격을 추가합니다. 반동을 제어하는 것은 또 다른 문제입니다.",
    },
  },
};

export function writeFireModeUpgradesLocalization() {
  const entries: LocalizedTextEntry[] = [
    { SID: "sid_effects_FireModeUpgrades_semi_name", LanguagesToLocalizedStrings: localized(SEMI_EFFECT_NAME) },
    ...Object.entries(UPGRADE_TEXT).flatMap(([sid, text]) => [
      { SID: `sid_upgrades_${sid}_name`, LanguagesToLocalizedStrings: localized(text.name) },
      { SID: `sid_upgrades_${sid}_description`, LanguagesToLocalizedStrings: localized(text.description) },
    ]),
  ];
  writeModLocalization(import.meta.url, entries);
}
