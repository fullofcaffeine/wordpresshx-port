#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.17.8",
  external_ref: "WPHX-310.08",
  title: "WPHX-310.08 — Add nav-menu oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-nav-menu-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-310-08";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-310-08-nav-menu-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-310-08-nav-menu-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-310-08-nav-menu-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-310-01-themes-template-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-310-02-theme-template-adapter-contract-candidate.v1.json";
const NAV_SURFACE = "manifests/wp-core/wphx-310-06-theme-customizer-widget-nav-surface.v1.json";

const SOURCE_FILES = [
  "src/wp-includes/class-wp-walker.php",
  "src/wp-includes/class-walker-nav-menu.php",
  "src/wp-includes/nav-menu.php",
  "src/wp-includes/nav-menu-template.php"
];
const COVERED_SYMBOLS = [
  "register_nav_menus",
  "get_registered_nav_menus",
  "get_nav_menu_locations",
  "has_nav_menu",
  "wp_get_nav_menu_object",
  "wp_get_nav_menu_name",
  "wp_get_nav_menus",
  "wp_get_nav_menu_items",
  "wp_setup_nav_menu_item",
  "wp_nav_menu",
  "walk_nav_menu_tree",
  "Walker_Nav_Menu::start_el",
  "Walker_Nav_Menu::start_lvl",
  "_nav_menu_item_id_use_once",
  "wp_nav_menu_remove_menu_item_has_children_class"
];
const FIXTURE_CASES = [
  { id: "locations:registration-and-name", focus: "registered menu locations, assigned menu detection, and location name lookup" },
  { id: "menu:object-lookup", focus: "wp_get_nav_menu_object resolves menus by id, slug, name, and object" },
  { id: "items:setup-and-sort", focus: "wp_get_nav_menu_items decorates custom link posts, filters invalid items, and normalizes menu_order" },
  { id: "render:wp-nav-menu", focus: "wp_nav_menu renders container, list, parent/child items, attributes, and menu filters" },
  { id: "render:depth-limited", focus: "depth=1 rendering removes bottom-level menu-item-has-children through default nav filter" },
  { id: "walker:direct-tree", focus: "walk_nav_menu_tree renders nested output using Walker_Nav_Menu directly" }
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

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'ARRAY_A', 'ARRAY_A' );
define( 'OBJECT', 'OBJECT' );

$_SERVER['HTTP_HOST'] = 'example.test';
$_SERVER['REQUEST_URI'] = '/';

$GLOBALS['wp_actions'] = array();
$GLOBALS['wp_filter'] = array();
$GLOBALS['wphx_310_08_actions'] = array();
$GLOBALS['wphx_310_08_filters'] = array();
$GLOBALS['wphx_310_08_errors'] = array();
$GLOBALS['wphx_310_08_theme_supports'] = array();
$GLOBALS['_wp_registered_nav_menus'] = array();
$GLOBALS['wphx_310_08_theme_mods'] = array( 'nav_menu_locations' => array( 'primary' => 42 ) );
$GLOBALS['wphx_310_08_terms'] = array(
\t42 => null,
);
$GLOBALS['wphx_310_08_menu_posts'] = array();
$GLOBALS['wphx_310_08_meta'] = array(
\t100 => array(
\t\t'_menu_item_menu_item_parent' => '0',
\t\t'_menu_item_object_id' => '0',
\t\t'_menu_item_object' => 'custom',
\t\t'_menu_item_type' => 'custom',
\t\t'_menu_item_url' => 'https://example.test/',
\t\t'_menu_item_target' => '',
\t\t'_menu_item_classes' => array( 'root-link' ),
\t\t'_menu_item_xfn' => '',
\t),
\t101 => array(
\t\t'_menu_item_menu_item_parent' => '100',
\t\t'_menu_item_object_id' => '0',
\t\t'_menu_item_object' => 'custom',
\t\t'_menu_item_type' => 'custom',
\t\t'_menu_item_url' => 'https://example.test/about/',
\t\t'_menu_item_target' => '_self',
\t\t'_menu_item_classes' => array( 'child-link' ),
\t\t'_menu_item_xfn' => 'friend',
\t),
\t102 => array(
\t\t'_menu_item_menu_item_parent' => '0',
\t\t'_menu_item_object_id' => '0',
\t\t'_menu_item_object' => 'custom',
\t\t'_menu_item_type' => 'custom',
\t\t'_menu_item_url' => '',
\t\t'_menu_item_target' => '',
\t\t'_menu_item_classes' => array( 'invalid-link' ),
\t\t'_menu_item_xfn' => '',
\t),
);

$GLOBALS['wphx_310_08_terms'][42] = (object) array(
\t'term_id' => 42,
\t'term_taxonomy_id' => 420,
\t'name' => 'Fixture Menu',
\t'slug' => 'fixture-menu',
\t'taxonomy' => 'nav_menu',
\t'count' => 3,
);
$GLOBALS['wphx_310_08_menu_posts'] = array(
\t(object) array(
\t\t'ID' => 100,
\t\t'post_type' => 'nav_menu_item',
\t\t'post_status' => 'publish',
\t\t'post_title' => 'Home',
\t\t'post_excerpt' => 'Home title',
\t\t'post_content' => 'Home description',
\t\t'post_parent' => 0,
\t\t'menu_order' => 1,
\t),
\t(object) array(
\t\t'ID' => 101,
\t\t'post_type' => 'nav_menu_item',
\t\t'post_status' => 'publish',
\t\t'post_title' => 'About',
\t\t'post_excerpt' => 'About title',
\t\t'post_content' => 'About description',
\t\t'post_parent' => 0,
\t\t'menu_order' => 2,
\t),
\t(object) array(
\t\t'ID' => 102,
\t\t'post_type' => 'nav_menu_item',
\t\t'post_status' => 'publish',
\t\t'post_title' => 'Broken',
\t\t'post_excerpt' => '',
\t\t'post_content' => '',
\t\t'post_parent' => 0,
\t\t'menu_order' => 3,
\t\t'_invalid' => true,
\t),
);

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_310_08_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

class WP_Error {}
class WP_Query {
\tpublic $queried_object_id = 0;
\tpublic $is_singular = false;
\tpublic $is_home = false;
\tpublic $is_category = false;
\tpublic $is_tag = false;
\tpublic $is_tax = false;
\tpublic $is_page = false;
\tpublic function get_queried_object() {
\t\treturn (object) array();
\t}
}
$GLOBALS['wp_query'] = new WP_Query();
$GLOBALS['wp_rewrite'] = (object) array( 'index' => 'index.php' );

function __( $text ) { return $text; }
function _doing_it_wrong( $function_name, $message, $version ) {
\t$GLOBALS['wphx_310_08_errors'][] = array( 'doing_it_wrong' => $function_name, 'version' => $version, 'message' => $message );
}
function add_action( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wp_filter'][ $hook_name ][ $priority ][] = array( 'callback' => $callback, 'accepted_args' => $accepted_args );
}
function add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\tadd_action( $hook_name, $callback, $priority, $accepted_args );
}
function remove_action( $hook_name, $callback, $priority = 10 ) { return true; }
function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wp_actions'][ $hook_name ] = ( $GLOBALS['wp_actions'][ $hook_name ] ?? 0 ) + 1;
\t$GLOBALS['wphx_310_08_actions'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) );
}
function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_310_08_filters'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) + 1 );
\tif ( empty( $GLOBALS['wp_filter'][ $hook_name ] ) ) {
\t\treturn $value;
\t}
\tksort( $GLOBALS['wp_filter'][ $hook_name ] );
\tforeach ( $GLOBALS['wp_filter'][ $hook_name ] as $callbacks ) {
\t\tforeach ( $callbacks as $callback ) {
\t\t\t$params = array_slice( array_merge( array( $value ), $args ), 0, $callback['accepted_args'] );
\t\t\t$value = call_user_func_array( $callback['callback'], $params );
\t\t}
\t}
\treturn $value;
}
function wp_parse_args( $args, $defaults = array() ) {
\tif ( is_object( $args ) ) {
\t\t$args = get_object_vars( $args );
\t}
\tif ( ! is_array( $args ) ) {
\t\tparse_str( (string) $args, $args );
\t}
\treturn array_merge( $defaults, $args );
}
function add_theme_support( $feature ) { $GLOBALS['wphx_310_08_theme_supports'][ $feature ] = true; }
function _remove_theme_support( $feature ) { unset( $GLOBALS['wphx_310_08_theme_supports'][ $feature ] ); }
function get_theme_mod( $name, $default = false ) { return $GLOBALS['wphx_310_08_theme_mods'][ $name ] ?? $default; }
function set_theme_mod( $name, $value ) { $GLOBALS['wphx_310_08_theme_mods'][ $name ] = $value; }
function get_option( $name, $default = false ) { return $default; }
function delete_option( $name ) { return true; }
function is_wp_error( $thing ) { return $thing instanceof WP_Error; }
function is_admin() { return false; }
function taxonomy_exists( $taxonomy ) { return 'nav_menu' === $taxonomy; }
function get_term( $term, $taxonomy = '' ) {
\tif ( is_object( $term ) ) {
\t\treturn $term;
\t}
\t$term = (int) $term;
\treturn $GLOBALS['wphx_310_08_terms'][ $term ] ?? null;
}
function get_term_by( $field, $value, $taxonomy = '' ) {
\tforeach ( $GLOBALS['wphx_310_08_terms'] as $term ) {
\t\tif ( $term && isset( $term->{$field} ) && (string) $term->{$field} === (string) $value ) {
\t\t\treturn $term;
\t\t}
\t}
\treturn false;
}
function get_terms( $args = array() ) { return array_values( array_filter( $GLOBALS['wphx_310_08_terms'] ) ); }
function get_posts( $args = array() ) { return $GLOBALS['wphx_310_08_menu_posts']; }
function get_post_meta( $post_id, $key = '', $single = false ) {
\t$value = $GLOBALS['wphx_310_08_meta'][ $post_id ][ $key ] ?? '';
\treturn $single ? $value : array( $value );
}
function get_post_type( $post_id ) { return 'nav_menu_item'; }
function get_post_type_object( $post_type ) {
\treturn (object) array( 'name' => $post_type, 'labels' => (object) array( 'singular_name' => ucfirst( $post_type ), 'archives' => ucfirst( $post_type ) . ' Archives' ), 'description' => '' );
}
function get_post_status( $post_id ) { return 'publish'; }
function get_post( $post_id ) { return null; }
function get_permalink( $post_id ) { return 'https://example.test/?p=' . (int) $post_id; }
function get_taxonomy( $taxonomy ) { return (object) array( 'name' => $taxonomy, 'labels' => (object) array( 'singular_name' => ucfirst( $taxonomy ) ) ); }
function get_term_link( $term, $taxonomy = '' ) { return 'https://example.test/term/' . ( is_object( $term ) ? $term->term_id : $term ); }
function get_term_field( $field, $term_id, $taxonomy = '' ) { return ''; }
function wp_trim_words( $text, $num_words = 55, $more = null ) { return (string) $text; }
function wp_strip_all_tags( $text ) { return strip_tags( (string) $text ); }
function wp_list_sort( $list, $orderby = array() ) {
\t$key = array_key_first( $orderby );
\tusort( $list, static fn( $a, $b ) => ( $a->{$key} ?? 0 ) <=> ( $b->{$key} ?? 0 ) );
\treturn $list;
}
function esc_attr( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES ); }
function esc_url( $value ) { return (string) $value; }
function home_url( $path = '' ) { return 'https://example.test' . $path; }
function untrailingslashit( $value ) { return rtrim( (string) $value, '/' ); }
function trailingslashit( $value ) { return rtrim( (string) $value, '/' ) . '/'; }
function is_post_type_hierarchical( $post_type ) { return false; }
function get_object_taxonomies( $post_type ) { return array(); }
function is_taxonomy_hierarchical( $taxonomy ) { return false; }
function _get_term_hierarchy( $taxonomy ) { return array(); }
function wp_get_object_terms( $object_id, $taxonomy, $args = array() ) { return array(); }
function is_post_type_archive( $post_types = array() ) { return false; }
function is_customize_preview() { return false; }
function set_url_scheme( $url ) { return preg_replace( '#^http://#', 'https://', $url ); }
function is_front_page() { return false; }
function get_privacy_policy_url() { return 'https://example.test/privacy/'; }

require ABSPATH . WPINC . '/class-wp-walker.php';
require ABSPATH . WPINC . '/nav-menu.php';
require ABSPATH . WPINC . '/nav-menu-template.php';

add_filter( 'nav_menu_item_id', '_nav_menu_item_id_use_once', 10, 2 );
add_filter( 'nav_menu_css_class', 'wp_nav_menu_remove_menu_item_has_children_class', 10, 4 );

register_nav_menus( array( 'primary' => 'Primary Menu' ) );
$menu_by_id = wp_get_nav_menu_object( 42 );
$menu_by_slug = wp_get_nav_menu_object( 'fixture-menu' );
$menu_by_name = wp_get_nav_menu_object( 'Fixture Menu' );
$menu_by_object = wp_get_nav_menu_object( $menu_by_id );
$menu_name = wp_get_nav_menu_name( 'primary' );
$has_primary = has_nav_menu( 'primary' );
$has_footer = has_nav_menu( 'footer' );
$items = wp_get_nav_menu_items( 42 );

$nav_output = wp_nav_menu(
\tarray(
\t\t'theme_location' => 'primary',
\t\t'echo' => false,
\t\t'container' => 'nav',
\t\t'container_class' => 'fixture-container',
\t\t'container_aria_label' => 'Fixture navigation',
\t\t'menu_class' => 'fixture-menu',
\t\t'item_spacing' => 'discard',
\t)
);
$depth_output = wp_nav_menu(
\tarray(
\t\t'theme_location' => 'primary',
\t\t'echo' => false,
\t\t'container' => false,
\t\t'depth' => 1,
\t\t'item_spacing' => 'discard',
\t)
);
$walker_output = walk_nav_menu_tree( $items, 0, (object) array(
\t'before' => '',
\t'after' => '',
\t'link_before' => '',
\t'link_after' => '',
\t'item_spacing' => 'discard',
\t'depth' => 0,
) );

$cases = array(
\t'locations:registration-and-name' => array(
\t\t'registered' => get_registered_nav_menus(),
\t\t'locations' => get_nav_menu_locations(),
\t\t'has_primary' => $has_primary,
\t\t'has_footer' => $has_footer,
\t\t'menu_name' => $menu_name,
\t\t'theme_support_menus' => ! empty( $GLOBALS['wphx_310_08_theme_supports']['menus'] ),
\t),
\t'menu:object-lookup' => array(
\t\t'id' => $menu_by_id ? $menu_by_id->term_id : null,
\t\t'slug' => $menu_by_slug ? $menu_by_slug->slug : null,
\t\t'name' => $menu_by_name ? $menu_by_name->name : null,
\t\t'object_identity' => $menu_by_object ? $menu_by_object->term_id : null,
\t\t'missing' => wp_get_nav_menu_object( 'missing-menu' ),
\t),
\t'items:setup-and-sort' => array(
\t\t'count' => count( $items ),
\t\t'ids' => array_map( static fn( $item ) => $item->ID, $items ),
\t\t'orders' => array_map( static fn( $item ) => $item->menu_order, $items ),
\t\t'parents' => array_map( static fn( $item ) => (string) $item->menu_item_parent, $items ),
\t\t'titles' => array_map( static fn( $item ) => $item->title, $items ),
\t\t'urls' => array_map( static fn( $item ) => $item->url, $items ),
\t),
\t'render:wp-nav-menu' => array(
\t\t'has_nav_container' => str_contains( $nav_output, '<nav class="fixture-container" aria-label="Fixture navigation">' ),
\t\t'has_menu_class' => str_contains( $nav_output, 'class="fixture-menu"' ),
\t\t'has_parent_class' => str_contains( $nav_output, 'menu-item-has-children' ),
\t\t'has_submenu' => str_contains( $nav_output, '<ul class="sub-menu">' ),
\t\t'has_home_link' => str_contains( $nav_output, 'href="https://example.test/"' ),
\t\t'has_about_link' => str_contains( $nav_output, 'href="https://example.test/about/"' ),
\t\t'sha256' => hash( 'sha256', $nav_output ),
\t),
\t'render:depth-limited' => array(
\t\t'has_child_title' => str_contains( $depth_output, 'About' ),
\t\t'has_has_children_class' => str_contains( $depth_output, 'menu-item-has-children' ),
\t\t'sha256' => hash( 'sha256', $depth_output ),
\t),
\t'walker:direct-tree' => array(
\t\t'has_nested_list' => str_contains( $walker_output, '<ul class="sub-menu">' ),
\t\t'has_home' => str_contains( $walker_output, 'Home' ),
\t\t'has_about' => str_contains( $walker_output, 'About' ),
\t\t'sha256' => hash( 'sha256', $walker_output ),
\t),
);

ksort( $cases );
echo json_encode(
\tarray(
\t\t'cases' => $cases,
\t\t'actions' => $GLOBALS['wphx_310_08_actions'],
\t\t'filters' => $GLOBALS['wphx_310_08_filters'],
\t\t'php_errors' => $GLOBALS['wphx_310_08_errors'],
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
);
`
  );
}

function runProbe(root) {
  return JSON.parse(command("php", [PROBE, root]));
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-310-nav-menu-oracle-fixture`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/nav-menu-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "Nav-menu lookup, item setup, walker, and front-end rendering behavior",
      area: SOURCE_FILES.join(" "),
      public_contract:
        "This fixture executes copied WordPress 7.0 nav-menu source against deterministic in-process terms, posts, post meta, theme locations, and request context. It does not claim generated public PHP replacement, admin nav-menu screen parity, database-backed CRUD parity, Customizer nav-menu parity, or installed rendering parity."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-haxe-adapter-contract-foundation",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass admin nav-menu, database-backed CRUD, Customizer nav-menu, installed rendering/admin, and selected upstream nav-menu PHPUnit gates before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-310-nav-menu-oracle-fixture",
        "npm run wp:core:wphx-310-nav-menu-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-310-08-nav-menu-oracle-fixture"],
      manifest_digest: manifestSha
    }
  };
}

rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
writeProbe();

const oracle = runProbe(ORACLE_ROOT);
const candidate = runProbe(CANDIDATE_ROOT);
const observationsMatch = JSON.stringify(oracle) === JSON.stringify(candidate);

if (!observationsMatch) {
  console.error(JSON.stringify({ status: "failed", oracle, candidate }, null, 2));
  process.exit(1);
}

const phpLint = SOURCE_FILES.map((path) => ({
  path,
  oracle_lint: command("php", ["-l", mirrorPath(ORACLE_ROOT, path)]),
  candidate_lint: command("php", ["-l", mirrorPath(CANDIDATE_ROOT, path)])
}));

const manifest = {
  schema: "wphx.wp-core-nav-menu-oracle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["oracle_source_mirror", "candidate_package_mirror"],
  artifact_scope: "fixture",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT),
    nav_surface_manifest: inputRecord(NAV_SURFACE),
    runner: inputRecord(RUNNER),
    upstream_sources: SOURCE_FILES.map(sourceRecord)
  },
  fixture: {
    cases: FIXTURE_CASES,
    covered_symbols: COVERED_SYMBOLS,
    source_files: SOURCE_FILES,
    probe: { path: PROBE, sha256: sha256File(PROBE) },
    public_abi_policy: {
      public_php_replacement_claimed: false,
      copied_oracle_public_php: true,
      adapter_contract_foundation: CONTRACT,
      installed_wordpress_behavior_claimed: false
    }
  },
  build: {
    oracle_root: ORACLE_ROOT,
    candidate_root: CANDIDATE_ROOT,
    php_lint: phpLint
  },
  observations: {
    oracle,
    candidate,
    match: observationsMatch,
    oracle_sha256: sha256(JSON.stringify(oracle)),
    candidate_sha256: sha256(JSON.stringify(candidate))
  },
  remaining_gaps: [
    {
      id: "database-backed-nav-menu-crud-not-executed",
      owner: ISSUE.external_ref,
      detail:
        "The fixture uses deterministic in-memory terms, posts, and post meta. wp_create_nav_menu, wp_update_nav_menu_item, wp_delete_nav_menu, term/post persistence, and cache invalidation remain later DB-backed gates."
    },
    {
      id: "admin-and-customizer-nav-menu-behavior-not-executed",
      owner: ISSUE.external_ref,
      detail:
        "Admin nav-menu screens, Customizer nav-menu controls/settings, AJAX nonce/capability checks, and installed rendering remain later gates."
    },
    {
      id: "public-php-adapter-not-yet-generated",
      owner: ISSUE.external_ref,
      detail:
        "Nav-menu PHP files are copied oracle source in this fixture; generated original-path PHP replacement remains a later cross-domain gate."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    fixture_cases: FIXTURE_CASES.length,
    covered_symbols: COVERED_SYMBOLS.length,
    observations_match: observationsMatch,
    public_php_replacement_claimed: false
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-310-08-nav-menu-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "nav-menu oracle-source-mirror fixture manifest" },
    { path: OWNERSHIP, role: "ownership manifest for copied-oracle nav-menu boundary" },
    { path: RUNNER, role: "deterministic oracle/candidate fixture generator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-310-nav-menu-oracle-fixture",
    "npm run wp:core:wphx-310-nav-menu-oracle-fixture:check",
    "npm run receipts:validate",
    "npm run beads:validate"
  ],
  related_receipts: [
    "receipt:wphx-310-01-themes-template-surface",
    "receipt:wphx-310-02-theme-template-adapter-contract-candidate",
    "receipt:wphx-310-06-theme-customizer-widget-nav-surface",
    "receipt:wphx-310-07-widget-sidebar-oracle-fixture"
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
      fixture_cases: FIXTURE_CASES.length,
      observations_match: observationsMatch
    },
    null,
    2
  )
);
