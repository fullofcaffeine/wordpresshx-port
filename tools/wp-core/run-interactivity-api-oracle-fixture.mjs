#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.20.3",
  external_ref: "WPHX-314.09",
  title: "WPHX-314.09 - Add interactivity API oracle fixture"
};
const RECORDED_AT = "2026-06-29T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-interactivity-api-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-314-09";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const OUT = "manifests/wp-core/wphx-314-09-interactivity-api-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-314-09-interactivity-api-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-314-09-interactivity-api-oracle-fixture.v1.json";
const PRIOR_EVIDENCE = [
  "manifests/wp-core/wphx-314-01-blocks-interactivity-surface.v1.json",
  "manifests/wp-core/wphx-314-02-blocks-interactivity-adapter-contract-candidate.v1.json",
  "manifests/wp-core/wphx-314-03-block-parser-render-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-04-block-supports-bindings-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-05-block-patterns-registry-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-06-block-hooks-insertion-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-07-style-engine-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-08-html-api-tag-processor-oracle-fixture.v1.json"
];

const SOURCE_FILES = [
  "src/wp-includes/class-wp-token-map.php",
  "src/wp-includes/html-api/html5-named-character-references.php",
  "src/wp-includes/html-api/class-wp-html-attribute-token.php",
  "src/wp-includes/html-api/class-wp-html-span.php",
  "src/wp-includes/html-api/class-wp-html-text-replacement.php",
  "src/wp-includes/html-api/class-wp-html-decoder.php",
  "src/wp-includes/html-api/class-wp-html-tag-processor.php",
  "src/wp-includes/interactivity-api/class-wp-interactivity-api-directives-processor.php",
  "src/wp-includes/interactivity-api/class-wp-interactivity-api.php",
  "src/wp-includes/interactivity-api/interactivity-api.php"
];
const COVERED_SYMBOLS = [
  "wp_interactivity",
  "wp_interactivity_process_directives",
  "wp_interactivity_state",
  "wp_interactivity_config",
  "wp_interactivity_data_wp_context",
  "wp_interactivity_get_context",
  "wp_interactivity_get_element",
  "WP_Interactivity_API",
  "WP_Interactivity_API::state",
  "WP_Interactivity_API::config",
  "WP_Interactivity_API::filter_script_module_interactivity_data",
  "WP_Interactivity_API::filter_script_module_interactivity_router_data",
  "WP_Interactivity_API::get_context",
  "WP_Interactivity_API::get_element",
  "WP_Interactivity_API::add_load_on_client_navigation_attribute_to_script_modules",
  "WP_Interactivity_API::add_client_navigation_support_to_script_module",
  "WP_Interactivity_API::process_directives",
  "WP_Interactivity_API::print_router_markup",
  "WP_Interactivity_API_Directives_Processor",
  "WP_Interactivity_API_Directives_Processor::get_content_between_balanced_template_tags",
  "WP_Interactivity_API_Directives_Processor::set_content_between_balanced_tags",
  "WP_Interactivity_API_Directives_Processor::append_content_after_template_tag_closer",
  "WP_Interactivity_API_Directives_Processor::skip_to_tag_closer",
  "WP_Interactivity_API_Directives_Processor::next_balanced_tag_closer_tag",
  "WP_Interactivity_API_Directives_Processor::has_and_visits_its_closer_tag",
  "data-wp-interactive",
  "data-wp-context",
  "data-wp-bind",
  "data-wp-class",
  "data-wp-style",
  "data-wp-text",
  "data-wp-each",
  "data-wp-router-region"
];
const CASES = [
  { id: "interactivity:state-config-client-data", focus: "state/config merging, client-data filters, router data, and client-navigation script attributes" },
  { id: "interactivity:data-context-helper", focus: "data-wp-context attribute helper encoding and outside-processing diagnostics" },
  { id: "interactivity:directives-bind-class-style-text", focus: "server directive processing for bind, class, style, text, context, and element access" },
  { id: "interactivity:each-template", focus: "template data-wp-each expansion and data-wp-each-child marker emission" },
  { id: "interactivity:router-svg-unbalanced", focus: "router region side effects, SVG skip diagnostics, and unbalanced input fallback" },
  { id: "interactivity:directives-processor-balanced-template", focus: "directive processor balanced template helper methods and closer navigation" }
];

function command(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 80
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
$GLOBALS['wphx_deprecated'] = array();
$GLOBALS['wphx_filters'] = array();
$GLOBALS['wphx_actions'] = array();
$GLOBALS['wphx_styles'] = array();
$GLOBALS['wp_interactivity'] = null;

define( 'ABSPATH', __DIR__ . '/' );
define( 'WPINC', 'wp-includes' );

function __( $value ) { return $value; }
function _doing_it_wrong( $function_name, $message, $version ) { $GLOBALS['wphx_wrong'][] = compact( 'function_name', 'message', 'version' ); }
function _deprecated_function( $function_name, $version, $replacement = '' ) { $GLOBALS['wphx_deprecated'][] = compact( 'function_name', 'version', 'replacement' ); }
function wp_json_encode( $value, $flags = 0, $depth = 512 ) { return json_encode( $value, $flags, $depth ); }
function wp_has_noncharacters( $text ) { return false; }
function wp_kses_uri_attributes() { return array( 'action', 'background', 'cite', 'href', 'longdesc', 'poster', 'src', 'usemap' ); }
function esc_attr( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' ); }
function esc_html( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' ); }
function esc_url( $url ) {
\t$url = trim( (string) $url );
\tif ( preg_match( '/^javascript:/i', $url ) ) {
\t\treturn '';
\t}
\treturn strtr( $url, array( '<' => '%3C', '>' => '%3E', '"' => '%22', "'" => '%27' ) );
}
function add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) { $GLOBALS['wphx_filters'][] = compact( 'hook_name', 'priority', 'accepted_args' ); return true; }
function add_action( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) { $GLOBALS['wphx_actions'][] = compact( 'hook_name', 'priority', 'accepted_args' ); return true; }
function wp_register_style( $handle, $src = false, $deps = array(), $ver = false, $media = 'all' ) { $GLOBALS['wphx_styles'][] = array( 'op' => 'register', 'handle' => $handle, 'src' => $src ); return true; }
function wp_add_inline_style( $handle, $data ) { $GLOBALS['wphx_styles'][] = array( 'op' => 'inline', 'handle' => $handle, 'bytes' => strlen( $data ), 'has_keyframe' => str_contains( $data, '@keyframes wp-interactivity-router-loading-bar-start-animation' ) ); return true; }
function wp_enqueue_style( $handle ) { $GLOBALS['wphx_styles'][] = array( 'op' => 'enqueue', 'handle' => $handle ); return true; }
function get_self_link() { return 'https://example.test/wp-json/wp/v2/pages/7'; }

require ABSPATH . WPINC . '/class-wp-token-map.php';
require ABSPATH . WPINC . '/html-api/html5-named-character-references.php';
require ABSPATH . WPINC . '/html-api/class-wp-html-attribute-token.php';
require ABSPATH . WPINC . '/html-api/class-wp-html-span.php';
require ABSPATH . WPINC . '/html-api/class-wp-html-text-replacement.php';
require ABSPATH . WPINC . '/html-api/class-wp-html-decoder.php';
require ABSPATH . WPINC . '/html-api/class-wp-html-tag-processor.php';

class WP_HTML_Processor {
\tpublic static function is_void( $tag_name ) {
\t\treturn in_array( strtoupper( (string) $tag_name ), array( 'AREA', 'BASE', 'BR', 'COL', 'EMBED', 'HR', 'IMG', 'INPUT', 'LINK', 'META', 'SOURCE', 'TRACK', 'WBR' ), true );
\t}
}

require ABSPATH . WPINC . '/interactivity-api/class-wp-interactivity-api-directives-processor.php';
require ABSPATH . WPINC . '/interactivity-api/class-wp-interactivity-api.php';
require ABSPATH . WPINC . '/interactivity-api/interactivity-api.php';

function reset_api() {
\t$GLOBALS['wp_interactivity'] = new WP_Interactivity_API();
\t$GLOBALS['wphx_wrong'] = array();
\t$GLOBALS['wphx_deprecated'] = array();
\t$GLOBALS['wphx_filters'] = array();
\t$GLOBALS['wphx_actions'] = array();
\t$GLOBALS['wphx_styles'] = array();
\treturn $GLOBALS['wp_interactivity'];
}

function state_config_client_data_case() {
\t$api = reset_api();
\t$state_one = wp_interactivity_state( 'demo/store', array( 'count' => 1, 'nested' => array( 'a' => 1 ) ) );
\t$state_two = wp_interactivity_state( 'demo/store', array( 'nested' => array( 'b' => 2 ), 'items' => array( 'red', 'blue' ) ) );
\t$config = wp_interactivity_config( 'demo/store', array( 'theme' => array( 'dark' => true ) ) );
\twp_interactivity_config( 'empty/store', array() );
\t$client_data = $api->filter_script_module_interactivity_data( array( 'seed' => true ) );
\t$router_data = $api->filter_script_module_interactivity_router_data( array() );
\t$api->add_client_navigation_support_to_script_module( '@wordpress/demo' );
\t$attrs_supported = $api->add_load_on_client_navigation_attribute_to_script_modules( array( 'type' => 'module', 'id' => '@wordpress/demo-js-module' ) );
\t$attrs_other = $api->add_load_on_client_navigation_attribute_to_script_modules( array( 'type' => 'module', 'id' => '@wordpress/other-js-module' ) );
\t$api->add_hooks();
\tob_start();
\t$api->print_client_interactivity_data();
\t$printed = ob_get_clean();
\treturn array(
\t\t'state_one'       => $state_one,
\t\t'state_two'       => $state_two,
\t\t'config'          => $config,
\t\t'client_data'     => $client_data,
\t\t'router_data'     => $router_data,
\t\t'attrs_supported' => $attrs_supported,
\t\t'attrs_other'     => $attrs_other,
\t\t'filters'         => $GLOBALS['wphx_filters'],
\t\t'deprecated'      => $GLOBALS['wphx_deprecated'],
\t\t'printed'         => $printed,
\t);
}

function data_context_helper_case() {
\t$api = reset_api();
\t$context_attr = wp_interactivity_data_wp_context( array( 'isOpen' => true, 'label' => '<Door & Bell>' ), 'demo/store' );
\t$empty_attr = wp_interactivity_data_wp_context( array() );
\t$outside_context = wp_interactivity_get_context();
\t$outside_element = wp_interactivity_get_element();
\t$bad_state = wp_interactivity_state( null, array( 'x' => 1 ) );
\treturn array(
\t\t'context_attr'    => $context_attr,
\t\t'empty_attr'      => $empty_attr,
\t\t'outside_context' => $outside_context,
\t\t'outside_element' => $outside_element,
\t\t'bad_state'       => $bad_state,
\t\t'wrong'           => $GLOBALS['wphx_wrong'],
\t);
}

function directives_bind_class_style_text_case() {
\t$api = reset_api();
\twp_interactivity_state(
\t\t'demo/store',
\t\tarray(
\t\t\t'label'   => 'Server <Label>',
\t\t\t'isOpen'  => true,
\t\t\t'isBusy'  => false,
\t\t\t'color'   => 'red',
\t\t\t'url'     => 'https://example.test/next?x=1&y=2',
\t\t\t'derived' => function () { return 'Derived Value'; },
\t\t)
\t);
\t$html = '<div data-wp-interactive="demo/store" data-wp-context=\\'{"local":"ctx"}\\'><a class="old" style="margin:0;color:green;" data-wp-bind--href="state.url" data-wp-bind--aria-expanded="state.isOpen" data-wp-bind--hidden="state.isBusy" data-wp-class--is-open="state.isOpen" data-wp-class--is-closed="!state.isOpen" data-wp-style--color="state.color" data-wp-text="state.derived">Old</a></div>';
\t$processed = wp_interactivity_process_directives( $html );
\t$data = $api->filter_script_module_interactivity_data( array() );
\treturn array(
\t\t'processed' => $processed,
\t\t'data'      => $data,
\t\t'wrong'     => $GLOBALS['wphx_wrong'],
\t);
}

function each_template_case() {
\t$api = reset_api();
\twp_interactivity_state( 'demo/list', array( 'items' => array( array( 'name' => 'Alpha' ), array( 'name' => 'Beta & Co' ) ) ) );
\t$html = '<div data-wp-interactive="demo/list"><template data-wp-each--product="state.items"><span data-wp-text="context.product.name">Fallback</span></template></div>';
\treturn array(
\t\t'processed' => wp_interactivity_process_directives( $html ),
\t\t'wrong'     => $GLOBALS['wphx_wrong'],
\t);
}

function router_svg_unbalanced_case() {
\t$api = reset_api();
\t$router = wp_interactivity_process_directives( '<main data-wp-interactive="demo/router"><section data-wp-router-region><p>Body</p></section></main>' );
\t$svg = wp_interactivity_process_directives( '<div data-wp-interactive="demo/svg"><svg data-wp-text="state.label"><text data-wp-text="state.label">No</text></svg><span>After</span></div>' );
\t$unbalanced = wp_interactivity_process_directives( '<div data-wp-interactive="demo/bad"><span data-wp-text="state.label"></div>' );
\treturn array(
\t\t'router'     => $router,
\t\t'actions'    => $GLOBALS['wphx_actions'],
\t\t'styles'     => $GLOBALS['wphx_styles'],
\t\t'state'      => $api->filter_script_module_interactivity_data( array() ),
\t\t'svg'        => $svg,
\t\t'unbalanced' => $unbalanced,
\t\t'wrong'      => $GLOBALS['wphx_wrong'],
\t);
}

function directives_processor_balanced_template_case() {
\treset_api();
\t$p = new WP_Interactivity_API_Directives_Processor( '<template><span>One</span><span>Two</span></template><p>After</p>' );
\t$p->next_tag( 'template' );
\t$content = $p->get_content_between_balanced_template_tags();
\t$is_closer = $p->is_tag_closer();
\t$appended = $p->append_content_after_template_tag_closer( '<em>Appended</em>' );
\t$updated_after_append = $p->get_updated_html();
\t$q = new WP_Interactivity_API_Directives_Processor( '<template><strong>Old</strong></template>' );
\t$q->next_tag( 'template' );
\t$set = $q->set_content_between_balanced_tags( 'New & Safe' );
\t$updated_after_set = $q->get_updated_html();
\t$r = new WP_Interactivity_API_Directives_Processor( '<div><div><span>deep</span></div></div><p>after</p>' );
\t$r->next_tag( 'div' );
\t$balanced = $r->next_balanced_tag_closer_tag();
\treturn array(
\t\t'content'              => $content,
\t\t'is_closer'            => $is_closer,
\t\t'appended'             => $appended,
\t\t'updated_after_append' => $updated_after_append,
\t\t'set'                  => $set,
\t\t'updated_after_set'    => $updated_after_set,
\t\t'balanced'             => $balanced,
\t\t'balanced_tag'         => $r->get_tag(),
\t\t'balanced_closer'      => $r->is_tag_closer(),
\t);
}

$cases = array(
\t'interactivity:state-config-client-data'          => 'state_config_client_data_case',
\t'interactivity:data-context-helper'               => 'data_context_helper_case',
\t'interactivity:directives-bind-class-style-text'  => 'directives_bind_class_style_text_case',
\t'interactivity:each-template'                     => 'each_template_case',
\t'interactivity:router-svg-unbalanced'             => 'router_svg_unbalanced_case',
\t'interactivity:directives-processor-balanced-template' => 'directives_processor_balanced_template_case',
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
      throw new Error(`${path} is missing; run npm run wp:core:wphx-314-interactivity-api-oracle-fixture`);
    }
    if (readFileSync(path, "utf8") !== rendered) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-314-interactivity-api-oracle-fixture`);
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
    throw new Error("Oracle and candidate interactivity API observations diverged");
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
    schema: "wphx.wp_core.interactivity_api_oracle_fixture.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: {
      path: RUNNER,
      sha256: sha256File(RUNNER),
      check_command: "npm run wp:core:wphx-314-interactivity-api-oracle-fixture:check"
    },
    evidence_class: "copied_oracle_candidate_php_fixture",
    artifact_scope: {
      domain: "blocks_interactivity_api",
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
        "WordPress 7.0 PHP interactivity API sources and the required HTML tag processor dependencies are mirrored into oracle and candidate roots.",
        "Core helpers outside the interactivity API ownership boundary are deterministic stubs for translation, diagnostics, escaping, URL filtering, style enqueueing, hooks, self links, JSON, and the bounded WP_HTML_Processor::is_void lookup.",
        "The fixture observes state/config merging, client-data filters, router module data, script-module attributes, context helper encoding, server directive processing, data-wp-each expansion, router side effects, SVG skip diagnostics, unbalanced fallback, and directive-processor balanced-template helpers.",
        "The browser/client @wordpress/interactivity runtime, Gutenberg package behavior, installed block rendering, and full HTML5 processor/tree ownership remain outside this slice."
      ]
    },
    runs: {
      oracle,
      candidate,
      comparable_sha256: sha256(JSON.stringify(oracleComparable))
    },
    remaining_gaps: [
      "Haxe-owned runtime implementation for the interactivity API is not claimed.",
      "Generated original-path public PHP adapter replacement is not claimed.",
      "Browser/client @wordpress/interactivity package ownership, installed block rendering, selected upstream PHPUnit pass/pass, editor/browser behavior, and Gutenberg package ownership remain later gates.",
      "Full HTML5 processor/tree ownership remains outside this fixture."
    ],
    ownership_manifest: OWNERSHIP,
    validation_result: validationResult
  };

  const ownership = {
    schema: "wphx.ownership_manifest.v1",
    manifest_id: "wphx-314-09-interactivity-api-oracle-fixture",
    issue: ISSUE,
    unit: {
      kind: "wp_core_oracle_fixture",
      domain: "blocks_interactivity_api",
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
      removal_gate: "Replace the copied public PHP fixture with typed Haxe-owned interactivity API decisions plus WPHX Adapter IR/generated original-path public PHP evidence, or explicitly supersede this bridge with an accepted backend/custom-target improvement.",
      non_claims: manifest.remaining_gaps
    },
    owned_paths: [],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, `${ORACLE_ROOT}/probe.php`, `${CANDIDATE_ROOT}/probe.php`],
    verification: validationResult,
    notes: [
      "This fixture is a behavior target for future Haxe ownership. It records PHP-side interactivity state/config, server directive processing, hydration data, router side effects, and balanced-template helper behavior.",
      "The fixture-owned Core helper stubs are deterministic harness boundaries, not replacement evidence for the WordPress hook/style systems, URL policy, full HTML5 processor, or browser interactivity runtime."
    ]
  };

  const receipt = {
    schema: "wphx.receipt.v1",
    id: "wphx-314-09-interactivity-api-oracle-fixture",
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
      "npm run wp:core:wphx-314-interactivity-api-oracle-fixture",
      "npm run wp:core:wphx-314-interactivity-api-oracle-fixture:check",
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
      "receipts/wp-core/wphx-314-06-block-hooks-insertion-oracle-fixture.v1.json",
      "receipts/wp-core/wphx-314-07-style-engine-oracle-fixture.v1.json",
      "receipts/wp-core/wphx-314-08-html-api-tag-processor-oracle-fixture.v1.json"
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
