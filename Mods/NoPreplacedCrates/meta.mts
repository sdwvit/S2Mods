import { GetStructType } from "s2cfgtojson";
import { Meta } from "../../helpers/prepare-configs.mjs";

type StructType = GetStructType<{
  SID: "0000B69C4A787F9D193CE09A2ACF8951";
  SpawnOnStart: true;
  PositionX: 421537.56039;
  PositionY: 455435.438699;
  PositionZ: 983.549165;
  RotatorAngleYaw: 109.609256;
  RotatorAnglePitch: 0;
  RotatorAngleRoll: 0;
  ScaleX: 1;
  ScaleY: 1;
  ScaleZ: 1;
  TextAboveActor: "";
  DLC: "None";
  LevelName: "WorldMap_WP";
  PlaceholderActorGuid: "3C6R39Y6TU6XL28SI8B9RATPB";
  PlaceholderMapPath: "/Game/_Stalker_2/maps/_Stalker2_WorldMap/WorldMap_WP";
  MeshPath: "StaticMesh'/Game/_Stalker_2/props/general/boxes/SM_gen_loot_metalcrate_dm.SM_gen_loot_metalcrate_dm'";
  SpawnedPrototypeSID: "D_MetallCrate_01";
  SpawnType: "ESpawnType::DestructibleObject";
  bForceCodePhysicsDisabled: false;
  bWakeUpOnStart: false;
  StashPrototypeSID: "";
  ItemGeneratorSettings: {
    PlayerRank: "ERank::Newbie";
    ItemGenerators: { PrototypeSID: "DestructibleStash_Med" }[];
  }[];
  TileOffsetIndex: 58;
}>;

const items = ["D_WoodenBox_01", "D_WoodenBox_02", "D_WoodenBox_03", "D_WoodenBox_04", "D_MetallCrate_01", "D_WoodenAmmoCrate_01", "D_WoodenDSPCrate_01", "D_WoodenDSPCrate_02", "D_WoodenDSPCrate_03"];
const spawnTypes = ["ESpawnType::DestructibleObject"];

export const meta: Meta = {
  interestingFiles: ["WorldMap_WP"],
  interestingContents: [...items],

  description: "",
  changenote: "",
  entriesTransformer(entries, context) {
    const entriesT = entries as StructType["entries"];
    if ((!items.length || items.some((i) => entriesT.SpawnedPrototypeSID?.includes(i))) && (!spawnTypes.length || spawnTypes.some((s) => entriesT.SpawnType === s)) && entriesT.ItemGeneratorSettings) {
      let keep = null;
      Object.values(entriesT.ItemGeneratorSettings.entries).forEach((e) => {
        Object.values(e.entries?.ItemGenerators.entries || {}).forEach((ie) => {
          if (ie.entries?.PrototypeSID) {
            console.info(`Found preplaced item generator: ${entriesT.SpawnedPrototypeSID}. Emptying it.`);
            ie.entries.PrototypeSID = "Milk";
          }
        });
      });
      return entries;
    }
    return null;
  },
};
