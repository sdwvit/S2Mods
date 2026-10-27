import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformSQ03DialogLinzaGivesReward } from "./transformSQ03DialogLinzaGivesReward.mts";

export const meta: MetaType<Struct> = {
  description: `
Fixes Lens's verdict at the end of The Lost Boys: he no longer says you took the wrong side when you didn't.[h1][/h1]
[hr][/hr]
[list]
[*] Lens judged the outcome by checking the target on the spot. By the time you report back, that check fails, so he scolded players who had done the job.
[*] He now also checks the quest's own record of how it ended, which survives saves and travel.
[*] Cfg only; works on saves where the quest is still waiting for the report to Lens.
[/list]
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release.",
  structTransformers: [
    transformSQ03DialogLinzaGivesReward,
  ] as MetaType<Struct>["structTransformers"],
};
