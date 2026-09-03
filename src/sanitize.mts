/**
 * Makes a string safe to embed in a Steam `workshopitem.vdf` value.
 *
 * Steam's KeyValues parser (src/tier1/KeyValues.cpp) rejects a `\"` escape inside a quoted
 * value - `workshop_build_item` dies with "Failed to parse build config file" - even though
 * @node-steam/vdf both writes and reads it happily. There is no working escape, so a double
 * quote is folded to a single one rather than escaped.
 */
export function sanitize(str: string) {
  return str.replace(/\n/g, "").replace(/"/g, "'");
}
