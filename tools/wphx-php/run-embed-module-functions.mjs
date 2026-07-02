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
const GENERATED_STYLE = `${GENERATED_ROOT}/wp-includes/css/wp-embed-template.css`;
const GENERATED_MIN_STYLE = `${GENERATED_ROOT}/wp-includes/css/wp-embed-template.min.css`;
const GENERATED_SCRIPT = `${GENERATED_ROOT}/wp-includes/js/wp-embed-template.js`;
const GENERATED_MIN_SCRIPT = `${GENERATED_ROOT}/wp-includes/js/wp-embed-template.min.js`;
const GENERATED_HOST_SCRIPT = `${GENERATED_ROOT}/wp-includes/js/wp-embed.js`;
const GENERATED_MIN_HOST_SCRIPT = `${GENERATED_ROOT}/wp-includes/js/wp-embed.min.js`;
const EMISSION_MANIFEST = `${GENERATED_ROOT}/wphx-php-emission.v1.json`;
const ORACLE_SHELL = `${OUT_ROOT}/oracle/wp-includes/embed.php`;
const ORACLE_STYLE = `${OUT_ROOT}/oracle/wp-includes/css/wp-embed-template.css`;
const ORACLE_MIN_STYLE = `${OUT_ROOT}/oracle/wp-includes/css/wp-embed-template.min.css`;
const ORACLE_SCRIPT = `${OUT_ROOT}/oracle/wp-includes/js/wp-embed-template.js`;
const ORACLE_MIN_SCRIPT = `${OUT_ROOT}/oracle/wp-includes/js/wp-embed-template.min.js`;
const ORACLE_HOST_SCRIPT = `${OUT_ROOT}/oracle/wp-includes/js/wp-embed.js`;
const ORACLE_MIN_HOST_SCRIPT = `${OUT_ROOT}/oracle/wp-includes/js/wp-embed.min.js`;
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
  "function get_post_embed_url($post = null)",
  "function get_post_embed_html($width, $height, $post = null)",
  "function get_oembed_response_data($post, $width)",
  "function get_oembed_response_data_rich($data, $post, $width, $height)",
  "function get_oembed_response_data_for_url($url, $args)",
  "function get_oembed_endpoint_url($permalink = '', $format = 'json')",
  "function _oembed_rest_pre_serve_request($served, $result, $request, $server)",
  "function wp_oembed_ensure_format($format)",
  "function _oembed_create_xml($data, $node = null)",
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
  "function wp_enqueue_embed_styles()",
  "function print_embed_scripts()",
  "function the_embed_site_title()",
  "function wp_filter_pre_oembed_result($result, $url, $args)",
  "function _oembed_filter_feed_content($content)",
  "function wp_filter_oembed_iframe_title_attribute($result, $data, $url)",
  "function wp_filter_oembed_result($result, $data, $url)",
  "function print_embed_comments_button()",
  "function print_embed_sharing_button()",
  "function print_embed_sharing_dialog()",
  "function wp_maybe_load_embeds()",
  "function wp_embed_handler_youtube($matches, $attr, $url, $rawattr)",
  "function wp_embed_handler_audio($matches, $attr, $url, $rawattr)",
  "function wp_embed_handler_video($matches, $attr, $url, $rawattr)",
  "EmbedKernel::embedRegisterHandler($id, $regex, $callback, $priority)",
  "EmbedKernel::embedUnregisterHandler($id, $priority)",
  "EmbedKernel::embedDefaults($url)",
  "EmbedKernel::oembedGet($url, $args)",
  "EmbedKernel::oembedGetObject()",
  "EmbedKernel::postEmbedUrl($post)",
  "EmbedKernel::postEmbedHtml($width, $height, $post)",
  "EmbedKernel::oembedResponseData($post, $width)",
  "EmbedKernel::oembedResponseDataRich($data, $post, $width, $height)",
  "EmbedKernel::oembedResponseDataForUrl($url, $args)",
  "EmbedKernel::oembedEndpointUrl($permalink, $format)",
  "EmbedKernel::oembedRestPreServeRequest($served, $result, $request, $server)",
  "EmbedKernel::oembedCreateXml($data, $node)",
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
  "EmbedKernel::enqueueEmbedStyles()",
  "EmbedKernel::printEmbedScripts()",
  "EmbedKernel::embedSiteTitle()",
  "EmbedKernel::filterPreOembedResult($result, $url, $args)",
  "EmbedKernel::oembedFilterFeedContent($content)",
  "EmbedKernel::filterOembedIframeTitleAttribute($result, $data, $url)",
  "EmbedKernel::filterOembedResult($result, $data, $url)",
  "EmbedKernel::printEmbedCommentsButton()",
  "EmbedKernel::printEmbedSharingButton()",
  "EmbedKernel::printEmbedSharingDialog()",
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

function writeEmbedAssetFixtures() {
  const style = "body{background:#fff}.wp-embed{display:block}\n";
  const minStyle = "body{background:#fff}.wp-embed{display:block}\n/* min */\n";
  const script = "window.wpEmbedTemplate = true;\n\n";
  const minScript = "window.wpEmbedTemplate=true;\n";
  const hostScript = "window.wpEmbed = true;\n\n";
  const minHostScript = "window.wpEmbed=true;\n";
  for (const [path, content] of [
    [ORACLE_STYLE, style],
    [GENERATED_STYLE, style],
    [ORACLE_MIN_STYLE, minStyle],
    [GENERATED_MIN_STYLE, minStyle],
    [ORACLE_SCRIPT, script],
    [GENERATED_SCRIPT, script],
    [ORACLE_MIN_SCRIPT, minScript],
    [GENERATED_MIN_SCRIPT, minScript],
    [ORACLE_HOST_SCRIPT, hostScript],
    [GENERATED_HOST_SCRIPT, hostScript],
    [ORACLE_MIN_HOST_SCRIPT, minHostScript],
    [GENERATED_MIN_HOST_SCRIPT, minHostScript]
  ]) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
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

function get_post_embed_url( $post = null ) {
\t$post = get_post( $post );

\tif ( ! $post ) {
\t\treturn false;
\t}

\t$embed_url     = trailingslashit( get_permalink( $post ) ) . user_trailingslashit( 'embed' );
\t$path_conflict = get_page_by_path( str_replace( home_url(), '', $embed_url ), OBJECT, get_post_types( array( 'public' => true ) ) );

\tif ( ! get_option( 'permalink_structure' ) || $path_conflict ) {
\t\t$embed_url = add_query_arg( array( 'embed' => 'true' ), get_permalink( $post ) );
\t}

\treturn sanitize_url( apply_filters( 'post_embed_url', $embed_url, $post ) );
}

function get_post_embed_html( $width, $height, $post = null ) {
\t$post = get_post( $post );

\tif ( ! $post ) {
\t\treturn false;
\t}

\t$embed_url = get_post_embed_url( $post );

\t$secret     = wp_generate_password( 10, false );
\t$embed_url .= "#?secret={$secret}";

\t$output = sprintf(
\t\t'<blockquote class="wp-embedded-content" data-secret="%1$s"><a href="%2$s">%3$s</a></blockquote>',
\t\tesc_attr( $secret ),
\t\tesc_url( get_permalink( $post ) ),
\t\tget_the_title( $post )
\t);

\t$output .= sprintf(
\t\t'<iframe sandbox="allow-scripts" security="restricted" src="%1$s" width="%2$d" height="%3$d" title="%4$s" data-secret="%5$s" frameborder="0" marginwidth="0" marginheight="0" scrolling="no" class="wp-embedded-content"></iframe>',
\t\tesc_url( $embed_url ),
\t\tabsint( $width ),
\t\tabsint( $height ),
\t\tesc_attr(
\t\t\tsprintf(
\t\t\t\t__( '&#8220;%1$s&#8221; &#8212; %2$s' ),
\t\t\t\tget_the_title( $post ),
\t\t\t\tget_bloginfo( 'name' )
\t\t\t)
\t\t),
\t\tesc_attr( $secret )
\t);

\t$js_path = '/js/wp-embed' . wp_scripts_get_suffix() . '.js';
\t$output .= wp_get_inline_script_tag(
\t\ttrim( file_get_contents( ABSPATH . WPINC . $js_path ) ) . "\\n//# sourceURL=" . esc_url_raw( includes_url( $js_path ) )
\t);

\treturn apply_filters( 'embed_html', $output, $post, $width, $height );
}

function get_oembed_response_data( $post, $width ) {
	$post  = get_post( $post );
	$width = absint( $width );

	if ( ! $post ) {
		return false;
	}

	if ( ! is_post_publicly_viewable( $post ) ) {
		return false;
	}

	if ( ! is_post_embeddable( $post ) ) {
		return false;
	}

	$min_max_width = apply_filters(
		'oembed_min_max_width',
		array(
			'min' => 200,
			'max' => 600,
		)
	);

	$width  = min( max( $min_max_width['min'], $width ), $min_max_width['max'] );
	$height = max( (int) ceil( $width / 16 * 9 ), 200 );

	$data = array(
		'version'       => '1.0',
		'provider_name' => get_bloginfo( 'name' ),
		'provider_url'  => get_home_url(),
		'author_name'   => get_bloginfo( 'name' ),
		'author_url'    => get_home_url(),
		'title'         => get_the_title( $post ),
		'type'          => 'link',
	);

	$author = get_userdata( $post->post_author );

	if ( $author ) {
		$data['author_name'] = $author->display_name;
		$data['author_url']  = get_author_posts_url( $author->ID );
	}

	return apply_filters( 'oembed_response_data', $data, $post, $width, $height );
}

function get_oembed_response_data_rich( $data, $post, $width, $height ) {
\t$data['width']  = absint( $width );
\t$data['height'] = absint( $height );
\t$data['type']   = 'rich';
\t$data['html']   = get_post_embed_html( $width, $height, $post );

\t$thumbnail_id = false;

\tif ( has_post_thumbnail( $post->ID ) ) {
\t\t$thumbnail_id = get_post_thumbnail_id( $post->ID );
\t}

\tif ( 'attachment' === get_post_type( $post ) ) {
\t\tif ( wp_attachment_is_image( $post ) ) {
\t\t\t$thumbnail_id = $post->ID;
\t\t} elseif ( wp_attachment_is( 'video', $post ) ) {
\t\t\t$thumbnail_id = get_post_thumbnail_id( $post );
\t\t\t$data['type'] = 'video';
\t\t}
\t}

\tif ( $thumbnail_id ) {
\t\tlist( $thumbnail_url, $thumbnail_width, $thumbnail_height ) = wp_get_attachment_image_src( $thumbnail_id, array( $width, 0 ) );
\t\t$data['thumbnail_url']                                      = $thumbnail_url;
\t\t$data['thumbnail_width']                                    = $thumbnail_width;
\t\t$data['thumbnail_height']                                   = $thumbnail_height;
\t}

\treturn $data;
}

function get_oembed_response_data_for_url( $url, $args ) {
\t$switched_blog = false;

\tif ( is_multisite() ) {
\t\t$url_parts = wp_parse_args(
\t\t\twp_parse_url( $url ),
\t\t\tarray(
\t\t\t\t'host' => '',
\t\t\t\t'port' => null,
\t\t\t\t'path' => '/',
\t\t\t)
\t\t);

\t\t$qv = array(
\t\t\t'domain'                 => $url_parts['host'] . ( $url_parts['port'] ? ':' . $url_parts['port'] : '' ),
\t\t\t'path'                   => '/',
\t\t\t'update_site_meta_cache' => false,
\t\t);

\t\tif ( ! is_subdomain_install() ) {
\t\t\t$path = explode( '/', ltrim( $url_parts['path'], '/' ) );
\t\t\t$path = reset( $path );

\t\t\tif ( $path ) {
\t\t\t\t$qv['path'] = get_network()->path . $path . '/';
\t\t\t}
\t\t}

\t\t$sites = get_sites( $qv );
\t\t$site  = reset( $sites );

\t\tif ( ! empty( $site->deleted ) || ! empty( $site->spam ) || ! empty( $site->archived ) ) {
\t\t\treturn false;
\t\t}

\t\tif ( $site && get_current_blog_id() !== (int) $site->blog_id ) {
\t\t\tswitch_to_blog( $site->blog_id );
\t\t\t$switched_blog = true;
\t\t}
\t}

\t$post_id = url_to_postid( $url );

\t$post_id = apply_filters( 'oembed_request_post_id', $post_id, $url );

\tif ( ! $post_id ) {
\t\tif ( $switched_blog ) {
\t\t\trestore_current_blog();
\t\t}

\t\treturn false;
\t}

\t$width = $args['width'] ?? 0;

\t$data = get_oembed_response_data( $post_id, $width );

\tif ( $switched_blog ) {
\t\trestore_current_blog();
\t}

\treturn $data ? (object) $data : false;
}

function _oembed_rest_pre_serve_request( $served, $result, $request, $server ) {
\t$params = $request->get_params();

\tif ( '/oembed/1.0/embed' !== $request->get_route() || 'GET' !== $request->get_method() ) {
\t\treturn $served;
\t}

\tif ( ! isset( $params['format'] ) || 'xml' !== $params['format'] ) {
\t\treturn $served;
\t}

\t$data = $server->response_to_data( $result, false );

\tif ( ! class_exists( 'SimpleXMLElement' ) ) {
\t\tstatus_header( 501 );
\t\tdie( get_status_header_desc( 501 ) );
\t}

\t$result = _oembed_create_xml( $data );

\tif ( ! $result ) {
\t\tstatus_header( 501 );
\t\tdie( get_status_header_desc( 501 ) );
\t}

\tif ( ! headers_sent() ) {
\t\t$server->send_header( 'Content-Type', 'text/xml; charset=' . get_option( 'blog_charset' ) );
\t}

\techo $result;

\treturn true;
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

function _oembed_create_xml( $data, $node = null ) {
\tif ( ! is_array( $data ) || empty( $data ) ) {
\t\treturn false;
\t}

\tif ( null === $node ) {
\t\t$node = new SimpleXMLElement( '<oembed></oembed>' );
\t}

\tforeach ( $data as $key => $value ) {
\t\tif ( is_numeric( $key ) ) {
\t\t\t$key = 'oembed';
\t\t}

\t\tif ( is_array( $value ) ) {
\t\t\t$item = $node->addChild( $key );
\t\t\t_oembed_create_xml( $value, $item );
\t\t} else {
\t\t\t$node->addChild( $key, esc_html( $value ) );
\t\t}
\t}

\treturn $node->asXML();
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

function wp_enqueue_embed_styles() {
\t// Back-compat for plugins that disable functionality by unhooking this action.
\tif ( ! has_action( 'embed_head', 'print_embed_styles' ) ) {
\t\treturn;
\t}
\tremove_action( 'embed_head', 'print_embed_styles' );

\t$suffix = wp_scripts_get_suffix();
\t$handle = 'wp-embed-template';
\twp_register_style( $handle, false );
\twp_add_inline_style( $handle, file_get_contents( ABSPATH . WPINC . "/css/wp-embed-template$suffix.css" ) );
\twp_enqueue_style( $handle );
}

function print_embed_scripts() {
\t$js_path = '/js/wp-embed-template' . wp_scripts_get_suffix() . '.js';
\twp_print_inline_script_tag(
\t\ttrim( file_get_contents( ABSPATH . WPINC . $js_path ) ) . "\\n//# sourceURL=" . esc_url_raw( includes_url( $js_path ) )
\t);
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

function _oembed_filter_feed_content( $content ) {
\t$p = new WP_HTML_Tag_Processor( $content );
\twhile ( $p->next_tag( array( 'tag_name' => 'iframe' ) ) ) {
\t\tif ( $p->has_class( 'wp-embedded-content' ) ) {
\t\t\t$p->remove_attribute( 'style' );
\t\t}
\t}
\treturn $p->get_updated_html();
}

function wp_filter_oembed_iframe_title_attribute( $result, $data, $url ) {
\tif ( false === $result || ! in_array( $data->type, array( 'rich', 'video' ), true ) ) {
\t\treturn $result;
\t}

\t$title = ! empty( $data->title ) ? $data->title : '';

\t$pattern = '\`<iframe([^>]*)>\`i';
\tif ( preg_match( $pattern, $result, $matches ) ) {
\t\t$attrs = wp_kses_hair( $matches[1], wp_allowed_protocols() );

\t\tforeach ( $attrs as $attr => $item ) {
\t\t\t$lower_attr = strtolower( $attr );
\t\t\tif ( $lower_attr === $attr ) {
\t\t\t\tcontinue;
\t\t\t}
\t\t\tif ( ! isset( $attrs[ $lower_attr ] ) ) {
\t\t\t\t$attrs[ $lower_attr ] = $item;
\t\t\t\tunset( $attrs[ $attr ] );
\t\t\t}
\t\t}
\t}

\tif ( ! empty( $attrs['title']['value'] ) ) {
\t\t$title = $attrs['title']['value'];
\t}

\t$title = apply_filters( 'oembed_iframe_title_attribute', $title, $result, $data, $url );

\tif ( '' === $title ) {
\t\treturn $result;
\t}

\tif ( isset( $attrs['title'] ) ) {
\t\tunset( $attrs['title'] );
\t\t$attr_string = implode( ' ', wp_list_pluck( $attrs, 'whole' ) );
\t\t$result      = str_replace( $matches[0], '<iframe ' . trim( $attr_string ) . '>', $result );
\t}
\treturn str_ireplace( '<iframe ', sprintf( '<iframe title="%s" ', esc_attr( $title ) ), $result );
}

function wp_filter_oembed_result( $result, $data, $url ) {
\tif ( false === $result || ! in_array( $data->type, array( 'rich', 'video' ), true ) ) {
\t\treturn $result;
\t}

\t$wp_oembed = _wp_oembed_get_object();

\t// Don't modify the HTML for trusted providers.
\tif ( false !== $wp_oembed->get_provider( $url, array( 'discover' => false ) ) ) {
\t\treturn $result;
\t}

\t$allowed_html = array(
\t\t'a'          => array(
\t\t\t'href' => true,
\t\t),
\t\t'blockquote' => array(),
\t\t'iframe'     => array(
\t\t\t'src'          => true,
\t\t\t'width'        => true,
\t\t\t'height'       => true,
\t\t\t'frameborder'  => true,
\t\t\t'marginwidth'  => true,
\t\t\t'marginheight' => true,
\t\t\t'scrolling'    => true,
\t\t\t'title'        => true,
\t\t),
\t);

\t$html = wp_kses( $result, $allowed_html );

\tpreg_match( '|(<blockquote>.*?</blockquote>)?.*(<iframe.*?></iframe>)|ms', $html, $content );
\t// We require at least the iframe to exist.
\tif ( empty( $content[2] ) ) {
\t\treturn false;
\t}
\t$html = $content[1] . $content[2];

\tpreg_match( '/ src=([\\'"])(.*?)\\1/', $html, $results );

\tif ( ! empty( $results ) ) {
\t\t$secret = wp_generate_password( 10, false );

\t\t$url = esc_url( "{$results[2]}#?secret=$secret" );
\t\t$q   = $results[1];

\t\t$html = str_replace( $results[0], ' src=' . $q . $url . $q . ' data-secret=' . $q . $secret . $q, $html );
\t\t$html = str_replace( '<blockquote', "<blockquote data-secret=\\\"$secret\\\"", $html );
\t}

\t$allowed_html['blockquote']['data-secret'] = true;
\t$allowed_html['iframe']['data-secret']     = true;

\t$html = wp_kses( $html, $allowed_html );

\tif ( ! empty( $content[1] ) ) {
\t\t// We have a blockquote to fall back on. Hide the iframe by default.
\t\t$html = str_replace( '<iframe', '<iframe style="position: absolute; visibility: hidden;"', $html );
\t\t$html = str_replace( '<blockquote', '<blockquote class="wp-embedded-content"', $html );
\t}

\t$html = str_ireplace( '<iframe', '<iframe class="wp-embedded-content" sandbox="allow-scripts" security="restricted"', $html );

\treturn $html;
}

function print_embed_comments_button() {
\tif ( is_404() || ! ( get_comments_number() || comments_open() ) ) {
\t\treturn;
\t}
\t?>
\t<div class="wp-embed-comments">
\t\t<a href="<?php comments_link(); ?>" target="_top">
\t\t\t<span class="dashicons dashicons-admin-comments"></span>
\t\t\t<?php
\t\t\tprintf(
\t\t\t\t/* translators: %s: Number of comments. */
\t\t\t\t_n(
\t\t\t\t\t'%s <span class="screen-reader-text">Comment</span>',
\t\t\t\t\t'%s <span class="screen-reader-text">Comments</span>',
\t\t\t\t\tget_comments_number()
\t\t\t\t),
\t\t\t\tnumber_format_i18n( get_comments_number() )
\t\t\t);
\t\t\t?>
\t\t</a>
\t</div>
\t<?php
}

function print_embed_sharing_button() {
\tif ( is_404() ) {
\t\treturn;
\t}
\t?>
\t<div class="wp-embed-share">
\t\t<button type="button" class="wp-embed-share-dialog-open" aria-label="<?php esc_attr_e( 'Open sharing dialog' ); ?>">
\t\t\t<span class="dashicons dashicons-share"></span>
\t\t</button>
\t</div>
\t<?php
}

function print_embed_sharing_dialog() {
\tif ( is_404() ) {
\t\treturn;
\t}

\t$unique_suffix            = get_the_ID() . '-' . wp_rand();
\t$share_tab_wordpress_id   = 'wp-embed-share-tab-wordpress-' . $unique_suffix;
\t$share_tab_html_id        = 'wp-embed-share-tab-html-' . $unique_suffix;
\t$description_wordpress_id = 'wp-embed-share-description-wordpress-' . $unique_suffix;
\t$description_html_id      = 'wp-embed-share-description-html-' . $unique_suffix;
\t?>
\t<div class="wp-embed-share-dialog hidden" role="dialog" aria-label="<?php esc_attr_e( 'Sharing options' ); ?>">
\t\t<div class="wp-embed-share-dialog-content">
\t\t\t<div class="wp-embed-share-dialog-text">
\t\t\t\t<ul class="wp-embed-share-tabs" role="tablist">
\t\t\t\t\t<li class="wp-embed-share-tab-button wp-embed-share-tab-button-wordpress" role="presentation">
\t\t\t\t\t\t<button type="button" role="tab" aria-controls="<?php echo $share_tab_wordpress_id; ?>" aria-selected="true" tabindex="0"><?php esc_html_e( 'WordPress Embed' ); ?></button>
\t\t\t\t\t</li>
\t\t\t\t\t<li class="wp-embed-share-tab-button wp-embed-share-tab-button-html" role="presentation">
\t\t\t\t\t\t<button type="button" role="tab" aria-controls="<?php echo $share_tab_html_id; ?>" aria-selected="false" tabindex="-1"><?php esc_html_e( 'HTML Embed' ); ?></button>
\t\t\t\t\t</li>
\t\t\t\t</ul>
\t\t\t\t<div id="<?php echo $share_tab_wordpress_id; ?>" class="wp-embed-share-tab" role="tabpanel" aria-hidden="false">
\t\t\t\t\t<input type="text" value="<?php the_permalink(); ?>" class="wp-embed-share-input" aria-label="<?php esc_attr_e( 'URL' ); ?>" aria-describedby="<?php echo $description_wordpress_id; ?>" tabindex="0" readonly/>

\t\t\t\t\t<p class="wp-embed-share-description" id="<?php echo $description_wordpress_id; ?>">
\t\t\t\t\t\t<?php _e( 'Copy and paste this URL into your WordPress site to embed' ); ?>
\t\t\t\t\t</p>
\t\t\t\t</div>
\t\t\t\t<div id="<?php echo $share_tab_html_id; ?>" class="wp-embed-share-tab" role="tabpanel" aria-hidden="true">
\t\t\t\t\t<textarea class="wp-embed-share-input" aria-label="<?php esc_attr_e( 'HTML' ); ?>" aria-describedby="<?php echo $description_html_id; ?>" tabindex="0" readonly><?php echo esc_textarea( get_post_embed_html( 600, 400 ) ); ?></textarea>

\t\t\t\t\t<p class="wp-embed-share-description" id="<?php echo $description_html_id; ?>">
\t\t\t\t\t\t<?php _e( 'Copy and paste this code into your site to embed' ); ?>
\t\t\t\t\t</p>
\t\t\t\t</div>
\t\t\t</div>

\t\t\t<button type="button" class="wp-embed-share-dialog-close" aria-label="<?php esc_attr_e( 'Close sharing dialog' ); ?>">
\t\t\t\t<span class="dashicons dashicons-no"></span>
\t\t\t</button>
\t\t</div>
\t</div>
\t<?php
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
if ( ! defined( 'OBJECT' ) ) {
\tdefine( 'OBJECT', 'OBJECT' );
}
if ( ! defined( 'ABSPATH' ) ) {
\tdefine( 'ABSPATH', dirname( $shell, 2 ) . '/' );
}
if ( ! defined( 'WPINC' ) ) {
\tdefine( 'WPINC', 'wp-includes' );
}

function wphx_embed_truthy( $value ) {
\treturn (bool) $value;
}

function wphx_embed_array_set( &$array, $key, $value ) {
\t$array[ $key ] = $value;
}

function wphx_embed_array_unset( &$array, $key ) {
\tunset( $array[ $key ] );
}

function wphx_embed_object_field( $object, $field ) {
\treturn $object->{$field} ?? null;
}

function wphx_embed_echo( $value ) {
\techo $value;
}

function wphx_embed_preg_match( $pattern, $subject ) {
\t$matches = array();
\tpreg_match( $pattern, $subject, $matches );
\treturn $matches;
}

function wp_allowed_protocols() {
\treturn array( 'http', 'https' );
}

function wp_kses_hair( $attr, $allowed_protocols ) {
\t$attrs = array();
\tif ( preg_match_all( '/([A-Za-z_:][-A-Za-z0-9_:.]*)\\s*=\\s*([\\\"\\'])(.*?)\\2/', $attr, $matches, PREG_SET_ORDER ) ) {
\t\tforeach ( $matches as $match ) {
\t\t\t$attrs[ $match[1] ] = array(
\t\t\t\t'name'  => $match[1],
\t\t\t\t'value' => $match[3],
\t\t\t\t'whole' => $match[0],
\t\t\t);
\t\t}
\t}
\treturn $attrs;
}

function wp_kses( $html, $allowed_html ) {
\treturn preg_replace_callback(
\t\t'/<\\/?([A-Za-z0-9]+)([^>]*)>/',
\t\tfunction ( $match ) use ( $allowed_html ) {
\t\t\t$tag = strtolower( $match[1] );
\t\t\tif ( ! array_key_exists( $tag, $allowed_html ) ) {
\t\t\t\treturn '';
\t\t\t}
\t\t\tif ( str_starts_with( $match[0], '</' ) ) {
\t\t\t\treturn '</' . $tag . '>';
\t\t\t}
\t\t\t$attrs = array();
\t\t\tif ( preg_match_all( '/\\s+([A-Za-z_:][-A-Za-z0-9_:.]*)=([\\\"\\'])(.*?)\\2/', $match[2], $attr_matches, PREG_SET_ORDER ) ) {
\t\t\t\tforeach ( $attr_matches as $attr_match ) {
\t\t\t\t\t$attr_name = strtolower( $attr_match[1] );
\t\t\t\t\tif ( ! empty( $allowed_html[ $tag ][ $attr_name ] ) ) {
\t\t\t\t\t\t$attrs[] = ' ' . $attr_name . '=' . $attr_match[2] . $attr_match[3] . $attr_match[2];
\t\t\t\t\t}
\t\t\t\t}
\t\t\t}
\t\t\treturn '<' . $tag . implode( '', $attrs ) . '>';
\t\t},
\t\t(string) $html
\t);
}

function wp_list_pluck( $input_list, $field ) {
\t$output = array();
\tforeach ( $input_list as $item ) {
\t\tif ( is_array( $item ) && array_key_exists( $field, $item ) ) {
\t\t\t$output[] = $item[ $field ];
\t\t} elseif ( is_object( $item ) && isset( $item->{$field} ) ) {
\t\t\t$output[] = $item->{$field};
\t\t}
\t}
\treturn $output;
}

function wp_generate_password( $length = 12, $special_chars = true, $extra_special_chars = false ) {
\treturn substr( str_repeat( 'secret', 3 ), 0, $length );
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

\tpublic function get_provider( $url, $args = '' ) {
\t\t$this->calls[] = array(
\t\t\t'action' => 'get_provider',
\t\t\t'url' => $url,
\t\t\t'args' => $args,
\t\t);
\t\treturn $GLOBALS['wphx_trusted_oembed_provider'] ?? false;
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

function is_post_embeddable( $post = null ) {
\treturn $GLOBALS['wphx_is_post_embeddable'];
}

function is_embed() {
\treturn $GLOBALS['wphx_is_embed'];
}

function is_attachment() {
\treturn $GLOBALS['wphx_is_attachment'];
}

function is_404() {
\treturn $GLOBALS['wphx_is_404'];
}

function get_comments_number( $post = 0 ) {
\treturn $GLOBALS['wphx_comments_number'];
}

function comments_open( $post = null ) {
\treturn $GLOBALS['wphx_comments_open'];
}

function get_comments_link( $post = 0 ) {
\treturn $GLOBALS['wphx_comments_link'];
}

function comments_link( $deprecated = '', $deprecated_2 = '' ) {
\techo esc_url( get_comments_link() );
}

function _x( $text, $context ) {
\treturn $text;
}

function __( $text ) {
\treturn $text;
}

function _e( $text ) {
\techo __( $text );
}

function _n( $single, $plural, $number ) {
\treturn 1 === (int) $number ? $single : $plural;
}

function number_format_i18n( $number ) {
\treturn number_format( (int) $number );
}

function get_post( $post = null ) {
\tif ( 'missing' === $post ) {
\t\treturn false;
\t}
\tif ( null === $post ) {
\t\treturn $GLOBALS['wphx_post'];
\t}
\tif ( is_object( $post ) ) {
\t\treturn $post;
\t}
\treturn $GLOBALS['wphx_posts'][ $post ] ?? false;
}

function get_permalink( $post = null ) {
\treturn $GLOBALS['wphx_permalink'];
}

function the_permalink( $post = null ) {
\techo esc_url( get_permalink( $post ) );
}

function home_url() {
\treturn 'https://example.test';
}

function get_home_url() {
\treturn home_url();
}

function trailingslashit( $value ) {
\treturn rtrim( (string) $value, '/' ) . '/';
}

function user_trailingslashit( $value ) {
\treturn rtrim( (string) $value, '/' ) . '/';
}

function get_page_by_path( $path, $output = OBJECT, $post_types = null ) {
\t$GLOBALS['wphx_page_path_log'][] = array(
\t\t'path' => $path,
\t\t'output' => $output,
\t\t'post_types' => $post_types,
\t);
\treturn $GLOBALS['wphx_path_conflicts'][ $path ] ?? false;
}

function get_post_types( $args = array() ) {
\t$GLOBALS['wphx_post_type_queries'][] = $args;
\treturn array( 'post', 'page' );
}

function get_option( $name ) {
\treturn $GLOBALS['wphx_options'][ $name ] ?? false;
}

function sanitize_url( $url ) {
\treturn str_replace( ' ', '%20', (string) $url );
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

function get_the_title( $post = null ) {
\treturn $GLOBALS['wphx_post_title'];
}

function is_post_publicly_viewable( $post = null ) {
\treturn $GLOBALS['wphx_is_post_publicly_viewable'];
}

function get_userdata( $user_id ) {
\treturn $GLOBALS['wphx_users'][ $user_id ] ?? false;
}

function get_author_posts_url( $user_id ) {
\treturn 'https://example.test/author/' . $user_id . '/';
}

function has_post_thumbnail( $post_id = null ) {
\treturn $GLOBALS['wphx_has_post_thumbnail'];
}

function get_post_thumbnail_id( $post = null ) {
\t$GLOBALS['wphx_thumbnail_id_log'][] = $post;
\treturn $GLOBALS['wphx_post_thumbnail_id'];
}

function get_post_type( $post = null ) {
\treturn $GLOBALS['wphx_post_type'];
}

function wp_attachment_is_image( $post = null ) {
\treturn $GLOBALS['wphx_attachment_is_image'];
}

function wp_attachment_is( $type, $post = null ) {
\treturn 'video' === $type && $GLOBALS['wphx_attachment_is_video'];
}

function wp_get_attachment_image_src( $attachment_id, $size = 'thumbnail' ) {
\t$GLOBALS['wphx_attachment_image_src_log'][] = array(
\t\t'id' => $attachment_id,
\t\t'size' => $size,
\t);
\treturn $GLOBALS['wphx_attachment_image_src'];
}

function get_the_ID() {
\treturn $GLOBALS['wphx_post']->ID;
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

function wp_scripts_get_suffix() {
\treturn $GLOBALS['wphx_scripts_suffix'];
}

function wp_register_style( $handle, $src = false ) {
\t$GLOBALS['wphx_style_log'][] = array(
\t\t'action' => 'register',
\t\t'handle' => $handle,
\t\t'src' => $src,
\t);
}

function wp_add_inline_style( $handle, $data ) {
\t$GLOBALS['wphx_style_log'][] = array(
\t\t'action' => 'inline',
\t\t'handle' => $handle,
\t\t'data' => $data,
\t);
}

function wp_enqueue_style( $handle ) {
\t$GLOBALS['wphx_style_log'][] = array(
\t\t'action' => 'enqueue',
\t\t'handle' => $handle,
\t);
}

function wp_print_inline_script_tag( $javascript ) {
\techo '<script>' . $javascript . '</script>';
}

function wp_get_inline_script_tag( $javascript ) {
\treturn '<script>' . $javascript . '</script>';
}

function esc_html( $value ) {
\treturn htmlspecialchars( (string) $value, ENT_QUOTES, 'UTF-8' );
}

function esc_html_e( $text ) {
\techo esc_html( $text );
}

function esc_attr( $value ) {
\treturn htmlspecialchars( (string) $value, ENT_QUOTES, 'UTF-8' );
}

function esc_attr_e( $text ) {
\techo esc_attr( $text );
}

function esc_textarea( $value ) {
\treturn htmlspecialchars( (string) $value, ENT_NOQUOTES, 'UTF-8' );
}

function wp_rand( $min = null, $max = null ) {
\treturn 314;
}

function absint( $maybeint ) {
\treturn abs( (int) $maybeint );
}

function is_multisite() {
\treturn $GLOBALS['wphx_is_multisite'];
}

function wp_parse_url( $url ) {
\t$parts = parse_url( $url );
\treturn false === $parts ? array() : $parts;
}

function wp_parse_args( $args, $defaults = array() ) {
\treturn array_merge( $defaults, is_array( $args ) ? $args : array() );
}

function is_subdomain_install() {
\treturn $GLOBALS['wphx_is_subdomain_install'];
}

function get_network() {
\treturn (object) array( 'path' => $GLOBALS['wphx_network_path'] );
}

function get_sites( $query = array() ) {
\t$GLOBALS['wphx_get_sites_log'][] = $query;
\treturn $GLOBALS['wphx_sites'];
}

function get_current_blog_id() {
\treturn $GLOBALS['wphx_current_blog_id'];
}

function switch_to_blog( $blog_id ) {
\t$GLOBALS['wphx_switch_log'][] = array( 'action' => 'switch', 'blog_id' => (int) $blog_id );
\t$GLOBALS['wphx_current_blog_id'] = (int) $blog_id;
}

function restore_current_blog() {
\t$GLOBALS['wphx_switch_log'][] = array( 'action' => 'restore' );
\t$GLOBALS['wphx_current_blog_id'] = $GLOBALS['wphx_original_blog_id'];
}

function url_to_postid( $url ) {
\t$GLOBALS['wphx_url_to_postid_log'][] = $url;
\treturn $GLOBALS['wphx_url_to_postid'][ $url ] ?? false;
}

class WP_HTML_Tag_Processor {
\tprivate $html;
\tprivate $offset = 0;
\tprivate $current_start = null;
\tprivate $current_end = null;
\tprivate $current_tag = '';

\tpublic function __construct( $html ) {
\t\t$this->html = $html;
\t}

\tpublic function next_tag( $query = array() ) {
\t\t$tag_name = strtolower( $query['tag_name'] ?? '' );
\t\tif ( 'iframe' !== $tag_name ) {
\t\t\treturn false;
\t\t}
\t\tif ( ! preg_match( '/<iframe\\b[^>]*>/i', $this->html, $matches, PREG_OFFSET_CAPTURE, $this->offset ) ) {
\t\t\treturn false;
\t\t}
\t\t$this->current_tag = $matches[0][0];
\t\t$this->current_start = $matches[0][1];
\t\t$this->current_end = $this->current_start + strlen( $this->current_tag );
\t\t$this->offset = $this->current_end;
\t\treturn true;
\t}

\tpublic function has_class( $class_name ) {
\t\t$classes = null;
\t\tif ( preg_match( '/\\sclass="([^"]*)"/i', $this->current_tag, $matches ) ) {
\t\t\t$classes = $matches[1];
\t\t} elseif ( preg_match( "/\\sclass='([^']*)'/i", $this->current_tag, $matches ) ) {
\t\t\t$classes = $matches[1];
\t\t}
\t\tif ( null === $classes ) {
\t\t\treturn false;
\t\t}
\t\treturn in_array( $class_name, preg_split( '/\\s+/', trim( $classes ) ), true );
\t}

\tpublic function remove_attribute( $attribute_name ) {
\t\t$updated_tag = $this->current_tag;
\t\tif ( 'style' === strtolower( $attribute_name ) ) {
\t\t\t$updated_tag = preg_replace( '/\\sstyle="[^"]*"/i', '', $updated_tag, 1 );
\t\t\t$updated_tag = preg_replace( "/\\sstyle='[^']*'/i", '', $updated_tag, 1 );
\t\t}
\t\t$this->html = substr( $this->html, 0, $this->current_start ) . $updated_tag . substr( $this->html, $this->current_end );
\t\t$delta = strlen( $updated_tag ) - strlen( $this->current_tag );
\t\t$this->current_tag = $updated_tag;
\t\t$this->current_end += $delta;
\t\t$this->offset += $delta;
\t}

\tpublic function get_updated_html() {
\t\treturn $this->html;
\t}
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

class WpRestRequest {
\tprivate $params;
\tprivate $route;
\tprivate $method;

\tpublic function __construct( $route, $method, $params = array() ) {
\t\t$this->route = $route;
\t\t$this->method = $method;
\t\t$this->params = $params;
\t}

\tpublic function get_params() {
\t\treturn $this->params;
\t}

\tpublic function get_route() {
\t\treturn $this->route;
\t}

\tpublic function get_method() {
\t\treturn $this->method;
\t}
}

class WpRestServer {
\tpublic $calls = array();
\tpublic $headers = array();

\tpublic function response_to_data( $result, $embed ) {
\t\t$this->calls[] = array(
\t\t\t'action' => 'response_to_data',
\t\t\t'result' => $result,
\t\t\t'embed' => $embed,
\t\t);
\t\treturn $result;
\t}

\tpublic function send_header( $key, $value ) {
\t\t$this->headers[] = array(
\t\t\t'key' => $key,
\t\t\t'value' => $value,
\t\t);
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

function esc_url_raw( $url ) {
\treturn (string) $url;
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
\t$GLOBALS['wphx_style_log'] = array();
\t$GLOBALS['wphx_scripts_suffix'] = '';
\t$GLOBALS['wphx_did_actions'] = array();
\t$GLOBALS['wphx_doing_actions'] = array();
\t$GLOBALS['wphx_actions'] = array(
\t\t'wp_head'    => array( 'wp_oembed_add_host_js' => 10 ),
\t\t'embed_head' => array( 'print_embed_styles' => 10 ),
\t);
\t$GLOBALS['wphx_removed_actions'] = array();
\t$GLOBALS['wphx_enqueued_scripts'] = array();
\t$GLOBALS['wphx_trusted_oembed_provider'] = false;
\t$GLOBALS['wphx_route_log'] = array();
\t$GLOBALS['wphx_page_path_log'] = array();
\t$GLOBALS['wphx_post_type_queries'] = array();
\t$GLOBALS['wphx_path_conflicts'] = array();
\t$GLOBALS['wphx_options'] = array( 'permalink_structure' => '/%postname%/', 'blog_charset' => 'UTF-8' );
\t$GLOBALS['wphx_is_multisite'] = false;
\t$GLOBALS['wphx_is_subdomain_install'] = false;
\t$GLOBALS['wphx_network_path'] = '/network/';
\t$GLOBALS['wphx_original_blog_id'] = 1;
\t$GLOBALS['wphx_current_blog_id'] = 1;
\t$GLOBALS['wphx_sites'] = array();
\t$GLOBALS['wphx_get_sites_log'] = array();
\t$GLOBALS['wphx_switch_log'] = array();
\t$GLOBALS['wphx_url_to_postid_log'] = array();
\t$GLOBALS['wphx_url_to_postid'] = array(
\t\t'https://example.test/local-post' => 7,
\t\t'https://example.test/post/7/' => 7,
\t);
\t$GLOBALS['wphx_attachment_image_src_log'] = array();
\t$GLOBALS['wphx_thumbnail_id_log'] = array();
\t$GLOBALS['wphx_has_post_thumbnail'] = false;
\t$GLOBALS['wphx_post_thumbnail_id'] = 45;
\t$GLOBALS['wphx_post_type'] = 'post';
\t$GLOBALS['wphx_attachment_is_image'] = false;
\t$GLOBALS['wphx_attachment_is_video'] = false;
\t$GLOBALS['wphx_attachment_image_src'] = array( 'https://cdn.example/thumb.jpg', 480, 270 );
\t$GLOBALS['wphx_is_singular'] = true;
\t$GLOBALS['wphx_is_post_publicly_viewable'] = true;
\t$GLOBALS['wphx_is_post_embeddable'] = true;
\t$GLOBALS['wphx_is_embed'] = true;
\t$GLOBALS['wphx_is_attachment'] = false;
\t$GLOBALS['wphx_is_404'] = false;
\t$GLOBALS['wphx_comments_number'] = 2;
\t$GLOBALS['wphx_comments_open'] = true;
\t$GLOBALS['wphx_comments_link'] = 'https://example.test/post/7/#comments';
\t$GLOBALS['wphx_permalink'] = 'https://example.test/post/7/';
\t$GLOBALS['wphx_post'] = (object) array( 'ID' => 7, 'post_name' => 'post-7', 'post_author' => 12 );
\t$GLOBALS['wphx_posts'] = array( 7 => $GLOBALS['wphx_post'] );
\t$GLOBALS['wphx_users'] = array( 12 => (object) array( 'ID' => 12, 'display_name' => 'Post Author' ) );
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
\t\t'styles' => $GLOBALS['wphx_style_log'],
\t\t'page_paths' => $GLOBALS['wphx_page_path_log'],
\t\t'post_type_queries' => $GLOBALS['wphx_post_type_queries'],
\t\t'get_sites' => $GLOBALS['wphx_get_sites_log'],
\t\t'switches' => $GLOBALS['wphx_switch_log'],
\t\t'url_to_postid' => $GLOBALS['wphx_url_to_postid_log'],
\t\t'thumbnail_ids' => $GLOBALS['wphx_thumbnail_id_log'],
\t\t'attachment_image_src' => $GLOBALS['wphx_attachment_image_src_log'],
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
$cases[] = wphx_case( 'post-embed-url:missing-post', null, array(), function () {
\treturn get_post_embed_url( 'missing' );
} );
$cases[] = wphx_case( 'post-embed-url:pretty', null, array(), function () {
\treturn get_post_embed_url();
} );
$cases[] = wphx_case( 'post-embed-url:no-permalink-structure', null, array(), function () {
\t$GLOBALS['wphx_options']['permalink_structure'] = '';
\treturn get_post_embed_url( 7 );
} );
$cases[] = wphx_case( 'post-embed-url:path-conflict', null, array(), function () {
\t$GLOBALS['wphx_path_conflicts']['/post/7/embed/'] = (object) array( 'ID' => 99 );
\treturn get_post_embed_url( 7 );
} );
$cases[] = wphx_case( 'post-embed-url:filtered-sanitized', null, array( 'post_embed_url' => 'https://filtered.example/embed url' ), function () {
\treturn get_post_embed_url( 7 );
} );
$cases[] = wphx_case( 'post-embed-html:missing-post', null, array(), function () {
\treturn get_post_embed_html( 600, 400, 'missing' );
} );
$cases[] = wphx_case( 'post-embed-html:default', null, array(), function () {
\t$GLOBALS['wphx_permalink'] = 'https://example.test/post/7/?a=1&b=2';
\t$GLOBALS['wphx_post_title'] = 'Embed <Title>';
\treturn get_post_embed_html( 600, 400, 7 );
} );
$cases[] = wphx_case( 'post-embed-html:suffix-min', null, array(), function () {
\t$GLOBALS['wphx_scripts_suffix'] = '.min';
\treturn get_post_embed_html( 600, 400, 7 );
} );
$cases[] = wphx_case( 'post-embed-html:filtered', null, array( 'embed_html' => 'Filtered embed html' ), function () {
\treturn get_post_embed_html( 600, 400, 7 );
} );
$cases[] = wphx_case( 'oembed-response-data:missing-post', null, array(), function () {
\treturn get_oembed_response_data( 'missing', 600 );
} );
$cases[] = wphx_case( 'oembed-response-data:not-public', null, array(), function () {
\t$GLOBALS['wphx_is_post_publicly_viewable'] = false;
\treturn get_oembed_response_data( 7, 600 );
} );
$cases[] = wphx_case( 'oembed-response-data:not-embeddable', null, array(), function () {
\t$GLOBALS['wphx_is_post_embeddable'] = false;
\treturn get_oembed_response_data( 7, 600 );
} );
$cases[] = wphx_case( 'oembed-response-data:default-author', null, array(), function () {
\treturn get_oembed_response_data( 7, 120 );
} );
$cases[] = wphx_case( 'oembed-response-data:no-author-max-clamp', null, array(), function () {
\t$GLOBALS['wphx_users'] = array();
\treturn get_oembed_response_data( 7, 900 );
} );
$cases[] = wphx_case( 'oembed-response-data:filtered-width-policy', null, array( 'oembed_min_max_width' => array( 'min' => 320, 'max' => 480 ) ), function () {
\treturn get_oembed_response_data( 7, 100 );
} );
$cases[] = wphx_case(
\t'oembed-response-data:filtered-data',
\tnull,
\tarray(
\t\t'oembed_response_data' => function ( $data, $post, $width, $height ) {
\t\t\t$data['filtered'] = $post->ID . ':' . $width . ':' . $height;
\t\t\treturn $data;
\t\t},
\t),
\tfunction () {
\t\treturn get_oembed_response_data( 7, 600 );
\t}
);
$cases[] = wphx_case( 'oembed-response-data-rich:no-thumbnail', null, array(), function () {
\treturn get_oembed_response_data_rich( array( 'version' => '1.0', 'title' => 'Base' ), $GLOBALS['wphx_post'], 600, 338 );
} );
$cases[] = wphx_case( 'oembed-response-data-rich:post-thumbnail', null, array(), function () {
\t$GLOBALS['wphx_has_post_thumbnail'] = true;
\t$GLOBALS['wphx_post_thumbnail_id'] = 45;
\t$GLOBALS['wphx_attachment_image_src'] = array( 'https://cdn.example/post-thumb.jpg', 600, 338 );
\treturn get_oembed_response_data_rich( array( 'version' => '1.0', 'title' => 'Base' ), $GLOBALS['wphx_post'], 600, 338 );
} );
$cases[] = wphx_case( 'oembed-response-data-rich:image-attachment', null, array(), function () {
\t$GLOBALS['wphx_post_type'] = 'attachment';
\t$GLOBALS['wphx_attachment_is_image'] = true;
\t$GLOBALS['wphx_attachment_image_src'] = array( 'https://cdn.example/image-attachment.jpg', 640, 360 );
\treturn get_oembed_response_data_rich( array( 'version' => '1.0', 'title' => 'Image Attachment' ), $GLOBALS['wphx_post'], 640, 360 );
} );
$cases[] = wphx_case( 'oembed-response-data-rich:video-attachment', null, array(), function () {
\t$GLOBALS['wphx_post_type'] = 'attachment';
\t$GLOBALS['wphx_attachment_is_video'] = true;
\t$GLOBALS['wphx_post_thumbnail_id'] = 56;
\t$GLOBALS['wphx_attachment_image_src'] = array( 'https://cdn.example/video-poster.jpg', 640, 360 );
\treturn get_oembed_response_data_rich( array( 'version' => '1.0', 'title' => 'Video Attachment' ), $GLOBALS['wphx_post'], 640, 360 );
} );
$cases[] = wphx_case( 'oembed-response-data-for-url:single-site', null, array(), function () {
\treturn get_oembed_response_data_for_url( 'https://example.test/local-post', array( 'width' => 300 ) );
} );
$cases[] = wphx_case( 'oembed-response-data-for-url:filtered-post-id', null, array( 'oembed_request_post_id' => 7 ), function () {
\treturn get_oembed_response_data_for_url( 'https://remote.example/filtered-post', array( 'width' => 320 ) );
} );
$cases[] = wphx_case( 'oembed-response-data-for-url:no-post', null, array(), function () {
\treturn get_oembed_response_data_for_url( 'https://remote.example/missing-post', array( 'width' => 300 ) );
} );
$cases[] = wphx_case( 'oembed-response-data-for-url:multisite-switch', null, array(), function () {
\t$GLOBALS['wphx_is_multisite'] = true;
\t$GLOBALS['wphx_sites'] = array( (object) array( 'blog_id' => 2, 'deleted' => 0, 'spam' => 0, 'archived' => 0 ) );
\t$GLOBALS['wphx_url_to_postid']['https://example.test/site-a/post-7'] = 7;
\treturn get_oembed_response_data_for_url( 'https://example.test/site-a/post-7', array( 'width' => 350 ) );
} );
$cases[] = wphx_case( 'oembed-response-data-for-url:multisite-deleted', null, array(), function () {
\t$GLOBALS['wphx_is_multisite'] = true;
\t$GLOBALS['wphx_sites'] = array( (object) array( 'blog_id' => 2, 'deleted' => 1, 'spam' => 0, 'archived' => 0 ) );
\t$GLOBALS['wphx_url_to_postid']['https://example.test/site-a/post-7'] = 7;
\treturn get_oembed_response_data_for_url( 'https://example.test/site-a/post-7', array( 'width' => 350 ) );
} );
$cases[] = wphx_case( 'rest-pre-serve:wrong-route', null, array(), function () {
\t$server = new WpRestServer();
\treturn wphx_capture( function () use ( $server ) {
\t\t$return = _oembed_rest_pre_serve_request( 'already-served', array( 'version' => '1.0' ), new WpRestRequest( '/wp/v2/posts', 'GET', array( 'format' => 'xml' ) ), $server );
\t\treturn array(
\t\t\t'return' => $return,
\t\t\t'server_calls' => $server->calls,
\t\t\t'headers' => $server->headers,
\t\t);
\t} );
} );
$cases[] = wphx_case( 'rest-pre-serve:wrong-method', null, array(), function () {
\t$server = new WpRestServer();
\treturn wphx_capture( function () use ( $server ) {
\t\t$return = _oembed_rest_pre_serve_request( false, array( 'version' => '1.0' ), new WpRestRequest( '/oembed/1.0/embed', 'POST', array( 'format' => 'xml' ) ), $server );
\t\treturn array(
\t\t\t'return' => $return,
\t\t\t'server_calls' => $server->calls,
\t\t\t'headers' => $server->headers,
\t\t);
\t} );
} );
$cases[] = wphx_case( 'rest-pre-serve:json-format', null, array(), function () {
\t$server = new WpRestServer();
\treturn wphx_capture( function () use ( $server ) {
\t\t$return = _oembed_rest_pre_serve_request( false, array( 'version' => '1.0' ), new WpRestRequest( '/oembed/1.0/embed', 'GET', array( 'format' => 'json' ) ), $server );
\t\treturn array(
\t\t\t'return' => $return,
\t\t\t'server_calls' => $server->calls,
\t\t\t'headers' => $server->headers,
\t\t);
\t} );
} );
$cases[] = wphx_case( 'rest-pre-serve:xml-success', null, array(), function () {
\t$server = new WpRestServer();
\treturn wphx_capture( function () use ( $server ) {
\t\t$return = _oembed_rest_pre_serve_request(
\t\t\tfalse,
\t\t\tarray(
\t\t\t\t'version' => '1.0',
\t\t\t\t'title'   => 'XML & Embed',
\t\t\t\t'width'   => 600,
\t\t\t),
\t\t\tnew WpRestRequest( '/oembed/1.0/embed', 'GET', array( 'format' => 'xml' ) ),
\t\t\t$server
\t\t);
\t\treturn array(
\t\t\t'return' => $return,
\t\t\t'server_calls' => $server->calls,
\t\t\t'headers' => $server->headers,
\t\t);
\t} );
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
$cases[] = wphx_case( 'xml:invalid-scalar', null, array(), function () {
	return _oembed_create_xml( 'not-an-array' );
} );
$cases[] = wphx_case( 'xml:empty-array', null, array(), function () {
	return _oembed_create_xml( array() );
} );
$cases[] = wphx_case( 'xml:flat-scalars', null, array(), function () {
	return _oembed_create_xml(
		array(
			'version' => '1.0',
			'title'   => 'Local & Embed',
			'width'   => 600,
		)
	);
} );
$cases[] = wphx_case( 'xml:nested-and-numeric-keys', null, array(), function () {
	return _oembed_create_xml(
		array(
			'provider' => array(
				'name' => 'Example',
				'url'  => 'https://example.test',
			),
			'items'    => array(
				array( 'title' => 'First' ),
				array( 'title' => 'Second' ),
			),
		)
	);
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
$cases[] = wphx_case( 'embed-styles:default', null, array(), function () {
\treturn wp_enqueue_embed_styles();
} );
$cases[] = wphx_case( 'embed-styles:unhooked', null, array(), function () {
\tunset( $GLOBALS['wphx_actions']['embed_head']['print_embed_styles'] );
\treturn wp_enqueue_embed_styles();
} );
$cases[] = wphx_case( 'embed-styles:suffix-min', null, array(), function () {
\t$GLOBALS['wphx_scripts_suffix'] = '.min';
\treturn wp_enqueue_embed_styles();
} );
$cases[] = wphx_case( 'embed-scripts:default', null, array(), function () {
\treturn wphx_capture( function () {
\t\treturn print_embed_scripts();
\t} );
} );
$cases[] = wphx_case( 'embed-scripts:suffix-min', null, array(), function () {
\t$GLOBALS['wphx_scripts_suffix'] = '.min';
\treturn wphx_capture( function () {
\t\treturn print_embed_scripts();
\t} );
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
$cases[] = wphx_case( 'feed-content:no-iframe', null, array(), function () {
\treturn _oembed_filter_feed_content( '<p>No iframe</p>' );
} );
$cases[] = wphx_case( 'feed-content:embedded-style-removed', null, array(), function () {
\treturn _oembed_filter_feed_content( '<p><iframe class="wp-embedded-content" style="position:absolute" src="https://example.test/embed"></iframe></p>' );
} );
$cases[] = wphx_case( 'feed-content:non-embedded-style-kept', null, array(), function () {
\treturn _oembed_filter_feed_content( '<iframe class="other" style="position:absolute" src="https://example.test/embed"></iframe>' );
} );
$cases[] = wphx_case( 'feed-content:multiple-iframes', null, array(), function () {
\treturn _oembed_filter_feed_content( '<iframe class="wp-embedded-content" style="a"></iframe><iframe class="other" style="b"></iframe><iframe class="wp-embedded-content extra" style="c"></iframe>' );
} );
$cases[] = wphx_case( 'iframe-title:false-result', null, array(), function () {
\treturn wp_filter_oembed_iframe_title_attribute( false, (object) array( 'type' => 'rich', 'title' => 'Provider Title' ), 'https://provider.example/embed' );
} );
$cases[] = wphx_case( 'iframe-title:non-rich-type', null, array(), function () {
\treturn wp_filter_oembed_iframe_title_attribute( '<iframe src="https://provider.example/embed"></iframe>', (object) array( 'type' => 'photo', 'title' => 'Provider Title' ), 'https://provider.example/embed' );
} );
$cases[] = wphx_case( 'iframe-title:data-title', null, array(), function () {
\treturn wp_filter_oembed_iframe_title_attribute( '<div><iframe src="https://provider.example/embed"></iframe></div>', (object) array( 'type' => 'rich', 'title' => 'Provider Title' ), 'https://provider.example/embed' );
} );
$cases[] = wphx_case( 'iframe-title:existing-title', null, array(), function () {
\treturn wp_filter_oembed_iframe_title_attribute( '<iframe src="https://provider.example/embed" title="Existing Title" width="600"></iframe>', (object) array( 'type' => 'video', 'title' => 'Provider Title' ), 'https://provider.example/embed' );
} );
$cases[] = wphx_case( 'iframe-title:uppercase-title', null, array(), function () {
\treturn wp_filter_oembed_iframe_title_attribute( '<iframe TITLE="Upper Title" src="https://provider.example/embed"></iframe>', (object) array( 'type' => 'rich', 'title' => 'Provider Title' ), 'https://provider.example/embed' );
} );
$cases[] = wphx_case( 'iframe-title:filter-empty', null, array( 'oembed_iframe_title_attribute' => '' ), function () {
\treturn wp_filter_oembed_iframe_title_attribute( '<iframe src="https://provider.example/embed"></iframe>', (object) array( 'type' => 'rich', 'title' => 'Provider Title' ), 'https://provider.example/embed' );
} );
$cases[] = wphx_case( 'iframe-title:filter-escaped', null, array( 'oembed_iframe_title_attribute' => 'Filtered "Title"' ), function () {
\treturn wp_filter_oembed_iframe_title_attribute( '<iframe src="https://provider.example/embed"></iframe>', (object) array( 'type' => 'rich', 'title' => 'Provider Title' ), 'https://provider.example/embed' );
} );
$cases[] = wphx_case( 'oembed-result:false-result', null, array(), function () {
\treturn wp_filter_oembed_result( false, (object) array( 'type' => 'rich' ), 'https://provider.example/embed' );
} );
$cases[] = wphx_case( 'oembed-result:non-rich-type', null, array(), function () {
\treturn wp_filter_oembed_result( '<iframe src="https://provider.example/embed"></iframe>', (object) array( 'type' => 'photo' ), 'https://provider.example/embed' );
} );
$cases[] = wphx_case( 'oembed-result:trusted-provider', null, array(), function () {
\t$GLOBALS['wphx_trusted_oembed_provider'] = 'https://provider.example/oembed';
\treturn wp_filter_oembed_result( '<script>bad()</script><iframe src="https://provider.example/embed"></iframe>', (object) array( 'type' => 'video' ), 'https://provider.example/embed' );
} );
$cases[] = wphx_case( 'oembed-result:missing-iframe', null, array(), function () {
\treturn wp_filter_oembed_result( '<blockquote>Fallback</blockquote><p>No iframe</p>', (object) array( 'type' => 'rich' ), 'https://remote.example/embed' );
} );
$cases[] = wphx_case( 'oembed-result:iframe-only', null, array(), function () {
\treturn wp_filter_oembed_result( '<div><iframe src="https://remote.example/embed" width="600" height="400" onclick="bad()"></iframe></div>', (object) array( 'type' => 'rich' ), 'https://remote.example/embed' );
} );
$cases[] = wphx_case( 'oembed-result:blockquote-and-iframe', null, array(), function () {
\treturn wp_filter_oembed_result( '<blockquote><a href="https://remote.example/post" onclick="bad()">Remote</a></blockquote><div><iframe src="https://remote.example/embed" width="600"></iframe></div>', (object) array( 'type' => 'video' ), 'https://remote.example/embed' );
} );
$cases[] = wphx_case( 'oembed-result:iframe-without-src', null, array(), function () {
\treturn wp_filter_oembed_result( '<iframe width="600" title="No source"></iframe>', (object) array( 'type' => 'rich' ), 'https://remote.example/embed' );
} );
$cases[] = wphx_case( 'comments-button:plural', null, array(), function () {
\t$GLOBALS['wphx_comments_number'] = 2;
\treturn wphx_capture( function () {
\t\treturn print_embed_comments_button();
\t} );
} );
$cases[] = wphx_case( 'comments-button:singular', null, array(), function () {
\t$GLOBALS['wphx_comments_number'] = 1;
\treturn wphx_capture( function () {
\t\treturn print_embed_comments_button();
\t} );
} );
$cases[] = wphx_case( 'comments-button:open-zero-comments', null, array(), function () {
\t$GLOBALS['wphx_comments_number'] = 0;
\t$GLOBALS['wphx_comments_open'] = true;
\t$GLOBALS['wphx_comments_link'] = 'https://example.test/post/7/#respond';
\treturn wphx_capture( function () {
\t\treturn print_embed_comments_button();
\t} );
} );
$cases[] = wphx_case( 'comments-button:closed-zero-comments', null, array(), function () {
\t$GLOBALS['wphx_comments_number'] = 0;
\t$GLOBALS['wphx_comments_open'] = false;
\treturn wphx_capture( function () {
\t\treturn print_embed_comments_button();
\t} );
} );
$cases[] = wphx_case( 'comments-button:is-404', null, array(), function () {
\t$GLOBALS['wphx_is_404'] = true;
\treturn wphx_capture( function () {
\t\treturn print_embed_comments_button();
\t} );
} );
$cases[] = wphx_case( 'sharing-button:default', null, array(), function () {
\treturn wphx_capture( function () {
\t\treturn print_embed_sharing_button();
\t} );
} );
$cases[] = wphx_case( 'sharing-button:is-404', null, array(), function () {
\t$GLOBALS['wphx_is_404'] = true;
\treturn wphx_capture( function () {
\t\treturn print_embed_sharing_button();
\t} );
} );
$cases[] = wphx_case( 'sharing-dialog:default', null, array(), function () {
\t$GLOBALS['wphx_permalink'] = 'https://example.test/post/7/?a=1&b=2';
\treturn wphx_capture( function () {
\t\treturn print_embed_sharing_dialog();
\t} );
} );
$cases[] = wphx_case( 'sharing-dialog:is-404', null, array(), function () {
\t$GLOBALS['wphx_is_404'] = true;
\treturn wphx_capture( function () {
\t\treturn print_embed_sharing_dialog();
\t} );
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
foreach ( array( 'wp_embed_register_handler', 'wp_embed_unregister_handler', 'wp_embed_defaults', 'wp_oembed_get', '_wp_oembed_get_object', 'get_post_embed_url', 'get_post_embed_html', 'get_oembed_response_data', 'get_oembed_response_data_rich', 'get_oembed_response_data_for_url', 'get_oembed_endpoint_url', 'wp_oembed_ensure_format', '_oembed_rest_pre_serve_request', '_oembed_create_xml', 'wp_oembed_add_provider', 'wp_oembed_remove_provider', 'wp_oembed_register_route', 'wp_oembed_add_discovery_links', 'wp_oembed_add_host_js', 'wp_maybe_enqueue_oembed_host_js', 'wp_embed_excerpt_more', 'the_excerpt_embed', 'wp_embed_excerpt_attachment', 'enqueue_embed_scripts', 'wp_enqueue_embed_styles', 'print_embed_scripts', 'the_embed_site_title', 'wp_filter_pre_oembed_result', '_oembed_filter_feed_content', 'wp_filter_oembed_iframe_title_attribute', 'wp_filter_oembed_result', 'print_embed_comments_button', 'print_embed_sharing_button', 'print_embed_sharing_dialog', 'wp_maybe_load_embeds', 'wp_embed_handler_youtube', 'wp_embed_handler_audio', 'wp_embed_handler_video' ) as $function_name ) {
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
  writeEmbedAssetFixtures();

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
    "wp-includes/embed.php:global-function:_oembed_create_xml",
    "wp-includes/embed.php:global-function:_oembed_filter_feed_content",
    "wp-includes/embed.php:global-function:_oembed_rest_pre_serve_request",
    "wp-includes/embed.php:global-function:_wp_oembed_get_object",
    "wp-includes/embed.php:global-function:enqueue_embed_scripts",
    "wp-includes/embed.php:global-function:get_oembed_endpoint_url",
    "wp-includes/embed.php:global-function:get_oembed_response_data",
    "wp-includes/embed.php:global-function:get_oembed_response_data_for_url",
    "wp-includes/embed.php:global-function:get_oembed_response_data_rich",
    "wp-includes/embed.php:global-function:get_post_embed_html",
    "wp-includes/embed.php:global-function:get_post_embed_url",
    "wp-includes/embed.php:global-function:print_embed_comments_button",
    "wp-includes/embed.php:global-function:print_embed_scripts",
    "wp-includes/embed.php:global-function:print_embed_sharing_button",
    "wp-includes/embed.php:global-function:print_embed_sharing_dialog",
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
    "wp-includes/embed.php:global-function:wp_enqueue_embed_styles",
    "wp-includes/embed.php:global-function:wp_filter_oembed_iframe_title_attribute",
    "wp-includes/embed.php:global-function:wp_filter_oembed_result",
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
        "get_post_embed_url",
        "get_post_embed_html",
        "get_oembed_response_data",
        "get_oembed_response_data_rich",
        "get_oembed_response_data_for_url",
        "get_oembed_endpoint_url",
        "wp_oembed_ensure_format",
        "_oembed_rest_pre_serve_request",
        "_oembed_create_xml",
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
        "wp_enqueue_embed_styles",
        "print_embed_scripts",
        "the_embed_site_title",
        "wp_filter_pre_oembed_result",
        "_oembed_filter_feed_content",
        "wp_filter_oembed_iframe_title_attribute",
        "wp_filter_oembed_result",
        "print_embed_comments_button",
        "print_embed_sharing_button",
        "print_embed_sharing_dialog",
        "wp_maybe_load_embeds",
        "wp_embed_handler_youtube",
        "wp_embed_handler_audio",
        "wp_embed_handler_video"
      ],
      selected_source_lines: ["25-29", "40-44", "67-93", "113-117", "126-133", "419-446", "490-550", "561-629", "719-755", "640-717", "455-481", "782-823", "759-765", "828-856", "147-158", "166-181", "325-329", "337-376", "387", "400-412", "1007-1020", "1028-1043", "1051-1062", "1069-1077", "1084-1097", "1103-1110", "1232-1256", "1267-1275", "1119-1129", "863-922", "945-997", "1134-1156", "1163-1177", "1181-1222", "191-232", "242-258", "272-294", "299-321"]
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
      "The minimized oracle/candidate probe matches WordPress 7.0 behavior for local handler register/unregister delegation, embed defaults sizing and filters, oEmbed singleton creation, wp_oembed_get() get_html delegation and raw args forwarding, post embed URL construction, permalink-structure and path-conflict fallback, post_embed_url filtering and sanitize_url behavior, post embed HTML missing-post false returns, deterministic secret insertion, blockquote and iframe markup, title/site title formatting, absint width/height normalization, suffix-aware wp-embed script loading, inline script tag output, embed_html filtering, oEmbed response data missing/non-public/non-embeddable false returns, min/max width filtering and clamping, height calculation, provider/site fields, author fallback and override behavior, oembed_response_data filter payloads, rich oEmbed response native-array mutation, rich width/height/type/html fields, post thumbnail lookup, image attachment thumbnail selection, video attachment type switching, thumbnail image tuple propagation, URL response single-site post lookup, oembed_request_post_id filter override, missing post-id false returns, multisite URL parsing and get_sites query construction, deleted-site rejection, switch_to_blog and restore_current_blog timing, object-cast response shape, REST pre-serve route/method/format fallthrough, REST response_to_data handoff, XML generation, Content-Type header emission, XML echo output, true served return, oEmbed endpoint URL construction and filters, oEmbed format normalization, recursive _oembed_create_xml() false-return and SimpleXML output behavior, early and post-plugins-loaded provider add/remove registry behavior, oEmbed route controller delegation, discovery link echo output, wp_head priority fallback/removal behavior, deprecated empty host-JS marker behavior, conditional wp-embed script enqueue detection, embed excerpt more-link formatting, excerpt embed echo/filter behavior, attachment excerpt replacement, embed script action dispatch, embed style enqueue action gating, print_embed_styles removal, suffix-aware CSS file loading, inline style registration/enqueue side effects, embed script inline-tag output, trimmed JavaScript asset loading, sourceURL construction, embed site title echo/filter behavior, pre-oEmbed local data2html delegation and fallback preservation, feed-content embedded iframe style removal through WP_HTML_Tag_Processor, oEmbed iframe title strict-false and non-rich passthrough, provider data title fallback, wp_kses_hair() iframe attribute parsing, mixed-case title attribute normalization, existing-title replacement, oembed_iframe_title_attribute filter handling, empty-title fallback preservation, title escaping, oEmbed result strict-false and non-rich passthrough, trusted-provider bypass, KSES allowlist handoff, iframe extraction failure, deterministic secret insertion, data-secret allowlist promotion, blockquote fallback iframe hiding, wp-embedded-content class insertion, sandbox/security iframe rewriting, comments button comment-count/open/404 gating, comments link output, pluralized screen-reader text, localized number formatting, sharing button 404 suppression and escaped aria-label output, sharing dialog 404 suppression, deterministic tab/description ids, permalink output, textarea escaping of get_post_embed_html(), translated labels/descriptions, default handler loading and callback filters, local YouTube autoembed delegation, local audio/video shortcode handler output, video dimensions, URL escaping, and filter payloads."
    ],
    non_claims: [
      "This fixture does not claim full wp-includes/embed.php ownership.",
      "This fixture does not retire the WPHX-312.04 copied feed/embed/HTTPS oracle fixture.",
      "This fixture does not claim WP_Embed, WP_oEmbed, WP_oEmbed_Controller, WP_HTML_Tag_Processor, WP_REST_Request, WP_REST_Server, wp_kses(), wp_kses_hair(), or wp_list_pluck() ownership beyond the narrow route registration, get_html/data2html/get_provider singleton delegation, handler/provider registry, discovery-link helper calls, host-JS enqueue marker, embed style/script/helper calls, post embed HTML helper calls, excerpt/site-title/post-embed-url/oEmbed-response-data/rich-response/URL-response helper calls, XML pre-serve helper calls, feed-content iframe traversal/style removal, iframe title/result filter interactions, comments/sharing-button/sharing-dialog markup output, and autoembed interactions required by selected module functions, remote oEmbed discovery/fetch, full REST server dispatch, XML fatal die branches, full installed post embed rendering, installed browser behavior, installed WordPress behavior, multisite network correctness beyond the deterministic selected URL resolution scenarios, or arbitrary module-function lowering beyond the selected original-path embed helpers."
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
