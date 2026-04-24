#include "bindings.h"

#include "logging.h"
#include "rpc.h"

namespace nb::bindings {

using json = nlohmann::json;

namespace {

nb::log::Level level_from(std::string_view s) {
  if (s == "debug") return nb::log::Level::Debug;
  if (s == "warn") return nb::log::Level::Warn;
  if (s == "error") return nb::log::Level::Error;
  return nb::log::Level::Info;
}

// MVP read-only game methods. All of these return placeholder data until the
// engine-init hook (see hook_init.cpp) resolves the real UE reflection
// pointers. The shape of the return value is the contract mod authors code
// against, so keep it stable.

json game_get_engine_version(const json&) {
  // TODO(nodebridge): populate from FEngineVersion once hook_init is wired.
  return {{"major", 5}, {"minor", 1}, {"unresolved", true}};
}

json game_get_player_location(const json&) {
  // TODO(nodebridge): read UWorld->PersistentLevel->PlayerController->Pawn->Location.
  return {{"x", 0.0}, {"y", 0.0}, {"z", 0.0}, {"unresolved", true}};
}

json game_get_object_by_name(const json& params) {
  // TODO(nodebridge): StaticFindObject / GObjects iteration.
  auto name = params.value("name", std::string{});
  return {{"name", name}, {"found", false}, {"unresolved", true}};
}

}  // namespace

void install(nb::rpc::Router& router) {
  router.handle("game.getEngineVersion", game_get_engine_version);
  router.handle("game.getPlayerLocation", game_get_player_location);
  router.handle("game.getObjectByName", game_get_object_by_name);

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
