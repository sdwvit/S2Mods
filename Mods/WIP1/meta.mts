import { DialogPrototype, QuestNodePrototype } from "s2cfgtojson";
import { MetaContext, MetaType } from "../../src/metaType.mjs";

const oncePerFile = new Set<string>();

function getStructTransformer(struct: QuestNodePrototype, context: MetaContext<QuestNodePrototype>) {
  if (!oncePerFile.has(context.filePath)) {
    oncePerFile.add(context.filePath);
    const results = [];
    const visited = new Set<string>();
    const stack = [context.array.find((s) => s.NodeType === "EQuestNodeType::End")];
    while (stack.length) {
      const current = stack.pop();
      const transformed = transformEntry(current, context);
      if (transformed) results.push(transformed);
      current.Launchers?.forEach(([key, launcher]) => {
        launcher.Connections.forEach(([key, conn]) => {
          const next = context.structsById[conn.SID];
          if (next && !visited.has(next.SID)) {
            stack.push(next);
            visited.add(next.SID);
          }
        });
      });
    }
    results.reverse();
    console.log(1);
  }
  return null;
}

function genericTransform(struct: QuestNodePrototype, args: string[]) {
  return `${struct.NodeType}(${args.join(", ")})`;
}

function transformEntry(struct: QuestNodePrototype, context: MetaContext<QuestNodePrototype>) {
  switch (struct.NodeType) {
    case "EQuestNodeType::ALifeDirectorZoneSwitch":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::AchievementUnlock":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ActivateAnomaly":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ActivateInteractableObject":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ActivateRestrictor":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::AddNote":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::AddOrRemoveFromSquad":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::AddTechnicianSkillOrUpgrade":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::BridgeCleanUp":
      return genericTransform(
        struct,
        struct.NodesToCleanUpResults.entries().map(([key, val]) => val),
      );
    case "EQuestNodeType::BridgeEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::CancelAllSideQuests":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ChangeFaction":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ChangeRelationships":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::Condition":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ConsoleCommand":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::Container":
      return genericTransform(struct, [struct.ContaineredQuestPrototypeSID]);
    case "EQuestNodeType::DeactivateZone":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::Despawn":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::DisableNPCBark":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::DisableNPCInteraction":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::EmissionScheduleControl":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::EmissionStart":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::EnableDataLayer":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::End":
      return "return";
    case "EQuestNodeType::EquipItemInHands":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::FlashlightOnOff":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ForceInteract":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::GiveCache":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::HideLoadingScreen":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::HideTutorial":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::If":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ItemAdd":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ItemRemove":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::LoadAsset":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::LookAt":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::MoveInventory":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::NPCBark":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnAbilityEndedEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnAbilityUsedEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnDialogStartEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnEmissionFinishEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnEmissionStageActivated":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnEmissionStageFinished":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnEmissionStartEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnFactionBecomeEnemyEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnFactionBecomeFriendEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnGetCompatibleAttachEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnHitEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnInfotopicFinishEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnInteractEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnJournalQuestEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnKillerCheckEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnMoneyAmountReachedEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnNPCBecomeEnemyEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnNPCBecomeFriendEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnNPCCreateEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnNPCDeathEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnNPCDefeatEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnPlayerGetItemEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnPlayerLostItemEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnPlayerNoticedEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnSignalReceived":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::OnTickEvent":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::PlayEffect":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::PlayPostProcess":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::PlaySound":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::PlayVideo":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ProtectLairNPCSquadItem":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::Random":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ReputationLocker":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ResetAI":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::RestrictSave":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::RestrictionArea":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SaveGame":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ScheduledContainer":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SearchPoint":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SendSignal":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SequenceStart":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetAIBehavior":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetCharacterEffect":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetCharacterParam":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetDialog":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetDurabilityParam":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetFactionRestriction":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetGlobalVariable":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetHubOwner":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetItemGenerator":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetJournal":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetMeshGenerator":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetNPCSequentialAbility":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetName":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetPersonalRestriction":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetQuestGiver":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetSpaceRestrictor":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetTime":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetTimer":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetWeather":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SetWounded":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ShowFadeScreen":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ShowLoadingScreen":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ShowMarker":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ShowTutorialWidget":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::Spawn":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SpawnAnomaly":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SpawnAnomalySpawner":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SpawnArtifactSpawner":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SpawnDeadBody":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SpawnItemContainer":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SpawnLair":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SpawnSafeZone":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SpawnSingleObj":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SpawnSquad":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SpawnTrigger":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::SwitchQuestItemState":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::Technical":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::TeleportCharacter":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::TimeLock":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ToggleLairActivity":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::ToggleNPCHidden":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::TrackJournal":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::TrackShelter":
      return genericTransform(struct, [struct.SID]);
    case "EQuestNodeType::Trigger":
      return genericTransform(struct, [struct.SID]);
  }
}

getStructTransformer.files = ["/QuestNodePrototypes/RSQ07_C00_TSEMZAVOD.cfg"];
export const meta: MetaType<QuestNodePrototype> = {
  changenote: "",
  description: "",
  structTransformers: [getStructTransformer],
};
