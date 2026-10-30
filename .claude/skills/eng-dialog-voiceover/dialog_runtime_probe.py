# Read-only probe of the running game (retail build of 2026-09-29): dumps the dialog asset subsystem's merged
# Voiceover / FaceAnimation / VoiceGen maps, so you can see whether a mod's DialogRuntimeData was registered.
# usage: python -I dialog_runtime_probe.py [--pid <pid> --base <exe base hex>] [phrase key ...]
# Finds the game process and its exe base by itself; pass --pid/--base when several processes match.
# Windows: run as the same user as the game. Linux: needs ptrace access (kernel.yama.ptrace_scope = 0).
# Never writes game memory.
import os
import struct
import sys
from collections import Counter

EXE = "Stalker2-Win64-Shipping.exe"
args = sys.argv[1:]
opts = {}
while args and args[0] in ("--pid", "--base"):
    opts[args[0]] = args[1]
    args = args[2:]
WANT = args


def find_linux():
    """(pid, base) of every process that maps the exe; several can match the name, only one maps it."""
    found = []
    for pid in filter(str.isdigit, os.listdir("/proc")):
        try:
            with open(f"/proc/{pid}/maps") as f:
                for line in f:
                    if line.rstrip().endswith(EXE):
                        found.append((int(pid), int(line.split("-", 1)[0], 16)))
                        break
        except OSError:
            pass
    return found


if os.name == "nt":
    import ctypes
    from ctypes import wintypes

    k32 = ctypes.WinDLL("kernel32", use_last_error=True)

    class MODULEENTRY32W(ctypes.Structure):
        _fields_ = [("dwSize", wintypes.DWORD), ("th32ModuleID", wintypes.DWORD), ("th32ProcessID", wintypes.DWORD),
                    ("GlblcntUsage", wintypes.DWORD), ("ProccntUsage", wintypes.DWORD),
                    ("modBaseAddr", ctypes.c_void_p), ("modBaseSize", wintypes.DWORD), ("hModule", wintypes.HMODULE),
                    ("szModule", ctypes.c_wchar * 256), ("szExePath", ctypes.c_wchar * 260)]

    class PROCESSENTRY32W(ctypes.Structure):
        _fields_ = [("dwSize", wintypes.DWORD), ("cntUsage", wintypes.DWORD), ("th32ProcessID", wintypes.DWORD),
                    ("th32DefaultHeapID", ctypes.c_void_p), ("th32ModuleID", wintypes.DWORD),
                    ("cntThreads", wintypes.DWORD), ("th32ParentProcessID", wintypes.DWORD),
                    ("pcPriClassBase", ctypes.c_long), ("dwFlags", wintypes.DWORD), ("szExeFile", ctypes.c_wchar * 260)]

    k32.CreateToolhelp32Snapshot.restype = wintypes.HANDLE
    k32.OpenProcess.restype = wintypes.HANDLE
    k32.ReadProcessMemory.argtypes = [wintypes.HANDLE, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_size_t,
                                      ctypes.POINTER(ctypes.c_size_t)]

    def find_windows():
        found = []
        snap = k32.CreateToolhelp32Snapshot(0x2, 0)  # TH32CS_SNAPPROCESS
        pe = PROCESSENTRY32W(dwSize=ctypes.sizeof(PROCESSENTRY32W))
        ok = k32.Process32FirstW(snap, ctypes.byref(pe))
        while ok:
            if pe.szExeFile.lower() == EXE.lower():
                ms = k32.CreateToolhelp32Snapshot(0x8 | 0x10, pe.th32ProcessID)  # TH32CS_SNAPMODULE(32)
                me = MODULEENTRY32W(dwSize=ctypes.sizeof(MODULEENTRY32W))
                if k32.Module32FirstW(ms, ctypes.byref(me)):
                    found.append((pe.th32ProcessID, me.modBaseAddr))  # the first module is the exe
                k32.CloseHandle(ms)
            ok = k32.Process32NextW(snap, ctypes.byref(pe))
        k32.CloseHandle(snap)
        return found

    found = [] if "--pid" in opts else find_windows()
else:
    found = [] if "--pid" in opts else find_linux()

if "--pid" in opts:
    PID, BASE = int(opts["--pid"]), int(opts["--base"], 16)
elif len(found) == 1:
    PID, BASE = found[0]
else:
    sys.exit(f"{len(found)} processes map {EXE}: {found}. Pass --pid <pid> --base <hex>.")
print(f"pid {PID}, exe base {BASE:x}")
D = BASE - 0x140000000  # addresses below are the image's own VAs
FNAME_POOL = 0x149FF0C80
OBJ_CHUNKS = 0x14A0E68D0  # FChunkedFixedUObjectArray: chunk table, 64K items of 24 bytes per chunk
OBJ_COUNT = 0x14A0E68E4
SUBSYSTEM_CLASS = 0x14A2E5850  # UDialogAssetReferenceSubsystem::StaticClass() result

if os.name == "nt":
    handle = k32.OpenProcess(0x0010 | 0x0400, False, PID)  # PROCESS_VM_READ | PROCESS_QUERY_INFORMATION
    if not handle:
        sys.exit(f"OpenProcess({PID}) failed: {ctypes.get_last_error()}")

    def rd(a, n):
        buf = ctypes.create_string_buffer(n)
        got = ctypes.c_size_t()
        if not k32.ReadProcessMemory(handle, ctypes.c_void_p(a), buf, n, ctypes.byref(got)) or got.value != n:
            raise OSError(f"ReadProcessMemory({a:#x}, {n}) failed: {ctypes.get_last_error()}")
        return buf.raw
else:
    mem = open(f"/proc/{PID}/mem", "rb", buffering=0)

    def rd(a, n):
        mem.seek(a)
        return mem.read(n)


def q(a):
    return struct.unpack("<Q", rd(a, 8))[0]


def d(a):
    return struct.unpack("<i", rd(a, 4))[0]


blocks = {}


def fname(comp, num=0):
    if comp == 0 and num == 0:
        return "None"
    b = comp >> 16
    if b not in blocks:
        blocks[b] = q(FNAME_POOL + D + 0x10 + b * 8)
    e = blocks[b] + (comp & 0xFFFF) * 2
    h = struct.unpack("<H", rd(e, 2))[0]
    n = h >> 6
    s = rd(e + 2, n * 2).decode("utf-16-le") if h & 1 else rd(e + 2, n).decode("latin1")
    return f"{s}_{num - 1}" if num else s


def fn8(a):
    c, n = struct.unpack("<II", rd(a, 8))
    return fname(c, n)


def name_of(o):
    return fn8(o + 0x18)


def is_a(o, cls):  # UStruct base chain: array at +0x30, depth at +0x38
    c = q(o + 0x10)
    if not c:
        return False
    depth = d(cls + 0x38)
    return depth <= d(c + 0x38) and q(q(c + 0x30) + depth * 8) == cls + 0x30


chunks, count, target = q(OBJ_CHUNKS + D), d(OBJ_COUNT + D), q(SUBSYSTEM_CLASS + D)
for i in range(count):
    ch = q(chunks + (i >> 16) * 8)
    o = q(ch + (i & 0xFFFF) * 24) if ch else 0
    if not o or d(o + 8) & 0x10:  # skip CDOs
        continue
    try:
        if not is_a(o, target):
            continue
    except OSError:
        continue
    print(f"{name_of(o)} ({name_of(q(o + 0x10))}): loaded={rd(o + 0x90, 1)[0]}")
    # TMap<FName AssetType, UDialogPhraseAssetContainer*>: elements at +0x30, count +0x38, 0x18 each
    for k in range(d(o + 0x38)):
        e = q(o + 0x30) + k * 0x18
        kind, agg = fn8(e), q(e + 8)
        if not agg:
            continue
        n = d(agg + 0x30)
        line = f"  [{kind}] {name_of(q(agg + 0x10))}: {n} entries"
        if kind != "FaceAnimation":  # NameToAsset: TMap<FName, FSoftObjectPath> at +0x28, 0x30 each
            keys = {}
            for j in range(n):
                a = q(agg + 0x28) + j * 0x30
                keys[fn8(a)] = fn8(a + 8)
            mods = Counter(p.split("/")[1] for p in keys.values() if p.count("/") > 1)
            line += f", by package root {dict(mods.most_common(8))}"
            for w in WANT:
                line += f"\n    {w} -> {keys.get(w)}"
        print(line)  # FaceAnimation entries have another layout: only the count is read here
