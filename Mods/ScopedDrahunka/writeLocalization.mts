/**
 * Regenerates `raw/Stalker2/Content/ScopedDrahunka-localization.uasset`: the PU scope's name and
 * description, shared with UberToz (see ../UberToz/threeLineScope.mts).
 *
 * Not runnable on its own: the only entry point is `writeScopedDrahunkaLocalization()`, called from
 * the AttachPrototypes transformer, so the asset is only rewritten by `prepare-configs`.
 */
import { writeModLocalization } from "../../src/localization/text.mts";
import { threeLineScopeLocalization } from "../UberToz/threeLineScope.mts";

export function writeScopedDrahunkaLocalization() {
  writeModLocalization(import.meta.url, threeLineScopeLocalization());
}
