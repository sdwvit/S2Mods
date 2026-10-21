import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType = {
  description: `
Gives the controller's ranged psy strike a new sound. Every other strike that lands plays it, and the vanilla sounds take the turns in between.
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "New strike sounds.",
  structTransformers: [],
};

/**
 * Wwise audio mod, see the eng-wwise skill and src/mod-wwise.mts.
 * The psy strike hit is `SFX_Controller_PsyStrike_Seccess` ({55736A04-E2F6-4C5D-89CE-267A8CD7B3F8}, 2875594258),
 * playing the container `S_Controller_PsyStrike_Seccess` ({0BC053C0-98FC-43A3-AE65-FC278E7EBC4D},
 * `Actor-Mixer Hierarchy\S2 Live\Mutants\Controller\Controller Voice\Controller Voice`).
 * The container is switched from random to a step sequence with Global scope, and gets two new Sounds:
 * `S_Controller_PsyStrike_Seccess_Phase2` (media 866918276) and `S_Controller_PsyStrike_Seccess_Phase3`
 * (media 653746826). Its playlist runs _01, Phase2, _02, Phase3, ... _06, Phase3, so the order runs
 * across all controllers. Sources are `wwise/source/S_Controller_PsyStrike_Seccess_Phase{2,3}.wav`
 * ("Stalker 2 Controller Attack (Phase 2/3).wav" from 2026-10-21: 10 Hz high-pass for DC, then
 * Phase 2 -1.1 dB and Phase 3 +1.6 dB through a -1.5 dBFS limiter, -17.2 LUFS like the vanilla
 * variations). The container's ±200 cent pitch randomizer and -2 dB make-up gain apply to them too.
 * Banks were generated from a trimmed copy at /media/nvme/vm/wwise-trim/ControllerPsy, whose
 * Originals folder holds the six vanilla wavs plus both phases. WAAPI can't set `@Playlist`, so the
 * playlist entries were edited in the .wwu.
 */
