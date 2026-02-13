import path from "node:path";
import dotEnv from "dotenv";
import { transformDynamicItemGenerator } from "./transformDynamicItemGenerator.mjs";
import { MetaType } from "../../src/meta-type.mts";
import { ArmorPrototype, ItemGeneratorPrototype } from "s2cfgtojson";
import { transformArmorPrototypes } from "./transformArmorPrototypes.mts";

dotEnv.config({ path: path.join(import.meta.dirname, "..", ".env") });

export const meta: MetaType<ArmorPrototype | ItemGeneratorPrototype> = {
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
  changenote: `Override existing spawning armors.`,
  structTransformers: [transformArmorPrototypes, transformDynamicItemGenerator],
};
