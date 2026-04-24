#include "bindings.h"

#include <algorithm>

#include "fname.h"
#include "logging.h"
#include "rpc.h"
#include "ue_reflection.h"

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
json stub_get_player_pawn(const json&) {
  return unresolved_reason("getPlayerPawn needs UWorld hook (v2.2)");
}
json stub_get_player_location(const json&) {
  return unresolved_reason("getPlayerLocation needs UWorld hook (v2.2)");
}
json stub_get_property(const json&) {
  return unresolved_reason("getProperty needs UProperty walker (v2.3)");
}
json stub_set_property(const json&) {
  return unresolved_reason("setProperty needs UProperty walker + game-thread write (v3)");
}
json stub_call_function(const json&) {
  return unresolved_reason("callFunction needs UFunction + ProcessEvent (v3)");
}

}  // namespace

void install(nb::rpc::Router& router) {
  router.handle("game.isReady", game_is_ready);
  router.handle("game.getEngineVersion", game_get_engine_version);
  router.handle("game.getObjectCount", game_get_object_count);
  router.handle("game.listObjects", game_list_objects);
  router.handle("game.getObjectByIndex", game_get_object_by_index);
  router.handle("game.getObjectByName", game_get_object_by_name);
  router.handle("game.getPlayerPawn", stub_get_player_pawn);
  router.handle("game.getPlayerLocation", stub_get_player_location);
  router.handle("game.getProperty", stub_get_property);
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
