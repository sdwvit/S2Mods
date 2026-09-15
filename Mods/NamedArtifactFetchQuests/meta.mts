import type { MetaType } from "../../src/meta-type.mts";
import { writeArtifactQuestLabelLocalization } from "./writeLocalization.mts";

export const meta: MetaType = {
  description: `
Repeatable side quest vendors offer artifact jobs behind labels like "Search for an artifact." - you only learn which artifact after taking the job.[h2][/h2]
This mod names it up front: every artifact fetch job is a 1:1 match with one dialog option and one artifact, so the option now reads "Get an artifact for a kingpin (Steak)".[h2][/h2]
Text only - no quest, dialog or item data is changed, so it is compatible with anything.

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for - it helps me understand what you're interested in.
`,
  changenote:
    "Initial release: every RSQ artifact fetch job names its artifact in the dialog option (English and Ukrainian; other languages get the English wording).",
  structTransformers: [],
  onFinish: writeArtifactQuestLabelLocalization,
};
