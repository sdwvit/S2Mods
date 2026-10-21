"""Add WolfArmorFetch voice lines to the open Wwise project over WAAPI (HTTP, port 8090).

usage: python3 -I wwise_import.py <approved_dir> [--dry] [--only <regex>]
<approved_dir>/manifest.json maps <speaker>_<en|uk>/<NN>_<SID>.wav -> {sid, speaker, ...} (voice/approved/).
The WAVs are copied to STAGE (Wine sees /media/nvme as WINE_NVME, default S:) as {en,uk}/VO_<speaker>_<SID>.wav.

Everything goes into the mod's own work units, so the repo only has to carry those two .wwu files:
- Actor-Mixer Hierarchy: <WU> next to the vanilla hub work units, one Actor-Mixer per speaker that copies the
  properties and references (bus, attenuation, loudness normalisation, ...) of the template's own Actor-Mixer.
- Each line is a Sound Voice cloned from a vanilla line of the same speaker (TEMPLATES), with EN + UA sources
  that keep the template source's conversion override, and a same-named Event with one Play action.
Re-running replaces the sources and reuses the existing objects.
"""
import json, os, re, shutil, sys, urllib.error, urllib.request, wave

URL = "http://127.0.0.1:8090/waapi"
TEMPLATES = {  # speaker -> vanilla Sound Voice to clone (its Actor-Mixer's settings are copied too)
    "volk": "VO_volk_RookieVillage_Hub_volk_1_Meet_Meet_62346",
    "pc": "VO_pc_RookieVillage_Hub_sidorovic_0_RestoreReputation_RestoreReputation_62303",
    "ward": "VO_VoiceA_General_army_0_Infotopic_ConcretePlant_1_1_63285",
    "sultan": "VO_sultan_Sultansk_Hub_sultan_0_ByeTopic_ByeTopic_32856",
    "vasyan": "VO_VoiceN_General_bandits_0_Infotopic_Sultan_1_1_55402",
}
WU = "VO_WolfArmorFetch"
HUB_WU = "VO_RookieVillage_Hub"  # the new work units sit next to this one, in both hierarchies
LANGS = {"en": "English(US)", "uk": "Ukrainian(UA)"}
ORIGINALS_SUBFOLDER = "WolfArmorFetch"
STAGE = "/media/nvme/vm/voice-clone/wwise_stage"
WINE_NVME = os.environ.get("WINE_NVME", "S:")  # the Zone Kit's Wwise sees /media/nvme as S:, WwiseConsole as U:\nvme
# Silence added after each take: the game starts the next line as soon as one ends, and the takes are trimmed
# to ~0.05 s, so speakers cut in. Trailing silence keeps the face anim in sync with the voice.
PAD_END_S = 0.1


def call(uri, args=None, options=None):
    body = json.dumps({"uri": uri, "args": args or {}, "options": options or {}}).encode()
    req = urllib.request.Request(URL, body, {"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            res = json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:  # WAAPI answers errors with HTTP 500 and the message in the body
        res = json.loads(e.read() or b"{}")
    # every WAAPI error answer carries an ak.wwise.* uri (ak.wwise.error..., ak.wwise.invalid_options, ...)
    if isinstance(res, dict) and str(res.get("uri", "")).startswith("ak.wwise."):
        raise RuntimeError(f"{uri}: {res.get('message')} {json.dumps(res.get('details', ''))[:500]}")
    return res


def get(waql, ret=("id", "name", "path", "type")):
    return call("ak.wwise.core.object.get", {"waql": waql}, {"return": list(ret)}).get("return", [])


def one(waql, ret=("id", "name", "path", "type")):
    r = get(waql, ret)
    return r[0] if r else None


def create(parent, type_, name):
    """create/copy take no `return` option (they answer {id, name}), so the path is looked up after."""
    made = call("ak.wwise.core.object.create", {"parent": parent, "type": type_, "name": name, "onNameConflict": "merge"})
    return one(f'$ "{made["id"]}"')


def to_wine(path):
    p = os.path.abspath(path)
    assert p.startswith("/media/nvme/"), f"{p} is not visible to Wine"
    return WINE_NVME + "\\" + p[len("/media/nvme/"):].replace("/", "\\")


def copy_settings(src, dst):
    """Copy every property/reference of src that differs from dst (a freshly created object of the same type)."""
    names = call("ak.wwise.core.object.getPropertyAndReferenceNames", {"object": src}).get("return", [])
    skip = {"Name", "Notes", "Color", "OverrideColor"}
    names = [n for n in names if n not in skip]
    a = call("ak.wwise.core.object.get", {"from": {"id": [src]}}, {"return": [f"@{n}" for n in names]})["return"][0]
    b = call("ak.wwise.core.object.get", {"from": {"id": [dst]}}, {"return": [f"@{n}" for n in names]})["return"][0]
    changed = []
    for n in names:
        v = a.get(f"@{n}")
        if v is None or v == b.get(f"@{n}"):
            continue
        if isinstance(v, dict):  # a reference: {id, name}
            call("ak.wwise.core.object.setReference", {"object": dst, "reference": n, "value": v["id"]})
        else:
            call("ak.wwise.core.object.setProperty", {"object": dst, "property": n, "value": v})
        changed.append(n)
    return changed


def pad_end(src, dst, seconds=PAD_END_S):
    """Copy a PCM WAV from src to dst with `seconds` of silence appended."""
    with wave.open(src) as r:
        params, frames = r.getparams(), r.readframes(r.getnframes())
    with wave.open(dst, "wb") as w:
        w.setparams(params)
        w.writeframes(frames + b"\0" * (round(params.framerate * seconds) * params.sampwidth * params.nchannels))


def stage(approved):
    """Copy the approved takes, padded (PAD_END_S), to STAGE/{en,uk}/VO_<speaker>_<SID>.wav; returns {name: speaker}."""
    manifest = json.load(open(f"{approved}/manifest.json"))
    shutil.rmtree(STAGE, ignore_errors=True)
    names = {}
    for rel, m in manifest.items():
        # the folder names the speaker: m["speaker"] can be a voice variant of it (ward_angry)
        speaker, lang = rel.split("/")[0].rsplit("_", 1)
        name = f"VO_{speaker}_{m['sid']}"
        os.makedirs(f"{STAGE}/{lang}", exist_ok=True)
        pad_end(f"{approved}/{rel}", f"{STAGE}/{lang}/{name}.wav")
        names[name] = speaker
    return names


def main():
    approved, dry = sys.argv[1], "--dry" in sys.argv
    only = re.compile(sys.argv[sys.argv.index("--only") + 1]) if "--only" in sys.argv else None
    names = {n: s for n, s in sorted(stage(approved).items()) if not only or only.search(n)}
    print(call("ak.wwise.core.getInfo")["displayName"], "| project:", call("ak.wwise.core.getProjectInfo").get("name"))
    print(len(names), "lines:", {s: list(names.values()).count(s) for s in TEMPLATES})

    hubs = get(f'$ from type WorkUnit where name = "{HUB_WU}"', ("id", "path", "parent.id"))
    hub = {t: next(h for h in hubs if h["path"].startswith(f"\\{t}\\")) for t in ("Actor-Mixer Hierarchy", "Events")}
    for t, h in hub.items():
        print(f"{t}: {WU} goes next to {h['path']}")
    tpls = {}
    for spk, tname in TEMPLATES.items():
        tpl = one(f'$ from type Sound where name = "{tname}"')
        assert tpl, f"template {tname} not found"
        # the nearest Actor-Mixer up the tree: generic voices (ward, bandits) sit in per-line voice-variant containers
        mixer = one(f'$ "{tpl["id"]}" select parent')
        while mixer and mixer["type"] != "ActorMixer":
            mixer = one(f'$ "{mixer["id"]}" select parent')
        src = one(f'$ "{tpl["id"]}" select children where type = "AudioFileSource"', ("id", "@OverrideConversion", "@Conversion"))
        tpls[spk] = (tpl, mixer, src)
        print(f"{spk}: {tpl['path']}")
    if dry:
        return

    wu = {t: create(h["parent.id"], "WorkUnit", WU) for t, h in hub.items()}
    mixers = {}
    for spk, (tpl, mixer, _) in tpls.items():
        if spk not in names.values():
            continue
        mixers[spk] = create(wu["Actor-Mixer Hierarchy"]["id"], "ActorMixer", spk)
        print(f"{spk} mixer: copied", copy_settings(mixer["id"], mixers[spk]["id"]))

    for name, spk in names.items():
        tpl, _, tsrc = tpls[spk]
        parent = mixers[spk]
        sound = one(f'$ from type Sound where name = "{name}"')
        if not sound:
            sound = call("ak.wwise.core.object.copy", {"object": tpl["id"], "parent": parent["id"], "onNameConflict": "rename"})
            call("ak.wwise.core.object.setName", {"object": sound["id"], "value": name})
        for src in get(f'$ "{sound["id"]}" select children where type = "AudioFileSource"'):
            call("ak.wwise.core.object.delete", {"object": src["id"]})
        imports = [{"audioFile": to_wine(f"{STAGE}/{lang}/{name}.wav"), "importLanguage": wlang,
                    "objectPath": f"{parent['path']}\\<Sound Voice>{name}", "originalsSubFolder": ORIGINALS_SUBFOLDER}
                   for lang, wlang in LANGS.items() if os.path.exists(f"{STAGE}/{lang}/{name}.wav")]
        objects = []
        for imp in imports:  # one call per language: an import takes one audio file per object path
            res = call("ak.wwise.core.audio.import", {"importOperation": "useExisting", "default": {}, "imports": [imp]},
                       {"return": ["id", "name", "type", "originalFilePath"]})
            errors = [l["message"] for l in res.get("log", []) if l.get("severity") == "Error"]
            if errors:
                raise RuntimeError(f"{name} {imp['importLanguage']}: {errors}")
            objects += res.get("objects", [])
        for o in objects:
            if o.get("type") == "AudioFileSource":
                print(f"{name}: source", o.get("originalFilePath"))
                if tsrc and tsrc.get("@OverrideConversion"):  # vanilla VO sources use CS_200ms+_VO
                    call("ak.wwise.core.object.setProperty", {"object": o["id"], "property": "OverrideConversion", "value": True})
                    call("ak.wwise.core.object.setReference", {"object": o["id"], "reference": "Conversion", "value": tsrc["@Conversion"]["id"]})
        if not one(f'$ from type Event where name = "{name}"'):
            folder = create(wu["Events"]["id"], "Folder", spk)
            call("ak.wwise.core.object.create", {
                "parent": folder["id"], "type": "Event", "name": name, "onNameConflict": "merge",
                "children": [{"type": "Action", "name": "", "@ActionType": 1, "@Target": sound["id"]}]})
            print(f"{name}: event created")
    call("ak.wwise.core.project.save")
    print("saved")


main()
