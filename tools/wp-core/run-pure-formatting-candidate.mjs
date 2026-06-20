#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { filesUnder } from "../wp-linker/original-path-linker.mjs";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.7.6",
  external_ref: "WPHX-303.06",
  title: "Promote first pure formatting helpers to Haxe parity candidates"
};
const HXML = "fixtures/wp-core/pure-formatting-candidate.hxml";
const OUT_ROOT = "build/wp-core/wphx-303-06";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-303-06-pure-formatting-candidate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-303-06-pure-formatting-candidate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-303-06-pure-formatting-candidate.v1.json";
const SURFACE = "manifests/wp-core/wphx-303-01-error-format-surface.v1.json";
const BASE_FIXTURE = "manifests/wp-core/wphx-303-02-escaping-sanitization-fixture.v1.json";
const RECORDED_AT = "2026-06-20T23:35:00.000Z";
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
  "src/wp-includes/kses.php",
  "src/wp-includes/formatting.php"
];

const HAXE_SOURCES = [
  HXML,
  "src/wphx/wp/formatting/PureFormatting.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/PureFormattingCandidateEntry.hx"
];

const PROMOTED_SYMBOLS = ["zeroise", "sanitize_key", "sanitize_hex_color", "sanitize_hex_color_no_hash"];

const FIXTURE_CASES = [
  {
    id: "specialchars:no-double-encode",
    symbol: "_wp_specialchars",
    focus: "entities and double_encode=false"
  },
  {
    id: "invalid-utf8:strip",
    symbol: "wp_check_invalid_utf8",
    focus: "invalid byte stripping versus empty-string failure mode"
  },
  {
    id: "esc-html:basic",
    symbol: "esc_html",
    focus: "HTML tag and ampersand escaping"
  },
  {
    id: "esc-html:filter",
    symbol: "esc_html",
    focus: "esc_html filter receives safe and original text"
  },
  {
    id: "esc-attr:quotes",
    symbol: "esc_attr",
    focus: "attribute quotes and angle brackets"
  },
  {
    id: "esc-js:quotes-newline",
    symbol: "esc_js",
    focus: "JavaScript string escaping"
  },
  {
    id: "esc-url:allowed",
    symbol: "esc_url",
    focus: "allowed URL cleanup and entity display context"
  },
  {
    id: "esc-url:disallowed-protocol",
    symbol: "esc_url",
    focus: "javascript protocol removal via KSES protocol guard"
  },
  {
    id: "esc-url-raw:storage-context",
    symbol: "esc_url_raw",
    focus: "raw URL cleanup for database/storage use"
  },
  {
    id: "sanitize-url:alias-contract",
    symbol: "sanitize_url",
    focus: "sanitize_url alias behavior for raw URL cleanup"
  },
  {
    id: "esc-url:filter",
    symbol: "esc_url",
    focus: "clean_url filter arguments"
  },
  {
    id: "sanitize-text-field:tags-newlines",
    symbol: "sanitize_text_field",
    focus: "tag removal and whitespace compaction"
  },
  {
    id: "sanitize-text-field:filter",
    symbol: "sanitize_text_field",
    focus: "sanitize_text_field filter arguments"
  },
  {
    id: "sanitize-textarea-field:preserve-newline",
    symbol: "sanitize_textarea_field",
    focus: "textarea newline preservation"
  },
  {
    id: "sanitize-key:mixed",
    symbol: "sanitize_key",
    focus: "lowercase key whitelist"
  },
  {
    id: "sanitize-key:filter",
    symbol: "sanitize_key",
    focus: "native sanitize_key filter boundary is preserved around the Haxe core"
  },
  {
    id: "sanitize-key:scalar-contract",
    symbol: "sanitize_key",
    focus: "scalar casting and non-scalar empty-string contract"
  },
  {
    id: "sanitize-title-with-dashes:save",
    symbol: "sanitize_title_with_dashes",
    focus: "slug punctuation and entity handling in save context"
  },
  {
    id: "sanitize-hex-color:valid-invalid",
    symbol: "sanitize_hex_color",
    focus: "valid color, missing hash, and invalid color contracts"
  },
  {
    id: "sanitize-hex-color:edge-cases",
    symbol: "sanitize_hex_color",
    focus: "empty string, uppercase digits, and invalid width contracts"
  },
  {
    id: "sanitize-hex-color-no-hash:valid-invalid",
    symbol: "sanitize_hex_color_no_hash",
    focus: "valid no-hash color and invalid false contract"
  },
  {
    id: "sanitize-hex-color-no-hash:edge-cases",
    symbol: "sanitize_hex_color_no_hash",
    focus: "empty string, repeated leading hash trimming, and invalid hash-only input"
  },
  {
    id: "zeroise:threshold",
    symbol: "zeroise",
    focus: "numeric string padding behavior"
  },
  {
    id: "zeroise:string-width",
    symbol: "zeroise",
    focus: "string number padding and no-op behavior when width is already satisfied"
  },
  {
    id: "wp-parse-str:nested",
    symbol: "wp_parse_str",
    focus: "PHP query parsing plus WordPress filter pass-through"
  }
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

function haxeBootstrapBlock() {
  return `if ( ! function_exists( 'wphx_303_06_bootstrap_haxe' ) ) {
\tfunction wphx_303_06_bootstrap_haxe() {
\t\tstatic $bootstrapped = false;
\t\tif ( $bootstrapped ) {
\t\t\treturn;
\t\t}
\t\t$bootstrapped = true;

\t\t$wphx_303_06_lib = dirname( __DIR__, 2 ) . '/haxe/lib';
\t\tset_include_path( get_include_path() . PATH_SEPARATOR . $wphx_303_06_lib );
\t\tspl_autoload_register(
\t\t\tfunction ( $class ) {
\t\t\t\t$file = stream_resolve_include_path( str_replace( '\\\\', '/', $class ) . '.php' );
\t\t\t\tif ( $file ) {
\t\t\t\t\tinclude_once $file;
\t\t\t\t}
\t\t\t}
\t\t);
\t\t\\php\\Boot::__hx__init();
\t}
}
wphx_303_06_bootstrap_haxe();
`;
}

function installBootstrap(formattingPhp) {
  const marker = "<?php\n";
  if (!formattingPhp.startsWith(marker)) {
    throw new Error("formatting.php did not start with an expected PHP open tag");
  }
  return `${marker}\n${haxeBootstrapBlock()}\n${formattingPhp.slice(marker.length)}`;
}

function replaceFunction(source, functionName, replacement) {
  const pattern = new RegExp(`function\\s+${functionName}\\s*\\(`, "m");
  const match = pattern.exec(source);
  if (!match) {
    throw new Error(`Unable to locate function ${functionName}`);
  }

  const openBrace = source.indexOf("{", match.index);
  if (openBrace === -1) {
    throw new Error(`Unable to locate opening brace for ${functionName}`);
  }

  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return `${source.slice(0, match.index)}${replacement}${source.slice(index + 1)}`;
      }
    }
  }
  throw new Error(`Unable to locate closing brace for ${functionName}`);
}

function transformCandidateFormatting() {
  const path = `${CANDIDATE_ROOT}/wp-includes/formatting.php`;
  let source = installBootstrap(readFileSync(path, "utf8"));
  source = replaceFunction(
    source,
    "sanitize_key",
    `function sanitize_key( $key ) {
\t$sanitized_key = '';

\tif ( is_scalar( $key ) ) {
\t\t$sanitized_key = \\wphx\\wp\\formatting\\PureFormatting::sanitizeKey( (string) $key );
\t}

\t/**
\t * Filters a sanitized key string.
\t *
\t * @since 3.0.0
\t *
\t * @param string $sanitized_key Sanitized key.
\t * @param string $key           The key prior to sanitization.
\t */
\treturn apply_filters( 'sanitize_key', $sanitized_key, $key );
}`
  );
  source = replaceFunction(
    source,
    "zeroise",
    `function zeroise( $number, $threshold ) {
\treturn \\wphx\\wp\\formatting\\PureFormatting::zeroise( (string) $number, (int) $threshold );
}`
  );
  source = replaceFunction(
    source,
    "sanitize_hex_color",
    `function sanitize_hex_color( $color ) {
\treturn \\wphx\\wp\\formatting\\PureFormatting::sanitizeHexColor( (string) $color );
}`
  );
  source = replaceFunction(
    source,
    "sanitize_hex_color_no_hash",
    `function sanitize_hex_color_no_hash( $color ) {
\treturn \\wphx\\wp\\formatting\\PureFormatting::sanitizeHexColorNoHash( (string) $color );
}`
  );
  writeFileSync(path, source);
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php

$mode = $argv[1];
$root = rtrim( $argv[2], '/\\\\' );

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
require_once ABSPATH . WPINC . '/kses.php';
require_once ABSPATH . WPINC . '/formatting.php';

function wphx_303_06_scalar( $value ) {
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

function wphx_303_06_value( $value ) {
\tif ( is_array( $value ) ) {
\t\t$entries = array();
\t\tforeach ( $value as $key => $entry_value ) {
\t\t\t$entries[] = array(
\t\t\t\t'key'   => wphx_303_06_scalar( $key ),
\t\t\t\t'value' => wphx_303_06_value( $entry_value ),
\t\t\t);
\t\t}
\t\treturn array(
\t\t\t'type'    => 'array',
\t\t\t'count'   => count( $value ),
\t\t\t'entries' => $entries,
\t\t);
\t}
\treturn wphx_303_06_scalar( $value );
}

function wphx_303_06_case( $id, $symbol, $value, $meta = array() ) {
\treturn array(
\t\t'id'     => $id,
\t\t'symbol' => $symbol,
\t\t'value'  => wphx_303_06_value( $value ),
\t\t'meta'   => $meta,
\t);
}

function wphx_303_06_run_cases() {
\t$cases = array();

\t$cases[] = wphx_303_06_case(
\t\t'specialchars:no-double-encode',
\t\t'_wp_specialchars',
\t\t_wp_specialchars( 'Tom &amp; <strong>"Jerry"</strong>', ENT_QUOTES, 'UTF-8', false )
\t);

\t$invalid = "valid-" . chr( 0xC3 ) . "(";
\t$cases[] = wphx_303_06_case(
\t\t'invalid-utf8:strip',
\t\t'wp_check_invalid_utf8',
\t\tarray(
\t\t\t'withoutStrip' => wp_check_invalid_utf8( $invalid, false ),
\t\t\t'withStrip'    => wp_check_invalid_utf8( $invalid, true ),
\t\t)
\t);

\t$cases[] = wphx_303_06_case( 'esc-html:basic', 'esc_html', esc_html( '<b>Tom & Jerry</b>' ) );

\t$esc_html_events = array();
\t$esc_html_filter = function ( $safe_text, $text ) use ( &$esc_html_events ) {
\t\t$esc_html_events[] = array(
\t\t\t'safe'     => $safe_text,
\t\t\t'original' => $text,
\t\t);
\t\treturn $safe_text . '|filtered';
\t};
\tadd_filter( 'esc_html', $esc_html_filter, 10, 2 );
\t$esc_html_filtered = esc_html( '<em>Filtered & ready</em>' );
\tremove_filter( 'esc_html', $esc_html_filter, 10 );
\t$cases[] = wphx_303_06_case(
\t\t'esc-html:filter',
\t\t'esc_html',
\t\t$esc_html_filtered,
\t\tarray( 'events' => $esc_html_events )
\t);

\t$cases[] = wphx_303_06_case( 'esc-attr:quotes', 'esc_attr', esc_attr( '"quoted" & <tag data-x=1>' ) );
\t$cases[] = wphx_303_06_case( 'esc-js:quotes-newline', 'esc_js', esc_js( "alert(\\\"x\\\")\\n'single'" ) );
\t$cases[] = wphx_303_06_case( 'esc-url:allowed', 'esc_url', esc_url( 'https://example.test/a path/?x=1&y=<tag>#frag' ) );
\t$cases[] = wphx_303_06_case( 'esc-url:disallowed-protocol', 'esc_url', esc_url( 'javascript:alert(1)' ) );
\t$cases[] = wphx_303_06_case( 'esc-url-raw:storage-context', 'esc_url_raw', esc_url_raw( 'https://example.test/a path/?x=1&y=<tag>#frag' ) );
\t$cases[] = wphx_303_06_case( 'sanitize-url:alias-contract', 'sanitize_url', sanitize_url( 'https://example.test/a path/?x=1&y=<tag>#frag' ) );

\t$clean_url_events = array();
\t$clean_url_filter = function ( $good_protocol_url, $original_url, $context ) use ( &$clean_url_events ) {
\t\t$clean_url_events[] = array(
\t\t\t'goodProtocolUrl' => $good_protocol_url,
\t\t\t'originalUrl'     => $original_url,
\t\t\t'context'         => $context,
\t\t);
\t\treturn $good_protocol_url;
\t};
\tadd_filter( 'clean_url', $clean_url_filter, 10, 3 );
\t$clean_url_filtered = esc_url( 'https://example.test/?a=1&b=2' );
\tremove_filter( 'clean_url', $clean_url_filter, 10 );
\t$cases[] = wphx_303_06_case(
\t\t'esc-url:filter',
\t\t'esc_url',
\t\t$clean_url_filtered,
\t\tarray( 'events' => $clean_url_events )
\t);

\t$cases[] = wphx_303_06_case(
\t\t'sanitize-text-field:tags-newlines',
\t\t'sanitize_text_field',
\t\tsanitize_text_field( "<strong>Hello</strong>\\n\\tWorld %41" )
\t);

\t$sanitize_text_events = array();
\t$sanitize_text_filter = function ( $filtered, $str ) use ( &$sanitize_text_events ) {
\t\t$sanitize_text_events[] = array(
\t\t\t'filtered' => $filtered,
\t\t\t'original' => $str,
\t\t);
\t\treturn $filtered . '|filtered';
\t};
\tadd_filter( 'sanitize_text_field', $sanitize_text_filter, 10, 2 );
\t$sanitize_text_filtered = sanitize_text_field( '<span>Filtered</span> Text' );
\tremove_filter( 'sanitize_text_field', $sanitize_text_filter, 10 );
\t$cases[] = wphx_303_06_case(
\t\t'sanitize-text-field:filter',
\t\t'sanitize_text_field',
\t\t$sanitize_text_filtered,
\t\tarray( 'events' => $sanitize_text_events )
\t);

\t$cases[] = wphx_303_06_case(
\t\t'sanitize-textarea-field:preserve-newline',
\t\t'sanitize_textarea_field',
\t\tsanitize_textarea_field( "<p>Line 1</p>\\nLine\\t2" )
\t);
\t$cases[] = wphx_303_06_case( 'sanitize-key:mixed', 'sanitize_key', sanitize_key( 'AbC_123-!@#' ) );

\t$sanitize_key_events = array();
\t$sanitize_key_filter = function ( $sanitized_key, $key ) use ( &$sanitize_key_events ) {
\t\t$sanitize_key_events[] = array(
\t\t\t'sanitized' => $sanitized_key,
\t\t\t'original'  => $key,
\t\t);
\t\treturn $sanitized_key . '-filtered';
\t};
\tadd_filter( 'sanitize_key', $sanitize_key_filter, 10, 2 );
\t$sanitize_key_filtered = sanitize_key( 'MiXeD_Key!?' );
\tremove_filter( 'sanitize_key', $sanitize_key_filter, 10 );
\t$cases[] = wphx_303_06_case(
\t\t'sanitize-key:filter',
\t\t'sanitize_key',
\t\t$sanitize_key_filtered,
\t\tarray( 'events' => $sanitize_key_events )
\t);
\t$cases[] = wphx_303_06_case(
\t\t'sanitize-key:scalar-contract',
\t\t'sanitize_key',
\t\tarray(
\t\t\t'array' => sanitize_key( array( 'x' ) ),
\t\t\t'false' => sanitize_key( false ),
\t\t\t'float' => sanitize_key( 123.45 ),
\t\t)
\t);

\t$cases[] = wphx_303_06_case(
\t\t'sanitize-title-with-dashes:save',
\t\t'sanitize_title_with_dashes',
\t\tsanitize_title_with_dashes( 'Tom &amp; Jerry: 50% <strong>Ready</strong>', '', 'save' )
\t);
\t$cases[] = wphx_303_06_case(
\t\t'sanitize-hex-color:valid-invalid',
\t\t'sanitize_hex_color',
\t\tarray(
\t\t\t'valid'       => sanitize_hex_color( '#aabbcc' ),
\t\t\t'missingHash' => sanitize_hex_color( 'aabbcc' ),
\t\t\t'invalid'     => sanitize_hex_color( '#xyzxyz' ),
\t\t)
\t);
\t$cases[] = wphx_303_06_case(
\t\t'sanitize-hex-color:edge-cases',
\t\t'sanitize_hex_color',
\t\tarray(
\t\t\t'empty' => sanitize_hex_color( '' ),
\t\t\t'uppercaseShort' => sanitize_hex_color( '#ABC' ),
\t\t\t'uppercaseLong' => sanitize_hex_color( '#AABBCC' ),
\t\t\t'tooShort' => sanitize_hex_color( '#ab' ),
\t\t\t'tooLong' => sanitize_hex_color( '#abcdef0' ),
\t\t)
\t);
\t$cases[] = wphx_303_06_case(
\t\t'sanitize-hex-color-no-hash:valid-invalid',
\t\t'sanitize_hex_color_no_hash',
\t\tarray(
\t\t\t'valid'    => sanitize_hex_color_no_hash( 'abc' ),
\t\t\t'prefixed' => sanitize_hex_color_no_hash( '#abcdef' ),
\t\t\t'invalid'  => sanitize_hex_color_no_hash( 'xyzxyz' ),
\t\t)
\t);
\t$cases[] = wphx_303_06_case(
\t\t'sanitize-hex-color-no-hash:edge-cases',
\t\t'sanitize_hex_color_no_hash',
\t\tarray(
\t\t\t'empty' => sanitize_hex_color_no_hash( '' ),
\t\t\t'multiHash' => sanitize_hex_color_no_hash( '###abc' ),
\t\t\t'hashOnly' => sanitize_hex_color_no_hash( '#' ),
\t\t\t'tooLong' => sanitize_hex_color_no_hash( 'abcdef0' ),
\t\t)
\t);
\t$cases[] = wphx_303_06_case( 'zeroise:threshold', 'zeroise', zeroise( 42, 5 ) );
\t$cases[] = wphx_303_06_case(
\t\t'zeroise:string-width',
\t\t'zeroise',
\t\tarray(
\t\t\t'stringNumber' => zeroise( '0042', 6 ),
\t\t\t'exactWidth' => zeroise( 5000, 4 ),
\t\t\t'alreadyWide' => zeroise( 5000, 2 ),
\t\t)
\t);

\t$wp_parse_str_result = array();
\twp_parse_str( 'a=1&a=2&nested[x]=Tom+%26+Jerry&empty=&encoded=%3Ctag%3E', $wp_parse_str_result );
\t$cases[] = wphx_303_06_case( 'wp-parse-str:nested', 'wp_parse_str', $wp_parse_str_result );

\treturn $cases;
}

$snapshot = array(
\t'mode'                  => $mode,
\t'phpVersion'            => PHP_VERSION,
\t'blogCharset'           => get_option( 'blog_charset' ),
\t'allowedProtocolCount'  => count( wp_allowed_protocols() ),
\t'coveredFunctionExists' => array(
\t\t'esc_html'                    => function_exists( 'esc_html' ),
\t\t'esc_attr'                    => function_exists( 'esc_attr' ),
\t\t'esc_url'                     => function_exists( 'esc_url' ),
\t\t'esc_js'                      => function_exists( 'esc_js' ),
\t\t'sanitize_text_field'         => function_exists( 'sanitize_text_field' ),
\t\t'sanitize_textarea_field'     => function_exists( 'sanitize_textarea_field' ),
\t\t'sanitize_key'                => function_exists( 'sanitize_key' ),
\t\t'sanitize_title_with_dashes'  => function_exists( 'sanitize_title_with_dashes' ),
\t\t'sanitize_hex_color'          => function_exists( 'sanitize_hex_color' ),
\t\t'sanitize_hex_color_no_hash'  => function_exists( 'sanitize_hex_color_no_hash' ),
\t\t'zeroise'                     => function_exists( 'zeroise' ),
\t\t'wp_parse_str'                => function_exists( 'wp_parse_str' ),
\t),
\t'promotedFunctionOrigins' => array(
\t\t'zeroise'                    => ( new ReflectionFunction( 'zeroise' ) )->getFileName(),
\t\t'sanitize_key'               => ( new ReflectionFunction( 'sanitize_key' ) )->getFileName(),
\t\t'sanitize_hex_color'         => ( new ReflectionFunction( 'sanitize_hex_color' ) )->getFileName(),
\t\t'sanitize_hex_color_no_hash' => ( new ReflectionFunction( 'sanitize_hex_color_no_hash' ) )->getFileName(),
\t),
\t'cases'                 => wphx_303_06_run_cases(),
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
      throw new Error(`${path} is stale; run npm run wp:core:wphx-303-pure-formatting`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha, upstreamDigest) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/pure-formatting-candidate",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "module",
      name: "pure formatting helper Haxe parity candidates",
      area: "wp-includes/formatting.php",
      public_contract:
        "WordPress-compatible global PHP functions remain callable with the same names/signatures while selected pure helper logic delegates to typed Haxe-generated PHP."
    },
    ownership_state: "haxe_parity_candidate",
    upstream: {
      repo: UPSTREAM_ROOT,
      ref: WP_REF,
      paths: ["src/wp-includes/formatting.php", "src/wp-includes/plugin.php", "src/wp-includes/class-wp-hook.php"],
      digest: upstreamDigest
    },
    owned_paths: [...HAXE_SOURCES, "tools/wp-core/run-pure-formatting-candidate.mjs", OUT, RECEIPT],
    generated_paths: [OUT_ROOT, OUT, OWNERSHIP, RECEIPT],
    bridge: {
      kind: "generated_shell",
      reason:
        "WordPress plugins and themes call reflection-visible global PHP functions; the candidate keeps that ABI and delegates only the pure helper core to Haxe.",
      bounded_by: [
        "generated candidate wp-includes/formatting.php shell",
        "WPHX-303.06 oracle comparison receipt",
        "native apply_filters boundary for sanitize_key"
      ]
    },
    removal_gate: {
      condition:
        "Promote from generated shell candidate to verified owned distribution only after formatting.php ownership/linker work proves reflection, include timing, and plugin compatibility at distribution surface.",
      owner_issue: "WPHX-303",
      target_state: "verified_haxe_owned"
    },
    smell_fixes: [
      {
        description:
          "Extracted the sanitize_key character whitelist and hex color validation from PHP regular expressions into explicit typed Haxe predicates.",
        compatibility_evidence: [
          "sanitize-key:mixed",
          "sanitize-key:filter",
          "sanitize-hex-color:valid-invalid",
          "sanitize-hex-color-no-hash:valid-invalid"
        ],
        behavior_policy: "no_observable_change"
      }
    ],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-303-pure-formatting",
        "npm run wp:core:wphx-303-pure-formatting:check",
        "npm run wp:core:wphx-303-escaping:check",
        "npm run haxe:escape-hatches:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-303-06-pure-formatting-candidate", "receipt:wphx-303-02-escaping-sanitization-fixture"],
      manifest_digest: manifestSha
    },
    notes:
      "wp_basename remains in the upstream mirror until path/suffix and multibyte filename cases get their own candidate fixture. This slice promotes the WPHX-303.02-covered pure helpers first."
  };
}

const lock = readJson("toolchain.lock.json");
const surface = readJson(SURFACE);
rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
command("haxe", [HXML]);
transformCandidateFormatting();
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
  schema: "wphx.wp-core-pure-formatting-candidate.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-pure-formatting-candidate.mjs",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    base_fixture_manifest: inputRecord(BASE_FIXTURE),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    hxml: inputRecord(HXML),
    haxe_sources: HAXE_SOURCES.map(inputRecord),
    source_units: sourceUnits,
    upstream_digest: upstreamDigest
  },
  fixture: {
    candidate_kind: "haxe_generated_pure_formatting_shell",
    source_domain: surface.domains.find((domain) => domain.id === "formatting_escaping")?.label ?? "formatting/escaping",
    promoted_symbols: PROMOTED_SYMBOLS,
    hxml: HXML,
    oracle_root: ORACLE_ROOT,
    candidate_root: CANDIDATE_ROOT,
    probe: {
      path: PROBE,
      sha256: sha256File(PROBE)
    },
    cases: FIXTURE_CASES,
    public_abi_policy: {
      generated_php_shells_keep_global_functions: true,
      function_signatures_preserved: true,
      haxe_core_uses_typed_helpers_without_dynamic: true,
      raw_php_syntax_code_used_in_haxe: false
    },
    native_boundaries: [
      {
        id: "sanitize-key-filter",
        reason: "sanitize_key exposes apply_filters('sanitize_key', ...); the candidate shell keeps this native PHP callback boundary around the typed Haxe whitelist core."
      },
      {
        id: "haxe-autoload-bootstrap",
        reason: "The candidate build root installs the Haxe PHP autoloader before formatting.php public functions delegate to generated classes."
      }
    ]
  },
  toolchain: {
    haxe_version: command("haxe", ["--version"]),
    locked_haxe_version: lock.tools.haxe.version,
    php_cli_version: command("php", ["-r", "echo PHP_VERSION;"]),
    docker_server_version: dockerVersion
  },
  build: {
    generated_haxe_files: filesUnder(HAXE_OUT),
    transformed_candidate_formatting: inputRecord(`${CANDIDATE_ROOT}/wp-includes/formatting.php`)
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
  runs,
  comparisons,
  remaining_gaps: [
    {
      id: "wp-basename-not-yet-promoted",
      owner: "WPHX-303",
      detail: "wp_basename needs path/suffix/multibyte fixture coverage before moving from the oracle mirror into Haxe."
    },
    {
      id: "formatting-distribution-surface-not-yet-verified",
      owner: "WPHX-303",
      detail: "This candidate proves behavior through the differential harness; full distribution ownership still needs linker/include/reflection compatibility receipts."
    },
    {
      id: "full-upstream-phpunit-not-yet-ported",
      owner: "WPHX-303",
      detail: "This fixture covers seed cases. Full formatting PHPUnit parity remains a domain-level closure requirement."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    candidate_kind: "haxe_generated_pure_formatting_shell",
    promoted_symbols: PROMOTED_SYMBOLS.length,
    fixture_cases: FIXTURE_CASES.length,
    comparisons: comparisons.length,
    skipped_runtimes: skippedRuntimes.length,
    oracle_behavior_matches_haxe_candidate: true
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha, upstreamDigest), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-303-06-pure-formatting-candidate",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    {
      path: OUT,
      role: "pure formatting Haxe candidate manifest"
    },
    {
      path: OWNERSHIP,
      role: "Haxe parity candidate ownership manifest"
    },
    {
      path: "tools/wp-core/run-pure-formatting-candidate.mjs",
      role: "candidate generator and oracle comparator"
    },
    {
      path: "src/wphx/wp/formatting/PureFormatting.hx",
      role: "typed Haxe pure formatting helper implementation"
    }
  ],
  verification_commands: [
    "npm run wp:core:wphx-303-pure-formatting",
    "npm run wp:core:wphx-303-pure-formatting:check",
    "npm run wp:core:wphx-303-escaping:check",
    "npm run haxe:escape-hatches:check",
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
      promoted_symbols: PROMOTED_SYMBOLS.length,
      fixture_cases: FIXTURE_CASES.length,
      comparisons: comparisons.length,
      skipped_runtimes: skippedRuntimes.length
    },
    null,
    2
  )
);
