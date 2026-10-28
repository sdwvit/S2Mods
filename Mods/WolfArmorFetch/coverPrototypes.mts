import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Struct } from "s2cfgtojson";
import { baseCfgDir, modFolderRaw, rawCfgEnclosingFolder } from "../../src/base-paths.mts";
import type { StructTransformer } from "../../src/meta-type.mts";
import { BAGOR, CONTEXTUAL, DECIDER_ITEM, DEALER_NOTE, DEALER_PDA, GUID, HOOK_NOTE, HOOK_PDA, NAME_NOTE, POS, ROLLS, VAR } from "./cover.mts";

/**
 * Cover Story's new prototypes, one transformer per target cfg: its NPCs' spawn actors, the dealers'
 * ObjPrototypes, the two PDAs, their notes and the job's global variables. Item generators live with
 * the rewards (./transformRewards.mts).
 */

const root = (SID: string, fields: Record<string, unknown>, refkey?: string) => {
  const s = new Struct({ SID, ...fields });
  s.__internal__.rawName = SID;
  s.__internal__.isRoot = true;
  if (refkey) s.__internal__.refkey = refkey;
  return s;
};

/** The dealers: Ward heavies, each with a loadout of their own (the armor sets how they look). */
export const DEALER_PROTOTYPES = [
  { guid: GUID.lead, pos: POS.lead, SID: "WolfArmorFetch_Dealer_Lead", rank: "Master" },
  { guid: GUID.gunner, pos: POS.gunner, SID: "WolfArmorFetch_Dealer_Gunner", rank: "Veteran" },
  { guid: GUID.smg, pos: POS.smg, SID: "WolfArmorFetch_Dealer_Smg", rank: "Veteran" },
];
export const dealerGenerator = (SID: string) => `${SID}_ItemGenerator`;

/**
 * A quest NPC's spawn actor, shaped like Wolf's own (`ESpawnType::Obj`, spawned by a quest `Spawn`
 * node). New actors carry `PlaceholderMapPath` like every one the engine places; they have no
 * placeholder actor in the level, so there is no `PlaceholderActorGuid`.
 */
const npcActor = (SID: string, pos: { x: number; y: number; z: number }, prototype: string, rank: string, yaw = 0) =>
  root(SID, {
    SpawnOnStart: false,
    PositionX: pos.x,
    PositionY: pos.y,
    PositionZ: pos.z,
    RotatorAngleYaw: yaw,
    RotatorAnglePitch: 0,
    RotatorAngleRoll: 0,
    ScaleX: 1,
    ScaleY: 1,
    ScaleZ: 1,
    TextAboveActor: "",
    DLC: "None",
    LevelName: "WorldMap_WP",
    PlaceholderMapPath: "/Game/_Stalker_2/maps/_Stalker2_WorldMap/WorldMap_WP",
    SpawnedPrototypeSID: prototype,
    OverrideRank: true,
    Rank: `ERank::${rank}`,
    SpawnType: "ESpawnType::Obj",
    HP: 100,
    DamageMultiplier: 1,
    MoveSpeedMultiplier: 1,
    PsyNPCType: "EPsyNPCType::None",
    CanBeWounded: true,
    AllowSpawnOnIsolatedNavMesh: false,
  });

/** A contextual-action spot, as vanilla's `ESpawnType::ContextualAction` actors (e.g. 4BDA63044FC2FF0A247A488269613B77). */
const caActor = (SID: string, pos: { x: number; y: number; z: number }, action: string, yaw: number) => {
  const at = () =>
    new Struct({
      Vector: new Struct({ X: pos.x, Y: pos.y, Z: pos.z }),
      Rotation: new Struct({ Pitch: 0, Yaw: yaw, Roll: 0 }),
    });
  return root(SID, {
    SpawnOnStart: true,
    PositionX: pos.x,
    PositionY: pos.y,
    PositionZ: pos.z,
    RotatorAngleYaw: yaw,
    RotatorAnglePitch: 0,
    RotatorAngleRoll: 0,
    ScaleX: 1,
    ScaleY: 1,
    ScaleZ: 1,
    TextAboveActor: "",
    DLC: "None",
    LevelName: "WorldMap_WP",
    PlaceholderMapPath: "/Game/_Stalker_2/maps/_Stalker2_WorldMap/WorldMap_WP",
    SpawnType: "ESpawnType::ContextualAction",
    ContextualActionSID: action,
    CanInteractWithPlayer: true,
    ContextualActionPreconditions: "",
    CompoundAnimationReferences: "",
    AttachReferences: "",
    InLocationRotation: new Struct({ 0: new Struct({ 0: at() }) }),
    CenterLocationRotation: new Struct({ 0: at() }),
  });
};

/** A stalker's body, as vanilla's `BP_DeadBodyPlaceholder` actors; spawned by a quest `Spawn` node. */
const deadBody = (SID: string, pos: { x: number; y: number; z: number }) =>
  root(SID, {
    SpawnOnStart: false,
    PositionX: pos.x,
    PositionY: pos.y,
    PositionZ: pos.z,
    RotatorAngleYaw: 135,
    RotatorAnglePitch: 0,
    RotatorAngleRoll: 0,
    ScaleX: 1,
    ScaleY: 1,
    ScaleZ: 1,
    TextAboveActor: "",
    DLC: "None",
    LevelName: "WorldMap_WP",
    PlaceholderMapPath: "/Game/_Stalker_2/maps/_Stalker2_WorldMap/WorldMap_WP",
    MeshPath: "SkeletalMesh'/Game/_STALKER2/SkeletalMeshes/player/sta/sta_03/SK_pla_sta_03_SHA.SK_pla_sta_03_SHA'",
    SpawnedPrototypeSID: "GeneralNPC_Neutral_Recon",
    SpawnType: "ESpawnType::DeadBody",
    DisablePhysics: false,
    DisableCollision: false,
    DisableDespawn: true,
    DisableLoot: false,
    DisableDrag: false,
    CorpsePrototypeSID: "LightlyDamaged",
    DecalsMaterialSID: "SmallCaliber",
    DeadPose:
      "AnimSequence'/Game/_STALKER2/Animations/Characters/AnimSequences/bh/DeathPoses/AS_tp_death_pose_20.AS_tp_death_pose_20'",
  });

/**
 * The Falcon job's reward stash: a copy of vanilla's Cordon backpack 1DFF64AA468013EBAE934D8F3B8F980B (same
 * mesh and loot), 40 cm beside it, spawned by the hand-in. The vanilla one spawns on start and other clues
 * reveal it, so in a save where it was already found or emptied, revealing it again showed nothing.
 */
export const REWARD_STASH_GUID = "EB35A0EA672C40F498E635D4AADC09E7";
const rewardStash = () =>
  root(REWARD_STASH_GUID, {
    SpawnOnStart: false,
    PositionX: 449505.400586,
    PositionY: 654226.767087,
    PositionZ: -2102.328727,
    RotatorAngleYaw: 0,
    RotatorAnglePitch: 0,
    RotatorAngleRoll: 0,
    ScaleX: 1,
    ScaleY: 1,
    ScaleZ: 1,
    TextAboveActor: "",
    DLC: "None",
    LevelName: "WorldMap_WP",
    PlaceholderMapPath: "/Game/_Stalker_2/maps/_Stalker2_WorldMap/WorldMap_WP",
    MeshPath: "StaticMesh'/Game/_Stalker_2/items/loot/SM_loot_backpack_a.SM_loot_backpack_a'",
    SpawnedPrototypeSID: "Backpack",
    DisablePhysicsAndCollision: true,
    SpawnType: "ESpawnType::ItemContainer",
    bRandomChancesForSeparateItems: false,
    ClueVariablePrototypeSID: "EmptyInherited",
    StashPrototypeSID: "StashMedicine_Smart,Stash_Ammo_Smart_CommonRare",
    ItemGeneratorSettings: new Struct({
      0: new Struct({
        PlayerRank: "ERank::Veteran",
        ItemGenerators: new Struct({
          0: new Struct({ PrototypeSID: "Cordon_NewbieWillage_StashGenerator1_1DFF64AA468013EBAE934D8F3B8F980B" }),
        }),
      }),
    }),
  });

/**
 * A spare Decider for the first job, on a save where vanilla's is gone: SQ86 over, Skif sold or dropped
 * his, and the debtor doesn't carry one. A copy of SQ86's own gun placeholder 7D20AB7446B6F65B1FA334988FB844BA
 * (where Skif first found it), 40 cm beside it.
 */
export const DECIDER_SPARE_GUID = "0195C442AC824222BDDEBE3E0A2D05EA";
const deciderSpare = () =>
  root(DECIDER_SPARE_GUID, {
    SpawnOnStart: false,
    PositionX: 514599.523754,
    PositionY: 391521.205323,
    PositionZ: -859.680325,
    RotatorAngleYaw: -35.822558,
    RotatorAnglePitch: 1.04882,
    RotatorAngleRoll: -89.942758,
    ScaleX: 1,
    ScaleY: 1,
    ScaleZ: 1,
    TextAboveActor: "",
    DLC: "None",
    LevelName: "WorldMap_WP",
    PlaceholderMapPath: "/Game/_Stalker_2/maps/_Stalker2_WorldMap/WorldMap_WP",
    MeshPath: "SkeletalMesh'/Game/_STALKER2/SkeletalMeshes/weapons/ar/fora0/SK_fora0.SK_fora0'",
    SpawnedPrototypeSID: DECIDER_ITEM,
    SpawnType: "ESpawnType::Item",
    ItemSID: DECIDER_ITEM,
    Durability: 0.3,
    DisablePhysicsAndCollision: true,
  });

/** The Weather Station marker's own file; the new actors are appended to it, next to the marker. */
const SPAWN_FILE = "SpawnActorPrototypes/WorldMap_WP/59B744E544A3194779A169962ABDFBE2.cfg";

/**
 * Writes the marker's file with our actors appended. A `_patch_` file would sit in a new folder
 * under the one-file-per-actor WorldMap_WP tree; the full file keeps it at the vanilla path.
 * Called from meta's onFinish (prepare-configs wipes raw cfgs before every run).
 */
export const writeCoverSpawnActors = async () => {
  const actors = [
    npcActor(GUID.hook, POS.hook, BAGOR, "Experienced"),
    npcActor(GUID.crew1, POS.crew1, "GeneralNPC_SultanBandit_Stormtrooper", "Experienced", 180),
    npcActor(GUID.crew2, POS.crew2, "GeneralNPC_SultanBandit_CloseCombat", "Experienced", 0),
    deadBody(GUID.corpse, POS.corpse),
    ...CONTEXTUAL.map(({ guid, pos, action, yaw }) => caActor(guid, pos, action, yaw)),
    ...DEALER_PROTOTYPES.map(({ guid, pos, SID, rank }) => npcActor(guid, pos, SID, rank, -90)),
    npcActor(GUID.guard1, POS.guard1, "GeneralNPC_SultanBandit_Stormtrooper", "Experienced"),
    npcActor(GUID.guard2, POS.guard2, "GeneralNPC_SultanBandit_Stormtrooper", "Experienced"),
    rewardStash(),
    deciderSpare(),
  ];
  const vanilla = await readFile(path.join(baseCfgDir, "GameData", SPAWN_FILE), "utf8");
  const target = path.join(modFolderRaw, rawCfgEnclosingFolder, "GameData", SPAWN_FILE);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, [vanilla.trimEnd(), ...actors.map((s) => s.toString())].join("\n\n") + "\n");
};

let onceObj = false;
export const transformCoverObjPrototypes: StructTransformer<Struct> = () => {
  if (onceObj) return;
  onceObj = true;
  return [
    ...DEALER_PROTOTYPES.map(({ SID }) => root(SID, { ItemGeneratorPrototypeSID: dealerGenerator(SID) }, "GeneralNPC_Varta_Heavy")),
    // Bagor: a Sultansk stormtrooper wearing his own NPC prototype, for his name, and a fixed look, as Sultan's.
    root(BAGOR, { NPCPrototypeSID: BAGOR, CustomMeshGeneratorPrototypeSID: BAGOR_MESH }, "GeneralNPC_SultanBandit_Stormtrooper"),
  ];
};
transformCoverObjPrototypes.files = ["/ObjPrototypes/GeneralNPCObjPrototypes.cfg"];

let onceItems = false;
/** Hook's PDA and the dealers', faction PDAs like vanilla EQ13_FilimonPDA. */
export const transformCoverQuestItems: StructTransformer<Struct> = () => {
  if (onceItems) return;
  onceItems = true;
  return [
    root(HOOK_PDA, { IsQuestItem: true }, "BasePDA_Bandits"),
    root(DEALER_PDA, { IsQuestItem: true }, "BasePDA_Ward"),
    // Wolf's note: a sheet of paper, as vanilla SQ18_KamysPaperNote.
    root(NAME_NOTE, { IsQuestItem: true }, "QuestItem_Note_A4"),
  ];
};
transformCoverQuestItems.files = ["/QuestItemPrototypes.cfg"];

let onceNotes = false;
/** The PDAs' chats; their text is `sid_notes_<SID>_*` (./coverText.mts), as vanilla EQ13_Filimon_Note. */
export const transformCoverNotes: StructTransformer<Struct> = () => {
  if (onceNotes) return;
  onceNotes = true;
  return [root(HOOK_NOTE, {}, "[0]"), root(DEALER_NOTE, {}, "[0]")];
};
transformCoverNotes.files = ["/NotePrototypes.cfg"];

let onceVars = false;
export const transformCoverGlobalVariables: StructTransformer<Struct> = () => {
  if (onceVars) return;
  onceVars = true;
  return [...Object.values(VAR), ...ROLLS.map((r) => r.variable)].map((SID) =>
    root(SID, { Description: "", Type: "EGlobalVariableType::Int", DefaultValue: 0 }),
  );
};
transformCoverGlobalVariables.files = ["/GlobalVariablePrototypes.cfg"];

let onceNPC = false;
/** Bagor's NPC prototype: the Sultansk bandits' voice and barks, with a name of his own, as vanilla's Sultan. */
export const transformCoverNPCPrototypes: StructTransformer<Struct> = () => {
  if (onceNPC) return;
  onceNPC = true;
  // Inheriting GeneralNPC_SultanBandit (HumanBase, UseGeneratedName = true) gave him a random bandit name in
  // game even with UseGeneratedName = false on top. Every vanilla named NPC inherits [0], as Sultan does, so he
  // does too and carries GeneralNPC_SultanBandit's dialog chains himself. QuestNPC as theirs (1178 of 1180).
  return [
    root(
      BAGOR,
      {
        HelloDialogChain: "General_bandits_0_HelloTopic",
        ByeDialogChain: "General_bandits_0_ByeTopic",
        DefeatCommentDialogChain: "General_bandits_0_DefeatComment_Group",
        CallPlayerCommentDialogChain: "General_bandits_0_CallPlayer",
        ResumeCommentDialogChain: "General_bandits_0_ResumeComment",
        BusyCommentDialogChain: "General_bandits_0_BusyTopic",
        TradeTopicDialogChain: "General_bandits_0_TradeTopic",
        NameTextKey: `sid_character_${BAGOR}`,
        UseGeneratedName: false,
        QuestNPC: true,
      },
      "[0]",
    ),
  ];
};
transformCoverNPCPrototypes.files = ["/NPCPrototypes.cfg"];

/** Bagor's fixed look: SkadovskGuider's bandit outfit (mask and helmet slots empty), with a face of his own. */
const BAGOR_MESH = `${BAGOR}_MeshGenerator`;
const BAGOR_FACE = "Fac_30_08_v3";

export const transformCoverMeshGenerators: StructTransformer<Struct> = (struct) => {
  if (struct.SID !== "SkadovskGuider_MeshGenerator") return;
  const mesh = struct.clone() as any;
  mesh.SID = BAGOR_MESH;
  mesh.__internal__.rawName = BAGOR_MESH;
  mesh.__internal__.isRoot = true;
  const face = mesh.Attachments.entries().find(([, slot]: [string, any]) => slot.SlotName === "Face")[1];
  face.Attaches[0].BodyMeshSID = BAGOR_FACE;
  return mesh;
};
transformCoverMeshGenerators.files = ["/MeshGeneratorPrototypes/QuestMeshGeneratorPrototypes.cfg"];
