#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.18.12",
  external_ref: "WPHX-312.12",
  title: "WPHX-312.12 — Add cron dispatch lock oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-cron-dispatch-lock-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-312-12";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-312-12-cron-dispatch-lock-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-12-cron-dispatch-lock-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-12-cron-dispatch-lock-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const HTTP_CRON_MAIL_FIXTURE = "manifests/wp-core/wphx-312-03-http-cron-mail-oracle-fixture.v1.json";
const INSTALLED_GATE = "manifests/wp-core/wphx-312-09-http-mail-feed-embed-installed-gate.v1.json";

const SOURCE_FILES = ["src/wp-includes/cron.php", "src/wp-cron.php"];
const COVERED_SYMBOLS = [
  "wp_get_ready_cron_jobs",
  "spawn_cron",
  "wp_cron",
  "_wp_cron",
  "_get_cron_array",
  "_set_cron_array",
  "_get_cron_lock",
  "wp_reschedule_event",
  "wp_unschedule_event",
  "do_action_ref_array",
  "wp_remote_post",
  "set_transient",
  "get_transient",
  "delete_transient"
];
const FIXTURE_CASES = [
  { id: "cron:ready-jobs-filtered", focus: "wp_get_ready_cron_jobs filters due timestamps from the stored cron option without future events" },
  { id: "cron:spawn-loopback-request", focus: "spawn_cron sets the doing_cron lock and builds the non-blocking loopback request through cron_request filters" },
  { id: "cron:spawn-lock-held", focus: "spawn_cron refuses to spawn when the doing_cron transient lock is still active" },
  { id: "cron:wp-cron-registration", focus: "wp_cron registers _wp_cron on shutdown and dispatches immediately when already doing shutdown" },
  { id: "cron:daemon-dispatch", focus: "wp-cron.php validates the lock, reschedules recurring events, unschedules due events, fires callbacks, and clears the lock" }
];

function command(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
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

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
$root = rtrim( $argv[1], '/\\\\' );
$case = $argv[2];

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['REQUEST_URI'] = '/fixture';
$_GET = array();
$_POST = array();

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'MINUTE_IN_SECONDS', 60 );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'DAY_IN_SECONDS', 86400 );
define( 'WEEK_IN_SECONDS', 604800 );
define( 'WP_CRON_LOCK_TIMEOUT', 60 );

$GLOBALS['wp_filter'] = array();
$GLOBALS['wphx_312_12_filters'] = array();
$GLOBALS['wphx_312_12_actions'] = array();
$GLOBALS['wphx_312_12_remote_posts'] = array();
$GLOBALS['wphx_312_12_transients'] = array();
$GLOBALS['wphx_312_12_transient_writes'] = array();
$GLOBALS['wphx_312_12_options'] = array( 'cron' => array( 'version' => 2 ) );
$GLOBALS['wphx_312_12_errors'] = array();
$GLOBALS['wphx_312_12_current_action'] = '';
$GLOBALS['wphx_312_12_shutdown_payload'] = null;

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_312_12_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

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
\tpublic function merge_from( $error ) {}
}

function __( $text ) { return $text; }
function is_wp_error( $thing ) { return $thing instanceof WP_Error; }
function wp_json_encode( $value ) { return json_encode( $value ); }
function wp_unslash( $value ) { return $value; }
function site_url( $path = '' ) { return 'https://example.test/' . ltrim( $path, '/' ); }
function add_query_arg( $key, $value, $url ) { return $url . ( str_contains( $url, '?' ) ? '&' : '?' ) . rawurlencode( $key ) . '=' . rawurlencode( $value ); }
function wp_raise_memory_limit( $context = 'admin' ) { return '128M'; }
function wp_redirect( $location, $status = 302 ) {
\t$GLOBALS['wphx_312_12_actions'][] = array( 'hook' => 'wp_redirect', 'location' => preg_replace( '/doing_wp_cron=[^&]+/', 'doing_wp_cron=normalized', $location ), 'status' => $status );
\treturn true;
}
function wp_ob_end_flush_all() {}
function wp_using_ext_object_cache() { return true; }
function wp_cache_get( $key, $group = '', $force = false, &$found = null ) {
\t$found = isset( $GLOBALS['wphx_312_12_transients'][ $key ] );
\treturn $GLOBALS['wphx_312_12_transients'][ $key ] ?? false;
}
function get_option( $name, $default = false ) {
\treturn array_key_exists( $name, $GLOBALS['wphx_312_12_options'] ) ? $GLOBALS['wphx_312_12_options'][ $name ] : $default;
}
function update_option( $name, $value, $autoload = null ) {
\t$GLOBALS['wphx_312_12_options'][ $name ] = $value;
\treturn true;
}
function get_transient( $name ) { return $GLOBALS['wphx_312_12_transients'][ $name ] ?? false; }
function set_transient( $name, $value, $expiration = 0 ) {
\t$GLOBALS['wphx_312_12_transients'][ $name ] = $value;
\t$GLOBALS['wphx_312_12_transient_writes'][] = array( 'op' => 'set', 'name' => $name, 'value' => wphx_312_12_normalize_lock( $value ), 'expiration' => $expiration );
\treturn true;
}
function delete_transient( $name ) {
\tunset( $GLOBALS['wphx_312_12_transients'][ $name ] );
\t$GLOBALS['wphx_312_12_transient_writes'][] = array( 'op' => 'delete', 'name' => $name );
\treturn true;
}
function wp_remote_post( $url, $args = array() ) {
\t$GLOBALS['wphx_312_12_remote_posts'][] = array(
\t\t'url' => preg_replace( '/doing_wp_cron=[^&]+/', 'doing_wp_cron=normalized', $url ),
\t\t'args' => $args,
\t);
\treturn array( 'response' => array( 'code' => 204, 'message' => 'No Content' ), 'body' => '' );
}
function add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wp_filter'][ $hook_name ][ $priority ][] = array( 'callback' => $callback, 'accepted_args' => $accepted_args );
\tksort( $GLOBALS['wp_filter'][ $hook_name ] );
\treturn true;
}
function add_action( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wphx_312_12_actions'][] = array( 'hook' => 'add_action', 'target' => $hook_name, 'callback' => is_string( $callback ) ? $callback : 'callable', 'priority' => $priority );
\treturn add_filter( $hook_name, $callback, $priority, $accepted_args );
}
function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_312_12_filters'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) + 1 );
\tif ( empty( $GLOBALS['wp_filter'][ $hook_name ] ) ) {
\t\treturn $value;
\t}
\tforeach ( $GLOBALS['wp_filter'][ $hook_name ] as $callbacks ) {
\t\tforeach ( $callbacks as $record ) {
\t\t\t$callback_args = array_merge( array( $value ), $args );
\t\t\t$value = call_user_func_array( $record['callback'], array_slice( $callback_args, 0, $record['accepted_args'] ) );
\t\t}
\t}
\treturn $value;
}
function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_312_12_actions'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) );
\tapply_filters( $hook_name, null, ...$args );
}
function do_action_ref_array( $hook_name, $args ) {
\t$GLOBALS['wphx_312_12_actions'][] = array( 'hook' => $hook_name, 'args' => array_values( $args ) );
\tapply_filters( $hook_name, null, ...$args );
}
function did_action( $hook_name ) { return 'wp_loaded' === $hook_name ? 1 : 0; }
function doing_action( $hook_name ) { return $GLOBALS['wphx_312_12_current_action'] === $hook_name; }

function wphx_312_12_cron_event( $hook, $args = array(), $schedule = false, $interval = null ) {
\t$event = array( 'schedule' => $schedule, 'args' => $args );
\tif ( null !== $interval ) {
\t\t$event['interval'] = $interval;
\t}
\treturn array( md5( serialize( $args ) ) => $event );
}
function wphx_312_12_seed_cron() {
\t$GLOBALS['wphx_312_12_options']['cron'] = array(
\t\t1000 => array(
\t\t\t'wphx_due_single' => wphx_312_12_cron_event( 'wphx_due_single', array( 'single' ) ),
\t\t\t'wphx_due_recurring' => wphx_312_12_cron_event( 'wphx_due_recurring', array( 'recurring' ), 'hourly', HOUR_IN_SECONDS ),
\t\t),
\t\t4102444800 => array(
\t\t\t'wphx_future' => wphx_312_12_cron_event( 'wphx_future', array( 'future' ) ),
\t\t),
\t\t'version' => 2,
\t);
}
function wphx_312_12_normalize_lock( $value ) {
\tif ( is_string( $value ) && preg_match( '/^\\d+\\.\\d+$/', $value ) ) {
\t\treturn 'normalized-lock';
\t}
\treturn $value;
}
function wphx_312_12_cron_summary() {
\t$summary = array();
\tforeach ( _get_cron_array() as $timestamp => $hooks ) {
\t\t$bucket = $timestamp > 2000000000 ? 'future' : ( $timestamp > 100000 ? 'dynamic' : (string) $timestamp );
\t\tforeach ( $hooks as $hook => $events ) {
\t\t\t$summary[] = array( 'timestamp' => $bucket, 'hook' => $hook, 'event_count' => count( $events ) );
\t\t}
\t}
\treturn $summary;
}
function wphx_312_12_result( $result ) {
\treturn array(
\t\t'case' => $GLOBALS['wphx_312_12_case'],
\t\t'result' => $result,
\t\t'cron_summary' => function_exists( '_get_cron_array' ) ? wphx_312_12_cron_summary() : array(),
\t\t'transient_writes' => $GLOBALS['wphx_312_12_transient_writes'],
\t\t'locks' => array_map( 'wphx_312_12_normalize_lock', $GLOBALS['wphx_312_12_transients'] ),
\t\t'remote_posts' => $GLOBALS['wphx_312_12_remote_posts'],
\t\t'actions' => $GLOBALS['wphx_312_12_actions'],
\t\t'filters' => $GLOBALS['wphx_312_12_filters'],
\t\t'php_errors' => $GLOBALS['wphx_312_12_errors'],
\t);
}

$GLOBALS['wphx_312_12_case'] = $case;
require ABSPATH . WPINC . '/cron.php';

switch ( $case ) {
\tcase 'ready-jobs-filtered':
\t\twphx_312_12_seed_cron();
\t\t$ready = wp_get_ready_cron_jobs();
\t\t$result = array(
\t\t\t'ready_timestamps' => array_map( 'strval', array_keys( $ready ) ),
\t\t\t'ready_hooks' => array_keys( reset( $ready ) ?: array() ),
\t\t\t'future_present' => isset( $ready[4102444800] ),
\t\t);
\t\tbreak;
\tcase 'spawn-loopback-request':
\t\twphx_312_12_seed_cron();
\t\tadd_filter(
\t\t\t'cron_request',
\t\t\tfunction ( $request, $doing_wp_cron ) {
\t\t\t\t$request['args']['headers'] = array( 'X-WPHX-Fixture' => 'cron' );
\t\t\t\treturn $request;
\t\t\t},
\t\t\t10,
\t\t\t2
\t\t);
\t\t$result = array( 'spawned' => spawn_cron( 2000.25 ) );
\t\tbreak;
\tcase 'spawn-lock-held':
\t\twphx_312_12_seed_cron();
\t\t$GLOBALS['wphx_312_12_transients']['doing_cron'] = 2000.0;
\t\t$result = array( 'spawned' => spawn_cron( 2000.25 ) );
\t\tbreak;
\tcase 'wp-cron-registration':
\t\twphx_312_12_seed_cron();
\t\twp_cron();
\t\t$registered = $GLOBALS['wphx_312_12_actions'];
\t\t$GLOBALS['wphx_312_12_current_action'] = 'shutdown';
\t\twp_cron();
\t\t$result = array( 'registered_actions' => $registered, 'after_shutdown_action_count' => count( $GLOBALS['wphx_312_12_actions'] ) );
\t\tbreak;
\tcase 'daemon-dispatch':
\t\twphx_312_12_seed_cron();
\t\t$_GET['doing_wp_cron'] = 'fixture-lock';
\t\t$GLOBALS['wphx_312_12_transients']['doing_cron'] = 'fixture-lock';
\t\tregister_shutdown_function(
\t\t\tfunction () {
\t\t\t\techo json_encode( wphx_312_12_result( array( 'daemon_completed' => true ) ), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
\t\t\t}
\t\t);
\t\trequire ABSPATH . 'wp-cron.php';
\t\treturn;
\tdefault:
\t\t$result = array( 'unknown_case' => $case );
}

echo json_encode( wphx_312_12_result( $result ), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
`
  );
}

function runProbe(root, mode) {
  return JSON.parse(command("php", [PROBE, root, mode]));
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-312-cron-dispatch-lock-oracle-fixture`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/cron-dispatch-lock-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "cron ready-job, spawn lock, loopback request, and daemon dispatch behavior",
      area: SOURCE_FILES.join(" "),
      public_contract:
        "This fixture executes copied WordPress 7.0 cron source and wp-cron.php daemon source against deterministic in-process option, transient, HTTP loopback, and hook stubs. It records readiness, spawn locks, non-blocking loopback request arguments, shutdown registration, daemon reschedule/unschedule behavior, callback firing, and lock cleanup without performing live loopback HTTP."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-cron-dispatch-boundary",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass real loopback HTTP, persistent cron option/transient, timing-race, selected upstream PHPUnit, installed distribution, and ecosystem fixtures before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-cron-dispatch-lock-oracle-fixture",
        "npm run wp:core:wphx-312-cron-dispatch-lock-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-12-cron-dispatch-lock-oracle-fixture"],
      manifest_digest: manifestSha
    }
  };
}

rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
writeProbe();

const caseIds = ["ready-jobs-filtered", "spawn-loopback-request", "spawn-lock-held", "wp-cron-registration", "daemon-dispatch"];
const oracle = Object.fromEntries(caseIds.map((id) => [id, runProbe(ORACLE_ROOT, id)]));
const candidate = Object.fromEntries(caseIds.map((id) => [id, runProbe(CANDIDATE_ROOT, id)]));
const observationsMatch = JSON.stringify(oracle) === JSON.stringify(candidate);

if (!observationsMatch) {
  console.error(JSON.stringify({ status: "failed", oracle, candidate }, null, 2));
  process.exit(1);
}

const phpLint = SOURCE_FILES.map((path) => ({
  path,
  oracle_lint: command("php", ["-l", mirrorPath(ORACLE_ROOT, path)]),
  candidate_lint: command("php", ["-l", mirrorPath(CANDIDATE_ROOT, path)])
}));

const manifest = {
  schema: "wphx.wp-core-cron-dispatch-lock-oracle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["oracle_source_mirror", "candidate_package_mirror"],
  artifact_scope: "fixture",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT),
    http_cron_mail_fixture_manifest: inputRecord(HTTP_CRON_MAIL_FIXTURE),
    installed_gate_manifest: inputRecord(INSTALLED_GATE),
    runner: inputRecord(RUNNER),
    upstream_sources: SOURCE_FILES.map(sourceRecord)
  },
  fixture: {
    cases: FIXTURE_CASES,
    covered_symbols: COVERED_SYMBOLS,
    source_files: SOURCE_FILES,
    probe: { path: PROBE, sha256: sha256File(PROBE) },
    side_effect_policy: {
      live_loopback_http: false,
      real_cron_timing_races: false,
      persistent_option_or_transient_storage: false,
      daemon_callbacks_observed_in_process: true
    },
    public_abi_policy: {
      public_php_replacement_claimed: false,
      copied_oracle_public_php: true,
      adapter_contract_foundation: CONTRACT,
      installed_wordpress_behavior_claimed: false
    }
  },
  build: {
    oracle_root: ORACLE_ROOT,
    candidate_root: CANDIDATE_ROOT,
    php_lint: phpLint
  },
  observations: {
    oracle,
    candidate,
    match: observationsMatch,
    oracle_sha256: sha256(JSON.stringify(oracle)),
    candidate_sha256: sha256(JSON.stringify(candidate))
  },
  remaining_gaps: [
    {
      id: "live-loopback-http-not-executed",
      owner: ISSUE.external_ref,
      detail: "spawn_cron records the wp_remote_post loopback request through an in-process stub. Real HTTP client behavior, DNS/TLS, web-server routing, timeout enforcement, and process isolation remain later gates."
    },
    {
      id: "persistent-cron-storage-and-races-not-executed",
      owner: ISSUE.external_ref,
      detail: "Cron options, transients, cache reads, and locks are deterministic in-process state. Persistent database/object-cache behavior and concurrent timing races remain later gates."
    },
    {
      id: "installed-cron-daemon-routing-not-executed",
      owner: ISSUE.external_ref,
      detail: "wp-cron.php is included inside a fixture probe. Installed web entrypoint routing, server headers, alternate cron redirect flushing, and operational scheduling remain later distribution work."
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
    fixture_cases: FIXTURE_CASES.length,
    covered_symbols: COVERED_SYMBOLS.length,
    observations_match: observationsMatch,
    public_php_replacement_claimed: false
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-312-12-cron-dispatch-lock-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "cron dispatch and lock oracle-source-mirror fixture manifest" },
    { path: OWNERSHIP, role: "ownership manifest for copied-oracle cron dispatch boundary" },
    { path: RUNNER, role: "deterministic oracle/candidate fixture generator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-312-cron-dispatch-lock-oracle-fixture",
    "npm run wp:core:wphx-312-cron-dispatch-lock-oracle-fixture:check",
    "npm run receipts:validate",
    "npm run beads:validate"
  ],
  related_receipts: [
    "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
    "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
    "receipt:wphx-312-03-http-cron-mail-oracle-fixture",
    "receipt:wphx-312-09-http-mail-feed-embed-installed-gate"
  ],
  validation_result: manifest.validation_result
};
const receiptText = JSON.stringify(receipt, null, 2) + "\n";

try {
  writeOrCheck(OUT, manifestText);
  writeOrCheck(OWNERSHIP, ownershipText);
  writeOrCheck(RECEIPT, receiptText);
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
      fixture_cases: FIXTURE_CASES.length,
      observations_match: observationsMatch
    },
    null,
    2
  )
);
