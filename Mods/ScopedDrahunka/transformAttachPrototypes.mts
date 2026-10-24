import type { AttachPrototype } from "s2cfgtojson";
import { forkThreeLineScope } from "../UberToz/threeLineScope.mts";
import { DRAHUNKA_FITS_KEY, SCOPE_ICON, SCOPE_SID } from "./consts.mts";
import { writeScopedDrahunkaLocalization } from "./writeLocalization.mts";

/** Turns the PU scope into a sellable item with an icon, and lists Drahunka on its "Fits:" line. */
export function transformAttachPrototypes(struct: AttachPrototype) {
  if (struct.SID !== SCOPE_SID) {
    return null;
  }
  writeScopedDrahunkaLocalization();
  return forkThreeLineScope(struct, SCOPE_ICON, [DRAHUNKA_FITS_KEY]);
}

transformAttachPrototypes.files = ["ItemPrototypes/AttachPrototypes.cfg"];
