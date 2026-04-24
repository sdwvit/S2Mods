#include "bindings.h"

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

// Stubs that need name resolution / per-UObject reads — wired once we add
// FName lookup (next session). Return explicit reason so JS authors see
// exactly why a call returned empty data.

json stub_list_objects(const json&) {
  return unresolved_reason("listObjects needs FName resolution (v2.1)");
}
json stub_get_object_by_index(const json&) {
  return unresolved_reason("getObjectByIndex needs FName resolution (v2.1)");
}
json stub_get_object_by_name(const json&) {
  return unresolved_reason("getObjectByName needs FName resolution (v2.1)");
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
  router.handle("game.listObjects", stub_list_objects);
  router.handle("game.getObjectByIndex", stub_get_object_by_index);
  router.handle("game.getObjectByName", stub_get_object_by_name);
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
