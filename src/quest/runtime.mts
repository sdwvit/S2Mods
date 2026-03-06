type RuntimeSourceOptions = {
  includeHasQuestNodeExecuted?: boolean;
  includeWaitForCallers?: boolean;
};

const RUNTIME_BASE_SOURCE = `
const DEBUG_QUEST_JS = globalThis.DEBUG_QUEST_JS ?? true;
const DEBUG_QUEST_JS_LEVEL = globalThis.DEBUG_QUEST_JS_LEVEL ?? "full";
const DEBUG_QUEST_JS_NODE_LOGS = globalThis.DEBUG_QUEST_JS_NODE_LOGS ?? false;
const DEBUG_QUEST_JS_MAX_INDENT = Number(globalThis.DEBUG_QUEST_JS_MAX_INDENT ?? 24);
let __questDepth = 0;
const __questLog = (...args) => {
  if (DEBUG_QUEST_JS) console.log(...args);
};
const __questLogFull = (...args) => {
  if (DEBUG_QUEST_JS && DEBUG_QUEST_JS_LEVEL === "full") console.log(...args);
};
const __questIndent = (extra = 0) => " ".repeat(Math.min(DEBUG_QUEST_JS_MAX_INDENT, Math.max(0, __questDepth + extra)));
const __questLogIndented = (message, extra = 0) => {
  __questLog(__questIndent(extra) + message);
};
const __questLogFullIndented = (message, extra = 0) => {
  __questLogFull(__questIndent(extra) + message);
};
const __questLogStub = (message) => {
  __questLogFullIndented(message, 1);
};
const __questFmtArg = (arg) => {
  if (typeof arg === "function") return arg.name || "<anonymous>";
  if (Array.isArray(arg)) return "[" + arg.map((v) => __questFmtArg(v)).join(", ") + "]";
  if (typeof arg === "string") return arg;
  if (arg === undefined) return "undefined";
  if (arg === null) return "null";
  if (typeof arg === "object") return JSON.stringify(arg);
  return String(arg);
};
const __questFmtArgs = (args) => args.map((arg) => __questFmtArg(arg)).join(", ");

const inventoryByActor = Object.create(null);

function getActorInventory(actor = "Skif") {
  inventoryByActor[actor] ||= Object.create(null);
  return inventoryByActor[actor];
}

function __questAddItem(itemSid, count = 1, actor = "Skif") {
  const inventory = getActorInventory(actor);
  const next = (inventory[itemSid] || 0) + Number(count || 0);
  inventory[itemSid] = next;
  __questLogIndented(\`inventory add \${itemSid} x\${count} -> \${actor} now has \${next}\`, 1);
  return next;
}

function __questRemoveItem(itemSid, count = 1, actor = "Skif") {
  const inventory = getActorInventory(actor);
  const next = Math.max(0, (inventory[itemSid] || 0) - Number(count || 0));
  if (next) {
    inventory[itemSid] = next;
  } else {
    delete inventory[itemSid];
  }
  __questLogIndented(\`inventory remove \${itemSid} x\${count} -> \${actor} now has \${next}\`, 1);
  return next;
}

function __questIsItemInInventory(itemSid, count = 1, actor = "Skif") {
  const inventory = getActorInventory(actor);
  const current = Number(inventory[itemSid] || 0);
  const required = Number(count || 0);
  const result = current >= required;
  __questLogIndented(\`isItemInInventory(\${itemSid}, \${required}, \${actor}) => \${result} (have \${current})\`, 1);
  return result;
}

function __questNodeInit(f, caller, name) {
  const callerName = caller?.name ?? String(caller ?? "Unknown");
  f.State ??= {};
  f.State[callerName] ||= [];
  f.State[callerName].push({ SID: callerName, Name: name || true });
  if (DEBUG_QUEST_JS_NODE_LOGS) __questLogIndented(\`// \${f.name}(\${callerName}\${name ? \`, \${name}\` : ""});\`);
  __questDepth += 1;
  return callerName;
}

function __questNodeComplete(f, result) {
  __questDepth = Math.max(0, __questDepth - 1);
  f.State ??= {};
  f.State[f.name] ||= [];
  f.State[f.name].push({ SID: f.name, Name: result });
}
`.trim();

const HAS_QUEST_NODE_EXECUTED_SOURCE = `
function hasQuestNodeExecuted(f, completedOutputPins = []) {
  const state = f.State || {};
  const result = completedOutputPins.every((pin) => state[f.name]?.find((e) => e.SID === f.name && (pin === "None" ? true : e.Name === pin)));
  __questLogIndented(\`hasQuestNodeExecuted(\${f.name}) is \${f.State ? "" : "rolled to"} \${result}\`, 1);
  return result;
}
`.trim();

const WAIT_FOR_CALLERS_SOURCE = `
function waitForCallers(timeout, questFn, caller) {
  return new Promise((resolve, reject) => {
    const state = questFn.State;
    const conditions = questFn.Conditions;
    const callerName = caller.name;
    const getConditions = () => conditions[callerName] || [];

    const hasCallerPin = (fnName, outputPin) => {
      const relevantState = state[fnName];
      if (!relevantState) {
        return false;
      }
      return relevantState.some(({ SID: callerNameValue, Name: callerOutputPin }) => {
        const sidTheSame = callerNameValue === fnName;
        const pinTheSame = callerOutputPin === (outputPin || true);
        return sidTheSame && pinTheSame;
      });
    };

    const pendingMessage = () =>
      getConditions()
        .map(({ SID: fnName, Name: outputPin }) =>
          hasCallerPin(fnName, outputPin) ? "" : \`\${questFn.name} to be called by \${fnName} \${outputPin ? "with " + outputPin : ""}\`,
        )
        .filter((r) => r);

    const allMet = () => {
      const items = getConditions();
      return items.length > 0 && items.every(({ SID: fnName, Name: outputPin }) => hasCallerPin(fnName, outputPin));
    };

    const to = setTimeout(() => {
      clearInterval(interval);
      reject(\`Timeout waiting for condition(s):\\n\\t\${[...new Set(pendingMessage())].join("\\n\\t")}\`);
    }, timeout);
    const interval = setInterval(() => {
      if (allMet()) {
        clearTimeout(to);
        clearInterval(interval);
        resolve();
      }
    }, 100);
    intervals.push(interval);
  });
}
`.trim();

export function getRuntimeSource(options: RuntimeSourceOptions = {}) {
  const { includeHasQuestNodeExecuted = true, includeWaitForCallers = true } = options;
  return [
    RUNTIME_BASE_SOURCE,
    includeHasQuestNodeExecuted ? HAS_QUEST_NODE_EXECUTED_SOURCE : "",
    includeWaitForCallers ? WAIT_FOR_CALLERS_SOURCE : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export const RUNTIME_SOURCE = getRuntimeSource();
