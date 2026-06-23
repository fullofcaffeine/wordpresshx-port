#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-cf7",
  external_ref: "WPHX-308.04",
  title: "Taxonomy/comment count and cache invalidation oracle fixture"
};
const OUT_ROOT = "build/wp-core/wphx-308-04";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-308-04-taxonomy-comment-count-cache-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-308-04-taxonomy-comment-count-cache-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-308-04-taxonomy-comment-count-cache-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-308-01-taxonomy-comments-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-308-02-taxonomy-comment-adapter-contract-candidate.v1.json";
const CRUD = "manifests/wp-core/wphx-308-03-taxonomy-comment-crud-fixture.v1.json";
const RECORDED_AT = "2026-06-23T22:20:00.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const UPSTREAM_ROOT = "../wordpress-develop";

const SOURCE_FILES = [
  "src/wp-includes/class-wp-error.php",
  "src/wp-includes/class-wp-taxonomy.php",
  "src/wp-includes/class-wp-term.php",
  "src/wp-includes/class-wp-comment.php",
  "src/wp-includes/taxonomy.php",
  "src/wp-includes/comment.php"
];

const COVERED_SYMBOLS = [
  "wp_update_term_count",
  "wp_update_term_count_now",
  "wp_defer_term_counting",
  "clean_term_cache",
  "clean_object_term_cache",
  "wp_update_comment_count",
  "wp_update_comment_count_now",
  "wp_defer_comment_counting",
  "clean_comment_cache"
];

const FIXTURE_CASES = [
  {
    id: "term-count:immediate",
    symbol: "wp_update_term_count/wp_update_term_count_now",
    focus: "published post filtering, term_taxonomy count writes, count hooks, and term-cache invalidation"
  },
  {
    id: "term-count:deferred",
    symbol: "wp_defer_term_counting/wp_update_term_count",
    focus: "deferred queue retention and flush-on-disable behavior"
  },
  {
    id: "term-cache:clean-term-and-object",
    symbol: "clean_term_cache/clean_object_term_cache",
    focus: "term object cache deletes, taxonomy cache deletes, relationship cache deletes, last_changed updates, and hooks"
  },
  {
    id: "comment-count:immediate-and-deferred",
    symbol: "wp_update_comment_count/wp_defer_comment_counting",
    focus: "approved non-note comment counting, counts-cache invalidation, post-cache cleaning, and deferred flush behavior"
  },
  {
    id: "comment-cache:clean",
    symbol: "clean_comment_cache",
    focus: "comment object cache deletes, per-comment hooks, and comment last_changed updates"
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
$GLOBALS['wphx_308_04_actions'] = array();
$GLOBALS['wphx_308_04_cache'] = array();
$GLOBALS['wphx_308_04_cache_log'] = array();
$GLOBALS['wphx_308_04_option_log'] = array();
$GLOBALS['wphx_308_04_post_cache_log'] = array();
$GLOBALS['wphx_308_04_php_errors'] = array();
$GLOBALS['_wp_suspend_cache_invalidation'] = false;

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_308_04_php_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

class WPHX_308_04_WPDB {
\tpublic $terms = 'wp_terms';
\tpublic $term_taxonomy = 'wp_term_taxonomy';
\tpublic $term_relationships = 'wp_term_relationships';
\tpublic $termmeta = 'wp_termmeta';
\tpublic $comments = 'wp_comments';
\tpublic $commentmeta = 'wp_commentmeta';
\tpublic $posts = 'wp_posts';
\tpublic $insert_id = 0;
\tpublic $last_error = '';
\tpublic $queries = array();
\tpublic $data = array(
\t\t'wp_terms' => array(),
\t\t'wp_term_taxonomy' => array(),
\t\t'wp_term_relationships' => array(),
\t\t'wp_termmeta' => array(),
\t\t'wp_comments' => array(),
\t\t'wp_commentmeta' => array(),
\t\t'wp_posts' => array(),
\t);

\tpublic function seed_post( $id, $status = 'publish', $type = 'post', $comment_count = 0 ) {
\t\t$this->data[ $this->posts ][ (int) $id ] = (object) array(
\t\t\t'ID' => (int) $id,
\t\t\t'post_status' => $status,
\t\t\t'post_type' => $type,
\t\t\t'post_parent' => 0,
\t\t\t'comment_count' => (int) $comment_count,
\t\t);
\t}

\tpublic function seed_term( $term_id, $tt_id, $name, $slug, $taxonomy, $count = 0 ) {
\t\t$this->data[ $this->terms ][ (int) $term_id ] = (object) array(
\t\t\t'term_id' => (int) $term_id,
\t\t\t'name' => $name,
\t\t\t'slug' => $slug,
\t\t\t'term_group' => 0,
\t\t);
\t\t$this->data[ $this->term_taxonomy ][ (int) $tt_id ] = (object) array(
\t\t\t'term_taxonomy_id' => (int) $tt_id,
\t\t\t'term_id' => (int) $term_id,
\t\t\t'taxonomy' => $taxonomy,
\t\t\t'description' => '',
\t\t\t'parent' => 0,
\t\t\t'count' => (int) $count,
\t\t);
\t}

\tpublic function seed_relationship( $object_id, $tt_id ) {
\t\t$key = (int) $object_id . ':' . (int) $tt_id;
\t\t$this->data[ $this->term_relationships ][ $key ] = (object) array(
\t\t\t'object_id' => (int) $object_id,
\t\t\t'term_taxonomy_id' => (int) $tt_id,
\t\t\t'term_order' => 0,
\t\t);
\t}

\tpublic function seed_comment( $comment_id, $post_id, $approved = '1', $type = 'comment' ) {
\t\t$this->data[ $this->comments ][ (int) $comment_id ] = (object) array(
\t\t\t'comment_ID' => (int) $comment_id,
\t\t\t'comment_post_ID' => (int) $post_id,
\t\t\t'comment_author' => 'Fixture Author',
\t\t\t'comment_author_email' => 'author@example.test',
\t\t\t'comment_content' => 'Fixture comment ' . (int) $comment_id,
\t\t\t'comment_approved' => (string) $approved,
\t\t\t'comment_type' => (string) $type,
\t\t\t'comment_parent' => 0,
\t\t);
\t}

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

\tpublic function update( $table, $data, $where ) {
\t\t$table = (string) $table;
\t\t$count = 0;
\t\tforeach ( $this->data[ $table ] as $key => $row ) {
\t\t\tif ( $this->matches( $row, $where ) ) {
\t\t\t\tforeach ( $data as $field => $value ) {
\t\t\t\t\t$row->$field = $value;
\t\t\t\t}
\t\t\t\t$this->data[ $table ][ $key ] = $row;
\t\t\t\t++$count;
\t\t\t}
\t\t}
\t\treturn $count;
\t}

\tpublic function get_var( $query ) {
\t\t$this->queries[] = $query;
\t\tif ( preg_match( '/SELECT COUNT\\\\(\\\\*\\\\) FROM ' . preg_quote( $this->term_relationships, '/' ) . ', ' . preg_quote( $this->posts, '/' ) . " WHERE " . preg_quote( $this->posts, '/' ) . "\\\\.ID = " . preg_quote( $this->term_relationships, '/' ) . "\\\\.object_id AND post_status IN \\\\('([^']+)'\\\\) AND post_type IN \\\\('([^']+)'\\\\) AND term_taxonomy_id = (\\\\d+)/", $query, $m ) ) {
\t\t\t$count = 0;
\t\t\tforeach ( $this->data[ $this->term_relationships ] as $rel ) {
\t\t\t\t$post = $this->data[ $this->posts ][ (int) $rel->object_id ] ?? null;
\t\t\t\tif ( $post && (int) $rel->term_taxonomy_id === (int) $m[3] && $post->post_status === $m[1] && $post->post_type === $m[2] ) {
\t\t\t\t\t++$count;
\t\t\t\t}
\t\t\t}
\t\t\treturn $count;
\t\t}
\t\tif ( preg_match( '/SELECT COUNT\\\\(\\\\*\\\\) FROM ' . preg_quote( $this->term_relationships, '/' ) . ' WHERE term_taxonomy_id = (\\\\d+)/', $query, $m ) ) {
\t\t\t$count = 0;
\t\t\tforeach ( $this->data[ $this->term_relationships ] as $rel ) {
\t\t\t\tif ( (int) $rel->term_taxonomy_id === (int) $m[1] ) {
\t\t\t\t\t++$count;
\t\t\t\t}
\t\t\t}
\t\t\treturn $count;
\t\t}
\t\tif ( preg_match( '/SELECT COUNT\\\\(\\\\*\\\\) FROM ' . preg_quote( $this->comments, '/' ) . " WHERE comment_post_ID = (\\\\d+) AND comment_approved = '1' AND comment_type != 'note'/", $query, $m ) ) {
\t\t\t$count = 0;
\t\t\tforeach ( $this->data[ $this->comments ] as $row ) {
\t\t\t\tif ( (int) $row->comment_post_ID === (int) $m[1] && '1' === (string) $row->comment_approved && 'note' !== (string) $row->comment_type ) {
\t\t\t\t\t++$count;
\t\t\t\t}
\t\t\t}
\t\t\treturn $count;
\t\t}
\t\treturn null;
\t}

\tpublic function get_results( $query ) {
\t\t$this->queries[] = $query;
\t\tif ( preg_match( '/SELECT term_id, taxonomy FROM ' . preg_quote( $this->term_taxonomy, '/' ) . ' WHERE term_taxonomy_id IN \\\\(([^)]+)\\\\)/', $query, $m ) ) {
\t\t\t$ids = array_map( 'intval', preg_split( '/\\\\s*,\\\\s*/', str_replace( "'", '', $m[1] ) ) );
\t\t\t$result = array();
\t\t\tforeach ( $this->data[ $this->term_taxonomy ] as $row ) {
\t\t\t\tif ( in_array( (int) $row->term_taxonomy_id, $ids, true ) ) {
\t\t\t\t\t$result[] = (object) array( 'term_id' => (int) $row->term_id, 'taxonomy' => $row->taxonomy );
\t\t\t\t}
\t\t\t}
\t\t\treturn $result;
\t\t}
\t\treturn array();
\t}

\tprivate function matches( $row, $where ) {
\t\tforeach ( $where as $field => $value ) {
\t\t\tif ( ! isset( $row->$field ) || (string) $row->$field !== (string) $value ) {
\t\t\t\treturn false;
\t\t\t}
\t\t}
\t\treturn true;
\t}
}

$GLOBALS['wpdb'] = new WPHX_308_04_WPDB();
$GLOBALS['wpdb']->seed_post( 101, 'publish', 'post' );
$GLOBALS['wpdb']->seed_post( 102, 'draft', 'post' );
$GLOBALS['wpdb']->seed_post( 103, 'publish', 'post' );
$GLOBALS['wpdb']->seed_post( 201, 'publish', 'post' );

function add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wp_filter'][ $hook_name ][ $priority ][] = array( $callback, $accepted_args );
\tksort( $GLOBALS['wp_filter'][ $hook_name ] );
\treturn true;
}
function add_action( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) { return add_filter( $hook_name, $callback, $priority, $accepted_args ); }
function remove_filter( $hook_name, $callback = false, $priority = 10 ) { unset( $GLOBALS['wp_filter'][ $hook_name ] ); return true; }
function has_filter( $hook_name, $callback = false ) { return ! empty( $GLOBALS['wp_filter'][ $hook_name ] ); }
function apply_filters( $hook_name, $value, ...$args ) {
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
function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_308_04_actions'][] = array( 'hook' => $hook_name, 'args' => wphx_308_04_normalize( $args ) );
\tapply_filters( $hook_name, null, ...$args );
}

function __( $text ) { return $text; }
function _x( $text ) { return $text; }
function _n( $single, $plural, $number ) { return 1 === (int) $number ? $single : $plural; }
function _deprecated_function( $function_name, $version, $replacement = '' ) { $GLOBALS['wphx_308_04_php_errors'][] = array( 'deprecated_function' => $function_name, 'version' => $version, 'replacement' => $replacement ); }
function _doing_it_wrong( $function_name, $message, $version ) { $GLOBALS['wphx_308_04_php_errors'][] = array( 'doing_it_wrong' => $function_name, 'message' => $message, 'version' => $version ); }
function wp_parse_args( $args, $defaults = array() ) {
\tif ( is_object( $args ) ) {
\t\t$args = get_object_vars( $args );
\t} elseif ( is_string( $args ) ) {
\t\tparse_str( $args, $args );
\t}
\treturn array_merge( $defaults, (array) $args );
}
function absint( $value ) { return abs( (int) $value ); }
function sanitize_key( $key ) { return preg_replace( '/[^a-z0-9_\\\\-]/', '', strtolower( (string) $key ) ); }
function sanitize_title( $title, $fallback_title = '', $context = 'save' ) {
\t$title = strtolower( trim( (string) $title ) );
\t$title = preg_replace( '/[^a-z0-9]+/', '-', $title );
\t$title = trim( $title, '-' );
\treturn '' === $title ? (string) $fallback_title : $title;
}
function sanitize_title_with_dashes( $title, $raw_title = '', $context = 'display' ) { return sanitize_title( $title ); }
function sanitize_html_class( $class, $fallback = '' ) { return sanitize_key( $class ) ?: $fallback; }
function esc_sql( $data ) { return is_array( $data ) ? array_map( 'esc_sql', $data ) : str_replace( "'", "''", (string) $data ); }
function wp_unslash( $value ) { return is_array( $value ) ? array_map( 'wp_unslash', $value ) : stripslashes( (string) $value ); }
function wp_slash( $value ) { return is_array( $value ) ? array_map( 'wp_slash', $value ) : addslashes( (string) $value ); }
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
function wp_cache_get( $key, $group = '' ) { return $GLOBALS['wphx_308_04_cache'][ $group ][ $key ] ?? false; }
function wp_cache_add( $key, $data, $group = '', $expire = 0 ) { if ( isset( $GLOBALS['wphx_308_04_cache'][ $group ][ $key ] ) ) return false; $GLOBALS['wphx_308_04_cache'][ $group ][ $key ] = $data; return true; }
function wp_cache_set( $key, $data, $group = '', $expire = 0 ) { $GLOBALS['wphx_308_04_cache_log'][] = array( 'op' => 'set', 'group' => $group, 'key' => (string) $key ); $GLOBALS['wphx_308_04_cache'][ $group ][ $key ] = $data; return true; }
function wp_cache_delete( $key, $group = '' ) { $GLOBALS['wphx_308_04_cache_log'][] = array( 'op' => 'delete', 'group' => $group, 'key' => (string) $key ); unset( $GLOBALS['wphx_308_04_cache'][ $group ][ $key ] ); return true; }
function wp_cache_delete_multiple( $keys, $group = '' ) { foreach ( (array) $keys as $key ) wp_cache_delete( $key, $group ); return true; }
function wp_cache_set_last_changed( $group ) { $GLOBALS['wphx_308_04_cache_log'][] = array( 'op' => 'last_changed', 'group' => $group, 'key' => 'last_changed' ); $GLOBALS['wphx_308_04_cache'][ $group ]['last_changed'] = 'fixture'; return 'fixture'; }
function wp_cache_get_last_changed( $group ) { return $GLOBALS['wphx_308_04_cache'][ $group ]['last_changed'] ?? 'fixture'; }
function get_option( $name, $default = false ) { return $default; }
function update_option( $name, $value, $autoload = null ) { $GLOBALS['wphx_308_04_option_log'][] = array( 'op' => 'update', 'name' => $name ); return true; }
function delete_option( $name ) { $GLOBALS['wphx_308_04_option_log'][] = array( 'op' => 'delete', 'name' => $name ); return true; }
function is_admin() { return false; }
function post_type_exists( $post_type ) { return 'post' === $post_type; }
function get_post( $post_id ) { return $GLOBALS['wpdb']->data[ $GLOBALS['wpdb']->posts ][ (int) $post_id ] ?? false; }
function clean_post_cache( $post ) { $GLOBALS['wphx_308_04_post_cache_log'][] = is_object( $post ) ? (int) $post->ID : (int) $post; }
function _get_custom_object_labels( $data_object, $nohier_vs_hier_defaults ) {
\t$data_object->labels = (array) $data_object->labels;
\tif ( isset( $data_object->label ) && empty( $data_object->labels['name'] ) ) {
\t\t$data_object->labels['name'] = $data_object->label;
\t}
\t$defaults = array();
\tforeach ( $nohier_vs_hier_defaults as $key => $value ) {
\t\t$defaults[ $key ] = $data_object->hierarchical ? $value[1] : $value[0];
\t}
\t$labels = array_merge( $defaults, $data_object->labels );
\t$data_object->labels = (object) $data_object->labels;
\treturn (object) $labels;
}

require $root . '/wp-includes/class-wp-error.php';
require $root . '/wp-includes/class-wp-taxonomy.php';
require $root . '/wp-includes/class-wp-term.php';
require $root . '/wp-includes/class-wp-comment.php';
require $root . '/wp-includes/taxonomy.php';
require $root . '/wp-includes/comment.php';

function is_wp_error( $thing ) { return $thing instanceof WP_Error; }
function wphx_308_04_normalize( $value ) {
\tif ( $value instanceof WP_Error ) {
\t\treturn array( 'wp_error' => $value->get_error_code(), 'data' => $value->get_error_data() );
\t}
\tif ( is_array( $value ) ) return array_map( 'wphx_308_04_normalize', $value );
\tif ( is_object( $value ) ) return wphx_308_04_normalize( get_object_vars( $value ) );
\treturn $value;
}
function wphx_308_04_hook_counts() {
\t$counts = array();
\tforeach ( $GLOBALS['wphx_308_04_actions'] as $event ) {
\t\t$counts[ $event['hook'] ] = ( $counts[ $event['hook'] ] ?? 0 ) + 1;
\t}
\tksort( $counts );
\treturn $counts;
}
function wphx_308_04_reset_logs() {
\t$GLOBALS['wphx_308_04_actions'] = array();
\t$GLOBALS['wphx_308_04_cache_log'] = array();
\t$GLOBALS['wphx_308_04_option_log'] = array();
\t$GLOBALS['wphx_308_04_post_cache_log'] = array();
}
function wphx_308_04_term_counts() {
\t$result = array();
\tforeach ( $GLOBALS['wpdb']->data[ $GLOBALS['wpdb']->term_taxonomy ] as $row ) {
\t\t$result[ $row->taxonomy . ':' . $row->term_taxonomy_id ] = (int) $row->count;
\t}
\tksort( $result );
\treturn $result;
}
function wphx_308_04_cache_snapshot( $groups ) {
\t$result = array();
\tforeach ( $groups as $group ) {
\t\t$result[ $group ] = array_keys( $GLOBALS['wphx_308_04_cache'][ $group ] ?? array() );
\t\tsort( $result[ $group ] );
\t}
\tksort( $result );
\treturn $result;
}

register_taxonomy( 'fixture_topic', array( 'post' ), array( 'public' => true, 'hierarchical' => false, 'rewrite' => false ) );

$wpdb = $GLOBALS['wpdb'];
$wpdb->seed_term( 11, 1011, 'Alpha', 'alpha', 'fixture_topic' );
$wpdb->seed_term( 12, 1012, 'Beta', 'beta', 'fixture_topic' );
$wpdb->seed_relationship( 101, 1011 );
$wpdb->seed_relationship( 102, 1011 );
$wpdb->seed_relationship( 103, 1012 );

$observations = array();

wphx_308_04_reset_logs();
$immediate_result = wp_update_term_count( array( 1011, 1012 ), 'fixture_topic' );
$observations['term-count:immediate'] = array(
\t'result' => $immediate_result,
\t'counts' => wphx_308_04_term_counts(),
\t'hooks' => wphx_308_04_hook_counts(),
\t'cache_log' => $GLOBALS['wphx_308_04_cache_log'],
);

wphx_308_04_reset_logs();
$wpdb->data[ $wpdb->term_taxonomy ][1011]->count = 0;
$wpdb->seed_relationship( 103, 1011 );
wp_defer_term_counting( true );
$deferred_result = wp_update_term_count( 1011, 'fixture_topic' );
$counts_before_flush = wphx_308_04_term_counts();
$defer_state_before_flush = wp_defer_term_counting();
wp_defer_term_counting( false );
$observations['term-count:deferred'] = array(
\t'result' => $deferred_result,
\t'defer_state_before_flush' => $defer_state_before_flush,
\t'counts_before_flush' => $counts_before_flush,
\t'counts_after_flush' => wphx_308_04_term_counts(),
\t'hooks' => wphx_308_04_hook_counts(),
\t'cache_log' => $GLOBALS['wphx_308_04_cache_log'],
);

wphx_308_04_reset_logs();
wp_cache_set( 11, 'term-object', 'terms' );
wp_cache_set( 'all_ids', array( 11, 12 ), 'fixture_topic' );
wp_cache_set( 'get', array( 'cached' ), 'fixture_topic' );
wp_cache_set( 101, array( 11 ), 'fixture_topic_relationships' );
wp_cache_set( 103, array( 11, 12 ), 'fixture_topic_relationships' );
$cache_before = wphx_308_04_cache_snapshot( array( 'terms', 'fixture_topic', 'fixture_topic_relationships' ) );
clean_term_cache( array( 11 ), 'fixture_topic', true );
clean_object_term_cache( array( 101, 103 ), 'post' );
$observations['term-cache:clean-term-and-object'] = array(
\t'before' => $cache_before,
\t'after' => wphx_308_04_cache_snapshot( array( 'terms', 'fixture_topic', 'fixture_topic_relationships' ) ),
\t'cache_log' => $GLOBALS['wphx_308_04_cache_log'],
\t'option_log' => $GLOBALS['wphx_308_04_option_log'],
\t'hooks' => wphx_308_04_hook_counts(),
);

$wpdb->seed_comment( 301, 201, '1', 'comment' );
$wpdb->seed_comment( 302, 201, '1', 'trackback' );
$wpdb->seed_comment( 303, 201, '0', 'comment' );
$wpdb->seed_comment( 304, 201, '1', 'note' );
wphx_308_04_reset_logs();
$comment_immediate = wp_update_comment_count( 201 );
$count_after_immediate = (int) get_post( 201 )->comment_count;
wp_defer_comment_counting( true );
$wpdb->seed_comment( 305, 201, '1', 'comment' );
$comment_deferred = wp_update_comment_count( 201 );
$count_before_comment_flush = (int) get_post( 201 )->comment_count;
$comment_defer_state_before_flush = wp_defer_comment_counting();
wp_defer_comment_counting( false );
$observations['comment-count:immediate-and-deferred'] = array(
\t'immediate_result' => $comment_immediate,
\t'count_after_immediate' => $count_after_immediate,
\t'deferred_result' => $comment_deferred,
\t'defer_state_before_flush' => $comment_defer_state_before_flush,
\t'count_before_flush' => $count_before_comment_flush,
\t'count_after_flush' => (int) get_post( 201 )->comment_count,
\t'cache_log' => $GLOBALS['wphx_308_04_cache_log'],
\t'post_cache_log' => $GLOBALS['wphx_308_04_post_cache_log'],
\t'hooks' => wphx_308_04_hook_counts(),
);

wphx_308_04_reset_logs();
wp_cache_set( 301, 'comment-object', 'comment' );
wp_cache_set( 302, 'comment-object', 'comment' );
$comment_cache_before = wphx_308_04_cache_snapshot( array( 'comment' ) );
clean_comment_cache( array( 301, 302 ) );
$observations['comment-cache:clean'] = array(
\t'before' => $comment_cache_before,
\t'after' => wphx_308_04_cache_snapshot( array( 'comment' ) ),
\t'cache_log' => $GLOBALS['wphx_308_04_cache_log'],
\t'hooks' => wphx_308_04_hook_counts(),
);

$observations['errors'] = $GLOBALS['wphx_308_04_php_errors'];
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
      throw new Error(`${path} is stale; run npm run wp:core:wphx-308-taxonomy-comment-count-cache`);
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
    manifest_id: "ownership:wp-core/taxonomy-comment-count-cache-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "oracle_fixture",
      name: "taxonomy/comment count and cache invalidation oracle fixture",
      area: "wp-includes/taxonomy.php wp-includes/comment.php",
      public_contract:
        "This fixture records vanilla WordPress taxonomy/comment count and cache invalidation behavior that generated Haxe-owned adapters must satisfy. It does not claim Haxe-owned public PHP replacement."
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
        "Replace candidate mirror with generated original-path PHP once WPHX-308 public taxonomy/comment adapter contracts exist."
    },
    owned_paths: [OUT, OWNERSHIP, RECEIPT, "tools/wp-core/run-taxonomy-comment-count-cache-fixture.mjs"],
    generated_paths: [OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-308-taxonomy-comment-count-cache",
        "npm run wp:core:wphx-308-taxonomy-comment-count-cache:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-308-04-taxonomy-comment-count-cache-fixture"],
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
  schema: "wphx.wp-core-taxonomy-comment-count-cache-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-taxonomy-comment-count-cache-fixture.mjs",
  upstream: {
    repo: UPSTREAM_ROOT,
    commit: WP_REF,
    source_files: SOURCE_FILES.map(sourceRecord)
  },
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT),
    crud_fixture_manifest: inputRecord(CRUD)
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
      id: "generated-taxonomy-comment-adapter-not-installed",
      owner: "WPHX-308",
      detail:
        "Count/cache behavior is only proven between upstream mirrors. Generated public PHP and typed Adapter IR are not yet installed."
    },
    {
      id: "live-db-taxonomy-comment-parity-not-covered",
      owner: "WPHX-308",
      detail:
        "The fixture uses deterministic in-memory wpdb behavior. Live MySQL/MariaDB SQL/result parity and upstream PHPUnit ratcheting remain future gates."
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
  id: "receipt:wphx-308-04-taxonomy-comment-count-cache-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "taxonomy/comment count and cache invalidation oracle fixture manifest" },
    { path: OWNERSHIP, role: "ownership manifest for taxonomy/comment count/cache fixture" },
    { path: "tools/wp-core/run-taxonomy-comment-count-cache-fixture.mjs", role: "fixture generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-308-taxonomy-comment-count-cache",
    "npm run wp:core:wphx-308-taxonomy-comment-count-cache:check",
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
