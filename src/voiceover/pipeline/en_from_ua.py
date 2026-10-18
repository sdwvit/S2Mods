"""Write English scripts (higgs/<spk>_en.json) for every approved UA line, carrying the UA line's tags over.

usage: python3 -I en_from_ua.py --text <subtitles.json> [--text ...] <spk>...
--text: JSON with English subtitles, a list (or a dict of lists) of {"sid": ..., "en": ...}; later files win.
- Only lines with an approved UA take (higgs/final/<spk>_uk/<NN>_<SID>.wav) get an English line; same n and sid.
- English text = the English subtitle of the same sid from the --text files.
- Each tag in the UA tagged text is placed in the same sentence of the English text, before the word at the same
  relative position (tags before the first word stay at the start). Stress marks and UA-only tricks are dropped.
- Lines already in higgs/<spk>_en.json keep their text (so manual fixes survive a rerun); new lines are appended.
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vo_env  # noqa: E402

TAG = re.compile(r'<\|[^|]*\|>')
SENT = re.compile(r'(?<=[.!?…])\s+')


def load_lines(path):
    d = json.load(open(path, encoding='utf-8'))
    return d if isinstance(d, list) else [x for v in d.values() if isinstance(v, list) for x in v]


def en_text(files):
    out = {}
    for f in files:
        for l in load_lines(f):
            out[l['sid']] = l['en']
    return out


def tag_positions(ua):
    """[(sentence index, fraction of the sentence's words before the tag, tag)]"""
    out = []
    sents = SENT.split(ua.strip())
    for si, s in enumerate(sents):
        parts = TAG.split(s); tags = TAG.findall(s)
        words_total = len(TAG.sub('', s).split())
        before = 0
        for k, tg in enumerate(tags):
            before += len(parts[k].split())
            out.append((si, before / max(words_total, 1), len(sents), tg))
    return out


def carry(ua, en):
    en = re.sub(r'\s*\([^)]*\)', '', en.replace('«', '').replace('»', ''))  # stage directions like (shows the note)
    sents = SENT.split(en.strip())
    words = [s.split() for s in sents]
    ins = {}  # (sentence, word index) -> [tags]
    for si, frac, n_ua, tg in tag_positions(ua):
        tsi = si if n_ua == len(sents) else min(len(sents) - 1, round(si * len(sents) / max(n_ua, 1)))
        wi = 0 if frac == 0 else min(len(words[tsi]) - 1, max(1, round(frac * len(words[tsi]))))
        ins.setdefault((tsi, wi), []).append(tg)
    out = []
    for si, ws in enumerate(words):
        out.append(' '.join(''.join(ins.get((si, wi), [])) + w for wi, w in enumerate(ws)))
    return ' '.join(out)


def main():
    args, files = sys.argv[1:], []
    while '--text' in args:
        i = args.index('--text'); files.append(os.path.abspath(args[i + 1])); del args[i:i + 2]
    if not files or not args:
        sys.exit(__doc__)
    os.chdir(vo_env.ROOT)
    en = en_text(files)
    refs = json.load(open('refs/higgs/refs_new.json', encoding='utf-8'))
    for spk in args:
        ua = json.load(open(f'higgs/{spk}_uk.json', encoding='utf-8'))
        dst = f'higgs/{spk}_en.json'
        cur = json.load(open(dst, encoding='utf-8')) if os.path.exists(dst) else None
        have = {l['sid'] for l in cur['lines']} if cur else set()
        r = refs[f'{spk}_en']
        sc = cur or {'refs': {spk: {'wav': os.path.abspath(r['wav']), 'text': r['text']}}, 'lines': []}
        added = 0
        for l in ua['lines']:
            if l.get('same_as'):  # reuses another line's take
                continue
            if l['sid'] in have or not os.path.exists(f"higgs/final/{spk}_uk/{l['n']:02d}_{l['sid']}.wav"):
                continue
            if l['sid'] not in en:
                print('no English text for', l['sid']); continue
            sc['lines'].append({'n': l['n'], 'sid': l['sid'], 'speaker': spk, 'text': carry(l['text'], en[l['sid']]), 'ua': l['text']})
            added += 1
        sc['lines'].sort(key=lambda x: x['n'])
        json.dump(sc, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'{spk}: +{added} lines -> {dst} ({len(sc["lines"])} total)')


if __name__ == '__main__':
    main()
