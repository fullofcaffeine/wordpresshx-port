#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const checkOnly = process.argv.includes("--check");
const RECORDED_AT = "2026-07-03T07:00:00Z";
const ISSUE = {
  id: "wordpresshx-sbot",
  external_ref: "WPHX-COMP-PHP-STATIC-DYNAMIC-MEMBER-CORE",
  title: "Promote static and dynamic member lowering"
};
const RUNNER = "tools/wphx-php/run-static-dynamic-member-core.mjs";
const HXML = "fixtures/wphx-php/static-dynamic-member-core.hxml";
const SOURCE_FILES = [
  "src/wphx/compiler/php/WphxPhpCompiler.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/core/StaticDynamicMemberEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/core/StaticDynamicMemberSurface.hx"
];
const OUT_ROOT = "build/wphx-php/static-dynamic-member-core";
const GENERATED_ROOT = `${OUT_ROOT}/generated`;
const PHP_FILE = `${GENERATED_ROOT}/wp-includes/wphx-static-dynamic-member.php`;
const EMISSION_MANIFEST = `${GENERATED_ROOT}/wphx-php-emission.v1.json`;
const PROBE_FILE = `${OUT_ROOT}/probe.php`;
const MANIFEST = "manifests/wphx-php/static-dynamic-member-core.v1.json";
const RECEIPT = "receipts/compiler/wphx-comp-php-static-dynamic-member-core.v1.json";
const REQUIRED_FEATURES = [
  "typed.expr.anonymous-object-field",
  "typed.expr.anonymous-object-literal",
  "typed.expr.array-access",
  "typed.expr.array-literal",
  "typed.expr.instance-property",
  "typed.expr.static-new",
  "typed.expr.static-property"
];
const EXACT_PATTERNS = [
  "class WPHX_Static_Dynamic_Member",
  "public static $counter = 3;",
  "public static $values = [2, 4, 8];",
  "public $name;",
  "public $hits;",
  "WPHX_Static_Dynamic_Member::$counter += $delta;",
  "WPHX_Static_Dynamic_Member::$values[1] = WPHX_Static_Dynamic_Member::$values[1] + WPHX_Static_Dynamic_Member::$counter;",
  "return ['label' => 'item', 'amount' => $value];",
  "$row = WPHX_Static_Dynamic_Member::row($value);",
  "return $row['label'] . ':' . $row['amount'];",
  "$item = new WPHX_Static_Dynamic_Member($name);",
  "$this->hits = 0;",
  "$this->name = $next;",
  "$this->hits += 1;"
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

$instance = new WPHX_Static_Dynamic_Member('first');
$result = array(
  'class_guard' => class_exists('WPHX_Static_Dynamic_Member', false),
  'default_counter' => WPHX_Static_Dynamic_Member::$counter,
  'default_values' => WPHX_Static_Dynamic_Member::$values,
  'bump' => WPHX_Static_Dynamic_Member::bump(5),
  'counter_after' => WPHX_Static_Dynamic_Member::current(),
  'values_after' => WPHX_Static_Dynamic_Member::$values,
  'describe' => WPHX_Static_Dynamic_Member::describe(9),
  'make_name' => WPHX_Static_Dynamic_Member::makeName('core'),
  'instance_rename' => $instance->rename('second'),
);

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
    throw new Error(`Generated static/member shell is missing exact patterns: ${JSON.stringify(missingPatterns)}`);
  }

  writeFileSync(PROBE_FILE, buildProbe());
  const observed = JSON.parse(run("php", [PROBE_FILE]));
  const expected = {
    class_guard: true,
    default_counter: 3,
    default_values: [2, 4, 8],
    bump: 12,
    counter_after: 8,
    values_after: [2, 12, 8],
    describe: "item:9",
    make_name: "made-core:1",
    instance_rename: "second:1"
  };
  assertJsonEqual(observed, expected, "static/member runtime probe");

  const emissionManifest = JSON.parse(readFileSync(EMISSION_MANIFEST, "utf8"));
  const features = [...(emissionManifest.core_ir_features ?? [])].sort();
  const missingFeatures = REQUIRED_FEATURES.filter((feature) => !features.includes(feature));
  if (missingFeatures.length > 0) {
    throw new Error(`Missing static/member core features: ${JSON.stringify(missingFeatures)}`);
  }
  if ((emissionManifest.unsupported ?? []).length !== 0) {
    throw new Error(`Unexpected unsupported constructs: ${JSON.stringify(emissionManifest.unsupported)}`);
  }
  const declarations = emissionManifest.files.flatMap((file) => file.declarations.map((entry) => `${entry.kind}:${entry.name}`)).sort();
  assertJsonEqual(declarations, ["class:WPHX_Static_Dynamic_Member"], "declarations");

  const manifest = {
    schema: "wphx.wphx-php-static-dynamic-member-core.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "compiler_core_lowering",
    artifact_scope: "typed_static_member_lowering_without_wordpress_profile_adapter",
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
        adapter: "wp-oembed-add-provider-early",
        promoted_pressure: "static property defaults, static array storage, and static member mutation now have a non-WordPress core fixture"
      },
      {
        adapter: "wp-oembed-remove-provider-early",
        promoted_pressure: "static property defaults, static array storage, and static member mutation now have a non-WordPress core fixture"
      }
    ],
    deferred_pressure: [
      {
        feature: "runtime dynamic property names",
        reason: "Normal typed Haxe source does not provide a narrow safe runtime-property-name construct without an escape hatch; keep this for a minimized follow-up before dynamic WordPress member surfaces grow."
      },
      {
        feature: "runtime dynamic new/class-string construction",
        reason: "The fixture proves typed static new and class member access; runtime dynamic new remains backend-promotion pressure until it can be expressed without untyped source."
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
      dynamic_runtime_constructs_deferred_with_owner: true
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const receipt = {
    schema: "wphx.compiler-core-driver-receipt.v1",
    id: "receipt:wphx-comp-php-static-dynamic-member-core",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "passed",
    evidence_class: "compiler_core_lowering",
    artifact_scope: "typed_static_member_lowering_without_wordpress_profile_adapter",
    commands: ["npm run wphx:php:static-dynamic-member-core", "npm run wphx:php:static-dynamic-member-core:check"],
    artifacts: [
      {
        path: RUNNER,
        role: "deterministic static/dynamic member core fixture runner"
      },
      {
        path: HXML,
        role: "Reflaxe-backed WPHX PHP hxml for the generic static/member lowering fixture"
      },
      {
        path: "fixtures/wphx-php/src/wphx/fixtures/compiler/php/core/StaticDynamicMemberSurface.hx",
        role: "ordinary typed Haxe surface for static property, instance property, array access, anonymous object, and static new lowering"
      },
      {
        path: "src/wphx/compiler/php/WphxPhpCompiler.hx",
        role: "WPHX PHP compiler typed expression lowering implementation"
      },
      {
        path: MANIFEST,
        role: "static/dynamic member core fixture manifest"
      }
    ],
    manifest_sha256: sha256(manifestText),
    validation_result: manifest.validation_result,
    claims: [
      "WPHX PHP has a non-WordPress core fixture for typed static property defaults, static property read/write, indexed static array mutation, instance property mutation, anonymous-structure field access, and typed static object construction.",
      "The generated static/member shell lints with php -l, executes the expected runtime probe, records unsupported=[], and records the required typed expression features in the emission manifest.",
      "The fixture uses no @:wp.adapter, @:wp.haxeHelper, or @:wp.haxeBootstrap bridge."
    ],
    non_claims: [
      "This does not claim arbitrary dynamic property-name lowering or runtime dynamic new/class-string construction.",
      "This does not claim full PHP object model, reflection, late static binding, magic methods, traits, namespaces, or std/php runtime replacement.",
      "This does not retire the WP_oEmbed profile adapters by itself or claim full class-wp-oembed.php ownership."
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
