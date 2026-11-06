/**
 * Unpack, repack and inspect S.T.A.L.K.E.R. 2 .sav files (see save-file.mts).
 *
 *   npm run savefiles -- list   [dir]                  saves, newest first: time, size, name count, file
 *   npm run savefiles -- unpack <sav>... [-o dir]      write <file>.sav.raw next to each save (or into dir)
 *   npm run savefiles -- pack   <raw> -o <sav>         compress a .raw back into a .sav
 *   npm run savefiles -- names  <sav|raw>... [--dump]  name-table count; --dump prints "index<TAB>name"
 *   npm run savefiles -- strings <sav|raw> [-n 6] [--enc ascii|utf16|both] [--grep re] [--offsets]
 *                                                      readable text in the save, in file order
 *   npm run savefiles -- hex    <sav|raw> [--at off] [--length n]
 *                                                      hexdump -C of a range (--at 0x.., --at end-64 = from the end)
 *   npm run savefiles -- diff   <a> <b> [-n 6] [--enc ..] [--grep re]
 *                                                      text only in a ("- ") or only in b ("+ ")
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  compress,
  decompress,
  defaultSavesDir,
  diffStrings,
  extractStrings,
  hexDump,
  nameTable,
  type StringsOptions,
} from "./save-file.mts";

const USAGE = `usage:
  s2sav list [dir]
  s2sav unpack <sav>... [-o dir]
  s2sav pack <raw> -o <sav> [--level N]
  s2sav names <sav|raw>... [--dump]
  s2sav strings <sav|raw> [-n 6] [--enc ascii|utf16|both] [--grep re] [--offsets]
  s2sav hex <sav|raw> [--at offset|end-N] [--length n]
  s2sav diff <a> <b> [-n 6] [--enc ascii|utf16|both] [--grep re]`;

/** Decimal or 0x-prefixed hex; "end-N" (or "-N" as --at=-N) counts back from the end. */
const num = (s: string | undefined, fallback: number) => {
  if (s === undefined) return fallback;
  const neg = s.startsWith("-") || s.startsWith("end-");
  const v = Number(s.replace(/^(end)?-/, ""));
  if (!Number.isFinite(v)) throw new Error(`not a number: ${s}`);
  return neg ? -v : v;
};

const loadRaw = (file: string) =>
  file.endsWith(".raw") ? readFileSync(file) : decompress(readFileSync(file));

const stamp = (d: Date) => {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
};

export function main(argv: string[], log: (s: string) => void = console.log) {
  const [cmd, ...rest] = argv;
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      out: { type: "string", short: "o" },
      dump: { type: "boolean" },
      level: { type: "string" },
      n: { type: "string", short: "n" },
      enc: { type: "string" },
      grep: { type: "string" },
      offsets: { type: "boolean" },
      at: { type: "string" },
      length: { type: "string" },
    },
  });
  const enc = values.enc ?? "both";
  if (!["ascii", "utf16", "both"].includes(enc))
    throw new Error(`--enc must be ascii, utf16 or both`);
  const strOpts: StringsOptions = {
    min: num(values.n, 6),
    encoding: enc as StringsOptions["encoding"],
  };
  const re = values.grep ? new RegExp(values.grep, "i") : undefined;
  const one = () => {
    if (positionals.length !== 1) throw new Error(USAGE);
    return loadRaw(positionals[0]);
  };
  switch (cmd) {
    case "list": {
      const dir = positionals[0] ?? defaultSavesDir();
      if (!dir) throw new Error("no saves dir: pass one, or set STALKER2_FOLDER");
      const files = readdirSync(dir)
        .filter((f) => f.endsWith(".sav"))
        .map((f) => ({ f, st: statSync(path.join(dir, f)) }))
        .sort((a, b) => b.st.mtimeMs - a.st.mtimeMs);
      for (const { f, st } of files) {
        let count: string;
        try {
          const t = nameTable(decompress(readFileSync(path.join(dir, f))));
          count = t ? String(t.names.length) : "no table";
        } catch (e) {
          count = `error: ${(e as Error).message}`;
        }
        log(`${stamp(st.mtime)}  ${String(st.size).padStart(10)}  ${count.padStart(8)}  ${f}`);
      }
      return;
    }
    case "unpack":
      for (const file of positionals) {
        const outDir = values.out ?? path.dirname(path.resolve(file));
        mkdirSync(outDir, { recursive: true });
        const raw = decompress(readFileSync(file));
        const dst = path.join(outDir, `${path.basename(file)}.raw`);
        writeFileSync(dst, raw);
        log(`${dst}  ${raw.length} bytes`);
      }
      return;
    case "pack": {
      if (positionals.length !== 1 || !values.out) throw new Error(USAGE);
      const sav = compress(
        readFileSync(positionals[0]),
        values.level ? Number(values.level) : undefined,
      );
      writeFileSync(values.out, sav);
      log(`${values.out}  ${sav.length} bytes`);
      return;
    }
    case "names":
      for (const file of positionals) {
        const t = nameTable(loadRaw(file));
        if (!t) {
          log(`${path.basename(file)}  no name table found`);
          continue;
        }
        log(`${path.basename(file)}  ${t.names.length} names at 0x${t.offset.toString(16)}`);
        if (values.dump) t.names.forEach((s, i) => log(`${i}\t${s}`));
      }
      return;
    case "strings":
      for (const s of extractStrings(one(), strOpts)) {
        if (re && !re.test(s.text)) continue;
        log(
          values.offsets
            ? `${s.offset.toString(16).padStart(8, "0")} ${s.encoding === "utf16" ? "u" : "a"} ${s.text}`
            : s.text,
        );
      }
      return;
    case "hex":
      hexDump(one(), num(values.at, 0), num(values.length, 256)).forEach((l) => log(l));
      return;
    case "diff": {
      if (positionals.length !== 2) throw new Error(USAGE);
      const { onlyA, onlyB } = diffStrings(
        loadRaw(positionals[0]),
        loadRaw(positionals[1]),
        strOpts,
      );
      for (const s of onlyA) if (!re || re.test(s)) log(`- ${s}`);
      for (const s of onlyB) if (!re || re.test(s)) log(`+ ${s}`);
      return;
    }
    default:
      throw new Error(USAGE);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
