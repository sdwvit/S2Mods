import { DialogChainPrototype } from "s2cfgtojson";

import { StructTransformer } from "../../src/meta-type.mts";

let oncePerTransformer = false;

/**
 */
export const transformDialogChainPrototypes: StructTransformer<DialogChainPrototype> = async (struct) => {
  if (!oncePerTransformer) {
    oncePerTransformer = true;
  }
  return null;
};
transformDialogChainPrototypes.files = [];
