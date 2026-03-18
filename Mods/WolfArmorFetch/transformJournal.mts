import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

let once = false;

export const transformJournal: StructTransformer<Struct> = () => {
  if (once) return;
  once = true;

  const Descriptions = new Struct();
  Descriptions.addNode("WolfArmorFetch_Description_0");

  const FindArmor = new Struct({ SID: "WolfArmorFetch_FindArmor", Description: "WolfArmorFetch_FindArmor_Description", Optional: false });
  FindArmor.__internal__.rawName = "WolfArmorFetch_FindArmor";

  const ReturnToWolf = new Struct({ SID: "WolfArmorFetch_ReturnToWolf", Description: "WolfArmorFetch_ReturnToWolf_Description", Optional: false });
  ReturnToWolf.__internal__.rawName = "WolfArmorFetch_ReturnToWolf";

  const Stages = new Struct() as Struct & Record<string, Struct>;
  Stages["WolfArmorFetch_FindArmor"] = FindArmor;
  Stages["WolfArmorFetch_ReturnToWolf"] = ReturnToWolf;

  return new Struct({
    __internal__: { rawName: "WolfArmorFetch", isRoot: true },
    SID: "WolfArmorFetch",
    Descriptions,
    LocationSID: "",
    Region: "ERegion::Zone",
    RewardTypes: "",
    ImagePath: "",
    MainQuest: false,
    Stages,
  });
};
transformJournal.files = ["/JournalQuestPrototypes/RSQ06_Journal.cfg"];
