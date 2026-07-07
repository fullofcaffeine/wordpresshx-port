#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.35",
  external_ref: "WPHX-323.15",
  title: "Add SimplePie feed wrapper cache and transport gate"
};
const RECORDED_AT = "2026-07-08T03:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-simplepie-wrapper-cache-transport-gate.mjs";
const OUT_ROOT = "build/wp-core/wphx-323-15";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/simplepie-wrapper-cache-transport-probe.php`;
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const FEED_GATES = "manifests/wp-core/wphx-323-04-feed-vendor-replacement-gates.v1.json";
const API_CORPUS = "manifests/wp-core/wphx-323-14-simplepie-api-reflection-corpus-fixture.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const OUT = "manifests/wp-core/wphx-323-15-simplepie-wrapper-cache-transport-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-15-simplepie-wrapper-cache-transport-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-15-simplepie-wrapper-cache-transport-gate.v1.json";

const SIMPLEPIE_ROOT = "src/wp-includes/SimplePie";
const SUPPORT_FILES = [
  "src/wp-includes/class-simplepie.php",
  "src/wp-includes/class-feed.php",
  "src/wp-includes/class-wp-feed-cache.php",
  "src/wp-includes/class-wp-feed-cache-transient.php",
  "src/wp-includes/class-wp-simplepie-file.php",
  "src/wp-includes/class-wp-simplepie-sanitize-kses.php",
  "src/wp-includes/feed.php"
];
const CASES = [
  { id: "fetch-feed:loopback-rss-success", focus: "fetch_feed success through WP_SimplePie_File and deterministic loopback RSS2 response" },
  { id: "fetch-feed:single-array-url", focus: "fetch_feed collapses a one-element URL array before SimplePie initialization" },
  { id: "fetch-feed:multi-url-merge", focus: "fetch_feed multifeed clones SimplePie instances and merges loopback RSS/Atom items" },
  { id: "fetch-feed:transport-failure", focus: "WP HTTP failure maps through SimplePie into WP_Error(simplepie-error)" },
  { id: "fetch-feed:malformed-response", focus: "malformed loopback feed response maps into WP_Error(simplepie-error)" },
  { id: "feed-cache:hit-miss-expiry", focus: "WP_Feed_Cache_Transient save/load/mtime miss and expiry behavior under deterministic site transient stubs" },
  { id: "simplepie-file:loopback-handoff", focus: "WP_SimplePie_File hands timeout, redirect, headers, and custom user-agent to Core HTTP and normalizes repeated headers" },
  { id: "sanitize:kses-html-and-base64", focus: "WP_SimplePie_Sanitize_KSES detects maybe-HTML, decodes base64, calls wp_kses_post, and preserves UTF-8 output" }
];
const COVERED_SYMBOLS = [
  "fetch_feed",
  "SimplePie\\SimplePie",
  "SimplePie\\SimplePie::merge_items",
  "SimplePie\\Registry::register",
  "SimplePie_Cache::register",
  "WP_Feed_Cache",
  "WP_Feed_Cache_Transient",
  "WP_Feed_Cache_Transient::save",
  "WP_Feed_Cache_Transient::load",
  "WP_Feed_Cache_Transient::mtime",
  "WP_Feed_Cache_Transient::touch",
  "WP_Feed_Cache_Transient::unlink",
  "WP_SimplePie_File",
  "WP_SimplePie_File::__construct",
  "WP_SimplePie_Sanitize_KSES",
  "WP_SimplePie_Sanitize_KSES::sanitize",
  "wp_safe_remote_request",
  "wp_remote_retrieve_headers",
  "wp_remote_retrieve_body",
  "wp_remote_retrieve_response_code",
  "wp_feed_cache_transient_lifetime",
  "wp_feed_options",
  "wp_widget_rss_output",
  "WP_Widget_RSS",
  "render_block_core_rss"
];
const BEHAVIOR_FLOORS = [
  {
    id: "wphx-312-25-rss-widget-helper",
    manifest: "manifests/wp-core/wphx-312-25-rss-widget-helper-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-25-rss-widget-helper-oracle-fixture.v1.json",
    role: "RSS widget helper output and error-shape handoff floor"
  },
  {
    id: "wphx-312-26-wp-widget-rss-class",
    manifest: "manifests/wp-core/wphx-312-26-wp-widget-rss-class-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-26-wp-widget-rss-class-oracle-fixture.v1.json",
    role: "WP_Widget_RSS form/update/widget handoff floor"
  },
  {
    id: "wphx-312-27-rss-block-renderer",
    manifest: "manifests/wp-core/wphx-312-27-rss-block-renderer-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-27-rss-block-renderer-oracle-fixture.v1.json",
    role: "RSS block server renderer handoff floor"
  },
  {
    id: "wphx-312-35-feed-cache-transient",
    manifest: "manifests/wp-core/wphx-312-35-feed-cache-transient-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-35-feed-cache-transient-oracle-fixture.v1.json",
    role: "WP_Feed_Cache_Transient constructor/save/load/mtime/touch/unlink floor"
  },
  {
    id: "wphx-312-36-simplepie-file-http",
    manifest: "manifests/wp-core/wphx-312-36-simplepie-file-http-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-36-simplepie-file-http-oracle-fixture.v1.json",
    role: "WP_SimplePie_File Core HTTP handoff and error mapping floor"
  },
  {
    id: "wphx-312-37-simplepie-feed-wrapper",
    manifest: "manifests/wp-core/wphx-312-37-simplepie-feed-wrapper-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-37-simplepie-feed-wrapper-oracle-fixture.v1.json",
    role: "class-simplepie/class-feed load-order and adapter class floor"
  },
  {
    id: "wphx-312-94-feed-embed-widget-privacy-installed-routes",
    manifest: "manifests/wp-core/wphx-312-94-feed-embed-widget-privacy-installed-routes-gate.v1.json",
    receipt: "receipts/wp-core/wphx-312-94-feed-embed-widget-privacy-installed-routes-gate.v1.json",
    role: "installed-style feed/widget/block/privacy bridge route floor"
  }
];
const BLOCKED_CONDITIONS = [
  {
    id: "live-external-feeds",
    status: "blocked",
    reason: "This gate only uses deterministic loopback URLs. External providers, redirects across public networks, throttling, robots policy, and provider-specific malformed feeds remain preserved-upstream fallback territory."
  },
  {
    id: "tls-proxy-dns",
    status: "blocked",
    reason: "The local loopback server intentionally omits TLS, proxy negotiation, DNS failures, IPv6 routing, certificate validation, and corporate proxy behavior."
  },
  {
    id: "persistent-object-cache-and-database-state",
    status: "blocked",
    reason: "Site transients are deterministic in-memory stubs. Persistent object-cache backends, database-backed installed feed state, cache serialization upgrades, and multisite cache behavior are not claimed."
  },
  {
    id: "browser-widget-block-rendering",
    status: "blocked",
    reason: "Widget and RSS block behavior is reconciled from existing deterministic PHP fixtures. Browser rendering, editor behavior, styles, interactivity, and installed dashboard/widget screens remain unclaimed."
  },
  {
    id: "generated-wrapper-runtime",
    status: "blocked",
    reason: "Oracle and candidate roots both execute copied upstream SimplePie and WordPress wrapper files. No generated WPHX PHP wrapper, overlay manifest, host-primitive adapter, or copied artifact retirement is present."
  }
];

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 120
  }).trim();
}

function commandAsync(commandName, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, commandArgs, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Command failed: ${commandName} ${commandArgs.join(" ")}\n${stderr}${stdout}`));
      }
    });
  });
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
  mkdirSync(mirrorPath(root, SIMPLEPIE_ROOT), { recursive: true });
  cpSync(upstreamPath(SIMPLEPIE_ROOT), mirrorPath(root, SIMPLEPIE_ROOT), { recursive: true });
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
namespace Psr\\Http\\Client {
\tinterface ClientInterface {}
\tinterface ClientExceptionInterface {}
\tinterface NetworkExceptionInterface extends ClientExceptionInterface {}
\tinterface RequestExceptionInterface extends ClientExceptionInterface {}
}
namespace Psr\\Http\\Message {
\tinterface MessageInterface {}
\tinterface RequestInterface extends MessageInterface {}
\tinterface ResponseInterface extends MessageInterface {}
\tinterface StreamInterface {}
\tinterface UriInterface {}
\tinterface RequestFactoryInterface {}
\tinterface UriFactoryInterface {}
}
namespace Psr\\SimpleCache {
\tinterface CacheInterface {}
\tinterface InvalidArgumentException {}
}
namespace {
$root = rtrim( $argv[1], '/\\\\' );
$case = $argv[2] ?? '';
$base_url = rtrim( $argv[3] ?? '', '/' );

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'HOUR_IN_SECONDS', 3600 );

$GLOBALS['wphx_filters'] = array();
$GLOBALS['wphx_actions'] = array();
$GLOBALS['wphx_requests'] = array();
$GLOBALS['wphx_transients'] = array();
$GLOBALS['wphx_kses_calls'] = array();
$GLOBALS['wphx_now'] = 1800000000;

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

function __( $text ) {
\treturn $text;
}
function esc_url( $url ) {
\treturn $url;
}
function _deprecated_file( $file, $version, $replacement = '', $message = '' ) {}
function _deprecated_function( $function, $version, $replacement = '' ) {}
function get_bloginfo( $show = '' ) {
\treturn 'charset' === $show ? 'UTF-8' : '';
}
function wphx_normalize_observed_value( $value ) {
\tif ( is_string( $value ) ) {
\t\t$value = preg_replace( '/127\\.0\\.0\\.1:\\d+/', '127.0.0.1:__PORT__', $value );
\t\tif ( preg_match( '/^[a-f0-9]{32}$/', $value ) ) {
\t\t\treturn '__simplepie_cache_key__';
\t\t}
\t\treturn $value;
\t}
\tif ( is_array( $value ) ) {
\t\treturn array_map( 'wphx_normalize_observed_value', $value );
\t}
\treturn $value;
}
function is_wp_error( $thing ) {
\treturn $thing instanceof WP_Error;
}
function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_filters'][] = array( 'hook' => $hook_name, 'value' => $value, 'args' => wphx_normalize_observed_value( $args ) );
\tif ( 'wp_feed_cache_transient_lifetime' === $hook_name ) {
\t\t$subject = $args[0] ?? '';
\t\tif ( is_string( $subject ) && str_contains( $subject, 'rss-success.xml' ) ) {
\t\t\treturn 777;
\t\t}
\t\tif ( is_array( $subject ) ) {
\t\t\treturn 888;
\t\t}
\t\tif ( 'cache-gate' === $subject ) {
\t\t\treturn 9;
\t\t}
\t}
\treturn $value;
}
function do_action_ref_array( $hook_name, $args ) {
\t$GLOBALS['wphx_actions'][] = array(
\t\t'hook' => $hook_name,
\t\t'arg_count' => count( $args ),
\t\t'url_shape' => is_array( $args[1] ?? null ) ? 'array' : gettype( $args[1] ?? null ),
\t);
}
function wp_kses_post( $data ) {
\t$GLOBALS['wphx_kses_calls'][] = $data;
\t$data = preg_replace( '/<script\\b[^>]*>.*?<\\/script>/is', '', $data );
\t$data = preg_replace( '/\\s+on[a-z]+=(\"[^\"]*\"|\\'[^\\']*\\'|[^\\s>]+)/i', '', $data );
\treturn $data;
}
function set_site_transient( $name, $value, $expiration = 0 ) {
\t$GLOBALS['wphx_transients'][ $name ] = array(
\t\t'value' => $value,
\t\t'expiration' => $expiration,
\t\t'expires_at' => $expiration > 0 ? $GLOBALS['wphx_now'] + $expiration : 0,
\t);
\treturn true;
}
function get_site_transient( $name ) {
\tif ( ! isset( $GLOBALS['wphx_transients'][ $name ] ) ) {
\t\treturn false;
\t}
\t$record = $GLOBALS['wphx_transients'][ $name ];
\tif ( $record['expires_at'] > 0 && $record['expires_at'] <= $GLOBALS['wphx_now'] ) {
\t\tunset( $GLOBALS['wphx_transients'][ $name ] );
\t\treturn false;
\t}
\treturn $record['value'];
}
function delete_site_transient( $name ) {
\tunset( $GLOBALS['wphx_transients'][ $name ] );
\treturn true;
}
function wp_safe_remote_request( $url, $args ) {
\t$GLOBALS['wphx_requests'][] = array( 'url' => $url, 'args' => $args );
\tif ( str_contains( $url, '/transport-failure.xml' ) ) {
\t\treturn new WP_Error( 'http_request_failed', 'fixture loopback transport failed' );
\t}
\t$context = stream_context_create(
\t\tarray(
\t\t\t'http' => array(
\t\t\t\t'method' => 'GET',
\t\t\t\t'timeout' => $args['timeout'] ?? 10,
\t\t\t\t'ignore_errors' => true,
\t\t\t),
\t\t)
\t);
\t$body = @file_get_contents( $url, false, $context );
\tif ( false === $body ) {
\t\treturn new WP_Error( 'http_request_failed', 'fixture loopback read failed' );
\t}
\t$headers = array();
\t$status_code = 0;
\tforeach ( $http_response_header ?? array() as $line ) {
\t\tif ( preg_match( '/^HTTP\\/\\S+\\s+(\\d+)/', $line, $matches ) ) {
\t\t\t$status_code = (int) $matches[1];
\t\t\tcontinue;
\t\t}
\t\tif ( ! str_contains( $line, ':' ) ) {
\t\t\tcontinue;
\t\t}
\t\tlist( $name, $value ) = array_map( 'trim', explode( ':', $line, 2 ) );
\t\t$key = strtolower( $name );
\t\tif ( isset( $headers[ $key ] ) ) {
\t\t\t$headers[ $key ] = is_array( $headers[ $key ] ) ? array_merge( $headers[ $key ], array( $value ) ) : array( $headers[ $key ], $value );
\t\t} else {
\t\t\t$headers[ $key ] = $value;
\t\t}
\t}
\treturn array( 'headers' => $headers, 'body' => $body, 'response' => array( 'code' => $status_code ) );
}
function wp_remote_retrieve_headers( $response ) {
\treturn $response['headers'] ?? array();
}
function wp_remote_retrieve_body( $response ) {
\treturn $response['body'] ?? '';
}
function wp_remote_retrieve_response_code( $response ) {
\treturn $response['response']['code'] ?? 0;
}
function wphx_error_summary( $thing ) {
\tif ( $thing instanceof WP_Error ) {
\t\t$message = wphx_normalize_observed_value( (string) $thing->get_error_message() );
\t\treturn array( 'is_wp_error' => true, 'code' => $thing->get_error_code(), 'message_sha256' => 'sha256:' . hash( 'sha256', $message ) );
\t}
\treturn array( 'is_wp_error' => false );
}
function wphx_feed_summary( $feed ) {
\tif ( $feed instanceof WP_Error ) {
\t\treturn wphx_error_summary( $feed );
\t}
\t$items = $feed->get_items();
\treturn array(
\t\t'is_wp_error' => false,
\t\t'class' => get_class( $feed ),
\t\t'title' => $feed->get_title(),
\t\t'item_count' => count( $items ),
\t\t'first_item_title' => isset( $items[0] ) ? $items[0]->get_title() : null,
\t\t'sanitize_class' => is_object( $feed->sanitize ?? null ) ? get_class( $feed->sanitize ) : null,
\t);
}
function wphx_request_summary() {
\treturn array_map(
\t\tfunction ( $request ) {
\t\t\treturn array(
\t\t\t\t'path' => parse_url( $request['url'], PHP_URL_PATH ),
\t\t\t\t'args' => $request['args'],
\t\t\t);
\t\t},
\t\t$GLOBALS['wphx_requests']
\t);
}
function wphx_transient_summary() {
\t$out = array();
\tforeach ( $GLOBALS['wphx_transients'] as $name => $record ) {
\t\t$out[ $name ] = array(
\t\t\t'value_type' => is_object( $record['value'] ) ? get_class( $record['value'] ) : gettype( $record['value'] ),
\t\t\t'expiration' => $record['expiration'],
\t\t\t'expires_at_delta' => $record['expires_at'] > 0 ? $record['expires_at'] - $GLOBALS['wphx_now'] : 0,
\t\t);
\t}
\tksort( $out );
\treturn $out;
}

require_once ABSPATH . WPINC . '/feed.php';
require_once ABSPATH . WPINC . '/class-simplepie.php';
require_once ABSPATH . WPINC . '/class-wp-feed-cache-transient.php';
require_once ABSPATH . WPINC . '/class-wp-simplepie-file.php';
require_once ABSPATH . WPINC . '/class-wp-simplepie-sanitize-kses.php';

$assertions = array();
$result = array( 'case' => $case );

switch ( $case ) {
\tcase 'fetch-feed:loopback-rss-success':
\t\t$feed = fetch_feed( $base_url . '/rss-success.xml' );
\t\t$result['feed'] = wphx_feed_summary( $feed );
\t\t$result['requests'] = wphx_request_summary();
\t\t$result['filters'] = $GLOBALS['wphx_filters'];
\t\t$result['actions'] = $GLOBALS['wphx_actions'];
\t\t$assertions['success_feed'] = false === $result['feed']['is_wp_error'] && 'WPHX Loopback RSS' === $result['feed']['title'] && 2 === $result['feed']['item_count'];
\t\t$assertions['custom_wrappers'] = 'WP_SimplePie_Sanitize_KSES' === $result['feed']['sanitize_class'] && 1 === count( $GLOBALS['wphx_requests'] );
\t\t$assertions['cache_filter'] = 777 === $GLOBALS['wphx_filters'][0]['value'] || 'wp_feed_cache_transient_lifetime' === $GLOBALS['wphx_filters'][0]['hook'];
\t\tbreak;

\tcase 'fetch-feed:single-array-url':
\t\t$feed = fetch_feed( array( $base_url . '/rss-success.xml' ) );
\t\t$result['feed'] = wphx_feed_summary( $feed );
\t\t$result['actions'] = $GLOBALS['wphx_actions'];
\t\t$result['requests'] = wphx_request_summary();
\t\t$assertions['action_sees_original_array'] = false === $result['feed']['is_wp_error'] && 'array' === $GLOBALS['wphx_actions'][0]['url_shape'];
\t\t$assertions['single_url_requested_once'] = 1 === count( $GLOBALS['wphx_requests'] );
\t\tbreak;

\tcase 'fetch-feed:multi-url-merge':
\t\t$feed = fetch_feed( array( $base_url . '/rss-success.xml', $base_url . '/atom-success.xml' ) );
\t\t$result['feed'] = wphx_feed_summary( $feed );
\t\t$result['actions'] = $GLOBALS['wphx_actions'];
\t\t$result['requests'] = wphx_request_summary();
\t\t$assertions['multi_url_action_shape'] = 'array' === $GLOBALS['wphx_actions'][0]['url_shape'];
\t\t$assertions['merged_items'] = false === $result['feed']['is_wp_error'] && $result['feed']['item_count'] >= 2;
\t\tbreak;

\tcase 'fetch-feed:transport-failure':
\t\t$feed = fetch_feed( $base_url . '/transport-failure.xml' );
\t\t$result['error'] = wphx_error_summary( $feed );
\t\t$result['requests'] = wphx_request_summary();
\t\t$assertions['wp_error'] = true === $result['error']['is_wp_error'] && 'simplepie-error' === $result['error']['code'];
\t\tbreak;

\tcase 'fetch-feed:malformed-response':
\t\t$feed = fetch_feed( $base_url . '/malformed.xml' );
\t\t$result['error'] = wphx_error_summary( $feed );
\t\t$result['requests'] = wphx_request_summary();
\t\t$assertions['wp_error'] = true === $result['error']['is_wp_error'] && 'simplepie-error' === $result['error']['code'];
\t\tbreak;

\tcase 'feed-cache:hit-miss-expiry':
\t\t$cache = new WP_Feed_Cache_Transient( 'wp_transient', 'cache-gate', SimplePie\\Cache\\Base::TYPE_FEED );
\t\t$miss = $cache->load();
\t\t$cache->save( array( 'items' => array( 'alpha', 'beta' ) ) );
\t\t$hit = $cache->load();
\t\t$mtime = $cache->mtime();
\t\t$GLOBALS['wphx_now'] += 10;
\t\t$expired = $cache->load();
\t\t$result['miss'] = $miss;
\t\t$result['hit'] = $hit;
\t\t$result['mtime_is_int'] = is_int( $mtime ) && $mtime > 0;
\t\t$result['expired'] = $expired;
\t\t$result['transients'] = wphx_transient_summary();
\t\t$assertions['miss_false'] = false === $miss;
\t\t$assertions['hit_roundtrip'] = array( 'items' => array( 'alpha', 'beta' ) ) === $hit;
\t\t$assertions['mtime'] = true === $result['mtime_is_int'];
\t\t$assertions['expiry_false'] = false === $expired;
\t\tbreak;

\tcase 'simplepie-file:loopback-handoff':
\t\t$file = new WP_SimplePie_File( $base_url . '/headers.xml', 12, 4, array( 'Accept' => 'application/rss+xml' ), 'wphx-simplepie/1.0' );
\t\t$result['file'] = array(
\t\t\t'headers' => $file->headers,
\t\t\t'body_sha256' => 'sha256:' . hash( 'sha256', (string) $file->body ),
\t\t\t'status_code' => $file->status_code,
\t\t\t'success' => $file->success ?? null,
\t\t\t'error' => $file->error ?? null,
\t\t);
\t\t$result['requests'] = wphx_request_summary();
\t\t$assertions['request_args'] = array( 'timeout' => 12, 'redirection' => 4, 'headers' => array( 'Accept' => 'application/rss+xml' ), 'user-agent' => 'wphx-simplepie/1.0' ) === $GLOBALS['wphx_requests'][0]['args'];
\t\t$assertions['headers_normalized'] = 'application/rss+xml' === $file->headers['content-type'] && 'a, b' === $file->headers['x-fixture'];
\t\t$assertions['status_body'] = 200 === $file->status_code && str_contains( $file->body, '<rss' );
\t\tbreak;

\tcase 'sanitize:kses-html-and-base64':
\t\t$sanitizer = new WP_SimplePie_Sanitize_KSES();
\t\t$sanitizer->output_encoding = 'UTF-8';
\t\t$html = $sanitizer->sanitize( '<p onclick="bad()">Safe<script>alert(1)</script></p>', SimplePie\\SimplePie::CONSTRUCT_MAYBE_HTML );
\t\t$base64 = $sanitizer->sanitize( base64_encode( '<em>Encoded</em><script>x</script>' ), SimplePie\\SimplePie::CONSTRUCT_BASE64 | SimplePie\\SimplePie::CONSTRUCT_HTML );
\t\t$result['html'] = $html;
\t\t$result['base64'] = $base64;
\t\t$result['kses_call_count'] = count( $GLOBALS['wphx_kses_calls'] );
\t\t$assertions['html_sanitized'] = '<p>Safe</p>' === $html;
\t\t$assertions['base64_sanitized'] = '<em>Encoded</em>' === $base64;
\t\t$assertions['kses_called_twice'] = 2 === count( $GLOBALS['wphx_kses_calls'] );
\t\tbreak;
}

$result['assertions'] = $assertions;
echo json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL;
}
`
  );
}

async function runProbe(root, baseUrl) {
  const observations = {};
  for (const fixtureCase of CASES) {
    observations[fixtureCase.id] = JSON.parse(await commandAsync("php", [PROBE, root, fixtureCase.id, baseUrl]));
  }
  return observations;
}

function observationsAssert(observations) {
  return Object.values(observations).every((observation) => Object.values(observation.assertions ?? {}).every(Boolean));
}

function validationForFloor(floor) {
  const manifest = readJson(floor.manifest);
  const validation = manifest.validation_result ?? {};
  return {
    ...floor,
    manifest_sha256: sha256File(floor.manifest),
    receipt_sha256: sha256File(floor.receipt),
    status: validation.status,
    fixture_cases: validation.fixture_cases,
    covered_symbols: validation.covered_symbols,
    observations_match: validation.observations_match,
    public_php_replacement_claimed: validation.public_php_replacement_claimed,
    installed_wordpress_behavior_claimed: validation.installed_wordpress_behavior_claimed ?? false
  };
}

function serverResponse(path) {
  if (path === "/rss-success.xml" || path === "/headers.xml") {
    return {
      status: 200,
      headers: {
        "content-type": "application/rss+xml",
        "x-fixture": ["a", "b"]
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>WPHX Loopback RSS</title>
    <link>http://127.0.0.1/feed</link>
    <description>Loopback feed fixture</description>
    <item><title>Loopback Item One</title><link>http://127.0.0.1/one</link><guid>one</guid><description>One</description></item>
    <item><title>Loopback Item Two</title><link>http://127.0.0.1/two</link><guid>two</guid><description>Two</description></item>
  </channel>
</rss>`
    };
  }
  if (path === "/atom-success.xml") {
    return {
      status: 200,
      headers: { "content-type": "application/atom+xml" },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>WPHX Loopback Atom</title>
  <id>tag:127.0.0.1,2026:atom</id>
  <updated>2026-07-07T12:00:00Z</updated>
  <entry><title>Atom Loopback Item</title><id>tag:127.0.0.1,2026:item</id><updated>2026-07-07T12:01:00Z</updated><link href="http://127.0.0.1/atom" /></entry>
</feed>`
    };
  }
  if (path === "/malformed.xml") {
    return { status: 200, headers: { "content-type": "application/rss+xml" }, body: "<?xml version=\"1.0\"?><rss><channel><title>Broken</title><item>" };
  }
  return { status: 404, headers: { "content-type": "text/plain" }, body: "not found" };
}

async function withLoopbackServer(callback) {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ method: request.method, url: request.url, headers: request.headers });
    const fixture = serverResponse(new URL(request.url, "http://127.0.0.1").pathname);
    response.sendDate = false;
    response.writeHead(fixture.status, fixture.headers);
    response.end(fixture.body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    const result = await callback(`http://127.0.0.1:${address.port}`);
    return { ...result, loopback_server_requests: requests };
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function main() {
  const failures = [];
  const strategy = readJson(STRATEGY);
  const feedGates = readJson(FEED_GATES);
  const apiCorpus = readJson(API_CORPUS);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const simplepiePlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "simplepie");
  const simplepieGate = feedGates.gate_plan.find((entry) => entry.id === "simplepie-wordpress-wrapper-cache-widget-block-and-transport");
  const simplepieBoundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "simplepie");

  if (simplepiePlan?.replacement_strategy !== "generated_wrapper_around_upstream_equivalent_dependency") {
    failures.push(`unexpected SimplePie replacement strategy: ${simplepiePlan?.replacement_strategy}`);
  }
  if (simplepieGate?.downstream_issue.external_ref !== ISSUE.external_ref) {
    failures.push("WPHX-323.04 SimplePie wrapper/cache/transport gate is not routed to WPHX-323.15");
  }
  if (apiCorpus.validation_result?.observations_equal !== true || apiCorpus.validation_result?.copied_artifact_retirement_claimed !== false) {
    failures.push("WPHX-323.14 SimplePie API/corpus prerequisite is not passed");
  }
  if (simplepieBoundary?.source_tree?.file_count !== 82 || simplepieBoundary?.distribution_artifacts?.count !== 82) {
    failures.push("SimplePie vendor boundary inventory count changed unexpectedly");
  }

  const simplepieFiles = listFiles(SIMPLEPIE_ROOT);
  const inputFiles = [...simplepieFiles, ...SUPPORT_FILES].sort();
  const source_records = inputFiles.map(sourceRecord);

  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe();

  const lint = {
    oracle: command("php", ["-l", PROBE]),
    candidate: command("php", ["-l", PROBE])
  };
  for (const root of [ORACLE_ROOT, CANDIDATE_ROOT]) {
    for (const path of inputFiles) {
      command("php", ["-l", mirrorPath(root, path)]);
    }
  }

  const probeResult = await withLoopbackServer(async (baseUrl) => {
    const oracleObservations = await runProbe(ORACLE_ROOT, baseUrl);
    const candidateObservations = await runProbe(CANDIDATE_ROOT, baseUrl);
    return { base_url_shape: "loopback-ephemeral-port", oracleObservations, candidateObservations };
  });

  const observations_match = JSON.stringify(probeResult.oracleObservations) === JSON.stringify(probeResult.candidateObservations);
  const oracle_assert = observationsAssert(probeResult.oracleObservations);
  const candidate_assert = observationsAssert(probeResult.candidateObservations);
  if (!observations_match) failures.push("oracle/candidate observations differ");
  if (!oracle_assert || !candidate_assert) failures.push("one or more PHP probe assertions failed");

  const behavior_floors = BEHAVIOR_FLOORS.map(validationForFloor);
  for (const floor of behavior_floors) {
    if (floor.status !== "passed" || floor.observations_match !== true || floor.public_php_replacement_claimed !== false) {
      failures.push(`${floor.id} prerequisite floor is not a passed non-replacement observation`);
    }
  }

  const manifest = {
    schema: "wphx.wp_core.simplepie_wrapper_cache_transport_gate.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "preserved_simplepie_wrapper_cache_transport_gate",
    behavior_parity_claimed: true,
    behavior_parity_scope: "deterministic_loopback_wrapper_cache_transport_observation_match_only",
    haxe_runtime_ownership_claimed: false,
    generated_wrapper_claimed: false,
    public_php_replacement_claimed: false,
    copied_artifact_retirement_claimed: false,
    installed_wordpress_parity_claimed: false,
    inputs: {
      parent_strategy_manifest: fileRecord(STRATEGY),
      feed_vendor_gate_manifest: fileRecord(FEED_GATES),
      api_reflection_corpus_manifest: fileRecord(API_CORPUS),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      source_records
    },
    fixture: {
      copied_roots: [ORACLE_ROOT, CANDIDATE_ROOT],
      probe: fileRecord(PROBE),
      cases: CASES,
      covered_symbols: COVERED_SYMBOLS,
      loopback_server: {
        address_policy: "127.0.0.1 ephemeral port per run",
        external_network_used: false,
        request_count: probeResult.loopback_server_requests.length,
        paths: [...new Set(probeResult.loopback_server_requests.map((request) => new URL(request.url, "http://127.0.0.1").pathname))].sort()
      }
    },
    prerequisite_behavior_floors: behavior_floors,
    blocked_conditions: BLOCKED_CONDITIONS,
    observations: {
      oracle: probeResult.oracleObservations,
      candidate: probeResult.candidateObservations,
      observations_match,
      oracle_assertions_passed: oracle_assert,
      candidate_assertions_passed: candidate_assert
    },
    build: {
      oracle_package_files: inputFiles.map((path) => fileRecord(mirrorPath(ORACLE_ROOT, path))),
      candidate_package_files: inputFiles.map((path) => fileRecord(mirrorPath(CANDIDATE_ROOT, path))),
      php_lint: lint
    },
    replacement_readiness: {
      current_decision: "preserve_upstream_simplepie_package_and_wordpress_wrapper_files",
      generated_wrapper_path: "blocked_until_candidate_overlay_manifest_and_generated_WPHX_PHP_wrapper_shape_exist",
      required_before_retirement: [
        "generated original-path WordPress wrapper overlays for feed.php/class-simplepie/class-feed/cache/file/sanitize boundaries",
        "SimplePie upstream-equivalent dependency provenance and license decision",
        "API/reflection corpus parity from WPHX-323.14",
        "wrapper/cache/transport parity from WPHX-323.15",
        "ecosystem caller and replacement decision gate from WPHX-323.17",
        "selected upstream PHPUnit feed-simplepie-core pass/pass with overlays",
        "installed database-backed feed, widget, and block route evidence",
        "live/TLS/proxy/DNS fallback policy evidence"
      ]
    },
    validation_summary: {
      status: failures.length === 0 ? "passed" : "failed",
      failures,
      fixture_cases: CASES.length,
      covered_symbols: COVERED_SYMBOLS.length,
      source_file_count: source_records.length,
      behavior_floor_count: behavior_floors.length,
      loopback_server_request_count: probeResult.loopback_server_requests.length,
      observations_match,
      observations_assert: oracle_assert && candidate_assert,
      public_php_replacement_claimed: false,
      generated_wrapper_claimed: false,
      copied_artifact_retirement_claimed: false,
      installed_wordpress_parity_claimed: false,
      live_external_feed_claimed: false
    },
    ownership_manifest: OWNERSHIP,
    receipt: RECEIPT,
    non_claims: [
      "This gate does not implement or claim Haxe-owned SimplePie runtime logic.",
      "This gate does not emit generated SimplePie wrappers or original-path public PHP replacements.",
      "This gate does not retire copied SimplePie package files, class-simplepie.php, class-feed.php, feed.php, or WordPress feed adapter files.",
      "This gate does not claim live external feed provider behavior, TLS, proxy, DNS, persistent object-cache, database-backed installed feed state, browser/editor widget or block parity, or installed WordPress feed parity.",
      "The deterministic loopback server, PHP probe stubs, and copied roots are replacement-readiness evidence only, not distributable WPHX runtime code."
    ]
  };

  const ownership = {
    schema: "wphx.ownership_manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-15-simplepie-wrapper-cache-transport-gate",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    evidence: OUT,
    boundary: {
      id: "simplepie",
      owned_paths: SUPPORT_FILES.map((path) => path.replace(/^src\//, "")).concat(["wp-includes/SimplePie/**"]),
      emission_strategy: "copied_upstream_simplepie_package_with_deterministic_loopback_wrapper_cache_transport_probe",
      behavior_parity_scope: "deterministic_loopback_wrapper_cache_transport_observation_match_only",
      haxe_runtime_ownership_claimed: false,
      generated_wrapper_claimed: false,
      public_php_replacement_claimed: false,
      copied_artifact_retirement_claimed: false,
      installed_wordpress_parity_claimed: false
    },
    non_claims: manifest.non_claims,
    removal_gate: "Replace this preserved-package gate with generated WPHX PHP wrapper overlays only after API/reflection, wrapper/cache/transport, provenance, ecosystem, upstream PHPUnit, installed route, and live/fallback gates pass with a non-empty candidate overlay manifest."
  };

  const receipt = {
    id: "wphx-323-15-simplepie-wrapper-cache-transport-gate",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    evidence_class: manifest.evidence_class,
    artifact_scope: "wp-includes/SimplePie plus WordPress feed wrapper/cache/file/sanitize public PHP fallback roots",
    commands: [
      "npm run wp:core:wphx-323-simplepie-wrapper-cache-transport",
      "npm run wp:core:wphx-323-simplepie-wrapper-cache-transport:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      receipt: RECEIPT,
      feed_vendor_gates_manifest: FEED_GATES,
      api_reflection_corpus_manifest: API_CORPUS,
      vendor_closure_manifest: VENDOR_CLOSURE
    },
    evidence_summary: {
      status: manifest.validation_summary.status,
      fixture_cases: CASES.length,
      covered_symbols: COVERED_SYMBOLS.length,
      source_file_count: source_records.length,
      behavior_floor_count: behavior_floors.length,
      loopback_server_request_count: probeResult.loopback_server_requests.length,
      observations_match,
      observations_assert: oracle_assert && candidate_assert,
      blocked_condition_count: BLOCKED_CONDITIONS.length
    },
    non_claims: manifest.non_claims,
    next_required_gates: [
      "WPHX-323.17 feed vendor provenance and replacement decision gate",
      "generated WPHX PHP wrapper/overlay evidence before copied SimplePie artifact retirement",
      "installed database-backed feed/widget/block parity and live/TLS/proxy/DNS fallback gates"
    ],
    result: manifest.validation_summary.status
  };

  writeOrCheck(OUT, `${JSON.stringify(manifest, null, 2)}\n`);
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);
  writeOrCheck(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);

  if (failures.length > 0) {
    throw new Error(`WPHX-323.15 validation failed:\n- ${failures.join("\n- ")}`);
  }
  console.log(`${checkOnly ? "Checked" : "Wrote"} ${OUT}`);
  console.log(`${checkOnly ? "Checked" : "Wrote"} ${OWNERSHIP}`);
  console.log(`${checkOnly ? "Checked" : "Wrote"} ${RECEIPT}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
