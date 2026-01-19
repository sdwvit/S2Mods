import { QuestNodePrototype } from "s2cfgtojson";
import { MetaContext } from "../meta-type.mts";
import { createNodeSidMapper, QuestIr, QuestIrNode } from "./ir.mts";
import { logger } from "../logger.mts";

export function normalizeQuestNodes(context: MetaContext<QuestNodePrototype>): QuestIr {
  const getNodeSid = createNodeSidMapper(context);
  const nodes = context.array.map((raw) => {
    const sid = raw.SID;
    const jsSid = getNodeSid(sid);
    const node: QuestIrNode = {
      raw,
      sid,
      jsSid,
      launches: [],
      launchersByJsSid: {},
    };
    return node;
  });

  const nodeBySid = new Map(nodes.map((n) => [n.sid, n]));
  const missingLaunchTargets = new Set<string>();
  const missingLauncherTargets = new Set<string>();

  nodes.forEach((node) => {
    const launchers = node.raw.Launchers;
    if (!launchers) {
      return;
    }
    launchers.forEach(([_k, launcher]) => {
      launcher.Connections.forEach(([_ck, item]) => {
        const launcherSid = item.SID;
        const launcherNode = nodeBySid.get(launcherSid);
        if (launcherNode) {
          launcherNode.launches.push({ SID: node.sid, Name: item.Name });
        } else {
          missingLaunchTargets.add(launcherSid);
        }
        const launcherJsSid = getNodeSid(launcherSid);
        node.launchersByJsSid[launcherJsSid] ||= [];
        launcher.Connections.forEach(([_ek, e]) => {
          if (!nodeBySid.has(e.SID)) {
            missingLauncherTargets.add(e.SID);
          }
          node.launchersByJsSid[launcherJsSid].push({ SID: getNodeSid(e.SID), Name: e.Name });
        });
      });
    });
  });

  // BridgeEvent nodes listen to another node's state change.
  nodes.forEach((node) => {
    if (node.raw.NodeType?.split("::").pop() !== "BridgeEvent") {
      return;
    }
    const linkedSid = (node.raw as any).LinkedNodePrototypeSID as string | undefined;
    if (!linkedSid) {
      return;
    }
    const linkedNode = nodeBySid.get(linkedSid);
    if (!linkedNode) {
      missingLaunchTargets.add(linkedSid);
      return;
    }
    linkedNode.launches.push({ SID: node.sid, Name: "" });
  });

  if (missingLaunchTargets.size) {
    logger.warn(`Quest normalize: missing launch target nodes: ${[...missingLaunchTargets].slice(0, 50).join(", ")}`);
  }
  if (missingLauncherTargets.size) {
    logger.warn(`Quest normalize: missing launcher nodes: ${[...missingLauncherTargets].slice(0, 50).join(", ")}`);
  }

  return {
    nodes,
    jsNameBySid: new Map(nodes.map((n) => [n.sid, n.jsSid])),
  };
}
