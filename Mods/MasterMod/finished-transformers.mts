/** Shared between meta.mts and the transformers that must wait for another one to finish. */
export const finishedTransformers = new Set<string>();
