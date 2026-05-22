import type { MetaContext } from "../meta-type.mts";
import type { DialogPrototype, QuestNodePrototype } from "s2cfgtojson";

export type GraphPrototype = QuestNodePrototype | DialogPrototype;

export type LaunchEdge = { SID: string; Name: string };

export type QuestIrNode<T extends GraphPrototype = GraphPrototype> = {
  raw: T;
  sid: string;
  jsSid: string;
  launches: LaunchEdge[];
  launchersByJsSid: Record<string, LaunchEdge[]>;
};

export type QuestIr<T extends GraphPrototype = GraphPrototype> = {
  nodes: QuestIrNode<T>[];
  jsNameBySid: Map<string, string>;
};

function toJsIdentifier(raw: string) {
  const cleaned = raw.replace(/[^A-Za-z0-9_$]/g, "_");
  return /^[A-Za-z_$]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

export function createNodeSidMapper<T extends GraphPrototype>(context: MetaContext<T>) {
  const used = new Set<string>();
  const sidToJs = new Map<string, string>();
  const getOrCreate = (raw: string) => {
    const existing = sidToJs.get(raw);
    if (existing) {
      return existing;
    }
    const base = toJsIdentifier(raw);
    let candidate = base;
    let suffix = 1;
    while (used.has(candidate)) {
      candidate = `${base}_${suffix++}`;
    }
    used.add(candidate);
    sidToJs.set(raw, candidate);
    return candidate;
  };

  context.array.forEach((struct) => {
    getOrCreate(struct.SID);
  });

  return getOrCreate;
}
