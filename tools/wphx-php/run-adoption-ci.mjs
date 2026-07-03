#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const checkOnly = process.argv.includes("--check");
const RECORDED_AT = "2026-07-03T06:05:00Z";
const ISSUE = {
  id: "wordpresshx-w91.24.5",
  external_ref: "WPHX-COMP-PHP-ADOPTION-CI",
  title: "Define usable-compiler quality gate for parallel Core work"
};
const CONTINUOUS_ISSUE = {
  id: "wordpresshx-apvq",
  external_ref: "WPHX-COMP-PHP-CONTINUOUS-ADOPTION-CI",
  title: "Make adoption CI a continuous gate"
};
const RUNNER = "tools/wphx-php/run-adoption-ci.mjs";
const MANIFEST = "manifests/ci/wphx-php-adoption-ci.v1.json";
const RECEIPT = "receipts/compiler/wphx-comp-php-adoption-ci.v1.json";
const CONTINUOUS_RECEIPT = "receipts/compiler/wphx-comp-php-continuous-adoption-ci.v1.json";
const WPHX_MANIFEST_ROOT = "manifests/wphx-php";

const PUBLIC_BOUNDARY_OUTCOMES = new Set([
  "core_ir_promotion",
  "profile_only_abi_justification",
  "stock_fallback_reduction",
  "bootstrap_helper_reduction",
  "filed_backend_pressure_evidence"
]);

const REQUIRED_MANIFEST_CHECKS = [
  {
    key: "profileCorePromotionAudit",
    path: "manifests/wphx-php/profile-core-promotion-audit.v1.json",
    script: "wphx:php:profile-core-promotion-audit:check",
    applies_to_public_boundary: false,
    continuous_outcomes: ["continuous_governance_gate", "filed_backend_pressure_evidence"],
    outcome_note: "Classifies profile/script adapter growth and links backend-pressure follow-up work."
  },
  {
    key: "gapInventory",
    path: "manifests/wphx-php/compiler-gap-inventory.v1.json",
    script: "wphx:php:gap-inventory:check",
    applies_to_public_boundary: false,
    continuous_outcomes: ["continuous_governance_gate"],
    outcome_note: "Audits WPHX PHP hxmls, stock fallback surfaces, helper/bootstrap reliance, manifests, runners, and compiler pressure."
  },
  {
    key: "rawBlockPolicy",
    path: "manifests/wphx-php/adapter-raw-block-policy.v1.json",
    script: "wphx:php:adapter-raw-blocks:check",
    applies_to_public_boundary: false,
    continuous_outcomes: ["raw_block_policy_gate"],
    outcome_note: "Keeps inline public PHP raw-block/template debt out of the WordPress profile."
  },
  {
    key: "publicShellSnapshots",
    path: "manifests/wphx-php/public-shell-snapshots.v1.json",
    script: "wphx:php:public-shell-snapshots:check",
    applies_to_public_boundary: false,
    continuous_outcomes: ["generated_shape_policy_gate"],
    outcome_note: "Snapshot-covers generated public PHP shapes required by claimed boundaries."
  },
  {
    key: "runtimeStdlibStrategy",
    path: "manifests/wphx-php/runtime-stdlib-strategy.v1.json",
    script: "wphx:php:runtime-stdlib-strategy:check",
    applies_to_public_boundary: false,
    continuous_outcomes: ["runtime_stdlib_borrowing_gate"],
    outcome_note: "Keeps stock Haxe PHP runtime/std behavior as an explicit borrowing oracle."
  },
  {
    key: "coreLoweringPilot",
    path: "manifests/wphx-php/core-lowering-pilot.v1.json",
    script: "wphx:php:core-lowering-pilot:check",
    applies_to_public_boundary: true,
    continuous_outcomes: ["core_ir_promotion"],
    outcome_note: "Proves reusable typed statement lowering without WordPress-profile/helper/bootstrap fallback."
  },
  {
    key: "nativeArrayMutationCore",
    path: "manifests/wphx-php/native-array-mutation-core.v1.json",
    script: "wphx:php:native-array-mutation-core:check",
    applies_to_public_boundary: true,
    continuous_outcomes: ["core_ir_promotion", "filed_backend_pressure_evidence"],
    outcome_note:
      "Promotes native array read/write/append/unset/isset/empty and falsey-value-preserving distinctions into a non-WordPress core fixture while deferring reference aliasing and broad key-coercion matrices."
  },
  {
    key: "callableClosureCore",
    path: "manifests/wphx-php/callable-closure-core.v1.json",
    script: "wphx:php:callable-closure-core:check",
    applies_to_public_boundary: true,
    continuous_outcomes: ["core_ir_promotion", "filed_backend_pressure_evidence"],
    outcome_note:
      "Promotes static closures, static callable arrays, call_user_func dispatch, accepted-args slicing, and reference-sensitive callback payload mutation into a non-WordPress core fixture while deferring broad callable shapes and closure captures."
  },
  {
    key: "staticDynamicMemberCore",
    path: "manifests/wphx-php/static-dynamic-member-core.v1.json",
    script: "wphx:php:static-dynamic-member-core:check",
    applies_to_public_boundary: true,
    continuous_outcomes: ["core_ir_promotion", "filed_backend_pressure_evidence"],
    outcome_note:
      "Promotes static property/default, indexed static array mutation, instance property, anonymous member, and typed static new pressure into a non-WordPress core fixture while deferring runtime dynamic new/property names."
  },
  {
    key: "wholeFilePilot",
    path: "manifests/wphx-php/whole-file-class-http.v1.json",
    script: "wphx:php:whole-file-class-http:check",
    applies_to_public_boundary: true,
    continuous_outcomes: ["core_ir_promotion", "stock_fallback_reduction", "bootstrap_helper_reduction"],
    outcome_note: "Owns a minimized real WordPress file without stock public shape fallback, helper bridge, or bootstrap bridge."
  },
  {
    key: "fileSegmentCoreApi",
    path: "manifests/wphx-php/file-segment-core-api.v1.json",
    script: "wphx:php:file-segment-core-api:check",
    applies_to_public_boundary: true,
    continuous_outcomes: ["core_ir_promotion"],
    outcome_note:
      "Routes current direct-script, minimized whole-file, and template segment adapters through the reusable file-segment plan registry instead of named script switches."
  },
  {
    key: "bootstrapAutoload",
    path: "manifests/wphx-php/bootstrap-autoload.v1.json",
    script: "wphx:php:bootstrap-autoload:check",
    applies_to_public_boundary: false,
    continuous_outcomes: ["bootstrap_helper_reduction"],
    outcome_note: "Records bootstrap/autoload behavior required before reducing stock-output reliance."
  },
  {
    key: "bootstrapErrorHandler",
    path: "manifests/wphx-php/bootstrap-error-handler.v1.json",
    script: "wphx:php:bootstrap-error-handler:check",
    applies_to_public_boundary: false,
    continuous_outcomes: ["bootstrap_helper_reduction"],
    outcome_note: "Records WordPress-compatible warning/error handling for generated public shells."
  },
  {
    key: "bootstrapDebug",
    path: "manifests/wphx-php/bootstrap-debug.v1.json",
    script: "wphx:php:bootstrap-debug:check",
    applies_to_public_boundary: false,
    continuous_outcomes: ["bootstrap_helper_reduction"],
    outcome_note: "Records source-map/source-comment and original-path frame behavior for generated shells."
  },
  {
    key: "feedModuleFunctions",
    path: "manifests/wphx-php/feed-module-functions.v1.json",
    script: "wphx:php:feed-module-functions:check",
    applies_to_public_boundary: true,
    continuous_outcomes: ["profile_only_abi_justification"],
    outcome_note: "Selected feed.php module functions preserve original-path ABI and native WordPress helper/filter boundaries."
  },
  {
    key: "embedModuleFunctions",
    path: "manifests/wphx-php/embed-module-functions.v1.json",
    script: "wphx:php:embed-module-functions:check",
    applies_to_public_boundary: true,
    continuous_outcomes: ["profile_only_abi_justification"],
    outcome_note: "Selected embed.php module functions preserve original-path ABI and WordPress hook/output behavior."
  },
  {
    key: "httpsModuleFunctions",
    path: "manifests/wphx-php/https-module-functions.v1.json",
    script: "wphx:php:https-module-functions:check",
    applies_to_public_boundary: true,
    continuous_outcomes: ["profile_only_abi_justification"],
    outcome_note: "Selected HTTPS module functions preserve original-path ABI, option/filter behavior, and fake transport boundaries."
  },
  {
    key: "groupedWpHttpHelpers",
    path: "manifests/wphx-php/grouped-wp-http-helpers.v1.json",
    script: "wphx:php:wp-http-grouped-helpers:check",
    applies_to_public_boundary: true,
    continuous_outcomes: ["profile_only_abi_justification"],
    outcome_note: "Selected WP_Http grouped helper shells preserve public/protected method ABI and delegated WordPress helper behavior."
  },
  {
    key: "includeSideEffects",
    path: "manifests/wphx-php/include-side-effects.v1.json",
    script: "wphx:php:include-side-effects:check",
    applies_to_public_boundary: true,
    continuous_outcomes: ["core_ir_promotion"],
    outcome_note: "Direct file-scope/include behavior is kept as reusable file-segment compiler pressure."
  },
  {
    key: "pluggableTiming",
    path: "manifests/wphx-php/pluggable-timing.v1.json",
    script: "wphx:php:pluggable-timing:check",
    applies_to_public_boundary: true,
    continuous_outcomes: ["profile_only_abi_justification"],
    outcome_note: "Conditional/pluggable declaration timing is a WordPress public ABI constraint."
  },
  {
    key: "templateSegmentModel",
    path: "manifests/wphx-php/template-segment-model.v1.json",
    script: "wphx:php:template-segment-model:check",
    applies_to_public_boundary: true,
    continuous_outcomes: ["core_ir_promotion"],
    outcome_note: "Template segment model evidence pressures reusable mixed-template/file-segment IR."
  },
  {
    key: "templateSegmentAdminStyle",
    path: "manifests/wphx-php/template-segment-admin-style.v1.json",
    script: "wphx:php:template-segment-admin-style:check",
    applies_to_public_boundary: true,
    continuous_outcomes: ["core_ir_promotion"],
    outcome_note: "Admin-style template segment evidence is tracked as reusable file/segment lowering pressure."
  },
  {
    key: "templateSegmentNested",
    path: "manifests/wphx-php/template-segment-nested.v1.json",
    script: "wphx:php:template-segment-nested:check",
    applies_to_public_boundary: true,
    continuous_outcomes: ["core_ir_promotion"],
    outcome_note: "Nested template segment evidence is tracked as reusable file/segment lowering pressure."
  },
  {
    key: "wpEmbedHandlers",
    path: "manifests/wphx-php/wp-embed-handlers.v1.json",
    script: "wphx:php:wp-embed-handlers:check",
    applies_to_public_boundary: true,
    continuous_outcomes: ["profile_only_abi_justification", "filed_backend_pressure_evidence"],
    outcome_note: "Bounded WP_Embed class-shell evidence is allowed only with profile/core audit follow-up for repeated generic constructs."
  },
  {
    key: "wpOembedProviders",
    path: "manifests/wphx-php/wp-oembed-providers.v1.json",
    script: "wphx:php:wp-oembed-providers:check",
    applies_to_public_boundary: true,
    continuous_outcomes: ["core_ir_promotion", "profile_only_abi_justification"],
    outcome_note: "Bounded WP_oEmbed early-provider evidence already promoted static-property pressure into compiler core."
  }
];

const EXCLUDED_WPHX_PHP_MANIFESTS = [];
const REQUIRED_NPM_CHECKS = REQUIRED_MANIFEST_CHECKS.map((record) => record.script);
const MANIFESTS = Object.fromEntries(REQUIRED_MANIFEST_CHECKS.map((record) => [record.key, record.path]));

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

function wphxManifestPaths() {
  return readdirSync(WPHX_MANIFEST_ROOT)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => join(WPHX_MANIFEST_ROOT, entry))
    .sort();
}

function manifestSelfStatus(manifest) {
  return manifest.validation_result?.status ?? manifest.validation?.status ?? manifest.checks?.status ?? manifest.status ?? null;
}

function expect(condition, message, failures) {
  if (!condition) failures.push(message);
}

function expectManifestAcceptable(name, manifest, requiredCheckPassed, failures) {
  const status = manifestSelfStatus(manifest);
  if (status === null) {
    expect(requiredCheckPassed, `${name} has no self status and its required check did not pass`, failures);
    return;
  }
  expect(status === "passed", `${name} manifest status is not passed`, failures);
}

function buildContinuousInventory({ manifests, commandResults, failures }) {
  const requiredByPath = new Map(REQUIRED_MANIFEST_CHECKS.map((record) => [record.path, record]));
  const excludedByPath = new Map(EXCLUDED_WPHX_PHP_MANIFESTS.map((record) => [record.path, record]));
  const commandByScript = new Map(commandResults.map((record) => [record.command.replace(/^npm run /, ""), record]));
  const allPaths = wphxManifestPaths();
  const missingRequired = REQUIRED_MANIFEST_CHECKS.filter((record) => !existsSync(record.path));
  const unexpected = allPaths.filter((path) => !requiredByPath.has(path) && !excludedByPath.has(path));
  const included = allPaths
    .filter((path) => requiredByPath.has(path))
    .map((path) => {
      const coverage = requiredByPath.get(path);
      const manifest = manifests[coverage.key] ?? readJson(path);
      const selfStatus = manifestSelfStatus(manifest);
      const commandResult = commandByScript.get(coverage.script);
      const publicBoundaryOutcomeCovered =
        !coverage.applies_to_public_boundary || coverage.continuous_outcomes.some((outcome) => PUBLIC_BOUNDARY_OUTCOMES.has(outcome));
      return {
        path,
        schema: manifest.schema ?? null,
        issue: typeof manifest.issue === "string" ? manifest.issue : manifest.issue?.external_ref ?? null,
        required_check: coverage.script,
        required_check_status: commandResult?.status ?? "missing",
        manifest_self_status: selfStatus,
        effective_status: selfStatus ?? (commandResult?.status === "passed" ? "passed_by_required_check" : "unknown"),
        applies_to_public_boundary: coverage.applies_to_public_boundary,
        continuous_outcomes: coverage.continuous_outcomes,
        public_boundary_outcome_covered: publicBoundaryOutcomeCovered,
        outcome_note: coverage.outcome_note,
        bytes: statSync(path).size,
        sha256: sha256File(path)
      };
    });
  const excluded = allPaths
    .filter((path) => excludedByPath.has(path))
    .map((path) => {
      const coverage = excludedByPath.get(path);
      const manifest = readJson(path);
      return {
        path,
        schema: manifest.schema ?? null,
        issue: typeof manifest.issue === "string" ? manifest.issue : manifest.issue?.external_ref ?? null,
        exclusion_reason: coverage.reason ?? null,
        revisit_owner: coverage.revisit_owner ?? null,
        bytes: statSync(path).size,
        sha256: sha256File(path)
      };
    });

  for (const record of missingRequired) failures.push(`required WPHX PHP manifest is missing from disk: ${record.path}`);
  for (const path of unexpected) failures.push(`WPHX PHP manifest is not covered by adoption CI: ${path}`);
  for (const record of included) {
    if (record.required_check_status !== "passed") failures.push(`required check did not pass for ${record.path}`);
    if (record.manifest_self_status !== null && record.manifest_self_status !== "passed") {
      failures.push(`included WPHX PHP manifest is not passed: ${record.path}`);
    }
    if (!record.public_boundary_outcome_covered) {
      failures.push(`public boundary manifest lacks required continuous-adoption outcome: ${record.path}`);
    }
  }
  for (const record of excluded) {
    if (!record.exclusion_reason) failures.push(`excluded WPHX PHP manifest lacks an exclusion reason: ${record.path}`);
    if (!record.revisit_owner) failures.push(`excluded WPHX PHP manifest lacks a revisit owner: ${record.path}`);
  }

  return {
    all_manifest_count: allPaths.length,
    included_manifest_count: included.length,
    excluded_manifest_count: excluded.length,
    unexpected_manifest_count: unexpected.length,
    missing_required_manifest_count: missingRequired.length,
    public_boundary_manifest_count: included.filter((record) => record.applies_to_public_boundary).length,
    public_boundary_outcome_coverage_passed: included.every((record) => record.public_boundary_outcome_covered),
    included_manifests: included,
    excluded_manifests: excluded,
    unexpected_manifests: unexpected,
    missing_required_manifests: missingRequired.map((record) => record.path)
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

function main() {
  const commandResults = REQUIRED_NPM_CHECKS.map(runNpm);
  const manifests = Object.fromEntries(Object.entries(MANIFESTS).map(([key, path]) => [key, readJson(path)]));
  const failures = [];
  const continuousInventory = buildContinuousInventory({ manifests, commandResults, failures });

  const checkStatusByScript = new Map(commandResults.map((record) => [record.command.replace(/^npm run /, ""), record.status]));
  for (const record of REQUIRED_MANIFEST_CHECKS) {
    expectManifestAcceptable(record.key, manifests[record.key], checkStatusByScript.get(record.script) === "passed", failures);
  }

  const gap = manifests.gapInventory.validation_result;
  const profileCore = manifests.profileCorePromotionAudit.validation_result;
  expect(profileCore.unclassified_count === 0, "profile/core promotion audit must have zero unclassified adapters", failures);
  expect(profileCore.stale_classification_count === 0, "profile/core promotion audit must have zero stale classifications", failures);
  expect(
    manifests.profileCorePromotionAudit.summary.method_adapter_count === manifests.gapInventory.summary.method_adapter_registry_count,
    "profile/core audit method count must match gap inventory method adapter registry count",
    failures
  );
  expect(
    manifests.profileCorePromotionAudit.summary.script_adapter_count === manifests.gapInventory.summary.script_adapter_registry_count,
    "profile/core audit script count must match gap inventory script adapter registry count",
    failures
  );
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
    continuous_adoption_gate_passed: failures.length === 0,
    all_wphx_manifest_count: continuousInventory.all_manifest_count,
    included_wphx_manifest_count: continuousInventory.included_manifest_count,
    excluded_wphx_manifest_count: continuousInventory.excluded_manifest_count,
    unexpected_wphx_manifest_count: continuousInventory.unexpected_manifest_count,
    missing_required_wphx_manifest_count: continuousInventory.missing_required_manifest_count,
    public_boundary_manifest_count: continuousInventory.public_boundary_manifest_count,
    public_boundary_outcome_coverage_passed: continuousInventory.public_boundary_outcome_coverage_passed,
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
    continuous_gate_issue: CONTINUOUS_ISSUE,
    required_checks: commandResults,
    evidence_manifests: continuousInventory.included_manifests.map((record) => fileRecord(record.path)),
    continuous_adoption_manifest_inventory: {
      policy:
        "Every WPHX PHP evidence manifest under manifests/wphx-php must be included in adoption CI with a required check or explicitly excluded with a rationale and revisit owner. Public-boundary manifests must record core IR promotion, profile-only ABI justification, stock fallback reduction, bootstrap/helper reduction, or filed backend-pressure evidence.",
      required_public_boundary_outcomes: [...PUBLIC_BOUNDARY_OUTCOMES].sort(),
      included_manifests: continuousInventory.included_manifests,
      excluded_manifests: continuousInventory.excluded_manifests,
      unexpected_manifests: continuousInventory.unexpected_manifests,
      missing_required_manifests: continuousInventory.missing_required_manifests
    },
    summary: {
      wphx_hxml_count: gap.wphx_hxml_count,
      stock_haxe_php_fallback_hxml_count: gap.stock_haxe_php_hxml_count,
      wphx_evidence_manifest_count: gap.manifest_count,
      all_wphx_php_manifest_count: continuousInventory.all_manifest_count,
      continuous_included_wphx_php_manifest_count: continuousInventory.included_manifest_count,
      continuous_excluded_wphx_php_manifest_count: continuousInventory.excluded_manifest_count,
      continuous_public_boundary_manifest_count: continuousInventory.public_boundary_manifest_count,
      public_shell_snapshot_case_count: snapshotValidation.case_count,
      wordpress_profile_method_adapter_count: manifests.gapInventory.summary.method_adapter_registry_count,
      script_adapter_count: gap.wp_script_adapter_metadata_count,
      unsupported_report_site_count: manifests.gapInventory.summary.unsupported_report_site_count,
      profile_core_promotion_core_ir_candidate_count: manifests.profileCorePromotionAudit.summary.core_ir_candidate_count,
      profile_core_promotion_profile_only_abi_constraint_count: manifests.profileCorePromotionAudit.summary.profile_only_abi_constraint_count,
      profile_core_promotion_backend_pressure_count: manifests.profileCorePromotionAudit.summary.backend_promotion_pressure_count,
      profile_core_promotion_temporary_bridge_count: manifests.profileCorePromotionAudit.summary.temporary_bridge_count
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
        "explicit non-claims for installed behavior, full backend maturity, and remaining stock fallbacks",
        "fresh profile/core promotion classification when WordPress-profile or script adapter registries change",
        "continuous adoption-CI manifest inventory entry with a required check or explicit exclusion",
        "one recorded outcome for new public boundaries: core IR promotion, profile-only ABI justification, stock fallback reduction, bootstrap/helper reduction, or filed backend-pressure evidence"
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
      "The gate now includes the profile/core promotion audit so WordPress-profile adapter growth must carry classification, rationale, owner, and promotion gate evidence.",
      "The gate reports all included and excluded WPHX PHP evidence manifests so future public-slice evidence cannot drift outside adoption CI silently.",
      "Parallel Core work may resume when it routes new public PHP gaps into WPHX PHP and keeps oracle/candidate evidence current."
    ],
    non_claims: manifest.non_claims
  };
  const continuousReceipt = {
    schema: "wphx.compiler-core-driver-receipt.v1",
    id: "receipt:wphx-comp-php-continuous-adoption-ci",
    issue: CONTINUOUS_ISSUE,
    recorded_at: RECORDED_AT,
    status: "passed",
    evidence_class: "compiler_continuous_adoption_ci",
    artifact_scope: "wphx_php_manifest_coverage_and_public_boundary_outcome_gate",
    commands: ["npm run wphx:php:adoption-ci", "npm run wphx:php:adoption-ci:check"],
    artifacts: [
      {
        path: RUNNER,
        role: "executable continuous adoption CI coverage gate"
      },
      {
        path: MANIFEST,
        role: "adoption CI manifest with included/excluded WPHX PHP evidence inventory"
      },
      {
        path: CONTINUOUS_RECEIPT,
        role: "machine-readable receipt for the continuous adoption CI follow-up"
      },
      {
        path: "docs/operations/wphx-php-compiler.md",
        role: "compiler operations documentation updated with continuous adoption CI semantics"
      },
      {
        path: "docs/operations/progress-matrix.md",
        role: "program rollup updated with continuous adoption CI checkpoint"
      }
    ],
    manifest_sha256: sha256(manifestText),
    validation_result: validationResult,
    claims: [
      "Adoption CI now covers every current WPHX PHP evidence manifest under manifests/wphx-php with a required check.",
      "The manifest reports included and excluded WPHX PHP evidence surfaces; the current excluded set is empty.",
      "Public-boundary manifests carry a continuous-adoption outcome covering core IR promotion, profile-only ABI justification, stock fallback reduction, bootstrap/helper reduction, or filed backend-pressure evidence.",
      "The gate fails when a new WPHX PHP evidence manifest appears without inclusion or explicit exclusion."
    ],
    non_claims: manifest.non_claims
  };

  writeOrCheck(MANIFEST, manifestText);
  writeOrCheck(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
  writeOrCheck(CONTINUOUS_RECEIPT, JSON.stringify(continuousReceipt, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        status: "passed",
        output: MANIFEST,
        receipt: RECEIPT,
        continuous_receipt: CONTINUOUS_RECEIPT,
        parallel_core_port_work_unblocked: true,
        required_check_count: REQUIRED_NPM_CHECKS.length,
        included_wphx_manifest_count: continuousInventory.included_manifest_count,
        excluded_wphx_manifest_count: continuousInventory.excluded_manifest_count
      },
      null,
      2
    )
  );
}

main();
