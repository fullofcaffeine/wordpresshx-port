#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.21.4",
  external_ref: "WPHX-315.04",
  title: "WPHX-315.04 - Add admin menus notices output oracle fixture"
};
const RECORDED_AT = "2026-07-03T17:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-admin-menu-notice-output-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-315-04";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-315-04-admin-menu-notice-output-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-315-04-admin-menu-notice-output-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-315-04-admin-menu-notice-output-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-315-01-admin-common-list-table-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-315-02-admin-common-list-table-adapter-contract-candidate.v1.json";
const REQUEST_FIXTURE = "manifests/wp-core/wphx-315-03-admin-request-screen-list-table-oracle-fixture.v1.json";

const SOURCE_FILES = [
  "src/wp-admin/includes/plugin.php",
  "src/wp-admin/includes/misc.php",
  "src/wp-admin/includes/update.php",
  "src/wp-includes/functions.php",
  "src/wp-includes/update.php"
];
const SUPPORT_STUBS = ["wp-includes/option.php"];
const COVERED_SYMBOLS = [
  "add_menu_page",
  "add_submenu_page",
  "remove_menu_page",
  "remove_submenu_page",
  "menu_page_url",
  "get_admin_page_parent",
  "get_admin_page_title",
  "user_can_access_admin_page",
  "wp_get_admin_notice",
  "wp_admin_notice",
  "wp_admin_viewport_meta",
  "wp_admin_canonical_url",
  "wp_color_scheme_settings",
  "wp_print_admin_notice_templates",
  "wp_get_update_data",
  "get_core_updates",
  "wp_get_translation_updates"
];
const CASES = [
  { id: "menu:registration-order", focus: "top-level menu registration, collision positions, submenu insertion/order, callbacks, parent pages, and no-priv tracking" },
  { id: "menu:lookup-removal", focus: "menu_page_url, parent/title lookup, access checks, submenu removal, and top-level removal" },
  { id: "notice:markup-output", focus: "admin notice argument/markup filters, attributes, dismissible classes, echoed output, and doing-it-wrong hook" },
  { id: "common-output:viewport-canonical-color", focus: "viewport meta filter, canonical URL cleanup output, and admin color scheme JavaScript" },
  { id: "update-output:data-templates", focus: "update counts/title aggregation and admin notice JavaScript templates" }
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
  const optionStub = `${root}/wp-includes/option.php`;
  mkdirSync(dirname(optionStub), { recursive: true });
  writeFileSync(
    optionStub,
    `<?php
function get_option( $name, $default = false ) {
\t$values = array( 'blog_charset' => 'UTF-8', 'siteurl' => 'https://example.test' );
\treturn array_key_exists( $name, $values ) ? $values[ $name ] : $default;
}
function get_site_option( $name, $default = false ) {
\tif ( 'dismissed_update_core' === $name ) {
\t\treturn array();
\t}
\treturn $default;
}
function get_site_transient( $transient ) {
\tif ( 'update_core' === $transient ) {
\t\treturn (object) array(
\t\t\t'updates' => array( (object) array( 'response' => 'upgrade', 'current' => '7.0.1', 'locale' => 'en_US' ) ),
\t\t\t'translations' => array( array( 'language' => 'es_MX', 'type' => 'core' ) ),
\t\t);
\t}
\tif ( 'update_plugins' === $transient ) {
\t\treturn (object) array(
\t\t\t'response' => array( 'hello/hello.php' => (object) array( 'new_version' => '2.0.0' ), 'akismet/akismet.php' => (object) array( 'new_version' => '6.0.0' ) ),
\t\t\t'translations' => array(),
\t\t);
\t}
\tif ( 'update_themes' === $transient ) {
\t\treturn (object) array(
\t\t\t'response' => array( 'twentytwentyseven' => (object) array( 'new_version' => '1.1' ) ),
\t\t\t'translations' => array(),
\t\t);
\t}
\treturn false;
}
`
  );
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
define( 'MINUTE_IN_SECONDS', 60 );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'DAY_IN_SECONDS', 86400 );
define( 'MONTH_IN_SECONDS', 2592000 );

$_SERVER['HTTP_HOST'] = 'example.test';
$_SERVER['REQUEST_URI'] = '/wp-admin/admin.php?page=wphx-fixture&_wpnonce=abc&message=1';

$GLOBALS['wphx_case'] = $case;
$GLOBALS['wphx_filters'] = array();
$GLOBALS['wphx_actions'] = array();
$GLOBALS['wphx_callbacks'] = array();
$GLOBALS['wphx_caps'] = array(
\t'manage_options' => true,
\t'read' => true,
\t'forbidden' => false,
\t'update_plugins' => true,
\t'update_themes' => true,
\t'update_core' => true,
);
$GLOBALS['_wp_admin_css_colors'] = array(
\t'modern' => (object) array( 'icon_colors' => array( 'base' => '#1d2327', 'focus' => '#2271b1', 'current' => '#ffffff' ) ),
);

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_actions'][] = array( 'hook' => 'php_error', 'errno' => $errno, 'message' => $errstr, 'file' => basename( $errfile ), 'line' => $errline );
\t\treturn true;
\t}
);

function __( $text, $domain = 'default' ) { return $text; }
function _e( $text, $domain = 'default' ) { echo $text; }
function _n( $single, $plural, $number, $domain = 'default' ) { return 1 === (int) $number ? $single : $plural; }
function esc_attr( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function esc_html( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function esc_url( $url ) { return (string) $url; }
function wp_kses_post( $text ) { return $text; }
function wp_check_invalid_utf8( $text, $strip = false ) { return $text; }
function get_user_option( $option ) { return 'modern'; }

function wp_parse_str( $input_string, &$result ) {
\tparse_str( (string) $input_string, $result );
\t$result = apply_filters( 'wp_parse_str', $result );
}

function urlencode_deep( $value ) {
\tif ( is_array( $value ) ) {
\t\treturn array_map( 'urlencode_deep', $value );
\t}
\treturn is_scalar( $value ) ? urlencode( (string) $value ) : $value;
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

function has_action( $hook_name, $callback = false ) {
\treturn isset( $GLOBALS['wphx_callbacks'][ $hook_name ] ) ? 10 : false;
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
\tif ( isset( $GLOBALS['wphx_callbacks'][ $hook_name ] ) ) {
\t\tksort( $GLOBALS['wphx_callbacks'][ $hook_name ] );
\t\tforeach ( $GLOBALS['wphx_callbacks'][ $hook_name ] as $callbacks ) {
\t\t\tforeach ( $callbacks as $callback ) {
\t\t\t\tcall_user_func_array( $callback[0], array_slice( $args, 0, $callback[1] ) );
\t\t\t}
\t\t}
\t}
}

function current_user_can( $capability, ...$args ) {
\treturn (bool) ( $GLOBALS['wphx_caps'][ $capability ] ?? false );
}

function is_multisite() { return false; }
function is_network_admin() { return false; }
function wp_doing_ajax() { return false; }

function plugin_basename( $file ) {
\treturn ltrim( str_replace( '\\\\', '/', (string) $file ), '/' );
}

function sanitize_title( $title, $fallback_title = '', $context = 'save' ) {
\t$title = strtolower( trim( preg_replace( '/[^A-Za-z0-9_\\-]+/', '-', (string) $title ), '-' ) );
\treturn '' === $title ? $fallback_title : $title;
}

function set_url_scheme( $url, $scheme = null ) {
\treturn preg_replace( '/^https?:/', 'https:', (string) $url );
}

function admin_url( $path = '', $scheme = 'admin' ) {
\treturn 'https://example.test/wp-admin/' . ltrim( (string) $path, '/' );
}

function self_admin_url( $path = '', $scheme = 'admin' ) {
\treturn admin_url( $path, $scheme );
}

require $root . '/wp-includes/functions.php';
require $root . '/wp-includes/update.php';
require $root . '/wp-admin/includes/plugin.php';
require $root . '/wp-admin/includes/misc.php';
require $root . '/wp-admin/includes/update.php';

function wphx_fixture_callback() {
\techo '<p>callback</p>';
}

function wphx_reset_admin_menu() {
\t$GLOBALS['menu'] = array();
\t$GLOBALS['submenu'] = array();
\t$GLOBALS['admin_page_hooks'] = array();
\t$GLOBALS['_registered_pages'] = array();
\t$GLOBALS['_parent_pages'] = array();
\t$GLOBALS['_wp_real_parent_file'] = array();
\t$GLOBALS['_wp_menu_nopriv'] = array();
\t$GLOBALS['_wp_submenu_nopriv'] = array();
\t$GLOBALS['parent_file'] = '';
\t$GLOBALS['pagenow'] = 'admin.php';
\t$GLOBALS['plugin_page'] = null;
\t$GLOBALS['title'] = '';
}

function wphx_menu_summary() {
\t$menu = array();
\tforeach ( $GLOBALS['menu'] as $position => $item ) {
\t\t$menu[] = array( 'position' => (string) $position, 'title' => $item[0], 'capability' => $item[1], 'slug' => $item[2], 'page_title' => $item[3], 'hook' => $item[5], 'icon' => $item[6] );
\t}
\t$submenu = array();
\tforeach ( $GLOBALS['submenu'] as $parent => $items ) {
\t\t$submenu[ $parent ] = array_map(
\t\t\tfunction ( $item ) {
\t\t\t\treturn array( 'title' => $item[0], 'capability' => $item[1], 'slug' => $item[2], 'page_title' => $item[3] );
\t\t\t},
\t\t\tarray_values( $items )
\t\t);
\t}
\treturn array( 'menu' => $menu, 'submenu' => $submenu );
}

function wphx_normalize_html( $html ) {
\treturn trim( preg_replace( '/\\s+/', ' ', (string) $html ) );
}

function wphx_capture( $callback ) {
\tob_start();
\t$callback();
\treturn ob_get_clean();
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

switch ( $case ) {
\tcase 'menu:registration-order':
\t\twphx_reset_admin_menu();
\t\t$top = add_menu_page( 'Fixture Admin', 'Fixture', 'manage_options', 'wphx-fixture', 'wphx_fixture_callback', '', 65 );
\t\t$collision = add_menu_page( 'Second Admin', 'Second', 'manage_options', 'wphx-second', '', 'https://cdn.example/icon.svg', 65 );
\t\t$sub_first = add_submenu_page( 'wphx-fixture', 'Sub First', 'Sub First', 'manage_options', 'wphx-sub-first', 'wphx_fixture_callback', 0 );
\t\t$sub_later = add_submenu_page( 'wphx-fixture', 'Sub Later', 'Sub Later', 'manage_options', 'wphx-sub-later', '', 5 );
\t\t$denied = add_submenu_page( 'wphx-fixture', 'Denied', 'Denied', 'forbidden', 'wphx-denied', '', 1 );
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'hooks' => compact( 'top', 'collision', 'sub_first', 'sub_later', 'denied' ),
\t\t\t\t'summary' => wphx_menu_summary(),
\t\t\t\t'registered_pages' => array_keys( $GLOBALS['_registered_pages'] ),
\t\t\t\t'parent_pages' => $GLOBALS['_parent_pages'],
\t\t\t\t'nopriv' => $GLOBALS['_wp_submenu_nopriv'],
\t\t\t)
\t\t);
\t\tbreak;

\tcase 'menu:lookup-removal':
\t\twphx_reset_admin_menu();
\t\tadd_menu_page( 'Fixture Admin', 'Fixture', 'manage_options', 'wphx-fixture', 'wphx_fixture_callback', '', 65 );
\t\tadd_submenu_page( 'wphx-fixture', 'Sub First', 'Sub First', 'manage_options', 'wphx-sub-first', 'wphx_fixture_callback', 0 );
\t\t$GLOBALS['plugin_page'] = 'wphx-sub-first';
\t\t$_GET['page'] = 'wphx-sub-first';
\t\t$url = menu_page_url( 'wphx-sub-first', false );
\t\t$parent = get_admin_page_parent();
\t\t$title = get_admin_page_title();
\t\t$access = user_can_access_admin_page();
\t\t$removed_sub = remove_submenu_page( 'wphx-fixture', 'wphx-sub-first' );
\t\t$removed_top = remove_menu_page( 'wphx-fixture' );
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'url' => $url,
\t\t\t\t'parent' => $parent,
\t\t\t\t'title' => $title,
\t\t\t\t'access' => $access,
\t\t\t\t'removed_sub' => $removed_sub,
\t\t\t\t'removed_top' => $removed_top,
\t\t\t\t'after' => wphx_menu_summary(),
\t\t\t)
\t\t);
\t\tbreak;

\tcase 'notice:markup-output':
\t\tadd_filter(
\t\t\t'wp_admin_notice_args',
\t\t\tfunction ( $args, $message ) {
\t\t\t\t$args['additional_classes'][] = 'filtered';
\t\t\t\treturn $args;
\t\t\t},
\t\t\t10,
\t\t\t2
\t\t);
\t\tadd_filter(
\t\t\t'wp_admin_notice_markup',
\t\t\tfunction ( $markup, $message, $args ) {
\t\t\t\treturn $markup . '<!--filtered-->';
\t\t\t},
\t\t\t10,
\t\t\t3
\t\t);
\t\t$markup = wp_get_admin_notice(
\t\t\t'Filtered <strong>message</strong>',
\t\t\tarray(
\t\t\t\t'type' => 'success',
\t\t\t\t'dismissible' => true,
\t\t\t\t'id' => 'fixture-notice',
\t\t\t\t'additional_classes' => array( 'extra' ),
\t\t\t\t'attributes' => array( 'data-kind' => 'fixture', 'hidden' => false, 'role' => 'status' ),
\t\t\t)
\t\t);
\t\t$echoed = wphx_capture(
\t\t\tfunction () {
\t\t\t\twp_admin_notice( 'Echoed notice', array( 'type' => 'warning', 'paragraph_wrap' => false ) );
\t\t\t}
\t\t);
\t\t$bad = wp_get_admin_notice( 'Bad type', array( 'type' => 'bad type' ) );
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'markup' => wphx_normalize_html( $markup ),
\t\t\t\t'echoed' => wphx_normalize_html( $echoed ),
\t\t\t\t'bad_type' => wphx_normalize_html( $bad ),
\t\t\t\t'contains' => array(
\t\t\t\t\t'dismissible' => str_contains( $markup, 'is-dismissible' ),
\t\t\t\t\t'filtered' => str_contains( $markup, '<!--filtered-->' ),
\t\t\t\t\t'role' => str_contains( $markup, 'role="status"' ),
\t\t\t\t),
\t\t\t)
\t\t);
\t\tbreak;

\tcase 'common-output:viewport-canonical-color':
\t\tadd_filter(
\t\t\t'admin_viewport_meta',
\t\t\tfunction ( $meta ) {
\t\t\t\treturn $meta . ',viewport-fit=cover';
\t\t\t}
\t\t);
\t\tadd_filter(
\t\t\t'wp_admin_canonical_url',
\t\t\tfunction ( $url ) {
\t\t\t\treturn $url . '#filtered';
\t\t\t}
\t\t);
\t\t$output = wphx_capture(
\t\t\tfunction () {
\t\t\t\twp_admin_viewport_meta();
\t\t\t\twp_admin_canonical_url();
\t\t\t\twp_color_scheme_settings();
\t\t\t}
\t\t);
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'output' => wphx_normalize_html( $output ),
\t\t\t\t'contains' => array(
\t\t\t\t\t'viewport' => str_contains( $output, 'viewport-fit=cover' ),
\t\t\t\t\t'canonical' => str_contains( $output, 'wp-admin-canonical' ),
\t\t\t\t\t'nonce_removed' => ! str_contains( $output, '_wpnonce' ),
\t\t\t\t\t'color_scheme' => str_contains( $output, '_wpColorScheme' ),
\t\t\t\t),
\t\t\t)
\t\t);
\t\tbreak;

\tcase 'update-output:data-templates':
\t\t$data = wp_get_update_data();
\t\t$templates = wphx_capture( 'wp_print_admin_notice_templates' );
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'counts' => $data['counts'],
\t\t\t\t'titles' => $data['title'],
\t\t\t\t'templates_sha256' => 'sha256:' . hash( 'sha256', wphx_normalize_html( $templates ) ),
\t\t\t\t'contains' => array(
\t\t\t\t\t'admin_notice_template' => str_contains( $templates, 'tmpl-wp-updates-admin-notice' ),
\t\t\t\t\t'bulk_notice_template' => str_contains( $templates, 'tmpl-wp-bulk-updates-admin-notice' ),
\t\t\t\t\t'screen_reader' => str_contains( $templates, 'Show more details' ),
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
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-315-admin-menu-notice-output-oracle-fixture`);
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
    hooks: run.hooks,
    summary: run.summary,
    registered_pages: run.registered_pages,
    parent_pages: run.parent_pages,
    nopriv: run.nopriv,
    url: run.url,
    parent: run.parent,
    title: run.title,
    access: run.access,
    removed_sub: run.removed_sub,
    removed_top: run.removed_top,
    after: run.after,
    markup: run.markup,
    echoed: run.echoed,
    bad_type: run.bad_type,
    output: run.output,
    counts: run.counts,
    titles: run.titles,
    templates_sha256: run.templates_sha256,
    contains: run.contains,
    filters: run.filters,
    actions: run.actions
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
  schema: "wphx.wp-core-admin-menu-notice-output-oracle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_class: "oracle_source_mirror",
  artifact_scope: "helper",
  inputs: {
    surface: inputRecord(SURFACE),
    adapter_contract: inputRecord(CONTRACT),
    request_screen_fixture: inputRecord(REQUEST_FIXTURE),
    source_files: SOURCE_FILES.map(sourceRecord),
    support_stubs: SUPPORT_STUBS
  },
  fixture: {
    source_files: SOURCE_FILES,
    support_stubs: SUPPORT_STUBS,
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
        "Replace copied candidate PHP with Haxe-owned menu, notice, common output, and generated original-path adapter evidence before claiming public PHP ownership."
    }
  },
  runs,
  remaining_gaps: [
    {
      id: "full-admin-header-footer-not-covered",
      owner: ISSUE.external_ref,
      detail:
        "This fixture covers shared menu, notice, viewport/canonical/color, update-data, and notice-template helpers. Full admin-header.php/admin-footer.php, iframe header/footer, screen-meta rendering, asset queues, and browser behavior remain installed/admin-shell work."
    },
    {
      id: "installed-admin-distribution-not-covered",
      owner: ISSUE.external_ref,
      detail:
        "No installed wp-admin request, browser, database-backed menu/list table, real user/capability/nonce/session, admin Ajax, e2e, or upstream PHPUnit pass/pass behavior is claimed."
    },
    {
      id: "public-php-adapter-not-generated",
      owner: ISSUE.external_ref,
      detail:
        "No original-path admin menu, notice, header/footer, update, or common-output adapter replacement is claimed; candidate files are copied upstream PHP source for bridge evidence."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    case_count: runs.length,
    covered_symbol_count: COVERED_SYMBOLS.length,
    source_file_count: SOURCE_FILES.length,
    support_stub_count: SUPPORT_STUBS.length,
    oracle_candidate_match: allMatched,
    public_php_replacement_claimed: false,
    installed_admin_parity_claimed: false,
    browser_or_editor_ownership_claimed: false
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const ownership = {
  schema: "wphx.ownership-manifest.v1",
  manifest_id: "ownership:wp-core/admin-menu-notice-output-oracle-fixture",
  issue: {
    id: ISSUE.id,
    external_ref: ISSUE.external_ref
  },
  unit: {
    kind: "oracle_fixture",
    name: "admin menu/submenu registration, notices, viewport/canonical/color output, update data, and notice-template behavior",
    area: "wp-admin/includes/plugin.php wp-admin/includes/misc.php wp-admin/includes/update.php wp-includes/functions.php wp-includes/update.php",
    public_contract:
      "This fixture mirrors upstream WordPress PHP into oracle and candidate roots to capture selected admin menu, notice, and common output behavior. It does not claim Haxe-owned runtime logic or public PHP ABI replacement."
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
      "Promote admin menu/notice/output decisions into Haxe-owned implementation and generated original-path PHP adapters, then rerun admin request, upstream PHPUnit/e2e, and installed distribution gates."
  },
  owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
  generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
  verification: {
    oracle_commands: [
      "npm run wp:core:wphx-315-admin-menu-notice-output-oracle-fixture",
      "npm run wp:core:wphx-315-admin-menu-notice-output-oracle-fixture:check",
      "npm run receipts:validate"
    ],
    receipt_refs: ["receipt:wphx-315-04-admin-menu-notice-output-oracle-fixture"],
    manifest_digest: sha256(manifestText)
  },
  notes:
    "The probe stubs surrounding WordPress services deliberately to keep selected copied PHP behavior deterministic; this is bridge evidence, not complete WPHX-315 ownership."
};
const ownershipText = JSON.stringify(ownership, null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-315-04-admin-menu-notice-output-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "admin menu/notice/output oracle fixture manifest" },
    { path: OWNERSHIP, role: "admin menu/notice/output oracle fixture ownership manifest" },
    { path: RUNNER, role: "deterministic oracle/candidate runner and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-315-admin-menu-notice-output-oracle-fixture",
    "npm run wp:core:wphx-315-admin-menu-notice-output-oracle-fixture:check",
    "npm run receipts:validate"
  ],
  related_receipts: [
    "receipt:wphx-315-01-admin-common-list-table-surface",
    "receipt:wphx-315-02-admin-common-list-table-adapter-contract-candidate",
    "receipt:wphx-315-03-admin-request-screen-list-table-oracle-fixture"
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
