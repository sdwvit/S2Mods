import type { DialogPrototype, QuestNodePrototype } from "s2cfgtojson";
import type { MetaContext } from "../meta-type.mts";
import { createNodeSidMapper, type QuestIr, type QuestIrNode } from "./ir.mts";
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
    const launchers = (node.raw as any).Launchers;
    if (!launchers || typeof launchers === "string") {
      return;
    }
    launchers.forEach(([_k, launcher]) => {
      if (!launcher.Connections?.forEach) {
        return;
      }
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

export function normalizeDialogNodes(context: MetaContext<DialogPrototype>): QuestIr<DialogPrototype> {
  const getNodeSid = createNodeSidMapper(context);
  const nodes = context.array.map((raw) => {
    const sid = raw.SID;
    const jsSid = getNodeSid(sid);
    const node: QuestIrNode<DialogPrototype> = {
      raw,
      sid,
      jsSid,
      launches: [],
      launchersByJsSid: {},
    };
    return node;
  });

  const nodeBySid = new Map(nodes.map((node) => [node.sid, node]));
  const missingTargets = new Set<string>();

  nodes.forEach((node) => {
    const seen = new Set<string>();
    const pushEdge = (targetSid: string | undefined, label: string) => {
      const normalizedTargetSid = targetSid?.trim();
      if (!normalizedTargetSid || seen.has(`${normalizedTargetSid}::${label}`)) {
        return;
      }
      seen.add(`${normalizedTargetSid}::${label}`);
      if (!nodeBySid.has(normalizedTargetSid)) {
        missingTargets.add(normalizedTargetSid);
      }
      node.launches.push({ SID: normalizedTargetSid, Name: label });
    };

    pushEdge(node.raw.NextDialogSID, "");

    const nextDialogOptions = node.raw.NextDialogOptions;
    if (!nextDialogOptions || typeof nextDialogOptions === "string" || typeof nextDialogOptions.forEach !== "function") {
      return;
    }
    nextDialogOptions.forEach(([_key, option]) => {
      pushEdge(option.NextDialogSID, getDialogOptionLabel(option));
    });
  });

  if (missingTargets.size) {
    logger.warn(`Dialog normalize: missing next dialog target nodes: ${[...missingTargets].slice(0, 50).join(", ")}`);
  }

  return {
    nodes,
    jsNameBySid: new Map(nodes.map((node) => [node.sid, node.jsSid])),
  };
}

function getDialogOptionLabel(option: {
  AnswerText?: string;
  MainReply?: boolean;
  AvailableFromStart?: boolean;
  Terminate?: boolean;
}) {
  if (option.AnswerText?.trim()) {
    return option.AnswerText.trim();
  }
  if (option.Terminate) {
    return "Terminate";
  }
  if (option.MainReply) {
    return "MainReply";
  }
  if (option.AvailableFromStart) {
    return "Option";
  }
  return "";
}
