#include "mod_loader.h"

#include <filesystem>

#include "logging.h"
#include "paths.h"

namespace fs = std::filesystem;

namespace nb::mods {

std::vector<std::string> enumerate() {
  std::vector<std::string> result;
  auto root = nb::paths::mods_dir();
  std::error_code ec;
  if (!fs::exists(root, ec)) return result;

  for (const auto& entry : fs::directory_iterator(root, ec)) {
    if (!entry.is_directory()) continue;
    auto main = entry.path() / "main.mjs";
    if (!fs::exists(main)) continue;
    result.push_back(entry.path().filename().string());
  }
  nb::log::info("mods", "discovered {} mod(s)", result.size());
  return result;
}

}  // namespace nb::mods
