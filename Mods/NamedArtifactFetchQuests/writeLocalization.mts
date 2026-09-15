/**
 * Overrides the 22 RSQ artifact-fetch dialog labels with the text in `labels.json`, so each option
 * names the artifact it asks for: "Get an artifact for a kingpin." becomes
 * "Get an artifact for a kingpin (Steak)".
 *
 * These are vanilla SIDs, not new ones, and `labels.json` holds the finished line for all eighteen
 * languages - lifted from the game's own shipped text, never translated by hand - so the mod ships
 * no cfg patch and needs nothing at build time but the file next to it.
 *
 * Called from the mod's `meta.onFinish`, so the asset is rewritten by `prepare-configs`.
 */
import labels from "./labels.json" with { type: "json" };
import { writeModLocalization } from "../../src/localization/text.mts";

export function writeArtifactQuestLabelLocalization() {
  writeModLocalization(
    import.meta.url,
    Object.entries(labels).map(([SID, byLanguage]) => ({
      SID,
      LanguagesToLocalizedStrings: Object.fromEntries(
        Object.entries(byLanguage).map(([language, text]) => [
          `ELocalizationLanguage::${language}`,
          text,
        ]),
      ),
    })),
  );
}
