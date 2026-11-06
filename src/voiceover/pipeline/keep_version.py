"""Keep a take's current audio before it is replaced: <line dir>/<name>.wav (and its <name>.txt sidecar) moves to
<line dir>/versions/<name>/NNN.wav (.txt), numbered from 001 (oldest). The review page switches between versions.

usage: python3 -I keep_version.py <take.wav>   (prints the version it made; nothing when the take does not exist)
"""
import os, shutil, sys


def keep(take):
    """Move an existing take into its versions folder; returns the new path, or None when there is no take yet."""
    if not os.path.isfile(take):
        return None
    d, f = os.path.split(take)
    vdir = os.path.join(d, "versions", f[:-4])
    os.makedirs(vdir, exist_ok=True)
    n = 1 + max([int(x[:-4]) for x in os.listdir(vdir) if x.endswith(".wav") and x[:-4].isdigit()] or [0])
    dst = os.path.join(vdir, f"{n:03d}.wav")
    shutil.move(take, dst)
    if os.path.isfile(take[:-4] + ".txt"):
        shutil.move(take[:-4] + ".txt", dst[:-4] + ".txt")
    return dst


if __name__ == "__main__":
    v = keep(sys.argv[1])
    if v:
        print(v)
