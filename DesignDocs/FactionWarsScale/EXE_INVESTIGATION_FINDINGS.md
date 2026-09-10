# Faction war engine — retail binary findings

Target: `Stalker2-Win64-Shipping.exe`, 174,730,288 bytes, mtime 2026-08-28
(`SteamLibrary/steamapps/common/S.T.A.L.K.E.R. 2 Heart of Chornobyl/Stalker2/Binaries/Win64/`).
Image base `0x140000000`. All addresses below are VAs in that build and will not
survive a patch.

The ZoneKit/SDK build was **not** used for any value. Both string dumps
(`strings -n 5` and `strings -el -n 5`) were taken from retail.

Labels used throughout: **[bin]** read from the retail binary, **[cfg]** from
config (as supplied in the prompt), **[inf]** inferred.

---

## 0. The headline, before the details

Three things reframe the whole design question:

1. **The faction roster is fully generic.** [bin] The runtime keeps
   `TMap<Faction*, Params>`, built by a plain `for (i=0; i<Num; i++)` over the cfg
   array. No `[0]`/`[1]`, no cap, no `check`/`ensure` on length.

2. **Lair capture is not part of the faction-war system.** [bin] The code that
   changes a lair's owner lives in
   `Source/Stalker2/ALife/PopulationManager/ALifePopulationManager.cpp` (the path
   is embedded next to the capture log string), it is triggered by a generic
   A-Life strategy class `UAttachToLairStrategy`, and it is reached from at least
   **five** independent call sites, only one of which is faction-war-adjacent.
   The FactionWar object is a *consumer* of ownership-change events, not their
   source.

3. **The war's authority over lairs is an explicit GUID list, not a radius.**
   [bin] `FactionWar` learns which lairs exist by walking its own prototype's
   `Reinforcers` GUID array, resolving each Reinforcer, and taking that
   Reinforcer's `TargetLair`. There is no distance test anywhere in that path.

---

## 1. Structures recovered

### `FSpawnFactionWarPrototype` (cfg-parsed; parser at `0x1469d0270`, 1921 bytes)

[bin] Hand-written parser — every field name is wide-dump-only, so none of this is
a `UPROPERTY` and none of it has editor validation.

```
+0x00  SID
+0xA0  Reinforcers      TArray<FGuid>   (Num @+0xA8, Max @+0xAC)   stride 0x10
+0xB0  UnitSpawners     TArray<FGuid>   (Num @+0xB8, Max @+0xBC)   stride 0x10
+0xC0  FactionsPresets  indexed map     (Num @+0xE8)               stride 0x28
```

Preset element (stride 0x28 = 40 B):

```
+0x00  key (preset name)
+0x08  bSpawnLairMarkers   bool
+0x10  FactionsParams      TArray<...>  (Data @+0x10, Num @+0x18, Max @+0x1C)
```

`FactionsParams` element (stride 0x28 = 40 B):

```
+0x00  int32  Faction               (faction-name-table id)
+0x04  float  MinTimerForAttack
+0x08  float  MaxTimerForAttack
+0x0C  float  MinSpawnCooldown
+0x10  float  MaxSpawnCooldown
+0x14  float  MinReinforceCooldown  default 30.0  [bin, .rdata @0x147f14f40]
+0x18  float  MaxReinforceCooldown  default 45.0  [bin, .rdata @0x1480afa1c]
+0x1C  int32  MinAttackSquadSize
+0x20  int32  MaxAttackSquadSize
+0x24  bool   bRefillEnabled
```

The array is grown with the normal `TArray` reserve path (`Num`/`Max` at
`+0x18`/`+0x1C`, grow call `0x14427ce66`). **No fixed capacity.**

### `FactionWar` runtime object (ctor `0x146806806`)

[bin] Note: this is a plain C++ struct — it has no vtable and does **not** appear
in the binary's class-name table, so there is no `UFactionWar`/`AFactionWar`
UObject. It is owned by `UFactionWarManagementSubsystem`.

```
+0x00 .. +0x48   Presets   TMap<FName, Preset>   stride 0x68
                           (elements @+0x00, hash inline @+0x38, hash ptr @+0x40,
                            bucket count @+0x48, chain-next @elem+0x60)
+0xA0            prototype handle (SID + type id) -> re-resolvable
+0xB4            name (16 B)
+0xC4            CurrentPreset (FName)
```

Preset value:

```
elem+0x08   bSpawnLairMarkers
elem+0x10   TMap<Faction*, RuntimeParams>   stride 0x58
```

`RuntimeParams` (element base, chain-next @+0x50, key = `Faction*` @+0x00):

```
+0x18  float  MinReinforceCooldown
+0x1C  float  MaxReinforceCooldown
+0x20  int32  MinAttackSquadSize
+0x24  int32  MaxAttackSquadSize
+0x28  bool   bRefillEnabled
+0x2C  float  CurrentAttackCooldown
```

(`+0x20`/`+0x24`/`+0x2C` cross-checked against the lair debug panel at
`0x1476b1038`, which prints `MinAttackSquadSize: %d`, `MaxAttackSquadSize: %d`,
`CurrentAttackCooldown: %f` from exactly those slots.)

### Lair object

[bin] Lairs are **not** UObjects either. They live in a chunked pool: 512-entry
inline chunk, **256 bytes per entry**, payload at `entry+0x10`
(`and id,0x7ffffff; cmp id,0x200; shl idx,8` idiom).

```
+0x30   OnOwnershipChanged listener list  (broadcast fn 0x142f5dda4, vslot +0x60)
+0xA0   intrusive list node into owning faction's lair list
+0xB0   Faction*  OwningFaction
+0xD0   int32     OwningFactionIdx  (index into prototype PossibleInhabitantFactions)
+0xD4   prototype handle
+0xE8   flags:  bit0 = active/IsActive
                bit1 = CanBeCapturedFlag
                bit7 = (unidentified, blocks expansion when set)
```

### Lair prototype (parsers `0x14070580c`, `0x140706a66`)

```
+0x45  bool CanBeCaptured
+0x46  bool CanAttack
+0x47  bool CanDefend
+0xA0  PossibleInhabitantFactions.Data  (Num @+0xB0)   stride 0x128 (296 B)
       entry+0x00                 Faction name (FString)
       entry+0x68 + rank*0x30     SpawnSettingsPerPlayerRanks / per-archetype
```

Other parsed fields seen: `LairType`, `InitialInhabitantFaction`, `FactionPriority`,
`RestingLair*` spawn timings, `ALifeLairsSearchRadius`,
`GameTimeOfflineToRerollLairData`, `LairCoreVolumes`, `LairTerritoryVolumes`,
`RestrictionRadius`, `bRestrictorVolumeEnabled`, `Min/MaxSpawnRank`, `ActiveLair`.

### Reinforcer and UnitSpawner prototypes

[bin] `Reinforcer` parser `0x1469d261a`:
`OwningFaction`, `TargetLair`, `DefendersCount` (`+0xB4`),
`MinReinforcementSquadSize` (`+0xB8`), `MaxReinforcementSquadSize` (`+0xBC`),
`ReinforcePriority` (`+0xC0`).

[bin] `UnitSpawner` parser `0x146a43456`:
`OwningFaction`, `Lair`, `SpawnedSquadSize` (`+0xC8`), `SpawnLocations` (`+0xC0`).

---

## Q1 — Is the faction roster generic or hardcoded to 2?  **GENERIC.**

`FactionWar::InitFromPrototype` at **`0x1468069da`** (899 bytes), called from the
constructor (`0x1468068c7`) and from the deferred re-init lambda (`0x14680e9f0`):

```c
// rcx = FactionWar* this, rdx = FSpawnFactionWarPrototype* proto
for (P : proto->FactionsPresets)                      // iterator, count = proto[+0xE8]
{
    i = this->Presets.FindOrAdd(P.Key);                // runtime map, stride 0x68
    this->Presets[i].bSpawnLairMarkers = P.bSpawnLairMarkers;

    n   = P.FactionsParams.Num;                        // [P+0x18]
    src = P.FactionsParams.Data;                       // [P+0x10]
    if (n == 0) continue;

    for (byteOff = 0; byteOff != n*40; byteOff += 0x28)   // <-- the loop
    {
        int id = *(int*)(src + byteOff);                  // Faction
        if (!IsValidFactionId(id))            continue;   // 0x1424aabd2
        FName fn = FName(FactionNameTable[id]);           // chunked pool, stride 0x20
        auto [faction, found] = ResolveFaction(fn);       // 0x1403f5c2a
        if (!found)                           continue;   // silently dropped

        j = this->Presets[i].FactionParams.FindOrAdd(faction);   // stride 0x58
        j->MinAttackSquadSize   = *(int*)  (src+byteOff+0x1C);
        j->MaxAttackSquadSize   = *(int*)  (src+byteOff+0x20);
        j->MinReinforceCooldown = *(float*)(src+byteOff+0x14);
        j->MaxReinforceCooldown = *(float*)(src+byteOff+0x18);
        j->bRefillEnabled       = *(bool*) (src+byteOff+0x24);
    }
}
```

Loop evidence (the bound is `Num * 40`, nothing else):

```
146806b1e:  movsxd rcx,DWORD PTR [rbp+0x18]     ; Num
146806b25:  ...
146806b2c:  je   0x146806ca8                    ; skip if Num == 0
146806b3e:  mov  rsi,QWORD PTR [rsi+rdi*8+0x10] ; Data
146806b43:  shl  rcx,0x3
146806b47:  lea  rbp,[rcx+rcx*4]                ; rbp = Num*8*5 = Num*40
146806b4b:  xor  edi,edi
...
146806bca:  add  rdi,0x28                       ; += sizeof(entry)
146806bce:  cmp  rbp,rdi
146806bd1:  jne  0x146806b4d
```

And the consumer side is a hash lookup keyed by `Faction*`, not a slot index —
lair debug panel, `0x1476b2d30`:

```
146806... (owner)   mov rcx,[r12+0xb0]      ; lair->OwningFaction  (the key)
1476b2d38..d67:      <UE pointer hash>, & (bucketCount-1)
1476b2d80:          imul r8,r8,0x58         ; element stride
1476b2dc4:          mov  r8d,[rbx+0x18]     ; -> MinAttackSquadSize
```

**Verdict.** A third, fourth or Nth `FactionsParams` entry will be parsed, resolved
and stored with no code change. There is no attacker/defender slot assumption at
this layer, no hard cap, and no assert on length. The one failure mode is silent:
an entry whose `Faction` name does not resolve through the normal faction registry
is dropped with no log.

**What I did not trace:** the per-tick scheduler that decides *which* faction
attacks *when* using `MinTimerForAttack`/`MaxTimerForAttack`. I confirmed the
storage is a per-faction map and that the params land in it; I did not read the
consumer that drives attacks, so I cannot rule out a 2-faction assumption in the
attack-pairing logic specifically (e.g. "attacker = the other one"). That is the
one remaining place a 2-faction assumption could hide, and it is the next thing
to read. Candidate region: `0x146808400`–`0x14680b000`.

---

## Q2 — What actually causes a lair to change owner?  **A squad standing near an enemy lair with no enemies around.**

Two layers.

### 2a. The trigger: `UAttachToLairStrategy` update, `0x1402967e2` (1053 bytes)

Class identified from the name pointer that this build stores immediately after
each vtable: vtable slot run ends at `0x148c07478`, name pointer at
`0x148c07480` → `L"UAttachToLairStrategy"`. This is a **generic A-Life strategy**,
not faction-war code.

```c
// rcx = this (attach-to-lair task), r8 = squad
if (this->bCompleted /*+0xBC*/) { ...abort/cleanup path...; return; }

if (!IsValid(squad->objectHandle /*+0x50,+0x54*/))        return;
if (!squad->component /*+0x698*/ || !IsAlive(...))        return;

lair = LairPool[this->LairId /*+0x80*/];                  // 256-B pool entry +0x10
if (lair == null)                                         return;
if (!(lair->Flags /*+0xE8*/ & 0x2))                       return;   // CanBeCapturedFlag
if (!this->MatchesLairRelation(lair))                     return;   // 0x1405F9A04
attackerFaction = GetFaction(squad);                      // 0x1401F5E2E
if (!lair->IsFactionPossibleInhabitant(attackerFaction))  return;   // 0x140C1B03E

// hostiles near the lair veto capture
if (AnyEnemyWithin(this->Pos /*+0xD8 double[3]*/, squad,
                   cvar gsc.fw.NoEnemyToLairToCapture))   return;   // 0x1467CF098

dSq_squad = DistSq3D(squad->Pos /*+0x28 float[3]*/, this->Pos);

if (dSq_squad <= sqr(cvar gsc.fw.Capture_DistSquadLair))
        goto CAPTURE;                                     // squad-only capture

// otherwise: player-assisted capture
player   = AgentPool[GlobalPlayerId];                     // 1792-B pool entry
dSq_play = DistSq3D(player->Pos /*+0x38 float[3]*/, this->Pos);
if (dSq_play  > sqr(cvar gsc.fw.PlayerCapture_DistPlayerLair)) return;
if (dSq_squad > sqr(cvar gsc.fw.PlayerCapture_DistSquadLair))  return;
if (Relation(GetFaction(player), attackerFaction) != 3)         return;  // ally band
                                                                        // 0x1423FC737

CAPTURE:
    ALifePopulationManager::CaptureLair(popMgr, this->Owner /*+0x28*/, lair);  // 0x142F5D7F6
    this->vtable[+0x2E8]();                              // finish the task
```

Inputs, definitively: **squad presence (distance), absence of enemies in a radius,
faction relation, and the lair's own permission lists.** No timer at this level, and
**no random roll** — the `SRand` idiom in the other function (`0x140c1a543`) belongs
to the expansion resolver, not to the capture decision.

`MatchesLairRelation` (`0x1405F9A04`) maps `Relation(lair->OwningFaction,
attackerFaction)` through a 5-threshold table (global at `0x14b10d518`) into a
band 0..5 and requires **band 0** — the most hostile band. So you can only take a
lair from a faction you are hostile to.

Tuning constants — all `RegisterConsoleVariableRef` at `0x143f728c0`, so these are
compile-time defaults in initialised `.data`, overridable at runtime by cvar:

| cvar | raw (uu) | metres | help text (verbatim, [bin]) |
|---|---|---|---|
| `gsc.fw.PlayerCapture_DistSquadLair` | 2500 | 25 m | "Distance from attacking squad to lair to trigger player capture" |
| `gsc.fw.PlayerCapture_DistPlayerLair` | 1500 | 15 m | "Distance from player to lair to trigger player capture" |
| `gsc.fw.Capture_DistSquadLair` | 2000 | 20 m | "Distance from attacking squad to lair to trigger squad capture" |
| `gsc.fw.NoEnemyToLairToCapture` | 5000 | 50 m | "Radius around lair to check for enemies before capturing lair" |

The `gsc.fw.` prefix is misleading: these gate `UAttachToLairStrategy`, which is
generic A-Life.

### 2b. The state change: `Lair::SetOwningFaction`, `0x1406028A0` (537 bytes)

Reached via `ALifePopulationManager::CaptureLair` (`0x142F5D7F6`), which logs
`"Faction [%s] capture Lair [%i (%s)] Game Time [%f]"` from
`D:/STALKER2/s2game_build/Source/Stalker2/ALife/PopulationManager/ALifePopulationManager.cpp`.

```c
bool Lair::SetOwningFaction(Faction* newFac)
{
    if (this->OwningFaction /*+0xB0*/ == newFac) return false;

    proto = ResolvePrototype(this->protoHandle /*+0xD4*/);
    name  = GetFactionName(newFac);

    // case-insensitive string search over the prototype's list
    idx = IndexOfByName(proto->PossibleInhabitantFactions /*+0xA0, Num +0xB0,
                                                            stride 0x128*/, name);
    if (idx == -1) return false;              // <<<<< THE HARD GATE

    if (!proto2->flag[+0xEB])
        popMgr->OnFactionLairCountChanged(&newFac, &this->OwningFaction);   // 0x142F5DE48

    this->OwningFactionIdx /*+0xD0*/ = idx;
    this->OwningFaction    /*+0xB0*/ = newFac;

    rank = this->GetSpawnRank();                                            // 0x14097D85C
    ApplySpawnSettings(this, &entry[0x68 + rank*0x30]);                     // 0x142F5DC9C
    Broadcast_OnOwnershipChanged(&this->Listeners /*+0x30*/,
                                 this, oldFaction, newFac);                 // 0x142F5DDA4
    return true;
}
```

**Where ownership state lives:** on the **lair** (`+0xB0` pointer, `+0xD0` index),
plus a per-faction lair-count map on `ALifePopulationManager` (elements `+0xB8`,
stride 0x38, hash `+0xF8`/`+0x100`/`+0x108`). **Not** on the FactionWar spawner.

**Who fires `OnLairOwnershipHasChanged`:** the **lair**, from
`Lair::SetOwningFaction`, via the listener list at `lair+0x30` (broadcast
`0x142F5DDA4`, virtual slot `+0x60`). The post-capture path `0x142F5D950`
additionally dispatches a quest event through the table at `0x148CA9860` with type
byte `0x1C` and code `0x52` — **[inf]** that is the `EQuestEventType::OnLairOwnershipHasChanged`
dispatch, but I did not verify the enum values.

The FactionWar controller only **subscribes** (see Q9). Capture is therefore not
confined to the FW controller in any way visible in this path.

---

## Q3 — Can there be more than one FactionWar controller?  **Structurally yes.**

- [bin] `FactionWar` is a **per-actor/per-prototype instance**, not a singleton.
  Its constructor (`0x146806806`) takes a prototype, stores a re-resolvable
  prototype handle at `+0xA0`, and builds its **own** preset map. The deferred
  re-init lambda (`0x14680E9B6`) reads `this->protoHandle` back — a global would
  not need that.
- [bin] `FactionWar::SetPreset` (`0x14680559C`) operates entirely on `rcx = this`:
  it compares `this->CurrentPreset` (`+0xC4`), looks the new name up in
  `this->Presets`, toggles lair markers if `bSpawnLairMarkers` differs
  (`0x146808DC2` / the else branch at `0x1468056E9`), then writes
  `this->CurrentPreset`. **No global pointer, no static cache.**
  Note: an unknown preset name is a **silent no-op** — no log, no assert.
- [bin] The `FWChangePreset` quest-node prototype parser (`0x1469D3AB0`) stores
  **two** things: `PresetName` at `node+0x30` and the `FactionWarPlaceholder`
  GUID at `node+0x38`. A design with one global war would not carry the GUID.
- [bin] `UFactionWarManagementSubsystem` exists as a real UObject class
  (name pointer `0x148CA4A50`), i.e. the wars are held in a manager collection.

**What I did not trace:** the `FWChangePreset` *runtime node's* `Execute`. I proved
the GUID is parsed and stored, and that `SetPreset` is instance-scoped, but I did
not read the code between them. So I cannot rule out an `Execute` that ignores the
stored GUID and grabs "the first war". Everything structural points the other way.

I found **no** `check`/assert and **no** cached global `FactionWar*`.

---

## Q4 — Is `ESpawnType::FactionWar` instantiable from cfg alone?  **Probably yes — but with a caveat you should read.**

[bin] The spawn-prototype factory is `0x142678704` (1113 bytes). It reads the
`SpawnType` field, splits the string on `"::"`, and resolves the value name through
the **generic enum registry** to an integer id, which selects the prototype class
from a descriptor table. Each spawn-type has a 5-slot descriptor
`{dtor, Parse, ..., ...}`; the FactionWar one is at `0x148EB2818` with
`Parse = 0x1469D0270`. So a cfg entry with `SpawnType = ESpawnType::FactionWar`
does construct an `FSpawnFactionWarPrototype` and does get parsed.

The base spawn-prototype parser (`0x142677242`, 4517 bytes) reads only:
`SpawnOnStart`, `PositionX/Y/Z`, `RotatorAnglePitch/Yaw/Roll`, `DLC`.

**Important correction to the premise:** `PlaceholderActorGuid` and
`PlaceholderMapPath` **do not exist as strings in the retail binary** — neither in
the ASCII dump nor in the UTF-16 dump. Neither the base parser nor the FactionWar
parser reads any field by those names. The field that does exist is
**`PlaceholderSID`**, and the error string
`"CheckWeatherVolumeState: PlaceholderSID '%s' does not exist in SpawnActorPrototypes"`
[bin] shows a `PlaceholderSID` is resolved **against `SpawnActorPrototypes`** —
i.e. cfg-internal, not against the `.umap`.

`FactionWar` itself holds no actor pointer at all: constructor stores only the
prototype handle. Everything it touches downstream is reached by **GUID through
the prototype registry** (`0x145856AF0`: hash the 16-byte GUID, look up a map,
return the object).

So: **[inf, moderate confidence]** a config-only FactionWar controller is
constructible. The path that would break it is not the controller but the
**Placeholder** objects: `0x146971560` checks a 16-byte GUID at
`placeholder+0xE8..0xF4` and logs `"Lair wasn't set to Placeholder"` if it is all
zero, then resolves that GUID into the lair pool. If placeholders are `.umap`
actors in your data rather than cfg entries, that is where the `.umap` dependency
would sit. **I did not verify which side placeholders live on** — that is checkable
from your data faster than from the binary.

---

## Q5 — Is the `FW_` prefix special-cased?  **No. Not at all.**

[bin] The literal string `FW_` **does not appear anywhere** in either the ASCII or
the UTF-16 dump of the retail binary. There is no prefix comparison.

`FactionsParams[i].Faction` is an id into the faction-name table; the init loop
converts it to an `FName` and resolves it through the ordinary faction registry
(`0x1403F5C2A`). `Lair::SetOwningFaction` matches faction **names** against
`PossibleInhabitantFactions` with an ordinary case-insensitive string compare.

**So yes — `FactionsParams` can name `Duty` and `Monolith` directly.** `FW_Duty`
being a cfg alias for `Duty` buys nothing at the code level.

The one thing that *does* matter: the faction name you put in `FactionsParams`
must resolve in the registry, or the entry is silently discarded.

---

## Q6 — Is the A-Life lair-expansion config consumed?  **Yes, it is live, and it can flip lair ownership on its own.**

This is the most consequential answer after Q2.

[bin] Two cvars registered at `0x143F77D00`, both `RegisterConsoleVariableRef` into
**initialised** `.data`:

| cvar | storage | default |
|---|---|---|
| `ALife.ExpandToRestingLairs` | `0x149EDD448` | **1 (on)** |
| `ALife.ReuniteToRestingLairs` | `0x149EDD449` | **1 (on)** |

Registered alongside them, as A-Life resolver names: `"Expansion"` and
`"ReuniteWithLair"`. The matching classes exist: `UExpansionResolverFactory`
(name ptr `0x148CA2DD0`) and `UReuniteWithLairResolverFactory` (`0x148DD5A30`).

Each cvar is read in exactly one place, which identifies the two resolvers:

- `ALife.ExpandToRestingLairs` is read at `0x140C19BAC` → inside the function at
  **`0x140C196A6`** (5889 bytes). That is the function holding
  `"Success(CanCapture)"`, `"Success(CanNotCapture)"`, `"Should defend own lair"`,
  `"No lair found"`, `"No participants"`. **So those strings belong to the A-Life
  expansion resolver, not to a faction-war function.**
- `ALife.ReuniteToRestingLairs` is read at `0x140B39E4A` → inside **`0x140B38EC2`**
  (3196 bytes), the function with `"Has lair"`, `"No lair"`, `"Success"`,
  `"No participants"`.

### The expansion resolver's lair search

```c
// rsi = the group/goal; center = (rsi[+0x28], rsi[+0x2C])
R        = 70000.0f;                     // .data 0x149EDD0CC   [bin, compile-time]
cellSize = 10150.0f;                     // .rdata 0x148E79FB0  [bin, compile-time]
minCell  = clamp((center - R) / cellSize, 0, 79);
maxCell  =       (center + R) / cellSize;
Rsq      = R * R;                        // 0x140C19B03: mulss xmm9,xmm9

for (cell in [minCell .. maxCell] x [..])          // grid at .data 0x14AD947F8
  for (lair in cell)
  {
      dSq = sqr(cx - lair->x /*+0x20*/) + sqr(cy - lair->y /*+0x24*/);   // 2D
      if (dSq > Rsq)                       continue;
      if ((lair->Flags[+0xE8] & 0x81) != 1) continue;   // bit0 set AND bit7 clear
      if (!ALife.ExpandToRestingLairs)     goto skip_expansion;
      ... candidate scoring, SRand roll at 0x140C1A543 ...
  }
// each considered squad is then tagged with a debug reason:
//   "Success(CanCapture)" if bl else "Success(CanNotCapture)"        (0x140C1A7C1)
// and lair->someFlag[+0x89B] = 1                                     (0x140C19...)
```

Numbers, labelled:

- **70,000 uu = 700 m** search radius. [bin] compile-time: it sits in initialised
  `.data`, is read from six sites and **written from none** — per the
  constant-provenance rule that makes it effectively hardcoded. Caveat from the
  same rule: a config parser writing a whole struct through a base pointer would
  not name this address, so "no writer" is not proof of immutability. The
  neighbouring slots hold an unrelated mix (1.5, 0.5, 250000, 10000, 3000, 30, 600,
  0.7), which reads like a `static const float` pool rather than a config struct.
- **10,150 uu = 101.5 m** grid cell size. [bin] `.rdata`, compile-time.
- **80 cells per axis** (clamp bound `0x4F` = 79). [bin]

**Unit confirmation, independent of any comment:** 80 x 10,150 uu = 812,000 uu.
If units are centimetres that is **8,120 m per axis ≈ 65.9 km²**, which matches the
known playable extent of the Zone. Units are centimetres. This is the second,
independent check the method asks for (the first being the in-data
`FarLairDistance = 100000.f // 1000m` comment).

### Does expansion change owners by itself?

[bin] `Lair::SetOwningFaction` (`0x1406028A0`) has **three** direct callers:

| caller | what it is |
|---|---|
| `0x142F5D851` | inside `ALifePopulationManager::CaptureLair` (the capture path) |
| `0x1437922D7` | lair init/reroll — sets the owner to `InitialInhabitantFaction`; the sibling log is `"Preset.InitialInhabitantFaction is not valid! UID = %d"` |
| `0x1469649CA` | a function in the quest-node/prototype region (947 bytes, `0x146964670`) — **[inf]** a quest node that sets a lair's faction; not identified |

And `ALifePopulationManager::CaptureLair` (`0x142F5D7F6`) has **four** callers:

| caller | what it is |
|---|---|
| `0x140296A83` | `UAttachToLairStrategy` update (Q2) |
| `0x1405FE2E0` | fn `0x1405FE0AA`, same translation unit as the expansion resolver's participant helpers (`0x1405FE4A2`, `0x1405FE6E6`) — **[inf]** the expansion goal executor |
| `0x1467EBD7C` | fn `0x1467EBCA2`, in the same code page as the `"Expansion"` / `"ReuniteWithLair"` registration thunks (`0x1467EBA89`, `0x1467EBACE`) — **[inf]** expansion/reunite resolver |
| `0x1467ECFC8` | fn `0x1467ECEA6`, same neighbourhood — **[inf]** as above |

**Answer: yes.** The expansion system is present, its gate cvar defaults **on**, and
it reaches the same ownership-change function. Lair ownership can move without any
FactionWar controller being involved. The three `[inf]` attributions above rest on
code-locality plus the cvar reads, not on a name — treat them as strong hints, not
proof. The one *proven* independent path is `UAttachToLairStrategy`, which is a
generic A-Life strategy class with no faction-war dependency in its code.

### The other declared expansion fields

[bin] These are parsed — I confirmed the parser reads them, **not** what they
control:

- `ALifeLairExpansionTime`, `ALifeLairExpansionRadius`, `ALifeStartSimulation` —
  parser `0x14331C9A4` (614 bytes).
- `MinLairs`, `MaxLairs`, `ALifeLairExpansionBattleChance`, `ALifeFactionGoals`
  (`EALifeFactionGoalType`) — parser `0x1410BC02E` (1420 bytes).
- `DefaultALifeLairExpansionToPlayerTimeMin` / `...Max` — parser `0x1410AADFA`
  (7643 bytes). Confirmed **wide-dump-only**, i.e. hand-parsed, no editor exposure.
- `ALifeLairsSearchRadius` — on the *lair* prototype, parser `0x140706A66`.
- `alife.EnableExpansionScenarioPointSelection` — cvar registered at `0x143F7D128`,
  storage `0x14ADA62C0`, which is in the **zero-init tail** of `.data`. That means
  no compile-time default is stored in the binary; it is 0/false at load unless a
  static initialiser writes it. I did not check for such a writer, so I will not
  report a default.

`ALifeLairExpansionRadius = 500000` (5 km) is **[cfg]**, config-written. It is
*not* the 700 m radius used by the resolver above; those are different values in
different places, and I did not connect the cfg field to a specific consumer.

---

## Q7 — `UnitSpawners` / `Reinforcers` semantics.  **Per-faction, per-lair, explicitly authored. Not a shared pool.**

[bin] Both are `TArray<FGuid>` on the FactionWar prototype
(`Reinforcers` at `+0xA0`, `UnitSpawners` at `+0xB0`, stride 0x10 = `FGuid`), and
each GUID resolves to its own spawn-actor prototype:

- **Reinforcer**: `OwningFaction`, `TargetLair`, `DefendersCount`,
  `MinReinforcementSquadSize`, `MaxReinforcementSquadSize`, `ReinforcePriority`.
- **UnitSpawner**: `OwningFaction`, `Lair`, `SpawnedSquadSize`, `SpawnLocations`.

So the binding is `(faction, lair)` per object — 19 spawners and 30 reinforcers for
2 factions is roughly "one per faction per lair, plus extras".

Three FactionWar methods walk these arrays:

| fn | array | what it does |
|---|---|---|
| `0x1468073D8` | `Reinforcers` (`+0xA0`) | for each GUID → resolve → take `obj[+0x10]` (its lair) → bind a delegate (`0x146809270`) into that lair's ownership-changed list at `lair+0x30` |
| `0x146806D5E` | `Reinforcers` (`+0xA0`) | resolve each, then look up the current preset (stride 0x68) and the per-faction params (stride 0x58) — i.e. push preset params onto each reinforcer |
| `0x14680755C` | (1565 bytes) | third init step; I did not read it in full |

**Count cap:** none found. Both arrays are plain `TArray`s with the normal
`Num`/`Max` reserve path.

**A third faction needs its own spawners and reinforcers**, one set per lair it can
attack or defend, each with `OwningFaction` set to that faction. That is fully
discoverable from the data — the fields are named in cfg and nothing about the
count or the faction is hardcoded.

---

## Q8 — Persistence.  **NOT DETERMINED. Do not design around either answer.**

I did not find lair-ownership save/load serialisation, and I want to be explicit
that this is a gap, not a negative result.

What I checked and what it turned out to be:

- The wide string `"Lairs"` (`0x149369EE8`, builder `0x142F6604E`) is a **debug-menu
  category name**, not a save chunk. Its siblings in the same table are `"AI"`,
  `"ALife"`, `"Input"`, `"Show"`, `"Weather"`, `"WorldPartition"`,
  `"Level Bookmarks"`, `"Globals"`, `"Scripts"`.
- No `Save*`/`Serialize*` string mentions lairs or faction war.
- No lair-specific `USaveGame`-family class in the 6,526-entry class-name table.

Circumstantial evidence **for** persistence, offered as such:

- Ownership is stored twice: as a pointer (`lair+0xB0`) **and** as an index into
  the prototype's `PossibleInhabitantFactions` (`lair+0xD0`). Storing a
  re-resolvable index next to a pointer is the shape of something that survives a
  pointer-invalidating round trip.
- The error `"Lair has invalid OwningFactionIdx = %d. Please check PossibleInhabitantFactions"`
  appears in **four** separate functions, one of which (`0x142F5E738`) reads
  `lair[+0xD0]` and validates it against `proto[+0xB0]` (the array count). Repeated
  revalidation of an index fits a load path.
- `GameTimeOfflineToRerollLairData` implies per-lair data that persists across
  game time.

None of that is a serialiser. **[inf, low confidence]** ownership is persisted via
`OwningFactionIdx`. If continuity across sessions matters to the design, test it
empirically — capture a lair, save, reload, check — that is far cheaper than
finding GSC's binary serialiser in the disassembly.

---

## Q9 — Base-map viability.  **Yes: a lair near Rostok can change owner, and the FW controller's distance to it is irrelevant.**

Everything gating capture, restated as a checklist against `WorldMap_WP`:

| gate | where | DLC/CNPP-specific? |
|---|---|---|
| lair `Flags & 0x2` (`CanBeCapturedFlag`) | `lair+0xE8`, read at `0x14127515A` | **unknown — see below** |
| owning faction's runtime entry `[+0x24]` is true | popMgr faction map, `0x140C1BF1C` | no; per-faction |
| attacker is in the lair prototype's `PossibleInhabitantFactions` | `Lair::IsFactionPossibleInhabitant` `0x140C1B03E` **and again** in `SetOwningFaction` | no; per-lair-prototype |
| relation(owner, attacker) in the most hostile band | `0x1405F9A04` | no |
| distances (20/25/15 m) and no enemies within 50 m | cvars, `0x1402967E2` | no |
| the squad is running `AttachToLair` | `UAttachToLairStrategy` | no; generic A-Life |

**No DataLayer check. No level-name check. No restrictor volume. No "quest must be
active" check.** None of these appear in the capture path. The path runs entirely
through `ALifePopulationManager` and a generic A-Life strategy.

**On the FW controller's radius of authority:** it has none. `FactionWar` does not
do a distance test against lairs anywhere I read. It walks its **Reinforcers'
`TargetLair` GUIDs** (`0x1468073D8`) and subscribes to exactly those lairs. The
1.49 km from the CNPP controller to Rostok is therefore not a meaningful number,
and neither is `ALifeLairExpansionRadius = 500000` in this context. A Rostok lair
would be captured by the *A-Life* system regardless of any controller, and would
be *reported to* a FactionWar only if a Reinforcer belonging to that war names it.

**So, concretely: yes**, a lair near Rostok (`WorldMap_WP`, ~X321267 Y412054) can
change owner — provided its prototype lists both factions in
`PossibleInhabitantFactions`, its `CanBeCapturedFlag` is on, and the two factions
are hostile.

That first condition is the real constraint, and it is checked **twice**
(pre-check in the strategy, hard gate in `SetOwningFaction`). **Check your Rostok
lair prototypes' `PossibleInhabitantFactions` lists before anything else** — that
single cfg array decides whether a given lair is capturable by a given faction, and
it is the cheapest thing in this whole investigation to verify.

---

## The `FW_*` lair prototypes: why nothing references them

Your sweep found `FW_Duty`, `FW_Freedom`, `FW_HumansOnly`, `FW_HumansAndMutants`
referenced by zero placed actors. The binary explains why, and it rules out one of
your three candidate mechanisms.

**Ruled out: runtime prototype swapping.** `Lair::SetOwningFaction` does **not**
change the lair's prototype. It resolves `lair->protoHandle` (`+0xD4`) read-only,
uses it to validate and index, and writes only `OwningFaction` (`+0xB0`) and
`OwningFactionIdx` (`+0xD0`). There is no prototype-SID assignment and no name
built from a prefix anywhere in that function — and, per Q5, the literal `"FW_"`
does not exist in the binary at all, so no name can be constructed from it.

**What actually happens:** the lair keeps its ordinary prototype
(`CNPPSmallLivingSpace`, `GuardDuty`, `GuardFreedom`, ...). Ownership is a pointer
plus an index into **that** prototype's `PossibleInhabitantFactions`. The
per-faction spawn behaviour after a capture comes from that same array —
`ApplySpawnSettings(this, &entry[0x68 + rank*0x30])` at `0x140602A5E`. The
`FW_*` lair prototypes are never needed for any of this.

**Registration:** a lair does not need to be "registered" with the war to be
captured — capture is A-Life's. What registration exists runs the other way: the
**war** registers itself as a **listener** on the lairs named by its Reinforcers'
`TargetLair` GUIDs (`0x1468073D8`), so it hears about ownership changes and can
schedule attacks and reinforcements.

So of your three candidates, the third is closest: **ownership is tracked on the
lair, and the `FW_*` lair prototypes are unused.** [inf] They look like dead
authoring artefacts.

The one caveat: I traced the **read** of `CanBeCapturedFlag` (`lair+0xE8` bit 1) but
**did not find its writer**. The three `or BYTE [x+0xE8],0x2` sites in `.text` all
belong to unrelated classes that happen to have a byte at `+0xE8` (MSVC offset
coincidence). So *what turns a lair's capturability on* is the one genuinely open
question in this report. The lair prototype has a cfg field `CanBeCaptured` at
prototype `+0x45` (parser `0x140706A66`, `0x140707339`), and **[inf]** the runtime
flag is most likely seeded from it at lair creation — but I did not prove the link,
and it is worth proving before you rely on it.

---

## What I did not trace (consolidated)

1. **The attack scheduler.** `MinTimerForAttack`/`MaxTimerForAttack`/
   `Min/MaxSpawnCooldown` land in the per-faction map; I did not read the code that
   consumes them. This is the only place a 2-faction assumption could still hide.
   Start at `0x146808400`–`0x14680B000`.
2. **`FWChangePreset`'s runtime `Execute`.** Parsed GUID confirmed, instance-scoped
   `SetPreset` confirmed, the link between them not read.
3. **Caller chains and frequency.** Every function here was found by strings or
   xrefs and read inward. I do not know how often `UAttachToLairStrategy::Update`
   runs, how many squads run it, or what makes a squad adopt `AttachToLair` in the
   first place. Any statement about *rate* of capture is outside what I checked.
4. **The writer of `CanBeCapturedFlag`.** See above.
5. **Save/load serialisation.** See Q8.
6. **Whether Placeholders are cfg entries or `.umap` actors.** This is the residual
   risk in Q4 and is faster to answer from your data.
7. **`FactionWar::0x14680755C`** (1565 bytes), the third init step.
8. **The `[+0x24]` bool** on the population manager's per-faction entry that gates
   `Lair::CanBeCaptured`. `bParticipatesInFactionWar` is a real cfg field on the
   faction prototype (parser `0x14315DB3C`, stored at prototype `+0x158`), and it
   is the obvious candidate, but I did not prove that it feeds `[+0x24]`.
