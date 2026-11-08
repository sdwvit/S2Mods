#!/usr/bin/env python3
"""Patch the retail Stalker2-Win64-Shipping.exe so it no longer crashes (EXCEPTION_ACCESS_VIOLATION
reading 0x0 at exe+0x8484b5) when an NPC's agent-type component cannot be created.

What crashes: an NPC setup routine (the one that logs "BAD SCRIPTING: Humanoid obj %s doesn't have a
valid NPC prototype") creates a 0x50-byte helper at NPC+0x660. Its Init (exe+0x8483fe, "G" below)
fills helper+0x38 from a factory (exe+0x848e35) that switches on the NPC prototype's EAgentType
(prototype+0x5ac):
  Human (0)            -> component class A (0x1c0 bytes)
  MutantGeneric..Deer  -> component class B (0x1b8 bytes)
  PluginAgent (17)+    -> nullptr, unless the prototype's plugin hook (+0x370) supplies one
G then passes helper+0x38 to exe+0x848492 ("F"), which calls a virtual on it without a null check
(the crash), and calls another virtual on it itself.

The patch rewrites 31 bytes of G in place, with no code cave:
    and   qword [rsp+0x28], 0     ; was mov qword [rsp+0x28], 0 (9 bytes -> 6)
    test  rcx, rcx
    jne   destroy_old
  L:mov   rcx, [rsi]              ; helper+0x38
    jrcxz epilogue                ; NEW: null component -> skip F and the virtual call
    call  F
    mov   rcx, [rsi]
    mov   rax, [rcx]
    call  [rax+0x10]
    nop
  epilogue:
and retargets the two branches that went to the old `mov rcx,[rsi]` so they land on L.
The function's prologue and stack frame are unchanged, so its .pdata unwind info stays valid.

Usage:
  null-agent-component-crash.py [--exe PATH] check|apply|revert
Without --exe the exe is found under STALKER2_FOLDER (environment, else the repo .env),
else in the Steam libraries. apply writes <exe>.bak-null-agent once (the file before this patch),
then atomically replaces the exe. revert writes the original bytes back in place, so it keeps
any other exe patch (master-roaming-guides.py) intact. Steam "Verify integrity" also restores the original.
"""
import argparse
import os
import re
import shutil
import struct
import sys

EXE_IN_GAME_FOLDER = os.path.join("Stalker2", "Binaries", "Win64", "Stalker2-Win64-Shipping.exe")
REPO_ENV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env")
GAME_DIR_NAME = "S.T.A.L.K.E.R. 2 Heart of Chornobyl"
BACKUP_SUFFIX = ".bak-null-agent"


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


# G from the instruction after its first call up to the int3 after it (offsets relative to match start).
#  0  48 83 c6 38           add rsi,0x38
#  4  48 39 fe              cmp rsi,rdi
#  7  74 4a                 je  +0x4a  (destroy tmp)
#  9  48 8b 0e              mov rcx,[rsi]
# 12  48 8b 44 24 28        mov rax,[rsp+0x28]
# 17  48 89 06              mov [rsi],rax
# 20  ---- patched region (31 bytes) ----
#     48 c7 44 24 28 00 00 00 00  mov qword [rsp+0x28],0
#     48 85 c9                    test rcx,rcx
#     75 26                       jne destroy_old
#     48 8b 0e                    mov rcx,[rsi]
#     e8 ?? ?? ?? ??              call F
#     48 8b 0e                    mov rcx,[rsi]
#     48 8b 01                    mov rax,[rcx]
#     ff 50 10                    call [rax+0x10]
# 51  ---- epilogue ----
#     48 8b 4c 24 30 48 31 e1 e8 ?? ?? ?? ?? 90 48 83 c4 38 5f 5e c3
# 72  destroy_old: 48 8b 01 ba 01 00 00 00 ff 50 08
# 83  48 8b 4c 24 28 48 85 c9
# 91  74 c5 / 74 c2             je  L
# 93  48 8b 01 ba 01 00 00 00 ff 50 08
# 104 eb b8 / eb b5             jmp L
# 106 cc
HEAD = "48 83 c6 38 48 39 fe 74 4a 48 8b 0e 48 8b 44 24 28 48 89 06"
EPILOGUE = "48 8b 4c 24 30 48 31 e1 e8 ?? ?? ?? ?? 90 48 83 c4 38 5f 5e c3 48 8b 01 ba 01 00 00 00 ff 50 08 48 8b 4c 24 28 48 85 c9"
TAIL = "48 8b 01 ba 01 00 00 00 ff 50 08"
REGION, REGION_LEN = 20, 31
CALL_F_VANILLA = REGION + 17  # offset of e8 in the vanilla region
CALL_F_PATCHED = REGION + 16  # offset of e8 in the patched region
JE_L, JMP_L = 91, 104

VANILLA_REGION = "48 c7 44 24 28 00 00 00 00 48 85 c9 75 26 48 8b 0e e8 ?? ?? ?? ?? 48 8b 0e 48 8b 01 ff 50 10"
PATCHED_REGION = "48 83 64 24 28 00 48 85 c9 75 29 48 8b 0e e3 0f e8 ?? ?? ?? ?? 48 8b 0e 48 8b 01 ff 50 10 90"
VANILLA = f"{HEAD} {VANILLA_REGION} {EPILOGUE} 74 c5 {TAIL} eb b8 cc"
PATCHED = f"{HEAD} {PATCHED_REGION} {EPILOGUE} 74 c2 {TAIL} eb b5 cc"


def call_target(data, at):
    """Absolute file-relative target of an e8 rel32 at offset `at` (same section, so file math works)."""
    assert data[at] == 0xE8
    return at + 5 + struct.unpack_from("<i", data, at + 1)[0]


def rel32(at, target):
    return struct.pack("<i", target - (at + 5))


def build_patched(data, m):
    """Patched bytes for the whole match, given the vanilla match start m."""
    f = call_target(data, m + CALL_F_VANILLA)
    region = bytearray.fromhex("48 83 64 24 28 00 48 85 c9 75 29 48 8b 0e e3 0f e8 00 00 00 00 48 8b 0e 48 8b 01 ff 50 10 90")
    region[17:21] = rel32(m + CALL_F_PATCHED, f)
    assert len(region) == REGION_LEN
    return [(m + REGION, bytes(region)), (m + JE_L, b"\x74\xc2"), (m + JMP_L, b"\xeb\xb5")]


def build_vanilla(data, m):
    """Original bytes for the whole match, given the patched match start m."""
    f = call_target(data, m + CALL_F_PATCHED)
    region = bytearray.fromhex("48 c7 44 24 28 00 00 00 00 48 85 c9 75 26 48 8b 0e e8 00 00 00 00 48 8b 0e 48 8b 01 ff 50 10")
    region[18:22] = rel32(m + CALL_F_VANILLA, f)
    return [(m + REGION, bytes(region)), (m + JE_L, b"\x74\xc5"), (m + JMP_L, b"\xeb\xb8")]


def locate(data):
    """(state, match_offset); state is 'vanilla' or 'patched'."""
    v = [x.start() for x in pat(VANILLA).finditer(data)]
    p = [x.start() for x in pat(PATCHED).finditer(data)]
    if len(v) == 1 and not p:
        return "vanilla", v[0]
    if len(p) == 1 and not v:
        return "patched", p[0]
    sys.exit(f"pattern not found exactly once (vanilla {len(v)}, patched {len(p)}): game update changed the code?")


def write_atomic(exe, buf):
    tmp = exe + ".tmp"
    with open(tmp, "wb") as f:
        f.write(buf)
    shutil.copymode(exe, tmp)
    os.replace(tmp, exe)  # new inode: a running game keeps the old image mapped


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--exe", help="default: <STALKER2_FOLDER>/" + EXE_IN_GAME_FOLDER + ", else found via Steam")
    ap.add_argument("action", choices=["check", "apply", "revert"])
    a = ap.parse_args()
    exe = a.exe or default_exe()
    if not exe:
        sys.exit("game not found: pass --exe, or set STALKER2_FOLDER")

    data = open(exe, "rb").read()
    state, m = locate(data)
    print(f"{state:8} 0x{m + REGION:08x}  agent component init: skip null component")
    if a.action == "check":
        return
    if (a.action == "apply") == (state == "patched"):
        print("already " + ("patched" if state == "patched" else "vanilla"))
        return

    edits = build_patched(data, m) if a.action == "apply" else build_vanilla(data, m)
    if a.action == "apply":
        bak = exe + BACKUP_SUFFIX
        if not os.path.exists(bak):
            shutil.copy2(exe, bak)
            print(f"backup: {bak}")
    buf = bytearray(data)
    for o, b in edits:
        buf[o:o + len(b)] = b
    want = PATCHED if a.action == "apply" else VANILLA
    if pat(want).fullmatch(bytes(buf[m:m + 107])) is None:
        sys.exit("internal error: result does not match the expected pattern; exe not written")
    write_atomic(exe, buf)
    print(("patched " if a.action == "apply" else "reverted ") + exe)


if __name__ == "__main__":
    main()
