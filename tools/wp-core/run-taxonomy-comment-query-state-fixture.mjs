#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.15.1",
  external_ref: "WPHX-308.05",
  title: "Taxonomy/comment query-state oracle fixture"
};
const OUT_ROOT = "build/wp-core/wphx-308-05";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-308-05-taxonomy-comment-query-state-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-308-05-taxonomy-comment-query-state-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-308-05-taxonomy-comment-query-state-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-308-01-taxonomy-comments-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-308-02-taxonomy-comment-adapter-contract-candidate.v1.json";
const CRUD = "manifests/wp-core/wphx-308-03-taxonomy-comment-crud-fixture.v1.json";
const COUNT_CACHE = "manifests/wp-core/wphx-308-04-taxonomy-comment-count-cache-fixture.v1.json";
const RECORDED_AT = "2026-06-23T23:20:00.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const UPSTREAM_ROOT = "../wordpress-develop";

const SOURCE_FILES = [
  "src/wp-includes/class-wp-error.php",
  "src/wp-includes/class-wp-taxonomy.php",
  "src/wp-includes/class-wp-term.php",
  "src/wp-includes/class-wp-comment.php",
  "src/wp-includes/class-wp-meta-query.php",
  "src/wp-includes/class-wp-date-query.php",
  "src/wp-includes/class-wp-term-query.php",
  "src/wp-includes/class-wp-comment-query.php",
  "src/wp-includes/taxonomy.php",
  "src/wp-includes/comment.php"
];

const COVERED_SYMBOLS = [
  "WP_Term_Query::__construct",
  "WP_Term_Query::parse_query",
  "WP_Term_Query::get_terms",
  "get_terms",
  "WP_Comment_Query::__construct",
  "WP_Comment_Query::parse_query",
  "WP_Comment_Query::get_comments",
  "WP_Comment_Query::get_comment_ids",
  "get_comments"
];

const FIXTURE_CASES = [
  {
    id: "term-query:basic",
    symbol: "WP_Term_Query::get_terms",
    focus: "taxonomy, hide_empty, fields, orderby, limit, parse hooks, SQL request, and terms_clauses"
  },
  {
    id: "term-query:include-search-meta",
    symbol: "WP_Term_Query::get_terms",
    focus: "include ordering, search SQL, meta query joins, cache key path, and selected query vars"
  },
  {
    id: "term-query:count",
    symbol: "WP_Term_Query::get_terms",
    focus: "count field request shape and count result path"
  },
  {
    id: "comment-query:status-type-post",
    symbol: "WP_Comment_Query::get_comments",
    focus: "status/type/post filters, found rows, paging limits, parse hooks, SQL request, and comments_clauses"
  },
  {
    id: "comment-query:include-search-date-meta",
    symbol: "WP_Comment_Query::get_comments",
    focus: "comment__in ordering, search columns, date query, meta query joins, and selected query vars"
  },
  {
    id: "comment-query:count",
    symbol: "WP_Comment_Query::get_comments",
    focus: "count request shape and count result path"
  }
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

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'WP_DEBUG', false );
define( 'OBJECT', 'OBJECT' );
define( 'ARRAY_A', 'ARRAY_A' );
define( 'ARRAY_N', 'ARRAY_N' );

$GLOBALS['wp_taxonomies'] = array();
$GLOBALS['wp_filter'] = array();
$GLOBALS['wphx_308_05_actions'] = array();
$GLOBALS['wphx_308_05_filters'] = array();
$GLOBALS['wphx_308_05_cache'] = array();
$GLOBALS['wphx_308_05_php_errors'] = array();
$GLOBALS['_wp_suspend_cache_invalidation'] = false;

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_308_05_php_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

class WPHX_308_05_WPDB {
\tpublic $terms = 'wp_terms';
\tpublic $term_taxonomy = 'wp_term_taxonomy';
\tpublic $term_relationships = 'wp_term_relationships';
\tpublic $termmeta = 'wp_termmeta';
\tpublic $comments = 'wp_comments';
\tpublic $commentmeta = 'wp_commentmeta';
\tpublic $posts = 'wp_posts';
\tpublic $last_query = '';
\tpublic $queries = array();

\tpublic function prepare( $query, ...$args ) {
\t\tif ( 1 === count( $args ) && is_array( $args[0] ) ) {
\t\t\t$args = $args[0];
\t\t}
\t\tforeach ( $args as $arg ) {
\t\t\t$value = is_int( $arg ) || is_float( $arg ) ? (string) $arg : "'" . str_replace( "'", "''", (string) $arg ) . "'";
\t\t\t$query = preg_replace( '/%[sdF]/', $value, $query, 1 );
\t\t}
\t\treturn $query;
\t}

\tpublic function esc_like( $text ) {
\t\treturn addcslashes( (string) $text, '_%\\\\' );
\t}

\tpublic function remove_placeholder_escape( $query ) {
\t\treturn $query;
\t}

\tpublic function get_results( $query ) {
\t\t$this->record( $query );
\t\treturn array();
\t}

\tpublic function get_col( $query ) {
\t\t$this->record( $query );
\t\treturn array();
\t}

\tpublic function get_var( $query ) {
\t\t$this->record( $query );
\t\treturn '0';
\t}

\tprivate function record( $query ) {
\t\t$this->last_query = wphx_308_05_normalize_sql( $query );
\t\t$this->queries[] = $this->last_query;
\t}
}

$GLOBALS['wpdb'] = new WPHX_308_05_WPDB();

function add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wp_filter'][ $hook_name ][ $priority ][] = array( $callback, $accepted_args );
\tksort( $GLOBALS['wp_filter'][ $hook_name ] );
\treturn true;
}
function add_action( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) { return add_filter( $hook_name, $callback, $priority, $accepted_args ); }
function remove_filter( $hook_name, $callback = false, $priority = 10 ) { unset( $GLOBALS['wp_filter'][ $hook_name ] ); return true; }
function has_filter( $hook_name, $callback = false ) { return ! empty( $GLOBALS['wp_filter'][ $hook_name ] ); }
function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_308_05_filters'][] = array( 'hook' => $hook_name, 'args' => wphx_308_05_filter_args( $args ) );
\tif ( empty( $GLOBALS['wp_filter'][ $hook_name ] ) ) {
\t\treturn $value;
\t}
\tforeach ( $GLOBALS['wp_filter'][ $hook_name ] as $callbacks ) {
\t\tforeach ( $callbacks as $record ) {
\t\t\t$callback_args = array_merge( array( $value ), $args );
\t\t\t$value = call_user_func_array( $record[0], array_slice( $callback_args, 0, $record[1] ) );
\t\t}
\t}
\treturn $value;
}
function apply_filters_ref_array( $hook_name, $args ) {
\t$GLOBALS['wphx_308_05_filters'][] = array( 'hook' => $hook_name, 'args' => wphx_308_05_filter_args( $args ) );
\tif ( empty( $GLOBALS['wp_filter'][ $hook_name ] ) ) {
\t\treturn $args[0];
\t}
\t$value = $args[0];
\tforeach ( $GLOBALS['wp_filter'][ $hook_name ] as $callbacks ) {
\t\tforeach ( $callbacks as $record ) {
\t\t\t$value = call_user_func_array( $record[0], array_slice( $args, 0, $record[1] ) );
\t\t\t$args[0] = $value;
\t\t}
\t}
\treturn $value;
}
function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_308_05_actions'][] = array( 'hook' => $hook_name, 'args' => wphx_308_05_filter_args( $args ) );
\tapply_filters( $hook_name, null, ...$args );
}
function do_action_ref_array( $hook_name, $args ) {
\t$GLOBALS['wphx_308_05_actions'][] = array( 'hook' => $hook_name, 'args' => wphx_308_05_filter_args( $args ) );
\tapply_filters_ref_array( $hook_name, array_merge( array( null ), $args ) );
}

function __( $text ) { return $text; }
function _x( $text ) { return $text; }
function _n( $single, $plural, $number ) { return 1 === (int) $number ? $single : $plural; }
function _deprecated_function( $function_name, $version, $replacement = '' ) { $GLOBALS['wphx_308_05_php_errors'][] = array( 'deprecated_function' => $function_name, 'version' => $version, 'replacement' => $replacement ); }
function _doing_it_wrong( $function_name, $message, $version ) { $GLOBALS['wphx_308_05_php_errors'][] = array( 'doing_it_wrong' => $function_name, 'message' => $message, 'version' => $version ); }
function wp_parse_args( $args, $defaults = array() ) {
\tif ( is_object( $args ) ) {
\t\t$args = get_object_vars( $args );
\t} elseif ( is_string( $args ) ) {
\t\tparse_str( $args, $args );
\t}
\treturn array_merge( $defaults, (array) $args );
}
function wp_parse_list( $input_list ) {
\tif ( ! is_array( $input_list ) ) {
\t\treturn preg_split( '/[\\s,]+/', (string) $input_list, -1, PREG_SPLIT_NO_EMPTY );
\t}
\treturn $input_list;
}
function wp_parse_id_list( $input_list ) { return array_values( array_unique( array_map( 'absint', wp_parse_list( $input_list ) ) ) ); }
function wp_parse_slug_list( $input_list ) { return array_values( array_unique( array_map( 'sanitize_title', wp_parse_list( $input_list ) ) ) ); }
function wp_unslash( $value ) { return is_array( $value ) ? array_map( 'wp_unslash', $value ) : stripslashes( (string) $value ); }
function wp_slash( $value ) { return is_array( $value ) ? array_map( 'wp_slash', $value ) : addslashes( (string) $value ); }
function absint( $value ) { return abs( (int) $value ); }
function sanitize_key( $key ) { return preg_replace( '/[^a-z0-9_\\\\-]/', '', strtolower( (string) $key ) ); }
function sanitize_title( $title, $fallback_title = '', $context = 'save' ) {
\t$title = strtolower( trim( (string) $title ) );
\t$title = preg_replace( '/[^a-z0-9]+/', '-', $title );
\t$title = trim( $title, '-' );
\treturn '' === $title ? (string) $fallback_title : $title;
}
function sanitize_title_with_dashes( $title, $raw_title = '', $context = 'display' ) { return sanitize_title( $title ); }
function sanitize_title_for_query( $title ) { return sanitize_title( $title, '', 'query' ); }
function sanitize_html_class( $class, $fallback = '' ) { return sanitize_key( $class ) ?: $fallback; }
function esc_sql( $data ) { return is_array( $data ) ? array_map( 'esc_sql', $data ) : str_replace( "'", "''", (string) $data ); }
function esc_like( $text ) { return addcslashes( (string) $text, '_%\\\\' ); }
function wp_array_slice_assoc( $array, $keys ) {
\t$result = array();
\tforeach ( $keys as $key ) {
\t\tif ( array_key_exists( $key, $array ) ) {
\t\t\t$result[ $key ] = $array[ $key ];
\t\t}
\t}
\treturn $result;
}
function wp_list_pluck( $input_list, $field, $index_key = null ) {
\t$result = array();
\tforeach ( $input_list as $key => $value ) {
\t\t$item = is_object( $value ) ? ( $value->$field ?? null ) : ( $value[ $field ] ?? null );
\t\tif ( null === $index_key ) {
\t\t\t$result[] = $item;
\t\t} else {
\t\t\t$index = is_object( $value ) ? ( $value->$index_key ?? $key ) : ( $value[ $index_key ] ?? $key );
\t\t\t$result[ $index ] = $item;
\t\t}
\t}
\treturn $result;
}

function wp_cache_get( $key, $group = '' ) { return $GLOBALS['wphx_308_05_cache'][ $group ][ $key ] ?? false; }
function wp_cache_add( $key, $data, $group = '', $expire = 0 ) { if ( isset( $GLOBALS['wphx_308_05_cache'][ $group ][ $key ] ) ) return false; $GLOBALS['wphx_308_05_cache'][ $group ][ $key ] = $data; return true; }
function wp_cache_set( $key, $data, $group = '', $expire = 0 ) { $GLOBALS['wphx_308_05_cache'][ $group ][ $key ] = $data; return true; }
function wp_cache_delete( $key, $group = '' ) { unset( $GLOBALS['wphx_308_05_cache'][ $group ][ $key ] ); return true; }
function wp_cache_get_last_changed( $group ) { return $GLOBALS['wphx_308_05_cache'][ $group ]['last_changed'] ?? 'fixture'; }
function wp_cache_set_last_changed( $group ) { $GLOBALS['wphx_308_05_cache'][ $group ]['last_changed'] = 'fixture'; return 'fixture'; }
function wp_cache_get_salted( $key, $group, $salt ) { return wp_cache_get( $salt . ':' . $key, $group ); }
function wp_cache_set_salted( $key, $data, $group, $salt, $expire = 0 ) { return wp_cache_set( $salt . ':' . $key, $data, $group, $expire ); }
function wp_cache_get_multiple_salted( $keys, $group, $salt ) { $result = array(); foreach ( $keys as $key ) $result[ $key ] = wp_cache_get_salted( $key, $group, $salt ); return $result; }
function wp_cache_set_multiple_salted( $data, $group, $salt, $expire = 0 ) { foreach ( $data as $key => $value ) wp_cache_set_salted( $key, $value, $group, $salt, $expire ); return true; }
function update_metadata_cache( $meta_type, $object_ids ) { return array(); }
function _get_meta_table( $type ) {
\tglobal $wpdb;
\t$property = $type . 'meta';
\treturn $wpdb->$property ?? false;
}
function _prime_post_caches( $ids, $update_term_cache = true, $update_meta_cache = true ) {}
function get_option( $name, $default = false ) { return $default; }
function update_option( $name, $value, $autoload = null ) { return true; }
function delete_option( $name ) { return true; }
function is_admin() { return false; }
function is_multisite() { return false; }
function post_type_exists( $post_type ) { return in_array( $post_type, array( 'post', 'page' ), true ); }
function _get_custom_object_labels( $data_object, $nohier_vs_hier_defaults ) {
\t$data_object->labels = (array) $data_object->labels;
\t$defaults = array();
\tforeach ( $nohier_vs_hier_defaults as $key => $value ) {
\t\t$defaults[ $key ] = $data_object->hierarchical ? $value[1] : $value[0];
\t}
\t$data_object->labels = (object) $data_object->labels;
\treturn (object) array_merge( $defaults, (array) $data_object->labels );
}

require $root . '/wp-includes/class-wp-error.php';
require $root . '/wp-includes/class-wp-taxonomy.php';
require $root . '/wp-includes/class-wp-term.php';
require $root . '/wp-includes/class-wp-comment.php';
require $root . '/wp-includes/class-wp-meta-query.php';
require $root . '/wp-includes/class-wp-date-query.php';
require $root . '/wp-includes/taxonomy.php';
require $root . '/wp-includes/comment.php';
require $root . '/wp-includes/class-wp-term-query.php';
require $root . '/wp-includes/class-wp-comment-query.php';

function is_wp_error( $thing ) { return $thing instanceof WP_Error; }

function wphx_308_05_normalize_sql( $sql ) {
\t$sql = preg_replace( '/\\s+/', ' ', trim( (string) $sql ) );
\t$sql = str_replace( '\\\\', '/', $sql );
\treturn $sql;
}
function wphx_308_05_filter_args( $args ) {
\t$result = array();
\tforeach ( $args as $arg ) {
\t\tif ( $arg instanceof WP_Term_Query ) {
\t\t\t$result[] = array( 'class' => 'WP_Term_Query', 'vars' => wphx_308_05_selected_vars( $arg->query_vars ) );
\t\t} elseif ( $arg instanceof WP_Comment_Query ) {
\t\t\t$result[] = array( 'class' => 'WP_Comment_Query', 'vars' => wphx_308_05_selected_vars( $arg->query_vars ) );
\t\t} elseif ( is_array( $arg ) && isset( $arg['where'] ) ) {
\t\t\t$result[] = array( 'clauses' => wphx_308_05_normalize_clauses( $arg ) );
\t\t} else {
\t\t\t$result[] = is_object( $arg ) ? get_class( $arg ) : $arg;
\t\t}
\t}
\treturn $result;
}
function wphx_308_05_selected_vars( $vars ) {
\t$keys = array(
\t\t'taxonomy',
\t\t'object_ids',
\t\t'fields',
\t\t'include',
\t\t'orderby',
\t\t'order',
\t\t'hide_empty',
\t\t'slug',
\t\t'slug__in',
\t\t'search',
\t\t'name__like',
\t\t'number',
\t\t'offset',
\t\t'meta_key',
\t\t'meta_value',
\t\t'status',
\t\t'type',
\t\t'type__in',
\t\t'post_id',
\t\t'post__in',
\t\t'comment__in',
\t\t'count',
\t\t'no_found_rows',
\t\t'paged',
\t\t'date_query',
\t);
\treturn wp_array_slice_assoc( (array) $vars, $keys );
}
function wphx_308_05_normalize_clauses( $clauses ) {
\t$result = array();
\tforeach ( $clauses as $key => $value ) {
\t\t$result[ $key ] = is_string( $value ) ? wphx_308_05_normalize_sql( $value ) : $value;
\t}
\tksort( $result );
\treturn $result;
}
function wphx_308_05_sql_clauses( $query ) {
\t$reflection = new ReflectionObject( $query );
\t$property = $reflection->getProperty( 'sql_clauses' );
\t$property->setAccessible( true );
\treturn wphx_308_05_normalize_clauses( $property->getValue( $query ) );
}
function wphx_308_05_hook_counts() {
\t$counts = array();
\tforeach ( array_merge( $GLOBALS['wphx_308_05_actions'], $GLOBALS['wphx_308_05_filters'] ) as $event ) {
\t\t$counts[ $event['hook'] ] = ( $counts[ $event['hook'] ] ?? 0 ) + 1;
\t}
\tksort( $counts );
\treturn $counts;
}
function wphx_308_05_reset_logs() {
\t$GLOBALS['wphx_308_05_actions'] = array();
\t$GLOBALS['wphx_308_05_filters'] = array();
\t$GLOBALS['wpdb']->last_query = '';
\t$GLOBALS['wpdb']->queries = array();
}
function wphx_308_05_term_case( $args ) {
\twphx_308_05_reset_logs();
\t$query = new WP_Term_Query();
\t$result = $query->query( $args );
\treturn array(
\t\t'result' => $result,
\t\t'query_vars' => wphx_308_05_selected_vars( $query->query_vars ),
\t\t'request' => wphx_308_05_normalize_sql( $query->request ),
\t\t'sql_clauses' => wphx_308_05_sql_clauses( $query ),
\t\t'last_query' => $GLOBALS['wpdb']->last_query,
\t\t'hooks' => wphx_308_05_hook_counts(),
\t);
}
function wphx_308_05_comment_case( $args ) {
\twphx_308_05_reset_logs();
\t$query = new WP_Comment_Query();
\t$result = $query->query( $args );
\treturn array(
\t\t'result' => $result,
\t\t'query_vars' => wphx_308_05_selected_vars( $query->query_vars ),
\t\t'request' => wphx_308_05_normalize_sql( $query->request ),
\t\t'sql_clauses' => wphx_308_05_sql_clauses( $query ),
\t\t'last_query' => $GLOBALS['wpdb']->last_query,
\t\t'found_comments' => (int) $query->found_comments,
\t\t'max_num_pages' => (int) $query->max_num_pages,
\t\t'hooks' => wphx_308_05_hook_counts(),
\t);
}

register_taxonomy( 'fixture_topic', array( 'post' ), array( 'public' => true, 'hierarchical' => true, 'rewrite' => false ) );

add_filter( 'terms_clauses', function ( $clauses, $taxonomies, $args ) {
\t$clauses['where'] .= ' /*fixture_terms_clauses*/';
\treturn $clauses;
}, 10, 3 );
add_filter( 'comments_clauses', function ( $clauses, $query ) {
\t$clauses['where'] .= ' /*fixture_comments_clauses*/';
\treturn $clauses;
}, 10, 2 );

$observations = array();
$observations['term-query:basic'] = wphx_308_05_term_case(
\tarray(
\t\t'taxonomy' => 'fixture_topic',
\t\t'hide_empty' => false,
\t\t'fields' => 'ids',
\t\t'orderby' => 'name',
\t\t'order' => 'DESC',
\t\t'number' => 5,
\t\t'offset' => 2,
\t\t'cache_results' => false,
\t\t'update_term_meta_cache' => false,
\t)
);
$observations['term-query:include-search-meta'] = wphx_308_05_term_case(
\tarray(
\t\t'taxonomy' => 'fixture_topic',
\t\t'fields' => 'ids',
\t\t'include' => array( 12, 11, 12 ),
\t\t'orderby' => 'include',
\t\t'search' => 'Alpha Beta',
\t\t'meta_key' => 'fixture_key',
\t\t'meta_value' => 'fixture_value',
\t\t'cache_results' => false,
\t\t'update_term_meta_cache' => false,
\t)
);
$observations['term-query:count'] = wphx_308_05_term_case(
\tarray(
\t\t'taxonomy' => 'fixture_topic',
\t\t'fields' => 'count',
\t\t'hide_empty' => false,
\t\t'cache_results' => false,
\t)
);
$observations['comment-query:status-type-post'] = wphx_308_05_comment_case(
\tarray(
\t\t'fields' => 'ids',
\t\t'status' => array( 'approve', 'hold' ),
\t\t'type__in' => array( 'comment', 'trackback' ),
\t\t'post_id' => 101,
\t\t'post__in' => array( 101, 102 ),
\t\t'number' => 10,
\t\t'paged' => 2,
\t\t'no_found_rows' => false,
\t\t'orderby' => 'comment_date_gmt',
\t\t'order' => 'ASC',
\t\t'update_comment_meta_cache' => false,
\t\t'update_comment_post_cache' => false,
\t)
);
$observations['comment-query:include-search-date-meta'] = wphx_308_05_comment_case(
\tarray(
\t\t'fields' => 'ids',
\t\t'comment__in' => array( 303, 301, 302 ),
\t\t'orderby' => 'comment__in',
\t\t'search' => 'Fixture Search',
\t\t'date_query' => array( array( 'after' => '2026-01-01', 'column' => 'comment_date_gmt' ) ),
\t\t'meta_key' => 'fixture_key',
\t\t'meta_value' => 'fixture_value',
\t\t'update_comment_meta_cache' => false,
\t\t'update_comment_post_cache' => false,
\t)
);
$observations['comment-query:count'] = wphx_308_05_comment_case(
\tarray(
\t\t'count' => true,
\t\t'status' => 'approve',
\t\t'type' => 'comment',
\t\t'post_id' => 101,
\t)
);
$observations['errors'] = $GLOBALS['wphx_308_05_php_errors'];
ksort( $observations );
echo json_encode(
\tarray(
\t\t'mode' => $mode,
\t\t'observations' => $observations,
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
);
`
  );
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-308-taxonomy-comment-query-state`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function runProbe(mode, root) {
  const output = command("php", [PROBE, mode, root]);
  return {
    mode,
    command: `php ${PROBE} ${mode} ${root}`,
    raw_output_sha256: sha256(output),
    result: JSON.parse(output)
  };
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/taxonomy-comment-query-state-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "oracle_fixture",
      name: "taxonomy/comment query-state oracle fixture",
      area: "wp-includes/class-wp-term-query.php wp-includes/class-wp-comment-query.php",
      public_contract:
        "This fixture records vanilla WordPress taxonomy/comment query-state behavior that generated Haxe-owned adapters must satisfy. It does not claim Haxe-owned public PHP replacement."
    },
    ownership_state: "oracle_fixture",
    ownership_axes: {
      semantic_owner: "upstream_oracle",
      adapter_contract_owner: "not_claimed",
      emission_strategy: "upstream_source_mirror_fixture",
      execution_provider: "php_oracle_process",
      compatibility_evidence: "targeted_semantic_parity"
    },
    bridge: {
      exists: true,
      kind: "oracle-source-mirror-fixture",
      removal_gate:
        "Replace candidate mirror with generated original-path PHP once WPHX-308 public taxonomy/comment query adapters exist."
    },
    owned_paths: [OUT, OWNERSHIP, RECEIPT, "tools/wp-core/run-taxonomy-comment-query-state-fixture.mjs"],
    generated_paths: [OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-308-taxonomy-comment-query-state",
        "npm run wp:core:wphx-308-taxonomy-comment-query-state:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-308-05-taxonomy-comment-query-state-fixture"],
      manifest_digest: manifestSha
    }
  };
}

rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
writeProbe();

const oracleRun = runProbe("oracle", ORACLE_ROOT);
const candidateRun = runProbe("candidate", CANDIDATE_ROOT);
const observationsEqual = JSON.stringify(oracleRun.result.observations) === JSON.stringify(candidateRun.result.observations);

if (!observationsEqual) {
  console.error(JSON.stringify({ status: "failed", oracle: oracleRun.result, candidate: candidateRun.result }, null, 2));
  process.exit(1);
}

const manifest = {
  schema: "wphx.wp-core-taxonomy-comment-query-state-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-taxonomy-comment-query-state-fixture.mjs",
  upstream: {
    repo: UPSTREAM_ROOT,
    commit: WP_REF,
    source_files: SOURCE_FILES.map(sourceRecord)
  },
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT),
    crud_fixture_manifest: inputRecord(CRUD),
    count_cache_fixture_manifest: inputRecord(COUNT_CACHE)
  },
  fixture: {
    evidence_class: "targeted_semantic_parity",
    artifact_scope: "oracle_source_mirror_fixture",
    source_files: SOURCE_FILES,
    covered_symbols: COVERED_SYMBOLS,
    cases: FIXTURE_CASES,
    candidate_policy: {
      public_php_replacement_claimed: false,
      haxe_semantic_ownership_claimed: false,
      handwritten_production_php_added: false,
      live_database_parity_claimed: false,
      note:
        "The candidate side currently mirrors locked upstream source to establish a stable fixture. A later WPHX-308 slice must replace the candidate mirror with generated original-path PHP before ownership can be upgraded."
    }
  },
  runs: {
    oracle: oracleRun,
    candidate: candidateRun,
    observations_equal: observationsEqual
  },
  parity: {
    status: observationsEqual ? "passed" : "failed",
    oracle_observation_sha256: sha256(JSON.stringify(oracleRun.result.observations)),
    candidate_observation_sha256: sha256(JSON.stringify(candidateRun.result.observations))
  },
  remaining_gaps: [
    {
      id: "generated-taxonomy-comment-query-adapter-not-installed",
      owner: "WPHX-308",
      detail:
        "Query-state behavior is only proven between upstream mirrors. Generated public PHP and typed Adapter IR are not yet installed."
    },
    {
      id: "live-db-taxonomy-comment-query-parity-not-covered",
      owner: "WPHX-308",
      detail:
        "The fixture captures deterministic request/clause state with empty result sets. Live MySQL/MariaDB SQL/result parity and upstream PHPUnit ratcheting remain future gates."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: observationsEqual ? "passed" : "failed",
    cases: FIXTURE_CASES.length,
    covered_symbols: COVERED_SYMBOLS.length,
    public_php_replacement_claimed: false,
    artifact_scope: "oracle_source_mirror_fixture"
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-308-05-taxonomy-comment-query-state-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "taxonomy/comment query-state oracle fixture manifest" },
    { path: OWNERSHIP, role: "ownership manifest for taxonomy/comment query-state fixture" },
    { path: "tools/wp-core/run-taxonomy-comment-query-state-fixture.mjs", role: "fixture generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-308-taxonomy-comment-query-state",
    "npm run wp:core:wphx-308-taxonomy-comment-query-state:check",
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

console.log(JSON.stringify({ status: "passed", output: OUT, ownership: OWNERSHIP, receipt: RECEIPT }, null, 2));
