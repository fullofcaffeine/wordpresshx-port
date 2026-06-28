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
const OUT_ROOT = "build/wp-core/wphx-312-66";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
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
  "src/wphx/wp/http/HttpTransportSelection.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/HttpTransportSelectionCandidateEntry.hx"
];
const HAXE_MODULE = "\\wphx\\wp\\http\\_HttpTransportSelection\\HttpTransportSelection_Fields_";
const PROMOTED_SYMBOLS = [
  "WP_Http::_get_first_available_transport default transport token list",
  "WP_Http::_get_first_available_transport core transport token recognition",
  "WP_Http::_get_first_available_transport WP_Http_* class name construction"
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

function haxeBootstrapBlock() {
  return `if ( ! function_exists( 'wphx_312_66_bootstrap_haxe' ) ) {
\tfunction wphx_312_66_bootstrap_haxe() {
\t\tstatic $bootstrapped = false;
\t\tif ( $bootstrapped ) {
\t\t\treturn;
\t\t}
\t\t$bootstrapped = true;

\t\t$wphx_312_66_lib = dirname( __DIR__, 2 ) . '/haxe/lib';
\t\tset_include_path( get_include_path() . PATH_SEPARATOR . $wphx_312_66_lib );
\t\tspl_autoload_register(
\t\t\tfunction ( $class ) {
\t\t\t\t$file = stream_resolve_include_path( str_replace( '\\\\', '/', $class ) . '.php' );
\t\t\t\tif ( $file ) {
\t\t\t\t\tinclude_once $file;
\t\t\t\t}
\t\t\t}
\t\t);
\t\t\\php\\Boot::__hx__init();
\t}
}
wphx_312_66_bootstrap_haxe();
`;
}

function installBootstrap(source) {
  const marker = "<?php\n";
  if (!source.startsWith(marker)) throw new Error("class-wp-http.php did not start with PHP open tag");
  return `${marker}\n${haxeBootstrapBlock()}\n${source.slice(marker.length)}`;
}

function replaceInstanceMethod(source, methodName, replacement) {
  const pattern = new RegExp(`(?:public|protected|private)\\s+function\\s+${methodName}\\s*\\(`, "m");
  const match = pattern.exec(source);
  if (!match) throw new Error(`Unable to locate instance method ${methodName}`);
  const openBrace = source.indexOf("{", match.index);
  if (openBrace === -1) throw new Error(`Unable to locate opening brace for ${methodName}`);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return `${source.slice(0, match.index)}${replacement}${source.slice(index + 1)}`;
    }
  }
  throw new Error(`Unable to locate closing brace for ${methodName}`);
}

function transformCandidateTransportSelection() {
  const path = `${CANDIDATE_ROOT}/wp-includes/class-wp-http.php`;
  let source = installBootstrap(readFileSync(path, "utf8"));
  source = replaceInstanceMethod(
    source,
    "_get_first_available_transport",
    `public function _get_first_available_transport( $args, $url = null ) {
\t\t$transports = ${HAXE_MODULE}::defaultTransportTokens();

\t\t/**
\t\t * Filters which HTTP transports are available and in what order.
\t\t *
\t\t * @since 3.7.0
\t\t * @deprecated 6.4.0 Use WpOrg\\Requests\\Requests::get_transport_class()
\t\t *
\t\t * @param string[] $transports Array of HTTP transports to check. Default array contains
\t\t *                             'curl' and 'streams', in that order.
\t\t * @param array    $args       HTTP request arguments.
\t\t * @param string   $url        The URL to request.
\t\t */
\t\t$request_order = apply_filters_deprecated( 'http_api_transports', array( $transports, $args, $url ), '6.4.0' );

\t\t// Loop over each transport on each HTTP request looking for one which will serve this request's needs.
\t\tforeach ( $request_order as $transport ) {
\t\t\tif ( ${HAXE_MODULE}::isCoreTransportToken( (string) $transport ) ) {
\t\t\t\t$transport = ${HAXE_MODULE}::coreTransportSuffix( (string) $transport );
\t\t\t}
\t\t\t$class = ${HAXE_MODULE}::transportClassName( (string) $transport );

\t\t\t// Check to see if this transport is a possibility, calls the transport statically.
\t\t\tif ( ! call_user_func( array( $class, 'test' ), $args, $url ) ) {
\t\t\t\tcontinue;
\t\t\t}

\t\t\treturn $class;
\t\t}

\t\treturn false;
\t}`
  );
  writeFileSync(path, source);
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
        "This candidate promotes only the deprecated WP_Http transport default token list, core token recognition, and WP_Http_* class-name construction to generated Haxe PHP. PHP still owns apply_filters_deprecated timing/payload, static transport test calls, dispatch transport instance caching, WP_Error construction, http_api_debug action timing, http_response filtering, fake transport requests, and the public compatibility shell."
    },
    ownership_state: "haxe_candidate_with_public_php_shell",
    bridge: {
      exists: true,
      kind: "copied-public-php-shell-calling-generated-haxe",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass deprecated transport dispatch, selected upstream HTTP PHPUnit, installed distribution, and live/recorded transport gates before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
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
  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  transformCandidateTransportSelection();
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
  const compiledPhp = command("find", [HAXE_OUT, "-type", "f", "-name", "*.php"]);
  const manifest = {
    schema: "wphx.wp-core-wp-http-transport-selection-candidate.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_classes: ["haxe_source", "generated_php_candidate", "oracle_source_mirror", "php_cli_observed_fixture"],
    artifact_scope: "haxe_parity_candidate",
    inputs: {
      surface_manifest: inputRecord(SURFACE),
      adapter_contract_manifest: inputRecord(CONTRACT),
      http_transport_callback_test_fixture_manifest: inputRecord(HTTP_TRANSPORT_FIXTURE),
      http_request_orchestration_fixture_manifest: inputRecord(HTTP_REQUEST_FIXTURE),
      transport_dispatch_oracle_fixture_manifest: inputRecord(TRANSPORT_DISPATCH_FIXTURE),
      runner: inputRecord(RUNNER),
      haxe_sources: HAXE_SOURCES.map(inputRecord),
      upstream_sources: SOURCE_FILES.map(sourceRecord)
    },
    candidate: {
      hxml: HXML,
      haxe_output: HAXE_OUT,
      compiled_php_files: compiledPhp.split("\n").filter(Boolean).sort(),
      haxe_module: HAXE_MODULE,
      promoted_symbols: PROMOTED_SYMBOLS,
      promoted_behavior:
        "Only the deprecated transport default token list and WP_Http_* class-name mapping in WP_Http::_get_first_available_transport are emitted by generated Haxe PHP. The filter, static transport tests, and dispatch behavior remain PHP-owned."
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
        public_php_replacement_claimed: false,
        copied_oracle_public_php: true,
        copied_candidate_public_php_shell: true,
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
      {
        id: "public-php-adapter-not-yet-generated",
        owner: ISSUE.external_ref,
        detail: "The fixture compares copied oracle PHP in both roots; generated original-path PHP replacement remains a later cross-domain gate."
      }
    ],
    ownership_manifest: OWNERSHIP,
    validation_result: {
      status: "passed",
      fixture_cases: CASES.length,
      covered_symbols: COVERED_SYMBOLS.length,
      promoted_symbols: PROMOTED_SYMBOLS.length,
      observations_match: observationsMatch,
      observations_assert: observationsAssert,
      public_php_replacement_claimed: false,
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
      { path: HXML, role: "Haxe compile target for deprecated transport selection candidate" }
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
