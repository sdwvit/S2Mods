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

}  // namespace

bool initialize() {
  if (g_ready.load()) return true;
  const FUObjectArray* arr = resolve_guobject_array();
  if (!plausible(arr)) {
    nb::log::error("ue", "GUObjectArray sanity check failed — layout mismatch or AOB bad?");
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
