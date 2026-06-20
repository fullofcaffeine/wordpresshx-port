#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.8.2",
  external_ref: "WPHX-304.02",
  title: "Build option storage/autoload differential fixture harness"
};
const OUT_ROOT = "build/wp-core/wphx-304-02";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-304-02-option-storage-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-304-02-option-storage-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-304-02-option-storage-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-304-01-options-cache-surface.v1.json";
const RECORDED_AT = "2026-06-21T01:55:00.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const UPSTREAM_ROOT = "../wordpress-develop";

const SOURCE_FILES = [
  "src/wp-includes/class-wp-hook.php",
  "src/wp-includes/compat.php",
  "src/wp-includes/utf8.php",
  "src/wp-includes/load.php",
  "src/wp-includes/plugin.php",
  "src/wp-includes/cache.php",
  "src/wp-includes/class-wp-object-cache.php",
  "src/wp-includes/functions.php",
  "src/wp-includes/kses.php",
  "src/wp-includes/formatting.php",
  "src/wp-includes/option.php"
];

const COVERED_SYMBOLS = [
  "get_option",
  "get_options",
  "wp_prime_option_caches",
  "wp_prime_option_caches_by_group",
  "wp_set_option_autoload_values",
  "wp_set_options_autoload",
  "wp_set_option_autoload",
  "form_option",
  "wp_load_alloptions",
  "update_option",
  "add_option",
  "delete_option",
  "wp_determine_option_autoload_value",
  "wp_filter_default_autoload_value_via_option_size",
  "wp_autoload_values_to_autoload"
];

const FIXTURE_CASES = [
  { id: "get-option:autoload-home-siteurl", symbol: "get_option", focus: "autoloaded alloptions lookup, home fallback to siteurl, and URL untrailing behavior" },
  { id: "get-option:missing-default-notoptions", symbol: "get_option", focus: "missing option default and notoptions cache population" },
  { id: "get-option:filters", symbol: "get_option", focus: "pre_option, default_option, and option filters with argument capture" },
  { id: "get-options:prime-batch", symbol: "get_options", focus: "batch priming existing and missing options into options/notoptions caches" },
  { id: "prime-by-group:allowed-options", symbol: "wp_prime_option_caches_by_group", focus: "registered option group priming delegates into wp_prime_option_caches()" },
  { id: "add-option:autoload-on-off", symbol: "add_option", focus: "insert, serialization, alloptions versus individual cache placement, and add hooks" },
  { id: "update-option:value-and-autoload", symbol: "update_option", focus: "value mutation, explicit autoload transition, cache migration, and update hooks" },
  { id: "set-option-autoload:bulk", symbol: "wp_set_option_autoload_values", focus: "bulk autoload transitions, nonexistent option false result, and cache invalidation" },
  { id: "set-option-autoload:wrappers", symbol: "wp_set_option_autoload/wp_set_options_autoload", focus: "single and bulk wrapper return contracts" },
  { id: "delete-option:cache-notoptions", symbol: "delete_option", focus: "delete result, alloptions/options cache cleanup, notoptions insertion, and delete hooks" },
  { id: "form-option:escaped-output", symbol: "form_option", focus: "option value retrieval plus esc_attr output contract" },
  { id: "autoload:determine-and-size-filter", symbol: "wp_determine_option_autoload_value", focus: "explicit values, default autoload filter, allowed autoload values, and size heuristic" }
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

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'WP_CONTENT_DIR', $root . '/wp-content' );

class WPHX_304_02_Fake_WPDB {
\tpublic $options = 'wp_options';
\tpublic $sitemeta = 'wp_sitemeta';
\tpublic $last_error = '';
\tpublic $queries = array();
\tprivate $suppress_errors = false;
\tprivate $rows = array();

\tpublic function __construct() {
\t\t$this->reset();
\t}

\tpublic function reset() {
\t\t$this->queries = array();
\t\t$this->rows    = array(
\t\t\t'siteurl'          => array( 'option_value' => 'https://example.test/', 'autoload' => 'on' ),
\t\t\t'home'             => array( 'option_value' => '', 'autoload' => 'on' ),
\t\t\t'wphx_autoloaded'  => array( 'option_value' => serialize( array( 'alpha' => 1, 'beta' => false ) ), 'autoload' => 'on' ),
\t\t\t'wphx_nonautoload' => array( 'option_value' => 'stored-off', 'autoload' => 'off' ),
\t\t\t'wphx_bulk_on'     => array( 'option_value' => 'bulk-on', 'autoload' => 'on' ),
\t\t\t'wphx_bulk_off'    => array( 'option_value' => 'bulk-off', 'autoload' => 'off' ),
\t\t\t'wphx_delete_me'   => array( 'option_value' => 'delete-me', 'autoload' => 'off' ),
\t\t\t'wphx_html'        => array( 'option_value' => '<strong>A&B</strong>', 'autoload' => 'on' ),
\t\t);
\t}

\tpublic function suppress_errors( $suppress = null ) {
\t\t$previous = $this->suppress_errors;
\t\tif ( null !== $suppress ) {
\t\t\t$this->suppress_errors = (bool) $suppress;
\t\t}
\t\treturn $previous;
\t}

\tpublic function _escape( $data ) {
\t\tif ( is_array( $data ) ) {
\t\t\treturn array_map( array( $this, '_escape' ), $data );
\t\t}
\t\treturn str_replace( \"'\", \"\\\\'\", (string) $data );
\t}

\tpublic function esc_like( $text ) {
\t\treturn addcslashes( $text, '_%\\\\' );
\t}

\tpublic function strip_invalid_text_for_column( $table, $column, $value ) {
\t\treturn $value;
\t}

\tpublic function prepare( $query, ...$args ) {
\t\tif ( 1 === count( $args ) && is_array( $args[0] ) ) {
\t\t\t$args = $args[0];
\t\t}
\t\treturn array(
\t\t\t'query' => $query,
\t\t\t'args'  => array_values( $args ),
\t\t);
\t}

\tprivate function unpack_query( $query ) {
\t\tif ( is_array( $query ) ) {
\t\t\treturn array( $query['query'], $query['args'] );
\t\t}
\t\treturn array( $query, array() );
\t}

\tprivate function record( $operation, $query, $args = array() ) {
\t\t$this->queries[] = array(
\t\t\t'operation' => $operation,
\t\t\t'query'     => preg_replace( '/\\s+/', ' ', trim( (string) $query ) ),
\t\t\t'args'      => $args,
\t\t);
\t}

\tprivate function row_object( $name, $columns = array( 'option_name', 'option_value', 'autoload' ) ) {
\t\tif ( ! isset( $this->rows[ $name ] ) ) {
\t\t\treturn null;
\t\t}
\t\t$row = new stdClass();
\t\tif ( in_array( 'option_name', $columns, true ) ) {
\t\t\t$row->option_name = $name;
\t\t}
\t\tif ( in_array( 'option_value', $columns, true ) ) {
\t\t\t$row->option_value = $this->rows[ $name ]['option_value'];
\t\t}
\t\tif ( in_array( 'autoload', $columns, true ) ) {
\t\t\t$row->autoload = $this->rows[ $name ]['autoload'];
\t\t}
\t\treturn $row;
\t}

\tpublic function get_row( $query ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'get_row', $sql, $args );
\t\t$name = $args[0] ?? null;
\t\tif ( null === $name || ! isset( $this->rows[ $name ] ) ) {
\t\t\treturn null;
\t\t}
\t\tif ( false !== strpos( $sql, 'SELECT option_value' ) ) {
\t\t\treturn $this->row_object( $name, array( 'option_value' ) );
\t\t}
\t\tif ( false !== strpos( $sql, 'SELECT autoload' ) ) {
\t\t\treturn $this->row_object( $name, array( 'autoload' ) );
\t\t}
\t\treturn $this->row_object( $name );
\t}

\tpublic function get_var( $query ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'get_var', $sql, $args );
\t\t$name = $args[0] ?? null;
\t\tif ( null === $name || ! isset( $this->rows[ $name ] ) ) {
\t\t\treturn null;
\t\t}
\t\tif ( false !== strpos( $sql, 'SELECT autoload' ) ) {
\t\t\treturn $this->rows[ $name ]['autoload'];
\t\t}
\t\treturn $this->rows[ $name ]['option_value'];
\t}

\tpublic function get_col( $query ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'get_col', $sql, $args );
\t\tif ( false === strpos( $sql, 'SELECT option_name' ) ) {
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
\t\t\t\tif ( null !== $name && isset( $this->rows[ $name ] ) && $this->rows[ $name ]['autoload'] !== $target_autoload ) {
\t\t\t\t\t$selected[] = $name;
\t\t\t\t}
\t\t\t}
\t\t}
\t\treturn $selected;
\t}

\tpublic function get_results( $query ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'get_results', $sql, $args );
\t\t$results = array();
\t\tif ( false !== strpos( $sql, 'WHERE option_name IN' ) ) {
\t\t\tforeach ( $args as $name ) {
\t\t\t\t$row = $this->row_object( $name, array( 'option_name', 'option_value' ) );
\t\t\t\tif ( null !== $row ) {
\t\t\t\t\t$results[] = $row;
\t\t\t\t}
\t\t\t}
\t\t\treturn $results;
\t\t}
\t\tif ( false !== strpos( $sql, 'WHERE autoload IN' ) ) {
\t\t\tpreg_match_all( \"/'([^']+)'/\", $sql, $matches );
\t\t\t$autoload_values = $matches[1] ?: array( 'yes', 'on', 'auto-on', 'auto' );
\t\t\tforeach ( $this->rows as $name => $row ) {
\t\t\t\tif ( in_array( $row['autoload'], $autoload_values, true ) ) {
\t\t\t\t\t$results[] = $this->row_object( $name, array( 'option_name', 'option_value' ) );
\t\t\t\t}
\t\t\t}
\t\t\treturn $results;
\t\t}
\t\tif ( false !== strpos( $sql, 'SELECT option_name, option_value FROM' ) ) {
\t\t\tforeach ( array_keys( $this->rows ) as $name ) {
\t\t\t\t$results[] = $this->row_object( $name, array( 'option_name', 'option_value' ) );
\t\t\t}
\t\t}
\t\treturn $results;
\t}

\tpublic function update( $table, $data, $where ) {
\t\t$this->record( 'update', $table, array( 'data' => $data, 'where' => $where ) );
\t\t$name = $where['option_name'] ?? null;
\t\tif ( null === $name || ! isset( $this->rows[ $name ] ) ) {
\t\t\treturn 0;
\t\t}
\t\tforeach ( $data as $column => $value ) {
\t\t\t$this->rows[ $name ][ $column ] = $value;
\t\t}
\t\treturn 1;
\t}

\tpublic function delete( $table, $where ) {
\t\t$this->record( 'delete', $table, array( 'where' => $where ) );
\t\t$name = $where['option_name'] ?? null;
\t\tif ( null === $name || ! isset( $this->rows[ $name ] ) ) {
\t\t\treturn 0;
\t\t}
\t\tunset( $this->rows[ $name ] );
\t\treturn 1;
\t}

\tpublic function query( $query ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'query', $sql, $args );
\t\tif ( false !== strpos( $sql, 'INSERT INTO' ) ) {
\t\t\t$name = $args[0] ?? null;
\t\t\tif ( null === $name ) {
\t\t\t\treturn 0;
\t\t\t}
\t\t\t$this->rows[ $name ] = array(
\t\t\t\t'option_value' => $args[1] ?? '',
\t\t\t\t'autoload'     => $args[2] ?? 'auto',
\t\t\t);
\t\t\treturn 1;
\t\t}
\t\tif ( false !== strpos( $sql, 'UPDATE' ) && false !== strpos( $sql, 'SET autoload' ) ) {
\t\t\t$autoload = $args[0] ?? null;
\t\t\t$count    = 0;
\t\t\tforeach ( array_slice( $args, 1 ) as $name ) {
\t\t\t\tif ( isset( $this->rows[ $name ] ) && $this->rows[ $name ]['autoload'] !== $autoload ) {
\t\t\t\t\t$this->rows[ $name ]['autoload'] = $autoload;
\t\t\t\t\t$count++;
\t\t\t\t}
\t\t\t}
\t\t\treturn $count;
\t\t}
\t\treturn 0;
\t}

\tpublic function snapshot() {
\t\tksort( $this->rows );
\t\treturn $this->rows;
\t}
}

function wphx_304_02_bootstrap() {
\tglobal $wpdb;

\t$wpdb = new WPHX_304_02_Fake_WPDB();

\trequire_once ABSPATH . WPINC . '/compat.php';
\trequire_once ABSPATH . WPINC . '/utf8.php';
\trequire_once ABSPATH . WPINC . '/load.php';
\trequire_once ABSPATH . WPINC . '/plugin.php';
\trequire_once ABSPATH . WPINC . '/cache.php';
\trequire_once ABSPATH . WPINC . '/functions.php';
\trequire_once ABSPATH . WPINC . '/kses.php';
\trequire_once ABSPATH . WPINC . '/formatting.php';
\trequire_once ABSPATH . WPINC . '/option.php';

\tadd_filter( 'wp_default_autoload_value', 'wp_filter_default_autoload_value_via_option_size', 10, 4 );
}

wphx_304_02_bootstrap();
wp_cache_init();

function wphx_304_02_scalar( $value ) {
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
\treturn array(
\t\t'type'   => 'string',
\t\t'value'  => (string) $value,
\t\t'hex'    => bin2hex( (string) $value ),
\t\t'bytes'  => strlen( (string) $value ),
\t\t'sha256' => hash( 'sha256', (string) $value ),
\t);
}

function wphx_304_02_value( $value ) {
\tif ( is_array( $value ) ) {
\t\t$entries = array();
\t\tforeach ( $value as $key => $entry_value ) {
\t\t\t$entries[] = array(
\t\t\t\t'key'   => wphx_304_02_scalar( $key ),
\t\t\t\t'value' => wphx_304_02_value( $entry_value ),
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
\t\t\t'properties' => wphx_304_02_value( get_object_vars( $value ) ),
\t\t);
\t}
\treturn wphx_304_02_scalar( $value );
}

function wphx_304_02_case( $id, $symbol, $value, $meta = array() ) {
\treturn array(
\t\t'id'     => $id,
\t\t'symbol' => $symbol,
\t\t'value'  => wphx_304_02_value( $value ),
\t\t'meta'   => $meta,
\t);
}

function wphx_304_02_cache_pick( $keys ) {
\t$result = array();
\tforeach ( $keys as $key ) {
\t\t$result[ $key ] = wp_cache_get( $key, 'options' );
\t}
\treturn $result;
}

function wphx_304_02_snapshot( $keys = array() ) {
\tglobal $wpdb;

\treturn array(
\t\t'db'             => $wpdb->snapshot(),
\t\t'cache'          => array(
\t\t\t'alloptions' => wp_cache_get( 'alloptions', 'options' ),
\t\t\t'notoptions' => wp_cache_get( 'notoptions', 'options' ),
\t\t\t'keys'       => wphx_304_02_cache_pick( $keys ),
\t\t),
\t\t'queryCount'     => count( $wpdb->queries ),
\t\t'queryTail'      => array_slice( $wpdb->queries, -8 ),
\t);
}

function wphx_304_02_reset_state() {
\tglobal $wpdb, $new_allowed_options;
\t$wpdb->reset();
\twp_cache_flush();
\t$new_allowed_options = array();
\t$GLOBALS['wphx_304_02_events'] = array();
}

function wphx_304_02_event_logger( $hook ) {
\treturn function () use ( $hook ) {
\t\t$GLOBALS['wphx_304_02_events'][] = array(
\t\t\t'hook' => $hook,
\t\t\t'args' => func_get_args(),
\t\t);
\t};
}

function wphx_304_02_install_event_loggers() {
\t$hooks = array(
\t\t'add_option'                    => 2,
\t\t'add_option_wphx_added_on'      => 2,
\t\t'added_option'                  => 2,
\t\t'update_option'                 => 3,
\t\t'update_option_wphx_nonautoload' => 3,
\t\t'updated_option'                => 3,
\t\t'delete_option'                 => 1,
\t\t'delete_option_wphx_delete_me'  => 1,
\t\t'deleted_option'                => 1,
\t);
\tforeach ( $hooks as $hook => $accepted_args ) {
\t\tadd_action( $hook, wphx_304_02_event_logger( $hook ), 10, $accepted_args );
\t}
}

function wphx_304_02_run_cases() {
\tglobal $new_allowed_options;

\t$cases = array();

\twphx_304_02_reset_state();
\t$alloptions = wp_load_alloptions();
\t$cases[]    = wphx_304_02_case(
\t\t'get-option:autoload-home-siteurl',
\t\t'get_option',
\t\tarray(
\t\t\t'alloptionKeys' => array_keys( $alloptions ),
\t\t\t'siteurl'       => get_option( 'siteurl' ),
\t\t\t'home'          => get_option( 'home' ),
\t\t\t'autoloaded'    => get_option( 'wphx_autoloaded' ),
\t\t),
\t\twphx_304_02_snapshot( array( 'siteurl', 'home', 'wphx_autoloaded' ) )
\t);

\twphx_304_02_reset_state();
\t$cases[] = wphx_304_02_case(
\t\t'get-option:missing-default-notoptions',
\t\t'get_option',
\t\tarray(
\t\t\t'withDefault'     => get_option( 'wphx_missing', 'fallback-value' ),
\t\t\t'withoutDefault'  => get_option( 'wphx_missing' ),
\t\t\t'secondLookup'    => get_option( 'wphx_missing', 'second-default' ),
\t\t),
\t\twphx_304_02_snapshot( array( 'wphx_missing' ) )
\t);

\twphx_304_02_reset_state();
\t$filter_events = array();
\tadd_filter(
\t\t'pre_option_wphx_pre_filtered',
\t\tfunction ( $pre, $option, $default_value ) use ( &$filter_events ) {
\t\t\t$filter_events[] = array( 'hook' => 'pre_option_wphx_pre_filtered', 'pre' => $pre, 'option' => $option, 'default' => $default_value );
\t\t\treturn 'pre-filtered';
\t\t},
\t\t10,
\t\t3
\t);
\tadd_filter(
\t\t'default_option_wphx_missing_filtered',
\t\tfunction ( $default_value, $option, $passed_default ) use ( &$filter_events ) {
\t\t\t$filter_events[] = array( 'hook' => 'default_option_wphx_missing_filtered', 'default' => $default_value, 'option' => $option, 'passed' => $passed_default );
\t\t\treturn 'default-filtered';
\t\t},
\t\t10,
\t\t3
\t);
\tadd_filter(
\t\t'option_wphx_nonautoload',
\t\tfunction ( $value, $option ) use ( &$filter_events ) {
\t\t\t$filter_events[] = array( 'hook' => 'option_wphx_nonautoload', 'value' => $value, 'option' => $option );
\t\t\treturn $value . '|option-filtered';
\t\t},
\t\t10,
\t\t2
\t);
\t$cases[] = wphx_304_02_case(
\t\t'get-option:filters',
\t\t'get_option',
\t\tarray(
\t\t\t'pre'     => get_option( 'wphx_pre_filtered', 'unused-default' ),
\t\t\t'default' => get_option( 'wphx_missing_filtered' ),
\t\t\t'option'  => get_option( 'wphx_nonautoload' ),
\t\t),
\t\tarray( 'events' => $filter_events, 'snapshot' => wphx_304_02_snapshot( array( 'wphx_nonautoload' ) ) )
\t);

\twphx_304_02_reset_state();
\t$options = get_options( array( 'wphx_nonautoload', 'wphx_autoloaded', 'wphx_absent_batch' ) );
\t$cases[] = wphx_304_02_case(
\t\t'get-options:prime-batch',
\t\t'get_options',
\t\t$options,
\t\twphx_304_02_snapshot( array( 'wphx_nonautoload', 'wphx_absent_batch' ) )
\t);

\twphx_304_02_reset_state();
\t$new_allowed_options = array( 'wphx_group' => array( 'wphx_nonautoload', 'wphx_group_missing' ) );
\twp_prime_option_caches_by_group( 'wphx_group' );
\t$cases[] = wphx_304_02_case(
\t\t'prime-by-group:allowed-options',
\t\t'wp_prime_option_caches_by_group',
\t\tarray(
\t\t\t'nonautoload' => get_option( 'wphx_nonautoload' ),
\t\t\t'missing'     => get_option( 'wphx_group_missing', 'group-default' ),
\t\t),
\t\twphx_304_02_snapshot( array( 'wphx_nonautoload', 'wphx_group_missing' ) )
\t);

\twphx_304_02_reset_state();
\twphx_304_02_install_event_loggers();
\tget_option( 'wphx_added_on', 'seed-notoptions' );
\t$added_on  = add_option( 'wphx_added_on', array( 'nested' => 'value', 'flag' => true ), '', true );
\t$added_off = add_option( 'wphx_added_off', 'manual-off', '', false );
\t$cases[]   = wphx_304_02_case(
\t\t'add-option:autoload-on-off',
\t\t'add_option',
\t\tarray(
\t\t\t'addedOn'      => $added_on,
\t\t\t'addedOff'     => $added_off,
\t\t\t'addedOnValue' => get_option( 'wphx_added_on' ),
\t\t\t'addedOffRaw'  => wp_cache_get( 'wphx_added_off', 'options' ),
\t\t),
\t\tarray( 'events' => $GLOBALS['wphx_304_02_events'], 'snapshot' => wphx_304_02_snapshot( array( 'wphx_added_on', 'wphx_added_off' ) ) )
\t);

\twphx_304_02_reset_state();
\twphx_304_02_install_event_loggers();
\twp_load_alloptions();
\t$updated = update_option( 'wphx_nonautoload', 'changed-value', true );
\t$cases[] = wphx_304_02_case(
\t\t'update-option:value-and-autoload',
\t\t'update_option',
\t\tarray(
\t\t\t'updated' => $updated,
\t\t\t'value'   => get_option( 'wphx_nonautoload' ),
\t\t),
\t\tarray( 'events' => $GLOBALS['wphx_304_02_events'], 'snapshot' => wphx_304_02_snapshot( array( 'wphx_nonautoload' ) ) )
\t);

\twphx_304_02_reset_state();
\twp_load_alloptions();
\t$autoload_results = wp_set_option_autoload_values(
\t\tarray(
\t\t\t'wphx_bulk_on'  => false,
\t\t\t'wphx_bulk_off' => true,
\t\t\t'wphx_absent'   => true,
\t\t)
\t);
\t$cases[]          = wphx_304_02_case(
\t\t'set-option-autoload:bulk',
\t\t'wp_set_option_autoload_values',
\t\t$autoload_results,
\t\twphx_304_02_snapshot( array( 'wphx_bulk_on', 'wphx_bulk_off', 'wphx_absent' ) )
\t);

\twphx_304_02_reset_state();
\t$single_wrapper = wp_set_option_autoload( 'wphx_bulk_on', false );
\t$bulk_wrapper   = wp_set_options_autoload( array( 'wphx_bulk_off', 'wphx_nonautoload' ), true );
\t$cases[]        = wphx_304_02_case(
\t\t'set-option-autoload:wrappers',
\t\t'wp_set_option_autoload/wp_set_options_autoload',
\t\tarray(
\t\t\t'single' => $single_wrapper,
\t\t\t'bulk'   => $bulk_wrapper,
\t\t),
\t\twphx_304_02_snapshot( array( 'wphx_bulk_on', 'wphx_bulk_off', 'wphx_nonautoload' ) )
\t);

\twphx_304_02_reset_state();
\twphx_304_02_install_event_loggers();
\tget_option( 'wphx_delete_me' );
\t$deleted = delete_option( 'wphx_delete_me' );
\t$cases[] = wphx_304_02_case(
\t\t'delete-option:cache-notoptions',
\t\t'delete_option',
\t\tarray(
\t\t\t'deleted' => $deleted,
\t\t\t'after'   => get_option( 'wphx_delete_me', 'after-delete-default' ),
\t\t),
\t\tarray( 'events' => $GLOBALS['wphx_304_02_events'], 'snapshot' => wphx_304_02_snapshot( array( 'wphx_delete_me' ) ) )
\t);

\twphx_304_02_reset_state();
\tob_start();
\tform_option( 'wphx_html' );
\t$form_output = ob_get_clean();
\t$cases[]     = wphx_304_02_case(
\t\t'form-option:escaped-output',
\t\t'form_option',
\t\t$form_output,
\t\twphx_304_02_snapshot( array( 'wphx_html' ) )
\t);

\twphx_304_02_reset_state();
\t$autoload_filter_events = array();
\tadd_filter(
\t\t'wp_default_autoload_value',
\t\tfunction ( $autoload, $option, $value, $serialized_value ) use ( &$autoload_filter_events ) {
\t\t\t$autoload_filter_events[] = array( 'option' => $option, 'value' => $value, 'serializedBytes' => strlen( $serialized_value ) );
\t\t\tif ( 'wphx_filter_on' === $option ) {
\t\t\t\treturn true;
\t\t\t}
\t\t\tif ( 'wphx_filter_off' === $option ) {
\t\t\t\treturn false;
\t\t\t}
\t\t\treturn $autoload;
\t\t},
\t\t5,
\t\t4
\t);
\t$cases[] = wphx_304_02_case(
\t\t'autoload:determine-and-size-filter',
\t\t'wp_determine_option_autoload_value',
\t\tarray(
\t\t\t'true'          => wp_determine_option_autoload_value( 'wphx_true', 'v', 'v', true ),
\t\t\t'false'         => wp_determine_option_autoload_value( 'wphx_false', 'v', 'v', false ),
\t\t\t'yes'           => wp_determine_option_autoload_value( 'wphx_yes', 'v', 'v', 'yes' ),
\t\t\t'no'            => wp_determine_option_autoload_value( 'wphx_no', 'v', 'v', 'no' ),
\t\t\t'filterOn'      => wp_determine_option_autoload_value( 'wphx_filter_on', 'v', 'v', null ),
\t\t\t'filterOff'     => wp_determine_option_autoload_value( 'wphx_filter_off', 'v', 'v', null ),
\t\t\t'sizeSmall'     => wp_filter_default_autoload_value_via_option_size( null, 'wphx_small', '1234', '1234' ),
\t\t\t'sizeLarge'     => wp_filter_default_autoload_value_via_option_size( null, 'wphx_large', str_repeat( 'x', 8 ), str_repeat( 'x', 8 ) ),
\t\t\t'autoloadValues' => wp_autoload_values_to_autoload(),
\t\t),
\t\tarray( 'events' => $autoload_filter_events )
\t);

\treturn $cases;
}

$snapshot = array(
\t'mode'                  => $mode,
\t'phpVersion'            => PHP_VERSION,
\t'coveredFunctionExists' => array(
\t\t'get_option'                         => function_exists( 'get_option' ),
\t\t'get_options'                        => function_exists( 'get_options' ),
\t\t'wp_prime_option_caches'             => function_exists( 'wp_prime_option_caches' ),
\t\t'wp_prime_option_caches_by_group'    => function_exists( 'wp_prime_option_caches_by_group' ),
\t\t'wp_set_option_autoload_values'      => function_exists( 'wp_set_option_autoload_values' ),
\t\t'wp_set_options_autoload'            => function_exists( 'wp_set_options_autoload' ),
\t\t'wp_set_option_autoload'             => function_exists( 'wp_set_option_autoload' ),
\t\t'form_option'                        => function_exists( 'form_option' ),
\t\t'wp_load_alloptions'                 => function_exists( 'wp_load_alloptions' ),
\t\t'update_option'                      => function_exists( 'update_option' ),
\t\t'add_option'                         => function_exists( 'add_option' ),
\t\t'delete_option'                      => function_exists( 'delete_option' ),
\t\t'wp_determine_option_autoload_value' => function_exists( 'wp_determine_option_autoload_value' ),
\t\t'wp_autoload_values_to_autoload'     => function_exists( 'wp_autoload_values_to_autoload' ),
\t),
\t'cases'                 => wphx_304_02_run_cases(),
);

echo json_encode( $snapshot, JSON_UNESCAPED_SLASHES );
`
  );
}

function normalize(result) {
  return {
    coveredFunctionExists: result.coveredFunctionExists,
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
  return {
    matches: JSON.stringify(oracle) === JSON.stringify(candidate),
    oracle,
    candidate
  };
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-304-option-storage`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha, upstreamDigest) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/option-storage-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "workset",
      name: "option storage/autoload differential fixture harness",
      area: "wp-includes",
      public_contract:
        "WordPress 7.0 single-site option storage, alloptions/notoptions, autoload, and option filter/hook behavior stay observable while the candidate side is still an oracle source mirror."
    },
    ownership_state: "external_oracle",
    upstream: {
      repo: UPSTREAM_ROOT,
      ref: WP_REF,
      paths: SOURCE_FILES,
      digest: upstreamDigest
    },
    owned_paths: ["tools/wp-core/run-option-storage-fixture.mjs", OUT, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-304-option-storage",
        "npm run wp:core:wphx-304-option-storage:check",
        "npm run beads:validate",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-304-02-option-storage-fixture"],
      manifest_digest: manifestSha
    },
    notes:
      "The candidate fixture root is an oracle source mirror for WPHX-304.02. The probe uses a constrained wpdb option-table test double to exercise WordPress option/cache logic deterministically; real wpdb SQL and storage-engine parity remain WPHX-305."
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
  schema: "wphx.wp-core-option-storage-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-option-storage-fixture.mjs",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    source_units: sourceUnits,
    upstream_digest: upstreamDigest
  },
  fixture: {
    candidate_kind: "oracle_source_mirror",
    source_domain: surface.domains.find((domain) => domain.id === "option_storage_autoload")?.label ?? "option storage/autoload",
    covered_symbols: COVERED_SYMBOLS,
    cases: FIXTURE_CASES,
    native_boundaries: [
      {
        id: "wpdb-option-table-test-double",
        reason:
          "The probe supplies a deterministic wpdb option-table test double so option.php storage/cache decisions run without a real database. Full query preparation, SQL execution, and storage-engine behavior remain WPHX-305."
      },
      {
        id: "object-cache-runtime",
        reason:
          "alloptions, notoptions, and individual option caches use WordPress's native WP_Object_Cache runtime and public wp_cache_* functions."
      },
      {
        id: "plugin-filter-hooks",
        reason:
          "pre_option/default_option/option filters and add/update/delete option actions must remain native PHP callbacks with WordPress-compatible argument ordering."
      },
      {
        id: "escaping-kses-entity-boundary",
        reason:
          "form_option() retrieves options and delegates output escaping through esc_attr(), which reaches KSES entity normalization owned by the WPHX-303 security/escaping surface."
      },
      {
        id: "php-serialization",
        reason:
          "Option values are stored through maybe_serialize()/maybe_unserialize(), so serialized scalar and array shapes remain PHP-native until WPHX-304.05 isolates serialization parity."
      }
    ],
    follow_up_owner: "WPHX-304.07"
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
  runs,
  comparisons,
  remaining_gaps: [
    {
      id: "haxe-candidate-not-yet-installed",
      owner: "WPHX-304.07",
      detail: "The candidate side is a copied WordPress oracle source tree until selected pure option/cache helpers move to Haxe parity candidates."
    },
    {
      id: "real-wpdb-not-yet-ported",
      owner: "WPHX-305",
      detail: "This fixture constrains wpdb to deterministic option-table behavior. Full wpdb query preparation, DB errors, result objects, and storage parity are a separate WPHX-305 domain."
    },
    {
      id: "site-network-options-deferred",
      owner: "WPHX-304.03/WPHX-304.04",
      detail: "Site/network options, site transients, and persistent object-cache drop-in behavior remain separate WPHX-304 fixture slices."
    },
    {
      id: "full-upstream-phpunit-not-yet-ported",
      owner: "WPHX-304",
      detail: "This fixture covers seed traces. Full upstream option PHPUnit parity remains a domain-level closure requirement."
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
  id: "receipt:wphx-304-02-option-storage-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    {
      path: OUT,
      role: "option storage/autoload differential fixture manifest"
    },
    {
      path: OWNERSHIP,
      role: "external-oracle ownership manifest for the fixture harness"
    },
    {
      path: "tools/wp-core/run-option-storage-fixture.mjs",
      role: "fixture generator and check-mode validator"
    }
  ],
  verification_commands: [
    "npm run wp:core:wphx-304-option-storage",
    "npm run wp:core:wphx-304-option-storage:check",
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
