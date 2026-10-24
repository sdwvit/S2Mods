import { modName } from "../../src/base-paths.mts";

export { THREE_LINE_SCOPE_SID as SCOPE_SID } from "../UberToz/threeLineScope.mts";
export const DRAHUNKA_SID = "GunGonta_SP";
/** What the scope's "Fits:" line is keyed by: the gun's LocalizationSID, as vanilla lists it. */
export const DRAHUNKA_FITS_KEY = "nvgpack_Gun_Dragunka_SR";
/** Imported by editor/import_icon.py; vanilla ships no item icon for the scope, it was always hidden. */
export const SCOPE_ICON = `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Attach/T_inv_icon_threeline_scope.T_inv_icon_threeline_scope'`;
