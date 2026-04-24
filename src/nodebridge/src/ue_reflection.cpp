#include "ue_reflection.h"

#include <atomic>

#include "aob_scanner.h"
#include "logging.h"

namespace nb::ue {

namespace {

// Stalker 2 community AOB for GUObjectArray, sourced from the UE4SS build
// on the user's disk (see DesignDocs/NodeBridge.md):
//   48 8D 0D ? ? ? ?    lea rcx, [rip+disp32]
//   E8 ? ? ? ?          call ...
//   E8 ? ? ? ?          call ...
//   E8 ? ? ? ?          call ...
//   C6 05 ? ? ? ? 01    mov byte [rip+disp32], 1
// Resolution: lea loads a pointer, we take lea's RIP-relative disp32,
// compute NextInstr + disp - 0x10 to land on the FUObjectArray pointer.
constexpr std::string_view kGUObjectArrayPattern =
    "48 8D 0D ? ? ? ? E8 ? ? ? ? E8 ? ? ? ? E8 ? ? ? ? C6 05 ? ? ? ? 01";

std::atomic<const FUObjectArray*> g_array{nullptr};
std::atomic<bool> g_ready{false};

const FUObjectArray* resolve_guobject_array() {
  auto pattern = nb::aob::parse(kGUObjectArrayPattern);
  if (!pattern.valid()) {
    nb::log::error("ue", "kGUObjectArrayPattern failed to parse");
    return nullptr;
  }
  const uint8_t* hit = nb::aob::scan_main_exe(pattern);
  if (!hit) {
    nb::log::warn("ue", "GUObjectArray AOB not found in main exe");
    return nullptr;
  }
  nb::log::info("ue", "GUObjectArray AOB hit at {}", static_cast<const void*>(hit));

  // Post-processing from GUObjectArray.lua:
  //   LeaInstr = match; NextInstr = match + 7; Offset = match + 3
  //   result = NextInstr + DerefToInt32(Offset) - 0x10
  const uint8_t* lea = hit;
  const uint8_t* next_instr = lea + 7;
  const uint8_t* offset_addr = lea + 3;
  int32_t disp = *reinterpret_cast<const int32_t*>(offset_addr);
  const uint8_t* target = next_instr + disp - 0x10;
  nb::log::info("ue", "GUObjectArray resolved at {}", static_cast<const void*>(target));
  return reinterpret_cast<const FUObjectArray*>(target);
}

bool plausible(const FUObjectArray* arr) {
  if (!arr) return false;
  int32_t n = arr->obj_objects.num_elements;
  int32_t max = arr->obj_objects.max_elements;
  if (n < 0 || n > 10'000'000) return false;
  if (max < 0 || max > 20'000'000) return false;
  if (n > max) return false;
  if (!arr->obj_objects.objects) return false;
  return true;
}

// When the assumed layout fails sanity, dump the raw region so we can
// reverse-engineer the actual GSC S2 layout. Logs 64 bytes as hex + as
// int32 slots, plus the pointer-sized slots at 0x00/0x08/0x10/0x18.
void dump_region(const FUObjectArray* arr) {
  if (!arr) return;
  auto* p = reinterpret_cast<const uint8_t*>(arr);
  auto* as_u32 = reinterpret_cast<const uint32_t*>(arr);
  auto* as_u64 = reinterpret_cast<const uint64_t*>(arr);

  // 4 rows × 16 bytes hex.
  for (int row = 0; row < 4; ++row) {
    int off = row * 16;
    char buf[96];
    snprintf(buf, sizeof(buf),
             "+%02X: %02x %02x %02x %02x %02x %02x %02x %02x  %02x %02x %02x %02x %02x %02x %02x %02x",
             off,
             p[off + 0], p[off + 1], p[off + 2], p[off + 3],
             p[off + 4], p[off + 5], p[off + 6], p[off + 7],
             p[off + 8], p[off + 9], p[off + 10], p[off + 11],
             p[off + 12], p[off + 13], p[off + 14], p[off + 15]);
    nb::log::info("ue.dump", "{}", buf);
  }
  // Same 64 bytes as 16 int32 slots — easier to spot counts.
  for (int i = 0; i < 16; i += 4) {
    nb::log::info("ue.dump",
                  "i32 [{}..{}]: {} {} {} {}",
                  i, i + 3, as_u32[i], as_u32[i + 1], as_u32[i + 2], as_u32[i + 3]);
  }
  // Candidate pointer slots.
  nb::log::info("ue.dump", "ptr +0x00={:x} +0x08={:x} +0x10={:x} +0x18={:x} +0x20={:x}",
                as_u64[0], as_u64[1], as_u64[2], as_u64[3], as_u64[4]);
}

}  // namespace

bool initialize() {
  if (g_ready.load()) return true;
  const FUObjectArray* arr = resolve_guobject_array();
  if (!plausible(arr)) {
    nb::log::error("ue", "GUObjectArray sanity check failed — layout mismatch or AOB bad?");
    if (arr) {
      nb::log::info("ue", "dumping 64 bytes at {} for layout reverse-engineering:",
                    static_cast<const void*>(arr));
      dump_region(arr);
    }
    return false;
  }
  nb::log::info("ue", "GUObjectArray OK: num_elements={}, max_elements={}, num_chunks={}",
                arr->obj_objects.num_elements, arr->obj_objects.max_elements,
                arr->obj_objects.num_chunks);
  g_array.store(arr);
  g_ready.store(true);
  return true;
}

bool is_ready() { return g_ready.load(); }

const FUObjectArray* guobject_array() { return g_array.load(); }

int32_t num_objects() {
  const FUObjectArray* a = g_array.load();
  return a ? a->obj_objects.num_elements : -1;
}

const FUObjectItem* get_item(int32_t index) {
  const FUObjectArray* a = g_array.load();
  if (!a) return nullptr;
  if (index < 0 || index >= a->obj_objects.num_elements) return nullptr;
  int32_t chunk = index / kElementsPerChunk;
  int32_t slot = index % kElementsPerChunk;
  if (chunk >= a->obj_objects.num_chunks) return nullptr;
  FUObjectItem* chunks = a->obj_objects.objects[chunk];
  if (!chunks) return nullptr;
  return chunks + slot;
}

}  // namespace nb::ue
