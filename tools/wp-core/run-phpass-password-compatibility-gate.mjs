#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-9cb6",
  external_ref: "WPHX-323.21",
  title: "Add phpass password compatibility gate"
};
const RECORDED_AT = "2026-07-08T08:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-phpass-password-compatibility-gate.mjs";
const OUT_ROOT = "build/wp-core/wphx-323-21";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/phpass-password-compatibility-probe.php`;
const SOURCE_FILE = "src/wp-includes/class-phpass.php";
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const MEDIA_GATES = "manifests/wp-core/wphx-323-05-media-security-archive-vendor-replacement-gates.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const WPHX_306_01 = "manifests/wp-core/wphx-306-01-user-auth-surface.v1.json";
const WPHX_306_05 = "manifests/wp-core/wphx-306-05-password-application-fixture.v1.json";
const WPHX_306_07 = "manifests/wp-core/wphx-306-07-auth-installed-distribution-gate.v1.json";
const OUT = "manifests/wp-core/wphx-323-21-phpass-password-compatibility-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-21-phpass-password-compatibility-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-21-phpass-password-compatibility-gate.v1.json";

const CASES = [
  { id: "phpass:api-reflection-state", focus: "PasswordHash class, constructor bounds, public methods, and public state shape" },
  { id: "phpass:portable-deterministic", focus: "deterministic portable $P$ hash generation and verification" },
  { id: "phpass:phpbb-h-prefix", focus: "legacy phpBB-style $H$ portable hash compatibility" },
  { id: "phpass:bcrypt-host-handoff", focus: "host password_hash/password_verify bcrypt handoff and PasswordHash CheckPassword compatibility" },
  { id: "phpass:hashpassword-generation", focus: "HashPassword generated portable and bcrypt family summaries without committing salts" },
  { id: "phpass:invalid-edge-corpus", focus: "invalid, truncated, low-cost, high-cost, empty, non-ASCII, and too-long password cases" },
  { id: "phpass:encode64-gensalt", focus: "encode64, gensalt_private, gensalt_blowfish, and crypt_private deterministic helper behavior" },
  { id: "phpass:timing-security-review", focus: "source-level timing/error-shape markers and explicit security non-claims" }
];
const COVERED_SYMBOLS = [
  "PasswordHash",
  "PasswordHash::__construct",
  "PasswordHash::PasswordHash",
  "PasswordHash::get_random_bytes",
  "PasswordHash::encode64",
  "PasswordHash::gensalt_private",
  "PasswordHash::crypt_private",
  "PasswordHash::gensalt_blowfish",
  "PasswordHash::HashPassword",
  "PasswordHash::CheckPassword",
  "PasswordHash::$itoa64",
  "PasswordHash::$iteration_count_log2",
  "PasswordHash::$portable_hashes",
  "PasswordHash::$random_state",
  "CRYPT_BLOWFISH",
  "crypt",
  "password_hash",
  "password_verify"
];
const BLOCKED_CONDITIONS = [
  {
    id: "password-hash-backed-replacement-runtime",
    status: "blocked",
    reason:
      "Host password_hash/password_verify is recorded as compatibility evidence only. No generated host-primitive-backed replacement for phpass is introduced."
  },
  {
    id: "constant-time-proof",
    status: "blocked",
    reason:
      "The upstream source explicitly notes CheckPassword is not constant-time. This gate records the marker and preserves upstream behavior, but does not prove timing safety or replace a security audit."
  },
  {
    id: "installed-auth-integration",
    status: "blocked",
    reason:
      "The gate reconciles WPHX-306 auth/password floors but does not execute installed users, sessions, password reset, application-password auth, multisite auth, or database-backed login flows."
  },
  {
    id: "copied-phpass-retirement",
    status: "blocked",
    reason:
      "Copied class-phpass.php stays preserved until WPHX-323.22 accepts a provenance/replacement decision with generated-overlay, auth integration, security, and ecosystem evidence."
  }
];

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 80
  }).trim();
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

function artifactRecord(distributionPath) {
  return readFileSync(ARTIFACT_PROVENANCE, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .find((record) => record.path === distributionPath);
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
  const content = readFileSync(upstreamPath(SOURCE_FILE), "utf8");
  return {
    path: SOURCE_FILE,
    distribution_path: SOURCE_FILE.replace(/^src\//, ""),
    public_domain_marker: /public domain/i.test(content),
    openwall_marker: /openwall\.com\/phpass/i.test(content),
    no_warranty_marker: /absolutely no warranty/i.test(content),
    compatibility_warning_marker: /making your hashes incompatible/i.test(content),
    portable_private_method_marker: /private password hashing method/i.test(content),
    timing_marker: /not constant-time|timing safety|unpredictable/i.test(content),
    blowfish_marker: /CRYPT_BLOWFISH|gensalt_blowfish|crypt\(/i.test(content),
    too_long_guard_marker: /strlen\(\s*\$password\s*\)\s*>\s*4096/i.test(content)
  };
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

$captured_errors = array();
set_error_handler(
\tfunction ($errno, $errstr, $errfile, $errline) use (&$captured_errors, $root) {
\t\t$captured_errors[] = array(
\t\t\t'errno' => $errno,
\t\t\t'message_sha256' => 'sha256:' . hash('sha256', str_replace($root, '<root>', $errstr)),
\t\t\t'file' => basename($errfile),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

require $root . '/wp-includes/class-phpass.php';

function wphx_phpass_sha($value) {
\treturn 'sha256:' . hash('sha256', (string) $value);
}

function wphx_phpass_family($hash) {
\tif ($hash === '*') {
\t\treturn 'error-star';
\t}
\tif (str_starts_with($hash, '$P$')) {
\t\treturn 'portable-phpass-p';
\t}
\tif (str_starts_with($hash, '$H$')) {
\t\treturn 'portable-phpass-h';
\t}
\tif (preg_match('/^\\$2[ayb]\\$/', $hash)) {
\t\treturn 'bcrypt';
\t}
\tif (str_starts_with($hash, '*')) {
\t\treturn 'crypt-error';
\t}
\treturn 'other';
}

function wphx_phpass_hash_summary($hash) {
\treturn array(
\t\t'family' => wphx_phpass_family($hash),
\t\t'length' => strlen($hash),
\t\t'prefix' => substr($hash, 0, min(4, strlen($hash))),
\t\t'sha256' => wphx_phpass_sha($hash),
\t);
}

function wphx_phpass_generated_summary($hash) {
\treturn array(
\t\t'family' => wphx_phpass_family($hash),
\t\t'length' => strlen($hash),
\t\t'prefix' => substr($hash, 0, min(4, strlen($hash))),
\t);
}

function wphx_reflect_method($method) {
\t$reflection = new ReflectionMethod('PasswordHash', $method);
\treturn array(
\t\t'name' => $method,
\t\t'public' => $reflection->isPublic(),
\t\t'static' => $reflection->isStatic(),
\t\t'parameters' => $reflection->getNumberOfParameters(),
\t\t'required_parameters' => $reflection->getNumberOfRequiredParameters(),
\t);
}

function wphx_object_state($hasher) {
\treturn array(
\t\t'itoa64_length' => strlen($hasher->itoa64),
\t\t'itoa64_sha256' => wphx_phpass_sha($hasher->itoa64),
\t\t'iteration_count_log2' => $hasher->iteration_count_log2,
\t\t'portable_hashes' => $hasher->portable_hashes,
\t\t'random_state_type' => gettype($hasher->random_state),
\t\t'random_state_length_nonzero' => strlen((string) $hasher->random_state) > 0,
\t);
}

$password = 'correct horse battery staple';
$wrong = 'correct horse battery stapler';
$unicode = "pa\\xc3\\xb1ol-\\xe2\\x98\\x83";
$empty = '';
$long = str_repeat('x', 4097);
$fixed_six = "123456";
$fixed_six_alt = "ABCDEF";
$fixed_sixteen = "1234567890ABCDEF";

$portable = new PasswordHash(8, true);
$bcrypt = new PasswordHash(8, false);
$low_bound = new PasswordHash(1, true);
$high_bound = new PasswordHash(40, true);
$high_valid = new PasswordHash(31, true);

$portable_salt = $portable->gensalt_private($fixed_six);
$portable_hash = $portable->crypt_private($password, $portable_salt);
$portable_wrong_hash = $portable->crypt_private($wrong, $portable_salt);
$h_hash = '$H$' . substr($portable_hash, 3);
$unicode_hash = $portable->crypt_private($unicode, $portable->gensalt_private($fixed_six_alt));
$empty_hash = $portable->crypt_private($empty, $portable->gensalt_private('EMPTY!'));
$invalid_prefix = '$X$B12345678abcdefghijklmnopqrstuv';
$invalid_short_salt = '$P$Bshort';
$invalid_low_cost = '$P$012345678abcdefghijklmnopqrstuv';
$invalid_high_cost = '$P$z12345678abcdefghijklmnopqrstuv';
$truncated_hash = substr($portable_hash, 0, 20);
$host_bcrypt_hash = password_hash($password, PASSWORD_BCRYPT, array('cost' => 4));
$deterministic_blowfish_salt = $bcrypt->gensalt_blowfish($fixed_sixteen);
$deterministic_blowfish_hash = crypt($password, $deterministic_blowfish_salt);
$generated_portable_hash = $portable->HashPassword($password);
$generated_bcrypt_hash = $bcrypt->HashPassword($password);

$observations = array();
$observations['phpass:api-reflection-state'] = array(
\t'php_version' => PHP_VERSION,
\t'crypt_blowfish' => CRYPT_BLOWFISH,
\t'password_hash_available' => function_exists('password_hash'),
\t'password_verify_available' => function_exists('password_verify'),
\t'class_exists' => class_exists('PasswordHash'),
\t'public_properties' => array_keys(get_class_vars('PasswordHash')),
\t'methods' => array_map('wphx_reflect_method', array('__construct', 'PasswordHash', 'get_random_bytes', 'encode64', 'gensalt_private', 'crypt_private', 'gensalt_blowfish', 'HashPassword', 'CheckPassword')),
\t'portable_state' => wphx_object_state($portable),
\t'bcrypt_state' => wphx_object_state($bcrypt),
\t'low_bound_state' => wphx_object_state($low_bound),
\t'high_bound_state' => wphx_object_state($high_bound),
\t'high_valid_state' => wphx_object_state($high_valid),
);

$observations['phpass:portable-deterministic'] = array(
\t'salt' => wphx_phpass_hash_summary($portable_salt),
\t'hash' => wphx_phpass_hash_summary($portable_hash),
\t'wrong_password_hash' => wphx_phpass_hash_summary($portable_wrong_hash),
\t'check_ok' => $portable->CheckPassword($password, $portable_hash),
\t'check_wrong' => $portable->CheckPassword($wrong, $portable_hash),
\t'crypt_matches_stored' => $portable->crypt_private($password, $portable_hash) === $portable_hash,
\t'crypt_wrong_differs' => $portable_wrong_hash !== $portable_hash,
);

$observations['phpass:phpbb-h-prefix'] = array(
\t'h_hash' => wphx_phpass_hash_summary($h_hash),
\t'check_ok' => $portable->CheckPassword($password, $h_hash),
\t'check_wrong' => $portable->CheckPassword($wrong, $h_hash),
\t'crypt_private_preserves_h_prefix' => str_starts_with($portable->crypt_private($password, $h_hash), '$H$'),
);

$observations['phpass:bcrypt-host-handoff'] = array(
\t'host_password_hash' => wphx_phpass_generated_summary($host_bcrypt_hash),
\t'password_verify_ok' => password_verify($password, $host_bcrypt_hash),
\t'password_verify_wrong' => password_verify($wrong, $host_bcrypt_hash),
\t'passwordhash_check_ok' => $portable->CheckPassword($password, $host_bcrypt_hash),
\t'passwordhash_check_wrong' => $portable->CheckPassword($wrong, $host_bcrypt_hash),
\t'deterministic_blowfish_salt' => wphx_phpass_hash_summary($deterministic_blowfish_salt),
\t'deterministic_blowfish_hash' => wphx_phpass_hash_summary($deterministic_blowfish_hash),
\t'deterministic_blowfish_check_ok' => $bcrypt->CheckPassword($password, $deterministic_blowfish_hash),
);

$observations['phpass:hashpassword-generation'] = array(
\t'portable_generated' => wphx_phpass_generated_summary($generated_portable_hash),
\t'portable_check_ok' => $portable->CheckPassword($password, $generated_portable_hash),
\t'portable_check_wrong' => $portable->CheckPassword($wrong, $generated_portable_hash),
\t'bcrypt_generated' => wphx_phpass_generated_summary($generated_bcrypt_hash),
\t'bcrypt_check_ok' => $bcrypt->CheckPassword($password, $generated_bcrypt_hash),
\t'bcrypt_check_wrong' => $bcrypt->CheckPassword($wrong, $generated_bcrypt_hash),
\t'too_long_hash' => $portable->HashPassword($long),
\t'too_long_check' => $portable->CheckPassword($long, $portable_hash),
);

$observations['phpass:invalid-edge-corpus'] = array(
\t'invalid_prefix_crypt' => $portable->crypt_private($password, $invalid_prefix),
\t'invalid_prefix_check' => $portable->CheckPassword($password, $invalid_prefix),
\t'invalid_short_salt_crypt' => $portable->crypt_private($password, $invalid_short_salt),
\t'invalid_short_salt_check' => $portable->CheckPassword($password, $invalid_short_salt),
\t'invalid_low_cost_crypt' => $portable->crypt_private($password, $invalid_low_cost),
\t'invalid_low_cost_check' => $portable->CheckPassword($password, $invalid_low_cost),
\t'invalid_high_cost_crypt' => $portable->crypt_private($password, $invalid_high_cost),
\t'invalid_high_cost_check' => $portable->CheckPassword($password, $invalid_high_cost),
\t'truncated_hash_check' => $portable->CheckPassword($password, $truncated_hash),
\t'empty_password_hash' => wphx_phpass_hash_summary($empty_hash),
\t'empty_password_check' => $portable->CheckPassword($empty, $empty_hash),
\t'unicode_hash' => wphx_phpass_hash_summary($unicode_hash),
\t'unicode_check' => $portable->CheckPassword($unicode, $unicode_hash),
);

$observations['phpass:encode64-gensalt'] = array(
\t'encode64_6' => array('value' => $portable->encode64($fixed_six, 6), 'sha256' => wphx_phpass_sha($portable->encode64($fixed_six, 6))),
\t'encode64_16' => array('value_sha256' => wphx_phpass_sha($portable->encode64($fixed_sixteen, 16)), 'length' => strlen($portable->encode64($fixed_sixteen, 16))),
\t'gensalt_private' => wphx_phpass_hash_summary($portable_salt),
\t'gensalt_blowfish' => wphx_phpass_hash_summary($deterministic_blowfish_salt),
\t'crypt_private_repeated_stable' => $portable->crypt_private($password, $portable_salt) === $portable->crypt_private($password, $portable_salt),
);

$observations['phpass:timing-security-review'] = array(
\t'checkpassword_equality_operator' => 'strict-string-equality',
\t'upstream_timing_comment_recorded' => true,
\t'constant_time_claimed' => false,
\t'fallback_policy' => 'Preserve upstream phpass for portable hashes, legacy edge cases, and timing-sensitive behavior until replacement evidence is accepted.',
);

echo json_encode(
\tarray(
\t\t'observations' => $observations,
\t\t'captured_errors' => $captured_errors,
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\\n";
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

function validateInputs({ strategy, mediaGates, vendorClosure, artifact }) {
  const failures = [];
  const strategyPlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "phpass");
  const mediaGate = mediaGates.gate_plan.find((entry) => entry.id === "phpass-password-compatibility-security");
  const boundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "phpass");
  if (strategyPlan?.replacement_strategy !== "host_primitive_backed_reimplementation_with_preserved_fallback") {
    failures.push(`unexpected phpass replacement strategy: ${strategyPlan?.replacement_strategy}`);
  }
  if (mediaGate?.downstream_issue.external_ref !== ISSUE.external_ref) {
    failures.push(`WPHX-323.05 phpass gate is not routed to ${ISSUE.external_ref}`);
  }
  if (boundary?.source_inventory.count !== 1 || boundary?.distribution_artifacts.count !== 1) {
    failures.push("WPHX-323 vendor closure phpass counts do not match the expected single PHP file");
  }
  if (!artifact) failures.push("artifact provenance record missing for wp-includes/class-phpass.php");
  for (const path of [WPHX_306_01, WPHX_306_05, WPHX_306_07]) {
    if (!existsSync(path)) failures.push(`required WPHX-306 behavior floor is missing: ${path}`);
  }
  if (failures.length > 0) {
    throw new Error(`WPHX-323.21 phpass gate failed input validation:\n- ${failures.join("\n- ")}`);
  }
  return { strategyPlan, mediaGate, boundary };
}

function main() {
  const strategy = readJson(STRATEGY);
  const mediaGates = readJson(MEDIA_GATES);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const artifact = artifactRecord("wp-includes/class-phpass.php");
  const inputs = validateInputs({ strategy, mediaGates, vendorClosure, artifact });
  const markers = sourceMarkers();

  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe();

  const oracleLint = command("php", ["-l", mirrorPath(ORACLE_ROOT, SOURCE_FILE)]);
  const candidateLint = command("php", ["-l", mirrorPath(CANDIDATE_ROOT, SOURCE_FILE)]);
  const oracleRun = runProbe(ORACLE_ROOT);
  const candidateRun = runProbe(CANDIDATE_ROOT);
  const observationsMatch = JSON.stringify(oracleRun.result.observations) === JSON.stringify(candidateRun.result.observations);
  if (!/No syntax errors detected/.test(oracleLint) || !/No syntax errors detected/.test(candidateLint)) {
    throw new Error("phpass PHP lint failed");
  }
  if (!observationsMatch) {
    throw new Error("oracle and candidate phpass observations diverged");
  }

  const validationResult = {
    status: "passed",
    source_php_file_count: 1,
    artifact_provenance_record_count: artifact ? 1 : 0,
    covered_symbol_count: COVERED_SYMBOLS.length,
    case_count: CASES.length,
    oracle_candidate_observations_match: observationsMatch,
    oracle_lint_ok: true,
    candidate_lint_ok: true,
    crypt_blowfish_available: oracleRun.result.observations["phpass:api-reflection-state"].crypt_blowfish === 1,
    password_hash_available: oracleRun.result.observations["phpass:api-reflection-state"].password_hash_available === true,
    password_verify_available: oracleRun.result.observations["phpass:api-reflection-state"].password_verify_available === true,
    host_bcrypt_passwordhash_check_ok: oracleRun.result.observations["phpass:bcrypt-host-handoff"].passwordhash_check_ok === true,
    portable_hash_check_ok: oracleRun.result.observations["phpass:portable-deterministic"].check_ok === true,
    phpbb_h_prefix_check_ok: oracleRun.result.observations["phpass:phpbb-h-prefix"].check_ok === true,
    too_long_guard_recorded: oracleRun.result.observations["phpass:hashpassword-generation"].too_long_hash === "*",
    timing_non_claim_recorded: oracleRun.result.observations["phpass:timing-security-review"].constant_time_claimed === false,
    captured_error_count: oracleRun.result.captured_errors.length
  };

  const manifest = {
    schema: "wphx.wp-core.phpass-password-compatibility-gate.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "preserved_phpass_password_compatibility_security_gate",
    boundary_id: "phpass",
    source_path: SOURCE_FILE,
    distribution_path: "wp-includes/class-phpass.php",
    inputs: {
      vendor_strategy_manifest: fileRecord(STRATEGY),
      media_security_archive_gate_manifest: fileRecord(MEDIA_GATES),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      wphx_306_user_auth_surface_manifest: fileRecord(WPHX_306_01),
      wphx_306_password_application_fixture_manifest: fileRecord(WPHX_306_05),
      wphx_306_auth_installed_distribution_gate_manifest: fileRecord(WPHX_306_07)
    },
    replacement_strategy: {
      current_strategy: inputs.strategyPlan.current_strategy,
      planned_strategy: inputs.strategyPlan.replacement_strategy,
      parent_gate_id: inputs.mediaGate.id,
      fallback_policy: inputs.mediaGate.fallback_policy,
      removal_gate: inputs.mediaGate.removal_gate
    },
    source_files: [sourceRecord(SOURCE_FILE)],
    artifact_provenance: [
      {
        path: artifact.path,
        baseline: artifact.baseline,
        artifact_kind: artifact.artifactKind,
        artifact_digest: artifact.artifactDigest,
        origin: artifact.origin,
        migration_status: artifact.migrationStatus,
        classified: artifact.classified
      }
    ],
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
        "Deterministic portable hashes are recorded by family, length, prefix, and SHA-256 digest.",
        "Fresh HashPassword and host password_hash outputs are summarized by family, length, and prefix only because salts are intentionally random.",
        "Throwable/PHP warnings are captured as normalized digests; the expected corpus emits no warnings.",
        "Host password_hash/password_verify is treated as compatibility evidence, not replacement implementation."
      ]
    },
    runs: {
      oracle: {
        ...oracleRun,
        lint: {
          command: `php -l ${mirrorPath(ORACLE_ROOT, SOURCE_FILE)}`,
          output_sha256: sha256(oracleLint),
          ok: true
        }
      },
      candidate: {
        ...candidateRun,
        lint: {
          command: `php -l ${mirrorPath(CANDIDATE_ROOT, SOURCE_FILE)}`,
          output_sha256: sha256(candidateLint),
          ok: true
        }
      }
    },
    behavior_floors: [
      {
        id: "wphx-306-01-user-auth-surface",
        manifest: WPHX_306_01,
        role: "user/auth surface inventory that records phpass password hashing handoffs"
      },
      {
        id: "wphx-306-05-password-application-fixture",
        manifest: WPHX_306_05,
        role: "password/application fixture floor for WordPress password-family summaries and legacy checks"
      },
      {
        id: "wphx-306-07-auth-installed-distribution-gate",
        manifest: WPHX_306_07,
        role: "installed auth distribution blocker/evidence floor for password/application behavior"
      }
    ],
    blocked_conditions: BLOCKED_CONDITIONS,
    validation_result: validationResult,
    claims: {
      copied_phpass_file_mirrored: true,
      oracle_candidate_observation_parity_claimed: true,
      password_hash_host_primitive_compatibility_recorded: validationResult.host_bcrypt_passwordhash_check_ok,
      installed_auth_runtime_parity_claimed: false,
      constant_time_security_claimed: false,
      haxe_owned_password_runtime_claimed: false,
      generated_public_php_replacement_claimed: false,
      copied_phpass_artifact_retirement_claimed: false
    },
    non_claims: [
      "This gate does not claim Haxe-owned phpass or password runtime implementation.",
      "This gate does not claim a password_hash/password_verify-backed WPHX replacement implementation.",
      "This gate does not claim generated public PHP replacement for wp-includes/class-phpass.php.",
      "This gate does not claim copied class-phpass.php artifact retirement.",
      "This gate does not prove constant-time password verification; upstream CheckPassword explicitly uses strict string equality.",
      "This gate does not execute installed WordPress users, sessions, password reset, application-password auth, multisite auth, or database-backed login flows."
    ]
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestText);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-21-phpass-password-compatibility-gate",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    ownership_state: "preserved_upstream_phpass_password_compatibility_security_gate",
    boundary_id: "phpass",
    source_paths: [SOURCE_FILE],
    distribution_paths: ["wp-includes/class-phpass.php"],
    emission_strategy: "copied_upstream_legacy_library_file_with_password_hash_differential_probe",
    durable_haxe_runtime_claimed: false,
    public_php_replacement_claimed: false,
    copied_artifact_retirement_claimed: false,
    generated_overlay_manifest_present: false,
    security_review_complete: false,
    notes: [
      "Oracle and candidate roots execute copied upstream WordPress 7.0 class-phpass.php.",
      "Host password_hash/password_verify is used only as compatibility evidence for bcrypt handoff.",
      "Keep upstream phpass preserved until WPHX-323.22 records an accepted provenance/replacement decision."
    ],
    removal_gates: [
      "non-empty generated overlay manifest for any candidate divergence",
      "generated password_hash-backed or Haxe-owned adapter evidence with PasswordHash API compatibility",
      "constant-time/security review for verification and legacy portable hash behavior",
      "WPHX-306 installed/auth integration pass with candidate overlays",
      "WPHX-323.22 media/security/archive provenance decision acceptance"
    ],
    receipt_refs: ["receipt:wphx-323-21-phpass-password-compatibility-gate"]
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-21-phpass-password-compatibility-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "preserved_phpass_password_compatibility_security_gate",
    artifact_scope: "wordpress-7.0-phpass-preserved-library-password-hash-compatibility",
    commands: [
      "npm run wp:core:wphx-323-phpass-password-compatibility",
      "npm run wp:core:wphx-323-phpass-password-compatibility:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      parent_media_security_archive_gate_manifest: MEDIA_GATES,
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
  console.log(`recorded ${CASES.length} phpass cases across ${COVERED_SYMBOLS.length} symbols`);
}

main();
