#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.21.3",
  external_ref: "WPHX-315.03",
  title: "WPHX-315.03 - Add admin request screen list-table oracle fixture"
};
const RECORDED_AT = "2026-07-03T16:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-admin-request-screen-list-table-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-315-03";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-315-03-admin-request-screen-list-table-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-315-03-admin-request-screen-list-table-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-315-03-admin-request-screen-list-table-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-315-01-admin-common-list-table-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-315-02-admin-common-list-table-adapter-contract-candidate.v1.json";

const SOURCE_FILES = [
  "src/wp-admin/includes/class-wp-screen.php",
  "src/wp-admin/includes/screen.php",
  "src/wp-admin/includes/class-wp-list-table.php",
  "src/wp-includes/pluggable.php"
];
const COVERED_SYMBOLS = [
  "WP_Screen::get",
  "WP_Screen::set_current_screen",
  "WP_Screen::set_parentage",
  "WP_Screen::add_help_tab",
  "WP_Screen::get_help_tabs",
  "WP_Screen::add_option",
  "WP_Screen::get_option",
  "WP_Screen::set_screen_reader_content",
  "get_current_screen",
  "set_current_screen",
  "add_screen_option",
  "get_column_headers",
  "get_hidden_columns",
  "WP_List_Table::__construct",
  "WP_List_Table::get_column_info",
  "WP_List_Table::current_action",
  "WP_List_Table::set_pagination_args",
  "WP_List_Table::get_pagination_arg",
  "WP_List_Table::row_actions",
  "WP_List_Table::display",
  "check_admin_referer"
];
const CASES = [
  { id: "admin-request:current-screen", focus: "admin request routing, current screen globals, parentage, block-editor flag, and current_screen action" },
  { id: "screen:help-options", focus: "WP_Screen help-tab priority ordering, screen options, sidebar, reader text, and add_screen_option handoff" },
  { id: "list-table:columns-actions", focus: "WP_List_Table column headers, hidden columns, sortable metadata, bulk action/current_action, row actions, and table classes" },
  { id: "list-table:pagination-display", focus: "WP_List_Table pagination args, nonce field, tablenav, column headers, rows, and output fragments" },
  { id: "guard:nonce-capability", focus: "check_admin_referer valid and referer-fallback branches plus capability guard stubs" }
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

$_SERVER['HTTP_HOST'] = 'example.test';
$_SERVER['REQUEST_URI'] = '/wp-admin/edit.php?orderby=name&order=asc&paged=2';

$GLOBALS['wphx_case'] = $case;
$GLOBALS['wphx_filters'] = array();
$GLOBALS['wphx_actions'] = array();
$GLOBALS['wphx_callbacks'] = array();
$GLOBALS['wphx_errors'] = array();
$GLOBALS['wphx_redirects'] = array();
$GLOBALS['wphx_nonce_ays'] = array();
$GLOBALS['wphx_wrong'] = array();
$GLOBALS['wphx_user_options'] = array(
\t'manageedit-postcolumnshidden' => array( 'status' ),
);
$GLOBALS['wphx_user_settings'] = array(
\t'posts_list_mode' => 'excerpt',
);
$GLOBALS['wphx_caps'] = array(
\t'manage_options' => true,
\t'delete_posts' => false,
);
$GLOBALS['wphx_referer'] = 'https://example.test/wp-admin/edit.php';

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

function __( $text ) { return $text; }
function _e( $text ) { echo $text; }
function _x( $text, $context ) { return $text; }
function _n( $single, $plural, $number ) { return 1 === (int) $number ? $single : $plural; }
function esc_attr( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function esc_html( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function esc_url( $url ) { return (string) $url; }
function esc_attr__( $text ) { return esc_attr( $text ); }
function esc_attr_e( $text ) { echo esc_attr( $text ); }
function esc_html_e( $text ) { echo esc_html( $text ); }
function wp_kses_post( $text ) { return $text; }
function wp_strip_all_tags( $text ) { return strip_tags( (string) $text ); }
function number_format_i18n( $number ) { return number_format( (float) $number, 0, '.', ',' ); }
function absint( $value ) { return abs( (int) $value ); }

function sanitize_key( $key ) {
\treturn preg_replace( '/[^a-z0-9_\\-]/', '', strtolower( (string) $key ) );
}

function sanitize_html_class( $class ) {
\treturn preg_replace( '/[^A-Za-z0-9_\\-]/', '', (string) $class );
}

function wp_parse_args( $args, $defaults = array() ) {
\tif ( is_object( $args ) ) {
\t\t$parsed = get_object_vars( $args );
\t} elseif ( is_array( $args ) ) {
\t\t$parsed = $args;
\t} else {
\t\tparse_str( (string) $args, $parsed );
\t}
\treturn array_merge( $defaults, $parsed );
}

function add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wphx_callbacks'][ $hook_name ][ $priority ][] = array( $callback, $accepted_args );
\t$GLOBALS['wphx_filters'][] = array( 'hook' => 'add_filter:' . $hook_name, 'priority' => $priority, 'accepted_args' => $accepted_args );
\treturn true;
}

function add_action( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wphx_actions'][] = array( 'hook' => 'add_action:' . $hook_name, 'priority' => $priority, 'accepted_args' => $accepted_args );
\treturn add_filter( $hook_name, $callback, $priority, $accepted_args );
}

function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_filters'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) + 1 );
\tif ( isset( $GLOBALS['wphx_callbacks'][ $hook_name ] ) ) {
\t\tksort( $GLOBALS['wphx_callbacks'][ $hook_name ] );
\t\tforeach ( $GLOBALS['wphx_callbacks'][ $hook_name ] as $callbacks ) {
\t\t\tforeach ( $callbacks as $callback ) {
\t\t\t\t$accepted = $callback[1];
\t\t\t\t$value = call_user_func_array( $callback[0], array_slice( array_merge( array( $value ), $args ), 0, $accepted ) );
\t\t\t}
\t\t}
\t}
\treturn $value;
}

function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_actions'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) );
\tif ( isset( $GLOBALS['wphx_callbacks'][ $hook_name ] ) ) {
\t\tksort( $GLOBALS['wphx_callbacks'][ $hook_name ] );
\t\tforeach ( $GLOBALS['wphx_callbacks'][ $hook_name ] as $callbacks ) {
\t\t\tforeach ( $callbacks as $callback ) {
\t\t\t\tcall_user_func_array( $callback[0], array_slice( $args, 0, $callback[1] ) );
\t\t\t}
\t\t}
\t}
}

function _doing_it_wrong( $function_name, $message, $version ) {
\t$GLOBALS['wphx_wrong'][] = compact( 'function_name', 'message', 'version' );
}

function wp_trigger_error( $function_name, $message, $error_level = E_USER_NOTICE ) {
\t$GLOBALS['wphx_errors'][] = compact( 'function_name', 'message', 'error_level' );
}

function get_user_option( $option ) {
\treturn $GLOBALS['wphx_user_options'][ $option ] ?? false;
}

function get_user_setting( $name, $default = false ) {
\treturn $GLOBALS['wphx_user_settings'][ $name ] ?? $default;
}

function post_type_exists( $post_type ) {
\treturn in_array( $post_type, array( 'post', 'page', 'attachment' ), true );
}

function taxonomy_exists( $taxonomy ) {
\treturn in_array( $taxonomy, array( 'category', 'post_tag' ), true );
}

function is_object_in_taxonomy( $object_type, $taxonomy ) {
\treturn 'post' === $object_type && taxonomy_exists( $taxonomy );
}

function use_block_editor_for_post_type( $post_type ) {
\treturn 'post' === $post_type || 'page' === $post_type;
}

function use_block_editor_for_post( $post ) {
\treturn true;
}

function get_post( $post_id ) {
\treturn (object) array( 'ID' => (int) $post_id, 'post_type' => 'post' );
}

function wp_die( $message = '', $title = '', $args = array() ) {
\tthrow new RuntimeException( 'wp_die:' . $message );
}

function wp_doing_ajax() { return false; }
function wp_redirect( $location ) { $GLOBALS['wphx_redirects'][] = $location; return true; }
function set_url_scheme( $url ) { return preg_replace( '/^https?:/', 'http:', (string) $url ); }
function wp_removable_query_args() { return array( '_wpnonce', '_wp_http_referer' ); }

function add_query_arg( $key, $value = null, $url = null ) {
\tif ( is_array( $key ) ) {
\t\t$args = $key;
\t\t$target = $value ?: ( 'http://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'] );
\t} else {
\t\t$args = array( $key => $value );
\t\t$target = $url ?: ( 'http://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'] );
\t}
\t$separator = str_contains( $target, '?' ) ? '&' : '?';
\treturn $target . $separator . http_build_query( $args );
}

function remove_query_arg( $keys, $url = '' ) {
\t$target = $url ?: ( 'http://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'] );
\t$parts = parse_url( $target );
\tparse_str( $parts['query'] ?? '', $query );
\tforeach ( (array) $keys as $key ) {
\t\tunset( $query[ $key ] );
\t}
\t$rebuilt = ( $parts['scheme'] ?? 'http' ) . '://' . ( $parts['host'] ?? $_SERVER['HTTP_HOST'] ) . ( $parts['path'] ?? '' );
\treturn $query ? $rebuilt . '?' . http_build_query( $query ) : $rebuilt;
}

function wp_nonce_field( $action = -1, $name = '_wpnonce', $referer = true, $display = true ) {
\t$field = '<input type="hidden" name="' . esc_attr( $name ) . '" value="nonce:' . esc_attr( $action ) . '" />';
\tif ( $referer ) {
\t\t$field .= '<input type="hidden" name="_wp_http_referer" value="/wp-admin/edit.php" />';
\t}
\tif ( $display ) {
\t\techo $field;
\t}
\treturn $field;
}

function submit_button( $text, $type = 'primary', $name = 'submit', $wrap = true, $other_attributes = array() ) {
\t$id = isset( $other_attributes['id'] ) ? $other_attributes['id'] : $name;
\techo '<input type="submit" name="' . esc_attr( $name ) . '" id="' . esc_attr( $id ) . '" class="' . esc_attr( $type ) . '" value="' . esc_attr( $text ) . '" />';
}

function current_user_can( $capability, ...$args ) {
\treturn (bool) ( $GLOBALS['wphx_caps'][ $capability ] ?? false );
}

function admin_url( $path = '', $scheme = 'admin' ) {
\treturn 'https://example.test/wp-admin/' . ltrim( (string) $path, '/' );
}

function wp_get_referer() {
\treturn $GLOBALS['wphx_referer'];
}

function wp_verify_nonce( $nonce, $action = -1 ) {
\tif ( 'valid' === $nonce ) {
\t\treturn 1;
\t}
\tif ( 'stale' === $nonce ) {
\t\treturn 2;
\t}
\treturn false;
}

function wp_nonce_ays( $action ) {
\t$GLOBALS['wphx_nonce_ays'][] = $action;
}

require $root . '/wp-admin/includes/class-wp-screen.php';
require $root . '/wp-admin/includes/screen.php';
require $root . '/wp-admin/includes/class-wp-list-table.php';
require $root . '/wp-includes/pluggable.php';

function convert_to_screen( $hook_name ) {
\treturn WP_Screen::get( $hook_name );
}

class WPHX_Admin_List_Table extends WP_List_Table {
\tpublic function __construct() {
\t\tparent::__construct(
\t\t\tarray(
\t\t\t\t'plural' => 'wphx-items',
\t\t\t\t'singular' => 'wphx-item',
\t\t\t\t'ajax' => true,
\t\t\t\t'screen' => 'edit.php',
\t\t\t)
\t\t);
\t}

\tpublic function prepare_items() {
\t\t$this->items = array(
\t\t\tarray( 'id' => 11, 'name' => 'Alpha', 'status' => 'draft' ),
\t\t\tarray( 'id' => 12, 'name' => 'Beta', 'status' => 'publish' ),
\t\t);
\t\t$this->set_pagination_args( array( 'total_items' => 42, 'per_page' => 20 ) );
\t}

\tpublic function get_columns() {
\t\treturn array(
\t\t\t'cb' => '<input type="checkbox" />',
\t\t\t'name' => 'Name',
\t\t\t'status' => 'Status',
\t\t\t'comments' => 'Comments',
\t\t);
\t}

\tprotected function get_sortable_columns() {
\t\treturn array(
\t\t\t'name' => array( 'name', false, 'Name', 'Sort by name.', 'asc' ),
\t\t\t'status' => array( 'status', true, '', 'Sort by status.' ),
\t\t);
\t}

\tprotected function get_bulk_actions() {
\t\treturn array(
\t\t\t'delete' => 'Delete',
\t\t\t'Change State' => array( 'feature' => 'Featured' ),
\t\t);
\t}

\tpublic function column_cb( $item ) {
\t\treturn '<input type="checkbox" name="ids[]" value="' . esc_attr( $item['id'] ) . '" />';
\t}

\tpublic function column_name( $item ) {
\t\treturn '<strong>' . esc_html( $item['name'] ) . '</strong>' . $this->row_actions(
\t\t\tarray(
\t\t\t\t'edit' => '<a href="edit.php?id=' . esc_attr( $item['id'] ) . '">Edit</a>',
\t\t\t\t'delete' => '<a href="delete.php?id=' . esc_attr( $item['id'] ) . '">Delete</a>',
\t\t\t),
\t\t\ttrue
\t\t);
\t}

\tpublic function column_status( $item ) {
\t\treturn esc_html( $item['status'] );
\t}

\tprotected function column_default( $item, $column_name ) {
\t\treturn 'default:' . $column_name;
\t}

\tpublic function expose_column_info() {
\t\treturn $this->get_column_info();
\t}

\tpublic function expose_table_classes() {
\t\treturn $this->get_table_classes();
\t}

\tpublic function expose_set_pagination_args( $args ) {
\t\t$this->set_pagination_args( $args );
\t}

\tpublic function expose_row_actions( $actions, $always_visible = false ) {
\t\treturn $this->row_actions( $actions, $always_visible );
\t}
}

function wphx_normalize_html( $html ) {
\treturn trim( preg_replace( '/\\s+/', ' ', (string) $html ) );
}

function wphx_hash_html( $html ) {
\treturn 'sha256:' . hash( 'sha256', wphx_normalize_html( $html ) );
}

function wphx_screen_summary( $screen ) {
\treturn array(
\t\t'id' => $screen->id,
\t\t'base' => $screen->base,
\t\t'action' => $screen->action,
\t\t'post_type' => $screen->post_type,
\t\t'taxonomy' => $screen->taxonomy,
\t\t'in_admin_any' => $screen->in_admin(),
\t\t'in_admin_site' => $screen->in_admin( 'site' ),
\t\t'in_admin_network' => $screen->in_admin( 'network' ),
\t\t'is_block_editor' => $screen->is_block_editor(),
\t\t'parent_file' => $screen->parent_file,
\t\t'parent_base' => $screen->parent_base,
\t);
}

function wphx_emit( $payload ) {
\techo json_encode(
\t\tarray_merge(
\t\t\tarray(
\t\t\t\t'case' => $GLOBALS['wphx_case'],
\t\t\t\t'filters' => $GLOBALS['wphx_filters'],
\t\t\t\t'actions' => $GLOBALS['wphx_actions'],
\t\t\t\t'errors' => $GLOBALS['wphx_errors'],
\t\t\t\t'wrong' => $GLOBALS['wphx_wrong'],
\t\t\t\t'nonce_ays' => $GLOBALS['wphx_nonce_ays'],
\t\t\t),
\t\t\t$payload
\t\t),
\t\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
\t);
}

switch ( $case ) {
\tcase 'admin-request:current-screen':
\t\t$_REQUEST = array();
\t\tset_current_screen( 'edit.php' );
\t\t$screen = get_current_screen();
\t\t$screen->set_parentage( 'edit.php?post_type=post' );
\t\t$screen->is_block_editor( true );
\t\t$network = WP_Screen::get( 'dashboard-network' );
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'current' => wphx_screen_summary( $screen ),
\t\t\t\t'network' => wphx_screen_summary( $network ),
\t\t\t\t'globals' => array( 'typenow' => $GLOBALS['typenow'] ?? null, 'taxnow' => $GLOBALS['taxnow'] ?? null ),
\t\t\t)
\t\t);
\t\tbreak;

\tcase 'screen:help-options':
\t\tset_current_screen( 'tools.php' );
\t\t$screen = get_current_screen();
\t\t$screen->add_help_tab( array( 'id' => 'later tab', 'title' => 'Later', 'content' => '<p>Later</p>', 'priority' => 20 ) );
\t\t$screen->add_help_tab( array( 'id' => 'first', 'title' => 'First', 'content' => '<p>First</p>', 'priority' => 5 ) );
\t\t$screen->add_help_tab( array( 'id' => '', 'title' => 'Missing', 'content' => 'skip' ) );
\t\t$screen->set_help_sidebar( '<p>Sidebar</p>' );
\t\t$screen->set_screen_reader_content( array( 'heading_list' => 'Fixture items' ) );
\t\tadd_screen_option( 'per_page', array( 'default' => 25, 'option' => 'fixture_per_page' ) );
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'screen' => wphx_screen_summary( $screen ),
\t\t\t\t'help_order' => array_keys( $screen->get_help_tabs() ),
\t\t\t\t'help_first' => $screen->get_help_tab( 'first' ),
\t\t\t\t'help_sidebar' => $screen->get_help_sidebar(),
\t\t\t\t'per_page_default' => $screen->get_option( 'per_page', 'default' ),
\t\t\t\t'screen_reader' => $screen->get_screen_reader_content(),
\t\t\t)
\t\t);
\t\tbreak;

\tcase 'list-table:columns-actions':
\t\t$_REQUEST = array( 'action' => 'delete' );
\t\t$_GET = array( 'orderby' => 'name', 'order' => 'asc' );
\t\t$table = new WPHX_Admin_List_Table();
\t\t$table->prepare_items();
\t\t$column_info = $table->expose_column_info();
\t\t$row_actions = $table->expose_row_actions( array( 'edit' => '<a>Edit</a>', 'delete' => '<a>Delete</a>' ), true );
\t\t$bulk_action = $table->current_action();
\t\t$_REQUEST = array( 'filter_action' => '1', 'action' => 'delete' );
\t\t$filtered_action = $table->current_action();
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'columns' => array_keys( $column_info[0] ),
\t\t\t\t'hidden' => $column_info[1],
\t\t\t\t'sortable' => $column_info[2],
\t\t\t\t'primary' => $column_info[3],
\t\t\t\t'bulk_action' => $bulk_action,
\t\t\t\t'filtered_action' => $filtered_action,
\t\t\t\t'row_actions' => wphx_normalize_html( $row_actions ),
\t\t\t\t'table_classes' => $table->expose_table_classes(),
\t\t\t)
\t\t);
\t\tbreak;

\tcase 'list-table:pagination-display':
\t\t$_REQUEST = array( 'paged' => 2, 'action' => '-1' );
\t\t$_GET = array( 'orderby' => 'name', 'order' => 'asc', 'paged' => 2 );
\t\t$table = new WPHX_Admin_List_Table();
\t\t$table->prepare_items();
\t\tob_start();
\t\t$table->display();
\t\t$html = ob_get_clean();
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'page' => $table->get_pagination_arg( 'page' ),
\t\t\t\t'total_pages' => $table->get_pagination_arg( 'total_pages' ),
\t\t\t\t'per_page' => $table->get_pagination_arg( 'per_page' ),
\t\t\t\t'html_sha256' => wphx_hash_html( $html ),
\t\t\t\t'contains' => array(
\t\t\t\t\t'nonce' => str_contains( $html, 'nonce:bulk-wphx-items' ),
\t\t\t\t\t'tablenav' => str_contains( $html, 'class="tablenav top"' ),
\t\t\t\t\t'hidden_column' => str_contains( $html, 'column-status hidden' ),
\t\t\t\t\t'row_action' => str_contains( $html, 'row-actions visible' ),
\t\t\t\t\t'pagination' => str_contains( $html, '3</span>' ),
\t\t\t\t),
\t\t\t\t'html_excerpt' => substr( wphx_normalize_html( $html ), 0, 360 ),
\t\t\t)
\t\t);
\t\tbreak;

\tcase 'guard:nonce-capability':
\t\t$_REQUEST = array( '_wpnonce' => 'valid' );
\t\t$valid = check_admin_referer( 'bulk-wphx-items' );
\t\t$_REQUEST = array();
\t\t$GLOBALS['wphx_referer'] = 'https://example.test/wp-admin/edit.php?post_type=post';
\t\t$fallback = check_admin_referer( -1 );
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'nonce_valid' => $valid,
\t\t\t\t'nonce_referer_fallback' => $fallback,
\t\t\t\t'caps' => array(
\t\t\t\t\t'manage_options' => current_user_can( 'manage_options' ),
\t\t\t\t\t'delete_posts' => current_user_can( 'delete_posts' ),
\t\t\t\t),
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

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-315-admin-request-screen-list-table-oracle-fixture`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function setupRoot(root) {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  mirrorSources(root);
}

function normalizeRun(run) {
  return {
    case: run.case,
    current: run.current,
    network: run.network,
    globals: run.globals,
    screen: run.screen,
    help_order: run.help_order,
    help_first: run.help_first,
    help_sidebar: run.help_sidebar,
    per_page_default: run.per_page_default,
    screen_reader: run.screen_reader,
    columns: run.columns,
    hidden: run.hidden,
    sortable: run.sortable,
    primary: run.primary,
    bulk_action: run.bulk_action,
    filtered_action: run.filtered_action,
    row_actions: run.row_actions,
    table_classes: run.table_classes,
    page: run.page,
    total_pages: run.total_pages,
    per_page: run.per_page,
    html_sha256: run.html_sha256,
    contains: run.contains,
    html_excerpt: run.html_excerpt,
    nonce_valid: run.nonce_valid,
    nonce_referer_fallback: run.nonce_referer_fallback,
    caps: run.caps,
    filters: run.filters,
    actions: run.actions,
    errors: run.errors,
    wrong: run.wrong,
    nonce_ays: run.nonce_ays
  };
}

try {
  setupRoot(ORACLE_ROOT);
  setupRoot(CANDIDATE_ROOT);
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
  schema: "wphx.wp-core-admin-request-screen-list-table-oracle-fixture.v1",
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
      installed_admin_parity_claimed: false,
      browser_or_editor_ownership_claimed: false,
      removal_gate:
        "Replace copied candidate PHP with Haxe-owned admin request, WP_Screen, WP_List_Table, nonce/capability, and generated original-path adapter evidence before claiming public PHP ownership."
    }
  },
  runs,
  remaining_gaps: [
    {
      id: "admin-menu-notice-output-fixture-not-yet-built",
      owner: ISSUE.external_ref,
      detail:
        "Menu/submenu registration, admin notice markup, admin header/footer, and broader common output helpers are reserved for the WPHX-315.04 fixture."
    },
    {
      id: "installed-admin-distribution-not-covered",
      owner: ISSUE.external_ref,
      detail:
        "No installed wp-admin request, browser, database-backed list table, real user/capability, real nonce/session, admin Ajax, e2e, or upstream PHPUnit pass/pass behavior is claimed."
    },
    {
      id: "public-php-adapter-not-generated",
      owner: ISSUE.external_ref,
      detail:
        "No original-path admin bootstrap, WP_Screen, WP_List_Table, nonce/capability, or output adapter replacement is claimed; candidate files are copied upstream PHP source for bridge evidence."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    case_count: runs.length,
    covered_symbol_count: COVERED_SYMBOLS.length,
    source_file_count: SOURCE_FILES.length,
    oracle_candidate_match: allMatched,
    public_php_replacement_claimed: false,
    installed_admin_parity_claimed: false,
    browser_or_editor_ownership_claimed: false
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const ownership = {
  schema: "wphx.ownership-manifest.v1",
  manifest_id: "ownership:wp-core/admin-request-screen-list-table-oracle-fixture",
  issue: {
    id: ISSUE.id,
    external_ref: ISSUE.external_ref
  },
  unit: {
    kind: "oracle_fixture",
    name: "admin request state, WP_Screen help/options, WP_List_Table columns/actions/pagination/output, and nonce/capability guard behavior",
    area: "wp-admin/includes/class-wp-screen.php wp-admin/includes/screen.php wp-admin/includes/class-wp-list-table.php wp-includes/pluggable.php",
    public_contract:
      "This fixture mirrors upstream WordPress PHP into oracle and candidate roots to capture selected admin request, screen, list-table, and guard behavior. It does not claim Haxe-owned runtime logic or public PHP ABI replacement."
  },
  ownership_state: "bridge_oracle_fixture",
  ownership_axes: {
    semantic_owner: "upstream_php_oracle_mirrored",
    adapter_contract_owner: "haxe_typed_prior_candidate",
    emission_strategy: "copied_oracle_php_candidate",
    execution_provider: "php_cli",
    compatibility_evidence: "oracle_candidate_behavior_match"
  },
  bridge: {
    exists: true,
    kind: "copied_oracle_candidate_php",
    removal_gate:
      "Promote admin request/screen/list-table/guard decisions into Haxe-owned implementation and generated original-path PHP adapters, then rerun admin request, menu/notice/output, upstream PHPUnit/e2e, and installed distribution gates."
  },
  owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
  generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
  verification: {
    oracle_commands: [
      "npm run wp:core:wphx-315-admin-request-screen-list-table-oracle-fixture",
      "npm run wp:core:wphx-315-admin-request-screen-list-table-oracle-fixture:check",
      "npm run receipts:validate"
    ],
    receipt_refs: ["receipt:wphx-315-03-admin-request-screen-list-table-oracle-fixture"],
    manifest_digest: sha256(manifestText)
  },
  notes:
    "The probe stubs surrounding WordPress services deliberately to keep the selected copied PHP behavior deterministic; this is bridge evidence, not complete WPHX-315 ownership."
};
const ownershipText = JSON.stringify(ownership, null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-315-03-admin-request-screen-list-table-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "admin request/screen/list-table oracle fixture manifest" },
    { path: OWNERSHIP, role: "admin request/screen/list-table oracle fixture ownership manifest" },
    { path: RUNNER, role: "deterministic oracle/candidate runner and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-315-admin-request-screen-list-table-oracle-fixture",
    "npm run wp:core:wphx-315-admin-request-screen-list-table-oracle-fixture:check",
    "npm run receipts:validate"
  ],
  related_receipts: [
    "receipt:wphx-315-01-admin-common-list-table-surface",
    "receipt:wphx-315-02-admin-common-list-table-adapter-contract-candidate"
  ],
  validation_result: manifest.validation_result,
  manifest_sha256: sha256(manifestText),
  ownership_sha256: sha256(ownershipText)
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
