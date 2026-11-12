/**
 * Every player-visible armor and helmet, base game and DLC, with its `Protection` resolved through
 * the `refkey`/`refurl` chain (most armors restate only some of the seven values).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { Struct } from "s2cfgtojson";
import { baseCfgDir } from "../../src/base-paths.mts";

export const PROTECTION_KEYS = [
  "Strike",
  "Burn",
  "Shock",
  "ChemicalBurn",
  "Radiation",
  "PSY",
] as const;
export type ProtectionKey = (typeof PROTECTION_KEYS)[number];

export type ArmorStats = {
  SID: string;
  /** The key the game reads text under: `LocalizationSID` when set, else `SID`. */
  textSID: string;
  protection: Record<ProtectionKey, number>;
  /** `BaseDurability`, the item's condition points when new. */
  durability: number;
};

const projectRoot = path.join(import.meta.dirname, "../..");
const BASE_FILE = path.join(baseCfgDir, "GameData/ItemPrototypes/ArmorPrototypes.cfg");
const DLC_FILES = ["Deluxe", "Ultimate", "PreOrder", "DLC1"].map((dlc) =>
  path.join(projectRoot, "DLCGameData", dlc, "ItemPrototypes.cfg"),
);

const parse = (file: string) => Struct.fromString<Struct>(readFileSync(file, "utf8"));

type Node = { struct: Struct; file: string };

export function readArmorStats(): ArmorStats[] {
  const base = new Map<string, Node>();
  parse(BASE_FILE).forEach((s) =>
    base.set(s.__internal__.rawName ?? s.SID, { struct: s, file: BASE_FILE }),
  );

  const all: Node[] = [...base.values()];
  const byFile = new Map<string, Map<string, Node>>([[BASE_FILE, base]]);
  for (const file of DLC_FILES) {
    const local = new Map<string, Node>();
    parse(file).forEach((s) => {
      const node = { struct: s, file };
      local.set(s.__internal__.rawName ?? s.SID, node);
      all.push(node);
    });
    byFile.set(file, local);
  }

  /** The struct `node` inherits from, or undefined at the root. */
  const parentOf = (node: Node): Node | undefined => {
    const { refkey, refurl } = node.struct.__internal__;
    if (!refkey) return undefined;
    // DLC structs reach the base game's armors through a refurl to ArmorPrototypes.cfg.
    const map = refurl?.includes("ArmorPrototypes") ? base : byFile.get(node.file)!;
    return map.get(String(refkey));
  };
  const chain = (node: Node) => {
    const out: Node[] = [];
    for (let n: Node | undefined = node; n && out.length < 20; n = parentOf(n)) out.push(n);
    return out;
  };
  const resolve = (node: Node, key: string) => {
    for (const n of chain(node)) if (n.struct[key] !== undefined) return n.struct[key];
    return undefined;
  };

  return all
    .filter((node) => {
      const sid = node.struct.SID;
      if (!sid || sid.startsWith("Template")) return false;
      return chain(node).some((n) => n.struct.SID === "TemplateArmor");
    })
    .map((node) => {
      const protection = {} as Record<ProtectionKey, number>;
      for (const key of PROTECTION_KEYS) {
        let value = 0;
        for (const n of chain(node)) {
          const v = n.struct.Protection?.[key];
          if (v !== undefined) {
            value = Number(String(v).replace(/f$/, ""));
            break;
          }
        }
        protection[key] = value;
      }
      const loc = resolve(node, "LocalizationSID");
      return {
        SID: node.struct.SID,
        textSID: typeof loc === "string" && loc && loc !== "empty" ? loc : node.struct.SID,
        protection,
        durability: Number(String(resolve(node, "BaseDurability") ?? 0).replace(/f$/, "")),
      };
    });
}
