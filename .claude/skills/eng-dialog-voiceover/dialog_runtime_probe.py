# Read-only probe of the running game (retail build of 2026-09-29): dumps the dialog asset subsystem's merged
# Voiceover / FaceAnimation / VoiceGen maps, so you can see whether a mod's DialogRuntimeData was registered.
# usage: python3 -I dialog_runtime_probe.py <pid> <exe base hex> [phrase key ...]
#   pid: the process whose /proc/<pid>/maps maps Stalker2-Win64-Shipping.exe (several wine processes match the name)
#   exe base: first address of that mapping (e.g. 6ffff0d80000)
# Needs kernel.yama.ptrace_scope = 0. Never writes game memory.
import struct
import sys
from collections import Counter

PID = int(sys.argv[1])
BASE = int(sys.argv[2], 16)
WANT = sys.argv[3:]
D = BASE - 0x140000000  # addresses below are the image's own VAs
FNAME_POOL = 0x149FF0C80
OBJ_CHUNKS = 0x14A0E68D0  # FChunkedFixedUObjectArray: chunk table, 64K items of 24 bytes per chunk
OBJ_COUNT = 0x14A0E68E4
SUBSYSTEM_CLASS = 0x14A2E5850  # UDialogAssetReferenceSubsystem::StaticClass() result

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
