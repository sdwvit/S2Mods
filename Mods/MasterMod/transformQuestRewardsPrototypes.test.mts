import { describe, expect, it } from "vitest";
import { Struct } from "s2cfgtojson";

import { transformQuestRewardsPrototypes } from "./transformQuestRewardsPrototypes.mts";
import { QuestDataTable, rewardFormula } from "./rewardFormula.mts";

describe("transformQuestRewardsPrototypes", () => {
  it("grants a monetary reward from quest data table entries", async () => {
    const source = new Struct({
      SID: "RSQ00_Reward",
      MoneyGenerator: new Struct({ MinCount: 1, MaxCount: 1 }),
    });

    const transformed = await transformQuestRewardsPrototypes(source as any, {} as any);
    expect(Array.isArray(transformed)).toBe(true);

    const firstEntry = QuestDataTable.find((entry) => Number.isFinite(parseInt(entry["Suggested Reward"], 10)));
    expect(firstEntry).toBeDefined();

    const rewardStruct = (transformed as Struct[]).find((entry) => entry.SID === firstEntry!["Reward Gen SID"]);
    expect(rewardStruct).toBeDefined();

    const [expectedMin, expectedMax] = rewardFormula(parseInt(firstEntry!["Suggested Reward"], 10));
    expect(rewardStruct!.MoneyGenerator.MinCount).toBe(expectedMin);
    expect(rewardStruct!.MoneyGenerator.MaxCount).toBe(expectedMax);
  });
});
