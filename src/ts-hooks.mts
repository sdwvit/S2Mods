/**
 * Transpile .ts/.mts through esbuild instead of Node's built-in type-stripper.
 *
 * Node only strips type annotations; it does not do type-directed import
 * elision, so `import { SomeTypeOnlyExport } from "pkg"` becomes a real
 * runtime import and fails with "does not provide an export named ...".
 * esbuild drops imports that are only used in type positions.
 *
 * Usage: node --import ./src/ts-hooks.mts <script>
 */
import { registerHooks } from "node:module";
import { transformSync } from "esbuild";

registerHooks({
  load(url, context, nextLoad) {
    if (!/\.m?ts$/.test(new URL(url).pathname) || url.includes("/node_modules/")) {
      return nextLoad(url, context);
    }
    const result = nextLoad(url, { ...context, format: "module" });
    const source = typeof result.source === "string" ? result.source : Buffer.from(result.source as ArrayBuffer).toString("utf8");
    const { code } = transformSync(source, { loader: "ts", format: "esm", target: "node22", sourcefile: url, sourcemap: "inline" });
    return { ...result, format: "module", source: code };
  },
});
