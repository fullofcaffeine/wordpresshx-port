#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-wgwq",
  external_ref: "WPHX-323.08",
  title: "Add Requests API and reflection fixture"
};
const RECORDED_AT = "2026-07-07T15:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-requests-api-reflection-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-323-08";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/requests-reflection-probe.php`;
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const HTTP_GATES = "manifests/wp-core/wphx-323-02-http-vendor-replacement-gates.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const OUT = "manifests/wp-core/wphx-323-08-requests-api-reflection-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-08-requests-api-reflection-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-08-requests-api-reflection-fixture.v1.json";

const REQUESTS_ROOT = "src/wp-includes/Requests";
const REQUESTS_SHIM = "src/wp-includes/class-requests.php";
const REQUIRED_AREAS = [
  "WpOrg\\Requests\\Requests",
  "WpOrg\\Requests\\Session",
  "WpOrg\\Requests\\Response",
  "WpOrg\\Requests\\Response\\Headers",
  "WpOrg\\Requests\\Cookie",
  "WpOrg\\Requests\\Cookie\\Jar",
  "WpOrg\\Requests\\Hooks",
  "WpOrg\\Requests\\HookManager",
  "WpOrg\\Requests\\Iri",
  "WpOrg\\Requests\\Ipv6",
  "WpOrg\\Requests\\Ssl",
  "WpOrg\\Requests\\Proxy\\Http",
  "WpOrg\\Requests\\Transport\\Curl",
  "WpOrg\\Requests\\Transport\\Fsockopen",
  "WpOrg\\Requests\\Utility\\CaseInsensitiveDictionary",
  "WpOrg\\Requests\\Exception"
];
const CASES = [
  { id: "requests-api:modern-symbol-reflection", focus: "PSR-4 Requests classes, interfaces, constants, properties, and method signatures" },
  { id: "requests-api:deprecated-psr0-aliases", focus: "legacy Requests_* aliases resolve through the bundled autoloader with deprecations silenced" },
  { id: "requests-api:headers-cookies-hooks", focus: "representative header, cookie, hook, response, proxy, auth, and session object surfaces instantiate without transport I/O" },
  { id: "requests-api:generated-wrapper-gates", focus: "future generated wrappers must preserve original paths, class visibility, reflection, and overlay manifests" },
  { id: "requests-api:license-provenance", focus: "Requests notice/provenance remains preserved before distribution divergence or copied package retirement" }
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

function phpClassFromRequestSource(path) {
  if (!path.startsWith(`${REQUESTS_ROOT}/src/`) || !path.endsWith(".php")) return null;
  return `WpOrg\\Requests\\${path
    .slice(`${REQUESTS_ROOT}/src/`.length, -".php".length)
    .split("/")
    .join("\\")}`;
}

function mirrorSources(root) {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(mirrorPath(root, REQUESTS_ROOT), { recursive: true });
  cpSync(upstreamPath(REQUESTS_ROOT), mirrorPath(root, REQUESTS_ROOT), { recursive: true });
  mkdirSync(dirname(mirrorPath(root, REQUESTS_SHIM)), { recursive: true });
  copyFileSync(upstreamPath(REQUESTS_SHIM), mirrorPath(root, REQUESTS_SHIM));
}

function writeProbe(modernSymbols) {
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
define('REQUESTS_SILENCE_PSR0_DEPRECATIONS', true);

$captured_errors = array();
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

require ABSPATH . WPINC . '/Requests/src/Autoload.php';
WpOrg\\Requests\\Autoload::register();
require ABSPATH . WPINC . '/class-requests.php';

$modern_symbols = ${JSON.stringify(modernSymbols)};

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

function wphx_object_observations() {
\t$headers = new WpOrg\\Requests\\Response\\Headers(array('Content-Type' => 'text/plain', 'X-Test' => 'one'));
\t$headers['content-type'] = 'text/html';
\t$cookie = WpOrg\\Requests\\Cookie::parse('session=abc; Path=/admin; Domain=example.test; HttpOnly', '', 1700000000);
\t$cookie->flags['creation'] = 1700000000;
\t$cookie->flags['last-access'] = 1700000000;
\t$jar = new WpOrg\\Requests\\Cookie\\Jar(array($cookie));
\t$hooks = new WpOrg\\Requests\\Hooks();
\t$hook_log = array();
\t$hooks->register('demo.hook', function (&$value) use (&$hook_log) { $hook_log[] = $value; $value .= '-mutated'; });
\t$value = 'seed';
\t$hooks->dispatch('demo.hook', array(&$value));
\t$response = new WpOrg\\Requests\\Response();
\t$response->status_code = 404;
\t$response->headers['Location'] = '/elsewhere';
\t$response->body = '{"ok":false}';
\t$exception = null;
\ttry {
\t\t$response->throw_for_status(false);
\t} catch (Throwable $throwable) {
\t\t$exception = array('class' => get_class($throwable), 'type' => method_exists($throwable, 'getType') ? $throwable->getType() : null);
\t}
\t$session = new WpOrg\\Requests\\Session('https://example.test/base', array('A' => 'B'), array(), array('timeout' => 2));
\t$proxy = new WpOrg\\Requests\\Proxy\\Http(array('127.0.0.1:8080', 'user', 'pass'));
\t$auth = new WpOrg\\Requests\\Auth\\Basic(array('user', 'pass'));
\treturn array(
\t\t'headers' => array(
\t\t\t'content_type' => $headers['content-type'],
\t\t\t'all' => $headers->getAll(),
\t\t\t'iterator' => iterator_to_array($headers),
\t\t),
\t\t'cookie' => array(
\t\t\t'name' => $cookie->name,
\t\t\t'value' => $cookie->value,
\t\t\t'attributes' => $cookie->attributes,
\t\t\t'flags' => $cookie->flags,
\t\t\t'header' => $cookie->format_for_header(),
\t\t\t'jar_count' => iterator_count($jar->getIterator()),
\t\t),
\t\t'hooks' => array('value' => $value, 'log' => $hook_log),
\t\t'response' => array(
\t\t\t'is_redirect' => $response->is_redirect(),
\t\t\t'decoded_body' => $response->decode_body(true),
\t\t\t'exception' => $exception,
\t\t),
\t\t'session' => array(
\t\t\t'url' => $session->url,
\t\t\t'headers' => $session->headers,
\t\t\t'options' => $session->options,
\t\t),
\t\t'proxy_auth' => array(
\t\t\t'proxy_auth_string' => $proxy->get_auth_string(),
\t\t\t'basic_auth_string' => $auth->getAuthString(),
\t\t),
\t);
}

$legacy_map_property = new ReflectionProperty('WpOrg\\\\Requests\\\\Autoload', 'deprecated_classes');
$legacy_map_property->setAccessible(true);
$legacy_map = $legacy_map_property->getValue();
ksort($legacy_map);

$modern = array();
foreach ($modern_symbols as $symbol) {
\t$modern[$symbol] = wphx_reflect($symbol, $root);
}

$legacy = array();
foreach ($legacy_map as $legacy_name_lower => $target) {
\t$legacy_name = preg_replace_callback('/(^|_)\\\\w/', fn($m) => strtoupper($m[0]), $legacy_name_lower);
\t$loaded = class_exists($legacy_name) || interface_exists($legacy_name);
\t$legacy[$legacy_name] = array(
\t\t'target' => $target,
\t\t'loaded' => $loaded,
\t\t'reflection' => $loaded ? wphx_reflect($legacy_name, $root) : null,
\t);
}

$result = array(
\t'root' => basename($root),
\t'autoload_registered' => defined('REQUESTS_AUTOLOAD_REGISTERED') && REQUESTS_AUTOLOAD_REGISTERED,
\t'legacy_class_requests' => wphx_reflect('Requests', $root),
\t'modern_symbols' => $modern,
\t'legacy_aliases' => $legacy,
\t'object_observations' => wphx_object_observations(),
\t'captured_errors' => $captured_errors,
);

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\\n";
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
  const httpGates = readJson(HTTP_GATES);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const requestsPlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "requests");
  const requestsGate = httpGates.gate_plan.find((entry) => entry.id === "requests-api-reflection-fixture");
  const wrapperGate = httpGates.gate_plan.find((entry) => entry.id === "requests-generated-public-wrapper");
  const provenanceGate = httpGates.gate_plan.find((entry) => entry.id === "requests-license-provenance-review");
  const requestsBoundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "requests");
  const sourceFiles = listFiles(REQUESTS_ROOT).filter((path) => path.endsWith(".php"));
  const modernSymbols = sourceFiles.map(phpClassFromRequestSource).filter(Boolean).sort();

  if (requestsPlan?.followup_issue.external_ref !== "WPHX-323.02") failures.push("WPHX-323.01 Requests plan is not routed to WPHX-323.02");
  if (requestsGate?.downstream_issue.external_ref !== ISSUE.external_ref) failures.push("WPHX-323.02 Requests API gate is not routed to WPHX-323.08");
  if (wrapperGate?.downstream_issue.external_ref !== ISSUE.external_ref) failures.push("WPHX-323.02 Requests wrapper gate is not routed to WPHX-323.08");
  if (provenanceGate?.downstream_issue.external_ref !== ISSUE.external_ref) failures.push("WPHX-323.02 Requests provenance gate is not routed to WPHX-323.08");
  if (requestsBoundary?.source_inventory.count !== 65) failures.push(`expected Requests source inventory count 65, found ${requestsBoundary?.source_inventory.count}`);
  if (sourceFiles.length !== 65) failures.push(`expected 65 upstream Requests PHP files, found ${sourceFiles.length}`);
  for (const symbol of REQUIRED_AREAS) {
    if (!modernSymbols.includes(symbol)) failures.push(`required Requests area ${symbol} is not in the modern symbol set`);
  }

  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe(modernSymbols);

  const linted = [...sourceFiles, REQUESTS_SHIM].map((path) => ({
    path,
    oracle_lint: lintFile(mirrorPath(ORACLE_ROOT, path)),
    candidate_lint: lintFile(mirrorPath(CANDIDATE_ROOT, path))
  }));

  const oracle = runProbe(ORACLE_ROOT);
  const candidate = runProbe(CANDIDATE_ROOT);
  const comparableOracle = stripRoot(oracle);
  const comparableCandidate = stripRoot(candidate);
  const observationsEqual = JSON.stringify(comparableOracle) === JSON.stringify(comparableCandidate);
  if (!observationsEqual) failures.push("oracle and candidate Requests reflection observations differ");

  const modernMissing = Object.entries(oracle.modern_symbols).filter(([, value]) => !value.exists).map(([symbol]) => symbol);
  if (modernMissing.length > 0) failures.push(`modern Requests symbols did not load: ${modernMissing.join(", ")}`);
  const legacyMissing = Object.entries(oracle.legacy_aliases).filter(([, value]) => !value.loaded).map(([symbol]) => symbol);
  if (legacyMissing.length > 0) failures.push(`legacy Requests aliases did not load: ${legacyMissing.join(", ")}`);
  if (oracle.captured_errors.length > 0 || candidate.captured_errors.length > 0) {
    failures.push("Requests reflection probe captured PHP warnings/notices");
  }

  if (failures.length > 0) {
    throw new Error(`WPHX-323.08 Requests API/reflection fixture failed:\n- ${failures.join("\n- ")}`);
  }

  const validationResult = {
    requests_source_inventory_count: requestsBoundary.source_inventory.count,
    requests_distribution_artifact_count: requestsBoundary.distribution_artifacts.count,
    upstream_requests_php_file_count: sourceFiles.length,
    modern_symbol_count: Object.keys(oracle.modern_symbols).length,
    legacy_alias_count: Object.keys(oracle.legacy_aliases).length,
    fixture_case_count: CASES.length,
    linted_file_count: linted.length,
    observations_equal: observationsEqual,
    captured_error_count: oracle.captured_errors.length + candidate.captured_errors.length
  };

  const manifest = {
    schema: "wphx.wp-core-requests-api-reflection-fixture.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: {
      runner: RUNNER,
      mode: "deterministic"
    },
    scope: {
      boundary_id: "requests",
      source_path: requestsBoundary.source_path,
      distribution_path: requestsBoundary.distribution_path,
      replacement_strategy: requestsPlan.replacement_strategy,
      evidence_lane: "preserved_upstream_requests_api_reflection_golden_snapshot",
      candidate_strategy: "copied_preserved_upstream_package_snapshot_only",
      behavior_parity_claimed: false,
      live_transport_parity_claimed: false,
      generated_wrapper_claimed: false,
      copied_requests_retirement_claimed: false
    },
    inputs: {
      replacement_strategy_manifest: fileRecord(STRATEGY),
      http_vendor_gate_manifest: fileRecord(HTTP_GATES),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      source_files: sourceFiles.map(sourceRecord),
      support_files: [sourceRecord(REQUESTS_SHIM)]
    },
    fixture_cases: CASES,
    required_areas: REQUIRED_AREAS,
    gate_links: {
      api_reflection_gate: requestsGate,
      generated_wrapper_gate: wrapperGate,
      license_provenance_gate: provenanceGate
    },
    mirror_roots: {
      oracle: ORACLE_ROOT,
      candidate: CANDIDATE_ROOT,
      note: "Both roots are regenerated from the preserved upstream WordPress 7.0 Requests package. The candidate root is not a generated replacement."
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
    validation_result: validationResult,
    removal_gates: [
      "Do not claim generated wrapper ownership for wp-includes/Requests until a later receipt records generated original-path wrapper emission and overlay manifest evidence against this reflection snapshot.",
      "Do not claim host-primitive-backed Requests replacement until WPHX-323.09 records live/local transport parity with preserved upstream fallback.",
      "Do not retire copied Requests artifacts until API/reflection, generated-wrapper shape, license/provenance, and transport gates all pass."
    ],
    claims: [
      "The preserved WordPress 7.0 Requests package loads through its bundled autoloader in regenerated oracle and candidate roots.",
      "Modern WpOrg\\Requests symbols, legacy Requests_* aliases, representative object surfaces, and ReflectionClass signatures match between the two preserved package snapshots.",
      "This fixture records the golden API/reflection surface that future generated wrappers or host-primitive-backed replacements must preserve."
    ],
    non_claims: [
      "This fixture does not implement Haxe-owned Requests runtime logic.",
      "This fixture does not execute live HTTP, DNS, TLS, proxy, curl, streams/fsockopen, redirect-following, or installed WordPress transport behavior.",
      "This fixture does not generate or validate replacement public PHP wrappers.",
      "The mirrored candidate root is copied upstream Requests evidence only and must not be cited as copied artifact retirement."
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
    boundary_id: "requests",
    source_authority: "../wordpress-develop WordPress 7.0 Requests package",
    whole_file_owned: false,
    behavior_parity_claimed: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_runtime_claimed: false,
    durable_original_path_adapter_claimed: false,
    copied_upstream_php_executed: true,
    removal_gate:
      "Replace this preserved-package reflection fixture with generated wrapper and host-primitive replacement evidence only after WPHX-323.09 live transport parity, generated overlay manifests, wrapper-shape receipts, and license/provenance review pass.",
    non_claims: manifest.non_claims
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-08-requests-api-reflection-fixture",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "preserved_requests_api_reflection_fixture",
    artifact_scope: "wordpress-7.0-preserved-requests-package",
    commands: ["npm run wp:core:wphx-323-requests-api-reflection", "npm run wp:core:wphx-323-requests-api-reflection:check"],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      parent_http_vendor_gate_manifest: HTTP_GATES,
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
  console.log(`recorded ${validationResult.modern_symbol_count} modern symbols and ${validationResult.legacy_alias_count} legacy aliases`);
}

main();
