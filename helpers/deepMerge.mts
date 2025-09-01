export const deepMerge = (target, source, preferLeft = true) => {
  if (typeof target !== "object" || typeof source !== "object") {
    return source;
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
  return target;
};
