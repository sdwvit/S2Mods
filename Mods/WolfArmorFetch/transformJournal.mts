import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

let once = false;

/** A journal quest with one description and `stages`, each `<SID>_<stage>` described by `<SID>_<stage>_Description`. */
function journalQuest(SID: string, stages: string[]) {
  const Descriptions = new Struct();
  Descriptions.addNode(`${SID}_Description_0`);

  const Stages = new Struct() as Struct & Record<string, Struct>;
  for (const stage of stages) {
    const stageSID = `${SID}_${stage}`;
    const s = new Struct({ SID: stageSID, Description: `${stageSID}_Description`, Optional: false });
    s.__internal__.rawName = stageSID;
    Stages[stageSID] = s;
  }

  return new Struct({
    __internal__: { rawName: SID, isRoot: true },
    SID,
    Descriptions,
    LocationSID: "",
    Region: "ERegion::Zone",
    RewardTypes: "",
    ImagePath: "",
    MainQuest: false,
    Stages,
  });
}

export const transformJournal: StructTransformer<Struct> = () => {
  if (once) return;
  once = true;

  return [
    journalQuest("WolfArmorFetch_Decider", ["FindGun", "ReturnToWolf"]),
    journalQuest("WolfArmorFetch", ["FindArmor", "ReturnToWolf"]),
    journalQuest("WolfArmorFetch_Cover", ["FindGoBetween", "Meeting", "TakeDealerPDA", "ReturnToWolf"]),
  ];
};
transformJournal.files = ["/JournalQuestPrototypes/RSQ06_Journal.cfg"];
