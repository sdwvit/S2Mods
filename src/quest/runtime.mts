function hasQuestNodeExecuted(f, completedOutputPins = []) {
  const state = f.State || {};
  const result = completedOutputPins.every((pin) => state[f.name]?.find((e) => e.SID === f.name && (pin === "None" ? true : e.Name === pin)));
  console.log(`hasQuestNodeExecuted(${f.name}) is ${f.State ? "" : "rolled to"} ${result}`);
  return result;
}
function waitForCallers(timeout, questFn, caller) {
  return new Promise<void>((resolve, reject) => {
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
          hasCallerPin(fnName, outputPin) ? "" : `${questFn.name} to be called by ${fnName} ${outputPin ? "with " + outputPin : ""}`,
        )
        .filter((r) => r);

    const allMet = () => {
      const items = getConditions();
      return items.length > 0 && items.every(({ SID: fnName, Name: outputPin }) => hasCallerPin(fnName, outputPin));
    };

    const to = setTimeout(() => {
      clearInterval(interval);
      reject(`Timeout waiting for condition(s):\n\t${[...new Set(pendingMessage())].join("\n\t")}`);
    }, timeout);

    const interval = setInterval(() => {
      if (allMet()) {
        clearTimeout(to);
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}
export const RUNTIME_SOURCE = `
${hasQuestNodeExecuted}

${waitForCallers}
`.trim();
