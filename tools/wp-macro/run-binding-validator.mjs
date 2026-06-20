#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const checkOnly = process.argv.includes("--check");
const OUT = "manifests/wp-macro/wphx-202-binding-validator.v1.json";
const RECEIPT = "receipts/wp-macro/wphx-202-binding-validator.v1.json";
const RECORDED_AT = "2026-06-20T06:05:00.000Z";

const cases = [
  {
    id: "valid-bindings",
    hxml: "fixtures/wp-macro/valid-bindings.hxml",
    expect: "success",
    contains: "wphx-wp-macro-valid"
  },
  {
    id: "invalid-ambiguous-global",
    hxml: "fixtures/wp-macro/invalid-ambiguous-global.hxml",
    expect: "failure",
    contains:
      'WPHX-202: :wp.global("add_filter") is ambiguous; add a source path. Candidates: src/wp-admin/includes/noop.php, src/wp-includes/plugin.php'
  },
  {
    id: "invalid-arity",
    hxml: "fixtures/wp-macro/invalid-arity.hxml",
    expect: "failure",
    contains: 'WPHX-202: :wp.global("add_filter", "src/wp-includes/plugin.php") expects 2..4 parameters, got 1'
  },
  {
    id: "invalid-kind",
    hxml: "fixtures/wp-macro/invalid-kind.hxml",
    expect: "failure",
    contains: 'WPHX-202: :wp.class("add_filter") expected ABI kind class, found function'
  },
  {
    id: "invalid-missing",
    hxml: "fixtures/wp-macro/invalid-missing.hxml",
    expect: "failure",
    contains: 'WPHX-202: :wp.global("wphx_definitely_missing") did not match any ABI entry'
  },
  {
    id: "invalid-static-global",
    hxml: "fixtures/wp-macro/invalid-static-global.hxml",
    expect: "failure",
    contains: 'WPHX-202: :wp.global("add_filter", "src/wp-includes/plugin.php") must annotate a static function'
  }
];

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return {
    command: [command, ...args].join(" "),
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    combined: `${result.stdout}${result.stderr}`
  };
}

const haxeVersion = run("haxe", ["--version"]).stdout.trim();
const results = cases.map((testCase) => {
  const result = run("haxe", [testCase.hxml]);
  const passed =
    testCase.expect === "success"
      ? result.status === 0 && result.combined.includes(testCase.contains)
      : result.status !== 0 && result.combined.includes(testCase.contains);
  return {
    id: testCase.id,
    hxml: testCase.hxml,
    expect: testCase.expect,
    expected_diagnostic: testCase.contains,
    status: result.status,
    passed,
    stdout_sha256: sha256(result.stdout),
    stderr_sha256: sha256(result.stderr)
  };
});

const failures = results.filter((result) => !result.passed);
if (failures.length > 0) {
  console.error(JSON.stringify({ status: "failed", failures }, null, 2));
  process.exit(1);
}

const manifest = {
  schema: "wphx.wp-macro-binding-validator.v1",
  issue: "WPHX-202",
  generated_at: RECORDED_AT,
  generator: "tools/wp-macro/run-binding-validator.mjs",
  validator: "src/wphx/wp/macros/BindingValidator.hx",
  abi_manifest: "manifests/php-abi/wordpress-7.0-core-abi.v1.json",
  haxe_version: haxeVersion,
  fixture_sources: [
    "fixtures/wp-macro/src/wphx/fixtures/wp/macro/ValidBindings.hx",
    "fixtures/wp-macro/src/wphx/fixtures/wp/macro/InvalidAmbiguousGlobal.hx",
    "fixtures/wp-macro/src/wphx/fixtures/wp/macro/InvalidArity.hx",
    "fixtures/wp-macro/src/wphx/fixtures/wp/macro/InvalidKind.hx",
    "fixtures/wp-macro/src/wphx/fixtures/wp/macro/InvalidMissing.hx",
    "fixtures/wp-macro/src/wphx/fixtures/wp/macro/InvalidStaticGlobal.hx"
  ],
  results,
  validation_result: {
    status: "passed",
    cases: results.length,
    valid_binding_compiles: true,
    invalid_bindings_fail_compilation: true,
    deterministic_diagnostics: true
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const receipt = {
  schema: "wphx.wp-macro-binding-validator-receipt.v1",
  id: "receipt:wphx-202-binding-validator",
  issue: "WPHX-202",
  recorded_at: RECORDED_AT,
  command: "npm run wp:macro:bindings",
  status: "passed",
  manifest: OUT,
  manifest_sha256: sha256(manifestText),
  validator: manifest.validator,
  abi_manifest: manifest.abi_manifest,
  haxe_version: haxeVersion,
  cases: results.length
};
const receiptText = JSON.stringify(receipt, null, 2) + "\n";

if (checkOnly) {
  for (const [path, text] of [
    [OUT, manifestText],
    [RECEIPT, receiptText]
  ]) {
    if (!existsSync(path)) {
      console.error(JSON.stringify({ status: "failed", error: `${path} does not exist` }, null, 2));
      process.exit(1);
    }
    if (readFileSync(path, "utf8") !== text) {
      console.error(JSON.stringify({ status: "failed", error: `${path} is stale` }, null, 2));
      process.exit(1);
    }
  }
  console.log(JSON.stringify({ status: "passed", output: OUT, receipt: RECEIPT, cases: results.length }, null, 2));
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
mkdirSync(dirname(RECEIPT), { recursive: true });
writeFileSync(OUT, manifestText);
writeFileSync(RECEIPT, receiptText);
console.log(JSON.stringify({ status: "passed", output: OUT, receipt: RECEIPT, cases: results.length }, null, 2));
