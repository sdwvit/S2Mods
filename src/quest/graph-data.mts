import type { MetaContext } from "../meta-type.mts";
import type { DialogPrototype, QuestNodePrototype } from "s2cfgtojson";
import { normalizeDialogNodes, normalizeQuestNodes } from "./normalize.mts";
import type { GraphPrototype } from "./ir.mts";

export type QuestGraphNode = {
  id: string;
  sid: string;
  nodeType: string;
  label: string;
  subtitle: string;
  isStart: boolean;
  isTerminal: boolean;
  details: Record<string, string | number | boolean | null>;
};

export type QuestGraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  kind: "launch";
};

export type QuestGraphData = {
  title: string;
  sourceFilePath: string;
  nodeCount: number;
  edgeCount: number;
  nodes: QuestGraphNode[];
  edges: QuestGraphEdge[];
};

export function buildQuestGraphData<T extends GraphPrototype>(
  context: MetaContext<T>,
  sourceFilePath = context.filePath,
): QuestGraphData {
  const graphKind = detectGraphKind(sourceFilePath || context.filePath);
  const ir =
    graphKind === "dialog"
      ? normalizeDialogNodes(context as MetaContext<DialogPrototype>)
      : normalizeQuestNodes(context as MetaContext<QuestNodePrototype>);
  const incomingCounts = new Map<string, number>();
  ir.nodes.forEach((node) => {
    node.launches.forEach((edge) => {
      incomingCounts.set(edge.SID, (incomingCounts.get(edge.SID) || 0) + 1);
    });
  });
  const nodes = ir.nodes.map((node) => {
    const nodeType = graphKind === "dialog" ? getDialogNodeType(node.raw as DialogPrototype) : getNodeSubType((node.raw as QuestNodePrototype).NodeType);
    const details =
      graphKind === "dialog" ? getDialogNodeDetails(node.raw as DialogPrototype) : getNodeDetails(node.raw as QuestNodePrototype);
    return {
      id: node.jsSid,
      sid: node.sid,
      nodeType,
      label: formatNodeLabel(node.jsSid),
      subtitle: graphKind === "dialog" ? getDialogNodeSubtitle(node.raw as DialogPrototype) : getNodeSubtitle(node.raw as QuestNodePrototype),
      isStart:
        graphKind === "dialog"
          ? (incomingCounts.get(node.sid) || 0) === 0
          : Boolean((node.raw as QuestNodePrototype & { LaunchOnQuestStart?: boolean }).LaunchOnQuestStart),
      isTerminal: nodeType === "End" || node.launches.length === 0,
      details,
    };
  });

  const edges = ir.nodes.flatMap((node) =>
    node.launches.map((edge, index) => ({
      id: `${node.jsSid}__${ir.jsNameBySid.get(edge.SID) || edge.SID}__${index}`,
      source: node.jsSid,
      target: ir.jsNameBySid.get(edge.SID) || edge.SID,
      label: edge.Name || "",
      kind: "launch" as const,
    })),
  );

  return {
    title: context.fileName,
    sourceFilePath,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
  };
}

function getNodeSubType(nodeType: string | undefined) {
  return String(nodeType || "").split("::").pop() || "Unknown";
}

function detectGraphKind(filePath: string) {
  return filePath.replaceAll("\\", "/").includes("/DialogPrototypes/") ? "dialog" : "quest";
}

function getNodeSubtitle(struct: QuestNodePrototype) {
  const nodeType = getNodeSubType(struct.NodeType);
  const maybeText = firstDefinedString([
    (struct as QuestNodePrototype & { ScreenText?: string }).ScreenText,
    (struct as QuestNodePrototype & { ItemSID?: string }).ItemSID,
    (struct as QuestNodePrototype & { ItemPrototypeSID?: string }).ItemPrototypeSID,
    (struct as QuestNodePrototype & { SignalReceiverGuid?: string }).SignalReceiverGuid,
    (struct as QuestNodePrototype & { LinkedNodePrototypeSID?: string }).LinkedNodePrototypeSID,
  ]);
  return maybeText ? `${nodeType}: ${truncate(maybeText, 48)}` : nodeType;
}

function getDialogNodeType(struct: DialogPrototype) {
  if (struct.ShowNextDialogOptionsAsAnswers) {
    return "Choice";
  }
  if (struct.MainReply) {
    return "Reply";
  }
  if (struct.DialogMemberIndex === -1) {
    return "Hub";
  }
  return "Dialog";
}

function getDialogNodeSubtitle(struct: DialogPrototype) {
  const text = firstDefinedString([struct.Text, struct.AnswerText, struct.DialogChainPrototypeSID]);
  const nodeType = getDialogNodeType(struct);
  return text ? `${nodeType}: ${truncate(text, 48)}` : nodeType;
}

function firstDefinedString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function formatNodeLabel(value: string) {
  return value
    .replaceAll("_", "_\u200b")
    .replace(/([a-z0-9])([A-Z])/g, "$1\u200b$2");
}

function getNodeDetails(struct: QuestNodePrototype) {
  const details: Record<string, string | number | boolean | null> = {
    SID: struct.SID,
    NodeType: getNodeSubType(struct.NodeType),
  };

  for (const key of DETAIL_KEYS) {
    const value = (struct as Record<string, unknown>)[key];
    if (value === undefined || value === null || value === "") {
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      details[key] = value;
      continue;
    }
    details[key] = summarizeValue(value);
  }

  return details;
}

function getDialogNodeDetails(struct: DialogPrototype) {
  const details: Record<string, string | number | boolean | null> = {
    SID: struct.SID,
    NodeType: getDialogNodeType(struct),
  };

  for (const key of DIALOG_DETAIL_KEYS) {
    const value = (struct as Record<string, unknown>)[key];
    if (value === undefined || value === null || value === "") {
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      details[key] = value;
      continue;
    }
    details[key] = summarizeValue(value);
  }

  return details;
}

const DETAIL_KEYS = [
  "Comment",
  "QuestSID",
  "TargetQuestGuid",
  "LinkedNodePrototypeSID",
  "SignalReceiverGuid",
  "SignalSenderGuid",
  "ItemSID",
  "ItemPrototypeSID",
  "ItemsCount",
  "InGameHours",
  "VolumeGuid",
  "SequenceName",
  "ScreenText",
  "FadeTime",
  "LaunchOnQuestStart",
] as const;

const DIALOG_DETAIL_KEYS = [
  "DialogChainPrototypeSID",
  "DialogMemberIndex",
  "DialogMemberName",
  "Text",
  "AnswerText",
  "NextDialogSID",
  "ShowDialogWindow",
  "ShowNextDialogOptionsAsAnswers",
  "MainReply",
  "VisibleOnFailedCondition",
  "Unskippable",
  "Conditions",
  "NextDialogOptions",
] as const;

function summarizeValue(value: unknown) {
  if (Array.isArray(value)) {
    return `${value.length} items`;
  }
  if (typeof value === "object") {
    const entries = typeof (value as { entries?: unknown }).entries === "function";
    if (entries) {
      const count = Array.from((value as { entries(): Iterable<unknown> }).entries()).length;
      return `${count} entries`;
    }
    return "object";
  }
  return String(value);
}
