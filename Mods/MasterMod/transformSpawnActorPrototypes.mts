import { GetStructType } from "s2cfgtojson";

/**
 * Removes preplaced items from the map. Like medkits, destructible items contents, and gear.
 */
export function transformSpawnActorPrototypes(entries: GearEntries, { file }: { file: string }) {
  if (!file.includes("SpawnActorPrototypes/WorldMap_WP/")) {
    return entries;
  }

  if (
    preplacedDestructibleItems.some((i) => entries.SpawnedPrototypeSID?.includes(i)) &&
    entries.SpawnType === "ESpawnType::DestructibleObject" &&
    entries.ItemGeneratorSettings
  ) {
    Object.values(entries.ItemGeneratorSettings.entries).forEach((e) => {
      Object.values(e.entries?.ItemGenerators.entries || {}).forEach((ie) => {
        if (ie.entries?.PrototypeSID) {
          console.info(`Found preplaced item generator: ${entries.SpawnedPrototypeSID}. Emptying it.`);
          ie.entries.PrototypeSID = "Milk";
        }
      });
    });
    return entries;
  }

  if (
    entries.ItemSID?.includes("Medkit") ||
    (entries.PackOfItemsPrototypeSID?.includes("Medkit") &&
      (entries.SpawnType === "ESpawnType::Item" || entries.SpawnType === "ESpawnType::PackOfItems"))
  ) {
    console.info(`Found preplaced item: ${entries.ItemSID || entries.PackOfItemsPrototypeSID}. Hiding it.`);
    const newEntries: any = {
      SpawnOnStart: false,
      SpawnType: entries.SpawnType,
      SID: entries.SID,
    };
    if (entries.ItemSID) {
      newEntries.ItemSID = entries.ItemSID;
    }
    if (entries.PackOfItemsPrototypeSID) {
      newEntries.PackOfItemsPrototypeSID = entries.PackOfItemsPrototypeSID;
    }
    return newEntries;
  }

  if (
    preplacedGear.some((i) => entries.ItemSID?.includes(i)) &&
    entries.SpawnType === "ESpawnType::Item" &&
    !attachments.has(entries.ItemSID)
  ) {
    console.info(`Found preplaced item: ${entries.ItemSID}. Hiding it.`);
    const newEntries: any = {
      SpawnOnStart: false,
      SpawnType: entries.SpawnType,
      SID: entries.SID,
    };
    if (entries.ItemSID) {
      newEntries.ItemSID = entries.ItemSID;
    }
    return newEntries;
  }

  return null;
}
export type GearEntries = {
  SpawnType: string;
  ItemSID: string;
  SID: string;
  SpawnOnStart: boolean;
  SpawnedPrototypeSID: string;
  ItemGeneratorSettings: GetStructType<
    {
      PlayerRank: "ERank::Newbie";
      ItemGenerators: { PrototypeSID: "DestructibleStash_Med" }[];
    }[]
  >;
  PackOfItemsPrototypeSID: string;
};
export const preplacedGear = ["Gun", "Armor", "Helmet"];
export const preplacedDestructibleItems = [
  "D_WoodenBox_01",
  "D_WoodenBox_02",
  "D_WoodenBox_03",
  "D_WoodenBox_04",
  "D_MetallCrate_01",
  "D_WoodenAmmoCrate_01",
  "D_WoodenDSPCrate_01",
  "D_WoodenDSPCrate_02",
  "D_WoodenDSPCrate_03",
];
export const attachments = new Set([
  "TemplateScope",
  "TemplateScopeX2",
  "TemplateScopeX4",
  "TemplateScopeX8",
  "RU_ColimScope_1",
  "EN_ColimScope_1",
  "EN_GoloScope_1",
  "RU_X2Scope_1",
  "EN_X2Scope_1",
  "RU_X4Scope_1",
  "EN_X4Scope_1",
  "RU_X8Scope_1",
  "EN_X8Scope_1",
  "Gauss_Scope",
  "M701_Scope",
  "M701_Colim_Scope",
  "SVDM_Scope",
  "G37_ScopeRail",
  "Gvintar_Scope",
  "SVU_Scope",
  "UDP_Deadeye_Colim",
  "Gun_Silence_ColimScope",
  "Gun_Sledgehummer_GoloScope",
  "Gun_Sotnyk_ColimScope",
  "GunThreeLine_Scope",
  "MuzzleTemplate",
  "DefaultMuzzleTemplate",
  "RU_SinMuz_1",
  "RU_SinMuz_2",
  "RU_SinMuz_3",
  "RU_SinMuz_4",
  "RU_SinMuz_5",
  "RU_AutMuz_1",
  "RU_AutMuz_2",
  "RU_AutMuz_3",
  "EN_SinMuz_1",
  "EN_SinMuz_2",
  "EN_SinMuz_3",
  "EN_SinMuz_4",
  "EN_SinMuz_5",
  "EN_AutMuz_1",
  "EN_AutMuz_2",
  "Zubr_SinMuz",
  "AKU_DefaultMuz",
  "Ram2_SinMuz_1",
  "Mark_DefaultMuz",
  "G37_DefaultMuz",
  "Kharod_DefaultMuz",
  "Fora_DefaultMuz",
  "AK74_DefaultMuz",
  "M16_DefaultMuz",
  "SVDM_DefaultMuz",
  "SVU_DefaultMuz",
  "Gauss_DefaultMuz",
  "Dnipro_DefaultMuz",
  "SilencerTemplate",
  "PistolSilencerTemplate",
  "SMGSilencerTemplate",
  "ARSilencerTemplate",
  "SRSilencerTemplate",
  "RU_Silen_1",
  "RU_Silen_2",
  "RU_Silen_3",
  "EN_Silen_1",
  "EN_Silen_2",
  "EN_Silen_3",
  "EN_Silen_4",
  "Sharpshooter_Silen",
  "Gun_Silence_Silen",
  "Sofmod_Silen",
  "GripTemplate",
  "RU_Grip_1",
  "RU_Grip_2",
  "RU_Grip_3",
  "EN_Grip_1",
  "EN_Grip_2",
  "EN_Grip_3",
  "LaserTemplate",
  "RU_Laser_1",
  "EN_Laser_1",
  "MagTemplate",
  "PairedMagTemplate",
  "BigMagTemplate",
  "HugeMagTemplate",
  "GunPM_MagDefault",
  "GunPM_MagIncreased",
  "GunUDP_MagDefault",
  "GunUDP_MagIncreased",
  "GunM10_MagDefault",
  "GunM10_MagIncreased",
  "Gun_GStreet_MagIncreased",
  "GunAPB_MagDefault",
  "GunAPB_MagIncreased",
  "GunKora_MagDefault",
  "GunKora_MagIncreased",
  "GunNightStalker_MagIncreased",
  "GunViper_MagDefault",
  "GunViper_MagIncreased",
  "Gun_Shakh_MagIncreased",
  "GunAKU_MagDefault",
  "GunAKU_Silence_MagDefault",
  "GunSpitfire_MagDefault",
  "GunAK_MagPaired",
  "GunDrowned_MagPaired",
  "GunBucket_MagDefault",
  "GunBucket_MagIncreased",
  "GunIntegral_MagDefault",
  "GunIntegral_MagIncreased",
  "GunZubr_MagDefault",
  "Gun_RatKiller_MagDefault",
  "GunZubr_MagIncreased",
  "GunAK74_MagDefault",
  "GunAK74_MagIncreased",
  "GunSotnyk_MagDefault",
  "GunM16_MagDefault",
  "GunM16_MagIncreased",
  "GunGP37_MagDefault",
  "GunGP37_MagPaired",
  "GunGP37_MagLarge",
  "GunFora_MagDefault",
  "GunDecider_MagDefault",
  "GunNovator_MagDefault",
  "GunFora_MagIncreased",
  "GunGrim_MagDefault",
  "GunS15_MagDefault",
  "GunGrim_MagIncreased",
  "GunGrim_MagLarge",
  "GunGvintar_MagDefault",
  "GunGvintar_MagIncreased",
  "GunKharod_MagDefault",
  "GunKharod_MagPaired",
  "GunLavina_MagDefault",
  "GunLavina_MagIncreased",
  "GunDnipro_MagDefault",
  "GunDnipro_MagPaired",
  "GunPKP_MagDefault",
  "GunPKP_MagIncreased",
  "GunPKP_MagLarge",
  "GunTank_MagLarge",
  "GunPKP_Korshunov_MagLarge",
  "GunM860_MagLarge",
  "GunD12_MagDefault",
  "GunD12_MagIncreased",
  "GunD12_MagPaired",
  "GunD12_MagLarge",
  "GunSVDM_MagDefault",
  "GunM701_MagDefault",
  "GunMark_MagDefault",
  "GunMark_MagIncreased",
  "GunSVU_MagDefault",
  "GunSVU_MagIncreased",
  "GunGauss_MagDefault",
  "GunGauss_MagIncreased",
  "GunGauss_Scar_MagHuge",
  "RailTemplate",
  "RailPicatiniGP37",
  "TopRailViper",
  "TopRailAKU",
  "TopRailM10",
  "TopRailM860",
  "TopRailSPSA",
  "TopRailD12",
  "TopRailAPB",
  "TopRailRhino",
  "GunBucket_TopRail",
  "GunSVU_ScopeRail",
  "TopRailZubr",
  "GunPM_Screw",
  "TopRailLavina",
  "TopRailLavinaAlternative",
  "TopRailPKP",
  "BottomRailM701",
  "M860LongGrip",
  "M860ShortGrip",
  "G37_BottomRail",
  "TopRailMark",
  "DefaultScopeGrim",
  "TopRailGrim",
  "TopRailKora",
  "MagFedM860",
  "IronsightTemplate",
  "Ironsights_01",
  "Ironsights_02",
  "Ironsights_03",
  "Ironsights_04",
  "G37_IronSight",
  "UnderbarrelTemplate",
  "RU_GLaunch_1",
  "EN_GLaunch_1",
  "EN_BuckLaunch_1",
  "GunGrim_GLaunch",
  "GunIntegral_FrontExtension",
]);
