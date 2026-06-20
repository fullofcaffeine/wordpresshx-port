#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.8.5",
  external_ref: "WPHX-304.05",
  title: "Build serialization, cache salt, and invalidation fixture harness"
};
const OUT_ROOT = "build/wp-core/wphx-304-05";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-304-05-serialization-cache-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-304-05-serialization-cache-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-304-05-serialization-cache-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-304-01-options-cache-surface.v1.json";
const RECORDED_AT = "2026-06-21T04:20:00.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const UPSTREAM_ROOT = "../wordpress-develop";

const SOURCE_FILES = [
  "src/wp-includes/class-wp-hook.php",
  "src/wp-includes/compat.php",
  "src/wp-includes/utf8.php",
  "src/wp-includes/load.php",
  "src/wp-includes/plugin.php",
  "src/wp-includes/cache.php",
  "src/wp-includes/cache-compat.php",
  "src/wp-includes/class-wp-object-cache.php",
  "src/wp-includes/option.php",
  "src/wp-includes/functions.php"
];

const COVERED_SYMBOLS = [
  "maybe_serialize",
  "maybe_unserialize",
  "is_serialized",
  "is_serialized_string",
  "wp_suspend_cache_addition",
  "wp_suspend_cache_invalidation",
  "wp_cache_get_last_changed",
  "wp_cache_set_last_changed",
  "wp_cache_get_salted",
  "wp_cache_set_salted",
  "wp_cache_get_multiple_salted",
  "wp_cache_set_multiple_salted"
];

const FIXTURE_CASES = [
  { id: "serialization:maybe-serialize-scalars", symbol: "maybe_serialize", focus: "scalar passthrough and already-serialized scalar double serialization" },
  { id: "serialization:maybe-serialize-compound", symbol: "maybe_serialize", focus: "arrays, objects, nested false/null values, and enum serialization strings" },
  { id: "serialization:maybe-unserialize", symbol: "maybe_unserialize", focus: "valid serialized values, false/null ambiguity, trim behavior, invalid strings, and double-serialized payloads" },
  { id: "serialization:is-serialized-strict", symbol: "is_serialized", focus: "strict token grammar for null, bool, int, double, string, array, object, enum, and invalid values" },
  { id: "serialization:is-serialized-loose", symbol: "is_serialized", focus: "loose mode trailing content, early delimiter rejection, and non-string rejection" },
  { id: "serialization:is-serialized-string", symbol: "is_serialized_string", focus: "serialized string token checks versus arrays, booleans, truncated values, and non-strings" },
  { id: "cache:last-changed-hooks", symbol: "wp_cache_get_last_changed/wp_cache_set_last_changed", focus: "last_changed cache creation, update, hook arguments, previous-time contract, and cache storage shape" },
  { id: "cache:salted-helpers", symbol: "wp_cache_get_salted/wp_cache_set_salted/wp_cache_get_multiple_salted/wp_cache_set_multiple_salted", focus: "salt/data envelope storage, array salt normalization, stale salt rejection, malformed entry rejection, and group salt invalidation" },
  { id: "cache:suspend-flags", symbol: "wp_suspend_cache_addition/wp_suspend_cache_invalidation", focus: "addition static flag return contract and invalidation global previous/current value behavior" }
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

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'WP_CONTENT_DIR', $root . '/wp-content' );
define( 'WP_DEBUG', false );

require_once ABSPATH . WPINC . '/compat.php';
require_once ABSPATH . WPINC . '/utf8.php';
require_once ABSPATH . WPINC . '/load.php';
require_once ABSPATH . WPINC . '/plugin.php';
require_once ABSPATH . WPINC . '/cache.php';
require_once ABSPATH . WPINC . '/cache-compat.php';
require_once ABSPATH . WPINC . '/functions.php';

enum WPHX_304_05_Unit_Enum {
\tcase Alpha;
}

wp_cache_init();
$GLOBALS['_wp_suspend_cache_invalidation'] = false;

function wphx_304_05_is_microtime( $value ) {
\treturn is_string( $value ) && 1 === preg_match( '/^0\\.[0-9]+ [0-9]+$/', $value );
}

function wphx_304_05_normalized_microtime_string( $value ) {
\tif ( wphx_304_05_is_microtime( $value ) ) {
\t\treturn '__microtime__';
\t}
\tif ( is_string( $value ) && 1 === preg_match( '/^0\\.[0-9]+ [0-9]+(:.*)$/', $value, $matches ) ) {
\t\treturn '__microtime__' . $matches[1];
\t}
\treturn null;
}

function wphx_304_05_scalar( $value ) {
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
\t$normalized_microtime = wphx_304_05_normalized_microtime_string( $value );
\tif ( null !== $normalized_microtime ) {
\t\treturn array( 'type' => 'string', 'value' => $normalized_microtime, 'format' => 'msec sec' );
\t}
\treturn array(
\t\t'type'   => 'string',
\t\t'value'  => (string) $value,
\t\t'hex'    => bin2hex( (string) $value ),
\t\t'bytes'  => strlen( (string) $value ),
\t\t'sha256' => hash( 'sha256', (string) $value ),
\t);
}

function wphx_304_05_value( $value ) {
\tif ( is_array( $value ) ) {
\t\t$entries = array();
\t\tforeach ( $value as $key => $entry_value ) {
\t\t\t$entries[] = array(
\t\t\t\t'key'   => wphx_304_05_scalar( $key ),
\t\t\t\t'value' => wphx_304_05_value( $entry_value ),
\t\t\t);
\t\t}
\t\treturn array(
\t\t\t'type'    => 'array',
\t\t\t'count'   => count( $value ),
\t\t\t'entries' => $entries,
\t\t);
\t}
\tif ( is_object( $value ) ) {
\t\tif ( $value instanceof UnitEnum ) {
\t\t\treturn array(
\t\t\t\t'type'  => 'enum',
\t\t\t\t'class' => get_class( $value ),
\t\t\t\t'name'  => $value->name,
\t\t\t);
\t\t}
\t\treturn array(
\t\t\t'type'       => 'object',
\t\t\t'class'      => get_class( $value ),
\t\t\t'properties' => wphx_304_05_value( get_object_vars( $value ) ),
\t\t);
\t}
\treturn wphx_304_05_scalar( $value );
}

function wphx_304_05_meta_value( $value ) {
\tif ( is_array( $value ) ) {
\t\t$result = array();
\t\tforeach ( $value as $key => $entry ) {
\t\t\t$result[ $key ] = wphx_304_05_meta_value( $entry );
\t\t}
\t\treturn $result;
\t}
\tif ( is_object( $value ) ) {
\t\tif ( $value instanceof UnitEnum ) {
\t\t\treturn array( 'enum' => get_class( $value ) . '::' . $value->name );
\t\t}
\t\treturn array( 'class' => get_class( $value ), 'properties' => wphx_304_05_meta_value( get_object_vars( $value ) ) );
\t}
\t$normalized_microtime = wphx_304_05_normalized_microtime_string( $value );
\tif ( null !== $normalized_microtime ) {
\t\treturn $normalized_microtime;
\t}
\treturn $value;
}

function wphx_304_05_case( $id, $symbol, $value, $meta = array() ) {
\treturn array(
\t\t'id'     => $id,
\t\t'symbol' => $symbol,
\t\t'value'  => wphx_304_05_value( $value ),
\t\t'meta'   => wphx_304_05_meta_value( $meta ),
\t);
}

function wphx_304_05_sort_deep( $value ) {
\tif ( ! is_array( $value ) ) {
\t\treturn $value;
\t}
\tforeach ( $value as $key => $entry ) {
\t\t$value[ $key ] = wphx_304_05_sort_deep( $entry );
\t}
\tksort( $value );
\treturn $value;
}

function wphx_304_05_cache_snapshot( $groups ) {
\t$result = array();
\tforeach ( $groups as $group => $keys ) {
\t\tforeach ( $keys as $key ) {
\t\t\t$result[ $group ][ $key ] = wphx_304_05_meta_value( wp_cache_get( $key, $group ) );
\t\t}
\t}
\tksort( $result );
\treturn $result;
}

function wphx_304_05_reset_state() {
\tglobal $wp_filter, $_wp_suspend_cache_invalidation;
\t$wp_filter = array();
\twp_suspend_cache_addition( false );
\t$_wp_suspend_cache_invalidation = false;
\twp_cache_init();
}

function wphx_304_05_run_cases() {
\t$cases = array();

\twphx_304_05_reset_state();
\t$already_serialized_string = 's:5:"hello";';
\t$cases[] = wphx_304_05_case(
\t\t'serialization:maybe-serialize-scalars',
\t\t'maybe_serialize',
\t\tarray(
\t\t\t'string'                  => maybe_serialize( 'plain' ),
\t\t\t'int'                     => maybe_serialize( 42 ),
\t\t\t'float'                   => maybe_serialize( 2.5 ),
\t\t\t'boolTrue'                => maybe_serialize( true ),
\t\t\t'boolFalse'               => maybe_serialize( false ),
\t\t\t'null'                    => maybe_serialize( null ),
\t\t\t'alreadySerializedString' => maybe_serialize( $already_serialized_string ),
\t\t\t'alreadySerializedBool'   => maybe_serialize( 'b:0;' ),
\t\t),
\t\tarray( 'doubleSerializedInput' => $already_serialized_string )
\t);

\twphx_304_05_reset_state();
\t$object = (object) array( 'name' => 'object-name', 'enabled' => true );
\t$compound = array( 'alpha' => 1, 'false' => false, 'null' => null, 'nested' => array( 'beta' => 'two' ) );
\t$enum_serialized = serialize( WPHX_304_05_Unit_Enum::Alpha );
\t$cases[] = wphx_304_05_case(
\t\t'serialization:maybe-serialize-compound',
\t\t'maybe_serialize',
\t\tarray(
\t\t\t'array'             => maybe_serialize( $compound ),
\t\t\t'object'            => maybe_serialize( $object ),
\t\t\t'enumSerialized'    => $enum_serialized,
\t\t\t'enumIsSerialized'  => is_serialized( $enum_serialized ),
\t\t),
\t\tarray( 'compoundInput' => $compound, 'objectInput' => $object )
\t);

\twphx_304_05_reset_state();
\t$double = maybe_serialize( 's:5:"hello";' );
\t$cases[] = wphx_304_05_case(
\t\t'serialization:maybe-unserialize',
\t\t'maybe_unserialize',
\t\tarray(
\t\t\t'array'            => maybe_unserialize( serialize( array( 'k' => 'v', 'flag' => false ) ) ),
\t\t\t'object'           => maybe_unserialize( serialize( (object) array( 'x' => 3 ) ) ),
\t\t\t'false'            => maybe_unserialize( 'b:0;' ),
\t\t\t'null'             => maybe_unserialize( 'N;' ),
\t\t\t'trimmedString'    => maybe_unserialize( '  s:5:"hello";  ' ),
\t\t\t'invalidString'    => maybe_unserialize( 's:5:"hello"; trailing' ),
\t\t\t'plainString'      => maybe_unserialize( 'not serialized' ),
\t\t\t'doubleSerialized' => maybe_unserialize( $double ),
\t\t),
\t\tarray( 'doubleSerializedStorage' => $double )
\t);

\twphx_304_05_reset_state();
\t$serialized_enum = serialize( WPHX_304_05_Unit_Enum::Alpha );
\t$strict_inputs = array(
\t\t'null'       => 'N;',
\t\t'boolFalse'  => 'b:0;',
\t\t'int'        => 'i:123;',
\t\t'double'     => 'd:1.25;',
\t\t'string'     => 's:5:"hello";',
\t\t'array'      => 'a:1:{s:1:"k";s:1:"v";}',
\t\t'object'     => 'O:8:"stdClass":0:{}',
\t\t'enum'       => $serialized_enum,
\t\t'trailing'   => 's:5:"hello"; trailing',
\t\t'truncated'  => 's:5:"hello"',
\t\t'nonString'  => array( 'not' => 'string' ),
\t);
\t$strict_results = array();
\tforeach ( $strict_inputs as $name => $input ) {
\t\t$strict_results[ $name ] = is_serialized( $input, true );
\t}
\t$cases[] = wphx_304_05_case(
\t\t'serialization:is-serialized-strict',
\t\t'is_serialized',
\t\t$strict_results,
\t\tarray( 'enumInput' => $serialized_enum )
\t);

\twphx_304_05_reset_state();
\t$loose_inputs = array(
\t\t'validString'       => 's:5:"hello";',
\t\t'trailingString'    => 's:5:"hello"; trailing',
\t\t'trailingArray'     => 'a:1:{s:1:"k";s:1:"v";} trailing',
\t\t'missingDelimiter'  => 's:5:"hello"',
\t\t'earlySemicolon'    => 'b;0;',
\t\t'earlyBrace'        => 'a:}',
\t\t'nonString'         => 123,
\t);
\t$loose_results = array();
\tforeach ( $loose_inputs as $name => $input ) {
\t\t$loose_results[ $name ] = is_serialized( $input, false );
\t}
\t$cases[] = wphx_304_05_case(
\t\t'serialization:is-serialized-loose',
\t\t'is_serialized',
\t\t$loose_results,
\t\tarray( 'inputs' => $loose_inputs )
\t);

\twphx_304_05_reset_state();
\t$string_inputs = array(
\t\t'string'          => 's:5:"hello";',
\t\t'emptyString'     => 's:0:"";',
\t\t'array'           => 'a:1:{s:1:"k";s:1:"v";}',
\t\t'bool'            => 'b:0;',
\t\t'trailing'        => 's:5:"hello"; trailing',
\t\t'missingQuote'    => 's:5:"hello;',
\t\t'nonString'       => false,
\t);
\t$string_results = array();
\tforeach ( $string_inputs as $name => $input ) {
\t\t$string_results[ $name ] = is_serialized_string( $input );
\t}
\t$cases[] = wphx_304_05_case(
\t\t'serialization:is-serialized-string',
\t\t'is_serialized_string',
\t\t$string_results,
\t\tarray( 'inputs' => $string_inputs )
\t);

\twphx_304_05_reset_state();
\t$events = array();
\tadd_action(
\t\t'wp_cache_set_last_changed',
\t\tfunction ( $group, $time, $previous_time ) use ( &$events ) {
\t\t\t$events[] = array(
\t\t\t\t'group'          => $group,
\t\t\t\t'time'           => $time,
\t\t\t\t'previousTime'   => $previous_time,
\t\t\t\t'timeIsFormat'   => wphx_304_05_is_microtime( $time ),
\t\t\t\t'previousExists' => false !== $previous_time,
\t\t\t);
\t\t},
\t\t10,
\t\t3
\t);
\t$first = wp_cache_get_last_changed( 'posts' );
\t$second_get = wp_cache_get_last_changed( 'posts' );
\t$manual_set = wp_cache_set_last_changed( 'posts' );
\t$after_set = wp_cache_get_last_changed( 'posts' );
\t$cases[] = wphx_304_05_case(
\t\t'cache:last-changed-hooks',
\t\t'wp_cache_get_last_changed/wp_cache_set_last_changed',
\t\tarray(
\t\t\t'firstIsFormat'        => wphx_304_05_is_microtime( $first ),
\t\t\t'secondGetSameAsFirst' => $second_get === $first,
\t\t\t'manualSetIsFormat'    => wphx_304_05_is_microtime( $manual_set ),
\t\t\t'afterSetSameAsManual' => $after_set === $manual_set,
\t\t\t'firstEqualsManualSet' => $first === $manual_set,
\t\t\t'events'               => $events,
\t\t),
\t\tarray(
\t\t\t'first'    => $first,
\t\t\t'manual'   => $manual_set,
\t\t\t'snapshot' => wphx_304_05_cache_snapshot( array( 'posts' => array( 'last_changed' ) ) ),
\t\t)
\t);

\twphx_304_05_reset_state();
\t$salt_one = wp_cache_get_last_changed( 'terms' );
\t$set_single = wp_cache_set_salted( 'term-list', array( 'ids' => array( 1, 2 ) ), 'terms', $salt_one, 30 );
\t$fresh_single = wp_cache_get_salted( 'term-list', 'terms', $salt_one );
\t$salt_two = wp_cache_set_last_changed( 'terms' );
\t$stale_single = wp_cache_get_salted( 'term-list', 'terms', $salt_two );
\twp_cache_set( 'malformed', array( 'data' => 'missing salt' ), 'terms' );
\t$malformed = wp_cache_get_salted( 'malformed', 'terms', $salt_one );
\t$multi_salt = array( $salt_two, 'secondary' );
\t$set_many = wp_cache_set_multiple_salted( array( 'a' => 'A', 'b' => false ), 'terms', $multi_salt, 45 );
\t$fresh_many = wp_cache_get_multiple_salted( array( 'a', 'b', 'missing' ), 'terms', $multi_salt );
\t$stale_many = wp_cache_get_multiple_salted( array( 'a', 'b' ), 'terms', array( $salt_one, 'secondary' ) );
\t$cases[] = wphx_304_05_case(
\t\t'cache:salted-helpers',
\t\t'wp_cache_get_salted/wp_cache_set_salted/wp_cache_get_multiple_salted/wp_cache_set_multiple_salted',
\t\tarray(
\t\t\t'setSingle'   => $set_single,
\t\t\t'freshSingle' => $fresh_single,
\t\t\t'staleSingle' => $stale_single,
\t\t\t'malformed'   => $malformed,
\t\t\t'setMany'     => $set_many,
\t\t\t'freshMany'   => $fresh_many,
\t\t\t'staleMany'   => $stale_many,
\t\t),
\t\tarray(
\t\t\t'saltOne'  => $salt_one,
\t\t\t'saltTwo'  => $salt_two,
\t\t\t'snapshot' => wphx_304_05_cache_snapshot( array( 'terms' => array( 'last_changed', 'term-list', 'malformed', 'a', 'b' ) ) ),
\t\t)
\t);

\twphx_304_05_reset_state();
\tglobal $_wp_suspend_cache_invalidation;
\t$addition_initial = wp_suspend_cache_addition();
\t$addition_set_true = wp_suspend_cache_addition( true );
\t$addition_after_true = wp_suspend_cache_addition();
\t$addition_ignored = wp_suspend_cache_addition( 'ignored' );
\t$addition_set_false = wp_suspend_cache_addition( false );
\t$invalidation_initial = $_wp_suspend_cache_invalidation;
\t$invalidation_set_true_previous = wp_suspend_cache_invalidation( true );
\t$invalidation_after_true = $_wp_suspend_cache_invalidation;
\t$invalidation_set_false_previous = wp_suspend_cache_invalidation( false );
\t$invalidation_after_false = $_wp_suspend_cache_invalidation;
\t$cases[] = wphx_304_05_case(
\t\t'cache:suspend-flags',
\t\t'wp_suspend_cache_addition/wp_suspend_cache_invalidation',
\t\tarray(
\t\t\t'additionInitial'            => $addition_initial,
\t\t\t'additionSetTrue'            => $addition_set_true,
\t\t\t'additionAfterTrue'          => $addition_after_true,
\t\t\t'additionIgnoredNonBool'     => $addition_ignored,
\t\t\t'additionSetFalse'           => $addition_set_false,
\t\t\t'invalidationInitial'        => $invalidation_initial,
\t\t\t'invalidationSetTruePrev'    => $invalidation_set_true_previous,
\t\t\t'invalidationAfterTrue'      => $invalidation_after_true,
\t\t\t'invalidationSetFalsePrev'   => $invalidation_set_false_previous,
\t\t\t'invalidationAfterFalse'     => $invalidation_after_false,
\t\t),
\t\tarray( 'globalInvalidationFinal' => $_wp_suspend_cache_invalidation )
\t);

\treturn $cases;
}

$snapshot = array(
\t'mode'                  => $mode,
\t'phpVersion'            => PHP_VERSION,
\t'coveredFunctionExists' => array(
\t\t'maybe_serialize'                 => function_exists( 'maybe_serialize' ),
\t\t'maybe_unserialize'               => function_exists( 'maybe_unserialize' ),
\t\t'is_serialized'                   => function_exists( 'is_serialized' ),
\t\t'is_serialized_string'            => function_exists( 'is_serialized_string' ),
\t\t'wp_suspend_cache_addition'       => function_exists( 'wp_suspend_cache_addition' ),
\t\t'wp_suspend_cache_invalidation'   => function_exists( 'wp_suspend_cache_invalidation' ),
\t\t'wp_cache_get_last_changed'       => function_exists( 'wp_cache_get_last_changed' ),
\t\t'wp_cache_set_last_changed'       => function_exists( 'wp_cache_set_last_changed' ),
\t\t'wp_cache_get_salted'             => function_exists( 'wp_cache_get_salted' ),
\t\t'wp_cache_set_salted'             => function_exists( 'wp_cache_set_salted' ),
\t\t'wp_cache_get_multiple_salted'    => function_exists( 'wp_cache_get_multiple_salted' ),
\t\t'wp_cache_set_multiple_salted'    => function_exists( 'wp_cache_set_multiple_salted' ),
\t),
\t'cases'                 => wphx_304_05_run_cases(),
);

echo json_encode( $snapshot, JSON_UNESCAPED_SLASHES );
`
  );
}

function normalize(result) {
  return {
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
      throw new Error(`${path} is stale; run npm run wp:core:wphx-304-serialization-cache`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha, upstreamDigest) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/serialization-cache-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "workset",
      name: "serialization/cache salt/invalidation differential fixture harness",
      area: "wp-includes",
      public_contract:
        "WordPress 7.0 PHP serialization helpers, serialized token predicates, last_changed cache salts, salted cache helper envelopes, and cache suspension/invalidation flags stay observable while the candidate side is still an oracle source mirror."
    },
    ownership_state: "external_oracle",
    upstream: {
      repo: UPSTREAM_ROOT,
      ref: WP_REF,
      paths: SOURCE_FILES,
      digest: upstreamDigest
    },
    owned_paths: ["tools/wp-core/run-serialization-cache-fixture.mjs", OUT, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-304-serialization-cache",
        "npm run wp:core:wphx-304-serialization-cache:check",
        "npm run beads:validate",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-304-05-serialization-cache-fixture"],
      manifest_digest: manifestSha
    },
    notes:
      "The candidate fixture root is an oracle source mirror for WPHX-304.05. The probe normalizes microtime-based last_changed salts so the receipt is deterministic while preserving hook shape, previous-time behavior, and salt invalidation outcomes."
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
const sourceDomains = surface.domains.filter((domain) => domain.id === "serialization_cache_flags" || domain.id === "object_cache_dropin_compat");
const manifest = {
  schema: "wphx.wp-core-serialization-cache-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-serialization-cache-fixture.mjs",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    source_units: sourceUnits,
    upstream_digest: upstreamDigest
  },
  fixture: {
    candidate_kind: "oracle_source_mirror",
    source_domains: sourceDomains.map((domain) => ({
      id: domain.id,
      label: domain.label,
      symbol_count: domain.symbol_count,
      test_count: domain.test_count
    })),
    covered_symbols: COVERED_SYMBOLS,
    cases: FIXTURE_CASES,
    native_boundaries: [
      {
        id: "php-native-serialization",
        reason:
          "maybe_serialize(), maybe_unserialize(), object serialization, enum serialization, and false/null payload ambiguity intentionally use PHP's native serialize()/unserialize() grammar."
      },
      {
        id: "serialized-token-predicate-regex",
        reason:
          "is_serialized() and is_serialized_string() preserve WordPress's token checks, strict/loose delimiter behavior, and preg_match grammar rather than replacing them with a generic parser."
      },
      {
        id: "microtime-cache-salts",
        reason:
          "wp_cache_get_last_changed() and wp_cache_set_last_changed() use PHP microtime() strings. Receipt values normalize absolute time while preserving format, cache storage, and hook previous-time contracts."
      },
      {
        id: "salted-cache-compat-helpers",
        reason:
          "wp_cache_*_salted() helpers are defined by cache-compat.php and run on top of the default object-cache runtime in this slice; legacy drop-in fallback behavior is covered by WPHX-304.04."
      },
      {
        id: "global-cache-flags",
        reason:
          "wp_suspend_cache_addition() keeps static function state and wp_suspend_cache_invalidation() mutates a global flag. A Haxe port must preserve the PHP request-global/static visibility at the WordPress ABI boundary."
      },
      {
        id: "plugin-hook-boundary",
        reason:
          "wp_cache_set_last_changed fires wp_cache_set_last_changed with group, new time, and previous time through native WordPress hooks; callback ordering remains a PHP interoperability boundary."
      }
    ],
    follow_up_owner: "WPHX-304.07"
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
      id: "haxe-candidate-not-yet-installed",
      owner: "WPHX-304.07",
      detail: "The candidate side is a copied WordPress oracle source tree until selected pure option/cache helpers move to Haxe parity candidates."
    },
    {
      id: "php-serialization-port-strategy-needed",
      owner: "WPHX-304.07",
      detail: "This fixture records PHP-native serialization behavior. The Haxe implementation needs a deliberate strategy for preserving PHP serialize()/unserialize() grammar, object names, enum tokens, and false/null ambiguity."
    },
    {
      id: "persistent-dropin-salted-matrix-deferred",
      owner: "WPHX-304/WPHX-317",
      detail: "Salted helpers run on the default object-cache runtime here. Legacy drop-in helper installation is covered by WPHX-304.04, while real persistent backend matrices remain later compatibility work."
    },
    {
      id: "full-upstream-phpunit-not-yet-ported",
      owner: "WPHX-304",
      detail: "This fixture covers seed traces from the surface manifest. Full upstream serialization/cache PHPUnit parity remains a domain-level closure requirement."
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
  id: "receipt:wphx-304-05-serialization-cache-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    {
      path: OUT,
      role: "serialization/cache salt/invalidation differential fixture manifest"
    },
    {
      path: OWNERSHIP,
      role: "external-oracle ownership manifest for the fixture harness"
    },
    {
      path: "tools/wp-core/run-serialization-cache-fixture.mjs",
      role: "fixture generator and check-mode validator"
    }
  ],
  verification_commands: [
    "npm run wp:core:wphx-304-serialization-cache",
    "npm run wp:core:wphx-304-serialization-cache:check",
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
