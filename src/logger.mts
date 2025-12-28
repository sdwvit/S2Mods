const LOG_LEVELS = ["error", "warn", "log", "info", "debug"] as const;

const universal =
  (level: number) =>
  (...args: any[]) => {
    console[LOG_LEVELS[level]](...args);
  };
export const logger = Object.fromEntries(Object.entries(LOG_LEVELS).map(([key, value]) => [value, universal(Number(key))]));
