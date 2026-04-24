#include "mod_loader.h"

#include <filesystem>
#include <fstream>

#include <nlohmann/json.hpp>

#include "logging.h"
#include "paths.h"

namespace fs = std::filesystem;
using json = nlohmann::json;

namespace nb::mods {

std::vector<std::string> enumerate() {
  std::vector<std::string> result;
  auto root = nb::paths::mods_dir();
  std::error_code ec;
  if (!fs::exists(root, ec)) return result;

  std::unordered_map<std::string, bool> override_map;
  auto enabled_file = root / "enabled.json";
  if (fs::exists(enabled_file, ec)) {
    try {
      std::ifstream in(enabled_file);
      json doc;
      in >> doc;
      if (doc.is_array()) {
        for (const auto& n : doc) override_map[n.get<std::string>()] = true;
      } else if (doc.is_object()) {
        for (const auto& [k, v] : doc.items()) override_map[k] = v.get<bool>();
      }
    } catch (const std::exception& e) {
      nb::log::warn("mods", "bad enabled.json: {}", e.what());
    }
  }

  for (const auto& entry : fs::directory_iterator(root, ec)) {
    if (!entry.is_directory()) continue;
    auto name = entry.path().filename().string();
    auto main = entry.path() / "main.mjs";
    if (!fs::exists(main)) continue;
    auto it = override_map.find(name);
    if (it != override_map.end() && !it->second) continue;
    result.push_back(name);
  }
  nb::log::info("mods", "discovered {} mod(s)", result.size());
  return result;
}

void write_enabled_json(const std::vector<std::string>& enabled) {
  auto root = nb::paths::mods_dir();
  std::error_code ec;
  fs::create_directories(root, ec);
  std::ofstream out(root / "enabled.json");
  out << json(enabled).dump(2);
}

}  // namespace nb::mods
