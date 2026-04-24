# NodeBridge — handoff for the next Claude

Last working session ended on `nodebridge-v0.2.20` with the JS-side
property walker fully landed and the teleport loop driven entirely
from TypeScript. Pick-up-cold orientation:

If you only read one section, read **Where it stands** below.

---

## Where it stands (v0.2.20, commit `3d320f81` and friends)

**End-to-end pipeline works** end-to-end through `getPlayerLocation`:

1. DLL loads as `dwmapi.dll` proxy. Wine override
   `WINEDLLOVERRIDES="dwmapi=n,b" %command%` is **required** on Proton.
2. AOB resolution: GUObjectArray + FName::ToString both via patternsleuth
   patterns. FName resolver verified against `obj[0].name_private`
   after FNamePool is populated.
3. Player pawn discovered by class substring `Stalker2Character`
   (matches `BP_Stalker2Character_C`).
4. JS-side property walker uses verified GSC offsets to find any
   FProperty on a UClass. `getPlayerLocation` runs entirely in TS.
5. Teleport loop writes RootComponent.RelativeLocation **and**
   RootComponent.ComponentToWorld.Translation, plus zeros
   CharacterMovement.Velocity each tick. read-back lines confirm
   the writes land.

**Open question**: whether the visual position actually updates
in-game. read-back shows our values but the user reported the
character not moving on a prior session (before velocity-zero +
auto-detect were added). Needs another in-game test.

---

## Architectural principle

**DLL exposes primitives. Logic lives in JS.** The C++ side ships
the minimum thunks over engine calls; everything else (walkers,
finders, list-of-properties, teleport, etc.) is TypeScript in the
mod. This is enforced by the saved memory
`feedback_nodebridge_primitives_in_dll.md`.

C++ primitives currently exposed:
- Memory: `readMemory`, `writeMemory`, `dumpObjectMemory`,
  `dumpClassMemory`
- AOB: `scanAOB`, `mainExeBase`
- Engine bootstrap: `isReady`, `getEngineVersion`, `getObjectCount`,
  `listObjects`, `getObjectByIndex`, `getObjectByName`,
  `getPlayerPawn`
- Decoder: `fnameToString` (FName{comp,num} → UTF-8)

C++ stubs that should eventually be deleted (live in
`uproperty.{h,cpp}` and `bindings.cpp`) — superseded by the JS
walker:
- `find_property_offset`, `list_properties`
- `getProperty`, `setProperty`, `callFunction` (return unresolved)
- `getPlayerLocation`, `setPlayerLocation` (return unresolved)

These don't hurt anything; cleanup is bookkeeping.

---

## Verified GSC UE 5.1 layout (Stalker 2)

| Field | Stock UE 5.1 | GSC build | Shift |
| --- | --- | --- | --- |
| `UStruct.PropertyLink` | +0x60 | **+0x70** | +0x10 |
| `UStruct.PropertiesSize` | +0x48 | **+0x58** | +0x10 |
| `UStruct.SuperStruct` | +0x30 | **+0x40** (assumed) | +0x10 |
| `FField.NamePrivate` | +0x28 | **+0x28** | unchanged |
| `FProperty.property_link_next` | +0x58 | **+0x58** | unchanged |
| `FProperty.offset_internal` | +0x4C | **+0x4C** | unchanged |
| `UObjectBase.class_ptr` | +0x10 | +0x10 | unchanged |

So FField/FProperty are pure stock; only UStruct's own members
shift by +0x10. This is encoded in the `GSC` constant block at the
top of `Mods/NodeBridge/nodebridge/main.mts`.

Property offsets verified on `BP_Stalker2Character_C`:
- `RootComponent` @ +0x1A0
- `Mesh` @ +0x320
- `CharacterMovement` @ +0x328
- `CapsuleComponent` @ +0x330

---

## Confirmed values for Stalker 2

| Thing | Value | Source |
| --- | --- | --- |
| Steam app ID | `1643320` | `src/launch-stalker2.mts` |
| Pawn class | `BP_Stalker2Character_C` (className `World` for UWorld instances) | live log |
| Pawn instance index (varies per save) | ~196276–197617 | live log |
| GUObjectArray AOB | `48 8D 0D ? ? ? ? E8 ? ? ? ? E8 ? ? ? ? E8 ? ? ? ? C6 05 ? ? ? ? 01` | community UE4SS S2 build |
| GUObjectArray post-process | `result = (match+7) + DerefToInt32(match+3) - 0x10` | same |
| FName::ToString AOB | `48 8B 48 ?? 48 89 4C 24 ?? 48 8D 4C 24 ?? E8` (callsite) | patternsleuth |
| FName::ToString resolved (sample) | `0x140b73bc4` | live log |
| GUObjectArray base | `0x1478f2a10` | live log |
| GUObjectArray num_elements after engine init | 32000 (grows past 200K mid-game) | live log |

UE version: **5.1**, GSC custom fork.

---

## Hot reload (now polling-based)

`bootstrap.mjs` polls every 1s for changes to any
`*.{ts,mts,cts,mjs,cjs,js,json}` under `mods/<modName>/`. On change
it logs `[bootstrap] reload: <modName>/<file>` and exits node;
the C++ supervisor respawns and the new code loads.

Was previously `fs.watch(recursive: true)` but that maps to
`ReadDirectoryChangesW` under Wine and didn't reliably fire when
the Linux host wrote (as `inject-nodebridge` does). Polling
costs ~negligible CPU and always works.

---

## Workflow once you've changed something

```sh
# DLL change → tag, wait CI, pull, restart game (DLL replacement
# can't hot-reload):
git tag nodebridge-vX.Y.Z && git push origin nodebridge-vX.Y.Z
gh run watch "$(gh run list --workflow=build-nodebridge.yml --limit 1 --json databaseId -q '.[0].databaseId')"
cd Mods/NodeBridge && npm run pull-nodebridge && npm run inject-nodebridge

# JS-only change (smoke test mod, runtime/, etc.) — hot reload:
cd Mods/NodeBridge && npm run inject-nodebridge
# then watch for the [bootstrap] reload: line in bridge.log
tail -F "$STALKER2_FOLDER/Stalker2/Binaries/Win64/NodeBridge/logs/bridge.log"
```

`pack-inject` (not `inject-nodebridge`) auto-launches the game via
`maybeLaunchStalker2`. `inject-nodebridge` does not — by design.

---

## Where to look in code

```
src/nodebridge/
├── runtime/
│   ├── bootstrap.mjs         poll-based hot reload + mod loader
│   ├── bridge.mjs            JS API (createBridge → {log, call, on, game})
│   ├── bridge.d.ts           types
│   └── rpc.mjs               length-prefixed JSON RPC over named pipe
└── src/                      C++ DLL
    ├── bindings.cpp          every game.* RPC handler
    ├── ue_reflection.{h,cpp} GUObjectArray walk + FUObjectItem access
    ├── fname.{h,cpp}         FName::ToString resolver
    ├── aob_scanner.{h,cpp}   IDA-style pattern scanner
    └── uproperty.{h,cpp}     dead C++ walker (deprecated; keep until cleanup)

Mods/NodeBridge/nodebridge/main.mts
    Smoke test mod. Has the GSC offset block, the JS walker, the
    property API (S2 namespace) for future mods, and the teleport
    loop. Top-of-file comment is a how-to.

DesignDocs/NodeBridge-handoff.md   ← you are here
src/nodebridge/readme.md           native side architecture + AOBs
```

---

## Things known to be safe / hardened

- All game-memory reads go through SEH-guarded primitives
  (`nb_try_dump`, `nb_try_read_ptr_u`, `nb_try_read_fname_u`,
  `nb_try_read_i32_u`, `nb_try_memcpy`). Wrong offset / stale pointer
  logs `fault reading…`, game keeps running.
- Pipe server re-accepts on client disconnect (hot-reload works).
- DllMain uses `CreateThread` (UE main thread doesn't reliably hit
  alertable waits — `QueueUserAPC` was unreliable).
- FName::ToString candidates verified against
  `obj[0].name_private` after FNamePool is populated, not at attach
  time. Untrusted candidates are scanned but never invoked.
- `get_item(idx)` SEH-guards the chunk-pointer dereference, so a
  half-initialized GUObjectArray (num_chunks=0) returns nullptr
  rather than crashing.

---

## Don't redo these

- ✗ UE4SS as dependency: submodule `Re-UE4SS/UEPseudo` 404s, can't
  build from source. Borrow patterns, don't link.
- ✗ Building `libnode.dll`: too heavy. Subprocess + named pipe IPC
  is correct.
- ✗ Generic-prologue AOBs (`entry.push-rbp-rsi-rdi` etc): match
  thousands of unrelated functions. Marked `trusted=false`.
- ✗ `Player_C` class substring for pawn: matches `AnimBP_Player_C`,
  crashes property walker.
- ✗ `fs.watch(recursive)` for hot-reload under Wine: unreliable.
- ✗ FName verification at DLL-attach: FNamePool not populated yet.
- ✗ Patching `uproperty.h` C++ offsets every time GSC drifts:
  rebuild the walker in JS instead — that's why `readMemory` and
  `fnameToString` exist as primitives.

---

## Useful commands

```sh
# Tail the in-game log
tail -F "$STALKER2_FOLDER/Stalker2/Binaries/Win64/NodeBridge/logs/bridge.log"

# Find session boundaries (banner lines)
grep -n '====' "$STALKER2_FOLDER/Stalker2/Binaries/Win64/NodeBridge/logs/bridge.log"

# Last session (banner-onwards)
awk '/====+/{p=NR} END{print p}' bridge.log | xargs -I{} tail -n +{} bridge.log
```

Required env vars (`.env`):
- `STALKER2_FOLDER`
- `LAUNCH_STALKER2_AFTER_INJECT=1` (used by pack-inject only)
- `NODE_PATH`, `NODE_TS_TRANSFORMER` (see `AGENTS.md`)

---

## Reference links

- [trumank/patternsleuth — fname.rs](https://github.com/trumank/patternsleuth/blob/master/patternsleuth/src/resolvers/unreal/fname.rs)
- [UE4SS-RE/RE-UE4SS](https://github.com/UE4SS-RE/RE-UE4SS) — patterns only, can't build.
- Community UE4SS for S2 (PRZ mod / Nexus mod 560) — source of the
  GUObjectArray AOB.

---

## Memory-of-the-user notes

Stored in `~/.claude/projects/-home-sdwvit-IdeaProjects-S2Mods/memory/`:

- `feedback_no_coauthor.md` — never include `Co-Authored-By Claude`.
- `feedback_plan_checklist.md` — write plans as checklists in `plan.md`.
- `feedback_launch_via_helper.md` — use `maybeLaunchStalker2()`.
- `feedback_nodebridge_primitives_in_dll.md` — DLL exposes primitives;
  iterate walker logic in JS over `readMemory` + `fnameToString` etc.

The user is hands-on with reading logs, prefers commit-and-push
over commit-only iteration, and confirmed pushes are fine without
explicit per-push approval — but they DO want to confirm DLL
changes (which require a CI cycle + restart). Auto mode is on.

Always confirm before destructive actions; the user is fine with
file edits and routine commits/pushes.
