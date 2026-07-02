#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const checkOnly = process.argv.includes("--check");
const RECORDED_AT = "2026-07-02T23:59:30Z";
const ISSUE = {
  id: "wordpresshx-f2w7",
  external_ref: "WPHX-COMP-PHP-FEED-EMBED-HTTPS-REMAINDER",
  title: "Expand feed embed HTTPS original-path adapters"
};
const RUNNER = "tools/wphx-php/run-embed-module-functions.mjs";
const IMPL_HXML = "fixtures/wphx-php/embed-module-functions-impl.hxml";
const SHELL_HXML = "fixtures/wphx-php/embed-module-functions.hxml";
const SOURCE_FILES = [
  "src/wphx/compiler/php/WphxPhpCompiler.hx",
  "fixtures/wphx-php/src/wphx/fixtures/php/embed/EmbedImplEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/php/embed/EmbedKernel.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/embed/EmbedModuleEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/embed/EmbedModuleSurface.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/embed/HaxeEmbedKernel.hx"
];
const OUT_ROOT = "build/wphx-php/embed-module-functions";
const GENERATED_ROOT = `${OUT_ROOT}/generated`;
const GENERATED_SHELL = `${GENERATED_ROOT}/wp-includes/embed.php`;
const EMISSION_MANIFEST = `${GENERATED_ROOT}/wphx-php-emission.v1.json`;
const ORACLE_SHELL = `${OUT_ROOT}/oracle/wp-includes/embed.php`;
const PROBE = `${OUT_ROOT}/probe.php`;
const MANIFEST = "manifests/wphx-php/embed-module-functions.v1.json";
const RECEIPT = "receipts/compiler/wphx-comp-php-embed-module-functions.v1.json";
const EXACT_PATTERNS = [
  "if (!defined('WPHX_EMBED_MODULE_BOOTSTRAPPED'))",
  "function wp_embed_register_handler($id, $regex, $callback, $priority = 10)",
  "function wp_embed_unregister_handler($id, $priority = 10)",
  "function wp_embed_defaults($url = '')",
  "function wp_oembed_get($url, $args = '')",
  "function _wp_oembed_get_object()",
  "function get_oembed_endpoint_url($permalink = '', $format = 'json')",
  "function wp_oembed_ensure_format($format)",
  "function wp_oembed_add_provider($format, $provider, $regex = false)",
  "function wp_oembed_remove_provider($format)",
  "function wp_oembed_register_route()",
  "function wp_oembed_add_discovery_links()",
  "function wp_oembed_add_host_js()",
  "function wp_maybe_enqueue_oembed_host_js($html)",
  "function wp_embed_excerpt_more($more_string)",
  "function the_excerpt_embed()",
  "function wp_embed_excerpt_attachment($content)",
  "function enqueue_embed_scripts()",
  "function the_embed_site_title()",
  "function wp_filter_pre_oembed_result($result, $url, $args)",
  "function wp_maybe_load_embeds()",
  "function wp_embed_handler_youtube($matches, $attr, $url, $rawattr)",
  "function wp_embed_handler_audio($matches, $attr, $url, $rawattr)",
  "function wp_embed_handler_video($matches, $attr, $url, $rawattr)",
  "EmbedKernel::embedRegisterHandler($id, $regex, $callback, $priority)",
  "EmbedKernel::embedUnregisterHandler($id, $priority)",
  "EmbedKernel::embedDefaults($url)",
  "EmbedKernel::oembedGet($url, $args)",
  "EmbedKernel::oembedGetObject()",
  "EmbedKernel::oembedEndpointUrl($permalink, $format)",
  "EmbedKernel::oembedAddProvider($format, $provider, $regex)",
  "EmbedKernel::oembedRemoveProvider($format)",
  "EmbedKernel::oembedRegisterRoute()",
  "EmbedKernel::oembedDiscoveryLinks()",
  "EmbedKernel::oembedAddHostJs()",
  "EmbedKernel::maybeEnqueueOembedHostJs($html)",
  "EmbedKernel::embedExcerptMore($more_string)",
  "EmbedKernel::excerptEmbed()",
  "EmbedKernel::embedExcerptAttachment($content)",
  "EmbedKernel::enqueueEmbedScripts()",
  "EmbedKernel::embedSiteTitle()",
  "EmbedKernel::filterPreOembedResult($result, $url, $args)",
  "EmbedKernel::maybeLoadEmbeds()",
  "EmbedKernel::embedHandlerYoutube($matches, $attr, $url, $rawattr)",
  "EmbedKernel::embedHandlerAudio($matches, $attr, $url, $rawattr)"
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    ...options
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\nstdout:\n${result.stdout ?? ""}\nstderr:\n${result.stderr ?? ""}`);
  }
  return result.stdout ?? "";
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function inputRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
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

function oracleSource() {
  return `<?php
function wp_embed_register_handler( $id, $regex, $callback, $priority = 10 ) {
\tglobal $wp_embed;
\t$wp_embed->register_handler( $id, $regex, $callback, $priority );
}

function wp_embed_unregister_handler( $id, $priority = 10 ) {
\tglobal $wp_embed;
\t$wp_embed->unregister_handler( $id, $priority );
}

function wp_embed_defaults( $url = '' ) {
\tif ( ! empty( $GLOBALS['content_width'] ) ) {
\t\t$width = (int) $GLOBALS['content_width'];
\t}

\tif ( empty( $width ) ) {
\t\t$width = 500;
\t}

\t$height = min( (int) ceil( $width * 1.5 ), 1000 );

\treturn apply_filters( 'embed_defaults', compact( 'width', 'height' ), $url );
}

function wp_oembed_get( $url, $args = '' ) {
\t$oembed = _wp_oembed_get_object();
\treturn $oembed->get_html( $url, $args );
}

function _wp_oembed_get_object() {
\tstatic $wp_oembed = null;

\tif ( is_null( $wp_oembed ) ) {
\t\t$wp_oembed = new WP_oEmbed();
\t}
\treturn $wp_oembed;
}

function get_oembed_endpoint_url( $permalink = '', $format = 'json' ) {
\t$url = rest_url( 'oembed/1.0/embed' );

\tif ( '' !== $permalink ) {
\t\t$url = add_query_arg(
\t\t\tarray(
\t\t\t\t'url'    => urlencode( $permalink ),
\t\t\t\t'format' => ( 'json' !== $format ) ? $format : false,
\t\t\t),
\t\t\t$url
\t\t);
\t}

\treturn apply_filters( 'oembed_endpoint_url', $url, $permalink, $format );
}

function wp_oembed_ensure_format( $format ) {
\tif ( ! in_array( $format, array( 'json', 'xml' ), true ) ) {
\t\treturn 'json';
\t}

\treturn $format;
}

function wp_oembed_add_provider( $format, $provider, $regex = false ) {
\tif ( did_action( 'plugins_loaded' ) ) {
\t\t$oembed                       = _wp_oembed_get_object();
\t\t$oembed->providers[ $format ] = array( $provider, $regex );
\t} else {
\t\tWP_oEmbed::_add_provider_early( $format, $provider, $regex );
\t}
}

function wp_oembed_remove_provider( $format ) {
\tif ( did_action( 'plugins_loaded' ) ) {
\t\t$oembed = _wp_oembed_get_object();

\t\tif ( isset( $oembed->providers[ $format ] ) ) {
\t\t\tunset( $oembed->providers[ $format ] );
\t\t\treturn true;
\t\t}
\t} else {
\t\tWP_oEmbed::_remove_provider_early( $format );
\t}

\treturn false;
}

function wp_oembed_register_route() {
\t$controller = new WP_oEmbed_Controller();
\t$controller->register_routes();
}

function wp_oembed_add_discovery_links() {
\tif ( doing_action( 'wp_head' ) ) {
\t\tif ( ! has_action( 'wp_head', 'wp_oembed_add_discovery_links', 10 ) ) {
\t\t\treturn;
\t\t}

\t\tremove_action( 'wp_head', 'wp_oembed_add_discovery_links' );
\t}

\t$output = '';

\tif ( is_singular() && is_post_embeddable() ) {
\t\t$output .= '<link rel="alternate" title="' . _x( 'oEmbed (JSON)', 'oEmbed resource link name' ) . '" type="application/json+oembed" href="' . esc_url( get_oembed_endpoint_url( get_permalink() ) ) . '" />' . "\\n";

\t\tif ( class_exists( 'SimpleXMLElement' ) ) {
\t\t\t$output .= '<link rel="alternate" title="' . _x( 'oEmbed (XML)', 'oEmbed resource link name' ) . '" type="text/xml+oembed" href="' . esc_url( get_oembed_endpoint_url( get_permalink(), 'xml' ) ) . '" />' . "\\n";
\t\t}
\t}

\techo apply_filters( 'oembed_discovery_links', $output );
}

function wp_oembed_add_host_js() {}

function wp_maybe_enqueue_oembed_host_js( $html ) {
\tif (
\t\thas_action( 'wp_head', 'wp_oembed_add_host_js' )
\t\t&&
\t\tpreg_match( '/<blockquote\\s[^>]*?wp-embedded-content/', $html )
\t) {
\t\twp_enqueue_script( 'wp-embed' );
\t}
\treturn $html;
}

function wp_embed_excerpt_more( $more_string ) {
\tif ( ! is_embed() ) {
\t\treturn $more_string;
\t}

\t$link = sprintf(
\t\t'<a href="%1$s" class="wp-embed-more" target="_top">%2$s</a>',
\t\tesc_url( get_permalink() ),
\t\tsprintf( __( 'Continue reading %s' ), '<span class="screen-reader-text">' . get_the_title() . '</span>' )
\t);
\treturn ' &hellip; ' . $link;
}

function the_excerpt_embed() {
\t$output = get_the_excerpt();

\techo apply_filters( 'the_excerpt_embed', $output );
}

function wp_embed_excerpt_attachment( $content ) {
\tif ( is_attachment() ) {
\t\treturn prepend_attachment( '' );
\t}

\treturn $content;
}

function enqueue_embed_scripts() {
\tdo_action( 'enqueue_embed_scripts' );
}

function the_embed_site_title() {
\t$site_title = sprintf(
\t\t'<a href="%s" target="_top"><img src="%s" srcset="%s 2x" width="32" height="32" alt="" class="wp-embed-site-icon" /><span>%s</span></a>',
\t\tesc_url( home_url() ),
\t\tesc_url( get_site_icon_url( 32, includes_url( 'images/w-logo-blue.png' ) ) ),
\t\tesc_url( get_site_icon_url( 64, includes_url( 'images/w-logo-blue.png' ) ) ),
\t\tesc_html( get_bloginfo( 'name' ) )
\t);

\t$site_title = '<div class="wp-embed-site-title">' . $site_title . '</div>';

\techo apply_filters( 'embed_site_title_html', $site_title );
}

function wp_filter_pre_oembed_result( $result, $url, $args ) {
\t$data = get_oembed_response_data_for_url( $url, $args );

\tif ( $data ) {
\t\treturn _wp_oembed_get_object()->data2html( $data, $url );
\t}

\treturn $result;
}

function wp_maybe_load_embeds() {
\tif ( ! apply_filters( 'load_default_embeds', true ) ) {
\t\treturn;
\t}

\twp_embed_register_handler( 'youtube_embed_url', '#https?://(www\\.)?youtube\\.com/(?:v|embed)/([^/]+)#i', 'wp_embed_handler_youtube' );
\twp_embed_register_handler( 'audio', '#^https?://.+?\\.(' . implode( '|', wp_get_audio_extensions() ) . ')$#i', apply_filters( 'wp_audio_embed_handler', 'wp_embed_handler_audio' ), 9999 );
\twp_embed_register_handler( 'video', '#^https?://.+?\\.(' . implode( '|', wp_get_video_extensions() ) . ')$#i', apply_filters( 'wp_video_embed_handler', 'wp_embed_handler_video' ), 9999 );
}

function wp_embed_handler_youtube( $matches, $attr, $url, $rawattr ) {
\tglobal $wp_embed;
\t$embed = $wp_embed->autoembed( sprintf( 'https://youtube.com/watch?v=%s', urlencode( $matches[2] ) ) );

\treturn apply_filters( 'wp_embed_handler_youtube', $embed, $attr, $url, $rawattr );
}

function wp_embed_handler_audio( $matches, $attr, $url, $rawattr ) {
\t$audio = sprintf( '[audio src="%s" /]', esc_url( $url ) );

\treturn apply_filters( 'wp_embed_handler_audio', $audio, $attr, $url, $rawattr );
}

function wp_embed_handler_video( $matches, $attr, $url, $rawattr ) {
\t$dimensions = '';
\tif ( ! empty( $rawattr['width'] ) && ! empty( $rawattr['height'] ) ) {
\t\t$dimensions .= sprintf( 'width="%d" ', (int) $rawattr['width'] );
\t\t$dimensions .= sprintf( 'height="%d" ', (int) $rawattr['height'] );
\t}
\t$video = sprintf( '[video %s src="%s" /]', $dimensions, esc_url( $url ) );

\treturn apply_filters( 'wp_embed_handler_video', $video, $attr, $url, $rawattr );
}
`;
}

function probeSource() {
  return `<?php
$mode = $argv[1];
$shell = $argv[2];

$GLOBALS['wphx_filter_log'] = array();
$GLOBALS['wphx_filter_overrides'] = array();
$GLOBALS['content_width'] = null;

function wphx_embed_truthy( $value ) {
\treturn (bool) $value;
}

function wphx_embed_array_set( &$array, $key, $value ) {
\t$array[ $key ] = $value;
}

function wphx_embed_array_unset( &$array, $key ) {
\tunset( $array[ $key ] );
}

class WP_oEmbed {
\tpublic $providers = array();
\tpublic $calls = array();
\tpublic static $early_providers = array();

\tpublic function get_html( $url, $args = '' ) {
\t\t$this->calls[] = array(
\t\t\t'action' => 'get_html',
\t\t\t'url' => $url,
\t\t\t'args' => $args,
\t\t);
\t\treturn str_contains( $url, 'missing' ) ? false : '<embed data-url="' . $url . '">';
\t}

\tpublic function data2html( $data, $url ) {
\t\t$this->calls[] = array(
\t\t\t'action' => 'data2html',
\t\t\t'data' => $data,
\t\t\t'url' => $url,
\t\t);
\t\treturn '<html data-url="' . $url . '">' . $data->title . '</html>';
\t}

\tpublic static function _add_provider_early( $format, $provider, $regex = false ) {
\t\tself::$early_providers['add'][ $format ] = array( $provider, $regex );
\t}

\tpublic static function _remove_provider_early( $format ) {
\t\tself::$early_providers['remove'][] = $format;
\t}
}

class WP_oEmbed_Controller {
\tpublic function register_routes() {
\t\t$GLOBALS['wphx_route_log'][] = array( 'controller' => 'WP_oEmbed_Controller', 'method' => 'register_routes' );
\t}
}

function did_action( $hook_name ) {
\treturn $GLOBALS['wphx_did_actions'][ $hook_name ] ?? 0;
}

function do_action( $hook_name ) {
\t$GLOBALS['wphx_action_log'][] = array( 'hook' => $hook_name );
}

function doing_action( $hook_name ) {
\treturn $GLOBALS['wphx_doing_actions'][ $hook_name ] ?? 0;
}

function has_action( $hook_name, $callback = false, $priority = null ) {
\tif ( null !== $priority ) {
\t\treturn ( $GLOBALS['wphx_actions'][ $hook_name ][ $callback ] ?? null ) === $priority ? $priority : false;
\t}
\treturn $GLOBALS['wphx_actions'][ $hook_name ][ $callback ] ?? false;
}

function remove_action( $hook_name, $callback = false ) {
\t$GLOBALS['wphx_removed_actions'][] = array( 'hook' => $hook_name, 'callback' => $callback );
\tunset( $GLOBALS['wphx_actions'][ $hook_name ][ $callback ] );
}

function is_singular() {
\treturn $GLOBALS['wphx_is_singular'];
}

function is_post_embeddable() {
\treturn $GLOBALS['wphx_is_post_embeddable'];
}

function is_embed() {
\treturn $GLOBALS['wphx_is_embed'];
}

function is_attachment() {
\treturn $GLOBALS['wphx_is_attachment'];
}

function _x( $text, $context ) {
\treturn $text;
}

function __( $text ) {
\treturn $text;
}

function get_permalink() {
\treturn $GLOBALS['wphx_permalink'];
}

function home_url() {
\treturn 'https://example.test';
}

function includes_url( $path = '' ) {
\treturn 'https://example.test/wp-includes/' . ltrim( $path, '/' );
}

function get_site_icon_url( $size = 512, $url = '' ) {
\treturn 'https://cdn.example/icon-' . $size . '.png';
}

function get_bloginfo( $show = '' ) {
\treturn 'Example Site';
}

function get_the_title() {
\treturn $GLOBALS['wphx_post_title'];
}

function get_the_excerpt() {
\treturn $GLOBALS['wphx_excerpt'];
}

function prepend_attachment( $content ) {
\treturn '[attachment-player]' . $content;
}

function wp_enqueue_script( $handle ) {
\t$GLOBALS['wphx_enqueued_scripts'][] = $handle;
}

function esc_html( $value ) {
\treturn htmlspecialchars( (string) $value, ENT_QUOTES, 'UTF-8' );
}

function get_oembed_response_data_for_url( $url, $args ) {
\tif ( str_contains( $url, 'local' ) ) {
\t\t$data = new stdClass();
\t\t$data->title = 'Local Embed';
\t\t$data->args = $args;
\t\treturn $data;
\t}
\treturn false;
}

class WPHX_Embed_Object {
\tpublic $calls = array();

\tpublic function register_handler( $id, $regex, $callback, $priority = 10 ) {
\t\t$this->calls[] = array(
\t\t\t'action' => 'register',
\t\t\t'id' => $id,
\t\t\t'regex' => $regex,
\t\t\t'callback' => $callback,
\t\t\t'priority' => $priority,
\t\t);
\t}

\tpublic function unregister_handler( $id, $priority = 10 ) {
\t\t$this->calls[] = array(
\t\t\t'action' => 'unregister',
\t\t\t'id' => $id,
\t\t\t'priority' => $priority,
\t\t);
\t}

\tpublic function autoembed( $url ) {
\t\t$this->calls[] = array(
\t\t\t'action' => 'autoembed',
\t\t\t'url' => $url,
\t\t);
\t\treturn '<iframe src="' . $url . '"></iframe>';
\t}
}

function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_filter_log'][] = array(
\t\t'hook' => $hook_name,
\t\t'value' => $value,
\t\t'args' => $args,
\t);
\tif ( array_key_exists( $hook_name, $GLOBALS['wphx_filter_overrides'] ) ) {
\t\t$override = $GLOBALS['wphx_filter_overrides'][ $hook_name ];
\t\treturn is_callable( $override ) ? $override( $value, ...$args ) : $override;
\t}
\treturn $value;
}

function rest_url( $path = '' ) {
\treturn 'https://example.test/wp-json/' . ltrim( $path, '/' );
}

function add_query_arg( $args, $url ) {
\t$query = array();
\tforeach ( $args as $key => $value ) {
\t\tif ( false !== $value ) {
\t\t\t$query[] = rawurlencode( $key ) . '=' . rawurlencode( $value );
\t\t}
\t}
\treturn $url . ( str_contains( $url, '?' ) ? '&' : '?' ) . implode( '&', $query );
}

function esc_url( $url ) {
\treturn str_replace( '&', '&amp;', (string) $url );
}

function wp_get_audio_extensions() {
\treturn array( 'mp3', 'm4a' );
}

function wp_get_video_extensions() {
\treturn array( 'mp4', 'webm' );
}

require $shell;

function wphx_capture( $callback ) {
\tob_start();
\t$return = $callback();
\t$output = ob_get_clean();
\treturn array(
\t\t'return' => $return,
\t\t'output' => $output,
\t);
}

function wphx_case( $id, $content_width, $filters, $callback ) {
\t$GLOBALS['content_width'] = $content_width;
\t$GLOBALS['wphx_filter_log'] = array();
\t$GLOBALS['wphx_filter_overrides'] = $filters;
\t$GLOBALS['wphx_action_log'] = array();
\t$GLOBALS['wphx_did_actions'] = array();
\t$GLOBALS['wphx_doing_actions'] = array();
\t$GLOBALS['wphx_actions'] = array( 'wp_head' => array( 'wp_oembed_add_host_js' => 10 ) );
\t$GLOBALS['wphx_removed_actions'] = array();
\t$GLOBALS['wphx_enqueued_scripts'] = array();
\t$GLOBALS['wphx_route_log'] = array();
\t$GLOBALS['wphx_is_singular'] = true;
\t$GLOBALS['wphx_is_post_embeddable'] = true;
\t$GLOBALS['wphx_is_embed'] = true;
\t$GLOBALS['wphx_is_attachment'] = false;
\t$GLOBALS['wphx_permalink'] = 'https://example.test/post/7/';
\t$GLOBALS['wphx_post_title'] = 'Embed Title';
\t$GLOBALS['wphx_excerpt'] = 'Excerpt body';
\t$GLOBALS['wp_embed'] = new WPHX_Embed_Object();
\tWP_oEmbed::$early_providers = array();
\t$oembed = _wp_oembed_get_object();
\t$oembed->providers = array();
\t$oembed->calls = array();
\t$value = $callback();
\treturn array(
\t\t'id' => $id,
\t\t'value' => $value,
\t\t'embed_calls' => $GLOBALS['wp_embed']->calls,
\t\t'oembed_calls' => $oembed->calls,
\t\t'providers' => $oembed->providers,
\t\t'early_providers' => WP_oEmbed::$early_providers,
\t\t'enqueued_scripts' => $GLOBALS['wphx_enqueued_scripts'],
\t\t'routes' => $GLOBALS['wphx_route_log'],
\t\t'actions_fired' => $GLOBALS['wphx_action_log'],
\t\t'actions' => $GLOBALS['wphx_actions'],
\t\t'removed_actions' => $GLOBALS['wphx_removed_actions'],
\t\t'filters' => $GLOBALS['wphx_filter_log'],
\t);
}

$cases = array();
$cases[] = wphx_case( 'handler:register-default-priority', null, array(), function () {
\treturn wp_embed_register_handler( 'fixture', '#fixture#', 'fixture_callback' );
} );
$cases[] = wphx_case( 'handler:register-custom-priority', null, array(), function () {
\treturn wp_embed_register_handler( 'fixture', '#fixture#', array( 'Fixture', 'callback' ), 7 );
} );
$cases[] = wphx_case( 'handler:unregister-default-priority', null, array(), function () {
\treturn wp_embed_unregister_handler( 'fixture' );
} );
$cases[] = wphx_case( 'handler:unregister-custom-priority', null, array(), function () {
\treturn wp_embed_unregister_handler( 'fixture', 7 );
} );
$cases[] = wphx_case( 'embed-defaults:fallback', null, array(), function () {
\treturn wp_embed_defaults( 'https://media.example/video' );
} );
$cases[] = wphx_case( 'embed-defaults:content-width', 640, array(), function () {
\treturn wp_embed_defaults( 'https://media.example/video' );
} );
$cases[] = wphx_case( 'embed-defaults:height-capped', 1200, array(), function () {
\treturn wp_embed_defaults( 'https://media.example/video' );
} );
$cases[] = wphx_case( 'embed-defaults:filtered', 320, array( 'embed_defaults' => array( 'width' => 111, 'height' => 222 ) ), function () {
\treturn wp_embed_defaults( 'https://media.example/video' );
} );
$cases[] = wphx_case( 'oembed-object:singleton', null, array(), function () {
\treturn array(
\t\t'same' => _wp_oembed_get_object() === _wp_oembed_get_object(),
\t\t'class' => get_class( _wp_oembed_get_object() ),
\t);
} );
$cases[] = wphx_case( 'oembed-get:default-args', null, array(), function () {
\treturn wp_oembed_get( 'https://media.example/watch/1' );
} );
$cases[] = wphx_case( 'oembed-get:array-args', null, array(), function () {
\treturn wp_oembed_get( 'https://media.example/watch/2', array( 'width' => 320, 'height' => 180, 'discover' => false ) );
} );
$cases[] = wphx_case( 'oembed-get:false-result', null, array(), function () {
\treturn wp_oembed_get( 'https://media.example/missing' );
} );
$cases[] = wphx_case( 'endpoint:base', null, array(), function () {
\treturn get_oembed_endpoint_url();
} );
$cases[] = wphx_case( 'endpoint:json', null, array(), function () {
\treturn get_oembed_endpoint_url( 'https://example.test/post/7/?a=1&b=2' );
} );
$cases[] = wphx_case( 'endpoint:xml', null, array(), function () {
\treturn get_oembed_endpoint_url( 'https://example.test/post/7/?a=1&b=2', 'xml' );
} );
$cases[] = wphx_case( 'endpoint:filtered', null, array( 'oembed_endpoint_url' => 'https://filtered.example/oembed' ), function () {
\treturn get_oembed_endpoint_url( 'https://example.test/post/7/', 'xml' );
} );
$cases[] = wphx_case( 'format:json', null, array(), function () {
\treturn wp_oembed_ensure_format( 'json' );
} );
$cases[] = wphx_case( 'format:xml', null, array(), function () {
\treturn wp_oembed_ensure_format( 'xml' );
} );
$cases[] = wphx_case( 'format:unknown', null, array(), function () {
\treturn wp_oembed_ensure_format( 'yaml' );
} );
$cases[] = wphx_case( 'provider:add-early', null, array(), function () {
\twp_oembed_add_provider( 'https://early.example/*', 'https://provider.example/oembed', true );
\treturn null;
} );
$cases[] = wphx_case( 'provider:remove-early', null, array(), function () {
\twp_oembed_remove_provider( 'https://early.example/*' );
\treturn null;
} );
$cases[] = wphx_case( 'provider:add-loaded', null, array(), function () {
\t$GLOBALS['wphx_did_actions']['plugins_loaded'] = 1;
\twp_oembed_add_provider( 'https://loaded.example/*', 'https://provider.example/loaded', false );
\treturn null;
} );
$cases[] = wphx_case( 'provider:remove-loaded-existing', null, array(), function () {
\t$GLOBALS['wphx_did_actions']['plugins_loaded'] = 1;
\t$oembed = _wp_oembed_get_object();
\t$oembed->providers['https://loaded.example/*'] = array( 'https://provider.example/loaded', false );
\treturn wp_oembed_remove_provider( 'https://loaded.example/*' );
} );
$cases[] = wphx_case( 'provider:remove-loaded-missing', null, array(), function () {
\t$GLOBALS['wphx_did_actions']['plugins_loaded'] = 1;
\treturn wp_oembed_remove_provider( 'https://missing.example/*' );
} );
$cases[] = wphx_case( 'route:register', null, array(), function () {
\treturn wp_oembed_register_route();
} );
$cases[] = wphx_case( 'discovery:default', null, array(), function () {
\treturn wphx_capture( function () {
\t\treturn wp_oembed_add_discovery_links();
\t} );
} );
$cases[] = wphx_case( 'discovery:not-embeddable', null, array(), function () {
\t$GLOBALS['wphx_is_post_embeddable'] = false;
\treturn wphx_capture( function () {
\t\treturn wp_oembed_add_discovery_links();
\t} );
} );
$cases[] = wphx_case( 'discovery:filtered', null, array( 'oembed_discovery_links' => '<link data-filtered="1" />' ), function () {
\treturn wphx_capture( function () {
\t\treturn wp_oembed_add_discovery_links();
\t} );
} );
$cases[] = wphx_case( 'discovery:wp-head-priority-present', null, array(), function () {
\t$GLOBALS['wphx_doing_actions']['wp_head'] = 1;
\t$GLOBALS['wphx_actions']['wp_head']['wp_oembed_add_discovery_links'] = 10;
\treturn wphx_capture( function () {
\t\treturn wp_oembed_add_discovery_links();
\t} );
} );
$cases[] = wphx_case( 'discovery:wp-head-priority-removed', null, array(), function () {
\t$GLOBALS['wphx_doing_actions']['wp_head'] = 1;
\tunset( $GLOBALS['wphx_actions']['wp_head']['wp_oembed_add_discovery_links'] );
\treturn wphx_capture( function () {
\t\treturn wp_oembed_add_discovery_links();
\t} );
} );
$cases[] = wphx_case( 'host-js:deprecated-empty', null, array(), function () {
\treturn wp_oembed_add_host_js();
} );
$cases[] = wphx_case( 'host-js:enqueue', null, array(), function () {
\treturn wp_maybe_enqueue_oembed_host_js( '<blockquote class="wp-embedded-content">Embed</blockquote>' );
} );
$cases[] = wphx_case( 'host-js:no-action', null, array(), function () {
\t$GLOBALS['wphx_actions'] = array();
\treturn wp_maybe_enqueue_oembed_host_js( '<blockquote class="wp-embedded-content">Embed</blockquote>' );
} );
$cases[] = wphx_case( 'host-js:no-match', null, array(), function () {
\treturn wp_maybe_enqueue_oembed_host_js( '<div>No post embed</div>' );
} );
$cases[] = wphx_case( 'excerpt-more:not-embed', null, array(), function () {
\t$GLOBALS['wphx_is_embed'] = false;
\treturn wp_embed_excerpt_more( '[...]' );
} );
$cases[] = wphx_case( 'excerpt-more:embed', null, array(), function () {
\t$GLOBALS['wphx_permalink'] = 'https://example.test/post/7/?a=1&b=2';
\t$GLOBALS['wphx_post_title'] = 'A Post Title';
\treturn wp_embed_excerpt_more( '[...]' );
} );
$cases[] = wphx_case( 'excerpt-embed:default', null, array(), function () {
\t$GLOBALS['wphx_excerpt'] = 'Excerpt body';
\treturn wphx_capture( function () {
\t\treturn the_excerpt_embed();
\t} );
} );
$cases[] = wphx_case( 'excerpt-embed:filtered', null, array( 'the_excerpt_embed' => 'Filtered excerpt' ), function () {
\treturn wphx_capture( function () {
\t\treturn the_excerpt_embed();
\t} );
} );
$cases[] = wphx_case( 'excerpt-attachment:not-attachment', null, array(), function () {
\treturn wp_embed_excerpt_attachment( 'Plain excerpt' );
} );
$cases[] = wphx_case( 'excerpt-attachment:attachment', null, array(), function () {
\t$GLOBALS['wphx_is_attachment'] = true;
\treturn wp_embed_excerpt_attachment( 'Plain excerpt' );
} );
$cases[] = wphx_case( 'enqueue-embed-scripts:action', null, array(), function () {
\treturn enqueue_embed_scripts();
} );
$cases[] = wphx_case( 'site-title:default', null, array(), function () {
\treturn wphx_capture( function () {
\t\treturn the_embed_site_title();
\t} );
} );
$cases[] = wphx_case( 'site-title:filtered', null, array( 'embed_site_title_html' => '<div class="filtered-site-title"></div>' ), function () {
\treturn wphx_capture( function () {
\t\treturn the_embed_site_title();
\t} );
} );
$cases[] = wphx_case( 'pre-oembed:local', null, array(), function () {
\treturn wp_filter_pre_oembed_result( null, 'https://example.test/local-post', array( 'width' => 300 ) );
} );
$cases[] = wphx_case( 'pre-oembed:external-fallback', null, array(), function () {
\treturn wp_filter_pre_oembed_result( '<cached>fallback</cached>', 'https://remote.example/video', array( 'width' => 300 ) );
} );
$cases[] = wphx_case( 'maybe-load:default', null, array(), function () {
\treturn wp_maybe_load_embeds();
} );
$cases[] = wphx_case( 'maybe-load:blocked', null, array( 'load_default_embeds' => false ), function () {
\treturn wp_maybe_load_embeds();
} );
$cases[] = wphx_case( 'maybe-load:filtered-callbacks', null, array(
\t'wp_audio_embed_handler' => 'custom_audio_handler',
\t'wp_video_embed_handler' => 'custom_video_handler',
), function () {
\treturn wp_maybe_load_embeds();
} );
$cases[] = wphx_case( 'youtube:default', null, array(), function () {
\treturn wp_embed_handler_youtube( array( 'full', 'host', 'abc 123' ), array( 'width' => 300 ), 'https://youtube.com/embed/abc%20123', array( 'raw' => true ) );
} );
$cases[] = wphx_case( 'youtube:filtered', null, array( 'wp_embed_handler_youtube' => 'Filtered YouTube' ), function () {
\treturn wp_embed_handler_youtube( array( 'full', 'host', 'abc 123' ), array( 'width' => 300 ), 'https://youtube.com/embed/abc%20123', array( 'raw' => true ) );
} );
$cases[] = wphx_case( 'audio:default', null, array(), function () {
\treturn wp_embed_handler_audio( array( 'match' ), array( 'width' => 300 ), 'https://cdn.example/audio.mp3?a=1&b=2', array() );
} );
$cases[] = wphx_case( 'audio:filtered', null, array( 'wp_embed_handler_audio' => 'Filtered Audio' ), function () {
\treturn wp_embed_handler_audio( array( 'match' ), array( 'width' => 300 ), 'https://cdn.example/audio.mp3', array() );
} );
$cases[] = wphx_case( 'video:default', null, array(), function () {
\treturn wp_embed_handler_video( array( 'match' ), array(), 'https://cdn.example/video.mp4?a=1&b=2', array( 'width' => 640, 'height' => 360 ) );
} );
$cases[] = wphx_case( 'video:no-dimensions', null, array(), function () {
\treturn wp_embed_handler_video( array( 'match' ), array(), 'https://cdn.example/video.mp4', array() );
} );
$cases[] = wphx_case( 'video:filtered', null, array( 'wp_embed_handler_video' => 'Filtered Video' ), function () {
\treturn wp_embed_handler_video( array( 'match' ), array(), 'https://cdn.example/video.mp4', array( 'width' => 640, 'height' => 360 ) );
} );

$reflection = array();
foreach ( array( 'wp_embed_register_handler', 'wp_embed_unregister_handler', 'wp_embed_defaults', 'wp_oembed_get', '_wp_oembed_get_object', 'get_oembed_endpoint_url', 'wp_oembed_ensure_format', 'wp_oembed_add_provider', 'wp_oembed_remove_provider', 'wp_oembed_register_route', 'wp_oembed_add_discovery_links', 'wp_oembed_add_host_js', 'wp_maybe_enqueue_oembed_host_js', 'wp_embed_excerpt_more', 'the_excerpt_embed', 'wp_embed_excerpt_attachment', 'enqueue_embed_scripts', 'the_embed_site_title', 'wp_filter_pre_oembed_result', 'wp_maybe_load_embeds', 'wp_embed_handler_youtube', 'wp_embed_handler_audio', 'wp_embed_handler_video' ) as $function_name ) {
\t$function = new ReflectionFunction( $function_name );
\t$params = array();
\tforeach ( $function->getParameters() as $parameter ) {
\t\t$params[] = array(
\t\t\t'name' => $parameter->getName(),
\t\t\t'position' => $parameter->getPosition(),
\t\t\t'isOptional' => $parameter->isOptional(),
\t\t\t'hasDefault' => $parameter->isDefaultValueAvailable(),
\t\t\t'default' => $parameter->isDefaultValueAvailable() ? $parameter->getDefaultValue() : null,
\t\t\t'hasType' => $parameter->hasType(),
\t\t\t'isPassedByReference' => $parameter->isPassedByReference(),
\t\t\t'isVariadic' => $parameter->isVariadic(),
\t\t);
\t}
\t$reflection[ $function_name ] = array(
\t\t'name' => $function->getName(),
\t\t'numberOfParameters' => $function->getNumberOfParameters(),
\t\t'numberOfRequiredParameters' => $function->getNumberOfRequiredParameters(),
\t\t'returnsReference' => $function->returnsReference(),
\t\t'hasReturnType' => $function->hasReturnType(),
\t\t'parameters' => $params,
\t);
}

echo json_encode(
\tarray(
\t\t'mode' => $mode,
\t\t'cases' => $cases,
\t\t'reflection' => $reflection,
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\\n";
`;
}

function normalizeProbe(result) {
  return {
    cases: result.cases,
    reflection: result.reflection
  };
}

function assertJsonEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected ${label}:\nactual=${JSON.stringify(actual, null, 2)}\nexpected=${JSON.stringify(expected, null, 2)}`);
  }
}

function main() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  mkdirSync(dirname(ORACLE_SHELL), { recursive: true });
  writeFileSync(ORACLE_SHELL, oracleSource());
  writeFileSync(PROBE, probeSource());

  run("haxe", [IMPL_HXML]);
  run("haxe", [SHELL_HXML]);

  const oracleLint = run("php", ["-l", ORACLE_SHELL]).trim();
  const generatedLint = run("php", ["-l", GENERATED_SHELL]).trim();
  const generatedSource = readFileSync(GENERATED_SHELL, "utf8");
  const missingPatterns = EXACT_PATTERNS.filter((pattern) => !generatedSource.includes(pattern));
  if (missingPatterns.length > 0) {
    throw new Error(`Generated embed module shell is missing exact patterns: ${JSON.stringify(missingPatterns)}`);
  }

  const oracle = JSON.parse(run("php", [PROBE, "oracle", ORACLE_SHELL]));
  const generated = JSON.parse(run("php", [PROBE, "generated", GENERATED_SHELL]));
  assertJsonEqual(normalizeProbe(generated), normalizeProbe(oracle), "embed module oracle/candidate probe");

  const emissionManifest = JSON.parse(readFileSync(EMISSION_MANIFEST, "utf8"));
  const declarations = emissionManifest.files.flatMap((file) => file.declarations.map((entry) => `${file.path}:${entry.kind}:${entry.name}`)).sort();
  const expectedDeclarations = [
    "wp-includes/embed.php:global-function:_wp_oembed_get_object",
    "wp-includes/embed.php:global-function:enqueue_embed_scripts",
    "wp-includes/embed.php:global-function:get_oembed_endpoint_url",
    "wp-includes/embed.php:global-function:the_embed_site_title",
    "wp-includes/embed.php:global-function:the_excerpt_embed",
    "wp-includes/embed.php:global-function:wp_embed_defaults",
    "wp-includes/embed.php:global-function:wp_embed_excerpt_attachment",
    "wp-includes/embed.php:global-function:wp_embed_excerpt_more",
    "wp-includes/embed.php:global-function:wp_embed_handler_audio",
    "wp-includes/embed.php:global-function:wp_embed_handler_video",
    "wp-includes/embed.php:global-function:wp_embed_handler_youtube",
    "wp-includes/embed.php:global-function:wp_embed_register_handler",
    "wp-includes/embed.php:global-function:wp_embed_unregister_handler",
    "wp-includes/embed.php:global-function:wp_filter_pre_oembed_result",
    "wp-includes/embed.php:global-function:wp_maybe_enqueue_oembed_host_js",
    "wp-includes/embed.php:global-function:wp_maybe_load_embeds",
    "wp-includes/embed.php:global-function:wp_oembed_add_discovery_links",
    "wp-includes/embed.php:global-function:wp_oembed_add_host_js",
    "wp-includes/embed.php:global-function:wp_oembed_add_provider",
    "wp-includes/embed.php:global-function:wp_oembed_ensure_format",
    "wp-includes/embed.php:global-function:wp_oembed_get",
    "wp-includes/embed.php:global-function:wp_oembed_register_route",
    "wp-includes/embed.php:global-function:wp_oembed_remove_provider"
  ];
  assertJsonEqual(declarations, expectedDeclarations, "embed module declarations");
  if ((emissionManifest.unsupported ?? []).length !== 0) {
    throw new Error(`Unexpected unsupported constructs: ${JSON.stringify(emissionManifest.unsupported)}`);
  }
  const guardedValues = emissionManifest.files.flatMap((file) => file.declarations.map((entry) => entry.guarded));
  if (guardedValues.some(Boolean)) {
    throw new Error(`Embed module functions must be unguarded WordPress module declarations: ${JSON.stringify(guardedValues)}`);
  }

  const manifest = {
    schema: "wphx.wphx-php-embed-module-functions.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "module_function_original_path_adapter",
    artifact_scope: "selected_wphx_312_04_embed_module_functions",
    inputs: [IMPL_HXML, SHELL_HXML, ...SOURCE_FILES].map(inputRecord),
    upstream_oracle: {
      repo_path: "../wordpress-develop/src/wp-includes/embed.php",
      selected_symbols: [
        "wp_embed_register_handler",
        "wp_embed_unregister_handler",
        "wp_embed_defaults",
        "wp_oembed_get",
        "_wp_oembed_get_object",
        "get_oembed_endpoint_url",
        "wp_oembed_ensure_format",
        "wp_oembed_add_provider",
        "wp_oembed_remove_provider",
        "wp_oembed_register_route",
        "wp_oembed_add_discovery_links",
        "wp_oembed_add_host_js",
        "wp_maybe_enqueue_oembed_host_js",
        "wp_embed_excerpt_more",
        "the_excerpt_embed",
        "wp_embed_excerpt_attachment",
        "enqueue_embed_scripts",
        "the_embed_site_title",
        "wp_filter_pre_oembed_result",
        "wp_maybe_load_embeds",
        "wp_embed_handler_youtube",
        "wp_embed_handler_audio",
        "wp_embed_handler_video"
      ],
      selected_source_lines: ["25-29", "40-44", "67-93", "113-117", "126-133", "455-481", "759-765", "147-158", "166-181", "325-329", "337-376", "387", "400-412", "1007-1020", "1028-1043", "1051-1062", "1069-1077", "1232-1256", "1267-1275", "191-232", "242-258", "272-294", "299-321"]
    },
    generated_shell: {
      path: GENERATED_SHELL,
      bytes: statSync(GENERATED_SHELL).size,
      sha256: sha256File(GENERATED_SHELL),
      php_lint: "passed",
      php_lint_output: generatedLint,
      exact_patterns: EXACT_PATTERNS
    },
    oracle_shell: {
      path: ORACLE_SHELL,
      bytes: statSync(ORACLE_SHELL).size,
      sha256: sha256File(ORACLE_SHELL),
      php_lint: "passed",
      php_lint_output: oracleLint
    },
    emission_manifest: {
      path: EMISSION_MANIFEST,
      bytes: statSync(EMISSION_MANIFEST).size,
      sha256: sha256File(EMISSION_MANIFEST),
      declarations,
      unsupported: emissionManifest.unsupported,
      core_ir_features: emissionManifest.core_ir_features,
      segment_plans: emissionManifest.segment_plans,
      adapter_templates: emissionManifest.adapter_templates
    },
    observations: {
      oracle,
      generated,
      match: true
    },
    validation_result: {
      status: "passed",
      php_lint_passed: true,
      exact_contracts_passed: true,
      oracle_candidate_behavior_matched: true,
      reflection_abi_matched: true,
      unsupported_empty: true,
      unguarded_module_functions: true,
      original_path_embed_php: true,
      haxe_bootstrap_delegation: true
    },
    claims: [
      "WPHX PHP emits selected unguarded module-level public functions at original path wp-includes/embed.php.",
      "The generated selected embed helpers preserve reflection-visible parameters/defaults for the selected fixture.",
      "The minimized oracle/candidate probe matches WordPress 7.0 behavior for local handler register/unregister delegation, embed defaults sizing and filters, oEmbed singleton creation, wp_oembed_get() get_html delegation and raw args forwarding, oEmbed endpoint URL construction and filters, oEmbed format normalization, early and post-plugins-loaded provider add/remove registry behavior, oEmbed route controller delegation, discovery link echo output, wp_head priority fallback/removal behavior, deprecated empty host-JS marker behavior, conditional wp-embed script enqueue detection, embed excerpt more-link formatting, excerpt embed echo/filter behavior, attachment excerpt replacement, embed script action dispatch, embed site title echo/filter behavior, pre-oEmbed local data2html delegation and fallback preservation, default handler loading and callback filters, local YouTube autoembed delegation, local audio/video shortcode handler output, video dimensions, URL escaping, and filter payloads."
    ],
    non_claims: [
      "This fixture does not claim full wp-includes/embed.php ownership.",
      "This fixture does not retire the WPHX-312.04 copied feed/embed/HTTPS oracle fixture.",
      "This fixture does not claim WP_Embed, WP_oEmbed, or WP_oEmbed_Controller class method ownership beyond the narrow route registration, get_html/data2html singleton delegation, handler/provider registry, discovery-link helper calls, host-JS enqueue marker, excerpt/site-title helper calls, and autoembed interactions required by selected module functions, remote oEmbed discovery/fetch, REST server dispatch, _oembed_create_xml(), full post embed rendering, installed browser behavior, installed WordPress behavior, or arbitrary module-function lowering beyond the selected original-path embed helpers."
    ]
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const receipt = {
    schema: "wphx.compiler-receipt.v1",
    id: "receipt:wphx-comp-php-embed-module-functions",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "passed",
    evidence_class: "module_function_original_path_adapter",
    artifact_scope: "selected_wphx_312_04_embed_module_functions",
    commands: ["npm run wphx:php:embed-module-functions", "npm run wphx:php:embed-module-functions:check"],
    artifacts: [
      { path: RUNNER, role: "deterministic embed module function adapter runner" },
      { path: SHELL_HXML, role: "WPHX PHP original-path embed module shell hxml" },
      { path: IMPL_HXML, role: "stock Haxe PHP embed helper implementation hxml" },
      { path: "fixtures/wphx-php/src/wphx/fixtures/compiler/php/embed/EmbedModuleSurface.hx", role: "typed Haxe public embed.php module-function shell metadata" },
      { path: "fixtures/wphx-php/src/wphx/fixtures/php/embed/EmbedKernel.hx", role: "typed Haxe embed helper behavior" },
      { path: MANIFEST, role: "embed module function adapter manifest" }
    ],
    manifest_sha256: sha256(manifestText),
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };

  writeOrCheck(MANIFEST, manifestText);
  writeOrCheck(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        status: "passed",
        manifest: MANIFEST,
        receipt: RECEIPT,
        generated_shell: GENERATED_SHELL,
        selected_symbols: manifest.upstream_oracle.selected_symbols
      },
      null,
      2
    )
  );
}

main();
