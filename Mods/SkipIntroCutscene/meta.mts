import { GetStructType, Struct } from "s2cfgtojson";
import { Meta } from "../../helpers/prepare-configs.mjs";
type EntriesType = { SID: string; Launchers: GetStructType<{}> };
export const meta: Meta<Struct<EntriesType>> = {
  interestingFiles: ["E01_MQ01.cfg"],
  interestingContents: [],
  prohibitedIds: [],
  interestingIds: [],
  description: "",
  changenote: "",
  entriesTransformer: (entries: EntriesType) => {
    if (entries.SID === "E01_MQ01_Technical_NoIntro") {
      entries.Launchers = Struct.fromString(`
        Launchers : struct.begin
            [0] : struct.begin
               Excluding = false
               Connections : struct.begin
                  [0] : struct.begin
                     SID = E01_MQ01_Start
                     Name =
                  struct.end
               struct.end
            struct.end
         struct.end
      `)[0];
      entries.Launchers.isRoot = false;
      return entries;
    }
    if (entries.SID === "E01_MQ01_PlayVideo") {
      entries.Launchers = Struct.fromString(`
        Launchers : struct.begin
            [0] : struct.begin
               Excluding = false
               Connections : struct.begin
                  [0] : struct.begin
                     SID =
                     Name =
                  struct.end
               struct.end
            struct.end
         struct.end
      `)[0];
      entries.Launchers.isRoot = false;
      return entries;
    }
    return null;
  },
};
