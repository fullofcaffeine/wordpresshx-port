#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.11.5",
  external_ref: "WPHX-317.06",
  title: "Build signup, lifecycle, counts, and quota fixtures"
};
const OUT_ROOT = "build/wp-core/wphx-317-06";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-317-06-multisite-signup-lifecycle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-317-06-multisite-signup-lifecycle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-317-06-multisite-signup-lifecycle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-317-01-multisite-network-surface.v1.json";
const BOOTSTRAP_ROUTING = "manifests/wp-core/wphx-317-05-multisite-bootstrap-routing-fixture.v1.json";
const RECORDED_AT = "2026-06-23T06:15:00.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const UPSTREAM_ROOT = "../wordpress-develop";

const SOURCE_FILES = [
  "src/wp-includes/class-wp-error.php",
  "src/wp-includes/ms-functions.php"
];

const COVERED_SYMBOLS = [
  "get_sitestats",
  "get_blog_count",
  "wpmu_validate_user_signup",
  "wpmu_validate_blog_signup",
  "wpmu_signup_blog",
  "wpmu_signup_user",
  "wpmu_activate_signup",
  "wpmu_create_user",
  "wpmu_create_blog",
  "newblog_notify_siteadmin",
  "newuser_notify_siteadmin",
  "maybe_add_existing_user_to_blog",
  "domain_exists",
  "get_upload_space_available",
  "is_upload_space_available",
  "upload_size_limit_filter"
];

const FIXTURE_CASES = [
  { id: "counts:sitestats-network-options", symbol: "get_sitestats/get_blog_count/get_user_count", focus: "network option-backed blog counts and stubbed user count aggregation" },
  { id: "validate:user-signup-errors-and-reservations", symbol: "wpmu_validate_user_signup", focus: "sanitization, illegal names, limited domains, existing users/emails, pending signup reservations, and stale reservation cleanup" },
  { id: "validate:blog-signup-domain-path", symbol: "wpmu_validate_blog_signup/domain_exists", focus: "subdirectory path construction, reserved names, page conflicts, existing-domain checks, and pending signup reservations" },
  { id: "signup:blog-and-user-inserts", symbol: "wpmu_signup_blog/wpmu_signup_user", focus: "signup row shape, activation keys, serialized metadata, and after-signup actions" },
  { id: "activate:user-and-blog-branches", symbol: "wpmu_activate_signup", focus: "invalid key, active key, user activation, site activation, signup update side effects, and activation hooks" },
  { id: "create:user-blog-direct", symbol: "wpmu_create_user/wpmu_create_blog", focus: "direct user creation, option cleanup, install-state transition, site insertion payload, and duplicate site errors" },
  { id: "notify:site-and-user-admin-mails", symbol: "newblog_notify_siteadmin/newuser_notify_siteadmin", focus: "registrationnotification gate, admin email validation, switch/restore behavior, mail subject/body shape, and filter hooks" },
  { id: "existing-user:request-key-flow", symbol: "maybe_add_existing_user_to_blog", focus: "newbloguser request parsing, option deletion, add_existing_user_to_blog handoff, and wp_die success response" },
  { id: "quota:space-available-and-limit", symbol: "get_upload_space_available/is_upload_space_available/upload_size_limit_filter", focus: "blog quota, sitewide disabled check, space-used subtraction, and max upload limit filtering" }
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function command(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 50
  }).trim();
}

function maybeCommand(commandName, commandArgs) {
  try {
    return command(commandName, commandArgs);
  } catch {
    return null;
  }
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function inputRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function upstreamPath(path) {
  return `${UPSTREAM_ROOT}/${path}`;
}

function mirrorPath(root, path) {
  return `${root}/${path.replace(/^src\//, "")}`;
}

function mirrorSources(root) {
  for (const path of SOURCE_FILES) {
    const target = mirrorPath(root, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(upstreamPath(path), target);
  }
}

function sourceRecord(path) {
  return {
    path,
    repo_path: upstreamPath(path),
    bytes: statSync(upstreamPath(path)).size,
    sha256: sha256File(upstreamPath(path))
  };
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php

$mode = $argv[1];
$root = rtrim( $argv[2], '/\\\\' );

error_reporting( E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED );
ini_set( 'display_errors', '0' );
ini_set( 'log_errors', '0' );
register_shutdown_function(
\tfunction () {
\t\t$error = error_get_last();
\t\tif ( null !== $error && in_array( $error['type'], array( E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR ), true ) ) {
\t\t\tfwrite( STDERR, json_encode( $error, JSON_UNESCAPED_SLASHES ) . PHP_EOL );
\t\t}
\t}
);

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'WP_CONTENT_DIR', $root . '/wp-content' );
define( 'WP_DEBUG', false );
define( 'MULTISITE', true );
define( 'DAY_IN_SECONDS', 86400 );
define( 'MINUTE_IN_SECONDS', 60 );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'KB_IN_BYTES', 1024 );
define( 'MB_IN_BYTES', 1048576 );

$_SERVER['REMOTE_ADDR'] = '203.0.113.7';
$_SERVER['REQUEST_URI'] = '/';

class WP_User {
\tpublic $ID;
\tpublic $user_login;
\tpublic $user_email;
\tpublic $roles = array();
\tpublic function __construct( $id = 0, $login = '', $email = '' ) {
\t\t$this->ID = (int) $id;
\t\t$this->user_login = $login;
\t\t$this->user_email = $email;
\t}
\tpublic function set_role( $role ) {
\t\t$this->roles = array( $role );
\t}
}

class WPHX_317_06_WP_Die extends Exception {
\tpublic $title;
\tpublic $args;
\tpublic function __construct( $message, $title = '', $args = array() ) {
\t\tparent::__construct( (string) $message );
\t\t$this->title = $title;
\t\t$this->args = $args;
\t}
}

class WPHX_317_06_Fake_WPDB {
\tpublic $base_prefix = 'wp_';
\tpublic $prefix = 'wp_';
\tpublic $signups = 'wp_signups';
\tpublic $blogs = 'wp_blogs';
\tpublic $site = 'wp_site';
\tpublic $users = 'wp_users';
\tpublic $insert_id = 0;
\tpublic $queries = array();
\tpublic $inserts = array();
\tpublic $updates = array();
\tpublic $deletes = array();
\tpublic $signup_rows = array();
\tpublic $existing_domains = array();

\tpublic function __construct() {
\t\t$this->reset();
\t}

\tpublic function reset() {
\t\t$this->queries = array();
\t\t$this->inserts = array();
\t\t$this->updates = array();
\t\t$this->deletes = array();
\t\t$this->insert_id = 0;
\t\t$this->existing_domains = array(
\t\t\tarray( 'blog_id' => 2, 'domain' => 'network.example.test', 'path' => '/taken/', 'site_id' => 7 ),
\t\t);
\t\t$this->signup_rows = array(
\t\t\t(object) array( 'domain' => '', 'path' => '', 'title' => '', 'user_login' => 'reserveduser', 'user_email' => 'reserved@example.test', 'registered' => '2026-06-22 00:00:00', 'activation_key' => 'reserved-user-key', 'active' => '0', 'meta' => serialize( array( 'source' => 'reserved' ) ) ),
\t\t\t(object) array( 'domain' => '', 'path' => '', 'title' => '', 'user_login' => 'staleuser', 'user_email' => 'stale@example.test', 'registered' => '2026-06-15 00:00:00', 'activation_key' => 'stale-user-key', 'active' => '0', 'meta' => serialize( array( 'source' => 'stale' ) ) ),
\t\t\t(object) array( 'domain' => 'network.example.test', 'path' => '/reservedsite/', 'title' => 'Reserved Site', 'user_login' => 'owner', 'user_email' => 'owner@example.test', 'registered' => '2026-06-22 00:00:00', 'activation_key' => 'reserved-site-key', 'active' => '0', 'meta' => serialize( array( 'public' => 1 ) ) ),
\t\t\t(object) array( 'domain' => '', 'path' => '', 'title' => '', 'user_login' => 'activateuser', 'user_email' => 'activate@example.test', 'registered' => '2026-06-22 00:00:00', 'activation_key' => 'activate-user-key', 'active' => '0', 'meta' => serialize( array( 'role' => 'subscriber' ) ) ),
\t\t\t(object) array( 'domain' => 'fresh.network.example.test', 'path' => '/', 'title' => 'Fresh Site', 'user_login' => 'siteowner', 'user_email' => 'siteowner@example.test', 'registered' => '2026-06-22 00:00:00', 'activation_key' => 'activate-blog-key', 'active' => '0', 'meta' => serialize( array( 'public' => 1, 'lang_id' => 2 ) ) ),
\t\t\t(object) array( 'domain' => '', 'path' => '', 'title' => '', 'user_login' => 'alreadyactive', 'user_email' => 'already@example.test', 'registered' => '2026-06-22 00:00:00', 'activation_key' => 'already-active-key', 'active' => '1', 'meta' => serialize( array() ) ),
\t\t);
\t}

\tpublic function get_blog_prefix( $blog_id = null ) {
\t\t$blog_id = null === $blog_id ? 1 : (int) $blog_id;
\t\treturn 1 === $blog_id ? $this->base_prefix : $this->base_prefix . $blog_id . '_';
\t}

\tpublic function prepare( $query, ...$args ) {
\t\tif ( 1 === count( $args ) && is_array( $args[0] ) ) {
\t\t\t$args = $args[0];
\t\t}
\t\t$index = 0;
\t\treturn preg_replace_callback(
\t\t\t'/%(?:\\\\d+\\\\$)?([dsf])/',
\t\t\tfunction ( $matches ) use ( &$args, &$index ) {
\t\t\t\t$value = $args[ $index++ ] ?? '';
\t\t\t\treturn 'd' === $matches[1] ? (string) (int) $value : "'" . str_replace( "'", "\\\\'", (string) $value ) . "'";
\t\t\t},
\t\t\t$query
\t\t);
\t}

\tprivate function record( $operation, $query ) {
\t\t$this->queries[] = array( 'operation' => $operation, 'query' => preg_replace( '/\\s+/', ' ', trim( (string) $query ) ) );
\t}

\tprivate function quoted_value( $sql, $column ) {
\t\tif ( preg_match( '/' . preg_quote( $column, '/' ) . \"\\\\s*=\\\\s*'([^']*)'/\", $sql, $matches ) ) {
\t\t\treturn str_replace( \"\\\\'\", \"'\", $matches[1] );
\t\t}
\t\treturn null;
\t}

\tpublic function get_row( $query ) {
\t\t$sql = (string) $query;
\t\t$this->record( 'get_row', $sql );
\t\tif ( false !== strpos( $sql, $this->signups ) ) {
\t\t\t$key = $this->quoted_value( $sql, 'activation_key' );
\t\t\t$login = $this->quoted_value( $sql, 'user_login' );
\t\t\t$email = $this->quoted_value( $sql, 'user_email' );
\t\t\t$domain = $this->quoted_value( $sql, 'domain' );
\t\t\t$path = $this->quoted_value( $sql, 'path' );
\t\t\tforeach ( $this->signup_rows as $row ) {
\t\t\t\tif ( null !== $key && $row->activation_key === $key ) return clone $row;
\t\t\t\tif ( null !== $login && $row->user_login === $login ) return clone $row;
\t\t\t\tif ( null !== $email && $row->user_email === $email ) return clone $row;
\t\t\t\tif ( null !== $domain && null !== $path && $row->domain === $domain && $row->path === $path ) return clone $row;
\t\t\t}
\t\t}
\t\treturn null;
\t}

\tpublic function get_var( $query ) {
\t\t$sql = (string) $query;
\t\t$this->record( 'get_var', $sql );
\t\tif ( false !== strpos( $sql, 'post_type = \\'page\\'' ) && false !== strpos( $sql, \"post_name = 'conflictpage'\" ) ) {
\t\t\treturn 'conflictpage';
\t\t}
\t\tif ( false !== strpos( $sql, $this->blogs ) ) {
\t\t\t$domain = $this->quoted_value( $sql, 'domain' );
\t\t\t$path = $this->quoted_value( $sql, 'path' );
\t\t\tforeach ( $this->existing_domains as $row ) {
\t\t\t\tif ( $row['domain'] === $domain && $row['path'] === $path ) {
\t\t\t\t\treturn $row['blog_id'];
\t\t\t\t}
\t\t\t}
\t\t}
\t\treturn null;
\t}

\tpublic function insert( $table, $data ) {
\t\t$this->insert_id++;
\t\t$this->inserts[] = array( 'table' => $table, 'data' => $data );
\t\tif ( $table === $this->signups ) {
\t\t\t$row = (object) array_merge( array( 'active' => '0', 'activated' => '0000-00-00 00:00:00' ), $data );
\t\t\t$this->signup_rows[] = $row;
\t\t}
\t\treturn true;
\t}

\tpublic function update( $table, $data, $where ) {
\t\t$this->updates[] = array( 'table' => $table, 'data' => $data, 'where' => $where );
\t\tif ( $table === $this->signups && isset( $where['activation_key'] ) ) {
\t\t\tforeach ( $this->signup_rows as $row ) {
\t\t\t\tif ( $row->activation_key === $where['activation_key'] ) {
\t\t\t\t\tforeach ( $data as $key => $value ) {
\t\t\t\t\t\t$row->$key = $value;
\t\t\t\t\t}
\t\t\t\t}
\t\t\t}
\t\t}
\t\treturn true;
\t}

\tpublic function delete( $table, $where ) {
\t\t$this->deletes[] = array( 'table' => $table, 'where' => $where );
\t\treturn true;
\t}
}

$GLOBALS['wpdb'] = new WPHX_317_06_Fake_WPDB();
$GLOBALS['wphx_actions'] = array();
$GLOBALS['wphx_filters'] = array();
$GLOBALS['wphx_mails'] = array();
$GLOBALS['wphx_users'] = array(
\t1 => new WP_User( 1, 'adminuser', 'admin@example.test' ),
\t44 => new WP_User( 44, 'existinglogin', 'existing@example.test' ),
);
$GLOBALS['wphx_user_logins'] = array( 'existinglogin' => 44, 'takenblog' => 45, 'alreadyactive' => 46 );
$GLOBALS['wphx_user_emails'] = array( 'used@example.test' => 44 );
$GLOBALS['wphx_options'] = array(
\t'blog_upload_space' => 3,
\t'new_user_invitekey' => array( 'user_id' => 44, 'role' => 'editor' ),
);
$GLOBALS['wphx_site_options'] = array(
\t'blog_count' => 12,
\t'illegal_names' => array( 'admin', 'root', 'takenname' ),
\t'limited_email_domains' => array( 'example.test' ),
\t'registrationnotification' => 'yes',
\t'admin_email' => 'network-admin@example.test',
\t'blog_upload_space' => 10,
\t'fileupload_maxk' => 1024,
\t'upload_space_check_disabled' => false,
);
$GLOBALS['wphx_installing'] = false;
$GLOBALS['wphx_next_user_id'] = 100;
$GLOBALS['wphx_next_blog_id'] = 200;
$GLOBALS['wphx_created_users'] = array();
$GLOBALS['wphx_created_sites'] = array();
$GLOBALS['wphx_deleted_user_options'] = array();
$GLOBALS['wphx_blog_switches'] = array();
$GLOBALS['wphx_blog_details_updates'] = array();
$GLOBALS['wphx_user_meta'] = array();
$GLOBALS['wphx_space_used_mb'] = 2;
$GLOBALS['domain'] = 'network.example.test';

require_once ABSPATH . WPINC . '/class-wp-error.php';

function __( $text ) { return $text; }
function _n( $single, $plural, $number ) { return 1 === (int) $number ? $single : $plural; }
function number_format_i18n( $number ) { return (string) $number; }
function sanitize_user( $user, $strict = false ) {
\t$user = strtolower( preg_replace( '/\\s+/', '', (string) $user ) );
\treturn $strict ? preg_replace( '/[^a-z0-9_\\-.@]/', '', $user ) : $user;
}
function sanitize_email( $email ) { return strtolower( trim( (string) $email ) ); }
function is_email( $email ) { return false !== filter_var( $email, FILTER_VALIDATE_EMAIL ); }
function username_exists( $user_name ) { return $GLOBALS['wphx_user_logins'][ $user_name ] ?? false; }
function email_exists( $email ) { return $GLOBALS['wphx_user_emails'][ $email ] ?? false; }
function wp_login_url() { return 'https://network.example.test/wp-login.php'; }
function mysql2date( $format, $date ) { return strtotime( $date . ' UTC' ); }
function current_time( $type, $gmt = false ) { return '2026-06-23 00:00:00'; }
function wp_rand() { return 123456; }
function wp_generate_password( $length = 12, $special_chars = true ) { return str_repeat( 'p', $length ); }
function maybe_unserialize( $value ) { $out = @unserialize( $value ); return false === $out && 'b:0;' !== $value ? $value : $out; }
function wp_parse_args( $args, $defaults = array() ) { return array_merge( $defaults, (array) $args ); }
function wp_unslash( $value ) { return $value; }
function strip_tags_deep( $value ) { return is_array( $value ) ? array_map( 'strip_tags_deep', $value ) : strip_tags( $value ); }
function trailingslashit( $value ) { return rtrim( (string) $value, '/' ) . '/'; }
function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_filters'][] = array( 'hook' => $hook_name, 'args' => array_map( 'wphx_317_06_plain', $args ) );
\treturn $value;
}
function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_actions'][] = array( 'hook' => $hook_name, 'args' => array_map( 'wphx_317_06_plain', $args ) );
}
function get_site_option( $option, $default = false ) { return array_key_exists( $option, $GLOBALS['wphx_site_options'] ) ? $GLOBALS['wphx_site_options'][ $option ] : $default; }
function add_site_option( $option, $value ) { $GLOBALS['wphx_site_options'][ $option ] = $value; return true; }
function get_network_option( $network_id, $option, $default = false ) { return get_site_option( $option, $default ); }
function get_user_count() { return 34; }
function get_network() { return (object) array( 'id' => 7, 'site_id' => 1, 'domain' => 'network.example.test', 'path' => '/' ); }
function get_current_network_id() { return 7; }
function is_subdomain_install() { return false; }
function wp_installing( $is_installing = null ) {
\tif ( null !== $is_installing ) {
\t\t$GLOBALS['wphx_installing'] = (bool) $is_installing;
\t}
\treturn $GLOBALS['wphx_installing'];
}
function wp_create_user( $user_name, $password, $email ) {
\t$GLOBALS['wphx_next_user_id']++;
\t$id = $GLOBALS['wphx_next_user_id'];
\t$GLOBALS['wphx_created_users'][] = array( 'id' => $id, 'user_login' => $user_name, 'password' => $password, 'email' => $email );
\t$GLOBALS['wphx_user_logins'][ $user_name ] = $id;
\t$GLOBALS['wphx_users'][ $id ] = new WP_User( $id, $user_name, $email );
\treturn $id;
}
function delete_user_option( $user_id, $option ) { $GLOBALS['wphx_deleted_user_options'][] = array( 'user_id' => $user_id, 'option' => $option ); return true; }
function wp_insert_site( $data ) {
\tif ( 'duplicate.network.example.test' === $data['domain'] ) {
\t\treturn new WP_Error( 'blog_taken', 'duplicate' );
\t}
\t$GLOBALS['wphx_next_blog_id']++;
\t$GLOBALS['wphx_created_sites'][] = array( 'id' => $GLOBALS['wphx_next_blog_id'], 'data' => $data );
\treturn $GLOBALS['wphx_next_blog_id'];
}
function wp_cache_set_sites_last_changed() { $GLOBALS['wphx_actions'][] = array( 'hook' => 'wp_cache_set_sites_last_changed', 'args' => array() ); }
function is_wp_error( $thing ) { return $thing instanceof WP_Error; }
function network_admin_url( $path = '' ) { return 'https://network.example.test/wp-admin/network/' . ltrim( $path, '/' ); }
function esc_url( $url ) { return $url; }
function switch_to_blog( $blog_id ) { $GLOBALS['wphx_blog_switches'][] = array( 'op' => 'switch', 'blog_id' => (int) $blog_id ); return true; }
function restore_current_blog() { $GLOBALS['wphx_blog_switches'][] = array( 'op' => 'restore' ); return true; }
function get_option( $option, $default = false ) { return array_key_exists( $option, $GLOBALS['wphx_options'] ) ? $GLOBALS['wphx_options'][ $option ] : $default; }
function delete_option( $option ) { unset( $GLOBALS['wphx_options'][ $option ] ); return true; }
function site_url() { return 'https://network.example.test/site-two/'; }
function get_userdata( $user_id ) { return $GLOBALS['wphx_users'][ (int) $user_id ] ?? new WP_User( $user_id, 'user' . $user_id, 'user' . $user_id . '@example.test' ); }
function wp_mail( $to, $subject, $message ) { $GLOBALS['wphx_mails'][] = array( 'to' => $to, 'subject' => $subject, 'messageSha256' => hash( 'sha256', $message ), 'messageContainsRemoteIp' => false !== strpos( $message, $_SERVER['REMOTE_ADDR'] ) ); return true; }
function home_url() { return 'https://network.example.test/'; }
function admin_url() { return 'https://network.example.test/wp-admin/'; }
function wp_die( $message = '', $title = '', $args = array() ) { throw new WPHX_317_06_WP_Die( $message, $title, $args ); }
function get_user_meta( $user_id, $key, $single = false ) { return $GLOBALS['wphx_user_meta'][ (int) $user_id ][ $key ] ?? ''; }
function update_user_meta( $user_id, $key, $value ) { $GLOBALS['wphx_user_meta'][ (int) $user_id ][ $key ] = $value; return true; }
function get_site( $blog_id = null ) { return (object) array( 'blog_id' => (int) ( $blog_id ?? 1 ), 'domain' => 'network.example.test', 'path' => '/' ); }
function get_sites( $args = array() ) {
\tglobal $wpdb;
\t$rows = array_values( $wpdb->existing_domains );
\tif ( isset( $args['network_id'] ) ) {
\t\t$rows = array_values( array_filter( $rows, fn( $row ) => (int) $row['site_id'] === (int) $args['network_id'] ) );
\t}
\tif ( isset( $args['domain'] ) ) {
\t\t$rows = array_values( array_filter( $rows, fn( $row ) => $row['domain'] === $args['domain'] ) );
\t}
\tif ( isset( $args['path'] ) ) {
\t\t$rows = array_values( array_filter( $rows, fn( $row ) => $row['path'] === $args['path'] ) );
\t}
\tif ( isset( $args['fields'] ) && 'ids' === $args['fields'] ) {
\t\treturn array_map( fn( $row ) => (int) $row['blog_id'], $rows );
\t}
\treturn array_map( fn( $row ) => (object) $row, $rows );
}
function clean_user_cache( $user_id ) { $GLOBALS['wphx_actions'][] = array( 'hook' => 'clean_user_cache', 'args' => array( (int) $user_id ) ); }
function wp_cache_delete( $key, $group = '' ) { $GLOBALS['wphx_actions'][] = array( 'hook' => 'wp_cache_delete', 'args' => array( $key, $group ) ); return true; }
function recurse_dirsize( $directory ) { return $GLOBALS['wphx_space_used_mb'] * MB_IN_BYTES; }
function wp_upload_dir() { return array( 'basedir' => '/tmp/wphx-uploads' ); }
function get_dirsize( $directory ) { return $GLOBALS['wphx_space_used_mb'] * MB_IN_BYTES; }
function update_blog_details( $site_id, $details ) { $GLOBALS['wphx_blog_details_updates'][] = array( 'site_id' => $site_id, 'details' => $details ); return true; }
function get_current_blog_id() { return 1; }

require_once ABSPATH . WPINC . '/ms-functions.php';

function wphx_317_06_plain( $value ) {
\tif ( $value instanceof WP_Error ) {
\t\treturn array( 'type' => 'WP_Error', 'codes' => $value->get_error_codes(), 'messages' => $value->get_error_messages(), 'data' => wphx_317_06_plain( $value->get_error_data() ) );
\t}
\tif ( $value instanceof WP_User ) {
\t\treturn array( 'type' => 'WP_User', 'ID' => $value->ID, 'user_login' => $value->user_login, 'user_email' => $value->user_email );
\t}
\tif ( is_array( $value ) ) {
\t\t$out = array();
\t\tforeach ( $value as $key => $entry ) {
\t\t\t$out[ $key ] = wphx_317_06_plain( $entry );
\t\t}
\t\treturn $out;
\t}
\tif ( is_object( $value ) ) {
\t\treturn array( 'type' => get_class( $value ), 'vars' => wphx_317_06_plain( get_object_vars( $value ) ) );
\t}
\treturn $value;
}

function wphx_317_06_errors( $result ) {
\treturn isset( $result['errors'] ) && $result['errors'] instanceof WP_Error ? $result['errors']->get_error_codes() : array();
}

function wphx_317_06_case( $id, $symbol, $value, $meta = array() ) {
\treturn array( 'id' => $id, 'symbol' => $symbol, 'value' => wphx_317_06_plain( $value ), 'meta' => $meta );
}

function wphx_317_06_reset_observations() {
\t$GLOBALS['wphx_actions'] = array();
\t$GLOBALS['wphx_filters'] = array();
\t$GLOBALS['wphx_mails'] = array();
\t$GLOBALS['wphx_blog_switches'] = array();
}

$cases = array();

$cases[] = wphx_317_06_case( 'counts:sitestats-network-options', 'get_sitestats/get_blog_count/get_user_count', array( 'stats' => get_sitestats(), 'networkBlogCount' => get_blog_count( 7 ) ) );

$invalid_user = wpmu_validate_user_signup( 'Admin User', 'bad@outside.test' );
$reserved_user = wpmu_validate_user_signup( 'reserveduser', 'reserved@example.test' );
$stale_user = wpmu_validate_user_signup( 'staleuser', 'fresh@example.test' );
$cases[] = wphx_317_06_case(
\t'validate:user-signup-errors-and-reservations',
\t'wpmu_validate_user_signup',
\tarray(
\t\t'invalid' => array( 'user_name' => $invalid_user['user_name'], 'user_email' => $invalid_user['user_email'], 'errors' => wphx_317_06_errors( $invalid_user ) ),
\t\t'reserved' => array( 'errors' => wphx_317_06_errors( $reserved_user ) ),
\t\t'stale' => array( 'errors' => wphx_317_06_errors( $stale_user ) ),
\t\t'deletes' => $GLOBALS['wpdb']->deletes,
\t)
);

$invalid_blog = wpmu_validate_blog_signup( 'wp-admin', '<b></b>' );
$taken_blog = wpmu_validate_blog_signup( 'taken', 'Taken Site' );
$reserved_blog = wpmu_validate_blog_signup( 'reservedsite', 'Reserved Site' );
$cases[] = wphx_317_06_case(
\t'validate:blog-signup-domain-path',
\t'wpmu_validate_blog_signup/domain_exists',
\tarray(
\t\t'invalid' => array( 'domain' => $invalid_blog['domain'], 'path' => $invalid_blog['path'], 'blogname' => $invalid_blog['blogname'], 'blog_title' => $invalid_blog['blog_title'], 'errors' => wphx_317_06_errors( $invalid_blog ) ),
\t\t'taken' => array( 'domain' => $taken_blog['domain'], 'path' => $taken_blog['path'], 'errors' => wphx_317_06_errors( $taken_blog ) ),
\t\t'reserved' => array( 'errors' => wphx_317_06_errors( $reserved_blog ) ),
\t)
);

wphx_317_06_reset_observations();
$before_insert_count = count( $GLOBALS['wpdb']->inserts );
wpmu_signup_blog( 'new.network.example.test', '/', 'New Site', 'newuser', 'newuser@example.test', array( 'public' => 1 ) );
wpmu_signup_user( 'invite user', 'invite@example.test', array( 'source' => 'fixture' ) );
$signup_inserts = array_slice( $GLOBALS['wpdb']->inserts, $before_insert_count );
$cases[] = wphx_317_06_case( 'signup:blog-and-user-inserts', 'wpmu_signup_blog/wpmu_signup_user', array( 'inserts' => $signup_inserts, 'actions' => $GLOBALS['wphx_actions'], 'filters' => array_column( $GLOBALS['wphx_filters'], 'hook' ) ) );

wphx_317_06_reset_observations();
$invalid_activation = wpmu_activate_signup( 'missing-key' );
$active_activation = wpmu_activate_signup( 'already-active-key' );
$user_activation = wpmu_activate_signup( 'activate-user-key' );
$blog_activation = wpmu_activate_signup( 'activate-blog-key' );
$cases[] = wphx_317_06_case(
\t'activate:user-and-blog-branches',
\t'wpmu_activate_signup',
\tarray(
\t\t'invalid' => $invalid_activation,
\t\t'alreadyActive' => $active_activation,
\t\t'user' => $user_activation,
\t\t'blog' => $blog_activation,
\t\t'updates' => $GLOBALS['wpdb']->updates,
\t\t'actions' => $GLOBALS['wphx_actions'],
\t\t'createdUsers' => $GLOBALS['wphx_created_users'],
\t\t'createdSites' => $GLOBALS['wphx_created_sites'],
\t)
);

wphx_317_06_reset_observations();
$direct_user = wpmu_create_user( ' directuser ', 'secret', 'direct@example.test' );
$direct_blog = wpmu_create_blog( 'direct.network.example.test', '/', '<b>Direct</b>', $direct_user, array( 'public' => 1, 'blogdescription' => 'desc' ), 7 );
$duplicate_blog = wpmu_create_blog( 'network.example.test', '/taken/', 'Taken', $direct_user, array(), 7 );
$cases[] = wphx_317_06_case( 'create:user-blog-direct', 'wpmu_create_user/wpmu_create_blog', array( 'directUser' => $direct_user, 'directBlog' => $direct_blog, 'duplicateBlog' => $duplicate_blog, 'installing' => $GLOBALS['wphx_installing'], 'deletedUserOptions' => $GLOBALS['wphx_deleted_user_options'], 'createdSites' => $GLOBALS['wphx_created_sites'], 'actions' => $GLOBALS['wphx_actions'] ) );

wphx_317_06_reset_observations();
$site_notify = newblog_notify_siteadmin( 2 );
$user_notify = newuser_notify_siteadmin( 44 );
$cases[] = wphx_317_06_case( 'notify:site-and-user-admin-mails', 'newblog_notify_siteadmin/newuser_notify_siteadmin', array( 'site' => $site_notify, 'user' => $user_notify, 'mails' => $GLOBALS['wphx_mails'], 'switches' => $GLOBALS['wphx_blog_switches'], 'filters' => array_column( $GLOBALS['wphx_filters'], 'hook' ) ) );

wphx_317_06_reset_observations();
$_SERVER['REQUEST_URI'] = '/newbloguser/invitekey/';
try {
\tmaybe_add_existing_user_to_blog();
\t$existing_user = array( 'threw' => false );
} catch ( WPHX_317_06_WP_Die $error ) {
\t$existing_user = array( 'threw' => true, 'title' => $error->title, 'args' => $error->args, 'messageContainsSuccess' => false !== strpos( $error->getMessage(), 'You have been added to this site.' ) );
}
$cases[] = wphx_317_06_case( 'existing-user:request-key-flow', 'maybe_add_existing_user_to_blog', array( 'result' => $existing_user, 'userMeta' => $GLOBALS['wphx_user_meta'], 'actions' => $GLOBALS['wphx_actions'], 'optionRemaining' => array_key_exists( 'new_user_invitekey', $GLOBALS['wphx_options'] ) ) );

$GLOBALS['wphx_site_options']['upload_space_check_disabled'] = false;
$GLOBALS['wphx_options']['blog_upload_space'] = 3;
$GLOBALS['wphx_space_used_mb'] = 2;
$quota_available = get_upload_space_available();
$quota_bool = is_upload_space_available();
$quota_limit = upload_size_limit_filter( 5 * MB_IN_BYTES );
$GLOBALS['wphx_site_options']['upload_space_check_disabled'] = true;
$quota_disabled = array( 'available' => get_upload_space_available(), 'bool' => is_upload_space_available(), 'limit' => upload_size_limit_filter( 5 * MB_IN_BYTES ) );
$cases[] = wphx_317_06_case( 'quota:space-available-and-limit', 'get_upload_space_available/is_upload_space_available/upload_size_limit_filter', array( 'available' => $quota_available, 'bool' => $quota_bool, 'limit' => $quota_limit, 'disabled' => $quota_disabled ) );

echo json_encode(
\tarray(
\t\t'mode' => $mode,
\t\t'phpVersion' => PHP_VERSION,
\t\t'cases' => $cases,
\t\t'queryCount' => count( $GLOBALS['wpdb']->queries ),
\t\t'queries' => $GLOBALS['wpdb']->queries,
\t\t'insertCount' => count( $GLOBALS['wpdb']->inserts ),
\t\t'updateCount' => count( $GLOBALS['wpdb']->updates ),
\t\t'deleteCount' => count( $GLOBALS['wpdb']->deletes ),
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
);
`
  );
}

function runProbe(executable, runtime, mode, root) {
  const output = command(executable, [PROBE, mode, root]);
  return {
    id: `${runtime}:${mode}`,
    runtime,
    mode,
    command: `${executable} ${PROBE} ${mode} ${root}`,
    result: JSON.parse(output)
  };
}

function runDockerProbe(runtime, image, mode, root) {
  const cwd = process.cwd();
  const mountRoot = `${cwd}:/workspace`;
  const output = command("docker", [
    "run",
    "--rm",
    "-v",
    mountRoot,
    "-w",
    "/workspace",
    image,
    "php",
    PROBE,
    mode,
    root
  ]);
  return {
    id: `${runtime}:${mode}`,
    runtime,
    image,
    mode,
    command: `docker run --rm -v ${mountRoot} -w /workspace ${image} php ${PROBE} ${mode} ${root}`,
    result: JSON.parse(output)
  };
}

function normalizeValue(value) {
  if (typeof value === "string" && /^[0-9a-f]{16}$/.test(value)) {
    return "<activation-key>";
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalizeValue(entry)]));
  }
  return value;
}

function normalize(result) {
  return {
    caseCount: result.cases.length,
    cases: result.cases.map((entry) => ({
      id: entry.id,
      symbol: entry.symbol,
      value: normalizeValue(entry.value),
      meta: normalizeValue(entry.meta)
    })),
    queryCount: result.queryCount,
    insertCount: result.insertCount,
    updateCount: result.updateCount,
    deleteCount: result.deleteCount,
    queries: result.queries
  };
}

function compare(oracleResult, candidateResult) {
  const oracle = normalize(oracleResult);
  const candidate = normalize(candidateResult);
  return {
    matches: JSON.stringify(oracle) === JSON.stringify(candidate),
    oracle,
    candidate
  };
}

function runSummary(run) {
  const normalized = normalize(run.result);
  return {
    id: run.id,
    runtime: run.runtime,
    mode: run.mode,
    command: run.command,
    image: run.image,
    php_version: run.result.phpVersion,
    normalized_sha256: sha256(JSON.stringify(normalized)),
    case_count: normalized.cases.length,
    case_ids: normalized.cases.map((entry) => entry.id)
  };
}

function comparisonSummary(entry) {
  return {
    id: entry.id,
    matches: entry.matches,
    oracle_sha256: sha256(JSON.stringify(entry.oracle)),
    candidate_sha256: sha256(JSON.stringify(entry.candidate))
  };
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-317-signup-lifecycle`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha, upstreamDigest) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/multisite-signup-lifecycle-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "workset",
      name: "Multisite signup, lifecycle, counts, quota, and notification fixture harness",
      area: "wp-includes/ms-functions.php",
      public_contract:
        "WordPress 7.0 multisite signup and lifecycle helpers preserve validation errors, signup rows, activation branches, create user/blog side effects, network counts, upload quota decisions, admin notifications, and newbloguser request behavior while the candidate side is still an oracle source mirror."
    },
    ownership_state: "external_oracle",
    upstream: {
      repo: UPSTREAM_ROOT,
      ref: WP_REF,
      paths: SOURCE_FILES,
      digest: upstreamDigest
    },
    owned_paths: ["tools/wp-core/run-multisite-signup-lifecycle-fixture.mjs", OUT, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-317-signup-lifecycle",
        "npm run wp:core:wphx-317-signup-lifecycle:check",
        "npm run beads:validate",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-317-06-multisite-signup-lifecycle-fixture"],
      manifest_digest: manifestSha
    },
    notes:
      "The candidate fixture root is an oracle source mirror for WPHX-317.06. The probe supplies deterministic database rows, users, options, mail, actions, and request state so real ms-functions.php lifecycle functions can execute without a full installed multisite database."
  };
}

const lock = readJson("toolchain.lock.json");
const surface = readJson(SURFACE);
rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
writeProbe();

const runs = [];
const comparisons = [];
const localOracle = runProbe("php", "local-php-cli", "oracle", ORACLE_ROOT);
const localCandidate = runProbe("php", "local-php-cli", "candidate", CANDIDATE_ROOT);
runs.push(localOracle, localCandidate);
comparisons.push({
  id: "local-php-cli",
  ...compare(localOracle.result, localCandidate.result)
});

const dockerVersion = maybeCommand("docker", ["info", "--format", "{{.ServerVersion}}"]);
const dockerImages = [
  ["docker-php-8.4-cli", `${lock.container_images.php_8_4_cli.repository}@${lock.container_images.php_8_4_cli.index_digest}`],
  ["docker-php-8.5-cli", `${lock.container_images.php_8_5_cli.repository}@${lock.container_images.php_8_5_cli.index_digest}`]
];
const skippedRuntimes = [];

if (dockerVersion) {
  for (const [runtimeId, image] of dockerImages) {
    const oracle = runDockerProbe(runtimeId, image, "oracle", ORACLE_ROOT);
    const candidate = runDockerProbe(runtimeId, image, "candidate", CANDIDATE_ROOT);
    runs.push(oracle, candidate);
    comparisons.push({
      id: runtimeId,
      ...compare(oracle.result, candidate.result)
    });
  }
} else {
  for (const [runtimeId, image] of dockerImages) {
    skippedRuntimes.push({
      id: runtimeId,
      image,
      reason: "docker server unavailable"
    });
  }
}

const failedComparisons = comparisons.filter((entry) => !entry.matches);
if (failedComparisons.length > 0) {
  console.error(JSON.stringify({ status: "failed", failedComparisons }, null, 2));
  process.exit(1);
}

const sourceUnits = SOURCE_FILES.map(sourceRecord);
const upstreamDigest = sha256(JSON.stringify(sourceUnits.map((unit) => ({ path: unit.path, sha256: unit.sha256 }))));
const manifest = {
  schema: "wphx.wp-core-multisite-signup-lifecycle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-multisite-signup-lifecycle-fixture.mjs",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    bootstrap_routing_fixture: inputRecord(BOOTSTRAP_ROUTING),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    source_units: sourceUnits,
    upstream_digest: upstreamDigest
  },
  fixture: {
    candidate_kind: "oracle_source_mirror",
    source_domain: surface.domains.find((domain) => domain.id === "signup_lifecycle")?.label ?? "multisite signup and lifecycle",
    evidence_class: "targeted_semantic_parity",
    artifact_scope: "oracle_mirror_fixture",
    covered_symbols: COVERED_SYMBOLS,
    cases: FIXTURE_CASES,
    native_boundaries: [
      {
        id: "wpdb-signup-lifecycle-test-double",
        reason:
          "The probe supplies deterministic wp_signups, wp_blogs, and option behavior so real ms-functions.php signup/lifecycle branches can execute without a live database."
      },
      {
        id: "mail-action-request-state",
        reason:
          "wp_mail, do_action, apply_filters, request URI, and REMOTE_ADDR are captured as structured observations because plugins and site admins can observe these side effects."
      },
      {
        id: "wp-die-capture",
        reason:
          "wp_die is converted to a typed exception inside the probe so success/failure messages and response codes can be compared without terminating the runner."
      }
    ],
    follow_up_owner: "WPHX-317.07"
  },
  runtimes: {
    local: {
      id: "local-php-cli",
      php_version: localOracle.result.phpVersion,
      executable: lock.tools.php_cli.executable
    },
    docker: dockerImages.map(([id, image]) => ({ id, image })),
    skipped: skippedRuntimes
  },
  canonical_observations: normalize(localOracle.result),
  runs: runs.map(runSummary),
  comparisons: comparisons.map(comparisonSummary),
  remaining_gaps: [
    {
      id: "haxe-candidate-not-yet-installed",
      owner: "WPHX-317.07",
      detail: "The candidate side is a copied WordPress oracle source tree until multisite lifecycle functions are emitted from Haxe-owned sources."
    },
    {
      id: "live-database-not-yet-authoritative",
      owner: "WPHX-322",
      detail: "This fixture uses deterministic PHP test doubles; live database, email transport, installed signup page, and multisite admin parity remain later installed/distribution gates."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    candidate_kind: "oracle_source_mirror",
    covered_symbols: COVERED_SYMBOLS.length,
    fixture_cases: FIXTURE_CASES.length,
    comparisons: comparisons.length,
    skipped_runtimes: skippedRuntimes.length
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha, upstreamDigest), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-317-06-multisite-signup-lifecycle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    {
      path: OUT,
      role: "multisite signup, lifecycle, counts, quota, and notification fixture manifest"
    },
    {
      path: OWNERSHIP,
      role: "external-oracle ownership manifest for the signup/lifecycle fixture harness"
    },
    {
      path: "tools/wp-core/run-multisite-signup-lifecycle-fixture.mjs",
      role: "fixture generator and check-mode validator"
    }
  ],
  verification_commands: [
    "npm run wp:core:wphx-317-signup-lifecycle",
    "npm run wp:core:wphx-317-signup-lifecycle:check",
    "npm run beads:validate",
    "npm run receipts:validate"
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

console.log(JSON.stringify(manifest.validation_result, null, 2));
