import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType = {
  description: `
Brings a tense, uneasy track from Cyberpunk 2077 to the pause menu and the title screen.

The whooshing sounds that play when you open the pause menu are gone, so the music comes through on its own.
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Fixed the mod failing to install from the Steam Workshop.",
  structTransformers: [],
};

/**
 * Wwise audio mod, see the eng-wwise skill and src/mod-wwise.mts.
 * The music heard in the pause menu is the Sound `S_UI_IdleScreen_Loop`
 * ({480D3274-9FF9-48FA-A9E3-7A162B84C759}, `Actor-Mixer Hierarchy\S2 Live\UI\GameInitialization\IntroLoadingScreen`),
 * played by `SFX_UI_IdleScreen` and `SFX_UI_IntroLoadingScreen` (EUISound::IdleScreen in
 * BaseGame_UISounds). Its source is `O\SFX\S2_Live\S_UI_IdleScreen_Loop_CP77.wav` (the track
 * +17 dB, about -24 LUFS like the vanilla loop).
 * `SFX_UI_PauseMenu_On` also gets the track on its muffled `S_UI_PauseMenu_Loop` bed
 * (`S_UI_PauseMenu_Loop_CP77.wav`, +13 dB, about -28 LUFS), and its Play actions for the
 * OneShot_Whoosh and OneShot_WhooshFire containers are deleted (the drone one-shot stays).
 * The Sounds keep their vanilla loop, lowpass and gain settings.
 */
