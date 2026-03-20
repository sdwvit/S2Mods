import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { getDialogPhrase } from "../../src/getDialogPhrase.mts";

let once = false;

const ACCEPT = "WolfArmorFetch_Dialog_Accept";
const TURNIN = "WolfArmorFetch_Dialog_TurnIn";

export const transformDialogPrototypes: StructTransformer<Struct> = () => {
  if (once) return;
  once = true;

  return [
    // Wolf asks for armor → player picks accept or decline
    getDialogPhrase(`${ACCEPT}_Wolf_1`, ACCEPT, 0, [
      { sid: `${ACCEPT}_Accepted_1`, terminate: false },
      { sid: `${ACCEPT}_Declined_1`, terminate: false },
    ]),
    // Player accepts
    getDialogPhrase(`${ACCEPT}_Accepted_1`, ACCEPT, -1, [{ sid: "", terminate: true }]),
    // Player declines
    getDialogPhrase(`${ACCEPT}_Declined_1`, ACCEPT, -1, [{ sid: "", terminate: true }]),
    // Player says "got your armor"
    getDialogPhrase(`${TURNIN}_Player_1`, TURNIN, -1, [{ sid: `${TURNIN}_Done_1`, terminate: false }]),
    // Wolf confirms and rewards
    getDialogPhrase(`${TURNIN}_Done_1`, TURNIN, 0, [{ sid: "", terminate: true }]),
  ];
};
transformDialogPrototypes.files = ["/DialogPrototypes/RookieVillage_Hub_volk_1_InfoTopic_1.cfg"];
