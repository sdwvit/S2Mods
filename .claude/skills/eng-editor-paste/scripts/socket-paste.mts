/**
 * Print a skeleton's sockets as the editor's socket clipboard text, ready to Ctrl+V onto a bone.
 *
 *   node .claude/skills/eng-editor-paste/scripts/socket-paste.mts <SKEL.uasset> [baseline.uasset]
 *
 * With a baseline, only sockets whose name is missing from it are printed - pass the vanilla
 * checkout to recover what a mod added. Reads both the legacy (UE5 1008, 5.1 SDK) and the
 * complete-type-name (1012+, 2.0 SDK) property tag formats.
 */
import { readFileSync } from "node:fs";
import { parseUasset, RAW_BYTES } from "../../../../src/localization/uasset.mts";

type Socket = { object: string; SocketName: string; BoneName: string; loc: number[]; rot: number[]; scale: number[] };

const triple = (b: Buffer, at = 0) => [0, 8, 16].map((o) => b.readDoubleLE(at + o));

/** Legacy tags: Name, Type, Size, ArrayIndex, type-specific header, HasGuid. parseUasset skips these. */
function legacySocket(buf: Buffer, names: string[], start: number, end: number): Record<string, any> {
  let pos = start;
  const i32 = () => ((pos += 4), buf.readInt32LE(pos - 4));
  const name = () => {
    const i = buf.readUInt32LE(pos), n = buf.readUInt32LE(pos + 4);
    pos += 8;
    return n ? `${names[i]}_${n - 1}` : names[i];
  };
  const p: Record<string, any> = {};
  while (pos < end) {
    const n = name();
    if (n === "None") break;
    const t = name(), size = i32();
    i32();
    let struct = "";
    if (t === "StructProperty") (struct = name()), (pos += 16);
    else if (t === "BoolProperty") p[n] = buf[pos++];
    else if (["ByteProperty", "EnumProperty", "ArrayProperty", "SetProperty"].includes(t)) name();
    if (buf[pos++]) pos += 16;
    const at = pos;
    if (t === "NameProperty") p[n] = name();
    else if (struct === "Vector" || struct === "Rotator") p[n] = triple(buf, at);
    pos = at + size;
  }
  return p;
}

function readSockets(file: string): Socket[] {
  const a = parseUasset(file);
  const buf = readFileSync(file);
  return a.exports
    .filter((e) => e.className === "SkeletalMeshSocket")
    .map((e) => {
      let p: Record<string, any>;
      if (a.summary.fileVersionUE5 >= 1012) {
        p = { ...(e.properties ?? {}) };
        for (const k of ["RelativeLocation", "RelativeRotation", "RelativeScale"])
          if (p[k]?.[RAW_BYTES]) p[k] = triple(Buffer.from(p[k][RAW_BYTES], "hex"));
      } else p = legacySocket(buf, a.names, e.serialOffset, e.serialOffset + e.serialSize);
      return {
        object: e.objectName,
        SocketName: p.SocketName,
        BoneName: p.BoneName,
        loc: p.RelativeLocation ?? [0, 0, 0],
        rot: p.RelativeRotation ?? [0, 0, 0],
        scale: p.RelativeScale ?? [1, 1, 1],
      };
    });
}

const [file, baseline] = process.argv.slice(2);
if (!file) throw new Error("usage: socket-paste.mts <SKEL.uasset> [baseline.uasset]");
const skip = new Set(baseline ? readSockets(baseline).map((s) => s.SocketName) : []);
const sockets = readSockets(file).filter((s) => !skip.has(s.SocketName));
const f = (x: number) => String(+x.toFixed(6));
const v = ([x, y, z]: number[]) => `(X=${f(x)},Y=${f(y)},Z=${f(z)})`;
console.log(
  [
    "SocketCopyPasteBuffer",
    `NumSockets=${sockets.length}`,
    ...sockets.map(
      (s) => `IsOnSkeleton=1
Begin Object Class=/Script/Engine.SkeletalMeshSocket Name="${s.object}"
   SocketName="${s.SocketName}"
   BoneName="${s.BoneName}"
   RelativeLocation=${v(s.loc)}
   RelativeRotation=(Pitch=${f(s.rot[0])},Yaw=${f(s.rot[1])},Roll=${f(s.rot[2])})
   RelativeScale=${v(s.scale)}
End Object`,
    ),
  ].join("\n"),
);
