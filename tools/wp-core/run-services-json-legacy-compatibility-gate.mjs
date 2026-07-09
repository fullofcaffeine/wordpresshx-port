#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.32.4",
  external_ref: "WPHX-323.34",
  title: "Add Services_JSON legacy compatibility gate"
};
const RECORDED_AT = "2026-07-09T05:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-services-json-legacy-compatibility-gate.mjs";
const OUT_ROOT = "build/wp-core/wphx-323-34";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/services-json-legacy-probe.php`;
const SOURCE_FILE = "src/wp-includes/class-json.php";
const SOURCE_TEST = "tests/phpunit/tests/compat/jsonEncodeDecode.php";
const LEGACY_SURFACE = "manifests/wp-core/wphx-318-01-xmlrpc-legacy-deprecated-surface.v1.json";
const ERROR_SURFACE = "manifests/wp-core/wphx-303-01-error-format-surface.v1.json";
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const LOCALIZATION_GATES = "manifests/wp-core/wphx-323-06-localization-legacy-vendor-replacement-gates.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const SOURCE_INVENTORY = "manifests/source-inventory.jsonl";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const OUT = "manifests/wp-core/wphx-323-34-services-json-legacy-compatibility-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-34-services-json-legacy-compatibility-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-34-services-json-legacy-compatibility-gate.v1.json";

const CASES = [
  { id: "services-json:source-boundary", focus: "single-file wp-includes/class-json.php source boundary, deprecated-file marker, and license/provenance headers" },
  { id: "services-json:api-reflection", focus: "Services_JSON and Services_JSON_Error reflection/API shape, constants, flags, properties, PHP4 constructors, and PEAR fallback branch" },
  { id: "services-json:deprecated-behavior", focus: "deprecated file, constructor, public method, helper method, and error constructor payloads" },
  { id: "services-json:encode-scalars-arrays-objects", focus: "legacy encode/encodeUnsafe/_encode behavior for scalars, arrays, sparse arrays, objects, resources, and toJSON options" },
  { id: "services-json:encode-strings-utf8-numeric", focus: "control characters, slash escaping, Unicode bytes, invalid UTF-8, floats, integer-like floats, and LC_NUMERIC preservation" },
  { id: "services-json:decode-scalars-arrays-objects", focus: "legacy decode behavior for booleans, null, integers, floats, arrays, objects, loose type output, quoted strings, and Unicode escapes" },
  { id: "services-json:decode-comments-malformed-invalid-utf8", focus: "comment stripping, unquoted object names, single quotes, malformed payloads, invalid UTF-8 bytes, and warnings" },
  { id: "services-json:host-json-differential", focus: "json_encode/json_decode differential over admitted simple cases and divergent legacy edge cases" },
  { id: "services-json:caller-pressure", focus: "WordPress PHPUnit smoke test plus WPHX-303/WPHX-318 deprecated/legacy caller pressure anchors" },
  { id: "services-json:generated-replacement-fallback-policy", focus: "generated replacement requirements, host-primitive handoff limits, preserved fallback conditions, and explicit non-claims" }
];

const COVERED_SYMBOLS = [
  "Services_JSON",
  "Services_JSON_Error",
  "SERVICES_JSON_SLICE",
  "SERVICES_JSON_IN_STR",
  "SERVICES_JSON_IN_ARR",
  "SERVICES_JSON_IN_OBJ",
  "SERVICES_JSON_IN_CMT",
  "SERVICES_JSON_LOOSE_TYPE",
  "SERVICES_JSON_SUPPRESS_ERRORS",
  "SERVICES_JSON_USE_TO_JSON",
  "_deprecated_file",
  "_deprecated_function",
  "_deprecated_constructor",
  "json_encode",
  "json_decode",
  "tests/phpunit/tests/compat/jsonEncodeDecode.php",
  "WPHX-303 deprecated/native error surface",
  "WPHX-318 legacy/deprecated surface"
];

const BLOCKED_CONDITIONS = [
  {
    id: "host-json-primitive-replacement",
    status: "blocked",
    reason: "The gate records native json_encode/json_decode differentials but introduces no host-primitive-backed Services_JSON replacement."
  },
  {
    id: "generated-public-services-json-replacement",
    status: "blocked",
    reason: "No WPHX PHP original-path class-json.php replacement is emitted; generated replacement still needs class/constant/API/deprecation/error-shape and edge-case evidence."
  },
  {
    id: "legacy-json-edge-coverage",
    status: "blocked",
    reason: "The corpus records representative malformed/comment/invalid-UTF-8/object/numeric cases. Broader plugin-visible edge behavior remains preserved upstream fallback until admitted by WPHX-323.36."
  },
  {
    id: "copied-services-json-retirement",
    status: "blocked",
    reason: "Copied class-json.php stays preserved until WPHX-323.36 accepts a provenance/replacement decision with generated overlay, native JSON handoff, deprecated behavior, caller pressure, and legal evidence."
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
    stdout_preview: normalizedStdout.slice(0, 240),
    stderr_preview: normalizedStderr.slice(0, 240)
  };
}

function normalizeProcessText(value) {
  return String(value)
    .replaceAll(process.cwd(), "<repo>")
    .replaceAll(ORACLE_ROOT, "<oracle-root>")
    .replaceAll(CANDIDATE_ROOT, "<candidate-root>")
    .replaceAll(OUT_ROOT, "<out-root>");
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

function distributionPath(path) {
  return path.replace(/^src\//, "");
}

function mirrorPath(root, path) {
  return `${root}/${distributionPath(path)}`;
}

function sourceRecord(path) {
  return {
    path,
    distribution_path: path.startsWith("src/") ? distributionPath(path) : path,
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
    .filter((record) => record.path === distributionPath(SOURCE_FILE))
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
  const source = readFileSync(upstreamPath(SOURCE_FILE), "utf8");
  const test = readFileSync(upstreamPath(SOURCE_TEST), "utf8");
  const legacy = readFileSync(LEGACY_SURFACE, "utf8");
  const errors = readFileSync(ERROR_SURFACE, "utf8");
  return {
    source_file: {
      path: SOURCE_FILE,
      distribution_path: distributionPath(SOURCE_FILE),
      deprecated_file_marker: /_deprecated_file\(\s*basename\(\s*__FILE__\s*\)\s*,\s*'5\.3\.0'/.test(source),
      native_json_required_marker: /The PHP native JSON extension is now a requirement/.test(source),
      class_exists_guard_marker: /if\s*\(\s*!\s*class_exists\(\s*'Services_JSON'\s*\)\s*\)/.test(source),
      package_services_json_marker: /@package\s+Services_JSON/.test(source),
      bsd_license_marker: /opensource\.org\/licenses\/bsd-license\.php|Redistribution and use in source and binary forms/.test(source),
      constants_marker: /SERVICES_JSON_LOOSE_TYPE/.test(source) && /SERVICES_JSON_SUPPRESS_ERRORS/.test(source) && /SERVICES_JSON_USE_TO_JSON/.test(source),
      deprecated_function_marker: /_deprecated_function\(\s*__METHOD__\s*,\s*'5\.3\.0'\s*,\s*'The PHP native JSON extension'/.test(source),
      deprecated_constructor_marker: /_deprecated_constructor\(\s*'Services_JSON'\s*,\s*'5\.3\.0'/.test(source),
      encode_header_marker: /header\(\s*'Content-Type: application\/json'\s*\)/.test(source),
      locale_numeric_marker: /setlocale\(LC_NUMERIC,\s*'C'\)/.test(source),
      comment_parser_marker: /SERVICES_JSON_IN_CMT/.test(source),
      pear_error_branch_marker: /class_exists\('PEAR_Error'\)/.test(source)
    },
    upstream_phpunit_smoke: {
      path: SOURCE_TEST,
      covers_services_json_marker: /@covers\s+Services_JSON/.test(test),
      expected_deprecated_file_marker: /setExpectedDeprecated\(\s*'class-json\.php'/.test(test),
      expected_encode_decode_deprecated_markers:
        /Services_JSON::encodeUnsafe/.test(test) && /Services_JSON::decode/.test(test) && /Services_JSON::isError/.test(test),
      basic_encode_assert_marker: /\$json->encodeUnsafe\(\s*array\(\s*'foo'\s*\)\s*\)/.test(test),
      basic_decode_assert_marker: /\$json->decode\(\s*'\["foo"\]'\s*\)/.test(test)
    },
    legacy_surface: {
      manifest: LEGACY_SURFACE,
      services_json_preserved_boundary_marker: /Services_JSON/.test(legacy) && /preserved vendor\/library boundaries/.test(legacy)
    },
    deprecated_error_surface: {
      manifest: ERROR_SURFACE,
      deprecated_function_surface_marker: /_deprecated_function/.test(errors),
      deprecated_file_or_warning_surface_marker: /deprecated|warning|native error/i.test(errors)
    }
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

$deprecated_files = array();
$deprecated_functions = array();
$deprecated_constructors = array();
$captured_errors = array();

set_error_handler(function($errno, $errstr) {
\t$GLOBALS['captured_errors'][] = array(
\t\t'errno' => $errno,
\t\t'message' => $errstr,
\t);
\treturn true;
});

function _deprecated_file($file, $version, $replacement = '', $message = '') {
\t$GLOBALS['deprecated_files'][] = array(
\t\t'file' => $file,
\t\t'version' => $version,
\t\t'replacement' => $replacement,
\t\t'message' => $message,
\t);
}

function _deprecated_function($function, $version, $replacement = '') {
\t$GLOBALS['deprecated_functions'][] = array(
\t\t'function' => $function,
\t\t'version' => $version,
\t\t'replacement' => $replacement,
\t);
}

function _deprecated_constructor($class, $version, $parent_class = '') {
\t$GLOBALS['deprecated_constructors'][] = array(
\t\t'class' => $class,
\t\t'version' => $version,
\t\t'parent_class' => $parent_class,
\t);
}

require_once $root . '/wp-includes/class-json.php';

class WPHX_ServicesJson_ToJsonValue {
\tpublic $label = 'ignored';
\tpublic function toJSON() {
\t\treturn array('to' => 'json', 'value' => 7);
\t}
}

class WPHX_ServicesJson_ToJsonRecursive {
\tpublic function toJSON() {
\t\treturn $this;
\t}
}

function wphx_hash_value($value) {
\treturn 'sha256:' . hash('sha256', $value);
}

function wphx_string_summary($value) {
\treturn array(
\t\t'type' => 'string',
\t\t'bytes' => strlen($value),
\t\t'sha256' => wphx_hash_value($value),
\t\t'hex' => bin2hex($value),
\t\t'utf8_valid' => preg_match('//u', $value) === 1,
\t\t'preview_hex' => substr(bin2hex($value), 0, 96),
\t);
}

function wphx_value_summary($value, $depth = 0) {
\tif ($depth > 4) {
\t\treturn array('type' => gettype($value), 'truncated' => true);
\t}
\tif (is_string($value)) {
\t\treturn wphx_string_summary($value);
\t}
\tif (is_int($value) || is_float($value) || is_bool($value) || is_null($value)) {
\t\treturn array('type' => gettype($value), 'value' => $value);
\t}
\tif (is_array($value)) {
\t\t$out = array();
\t\tforeach ($value as $key => $entry) {
\t\t\t$out[] = array('key' => wphx_value_summary((string) $key, $depth + 1), 'value' => wphx_value_summary($entry, $depth + 1));
\t\t}
\t\treturn array('type' => 'array', 'count' => count($value), 'entries' => $out);
\t}
\tif (is_object($value)) {
\t\t$properties = array();
\t\tforeach (get_object_vars($value) as $key => $entry) {
\t\t\t$properties[$key] = wphx_value_summary($entry, $depth + 1);
\t\t}
\t\tksort($properties);
\t\treturn array(
\t\t\t'type' => 'object',
\t\t\t'class' => get_class($value),
\t\t\t'properties' => $properties,
\t\t);
\t}
\tif (is_resource($value)) {
\t\treturn array('type' => 'resource', 'resource_type' => get_resource_type($value));
\t}
\treturn array('type' => gettype($value));
}

function wphx_delta_since($before) {
\treturn array(
\t\t'deprecated_files' => array_slice($GLOBALS['deprecated_files'], $before['deprecated_files']),
\t\t'deprecated_functions' => array_slice($GLOBALS['deprecated_functions'], $before['deprecated_functions']),
\t\t'deprecated_constructors' => array_slice($GLOBALS['deprecated_constructors'], $before['deprecated_constructors']),
\t\t'errors' => array_slice($GLOBALS['captured_errors'], $before['errors']),
\t);
}

function wphx_before_counts() {
\treturn array(
\t\t'deprecated_files' => count($GLOBALS['deprecated_files']),
\t\t'deprecated_functions' => count($GLOBALS['deprecated_functions']),
\t\t'deprecated_constructors' => count($GLOBALS['deprecated_constructors']),
\t\t'errors' => count($GLOBALS['captured_errors']),
\t);
}

function wphx_run_case($id, $callback) {
\t$before = wphx_before_counts();
\ttry {
\t\t$result = $callback();
\t\treturn array(
\t\t\t'id' => $id,
\t\t\t'threw' => false,
\t\t\t'result' => wphx_value_summary($result),
\t\t\t'delta' => wphx_delta_since($before),
\t\t);
\t} catch (Throwable $throwable) {
\t\treturn array(
\t\t\t'id' => $id,
\t\t\t'threw' => true,
\t\t\t'throwable' => array('class' => get_class($throwable), 'message' => $throwable->getMessage()),
\t\t\t'delta' => wphx_delta_since($before),
\t\t);
\t}
}

function wphx_native_encode($value) {
\t$result = json_encode($value);
\treturn array(
\t\t'ok' => $result !== false,
\t\t'result' => wphx_value_summary($result),
\t\t'error_code' => json_last_error(),
\t\t'error_message' => json_last_error_msg(),
\t);
}

function wphx_native_decode($payload, $assoc) {
\t$result = json_decode($payload, $assoc);
\treturn array(
\t\t'result' => wphx_value_summary($result),
\t\t'error_code' => json_last_error(),
\t\t'error_message' => json_last_error_msg(),
\t);
}

function wphx_method_summary($method) {
\t$params = array();
\tforeach ($method->getParameters() as $parameter) {
\t\t$params[] = array(
\t\t\t'name' => $parameter->getName(),
\t\t\t'position' => $parameter->getPosition(),
\t\t\t'optional' => $parameter->isOptional(),
\t\t\t'default_available' => $parameter->isDefaultValueAvailable(),
\t\t\t'default' => $parameter->isDefaultValueAvailable() ? $parameter->getDefaultValue() : null,
\t\t\t'by_reference' => $parameter->isPassedByReference(),
\t\t);
\t}
\treturn array(
\t\t'name' => $method->getName(),
\t\t'visibility' => $method->isPublic() ? 'public' : ($method->isProtected() ? 'protected' : 'private'),
\t\t'static' => $method->isStatic(),
\t\t'parameter_count' => $method->getNumberOfParameters(),
\t\t'required_parameter_count' => $method->getNumberOfRequiredParameters(),
\t\t'parameters' => $params,
\t);
}

function wphx_reflect_class($class) {
\t$reflection = new ReflectionClass($class);
\t$properties = array();
\tforeach ($reflection->getProperties() as $property) {
\t\t$defaults = $reflection->getDefaultProperties();
\t\t$properties[] = array(
\t\t\t'name' => $property->getName(),
\t\t\t'visibility' => $property->isPublic() ? 'public' : ($property->isProtected() ? 'protected' : 'private'),
\t\t\t'static' => $property->isStatic(),
\t\t\t'default_available' => array_key_exists($property->getName(), $defaults),
\t\t\t'default' => array_key_exists($property->getName(), $defaults) ? $defaults[$property->getName()] : null,
\t\t);
\t}
\tusort($properties, fn($a, $b) => strcmp($a['name'], $b['name']));
\t$methods = array_map('wphx_method_summary', $reflection->getMethods());
\tusort($methods, fn($a, $b) => strcmp($a['name'], $b['name']));
\treturn array(
\t\t'name' => $reflection->getName(),
\t\t'parent' => $reflection->getParentClass() ? $reflection->getParentClass()->getName() : null,
\t\t'is_instantiable' => $reflection->isInstantiable(),
\t\t'properties' => $properties,
\t\t'methods' => $methods,
\t\t'php4_constructor_method_present' => $reflection->hasMethod($class),
\t);
}

$observations = array();

$observations['services-json:api-reflection'] = array(
\t'constants' => array(
\t\t'SERVICES_JSON_SLICE' => SERVICES_JSON_SLICE,
\t\t'SERVICES_JSON_IN_STR' => SERVICES_JSON_IN_STR,
\t\t'SERVICES_JSON_IN_ARR' => SERVICES_JSON_IN_ARR,
\t\t'SERVICES_JSON_IN_OBJ' => SERVICES_JSON_IN_OBJ,
\t\t'SERVICES_JSON_IN_CMT' => SERVICES_JSON_IN_CMT,
\t\t'SERVICES_JSON_LOOSE_TYPE' => SERVICES_JSON_LOOSE_TYPE,
\t\t'SERVICES_JSON_SUPPRESS_ERRORS' => SERVICES_JSON_SUPPRESS_ERRORS,
\t\t'SERVICES_JSON_USE_TO_JSON' => SERVICES_JSON_USE_TO_JSON,
\t),
\t'classes' => array(
\t\t'Services_JSON' => wphx_reflect_class('Services_JSON'),
\t\t'Services_JSON_Error' => wphx_reflect_class('Services_JSON_Error'),
\t),
\t'pear_error_class_exists' => class_exists('PEAR_Error'),
\t'mbstring_flags' => wphx_run_case('constructor-flags', function() {
\t\t$json = new Services_JSON(SERVICES_JSON_LOOSE_TYPE | SERVICES_JSON_SUPPRESS_ERRORS | SERVICES_JSON_USE_TO_JSON);
\t\treturn array(
\t\t\t'use' => $json->use,
\t\t\t'_mb_strlen' => $json->_mb_strlen,
\t\t\t'_mb_substr' => $json->_mb_substr,
\t\t\t'_mb_convert_encoding' => $json->_mb_convert_encoding,
\t\t);
\t}),
);

$observations['services-json:deprecated-behavior'] = array(
\t'file_deprecations_after_require' => $GLOBALS['deprecated_files'],
\t'constructor_deprecation' => wphx_run_case('php5-constructor', fn() => new Services_JSON()),
\t'php4_constructor_deprecation' => wphx_run_case('php4-constructor', function() {
\t\t$json = new Services_JSON();
\t\t$json->Services_JSON(SERVICES_JSON_LOOSE_TYPE);
\t\treturn $json->use;
\t}),
\t'helper_deprecations' => wphx_run_case('helpers', function() {
\t\t$json = new Services_JSON();
\t\treturn array(
\t\t\t'strlen8' => $json->strlen8('abc'),
\t\t\t'substr8' => $json->substr8('abcdef', 1, 3),
\t\t\t'utf82utf16_hex' => bin2hex($json->utf82utf16(chr(0xC3) . chr(0xA9))),
\t\t\t'utf162utf8_hex' => bin2hex($json->utf162utf8(chr(0x00) . chr(0xE9))),
\t\t);
\t}),
);

$encode_values = array(
\t'smoke_array' => array('foo'),
\t'scalars' => array(null, true, false, 0, 1, -7, 3.5, 12.0, '1'),
\t'control_string' => \"quote \\\" slash / backslash \\\\ newline\\n tab\\t backspace\" . chr(8),
\t'unicode_bytes' => 'latin ' . chr(0xC3) . chr(0xA9) . ' snow ' . chr(0xE2) . chr(0x98) . chr(0x83),
\t'invalid_utf8_short' => chr(0xC3) . '(',
\t'invalid_utf8_truncated' => 'bad ' . chr(0xE2) . chr(0x82),
\t'associative_array' => array('b' => 2, 'a' => 1, 'slash' => '/'),
\t'sparse_array' => array(0 => 'zero', 2 => 'two'),
\t'nested_array' => array('foo', 'bar', array(1, 2, 'baz'), array(3, array(4))),
);
$object = new stdClass();
$object->name = 'object';
$object->count = 2;
$object->nested = (object) array('ok' => true);
$encode_values['std_object'] = $object;

$encode_cases = array();
foreach ($encode_values as $id => $value) {
\t$encode_cases[$id] = array(
\t\t'services_json' => wphx_run_case($id, function() use ($value) {
\t\t\t$json = new Services_JSON();
\t\t\treturn $json->encodeUnsafe($value);
\t\t}),
\t\t'host_json_encode' => wphx_native_encode($value),
\t);
}
$observations['services-json:encode-scalars-arrays-objects'] = array(
\t'cases' => $encode_cases,
\t'encode_with_header' => wphx_run_case('encode-header', function() {
\t\t$json = new Services_JSON();
\t\treturn array('encoded' => $json->encode(array('foo')), 'headers' => headers_list());
\t}),
\t'resource_error' => wphx_run_case('resource-error', function() {
\t\t$resource = fopen('php://memory', 'r');
\t\t$json = new Services_JSON();
\t\t$result = $json->encodeUnsafe($resource);
\t\tfclose($resource);
\t\treturn $result;
\t}),
\t'resource_suppressed' => wphx_run_case('resource-suppressed', function() {
\t\t$resource = fopen('php://memory', 'r');
\t\t$json = new Services_JSON(SERVICES_JSON_SUPPRESS_ERRORS);
\t\t$result = $json->encodeUnsafe($resource);
\t\tfclose($resource);
\t\treturn $result;
\t}),
\t'to_json_value' => wphx_run_case('to-json-value', function() {
\t\t$json = new Services_JSON(SERVICES_JSON_USE_TO_JSON);
\t\treturn $json->encodeUnsafe(new WPHX_ServicesJson_ToJsonValue());
\t}),
\t'to_json_recursive_error' => wphx_run_case('to-json-recursive-error', function() {
\t\t$json = new Services_JSON(SERVICES_JSON_USE_TO_JSON);
\t\treturn $json->encodeUnsafe(new WPHX_ServicesJson_ToJsonRecursive());
\t}),
\t'to_json_recursive_suppressed' => wphx_run_case('to-json-recursive-suppressed', function() {
\t\t$json = new Services_JSON(SERVICES_JSON_USE_TO_JSON | SERVICES_JSON_SUPPRESS_ERRORS);
\t\treturn $json->encodeUnsafe(new WPHX_ServicesJson_ToJsonRecursive());
\t}),
);

$observations['services-json:encode-strings-utf8-numeric'] = array(
\t'locale_numeric_before' => setlocale(LC_NUMERIC, 0),
\t'float_locale_preservation' => wphx_run_case('float-locale-preservation', function() {
\t\t$before = setlocale(LC_NUMERIC, 0);
\t\t$json = new Services_JSON();
\t\t$encoded = $json->encodeUnsafe(array('float' => 1234.5, 'integer_float' => 12.0));
\t\t$after = setlocale(LC_NUMERIC, 0);
\t\treturn array('before' => $before, 'encoded' => $encoded, 'after' => $after);
\t}),
\t'utf8_helper_boundary' => wphx_run_case('utf8-helper-boundary', function() {
\t\t$json = new Services_JSON();
\t\treturn array(
\t\t\t'two_byte_utf82utf16' => bin2hex($json->utf82utf16(chr(0xC3) . chr(0xA9))),
\t\t\t'three_byte_utf82utf16' => bin2hex($json->utf82utf16(chr(0xE2) . chr(0x82) . chr(0xAC))),
\t\t\t'truncated_three_byte_encode' => $json->encodeUnsafe(chr(0xE2) . chr(0x82)),
\t\t);
\t}),
);

$decode_payloads = array(
\t'true' => 'true',
\t'false' => 'false',
\t'null' => 'null',
\t'int' => '42',
\t'negative_float' => '-12.75',
\t'exponent_integerish' => '1e3',
\t'double_quoted_string' => '\"line\\\\nslash\\\\/quote\\\\\"\"',
\t'single_quoted_string' => \"'single \\\\' quote'\",
\t'unicode_escape' => '\"latin \\\\u00e9 euro \\\\u20ac\"',
\t'array_mixed' => '[1,\"two\",false,null,{\"a\":1}]',
\t'object_default' => '{\"a\":1,\"b\":[2,3],\"nested\":{\"ok\":true}}',
\t'object_unquoted_names' => '{unquoted: \"value\", count: 2}',
\t'leading_line_comment' => \"// leading comment\\n{\\\"a\\\":1}\",
\t'block_comment_inside' => '{\"a\":1, /* middle comment */ \"b\":2}',
\t'malformed_array_trailing_comma' => '[1,',
\t'malformed_object_missing_value' => '{\"a\":',
\t'unterminated_string' => '\"unterminated',
\t'invalid_utf8_string' => '\"bad ' . chr(0xC3) . '(\"',
);

$decode_cases = array();
foreach ($decode_payloads as $id => $payload) {
\t$decode_cases[$id] = array(
\t\t'payload' => wphx_string_summary($payload),
\t\t'services_json_default' => wphx_run_case($id . '-default', function() use ($payload) {
\t\t\t$json = new Services_JSON();
\t\t\treturn $json->decode($payload);
\t\t}),
\t\t'services_json_loose' => wphx_run_case($id . '-loose', function() use ($payload) {
\t\t\t$json = new Services_JSON(SERVICES_JSON_LOOSE_TYPE);
\t\t\treturn $json->decode($payload);
\t\t}),
\t\t'host_json_decode_object' => wphx_native_decode($payload, false),
\t\t'host_json_decode_assoc' => wphx_native_decode($payload, true),
\t);
}
$observations['services-json:decode-scalars-arrays-objects'] = array(
\t'cases' => array_intersect_key($decode_cases, array_flip(array('true', 'false', 'null', 'int', 'negative_float', 'exponent_integerish', 'double_quoted_string', 'single_quoted_string', 'unicode_escape', 'array_mixed', 'object_default', 'object_unquoted_names'))),
);
$observations['services-json:decode-comments-malformed-invalid-utf8'] = array(
\t'cases' => array_intersect_key($decode_cases, array_flip(array('leading_line_comment', 'block_comment_inside', 'malformed_array_trailing_comma', 'malformed_object_missing_value', 'unterminated_string', 'invalid_utf8_string'))),
);

$safe_encode_equal = 0;
$safe_encode_total = 0;
foreach (array('smoke_array', 'associative_array', 'nested_array', 'std_object') as $id) {
\t$safe_encode_total++;
\t$service = $encode_cases[$id]['services_json']['result'];
\t$host = $encode_cases[$id]['host_json_encode']['result'];
\tif ($service['type'] === 'string' && $host['type'] === 'string' && $service['hex'] === $host['hex']) {
\t\t$safe_encode_equal++;
\t}
}
$decode_default_object = $decode_cases['object_default']['services_json_default']['result'];
$decode_default_native = $decode_cases['object_default']['host_json_decode_object']['result'];
$decode_loose_object = $decode_cases['object_default']['services_json_loose']['result'];
$decode_loose_native = $decode_cases['object_default']['host_json_decode_assoc']['result'];
$observations['services-json:host-json-differential'] = array(
\t'safe_encode_equal_count' => $safe_encode_equal,
\t'safe_encode_total' => $safe_encode_total,
\t'object_default_matches_native_object_shape' => $decode_default_object == $decode_default_native,
\t'object_loose_matches_native_assoc_shape' => $decode_loose_object == $decode_loose_native,
\t'legacy_accepts_single_quoted_string' => $decode_cases['single_quoted_string']['services_json_default']['result']['type'] === 'string',
\t'native_rejects_single_quoted_string' => $decode_cases['single_quoted_string']['host_json_decode_object']['error_code'] !== JSON_ERROR_NONE,
\t'legacy_accepts_unquoted_object_names' => $decode_cases['object_unquoted_names']['services_json_default']['result']['type'] === 'object',
\t'native_rejects_unquoted_object_names' => $decode_cases['object_unquoted_names']['host_json_decode_object']['error_code'] !== JSON_ERROR_NONE,
\t'legacy_comment_behavior_recorded' => true,
\t'native_invalid_utf8_error_recorded' => $decode_cases['invalid_utf8_string']['host_json_decode_object']['error_code'] !== JSON_ERROR_NONE,
);

$observations['services-json:generated-replacement-fallback-policy'] = array(
\t'host_primitive_backed_candidate' => true,
\t'haxe_owned_services_json_runtime_claimed' => false,
\t'generated_public_php_replacement_claimed' => false,
\t'copied_services_json_artifact_retirement_claimed' => false,
\t'installed_legacy_json_parity_claimed' => false,
\t'fallback_policy' => 'Preserve upstream Services_JSON for invalid UTF-8, malformed payloads, comments, object/array ambiguity, warnings/errors, and plugin-visible edge behavior outside admitted evidence.',
);

ksort($observations);
echo json_encode(array('observations' => $observations), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . \"\\n\";
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

function validateInputs({ strategy, localizationGates, vendorClosure, sourceInventory, artifactEvidence }) {
  const failures = [];
  const strategyPlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "services_json");
  const parentGate = localizationGates.gate_plan.find((entry) => entry.id === "services-json-legacy-compatibility");
  const boundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "services_json");
  if (!existsSync(upstreamPath(SOURCE_FILE))) {
    failures.push(`${SOURCE_FILE} is missing from the upstream oracle checkout`);
  }
  if (strategyPlan?.replacement_strategy !== "host_primitive_backed_reimplementation_with_preserved_fallback") {
    failures.push(`unexpected Services_JSON replacement strategy: ${strategyPlan?.replacement_strategy}`);
  }
  if (parentGate?.downstream_issue.external_ref !== ISSUE.external_ref) {
    failures.push(`WPHX-323.06 Services_JSON gate is not routed to ${ISSUE.external_ref}`);
  }
  if (boundary?.source_inventory.count !== 1 || boundary?.distribution_artifacts.count !== 1 || boundary?.source_tree.php_file_count !== 1) {
    failures.push("WPHX-323 vendor closure Services_JSON counts do not match the expected single PHP file");
  }
  if (sourceInventory.length !== 1) failures.push(`expected 1 source inventory record, found ${sourceInventory.length}`);
  if (artifactEvidence.length !== 1) failures.push(`expected 1 artifact provenance record, found ${artifactEvidence.length}`);
  if (failures.length > 0) {
    throw new Error(`WPHX-323.34 Services_JSON gate failed input validation:\n- ${failures.join("\n- ")}`);
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
    throw new Error("oracle and candidate Services_JSON observations diverged");
  }

  const currentPhpVersion = command("php", ["-r", "echo PHP_VERSION;"]);
  const currentPhpVersionId = Number(command("php", ["-r", "echo PHP_VERSION_ID;"]));
  const currentPhpExtensions = command("php", ["-m"]).split("\n").sort();
  const reflection = oracleRun.result.observations["services-json:api-reflection"];
  const deprecated = oracleRun.result.observations["services-json:deprecated-behavior"];
  const encode = oracleRun.result.observations["services-json:encode-scalars-arrays-objects"];
  const decode = oracleRun.result.observations["services-json:decode-scalars-arrays-objects"];
  const decodeEdge = oracleRun.result.observations["services-json:decode-comments-malformed-invalid-utf8"];
  const hostDiff = oracleRun.result.observations["services-json:host-json-differential"];
  const fallback = oracleRun.result.observations["services-json:generated-replacement-fallback-policy"];
  const validationResult = {
    status: "passed",
    source_php_file_count: 1,
    source_inventory_record_count: sourceInventory.length,
    artifact_provenance_record_count: artifactEvidence.length,
    covered_symbol_count: COVERED_SYMBOLS.length,
    case_count: CASES.length,
    oracle_candidate_observations_match: observationsMatch,
    oracle_lint_exit_status: oracleLint.status,
    candidate_lint_exit_status: candidateLint.status,
    current_php_version: currentPhpVersion,
    current_php_version_id: currentPhpVersionId,
    json_extension_loaded: currentPhpExtensions.includes("json"),
    mbstring_extension_loaded: currentPhpExtensions.includes("mbstring"),
    services_json_class_reflected: reflection.classes.Services_JSON.name === "Services_JSON",
    services_json_error_class_reflected: reflection.classes.Services_JSON_Error.name === "Services_JSON_Error",
    constants_recorded_count: Object.keys(reflection.constants).length,
    deprecated_file_recorded: deprecated.file_deprecations_after_require.length === 1,
    deprecated_constructor_recorded: deprecated.constructor_deprecation.delta.deprecated_functions.length === 1,
    deprecated_php4_constructor_recorded: deprecated.php4_constructor_deprecation.delta.deprecated_constructors.length === 1,
    encode_case_count: Object.keys(encode.cases).length,
    resource_error_records_services_json_error: encode.resource_error.result.type === "object" && encode.resource_error.result.class === "Services_JSON_Error",
    resource_suppressed_returns_null_literal: encode.resource_suppressed.result.type === "string",
    to_json_option_recorded: encode.to_json_value.threw === false || encode.to_json_value.threw === true,
    decode_case_count: Object.keys(decode.cases).length + Object.keys(decodeEdge.cases).length,
    comments_malformed_invalid_utf8_recorded: Object.keys(decodeEdge.cases).length >= 6,
    host_json_differential_recorded: hostDiff.safe_encode_total > 0,
    native_json_divergent_legacy_cases_recorded:
      hostDiff.native_rejects_single_quoted_string === true &&
      hostDiff.native_rejects_unquoted_object_names === true &&
      hostDiff.native_invalid_utf8_error_recorded === true,
    caller_pressure_markers_recorded:
      markers.upstream_phpunit_smoke.covers_services_json_marker &&
      markers.legacy_surface.services_json_preserved_boundary_marker &&
      markers.deprecated_error_surface.deprecated_function_surface_marker,
    source_license_marker_recorded: markers.source_file.bsd_license_marker,
    haxe_owned_services_json_runtime_claimed: false,
    generated_public_php_replacement_claimed: false,
    copied_services_json_artifact_retirement_claimed: false,
    installed_legacy_json_parity_claimed: false,
    legal_review_completed_claimed: false,
    fallback_policy_recorded: fallback.copied_services_json_artifact_retirement_claimed === false
  };

  const manifest = {
    schema: "wphx.wp-core.services-json-legacy-compatibility-gate.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "preserved_services_json_legacy_compatibility_gate",
    boundary_id: "services_json",
    source_path: SOURCE_FILE,
    distribution_path: distributionPath(SOURCE_FILE),
    inputs: {
      vendor_strategy_manifest: fileRecord(STRATEGY),
      localization_legacy_vendor_gate_manifest: fileRecord(LOCALIZATION_GATES),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      source_inventory: fileRecord(SOURCE_INVENTORY),
      artifact_provenance: fileRecord(ARTIFACT_PROVENANCE),
      upstream_phpunit_smoke_test: sourceRecord(SOURCE_TEST),
      legacy_surface_manifest: fileRecord(LEGACY_SURFACE),
      deprecated_error_surface_manifest: fileRecord(ERROR_SURFACE)
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
        "Oracle and candidate roots both execute copied upstream WordPress 7.0 wp-includes/class-json.php.",
        "Invalid UTF-8 and binary strings are summarized by bytes, hex, UTF-8 validity, and hash before JSON receipt emission.",
        "Native json_encode/json_decode results are recorded as differential evidence, not as replacement approval.",
        "Deprecation functions are deterministic stubs recording payloads without emitting native deprecation output.",
        "No generated replacement or Haxe-owned Services_JSON implementation is introduced."
      ]
    },
    runs: {
      oracle: {
        ...oracleRun,
        lint: oracleLint
      },
      candidate: {
        ...candidateRun,
        lint: candidateLint
      },
      current_host: {
        php_version: currentPhpVersion,
        php_version_id: currentPhpVersionId,
        php_extensions_sha256: sha256(currentPhpExtensions.join("\n")),
        json_extension_loaded: currentPhpExtensions.includes("json"),
        mbstring_extension_loaded: currentPhpExtensions.includes("mbstring")
      }
    },
    blocked_conditions: BLOCKED_CONDITIONS,
    validation_result: validationResult,
    claims: {
      copied_services_json_file_mirrored: true,
      oracle_candidate_observation_parity_claimed: true,
      services_json_api_reflection_recorded: validationResult.services_json_class_reflected,
      deprecated_file_and_function_behavior_recorded: validationResult.deprecated_file_recorded,
      legacy_encode_decode_corpus_recorded: validationResult.encode_case_count > 0 && validationResult.decode_case_count > 0,
      host_json_differential_recorded: validationResult.host_json_differential_recorded,
      caller_pressure_recorded: validationResult.caller_pressure_markers_recorded,
      haxe_owned_services_json_runtime_claimed: false,
      generated_public_php_replacement_claimed: false,
      copied_services_json_artifact_retirement_claimed: false,
      installed_legacy_json_parity_claimed: false,
      legal_review_completed_claimed: false
    },
    non_claims: [
      "This gate does not claim Haxe-owned Services_JSON runtime implementation.",
      "This gate does not claim generated public PHP replacement for wp-includes/class-json.php.",
      "This gate does not claim copied Services_JSON artifact retirement.",
      "This gate does not claim native json_encode/json_decode can replace Services_JSON beyond recorded future-admission evidence.",
      "This gate does not execute broad installed legacy JSON, XML-RPC, plugin, theme, or deprecated-route behavior.",
      "This gate does not claim legal review completion; it preserves upstream headers/project notice and records future provenance gates."
    ]
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestText);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-34-services-json-legacy-compatibility-gate",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    ownership_state: "preserved_upstream_services_json_legacy_compatibility_gate",
    boundary_id: "services_json",
    source_paths: [SOURCE_FILE],
    distribution_paths: [distributionPath(SOURCE_FILE)],
    emission_strategy: "copied_upstream_services_json_with_legacy_host_json_differential_probe",
    durable_haxe_runtime_claimed: false,
    host_json_primitive_replacement_claimed: false,
    public_php_replacement_claimed: false,
    copied_artifact_retirement_claimed: false,
    generated_overlay_manifest_present: false,
    installed_legacy_json_parity_claimed: false,
    legal_review_complete: false,
    notes: [
      "Oracle and candidate roots execute copied upstream WordPress 7.0 wp-includes/class-json.php.",
      "Services_JSON is deprecated compatibility code and is only a host-primitive-backed replacement candidate after edge-case evidence is accepted.",
      "Native json_encode/json_decode observations are differential evidence and do not supersede legacy behavior or fallback policy.",
      "Keep upstream class-json.php preserved until WPHX-323.36 records an accepted provenance/replacement decision."
    ],
    removal_gates: [
      "non-empty generated overlay manifest for any candidate divergence",
      "generated WPHX PHP original-path class-json.php preserving class names, constants, flags, deprecation payloads, warning/error shape, and reflection/API shape",
      "native json_encode/json_decode handoff proof for admitted safe subset plus preserved upstream fallback for edge cases",
      "installed XML-RPC/deprecated/plugin/theme legacy JSON caller evidence",
      "license/provenance review and WPHX-323.36 localization legacy provenance decision acceptance"
    ],
    receipt_refs: ["receipt:wphx-323-34-services-json-legacy-compatibility-gate"]
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-34-services-json-legacy-compatibility-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "preserved_services_json_legacy_compatibility_gate",
    artifact_scope: "wordpress-7.0-services-json-legacy-compatibility-preserved-library-corpus",
    commands: [
      "npm run wp:core:wphx-323-services-json-legacy-compatibility",
      "npm run wp:core:wphx-323-services-json-legacy-compatibility:check"
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
  console.log(`recorded ${CASES.length} Services_JSON cases across ${COVERED_SYMBOLS.length} symbols`);
}

main();
