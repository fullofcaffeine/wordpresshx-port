#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.20.4",
  external_ref: "WPHX-314.10",
  title: "WPHX-314.10 - Add taxonomy/list core block renderer oracle fixture"
};
const RECORDED_AT = "2026-06-29T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-core-block-renderer-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-314-10";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const OUT = "manifests/wp-core/wphx-314-10-core-block-renderer-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-314-10-core-block-renderer-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-314-10-core-block-renderer-oracle-fixture.v1.json";
const PRIOR_EVIDENCE = [
  "manifests/wp-core/wphx-314-01-blocks-interactivity-surface.v1.json",
  "manifests/wp-core/wphx-314-02-blocks-interactivity-adapter-contract-candidate.v1.json",
  "manifests/wp-core/wphx-314-03-block-parser-render-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-04-block-supports-bindings-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-05-block-patterns-registry-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-06-block-hooks-insertion-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-07-style-engine-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-08-html-api-tag-processor-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-09-interactivity-api-oracle-fixture.v1.json"
];

const SOURCE_FILES = [
  "src/wp-includes/blocks/categories.php",
  "src/wp-includes/blocks/archives.php",
  "src/wp-includes/blocks/tag-cloud.php"
];
const COVERED_SYMBOLS = [
  "blocks/categories.php",
  "render_block_core_categories",
  "build_dropdown_script_block_core_categories",
  "register_block_core_categories",
  "blocks/archives.php",
  "render_block_core_archives",
  "block_core_archives_build_dropdown_script",
  "register_block_core_archives",
  "blocks/tag-cloud.php",
  "render_block_core_tag_cloud",
  "register_block_core_tag_cloud",
  "get_taxonomy",
  "wp_dropdown_categories",
  "wp_list_categories",
  "WP_HTML_Tag_Processor",
  "wp_get_archives",
  "wp_tag_cloud",
  "wp_get_inline_script_tag",
  "wp_unique_id",
  "get_block_wrapper_attributes",
  "register_block_type_from_metadata",
  "add_action"
];
const CASES = [
  { id: "core-renderers:categories-list-enhanced", focus: "category list args, wrapper classes, and enhanced pagination data-wp click attributes" },
  { id: "core-renderers:categories-dropdown-front", focus: "taxonomy dropdown args, label visibility, selected query var, and front-end inline script injection" },
  { id: "core-renderers:archives-list-empty", focus: "archives list args, empty archive fallback text, filter hook payload, and wrapper classes" },
  { id: "core-renderers:archives-dropdown-weekly", focus: "weekly archive dropdown label, unique id, option archive args, and inline script sourceURL" },
  { id: "core-renderers:tag-cloud-render", focus: "tag cloud font-size unit parsing, count flag, wrapper attributes, and rendered tag markup" },
  { id: "core-renderers:tag-cloud-empty-rest-registration", focus: "empty tag cloud REST placeholder plus add_action and metadata registration callbacks" }
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

function writeProbe(root) {
  writeFileSync(
    `${root}/probe.php`,
    `<?php
error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

$case = $argv[1] ?? '';
$GLOBALS['wphx_case'] = $case;
$GLOBALS['wphx_actions'] = array();
$GLOBALS['wphx_registrations'] = array();
$GLOBALS['wphx_filters'] = array();
$GLOBALS['wphx_wrappers'] = array();
$GLOBALS['wphx_category_calls'] = array();
$GLOBALS['wphx_archive_calls'] = array();
$GLOBALS['wphx_tag_cloud_calls'] = array();
$GLOBALS['wphx_inline_scripts'] = array();
$GLOBALS['wphx_unique_id'] = 0;
$GLOBALS['wphx_html_processor'] = array();

function __( $value ) { return $value; }
function esc_html( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' ); }
function esc_attr( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' ); }
function esc_url( $value ) {
\t$value = trim( (string) $value );
\tif ( preg_match( '/^javascript:/i', $value ) ) {
\t\treturn '';
\t}
\treturn strtr( $value, array( '<' => '%3C', '>' => '%3E', '"' => '%22', "'" => '%27' ) );
}
function wp_kses_post( $value ) { return (string) $value; }
function wp_json_encode( $value, $flags = 0, $depth = 512 ) { return json_encode( $value, $flags, $depth ); }
function home_url() { return 'https://example.test'; }
function is_admin() { return 'core-renderers:categories-dropdown-admin' === $GLOBALS['wphx_case']; }
function wp_is_serving_rest_request() { return 'core-renderers:tag-cloud-empty-rest-registration' === $GLOBALS['wphx_case']; }
function get_query_var( $name ) { return 'category_name' === $name ? 'news' : ''; }
function add_action( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wphx_actions'][] = compact( 'hook_name', 'callback', 'priority', 'accepted_args' );
\treturn true;
}
function apply_filters( $hook_name, $value ) {
\t$GLOBALS['wphx_filters'][] = array( 'hook_name' => $hook_name, 'value' => $value );
\treturn $value;
}
function register_block_type_from_metadata( $path, $args = array() ) {
\t$GLOBALS['wphx_registrations'][] = array(
\t\t'path_basename' => basename( $path ),
\t\t'args'          => $args,
\t);
\treturn true;
}
function get_block_wrapper_attributes( $extra = array() ) {
\t$class = trim( 'wp-block ' . ( $extra['class'] ?? '' ) );
\t$GLOBALS['wphx_wrappers'][] = array( 'extra' => $extra, 'class' => $class );
\treturn 'class="' . esc_attr( $class ) . '"';
}
function wp_unique_id( $prefix = '' ) {
\t++$GLOBALS['wphx_unique_id'];
\treturn $prefix . $GLOBALS['wphx_unique_id'];
}
function wp_get_inline_script_tag( $data ) {
\t$GLOBALS['wphx_inline_scripts'][] = array(
\t\t'bytes'               => strlen( $data ),
\t\t'has_categories_url'  => str_contains( $data, 'build_dropdown_script_block_core_categories' ),
\t\t'has_archives_url'    => str_contains( $data, 'block_core_archives_build_dropdown_script' ),
\t\t'has_example_home'    => str_contains( $data, 'https://example.test' ),
\t\t'has_dropdown_logic'  => str_contains( $data, 'dropdown.addEventListener' ),
\t);
\treturn '<script type="text/javascript">' . $data . '</script>';
}

function get_taxonomy( $taxonomy ) {
\t$object                       = new stdClass();
\t$object->query_var            = 'category' === $taxonomy ? 'category_name' : $taxonomy;
\t$object->label                = 'category' === $taxonomy ? 'Categories' : ucfirst( $taxonomy );
\t$object->labels               = new stdClass();
\t$object->labels->singular_name = 'category' === $taxonomy ? 'Category' : ucfirst( $taxonomy );
\t$object->labels->no_terms      = 'No terms found.';
\treturn $object;
}
function wp_dropdown_categories( $args ) {
\t$GLOBALS['wphx_category_calls'][] = array( 'kind' => 'dropdown', 'args' => $args );
\t$selected = ( $args['selected'] ?? '' ) === 'news' ? ' selected="selected"' : '';
\treturn '<select id="' . esc_attr( $args['id'] ) . '" name="' . esc_attr( $args['name'] ) . '"><option value="-1">' . esc_html( $args['show_option_none'] ) . '</option><option class="level-0" value="news"' . $selected . '>News</option></select>';
}
function wp_list_categories( $args ) {
\t$GLOBALS['wphx_category_calls'][] = array( 'kind' => 'list', 'args' => $args );
\t$count = ! empty( $args['show_count'] ) ? ' (3)' : '';
\treturn '<li class="cat-item cat-item-7"><a href="https://example.test/category/news/">News</a>' . $count . '</li><li class="cat-item cat-item-8"><a href="https://example.test/category/events/">Events</a></li>';
}
class WP_HTML_Tag_Processor {
\tprivate $html;
\tprivate $cursor = 0;
\tprivate $should_set = false;

\tpublic function __construct( $html ) {
\t\t$this->html = $html;
\t}

\tpublic function next_tag( $query = null ) {
\t\t$position = strpos( $this->html, '<a ', $this->cursor );
\t\tif ( false === $position ) {
\t\t\treturn false;
\t\t}
\t\t$this->cursor = $position + 3;
\t\treturn true;
\t}

\tpublic function set_attribute( $name, $value ) {
\t\t$GLOBALS['wphx_html_processor'][] = compact( 'name', 'value' );
\t\t$this->should_set = true;
\t\treturn true;
\t}

\tpublic function get_updated_html() {
\t\tif ( ! $this->should_set ) {
\t\t\treturn $this->html;
\t\t}
\t\treturn preg_replace( '/<a\\\\b(?![^>]*data-wp-on--click)/', '<a data-wp-on--click="core/query::actions.navigate"', $this->html );
\t}
}

function wp_get_archives( $args ) {
\t$GLOBALS['wphx_archive_calls'][] = $args;
\tif ( 'core-renderers:archives-list-empty' === $GLOBALS['wphx_case'] && 'option' !== ( $args['format'] ?? '' ) ) {
\t\treturn '';
\t}
\tif ( 'option' === ( $args['format'] ?? '' ) ) {
\t\treturn '<option value="https://example.test/2026/06/">June 2026</option><option value="https://example.test/2026/05/">May 2026</option>';
\t}
\t$count = ! empty( $args['show_post_count'] ) ? '&nbsp;(2)' : '';
\treturn '<li><a href="https://example.test/2026/06/">June 2026</a>' . $count . '</li>';
}
function wp_tag_cloud( $args ) {
\t$GLOBALS['wphx_tag_cloud_calls'][] = $args;
\tif ( 'core-renderers:tag-cloud-empty-rest-registration' === $GLOBALS['wphx_case'] ) {
\t\treturn '';
\t}
\t$count = ! empty( $args['show_count'] ) ? ' <span class="tag-link-count">(4)</span>' : '';
\treturn '<a href="https://example.test/tag/haxe/" class="tag-cloud-link" style="font-size: ' . esc_attr( $args['largest'] . $args['unit'] ) . ';">Haxe' . $count . '</a>';
}

require __DIR__ . '/wp-includes/blocks/categories.php';
require __DIR__ . '/wp-includes/blocks/archives.php';
require __DIR__ . '/wp-includes/blocks/tag-cloud.php';

function block_context( $context ) {
\t$block          = new stdClass();
\t$block->context = $context;
\treturn $block;
}
function attrs_categories_base() {
\treturn array(
\t\t'taxonomy'          => 'category',
\t\t'showHierarchy'     => true,
\t\t'showPostCounts'    => true,
\t\t'showEmpty'         => true,
\t\t'showOnlyTopLevel'  => true,
\t\t'displayAsDropdown' => false,
\t\t'showLabel'         => true,
\t);
}
function normalize_actions() {
\treturn array_map(
\t\tfunction ( $action ) {
\t\t\treturn array(
\t\t\t\t'hook'          => $action['hook_name'],
\t\t\t\t'callback'      => is_string( $action['callback'] ) ? $action['callback'] : gettype( $action['callback'] ),
\t\t\t\t'priority'      => $action['priority'],
\t\t\t\t'accepted_args' => $action['accepted_args'],
\t\t\t);
\t\t},
\t\t$GLOBALS['wphx_actions']
\t);
}
function emit( $data ) {
\techo wp_json_encode( $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL;
}

switch ( $case ) {
\tcase 'core-renderers:categories-list-enhanced':
\t\t$output = render_block_core_categories( attrs_categories_base(), '', block_context( array( 'enhancedPagination' => true ) ) );
\t\temit( array(
\t\t\t'case'                    => $case,
\t\t\t'output_sha256'           => hash( 'sha256', $output ),
\t\t\t'has_navigation_attr'     => str_contains( $output, 'data-wp-on--click="core/query::actions.navigate"' ),
\t\t\t'category_call'           => $GLOBALS['wphx_category_calls'][0],
\t\t\t'wrapper'                 => $GLOBALS['wphx_wrappers'][0],
\t\t\t'processor_set_count'     => count( $GLOBALS['wphx_html_processor'] ),
\t\t\t'output'                  => $output,
\t\t) );
\t\tbreak;
\tcase 'core-renderers:categories-dropdown-front':
\t\t$attrs = attrs_categories_base();
\t\t$attrs['displayAsDropdown'] = true;
\t\t$attrs['showLabel']         = false;
\t\t$attrs['label']             = '<strong>Topic</strong>';
\t\t$output = render_block_core_categories( $attrs, '', block_context( array() ) );
\t\temit( array(
\t\t\t'case'                  => $case,
\t\t\t'output_sha256'         => hash( 'sha256', $output ),
\t\t\t'has_screen_reader'     => str_contains( $output, 'screen-reader-text' ),
\t\t\t'has_inline_script'     => str_contains( $output, 'build_dropdown_script_block_core_categories' ),
\t\t\t'category_call'         => $GLOBALS['wphx_category_calls'][0],
\t\t\t'inline_scripts'        => $GLOBALS['wphx_inline_scripts'],
\t\t\t'wrapper'               => $GLOBALS['wphx_wrappers'][0],
\t\t\t'output'                => $output,
\t\t) );
\t\tbreak;
\tcase 'core-renderers:archives-list-empty':
\t\t$output = render_block_core_archives( array( 'type' => 'monthly', 'showPostCounts' => true, 'displayAsDropdown' => false ) );
\t\temit( array(
\t\t\t'case'                => $case,
\t\t\t'output_sha256'       => hash( 'sha256', $output ),
\t\t\t'empty_fallback'      => str_contains( $output, 'No archives to show.' ),
\t\t\t'archive_call'        => $GLOBALS['wphx_archive_calls'][0],
\t\t\t'filter_call'         => $GLOBALS['wphx_filters'][0],
\t\t\t'wrapper'             => $GLOBALS['wphx_wrappers'][0],
\t\t\t'output'              => $output,
\t\t) );
\t\tbreak;
\tcase 'core-renderers:archives-dropdown-weekly':
\t\t$output = render_block_core_archives( array( 'type' => 'weekly', 'showPostCounts' => true, 'displayAsDropdown' => true, 'showLabel' => true ) );
\t\temit( array(
\t\t\t'case'                => $case,
\t\t\t'output_sha256'       => hash( 'sha256', $output ),
\t\t\t'has_weekly_label'    => str_contains( $output, 'Select Week' ),
\t\t\t'has_unique_id'       => str_contains( $output, 'wp-block-archives-1' ),
\t\t\t'archive_call'        => $GLOBALS['wphx_archive_calls'][0],
\t\t\t'filter_call'         => $GLOBALS['wphx_filters'][0],
\t\t\t'inline_scripts'      => $GLOBALS['wphx_inline_scripts'],
\t\t\t'wrapper'             => $GLOBALS['wphx_wrappers'][0],
\t\t\t'output'              => $output,
\t\t) );
\t\tbreak;
\tcase 'core-renderers:tag-cloud-render':
\t\t$output = render_block_core_tag_cloud( array(
\t\t\t'taxonomy'         => 'post_tag',
\t\t\t'showTagCounts'    => true,
\t\t\t'numberOfTags'     => 5,
\t\t\t'smallestFontSize' => '10px',
\t\t\t'largestFontSize'  => '22px',
\t\t) );
\t\temit( array(
\t\t\t'case'              => $case,
\t\t\t'output_sha256'     => hash( 'sha256', $output ),
\t\t\t'tag_cloud_call'    => $GLOBALS['wphx_tag_cloud_calls'][0],
\t\t\t'wrapper'           => $GLOBALS['wphx_wrappers'][0],
\t\t\t'has_count'         => str_contains( $output, 'tag-link-count' ),
\t\t\t'output'            => $output,
\t\t) );
\t\tbreak;
\tcase 'core-renderers:tag-cloud-empty-rest-registration':
\t\t$output = render_block_core_tag_cloud( array(
\t\t\t'taxonomy'         => 'post_tag',
\t\t\t'showTagCounts'    => false,
\t\t\t'numberOfTags'     => 3,
\t\t\t'smallestFontSize' => '8',
\t\t\t'largestFontSize'  => '18',
\t\t) );
\t\tregister_block_core_categories();
\t\tregister_block_core_archives();
\t\tregister_block_core_tag_cloud();
\t\temit( array(
\t\t\t'case'                  => $case,
\t\t\t'output_sha256'         => hash( 'sha256', $output ),
\t\t\t'has_rest_placeholder'  => str_contains( $output, 'There&#8217;s no content to show here yet.' ),
\t\t\t'tag_cloud_call'        => $GLOBALS['wphx_tag_cloud_calls'][0],
\t\t\t'actions'               => normalize_actions(),
\t\t\t'registrations'         => $GLOBALS['wphx_registrations'],
\t\t\t'wrapper'               => $GLOBALS['wphx_wrappers'][0],
\t\t\t'output'                => $output,
\t\t) );
\t\tbreak;
\tdefault:
\t\tfwrite( STDERR, 'Unknown case: ' . $case . PHP_EOL );
\t\texit( 2 );
}
`
  );
}

function runCase(root, fixtureCase) {
  return JSON.parse(command("php", [`${root}/probe.php`, fixtureCase.id]));
}

function runAllCases(root) {
  return Object.fromEntries(CASES.map((fixtureCase) => [fixtureCase.id, runCase(root, fixtureCase)]));
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-314-core-block-renderer-oracle-fixture`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/core-block-renderer-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "core taxonomy/list block server renderer behavior",
      area: SOURCE_FILES.join(" "),
      public_contract:
        "This fixture executes copied WordPress 7.0 core categories, archives, and tag-cloud block renderer PHP in PHP CLI with deterministic taxonomy, archive, tag cloud, wrapper, inline script, registration, REST/admin, and bounded HTML API stubs. It observes selected server-rendered block behavior without installed block registry/theme/editor behavior, browser/client package ownership, upstream PHPUnit parity, or generated public PHP replacement."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-stubbed-wordpress-boundary",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass installed block registry/rendering, theme/editor/browser handoff, selected upstream PHPUnit, and ecosystem fixtures before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-314-core-block-renderer-oracle-fixture",
        "npm run wp:core:wphx-314-core-block-renderer-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-314-10-core-block-renderer-oracle-fixture"],
      manifest_digest: manifestSha
    }
  };
}

function summarize(observations) {
  return {
    categories_enhanced_navigation_attr:
      observations["core-renderers:categories-list-enhanced"].has_navigation_attr,
    categories_dropdown_selected:
      observations["core-renderers:categories-dropdown-front"].category_call.args.selected,
    archives_empty_fallback: observations["core-renderers:archives-list-empty"].empty_fallback,
    archives_dropdown_weekly_label: observations["core-renderers:archives-dropdown-weekly"].has_weekly_label,
    tag_cloud_unit: observations["core-renderers:tag-cloud-render"].tag_cloud_call.unit,
    tag_cloud_rest_placeholder:
      observations["core-renderers:tag-cloud-empty-rest-registration"].has_rest_placeholder,
    registration_callbacks:
      observations["core-renderers:tag-cloud-empty-rest-registration"].registrations.map(
        (registration) => registration.args.render_callback
      )
  };
}

function buildRoot(root) {
  mirrorSources(root);
  writeProbe(root);
}

async function main() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  buildRoot(ORACLE_ROOT);
  buildRoot(CANDIDATE_ROOT);

  const oracle = runAllCases(ORACLE_ROOT);
  const candidate = runAllCases(CANDIDATE_ROOT);
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
  const probeLint = {
    oracle_lint: command("php", ["-l", `${ORACLE_ROOT}/probe.php`]),
    candidate_lint: command("php", ["-l", `${CANDIDATE_ROOT}/probe.php`])
  };

  const manifest = {
    schema: "wphx.wp-core-core-block-renderer-oracle-fixture.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_classes: ["oracle_source_mirror", "candidate_package_mirror", "php_cli_observed_fixture"],
    artifact_scope: "fixture",
    inputs: {
      prior_evidence: PRIOR_EVIDENCE.map(inputRecord),
      runner: inputRecord(RUNNER),
      upstream_sources: SOURCE_FILES.map(sourceRecord)
    },
    fixture: {
      cases: CASES,
      covered_symbols: COVERED_SYMBOLS,
      source_files: SOURCE_FILES,
      side_effect_policy: {
        external_network_io: false,
        database_io: false,
        live_installed_wordpress: false,
        php_cli: true,
        wordPress_stubs:
          "taxonomy objects, wp_dropdown_categories, wp_list_categories, bounded WP_HTML_Tag_Processor link mutation, wp_get_archives, wp_tag_cloud, wp_get_inline_script_tag, wp_unique_id, home_url, REST/admin predicates, wrapper attributes, registration, actions, filters, escaping, translation, and JSON helpers are deterministic local stubs; copied block renderer PHP remains the executed source."
      },
      public_abi_policy: {
        public_php_replacement_claimed: false,
        copied_oracle_public_php: true,
        haxe_owned_runtime_logic_claimed: false,
        installed_wordpress_behavior_claimed: false,
        browser_client_package_ownership_claimed: false
      },
      renderer_quirks_observed: [
        "Categories dropdown injects its inline navigation script on the non-admin front-end path and uses the taxonomy query var for selected state.",
        "Categories list enhanced pagination mutates anchor tags with the interactivity navigation click directive.",
        "Archives dropdown labels depend on the requested archive type and use wp_unique_id for select/label wiring.",
        "Archives list returns a wrapped fallback string when wp_get_archives returns empty output.",
        "Tag cloud derives the unit from smallestFontSize and shows an editor/REST placeholder only when the tag cloud is empty while serving a REST request."
      ]
    },
    build: { oracle_root: ORACLE_ROOT, candidate_root: CANDIDATE_ROOT, php_lint: phpLint, probe_lint: probeLint },
    observations: {
      oracle,
      candidate,
      match: observationsMatch,
      summary: summarize(oracle),
      oracle_sha256: sha256(JSON.stringify(oracle)),
      candidate_sha256: sha256(JSON.stringify(candidate))
    },
    remaining_gaps: [
      {
        id: "installed-block-registry-theme-editor-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "The fixture executes copied server renderer files directly. Installed block metadata loading, theme integration, editor/admin behavior, asset registration, and package-level browser behavior remain later gates."
      },
      {
        id: "full-core-renderer-matrix-not-covered",
        owner: ISSUE.external_ref,
        detail:
          "This fixture covers a selected taxonomy/archive/tag-list renderer cluster. Post, comment, navigation, query, template, media, and widget renderer clusters remain separate WPHX-314 or cross-domain gates."
      },
      {
        id: "public-php-adapter-not-yet-generated",
        owner: ISSUE.external_ref,
        detail:
          "The fixture compares copied oracle PHP in both roots; generated original-path PHP replacement and durable adapter ownership remain later compiler/linker gates."
      }
    ],
    ownership_manifest: OWNERSHIP,
    validation_result: {
      status: "passed",
      fixture_cases: CASES.length,
      covered_symbols: COVERED_SYMBOLS.length,
      source_files: SOURCE_FILES.length,
      observations_match: observationsMatch,
      public_php_replacement_claimed: false,
      haxe_owned_runtime_logic_claimed: false,
      installed_wordpress_behavior_claimed: false,
      browser_client_package_ownership_claimed: false
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestText);
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-314-10-core-block-renderer-oracle-fixture",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "core block renderer oracle-source-mirror fixture manifest" },
      { path: OWNERSHIP, role: "ownership manifest for copied-oracle core block renderer boundary" },
      { path: RUNNER, role: "deterministic PHP CLI oracle/candidate fixture generator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-314-core-block-renderer-oracle-fixture",
      "npm run wp:core:wphx-314-core-block-renderer-oracle-fixture:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-314-01-blocks-interactivity-surface",
      "receipt:wphx-314-02-blocks-interactivity-adapter-contract-candidate",
      "receipt:wphx-314-03-block-parser-render-oracle-fixture",
      "receipt:wphx-314-08-html-api-tag-processor-oracle-fixture",
      "receipt:wphx-314-09-interactivity-api-oracle-fixture"
    ],
    validation_result: manifest.validation_result
  };

  try {
    writeOrCheck(OUT, manifestText);
    writeOrCheck(OWNERSHIP, JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n");
    writeOrCheck(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
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
        fixture_cases: CASES.length,
        covered_symbols: COVERED_SYMBOLS.length,
        source_file_count: SOURCE_FILES.length,
        observations_match: observationsMatch,
        public_php_replacement_claimed: false
      },
      null,
      2
    )
  );
}

await main();
