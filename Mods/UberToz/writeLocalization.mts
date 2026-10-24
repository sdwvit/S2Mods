/**
 * Regenerates `raw/Stalker2/Content/UberToz-localization.uasset`: the PU scope's name and description
 * (shared with ScopedDrahunka, see threeLineScope.mts), and the names and descriptions of
 * the slug sniper upgrades in slugUpgrades.mts. The stat lines under an upgrade come from the
 * effects' vanilla `LocalizationSID`s and need no text here.
 *
 * The Russian slot is served Ukrainian text by `src/localization/text.mts`.
 *
 * Not runnable on its own: the only entry point is `writeUberTozLocalization()`, called from the
 * mod's struct transformer, so the asset is only rewritten by `prepare-configs`.
 */
import {
  localized,
  writeModLocalization,
  type TemplateByLanguage,
} from "../../src/localization/text.mts";
import { POLISHED_ACTION_SID, RIFLED_LINER_SID, SLUG_BARREL_SID } from "./slugUpgrades.mts";
import { threeLineScopeLocalization } from "./threeLineScope.mts";

const UPGRADE_TEXT: Record<string, { name: TemplateByLanguage; description: TemplateByLanguage }> = {
  [SLUG_BARREL_SID]: {
    name: {
      English: "Extended Slug Barrels",
      Ukrainian: "Подовжені стволи під кулю",
      German: "Verlängerte Läufe für Flintenlaufgeschosse",
      French: "Canons allongés pour balles",
      SpanishEuropean: "Cañones alargados para bala",
      Italian: "Canne allungate per palla",
      Polish: "Wydłużone lufy pod breneki",
      Czech: "Prodloužené hlavně pro jednotnou střelu",
      Turkish: "Tek Kurşun İçin Uzatılmış Namlular",
      Serbian: "Продужене цеви за пуно зрно",
      PortugalBrazilian: "Canos alongados para balote",
      SpanishLatinoAmerican: "Cañones alargados para bala",
      Arabic: "سبطانات مطوّلة للرصاص المصمت",
      ChineseSimplified: "独头弹加长枪管",
      ChineseTraditional: "獨頭彈加長槍管",
      Japanese: "スラグ用延長バレル",
      Korean: "슬러그용 연장 총열",
    },
    description: {
      English: "Longer barrels with a bore matched to slugs. A slug keeps its energy out to sniper range.",
      Ukrainian: "Довші стволи з каналом під кульовий набій. Куля зберігає енергію на снайперській дистанції.",
      German:
        "Längere Läufe mit einer auf Flintenlaufgeschosse abgestimmten Bohrung. Das Geschoss behält seine Energie bis auf Scharfschützendistanz.",
      French: "Des canons plus longs, à l’alésage adapté aux balles. La balle conserve son énergie jusqu’à distance de tireur d’élite.",
      SpanishEuropean: "Cañones más largos con un ánima adaptada a la bala. La bala conserva su energía a distancia de francotirador.",
      Italian: "Canne più lunghe con anima adatta alla palla. La palla mantiene la sua energia fino a distanze da cecchino.",
      Polish: "Dłuższe lufy z przewodem dopasowanym do breneki. Pocisk zachowuje energię na dystansie snajperskim.",
      Czech: "Delší hlavně s vývrtem přizpůsobeným jednotné střele. Střela si udrží energii až na odstřelovačskou vzdálenost.",
      Turkish: "Tek kurşuna göre ayarlanmış iç çaplı daha uzun namlular. Kurşun, keskin nişancı mesafesinde bile enerjisini korur.",
      Serbian: "Дуже цеви са каналом прилагођеним пуном зрну. Зрно задржава енергију и на снајперској даљини.",
      PortugalBrazilian: "Canos mais longos com alma ajustada ao balote. O balote mantém a energia até distâncias de atirador de elite.",
      SpanishLatinoAmerican: "Cañones más largos con un ánima adaptada a la bala. La bala conserva su energía a distancia de francotirador.",
      Arabic: "سبطانات أطول بتجويف مُعدّ للرصاص المصمت. تحتفظ الرصاصة بطاقتها حتى مسافات القنص.",
      ChineseSimplified: "加长枪管，膛径专为独头弹匹配。弹头在狙击距离上仍能保持能量。",
      ChineseTraditional: "加長槍管，膛徑專為獨頭彈匹配。彈頭在狙擊距離上仍能保持能量。",
      Japanese: "スラグ弾に合わせた内径の長いバレル。スラグは狙撃距離でもエネルギーを保つ。",
      Korean: "슬러그탄에 맞춘 구경의 더 긴 총열입니다. 슬러그가 저격 거리에서도 에너지를 유지합니다.",
    },
  },
  [RIFLED_LINER_SID]: {
    name: {
      English: "Rifled Barrel Liners",
      Ukrainian: "Нарізні вкладиші стволів",
      German: "Gezogene Einsteckläufe",
      French: "Chemisages rayés",
      SpanishEuropean: "Camisas estriadas",
      Italian: "Riduttori rigati",
      Polish: "Gwintowane wkładki lufowe",
      Czech: "Drážkované vložné hlavně",
      Turkish: "Yivli Namlu Gömlekleri",
      Serbian: "Олучени улошци цеви",
      PortugalBrazilian: "Revestimentos raiados",
      SpanishLatinoAmerican: "Camisas estriadas",
      Arabic: "بطانات سبطانة محلزنة",
      ChineseSimplified: "膛线衬管",
      ChineseTraditional: "膛線襯管",
      Japanese: "ライフルドライナー",
      Korean: "강선 라이너",
    },
    description: {
      English: "Rifled liners spin the slug, so it flies faster and drops less.",
      Ukrainian: "Нарізні вкладиші закручують кулю, тож вона летить швидше й менше знижується.",
      German: "Gezogene Einsteckläufe versetzen das Geschoss in Drall, sodass es schneller fliegt und weniger abfällt.",
      French: "Des chemisages rayés impriment une rotation à la balle : elle vole plus vite et chute moins.",
      SpanishEuropean: "Las camisas estriadas hacen girar la bala, que vuela más rápido y cae menos.",
      Italian: "I riduttori rigati imprimono rotazione alla palla, che vola più veloce e cala meno.",
      Polish: "Gwintowane wkładki nadają brenece ruch obrotowy, więc leci szybciej i mniej opada.",
      Czech: "Drážkované vložky střelu roztočí, takže letí rychleji a méně klesá.",
      Turkish: "Yivli gömlekler kurşunu döndürür; böylece kurşun daha hızlı uçar ve daha az düşer.",
      Serbian: "Олучени улошци заврте зрно, па лети брже и мање пада.",
      PortugalBrazilian: "Revestimentos raiados fazem o balote girar, então ele voa mais rápido e cai menos.",
      SpanishLatinoAmerican: "Las camisas estriadas hacen girar la bala, que vuela más rápido y cae menos.",
      Arabic: "تُدير البطانات المحلزنة الرصاصة، فتطير أسرع وتهبط أقل.",
      ChineseSimplified: "膛线衬管让独头弹旋转飞行，速度更快，下坠更少。",
      ChineseTraditional: "膛線襯管讓獨頭彈旋轉飛行，速度更快，下墜更少。",
      Japanese: "ライフリング入りのライナーがスラグを回転させ、弾速が上がり弾道の落下が減る。",
      Korean: "강선이 새겨진 라이너가 슬러그를 회전시켜 더 빠르게 날아가고 덜 떨어집니다.",
    },
  },
  [POLISHED_ACTION_SID]: {
    name: {
      English: "Polished Action",
      Ukrainian: "Відполірований механізм",
      German: "Polierter Verschluss",
      French: "Mécanisme poli",
      SpanishEuropean: "Mecanismo pulido",
      Italian: "Meccanismo lucidato",
      Polish: "Polerowany mechanizm",
      Czech: "Leštěný mechanismus",
      Turkish: "Cilalı Mekanizma",
      Serbian: "Полиран механизам",
      PortugalBrazilian: "Mecanismo polido",
      SpanishLatinoAmerican: "Mecanismo pulido",
      Arabic: "آلية مصقولة",
      ChineseSimplified: "抛光机件",
      ChineseTraditional: "拋光機件",
      Japanese: "研磨済み機関部",
      Korean: "연마된 작동부",
    },
    description: {
      English: "Hand-fitted, polished action parts. The shotgun comes up and goes away faster.",
      Ukrainian: "Підігнані вручну й відполіровані деталі механізму. Рушницю швидше дістаєш і ховаєш.",
      German: "Von Hand angepasste, polierte Verschlussteile. Die Flinte ist schneller gezogen und wieder weggesteckt.",
      French: "Pièces du mécanisme ajustées à la main et polies. Le fusil se dégaine et se range plus vite.",
      SpanishEuropean: "Piezas del mecanismo ajustadas a mano y pulidas. La escopeta se desenfunda y se guarda más rápido.",
      Italian: "Parti del meccanismo adattate a mano e lucidate. Il fucile si estrae e si ripone più in fretta.",
      Polish: "Ręcznie dopasowane, polerowane części mechanizmu. Strzelbę szybciej się dobywa i chowa.",
      Czech: "Ručně slícované a vyleštěné díly mechanismu. Brokovnice se rychleji tasí i schovává.",
      Turkish: "Elle ayarlanmış, cilalı mekanizma parçaları. Av tüfeği daha hızlı çekilir ve kaldırılır.",
      Serbian: "Ручно подешени и полирани делови механизма. Сачмара се брже вади и склања.",
      PortugalBrazilian: "Peças do mecanismo ajustadas à mão e polidas. A espingarda é sacada e guardada mais rápido.",
      SpanishLatinoAmerican: "Piezas del mecanismo ajustadas a mano y pulidas. La escopeta se desenfunda y se guarda más rápido.",
      Arabic: "أجزاء آلية مصقولة ومضبوطة يدويًا. تُسحب البندقية وتُعاد أسرع.",
      ChineseSimplified: "手工修配并抛光的机件。霰弹枪掏出和收起都更快。",
      ChineseTraditional: "手工修配並拋光的機件。霰彈槍掏出和收起都更快。",
      Japanese: "手作業で合わせ込み研磨した機関部の部品。ショットガンを素早く構え、素早くしまえる。",
      Korean: "수작업으로 맞추고 연마한 작동부 부품입니다. 산탄총을 더 빨리 꺼내고 집어넣을 수 있습니다.",
    },
  },
};

const upgradeLocalization = (sid: string, text: { name: TemplateByLanguage; description: TemplateByLanguage }) => [
  { SID: `sid_upgrades_${sid}_name`, LanguagesToLocalizedStrings: localized(text.name) },
  { SID: `sid_upgrades_${sid}_description`, LanguagesToLocalizedStrings: localized(text.description) },
];

export function writeUberTozLocalization() {
  writeModLocalization(import.meta.url, [
    ...threeLineScopeLocalization(),
    ...Object.entries(UPGRADE_TEXT).flatMap(([sid, text]) => upgradeLocalization(sid, text)),
  ]);
}
