/**
 * Regenerates WolfArmorFetch's two Mod Editor text assets:
 * - `WolfArmorFetch-dialogs.uasset` (`DialogModTextToolAsset`): Wolf's four dialog topics, built from
 *   `./dialog.mts`, which the `DialogPrototypes` are generated from too.
 * - `WolfArmorFetch-localization.uasset`: both journal entries.
 *
 * The text itself lives in `./deciderText.mts` (the Decider) and `./dialogText.mts` (the Falcon). The Russian slot is served Ukrainian text by
 * `src/localization/text.mts`.
 *
 * Not runnable on its own: called from the `transformDialogPrototypes` once-guard, so the assets are
 * only rewritten by `prepare-configs`.
 */
import { localized, writeModDialogs, writeModLocalization } from "../../src/localization/text.mts";
import { dialogTopics } from "./dialog.mts";
import { JOURNAL } from "./dialogText.mts";
import { DECIDER_JOURNAL } from "./deciderText.mts";

export function writeWolfArmorFetchLocalization() {
  writeModLocalization(
    import.meta.url,
    Object.entries({ ...DECIDER_JOURNAL, ...JOURNAL }).map(([SID, text]) => ({ SID, LanguagesToLocalizedStrings: localized(text) })),
  );
  writeModDialogs(import.meta.url, dialogTopics());
}
