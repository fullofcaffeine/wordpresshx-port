#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, join, relative } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-w91.3.1",
  external_ref: "WPHX-700.01",
  title: "Expand KSES security corpus and block/feed integration gates"
};
const OUT_ROOT = "build/security/wphx-700-01";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/security/wphx-700-01-kses-security-corpus.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-700-01-kses-security-corpus.v1.json";
const RECEIPT = "receipts/security/wphx-700-01-kses-security-corpus.v1.json";
const KSES_SEED = "manifests/wp-core/wphx-303-05-kses-fixture.v1.json";
const RECORDED_AT = "2026-06-20T23:05:00.000Z";
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
  "src/wp-includes/class-wp-block-parser-block.php",
  "src/wp-includes/class-wp-block-parser-frame.php",
  "src/wp-includes/class-wp-block-parser.php",
  "src/wp-includes/blocks.php",
  "src/wp-includes/kses.php",
  "src/wp-includes/formatting.php",
  "src/wp-includes/class-wp-simplepie-sanitize-kses.php"
];

const SOURCE_TREES = ["src/wp-includes/SimplePie"];

const COVERED_SYMBOLS = [
  "wp_kses",
  "wp_kses_post",
  "wp_kses_bad_protocol",
  "wp_kses_normalize_entities",
  "wp_kses_hair",
  "wp_kses_attr",
  "wp_kses_one_attr",
  "safecss_filter_attr",
  "parse_blocks",
  "serialize_blocks",
  "filter_block_content",
  "filter_block_kses",
  "filter_block_kses_value",
  "WP_SimplePie_Sanitize_KSES::sanitize",
  "SimplePie\\Registry",
  "SimplePie\\Sanitize",
  "SimplePie\\Misc::change_encoding"
];

const FIXTURE_CASES = [
  { id: "corpus:wp-kses-context-matrix", focus: "generated XSS corpus through post/data/custom KSES contexts" },
  { id: "corpus:protocol-recursion", focus: "encoded, nested, whitespace, and allowed protocol handling" },
  { id: "corpus:entity-boundaries", focus: "numeric, named, invalid, XML, and decode entity behavior" },
  { id: "corpus:html-api-attributes", focus: "HTML API attribute parser edge cases and single-attribute validation" },
  { id: "corpus:safecss-extended", focus: "CSS allow-list and unsafe value filtering" },
  { id: "blocks:filter-block-content", focus: "parse_blocks/filter_block_content/serialize_blocks block attribute sanitization" },
  { id: "blocks:filter-block-kses-direct", focus: "recursive parsed block attr sanitization including template-part tagName rules" },
  { id: "simplepie:registry-backed-bridge", focus: "real SimplePie registry creates WP bridge and exercises HTML, text, IRI, base64, and encoding branches" }
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

function walkFiles(root) {
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkFiles(path));
    } else if (entry.isFile()) {
      result.push(path);
    }
  }
  return result.sort();
}

function directoryRecord(path) {
  const root = upstreamPath(path);
  const files = walkFiles(root).map((file) => ({
    path: relative(root, file),
    bytes: statSync(file).size,
    sha256: sha256File(file)
  }));
  return {
    path,
    repo_path: root,
    file_count: files.length,
    bytes: files.reduce((total, file) => total + file.bytes, 0),
    digest: sha256(JSON.stringify(files.map((file) => ({ path: file.path, sha256: file.sha256 }))))
  };
}

function mirrorSources(root) {
  for (const path of SOURCE_FILES) {
    const target = mirrorPath(root, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(upstreamPath(path), target);
  }
  for (const path of SOURCE_TREES) {
    const target = mirrorPath(root, path);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(upstreamPath(path), target, { recursive: true });
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

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php

$mode = $argv[1];
$root = rtrim( $argv[2], '/\\\\' );

error_reporting( E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED );
ini_set( 'display_errors', '0' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'WP_CONTENT_DIR', $root . '/wp-content' );

$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['SERVER_PROTOCOL'] = 'HTTP/1.1';

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
require_once ABSPATH . WPINC . '/class-wp-block-parser.php';
require_once ABSPATH . WPINC . '/kses.php';
require_once ABSPATH . WPINC . '/formatting.php';
require_once ABSPATH . WPINC . '/blocks.php';
require_once ABSPATH . WPINC . '/SimplePie/autoloader.php';
require_once ABSPATH . WPINC . '/class-wp-simplepie-sanitize-kses.php';

function wphx_700_01_scalar( $value ) {
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
\t$string = (string) $value;
\t$is_utf8 = 1 === preg_match( '//u', $string );
\treturn array(
\t\t'type'   => 'string',
\t\t'value'  => $is_utf8 ? $string : null,
\t\t'isUtf8' => $is_utf8,
\t\t'hex'    => bin2hex( $string ),
\t\t'bytes'  => strlen( $string ),
\t\t'sha256' => hash( 'sha256', $string ),
\t);
}

function wphx_700_01_value( $value ) {
\tif ( is_array( $value ) ) {
\t\t$entries = array();
\t\tforeach ( $value as $key => $entry_value ) {
\t\t\t$entries[] = array(
\t\t\t\t'key'   => wphx_700_01_scalar( $key ),
\t\t\t\t'value' => wphx_700_01_value( $entry_value ),
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
\t\t\t'publicProperties' => wphx_700_01_value( get_object_vars( $value ) ),
\t\t);
\t}
\treturn wphx_700_01_scalar( $value );
}

function wphx_700_01_case( $id, $symbols, $value, $meta = array() ) {
\treturn array(
\t\t'id'      => $id,
\t\t'symbols' => $symbols,
\t\t'value'   => wphx_700_01_value( $value ),
\t\t'meta'    => $meta,
\t);
}

function wphx_700_01_block_summary( $blocks ) {
\t$summary = array();
\tforeach ( $blocks as $block ) {
\t\t$summary[] = array(
\t\t\t'blockName'       => $block['blockName'],
\t\t\t'attrCount'       => is_array( $block['attrs'] ) ? count( $block['attrs'] ) : null,
\t\t\t'attrs'           => $block['attrs'],
\t\t\t'innerBlockCount' => is_array( $block['innerBlocks'] ) ? count( $block['innerBlocks'] ) : null,
\t\t\t'innerHTMLBytes'  => strlen( $block['innerHTML'] ),
\t\t\t'innerHTMLSha256' => hash( 'sha256', $block['innerHTML'] ),
\t\t);
\t}
\treturn $summary;
}

function wphx_700_01_run_cases() {
\t$cases = array();
\t$protocols = wp_allowed_protocols();
\t$custom_allowed = array(
\t\t'a'    => array(
\t\t\t'href'   => true,
\t\t\t'title'  => true,
\t\t\t'data-*' => true,
\t\t),
\t\t'p'    => array(
\t\t\t'class'  => true,
\t\t\t'style'  => true,
\t\t\t'data-*' => true,
\t\t),
\t\t'span' => array(
\t\t\t'class'  => true,
\t\t\t'style'  => true,
\t\t\t'data-*' => true,
\t\t),
\t\t'img'  => array(
\t\t\t'alt' => true,
\t\t\t'src' => true,
\t\t),
\t);

\t$corpus = array(
\t\tarray( 'id' => 'script-tag-event-url', 'input' => '<p onclick="evil()">Hi<script>alert(1)</script><a href="javascript:alert(1)">bad</a></p>' ),
\t\tarray( 'id' => 'mixed-case-protocol', 'input' => '<a href="JaVaScRiPt:alert(1)" title="ok">mixed</a>' ),
\t\tarray( 'id' => 'entity-protocol', 'input' => '<a href="javascript&#x3a;alert(1)">entity</a>' ),
\t\tarray( 'id' => 'newline-protocol', 'input' => '<a href="jav&#x0A;ascript:alert(1)">newline</a>' ),
\t\tarray( 'id' => 'feed-recursion', 'input' => '<a href="feed:feed:javascript:alert(1)">feed</a>' ),
\t\tarray( 'id' => 'svg-script', 'input' => '<svg><script>alert(1)</script><circle onload="x"></circle></svg><strong>safe</strong>' ),
\t\tarray( 'id' => 'style-url-expression', 'input' => '<p style="color:red; width: expression(alert(1)); background-image:url(javascript:alert(1));">css</p>' ),
\t\tarray( 'id' => 'srcset-event', 'input' => '<img src="http://example.test/a.png" srcset="javascript:alert(1) 1x" onerror="bad()" alt="x" />' ),
\t\tarray( 'id' => 'bogus-comment', 'input' => '<!--><img src=x onerror=alert(1)>--><em>ok</em>' ),
\t\tarray( 'id' => 'nested-less-than', 'input' => '<<script>alert(1);//<</script><span data-info="<script>">ok</span>' ),
\t\tarray( 'id' => 'object-embed', 'input' => '<object data="javascript:alert(1)"><param name="movie" value="x"></object><a href="https://example.test/">ok</a>' ),
\t\tarray( 'id' => 'control-bytes', 'input' => "pre" . chr( 0 ) . "<a href=\\\"java" . chr( 1 ) . "script:alert(1)\\\">x</a>" ),
\t);
\t$corpus_results = array();
\tforeach ( $corpus as $entry ) {
\t\t$corpus_results[] = array(
\t\t\t'id'     => $entry['id'],
\t\t\t'input'  => $entry['input'],
\t\t\t'post'   => wp_kses( $entry['input'], 'post', $protocols ),
\t\t\t'data'   => wp_kses( $entry['input'], 'data', $protocols ),
\t\t\t'custom' => wp_kses( $entry['input'], $custom_allowed, $protocols ),
\t\t);
\t}
\t$cases[] = wphx_700_01_case(
\t\t'corpus:wp-kses-context-matrix',
\t\tarray( 'wp_kses', 'wp_kses_post' ),
\t\t$corpus_results,
\t\tarray( 'corpusCount' => count( $corpus ) )
\t);

\t$protocol_inputs = array(
\t\t'javascript:alert(1)',
\t\t'javascript:javascript:alert(1)',
\t\t'feed:javascript:alert(1)',
\t\t'feed:feed:javascript:alert(1)',
\t\t'jav&#x09;ascript:alert(1)',
\t\t'java%0ascript:alert(1)',
\t\t'http://example.test/path?x=1',
\t\t'https://example.test/path?x=1',
\t\t'mailto:user@example.test',
\t\t'cid:message-id',
\t\t' data:text/html,<svg/onload=alert(1)>',
\t\t'//example.test/protocol-relative',
\t);
\t$protocol_results = array();
\tforeach ( $protocol_inputs as $input ) {
\t\t$normalized = wp_kses_normalize_entities( $input );
\t\t$protocol_results[] = array(
\t\t\t'input'      => $input,
\t\t\t'normalized' => $normalized,
\t\t\t'output'     => wp_kses_bad_protocol( $normalized, $protocols ),
\t\t);
\t}
\t$cases[] = wphx_700_01_case(
\t\t'corpus:protocol-recursion',
\t\tarray( 'wp_kses_bad_protocol', 'wp_kses_normalize_entities' ),
\t\t$protocol_results
\t);

\t$entity_inputs = array(
\t\t'AT&T',
\t\t'&#00000000000058;',
\t\t'&#x0000003a;',
\t\t'&#xD800;',
\t\t'&#1114112;',
\t\t'&#x110000;',
\t\t'&#XYZZY;',
\t\t'&notin;',
\t\t'&NewLine;',
\t\t'&amp;#x3c;script&amp;#x3e;',
\t);
\t$entity_results = array();
\tforeach ( $entity_inputs as $input ) {
\t\t$entity_results[] = array(
\t\t\t'input'  => $input,
\t\t\t'html'   => wp_kses_normalize_entities( $input ),
\t\t\t'xml'    => wp_kses_normalize_entities( $input, 'xml' ),
\t\t\t'decode' => wp_kses_decode_entities( $input ),
\t\t);
\t}
\t$cases[] = wphx_700_01_case(
\t\t'corpus:entity-boundaries',
\t\tarray( 'wp_kses_normalize_entities', 'wp_kses_decode_entities' ),
\t\t$entity_results
\t);

\t$attribute_inputs = array(
\t\t'booleanAndDuplicate' => 'disabled class="form-control" id="first" id="second" data-id="5"',
\t\t'protocolAttrs'       => 'href="javascript:alert(1)" src="feed:javascript:alert(1)" title="safe"',
\t\t'entities'            => 'data-lazy="&lt;img&#00062;" title="Tom &amp; Jerry"',
\t\t'badQuotes'           => 'title="unclosed class="test" href="http://example.test"',
\t\t'complex'             => 'aria-label="Label" role="button" tabindex="0" data-wp-interactive="plugin"',
\t);
\t$attribute_results = array();
\tforeach ( $attribute_inputs as $id => $input ) {
\t\t$attribute_results[ $id ] = wp_kses_hair( $input, $protocols );
\t}
\t$attribute_results['parseValid'] = wp_kses_attr_parse( '<a title="hello" disabled href=# id="my_id">' );
\t$attribute_results['parseInvalid'] = wp_kses_attr_parse( '<a%%&&**>' );
\t$attribute_results['oneAttr'] = array(
\t\t'badHref'      => wp_kses_one_attr( 'href="javascript:alert(1)"', 'a' ),
\t\t'encodedHref'  => wp_kses_one_attr( 'href="javascript&#58;alert(1)"', 'a' ),
\t\t'eventHandler' => wp_kses_one_attr( 'onload="alert(1)"', 'img' ),
\t\t'safeData'     => wp_kses_one_attr( 'data-id="123"', 'a' ),
\t\t'style'        => wp_kses_one_attr( 'style="color:red; background:url(javascript:alert(1))"', 'span' ),
\t);
\t$cases[] = wphx_700_01_case(
\t\t'corpus:html-api-attributes',
\t\tarray( 'wp_kses_hair', 'wp_kses_attr_parse', 'wp_kses_one_attr' ),
\t\t$attribute_results
\t);

\t$css_inputs = array(
\t\t'mixedUnsafe'      => 'color: red; position: absolute; width: expression(alert(1)); background-image: url(javascript:alert(1)); text-align:center',
\t\t'customProperties' => '--wp--preset--color--primary: red; color: var(--wp--preset--color--primary); --bad:url(javascript:alert(1));',
\t\t'commentsEscapes'  => 'color:/*hidden*/red; background:\\\\75rl(https://example.test/a.png);',
\t\t'calcClamp'        => 'width: calc(100% - 2rem); margin: clamp(1rem, 2vw, 3rem); behavior:url(#default#VML);',
\t\t'gradient'         => 'background: linear-gradient(red, blue); list-style-image: url(javascript:alert(1));',
\t);
\t$css_results = array();
\tforeach ( $css_inputs as $id => $input ) {
\t\t$css_results[ $id ] = safecss_filter_attr( $input );
\t}
\t$cases[] = wphx_700_01_case(
\t\t'corpus:safecss-extended',
\t\tarray( 'safecss_filter_attr' ),
\t\t$css_results
\t);

\t$block_content = '<!-- wp:group {"caption":"<img src=x onerror=alert(1)>","url":"javascript:alert(1)","nested":{"<script>key</script>":"<a href=\\\"javascript:alert(1)\\\">bad</a>"}} --><div class="wp-block-group"><!-- wp:paragraph {"content":"<span onclick=\\\"bad()\\\">bad</span>","link":"feed:javascript:alert(1)"} --><p>Visible <a href="javascript:alert(1)">bad</a></p><!-- /wp:paragraph --></div><!-- /wp:group -->';
\t$parsed_blocks = parse_blocks( $block_content );
\t$filtered_block_content = filter_block_content( $block_content, 'post', $protocols );
\t$cases[] = wphx_700_01_case(
\t\t'blocks:filter-block-content',
\t\tarray( 'parse_blocks', 'filter_block_content', 'serialize_blocks' ),
\t\tarray(
\t\t\t'input'      => $block_content,
\t\t\t'parsed'     => wphx_700_01_block_summary( $parsed_blocks ),
\t\t\t'filtered'   => $filtered_block_content,
\t\t\t'reparsed'   => wphx_700_01_block_summary( parse_blocks( $filtered_block_content ) ),
\t\t\t'reserialized' => serialize_blocks( parse_blocks( $filtered_block_content ) ),
\t\t)
\t);

\t$parsed_block = array(
\t\t'blockName'    => 'core/template-part',
\t\t'attrs'        => array(
\t\t\t'tagName' => 'script',
\t\t\t'slug'    => '<img src=x onerror=alert(1)>',
\t\t\t'nested'  => array(
\t\t\t\t'<script>key</script>' => '<a href="javascript:alert(1)">bad</a>',
\t\t\t),
\t\t),
\t\t'innerBlocks'  => array(
\t\t\tarray(
\t\t\t\t'blockName'    => 'core/paragraph',
\t\t\t\t'attrs'        => array(
\t\t\t\t\t'content' => '<span onclick="bad()">nested</span>',
\t\t\t\t),
\t\t\t\t'innerBlocks'  => array(),
\t\t\t\t'innerHTML'    => '<p>Nested</p>',
\t\t\t\t'innerContent' => array( '<p>Nested</p>' ),
\t\t\t),
\t\t),
\t\t'innerHTML'    => '',
\t\t'innerContent' => array( null ),
\t);
\t$filtered_parsed_block = filter_block_kses( $parsed_block, 'post', $protocols );
\t$cases[] = wphx_700_01_case(
\t\t'blocks:filter-block-kses-direct',
\t\tarray( 'filter_block_kses', 'filter_block_kses_value', 'serialize_block' ),
\t\tarray(
\t\t\t'input'      => $parsed_block,
\t\t\t'filtered'   => $filtered_parsed_block,
\t\t\t'serialized' => serialize_block( $filtered_parsed_block ),
\t\t)
\t);

\t$registry = new \\SimplePie\\Registry();
\t$registered = $registry->register( \\SimplePie\\Sanitize::class, 'WP_SimplePie_Sanitize_KSES' );
\t$sanitizer = &$registry->create( \\SimplePie\\Sanitize::class );
\t$simplepie_results = array(
\t\t'registered' => $registered,
\t\t'createdClass' => get_class( $sanitizer ),
\t\t'html' => $sanitizer->sanitize( '<p onclick="x"><a href="javascript:alert(1)">bad</a><strong>ok</strong></p>', \\SimplePie\\SimplePie::CONSTRUCT_HTML ),
\t\t'xhtml' => $sanitizer->sanitize( '<div><img src="javascript:alert(1)" /><span>ok</span></div>', \\SimplePie\\SimplePie::CONSTRUCT_XHTML ),
\t\t'maybeHtml' => $sanitizer->sanitize( 'Tom &amp; <em>Jerry</em><script>x</script>', \\SimplePie\\SimplePie::CONSTRUCT_MAYBE_HTML ),
\t\t'base64Html' => $sanitizer->sanitize( base64_encode( '<strong>Hi</strong><script>x</script>' ), \\SimplePie\\SimplePie::CONSTRUCT_BASE64 | \\SimplePie\\SimplePie::CONSTRUCT_HTML ),
\t\t'parentText' => $sanitizer->sanitize( 'Plain text without markup & angle', \\SimplePie\\SimplePie::CONSTRUCT_MAYBE_HTML ),
\t\t'parentIri' => $sanitizer->sanitize( '../post?id=1&x=<tag>', \\SimplePie\\SimplePie::CONSTRUCT_IRI, 'https://example.test/feed/items/' ),
\t);
\t$sanitizer->output_encoding = 'ISO-8859-1';
\t$simplepie_results['htmlIso88591'] = $sanitizer->sanitize( '<p>Caf&eacute; <strong>ok</strong><script>x</script></p>', \\SimplePie\\SimplePie::CONSTRUCT_HTML );
\t$cases[] = wphx_700_01_case(
\t\t'simplepie:registry-backed-bridge',
\t\tarray( 'WP_SimplePie_Sanitize_KSES::sanitize', 'SimplePie\\\\Registry', 'SimplePie\\\\Sanitize', 'SimplePie\\\\Misc::change_encoding' ),
\t\t$simplepie_results
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
\t\t'wp_kses_bad_protocol'            => function_exists( 'wp_kses_bad_protocol' ),
\t\t'wp_kses_normalize_entities'      => function_exists( 'wp_kses_normalize_entities' ),
\t\t'wp_kses_hair'                    => function_exists( 'wp_kses_hair' ),
\t\t'wp_kses_attr'                    => function_exists( 'wp_kses_attr' ),
\t\t'wp_kses_one_attr'                => function_exists( 'wp_kses_one_attr' ),
\t\t'safecss_filter_attr'             => function_exists( 'safecss_filter_attr' ),
\t\t'parse_blocks'                    => function_exists( 'parse_blocks' ),
\t\t'serialize_blocks'                => function_exists( 'serialize_blocks' ),
\t\t'filter_block_content'            => function_exists( 'filter_block_content' ),
\t\t'filter_block_kses'               => function_exists( 'filter_block_kses' ),
\t\t'filter_block_kses_value'         => function_exists( 'filter_block_kses_value' ),
\t\t'WP_SimplePie_Sanitize_KSES'      => class_exists( 'WP_SimplePie_Sanitize_KSES' ),
\t\t'SimplePie\\\\Registry'             => class_exists( 'SimplePie\\\\Registry' ),
\t\t'SimplePie\\\\Sanitize'             => class_exists( 'SimplePie\\\\Sanitize' ),
\t\t'SimplePie\\\\Misc'                 => class_exists( 'SimplePie\\\\Misc' ),
\t\t'WP_HTML_Tag_Processor'           => class_exists( 'WP_HTML_Tag_Processor' ),
\t\t'WP_Block_Parser'                 => class_exists( 'WP_Block_Parser' ),
\t),
\t'cases'                 => wphx_700_01_run_cases(),
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
  const output = command(commandPath, [PROBE, mode, root]);
  return {
    id: `${runtimeId}:${mode}`,
    runtime: runtimeId,
    mode,
    command: `${commandPath} ${PROBE} ${mode} ${root}`,
    result: JSON.parse(output)
  };
}

function runDockerProbe(runtimeId, image, mode, root) {
  const dockerRoot = `/work/${root}`;
  const output = command("docker", ["run", "--rm", "-v", `${process.cwd()}:/work`, "-w", "/work", image, "php", PROBE, mode, dockerRoot]);
  return {
    id: `${runtimeId}:${mode}`,
    runtime: runtimeId,
    mode,
    command: `docker run --rm -v $PWD:/work -w /work ${image} php ${PROBE} ${mode} ${dockerRoot}`,
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
      throw new Error(`${path} is stale; run npm run security:kses-corpus`);
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
      id: "wordpress-html-api-parser",
      reason:
        "KSES attribute parsing depends on WP_HTML_Tag_Processor and WP_HTML_Decoder. Haxe ownership must either preserve those parser decisions or explicitly reuse the PHP-native parser boundary."
    },
    {
      id: "block-parser-and-serializer",
      reason:
        "Block attribute sanitization flows through parse_blocks(), filter_block_kses(), and serialize_blocks(), tying KSES security behavior to Gutenberg-compatible block serialization."
    },
    {
      id: "simplepie-registry-and-encoding",
      reason:
        "The feed sanitizer bridge is registered through the real SimplePie registry and exercises parent sanitizer text/IRI behavior plus Misc::change_encoding()."
    },
    {
      id: "css-and-protocol-security-allow-lists",
      reason:
        "safecss_filter_attr(), wp_kses_bad_protocol(), and entity normalization are security-sensitive allow-list algorithms whose byte-level behavior is preserved by this gate."
    }
  ];
}

function ownershipManifest(manifestSha, upstreamDigest) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:security/kses-security-corpus",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "workset",
      name: "KSES security corpus and block/feed integration gate",
      area: "wp-includes/kses.php + wp-includes/blocks.php + wp-includes/SimplePie",
      public_contract:
        "WordPress 7.0 KSES security filtering, block attribute sanitization, and the SimplePie feed sanitizer bridge keep observable behavior across local PHP and pinned Docker PHP runtimes before any KSES Haxe ownership promotion."
    },
    ownership_state: "external_oracle",
    upstream: {
      repo: UPSTREAM_ROOT,
      ref: WP_REF,
      paths: [...SOURCE_FILES, ...SOURCE_TREES],
      digest: upstreamDigest
    },
    owned_paths: ["tools/security/run-kses-security-corpus.mjs", OUT, RECEIPT],
    generated_paths: [OUT_ROOT, OUT, OWNERSHIP, RECEIPT],
    native_boundaries: nativeBoundaries(),
    verification: {
      oracle_commands: [
        "npm run security:kses-corpus",
        "npm run security:kses-corpus:check",
        "npm run beads:validate",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-700-01-kses-security-corpus", "receipt:wphx-303-05-kses-fixture"],
      manifest_digest: manifestSha
    },
    notes:
      "This gate is intentionally a promotion blocker rather than a Haxe candidate. KSES parser, CSS, protocol, block, and feed behavior should remain external-oracle owned until a later candidate passes this broader corpus."
  };
}

const lock = readJson("toolchain.lock.json");
rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
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
const sourceTrees = SOURCE_TREES.map(directoryRecord);
const upstreamDigest = sha256(
  JSON.stringify({
    files: sourceUnits.map((unit) => ({ path: unit.path, sha256: unit.sha256 })),
    trees: sourceTrees.map((unit) => ({ path: unit.path, digest: unit.digest }))
  })
);

const manifest = {
  schema: "wphx.security-kses-corpus.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/security/run-kses-security-corpus.mjs",
  inputs: {
    kses_seed_manifest: inputRecord(KSES_SEED),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    source_units: sourceUnits,
    source_trees: sourceTrees,
    upstream_digest: upstreamDigest
  },
  fixture: {
    candidate_kind: "oracle_source_mirror",
    covered_symbols: COVERED_SYMBOLS,
    oracle_root: ORACLE_ROOT,
    candidate_root: CANDIDATE_ROOT,
    probe: {
      path: PROBE,
      sha256: sha256File(PROBE)
    },
    cases: FIXTURE_CASES,
    native_boundaries: nativeBoundaries(),
    promotion_gate_for: ["KSES parser", "KSES CSS/protocol/entity algorithms", "block attribute sanitization", "SimplePie feed sanitizer bridge"]
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
      id: "candidate-still-oracle-mirror",
      owner: "future KSES Haxe promotion slice",
      detail:
        "This gate broadens parity/security coverage but does not install a Haxe candidate. A later candidate must pass this gate before claiming KSES ownership."
    },
    {
      id: "not-full-upstream-phpunit-suite",
      owner: "WPHX-700",
      detail:
        "The corpus combines generated security cases with block/feed integration paths. Full upstream PHPUnit import remains a larger parity task."
    },
    {
      id: "no-browser-editor-roundtrip",
      owner: "GutenbergHX/WPHX-400",
      detail:
        "Block serialization is covered through PHP parse/filter/serialize functions. Editor-side JavaScript serialization parity remains a Gutenberg/browser-platform gate."
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
  id: "receipt:wphx-700-01-kses-security-corpus",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    {
      path: OUT,
      role: "KSES security corpus and block/feed integration manifest"
    },
    {
      path: OWNERSHIP,
      role: "external-oracle ownership manifest for KSES promotion gate"
    },
    {
      path: "tools/security/run-kses-security-corpus.mjs",
      role: "security corpus generator and check-mode validator"
    }
  ],
  verification_commands: [
    "npm run security:kses-corpus",
    "npm run security:kses-corpus:check",
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
