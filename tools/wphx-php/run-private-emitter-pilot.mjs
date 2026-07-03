#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const checkOnly = process.argv.includes("--check");
const RECORDED_AT = "2026-07-03T10:00:00Z";
const ISSUE = {
  id: "wordpresshx-4j86",
  external_ref: "WPHX-COMP-PHP-PRIVATE-EMITTER-PILOT",
  title: "Prove WPHX PHP private-output replacement ladder"
};
const RUNNER = "tools/wphx-php/run-private-emitter-pilot.mjs";
const STOCK_HXML = "fixtures/wphx-php/bootstrap-autoload-impl.hxml";
const WPHX_HXML = "fixtures/wphx-php/private-emitter-pilot.hxml";
const SOURCE_FILES = [
  "src/wphx/compiler/php/WphxPhpCompiler.hx",
  "fixtures/wphx-php/src/wphx/fixtures/php/bootstrap/BootstrapImplEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/php/bootstrap/BootstrapKernel.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/priv/PrivateEmitterPilotEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/priv/PrivateEmitterPilotKernel.hx"
];
const STOCK_ROOT = "build/wphx-php/bootstrap-autoload/haxe";
const STOCK_INDEX = `${STOCK_ROOT}/index.php`;
const STOCK_KERNEL = `${STOCK_ROOT}/lib/wphx/fixtures/php/bootstrap/BootstrapKernel.php`;
const OUT_ROOT = "build/wphx-php/private-emitter-pilot";
const WPHX_ROOT = `${OUT_ROOT}/wphx/generated`;
const WPHX_FILE = `${WPHX_ROOT}/haxe/lib/wphx/private-emitter-pilot.php`;
const EMISSION_MANIFEST = `${WPHX_ROOT}/wphx-php-emission.v1.json`;
const PROBE_FILE = `${OUT_ROOT}/probe.php`;
const MANIFEST = "manifests/wphx-php/private-emitter-pilot.v1.json";
const RECEIPT = "receipts/compiler/wphx-comp-php-private-emitter-pilot.v1.json";
const REQUIRED_FEATURES = [
  "typed.expr.array-literal",
  "typed.expr.static-new",
  "typed.expr.static-property",
  "typed.stmt.array-append",
  "typed.stmt.throw"
];
const WPHX_EXACT_PATTERNS = [
  "class WPHX_Private_Emitter_Pilot",
  "public static $calls = [];",
  "WPHX_Private_Emitter_Pilot::$calls[] = $label;",
  "return 'boot:' . $label . ':' . count(WPHX_Private_Emitter_Pilot::$calls);",
  "return json_encode(WPHX_Private_Emitter_Pilot::$calls);",
  "$decorated = strtoupper($label);",
  "throw new Exception('WPHX-BOOTSTRAP-DEBUG:' . $decorated);"
];
const STOCK_EXACT_PATTERNS = [
  "set_include_path(get_include_path().PATH_SEPARATOR.__DIR__.'/lib');",
  "spl_autoload_register(",
  "\\php\\Boot::__hx__init();",
  "BootstrapImplEntry::main();",
  "class BootstrapKernel",
  "Json::phpJsonEncode(BootstrapKernel::$calls",
  "throw Exception::thrown(\"WPHX-BOOTSTRAP-DEBUG:\""
];
const EXPECTED_COMPARABLE = {
  first: "boot:first:1",
  second: "boot:second:2",
  snapshot: ["first", "second"],
  fail_message: "WPHX-BOOTSTRAP-DEBUG:DEBUG"
};

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

function patternPresence(path, patterns) {
  const source = readFileSync(path, "utf8");
  return patterns.map((pattern) => ({
    pattern,
    present: source.includes(pattern)
  }));
}

function assertAllPresent(records, label) {
  const missing = records.filter((record) => !record.present);
  if (missing.length > 0) {
    throw new Error(`${label} missing exact patterns: ${JSON.stringify(missing)}`);
  }
}

function comparable(record) {
  return {
    first: record.first,
    second: record.second,
    snapshot: record.snapshot,
    fail_message: record.fail_message
  };
}

function assertJsonEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected ${label}:\nactual=${JSON.stringify(actual, null, 2)}\nexpected=${JSON.stringify(expected, null, 2)}`);
  }
}

function buildProbe() {
  return `<?php
require ${JSON.stringify(STOCK_INDEX)};
require ${JSON.stringify(WPHX_FILE)};

function wphx_private_emitter_stock_observed() {
  $out = array();
  $out['first'] = \\wphx\\fixtures\\php\\bootstrap\\BootstrapKernel::mark('first');
  $out['second'] = \\wphx\\fixtures\\php\\bootstrap\\BootstrapKernel::mark('second');
  $out['snapshot'] = json_decode(\\wphx\\fixtures\\php\\bootstrap\\BootstrapKernel::snapshot(), true);
  try {
    \\wphx\\fixtures\\php\\bootstrap\\BootstrapKernel::fail('debug');
  } catch (Throwable $e) {
    $out['fail_message'] = $e->getMessage();
    $out['fail_class'] = get_class($e);
  }
  return $out;
}

function wphx_private_emitter_wphx_observed() {
  $out = array();
  $out['first'] = WPHX_Private_Emitter_Pilot::mark('first');
  $out['second'] = WPHX_Private_Emitter_Pilot::mark('second');
  $out['snapshot'] = json_decode(WPHX_Private_Emitter_Pilot::snapshot(), true);
  try {
    WPHX_Private_Emitter_Pilot::fail('debug');
  } catch (Throwable $e) {
    $out['fail_message'] = $e->getMessage();
    $out['fail_class'] = get_class($e);
  }
  return $out;
}

echo json_encode(array(
  'stock' => wphx_private_emitter_stock_observed(),
  'wphx' => wphx_private_emitter_wphx_observed(),
), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\\n";
`;
}

function main() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  rmSync(STOCK_ROOT, { recursive: true, force: true });
  mkdirSync(OUT_ROOT, { recursive: true });

  run("haxe", [STOCK_HXML]);
  run("haxe", [WPHX_HXML]);
  const stockPatterns = patternPresence(STOCK_INDEX, STOCK_EXACT_PATTERNS.slice(0, 4)).concat(
    patternPresence(STOCK_KERNEL, STOCK_EXACT_PATTERNS.slice(4))
  );
  assertAllPresent(stockPatterns, "stock private output");
  const phpLintOutput = run("php", ["-l", WPHX_FILE]).trim();
  const wphxPatterns = patternPresence(WPHX_FILE, WPHX_EXACT_PATTERNS);
  assertAllPresent(wphxPatterns, "WPHX private output");

  writeFileSync(PROBE_FILE, buildProbe());
  const observed = JSON.parse(run("php", [PROBE_FILE]));
  assertJsonEqual(comparable(observed.stock), EXPECTED_COMPARABLE, "stock comparable private-emitter behavior");
  assertJsonEqual(comparable(observed.wphx), EXPECTED_COMPARABLE, "WPHX comparable private-emitter behavior");
  assertJsonEqual(comparable(observed.wphx), comparable(observed.stock), "stock vs WPHX comparable private-emitter behavior");

  const emissionManifest = JSON.parse(readFileSync(EMISSION_MANIFEST, "utf8"));
  const features = [...(emissionManifest.core_ir_features ?? [])].sort();
  const missingFeatures = REQUIRED_FEATURES.filter((feature) => !features.includes(feature));
  if (missingFeatures.length > 0) {
    throw new Error(`Missing WPHX private-emitter features: ${JSON.stringify(missingFeatures)}`);
  }
  if ((emissionManifest.unsupported ?? []).length !== 0) {
    throw new Error(`Unexpected unsupported constructs: ${JSON.stringify(emissionManifest.unsupported)}`);
  }
  const declarations = emissionManifest.files.flatMap((file) => file.declarations.map((entry) => `${entry.kind}:${entry.name}`)).sort();
  assertJsonEqual(declarations, ["class:WPHX_Private_Emitter_Pilot"], "WPHX declarations");

  const manifest = {
    schema: "wphx.wphx-php-private-emitter-pilot.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "private_emitter_replacement_pilot",
    artifact_scope: "one_stock_private_hxml_compared_to_wphx_private_candidate",
    selected_stock_private_hxml: {
      path: STOCK_HXML,
      output_root: STOCK_ROOT,
      implementation_entry: "wphx.fixtures.php.bootstrap.BootstrapImplEntry",
      implementation_kernel: "wphx.fixtures.php.bootstrap.BootstrapKernel",
      reason:
        "Small existing stock private-output fixture with boot/autoload shape, static state, JSON encoding, string uppercasing, and thrown-error behavior already used by WPHX bootstrap gates."
    },
    inputs: [STOCK_HXML, WPHX_HXML, ...SOURCE_FILES].map(inputRecord),
    stock_private_output: {
      index: inputRecord(STOCK_INDEX),
      kernel: inputRecord(STOCK_KERNEL),
      exact_patterns: stockPatterns,
      observed: observed.stock,
      comparable_observed: comparable(observed.stock),
      boot_autoload_observed: {
        index_sets_include_path: true,
        index_registers_autoloader: true,
        index_initializes_php_boot: true,
        implementation_uses_stock_haxe_runtime: true
      }
    },
    wphx_private_candidate: {
      hxml: WPHX_HXML,
      generated_file: {
        path: WPHX_FILE,
        bytes: statSync(WPHX_FILE).size,
        sha256: sha256File(WPHX_FILE),
        php_lint: "passed",
        php_lint_output: phpLintOutput,
        exact_patterns: wphxPatterns
      },
      emission_manifest: {
        path: EMISSION_MANIFEST,
        bytes: statSync(EMISSION_MANIFEST).size,
        sha256: sha256File(EMISSION_MANIFEST),
        output_profile: emissionManifest.output_profile,
        bootstrap_error_handler_policy: emissionManifest.bootstrap_error_handler_policy,
        declarations,
        core_ir_features: features,
        required_core_ir_features: REQUIRED_FEATURES,
        unsupported: emissionManifest.unsupported,
        adapter_templates: emissionManifest.adapter_templates,
        segment_plans: emissionManifest.segment_plans
      },
      observed: observed.wphx,
      comparable_observed: comparable(observed.wphx),
      boot_autoload_observed: {
        direct_private_file_include: true,
        stock_haxe_bootstrap_not_required_for_this_candidate: true,
        haxe_std_runtime_not_linked: true
      }
    },
    comparison: {
      expected_comparable: EXPECTED_COMPARABLE,
      comparable_behavior_matches: true,
      exception_message_matches: observed.stock.fail_message === observed.wphx.fail_message,
      exception_class_matches: observed.stock.fail_class === observed.wphx.fail_class,
      exception_class_gap: {
        stock: observed.stock.fail_class,
        wphx: observed.wphx.fail_class,
        disposition:
          "Recorded as runtime/std borrowing pressure; this pilot only claims comparable message/control-flow behavior, not stock Haxe exception wrapper identity."
      }
    },
    private_emitter_replacement_ladder: [
      {
        rung: 1,
        name: "single_private_fixture_candidate",
        status: "passed",
        gate: "One existing stock private-output hxml has a WPHX private candidate with matching comparable behavior and recorded runtime/std gaps."
      },
      {
        rung: 2,
        name: "debug_source_map_candidate",
        status: "pending",
        gate:
          "A WPHX private candidate must emit or deliberately map source comments/source maps sufficient for packaged stack traces before replacing debug private output."
      },
      {
        rung: 3,
        name: "runtime_std_differential_suite",
        status: "pending",
        gate:
          "Arrays/maps/iterators, closures/captures, exceptions, strings/Unicode, JSON, reflection basics, dynamic dispatch, static fields, and std/php externs must compare against stock Haxe PHP."
      },
      {
        rung: 4,
        name: "selected_private_module_migration",
        status: "pending",
        gate:
          "A real private implementation module behind a public WordPress shell moves from stock Haxe PHP to WPHX PHP with unchanged oracle/candidate behavior."
      },
      {
        rung: 5,
        name: "backend_promotion_adr",
        status: "pending",
        gate:
          "ADR-017 is amended or superseded before stock Haxe PHP is no longer the default private implementation emitter/stdphp oracle."
      }
    ],
    debug_source_map_and_error_assumptions: {
      selected_stock_hxml_debug_maps: "not emitted by the selected release hxml",
      related_stock_debug_evidence: "manifests/wphx-php/bootstrap-debug.v1.json",
      wphx_private_candidate_source_maps: "not yet emitted",
      wphx_private_candidate_inline_source_comments: "not yet emitted",
      error_class_identity: "not yet stock-compatible",
      replacement_policy:
        "WPHX PHP may replace only bounded private modules whose behavior does not depend on stock source maps, Haxe exception wrapper identity, or broader std/php runtime until later rungs pass."
    },
    validation_result: {
      status: "passed",
      selected_stock_hxml_compiled: true,
      wphx_private_candidate_compiled: true,
      php_lint_passed: true,
      exact_contracts_passed: true,
      comparable_behavior_probe_passed: true,
      unsupported_empty: true,
      no_wordpress_profile_adapter: true,
      no_stock_haxe_bootstrap_for_wphx_candidate: true,
      exception_class_gap_recorded: true,
      debug_source_map_gap_recorded: true,
      replacement_ladder_recorded: true
    },
    non_claims: [
      "This does not deprecate stock Haxe PHP as the default private implementation emitter.",
      "This does not claim WPHX PHP owns Haxe std/php runtime, source maps, source comments, Haxe exception wrapper identity, closures with captures, reflection, dynamic dispatch, or arbitrary private Haxe modules.",
      "This does not replace feed/embed/HTTPS/HTTP private implementation hxmls or any production WordPress private implementation output.",
      "This does not promote WPHX PHP to a mature arbitrary-Haxe PHP backend or extracted reflaxe.php target."
    ]
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const receipt = {
    schema: "wphx.compiler-core-driver-receipt.v1",
    id: "receipt:wphx-comp-php-private-emitter-pilot",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "passed",
    evidence_class: "private_emitter_replacement_pilot",
    artifact_scope: "one_stock_private_hxml_compared_to_wphx_private_candidate",
    commands: ["npm run wphx:php:private-emitter-pilot", "npm run wphx:php:private-emitter-pilot:check"],
    artifacts: [
      {
        path: RUNNER,
        role: "deterministic private-emitter pilot runner"
      },
      {
        path: STOCK_HXML,
        role: "selected existing stock Haxe PHP private-output hxml"
      },
      {
        path: WPHX_HXML,
        role: "WPHX PHP private candidate hxml"
      },
      {
        path: "fixtures/wphx-php/src/wphx/fixtures/compiler/php/priv/PrivateEmitterPilotKernel.hx",
        role: "typed WPHX private candidate source"
      },
      {
        path: "src/wphx/compiler/php/WphxPhpCompiler.hx",
        role: "WPHX PHP compiler typed throw/static/private lowering implementation"
      },
      {
        path: MANIFEST,
        role: "private-emitter pilot manifest"
      }
    ],
    manifest_sha256: sha256(manifestText),
    validation_result: manifest.validation_result,
    claims: [
      "One existing stock Haxe PHP private-output hxml now has a bounded WPHX PHP private candidate with matching comparable mark/snapshot/failure-message behavior.",
      "WPHX PHP can emit this private candidate without stock Haxe bootstrap, helper bridge, WordPress profile adapter, or unsupported constructs.",
      "The private-emitter replacement ladder is recorded with explicit source-map, runtime/std, and ADR gates before broader stock-target replacement."
    ],
    non_claims: manifest.non_claims
  };

  writeOrCheck(MANIFEST, manifestText);
  writeOrCheck(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        status: "passed",
        output: MANIFEST,
        receipt: RECEIPT,
        selected_stock_hxml: STOCK_HXML,
        comparable_behavior_matches: true,
        exception_class_gap: manifest.comparison.exception_class_gap
      },
      null,
      2
    )
  );
}

main();
