"""Keep, per English line, the seed whose delivery measures closest to the approved UA take; archive the rest.

usage: <analysis venv python> -I select_en.py <spk>...
Compares (each against its own language's reference voice): median pitch and pitch range (semitones), share of
time spent in pauses, number of pauses, and the direction of the final phrase ending. Writes the scores to
higgs/<spk>_en/select.json. Lines that already have a single take (or an approved English final) are skipped.
"""
import glob, json, os, shutil, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vo_env  # noqa: E402
import analyze_take as A  # noqa: E402

os.chdir(vo_env.ROOT)


def dist(u, e):
    d = abs(u['med'] - e['med']) / 2 + abs(u['rng'] - e['rng']) / 3 + abs(u['pause_share'] - e['pause_share']) * 6
    d += abs(u['npause'] - e['npause']) * 0.4
    if (u['end_slope'] < -1.5 and e['end_slope'] > 1.5) or (u['end_slope'] > 1.5 and e['end_slope'] < -1.5):
        d += 2  # statement vs question flip
    return d


for spk in sys.argv[1:]:
    refs = json.load(open('refs/higgs/refs_new.json'))
    ua_ref = A.median_pitch(json.load(open(f'higgs/{spk}_uk.json'))['refs'][spk]['wav'])
    en_ref = A.median_pitch(json.load(open(f'higgs/{spk}_en.json'))['refs'][spk]['wav'])
    log_p = f'higgs/{spk}_en/select.json'
    log = json.load(open(log_p)) if os.path.exists(log_p) else {}
    for d in sorted(glob.glob(f'higgs/{spk}_en/*_*/')):
        name = os.path.basename(d.rstrip('/'))
        takes = sorted(glob.glob(d + 's*.wav'))
        ua = f'higgs/final/{spk}_uk/{name}.wav'
        if len(takes) < 2 or not os.path.exists(ua) or os.path.exists(f'higgs/final/{spk}_en/{name}.wav'):
            continue
        u = A.features(ua, ua_ref)
        scored = sorted((dist(u, A.features(t, en_ref)), t) for t in takes)
        best = scored[0][1]
        log[name] = {'ua': {k: round(float(v), 2) for k, v in u.items()},
                     'scores': {os.path.basename(t): round(s, 2) for s, t in scored}, 'kept': os.path.basename(best)}
        for _, t in scored[1:]:
            dst = f'archive/{time.strftime("%Y-%m-%d")}/en_unselected/{spk}_en/{name}/{os.path.basename(t)}'
            os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.move(t, dst)
        print(f'{name}: kept {os.path.basename(best)} ({scored[0][0]:.2f}) over',
              ', '.join(f'{os.path.basename(t)} {s:.2f}' for s, t in scored[1:]))
    json.dump(log, open(log_p, 'w'), indent=1)
