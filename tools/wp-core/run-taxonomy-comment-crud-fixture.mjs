#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-6a2",
  external_ref: "WPHX-308.03",
  title: "Taxonomy/comment CRUD oracle fixture"
};
const OUT_ROOT = "build/wp-core/wphx-308-03";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-308-03-taxonomy-comment-crud-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-308-03-taxonomy-comment-crud-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-308-03-taxonomy-comment-crud-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-308-01-taxonomy-comments-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-308-02-taxonomy-comment-adapter-contract-candidate.v1.json";
const RECORDED_AT = "2026-06-23T19:45:00.000Z";
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
  "register_taxonomy",
  "wp_insert_term",
  "wp_update_term",
  "wp_delete_term",
  "wp_set_object_terms",
  "wp_remove_object_terms",
  "wp_insert_comment",
  "wp_update_comment",
  "wp_set_comment_status",
  "wp_trash_comment",
  "wp_delete_comment"
];

const FIXTURE_CASES = [
  { id: "taxonomy:register", symbol: "register_taxonomy", focus: "visibility, hierarchy, REST exposure, object-type binding, and registration hooks" },
  { id: "term:insert-update-duplicate-delete", symbol: "wp_insert_term/wp_update_term/wp_delete_term", focus: "term creation, slug/name update, duplicate rejection, default-term delete blocking, and term hooks" },
  { id: "term:relationships", symbol: "wp_set_object_terms/wp_remove_object_terms", focus: "object-term assignment, append/replace/remove behavior, count updates, relationship cache invalidation, and relationship hooks" },
  { id: "comment:insert-update-status", symbol: "wp_insert_comment/wp_update_comment/wp_set_comment_status", focus: "comment insertion, content update, approval transitions, comment count updates, and status hooks" },
  { id: "comment:trash-delete", symbol: "wp_trash_comment/wp_delete_comment", focus: "trash metadata, forced delete, delete hooks, cache invalidation, and transition hooks" }
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
define( 'EMPTY_TRASH_DAYS', 30 );
define( 'OBJECT', 'OBJECT' );
define( 'ARRAY_A', 'ARRAY_A' );
define( 'ARRAY_N', 'ARRAY_N' );

$GLOBALS['wp_taxonomies'] = array();
$GLOBALS['wp_filter'] = array();
$GLOBALS['wphx_308_03_actions'] = array();
$GLOBALS['wphx_308_03_cache'] = array();
$GLOBALS['wphx_308_03_php_errors'] = array();
$GLOBALS['wphx_308_03_meta'] = array( 'comment' => array() );
$GLOBALS['_wp_suspend_cache_invalidation'] = false;

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_308_03_php_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

class WPHX_308_03_WPDB {
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
\tprivate $next = array(
\t\t'wp_terms' => 1,
\t\t'wp_term_taxonomy' => 1,
\t\t'wp_comments' => 1,
\t\t'wp_commentmeta' => 1,
\t\t'wp_posts' => 1,
\t);

\tpublic function seed_post( $id ) {
\t\t$this->data[ $this->posts ][ (int) $id ] = (object) array( 'ID' => (int) $id, 'post_type' => 'post', 'comment_count' => 0 );
\t\t$this->next[ $this->posts ] = max( $this->next[ $this->posts ], (int) $id + 1 );
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

\tpublic function insert( $table, $data ) {
\t\t$table = $this->normalize_table( $table );
\t\t$row = (object) $data;
\t\tif ( $table === $this->terms ) {
\t\t\t$row->term_id = $this->next[ $table ]++;
\t\t\t$row->term_group = isset( $row->term_group ) ? (int) $row->term_group : 0;
\t\t\t$this->insert_id = $row->term_id;
\t\t\t$this->data[ $table ][ $row->term_id ] = $row;
\t\t\treturn true;
\t\t}
\t\tif ( $table === $this->term_taxonomy ) {
\t\t\t$row->term_taxonomy_id = $this->next[ $table ]++;
\t\t\t$row->term_id = (int) $row->term_id;
\t\t\t$row->parent = isset( $row->parent ) ? (int) $row->parent : 0;
\t\t\t$row->count = isset( $row->count ) ? (int) $row->count : 0;
\t\t\t$this->insert_id = $row->term_taxonomy_id;
\t\t\t$this->data[ $table ][ $row->term_taxonomy_id ] = $row;
\t\t\treturn true;
\t\t}
\t\tif ( $table === $this->term_relationships ) {
\t\t\t$key = (int) $row->object_id . ':' . (int) $row->term_taxonomy_id;
\t\t\t$row->object_id = (int) $row->object_id;
\t\t\t$row->term_taxonomy_id = (int) $row->term_taxonomy_id;
\t\t\t$row->term_order = isset( $row->term_order ) ? (int) $row->term_order : 0;
\t\t\t$this->insert_id = count( $this->data[ $table ] ) + 1;
\t\t\t$this->data[ $table ][ $key ] = $row;
\t\t\treturn true;
\t\t}
\t\tif ( $table === $this->comments ) {
\t\t\t$row->comment_ID = $this->next[ $table ]++;
\t\t\t$this->insert_id = $row->comment_ID;
\t\t\t$this->data[ $table ][ $row->comment_ID ] = $row;
\t\t\treturn true;
\t\t}
\t\tif ( $table === $this->commentmeta ) {
\t\t\t$row->meta_id = $this->next[ $table ]++;
\t\t\t$this->insert_id = $row->meta_id;
\t\t\t$this->data[ $table ][ $row->meta_id ] = $row;
\t\t\treturn true;
\t\t}
\t\treturn false;
\t}

\tpublic function update( $table, $data, $where ) {
\t\t$table = $this->normalize_table( $table );
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

\tpublic function delete( $table, $where ) {
\t\t$table = $this->normalize_table( $table );
\t\t$count = 0;
\t\tforeach ( array_keys( $this->data[ $table ] ) as $key ) {
\t\t\tif ( $this->matches( $this->data[ $table ][ $key ], $where ) ) {
\t\t\t\tunset( $this->data[ $table ][ $key ] );
\t\t\t\t++$count;
\t\t\t}
\t\t}
\t\treturn $count;
\t}

\tpublic function query( $query ) {
\t\t$this->queries[] = $query;
\t\tif ( preg_match( '/DELETE FROM ' . preg_quote( $this->term_relationships, '/' ) . ' WHERE object_id = (\\\\d+) AND term_taxonomy_id IN \\\\(([^)]+)\\\\)/', $query, $m ) ) {
\t\t\t$object_id = (int) $m[1];
\t\t\t$ids = array_map( 'intval', preg_split( '/\\\\s*,\\\\s*/', str_replace( "'", '', $m[2] ) ) );
\t\t\t$count = 0;
\t\t\tforeach ( array_keys( $this->data[ $this->term_relationships ] ) as $key ) {
\t\t\t\t$row = $this->data[ $this->term_relationships ][ $key ];
\t\t\t\tif ( $row->object_id === $object_id && in_array( (int) $row->term_taxonomy_id, $ids, true ) ) {
\t\t\t\t\tunset( $this->data[ $this->term_relationships ][ $key ] );
\t\t\t\t\t++$count;
\t\t\t\t}
\t\t\t}
\t\t\treturn $count;
\t\t}
\t\treturn true;
\t}

\tpublic function get_var( $query ) {
\t\t$this->queries[] = $query;
\t\tif ( preg_match( '/SELECT MAX\\\\(term_group\\\\) FROM ' . preg_quote( $this->terms, '/' ) . '/', $query ) ) {
\t\t\t$max = 0;
\t\t\tforeach ( $this->data[ $this->terms ] as $row ) {
\t\t\t\t$max = max( $max, (int) $row->term_group );
\t\t\t}
\t\t\treturn $max;
\t\t}
\t\tif ( preg_match( '/SELECT tt\\\\.term_taxonomy_id FROM ' . preg_quote( $this->term_taxonomy, '/' ) . ' AS tt INNER JOIN ' . preg_quote( $this->terms, '/' ) . " AS t ON tt\\\\.term_id = t\\\\.term_id WHERE tt\\\\.taxonomy = '([^']+)' AND t\\\\.term_id = (\\\\d+)/", $query, $m ) ) {
\t\t\tforeach ( $this->data[ $this->term_taxonomy ] as $row ) {
\t\t\t\tif ( $row->taxonomy === $m[1] && (int) $row->term_id === (int) $m[2] ) {
\t\t\t\t\treturn $row->term_taxonomy_id;
\t\t\t\t}
\t\t\t}
\t\t\treturn null;
\t\t}
\t\tif ( preg_match( '/SELECT term_taxonomy_id FROM ' . preg_quote( $this->term_relationships, '/' ) . ' WHERE object_id = (\\\\d+) AND term_taxonomy_id = (\\\\d+)/', $query, $m ) ) {
\t\t\t$key = (int) $m[1] . ':' . (int) $m[2];
\t\t\treturn isset( $this->data[ $this->term_relationships ][ $key ] ) ? (int) $m[2] : null;
\t\t}
\t\tif ( preg_match( "/SELECT slug FROM " . preg_quote( $this->terms, '/' ) . " WHERE slug = '([^']+)'(?: AND term_id != (\\\\d+))?/", $query, $m ) ) {
\t\t\tforeach ( $this->data[ $this->terms ] as $row ) {
\t\t\t\tif ( $row->slug === $m[1] && ( ! isset( $m[2] ) || (int) $row->term_id !== (int) $m[2] ) ) {
\t\t\t\t\treturn $row->slug;
\t\t\t\t}
\t\t\t}
\t\t\treturn null;
\t\t}
\t\tif ( preg_match( '/SELECT COUNT\\\\(\\\\*\\\\) FROM ' . preg_quote( $this->comments, '/' ) . " WHERE comment_post_ID = (\\\\d+) AND comment_approved = '1'/", $query, $m ) ) {
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

\tpublic function get_row( $query ) {
\t\t$this->queries[] = $query;
\t\tif ( preg_match( '/SELECT t\\\\.term_id, t\\\\.slug, tt\\\\.term_taxonomy_id, tt\\\\.taxonomy FROM ' . preg_quote( $this->terms, '/' ) . " AS t INNER JOIN " . preg_quote( $this->term_taxonomy, '/' ) . " AS tt .* WHERE t\\\\.slug = '([^']+)' AND tt\\\\.parent = (\\\\d+) AND tt\\\\.taxonomy = '([^']+)' AND t\\\\.term_id < (\\\\d+) AND tt\\\\.term_taxonomy_id != (\\\\d+)/", $query, $m ) ) {
\t\t\tforeach ( $this->joined_terms() as $row ) {
\t\t\t\tif ( $row->slug === $m[1] && (int) $row->parent === (int) $m[2] && $row->taxonomy === $m[3] && (int) $row->term_id < (int) $m[4] && (int) $row->term_taxonomy_id !== (int) $m[5] ) {
\t\t\t\t\treturn (object) array(
\t\t\t\t\t\t'term_id' => $row->term_id,
\t\t\t\t\t\t'slug' => $row->slug,
\t\t\t\t\t\t'term_taxonomy_id' => $row->term_taxonomy_id,
\t\t\t\t\t\t'taxonomy' => $row->taxonomy,
\t\t\t\t\t);
\t\t\t\t}
\t\t\t}
\t\t\treturn null;
\t\t}
\t\tif ( preg_match( '/SELECT \\\\* FROM ' . preg_quote( $this->comments, '/' ) . ' WHERE comment_ID = (\\\\d+) LIMIT 1/', $query, $m ) ) {
\t\t\treturn $this->data[ $this->comments ][ (int) $m[1] ] ?? null;
\t\t}
\t\treturn null;
\t}

\tpublic function get_col( $query ) {
\t\t$this->queries[] = $query;
\t\tif ( preg_match( '/SELECT object_id FROM ' . preg_quote( $this->term_relationships, '/' ) . ' WHERE term_taxonomy_id = (\\\\d+)/', $query, $m ) ) {
\t\t\t$result = array();
\t\t\tforeach ( $this->data[ $this->term_relationships ] as $row ) {
\t\t\t\tif ( (int) $row->term_taxonomy_id === (int) $m[1] ) {
\t\t\t\t\t$result[] = $row->object_id;
\t\t\t\t}
\t\t\t}
\t\t\treturn $result;
\t\t}
\t\tif ( preg_match( '/SELECT tt\\\\.term_id FROM ' . preg_quote( $this->term_taxonomy, '/' ) . " AS tt WHERE tt\\\\.taxonomy = '([^']+)' AND tt\\\\.term_taxonomy_id IN \\\\(([^)]+)\\\\)/", $query, $m ) ) {
\t\t\t$ids = array_map( 'intval', preg_split( '/\\\\s*,\\\\s*/', str_replace( "'", '', $m[2] ) ) );
\t\t\t$result = array();
\t\t\tforeach ( $this->data[ $this->term_taxonomy ] as $row ) {
\t\t\t\tif ( $row->taxonomy === $m[1] && in_array( (int) $row->term_taxonomy_id, $ids, true ) ) {
\t\t\t\t\t$result[] = $row->term_id;
\t\t\t\t}
\t\t\t}
\t\t\treturn $result;
\t\t}
\t\tif ( preg_match( '/SELECT comment_ID FROM ' . preg_quote( $this->comments, '/' ) . ' WHERE comment_parent = (\\\\d+)/', $query, $m ) ) {
\t\t\t$result = array();
\t\t\tforeach ( $this->data[ $this->comments ] as $row ) {
\t\t\t\tif ( (int) $row->comment_parent === (int) $m[1] ) {
\t\t\t\t\t$result[] = $row->comment_ID;
\t\t\t\t}
\t\t\t}
\t\t\treturn $result;
\t\t}
\t\tif ( preg_match( '/SELECT meta_id FROM ' . preg_quote( $this->commentmeta, '/' ) . ' WHERE comment_id = (\\\\d+)/', $query, $m ) ) {
\t\t\t$result = array();
\t\t\tforeach ( $this->data[ $this->commentmeta ] as $row ) {
\t\t\t\tif ( (int) $row->comment_id === (int) $m[1] ) {
\t\t\t\t\t$result[] = $row->meta_id;
\t\t\t\t}
\t\t\t}
\t\t\treturn $result;
\t\t}
\t\treturn array();
\t}

\tpublic function get_results( $query ) {
\t\t$this->queries[] = $query;
\t\tif ( preg_match( '/FROM ' . preg_quote( $this->terms, '/' ) . ' AS t INNER JOIN ' . preg_quote( $this->term_taxonomy, '/' ) . ' AS tt ON t\\\\.term_id = tt\\\\.term_id WHERE t\\\\.term_id = (\\\\d+)/', $query, $m ) ) {
\t\t\treturn array_values( array_filter( $this->joined_terms(), fn( $row ) => (int) $row->term_id === (int) $m[1] ) );
\t\t}
\t\treturn array();
\t}

\tpublic function strip_invalid_text_for_column( $table, $column, $value ) {
\t\treturn $value;
\t}

\tpublic function joined_terms() {
\t\t$result = array();
\t\tforeach ( $this->data[ $this->term_taxonomy ] as $tt ) {
\t\t\tif ( ! isset( $this->data[ $this->terms ][ $tt->term_id ] ) ) {
\t\t\t\tcontinue;
\t\t\t}
\t\t\t$term = $this->data[ $this->terms ][ $tt->term_id ];
\t\t\t$result[] = (object) array_merge( get_object_vars( $term ), get_object_vars( $tt ) );
\t\t}
\t\treturn $result;
\t}

\tprivate function normalize_table( $table ) {
\t\treturn (string) $table;
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

$GLOBALS['wpdb'] = new WPHX_308_03_WPDB();
$GLOBALS['wpdb']->seed_post( 101 );

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
\t$GLOBALS['wphx_308_03_actions'][] = array( 'hook' => $hook_name, 'args' => wphx_308_03_normalize( $args ) );
\tapply_filters( $hook_name, null, ...$args );
}

function __( $text ) { return $text; }
function _x( $text ) { return $text; }
function _n( $single, $plural, $number ) { return 1 === (int) $number ? $single : $plural; }
function _deprecated_function( $function_name, $version, $replacement = '' ) { $GLOBALS['wphx_308_03_php_errors'][] = array( 'deprecated_function' => $function_name, 'version' => $version, 'replacement' => $replacement ); }
function _doing_it_wrong( $function_name, $message, $version ) { $GLOBALS['wphx_308_03_php_errors'][] = array( 'doing_it_wrong' => $function_name, 'message' => $message, 'version' => $version ); }
function wp_parse_args( $args, $defaults = array() ) {
\tif ( is_object( $args ) ) {
\t\t$args = get_object_vars( $args );
\t} elseif ( is_string( $args ) ) {
\t\tparse_str( $args, $args );
\t}
\treturn array_merge( $defaults, (array) $args );
}
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
function sanitize_html_class( $class, $fallback = '' ) { return sanitize_key( $class ) ?: $fallback; }
function sanitize_user( $username ) { return sanitize_key( $username ); }
function sanitize_email( $email ) { return strtolower( trim( (string) $email ) ); }
function sanitize_url( $url ) { return (string) $url; }
function esc_url_raw( $url ) { return (string) $url; }
function esc_attr( $text ) { return (string) $text; }
function esc_html( $text ) { return (string) $text; }
function esc_sql( $data ) { return is_array( $data ) ? array_map( 'esc_sql', $data ) : str_replace( "'", "''", (string) $data ); }
function wp_kses_normalize_entities( $text ) { return (string) $text; }
function wp_check_invalid_utf8( $text ) { return (string) $text; }
function wp_specialchars_decode( $text ) { return html_entity_decode( (string) $text, ENT_QUOTES ); }
function convert_chars( $text ) { return (string) $text; }
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
function wp_array_slice_assoc( $array, $keys ) {
\t$result = array();
\tforeach ( $keys as $key ) {
\t\tif ( array_key_exists( $key, $array ) ) {
\t\t\t$result[ $key ] = $array[ $key ];
\t\t}
\t}
\treturn $result;
}
function current_time( $type, $gmt = false ) { return '2026-06-23 19:45:00'; }
function get_gmt_from_date( $date ) { return $date; }
function get_option( $name, $default = false ) { return 'db_version' === $name ? 70000 : $default; }
function update_option( $name, $value, $autoload = null ) { return true; }
function delete_option( $name ) { return true; }
function is_admin() { return false; }
function post_type_exists( $post_type ) { return 'post' === $post_type; }
function _get_custom_object_labels( $data_object, $nohier_vs_hier_defaults ) {
\t$data_object->labels = (array) $data_object->labels;
\tif ( isset( $data_object->label ) && empty( $data_object->labels['name'] ) ) {
\t\t$data_object->labels['name'] = $data_object->label;
\t}
\tif ( ! isset( $data_object->labels['singular_name'] ) && isset( $data_object->labels['name'] ) ) {
\t\t$data_object->labels['singular_name'] = $data_object->labels['name'];
\t}
\t$defaults = array();
\tforeach ( $nohier_vs_hier_defaults as $key => $value ) {
\t\t$defaults[ $key ] = $data_object->hierarchical ? $value[1] : $value[0];
\t}
\t$labels = array_merge( $defaults, $data_object->labels );
\t$data_object->labels = (object) $data_object->labels;
\treturn (object) $labels;
}
function get_post( $post_id ) { return $GLOBALS['wpdb']->data[ $GLOBALS['wpdb']->posts ][ (int) $post_id ] ?? false; }
function clean_post_cache( $post ) {}
function user_can( $user_id, $capability ) { return false; }
function wp_filter_kses( $data ) { return $data; }
function wp_cache_get( $key, $group = '' ) { return $GLOBALS['wphx_308_03_cache'][ $group ][ $key ] ?? false; }
function wp_cache_add( $key, $data, $group = '', $expire = 0 ) { if ( isset( $GLOBALS['wphx_308_03_cache'][ $group ][ $key ] ) ) return false; $GLOBALS['wphx_308_03_cache'][ $group ][ $key ] = $data; return true; }
function wp_cache_set( $key, $data, $group = '', $expire = 0 ) { $GLOBALS['wphx_308_03_cache'][ $group ][ $key ] = $data; return true; }
function wp_cache_delete( $key, $group = '' ) { unset( $GLOBALS['wphx_308_03_cache'][ $group ][ $key ] ); return true; }
function wp_cache_delete_multiple( $keys, $group = '' ) { foreach ( (array) $keys as $key ) wp_cache_delete( $key, $group ); return true; }
function wp_cache_set_last_changed( $group ) { $GLOBALS['wphx_308_03_cache'][ $group ]['last_changed'] = 'fixture'; return 'fixture'; }
function wp_cache_get_last_changed( $group ) { return $GLOBALS['wphx_308_03_cache'][ $group ]['last_changed'] ?? 'fixture'; }
function update_metadata_cache( $meta_type, $object_ids ) { return array(); }
function add_metadata( $meta_type, $object_id, $meta_key, $meta_value, $unique = false ) {
\tif ( $unique && isset( $GLOBALS['wphx_308_03_meta'][ $meta_type ][ (int) $object_id ][ $meta_key ] ) ) return false;
\t$GLOBALS['wphx_308_03_meta'][ $meta_type ][ (int) $object_id ][ $meta_key ] = $meta_value;
\tif ( 'comment' === $meta_type ) {
\t\t$GLOBALS['wpdb']->insert( $GLOBALS['wpdb']->commentmeta, array( 'comment_id' => (int) $object_id, 'meta_key' => $meta_key, 'meta_value' => $meta_value ) );
\t}
\treturn true;
}
function update_metadata( $meta_type, $object_id, $meta_key, $meta_value, $prev_value = '' ) { $GLOBALS['wphx_308_03_meta'][ $meta_type ][ (int) $object_id ][ $meta_key ] = $meta_value; return true; }
function delete_metadata( $meta_type, $object_id, $meta_key, $meta_value = '', $delete_all = false ) { unset( $GLOBALS['wphx_308_03_meta'][ $meta_type ][ (int) $object_id ][ $meta_key ] ); return true; }
function delete_metadata_by_mid( $meta_type, $meta_id ) { unset( $GLOBALS['wpdb']->data[ $GLOBALS['wpdb']->commentmeta ][ (int) $meta_id ] ); return true; }

class WP_Term_Query {
\tpublic $query_vars = array();
\tpublic $query_var_defaults = array(
\t\t'taxonomy' => null,
\t\t'object_ids' => null,
\t\t'include' => array(),
\t\t'slug' => '',
\t\t'name' => '',
\t\t'parent' => '',
\t\t'fields' => 'all',
\t\t'hide_empty' => true,
\t\t'orderby' => 'name',
\t\t'update_term_meta_cache' => true,
\t\t'term_taxonomy_id' => '',
\t);
\tpublic function query( $args ) {
\t\t$args = wp_parse_args( $args, array( 'taxonomy' => '', 'fields' => 'all', 'hide_empty' => true, 'parent' => '', 'name' => '', 'slug' => '', 'include' => array(), 'object_ids' => array() ) );
\t\t$this->query_vars = $args;
\t\t$rows = $GLOBALS['wpdb']->joined_terms();
\t\t$taxonomies = array_filter( (array) $args['taxonomy'] );
\t\tif ( $taxonomies ) $rows = array_values( array_filter( $rows, fn( $row ) => in_array( $row->taxonomy, $taxonomies, true ) ) );
\t\tif ( '' !== $args['name'] ) $rows = array_values( array_filter( $rows, fn( $row ) => strtolower( $row->name ) === strtolower( $args['name'] ) ) );
\t\tif ( '' !== $args['slug'] ) $rows = array_values( array_filter( $rows, fn( $row ) => $row->slug === $args['slug'] ) );
\t\tif ( '' !== $args['parent'] ) $rows = array_values( array_filter( $rows, fn( $row ) => (int) $row->parent === (int) $args['parent'] ) );
\t\tif ( ! empty( $args['include'] ) ) {
\t\t\t$include = array_map( 'intval', (array) $args['include'] );
\t\t\t$rows = array_values( array_filter( $rows, fn( $row ) => in_array( (int) $row->term_id, $include, true ) ) );
\t\t}
\t\tif ( ! empty( $args['object_ids'] ) ) {
\t\t\t$object_ids = array_map( 'intval', (array) $args['object_ids'] );
\t\t\t$tt_ids = array();
\t\t\tforeach ( $GLOBALS['wpdb']->data[ $GLOBALS['wpdb']->term_relationships ] as $rel ) {
\t\t\t\tif ( in_array( (int) $rel->object_id, $object_ids, true ) ) $tt_ids[] = (int) $rel->term_taxonomy_id;
\t\t\t}
\t\t\t$rows = array_values( array_filter( $rows, fn( $row ) => in_array( (int) $row->term_taxonomy_id, $tt_ids, true ) ) );
\t\t}
\t\tif ( 'ids' === $args['fields'] ) return array_map( fn( $row ) => (int) $row->term_id, $rows );
\t\tif ( 'tt_ids' === $args['fields'] ) return array_map( fn( $row ) => (int) $row->term_taxonomy_id, $rows );
\t\tif ( 'id=>parent' === $args['fields'] ) {
\t\t\t$result = array();
\t\t\tforeach ( $rows as $row ) $result[ (int) $row->term_id ] = (int) $row->parent;
\t\t\treturn $result;
\t\t}
\t\treturn array_map( fn( $row ) => new WP_Term( $row ), $rows );
\t}
}
class WP_Comment_Query {
\tpublic function query( $args ) { return array(); }
}

require $root . '/wp-includes/class-wp-error.php';
require $root . '/wp-includes/class-wp-taxonomy.php';
require $root . '/wp-includes/class-wp-term.php';
require $root . '/wp-includes/class-wp-comment.php';
require $root . '/wp-includes/taxonomy.php';
require $root . '/wp-includes/comment.php';

function is_wp_error( $thing ) { return $thing instanceof WP_Error; }

function wphx_308_03_normalize( $value ) {
\tif ( $value instanceof WP_Error ) {
\t\treturn array( 'wp_error' => $value->get_error_code(), 'data' => $value->get_error_data() );
\t}
\tif ( $value instanceof WP_Term ) {
\t\treturn array( 'term_id' => (int) $value->term_id, 'slug' => $value->slug, 'taxonomy' => $value->taxonomy, 'tt_id' => (int) $value->term_taxonomy_id, 'parent' => (int) $value->parent, 'count' => (int) $value->count );
\t}
\tif ( $value instanceof WP_Comment ) {
\t\treturn array( 'comment_ID' => (int) $value->comment_ID, 'approved' => (string) $value->comment_approved, 'content' => (string) $value->comment_content, 'post_ID' => (int) $value->comment_post_ID );
\t}
\tif ( is_array( $value ) ) return array_map( 'wphx_308_03_normalize', $value );
\tif ( is_object( $value ) ) return wphx_308_03_normalize( get_object_vars( $value ) );
\treturn $value;
}
function wphx_308_03_hook_counts() {
\t$counts = array();
\tforeach ( $GLOBALS['wphx_308_03_actions'] as $event ) {
\t\t$counts[ $event['hook'] ] = ( $counts[ $event['hook'] ] ?? 0 ) + 1;
\t}
\tksort( $counts );
\treturn $counts;
}
function wphx_308_03_reset_actions() { $GLOBALS['wphx_308_03_actions'] = array(); }
function wphx_308_03_result( $value ) {
\treturn is_wp_error( $value ) ? array( 'error' => $value->get_error_code(), 'data' => wphx_308_03_normalize( $value->get_error_data() ) ) : wphx_308_03_normalize( $value );
}

$observations = array();

$registered = register_taxonomy(
\t'fixture_topic',
\tarray( 'post' ),
\tarray(
\t\t'public' => true,
\t\t'hierarchical' => true,
\t\t'show_in_rest' => true,
\t\t'rewrite' => false,
\t\t'query_var' => 'topic',
\t)
);
$taxonomy = get_taxonomy( 'fixture_topic' );
$observations['taxonomy:register'] = array(
\t'result' => wphx_308_03_result( $registered ),
\t'public' => $taxonomy->public,
\t'hierarchical' => $taxonomy->hierarchical,
\t'show_in_rest' => $taxonomy->show_in_rest,
\t'object_type' => $taxonomy->object_type,
);

wphx_308_03_reset_actions();
$alpha = wp_insert_term( 'Alpha Term', 'fixture_topic', array( 'description' => 'first' ) );
$beta = wp_insert_term( 'Beta Term', 'fixture_topic', array( 'parent' => (int) $alpha['term_id'], 'slug' => 'beta-term' ) );
$duplicate = wp_insert_term( 'Alpha Term', 'fixture_topic' );
$updated = wp_update_term( (int) $beta['term_id'], 'fixture_topic', array( 'name' => 'Beta Updated', 'slug' => 'beta-updated' ) );
$invalid_update = wp_update_term( 999, 'fixture_topic', array( 'name' => 'Missing' ) );
$observations['term:crud'] = array(
\t'alpha' => wphx_308_03_result( $alpha ),
\t'beta' => wphx_308_03_result( $beta ),
\t'duplicate' => wphx_308_03_result( $duplicate ),
\t'updated' => wphx_308_03_result( $updated ),
\t'invalid_update' => wphx_308_03_result( $invalid_update ),
\t'beta_after' => wphx_308_03_result( get_term( (int) $beta['term_id'], 'fixture_topic' ) ),
\t'hooks' => wphx_308_03_hook_counts(),
);

wphx_308_03_reset_actions();
$set_one = wp_set_object_terms( 101, array( (int) $alpha['term_id'], 'Gamma Term' ), 'fixture_topic' );
$set_replace = wp_set_object_terms( 101, array( (int) $beta['term_id'] ), 'fixture_topic', false );
$set_append = wp_add_object_terms( 101, 'Delta Term', 'fixture_topic' );
$remove_beta = wp_remove_object_terms( 101, array( (int) $beta['term_id'] ), 'fixture_topic' );
$relationships = array_values( array_map( fn( $row ) => array( 'object_id' => (int) $row->object_id, 'tt_id' => (int) $row->term_taxonomy_id ), $GLOBALS['wpdb']->data[ $GLOBALS['wpdb']->term_relationships ] ) );
$term_counts = array();
foreach ( $GLOBALS['wpdb']->joined_terms() as $row ) {
\t$term_counts[ $row->slug ] = (int) $row->count;
}
ksort( $term_counts );
$observations['term:relationships'] = array(
\t'set_one' => wphx_308_03_result( $set_one ),
\t'set_replace' => wphx_308_03_result( $set_replace ),
\t'set_append' => wphx_308_03_result( $set_append ),
\t'remove_beta' => wphx_308_03_result( $remove_beta ),
\t'relationships' => $relationships,
\t'counts' => $term_counts,
\t'hooks' => wphx_308_03_hook_counts(),
);

wphx_308_03_reset_actions();
$deleted_alpha = wp_delete_term( (int) $alpha['term_id'], 'fixture_topic' );
$delete_missing = wp_delete_term( 999, 'fixture_topic' );
$observations['term:delete'] = array(
\t'deleted_alpha' => wphx_308_03_result( $deleted_alpha ),
\t'delete_missing' => wphx_308_03_result( $delete_missing ),
\t'remaining_slugs' => array_values( array_map( fn( $row ) => $row->slug, $GLOBALS['wpdb']->joined_terms() ) ),
\t'hooks' => wphx_308_03_hook_counts(),
);

wphx_308_03_reset_actions();
$comment_id = wp_insert_comment(
\tarray(
\t\t'comment_post_ID' => 101,
\t\t'comment_author' => 'Fixture Author',
\t\t'comment_author_email' => 'author@example.test',
\t\t'comment_content' => 'Initial comment',
\t\t'comment_approved' => '0',
\t\t'comment_date' => '2026-06-23 19:45:00',
\t\t'comment_date_gmt' => '2026-06-23 19:45:00',
\t\t'comment_meta' => array( 'source' => 'fixture' ),
\t)
);
$update_comment = wp_update_comment( array( 'comment_ID' => $comment_id, 'comment_content' => 'Updated comment' ), true );
$approve = wp_set_comment_status( $comment_id, 'approve', true );
$comment_after = get_comment( $comment_id );
$observations['comment:insert-update-status'] = array(
\t'comment_id' => $comment_id,
\t'update' => wphx_308_03_result( $update_comment ),
\t'approve' => wphx_308_03_result( $approve ),
\t'comment_after' => wphx_308_03_result( $comment_after ),
\t'post_comment_count' => (int) get_post( 101 )->comment_count,
\t'meta' => $GLOBALS['wphx_308_03_meta']['comment'][ $comment_id ] ?? array(),
\t'hooks' => wphx_308_03_hook_counts(),
);

wphx_308_03_reset_actions();
$trash = wp_trash_comment( $comment_id );
$trashed = get_comment( $comment_id );
$delete = wp_delete_comment( $comment_id, true );
$observations['comment:trash-delete'] = array(
\t'trash' => wphx_308_03_result( $trash ),
\t'trashed' => wphx_308_03_result( $trashed ),
\t'delete' => wphx_308_03_result( $delete ),
\t'exists_after_delete' => null !== get_comment( $comment_id ),
\t'post_comment_count' => (int) get_post( 101 )->comment_count,
\t'hooks' => wphx_308_03_hook_counts(),
);

$observations['errors'] = $GLOBALS['wphx_308_03_php_errors'];
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
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-308-taxonomy-comment-crud`);
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
    manifest_id: "ownership:wp-core/taxonomy-comment-crud-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "oracle_fixture",
      name: "taxonomy, term, object-term relationship, and comment CRUD oracle fixture",
      area: "wp-includes/taxonomy.php wp-includes/comment.php",
      public_contract:
        "This fixture records vanilla WordPress taxonomy/comment CRUD behavior that generated Haxe-owned adapters must satisfy. It does not claim Haxe-owned public PHP replacement."
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
    owned_paths: ["tools/wp-core/run-taxonomy-comment-crud-fixture.mjs", OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-308-taxonomy-comment-crud",
        "npm run wp:core:wphx-308-taxonomy-comment-crud:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-308-03-taxonomy-comment-crud-fixture"],
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
  schema: "wphx.wp-core-taxonomy-comment-crud-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-taxonomy-comment-crud-fixture.mjs",
  upstream: {
    repo: UPSTREAM_ROOT,
    commit: WP_REF,
    source_files: SOURCE_FILES.map(sourceRecord)
  },
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT)
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
        "Taxonomy/comment CRUD behavior is only proven between upstream mirrors. Generated public PHP and typed Adapter IR are not yet installed."
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
  id: "receipt:wphx-308-03-taxonomy-comment-crud-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "taxonomy/comment CRUD oracle fixture manifest" },
    { path: OWNERSHIP, role: "ownership manifest for taxonomy/comment CRUD fixture" },
    { path: "tools/wp-core/run-taxonomy-comment-crud-fixture.mjs", role: "fixture generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-308-taxonomy-comment-crud",
    "npm run wp:core:wphx-308-taxonomy-comment-crud:check",
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
