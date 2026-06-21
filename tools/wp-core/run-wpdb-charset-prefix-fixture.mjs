#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.9.5",
  external_ref: "WPHX-305.05",
  title: "Build charset/collation and prefix fixture harness"
};
const OUT_ROOT = "build/wp-core/wphx-305-05";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-305-05-wpdb-charset-prefix-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-305-05-wpdb-charset-prefix-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-305-05-wpdb-charset-prefix-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-305-01-wpdb-surface.v1.json";
const WRITE_FIXTURE = "manifests/wp-core/wphx-305-04-wpdb-write-fields-fixture.v1.json";
const RECORDED_AT = "2026-06-21T02:05:00.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const UPSTREAM_ROOT = "../wordpress-develop";
const SCENARIOS = ["single", "multisite"];

const SOURCE_FILES = [
  "src/wp-includes/class-wp-hook.php",
  "src/wp-includes/plugin.php",
  "src/wp-includes/class-wp-error.php",
  "src/wp-includes/load.php",
  "src/wp-includes/class-wpdb.php"
];

const COVERED_SYMBOLS = [
  "wpdb::init_charset",
  "wpdb::determine_charset",
  "wpdb::set_charset",
  "wpdb::get_table_charset",
  "wpdb::get_col_charset",
  "wpdb::get_col_length",
  "wpdb::check_safe_collation",
  "wpdb::get_table_from_query",
  "wpdb::get_charset_collate",
  "wpdb::supports_collation",
  "wpdb::has_cap",
  "wpdb::db_version",
  "wpdb::db_server_info",
  "wpdb::set_prefix",
  "wpdb::set_blog_id",
  "wpdb::get_blog_prefix",
  "wpdb::tables",
  "wpdb::parse_db_host",
  "wp_set_wpdb_vars",
  "is_multisite"
];

const FIXTURE_CASES = [
  { id: "charset:init-and-collate", symbol: "wpdb::init_charset/wpdb::get_charset_collate", focus: "DB_CHARSET/DB_COLLATE bootstrap constants and charset/collate string rendering" },
  { id: "charset:determine-no-live-db", symbol: "wpdb::determine_charset", focus: "no-mysqli boundary where charset/collate inputs are preserved" },
  { id: "capabilities:server-version-matrix", symbol: "wpdb::has_cap/wpdb::db_version", focus: "server version parsing and capability switches without a live mysqli handle" },
  { id: "charset:set-charset-noop-boundary", symbol: "wpdb::set_charset", focus: "set_charset collation-capability guard before native mysqli calls" },
  { id: "table-charset:discovery-cache-filter", symbol: "wpdb::get_table_charset", focus: "SHOW FULL COLUMNS metadata interpretation, binary/ascii/latin1 handling, caching, and pre_get_table_charset filter short-circuit" },
  { id: "column-meta:charset-length", symbol: "wpdb::get_col_charset/wpdb::get_col_length", focus: "primed column charset and length lookup from table metadata" },
  { id: "safe-collation:query-checks", symbol: "wpdb::check_safe_collation", focus: "ASCII fast path, non-ASCII table extraction, safe/unsafe collation lists, latin1 shortcut, and missing-table failure" },
  { id: "query-parser:table-from-query", symbol: "wpdb::get_table_from_query", focus: "table name parsing across SELECT/INSERT/UPDATE/DELETE/DDL/SHOW forms" },
  { id: "prefix:bootstrap-vars-and-blog-switch", symbol: "wp_set_wpdb_vars/wpdb::set_prefix/wpdb::set_blog_id", focus: "field type bootstrap, base/blog prefix assignment, multisite blog switching, and custom user table constants" },
  { id: "prefix:invalid-and-blog-prefix-matrix", symbol: "wpdb::set_prefix/wpdb::get_blog_prefix", focus: "invalid prefix WP_Error and blog prefix matrix for single-site versus multisite scenarios" },
  { id: "tables:scope-matrix", symbol: "wpdb::tables", focus: "all/blog/global/ms_global/old table scopes with and without prefixes" },
  { id: "parse-db-host:host-shapes", symbol: "wpdb::parse_db_host", focus: "host, port, socket, IPv4, IPv6, bracketed IPv6, and invalid host parsing" },
  { id: "supports-collation:deprecated-facade", symbol: "wpdb::supports_collation", focus: "deprecated facade event and has_cap('collation') delegation" }
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
$scenario = $argv[2];
$root = rtrim( $argv[3], '/\\\\' );

error_reporting( E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED );
ini_set( 'display_errors', '0' );
ini_set( 'log_errors', '0' );

register_shutdown_function(
\tfunction () {
\t\t$error = error_get_last();
\t\tif ( $error && in_array( $error['type'], array( E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR ), true ) ) {
\t\t\tfwrite( STDERR, json_encode( array( 'fatal' => $error ), JSON_UNESCAPED_SLASHES ) . PHP_EOL );
\t\t}
\t}
);

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'WP_DEBUG', false );
define( 'WP_DEBUG_DISPLAY', false );
define( 'WP_SETUP_CONFIG', true );
define( 'AUTH_SALT', 'wphx-305-05-auth-salt' );
define( 'DB_CHARSET', 'utf8' );
define( 'DB_COLLATE', 'utf8_general_ci' );
define( 'MULTISITE', 'multisite' === $scenario );
define( 'CUSTOM_USER_TABLE', 'custom_users' );
define( 'CUSTOM_USER_META_TABLE', 'custom_usermeta' );

$GLOBALS['wphx_305_05_events'] = array();

function wphx_305_05_event( $type, $payload = array() ) {
\t$GLOBALS['wphx_305_05_events'][] = array(
\t\t'type'    => $type,
\t\t'payload' => $payload,
\t);
}

if ( ! function_exists( '__' ) ) {
\tfunction __( $text, $domain = 'default' ) {
\t\treturn $text;
\t}
}

if ( ! function_exists( '_deprecated_function' ) ) {
\tfunction _deprecated_function( $function_name, $version, $replacement = '' ) {
\t\twphx_305_05_event(
\t\t\t'deprecated_function',
\t\t\tarray(
\t\t\t\t'function'    => $function_name,
\t\t\t\t'version'     => $version,
\t\t\t\t'replacement' => $replacement,
\t\t\t)
\t\t);
\t}
}

if ( ! function_exists( 'wp_die' ) ) {
\tfunction wp_die( $message = '', $title = '', $args = array() ) {
\t\twphx_305_05_event(
\t\t\t'wp_die',
\t\t\tarray(
\t\t\t\t'message' => $message,
\t\t\t\t'title'   => $title,
\t\t\t\t'args'    => $args,
\t\t\t)
\t\t);
\t\treturn false;
\t}
}

require_once ABSPATH . WPINC . '/plugin.php';
require_once ABSPATH . WPINC . '/class-wp-error.php';
require_once ABSPATH . WPINC . '/load.php';
require_once ABSPATH . WPINC . '/class-wpdb.php';

class WPHX_305_05_WPDB extends wpdb {
\tpublic $result_events = array();
\tpublic $server_info = '8.0.36';

\tpublic function reset_fixture_state() {
\t\t$this->ready               = true;
\t\t$this->result_events       = array();
\t\t$this->queries             = array();
\t\t$this->insert_id           = 0;
\t\t$this->last_error          = '';
\t\t$this->num_queries         = 0;
\t\t$this->rows_affected       = 0;
\t\t$this->num_rows            = 0;
\t\t$this->last_query          = null;
\t\t$this->last_result         = array();
\t\t$this->col_info            = null;
\t\t$this->func_call           = null;
\t\t$this->check_current_query = true;
\t\t$this->checking_collation  = false;
\t\t$this->is_mysql            = true;
\t\t$this->charset             = '';
\t\t$this->collate             = '';
\t\t$this->prefix              = '';
\t\t$this->base_prefix         = '';
\t\t$this->blogid              = 0;
\t\t$this->siteid              = 1;
\t\t$this->field_types         = array();
\t\t$this->table_charset       = array();
\t\t$this->col_meta            = array();
\t\t$this->server_info         = '8.0.36';
\t\t$this->dbh                 = null;
\t}

\tpublic function set_server_info( $server_info ) {
\t\t$this->server_info = $server_info;
\t}

\tpublic function db_server_info() {
\t\treturn $this->server_info;
\t}

\tpublic function public_get_table_charset( $table ) {
\t\treturn $this->get_table_charset( $table );
\t}

\tpublic function public_check_safe_collation( $query ) {
\t\treturn $this->check_safe_collation( $query );
\t}

\tpublic function public_get_table_from_query( $query ) {
\t\treturn $this->get_table_from_query( $query );
\t}

\tpublic function public_table_charset_cache() {
\t\treturn $this->table_charset;
\t}

\tpublic function public_col_meta_summary() {
\t\t$summary = array();
\t\tforeach ( $this->col_meta as $table => $columns ) {
\t\t\t$summary[ $table ] = array();
\t\t\tforeach ( $columns as $name => $column ) {
\t\t\t\t$summary[ $table ][ $name ] = array(
\t\t\t\t\t'Field'     => $column->Field,
\t\t\t\t\t'Type'      => $column->Type,
\t\t\t\t\t'Collation' => $column->Collation,
\t\t\t\t);
\t\t\t}
\t\t}
\t\treturn $summary;
\t}

\tpublic function public_col_meta_counts() {
\t\t$summary = array();
\t\tforeach ( $this->col_meta as $table => $columns ) {
\t\t\t$summary[ $table ] = array(
\t\t\t\t'columnCount' => count( $columns ),
\t\t\t\t'columns'     => array_keys( $columns ),
\t\t\t);
\t\t}
\t\treturn $summary;
\t}

\tprivate function column( $field, $type, $collation ) {
\t\treturn (object) array(
\t\t\t'Field'     => $field,
\t\t\t'Type'      => $type,
\t\t\t'Collation' => $collation,
\t\t);
\t}

\tprivate function fixture_columns_for_table( $table ) {
\t\t$tables = array(
\t\t\t'wp_posts' => array(
\t\t\t\t$this->column( 'ID', 'bigint(20) unsigned', null ),
\t\t\t\t$this->column( 'post_title', 'varchar(255)', 'utf8mb4_unicode_ci' ),
\t\t\t\t$this->column( 'post_content', 'longtext', 'utf8mb4_unicode_ci' ),
\t\t\t),
\t\t\t'fixture.wp_posts' => array(
\t\t\t\t$this->column( 'ID', 'bigint(20) unsigned', null ),
\t\t\t\t$this->column( 'post_title', 'varchar(255)', 'utf8mb4_unicode_ci' ),
\t\t\t),
\t\t\t'wp_legacy' => array(
\t\t\t\t$this->column( 'legacy_title', 'varchar(40)', 'utf8_general_ci' ),
\t\t\t\t$this->column( 'latin_note', 'varchar(40)', 'latin1_swedish_ci' ),
\t\t\t),
\t\t\t'wp_mixed' => array(
\t\t\t\t$this->column( 'short_title', 'varchar(40)', 'utf8_general_ci' ),
\t\t\t\t$this->column( 'long_title', 'varchar(40)', 'utf8mb4_general_ci' ),
\t\t\t),
\t\t\t'wp_ascii' => array(
\t\t\t\t$this->column( 'name', 'varchar(40)', 'utf8_general_ci' ),
\t\t\t\t$this->column( 'foreign_name', 'varchar(40)', 'cp1251_general_ci' ),
\t\t\t),
\t\t\t'wp_binary' => array(
\t\t\t\t$this->column( 'payload', 'blob', null ),
\t\t\t\t$this->column( 'label', 'varchar(40)', 'utf8mb4_general_ci' ),
\t\t\t),
\t\t\t'wp_nocollation' => array(
\t\t\t\t$this->column( 'id', 'bigint(20)', null ),
\t\t\t\t$this->column( 'created', 'datetime', null ),
\t\t\t),
\t\t\t'wp_safe' => array(
\t\t\t\t$this->column( 'name', 'varchar(40)', 'utf8mb4_general_ci' ),
\t\t\t\t$this->column( 'description', 'text', 'utf8_general_ci' ),
\t\t\t),
\t\t\t'wp_unsafe' => array(
\t\t\t\t$this->column( 'name', 'varchar(40)', 'utf8mb4_unicode_ci' ),
\t\t\t),
\t\t\t'wp_latin' => array(
\t\t\t\t$this->column( 'name', 'varchar(40)', 'latin1_swedish_ci' ),
\t\t\t),
\t\t);
\t\treturn $tables[ strtolower( $table ) ] ?? array();
\t}

\tpublic function get_results( $query = null, $output = OBJECT ) {
\t\t$table = null;
\t\t$rows  = array();
\t\tif ( preg_match( '/SHOW FULL COLUMNS FROM (.+)$/i', (string) $query, $matches ) ) {
\t\t\t$table = str_replace( chr( 96 ), '', $matches[1] );
\t\t\t$rows  = $this->fixture_columns_for_table( $table );
\t\t}
\t\t$this->result_events[] = array(
\t\t\t'query'  => $query,
\t\t\t'output' => $output,
\t\t\t'table'  => $table,
\t\t\t'rows'   => count( $rows ),
\t\t);
\t\treturn $rows;
\t}
}

$wpdb = new WPHX_305_05_WPDB( '', '', '', '' );
$wpdb->reset_fixture_state();
$GLOBALS['wpdb'] = $wpdb;
$GLOBALS['table_prefix'] = 'wp_';

function wphx_305_05_reset_events() {
\t$GLOBALS['wphx_305_05_events'] = array();
}

function wphx_305_05_runtime_reset() {
\tglobal $wpdb, $table_prefix;
\t$wpdb->reset_fixture_state();
\t$table_prefix = 'wp_';
\twphx_305_05_reset_events();
}

function wphx_305_05_normalize_string( $value ) {
\treturn (string) $value;
}

function wphx_305_05_scalar( $value ) {
\tif ( is_int( $value ) ) {
\t\treturn array( 'type' => 'int', 'value' => $value );
\t}
\tif ( is_float( $value ) ) {
\t\treturn array( 'type' => 'float', 'value' => $value );
\t}
\tif ( is_bool( $value ) ) {
\t\treturn array( 'type' => 'bool', 'value' => $value );
\t}
\tif ( null === $value ) {
\t\treturn array( 'type' => 'null', 'value' => null );
\t}
\t$value = wphx_305_05_normalize_string( $value );
\treturn array(
\t\t'type'   => 'string',
\t\t'value'  => $value,
\t\t'hex'    => bin2hex( $value ),
\t\t'bytes'  => strlen( $value ),
\t\t'sha256' => hash( 'sha256', $value ),
\t);
}

function wphx_305_05_value( $value ) {
\tif ( is_array( $value ) ) {
\t\t$entries = array();
\t\tforeach ( $value as $key => $entry_value ) {
\t\t\t$entries[] = array(
\t\t\t\t'key'   => wphx_305_05_scalar( $key ),
\t\t\t\t'value' => wphx_305_05_value( $entry_value ),
\t\t\t);
\t\t}
\t\treturn array(
\t\t\t'type'    => 'array',
\t\t\t'count'   => count( $value ),
\t\t\t'entries' => $entries,
\t\t);
\t}
\tif ( is_object( $value ) ) {
\t\treturn array(
\t\t\t'type'       => 'object',
\t\t\t'class'      => get_class( $value ),
\t\t\t'properties' => wphx_305_05_value( get_object_vars( $value ) ),
\t\t);
\t}
\treturn wphx_305_05_scalar( $value );
}

function wphx_305_05_events() {
\t$events = array();
\tforeach ( $GLOBALS['wphx_305_05_events'] as $event ) {
\t\t$events[] = wphx_305_05_value( $event );
\t}
\treturn $events;
}

function wphx_305_05_state() {
\tglobal $wpdb;
\treturn array(
\t\t'charset'       => $wpdb->charset,
\t\t'collate'       => $wpdb->collate,
\t\t'prefix'        => $wpdb->prefix,
\t\t'base_prefix'   => $wpdb->base_prefix,
\t\t'blogid'        => $wpdb->blogid,
\t\t'siteid'        => $wpdb->siteid,
\t\t'users'         => $wpdb->users ?? null,
\t\t'usermeta'      => $wpdb->usermeta ?? null,
\t\t'posts'         => $wpdb->posts ?? null,
\t\t'options'       => $wpdb->options ?? null,
\t\t'field_types'   => array(
\t\t\t'count' => count( $wpdb->field_types ),
\t\t\t'ID'    => $wpdb->field_types['ID'] ?? null,
\t\t\t'blog_id' => $wpdb->field_types['blog_id'] ?? null,
\t\t),
\t);
}

function wphx_305_05_case( $id, $symbol, $callback ) {
\twphx_305_05_runtime_reset();
\t$error = null;
\ttry {
\t\t$value = $callback();
\t} catch ( Throwable $throwable ) {
\t\t$error = array(
\t\t\t'class'   => get_class( $throwable ),
\t\t\t'message' => $throwable->getMessage(),
\t\t);
\t\t$value = null;
\t}
\treturn array(
\t\t'id'     => $id,
\t\t'symbol' => $symbol,
\t\t'value'  => wphx_305_05_value( $value ),
\t\t'error'  => null === $error ? null : wphx_305_05_value( $error ),
\t\t'events' => wphx_305_05_events(),
\t);
}

function wphx_305_05_run_cases() {
\tglobal $wpdb, $table_prefix, $scenario;

\t$cases = array();

\t$cases[] = wphx_305_05_case(
\t\t'charset:init-and-collate',
\t\t'wpdb::init_charset/wpdb::get_charset_collate',
\t\tfunction () use ( $wpdb, $scenario ) {
\t\t\t$wpdb->init_charset();
\t\t\treturn array(
\t\t\t\t'scenario'        => $scenario,
\t\t\t\t'isMultisite'     => is_multisite(),
\t\t\t\t'constants'       => array(
\t\t\t\t\t'DB_CHARSET' => DB_CHARSET,
\t\t\t\t\t'DB_COLLATE' => DB_COLLATE,
\t\t\t\t\t'MULTISITE'  => MULTISITE,
\t\t\t\t),
\t\t\t\t'charsetCollate' => $wpdb->get_charset_collate(),
\t\t\t\t'state'          => wphx_305_05_state(),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_05_case(
\t\t'charset:determine-no-live-db',
\t\t'wpdb::determine_charset',
\t\tfunction () use ( $wpdb ) {
\t\t\treturn array(
\t\t\t\t'utf8General' => $wpdb->determine_charset( 'utf8', 'utf8_general_ci' ),
\t\t\t\t'utf8mb4Empty' => $wpdb->determine_charset( 'utf8mb4', '' ),
\t\t\t\t'latin1'      => $wpdb->determine_charset( 'latin1', 'latin1_swedish_ci' ),
\t\t\t\t'nativeBoundary' => 'no live mysqli handle: determine_charset returns the requested charset/collate pair',
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_05_case(
\t\t'capabilities:server-version-matrix',
\t\t'wpdb::has_cap/wpdb::db_version',
\t\tfunction () use ( $wpdb ) {
\t\t\t$versions = array( '4.0.30', '5.0.7', '5.6.51', '8.0.36', '10.6.14-MariaDB' );
\t\t\t$caps = array( 'collation', 'group_concat', 'subqueries', 'set_charset', 'utf8mb4', 'utf8mb4_520', 'identifier_placeholders', 'unknown' );
\t\t\t$matrix = array();
\t\t\tforeach ( $versions as $version ) {
\t\t\t\t$wpdb->set_server_info( $version );
\t\t\t\t$entry = array(
\t\t\t\t\t'serverInfo' => $wpdb->db_server_info(),
\t\t\t\t\t'dbVersion'  => $wpdb->db_version(),
\t\t\t\t\t'caps'       => array(),
\t\t\t\t);
\t\t\t\tforeach ( $caps as $cap ) {
\t\t\t\t\t$entry['caps'][ $cap ] = $wpdb->has_cap( $cap );
\t\t\t\t}
\t\t\t\t$matrix[] = $entry;
\t\t\t}
\t\t\treturn $matrix;
\t\t}
\t);

\t$cases[] = wphx_305_05_case(
\t\t'charset:set-charset-noop-boundary',
\t\t'wpdb::set_charset',
\t\tfunction () use ( $wpdb ) {
\t\t\t$wpdb->set_server_info( '4.0.30' );
\t\t\t$wpdb->charset = 'utf8';
\t\t\t$wpdb->collate = 'utf8_general_ci';
\t\t\t$return = $wpdb->set_charset( null );
\t\t\treturn array(
\t\t\t\t'return' => $return,
\t\t\t\t'hasCollation' => $wpdb->has_cap( 'collation' ),
\t\t\t\t'state' => wphx_305_05_state(),
\t\t\t\t'nativeBoundary' => 'high-capability set_charset path calls mysqli_set_charset()/mysqli_query() and is deferred to the live DB gate',
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_05_case(
\t\t'table-charset:discovery-cache-filter',
\t\t'wpdb::get_table_charset',
\t\tfunction () use ( $wpdb ) {
\t\t\t$tables = array( 'wp_posts', 'fixture.wp_posts', 'wp_legacy', 'wp_mixed', 'wp_ascii', 'wp_binary', 'wp_nocollation', 'wp_missing' );
\t\t\t$charsets = array();
\t\t\tforeach ( $tables as $table ) {
\t\t\t\t$charsets[ $table ] = $wpdb->public_get_table_charset( $table );
\t\t\t}
\t\t\t$cached = $wpdb->public_get_table_charset( 'wp_posts' );
\t\t\t$filter = function ( $charset, $table ) {
\t\t\t\treturn 'wp_filtered' === $table ? 'latin1' : $charset;
\t\t\t};
\t\t\tadd_filter( 'pre_get_table_charset', $filter, 10, 2 );
\t\t\t$filtered = $wpdb->public_get_table_charset( 'wp_filtered' );
\t\t\tremove_filter( 'pre_get_table_charset', $filter, 10 );
\t\t\treturn array(
\t\t\t\t'charsets' => $charsets,
\t\t\t\t'cachedWpPosts' => $cached,
\t\t\t\t'filtered' => $filtered,
\t\t\t\t'tableCharsetCache' => $wpdb->public_table_charset_cache(),
\t\t\t\t'colMeta' => $wpdb->public_col_meta_counts(),
\t\t\t\t'resultEvents' => $wpdb->result_events,
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_05_case(
\t\t'column-meta:charset-length',
\t\t'wpdb::get_col_charset/wpdb::get_col_length',
\t\tfunction () use ( $wpdb ) {
\t\t\t$wpdb->public_get_table_charset( 'wp_posts' );
\t\t\t$wpdb->public_get_table_charset( 'wp_binary' );
\t\t\treturn array(
\t\t\t\t'postTitleCharset' => $wpdb->get_col_charset( 'wp_posts', 'post_title' ),
\t\t\t\t'idCharset'        => $wpdb->get_col_charset( 'wp_posts', 'ID' ),
\t\t\t\t'missingCharset'   => $wpdb->get_col_charset( 'wp_posts', 'missing_column' ),
\t\t\t\t'postTitleLength'  => $wpdb->get_col_length( 'wp_posts', 'post_title' ),
\t\t\t\t'postContentLength' => $wpdb->get_col_length( 'wp_posts', 'post_content' ),
\t\t\t\t'idLength'         => $wpdb->get_col_length( 'wp_posts', 'ID' ),
\t\t\t\t'payloadLength'    => $wpdb->get_col_length( 'wp_binary', 'payload' ),
\t\t\t\t'colMeta'          => $wpdb->public_col_meta_counts(),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_05_case(
\t\t'safe-collation:query-checks',
\t\t'wpdb::check_safe_collation',
\t\tfunction () use ( $wpdb ) {
\t\t\t$non_ascii = 'caf' . chr( 195 ) . chr( 169 );
\t\t\treturn array(
\t\t\t\t'createQuery' => $wpdb->public_check_safe_collation( 'CREATE TABLE wp_safe (id int)' ),
\t\t\t\t'asciiSelect' => $wpdb->public_check_safe_collation( 'SELECT * FROM wp_safe WHERE name = "cafe"' ),
\t\t\t\t'safeSelect' => $wpdb->public_check_safe_collation( "SELECT * FROM wp_safe WHERE name = '$non_ascii'" ),
\t\t\t\t'unsafeSelect' => $wpdb->public_check_safe_collation( "SELECT * FROM wp_unsafe WHERE name = '$non_ascii'" ),
\t\t\t\t'latinSelect' => $wpdb->public_check_safe_collation( "SELECT * FROM wp_latin WHERE name = '$non_ascii'" ),
\t\t\t\t'missingSelect' => $wpdb->public_check_safe_collation( "SELECT * FROM wp_missing WHERE name = '$non_ascii'" ),
\t\t\t\t'resultEvents' => $wpdb->result_events,
\t\t\t\t'colMeta' => $wpdb->public_col_meta_counts(),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_05_case(
\t\t'query-parser:table-from-query',
\t\t'wpdb::get_table_from_query',
\t\tfunction () use ( $wpdb ) {
\t\t\t$queries = array(
\t\t\t\t'select' => 'SELECT p.ID FROM wp_posts p WHERE p.ID = 1',
\t\t\t\t'insert' => 'INSERT INTO wp_posts (ID) VALUES (1)',
\t\t\t\t'replace' => 'REPLACE LOW_PRIORITY INTO wp_posts VALUES (1)',
\t\t\t\t'update' => 'UPDATE IGNORE wp_posts SET post_title = "x"',
\t\t\t\t'delete' => 'DELETE FROM wp_posts WHERE ID = 1',
\t\t\t\t'showLike' => "SHOW TABLES LIKE 'wp\\\\_7\\\\_%'",
\t\t\t\t'create' => 'CREATE TABLE IF NOT EXISTS wp_new_table (id int)',
\t\t\t\t'alter' => 'ALTER TABLE wp_posts ADD COLUMN fixture int',
\t\t\t\t'dbQualified' => 'SELECT * FROM fixture.wp_posts',
\t\t\t\t'none' => 'SELECT 1',
\t\t\t);
\t\t\t$parsed = array();
\t\t\tforeach ( $queries as $id => $query ) {
\t\t\t\t$parsed[ $id ] = $wpdb->public_get_table_from_query( $query );
\t\t\t}
\t\t\treturn $parsed;
\t\t}
\t);

\t$cases[] = wphx_305_05_case(
\t\t'prefix:bootstrap-vars-and-blog-switch',
\t\t'wp_set_wpdb_vars/wpdb::set_prefix/wpdb::set_blog_id',
\t\tfunction () use ( $wpdb, &$table_prefix, $scenario ) {
\t\t\t$table_prefix = 'wp_';
\t\t\twp_set_wpdb_vars();
\t\t\t$after_bootstrap = wphx_305_05_state();
\t\t\t$blog_prefix_before = $wpdb->get_blog_prefix();
\t\t\t$old_blog_id = $wpdb->set_blog_id( 7, 2 );
\t\t\t$after_switch = wphx_305_05_state();
\t\t\treturn array(
\t\t\t\t'scenario' => $scenario,
\t\t\t\t'isMultisite' => is_multisite(),
\t\t\t\t'afterBootstrap' => $after_bootstrap,
\t\t\t\t'blogPrefixBeforeSwitch' => $blog_prefix_before,
\t\t\t\t'oldBlogId' => $old_blog_id,
\t\t\t\t'afterSwitch' => $after_switch,
\t\t\t\t'blogTablesFor7' => $wpdb->tables( 'blog', true, 7 ),
\t\t\t\t'globalTables' => $wpdb->tables( 'global', true ),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_05_case(
\t\t'prefix:invalid-and-blog-prefix-matrix',
\t\t'wpdb::set_prefix/wpdb::get_blog_prefix',
\t\tfunction () use ( $wpdb ) {
\t\t\t$invalid = $wpdb->set_prefix( 'bad-prefix!' );
\t\t\t$wpdb->set_prefix( 'wp_' );
\t\t\t$wpdb->set_blog_id( 7, 2 );
\t\t\t$blog_ids = array( null, 0, 1, 2, 7 );
\t\t\t$prefixes = array();
\t\t\tforeach ( $blog_ids as $blog_id ) {
\t\t\t\t$key = null === $blog_id ? 'null' : (string) $blog_id;
\t\t\t\t$prefixes[ $key ] = $wpdb->get_blog_prefix( $blog_id );
\t\t\t}
\t\t\treturn array(
\t\t\t\t'invalid' => $invalid,
\t\t\t\t'prefixes' => $prefixes,
\t\t\t\t'state' => wphx_305_05_state(),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_05_case(
\t\t'tables:scope-matrix',
\t\t'wpdb::tables',
\t\tfunction () use ( $wpdb ) {
\t\t\t$wpdb->set_prefix( 'wp_' );
\t\t\t$wpdb->set_blog_id( 7, 2 );
\t\t\t$scopes = array( 'all', 'blog', 'global', 'ms_global', 'old', 'unknown' );
\t\t\t$matrix = array();
\t\t\tforeach ( $scopes as $scope ) {
\t\t\t\t$matrix[ $scope ] = array(
\t\t\t\t\t'prefixed' => $wpdb->tables( $scope, true, 7 ),
\t\t\t\t\t'raw'      => $wpdb->tables( $scope, false, 7 ),
\t\t\t\t);
\t\t\t}
\t\t\treturn $matrix;
\t\t}
\t);

\t$cases[] = wphx_305_05_case(
\t\t'parse-db-host:host-shapes',
\t\t'wpdb::parse_db_host',
\t\tfunction () use ( $wpdb ) {
\t\t\t$hosts = array(
\t\t\t\t'localhost',
\t\t\t\t'localhost:3307',
\t\t\t\t'localhost:/tmp/mysql.sock',
\t\t\t\t'127.0.0.1:3307',
\t\t\t\t'[::1]:3307',
\t\t\t\t'::1',
\t\t\t\t'db.example.com:/tmp/mysql.sock',
\t\t\t\t'',
\t\t\t);
\t\t\t$parsed = array();
\t\t\tforeach ( $hosts as $host ) {
\t\t\t\t$parsed[ '' === $host ? 'empty' : $host ] = $wpdb->parse_db_host( $host );
\t\t\t}
\t\t\treturn $parsed;
\t\t}
\t);

\t$cases[] = wphx_305_05_case(
\t\t'supports-collation:deprecated-facade',
\t\t'wpdb::supports_collation',
\t\tfunction () use ( $wpdb ) {
\t\t\t$wpdb->set_server_info( '4.0.30' );
\t\t\t$old = $wpdb->supports_collation();
\t\t\t$wpdb->set_server_info( '5.0.7' );
\t\t\t$new = $wpdb->supports_collation();
\t\t\treturn array(
\t\t\t\t'oldServer' => $old,
\t\t\t\t'newServer' => $new,
\t\t\t);
\t\t}
\t);

\treturn $cases;
}

$snapshot = array(
\t'mode'                => $mode,
\t'scenario'            => $scenario,
\t'phpVersion'          => PHP_VERSION,
\t'coveredFunctionExists' => array(
\t\t'wp_set_wpdb_vars' => function_exists( 'wp_set_wpdb_vars' ),
\t\t'is_multisite'     => function_exists( 'is_multisite' ),
\t),
\t'coveredMethodExists' => array(
\t\t'init_charset'           => method_exists( $wpdb, 'init_charset' ),
\t\t'determine_charset'      => method_exists( $wpdb, 'determine_charset' ),
\t\t'set_charset'            => method_exists( $wpdb, 'set_charset' ),
\t\t'get_table_charset'      => method_exists( $wpdb, 'public_get_table_charset' ),
\t\t'get_col_charset'        => method_exists( $wpdb, 'get_col_charset' ),
\t\t'get_col_length'         => method_exists( $wpdb, 'get_col_length' ),
\t\t'check_safe_collation'   => method_exists( $wpdb, 'public_check_safe_collation' ),
\t\t'get_table_from_query'   => method_exists( $wpdb, 'public_get_table_from_query' ),
\t\t'get_charset_collate'    => method_exists( $wpdb, 'get_charset_collate' ),
\t\t'supports_collation'     => method_exists( $wpdb, 'supports_collation' ),
\t\t'has_cap'                => method_exists( $wpdb, 'has_cap' ),
\t\t'db_version'             => method_exists( $wpdb, 'db_version' ),
\t\t'db_server_info'         => method_exists( $wpdb, 'db_server_info' ),
\t\t'set_prefix'             => method_exists( $wpdb, 'set_prefix' ),
\t\t'set_blog_id'            => method_exists( $wpdb, 'set_blog_id' ),
\t\t'get_blog_prefix'        => method_exists( $wpdb, 'get_blog_prefix' ),
\t\t'tables'                 => method_exists( $wpdb, 'tables' ),
\t\t'parse_db_host'          => method_exists( $wpdb, 'parse_db_host' ),
\t),
\t'cases'               => wphx_305_05_run_cases(),
);

echo json_encode( $snapshot, JSON_UNESCAPED_SLASHES );
`
  );
}

function normalize(result) {
  return {
    scenario: result.scenario,
    coveredFunctionExists: result.coveredFunctionExists,
    coveredMethodExists: result.coveredMethodExists,
    cases: result.cases
  };
}

function runProbe(commandPath, runtimeId, mode, scenario, root) {
  const output = command(commandPath, [PROBE, mode, scenario, root]);
  return {
    id: `${runtimeId}:${mode}:${scenario}`,
    runtime: runtimeId,
    mode,
    scenario,
    command: `${commandPath} ${PROBE} ${mode} ${scenario} ${root}`,
    result: JSON.parse(output)
  };
}

function runDockerProbe(runtimeId, image, mode, scenario, root) {
  const dockerRoot = `/work/${root}`;
  const output = command("docker", ["run", "--rm", "-v", `${process.cwd()}:/work`, "-w", "/work", image, "php", PROBE, mode, scenario, dockerRoot]);
  return {
    id: `${runtimeId}:${mode}:${scenario}`,
    runtime: runtimeId,
    mode,
    scenario,
    command: `docker run --rm -v $PWD:/work -w /work ${image} php ${PROBE} ${mode} ${scenario} ${dockerRoot}`,
    image,
    result: JSON.parse(output)
  };
}

function compare(oracleResult, candidateResult) {
  const oracle = normalize(oracleResult);
  const candidate = normalize(candidateResult);
  const oracleText = JSON.stringify(oracle);
  const candidateText = JSON.stringify(candidate);
  const matches = oracleText === candidateText;
  return {
    matches,
    oracle_sha256: sha256(oracleText),
    candidate_sha256: sha256(candidateText),
    oracle_case_count: oracle.cases.length,
    candidate_case_count: candidate.cases.length,
    ...(matches ? {} : { oracle, candidate })
  };
}

function runSummary(run) {
  const normalized = normalize(run.result);
  return {
    id: run.id,
    runtime: run.runtime,
    mode: run.mode,
    scenario: run.scenario,
    command: run.command,
    image: run.image ?? null,
    php_version: run.result.phpVersion,
    case_count: normalized.cases.length,
    result_sha256: sha256(JSON.stringify(normalized))
  };
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-305-charset-prefix`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha, upstreamDigest) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wpdb-charset-prefix-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "workset",
      name: "wpdb charset/collation and prefix differential fixture harness",
      area: "wp-includes",
      public_contract:
        "WordPress 7.0 wpdb charset/collation setup, table metadata interpretation, safe-collation query checks, table-prefix/bootstrap behavior, multisite blog switching, host parsing, and server capability gates stay observable while the candidate side is still an oracle source mirror."
    },
    ownership_state: "external_oracle",
    upstream: {
      repo: UPSTREAM_ROOT,
      ref: WP_REF,
      paths: SOURCE_FILES,
      digest: upstreamDigest
    },
    owned_paths: ["tools/wp-core/run-wpdb-charset-prefix-fixture.mjs", OUT, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-305-charset-prefix",
        "npm run wp:core:wphx-305-charset-prefix:check",
        "npm run beads:validate",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-305-05-wpdb-charset-prefix-fixture"],
      manifest_digest: manifestSha
    },
    notes:
      "The candidate fixture root is an oracle source mirror for WPHX-305.05. The probe loads WordPress load.php and class-wpdb.php, runs separate single-site and multisite bootstrap scenarios, and isolates only live MySQL metadata/native charset calls behind deterministic table metadata and server-info test doubles."
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
for (const scenario of SCENARIOS) {
  const localOracle = runProbe("php", "local-php-cli", "oracle", scenario, ORACLE_ROOT);
  const localCandidate = runProbe("php", "local-php-cli", "candidate", scenario, CANDIDATE_ROOT);
  runs.push(localOracle, localCandidate);
  comparisons.push({
    id: `local-php-cli:${scenario}`,
    scenario,
    ...compare(localOracle.result, localCandidate.result)
  });
}

const dockerVersion = maybeCommand("docker", ["info", "--format", "{{.ServerVersion}}"]);
const dockerImages = [
  ["docker-php-8.4-cli", `${lock.container_images.php_8_4_cli.repository}@${lock.container_images.php_8_4_cli.index_digest}`],
  ["docker-php-8.5-cli", `${lock.container_images.php_8_5_cli.repository}@${lock.container_images.php_8_5_cli.index_digest}`]
];
const skippedRuntimes = [];

if (dockerVersion) {
  for (const [runtimeId, image] of dockerImages) {
    for (const scenario of SCENARIOS) {
      const oracle = runDockerProbe(runtimeId, image, "oracle", scenario, ORACLE_ROOT);
      const candidate = runDockerProbe(runtimeId, image, "candidate", scenario, CANDIDATE_ROOT);
      runs.push(oracle, candidate);
      comparisons.push({
        id: `${runtimeId}:${scenario}`,
        scenario,
        ...compare(oracle.result, candidate.result)
      });
    }
  }
} else {
  for (const [runtimeId, image] of dockerImages) {
    for (const scenario of SCENARIOS) {
      skippedRuntimes.push({
        id: `${runtimeId}:${scenario}`,
        image,
        scenario,
        reason: "docker server unavailable"
      });
    }
  }
}

const failedComparisons = comparisons.filter((entry) => !entry.matches);
if (failedComparisons.length > 0) {
  console.error(JSON.stringify({ status: "failed", failedComparisons }, null, 2));
  process.exit(1);
}

const sourceUnits = SOURCE_FILES.map(sourceRecord);
const upstreamDigest = sha256(JSON.stringify(sourceUnits.map((unit) => ({ path: unit.path, sha256: unit.sha256 }))));
const traceSamples = SCENARIOS.map((scenario) => {
  const run = runs.find((entry) => entry.runtime === "local-php-cli" && entry.mode === "oracle" && entry.scenario === scenario);
  return {
    id: run.id,
    runtime: run.runtime,
    mode: run.mode,
    scenario,
    result: normalize(run.result)
  };
});
const charsetDomain = surface.domains.find((domain) => domain.id === "charset_collation")?.label ?? "Charset, collation, safe-collation checks, and invalid text stripping";
const prefixDomain = surface.domains.find((domain) => domain.id === "tables_prefix_multisite")?.label ?? "Table lists, prefixes, blog switching, and multisite table state";
const bootstrapDomain = surface.domains.find((domain) => domain.id === "bootstrap_connection")?.label ?? "Database bootstrap, connection, server capability, and unavailable database boundaries";
const manifest = {
  schema: "wphx.wp-core-wpdb-charset-prefix-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-wpdb-charset-prefix-fixture.mjs",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    write_process_fields_fixture: inputRecord(WRITE_FIXTURE),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    source_units: sourceUnits,
    upstream_digest: upstreamDigest
  },
  fixture: {
    candidate_kind: "oracle_source_mirror",
    source_domains: [charsetDomain, prefixDomain, bootstrapDomain],
    scenarios: SCENARIOS,
    covered_symbols: COVERED_SYMBOLS,
    cases: FIXTURE_CASES,
    native_boundaries: [
      {
        id: "live-mysqli-charset-set",
        reason:
          "wpdb::set_charset() calls mysqli_set_charset() and mysqli_query() only when a live high-capability mysqli handle exists. The fixture records the pre-native no-op guard and leaves live charset negotiation to the DB runtime gate."
      },
      {
        id: "live-table-metadata",
        reason:
          "wpdb::get_table_charset(), get_col_charset(), get_col_length(), and check_safe_collation() normally depend on SHOW FULL COLUMNS. The probe supplies deterministic column metadata while preserving WordPress metadata interpretation logic."
      },
      {
        id: "constant-driven-bootstrap",
        reason:
          "MULTISITE, DB_CHARSET, DB_COLLATE, CUSTOM_USER_TABLE, and CUSTOM_USER_META_TABLE are PHP constants. The fixture runs separate PHP processes for single-site and multisite scenarios so bootstrap behavior is recorded without redefining constants."
      },
      {
        id: "server-info-test-double",
        reason:
          "wpdb::has_cap() and db_version() are exercised through an overridden db_server_info() provider so capability logic is covered without a live database connection."
      }
    ],
    follows: ["WPHX-305.01", "WPHX-305.04"],
    follow_up_owner: "WPHX-305.06"
  },
  runtimes: {
    local: {
      id: "local-php-cli",
      php_version: runs.find((run) => run.runtime === "local-php-cli")?.result.phpVersion ?? null,
      executable: lock.tools.php_cli.executable
    },
    docker: dockerImages.map(([id, image]) => ({ id, image })),
    skipped: skippedRuntimes
  },
  run_summaries: runs.map(runSummary),
  trace_samples: traceSamples,
  comparisons,
  remaining_gaps: [
    {
      id: "haxe-candidate-not-yet-installed",
      owner: "WPHX-305",
      detail: "The candidate side is a copied WordPress oracle source tree until charset/collation and prefix helpers are promoted behind typed Haxe parity candidates."
    },
    {
      id: "live-mysqli-charset-negotiation-not-yet-covered",
      owner: "WPHX-305.06",
      detail: "The fixture avoids real MySQL handles. Native mysqli_set_charset(), SET NAMES execution, and server-reported charset behavior need the database runtime integration harness."
    },
    {
      id: "live-information-schema-not-yet-covered",
      owner: "WPHX-305.06",
      detail: "SHOW FULL COLUMNS output is deterministic fixture data here. Real server metadata, permissions failures, and database-qualified table names need the DB runtime harness."
    },
    {
      id: "full-upstream-phpunit-not-yet-ported",
      owner: "WPHX-305",
      detail: "This fixture covers seed traces from the upstream db tests. Full upstream wpdb PHPUnit parity remains a domain-level closure requirement."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    candidate_kind: "oracle_source_mirror",
    covered_symbols: COVERED_SYMBOLS.length,
    fixture_cases: FIXTURE_CASES.length,
    scenarios: SCENARIOS.length,
    comparisons: comparisons.length,
    skipped_runtimes: skippedRuntimes.length
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha, upstreamDigest), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-305-05-wpdb-charset-prefix-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    {
      path: OUT,
      role: "wpdb charset/collation and prefix differential fixture manifest"
    },
    {
      path: OWNERSHIP,
      role: "external-oracle ownership manifest for the fixture harness"
    },
    {
      path: "tools/wp-core/run-wpdb-charset-prefix-fixture.mjs",
      role: "fixture generator and check-mode validator"
    }
  ],
  verification_commands: [
    "npm run wp:core:wphx-305-charset-prefix",
    "npm run wp:core:wphx-305-charset-prefix:check",
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

console.log(
  JSON.stringify(
    {
      status: "passed",
      output: OUT,
      ownership: OWNERSHIP,
      receipt: RECEIPT,
      covered_symbols: COVERED_SYMBOLS.length,
      fixture_cases: FIXTURE_CASES.length,
      scenarios: SCENARIOS.length,
      comparisons: comparisons.length,
      skipped_runtimes: skippedRuntimes.length
    },
    null,
    2
  )
);
