export const deepMerge = <T, S>(target: T, source: S, preferLeft = true): T & S => {
  if (typeof target !== "object" || typeof source !== "object") {
    return source as T & S;
  }
  for (const key of Object.keys(source)) {
    if (key in target) {
      target[key] = deepMerge(target[key], source[key]);
    } else {
      if (preferLeft) {
        target[key] ||= source[key];
      } else {
        target[key] = source[key];
      }
    }
  }
  return target as T & S;
};
