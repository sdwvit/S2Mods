import { AttachPrototype } from "s2cfgtojson";
import { EntriesTransformer } from "../../src/meta-type.mts";
import { getX16AttachPrototypes } from "../X16Scopes/meta.mts";

const oncePerFile = new Set<string>();
/**
 * Increases the cost of Attachments by 10x.
 */
export const transformAttachPrototypes: EntriesTransformer<AttachPrototype> = async (struct, context) => {
  const extraStructs: AttachPrototype[] = [];
  const fork = struct.fork();

  if (struct.Cost) {
    fork.Cost = struct.Cost * 10;
  }
  if (struct.SID === "GunThreeLine_Scope") {
    fork.Cost = 65000.0;
  }

  if (!oncePerFile.has(context.filePath)) {
    oncePerFile.add(context.filePath);
    const x16Prototypes = getX16AttachPrototypes().map((e) => {
      e.Cost *= 10;
      return e;
    });
    extraStructs.push(...x16Prototypes);
  }

  if (fork.entries().length) {
    extraStructs.push(fork);
  }

  return extraStructs;
};

transformAttachPrototypes.files = ["/AttachPrototypes.cfg"];
