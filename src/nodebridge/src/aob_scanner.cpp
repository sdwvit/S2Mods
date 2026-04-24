#include "aob_scanner.h"

#include <windows.h>

#include <cctype>
#include <string>

#include "logging.h"

namespace nb::aob {

namespace {

int hex_nibble(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return 10 + (c - 'a');
  if (c >= 'A' && c <= 'F') return 10 + (c - 'A');
  return -1;
}

}  // namespace

Pattern parse(std::string_view hex) {
  Pattern p;
  size_t i = 0;
  while (i < hex.size()) {
    char c = hex[i];
    if (c == ' ' || c == '\t' || c == '\n' || c == '\r') { ++i; continue; }
    if (c == '?') {
      // Accept "?" or "??" as one wildcard byte.
      p.bytes.push_back(0);
      p.mask.push_back(false);
      ++i;
      if (i < hex.size() && hex[i] == '?') ++i;
      continue;
    }
    if (i + 1 >= hex.size()) return {};
    int hi = hex_nibble(c);
    int lo = hex_nibble(hex[i + 1]);
    if (hi < 0 || lo < 0) return {};
    p.bytes.push_back(static_cast<uint8_t>((hi << 4) | lo));
    p.mask.push_back(true);
    i += 2;
  }
  return p;
}

const uint8_t* scan_range(const uint8_t* begin, const uint8_t* end, const Pattern& p) {
  if (!p.valid() || begin >= end) return nullptr;
  const size_t n = p.bytes.size();
  if (static_cast<size_t>(end - begin) < n) return nullptr;
  const uint8_t first = p.bytes[0];
  const bool first_wild = !p.mask[0];
  const uint8_t* last_start = end - n;
  for (const uint8_t* cur = begin; cur <= last_start; ++cur) {
    if (!first_wild && *cur != first) continue;
    bool match = true;
    for (size_t i = 1; i < n; ++i) {
      if (p.mask[i] && cur[i] != p.bytes[i]) { match = false; break; }
    }
    if (match) return cur;
  }
  return nullptr;
}

const uint8_t* scan_main_exe(const Pattern& p) {
  if (!p.valid()) return nullptr;
  HMODULE main_module = GetModuleHandleW(nullptr);
  if (!main_module) return nullptr;

  auto base = reinterpret_cast<const uint8_t*>(main_module);
  const auto* dos = reinterpret_cast<const IMAGE_DOS_HEADER*>(base);
  if (dos->e_magic != IMAGE_DOS_SIGNATURE) return nullptr;
  const auto* nt = reinterpret_cast<const IMAGE_NT_HEADERS*>(base + dos->e_lfanew);
  if (nt->Signature != IMAGE_NT_SIGNATURE) return nullptr;

  const size_t image_size = nt->OptionalHeader.SizeOfImage;
  const uint8_t* const module_end = base + image_size;

  // Iterate sections; scan ones that are executable and readable.
  const auto* section = IMAGE_FIRST_SECTION(nt);
  for (WORD i = 0; i < nt->FileHeader.NumberOfSections; ++i) {
    const DWORD flags = section[i].Characteristics;
    if (!(flags & IMAGE_SCN_MEM_EXECUTE)) continue;

    const uint8_t* sec_begin = base + section[i].VirtualAddress;
    const uint8_t* sec_end = sec_begin + section[i].Misc.VirtualSize;
    if (sec_end > module_end) sec_end = module_end;

    // VirtualQuery-guarded: some sections have unreadable tail pages
    // (e.g. read-executable with large alignment padding). Walk page-by-page.
    const uint8_t* cur = sec_begin;
    while (cur < sec_end) {
      MEMORY_BASIC_INFORMATION mbi{};
      if (!VirtualQuery(cur, &mbi, sizeof(mbi))) break;
      const uint8_t* region_end = static_cast<const uint8_t*>(mbi.BaseAddress) + mbi.RegionSize;
      if (region_end > sec_end) region_end = sec_end;
      constexpr DWORD readable_mask = PAGE_EXECUTE | PAGE_EXECUTE_READ |
                                      PAGE_EXECUTE_READWRITE | PAGE_EXECUTE_WRITECOPY;
      if (mbi.State == MEM_COMMIT && (mbi.Protect & readable_mask)) {
        if (const uint8_t* hit = scan_range(cur, region_end, p)) {
          return hit;
        }
      }
      cur = region_end;
    }
  }
  return nullptr;
}

}  // namespace nb::aob
