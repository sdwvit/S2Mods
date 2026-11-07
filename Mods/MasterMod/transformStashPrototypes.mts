import type { StashPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { semiRandom } from "../../src/semi-random.mts";
import { scarceSetFactor } from "./scarcity.mts";

export const transformStashPrototypes: StructTransformer<StashPrototype> = async (struct, { index }) => {
  if (struct.SID === "empty") {
    return;
  }

  const ItemGenerators = struct.ItemGenerators.map(([_k, e]) => {
    const { ConsumablesParams, GrenadesParams } = e.SmartLootParams || {};
    if (!ConsumablesParams && !GrenadesParams) {
      return;
    }
    const fork = e.fork();
    fork.SmartLootParams = e.SmartLootParams.fork();
    if (ConsumablesParams) {
      fork.SmartLootParams.ConsumablesParams = ConsumablesParams.map(([_k, ie]) => {
        const fork = ie.fork();

        fork.MinSpawnChance = 0;
        if (ie.ItemSetCount) fork.ItemSetCount = 1;
        let maxSpawnChance = ie.MaxSpawnChance;

        while (maxSpawnChance > 0.2) maxSpawnChance /= Math.floor(semiRandom(index) * 8) + 2;
        maxSpawnChance *= scarceSetFactor(ie.Items.entries().map(([_k, item]) => item));
        fork.MaxSpawnChance = parseFloat(maxSpawnChance.toFixed(4));

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
    }
    if (GrenadesParams) {
      const grenades = GrenadesParams.map(([_k, ie]) => {
        const factor = scarceSetFactor(ie.Items.entries().map(([_k, item]) => item));
        if (factor === 1 || !ie.MaxSpawnChance) return;
        const fork = ie.fork();
        fork.MaxSpawnChance = parseFloat((ie.MaxSpawnChance * factor).toFixed(4));
        fork.MinSpawnChance = parseFloat(((ie.MinSpawnChance || 0) * factor).toFixed(4));
        return fork;
      });
      if (grenades.entries().length) {
        grenades.__internal__.bpatch = true;
        fork.SmartLootParams.GrenadesParams = grenades;
      }
    }
    if (!fork.SmartLootParams.ConsumablesParams && !fork.SmartLootParams.GrenadesParams) {
      return;
    }
    return fork;
  });

  if (!ItemGenerators.entries().length) {
    return;
  }
  ItemGenerators.__internal__.bpatch = true;

  return Object.assign(struct.fork(), { ItemGenerators });
};

transformStashPrototypes.files = ["/StashPrototypes.cfg"];
