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
  "public function __construct()",
  "add_filter( 'the_content', array(",
  "add_filter( 'widget_text_content', array(",
  "add_filter( 'widget_block_content', array(",
  "add_shortcode( 'embed', '__return_false' );",
  "add_action( 'edit_form_advanced', array(",
  "add_action( 'edit_page_form', array(",
  "public function run_shortcode($content)",
  "global $shortcode_tags;",
  "$orig_shortcode_tags = $shortcode_tags;",
  "remove_all_shortcodes();",
  "add_shortcode( 'embed', array(",
  "$content = do_shortcode( $content, true );",
  "$shortcode_tags = $orig_shortcode_tags;",
  "public function maybe_run_ajax_cache()",
  "$post = get_post();",
  "empty( $_GET['message'] )",
  "admin_url( 'admin-ajax.php', 'relative' )",
  "?action=oembed-cache&post=",
  "public function shortcode($attr, $url = '')",
  "$post = get_post();",
  "$url = $attr['src'];",
  "$this->last_url = $url;",
  "$this->last_attr = $attr;",
  "$rawattr = $attr;",
  "$attr = wp_parse_args( $attr, wp_embed_defaults( $url ) );",
  "$url = str_replace( '&amp;', '&', $url );",
  "$embed_handler_html = $this->get_embed_handler_html( $rawattr, $url );",
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
  "$this->usecache = true;",
  "public function find_oembed_post_id($cache_key)",
  "$cache_group = 'oembed_cache_post';",
  "$oembed_post_id = wp_cache_get( $cache_key, $cache_group );",
  "get_post_type( $oembed_post_id )",
  "$oembed_post_query = new WP_Query(",
  "'post_type'              => 'oembed_cache'",
  "'lazy_load_term_meta'    => false",
  "$oembed_post_id = $oembed_post_query->posts[ 0 ]->ID;",
  "wp_cache_set( $cache_key, $oembed_post_id, $cache_group );"
];
const CASES = [
  { id: "wp-embed-handlers:property-defaults", focus: "public WP_Embed property defaults are visible without constructor side effects" },
  { id: "wp-embed-handlers:constructor-hooks", focus: "constructor registers content/widget shortcode filters, embed placeholder shortcode, and edit-form cache actions" },
  { id: "wp-embed-handlers:run-shortcode-restores-registry", focus: "run_shortcode registers only the embed shortcode while parsing and restores the prior shortcode registry" },
  { id: "wp-embed-handlers:maybe-ajax-no-post", focus: "maybe_run_ajax_cache returns without output when no current post is available" },
  { id: "wp-embed-handlers:maybe-ajax-no-message", focus: "maybe_run_ajax_cache returns without output when edit-form message is absent" },
  { id: "wp-embed-handlers:maybe-ajax-output", focus: "maybe_run_ajax_cache outputs the oEmbed cache Ajax script for a saved post" },
  { id: "wp-embed-handlers:shortcode-empty-url", focus: "shortcode records empty URL attrs and returns an empty string" },
  { id: "wp-embed-handlers:shortcode-src-fallback", focus: "shortcode falls back to attr src before internal handler dispatch" },
  { id: "wp-embed-handlers:shortcode-handler-hit", focus: "shortcode normalizes attrs/url and returns internal handler HTML before oEmbed cache/fetch work" },
  { id: "wp-embed-handlers:shortcode-amp-normalization-handler-hit", focus: "shortcode decodes ampersands before internal handler matching" },
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
  { id: "wp-embed-handlers:cache-oembed-empty-content", focus: "cache_oembed skips dispatch when eligible post content is empty" },
  { id: "wp-embed-handlers:find-oembed-cache-hit", focus: "find_oembed_post_id returns valid oembed cache ID from object cache without querying" },
  { id: "wp-embed-handlers:find-oembed-cache-wrong-type-query-hit", focus: "find_oembed_post_id falls through invalid cached type and stores query hit" },
  { id: "wp-embed-handlers:find-oembed-query-hit", focus: "find_oembed_post_id queries and caches the first oembed cache post ID" },
  { id: "wp-embed-handlers:find-oembed-query-miss", focus: "find_oembed_post_id returns null when cache and query miss" }
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

function wphx_callback_shape( $callback ) {
\tif ( is_array( $callback ) && is_object( $callback[0] ?? null ) ) {
\t\treturn array( 'class' => get_class( $callback[0] ), 'method' => $callback[1] ?? null );
\t}
\treturn $callback;
}

function add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wphx_filter_registrations'][] = array(
\t\t'hook' => $hook_name,
\t\t'callback' => wphx_callback_shape( $callback ),
\t\t'priority' => $priority,
\t\t'accepted_args' => $accepted_args,
\t);
\treturn true;
}

function add_action( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wphx_action_registrations'][] = array(
\t\t'hook' => $hook_name,
\t\t'callback' => wphx_callback_shape( $callback ),
\t\t'priority' => $priority,
\t\t'accepted_args' => $accepted_args,
\t);
\treturn true;
}

function remove_all_shortcodes() {
\t$GLOBALS['wphx_shortcode_events'][] = array(
\t\t'event' => 'remove_all_shortcodes',
\t\t'before_keys' => array_keys( $GLOBALS['shortcode_tags'] ?? array() ),
\t);
\t$GLOBALS['shortcode_tags'] = array();
}

function add_shortcode( $tag, $callback ) {
\t$GLOBALS['wphx_shortcode_events'][] = array(
\t\t'event' => 'add_shortcode',
\t\t'tag' => $tag,
\t\t'callback' => wphx_callback_shape( $callback ),
\t);
\t$GLOBALS['shortcode_tags'][ $tag ] = $callback;
}

function do_shortcode( $content, $ignore_html = false ) {
\t$GLOBALS['wphx_shortcode_events'][] = array(
\t\t'event' => 'do_shortcode',
\t\t'content' => $content,
\t\t'ignore_html' => $ignore_html,
\t\t'tags' => array_keys( $GLOBALS['shortcode_tags'] ?? array() ),
\t);
\treturn 'processed:' . $content . ':' . ( isset( $GLOBALS['shortcode_tags']['embed'] ) ? 'embed-registered' : 'embed-missing' );
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

function admin_url( $path = '', $scheme = 'admin' ) {
\t$GLOBALS['wphx_admin_url_calls'][] = array(
\t\t'path' => $path,
\t\t'scheme' => $scheme,
\t);
\treturn 'admin-url:' . $scheme . ':' . $path;
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
\tif ( 0 === func_num_args() ) {
\t\treturn $GLOBALS['wphx_current_post'] ?? null;
\t}
\treturn $GLOBALS['wphx_posts'][ $post_id ] ?? null;
}

function get_post_types( $args = array() ) {
\t$GLOBALS['wphx_get_post_types_calls'][] = $args;
\treturn $GLOBALS['wphx_post_types'] ?? array();
}

function get_post_type( $post = null ) {
\t$GLOBALS['wphx_get_post_type_calls'][] = $post;
\treturn $GLOBALS['wphx_post_types_by_id'][ $post ] ?? null;
}

function wp_cache_get( $key, $group = '' ) {
\t$GLOBALS['wphx_wp_cache_get_calls'][] = array(
\t\t'key' => $key,
\t\t'group' => $group,
\t);
\treturn $GLOBALS['wphx_wp_cache'][ $group ][ $key ] ?? false;
}

function wp_cache_set( $key, $value, $group = '' ) {
\t$GLOBALS['wphx_wp_cache_set_calls'][] = array(
\t\t'key' => $key,
\t\t'value' => $value,
\t\t'group' => $group,
\t);
\t$GLOBALS['wphx_wp_cache'][ $group ][ $key ] = $value;
\treturn true;
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

class WP_Query {
\tpublic $posts = array();

\tpublic function __construct( $args = array() ) {
\t\t$GLOBALS['wphx_wp_query_calls'][] = $args;
\t\t$this->posts = $GLOBALS['wphx_wp_query_posts'][ $args['name'] ?? '' ] ?? array();
\t}
}

function wphx_reset_events() {
\t$_GET = array();
\t$GLOBALS['shortcode_tags'] = array();
\t$GLOBALS['wphx_handler_events'] = array();
\t$GLOBALS['wphx_filter_events'] = array();
\t$GLOBALS['wphx_filter_registrations'] = array();
\t$GLOBALS['wphx_action_registrations'] = array();
\t$GLOBALS['wphx_shortcode_events'] = array();
\t$GLOBALS['wphx_admin_url_calls'] = array();
\t$GLOBALS['wphx_current_post'] = null;
\t$GLOBALS['wphx_post_meta_deletes'] = array();
\t$GLOBALS['wphx_post_custom_keys'] = array();
\t$GLOBALS['wphx_posts'] = array();
\t$GLOBALS['wphx_post_types'] = array();
\t$GLOBALS['wphx_get_post_types_calls'] = array();
\t$GLOBALS['wphx_post_types_by_id'] = array();
\t$GLOBALS['wphx_get_post_type_calls'] = array();
\t$GLOBALS['wphx_wp_cache'] = array();
\t$GLOBALS['wphx_wp_cache_get_calls'] = array();
\t$GLOBALS['wphx_wp_cache_set_calls'] = array();
\t$GLOBALS['wphx_wp_query_calls'] = array();
\t$GLOBALS['wphx_wp_query_posts'] = array();
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

\tcase 'wp-embed-handlers:constructor-hooks':
\t\t$embed = new WP_Embed();
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['filter_registrations'] = $GLOBALS['wphx_filter_registrations'];
\t\t$result['action_registrations'] = $GLOBALS['wphx_action_registrations'];
\t\t$result['shortcode_events'] = $GLOBALS['wphx_shortcode_events'];
\t\t$result['shortcode_tags'] = array_map( 'wphx_callback_shape', $GLOBALS['shortcode_tags'] );
\t\t$assertions['run_shortcode_filters'] = array(
\t\t\tarray( 'hook' => 'the_content', 'callback' => array( 'class' => 'WP_Embed', 'method' => 'run_shortcode' ), 'priority' => 8, 'accepted_args' => 1 ),
\t\t\tarray( 'hook' => 'widget_text_content', 'callback' => array( 'class' => 'WP_Embed', 'method' => 'run_shortcode' ), 'priority' => 8, 'accepted_args' => 1 ),
\t\t\tarray( 'hook' => 'widget_block_content', 'callback' => array( 'class' => 'WP_Embed', 'method' => 'run_shortcode' ), 'priority' => 8, 'accepted_args' => 1 ),
\t\t) === array_slice( $GLOBALS['wphx_filter_registrations'], 0, 3 );
\t\t$assertions['autoembed_filters'] = array(
\t\t\tarray( 'hook' => 'the_content', 'callback' => array( 'class' => 'WP_Embed', 'method' => 'autoembed' ), 'priority' => 8, 'accepted_args' => 1 ),
\t\t\tarray( 'hook' => 'widget_text_content', 'callback' => array( 'class' => 'WP_Embed', 'method' => 'autoembed' ), 'priority' => 8, 'accepted_args' => 1 ),
\t\t\tarray( 'hook' => 'widget_block_content', 'callback' => array( 'class' => 'WP_Embed', 'method' => 'autoembed' ), 'priority' => 8, 'accepted_args' => 1 ),
\t\t) === array_slice( $GLOBALS['wphx_filter_registrations'], 3, 3 );
\t\t$assertions['placeholder_shortcode'] = array(
\t\t\tarray( 'event' => 'add_shortcode', 'tag' => 'embed', 'callback' => '__return_false' ),
\t\t) === $GLOBALS['wphx_shortcode_events'];
\t\t$assertions['cache_actions'] = array(
\t\t\tarray( 'hook' => 'edit_form_advanced', 'callback' => array( 'class' => 'WP_Embed', 'method' => 'maybe_run_ajax_cache' ), 'priority' => 10, 'accepted_args' => 1 ),
\t\t\tarray( 'hook' => 'edit_page_form', 'callback' => array( 'class' => 'WP_Embed', 'method' => 'maybe_run_ajax_cache' ), 'priority' => 10, 'accepted_args' => 1 ),
\t\t) === $GLOBALS['wphx_action_registrations'];
\t\tbreak;

\tcase 'wp-embed-handlers:run-shortcode-restores-registry':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$GLOBALS['shortcode_tags'] = array(
\t\t\t'gallery' => 'gallery_shortcode',
\t\t\t'caption' => 'caption_shortcode',
\t\t);
\t\t$output = $embed->run_shortcode( 'Before [embed]https://run.example/video[/embed] after' );
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['output'] = $output;
\t\t$result['shortcode_events'] = $GLOBALS['wphx_shortcode_events'];
\t\t$result['shortcode_tags'] = $GLOBALS['shortcode_tags'];
\t\t$assertions['output_from_do_shortcode'] = 'processed:Before [embed]https://run.example/video[/embed] after:embed-registered' === $output;
\t\t$assertions['registry_restored'] = array(
\t\t\t'gallery' => 'gallery_shortcode',
\t\t\t'caption' => 'caption_shortcode',
\t\t) === $GLOBALS['shortcode_tags'];
\t\t$assertions['embed_only_during_parse'] = array( 'embed' ) === $GLOBALS['wphx_shortcode_events'][2]['tags'];
\t\t$assertions['ignore_html_true'] = true === $GLOBALS['wphx_shortcode_events'][2]['ignore_html'];
\t\t$assertions['event_order'] = array( 'remove_all_shortcodes', 'add_shortcode', 'do_shortcode' ) === array_column( $GLOBALS['wphx_shortcode_events'], 'event' );
\t\tbreak;

\tcase 'wp-embed-handlers:maybe-ajax-no-post':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$_GET['message'] = '1';
\t\tob_start();
\t\t$embed->maybe_run_ajax_cache();
\t\t$output = ob_get_clean();
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['output'] = $output;
\t\t$result['admin_url_calls'] = $GLOBALS['wphx_admin_url_calls'];
\t\t$assertions['no_post_no_output'] = '' === $output;
\t\t$assertions['no_post_no_admin_url'] = array() === $GLOBALS['wphx_admin_url_calls'];
\t\tbreak;

\tcase 'wp-embed-handlers:maybe-ajax-no-message':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$GLOBALS['wphx_current_post'] = (object) array( 'ID' => 321 );
\t\tob_start();
\t\t$embed->maybe_run_ajax_cache();
\t\t$output = ob_get_clean();
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['output'] = $output;
\t\t$result['admin_url_calls'] = $GLOBALS['wphx_admin_url_calls'];
\t\t$assertions['no_message_no_output'] = '' === $output;
\t\t$assertions['no_message_no_admin_url'] = array() === $GLOBALS['wphx_admin_url_calls'];
\t\tbreak;

\tcase 'wp-embed-handlers:maybe-ajax-output':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$GLOBALS['wphx_current_post'] = (object) array( 'ID' => 654 );
\t\t$_GET['message'] = '1';
\t\tob_start();
\t\t$embed->maybe_run_ajax_cache();
\t\t$output = ob_get_clean();
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['output'] = $output;
\t\t$result['admin_url_calls'] = $GLOBALS['wphx_admin_url_calls'];
\t\t$assertions['ajax_script_contains_post'] = false !== strpos( $output, '?action=oembed-cache&post=654' );
\t\t$assertions['admin_url_called_relative'] = array(
\t\t\tarray( 'path' => 'admin-ajax.php', 'scheme' => 'relative' ),
\t\t) === $GLOBALS['wphx_admin_url_calls'];
\t\tbreak;

\tcase 'wp-embed-handlers:shortcode-empty-url':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$output = $embed->shortcode( array( 'width' => 222 ), '' );
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['output'] = $output;
\t\t$result['last_url'] = $embed->last_url;
\t\t$result['last_attr'] = $embed->last_attr;
\t\t$result['handler_events'] = $GLOBALS['wphx_handler_events'];
\t\t$result['filter_events'] = $GLOBALS['wphx_filter_events'];
\t\t$assertions['empty_url_returns_empty_string'] = '' === $output;
\t\t$assertions['empty_url_state'] = '' === $embed->last_url && array( 'width' => 222 ) === $embed->last_attr;
\t\t$assertions['empty_url_no_handler_or_filter'] = array() === $GLOBALS['wphx_handler_events'] && array() === $GLOBALS['wphx_filter_events'];
\t\tbreak;

\tcase 'wp-embed-handlers:shortcode-src-fallback':
\t\t$embed = wphx_new_embed_without_constructor( array(
\t\t\t10 => array(
\t\t\t\t'src-handler' => array( 'regex' => '#https://src\\\\.example/([a-z]+)#', 'callback' => 'wphx_embed_html_callback' ),
\t\t\t),
\t\t) );
\t\t$output = $embed->shortcode( array( 'src' => 'https://src.example/clip', 'width' => 333 ), '' );
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['output'] = $output;
\t\t$result['last_url'] = $embed->last_url;
\t\t$result['last_attr'] = $embed->last_attr;
\t\t$result['handler_events'] = $GLOBALS['wphx_handler_events'];
\t\t$result['filter_events'] = $GLOBALS['wphx_filter_events'];
\t\t$assertions['src_fallback_handler_output'] = '<iframe data-match="clip" data-width="333" data-height="281"></iframe><!-- filtered:embed_handler_html -->' === $output;
\t\t$assertions['src_fallback_last_url'] = 'https://src.example/clip' === $embed->last_url;
\t\t$assertions['src_fallback_attr_defaults'] = 333 === $embed->last_attr['width'] && 281 === $embed->last_attr['height'];
\t\t$assertions['src_fallback_rawattr_preserved'] = array( 'src' => 'https://src.example/clip', 'width' => 333 ) === $GLOBALS['wphx_handler_events'][0]['rawattr'];
\t\tbreak;

\tcase 'wp-embed-handlers:shortcode-handler-hit':
\t\t$embed = wphx_new_embed_without_constructor( array(
\t\t\t10 => array(
\t\t\t\t'direct-handler' => array( 'regex' => '#https://shortcode\\\\.example/([a-z]+)#', 'callback' => 'wphx_embed_html_callback' ),
\t\t\t),
\t\t) );
\t\t$output = $embed->shortcode( array( 'height' => 444 ), 'https://shortcode.example/movie' );
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['output'] = $output;
\t\t$result['last_url'] = $embed->last_url;
\t\t$result['last_attr'] = $embed->last_attr;
\t\t$result['handler_events'] = $GLOBALS['wphx_handler_events'];
\t\t$result['filter_events'] = $GLOBALS['wphx_filter_events'];
\t\t$assertions['direct_handler_output'] = '<iframe data-match="movie" data-width="500" data-height="444"></iframe><!-- filtered:embed_handler_html -->' === $output;
\t\t$assertions['direct_handler_last_attr'] = array( 'width' => 500, 'height' => 444 ) === $embed->last_attr;
\t\t$assertions['direct_handler_filtered_once'] = 1 === count( $GLOBALS['wphx_filter_events'] ) && 'embed_handler_html' === $GLOBALS['wphx_filter_events'][0]['hook'];
\t\tbreak;

\tcase 'wp-embed-handlers:shortcode-amp-normalization-handler-hit':
\t\t$embed = wphx_new_embed_without_constructor( array(
\t\t\t10 => array(
\t\t\t\t'amp-handler' => array( 'regex' => '#https://amp\\\\.example/video\\\\?a=1&b=([0-9]+)#', 'callback' => 'wphx_embed_html_callback' ),
\t\t\t),
\t\t) );
\t\t$output = $embed->shortcode( array(), 'https://amp.example/video?a=1&amp;b=2' );
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['output'] = $output;
\t\t$result['last_url'] = $embed->last_url;
\t\t$result['last_attr'] = $embed->last_attr;
\t\t$result['handler_events'] = $GLOBALS['wphx_handler_events'];
\t\t$result['filter_events'] = $GLOBALS['wphx_filter_events'];
\t\t$assertions['amp_handler_output'] = '<iframe data-match="2" data-width="500" data-height="281"></iframe><!-- filtered:embed_handler_html -->' === $output;
\t\t$assertions['amp_last_url_pre_normalization'] = 'https://amp.example/video?a=1&amp;b=2' === $embed->last_url;
\t\t$assertions['amp_handler_url_normalized'] = 'https://amp.example/video?a=1&b=2' === $GLOBALS['wphx_handler_events'][0]['url'];
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

\tcase 'wp-embed-handlers:find-oembed-cache-hit':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$GLOBALS['wphx_wp_cache']['oembed_cache_post']['hit-key'] = 501;
\t\t$GLOBALS['wphx_post_types_by_id'][501] = 'oembed_cache';
\t\t$found_post_id = $embed->find_oembed_post_id( 'hit-key' );
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['found_post_id'] = $found_post_id;
\t\t$result['wp_cache_get_calls'] = $GLOBALS['wphx_wp_cache_get_calls'];
\t\t$result['wp_cache_set_calls'] = $GLOBALS['wphx_wp_cache_set_calls'];
\t\t$result['wp_query_calls'] = $GLOBALS['wphx_wp_query_calls'];
\t\t$result['get_post_type_calls'] = $GLOBALS['wphx_get_post_type_calls'];
\t\t$assertions['cache_hit_returned'] = 501 === $found_post_id;
\t\t$assertions['cache_hit_no_query_or_set'] = array() === $GLOBALS['wphx_wp_query_calls'] && array() === $GLOBALS['wphx_wp_cache_set_calls'];
\t\t$assertions['cached_type_checked'] = array( 501 ) === $GLOBALS['wphx_get_post_type_calls'];
\t\tbreak;

\tcase 'wp-embed-handlers:find-oembed-cache-wrong-type-query-hit':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$GLOBALS['wphx_wp_cache']['oembed_cache_post']['wrong-key'] = 601;
\t\t$GLOBALS['wphx_post_types_by_id'][601] = 'post';
\t\t$GLOBALS['wphx_wp_query_posts']['wrong-key'] = array( (object) array( 'ID' => 777 ) );
\t\t$found_post_id = $embed->find_oembed_post_id( 'wrong-key' );
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['found_post_id'] = $found_post_id;
\t\t$result['wp_cache_get_calls'] = $GLOBALS['wphx_wp_cache_get_calls'];
\t\t$result['wp_cache_set_calls'] = $GLOBALS['wphx_wp_cache_set_calls'];
\t\t$result['wp_query_calls'] = $GLOBALS['wphx_wp_query_calls'];
\t\t$result['get_post_type_calls'] = $GLOBALS['wphx_get_post_type_calls'];
\t\t$assertions['wrong_cached_type_query_returned'] = 777 === $found_post_id;
\t\t$assertions['wrong_cached_type_checked'] = array( 601 ) === $GLOBALS['wphx_get_post_type_calls'];
\t\t$assertions['wrong_cached_type_query_name'] = 1 === count( $GLOBALS['wphx_wp_query_calls'] ) && 'wrong-key' === $GLOBALS['wphx_wp_query_calls'][0]['name'];
\t\t$assertions['wrong_cached_type_cache_set'] = array(
\t\t\tarray( 'key' => 'wrong-key', 'value' => 777, 'group' => 'oembed_cache_post' ),
\t\t) === $GLOBALS['wphx_wp_cache_set_calls'];
\t\tbreak;

\tcase 'wp-embed-handlers:find-oembed-query-hit':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$GLOBALS['wphx_wp_query_posts']['query-key'] = array( (object) array( 'ID' => 888 ) );
\t\t$found_post_id = $embed->find_oembed_post_id( 'query-key' );
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['found_post_id'] = $found_post_id;
\t\t$result['wp_cache_get_calls'] = $GLOBALS['wphx_wp_cache_get_calls'];
\t\t$result['wp_cache_set_calls'] = $GLOBALS['wphx_wp_cache_set_calls'];
\t\t$result['wp_query_calls'] = $GLOBALS['wphx_wp_query_calls'];
\t\t$result['get_post_type_calls'] = $GLOBALS['wphx_get_post_type_calls'];
\t\t$assertions['query_hit_returned'] = 888 === $found_post_id;
\t\t$assertions['query_hit_cache_lookup'] = array(
\t\t\tarray( 'key' => 'query-key', 'group' => 'oembed_cache_post' ),
\t\t) === $GLOBALS['wphx_wp_cache_get_calls'];
\t\t$assertions['query_hit_cache_set'] = array(
\t\t\tarray( 'key' => 'query-key', 'value' => 888, 'group' => 'oembed_cache_post' ),
\t\t) === $GLOBALS['wphx_wp_cache_set_calls'];
\t\t$assertions['query_hit_query_name'] = 1 === count( $GLOBALS['wphx_wp_query_calls'] ) && 'query-key' === $GLOBALS['wphx_wp_query_calls'][0]['name'];
\t\tbreak;

\tcase 'wp-embed-handlers:find-oembed-query-miss':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$found_post_id = $embed->find_oembed_post_id( 'miss-key' );
\t\t$result['handlers'] = $embed->handlers;
\t\t$result['found_post_id'] = $found_post_id;
\t\t$result['wp_cache_get_calls'] = $GLOBALS['wphx_wp_cache_get_calls'];
\t\t$result['wp_cache_set_calls'] = $GLOBALS['wphx_wp_cache_set_calls'];
\t\t$result['wp_query_calls'] = $GLOBALS['wphx_wp_query_calls'];
\t\t$result['get_post_type_calls'] = $GLOBALS['wphx_get_post_type_calls'];
\t\t$assertions['query_miss_returned_null'] = null === $found_post_id;
\t\t$assertions['query_miss_no_cache_set'] = array() === $GLOBALS['wphx_wp_cache_set_calls'];
\t\t$assertions['query_miss_query_name'] = 1 === count( $GLOBALS['wphx_wp_query_calls'] ) && 'miss-key' === $GLOBALS['wphx_wp_query_calls'][0]['name'];
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
    last_url: value.last_url ?? null,
    last_attr: value.last_attr ?? null,
    handler_events: value.handler_events ?? [],
    filter_events: value.filter_events ?? [],
    filter_registrations: value.filter_registrations ?? [],
    action_registrations: value.action_registrations ?? [],
    shortcode_events: value.shortcode_events ?? [],
    shortcode_tags: value.shortcode_tags ?? null,
    admin_url_calls: value.admin_url_calls ?? [],
    post_meta_deletes: value.post_meta_deletes ?? [],
    shortcode_calls: value.shortcode_calls ?? [],
    linkifunknown: value.linkifunknown ?? null,
    autoembed_callback_calls: value.autoembed_callback_calls ?? [],
    run_shortcode_calls: value.run_shortcode_calls ?? [],
    autoembed_calls: value.autoembed_calls ?? [],
    post_ID: value.post_ID ?? null,
    usecache: value.usecache ?? null,
    get_post_types_calls: value.get_post_types_calls ?? [],
    found_post_id: value.found_post_id ?? null,
    wp_cache_get_calls: value.wp_cache_get_calls ?? [],
    wp_cache_set_calls: value.wp_cache_set_calls ?? [],
    wp_query_calls: value.wp_query_calls ?? [],
    get_post_type_calls: value.get_post_type_calls ?? []
  }]));
  const candidateComparable = Object.fromEntries(Object.entries(candidateObservations).map(([key, value]) => [key, {
    handlers: value.handlers,
    property_defaults: value.property_defaults ?? null,
    html: value.html ?? null,
    output: value.output ?? null,
    last_url: value.last_url ?? null,
    last_attr: value.last_attr ?? null,
    handler_events: value.handler_events ?? [],
    filter_events: value.filter_events ?? [],
    filter_registrations: value.filter_registrations ?? [],
    action_registrations: value.action_registrations ?? [],
    shortcode_events: value.shortcode_events ?? [],
    shortcode_tags: value.shortcode_tags ?? null,
    admin_url_calls: value.admin_url_calls ?? [],
    post_meta_deletes: value.post_meta_deletes ?? [],
    shortcode_calls: value.shortcode_calls ?? [],
    linkifunknown: value.linkifunknown ?? null,
    autoembed_callback_calls: value.autoembed_callback_calls ?? [],
    run_shortcode_calls: value.run_shortcode_calls ?? [],
    autoembed_calls: value.autoembed_calls ?? [],
    post_ID: value.post_ID ?? null,
    usecache: value.usecache ?? null,
    get_post_types_calls: value.get_post_types_calls ?? [],
    found_post_id: value.found_post_id ?? null,
    wp_cache_get_calls: value.wp_cache_get_calls ?? [],
    wp_cache_set_calls: value.wp_cache_set_calls ?? [],
    wp_query_calls: value.wp_query_calls ?? [],
    get_post_type_calls: value.get_post_type_calls ?? []
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
      "WP_Embed::__construct registers run_shortcode content/widget filters, the embed placeholder shortcode, autoembed content/widget filters, and edit-form cache actions.",
      "WP_Embed::run_shortcode saves the global shortcode registry, clears it, registers only the embed shortcode callback, calls do_shortcode($content, true), restores the original registry, and returns the processed content.",
      "WP_Embed::maybe_run_ajax_cache gates on current post and edit-form message state, then outputs the oEmbed cache Ajax script using esc_url(admin_url('admin-ajax.php', 'relative')) and the current post ID.",
      "WP_Embed::shortcode preserves the empty-URL return path, attr src URL fallback, last_url/last_attr state, default attr parsing, ampersand normalization, and early internal handler HTML return before oEmbed cache/fetch work.",
      "WP_Embed::register_handler writes the native PHP nested handlers array at $this->handlers[$priority][$id].",
      "WP_Embed::unregister_handler unsets only the selected native PHP nested handlers slot.",
      "WP_Embed::get_embed_handler_html sorts handler priorities, checks regex/callable pairs, dispatches callbacks with matches/parsed attrs/raw attrs, applies embed_handler_html, and returns false on misses.",
      "WP_Embed::maybe_make_link returns strict false when configured, otherwise filters either an escaped anchor or the raw URL according to linkifunknown.",
      "WP_Embed::delete_oembed_caches deletes only custom post meta keys with the _oembed_ prefix and returns without side effects for empty key lists.",
      "WP_Embed::autoembed_callback temporarily disables linkifunknown, dispatches shortcode(array(), $matches[2]), restores the previous flag, and returns prefix/result/suffix concatenation.",
      "WP_Embed::autoembed replaces own-line and paragraph URLs through autoembed_callback, leaves inline URLs unchanged, and restores HTML-tag line-break placeholders.",
      "WP_Embed::cache_oembed queries UI post types, filters embed_cache_oembed_types, gates on post ID/type/content, sets post_ID/usecache state, and dispatches run_shortcode then autoembed for eligible content.",
      "WP_Embed::find_oembed_post_id reads the oembed_cache_post object-cache entry, validates cached IDs by post type, queries publish oembed_cache posts by cache key on misses or invalid cached types, stores query hits, and returns null on misses.",
      "The behavior probe matches upstream for property defaults, constructor hook registration, run_shortcode registry restoration, maybe_run_ajax_cache gating/output, bounded shortcode empty/src/handler paths, default registration, multi-priority registration, selected unregister, handler HTML match/filter, priority ordering, miss behavior, maybe-link policy, oEmbed cache key deletion, autoembed callback state restoration, autoembed scanning, cache_oembed dispatch, and oEmbed cache-post lookup."
    ],
    non_claims: [
      "This fixture does not claim browser execution of the maybe_run_ajax_cache script or installed edit-form Ajax behavior.",
      "This fixture does not claim shortcode oEmbed cache reads/writes, post meta cache handling, remote wp_oembed_get fetching, oEmbed cache post insertion/update, broad shortcode parser implementation, cache population beyond cache_oembed/find_oembed_post_id dispatch, autoembed-to-shortcode behavior beyond callback dispatch, broad WP_Query/post-meta/object-cache behavior, remote oEmbed, installed editor/admin behavior, or full class-wp-embed.php ownership.",
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
      { path: MANIFEST, role: "WPHX PHP WP_Embed constructor/run-shortcode/ajax-cache/shortcode-entry/handler-registry/get-html/maybe-link/delete-cache/autoembed/cache-oembed/find-oembed manifest", sha256: sha256(JSON.stringify(manifest, null, 2) + "\n") },
      { path: GENERATED_SHELL, role: "compiler-emitted original-path class-wp-embed.php", sha256: sha256File(GENERATED_SHELL) },
      { path: EMISSION_MANIFEST, role: "WPHX PHP emission manifest", sha256: sha256File(EMISSION_MANIFEST) },
      { path: RUNNER, role: "deterministic WP_Embed constructor/run-shortcode/ajax-cache/shortcode-entry/handler-registry/get-html/maybe-link/delete-cache/autoembed/cache-oembed/find-oembed runner", sha256: sha256File(RUNNER) }
    ],
    summary: [
      "WPHX PHP emits a bounded WP_Embed public class shell for public property defaults, __construct, run_shortcode, maybe_run_ajax_cache, shortcode early paths, register_handler, unregister_handler, get_embed_handler_html, maybe_make_link, delete_oembed_caches, autoembed_callback, autoembed, cache_oembed, and find_oembed_post_id.",
      "The generated shell preserves public defaults, constructor hook/shortcode registrations, shortcode registry save/clear/embed-only parse/restore behavior, edit-form Ajax cache script gating/output, shortcode empty/src/internal-handler entry behavior, native nested handlers array write/unset, sorted handler matching, callback dispatch, embed_handler_html filtering, maybe-link policy, selective oEmbed post-meta cache deletion, autoembed callback linkifunknown restoration, autoembed scanner dispatch, cache_oembed stateful dispatch, and oEmbed cache-post lookup against the upstream oracle."
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
      last_url: oracleObservations[fixtureCase.id].last_url ?? null,
      last_attr: oracleObservations[fixtureCase.id].last_attr ?? null,
      handler_events: oracleObservations[fixtureCase.id].handler_events ?? [],
      filter_events: oracleObservations[fixtureCase.id].filter_events ?? [],
      filter_registrations: oracleObservations[fixtureCase.id].filter_registrations ?? [],
      action_registrations: oracleObservations[fixtureCase.id].action_registrations ?? [],
      shortcode_events: oracleObservations[fixtureCase.id].shortcode_events ?? [],
      shortcode_tags: oracleObservations[fixtureCase.id].shortcode_tags ?? null,
      admin_url_calls: oracleObservations[fixtureCase.id].admin_url_calls ?? [],
      post_meta_deletes: oracleObservations[fixtureCase.id].post_meta_deletes ?? [],
      shortcode_calls: oracleObservations[fixtureCase.id].shortcode_calls ?? [],
      linkifunknown: oracleObservations[fixtureCase.id].linkifunknown ?? null,
      autoembed_callback_calls: oracleObservations[fixtureCase.id].autoembed_callback_calls ?? [],
      run_shortcode_calls: oracleObservations[fixtureCase.id].run_shortcode_calls ?? [],
      autoembed_calls: oracleObservations[fixtureCase.id].autoembed_calls ?? [],
      post_ID: oracleObservations[fixtureCase.id].post_ID ?? null,
      usecache: oracleObservations[fixtureCase.id].usecache ?? null,
      get_post_types_calls: oracleObservations[fixtureCase.id].get_post_types_calls ?? [],
      found_post_id: oracleObservations[fixtureCase.id].found_post_id ?? null,
      wp_cache_get_calls: oracleObservations[fixtureCase.id].wp_cache_get_calls ?? [],
      wp_cache_set_calls: oracleObservations[fixtureCase.id].wp_cache_set_calls ?? [],
      wp_query_calls: oracleObservations[fixtureCase.id].wp_query_calls ?? [],
      get_post_type_calls: oracleObservations[fixtureCase.id].get_post_type_calls ?? []
    },
    {
      handlers: candidateObservations[fixtureCase.id].handlers,
      property_defaults: candidateObservations[fixtureCase.id].property_defaults ?? null,
      html: candidateObservations[fixtureCase.id].html ?? null,
      output: candidateObservations[fixtureCase.id].output ?? null,
      last_url: candidateObservations[fixtureCase.id].last_url ?? null,
      last_attr: candidateObservations[fixtureCase.id].last_attr ?? null,
      handler_events: candidateObservations[fixtureCase.id].handler_events ?? [],
      filter_events: candidateObservations[fixtureCase.id].filter_events ?? [],
      filter_registrations: candidateObservations[fixtureCase.id].filter_registrations ?? [],
      action_registrations: candidateObservations[fixtureCase.id].action_registrations ?? [],
      shortcode_events: candidateObservations[fixtureCase.id].shortcode_events ?? [],
      shortcode_tags: candidateObservations[fixtureCase.id].shortcode_tags ?? null,
      admin_url_calls: candidateObservations[fixtureCase.id].admin_url_calls ?? [],
      post_meta_deletes: candidateObservations[fixtureCase.id].post_meta_deletes ?? [],
      shortcode_calls: candidateObservations[fixtureCase.id].shortcode_calls ?? [],
      linkifunknown: candidateObservations[fixtureCase.id].linkifunknown ?? null,
      autoembed_callback_calls: candidateObservations[fixtureCase.id].autoembed_callback_calls ?? [],
      run_shortcode_calls: candidateObservations[fixtureCase.id].run_shortcode_calls ?? [],
      autoembed_calls: candidateObservations[fixtureCase.id].autoembed_calls ?? [],
      post_ID: candidateObservations[fixtureCase.id].post_ID ?? null,
      usecache: candidateObservations[fixtureCase.id].usecache ?? null,
      get_post_types_calls: candidateObservations[fixtureCase.id].get_post_types_calls ?? [],
      found_post_id: candidateObservations[fixtureCase.id].found_post_id ?? null,
      wp_cache_get_calls: candidateObservations[fixtureCase.id].wp_cache_get_calls ?? [],
      wp_cache_set_calls: candidateObservations[fixtureCase.id].wp_cache_set_calls ?? [],
      wp_query_calls: candidateObservations[fixtureCase.id].wp_query_calls ?? [],
      get_post_type_calls: candidateObservations[fixtureCase.id].get_post_type_calls ?? []
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
