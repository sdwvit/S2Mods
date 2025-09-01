import { Meta } from "../../helpers/prepare-configs.mjs";
type EntriesType = { SID: string };
export const meta: Meta = {
  interestingFiles: [],
  interestingContents: [],

  description: `This mod removes threat indicators. Meaning you can no longer see any markers, blue or red compass shadow indicating the presence or absence of enemies or their direction.
     ---
     Let's make the game scary again.
      ---
      It is meant to be used in other collections of mods. 
      Does not conflict with anything, well except for mods that modify compass textures.`,
  changenote: "Remove sound bar, even less indication that you are in/out of combat.",
  entriesTransformer: (entries: EntriesType) => entries,
};
