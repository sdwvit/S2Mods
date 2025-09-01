import { Meta } from "../../helpers/prepare-configs.mjs";
type EntriesType = { SID: string };
export const meta: Meta = {
  interestingFiles: [],
  interestingContents: [],

  description: "This mod does only one thing: it removes dead body markers from the compass.",
  changenote: "Initial release attempt 2",
  entriesTransformer: (entries: EntriesType) => entries,
};
