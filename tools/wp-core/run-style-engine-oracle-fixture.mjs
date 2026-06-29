#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.20.1",
  external_ref: "WPHX-314.07",
  title: "WPHX-314.07 - Add style engine oracle fixture"
};
const RECORDED_AT = "2026-06-29T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-style-engine-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-314-07";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const OUT = "manifests/wp-core/wphx-314-07-style-engine-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-314-07-style-engine-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-314-07-style-engine-oracle-fixture.v1.json";
const PRIOR_EVIDENCE = [
  "manifests/wp-core/wphx-314-01-blocks-interactivity-surface.v1.json",
  "manifests/wp-core/wphx-314-02-blocks-interactivity-adapter-contract-candidate.v1.json",
  "manifests/wp-core/wphx-314-03-block-parser-render-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-04-block-supports-bindings-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-05-block-patterns-registry-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-06-block-hooks-insertion-oracle-fixture.v1.json"
];

const SOURCE_FILES = [
  "src/wp-includes/style-engine.php",
  "src/wp-includes/style-engine/class-wp-style-engine-css-declarations.php",
  "src/wp-includes/style-engine/class-wp-style-engine-css-rule.php",
  "src/wp-includes/style-engine/class-wp-style-engine-css-rules-store.php",
  "src/wp-includes/style-engine/class-wp-style-engine-processor.php",
  "src/wp-includes/style-engine/class-wp-style-engine.php"
];
const COVERED_SYMBOLS = [
  "wp_style_engine_get_styles",
  "wp_style_engine_get_stylesheet_from_css_rules",
  "wp_style_engine_get_stylesheet_from_context",
  "WP_Style_Engine",
  "WP_Style_Engine::parse_block_styles",
  "WP_Style_Engine::compile_css",
  "WP_Style_Engine::compile_stylesheet_from_css_rules",
  "WP_Style_Engine::store_css_rule",
  "WP_Style_Engine::get_store",
  "WP_Style_Engine_CSS_Declarations",
  "WP_Style_Engine_CSS_Declarations::add_declaration",
  "WP_Style_Engine_CSS_Declarations::remove_declaration",
  "WP_Style_Engine_CSS_Declarations::get_declarations_string",
  "WP_Style_Engine_CSS_Rule",
  "WP_Style_Engine_CSS_Rule::get_css",
  "WP_Style_Engine_CSS_Rules_Store",
  "WP_Style_Engine_CSS_Rules_Store::get_store",
  "WP_Style_Engine_CSS_Rules_Store::add_rule",
  "WP_Style_Engine_CSS_Rules_Store::remove_rule",
  "WP_Style_Engine_Processor",
  "WP_Style_Engine_Processor::add_rules",
  "WP_Style_Engine_Processor::get_css"
];
const CASES = [
  { id: "style-engine:declarations-sanitize-compile", focus: "declaration filtering, non-string skips, removal, compact and pretty output" },
  { id: "style-engine:css-rule-nested-pretty", focus: "CSS rule compilation with selector lists and nested rules_group output" },
  { id: "style-engine:processor-optimize", focus: "processor rule merge behavior and optimized selector combining" },
  { id: "style-engine:public-styles-store", focus: "public helper preset conversion, classnames, selector CSS, and context storage" },
  { id: "style-engine:stylesheet-rules-groups", focus: "stylesheet helper with nested groups and context store replay" },
  { id: "style-engine:store-lifecycle", focus: "store creation, invalid selector skip, rule removal, and static store registry behavior" }
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
$GLOBALS['wphx_wrong'] = array();

define( 'ABSPATH', __DIR__ . '/' );
define( 'WPINC', 'wp-includes' );

function __( $value ) { return $value; }
function _doing_it_wrong( $function_name, $message, $version ) { $GLOBALS['wphx_wrong'][] = compact( 'function_name', 'message', 'version' ); }
function wp_json_encode( $value, $flags = 0, $depth = 512 ) { return json_encode( $value, $flags, $depth ); }
function wp_parse_args( $args, $defaults = array() ) {
\tif ( is_object( $args ) ) { $args = get_object_vars( $args ); }
\tif ( ! is_array( $args ) ) { $args = array(); }
\tif ( ! is_array( $defaults ) ) { $defaults = array(); }
\treturn array_merge( $defaults, $args );
}
function sanitize_key( $key ) {
\t$key = strtolower( (string) $key );
\treturn preg_replace( '/[^a-z0-9_\\-]/', '', $key );
}
function wp_strip_all_tags( $text, $remove_breaks = false ) {
\t$text = preg_replace( '@<(script|style)[^>]*?>.*?</\\\\1>@si', '', (string) $text );
\t$text = strip_tags( $text );
\tif ( $remove_breaks ) { $text = preg_replace( '/[\\r\\n\\t ]+/', ' ', $text ); }
\treturn trim( $text );
}
function safecss_filter_attr( $css ) {
\t$css = trim( (string) $css );
\tif ( '' === $css ) { return ''; }
\t$lower = strtolower( $css );
\tif ( str_contains( $lower, 'javascript:' ) || str_contains( $lower, 'expression(' ) ) { return ''; }
\treturn $css;
}
function _wp_to_kebab_case( $value ) {
\t$value = preg_replace( '/([a-z])([A-Z])/', '$1-$2', (string) $value );
\t$value = preg_replace( '/[^a-zA-Z0-9]+/', '-', $value );
\treturn trim( strtolower( $value ), '-' );
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

require ABSPATH . WPINC . '/style-engine/class-wp-style-engine-css-declarations.php';
require ABSPATH . WPINC . '/style-engine/class-wp-style-engine-css-rule.php';
require ABSPATH . WPINC . '/style-engine/class-wp-style-engine-css-rules-store.php';
require ABSPATH . WPINC . '/style-engine/class-wp-style-engine-processor.php';
require ABSPATH . WPINC . '/style-engine/class-wp-style-engine.php';
require ABSPATH . WPINC . '/style-engine.php';

function declarations_sanitize_compile_case() {
\t$declarations = new WP_Style_Engine_CSS_Declarations(
\t\tarray(
\t\t\t' Color! '         => ' red ',
\t\t\t'font-size'        => ' 16px ',
\t\t\t'empty-value'      => ' ',
\t\t\t'non-string'       => array( 'bad' ),
\t\t\t'background-image' => 'url(javascript:alert(1))',
\t\t\t'custom_property'  => 'calc(100% - 1rem)',
\t\t)
\t);
\t$declarations->add_declaration( 'margin-top', ' 0 ' );
\t$declarations->remove_declaration( 'empty-value' );
\treturn array(
\t\t'declarations' => $declarations->get_declarations(),
\t\t'compact'      => $declarations->get_declarations_string(),
\t\t'pretty'       => $declarations->get_declarations_string( true, 1 ),
\t);
}

function css_rule_nested_pretty_case() {
\t$rule = new WP_Style_Engine_CSS_Rule(
\t\t'.wp-block-alpha, .wp-block-beta',
\t\tarray( 'color' => 'red', 'padding' => '1rem' ),
\t\t'@media (min-width: 600px)'
\t);
\treturn array(
\t\t'selector'    => $rule->get_selector(),
\t\t'rules_group' => $rule->get_rules_group(),
\t\t'compact'     => $rule->get_css(),
\t\t'pretty'      => $rule->get_css( true ),
\t);
}

function processor_optimize_case() {
\t$rules = array(
\t\tnew WP_Style_Engine_CSS_Rule( '.alpha', array( 'color' => 'red', 'padding' => '1rem' ) ),
\t\tnew WP_Style_Engine_CSS_Rule( '.beta', array( 'padding' => '1rem', 'color' => 'red' ) ),
\t\tnew WP_Style_Engine_CSS_Rule( '.gamma', array( 'color' => 'blue' ) ),
\t);
\t$processor = new WP_Style_Engine_Processor();
\t$processor->add_rules( $rules );
\t$optimized_processor = new WP_Style_Engine_Processor();
\t$optimized_processor->add_rules( $rules );
\treturn array(
\t\t'plain'     => $processor->get_css( array( 'optimize' => false, 'prettify' => false ) ),
\t\t'optimized' => $optimized_processor->get_css( array( 'optimize' => true, 'prettify' => false ) ),
\t\t'wrong'     => $GLOBALS['wphx_wrong'],
\t);
}

function public_styles_store_case() {
\tWP_Style_Engine_CSS_Rules_Store::remove_all_stores();
\t$styles = array(
\t\t'color'      => array( 'text' => 'var:preset|color|Primary Blue', 'background' => '#ffffff' ),
\t\t'spacing'    => array( 'padding' => array( 'top' => 'var:preset|spacing|50', 'right' => '2rem', 'bottom' => '0' ) ),
\t\t'typography' => array( 'fontSize' => 'var:preset|font-size|Display Large', 'textIndent' => '1ch' ),
\t\t'dimensions' => array( 'aspectRatio' => '16/9' ),
\t);
\t$output = wp_style_engine_get_styles( $styles, array( 'selector' => '.wp-block-wphx', 'context' => 'block-supports' ) );
\treturn array(
\t\t'output'             => $output,
\t\t'context_stylesheet' => wp_style_engine_get_stylesheet_from_context( 'block-supports' ),
\t\t'stores'             => array_keys( WP_Style_Engine_CSS_Rules_Store::get_stores() ),
\t);
}

function stylesheet_rules_groups_case() {
\tWP_Style_Engine_CSS_Rules_Store::remove_all_stores();
\t$rules = array(
\t\tarray( 'selector' => '.entry-title', 'declarations' => array( 'color' => 'red' ) ),
\t\tarray( 'selector' => '.entry-title', 'declarations' => array( 'font-size' => '2rem' ), 'rules_group' => '@media (min-width: 48rem)' ),
\t\tarray( 'selector' => '', 'declarations' => array( 'color' => 'ignored' ) ),
\t);
\t$compiled = wp_style_engine_get_stylesheet_from_css_rules( $rules, array( 'context' => 'global-styles', 'prettify' => false ) );
\treturn array(
\t\t'compiled' => $compiled,
\t\t'context'  => wp_style_engine_get_stylesheet_from_context( 'global-styles', array( 'prettify' => true ) ),
\t);
}

function store_lifecycle_case() {
\tWP_Style_Engine_CSS_Rules_Store::remove_all_stores();
\t$store = WP_Style_Engine_CSS_Rules_Store::get_store( 'fixture' );
\t$blank = $store->add_rule( '   ' );
\t$store->add_rule( '.fixture' )->add_declarations( array( 'color' => 'green' ) );
\t$store->add_rule( '.fixture', '@layer components' )->add_declarations( array( 'margin' => '0' ) );
\t$before = array_keys( $store->get_all_rules() );
\t$store->remove_rule( '.fixture' );
\t$after = array_keys( $store->get_all_rules() );
\treturn array(
\t\t'name'          => $store->get_name(),
\t\t'blank_is_null' => null === $blank,
\t\t'before'        => $before,
\t\t'after'         => $after,
\t\t'invalid_store' => null === WP_Style_Engine_CSS_Rules_Store::get_store( '' ),
\t\t'stores'        => array_keys( WP_Style_Engine_CSS_Rules_Store::get_stores() ),
\t);
}

$cases = array(
\t'style-engine:declarations-sanitize-compile' => 'declarations_sanitize_compile_case',
\t'style-engine:css-rule-nested-pretty'        => 'css_rule_nested_pretty_case',
\t'style-engine:processor-optimize'            => 'processor_optimize_case',
\t'style-engine:public-styles-store'           => 'public_styles_store_case',
\t'style-engine:stylesheet-rules-groups'       => 'stylesheet_rules_groups_case',
\t'style-engine:store-lifecycle'               => 'store_lifecycle_case',
);

if ( ! isset( $cases[ $case ] ) ) {
\tfwrite( STDERR, 'Unknown fixture case: ' . $case . PHP_EOL );
\texit( 2 );
}

$observation = array(
\t'case'        => $case,
\t'observation' => call_user_func( $cases[ $case ] ),
\t'wrong'       => $GLOBALS['wphx_wrong'],
);
echo wp_json_encode( $observation, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL;
`
  );
}

function runFixture(root) {
  rmSync(root, { force: true, recursive: true });
  mkdirSync(root, { recursive: true });
  mirrorSources(root);
  writeProbe(root);
  command("php", ["-l", `${root}/probe.php`]);

  const observations = [];
  for (const fixtureCase of CASES) {
    observations.push(JSON.parse(command("php", [`${root}/probe.php`, fixtureCase.id])));
  }

  return {
    root,
    probe: `${root}/probe.php`,
    probe_sha256: sha256File(`${root}/probe.php`),
    source_files: SOURCE_FILES.map((path) => inputRecord(mirrorPath(root, path))),
    observations
  };
}

function writeJsonChecked(path, value) {
  const rendered = `${JSON.stringify(value, null, 2)}\n`;
  if (checkOnly) {
    if (!existsSync(path)) {
      throw new Error(`${path} is missing; run npm run wp:core:wphx-314-style-engine-oracle-fixture`);
    }
    if (readFileSync(path, "utf8") !== rendered) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-314-style-engine-oracle-fixture`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, rendered);
}

function main() {
  const oracle = runFixture(ORACLE_ROOT);
  const candidate = runFixture(CANDIDATE_ROOT);
  const oracleComparable = oracle.observations;
  const candidateComparable = candidate.observations;
  if (JSON.stringify(oracleComparable) !== JSON.stringify(candidateComparable)) {
    throw new Error("Oracle and candidate style engine observations diverged");
  }

  const validationResult = {
    status: "passed",
    issue: ISSUE.external_ref,
    case_count: CASES.length,
    covered_symbol_count: COVERED_SYMBOLS.length,
    source_file_count: SOURCE_FILES.length,
    oracle_candidate_match: true,
    public_php_replacement_claimed: false
  };

  const manifest = {
    schema: "wphx.wp_core.style_engine_oracle_fixture.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: {
      path: RUNNER,
      sha256: sha256File(RUNNER),
      check_command: "npm run wp:core:wphx-314-style-engine-oracle-fixture:check"
    },
    evidence_class: "copied_oracle_candidate_php_fixture",
    artifact_scope: {
      domain: "blocks_style_engine",
      public_php_replacement_claimed: false,
      haxe_runtime_logic_claimed: false,
      installed_block_parity_claimed: false,
      upstream_phpunit_pass_pass_claimed: false,
      browser_gutenberg_ownership_claimed: false
    },
    inputs: {
      upstream_root: UPSTREAM_ROOT,
      source_files: SOURCE_FILES.map(sourceRecord),
      prior_evidence: PRIOR_EVIDENCE.filter(existsSync).map(inputRecord)
    },
    fixture: {
      cases: CASES,
      covered_symbols: COVERED_SYMBOLS,
      deterministic_boundaries: [
        "WordPress 7.0 PHP style-engine sources are mirrored into oracle and candidate roots.",
        "Core helpers outside the style-engine ownership boundary are deterministic test stubs for parsing, sanitization, translation, JSON, and array-path access.",
        "The fixture observes declarations, rule formatting, nested rule groups, store mutation, preset-derived classnames, and public helper wrappers without replacing WordPress style engine logic.",
        "Global styles/theme.json, HTML API, interactivity directives, installed block rendering, and browser/Gutenberg behavior remain outside this slice."
      ]
    },
    runs: {
      oracle,
      candidate,
      comparable_sha256: sha256(JSON.stringify(oracleComparable))
    },
    remaining_gaps: [
      "Haxe-owned runtime implementation for the style engine is not claimed.",
      "Generated original-path public PHP adapter replacement is not claimed.",
      "Global styles/theme.json resolver integration, layout/support serialization, HTML API tag processing, interactivity directives, installed block rendering, selected upstream PHPUnit pass/pass, editor/browser, and Gutenberg package ownership remain later gates.",
      "Full HTML API/interactivity ownership remains outside this fixture."
    ],
    ownership_manifest: OWNERSHIP,
    validation_result: validationResult
  };

  const ownership = {
    schema: "wphx.ownership_manifest.v1",
    manifest_id: "wphx-314-07-style-engine-oracle-fixture",
    issue: ISSUE,
    unit: {
      kind: "wp_core_oracle_fixture",
      domain: "blocks_style_engine",
      source_files: SOURCE_FILES
    },
    ownership_state: "bridge_shell",
    ownership_axes: {
      semantic_behavior: "upstream_wordpress_php_oracle",
      haxe_source: "not_claimed",
      public_php_abi: "copied_oracle_candidate_fixture_only",
      installed_distribution: "not_claimed",
      browser_gutenberg: "not_claimed"
    },
    bridge: {
      kind: "copied_oracle_candidate_php_fixture",
      removal_gate: "Replace the copied public PHP fixture with typed Haxe-owned style engine decisions plus WPHX Adapter IR/generated original-path public PHP evidence, or explicitly supersede this bridge with an accepted backend/custom-target improvement.",
      non_claims: manifest.remaining_gaps
    },
    owned_paths: [],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, `${ORACLE_ROOT}/probe.php`, `${CANDIDATE_ROOT}/probe.php`],
    verification: validationResult,
    notes: [
      "This fixture is a behavior target for future Haxe ownership. It records declaration sanitization, rule compilation, nested rule groups, public helper wrappers, context storage, and static store lifecycle behavior.",
      "The fixture-owned Core helper stubs are deterministic harness boundaries, not replacement evidence for formatting, KSES, or theme.json/global-styles APIs."
    ]
  };

  const receipt = {
    schema: "wphx.receipt.v1",
    id: "wphx-314-07-style-engine-oracle-fixture",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    artifacts: {
      manifest: OUT,
      ownership,
      runner: RUNNER,
      generated_oracle_probe: `${ORACLE_ROOT}/probe.php`,
      generated_candidate_probe: `${CANDIDATE_ROOT}/probe.php`
    },
    verification_commands: [
      "npm run wp:core:wphx-314-style-engine-oracle-fixture",
      "npm run wp:core:wphx-314-style-engine-oracle-fixture:check",
      "npm run receipts:validate",
      "npm run beads:validate",
      "npm run precommit"
    ],
    related_receipts: [
      "receipts/wp-core/wphx-314-01-blocks-interactivity-surface.v1.json",
      "receipts/wp-core/wphx-314-02-blocks-interactivity-adapter-contract-candidate.v1.json",
      "receipts/wp-core/wphx-314-03-block-parser-render-oracle-fixture.v1.json",
      "receipts/wp-core/wphx-314-04-block-supports-bindings-oracle-fixture.v1.json",
      "receipts/wp-core/wphx-314-05-block-patterns-registry-oracle-fixture.v1.json",
      "receipts/wp-core/wphx-314-06-block-hooks-insertion-oracle-fixture.v1.json"
    ].filter(existsSync),
    validation_result: validationResult,
    manifest_sha256: sha256(JSON.stringify(manifest)),
    ownership_sha256: sha256(JSON.stringify(ownership))
  };

  writeJsonChecked(OUT, manifest);
  writeJsonChecked(OWNERSHIP, ownership);
  writeJsonChecked(RECEIPT, receipt);

  console.log(JSON.stringify(validationResult, null, 2));
}

main();
