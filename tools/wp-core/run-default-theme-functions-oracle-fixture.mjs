#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-m2hn",
  external_ref: "WPHX-320.05",
  title: "WPHX-320.05 - Add default theme functions copied-oracle fixture"
};
const RECORDED_AT = "2026-07-07T20:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-default-theme-functions-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-320-05";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-320-05-default-theme-functions-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-320-05-default-theme-functions-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-320-05-default-theme-functions-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-320-01-default-theme-php-surface.v1.json";
const HXX_PILOT = "manifests/wp-core/wphx-320-02-theme-hxx-markup-pilot.v1.json";
const RATCHETS = "manifests/wp-core/wphx-320-03-default-theme-upstream-browser-ratchets.v1.json";
const PATTERN_FIXTURE = "manifests/wp-core/wphx-320-04-default-theme-pattern-oracle-fixture.v1.json";

const SOURCE_FILES = [
  "src/wp-content/themes/twentytwentyfive/functions.php",
  "src/wp-content/themes/twentytwentyfour/functions.php"
];

const COVERED_SYMBOLS = [
  "wp-content/themes/twentytwentyfive/functions.php",
  "twentytwentyfive_post_format_setup",
  "twentytwentyfive_editor_style",
  "twentytwentyfive_enqueue_styles",
  "twentytwentyfive_block_styles",
  "twentytwentyfive_pattern_categories",
  "twentytwentyfive_register_block_bindings",
  "twentytwentyfive_format_binding",
  "wp-content/themes/twentytwentyfour/functions.php",
  "twentytwentyfour_block_styles",
  "twentytwentyfour_block_stylesheets",
  "twentytwentyfour_pattern_categories",
  "add_action",
  "do_action",
  "add_theme_support",
  "add_editor_style",
  "wp_enqueue_style",
  "wp_style_add_data",
  "register_block_style",
  "register_block_pattern_category",
  "register_block_bindings_source",
  "wp_enqueue_block_style",
  "get_parent_theme_file_uri",
  "get_parent_theme_file_path",
  "wp_get_theme",
  "get_template",
  "get_post_format",
  "get_post_format_string",
  "__",
  "_x"
];

const CASES = [
  {
    id: "tt5:hook-registration",
    theme: "twentytwentyfive",
    path: "wp-content/themes/twentytwentyfive/functions.php",
    actions: [],
    focus:
      "Twenty Twenty-Five functions.php registers after_setup_theme, wp_enqueue_scripts, and init callbacks without executing installed bootstrap."
  },
  {
    id: "tt5:setup-and-assets",
    theme: "twentytwentyfive",
    path: "wp-content/themes/twentytwentyfive/functions.php",
    actions: ["after_setup_theme", "wp_enqueue_scripts"],
    focus:
      "Twenty Twenty-Five setup and asset callbacks register post formats, editor styles, style enqueue data, and minified stylesheet path under deterministic theme stubs."
  },
  {
    id: "tt5:init-registries-and-binding",
    theme: "twentytwentyfive",
    path: "wp-content/themes/twentytwentyfive/functions.php",
    actions: ["init"],
    format_checks: true,
    focus:
      "Twenty Twenty-Five init callbacks register block styles, pattern categories, block binding source, and post-format binding results under deterministic stubs."
  },
  {
    id: "tt4:hook-registration",
    theme: "twentytwentyfour",
    path: "wp-content/themes/twentytwentyfour/functions.php",
    actions: [],
    focus: "Twenty Twenty-Four functions.php registers init callbacks for block styles, block stylesheets, and pattern categories."
  },
  {
    id: "tt4:init-registries-and-stylesheet",
    theme: "twentytwentyfour",
    path: "wp-content/themes/twentytwentyfour/functions.php",
    actions: ["init"],
    focus:
      "Twenty Twenty-Four init callbacks register block style variants, a button block stylesheet, and the page pattern category under deterministic theme stubs."
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
    sha256: sha256File(upstreamPath(path)),
    php_lint: command("php", ["-l", upstreamPath(path)])
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
$case = json_decode( $argv[2], true );

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

if ( ! defined( 'SCRIPT_DEBUG' ) ) {
\tdefine( 'SCRIPT_DEBUG', false );
}

$GLOBALS['wphx_theme'] = $case['theme'];
$GLOBALS['wphx_theme_versions'] = array(
\t'twentytwentyfive' => '25.0',
\t'twentytwentyfour' => '24.0',
);
$GLOBALS['wphx_hooks'] = array();
$GLOBALS['wphx_actions_run'] = array();
$GLOBALS['wphx_theme_supports'] = array();
$GLOBALS['wphx_editor_styles'] = array();
$GLOBALS['wphx_enqueued_styles'] = array();
$GLOBALS['wphx_style_data'] = array();
$GLOBALS['wphx_block_styles'] = array();
$GLOBALS['wphx_pattern_categories'] = array();
$GLOBALS['wphx_binding_sources'] = array();
$GLOBALS['wphx_block_style_sheets'] = array();
$GLOBALS['wphx_post_format'] = '';
$GLOBALS['wphx_errors'] = array();

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

class WPHX_Test_Theme {
\tprivate $theme;

\tpublic function __construct( $theme ) {
\t\t$this->theme = $theme;
\t}

\tpublic function get( $field ) {
\t\tif ( 'Version' === $field ) {
\t\t\treturn $GLOBALS['wphx_theme_versions'][ $this->theme ] ?? '0.0';
\t\t}
\t\treturn null;
\t}
}

function __( $text, $domain = null ) {
\treturn $text;
}
function _x( $text, $context, $domain = null ) {
\treturn $text;
}
function add_action( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\tif ( ! isset( $GLOBALS['wphx_hooks'][ $hook_name ] ) ) {
\t\t$GLOBALS['wphx_hooks'][ $hook_name ] = array();
\t}
\tif ( ! isset( $GLOBALS['wphx_hooks'][ $hook_name ][ $priority ] ) ) {
\t\t$GLOBALS['wphx_hooks'][ $hook_name ][ $priority ] = array();
\t}
\t$GLOBALS['wphx_hooks'][ $hook_name ][ $priority ][] = array(
\t\t'callback' => is_string( $callback ) ? $callback : 'non-string-callback',
\t\t'accepted_args' => $accepted_args,
\t);
\treturn true;
}
function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_actions_run'][] = $hook_name;
\tif ( ! isset( $GLOBALS['wphx_hooks'][ $hook_name ] ) ) {
\t\treturn;
\t}
\t$callbacks_by_priority = $GLOBALS['wphx_hooks'][ $hook_name ];
\tksort( $callbacks_by_priority, SORT_NUMERIC );
\tforeach ( $callbacks_by_priority as $callbacks ) {
\t\tforeach ( $callbacks as $entry ) {
\t\t\t$callback = $entry['callback'];
\t\t\tif ( is_callable( $callback ) ) {
\t\t\t\tcall_user_func_array( $callback, array_slice( $args, 0, $entry['accepted_args'] ) );
\t\t\t}
\t\t}
\t}
}
function add_theme_support( $feature, ...$args ) {
\t$GLOBALS['wphx_theme_supports'][ $feature ] = $args;
\treturn true;
}
function add_editor_style( $stylesheet = 'editor-style.css' ) {
\t$GLOBALS['wphx_editor_styles'][] = $stylesheet;
}
function wp_enqueue_style( $handle, $src = '', $deps = array(), $ver = false, $media = 'all' ) {
\t$GLOBALS['wphx_enqueued_styles'][] = array(
\t\t'handle' => $handle,
\t\t'src' => $src,
\t\t'deps' => $deps,
\t\t'ver' => $ver,
\t\t'media' => $media,
\t);
}
function wp_style_add_data( $handle, $key, $value ) {
\t$GLOBALS['wphx_style_data'][] = array(
\t\t'handle' => $handle,
\t\t'key' => $key,
\t\t'value' => $value,
\t);
}
function register_block_style( $block_name, $style_properties ) {
\t$GLOBALS['wphx_block_styles'][] = array(
\t\t'block_name' => $block_name,
\t\t'name' => $style_properties['name'] ?? null,
\t\t'label' => $style_properties['label'] ?? null,
\t\t'inline_style_sha256' => isset( $style_properties['inline_style'] ) ? 'sha256:' . hash( 'sha256', $style_properties['inline_style'] ) : null,
\t);
}
function register_block_pattern_category( $category_name, $category_properties ) {
\t$GLOBALS['wphx_pattern_categories'][] = array(
\t\t'name' => $category_name,
\t\t'label' => $category_properties['label'] ?? null,
\t);
}
function register_block_bindings_source( $source_name, $source_properties ) {
\t$GLOBALS['wphx_binding_sources'][] = array(
\t\t'name' => $source_name,
\t\t'label' => $source_properties['label'] ?? null,
\t\t'get_value_callback' => $source_properties['get_value_callback'] ?? null,
\t);
}
function wp_enqueue_block_style( $block_name, $args ) {
\t$GLOBALS['wphx_block_style_sheets'][] = array(
\t\t'block_name' => $block_name,
\t\t'handle' => $args['handle'] ?? null,
\t\t'src' => $args['src'] ?? null,
\t\t'ver' => $args['ver'] ?? null,
\t\t'path' => $args['path'] ?? null,
\t);
}
function get_parent_theme_file_uri( $file = '' ) {
\t$file = ltrim( (string) $file, '/' );
\treturn 'https://example.test/wp-content/themes/' . $GLOBALS['wphx_theme'] . ( '' === $file ? '' : '/' . $file );
}
function get_parent_theme_file_path( $file = '' ) {
\t$file = ltrim( (string) $file, '/' );
\treturn '/fixture/themes/' . $GLOBALS['wphx_theme'] . ( '' === $file ? '' : '/' . $file );
}
function wp_get_theme( $stylesheet = '' ) {
\t$theme = '' === $stylesheet ? $GLOBALS['wphx_theme'] : $stylesheet;
\treturn new WPHX_Test_Theme( $theme );
}
function get_template() {
\treturn $GLOBALS['wphx_theme'];
}
function get_post_format() {
\treturn $GLOBALS['wphx_post_format'];
}
function get_post_format_string( $slug ) {
\t$map = array(
\t\t'aside' => 'Aside',
\t\t'audio' => 'Audio',
\t\t'chat' => 'Chat',
\t\t'gallery' => 'Gallery',
\t\t'image' => 'Image',
\t\t'link' => 'Link',
\t\t'quote' => 'Quote',
\t\t'status' => 'Status',
\t\t'video' => 'Video',
\t);
\treturn $map[ $slug ] ?? ucfirst( (string) $slug );
}

function wphx_hook_summary() {
\t$summary = array();
\tforeach ( $GLOBALS['wphx_hooks'] as $hook => $callbacks_by_priority ) {
\t\tksort( $callbacks_by_priority, SORT_NUMERIC );
\t\t$callbacks = array();
\t\tforeach ( $callbacks_by_priority as $priority => $entries ) {
\t\t\tforeach ( $entries as $entry ) {
\t\t\t\t$callbacks[] = array(
\t\t\t\t\t'priority' => (int) $priority,
\t\t\t\t\t'callback' => $entry['callback'],
\t\t\t\t\t'accepted_args' => $entry['accepted_args'],
\t\t\t\t);
\t\t\t}
\t\t}
\t\t$summary[ $hook ] = $callbacks;
\t}
\tksort( $summary );
\treturn $summary;
}

$file = $root . '/' . $case['path'];
ob_start();
include $file;
foreach ( $case['actions'] as $hook_name ) {
\tdo_action( $hook_name );
}
$output = ob_get_clean();

$binding_results = array();
if ( ! empty( $case['format_checks'] ) && function_exists( 'twentytwentyfive_format_binding' ) ) {
\t$GLOBALS['wphx_post_format'] = 'gallery';
\t$binding_results['gallery'] = twentytwentyfive_format_binding();
\t$GLOBALS['wphx_post_format'] = 'standard';
\t$binding_results['standard'] = twentytwentyfive_format_binding();
\t$GLOBALS['wphx_post_format'] = '';
\t$binding_results['empty'] = twentytwentyfive_format_binding();
}

restore_error_handler();

echo json_encode(
\tarray(
\t\t'id' => $case['id'],
\t\t'theme' => $case['theme'],
\t\t'path' => $case['path'],
\t\t'hooks' => wphx_hook_summary(),
\t\t'actions_run' => $GLOBALS['wphx_actions_run'],
\t\t'theme_supports' => $GLOBALS['wphx_theme_supports'],
\t\t'editor_styles' => $GLOBALS['wphx_editor_styles'],
\t\t'enqueued_styles' => $GLOBALS['wphx_enqueued_styles'],
\t\t'style_data' => $GLOBALS['wphx_style_data'],
\t\t'block_styles' => $GLOBALS['wphx_block_styles'],
\t\t'pattern_categories' => $GLOBALS['wphx_pattern_categories'],
\t\t'binding_sources' => $GLOBALS['wphx_binding_sources'],
\t\t'binding_results' => $binding_results,
\t\t'block_style_sheets' => $GLOBALS['wphx_block_style_sheets'],
\t\t'output_sha256' => 'sha256:' . hash( 'sha256', $output ),
\t\t'output_bytes' => strlen( $output ),
\t\t'error_count' => count( $GLOBALS['wphx_errors'] ),
\t\t'errors' => $GLOBALS['wphx_errors'],
\t),
\tJSON_UNESCAPED_SLASHES
);
`
  );
}

function callbacksFor(observation, hook) {
  return (observation.hooks[hook] ?? []).map((entry) => entry.callback);
}

function assertIncludes(values, expected, context) {
  for (const value of expected) {
    if (!values.includes(value)) {
      throw new Error(`${context} missing ${value}`);
    }
  }
}

function assertEqual(actual, expected, context) {
  if (actual !== expected) {
    throw new Error(`${context} expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

function names(entries) {
  return entries.map((entry) => entry.name);
}

function validateCase(fixtureCase, observation) {
  if (observation.error_count !== 0) {
    throw new Error(`${fixtureCase.id} emitted PHP warnings/notices: ${JSON.stringify(observation.errors)}`);
  }
  if (observation.output_bytes !== 0) {
    throw new Error(`${fixtureCase.id} emitted unexpected output bytes: ${observation.output_bytes}`);
  }

  switch (fixtureCase.id) {
    case "tt5:hook-registration":
      assertIncludes(callbacksFor(observation, "after_setup_theme"), [
        "twentytwentyfive_post_format_setup",
        "twentytwentyfive_editor_style"
      ], fixtureCase.id);
      assertIncludes(callbacksFor(observation, "wp_enqueue_scripts"), ["twentytwentyfive_enqueue_styles"], fixtureCase.id);
      assertIncludes(callbacksFor(observation, "init"), [
        "twentytwentyfive_block_styles",
        "twentytwentyfive_pattern_categories",
        "twentytwentyfive_register_block_bindings"
      ], fixtureCase.id);
      break;
    case "tt5:setup-and-assets":
      assertEqual(observation.theme_supports["post-formats"][0].join(","), "aside,audio,chat,gallery,image,link,quote,status,video", fixtureCase.id);
      assertIncludes(observation.editor_styles, ["assets/css/editor-style.css"], fixtureCase.id);
      assertEqual(observation.enqueued_styles[0].handle, "twentytwentyfive-style", fixtureCase.id);
      assertEqual(observation.enqueued_styles[0].src, "https://example.test/wp-content/themes/twentytwentyfive/style.min.css", fixtureCase.id);
      assertEqual(observation.enqueued_styles[0].ver, "25.0", fixtureCase.id);
      assertEqual(observation.style_data[0].value, "/fixture/themes/twentytwentyfive/style.min.css", fixtureCase.id);
      break;
    case "tt5:init-registries-and-binding":
      assertIncludes(observation.block_styles.map((entry) => `${entry.block_name}:${entry.name}`), ["core/list:checkmark-list"], fixtureCase.id);
      assertIncludes(names(observation.pattern_categories), ["twentytwentyfive_page", "twentytwentyfive_post-format"], fixtureCase.id);
      assertEqual(observation.binding_sources[0].name, "twentytwentyfive/format", fixtureCase.id);
      assertEqual(observation.binding_sources[0].get_value_callback, "twentytwentyfive_format_binding", fixtureCase.id);
      assertEqual(observation.binding_results.gallery, "Gallery", fixtureCase.id);
      assertEqual(observation.binding_results.standard, null, fixtureCase.id);
      assertEqual(observation.binding_results.empty, null, fixtureCase.id);
      break;
    case "tt4:hook-registration":
      assertIncludes(callbacksFor(observation, "init"), [
        "twentytwentyfour_block_styles",
        "twentytwentyfour_block_stylesheets",
        "twentytwentyfour_pattern_categories"
      ], fixtureCase.id);
      break;
    case "tt4:init-registries-and-stylesheet":
      assertIncludes(observation.block_styles.map((entry) => `${entry.block_name}:${entry.name}`), [
        "core/details:arrow-icon-details",
        "core/post-terms:pill",
        "core/list:checkmark-list",
        "core/navigation-link:arrow-link",
        "core/heading:asterisk"
      ], fixtureCase.id);
      assertIncludes(names(observation.pattern_categories), ["twentytwentyfour_page"], fixtureCase.id);
      assertEqual(observation.block_style_sheets[0].block_name, "core/button", fixtureCase.id);
      assertEqual(observation.block_style_sheets[0].handle, "twentytwentyfour-button-style-outline", fixtureCase.id);
      assertEqual(observation.block_style_sheets[0].src, "https://example.test/wp-content/themes/twentytwentyfour/assets/css/button-outline.css", fixtureCase.id);
      assertEqual(observation.block_style_sheets[0].ver, "24.0", fixtureCase.id);
      assertEqual(observation.block_style_sheets[0].path, "/fixture/themes/twentytwentyfour/assets/css/button-outline.css", fixtureCase.id);
      break;
    default:
      throw new Error(`No validator for ${fixtureCase.id}`);
  }
}

function runCase(root, fixtureCase) {
  const observation = JSON.parse(command("php", [PROBE, root, JSON.stringify(fixtureCase)]));
  validateCase(fixtureCase, observation);
  return observation;
}

function summarizeObservation(observation) {
  return {
    id: observation.id,
    theme: observation.theme,
    path: observation.path,
    hooks: observation.hooks,
    actions_run: observation.actions_run,
    theme_supports: observation.theme_supports,
    editor_styles: observation.editor_styles,
    enqueued_styles: observation.enqueued_styles,
    style_data: observation.style_data,
    block_styles: observation.block_styles,
    pattern_categories: observation.pattern_categories,
    binding_sources: observation.binding_sources,
    binding_results: observation.binding_results,
    block_style_sheets: observation.block_style_sheets,
    output_sha256: observation.output_sha256,
    output_bytes: observation.output_bytes,
    error_count: observation.error_count
  };
}

function writeJson(path, value) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run npm run wp:core:wphx-320-default-theme-functions-oracle-fixture`);
    if (readFileSync(path, "utf8") !== body) throw new Error(`${path} is stale; run npm run wp:core:wphx-320-default-theme-functions-oracle-fixture`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

function main() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  mkdirSync(OUT_ROOT, { recursive: true });
  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe();

  const sourceRecords = SOURCE_FILES.map((path) => sourceRecord(path));
  const cases = CASES.map((fixtureCase) => {
    const oracle = runCase(ORACLE_ROOT, fixtureCase);
    const candidate = runCase(CANDIDATE_ROOT, fixtureCase);
    const matched = JSON.stringify(oracle) === JSON.stringify(candidate);
    if (!matched) {
      throw new Error(`${fixtureCase.id} oracle/candidate observation mismatch`);
    }
    return {
      id: fixtureCase.id,
      theme: fixtureCase.theme,
      path: fixtureCase.path,
      focus: fixtureCase.focus,
      source: sourceRecord(`src/${fixtureCase.path}`),
      actions: fixtureCase.actions,
      oracle_observation: summarizeObservation(oracle),
      candidate_observation: summarizeObservation(candidate),
      observation_match: matched
    };
  });

  const manifest = {
    schema_version: 1,
    issue: ISSUE.external_ref,
    beads_issue: ISSUE.id,
    title: ISSUE.title,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "copied_oracle_default_theme_functions_fixture",
    artifact_scope: "selected_default_theme_functions_php",
    behavior_parity_claimed: false,
    selected_copied_oracle_behavior_match_claimed: true,
    installed_theme_rendering_parity_claimed: false,
    installed_wordpress_bootstrap_claimed: false,
    browser_or_visual_parity_claimed: false,
    public_php_replacement_claimed: false,
    candidate_generated_overlay_claimed: false,
    generated_original_path_adapter_claimed: false,
    haxe_owned_existing_theme_file_claimed: false,
    functions_php_runtime_ownership_claimed: false,
    hxx_template_ownership_claimed: false,
    source_file_count: sourceRecords.length,
    case_count: cases.length,
    covered_symbol_count: COVERED_SYMBOLS.length,
    covered_symbols: COVERED_SYMBOLS,
    source_files: sourceRecords,
    cases,
    validation_result: {
      status: "passed",
      case_count: cases.length,
      oracle_candidate_observation_match: cases.every((entry) => entry.observation_match),
      php_lint_passed: sourceRecords.every((entry) => entry.php_lint.includes("No syntax errors detected")),
      observed_hook_registration_cases: 2,
      observed_callback_execution_cases: 3,
      observed_error_count: cases.reduce((count, entry) => count + entry.oracle_observation.error_count + entry.candidate_observation.error_count, 0),
      observed_output_bytes: cases.reduce((count, entry) => count + entry.oracle_observation.output_bytes + entry.candidate_observation.output_bytes, 0),
      public_php_replacement_claimed: false,
      installed_theme_rendering_parity_claimed: false,
      haxe_owned_existing_theme_file_claimed: false
    },
    inputs: {
      runner: inputRecord(RUNNER),
      surface_manifest: inputRecord(SURFACE),
      hxx_pilot_manifest: inputRecord(HXX_PILOT),
      upstream_browser_ratchets_manifest: inputRecord(RATCHETS),
      pattern_fixture_manifest: inputRecord(PATTERN_FIXTURE)
    },
    cross_domain_handoffs: [
      {
        owner: "WPHX-301/WPHX-302/WPHX-306",
        reason:
          "Real WordPress hook dispatch, conditional loading, theme setup integration, capabilities, and user/session state are outside this deterministic hook-stub fixture."
      },
      {
        owner: "WPHX-309/WPHX-310",
        reason:
          "Theme discovery, theme.json/global styles, template hierarchy, template-loader behavior, stylesheet registration semantics, and installed theme bootstrap remain routing/theme-system ownership."
      },
      {
        owner: "WPHX-314/WPHX-400/WPHX-500",
        reason:
          "Block style registration, block binding consumption, front-end block rendering, browser behavior, and Gutenberg/editor integration remain block/browser ownership."
      },
      {
        owner: "WPHX-307/WPHX-308/WPHX-313",
        reason:
          "Real post formats, post/query state, content/media files, and database-backed theme rendering are not exercised by these deterministic stubs."
      }
    ],
    non_claims: [
      "No generated public PHP replacement for any bundled default-theme functions.php file.",
      "No Haxe-owned existing theme functions.php runtime, broad HXX migration, or durable template/function ownership for these copied files.",
      "No installed WordPress bootstrap, theme discovery, template-loader, pattern registry, front-end block rendering, browser, visual-regression, or performance parity execution.",
      "No database-backed post/query/menu/widget/customizer/global-styles state, media asset existence, generated overlay, or generated original-path adapter ownership.",
      "The oracle and candidate roots both contain regenerated copies of selected upstream WordPress default-theme functions.php files. This is copied-oracle bridge evidence only.",
      "The deterministic hook, theme, enqueue, block-style, pattern-category, block-binding, and post-format stubs are fixture scaffolding, not WordPress runtime ownership."
    ]
  };

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/default-theme-functions-oracle-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "copied_oracle_public_php_fixture",
      name: "selected bundled default-theme functions.php fixture",
      area: "wp-content/themes/twentytwentyfive/functions.php and wp-content/themes/twentytwentyfour/functions.php",
      public_contract:
        "This fixture executes selected copied upstream default-theme functions.php files under deterministic WordPress hook/theme stubs and compares oracle/candidate observations. It does not claim Haxe runtime ownership, installed theme rendering parity, generated public PHP replacement, generated overlays, or HXX ownership of existing theme files."
    },
    ownership_state: "bridge_fixture_only",
    ownership_axes: {
      semantic_owner: "upstream_wordpress",
      adapter_contract_owner: "none",
      emission_strategy: "copied_upstream_public_php_with_deterministic_functions_probe",
      execution_provider: "php_cli_probe_with_stubbed_hooks_theme_enqueue_block_style_pattern_binding_and_post_format_services",
      compatibility_evidence: "selected_copied_oracle_candidate_observation_match"
    },
    bridge: {
      exists: true,
      kind: "copied_oracle_candidate_default_theme_functions_fixture",
      removal_gate:
        "Replace copied default-theme functions.php behavior with generated original-path adapters or typed Haxe adapter-contract/segment-plan evidence and pass installed theme bootstrap, selected upstream PHPUnit, browser/visual, generated-overlay, and generated public PHP gates before claiming runtime ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-320-default-theme-functions-oracle-fixture",
        "npm run wp:core:wphx-320-default-theme-functions-oracle-fixture:check",
        "npm run operations:bridge-claim-guardrails:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-320-05-default-theme-functions-oracle-fixture"],
      manifest_digest: sha256(JSON.stringify(manifest, null, 2) + "\n")
    },
    notes:
      "The copied functions.php files are regenerated test inputs. The deterministic probe proves selected hook/callback observation stability only and must not be used as durable default-theme implementation evidence."
  };

  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-320-05-default-theme-functions-oracle-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref,
      title: ISSUE.title
    },
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "default theme functions copied-oracle fixture manifest", sha256: ownership.verification.manifest_digest },
      { path: OWNERSHIP, role: "ownership manifest for copied-oracle default theme functions fixture" },
      { path: RUNNER, role: "deterministic copied-oracle default theme functions runner" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-320-default-theme-functions-oracle-fixture",
      "npm run wp:core:wphx-320-default-theme-functions-oracle-fixture:check",
      "npm run operations:bridge-claim-guardrails:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    status: "passed",
    evidence_class: manifest.evidence_class,
    artifact_scope: manifest.artifact_scope,
    validation_result: manifest.validation_result,
    claims: [
      "Two selected bundled default-theme functions.php files execute under deterministic WordPress hook, theme, enqueue, block-style, pattern-category, block-binding, and post-format stubs.",
      "Regenerated copied oracle and copied candidate roots produce matching observations for five hook-registration and callback-execution cases.",
      "The selected observations cover Twenty Twenty-Five post-format setup, editor styles, stylesheet enqueue data, block style/category/binding registration, and Twenty Twenty-Four block style, block stylesheet, and pattern-category registration with no PHP warnings or unexpected output."
    ],
    non_claims: manifest.non_claims
  };

  writeJson(OUT, manifest);
  writeJson(OWNERSHIP, ownership);
  writeJson(RECEIPT, receipt);
  console.log(
    JSON.stringify(
      {
        status: "passed",
        case_count: cases.length,
        source_file_count: sourceRecords.length,
        covered_symbol_count: COVERED_SYMBOLS.length,
        observation_match: manifest.validation_result.oracle_candidate_observation_match,
        public_php_replacement_claimed: false,
        installed_theme_rendering_parity_claimed: false
      },
      null,
      2
    )
  );
}

main();
