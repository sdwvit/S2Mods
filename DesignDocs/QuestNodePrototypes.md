# QuestNodePrototypes

This document is a comprehensive working reference for S.T.A.L.K.E.R. 2
`QuestNodePrototypes`.

Important scope note:

- The `s2cfgtojson` schema is the main authority for node names and fields.
- Working quest content is treated as confirmation that a pattern works in
  practice.
- Any statement about exact in-game runtime semantics that is not directly
  implied by schema or observed in working content is marked as inference.

Confidence legend:

- `Schema-confirmed`: directly visible in `s2cfgtojson`.
- `Observed`: seen in working quest content or editor-facing material.
- `Inference`: likely useful, but still needs live verification.

Reading rule for the rest of this document:

- unlabeled field lists are `Schema-confirmed`
- unlabeled “Use for” bullets are design guidance, not proof of exclusive engine
  semantics
- any statement about graph execution, listener behavior, synchronization, or
  lifecycle should be treated according to the nearest explicit confidence label

## How To Use This Document

Read this file in one of three ways:

- If you are solving a concrete design problem, start at
  [Quick Lookup](#quick-lookup).
- If you are trying to understand graph mechanics, read in this order:
  [Core Model](#core-model), [Targets And GUIDs](#targets-and-guids),
  [Node Anatomy](#node-anatomy), [Execution Model](#execution-model), then
  [Design Patterns](#design-patterns).
- If you need a node-by-node reference, jump to
  [Node Families](#node-families), then use the appendices at the end.

Section map:

- [Core Model](#core-model): what a quest graph is and how edges are encoded
- [Targets And GUIDs](#targets-and-guids): common target fields and player GUID
  conventions
- [Node Anatomy](#node-anatomy): launchers, outputs, conditions, and raw cfg
  wiring
- [Execution Model](#execution-model): how the main control nodes behave
- [Design Patterns](#design-patterns): practical coupling recipes
- [Node Families](#node-families): grouped reference for action and event nodes
- [Appendices](#appendices): catalogs, quick lookup, and compact mental model

## Core Model

A quest graph is a set of structs in `GameLite/GameData/QuestNodePrototypes/*.cfg`
where each struct is a quest node.

Every node has at least these core ideas:

- `SID`: node identifier inside the quest graph.
- `QuestSID`: quest identity / owning graph identity.
- `NodeType`: node subtype, e.g. `EQuestNodeType::If`.

Many, but not all, node types also carry `Launchers`.

Examples that do not use `Launchers` in schema:

- event/listener nodes such as `OnAbilityEndedEvent`
- `BridgeEvent`

For nodes that do have `Launchers`, raw cfg authoring stores who can launch the
node, not who it launches. That means those parts of the graph are encoded as
inbound edges.

## Targets And GUIDs

Quest nodes frequently operate on GUID-like string references. Common fields:

- `TargetQuestGuid`
- `TargetCharacter`
- `TargetNPC`
- `InteractableQuestGuid`
- `TriggerQuestGuid`
- `SignalSenderGuid`
- `SignalReceiverGuid`

Important observed convention:

- `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` is Skif / the player

Practical consequence:

- if a node targets `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`, read it as "apply/check
  this against the player"
- many conditions use `TargetCharacter` while actions often use
  `TargetQuestGuid`; do not assume those fields are interchangeable even when
  they point at the same logical actor. `Observed`

## Node Anatomy

Many node subtypes share these fields:

- `SID`
- `QuestSID`
- `NodeType`

Very common additional fields:

- `Launchers`
- `Repeatable`
- `NodePrototypeVersion`
- `BrokenGameDataFilter`

Not every node exposes all of these. In particular, many event roots and
`BridgeEvent` do not have `Launchers`. `Schema-confirmed`.

### Launchers

Schema:

- `QuestNodePrototypeLaunchers = QuestNodePrototypeLaunchersItem[]`
- `QuestNodePrototypeLaunchersItem`
  - `Connections`
  - `Excluding`

`Connections` is a list of `{ SID, Name }` pairs.

Practical meaning (`Schema-confirmed` for shape, `Inference` for graph
interpretation):

- `SID` points at an upstream node.
- `Name` is the upstream output pin name.
- a node may have multiple launcher groups.
- each launcher group may contain multiple connections.

Authoring pattern:

- one launcher connection for a simple predecessor
- a named launcher connection such as `Name = True` when binding to explicit
  branch outputs
- grouped launcher connections when a node should wait on multiple upstream
  requirements

`Excluding` is an input-side control path that disables the node and halts its
execution. Treat it as the exclusion counterpart to normal activation input.
Exact edge-case behavior, especially when combined with already-running child
logic or scheduling/container behavior, still deserves live testing.

Pin naming guidance (`Inference` based on schema plus local working mods):

- empty `Name` usually means ordinary success/pass-through
- `True` / `False` are the important names for `If`
- custom names matter for `Random`, `SetDialog`, `Container`, and other
  multi-output nodes

When patching a node with named outputs, always bind the exact `Name` you want.

### Output pins

Some nodes expose explicit outputs:

- `OutputPinNames`
- `PinWeights` for `Random`

Observed important cases:

- `If`: `True` / `False`
- `Random`: one output per named pin
- `Container`, `ScheduledContainer`, `ActivateInteractableObject`,
  `BridgeEvent`, `SetDialog`: expose named outputs in schema

Schema-confirmed `OutputPinNames` users:

- `Random`
- `BridgeEvent`
- `Container`
- `ScheduledContainer`
- `ActivateInteractableObject`
- `SetDialog`

### Conditions

`Condition` and `If` nodes use:

- `Conditions`
  - `ConditionCheckType` (`And` / `Or`)
- one or more condition groups
- one or more items inside each group

Practical reading (`Schema-confirmed` for shape, `Inference` for combination
semantics):

- conditions inside one group are best treated as conjunctive
- top-level groups are best treated according to `ConditionCheckType`

### How raw cfg wiring looks

The snippets below are schematic launcher/topology examples, not guaranteed
copy-paste-complete structs. Real nodes often also require fields such as
`NodePrototypeVersion`, `Repeatable`, or `BrokenGameDataFilter` depending on
subtype. `Schema-confirmed`.

Schematic `Technical` node:

```cfg
SomeQuest_Start : struct.begin
   SID = SomeQuest_Start
   QuestSID = SomeQuest
   NodeType = EQuestNodeType::Technical
   StartDelay = 0
   LaunchOnQuestStart = true
struct.end
```

Schematic delayed child node launched by another node:

```cfg
SomeQuest_Delay : struct.begin
   SID = SomeQuest_Delay
   QuestSID = SomeQuest
   NodeType = EQuestNodeType::Technical
   StartDelay = 0.25
   Launchers : struct.begin
      [0] : struct.begin
         Excluding = false
         Connections : struct.begin
            [0] : struct.begin
               SID = SomeQuest_Start
               Name =
            struct.end
         struct.end
      struct.end
   struct.end
struct.end
```

Schematic `If` node launched from a specific named pin:

```cfg
SomeQuest_Check : struct.begin
   SID = SomeQuest_Check
   QuestSID = SomeQuest
   NodeType = EQuestNodeType::If
   Conditions : struct.begin
      ConditionCheckType = EConditionCheckType::And
      [0] : struct.begin
         [0] : struct.begin
            ConditionType = EQuestConditionType::GlobalVariable
            ConditionComparance = EConditionComparance::Equal
            GlobalVariablePrototypeSID = MyQuestFlag
            VariableValue = 1
         struct.end
      struct.end
   struct.end
   Launchers : struct.begin
      [0] : struct.begin
         Excluding = false
         Connections : struct.begin
            [0] : struct.begin
               SID = SomeQuest_Dialog
               Name = Success
            struct.end
         struct.end
      struct.end
   struct.end
struct.end
```

Authoring takeaway:

- the downstream node stores the upstream launcher reference
- pin names live on the connection, not on the launched node body
- patches that only rewrite `Launchers` can redirect entire quest flows

## Execution Model

### Technical node as the generic no-op / delay / bootstrap node

`Technical` is one of the most useful authoring nodes.

Fields:

- `LaunchOnQuestStart`
- `StartDelay`

Observed behavior (`Observed`):

- its main job is readability and signal staging rather than gameplay state
- it can delay forwarding the signal by a configured pause
- if an exclusion signal arrives during the delay, it does not forward the
  signal afterward

Common uses:

- start a quest fragment when the quest begins
- insert a short sequencing delay
- replace removed logic with a harmless pass-through node
- create a debug entry point that can be started by console command

### Condition vs If

Schema:

- both have `Conditions`
- both have `Launchers`
- both are repeatable

Observed semantics (`Observed`):

- `Condition` cannot initiate on its own; it is a gate that is usually wired in
  parallel with other flow.
- `Condition` passes the signal only when the configured check is met and can
  remain active afterward.
- `If` is a series-routing node: it evaluates immediately, sends flow to
  `True` or `False`, and then ends.
- `NOT Condition` inverts the configured check; on `If`, that effectively swaps
  which branch is taken.

Practical recommendation:

- use `If` when you need explicit branching.
- use `Condition` when you want a simple gate in the chain.

Patching recommendation:

- `If` is usually the safer patch point when you need to insert alternate
  outcomes
- `Condition` is usually the safer patch point when you just want to allow or
  block vanilla continuation

### BridgeEvent and bridge-style synchronization

`BridgeEvent` fields:

- `LinkedNodePrototypeSID`
- `EventType`
- `OutputPinNames`
- `LaunchOnQuestStart`
- `TrackBeforeActive`

- `BridgeEvent` is treated as listening to another node's state change.
- the linked node is considered an upstream trigger.

Condition support:

- `EQuestConditionType::Bridge`
- `LinkedNodePrototypeSID`
- `CompletedNodeLauncherNames`

Meaning (`Inference` from schema and observed usage):

- bridge conditions can test whether another node completed, optionally on
  specific output pins.

Use this when:

- one quest fragment must wait for another fragment's completion
- you need to synchronize a side branch back into the main quest flow

### Events

Event nodes are subscription-like entry points. Common fields:

- `EventType`
- `LaunchOnQuestStart`
- `TrackBeforeActive`
- optional target/filter fields

Examples:

- `OnInteractEvent`
- `OnPlayerGetItemEvent`
- `OnNPCDeathEvent`
- `OnSignalReceived`
- `OnTickEvent`

Observed practical reading (`Observed`):

- `LaunchOnQuestStart` indicates the event node should begin tracking from quest
  start.

Use event nodes as roots for reactive quest logic.

Practical event split:

- actor/world events: interact, death, hit, noticed, create, relation changes
- systemic events: signals, journal transitions, item gain/loss, upgrades,
  money thresholds, emission lifecycle

This helps decide whether a quest subsystem should be driven by authored quest
state or by simulation state.

### Multiple launcher groups

The schema allows multiple launcher groups, each with multiple connections.

Best-working mental model for authoring (`Inference`):

- one connection: simple predecessor
- one group with many connections: logical fan-in / grouped prerequisites
- many groups: alternate launch conditions or advanced graph semantics

Grouped prerequisites are best treated conjunctively, but exact engine behavior
for unusual multi-group combinations should still be validated in live quests.

### Random

`Random` fields:

- `OutputPinNames`
- `PinWeights`
- `Repeatable`

Meaning:

- one input arrives
- one output pin is chosen according to `PinWeights`
- output pins should be uniquely named
- pin weights are matched to output pins by index order
- weights should be positive values greater than zero

Observed use (`Observed`):

- weighted output pins are suitable for stash selection, reward fanout, and
  any branch where probabilities matter

### End

`End` is a terminal node.

Key field:

- `ExcludeAllNodesInContainer`
- extra input pins can be added for alternate branch convergence

Use:

- terminate a quest branch
- close a generated helper subgraph after all desired actions fire
- stop all currently running logic in the current blueprint

## Design Patterns

These are the most important coupling patterns.

### 1. Start-of-quest bootstrap

Pattern:

- `Technical { LaunchOnQuestStart = true, StartDelay = 0 }`
- then one or more downstream nodes

Use:

- initialize state
- register delayed work
- spawn helper quest fragments

### 2. Event -> condition -> action

Pattern:

- event node
- `If` or `Condition`
- one or more action nodes

Examples:

- `OnPlayerGetItemEvent -> If -> ItemRemove / ItemAdd / SetCharacterParam`
- `OnSignalReceived -> Condition -> SetJournal`

This is the standard reactive quest authoring pattern.

### 3. Action fanout

Because a node can be referenced by multiple downstream launchers, one event can
fan out into many parallel actions:

- update journal
- give item
- show marker
- play sound
- set global variable

### 4. Named-branch routing

Pattern:

- `If`
- `Random`
- `SetDialog`
- `Container`
- any node with `OutputPinNames`

Use named outputs when:

- success and failure need different follow-up
- you want a multi-outcome quest state machine
- dialog endings must lead to different consequences

### 5. Delay insertion

Pattern:

- `Technical { StartDelay = ... }`

Observed use:

- short delay after spawn before item or cache reveal
- sequence cleanup or staged effects

This is one of the safest and most common ways to decouple immediate operations
that should not happen on the exact same tick.

### 6. Bridge / synchronization

Pattern:

- side branch performs work
- `BridgeEvent` or bridge condition observes completion
- main branch continues only after completion

Use:

- multi-step quest orchestration
- waiting for helper nodes to finish before advancing

### 7. Signal bus

Pattern:

- `SendSignal`
- `OnSignalReceived`

Use:

- decouple graph segments that should not be directly wired
- trigger logic across quest fragments
- make reusable helper subgraphs callable

### 8. Flow rewiring

Pattern:

- patch `Launchers` on existing nodes

Observed confirmation:

- flow rewiring that bypasses or redirects existing quest stages

Use:

- bypass cutscenes
- skip dead branches
- redirect one phase of a vanilla quest into another

This is a very powerful compatibility technique because it often avoids editing
the entire original node set.

### 9. Stateful quest machines with globals

Pattern:

- event or trigger
- `If` / `Condition` on `GlobalVariable`
- `SetGlobalVariable`
- follow-up nodes gated by updated value

Use:

- chapter/phase progression
- repeatable-quest state transitions
- story flags
- one-shot guard rails in otherwise repeatable graphs

### 10. Journal-driven quest progression

Pattern:

- `SetJournal`
- optional `TrackJournal`
- optional marker updates
- `If` / `Condition` with `JournalState`

Use:

- objective start/update/finish
- optional objective branches
- quest stage dependent world behavior

### 11. Spawn -> presentation -> interaction

Pattern:

- `Spawn` / spawn-family node
- optional `Technical` delay
- `ShowMarker` / `SearchPoint`
- `OnInteractEvent` or trigger/event node
- reward/cleanup nodes

Use:

- stash quests
- encounter staging
- temporary mission props

### 12. Dialog branch to world consequence

Pattern:

- `SetDialog` with named output pins
- branch-specific downstream actions
- `SetJournal`, `ChangeRelationships`, `Spawn`, `ItemAdd`, etc.

Use:

- player-choice outcomes
- faction alignment branches
- reward/penalty routing

## Node Families

The best way to stay sane is to think in families rather than as 100+ unrelated
node types.

### Control And Graph Nodes

#### Technical

Purpose:

- generic pass-through
- optional delayed launch
- optional quest-start bootstrap

Key fields:

- `LaunchOnQuestStart`
- `StartDelay`

#### Condition

Purpose:

- gate execution when configured conditions are met

Key fields:

- `Conditions`

#### If

Purpose:

- explicit conditional branching

Key fields:

- `Conditions`

Outputs:

- practically `True` / `False`

#### Random

Purpose:

- weighted branching

Key fields:

- `OutputPinNames`
- `PinWeights`

#### BridgeEvent

Purpose:

- react to linked-node completion/state transitions

Key fields:

- `LinkedNodePrototypeSID`
- `OutputPinNames`
- `LaunchOnQuestStart`
- `TrackBeforeActive`

#### BridgeCleanUp

Purpose:

- cleanup/reset bridge results

Key fields:

- `NodesToCleanUpResults`

Use when repeated bridge-driven flows must not keep stale completion state.

#### End

Purpose:

- terminate branch

Key fields:

- `ExcludeAllNodesInContainer`

#### Container

Purpose:

- group or encapsulate nested flow with named outputs

Key fields:

- `ContaineredQuestPrototypeSID`
- `OutputPinNames`

Best reading (`Schema-confirmed` for fields, `Inference` for lifecycle meaning):

- a container node points at another quest fragment or subgraph and exposes its
  results back to the parent graph
- repeated parallel activation restarts the referenced embedded blueprint
- the tool/editor model does not allow selecting the same blueprint that the
  container node already belongs to

That interpretation is schema-confirmed by the presence of
`ContaineredQuestPrototypeSID`, but exact container lifecycle semantics remain
partly inference.

#### ScheduledContainer

Purpose:

- container-like logic with time/day scheduling

Key fields:

- `ContaineredQuestPrototypeSID`
- `StartHour`
- `EndHour`
- `SelectedDaysOfWeek`
- `OutputPinNames`

This looks like the time-aware variant of `Container` and is the natural place
to author quest fragments that should only be active in certain world-time
windows. `Inference`

Observed practical reading (`Observed`):

- it runs during its configured time window
- it excludes itself when the window stops being valid
- it can restart when the next valid time window begins

#### Trigger

Purpose:

- overlap/trigger-driven activation

Key fields:

- `TargetQuestGuid`
- `TriggerQuestGuid`
- `ReactType`
- `RequiredSquadMembers`
- `bTriggersByAnybody`
- `LaunchOnQuestStart`
- `TrackBeforeActive`

Observed usage confirms this family is used for trigger enter/exit style
behavior.

Useful distinction:

- `Trigger` node: event/execution source
- `EQuestConditionType::Trigger`: condition check embedded inside `If` or
  `Condition`

Observed practical behavior (`Observed`):

- it can react on trigger enter or trigger exit
- the trigger volume should fully cover the relevant player or NPC capsule in
  height
- targeting can be narrowed to one actor, widened to any actor, or grouped via
  squad-member requirements

#### TimeLock

Purpose:

- time-based quest gating

Key fields:

- minimal schema only; exact runtime behavior should be verified in live quest
  usage before heavy reliance

#### LoadAsset

Purpose:

- preload assets used by upcoming quest logic

Key fields:

- `AssetsToLoad`
- `AudioLocalizedAssetsToLoad`

#### SequenceStart

Purpose:

- kick off sequence/cinematic-style content

Key fields include:

- `LocalizedSequences`
- `LoopSequence`
- `TargetLocation`
- `RotationTime`
- `PreblendSequence`
- `PreblendTime`

Use together with camera/UI/fade nodes for presentation-heavy quest moments.

Good coupling partners:

- `ShowFadeScreen`
- `PlayVideo`
- `SetTime`
- `SetWeather`
- `TeleportCharacter`

#### SaveGame / RestrictSave

Use:

- force saves at milestone points
- temporarily restrict save behavior during sensitive scripted moments

This pair is especially relevant for cinematic or high-risk transitions where
quest integrity matters more than freeform saving.

#### CancelAllSideQuests

Use:

- broad quest-state resets
- cleanup for mutually exclusive story states

## Event Nodes

These are the reactive roots of many graphs.

### Common event fields

Most event nodes carry:

- `EventType`
- `LaunchOnQuestStart`
- `TrackBeforeActive`
- optional target/filter fields

As a quick rule:

- if a node name starts with `On`, it is usually an event listener
- if it has `LaunchOnQuestStart` and `TrackBeforeActive`, treat it as a tracker
  rather than as an immediate action node

### Event nodes present in schema

- `OnAbilityEndedEvent`
- `OnAbilityUsedEvent`
- `OnDialogStartEvent`
- `OnEmissionFinishEvent`
- `OnEmissionStageActivated`
- `OnEmissionStageFinished`
- `OnEmissionStartEvent`
- `OnFactionBecomeEnemyEvent`
- `OnFactionBecomeFriendEvent`
- `OnGetCompatibleAttachEvent`
- `OnHitEvent`
- `OnInfotopicFinishEvent`
- `OnInteractEvent`
- `OnJournalQuestEvent`
- `OnKillerCheckEvent`
- `OnMoneyAmountReachedEvent`
- `OnNPCBecomeEnemyEvent`
- `OnNPCBecomeFriendEvent`
- `OnNPCCreateEvent`
- `OnNPCDeathEvent`
- `OnNPCDefeatEvent`
- `OnPlayerGetItemEvent`
- `OnPlayerLostItemEvent`
- `OnPlayerNoticedEvent`
- `OnPlayerRankReachedEvent`
- `OnSignalReceived`
- `OnTickEvent`
- `OnUpgradeInstallEvent`

### High-value event nodes

#### OnPlayerGetItemEvent

Key fields:

- `ItemPrototypeSID`
- `ExpectedItemsCount`
- `WithEquipped`
- `WithInventory`

Excellent for:

- quest progression by item pickup
- patch/item reward systems
- inventory-driven stat sync

Observed use:

- rank updates
- health/stamina/other stat changes
- scripted NPC/player state changes

#### OnPlayerLostItemEvent

Key fields:

- `ItemPrototypeSID`
- `ExpectedItemsCount`
- `FullAmount`

Use for:

- branch fail/recovery on item loss
- quest-state cleanup after removal

#### OnInteractEvent

Key fields:

- `InteractableQuestGuid`

Use for:

- object/NPC use interaction
- manual action gating

#### OnSignalReceived

Key fields:

- `SignalSenderGuid`

Use for:

- decoupled subgraph activation

Typical pairings:

- `SendSignal -> OnSignalReceived`
- `ConsoleCommand -> SendSignal -> OnSignalReceived`
- `SetGlobalVariable` updates after a signal-triggered branch

Observed practical behavior (`Observed`):

- it is the main event-style way to receive signals from interactive world
  objects
- it fits buttons, switches, triggers, and similar scene-driven interactions

#### OnNPCDeathEvent / OnNPCDefeatEvent / OnKillerCheckEvent

Use for:

- kill-confirm quests
- combat-driven branch resolution
- checking who killed whom and under what conditions

These are the right tools when "enemy died" is not enough and the quest cares
about credit, timing, or collateral conditions.

#### OnTickEvent

Use carefully:

- periodic polling
- fallback checks when no better event exists

Because polling is broad and easy to overuse, prefer more specific events when
possible.

#### TrackBeforeActive and LaunchOnQuestStart

These two fields matter on event-style nodes (`Schema-confirmed` fields,
`Inference` for engine behavior):

- `LaunchOnQuestStart` controls whether the event listener is armed from the
  beginning of the quest or fragment.
- `TrackBeforeActive` appears to control whether the event should accumulate or
  observe matching activity even before ordinary activation timing.

`TrackBeforeActive` is clearly important in schema and editor UX, but exact
engine semantics should still be validated in edge-heavy quest setups.

## Condition Types

Condition coverage is broad enough that many quests can be authored as:

- event
- condition
- action

Schema-confirmed condition types, with concise inferred meaning from
`GameLite/GameData/QuestNodePrototypes` usage:

- `AITarget`: checks what AI target or target class an actor currently has; use
  for combat-focus and aggro-state branching.
- `ArmorState`: checks armor presence/state on the target; use for gear-sensitive
  branches such as "is helmet/body armor equipped or intact enough."
- `Awareness`: checks threat-awareness or alertness level; use for stealth,
  suspicion, and combat-escalation gates.
- `Bleeding`: checks bleeding level/state on a character; use for injury-driven
  quest logic and survival-state reactions.
- `Bridge`: checks whether another node has completed, optionally on specific
  launcher pins; use for synchronization joins.
- `ContextualAction`: checks whether a specific contextual-action placeholder or
  behavior is active/valid; use for scripted interactions tied to authored CA
  spots.
- `CorpseCarry`: checks corpse-carry state around a target corpse placeholder;
  use for body-handling quest steps.
- `DistanceToNPC`: checks distance between one actor and another actor; use for
  escort, follow, ambush, and proximity-dialog logic.
- `DistanceToPoint`: checks distance from an actor to a world point; use for
  approach zones, navigation beats, and soft location triggers.
- `Effect`: checks whether a target has a specific gameplay effect; use for
  buff/debuff/status-driven quest logic.
- `Emission`: checks the current emission or selected emission prototype/state;
  use for emission-phase gating and weather-event reactions.
- `EquipmentInHands`: checks what the target currently has in hands; use for
  weapon/tool-state branches.
- `FactionRelationship`: checks relationship level between a target and a
  faction; use for faction-reputation-sensitive flow.
- `FastTravelMoney`: checks whether the player has enough money for a selected
  fast-travel option; use for travel gating.
- `GlobalVariable`: checks a named global variable against a value; use for
  persistent flags, counters, and lightweight quest state machines.
- `HP`: checks absolute HP value; use for health-threshold reactions.
- `HPPercent`: checks health percentage; use for injury gates that should scale
  across targets.
- `HasItemInQuickSlot`: checks for a specific item or consumable in a quick
  slot; use for quick-access preparedness checks.
- `HungerPoints`: checks hunger value; use for survival-system-driven branches.
- `InventoryWeight`: checks carried weight; use for overload, burden, or stash
  logistics logic.
- `IsAlive`: checks whether the selected actor is alive; use for safe guard
  clauses before issuing actions to targets.
- `IsCreated`: checks whether the target placeholder/entity has been created in
  the world; use for spawn-aware flow.
- `IsDialogMemberValid`: checks whether a referenced dialog participant/member
  is valid; use for branching dialog setups that depend on party composition or
  speaker availability.
- `IsEnoughAmmo`: checks ammunition sufficiency; use for weapon-readiness or
  combat-prep gating.
- `IsOnline`: checks whether the target is currently online/loaded; use for
  world-streaming-safe quest branches.
- `IsWeaponJammed`: checks weapon jam state; use for failure, panic, or repair
  reactions.
- `IsWounded`: checks whether the target is in wounded/downed state; use for
  rescue, heal, or finish-state logic.
- `ItemInContainer`: checks whether a specific item is inside a selected
  container; use for stash, delivery, and loot-validation logic.
- `ItemInInventory`: checks whether a target inventory contains a specific item
  and count; use for turn-ins, possession gates, and reward-state checks.
- `JournalState`: checks the state of a quest or quest stage in the journal; use
  for making side logic follow story progression.
- `LookAtAngle`: checks whether the player is looking toward a point/direction,
  often while inside a trigger; use for "notice the thing" interactions.
- `Money`: checks current money amount; use for payment, bribe, or affordability
  gating.
- `NodeState`: checks another quest node's state such as activated/finished or
  excluded; use for graph-aware branching without rewiring.
- `Note`: checks note/PDA-note state or possession; use for clue-driven quest
  gates.
- `PersonalRelationship`: checks personal relationship level between two
  characters; use for character-specific trust/hostility logic.
- `PlayerOverload`: checks overload status; use for encumbrance-sensitive
  branches.
- `Psy`: checks psy-state/psy damage style values; use for anomaly, madness, or
  mental-pressure gating.
- `Radiation`: checks radiation level/state; use for hazard and exposure logic.
- `Random`: performs a probabilistic condition check; use when the branch itself
  should be chance-driven rather than routed by a `Random` node.
- `Rank`: checks rank threshold; use for progression-gated access or rewards.
- `Stamina`: checks stamina value/state; use for exertion or chase/escape logic.
- `Trigger`: checks whether the target overlaps a trigger volume with optional
  squad/anybody semantics; use for area-presence conditions.
- `Weather`: checks current weather against a selected preset; use for ambient,
  timing, and world-state gating.

### High-value condition families

#### Persistent-state checks

- `GlobalVariable`
- `JournalState`
- `NodeState`
- `Bridge`

These are the most patch-friendly conditions when you want branches to depend on
explicit state rather than fragile launcher topology.

#### Inventory and economy checks

- `ItemInInventory`
- `ItemInContainer`
- `HasItemInQuickSlot`
- `Money`
- `FastTravelMoney`

These are strong choices for delivery, reward, affordability, and preparedness
gates.

#### Spatial and perception checks

- `DistanceToNPC`
- `DistanceToPoint`
- `LookAtAngle`
- `Trigger`
- `Awareness`
- `AITarget`

These are ideal for approach beats, stealth, combat attention, and
"player noticed the thing" style quest design.

#### Survival and combat-state checks

- `HP`
- `HPPercent`
- `Bleeding`
- `Radiation`
- `Psy`
- `Stamina`
- `InventoryWeight`
- `PlayerOverload`
- `IsEnoughAmmo`
- `IsWeaponJammed`

Use these when quest logic should react directly to player or NPC condition
rather than abstract story state.

## Inventory, Reward, And Item Nodes

### ItemAdd

Fields:

- `ItemSID`
- `ItemsCount`
- `TargetQuestGuid`
- `AddToPlayerStash`

Use:

- reward handoff
- stash clue injection
- scripted item grant

Observed practical targets (`Observed`):

- player inventory
- NPC inventory
- dead-body inventory
- containers or stashes

Observed use:

- stash clue injection
- scripted item grant

### ItemRemove

Fields:

- `ItemSID`
- `ItemsCount`
- `TargetQuestGuid`

Observed note:

- in quest chains, removing an absent item appears to attempt removal without
  hard-failing the chain

Treat this as observed behavior, not formal schema truth.

### MoveInventory

Fields:

- `MoveFrom`
- `MoveTo`
- `MoveQuestItems`
- `WithEquipped`

Use for:

- quest confiscation/recovery
- moving quest items between containers/actors

### SetItemGenerator

Fields:

- `ItemGeneratorSID`
- `TargetQuestGuid`
- `ReplaceInventory`
- `EquipItems`

Very powerful for:

- rebuilding NPC inventory/loadout
- scripting player/NPC equipment changes
- delivery/reward packages via generator definitions

Observed use:

- applying generated item sets to player or NPC targets
- replacing inventories for scripted loadouts

### GiveCache

Fields:

- `QuestItemGeneratorSID`
- `TargetQuestGuid`

Use for:

- stash revelation / cache notification / stash reward chains

Observed use:

- stash revelation
- cache notification
- cache reward chains

### SetDurabilityParam

Fields:

- target weapon slot toggles
- durability percents

Use for:

- scripted degradation/repair state
- loadout conditioning before combat sequences

### GiveCache vs ItemAdd vs SetItemGenerator

These three nodes solve different reward problems:

- `ItemAdd`: grant a specific item SID and count directly
- `SetItemGenerator`: apply a predefined inventory/loadout package
- `GiveCache`: reveal or push a quest cache/stash style reward flow

Rule of thumb:

- use `ItemAdd` for direct deterministic grants
- use `SetItemGenerator` for authored packages or equipment kits
- use `GiveCache` when the gameplay fantasy is "discover stash / cache"

### SetGlobalVariable

Fields:

- `GlobalVariablePrototypeSID`
- `ChangeValueMode`
- `VariableValue`

Use for:

- phase/state progression
- cross-branch communication
- conditions that should survive beyond one transient node chain

This is one of the most important "glue" nodes in practical quest authoring.
`Inference` from schema scope plus local mod patterns.

High-value pairings:

- `SetGlobalVariable` + `GlobalVariable` condition
- `SetGlobalVariable` + `SetJournal`
- `SetGlobalVariable` + `OnPlayerGetItemEvent`
- `SetGlobalVariable` + `SendSignal`

### EquipItemInHands

Fields:

- `EquipmentItemSID`
- `EquipmentTypeFilter`
- `TargetQuestGuid`

Use for:

- forcing a weapon or tool into active hands

### SwitchQuestItemState

Fields:

- `ItemPrototypeSID`
- `QuestItem`

Use for:

- toggling quest-item flags/states on items

## Journal, Marker, UI, And Presentation Nodes

### SetJournal

Fields:

- `JournalAction`
- `JournalEntity`
- `JournalQuestSID`
- `JournalQuestStageSID`
- `JournalQuestDescriptionIndex`
- `SetQuestActive`
- `Markers`

This is one of the central story progression nodes. `Inference`

Use for:

- start / update / finish / fail quest and stage entries
- attaching markers to journal updates

Design recommendation:

- if a change should be visible and meaningful to the player, prefer a journal
  transition over a hidden-only graph transition

### TrackJournal

Fields:

- `JournalQuestSID`

Use for:

- making a journal entry the tracked quest

### ShowMarker

Fields:

- `MarkerSID`
- `Discovered`
- `Explored`

Use for:

- world map / quest map marker visibility

### SearchPoint

Fields:

- `TargetLocation`
- `TargetQuestGuid`

Use for:

- searchable target indication
- moving target search guidance if linked to an actor/squad

Observed usage suggests that if the target is an NPC or squad, search point
behavior tracks the current target rather than staying purely static.

### Markers inside SetJournal

`SetJournal` can also carry embedded `Markers`.

Marker item fields:

- `MarkerLocation`
- `MarkerTargetQuestGuid`
- `MarkerRadius`
- `Conditions`
- `AddOnCondition`
- `RemoveOnCondition`
- `ZoneSubMarkers`

This makes `SetJournal` more than a text node: it can also be a map guidance
node with conditional visibility.

### AddNote

Fields:

- `NotePrototypeSID`
- `PlayWhenReceived`

Use for:

- PDA/note delivery as quest consequence

This is often the lightest-weight narrative payload node when you want to
deliver information without changing objective state.

### ShowFadeScreen

Fields:

- `FadeTime`
- `ScreenText`
- `ImagePath`

Observed use:

- lightweight in-game debug message display
- transition or dramatic quest presentation

### ShowLoadingScreen / HideLoadingScreen

Use for:

- cinematic loading transitions
- controlled scene switching

`HideLoadingScreen` is the explicit counterpart that closes the previously shown
loading presentation when the scripted transition is ready to hand control back.
`Schema-confirmed`.

### AddTutorialToPDA / ShowTutorialWidget / HideTutorial

Use for:

- tutorial or hint flow
- onboarding and hint flows
- contextual instruction during mechanics-heavy quest beats

`ShowTutorialWidget` is the richest node in this family: it can point at a PDA
tutorial/note SID, localized header/body strings, required inputs, a timer, and
widget type. Use it when the quest should actively teach an interaction rather
than just register a tutorial entry. `Schema-confirmed`.

`HideTutorial` is the cleanup counterpart that dismisses a tutorial widget of a
selected type. `Schema-confirmed`.

### PlaySound / PlayVideo / PlayEffect / PlayPostProcess

Use for:

- local or global quest presentation
- dramatic transitions
- quest feedback

Observed practical behavior for `PlaySound` (`Observed`):

- it triggers the configured sound event and then finishes
- excluding the node does not stop a sound that has already been started
- location matters; this is the main node to use when quest logic must drive a
  sound at a specific world actor or ambient point

`PlayVideo` is the direct video/cut-in node in this family, while
`PlayPostProcess` and `PlayEffect` are effect-layer presentation nodes. Use
them when the quest beat is mostly audiovisual and should not be modeled as
dialog or journal state. `Schema-confirmed` for family roles, `Observed` for
usage patterns.

### AchievementUnlock / AddTechnicianSkillOrUpgrade

Use for:

- durable account/profile reward moments
- unlocking technician capabilities or upgrade availability as quest rewards

`AchievementUnlock` is the explicit meta-reward node for achievements. It
appears at milestone and ending beats rather than inside ordinary repeatable
logic. `Observed`.

`AddTechnicianSkillOrUpgrade` is the workshop/technician progression reward
node. Use it when a quest should permanently grant technician services or
specific upgrade availability. `Observed`.

### SetLocationName

Use for:

- map/location title updates

### SetQuestGiver

Fields:

- `TargetQuestGuid`
- `MainQuest`
- `MarkerDescription`

Use for:

- quest ownership/quest-giver presentation

## Spawn And World-State Nodes

### Spawn family

Shared family:

- `Spawn`
- `SpawnSquad`
- `SpawnSingleObj`
- `SpawnTrigger`
- `SpawnLair`
- `SpawnSafeZone`
- `SpawnItemContainer`
- `SpawnDeadBody`
- `SpawnAnomaly`
- `SpawnAnomalySpawner`
- `SpawnArtifactSpawner`
- `RestrictionArea`

Common fields:

- `TargetQuestGuid`
- `SpawnHidden`
- `IgnoreDamageType`
- `SpawnNodeExcludeType`

Use for:

- create quest actors or objects on demand
- stage encounters
- create temporary quest infrastructure

Observed practical behavior (`Observed`):

- an exclusion received before activation prevents the spawn from happening
- an exclusion received after activation follows the configured
  `SpawnNodeExcludeType`
- common completion cases are target death, item pickup, or container emptying,
  depending on what was spawned

Practical family split:

- actor/object creation: `Spawn`, `SpawnSingleObj`, `SpawnSquad`
- area/control volumes: `SpawnTrigger`, `SpawnSafeZone`, `RestrictionArea`
- ecology/environment: `SpawnLair`, `SpawnAnomaly`, `SpawnAnomalySpawner`,
  `SpawnArtifactSpawner`
- loot/body state: `SpawnItemContainer`, `SpawnDeadBody`

More specific readings:

- `SpawnSingleObj`: one authored world object or destructible object
- `SpawnSquad`: one whole NPC/mutant squad encounter
- `SpawnTrigger`: a quest-owned trigger volume that can later drive trigger or
  condition logic
- `SpawnSafeZone`: a temporary or quest-authored safe zone
- `SpawnLair`: a lair/ecology presence used by mutant/lair systems
- `SpawnItemContainer`: a stash/container spawn
- `SpawnDeadBody`: a corpse placeholder with inventory/story implications
- `SpawnAnomaly`: a direct anomaly instance
- `SpawnAnomalySpawner`: an anomaly field/spawner actor
- `SpawnArtifactSpawner`: an artifact-generating anomaly/spawner setup

Compatibility recommendation:

- if you can spawn a helper object/trigger instead of rewriting a complex
  vanilla object chain, prefer the helper object approach

### Despawn

Fields:

- `TargetQuestGuid`
- `SpecificItemDespawn`
- `SpawnNodeExcludeType`

Use for:

- cleanup
- encounter teardown
- branch-controlled object removal

Observed practical behavior (`Observed`):

- if the target has not spawned yet, the node can stay active and despawn it
  later when it appears
- excluding the despawn node does not cancel an already-issued despawn effect
- this is the direct cleanup counterpart to spawn-family nodes

### ActivateInteractableObject

Fields:

- `InteractableQuestGuid`
- `OutputPinNames`

Use for:

- enabling a previously unavailable object
- turning a quest object into an active branch point

Because this node also exposes `OutputPinNames`, it can act as both an object
state toggle and a branch source.

That makes it more powerful than a simple enable/disable node.

### ForceInteract

Fields:

- `InteractableQuestGuid`
- `IgnoreEnabledCheck`

Use for:

- forcing scripted interaction
- auto-driving the player or an object through quest logic

### TeleportCharacter

Use for:

- relocating a target actor to a precise quest-authored location/rotation
- hard scene transitions, rescue resets, and scripted repositioning

Its schema exposes both teleport type and an explicit location/rotation struct,
plus optional fade blending. Treat it as the deliberate "put this actor there
now" node rather than a movement/AI node. `Schema-confirmed`.

### ALifeDirectorZoneSwitch

Use for:

- switching A-Life director/scenario control for a zone
- changing high-level simulation ownership or behavior of an area as the story
  advances

Because it targets a quest GUID and carries an override scenario-group SID, this
looks like a high-level world-simulation control node rather than a local quest
beat node. It appears mostly in main-quest and hub flows. `Observed`.

### ActivateRestrictor / SetSpaceRestrictor / RestrictionArea

Use for:

- area activation
- navigation or access control
- spatial quest-state transitions

`SetSpaceRestrictor` is the lightest-weight direct assignment node in this
family: it points a target actor at a space restrictor-style quest object.
`Inference`.

`RestrictionArea` is the spawn-like variant used when the restriction volume
itself is part of the quest-authored world state and should obey spawn/exclude
semantics. `Schema-confirmed` for shape, `Observed` for usage.

### ActivateDataLayerCombination / EnableDataLayer

Use for:

- world-state swaps
- content layer enabling/disabling

`EnableDataLayer` is the direct single-layer toggle in this family. Use it when
the quest should explicitly load or unload one named data layer without
authoring a more complex layer-combination swap. `Schema-confirmed`.

### SetMeshGenerator / SetHubOwner

Use for:

- changing object generation/ownership/presentation state

`SetHubOwner` changes which actor/faction/owner is associated with a hub-like
target. In `GameLite` it appears in hub-management flows rather than in generic
combat scripting, so treat it as settlement/control-state logic. `Observed`.

### ActivateAnomaly

Use for:

- turning dormant quest-authored world systems on
- making a hazard, object, or content slice become active at a specific quest
  moment

`ActivateAnomaly` is the anomaly-focused activation node and appears in
encounter, trap, and anomaly-logic graphs. It is the "turn this anomaly field or
effect on now" counterpart to anomaly spawning. `Observed`.

### DeactivateZone

Use for:

- disabling zone behavior such as safe-zone, shelter, hub, or restrictor logic
- turning a previously protected or scripted area back into ordinary hostile or
  unrestricted space

Its schema targets a quest GUID plus an optional nav modifier, and `GameLite`
uses cluster heavily in hub/base-state changes. Treat it as the direct "this
zone stops behaving as a zone system" node. `Schema-confirmed` for shape,
`Observed` for usage.

## Character, AI, Combat, And Social Nodes

### SetCharacterParam

Fields:

- `TargetQuestGuid`
- `Params`

`Params` items carry:

- `ModifiedCharacterParam`
- `ChangeValue`
- `ChangeValueMode`
- `Rank`
- `IgnoreDamageType`

Use for:

- rank updates
- health/stamina/other stat changes
- scripted NPC/player state changes

Observed use:

- rank updates
- health/stamina/other stat changes
- scripted NPC/player state changes

This is one of the best nodes for "systemic questing", because it bridges quest
logic into gameplay stats, rank, or progression variables on real actors.
`Inference` from field scope and observed usage.

Think of it as a bridge from authored quest logic into gameplay systems.

### SetCharacterEffect

Fields:

- `EffectPrototypeSID`
- `TargetQuestGuid`

Use for:

- temporary or persistent effect application
- UI/icon workaround patterns

Prefer this when the gameplay system already models the thing you want as an
effect rather than as a one-off quest stat mutation.

Confirmed usage:

- `DesignDocs/TempEffectIconsViaCameraShakeSpec.md`

### ChangeRelationships

Fields:

- `FirstTargetSID`
- `SecondTargetSID`
- `RelationshipValue`
- `UseDeltaValue`
- `UsePreset`
- `SetFactionRelationshipAsPersonal`
- `ShouldLockPersonalRelationship`

Use for:

- faction reputation shifts
- personal relationship overrides
- branch consequences

This is one of the strongest narrative consequence nodes in the whole system.
`Inference`

See also:

- `DesignDocs/RankSystemSpec.md`

### ChangeFaction

Use for:

- reassignment of target faction

### SetAIBehavior

This is one of the largest and most powerful nodes in the schema.
`Schema-confirmed`

It controls:

- movement
- combat posture
- guard/flee behavior
- contextual actions
- battle simulation
- target following
- ability usage
- idle/rest/sleep behavior

Treat it as a full AI-goal authoring node, not as a small tweak node.

Because of its size, test every configuration live.

In practice, think of `SetAIBehavior` as a whole mini-domain rather than a
single simple node.

### SetNPCSequentialAbility

Use for:

- forcing or prioritizing scripted ability behavior

### SetWounded

Use for:

- scripted wounded state transitions

Observed practical behavior (`Observed`):

- applying the wounded state drops the target to a downed/curled-up state
- HP is forced low and regeneration is suppressed while the state is active
- squad targets can push all squad members into wounded behavior
- the same node family can also heal and restore the target when configured to
  switch wounded off
- healing can be quest-driven or dialog-driven depending on configuration

### ResetAI

Use for:

- clearing temporary AI state and forcing reset

Observed practical behavior (`Observed`):

- it clears scripted quest goals and returns an NPC or squad to ordinary A-Life
  behavior
- it is a common post-encounter cleanup step when actors should remain in the
  world instead of being despawned

### ToggleNPCHidden / DisableNPCInteraction / DisableNPCBark / NPCBark

Use for:

- visibility
- interaction lockout
- bark control
- ambient/story VO behavior

These are especially useful for staging a scene before or after more visible
quest transitions like dialog or combat.

`DisableNPCInteraction` is the stronger interaction-lock node here. Its schema
shows separate toggles for dialog, defeat-state movement/help, and dead-body
loot or despawn interaction, so use it when the quest needs fine control over
how an actor or corpse can be interacted with. `Schema-confirmed`.

`DisableNPCBark` suppresses configured bark/event categories for a target actor.
Use it to mute ambient or reactive speech while a scripted sequence is active.
`Schema-confirmed` for fields, `Observed` for common usage.

`NPCBark` is the one-shot/triggered bark counterpart: it fires a selected dialog
event on a target actor. Use it for authored comments that should happen at a
precise quest beat without launching full dialog. `Observed`.

### LookAt

Use for:

- forcing attention/aim/look behavior
- staging dramatic interactions or cutscene-lite moments

Observed practical behavior (`Observed`):

- it can force either the player camera or an NPC gaze target
- it supports static points, moving objects, and character bones as look
  targets
- it has an explicit "exit look-at" style usage for ending forced attention
- it has higher priority than ordinary dialog look-at steering

### FlashlightOnOff

Use for:

- scripted equipment/visibility mood control

### AddOrRemoveFromSquad

Use for:

- moving actors between squads
- assembling/disassembling quest groups

### ProtectLairNPCSquadItem / ToggleLairActivity / SpawnLair

Use for:

- lair/ecology driven quest orchestration

### ReputationLocker / SetFactionRestriction / SetPersonalRestriction

Use for:

- access control
- hostility/friendliness lock-in
- area/faction restrictions

`SetFactionRestriction` applies space-restriction behavior by faction, while
`SetPersonalRestriction` does the same at a per-target/personal level. These are
navigation and access-control nodes more than narrative nodes: they shape who
may enter, leave, or treat a restricted area as valid space. `Schema-confirmed`.

### SetName

Use for:

- renaming an actor or target to a different localized name SID
- revealing or changing identity presentation as part of quest progression

This appears to be a presentation/state node rather than a gameplay-state node.
`Schema-confirmed` for fields, `Inference` for authoring intent.

## Time, Weather, And Emission Nodes

### SetTime

Fields:

- `InGameHours`
- `InGameMinutes`
- `TransitionTime`

Use for:

- scripted world-time jumps

### SetTimer

Fields:

- `InGameHours`

Observed use (`Observed`):

- repeat quest cooldowns

Practical meaning:

- these nodes are the obvious choke point for recurring-quest cooldowns
- zeroing `InGameHours` is a compatible way to remove that delay when the graph
  is otherwise unchanged

This is a strong example of a low-surface-area patch with high gameplay impact.

### SetWeather

Fields:

- `Weather`
- `Force`
- `TransitionTime`

Use for:

- weather scripting around quest beats

### EmissionStart / EmissionScheduleControl

Use for:

- forcing emission start
- pausing/resuming emission schedule

`EmissionScheduleControl` is the scheduler-level node in this pair. Use it when
the quest should pause or resume the ordinary emission cycle rather than simply
start one immediately. `Schema-confirmed`.

### OnEmission\* event family

Use for:

- reacting to emission lifecycle

This family covers:

- `OnEmissionStartEvent`
- `OnEmissionFinishEvent`
- `OnEmissionStageActivated`
- `OnEmissionStageFinished`

Use the stage-specific variants when the quest logic cares about a particular
emission phase rather than only the overall start/end. `Schema-confirmed`.

### RestrictSave

Use for:

- temporarily blocking selected save types during fragile scripted moments
- protecting transitions, encounters, or sequences from unsafe mid-state saves

Its schema exposes a `SaveTypes` array, so it is a selective restriction node
rather than a blanket "no save" flag. `Schema-confirmed`.

### TrackShelter

Use for:

- shelter-tracking logic tied to emission/survival systems
- quests that care whether shelter status should be tracked as part of a larger
  world event

It appears extremely sparsely in `GameLite`, notably in emission-related logic,
so treat it as a specialized survival/world-state helper rather than a general
quest flow node. `Observed`.

## Dialogue And Narrative Control

### SetDialog

Fields include:

- `DialogChainPrototypeSID`
- `DialogMembers`
- `OutputPinNames`
- `LastPhrases`
- `NPCToStartDialog`
- `CallPlayer`
- `TalkThroughRadio`
- `SeekPlayer`
- `StartForcedDialog`

Also worth noting:

- `CallPlayerRadius`
- `CanExitAnytime`
- `ContinueThroughRadio`
- `WaitAllDialogEndingsToFinish`

Use for:

- branching dialogue
- radio dialogue
- forced narrative interaction

Observed practical behavior (`Observed`):

- dialog `End` nodes map to output pins on the linked `SetDialog` quest node
- whether `SetDialog` itself finishes or stays active depends on the linked
  dialog-end configuration
- override-style dialog topics behave more like persistent dialog-state
  overrides than one-shot speech actions and often remain in force until
  excluded or replaced by another override

This is one of the key quest-branch nodes because it often exposes multiple
ending pins.
`Schema-confirmed` for multi-output capability, `Inference` for design impact.

When building interesting quests, `SetDialog` is often the human-facing branch
selector while `If` and `Condition` are the machine-facing branch selectors.

### SendSignal / OnSignalReceived

Use for:

- decoupled communication between quest fragments and world objects
- calling helper subgraphs without direct launcher rewiring

`SendSignal` is the outbound half of the signal pair: it targets a
`SignalReceiverGuid` and is usually the cleaner solution when direct graph
coupling would be brittle. `Schema-confirmed` for shape, `Observed` for common
usage.

### Event variants that deserve explicit mention

These event nodes follow the common event pattern but with a more specialized
trigger:

- `OnAbilityUsedEvent` / `OnAbilityEndedEvent`: react to a selected ability on a
  target actor or squad; useful for mutant/NPC ability scripting.
- `OnFactionBecomeEnemyEvent` / `OnFactionBecomeFriendEvent`: react to faction
  relation flips rather than per-character relation changes.
- `OnNPCBecomeEnemyEvent` / `OnNPCBecomeFriendEvent`: react to a specific target
  actor entering enemy/friend relationship state.
- `OnNPCCreateEvent`: react when an NPC target is created/spawned into the
  world.
- `OnNPCDefeatEvent`: react to downed/defeat state rather than only full death.
- `OnPlayerNoticedEvent`: react when the player becomes noticed under a given
  threat state/sensor configuration.
- `OnPlayerRankReachedEvent`: react when a target rank threshold is reached.
- `OnMoneyAmountReachedEvent`: react when money crosses a configured amount.
- `OnUpgradeInstallEvent`: react to installation of an upgrade.
- `OnGetCompatibleAttachEvent`: react to acquisition or detection of a
  compatible attachment opportunity.
- `OnHitEvent`: react to one actor hitting another; use for damage-credit or
  aggression-sensitive logic.
- `OnJournalQuestEvent`: react to quest/stage journal transitions directly.
- `OnInfotopicFinishEvent`: react when a selected infotopic/last-phrase path
  finishes.
- `OnKillerCheckEvent`: react when kill-credit style conditions are satisfied,
  with options for full-squad and wounded-event handling.

### Nodes that are especially useful for compatibility patches

These nodes are disproportionately valuable when patching vanilla quests with
minimal surface area:

- `Technical`
- `If`
- `Condition`
- `SetGlobalVariable`
- `SetJournal`
- `SetItemGenerator`
- `ItemAdd`
- `ItemRemove`
- `SendSignal`
- `OnSignalReceived`
- `BridgeEvent`
- `Random`

Reason:

- they let you redirect, gate, enrich, or decouple flow without rewriting large
  parts of the original quest file.

### OnDialogStartEvent / OnInfotopicFinishEvent

Use for:

- dialogue-driven quest transitions
- phrase/end-state reactions

### ConsoleCommand

Use carefully:

- debug triggers
- engine-side or hidden utility paths

Observed use:

- debug triggers
- engine-side or hidden utility paths

## Authoring Recipes

### Recipe: repeating quest with no cooldown

Pattern:

- identify `SetTimer` nodes in recurring quest graphs
- set `InGameHours = 0`

Observed use:

- repeating quest cooldown removal

### Recipe: weighted reward/stash generator

Pattern:

- quest-start `Technical`
- `Random` with weighted `OutputPinNames` / `PinWeights`
- per-output `Technical` delay
- `Spawn`
- `GiveCache`
- terminal `End`

Observed use:

- weighted reward or stash selection

### Recipe: item-driven passive subsystem

Pattern:

- `OnPlayerGetItemEvent`
- `If` to validate exact item/state
- `ItemRemove`
- `ItemAdd` / `SetCharacterParam` / `SetGlobalVariable`

Observed use:

- item-driven passive systems

### Recipe: patch vanilla flow without rewriting whole quest

Pattern:

- fork an existing node
- rewrite `Launchers`
- redirect to another node SID

Observed use:

- flow rewiring that bypasses or redirects existing quest stages

### Recipe: apply item generator to player/NPC

Pattern:

- `SetItemGenerator`
- `TargetQuestGuid`
- optional `ReplaceInventory`
- optional `EquipItems`

Observed use:

- applying item generators to player or NPC targets

### Recipe: side branch that rejoins main branch

Pattern:

- main branch launches helper branch
- helper branch performs work
- `BridgeEvent` or `Bridge` condition waits on helper completion
- main branch resumes

Use this to avoid giant linear chains.

### Recipe: dialog-ending reward fanout

Pattern:

- patch or author `SetDialog`
- bind launcher edges to exact dialog output pin names
- route each ending to a distinct reward/consequence node set

Observed use:

- attaching rewards or consequences to exact dialog endings

Why it matters:

- it lets you attach rewards to exactly one dialog ending without rewriting the
  whole dialog tree

### Recipe: persistent quest subsystem anchored in rootgraph

Pattern:

- inject a `Technical` or event root into `rootgraph`
- use `LaunchOnQuestStart = true`
- add event listeners and helper state nodes from there

Observed use:

- persistent quest-side systems anchored in `rootgraph`

Why it matters:

- `rootgraph` is a strong attachment point for globally relevant systems that
  should survive many unrelated quest-file edits

## Worked Pattern Examples

These are useful because they are not merely theoretical; they are patterns
seen in working quest content.

### Example: `StashClueRework`

Confirmed patterns:

- `Technical` as quest-start bootstrap
- `Random` as weighted branch selector
- `Spawn` as staged stash/object creation
- `GiveCache` as reveal/reward action
- `ConsoleCommand` as helper subgraph entry point
- launcher rewrites for existing reward nodes
- dialog-ending-specific follow-up via exact pin names

Design lesson:

- large quest augmentations are often easiest when built as a helper subgraph
  grafted onto a few high-value existing nodes

### Example: `DecoupledRanks`

Confirmed patterns:

- item-event-driven subsystem using `OnPlayerGetItemEvent`
- `If` for branch gating
- `ItemRemove` / `ItemAdd` as counter and normalization mechanics
- `SetCharacterParam` as gameplay-state output
- `Technical` as safe replacement/pass-through node
- `rootgraph` injection for persistent quest-side systems

Design lesson:

- quest nodes are not only for authored quests; they can also host systemic
  gameplay logic if anchored carefully

### Example: `SkipIntroCutscene`

Confirmed patterns:

- pure launcher rewiring
- no need to recreate the whole graph
- compatibility-oriented patching by redirecting one upstream edge

Design lesson:

- for many flow edits, the cleanest mod is "change who launches whom" rather
  than "rebuild the entire sequence"

### Example: `NoQuestCooldown`

Confirmed pattern:

- direct single-field edits on `SetTimer.InGameHours`

Design lesson:

- not every quest redesign needs new nodes; sometimes the most compatible quest
  mod is a tiny parameter patch on the right node family

### Example: `HeadlessArmors`

Confirmed pattern:

- generating `SetItemGenerator` nodes for debug/application to player

Design lesson:

- quest graphs are also a good integration layer for testing or manually
  applying gameplay packages

## Patching Playbook

When modifying vanilla quest graphs, this order of preference is usually safest.

### 1. Change one field on one node

Examples:

- `SetTimer.InGameHours`
- `ShowFadeScreen.ScreenText`
- `SetWeather.Weather`

Best when:

- the vanilla graph is otherwise correct
- you only want a tuning change

### 2. Rewrite one launcher edge

Examples:

- skip a video
- redirect a dialog result
- bypass one gate

Best when:

- vanilla flow is mostly good
- one transition is wrong for your design

### 3. Insert helper `Technical` or `If` nodes

Best when:

- you need a delay
- you need additional branch logic
- you need a stable patch seam without replacing many vanilla nodes

### 4. Add event-driven helper subgraphs

Examples:

- `OnPlayerGetItemEvent`
- `OnSignalReceived`
- `OnJournalQuestEvent`

Best when:

- your system should react to quest/gameplay state but not own the main quest
  flow

### 5. Add a separate reusable subgraph and bridge or signal into it

Best when:

- the logic is large
- the feature should be reusable
- you want to keep the patch isolated from fragile vanilla internals

### 6. Rewrite large vanilla graph chunks

Do this only when:

- all smaller approaches fail
- the original graph structure itself is incompatible with your design

This has the highest maintenance and compatibility cost.

## Practical Guidance

### Prefer exact launcher targeting

When patching:

- connect to the exact upstream `SID`
- use exact `Name` when the source node has named outputs

This reduces accidental activation from unrelated branches.

### Prefer additive patching over destructive rewrites

Safer patterns:

- fork a node and change only the relevant fields
- inject helper nodes and redirect only one launcher edge
- use console-command or signal bootstrap nodes to enter new helper subgraphs

Riskier patterns:

- replacing entire quest files
- rewriting many unrelated launchers in one pass
- relying on undocumented fields when a `Technical` delay + explicit launcher
  rewrite would work

### Prefer stateful joins over giant linear chains

For large quest logic, prefer joining through:

- `SetGlobalVariable`
- journal state
- signals
- bridge conditions

instead of endlessly extending one brittle linear launcher chain.

### Use one transformer per target cfg file

If several behaviors touch the same quest file, combine them in one transformer.

### Use `Technical` generously

It is the safest glue node for:

- delay
- quest-start bootstrap
- replacing removed logic
- staging multi-step behavior

### Keep helper subgraphs explicit

When generating new quest fragments:

- give them clear SIDs
- terminate them explicitly
- prefer signals or bridges over fragile incidental ordering

### Use exact target references

Many action nodes operate on `TargetQuestGuid`.

For safe quest design:

- confirm the placeholder exists in the relevant graph or spawned content
- distinguish player GUID from NPC/squad/object placeholders
- avoid assuming a squad-targeting node behaves the same as an NPC-targeting
  node

### When console-command entry points are acceptable

Use `ConsoleCommand` entry points when:

- you need a cheap bootstrap into a helper subgraph
- an engine command already exists for quest-node start
- you want to minimize edits to vanilla launchers

Prefer pure quest-schema solutions when they are equally clear.

### Prefer conditions over console commands when possible

`ConsoleCommand` is useful, but schema-backed nodes are easier to reason about
and more portable across updates.

## Known Quirks And Open Questions

These are worth remembering.

- `Launchers` encode inbound links, not direct outbound edges.
- `Condition` vs `If` distinction is critical. Do not treat them as synonyms.
- `BridgeEvent` and `Bridge` conditions are central to synchronization but still
  deserve live verification in unusual edge cases.
- `Excluding` inside launcher groups is meaningful graph-control wiring: it
  disables the node and halts its execution rather than activating it. Edge
  cases around in-flight child logic still deserve live verification.
- a few nodes such as `ReputationLocker` or `NPCBark` have comparatively sparse
  or unusual schema shapes versus the mainstream node set; treat them
  cautiously.
- `SetAIBehavior` is extremely broad and should be tested live for every serious
  use.
- `TimeLock`, `TrackShelter`, some container/bridge edge semantics, and several
  niche event nodes remain under-documented compared to mainstream flow nodes.
- Observed behavior suggests `ItemRemove` on an absent item does not hard-fail
  the chain, but this should still be validated per quest pattern.

## Appendices

### Full Subtype Catalog

This is the exhaustive schema-level quest node subtype list grouped by practical
family. If you need exact fields, consult `s2cfgtojson` after locating the node
here.

#### Flow / control / graph

- `Technical`
- `Condition`
- `If`
- `Random`
- `BridgeEvent`
- `BridgeCleanUp`
- `Container`
- `ScheduledContainer`
- `End`
- `Trigger`
- `TimeLock`
- `LoadAsset`
- `SequenceStart`
- `SaveGame`
- `RestrictSave`
- `CancelAllSideQuests`

#### Event listeners

- `OnAbilityEndedEvent`
- `OnAbilityUsedEvent`
- `OnDialogStartEvent`
- `OnEmissionFinishEvent`
- `OnEmissionStageActivated`
- `OnEmissionStageFinished`
- `OnEmissionStartEvent`
- `OnFactionBecomeEnemyEvent`
- `OnFactionBecomeFriendEvent`
- `OnGetCompatibleAttachEvent`
- `OnHitEvent`
- `OnInfotopicFinishEvent`
- `OnInteractEvent`
- `OnJournalQuestEvent`
- `OnKillerCheckEvent`
- `OnMoneyAmountReachedEvent`
- `OnNPCBecomeEnemyEvent`
- `OnNPCBecomeFriendEvent`
- `OnNPCCreateEvent`
- `OnNPCDeathEvent`
- `OnNPCDefeatEvent`
- `OnPlayerGetItemEvent`
- `OnPlayerLostItemEvent`
- `OnPlayerNoticedEvent`
- `OnPlayerRankReachedEvent`
- `OnSignalReceived`
- `OnTickEvent`
- `OnUpgradeInstallEvent`

These are usually the best injection points for "add behavior without deleting
behavior" style mods.

#### Inventory / rewards / equipment

- `ItemAdd`
- `ItemRemove`
- `MoveInventory`
- `SetItemGenerator`
- `GiveCache`
- `EquipItemInHands`
- `SetDurabilityParam`
- `SwitchQuestItemState`
- `AddTechnicianSkillOrUpgrade`

#### Journal / UI / presentation

- `SetJournal`
- `TrackJournal`
- `AddNote`
- `AddTutorialToPDA`
- `ShowTutorialWidget`
- `HideTutorial`
- `ShowFadeScreen`
- `ShowLoadingScreen`
- `HideLoadingScreen`
- `ShowMarker`
- `SearchPoint`
- `SetLocationName`
- `SetQuestGiver`
- `PlaySound`
- `PlayVideo`
- `PlayEffect`
- `PlayPostProcess`

#### Spawn / world / environment objects

- `Spawn`
- `SpawnAnomaly`
- `SpawnAnomalySpawner`
- `SpawnArtifactSpawner`
- `SpawnDeadBody`
- `SpawnItemContainer`
- `SpawnLair`
- `SpawnSafeZone`
- `SpawnSingleObj`
- `SpawnSquad`
- `SpawnTrigger`
- `RestrictionArea`
- `Despawn`
- `ActivateInteractableObject`
- `ActivateRestrictor`
- `ActivateAnomaly`
- `ActivateDataLayerCombination`
- `EnableDataLayer`
- `DeactivateZone`
- `SetMeshGenerator`
- `SetHubOwner`
- `SetSpaceRestrictor`
- `SetFactionRestriction`
- `SetPersonalRestriction`
- `ALifeDirectorZoneSwitch`

#### Character / AI / social / combat

- `SetCharacterParam`
- `SetCharacterEffect`
- `SetAIBehavior`
- `SetNPCSequentialAbility`
- `SetWounded`
- `ResetAI`
- `ChangeFaction`
- `ChangeRelationships`
- `AddOrRemoveFromSquad`
- `DisableNPCBark`
- `DisableNPCInteraction`
- `NPCBark`
- `LookAt`
- `FlashlightOnOff`
- `ForceInteract`
- `ProtectLairNPCSquadItem`
- `ReputationLocker`
- `ToggleLairActivity`
- `ToggleNPCHidden`
- `SetName`
- `SetDialog`
- `SetGlobalVariable`
- `TeleportCharacter`

#### Time / weather / emissions

- `SetTime`
- `SetTimer`
- `SetWeather`
- `EmissionStart`
- `EmissionScheduleControl`

#### Special / utility / less common

- `AchievementUnlock`
- `ConsoleCommand`
- `TrackShelter`
- `SwitchQuestItemState`
- `StartBenchmark`

### Full Condition Catalog

Schema-confirmed:

- `AITarget`
- `ArmorState`
- `Awareness`
- `Bleeding`
- `Bridge`
- `ContextualAction`
- `CorpseCarry`
- `DistanceToNPC`
- `DistanceToPoint`
- `Effect`
- `Emission`
- `EquipmentInHands`
- `FactionRelationship`
- `FastTravelMoney`
- `GlobalVariable`
- `HP`
- `HPPercent`
- `HasItemInQuickSlot`
- `HungerPoints`
- `InventoryWeight`
- `IsAlive`
- `IsCreated`
- `IsDialogMemberValid`
- `IsEnoughAmmo`
- `IsOnline`
- `IsWeaponJammed`
- `IsWounded`
- `ItemInContainer`
- `ItemInInventory`
- `JournalState`
- `LookAtAngle`
- `Money`
- `NodeState`
- `Note`
- `PersonalRelationship`
- `PlayerOverload`
- `Psy`
- `Radiation`
- `Random`
- `Rank`
- `Stamina`
- `Trigger`
- `Weather`

### Quick Lookup

If you are solving a concrete quest problem, start here.

#### "I need the quest to start logic automatically"

Use:

- `Technical` with `LaunchOnQuestStart = true`
- event nodes with `LaunchOnQuestStart = true`

#### "I need a yes/no branch"

Use:

- `If`
- `Condition` if you only need a gate

#### "I need more than two outcomes"

Use:

- `Random`
- `SetDialog`
- `Container`
- `ScheduledContainer`
- any node with `OutputPinNames`

#### "I need to wait for something else to finish"

Use:

- `BridgeEvent`
- `Bridge` condition
- `NodeState` condition

#### "I need to react to player inventory"

Use:

- `OnPlayerGetItemEvent`
- `OnPlayerLostItemEvent`
- `ItemInInventory`
- `HasItemInQuickSlot`
- `SetItemGenerator`
- `ItemAdd`
- `ItemRemove`

#### "I need to update quest objectives and markers"

Use:

- `SetJournal`
- `TrackJournal`
- `ShowMarker`
- `SearchPoint`
- `AddNote`

#### "I need the patch to survive upstream vanilla quest edits"

Prefer:

- exact one-edge launcher rewrites
- helper `Technical` nodes
- `SetGlobalVariable` / `If` gates
- event-driven additions

Avoid:

- replacing large vanilla chains unless necessary

#### "I need to spawn or clean up world objects"

Use:

- spawn-family nodes
- `Despawn`
- `ActivateInteractableObject`
- `ActivateRestrictor`
- `EnableDataLayer`
- `DeactivateZone`

#### "I need to alter NPC or player gameplay state"

Use:

- `SetCharacterParam`
- `SetCharacterEffect`
- `SetAIBehavior`
- `SetWounded`
- `ChangeRelationships`
- `ChangeFaction`
- `SetNPCSequentialAbility`

#### "I need quest fragments to talk to each other without direct rewiring"

Use:

- `SendSignal`
- `OnSignalReceived`
- `SetGlobalVariable`
- `BridgeEvent`

#### Minimal Working Mental Model

If you only remember one model, use this:

1. Event or `Technical` starts a branch.
2. `If` / `Condition` decides whether to continue.
3. Action nodes change quest state, inventory, AI, journal, or world state.
4. `Random` and named pins create branching.
5. `BridgeEvent` / bridge conditions / signals rejoin or synchronize branches.
6. `End` closes the fragment.

That model is enough to build most interesting quests:

- reactive quests
- repeatable quests
- item-driven quests
- staged combat encounters
- branching dialogue outcomes
- delayed rewards
- cinematic transitions
- world-state changes
