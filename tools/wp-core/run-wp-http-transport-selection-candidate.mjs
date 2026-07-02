#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-3d1",
  external_ref: "WPHX-312.66",
  title: "WPHX-312.66 - Promote WP_Http deprecated transport selection naming to Haxe candidate"
};
const RECORDED_AT = "2026-06-28T04:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-wp-http-transport-selection-candidate.mjs";
const HXML = "fixtures/wp-core/http-transport-selection-candidate.hxml";
const WPHX_PHP_HXML = "fixtures/wphx-php/wp-http-transport-selection.hxml";
const OUT_ROOT = "build/wp-core/wphx-312-66";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const WPHX_PHP_ROOT = `${OUT_ROOT}/wphx-php`;
const WPHX_PHP_MANIFEST = `${WPHX_PHP_ROOT}/wphx-php-emission.v1.json`;
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-312-66-wp-http-transport-selection-candidate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-66-wp-http-transport-selection-candidate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-66-wp-http-transport-selection-candidate.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const HTTP_TRANSPORT_FIXTURE = "manifests/wp-core/wphx-312-45-http-transport-callback-test-oracle-fixture.v1.json";
const HTTP_REQUEST_FIXTURE = "manifests/wp-core/wphx-312-46-wp-http-request-orchestration-oracle-fixture.v1.json";
const TRANSPORT_DISPATCH_FIXTURE = "manifests/wp-core/wphx-312-48-wp-http-transport-dispatch-oracle-fixture.v1.json";
const SOURCE_FILES = ["src/wp-includes/class-wp-http.php"];
const HAXE_SOURCES = [
  HXML,
  WPHX_PHP_HXML,
  "src/wphx/wp/http/HttpTransportSelection.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/HttpTransportSelectionCandidateEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/HaxeHttpTransportSelection.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/HttpTransportSelectionEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/WpHttpTransportSelectionShell.hx"
];
const HAXE_MODULE = "\\wphx\\wp\\http\\_HttpTransportSelection\\HttpTransportSelection_Fields_";
const PROMOTED_SYMBOLS = [
  "WP_Http::_get_first_available_transport default transport token list",
  "WP_Http::_get_first_available_transport core transport token recognition",
  "WP_Http::_get_first_available_transport WP_Http_* class name construction",
  "WPHX PHP core IR emission for WP_Http::_get_first_available_transport public adapter body",
  "WPHX PHP core IR emission for WP_Http::_dispatch_request private adapter body"
];
const COVERED_SYMBOLS = [
  "WP_Http::_get_first_available_transport",
  "WP_Http::_dispatch_request",
  "http_api_transports",
  "apply_filters_deprecated",
  "http_api_debug",
  "http_response",
  "WP_Http_Curl::test",
  "WP_Http_Streams::test",
  "WP_Http_Curl::request",
  "WP_Http_Streams::request",
  "WP_Error"
];
const CASES = [
  { id: "wp-http-transport:default-curl", focus: "default curl-first transport selection" },
  { id: "wp-http-transport:streams-fallback", focus: "streams fallback when curl test fails" },
  { id: "wp-http-transport:deprecated-order-filter", focus: "http_api_transports deprecated filter can reorder transport checks" },
  { id: "wp-http-transport:no-transport", focus: "no available transport returns false" },
  { id: "wp-http-transport:dispatch-success", focus: "private dispatch invokes selected transport, debug action, and response filter" },
  { id: "wp-http-transport:dispatch-error", focus: "private dispatch returns WP_Error for no transport and preserves transport WP_Error" }
];

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 50
  }).trim();
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function inputRecord(path) {
  return { path, bytes: statSync(path).size, sha256: sha256File(path) };
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
    repo_path: upstreamPath(path),
    bytes: statSync(upstreamPath(path)).size,
    sha256: sha256File(upstreamPath(path))
  };
}

function mirrorSources(root) {
  for (const path of SOURCE_FILES) {
    const target = mirrorPath(root, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(upstreamPath(path), target);
  }
}

function installCompilerEmittedCandidateShell() {
  const generated = `${WPHX_PHP_ROOT}/wp-includes/class-wp-http.php`;
  const target = `${CANDIDATE_ROOT}/wp-includes/class-wp-http.php`;
  if (!existsSync(generated)) throw new Error(`Missing compiler-emitted shell ${generated}`);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(generated, target);
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
namespace WpOrg\\Requests {
\tclass Autoload {
\t\tpublic static function register() {}
\t}

\tclass Requests {
\t\tpublic static function set_certificate_path( $path ) {}
\t}
}

namespace {
$root = rtrim( $argv[1], '/\\\\' );
$case = $argv[2] ?? '';

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );

$GLOBALS['wphx_transport_tests'] = array();
$GLOBALS['wphx_transport_requests'] = array();
$GLOBALS['wphx_deprecated_filters'] = array();
$GLOBALS['wphx_actions'] = array();
$GLOBALS['wphx_filters'] = array();

class WP_Error {
\tpublic $errors = array();

\tpublic function __construct( $code = '', $message = '' ) {
\t\tif ( '' !== $code ) {
\t\t\t$this->errors[ $code ][] = $message;
\t\t}
\t}

\tpublic function get_error_code() {
\t\t$codes = array_keys( $this->errors );
\t\treturn $codes[0] ?? '';
\t}

\tpublic function get_error_message( $code = '' ) {
\t\t$code = $code ?: $this->get_error_code();
\t\treturn $this->errors[ $code ][0] ?? '';
\t}
}

class WP_Http_Curl {
\tpublic static $constructs = 0;

\tpublic function __construct() {
\t\tself::$constructs++;
\t}

\tpublic static function test( $args = array(), $url = null ) {
\t\t$GLOBALS['wphx_transport_tests'][] = array( 'class' => __CLASS__, 'args' => $args, 'url' => $url );
\t\treturn empty( $args['disable_curl'] );
\t}

\tpublic function request( $url, $args ) {
\t\t$GLOBALS['wphx_transport_requests'][] = array( 'class' => __CLASS__, 'url' => $url, 'args' => $args );
\t\tif ( ! empty( $args['return_transport_error'] ) ) {
\t\t\treturn new WP_Error( 'transport_failed', 'transport failure' );
\t\t}
\t\treturn array( 'headers' => array( 'x-transport' => 'curl' ), 'body' => 'curl:' . $url, 'response' => array( 'code' => 200, 'message' => 'OK' ), 'cookies' => array(), 'filename' => null );
\t}
}

class WP_Http_Streams {
\tpublic static $constructs = 0;

\tpublic function __construct() {
\t\tself::$constructs++;
\t}

\tpublic static function test( $args = array(), $url = null ) {
\t\t$GLOBALS['wphx_transport_tests'][] = array( 'class' => __CLASS__, 'args' => $args, 'url' => $url );
\t\treturn empty( $args['disable_streams'] );
\t}

\tpublic function request( $url, $args ) {
\t\t$GLOBALS['wphx_transport_requests'][] = array( 'class' => __CLASS__, 'url' => $url, 'args' => $args );
\t\treturn array( 'headers' => array( 'x-transport' => 'streams' ), 'body' => 'streams:' . $url, 'response' => array( 'code' => 200, 'message' => 'OK' ), 'cookies' => array(), 'filename' => null );
\t}
}

function __( $text ) {
\treturn $text;
}

function is_wp_error( $thing ) {
\treturn $thing instanceof WP_Error;
}

function apply_filters_deprecated( $hook, $args, $version ) {
\t$GLOBALS['wphx_deprecated_filters'][] = array( 'hook' => $hook, 'args' => $args, 'version' => $version );
\t$request_args = $args[1] ?? array();
\tif ( isset( $request_args['order'] ) ) {
\t\treturn $request_args['order'];
\t}
\treturn $args[0];
}

function apply_filters( $hook, $value, ...$args ) {
\t$GLOBALS['wphx_filters'][] = array( 'hook' => $hook, 'value' => wphx_summarize( $value ), 'args' => wphx_summarize( $args ) );
\tif ( 'http_response' === $hook && is_array( $value ) ) {
\t\t$value['filtered'] = true;
\t\treturn $value;
\t}
\treturn $value;
}

function do_action( $hook, ...$args ) {
\t$GLOBALS['wphx_actions'][] = array( 'hook' => $hook, 'args' => wphx_summarize( $args ) );
}

function wphx_summarize( $value ) {
\tif ( $value instanceof WP_Error ) {
\t\treturn array( 'wp_error' => $value->get_error_code(), 'message' => $value->get_error_message() );
\t}
\tif ( is_array( $value ) ) {
\t\t$out = array();
\t\tforeach ( $value as $key => $item ) {
\t\t\t$out[ $key ] = wphx_summarize( $item );
\t\t}
\t\treturn $out;
\t}
\treturn $value;
}

function wphx_error_summary( $value ) {
\treturn $value instanceof WP_Error ? array( 'code' => $value->get_error_code(), 'message' => $value->get_error_message() ) : null;
}

require ABSPATH . WPINC . '/class-wp-http.php';

$http = new WP_Http();
$assertions = array();
$result = array( 'case' => $case );

switch ( $case ) {
\tcase 'wp-http-transport:default-curl':
\t\t$selected = $http->_get_first_available_transport( array(), 'https://example.test/' );
\t\t$result['selected'] = $selected;
\t\t$result['tests'] = $GLOBALS['wphx_transport_tests'];
\t\t$result['deprecated_filters'] = $GLOBALS['wphx_deprecated_filters'];
\t\t$assertions['selected_curl'] = 'WP_Http_Curl' === $selected;
\t\t$assertions['only_curl_tested'] = array( 'WP_Http_Curl' ) === array_column( $GLOBALS['wphx_transport_tests'], 'class' );
\t\tbreak;

\tcase 'wp-http-transport:streams-fallback':
\t\t$selected = $http->_get_first_available_transport( array( 'disable_curl' => true ), 'https://example.test/' );
\t\t$result['selected'] = $selected;
\t\t$result['tests'] = $GLOBALS['wphx_transport_tests'];
\t\t$assertions['selected_streams'] = 'WP_Http_Streams' === $selected;
\t\t$assertions['curl_then_streams_tested'] = array( 'WP_Http_Curl', 'WP_Http_Streams' ) === array_column( $GLOBALS['wphx_transport_tests'], 'class' );
\t\tbreak;

\tcase 'wp-http-transport:deprecated-order-filter':
\t\t$selected = $http->_get_first_available_transport( array( 'order' => array( 'streams', 'curl' ) ), 'https://example.test/' );
\t\t$result['selected'] = $selected;
\t\t$result['tests'] = $GLOBALS['wphx_transport_tests'];
\t\t$result['deprecated_filters'] = $GLOBALS['wphx_deprecated_filters'];
\t\t$assertions['selected_streams_from_filter'] = 'WP_Http_Streams' === $selected;
\t\t$assertions['deprecated_filter_recorded'] = 'http_api_transports' === $GLOBALS['wphx_deprecated_filters'][0]['hook'] && '6.4.0' === $GLOBALS['wphx_deprecated_filters'][0]['version'];
\t\tbreak;

\tcase 'wp-http-transport:no-transport':
\t\t$selected = $http->_get_first_available_transport( array( 'disable_curl' => true, 'disable_streams' => true ), 'https://example.test/' );
\t\t$result['selected'] = $selected;
\t\t$result['tests'] = $GLOBALS['wphx_transport_tests'];
\t\t$assertions['selected_false'] = false === $selected;
\t\t$assertions['both_tested'] = array( 'WP_Http_Curl', 'WP_Http_Streams' ) === array_column( $GLOBALS['wphx_transport_tests'], 'class' );
\t\tbreak;

\tcase 'wp-http-transport:dispatch-success':
\t\t$method = new ReflectionMethod( 'WP_Http', '_dispatch_request' );
\t\t$method->setAccessible( true );
\t\t$response = $method->invoke( $http, 'https://example.test/dispatch', array( 'method' => 'GET' ) );
\t\t$result['response'] = wphx_summarize( $response );
\t\t$result['requests'] = $GLOBALS['wphx_transport_requests'];
\t\t$result['actions'] = $GLOBALS['wphx_actions'];
\t\t$result['filters'] = $GLOBALS['wphx_filters'];
\t\t$result['constructs'] = array( 'curl' => WP_Http_Curl::$constructs, 'streams' => WP_Http_Streams::$constructs );
\t\t$assertions['response_filtered'] = ! empty( $response['filtered'] ) && 'curl:https://example.test/dispatch' === $response['body'];
\t\t$assertions['debug_action'] = 'http_api_debug' === $GLOBALS['wphx_actions'][0]['hook'] && 'WP_Http_Curl' === $GLOBALS['wphx_actions'][0]['args'][2];
\t\t$assertions['transport_constructed_once'] = 1 === WP_Http_Curl::$constructs && 0 === WP_Http_Streams::$constructs;
\t\tbreak;

\tcase 'wp-http-transport:dispatch-error':
\t\t$method = new ReflectionMethod( 'WP_Http', '_dispatch_request' );
\t\t$method->setAccessible( true );
\t\t$no_transport = $method->invoke( $http, 'https://example.test/none', array( 'disable_curl' => true, 'disable_streams' => true ) );
\t\t$transport_error = $method->invoke( $http, 'https://example.test/error', array( 'return_transport_error' => true ) );
\t\t$result['no_transport'] = wphx_error_summary( $no_transport );
\t\t$result['transport_error'] = wphx_error_summary( $transport_error );
\t\t$result['actions'] = $GLOBALS['wphx_actions'];
\t\t$assertions['no_transport_error'] = 'http_failure' === $result['no_transport']['code'];
\t\t$assertions['transport_error_preserved'] = 'transport_failed' === $result['transport_error']['code'];
\t\t$assertions['debug_action_for_transport_error'] = 1 === count( $GLOBALS['wphx_actions'] ) && 'http_api_debug' === $GLOBALS['wphx_actions'][0]['hook'];
\t\tbreak;
}

$result['assertions'] = $assertions;
echo json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL;
}
`
  );
}

function runProbe(root) {
  const observations = {};
  for (const fixtureCase of CASES) {
    const output = command("php", [PROBE, root, fixtureCase.id]);
    observations[fixtureCase.id] = JSON.parse(output);
  }
  return observations;
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run without --check to generate it`);
    const existing = readFileSync(path, "utf8");
    if (existing !== content) throw new Error(`${path} is stale; run without --check to refresh it`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wp-http-transport-selection-candidate",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "haxe_parity_candidate",
      name: "WP_Http deprecated transport selection naming",
      area: "src/wp-includes/class-wp-http.php WP_Http::_get_first_available_transport WP_Http::_dispatch_request",
      public_contract:
        "This candidate promotes the deprecated WP_Http transport default token list, core token recognition, and WP_Http_* class-name construction to generated Haxe PHP. The WPHX PHP compiler now emits both transport helper adapter bodies from structured core IR, preserving PHP-visible apply_filters_deprecated timing/payload, static transport test calls, dispatch transport instance caching, WP_Error construction, http_api_debug action timing, http_response filtering, fake transport requests, and the public compatibility shell."
    },
    ownership_state: "compiler_emitted_original_path_shell",
    bridge: {
      exists: true,
      kind: "compiler-emitted-original-path-public-php-shell",
      removal_gate:
        "Pass selected upstream HTTP PHPUnit, installed distribution, and live/recorded transport gates before claiming broader deprecated transport dispatch or whole-file WP_Http ownership."
    },
    owned_paths: [RUNNER, ...HAXE_SOURCES, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, WPHX_PHP_MANIFEST, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-wp-http-transport-selection-candidate",
        "npm run wp:core:wphx-312-wp-http-transport-selection-candidate:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-66-wp-http-transport-selection-candidate"],
      manifest_digest: manifestSha
    }
  };
}

async function main() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  command("haxe", [HXML]);
  command("haxe", [WPHX_PHP_HXML, "-D", `wphx_php_output=${WPHX_PHP_ROOT}`, "-D", `wphx_php_manifest=${WPHX_PHP_MANIFEST}`]);
  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  installCompilerEmittedCandidateShell();
  writeProbe();

  const oracle = runProbe(ORACLE_ROOT);
  const candidate = runProbe(CANDIDATE_ROOT);
  const observationsMatch = JSON.stringify(oracle) === JSON.stringify(candidate);
  const observationsAssert = Object.values(oracle).every((entry) => Object.values(entry.assertions).every(Boolean));
  if (!observationsMatch) {
    console.error(JSON.stringify({ status: "failed", oracle, candidate }, null, 2));
    process.exit(1);
  }
  if (!observationsAssert) {
    console.error(JSON.stringify({ status: "failed", reason: "fixture assertions failed", oracle }, null, 2));
    process.exit(1);
  }

  const phpLint = SOURCE_FILES.map((path) => ({
    path,
    oracle_lint: command("php", ["-l", mirrorPath(ORACLE_ROOT, path)]),
    candidate_lint: command("php", ["-l", mirrorPath(CANDIDATE_ROOT, path)])
  }));
  const wphxPhpManifest = JSON.parse(readFileSync(WPHX_PHP_MANIFEST, "utf8"));
  const generatedShell = readFileSync(`${WPHX_PHP_ROOT}/wp-includes/class-wp-http.php`, "utf8");
  const transportTemplates = wphxPhpManifest.adapter_templates ?? [];
  const getFirstTemplateAbsent = !transportTemplates.some((template) => template.adapter === "wp-http-transport-get-first-available");
  const dispatchTemplateAbsent = !transportTemplates.some((template) => template.adapter === "wp-http-transport-dispatch-request");
  const coreIrFeatures = wphxPhpManifest.core_ir_features ?? [];
  const getFirstIrFeatures = [
    "stmt.foreach",
    "expr.static-call",
    "expr.long-array",
    "wp-http.transport.get-first-available"
  ].every((feature) => coreIrFeatures.includes(feature));
  const dispatchIrFeatures = [
    "stmt.static-local",
    "expr.dynamic-new",
    "wp-http.transport.dispatch-request"
  ].every((feature) => coreIrFeatures.includes(feature));
  const declaredWpHttpClass = wphxPhpManifest.files
    .flatMap((file) => file.declarations)
    .some((declaration) => declaration.kind === "class" && declaration.name === "WP_Http");
  const unsupportedEmpty = Array.isArray(wphxPhpManifest.unsupported) && wphxPhpManifest.unsupported.length === 0;
  const transportShellEmitted =
    generatedShell.includes("class WP_Http") &&
    generatedShell.includes("public function _get_first_available_transport($args, $url = null)") &&
    generatedShell.includes("private function _dispatch_request($url, $args)") &&
    generatedShell.includes(`${HAXE_MODULE}::defaultTransportTokens`) &&
    generatedShell.includes(`${HAXE_MODULE}::isCoreTransportToken`) &&
    generatedShell.includes(`${HAXE_MODULE}::coreTransportSuffix`) &&
    generatedShell.includes(`${HAXE_MODULE}::transportClassName`) &&
    generatedShell.includes("apply_filters_deprecated( 'http_api_transports'") &&
    generatedShell.includes("call_user_func( array(") &&
    generatedShell.includes("'test',") &&
    generatedShell.includes("static $transports = array();") &&
    generatedShell.includes("$transports[ $class ] = new $class();") &&
    generatedShell.includes("do_action( 'http_api_debug'") &&
    generatedShell.includes("apply_filters( 'http_response'");
  if (
    !declaredWpHttpClass ||
    !unsupportedEmpty ||
    !transportShellEmitted ||
    !getFirstTemplateAbsent ||
    !getFirstIrFeatures ||
    !dispatchTemplateAbsent ||
    !dispatchIrFeatures
  ) {
    console.error(
      JSON.stringify(
        {
          status: "failed",
          reason: "compiler-emitted WP_Http transport shell did not match expected declaration or shape",
          declared_wp_http_class: declaredWpHttpClass,
          unsupported_empty: unsupportedEmpty,
          transport_shell_emitted: transportShellEmitted,
          get_first_adapter_template_absent: getFirstTemplateAbsent,
          get_first_ir_features: getFirstIrFeatures,
          dispatch_adapter_template_absent: dispatchTemplateAbsent,
          dispatch_ir_features: dispatchIrFeatures,
          manifest: WPHX_PHP_MANIFEST
        },
        null,
        2
      )
    );
    process.exit(1);
  }
  const compiledPhp = command("find", [HAXE_OUT, "-type", "f", "-name", "*.php"]);
  const manifest = {
    schema: "wphx.wp-core-wp-http-transport-selection-candidate.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_classes: [
      "haxe_source",
      "generated_php_candidate",
      "oracle_source_mirror",
      "php_cli_observed_fixture",
      "compiler_adapter_template_provenance",
      "compiler_core_ir"
    ],
    artifact_scope: "haxe_parity_candidate",
    inputs: {
      surface_manifest: inputRecord(SURFACE),
      adapter_contract_manifest: inputRecord(CONTRACT),
      http_transport_callback_test_fixture_manifest: inputRecord(HTTP_TRANSPORT_FIXTURE),
      http_request_orchestration_fixture_manifest: inputRecord(HTTP_REQUEST_FIXTURE),
      transport_dispatch_oracle_fixture_manifest: inputRecord(TRANSPORT_DISPATCH_FIXTURE),
      wphx_php_manifest: inputRecord(WPHX_PHP_MANIFEST),
      runner: inputRecord(RUNNER),
      haxe_sources: HAXE_SOURCES.map(inputRecord),
      upstream_sources: SOURCE_FILES.map(sourceRecord)
    },
    candidate: {
      hxml: HXML,
      wphx_php_hxml: WPHX_PHP_HXML,
      haxe_output: HAXE_OUT,
      wphx_php_output: WPHX_PHP_ROOT,
      public_shell: `${CANDIDATE_ROOT}/wp-includes/class-wp-http.php`,
      compiler_emitted_public_shell: `${WPHX_PHP_ROOT}/wp-includes/class-wp-http.php`,
      compiled_php_files: compiledPhp.split("\n").filter(Boolean).sort(),
      haxe_module: HAXE_MODULE,
      promoted_symbols: PROMOTED_SYMBOLS,
      adapter_templates: [],
      core_ir_features: coreIrFeatures.filter((feature) =>
        [
          "stmt.foreach",
          "expr.static-call",
          "expr.long-array",
          "stmt.static-local",
          "expr.dynamic-new",
          "wp-http.transport.get-first-available",
          "wp-http.transport.dispatch-request"
        ].includes(feature)
      ),
      promoted_behavior:
        "The deprecated transport default token list and WP_Http_* class-name mapping in WP_Http::_get_first_available_transport are emitted by generated Haxe PHP, and both WP_Http transport helper adapter bodies are emitted from structured WPHX PHP core IR instead of adapter templates. Live transport behavior remains bounded to deterministic PHP fixture coverage."
    },
    fixture: {
      cases: CASES,
      covered_symbols: COVERED_SYMBOLS,
      source_files: SOURCE_FILES,
      probe: { path: PROBE, sha256: sha256File(PROBE) },
      side_effect_policy: {
        external_network_io: false,
        database_io: false,
        live_installed_wordpress: false,
        php_cli: true,
        runtime_stubs:
          "Requests Autoload/Requests, WP_Error, hooks, filters, and WP_Http_Curl/WP_Http_Streams are deterministic local stubs. Copied WP_Http remains the executed selection/dispatch source; no socket, cURL, or Requests network I/O is performed."
      },
      public_abi_policy: {
        public_php_replacement_claimed: true,
        compiler_emitted_public_php: true,
        copied_oracle_public_php: true,
        copied_candidate_public_php_shell: false,
        adapter_contract_foundation: CONTRACT,
        installed_wordpress_behavior_claimed: false
      },
      native_boundary_policy: {
        native_php_array_shape_required: true,
        escape_hatch_owner: ISSUE.external_ref,
        detail:
          "The Haxe defaultTransportTokens helper returns a NativeValue because the deprecated http_api_transports filter receives and may return native PHP string arrays."
      }
    },
    build: { hxml: HXML, haxe_output: HAXE_OUT, oracle_root: ORACLE_ROOT, candidate_root: CANDIDATE_ROOT, php_lint: phpLint },
    observations: {
      oracle,
      candidate,
      match: observationsMatch,
      oracle_sha256: sha256(JSON.stringify(oracle)),
      candidate_sha256: sha256(JSON.stringify(candidate)),
      assertions_pass: observationsAssert
    },
    remaining_gaps: [
      {
        id: "full-transport-selection-not-promoted",
        owner: ISSUE.external_ref,
        detail:
          "Only default transport token and class-name mapping decisions are Haxe-owned. Deprecated filter dispatch, custom filter payload handling, static transport test calls, and no-transport result handling remain PHP-owned in this candidate."
      },
      {
        id: "live-http-transport-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "The fixture observes deprecated selection and dispatch control flow through fake transports. It does not execute live cURL/streams, socket I/O, Requests network I/O, DNS, proxy, TLS, or redirects."
      },
      {
        id: "installed-distribution-behavior-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "The fixture uses PHP CLI with deterministic support stubs rather than an installed WordPress distribution or ecosystem callers that directly use deprecated transport APIs."
      },
    ],
    ownership_manifest: OWNERSHIP,
    validation_result: {
      status: "passed",
      fixture_cases: CASES.length,
      covered_symbols: COVERED_SYMBOLS.length,
      promoted_symbols: PROMOTED_SYMBOLS.length,
      observations_match: observationsMatch,
      observations_assert: observationsAssert,
      public_php_replacement_claimed: true,
      compiler_emitted_public_php: true,
      transport_shell_emitted: transportShellEmitted,
      get_first_adapter_template_absent: getFirstTemplateAbsent,
      get_first_ir_features: getFirstIrFeatures,
      dispatch_adapter_template_absent: dispatchTemplateAbsent,
      dispatch_ir_features: dispatchIrFeatures,
      unsupported_empty: unsupportedEmpty,
      full_transport_selection_claimed: false,
      full_dispatch_claimed: false,
      installed_wordpress_behavior_claimed: false,
      live_http_claimed: false,
      socket_or_curl_execution_claimed: false
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestText);
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-312-66-wp-http-transport-selection-candidate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "WP_Http deprecated transport selection Haxe candidate manifest" },
      { path: OWNERSHIP, role: "ownership manifest for WP_Http deprecated transport selection Haxe candidate" },
      { path: RUNNER, role: "deterministic PHP CLI oracle/candidate Haxe fixture generator" },
      { path: HXML, role: "Haxe compile target for deprecated transport selection candidate" },
      { path: WPHX_PHP_MANIFEST, role: "WPHX PHP emission manifest for the compiler-emitted original-path public shell" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-312-wp-http-transport-selection-candidate",
      "npm run wp:core:wphx-312-wp-http-transport-selection-candidate:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
      "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
      "receipt:wphx-312-45-http-transport-callback-test-oracle-fixture",
      "receipt:wphx-312-46-wp-http-request-orchestration-oracle-fixture",
      "receipt:wphx-312-48-wp-http-transport-dispatch-oracle-fixture"
    ],
    validation_result: manifest.validation_result
  };

  try {
    writeOrCheck(OUT, manifestText);
    writeOrCheck(OWNERSHIP, JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n");
    writeOrCheck(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
  } catch (error) {
    console.error(JSON.stringify({ status: "failed", error: error.message }, null, 2));
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: "passed",
        output: OUT,
        ownership: OWNERSHIP,
        receipt: RECEIPT,
        fixture_cases: CASES.length,
        observations_match: observationsMatch
      },
      null,
      2
    )
  );
}

await main();
