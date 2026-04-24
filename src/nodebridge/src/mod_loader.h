#pragma once
#include <string>
#include <vector>

namespace nb::mods {

// Scans <dll_dir>/NodeBridge/mods/ and returns every directory that contains
// a main.mjs. Folder presence = enabled; no registry file.
std::vector<std::string> enumerate();

}  // namespace nb::mods
