import { installedEffectSid } from "../../src/announce-installed.mts";

/**
 * Flag effect the mod's blueprint applies to the player on every world load, so other mods can
 * detect HeadlessArmors. Every mod gets one (src/announce-installed.mts); the SID is exported here
 * so WolfArmorFetch can import it. See DesignDocs/DetectInstalledModSpec.md.
 */
export const INSTALLED_EFFECT_SID = installedEffectSid("HeadlessArmors");
