# NodeBridge — agent notes

NodeBridge runs JavaScript inside the running game (a `dwmapi.dll` proxy, Proton needs
`WINEDLLOVERRIDES="dwmapi=n,b" %command%`). Its job is running console commands (spawning) from outside the game.
Runtime internals, memory layouts and the edit/inject/log loop: the `eng-runtime-integration` skill.
History and architecture: `DesignDocs/NodeBridge-handoff.md`.

## HTTP API (127.0.0.1:47811)
Defined in `nodebridge/main.mts` (`ENDPOINTS`); `GET /` lists them.
- `/cmd?c=<console command>`: run any console command (URL-encode it).
- `/pos`: player location.
- `/squad?faction=Spark&size=5`: spawn a squad at the player.
- `/obj?addr=<n>`, `/props?struct=<n>`, `/mem?addr=<n>&n=256`: inspect a UObject, a struct's properties, raw memory.
- `/npc?uid=<n>` or `/npc?sid=<SID>`: A-Life unit (sid, faction, relation subject id, state, health, rank, position).
  `/npcs?sid=&faction=&alive=1&limit=`: filtered pool scan.
- `/gv?sid=<SID>` or `/gv?q=<substr>`: global variable values, read from `UGlobalVariableManager` (static pointer
  `globalVariableManager` in zone.mts `BUILD_LAYOUTS`). String values are SID indices, decoded to the SID.
- `/relation?a=&b=` (a/b: `player`, `uid:N`, `sid:X` or a bare SID, or a relation subject id), `/relations?of=player`,
  `/relation/set?a=&b=&value=` (writes the record directly, bypassing the game's change hooks),
  `/relation/factions?a=&b=&value=` (`XSetRelationBetweenFactions`), `/relation/radius?r=500&value=-500`.
  Code and layouts: `nodebridge/zone.mts`. Relation records live in a hash set whose bucket array is in exe .data;
  it is found once per build (~2 s scan) and kept in the build cache as `relationBuckets`.
- `/find?q=<substring>&limit=200`: live UObjects by name/class. Slow: it reads names one memory read at a
  time and timed out after 2 min on the full object table. Don't use it for triage.

## Using it in a play session
- Drive it with `curl`; never edit or reinject the bridge files mid-session.
- It is passive: it only acts on HTTP requests, so it never shows up as a CPU cost.
- Read-only endpoints (`/pos`, `/obj`, `/props`, `/mem`) are safe any time. `/cmd` changes game state:
  run a state-changing command only when the user asked for it. `XEndQuestBySID` on LairTiers' running
  scan quests crashed the game (null write in exe+0x3b8b9f, 2026-10-29).
- To debug a quest graph, start one node at a time with `/cmd?c=XStartQuestNodeBySID <SID>` and ask the
  player one yes/no question per step.
- Console command names and arguments: repo-root `stalker_commands.txt`. `XPrintGlobalVariable` prints nothing; read global variables with `/gv`.

## Build
- `npm run inject-nodebridge` (hot-reload is wired). Log: `$STALKER2_FOLDER/Stalker2/Binaries/Win64/NodeBridge/logs/bridge.log`.
- Engine addresses (GUObjectArray, FNamePool, ProcessEvent) are resolved at runtime; game updates move them.
  The DLL keeps the first ProcessEvent hook of a game run, so a wrong hook needs a game restart.
