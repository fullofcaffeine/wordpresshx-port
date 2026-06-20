#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.7.5",
  external_ref: "WPHX-303.05",
  title: "Build KSES differential fixture harness"
};
const OUT_ROOT = "build/wp-core/wphx-303-05";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const SIMPLEPIE_STUB = `${OUT_ROOT}/simplepie-stubs.php`;
const OUT = "manifests/wp-core/wphx-303-05-kses-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-303-05-kses-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-303-05-kses-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-303-01-error-format-surface.v1.json";
const RECORDED_AT = "2026-06-21T01:20:00.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const UPSTREAM_ROOT = "../wordpress-develop";

const SOURCE_FILES = [
  "src/wp-includes/class-wp-hook.php",
  "src/wp-includes/compat.php",
  "src/wp-includes/utf8.php",
  "src/wp-includes/load.php",
  "src/wp-includes/plugin.php",
  "src/wp-includes/cache.php",
  "src/wp-includes/class-wp-object-cache.php",
  "src/wp-includes/option.php",
  "src/wp-includes/functions.php",
  "src/wp-includes/http.php",
  "src/wp-includes/class-wp-token-map.php",
  "src/wp-includes/html-api/html5-named-character-references.php",
  "src/wp-includes/html-api/class-wp-html-decoder.php",
  "src/wp-includes/html-api/class-wp-html-span.php",
  "src/wp-includes/html-api/class-wp-html-text-replacement.php",
  "src/wp-includes/html-api/class-wp-html-attribute-token.php",
  "src/wp-includes/html-api/class-wp-html-doctype-info.php",
  "src/wp-includes/html-api/class-wp-html-tag-processor.php",
  "src/wp-includes/kses.php",
  "src/wp-includes/formatting.php",
  "src/wp-includes/class-wp-simplepie-sanitize-kses.php"
];

const COVERED_SYMBOLS = [
  "wp_kses",
  "wp_kses_post",
  "wp_kses_post_deep",
  "wp_kses_allowed_html",
  "wp_kses_bad_protocol",
  "wp_kses_normalize_entities",
  "wp_kses_decode_entities",
  "wp_kses_no_null",
  "wp_kses_hair",
  "wp_kses_hair_parse",
  "wp_kses_attr_parse",
  "wp_kses_attr",
  "wp_kses_one_attr",
  "safecss_filter_attr",
  "WP_SimplePie_Sanitize_KSES::sanitize"
];

const FIXTURE_CASES = [
  { id: "wp-kses:post-basic-script-attribute", symbol: "wp_kses", focus: "post context strips scripts, event attributes, and javascript URLs while keeping allowed markup" },
  { id: "wp-kses:pre-kses-filter", symbol: "wp_kses", focus: "pre_kses filter receives content, context, and protocol list before splitting" },
  { id: "wp-kses-post:comment-and-bogus-tag", symbol: "wp_kses_post", focus: "bogus comments, malformed tags, and post allow-list output" },
  { id: "allowed-html:contexts-and-filter", symbol: "wp_kses_allowed_html", focus: "post/data/user_description/strip/entities/explicit contexts and filter hook arguments" },
  { id: "bad-protocol:encoded-and-feed", symbol: "wp_kses_bad_protocol", focus: "encoded javascript protocols, repeated protocols, feed recursion, and safe protocols" },
  { id: "entities:normalize-html-xml", symbol: "wp_kses_normalize_entities", focus: "HTML and XML entity normalization, invalid numeric entities, and decode behavior" },
  { id: "no-null:control-and-slash-zero", symbol: "wp_kses_no_null", focus: "control character removal and slash-zero handling" },
  { id: "hair:attribute-parser", symbol: "wp_kses_hair", focus: "HTML API attribute parsing, booleans, duplicates, malformed quotes, entity recoding, and URI protocol stripping" },
  { id: "attr-parse:malformed", symbol: "wp_kses_attr_parse", focus: "standalone attribute parser false returns and malformed element preservation" },
  { id: "attr:required-and-data-wildcard", symbol: "wp_kses_attr", focus: "required attributes, data-* wildcard values, and disallowed event attributes" },
  { id: "one-attr:single-attribute", symbol: "wp_kses_one_attr", focus: "single-attribute validation for URL, event, entity, and style attributes" },
  { id: "safecss:dangerous-values", symbol: "safecss_filter_attr", focus: "CSS allow-listing, unsafe URL functions, custom properties, and escaped comments" },
  { id: "post-deep:nested-array-object", symbol: "wp_kses_post_deep", focus: "recursive KSES over arrays and objects through map_deep()" },
  { id: "simplepie:kses-html-bridge", symbol: "WP_SimplePie_Sanitize_KSES::sanitize", focus: "feed HTML, maybe-HTML, XHTML, and base64 branches delegated through wp_kses_post()" }
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function command(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 50
  }).trim();
}

function maybeCommand(commandName, commandArgs) {
  try {
    return command(commandName, commandArgs);
  } catch {
    return null;
  }
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function inputRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function upstreamPath(path) {
  return `${UPSTREAM_ROOT}/${path}`;
}

function mirrorPath(root, path) {
  return `${root}/${path.replace(/^src\//, "")}`;
}

function mirrorSources(root) {
  for (const path of SOURCE_FILES) {
    const target = mirrorPath(root, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(upstreamPath(path), target);
  }
}

function sourceRecord(path) {
  return {
    path,
    repo_path: upstreamPath(path),
    bytes: statSync(upstreamPath(path)).size,
    sha256: sha256File(upstreamPath(path))
  };
}

function writeSimplePieStub() {
  mkdirSync(dirname(SIMPLEPIE_STUB), { recursive: true });
  writeFileSync(
    SIMPLEPIE_STUB,
    `<?php
namespace SimplePie {
\tclass SimplePie {
\t\tpublic const CONSTRUCT_TEXT = 1;
\t\tpublic const CONSTRUCT_HTML = 2;
\t\tpublic const CONSTRUCT_XHTML = 4;
\t\tpublic const CONSTRUCT_BASE64 = 8;
\t\tpublic const CONSTRUCT_MAYBE_HTML = 32;
\t}

\tclass Sanitize {
\t\tpublic $output_encoding = 'UTF-8';
\t\tpublic $registry;

\t\tpublic function sanitize( $data, $type, $base = '' ) {
\t\t\treturn array(
\t\t\t\t'parent' => true,
\t\t\t\t'data'   => trim( $data ),
\t\t\t\t'type'   => $type,
\t\t\t\t'base'   => $base,
\t\t\t);
\t\t}
\t}
}

namespace {
\tif ( ! defined( 'SIMPLEPIE_PCRE_HTML_ATTRIBUTE' ) ) {
\t\tdefine(
\t\t\t'SIMPLEPIE_PCRE_HTML_ATTRIBUTE',
<<<'WPHX_SIMPLEPIE_PCRE_HTML_ATTRIBUTE'
((?:[\\x09\\x0A\\x0B\\x0C\\x0D\\x20]+[^\\x09\\x0A\\x0B\\x0C\\x0D\\x20\\x2F\\x3E][^\\x09\\x0A\\x0B\\x0C\\x0D\\x20\\x2F\\x3D\\x3E]*(?:[\\x09\\x0A\\x0B\\x0C\\x0D\\x20]*=[\\x09\\x0A\\x0B\\x0C\\x0D\\x20]*(?:"(?:[^"]*)"|'(?:[^']*)'|(?:[^\\x09\\x0A\\x0B\\x0C\\x0D\\x20\\x22\\x27\\x3E][^\\x09\\x0A\\x0B\\x0C\\x0D\\x20\\x3E]*)?))?)*)[\\x09\\x0A\\x0B\\x0C\\x0D\\x20]*
WPHX_SIMPLEPIE_PCRE_HTML_ATTRIBUTE
\t\t);
\t}
}
`
  );
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php

$mode = $argv[1];
$root = rtrim( $argv[2], '/\\\\' );
$simplepie_stub = $argv[3];

error_reporting( E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED );
ini_set( 'display_errors', '0' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'WP_CONTENT_DIR', $root . '/wp-content' );

require_once ABSPATH . WPINC . '/compat.php';
require_once ABSPATH . WPINC . '/utf8.php';
require_once ABSPATH . WPINC . '/load.php';
require_once ABSPATH . WPINC . '/plugin.php';
require_once ABSPATH . WPINC . '/cache.php';
require_once ABSPATH . WPINC . '/functions.php';

wp_cache_init();
wp_cache_set(
\t'alloptions',
\tarray(
\t\t'blog_charset' => 'UTF-8',
\t),
\t'options'
);

require_once ABSPATH . WPINC . '/http.php';
require_once ABSPATH . WPINC . '/class-wp-token-map.php';
require_once ABSPATH . WPINC . '/html-api/html5-named-character-references.php';
require_once ABSPATH . WPINC . '/html-api/class-wp-html-decoder.php';
require_once ABSPATH . WPINC . '/html-api/class-wp-html-span.php';
require_once ABSPATH . WPINC . '/html-api/class-wp-html-text-replacement.php';
require_once ABSPATH . WPINC . '/html-api/class-wp-html-attribute-token.php';
require_once ABSPATH . WPINC . '/html-api/class-wp-html-doctype-info.php';
require_once ABSPATH . WPINC . '/html-api/class-wp-html-tag-processor.php';
require_once ABSPATH . WPINC . '/kses.php';
require_once ABSPATH . WPINC . '/formatting.php';
require_once $simplepie_stub;
require_once ABSPATH . WPINC . '/class-wp-simplepie-sanitize-kses.php';

function wphx_303_05_scalar( $value ) {
\tif ( is_int( $value ) ) {
\t\treturn array( 'type' => 'int', 'value' => $value );
\t}
\tif ( is_float( $value ) ) {
\t\treturn array( 'type' => 'float', 'value' => $value );
\t}
\tif ( is_bool( $value ) ) {
\t\treturn array( 'type' => 'bool', 'value' => $value );
\t}
\tif ( null === $value ) {
\t\treturn array( 'type' => 'null', 'value' => null );
\t}
\treturn array(
\t\t'type'   => 'string',
\t\t'value'  => (string) $value,
\t\t'hex'    => bin2hex( (string) $value ),
\t\t'bytes'  => strlen( (string) $value ),
\t\t'sha256' => hash( 'sha256', (string) $value ),
\t);
}

function wphx_303_05_value( $value ) {
\tif ( is_array( $value ) ) {
\t\t$entries = array();
\t\tforeach ( $value as $key => $entry_value ) {
\t\t\t$entries[] = array(
\t\t\t\t'key'   => wphx_303_05_scalar( $key ),
\t\t\t\t'value' => wphx_303_05_value( $entry_value ),
\t\t\t);
\t\t}
\t\treturn array(
\t\t\t'type'    => 'array',
\t\t\t'count'   => count( $value ),
\t\t\t'entries' => $entries,
\t\t);
\t}
\tif ( is_object( $value ) ) {
\t\treturn array(
\t\t\t'type'             => 'object',
\t\t\t'class'            => get_class( $value ),
\t\t\t'publicProperties' => wphx_303_05_value( get_object_vars( $value ) ),
\t\t);
\t}
\treturn wphx_303_05_scalar( $value );
}

function wphx_303_05_case( $id, $symbol, $value, $meta = array() ) {
\treturn array(
\t\t'id'     => $id,
\t\t'symbol' => $symbol,
\t\t'value'  => wphx_303_05_value( $value ),
\t\t'meta'   => $meta,
\t);
}

function wphx_303_05_html_context_summary( $context ) {
\t$allowed = wp_kses_allowed_html( $context );
\treturn array(
\t\t'context'      => $context,
\t\t'tagCount'     => count( $allowed ),
\t\t'firstTags'    => array_slice( array_keys( $allowed ), 0, 10 ),
\t\t'hasA'         => isset( $allowed['a'] ),
\t\t'hasAHref'     => isset( $allowed['a']['href'] ),
\t\t'hasATarget'   => isset( $allowed['a']['target'] ),
\t\t'hasARel'      => isset( $allowed['a']['rel'] ),
\t\t'hasImgSrc'    => isset( $allowed['img']['src'] ),
\t\t'hasVideoSrc'  => isset( $allowed['video']['src'] ),
\t\t'hasScriptTag' => isset( $allowed['script'] ),
\t);
}

function wphx_303_05_run_cases() {
\t$cases = array();
\t$protocols = wp_allowed_protocols();

\t$cases[] = wphx_303_05_case(
\t\t'wp-kses:post-basic-script-attribute',
\t\t'wp_kses',
\t\twp_kses( '<p class="ok" onclick="evil()">Hi <script>alert(1)</script><a href="javascript:alert(1)" title="safe">bad</a><img src="http://example.test/a.png" onerror="x" /></p>', 'post' )
\t);

\t$pre_kses_events = array();
\t$pre_kses_filter = function ( $content, $allowed_html, $allowed_protocols ) use ( &$pre_kses_events ) {
\t\t$pre_kses_events[] = array(
\t\t\t'content'         => $content,
\t\t\t'allowedHtmlType' => is_array( $allowed_html ) ? 'array' : gettype( $allowed_html ),
\t\t\t'allowedHtml'     => is_array( $allowed_html ) ? array_keys( $allowed_html ) : $allowed_html,
\t\t\t'protocolCount'   => count( $allowed_protocols ),
\t\t);
\t\treturn $content . '<em data-filtered="1">filtered</em>';
\t};
\tadd_filter( 'pre_kses', $pre_kses_filter, 10, 3 );
\t$pre_kses_result = wp_kses( '<strong>Safe</strong><script>bad()</script>', 'post' );
\tremove_filter( 'pre_kses', $pre_kses_filter, 10 );
\t$cases[] = wphx_303_05_case(
\t\t'wp-kses:pre-kses-filter',
\t\t'wp_kses',
\t\t$pre_kses_result,
\t\tarray( 'events' => $pre_kses_events )
\t);

\t$cases[] = wphx_303_05_case(
\t\t'wp-kses-post:comment-and-bogus-tag',
\t\t'wp_kses_post',
\t\twp_kses_post( '<!-- keep --><!fake><p data-id="5">ok</p><:::><a href="feed:javascript:alert(1)">feed</a>' )
\t);

\t$allowed_events = array();
\t$allowed_filter = function ( $html, $context ) use ( &$allowed_events ) {
\t\t$allowed_events[] = array(
\t\t\t'context'  => $context,
\t\t\t'tagCount' => count( $html ),
\t\t\t'hasA'     => isset( $html['a'] ),
\t\t);
\t\treturn $html;
\t};
\tadd_filter( 'wp_kses_allowed_html', $allowed_filter, 10, 2 );
\t$explicit_allowed = array(
\t\t'custom-tag' => array(
\t\t\t'data-id' => true,
\t\t),
\t);
\t$contexts = array(
\t\t'post'             => wphx_303_05_html_context_summary( 'post' ),
\t\t'data'             => wphx_303_05_html_context_summary( 'data' ),
\t\t'user_description' => wphx_303_05_html_context_summary( 'user_description' ),
\t\t'strip'            => wphx_303_05_html_context_summary( 'strip' ),
\t\t'entities'         => wphx_303_05_html_context_summary( 'entities' ),
\t\t'explicit'         => wp_kses_allowed_html( $explicit_allowed ),
\t);
\tremove_filter( 'wp_kses_allowed_html', $allowed_filter, 10 );
\t$cases[] = wphx_303_05_case(
\t\t'allowed-html:contexts-and-filter',
\t\t'wp_kses_allowed_html',
\t\t$contexts,
\t\tarray( 'events' => $allowed_events )
\t);

\t$bad_protocol_inputs = array(
\t\t'javascript:alert(1)',
\t\t'JaVaScRiPt:alert(1)',
\t\t'javascript&#58;alert(1)',
\t\t'jav&#x09;ascript:alert(1)',
\t\t'feed:javascript:alert(1)',
\t\t'feed:feed:javascript:alert(1)',
\t\t'http://example.test/path?x=1',
\t\t'urn:example:resource:item',
\t\t' data:text/html,<svg/onload=alert(1)>',
\t);
\t$bad_protocol_results = array();
\tforeach ( $bad_protocol_inputs as $input ) {
\t\t$bad_protocol_results[] = array(
\t\t\t'input'      => $input,
\t\t\t'normalized' => wp_kses_normalize_entities( $input ),
\t\t\t'output'     => wp_kses_bad_protocol( wp_kses_normalize_entities( $input ), $protocols ),
\t\t);
\t}
\t$cases[] = wphx_303_05_case(
\t\t'bad-protocol:encoded-and-feed',
\t\t'wp_kses_bad_protocol',
\t\t$bad_protocol_results
\t);

\t$entity_inputs = array(
\t\t'AT&T',
\t\t'&#00058;',
\t\t'&#XYZZY;',
\t\t'&spades;',
\t\t'&#1114112;',
\t\t'&#x110000;',
\t\t'&hellip;&#x41;&#65;',
\t);
\t$entity_results = array();
\tforeach ( $entity_inputs as $input ) {
\t\t$entity_results[] = array(
\t\t\t'input'           => $input,
\t\t\t'html'            => wp_kses_normalize_entities( $input ),
\t\t\t'xml'             => wp_kses_normalize_entities( $input, 'xml' ),
\t\t\t'decodedNumeric'  => wp_kses_decode_entities( $input ),
\t\t);
\t}
\t$cases[] = wphx_303_05_case(
\t\t'entities:normalize-html-xml',
\t\t'wp_kses_normalize_entities',
\t\t$entity_results
\t);

\t$cases[] = wphx_303_05_case(
\t\t'no-null:control-and-slash-zero',
\t\t'wp_kses_no_null',
\t\tarray(
\t\t\t'control'       => wp_kses_no_null( "a" . chr( 0 ) . "b" . chr( 31 ) . "c" ),
\t\t\t'slashZero'     => wp_kses_no_null( 'a\\\\0b\\\\000c' ),
\t\t\t'slashZeroKeep' => wp_kses_no_null( 'a\\\\0b\\\\000c', array( 'slash_zero' => 'keep' ) ),
\t\t)
\t);

\t$cases[] = wphx_303_05_case(
\t\t'hair:attribute-parser',
\t\t'wp_kses_hair',
\t\tarray(
\t\t\t'empty'       => wp_kses_hair( '', $protocols ),
\t\t\t'booleans'    => wp_kses_hair( 'disabled class="form-control" readonly id=input1', $protocols ),
\t\t\t'duplicate'   => wp_kses_hair( 'id="first" class="test" id="second"', $protocols ),
\t\t\t'malformed'   => wp_kses_hair( 'title="unclosed class="test" href="http://example.test"', $protocols ),
\t\t\t'entities'    => wp_kses_hair( 'data-lazy="&lt;img&#00062;" title="Tom & Jerry"', $protocols ),
\t\t\t'badProtocol' => wp_kses_hair( 'href="javascript:alert(1)" src="feed:javascript:alert(1)"', $protocols ),
\t\t)
\t);

\t$cases[] = wphx_303_05_case(
\t\t'attr-parse:malformed',
\t\t'wp_kses_attr_parse',
\t\tarray(
\t\t\t'valid'       => wp_kses_attr_parse( '<a title="hello" disabled href=# id="my_id">' ),
\t\t\t'closing'     => wp_kses_attr_parse( '</a title="hello">' ),
\t\t\t'invalidName' => wp_kses_attr_parse( '<a%%&&**>' ),
\t\t\t'badQuotes'   => wp_kses_attr_parse( "<a array[1]='z'z'z'z>" ),
\t\t)
\t);

\t$allowed_widget_html = array(
\t\t'widget' => array(
\t\t\t'data-*'  => true,
\t\t\t'required' => array( 'required' => true ),
\t\t\t'href'     => true,
\t\t\t'style'    => true,
\t\t),
\t);
\t$cases[] = wphx_303_05_case(
\t\t'attr:required-and-data-wildcard',
\t\t'wp_kses_attr',
\t\tarray(
\t\t\t'withRequired'     => wp_kses_attr( 'widget', 'data-id="5" onclick="evil()" required="required" href="javascript:alert(1)"', $allowed_widget_html, $protocols ),
\t\t\t'missingRequired'  => wp_kses_attr( 'widget', 'data-id="5" onclick="evil()"', $allowed_widget_html, $protocols ),
\t\t\t'badDataName'      => wp_kses_attr( 'widget', 'data-evil:name="5" required="required"', $allowed_widget_html, $protocols ),
\t\t\t'safeStyle'        => wp_kses_attr( 'widget', 'required="required" style="color:red; position:absolute; background-image:url(javascript:alert(1));"', $allowed_widget_html, $protocols ),
\t\t)
\t);

\t$cases[] = wphx_303_05_case(
\t\t'one-attr:single-attribute',
\t\t'wp_kses_one_attr',
\t\tarray(
\t\t\t'badHref'      => wp_kses_one_attr( 'href="javascript:alert(1)"', 'a' ),
\t\t\t'safeHref'     => wp_kses_one_attr( 'href="https://example.test/?a=1&b=2"', 'a' ),
\t\t\t'eventHandler' => wp_kses_one_attr( 'onerror="alert(1)"', 'img' ),
\t\t\t'entityTitle'  => wp_kses_one_attr( 'title="Tom &amp; Jerry"', 'a' ),
\t\t\t'style'        => wp_kses_one_attr( 'style="color:red; position:absolute; background:url(javascript:alert(1))"', 'span' ),
\t\t)
\t);

\t$cases[] = wphx_303_05_case(
\t\t'safecss:dangerous-values',
\t\t'safecss_filter_attr',
\t\tarray(
\t\t\t'mixed'          => safecss_filter_attr( 'color: red; position: absolute; background-image: url(javascript:alert(1)); text-align:center' ),
\t\t\t'customProperty' => safecss_filter_attr( '--wp--preset--color--primary: red; color: var(--wp--preset--color--primary);' ),
\t\t\t'comments'       => safecss_filter_attr( 'color:/*evil*/red; background:\\\\75rl(https://example.test/a.png);' ),
\t\t)
\t);

\t$deep_object = (object) array(
\t\t'html'   => '<p onclick="x">Obj <a href="javascript:alert(1)">bad</a></p>',
\t\t'nested' => array( '<em>ok</em><script>bad</script>' ),
\t);
\t$cases[] = wphx_303_05_case(
\t\t'post-deep:nested-array-object',
\t\t'wp_kses_post_deep',
\t\twp_kses_post_deep(
\t\t\tarray(
\t\t\t\t'scalar' => '<strong>Safe</strong><script>bad()</script>',
\t\t\t\t'object' => $deep_object,
\t\t\t)
\t\t)
\t);

\t$simplepie = new WP_SimplePie_Sanitize_KSES();
\t$cases[] = wphx_303_05_case(
\t\t'simplepie:kses-html-bridge',
\t\t'WP_SimplePie_Sanitize_KSES::sanitize',
\t\tarray(
\t\t\t'html'      => $simplepie->sanitize( '<p onclick="x"><a href="javascript:alert(1)">bad</a><strong>ok</strong></p>', \\SimplePie\\SimplePie::CONSTRUCT_HTML ),
\t\t\t'xhtml'     => $simplepie->sanitize( '<div><img src="javascript:alert(1)" /><span>ok</span></div>', \\SimplePie\\SimplePie::CONSTRUCT_XHTML ),
\t\t\t'maybeHtml' => $simplepie->sanitize( 'Tom &amp; <em>Jerry</em><script>x</script>', \\SimplePie\\SimplePie::CONSTRUCT_MAYBE_HTML ),
\t\t\t'base64'    => $simplepie->sanitize( base64_encode( '<strong>Hi</strong><script>x</script>' ), \\SimplePie\\SimplePie::CONSTRUCT_BASE64 | \\SimplePie\\SimplePie::CONSTRUCT_HTML ),
\t\t)
\t);

\treturn $cases;
}

$snapshot = array(
\t'mode'                  => $mode,
\t'phpVersion'            => PHP_VERSION,
\t'blogCharset'           => get_option( 'blog_charset' ),
\t'allowedProtocolCount'  => count( wp_allowed_protocols() ),
\t'coveredFunctionExists' => array(
\t\t'wp_kses'                         => function_exists( 'wp_kses' ),
\t\t'wp_kses_post'                    => function_exists( 'wp_kses_post' ),
\t\t'wp_kses_post_deep'               => function_exists( 'wp_kses_post_deep' ),
\t\t'wp_kses_allowed_html'            => function_exists( 'wp_kses_allowed_html' ),
\t\t'wp_kses_bad_protocol'            => function_exists( 'wp_kses_bad_protocol' ),
\t\t'wp_kses_normalize_entities'      => function_exists( 'wp_kses_normalize_entities' ),
\t\t'wp_kses_decode_entities'         => function_exists( 'wp_kses_decode_entities' ),
\t\t'wp_kses_no_null'                 => function_exists( 'wp_kses_no_null' ),
\t\t'wp_kses_hair'                    => function_exists( 'wp_kses_hair' ),
\t\t'wp_kses_hair_parse'              => function_exists( 'wp_kses_hair_parse' ),
\t\t'wp_kses_attr_parse'              => function_exists( 'wp_kses_attr_parse' ),
\t\t'wp_kses_attr'                    => function_exists( 'wp_kses_attr' ),
\t\t'wp_kses_one_attr'                => function_exists( 'wp_kses_one_attr' ),
\t\t'safecss_filter_attr'             => function_exists( 'safecss_filter_attr' ),
\t\t'WP_SimplePie_Sanitize_KSES'      => class_exists( 'WP_SimplePie_Sanitize_KSES' ),
\t\t'WP_HTML_Tag_Processor'           => class_exists( 'WP_HTML_Tag_Processor' ),
\t\t'WP_HTML_Decoder'                 => class_exists( 'WP_HTML_Decoder' ),
\t),
\t'cases'                 => wphx_303_05_run_cases(),
);

echo json_encode( $snapshot, JSON_UNESCAPED_SLASHES );
`
  );
}

function normalize(result) {
  return {
    blogCharset: result.blogCharset,
    allowedProtocolCount: result.allowedProtocolCount,
    coveredFunctionExists: result.coveredFunctionExists,
    cases: result.cases
  };
}

function runProbe(commandPath, runtimeId, mode, root) {
  const output = command(commandPath, [PROBE, mode, root, SIMPLEPIE_STUB]);
  return {
    id: `${runtimeId}:${mode}`,
    runtime: runtimeId,
    mode,
    command: `${commandPath} ${PROBE} ${mode} ${root} ${SIMPLEPIE_STUB}`,
    result: JSON.parse(output)
  };
}

function runDockerProbe(runtimeId, image, mode, root) {
  const dockerRoot = `/work/${root}`;
  const dockerStub = `/work/${SIMPLEPIE_STUB}`;
  const output = command("docker", ["run", "--rm", "-v", `${process.cwd()}:/work`, "-w", "/work", image, "php", PROBE, mode, dockerRoot, dockerStub]);
  return {
    id: `${runtimeId}:${mode}`,
    runtime: runtimeId,
    mode,
    command: `docker run --rm -v $PWD:/work -w /work ${image} php ${PROBE} ${mode} ${dockerRoot} ${dockerStub}`,
    image,
    result: JSON.parse(output)
  };
}

function compare(oracleResult, candidateResult) {
  const oracle = normalize(oracleResult);
  const candidate = normalize(candidateResult);
  return {
    matches: JSON.stringify(oracle) === JSON.stringify(candidate),
    oracle,
    candidate
  };
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-303-kses`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function compactRun(run) {
  const normalized = normalize(run.result);
  return {
    id: run.id,
    runtime: run.runtime,
    mode: run.mode,
    command: run.command,
    image: run.image,
    php_version: run.result.phpVersion,
    blog_charset: run.result.blogCharset,
    allowed_protocol_count: run.result.allowedProtocolCount,
    covered_function_count: Object.values(run.result.coveredFunctionExists).filter(Boolean).length,
    case_count: run.result.cases.length,
    case_ids: run.result.cases.map((entry) => entry.id),
    normalized_sha256: sha256(JSON.stringify(normalized))
  };
}

function compactComparison(comparison) {
  return {
    id: comparison.id,
    matches: comparison.matches,
    oracle_sha256: sha256(JSON.stringify(comparison.oracle)),
    candidate_sha256: sha256(JSON.stringify(comparison.candidate)),
    case_count: comparison.oracle.cases.length
  };
}

function nativeBoundaries() {
  return [
    {
      id: "html-api-tokenizer",
      reason:
        "WordPress 7.0 KSES attribute parsing delegates to WP_HTML_Tag_Processor and WP_HTML_Decoder; fixture roots load the upstream HTML API rather than replacing it with ad hoc parsing."
    },
    {
      id: "kses-global-allow-lists-and-hooks",
      reason:
        "Allowed tags, entities, protocols, and pre_kses/wp_kses_allowed_html filters are global PHP extension points that plugins and themes can mutate."
    },
    {
      id: "protocol-and-entity-normalization",
      reason:
        "Protocol stripping and entity normalization are security-sensitive string algorithms that must keep WordPress byte-level behavior across PHP runtimes."
    },
    {
      id: "css-sanitizer-allow-list",
      reason:
        "safecss_filter_attr() has its own property allow-list, URL checks, and custom-property rules that should remain a named boundary until owned by a Haxe candidate."
    },
    {
      id: "simplepie-sanitize-bridge",
      reason:
        "WP_SimplePie_Sanitize_KSES extends the upstream SimplePie sanitizer; this fixture stubs only the parent class and constants needed to exercise the WordPress KSES bridge."
    }
  ];
}

function ownershipManifest(manifestSha, upstreamDigest) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/kses-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "workset",
      name: "KSES differential fixture harness",
      area: "wp-includes/kses.php",
      public_contract:
        "WordPress 7.0 KSES HTML filtering, allow-list contexts, protocol stripping, entity normalization, attribute parsing, CSS filtering, and the SimplePie feed sanitizer bridge keep observable PHP behavior while the candidate side is still an oracle source mirror."
    },
    ownership_state: "external_oracle",
    upstream: {
      repo: UPSTREAM_ROOT,
      ref: WP_REF,
      paths: SOURCE_FILES,
      digest: upstreamDigest
    },
    owned_paths: ["tools/wp-core/run-kses-fixture.mjs", OUT, RECEIPT],
    generated_paths: [OUT_ROOT, OUT, OWNERSHIP, RECEIPT],
    native_boundaries: nativeBoundaries(),
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-303-kses",
        "npm run wp:core:wphx-303-kses:check",
        "npm run beads:validate",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-303-05-kses-fixture", "receipt:wphx-303-01-error-format-surface"],
      manifest_digest: manifestSha
    },
    notes:
      "This slice intentionally records an external-oracle fixture before porting KSES. Later Haxe ownership should start with pure decision/model helpers, then promote parser/CSS/protocol behavior only behind differential and fuzz gates."
  };
}

const lock = readJson("toolchain.lock.json");
const surface = readJson(SURFACE);
rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
writeSimplePieStub();
writeProbe();

const runs = [];
const comparisons = [];
const localOracle = runProbe("php", "local-php-cli", "oracle", ORACLE_ROOT);
const localCandidate = runProbe("php", "local-php-cli", "candidate", CANDIDATE_ROOT);
runs.push(localOracle, localCandidate);
comparisons.push({
  id: "local-php-cli",
  ...compare(localOracle.result, localCandidate.result)
});

const dockerVersion = maybeCommand("docker", ["info", "--format", "{{.ServerVersion}}"]);
const dockerImages = [
  ["docker-php-8.4-cli", `${lock.container_images.php_8_4_cli.repository}@${lock.container_images.php_8_4_cli.index_digest}`],
  ["docker-php-8.5-cli", `${lock.container_images.php_8_5_cli.repository}@${lock.container_images.php_8_5_cli.index_digest}`]
];
const skippedRuntimes = [];

if (dockerVersion) {
  for (const [runtimeId, image] of dockerImages) {
    const oracle = runDockerProbe(runtimeId, image, "oracle", ORACLE_ROOT);
    const candidate = runDockerProbe(runtimeId, image, "candidate", CANDIDATE_ROOT);
    runs.push(oracle, candidate);
    comparisons.push({
      id: runtimeId,
      ...compare(oracle.result, candidate.result)
    });
  }
} else {
  for (const [runtimeId, image] of dockerImages) {
    skippedRuntimes.push({
      id: runtimeId,
      image,
      reason: "docker server unavailable"
    });
  }
}

const failedComparisons = comparisons.filter((entry) => !entry.matches);
if (failedComparisons.length > 0) {
  console.error(JSON.stringify({ status: "failed", failedComparisons }, null, 2));
  process.exit(1);
}

const sourceUnits = SOURCE_FILES.map(sourceRecord);
const upstreamDigest = sha256(JSON.stringify(sourceUnits.map((unit) => ({ path: unit.path, sha256: unit.sha256 }))));
const manifest = {
  schema: "wphx.wp-core-kses-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-kses-fixture.mjs",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    simplepie_stub: inputRecord(SIMPLEPIE_STUB),
    source_units: sourceUnits,
    upstream_digest: upstreamDigest
  },
  fixture: {
    candidate_kind: "oracle_source_mirror",
    source_domain: surface.domains.find((domain) => domain.id === "kses")?.label ?? "KSES HTML filtering and protocol/entity handling",
    covered_symbols: COVERED_SYMBOLS,
    oracle_root: ORACLE_ROOT,
    candidate_root: CANDIDATE_ROOT,
    probe: {
      path: PROBE,
      sha256: sha256File(PROBE)
    },
    cases: FIXTURE_CASES,
    native_boundaries: nativeBoundaries()
  },
  runtimes: {
    local: {
      id: "local-php-cli",
      php_version: localOracle.result.phpVersion,
      executable: lock.tools.php_cli.executable
    },
    docker: dockerImages.map(([id, image]) => ({ id, image })),
    skipped: skippedRuntimes
  },
  runs: runs.map(compactRun),
  comparisons: comparisons.map(compactComparison),
  remaining_gaps: [
    {
      id: "haxe-candidate-not-yet-installed",
      owner: "WPHX-303",
      detail:
        "The candidate side is a copied WordPress oracle source tree. KSES should not move to Haxe until parser, CSS, protocol, and entity behavior has equivalent fixture and fuzz coverage."
    },
    {
      id: "full-simplepie-feed-stack-not-booted",
      owner: "WPHX-303/WPHX-Gutenberg",
      detail:
        "The fixture stubs the SimplePie parent class and constants to exercise the WordPress KSES bridge. Full feed registry, encoding conversion, and upstream SimplePie sanitizer parity remain broader integration coverage."
    },
    {
      id: "block-attribute-sanitizer-path",
      owner: "WPHX-303/WPHX-Gutenberg",
      detail:
        "This seed fixture does not load parse_blocks(), serialize_blocks(), or filter_block_kses(). Block attribute sanitization should be covered when the Gutenberg/block parser workset is linked."
    },
    {
      id: "broad-xss-corpus-and-upstream-phpunit",
      owner: "WPHX-303",
      detail:
        "The seed cases cover high-risk branches but are not a replacement for the full upstream KSES PHPUnit suite or a generated XSS regression corpus."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    candidate_kind: "oracle_source_mirror",
    covered_symbols: COVERED_SYMBOLS.length,
    fixture_cases: FIXTURE_CASES.length,
    comparisons: comparisons.length,
    skipped_runtimes: skippedRuntimes.length
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha, upstreamDigest), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-303-05-kses-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    {
      path: OUT,
      role: "KSES differential fixture manifest"
    },
    {
      path: OWNERSHIP,
      role: "external-oracle ownership manifest for KSES security boundaries"
    },
    {
      path: "tools/wp-core/run-kses-fixture.mjs",
      role: "fixture generator and check-mode validator"
    }
  ],
  verification_commands: [
    "npm run wp:core:wphx-303-kses",
    "npm run wp:core:wphx-303-kses:check",
    "npm run beads:validate",
    "npm run receipts:validate"
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
      covered_symbols: COVERED_SYMBOLS.length,
      fixture_cases: FIXTURE_CASES.length,
      comparisons: comparisons.length,
      skipped_runtimes: skippedRuntimes.length
    },
    null,
    2
  )
);
