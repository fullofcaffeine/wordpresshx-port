#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.9.2",
  external_ref: "WPHX-305.02",
  title: "Build prepare and escaping fixture harness"
};
const OUT_ROOT = "build/wp-core/wphx-305-02";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-305-02-wpdb-prepare-escaping-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-305-02-wpdb-prepare-escaping-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-305-02-wpdb-prepare-escaping-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-305-01-wpdb-surface.v1.json";
const RECORDED_AT = "2026-06-21T01:05:00.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const UPSTREAM_ROOT = "../wordpress-develop";

const SOURCE_FILES = [
  "src/wp-includes/class-wp-hook.php",
  "src/wp-includes/plugin.php",
  "src/wp-includes/class-wpdb.php",
  "src/wp-includes/formatting.php"
];

const COVERED_SYMBOLS = [
  "wpdb::prepare",
  "wpdb::_real_escape",
  "wpdb::_escape",
  "wpdb::escape",
  "wpdb::escape_by_ref",
  "wpdb::_weak_escape",
  "wpdb::quote_identifier",
  "wpdb::_escape_identifier_value",
  "wpdb::esc_like",
  "wpdb::placeholder_escape",
  "wpdb::add_placeholder_escape",
  "wpdb::remove_placeholder_escape",
  "esc_sql"
];

const FIXTURE_CASES = [
  { id: "prepare:null-query", symbol: "wpdb::prepare", focus: "null query returns null without touching placeholders" },
  { id: "prepare:basic-types", symbol: "wpdb::prepare", focus: "%i/%d/%s/%f placeholder parsing, identifier quoting, string quoting, and float normalization" },
  { id: "prepare:array-args", symbol: "wpdb::prepare", focus: "single array argument is unpacked like vsprintf()" },
  { id: "prepare:literal-percent", symbol: "wpdb::prepare", focus: "literal percent escaping and placeholder escape insertion" },
  { id: "prepare:numbered-formatted", symbol: "wpdb::prepare", focus: "numbered placeholders, padding, precision, and backward-compatible unquoted numbered strings" },
  { id: "prepare:identifier-conflict", symbol: "wpdb::prepare", focus: "same argument cannot be both identifier and value" },
  { id: "prepare:wrong-count", symbol: "wpdb::prepare", focus: "too few and too many arguments preserve WordPress return contracts" },
  { id: "prepare:unsupported-value", symbol: "wpdb::prepare", focus: "non-scalar values trigger doing_it_wrong and preserve old empty-string escaping behavior" },
  { id: "prepare:unsafe-unquoted-toggle", symbol: "wpdb::prepare", focus: "allow_unsafe_unquoted_parameters changes legacy percent/string quoting behavior" },
  { id: "escaping:esc-like-quote-identifier", symbol: "wpdb::esc_like/wpdb::quote_identifier", focus: "LIKE wildcard escaping and backtick identifier doubling" },
  { id: "escaping:esc-sql-scalar-array", symbol: "esc_sql", focus: "global esc_sql facade delegates to wpdb::_escape for scalar and nested array values" },
  { id: "escaping:escape-by-ref", symbol: "wpdb::escape_by_ref", focus: "by-reference scalar mutation and float no-op behavior" },
  { id: "escaping:real-escape-type-handling", symbol: "wpdb::_real_escape", focus: "documented no-connection scalar and non-scalar fallback behavior" },
  { id: "placeholder:roundtrip-filter", symbol: "wpdb::placeholder_escape", focus: "placeholder token insertion, removal, and query filter registration" }
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

register_shutdown_function(
\tfunction () {
\t\t$error = error_get_last();
\t\tif ( $error && in_array( $error['type'], array( E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR ), true ) ) {
\t\t\tfwrite( STDERR, json_encode( array( 'fatal' => $error ), JSON_UNESCAPED_SLASHES ) . PHP_EOL );
\t\t}
\t}
);

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'WP_DEBUG', false );
define( 'WP_DEBUG_DISPLAY', false );
define( 'WP_SETUP_CONFIG', true );
define( 'AUTH_SALT', 'wphx-305-02-auth-salt' );

$GLOBALS['wphx_305_02_events'] = array();

function wphx_305_02_event( $type, $payload = array() ) {
\t$GLOBALS['wphx_305_02_events'][] = array(
\t\t'type'    => $type,
\t\t'payload' => $payload,
\t);
}

if ( ! function_exists( 'wp_load_translations_early' ) ) {
\tfunction wp_load_translations_early() {
\t\twphx_305_02_event( 'wp_load_translations_early' );
\t}
}

if ( ! function_exists( '__' ) ) {
\tfunction __( $text, $domain = 'default' ) {
\t\treturn $text;
\t}
}

if ( ! function_exists( '_doing_it_wrong' ) ) {
\tfunction _doing_it_wrong( $function_name, $message, $version ) {
\t\twphx_305_02_event(
\t\t\t'doing_it_wrong',
\t\t\tarray(
\t\t\t\t'function' => $function_name,
\t\t\t\t'message'  => $message,
\t\t\t\t'version'  => $version,
\t\t\t)
\t\t);
\t\tif ( function_exists( 'do_action' ) ) {
\t\t\tdo_action( 'doing_it_wrong_run', $function_name, $message, $version );
\t\t}
\t}
}

if ( ! function_exists( '_deprecated_function' ) ) {
\tfunction _deprecated_function( $function_name, $version, $replacement = '' ) {
\t\twphx_305_02_event(
\t\t\t'deprecated_function',
\t\t\tarray(
\t\t\t\t'function'    => $function_name,
\t\t\t\t'version'     => $version,
\t\t\t\t'replacement' => $replacement,
\t\t\t)
\t\t);
\t}
}

require_once ABSPATH . WPINC . '/plugin.php';
require_once ABSPATH . WPINC . '/class-wpdb.php';
require_once ABSPATH . WPINC . '/formatting.php';

class WPHX_305_02_WPDB extends wpdb {
\tpublic function set_unsafe_unquoted_parameters( $value ) {
\t\t$property = new ReflectionProperty( wpdb::class, 'allow_unsafe_unquoted_parameters' );
\t\t$property->setAccessible( true );
\t\t$property->setValue( $this, (bool) $value );
\t}
}

$wpdb = new WPHX_305_02_WPDB( '', '', '', '' );
$wpdb->prefix = 'wp_';
$wpdb->users = 'wp_users';
$wpdb->posts = 'wp_posts';
$wpdb->postmeta = 'wp_postmeta';

function wphx_305_02_reset_events() {
\t$GLOBALS['wphx_305_02_events'] = array();
}

function wphx_305_02_placeholder() {
\tglobal $wpdb;
\treturn $wpdb->placeholder_escape();
}

function wphx_305_02_normalize_string( $value ) {
\t$placeholder = wphx_305_02_placeholder();
\tif ( '' !== $placeholder ) {
\t\t$value = str_replace( $placeholder, '{WPDB_PLACEHOLDER}', $value );
\t}
\treturn $value;
}

function wphx_305_02_scalar( $value ) {
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
\t$normalized = wphx_305_02_normalize_string( (string) $value );
\treturn array(
\t\t'type'   => 'string',
\t\t'value'  => $normalized,
\t\t'hex'    => bin2hex( $normalized ),
\t\t'bytes'  => strlen( $normalized ),
\t\t'sha256' => hash( 'sha256', $normalized ),
\t);
}

function wphx_305_02_value( $value ) {
\tif ( is_array( $value ) ) {
\t\t$entries = array();
\t\tforeach ( $value as $key => $entry_value ) {
\t\t\t$entries[] = array(
\t\t\t\t'key'   => wphx_305_02_scalar( $key ),
\t\t\t\t'value' => wphx_305_02_value( $entry_value ),
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
\t\t\t'type'       => 'object',
\t\t\t'class'      => get_class( $value ),
\t\t\t'properties' => wphx_305_02_value( get_object_vars( $value ) ),
\t\t);
\t}
\treturn wphx_305_02_scalar( $value );
}

function wphx_305_02_events() {
\t$events = array();
\tforeach ( $GLOBALS['wphx_305_02_events'] as $event ) {
\t\t$events[] = wphx_305_02_value( $event );
\t}
\treturn $events;
}

function wphx_305_02_case( $id, $symbol, $callback ) {
\twphx_305_02_reset_events();
\t$error = null;
\ttry {
\t\t$value = $callback();
\t} catch ( Throwable $throwable ) {
\t\t$error = array(
\t\t\t'class'   => get_class( $throwable ),
\t\t\t'message' => $throwable->getMessage(),
\t\t);
\t\t$value = null;
\t}
\treturn array(
\t\t'id'     => $id,
\t\t'symbol' => $symbol,
\t\t'value'  => wphx_305_02_value( $value ),
\t\t'error'  => null === $error ? null : wphx_305_02_value( $error ),
\t\t'events' => wphx_305_02_events(),
\t);
}

function wphx_305_02_run_cases() {
\tglobal $wpdb, $wp_filter;

\t$cases = array();

\t$cases[] = wphx_305_02_case(
\t\t'prepare:null-query',
\t\t'wpdb::prepare',
\t\tfunction () use ( $wpdb ) {
\t\t\treturn $wpdb->prepare( null );
\t\t}
\t);

\t$cases[] = wphx_305_02_case(
\t\t'prepare:basic-types',
\t\t'wpdb::prepare',
\t\tfunction () use ( $wpdb ) {
\t\t\treturn $wpdb->prepare(
\t\t\t\t'SELECT * FROM %i WHERE id = %d AND name = %s AND score > %f',
\t\t\t\t'wp_posts',
\t\t\t\t42,
\t\t\t\t\"O'Reilly\",
\t\t\t\t7.25
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_02_case(
\t\t'prepare:array-args',
\t\t'wpdb::prepare',
\t\tfunction () use ( $wpdb ) {
\t\t\treturn $wpdb->prepare(
\t\t\t\t'SELECT %s AS label, %d AS count, %i AS ident',
\t\t\t\tarray( 'alpha beta', 17, 'wp_users.user_login' )
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_02_case(
\t\t'prepare:literal-percent',
\t\t'wpdb::prepare',
\t\tfunction () use ( $wpdb ) {
\t\t\treturn array(
\t\t\t\t'prepared' => $wpdb->prepare(
\t\t\t\t\t\"UPDATE test_table SET string_column = '%%f is a float, %%d is an int %d, %%s is a string', field = %s\",
\t\t\t\t\t3,
\t\t\t\t\t'4'
\t\t\t\t),
\t\t\t\t'removed'  => $wpdb->remove_placeholder_escape(
\t\t\t\t\t$wpdb->prepare(
\t\t\t\t\t\t\"UPDATE test_table SET string_column = '%%f is a float, %%d is an int %d, %%s is a string', field = %s\",
\t\t\t\t\t\t3,
\t\t\t\t\t\t'4'
\t\t\t\t\t)
\t\t\t\t),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_02_case(
\t\t'prepare:numbered-formatted',
\t\t'wpdb::prepare',
\t\tfunction () use ( $wpdb ) {
\t\t\treturn array(
\t\t\t\t'numbered' => $wpdb->prepare( 'WHERE login = %1$s OR nicename = %1$s AND id = %2$05d', 'admin', 7 ),
\t\t\t\t'float'    => $wpdb->prepare( 'WHERE ratio > %.2f AND raw = %5s', 3.14159, 'xy' ),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_02_case(
\t\t'prepare:identifier-conflict',
\t\t'wpdb::prepare',
\t\tfunction () use ( $wpdb ) {
\t\t\treturn $wpdb->prepare( 'SELECT %1$i FROM wp_posts WHERE post_name = %1$s', 'post_title' );
\t\t}
\t);

\t$cases[] = wphx_305_02_case(
\t\t'prepare:wrong-count',
\t\t'wpdb::prepare',
\t\tfunction () use ( $wpdb ) {
\t\t\treturn array(
\t\t\t\t'tooFew'     => $wpdb->prepare( 'SELECT * FROM wp_users WHERE id = %d AND user_login = %s', 1 ),
\t\t\t\t'tooMany'    => $wpdb->prepare( 'SELECT * FROM wp_users WHERE id = %d', 1, 'extra' ),
\t\t\t\t'arrayWrong' => $wpdb->prepare( 'SELECT * FROM wp_users WHERE id = %d', array( 1, 'extra' ) ),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_02_case(
\t\t'prepare:unsupported-value',
\t\t'wpdb::prepare',
\t\tfunction () use ( $wpdb ) {
\t\t\treturn array(
\t\t\t\t'arrayValue'  => $wpdb->prepare( 'SELECT * FROM wp_users WHERE user_login = %s', array( 'admin' ) ),
\t\t\t\t'objectValue' => $wpdb->prepare( 'SELECT * FROM wp_users WHERE user_login = %s', new stdClass() ),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_02_case(
\t\t'prepare:unsafe-unquoted-toggle',
\t\t'wpdb::prepare',
\t\tfunction () use ( $wpdb ) {
\t\t\t$wpdb->set_unsafe_unquoted_parameters( true );
\t\t\t$allow = $wpdb->prepare( 'SELECT 9%%%s OR marker = %s', '7', 'safe' );
\t\t\t$wpdb->set_unsafe_unquoted_parameters( false );
\t\t\t$deny = $wpdb->prepare( 'SELECT 9%%%s OR marker = %s', '7', 'safe' );
\t\t\t$wpdb->set_unsafe_unquoted_parameters( true );
\t\t\treturn array( 'allow' => $allow, 'deny' => $deny );
\t\t}
\t);

\t$cases[] = wphx_305_02_case(
\t\t'escaping:esc-like-quote-identifier',
\t\t'wpdb::esc_like/wpdb::quote_identifier',
\t\tfunction () use ( $wpdb ) {
\t\t\treturn array(
\t\t\t\t'like'       => $wpdb->esc_like( 'a_b%c\\\\d' ),
\t\t\t\t'identifier' => $wpdb->quote_identifier( 'wp\`posts' ),
\t\t\t\t'prepare'    => $wpdb->prepare( 'SELECT * FROM %i WHERE post_title LIKE %s', 'wp\`posts', '%' . $wpdb->esc_like( '50% off_' ) . '%' ),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_02_case(
\t\t'escaping:esc-sql-scalar-array',
\t\t'esc_sql',
\t\tfunction () {
\t\t\treturn array(
\t\t\t\t'scalar' => esc_sql( \"O'Reilly 100%\" ),
\t\t\t\t'array'  => esc_sql(
\t\t\t\t\tarray(
\t\t\t\t\t\t'name'   => \"A'B\",
\t\t\t\t\t\t'nested' => array( 'like' => '50%_done' ),
\t\t\t\t\t)
\t\t\t\t),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_02_case(
\t\t'escaping:escape-by-ref',
\t\t'wpdb::escape_by_ref',
\t\tfunction () use ( $wpdb ) {
\t\t\t$string = \"A'B 50%\";
\t\t\t$float  = 1.25;
\t\t\t$wpdb->escape_by_ref( $string );
\t\t\t$wpdb->escape_by_ref( $float );
\t\t\treturn array( 'string' => $string, 'float' => $float );
\t\t}
\t);

\t$cases[] = wphx_305_02_case(
\t\t'escaping:real-escape-type-handling',
\t\t'wpdb::_real_escape',
\t\tfunction () use ( $wpdb ) {
\t\t\treturn array(
\t\t\t\t'null'        => $wpdb->_real_escape( null ),
\t\t\t\t'false'       => $wpdb->_real_escape( false ),
\t\t\t\t'true'        => $wpdb->_real_escape( true ),
\t\t\t\t'int'         => $wpdb->_real_escape( -1327 ),
\t\t\t\t'float'       => $wpdb->_real_escape( 25.52 ),
\t\t\t\t'string'      => $wpdb->_real_escape( \"foo'bar%\" ),
\t\t\t\t'emptyArray'  => $wpdb->_real_escape( array() ),
\t\t\t\t'objectValue' => $wpdb->_real_escape( new stdClass() ),
\t\t\t\t'weakEscape'  => $wpdb->escape( array( 'quote' => \"A'B\", 'nested' => array( 'slash' => 'a\\\\b' ) ) ),
\t\t\t);
\t\t}
\t);

\t$cases[] = wphx_305_02_case(
\t\t'placeholder:roundtrip-filter',
\t\t'wpdb::placeholder_escape',
\t\tfunction () use ( $wpdb, &$wp_filter ) {
\t\t\t$prepared = $wpdb->prepare( 'SELECT %% AS literal_percent, %s AS value', 'x%y' );
\t\t\treturn array(
\t\t\t\t'placeholder' => $wpdb->placeholder_escape(),
\t\t\t\t'prepared'    => $prepared,
\t\t\t\t'removed'     => $wpdb->remove_placeholder_escape( $prepared ),
\t\t\t\t'hasFilter'   => has_filter( 'query', array( $wpdb, 'remove_placeholder_escape' ) ),
\t\t\t\t'filterClass' => isset( $wp_filter['query'] ) ? get_class( $wp_filter['query'] ) : null,
\t\t\t);
\t\t}
\t);

\treturn $cases;
}

$snapshot = array(
\t'mode'                  => $mode,
\t'phpVersion'            => PHP_VERSION,
\t'coveredFunctionExists' => array(
\t\t'esc_sql' => function_exists( 'esc_sql' ),
\t),
\t'coveredMethodExists'   => array(
\t\t'prepare'                   => method_exists( $wpdb, 'prepare' ),
\t\t'_real_escape'              => method_exists( $wpdb, '_real_escape' ),
\t\t'_escape'                   => method_exists( $wpdb, '_escape' ),
\t\t'escape'                    => method_exists( $wpdb, 'escape' ),
\t\t'escape_by_ref'             => method_exists( $wpdb, 'escape_by_ref' ),
\t\t'_weak_escape'              => method_exists( $wpdb, '_weak_escape' ),
\t\t'quote_identifier'          => method_exists( $wpdb, 'quote_identifier' ),
\t\t'esc_like'                  => method_exists( $wpdb, 'esc_like' ),
\t\t'placeholder_escape'        => method_exists( $wpdb, 'placeholder_escape' ),
\t\t'add_placeholder_escape'    => method_exists( $wpdb, 'add_placeholder_escape' ),
\t\t'remove_placeholder_escape' => method_exists( $wpdb, 'remove_placeholder_escape' ),
\t),
\t'cases'                 => wphx_305_02_run_cases(),
);

echo json_encode( $snapshot, JSON_UNESCAPED_SLASHES );
`
  );
}

function normalize(result) {
  return {
    coveredFunctionExists: result.coveredFunctionExists,
    coveredMethodExists: result.coveredMethodExists,
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
  const oracleText = JSON.stringify(oracle);
  const candidateText = JSON.stringify(candidate);
  const matches = oracleText === candidateText;
  return {
    matches,
    oracle_sha256: sha256(oracleText),
    candidate_sha256: sha256(candidateText),
    oracle_case_count: oracle.cases.length,
    candidate_case_count: candidate.cases.length,
    ...(matches ? {} : { oracle, candidate })
  };
}

function runSummary(run) {
  const normalized = normalize(run.result);
  return {
    id: run.id,
    runtime: run.runtime,
    mode: run.mode,
    command: run.command,
    image: run.image ?? null,
    php_version: run.result.phpVersion,
    case_count: normalized.cases.length,
    result_sha256: sha256(JSON.stringify(normalized))
  };
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-305-prepare-escaping`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha, upstreamDigest) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wpdb-prepare-escaping-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "workset",
      name: "wpdb prepare/escaping differential fixture harness",
      area: "wp-includes",
      public_contract:
        "WordPress 7.0 wpdb SQL preparation, escaping, placeholder, identifier quoting, and esc_sql() behavior stay observable while the candidate side is still an oracle source mirror."
    },
    ownership_state: "external_oracle",
    upstream: {
      repo: UPSTREAM_ROOT,
      ref: WP_REF,
      paths: SOURCE_FILES,
      digest: upstreamDigest
    },
    owned_paths: ["tools/wp-core/run-wpdb-prepare-escaping-fixture.mjs", OUT, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-305-prepare-escaping",
        "npm run wp:core:wphx-305-prepare-escaping:check",
        "npm run beads:validate",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-305-02-wpdb-prepare-escaping-fixture"],
      manifest_digest: manifestSha
    },
    notes:
      "The candidate fixture root is an oracle source mirror for WPHX-305.02. The probe intentionally avoids live MySQL by exercising prepare/escaping behavior through wpdb's no-connection fallback and recording the native mysqli boundary as a later WPHX-305 gate."
  };
}

const lock = readJson("toolchain.lock.json");
const surface = readJson(SURFACE);
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
const upstreamDigest = sha256(JSON.stringify(sourceUnits.map((unit) => ({ path: unit.path, sha256: unit.sha256 }))));
const manifest = {
  schema: "wphx.wp-core-wpdb-prepare-escaping-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-wpdb-prepare-escaping-fixture.mjs",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    source_units: sourceUnits,
    upstream_digest: upstreamDigest
  },
  fixture: {
    candidate_kind: "oracle_source_mirror",
    source_domain: surface.domains.find((domain) => domain.id === "prepare_escaping")?.label ?? "SQL preparation and escaping",
    covered_symbols: COVERED_SYMBOLS,
    cases: FIXTURE_CASES,
    native_boundaries: [
      {
        id: "mysqli-real-escape",
        reason:
          "wpdb::_real_escape() normally delegates to mysqli_real_escape_string() when a live database handle exists. This fixture records the deterministic no-connection fallback; live mysqli escaping remains a later WPHX-305 database execution gate."
      },
      {
        id: "placeholder-escape-filter",
        reason:
          "wpdb::placeholder_escape() registers remove_placeholder_escape() on the native WordPress query filter. The fixture exercises this registration through the mirrored plugin API."
      },
      {
        id: "doing-it-wrong-diagnostics",
        reason:
          "Invalid placeholder and unsupported value cases call wp_load_translations_early(), __(), _doing_it_wrong(), and the doing_it_wrong_run hook. The probe stubs translation output but records diagnostics and hook emission."
      },
      {
        id: "php-reference-mutation",
        reason:
          "wpdb::escape_by_ref() mutates non-float values by PHP reference; Haxe candidates must preserve the public reference contract at the generated PHP boundary."
      }
    ],
    follow_up_owner: "WPHX-305.03/WPHX-305.04"
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
  run_summaries: runs.map(runSummary),
  trace_samples: [
    {
      id: "local-php-cli:oracle",
      runtime: "local-php-cli",
      mode: "oracle",
      result: normalize(localOracle.result)
    }
  ],
  comparisons,
  remaining_gaps: [
    {
      id: "haxe-candidate-not-yet-installed",
      owner: "WPHX-305",
      detail: "The candidate side is a copied WordPress oracle source tree until database helpers are promoted behind typed Haxe parity candidates."
    },
    {
      id: "live-mysqli-escape-not-yet-covered",
      owner: "WPHX-305.03/WPHX-305.04",
      detail: "This fixture avoids real MySQL. Query execution and mysqli-backed escaping need the database runtime harness before Haxe ownership."
    },
    {
      id: "query-filter-unescape-not-yet-executed-through-query",
      owner: "WPHX-305.03",
      detail: "The fixture verifies query-filter registration and remove_placeholder_escape() round trips, but full wpdb::query() filter execution belongs with query/result fixtures."
    },
    {
      id: "full-upstream-phpunit-not-yet-ported",
      owner: "WPHX-305",
      detail: "This fixture covers seed traces from the upstream db tests. Full upstream wpdb PHPUnit parity remains a domain-level closure requirement."
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
  id: "receipt:wphx-305-02-wpdb-prepare-escaping-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    {
      path: OUT,
      role: "wpdb prepare/escaping differential fixture manifest"
    },
    {
      path: OWNERSHIP,
      role: "external-oracle ownership manifest for the fixture harness"
    },
    {
      path: "tools/wp-core/run-wpdb-prepare-escaping-fixture.mjs",
      role: "fixture generator and check-mode validator"
    }
  ],
  verification_commands: [
    "npm run wp:core:wphx-305-prepare-escaping",
    "npm run wp:core:wphx-305-prepare-escaping:check",
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
