const LOG_LEVELS = ["error", "warn", "log", "info", "debug"] as const;
const DEFAULT_LOG_LEVEL_LIMIT = LOG_LEVELS.length - 1;

const parseLogLevelLimit = () => {
  const rawLimit = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (!rawLimit) return DEFAULT_LOG_LEVEL_LIMIT;

  const parsedNumber = Number(rawLimit);
  if (!Number.isNaN(parsedNumber)) {
    return Math.min(Math.max(Math.trunc(parsedNumber), 0), DEFAULT_LOG_LEVEL_LIMIT);
  }

  const parsedLevel = LOG_LEVELS.indexOf(rawLimit as (typeof LOG_LEVELS)[number]);
  if (parsedLevel === -1) return DEFAULT_LOG_LEVEL_LIMIT;
  return parsedLevel;
};

const logLevelLimit = parseLogLevelLimit();

const universal =
  (level: number) =>
  (...args: any[]) => {
    if (level > logLevelLimit) return;
    console[LOG_LEVELS[level]](...args);
  };
export const logger = Object.fromEntries(Object.entries(LOG_LEVELS).map(([key, value]) => [value, universal(Number(key))]));
