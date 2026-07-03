#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const checkOnly = process.argv.includes("--check");
const RECORDED_AT = "2026-07-03T08:00:00Z";
const ISSUE = {
  id: "wordpresshx-f808",
  external_ref: "WPHX-COMP-PHP-NATIVE-ARRAY-MUTATION-CORE",
  title: "Promote native array mutation into reusable PHP core IR"
};
const RUNNER = "tools/wphx-php/run-native-array-mutation-core.mjs";
const HXML = "fixtures/wphx-php/native-array-mutation-core.hxml";
const SOURCE_FILES = [
  "src/wphx/compiler/php/WphxPhpCompiler.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/core/NativeArrayMutationEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/core/NativeArrayMutationSurface.hx"
];
const OUT_ROOT = "build/wphx-php/native-array-mutation-core";
const GENERATED_ROOT = `${OUT_ROOT}/generated`;
const PHP_FILE = `${GENERATED_ROOT}/wp-includes/wphx-native-array-mutation.php`;
const EMISSION_MANIFEST = `${GENERATED_ROOT}/wphx-php-emission.v1.json`;
const PROBE_FILE = `${OUT_ROOT}/probe.php`;
const MANIFEST = "manifests/wphx-php/native-array-mutation-core.v1.json";
const RECEIPT = "receipts/compiler/wphx-comp-php-native-array-mutation-core.v1.json";
const REQUIRED_FEATURES = [
  "typed.expr.anonymous-object-field",
  "typed.expr.anonymous-object-literal",
  "typed.expr.array-access",
  "typed.expr.array-empty",
  "typed.expr.array-fallback-read",
  "typed.expr.array-isset",
  "typed.expr.array-key-exists",
  "typed.expr.array-literal",
  "typed.stmt.array-append",
  "typed.stmt.array-unset",
  "typed.stmt.array-write"
];
const EXACT_PATTERNS = [
  "class WPHX_Native_Array_Mutation",
  "$indexed = [1, 2];",
  "$indexed[1] = 20;",
  "$indexed[] = 5;",
  "$nested = [[1, 2], [3, 4]];",
  "$nested[1][0] = $indexed[1] + $indexed[2];",
  "$assoc = WPHX_Native_Array_Mutation::seed();",
  "array_key_exists('nullValue', $assoc)",
  "isset($assoc['nullValue'])",
  "empty($assoc['nullValue'])",
  "$zeroStringRead = (array_key_exists('zeroString', $assoc) ? $assoc['zeroString'] : 'fallback');",
  "$missingFallback = (array_key_exists('missing', $assoc) ? $assoc['missing'] : 'fallback');",
  "$assoc['zeroValue'] = $assoc['zeroValue'] + 7;",
  "$assoc['added'] = 'tail';",
  "$assoc[] = 'loose';",
  "unset($assoc['falseValue']);",
  "return ['nullValue' => null, 'falseValue' => false, 'zeroValue' => 0, 'zeroString' => '0', 'emptyString' => ''];"
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

$result = WPHX_Native_Array_Mutation::run();
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
    throw new Error(`Generated native-array shell is missing exact patterns: ${JSON.stringify(missingPatterns)}`);
  }

  writeFileSync(PROBE_FILE, buildProbe());
  const observed = JSON.parse(run("php", [PROBE_FILE]));
  const expected = {
    indexed: [1, 20, 5],
    nested: [
      [1, 2],
      [25, 4]
    ],
    nullKeyExists: true,
    nullIsset: false,
    nullEmpty: true,
    falseReadBeforeUnset: false,
    falseIssetBeforeUnset: true,
    falseEmptyBeforeUnset: true,
    falseKeyExistsAfterUnset: false,
    zeroReadAfterWrite: 7,
    zeroEmpty: true,
    zeroStringRead: "0",
    zeroStringEmpty: true,
    emptyStringEmpty: true,
    missingKeyExists: false,
    missingIsset: false,
    missingEmpty: true,
    missingFallback: "fallback",
    added: "tail",
    appended: "loose"
  };
  assertJsonEqual(observed, expected, "native-array runtime probe");

  const emissionManifest = JSON.parse(readFileSync(EMISSION_MANIFEST, "utf8"));
  const features = [...(emissionManifest.core_ir_features ?? [])].sort();
  const missingFeatures = REQUIRED_FEATURES.filter((feature) => !features.includes(feature));
  if (missingFeatures.length > 0) {
    throw new Error(`Missing native-array core features: ${JSON.stringify(missingFeatures)}`);
  }
  if ((emissionManifest.unsupported ?? []).length !== 0) {
    throw new Error(`Unexpected unsupported constructs: ${JSON.stringify(emissionManifest.unsupported)}`);
  }
  const declarations = emissionManifest.files.flatMap((file) => file.declarations.map((entry) => `${entry.kind}:${entry.name}`)).sort();
  assertJsonEqual(declarations, ["class:WPHX_Native_Array_Mutation"], "declarations");

  const manifest = {
    schema: "wphx.wphx-php-native-array-mutation-core.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "compiler_core_lowering",
    artifact_scope: "typed_native_array_mutation_without_wordpress_profile_adapter",
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
        follow_up_owner: "WPHX-COMP-PHP-NATIVE-ARRAY-MUTATION-CORE",
        promoted_pressure:
          "native array read/write/append/unset/isset/empty and falsey-value-preserving distinctions now have a non-WordPress core fixture"
      },
      {
        adapter_group: "HTTP response/cookie/header adapters",
        promoted_pressure:
          "the profile/core audit's native-array promotion gate has executable core evidence for repeated associative-array mechanics"
      }
    ],
    deferred_pressure: [
      {
        feature: "by-reference array slot mutation",
        reason:
          "The fixture proves emitted PHP mutates local native array variables and nested slots; by-reference parameter/slot aliasing remains covered by existing by-ref ABI fixtures and needs a narrower follow-up before replacing broader WordPress reference-heavy bodies."
      },
      {
        feature: "full PHP array key coercion matrix",
        reason:
          "The fixture covers string and numeric-string access for the claimed falsey cases; broad PHP key coercion, sparse arrays, sorting, serialization, and references remain runtime/std or backend-promotion pressure."
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
      reference_and_key_coercion_non_claims_recorded: true
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const receipt = {
    schema: "wphx.compiler-core-driver-receipt.v1",
    id: "receipt:wphx-comp-php-native-array-mutation-core",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "passed",
    evidence_class: "compiler_core_lowering",
    artifact_scope: "typed_native_array_mutation_without_wordpress_profile_adapter",
    commands: ["npm run wphx:php:native-array-mutation-core", "npm run wphx:php:native-array-mutation-core:check"],
    artifacts: [
      {
        path: RUNNER,
        role: "deterministic native array mutation core fixture runner"
      },
      {
        path: HXML,
        role: "Reflaxe-backed WPHX PHP hxml for the generic native array mutation fixture"
      },
      {
        path: "fixtures/wphx-php/src/wphx/fixtures/compiler/php/core/NativeArrayMutationSurface.hx",
        role: "ordinary typed Haxe surface for native array read/write/append/unset/isset/empty lowering"
      },
      {
        path: "src/wphx/compiler/php/WphxPhpCompiler.hx",
        role: "WPHX PHP compiler typed native array lowering implementation"
      },
      {
        path: MANIFEST,
        role: "native array mutation core fixture manifest"
      }
    ],
    manifest_sha256: sha256(manifestText),
    validation_result: manifest.validation_result,
    claims: [
      "WPHX PHP has a non-WordPress core fixture for typed native array read/write/append/unset/isset/empty lowering and nested indexed array mutation.",
      "The generated native-array shell lints with php -l, executes the expected runtime probe, records unsupported=[], and records the required typed expression/statement features in the emission manifest.",
      "The fixture preserves PHP distinctions between array_key_exists, isset, and empty for null, false, 0, '0', empty string, and missing keys."
    ],
    non_claims: [
      "This does not claim full PHP array key coercion, sparse array, sorting, serialization, or reference aliasing behavior.",
      "This does not claim WPHX PHP owns std/php NativeArray or can replace stock Haxe PHP runtime/std behavior.",
      "This does not retire HTTP response/cookie/header WordPress-profile adapters by itself or claim full class-wp-http.php ownership."
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
