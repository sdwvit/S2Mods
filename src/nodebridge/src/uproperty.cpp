#include "uproperty.h"

#include <cstring>

#include "fname.h"
#include "logging.h"

namespace nb::ue {

namespace {

const FProperty* property_link_head(const void* class_ptr) {
  if (!class_ptr) return nullptr;
  auto base = static_cast<const uint8_t*>(class_ptr);
  return *reinterpret_cast<const FProperty* const*>(base + kUStructPropertyLinkOffset);
}

const void* super_struct(const void* class_ptr) {
  if (!class_ptr) return nullptr;
  auto base = static_cast<const uint8_t*>(class_ptr);
  return *reinterpret_cast<void* const*>(base + kUStructSuperStructOffset);
}

}  // namespace

std::string name_at(const void* base, size_t offset) {
  if (!base) return {};
  const auto* p = static_cast<const uint8_t*>(base) + offset;
  FName fn = *reinterpret_cast<const FName*>(p);
  return fname_to_string(fn);
}

std::optional<int32_t> find_property_offset(const UObjectBase* obj, std::string_view name) {
  if (!obj || !obj->class_ptr) return std::nullopt;

  // UStruct.PropertyLink is UE-built so it already includes inherited
  // properties at the start — one walk covers the whole class hierarchy.
  // Fall back to iterating parent classes if we miss anyway (belt+braces).
  const void* cls = obj->class_ptr;
  int parent_walks = 0;
  while (cls && parent_walks < 16) {
    const FProperty* cur = property_link_head(cls);
    int seen = 0;
    while (cur && seen < 2048) {
      std::string pn = fname_to_string(cur->hdr.name_private);
      if (pn == name) return cur->offset_internal;
      cur = cur->property_link_next;
      ++seen;
    }
    cls = super_struct(cls);
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
