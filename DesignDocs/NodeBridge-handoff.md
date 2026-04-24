# NodeBridge — handoff for the next Claude

Last working session ended on `nodebridge-v0.2.17` (commit `997b73da`). The
goal of this section: someone picks this up cold and knows exactly where
it is, what works, what doesn't, and what to try next.

If you only read one section, read **Open problem** below.

---

## Where it stands (v0.2.17)

**End-to-end pipeline works.** Sequence verified in `bridge.log`:

1. DLL loads as `dwmapi.dll` proxy. Wine override `WINEDLLOVERRIDES="dwmapi=n,b" %command%` is **required** on Proton — without it the system DLL wins and we never load.
2. AOB scanner finds GUObjectArray; layout passes plausibility once the engine populates the array (~1 s after attach).
3. FName::ToString resolved via patternsleuth's `ps.void-cs` callsite signature, verified with `FName{0,0}` → `"None"` (well, returns a 20-char `/`-prefixed path on first FName which is good enough).
4. Player pawn found by class substring `Stalker2Character` (matches `BP_Stalker2Character_C`).
5. Smoke test runs the full path: `isReady` → wait `WorldMap_WP` → `getPlayerPawn` → `getPlayerLocation`.

**Step 5b fails right now**: `find_property_offset(pawn, "RootComponent")` returns nullopt. `listProperties` returned ONE entry with empty name + offset 0 — meaning either `UStruct.PropertyLink` offset is wrong, or `FProperty.NamePrivate` offset is wrong, on this game's GSC custom UE 5.1 build.

---

## Confirmed values for Stalker 2 (GSC build, version as of 2026-04-24)

| Thing | Value | Source |
| --- | --- | --- |
| Steam app ID | `1643320` | `src/launch-stalker2.mts` |
| Game world UObject name | `WorldMap_WP` (className `World`) | live log |
| Player pawn class substring | `Stalker2Character` matches `BP_Stalker2Character_C` | live log @ `[41407]` |
| Pawn instance index (sample) | ~196351–197526, varies per save | live log |
| GUObjectArray AOB | `48 8D 0D ? ? ? ? E8 ? ? ? ? E8 ? ? ? ? E8 ? ? ? ? C6 05 ? ? ? ? 01` | community UE4SS S2 build `GUObjectArray.lua` |
| GUObjectArray post-process | `result = (match+7) + DerefToInt32(match+3) - 0x10` | same |
| FName::ToString AOB (working) | `48 8B 48 ?? 48 89 4C 24 ?? 48 8D 4C 24 ?? E8` (callsite, E8 at offset 14) | patternsleuth `fname.rs` |
| FName::ToString resolved address | `0x140b73bc4` (sample) | live log |
| `obj_first_gc_index` | 0 (always) | live dump |
| `obj_last_non_gc_index` | -1 at startup, populated later | live dump |
| `OpenForDisregardForGC` | 1 at DLL attach, flips to 0 mid-init | live dump |
| GUObjectArray `num_elements` | grows from 32000 → ~200000 mid-game | live log |

UE engine version override: **5.1**, GSC custom fork (`MajorVersion=5, MinorVersion=1` in the community UE4SS for S2).

---

## Open problem: UStruct / FProperty layout drift

`find_property_offset` walks `UStruct.PropertyLink` (assumed at +0x60) iterating `FProperty` nodes (NamePrivate at +0x28 within FField). Observed behavior:

- For `BP_Stalker2Character_C`, returns nullopt for `"RootComponent"` (and seemingly anything else useful).
- `listProperties` walks the same chain and returns 1 entry: `{name:"", offset:0, class:""}`. Empty class name confirms even the UClass pointer's `name_private` decode failed via this path, which is suspicious because `getPlayerPawn` reads it correctly.

Likely cause: an offset is off by ~8 bytes somewhere, probably in **FFieldVariant**. Stock UE 5.1: `FFieldVariant = { ptr (8) + bool + padding }` = 16 bytes. If the GSC build packs it differently or has an extra field, every subsequent FField member shifts.

**Hypotheses to test, in order:**

1. **FFieldVariant is 24 bytes here.** Then `FField.NamePrivate` is at +0x30 (not +0x28), `FField.Next` at +0x28 (not +0x20), and `FProperty.Offset_Internal` at +0x54 (not +0x4C). Try shifting and re-running.
2. **PropertyLink offset is different.** Maybe +0x68 instead of +0x60 because `Script` (TArray) is 24 bytes here for some reason, or there's a virtual destructor adding a vtable slot.
3. **UStruct has extra fields before PropertyLink** in this build. GSC may have inserted instrumentation.
4. **UE 5.1 BP-generated classes use a different property iteration mechanism** — try walking `ChildProperties` (UStruct +0x40, chain via FField.Next) instead of `PropertyLink`.

The user (or you) just added these RPCs to help debug — declared in `bridge.mjs` / `bridge.d.ts` but **not yet wired in C++ bindings**:

- `game.dumpObjectMemory(target, offset, count)` — read raw bytes at `obj + offset`
- `game.readMemory(addr, count)` — read raw bytes at any absolute address
- `game.scanAOB(pattern)` — scan a custom AOB at runtime, return hit address
- `game.mainExeBase()` — return image base of `Stalker2-Win64-Shipping.exe`

**These need handlers added to `src/nodebridge/src/bindings.cpp` and registered in `install()` before they'll work.**

`game.dumpClassMemory(target, offset, count)` IS wired (v0.2.17). Use it for the immediate UStruct layout inspection.

---

## What to do first when you pick this up

1. **Confirm builds + smoke still work.** From `Mods/NodeBridge`: `npm run pull-nodebridge && npm run inject-nodebridge`. Launch S2, load a save, verify the class-memory dump fires with the `+0x18 +0x28 ... +0x80` ladder when `getPlayerLocation` fails.
2. **Implement the four pending RPCs** (`dumpObjectMemory`, `readMemory`, `scanAOB`, `mainExeBase`). They're small — pattern-match against `game_dump_class_memory` and `nb::aob::scan_main_exe`. The user added them client-side, so they're stubbed as "no handler" errors right now.
3. **Read the UStruct dump from the smoke test.** With v0.2.17 you should already see hex rows for offsets `+0x18, +0x28, +0x30, +0x38, +0x40, +0x48, +0x50, +0x58, +0x60, +0x68, +0x70, +0x78, +0x80`. Bytes that look like pointers (start with `00 00 ?? 7f` or `?? ?? ?? 14` for stock S2) tell you where SuperStruct, ChildProperties, PropertyLink, etc. actually live.
4. **Patch the offsets.** Update `kUStructPropertyLinkOffset`, `kUStructSuperStructOffset` in `uproperty.h`, and the FField/FProperty struct member offsets in `uproperty.h` to match what the dump reveals.
5. **Re-test `getPlayerLocation`.** Should return a real `(x, y, z)` once `RootComponent → RelativeLocation` resolves. Then the teleport loop in `Mods/NodeBridge/nodebridge/main.mts` will exercise the write path to `(404533, 550669, 579)` every 5 s.

---

## Things known to be safe / hardened

- **All game-memory reads are SEH-guarded** (v0.2.15+). `nb_try_fname_tostring`, `nb_try_read_ptr_u`, `nb_try_read_fname_u`, `nb_try_read_i32_u`, `nb_try_memcpy`, `nb_try_dump`. A wrong offset or stale pointer logs `fault reading...` and returns empty/zero — game keeps running.
- **Pipe server re-accepts** (v0.1.2). After hot-reload kills `node.exe`, the supervisor respawns it and the C++ `PipeServer` accepts the new client.
- **Loader-lock-safe DllMain** (v0.1.2). Uses `CreateThread` for bootstrap (UE main thread doesn't reliably hit alertable waits, so `QueueUserAPC` was unreliable).
- **dwmapi proxy forwarding** via `#pragma comment(linker, "/EXPORT:X=dwmapi_orig.X")` (v0.1.x, learned the hard way: `.def` files don't support DLL-to-DLL forwarders in MSVC). DllMain copies `%SystemRoot%\System32\dwmapi.dll` → `dwmapi_orig.dll` next to itself on first load.
- **Hot reload** (v0.1.2). `bootstrap.mjs` watches the loaded mod tree and exits on `*.{ts,mts,cts,mjs,cjs,js,json}` change; supervisor respawns; new code loads. `inject-nodebridge --watch` syncs repo edits to game dir.

---

## Don't redo these

Things that took time and aren't worth re-investigating:

- ✗ Lua/UE4SS-as-a-dependency. UE4SS's submodules (`Re-UE4SS/UEPseudo`) are 404 upstream — can't build it. We borrowed their AOB patterns instead. Doc: `DesignDocs/NodeBridge.md`.
- ✗ Building `libnode.dll`. Way too heavy. Subprocess + named-pipe IPC is the correct shape.
- ✗ Generic-prologue AOBs (`entry.push-rbp-rsi-rdi`, `entry.push-rbp-many`). They match thousands of unrelated functions. Calling them with FName-shaped args crashes the game. Marked `trusted=false` and never accepted.
- ✗ Substring `Player_C` in player-pawn candidates. Matched `AnimBP_Player_C` (animation blueprint CDO), crashed property walker. Removed.
- ✗ FName verification with `FName{0,0}` at DLL-attach time. FNamePool isn't populated yet. Verification now runs in the populate-poll thread against a real `obj[0].name_private`.

---

## Repo map

```
src/nodebridge/
├── CMakeLists.txt              VS 2022 x64 release, FetchContents minhook v1.3.4 + nlohmann/json v3.11.3
├── CMakePresets.json
├── readme.md
├── runtime/                    Node-side entry (shipped to game)
│   ├── bootstrap.mjs           Pipe client, mod loader, hot-reload watcher
│   ├── bridge.mjs              Public API for mods (createBridge → {log, call, on, game})
│   ├── bridge.d.ts             Types — note: contains 4 method declarations not yet wired in C++
│   └── rpc.mjs                 Length-prefixed JSON RPC over named pipe
└── src/                        C++ DLL source
    ├── dllmain.cpp             DLL_PROCESS_ATTACH → log banner, copy dwmapi_orig, CreateThread bootstrap
    ├── dwmapi_exports.cpp      31 #pragma /EXPORT:X=dwmapi_orig.X forwarders
    ├── ipc_server.{h,cpp}      Named pipe server, loop-accept on client disconnect
    ├── rpc.{h,cpp}             Router: handle/call/emit/on, framing hidden here
    ├── bindings.cpp            All game.* RPC handlers — extend this for new methods
    ├── node_host.{h,cpp}       Spawns + supervises node.exe
    ├── mod_loader.{h,cpp}      Enumerates <Win64>/NodeBridge/mods/*/main.{ts,mts,...}
    ├── paths.{h,cpp}           DLL-relative path resolution
    ├── logging.{h,cpp}         File logger at <Win64>/NodeBridge/logs/bridge.log; banner() between sessions
    ├── hook_init.{h,cpp}       MinHook init + ue::initialize() trigger; engine/tick hooks still stubbed
    ├── game_thread_queue.{h,cpp}  SPSC queue for game-thread marshaling (unused yet)
    ├── aob_scanner.{h,cpp}     IDA-style pattern parser + executable-section scanner
    ├── ue_reflection.{h,cpp}   GUObjectArray resolution + FUObjectItem walk + find_player_pawn
    ├── fname.{h,cpp}           FName::ToString AOB candidates + SEH-guarded call wrapper
    └── uproperty.{h,cpp}       UStruct/FProperty walker — ← THIS IS WHERE THE BUG IS

Mods/NodeBridge/
├── meta.mts                    Standard mod meta — empty structTransformers
├── package.json                npm scripts: pull-nodebridge, pull-node-runtime, inject-nodebridge[:watch]
├── readme.md                   Author docs incl. WINEDLLOVERRIDES requirement
└── nodebridge/
    └── main.mts                Smoke test — teleport loop, currently stuck after find_property_offset

src/inject-nodebridge.mts       Hash-skipped copy DLL + node + runtime + mod JS into game dir;
                                ends with maybeLaunchStalker2()
src/pull-node-runtime.mts       Latest portable Node from nodejs.org/dist, SHASUMS-verified
src/pull-nodebridge.mts         Latest GitHub release DLL → src/nodebridge/dist/
src/launch-stalker2.mts         Steam URL launcher gated by LAUNCH_STALKER2_AFTER_INJECT=1

.github/workflows/build-nodebridge.yml
                                windows-latest, MSVC, CMake; tagged builds attach DLL/PDB to release
```

---

## Useful commands

```sh
# Pull latest tagged release DLL + inject everything
cd Mods/NodeBridge
npm run pull-nodebridge
npm run inject-nodebridge

# Hot-reload dev loop (run in second terminal while game is up)
npm run inject-nodebridge:watch

# Tail the in-game log
tail -F "$STALKER2_FOLDER/Stalker2/Binaries/Win64/NodeBridge/logs/bridge.log"

# Check what session boundaries look like — the banner is `========…` lines
grep -n '====' "$STALKER2_FOLDER/Stalker2/Binaries/Win64/NodeBridge/logs/bridge.log"

# Full last session of the log
awk '/====+/{p=NR} END{print p}' bridge.log | xargs -I{} tail -n +{} bridge.log

# Cut a release locally:
git tag nodebridge-vX.Y.Z && git push origin nodebridge-vX.Y.Z
gh run watch "$(gh run list --workflow=build-nodebridge.yml --limit 1 --json databaseId -q '.[0].databaseId')"
```

Required env vars (`.env`):
- `STALKER2_FOLDER` — game install path
- `LAUNCH_STALKER2_AFTER_INJECT=1` — to auto-launch from inject (optional)
- `NODE_PATH`, `NODE_TS_TRANSFORMER` — see `AGENTS.md`

---

## Reference links

- [trumank/patternsleuth — fname.rs](https://github.com/trumank/patternsleuth/blob/master/patternsleuth/src/resolvers/unreal/fname.rs) — source of all working FName/FNamePool/UObject AOBs for UE 5.x.
- [UE4SS-RE/RE-UE4SS](https://github.com/UE4SS-RE/RE-UE4SS) — read for design ideas only; can't be built (broken submodules).
- Community UE4SS for S2 (PRZ mod / Nexus mod 560) — source of the GUObjectArray AOB. User had a copy at `~/Downloads/UE4SS updated-1910-1-8-1-1767217803/`; may not still exist.

---

## Memory-of-the-user notes (relevant feedback)

Stored in `~/.claude/projects/-home-sdwvit-IdeaProjects-S2Mods/memory/`:

- `feedback_no_coauthor.md` — never include `Co-Authored-By Claude` in commit messages.
- `feedback_plan_checklist.md` — write plans as checklists in `plan.md`.
- `feedback_launch_via_helper.md` — use `maybeLaunchStalker2()` from `src/launch-stalker2.mts`, not direct steam spawn.
- (no-autopush was added then revoked — push freely.)

The user is hands-on with reading logs, will paste them inline, and prefers commit-and-push over commit-only iteration. Auto mode is generally on.
