#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const checkOnly = process.argv.includes("--check");
const RECORDED_AT = "2026-07-02T21:00:00Z";
const ISSUE = {
  id: "wordpresshx-w91.24.5",
  external_ref: "WPHX-COMP-PHP-ADOPTION-CI",
  title: "Define usable-compiler quality gate for parallel Core work"
};
const RUNNER = "tools/wphx-php/run-adoption-ci.mjs";
const MANIFEST = "manifests/ci/wphx-php-adoption-ci.v1.json";
const RECEIPT = "receipts/compiler/wphx-comp-php-adoption-ci.v1.json";

const REQUIRED_NPM_CHECKS = [
  "wphx:php:gap-inventory:check",
  "wphx:php:adapter-raw-blocks:check",
  "wphx:php:public-shell-snapshots:check",
  "wphx:php:runtime-stdlib-strategy:check",
  "wphx:php:core-lowering-pilot:check",
  "wphx:php:whole-file-class-http:check",
  "wphx:php:bootstrap-autoload:check",
  "wphx:php:bootstrap-error-handler:check",
  "wphx:php:bootstrap-debug:check",
  "wphx:php:embed-module-functions:check",
  "wphx:php:https-module-functions:check"
];

const MANIFESTS = {
  gapInventory: "manifests/wphx-php/compiler-gap-inventory.v1.json",
  rawBlockPolicy: "manifests/wphx-php/adapter-raw-block-policy.v1.json",
  publicShellSnapshots: "manifests/wphx-php/public-shell-snapshots.v1.json",
  runtimeStdlibStrategy: "manifests/wphx-php/runtime-stdlib-strategy.v1.json",
  coreLoweringPilot: "manifests/wphx-php/core-lowering-pilot.v1.json",
  wholeFilePilot: "manifests/wphx-php/whole-file-class-http.v1.json",
  bootstrapAutoload: "manifests/wphx-php/bootstrap-autoload.v1.json",
  bootstrapErrorHandler: "manifests/wphx-php/bootstrap-error-handler.v1.json",
  bootstrapDebug: "manifests/wphx-php/bootstrap-debug.v1.json",
  embedModuleFunctions: "manifests/wphx-php/embed-module-functions.v1.json",
  httpsModuleFunctions: "manifests/wphx-php/https-module-functions.v1.json"
};

function runNpm(script) {
  const result = spawnSync("npm", ["run", script], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`npm run ${script} failed\nstdout:\n${result.stdout ?? ""}\nstderr:\n${result.stderr ?? ""}`);
  }
  return {
    command: `npm run ${script}`,
    status: "passed",
    stdout_sha256: sha256(result.stdout ?? ""),
    stderr_sha256: sha256(result.stderr ?? "")
  };
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function fileRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function expect(condition, message, failures) {
  if (!condition) failures.push(message);
}

function expectValidationPassed(name, manifest, failures) {
  expect(manifest.validation_result?.status === "passed", `${name} validation_result.status is not passed`, failures);
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

function main() {
  const commandResults = REQUIRED_NPM_CHECKS.map(runNpm);
  const manifests = Object.fromEntries(Object.entries(MANIFESTS).map(([key, path]) => [key, readJson(path)]));
  const failures = [];

  for (const [name, manifest] of Object.entries(manifests)) {
    expectValidationPassed(name, manifest, failures);
  }

  const gap = manifests.gapInventory.validation_result;
  expect(gap.wphx_hxml_count >= 27, "gap inventory must see at least 27 WPHX PHP hxmls", failures);
  expect(gap.stock_haxe_php_hxml_count === 12, "stock Haxe PHP fallback hxml count must remain exactly 12 until deliberately moved", failures);
  expect(gap.reflaxe_backed_wphx_hxml_count === gap.wphx_hxml_count, "all WPHX PHP hxmls must be Reflaxe-backed", failures);
  expect(gap.php_raw_block_count === 0, "WordPress profile must have zero PhpRawBlock occurrences", failures);
  expect(gap.render_template_call_count === 0, "WordPress profile must have zero active renderTemplate calls", failures);
  expect(gap.manifest_count >= 14, "gap inventory must see at least 14 passing WPHX PHP evidence manifests", failures);
  expect(gap.manifest_statuses_passed === true, "all WPHX PHP evidence manifests must have passed status", failures);

  const raw = manifests.rawBlockPolicy.validation_result;
  expect(raw.inline_raw_blocks_forbidden === true, "inline public raw PHP bodies must be forbidden", failures);
  expect(raw.template_count === 0, "active adapter template count must be zero", failures);
  expect(raw.every_rendered_template_php_lints === true, "any rendered adapter template must lint", failures);

  const snapshots = manifests.publicShellSnapshots;
  const snapshotValidation = snapshots.validation_result;
  expect(snapshotValidation.case_count >= 19, "public shell snapshots must cover at least 19 cases", failures);
  for (const key of [
    "all_selected_outputs_byte_stable",
    "php_lint_passed",
    "exact_contracts_passed",
    "ast_contracts_passed",
    "segment_plan_contracts_passed",
    "unsupported_empty"
  ]) {
    expect(snapshotValidation[key] === true, `public-shell snapshots must pass ${key}`, failures);
  }
  for (const key of [
    "global_function",
    "wordpress_module_function",
    "public_class",
    "public_interface",
    "protected_method",
    "by_reference_parameter",
    "conditional_declaration",
    "native_array_mutation",
    "top_level_bootstrap_side_effect",
    "include_return_or_direct_file_scope_script",
    "template_segment_shell",
    "nested_template_segment_shell",
    "typed_statement_lowering",
    "whole_file_owned",
    "segment_plan_metadata"
  ]) {
    expect(snapshots.shell_shape_coverage?.[key] === true, `public-shell snapshots must cover ${key}`, failures);
  }

  for (const [name, key] of [
    ["core lowering", "coreLoweringPilot"],
    ["whole-file pilot", "wholeFilePilot"]
  ]) {
    const result = manifests[key].validation_result;
    expect(result.unsupported_empty === true, `${name} must have unsupported=[]`, failures);
    expect(result.no_haxe_bootstrap_bridge === true, `${name} must avoid Haxe bootstrap bridge`, failures);
    expect(result.no_haxe_helper_bridge === true, `${name} must avoid Haxe helper bridge`, failures);
  }

  const runtime = manifests.runtimeStdlibStrategy.validation_result;
  for (const key of [
    "release_probe_passed",
    "debug_probe_passed",
    "stock_reference_files_available",
    "boot_shape_observed",
    "arrays_maps_iterators_observed",
    "closures_observed",
    "exceptions_observed",
    "strings_json_observed",
    "source_debug_observed"
  ]) {
    expect(runtime[key] === true, `runtime/std strategy must pass ${key}`, failures);
  }

  for (const [name, key, required] of [
    ["bootstrap autoload", "bootstrapAutoload", ["haxe_lib_path_appended_once", "repeated_require_idempotent", "shared_bootstrap_constant_idempotent_across_shells", "autoloader_appended_after_existing_loader", "php_boot_loaded_after_bootstrap", "implementation_delegation_worked"]],
    ["bootstrap error handler", "bootstrapErrorHandler", ["emitted_wordpress_profile_defines_custom_error_handler", "emitted_wordpress_profile_preserves_php_warning_behavior", "existing_handler_is_preserved", "emitted_wordpress_profile_preserves_error_reporting", "stock_control_installs_throwing_handler", "stock_control_mutates_error_reporting"]],
    ["bootstrap debug", "bootstrapDebug", ["debug_profile_has_source_map", "parity_profile_has_source_map", "release_profile_omits_source_map", "all_profiles_map_user_haxe_frame_from_comments", "all_profiles_preserve_original_path_shell_frame", "all_profiles_have_empty_unsupported_manifests"]]
  ]) {
    const result = manifests[key].validation_result;
    for (const item of required) expect(result[item] === true, `${name} must pass ${item}`, failures);
  }

  const validationResult = {
    status: failures.length === 0 ? "passed" : "failed",
    failures,
    required_check_count: REQUIRED_NPM_CHECKS.length,
    required_checks_passed: failures.length === 0,
    generated_php_quality_gate_passed: failures.length === 0,
    unsupported_empty_for_claimed_boundaries: failures.length === 0,
    raw_block_and_template_debt_clear:
      gap.php_raw_block_count === 0 &&
      manifests.rawBlockPolicy.php_raw_block_count === 0 &&
      raw.template_count === 0 &&
      raw.render_template_call_count === 0,
    public_shell_snapshot_gate_passed: snapshotValidation.status === "passed",
    runtime_stdlib_bootstrap_debug_gate_passed:
      runtime.status === "passed" &&
      manifests.bootstrapAutoload.validation_result.status === "passed" &&
      manifests.bootstrapErrorHandler.validation_result.status === "passed" &&
      manifests.bootstrapDebug.validation_result.status === "passed",
    stock_fallback_surfaces_bounded: gap.stock_haxe_php_hxml_count === 12,
    parallel_core_port_work_unblocked: failures.length === 0
  };

  if (failures.length > 0) {
    throw new Error(`WPHX PHP adoption CI failed:\n${failures.join("\n")}`);
  }

  const manifest = {
    schema: "wphx.wphx-php-adoption-ci.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "compiler_adoption_ci",
    artifact_scope: "wphx_php_usable_compiler_gate",
    required_checks: commandResults,
    evidence_manifests: Object.values(MANIFESTS).map(fileRecord),
    summary: {
      wphx_hxml_count: gap.wphx_hxml_count,
      stock_haxe_php_fallback_hxml_count: gap.stock_haxe_php_hxml_count,
      wphx_evidence_manifest_count: gap.manifest_count,
      public_shell_snapshot_case_count: snapshotValidation.case_count,
      wordpress_profile_method_adapter_count: manifests.gapInventory.summary.method_adapter_registry_count,
      script_adapter_count: gap.wp_script_adapter_metadata_count,
      unsupported_report_site_count: manifests.gapInventory.summary.unsupported_report_site_count
    },
    decision: {
      status: "passed",
      parallel_core_port_work_unblocked: true,
      allowed_scope: [
        "Resume bounded WordPress Core port slices in parallel when they use WPHX PHP for new public WordPress PHP emission or intentionally drive a named compiler gap.",
        "Keep stock Haxe PHP as private implementation/stdphp oracle and fallback until a later fixture moves that responsibility.",
        "Move new public ABI, original-path layout, include timing, reference, raw-template, or generated-quality pressure into WPHX PHP core/profile gates instead of source contortions or runner patches."
      ],
      required_for_each_parallel_slice: [
        "fresh WPHX PHP focused fixture or reused gate",
        "unsupported=[] for the claimed boundary",
        "public-shell snapshot or stronger generated-shape evidence when public PHP shape changes",
        "oracle/candidate behavior evidence for WordPress-observable behavior",
        "explicit non-claims for installed behavior, full backend maturity, and remaining stock fallbacks"
      ]
    },
    validation_result: validationResult,
    non_claims: [
      "This does not claim WPHX PHP is a mature arbitrary-Haxe reflaxe.php target.",
      "This does not abandon stock Haxe PHP private implementation output or std/php behavior oracle duty.",
      "This does not claim installed WordPress distribution parity, live HTTP transport behavior, complete WP_Http ownership, or broad Gutenberg/browser ownership.",
      "This does not remove the need for oracle review before full backend promotion or stock-target abandonment."
    ]
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const receipt = {
    schema: "wphx.compiler-core-driver-receipt.v1",
    id: "receipt:wphx-comp-php-adoption-ci",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "passed",
    evidence_class: "compiler_adoption_ci",
    artifact_scope: "wphx_php_usable_compiler_gate",
    commands: ["npm run wphx:php:adoption-ci", "npm run wphx:php:adoption-ci:check"],
    artifacts: [
      {
        path: RUNNER,
        role: "executable WPHX PHP usable-compiler adoption gate"
      },
      {
        path: MANIFEST,
        role: "WPHX PHP adoption CI decision manifest"
      },
      {
        path: "docs/operations/wphx-php-compiler.md",
        role: "compiler operations documentation updated with adoption CI scope"
      },
      {
        path: "docs/operations/progress-matrix.md",
        role: "program rollup updated with WPHX-COMP-PHP-USABLE closure"
      }
    ],
    manifest_sha256: sha256(manifestText),
    validation_result: validationResult,
    claims: [
      "WPHX PHP passes the usable-compiler adoption gate for bounded parallel WordPress Core port slices.",
      "The gate verifies generated PHP quality, public-shell snapshots, runtime/std and bootstrap/debug probes, raw-block/template debt, unsupported=[] for claimed boundaries, and bounded stock fallback surfaces.",
      "Parallel Core work may resume when it routes new public PHP gaps into WPHX PHP and keeps oracle/candidate evidence current."
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
        parallel_core_port_work_unblocked: true,
        required_check_count: REQUIRED_NPM_CHECKS.length
      },
      null,
      2
    )
  );
}

main();
