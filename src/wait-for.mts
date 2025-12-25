export function waitFor(condition: () => boolean, timeout = 60000): Promise<void> {
  return new Promise((resolve, reject) => {
    const err = new Error("Timeout waiting for condition " + condition.toString());
    const to = setTimeout(() => {
      clearInterval(interval);
      err.stack += "\nAt: \n\n" + new Error().stack;
      reject(err);
    }, timeout);

    const interval = setInterval(() => {
      if (condition()) {
        clearTimeout(to);
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}
