/** Usage: node src/e2e/run.mts <spec files...> */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { suites, fixtures, SkipError } from "./runner.mts";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: node src/e2e/run.mts <spec files...>");
  process.exit(2);
}
for (const f of files) await import(pathToFileURL(path.resolve(f)).href);

let pass = 0, fail = 0, skip = 0;
const secs = (t: number) => `${((Date.now() - t) / 1000).toFixed(1)}s`;

for (const s of suites) {
  if (!s.tests.length) continue;
  if (s.name) console.log(`\n${s.name}`);
  let hookErr: Error | null = null;
  for (const h of s.beforeAll) {
    const t = Date.now();
    try {
      await h(fixtures);
    } catch (e) {
      hookErr = e as Error;
      console.log(`  FAIL beforeAll (${secs(t)})\n       ${hookErr.message}`);
      break;
    }
  }
  for (const tc of s.tests) {
    if (hookErr) {
      fail++;
      console.log(`  FAIL ${tc.name} (beforeAll failed)`);
      continue;
    }
    const t = Date.now();
    try {
      await tc.fn(fixtures);
      pass++;
      console.log(`  PASS ${tc.name} (${secs(t)})`);
    } catch (e) {
      if (e instanceof SkipError) {
        skip++;
        console.log(`  SKIP ${tc.name} (${secs(t)})${e.message ? `: ${e.message}` : ""}`);
      } else {
        fail++;
        console.log(`  FAIL ${tc.name} (${secs(t)})\n       ${(e as Error).message}`);
      }
    }
  }
}
console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped`);
process.exit(fail ? 1 : 0);
