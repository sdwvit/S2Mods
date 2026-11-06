# Save name-table limit (65,535 quest-node names)

Found 2026-10-31 while tracking down "corrupt" saves: the game crashed loading a save, and later crashed
before the main menu (the boot preload reads the newest save). Reported to GSC on ZoneKit support ticket 45893.

## Symptom
- Crash on load, or at boot before the main menu, in `FCrc::MemCrc32` (retail exe, 2026-10-29 build:
  RVA `0x2357b73` when the string pointer is null, `0x2357c61` when it is garbage).
- Every save written after some point in a playthrough crashes; older saves still load.
- An earlier reading of the same crash as a render/Lumen issue was wrong.

## Save format
- File = `uint32` uncompressed size + one Oodle Kraken stream. It decompresses with `OodleLZ_Decompress` from
  `$SDK_PATH/Engine/Binaries/DotNET/AutomationTool/liboo2corelinux64.so.9` (`src/savefiles/save-file.mts`).
- The decompressed save ends with a quest-node name table. In the saves checked it follows the bytes
  `...GlassToy_14_Christmas\0\0`: a `uint16` count, then `count` entries of (`uint16` length + chars) up to
  the end of the file. The save body refers to quest nodes by `uint16` index into this table.

## The bug
- The count and the indices are 16-bit. With more than 65,535 names the count wraps (66,400 is written as
  864) and only that many entries are written.
- On load, an index past the end of the short table returns a junk FString, and hashing it crashes.
- Call chain in the retail exe: name reader `0x22cce46` ← `0xab7d9b` (reads the u16 count, then the names)
  ← `0xab78dc` ← quest manager `0xab3e90` (in game) or boot preload `0x1fbbaf6` (before the main menu).
- A healthy save of a long vanilla playthrough holds 46–50k names. A mid-game save with a count in the
  hundreds or low thousands has overflowed.

## What pushed it over (2026-10-31)
| Save | Names | Notes |
|---|---|---|
| 19:24 | 53,917 | loads; LairMarkerTest 20,558, LairTiers 243, WolfArmorFetch 251 |
| 19:50–19:54 | count 504–864 | overflowed, crash on load |
| backups 18:41–18:51 (10 saves) | count 601–1,909 | overflowed |
| 42 older backups | 34,844–53,550 | load |

Quest-node counts at the time: LairMarkerTest 32,789; LairWars 16,839, of which 12,275 are
`LairTiers_Switch_<G>_{To,Same,On,Off,At,Set}_#` (per-lair × per-tier fan-out, see `LairTiers.md`).
The names in the table grow as quests run, so a playthrough crosses the limit later than install time.

## Cuts made (2026-10-31)
- LairWars 16,986 → 8,047: lairs switch tier per batch of ~10 (`LairTiers.md`, quest graph). The floor is 12
  `ToggleLairActivity` nodes per lair (6 tiers × On/Off, one fixed target each): 4,092.
- LairMarkerTest (32,799) is a debug mod: keep it out of `~mods` for real play.
- LairTiers is retired (merged into LairWars); its `raw/` is stale and not installed.

## Rules for mods
- Budget roughly 15k quest-node names for all mods together on top of a late vanilla playthrough.
- No per-lair × per-tier (or any N × M) quest-node fan-out. Drive repeated work through a few nodes and
  global variables or console commands.
- After a large quest-node change, check the table count of a fresh save from a long playthrough.
- A save that already overflowed can't be repaired: the missing names were never written. Restore an older
  save (`Saved/Backups/<SteamID>/<timestamp>/` holds copies) after removing the mod that pushed it over.

## Checking a save
`npm run -s savefiles -- list` (`src/savefiles/`, see the `game-saves` skill) prints every save in the game's
save folder with its name count. A healthy late-game save shows tens of thousands; an overflowed one shows a small number.
