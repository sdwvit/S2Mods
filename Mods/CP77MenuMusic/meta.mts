import { MetaType } from "../../src/meta-type.mts";
import { getModifiedFilesString } from "../../src/get-modified-files-by-folder.mts";

export const meta: MetaType = {
  description: `
Replaces pause menu music to a precarious one from CP77
`,
  changenote: "Initial release",
  structTransformers: [],
};

/**
 * /Stalker2/Content/_STALKER2/Audio/WwiseAudio/Media/166444733.wem - pause menu loop
 */

let b = {
  Name: "SFX_UI_PauseMenu_On",
  Value: [
    { path: "Media/82729869.wem", name: "S_UI_PauseMenu_OneShot_WhooshFire_04.wav" },
    { path: "Media/116239323.wem", name: "S_UI_PauseMenu_OneShot_Whoosh_06.wav" },
    { path: "Media/117524831.wem", name: "S_UI_PauseMenu_OneShot_WhooshFire_02.wav" },
    { path: "Media/155020427.wem", name: "S_UI_PauseMenu_OneShot_Drone_01.wav" },
    { path: "Media/166444733.wem", name: "S_UI_PauseMenu_Loop.wav" },
    { path: "Media/227327436.wem", name: "S_UI_PauseMenu_OneShot_Drone_02.wav" },
    { path: "Media/324049057.wem", name: "S_UI_PauseMenu_OneShot_Whoosh_03.wav" },
    { path: "Media/375234068.wem", name: "S_UI_PauseMenu_OneShot_WhooshFire_03.wav" },
    { path: "Media/489037618.wem", name: "S_UI_PauseMenu_OneShot_Whoosh_01.wav" },
    { path: "Media/496772260.wem", name: "S_UI_PauseMenu_OneShot_Whoosh_04.wav" },
    { path: "Media/518007607.wem", name: "S_UI_PauseMenu_OneShot_Whoosh_02.wav" },
    { path: "Media/539018321.wem", name: "S_UI_PauseMenu_OneShot_Whoosh_05.wav" },
    { path: "Media/868227669.wem", name: "S_UI_PauseMenu_OneShot_WhooshFire_01.wav" },
    { path: "Media/954302212.wem", name: "S_UI_PauseMenu_OneShot_Drone_03.wav" },
  ],
  MaximumDuration: 0.0,
  MinimumDuration: 0.0,
  IsInfinite: true,
};
let a = {
  Name: "SFX_UI_IntroLoadingScreen",
  Value: [
    { path: "Media/243071578.wem", name: "S_UI_Logos_Linear.wav" },
    { path: "Media/316627670.wem", name: "S_UI_IdleScreen_Loop.wav" },
  ],
  MaximumDuration: 0.0,
  MinimumDuration: 0.0,
  IsInfinite: true,
};
