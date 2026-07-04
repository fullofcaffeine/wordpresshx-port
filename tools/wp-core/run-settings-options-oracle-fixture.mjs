#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-0rwd",
  external_ref: "WPHX-316.04",
  title: "WPHX-316.04 - Add settings options route oracle fixture"
};
const RECORDED_AT = "2026-07-04T03:15:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-settings-options-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-316-04";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-316-04-settings-options-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-316-04-settings-options-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-316-04-settings-options-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-316-01-admin-feature-ajax-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-316-02-admin-feature-ajax-adapter-contract-candidate.v1.json";
const AJAX_POST_FIXTURE = "manifests/wp-core/wphx-316-03-admin-ajax-post-oracle-fixture.v1.json";

const SOURCE_FILES = ["src/wp-admin/options.php"];
const SUPPORT_STUBS = ["wp-admin/admin.php", "wp-admin/admin-header.php", "wp-admin/admin-footer.php"];
const COVERED_SYMBOLS = [
  "wp-admin/options.php",
  "option_page_capability_{$option_page}",
  "allowed_options",
  "check_admin_referer",
  "update_option",
  "delete_option",
  "add_settings_error",
  "get_settings_errors",
  "set_transient",
  "wp_redirect",
  "wp_admin_notice",
  "wp_nonce_field",
  "submit_button"
];
const CASES = [
  { id: "options:capability-denied", focus: "settings route capability gate emits wp_die 403 before option mutation" },
  { id: "options:adminhash-match", focus: "admin email hash confirmation updates options and redirects to updated=true" },
  { id: "options:dismiss-new-admin-email", focus: "new admin email dismissal checks nonce, deletes options, and redirects" },
  { id: "options:update-general", focus: "general settings update normalizes custom date/time and UTC timezone before redirect" },
  { id: "options:update-unknown-page", focus: "unknown option_page fails allowed-options validation with wp_die" },
  { id: "options:render-all-options", focus: "direct all-options render emits warning, option rows, disabled serialized/API-key fields, nonce, and submit button" }
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
    `${root}/wp-admin/admin.php`,
    `<?php
class Wphx_Wp_Die extends Exception {
\tpublic $payload;

\tpublic function __construct( $payload ) {
\t\tparent::__construct( 'wp_die' );
\t\t$this->payload = $payload;
\t}
}

$GLOBALS['title'] = $GLOBALS['title'] ?? '';
$GLOBALS['parent_file'] = $GLOBALS['parent_file'] ?? '';
$GLOBALS['wphx_actions'] = $GLOBALS['wphx_actions'] ?? array();
$GLOBALS['wphx_filters'] = $GLOBALS['wphx_filters'] ?? array();
$GLOBALS['wphx_settings_errors'] = $GLOBALS['wphx_settings_errors'] ?? array();
$GLOBALS['wphx_updated_options'] = $GLOBALS['wphx_updated_options'] ?? array();
$GLOBALS['wphx_deleted_options'] = $GLOBALS['wphx_deleted_options'] ?? array();
$GLOBALS['wphx_redirects'] = $GLOBALS['wphx_redirects'] ?? array();
$GLOBALS['wphx_nonce_checks'] = $GLOBALS['wphx_nonce_checks'] ?? array();
$GLOBALS['wphx_transients'] = $GLOBALS['wphx_transients'] ?? array();
$GLOBALS['wphx_caps'] = $GLOBALS['wphx_caps'] ?? array( 'manage_options' => true, 'install_languages' => false );

$wpdb = new class {
\tpublic $options = 'wp_options';

\tpublic function get_results( $query ) {
\t\treturn array(
\t\t\t(object) array( 'option_name' => 'blogname', 'option_value' => 'Fixture Site' ),
\t\t\t(object) array( 'option_name' => 'serialized_string', 'option_value' => 's:11:"hello world";' ),
\t\t\t(object) array( 'option_name' => 'serialized_array', 'option_value' => 'a:1:{s:3:"key";s:5:"value";}' ),
\t\t\t(object) array( 'option_name' => 'connectors_demo_api_key', 'option_value' => 'sk-live-secret-value' ),
\t\t\t(object) array( 'option_name' => 'multiline', 'option_value' => "line one\\nline two" ),
\t\t);
\t}
};

function __( $text, $domain = 'default' ) { return $text; }
function esc_html__( $text, $domain = 'default' ) { return esc_html( $text ); }
function esc_html_e( $text, $domain = 'default' ) { echo esc_html( $text ); }
function esc_attr( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function esc_html( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function esc_textarea( $text ) { return htmlspecialchars( (string) $text, ENT_NOQUOTES, 'UTF-8' ); }
function sanitize_text_field( $str ) { return is_scalar( $str ) ? trim( strip_tags( (string) $str ) ) : ''; }
function wp_unslash( $value ) { return is_array( $value ) ? array_map( 'wp_unslash', $value ) : stripslashes( (string) $value ); }

function current_user_can( $capability ) {
\treturn $GLOBALS['wphx_caps'][ $capability ] ?? true;
}

function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_filters'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) + 1 );
\treturn $value;
}

function apply_filters_deprecated( $hook_name, $args, $version, $replacement = '', $message = '' ) {
\t$GLOBALS['wphx_filters'][] = array( 'hook' => 'deprecated:' . $hook_name, 'version' => $version, 'replacement' => $replacement );
\treturn $args[0];
}

function _deprecated_argument( $function_name, $version, $message = '' ) {
\t$GLOBALS['wphx_actions'][] = array( 'hook' => 'deprecated_argument', 'function_name' => $function_name, 'version' => $version );
}

function wp_die( $message = '', $title = '', $args = array() ) {
\t$response = is_int( $title ) ? $title : ( is_array( $args ) && isset( $args['response'] ) ? $args['response'] : null );
\tthrow new Wphx_Wp_Die( array( 'kind' => 'wp_die', 'message' => wp_strip_all_tags( (string) $message ), 'response' => $response ) );
}

function wp_strip_all_tags( $text ) { return strip_tags( (string) $text ); }
function wp_redirect( $location, $status = 302 ) { $GLOBALS['wphx_redirects'][] = array( 'location' => $location, 'status' => $status ); return true; }
function admin_url( $path = '', $scheme = 'admin' ) { return 'https://example.test/wp-admin/' . ltrim( (string) $path, '/' ); }
function get_current_blog_id() { return 1; }
function check_admin_referer( $action = -1, $query_arg = '_wpnonce' ) { $GLOBALS['wphx_nonce_checks'][] = array( 'action' => $action, 'query_arg' => $query_arg ); return 1; }
function is_multisite() { return false; }
function is_utf8_charset() { return true; }
function get_site_option( $name, $default = false ) { return 'initial_db_version' === $name ? 50000 : $default; }

function get_option( $name, $default = false ) {
\t$values = array(
\t\t'adminhash' => array( 'hash' => 'abc123', 'newemail' => 'new-admin@example.test' ),
\t\t'blog_public' => '1',
\t\t'upload_path' => '',
\t\t'upload_url_path' => '',
\t\t'timezone_string' => 'America/Mexico_City',
\t\t'gmt_offset' => '-6',
\t);
\treturn array_key_exists( $name, $values ) ? $values[ $name ] : $default;
}

function update_option( $name, $value, $autoload = null ) { $GLOBALS['wphx_updated_options'][] = array( 'name' => $name, 'value' => $value, 'autoload' => $autoload ); return true; }
function delete_option( $name ) { $GLOBALS['wphx_deleted_options'][] = $name; return true; }
function get_user_locale() { return $GLOBALS['wphx_user_locale'] ?? 'en_US'; }
function load_default_textdomain( $locale = null ) { $GLOBALS['wphx_actions'][] = array( 'hook' => 'load_default_textdomain', 'locale' => $locale ); }

function add_settings_error( $setting, $code, $message, $type = 'error' ) { $GLOBALS['wphx_settings_errors'][] = compact( 'setting', 'code', 'message', 'type' ); }
function get_settings_errors() { return $GLOBALS['wphx_settings_errors']; }
function set_transient( $transient, $value, $expiration = 0 ) { $GLOBALS['wphx_transients'][] = array( 'transient' => $transient, 'value_count' => is_array( $value ) ? count( $value ) : null, 'expiration' => $expiration ); return true; }
function wp_get_referer() { return 'https://example.test/wp-admin/options-general.php?page=general'; }
function add_query_arg( $key, $value, $url ) { return $url . ( str_contains( $url, '?' ) ? '&' : '?' ) . rawurlencode( $key ) . '=' . rawurlencode( $value ); }

function wp_admin_notice( $message, $args = array() ) { echo '<div class="notice notice-' . esc_attr( $args['type'] ?? 'info' ) . '">' . $message . '</div>'; }
function wp_nonce_field( $action ) { echo '<input type="hidden" name="_wpnonce" value="nonce-' . esc_attr( $action ) . '" />'; }
function disabled( $disabled, $current = true ) { if ( (bool) $disabled === (bool) $current ) echo ' disabled="disabled"'; }
function submit_button( $text, $type = 'primary', $name = 'submit' ) { echo '<button type="submit" name="' . esc_attr( $name ) . '" class="' . esc_attr( $type ) . '">' . esc_html( $text ) . '</button>'; }

function is_serialized( $data ) { return is_string( $data ) && preg_match( '/^[aOsibdN]:/', $data ); }
function is_serialized_string( $data ) { return is_string( $data ) && str_starts_with( $data, 's:' ); }
function maybe_unserialize( $data ) { return is_serialized_string( $data ) ? unserialize( $data ) : $data; }
function _wp_connectors_mask_api_key( $value ) { return substr( (string) $value, 0, 3 ) . '...' . substr( (string) $value, -4 ); }
`
  );

  writeStub(`${root}/wp-admin/admin-header.php`, "<?php echo '<header id=\"wpadminbar\">admin-header</header>'; ?>\n");
  writeStub(`${root}/wp-admin/admin-footer.php`, "<?php echo '<footer id=\"wpfooter\">admin-footer</footer>'; ?>\n");
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
$root = rtrim( $argv[1], '/\\\\' );
$case = $argv[2] ?? '';
$emitted = false;
$exception_payload = null;
$completed = false;

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
$_GET = array();
$_POST = array();
$_REQUEST = array();
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['REQUEST_URI'] = '/wp-admin/options.php';

function wphx_prepare_case( $case ) {
\tswitch ( $case ) {
\t\tcase 'options:capability-denied':
\t\t\t$GLOBALS['wphx_caps'] = array( 'manage_options' => false );
\t\t\tbreak;
\t\tcase 'options:adminhash-match':
\t\t\t$_GET = array( 'adminhash' => 'abc123' );
\t\t\t$_REQUEST = $_GET;
\t\t\tbreak;
\t\tcase 'options:dismiss-new-admin-email':
\t\t\t$_GET = array( 'dismiss' => 'new_admin_email', '_wpnonce' => 'nonce' );
\t\t\t$_REQUEST = $_GET;
\t\t\tbreak;
\t\tcase 'options:update-general':
\t\t\t$_SERVER['REQUEST_METHOD'] = 'POST';
\t\t\t$_POST = array(
\t\t\t\t'action' => 'update',
\t\t\t\t'option_page' => 'general',
\t\t\t\t'_wpnonce' => 'nonce',
\t\t\t\t'blogname' => 'Updated Site',
\t\t\t\t'date_format' => '\\\\c\\\\u\\\\s\\\\t\\\\o\\\\m',
\t\t\t\t'date_format_custom' => 'Y-m-d',
\t\t\t\t'time_format' => '\\\\c\\\\u\\\\s\\\\t\\\\o\\\\m',
\t\t\t\t'time_format_custom' => 'H:i',
\t\t\t\t'timezone_string' => 'UTC+2',
\t\t\t\t'WPLANG' => '',
\t\t\t);
\t\t\t$_REQUEST = $_POST;
\t\t\tbreak;
\t\tcase 'options:update-unknown-page':
\t\t\t$_SERVER['REQUEST_METHOD'] = 'POST';
\t\t\t$_POST = array( 'action' => 'update', 'option_page' => 'wphx_unknown', '_wpnonce' => 'nonce' );
\t\t\t$_REQUEST = $_POST;
\t\t\tbreak;
\t\tcase 'options:render-all-options':
\t\t\tbreak;
\t\tdefault:
\t\t\tfwrite( STDERR, 'Unknown case: ' . $case . PHP_EOL );
\t\t\texit( 2 );
\t}
}

function wphx_emit_result() {
\tglobal $case, $emitted, $exception_payload, $completed;
\tif ( $emitted ) {
\t\treturn;
\t}
\t$emitted = true;
\t$output = '';
\twhile ( ob_get_level() > 0 ) {
\t\t$output = ob_get_clean() . $output;
\t}
\t$updated = array();
\tforeach ( $GLOBALS['wphx_updated_options'] ?? array() as $record ) {
\t\t$updated[ $record['name'] ] = $record['value'];
\t}
\techo json_encode(
\t\tarray(
\t\t\t'case' => $case,
\t\t\t'completed' => $completed,
\t\t\t'exception' => $exception_payload,
\t\t\t'redirects' => $GLOBALS['wphx_redirects'] ?? array(),
\t\t\t'nonce_checks' => $GLOBALS['wphx_nonce_checks'] ?? array(),
\t\t\t'updated_options' => $updated,
\t\t\t'deleted_options' => $GLOBALS['wphx_deleted_options'] ?? array(),
\t\t\t'settings_errors' => $GLOBALS['wphx_settings_errors'] ?? array(),
\t\t\t'transients' => $GLOBALS['wphx_transients'] ?? array(),
\t\t\t'filters' => array_values( array_map( fn( $entry ) => $entry['hook'] ?? '', $GLOBALS['wphx_filters'] ?? array() ) ),
\t\t\t'output_contains' => array(
\t\t\t\t'all_settings_heading' => str_contains( $output, 'All Settings' ),
\t\t\t\t'warning_notice' => str_contains( $output, 'This page allows direct access to your site settings' ),
\t\t\t\t'serialized_disabled' => str_contains( $output, 'SERIALIZED DATA' ),
\t\t\t\t'api_key_masked' => str_contains( $output, 'sk-...alue' ),
\t\t\t\t'textarea' => str_contains( $output, '<textarea' ),
\t\t\t\t'submit_button' => str_contains( $output, 'Save Changes' ),
\t\t\t),
\t\t\t'output_length' => strlen( $output ),
\t\t),
\t\tJSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
\t);
}

register_shutdown_function( 'wphx_emit_result' );
wphx_prepare_case( $case );
ob_start();
try {
\trequire $root . '/wp-admin/options.php';
\t$completed = true;
} catch ( Wphx_Wp_Die $e ) {
\t$exception_payload = $e->payload;
}
wphx_emit_result();
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
      throw new Error(`${path} is stale; run npm run wp:core:wphx-316-settings-options-oracle-fixture`);
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
    manifest_id: "ownership:wp-core/settings-options-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "copied_oracle_fixture",
      name: "settings/options route fixture",
      area: "wp-admin/options.php settings API option update and all-options render branches",
      public_contract:
        "This slice executes copied upstream WordPress options.php under deterministic stubs for oracle/candidate behavior observations. It does not claim generated public PHP replacement, installed admin parity, database-backed settings persistence, or Haxe-owned route execution."
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
        "Replace copied public PHP with generated original-path adapters and pass settings/options route dispatch, Settings API update, nonce/capability, database-backed persistence, admin screen rendering, selected upstream PHPUnit/e2e, and installed admin fixtures before claiming public PHP ownership or installed admin parity."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    copied_upstream_inputs: SOURCE_FILES,
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-316-settings-options-oracle-fixture",
        "npm run wp:core:wphx-316-settings-options-oracle-fixture:check",
        "npm run operations:bridge-claim-guardrails:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-316-04-settings-options-oracle-fixture"],
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
  schema: "wphx.wp-core-settings-options-oracle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["copied_oracle_fixture", "targeted_behavior_observation"],
  artifact_scope: "bridge_fixture",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT),
    ajax_post_fixture_manifest: inputRecord(AJAX_POST_FIXTURE),
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
    "Does not claim generated replacement for wp-admin/options.php or Settings API route files.",
    "Does not execute WordPress bootstrap, a real database, real users/sessions, real nonces, real headers, browser/editor behavior, or installed admin routes.",
    "Does not claim broad settings/options parity, upstream PHPUnit pass/pass parity, public PHP ABI ownership, or durable original-path adapter ownership."
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
  id: "receipt:wphx-316-04-settings-options-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "settings/options copied-oracle fixture manifest" },
    { path: OWNERSHIP, role: "settings/options copied-oracle fixture ownership manifest" },
    { path: RUNNER, role: "deterministic copied-oracle generator/check runner" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-316-settings-options-oracle-fixture",
    "npm run wp:core:wphx-316-settings-options-oracle-fixture:check",
    "npm run operations:bridge-claim-guardrails:check"
  ],
  validation_result: manifest.validation_result,
  manifest_sha256: sha256(manifestText),
  ownership_sha256: sha256(ownershipText),
  related_receipts: [
    "receipt:wphx-316-01-admin-feature-ajax-surface",
    "receipt:wphx-316-02-admin-feature-ajax-adapter-contract-candidate",
    "receipt:wphx-316-03-admin-ajax-post-oracle-fixture"
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
