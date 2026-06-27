#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.17.4",
  external_ref: "WPHX-310.04",
  title: "WPHX-310.04 — Add theme JSON/global styles oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-theme-json-global-styles-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-310-04";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-310-04-theme-json-global-styles-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-310-04-theme-json-global-styles-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-310-04-theme-json-global-styles-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-310-01-themes-template-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-310-02-theme-template-adapter-contract-candidate.v1.json";
const SUPPORT_FIXTURE = "manifests/wp-core/wphx-310-03-theme-support-template-oracle-fixture.v1.json";

const SOURCE_FILES = ["src/wp-includes/class-wp-theme-json-schema.php", "src/wp-includes/class-wp-theme-json.php"];
const COVERED_SYMBOLS = [
  "WP_Theme_JSON::__construct",
  "WP_Theme_JSON_Schema::migrate",
  "WP_Theme_JSON::get_settings",
  "WP_Theme_JSON::get_raw_data",
  "WP_Theme_JSON::get_stylesheet",
  "WP_Theme_JSON::merge",
  "WP_Theme_JSON::remove_insecure_properties"
];
const FIXTURE_CASES = [
  { id: "schema:v2-to-v3-migration", focus: "v2 theme.json migrates to v3 and records defaultFontSizes/defaultSpacingSizes policy" },
  { id: "settings:preset-normalization", focus: "palette, font-size, and spacing presets are keyed by origin and retrievable from settings" },
  { id: "stylesheet:variables-and-presets", focus: "CSS custom properties and preset classes are generated from theme data" },
  { id: "merge:theme-custom-precedence", focus: "custom origin data merges over theme origin data while preserving raw merged state" },
  { id: "sanitize:insecure-properties", focus: "unsafe style values are filtered by WP_Theme_JSON::remove_insecure_properties" }
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

$GLOBALS['wphx_310_04_filters'] = array();
$GLOBALS['wphx_310_04_errors'] = array();

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_310_04_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

function __( $text ) { return $text; }
function sprintf_safe( $format, ...$args ) { return sprintf( $format, ...$args ); }
function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_310_04_filters'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) + 1 );
\treturn $value;
}
function current_theme_supports( $feature, ...$args ) { return false; }
function wp_trigger_error( $function_name, $message, $error_level = E_USER_NOTICE ) {
\t$GLOBALS['wphx_310_04_errors'][] = array( 'function' => $function_name, 'message' => $message, 'level' => $error_level );
}
function _deprecated_function( $function_name, $version, $replacement = '' ) {
\t$GLOBALS['wphx_310_04_errors'][] = array( 'deprecated' => $function_name, 'version' => $version, 'replacement' => $replacement );
}
function _wp_array_get( $array, $path, $default = null ) {
\tforeach ( $path as $key ) {
\t\tif ( is_array( $array ) && array_key_exists( $key, $array ) ) {
\t\t\t$array = $array[ $key ];
\t\t} else {
\t\t\treturn $default;
\t\t}
\t}
\treturn $array;
}
function _wp_array_set( &$array, $path, $value ) {
\t$current =& $array;
\tforeach ( $path as $key ) {
\t\tif ( ! is_array( $current ) ) {
\t\t\t$current = array();
\t\t}
\t\tif ( ! array_key_exists( $key, $current ) ) {
\t\t\t$current[ $key ] = array();
\t\t}
\t\t$current =& $current[ $key ];
\t}
\t$current = $value;
}
function wp_is_numeric_array( $data ) {
\treturn is_array( $data ) && array_keys( $data ) === range( 0, count( $data ) - 1 );
}
function _wp_to_kebab_case( $value ) {
\t$value = preg_replace( '/([a-z])([A-Z])/', '$1-$2', (string) $value );
\t$value = preg_replace( '/[^a-zA-Z0-9]+/', '-', $value );
\treturn trim( strtolower( $value ), '-' );
}
function sanitize_title( $value ) { return _wp_to_kebab_case( $value ); }
function sanitize_html_class( $value ) { return preg_replace( '/[^A-Za-z0-9_-]/', '', (string) $value ); }
function esc_attr( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES ); }
function esc_html( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES ); }
function safecss_filter_attr( $css ) {
\t$parts = array();
\tforeach ( explode( ';', (string) $css ) as $declaration ) {
\t\tif ( '' === trim( $declaration ) || str_contains( strtolower( $declaration ), 'javascript:' ) || str_contains( strtolower( $declaration ), 'expression(' ) ) {
\t\t\tcontinue;
\t\t}
\t\t$parts[] = trim( $declaration );
\t}
\treturn implode( '; ', $parts );
}
function wp_recursive_ksort( &$array ) {
\tif ( ! is_array( $array ) ) {
\t\treturn;
\t}
\tksort( $array );
\tforeach ( $array as &$value ) {
\t\twp_recursive_ksort( $value );
\t}
}
function wp_get_typography_font_size_value( $preset, $settings = array() ) { return $preset['size'] ?? ''; }
function wp_get_block_css_selector( $block_type, $feature = null ) {
\t$slug = str_replace( '/', '-', (string) $block_type );
\treturn '.wp-block-' . $slug;
}
function wp_get_layout_definitions() { return array(); }
function block_has_support( $block_type, $feature, $default = false ) { return $default; }
function wp_style_engine_get_styles( $styles, $options = array() ) {
\t$declarations = array();
\tforeach ( $styles as $property => $value ) {
\t\tif ( is_scalar( $value ) ) {
\t\t\t$declarations[] = _wp_to_kebab_case( $property ) . ': ' . $value;
\t\t}
\t}
\treturn array( 'css' => implode( '; ', $declarations ) );
}
class WP_Block_Type_Registry {
\tpublic static function get_instance() { return new self(); }
\tpublic function get_all_registered() { return array(); }
\tpublic function get_registered( $name ) { return null; }
}
class WP_Block_Styles_Registry {
\tpublic static function get_instance() { return new self(); }
\tpublic function get_all_registered() { return array(); }
}

require ABSPATH . WPINC . '/class-wp-theme-json-schema.php';
require ABSPATH . WPINC . '/class-wp-theme-json.php';

$theme_data = array(
\t'version' => 2,
\t'settings' => array(
\t\t'appearanceTools' => true,
\t\t'color' => array(
\t\t\t'palette' => array(
\t\t\t\tarray( 'slug' => 'brand-blue', 'name' => 'Brand Blue', 'color' => '#0055aa' ),
\t\t\t\tarray( 'slug' => 'accent', 'name' => 'Accent', 'color' => '#e2b842' ),
\t\t\t),
\t\t),
\t\t'typography' => array(
\t\t\t'fontSizes' => array(
\t\t\t\tarray( 'slug' => 'small', 'name' => 'Small', 'size' => '13px' ),
\t\t\t\tarray( 'slug' => 'display', 'name' => 'Display', 'size' => 'clamp(2rem, 4vw, 4rem)' ),
\t\t\t),
\t\t),
\t\t'spacing' => array(
\t\t\t'spacingScale' => array(
\t\t\t\t'operator' => '*',
\t\t\t\t'increment' => 1.5,
\t\t\t\t'steps' => 3,
\t\t\t\t'mediumStep' => 1.5,
\t\t\t\t'unit' => 'rem',
\t\t\t),
\t\t),
\t),
\t'styles' => array(
\t\t'color' => array(
\t\t\t'text' => 'var:preset|color|brand-blue',
\t\t\t'background' => '#ffffff',
\t\t),
\t\t'typography' => array(
\t\t\t'fontSize' => 'var:preset|font-size|display',
\t\t),
\t\t'css' => 'body { --wphx-fixture: 1; }',
\t),
\t'customTemplates' => array(
\t\tarray( 'name' => 'landing', 'title' => 'Landing', 'postTypes' => array( 'page' ) ),
\t),
\t'templateParts' => array(
\t\tarray( 'name' => 'header', 'title' => 'Header', 'area' => 'header' ),
\t),
);

$theme = new WP_Theme_JSON( $theme_data, 'theme' );
$settings = $theme->get_settings();
$raw = $theme->get_raw_data();
$stylesheet = $theme->get_stylesheet( array( 'variables', 'presets' ), array( 'theme' ) );

$custom_data = array(
\t'version' => WP_Theme_JSON::LATEST_SCHEMA,
\t'settings' => array(
\t\t'color' => array(
\t\t\t'palette' => array(
\t\t\t\tarray( 'slug' => 'custom-red', 'name' => 'Custom Red', 'color' => '#cc2233' ),
\t\t\t),
\t\t),
\t),
\t'styles' => array(
\t\t'color' => array( 'text' => '#111111' ),
\t),
);
$custom = new WP_Theme_JSON( $custom_data, 'custom' );
$merged = new WP_Theme_JSON( $theme_data, 'theme' );
$merged->merge( $custom );
$merged_raw = $merged->get_raw_data();
$merged_stylesheet = $merged->get_stylesheet( array( 'variables', 'presets' ), array( 'theme', 'custom' ) );

$unsafe = WP_Theme_JSON::remove_insecure_properties(
\tarray(
\t\t'version' => WP_Theme_JSON::LATEST_SCHEMA,
\t\t'styles' => array(
\t\t\t'color' => array(
\t\t\t\t'text' => 'javascript:alert(1)',
\t\t\t\t'background' => '#ffffff',
\t\t\t),
\t\t),
\t),
\t'theme'
);

$cases = array(
\t'schema:v2-to-v3-migration' => array(
\t\t'version' => $raw['version'],
\t\t'defaultFontSizes' => _wp_array_get( $raw, array( 'settings', 'typography', 'defaultFontSizes' ) ),
\t\t'defaultSpacingSizes' => _wp_array_get( $raw, array( 'settings', 'spacing', 'defaultSpacingSizes' ) ),
\t),
\t'settings:preset-normalization' => array(
\t\t'palette_slugs' => array_column( _wp_array_get( $settings, array( 'color', 'palette', 'theme' ), array() ), 'slug' ),
\t\t'font_size_slugs' => array_column( _wp_array_get( $settings, array( 'typography', 'fontSizes', 'theme' ), array() ), 'slug' ),
\t\t'spacing_count' => count( _wp_array_get( $settings, array( 'spacing', 'spacingSizes', 'theme' ), array() ) ),
\t),
\t'stylesheet:variables-and-presets' => array(
\t\t'has_brand_var' => str_contains( $stylesheet, '--wp--preset--color--brand-blue' ),
\t\t'has_font_var' => str_contains( $stylesheet, '--wp--preset--font-size--display' ),
\t\t'has_color_class' => str_contains( $stylesheet, '.has-brand-blue-color' ),
\t\t'sha256' => hash( 'sha256', $stylesheet ),
\t),
\t'merge:theme-custom-precedence' => array(
\t\t'text' => _wp_array_get( $merged_raw, array( 'styles', 'color', 'text' ) ),
\t\t'custom_palette_slugs' => array_column( _wp_array_get( $merged_raw, array( 'settings', 'color', 'palette', 'custom' ), array() ), 'slug' ),
\t\t'has_custom_var' => str_contains( $merged_stylesheet, '--wp--preset--color--custom-red' ),
\t),
\t'sanitize:insecure-properties' => array(
\t\t'text' => _wp_array_get( $unsafe, array( 'styles', 'color', 'text' ), 'missing' ),
\t\t'background' => _wp_array_get( $unsafe, array( 'styles', 'color', 'background' ), 'missing' ),
\t),
);

ksort( $cases );
echo json_encode(
\tarray(
\t\t'cases' => $cases,
\t\t'filters' => $GLOBALS['wphx_310_04_filters'],
\t\t'php_errors' => $GLOBALS['wphx_310_04_errors'],
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
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-310-theme-json-global-styles-oracle-fixture`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/theme-json-global-styles-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "WP_Theme_JSON schema migration, settings, stylesheet, merge, and sanitization behavior",
      area: SOURCE_FILES.join(" "),
      public_contract:
        "This fixture executes copied WordPress 7.0 WP_Theme_JSON and schema source with deterministic fixture data while requiring the WPHX-310 adapter-contract and prior theme support/template fixture evidence. It does not claim WP_Theme_JSON_Resolver/global-styles wrapper parity, installed rendering, customizer/admin behavior, or generated public PHP replacement."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-haxe-adapter-contract-foundation",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass resolver/global-styles, installed theme rendering/admin, and selected upstream PHPUnit gates before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-310-theme-json-global-styles-oracle-fixture",
        "npm run wp:core:wphx-310-theme-json-global-styles-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-310-04-theme-json-global-styles-oracle-fixture"],
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
  schema: "wphx.wp-core-theme-json-global-styles-oracle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["oracle_source_mirror", "candidate_package_mirror"],
  artifact_scope: "fixture",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT),
    theme_support_template_fixture: inputRecord(SUPPORT_FIXTURE),
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
      id: "theme-json-resolver-and-global-styles-wrapper-not-executed",
      owner: ISSUE.external_ref,
      detail:
        "This fixture executes WP_Theme_JSON and schema behavior directly. WP_Theme_JSON_Resolver, theme.json file discovery, global styles post lookup, cache behavior, and wp_get_global_styles* wrappers remain later WPHX-310 gates."
    },
    {
      id: "installed-theme-rendering-and-admin-not-executed",
      owner: ISSUE.external_ref,
      detail:
        "Installed front-end rendering, customizer transactions, admin-visible theme state, nav-menu/widget admin, and REST global styles controllers are not claimed by this fixture."
    },
    {
      id: "public-php-adapter-not-yet-generated",
      owner: ISSUE.external_ref,
      detail:
        "WP_Theme_JSON PHP classes are copied oracle PHP in this fixture; generated original-path PHP replacement remains a later cross-domain gate."
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
  id: "receipt:wphx-310-04-theme-json-global-styles-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "theme JSON/global styles oracle-source-mirror fixture manifest" },
    { path: OWNERSHIP, role: "ownership manifest for copied-oracle theme JSON boundary" },
    { path: RUNNER, role: "deterministic oracle/candidate fixture generator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-310-theme-json-global-styles-oracle-fixture",
    "npm run wp:core:wphx-310-theme-json-global-styles-oracle-fixture:check",
    "npm run receipts:validate",
    "npm run beads:validate"
  ],
  related_receipts: [
    "receipt:wphx-310-01-themes-template-surface",
    "receipt:wphx-310-02-theme-template-adapter-contract-candidate",
    "receipt:wphx-310-03-theme-support-template-oracle-fixture"
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
    { status: "passed", output: OUT, ownership: OWNERSHIP, receipt: RECEIPT, fixture_cases: FIXTURE_CASES.length, observations_match: observationsMatch },
    null,
    2
  )
);
