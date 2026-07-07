#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-jfwa",
  external_ref: "WPHX-323.11",
  title: "Add PHPMailer API/reflection and wrapper-shape fixture"
};
const RECORDED_AT = "2026-07-07T19:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-phpmailer-api-reflection-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-323-11";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/phpmailer-reflection-probe.php`;
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const MAIL_GATES = "manifests/wp-core/wphx-323-03-mail-vendor-replacement-gates.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const OUT = "manifests/wp-core/wphx-323-11-phpmailer-api-reflection-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-11-phpmailer-api-reflection-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-11-phpmailer-api-reflection-fixture.v1.json";

const PHPMAILER_ROOT = "src/wp-includes/PHPMailer";
const SUPPORT_FILES = [
  "src/wp-includes/class-phpmailer.php",
  "src/wp-includes/class-smtp.php",
  "src/wp-includes/class-pop3.php",
  "src/wp-includes/class-wp-phpmailer.php"
];
const MODERN_SYMBOLS = [
  "PHPMailer\\PHPMailer\\DSNConfigurator",
  "PHPMailer\\PHPMailer\\Exception",
  "PHPMailer\\PHPMailer\\OAuth",
  "PHPMailer\\PHPMailer\\OAuthTokenProvider",
  "PHPMailer\\PHPMailer\\PHPMailer",
  "PHPMailer\\PHPMailer\\POP3",
  "PHPMailer\\PHPMailer\\SMTP",
  "WP_PHPMailer"
];
const LEGACY_SYMBOLS = ["PHPMailer", "phpmailerException", "SMTP", "POP3"];
const REQUIRED_AREAS = [
  "PHPMailer\\PHPMailer\\PHPMailer",
  "PHPMailer\\PHPMailer\\SMTP",
  "PHPMailer\\PHPMailer\\POP3",
  "PHPMailer\\PHPMailer\\Exception",
  "PHPMailer\\PHPMailer\\DSNConfigurator",
  "PHPMailer\\PHPMailer\\OAuth",
  "PHPMailer\\PHPMailer\\OAuthTokenProvider",
  "WP_PHPMailer extends PHPMailer\\PHPMailer\\PHPMailer",
  "legacy class-phpmailer.php, class-smtp.php, and class-pop3.php shims",
  "public constants, properties, method signatures, and reflection-visible paths"
];
const CASES = [
  { id: "phpmailer-api:modern-symbol-reflection", focus: "PHPMailer namespace classes, interface, constants, properties, and method signatures" },
  { id: "phpmailer-api:wordpress-wrapper", focus: "WP_PHPMailer inheritance and WordPress translation-backed language setup" },
  { id: "phpmailer-api:legacy-shims", focus: "legacy PHPMailer, phpmailerException, SMTP, and POP3 global class surfaces" },
  { id: "phpmailer-api:representative-objects", focus: "representative PHPMailer, SMTP, Exception, WP_PHPMailer, and POP3 object state without delivery" },
  { id: "phpmailer-api:generated-wrapper-gates", focus: "future generated wrappers must preserve paths, aliases, inheritance, reflection, and overlay manifests" }
];

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 120
  }).trim();
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

function upstreamPath(path) {
  return `${UPSTREAM_ROOT}/${path}`;
}

function mirrorPath(root, path) {
  return `${root}/${path.replace(/^src\//, "")}`;
}

function listFiles(path) {
  const full = upstreamPath(path);
  const stat = statSync(full);
  if (stat.isFile()) return [path];
  return readdirSync(full, { withFileTypes: true })
    .flatMap((entry) => listFiles(`${path}/${entry.name}`))
    .sort();
}

function sourceRecord(path) {
  return {
    path,
    repo_path: upstreamPath(path),
    bytes: statSync(upstreamPath(path)).size,
    sha256: sha256File(upstreamPath(path))
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

function mirrorSources(root) {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(mirrorPath(root, PHPMAILER_ROOT), { recursive: true });
  cpSync(upstreamPath(PHPMAILER_ROOT), mirrorPath(root, PHPMAILER_ROOT), { recursive: true });
  for (const path of SUPPORT_FILES) {
    mkdirSync(dirname(mirrorPath(root, path)), { recursive: true });
    copyFileSync(upstreamPath(path), mirrorPath(root, path));
  }
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

define('ABSPATH', $root . '/');
define('WPINC', 'wp-includes');

$captured_errors = array();
$deprecated_files = array();
set_error_handler(
\tfunction ($errno, $errstr, $errfile, $errline) use (&$captured_errors, $root) {
\t\t$captured_errors[] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => wphx_relative_path($errfile, $root),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

function __($text) {
\treturn $text;
}

function _deprecated_file($file, $version, $replacement = '', $message = '') {
\t$GLOBALS['deprecated_files'][] = array(
\t\t'file' => $file,
\t\t'version' => $version,
\t\t'replacement' => $replacement,
\t\t'message' => $message,
\t);
}

function wphx_relative_path($path, $root) {
\t$real = realpath($path);
\t$base = realpath($root);
\tif (false !== $real && false !== $base && 0 === strpos($real, $base . DIRECTORY_SEPARATOR)) {
\t\treturn str_replace('\\\\', '/', substr($real, strlen($base) + 1));
\t}
\treturn str_replace('\\\\', '/', (string) $path);
}

function wphx_type($type) {
\treturn $type ? (string) $type : null;
}

function wphx_value($value) {
\tif (is_array($value)) {
\t\treturn array(
\t\t\t'kind' => 'array',
\t\t\t'count' => count($value),
\t\t\t'keys' => array_slice(array_map('strval', array_keys($value)), 0, 20),
\t\t);
\t}
\tif (is_object($value)) {
\t\treturn array('kind' => 'object', 'class' => get_class($value));
\t}
\tif (is_resource($value)) {
\t\treturn array('kind' => 'resource', 'type' => get_resource_type($value));
\t}
\treturn $value;
}

function wphx_param(ReflectionParameter $param) {
\t$record = array(
\t\t'name' => $param->getName(),
\t\t'type' => wphx_type($param->getType()),
\t\t'optional' => $param->isOptional(),
\t\t'by_ref' => $param->isPassedByReference(),
\t\t'variadic' => $param->isVariadic(),
\t\t'allows_null' => $param->allowsNull(),
\t);
\ttry {
\t\tif ($param->isDefaultValueAvailable()) {
\t\t\t$record['default'] = wphx_value($param->getDefaultValue());
\t\t} elseif ($param->isDefaultValueConstant()) {
\t\t\t$record['default_constant'] = $param->getDefaultValueConstantName();
\t\t}
\t} catch (ReflectionException $exception) {
\t\t$record['default_unavailable'] = $exception->getMessage();
\t}
\treturn $record;
}

function wphx_method(ReflectionMethod $method, $root) {
\treturn array(
\t\t'name' => $method->getName(),
\t\t'declaring_class' => $method->getDeclaringClass()->getName(),
\t\t'visibility' => $method->isPublic() ? 'public' : ($method->isProtected() ? 'protected' : 'private'),
\t\t'static' => $method->isStatic(),
\t\t'final' => $method->isFinal(),
\t\t'abstract' => $method->isAbstract(),
\t\t'return_type' => wphx_type($method->getReturnType()),
\t\t'returns_reference' => $method->returnsReference(),
\t\t'parameters' => array_map('wphx_param', $method->getParameters()),
\t\t'file' => wphx_relative_path($method->getFileName(), $root),
\t);
}

function wphx_property(ReflectionProperty $property) {
\treturn array(
\t\t'name' => $property->getName(),
\t\t'declaring_class' => $property->getDeclaringClass()->getName(),
\t\t'visibility' => $property->isPublic() ? 'public' : ($property->isProtected() ? 'protected' : 'private'),
\t\t'static' => $property->isStatic(),
\t\t'type' => wphx_type($property->getType()),
\t);
}

function wphx_reflect($symbol, $root) {
\t$exists = class_exists($symbol) || interface_exists($symbol) || trait_exists($symbol);
\tif (!$exists) {
\t\treturn array('symbol' => $symbol, 'exists' => false);
\t}
\t$class = new ReflectionClass($symbol);
\t$methods = array_map(fn($method) => wphx_method($method, $root), $class->getMethods());
\tusort($methods, fn($a, $b) => strcmp($a['name'], $b['name']) ?: strcmp($a['declaring_class'], $b['declaring_class']));
\t$properties = array_map('wphx_property', $class->getProperties());
\tusort($properties, fn($a, $b) => strcmp($a['name'], $b['name']) ?: strcmp($a['declaring_class'], $b['declaring_class']));
\t$constants = array();
\tforeach ($class->getConstants() as $name => $value) {
\t\t$constants[$name] = wphx_value($value);
\t}
\tksort($constants);
\treturn array(
\t\t'symbol' => $symbol,
\t\t'exists' => true,
\t\t'name' => $class->getName(),
\t\t'short_name' => $class->getShortName(),
\t\t'namespace' => $class->getNamespaceName(),
\t\t'file' => wphx_relative_path($class->getFileName(), $root),
\t\t'type' => $class->isInterface() ? 'interface' : ($class->isTrait() ? 'trait' : 'class'),
\t\t'final' => $class->isFinal(),
\t\t'abstract' => $class->isAbstract(),
\t\t'parent' => $class->getParentClass() ? $class->getParentClass()->getName() : null,
\t\t'interfaces' => array_values($class->getInterfaceNames()),
\t\t'traits' => array_values($class->getTraitNames()),
\t\t'constants' => $constants,
\t\t'properties' => $properties,
\t\t'methods' => $methods,
\t);
}

require ABSPATH . WPINC . '/PHPMailer/Exception.php';
require ABSPATH . WPINC . '/PHPMailer/OAuthTokenProvider.php';
require ABSPATH . WPINC . '/PHPMailer/PHPMailer.php';
require ABSPATH . WPINC . '/PHPMailer/SMTP.php';
require ABSPATH . WPINC . '/PHPMailer/POP3.php';
require ABSPATH . WPINC . '/PHPMailer/DSNConfigurator.php';
require ABSPATH . WPINC . '/PHPMailer/OAuth.php';
require ABSPATH . WPINC . '/class-phpmailer.php';
require ABSPATH . WPINC . '/class-smtp.php';
require ABSPATH . WPINC . '/class-pop3.php';
require ABSPATH . WPINC . '/class-wp-phpmailer.php';

$modern_symbols = ${JSON.stringify(MODERN_SYMBOLS)};
$legacy_symbols = ${JSON.stringify(LEGACY_SYMBOLS)};

$modern = array();
foreach ($modern_symbols as $symbol) {
\t$modern[$symbol] = wphx_reflect($symbol, $root);
}

$legacy = array();
foreach ($legacy_symbols as $symbol) {
\t$legacy[$symbol] = wphx_reflect($symbol, $root);
}

$mailer = new PHPMailer\\PHPMailer\\PHPMailer(true);
$mailer->CharSet = 'UTF-8';
$mailer->Subject = 'Fixture subject';
$mailer->Body = 'Fixture body';
$mailer->addAddress('to@example.test', 'To User');
$mailer->addReplyTo('reply@example.test', 'Reply User');
$mailer->addCustomHeader('X-WPHX-Fixture', 'reflection');

$wp_mailer = new WP_PHPMailer(true);
$smtp = new PHPMailer\\PHPMailer\\SMTP();
$exception = new PHPMailer\\PHPMailer\\Exception('Fixture <error>');
$legacy_pop3 = new POP3('mail.example.test', 3);
$dsn_mailer = PHPMailer\\PHPMailer\\DSNConfigurator::mailer('mail://localhost', true);
$language_property = new ReflectionProperty('WP_PHPMailer', 'language');
$language_property->setAccessible(true);
$wp_language = $language_property->getValue();

$object_observations = array(
\t'phpmailer' => array(
\t\t'class' => get_class($mailer),
\t\t'validator_callable' => is_callable(PHPMailer\\PHPMailer\\PHPMailer::$validator),
\t\t'charset' => $mailer->CharSet,
\t\t'mailer' => $mailer->Mailer,
\t\t'addr_count' => count($mailer->getToAddresses()),
\t\t'reply_to_count' => count($mailer->getReplyToAddresses()),
\t\t'custom_header_count' => count($mailer->getCustomHeaders()),
\t),
\t'wp_phpmailer' => array(
\t\t'class' => get_class($wp_mailer),
\t\t'parent' => get_parent_class($wp_mailer),
\t\t'language_count' => count($wp_language),
\t\t'language_sample' => array_intersect_key($wp_language, array_flip(array('authenticate', 'connect_host', 'invalid_address'))),
\t),
\t'smtp' => array(
\t\t'class' => get_class($smtp),
\t\t'version' => PHPMailer\\PHPMailer\\SMTP::VERSION,
\t\t'debug_level' => $smtp->do_debug,
\t),
\t'exception' => array(
\t\t'class' => get_class($exception),
\t\t'message' => $exception->getMessage(),
\t\t'error_message' => $exception->errorMessage(),
\t),
\t'legacy_pop3' => array(
\t\t'class' => get_class($legacy_pop3),
\t\t'mailserver' => $legacy_pop3->MAILSERVER,
\t\t'timeout' => $legacy_pop3->TIMEOUT,
\t),
\t'dsn_mailer' => array(
\t\t'class' => get_class($dsn_mailer),
\t\t'mailer' => $dsn_mailer->Mailer,
\t),
);

$result = array(
\t'root' => basename($root),
\t'deprecated_files' => $GLOBALS['deprecated_files'],
\t'modern_symbols' => $modern,
\t'legacy_symbols' => $legacy,
\t'object_observations' => $object_observations,
\t'captured_errors' => $captured_errors,
);

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE) . "\\n";
`
  );
}

function runProbe(root) {
  const output = command("php", [PROBE, root]);
  return JSON.parse(output);
}

function lintFile(path) {
  return command("php", ["-l", path]);
}

function stripRoot(observation) {
  const copy = JSON.parse(JSON.stringify(observation));
  delete copy.root;
  return copy;
}

function main() {
  const failures = [];
  const strategy = readJson(STRATEGY);
  const mailGates = readJson(MAIL_GATES);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const phpmailerPlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "phpmailer");
  const apiGate = mailGates.gate_plan.find((entry) => entry.id === "phpmailer-api-reflection-and-wrapper-shape");
  const setupGate = mailGates.gate_plan.find((entry) => entry.id === "wp-mail-setup-minimized-fixtures");
  const phpmailerBoundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "phpmailer");
  const sourceFiles = listFiles(PHPMAILER_ROOT).filter((path) => path.endsWith(".php"));

  if (phpmailerPlan?.followup_issue.external_ref !== "WPHX-323.03") failures.push("WPHX-323.01 PHPMailer plan is not routed to WPHX-323.03");
  if (apiGate?.downstream_issue.external_ref !== ISSUE.external_ref) failures.push("WPHX-323.03 PHPMailer API/reflection gate is not routed to WPHX-323.11");
  if (setupGate?.downstream_issue.external_ref !== ISSUE.external_ref) failures.push("WPHX-323.03 wp_mail setup fixture gate is not routed to WPHX-323.11");
  if (phpmailerBoundary?.source_inventory.count !== 7) failures.push(`expected PHPMailer source inventory count 7, found ${phpmailerBoundary?.source_inventory.count}`);
  if (sourceFiles.length !== 7) failures.push(`expected 7 upstream PHPMailer PHP files, found ${sourceFiles.length}`);

  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe();

  const linted = [...sourceFiles, ...SUPPORT_FILES].map((path) => ({
    path,
    oracle_lint: lintFile(mirrorPath(ORACLE_ROOT, path)),
    candidate_lint: lintFile(mirrorPath(CANDIDATE_ROOT, path))
  }));

  const oracle = runProbe(ORACLE_ROOT);
  const candidate = runProbe(CANDIDATE_ROOT);
  const comparableOracle = stripRoot(oracle);
  const comparableCandidate = stripRoot(candidate);
  const observationsEqual = JSON.stringify(comparableOracle) === JSON.stringify(comparableCandidate);
  if (!observationsEqual) failures.push("oracle and candidate PHPMailer reflection observations differ");

  const modernMissing = Object.entries(oracle.modern_symbols).filter(([, value]) => !value.exists).map(([symbol]) => symbol);
  if (modernMissing.length > 0) failures.push(`modern PHPMailer symbols did not load: ${modernMissing.join(", ")}`);
  const legacyMissing = Object.entries(oracle.legacy_symbols).filter(([, value]) => !value.exists).map(([symbol]) => symbol);
  if (legacyMissing.length > 0) failures.push(`legacy PHPMailer symbols did not load: ${legacyMissing.join(", ")}`);
  if (oracle.modern_symbols.WP_PHPMailer?.parent !== "PHPMailer\\PHPMailer\\PHPMailer") failures.push("WP_PHPMailer parent class is not PHPMailer\\PHPMailer\\PHPMailer");
  if (oracle.captured_errors.length > 0 || candidate.captured_errors.length > 0) failures.push("PHPMailer reflection probe captured PHP warnings/notices");

  if (failures.length > 0) {
    throw new Error(`WPHX-323.11 PHPMailer API/reflection fixture failed:\n- ${failures.join("\n- ")}`);
  }

  const validationResult = {
    phpmailer_source_inventory_count: phpmailerBoundary.source_inventory.count,
    phpmailer_distribution_artifact_count: phpmailerBoundary.distribution_artifacts.count,
    upstream_phpmailer_php_file_count: sourceFiles.length,
    support_file_count: SUPPORT_FILES.length,
    modern_symbol_count: Object.keys(oracle.modern_symbols).length,
    legacy_symbol_count: Object.keys(oracle.legacy_symbols).length,
    fixture_case_count: CASES.length,
    linted_file_count: linted.length,
    observations_equal: observationsEqual,
    captured_error_count: oracle.captured_errors.length + candidate.captured_errors.length,
    generated_overlay_manifest_present: false,
    candidate_package_difference_count: 0
  };

  const manifest = {
    schema: "wphx.wp-core-phpmailer-api-reflection-fixture.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: {
      runner: RUNNER,
      mode: "deterministic"
    },
    scope: {
      boundary_id: "phpmailer",
      source_path: phpmailerBoundary.source_path,
      distribution_path: phpmailerBoundary.distribution_path,
      replacement_strategy: phpmailerPlan.replacement_strategy,
      evidence_lane: "preserved_upstream_phpmailer_api_reflection_and_wrapper_shape_floor",
      candidate_strategy: "copied_preserved_upstream_package_snapshot_only",
      behavior_parity_claimed: false,
      transport_parity_claimed: false,
      generated_wrapper_claimed: false,
      copied_phpmailer_retirement_claimed: false,
      haxe_owned_phpmailer_runtime_claimed: false
    },
    inputs: {
      replacement_strategy_manifest: fileRecord(STRATEGY),
      mail_vendor_gate_manifest: fileRecord(MAIL_GATES),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      source_files: sourceFiles.map(sourceRecord),
      support_files: SUPPORT_FILES.map(sourceRecord)
    },
    fixture_cases: CASES,
    required_areas: REQUIRED_AREAS,
    gate_links: {
      api_reflection_and_wrapper_shape_gate: apiGate,
      wp_mail_setup_floor_gate: setupGate
    },
    mirror_roots: {
      oracle: ORACLE_ROOT,
      candidate: CANDIDATE_ROOT,
      note: "Both roots are regenerated from preserved upstream WordPress 7.0 PHPMailer files plus WordPress support shims. The candidate root is not a generated wrapper."
    },
    linted_files: linted,
    observations: {
      oracle,
      candidate,
      comparable_sha256: {
        oracle: sha256(JSON.stringify(comparableOracle)),
        candidate: sha256(JSON.stringify(comparableCandidate))
      }
    },
    wrapper_shape_requirements: [
      "Generated original-path wrappers must preserve wp-includes/PHPMailer package paths or document autoload-compatible aliases.",
      "Generated wrappers must preserve PHPMailer namespace classes, legacy global aliases/shims, WP_PHPMailer inheritance, public constants/properties/method signatures, exception classes, include timing, and reflection-visible file paths.",
      "Any candidate file that diverges from preserved upstream PHPMailer or support shims requires a non-empty generated overlay manifest with source, replaced upstream hash, generator, and fallback policy.",
      "Wrapper bodies must be emitted by WPHX PHP, Adapter IR, linker/profile metadata, or accepted compiler/backend evidence; durable hand-authored public PHP is not admitted."
    ],
    fallback_matrix: [
      {
        condition: "generated wrapper cannot preserve public API/reflection/legacy shim behavior",
        required_behavior: "Renew preserved upstream PHPMailer package exception."
      },
      {
        condition: "transport behavior is needed before wrapper confidence",
        required_behavior: "Require WPHX-323.12 controlled SMTP/phpmail transport evidence before copied artifact retirement."
      },
      {
        condition: "license, provenance, external dependency, or ecosystem assumptions are unsettled",
        required_behavior: "Require WPHX-323.13 replacement decision and keep preserved upstream fallback."
      }
    ],
    validation_result: validationResult,
    removal_gates: [
      "Do not claim generated PHPMailer wrapper ownership until a later receipt records generated original-path wrapper emission and overlay manifest evidence against this reflection snapshot.",
      "Do not claim PHPMailer transport replacement until WPHX-323.12 records controlled SMTP/phpmail evidence.",
      "Do not retire copied PHPMailer artifacts until WPHX-323.11, WPHX-323.12, and WPHX-323.13 all pass and update the replacement decision."
    ],
    claims: [
      "The preserved WordPress 7.0 PHPMailer package and WordPress support shims load in regenerated oracle and candidate roots.",
      "Modern PHPMailer namespace symbols, WP_PHPMailer inheritance, legacy global shims, representative object surfaces, and ReflectionClass signatures match between preserved oracle and candidate package snapshots.",
      "This fixture records the golden API/reflection and wrapper-shape floor that future generated PHPMailer wrappers must preserve."
    ],
    non_claims: [
      "This fixture does not implement Haxe-owned PHPMailer runtime logic.",
      "This fixture does not execute SMTP, PHP mail(), DNS, TLS, authentication, remote server, bounce, retry, or operational delivery behavior.",
      "This fixture does not generate or validate replacement public PHP wrappers.",
      "The mirrored candidate root is copied upstream PHPMailer evidence only and must not be cited as copied artifact retirement."
    ]
  };

  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestText);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    artifact: OUT,
    ownership_state: "preserved_upstream_vendor_api_reflection_fixture",
    boundary_id: "phpmailer",
    source_authority: "../wordpress-develop WordPress 7.0 PHPMailer package and support shims",
    whole_file_owned: false,
    behavior_parity_claimed: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_runtime_claimed: false,
    durable_original_path_adapter_claimed: false,
    copied_upstream_php_executed: true,
    removal_gate:
      "Replace this preserved-package reflection fixture with generated wrapper evidence only after overlay manifests, wrapper-shape receipts, WPHX-323.12 transport gates, and WPHX-323.13 provenance/replacement decision pass.",
    non_claims: manifest.non_claims
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-11-phpmailer-api-reflection-fixture",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "preserved_phpmailer_api_reflection_fixture",
    artifact_scope: "wordpress-7.0-preserved-phpmailer-package-and-support-shims",
    commands: ["npm run wp:core:wphx-323-phpmailer-api-reflection", "npm run wp:core:wphx-323-phpmailer-api-reflection:check"],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      parent_mail_vendor_gate_manifest: MAIL_GATES,
      parent_vendor_strategy_manifest: STRATEGY
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
  console.log(`recorded ${validationResult.modern_symbol_count} modern symbols and ${validationResult.legacy_symbol_count} legacy shim symbols`);
}

main();
