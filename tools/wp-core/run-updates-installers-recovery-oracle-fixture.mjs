#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-2fc1",
  external_ref: "WPHX-319.03",
  title: "WPHX-319.03 - Add updates installers recovery copied-oracle fixture"
};
const RECORDED_AT = "2026-07-04T19:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-updates-installers-recovery-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-319-03";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-319-03-updates-installers-recovery-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-319-03-updates-installers-recovery-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-319-03-updates-installers-recovery-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-319-01-updates-installers-recovery-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-319-02-updates-installers-recovery-adapter-contract-candidate.v1.json";

const SOURCE_FILES = [
  "src/wp-admin/includes/class-wp-upgrader-skin.php",
  "src/wp-admin/includes/class-automatic-upgrader-skin.php",
  "src/wp-admin/includes/class-wp-ajax-upgrader-skin.php",
  "src/wp-admin/includes/class-bulk-upgrader-skin.php",
  "src/wp-admin/includes/class-plugin-upgrader-skin.php",
  "src/wp-admin/includes/class-plugin-installer-skin.php",
  "src/wp-includes/class-wp-recovery-mode-cookie-service.php",
  "src/wp-includes/class-wp-recovery-mode-key-service.php",
  "src/wp-includes/class-wp-recovery-mode-link-service.php"
];
const COVERED_SYMBOLS = [
  "WP_Upgrader_Skin::__construct",
  "WP_Upgrader_Skin::set_upgrader",
  "WP_Upgrader_Skin::request_filesystem_credentials",
  "WP_Upgrader_Skin::header",
  "WP_Upgrader_Skin::footer",
  "WP_Upgrader_Skin::error",
  "WP_Upgrader_Skin::feedback",
  "Automatic_Upgrader_Skin::feedback",
  "Automatic_Upgrader_Skin::header",
  "Automatic_Upgrader_Skin::footer",
  "WP_Ajax_Upgrader_Skin::error",
  "WP_Ajax_Upgrader_Skin::get_error_messages",
  "Bulk_Upgrader_Skin::add_strings",
  "Bulk_Upgrader_Skin::feedback",
  "Bulk_Upgrader_Skin::error",
  "Bulk_Upgrader_Skin::bulk_header",
  "Plugin_Upgrader_Skin::__construct",
  "Plugin_Upgrader_Skin::after",
  "Plugin_Installer_Skin::before",
  "Plugin_Installer_Skin::hide_process_failed",
  "WP_Recovery_Mode_Cookie_Service::validate_cookie",
  "WP_Recovery_Mode_Cookie_Service::get_session_id_from_cookie",
  "WP_Recovery_Mode_Key_Service::generate_recovery_mode_token",
  "WP_Recovery_Mode_Key_Service::generate_and_store_recovery_mode_key",
  "WP_Recovery_Mode_Key_Service::validate_recovery_mode_key",
  "WP_Recovery_Mode_Key_Service::clean_expired_keys",
  "WP_Recovery_Mode_Link_Service::generate_url"
];
const CASES = [
  { id: "upgrader:base-skin", focus: "base WP_Upgrader_Skin option merging, credential request URL shaping, header/footer idempotence, feedback, and WP_Error output" },
  { id: "upgrader:automatic-ajax", focus: "Automatic_Upgrader_Skin buffered messages plus WP_Ajax_Upgrader_Skin string/WP_Error aggregation" },
  { id: "upgrader:bulk-skin", focus: "Bulk_Upgrader_Skin string setup, loop feedback, error aggregation, and bulk header output" },
  { id: "upgrader:plugin-skins", focus: "Plugin_Upgrader_Skin active plugin follow-up actions and Plugin_Installer_Skin API success/hidden folder_exists error behavior" },
  { id: "recovery:cookie-service", focus: "recovery cookie validation, invalid/expired/signature-mismatch errors, and session-id extraction" },
  { id: "recovery:key-service", focus: "recovery key token generation, key hashing/storage, one-time validation, mismatch, expiry cleanup, and action hooks" },
  { id: "recovery:link-service", focus: "recovery begin URL generation through key service, add_query_arg, wp_login_url, and recovery_mode_begin_url filter" }
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
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
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
$case = $argv[2] ?? '';

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'WP_DEBUG', false );
define( 'RECOVERY_MODE_COOKIE', 'wordpress_rec_fixture' );
define( 'WEEK_IN_SECONDS', 604800 );
define( 'YEAR_IN_SECONDS', 31536000 );
define( 'COOKIEPATH', '/' );
define( 'SITECOOKIEPATH', '/site/' );
define( 'COOKIE_DOMAIN', '' );
define( 'AUTH_KEY', 'fixture-auth-key' );
define( 'AUTH_SALT', 'fixture-auth-salt' );

$_SERVER['HTTP_HOST'] = 'example.test';
$_SERVER['REQUEST_URI'] = '/wp-admin/update.php?action=upgrade-plugin';

$GLOBALS['wphx_filters'] = array();
$GLOBALS['wphx_actions'] = array();
$GLOBALS['wphx_credentials'] = array();
$GLOBALS['wphx_options'] = array(
\t'recovery_keys' => array(),
);
$GLOBALS['wphx_site_options'] = array();
$GLOBALS['wphx_passwords'] = array( 'token-fixed-0000000001', 'key-fixed-000000000001', 'token-fixed-0000000002', 'key-fixed-000000000002' );

class WP_Error {
\tprivate $errors = array();
\tprivate $data = array();
\tpublic function __construct( $code = '', $message = '', $data = '' ) {
\t\tif ( '' !== $code ) {
\t\t\t$this->add( $code, $message, $data );
\t\t}
\t}
\tpublic function add( $code, $message, $data = '' ) {
\t\t$this->errors[ $code ][] = $message;
\t\tif ( '' !== $data ) {
\t\t\t$this->data[ $code ] = $data;
\t\t}
\t}
\tpublic function get_error_codes() { return array_keys( $this->errors ); }
\tpublic function get_error_code() {
\t\t$codes = $this->get_error_codes();
\t\treturn $codes ? $codes[0] : '';
\t}
\tpublic function get_error_message( $code = '' ) {
\t\tif ( '' === $code ) {
\t\t\t$code = $this->get_error_code();
\t\t}
\t\treturn $this->errors[ $code ][0] ?? '';
\t}
\tpublic function get_error_messages( $code = '' ) {
\t\tif ( '' !== $code ) {
\t\t\treturn $this->errors[ $code ] ?? array();
\t\t}
\t\t$messages = array();
\t\tforeach ( $this->errors as $code_messages ) {
\t\t\t$messages = array_merge( $messages, $code_messages );
\t\t}
\t\treturn $messages;
\t}
\tpublic function get_error_data( $code = '' ) {
\t\tif ( '' === $code ) {
\t\t\t$code = $this->get_error_code();
\t\t}
\t\treturn $this->data[ $code ] ?? null;
\t}
\tpublic function has_errors() { return (bool) $this->errors; }
}

class Wphx_Fake_Upgrader {
\tpublic $strings = array();
\tpublic $update_current = 2;
\tpublic $update_count = 5;
\tpublic function plugin_info() { return 'fixture/fixture.php'; }
}

function __( $text, $domain = 'default' ) { return $text; }
function _x( $text, $context, $domain = 'default' ) { return $text; }
function esc_attr__( $text, $domain = 'default' ) { return esc_attr( $text ); }
function esc_html( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function esc_attr( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function esc_js( $text ) { return addslashes( (string) $text ); }
function wp_kses( $text, $allowed_html = array() ) { return strip_tags( (string) $text, '<a><br><em><strong>' ); }
function wp_parse_args( $args, $defaults = array() ) { return array_merge( $defaults, (array) $args ); }
function is_wp_error( $thing ) { return $thing instanceof WP_Error; }
function wp_ob_end_flush_all() { while ( ob_get_level() > 0 ) { ob_end_flush(); } }
function show_message( $message ) { echo '<p class="message">' . $message . '</p>'; }
function wp_admin_notice( $message, $args = array() ) {
\t$classes = isset( $args['additional_classes'] ) ? implode( ' ', (array) $args['additional_classes'] ) : 'notice';
\techo '<div class="' . esc_attr( $classes ) . '"><p>' . $message . '</p></div>';
}
function request_filesystem_credentials( $url, $method = '', $error = false, $context = '', $extra_fields = array(), $allow_relaxed_file_ownership = false ) {
\t$GLOBALS['wphx_credentials'][] = compact( 'url', 'method', 'context', 'allow_relaxed_file_ownership' );
\treturn ! is_wp_error( $error );
}
function wp_nonce_url( $url, $action = -1 ) {
\t$separator = str_contains( $url, '?' ) ? '&' : '?';
\treturn $url . $separator . '_wpnonce=' . rawurlencode( (string) $action );
}
function admin_url( $path = '', $scheme = 'admin' ) { return 'https://example.test/wp-admin/' . ltrim( (string) $path, '/' ); }
function self_admin_url( $path = '', $scheme = 'admin' ) { return admin_url( $path, $scheme ); }
function current_user_can( $capability, ...$args ) { return 'activate_plugin' === $capability || 'manage_network_plugins' === $capability; }
function is_plugin_active( $plugin ) { return 'fixture/fixture.php' === $plugin; }
function is_plugin_active_for_network( $plugin ) { return false; }
function is_multisite() { return false; }
function wp_unslash( $value ) { return $value; }
function is_ssl() { return false; }
function wp_login_url() { return 'https://example.test/wp-login.php'; }
function wp_redirect( $url ) { $GLOBALS['wphx_redirect'] = $url; }
function wp_die( $message, $title = '' ) { throw new RuntimeException( is_wp_error( $message ) ? $message->get_error_code() : (string) $message ); }
function add_query_arg( $key, $value = null, $url = null ) {
\tif ( is_array( $key ) ) {
\t\t$args = $key;
\t\t$url = $value;
\t} else {
\t\t$args = array( $key => $value );
\t}
\t$parts = array();
\tforeach ( $args as $arg_key => $arg_value ) {
\t\t$parts[] = rawurlencode( (string) $arg_key ) . '=' . rawurlencode( (string) $arg_value );
\t}
\treturn $url . ( str_contains( $url, '?' ) ? '&' : '?' ) . implode( '&', $parts );
}
function add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wphx_callbacks'][ $hook_name ][ $priority ][] = array( $callback, $accepted_args );
\treturn true;
}
function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_filters'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) + 1 );
\tif ( isset( $GLOBALS['wphx_callbacks'][ $hook_name ] ) ) {
\t\tksort( $GLOBALS['wphx_callbacks'][ $hook_name ] );
\t\tforeach ( $GLOBALS['wphx_callbacks'][ $hook_name ] as $callbacks ) {
\t\t\tforeach ( $callbacks as $callback ) {
\t\t\t\t$value = call_user_func_array( $callback[0], array_slice( array_merge( array( $value ), $args ), 0, $callback[1] ) );
\t\t\t}
\t\t}
\t}
\treturn $value;
}
function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_actions'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) );
}
function get_site_option( $name, $default = false ) { return $GLOBALS['wphx_site_options'][ $name ] ?? $default; }
function update_site_option( $name, $value ) { $GLOBALS['wphx_site_options'][ $name ] = $value; return true; }
function get_option( $name, $default = false ) { return $GLOBALS['wphx_options'][ $name ] ?? $default; }
function update_option( $name, $value, $autoload = null ) { $GLOBALS['wphx_options'][ $name ] = $value; return true; }
function wp_generate_password( $length = 12, $special_chars = true, $extra_special_chars = false ) {
\t$value = array_shift( $GLOBALS['wphx_passwords'] );
\treturn $value ?: str_repeat( 'x', $length );
}
function wp_fast_hash( $value ) { return 'fast:' . hash( 'sha256', (string) $value ); }
function wp_verify_fast_hash( $value, $hash ) { return hash_equals( wp_fast_hash( $value ), $hash ); }

require $root . '/wp-admin/includes/class-wp-upgrader-skin.php';
require $root . '/wp-admin/includes/class-automatic-upgrader-skin.php';
require $root . '/wp-admin/includes/class-wp-ajax-upgrader-skin.php';
require $root . '/wp-admin/includes/class-bulk-upgrader-skin.php';
require $root . '/wp-admin/includes/class-plugin-upgrader-skin.php';
require $root . '/wp-admin/includes/class-plugin-installer-skin.php';
require $root . '/wp-includes/class-wp-recovery-mode-cookie-service.php';
require $root . '/wp-includes/class-wp-recovery-mode-key-service.php';
require $root . '/wp-includes/class-wp-recovery-mode-link-service.php';

function wphx_capture( $callback ) { ob_start(); $callback(); return ob_get_clean(); }
function wphx_norm( $value ) { return trim( preg_replace( '/\\s+/', ' ', (string) $value ) ); }
function wphx_error_code( $value ) { return is_wp_error( $value ) ? $value->get_error_code() : $value; }
function wphx_cookie( $created, $random, $signature = null ) {
\t$to_sign = sprintf( 'recovery_mode|%s|%s', $created, $random );
\t$signature = $signature ?? hash_hmac( 'sha1', $to_sign, AUTH_KEY . AUTH_SALT );
\treturn base64_encode( $to_sign . '|' . $signature );
}
function wphx_emit( $payload ) {
\techo json_encode(
\t\tarray_merge(
\t\t\tarray(
\t\t\t\t'case' => $GLOBALS['wphx_case'],
\t\t\t\t'filters' => $GLOBALS['wphx_filters'],
\t\t\t\t'actions' => $GLOBALS['wphx_actions'],
\t\t\t),
\t\t\t$payload
\t\t),
\t\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
\t);
}

$GLOBALS['wphx_case'] = $case;

switch ( $case ) {
\tcase 'upgrader:base-skin':
\t\t$skin = new WP_Upgrader_Skin( array( 'title' => 'Fixture Update', 'url' => 'update.php?action=upgrade', 'nonce' => 'upgrade-fixture', 'context' => 'wp-content' ) );
\t\t$upgrader = new Wphx_Fake_Upgrader();
\t\t$upgrader->strings['hello_%s'] = 'Hello %s';
\t\t$skin->set_upgrader( $upgrader );
\t\t$credentials = $skin->request_filesystem_credentials( false, '', true );
\t\t$output = wphx_capture(
\t\t\tfunction () use ( $skin ) {
\t\t\t\t$skin->header();
\t\t\t\t$skin->header();
\t\t\t\t$skin->feedback( 'hello_%s', 'Plugin' );
\t\t\t\t$skin->error( new WP_Error( 'broken', 'Broken update', '<b>detail</b>' ) );
\t\t\t\t$skin->footer();
\t\t\t\t$skin->footer();
\t\t\t}
\t\t);
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'credentials' => $credentials,
\t\t\t\t'credential_requests' => $GLOBALS['wphx_credentials'],
\t\t\t\t'done_header' => $skin->done_header,
\t\t\t\t'done_footer' => $skin->done_footer,
\t\t\t\t'output' => wphx_norm( $output ),
\t\t\t\t'contains' => array( 'title' => str_contains( $output, 'Fixture Update' ), 'message' => str_contains( $output, 'Hello Plugin' ), 'error' => str_contains( $output, 'Broken update detail' ) ),
\t\t\t)
\t\t);
\t\tbreak;

\tcase 'upgrader:automatic-ajax':
\t\t$auto = new Automatic_Upgrader_Skin();
\t\t$upgrader = new Wphx_Fake_Upgrader();
\t\t$upgrader->strings['auto_%s'] = 'Auto %s';
\t\t$auto->set_upgrader( $upgrader );
\t\t$auto->feedback( 'auto_%s', 'Message' );
\t\t$auto->feedback( array( 'ignored' ) );
\t\t$auto_output = wphx_capture(
\t\t\tfunction () use ( $auto ) {
\t\t\t\t$auto->header();
\t\t\t\techo '<strong>Buffered</strong>';
\t\t\t\t$auto->footer();
\t\t\t}
\t\t);
\t\t$ajax = new WP_Ajax_Upgrader_Skin();
\t\t$ajax->set_upgrader( $upgrader );
\t\t$ajax->error( 'auto_%s', 'Failure' );
\t\t$ajax->error( new WP_Error( 'remote_error', 'Remote failed', '<em>data</em>' ) );
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'auto_messages' => $auto->get_upgrade_messages(),
\t\t\t\t'auto_output' => wphx_norm( $auto_output ),
\t\t\t\t'ajax_error_codes' => $ajax->get_errors()->get_error_codes(),
\t\t\t\t'ajax_error_messages' => $ajax->get_error_messages(),
\t\t\t)
\t\t);
\t\tbreak;

\tcase 'upgrader:bulk-skin':
\t\t$bulk = new Bulk_Upgrader_Skin();
\t\t$upgrader = new Wphx_Fake_Upgrader();
\t\t$bulk->set_upgrader( $upgrader );
\t\t$output = wphx_capture(
\t\t\tfunction () use ( $bulk ) {
\t\t\t\t$bulk->bulk_header();
\t\t\t\t$bulk->in_loop = true;
\t\t\t\t$bulk->feedback( 'skin_update_successful', 'Fixture Plugin' );
\t\t\t\t$bulk->error( new WP_Error( 'bulk_error', 'Bulk broke', '<strong>detail</strong>' ) );
\t\t\t}
\t\t);
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'error' => $bulk->error,
\t\t\t\t'in_loop' => $bulk->in_loop,
\t\t\t\t'string_keys' => array_keys( $upgrader->strings ),
\t\t\t\t'output' => wphx_norm( $output ),
\t\t\t\t'contains' => array( 'start' => str_contains( $output, 'starting' ), 'success' => str_contains( $output, 'Fixture Plugin updated successfully' ), 'script' => str_contains( $output, 'waiting-2' ) ),
\t\t\t)
\t\t);
\t\tbreak;

\tcase 'upgrader:plugin-skins':
\t\t$_GET['from'] = 'plugins';
\t\t$plugin = new Plugin_Upgrader_Skin( array( 'plugin' => 'fixture/fixture.php', 'url' => 'update.php', 'nonce' => 'upgrade-plugin_fixture/fixture.php' ) );
\t\t$upgrader = new Wphx_Fake_Upgrader();
\t\t$plugin->set_upgrader( $upgrader );
\t\t$plugin->set_result( true );
\t\t$plugin_output = wphx_capture( array( $plugin, 'after' ) );
\t\t$api = (object) array( 'name' => 'Fixture Plugin', 'version' => '2.0.0' );
\t\t$installer = new Plugin_Installer_Skin( array( 'type' => 'upload', 'api' => $api, 'overwrite' => '' ) );
\t\t$install_upgrader = new Wphx_Fake_Upgrader();
\t\t$install_upgrader->strings['process_success_specific'] = '%s %s installed.';
\t\t$installer->set_upgrader( $install_upgrader );
\t\t$installer->before();
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'plugin_active' => $plugin->plugin_active,
\t\t\t\t'plugin_network_active' => $plugin->plugin_network_active,
\t\t\t\t'plugin_output' => wphx_norm( $plugin_output ),
\t\t\t\t'installer_success' => $install_upgrader->strings['process_success'],
\t\t\t\t'hide_folder_exists' => $installer->hide_process_failed( new WP_Error( 'folder_exists', 'Folder exists' ) ),
\t\t\t\t'hide_other_error' => $installer->hide_process_failed( new WP_Error( 'download_failed', 'Download failed' ) ),
\t\t\t)
\t\t);
\t\tbreak;

\tcase 'recovery:cookie-service':
\t\t$service = new WP_Recovery_Mode_Cookie_Service();
\t\t$valid_cookie = wphx_cookie( time() - 10, 'random-session' );
\t\t$expired_cookie = wphx_cookie( time() - WEEK_IN_SECONDS - 10, 'old-session' );
\t\t$bad_cookie = wphx_cookie( time() - 10, 'random-session', 'bad-signature' );
\t\t$valid = $service->validate_cookie( $valid_cookie );
\t\t$session = $service->get_session_id_from_cookie( $valid_cookie );
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'no_cookie' => wphx_error_code( $service->validate_cookie() ),
\t\t\t\t'invalid_format' => wphx_error_code( $service->validate_cookie( base64_encode( 'bad' ) ) ),
\t\t\t\t'expired' => wphx_error_code( $service->validate_cookie( $expired_cookie ) ),
\t\t\t\t'signature_mismatch' => wphx_error_code( $service->validate_cookie( $bad_cookie ) ),
\t\t\t\t'valid' => true === $valid,
\t\t\t\t'session_id' => $session,
\t\t\t)
\t\t);
\t\tbreak;

\tcase 'recovery:key-service':
\t\t$service = new WP_Recovery_Mode_Key_Service();
\t\t$token = $service->generate_recovery_mode_token();
\t\t$key = $service->generate_and_store_recovery_mode_key( $token );
\t\t$records_after_store = $GLOBALS['wphx_options']['recovery_keys'];
\t\t$valid = $service->validate_recovery_mode_key( $token, $key, WEEK_IN_SECONDS );
\t\t$second_use = $service->validate_recovery_mode_key( $token, $key, WEEK_IN_SECONDS );
\t\t$GLOBALS['wphx_options']['recovery_keys']['old-token'] = array( 'hashed_key' => wp_fast_hash( 'old-key' ), 'created_at' => time() - WEEK_IN_SECONDS - 1 );
\t\t$GLOBALS['wphx_options']['recovery_keys']['fresh-token'] = array( 'hashed_key' => wp_fast_hash( 'fresh-key' ), 'created_at' => time() );
\t\t$mismatch = $service->validate_recovery_mode_key( 'fresh-token', 'wrong-key', WEEK_IN_SECONDS );
\t\t$service->clean_expired_keys( WEEK_IN_SECONDS );
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'token' => $token,
\t\t\t\t'key' => $key,
\t\t\t\t'stored_tokens' => array_keys( $records_after_store ),
\t\t\t\t'stored_hash_prefix' => substr( $records_after_store[ $token ]['hashed_key'], 0, 5 ),
\t\t\t\t'valid' => true === $valid,
\t\t\t\t'second_use' => wphx_error_code( $second_use ),
\t\t\t\t'mismatch' => wphx_error_code( $mismatch ),
\t\t\t\t'remaining_tokens' => array_keys( $GLOBALS['wphx_options']['recovery_keys'] ),
\t\t\t)
\t\t);
\t\tbreak;

\tcase 'recovery:link-service':
\t\tadd_filter(
\t\t\t'recovery_mode_begin_url',
\t\t\tfunction ( $url, $token, $key ) {
\t\t\t\treturn $url . '&filtered=1&token_length=' . strlen( $token ) . '&key_length=' . strlen( $key );
\t\t\t},
\t\t\t10,
\t\t\t3
\t\t);
\t\t$link = new WP_Recovery_Mode_Link_Service( new WP_Recovery_Mode_Cookie_Service(), new WP_Recovery_Mode_Key_Service() );
\t\t$url = $link->generate_url();
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'url' => $url,
\t\t\t\t'stored_tokens' => array_keys( $GLOBALS['wphx_options']['recovery_keys'] ),
\t\t\t\t'contains' => array( 'action' => str_contains( $url, 'action=enter_recovery_mode' ), 'token' => str_contains( $url, 'rm_token=' ), 'key' => str_contains( $url, 'rm_key=' ), 'filtered' => str_contains( $url, 'filtered=1' ) ),
\t\t\t)
\t\t);
\t\tbreak;

\tdefault:
\t\tfwrite( STDERR, 'Unknown case: ' . $case . PHP_EOL );
\t\texit( 1 );
}
`
  );
}

function runCase(root, id) {
  return JSON.parse(command("php", [PROBE, root, id]));
}

function normalizeRun(run) {
  return {
    case: run.case,
    credentials: run.credentials,
    credential_requests: run.credential_requests,
    done_header: run.done_header,
    done_footer: run.done_footer,
    output: run.output,
    auto_messages: run.auto_messages,
    auto_output: run.auto_output,
    ajax_error_codes: run.ajax_error_codes,
    ajax_error_messages: run.ajax_error_messages,
    error: run.error,
    in_loop: run.in_loop,
    string_keys: run.string_keys,
    plugin_active: run.plugin_active,
    plugin_network_active: run.plugin_network_active,
    plugin_output: run.plugin_output,
    installer_success: run.installer_success,
    hide_folder_exists: run.hide_folder_exists,
    hide_other_error: run.hide_other_error,
    no_cookie: run.no_cookie,
    invalid_format: run.invalid_format,
    expired: run.expired,
    signature_mismatch: run.signature_mismatch,
    valid: run.valid,
    session_id: run.session_id,
    token: run.token,
    key: run.key,
    stored_tokens: run.stored_tokens,
    stored_hash_prefix: run.stored_hash_prefix,
    second_use: run.second_use,
    mismatch: run.mismatch,
    remaining_tokens: run.remaining_tokens,
    url: run.url,
    contains: run.contains,
    filters: run.filters,
    actions: run.actions
  };
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-319-updates-installers-recovery-oracle-fixture`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

try {
  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe();
} catch (error) {
  console.error(JSON.stringify({ status: "failed", phase: "setup", error: error.message }, null, 2));
  process.exit(1);
}

const runs = [];
for (const fixtureCase of CASES) {
  const oracle = normalizeRun(runCase(ORACLE_ROOT, fixtureCase.id));
  const candidate = normalizeRun(runCase(CANDIDATE_ROOT, fixtureCase.id));
  runs.push({
    id: fixtureCase.id,
    focus: fixtureCase.focus,
    oracle,
    candidate,
    matches: JSON.stringify(oracle) === JSON.stringify(candidate)
  });
}

const allMatched = runs.every((run) => run.matches);
if (!allMatched) {
  console.error(JSON.stringify({ status: "failed", runs }, null, 2));
  process.exit(1);
}

const manifest = {
  schema: "wphx.wp-core-updates-installers-recovery-oracle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_class: "oracle_source_mirror",
  artifact_scope: "helper",
  inputs: {
    surface: inputRecord(SURFACE),
    adapter_contract: inputRecord(CONTRACT),
    source_files: SOURCE_FILES.map(sourceRecord)
  },
  fixture: {
    source_files: SOURCE_FILES,
    covered_symbols: COVERED_SYMBOLS,
    cases: CASES,
    public_abi_policy: {
      public_php_replacement_claimed: false,
      handwritten_php_shells_added: false,
      semantic_owner: "upstream_php_oracle_mirrored",
      durable_adapter_owner: "not_claimed",
      installed_update_parity_claimed: false,
      filesystem_network_database_side_effects_claimed: false,
      generated_overlay_claimed: false,
      removal_gate:
        "Replace copied candidate PHP with Haxe-owned update/upgrader/recovery semantics, generated original-path adapters, generated overlay manifests, selected upstream PHPUnit, installed route/browser/database gates, and filesystem/network/mail/recovery side-effect evidence before claiming public PHP ownership or installed parity."
    }
  },
  runs,
  remaining_gaps: [
    {
      id: "live-update-side-effects-not-executed",
      owner: ISSUE.external_ref,
      detail:
        "The fixture exercises copied updater/upgrader/recovery class behavior under deterministic stubs. It does not download packages, unzip/copy/delete files, activate plugins, write a database, send mail, call remote HTTP APIs, run cron, or execute installed admin routes."
    },
    {
      id: "copied-candidate-not-generated-overlay",
      owner: ISSUE.external_ref,
      detail:
        "Oracle and candidate roots mirror the same upstream PHP source. Candidate divergence, generated public PHP replacement, and durable original-path adapter ownership require a non-empty generated overlay manifest and stronger runtime gates."
    }
  ],
  claims: {
    behavior_parity_claimed: false,
    behavior_parity_scope: "deterministic_copied_oracle_fixture_observation_match_only",
    copied_oracle_fixture_observation_match_claimed: true,
    targeted_copied_oracle_fixture_claimed: true,
    public_php_replacement_claimed: false,
    generated_original_path_adapter_claimed: false,
    generated_overlay_claimed: false,
    installed_update_route_execution_claimed: false,
    filesystem_side_effects_claimed: false,
    network_side_effects_claimed: false,
    database_backed_state_claimed: false,
    recovery_email_session_parity_claimed: false,
    upstream_phpunit_pass_pass_claimed: false
  },
  validation_result: {
    status: "passed",
    case_count: CASES.length,
    all_matched: allMatched,
    source_file_count: SOURCE_FILES.length,
    covered_symbol_count: COVERED_SYMBOLS.length
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const ownership = {
  schema: "wphx.ownership-manifest.v1",
  manifest_id: "ownership:wp-core/updates-installers-recovery-oracle-fixture",
  issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
  unit: {
    kind: "copied_oracle_fixture",
    name: "updates/installers/upgrader/recovery copied-oracle behavior fixture",
    area:
      "wp-admin/includes/class-wp-upgrader-skin.php class-automatic-upgrader-skin.php class-wp-ajax-upgrader-skin.php class-bulk-upgrader-skin.php class-plugin-upgrader-skin.php class-plugin-installer-skin.php wp-includes/class-wp-recovery-mode-cookie-service.php class-wp-recovery-mode-key-service.php class-wp-recovery-mode-link-service.php",
    public_contract:
      "This fixture executes copied upstream WordPress PHP in regenerated oracle and candidate roots under deterministic stubs. It proves matching bounded observations only; public PHP replacement, generated overlays, installed update/recovery parity, and durable adapter ownership are not claimed."
  },
  ownership_state: "copied_oracle_fixture",
  ownership_axes: {
    semantic_owner: "upstream_wordpress",
    adapter_contract_owner: "haxe_typed_foundation",
    emission_strategy: "copied_upstream_public_php_fixture",
    execution_provider: "php_cli_fixture",
    compatibility_evidence: "deterministic_oracle_candidate_match"
  },
  bridge: {
    exists: true,
    kind: "copied-oracle-public-php-with-haxe-adapter-contract-foundation",
    removal_gate:
      "Replace copied candidate PHP with generated Haxe/WPHX PHP original-path adapters and pass updater/upgrader/recovery side-effect, installed route/browser/database, selected upstream PHPUnit, generated overlay, and ecosystem gates before claiming durable public PHP ownership."
  },
  owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
  copied_oracle_inputs: SOURCE_FILES,
  generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
  verification: {
    oracle_commands: [
      "npm run wp:core:wphx-319-updates-installers-recovery-oracle-fixture",
      "npm run wp:core:wphx-319-updates-installers-recovery-oracle-fixture:check",
      "npm run receipts:validate"
    ],
    receipt_refs: ["receipt:wphx-319-03-updates-installers-recovery-oracle-fixture"],
    manifest_digest: sha256(manifestText)
  },
  notes:
    "Mirrored upstream PHP files are regenerated build inputs only. They must not be edited, committed, distributed, or cited as WPHX-owned implementation source."
};
const ownershipText = JSON.stringify(ownership, null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-319-03-updates-installers-recovery-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "updates/installers/recovery copied-oracle fixture manifest" },
    { path: OWNERSHIP, role: "updates/installers/recovery copied-oracle fixture ownership manifest" },
    { path: RUNNER, role: "deterministic copied-oracle fixture runner" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-319-updates-installers-recovery-oracle-fixture",
    "npm run wp:core:wphx-319-updates-installers-recovery-oracle-fixture:check"
  ],
  validation_result: manifest.validation_result,
  manifest_sha256: sha256(manifestText),
  ownership_sha256: sha256(ownershipText),
  related_receipts: [
    "receipt:wphx-319-01-updates-installers-recovery-surface",
    "receipt:wphx-319-02-updates-installers-recovery-adapter-contract-candidate"
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
