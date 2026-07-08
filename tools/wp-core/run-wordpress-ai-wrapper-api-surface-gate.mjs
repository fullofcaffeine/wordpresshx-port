#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.33.2",
  external_ref: "WPHX-323.24",
  title: "Gate WordPress AI wrapper API surface"
};
const RECORDED_AT = "2026-07-08T21:30:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-wordpress-ai-wrapper-api-surface-gate.mjs";
const OUT_ROOT = "build/wp-core/wphx-323-24";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/wordpress-ai-wrapper-probe.php`;
const UPSTREAM_LOCK = "upstream.lock.json";
const AI_TINYMCE_GATES = "manifests/wp-core/wphx-323-07-ai-client-tinymce-vendor-gates.v1.json";
const PHP_AI_CLIENT_SUB_BOUNDARIES = "manifests/wp-core/wphx-323-23-php-ai-client-sub-boundaries.v1.json";
const AI_HTTP_FIXTURE = "manifests/wp-core/wphx-312-05-ai-http-oracle-fixture.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const SOURCE_INVENTORY = "manifests/source-inventory.jsonl";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const OUT = "manifests/wp-core/wphx-323-24-wordpress-ai-wrapper-api-surface.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-24-wordpress-ai-wrapper-api-surface.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-24-wordpress-ai-wrapper-api-surface.v1.json";

const PHP_AI_CLIENT_ROOT = "src/wp-includes/php-ai-client";
const WORDPRESS_AI_WRAPPER_FILES = [
  "src/wp-includes/ai-client.php",
  "src/wp-includes/ai-client/adapters/class-wp-ai-client-cache.php",
  "src/wp-includes/ai-client/adapters/class-wp-ai-client-discovery-strategy.php",
  "src/wp-includes/ai-client/adapters/class-wp-ai-client-event-dispatcher.php",
  "src/wp-includes/ai-client/adapters/class-wp-ai-client-http-client.php",
  "src/wp-includes/ai-client/class-wp-ai-client-ability-function-resolver.php",
  "src/wp-includes/ai-client/class-wp-ai-client-prompt-builder.php"
];
const PROBE_MODES = [
  "support_filter",
  "support_disabled_constant",
  "prompt_prevent_filter",
  "prompt_disabled_constant",
  "event_dispatcher",
  "cache_adapter",
  "http_client_expanded"
];

const CASES = [
  { id: "wordpress-ai-wrapper:wp-supports-ai-filter", focus: "wp_supports_ai default, filter coercion, and filter short-circuit behavior" },
  { id: "wordpress-ai-wrapper:wp-supports-ai-disabled-constant", focus: "WP_AI_SUPPORT false bypasses filters and returns false" },
  { id: "wordpress-ai-wrapper:prompt-builder-prevent-filter", focus: "wp_ai_client_prompt returns wrapper builder and prompt-prevent filter blocks generation without live provider calls" },
  { id: "wordpress-ai-wrapper:prompt-builder-disabled-ai", focus: "wp_ai_client_prompt returns disabled-environment WP_Error for generation when AI support is off" },
  { id: "wordpress-ai-wrapper:event-dispatcher", focus: "PSR event dispatch maps event class names to WordPress action hooks and returns the same event object" },
  { id: "wordpress-ai-wrapper:cache-adapter", focus: "PSR-16 cache adapter bridges get/set/delete/multiple/clear/has to WordPress cache functions and TTL conversion" },
  { id: "wordpress-ai-wrapper:http-client-expanded", focus: "WordPress HTTP client adapter covers duplicate headers, empty/non-empty bodies, options, WP_HTTP_Requests_Response headers, and WP_Error mapping" }
];

const NON_CLAIMS = [
  "This gate does not claim generated public PHP replacement for wp-includes/ai-client.php or wp-includes/ai-client/*.",
  "This gate does not claim Haxe-owned WordPress AI wrapper runtime logic.",
  "This gate does not claim Haxe-owned wp-includes/php-ai-client/ internals.",
  "This gate does not claim live provider behavior, external provider discovery parity, model generation parity, installed WordPress AI behavior, credential handling safety, prompt/file privacy, or plugin ecosystem compatibility.",
  "This gate does not claim third-party dependency substitution, unscoping, deduplication, Composer replacement, or copied artifact retirement for WordPress\\AiClientDependencies.",
  "This gate does not run network I/O; all HTTP/provider-adjacent behavior is fake in-process transport.",
  "This gate does not admit hand-edited generated PHP or broad inline raw-block adapters as an implementation strategy."
];

function command(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 120
  }).trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .trimEnd()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
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

function upstreamPath(path) {
  return `${UPSTREAM_ROOT}/${path}`;
}

function mirrorPath(root, path) {
  return `${root}/${path.replace(/^src\//, "")}`;
}

function sourceToDistribution(path) {
  return path.startsWith("src/") ? path.slice("src/".length) : path;
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

function stripPhpComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1")
    .replace(/(^|\s)#.*$/gm, "$1");
}

function matchNames(text, regex) {
  return Array.from(text.matchAll(regex)).map((match) => match[1]);
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort();
}

function namespaceOf(cleanText) {
  return cleanText.match(/\bnamespace\s+([^;{]+)[;{]/)?.[1].trim() ?? null;
}

function apiInventory(path) {
  const text = readFileSync(upstreamPath(path), "utf8");
  const cleanText = stripPhpComments(text);
  const namespace = namespaceOf(cleanText);
  const symbols = [];
  const classLikeRegex = /\b(?:(?:abstract|final|readonly)\s+)*(class|interface|trait|enum)\s+([A-Za-z_][A-Za-z0-9_]*)([^{;]*)\{/g;
  for (const match of cleanText.matchAll(classLikeRegex)) {
    const [, kind, name] = match;
    symbols.push({ kind, name, fqn: namespace ? `${namespace}\\${name}` : name });
  }
  const functions = matchNames(cleanText, /\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g);
  const publicMethods = matchNames(cleanText, /\bpublic\s+(?:static\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g);
  const uses = matchNames(cleanText, /\buse\s+([^;]+);/g).map((value) => value.replace(/\s+/g, " ").trim());
  return {
    namespace,
    declared_symbols: symbols,
    declared_symbol_fqns: symbols.map((symbol) => symbol.fqn),
    functions: uniqueSorted(functions),
    public_methods: uniqueSorted(publicMethods),
    uses,
    counts: {
      class_count: symbols.filter((symbol) => symbol.kind === "class").length,
      interface_count: symbols.filter((symbol) => symbol.kind === "interface").length,
      trait_count: symbols.filter((symbol) => symbol.kind === "trait").length,
      function_or_method_count: functions.length,
      public_method_count: publicMethods.length,
      use_statement_count: uses.length
    }
  };
}

function sourceInventoryRecords(sourcePaths) {
  const wanted = new Set(sourcePaths);
  return readJsonl(SOURCE_INVENTORY)
    .filter((record) => wanted.has(record.path))
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
      haxe_owners: record.haxeOwners ?? [],
      generated_artifacts: record.generatedArtifacts ?? [],
      task_external_ref: record.taskExternalRef,
      classified: record.classified,
      exceptions: record.exceptions ?? []
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function artifactRecords(distributionPaths) {
  const wanted = new Set(distributionPaths);
  return readJsonl(ARTIFACT_PROVENANCE)
    .filter((record) => wanted.has(record.path))
    .map((record) => ({
      path: record.path,
      baseline: record.baseline,
      artifact_kind: record.artifactKind,
      artifact_digest: record.artifactDigest,
      origin: record.origin,
      migration_status: record.migrationStatus,
      task_external_ref: record.taskExternalRef,
      classified: record.classified,
      exceptions: record.exceptions ?? []
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function currentWordPressCheckout(upstreamLock) {
  const wordpressRepo = upstreamLock.repositories.find((repo) => repo.id === "wordpress-vanilla");
  if (!wordpressRepo) throw new Error("upstream.lock.json is missing wordpress-vanilla");
  const currentCommit = command("git", ["-C", UPSTREAM_ROOT, "rev-parse", "HEAD"]);
  const currentTree = command("git", ["-C", UPSTREAM_ROOT, "rev-parse", "HEAD^{tree}"]);
  const statusText = command("git", ["-C", UPSTREAM_ROOT, "status", "--short"]);
  if (currentCommit !== wordpressRepo.git.commit) {
    throw new Error(`wordpress-develop commit drift: lock=${wordpressRepo.git.commit} actual=${currentCommit}`);
  }
  if (currentTree !== wordpressRepo.git.tree) {
    throw new Error(`wordpress-develop tree drift: lock=${wordpressRepo.git.tree} actual=${currentTree}`);
  }
  return {
    relative_path: wordpressRepo.relativePath,
    authority: wordpressRepo.authority,
    role: wordpressRepo.role,
    locked_commit: wordpressRepo.git.commit,
    locked_tree: wordpressRepo.git.tree,
    locked_tag: wordpressRepo.git.tag,
    current_commit: currentCommit,
    current_tree: currentTree,
    observed_dirty_state_from_lock: wordpressRepo.observedDirtyState,
    current_status_short: statusText ? statusText.split("\n") : []
  };
}

function mirrorSources(root) {
  mkdirSync(mirrorPath(root, PHP_AI_CLIENT_ROOT), { recursive: true });
  cpSync(upstreamPath(PHP_AI_CLIENT_ROOT), mirrorPath(root, PHP_AI_CLIENT_ROOT), { recursive: true });
  for (const path of WORDPRESS_AI_WRAPPER_FILES) {
    mkdirSync(dirname(mirrorPath(root, path)), { recursive: true });
    copyFileSync(upstreamPath(path), mirrorPath(root, path));
  }
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
$root = rtrim( $argv[1], '/\\\\' );
$mode = $argv[2] ?? '';

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
if ( in_array( $mode, array( 'support_disabled_constant', 'prompt_disabled_constant' ), true ) ) {
\tdefine( 'WP_AI_SUPPORT', false );
}

$GLOBALS['wphx_323_24_errors'] = array();
$GLOBALS['wphx_323_24_filters'] = array();
$GLOBALS['wphx_323_24_filter_log'] = array();
$GLOBALS['wphx_323_24_actions'] = array();
$GLOBALS['wphx_323_24_action_log'] = array();
$GLOBALS['wphx_323_24_doing_it_wrong'] = array();
$GLOBALS['wphx_323_24_cache'] = array();
$GLOBALS['wphx_323_24_cache_log'] = array();
$GLOBALS['wphx_323_24_cache_supports_flush_group'] = true;
$GLOBALS['wphx_323_24_remote_requests'] = array();
$GLOBALS['wphx_323_24_remote_queue'] = array();

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\tif ( E_USER_DEPRECATED === $errno ) {
\t\t\treturn true;
\t\t}
\t\t$GLOBALS['wphx_323_24_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

class WP_Error {
\tprivate string $code;
\tprivate string $message;
\tprivate $data;
\tpublic function __construct( $code = '', $message = '', $data = null ) {
\t\t$this->code = (string) $code;
\t\t$this->message = (string) $message;
\t\t$this->data = $data;
\t}
\tpublic function get_error_code() { return $this->code; }
\tpublic function get_error_message() { return $this->message; }
\tpublic function get_error_data() { return $this->data; }
}

class WP_HTTP_Requests_Response {
\tprivate array $headers;
\tpublic function __construct( array $headers ) {
\t\t$this->headers = $headers;
\t}
\tpublic function get_headers(): array {
\t\treturn $this->headers;
\t}
}

function __( $text ) { return $text; }
function esc_html( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function is_wp_error( $thing ) { return $thing instanceof WP_Error; }
function _doing_it_wrong( $function_name, $message, $version ) {
\t$GLOBALS['wphx_323_24_doing_it_wrong'][] = compact( 'function_name', 'message', 'version' );
}

function add_filter( $tag, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wphx_323_24_filters'][ $tag ][ $priority ][] = array( $callback, $accepted_args );
}

function add_action( $tag, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wphx_323_24_actions'][ $tag ][ $priority ][] = array( $callback, $accepted_args );
}

function apply_filters( $tag, $value, ...$args ) {
\t$GLOBALS['wphx_323_24_filter_log'][] = array(
\t\t'tag' => $tag,
\t\t'value' => wphx_323_24_json_value( $value ),
\t\t'args' => array_map( 'wphx_323_24_json_value', $args ),
\t);
\tif ( empty( $GLOBALS['wphx_323_24_filters'][ $tag ] ) ) {
\t\treturn $value;
\t}
\tksort( $GLOBALS['wphx_323_24_filters'][ $tag ] );
\tforeach ( $GLOBALS['wphx_323_24_filters'][ $tag ] as $callbacks ) {
\t\tforeach ( $callbacks as $entry ) {
\t\t\t$callback = $entry[0];
\t\t\t$accepted = $entry[1];
\t\t\t$value = $callback( ...array_slice( array_merge( array( $value ), $args ), 0, $accepted ) );
\t\t}
\t}
\treturn $value;
}

function do_action( $tag, ...$args ) {
\t$GLOBALS['wphx_323_24_action_log'][] = array(
\t\t'tag' => $tag,
\t\t'args' => array_map( 'wphx_323_24_json_value', $args ),
\t);
\tif ( empty( $GLOBALS['wphx_323_24_actions'][ $tag ] ) ) {
\t\treturn;
\t}
\tksort( $GLOBALS['wphx_323_24_actions'][ $tag ] );
\tforeach ( $GLOBALS['wphx_323_24_actions'][ $tag ] as $callbacks ) {
\t\tforeach ( $callbacks as $entry ) {
\t\t\t$callback = $entry[0];
\t\t\t$accepted = $entry[1];
\t\t\t$callback( ...array_slice( $args, 0, $accepted ) );
\t\t}
\t}
}

function wphx_323_24_cache_key( $group, $key ): string {
\treturn (string) $group . ':' . (string) $key;
}
function wp_cache_get( $key, $group = '', $force = false, &$found = null ) {
\t$cache_key = wphx_323_24_cache_key( $group, $key );
\t$found = array_key_exists( $cache_key, $GLOBALS['wphx_323_24_cache'] );
\t$GLOBALS['wphx_323_24_cache_log'][] = array( 'fn' => 'get', 'key' => $key, 'group' => $group, 'found' => $found );
\treturn $found ? $GLOBALS['wphx_323_24_cache'][ $cache_key ]['value'] : false;
}
function wp_cache_set( $key, $value, $group = '', $expire = 0 ) {
\t$GLOBALS['wphx_323_24_cache_log'][] = array( 'fn' => 'set', 'key' => $key, 'group' => $group, 'expire' => $expire, 'value' => wphx_323_24_json_value( $value ) );
\tif ( 0 === strpos( (string) $key, 'fail' ) ) {
\t\treturn false;
\t}
\t$GLOBALS['wphx_323_24_cache'][ wphx_323_24_cache_key( $group, $key ) ] = array( 'value' => $value, 'expire' => $expire );
\treturn true;
}
function wp_cache_delete( $key, $group = '' ) {
\t$GLOBALS['wphx_323_24_cache_log'][] = array( 'fn' => 'delete', 'key' => $key, 'group' => $group );
\t$cache_key = wphx_323_24_cache_key( $group, $key );
\t$existed = array_key_exists( $cache_key, $GLOBALS['wphx_323_24_cache'] );
\tunset( $GLOBALS['wphx_323_24_cache'][ $cache_key ] );
\treturn $existed;
}
function wp_cache_get_multiple( $keys, $group = '' ) {
\t$result = array();
\tforeach ( $keys as $key ) {
\t\t$found = false;
\t\t$result[ $key ] = wp_cache_get( $key, $group, false, $found );
\t}
\t$GLOBALS['wphx_323_24_cache_log'][] = array( 'fn' => 'get_multiple', 'keys' => array_values( $keys ), 'group' => $group );
\treturn $result;
}
function wp_cache_set_multiple( $values, $group = '', $expire = 0 ) {
\t$results = array();
\tforeach ( $values as $key => $value ) {
\t\t$results[ $key ] = wp_cache_set( $key, $value, $group, $expire );
\t}
\treturn $results;
}
function wp_cache_delete_multiple( $keys, $group = '' ) {
\t$results = array();
\tforeach ( $keys as $key ) {
\t\t$results[ $key ] = wp_cache_delete( $key, $group );
\t}
\treturn $results;
}
function wp_cache_supports( $feature ) {
\treturn 'flush_group' === $feature && $GLOBALS['wphx_323_24_cache_supports_flush_group'];
}
function wp_cache_flush_group( $group ) {
\t$GLOBALS['wphx_323_24_cache_log'][] = array( 'fn' => 'flush_group', 'group' => $group );
\tforeach ( array_keys( $GLOBALS['wphx_323_24_cache'] ) as $key ) {
\t\tif ( 0 === strpos( $key, (string) $group . ':' ) ) {
\t\t\tunset( $GLOBALS['wphx_323_24_cache'][ $key ] );
\t\t}
\t}
\treturn true;
}

function wp_safe_remote_request( $url, $args ) {
\t$GLOBALS['wphx_323_24_remote_requests'][] = array( 'url' => $url, 'args' => $args );
\tif ( empty( $GLOBALS['wphx_323_24_remote_queue'] ) ) {
\t\treturn new WP_Error( 'empty_remote_queue', 'No queued response' );
\t}
\treturn array_shift( $GLOBALS['wphx_323_24_remote_queue'] );
}
function wp_remote_retrieve_response_code( $response ) { return $response['response']['code'] ?? 0; }
function wp_remote_retrieve_response_message( $response ) { return $response['response']['message'] ?? ''; }
function wp_remote_retrieve_headers( $response ) { return $response['headers'] ?? array(); }
function wp_remote_retrieve_body( $response ) { return $response['body'] ?? ''; }

function wphx_323_24_json_value( $value ) {
\tif ( $value instanceof WP_Error ) {
\t\treturn array( 'kind' => 'WP_Error', 'code' => $value->get_error_code(), 'message' => $value->get_error_message(), 'data' => $value->get_error_data() );
\t}
\tif ( is_object( $value ) ) {
\t\treturn array( 'kind' => 'object', 'class' => get_class( $value ), 'id' => spl_object_id( $value ) );
\t}
\tif ( is_resource( $value ) ) {
\t\treturn array( 'kind' => 'resource', 'type' => get_resource_type( $value ) );
\t}
\treturn $value;
}

function wphx_323_24_exception_record( callable $callback ): array {
\ttry {
\t\t$value = $callback();
\t\treturn array( 'threw' => false, 'value' => wphx_323_24_json_value( $value ) );
\t} catch ( Throwable $e ) {
\t\treturn array(
\t\t\t'threw' => true,
\t\t\t'class' => get_class( $e ),
\t\t\t'message' => $e->getMessage(),
\t\t\t'code' => $e->getCode(),
\t\t);
\t}
}

function wphx_323_24_wp_error_record( $value ) {
\tif ( $value instanceof WP_Error ) {
\t\treturn array(
\t\t\t'is_wp_error' => true,
\t\t\t'code' => $value->get_error_code(),
\t\t\t'message' => $value->get_error_message(),
\t\t\t'data' => $value->get_error_data(),
\t\t);
\t}
\treturn array( 'is_wp_error' => false, 'value' => wphx_323_24_json_value( $value ) );
}

function wphx_323_24_require_ai_client_api() {
\trequire_once ABSPATH . WPINC . '/php-ai-client/autoload.php';
\trequire_once ABSPATH . WPINC . '/ai-client/class-wp-ai-client-prompt-builder.php';
\trequire_once ABSPATH . WPINC . '/ai-client.php';
}

function wphx_323_24_support_filter_case(): array {
\trequire_once ABSPATH . WPINC . '/ai-client.php';
\t$default = wp_supports_ai();
\tadd_filter( 'wp_supports_ai', fn( $enabled ) => 0, 10, 1 );
\t$filtered_false = wp_supports_ai();
\t$GLOBALS['wphx_323_24_filters']['wp_supports_ai'] = array();
\tadd_filter( 'wp_supports_ai', fn( $enabled ) => 'enabled-by-filter', 10, 1 );
\t$filtered_true = wp_supports_ai();
\treturn array(
\t\t'default' => $default,
\t\t'filtered_false' => $filtered_false,
\t\t'filtered_true' => $filtered_true,
\t\t'filter_log' => $GLOBALS['wphx_323_24_filter_log'],
\t);
}

function wphx_323_24_support_disabled_constant_case(): array {
\trequire_once ABSPATH . WPINC . '/ai-client.php';
\tadd_filter( 'wp_supports_ai', fn( $enabled ) => true, 10, 1 );
\treturn array(
\t\t'wp_ai_support_defined' => defined( 'WP_AI_SUPPORT' ),
\t\t'wp_ai_support_value' => defined( 'WP_AI_SUPPORT' ) ? WP_AI_SUPPORT : null,
\t\t'result' => wp_supports_ai(),
\t\t'filter_log_count' => count( $GLOBALS['wphx_323_24_filter_log'] ),
\t);
}

function wphx_323_24_prompt_prevent_filter_case(): array {
\twphx_323_24_require_ai_client_api();
\t$timeout_values = array();
\t$prevent_payloads = array();
\tadd_filter(
\t\t'wp_ai_client_default_request_timeout',
\t\tfunction ( $timeout ) use ( &$timeout_values ) {
\t\t\t$timeout_values[] = $timeout;
\t\t\treturn 7.25;
\t\t},
\t\t10,
\t\t1
\t);
\tadd_filter(
\t\t'wp_ai_client_prevent_prompt',
\t\tfunction ( $prevent, $builder ) use ( &$prevent_payloads ) {
\t\t\t$prevent_payloads[] = array(
\t\t\t\t'prevent_in' => $prevent,
\t\t\t\t'builder_class' => get_class( $builder ),
\t\t\t\t'builder_id' => spl_object_id( $builder ),
\t\t\t);
\t\t\treturn true;
\t\t},
\t\t10,
\t\t2
\t);
\t$builder = wp_ai_client_prompt( 'Write a fixture sentence.' );
\t$builder_id = spl_object_id( $builder );
\t$supported = $builder->is_supported_for_text_generation();
\t$generated = $builder->generate_text();
\t$chain = $builder->using_temperature( 0.3 );
\treturn array(
\t\t'builder_class' => get_class( $builder ),
\t\t'builder_id' => $builder_id,
\t\t'supported' => $supported,
\t\t'generated' => wphx_323_24_wp_error_record( $generated ),
\t\t'chain_returns_same_instance' => $chain === $builder,
\t\t'timeout_filter_values' => $timeout_values,
\t\t'prevent_payloads' => $prevent_payloads,
\t\t'filter_log' => $GLOBALS['wphx_323_24_filter_log'],
\t\t'doing_it_wrong' => $GLOBALS['wphx_323_24_doing_it_wrong'],
\t);
}

function wphx_323_24_prompt_disabled_constant_case(): array {
\twphx_323_24_require_ai_client_api();
\t$builder = wp_ai_client_prompt();
\t$supported = $builder->is_supported_for_text_generation();
\t$generated = $builder->generate_text();
\treturn array(
\t\t'builder_class' => get_class( $builder ),
\t\t'supported' => $supported,
\t\t'generated' => wphx_323_24_wp_error_record( $generated ),
\t\t'filter_log' => $GLOBALS['wphx_323_24_filter_log'],
\t);
}

function wphx_323_24_event_dispatcher_case(): array {
\trequire_once ABSPATH . WPINC . '/php-ai-client/autoload.php';
\trequire_once ABSPATH . WPINC . '/ai-client/adapters/class-wp-ai-client-event-dispatcher.php';
\teval( 'namespace WPHXAIWrapperFixture; class BeforeGenerateResultEvent { public array $log = array(); } class PlainLifecycle { public array $log = array(); }' );
\t$dispatcher = new WP_AI_Client_Event_Dispatcher();
\t$before = new \\WPHXAIWrapperFixture\\BeforeGenerateResultEvent();
\t$plain = new \\WPHXAIWrapperFixture\\PlainLifecycle();
\tadd_action(
\t\t'wp_ai_client_before_generate_result',
\t\tfunction ( $event ) {
\t\t\t$event->log[] = 'before-action';
\t\t},
\t\t10,
\t\t1
\t);
\tadd_action(
\t\t'wp_ai_client_plain_lifecycle',
\t\tfunction ( $event ) {
\t\t\t$event->log[] = 'plain-action';
\t\t},
\t\t10,
\t\t1
\t);
\t$before_returned = $dispatcher->dispatch( $before );
\t$plain_returned = $dispatcher->dispatch( $plain );
\treturn array(
\t\t'before_same_object' => $before_returned === $before,
\t\t'before_log' => $before->log,
\t\t'plain_same_object' => $plain_returned === $plain,
\t\t'plain_log' => $plain->log,
\t\t'action_log' => $GLOBALS['wphx_323_24_action_log'],
\t);
}

function wphx_323_24_cache_adapter_case(): array {
\trequire_once ABSPATH . WPINC . '/php-ai-client/autoload.php';
\trequire_once ABSPATH . WPINC . '/ai-client/adapters/class-wp-ai-client-cache.php';
\t$cache = new WP_AI_Client_Cache();
\t$missing = $cache->get( 'missing', 'fallback' );
\t$set_false = $cache->set( 'false-value', false, null );
\t$get_false = $cache->get( 'false-value', 'fallback' );
\t$has_false = $cache->has( 'false-value' );
\t$set_ttl = $cache->set( 'ttl-value', 'value', 12 );
\t$set_interval = $cache->set( 'interval-value', 'value', new DateInterval( 'PT2S' ) );
\t$set_multiple = $cache->setMultiple( array( 'one' => 1, 'two' => 2, 'fail-three' => 3 ), 5 );
\t$get_multiple = $cache->getMultiple( array( 'one', 'two', 'missing', 'false-value' ), 'fallback' );
\t$delete_multiple = $cache->deleteMultiple( array( 'one', 'missing' ) );
\t$clear_supported = $cache->clear();
\t$GLOBALS['wphx_323_24_cache_supports_flush_group'] = false;
\t$clear_unsupported = $cache->clear();
\treturn array(
\t\t'missing' => $missing,
\t\t'set_false' => $set_false,
\t\t'get_false' => $get_false,
\t\t'has_false' => $has_false,
\t\t'set_ttl' => $set_ttl,
\t\t'set_interval' => $set_interval,
\t\t'set_multiple' => $set_multiple,
\t\t'get_multiple' => $get_multiple,
\t\t'delete_multiple' => $delete_multiple,
\t\t'clear_supported' => $clear_supported,
\t\t'clear_unsupported' => $clear_unsupported,
\t\t'cache_log' => $GLOBALS['wphx_323_24_cache_log'],
\t);
}

function wphx_323_24_http_client_expanded_case(): array {
\trequire_once ABSPATH . WPINC . '/php-ai-client/autoload.php';
\trequire_once ABSPATH . WPINC . '/ai-client/adapters/class-wp-ai-client-http-client.php';
\t$factory = new \\WordPress\\AiClientDependencies\\Nyholm\\Psr7\\Factory\\Psr17Factory();
\t$client = new WP_AI_Client_HTTP_Client( $factory, $factory );
\t$options = new \\WordPress\\AiClient\\Providers\\Http\\DTO\\RequestOptions();
\t$options->setTimeout( 9.5 );
\t$options->setMaxRedirects( 4 );
\t$GLOBALS['wphx_323_24_remote_queue'][] = array(
\t\t'headers' => new WP_HTTP_Requests_Response( array( 'x-object' => array( 'alpha', 'beta' ), 'content-type' => 'application/json' ) ),
\t\t'body' => '{"ok":true}',
\t\t'response' => array( 'code' => 207, 'message' => 'Multi-Status' ),
\t);
\t$request = $factory->createRequest( 'PATCH', 'https://wp.example/ai?x=1' )
\t\t->withHeader( 'X-Multi', array( 'one', 'two' ) )
\t\t->withHeader( 'X-Numeric', array( '10', '20' ) )
\t\t->withBody( $factory->createStream( '{"prompt":"hello"}' ) );
\t$response = $client->sendRequestWithOptions( $request, $options );
\t$success_call = $GLOBALS['wphx_323_24_remote_requests'][0];

\t$GLOBALS['wphx_323_24_remote_queue'][] = array(
\t\t'headers' => new ArrayObject( array( 'x-empty' => 'yes' ) ),
\t\t'body' => '',
\t\t'response' => array( 'code' => 204, 'message' => 'No Content' ),
\t);
\t$empty_response = $client->sendRequest( $factory->createRequest( 'GET', 'https://wp.example/empty' ) );
\t$empty_call = $GLOBALS['wphx_323_24_remote_requests'][1];

\t$GLOBALS['wphx_323_24_remote_queue'][] = new WP_Error( '17', 'Numeric transport code' );
\t$options_error = wphx_323_24_exception_record(
\t\tfn() => $client->sendRequestWithOptions( $factory->createRequest( 'POST', 'https://wp.example/fail-options' ), $options )
\t);
\t$GLOBALS['wphx_323_24_remote_queue'][] = new WP_Error( 'http_request_failed', 'Connection refused' );
\t$plain_error = wphx_323_24_exception_record(
\t\tfn() => $client->sendRequest( $factory->createRequest( 'GET', 'https://wp.example/fail' ) )
\t);
\treturn array(
\t\t'success_call' => $success_call,
\t\t'success_response' => array(
\t\t\t'status' => $response->getStatusCode(),
\t\t\t'reason' => $response->getReasonPhrase(),
\t\t\t'headers' => $response->getHeaders(),
\t\t\t'body' => (string) $response->getBody(),
\t\t),
\t\t'empty_call' => $empty_call,
\t\t'empty_response' => array(
\t\t\t'status' => $empty_response->getStatusCode(),
\t\t\t'reason' => $empty_response->getReasonPhrase(),
\t\t\t'headers' => $empty_response->getHeaders(),
\t\t\t'body' => (string) $empty_response->getBody(),
\t\t),
\t\t'options_error' => $options_error,
\t\t'plain_error' => $plain_error,
\t\t'remote_request_count' => count( $GLOBALS['wphx_323_24_remote_requests'] ),
\t);
}

$map = array(
\t'support_filter' => 'wphx_323_24_support_filter_case',
\t'support_disabled_constant' => 'wphx_323_24_support_disabled_constant_case',
\t'prompt_prevent_filter' => 'wphx_323_24_prompt_prevent_filter_case',
\t'prompt_disabled_constant' => 'wphx_323_24_prompt_disabled_constant_case',
\t'event_dispatcher' => 'wphx_323_24_event_dispatcher_case',
\t'cache_adapter' => 'wphx_323_24_cache_adapter_case',
\t'http_client_expanded' => 'wphx_323_24_http_client_expanded_case',
);

if ( ! isset( $map[ $mode ] ) ) {
\tfwrite( STDERR, 'Unknown probe mode: ' . $mode . PHP_EOL );
\texit( 2 );
}

$result = call_user_func( $map[ $mode ] );
echo json_encode(
\tarray(
\t\t'mode' => $mode,
\t\t'case' => $result,
\t\t'php_errors' => $GLOBALS['wphx_323_24_errors'],
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
);
`
  );
}

function runProbe(root, mode) {
  return JSON.parse(command("php", [PROBE, root, mode]));
}

function runAllProbes(root) {
  return Object.fromEntries(PROBE_MODES.map((mode) => [mode, runProbe(root, mode)]));
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

function lintFiles(paths, root) {
  return paths.map((path) => {
    const fullPath = `${root}/${path.replace(/^src\//, "")}`;
    const output = command("php", ["-l", fullPath]);
    return { path, ok: output.includes("No syntax errors detected") };
  });
}

function wrapperRole(path) {
  const distributionPath = sourceToDistribution(path);
  if (distributionPath === "wp-includes/ai-client.php") {
    return {
      role: "public_function_api",
      covered_cases: ["wordpress-ai-wrapper:wp-supports-ai-filter", "wordpress-ai-wrapper:wp-supports-ai-disabled-constant", "wordpress-ai-wrapper:prompt-builder-prevent-filter", "wordpress-ai-wrapper:prompt-builder-disabled-ai"],
      first_generated_adapter_candidate: true
    };
  }
  if (distributionPath.endsWith("class-wp-ai-client-event-dispatcher.php")) {
    return { role: "wordpress_hook_adapter", covered_cases: ["wordpress-ai-wrapper:event-dispatcher"], first_generated_adapter_candidate: true };
  }
  if (distributionPath.endsWith("class-wp-ai-client-cache.php")) {
    return { role: "wordpress_object_cache_adapter", covered_cases: ["wordpress-ai-wrapper:cache-adapter"], first_generated_adapter_candidate: true };
  }
  if (distributionPath.endsWith("class-wp-ai-client-http-client.php")) {
    return { role: "wordpress_http_adapter", covered_cases: ["wordpress-ai-wrapper:http-client-expanded"], first_generated_adapter_candidate: false };
  }
  if (distributionPath.endsWith("class-wp-ai-client-discovery-strategy.php")) {
    return { role: "wordpress_http_discovery_adapter", covered_cases: ["wordpress-ai-wrapper:http-client-expanded"], first_generated_adapter_candidate: false };
  }
  if (distributionPath.endsWith("class-wp-ai-client-prompt-builder.php")) {
    return {
      role: "wordpress_prompt_builder_facade",
      covered_cases: ["wordpress-ai-wrapper:prompt-builder-prevent-filter", "wordpress-ai-wrapper:prompt-builder-disabled-ai"],
      first_generated_adapter_candidate: false
    };
  }
  return {
    role: "wordpress_ability_function_adapter",
    covered_cases: [],
    first_generated_adapter_candidate: false,
    note: "Classified as WordPress wrapper/API surface; executable ability function-call fixtures remain future work outside WPHX-323.24 acceptance."
  };
}

function generatedAdapterRequirements() {
  return [
    "WPHX PHP compiler/linker output at the original WordPress path.",
    "Non-empty generated overlay manifest recording replaced upstream path, upstream hash, generated file hash, compiler provenance, and unsupported=[].",
    "PHP lint across every generated wrapper file.",
    "ABI/reflection snapshots for functions, classes, methods, visibility, return types, parameter defaults, class constants, interfaces, and implemented interfaces.",
    "Include/load timing fixture for ABSPATH/WPINC, dependency availability, conditional load assumptions, and repeated include behavior.",
    "Oracle/candidate behavior fixtures for wp_supports_ai, wp_ai_client_prompt, event dispatcher, cache adapter, HTTP client adapter, prompt builder error conversion, and ability function resolver before claiming those surfaces.",
    "Explicit non-claims for preserved php-ai-client internals, shaded dependency substitution, live provider behavior, installed AI behavior, and prompt/file/privacy safety unless separate gates pass.",
    "No hand-edited target PHP or broad inline raw-block body for durable public wrapper ownership."
  ];
}

function validate({
  wrapperFiles,
  phpAiClientFiles,
  oracle,
  candidate,
  sourceRows,
  artifactRows,
  aiTinymceGates,
  phpAiClientSubBoundaries,
  aiHttpFixture,
  phpLint
}) {
  const failures = [];
  if (wrapperFiles.length !== 7) failures.push(`Expected 7 WordPress AI wrapper files, found ${wrapperFiles.length}`);
  if (phpAiClientFiles.length !== 146) failures.push(`Expected 146 preserved php-ai-client PHP support files, found ${phpAiClientFiles.length}`);
  if (sourceRows.length !== wrapperFiles.length) failures.push(`Expected ${wrapperFiles.length} wrapper source inventory records, found ${sourceRows.length}`);
  if (artifactRows.length !== wrapperFiles.length) failures.push(`Expected ${wrapperFiles.length} wrapper artifact records, found ${artifactRows.length}`);
  if (JSON.stringify(oracle) !== JSON.stringify(candidate)) failures.push("Oracle and candidate wrapper observations differ");
  for (const mode of PROBE_MODES) {
    if (!oracle[mode]) failures.push(`Missing oracle probe mode ${mode}`);
    if (!candidate[mode]) failures.push(`Missing candidate probe mode ${mode}`);
    if ((oracle[mode]?.php_errors ?? []).length) failures.push(`Oracle probe ${mode} emitted PHP errors`);
    if ((candidate[mode]?.php_errors ?? []).length) failures.push(`Candidate probe ${mode} emitted PHP errors`);
  }
  if (!phpLint.every((result) => result.ok)) failures.push("At least one mirrored PHP file failed php -l");
  if (aiTinymceGates?.source_surfaces?.wordpress_ai_wrappers?.classification !== "wordpress_public_api_and_adapter_surface_not_vendor_internals") {
    failures.push("WPHX-323.07 does not classify WordPress AI wrappers as public API/adapter surfaces");
  }
  if (phpAiClientSubBoundaries?.issue?.external_ref !== "WPHX-323.23") {
    failures.push("WPHX-323.23 php-ai-client sub-boundary manifest is missing");
  }
  if (aiHttpFixture?.issue?.external_ref !== "WPHX-312.05" && aiHttpFixture?.issue !== "WPHX-312.05") {
    failures.push("WPHX-312.05 AI HTTP oracle fixture manifest is missing");
  }
  if (failures.length) throw new Error(`WPHX-323.24 WordPress AI wrapper gate failed:\n- ${failures.join("\n- ")}`);
}

function main() {
  const upstreamLock = readJson(UPSTREAM_LOCK);
  const wordpressCheckout = currentWordPressCheckout(upstreamLock);
  const aiTinymceGates = readJson(AI_TINYMCE_GATES);
  const phpAiClientSubBoundaries = readJson(PHP_AI_CLIENT_SUB_BOUNDARIES);
  const aiHttpFixture = readJson(AI_HTTP_FIXTURE);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const phpAiClientFiles = listFiles(PHP_AI_CLIENT_ROOT).filter((path) => path.endsWith(".php"));
  const wrapperFiles = WORDPRESS_AI_WRAPPER_FILES.filter((path) => path.endsWith(".php"));

  rmSync(OUT_ROOT, { recursive: true, force: true });
  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe();

  const oracle = runAllProbes(ORACLE_ROOT);
  const candidate = runAllProbes(CANDIDATE_ROOT);
  const phpLint = lintFiles([...wrapperFiles, ...phpAiClientFiles], ORACLE_ROOT);
  const sourceRows = sourceInventoryRecords(wrapperFiles);
  const artifactRows = artifactRecords(wrapperFiles.map(sourceToDistribution));

  validate({ wrapperFiles, phpAiClientFiles, oracle, candidate, sourceRows, artifactRows, aiTinymceGates, phpAiClientSubBoundaries, aiHttpFixture, phpLint });

  const sourceFiles = wrapperFiles.map((path) => ({
    ...sourceRecord(path),
    distribution_path: sourceToDistribution(path),
    classification: "wordpress_public_api_and_adapter_surface_not_bundled_library_internal",
    ...wrapperRole(path),
    api_inventory: apiInventory(path)
  }));
  const declaredSymbols = uniqueSorted(sourceFiles.flatMap((record) => record.api_inventory.declared_symbol_fqns));
  const validationResult = {
    status: "passed",
    wrapper_file_count: wrapperFiles.length,
    preserved_php_ai_client_support_file_count: phpAiClientFiles.length,
    source_inventory_record_count: sourceRows.length,
    artifact_provenance_record_count: artifactRows.length,
    probe_case_count: PROBE_MODES.length,
    oracle_candidate_observations_match: JSON.stringify(oracle) === JSON.stringify(candidate),
    php_lint_file_count: phpLint.length,
    php_lint_ok: phpLint.every((result) => result.ok),
    generated_overlay_manifest_present: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_wordpress_ai_wrapper_runtime_claimed: false,
    haxe_owned_php_ai_client_runtime_claimed: false,
    live_provider_behavior_claimed: false,
    dependency_substitution_claimed: false
  };

  const manifest = {
    schema: "wphx.wp-core.wordpress-ai-wrapper-api-surface.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "wordpress_ai_wrapper_api_adapter_fixture_gate",
    behavior_parity_claimed: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_wordpress_ai_wrapper_runtime_claimed: false,
    haxe_owned_php_ai_client_runtime_claimed: false,
    live_provider_behavior_claimed: false,
    dependency_substitution_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false,
    inputs: {
      runner: fileRecord(RUNNER),
      upstream_lock: fileRecord(UPSTREAM_LOCK),
      ai_tinymce_gate_manifest: fileRecord(AI_TINYMCE_GATES),
      php_ai_client_sub_boundaries_manifest: fileRecord(PHP_AI_CLIENT_SUB_BOUNDARIES),
      ai_http_fixture_manifest: fileRecord(AI_HTTP_FIXTURE),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      source_inventory_manifest: fileRecord(SOURCE_INVENTORY),
      artifact_provenance_manifest: fileRecord(ARTIFACT_PROVENANCE)
    },
    upstream_authority: wordpressCheckout,
    source_surface: {
      classification: "wordpress_public_api_and_adapter_surface_not_bundled_library_internal",
      wrapper_files: sourceFiles,
      declared_symbol_count: declaredSymbols.length,
      declared_symbols: declaredSymbols,
      preserved_php_ai_client_support: {
        source_root: PHP_AI_CLIENT_ROOT,
        php_file_count: phpAiClientFiles.length,
        current_state: "preserved_bundled_library_exception",
        sub_boundary_manifest: PHP_AI_CLIENT_SUB_BOUNDARIES,
        vendor_closure: vendorClosure.vendor_boundaries.find((boundary) => boundary.id === "php_ai_client")?.closure_state
      }
    },
    fixture_cases: CASES,
    observations: {
      oracle_root: ORACLE_ROOT,
      candidate_root: CANDIDATE_ROOT,
      modes: PROBE_MODES,
      oracle,
      candidate,
      observations_match: JSON.stringify(oracle) === JSON.stringify(candidate)
    },
    generated_adapter_requirements: generatedAdapterRequirements(),
    first_generated_adapter_candidate_order: [
      "wp-includes/ai-client.php",
      "wp-includes/ai-client/adapters/class-wp-ai-client-event-dispatcher.php",
      "wp-includes/ai-client/adapters/class-wp-ai-client-cache.php",
      "wp-includes/ai-client/adapters/class-wp-ai-client-http-client.php",
      "wp-includes/ai-client/class-wp-ai-client-prompt-builder.php",
      "wp-includes/ai-client/class-wp-ai-client-ability-function-resolver.php",
      "wp-includes/ai-client/adapters/class-wp-ai-client-discovery-strategy.php"
    ],
    provenance: {
      source_inventory_records: sourceRows,
      artifact_provenance_records: artifactRows
    },
    validation_result: validationResult,
    claims: [
      "WPHX-323.24 classifies wp-includes/ai-client.php and wp-includes/ai-client/* as WordPress public API/adapter surfaces rather than php-ai-client bundled-library internals.",
      "The fixture records matching copied-oracle observations for wp_supports_ai, wp_ai_client_prompt, event dispatcher, cache adapter, and expanded WordPress HTTP client adapter behavior.",
      "The gate records generated WPHX PHP original-path adapter requirements before WPHX-323.25 can claim first generated wrapper emission.",
      "php-ai-client internals remain preserved and live provider behavior remains a non-claim."
    ],
    non_claims: NON_CLAIMS
  };
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestContent);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-24-wordpress-ai-wrapper-api-surface",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    ownership_state: "copied_oracle_wordpress_ai_wrapper_fixture_with_generated_adapter_requirements",
    source_authority: "../wordpress-develop WordPress 7.0 wp-includes/ai-client.php and wp-includes/ai-client/* wrapper source paths",
    emission_strategy: "fixture_gate_now_future_wphx_php_original_path_generated_adapters",
    whole_file_owned: false,
    behavior_parity_claimed: false,
    durable_haxe_runtime_claimed: false,
    public_php_replacement_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false,
    generated_overlay_manifest_present: false,
    fixture_case_count: PROBE_MODES.length,
    preserved_php_ai_client_internals: true,
    removal_gate:
      "Do not claim generated WordPress AI wrapper replacement until WPHX-323.25 records non-empty generated overlay evidence, PHP lint, ABI/reflection snapshots, include/load timing, and this fixture passing against generated original-path adapters.",
    receipt_refs: ["receipt:wphx-323-24-wordpress-ai-wrapper-api-surface"],
    non_claims: NON_CLAIMS
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-24-wordpress-ai-wrapper-api-surface",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: manifest.evidence_class,
    artifact_scope: "wordpress-7.0-wordpress-ai-wrapper-api-adapter-fixture-gate",
    commands: [
      "npm run wp:core:wphx-323-wordpress-ai-wrapper-api-surface",
      "npm run wp:core:wphx-323-wordpress-ai-wrapper-api-surface:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      ai_tinymce_gate_manifest: AI_TINYMCE_GATES,
      php_ai_client_sub_boundaries_manifest: PHP_AI_CLIENT_SUB_BOUNDARIES,
      ai_http_fixture_manifest: AI_HTTP_FIXTURE
    },
    manifest_sha256: sha256(manifestContent),
    validation_result: validationResult,
    generated_adapter_requirements: generatedAdapterRequirements(),
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };
  writeOrCheck(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);

  return manifest;
}

try {
  const manifest = main();
  console.log(
    JSON.stringify(
      {
        ok: true,
        check: checkOnly,
        manifest: OUT,
        receipt: RECEIPT,
        wrapper_file_count: manifest.validation_result.wrapper_file_count,
        probe_case_count: manifest.validation_result.probe_case_count,
        observations_match: manifest.validation_result.oracle_candidate_observations_match,
        generated_public_php_replacement_claimed: manifest.generated_public_php_replacement_claimed,
        haxe_owned_wordpress_ai_wrapper_runtime_claimed: manifest.haxe_owned_wordpress_ai_wrapper_runtime_claimed,
        live_provider_behavior_claimed: manifest.live_provider_behavior_claimed
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
