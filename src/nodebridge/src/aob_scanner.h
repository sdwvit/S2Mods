#pragma once
#include <cstdint>
#include <string_view>
#include <vector>

#include <windows.h>

namespace nb::aob {

struct Pattern {
  std::vector<uint8_t> bytes;
  std::vector<bool> mask;  // true = must match, false = wildcard (?)
  bool valid() const { return !bytes.empty() && bytes.size() == mask.size(); }
};

// Parse an IDA-style pattern. Accepts spaces and "?" wildcards; each token is
// a two-hex-digit byte or a single "?". Case-insensitive. Returns an empty
// pattern on parse error.
//   "48 8D 0D ? ? ? ? E8"  →  {48 8D 0D 00 00 00 00 E8} with mask
Pattern parse(std::string_view hex);

// Scan a [begin, end) byte range for the pattern.
// Returns the address of the first match, or nullptr.
const uint8_t* scan_range(const uint8_t* begin, const uint8_t* end, const Pattern& p);

// Scan the main executable's .text section (or executable regions of the
// main module). Safe: uses VirtualQuery to skip unreadable/unmapped pages.
const uint8_t* scan_main_exe(const Pattern& p);

}  // namespace nb::aob
