#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.11.2",
  external_ref: "WPHX-317.03",
  title: "Build site/blog switching and cache-group differential fixtures"
};
const OUT_ROOT = "build/wp-core/wphx-317-03";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-317-03-multisite-blog-switch-cache-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-317-03-multisite-blog-switch-cache-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-317-03-multisite-blog-switch-cache-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-317-01-multisite-network-surface.v1.json";
const OBJECT_CACHE_FIXTURE = "manifests/wp-core/wphx-304-04-object-cache-fixture.v1.json";
const OPTION_STORAGE_FIXTURE = "manifests/wp-core/wphx-304-02-option-storage-fixture.v1.json";
const RECORDED_AT = "2026-06-22T21:52:03.000Z";
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
  "src/wp-includes/option.php",
  "src/wp-includes/class-wp-network.php",
  "src/wp-includes/ms-network.php",
  "src/wp-includes/class-wp-site.php",
  "src/wp-includes/class-wp-site-query.php",
  "src/wp-includes/ms-site.php",
  "src/wp-includes/ms-blogs.php"
];

const COVERED_SYMBOLS = [
  "switch_to_blog",
  "restore_current_blog",
  "ms_is_switched",
  "wp_cache_switch_to_blog_fallback",
  "get_blog_option",
  "add_blog_option",
  "delete_blog_option",
  "update_blog_option",
  "wp_cache_add_global_groups",
  "wp_cache_switch_to_blog",
  "WP_Object_Cache::switch_to_blog"
];

const FIXTURE_CASES = [
  { id: "switch:nested-stack-and-events", symbol: "switch_to_blog/restore_current_blog/ms_is_switched", focus: "nested switch stack, global blog ID, table prefix, switched flag, and switch_blog action order" },
  { id: "switch:same-blog-stack", symbol: "switch_to_blog/restore_current_blog", focus: "same-blog switch still pushes stack, fires actions, and restores switched state" },
  { id: "cache:global-local-groups-through-switch", symbol: "wp_cache_add_global_groups/wp_cache_switch_to_blog", focus: "local group keys are blog-prefixed while global groups remain shared through switch_to_blog()" },
  { id: "blog-option:cross-blog-wrappers", symbol: "get_blog_option/add_blog_option/update_blog_option/delete_blog_option", focus: "blog option wrappers switch to target blog, use target option table/cache, restore current blog, and run blog_option filter" },
  { id: "cache:fallback-reinitializes-groups", symbol: "wp_cache_switch_to_blog_fallback", focus: "fallback cache switch reinitializes object cache and preserves/restores global and non-persistent groups" }
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
define( 'WP_DEBUG', false );
define( 'MULTISITE', true );
define( 'DOMAIN_CURRENT_SITE', 'network.example.test' );
define( 'PATH_CURRENT_SITE', '/' );
define( 'SITE_ID_CURRENT_SITE', 7 );
define( 'BLOG_ID_CURRENT_SITE', 1 );

class WPHX_317_03_Fake_WPDB {
\tpublic $base_prefix = 'wp_';
\tpublic $prefix = 'wp_';
\tpublic $options = 'wp_options';
\tpublic $site = 'wp_site';
\tpublic $blogs = 'wp_blogs';
\tpublic $blogid = 1;
\tpublic $last_error = '';
\tpublic $queries = array();
\tprivate $rows = array();

\tpublic function __construct() {
\t\t$this->reset();
\t}

\tpublic function reset() {
\t\t$this->queries = array();
\t\t$this->rows = array(
\t\t\t1 => array(
\t\t\t\t'siteurl' => array( 'option_value' => 'https://one.example.test/', 'autoload' => 'on' ),
\t\t\t\t'home' => array( 'option_value' => 'https://one.example.test/', 'autoload' => 'on' ),
\t\t\t\t'blogname' => array( 'option_value' => 'Blog One', 'autoload' => 'on' ),
\t\t\t\t'wphx_shared' => array( 'option_value' => 'one-shared', 'autoload' => 'on' ),
\t\t\t\t'wphx_delete_me' => array( 'option_value' => 'delete-one', 'autoload' => 'off' ),
\t\t\t),
\t\t\t2 => array(
\t\t\t\t'siteurl' => array( 'option_value' => 'https://two.example.test/', 'autoload' => 'on' ),
\t\t\t\t'home' => array( 'option_value' => 'https://two.example.test/', 'autoload' => 'on' ),
\t\t\t\t'blogname' => array( 'option_value' => 'Blog Two', 'autoload' => 'on' ),
\t\t\t\t'wphx_shared' => array( 'option_value' => 'two-shared', 'autoload' => 'on' ),
\t\t\t\t'wphx_delete_me' => array( 'option_value' => 'delete-two', 'autoload' => 'off' ),
\t\t\t),
\t\t\t3 => array(
\t\t\t\t'blogname' => array( 'option_value' => 'Blog Three', 'autoload' => 'on' ),
\t\t\t\t'wphx_shared' => array( 'option_value' => 'three-shared', 'autoload' => 'on' ),
\t\t\t),
\t\t);
\t\t$this->set_blog_id( 1 );
\t}

\tpublic function set_blog_id( $blog_id ) {
\t\t$this->blogid = (int) $blog_id;
\t\t$this->prefix = $this->get_blog_prefix( $this->blogid );
\t\t$this->options = $this->prefix . 'options';
\t}

\tpublic function get_blog_prefix( $blog_id = null ) {
\t\tif ( null === $blog_id ) {
\t\t\t$blog_id = $this->blogid;
\t\t}
\t\t$blog_id = (int) $blog_id;
\t\treturn 1 === $blog_id ? $this->base_prefix : $this->base_prefix . $blog_id . '_';
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

\tpublic function suppress_errors( $suppress = null ) {
\t\treturn false;
\t}

\tpublic function prepare( $query, ...$args ) {
\t\tif ( 1 === count( $args ) && is_array( $args[0] ) ) {
\t\t\t$args = $args[0];
\t\t}
\t\treturn array(
\t\t\t'query' => $query,
\t\t\t'args' => array_values( $args ),
\t\t);
\t}

\tprivate function unpack_query( $query ) {
\t\tif ( is_array( $query ) ) {
\t\t\treturn array( $query['query'], $query['args'] );
\t\t}
\t\treturn array( $query, array() );
\t}

\tprivate function blog_from_table( $table_or_sql ) {
\t\tif ( false !== strpos( $table_or_sql, 'wp_3_options' ) ) {
\t\t\treturn 3;
\t\t}
\t\tif ( false !== strpos( $table_or_sql, 'wp_2_options' ) ) {
\t\t\treturn 2;
\t\t}
\t\treturn 1;
\t}

\tprivate function record( $operation, $query, $args = array() ) {
\t\t$this->queries[] = array(
\t\t\t'operation' => $operation,
\t\t\t'query' => preg_replace( '/\\s+/', ' ', trim( (string) $query ) ),
\t\t\t'args' => $args,
\t\t\t'blogId' => $this->blogid,
\t\t\t'optionsTable' => $this->options,
\t\t);
\t}

\tprivate function row_object( $blog_id, $name, $columns = array( 'option_name', 'option_value', 'autoload' ) ) {
\t\tif ( ! isset( $this->rows[ $blog_id ][ $name ] ) ) {
\t\t\treturn null;
\t\t}
\t\t$row = new stdClass();
\t\tif ( in_array( 'option_name', $columns, true ) ) {
\t\t\t$row->option_name = $name;
\t\t}
\t\tif ( in_array( 'option_value', $columns, true ) ) {
\t\t\t$row->option_value = $this->rows[ $blog_id ][ $name ]['option_value'];
\t\t}
\t\tif ( in_array( 'autoload', $columns, true ) ) {
\t\t\t$row->autoload = $this->rows[ $blog_id ][ $name ]['autoload'];
\t\t}
\t\treturn $row;
\t}

\tpublic function get_row( $query ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'get_row', $sql, $args );
\t\t$name = $args[0] ?? null;
\t\t$blog_id = $this->blog_from_table( $sql );
\t\tif ( null === $name ) {
\t\t\treturn null;
\t\t}
\t\tif ( false !== strpos( $sql, 'SELECT option_value' ) ) {
\t\t\treturn $this->row_object( $blog_id, $name, array( 'option_value' ) );
\t\t}
\t\tif ( false !== strpos( $sql, 'SELECT autoload' ) ) {
\t\t\treturn $this->row_object( $blog_id, $name, array( 'autoload' ) );
\t\t}
\t\treturn $this->row_object( $blog_id, $name );
\t}

\tpublic function get_var( $query ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'get_var', $sql, $args );
\t\t$name = $args[0] ?? null;
\t\t$blog_id = $this->blog_from_table( $sql );
\t\tif ( null === $name || ! isset( $this->rows[ $blog_id ][ $name ] ) ) {
\t\t\treturn null;
\t\t}
\t\tif ( false !== strpos( $sql, 'SELECT autoload' ) ) {
\t\t\treturn $this->rows[ $blog_id ][ $name ]['autoload'];
\t\t}
\t\treturn $this->rows[ $blog_id ][ $name ]['option_value'];
\t}

\tpublic function get_results( $query ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'get_results', $sql, $args );
\t\t$blog_id = $this->blog_from_table( $sql );
\t\t$results = array();
\t\tif ( false !== strpos( $sql, 'WHERE option_name IN' ) ) {
\t\t\tforeach ( $args as $name ) {
\t\t\t\t$row = $this->row_object( $blog_id, $name, array( 'option_name', 'option_value' ) );
\t\t\t\tif ( null !== $row ) {
\t\t\t\t\t$results[] = $row;
\t\t\t\t}
\t\t\t}
\t\t\treturn $results;
\t\t}
\t\tif ( false !== strpos( $sql, 'WHERE autoload IN' ) ) {
\t\t\tforeach ( $this->rows[ $blog_id ] ?? array() as $name => $row ) {
\t\t\t\tif ( in_array( $row['autoload'], array( 'yes', 'on', 'auto-on', 'auto' ), true ) ) {
\t\t\t\t\t$results[] = $this->row_object( $blog_id, $name, array( 'option_name', 'option_value' ) );
\t\t\t\t}
\t\t\t}
\t\t}
\t\treturn $results;
\t}

\tpublic function query( $query ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'query', $sql, $args );
\t\tif ( false !== strpos( $sql, 'INSERT INTO' ) ) {
\t\t\t$blog_id = $this->blog_from_table( $sql );
\t\t\t$name = $args[0] ?? null;
\t\t\tif ( null === $name || isset( $this->rows[ $blog_id ][ $name ] ) ) {
\t\t\t\treturn 0;
\t\t\t}
\t\t\t$this->rows[ $blog_id ][ $name ] = array(
\t\t\t\t'option_value' => $args[1] ?? '',
\t\t\t\t'autoload' => $args[2] ?? 'auto',
\t\t\t);
\t\t\treturn 1;
\t\t}
\t\treturn 0;
\t}

\tpublic function update( $table, $data, $where ) {
\t\t$this->record( 'update', $table, array( 'data' => $data, 'where' => $where ) );
\t\t$blog_id = $this->blog_from_table( $table );
\t\t$name = $where['option_name'] ?? null;
\t\tif ( null === $name || ! isset( $this->rows[ $blog_id ][ $name ] ) ) {
\t\t\treturn 0;
\t\t}
\t\tforeach ( $data as $column => $value ) {
\t\t\t$this->rows[ $blog_id ][ $name ][ $column ] = $value;
\t\t}
\t\treturn 1;
\t}

\tpublic function delete( $table, $where ) {
\t\t$this->record( 'delete', $table, array( 'where' => $where ) );
\t\t$blog_id = $this->blog_from_table( $table );
\t\t$name = $where['option_name'] ?? null;
\t\tif ( null === $name || ! isset( $this->rows[ $blog_id ][ $name ] ) ) {
\t\t\treturn 0;
\t\t}
\t\tunset( $this->rows[ $blog_id ][ $name ] );
\t\treturn 1;
\t}

\tpublic function snapshot() {
\t\t$result = $this->rows;
\t\tksort( $result );
\t\tforeach ( $result as &$rows ) {
\t\t\tksort( $rows );
\t\t}
\t\treturn $result;
\t}
}

function wphx_317_03_bootstrap() {
\tglobal $wpdb, $blog_id, $table_prefix, $current_site;

\t$wpdb = new WPHX_317_03_Fake_WPDB();
\t$blog_id = 1;
\t$table_prefix = 'wp_';
\t$GLOBALS['_wp_switched_stack'] = array();
\t$GLOBALS['switched'] = false;

\trequire_once ABSPATH . WPINC . '/compat.php';
\trequire_once ABSPATH . WPINC . '/utf8.php';
\trequire_once ABSPATH . WPINC . '/load.php';
\trequire_once ABSPATH . WPINC . '/plugin.php';
\trequire_once ABSPATH . WPINC . '/cache.php';
\trequire_once ABSPATH . WPINC . '/functions.php';
\trequire_once ABSPATH . WPINC . '/kses.php';
\trequire_once ABSPATH . WPINC . '/formatting.php';
\trequire_once ABSPATH . WPINC . '/option.php';
\trequire_once ABSPATH . WPINC . '/class-wp-network.php';
\trequire_once ABSPATH . WPINC . '/ms-network.php';
\trequire_once ABSPATH . WPINC . '/class-wp-site.php';
\trequire_once ABSPATH . WPINC . '/class-wp-site-query.php';
\trequire_once ABSPATH . WPINC . '/ms-site.php';
\trequire_once ABSPATH . WPINC . '/ms-blogs.php';

\t$current_site = new WP_Network(
\t\t(object) array(
\t\t\t'id' => 7,
\t\t\t'domain' => 'network.example.test',
\t\t\t'path' => '/',
\t\t\t'blog_id' => 1,
\t\t\t'cookie_domain' => 'network.example.test',
\t\t\t'site_name' => 'Network Example',
\t\t)
\t);
}

wphx_317_03_bootstrap();
wp_cache_init();

function wphx_317_03_scalar( $value ) {
\tif ( is_int( $value ) ) {
\t\treturn array( 'type' => 'int', 'value' => $value );
\t}
\tif ( is_bool( $value ) ) {
\t\treturn array( 'type' => 'bool', 'value' => $value );
\t}
\tif ( null === $value ) {
\t\treturn array( 'type' => 'null', 'value' => null );
\t}
\treturn array(
\t\t'type' => 'string',
\t\t'value' => (string) $value,
\t\t'hex' => bin2hex( (string) $value ),
\t\t'bytes' => strlen( (string) $value ),
\t\t'sha256' => hash( 'sha256', (string) $value ),
\t);
}

function wphx_317_03_value( $value ) {
\tif ( is_array( $value ) ) {
\t\t$entries = array();
\t\tforeach ( $value as $key => $entry_value ) {
\t\t\t$entries[] = array(
\t\t\t\t'key' => wphx_317_03_scalar( $key ),
\t\t\t\t'value' => wphx_317_03_value( $entry_value ),
\t\t\t);
\t\t}
\t\treturn array( 'type' => 'array', 'count' => count( $value ), 'entries' => $entries );
\t}
\tif ( is_object( $value ) ) {
\t\treturn array( 'type' => 'object', 'class' => get_class( $value ), 'properties' => wphx_317_03_value( get_object_vars( $value ) ) );
\t}
\treturn wphx_317_03_scalar( $value );
}

function wphx_317_03_case( $id, $symbol, $value, $meta = array() ) {
\treturn array( 'id' => $id, 'symbol' => $symbol, 'value' => wphx_317_03_value( $value ), 'meta' => $meta );
}

function wphx_317_03_cache_group_snapshot( $groups ) {
\t$result = array();
\tforeach ( $groups as $group => $keys ) {
\t\tforeach ( $keys as $key ) {
\t\t\t$result[ $group ][ $key ] = wp_cache_get( $key, $group );
\t\t}
\t}
\tksort( $result );
\treturn $result;
}

function wphx_317_03_state() {
\tglobal $wpdb, $wp_object_cache;
\t$cache = array(
\t\t'class' => is_object( $wp_object_cache ) ? get_class( $wp_object_cache ) : gettype( $wp_object_cache ),
\t);
\tif ( is_object( $wp_object_cache ) ) {
\t\t$cache['blogPrefix'] = $wp_object_cache->blog_prefix ?? null;
\t\t$cache['globalGroups'] = $wp_object_cache->global_groups ?? null;
\t\t$cache['cache'] = $wp_object_cache->cache ?? null;
\t}
\treturn array(
\t\t'blogId' => get_current_blog_id(),
\t\t'wpdbBlogId' => $wpdb->blogid,
\t\t'tablePrefix' => $GLOBALS['table_prefix'],
\t\t'optionsTable' => $wpdb->options,
\t\t'switched' => $GLOBALS['switched'],
\t\t'msIsSwitched' => ms_is_switched(),
\t\t'stack' => $GLOBALS['_wp_switched_stack'],
\t\t'cache' => $cache,
\t\t'queries' => $wpdb->queries,
\t);
}

function wphx_317_03_reset_state() {
\tglobal $wpdb, $wp_filter, $blog_id, $table_prefix;
\t$wpdb->reset();
\t$blog_id = 1;
\t$table_prefix = 'wp_';
\t$GLOBALS['_wp_switched_stack'] = array();
\t$GLOBALS['switched'] = false;
\t$GLOBALS['wphx_317_03_events'] = array();
\t$wp_filter = array();
\twp_cache_init();
\twp_cache_flush();
}

function wphx_317_03_event_logger( $hook ) {
\treturn function () use ( $hook ) {
\t\t$GLOBALS['wphx_317_03_events'][] = array( 'hook' => $hook, 'args' => func_get_args() );
\t};
}

function wphx_317_03_run_cases() {
\tglobal $wp_object_cache;
\t$cases = array();

\twphx_317_03_reset_state();
\tadd_action( 'switch_blog', wphx_317_03_event_logger( 'switch_blog' ), 10, 3 );
\t$initial = wphx_317_03_state();
\t$switched_two = switch_to_blog( 2 );
\t$after_two = wphx_317_03_state();
\t$switched_three = switch_to_blog( 3 );
\t$after_three = wphx_317_03_state();
\t$restore_one = restore_current_blog();
\t$after_restore_one = wphx_317_03_state();
\t$restore_two = restore_current_blog();
\t$after_restore_two = wphx_317_03_state();
\t$restore_empty = restore_current_blog();
\t$cases[] = wphx_317_03_case(
\t\t'switch:nested-stack-and-events',
\t\t'switch_to_blog/restore_current_blog/ms_is_switched',
\t\tarray(
\t\t\t'initial' => $initial,
\t\t\t'switchedTwo' => $switched_two,
\t\t\t'afterTwo' => $after_two,
\t\t\t'switchedThree' => $switched_three,
\t\t\t'afterThree' => $after_three,
\t\t\t'restoreOne' => $restore_one,
\t\t\t'afterRestoreOne' => $after_restore_one,
\t\t\t'restoreTwo' => $restore_two,
\t\t\t'afterRestoreTwo' => $after_restore_two,
\t\t\t'restoreEmpty' => $restore_empty,
\t\t),
\t\tarray( 'events' => $GLOBALS['wphx_317_03_events'] )
\t);

\twphx_317_03_reset_state();
\tadd_action( 'switch_blog', wphx_317_03_event_logger( 'switch_blog' ), 10, 3 );
\t$same_switch = switch_to_blog( 1 );
\t$after_same = wphx_317_03_state();
\t$same_restore = restore_current_blog();
\t$after_same_restore = wphx_317_03_state();
\t$cases[] = wphx_317_03_case(
\t\t'switch:same-blog-stack',
\t\t'switch_to_blog/restore_current_blog',
\t\tarray(
\t\t\t'sameSwitch' => $same_switch,
\t\t\t'afterSame' => $after_same,
\t\t\t'sameRestore' => $same_restore,
\t\t\t'afterSameRestore' => $after_same_restore,
\t\t),
\t\tarray( 'events' => $GLOBALS['wphx_317_03_events'] )
\t);

\twphx_317_03_reset_state();
\twp_cache_add_global_groups( array( 'global-cache', 'site-options' ) );
\twp_cache_set( 'shared', 'blog-one-global', 'global-cache' );
\twp_cache_set( 'local', 'blog-one-local', 'local-cache' );
\t$prefix_one = $wp_object_cache->blog_prefix;
\tswitch_to_blog( 2 );
\t$prefix_two = $wp_object_cache->blog_prefix;
\t$global_on_two = wp_cache_get( 'shared', 'global-cache' );
\t$local_on_two_before = wp_cache_get( 'local', 'local-cache' );
\twp_cache_set( 'local', 'blog-two-local', 'local-cache' );
\trestore_current_blog();
\t$cases[] = wphx_317_03_case(
\t\t'cache:global-local-groups-through-switch',
\t\t'wp_cache_add_global_groups/wp_cache_switch_to_blog',
\t\tarray(
\t\t\t'prefixOne' => $prefix_one,
\t\t\t'prefixTwo' => $prefix_two,
\t\t\t'globalOnTwo' => $global_on_two,
\t\t\t'localOnTwoBefore' => $local_on_two_before,
\t\t\t'localOnOneAfterRestore' => wp_cache_get( 'local', 'local-cache' ),
\t\t\t'globalOnOneAfterRestore' => wp_cache_get( 'shared', 'global-cache' ),
\t\t\t'currentState' => wphx_317_03_state(),
\t\t),
\t\tarray( 'cacheGroups' => wphx_317_03_cache_group_snapshot( array( 'global-cache' => array( 'shared' ), 'local-cache' => array( 'local' ) ) ) )
\t);

\twphx_317_03_reset_state();
\t$filter_events = array();
\tadd_filter(
\t\t'blog_option_wphx_shared',
\t\tfunction ( $value, $id ) use ( &$filter_events ) {
\t\t\t$filter_events[] = array( 'value' => $value, 'id' => $id );
\t\t\treturn $value . '|filtered:' . $id;
\t\t},
\t\t10,
\t\t2
\t);
\t$blog_two_before = get_blog_option( 2, 'wphx_shared', 'missing' );
\t$add_two = add_blog_option( 2, 'wphx_added', array( 'blog' => 2 ) );
\t$update_two = update_blog_option( 2, 'wphx_shared', 'two-updated' );
\t$delete_two = delete_blog_option( 2, 'wphx_delete_me' );
\t$blog_two_after = get_blog_option( 2, 'wphx_shared', 'missing' );
\t$current_blog_value = get_blog_option( 1, 'wphx_shared', 'missing' );
\t$cases[] = wphx_317_03_case(
\t\t'blog-option:cross-blog-wrappers',
\t\t'get_blog_option/add_blog_option/update_blog_option/delete_blog_option',
\t\tarray(
\t\t\t'blogTwoBefore' => $blog_two_before,
\t\t\t'addTwo' => $add_two,
\t\t\t'updateTwo' => $update_two,
\t\t\t'deleteTwo' => $delete_two,
\t\t\t'blogTwoAfter' => $blog_two_after,
\t\t\t'currentBlogValue' => $current_blog_value,
\t\t\t'finalState' => wphx_317_03_state(),
\t\t),
\t\tarray(
\t\t\t'filterEvents' => $filter_events,
\t\t\t'db' => $GLOBALS['wpdb']->snapshot(),
\t\t)
\t);

\twphx_317_03_reset_state();
\twp_cache_add_global_groups( array( 'global-cache' ) );
\twp_cache_add_non_persistent_groups( array( 'counts' ) );
\twp_cache_set( 'shared', 'before-fallback', 'global-cache' );
\twp_cache_set( 'local', 'before-fallback', 'local-cache' );
\t$before_fallback = wphx_317_03_state();
\t$GLOBALS['blog_id'] = 2;
\twp_cache_switch_to_blog_fallback();
\t$cases[] = wphx_317_03_case(
\t\t'cache:fallback-reinitializes-groups',
\t\t'wp_cache_switch_to_blog_fallback',
\t\tarray(
\t\t\t'before' => $before_fallback,
\t\t\t'after' => wphx_317_03_state(),
\t\t\t'globalAfter' => wp_cache_get( 'shared', 'global-cache' ),
\t\t\t'localAfter' => wp_cache_get( 'local', 'local-cache' ),
\t\t),
\t\tarray()
\t);

\treturn $cases;
}

$snapshot = array(
\t'mode' => $mode,
\t'phpVersion' => PHP_VERSION,
\t'multisite' => is_multisite(),
\t'coveredFunctionExists' => array(
\t\t'switch_to_blog' => function_exists( 'switch_to_blog' ),
\t\t'restore_current_blog' => function_exists( 'restore_current_blog' ),
\t\t'ms_is_switched' => function_exists( 'ms_is_switched' ),
\t\t'wp_cache_switch_to_blog_fallback' => function_exists( 'wp_cache_switch_to_blog_fallback' ),
\t\t'get_blog_option' => function_exists( 'get_blog_option' ),
\t\t'add_blog_option' => function_exists( 'add_blog_option' ),
\t\t'delete_blog_option' => function_exists( 'delete_blog_option' ),
\t\t'update_blog_option' => function_exists( 'update_blog_option' ),
\t\t'wp_cache_switch_to_blog' => function_exists( 'wp_cache_switch_to_blog' ),
\t),
\t'cases' => wphx_317_03_run_cases(),
);

echo json_encode( $snapshot, JSON_UNESCAPED_SLASHES );
`
  );
}

function normalize(result) {
  return {
    multisite: result.multisite,
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
      throw new Error(`${path} is stale; run npm run wp:core:wphx-317-blog-switch-cache`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha, upstreamDigest) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/multisite-blog-switch-cache-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "workset",
      name: "multisite blog switching and cache-group differential fixture harness",
      area: "wp-includes",
      public_contract:
        "WordPress 7.0 switch_to_blog(), restore_current_blog(), blog option wrappers, and cache group switching behavior remain observable while the candidate side is still an oracle source mirror."
    },
    ownership_state: "external_oracle",
    upstream: {
      repo: UPSTREAM_ROOT,
      ref: WP_REF,
      paths: SOURCE_FILES,
      digest: upstreamDigest
    },
    owned_paths: ["tools/wp-core/run-multisite-blog-switch-cache-fixture.mjs", OUT, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-317-blog-switch-cache",
        "npm run wp:core:wphx-317-blog-switch-cache:check",
        "npm run beads:validate",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-317-03-multisite-blog-switch-cache-fixture"],
      manifest_digest: manifestSha
    },
    notes:
      "The candidate fixture root is an oracle source mirror for WPHX-317.03. The probe enables multisite and supplies deterministic per-blog option tables through a constrained wpdb test double; full installed multisite routing and live database parity remain later WPHX-317 gates."
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
  schema: "wphx.wp-core-multisite-blog-switch-cache-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-multisite-blog-switch-cache-fixture.mjs",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    object_cache_fixture: inputRecord(OBJECT_CACHE_FIXTURE),
    option_storage_fixture: inputRecord(OPTION_STORAGE_FIXTURE),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    source_units: sourceUnits,
    upstream_digest: upstreamDigest
  },
  fixture: {
    candidate_kind: "oracle_source_mirror",
    source_domain: surface.domains.find((domain) => domain.id === "site_blog_switching")?.label ?? "site/blog switching",
    covered_symbols: COVERED_SYMBOLS,
    cases: FIXTURE_CASES,
    native_boundaries: [
      {
        id: "wpdb-per-blog-option-test-double",
        reason:
          "The probe supplies deterministic per-blog option-table behavior so blog option wrappers can run through real option.php without a live database. Full SQL/storage parity remains WPHX-305."
      },
      {
        id: "wordpress-object-cache-runtime",
        reason:
          "Blog switching uses WordPress's native WP_Object_Cache runtime, blog prefixes, and global-group behavior."
      },
      {
        id: "multisite-switch-stack-globals",
        reason:
          "The probe intentionally observes PHP globals such as $blog_id, $table_prefix, $_wp_switched_stack, and $switched because they are public plugin-facing state."
      },
      {
        id: "plugin-action-filter-hooks",
        reason:
          "switch_blog actions and blog_option filters remain native PHP callbacks with WordPress-compatible argument ordering."
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
  runs,
  comparisons,
  remaining_gaps: [
    {
      id: "haxe-candidate-not-yet-installed",
      owner: "WPHX-317.07",
      detail: "The candidate side is a copied WordPress oracle source tree until selected multisite switching/cache helpers move to Haxe parity candidates."
    },
    {
      id: "site-object-details-not-yet-covered",
      owner: "WPHX-317.04",
      detail: "This slice covers blog option wrappers and switch/cache state; WP_Site/WP_Network object/query behavior remains WPHX-317.04."
    },
    {
      id: "installed-routing-not-yet-covered",
      owner: "WPHX-317.05",
      detail: "The probe enables multisite state but does not claim full installed multisite domain/path bootstrap routing parity."
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
  id: "receipt:wphx-317-03-multisite-blog-switch-cache-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    {
      path: OUT,
      role: "multisite blog switching and cache-group differential fixture manifest"
    },
    {
      path: OWNERSHIP,
      role: "external-oracle ownership manifest for the fixture harness"
    },
    {
      path: "tools/wp-core/run-multisite-blog-switch-cache-fixture.mjs",
      role: "fixture generator and check-mode validator"
    }
  ],
  verification_commands: [
    "npm run wp:core:wphx-317-blog-switch-cache",
    "npm run wp:core:wphx-317-blog-switch-cache:check",
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
