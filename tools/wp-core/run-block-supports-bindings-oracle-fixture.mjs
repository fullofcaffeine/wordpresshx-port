#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-vxc",
  external_ref: "WPHX-314.04",
  title: "WPHX-314.04 - Add block supports and bindings oracle fixture"
};
const RECORDED_AT = "2026-06-29T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-block-supports-bindings-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-314-04";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const OUT = "manifests/wp-core/wphx-314-04-block-supports-bindings-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-314-04-block-supports-bindings-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-314-04-block-supports-bindings-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-314-01-blocks-interactivity-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-314-02-blocks-interactivity-adapter-contract-candidate.v1.json";
const PARSER_RENDER = "manifests/wp-core/wphx-314-03-block-parser-render-oracle-fixture.v1.json";

const SOURCE_FILES = [
  "src/wp-includes/class-wp-block-type.php",
  "src/wp-includes/class-wp-block-type-registry.php",
  "src/wp-includes/class-wp-block-list.php",
  "src/wp-includes/class-wp-block-bindings-source.php",
  "src/wp-includes/class-wp-block-bindings-registry.php",
  "src/wp-includes/block-bindings.php",
  "src/wp-includes/class-wp-block-supports.php",
  "src/wp-includes/blocks.php",
  "src/wp-includes/block-supports/utils.php",
  "src/wp-includes/block-supports/generated-classname.php",
  "src/wp-includes/block-supports/custom-classname.php",
  "src/wp-includes/block-supports/anchor.php",
  "src/wp-includes/block-supports/aria-label.php",
  "src/wp-includes/class-wp-block.php"
];
const COVERED_SYMBOLS = [
  "WP_Block_Supports",
  "WP_Block_Supports::register",
  "WP_Block_Supports::init",
  "WP_Block_Supports::apply_block_supports",
  "get_block_wrapper_attributes",
  "wp_should_skip_block_supports_serialization",
  "wp_get_block_default_classname",
  "wp_apply_generated_classname_support",
  "wp_register_custom_classname_support",
  "wp_apply_custom_classname_support",
  "wp_register_anchor_support",
  "wp_apply_anchor_support",
  "wp_register_aria_label_support",
  "wp_apply_aria_label_support",
  "block_has_support",
  "register_block_bindings_source",
  "unregister_block_bindings_source",
  "get_all_registered_block_bindings_sources",
  "get_block_bindings_source",
  "get_block_bindings_supported_attributes",
  "WP_Block_Bindings_Registry",
  "WP_Block_Bindings_Source",
  "WP_Block::render",
  "WP_Block::process_block_bindings",
  "render_block"
];
const CASES = [
  { id: "block-supports:wrapper-merge", focus: "generated/custom class, anchor, aria-label, and extra wrapper attribute merge" },
  { id: "block-supports:register-attributes", focus: "support modules registering className, anchor, and ariaLabel attributes" },
  { id: "block-supports:skip-aria-serialization", focus: "ariaLabel support skip-serialization suppressing wrapper aria-label" },
  { id: "block-bindings:supported-attributes-filters", focus: "static and filtered supported binding attributes" },
  { id: "block-bindings:source-render-context", focus: "registered binding source computing dynamic block attributes with context" },
  { id: "block-bindings:registry-validation", focus: "invalid, duplicate, unregister, and missing binding source registry behavior" }
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
$GLOBALS['wphx_case']            = $case;
$GLOBALS['wphx_filters']         = array();
$GLOBALS['wphx_actions']         = array();
$GLOBALS['wphx_assets']          = array();
$GLOBALS['wphx_wrong']           = array();
$GLOBALS['wphx_binding_calls']   = array();
$GLOBALS['wphx_last_attributes'] = array();

define( 'ABSPATH', __DIR__ . '/' );
define( 'WPINC', 'wp-includes' );

class WP_Post {
\tpublic $ID = 77;
\tpublic $post_type = 'post';
}

class WP_Error {
\tprivate $code;
\tprivate $message;

\tpublic function __construct( $code = 'error', $message = 'error' ) {
\t\t$this->code    = $code;
\t\t$this->message = $message;
\t}

\tpublic function get_error_code() {
\t\treturn $this->code;
\t}

\tpublic function get_error_message() {
\t\treturn $this->message;
\t}
}

function __( $value ) {
\treturn $value;
}

function _doing_it_wrong( $function_name, $message, $version ) {
\t$GLOBALS['wphx_wrong'][] = array(
\t\t'function' => $function_name,
\t\t'message'  => preg_replace( '/\\s+/', ' ', (string) $message ),
\t\t'version'  => $version,
\t);
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

function _wp_array_get( $array, $path, $default_value = null ) {
\tforeach ( $path as $path_element ) {
\t\tif ( ! is_array( $array ) || ! array_key_exists( $path_element, $array ) ) {
\t\t\treturn $default_value;
\t\t}
\t\t$array = $array[ $path_element ];
\t}
\treturn $array;
}

function rest_validate_value_from_schema( $value, $schema, $param = '' ) {
\tif ( isset( $schema['type'] ) ) {
\t\tif ( 'string' === $schema['type'] && ! is_string( $value ) ) {
\t\t\treturn new WP_Error( 'invalid_type', 'invalid string' );
\t\t}
\t\tif ( 'object' === $schema['type'] && ! is_array( $value ) ) {
\t\t\treturn new WP_Error( 'invalid_type', 'invalid object' );
\t\t}
\t}
\treturn true;
}

function is_wp_error( $thing ) {
\treturn $thing instanceof WP_Error;
}

function safecss_filter_attr( $css ) {
\treturn trim( preg_replace( '/\\s+/', ' ', (string) $css ) );
}

function esc_attr( $value ) {
\treturn htmlspecialchars( (string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' );
}

function wp_kses_post( $value ) {
\treturn (string) $value;
}

function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_filters'][] = array(
\t\t'hook'      => $hook_name,
\t\t'value'     => wphx_summarize( $value ),
\t\t'arg_count' => count( $args ) + 1,
\t);

\tif ( 'register_block_type_args' === $hook_name ) {
\t\treturn $value;
\t}
\tif ( 'block_default_classname' === $hook_name ) {
\t\treturn $value . ' filtered-default';
\t}
\tif ( 'render_block_context' === $hook_name ) {
\t\t$value['fixture/context'] = 'ctx:' . ( $args[0]['blockName'] ?? 'none' );
\t\treturn $value;
\t}
\tif ( 'block_bindings_supported_attributes' === $hook_name && 'core/paragraph' === ( $args[0] ?? '' ) ) {
\t\t$value[] = 'filteredAny';
\t\treturn array_values( array_unique( $value ) );
\t}
\tif ( 'block_bindings_supported_attributes_core/paragraph' === $hook_name ) {
\t\t$value[] = 'filteredDynamic';
\t\treturn array_values( array_unique( $value ) );
\t}
\tif ( 'block_bindings_source_value' === $hook_name && is_string( $value ) ) {
\t\treturn $value . '|filtered-source';
\t}
\tif ( 'render_block' === $hook_name || str_starts_with( $hook_name, 'render_block_' ) ) {
\t\treturn $value;
\t}
\treturn $value;
}

function has_filter( $hook_name, $callback = false ) {
\treturn false;
}

function doing_filter( $hook_name = null ) {
\treturn false;
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
\tstatic $styles = null;
\tif ( null === $styles ) {
\t\t$styles = (object) array( 'queue' => array() );
\t}
\treturn $styles;
}

function wp_scripts() {
\tstatic $scripts = null;
\tif ( null === $scripts ) {
\t\t$scripts = (object) array( 'queue' => array() );
\t}
\treturn $scripts;
}

function wp_script_modules() {
\tstatic $modules = null;
\tif ( null === $modules ) {
\t\t$modules = new class {
\t\t\tpublic $queue = array();
\t\t\tpublic function get_queue() {
\t\t\t\treturn $this->queue;
\t\t\t}
\t\t};
\t}
\treturn $modules;
}

function wphx_summarize( $value ) {
\tif ( $value instanceof WP_Block ) {
\t\treturn array( 'class' => 'WP_Block', 'name' => $value->name, 'context' => $value->context );
\t}
\tif ( $value instanceof WP_Block_Type ) {
\t\treturn array( 'class' => 'WP_Block_Type', 'name' => $value->name, 'supports' => $value->supports, 'attributes' => array_keys( (array) $value->attributes ) );
\t}
\tif ( $value instanceof WP_Block_Bindings_Source ) {
\t\treturn array( 'class' => 'WP_Block_Bindings_Source', 'name' => $value->name, 'label' => $value->label, 'uses_context' => $value->uses_context );
\t}
\tif ( $value instanceof WP_Error ) {
\t\treturn array( 'class' => 'WP_Error', 'code' => $value->get_error_code(), 'message' => $value->get_error_message() );
\t}
\tif ( is_array( $value ) ) {
\t\t$out = array();
\t\tforeach ( $value as $key => $item ) {
\t\t\t$out[ $key ] = wphx_summarize( $item );
\t\t}
\t\treturn $out;
\t}
\tif ( is_object( $value ) ) {
\t\treturn array( 'class' => get_class( $value ) );
\t}
\treturn $value;
}

function wphx_register_support_block( $name, $supports, $render_callback = null ) {
\treturn register_block_type(
\t\t$name,
\t\tarray(
\t\t\t'supports'        => $supports,
\t\t\t'attributes'      => array(
\t\t\t\t'className' => array( 'type' => 'string' ),
\t\t\t\t'anchor'    => array( 'type' => 'string' ),
\t\t\t\t'ariaLabel' => array( 'type' => 'string' ),
\t\t\t\t'metadata'  => array( 'type' => 'object' ),
\t\t\t),
\t\t\t'render_callback' => $render_callback,
\t\t)
\t);
}

require ABSPATH . WPINC . '/class-wp-block-type.php';
require ABSPATH . WPINC . '/class-wp-block-type-registry.php';
require ABSPATH . WPINC . '/class-wp-block-list.php';
require ABSPATH . WPINC . '/class-wp-block-bindings-source.php';
require ABSPATH . WPINC . '/class-wp-block-bindings-registry.php';
require ABSPATH . WPINC . '/block-bindings.php';
require ABSPATH . WPINC . '/class-wp-block-supports.php';
require ABSPATH . WPINC . '/blocks.php';
require ABSPATH . WPINC . '/block-supports/utils.php';
require ABSPATH . WPINC . '/block-supports/generated-classname.php';
require ABSPATH . WPINC . '/block-supports/custom-classname.php';
require ABSPATH . WPINC . '/block-supports/anchor.php';
require ABSPATH . WPINC . '/block-supports/aria-label.php';
require ABSPATH . WPINC . '/class-wp-block.php';

$result = array(
\t'case'    => $case,
\t'filters' => array(),
\t'actions' => array(),
\t'wrong'   => array(),
\t'output'  => null,
);

switch ( $case ) {
\tcase 'block-supports:wrapper-merge':
\t\twphx_register_support_block(
\t\t\t'wphx/supports',
\t\t\tarray(
\t\t\t\t'className'       => true,
\t\t\t\t'customClassName' => true,
\t\t\t\t'anchor'          => true,
\t\t\t\t'ariaLabel'       => true,
\t\t\t),
\t\t\tstatic function ( $attributes ) {
\t\t\t\t$GLOBALS['wphx_last_attributes'] = $attributes;
\t\t\t\treturn '<section ' . get_block_wrapper_attributes(
\t\t\t\t\tarray(
\t\t\t\t\t\t'class'      => 'extra user',
\t\t\t\t\t\t'style'      => ' color: red; ',
\t\t\t\t\t\t'data-extra' => '1',
\t\t\t\t\t)
\t\t\t\t) . '>wrapped</section>';
\t\t\t}
\t\t);
\t\t$result['output'] = array(
\t\t\t'html'       => render_block(
\t\t\t\tarray(
\t\t\t\t\t'blockName'    => 'wphx/supports',
\t\t\t\t\t'attrs'        => array(
\t\t\t\t\t\t'className' => 'alpha beta',
\t\t\t\t\t\t'anchor'    => 'fixture-anchor',
\t\t\t\t\t\t'ariaLabel' => 'Label <tag>',
\t\t\t\t\t),
\t\t\t\t\t'innerBlocks'  => array(),
\t\t\t\t\t'innerHTML'    => '',
\t\t\t\t\t'innerContent' => array(),
\t\t\t\t)
\t\t\t),
\t\t\t'attributes' => $GLOBALS['wphx_last_attributes'],
\t\t);
\t\tbreak;

\tcase 'block-supports:register-attributes':
\t\t$type = register_block_type(
\t\t\t'wphx/register-attrs',
\t\t\tarray(
\t\t\t\t'supports' => array(
\t\t\t\t\t'customClassName' => true,
\t\t\t\t\t'anchor'          => true,
\t\t\t\t\t'ariaLabel'       => true,
\t\t\t\t),
\t\t\t)
\t\t);
\t\tWP_Block_Supports::init();
\t\t$result['output'] = array(
\t\t\t'attributes' => array_keys( $type->attributes ),
\t\t\t'supports'   => $type->supports,
\t\t);
\t\tbreak;

\tcase 'block-supports:skip-aria-serialization':
\t\twphx_register_support_block(
\t\t\t'wphx/skip-aria',
\t\t\tarray(
\t\t\t\t'className' => true,
\t\t\t\t'ariaLabel' => array( '__experimentalSkipSerialization' => true ),
\t\t\t),
\t\t\tstatic function () {
\t\t\t\treturn '<div ' . get_block_wrapper_attributes() . '>skip</div>';
\t\t\t}
\t\t);
\t\t$result['output'] = array(
\t\t\t'html' => render_block(
\t\t\t\tarray(
\t\t\t\t\t'blockName'    => 'wphx/skip-aria',
\t\t\t\t\t'attrs'        => array( 'ariaLabel' => 'Hidden label' ),
\t\t\t\t\t'innerBlocks'  => array(),
\t\t\t\t\t'innerHTML'    => '',
\t\t\t\t\t'innerContent' => array(),
\t\t\t\t)
\t\t\t),
\t\t);
\t\tbreak;

\tcase 'block-bindings:supported-attributes-filters':
\t\t$result['output'] = array(
\t\t\t'paragraph' => get_block_bindings_supported_attributes( 'core/paragraph' ),
\t\t\t'image'     => get_block_bindings_supported_attributes( 'core/image' ),
\t\t\t'unknown'   => get_block_bindings_supported_attributes( 'wphx/unknown' ),
\t\t);
\t\tbreak;

\tcase 'block-bindings:source-render-context':
\t\tregister_block_type(
\t\t\t'core/paragraph',
\t\t\tarray(
\t\t\t\t'attributes'      => array(
\t\t\t\t\t'content'  => array( 'type' => 'string', 'default' => 'default-content' ),
\t\t\t\t\t'metadata' => array( 'type' => 'object' ),
\t\t\t\t),
\t\t\t\t'uses_context'    => array( 'fixture/context' ),
\t\t\t\t'render_callback' => static function ( $attributes, $content, $block ) {
\t\t\t\t\t$GLOBALS['wphx_last_attributes'] = $attributes;
\t\t\t\t\treturn 'BOUND:' . $attributes['content'] . ':ctx=' . ( $block->context['fixture/context'] ?? 'none' );
\t\t\t\t},
\t\t\t)
\t\t);
\t\tregister_block_bindings_source(
\t\t\t'wphx/source',
\t\t\tarray(
\t\t\t\t'label'              => 'Fixture source',
\t\t\t\t'uses_context'       => array( 'fixture/context' ),
\t\t\t\t'get_value_callback' => static function ( $source_args, $block_instance, $attribute_name ) {
\t\t\t\t\t$GLOBALS['wphx_binding_calls'][] = array(
\t\t\t\t\t\t'args'      => $source_args,
\t\t\t\t\t\t'attribute' => $attribute_name,
\t\t\t\t\t\t'context'   => $block_instance->context,
\t\t\t\t\t);
\t\t\t\t\treturn 'source:' . ( $source_args['key'] ?? 'none' ) . ':' . ( $block_instance->context['fixture/context'] ?? 'noctx' );
\t\t\t\t},
\t\t\t)
\t\t);
\t\t$result['output'] = array(
\t\t\t'html'          => render_block(
\t\t\t\tarray(
\t\t\t\t\t'blockName'    => 'core/paragraph',
\t\t\t\t\t'attrs'        => array(
\t\t\t\t\t\t'content'  => 'fallback',
\t\t\t\t\t\t'metadata' => array(
\t\t\t\t\t\t\t'bindings' => array(
\t\t\t\t\t\t\t\t'content' => array(
\t\t\t\t\t\t\t\t\t'source' => 'wphx/source',
\t\t\t\t\t\t\t\t\t'args'   => array( 'key' => 'alpha' ),
\t\t\t\t\t\t\t\t),
\t\t\t\t\t\t\t),
\t\t\t\t\t\t),
\t\t\t\t\t),
\t\t\t\t\t'innerBlocks'  => array(),
\t\t\t\t\t'innerHTML'    => '<p>fallback</p>',
\t\t\t\t\t'innerContent' => array( '<p>fallback</p>' ),
\t\t\t\t)
\t\t\t),
\t\t\t'attributes'    => $GLOBALS['wphx_last_attributes'],
\t\t\t'binding_calls' => $GLOBALS['wphx_binding_calls'],
\t\t\t'sources'       => array_keys( get_all_registered_block_bindings_sources() ),
\t\t);
\t\tbreak;

\tcase 'block-bindings:registry-validation':
\t\t$invalid_upper = register_block_bindings_source(
\t\t\t'WPHX/source',
\t\t\tarray(
\t\t\t\t'label'              => 'Invalid',
\t\t\t\t'get_value_callback' => static function () {
\t\t\t\t\treturn 'bad';
\t\t\t\t},
\t\t\t)
\t\t);
\t\t$missing_callback = register_block_bindings_source( 'wphx/missing-callback', array( 'label' => 'Missing' ) );
\t\t$valid            = register_block_bindings_source(
\t\t\t'wphx/registry',
\t\t\tarray(
\t\t\t\t'label'              => 'Registry',
\t\t\t\t'get_value_callback' => static function () {
\t\t\t\t\treturn 'registry';
\t\t\t\t},
\t\t\t)
\t\t);
\t\t$duplicate        = register_block_bindings_source(
\t\t\t'wphx/registry',
\t\t\tarray(
\t\t\t\t'label'              => 'Registry again',
\t\t\t\t'get_value_callback' => static function () {
\t\t\t\t\treturn 'registry-again';
\t\t\t\t},
\t\t\t)
\t\t);
\t\t$unregistered     = unregister_block_bindings_source( 'wphx/registry' );
\t\t$missing          = unregister_block_bindings_source( 'wphx/registry' );
\t\t$result['output'] = array(
\t\t\t'invalid_upper'    => false === $invalid_upper,
\t\t\t'missing_callback' => false === $missing_callback,
\t\t\t'valid'            => wphx_summarize( $valid ),
\t\t\t'duplicate'        => false === $duplicate,
\t\t\t'unregistered'     => wphx_summarize( $unregistered ),
\t\t\t'missing'          => false === $missing,
\t\t\t'remaining'        => array_keys( get_all_registered_block_bindings_sources() ),
\t\t);
\t\tbreak;

\tdefault:
\t\tthrow new RuntimeException( 'Unknown case ' . $case );
}

$result['filters'] = $GLOBALS['wphx_filters'];
$result['actions'] = $GLOBALS['wphx_actions'];
$result['wrong']   = $GLOBALS['wphx_wrong'];
echo wp_json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL;
`
  );
}

function prepareRoot(root) {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  mirrorSources(root);
  writeProbe(root);
}

function runCase(root, testCase) {
  command("php", ["-l", `${root}/probe.php`], { stdio: ["ignore", "pipe", "pipe"] });
  const raw = command("php", [`${root}/probe.php`, testCase.id]);
  return JSON.parse(raw);
}

function buildRun(root, label) {
  const observations = [];
  for (const testCase of CASES) {
    observations.push({
      id: testCase.id,
      focus: testCase.focus,
      observation: runCase(root, testCase)
    });
  }

  return {
    label,
    root,
    php_version: command("php", ["-r", "echo PHP_VERSION;"]),
    source_files: SOURCE_FILES.map((path) => inputRecord(mirrorPath(root, path))),
    probe: inputRecord(`${root}/probe.php`),
    observations,
    output_sha256: sha256(JSON.stringify(observations))
  };
}

function comparable(run) {
  return run.observations.map((caseResult) => caseResult.observation);
}

function writeJsonChecked(path, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (checkOnly) {
    if (!existsSync(path)) {
      throw new Error(`${path} does not exist`);
    }
    const existing = readFileSync(path, "utf8");
    if (existing !== text) {
      throw new Error(`${path} is stale; run ${RUNNER}`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function main() {
  prepareRoot(ORACLE_ROOT);
  prepareRoot(CANDIDATE_ROOT);

  const oracle = buildRun(ORACLE_ROOT, "oracle");
  const candidate = buildRun(CANDIDATE_ROOT, "candidate");
  const oracleComparable = comparable(oracle);
  const candidateComparable = comparable(candidate);
  const match = JSON.stringify(oracleComparable) === JSON.stringify(candidateComparable);
  if (!match) {
    throw new Error("Oracle and candidate block supports/bindings observations diverged");
  }

  const validationResult = {
    status: "passed",
    case_count: CASES.length,
    covered_symbol_count: COVERED_SYMBOLS.length,
    source_file_count: SOURCE_FILES.length,
    oracle_candidate_match: true,
    public_php_replacement_claimed: false
  };

  const manifest = {
    schema: "wphx.wp_core.block_supports_bindings_oracle_fixture.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: {
      path: RUNNER,
      sha256: sha256File(RUNNER),
      check_command: "npm run wp:core:wphx-314-block-supports-bindings-oracle-fixture:check"
    },
    evidence_class: "copied_oracle_candidate_php_fixture",
    artifact_scope: {
      domain: "blocks_block_supports_bindings",
      public_php_replacement_claimed: false,
      haxe_runtime_logic_claimed: false,
      installed_block_parity_claimed: false,
      upstream_phpunit_pass_pass_claimed: false,
      browser_gutenberg_ownership_claimed: false
    },
    inputs: {
      upstream_root: UPSTREAM_ROOT,
      source_files: SOURCE_FILES.map(sourceRecord),
      prior_evidence: [SURFACE, CONTRACT, PARSER_RENDER].filter(existsSync).map(inputRecord)
    },
    fixture: {
      cases: CASES,
      covered_symbols: COVERED_SYMBOLS,
      deterministic_boundaries: [
        "WordPress 7.0 PHP sources are mirrored into oracle and candidate roots before execution.",
        "Theme/global-style, asset queues, hook dispatch, schema validation, and escaping helpers are deterministic stubs.",
        "The fixture intentionally includes compact support modules: generated classname, custom classname, anchor, aria-label, and block bindings registry/source behavior.",
        "The block bindings source-render case avoids HTML API replacement by using a dynamic render callback that observes computed attributes after WP_Block::process_block_bindings."
      ]
    },
    runs: {
      oracle,
      candidate,
      comparable_sha256: sha256(JSON.stringify(oracleComparable))
    },
    remaining_gaps: [
      "Haxe-owned runtime implementation for block supports and block bindings is not claimed.",
      "Generated original-path public PHP adapter replacement is not claimed.",
      "Full style engine, global styles/theme.json, layout, spacing, colors, typography, border, duotone, HTML API replacement, and interactivity ownership remain later WPHX-314 gates.",
      "Installed block rendering, selected upstream PHPUnit pass/pass, editor/browser, and Gutenberg package ownership remain later gates."
    ],
    ownership_manifest: OWNERSHIP,
    validation_result: validationResult
  };

  const ownership = {
    schema: "wphx.ownership_manifest.v1",
    manifest_id: "wphx-314-04-block-supports-bindings-oracle-fixture",
    issue: ISSUE,
    unit: {
      kind: "wp_core_oracle_fixture",
      domain: "blocks_block_supports_bindings",
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
      removal_gate: "Replace the copied public PHP fixture with typed Haxe-owned support/binding decisions plus WPHX Adapter IR/generated original-path public PHP evidence, or explicitly supersede this bridge with an accepted backend/custom-target improvement.",
      non_claims: manifest.remaining_gaps
    },
    owned_paths: [],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, `${ORACLE_ROOT}/probe.php`, `${CANDIDATE_ROOT}/probe.php`],
    verification: validationResult,
    notes: [
      "This fixture is a behavior target for future Haxe ownership. It records support registration, wrapper merge, skip serialization, binding source registry, supported attribute filters, and dynamic render callback observations.",
      "Custom deterministic stubs are fixture harness boundaries, not implementation authority."
    ]
  };

  const receipt = {
    schema: "wphx.receipt.v1",
    id: "wphx-314-04-block-supports-bindings-oracle-fixture",
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
      "npm run wp:core:wphx-314-block-supports-bindings-oracle-fixture",
      "npm run wp:core:wphx-314-block-supports-bindings-oracle-fixture:check",
      "npm run receipts:validate",
      "npm run beads:validate",
      "npm run precommit"
    ],
    related_receipts: [
      "receipts/wp-core/wphx-314-01-blocks-interactivity-surface.v1.json",
      "receipts/wp-core/wphx-314-02-blocks-interactivity-adapter-contract-candidate.v1.json",
      "receipts/wp-core/wphx-314-03-block-parser-render-oracle-fixture.v1.json"
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
