#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.32.2",
  external_ref: "WPHX-323.32",
  title: "Add php-compat readonly shim gate"
};
const RECORDED_AT = "2026-07-09T04:30:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-php-compat-readonly-shim-gate.mjs";
const OUT_ROOT = "build/wp-core/wphx-323-32";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/php-compat-readonly-shim-probe.php`;
const SOURCE_FILE = "src/wp-includes/php-compat/readonly.php";
const GENERAL_TEMPLATE = "src/wp-includes/general-template.php";
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const LOCALIZATION_GATES = "manifests/wp-core/wphx-323-06-localization-legacy-vendor-replacement-gates.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const SOURCE_INVENTORY = "manifests/source-inventory.jsonl";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const OUT = "manifests/wp-core/wphx-323-32-php-compat-readonly-shim-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-32-php-compat-readonly-shim-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-32-php-compat-readonly-shim-gate.v1.json";

const CASES = [
  { id: "php-compat-readonly:source-boundary", focus: "readonly.php is the only WPHX-323 php_compat boundary file; compat.php and compat-utf8.php are excluded" },
  { id: "php-compat-readonly:host-version-include-policy", focus: "WordPress general-template.php conditionally includes readonly.php only on PHP_VERSION_ID < 80100" },
  { id: "php-compat-readonly:api-reflection", focus: "readonly() reflection-visible name, parameters, defaults, and source body markers" },
  { id: "php-compat-readonly:deprecated-handoff", focus: "readonly() emits _deprecated_function and delegates to wp_readonly()" },
  { id: "php-compat-readonly:return-echo-shape", focus: "return and echo behavior for matching, nonmatching, display=true, and display=false cases" },
  { id: "php-compat-readonly:repeated-include", focus: "require_once repeated include and raw require redeclaration behavior on the current PHP host" },
  { id: "php-compat-readonly:generated-replacement-fallback-policy", focus: "generated replacement requirements, preserved fallback conditions, and explicit non-claims" }
];

const COVERED_SYMBOLS = [
  "readonly",
  "readonly::__FUNCTION__ deprecation payload",
  "wp_readonly",
  "__checked_selected_helper",
  "_deprecated_function",
  "PHP_VERSION_ID < 80100 include guard",
  "wp-includes/php-compat/readonly.php"
];

const BLOCKED_CONDITIONS = [
  {
    id: "host-primitive-readonly-replacement-runtime",
    status: "blocked",
    reason: "The gate executes copied upstream readonly.php under deterministic stubs. No Haxe-owned or host-primitive-backed generated replacement is introduced."
  },
  {
    id: "php-version-matrix",
    status: "blocked",
    reason: "The gate records current-host PHP behavior and the WordPress PHP_VERSION_ID < 80100 include policy. A cross-version PHP 7.4/8.0/8.1+ matrix is still required before replacement."
  },
  {
    id: "bootstrap-integration",
    status: "blocked",
    reason: "The gate records general-template.php include policy but does not execute full WordPress bootstrap, admin, localization, deprecation hooks, or installed distribution behavior."
  },
  {
    id: "copied-readonly-retirement",
    status: "blocked",
    reason: "Copied php-compat/readonly.php stays preserved until WPHX-323.36 accepts a provenance/replacement decision with generated-overlay, version matrix, bootstrap, deprecation, and fallback evidence."
  }
];

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 80
  }).trim();
}

function commandResult(commandName, commandArgs) {
  const result = spawnSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 80
  });
  const normalizedCommandArgs = commandArgs.map((arg) => normalizeProcessText(arg));
  const normalizedStdout = normalizeProcessText((result.stdout || "").trim());
  const normalizedStderr = normalizeProcessText((result.stderr || "").trim());
  return {
    command: `${commandName} ${normalizedCommandArgs.map((arg) => JSON.stringify(arg)).join(" ")}`,
    status: result.status,
    signal: result.signal,
    stdout_sha256: sha256(normalizedStdout),
    stderr_sha256: sha256(normalizedStderr),
    stdout_preview: normalizedStdout.slice(0, 160),
    stderr_preview: normalizedStderr.slice(0, 240)
  };
}

function normalizeProcessText(value) {
  return String(value)
    .replaceAll(process.cwd(), "<repo>")
    .replaceAll(ORACLE_ROOT, "<root>")
    .replaceAll(CANDIDATE_ROOT, "<root>")
    .replaceAll("oracle", "<root-kind>")
    .replaceAll("candidate", "<root-kind>");
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function fileRecord(path) {
  return { path, bytes: statSync(path).size, sha256: sha256File(path) };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path) {
  const content = readFileSync(path, "utf8").trim();
  if (!content) return [];
  return content.split("\n").map((line) => JSON.parse(line));
}

function upstreamPath(path) {
  return `${UPSTREAM_ROOT}/${path}`;
}

function mirrorPath(root, path) {
  return `${root}/${path.replace(/^src\//, "")}`;
}

function sourceRecord(path) {
  return {
    path,
    distribution_path: path.replace(/^src\//, ""),
    repo_path: upstreamPath(path),
    bytes: statSync(upstreamPath(path)).size,
    sha256: sha256File(upstreamPath(path))
  };
}

function sourceInventoryRecord() {
  return readJsonl(SOURCE_INVENTORY)
    .filter((record) => record.path === SOURCE_FILE)
    .map((record) => ({
      path: record.path,
      baseline: record.baseline,
      repo: record.repo,
      commit: record.commit,
      tree: record.tree,
      language: record.language,
      area: record.area,
      kind: record.kind,
      status: record.status,
      classified: record.classified
    }));
}

function artifactRecord() {
  return readJsonl(ARTIFACT_PROVENANCE)
    .filter((record) => record.path === SOURCE_FILE.replace(/^src\//, ""))
    .map((record) => ({
      path: record.path,
      baseline: record.baseline,
      artifact_kind: record.artifactKind,
      artifact_digest: record.artifactDigest,
      origin: record.origin,
      migration_status: record.migrationStatus,
      classified: record.classified
    }));
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

function mirrorSources(root) {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(dirname(mirrorPath(root, SOURCE_FILE)), { recursive: true });
  copyFileSync(upstreamPath(SOURCE_FILE), mirrorPath(root, SOURCE_FILE));
}

function sourceMarkers() {
  const readonly = readFileSync(upstreamPath(SOURCE_FILE), "utf8");
  const generalTemplate = readFileSync(upstreamPath(GENERAL_TEMPLATE), "utf8");
  return {
    readonly_path: SOURCE_FILE,
    distribution_path: SOURCE_FILE.replace(/^src\//, ""),
    package_wordpress_marker: /@package WordPress/.test(readonly),
    since_590_marker: /@since 5\.9\.0/.test(readonly),
    deprecated_function_marker: /_deprecated_function\(\s*__FUNCTION__\s*,\s*'5\.9\.0'\s*,\s*'wp_readonly\(\)'/.test(readonly),
    wp_readonly_handoff_marker: /return\s+wp_readonly\(\s*\$readonly_value,\s*\$current,\s*\$display\s*\)/.test(readonly),
    php81_reserved_keyword_comment_marker: /PHP\s*>=\s*8\.1 results in a fatal error|PHP 8\.1,\s*`readonly` is a reserved keyword/i.test(
      `${readonly}\n${generalTemplate}`
    ),
    general_template_php_version_guard_marker: /if\s*\(\s*PHP_VERSION_ID\s*<\s*80100\s*\)\s*\{\s*require_once\s+__DIR__\s*\.\s*'\/php-compat\/readonly\.php'/.test(
      generalTemplate
    ),
    function_exists_guard_present: /function_exists\s*\(\s*['"]readonly['"]/.test(readonly),
    compat_php_boundary_excluded: true,
    compat_utf8_boundary_excluded: true
  };
}

function phpCompatSourceFiles() {
  return readdirSync(upstreamPath("src/wp-includes/php-compat"), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `src/wp-includes/php-compat/${entry.name}`)
    .sort();
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
$root = rtrim($argv[1], '/\\\\');

error_reporting(E_ALL);
ini_set('display_errors', 'stderr');
ini_set('log_errors', '0');

$deprecated_functions = array();
$helper_calls = array();

function _deprecated_function($function, $version, $replacement = '') {
\t$GLOBALS['deprecated_functions'][] = array(
\t\t'function' => $function,
\t\t'version' => $version,
\t\t'replacement' => $replacement,
\t);
}

function __checked_selected_helper($helper, $current, $display, $type) {
\t$result = ((string) $helper === (string) $current) ? " $type='$type'" : '';
\t$GLOBALS['helper_calls'][] = array(
\t\t'helper_type' => gettype($helper),
\t\t'helper_value' => is_scalar($helper) || null === $helper ? (string) $helper : gettype($helper),
\t\t'current_type' => gettype($current),
\t\t'current_value' => is_scalar($current) || null === $current ? (string) $current : gettype($current),
\t\t'display' => $display,
\t\t'type' => $type,
\t\t'result' => $result,
\t);
\tif ($display) {
\t\techo $result;
\t}
\treturn $result;
}

function wp_readonly($readonly_value, $current = true, $display = true) {
\treturn __checked_selected_helper($readonly_value, $current, $display, 'readonly');
}

function wphx_readonly_call($id, $readonly_value, $current = true, $display = true) {
\t$before_deprecated = count($GLOBALS['deprecated_functions']);
\t$before_helpers = count($GLOBALS['helper_calls']);
\tob_start();
\t$return = readonly($readonly_value, $current, $display);
\t$echo = ob_get_clean();
\treturn array(
\t\t'id' => $id,
\t\t'args' => array(
\t\t\t'readonly_value_type' => gettype($readonly_value),
\t\t\t'readonly_value' => is_scalar($readonly_value) || null === $readonly_value ? (string) $readonly_value : gettype($readonly_value),
\t\t\t'current_type' => gettype($current),
\t\t\t'current_value' => is_scalar($current) || null === $current ? (string) $current : gettype($current),
\t\t\t'display' => $display,
\t\t),
\t\t'return' => $return,
\t\t'echo' => $echo,
\t\t'deprecated_delta' => count($GLOBALS['deprecated_functions']) - $before_deprecated,
\t\t'helper_delta' => count($GLOBALS['helper_calls']) - $before_helpers,
\t\t'latest_deprecated' => end($GLOBALS['deprecated_functions']),
\t\t'latest_helper' => end($GLOBALS['helper_calls']),
\t);
}

require $root . '/wp-includes/php-compat/readonly.php';

$reflection = new ReflectionFunction('readonly');
$parameters = array();
foreach ($reflection->getParameters() as $parameter) {
\t$parameters[] = array(
\t\t'name' => $parameter->getName(),
\t\t'position' => $parameter->getPosition(),
\t\t'optional' => $parameter->isOptional(),
\t\t'default_available' => $parameter->isDefaultValueAvailable(),
\t\t'default' => $parameter->isDefaultValueAvailable() ? $parameter->getDefaultValue() : null,
\t\t'by_reference' => $parameter->isPassedByReference(),
\t);
}

$observations = array();
$observations['php-compat-readonly:api-reflection'] = array(
\t'function_exists' => function_exists('readonly'),
\t'name' => $reflection->getName(),
\t'parameter_count' => $reflection->getNumberOfParameters(),
\t'required_parameter_count' => $reflection->getNumberOfRequiredParameters(),
\t'parameters' => $parameters,
\t'return_type' => $reflection->hasReturnType() ? (string) $reflection->getReturnType() : null,
);
$calls = array(
\twphx_readonly_call('match-display-true', true, true, true),
\twphx_readonly_call('nomatch-display-true', true, false, true),
\twphx_readonly_call('string-int-match-display-false', '1', 1, false),
\twphx_readonly_call('false-false-display-false', false, false, false),
\twphx_readonly_call('zero-false-display-false', 0, false, false),
);
$observations['php-compat-readonly:deprecated-handoff'] = array(
\t'call_count' => count($calls),
\t'deprecated_functions' => $GLOBALS['deprecated_functions'],
\t'helper_calls' => $GLOBALS['helper_calls'],
\t'all_deprecation_replacements' => array_values(array_unique(array_map(fn($call) => $call['replacement'], $GLOBALS['deprecated_functions']))),
\t'all_helper_types' => array_values(array_unique(array_map(fn($call) => $call['type'], $GLOBALS['helper_calls']))),
);
$observations['php-compat-readonly:return-echo-shape'] = array(
\t'calls' => $calls,
\t'matching_returns' => array_map(fn($call) => $call['return'], $calls),
);
$observations['php-compat-readonly:generated-replacement-fallback-policy'] = array(
\t'host_primitive_backed_candidate' => true,
\t'haxe_owned_php_compat_runtime_claimed' => false,
\t'generated_public_php_replacement_claimed' => false,
\t'copied_readonly_artifact_retirement_claimed' => false,
\t'installed_bootstrap_parity_claimed' => false,
\t'fallback_policy' => 'Preserve upstream readonly.php whenever host version behavior, deprecated signaling, include timing, or wp_readonly handoff evidence is incomplete.',
);
ksort($observations);
echo json_encode(array('observations' => $observations), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\\n";
`
  );
}

function runProbe(root) {
  const output = command("php", [PROBE, root]);
  return {
    command: `php ${PROBE} ${root}`,
    raw_output_sha256: sha256(output),
    result: JSON.parse(output)
  };
}

function includeBehavior(root) {
  const path = mirrorPath(root, SOURCE_FILE);
  const stubs = `
function _deprecated_function($function, $version, $replacement = '') {}
function __checked_selected_helper($helper, $current, $display, $type) { return ((string) $helper === (string) $current) ? " $type='$type'" : ''; }
function wp_readonly($readonly_value, $current = true, $display = true) { return __checked_selected_helper($readonly_value, $current, $display, 'readonly'); }
`;
  return {
    require_once_twice: commandResult("php", ["-r", `${stubs} require_once ${JSON.stringify(path)}; require_once ${JSON.stringify(path)}; echo function_exists('readonly') ? 'readonly-present' : 'readonly-missing';`]),
    raw_require_twice: commandResult("php", ["-r", `${stubs} require ${JSON.stringify(path)}; require ${JSON.stringify(path)}; echo 'unexpected-ok';`])
  };
}

function validateInputs({ strategy, localizationGates, vendorClosure, sourceInventory, artifactEvidence }) {
  const failures = [];
  const strategyPlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "php_compat");
  const parentGate = localizationGates.gate_plan.find((entry) => entry.id === "php-compat-readonly-shim");
  const boundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "php_compat");
  const actualFiles = phpCompatSourceFiles();
  if (JSON.stringify(actualFiles) !== JSON.stringify([SOURCE_FILE])) {
    failures.push(`php_compat boundary drifted from readonly.php: ${actualFiles.join(", ")}`);
  }
  if (strategyPlan?.replacement_strategy !== "host_primitive_backed_reimplementation_with_preserved_fallback") {
    failures.push(`unexpected php_compat replacement strategy: ${strategyPlan?.replacement_strategy}`);
  }
  if (parentGate?.downstream_issue.external_ref !== ISSUE.external_ref) {
    failures.push(`WPHX-323.06 php_compat gate is not routed to ${ISSUE.external_ref}`);
  }
  if (boundary?.source_inventory.count !== 1 || boundary?.distribution_artifacts.count !== 1 || boundary?.source_tree.php_file_count !== 1) {
    failures.push("WPHX-323 vendor closure php_compat counts do not match the expected single PHP file");
  }
  if (sourceInventory.length !== 1) failures.push(`expected 1 source inventory record, found ${sourceInventory.length}`);
  if (artifactEvidence.length !== 1) failures.push(`expected 1 artifact provenance record, found ${artifactEvidence.length}`);
  if (failures.length > 0) {
    throw new Error(`WPHX-323.32 php-compat readonly gate failed input validation:\n- ${failures.join("\n- ")}`);
  }
  return { strategyPlan, parentGate, boundary };
}

function main() {
  const strategy = readJson(STRATEGY);
  const localizationGates = readJson(LOCALIZATION_GATES);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const sourceInventory = sourceInventoryRecord();
  const artifactEvidence = artifactRecord();
  const inputs = validateInputs({ strategy, localizationGates, vendorClosure, sourceInventory, artifactEvidence });
  const markers = sourceMarkers();

  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe();

  const oracleLint = commandResult("php", ["-l", mirrorPath(ORACLE_ROOT, SOURCE_FILE)]);
  const candidateLint = commandResult("php", ["-l", mirrorPath(CANDIDATE_ROOT, SOURCE_FILE)]);
  const oracleRun = runProbe(ORACLE_ROOT);
  const candidateRun = runProbe(CANDIDATE_ROOT);
  const observationsMatch = JSON.stringify(oracleRun.result.observations) === JSON.stringify(candidateRun.result.observations);
  if (!observationsMatch) {
    throw new Error("oracle and candidate php-compat readonly observations diverged");
  }

  const oracleInclude = includeBehavior(ORACLE_ROOT);
  const candidateInclude = includeBehavior(CANDIDATE_ROOT);
  const includeObservationsMatch = JSON.stringify(oracleInclude) === JSON.stringify(candidateInclude);
  if (!includeObservationsMatch) {
    throw new Error("oracle and candidate php-compat readonly include observations diverged");
  }

  const currentPhpVersion = command("php", ["-r", "echo PHP_VERSION;"]);
  const currentPhpVersionId = Number(command("php", ["-r", "echo PHP_VERSION_ID;"]));
  const readonlyFunctionAllowed = commandResult("php", ["-r", "function readonly(){return 'ok';} echo readonly();"]);
  const validationResult = {
    status: "passed",
    source_php_file_count: 1,
    source_inventory_record_count: sourceInventory.length,
    artifact_provenance_record_count: artifactEvidence.length,
    covered_symbol_count: COVERED_SYMBOLS.length,
    case_count: CASES.length,
    oracle_candidate_observations_match: observationsMatch,
    oracle_candidate_include_observations_match: includeObservationsMatch,
    oracle_lint_exit_status: oracleLint.status,
    candidate_lint_exit_status: candidateLint.status,
    current_php_version: currentPhpVersion,
    current_php_version_id: currentPhpVersionId,
    current_host_readonly_function_name_allowed: readonlyFunctionAllowed.status === 0,
    upstream_php81_reserved_keyword_blocker_recorded: markers.php81_reserved_keyword_comment_marker,
    wordpress_general_template_guard_recorded: markers.general_template_php_version_guard_marker,
    readonly_function_exists: oracleRun.result.observations["php-compat-readonly:api-reflection"].function_exists === true,
    readonly_required_parameter_count: oracleRun.result.observations["php-compat-readonly:api-reflection"].required_parameter_count,
    deprecated_handoff_count: oracleRun.result.observations["php-compat-readonly:deprecated-handoff"].deprecated_functions.length,
    wp_readonly_helper_type_only: oracleRun.result.observations["php-compat-readonly:deprecated-handoff"].all_helper_types.length === 1,
    require_once_twice_ok: oracleInclude.require_once_twice.status === 0,
    raw_require_twice_redeclares_or_blocks: oracleInclude.raw_require_twice.status !== 0,
    php_compat_boundary_limited_to_readonly: true,
    compat_php_or_compat_utf8_included: false,
    fallback_policy_recorded: oracleRun.result.observations["php-compat-readonly:generated-replacement-fallback-policy"].copied_readonly_artifact_retirement_claimed === false
  };

  const manifest = {
    schema: "wphx.wp-core.php-compat-readonly-shim-gate.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "preserved_php_compat_readonly_shim_gate",
    boundary_id: "php_compat",
    source_path: SOURCE_FILE,
    distribution_path: SOURCE_FILE.replace(/^src\//, ""),
    inputs: {
      vendor_strategy_manifest: fileRecord(STRATEGY),
      localization_legacy_vendor_gate_manifest: fileRecord(LOCALIZATION_GATES),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      source_inventory: fileRecord(SOURCE_INVENTORY),
      artifact_provenance: fileRecord(ARTIFACT_PROVENANCE)
    },
    replacement_strategy: {
      current_strategy: inputs.strategyPlan.current_strategy,
      planned_strategy: inputs.strategyPlan.replacement_strategy,
      parent_gate_id: inputs.parentGate.id,
      fallback_policy: inputs.parentGate.fallback_policy,
      removal_gate: inputs.parentGate.removal_gate,
      generated_public_wrapper_requirements: inputs.parentGate.generated_public_wrapper_requirements
    },
    source_files: [sourceRecord(SOURCE_FILE)],
    source_inventory_records: sourceInventory,
    artifact_provenance_records: artifactEvidence,
    package_markers: {
      source_tree_file_count: inputs.boundary.source_tree.file_count,
      php_source_count: inputs.boundary.source_inventory.count,
      distribution_artifact_count: inputs.boundary.distribution_artifacts.count,
      license_provenance: inputs.boundary.license_provenance,
      source_markers: markers
    },
    fixture: {
      cases: CASES,
      covered_symbols: COVERED_SYMBOLS,
      normalization: [
        "Oracle and candidate roots both execute copied upstream WordPress 7.0 php-compat/readonly.php.",
        "The current PHP host is recorded; current-host behavior does not supersede WordPress's PHP_VERSION_ID < 80100 include policy.",
        "php-compat is narrowed to wp-includes/php-compat/readonly.php; wp-includes/compat.php and wp-includes/compat-utf8.php are excluded.",
        "Repeated raw require behavior is captured by exit status and stderr digest, not by embedding full fatal output.",
        "No generated replacement or host-primitive implementation is introduced."
      ]
    },
    runs: {
      oracle: {
        ...oracleRun,
        lint: oracleLint,
        include_behavior: oracleInclude
      },
      candidate: {
        ...candidateRun,
        lint: candidateLint,
        include_behavior: candidateInclude
      },
      current_host: {
        php_version: currentPhpVersion,
        php_version_id: currentPhpVersionId,
        readonly_function_name_allowed_probe: readonlyFunctionAllowed
      }
    },
    blocked_conditions: BLOCKED_CONDITIONS,
    validation_result: validationResult,
    claims: {
      copied_readonly_file_mirrored: true,
      oracle_candidate_observation_parity_claimed: true,
      readonly_api_reflection_recorded: validationResult.readonly_function_exists,
      deprecated_wp_readonly_handoff_recorded: validationResult.deprecated_handoff_count > 0,
      wordpress_include_policy_recorded: validationResult.wordpress_general_template_guard_recorded,
      php_compat_boundary_limited_to_readonly: true,
      installed_bootstrap_parity_claimed: false,
      haxe_owned_php_compat_runtime_claimed: false,
      generated_public_php_replacement_claimed: false,
      copied_readonly_artifact_retirement_claimed: false,
      legal_review_completed_claimed: false
    },
    non_claims: [
      "This gate does not claim Haxe-owned php-compat runtime implementation.",
      "This gate does not claim generated public PHP replacement for wp-includes/php-compat/readonly.php.",
      "This gate does not claim copied readonly.php artifact retirement.",
      "This gate does not include wp-includes/compat.php or wp-includes/compat-utf8.php in the WPHX-323 php_compat boundary.",
      "This gate does not execute full WordPress bootstrap, admin, localization, deprecation hook, or installed distribution behavior.",
      "This gate does not claim legal review completion; it preserves upstream headers/project notice and records future provenance gates."
    ]
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestText);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-32-php-compat-readonly-shim-gate",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    ownership_state: "preserved_upstream_php_compat_readonly_shim_gate",
    boundary_id: "php_compat",
    source_paths: [SOURCE_FILE],
    distribution_paths: [SOURCE_FILE.replace(/^src\//, "")],
    emission_strategy: "copied_upstream_php_compat_readonly_shim_with_host_version_probe",
    durable_haxe_runtime_claimed: false,
    public_php_replacement_claimed: false,
    copied_artifact_retirement_claimed: false,
    generated_overlay_manifest_present: false,
    installed_bootstrap_parity_claimed: false,
    legal_review_complete: false,
    notes: [
      "Oracle and candidate roots execute copied upstream WordPress 7.0 php-compat/readonly.php.",
      "The php_compat boundary is limited to wp-includes/php-compat/readonly.php.",
      "Current-host readonly function-name behavior is recorded as host evidence and does not supersede the WordPress PHP_VERSION_ID < 80100 include policy.",
      "Keep upstream readonly.php preserved until WPHX-323.36 records an accepted provenance/replacement decision."
    ],
    removal_gates: [
      "non-empty generated overlay manifest for any candidate divergence",
      "generated WPHX PHP original-path readonly.php preserving conditional declaration timing, deprecation payload, and wp_readonly handoff",
      "cross-version PHP 7.4/8.0/8.1+ host-version matrix",
      "bootstrap/admin/deprecation hook evidence with candidate overlays",
      "license/provenance review and WPHX-323.36 localization legacy provenance decision acceptance"
    ],
    receipt_refs: ["receipt:wphx-323-32-php-compat-readonly-shim-gate"]
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-32-php-compat-readonly-shim-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "preserved_php_compat_readonly_shim_gate",
    artifact_scope: "wordpress-7.0-php-compat-readonly-preserved-library-shim",
    commands: [
      "npm run wp:core:wphx-323-php-compat-readonly-shim",
      "npm run wp:core:wphx-323-php-compat-readonly-shim:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      parent_localization_legacy_gate_manifest: LOCALIZATION_GATES,
      parent_vendor_strategy_manifest: STRATEGY,
      parent_vendor_closure_manifest: VENDOR_CLOSURE
    },
    manifest_sha256: sha256(manifestText),
    validation_result: validationResult,
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };
  writeOrCheck(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);

  const verb = checkOnly ? "validated" : "wrote";
  console.log(`${verb} ${OUT}`);
  console.log(`${verb} ${OWNERSHIP}`);
  console.log(`${verb} ${RECEIPT}`);
  console.log(`recorded ${CASES.length} php-compat readonly cases across ${COVERED_SYMBOLS.length} symbols`);
}

main();
