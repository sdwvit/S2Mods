import { Struct } from "s2cfgtojson";

/**
 * Shrinks a generated cfg file by inheritance: a nested struct whose content equals one written earlier in the
 * same file becomes an empty struct with `{refkey=<Root>.<Key>.<Key>...}`. Any nested struct can inherit a root
 * struct or a sub-struct of one by such a dotted path (vanilla: `BoneDamageMap {refurl=../ref/refs.cfg;
 * refkey=FleshBoneDamageMap}`).
 *
 * - Only earlier structs are referenced, so the file never points forward.
 * - Sources and targets live in new roots only: a bpatch root patches a vanilla struct and is left alone.
 * - Structs that already carry refkey/refurl/bpatch/removenode are neither sources nor targets.
 * - A source path holds named keys only (no array indexes); a target may sit anywhere, `[0]` included.
 * - Structs under MIN_LEAVES leaf values stay as they are: the refkey line would not be shorter.
 * - `[*]` lists (useAsterisk) are skipped: their entries append to an inherited list, and s2cfgtojson renders
 *   the refkey of a useAsterisk struct as `[*]`.
 *
 * Works on clones: the transformers' structs may be shared with other code.
 */
const MIN_LEAVES = 3;
const NAMED_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

type Shape = { canonical: string; leaves: number };

function shapeOf(struct: Struct, shapes: WeakMap<Struct, Shape>): Shape {
  const cached = shapes.get(struct);
  if (cached) return cached;
  const { refkey, refurl, bskipref, bpatch, isArray, useAsterisk, removenode } = struct.__internal__;
  let canonical = `{${[refkey, refurl, bskipref, bpatch, isArray, useAsterisk, removenode].join("|")}`;
  let leaves = 0;
  for (const [key, value] of struct.entries()) {
    if (value instanceof Struct) {
      const child = shapeOf(value, shapes);
      canonical += `${String(key)}${child.canonical}`;
      leaves += child.leaves;
    } else {
      canonical += `${String(key)}=${String(value)};`;
      leaves++;
    }
  }
  const shape = { canonical: `${canonical}}`, leaves };
  shapes.set(struct, shape);
  return shape;
}

const appendsToList = (struct: Struct) =>
  struct.__internal__.useAsterisk || struct.entries().some(([, v]) => v instanceof Struct && v.__internal__.rawName === "[*]");

const inheritable = (struct: Struct) => {
  const { refkey, refurl, bpatch, removenode } = struct.__internal__;
  return refkey === undefined && !refurl && !bpatch && !removenode && !appendsToList(struct);
};

function stubFor(original: Struct, refkey: string) {
  const stub = new Struct();
  const { rawName, isArray, bskipref } = original.__internal__;
  Object.assign(stub.__internal__, { rawName, isArray, bskipref, refkey });
  return stub;
}

export function inheritDuplicateStructs(roots: Struct[]): Struct[] {
  const shapes = new WeakMap<Struct, Shape>();
  const firstPath = new Map<string, string>();

  const visit = (struct: Struct, path: string | undefined) => {
    for (const [key, value] of struct.entries()) {
      if (!(value instanceof Struct) || !inheritable(value)) continue;
      const { canonical, leaves } = shapeOf(value, shapes);
      const source = firstPath.get(canonical);
      if (source && leaves >= MIN_LEAVES) {
        (struct as any)[key] = stubFor(value, source);
        continue;
      }
      const childPath = path && NAMED_KEY.test(String(key)) ? `${path}.${String(key)}` : undefined;
      if (childPath && !source) firstPath.set(canonical, childPath);
      visit(value, childPath);
    }
  };

  return roots.map((original) => {
    const root = original.clone();
    if (!root.__internal__.bpatch && root.__internal__.rawName) visit(root, root.__internal__.rawName);
    return root;
  });
}
