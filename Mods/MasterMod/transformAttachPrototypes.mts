import { AttachPrototype } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";
import { getX16AttachPrototypes } from "../X16Scopes/meta.mts";

let oncePerFile = false;
/**
 * Increases the cost of Attachments by 10x.
 */
export const transformAttachPrototypes: StructTransformer<AttachPrototype> = async (struct, context) => {
  if (!oncePerFile) {
    oncePerFile = true;
    return getX16AttachPrototypes();
  }
};

transformAttachPrototypes.files = ["/AttachPrototypes.cfg"];
