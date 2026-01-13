import { StashPrototype } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";
import { semiRandom } from "../../src/semi-random.mts";

export const transformStashPrototypes: StructTransformer<StashPrototype> = async (struct, { index }) => {
  if (struct.SID === "empty") {
    return;
  }

  const ItemGenerators = struct.ItemGenerators.map(([_k, e]) => {
    if (!e.SmartLootParams.ConsumablesParams) {
      return;
    }
    const fork = e.fork();
    fork.SmartLootParams = e.SmartLootParams.fork();
    fork.SmartLootParams.ConsumablesParams = e.SmartLootParams.ConsumablesParams.map(([_k, ie]) => {
      const fork = ie.fork();

      fork.MinSpawnChance = 0;
      if (ie.ItemSetCount) fork.ItemSetCount = 1;
      let maxSpawnChance = ie.MaxSpawnChance;

      while (maxSpawnChance > 0.2) maxSpawnChance /= Math.floor(semiRandom(index) * 8) + 2;
      fork.MaxSpawnChance = parseFloat(maxSpawnChance.toFixed(3));

      const Items = ie.Items.map(([_k, item]) => {
        if (!item) return;
        if (!item.MinCount && !item.MaxCount) return;

        const fork = item.fork();
        if (item.MinCount) fork.MinCount = 1;
        if (item.MaxCount) fork.MaxCount = 1;
        return fork;
      });

      if (!Items.entries().length) {
        return;
      }
      Items.__internal__.bpatch = true;
      fork.Items = Items;
      return fork;
    });
    fork.SmartLootParams.ConsumablesParams.__internal__.bpatch = true;
    return fork;
  });

  if (!ItemGenerators.entries().length) {
    return;
  }
  ItemGenerators.__internal__.bpatch = true;

  return Object.assign(struct.fork(), { ItemGenerators });
};

transformStashPrototypes.files = ["/StashPrototypes.cfg"];
