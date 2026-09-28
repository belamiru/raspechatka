import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Run the real server module with isolated environment, HTTP and database boundaries.
export function loadTypeScript(path, { env = {}, imports = {}, globals = {} } = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loadedModule = { exports: {} };
  runInNewContext(outputText, {
    module: loadedModule, exports: loadedModule.exports, process: { env }, URL, Request, Response, Error,
    require(name) {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
    ...globals,
  }, { filename: path });
  return loadedModule.exports;
}
