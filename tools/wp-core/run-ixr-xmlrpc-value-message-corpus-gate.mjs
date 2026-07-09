#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.32.5",
  external_ref: "WPHX-323.35",
  title: "Add IXR XML-RPC value message corpus gate"
};
const RECORDED_AT = "2026-07-09T05:15:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-ixr-xmlrpc-value-message-corpus-gate.mjs";
const OUT_ROOT = "build/wp-core/wphx-323-35";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/ixr-xmlrpc-value-message-probe.php`;
const LOADER_FILE = "src/wp-includes/class-IXR.php";

const SOURCE_FILES = [
  "src/wp-includes/IXR/class-IXR-base64.php",
  "src/wp-includes/IXR/class-IXR-client.php",
  "src/wp-includes/IXR/class-IXR-clientmulticall.php",
  "src/wp-includes/IXR/class-IXR-date.php",
  "src/wp-includes/IXR/class-IXR-error.php",
  "src/wp-includes/IXR/class-IXR-introspectionserver.php",
  "src/wp-includes/IXR/class-IXR-message.php",
  "src/wp-includes/IXR/class-IXR-request.php",
  "src/wp-includes/IXR/class-IXR-server.php",
  "src/wp-includes/IXR/class-IXR-value.php"
];

const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const LOCALIZATION_GATES = "manifests/wp-core/wphx-323-06-localization-legacy-vendor-replacement-gates.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const XMLRPC_SURFACE = "manifests/wp-core/wphx-318-01-xmlrpc-legacy-deprecated-surface.v1.json";
const XMLRPC_ADAPTER = "manifests/wp-core/wphx-318-02-xmlrpc-legacy-adapter-contract-candidate.v1.json";
const XMLRPC_ENDPOINT = "manifests/wp-core/wphx-318-03-xmlrpc-endpoint-server-oracle-fixture.v1.json";
const XMLRPC_INSTALLED_GATES = "manifests/wp-core/wphx-318-05-xmlrpc-installed-route-gates.v1.json";
const SOURCE_INVENTORY = "manifests/source-inventory.jsonl";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const OUT = "manifests/wp-core/wphx-323-35-ixr-xmlrpc-value-message-corpus-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-35-ixr-xmlrpc-value-message-corpus-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-35-ixr-xmlrpc-value-message-corpus-gate.v1.json";

const CASES = [
  { id: "ixr:source-boundary", focus: "ten-file wp-includes/IXR vendor boundary plus class-IXR.php include-order anchor" },
  { id: "ixr:api-reflection", focus: "IXR class reflection, PHP4 constructor shims, public properties, variadic signatures, and loader include behavior" },
  { id: "ixr:value-serialization", focus: "IXR_Value XML serialization for booleans, integers, doubles, strings, arrays, structs, objects, date, base64, and unsupported nil" },
  { id: "ixr:date-base64-error-request", focus: "IXR_Date, IXR_Base64, IXR_Error, and IXR_Request output and length behavior" },
  { id: "ixr:message-parsing", focus: "IXR_Message methodCall, methodResponse, fault, date, base64, array, struct, scalar, and default string parsing" },
  { id: "ixr:malformed-xml-and-parser-policy", focus: "malformed XML, invalid roots, doctype rejection, element limit, XML extension availability, and warning/error shape" },
  { id: "ixr:client-multicall", focus: "IXR_Client URL parsing, headers, transport-error mapping, and IXR_ClientMulticall call aggregation" },
  { id: "ixr:server-introspection", focus: "IXR_Server call/multicall/capability behavior and IXR_IntrospectionServer signature/help/type checks" },
  { id: "ixr:wphx-318-integration-requirements", focus: "WPHX-318 XML-RPC endpoint, route, and IXR handoff integration anchors" },
  { id: "ixr:generated-replacement-fallback-policy", focus: "generated replacement requirements, preserved fallback conditions, and explicit non-claims" }
];

const COVERED_SYMBOLS = [
  "IXR_Value",
  "IXR_Message",
  "IXR_Request",
  "IXR_Error",
  "IXR_Date",
  "IXR_Base64",
  "IXR_Client",
  "IXR_ClientMulticall",
  "IXR_Server",
  "IXR_IntrospectionServer",
  "wp-includes/class-IXR.php loader",
  "xml_parser_create",
  "xml_parse",
  "xmlrpc_element_limit",
  "xmlrpc_chunk_parsing_size",
  "WPHX-318 XML-RPC surface",
  "WPHX-318 endpoint/server fixture",
  "WPHX-318 installed route gates"
];

const BLOCKED_CONDITIONS = [
  {
    id: "haxe-owned-ixr-runtime",
    status: "blocked",
    reason: "The gate executes copied upstream IXR files through the WordPress class-IXR.php loader. No Haxe-owned IXR parser, serializer, client, or server implementation is introduced."
  },
  {
    id: "generated-public-ixr-replacement",
    status: "blocked",
    reason: "No WPHX PHP original-path IXR classes are emitted; generated replacement still needs class names, include order, reflection shape, XML-RPC serialization, XML parser fallback, and route integration evidence."
  },
  {
    id: "installed-xmlrpc-route-integration",
    status: "blocked",
    reason: "The gate records WPHX-318 integration anchors but does not execute installed xmlrpc.php HTTP routes, WordPress method handlers, auth/capability state, database-backed behavior, or plugin/theme callers."
  },
  {
    id: "xml-extension-host-matrix",
    status: "blocked",
    reason: "The gate records current-host XML extension availability and source fallback policy. A broader host matrix is required before replacing XML parser behavior."
  },
  {
    id: "copied-ixr-retirement",
    status: "blocked",
    reason: "Copied IXR artifacts stay preserved until WPHX-323.36 accepts a provenance/replacement decision with generated overlay, corpus, XML extension, installed route, and license evidence."
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

function sourceInventoryRecords() {
  const expected = new Set(SOURCE_FILES);
  return readJsonl(SOURCE_INVENTORY)
    .filter((record) => expected.has(record.path))
    .sort((a, b) => a.path.localeCompare(b.path))
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

function artifactRecords() {
  const expected = new Set(SOURCE_FILES.map(distributionPath));
  return readJsonl(ARTIFACT_PROVENANCE)
    .filter((record) => expected.has(record.path))
    .sort((a, b) => a.path.localeCompare(b.path))
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

function walkFiles(root, prefix = "") {
  const dir = `${root}${prefix ? `/${prefix}` : ""}`;
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = `${root}/${relative}`;
    if (entry.isDirectory()) return walkFiles(root, relative);
    if (entry.isFile()) return [full];
    return [];
  });
}

function actualIxrSourceFiles() {
  return walkFiles(upstreamPath("src/wp-includes/IXR"))
    .filter((path) => path.endsWith(".php"))
    .map((path) => path.replace(`${UPSTREAM_ROOT}/`, ""))
    .sort();
}

function mirrorSources(root) {
  rmSync(root, { recursive: true, force: true });
  for (const path of [...SOURCE_FILES, LOADER_FILE]) {
    mkdirSync(dirname(mirrorPath(root, path)), { recursive: true });
    copyFileSync(upstreamPath(path), mirrorPath(root, path));
  }
}

function packageDiffs(oracleRoot, candidateRoot) {
  const oracleFiles = walkFiles(oracleRoot).map((path) => path.replace(`${oracleRoot}/`, "")).sort();
  const candidateFiles = walkFiles(candidateRoot).map((path) => path.replace(`${candidateRoot}/`, "")).sort();
  const allFiles = [...new Set([...oracleFiles, ...candidateFiles])].sort();
  return allFiles.flatMap((path) => {
    const oraclePath = `${oracleRoot}/${path}`;
    const candidatePath = `${candidateRoot}/${path}`;
    if (!existsSync(oraclePath)) return [{ path, kind: "missing_from_oracle" }];
    if (!existsSync(candidatePath)) return [{ path, kind: "missing_from_candidate" }];
    const oracleHash = sha256File(oraclePath);
    const candidateHash = sha256File(candidatePath);
    if (oracleHash !== candidateHash) return [{ path, kind: "hash_mismatch", oracle_sha256: oracleHash, candidate_sha256: candidateHash }];
    return [];
  });
}

function sourceMarkers() {
  const loader = readFileSync(upstreamPath(LOADER_FILE), "utf8");
  const files = Object.fromEntries(
    SOURCE_FILES.map((path) => {
      const content = readFileSync(upstreamPath(path), "utf8");
      return [
        path,
        {
          distribution_path: distributionPath(path),
          package_ixr_marker: /@package\s+IXR/.test(content),
          since_150_marker: /@since\s+1\.5\.0/.test(content),
          php4_constructor_marker: /function\s+IXR_[A-Za-z0-9_]+\s*\(/.test(content),
          class_marker: /class\s+IXR_[A-Za-z0-9_]+/.test(content),
          xmlrpc_behavior_marker: /xml|method|fault|base64|date|multicall|capabilities|request|response/i.test(content)
        }
      ];
    })
  );
  const surface = readFileSync(XMLRPC_SURFACE, "utf8");
  const adapter = readFileSync(XMLRPC_ADAPTER, "utf8");
  const endpoint = readFileSync(XMLRPC_ENDPOINT, "utf8");
  const installed = readFileSync(XMLRPC_INSTALLED_GATES, "utf8");
  return {
    ixr_files: files,
    loader: {
      path: LOADER_FILE,
      distribution_path: distributionPath(LOADER_FILE),
      abspath_guard_marker: /if\s*\(\s*!\s*defined\(\s*'ABSPATH'\s*\)\s*\)\s*\{\s*die\(\s*'-1'\s*\)/s.test(loader),
      bsd_license_marker: /opensource\.org\/licenses\/bsd-license\.php|Redistribution and use in source and binary forms/.test(loader),
      package_ixr_marker: /@package\s+IXR/.test(loader),
      require_count: (loader.match(/require_once\s+ABSPATH\s+\.\s+WPINC\s+\.\s+'\/IXR\/class-IXR-/g) || []).length,
      required_files: SOURCE_FILES.every((path) => loader.includes(`/${distributionPath(path).replace("wp-includes/", "")}`))
    },
    wphx_318_integration: {
      surface_manifest: XMLRPC_SURFACE,
      adapter_manifest: XMLRPC_ADAPTER,
      endpoint_fixture_manifest: XMLRPC_ENDPOINT,
      installed_route_gate_manifest: XMLRPC_INSTALLED_GATES,
      ixr_preserved_boundary_marker: /IXR/.test(surface) && /preserved/.test(surface),
      adapter_ixr_handoff_marker: /IXR envelope handoff/.test(adapter),
      endpoint_ixr_fixture_marker: /src\/wp-includes\/class-IXR\.php/.test(endpoint) && /src\/wp-includes\/IXR/.test(endpoint),
      installed_ixr_gate_marker: /IXR request parsing/.test(installed) && /No generated or accepted preserved-boundary IXR parser/.test(installed)
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

$captured_errors = array();
$filter_calls = array();
$filter_overrides = array();

set_error_handler(function($errno, $errstr) {
\t$GLOBALS['captured_errors'][] = array(
\t\t'errno' => $errno,
\t\t'message' => $errstr,
\t);
\treturn true;
});

function __($text) {
\treturn $text;
}

function apply_filters($hook, $value) {
\t$GLOBALS['filter_calls'][] = array('hook' => $hook, 'value' => $value);
\tif (array_key_exists($hook, $GLOBALS['filter_overrides'])) {
\t\treturn $GLOBALS['filter_overrides'][$hook];
\t}
\treturn $value;
}

function wphx_ixr_echo($args) {
\treturn array('echo' => $args);
}

function wphx_ixr_sum($args) {
\treturn $args[0] + $args[1];
}

function wphx_ixr_error_result($args) {
\treturn new IXR_Error(700, 'callback <fault>');
}

define('ABSPATH', $root . '/');
define('WPINC', 'wp-includes');
require_once $root . '/wp-includes/class-IXR.php';

function wphx_hash_value($value) {
\treturn 'sha256:' . hash('sha256', $value);
}

function wphx_string_summary($value) {
\treturn array(
\t\t'type' => 'string',
\t\t'bytes' => strlen($value),
\t\t'sha256' => wphx_hash_value($value),
\t\t'hex' => bin2hex($value),
\t\t'preview' => substr($value, 0, 240),
\t);
}

function wphx_value_summary($value, $depth = 0) {
\tif ($depth > 5) {
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
\t\treturn array('type' => 'object', 'class' => get_class($value), 'properties' => $properties);
\t}
\treturn array('type' => gettype($value));
}

function wphx_xml_summary($xml) {
\treturn array(
\t\t'bytes' => strlen($xml),
\t\t'sha256' => wphx_hash_value($xml),
\t\t'preview' => substr($xml, 0, 320),
\t\t'value' => $xml,
\t);
}

function wphx_before_counts() {
\treturn array(
\t\t'errors' => count($GLOBALS['captured_errors']),
\t\t'filters' => count($GLOBALS['filter_calls']),
\t);
}

function wphx_delta_since($before) {
\treturn array(
\t\t'errors' => array_slice($GLOBALS['captured_errors'], $before['errors']),
\t\t'filters' => array_slice($GLOBALS['filter_calls'], $before['filters']),
\t);
}

function wphx_run_case($id, $callback) {
\t$before = wphx_before_counts();
\ttry {
\t\t$result = $callback();
\t\treturn array('id' => $id, 'threw' => false, 'result' => wphx_value_summary($result), 'delta' => wphx_delta_since($before));
\t} catch (Throwable $throwable) {
\t\treturn array(
\t\t\t'id' => $id,
\t\t\t'threw' => true,
\t\t\t'throwable' => array('class' => get_class($throwable), 'message' => $throwable->getMessage()),
\t\t\t'delta' => wphx_delta_since($before),
\t\t);
\t}
}

function wphx_run_message($id, $xml) {
\t$before = wphx_before_counts();
\t$message = new IXR_Message($xml);
\t$parsed = $message->parse();
\treturn array(
\t\t'id' => $id,
\t\t'input' => wphx_xml_summary($xml),
\t\t'parsed' => $parsed,
\t\t'message_type' => $message->messageType,
\t\t'method_name' => $message->methodName,
\t\t'fault_code' => $message->faultCode,
\t\t'fault_string' => $message->faultString,
\t\t'params' => wphx_value_summary($message->params),
\t\t'delta' => wphx_delta_since($before),
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
\t\t\t'variadic' => $parameter->isVariadic(),
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

$classes = array(
\t'IXR_Value',
\t'IXR_Message',
\t'IXR_Request',
\t'IXR_Error',
\t'IXR_Date',
\t'IXR_Base64',
\t'IXR_Client',
\t'IXR_ClientMulticall',
\t'IXR_Server',
\t'IXR_IntrospectionServer',
);
$reflection = array();
foreach ($classes as $class) {
\t$reflection[$class] = wphx_reflect_class($class);
}
$observations['ixr:api-reflection'] = array(
\t'classes' => $reflection,
\t'loaded_classes' => array_values(array_filter($classes, fn($class) => class_exists($class, false))),
\t'loader_defined_abspath' => defined('ABSPATH'),
\t'loader_defined_wpinc' => defined('WPINC'),
);

$date = new IXR_Date('20240709T10:11:12Z');
$date_from_timestamp = new IXR_Date(0);
$base64 = new IXR_Base64(\"binary\\0data\");
$object = new stdClass();
$object->name = 'object name';
$object->count = 3;
$value_cases = array(
\t'boolean_true' => new IXR_Value(true),
\t'boolean_false' => new IXR_Value(false),
\t'int' => new IXR_Value(42),
\t'double' => new IXR_Value(3.25),
\t'string_escape' => new IXR_Value('Tom & \"Jerry\" <xml>'),
\t'indexed_array' => new IXR_Value(array('one', 2, false)),
\t'struct_array' => new IXR_Value(array('alpha' => 1, 'beta' => 'two')),
\t'object_struct' => new IXR_Value($object),
\t'date' => new IXR_Value($date),
\t'base64' => new IXR_Value($base64),
\t'nil_explicit_unsupported' => new IXR_Value(null, 'nil'),
);
$value_summaries = array();
foreach ($value_cases as $id => $value) {
\t$value_summaries[$id] = array(
\t\t'type' => $value->type,
\t\t'data' => wphx_value_summary($value->data),
\t\t'xml' => wphx_xml_summary((string) $value->getXml()),
\t);
}
$observations['ixr:value-serialization'] = array(
\t'cases' => $value_summaries,
\t'is_struct' => array(
\t\t'indexed' => (new IXR_Value(array()))->isStruct(array('a', 'b')),
\t\t'associative' => (new IXR_Value(array()))->isStruct(array('a' => 1)),
\t\t'sparse_numeric' => (new IXR_Value(array()))->isStruct(array(0 => 'zero', 2 => 'two')),
\t),
);

$request = new IXR_Request('demo.echo', array('alpha', 7, $date, $base64, array('nested' => true)));
$error = new IXR_Error(321, 'bad <fault> & escaped');
$observations['ixr:date-base64-error-request'] = array(
\t'date_iso' => $date->getIso(),
\t'date_timestamp' => $date->getTimestamp(),
\t'date_from_timestamp_iso' => $date_from_timestamp->getIso(),
\t'date_xml' => wphx_xml_summary($date->getXml()),
\t'base64_xml' => wphx_xml_summary($base64->getXml()),
\t'error_properties' => wphx_value_summary($error),
\t'error_xml' => wphx_xml_summary($error->getXml()),
\t'request_method' => $request->method,
\t'request_args' => wphx_value_summary($request->args),
\t'request_length' => $request->getLength(),
\t'request_xml' => wphx_xml_summary($request->getXml()),
);

$method_call_xml = '<?xml version=\"1.0\"?><methodCall><methodName>demo.echo</methodName><params>'
\t. '<param><value><string>hello</string></value></param>'
\t. '<param><value><int>42</int></value></param>'
\t. '<param><value><boolean>1</boolean></value></param>'
\t. '<param><value><double>3.5</double></value></param>'
\t. '<param><value><dateTime.iso8601>20240709T10:11:12Z</dateTime.iso8601></value></param>'
\t. '<param><value><base64>' . base64_encode(\"binary\\0data\") . '</base64></value></param>'
\t. '<param><value><array><data><value><string>a</string></value><value><int>2</int></value></data></array></value></param>'
\t. '<param><value><struct><member><name>x</name><value><int>1</int></value></member><member><name>y</name><value><string>two</string></value></member></struct></value></param>'
\t. '<param><value>implicit string</value></param>'
\t. '</params></methodCall>';
$method_response_xml = '<?xml version=\"1.0\"?><methodResponse><params><param><value><struct><member><name>ok</name><value><boolean>1</boolean></value></member></struct></value></param></params></methodResponse>';
$fault_xml = '<?xml version=\"1.0\"?><methodResponse><fault><value><struct><member><name>faultCode</name><value><int>500</int></value></member><member><name>faultString</name><value><string>broken &amp; escaped</string></value></member></struct></value></fault></methodResponse>';
$observations['ixr:message-parsing'] = array(
\t'method_call' => wphx_run_message('method-call', $method_call_xml),
\t'method_response' => wphx_run_message('method-response', $method_response_xml),
\t'fault_response' => wphx_run_message('fault-response', $fault_xml),
);

$GLOBALS['filter_overrides'] = array();
$malformed = array(
\t'empty' => '',
\t'invalid_root' => '<notXmlRpc></notXmlRpc>',
\t'doctype_only' => '<!DOCTYPE foo>',
\t'malformed_xml' => '<methodCall><methodName>demo</methodName><params><param></methodCall>',
\t'method_response_without_param' => '<methodResponse><params></params></methodResponse>',
);
$malformed_results = array();
foreach ($malformed as $id => $xml) {
\t$malformed_results[$id] = wphx_run_message($id, $xml);
}
$GLOBALS['filter_overrides']['xmlrpc_element_limit'] = 1;
$malformed_results['element_limit_exceeded'] = wphx_run_message(
\t'element-limit-exceeded',
\t'<methodCall><methodName>demo.echo</methodName><params><param><value><array><data><value><string>a</string></value><value><string>b</string></value></data></array></value></param></params></methodCall>'
);
$GLOBALS['filter_overrides'] = array();
$GLOBALS['filter_overrides']['xmlrpc_chunk_parsing_size'] = 32;
$malformed_results['small_chunk_success'] = wphx_run_message('small-chunk-success', $method_call_xml);
$GLOBALS['filter_overrides'] = array();
$observations['ixr:malformed-xml-and-parser-policy'] = array(
\t'function_exists_xml_parser_create' => function_exists('xml_parser_create'),
\t'xml_extension_loaded' => extension_loaded('xml'),
\t'xml_parser_create_recorded_fallback_source_behavior' => true,
\t'cases' => $malformed_results,
);

$client_url = new IXR_Client('http://example.com/rpc.php?token=abc#frag');
$client_explicit = new IXR_Client('rpc.example.test', '/RPC2', 8080, 3);
$transport = wphx_run_case('client-transport-error', function() {
\t$client = new IXR_Client('127.0.0.1', '/RPC2', 1, 1);
\t$ok = $client->query('demo.echo', 'payload');
\treturn array(
\t\t'ok' => $ok,
\t\t'is_error' => $client->isError(),
\t\t'error_code' => $client->isError() ? $client->getErrorCode() : null,
\t\t'error_message' => $client->isError() ? $client->getErrorMessage() : null,
\t);
});
$multicall = new IXR_ClientMulticall('http://example.com/xmlrpc.php');
$multicall->addCall('demo.echo', 'one');
$multicall->addCall('demo.sum', 2, 3);
$observations['ixr:client-multicall'] = array(
\t'url_client' => wphx_value_summary($client_url),
\t'explicit_client' => wphx_value_summary($client_explicit),
\t'transport_error' => $transport,
\t'multicall_client' => wphx_value_summary($multicall),
);

$server = new IXR_Server(array('demo.echo' => 'wphx_ixr_echo', 'demo.sum' => 'wphx_ixr_sum', 'demo.error' => 'wphx_ixr_error_result'), false, true);
$server_call_results = array(
\t'has_demo_echo' => $server->hasMethod('demo.echo'),
\t'has_missing' => $server->hasMethod('missing.method'),
\t'list_methods' => $server->listMethods(array()),
\t'capabilities' => $server->getCapabilities(array()),
\t'call_echo_single_arg' => $server->call('demo.echo', array(array('payload'))),
\t'call_sum_two_args' => $server->call('demo.sum', array(2, 3)),
\t'call_missing' => $server->call('missing.method', array()),
\t'call_callback_error' => $server->call('demo.error', array('x')),
\t'multicall' => $server->multiCall(array(
\t\tarray('methodName' => 'demo.echo', 'params' => array(array('m' => 'one'))),
\t\tarray('methodName' => 'missing.method', 'params' => array()),
\t\tarray('methodName' => 'system.multicall', 'params' => array()),
\t)),
);
$introspection = new IXR_IntrospectionServer();
$introspection->addCallback('demo.sum', 'wphx_ixr_sum', array('int', 'int', 'int'), 'Adds two integers');
$introspection_results = array(
\t'list_methods' => $introspection->listMethods(array()),
\t'capabilities' => $introspection->getCapabilities(array()),
\t'method_signature' => $introspection->methodSignature('demo.sum'),
\t'method_help' => $introspection->methodHelp('demo.sum'),
\t'call_valid' => $introspection->call('demo.sum', array(4, 5)),
\t'call_wrong_count' => $introspection->call('demo.sum', array(4)),
\t'call_wrong_type' => $introspection->call('demo.sum', array('4', 5)),
\t'call_missing' => $introspection->call('missing.method', array()),
);
$observations['ixr:server-introspection'] = array(
\t'server_callbacks' => wphx_value_summary($server->callbacks),
\t'server_call_results' => wphx_value_summary($server_call_results),
\t'introspection_callbacks' => wphx_value_summary($introspection->callbacks),
\t'introspection_results' => wphx_value_summary($introspection_results),
);

$observations['ixr:generated-replacement-fallback-policy'] = array(
\t'direct_haxe_ixr_port_candidate' => true,
\t'haxe_owned_ixr_runtime_claimed' => false,
\t'generated_public_php_replacement_claimed' => false,
\t'copied_ixr_artifact_retirement_claimed' => false,
\t'installed_xmlrpc_route_parity_claimed' => false,
\t'xml_extension_host_matrix_closed_claimed' => false,
\t'fallback_policy' => 'Preserve upstream IXR for XML extension differences, malformed XML, client/server edge cases, and installed XML-RPC behavior until all route/corpus fixtures pass.',
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
  const strategyPlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "ixr");
  const parentGate = localizationGates.gate_plan.find((entry) => entry.id === "ixr-xmlrpc-value-message-corpus");
  const boundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "ixr");
  const actualFiles = actualIxrSourceFiles();
  if (JSON.stringify(actualFiles) !== JSON.stringify(SOURCE_FILES)) {
    failures.push(`IXR source boundary drifted: ${actualFiles.join(", ")}`);
  }
  if (strategyPlan?.replacement_strategy !== "direct_haxe_port_preserving_vendor_api") {
    failures.push(`unexpected IXR replacement strategy: ${strategyPlan?.replacement_strategy}`);
  }
  if (parentGate?.downstream_issue.external_ref !== ISSUE.external_ref) {
    failures.push(`WPHX-323.06 IXR gate is not routed to ${ISSUE.external_ref}`);
  }
  if (boundary?.source_inventory.count !== SOURCE_FILES.length || boundary?.distribution_artifacts.count !== SOURCE_FILES.length || boundary?.source_tree.php_file_count !== SOURCE_FILES.length) {
    failures.push("WPHX-323 vendor closure IXR counts do not match the expected ten PHP files");
  }
  if (sourceInventory.length !== SOURCE_FILES.length) failures.push(`expected ${SOURCE_FILES.length} source inventory records, found ${sourceInventory.length}`);
  if (artifactEvidence.length !== SOURCE_FILES.length) failures.push(`expected ${SOURCE_FILES.length} artifact provenance records, found ${artifactEvidence.length}`);
  if (failures.length > 0) {
    throw new Error(`WPHX-323.35 IXR corpus gate failed input validation:\n- ${failures.join("\n- ")}`);
  }
  return { strategyPlan, parentGate, boundary };
}

function main() {
  const strategy = readJson(STRATEGY);
  const localizationGates = readJson(LOCALIZATION_GATES);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const sourceInventory = sourceInventoryRecords();
  const artifactEvidence = artifactRecords();
  const inputs = validateInputs({ strategy, localizationGates, vendorClosure, sourceInventory, artifactEvidence });
  const markers = sourceMarkers();

  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  const packageDiff = packageDiffs(ORACLE_ROOT, CANDIDATE_ROOT);
  if (packageDiff.length > 0) {
    throw new Error(`Copied oracle and candidate IXR packages diverged: ${JSON.stringify(packageDiff, null, 2)}`);
  }
  writeProbe();

  const lintFiles = [...SOURCE_FILES, LOADER_FILE];
  const oracleLint = Object.fromEntries(lintFiles.map((path) => [path, commandResult("php", ["-l", mirrorPath(ORACLE_ROOT, path)])]));
  const candidateLint = Object.fromEntries(lintFiles.map((path) => [path, commandResult("php", ["-l", mirrorPath(CANDIDATE_ROOT, path)])]));
  const oracleRun = runProbe(ORACLE_ROOT);
  const candidateRun = runProbe(CANDIDATE_ROOT);
  const observationsMatch = JSON.stringify(oracleRun.result.observations) === JSON.stringify(candidateRun.result.observations);
  if (!observationsMatch) {
    throw new Error("oracle and candidate IXR observations diverged");
  }

  const currentPhpVersion = command("php", ["-r", "echo PHP_VERSION;"]);
  const currentPhpVersionId = Number(command("php", ["-r", "echo PHP_VERSION_ID;"]));
  const currentPhpExtensions = command("php", ["-m"]).split("\n").sort();
  const allLintOk = Object.values(oracleLint).every((result) => result.status === 0) && Object.values(candidateLint).every((result) => result.status === 0);
  const reflection = oracleRun.result.observations["ixr:api-reflection"];
  const values = oracleRun.result.observations["ixr:value-serialization"];
  const message = oracleRun.result.observations["ixr:message-parsing"];
  const malformed = oracleRun.result.observations["ixr:malformed-xml-and-parser-policy"];
  const client = oracleRun.result.observations["ixr:client-multicall"];
  const server = oracleRun.result.observations["ixr:server-introspection"];
  const fallback = oracleRun.result.observations["ixr:generated-replacement-fallback-policy"];
  const integrationMarkers = markers.wphx_318_integration;
  const validationResult = {
    status: "passed",
    source_php_file_count: SOURCE_FILES.length,
    support_loader_file_count: 1,
    source_inventory_record_count: sourceInventory.length,
    artifact_provenance_record_count: artifactEvidence.length,
    covered_symbol_count: COVERED_SYMBOLS.length,
    case_count: CASES.length,
    oracle_candidate_observations_match: observationsMatch,
    oracle_candidate_package_diffs_empty: packageDiff.length === 0,
    all_lint_exit_statuses_ok: allLintOk,
    current_php_version: currentPhpVersion,
    current_php_version_id: currentPhpVersionId,
    xml_extension_loaded: currentPhpExtensions.includes("xml"),
    reflected_class_count: Object.keys(reflection.classes).length,
    loader_require_count: markers.loader.require_count,
    loader_license_marker_recorded: markers.loader.bsd_license_marker,
    ixr_package_markers_recorded: Object.values(markers.ixr_files).every((entry) => entry.package_ixr_marker),
    value_serialization_case_count: Object.keys(values.cases).length,
    unsupported_nil_recorded: values.cases.nil_explicit_unsupported.xml.value === "",
    method_call_parsed: message.method_call.parsed === true && message.method_call.message_type === "methodCall",
    method_response_parsed: message.method_response.parsed === true && message.method_response.message_type === "methodResponse",
    fault_response_parsed: message.fault_response.parsed === true && message.fault_response.fault_code === 500,
    malformed_xml_cases_recorded: Object.keys(malformed.cases).length,
    xml_parser_availability_recorded: typeof malformed.function_exists_xml_parser_create === "boolean",
    element_limit_case_recorded: malformed.cases.element_limit_exceeded.parsed === false,
    client_transport_error_recorded: client.transport_error.result.type === "array",
    multicall_calls_recorded: client.multicall_client.properties.calls.count === 2,
    server_multicall_recorded: server.server_call_results.entries.length > 0,
    introspection_signature_recorded: server.introspection_results.entries.length > 0,
    wphx_318_integration_markers_recorded:
      integrationMarkers.ixr_preserved_boundary_marker &&
      integrationMarkers.adapter_ixr_handoff_marker &&
      integrationMarkers.endpoint_ixr_fixture_marker &&
      integrationMarkers.installed_ixr_gate_marker,
    haxe_owned_ixr_runtime_claimed: false,
    generated_public_php_replacement_claimed: false,
    copied_ixr_artifact_retirement_claimed: false,
    installed_xmlrpc_route_parity_claimed: false,
    legal_review_completed_claimed: false,
    fallback_policy_recorded: fallback.copied_ixr_artifact_retirement_claimed === false
  };
  const requiredValidationFlags = [
    "oracle_candidate_observations_match",
    "oracle_candidate_package_diffs_empty",
    "all_lint_exit_statuses_ok",
    "loader_license_marker_recorded",
    "ixr_package_markers_recorded",
    "unsupported_nil_recorded",
    "method_call_parsed",
    "method_response_parsed",
    "fault_response_parsed",
    "xml_parser_availability_recorded",
    "element_limit_case_recorded",
    "client_transport_error_recorded",
    "multicall_calls_recorded",
    "server_multicall_recorded",
    "introspection_signature_recorded",
    "wphx_318_integration_markers_recorded",
    "fallback_policy_recorded"
  ];
  const failedValidationFlags = requiredValidationFlags.filter((key) => validationResult[key] !== true);
  if (failedValidationFlags.length > 0) {
    throw new Error(`WPHX-323.35 validation flags failed: ${failedValidationFlags.join(", ")}`);
  }

  const manifest = {
    schema: "wphx.wp-core.ixr-xmlrpc-value-message-corpus-gate.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "preserved_ixr_xmlrpc_value_message_corpus_gate",
    boundary_id: "ixr",
    source_root: "src/wp-includes/IXR",
    distribution_root: "wp-includes/IXR",
    support_loader_path: LOADER_FILE,
    inputs: {
      vendor_strategy_manifest: fileRecord(STRATEGY),
      localization_legacy_vendor_gate_manifest: fileRecord(LOCALIZATION_GATES),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      source_inventory: fileRecord(SOURCE_INVENTORY),
      artifact_provenance: fileRecord(ARTIFACT_PROVENANCE),
      wphx_318_surface_manifest: fileRecord(XMLRPC_SURFACE),
      wphx_318_adapter_contract_manifest: fileRecord(XMLRPC_ADAPTER),
      wphx_318_endpoint_fixture_manifest: fileRecord(XMLRPC_ENDPOINT),
      wphx_318_installed_route_gate_manifest: fileRecord(XMLRPC_INSTALLED_GATES),
      class_ixr_loader: sourceRecord(LOADER_FILE)
    },
    replacement_strategy: {
      current_strategy: inputs.strategyPlan.current_strategy,
      planned_strategy: inputs.strategyPlan.replacement_strategy,
      parent_gate_id: inputs.parentGate.id,
      fallback_policy: inputs.parentGate.fallback_policy,
      removal_gate: inputs.parentGate.removal_gate,
      generated_public_wrapper_requirements: inputs.parentGate.generated_public_wrapper_requirements
    },
    source_files: SOURCE_FILES.map(sourceRecord),
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
        "Oracle and candidate roots both execute copied upstream WordPress 7.0 IXR files through copied wp-includes/class-IXR.php.",
        "The WPHX-323 IXR boundary remains the ten files under wp-includes/IXR; class-IXR.php is a loader/integration anchor.",
        "Current-host XML extension availability is recorded; absent-extension behavior remains fallback-policy evidence until a host matrix is added.",
        "IXR_Server output/exit and installed xmlrpc.php HTTP route behavior are not executed in this isolated corpus gate.",
        "No generated replacement or Haxe-owned IXR implementation is introduced."
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
      package_diffs: packageDiff,
      current_host: {
        php_version: currentPhpVersion,
        php_version_id: currentPhpVersionId,
        php_extensions_sha256: sha256(currentPhpExtensions.join("\n")),
        xml_extension_loaded: currentPhpExtensions.includes("xml")
      }
    },
    blocked_conditions: BLOCKED_CONDITIONS,
    validation_result: validationResult,
    claims: {
      copied_ixr_package_mirrored: true,
      class_ixr_loader_executed_as_support_anchor: true,
      oracle_candidate_observation_parity_claimed: true,
      ixr_api_reflection_recorded: validationResult.reflected_class_count === 10,
      value_message_request_corpus_recorded: true,
      client_server_multicall_introspection_recorded: true,
      wphx_318_integration_requirements_recorded: validationResult.wphx_318_integration_markers_recorded,
      haxe_owned_ixr_runtime_claimed: false,
      generated_public_php_replacement_claimed: false,
      copied_ixr_artifact_retirement_claimed: false,
      installed_xmlrpc_route_parity_claimed: false,
      legal_review_completed_claimed: false
    },
    non_claims: [
      "This gate does not claim Haxe-owned IXR runtime implementation.",
      "This gate does not claim generated public PHP replacement for wp-includes/IXR or wp-includes/class-IXR.php.",
      "This gate does not claim copied IXR artifact retirement.",
      "This gate does not execute full installed xmlrpc.php HTTP route behavior, WordPress XML-RPC method handlers, auth/capability state, database-backed behavior, or plugin/theme callers.",
      "This gate does not close XML extension host-matrix support.",
      "This gate does not claim legal review completion; it preserves upstream headers/project notice and records future provenance gates."
    ]
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestText);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-35-ixr-xmlrpc-value-message-corpus-gate",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    ownership_state: "preserved_upstream_ixr_xmlrpc_value_message_corpus_gate",
    boundary_id: "ixr",
    source_paths: SOURCE_FILES,
    distribution_paths: SOURCE_FILES.map(distributionPath),
    support_paths: [LOADER_FILE],
    emission_strategy: "copied_upstream_ixr_package_with_xmlrpc_value_message_corpus_probe",
    durable_haxe_runtime_claimed: false,
    public_php_replacement_claimed: false,
    copied_artifact_retirement_claimed: false,
    generated_overlay_manifest_present: false,
    installed_xmlrpc_route_parity_claimed: false,
    xml_extension_host_matrix_closed: false,
    legal_review_complete: false,
    notes: [
      "Oracle and candidate roots execute copied upstream WordPress 7.0 IXR files through the copied class-IXR.php loader.",
      "The WPHX-323 IXR boundary includes ten PHP files under wp-includes/IXR; class-IXR.php is recorded as a loader/integration anchor.",
      "Current-host XML extension availability is recorded as host evidence and does not close absent-extension support.",
      "Keep upstream IXR preserved until WPHX-323.36 records an accepted provenance/replacement decision."
    ],
    removal_gates: [
      "non-empty generated overlay manifest for any candidate divergence",
      "generated WPHX PHP original-path IXR classes preserving class names, include order, reflection shape, XML-RPC serialization, fault behavior, and XML parser fallback policy",
      "IXR value/message/request/client/server/multicall/introspection corpus across representative XML extension host matrix",
      "installed xmlrpc.php HTTP route and WPHX-318 method-handler integration evidence",
      "license/provenance review and WPHX-323.36 localization legacy provenance decision acceptance"
    ],
    receipt_refs: ["receipt:wphx-323-35-ixr-xmlrpc-value-message-corpus-gate"]
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-35-ixr-xmlrpc-value-message-corpus-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "preserved_ixr_xmlrpc_value_message_corpus_gate",
    artifact_scope: "wordpress-7.0-ixr-xmlrpc-value-message-preserved-library-corpus",
    commands: [
      "npm run wp:core:wphx-323-ixr-xmlrpc-value-message-corpus",
      "npm run wp:core:wphx-323-ixr-xmlrpc-value-message-corpus:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      parent_localization_legacy_gate_manifest: LOCALIZATION_GATES,
      parent_vendor_strategy_manifest: STRATEGY,
      parent_vendor_closure_manifest: VENDOR_CLOSURE,
      wphx_318_endpoint_fixture_manifest: XMLRPC_ENDPOINT,
      wphx_318_installed_route_gate_manifest: XMLRPC_INSTALLED_GATES
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
  console.log(`recorded ${CASES.length} IXR XML-RPC cases across ${COVERED_SYMBOLS.length} symbols`);
}

main();
