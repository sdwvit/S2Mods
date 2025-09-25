import { QuestNodePrototype, Struct } from "s2cfgtojson";
import { Meta } from "../../helpers/prepare-configs.mjs";
type EntriesType = QuestNodePrototype["entries"];
export const meta: Meta = {
  interestingFiles: ["E01_MQ01.cfg", "FastTravelPrototypes.cfg"],
  interestingContents: [],

  description: "",
  changenote: "",
  entriesTransformer: (entries: EntriesType, context) => {
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
