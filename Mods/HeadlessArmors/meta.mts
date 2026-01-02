import path from "node:path";
import dotEnv from "dotenv";
import { transformDynamicItemGenerator } from "./transformDynamicItemGenerator.mjs";
import { MetaContext, MetaType } from "../../src/meta-type.mts";
import { ArmorPrototype, DynamicItemGenerator, Struct } from "s2cfgtojson";
import { allExtraArmors, newArmors } from "./armors.util.mts";
import { allDefaultArmorPrototypesRecord } from "../../src/consts.mts";
import { backfillDef, getDots } from "../../src/backfill-def.mts";
import { deepMerge } from "../../src/deep-merge.mts";

dotEnv.config({ path: path.join(import.meta.dirname, "..", ".env") });

export const meta: MetaType<ArmorPrototype | DynamicItemGenerator> = {
  description: `
    This mod adds armor that does not include helmets, forcing players to wear helmets to have adequate protection.[h2][/h2]
    It also adds corresponding helmets for exoskeleton and heavy armors, to balance things out.[h2][/h2]
    The armor has no psi and reduced radiation protection, you need to rely on helmets for that.[h2][/h2]
    NPCs can now drop armor and helmets, traders don't sell them.[h2][/h2]
    These are mostly post-SIRCAA armors and helmets. Thus you can't see them in the first half of the game[h2][/h2]
    The chance of NPCs dropping armor is based on the armor's overall effectiveness, with cheaper armors being more likely to drop.[h2][/h2]
    [h2][/h2]
    For your convenience, here is a set of console commands to spawn the new headless armors directly:[h2][/h2]
    [h1][/h1]
    Armors:
    [list]
    [*] XSpawnItemNearPlayerBySID BattleExoskeleton_Varta_Armor_HeadlessArmors_headless
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Mercenaries_Armor_HeadlessArmors_headless
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Monolith_Armor_HeadlessArmors_headless
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Neutral_Armor_HeadlessArmors_headless
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Svoboda_Armor_HeadlessArmors_headless
    [*] XSpawnItemNearPlayerBySID Heavy_Dolg_Armor_HeadlessArmors_headless
    [*] XSpawnItemNearPlayerBySID Heavy2_Military_Armor_HeadlessArmors_headless
    [*] XSpawnItemNearPlayerBySID HeavyAnomaly_Monolith_Armor_HeadlessArmors_headless
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Dolg_Armor_HeadlessArmors_headless
    [*] XSpawnItemNearPlayerBySID Heavy_Svoboda_Armor_HeadlessArmors_headless
    [*] XSpawnItemNearPlayerBySID Heavy_Mercenaries_Armor_HeadlessArmors_headless
    [*] XSpawnItemNearPlayerBySID HeavyBattle_Spark_Armor_HeadlessArmors_headless
    [*] XSpawnItemNearPlayerBySID HeavyExoskeleton_Dolg_Armor_HeadlessArmors_headless
    [*] XSpawnItemNearPlayerBySID HeavyExoskeleton_Monolith_Armor_HeadlessArmors_headless
    [*] XSpawnItemNearPlayerBySID HeavyExoskeleton_Svoboda_Armor_HeadlessArmors_headless
    [*] XSpawnItemNearPlayerBySID HeavyExoskeleton_Varta_Armor_HeadlessArmors_headless
    [*] XSpawnItemNearPlayerBySID Battle_Dolg_End_Armor_HeadlessArmors_headless
    [/list]    [h1][/h1]
    Helmets: 
    [list]
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Mercenaries_Helmet_HeadlessArmors
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Monolith_Helmet_HeadlessArmors
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Neutral_Helmet_HeadlessArmors
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Spark_Helmet_HeadlessArmors
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Duty_Helmet_HeadlessArmors
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Svoboda_Helmet_HeadlessArmors
    [*] XSpawnItemNearPlayerBySID HeavyBattle_Spark_Helmet_HeadlessArmors
    [*] XSpawnItemNearPlayerBySID HeavyBattle_Merc_Helmet_HeadlessArmors
    [*] XSpawnItemNearPlayerBySID HeavyBattle_Dolg_Helmet_HeadlessArmors
    [/list] 
  `,
  changenote: "More variety in armor loadouts on later difficulties. Reworked a lot of backend systems to support easier extension.",
  structTransformers: [transformArmorPrototypes, transformDynamicItemGenerator],
};

const oncePerFile = new Set<string>();

/**
 * Adds armor that doesn't block head, but also removes any psy protection. Allows player to use helmets.
 */
export async function transformArmorPrototypes(struct: ArmorPrototype, context: MetaContext<ArmorPrototype>) {
  if (bannedids.has(struct.SID)) {
    return null;
  }
  const extraStructs: ArmorPrototype[] = [];

  if (!oncePerFile.has(context.filePath)) {
    oncePerFile.add(context.filePath);
    allExtraArmors.forEach((descriptor) => {
      const refkey = descriptor.__internal__.refkey;
      const newSID = descriptor.SID;

      const armor = allDefaultArmorPrototypesRecord[refkey] || allDefaultArmorPrototypesRecord[newArmors[refkey].__internal__.refkey];
      if (!armor) {
        return;
      }

      const newArmor = new Struct(
        backfillDef(
          {
            SID: newSID,
            __internal__: { rawName: newSID, refkey, refurl: newArmors[refkey] ? "" : `../${path.parse(context.filePath).base}` },
          },
          allDefaultArmorPrototypesRecord,
          newSID.toLowerCase().includes("helmet") ? "Light_Neutral_Helmet" : armor.SID,
        ),
      ) as ArmorPrototype;
      const overrides = { ...newArmors[newSID as keyof typeof newArmors] };
      if (overrides.__internal__?._extras && "keysForRemoval" in overrides.__internal__._extras) {
        Object.entries(overrides.__internal__._extras.keysForRemoval).forEach(([p, v]) => {
          const e = getDots(newArmor, p) || {};
          if (!Array.isArray(v)) {
            throw new Error("Expected array for keysForRemoval values");
          }
          const keysV = new Set(v);
          const keyToDelete = Object.keys(e).find((k) => keysV.has(e[k]));

          delete e[keyToDelete];
        });
      }
      deepMerge(newArmor, overrides);
      if (!(newArmors[newSID] && newArmors[newSID].__internal__._extras?.isDroppable)) {
        newArmor.Invisible = true;
      }
      const clone = newArmor.clone();
      clone.__internal__.isRoot = true;
      extraStructs.push(clone);
    });
  }

  return extraStructs;
}

transformArmorPrototypes.files = ["/ArmorPrototypes.cfg"];

const bannedids = new Set([
  "NPC_Richter_Armor",
  "NPC_Korshunov_Armor",
  "NPC_Korshunov_Armor_2",
  "NPC_Dalin_Armor",
  "NPC_Agata_Armor",
  "NPC_Faust_Armor",
  "NPC_Kaymanov_Armor",
  "NPC_Shram_Armor",
  "NPC_Dekhtyarev_Armor",
  "NPC_Sidorovich_Armor",
  "NPC_Barmen_Armor",
  "NPC_Batya_Armor",
  "NPC_Tyotya_Armor",
]);
