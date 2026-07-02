#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-f2w7",
  external_ref: "WPHX-COMP-PHP-FEED-EMBED-HTTPS-REMAINDER",
  title: "Expand feed embed HTTPS original-path adapters"
};
const RECORDED_AT = "2026-07-02T23:59:30Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wphx-php/run-wp-embed-handlers.mjs";
const HXML = "fixtures/wphx-php/wp-embed-handlers.hxml";
const OUT_ROOT = "build/wphx-php/wp-embed-handlers";
const GENERATED_ROOT = `${OUT_ROOT}/generated`;
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const PROBE = `${OUT_ROOT}/probe.php`;
const GENERATED_SHELL = `${GENERATED_ROOT}/wp-includes/class-wp-embed.php`;
const ORACLE_SHELL = `${ORACLE_ROOT}/wp-includes/class-wp-embed.php`;
const EMISSION_MANIFEST = `${GENERATED_ROOT}/wphx-php-emission.v1.json`;
const MANIFEST = "manifests/wphx-php/wp-embed-handlers.v1.json";
const RECEIPT = "receipts/compiler/wphx-comp-php-wp-embed-handlers.v1.json";
const SOURCE_FILES = [
  "src/wphx/compiler/php/WphxPhpCompiler.hx",
  "src/wphx/compiler/php/WphxPhpWordPressAdapters.hx",
  "fixtures/wphx-php/wp-embed-handlers.hxml",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/embed/WpEmbedHandlersEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/embed/WpEmbedShell.hx"
];
const EXACT_PATTERNS = [
  "if (!defined('WPHX_WP_EMBED_BOOTSTRAPPED'))",
  "#[AllowDynamicProperties]",
  "class WP_Embed",
  "public $handlers = array();",
  "public $usecache = true;",
  "public $linkifunknown = true;",
  "public $last_attr = array();",
  "public $last_url = '';",
  "public $return_false_on_fail = false;",
  "public function register_handler($id, $regex, $callback, $priority = 10)",
  "$this->handlers[ $priority ][ $id ] = array(",
  "'regex'    => $regex",
  "'callback' => $callback",
  "public function unregister_handler($id, $priority = 10)",
  "unset( $this->handlers[ $priority ][ $id ] );",
  "public function get_embed_handler_html($attr, $url)",
  "$rawattr = $attr;",
  "$attr = wp_parse_args( $attr, wp_embed_defaults( $url ) );",
  "ksort( $this->handlers );",
  "call_user_func( $handler['callback'], $matches, $attr, $url, $rawattr )",
  "apply_filters( 'embed_handler_html', $return, $url, $attr )",
  "public function maybe_make_link($url)",
  "if ( $this->return_false_on_fail )",
  "esc_url( $url )",
  "esc_html( $url )",
  "apply_filters( 'embed_maybe_make_link', $output, $url )",
  "public function delete_oembed_caches($post_id)",
  "$post_metas = get_post_custom_keys( $post_id );",
  "str_starts_with( $post_meta_key, '_oembed_' )",
  "delete_post_meta( $post_id, $post_meta_key );",
  "public function autoembed_callback($matches)",
  "$oldval = $this->linkifunknown;",
  "$this->linkifunknown = false;",
  "$return = $this->shortcode( array(), $matches[ 2 ] );",
  "$this->linkifunknown = $oldval;",
  "return $matches[ 1 ] . $return . $matches[ 3 ];",
  "public function autoembed($content)",
  "$content = wp_replace_in_html_tags( $content, array(",
  "preg_match( '#(^|\\\\s|>)https?://#i', $content )",
  "preg_replace_callback( '|^(\\\\s*)(https?://[^\\\\s<>\"]+)(\\\\s*)$|im', array(",
  "preg_replace_callback( '|(<p(?: [^>]*)?>\\\\s*)(https?://[^\\\\s<>\"]+)(\\\\s*</p>)|i', array(",
  "return str_replace( '<!-- wp-line-break -->', \"\\n\", $content );",
  "public function cache_oembed($post_id)",
  "$post = get_post( $post_id );",
  "$post_types = get_post_types( array(",
  "apply_filters( 'embed_cache_oembed_types', $post_types )",
  "in_array( $post->post_type, $cache_oembed_types, true )",
  "$this->post_ID = $post->ID;",
  "$this->usecache = false;",
  "$content = $this->run_shortcode( $post->post_content );",
  "$this->autoembed( $content );",
  "$this->usecache = true;"
];
const CASES = [
  { id: "wp-embed-handlers:property-defaults", focus: "public WP_Embed property defaults are visible without constructor side effects" },
  { id: "wp-embed-handlers:register-default", focus: "default priority handler registration" },
  { id: "wp-embed-handlers:register-priorities", focus: "separate priority buckets preserve handler payloads" },
  { id: "wp-embed-handlers:unregister", focus: "unregister removes only the selected priority/id slot" },
  { id: "wp-embed-handlers:get-html-match", focus: "matching callable handler receives matches, parsed attrs, raw attrs, and filter" },
  { id: "wp-embed-handlers:get-html-priority", focus: "get_embed_handler_html sorts priority buckets before callback dispatch" },
  { id: "wp-embed-handlers:get-html-miss", focus: "non-callable and non-matching handlers return false without filtering" },
  { id: "wp-embed-handlers:maybe-link-default", focus: "maybe_make_link creates escaped anchor output and filters it" },
  { id: "wp-embed-handlers:maybe-link-raw", focus: "maybe_make_link preserves raw URL when linkifunknown is false and filters it" },
  { id: "wp-embed-handlers:maybe-link-false", focus: "maybe_make_link returns false before filtering when return_false_on_fail is true" },
  { id: "wp-embed-handlers:delete-oembed-empty", focus: "delete_oembed_caches returns without deletes when no custom keys exist" },
  { id: "wp-embed-handlers:delete-oembed-selective", focus: "delete_oembed_caches deletes only _oembed_ prefixed post meta keys" },
  { id: "wp-embed-handlers:autoembed-callback-restore-true", focus: "autoembed_callback restores true linkifunknown after shortcode dispatch" },
  { id: "wp-embed-handlers:autoembed-callback-restore-false", focus: "autoembed_callback restores false linkifunknown after shortcode dispatch" },
  { id: "wp-embed-handlers:autoembed-line", focus: "autoembed dispatches own-line URLs to autoembed_callback" },
  { id: "wp-embed-handlers:autoembed-paragraph", focus: "autoembed dispatches paragraph URLs to autoembed_callback" },
  { id: "wp-embed-handlers:autoembed-no-match", focus: "autoembed leaves non-own-line URLs unchanged" },
  { id: "wp-embed-handlers:autoembed-restores-tag-newline", focus: "autoembed restores line-break placeholders in HTML tags" },
  { id: "wp-embed-handlers:cache-oembed-eligible", focus: "cache_oembed sets post/usecache state and dispatches shortcode then autoembed for eligible content" },
  { id: "wp-embed-handlers:cache-oembed-disallowed-type", focus: "cache_oembed returns before dispatch for post types outside the filtered allowlist" },
  { id: "wp-embed-handlers:cache-oembed-empty-content", focus: "cache_oembed skips dispatch when eligible post content is empty" }
];

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 50
  }).trim();
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function inputRecord(path) {
  return { path, bytes: statSync(path).size, sha256: sha256File(path) };
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run without --check to generate it`);
    if (readFileSync(path, "utf8") !== content) throw new Error(`${path} is stale; run without --check to refresh it`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function mirrorOracle() {
  mkdirSync(dirname(ORACLE_SHELL), { recursive: true });
  copyFileSync(`${UPSTREAM_ROOT}/src/wp-includes/class-wp-embed.php`, ORACLE_SHELL);
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
if ( ! defined( 'WPHX_WP_EMBED_BOOTSTRAPPED' ) ) {
\tdefine( 'WPHX_WP_EMBED_BOOTSTRAPPED', true );
}

require ABSPATH . WPINC . '/class-wp-embed.php';

function wp_embed_defaults( $url = '' ) {
\treturn array(
\t\t'width' => 500,
\t\t'height' => str_contains( $url, 'portrait' ) ? 900 : 281,
\t);
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

function wp_replace_in_html_tags( $haystack, $replace_pairs ) {
\treturn preg_replace_callback(
\t\t'/<[^>]*>/',
\t\tfunction ( $matches ) use ( $replace_pairs ) {
\t\t\treturn strtr( $matches[0], $replace_pairs );
\t\t},
\t\t$haystack
\t);
}

function esc_url( $value ) {
\treturn 'esc-url:' . rawurlencode( (string) $value );
}

function esc_html( $value ) {
\treturn 'esc-html:' . htmlspecialchars( (string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' );
}

function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_filter_events'][] = array(
\t\t'hook' => $hook_name,
\t\t'value' => $value,
\t\t'args' => $args,
\t);
\tif ( ! is_string( $value ) ) {
\t\treturn $value;
\t}
\treturn $value . '<!-- filtered:' . $hook_name . ' -->';
}

function get_post( $post_id = null ) {
\treturn $GLOBALS['wphx_posts'][ $post_id ] ?? null;
}

function get_post_types( $args = array() ) {
\t$GLOBALS['wphx_get_post_types_calls'][] = $args;
\treturn $GLOBALS['wphx_post_types'] ?? array();
}

function get_post_custom_keys( $post_id ) {
\treturn $GLOBALS['wphx_post_custom_keys'][ $post_id ] ?? null;
}

function delete_post_meta( $post_id, $meta_key ) {
\t$GLOBALS['wphx_post_meta_deletes'][] = array(
\t\t'post_id' => $post_id,
\t\t'meta_key' => $meta_key,
\t);
}

function wphx_reset_events() {
\t$GLOBALS['wphx_handler_events'] = array();
\t$GLOBALS['wphx_filter_events'] = array();
\t$GLOBALS['wphx_post_meta_deletes'] = array();
\t$GLOBALS['wphx_post_custom_keys'] = array();
\t$GLOBALS['wphx_posts'] = array();
\t$GLOBALS['wphx_post_types'] = array();
\t$GLOBALS['wphx_get_post_types_calls'] = array();
}

function wphx_embed_false_callback( $matches, $attr, $url, $rawattr ) {
\t$GLOBALS['wphx_handler_events'][] = array(
\t\t'callback' => __FUNCTION__,
\t\t'matches' => $matches,
\t\t'attr' => $attr,
\t\t'url' => $url,
\t\t'rawattr' => $rawattr,
\t);
\treturn false;
}

function wphx_embed_html_callback( $matches, $attr, $url, $rawattr ) {
\t$GLOBALS['wphx_handler_events'][] = array(
\t\t'callback' => __FUNCTION__,
\t\t'matches' => $matches,
\t\t'attr' => $attr,
\t\t'url' => $url,
\t\t'rawattr' => $rawattr,
\t);
\treturn '<iframe data-match="' . $matches[1] . '" data-width="' . $attr['width'] . '" data-height="' . $attr['height'] . '"></iframe>';
}

class Fixture_Handler {
\tpublic static function render( $matches, $attr, $url, $rawattr ) {
\t\t$GLOBALS['wphx_handler_events'][] = array(
\t\t\t'callback' => __METHOD__,
\t\t\t'matches' => $matches,
\t\t\t'attr' => $attr,
\t\t\t'url' => $url,
\t\t\t'rawattr' => $rawattr,
\t\t);
\t\treturn '<div data-priority="' . $matches[1] . '" data-width="' . $attr['width'] . '"></div>';
\t}
}

class Fixture_Autoembed_Embed extends WP_Embed {
\tpublic $shortcode_calls = array();

\tpublic function shortcode( $attr, $url = '' ) {
\t\t$this->shortcode_calls[] = array(
\t\t\t'attr' => $attr,
\t\t\t'url' => $url,
\t\t\t'linkifunknown' => $this->linkifunknown,
\t\t);
\t\treturn 'shortcode:' . $url . ':' . ( $this->linkifunknown ? 'linked' : 'raw' );
\t}
}

class Fixture_Autoembed_Scanner extends WP_Embed {
\tpublic $autoembed_callback_calls = array();

\tpublic function autoembed_callback( $matches ) {
\t\t$this->autoembed_callback_calls[] = $matches;
\t\treturn 'auto:' . $matches[2];
\t}
}

class Fixture_Cache_Embed extends WP_Embed {
\tpublic $run_shortcode_calls = array();
\tpublic $autoembed_calls = array();

\tpublic function run_shortcode( $content ) {
\t\t$this->run_shortcode_calls[] = array(
\t\t\t'content' => $content,
\t\t\t'post_ID' => $this->post_ID,
\t\t\t'usecache' => $this->usecache,
\t\t);
\t\treturn 'shortcode:' . $content;
\t}

\tpublic function autoembed( $content ) {
\t\t$this->autoembed_calls[] = array(
\t\t\t'content' => $content,
\t\t\t'post_ID' => $this->post_ID,
\t\t\t'usecache' => $this->usecache,
\t\t);
\t\treturn 'autoembed:' . $content;
\t}
}

function wphx_new_embed_without_constructor( $handlers = array() ) {
\t$class = new ReflectionClass( 'WP_Embed' );
\t$embed = $class->newInstanceWithoutConstructor();
\t$embed->handlers = $handlers;
\treturn $embed;
}

function wphx_new_autoembed_without_constructor() {
\t$class = new ReflectionClass( 'Fixture_Autoembed_Embed' );
\t$embed = $class->newInstanceWithoutConstructor();
\t$embed->handlers = array();
\t$embed->shortcode_calls = array();
\treturn $embed;
}

function wphx_new_autoembed_scanner_without_constructor() {
\t$class = new ReflectionClass( 'Fixture_Autoembed_Scanner' );
\t$embed = $class->newInstanceWithoutConstructor();
\t$embed->handlers = array();
\t$embed->autoembed_callback_calls = array();
\treturn $embed;
}

function wphx_new_cache_embed_without_constructor() {
\t$class = new ReflectionClass( 'Fixture_Cache_Embed' );
\t$embed = $class->newInstanceWithoutConstructor();
\t$embed->handlers = array();
\t$embed->usecache = true;
\t$embed->post_ID = null;
\t$embed->run_shortcode_calls = array();
\t$embed->autoembed_calls = array();
\treturn $embed;
}

$assertions = array();
$result = array( 'case' => $case );
wphx_reset_events();

switch ( $case ) {
\tcase 'wp-embed-handlers:property-defaults':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['property_defaults'] = array(
\t\t\t'handlers' => $embed->handlers,
\t\t\t'post_ID_exists' => property_exists( $embed, 'post_ID' ),
\t\t\t'post_ID_value' => $embed->post_ID,
\t\t\t'usecache' => $embed->usecache,
\t\t\t'linkifunknown' => $embed->linkifunknown,
\t\t\t'last_attr' => $embed->last_attr,
\t\t\t'last_url' => $embed->last_url,
\t\t\t'return_false_on_fail' => $embed->return_false_on_fail,
\t\t);
\t\t$assertions['defaults'] = array(
\t\t\t'handlers' => array(),
\t\t\t'post_ID_exists' => true,
\t\t\t'post_ID_value' => null,
\t\t\t'usecache' => true,
\t\t\t'linkifunknown' => true,
\t\t\t'last_attr' => array(),
\t\t\t'last_url' => '',
\t\t\t'return_false_on_fail' => false,
\t\t) === $result['property_defaults'];
\t\tbreak;

\tcase 'wp-embed-handlers:register-default':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$embed->register_handler( 'video', '#https://video.example/.+#i', 'wphx_video_callback' );
\t\t$result['handlers'] = $embed->handlers;
\t\t$assertions['default_priority'] = array(
\t\t\t'video' => array(
\t\t\t\t'regex' => '#https://video.example/.+#i',
\t\t\t\t'callback' => 'wphx_video_callback',
\t\t\t),
\t\t) === $embed->handlers[10];
\t\tbreak;

\tcase 'wp-embed-handlers:register-priorities':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$embed->register_handler( 'early', '#early#', 'early_callback', 1 );
\t\t$embed->register_handler( 'normal', '#normal#', array( 'Fixture_Handler', 'render' ), 10 );
\t\t$embed->register_handler( 'late', '#late#', 'late_callback', 20 );
\t\t$result['handlers'] = $embed->handlers;
\t\t$assertions['priority_buckets'] = array( 1, 10, 20 ) === array_keys( $embed->handlers );
\t\t$assertions['early_payload'] = '#early#' === $embed->handlers[1]['early']['regex'];
\t\t$assertions['array_callback_payload'] = array( 'Fixture_Handler', 'render' ) === $embed->handlers[10]['normal']['callback'];
\t\tbreak;

\tcase 'wp-embed-handlers:unregister':
\t\t$embed = wphx_new_embed_without_constructor( array(
\t\t\t1 => array(
\t\t\t\t'shared' => array( 'regex' => '#early#', 'callback' => 'early_callback' ),
\t\t\t),
\t\t\t10 => array(
\t\t\t\t'shared' => array( 'regex' => '#normal#', 'callback' => 'normal_callback' ),
\t\t\t\t'keep' => array( 'regex' => '#keep#', 'callback' => 'keep_callback' ),
\t\t\t),
\t\t) );
\t\t$embed->unregister_handler( 'shared', 10 );
\t\t$result['handlers'] = $embed->handlers;
\t\t$assertions['removed_selected_slot'] = ! isset( $embed->handlers[10]['shared'] );
\t\t$assertions['kept_same_priority_other_id'] = isset( $embed->handlers[10]['keep'] );
\t\t$assertions['kept_other_priority_same_id'] = isset( $embed->handlers[1]['shared'] );
\t\tbreak;

\tcase 'wp-embed-handlers:get-html-match':
\t\t$embed = wphx_new_embed_without_constructor( array(
\t\t\t20 => array(
\t\t\t\t'late' => array( 'regex' => '#https://media\\\\.example/([a-z]+)#', 'callback' => 'wphx_embed_html_callback' ),
\t\t\t),
\t\t\t5 => array(
\t\t\t\t'false-first' => array( 'regex' => '#https://media\\\\.example/([a-z]+)#', 'callback' => 'wphx_embed_false_callback' ),
\t\t\t),
\t\t) );
\t\t$html = $embed->get_embed_handler_html( array( 'width' => 320 ), 'https://media.example/clip' );
\t\t$result['html'] = $html;
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['handler_events'] = $GLOBALS['wphx_handler_events'];
\t\t$result['filter_events'] = $GLOBALS['wphx_filter_events'];
\t\t$assertions['false_then_success_callbacks'] = array( 'wphx_embed_false_callback', 'wphx_embed_html_callback' ) === array_column( $GLOBALS['wphx_handler_events'], 'callback' );
\t\t$assertions['attr_defaults_merged'] = 320 === $GLOBALS['wphx_handler_events'][1]['attr']['width'] && 281 === $GLOBALS['wphx_handler_events'][1]['attr']['height'];
\t\t$assertions['rawattr_preserved'] = array( 'width' => 320 ) === $GLOBALS['wphx_handler_events'][1]['rawattr'];
\t\t$assertions['filter_applied'] = '<iframe data-match="clip" data-width="320" data-height="281"></iframe><!-- filtered:embed_handler_html -->' === $html;
\t\tbreak;

\tcase 'wp-embed-handlers:get-html-priority':
\t\t$embed = wphx_new_embed_without_constructor( array(
\t\t\t20 => array(
\t\t\t\t'late' => array( 'regex' => '#https://priority\\\\.example/([a-z]+)#', 'callback' => 'wphx_embed_html_callback' ),
\t\t\t),
\t\t\t1 => array(
\t\t\t\t'early' => array( 'regex' => '#https://priority\\\\.example/([a-z]+)#', 'callback' => array( 'Fixture_Handler', 'render' ) ),
\t\t\t),
\t\t) );
\t\t$html = $embed->get_embed_handler_html( array( 'width' => 640 ), 'https://priority.example/early' );
\t\t$result['html'] = $html;
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['handler_events'] = $GLOBALS['wphx_handler_events'];
\t\t$result['filter_events'] = $GLOBALS['wphx_filter_events'];
\t\t$assertions['priority_sorted_before_dispatch'] = array( 1, 20 ) === array_keys( $embed->handlers );
\t\t$assertions['early_callback_only'] = array( 'Fixture_Handler::render' ) === array_column( $GLOBALS['wphx_handler_events'], 'callback' );
\t\t$assertions['filtered_early_html'] = '<div data-priority="early" data-width="640"></div><!-- filtered:embed_handler_html -->' === $html;
\t\tbreak;

\tcase 'wp-embed-handlers:get-html-miss':
\t\t$embed = wphx_new_embed_without_constructor( array(
\t\t\t10 => array(
\t\t\t\t'not-callable' => array( 'regex' => '#https://miss\\\\.example/([a-z]+)#', 'callback' => 'wphx_missing_callback' ),
\t\t\t\t'no-match' => array( 'regex' => '#https://other\\\\.example/([a-z]+)#', 'callback' => 'wphx_embed_html_callback' ),
\t\t\t),
\t\t) );
\t\t$html = $embed->get_embed_handler_html( array(), 'https://miss.example/clip' );
\t\t$result['html'] = $html;
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['handler_events'] = $GLOBALS['wphx_handler_events'];
\t\t$result['filter_events'] = $GLOBALS['wphx_filter_events'];
\t\t$assertions['returned_false'] = false === $html;
\t\t$assertions['no_callbacks'] = array() === $GLOBALS['wphx_handler_events'];
\t\t$assertions['no_filters'] = array() === $GLOBALS['wphx_filter_events'];
\t\tbreak;

\tcase 'wp-embed-handlers:maybe-link-default':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$output = $embed->maybe_make_link( 'https://example.test/a path/?x=<tag>' );
\t\t$result['output'] = $output;
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['filter_events'] = $GLOBALS['wphx_filter_events'];
\t\t$assertions['escaped_anchor_filtered'] = '<a href="esc-url:https%3A%2F%2Fexample.test%2Fa%20path%2F%3Fx%3D%3Ctag%3E">esc-html:https://example.test/a path/?x=&lt;tag&gt;</a><!-- filtered:embed_maybe_make_link -->' === $output;
\t\t$assertions['filter_payload'] = 'embed_maybe_make_link' === $GLOBALS['wphx_filter_events'][0]['hook']
\t\t\t&& 'https://example.test/a path/?x=<tag>' === $GLOBALS['wphx_filter_events'][0]['args'][0];
\t\tbreak;

\tcase 'wp-embed-handlers:maybe-link-raw':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$embed->linkifunknown = false;
\t\t$output = $embed->maybe_make_link( 'https://raw.example/post' );
\t\t$result['output'] = $output;
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['filter_events'] = $GLOBALS['wphx_filter_events'];
\t\t$assertions['raw_url_filtered'] = 'https://raw.example/post<!-- filtered:embed_maybe_make_link -->' === $output;
\t\t$assertions['filter_value_is_raw_url'] = 'https://raw.example/post' === $GLOBALS['wphx_filter_events'][0]['value'];
\t\tbreak;

\tcase 'wp-embed-handlers:maybe-link-false':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$embed->return_false_on_fail = true;
\t\t$output = $embed->maybe_make_link( 'https://false.example/post' );
\t\t$result['output'] = $output;
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['filter_events'] = $GLOBALS['wphx_filter_events'];
\t\t$assertions['strict_false'] = false === $output;
\t\t$assertions['no_filter_before_false'] = array() === $GLOBALS['wphx_filter_events'];
\t\tbreak;

\tcase 'wp-embed-handlers:delete-oembed-empty':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$GLOBALS['wphx_post_custom_keys'][123] = array();
\t\t$embed->delete_oembed_caches( 123 );
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['post_meta_deletes'] = $GLOBALS['wphx_post_meta_deletes'];
\t\t$assertions['no_deletes_for_empty_keys'] = array() === $GLOBALS['wphx_post_meta_deletes'];
\t\tbreak;

\tcase 'wp-embed-handlers:delete-oembed-selective':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$GLOBALS['wphx_post_custom_keys'][123] = array( '_oembed_alpha', '_oembed_time_alpha', 'plain_meta', '_oembedx' );
\t\t$embed->delete_oembed_caches( 123 );
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['post_meta_deletes'] = $GLOBALS['wphx_post_meta_deletes'];
\t\t$assertions['only_oembed_keys_deleted'] = array(
\t\t\tarray( 'post_id' => 123, 'meta_key' => '_oembed_alpha' ),
\t\t\tarray( 'post_id' => 123, 'meta_key' => '_oembed_time_alpha' ),
\t\t) === $GLOBALS['wphx_post_meta_deletes'];
\t\tbreak;

\tcase 'wp-embed-handlers:autoembed-callback-restore-true':
\t\t$embed = wphx_new_autoembed_without_constructor();
\t\t$embed->linkifunknown = true;
\t\t$output = $embed->autoembed_callback( array( 0 => '  https://auto.example/video  ', 1 => '  ', 2 => 'https://auto.example/video', 3 => '  ' ) );
\t\t$result['output'] = $output;
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['shortcode_calls'] = $embed->shortcode_calls;
\t\t$result['linkifunknown'] = $embed->linkifunknown;
\t\t$assertions['output_wraps_shortcode'] = '  shortcode:https://auto.example/video:raw  ' === $output;
\t\t$assertions['shortcode_called_with_url_and_forced_raw'] = array(
\t\t\tarray( 'attr' => array(), 'url' => 'https://auto.example/video', 'linkifunknown' => false ),
\t\t) === $embed->shortcode_calls;
\t\t$assertions['linkifunknown_restored_true'] = true === $embed->linkifunknown;
\t\tbreak;

\tcase 'wp-embed-handlers:autoembed-callback-restore-false':
\t\t$embed = wphx_new_autoembed_without_constructor();
\t\t$embed->linkifunknown = false;
\t\t$output = $embed->autoembed_callback( array( 0 => '<p>https://auto.example/post</p>', 1 => '<p>', 2 => 'https://auto.example/post', 3 => '</p>' ) );
\t\t$result['output'] = $output;
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['shortcode_calls'] = $embed->shortcode_calls;
\t\t$result['linkifunknown'] = $embed->linkifunknown;
\t\t$assertions['paragraph_output_wraps_shortcode'] = '<p>shortcode:https://auto.example/post:raw</p>' === $output;
\t\t$assertions['shortcode_called_once_with_raw_mode'] = 1 === count( $embed->shortcode_calls ) && false === $embed->shortcode_calls[0]['linkifunknown'];
\t\t$assertions['linkifunknown_restored_false'] = false === $embed->linkifunknown;
\t\tbreak;

\tcase 'wp-embed-handlers:autoembed-line':
\t\t$embed = wphx_new_autoembed_scanner_without_constructor();
\t\t$output = $embed->autoembed( "Before\\n  https://auto.example/video  \\nAfter" );
\t\t$result['output'] = $output;
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['autoembed_callback_calls'] = $embed->autoembed_callback_calls;
\t\t$assertions['own_line_url_replaced'] = "Before\\nauto:https://auto.example/video\\nAfter" === $output;
\t\t$assertions['line_match_payload'] = 1 === count( $embed->autoembed_callback_calls )
\t\t\t&& '  ' === $embed->autoembed_callback_calls[0][1]
\t\t\t&& 'https://auto.example/video' === $embed->autoembed_callback_calls[0][2]
\t\t\t&& '  ' === $embed->autoembed_callback_calls[0][3];
\t\tbreak;

\tcase 'wp-embed-handlers:autoembed-paragraph':
\t\t$embed = wphx_new_autoembed_scanner_without_constructor();
\t\t$output = $embed->autoembed( '<p class="lead">https://auto.example/post</p>' );
\t\t$result['output'] = $output;
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['autoembed_callback_calls'] = $embed->autoembed_callback_calls;
\t\t$assertions['paragraph_url_replaced'] = 'auto:https://auto.example/post' === $output;
\t\t$assertions['paragraph_match_payload'] = 1 === count( $embed->autoembed_callback_calls )
\t\t\t&& '<p class="lead">' === $embed->autoembed_callback_calls[0][1]
\t\t\t&& 'https://auto.example/post' === $embed->autoembed_callback_calls[0][2]
\t\t\t&& '</p>' === $embed->autoembed_callback_calls[0][3];
\t\tbreak;

\tcase 'wp-embed-handlers:autoembed-no-match':
\t\t$embed = wphx_new_autoembed_scanner_without_constructor();
\t\t$output = $embed->autoembed( 'Visit https://auto.example/not-alone inside text.' );
\t\t$result['output'] = $output;
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['autoembed_callback_calls'] = $embed->autoembed_callback_calls;
\t\t$assertions['inline_url_unchanged'] = 'Visit https://auto.example/not-alone inside text.' === $output;
\t\t$assertions['inline_url_no_callbacks'] = array() === $embed->autoembed_callback_calls;
\t\tbreak;

\tcase 'wp-embed-handlers:autoembed-restores-tag-newline':
\t\t$embed = wphx_new_autoembed_scanner_without_constructor();
\t\t$output = $embed->autoembed( "<span\\nclass=\\"x\\">plain</span>" );
\t\t$result['output'] = $output;
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['autoembed_callback_calls'] = $embed->autoembed_callback_calls;
\t\t$assertions['tag_newline_restored'] = "<span\\nclass=\\"x\\">plain</span>" === $output;
\t\t$assertions['tag_newline_no_callbacks'] = array() === $embed->autoembed_callback_calls;
\t\tbreak;

\tcase 'wp-embed-handlers:cache-oembed-eligible':
\t\t$embed = wphx_new_cache_embed_without_constructor();
\t\t$GLOBALS['wphx_posts'][123] = (object) array(
\t\t\t'ID' => 123,
\t\t\t'post_type' => 'post',
\t\t\t'post_content' => 'https://cache.example/video',
\t\t);
\t\t$GLOBALS['wphx_post_types'] = array( 'post', 'page' );
\t\t$embed->cache_oembed( 123 );
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['run_shortcode_calls'] = $embed->run_shortcode_calls;
\t\t$result['autoembed_calls'] = $embed->autoembed_calls;
\t\t$result['post_ID'] = $embed->post_ID;
\t\t$result['usecache'] = $embed->usecache;
\t\t$result['filter_events'] = $GLOBALS['wphx_filter_events'];
\t\t$result['get_post_types_calls'] = $GLOBALS['wphx_get_post_types_calls'];
\t\t$assertions['filter_and_post_type_query'] = array( array( 'show_ui' => true ) ) === $GLOBALS['wphx_get_post_types_calls']
\t\t\t&& 'embed_cache_oembed_types' === $GLOBALS['wphx_filter_events'][0]['hook'];
\t\t$assertions['state_set_before_run_shortcode'] = array(
\t\t\tarray( 'content' => 'https://cache.example/video', 'post_ID' => 123, 'usecache' => false ),
\t\t) === $embed->run_shortcode_calls;
\t\t$assertions['autoembed_receives_shortcode_content'] = array(
\t\t\tarray( 'content' => 'shortcode:https://cache.example/video', 'post_ID' => 123, 'usecache' => false ),
\t\t) === $embed->autoembed_calls;
\t\t$assertions['final_state'] = 123 === $embed->post_ID && true === $embed->usecache;
\t\tbreak;

\tcase 'wp-embed-handlers:cache-oembed-disallowed-type':
\t\t$embed = wphx_new_cache_embed_without_constructor();
\t\t$GLOBALS['wphx_posts'][123] = (object) array(
\t\t\t'ID' => 123,
\t\t\t'post_type' => 'private_type',
\t\t\t'post_content' => 'https://cache.example/private',
\t\t);
\t\t$GLOBALS['wphx_post_types'] = array( 'post', 'page' );
\t\t$embed->cache_oembed( 123 );
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['run_shortcode_calls'] = $embed->run_shortcode_calls;
\t\t$result['autoembed_calls'] = $embed->autoembed_calls;
\t\t$result['post_ID'] = $embed->post_ID;
\t\t$result['usecache'] = $embed->usecache;
\t\t$result['filter_events'] = $GLOBALS['wphx_filter_events'];
\t\t$assertions['no_dispatch_for_disallowed_type'] = array() === $embed->run_shortcode_calls && array() === $embed->autoembed_calls;
\t\t$assertions['disallowed_type_state_unchanged'] = null === $embed->post_ID && true === $embed->usecache;
\t\tbreak;

\tcase 'wp-embed-handlers:cache-oembed-empty-content':
\t\t$embed = wphx_new_cache_embed_without_constructor();
\t\t$GLOBALS['wphx_posts'][123] = (object) array(
\t\t\t'ID' => 123,
\t\t\t'post_type' => 'post',
\t\t\t'post_content' => '',
\t\t);
\t\t$GLOBALS['wphx_post_types'] = array( 'post' );
\t\t$embed->cache_oembed( 123 );
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['run_shortcode_calls'] = $embed->run_shortcode_calls;
\t\t$result['autoembed_calls'] = $embed->autoembed_calls;
\t\t$result['post_ID'] = $embed->post_ID;
\t\t$result['usecache'] = $embed->usecache;
\t\t$result['filter_events'] = $GLOBALS['wphx_filter_events'];
\t\t$assertions['empty_content_no_dispatch'] = array() === $embed->run_shortcode_calls && array() === $embed->autoembed_calls;
\t\t$assertions['empty_content_state_unchanged'] = null === $embed->post_ID && true === $embed->usecache;
\t\tbreak;

\tdefault:
\t\tthrow new RuntimeException( 'Unknown case ' . $case );
}

$result['assertions'] = $assertions;
echo json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL;
`
  );
}

function runProbe(root) {
  const observations = {};
  for (const fixtureCase of CASES) {
    observations[fixtureCase.id] = JSON.parse(command("php", [PROBE, root, fixtureCase.id]));
  }
  return observations;
}

function assertDeepEqual(left, right, label) {
  const leftJson = JSON.stringify(left);
  const rightJson = JSON.stringify(right);
  if (leftJson !== rightJson) {
    throw new Error(`${label} mismatch\nleft=${leftJson}\nright=${rightJson}`);
  }
}

function assertAllCaseAssertions(observations, label) {
  for (const [caseId, observation] of Object.entries(observations)) {
    for (const [assertion, passed] of Object.entries(observation.assertions ?? {})) {
      if (passed !== true) throw new Error(`${label} ${caseId} assertion failed: ${assertion}`);
    }
  }
}

function buildManifest({ generatedSource, oracleObservations, candidateObservations, emission }) {
  const oracleComparable = Object.fromEntries(Object.entries(oracleObservations).map(([key, value]) => [key, {
    handlers: value.handlers,
    property_defaults: value.property_defaults ?? null,
    html: value.html ?? null,
    output: value.output ?? null,
    handler_events: value.handler_events ?? [],
    filter_events: value.filter_events ?? [],
    post_meta_deletes: value.post_meta_deletes ?? [],
    shortcode_calls: value.shortcode_calls ?? [],
    linkifunknown: value.linkifunknown ?? null,
    autoembed_callback_calls: value.autoembed_callback_calls ?? [],
    run_shortcode_calls: value.run_shortcode_calls ?? [],
    autoembed_calls: value.autoembed_calls ?? [],
    post_ID: value.post_ID ?? null,
    usecache: value.usecache ?? null,
    get_post_types_calls: value.get_post_types_calls ?? []
  }]));
  const candidateComparable = Object.fromEntries(Object.entries(candidateObservations).map(([key, value]) => [key, {
    handlers: value.handlers,
    property_defaults: value.property_defaults ?? null,
    html: value.html ?? null,
    output: value.output ?? null,
    handler_events: value.handler_events ?? [],
    filter_events: value.filter_events ?? [],
    post_meta_deletes: value.post_meta_deletes ?? [],
    shortcode_calls: value.shortcode_calls ?? [],
    linkifunknown: value.linkifunknown ?? null,
    autoembed_callback_calls: value.autoembed_callback_calls ?? [],
    run_shortcode_calls: value.run_shortcode_calls ?? [],
    autoembed_calls: value.autoembed_calls ?? [],
    post_ID: value.post_ID ?? null,
    usecache: value.usecache ?? null,
    get_post_types_calls: value.get_post_types_calls ?? []
  }]));
  return {
    schema: "wphx.wphx-php-wp-embed-handlers.v1",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    evidence_class: "compiler_emitted_original_path_shell",
    source_files: SOURCE_FILES.map(inputRecord),
    oracle_source: {
      path: "../wordpress-develop/src/wp-includes/class-wp-embed.php",
      sha256: sha256File("../wordpress-develop/src/wp-includes/class-wp-embed.php")
    },
    generated: {
      path: GENERATED_SHELL,
      sha256: sha256File(GENERATED_SHELL),
      lint: command("php", ["-l", GENERATED_SHELL]),
      exact_patterns: Object.fromEntries(EXACT_PATTERNS.map((pattern) => [pattern, generatedSource.includes(pattern)])),
      emission_manifest: {
        path: EMISSION_MANIFEST,
        sha256: sha256File(EMISSION_MANIFEST),
        unsupported: emission.unsupported,
        declarations: emission.files?.[0]?.declarations ?? [],
        core_ir_features: emission.core_ir_features ?? []
      }
    },
    oracle: {
      path: ORACLE_SHELL,
      sha256: sha256File(ORACLE_SHELL),
      lint: command("php", ["-l", ORACLE_SHELL])
    },
    cases: CASES,
    observations: {
      oracle: oracleObservations,
      candidate: candidateObservations
    },
    comparable_handlers: {
      oracle: oracleComparable,
      candidate: candidateComparable
    },
    claims: [
      "WPHX PHP emits original-path wp-includes/class-wp-embed.php with class WP_Embed.",
      "The generated shell preserves #[AllowDynamicProperties] and public WP_Embed property defaults.",
      "WP_Embed::register_handler writes the native PHP nested handlers array at $this->handlers[$priority][$id].",
      "WP_Embed::unregister_handler unsets only the selected native PHP nested handlers slot.",
      "WP_Embed::get_embed_handler_html sorts handler priorities, checks regex/callable pairs, dispatches callbacks with matches/parsed attrs/raw attrs, applies embed_handler_html, and returns false on misses.",
      "WP_Embed::maybe_make_link returns strict false when configured, otherwise filters either an escaped anchor or the raw URL according to linkifunknown.",
      "WP_Embed::delete_oembed_caches deletes only custom post meta keys with the _oembed_ prefix and returns without side effects for empty key lists.",
      "WP_Embed::autoembed_callback temporarily disables linkifunknown, dispatches shortcode(array(), $matches[2]), restores the previous flag, and returns prefix/result/suffix concatenation.",
      "WP_Embed::autoembed replaces own-line and paragraph URLs through autoembed_callback, leaves inline URLs unchanged, and restores HTML-tag line-break placeholders.",
      "WP_Embed::cache_oembed queries UI post types, filters embed_cache_oembed_types, gates on post ID/type/content, sets post_ID/usecache state, and dispatches run_shortcode then autoembed for eligible content.",
      "The behavior probe matches upstream for property defaults, default registration, multi-priority registration, selected unregister, handler HTML match/filter, priority ordering, miss behavior, maybe-link policy, oEmbed cache key deletion, autoembed callback state restoration, autoembed scanning, and cache_oembed dispatch when constructor side effects are bypassed."
    ],
    non_claims: [
      "This fixture does not claim WP_Embed::__construct hook/shortcode registration.",
      "This fixture does not claim run_shortcode implementation, shortcode implementation, cache population beyond cache_oembed dispatch, autoembed-to-shortcode behavior beyond callback dispatch, broad post-meta/object-cache behavior, remote oEmbed, installed editor/admin behavior, or full class-wp-embed.php ownership.",
      "This fixture does not claim generic arbitrary Haxe nested array assignment/callable/string-output lowering; the selected method bodies are bounded WordPress-profile Adapter IR pressure."
    ]
  };
}

function buildReceipt(manifest) {
  return {
    schema: "wphx.receipt.v1",
    id: "receipt:wphx-comp-php-wp-embed-handlers",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "passed",
    commands: ["npm run wphx:php:wp-embed-handlers", "npm run wphx:php:wp-embed-handlers:check"],
    artifacts: [
      { path: MANIFEST, role: "WPHX PHP WP_Embed handler-registry/get-html/maybe-link/delete-cache/autoembed/cache-oembed manifest", sha256: sha256(JSON.stringify(manifest, null, 2) + "\n") },
      { path: GENERATED_SHELL, role: "compiler-emitted original-path class-wp-embed.php", sha256: sha256File(GENERATED_SHELL) },
      { path: EMISSION_MANIFEST, role: "WPHX PHP emission manifest", sha256: sha256File(EMISSION_MANIFEST) },
      { path: RUNNER, role: "deterministic WP_Embed handler-registry/get-html/maybe-link/delete-cache/autoembed/cache-oembed runner", sha256: sha256File(RUNNER) }
    ],
    summary: [
      "WPHX PHP emits a bounded WP_Embed public class shell for public property defaults, register_handler, unregister_handler, get_embed_handler_html, maybe_make_link, delete_oembed_caches, autoembed_callback, autoembed, and cache_oembed.",
      "The generated shell preserves public defaults, native nested handlers array write/unset, sorted handler matching, callback dispatch, embed_handler_html filtering, maybe-link policy, selective oEmbed post-meta cache deletion, autoembed callback linkifunknown restoration, autoembed scanner dispatch, and cache_oembed stateful dispatch against the upstream oracle with constructor side effects bypassed."
    ]
  };
}

rmSync(OUT_ROOT, { recursive: true, force: true });
command("haxe", [HXML]);
mirrorOracle();
writeProbe();

const generatedSource = readFileSync(GENERATED_SHELL, "utf8");
for (const pattern of EXACT_PATTERNS) {
  if (!generatedSource.includes(pattern)) throw new Error(`generated shell missing pattern: ${pattern}`);
}

const emission = JSON.parse(readFileSync(EMISSION_MANIFEST, "utf8"));
if ((emission.unsupported ?? []).length !== 0) throw new Error(`emission unsupported is not empty: ${JSON.stringify(emission.unsupported)}`);
if (!generatedSource.includes("class WP_Embed")) throw new Error("generated shell did not emit class WP_Embed");

const oracleObservations = runProbe(ORACLE_ROOT);
const candidateObservations = runProbe(GENERATED_ROOT);
assertAllCaseAssertions(oracleObservations, "oracle");
assertAllCaseAssertions(candidateObservations, "candidate");
for (const fixtureCase of CASES) {
  assertDeepEqual(
    {
      handlers: oracleObservations[fixtureCase.id].handlers,
      property_defaults: oracleObservations[fixtureCase.id].property_defaults ?? null,
      html: oracleObservations[fixtureCase.id].html ?? null,
      output: oracleObservations[fixtureCase.id].output ?? null,
      handler_events: oracleObservations[fixtureCase.id].handler_events ?? [],
      filter_events: oracleObservations[fixtureCase.id].filter_events ?? [],
      post_meta_deletes: oracleObservations[fixtureCase.id].post_meta_deletes ?? [],
      shortcode_calls: oracleObservations[fixtureCase.id].shortcode_calls ?? [],
      linkifunknown: oracleObservations[fixtureCase.id].linkifunknown ?? null,
      autoembed_callback_calls: oracleObservations[fixtureCase.id].autoembed_callback_calls ?? [],
      run_shortcode_calls: oracleObservations[fixtureCase.id].run_shortcode_calls ?? [],
      autoembed_calls: oracleObservations[fixtureCase.id].autoembed_calls ?? [],
      post_ID: oracleObservations[fixtureCase.id].post_ID ?? null,
      usecache: oracleObservations[fixtureCase.id].usecache ?? null,
      get_post_types_calls: oracleObservations[fixtureCase.id].get_post_types_calls ?? []
    },
    {
      handlers: candidateObservations[fixtureCase.id].handlers,
      property_defaults: candidateObservations[fixtureCase.id].property_defaults ?? null,
      html: candidateObservations[fixtureCase.id].html ?? null,
      output: candidateObservations[fixtureCase.id].output ?? null,
      handler_events: candidateObservations[fixtureCase.id].handler_events ?? [],
      filter_events: candidateObservations[fixtureCase.id].filter_events ?? [],
      post_meta_deletes: candidateObservations[fixtureCase.id].post_meta_deletes ?? [],
      shortcode_calls: candidateObservations[fixtureCase.id].shortcode_calls ?? [],
      linkifunknown: candidateObservations[fixtureCase.id].linkifunknown ?? null,
      autoembed_callback_calls: candidateObservations[fixtureCase.id].autoembed_callback_calls ?? [],
      run_shortcode_calls: candidateObservations[fixtureCase.id].run_shortcode_calls ?? [],
      autoembed_calls: candidateObservations[fixtureCase.id].autoembed_calls ?? [],
      post_ID: candidateObservations[fixtureCase.id].post_ID ?? null,
      usecache: candidateObservations[fixtureCase.id].usecache ?? null,
      get_post_types_calls: candidateObservations[fixtureCase.id].get_post_types_calls ?? []
    },
    fixtureCase.id
  );
}

const manifest = buildManifest({ generatedSource, oracleObservations, candidateObservations, emission });
if (Object.values(manifest.generated.exact_patterns).some((value) => value !== true)) {
  throw new Error("generated exact pattern check failed");
}
const manifestText = JSON.stringify(manifest, null, 2) + "\n";
writeOrCheck(MANIFEST, manifestText);
writeOrCheck(RECEIPT, JSON.stringify(buildReceipt(manifest), null, 2) + "\n");

console.log(
  JSON.stringify(
    {
      ok: true,
      manifest: MANIFEST,
      receipt: RECEIPT,
      generated: GENERATED_SHELL,
      cases: CASES.map((entry) => entry.id)
    },
    null,
    2
  )
);
