import { Struct } from "s2cfgtojson";
import { Meta } from "../../helpers/prepare-configs.mjs";
type EntriesType = { SID: string };
export const meta: Meta<Struct<EntriesType>> = {
  interestingFiles: [],
  interestingContents: [],
  prohibitedIds: [],
  interestingIds: [],
  description: "This mod does only one thing: it removes dead body markers from the compass.",
  changenote: "Initial release attempt 2",
  entriesTransformer: (entries: EntriesType) => entries,
};
