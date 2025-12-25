import { MeshPrototype, Struct } from "s2cfgtojson";

import { EntriesTransformer } from "../../src/meta-type.mts";

const oncePerFile = new Set<string>();

/**
 * Adds x16 scope mesh prototype.
 */
export const transformMeshPrototypes: EntriesTransformer<MeshPrototype> = async (struct, c) => {
  if (!oncePerFile.has(c.filePath)) {
    oncePerFile.add(c.filePath);
    const extraStructs: MeshPrototype[] = [];
    extraStructs.push(
      new Struct({
        __internal__: {
          rawName: "EN_X16Scope_1",
          isRoot: true,
          refurl: "../MeshPrototypes.cfg",
          refkey: "[0]",
        },
        SID: "EN_X16Scope_1",
        MeshPath: "StaticMesh'/Game/_Stalker_2/weapons/attachments/ss/SM_ss01_en_x16scope_1/SM_ss01_en_x16scope_1.SM_ss01_en_x16scope_1'",
      }) as MeshPrototype,
    );
    extraStructs.push(
      new Struct({
        __internal__: {
          rawName: "UA_X16Scope_1",
          isRoot: true,
          refurl: "../MeshPrototypes.cfg",
          refkey: "[0]",
        },
        SID: "UA_X16Scope_1",
        MeshPath: "StaticMesh'/Game/_Stalker_2/weapons/attachments/ss/SM_ss01_ua_x16scope_1/SM_ua_x16scope.SM_ua_x16scope'",
      }) as MeshPrototype,
    );
    return extraStructs;
  }

  return null;
};

transformMeshPrototypes.files = ["/MeshPrototypes.cfg"];
