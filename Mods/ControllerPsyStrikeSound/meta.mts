import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType = {
  description: `
Gives the controller's ranged psy strike a new set of sounds. Every strike that lands plays one of six new takes, in a fixed rotation.
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "The psy strike now plays only new sounds.",
  structTransformers: [],
};

/**
 * Wwise audio mod, see the eng-wwise skill and src/mod-wwise.mts.
 * The psy strike hit is `SFX_Controller_PsyStrike_Seccess` ({55736A04-E2F6-4C5D-89CE-267A8CD7B3F8}, 2875594258),
 * playing the container `S_Controller_PsyStrike_Seccess` ({0BC053C0-98FC-43A3-AE65-FC278E7EBC4D},
 * `Actor-Mixer Hierarchy\S2 Live\Mutants\Controller\Controller Voice\Controller Voice`).
 * The container is switched from random to a step sequence with Global scope, and its vanilla Sounds
 * (_01.._06) are deleted. It holds six new Sounds, `S_Controller_PsyStrike_Seccess_Phase{2,3,2_2,3_2,2_3,3_3}`
 * (media 866918276, 653746826, 424433282, 65017270, 354330031, 301386538), played in that order, so the
 * order runs across all controllers. Sources are `wwise/source/S_Controller_PsyStrike_Seccess_Phase*.wav`
 * ("Stalker 2 Controller Attack (Phase 2/3)[-2/-3].wav" from 2026-10-25: 10 Hz high-pass for DC, then
 * gain to -17.2 LUFS like the vanilla variations through a -1.5 dBFS limiter). The container's ±200 cent
 * pitch randomizer applies to them too. Its make-up gain is raised from vanilla's -2 dB to +4 dB: at matched
 * loudness a tester found them too quiet (2026-10-24).
 * Banks were generated from a trimmed copy at /media/nvme/vm/wwise-trim/ControllerPsy, whose
 * Originals folder holds the new wavs. WAAPI can't set `@Playlist`, so the
 * playlist entries were edited in the .wwu.
 */
