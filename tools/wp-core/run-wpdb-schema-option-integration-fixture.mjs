#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.9.6",
  external_ref: "WPHX-305.06",
  title: "Build dbDelta and option-storage database integration harness"
};
const OUT_ROOT = "build/wp-core/wphx-305-06";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-305-06-wpdb-schema-option-integration-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-305-06-wpdb-schema-option-integration-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-305-06-wpdb-schema-option-integration-fixture.v1.json";
const WPDB_SURFACE = "manifests/wp-core/wphx-305-01-wpdb-surface.v1.json";
const PREPARE_FIXTURE = "manifests/wp-core/wphx-305-02-wpdb-prepare-escaping-fixture.v1.json";
const QUERY_FIXTURE = "manifests/wp-core/wphx-305-03-wpdb-query-results-fixture.v1.json";
const WRITE_FIXTURE = "manifests/wp-core/wphx-305-04-wpdb-write-fields-fixture.v1.json";
const CHARSET_PREFIX_FIXTURE = "manifests/wp-core/wphx-305-05-wpdb-charset-prefix-fixture.v1.json";
const OPTION_STORAGE_FIXTURE = "manifests/wp-core/wphx-304-02-option-storage-fixture.v1.json";
const TRANSIENT_FIXTURE = "manifests/wp-core/wphx-304-03-transient-fixture.v1.json";
const RECORDED_AT = "2026-06-21T03:20:00.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const UPSTREAM_ROOT = "../wordpress-develop";

const SOURCE_FILES = [
  "src/wp-includes/class-wp-hook.php",
  "src/wp-includes/compat.php",
  "src/wp-includes/utf8.php",
  "src/wp-includes/load.php",
  "src/wp-includes/plugin.php",
  "src/wp-includes/class-wp-error.php",
  "src/wp-includes/class-wpdb.php",
  "src/wp-includes/cache.php",
  "src/wp-includes/class-wp-object-cache.php",
  "src/wp-includes/functions.php",
  "src/wp-includes/kses.php",
  "src/wp-includes/formatting.php",
  "src/wp-includes/option.php",
  "src/wp-admin/includes/schema.php",
  "src/wp-admin/includes/upgrade.php"
];

const COVERED_SYMBOLS = [
  "maybe_create_table",
  "maybe_add_column",
  "dbDelta",
  "wp_get_db_schema",
  "wp_should_upgrade_global_tables",
  "wpdb::prepare",
  "wpdb::get_var",
  "wpdb::get_row",
  "wpdb::get_col",
  "wpdb::get_results",
  "wpdb::query",
  "wpdb::update",
  "wpdb::delete",
  "wpdb::get_charset_collate",
  "wpdb::tables",
  "wpdb::set_prefix",
  "wpdb::set_blog_id",
  "wpdb::db_version",
  "wpdb::db_server_info",
  "wp_load_alloptions",
  "get_option",
  "get_options",
  "add_option",
  "update_option",
  "delete_option",
  "wp_prime_option_caches",
  "wp_set_option_autoload_values",
  "set_transient",
  "get_transient",
  "delete_transient",
  "delete_expired_transients"
];

const FIXTURE_CASES = [
  { id: "schema:maybe-create-table", symbol: "maybe_create_table", focus: "existing table short-circuit and missing table creation with SHOW TABLES verification" },
  { id: "schema:maybe-add-column", symbol: "maybe_add_column", focus: "DESC column discovery, existing-column short-circuit, and ALTER TABLE ADD COLUMN execution" },
  { id: "schema:dbdelta-plan-no-execute", symbol: "dbDelta", focus: "schema diff planning without execution: column type/default changes, added columns, and missing index reporting" },
  { id: "schema:dbdelta-execute-and-dml", symbol: "dbDelta", focus: "executed ALTER/INSERT/UPDATE query ordering and deterministic schema-state mutation" },
  { id: "schema:wp-get-db-schema-blog-scope", symbol: "wp_get_db_schema", focus: "blog-scope schema generation through wpdb charset/collation and prefix/table state" },
  { id: "schema:global-upgrade-filter", symbol: "wp_should_upgrade_global_tables/dbDelta", focus: "global-table dbDelta filtering via wp_should_upgrade_global_tables" },
  { id: "options:autoload-add-update-delete", symbol: "wp_load_alloptions/get_option/add_option/update_option/delete_option", focus: "real option.php cache/storage flow backed by a wpdb subclass rather than a standalone option double" },
  { id: "options:batch-prime-and-autoload", symbol: "get_options/wp_prime_option_caches/wp_set_option_autoload_values", focus: "batch option priming and autoload column updates over wpdb query methods" },
  { id: "transients:database-backed", symbol: "set_transient/get_transient/delete_transient", focus: "non-expiring transient value path through option-table storage with external object cache disabled" },
  { id: "transients:delete-expired-sql", symbol: "delete_expired_transients", focus: "expired transient cleanup SQL boundary and option-table row mutation" }
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

function writeAdminStub(root) {
  const target = `${root}/wp-admin/includes/admin.php`;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(
    target,
    `<?php
/**
 * WPHX-305.06 fixture stub.
 *
 * upgrade.php requires the broad admin API for install/upgrade helpers. The
 * dbDelta/maybe_* symbols exercised here do not depend on that surface, so the
 * fixture records this as a boot boundary instead of mirroring wp-admin fully.
 */
`
  );
}

function mirrorSources(root) {
  for (const path of SOURCE_FILES) {
    const target = mirrorPath(root, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(upstreamPath(path), target);
  }
  writeAdminStub(root);
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
\t\tif ( $error && in_array( $error['type'], array( E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR ), true ) ) {
\t\t\tfwrite( STDERR, json_encode( array( 'fatal' => $error ), JSON_UNESCAPED_SLASHES ) . PHP_EOL );
\t\t}
\t}
);

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'WP_CONTENT_DIR', $root . '/wp-content' );
define( 'WP_ADMIN', true );
define( 'WP_DEBUG', false );
define( 'WP_DEBUG_DISPLAY', false );
define( 'WP_SETUP_CONFIG', true );
define( 'AUTH_SALT', 'wphx-305-06-auth-salt' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', 'utf8mb4_unicode_ci' );
define( 'MULTISITE', false );

$GLOBALS['wphx_305_06_events'] = array();

function wphx_305_06_event( $type, $payload = array() ) {
\t$GLOBALS['wphx_305_06_events'][] = array(
\t\t'type'    => $type,
\t\t'payload' => $payload,
\t);
}

require_once ABSPATH . WPINC . '/compat.php';
require_once ABSPATH . WPINC . '/utf8.php';
require_once ABSPATH . WPINC . '/load.php';
require_once ABSPATH . WPINC . '/plugin.php';
require_once ABSPATH . WPINC . '/class-wp-error.php';
require_once ABSPATH . WPINC . '/class-wpdb.php';

class WPHX_305_06_WPDB extends wpdb {
\tpublic $events = array();
\tpublic $server_info = '8.0.36';
\tprivate $option_rows = array();
\tprivate $schema_tables = array();
\tprivate $next_option_id = 1000;

\tpublic function reset_fixture_state() {
\t\t$this->ready               = true;
\t\t$this->events              = array();
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
\t\t$this->is_mysql            = true;
\t\t$this->charset             = 'utf8mb4';
\t\t$this->collate             = 'utf8mb4_unicode_ci';
\t\t$this->dbh                 = null;
\t\t$this->server_info         = '8.0.36';
\t\t$this->suppress_errors     = false;
\t\t$this->next_option_id      = 1000;
\t\t$this->set_prefix( 'wp_' );
\t\t$this->set_blog_id( 1, 1 );
\t\t$this->reset_option_rows();
\t\t$this->reset_schema_tables();
\t}

\tpublic function db_server_info() {
\t\treturn $this->server_info;
\t}

\tpublic function set_server_info( $server_info ) {
\t\t$this->server_info = $server_info;
\t}

\tpublic function _real_escape( $data ) {
\t\tif ( ! is_scalar( $data ) && null !== $data ) {
\t\t\t$data = json_encode( $data, JSON_UNESCAPED_SLASHES );
\t\t}
\t\treturn $this->add_placeholder_escape( addslashes( (string) $data ) );
\t}

\tpublic function prepare( $query, ...$args ) {
\t\tif ( 1 === count( $args ) && is_array( $args[0] ) ) {
\t\t\t$args = $args[0];
\t\t}
\t\t$prepared = parent::prepare( $query, ...$args );
\t\treturn array(
\t\t\t'query'              => $query,
\t\t\t'args'               => array_values( $args ),
\t\t\t'prepared'           => $prepared,
\t\t\t'preparedNormalized' => is_string( $prepared ) ? $this->remove_placeholder_escape( $prepared ) : $prepared,
\t\t);
\t}

\tprivate function reset_option_rows() {
\t\t$this->option_rows = array(
\t\t\t'siteurl'                       => array( 'option_id' => 1, 'option_value' => 'https://example.test/', 'autoload' => 'on' ),
\t\t\t'home'                          => array( 'option_id' => 2, 'option_value' => '', 'autoload' => 'on' ),
\t\t\t'wphx_autoloaded'               => array( 'option_id' => 3, 'option_value' => serialize( array( 'alpha' => 1, 'beta' => false ) ), 'autoload' => 'on' ),
\t\t\t'wphx_nonautoload'              => array( 'option_id' => 4, 'option_value' => 'stored-off', 'autoload' => 'off' ),
\t\t\t'wphx_bulk_on'                  => array( 'option_id' => 5, 'option_value' => 'bulk-on', 'autoload' => 'on' ),
\t\t\t'wphx_bulk_off'                 => array( 'option_id' => 6, 'option_value' => 'bulk-off', 'autoload' => 'off' ),
\t\t\t'wphx_delete_me'                => array( 'option_id' => 7, 'option_value' => 'delete-me', 'autoload' => 'off' ),
\t\t\t'_transient_wphx_stored'        => array( 'option_id' => 8, 'option_value' => 'stored-transient', 'autoload' => 'off' ),
\t\t\t'_transient_timeout_old_value'  => array( 'option_id' => 9, 'option_value' => '1', 'autoload' => 'off' ),
\t\t\t'_transient_old_value'          => array( 'option_id' => 10, 'option_value' => 'expired-transient', 'autoload' => 'off' ),
\t\t);
\t}

\tprivate function reset_schema_tables() {
\t\t$this->schema_tables = array(
\t\t\t'wp_existing' => array(
\t\t\t\t'columns' => array(
\t\t\t\t\t'id' => array( 'Field' => 'id', 'Type' => 'int(11)', 'Default' => '0' ),
\t\t\t\t),
\t\t\t\t'indexes' => array(),
\t\t\t),
\t\t\t'wp_addcol' => array(
\t\t\t\t'columns' => array(
\t\t\t\t\t'id' => array( 'Field' => 'id', 'Type' => 'int(11)', 'Default' => '0' ),
\t\t\t\t),
\t\t\t\t'indexes' => array(),
\t\t\t),
\t\t\t'wp_delta' => array(
\t\t\t\t'columns' => array(
\t\t\t\t\t'id'    => array( 'Field' => 'id', 'Type' => 'int(11)', 'Default' => '0' ),
\t\t\t\t\t'title' => array( 'Field' => 'title', 'Type' => 'varchar(20)', 'Default' => 'old' ),
\t\t\t\t),
\t\t\t\t'indexes' => array(
\t\t\t\t\t'primary' => array(
\t\t\t\t\t\tarray( 'Key_name' => 'PRIMARY', 'Column_name' => 'id', 'Sub_part' => null, 'Non_unique' => '0', 'Index_type' => 'BTREE' ),
\t\t\t\t\t),
\t\t\t\t),
\t\t\t),
\t\t\t'wp_users' => array(
\t\t\t\t'columns' => array(
\t\t\t\t\t'ID' => array( 'Field' => 'ID', 'Type' => 'bigint(20) unsigned', 'Default' => null ),
\t\t\t\t),
\t\t\t\t'indexes' => array(),
\t\t\t),
\t\t);
\t}

\tprivate function unpack_query( $query ) {
\t\tif ( is_array( $query ) ) {
\t\t\treturn array( $query['query'], $query['args'], $query['prepared'] ?? $query['query'] );
\t\t}
\t\treturn array( (string) $query, array(), (string) $query );
\t}

\tprivate function normalize_sql( $query ) {
\t\treturn preg_replace( '/\\s+/', ' ', trim( (string) $query ) );
\t}

\tprivate function record( $operation, $query, $args = array(), $extra = array() ) {
\t\tlist( , , $prepared ) = $this->unpack_query( $query );
\t\t$this->last_query = is_string( $prepared ) ? $prepared : (string) $query;
\t\t$this->num_queries++;
\t\t$query_text  = is_array( $query ) ? $query['query'] : $query;
\t\t$record_args = $args;
\t\t$prepared_normalized = is_array( $query ) && isset( $query['preparedNormalized'] ) ? (string) $query['preparedNormalized'] : null;
\t\tif ( false !== stripos( (string) $query_text, 'DELETE a, b FROM' ) ) {
\t\t\tif ( isset( $record_args[2] ) ) {
\t\t\t\t$record_args[2] = '__WPHX_CURRENT_TIME__';
\t\t\t}
\t\t\tif ( null !== $prepared_normalized ) {
\t\t\t\t$prepared_normalized = preg_replace( '/b\\.option_value\\s+<\\s+\\d+/', 'b.option_value < __WPHX_CURRENT_TIME__', $prepared_normalized );
\t\t\t}
\t\t}
\t\t$event = array(
\t\t\t'operation' => $operation,
\t\t\t'query'     => $this->normalize_sql( $query_text ),
\t\t\t'args'      => $record_args,
\t\t);
\t\tif ( null !== $prepared_normalized ) {
\t\t\t$event['preparedNormalizedSha256'] = hash( 'sha256', $prepared_normalized );
\t\t}
\t\t$this->events[] = array_merge( $event, $extra );
\t}

\tprivate function option_row_object( $name, $columns = array( 'option_name', 'option_value', 'autoload' ) ) {
\t\tif ( ! isset( $this->option_rows[ $name ] ) ) {
\t\t\treturn null;
\t\t}
\t\t$row = new stdClass();
\t\tif ( in_array( 'option_id', $columns, true ) ) {
\t\t\t$row->option_id = $this->option_rows[ $name ]['option_id'];
\t\t}
\t\tif ( in_array( 'option_name', $columns, true ) ) {
\t\t\t$row->option_name = $name;
\t\t}
\t\tif ( in_array( 'option_value', $columns, true ) ) {
\t\t\t$row->option_value = $this->option_rows[ $name ]['option_value'];
\t\t}
\t\tif ( in_array( 'autoload', $columns, true ) ) {
\t\t\t$row->autoload = $this->option_rows[ $name ]['autoload'];
\t\t}
\t\treturn $row;
\t}

\tprivate function column_object( $column ) {
\t\treturn (object) array(
\t\t\t'Field'   => $column['Field'],
\t\t\t'Type'    => $column['Type'],
\t\t\t'Default' => $column['Default'],
\t\t);
\t}

\tprivate function index_object( $index ) {
\t\treturn (object) array(
\t\t\t'Key_name'    => $index['Key_name'],
\t\t\t'Column_name' => $index['Column_name'],
\t\t\t'Sub_part'    => $index['Sub_part'],
\t\t\t'Non_unique'  => $index['Non_unique'],
\t\t\t'Index_type'  => $index['Index_type'],
\t\t);
\t}

\tprivate function table_name_from_show_tables_like( $args ) {
\t\t$name = $args[0] ?? null;
\t\tif ( null === $name ) {
\t\t\treturn null;
\t\t}
\t\t$name = str_replace( array( '\\\\_', '\\\\%' ), array( '_', '%' ), $name );
\t\treturn isset( $this->schema_tables[ $name ] ) ? $name : null;
\t}

\tprivate function table_name_from_desc( $sql ) {
\t\tif ( preg_match( '/^(?:DESC|DESCRIBE)\\s+([^;\\s]+)/i', $sql, $matches ) ) {
\t\t\treturn trim( $matches[1], ' ' . chr( 96 ) );
\t\t}
\t\tif ( preg_match( '/^SHOW\\s+INDEX\\s+FROM\\s+([^;\\s]+)/i', $sql, $matches ) ) {
\t\t\treturn trim( $matches[1], ' ' . chr( 96 ) );
\t\t}
\t\treturn null;
\t}

\tprivate function parse_create_table_name( $sql ) {
\t\tif ( preg_match( '/CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?([^\\s(]+)/i', $sql, $matches ) ) {
\t\t\treturn trim( $matches[1], ' ' . chr( 96 ) );
\t\t}
\t\treturn null;
\t}

\tprivate function parse_alter_table_name( $sql ) {
\t\tif ( preg_match( '/ALTER\\s+TABLE\\s+([^\\s]+)\\s+/i', $sql, $matches ) ) {
\t\t\treturn trim( $matches[1], ' ' . chr( 96 ) );
\t\t}
\t\treturn null;
\t}

\tprivate function apply_create_table( $sql ) {
\t\t$table = $this->parse_create_table_name( $sql );
\t\tif ( null === $table ) {
\t\t\treturn;
\t\t}
\t\tif ( isset( $this->schema_tables[ $table ] ) ) {
\t\t\treturn;
\t\t}
\t\t$this->schema_tables[ $table ] = array(
\t\t\t'columns' => array(
\t\t\t\t'id' => array( 'Field' => 'id', 'Type' => 'int(11)', 'Default' => '0' ),
\t\t\t),
\t\t\t'indexes' => array(),
\t\t);
\t}

\tprivate function apply_alter_table( $sql ) {
\t\t$table = $this->parse_alter_table_name( $sql );
\t\tif ( null === $table ) {
\t\t\treturn;
\t\t}
\t\tif ( ! isset( $this->schema_tables[ $table ] ) ) {
\t\t\t$this->schema_tables[ $table ] = array( 'columns' => array(), 'indexes' => array() );
\t\t}
\t\tif ( preg_match( '/ADD\\s+COLUMN\\s+\\x60?([A-Za-z0-9_]+)\\x60?\\s+([^\\s,]+)/i', $sql, $matches ) ) {
\t\t\t$this->schema_tables[ $table ]['columns'][ $matches[1] ] = array(
\t\t\t\t'Field'   => $matches[1],
\t\t\t\t'Type'    => strtolower( $matches[2] ),
\t\t\t\t'Default' => null,
\t\t\t);
\t\t}
\t\tif ( preg_match( '/CHANGE\\s+COLUMN\\s+\\x60?([A-Za-z0-9_]+)\\x60?\\s+\\x60?([A-Za-z0-9_]+)\\x60?\\s+([^\\s,]+)/i', $sql, $matches ) ) {
\t\t\t$default = $this->schema_tables[ $table ]['columns'][ $matches[2] ]['Default'] ?? null;
\t\t\t$this->schema_tables[ $table ]['columns'][ $matches[2] ] = array(
\t\t\t\t'Field'   => $matches[2],
\t\t\t\t'Type'    => strtolower( $matches[3] ),
\t\t\t\t'Default' => $default,
\t\t\t);
\t\t}
\t\tif ( preg_match( \"/ALTER\\s+COLUMN\\s+\\x60?([A-Za-z0-9_]+)\\x60?\\s+SET\\s+DEFAULT\\s+'([^']*)'/i\", $sql, $matches ) ) {
\t\t\tif ( isset( $this->schema_tables[ $table ]['columns'][ $matches[1] ] ) ) {
\t\t\t\t$this->schema_tables[ $table ]['columns'][ $matches[1] ]['Default'] = $matches[2];
\t\t\t}
\t\t}
\t\tif ( preg_match( '/ADD\\s+(?:KEY|INDEX)\\s+\\x60?([A-Za-z0-9_]+)\\x60?\\s*\\(([^)]+)\\)/i', $sql, $matches ) ) {
\t\t\t$column = trim( explode( ',', $matches[2] )[0], ' ' . chr( 96 ) );
\t\t\t$this->schema_tables[ $table ]['indexes'][ strtolower( $matches[1] ) ] = array(
\t\t\t\tarray( 'Key_name' => $matches[1], 'Column_name' => $column, 'Sub_part' => null, 'Non_unique' => '1', 'Index_type' => 'BTREE' ),
\t\t\t);
\t\t}
\t}

\tpublic function get_var( $query = null, $x = 0, $y = 0 ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'get_var', $query, $args, array( 'x' => $x, 'y' => $y ) );
\t\tif ( false !== stripos( $sql, 'SHOW TABLES LIKE' ) ) {
\t\t\treturn $this->table_name_from_show_tables_like( $args );
\t\t}
\t\t$name = $args[0] ?? null;
\t\tif ( null !== $name && isset( $this->option_rows[ $name ] ) ) {
\t\t\tif ( false !== stripos( $sql, 'SELECT autoload' ) ) {
\t\t\t\treturn $this->option_rows[ $name ]['autoload'];
\t\t\t}
\t\t\treturn $this->option_rows[ $name ]['option_value'];
\t\t}
\t\treturn null;
\t}

\tpublic function get_row( $query = null, $output = OBJECT, $y = 0 ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'get_row', $query, $args, array( 'output' => $output, 'y' => $y ) );
\t\t$name = $args[0] ?? null;
\t\tif ( null === $name || ! isset( $this->option_rows[ $name ] ) ) {
\t\t\treturn null;
\t\t}
\t\tif ( false !== stripos( $sql, 'SELECT option_value' ) ) {
\t\t\treturn $this->option_row_object( $name, array( 'option_value' ) );
\t\t}
\t\tif ( false !== stripos( $sql, 'SELECT autoload' ) ) {
\t\t\treturn $this->option_row_object( $name, array( 'autoload' ) );
\t\t}
\t\treturn $this->option_row_object( $name );
\t}

\tpublic function get_col( $query = null, $x = 0 ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'get_col', $query, $args, array( 'x' => $x ) );
\t\t$table = $this->table_name_from_desc( $sql );
\t\tif ( null !== $table && isset( $this->schema_tables[ $table ] ) ) {
\t\t\treturn array_map(
\t\t\t\tfunction ( $column ) {
\t\t\t\t\treturn $column['Field'];
\t\t\t\t},
\t\t\t\tarray_values( $this->schema_tables[ $table ]['columns'] )
\t\t\t);
\t\t}
\t\tif ( false === stripos( $sql, 'SELECT option_name' ) ) {
\t\t\treturn array();
\t\t}
\t\t$selected = array();
\t\t$offset   = 0;
\t\tpreg_match_all( \"/autoload != '%s' AND option_name IN \\\\(([^)]*)\\\\)/\", $sql, $matches );
\t\tforeach ( $matches[1] as $placeholder_group ) {
\t\t\t$target_autoload = $args[ $offset++ ] ?? null;
\t\t\t$count           = substr_count( $placeholder_group, '%s' );
\t\t\tfor ( $i = 0; $i < $count; $i++ ) {
\t\t\t\t$name = $args[ $offset++ ] ?? null;
\t\t\t\tif ( null !== $name && isset( $this->option_rows[ $name ] ) && $this->option_rows[ $name ]['autoload'] !== $target_autoload ) {
\t\t\t\t\t$selected[] = $name;
\t\t\t\t}
\t\t\t}
\t\t}
\t\treturn $selected;
\t}

\tpublic function get_results( $query = null, $output = OBJECT ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'get_results', $query, $args, array( 'output' => $output ) );
\t\t$table = $this->table_name_from_desc( $sql );
\t\tif ( null !== $table && false !== stripos( $sql, 'DESCRIBE' ) && isset( $this->schema_tables[ $table ] ) ) {
\t\t\treturn array_map( array( $this, 'column_object' ), array_values( $this->schema_tables[ $table ]['columns'] ) );
\t\t}
\t\tif ( null !== $table && false !== stripos( $sql, 'SHOW INDEX' ) && isset( $this->schema_tables[ $table ] ) ) {
\t\t\t$rows = array();
\t\t\tforeach ( $this->schema_tables[ $table ]['indexes'] as $indexes ) {
\t\t\t\tforeach ( $indexes as $index ) {
\t\t\t\t\t$rows[] = $this->index_object( $index );
\t\t\t\t}
\t\t\t}
\t\t\treturn $rows;
\t\t}
\t\t$results = array();
\t\tif ( false !== stripos( $sql, 'WHERE option_name IN' ) ) {
\t\t\tforeach ( $args as $name ) {
\t\t\t\t$row = $this->option_row_object( $name, array( 'option_name', 'option_value' ) );
\t\t\t\tif ( null !== $row ) {
\t\t\t\t\t$results[] = $row;
\t\t\t\t}
\t\t\t}
\t\t\treturn $results;
\t\t}
\t\tif ( false !== stripos( $sql, 'WHERE autoload IN' ) ) {
\t\t\tforeach ( $this->option_rows as $name => $row ) {
\t\t\t\tif ( in_array( $row['autoload'], array( 'yes', 'on', 'auto-on', 'auto' ), true ) ) {
\t\t\t\t\t$results[] = $this->option_row_object( $name, array( 'option_name', 'option_value' ) );
\t\t\t\t}
\t\t\t}
\t\t\treturn $results;
\t\t}
\t\tif ( false !== stripos( $sql, 'SELECT option_name, option_value FROM' ) ) {
\t\t\tforeach ( array_keys( $this->option_rows ) as $name ) {
\t\t\t\t$results[] = $this->option_row_object( $name, array( 'option_name', 'option_value' ) );
\t\t\t}
\t\t}
\t\treturn $results;
\t}

\tpublic function query( $query ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'query', $query, $args );
\t\t$this->rows_affected = 0;
\t\tif ( preg_match( '/^CREATE\\s+TABLE/i', $sql ) ) {
\t\t\t$this->apply_create_table( $sql );
\t\t\t$this->rows_affected = 1;
\t\t\treturn 1;
\t\t}
\t\tif ( preg_match( '/^ALTER\\s+TABLE/i', $sql ) ) {
\t\t\t$this->apply_alter_table( $sql );
\t\t\t$this->rows_affected = 1;
\t\t\treturn 1;
\t\t}
\t\tif ( false !== stripos( $sql, 'INSERT INTO' ) && false !== stripos( $sql, 'option_name' ) ) {
\t\t\t$name = $args[0] ?? null;
\t\t\tif ( null === $name ) {
\t\t\t\treturn 0;
\t\t\t}
\t\t\t$this->option_rows[ $name ] = array(
\t\t\t\t'option_id'    => ++$this->next_option_id,
\t\t\t\t'option_value' => $args[1] ?? '',
\t\t\t\t'autoload'     => $args[2] ?? 'auto',
\t\t\t);
\t\t\t$this->insert_id     = $this->next_option_id;
\t\t\t$this->rows_affected = 1;
\t\t\treturn 1;
\t\t}
\t\tif ( false !== stripos( $sql, 'UPDATE' ) && false !== stripos( $sql, 'SET autoload' ) ) {
\t\t\t$autoload = $args[0] ?? null;
\t\t\t$count    = 0;
\t\t\tforeach ( array_slice( $args, 1 ) as $name ) {
\t\t\t\tif ( isset( $this->option_rows[ $name ] ) && $this->option_rows[ $name ]['autoload'] !== $autoload ) {
\t\t\t\t\t$this->option_rows[ $name ]['autoload'] = $autoload;
\t\t\t\t\t$count++;
\t\t\t\t}
\t\t\t}
\t\t\t$this->rows_affected = $count;
\t\t\treturn $count;
\t\t}
\t\tif ( false !== stripos( $sql, 'DELETE a, b FROM' ) ) {
\t\t\t$count = 0;
\t\t\tforeach ( array_keys( $this->option_rows ) as $name ) {
\t\t\t\tif ( 0 === strpos( $name, '_transient_timeout_' ) && (int) $this->option_rows[ $name ]['option_value'] < (int) ( $args[2] ?? time() ) ) {
\t\t\t\t\t$transient = substr( $name, strlen( '_transient_timeout_' ) );
\t\t\t\t\tunset( $this->option_rows[ $name ], $this->option_rows[ '_transient_' . $transient ] );
\t\t\t\t\t$count++;
\t\t\t\t}
\t\t\t}
\t\t\t$this->rows_affected = $count;
\t\t\treturn $count;
\t\t}
\t\tif ( preg_match( '/^(INSERT|UPDATE)\\s+/i', $sql ) ) {
\t\t\t$this->rows_affected = 1;
\t\t\treturn 1;
\t\t}
\t\treturn 0;
\t}

\tpublic function update( $table, $data, $where, $format = null, $where_format = null ) {
\t\t$this->record( 'update', $table, array( 'data' => $data, 'where' => $where, 'format' => $format, 'where_format' => $where_format ) );
\t\t$name = $where['option_name'] ?? null;
\t\tif ( null === $name || ! isset( $this->option_rows[ $name ] ) ) {
\t\t\treturn 0;
\t\t}
\t\tforeach ( $data as $column => $value ) {
\t\t\t$this->option_rows[ $name ][ $column ] = $value;
\t\t}
\t\t$this->rows_affected = 1;
\t\treturn 1;
\t}

\tpublic function delete( $table, $where, $where_format = null ) {
\t\t$this->record( 'delete', $table, array( 'where' => $where, 'where_format' => $where_format ) );
\t\t$name = $where['option_name'] ?? null;
\t\tif ( null === $name || ! isset( $this->option_rows[ $name ] ) ) {
\t\t\treturn 0;
\t\t}
\t\tunset( $this->option_rows[ $name ] );
\t\t$this->rows_affected = 1;
\t\treturn 1;
\t}

\tpublic function strip_invalid_text_for_column( $table, $column, $value ) {
\t\treturn $value;
\t}

\tpublic function option_snapshot() {
\t\t$rows = $this->option_rows;
\t\tksort( $rows );
\t\treturn $rows;
\t}

\tpublic function schema_snapshot() {
\t\t$tables = $this->schema_tables;
\t\tksort( $tables );
\t\tforeach ( $tables as &$table ) {
\t\t\tksort( $table['columns'] );
\t\t\tksort( $table['indexes'] );
\t\t}
\t\treturn $tables;
\t}

\tpublic function event_tail( $count = 10 ) {
\t\treturn array_slice( $this->events, -1 * $count );
\t}
}

$wpdb = new WPHX_305_06_WPDB( '', '', '', '' );
$wpdb->reset_fixture_state();
$GLOBALS['wpdb'] = $wpdb;
$GLOBALS['table_prefix'] = 'wp_';
$GLOBALS['wp_db_version'] = 60497;

require_once ABSPATH . WPINC . '/cache.php';
require_once ABSPATH . WPINC . '/class-wp-object-cache.php';
require_once ABSPATH . WPINC . '/functions.php';
require_once ABSPATH . WPINC . '/kses.php';
require_once ABSPATH . WPINC . '/formatting.php';
require_once ABSPATH . WPINC . '/option.php';
require_once ABSPATH . 'wp-admin/includes/schema.php';
require_once ABSPATH . 'wp-admin/includes/upgrade.php';

wp_cache_init();
wp_using_ext_object_cache( false );

function wphx_305_06_reset_events() {
\t$GLOBALS['wphx_305_06_events'] = array();
}

function wphx_305_06_runtime_reset() {
\tglobal $wpdb, $table_prefix;
\t$wpdb->reset_fixture_state();
\t$table_prefix = 'wp_';
\twp_cache_flush();
\twp_using_ext_object_cache( false );
\twphx_305_06_reset_events();
}

function wphx_305_06_normalize_string( $value ) {
\treturn (string) $value;
}

function wphx_305_06_scalar( $value ) {
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
\t$value = wphx_305_06_normalize_string( $value );
\treturn array(
\t\t'type'   => 'string',
\t\t'value'  => $value,
\t\t'hex'    => bin2hex( $value ),
\t\t'bytes'  => strlen( $value ),
\t\t'sha256' => hash( 'sha256', $value ),
\t);
}

function wphx_305_06_value( $value ) {
\tif ( is_array( $value ) ) {
\t\t$entries = array();
\t\tforeach ( $value as $key => $entry_value ) {
\t\t\t$entries[] = array(
\t\t\t\t'key'   => wphx_305_06_scalar( $key ),
\t\t\t\t'value' => wphx_305_06_value( $entry_value ),
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
\t\t\t'properties' => wphx_305_06_value( get_object_vars( $value ) ),
\t\t);
\t}
\treturn wphx_305_06_scalar( $value );
}

function wphx_305_06_case( $id, $symbol, $callback ) {
\twphx_305_06_runtime_reset();
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
\t\t'value'  => wphx_305_06_value( $value ),
\t\t'error'  => null === $error ? null : wphx_305_06_value( $error ),
\t);
}

function wphx_305_06_cache_pick( $keys ) {
\t$result = array();
\tforeach ( $keys as $key ) {
\t\t$result[ $key ] = wp_cache_get( $key, 'options' );
\t}
\treturn $result;
}

function wphx_305_06_option_snapshot( $keys = array() ) {
\tglobal $wpdb;
\treturn array(
\t\t'db'         => $wpdb->option_snapshot(),
\t\t'cache'      => array(
\t\t\t'alloptions' => wp_cache_get( 'alloptions', 'options' ),
\t\t\t'notoptions' => wp_cache_get( 'notoptions', 'options' ),
\t\t\t'keys'       => wphx_305_06_cache_pick( $keys ),
\t\t),
\t\t'queryTail'  => $wpdb->event_tail( 12 ),
\t);
}

function wphx_305_06_schema_ddl() {
\treturn "CREATE TABLE wp_delta (
id int(11) NOT NULL default '0',
title varchar(50) NOT NULL default 'new',
slug varchar(30) NOT NULL default '',
PRIMARY KEY  (id),
KEY title_idx (title)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";
}

function wphx_305_06_run_cases() {
\tglobal $wpdb;
\t$cases = array();

\t$cases[] = wphx_305_06_case(
\t\t'schema:maybe-create-table',
\t\t'maybe_create_table',
\t\tfunction () use ( $wpdb ) {
\t\t\t$existing = maybe_create_table( 'wp_existing', 'CREATE TABLE wp_existing (id int(11) NOT NULL default \\'0\\')' );
\t\t\t$created  = maybe_create_table( 'wp_created', 'CREATE TABLE wp_created (id int(11) NOT NULL default \\'0\\')' );
\t\t\treturn array(
\t\t\t\t'existing' => $existing,
\t\t\t\t'created'  => $created,
\t\t\t\t'schema'   => $wpdb->schema_snapshot(),
\t\t\t\t'queries'  => $wpdb->event_tail( 8 ),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_06_case(
\t\t'schema:maybe-add-column',
\t\t'maybe_add_column',
\t\tfunction () use ( $wpdb ) {
\t\t\t$existing = maybe_add_column( 'wp_addcol', 'id', 'ALTER TABLE wp_addcol ADD COLUMN id int(11) NOT NULL default \\'0\\'' );
\t\t\t$added    = maybe_add_column( 'wp_addcol', 'slug', 'ALTER TABLE wp_addcol ADD COLUMN slug varchar(30) NOT NULL default \\'\\'' );
\t\t\treturn array(
\t\t\t\t'existing' => $existing,
\t\t\t\t'added'    => $added,
\t\t\t\t'schema'   => $wpdb->schema_snapshot(),
\t\t\t\t'queries'  => $wpdb->event_tail( 8 ),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_06_case(
\t\t'schema:dbdelta-plan-no-execute',
\t\t'dbDelta',
\t\tfunction () use ( $wpdb ) {
\t\t\t$plan = dbDelta( wphx_305_06_schema_ddl(), false );
\t\t\treturn array(
\t\t\t\t'plan'    => $plan,
\t\t\t\t'schema'  => $wpdb->schema_snapshot(),
\t\t\t\t'queries' => $wpdb->event_tail( 10 ),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_06_case(
\t\t'schema:dbdelta-execute-and-dml',
\t\t'dbDelta',
\t\tfunction () use ( $wpdb ) {
\t\t\t$queries = array(
\t\t\t\twphx_305_06_schema_ddl(),
\t\t\t\t\"INSERT INTO wp_delta (id, title, slug) VALUES (1, 'Alpha', 'alpha')\",
\t\t\t\t\"UPDATE wp_delta SET title = 'Beta' WHERE id = 1\",
\t\t\t);
\t\t\t$plan = dbDelta( $queries, true );
\t\t\treturn array(
\t\t\t\t'plan'    => $plan,
\t\t\t\t'schema'  => $wpdb->schema_snapshot(),
\t\t\t\t'queries' => $wpdb->event_tail( 14 ),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_06_case(
\t\t'schema:wp-get-db-schema-blog-scope',
\t\t'wp_get_db_schema',
\t\tfunction () use ( $wpdb ) {
\t\t\t$schema = wp_get_db_schema( 'blog', 7 );
\t\t\treturn array(
\t\t\t\t'bytes'           => strlen( $schema ),
\t\t\t\t'sha256'          => hash( 'sha256', $schema ),
\t\t\t\t'containsOptions' => false !== strpos( $schema, 'CREATE TABLE wp_7_options' ),
\t\t\t\t'containsPosts'   => false !== strpos( $schema, 'CREATE TABLE wp_7_posts' ),
\t\t\t\t'charsetCollate'  => $wpdb->get_charset_collate(),
\t\t\t\t'blogidAfter'     => $wpdb->blogid,
\t\t\t\t'prefixAfter'     => $wpdb->prefix,
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_06_case(
\t\t'schema:global-upgrade-filter',
\t\t'wp_should_upgrade_global_tables/dbDelta',
\t\tfunction () use ( $wpdb ) {
\t\t\t$deny = function () {
\t\t\t\treturn false;
\t\t\t};
\t\t\tadd_filter( 'wp_should_upgrade_global_tables', $deny );
\t\t\t$plan_denied = dbDelta( 'CREATE TABLE wp_users (ID bigint(20) unsigned NOT NULL, PRIMARY KEY  (ID))', false );
\t\t\tremove_filter( 'wp_should_upgrade_global_tables', $deny );
\t\t\t$plan_allowed = dbDelta( 'CREATE TABLE wp_users (ID bigint(20) unsigned NOT NULL, PRIMARY KEY  (ID))', false );
\t\t\treturn array(
\t\t\t\t'deniedShouldUpgrade'  => false,
\t\t\t\t'allowedShouldUpgrade' => wp_should_upgrade_global_tables(),
\t\t\t\t'planDenied'           => $plan_denied,
\t\t\t\t'planAllowed'          => $plan_allowed,
\t\t\t\t'queries'              => $wpdb->event_tail( 10 ),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_06_case(
\t\t'options:autoload-add-update-delete',
\t\t'wp_load_alloptions/get_option/add_option/update_option/delete_option',
\t\tfunction () {
\t\t\t$alloptions = wp_load_alloptions();
\t\t\t$added      = add_option( 'wphx_added', array( 'nested' => 'value' ), '', true );
\t\t\t$updated    = update_option( 'wphx_nonautoload', 'changed-value', true );
\t\t\t$deleted    = delete_option( 'wphx_delete_me' );
\t\t\treturn array(
\t\t\t\t'alloptionKeys' => array_keys( $alloptions ),
\t\t\t\t'siteurl'       => get_option( 'siteurl' ),
\t\t\t\t'home'          => get_option( 'home' ),
\t\t\t\t'added'         => $added,
\t\t\t\t'addedValue'    => get_option( 'wphx_added' ),
\t\t\t\t'updated'       => $updated,
\t\t\t\t'updatedValue'  => get_option( 'wphx_nonautoload' ),
\t\t\t\t'deleted'       => $deleted,
\t\t\t\t'deletedAfter'  => get_option( 'wphx_delete_me', 'after-delete-default' ),
\t\t\t\t'snapshot'      => wphx_305_06_option_snapshot( array( 'wphx_added', 'wphx_nonautoload', 'wphx_delete_me' ) ),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_06_case(
\t\t'options:batch-prime-and-autoload',
\t\t'get_options/wp_prime_option_caches/wp_set_option_autoload_values',
\t\tfunction () {
\t\t\t$options = get_options( array( 'wphx_nonautoload', 'wphx_autoloaded', 'wphx_absent_batch' ) );
\t\t\t$autoload_results = wp_set_option_autoload_values(
\t\t\t\tarray(
\t\t\t\t\t'wphx_bulk_on'  => false,
\t\t\t\t\t'wphx_bulk_off' => true,
\t\t\t\t\t'wphx_absent'   => true,
\t\t\t\t)
\t\t\t);
\t\t\treturn array(
\t\t\t\t'options'         => $options,
\t\t\t\t'autoloadResults' => $autoload_results,
\t\t\t\t'snapshot'        => wphx_305_06_option_snapshot( array( 'wphx_nonautoload', 'wphx_absent_batch', 'wphx_bulk_on', 'wphx_bulk_off' ) ),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_06_case(
\t\t'transients:database-backed',
\t\t'set_transient/get_transient/delete_transient',
\t\tfunction () {
\t\t\twp_using_ext_object_cache( false );
\t\t\t$set     = set_transient( 'wphx_runtime', array( 'payload' => 'value' ), 0 );
\t\t\t$value   = get_transient( 'wphx_runtime' );
\t\t\t$deleted = delete_transient( 'wphx_runtime' );
\t\t\t$after   = get_transient( 'wphx_runtime' );
\t\t\treturn array(
\t\t\t\t'set'      => $set,
\t\t\t\t'value'    => $value,
\t\t\t\t'deleted'  => $deleted,
\t\t\t\t'after'    => $after,
\t\t\t\t'snapshot' => wphx_305_06_option_snapshot( array( '_transient_wphx_runtime' ) ),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_06_case(
\t\t'transients:delete-expired-sql',
\t\t'delete_expired_transients',
\t\tfunction () {
\t\t\tdelete_expired_transients( true );
\t\t\treturn array(
\t\t\t\t'oldValue' => get_option( '_transient_old_value', 'deleted' ),
\t\t\t\t'oldTimeout' => get_option( '_transient_timeout_old_value', 'deleted' ),
\t\t\t\t'snapshot' => wphx_305_06_option_snapshot( array( '_transient_old_value', '_transient_timeout_old_value' ) ),
\t\t\t);
\t\t}
\t);

\treturn $cases;
}

$snapshot = array(
\t'mode'                  => $mode,
\t'phpVersion'            => PHP_VERSION,
\t'coveredFunctionExists' => array(
\t\t'maybe_create_table'           => function_exists( 'maybe_create_table' ),
\t\t'maybe_add_column'             => function_exists( 'maybe_add_column' ),
\t\t'dbDelta'                      => function_exists( 'dbDelta' ),
\t\t'wp_get_db_schema'             => function_exists( 'wp_get_db_schema' ),
\t\t'wp_should_upgrade_global_tables' => function_exists( 'wp_should_upgrade_global_tables' ),
\t\t'wp_load_alloptions'           => function_exists( 'wp_load_alloptions' ),
\t\t'get_option'                   => function_exists( 'get_option' ),
\t\t'get_options'                  => function_exists( 'get_options' ),
\t\t'add_option'                   => function_exists( 'add_option' ),
\t\t'update_option'                => function_exists( 'update_option' ),
\t\t'delete_option'                => function_exists( 'delete_option' ),
\t\t'wp_prime_option_caches'       => function_exists( 'wp_prime_option_caches' ),
\t\t'wp_set_option_autoload_values' => function_exists( 'wp_set_option_autoload_values' ),
\t\t'set_transient'                => function_exists( 'set_transient' ),
\t\t'get_transient'                => function_exists( 'get_transient' ),
\t\t'delete_transient'             => function_exists( 'delete_transient' ),
\t\t'delete_expired_transients'    => function_exists( 'delete_expired_transients' ),
\t),
\t'coveredMethodExists'   => array(
\t\t'wpdb_prepare'             => method_exists( $wpdb, 'prepare' ),
\t\t'wpdb_get_var'             => method_exists( $wpdb, 'get_var' ),
\t\t'wpdb_get_row'             => method_exists( $wpdb, 'get_row' ),
\t\t'wpdb_get_col'             => method_exists( $wpdb, 'get_col' ),
\t\t'wpdb_get_results'         => method_exists( $wpdb, 'get_results' ),
\t\t'wpdb_query'               => method_exists( $wpdb, 'query' ),
\t\t'wpdb_update'              => method_exists( $wpdb, 'update' ),
\t\t'wpdb_delete'              => method_exists( $wpdb, 'delete' ),
\t\t'wpdb_get_charset_collate' => method_exists( $wpdb, 'get_charset_collate' ),
\t\t'wpdb_tables'              => method_exists( $wpdb, 'tables' ),
\t),
\t'cases'                 => wphx_305_06_run_cases(),
);

echo json_encode( $snapshot, JSON_UNESCAPED_SLASHES );
`
  );
}

function normalize(result) {
  return {
    coveredFunctionExists: result.coveredFunctionExists,
    coveredMethodExists: result.coveredMethodExists,
    cases: result.cases
  };
}

function runProbe(commandPath, runtimeId, mode, root) {
  const output = command(commandPath, [PROBE, mode, root]);
  return {
    id: `${runtimeId}:${mode}`,
    runtime: runtimeId,
    mode,
    command: `${commandPath} ${PROBE} ${mode} ${root}`,
    result: JSON.parse(output)
  };
}

function runDockerProbe(runtimeId, image, mode, root) {
  const dockerRoot = `/work/${root}`;
  const output = command("docker", ["run", "--rm", "-v", `${process.cwd()}:/work`, "-w", "/work", image, "php", PROBE, mode, dockerRoot]);
  return {
    id: `${runtimeId}:${mode}`,
    runtime: runtimeId,
    mode,
    command: `docker run --rm -v $PWD:/work -w /work ${image} php ${PROBE} ${mode} ${dockerRoot}`,
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
      throw new Error(`${path} is stale; run npm run wp:core:wphx-305-schema-option`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha, upstreamDigest) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wpdb-schema-option-integration-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "workset",
      name: "wpdb schema-upgrade and option/transient database integration fixture harness",
      area: "wp-includes/wp-admin",
      public_contract:
        "WordPress 7.0 schema upgrade helpers and database-backed option/transient storage paths stay observable through upstream upgrade.php, schema.php, option.php, and a wpdb-subclass integration harness while the candidate side is still an oracle source mirror."
    },
    ownership_state: "external_oracle",
    upstream: {
      repo: UPSTREAM_ROOT,
      ref: WP_REF,
      paths: SOURCE_FILES,
      digest: upstreamDigest
    },
    owned_paths: ["tools/wp-core/run-wpdb-schema-option-integration-fixture.mjs", OUT, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-305-schema-option",
        "npm run wp:core:wphx-305-schema-option:check",
        "npm run beads:validate",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-305-06-wpdb-schema-option-integration-fixture"],
      manifest_digest: manifestSha
    },
    notes:
      "The candidate fixture root is an oracle source mirror for WPHX-305.06. The probe loads real WordPress upgrade/schema/option code and replaces only live database execution with a deterministic wpdb subclass; the broad wp-admin include required by upgrade.php is stubbed because the exercised dbDelta/maybe_* helpers do not use it."
  };
}

const lock = readJson("toolchain.lock.json");
const wpdbSurface = readJson(WPDB_SURFACE);
const optionStorage = readJson(OPTION_STORAGE_FIXTURE);
const transientFixture = readJson(TRANSIENT_FIXTURE);
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

const caseErrors = runs.flatMap((run) =>
  (run.result.cases ?? [])
    .filter((entry) => entry.error !== null)
    .map((entry) => ({
      run: run.id,
      case: entry.id,
      error: entry.error
    }))
);
if (caseErrors.length > 0) {
  console.error(JSON.stringify({ status: "failed", caseErrors }, null, 2));
  process.exit(1);
}

const sourceUnits = SOURCE_FILES.map(sourceRecord);
const upstreamDigest = sha256(JSON.stringify(sourceUnits.map((unit) => ({ path: unit.path, sha256: unit.sha256 }))));
const normalizedLocalOracle = normalize(localOracle.result);
const dbDomains = wpdbSurface.domains
  .filter((domain) => ["query_execution_results", "write_field_processing", "charset_collation", "tables_prefix_multisite"].includes(domain.id))
  .map((domain) => domain.label);
const manifest = {
  schema: "wphx.wp-core-wpdb-schema-option-integration-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-wpdb-schema-option-integration-fixture.mjs",
  inputs: {
    wpdb_surface_manifest: inputRecord(WPDB_SURFACE),
    wpdb_prepare_fixture: inputRecord(PREPARE_FIXTURE),
    wpdb_query_fixture: inputRecord(QUERY_FIXTURE),
    wpdb_write_fixture: inputRecord(WRITE_FIXTURE),
    wpdb_charset_prefix_fixture: inputRecord(CHARSET_PREFIX_FIXTURE),
    option_storage_fixture: inputRecord(OPTION_STORAGE_FIXTURE),
    transient_fixture: inputRecord(TRANSIENT_FIXTURE),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    source_units: sourceUnits,
    upstream_digest: upstreamDigest
  },
  fixture: {
    candidate_kind: "oracle_source_mirror",
    source_domains: [
      ...dbDomains,
      optionStorage.fixture?.source_domain ?? "option storage/autoload",
      transientFixture.fixture?.source_domain ?? "transients"
    ],
    covered_symbols: COVERED_SYMBOLS,
    cases: FIXTURE_CASES,
    native_boundaries: [
      {
        id: "deterministic-wpdb-subclass-storage-engine",
        reason:
          "The probe loads real WordPress upgrade.php, schema.php, and option.php, but replaces live MySQL execution with a wpdb subclass that records SQL and mutates deterministic schema/option state. Native server execution remains a later live-DB gate."
      },
      {
        id: "structured-prepare-carrier",
        reason:
          "The wpdb subclass calls parent::prepare() and records a normalized prepared SQL hash, then carries raw query arguments alongside it so option-table and schema-state assertions can remain deterministic. Full placeholder escaping parity is owned by WPHX-305.02."
      },
      {
        id: "wp-admin-admin-include-stub",
        reason:
          "upgrade.php requires wp-admin/includes/admin.php at load time, but dbDelta(), maybe_create_table(), maybe_add_column(), and wp_should_upgrade_global_tables() do not use the broad admin API. The fixture stubs that include and records it as a boot boundary instead of expanding WPHX-305 into the admin domain."
      },
      {
        id: "object-cache-runtime",
        reason:
          "Option/transient database-backed paths still use WordPress's native in-memory WP_Object_Cache for alloptions, notoptions, and option key caches."
      },
      {
        id: "php-serialization-and-time",
        reason:
          "Option values and no-expiration transients use WordPress/PHP serialization. Expired transient cleanup passes the current PHP time to deterministic SQL handling instead of asserting wall-clock-specific values."
      }
    ],
    closes_gaps_from: [
      {
        manifest: OPTION_STORAGE_FIXTURE,
        gap: "real-wpdb-not-yet-ported",
        resolution: "Option storage now runs against a wpdb subclass integration harness instead of the standalone WPHX-304.02 option-table double."
      },
      {
        manifest: TRANSIENT_FIXTURE,
        gap: "database-backed-transient-storage",
        resolution: "No-expiration transient set/get/delete and expired cleanup SQL now flow through the WPHX-305 wpdb integration harness."
      },
      {
        manifest: CHARSET_PREFIX_FIXTURE,
        gap: "live-information-schema-not-yet-covered",
        resolution: "dbDelta and schema helpers now consume deterministic DESCRIBE/SHOW INDEX metadata through wpdb methods; live server metadata remains a native DB runtime gate."
      }
    ],
    follows: ["WPHX-304.02", "WPHX-304.03", "WPHX-305.01", "WPHX-305.02", "WPHX-305.03", "WPHX-305.04", "WPHX-305.05"],
    follow_up_owner: "WPHX-305.07"
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
  run_summaries: runs.map(runSummary),
  trace_samples: [
    {
      id: localOracle.id,
      runtime: localOracle.runtime,
      mode: localOracle.mode,
      result: normalizedLocalOracle
    }
  ],
  comparisons,
  remaining_gaps: [
    {
      id: "haxe-candidate-not-yet-installed",
      owner: "WPHX-305",
      detail: "The candidate side is a copied WordPress oracle source tree until selected wpdb/schema/option helpers move behind typed Haxe parity candidates."
    },
    {
      id: "live-mysql-execution-not-yet-covered",
      owner: "WPHX-305.07",
      detail: "The fixture records SQL and mutates deterministic schema state. Real MySQL/MariaDB DDL/DML execution, permissions failures, locking, SQL modes, and information-schema behavior remain a live DB gate."
    },
    {
      id: "full-admin-upgrade-surface-deferred",
      owner: "future admin/install workset",
      detail: "upgrade.php is loaded with a stubbed admin include because this harness covers dbDelta/maybe_* and option/transient database storage, not the broader install/admin API."
    },
    {
      id: "full-upstream-phpunit-not-yet-ported",
      owner: "WPHX-305",
      detail: "This fixture covers seed traces. Full upstream wpdb, dbDelta, option, and transient PHPUnit parity remains a domain-level closure requirement."
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
  id: "receipt:wphx-305-06-wpdb-schema-option-integration-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    {
      path: OUT,
      role: "wpdb schema/option/transient integration differential fixture manifest"
    },
    {
      path: OWNERSHIP,
      role: "external-oracle ownership manifest for the fixture harness"
    },
    {
      path: "tools/wp-core/run-wpdb-schema-option-integration-fixture.mjs",
      role: "fixture generator and check-mode validator"
    }
  ],
  verification_commands: [
    "npm run wp:core:wphx-305-schema-option",
    "npm run wp:core:wphx-305-schema-option:check",
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
      comparisons: comparisons.length,
      skipped_runtimes: skippedRuntimes.length
    },
    null,
    2
  )
);
