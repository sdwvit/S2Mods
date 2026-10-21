# Run in the Zone Kit editor's Output Log (Python mode):
#   exec(open(r"Z:\home\sdwvit\IdeaProjects\S2Mods\Mods\WolfArmorFetch\voice\probe_drd.py").read())
# Read-only: how does the game find a dialog chain's DialogRuntimeData (<ChainSID>_Voiceover)? Dumps the
# dialog asset reference subsystem, the label asset types, and what references vanilla runtime data, to
# S:\vm\voice-clone\probe\drd.txt. Loads assets but saves nothing.
import os
import unreal

OUT = r"S:\vm\voice-clone\probe"
lines = []
log = lines.append


def short(v, n=400):
    s = repr(v)
    return s if len(s) <= n else s[:n] + f"... ({len(s)} chars)"


def dump_class(label, cls):
    log(f"\n## class {label}: {'MISSING' if cls is None else cls}")
    if cls is None:
        return
    for n in sorted(dir(cls)):
        if n.startswith("_"):
            continue
        try:
            doc = (getattr(cls, n).__doc__ or "").strip().splitlines()
        except Exception:
            doc = []
        log(f"  {n}: {doc[0] if doc else ''}")


def dump_props(label, obj):
    log(f"\n## properties of {label}: {obj}")
    if obj is None:
        return
    for n in sorted(dir(obj)):
        if n.startswith("_"):
            continue
        try:
            log(f"  {n} = {short(obj.get_editor_property(n))}")
        except Exception:
            pass


def guard(label, fn):
    try:
        fn()
    except Exception as e:
        log(f"\n## {label} FAILED: {e!r}")


# 1. reflection: every Dialog*/Label class Python can see, and the ones that matter in full
log("## unreal names containing Dialog / Label / RuntimeData")
lines.extend("  " + n for n in sorted(dir(unreal)) if any(k in n for k in ("Dialog", "Label", "RuntimeData")))
for name in ["DialogAssetReferenceSubsystem", "DialogRuntimeData", "RuntimeAssetLabel", "QuestAssetLabel",
             "NameToAssetAssetContainer", "NameToAsset_AssetContainer", "DialogFunctionLibrary"]:
    dump_class(name, getattr(unreal, name, None))

# 2. the blueprint subsystem the ini binds (/QuestTool/BP_DialogAssetReferenceSubsystem): its class defaults
def bp_defaults():
    cls = unreal.load_class(None, "/QuestTool/BP_DialogAssetReferenceSubsystem.BP_DialogAssetReferenceSubsystem_C")
    log(f"\n## BP_DialogAssetReferenceSubsystem_C: {cls}")
    dump_props("BP_DialogAssetReferenceSubsystem CDO", unreal.get_default_object(cls))
guard("BP subsystem defaults", bp_defaults)

# 3. the live subsystem instance in this editor session
def live_subsystem():
    cls = getattr(unreal, "DialogAssetReferenceSubsystem", None)
    if cls is None:
        log("\n## live subsystem: class not exposed to Python")
        return
    sub = unreal.get_engine_subsystem(cls)
    dump_props("live DialogAssetReferenceSubsystem", sub)
guard("live subsystem", live_subsystem)

reg = unreal.AssetRegistryHelpers.get_asset_registry()

# 4. every asset of the label classes and of DialogRuntimeData, with mod-path hits called out
def assets_of(package, name):
    return reg.get_assets_by_class(unreal.TopLevelAssetPath(package, name), True)

def labels():
    for cls in ["DialogRuntimeData", "RuntimeAssetLabel", "QuestAssetLabel"]:
        found = assets_of("/Script/Stalker2", cls)
        log(f"\n## assets of class {cls}: {len(found)}")
        for a in found[:40]:
            log(f"  {a.package_name}")
        mods = [str(a.package_name) for a in found if not str(a.package_name).startswith("/Game/")]
        log(f"  outside /Game: {len(mods)}")
        lines.extend("    " + m for m in mods[:40])
        if cls != "DialogRuntimeData":
            for a in found[:3]:  # what a label holds
                dump_props(str(a.package_name), a.get_asset())
guard("label assets", labels)

# 5. who references vanilla runtime data: whatever registers it should show up here
opts = unreal.AssetRegistryDependencyOptions(
    include_soft_package_references=True, include_hard_package_references=True, include_searchable_names=False,
    include_soft_management_references=True, include_hard_management_references=True)
for pkg in ["/Game/_Stalker_2/maps/_Stalker2_WorldMap/QuestObjects/Dialogs/General/Rihter/E02_MQ01_rihter_0_HelloTopic_Voiceover",
            "/Game/_Stalker_2/maps/_Stalker2_WorldMap/QuestObjects/DefaultRuntimeData/E02_MQ01_rihter_0_CallPlayer_Voiceover",
            "/Game/_Stalker_2/maps/_Stalker2_WorldMap/QuestObjects/Dialogs/Hubs/RookieVillage/Guide/RookieVillage_Hub_volk_1_InfoTopic_1_Voiceover",
            "/WolfArmorFetch/Dialogs/WolfArmorFetch_Cover_Accept_Voiceover"]:
    def refs(pkg=pkg):
        log(f"\n## referencers of {pkg}")
        lines.extend("  " + str(r) for r in (reg.get_referencers(pkg, opts) or []))
        log(f"## dependencies of {pkg}")
        lines.extend("  " + str(d) for d in (reg.get_dependencies(pkg, opts) or []))
    guard(f"refs {pkg}", refs)

# 6. primary asset ids the asset manager knows for the label types
def primary():
    am = unreal.AssetManager.get() if hasattr(unreal.AssetManager, "get") else None
    log(f"\n## asset manager: {am}")
    for t in ["RuntimeAssetLabel", "QuestAssetLabel"]:
        ids = unreal.AssetManagerHelpers.get_primary_asset_id_list(unreal.PrimaryAssetType(t)) if hasattr(unreal, "AssetManagerHelpers") else []
        log(f"  {t}: {len(ids)} ids")
        lines.extend("    " + str(i) for i in ids[:40])
guard("primary assets", primary)

os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "drd.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
unreal.log(f"probe_drd: wrote {len(lines)} lines to {OUT}\\drd.txt")
