"""Describe voice takes as numbers (Praat via parselmouth): pitch level and range, pauses, speaking rate,
and how each phrase ends (falling = statement-like, rising = question-like). No ASR.

usage: <analysis venv python> -I analyze_take.py --ref <reference.wav> [--contour] <wav>...
Pitch is reported in semitones (st) relative to the reference clip's median, so +2 means two semitones higher
than the speaker's vanilla voice. Final slope = pitch change over the last 300 ms of voicing in each phrase.
"""
import sys
import numpy as np
import parselmouth

FLOOR, CEIL = 65, 300          # male voice range
PAUSE_MIN = 0.15               # s of silence that counts as a pause
SIL_DB = 25                    # silence = intensity this far below the take's 95th percentile


def pitch_track(snd):
    p = snd.to_pitch_ac(time_step=0.01, pitch_floor=FLOOR, pitch_ceiling=CEIL, octave_jump_cost=0.5, voicing_threshold=0.5)
    f = p.selected_array['frequency']
    return p.xs(), np.where(f > 0, f, np.nan)


def median_pitch(path):
    _, f = pitch_track(parselmouth.Sound(path))
    return float(np.nanmedian(f))


def analyze(path, ref_hz, contour):
    snd = parselmouth.Sound(path)
    t, f0 = pitch_track(snd)
    st = 12 * np.log2(f0 / ref_hz)
    it = snd.to_intensity(minimum_pitch=FLOOR, time_step=0.01)
    ti, db = it.xs(), it.values[0]
    thr = np.percentile(db, 95) - SIL_DB
    loud = db > thr
    # pauses inside speech
    pauses, s = [], None
    first, last = (np.argmax(loud), len(loud) - 1 - np.argmax(loud[::-1])) if loud.any() else (0, 0)
    for i in range(first, last + 1):
        if not loud[i] and s is None: s = i
        if loud[i] and s is not None:
            if (i - s) * 0.01 >= PAUSE_MIN: pauses.append((ti[s], ti[i]))
            s = None
    speech = (last - first) * 0.01 - sum(b - a for a, b in pauses)
    # syllable nuclei: intensity peaks >= 2 dB over the surrounding dip, loud, and voiced
    peaks, dip = [], db[0]
    for i in range(1, len(db) - 1):
        dip = min(dip, db[i])
        if db[i] >= db[i - 1] and db[i] > db[i + 1] and db[i] > thr + 6 and db[i] - dip >= 2:
            k = np.searchsorted(t, ti[i])
            if k < len(f0) and not np.isnan(f0[min(k, len(f0) - 1)]):
                peaks.append(ti[i]); dip = db[i]
    # phrases between pauses
    edges = [ti[first]] + [x for p in pauses for x in p] + [ti[last]]
    phrases = []
    for a, b in zip(edges[::2], edges[1::2]):
        m = (t >= a) & (t <= b) & ~np.isnan(st)
        if m.sum() < 5: continue
        tv, sv = t[m], st[m]
        tail = tv >= tv[-1] - 0.3
        slope = np.polyfit(tv[tail], sv[tail], 1)[0] * 0.3 if tail.sum() >= 4 else 0.0
        phrases.append((a, b, float(np.mean(sv)), float(np.max(sv) - np.min(sv)), float(slope)))
    v = st[~np.isnan(st)]
    print(f"{path}")
    print(f"  {snd.duration:.2f}s, speech {speech:.2f}s, {len(peaks)} syllables, {len(peaks)/max(speech, .1):.1f} syl/s | "
          f"pitch {np.median(v):+.1f}st vs ref (p10..p90 {np.percentile(v,10):+.1f}..{np.percentile(v,90):+.1f})")
    print("  pauses:", ", ".join(f"{a:.2f}-{b:.2f} ({b-a:.2f})" for a, b in pauses) or "none")
    for a, b, mean, rng, slope in phrases:
        kind = 'falls' if slope < -1.5 else 'rises' if slope > 1.5 else 'level'
        print(f"  phrase {a:5.2f}-{b:5.2f}: mean {mean:+.1f}st, range {rng:.1f}st, ends {kind} ({slope:+.1f}st)")
    if contour:
        row = []
        for x in np.arange(0, snd.duration, 0.1):
            m = (t >= x) & (t < x + 0.1)
            row.append('.' if np.all(np.isnan(st[m])) else f"{np.nanmedian(st[m]):+.0f}")
        print("  contour (st, 100 ms):", " ".join(row))


def features(path, ref_hz):
    """Numbers to compare two takes of the same line: pitch level/range (st vs ref), rate, pause share, phrase endings."""
    snd = parselmouth.Sound(path)
    t, f0 = pitch_track(snd)
    st = 12 * np.log2(f0 / ref_hz)
    db = snd.to_intensity(minimum_pitch=FLOOR, time_step=0.01).values[0]
    loud = db > np.percentile(db, 95) - SIL_DB
    first, last = (np.argmax(loud), len(loud) - 1 - np.argmax(loud[::-1])) if loud.any() else (0, 0)
    span = max((last - first) * 0.01, 0.1)
    gaps, g = [], 0
    for x in loud[first:last + 1]:
        if not x: g += 1
        else:
            if g * 0.01 >= PAUSE_MIN: gaps.append(g * 0.01)
            g = 0
    v = st[~np.isnan(st)]
    tail = st[max(0, len(st) - 60):]; tail = tail[~np.isnan(tail)]
    end_slope = float(np.polyfit(np.arange(len(tail[-30:])) * 0.01, tail[-30:], 1)[0] * 0.3) if len(tail) >= 8 else 0.0
    return {'med': float(np.median(v)) if len(v) else 0.0,
            'rng': float(np.percentile(v, 90) - np.percentile(v, 10)) if len(v) else 0.0,
            'pause_share': sum(gaps) / span, 'npause': len(gaps), 'speech': span - sum(gaps), 'end_slope': end_slope}


if __name__ == '__main__':
    args = sys.argv[1:]
    if '--ref' not in args:
        sys.exit(__doc__)
    if '--ref' in args:
        i = args.index('--ref'); ref = args[i + 1]; del args[i:i + 2]
    contour = '--contour' in args
    args = [a for a in args if a != '--contour']
    ref_hz = median_pitch(ref)
    print(f"reference {ref}: median {ref_hz:.0f} Hz")
    for p in args:
        analyze(p, ref_hz, contour)
