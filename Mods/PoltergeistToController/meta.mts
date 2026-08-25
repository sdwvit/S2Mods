import type { SpawnActorPrototype } from "s2cfgtojson";
import type { MetaType, StructTransformer } from "../../src/meta-type.mts";

const transformer: StructTransformer<SpawnActorPrototype> = (struct) => {
  if (struct.SpawnedPrototypeSID !== "Poltergeist") return null;
  const fork = struct.fork();
  fork.SpawnedPrototypeSID = "Controller";
  fork.MeshPath =
    "SkeletalMesh'/Game/_STALKER2/SkeletalMeshes/creatures/controller/SK_Controller_01.SK_controller_01'";
  return fork;
};

transformer.files = [
  "58BD0FF2447FE1DA2E83F69513E764CA.cfg",
  "8F8CCE08456A28B578F618A162E7F079.cfg",
  "48B43F924B6551F450280D8FE78B48FB.cfg",
  "A8CD98FB4ECC4296836B32B6EE4CADBE.cfg",
  "AA0587E94AD606A3CB991DBCAEBC5003.cfg",
  "FD1DD4AE4B2FA43200367B9687DF9E44.cfg",
  "87F18CB243EC048261780EB62B6E43F4.cfg",
  "B8C810AD46DDCE1CA1E74DA39BC0BD6A.cfg",
  "16FD259246106F6D832C06B8451CFF12.cfg",
  "0361CC79417A46775573508D3D1375E8.cfg",
  "E93E5CD141A3CCA974EA56AEE99CA1B5.cfg",
  "BACD38FE4D8AC8E90EC78A8952E52E5E.cfg",
  "BACD38FE4D8AC8E90EC78A8952E52E5E.cfg",
  "537CACFA4DEEA49693974C886FA56198.cfg",
  "C0B35F8A4246AAC8D0DF0087A69A7D5F.cfg",
  "94095DA3413A36966BFFA2941C4E5AD0.cfg",
  "7B17C8054DBA1A31518D60A2EBD61A5C.cfg",
  "8AC2D9E54835DDF54ECF849BF849E89E.cfg",
  "068603CB4E177DDB20D97683FDE7B203.cfg",
  "840439024143B1F7BCB23BB0FEA15767.cfg",
];

export const meta: MetaType<SpawnActorPrototype> = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
Replaces the poltergeist in 
[list]
[*] ANCQ103
[*] E01_MQ01
[*] E02_MQ03_C05
[*] E06_MQ03_C02
[*] E08_MQ03
[*] E08_MQ05
[*] E08_SQ01_S2
[*] E10_MQ01
[*] E11_MQ02
[*] EQ110
[*] EQ110_P
[*] EQ74
[*] EQ85_P
[*] GDEQ1914_BP
[*] GDEQ2104_BP
[*] RSQ10_C01_K_M
[*] SQ03
[*] SQ96_C01
 [/list]
 quests with a controller.
 
 Original idea by Flic

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release",
  structTransformers: [transformer],
};
