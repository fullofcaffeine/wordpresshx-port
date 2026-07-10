#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const checkOnly = new Set(process.argv.slice(2)).has("--check");
const ISSUE = { id: "wordpresshx-w91.2.3", external_ref: "WPHX-403", title: "WPHX-403 — F8 ts2hx leaf-package spike" };
const RECORDED_AT = "2026-07-10T04:30:00.000Z";
const COMMIT = "98a796c8780c480ef7bcfe03c42302d9564d785c";
const PACKAGE = "@wordpress/escape-html";
const GENES_COMMIT = "b7012fa42bac67dbc08546b5acd29aec6181bdfc";
const BUILD = "build/genes-ts/wphx-403-escape-html";
const MANIFEST = "manifests/genes-ts/wphx-403-f8-escape-html.v1.json";
const RECEIPT = "receipts/genes-ts/wphx-403-f8-escape-html.v1.json";

function run(name, args, options = {}) {
  return execFileSync(name, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 100
  }).trim();
}
function write(path, content) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content); }
function sha(value) { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }
function shaFile(path) { return sha(readFileSync(path)); }
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }).sort();
}
function treeDigest(dir) {
  const records = files(dir).map((path) => ({ path: relative(dir, path), sha256: shaFile(path), bytes: statSync(path).size }));
  return { sha256: sha(JSON.stringify(records)), files: records };
}
function assertNoUnsafeTypes(dir) {
  const matches = [];
  for (const path of files(dir).filter((path) => /\.tsx?$/.test(path))) {
    readFileSync(path, "utf8").split(/\r?\n/).forEach((line, index) => {
      if (/\bas (?:any|unknown)\b|:\s*(?:any|unknown)\b|<\s*(?:any|unknown)\b/.test(line)) matches.push(`${path}:${index + 1}: ${line}`);
    });
  }
  if (matches.length) throw new Error(`unsafe generated user-module types:\n${matches.slice(0, 30).join("\n")}`);
}
function materializeSource() {
  const src = join(BUILD, "oracle-src");
  rmSync(BUILD, { recursive: true, force: true });
  for (const file of ["index.ts", "escape-greater.ts"]) {
    write(join(src, file), `${run("git", ["-C", "../gutenberg", "show", `${COMMIT}:packages/escape-html/src/${file}`])}\n`);
  }
  write(join(src, "Main.ts"), `import __unstableEscapeGreaterThan from "./escape-greater.js";
import { escapeAmpersand, escapeQuotationMark, escapeLessThan, escapeAttribute, escapeHTML, escapeEditableHTML, isValidAttributeName } from "./index.js";
function equal(actual: string | boolean, expected: string | boolean, label: string): void { if (actual !== expected) throw new Error(label + ": expected " + expected + ", got " + actual); }
export function main(): void {
  equal(__unstableEscapeGreaterThan("Chicken > Ribs"), "Chicken &gt; Ribs", "greater");
  equal(escapeAmpersand("foo & bar &amp; &AMP; baz &#931; &#bad; &#x3A3; &#X3a3; &#xevil;"), "foo &amp; bar &amp; &AMP; baz &#931; &amp;#bad; &#x3A3; &#X3a3; &amp;#xevil;", "ampersand");
  equal(escapeQuotationMark("\\\"Be gone!\\\""), "&quot;Be gone!&quot;", "quotation");
  equal(escapeLessThan("Chicken < Ribs"), "Chicken &lt; Ribs", "less");
  equal(escapeAttribute("<&\\\">"), "&lt;&amp;&quot;&gt;", "attribute");
  equal(escapeHTML("<b>A & B</b>"), "&lt;b>A &amp; B&lt;/b>", "html");
  equal(escapeEditableHTML("<a> & &lt;"), "&lt;a> &amp; &amp;lt;", "editable");
  equal(isValidAttributeName("good"), true, "valid-name");
  equal(isValidAttributeName("bad\\u007F"), false, "control-name");
  equal(isValidAttributeName("bad\\uFDD0"), false, "noncharacter-name");
  console.log("F8_ESCAPE_HTML_OK");
}
`);
  write(join(src, "entry.ts"), `import { main } from "./Main.js"; main();\n`);
  write(join(BUILD, "tsconfig.json"), `${JSON.stringify({ compilerOptions: { target: "ES2022", lib: ["ES2022", "DOM"], module: "CommonJS", moduleResolution: "Node", strict: true, noEmitOnError: true, rootDir: "./oracle-src", outDir: "./oracle-dist" }, include: ["oracle-src/**/*.ts"] }, null, 2)}\n`);
}
function compileHaxe(outDir, env) {
  rmSync(outDir, { recursive: true, force: true }); mkdirSync(outDir, { recursive: true });
  run("haxe", ["-lib", "genes-ts", "-cp", join(BUILD, "haxe"), "-main", "wphx_f8_escape_html.Main", "-js", join(outDir, "index.ts"), "-D", "genes.ts"], { env });
}
function execute() {
  const toolchain = JSON.parse(readFileSync("toolchain.lock.json", "utf8"));
  const env = { ...process.env, PATH: `${dirname(toolchain.tools.haxe.executable)}:${process.env.PATH}` };
  if (run("git", ["-C", "../genes", "rev-parse", "HEAD"]) !== GENES_COMMIT) throw new Error("genes-ts checkout does not match WPHX-401 pin");
  materializeSource();
  const tsc = resolve("../genes/node_modules/typescript/bin/tsc");
  run("node", [tsc, "-p", join(BUILD, "tsconfig.json")], { env });
  write(join(BUILD, "oracle-dist/package.json"), '{"type":"commonjs"}\n');
  const oracle = run("node", [resolve(BUILD, "oracle-dist/entry.js")], { env });
  run("yarn", ["--cwd", "tools/ts2hx", "build"], { cwd: resolve("../genes"), env });
  run("node", [resolve("../genes/tools/ts2hx/dist/cli.js"), "--project", resolve(BUILD, "tsconfig.json"), "--out", resolve(BUILD, "haxe"), "--base-package", "wphx_f8_escape_html", "--clean"], { env });
  compileHaxe(join(BUILD, "ts-a"), env); compileHaxe(join(BUILD, "ts-b"), env);
  const first = treeDigest(join(BUILD, "ts-a")); const second = treeDigest(join(BUILD, "ts-b"));
  if (first.sha256 !== second.sha256) throw new Error("genes-ts output is not deterministic");
  assertNoUnsafeTypes(join(BUILD, "ts-a", "wphx_f8_escape_html"));
  write(join(BUILD, "ts-a", "tsconfig.json"), `${JSON.stringify({ compilerOptions: { target: "ES2022", lib: ["ES2022", "DOM"], module: "NodeNext", moduleResolution: "NodeNext", strict: true, noEmitOnError: true, outDir: "../runtime" }, include: ["**/*.ts"] }, null, 2)}\n`);
  run("node", [tsc, "-p", join(BUILD, "ts-a/tsconfig.json")], { env });
  const candidate = run("node", [resolve(BUILD, "runtime/index.js")], { env });
  if (oracle !== "F8_ESCAPE_HTML_OK" || !candidate.includes(oracle)) throw new Error(`runtime mismatch: oracle=${oracle}, candidate=${candidate}`);
  return { oracle_marker: oracle, candidate_marker: oracle, candidate_stdout: candidate, haxe: treeDigest(join(BUILD, "haxe")), generated_ts: first };
}
function writeOrCheck(path, content) {
  if (checkOnly) { if (!existsSync(path) || readFileSync(path, "utf8") !== content) throw new Error(`${path} is missing or stale`); }
  else write(path, content);
}
function main() {
  const result = execute();
  const manifest = { schema: "wphx.genes-ts-f8-leaf-package.v1", issue: ISSUE.external_ref, recorded_at: RECORDED_AT, package: { name: PACKAGE, upstream_commit: COMMIT, source_paths: ["packages/escape-html/src/index.ts", "packages/escape-html/src/escape-greater.ts"], dependencies: 0, exported_functions: 7 }, compiler: { genes_ts_commit: GENES_COMMIT, ts2hx: "experimental", compiler_pressure: { issue: "genes-798", status: "resolved", landed_commit: GENES_COMMIT, generic_constructs: ["module-private declarations referenced by exported code", "RegExp.test", "String.replace with RegExp"], acceptance_gate: "yarn test:ci" } }, pipeline: ["pinned upstream TypeScript", "tsc strict oracle", "ts2hx generated Haxe", "genes-ts generated TypeScript", "tsc strict candidate", "Node differential runtime"], result, validation_result: { status: "passed", strict_types: true, deterministic_output: true, runtime_differential: "pass", unsafe_generated_user_types: 0, compiler_blockers: [] }, non_claims: ["This is one bounded leaf-package feasibility spike, not broad Gutenberg package ownership.", "Generated Haxe is migration evidence; later package ownership requires reviewed idiomatic Haxe source and package-level contracts.", "React/TSX feasibility remains WPHX-404."] };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`; writeOrCheck(MANIFEST, manifestText);
  const receipt = { schema: "wphx.verification-receipt.v1", id: "receipt:wphx-403-f8-escape-html", issue: ISSUE, recorded_at: RECORDED_AT, generator: "tools/genes-ts/run-f8-leaf-package-spike.mjs", evidence_class: "real_leaf_package_roundtrip_feasibility", artifact_scope: "wordpress_escape_html_forward_gutenberg_package", artifacts: [{ path: MANIFEST, role: "F8 roundtrip evidence", sha256: shaFile(MANIFEST) }], verification_commands: ["npm run genes-ts:f8-leaf-package", "npm run genes-ts:f8-leaf-package:check"], validation_result: manifest.validation_result, non_claims: manifest.non_claims };
  writeOrCheck(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`); return manifest;
}
try { const manifest = main(); console.log(JSON.stringify({ status: "passed", check: checkOnly, package: PACKAGE, result: manifest.validation_result }, null, 2)); } catch (error) { console.error(error.stack || error.message); process.exit(1); }
