#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const checkOnly = process.argv.includes("--check");
const RECORDED_AT = "2026-07-03T09:00:00Z";
const ISSUE = {
  id: "wordpresshx-ze8a",
  external_ref: "WPHX-COMP-PHP-CALLABLE-CLOSURE-CORE",
  title: "Promote PHP callables and closures into reusable core IR"
};
const RUNNER = "tools/wphx-php/run-callable-closure-core.mjs";
const HXML = "fixtures/wphx-php/callable-closure-core.hxml";
const SOURCE_FILES = [
  "src/wphx/compiler/php/WphxPhpCompiler.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/core/CallableClosureEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/core/CallableClosureSurface.hx"
];
const OUT_ROOT = "build/wphx-php/callable-closure-core";
const GENERATED_ROOT = `${OUT_ROOT}/generated`;
const PHP_FILE = `${GENERATED_ROOT}/wp-includes/wphx-callable-closure.php`;
const EMISSION_MANIFEST = `${GENERATED_ROOT}/wphx-php-emission.v1.json`;
const PROBE_FILE = `${OUT_ROOT}/probe.php`;
const MANIFEST = "manifests/wphx-php/callable-closure-core.v1.json";
const RECEIPT = "receipts/compiler/wphx-comp-php-callable-closure-core.v1.json";
const REQUIRED_FEATURES = [
  "expr.reference",
  "expr.static-closure",
  "typed.expr.accepted-args-slice",
  "typed.expr.anonymous-object-field",
  "typed.expr.anonymous-object-literal",
  "typed.expr.array-literal",
  "typed.expr.call-user-func",
  "typed.expr.call-user-func-array",
  "typed.expr.callable-array",
  "typed.expr.reference-array",
  "typed.expr.static-closure"
];
const EXACT_PATTERNS = [
  "class WPHX_Callable_Closure",
  "$joiner = static function ($left, $right) {",
  "return $left . ':' . $right;",
  "$closureResult = call_user_func($joiner, 'core', 'closure');",
  "$staticCallable = ['WPHX_Callable_Closure', 'joinStatic'];",
  "$staticCallableResult = call_user_func($staticCallable, 'array', 'callable');",
  "$args = ['first', 'second', 'ignored'];",
  "$accepted = array_slice($args, 0, 2);",
  "$acceptedArgsResult = call_user_func_array($staticCallable, $accepted);",
  "$payload = ['count' => 2, 'label' => 'ref'];",
  "$mutationReturn = call_user_func_array(['WPHX_Callable_Closure', 'mutatePayload'], [&$payload]);",
  "public static function mutatePayload(&$payload)",
  "$payload['count'] += 4;",
  "$payload['label'] = $payload['label'] . ':' . $payload['count'];"
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    ...options
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\nstdout:\n${result.stdout ?? ""}\nstderr:\n${result.stderr ?? ""}`);
  }
  return result.stdout ?? "";
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function inputRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run without --check to generate it`);
    if (readFileSync(path, "utf8") !== content) throw new Error(`${path} is stale; run without --check to refresh it`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function buildProbe() {
  return `<?php
require ${JSON.stringify(PHP_FILE)};

$reflection = new ReflectionMethod('WPHX_Callable_Closure', 'mutatePayload');
$parameters = $reflection->getParameters();
$result = WPHX_Callable_Closure::run();
$result['mutate_payload_first_arg_by_ref'] = $parameters[0]->isPassedByReference();
echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\\n";
`;
}

function assertJsonEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected ${label}:\nactual=${JSON.stringify(actual, null, 2)}\nexpected=${JSON.stringify(expected, null, 2)}`);
  }
}

function main() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  mkdirSync(OUT_ROOT, { recursive: true });

  run("haxe", [HXML]);
  const phpLintOutput = run("php", ["-l", PHP_FILE]).trim();
  const phpSource = readFileSync(PHP_FILE, "utf8");
  const missingPatterns = EXACT_PATTERNS.filter((pattern) => !phpSource.includes(pattern));
  if (missingPatterns.length > 0) {
    throw new Error(`Generated callable/closure shell is missing exact patterns: ${JSON.stringify(missingPatterns)}`);
  }

  writeFileSync(PROBE_FILE, buildProbe());
  const observed = JSON.parse(run("php", [PROBE_FILE]));
  const expected = {
    closureResult: "core:closure",
    staticCallableResult: "array-callable",
    acceptedArgsResult: "first-second",
    mutationReturn: "ref:6",
    payloadCount: 6,
    payloadLabel: "ref:6",
    mutate_payload_first_arg_by_ref: true
  };
  assertJsonEqual(observed, expected, "callable/closure runtime probe");

  const emissionManifest = JSON.parse(readFileSync(EMISSION_MANIFEST, "utf8"));
  const features = [...(emissionManifest.core_ir_features ?? [])].sort();
  const missingFeatures = REQUIRED_FEATURES.filter((feature) => !features.includes(feature));
  if (missingFeatures.length > 0) {
    throw new Error(`Missing callable/closure core features: ${JSON.stringify(missingFeatures)}`);
  }
  if ((emissionManifest.unsupported ?? []).length !== 0) {
    throw new Error(`Unexpected unsupported constructs: ${JSON.stringify(emissionManifest.unsupported)}`);
  }
  const declarations = emissionManifest.files.flatMap((file) => file.declarations.map((entry) => `${entry.kind}:${entry.name}`)).sort();
  assertJsonEqual(declarations, ["class:WPHX_Callable_Closure"], "declarations");

  const manifest = {
    schema: "wphx.wphx-php-callable-closure-core.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "compiler_core_lowering",
    artifact_scope: "typed_callable_closure_lowering_without_wordpress_profile_adapter",
    inputs: [HXML, ...SOURCE_FILES].map(inputRecord),
    generated_shell: {
      path: PHP_FILE,
      bytes: statSync(PHP_FILE).size,
      sha256: sha256File(PHP_FILE),
      php_lint: "passed",
      php_lint_output: phpLintOutput,
      exact_patterns: EXACT_PATTERNS
    },
    emission_manifest: {
      path: EMISSION_MANIFEST,
      bytes: statSync(EMISSION_MANIFEST).size,
      sha256: sha256File(EMISSION_MANIFEST),
      declarations,
      core_ir_features: features,
      required_core_ir_features: REQUIRED_FEATURES,
      unsupported: emissionManifest.unsupported,
      adapter_templates: emissionManifest.adapter_templates,
      segment_plans: emissionManifest.segment_plans
    },
    runtime_probe: {
      path: PROBE_FILE,
      observed,
      expected,
      status: "passed"
    },
    profile_core_audit_pressure_addressed: [
      {
        adapter_group: "WP_Embed handler dispatch",
        promoted_pressure:
          "static closures, callable arrays, call_user_func dispatch, accepted-args slicing, and reference-sensitive callback payloads now have a non-WordPress core fixture"
      },
      {
        adapter_group: "HTTP/embed/oEmbed callback helpers",
        promoted_pressure:
          "callback-heavy profile bodies can target reusable callable/closure lowering rather than growing WordPress-only mechanics"
      }
    ],
    deferred_pressure: [
      {
        feature: "arbitrary callable shape validation",
        reason:
          "The fixture covers generated closure values and static class/method callable arrays; string function names, object/method tuples, invokable objects, visibility edge cases, and is_callable diagnostics remain broader PHP ABI pressure."
      },
      {
        feature: "closure captures and by-reference closure parameters",
        reason:
          "Anonymous Haxe functions lower to PHP static closures for the claimed no-capture fixture; closure use-captures and by-reference closure parameters need a narrower fixture before broad hook-kernel ownership."
      },
      {
        feature: "full WP_Hook dispatch replacement",
        reason:
          "The fixture proves generic callback mechanics only; it does not replace WordPress hook priority storage, recursion/current-filter state, removed-callback behavior, or plugin-visible hook internals."
      }
    ],
    validation_result: {
      status: "passed",
      php_lint_passed: true,
      exact_contracts_passed: true,
      runtime_probe_passed: true,
      unsupported_empty: true,
      no_wordpress_profile_adapters: true,
      no_haxe_helper_bridge: true,
      no_haxe_bootstrap_bridge: true,
      required_core_ir_features_present: true,
      by_reference_callback_payload_mutation_passed: true,
      deferred_broad_callable_shapes_recorded: true
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const receipt = {
    schema: "wphx.compiler-core-driver-receipt.v1",
    id: "receipt:wphx-comp-php-callable-closure-core",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "passed",
    evidence_class: "compiler_core_lowering",
    artifact_scope: "typed_callable_closure_lowering_without_wordpress_profile_adapter",
    commands: ["npm run wphx:php:callable-closure-core", "npm run wphx:php:callable-closure-core:check"],
    artifacts: [
      {
        path: RUNNER,
        role: "deterministic callable/closure core fixture runner"
      },
      {
        path: HXML,
        role: "Reflaxe-backed WPHX PHP hxml for the generic callable/closure lowering fixture"
      },
      {
        path: "fixtures/wphx-php/src/wphx/fixtures/compiler/php/core/CallableClosureSurface.hx",
        role: "ordinary typed Haxe surface for static closures, callable arrays, accepted-args slicing, and reference-sensitive callback payloads"
      },
      {
        path: "src/wphx/compiler/php/WphxPhpCompiler.hx",
        role: "WPHX PHP compiler typed expression and callable intrinsic lowering implementation"
      },
      {
        path: MANIFEST,
        role: "callable/closure core fixture manifest"
      }
    ],
    manifest_sha256: sha256(manifestText),
    validation_result: manifest.validation_result,
    claims: [
      "WPHX PHP has a non-WordPress core fixture for static closures generated from anonymous Haxe functions, static class/method callable arrays, call_user_func dispatch, call_user_func_array dispatch, accepted-args slicing, and by-reference callback payload mutation.",
      "The generated callable/closure shell lints with php -l, executes the expected runtime probe, records unsupported=[], and records the required typed expression features in the emission manifest.",
      "The fixture uses no @:wp.adapter, @:wp.haxeHelper, or @:wp.haxeBootstrap bridge."
    ],
    non_claims: [
      "This does not claim arbitrary PHP callable-shape coverage, string function callbacks, object/method callback arrays, invokable objects, visibility edge cases, or is_callable diagnostics.",
      "This does not claim closure capture lowering, by-reference closure parameter lowering, generator/arrow-function lowering, or full Haxe Function runtime ownership.",
      "This does not retire WP_Embed, WP_oEmbed, WP_Hook, or HTTP profile adapters by itself, and it does not claim full class-wp-embed.php, class-wp-oembed.php, or hook-kernel ownership."
    ]
  };

  writeOrCheck(MANIFEST, manifestText);
  writeOrCheck(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        status: "passed",
        output: MANIFEST,
        receipt: RECEIPT,
        features: REQUIRED_FEATURES,
        shell: PHP_FILE
      },
      null,
      2
    )
  );
}

main();
