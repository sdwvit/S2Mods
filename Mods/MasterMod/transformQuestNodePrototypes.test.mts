import { describe, expect, it } from "vitest";
import { Struct } from "s2cfgtojson";

import { transformQuestNodePrototypes } from "./transformQuestNodePrototypes.mts";
import { QuestDataTableByQuestSID } from "./rewardFormula.mts";

describe("transformQuestNodePrototypes", () => {
  it("keeps RSQ01_C03 money reward by patching SetItemGenerator directly", async () => {
    const expectedRewardSid = QuestDataTableByQuestSID.RSQ01_C03[0]["Reward Gen SID"];
    const source = new Struct({
      SID: "RSQ01_C03_SetItemGenerator_Player",
      QuestSID: "RSQ01_C03",
      NodeType: "EQuestNodeType::SetItemGenerator",
      ItemGeneratorSID: "RSQ00_reward_var1",
    });

    const transformed = await transformQuestNodePrototypes(source as any, { filePath: "/QuestNodePrototypes/RSQ01_C03.cfg" } as any);
    expect(Array.isArray(transformed)).toBe(true);

    const patchedOriginal = (transformed as Struct[]).find((entry) => entry.ItemGeneratorSID === expectedRewardSid);
    expect(patchedOriginal).toBeDefined();
    expect((transformed as Struct[]).some((entry) => entry.ItemGeneratorSID === "empty")).toBe(false);
  });
});
