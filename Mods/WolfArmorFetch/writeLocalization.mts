/**
 * Regenerates WolfArmorFetch's two Mod Editor text assets:
 * - `WolfArmorFetch-dialogs.uasset` (`DialogModTextToolAsset`): every dialog topic, built from
 *   `./topics.mts`, which the `DialogPrototypes` are generated from too.
 * - `WolfArmorFetch-localization.uasset`: the three journal entries, and job 3's quest items and notes.
 *
 * The text itself lives in `./deciderText.mts` (the Decider), `./dialogText.mts` (the Falcon) and
 * `./coverText.mts` (Cover Story). The Russian slot is served Ukrainian text by
 * `src/localization/text.mts`.
 *
 * Not runnable on its own: called from the `transformDialogPrototypes` once-guard, so the assets are
 * only rewritten by `prepare-configs`.
 */
import { localized, writeModDialogs, writeModLocalization } from "../../src/localization/text.mts";
import { dialogTopics } from "./dialog.mts";
import { ALL_TOPICS } from "./topics.mts";
import { JOURNAL } from "./dialogText.mts";
import { DECIDER_JOURNAL } from "./deciderText.mts";
import { COVER_TEXT } from "./coverText.mts";

export function writeWolfArmorFetchLocalization() {
  writeModLocalization(
    import.meta.url,
    Object.entries({ ...DECIDER_JOURNAL, ...JOURNAL, ...COVER_TEXT }).map(([SID, text]) => ({ SID, LanguagesToLocalizedStrings: localized(text) })),
  );
  writeModDialogs(import.meta.url, dialogTopics(ALL_TOPICS));
}
