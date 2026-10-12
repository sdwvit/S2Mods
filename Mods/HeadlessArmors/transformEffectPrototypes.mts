import { Struct } from "s2cfgtojson";
import type { EDuplicateResolveType, EEffectType, EffectPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

/**
 * Permanent flag effect the mod's blueprint applies to the player on every world load, so other mods
 * can detect HeadlessArmors. See DesignDocs/DetectInstalledModSpec.md.
 */
export const INSTALLED_EFFECT_SID = "HeadlessArmorsInstalled";

let oncePerFile = false;

export const transformEffectPrototypes: StructTransformer<EffectPrototype> = (struct) => {
  if (oncePerFile || struct.__internal__.rawName !== "[0]") {
    return null;
  }

  oncePerFile = true;
  const effect = new Struct() as EffectPrototype;
  effect.SID = INSTALLED_EFFECT_SID;
  effect.Text = INSTALLED_EFFECT_SID;
  effect.Type = "EEffectType::FlagEffect" as EEffectType;
  effect.bIsPermanent = true;
  effect.DuplicationType = "EDuplicateResolveType::KeepOld" as EDuplicateResolveType;
  effect.ShowUpgradeEffect = false;
  effect.__internal__.rawName = INSTALLED_EFFECT_SID;
  effect.__internal__.refkey = "[0]";
  effect.__internal__.isRoot = true;
  return [effect];
};

transformEffectPrototypes.files = ["/EffectPrototypes.cfg"];
