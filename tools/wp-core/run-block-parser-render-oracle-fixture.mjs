#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-bxs",
  external_ref: "WPHX-314.03",
  title: "WPHX-314.03 - Add block parser/render oracle fixture"
};
const RECORDED_AT = "2026-06-29T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-block-parser-render-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-314-03";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const OUT = "manifests/wp-core/wphx-314-03-block-parser-render-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-314-03-block-parser-render-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-314-03-block-parser-render-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-314-01-blocks-interactivity-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-314-02-blocks-interactivity-adapter-contract-candidate.v1.json";

const SOURCE_FILES = [
  "src/wp-includes/class-wp-block-parser-block.php",
  "src/wp-includes/class-wp-block-parser-frame.php",
  "src/wp-includes/class-wp-block-parser.php",
  "src/wp-includes/class-wp-block-type.php",
  "src/wp-includes/class-wp-block-type-registry.php",
  "src/wp-includes/class-wp-block-list.php",
  "src/wp-includes/class-wp-block.php",
  "src/wp-includes/blocks.php"
];
const COVERED_SYMBOLS = [
  "parse_blocks",
  "serialize_blocks",
  "serialize_block",
  "serialize_block_attributes",
  "get_comment_delimited_block_content",
  "strip_core_block_namespace",
  "do_blocks",
  "render_block",
  "register_block_type",
  "WP_Block_Parser",
  "WP_Block_Parser_Block",
  "WP_Block_Parser_Frame",
  "WP_Block_Type",
  "WP_Block_Type_Registry",
  "WP_Block_List",
  "WP_Block",
  "pre_render_block",
  "render_block_data",
  "render_block_context",
  "render_block",
  "render_block_{$name}"
];
const CASES = [
  { id: "block-parser:freeform-and-serialized", focus: "freeform plus serialized paragraph parse shape and serialization" },
  { id: "block-parser:nested-roundtrip", focus: "nested group/paragraph parse tree, innerContent markers, and serialize roundtrip" },
  { id: "block-render:dynamic-callback", focus: "registered dynamic callback, default attributes, content, block instance, and render filters" },
  { id: "block-render:pre-render-filter", focus: "pre_render_block short-circuit before WP_Block instantiation" },
  { id: "block-render:do-blocks", focus: "do_blocks parse/render aggregation and wpautop hook removal handoff" }
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
$GLOBALS['wphx_case']    = $case;
$GLOBALS['wphx_filters'] = array();
$GLOBALS['wphx_actions'] = array();
$GLOBALS['wphx_assets']  = array();
$GLOBALS['wphx_wrong']   = array();

define( 'ABSPATH', __DIR__ . '/' );
define( 'WPINC', 'wp-includes' );

class WP_Post {
\tpublic $ID = 77;
\tpublic $post_type = 'post';
}

class WP_Error {
\tprivate $message;

\tpublic function __construct( $code = 'error', $message = 'error' ) {
\t\t$this->message = $message;
\t}

\tpublic function get_error_message() {
\t\treturn $this->message;
\t}
}

class WP_Block_Supports {
\tpublic static $block_to_render = null;
}

function __( $value ) {
\treturn $value;
}

function _doing_it_wrong( $function_name, $message, $version ) {
\t$GLOBALS['wphx_wrong'][] = compact( 'function_name', 'message', 'version' );
}

function wp_json_encode( $value, $flags = 0, $depth = 512 ) {
\treturn json_encode( $value, $flags, $depth );
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

function rest_validate_value_from_schema( $value, $schema, $param = '' ) {
\tif ( isset( $schema['type'] ) ) {
\t\tif ( 'string' === $schema['type'] && ! is_string( $value ) ) {
\t\t\treturn new WP_Error( 'invalid_type', 'invalid string' );
\t\t}
\t\tif ( 'number' === $schema['type'] && ! is_numeric( $value ) ) {
\t\t\treturn new WP_Error( 'invalid_type', 'invalid number' );
\t\t}
\t}
\treturn true;
}

function is_wp_error( $thing ) {
\treturn $thing instanceof WP_Error;
}

function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_filters'][] = array(
\t\t'hook'      => $hook_name,
\t\t'arg_count' => count( $args ) + 1,
\t);

\tif ( 'block_parser_class' === $hook_name ) {
\t\treturn $value;
\t}
\tif ( 'pre_render_block' === $hook_name && 'block-render:pre-render-filter' === $GLOBALS['wphx_case'] ) {
\t\treturn 'PRE:' . ( $args[0]['blockName'] ?? 'none' );
\t}
\tif ( 'render_block_context' === $hook_name ) {
\t\t$value['fixture/context'] = 'ctx';
\t\treturn $value;
\t}
\tif ( 'render_block' === $hook_name && is_string( $value ) ) {
\t\treturn $value . '|filter:render_block';
\t}
\tif ( str_starts_with( $hook_name, 'render_block_' ) && is_string( $value ) ) {
\t\treturn $value . '|filter:' . $hook_name;
\t}
\treturn $value;
}

function has_filter( $hook_name, $callback = false ) {
\tif ( 'the_content' === $hook_name && 'wpautop' === $callback && 'block-render:do-blocks' === $GLOBALS['wphx_case'] ) {
\t\treturn 10;
\t}
\tif ( 'the_content' === $hook_name && '_restore_wpautop_hook' === $callback ) {
\t\treturn 11;
\t}
\treturn false;
}

function doing_filter( $hook_name = null ) {
\treturn 'the_content' === $hook_name && 'block-render:do-blocks' === $GLOBALS['wphx_case'];
}

function remove_filter( $hook_name, $callback, $priority = 10 ) {
\t$GLOBALS['wphx_actions'][] = array( 'hook' => 'remove_filter:' . $hook_name, 'callback' => $callback, 'priority' => $priority );
\treturn true;
}

function add_filter( $hook_name, $callback, $priority = 10 ) {
\t$GLOBALS['wphx_actions'][] = array( 'hook' => 'add_filter:' . $hook_name, 'callback' => $callback, 'priority' => $priority );
\treturn true;
}

function did_action( $hook_name ) {
\treturn 0;
}

function get_block_bindings_supported_attributes( $block_type ) {
\treturn array();
}

function get_block_bindings_source( $source ) {
\treturn null;
}

function wp_interactivity_process_directives( $content ) {
\treturn 'directives:' . $content;
}

function wp_enqueue_script( $handle ) {
\t$GLOBALS['wphx_assets'][] = array( 'script', $handle );
}

function wp_enqueue_script_module( $handle ) {
\t$GLOBALS['wphx_assets'][] = array( 'script_module', $handle );
}

function wp_enqueue_style( $handle ) {
\t$GLOBALS['wphx_assets'][] = array( 'style', $handle );
}

function wp_dequeue_script( $handle ) {
\t$GLOBALS['wphx_assets'][] = array( 'dequeue_script', $handle );
}

function wp_dequeue_script_module( $handle ) {
\t$GLOBALS['wphx_assets'][] = array( 'dequeue_script_module', $handle );
}

function wp_dequeue_style( $handle ) {
\t$GLOBALS['wphx_assets'][] = array( 'dequeue_style', $handle );
}

function wp_styles() {
\tstatic $styles;
\tif ( ! $styles ) {
\t\t$styles = (object) array( 'queue' => array() );
\t}
\treturn $styles;
}

function wp_scripts() {
\tstatic $scripts;
\tif ( ! $scripts ) {
\t\t$scripts = (object) array( 'queue' => array() );
\t}
\treturn $scripts;
}

class WPHX_Script_Modules {
\tprivate $queue = array();

\tpublic function get_queue() {
\t\treturn $this->queue;
\t}
}

function wp_script_modules() {
\tstatic $modules;
\tif ( ! $modules ) {
\t\t$modules = new WPHX_Script_Modules();
\t}
\treturn $modules;
}

require __DIR__ . '/wp-includes/class-wp-block-parser-block.php';
require __DIR__ . '/wp-includes/class-wp-block-parser-frame.php';
require __DIR__ . '/wp-includes/class-wp-block-parser.php';
require __DIR__ . '/wp-includes/class-wp-block-type.php';
require __DIR__ . '/wp-includes/class-wp-block-type-registry.php';
require __DIR__ . '/wp-includes/class-wp-block-list.php';
require __DIR__ . '/wp-includes/class-wp-block.php';
require __DIR__ . '/wp-includes/blocks.php';

function wphx_summarize_blocks( $blocks ) {
\t$out = array();
\tforeach ( $blocks as $block ) {
\t\t$out[] = array(
\t\t\t'name'        => $block['blockName'],
\t\t\t'attrs'       => $block['attrs'],
\t\t\t'innerHTML'   => $block['innerHTML'],
\t\t\t'innerCount'  => count( $block['innerBlocks'] ),
\t\t\t'contentTags' => array_map(
\t\t\t\tfunction ( $part ) {
\t\t\t\t\treturn is_null( $part ) ? null : substr( $part, 0, 28 );
\t\t\t\t},
\t\t\t\t$block['innerContent']
\t\t\t),
\t\t);
\t}
\treturn $out;
}

function wphx_register_dynamic_block() {
\tregister_block_type(
\t\t'wphx/dynamic',
\t\tarray(
\t\t\t'attributes'      => array(
\t\t\t\t'message' => array(
\t\t\t\t\t'type'    => 'string',
\t\t\t\t\t'default' => 'default-message',
\t\t\t\t),
\t\t\t),
\t\t\t'uses_context'    => array( 'fixture/context' ),
\t\t\t'render_callback' => function ( $attributes, $content, $block ) {
\t\t\t\treturn 'DYNAMIC:' . $attributes['message'] . ':' . $content . ':ctx=' . ( $block->context['fixture/context'] ?? 'none' );
\t\t\t},
\t\t)
\t);
}

function wphx_emit( $payload ) {
\techo json_encode(
\t\tarray_merge(
\t\t\tarray(
\t\t\t\t'case'    => $GLOBALS['wphx_case'],
\t\t\t\t'filters' => $GLOBALS['wphx_filters'],
\t\t\t\t'actions' => $GLOBALS['wphx_actions'],
\t\t\t\t'assets'  => $GLOBALS['wphx_assets'],
\t\t\t\t'wrong'   => $GLOBALS['wphx_wrong'],
\t\t\t),
\t\t\t$payload
\t\t),
\t\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
\t);
}

switch ( $case ) {
\tcase 'block-parser:freeform-and-serialized':
\t\t$content = "Before\\n<!-- wp:paragraph {\\\"align\\\":\\\"center\\\"} --><p>Hello</p><!-- /wp:paragraph -->\\nAfter";
\t\t$blocks  = parse_blocks( $content );
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'summary'    => wphx_summarize_blocks( $blocks ),
\t\t\t\t'serialized' => serialize_blocks( $blocks ),
\t\t\t)
\t\t);
\t\tbreak;

\tcase 'block-parser:nested-roundtrip':
\t\t$content = '<!-- wp:group {"layout":{"type":"constrained"}} --><div class="wp-block-group"><!-- wp:paragraph --><p>Nested</p><!-- /wp:paragraph --></div><!-- /wp:group -->';
\t\t$blocks  = parse_blocks( $content );
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'summary'    => wphx_summarize_blocks( $blocks ),
\t\t\t\t'child'      => wphx_summarize_blocks( $blocks[0]['innerBlocks'] ),
\t\t\t\t'serialized' => serialize_blocks( $blocks ),
\t\t\t)
\t\t);
\t\tbreak;

\tcase 'block-render:dynamic-callback':
\t\twphx_register_dynamic_block();
\t\t$parsed = parse_blocks( '<!-- wp:wphx/dynamic --><span>Inner</span><!-- /wp:wphx/dynamic -->' )[0];
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'rendered' => render_block( $parsed ),
\t\t\t)
\t\t);
\t\tbreak;

\tcase 'block-render:pre-render-filter':
\t\t$parsed = parse_blocks( '<!-- wp:wphx/unknown --><p>Skip</p><!-- /wp:wphx/unknown -->' )[0];
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'rendered' => render_block( $parsed ),
\t\t\t)
\t\t);
\t\tbreak;

\tcase 'block-render:do-blocks':
\t\twphx_register_dynamic_block();
\t\t$content = '<!-- wp:wphx/dynamic {"message":"custom"} --><strong>Body</strong><!-- /wp:wphx/dynamic -->';
\t\twphx_emit(
\t\t\tarray(
\t\t\t\t'rendered' => do_blocks( $content ),
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
  return JSON.parse(command("php", [`${root}/probe.php`, id]));
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-314-block-parser-render-oracle-fixture`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function setupRoot(root) {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  mirrorSources(root);
  writeProbe(root);
}

function normalizeRun(run) {
  return {
    case: run.case,
    summary: run.summary,
    child: run.child,
    serialized: run.serialized,
    rendered: run.rendered,
    filters: run.filters,
    actions: run.actions,
    assets: run.assets,
    wrong: run.wrong
  };
}

try {
  setupRoot(ORACLE_ROOT);
  setupRoot(CANDIDATE_ROOT);
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
  schema: "wphx.wp-core-block-parser-render-oracle-fixture.v1",
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
      browser_or_gutenberg_ownership_claimed: false,
      removal_gate:
        "Replace copied candidate PHP with Haxe-owned parser/render decisions plus generated original-path adapters and rerun this oracle fixture before claiming public PHP ownership."
    }
  },
  runs,
  remaining_gaps: [
    {
      id: "block-supports-bindings-interactivity-full-semantics-not-covered",
      owner: ISSUE.external_ref,
      detail:
        "The fixture stubs support, binding, asset, and interactivity boundaries to keep parser/render behavior deterministic. Dedicated supports, bindings, style engine, HTML API, interactivity, and core block renderer fixtures remain required."
    },
    {
      id: "installed-block-distribution-not-covered",
      owner: ISSUE.external_ref,
      detail:
        "No installed front-end, admin/editor, REST, browser/Gutenberg package, theme.json, global styles, or database-backed block behavior is claimed."
    },
    {
      id: "public-php-adapter-not-generated",
      owner: ISSUE.external_ref,
      detail:
        "No original-path block parser/render public PHP adapter replacement is claimed; candidate files are copied upstream PHP source for bridge evidence."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    case_count: runs.length,
    covered_symbol_count: COVERED_SYMBOLS.length,
    source_file_count: SOURCE_FILES.length,
    oracle_candidate_match: allMatched,
    public_php_replacement_claimed: false
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const ownership = {
  schema: "wphx.ownership-manifest.v1",
  manifest_id: "ownership:wp-core/block-parser-render-oracle-fixture",
  issue: {
    id: ISSUE.id,
    external_ref: ISSUE.external_ref
  },
  unit: {
    kind: "oracle_fixture",
    name: "block parser, serializer, do_blocks, render_block, dynamic callback, and render-filter behavior",
    area: "wp-includes/blocks.php wp-includes/class-wp-block*.php",
    public_contract:
      "This fixture mirrors upstream WordPress PHP into oracle and candidate roots to capture parser/render behavior. It does not claim Haxe-owned runtime logic or public PHP ABI replacement."
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
      "Promote parser/render decisions into Haxe-owned implementation and generated original-path PHP adapters, then rerun parser/render, supports, bindings, interactivity, installed distribution, and upstream PHPUnit gates."
  },
  owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
  generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
  verification: {
    oracle_commands: [
      "npm run wp:core:wphx-314-block-parser-render-oracle-fixture",
      "npm run wp:core:wphx-314-block-parser-render-oracle-fixture:check",
      "npm run receipts:validate"
    ],
    receipt_refs: ["receipt:wphx-314-03-block-parser-render-oracle-fixture"],
    manifest_digest: sha256(manifestText)
  },
  notes:
    "Support, binding, asset, and interactivity boundaries are stubbed deliberately; this fixture is parser/render bridge evidence, not complete WPHX-314 ownership."
};
const ownershipText = JSON.stringify(ownership, null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-314-03-block-parser-render-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "block parser/render oracle fixture manifest" },
    { path: OWNERSHIP, role: "block parser/render oracle fixture ownership manifest" },
    { path: RUNNER, role: "deterministic oracle/candidate runner and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-314-block-parser-render-oracle-fixture",
    "npm run wp:core:wphx-314-block-parser-render-oracle-fixture:check",
    "npm run receipts:validate"
  ],
  related_receipts: [
    "receipt:wphx-314-01-blocks-interactivity-surface",
    "receipt:wphx-314-02-blocks-interactivity-adapter-contract-candidate"
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
