import { Struct } from "s2cfgtojson";
import type { DialogPrototype } from "s2cfgtojson";

const CHAIN = "SQ03_Dialog_LinzaGivesReward";
const IS_DEAD_IF = `${CHAIN}_If_DeviatiyIsDead`;
const DEATH_EVENT_IF = `${CHAIN}_If_DeviatiyDeathEvent`;
const KILLED_BRANCH = `${CHAIN}_EndDevyatijDead_51543`;
const SIDED_BRANCH = `${CHAIN}_EndRosaStalkersDead_51566`;
// One of SQ03's own OnObjDeath events on the Ninth (F7C3910A...); it launches the Kill_Monolith journal finish.
const NINTH_DEATH_EVENT = "SQ03_OnNPCDeathEvent_9th_1";

/**
 * Lens picks "you killed him" over "you sided with him" with a single `IsAlive NotEqual` on the Ninth.
 * Back in Zalissya his body is long unloaded, the check comes out false and Lens accuses a player who
 * killed him. Its False branch now goes through a second `If` on SQ03's death event for him, which the
 * save keeps; only a Ninth that never died reaches the "sided" lines.
 */
export function transformSQ03DialogLinzaGivesReward(struct: DialogPrototype) {
  if (struct.SID !== IS_DEAD_IF) return null;

  const fork = struct.fork();
  const False = new Struct({ NextDialogSID: DEATH_EVENT_IF });
  False.__internal__.bpatch = true;
  fork.NextDialogOptions = new Struct({ False }) as DialogPrototype["NextDialogOptions"];
  fork.NextDialogOptions.__internal__.bpatch = true;

  return [fork, deathEventIf()];
}

transformSQ03DialogLinzaGivesReward.files = ["/DialogPrototypes/SQ03_Dialog_LinzaGivesReward.cfg"];

/** A dialog `If` in vanilla's shape (SQ03_Dialog_LinzaGivesReward_If_1): did the Ninth's death event run? */
const deathEventIf = () =>
  new Struct({
    __internal__: { rawName: DEATH_EVENT_IF, isRoot: true },
    SID: DEATH_EVENT_IF,
    DialogChainPrototypeSID: CHAIN,
    DialogMemberIndex: -1,
    NextDialogOptions: new Struct({
      True: new Struct({
        Conditions: new Struct({
          0: new Struct({
            0: new Struct({
              ConditionType: "EQuestConditionType::Bridge",
              ConditionComparance: "EConditionComparance::Equal",
              LinkedNodePrototypeSID: NINTH_DEATH_EVENT,
              CompletedNodeLauncherNames: new Struct({ 0: "" }),
            }),
          }),
        }),
        NextDialogSID: KILLED_BRANCH,
        Terminate: false,
      }),
      False: new Struct({ NextDialogSID: SIDED_BRANCH, Terminate: false }),
    }),
    NodePrototypeVersion: 1,
  }) as DialogPrototype;
