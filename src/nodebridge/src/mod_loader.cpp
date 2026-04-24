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

  // Match the extensions bootstrap.mjs probes. First hit wins; this function
  // only needs to decide "has an entry point" for the discovery log line —
  // bootstrap.mjs picks the actual file.
  static constexpr std::string_view kEntryNames[] = {
      "main.ts", "main.mts", "main.cts", "main.mjs", "main.cjs", "main.js"};
  for (const auto& entry : fs::directory_iterator(root, ec)) {
    if (!entry.is_directory()) continue;
    bool has_entry = false;
    for (auto name : kEntryNames) {
      if (fs::exists(entry.path() / std::string(name))) { has_entry = true; break; }
    }
    if (!has_entry) continue;
    result.push_back(entry.path().filename().string());
  }
  nb::log::info("mods", "discovered {} mod(s)", result.size());
  return result;
}

}  // namespace nb::mods
