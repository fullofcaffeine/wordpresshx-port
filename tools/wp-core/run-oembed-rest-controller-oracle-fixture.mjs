#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-k2t",
  external_ref: "WPHX-312.31",
  title: "WPHX-312.31 - Add oEmbed REST controller oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-oembed-rest-controller-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-312-31";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const OUT = "manifests/wp-core/wphx-312-31-oembed-rest-controller-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-31-oembed-rest-controller-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-31-oembed-rest-controller-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const REMOTE_OEMBED_FIXTURE = "manifests/wp-core/wphx-312-08-remote-fetch-oembed-oracle-fixture.v1.json";
const OEMBED_REGISTRY_FIXTURE = "manifests/wp-core/wphx-312-29-oembed-provider-registry-oracle-fixture.v1.json";
const WP_EMBED_FIXTURE = "manifests/wp-core/wphx-312-30-wp-embed-cache-autoembed-oracle-fixture.v1.json";

const SOURCE_FILES = ["src/wp-includes/class-wp-oembed-controller.php"];
const COVERED_SYMBOLS = [
  "class-wp-oembed-controller.php",
  "WP_oEmbed_Controller::register_routes",
  "WP_oEmbed_Controller::get_item",
  "WP_oEmbed_Controller::get_proxy_item_permissions_check",
  "WP_oEmbed_Controller::get_proxy_item",
  "register_rest_route",
  "WP_REST_Server::READABLE",
  "url_to_postid",
  "get_oembed_response_data",
  "get_oembed_response_data_for_url",
  "_wp_oembed_get_object",
  "WP_Embed::get_embed_handler_html",
  "get_transient",
  "set_transient",
  "rest_oembed_ttl"
];
const CASES = [
  { id: "oembed-rest:register-routes", focus: "register_routes records embed/proxy REST routes and filtered maxwidth defaults" },
  { id: "oembed-rest:get-item-success", focus: "get_item maps URL to post ID, applies post-id filter, and returns oEmbed response data" },
  { id: "oembed-rest:get-item-invalid", focus: "get_item returns oembed_invalid_url when response data is unavailable" },
  { id: "oembed-rest:proxy-permissions", focus: "proxy permission check returns rest_forbidden for users without edit_posts" },
  { id: "oembed-rest:proxy-cache-hit", focus: "get_proxy_item returns cached transient data before local or remote resolution" },
  { id: "oembed-rest:proxy-local-short-circuit", focus: "get_proxy_item returns local oEmbed response data for current-site URLs" },
  { id: "oembed-rest:proxy-remote-success-cache", focus: "get_proxy_item fetches remote data, renders html, applies TTL, and sets transient cache" },
  { id: "oembed-rest:proxy-handler-fallback", focus: "get_proxy_item falls back to classic embed handlers and includes enqueued scripts" },
  { id: "oembed-rest:proxy-invalid-error", focus: "get_proxy_item returns oembed_invalid_url when remote and handler paths fail" }
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

function writeProbe(root) {
  writeFileSync(
    `${root}/probe.php`,
    `<?php
error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

$case = $argv[1] ?? '';

define( 'DAY_IN_SECONDS', 86400 );

$GLOBALS['wphx_case'] = $case;
$GLOBALS['wphx_routes'] = array();
$GLOBALS['wphx_filters'] = array();
$GLOBALS['wphx_transient_gets'] = array();
$GLOBALS['wphx_transient_sets'] = array();
$GLOBALS['wphx_local_oembed'] = array();
$GLOBALS['wphx_remote_oembed'] = array();
$GLOBALS['wphx_handler_calls'] = array();
$GLOBALS['wphx_can_edit'] = true;

class WP_REST_Server {
\tpublic const READABLE = 'GET';
}

class WP_Error {
\tprivate $code;
\tprivate $message;
\tprivate $data;

\tpublic function __construct( $code = '', $message = '', $data = null ) {
\t\t$this->code = $code;
\t\t$this->message = $message;
\t\t$this->data = $data;
\t}

\tpublic function get_error_code() { return $this->code; }
\tpublic function get_error_message() { return $this->message; }
\tpublic function get_error_data() { return $this->data; }
}

class WPHX_REST_Request implements ArrayAccess {
\tprivate $params;

\tpublic function __construct( $params ) {
\t\t$this->params = $params;
\t}

\tpublic function get_params() {
\t\treturn $this->params;
\t}

\tpublic function offsetExists( $offset ): bool {
\t\treturn array_key_exists( $offset, $this->params );
\t}

\tpublic function offsetGet( $offset ): mixed {
\t\treturn $this->params[ $offset ] ?? null;
\t}

\tpublic function offsetSet( $offset, $value ): void {
\t\t$this->params[ $offset ] = $value;
\t}

\tpublic function offsetUnset( $offset ): void {
\t\tunset( $this->params[ $offset ] );
\t}
}

class WPHX_OEmbed_Object {
\tpublic function get_data( $url, $args = array() ) {
\t\t$GLOBALS['wphx_remote_oembed'][] = array( 'method' => 'get_data', 'url' => $url, 'args' => $args );
\t\tif ( str_contains( $url, 'remote-success.example' ) ) {
\t\t\treturn (object) array(
\t\t\t\t'type' => 'rich',
\t\t\t\t'provider_name' => 'Remote Provider',
\t\t\t\t'html' => '<iframe data-original=\"remote\"></iframe>',
\t\t\t);
\t\t}
\t\treturn false;
\t}

\tpublic function data2html( $data, $url ) {
\t\t$GLOBALS['wphx_remote_oembed'][] = array( 'method' => 'data2html', 'url' => $url, 'type' => $data->type ?? '' );
\t\treturn '<iframe data-rendered=\"' . esc_html( $url ) . '\"></iframe>';
\t}
}

class WPHX_Embed {
\tpublic function get_embed_handler_html( $args, $url ) {
\t\t$GLOBALS['wphx_handler_calls'][] = array( 'url' => $url, 'args' => $args );
\t\tif ( str_contains( $url, 'handler.example' ) ) {
\t\t\treturn '<blockquote data-handler=\"classic\">' . esc_html( $url ) . '</blockquote>';
\t\t}
\t\treturn false;
\t}
}

function __( $text ) { return $text; }
function __return_true() { return true; }
function esc_html( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' ); }
function absint( $value ) { return abs( (int) $value ); }
function wp_oembed_ensure_format( $format ) { return in_array( $format, array( 'json', 'xml' ), true ) ? $format : 'json'; }
function get_status_header_desc( $code ) { return 404 === (int) $code ? 'Not Found' : 'Status ' . (int) $code; }
function rest_authorization_required_code() { return 401; }
function current_user_can( $capability ) { return $GLOBALS['wphx_can_edit'] && 'edit_posts' === $capability; }
function register_rest_route( $namespace, $route, $args ) {
\t$GLOBALS['wphx_routes'][] = array( 'namespace' => $namespace, 'route' => $route, 'args' => $args );
\treturn true;
}
function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_filters'][] = array( 'hook' => $hook_name, 'value' => $value, 'arg_count' => count( $args ) + 1 );
\tif ( 'oembed_default_width' === $hook_name ) {
\t\treturn 480;
\t}
\tif ( 'oembed_request_post_id' === $hook_name && 'oembed-rest:get-item-success' === $GLOBALS['wphx_case'] ) {
\t\treturn 17;
\t}
\tif ( 'oembed_result' === $hook_name ) {
\t\treturn $value . '<!-- filtered-oembed-result -->';
\t}
\tif ( 'rest_oembed_ttl' === $hook_name ) {
\t\treturn 123;
\t}
\treturn $value;
}
function url_to_postid( $url ) {
\treturn str_contains( $url, 'post.example' ) ? 7 : 0;
}
function get_oembed_response_data( $post_id, $maxwidth ) {
\tif ( $post_id > 0 ) {
\t\treturn array( 'type' => 'rich', 'post_id' => $post_id, 'maxwidth' => $maxwidth, 'html' => '<iframe data-post=\"' . (int) $post_id . '\"></iframe>' );
\t}
\treturn false;
}
function get_oembed_response_data_for_url( $url, $args = array() ) {
\t$GLOBALS['wphx_local_oembed'][] = array( 'url' => $url, 'args' => $args );
\tif ( str_contains( $url, 'local.example' ) ) {
\t\treturn (object) array( 'type' => 'rich', 'provider_name' => 'Local Provider', 'html' => '<iframe data-local=\"1\"></iframe>' );
\t}
\treturn false;
}
function get_transient( $key ) {
\t$GLOBALS['wphx_transient_gets'][] = $key;
\tif ( 'oembed-rest:proxy-cache-hit' === $GLOBALS['wphx_case'] ) {
\t\treturn (object) array( 'provider_name' => 'Cached Provider', 'html' => '<iframe data-cache=\"hit\"></iframe>' );
\t}
\treturn false;
}
function set_transient( $key, $value, $expiration = 0 ) {
\t$GLOBALS['wphx_transient_sets'][] = array( 'key' => $key, 'value' => $value, 'expiration' => $expiration );
\treturn true;
}
function _wp_oembed_get_object() {
\treturn new WPHX_OEmbed_Object();
}
function normalize_value( $value ) {
\tif ( $value instanceof WP_Error ) {
\t\treturn array(
\t\t\t'wp_error' => true,
\t\t\t'code' => $value->get_error_code(),
\t\t\t'message' => $value->get_error_message(),
\t\t\t'data' => $value->get_error_data(),
\t\t);
\t}
\tif ( is_object( $value ) ) {
\t\treturn json_decode( json_encode( $value ), true );
\t}
\treturn $value;
}

require __DIR__ . '/wp-includes/class-wp-oembed-controller.php';

$wp_embed = new WPHX_Embed();
$wp_scripts = (object) array(
\t'queue' => array( 'handler-a', 'handler-b' ),
\t'registered' => array(
\t\t'handler-a' => (object) array( 'src' => 'https://cdn.example/handler-a.js' ),
\t\t'handler-b' => (object) array( 'src' => '/wp-includes/js/handler-b.js' ),
\t),
);

$controller = new WP_oEmbed_Controller();
$result = array( 'case' => $case );

switch ( $case ) {
\tcase 'oembed-rest:register-routes':
\t\t$controller->register_routes();
\t\t$result += array(
\t\t\t'routes' => array_map(
\t\t\t\tfunction ( $route ) {
\t\t\t\t\t$endpoint = $route['args'][0];
\t\t\t\t\treturn array(
\t\t\t\t\t\t'namespace' => $route['namespace'],
\t\t\t\t\t\t'route' => $route['route'],
\t\t\t\t\t\t'methods' => $endpoint['methods'],
\t\t\t\t\t\t'callback' => is_array( $endpoint['callback'] ) ? array( get_class( $endpoint['callback'][0] ), $endpoint['callback'][1] ) : $endpoint['callback'],
\t\t\t\t\t\t'permission_callback' => is_array( $endpoint['permission_callback'] ) ? array( get_class( $endpoint['permission_callback'][0] ), $endpoint['permission_callback'][1] ) : $endpoint['permission_callback'],
\t\t\t\t\t\t'args' => $endpoint['args'],
\t\t\t\t\t);
\t\t\t\t},
\t\t\t\t$GLOBALS['wphx_routes']
\t\t\t),
\t\t\t'filters' => $GLOBALS['wphx_filters'],
\t\t);
\t\tbreak;
\tcase 'oembed-rest:get-item-success':
\t\t$response = $controller->get_item( new WPHX_REST_Request( array( 'url' => 'https://post.example/hello-world', 'maxwidth' => 321 ) ) );
\t\t$result += array( 'response' => normalize_value( $response ), 'filters' => $GLOBALS['wphx_filters'] );
\t\tbreak;
\tcase 'oembed-rest:get-item-invalid':
\t\t$response = $controller->get_item( new WPHX_REST_Request( array( 'url' => 'https://missing.example/nope', 'maxwidth' => 321 ) ) );
\t\t$result += array( 'response' => normalize_value( $response ) );
\t\tbreak;
\tcase 'oembed-rest:proxy-permissions':
\t\t$GLOBALS['wphx_can_edit'] = false;
\t\t$denied = $controller->get_proxy_item_permissions_check();
\t\t$GLOBALS['wphx_can_edit'] = true;
\t\t$allowed = $controller->get_proxy_item_permissions_check();
\t\t$result += array( 'denied' => normalize_value( $denied ), 'allowed' => $allowed );
\t\tbreak;
\tcase 'oembed-rest:proxy-cache-hit':
\t\t$response = $controller->get_proxy_item( new WPHX_REST_Request( array( 'url' => 'https://remote-success.example/post', 'maxwidth' => 400, '_wpnonce' => 'nonce' ) ) );
\t\t$result += array(
\t\t\t'response' => normalize_value( $response ),
\t\t\t'transient_gets' => $GLOBALS['wphx_transient_gets'],
\t\t\t'local_oembed' => $GLOBALS['wphx_local_oembed'],
\t\t\t'remote_oembed' => $GLOBALS['wphx_remote_oembed'],
\t\t);
\t\tbreak;
\tcase 'oembed-rest:proxy-local-short-circuit':
\t\t$response = $controller->get_proxy_item( new WPHX_REST_Request( array( 'url' => 'https://local.example/post', 'maxwidth' => 400, 'maxheight' => 200 ) ) );
\t\t$result += array(
\t\t\t'response' => normalize_value( $response ),
\t\t\t'local_oembed' => $GLOBALS['wphx_local_oembed'],
\t\t\t'remote_oembed' => $GLOBALS['wphx_remote_oembed'],
\t\t\t'transient_sets' => $GLOBALS['wphx_transient_sets'],
\t\t);
\t\tbreak;
\tcase 'oembed-rest:proxy-remote-success-cache':
\t\t$response = $controller->get_proxy_item( new WPHX_REST_Request( array( 'url' => 'https://remote-success.example/post', 'maxwidth' => 500, 'maxheight' => 250, 'discover' => false, '_wpnonce' => 'nonce' ) ) );
\t\t$result += array(
\t\t\t'response' => normalize_value( $response ),
\t\t\t'local_oembed' => $GLOBALS['wphx_local_oembed'],
\t\t\t'remote_oembed' => $GLOBALS['wphx_remote_oembed'],
\t\t\t'transient_gets' => $GLOBALS['wphx_transient_gets'],
\t\t\t'transient_sets' => $GLOBALS['wphx_transient_sets'],
\t\t\t'filters' => $GLOBALS['wphx_filters'],
\t\t);
\t\tbreak;
\tcase 'oembed-rest:proxy-handler-fallback':
\t\t$response = $controller->get_proxy_item( new WPHX_REST_Request( array( 'url' => 'https://handler.example/video', 'maxwidth' => 410 ) ) );
\t\t$result += array(
\t\t\t'response' => normalize_value( $response ),
\t\t\t'remote_oembed' => $GLOBALS['wphx_remote_oembed'],
\t\t\t'handler_calls' => $GLOBALS['wphx_handler_calls'],
\t\t);
\t\tbreak;
\tcase 'oembed-rest:proxy-invalid-error':
\t\t$response = $controller->get_proxy_item( new WPHX_REST_Request( array( 'url' => 'https://invalid.example/video', 'maxwidth' => 410 ) ) );
\t\t$result += array(
\t\t\t'response' => normalize_value( $response ),
\t\t\t'remote_oembed' => $GLOBALS['wphx_remote_oembed'],
\t\t\t'handler_calls' => $GLOBALS['wphx_handler_calls'],
\t\t);
\t\tbreak;
\tdefault:
\t\tfwrite( STDERR, 'Unknown case: ' . $case . PHP_EOL );
\t\texit( 2 );
}

echo json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL;
`
  );
}

function observation(caseDef, root) {
  const raw = command("php", [`${root}/probe.php`, caseDef.id]);
  const parsed = JSON.parse(raw);
  return {
    ...parsed,
    assertions: {
      routes_registered:
        caseDef.id !== "oembed-rest:register-routes" ||
        (parsed.routes.length === 2 &&
          parsed.routes.some((route) => route.route === "/embed" && route.args.maxwidth.default === 480) &&
          parsed.routes.some((route) => route.route === "/proxy" && route.args.discover.default === true)),
      get_item_success:
        caseDef.id !== "oembed-rest:get-item-success" ||
        (parsed.response.post_id === 17 && parsed.response.maxwidth === 321),
      get_item_invalid:
        caseDef.id !== "oembed-rest:get-item-invalid" ||
        (parsed.response.wp_error === true && parsed.response.code === "oembed_invalid_url" && parsed.response.data.status === 404),
      permission_check:
        caseDef.id !== "oembed-rest:proxy-permissions" ||
        (parsed.denied.wp_error === true && parsed.denied.code === "rest_forbidden" && parsed.allowed === true),
      proxy_cache_hit:
        caseDef.id !== "oembed-rest:proxy-cache-hit" ||
        (parsed.response.provider_name === "Cached Provider" && parsed.local_oembed.length === 0 && parsed.remote_oembed.length === 0),
      proxy_local_short_circuit:
        caseDef.id !== "oembed-rest:proxy-local-short-circuit" ||
        (parsed.response.provider_name === "Local Provider" && parsed.local_oembed.length === 1 && parsed.remote_oembed.length === 0),
      proxy_remote_success_cache:
        caseDef.id !== "oembed-rest:proxy-remote-success-cache" ||
        (parsed.response.provider_name === "Remote Provider" &&
          parsed.response.html.includes("filtered-oembed-result") &&
          parsed.remote_oembed.some((entry) => entry.method === "get_data" && entry.args.width === 500 && entry.args.height === 250) &&
          parsed.transient_sets.length === 1 &&
          parsed.transient_sets[0].expiration === 123),
      proxy_handler_fallback:
        caseDef.id !== "oembed-rest:proxy-handler-fallback" ||
        (parsed.response.provider_name === "Embed Handler" &&
          parsed.response.html.includes("classic") &&
          parsed.response.scripts.length === 2 &&
          parsed.handler_calls.length === 1),
      proxy_invalid_error:
        caseDef.id !== "oembed-rest:proxy-invalid-error" ||
        (parsed.response.wp_error === true && parsed.response.code === "oembed_invalid_url" && parsed.handler_calls.length === 1)
    }
  };
}

function runRoot(root) {
  return Object.fromEntries(CASES.map((caseDef) => [caseDef.id, observation(caseDef, root)]));
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents)
      throw new Error(`${path} is stale; run npm run wp:core:wphx-312-oembed-rest-controller-oracle-fixture`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/oembed-rest-controller-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "WP_oEmbed_Controller REST route and proxy behavior",
      area: SOURCE_FILES.join(" "),
      public_contract:
        "This fixture executes copied WordPress 7.0 wp-includes/class-wp-oembed-controller.php in isolated PHP CLI probes with deterministic REST route/request, permission, transient, local oEmbed, remote oEmbed, WP_Embed, and script registry stubs. It observes route registration, get_item success/error behavior, proxy permission checks, transient cache hits, local response short-circuit, remote data fetch/cache, classic embed handler fallback, and proxy invalid-url errors without claiming full REST server dispatch, live network/discovery, installed rendering, editor/admin flows, database-backed transients, or generated public PHP ownership."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-stubbed-rest-and-oembed-runtime-boundary",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass full REST server dispatch, live/recorded oEmbed provider behavior, installed browser rendering, editor/admin flows, database-backed transient/cache behavior, selected upstream PHPUnit, and ecosystem fixtures before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-oembed-rest-controller-oracle-fixture",
        "npm run wp:core:wphx-312-oembed-rest-controller-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-31-oembed-rest-controller-oracle-fixture"],
      manifest_digest: manifestSha
    }
  };
}

async function main() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe(ORACLE_ROOT);
  writeProbe(CANDIDATE_ROOT);

  const oracle = runRoot(ORACLE_ROOT);
  const candidate = runRoot(CANDIDATE_ROOT);
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
  const manifest = {
    schema: "wphx.wp-core-oembed-rest-controller-oracle-fixture.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_classes: ["oracle_source_mirror", "candidate_package_mirror", "php_cli_observed_fixture"],
    artifact_scope: "fixture",
    inputs: {
      surface_manifest: inputRecord(SURFACE),
      adapter_contract_manifest: inputRecord(CONTRACT),
      remote_oembed_fixture_manifest: inputRecord(REMOTE_OEMBED_FIXTURE),
      oembed_registry_fixture_manifest: inputRecord(OEMBED_REGISTRY_FIXTURE),
      wp_embed_fixture_manifest: inputRecord(WP_EMBED_FIXTURE),
      runner: inputRecord(RUNNER),
      upstream_sources: SOURCE_FILES.map(sourceRecord)
    },
    fixture: {
      cases: CASES,
      covered_symbols: COVERED_SYMBOLS,
      source_files: SOURCE_FILES,
      side_effect_policy: {
        external_network_io: false,
        database_io: false,
        live_installed_wordpress: false,
        php_cli: true,
        runtime_stubs:
          "REST routing/request, permissions, transients, local response data, remote oEmbed object, WP_Embed handler fallback, and script registry are deterministic stubs; copied class-wp-oembed-controller.php remains the executed public controller source."
      },
      public_abi_policy: {
        public_php_replacement_claimed: false,
        copied_oracle_public_php: true,
        adapter_contract_foundation: CONTRACT,
        installed_wordpress_behavior_claimed: false
      }
    },
    build: { oracle_root: ORACLE_ROOT, candidate_root: CANDIDATE_ROOT, php_lint: phpLint },
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
        id: "full-rest-server-dispatch-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "The fixture calls controller methods directly with a minimal request object. Full WP_REST_Server route dispatch, schema validation, response serialization, and installed REST routing remain WPHX-311/WPHX-312 distribution gates."
      },
      {
        id: "live-oembed-network-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "Remote oEmbed data and classic handler fallback are deterministic stubs. Live/recorded provider discovery, remote fetch transport, browser rendering, and editor/admin flows remain later gates."
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
      observations_match: observationsMatch,
      observations_assert: observationsAssert,
      public_php_replacement_claimed: false,
      installed_wordpress_behavior_claimed: false,
      full_rest_dispatch_claimed: false,
      live_oembed_fetch_claimed: false
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestText);
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-312-31-oembed-rest-controller-oracle-fixture",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "WP_oEmbed_Controller REST/proxy oracle-source-mirror fixture manifest" },
      { path: OWNERSHIP, role: "ownership manifest for copied-oracle WP_oEmbed_Controller boundary" },
      { path: RUNNER, role: "deterministic PHP CLI oracle/candidate fixture generator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-312-oembed-rest-controller-oracle-fixture",
      "npm run wp:core:wphx-312-oembed-rest-controller-oracle-fixture:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
      "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
      "receipt:wphx-312-08-remote-fetch-oembed-oracle-fixture",
      "receipt:wphx-312-29-oembed-provider-registry-oracle-fixture",
      "receipt:wphx-312-30-wp-embed-cache-autoembed-oracle-fixture"
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
