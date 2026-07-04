#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.22.1",
  external_ref: "WPHX-316.09",
  title: "WPHX-316.09 - Add plugin management route oracle fixture"
};
const RECORDED_AT = "2026-07-04T08:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-plugin-management-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-316-09";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-316-09-plugin-management-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-316-09-plugin-management-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-316-09-plugin-management-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-316-01-admin-feature-ajax-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-316-02-admin-feature-ajax-adapter-contract-candidate.v1.json";
const AJAX_FIXTURE = "manifests/wp-core/wphx-316-03-admin-ajax-post-oracle-fixture.v1.json";
const UPSTREAM_RATCHETS = "manifests/wp-core/wphx-316-07-admin-feature-ajax-upstream-ratchets.v1.json";
const E2E_GATES = "manifests/wp-core/wphx-316-08-admin-feature-ajax-installed-e2e-gates.v1.json";

const SOURCE_FILES = ["src/wp-admin/plugins.php"];
const SUPPORT_STUBS = ["wp-admin/admin.php", "wp-admin/admin-header.php", "wp-admin/admin-footer.php", "wp-admin/update.php"];
const COVERED_SYMBOLS = [
  "wp-admin/plugins.php",
  "WP_Plugins_List_Table::current_action",
  "WP_Plugins_List_Table::prepare_items",
  "WP_Plugins_List_Table::display",
  "activate_plugin",
  "activate_plugins",
  "deactivate_plugins",
  "delete_plugins",
  "WP_Plugin_Dependencies::initialize",
  "WP_Plugin_Dependencies::display_admin_notice_for_unmet_dependencies",
  "check_admin_referer",
  "current_user_can",
  "wp_admin_notice",
  "wp_enqueue_script",
  "add_screen_option",
  "handle_bulk_actions-{$screen}"
];
const CASES = [
  { id: "plugins:capability-denied", focus: "plugins.php rejects users without activate_plugins before list-table preparation" },
  { id: "plugins:activate-single", focus: "single plugin activation checks nonce, calls activate_plugin, clears recently_activated, and redirects" },
  { id: "plugins:activate-selected", focus: "bulk activation filters already-active entries, activates eligible plugins, and redirects" },
  { id: "plugins:deactivate-single", focus: "single plugin deactivation checks nonce, records recently_activated, and redirects" },
  { id: "plugins:delete-confirm", focus: "delete-selected without verify-delete renders confirmation markup through copied plugins.php" },
  { id: "plugins:delete-verified", focus: "verified delete-selected calls delete_plugins, stores result, and redirects" },
  { id: "plugins:render-list", focus: "default route prepares plugin list-table, help tabs, notices, and screen fragments" }
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
\tpublic function __construct( $payload ) { parent::__construct( 'wp_die' ); $this->payload = $payload; }
}

class WP_Error {
\tprivate $code;
\tprivate $message;
\tprivate $data;
\tpublic function __construct( $code = '', $message = '', $data = null ) { $this->code = $code; $this->message = $message; $this->data = $data; }
\tpublic function get_error_code() { return $this->code; }
\tpublic function get_error_message() { return $this->message; }
\tpublic function get_error_data() { return $this->data; }
}

class Wphx_Screen {
\tpublic $id = 'plugins';
\tpublic $help_tabs = array();
\tpublic $reader_content = array();
\tpublic $sidebar = '';
\tpublic function add_help_tab( $args ) { $this->help_tabs[] = $args['id'] ?? ''; }
\tpublic function set_help_sidebar( $content ) { $this->sidebar = $content; }
\tpublic function set_screen_reader_content( $content ) { $this->reader_content = $content; }
}

class Wphx_Plugins_List_Table {
\tpublic $screen;
\tprivate $action;
\tpublic $items = array();
\tpublic function __construct() {
\t\t$this->screen = get_current_screen();
\t\t$this->action = $_REQUEST['action'] ?? '';
\t\tif ( '-1' === $this->action || '' === $this->action ) $this->action = $_REQUEST['action2'] ?? '';
\t\t$this->items = array_keys( get_plugins() );
\t}
\tpublic function get_pagenum() { return isset( $_REQUEST['paged'] ) ? max( 1, (int) $_REQUEST['paged'] ) : 1; }
\tpublic function current_action() { return $this->action; }
\tpublic function prepare_items() {
\t\t$GLOBALS['wphx_actions'][] = array( 'hook' => 'plugins_table_prepare_items' );
\t\t$GLOBALS['plugins'] = array( 'all' => get_plugins() );
\t}
\tpublic function get_pagination_arg( $key ) { return 'total_pages' === $key ? 1 : null; }
\tpublic function views() { echo '<ul class="subsubsub"><li class="all">All</li><li class="active">Active</li></ul>'; }
\tpublic function search_box( $text, $input_id ) { echo '<input class="search-box" id="' . esc_attr( $input_id ) . '-search-input" value="' . esc_attr( $text ) . '" />'; }
\tpublic function display() { echo '<table class="wp-list-table plugins"><tr><td>Fixture Plugin Row</td></tr></table>'; }
}

class WP_Plugin_Dependencies {
\tpublic static function initialize() { $GLOBALS['wphx_actions'][] = array( 'hook' => 'plugin_dependencies_initialize' ); }
\tpublic static function display_admin_notice_for_unmet_dependencies() { echo '<div class="notice unmet-dependencies">deps-ok</div>'; }
\tpublic static function display_admin_notice_for_circular_dependencies() { echo '<div class="notice circular-dependencies">cycles-ok</div>'; }
}

$GLOBALS['wphx_actions'] = $GLOBALS['wphx_actions'] ?? array();
$GLOBALS['wphx_filters'] = $GLOBALS['wphx_filters'] ?? array();
$GLOBALS['wphx_redirects'] = $GLOBALS['wphx_redirects'] ?? array();
$GLOBALS['wphx_safe_redirects'] = $GLOBALS['wphx_safe_redirects'] ?? array();
$GLOBALS['wphx_nonce_checks'] = $GLOBALS['wphx_nonce_checks'] ?? array();
$GLOBALS['wphx_updated_options'] = $GLOBALS['wphx_updated_options'] ?? array();
$GLOBALS['wphx_updated_site_options'] = $GLOBALS['wphx_updated_site_options'] ?? array();
$GLOBALS['wphx_deleted_options'] = $GLOBALS['wphx_deleted_options'] ?? array();
$GLOBALS['wphx_activated_plugins'] = $GLOBALS['wphx_activated_plugins'] ?? array();
$GLOBALS['wphx_activated_plugin_batches'] = $GLOBALS['wphx_activated_plugin_batches'] ?? array();
$GLOBALS['wphx_deactivated_plugins'] = $GLOBALS['wphx_deactivated_plugins'] ?? array();
$GLOBALS['wphx_deleted_plugins'] = $GLOBALS['wphx_deleted_plugins'] ?? array();
$GLOBALS['wphx_enqueued_scripts'] = $GLOBALS['wphx_enqueued_scripts'] ?? array();
$GLOBALS['wphx_screen_options'] = $GLOBALS['wphx_screen_options'] ?? array();
$GLOBALS['wphx_caps'] = $GLOBALS['wphx_caps'] ?? array();
$GLOBALS['current_screen'] = null;
$GLOBALS['status'] = $_REQUEST['plugin_status'] ?? 'all';
$GLOBALS['page'] = isset( $_REQUEST['paged'] ) ? (int) $_REQUEST['paged'] : 1;
$GLOBALS['user_ID'] = 42;

if ( ! defined( 'WP_PLUGIN_DIR' ) ) define( 'WP_PLUGIN_DIR', ABSPATH . 'wp-content/plugins' );
if ( ! defined( 'WP_DEBUG' ) ) define( 'WP_DEBUG', false );

function __( $text, $domain = 'default' ) { return $text; }
function _e( $text, $domain = 'default' ) { echo $text; }
function _n( $single, $plural, $number, $domain = 'default' ) { return 1 === (int) $number ? $single : $plural; }
function _x( $text, $context, $domain = 'default' ) { return $text; }
function esc_attr( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function esc_html( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function esc_html__( $text, $domain = 'default' ) { return esc_html( $text ); }
function esc_url( $url ) { return (string) $url; }
function wp_unslash( $value ) { return is_array( $value ) ? array_map( 'wp_unslash', $value ) : stripslashes( (string) $value ); }
function wp_strip_all_tags( $text ) { return strip_tags( (string) $text ); }

function current_user_can( $capability, ...$args ) {
\t$key = $capability . ( isset( $args[0] ) ? ':' . $args[0] : '' );
\tif ( array_key_exists( $key, $GLOBALS['wphx_caps'] ) ) return $GLOBALS['wphx_caps'][ $key ];
\treturn $GLOBALS['wphx_caps'][ $capability ] ?? true;
}
function is_multisite() { return false; }
function is_network_admin() { return false; }
function is_network_only_plugin( $plugin ) { return false; }
function is_plugin_active_for_network( $plugin ) { return false; }
function is_plugin_active( $plugin ) { return in_array( $plugin, array( 'active/active.php', 'sample/sample.php' ), true ); }
function is_plugin_inactive( $plugin ) { return ! is_plugin_active( $plugin ); }
function validate_file( $file ) { return str_contains( (string) $file, '..' ) ? 1 : 0; }
function is_wp_error( $value ) { return $value instanceof WP_Error; }

function get_plugins( $plugin_folder = '' ) {
\t$plugins = array(
\t\t'active/active.php' => array( 'Name' => 'Active Fixture', 'AuthorName' => 'Core', 'Network' => false ),
\t\t'sample/sample.php' => array( 'Name' => 'Sample Fixture', 'AuthorName' => 'Core', 'Network' => false ),
\t\t'inactive/inactive.php' => array( 'Name' => 'Inactive Fixture', 'AuthorName' => 'Core', 'Network' => false ),
\t);
\tif ( '/inactive' === $plugin_folder ) return array( 'inactive/inactive.php' => $plugins['inactive/inactive.php'] );
\treturn $plugins;
}
function get_plugin_data( $plugin_file ) { return array( 'Name' => 'Inactive Fixture', 'AuthorName' => 'Core', 'Network' => false ); }
function _get_plugin_data_markup_translate( $plugin_file, $data ) { return $data; }
function is_uninstallable_plugin( $plugin ) { return 'inactive/inactive.php' === $plugin; }

function activate_plugin( $plugin, $redirect = '', $network_wide = false ) { $GLOBALS['wphx_activated_plugins'][] = compact( 'plugin', 'redirect', 'network_wide' ); return null; }
function activate_plugins( $plugins, $redirect = '', $network_wide = false ) { $GLOBALS['wphx_activated_plugin_batches'][] = array( 'plugins' => array_values( $plugins ), 'redirect' => $redirect, 'network_wide' => $network_wide ); return null; }
function deactivate_plugins( $plugins, $silent = false, $network_wide = false ) { $GLOBALS['wphx_deactivated_plugins'][] = array( 'plugins' => array_values( (array) $plugins ), 'silent' => $silent, 'network_wide' => $network_wide ); }
function delete_plugins( $plugins ) { $GLOBALS['wphx_deleted_plugins'][] = array_values( (array) $plugins ); return true; }
function validate_plugin( $plugin ) { return true; }
function plugin_sandbox_scrape( $plugin ) { $GLOBALS['wphx_actions'][] = array( 'hook' => 'plugin_sandbox_scrape', 'plugin' => $plugin ); }
function resume_plugin( $plugin, $redirect = '' ) { return true; }
function validate_active_plugins() { return array(); }

function get_option( $name, $default = false ) {
\t$values = array(
\t\t'recently_activated' => array( 'sample/sample.php' => 1000, 'old/old.php' => 999 ),
\t\t'plugins_delete_result_42' => true,
\t);
\treturn array_key_exists( $name, $values ) ? $values[ $name ] : $default;
}
function update_option( $name, $value, $autoload = null ) { $GLOBALS['wphx_updated_options'][] = compact( 'name', 'value', 'autoload' ); return true; }
function delete_option( $name ) { $GLOBALS['wphx_deleted_options'][] = $name; return true; }
function get_site_option( $name, $default = false ) { return 'auto_update_plugins' === $name ? array( 'sample/sample.php' ) : $default; }
function update_site_option( $name, $value ) { $GLOBALS['wphx_updated_site_options'][] = compact( 'name', 'value' ); return true; }

function check_admin_referer( $action = -1, $query_arg = '_wpnonce' ) { $GLOBALS['wphx_nonce_checks'][] = compact( 'action', 'query_arg' ); return 1; }
function wp_create_nonce( $action = -1 ) { return 'nonce-' . $action; }
function wp_verify_nonce( $nonce, $action = -1 ) { return true; }
function wp_die( $message = '', $title = '', $args = array() ) {
\t$response = is_int( $title ) ? $title : ( is_array( $args ) && isset( $args['response'] ) ? $args['response'] : null );
\tif ( $message instanceof WP_Error ) $message = $message->get_error_message();
\tthrow new Wphx_Wp_Die( array( 'kind' => 'wp_die', 'message' => wp_strip_all_tags( (string) $message ), 'response' => $response ) );
}
function wp_redirect( $location, $status = 302 ) { $GLOBALS['wphx_redirects'][] = compact( 'location', 'status' ); return true; }
function wp_safe_redirect( $location, $status = 302 ) { $GLOBALS['wphx_safe_redirects'][] = compact( 'location', 'status' ); return true; }
function self_admin_url( $path = '', $scheme = 'admin' ) { return 'https://example.test/wp-admin/' . ltrim( (string) $path, '/' ); }
function admin_url( $path = '', $scheme = 'admin' ) { return self_admin_url( $path, $scheme ); }
function network_admin_url( $path = '', $scheme = 'admin' ) { return 'https://example.test/wp-admin/network/' . ltrim( (string) $path, '/' ); }
function wp_get_referer() { return 'https://example.test/wp-admin/plugins.php?plugin_status=all'; }
function remove_query_arg( $keys, $url = null ) {
\t$url = $url ?? ( $_SERVER['REQUEST_URI'] ?? '' );
\t$parts = parse_url( $url );
\tparse_str( $parts['query'] ?? '', $query );
\tforeach ( (array) $keys as $key ) unset( $query[ $key ] );
\t$path = $parts['path'] ?? '';
\treturn $path . ( $query ? '?' . http_build_query( $query ) : '' );
}
function add_query_arg( $key, $value = null, $url = null ) {
\tif ( is_array( $key ) ) {
\t\t$result = $url ?? ( $_SERVER['REQUEST_URI'] ?? '' );
\t\tforeach ( $key as $k => $v ) $result = add_query_arg( $k, $v, $result );
\t\treturn $result;
\t}
\t$url = $url ?? ( $_SERVER['REQUEST_URI'] ?? '' );
\treturn $url . ( str_contains( $url, '?' ) ? '&' : '?' ) . rawurlencode( $key ) . '=' . rawurlencode( (string) $value );
}
function wp_nonce_url( $url, $action = -1, $name = '_wpnonce' ) { return add_query_arg( $name, wp_create_nonce( $action ), $url ); }

function _get_list_table( $class, $args = array() ) { return new Wphx_Plugins_List_Table(); }
function get_current_screen() { if ( ! $GLOBALS['current_screen'] ) $GLOBALS['current_screen'] = new Wphx_Screen(); return $GLOBALS['current_screen']; }
function wp_enqueue_script( $handle ) { $GLOBALS['wphx_enqueued_scripts'][] = $handle; }
function add_thickbox() { $GLOBALS['wphx_actions'][] = array( 'hook' => 'add_thickbox' ); }
function add_screen_option( $option, $args = array() ) { $GLOBALS['wphx_screen_options'][] = compact( 'option', 'args' ); }
function wp_admin_notice( $message, $args = array() ) { echo '<div id="' . esc_attr( $args['id'] ?? '' ) . '" class="notice ' . esc_attr( implode( ' ', $args['additional_classes'] ?? array() ) ) . '">' . $message . '</div>'; }
function wp_nonce_field( $action ) { echo '<input type="hidden" name="_wpnonce" value="nonce-' . esc_attr( $action ) . '" />'; }
function submit_button( $text, $type = 'primary', $name = 'submit', $wrap = true ) { echo '<button type="submit" name="' . esc_attr( $name ) . '">' . esc_html( $text ) . '</button>'; }
function wp_print_request_filesystem_credentials_modal() { echo '<div id="request-filesystem-credentials-dialog">fs-modal</div>'; }
function wp_print_admin_notice_templates() { echo '<script id="tmpl-wp-updates-admin-notice">notice-template</script>'; }
function wp_print_update_row_templates() { echo '<script id="tmpl-item-update-row">update-row-template</script>'; }
function wp_is_auto_update_enabled_for_type( $type ) { return true; }

function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_filters'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) + 1 );
\tif ( 'handle_bulk_actions-plugins' === $hook_name ) return 'plugins.php?handled=' . rawurlencode( (string) ( $args[0] ?? '' ) );
\tif ( 'all_plugins' === $hook_name ) return $value;
\treturn $value;
}
function do_action( $hook_name, ...$args ) { $GLOBALS['wphx_actions'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) ); }
`
  );

  writeStub(`${root}/wp-admin/admin-header.php`, "<?php echo '<header id=\"wpadminbar\">admin-header</header>'; ?>\n");
  writeStub(`${root}/wp-admin/admin-footer.php`, "<?php echo '<footer id=\"wpfooter\">admin-footer</footer>'; ?>\n");
  writeStub(`${root}/wp-admin/update.php`, "<?php echo '<div id=\"update-php-stub\">update-stub</div>'; ?>\n");
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
$_SERVER['REQUEST_URI'] = '/wp-admin/plugins.php?plugin_status=all&paged=1&s=';

function wphx_prepare_case( $case ) {
\tswitch ( $case ) {
\t\tcase 'plugins:capability-denied':
\t\t\t$GLOBALS['wphx_caps'] = array( 'activate_plugins' => false );
\t\t\tbreak;
\t\tcase 'plugins:activate-single':
\t\t\t$_GET = array( 'action' => 'activate', 'plugin' => 'inactive/inactive.php', 'plugin_status' => 'all', 'paged' => '1', 's' => '' );
\t\t\t$_REQUEST = $_GET;
\t\t\tbreak;
\t\tcase 'plugins:activate-selected':
\t\t\t$_SERVER['REQUEST_METHOD'] = 'POST';
\t\t\t$_POST = array( 'action' => 'activate-selected', 'checked' => array( 'active/active.php', 'inactive/inactive.php' ), 'plugin_status' => 'all', 'paged' => '1', 's' => '' );
\t\t\t$_REQUEST = $_POST;
\t\t\tbreak;
\t\tcase 'plugins:deactivate-single':
\t\t\t$_GET = array( 'action' => 'deactivate', 'plugin' => 'sample/sample.php', 'plugin_status' => 'all', 'paged' => '1', 's' => '' );
\t\t\t$_REQUEST = $_GET;
\t\t\tbreak;
\t\tcase 'plugins:delete-confirm':
\t\t\t$_REQUEST = array( 'action' => 'delete-selected', 'checked' => array( 'inactive/inactive.php' ), 'plugin_status' => 'all', 'paged' => '1', 's' => '' );
\t\t\t$_POST = $_REQUEST;
\t\t\tbreak;
\t\tcase 'plugins:delete-verified':
\t\t\t$_REQUEST = array( 'action' => 'delete-selected', 'verify-delete' => '1', 'checked' => array( 'inactive/inactive.php' ), 'plugin_status' => 'all', 'paged' => '1', 's' => '' );
\t\t\t$_POST = $_REQUEST;
\t\t\tbreak;
\t\tcase 'plugins:render-list':
\t\t\t$_GET = array( 'plugin_status' => 'all', 'paged' => '1', 's' => 'fixture', 'activate' => 'true' );
\t\t\t$_REQUEST = $_GET;
\t\t\t$_SERVER['REQUEST_URI'] = '/wp-admin/plugins.php?plugin_status=all&paged=1&s=fixture&activate=true';
\t\t\tbreak;
\t\tdefault:
\t\t\tfwrite( STDERR, 'Unknown case: ' . $case . PHP_EOL );
\t\t\texit( 2 );
\t}
}

function wphx_option_map( $records ) {
\t$mapped = array();
\tforeach ( $records as $record ) {
\t\tif ( 'recently_activated' === $record['name'] && is_array( $record['value'] ) ) {
\t\t\t$mapped[ $record['name'] ] = array_keys( $record['value'] );
\t\t\tcontinue;
\t\t}
\t\t$mapped[ $record['name'] ] = $record['value'];
\t}
\treturn $mapped;
}

function wphx_emit_result() {
\tglobal $case, $emitted, $exception_payload, $completed;
\tif ( $emitted ) return;
\t$emitted = true;
\t$output = '';
\twhile ( ob_get_level() > 0 ) $output = ob_get_clean() . $output;
\t$screen = $GLOBALS['current_screen'] ?? null;
\techo json_encode(
\t\tarray(
\t\t\t'case' => $case,
\t\t\t'completed' => $completed,
\t\t\t'exception' => $exception_payload,
\t\t\t'redirects' => $GLOBALS['wphx_redirects'] ?? array(),
\t\t\t'safe_redirects' => $GLOBALS['wphx_safe_redirects'] ?? array(),
\t\t\t'nonce_checks' => $GLOBALS['wphx_nonce_checks'] ?? array(),
\t\t\t'activated_plugins' => $GLOBALS['wphx_activated_plugins'] ?? array(),
\t\t\t'activated_plugin_batches' => $GLOBALS['wphx_activated_plugin_batches'] ?? array(),
\t\t\t'deactivated_plugins' => $GLOBALS['wphx_deactivated_plugins'] ?? array(),
\t\t\t'deleted_plugins' => $GLOBALS['wphx_deleted_plugins'] ?? array(),
\t\t\t'updated_options' => wphx_option_map( $GLOBALS['wphx_updated_options'] ?? array() ),
\t\t\t'deleted_options' => $GLOBALS['wphx_deleted_options'] ?? array(),
\t\t\t'enqueued_scripts' => $GLOBALS['wphx_enqueued_scripts'] ?? array(),
\t\t\t'screen_options' => $GLOBALS['wphx_screen_options'] ?? array(),
\t\t\t'help_tabs' => $screen ? $screen->help_tabs : array(),
\t\t\t'actions' => array_values( array_map( fn( $entry ) => $entry['hook'] ?? '', $GLOBALS['wphx_actions'] ?? array() ) ),
\t\t\t'filters' => array_values( array_map( fn( $entry ) => $entry['hook'] ?? '', $GLOBALS['wphx_filters'] ?? array() ) ),
\t\t\t'output_contains' => array(
\t\t\t\t'plugins_heading' => str_contains( $output, 'Plugins' ),
\t\t\t\t'add_plugin_action' => str_contains( $output, 'Add Plugin' ),
\t\t\t\t'plugin_activated_notice' => str_contains( $output, 'Plugin activated.' ),
\t\t\t\t'delete_confirmation' => str_contains( $output, 'You are about to remove the following plugin' ),
\t\t\t\t'delete_data_warning' => str_contains( $output, 'delete its data' ),
\t\t\t\t'yes_delete_button' => str_contains( $output, 'Yes, delete these files and data' ),
\t\t\t\t'list_table' => str_contains( $output, 'wp-list-table plugins' ),
\t\t\t\t'search_box' => str_contains( $output, 'plugin-search-input' ),
\t\t\t\t'filesystem_modal' => str_contains( $output, 'request-filesystem-credentials-dialog' ),
\t\t\t\t'update_row_template' => str_contains( $output, 'tmpl-item-update-row' ),
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
\trequire $root . '/wp-admin/plugins.php';
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
      throw new Error(`${path} is stale; run npm run wp:core:wphx-316-plugin-management-oracle-fixture`);
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
    manifest_id: "ownership:wp-core/plugin-management-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "copied_oracle_fixture",
      name: "plugin management route fixture",
      area: "wp-admin/plugins.php plugin activation/deactivation/delete/list rendering route branches",
      public_contract:
        "This slice executes copied upstream WordPress plugins.php under deterministic stubs for oracle/candidate behavior observations. It does not claim generated public PHP replacement, plugin filesystem behavior, installed admin parity, or Haxe-owned route execution."
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
        "Replace copied public PHP with generated original-path adapters and pass plugin activation/deactivation/delete/list rendering, plugin filesystem/delete/update internals, list-table, nonce/capability, database-backed installed admin, upstream PHPUnit/e2e, and ecosystem plugin gates before claiming public PHP ownership or installed admin parity."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    copied_upstream_inputs: SOURCE_FILES,
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-316-plugin-management-oracle-fixture",
        "npm run wp:core:wphx-316-plugin-management-oracle-fixture:check",
        "npm run operations:bridge-claim-guardrails:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-316-09-plugin-management-oracle-fixture"],
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
  schema: "wphx.wp-core-plugin-management-oracle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["copied_oracle_fixture", "targeted_behavior_observation"],
  artifact_scope: "bridge_fixture",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT),
    ajax_fixture_manifest: inputRecord(AJAX_FIXTURE),
    upstream_ratchets_manifest: inputRecord(UPSTREAM_RATCHETS),
    installed_e2e_gates_manifest: inputRecord(E2E_GATES),
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
    plugin_filesystem_behavior_claimed: false,
    database_backed_state_claimed: false,
    browser_editor_behavior_claimed: false,
    generated_original_path_adapter_claimed: false,
    generated_candidate_overlay_claimed: false
  },
  non_claims: [
    "Does not claim generated replacement for wp-admin/plugins.php or plugin-management route files.",
    "Does not execute WordPress bootstrap, real plugin files, plugin update/delete filesystem behavior, a real database, real users/sessions, real nonces, real headers, browser/editor behavior, or installed admin routes.",
    "Does not claim broad plugin-management parity, upstream PHPUnit pass/pass parity beyond WPHX-316.07, public PHP ABI ownership, or durable original-path adapter ownership."
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
  id: "receipt:wphx-316-09-plugin-management-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "plugin-management copied-oracle fixture manifest" },
    { path: OWNERSHIP, role: "plugin-management copied-oracle fixture ownership manifest" },
    { path: RUNNER, role: "deterministic copied-oracle generator/check runner" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-316-plugin-management-oracle-fixture",
    "npm run wp:core:wphx-316-plugin-management-oracle-fixture:check",
    "npm run operations:bridge-claim-guardrails:check"
  ],
  validation_result: manifest.validation_result,
  manifest_sha256: sha256(manifestText),
  ownership_sha256: sha256(ownershipText),
  related_receipts: [
    "receipt:wphx-316-01-admin-feature-ajax-surface",
    "receipt:wphx-316-02-admin-feature-ajax-adapter-contract-candidate",
    "receipt:wphx-316-03-admin-ajax-post-oracle-fixture",
    "receipt:wphx-316-07-admin-feature-ajax-upstream-ratchets",
    "receipt:wphx-316-08-admin-feature-ajax-installed-e2e-gates"
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
