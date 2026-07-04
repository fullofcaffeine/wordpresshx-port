#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-cqis",
  external_ref: "WPHX-316.06",
  title: "WPHX-316.06 - Add privacy export erase route oracle fixture"
};
const RECORDED_AT = "2026-07-04T05:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-privacy-export-erase-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-316-06";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-316-06-privacy-export-erase-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-316-06-privacy-export-erase-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-316-06-privacy-export-erase-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-316-01-admin-feature-ajax-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-316-02-admin-feature-ajax-adapter-contract-candidate.v1.json";
const PRIVACY_STATE_FIXTURE = "manifests/wp-core/wphx-312-11-privacy-request-admin-state-oracle-fixture.v1.json";
const PRIVACY_MAIL_FIXTURE = "manifests/wp-core/wphx-312-07-privacy-request-mail-oracle-fixture.v1.json";

const SOURCE_FILES = [
  "src/wp-admin/export-personal-data.php",
  "src/wp-admin/erase-personal-data.php",
  "src/wp-admin/includes/privacy-tools.php"
];
const SUPPORT_STUBS = ["wp-admin/admin.php", "wp-admin/admin-header.php", "wp-admin/admin-footer.php"];
const COVERED_SYMBOLS = [
  "wp-admin/export-personal-data.php",
  "wp-admin/erase-personal-data.php",
  "_wp_personal_data_handle_actions",
  "_wp_personal_data_cleanup_requests",
  "_wp_privacy_resend_request",
  "_wp_privacy_completed_request",
  "wp_create_user_request",
  "wp_send_user_request",
  "WP_Query",
  "WP_Privacy_Data_Export_Requests_List_Table",
  "WP_Privacy_Data_Removal_Requests_List_Table",
  "current_user_can",
  "check_admin_referer",
  "add_settings_error",
  "add_screen_option",
  "wp_nonce_field"
];
const CASES = [
  { id: "privacy-route:export-capability-denied", focus: "export screen rejects users without export_others_personal_data capability" },
  { id: "privacy-route:erase-capability-denied", focus: "erase screen rejects users without erase_others_personal_data plus delete_users capabilities" },
  { id: "privacy-route:add-export-request-mail", focus: "export screen add action creates a pending request, sends confirmation mail, and records success notice" },
  { id: "privacy-route:add-erase-request-confirmed", focus: "erase screen add action without confirmation mail creates a confirmed request and records success notice" },
  { id: "privacy-route:retry-confirmation-mail", focus: "export screen retry button resends confirmation mail through copied privacy helper" },
  { id: "privacy-route:cleanup-expired-pending", focus: "privacy cleanup marks expired pending requests failed before list-table render" },
  { id: "privacy-route:render-export-screen", focus: "export screen renders stable heading, form, nonce, search, and list-table fragments" },
  { id: "privacy-route:render-erase-screen", focus: "erase screen renders stable heading, form, nonce, search, and list-table fragments" }
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

class WP_Error {
\tprivate $code;
\tprivate $message;
\tpublic function __construct( $code = '', $message = '' ) {
\t\t$this->code = $code;
\t\t$this->message = $message;
\t}
\tpublic function get_error_code() { return $this->code; }
\tpublic function get_error_message() { return $this->message; }
}

class WP_User {
\tpublic $ID = 44;
\tpublic $user_email = 'fixture-user@example.test';
\tpublic $user_login = 'fixture-user';
}

$GLOBALS['wphx_actions'] = $GLOBALS['wphx_actions'] ?? array();
$GLOBALS['wphx_filters'] = $GLOBALS['wphx_filters'] ?? array();
$GLOBALS['wphx_caps'] = $GLOBALS['wphx_caps'] ?? array();
$GLOBALS['wphx_nonce_checks'] = $GLOBALS['wphx_nonce_checks'] ?? array();
$GLOBALS['wphx_screen_options'] = $GLOBALS['wphx_screen_options'] ?? array();
$GLOBALS['wphx_enqueued_scripts'] = $GLOBALS['wphx_enqueued_scripts'] ?? array();
$GLOBALS['wphx_settings_errors'] = $GLOBALS['wphx_settings_errors'] ?? array();
$GLOBALS['wphx_created_requests'] = $GLOBALS['wphx_created_requests'] ?? array();
$GLOBALS['wphx_sent_requests'] = $GLOBALS['wphx_sent_requests'] ?? array();
$GLOBALS['wphx_updated_posts'] = $GLOBALS['wphx_updated_posts'] ?? array();
$GLOBALS['wphx_updated_meta'] = $GLOBALS['wphx_updated_meta'] ?? array();
$GLOBALS['wphx_queries'] = $GLOBALS['wphx_queries'] ?? array();
$GLOBALS['wphx_current_screen'] = null;

class Wphx_Screen {
\tpublic $id = 'tools_page_privacy';
\tpublic $help_tabs = array();
\tpublic $sidebar = '';
\tpublic $reader_content = array();
\tpublic function add_help_tab( $args ) { $this->help_tabs[] = $args['id'] ?? ''; }
\tpublic function set_help_sidebar( $content ) { $this->sidebar = $content; }
\tpublic function set_screen_reader_content( $content ) { $this->reader_content = $content; }
}

class Wphx_Privacy_Request_List_Table {
\tpublic $screen;
\tpublic $prepared = false;
\tpublic $processed = false;
\tprivate $class_name;
\tpublic function __construct( $class_name, $args = array() ) {
\t\t$this->screen = get_current_screen();
\t\t$this->class_name = $class_name;
\t}
\tpublic function process_bulk_action() {
\t\t$this->processed = true;
\t\t$GLOBALS['wphx_actions'][] = array( 'hook' => 'privacy_table_process_bulk_action', 'class' => $this->class_name );
\t}
\tpublic function prepare_items() {
\t\t$this->prepared = true;
\t\t$GLOBALS['wphx_actions'][] = array( 'hook' => 'privacy_table_prepare_items', 'class' => $this->class_name );
\t}
\tpublic function views() {
\t\techo '<ul class="subsubsub"><li>All <span class="count">(3)</span></li><li>Pending</li><li>Completed</li></ul>';
\t}
\tpublic function search_box( $text, $input_id ) {
\t\techo '<p class="search-box"><label for="' . esc_attr( $input_id ) . '-search-input">' . esc_html( $text ) . '</label><input id="' . esc_attr( $input_id ) . '-search-input" value="" /></p>';
\t}
\tpublic function display() {
\t\t$kind = str_contains( $this->class_name, 'Removal' ) ? 'erase' : 'export';
\t\techo '<table class="wp-list-table privacy-requests ' . esc_attr( $kind ) . '"><tr><td>privacy-request-row-' . esc_html( $kind ) . '</td></tr></table>';
\t}
\tpublic function embed_scripts() {
\t\techo '<script id="privacy-tools-embed">privacy-tools-' . esc_html( $this->class_name ) . '</script>';
\t}
}

function __( $text, $domain = 'default' ) { return $text; }
function _e( $text, $domain = 'default' ) { echo $text; }
function esc_attr( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function esc_attr_e( $text, $domain = 'default' ) { echo esc_attr( $text ); }
function esc_html( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function esc_html_e( $text, $domain = 'default' ) { echo esc_html( $text ); }
function esc_url( $url ) { return (string) $url; }
function sanitize_key( $key ) { return preg_replace( '/[^a-z0-9_\\-]/', '', strtolower( (string) $key ) ); }
function sanitize_text_field( $value ) { return trim( wp_strip_all_tags( (string) $value ) ); }
function wp_strip_all_tags( $text ) { return strip_tags( (string) $text ); }
function wp_unslash( $value ) { return is_array( $value ) ? array_map( 'wp_unslash', $value ) : stripslashes( (string) $value ); }
function absint( $value ) { return abs( (int) $value ); }
function is_wp_error( $thing ) { return $thing instanceof WP_Error; }
function current_user_can( $capability ) { return $GLOBALS['wphx_caps'][ $capability ] ?? true; }

function wp_die( $message = '', $title = '', $args = array() ) {
\t$response = is_int( $title ) ? $title : ( is_array( $args ) && isset( $args['response'] ) ? $args['response'] : 403 );
\tthrow new Wphx_Wp_Die( array( 'kind' => 'wp_die', 'message' => wp_strip_all_tags( (string) $message ), 'response' => $response ) );
}

function admin_url( $path = '', $scheme = 'admin' ) { return 'https://example.test/wp-admin/' . ltrim( (string) $path, '/' ); }
function get_current_screen() {
\tif ( null === $GLOBALS['wphx_current_screen'] ) {
\t\t$GLOBALS['wphx_current_screen'] = new Wphx_Screen();
\t}
\treturn $GLOBALS['wphx_current_screen'];
}
function wp_enqueue_script( $handle ) { $GLOBALS['wphx_enqueued_scripts'][] = $handle; }
function add_screen_option( $option, $args = array() ) { $GLOBALS['wphx_screen_options'][] = array( 'option' => $option, 'args' => $args ); }
function _get_list_table( $class_name, $args = array() ) { return new Wphx_Privacy_Request_List_Table( $class_name, $args ); }
function settings_errors() {
\tforeach ( $GLOBALS['wphx_settings_errors'] as $error ) {
\t\techo '<div class="' . esc_attr( $error['type'] ) . ' notice"><p>' . esc_html( $error['message'] ) . '</p></div>';
\t}
}
function submit_button( $text = 'Submit', $type = 'primary', $name = 'submit', $wrap = true ) {
\t$button = '<button type="submit" name="' . esc_attr( $name ) . '" class="button ' . esc_attr( $type ) . '">' . esc_html( $text ) . '</button>';
\tif ( $wrap ) {
\t\techo '<p class="submit">' . $button . '</p>';
\t} else {
\t\techo $button;
\t}
}
function wp_nonce_field( $action = -1, $name = '_wpnonce', $referer = true, $display = true ) {
\t$field = '<input type="hidden" id="' . esc_attr( $name ) . '" name="' . esc_attr( $name ) . '" value="nonce-' . esc_attr( $action ) . '" />';
\tif ( $display ) {
\t\techo $field;
\t}
\treturn $field;
}
function check_admin_referer( $action = -1, $query_arg = '_wpnonce' ) {
\t$GLOBALS['wphx_nonce_checks'][] = array( 'action' => $action, 'query_arg' => $query_arg );
\treturn 1;
}
function add_settings_error( $setting, $code, $message, $type = 'error' ) {
\t$GLOBALS['wphx_settings_errors'][] = compact( 'setting', 'code', 'message', 'type' );
}

function _wp_privacy_action_request_types() { return array( 'export_personal_data', 'remove_personal_data' ); }
function is_email( $email ) { return false !== filter_var( $email, FILTER_VALIDATE_EMAIL ); }
function get_user_by( $field, $value ) {
\tif ( 'login' === $field && 'fixture-user' === $value ) {
\t\treturn new WP_User();
\t}
\treturn false;
}
function wp_create_user_request( $email_address, $action_type, $request_data = array(), $status = 'pending' ) {
\t$id = 9000 + count( $GLOBALS['wphx_created_requests'] );
\t$GLOBALS['wphx_created_requests'][] = array( 'id' => $id, 'email' => $email_address, 'action' => $action_type, 'status' => $status );
\treturn $id;
}
function wp_send_user_request( $request_id ) {
\t$GLOBALS['wphx_sent_requests'][] = absint( $request_id );
\treturn empty( $GLOBALS['wphx_force_mail_failure'] );
}
function get_post( $request_id ) {
\t$request_id = absint( $request_id );
\tif ( isset( $GLOBALS['wphx_posts'][ $request_id ] ) ) {
\t\treturn (object) $GLOBALS['wphx_posts'][ $request_id ];
\t}
\treturn null;
}
function wp_get_user_request( $request_id ) {
\t$post = get_post( $request_id );
\tif ( ! $post || 'user_request' !== $post->post_type ) {
\t\treturn false;
\t}
\treturn (object) array(
\t\t'ID' => $post->ID,
\t\t'email' => $post->post_title,
\t\t'action_name' => $post->post_name,
\t\t'status' => $post->post_status,
\t);
}
function update_post_meta( $post_id, $meta_key, $meta_value ) {
\t$GLOBALS['wphx_updated_meta'][] = array( 'post_id' => absint( $post_id ), 'key' => $meta_key, 'value_kind' => gettype( $meta_value ) );
\treturn true;
}
function wp_update_post( $postarr ) {
\t$GLOBALS['wphx_updated_posts'][] = $postarr;
\tif ( isset( $GLOBALS['wphx_posts'][ $postarr['ID'] ] ) ) {
\t\tforeach ( $postarr as $key => $value ) {
\t\t\t$GLOBALS['wphx_posts'][ $postarr['ID'] ][ $key ] = $value;
\t\t}
\t}
\treturn $postarr['ID'] ?? 0;
}

class WP_Query {
\tpublic $posts = array();
\tpublic function __construct( $args = array() ) {
\t\t$GLOBALS['wphx_queries'][] = $args;
\t\t$ids = array();
\t\tforeach ( $GLOBALS['wphx_posts'] as $id => $post ) {
\t\t\tif ( isset( $args['post_type'] ) && $args['post_type'] !== $post['post_type'] ) {
\t\t\t\tcontinue;
\t\t\t}
\t\t\tif ( isset( $args['post_status'] ) && 'request-pending' === $args['post_status'] && 'request-pending' !== $post['post_status'] ) {
\t\t\t\tcontinue;
\t\t\t}
\t\t\tif ( isset( $args['date_query'] ) && empty( $post['expired'] ) ) {
\t\t\t\tcontinue;
\t\t\t}
\t\t\t$ids[] = $id;
\t\t}
\t\t$this->posts = $ids;
\t}
}

function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_filters'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) + 1 );
\treturn $value;
}
function do_action( $hook_name, ...$args ) { $GLOBALS['wphx_actions'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) ); }

require_once ABSPATH . 'wp-admin/includes/privacy-tools.php';
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
$case = $argv[2];

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'DAY_IN_SECONDS', 86400 );

$GLOBALS['wphx_case'] = $case;
$GLOBALS['wphx_caps'] = array(
\t'export_others_personal_data' => true,
\t'erase_others_personal_data' => true,
\t'delete_users' => true,
);
$GLOBALS['wphx_nonce_checks'] = array();
$GLOBALS['wphx_screen_options'] = array();
$GLOBALS['wphx_enqueued_scripts'] = array();
$GLOBALS['wphx_settings_errors'] = array();
$GLOBALS['wphx_created_requests'] = array();
$GLOBALS['wphx_sent_requests'] = array();
$GLOBALS['wphx_updated_posts'] = array();
$GLOBALS['wphx_updated_meta'] = array();
$GLOBALS['wphx_queries'] = array();
$GLOBALS['wphx_actions'] = array();
$GLOBALS['wphx_filters'] = array();
$GLOBALS['wphx_posts'] = array(
\t7101 => array( 'ID' => 7101, 'post_type' => 'user_request', 'post_title' => 'retry-export@example.test', 'post_name' => 'export_personal_data', 'post_status' => 'request-failed', 'expired' => false ),
\t7102 => array( 'ID' => 7102, 'post_type' => 'user_request', 'post_title' => 'expired-pending@example.test', 'post_name' => 'export_personal_data', 'post_status' => 'request-pending', 'expired' => true ),
\t7103 => array( 'ID' => 7103, 'post_type' => 'user_request', 'post_title' => 'fresh-pending@example.test', 'post_name' => 'remove_personal_data', 'post_status' => 'request-pending', 'expired' => false ),
);

$_GET = array();
$_POST = array();
$_REQUEST = array();
$_SERVER['REQUEST_URI'] = '/wp-admin/export-personal-data.php';
$route = 'export-personal-data.php';

switch ( $case ) {
\tcase 'privacy-route:export-capability-denied':
\t\t$GLOBALS['wphx_caps']['export_others_personal_data'] = false;
\t\tbreak;
\tcase 'privacy-route:erase-capability-denied':
\t\t$route = 'erase-personal-data.php';
\t\t$_SERVER['REQUEST_URI'] = '/wp-admin/erase-personal-data.php';
\t\t$GLOBALS['wphx_caps']['delete_users'] = false;
\t\tbreak;
\tcase 'privacy-route:add-export-request-mail':
\t\t$_POST = array(
\t\t\t'action' => 'add_export_personal_data_request',
\t\t\t'type_of_action' => 'export_personal_data',
\t\t\t'username_or_email_for_privacy_request' => 'portable@example.test',
\t\t\t'send_confirmation_email' => '1',
\t\t);
\t\tbreak;
\tcase 'privacy-route:add-erase-request-confirmed':
\t\t$route = 'erase-personal-data.php';
\t\t$_SERVER['REQUEST_URI'] = '/wp-admin/erase-personal-data.php';
\t\t$_POST = array(
\t\t\t'action' => 'add_remove_personal_data_request',
\t\t\t'type_of_action' => 'remove_personal_data',
\t\t\t'username_or_email_for_privacy_request' => 'fixture-user',
\t\t);
\t\tbreak;
\tcase 'privacy-route:retry-confirmation-mail':
\t\t$_POST = array( 'privacy_action_email_retry' => array( 7101 => 'Retry' ) );
\t\tbreak;
\tcase 'privacy-route:cleanup-expired-pending':
\t\tbreak;
\tcase 'privacy-route:render-export-screen':
\t\t$_REQUEST = array( 'filter-status' => 'request-confirmed', 'orderby' => 'email', 'order' => 'asc' );
\t\t$_GET = $_REQUEST;
\t\tbreak;
\tcase 'privacy-route:render-erase-screen':
\t\t$route = 'erase-personal-data.php';
\t\t$_SERVER['REQUEST_URI'] = '/wp-admin/erase-personal-data.php';
\t\t$_REQUEST = array( 'filter-status' => 'request-pending', 'orderby' => 'created', 'order' => 'desc' );
\t\t$_GET = $_REQUEST;
\t\tbreak;
\tdefault:
\t\tfwrite( STDERR, 'Unknown case: ' . $case . PHP_EOL );
\t\texit( 2 );
}
$_REQUEST = array_merge( $_REQUEST, $_POST );

ob_start();
$exception = null;
try {
\trequire ABSPATH . 'wp-admin/' . $route;
} catch ( Wphx_Wp_Die $e ) {
\t$exception = $e->payload;
}
$output = ob_get_clean();

function wphx_contains( $haystack, $needle ) {
\treturn false !== strpos( $haystack, $needle );
}

$observation = array(
\t'case' => $case,
\t'route' => $route,
\t'exception' => $exception,
\t'output_sha256' => 'sha256:' . hash( 'sha256', $output ),
\t'output_flags' => array(
\t\t'has_admin_header' => wphx_contains( $output, 'admin-header' ),
\t\t'has_admin_footer' => wphx_contains( $output, 'admin-footer' ),
\t\t'has_export_heading' => wphx_contains( $output, '<h1>Export Personal Data</h1>' ),
\t\t'has_erase_heading' => wphx_contains( $output, '<h1>Erase Personal Data</h1>' ),
\t\t'has_add_export_form' => wphx_contains( $output, 'add_export_personal_data_request' ),
\t\t'has_add_erase_form' => wphx_contains( $output, 'add_remove_personal_data_request' ),
\t\t'has_confirmation_checkbox' => wphx_contains( $output, 'send_confirmation_email' ),
\t\t'has_privacy_nonce' => wphx_contains( $output, 'nonce-personal-data-request' ),
\t\t'has_search_box' => wphx_contains( $output, 'requests-search-input' ),
\t\t'has_list_table' => wphx_contains( $output, 'wp-list-table privacy-requests' ),
\t\t'has_privacy_embed_script' => wphx_contains( $output, 'privacy-tools-embed' ),
\t),
\t'nonce_checks' => $GLOBALS['wphx_nonce_checks'],
\t'screen_options' => $GLOBALS['wphx_screen_options'],
\t'enqueued_scripts' => $GLOBALS['wphx_enqueued_scripts'],
\t'settings_errors' => $GLOBALS['wphx_settings_errors'],
\t'created_requests' => $GLOBALS['wphx_created_requests'],
\t'sent_requests' => $GLOBALS['wphx_sent_requests'],
\t'updated_posts' => $GLOBALS['wphx_updated_posts'],
\t'updated_meta' => $GLOBALS['wphx_updated_meta'],
\t'queries' => $GLOBALS['wphx_queries'],
\t'actions' => $GLOBALS['wphx_actions'],
\t'filters' => $GLOBALS['wphx_filters'],
);

echo json_encode( $observation, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL;
`
  );
}

function prepareRoots() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe();
}

function runProbe(root, caseId) {
  return JSON.parse(command("php", [PROBE, root, caseId]));
}

function observationsFor(root) {
  return CASES.map((testCase) => runProbe(root, testCase.id));
}

function stable(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function writeJson(path, value) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  if (checkOnly) {
    if (!existsSync(path)) {
      throw new Error(`Missing ${path}`);
    }
    const current = readFileSync(path, "utf8");
    if (current !== body) {
      throw new Error(`${path} is stale; run ${RUNNER}`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

function main() {
  prepareRoots();

  const oracle = observationsFor(ORACLE_ROOT);
  const candidate = observationsFor(CANDIDATE_ROOT);
  const oracleCandidateMatch = sha256(stable(oracle)) === sha256(stable(candidate));
  if (!oracleCandidateMatch) {
    throw new Error("oracle/candidate observations differ");
  }

  const manifest = {
    schema_version: 1,
    issue: ISSUE.external_ref,
    beads_issue: ISSUE.id,
    title: ISSUE.title,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    check_command: `node ${RUNNER} --check`,
    upstream: {
      checkout: UPSTREAM_ROOT,
      authority: "WordPress 7.0 oracle checkout",
      read_only: true
    },
    claims: {
      targeted_copied_oracle_behavior_claimed: true,
      copied_privacy_helper_executed: true,
      copied_route_files_executed: true,
      deterministic_list_table_stub_used: true,
      behavior_parity_claimed: false,
      public_php_replacement_claimed: false,
      haxe_owned_privacy_route_runtime_claimed: false,
      installed_wordpress_route_execution_claimed: false,
      database_backed_state_claimed: false,
      browser_or_editor_behavior_claimed: false,
      upstream_phpunit_pass_claimed: false,
      generated_original_path_adapter_claimed: false
    },
    source_files: SOURCE_FILES.map(sourceRecord),
    support_stubs: SUPPORT_STUBS.map((path) => inputRecord(`${ORACLE_ROOT}/${path}`)),
    covered_symbols: COVERED_SYMBOLS,
    fixture_cases: CASES,
    observations: {
      oracle,
      candidate,
      oracle_sha256: sha256(stable(oracle)),
      candidate_sha256: sha256(stable(candidate)),
      oracle_candidate_match: oracleCandidateMatch
    },
    cross_domain_handoffs: [
      {
        owner: "WPHX-312",
        evidence: [PRIVACY_STATE_FIXTURE, PRIVACY_MAIL_FIXTURE],
        reason: "Privacy request object state, mail sending, export/erase internals, and durable privacy helper ownership remain WPHX-312 boundaries."
      },
      {
        owner: "WPHX-315",
        reason: "Admin chrome, current screen, notices, screen options, nonce fields, and list-table primitives are deterministic stubs here and remain WPHX-315 boundaries."
      },
      {
        owner: "WPHX-306",
        reason: "Real capability, session, nonce, and current-user behavior remain WPHX-306 boundaries."
      }
    ],
    non_claims: [
      "No generated public PHP replacement for export-personal-data.php, erase-personal-data.php, or includes/privacy-tools.php.",
      "No Haxe-owned privacy route runtime or privacy request storage/mail implementation.",
      "No installed WordPress bootstrap, admin browser, database-backed request state, or upstream PHPUnit pass/pass parity.",
      "No ownership of WP_Privacy_Requests_Table or specialized privacy list-table rendering; deterministic list-table stubs only stabilize route observations.",
      "No generated original-path adapter or durable public PHP implementation artifact."
    ]
  };

  const ownership = {
    schema_version: 1,
    issue: ISSUE.external_ref,
    beads_issue: ISSUE.id,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    emission_strategy: "copied_upstream_public_php_with_deterministic_privacy_route_stubs",
    owned_runtime_logic: false,
    copied_upstream_public_php: true,
    public_php_replacement_claimed: false,
    durable_original_path_adapter_claimed: false,
    whole_file_owned: false,
    generated_overlay_manifest: null,
    generated_overlay_paths: [],
    unexpected_candidate_package_differences: [],
    files: SOURCE_FILES.map((path) => ({
      path: path.replace(/^src\//, ""),
      source: "copied_upstream_php",
      upstream_sha256: sha256File(upstreamPath(path)),
      candidate_sha256: sha256File(mirrorPath(CANDIDATE_ROOT, path)),
      oracle_sha256: sha256File(mirrorPath(ORACLE_ROOT, path)),
      ownership_state: "copied_oracle_fixture_input",
      non_claim: "not Haxe-owned source, not generated public PHP, not installed route parity"
    })),
    stub_files: SUPPORT_STUBS.map((path) => ({
      path,
      sha256: sha256File(`${CANDIDATE_ROOT}/${path}`),
      ownership_state: "deterministic_test_harness_stub",
      non_claim: "not production runtime code"
    })),
    cross_domain_handoffs: manifest.cross_domain_handoffs,
    removal_gate: "Replace copied privacy route/helper evidence with generated original-path adapters, typed route/list-table/request contracts, installed admin route execution, database-backed privacy request state, selected upstream PHPUnit pass/pass, and browser/e2e gates before making public PHP or installed parity claims."
  };

  const receipt = {
    schema_version: 1,
    issue: ISSUE.external_ref,
    beads_issue: ISSUE.id,
    title: ISSUE.title,
    generated_at: RECORDED_AT,
    status: "passed",
    generator: RUNNER,
    evidence: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      surface_manifest: SURFACE,
      adapter_contract_manifest: CONTRACT,
      privacy_state_fixture: PRIVACY_STATE_FIXTURE,
      privacy_mail_fixture: PRIVACY_MAIL_FIXTURE
    },
    summary:
      "Regenerated oracle and candidate roots copy WordPress 7.0 privacy export/erase route files plus includes/privacy-tools.php, execute 8 deterministic route/action/render observations through privacy request/list-table/bootstrap stubs, and match oracle/candidate output.",
    checks: [
      `node ${RUNNER}`,
      `node ${RUNNER} --check`,
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    non_claims: manifest.non_claims
  };

  writeJson(OUT, manifest);
  writeJson(OWNERSHIP, ownership);
  writeJson(RECEIPT, receipt);

  console.log(
    JSON.stringify(
      {
        status: "passed",
        observation_count: oracle.length,
        source_file_count: SOURCE_FILES.length,
        covered_symbol_count: COVERED_SYMBOLS.length,
        oracle_candidate_match: oracleCandidateMatch
      },
      null,
      2
    )
  );
}

main();
