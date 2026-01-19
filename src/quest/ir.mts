import { MetaContext } from "../meta-type.mts";
import { QuestNodePrototype } from "s2cfgtojson";

export type LaunchEdge = { SID: string; Name: string };

export type QuestIrNode = {
  raw: QuestNodePrototype;
  sid: string;
  jsSid: string;
  launches: LaunchEdge[];
  launchersByJsSid: Record<string, LaunchEdge[]>;
};

export type QuestIr = {
  nodes: QuestIrNode[];
  jsNameBySid: Map<string, string>;
};

function toJsIdentifier(raw: string) {
  const cleaned = raw.replace(/[^A-Za-z0-9_$]/g, "_");
  return /^[A-Za-z_$]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

export function createNodeSidMapper(context: MetaContext<QuestNodePrototype>) {
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
