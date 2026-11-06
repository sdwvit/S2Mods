#!/usr/bin/env python3
"""Patch the retail Stalker2-Win64-Shipping.exe so Roaming guides (A-Life squad-leader
fast travel, the ALifeGuides setting) work on Master difficulty.

Vanilla blocks them in code with two checks on EGameDifficulty::Stalker (== 3):
  1. the "can this squad leader guide the player" test returns false on Master;
  2. IsMasterCampaign(), used only by the Gameplay settings screen, locks the
     Roaming guides toggle and skips saving it.
Patch 1 NOPs the Master branch of the guide test. Patch 2 makes IsMasterCampaign()
return false. Both are found by byte pattern, so the script survives small updates.

Usage:
  master-roaming-guides.py [--exe PATH] check|apply|revert
Without --exe the exe is found under STALKER2_FOLDER (environment, else the repo .env),
else in the Steam libraries. Works from any directory, and the script can be copied anywhere.
apply writes <exe>.bak once (the unpatched original), then atomically replaces the exe.
revert restores <exe>.bak. Steam "Verify integrity" also restores the original.
"""
import argparse
import os
import re
import shutil
import sys

EXE_IN_GAME_FOLDER = os.path.join("Stalker2", "Binaries", "Win64", "Stalker2-Win64-Shipping.exe")
REPO_ENV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env")


GAME_DIR_NAME = "S.T.A.L.K.E.R. 2 Heart of Chornobyl"


def steam_roots():
    home = os.path.expanduser("~")
    roots = [
        os.path.join(home, ".steam", "steam"),
        os.path.join(home, ".local", "share", "Steam"),
        os.path.join(home, ".var", "app", "com.valvesoftware.Steam", ".local", "share", "Steam"),
        os.path.join(home, "Library", "Application Support", "Steam"),
    ]
    if os.name == "nt":
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam") as k:
                roots.insert(0, winreg.QueryValueEx(k, "SteamPath")[0])
        except OSError:
            pass
        for env in ("ProgramFiles(x86)", "ProgramFiles"):
            if os.environ.get(env):
                roots.append(os.path.join(os.environ[env], "Steam"))
    return roots


def steam_game_folders():
    """Game folder in every Steam library listed in libraryfolders.vdf."""
    import re
    seen = set()
    for root in steam_roots():
        libs = [root]
        vdf = os.path.join(root, "steamapps", "libraryfolders.vdf")
        if os.path.exists(vdf):
            text = open(vdf, encoding="utf-8", errors="replace").read()
            libs += [p.replace("\\\\", "\\") for p in re.findall(r'"path"\s+"([^"]+)"', text)]
        for lib in libs:
            folder = os.path.join(lib, "steamapps", "common", GAME_DIR_NAME)
            key = os.path.realpath(folder)
            if key not in seen and os.path.exists(os.path.join(folder, EXE_IN_GAME_FOLDER)):
                seen.add(key)
                yield folder


def default_exe():
    """Find the exe: STALKER2_FOLDER (environment, else the repo .env next to this script), else Steam libraries."""
    folder = os.environ.get("STALKER2_FOLDER")
    if not folder and os.path.exists(REPO_ENV):
        for line in open(REPO_ENV, encoding="utf-8"):
            key, sep, value = line.strip().partition("=")
            if sep and key.strip() == "STALKER2_FOLDER":
                folder = value.strip().strip("\"'")
    if folder:
        return os.path.join(folder, EXE_IN_GAME_FOLDER)
    found = list(steam_game_folders())
    if len(found) > 1:
        sys.exit("several installs found, pass --exe:\n  " + "\n  ".join(found))
    return os.path.join(found[0], EXE_IN_GAME_FOLDER) if found else None


def pat(s):
    return re.compile(b"".join(b"." if t == "??" else re.escape(bytes([int(t, 16)])) for t in s.split()), re.S)


# (name, pattern, offset of the bytes to replace within the match, original bytes, patched bytes)
PATCHES = [
    (
        "guide test: skip Master early-out",
        "48 85 c0 74 ?? 83 b8 50 01 00 00 ff 74 ?? 80 b8 c0 00 00 00 03 0f 84 ?? ?? ?? ??",
        21,
        None,  # je rel32: 0f 84 + 4 bytes, varies by build
        bytes([0x90] * 6),
    ),
    (
        "IsMasterCampaign() -> false",
        "48 83 ec 28 e8 ?? ?? ?? ?? 48 85 c0 74 ?? 83 b8 50 01 00 00 ff 74 ?? 80 b8 c0 00 00 00 03 0f 94 c0 48 83 c4 28 c3",
        0,
        bytes.fromhex("4883ec28"),
        bytes.fromhex("31c0c390"),  # xor eax,eax; ret; nop
    ),
]


def locate(data):
    """Return [(name, file_offset, orig_len, patched_bytes, state)]; state is 'vanilla' or 'patched'."""
    out = []
    for name, p, off, orig, new in PATCHES:
        hits = [m.start() + off for m in pat(p).finditer(data)]
        if len(hits) == 1:
            o = hits[0]
            if orig is not None and data[o:o + len(orig)] != orig:
                sys.exit(f"{name}: unexpected bytes at 0x{o:x}")
            out.append((name, o, new, "vanilla"))
            continue
        # Already patched? Build the patched form of the pattern and look for it.
        toks = p.split()
        toks[off:off + len(new)] = [f"{b:02x}" for b in new]
        hits = [m.start() + off for m in pat(" ".join(toks)).finditer(data)]
        if len(hits) == 1:
            out.append((name, hits[0], new, "patched"))
            continue
        sys.exit(f"{name}: pattern not found exactly once (game update changed the code?)")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--exe", help="default: <STALKER2_FOLDER>/" + EXE_IN_GAME_FOLDER + ", else found via Steam")
    ap.add_argument("action", choices=["check", "apply", "revert"])
    a = ap.parse_args()
    exe = a.exe or default_exe()
    if not exe:
        sys.exit("game not found: pass --exe, or set STALKER2_FOLDER")
    bak = exe + ".bak"

    if a.action == "revert":
        if not os.path.exists(bak):
            sys.exit(f"no backup at {bak}")
        tmp = exe + ".tmp"
        shutil.copy2(bak, tmp)
        os.replace(tmp, exe)
        print(f"restored {exe} from {bak}")
        return

    data = open(exe, "rb").read()
    sites = locate(data)
    for name, o, new, state in sites:
        print(f"{state:8} 0x{o:08x}  {name}")
    if a.action == "check":
        return
    if all(s[3] == "patched" for s in sites):
        print("already patched")
        return
    if not os.path.exists(bak):
        shutil.copy2(exe, bak)
        print(f"backup: {bak}")
    buf = bytearray(data)
    for name, o, new, state in sites:
        buf[o:o + len(new)] = new
    tmp = exe + ".tmp"
    with open(tmp, "wb") as f:
        f.write(buf)
    shutil.copymode(exe, tmp)
    os.replace(tmp, exe)  # new inode: a running game keeps the old image mapped
    print(f"patched {exe}")


if __name__ == "__main__":
    main()
