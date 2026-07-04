#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-6d22",
  external_ref: "WPHX-316.03",
  title: "WPHX-316.03 - Add admin AJAX/post route oracle fixture"
};
const RECORDED_AT = "2026-07-04T02:30:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-admin-ajax-post-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-316-03";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-316-03-admin-ajax-post-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-316-03-admin-ajax-post-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-316-03-admin-ajax-post-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-316-01-admin-feature-ajax-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-316-02-admin-feature-ajax-adapter-contract-candidate.v1.json";

const SOURCE_FILES = [
  "src/wp-admin/admin-ajax.php",
  "src/wp-admin/admin-post.php",
  "src/wp-admin/includes/ajax-actions.php"
];
const SUPPORT_STUBS = ["wp-load.php", "wp-admin/includes/admin.php"];
const COVERED_SYMBOLS = [
  "wp-admin/admin-ajax.php",
  "wp-admin/admin-post.php",
  "wp_ajax_logged_in",
  "wp_ajax_nopriv_heartbeat",
  "wp_ajax_closed_postboxes",
  "wp_ajax_hidden_columns",
  "wp_send_json",
  "wp_send_json_success",
  "wp_die",
  "has_action",
  "do_action",
  "check_ajax_referer",
  "update_user_meta",
  "sanitize_text_field"
];
const CASES = [
  { id: "ajax:missing-action", focus: "admin-ajax rejects missing action with wp_die 0/400 before handler loading branches can dispatch" },
  { id: "ajax:logged-in-registered", focus: "admin-ajax registers a core GET action and dispatches wp_ajax_logged_in for authenticated users" },
  { id: "ajax:nopriv-heartbeat", focus: "admin-ajax registers and dispatches wp_ajax_nopriv_heartbeat with JSON response observations" },
  { id: "ajax:closed-postboxes", focus: "admin-ajax dispatches a POST handler with nonce check and user-meta side effects" },
  { id: "ajax:hidden-columns-invalid-page", focus: "admin-ajax dispatches hidden-columns and records the sanitize_key page guard failure" },
  { id: "admin-post:logged-in-empty-action", focus: "admin-post runs the authenticated empty-action hook and returns normally" },
  { id: "admin-post:nopriv-missing-handler", focus: "admin-post rejects a logged-out action with no registered nopriv handler" },
  { id: "admin-post:logged-in-registered", focus: "admin-post dispatches a deterministic authenticated action registered by the admin bootstrap stub" }
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

function writeStub(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function mirrorSources(root) {
  for (const path of SOURCE_FILES) {
    const target = mirrorPath(root, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(upstreamPath(path), target);
  }

  writeStub(
    `${root}/wp-load.php`,
    `<?php
class Wphx_Wp_Die extends Exception {
\tpublic $payload;

\tpublic function __construct( $payload ) {
\t\tparent::__construct( 'wp_die' );
\t\t$this->payload = $payload;
\t}
}

class Wphx_Send_Json extends Exception {
\tpublic $payload;

\tpublic function __construct( $payload ) {
\t\tparent::__construct( 'wp_send_json' );
\t\t$this->payload = $payload;
\t}
}

$_SERVER['HTTP_HOST'] = 'example.test';
$_SERVER['REQUEST_URI'] = $_SERVER['REQUEST_URI'] ?? '/wp-admin/admin-ajax.php';
$_SERVER['REQUEST_METHOD'] = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$GLOBALS['wphx_actions'] = $GLOBALS['wphx_actions'] ?? array();
$GLOBALS['wphx_callbacks'] = $GLOBALS['wphx_callbacks'] ?? array();
$GLOBALS['wphx_filters'] = $GLOBALS['wphx_filters'] ?? array();
$GLOBALS['wphx_user_meta'] = $GLOBALS['wphx_user_meta'] ?? array();
$GLOBALS['wphx_nonce_checks'] = $GLOBALS['wphx_nonce_checks'] ?? array();
$GLOBALS['wphx_current_user_id'] = 42;

function send_origin_headers() { $GLOBALS['wphx_headers'][] = 'origin'; }
function send_nosniff_header() { $GLOBALS['wphx_headers'][] = 'nosniff'; }
function nocache_headers() { $GLOBALS['wphx_headers'][] = 'nocache'; }
function get_option( $name, $default = false ) { return 'blog_charset' === $name ? 'UTF-8' : $default; }
function is_user_logged_in() { return ! empty( $GLOBALS['wphx_logged_in'] ); }
function current_user_can( $capability ) { return $GLOBALS['wphx_caps'][ $capability ] ?? true; }
function get_current_user_id() { return $GLOBALS['wphx_current_user_id']; }
function wp_get_current_user() { return (object) array( 'ID' => $GLOBALS['wphx_current_user_id'], 'user_login' => 'fixture-user' ); }

function __( $text, $domain = 'default' ) { return $text; }
function _x( $text, $context, $domain = 'default' ) { return $text; }
function sanitize_key( $key ) { return preg_replace( '/[^a-z0-9_\\-]/', '', strtolower( (string) $key ) ); }
function sanitize_text_field( $str ) { return is_scalar( $str ) ? trim( strip_tags( (string) $str ) ) : ''; }
function wp_unslash( $value ) { return is_array( $value ) ? array_map( 'wp_unslash', $value ) : stripslashes( (string) $value ); }
function wp_json_encode( $value, $flags = 0, $depth = 512 ) { return json_encode( $value, $flags, $depth ); }
function wp_generate_password( $length = 12 ) { return str_repeat( 'x', (int) $length ); }

function add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wphx_callbacks'][ $hook_name ][ $priority ][] = array( $callback, $accepted_args );
\t$GLOBALS['wphx_filters'][] = array( 'hook' => 'add_filter:' . $hook_name, 'priority' => $priority, 'accepted_args' => $accepted_args );
\treturn true;
}

function add_action( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wphx_actions'][] = array( 'hook' => 'add_action:' . $hook_name, 'priority' => $priority, 'accepted_args' => $accepted_args );
\treturn add_filter( $hook_name, $callback, $priority, $accepted_args );
}

function has_action( $hook_name ) {
\treturn ! empty( $GLOBALS['wphx_callbacks'][ $hook_name ] );
}

function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_filters'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) + 1 );
\tif ( isset( $GLOBALS['wphx_callbacks'][ $hook_name ] ) ) {
\t\tksort( $GLOBALS['wphx_callbacks'][ $hook_name ] );
\t\tforeach ( $GLOBALS['wphx_callbacks'][ $hook_name ] as $callbacks ) {
\t\t\tforeach ( $callbacks as $callback ) {
\t\t\t\t$accepted = $callback[1];
\t\t\t\t$value = call_user_func_array( $callback[0], array_slice( array_merge( array( $value ), $args ), 0, $accepted ) );
\t\t\t}
\t\t}
\t}
\treturn $value;
}

function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_actions'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) );
\tif ( isset( $GLOBALS['wphx_callbacks'][ $hook_name ] ) ) {
\t\tksort( $GLOBALS['wphx_callbacks'][ $hook_name ] );
\t\tforeach ( $GLOBALS['wphx_callbacks'][ $hook_name ] as $callbacks ) {
\t\t\tforeach ( $callbacks as $callback ) {
\t\t\t\tcall_user_func_array( $callback[0], array_slice( $args, 0, $callback[1] ) );
\t\t\t}
\t\t}
\t}
}

function wp_die( $message = '', $title = '', $args = array() ) {
\t$response = null;
\tif ( is_int( $title ) ) {
\t\t$response = $title;
\t} elseif ( is_array( $args ) && array_key_exists( 'response', $args ) ) {
\t\t$response = $args['response'];
\t}
\tthrow new Wphx_Wp_Die( array( 'kind' => 'wp_die', 'message' => (string) $message, 'response' => $response ) );
}

function wp_send_json( $response, $status_code = null, $flags = 0 ) {
\tthrow new Wphx_Send_Json( array( 'kind' => 'wp_send_json', 'status_code' => $status_code, 'response' => $response ) );
}

function wp_send_json_success( $value = null, $status_code = null, $flags = 0 ) {
\twp_send_json( array( 'success' => true, 'data' => $value ), $status_code, $flags );
}

function wp_send_json_error( $value = null, $status_code = null, $flags = 0 ) {
\twp_send_json( array( 'success' => false, 'data' => $value ), $status_code, $flags );
}

function wp_verify_nonce( $nonce, $action = -1 ) {
\treturn $GLOBALS['wphx_nonce_valid'] ?? 1;
}

function check_ajax_referer( $action = -1, $query_arg = false, $stop = true ) {
\t$key = $query_arg ? $query_arg : '_ajax_nonce';
\t$nonce = $_REQUEST[ $key ] ?? '';
\t$result = wp_verify_nonce( $nonce, $action );
\t$GLOBALS['wphx_nonce_checks'][] = array( 'action' => $action, 'query_arg' => $query_arg, 'result' => $result );
\tif ( false === $result && $stop ) {
\t\twp_die( -1, 403 );
\t}
\treturn $result;
}

function update_user_meta( $user_id, $meta_key, $meta_value ) {
\t$GLOBALS['wphx_user_meta'][] = array( 'user_id' => $user_id, 'key' => $meta_key, 'value' => $meta_value );
\treturn true;
}
`
  );

  writeStub(
    `${root}/wp-admin/includes/admin.php`,
    `<?php
if ( 'admin-post:logged-in-registered' === ( $GLOBALS['wphx_case'] ?? '' ) ) {
\tadd_action(
\t\t'admin_post_wphx_save',
\t\tfunction () {
\t\t\t$GLOBALS['wphx_admin_post_callback'] = array( 'action' => $_REQUEST['action'] ?? '', 'method' => $_SERVER['REQUEST_METHOD'] ?? '' );
\t\t\techo 'admin-post-dispatched';
\t\t},
\t\t10,
\t\t0
\t);
}
`
  );
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
$root = rtrim( $argv[1], '/\\\\' );
$case = $argv[2] ?? '';

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
$GLOBALS['wphx_case'] = $case;
$GLOBALS['wphx_logged_in'] = false;
$GLOBALS['wphx_caps'] = array(
\t'edit_theme_options' => true,
\t'install_plugins' => true,
\t'install_themes' => true,
);

$_GET = array();
$_POST = array();
$_REQUEST = array();
$_SERVER['REQUEST_METHOD'] = 'GET';

switch ( $case ) {
\tcase 'ajax:missing-action':
\t\t$target = 'wp-admin/admin-ajax.php';
\t\t$GLOBALS['wphx_logged_in'] = true;
\t\t$_SERVER['REQUEST_URI'] = '/wp-admin/admin-ajax.php';
\t\tbreak;

\tcase 'ajax:logged-in-registered':
\t\t$target = 'wp-admin/admin-ajax.php';
\t\t$GLOBALS['wphx_logged_in'] = true;
\t\t$_GET = array( 'action' => 'logged-in' );
\t\t$_REQUEST = $_GET;
\t\t$_SERVER['REQUEST_URI'] = '/wp-admin/admin-ajax.php?action=logged-in';
\t\tbreak;

\tcase 'ajax:nopriv-heartbeat':
\t\t$target = 'wp-admin/admin-ajax.php';
\t\t$_SERVER['REQUEST_METHOD'] = 'POST';
\t\t$_POST = array( 'action' => 'heartbeat', 'screen_id' => 'dashboard', 'data' => array( 'tick' => '1' ) );
\t\t$_REQUEST = $_POST;
\t\t$_SERVER['REQUEST_URI'] = '/wp-admin/admin-ajax.php?action=heartbeat';
\t\tbreak;

\tcase 'ajax:closed-postboxes':
\t\t$target = 'wp-admin/admin-ajax.php';
\t\t$GLOBALS['wphx_logged_in'] = true;
\t\t$_SERVER['REQUEST_METHOD'] = 'POST';
\t\t$_POST = array(
\t\t\t'action' => 'closed-postboxes',
\t\t\t'closedpostboxesnonce' => 'nonce',
\t\t\t'page' => 'dashboard',
\t\t\t'closed' => 'box-one,box-two',
\t\t\t'hidden' => 'submitdiv,box-three'
\t\t);
\t\t$_REQUEST = $_POST;
\t\t$_SERVER['REQUEST_URI'] = '/wp-admin/admin-ajax.php?action=closed-postboxes';
\t\tbreak;

\tcase 'ajax:hidden-columns-invalid-page':
\t\t$target = 'wp-admin/admin-ajax.php';
\t\t$GLOBALS['wphx_logged_in'] = true;
\t\t$_SERVER['REQUEST_METHOD'] = 'POST';
\t\t$_POST = array( 'action' => 'hidden-columns', 'screenoptionnonce' => 'nonce', 'page' => 'bad/page', 'hidden' => 'title,date' );
\t\t$_REQUEST = $_POST;
\t\t$_SERVER['REQUEST_URI'] = '/wp-admin/admin-ajax.php?action=hidden-columns';
\t\tbreak;

\tcase 'admin-post:logged-in-empty-action':
\t\t$target = 'wp-admin/admin-post.php';
\t\t$GLOBALS['wphx_logged_in'] = true;
\t\t$_SERVER['REQUEST_METHOD'] = 'POST';
\t\t$_SERVER['REQUEST_URI'] = '/wp-admin/admin-post.php';
\t\tbreak;

\tcase 'admin-post:nopriv-missing-handler':
\t\t$target = 'wp-admin/admin-post.php';
\t\t$_SERVER['REQUEST_METHOD'] = 'POST';
\t\t$_POST = array( 'action' => 'wphx_missing' );
\t\t$_REQUEST = $_POST;
\t\t$_SERVER['REQUEST_URI'] = '/wp-admin/admin-post.php?action=wphx_missing';
\t\tbreak;

\tcase 'admin-post:logged-in-registered':
\t\t$target = 'wp-admin/admin-post.php';
\t\t$GLOBALS['wphx_logged_in'] = true;
\t\t$_SERVER['REQUEST_METHOD'] = 'POST';
\t\t$_POST = array( 'action' => 'wphx_save' );
\t\t$_REQUEST = $_POST;
\t\t$_SERVER['REQUEST_URI'] = '/wp-admin/admin-post.php?action=wphx_save';
\t\tbreak;

\tdefault:
\t\tfwrite( STDERR, 'Unknown case: ' . $case . PHP_EOL );
\t\texit( 2 );
}

ob_start();
$exception_payload = null;
$completed = false;
try {
\trequire $root . '/' . $target;
\t$completed = true;
} catch ( Wphx_Wp_Die $e ) {
\t$exception_payload = $e->payload;
} catch ( Wphx_Send_Json $e ) {
\t$exception_payload = $e->payload;
}
$output = ob_get_clean();

$json_response = null;
if ( is_array( $exception_payload ) && isset( $exception_payload['response'] ) && is_array( $exception_payload['response'] ) ) {
\t$json_response = $exception_payload['response'];
\tif ( isset( $json_response['server_time'] ) ) {
\t\t$json_response['server_time'] = is_int( $json_response['server_time'] ) ? '<int>' : '<non-int>';
\t}
\t$exception_payload['response'] = $json_response;
}

$interesting_actions = array_values(
\tarray_filter(
\t\tarray_map(
\t\t\tfunction ( $entry ) {
\t\t\t\treturn $entry['hook'] ?? '';
\t\t\t},
\t\t\t$GLOBALS['wphx_actions'] ?? array()
\t\t),
\t\tfunction ( $hook ) {
\t\t\treturn str_starts_with( $hook, 'wp_ajax' ) || str_starts_with( $hook, 'admin_post' ) || 'admin_init' === $hook;
\t\t}
\t)
);

echo json_encode(
\tarray(
\t\t'case' => $case,
\t\t'target' => $target,
\t\t'completed' => $completed,
\t\t'exception' => $exception_payload,
\t\t'json_response' => $json_response,
\t\t'output' => $output,
\t\t'actions' => $interesting_actions,
\t\t'nonce_checks' => $GLOBALS['wphx_nonce_checks'] ?? array(),
\t\t'user_meta' => $GLOBALS['wphx_user_meta'] ?? array(),
\t\t'admin_post_callback' => $GLOBALS['wphx_admin_post_callback'] ?? null,
\t),
\tJSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
);
`
  );
}

function runCase(root, testCase) {
  return JSON.parse(command("php", [PROBE, root, testCase.id]));
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    if (readFileSync(path, "utf8") !== content) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-316-admin-ajax-post-oracle-fixture`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function observationsFor(root) {
  const observations = {};
  for (const testCase of CASES) observations[testCase.id] = runCase(root, testCase);
  return observations;
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/admin-ajax-post-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "copied_oracle_fixture",
      name: "admin AJAX and admin-post route dispatch fixture",
      area: "wp-admin/admin-ajax.php wp-admin/admin-post.php wp-admin/includes/ajax-actions.php",
      public_contract:
        "This slice executes copied upstream WordPress route files under deterministic stubs for oracle/candidate behavior observations. It does not claim generated public PHP replacement, installed admin parity, or Haxe-owned route execution."
    },
    ownership_state: "external_oracle_fixture",
    ownership_axes: {
      semantic_owner: "upstream_wordpress_oracle",
      adapter_contract_owner: "haxe_typed_prior_slice",
      emission_strategy: "copied_upstream_public_php_with_deterministic_bootstrap_stubs",
      execution_provider: "php_oracle_candidate_probe",
      compatibility_evidence: "targeted_copied_oracle_behavior"
    },
    bridge: {
      exists: true,
      kind: "copied-upstream-oracle-candidate-fixture",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass admin-ajax/admin-post route dispatch, selected AJAX handler, nonce/capability, JSON/wp_die response, upstream PHPUnit, browser/e2e, database-backed installed admin, and ecosystem plugin gates before claiming public PHP ownership or installed admin parity."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    copied_upstream_inputs: SOURCE_FILES,
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-316-admin-ajax-post-oracle-fixture",
        "npm run wp:core:wphx-316-admin-ajax-post-oracle-fixture:check",
        "npm run operations:bridge-claim-guardrails:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-316-03-admin-ajax-post-oracle-fixture"],
      manifest_digest: manifestSha
    },
    notes:
      "Mirrored PHP is regenerated under build/ only. The candidate currently matches the upstream oracle by construction; future generated overlays require an explicit overlay manifest and additional gates."
  };
}

rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
writeProbe();

const oracle = observationsFor(ORACLE_ROOT);
const candidate = observationsFor(CANDIDATE_ROOT);
const matches = JSON.stringify(oracle) === JSON.stringify(candidate);
if (!matches) throw new Error("oracle/candidate observations differ");

const manifest = {
  schema: "wphx.wp-core-admin-ajax-post-oracle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["copied_oracle_fixture", "targeted_behavior_observation"],
  artifact_scope: "bridge_fixture",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT),
    upstream_sources: SOURCE_FILES.map(sourceRecord),
    support_stubs: SUPPORT_STUBS,
    runner: inputRecord(RUNNER)
  },
  fixture: {
    source_files: SOURCE_FILES,
    support_stubs: SUPPORT_STUBS,
    covered_symbols: COVERED_SYMBOLS,
    cases: CASES,
    oracle,
    candidate,
    observation_count: CASES.length,
    matching_observations: matches
  },
  claims: {
    targeted_copied_oracle_behavior_claimed: true,
    broad_behavior_parity_claimed: false,
    public_php_replacement_claimed: false,
    haxe_runtime_ownership_claimed: false,
    installed_admin_parity_claimed: false,
    database_backed_state_claimed: false,
    browser_editor_behavior_claimed: false,
    generated_original_path_adapter_claimed: false,
    generated_candidate_overlay_claimed: false
  },
  non_claims: [
    "Does not claim generated replacement for wp-admin/admin-ajax.php, wp-admin/admin-post.php, or wp-admin/includes/ajax-actions.php.",
    "Does not execute WordPress bootstrap, a real database, real users/sessions, real nonces, real headers, browser/editor behavior, or installed admin routes.",
    "Does not claim broad admin AJAX parity, upstream PHPUnit pass/pass parity, public PHP ABI ownership, or durable original-path adapter ownership."
  ],
  validation_result: {
    status: "passed",
    observation_count: CASES.length,
    source_file_count: SOURCE_FILES.length,
    covered_symbol_count: COVERED_SYMBOLS.length,
    oracle_candidate_match: matches
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const ownershipText = JSON.stringify(ownershipManifest(sha256(manifestText)), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-316-03-admin-ajax-post-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "admin AJAX/post copied-oracle fixture manifest" },
    { path: OWNERSHIP, role: "admin AJAX/post copied-oracle fixture ownership manifest" },
    { path: RUNNER, role: "deterministic copied-oracle generator/check runner" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-316-admin-ajax-post-oracle-fixture",
    "npm run wp:core:wphx-316-admin-ajax-post-oracle-fixture:check",
    "npm run operations:bridge-claim-guardrails:check"
  ],
  validation_result: manifest.validation_result,
  manifest_sha256: sha256(manifestText),
  ownership_sha256: sha256(ownershipText),
  related_receipts: [
    "receipt:wphx-316-01-admin-feature-ajax-surface",
    "receipt:wphx-316-02-admin-feature-ajax-adapter-contract-candidate"
  ]
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

console.log(JSON.stringify(manifest.validation_result, null, 2));
