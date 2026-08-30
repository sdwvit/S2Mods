import { Refs, Struct } from "s2cfgtojson";
import type {
  ItemGeneratorPrototype,
  WeaponGeneralSetupPrototype,
  ItemGeneratorPrototypeItemGeneratorItem,
  WeaponGeneralSetupPrototypePreinstalledAttachmentsItemPrototypeSIDsItem,
  WeaponPrototype,
  QuestNodePrototypeSetItemGenerator,
} from "s2cfgtojson";
import type { MetaContext, MetaType } from "../../src/meta-type.mts";
import { waitFor } from "../../src/wait-for.mts";
import {
  allDefaultDroppableAttachments,
  guessAttachmentSlot,
  allUniqueWeaponGeneralSetupPrototypesSIDs,
} from "../../src/consts.mts";
import type { DeeplyPartial } from "../../src/consts.mts";
const finishedTransformers = new Set<string>();

export const meta: MetaType = {
  description: `
Adds all 357 possible weapons with attachments combos to NPCs. 
[hr][/hr]
Way more variety to what NPCs wield on the battlefield. That being friend or foe. 
[h1][/h1]
Attachments are still rare: 1-attachment weapons are 10x rarer than base, each extra attachment is 10x rarer than the previous (so 2 attachments = 100x rarer, 3 = 1000x rarer than base).
[h1][/h1]
For debugging, this console command rolls every NPC weapon generator this mod touches straight into Skif's inventory:
[h2][/h2]
[u]XStartQuestNodeBySID Skif_Give_All_NPC_Weapons[/u]

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote:
    "Fixed the generated Attaches/Upgrades nodes on NPC weapon rolls not being marked as patch structs, which could make the added attachment combos fail to apply on top of the base game's item generators.",
  structTransformers: [
    createWeaponParamsWithPreinstalledAttachments,
    createWeapons,
    addNewWeaponsToDynamicItemGenerators,
    transformSkifItemGeneratorQuestNodes,
  ],
  onTransformerFinish(transformer) {
    finishedTransformers.add(transformer.name);
  },
};

/**
 * I need to create WeaponGeneralSetupPrototypes for each weapon-attachment combo
 * Then I need to create Weapon items with corresponding WeaponGeneralSetupPrototype
 * Then I need to modify DynamicItemGeneratorPrototypes to add these new weapons to NPCs
 */

function getCombinations(items: string[]) {
  const result: { slots: Set<string>; items: string[] }[] = [];

  const currentItems: string[] = [];
  const usedSlots = new Set<string>();

  function build(startIndex: number) {
    for (let i = startIndex; i < items.length; i++) {
      const item = items[i];

      const slot = guessAttachmentSlot(item);
      if (!slot) continue;
      if (usedSlots.has(slot)) continue;

      // choose
      currentItems.push(item);
      usedSlots.add(slot);

      // record snapshot
      result.push({
        items: [...currentItems],
        slots: new Set(usedSlots),
      });

      // explore
      build(i + 1);

      // un-choose
      usedSlots.delete(slot);
      currentItems.pop();
    }
  }

  build(0);
  return result;
}

const newlyCreatedWeaponParamsWithPreinstalledAttachments: Record<
  string,
  WeaponGeneralSetupPrototype[]
> = {};
const requiredUpgradesRecord: Record<string, string[]> = {};

const newWeaponAttachCount: Record<string, number> = {};
const newWeaponAttachItems: Record<string, string[]> = {};
/**
 * 1
 */
function createWeaponParamsWithPreinstalledAttachments(
  struct: WeaponGeneralSetupPrototype,
  context: MetaContext<WeaponGeneralSetupPrototype>,
) {
  if (!struct.CompatibleAttachments || allUniqueWeaponGeneralSetupPrototypesSIDs.has(struct.SID)) {
    return;
  }

  const compatibleDroppableAttachments = struct.CompatibleAttachments.filter(([_, a]) =>
    allDefaultDroppableAttachments.has(a.AttachPrototypeSID),
  );
  if (!compatibleDroppableAttachments.entries().length) {
    return;
  }
  const extraStructs = [];
  const compatibleDroppableAttachmentsRecord = Object.fromEntries(
    compatibleDroppableAttachments.entries().map((e) => [e[1].AttachPrototypeSID, e[1]]),
  );
  // Build lookup: attachment SID → set of upgrade IDs that block it
  const blockingUpgradesByAttach = new Map<string, Set<string>>();
  struct.CompatibleAttachments.entries().forEach(([_, a]) => {
    if (a.BlockingUpgradeIds) {
      blockingUpgradesByAttach.set(
        a.AttachPrototypeSID,
        new Set(a.BlockingUpgradeIds.entries().map((e) => e[1])),
      );
    }
  });
  const combos = getCombinations(
    compatibleDroppableAttachments.entries().map((e) => e[1].AttachPrototypeSID),
  );
  combos.forEach(({ items }) => {
    const requiredUpgrades = items
      .map((a) =>
        compatibleDroppableAttachmentsRecord[a].RequiredUpgradeIDs?.entries().map((e) => e[1]),
      )
      .flat()
      .filter((e) => !!e);
    const requiredUpgradesSet = new Set(requiredUpgrades);
    const newSID = `${struct.SID}_with_${items.join("_")}`;

    // Filter out base preinstalled attachments that are blocked by required upgrades
    const basePreinstalled = (
      struct.PreinstalledAttachmentsItemPrototypeSIDs?.entries().map((e) => e[1]) || []
    ).filter((a) => {
      const blocking = blockingUpgradesByAttach.get(a.AttachSID);
      if (!blocking) return true;
      for (const u of requiredUpgradesSet) {
        if (blocking.has(u)) return false;
      }
      return true;
    });

    const toTransfer = struct
      .entries()
      .filter(([k, e]) => {
        if (e instanceof Struct && e.__internal__.bskipref) {
          return true;
        }
      })
      .map(([k]) => k);

    let CompatibleAttachments;
    CompatibleAttachments = struct.CompatibleAttachments.clone();
    CompatibleAttachments.__internal__ = new Refs(CompatibleAttachments.__internal__.rawName);
    let UpgradePrototypeSIDs;
    UpgradePrototypeSIDs = struct.UpgradePrototypeSIDs?.clone();
    if (UpgradePrototypeSIDs) {
      UpgradePrototypeSIDs.__internal__ = new Refs(UpgradePrototypeSIDs.__internal__.rawName);
    }

    const newWeaponSetup = new Struct({
      __internal__: {
        refkey: struct.SID,
        refurl: "../" + context.fileName,
        isRoot: true,
        rawName: newSID,
      },
      ...toTransfer.reduce((mem, e) => {
        mem[e] = (struct[e] as Struct).clone();
        mem[e].__internal__ = new Refs(mem[e].__internal__.rawName);
        return mem;
      }, {}),
      SID: newSID,
      PreinstalledAttachmentsItemPrototypeSIDs: [
        ...items.map((AttachSID) => {
          return {
            AttachSID,
            bHiddenInInventory: false,
          } as Partial<WeaponGeneralSetupPrototypePreinstalledAttachmentsItemPrototypeSIDsItem>;
        }),
        ...basePreinstalled,
      ],
    } as DeeplyPartial<WeaponGeneralSetupPrototype>) as WeaponGeneralSetupPrototype;
    newWeaponAttachCount[newWeaponSetup.SID] = items.length;
    newWeaponAttachItems[newWeaponSetup.SID] = items;
    newlyCreatedWeaponParamsWithPreinstalledAttachments[struct.SID] ||= [];
    newlyCreatedWeaponParamsWithPreinstalledAttachments[struct.SID].push(newWeaponSetup);
    requiredUpgradesRecord[newWeaponSetup.SID] = requiredUpgrades;
    extraStructs.push(newWeaponSetup);
  });

  return extraStructs;
}

createWeaponParamsWithPreinstalledAttachments.files = ["/WeaponGeneralSetupPrototypes.cfg"];

const newlyCreatedWeaponsRarity: Record<string, number> = {};
/**
 * For each generated weapon variant: how to reproduce it through the vanilla
 * ItemGenerator Attaches/Upgrades system instead of a dedicated weapon prototype.
 */
const newWeaponGenerationRecipe: Record<
  string,
  { baseItemPrototypeSID: string; attaches: string[]; upgrades: string[] }
> = {};
const newlyCreatedWeaponsWithPreinstalledAttachments: Record<string, WeaponPrototype[]> = {};
/**
 * 2
 */
async function createWeapons(struct: WeaponPrototype) {
  await waitFor(() => finishedTransformers.has(createWeaponParamsWithPreinstalledAttachments.name));

  if (!newlyCreatedWeaponParamsWithPreinstalledAttachments[struct.GeneralWeaponSetup]) {
    return;
  }
  const extraStructs = [];
  newlyCreatedWeaponParamsWithPreinstalledAttachments[struct.GeneralWeaponSetup].forEach(
    (newlyCreatedWeaponParamsWithPreinstalledAttachment) => {
      const newSID = `${struct.SID}_withGWS_${newlyCreatedWeaponParamsWithPreinstalledAttachment.SID}`;
      const newWeapon = new Struct({
        __internal__: {
          refkey: struct.SID,
          isRoot: true,
          rawName: newSID,
        },
        LocalizationSID: struct.LocalizationSID || struct.SID,
        GeneralWeaponSetup: newlyCreatedWeaponParamsWithPreinstalledAttachment.SID,
        PreinstalledUpgrades:
          requiredUpgradesRecord[newlyCreatedWeaponParamsWithPreinstalledAttachment.SID],
        SID: newSID,
      } as DeeplyPartial<WeaponPrototype>) as WeaponPrototype;
      if (!requiredUpgradesRecord[newlyCreatedWeaponParamsWithPreinstalledAttachment.SID].length) {
        delete newWeapon.PreinstalledUpgrades;
      }
      newlyCreatedWeaponsWithPreinstalledAttachments[struct.SID] ||= [];
      newlyCreatedWeaponsWithPreinstalledAttachments[struct.SID].push(newWeapon);

      const attachCount =
        newWeaponAttachCount[newlyCreatedWeaponParamsWithPreinstalledAttachment.SID];
      newlyCreatedWeaponsRarity[newWeapon.SID] = 1 / (10 * Math.pow(10, attachCount - 1));
      newWeaponGenerationRecipe[newWeapon.SID] = {
        baseItemPrototypeSID: struct.SID,
        attaches: newWeaponAttachItems[newlyCreatedWeaponParamsWithPreinstalledAttachment.SID],
        upgrades:
          requiredUpgradesRecord[newlyCreatedWeaponParamsWithPreinstalledAttachment.SID] || [],
      };
      extraStructs.push(newWeapon);
    },
  );

  return extraStructs;
}

createWeapons.files = ["/WeaponPrototypes.cfg"];

/**
 * 3
 */
async function addNewWeaponsToDynamicItemGenerators(struct: ItemGeneratorPrototype) {
  if (struct.SID.includes("Trade") || !struct.ItemGenerator) {
    return;
  }

  await waitFor(() => finishedTransformers.has(createWeapons.name));
  const fork = struct.fork();
  struct.ItemGenerator.forEach(([k1, ig]) => {
    ig.PossibleItems.forEach(([k2, pi]) => {
      const newWeapons = newlyCreatedWeaponsWithPreinstalledAttachments[pi.ItemPrototypeSID];
      if (!newWeapons?.length) {
        return;
      }
      fork.ItemGenerator ||= struct.ItemGenerator.fork();
      fork.ItemGenerator.__internal__.useAsterisk = false;
      fork.ItemGenerator[k1] ||= struct.ItemGenerator[
        k1
      ].fork() as ItemGeneratorPrototypeItemGeneratorItem;
      // fork.ItemGenerator[k1].bAllowSameCategoryGeneration = true;
      const baseChance = struct.ItemGenerator[k1].PossibleItems[k2].Chance;
      const baseWeight = struct.ItemGenerator[k1].PossibleItems[k2].Weight;

      newWeapons.forEach((weapon) => {
        const rarity = newlyCreatedWeaponsRarity[weapon.SID];
        const recipe = newWeaponGenerationRecipe[weapon.SID];
        if (!recipe?.attaches.length) {
          return;
        }

        const newOption = struct.ItemGenerator[k1].PossibleItems[k2].clone();
        // Scale whichever field the base entry actually uses: Weight for weighted
        // pick-one lists, Chance for independently rolled entries. Writing Weight on a
        // Chance-based entry leaves the cloned Chance untouched, which would make the
        // variant spawn unconditionally on top of the base weapon.
        if (baseWeight > 0) {
          newOption.Weight = rarity * baseWeight;
        } else if (baseChance > 0) {
          newOption.Chance = rarity * baseChance;
        } else {
          return;
        }
        // The base weapon is generated as-is; the attachments (and the upgrades they
        // require) are applied by the vanilla ItemGenerator Attaches/Upgrades system.
        newOption.ItemPrototypeSID = recipe.baseItemPrototypeSID;
        newOption.addNode(
          new Struct({
            MinCount: recipe.attaches.length,
            MaxCount: recipe.attaches.length,
            Chance: 1,
            PossibleItems: recipe.attaches.join(", "),
          }),
          "Attaches",
        );
        newOption.Attaches.__internal__.bpatch = true;
        if (recipe.upgrades.length) {
          newOption.addNode(
            new Struct({
              MinCount: recipe.upgrades.length,
              MaxCount: recipe.upgrades.length,
              Chance: 1,
              PossibleItems: recipe.upgrades.join(", "),
            }),
            "Upgrades",
          );
          newOption.Upgrades.__internal__.bpatch = true;
        }

        fork.ItemGenerator[k1].PossibleItems ||= struct.ItemGenerator[k1].PossibleItems.fork();
        fork.ItemGenerator[k1].PossibleItems.__internal__.useAsterisk = false;

        fork.ItemGenerator[k1].PossibleItems.addNode(newOption, weapon.SID);
      });
    });
  });
  if (fork.entries().length) {
    patchedDynamicItemGeneratorSIDs.push(struct.SID);
    return fork;
  }
}

addNewWeaponsToDynamicItemGenerators.files = ["/DynamicItemGenerator.cfg"];

const SKIF_QUEST_GUID = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const SKIF_CHAIN_ENTRY_NODE_SID = "Skif_Give_All_NPC_Weapons";
/** SIDs of the vanilla dynamic generators this mod actually injected variants into. */
const patchedDynamicItemGeneratorSIDs: string[] = [];

let addQuestOnce = false;
/**
 * 4
 * Debug quest nodes: one SetItemGenerator node per dynamic generator this mod patched,
 * chained so each launches the next. A single generator holding them as sub-generators
 * does not work - the categories are exclusive, so only the first weapon is rolled.
 * Use with console: XStartQuestNodeBySID Skif_Give_All_NPC_Weapons
 */
async function transformSkifItemGeneratorQuestNodes(s) {
  if (addQuestOnce) {
    return;
  }
  addQuestOnce = true;

  await waitFor(() => finishedTransformers.has(addNewWeaponsToDynamicItemGenerators.name));

  const entryNode = new Struct({
    SID: SKIF_CHAIN_ENTRY_NODE_SID,
    QuestSID: s.QuestSID,
    NodeType: "EQuestNodeType::Technical",
    StartDelay: 0,
    __internal__: { isRoot: true, rawName: SKIF_CHAIN_ENTRY_NODE_SID },
  }) as Struct;

  let previousNodeSID = SKIF_CHAIN_ENTRY_NODE_SID;
  const nodes = patchedDynamicItemGeneratorSIDs.map((itemGeneratorSID) => {
    const nodeSID = `Skif_${itemGeneratorSID}`;
    const node = new Struct({
      SID: nodeSID,
      QuestSID: s.QuestSID,
      NodeType: "EQuestNodeType::SetItemGenerator",
      Launchers: [
        {
          Excluding: false,
          Connections: [{ SID: previousNodeSID, Name: "" }],
        },
      ],
      TargetQuestGuid: SKIF_QUEST_GUID,
      ReplaceInventory: false,
      EquipItems: false,
      Repeatable: true,
      ItemGeneratorSID: itemGeneratorSID,
      __internal__: { isRoot: true, rawName: nodeSID },
    }) as QuestNodePrototypeSetItemGenerator;
    previousNodeSID = nodeSID;
    return node;
  });

  return [entryNode, ...nodes];
}

transformSkifItemGeneratorQuestNodes.files = ["/QuestNodePrototypes/A-life_interrupts.cfg"];
