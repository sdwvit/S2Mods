#include "uproperty.h"

#include <windows.h>

#include <cstring>

#include "fname.h"
#include "logging.h"

namespace {

// SEH-guarded read. Returns true on success, false if the address faulted.
// We use this inside property walker loops where a corrupt chain pointer
// would otherwise crash the game.
extern "C" int nb_try_read_ptr_u(const void* ptr, void** out) {
  __try {
    *out = *reinterpret_cast<void* const*>(ptr);
    return 1;
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    return 0;
  }
}
extern "C" int nb_try_read_fname_u(const void* ptr, uint32_t* comp, uint32_t* num) {
  __try {
    *comp = *reinterpret_cast<const uint32_t*>(ptr);
    *num = *reinterpret_cast<const uint32_t*>(static_cast<const uint8_t*>(ptr) + 4);
    return 1;
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    return 0;
  }
}
extern "C" int nb_try_read_i32_u(const void* ptr, int32_t* out) {
  __try {
    *out = *reinterpret_cast<const int32_t*>(ptr);
    return 1;
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    return 0;
  }
}

}  // namespace

namespace nb::ue {

std::string name_at(const void* base, size_t offset) {
  if (!base) return {};
  const auto* p = static_cast<const uint8_t*>(base) + offset;
  FName fn = *reinterpret_cast<const FName*>(p);
  return fname_to_string(fn);
}

std::optional<int32_t> find_property_offset(const UObjectBase* obj, std::string_view name) {
  if (!obj || !obj->class_ptr) return std::nullopt;

  // All reads inside the walker are SEH-guarded — a corrupt FProperty chain
  // pointer (wrong class, wrong offsets, blueprint without a property list)
  // would otherwise crash the game. On any read fault we abort the current
  // class walk and move to the super-struct.
  const void* cls = obj->class_ptr;
  int parent_walks = 0;
  while (cls && parent_walks < 16) {
    // Read PropertyLink head from UStruct+0x60, guarded.
    void* head_raw = nullptr;
    if (!nb_try_read_ptr_u(static_cast<const uint8_t*>(cls) + kUStructPropertyLinkOffset, &head_raw)) {
      nb::log::warn("uprop", "fault reading PropertyLink head; skipping class");
      break;
    }
    const FProperty* cur = static_cast<const FProperty*>(head_raw);
    int seen = 0;
    while (cur && seen < 2048) {
      uint32_t comp = 0, num = 0;
      if (!nb_try_read_fname_u(&cur->hdr.name_private, &comp, &num)) {
        nb::log::warn("uprop", "fault reading FProperty.Name; aborting class walk");
        break;
      }
      FName fn{comp, num};
      std::string pn = fname_to_string(fn);
      if (pn == name) {
        int32_t off = 0;
        if (nb_try_read_i32_u(&cur->offset_internal, &off)) return off;
        nb::log::warn("uprop", "fault reading offset_internal for '{}'", name);
        break;
      }
      void* next_raw = nullptr;
      if (!nb_try_read_ptr_u(&cur->property_link_next, &next_raw)) {
        nb::log::warn("uprop", "fault reading property_link_next; aborting class walk");
        break;
      }
      cur = static_cast<const FProperty*>(next_raw);
      ++seen;
    }
    // Parent class walk — also guarded.
    void* super_raw = nullptr;
    if (!nb_try_read_ptr_u(static_cast<const uint8_t*>(cls) + kUStructSuperStructOffset, &super_raw)) break;
    cls = super_raw;
    ++parent_walks;
  }
  return std::nullopt;
}

void* read_ptr(const void* base, size_t offset) {
  if (!base) return nullptr;
  const auto* p = static_cast<const uint8_t*>(base) + offset;
  void* v = nullptr;
  std::memcpy(&v, p, sizeof(v));
  return v;
}

void write_ptr(void* base, size_t offset, void* value) {
  if (!base) return;
  auto* p = static_cast<uint8_t*>(base) + offset;
  std::memcpy(p, &value, sizeof(value));
}

FVector3d read_vector3d(const void* base, size_t offset) {
  FVector3d v{0, 0, 0};
  if (!base) return v;
  const auto* p = static_cast<const uint8_t*>(base) + offset;
  std::memcpy(&v, p, sizeof(v));
  return v;
}

void write_vector3d(void* base, size_t offset, FVector3d v) {
  if (!base) return;
  auto* p = static_cast<uint8_t*>(base) + offset;
  std::memcpy(p, &v, sizeof(v));
}

}  // namespace nb::ue
