#include "bindings.h"

#include <windows.h>

#include <algorithm>
#include <cstdio>

#include "aob_scanner.h"
#include "fname.h"
#include "logging.h"
#include "rpc.h"
#include "ue_reflection.h"
#include "uproperty.h"

namespace {
extern "C" int nb_try_dump(const void* src, void* dst, size_t n) {
  __try {
    for (size_t i = 0; i < n; ++i)
      reinterpret_cast<uint8_t*>(dst)[i] = reinterpret_cast<const uint8_t*>(src)[i];
    return 1;
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    return 0;
  }
}
}  // namespace

namespace nb::bindings {

using json = nlohmann::json;

namespace {

nb::log::Level level_from(std::string_view s) {
  if (s == "debug") return nb::log::Level::Debug;
  if (s == "warn") return nb::log::Level::Warn;
  if (s == "error") return nb::log::Level::Error;
  return nb::log::Level::Info;
}

json unresolved_reason(const char* why) {
  return {{"unresolved", true}, {"reason", why}};
}

json game_is_ready(const json&) {
  return {{"ready", nb::ue::is_ready()}};
}

json game_get_engine_version(const json&) {
  // Stalker 2 is UE 5.1 per the community UE4SS EngineVersionOverride.
  // No need to read this from the running engine — it's a build-time constant.
  return {{"major", 5}, {"minor", 1}, {"patch", 0}, {"custom", "GSC-S2"}};
}

json game_get_object_count(const json&) {
  if (!nb::ue::is_ready()) return unresolved_reason("reflection not initialized");
  int32_t n = nb::ue::num_objects();
  return {{"count", n}};
}

// Build the JSON rep for a single object slot.
json describe_item(int32_t idx, const nb::ue::FUObjectItem* item) {
  if (!item || !item->object) return nullptr;
  json out = {
      {"index", idx},
      {"flags", item->flags},
      {"name", nb::ue::get_object_name(item->object)},
      {"className", nb::ue::get_object_class_name(item->object)},
      {"fullPath", nb::ue::get_object_full_path(item->object)},
  };
  return out;
}

json game_list_objects(const json& params) {
  if (!nb::ue::is_ready()) return unresolved_reason("reflection not populated yet");
  int32_t total = nb::ue::num_objects();
  int32_t offset = std::max(0, params.value("offset", 0));
  int32_t limit = std::min(params.value("limit", 128), 4096);
  std::string filter = params.value("filter", std::string{});
  std::string class_filter = params.value("className", std::string{});

  json arr = json::array();
  int32_t emitted = 0;
  for (int32_t i = offset; i < total && emitted < limit; ++i) {
    const auto* item = nb::ue::get_item(i);
    if (!item || !item->object) continue;

    // Filtering — only apply if filter fields are non-empty, so the
    // unfiltered path stays fast (one FName lookup per match candidate).
    if (!filter.empty() || !class_filter.empty()) {
      std::string name = nb::ue::get_object_name(item->object);
      std::string cls = nb::ue::get_object_class_name(item->object);
      if (!filter.empty() && name.find(filter) == std::string::npos &&
          cls.find(filter) == std::string::npos) continue;
      if (!class_filter.empty() && cls != class_filter) continue;
    }

    arr.push_back(describe_item(i, item));
    ++emitted;
  }
  return {{"total", total}, {"returned", emitted}, {"offset", offset}, {"items", arr}};
}

json game_get_object_by_index(const json& params) {
  if (!nb::ue::is_ready()) return unresolved_reason("reflection not populated yet");
  int32_t idx = params.value("index", -1);
  const auto* item = nb::ue::get_item(idx);
  if (!item || !item->object) return {{"found", false}, {"index", idx}};
  return describe_item(idx, item);
}

json game_get_object_by_name(const json& params) {
  if (!nb::ue::is_ready()) return unresolved_reason("reflection not populated yet");
  std::string target = params.value("name", std::string{});
  if (target.empty()) return {{"found", false}, {"name", ""}};
  int32_t total = nb::ue::num_objects();
  for (int32_t i = 0; i < total; ++i) {
    const auto* item = nb::ue::get_item(i);
    if (!item || !item->object) continue;
    std::string name = nb::ue::get_object_name(item->object);
    if (name == target) return describe_item(i, item);
    // Case-insensitive substring fallback — handy for "find anything
    // named PlayerController*" from JS.
    std::string path = nb::ue::get_object_full_path(item->object);
    if (path == target) return describe_item(i, item);
  }
  return {{"found", false}, {"name", target}};
}
json stub_call_function(const json&) {
  return unresolved_reason("callFunction needs UFunction + ProcessEvent (v3)");
}

// Hex parsing reused by processEvent; tolerates whitespace and packed forms.
static std::vector<uint8_t> parse_hex_payload(std::string_view hex) {
  std::vector<uint8_t> buf;
  buf.reserve(hex.size() / 2);
  uint8_t cur = 0;
  bool half = false;
  for (char c : hex) {
    int v = -1;
    if (c >= '0' && c <= '9') v = c - '0';
    else if (c >= 'a' && c <= 'f') v = c - 'a' + 10;
    else if (c >= 'A' && c <= 'F') v = c - 'A' + 10;
    else continue;
    cur = (cur << 4) | static_cast<uint8_t>(v);
    if (half) { buf.push_back(cur); cur = 0; }
    half = !half;
  }
  return buf;
}

// Invoke UObject::ProcessEvent via the target's vtable. The actual
// vtable slot for ProcessEvent is build-specific (UE 5.1 stock is
// usually 67, but we expose it as a parameter so JS can sweep if 67
// crashes on a particular build).
//
// Caller passes:
//   target     UObject*   (instance address — listObjects gives us this via dumpObjectMemory)
//   func       UFunction* (UObject address from listObjects, walked from the class.Children chain in JS)
//   paramsHex  hex bytes  (the params struct: caller knows the layout
//                          from the UFunction's properties)
//   vtableIdx  optional   (default 67)
//
// We allocate a stack/heap buffer for params, decode hex into it,
// call ProcessEvent, then re-encode the buffer back as hex so the
// caller sees any output params (return value, out-by-ref, etc).
// SEH wrappers — MSVC forbids __try in functions that contain
// C++ objects with destructors, so the actual fault-protected
// loads/calls live in tiny no-RAII helpers.
extern "C" int nb_try_load_vtable_slot(uint64_t target, int32_t idx, uint64_t* out_fn) {
  __try {
    uintptr_t** vtable = *reinterpret_cast<uintptr_t***>(target);
    if (!vtable) return 0;
    *out_fn = reinterpret_cast<uint64_t>(vtable[idx]);
    return 1;
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    return 0;
  }
}
extern "C" int nb_try_invoke_pe(uint64_t fn, uint64_t target, uint64_t func, void* params, unsigned long* out_excode) {
  using ProcessEventFn = void(*)(void*, void*, void*);
  __try {
    auto pe = reinterpret_cast<ProcessEventFn>(fn);
    pe(reinterpret_cast<void*>(target), reinterpret_cast<void*>(func), params);
    return 1;
  } __except (*out_excode = GetExceptionCode(), EXCEPTION_EXECUTE_HANDLER) {
    return 0;
  }
}

json game_process_event(const json& params) {
  uint64_t target = params.value("target", 0ULL);
  uint64_t func = params.value("func", 0ULL);
  std::string hex = params.value("paramsHex", std::string{});
  // If `fnAddr` is set, JS resolved ProcessEvent's absolute address
  // itself (e.g. via scanAOB) and skips the vtable lookup. Otherwise
  // we use vtableIdx (default 67 — UE 5.1 typical, but build-specific).
  uint64_t fnAddrParam = params.value("fnAddr", 0ULL);
  int32_t vtableIdx = params.value("vtableIdx", 67);
  if (!target || !func) return {{"ok", false}, {"reason", "missing target or func"}};

  std::vector<uint8_t> buf = parse_hex_payload(hex);
  uint64_t fnAddr = 0;
  if (fnAddrParam) {
    fnAddr = fnAddrParam;
  } else {
    if (vtableIdx < 0 || vtableIdx > 256) return {{"ok", false}, {"reason", "vtableIdx out of range"}};
    if (!nb_try_load_vtable_slot(target, vtableIdx, &fnAddr)) {
      return {{"ok", false}, {"reason", "vtable read faulted"}};
    }
    if (!fnAddr) return {{"ok", false}, {"reason", "vtable[idx] is null"}};
  }

  unsigned long excode = 0;
  if (!nb_try_invoke_pe(fnAddr, target, func, buf.empty() ? nullptr : buf.data(), &excode)) {
    char rsn[160];
    snprintf(rsn, sizeof(rsn),
             "ProcessEvent faulted (exc=0x%08lx, fnAddr=0x%llx) — wrong vtableIdx/fnAddr or params layout",
             excode, static_cast<unsigned long long>(fnAddr));
    return {{"ok", false}, {"reason", std::string(rsn)}};
  }

  // Re-encode params buffer (output args / return value live there).
  std::string out;
  out.reserve(buf.size() * 2);
  char b[4];
  for (uint8_t byte : buf) {
    snprintf(b, sizeof(b), "%02x", byte);
    out += b;
  }
  return {{"ok", true}, {"paramsHex", out}, {"fnAddr", fnAddr}};
}

// Look up the player pawn by class-name substring. Cached after first hit
// so we don't re-scan GUObjectArray every call; the cached handle is
// invalidated whenever its index slot changes (object destroyed + reused).
struct PlayerPawnCache {
  std::atomic<int32_t> index{-1};
};
PlayerPawnCache g_player_cache;

nb::ue::UObjectBase* resolve_player_pawn_fresh() {
  auto* obj = nb::ue::find_player_pawn();
  if (!obj) return nullptr;
  g_player_cache.index.store(obj->internal_index);
  return obj;
}

nb::ue::UObjectBase* resolve_player_pawn_cached() {
  int32_t cached = g_player_cache.index.load();
  if (cached >= 0) {
    const auto* item = nb::ue::get_item(cached);
    if (item && item->object) return const_cast<nb::ue::UObjectBase*>(item->object);
  }
  return resolve_player_pawn_fresh();
}

json describe_obj_short(nb::ue::UObjectBase* obj) {
  if (!obj) return {{"found", false}};
  return {
      {"found", true},
      {"index", obj->internal_index},
      {"name", nb::ue::get_object_name(obj)},
      {"className", nb::ue::get_object_class_name(obj)},
      {"fullPath", nb::ue::get_object_full_path(obj)},
  };
}

json game_get_player_pawn(const json&) {
  if (!nb::ue::is_ready()) return unresolved_reason("reflection not populated yet");
  if (!nb::ue::fname_resolver_ready()) return unresolved_reason("FName::ToString not resolved");
  auto* pawn = resolve_player_pawn_fresh();  // force fresh on explicit call
  if (!pawn) return {{"found", false}, {"reason", "no matching class-name substring"}};
  return describe_obj_short(pawn);
}

// Resolves pawn → RootComponent(USceneComponent*) → RelativeLocation(FVector3d).
// Logs each step with the resolved offset so we can spot schema drift
// immediately when the user posts the first in-game log.
struct LocationResult {
  bool ok;
  nb::ue::FVector3d v;
  std::string reason;
  int32_t root_offset{-1};
  int32_t loc_offset{-1};
};

LocationResult read_pawn_location(nb::ue::UObjectBase* pawn) {
  LocationResult r{};
  if (!pawn) { r.reason = "no pawn"; return r; }
  auto root_off = nb::ue::find_property_offset(pawn, "RootComponent");
  if (!root_off) { r.reason = "no RootComponent property on pawn class"; return r; }
  r.root_offset = *root_off;
  auto* root = static_cast<nb::ue::UObjectBase*>(nb::ue::read_ptr(pawn, *root_off));
  if (!root) { r.reason = "RootComponent pointer is null"; return r; }
  auto loc_off = nb::ue::find_property_offset(root, "RelativeLocation");
  if (!loc_off) { r.reason = "no RelativeLocation on RootComponent class"; return r; }
  r.loc_offset = *loc_off;
  r.v = nb::ue::read_vector3d(root, *loc_off);
  r.ok = true;
  return r;
}

bool write_pawn_location(nb::ue::UObjectBase* pawn, nb::ue::FVector3d v, LocationResult* dbg) {
  if (!pawn) return false;
  auto root_off = nb::ue::find_property_offset(pawn, "RootComponent");
  if (!root_off) return false;
  auto* root = static_cast<nb::ue::UObjectBase*>(nb::ue::read_ptr(pawn, *root_off));
  if (!root) return false;
  auto loc_off = nb::ue::find_property_offset(root, "RelativeLocation");
  if (!loc_off) return false;
  nb::ue::write_vector3d(root, *loc_off, v);
  if (dbg) { dbg->ok = true; dbg->v = v; dbg->root_offset = *root_off; dbg->loc_offset = *loc_off; }
  return true;
}

json game_get_player_location(const json&) {
  if (!nb::ue::is_ready()) return unresolved_reason("reflection not populated yet");
  if (!nb::ue::fname_resolver_ready()) return unresolved_reason("FName::ToString not resolved");
  auto* pawn = resolve_player_pawn_cached();
  auto r = read_pawn_location(pawn);
  if (!r.ok) {
    return {{"unresolved", true}, {"reason", r.reason},
            {"rootOffset", r.root_offset}, {"locOffset", r.loc_offset}};
  }
  return {{"x", r.v.x}, {"y", r.v.y}, {"z", r.v.z},
          {"rootOffset", r.root_offset}, {"locOffset", r.loc_offset}};
}

// Writes the FVector3d straight into the component's RelativeLocation. Does
// NOT call USceneComponent::SetRelativeLocation (which would update
// physics/rendering dirty flags). Result: instant visual teleport in most
// UE games, but some cases may snap back a tick later when physics syncs.
// For a proper SetActorLocation call path we'd need UObject::ProcessEvent
// or the vtable offset for the function — deferred.
json game_set_player_location(const json& params) {
  if (!nb::ue::is_ready()) return unresolved_reason("reflection not populated yet");
  if (!nb::ue::fname_resolver_ready()) return unresolved_reason("FName::ToString not resolved");
  if (!params.contains("value")) return {{"ok", false}, {"reason", "missing value:{x,y,z}"}};
  const auto& v = params["value"];
  nb::ue::FVector3d target{
      v.value("x", 0.0), v.value("y", 0.0), v.value("z", 0.0),
  };
  auto* pawn = resolve_player_pawn_cached();
  LocationResult dbg{};
  bool ok = write_pawn_location(pawn, target, &dbg);
  return {{"ok", ok}, {"reason", dbg.reason}, {"x", target.x}, {"y", target.y}, {"z", target.z},
          {"rootOffset", dbg.root_offset}, {"locOffset", dbg.loc_offset}};
}

// Generic property read. Target is either an index (int) or a class-name
// substring to resolve first. Handles pointer, FName, FVector3d, int/uint,
// double/float by type-name; unknown types return the raw byte offset so
// JS can read in a followup call.
// Diagnostic: dump every property name/offset on an object's class hierarchy.
// Use when find_property_offset can't locate something we expect — tells us
// what the actual property names are on this class.
json game_list_properties(const json& params) {
  if (!nb::ue::is_ready()) return unresolved_reason("reflection not populated yet");
  if (!nb::ue::fname_resolver_ready()) return unresolved_reason("FName::ToString not resolved");
  int32_t target = params.value("target", -1);
  int32_t max = params.value("max", 256);
  const auto* item = nb::ue::get_item(target);
  if (!item || !item->object) return {{"found", false}, {"target", target}};
  auto entries = nb::ue::list_properties(item->object, max);
  json arr = json::array();
  for (const auto& e : entries) {
    arr.push_back({{"name", e.name}, {"offset", e.offset}, {"class", e.class_name}});
  }
  return {{"target", target}, {"count", entries.size()}, {"properties", arr}};
}

// Dump raw bytes at obj->class_ptr + offset. Lets us inspect UStruct
// field layout when the property walker fails.
json game_dump_class_memory(const json& params) {
  if (!nb::ue::is_ready()) return unresolved_reason("not ready");
  int32_t target = params.value("target", -1);
  int32_t offset = params.value("offset", 0);
  int32_t count = std::min(params.value("count", 64), 256);
  const auto* item = nb::ue::get_item(target);
  if (!item || !item->object) return {{"found", false}};
  const void* class_ptr = item->object->class_ptr;
  if (!class_ptr) return {{"found", false}, {"reason", "no class_ptr"}};
  std::vector<uint8_t> buf(count);
  if (!nb_try_dump(static_cast<const uint8_t*>(class_ptr) + offset, buf.data(), count)) {
    return {{"target", target}, {"offset", offset}, {"fault", true}};
  }
  std::string hex;
  hex.reserve(count * 3);
  char b[4];
  for (int i = 0; i < count; ++i) {
    snprintf(b, sizeof(b), "%02x ", buf[i]);
    hex += b;
  }
  return {{"target", target}, {"offset", offset}, {"count", count},
          {"classPtr", reinterpret_cast<uint64_t>(class_ptr)}, {"hex", hex}};
}

// Generic primitives for JS-side debugging without DLL rebuilds.
// Address arguments come over JSON as numbers; JS's number can hold up
// to 2^53 cleanly — game addresses sit at 0x140000000–0x200000000 range,
// well within safe int. nlohmann/json round-trips them.

json game_read_memory(const json& params) {
  if (!nb::ue::is_ready()) return unresolved_reason("not ready");
  uint64_t addr = params.value("addr", 0ULL);
  int32_t count = std::min(params.value("count", 64), 4096);
  if (!addr || count <= 0) return {{"error", "bad params"}};
  std::vector<uint8_t> buf(count);
  if (!nb_try_dump(reinterpret_cast<const void*>(addr), buf.data(), count)) {
    return {{"addr", addr}, {"fault", true}};
  }
  std::string hex;
  hex.reserve(count * 3);
  char b[4];
  for (int i = 0; i < count; ++i) {
    snprintf(b, sizeof(b), "%02x ", buf[i]);
    hex += b;
  }
  return {{"addr", addr}, {"count", count}, {"hex", hex}};
}

// Write raw bytes to any address. Symmetric with readMemory; lets the
// JS-side walker drive teleports / property writes without a per-shape
// C++ helper. Hex string accepts both whitespace-separated bytes
// ("80 22 cd 50") and tightly packed ("8022cd50").
json game_write_memory(const json& params) {
  if (!nb::ue::is_ready()) return unresolved_reason("not ready");
  uint64_t addr = params.value("addr", 0ULL);
  std::string hex = params.value("hex", std::string{});
  if (!addr || hex.empty()) return {{"error", "bad params"}};
  std::vector<uint8_t> buf;
  buf.reserve(hex.size() / 2);
  uint8_t cur = 0;
  bool half = false;
  for (char c : hex) {
    int v = -1;
    if (c >= '0' && c <= '9') v = c - '0';
    else if (c >= 'a' && c <= 'f') v = c - 'a' + 10;
    else if (c >= 'A' && c <= 'F') v = c - 'A' + 10;
    else continue;  // skip whitespace, separators
    cur = (cur << 4) | static_cast<uint8_t>(v);
    if (half) { buf.push_back(cur); cur = 0; }
    half = !half;
  }
  if (half || buf.empty()) return {{"error", "odd nibbles in hex"}};
  if (buf.size() > 4096) return {{"error", "payload too large"}};
  if (!nb_try_dump(buf.data(), reinterpret_cast<void*>(addr), buf.size())) {
    return {{"addr", addr}, {"fault", true}};
  }
  return {{"addr", addr}, {"count", buf.size()}};
}

json game_scan_aob(const json& params) {
  std::string pattern_str = params.value("pattern", "");
  auto pat = nb::aob::parse(pattern_str);
  if (!pat.valid()) return {{"error", "invalid pattern"}};
  const uint8_t* hit = nb::aob::scan_main_exe(pat);
  return {{"pattern", pattern_str}, {"hit", hit ? reinterpret_cast<uint64_t>(hit) : 0}};
}

json game_main_exe_base(const json&) {
  HMODULE main_module = GetModuleHandleW(nullptr);
  return {{"base", reinterpret_cast<uint64_t>(main_module)}};
}

// Decode an FName by (comparison_index, number) → UTF-8 string.
// The single primitive that lets JS walk arbitrary FProperty/FField
// chains without needing a C++ helper for each new struct shape.
json game_fname_to_string(const json& params) {
  if (!nb::ue::fname_resolver_ready()) return unresolved_reason("FName::ToString not resolved");
  uint32_t comp = params.value("comp", 0u);
  uint32_t num = params.value("num", 0u);
  nb::ue::FName fn{comp, num};
  return {{"comp", comp}, {"num", num}, {"name", nb::ue::fname_to_string(fn)}};
}

// Read raw bytes from obj + offset (instance memory, not class memory).
json game_dump_object_memory(const json& params) {
  if (!nb::ue::is_ready()) return unresolved_reason("not ready");
  int32_t target = params.value("target", -1);
  int32_t offset = params.value("offset", 0);
  int32_t count = std::min(params.value("count", 64), 1024);
  const auto* item = nb::ue::get_item(target);
  if (!item || !item->object) return {{"found", false}};
  std::vector<uint8_t> buf(count);
  if (!nb_try_dump(reinterpret_cast<const uint8_t*>(item->object) + offset, buf.data(), count)) {
    return {{"target", target}, {"offset", offset}, {"fault", true}};
  }
  std::string hex;
  hex.reserve(count * 3);
  char b[4];
  for (int i = 0; i < count; ++i) {
    snprintf(b, sizeof(b), "%02x ", buf[i]);
    hex += b;
  }
  return {{"target", target}, {"offset", offset}, {"count", count},
          {"objPtr", reinterpret_cast<uint64_t>(item->object)}, {"hex", hex}};
}

json game_get_property(const json& params) {
  if (!nb::ue::is_ready()) return unresolved_reason("reflection not populated yet");
  if (!nb::ue::fname_resolver_ready()) return unresolved_reason("FName::ToString not resolved");
  std::string prop = params.value("prop", std::string{});
  if (prop.empty()) return {{"ok", false}, {"reason", "missing prop"}};

  nb::ue::UObjectBase* obj = nullptr;
  if (params["target"].is_number_integer()) {
    const auto* item = nb::ue::get_item(params["target"].get<int32_t>());
    if (item) obj = const_cast<nb::ue::UObjectBase*>(item->object);
  }
  if (!obj) return {{"ok", false}, {"reason", "target not found"}};
  auto off = nb::ue::find_property_offset(obj, prop);
  if (!off) return {{"ok", false}, {"reason", "property not found"}};
  return {{"ok", true}, {"offset", *off}};
}

json stub_set_property(const json&) {
  return unresolved_reason("setProperty is generic; use game.setPlayerLocation / callFunction");
}

}  // namespace

void install(nb::rpc::Router& router) {
  router.handle("game.isReady", game_is_ready);
  router.handle("game.getEngineVersion", game_get_engine_version);
  router.handle("game.getObjectCount", game_get_object_count);
  router.handle("game.listObjects", game_list_objects);
  router.handle("game.getObjectByIndex", game_get_object_by_index);
  router.handle("game.getObjectByName", game_get_object_by_name);
  router.handle("game.getPlayerPawn", game_get_player_pawn);
  router.handle("game.getPlayerLocation", game_get_player_location);
  router.handle("game.setPlayerLocation", game_set_player_location);
  router.handle("game.getProperty", game_get_property);
  router.handle("game.listProperties", game_list_properties);
  router.handle("game.dumpClassMemory", game_dump_class_memory);
  router.handle("game.dumpObjectMemory", game_dump_object_memory);
  router.handle("game.readMemory", game_read_memory);
  router.handle("game.writeMemory", game_write_memory);
  router.handle("game.scanAOB", game_scan_aob);
  router.handle("game.mainExeBase", game_main_exe_base);
  router.handle("game.fnameToString", game_fname_to_string);
  router.handle("game.processEvent", game_process_event);
  router.handle("game.setProperty", stub_set_property);
  router.handle("game.callFunction", stub_call_function);

  router.on("log", [](const json& p) {
    auto level = level_from(p.value("level", "info"));
    auto mod = p.value("mod", std::string("?"));
    auto msg = p.value("msg", std::string{});
    nb::log::write(level, mod, msg);
  });

  router.on("bootstrap.ready", [](const json& p) {
    nb::log::info("bindings", "bootstrap ready: node={} pid={} loaded={}",
                  p.value("node", ""), p.value("pid", 0),
                  p.value("loaded", json::array()).dump());
  });
}

}  // namespace nb::bindings
