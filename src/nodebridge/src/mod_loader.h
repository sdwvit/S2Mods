#pragma once
#include <string>
#include <vector>

namespace nb::mods {

// Scans <dll_dir>/NodeBridge/mods/ and returns the list of mod names that
// both (a) have a main.mjs and (b) are not excluded by mods/enabled.json.
// If enabled.json is absent, all mods with a main.mjs are enabled.
std::vector<std::string> enumerate();

// Writes mods/enabled.json so the bootstrap can read the same list.
// bootstrap.mjs also performs its own enumeration if enabled.json is missing;
// this call is belt-and-suspenders so the two sides agree.
void write_enabled_json(const std::vector<std::string>& enabled);

}  // namespace nb::mods
