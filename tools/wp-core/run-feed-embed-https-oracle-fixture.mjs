#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.18.4",
  external_ref: "WPHX-312.04",
  title: "WPHX-312.04 — Add feed embed HTTPS oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-feed-embed-https-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-312-04";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-312-04-feed-embed-https-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-04-feed-embed-https-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-04-feed-embed-https-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const PRIOR_FIXTURE = "manifests/wp-core/wphx-312-03-http-cron-mail-oracle-fixture.v1.json";

const SOURCE_FILES = [
  "src/wp-includes/feed.php",
  "src/wp-includes/class-wp-oembed.php",
  "src/wp-includes/class-wp-embed.php",
  "src/wp-includes/embed.php",
  "src/wp-includes/https-detection.php",
  "src/wp-includes/https-migration.php"
];

const COVERED_SYMBOLS = [
  "get_bloginfo_rss",
  "bloginfo_rss",
  "get_default_feed",
  "get_wp_title_rss",
  "get_the_title_rss",
  "get_the_content_feed",
  "prep_atom_text_construct",
  "get_self_link",
  "feed_content_type",
  "wp_embed_defaults",
  "wp_embed_register_handler",
  "WP_Embed::get_embed_handler_html",
  "WP_Embed::shortcode",
  "wp_oembed_add_provider",
  "WP_oEmbed::get_provider",
  "WP_oEmbed::data2html",
  "WP_oEmbed::_strip_newlines",
  "get_oembed_endpoint_url",
  "wp_oembed_ensure_format",
  "_oembed_create_xml",
  "wp_is_using_https",
  "wp_is_home_url_using_https",
  "wp_is_site_url_using_https",
  "wp_should_replace_insecure_home_url",
  "wp_replace_insecure_home_url",
  "wp_update_urls_to_https",
  "wp_update_https_migration_required",
  "wp_get_https_detection_errors",
  "wp_is_https_supported",
  "wp_is_local_html_output"
];

const FIXTURE_CASES = [
  { id: "feed:text-content", focus: "RSS bloginfo/title/content helpers, default-feed normalization, Atom text construction, self link, and feed MIME mapping" },
  { id: "embed:handler-shortcode", focus: "embed defaults, local handler registration, handler rendering, and shortcode handler path without remote oEmbed lookup" },
  { id: "oembed:provider-html-xml", focus: "early provider registration, provider matching, data2html output, newline stripping, endpoint URL formatting, and XML response creation" },
  { id: "https:migration", focus: "HTTPS option migration, insecure home URL replacement, and migration-required option update" },
  { id: "https:detection-short-circuit", focus: "HTTPS detection error short-circuit and local HTML ownership checks without live HTTPS probing" }
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
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['REQUEST_URI'] = '/feed/?fixture=1';

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'WP_DEBUG', false );
define( 'DAY_IN_SECONDS', 86400 );

$GLOBALS['wp_filter'] = array();
$GLOBALS['wp_actions'] = array();
$GLOBALS['shortcode_tags'] = array();
$GLOBALS['content_width'] = 640;
$GLOBALS['wphx_312_04_filters'] = array();
$GLOBALS['wphx_312_04_actions'] = array();
$GLOBALS['wphx_312_04_errors'] = array();
$GLOBALS['wphx_312_04_options'] = array(
\t'home' => 'http://example.test',
\t'siteurl' => 'http://example.test',
\t'https_migration_required' => false,
\t'fresh_site' => false,
\t'blog_charset' => 'UTF-8',
);

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_312_04_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

class WP_Error {
\tpublic $errors = array();
\tpublic function __construct( $code = '', $message = '', $data = null ) {
\t\tif ( '' !== $code ) {
\t\t\t$this->add( $code, $message, $data );
\t\t}
\t}
\tpublic function add( $code, $message, $data = null ) {
\t\t$this->errors[ $code ][] = $message;
\t}
\tpublic function get_error_code() {
\t\t$codes = array_keys( $this->errors );
\t\treturn $codes[0] ?? '';
\t}
}

function __( $text ) { return $text; }
function __return_false() { return false; }
function is_wp_error( $thing ) { return $thing instanceof WP_Error; }
function wp_trigger_error( $function_name, $message, $error_level = E_USER_NOTICE ) {
\t$GLOBALS['wphx_312_04_errors'][] = array( 'triggered' => $function_name, 'message' => $message, 'level' => $error_level );
}
function _deprecated_argument( $function_name, $version, $message = '' ) {
\t$GLOBALS['wphx_312_04_errors'][] = array( 'deprecated_argument' => $function_name, 'version' => $version, 'message' => $message );
}
function get_bloginfo( $show = '', $filter = 'raw' ) {
\t$values = array(
\t\t'name' => 'Fixture & Blog',
\t\t'description' => 'Fixture description',
\t\t'url' => home_url(),
\t\t'charset' => 'UTF-8',
\t);
\treturn $values[ $show ] ?? 'Fixture Blog';
}
function convert_chars( $content ) {
\treturn htmlspecialchars( (string) $content, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' );
}
function wp_get_document_title() { return 'Fixture Document'; }
function get_the_title( $post = 0 ) { return 'Fixture Post <Title>'; }
function get_the_content() { return 'Alpha ]]> Beta'; }
function esc_html( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' ); }
function esc_attr( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' ); }
function esc_url( $value ) { return (string) $value; }
function esc_url_raw( $value ) { return (string) $value; }
function absint( $value ) { return abs( (int) $value ); }
function wp_parse_url( $url, $component = -1 ) {
\t$parsed = parse_url( $url );
\tif ( -1 === $component ) {
\t\treturn $parsed;
\t}
\treturn parse_url( $url, $component );
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
function add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wp_filter'][ $hook_name ][ $priority ][] = array( 'callback' => $callback, 'accepted_args' => $accepted_args );
\tksort( $GLOBALS['wp_filter'][ $hook_name ] );
\treturn true;
}
function add_action( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\treturn add_filter( $hook_name, $callback, $priority, $accepted_args );
}
function remove_action( $hook_name, $callback = false, $priority = 10 ) { return true; }
function has_action( $hook_name, $callback = false ) {
\tif ( 'wp_head' === $hook_name && 'rsd_link' === $callback ) {
\t\treturn 10;
\t}
\treturn ! empty( $GLOBALS['wp_filter'][ $hook_name ] );
}
function did_action( $hook_name ) {
\treturn $GLOBALS['wp_actions'][ $hook_name ] ?? 0;
}
function doing_action( $hook_name = null ) { return false; }
function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_312_04_filters'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) + 1 );
\tif ( empty( $GLOBALS['wp_filter'][ $hook_name ] ) ) {
\t\treturn $value;
\t}
\tforeach ( $GLOBALS['wp_filter'][ $hook_name ] as $callbacks ) {
\t\tforeach ( $callbacks as $record ) {
\t\t\t$callback_args = array_merge( array( $value ), $args );
\t\t\t$value = call_user_func_array( $record['callback'], array_slice( $callback_args, 0, $record['accepted_args'] ) );
\t\t}
\t}
\treturn $value;
}
function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wp_actions'][ $hook_name ] = ( $GLOBALS['wp_actions'][ $hook_name ] ?? 0 ) + 1;
\t$GLOBALS['wphx_312_04_actions'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) );
\tapply_filters( $hook_name, null, ...$args );
}
function add_shortcode( $tag, $callback ) { $GLOBALS['shortcode_tags'][ $tag ] = $callback; }
function remove_all_shortcodes() { $GLOBALS['shortcode_tags'] = array(); }
function do_shortcode( $content, $ignore_html = false ) { return $content; }
function get_post( $post = null ) {
\treturn (object) array( 'ID' => 7, 'post_title' => 'Fixture Post' );
}
function get_post_meta( $post_id, $key = '', $single = false ) { return ''; }
function update_post_meta( $post_id, $key, $value ) { return true; }
function delete_post_meta( $post_id, $key ) { return true; }
function get_permalink( $post = null ) { return 'https://example.test/post/7/'; }
function wp_replace_in_html_tags( $haystack, $replace_pairs ) { return strtr( $haystack, $replace_pairs ); }
function wp_get_audio_extensions() { return array( 'mp3', 'm4a' ); }
function wp_get_video_extensions() { return array( 'mp4', 'webm' ); }
function rest_url( $path = '' ) { return 'https://example.test/wp-json/' . ltrim( $path, '/' ); }
function add_query_arg( ...$args ) {
\tif ( is_array( $args[0] ) ) {
\t\t$params = $args[0];
\t\t$url = $args[1];
\t} else {
\t\t$params = array( $args[0] => $args[1] );
\t\t$url = $args[2];
\t}
\t$query = array();
\tforeach ( $params as $key => $value ) {
\t\tif ( false !== $value ) {
\t\t\t$query[] = rawurlencode( $key ) . '=' . rawurlencode( $value );
\t\t}
\t}
\treturn $url . ( str_contains( $url, '?' ) ? '&' : '?' ) . implode( '&', $query );
}
function home_url( $path = '', $scheme = null ) {
\t$url = $GLOBALS['wphx_312_04_options']['home'] . $path;
\tif ( 'https' === $scheme ) {
\t\t$url = preg_replace( '#^http://#', 'https://', $url );
\t} elseif ( 'http' === $scheme ) {
\t\t$url = preg_replace( '#^https://#', 'http://', $url );
\t}
\treturn $url;
}
function site_url( $path = '', $scheme = null ) {
\t$url = $GLOBALS['wphx_312_04_options']['siteurl'] . '/' . ltrim( $path, '/' );
\tif ( '' === $path ) {
\t\t$url = rtrim( $GLOBALS['wphx_312_04_options']['siteurl'], '/' );
\t}
\tif ( 'https' === $scheme ) {
\t\t$url = preg_replace( '#^http://#', 'https://', $url );
\t} elseif ( 'http' === $scheme || 'rpc' === $scheme ) {
\t\t$url = preg_replace( '#^https://#', 'http://', $url );
\t}
\treturn $url;
}
function set_url_scheme( $url, $scheme = null ) {
\t$scheme = $scheme ?: wp_parse_url( home_url(), PHP_URL_SCHEME );
\treturn preg_replace( '#^https?://#', $scheme . '://', $url );
}
function wp_unslash( $value ) { return $value; }
function get_option( $name, $default = false ) {
\treturn array_key_exists( $name, $GLOBALS['wphx_312_04_options'] ) ? $GLOBALS['wphx_312_04_options'][ $name ] : $default;
}
function update_option( $name, $value, $autoload = null ) {
\t$GLOBALS['wphx_312_04_options'][ $name ] = $value;
\treturn true;
}
function delete_option( $name ) {
\tunset( $GLOBALS['wphx_312_04_options'][ $name ] );
\treturn true;
}
function wp_installing() { return false; }
function untrailingslashit( $value ) { return rtrim( (string) $value, '/\\\\' ); }
function get_rest_url() { return 'https://example.test/wp-json/'; }
function wp_remote_request( $url, $args = array() ) {
\treturn new WP_Error( 'unexpected_remote_request', 'Remote request should be short-circuited in this fixture.' );
}

require ABSPATH . WPINC . '/feed.php';
require ABSPATH . WPINC . '/class-wp-oembed.php';
require ABSPATH . WPINC . '/class-wp-embed.php';
require ABSPATH . WPINC . '/embed.php';
require ABSPATH . WPINC . '/https-detection.php';
require ABSPATH . WPINC . '/https-migration.php';

$wp_embed = new WP_Embed();

add_filter( 'default_feed', static fn( $value ) => 'rss', 10, 1 );
$feed_text = array(
\t'bloginfo' => get_bloginfo_rss( 'name' ),
\t'default_feed' => get_default_feed(),
\t'title' => get_wp_title_rss(),
\t'post_title' => get_the_title_rss(),
\t'content' => get_the_content_feed( 'atom' ),
\t'atom_plain' => prep_atom_text_construct( 'plain text' ),
\t'atom_xhtml' => prep_atom_text_construct( '<strong>Hi</strong>' ),
\t'atom_cdata' => prep_atom_text_construct( 'A & B' ),
\t'self_link' => get_self_link(),
\t'content_type_atom' => feed_content_type( 'atom' ),
\t'content_type_unknown' => feed_content_type( 'fixture' ),
);

$embed_defaults = wp_embed_defaults( 'https://media.example/video' );
wp_embed_register_handler(
\t'wphx_fixture',
\t'#https://media\\.example/items/(\\d+)#',
\tstatic function ( $matches, $attr, $url, $rawattr ) {
\t\treturn '<figure data-id="' . esc_attr( $matches[1] ) . '" data-width="' . esc_attr( $attr['width'] ) . '">' . esc_html( $url ) . '</figure>';
\t},
\t9
);
$handler_html = $wp_embed->get_embed_handler_html( array( 'width' => 320 ), 'https://media.example/items/42' );
$shortcode_html = $wp_embed->shortcode( array( 'width' => 321 ), 'https://media.example/items/43' );

wp_oembed_add_provider( 'https://fixture.example/*', 'https://provider.example/oembed.{format}', false );
$oembed = _wp_oembed_get_object();
$provider = $oembed->get_provider( 'https://fixture.example/post/1', array( 'discover' => false ) );
$photo_html = $oembed->data2html(
\t(object) array( 'type' => 'photo', 'url' => 'https://cdn.example/photo.jpg', 'width' => 300, 'height' => 200, 'title' => 'Photo Title' ),
\t'https://fixture.example/post/1'
);
$rich_html = $oembed->data2html(
\t(object) array( 'type' => 'rich', 'html' => "<iframe>\\n</iframe>" ),
\t'https://fixture.example/post/2'
);
$endpoint_xml = get_oembed_endpoint_url( 'https://example.test/post/7/', 'xml' );
$xml = _oembed_create_xml( array( 'type' => 'link', 'title' => 'Fixture', 'nested' => array( 'width' => 100 ) ) );

wp_update_https_migration_required( 'http://example.test', 'https://example.test' );
$migration_required_before = get_option( 'https_migration_required' );
$update_urls_result = wp_update_urls_to_https();
$should_replace = wp_should_replace_insecure_home_url();
$replaced_content = wp_replace_insecure_home_url( 'Visit http://example.test and http:\\/\\/example.test' );

$short_circuit_error = new WP_Error( 'ssl_verification_failed', 'SSL verification failed.' );
add_filter( 'pre_wp_get_https_detection_errors', static fn( $pre ) => $short_circuit_error, 10, 1 );
$https_errors = wp_get_https_detection_errors();
$https_supported = wp_is_https_supported();
$local_html_true = wp_is_local_html_output( '<html><link href="//example.test/xmlrpc.php?rsd" /></html>' );
$local_html_false = wp_is_local_html_output( '<html><link href="//other.example/xmlrpc.php?rsd" /></html>' );

$cases = array(
\t'feed:text-content' => $feed_text,
\t'embed:handler-shortcode' => array(
\t\t'defaults' => $embed_defaults,
\t\t'handler_has_id' => str_contains( $handler_html, 'data-id="42"' ),
\t\t'handler_has_width' => str_contains( $handler_html, 'data-width="320"' ),
\t\t'shortcode_has_id' => str_contains( $shortcode_html, 'data-id="43"' ),
\t\t'shortcode_has_width' => str_contains( $shortcode_html, 'data-width="321"' ),
\t\t'handler_count' => count( $wp_embed->handlers[9] ?? array() ),
\t),
\t'oembed:provider-html-xml' => array(
\t\t'provider' => $provider,
\t\t'photo_has_img' => str_contains( $photo_html, '<img src="https://cdn.example/photo.jpg"' ),
\t\t'photo_has_dimensions' => str_contains( $photo_html, 'width="300" height="200"' ),
\t\t'rich_html' => $rich_html,
\t\t'endpoint_xml' => $endpoint_xml,
\t\t'format_yaml' => wp_oembed_ensure_format( 'yaml' ),
\t\t'format_xml' => wp_oembed_ensure_format( 'xml' ),
\t\t'xml_has_nested_width' => str_contains( $xml, '<width>100</width>' ),
\t),
\t'https:migration' => array(
\t\t'migration_required_before' => $migration_required_before,
\t\t'update_urls_result' => $update_urls_result,
\t\t'home' => get_option( 'home' ),
\t\t'siteurl' => get_option( 'siteurl' ),
\t\t'is_using_https' => wp_is_using_https(),
\t\t'should_replace' => $should_replace,
\t\t'replaced_content' => $replaced_content,
\t),
\t'https:detection-short-circuit' => array(
\t\t'errors' => $https_errors,
\t\t'supported' => $https_supported,
\t\t'local_true' => $local_html_true,
\t\t'local_false' => $local_html_false,
\t),
);

ksort( $cases );
echo json_encode(
\tarray(
\t\t'cases' => $cases,
\t\t'actions' => $GLOBALS['wphx_312_04_actions'],
\t\t'filters' => $GLOBALS['wphx_312_04_filters'],
\t\t'php_errors' => $GLOBALS['wphx_312_04_errors'],
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
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-312-feed-embed-https-oracle-fixture`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/feed-embed-https-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "feed helper, embed/oEmbed local routing, and HTTPS detection/migration behavior",
      area: SOURCE_FILES.join(" "),
      public_contract:
        "This fixture executes copied WordPress 7.0 feed, embed/oEmbed, and HTTPS source against deterministic in-process hooks/options. It does not perform remote feed fetches, remote oEmbed provider requests, live HTTPS probing, feed template rendering, installed behavior, upstream PHPUnit parity, or generated public PHP replacement."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-haxe-adapter-contract-foundation",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass feed template/rendering, remote fetch/oEmbed discovery, HTTPS probing, installed distribution, and selected upstream PHPUnit gates before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-feed-embed-https-oracle-fixture",
        "npm run wp:core:wphx-312-feed-embed-https-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-04-feed-embed-https-oracle-fixture"],
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
  schema: "wphx.wp-core-feed-embed-https-oracle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["oracle_source_mirror", "candidate_package_mirror"],
  artifact_scope: "fixture",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT),
    prior_fixture_manifest: inputRecord(PRIOR_FIXTURE),
    runner: inputRecord(RUNNER),
    upstream_sources: SOURCE_FILES.map(sourceRecord)
  },
  fixture: {
    cases: FIXTURE_CASES,
    covered_symbols: COVERED_SYMBOLS,
    source_files: SOURCE_FILES,
    probe: { path: PROBE, sha256: sha256File(PROBE) },
    side_effect_policy: {
      live_network_io: false,
      remote_feed_fetch: false,
      remote_oembed_provider_fetch: false,
      live_https_probe: false,
      feed_template_rendering: false
    },
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
      id: "feed-template-rendering-and-remote-fetch-not-executed",
      owner: ISSUE.external_ref,
      detail:
        "The fixture covers feed helper functions only. do_feed_* template output, SimplePie fetch_feed behavior, OPML output, cache integration, and XML feed installed behavior remain later WPHX-312 gates."
    },
    {
      id: "remote-oembed-discovery-not-executed",
      owner: ISSUE.external_ref,
      detail:
        "The fixture covers local provider matching, data conversion, endpoint URL formatting, XML creation, and local embed handlers. Remote oEmbed discovery/fetch, REST controller dispatch, iframe filtering, and post embed rendering remain later gates."
    },
    {
      id: "live-https-probing-not-executed",
      owner: ISSUE.external_ref,
      detail:
        "HTTPS detection is short-circuited through pre_wp_get_https_detection_errors; live HTTPS requests, TLS verification, and remote response-source validation remain later gates."
    },
    {
      id: "trackback-ai-client-privacy-mail-not-executed",
      owner: ISSUE.external_ref,
      detail:
        "Trackback, AI-client HTTP provider behavior, and privacy request mail flows are still outside this fixture."
    },
    {
      id: "public-php-adapter-not-yet-generated",
      owner: ISSUE.external_ref,
      detail:
        "The fixture compares copied oracle PHP in both roots; generated original-path PHP replacement remains a later cross-domain gate."
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
  id: "receipt:wphx-312-04-feed-embed-https-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "feed/embed/HTTPS oracle-source-mirror fixture manifest" },
    { path: OWNERSHIP, role: "ownership manifest for copied-oracle feed/embed/HTTPS boundary" },
    { path: RUNNER, role: "deterministic oracle/candidate fixture generator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-312-feed-embed-https-oracle-fixture",
    "npm run wp:core:wphx-312-feed-embed-https-oracle-fixture:check",
    "npm run receipts:validate",
    "npm run beads:validate"
  ],
  related_receipts: [
    "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
    "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
    "receipt:wphx-312-03-http-cron-mail-oracle-fixture"
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
