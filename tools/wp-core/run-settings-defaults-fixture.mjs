#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.8.6",
  external_ref: "WPHX-304.06",
  title: "Build settings/default-option registry fixture harness"
};
const OUT_ROOT = "build/wp-core/wphx-304-06";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-304-06-settings-defaults-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-304-06-settings-defaults-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-304-06-settings-defaults-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-304-01-options-cache-surface.v1.json";
const RECORDED_AT = "2026-06-21T06:15:00.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const UPSTREAM_ROOT = "../wordpress-develop";

const SOURCE_FILES = [
  "src/wp-includes/class-wp-hook.php",
  "src/wp-includes/plugin.php",
  "src/wp-includes/compat.php",
  "src/wp-includes/utf8.php",
  "src/wp-includes/load.php",
  "src/wp-includes/pomo/plural-forms.php",
  "src/wp-includes/pomo/entry.php",
  "src/wp-includes/pomo/translations.php",
  "src/wp-includes/l10n.php",
  "src/wp-includes/functions.php",
  "src/wp-includes/cache.php",
  "src/wp-includes/class-wp-object-cache.php",
  "src/wp-includes/formatting.php",
  "src/wp-includes/option.php"
];

const COVERED_SYMBOLS = [
  "register_initial_settings",
  "register_setting",
  "unregister_setting",
  "get_registered_settings",
  "filter_default_option"
];

const FIXTURE_CASES = [
  {
    id: "settings:basic-registration-shape",
    symbol: "register_setting/get_registered_settings",
    focus: "argument defaults, register_setting_args filtering, allowed-options globals, legacy callable args, and installed filter priorities"
  },
  {
    id: "settings:default-option-filter",
    symbol: "filter_default_option",
    focus: "registered default values through direct calls, default_option filters, and get_option missing-option behavior"
  },
  {
    id: "settings:sanitize-callbacks",
    symbol: "register_setting/sanitize_option",
    focus: "registered sanitize callbacks, callback arity through WP_Hook, and sanitize_option filter chaining"
  },
  {
    id: "settings:unregister-cleanup",
    symbol: "unregister_setting",
    focus: "allowed-options removal, registered-setting removal, sanitize/default filter cleanup, and unregister action timing"
  },
  {
    id: "settings:deprecated-groups-and-callback",
    symbol: "register_setting/unregister_setting",
    focus: "misc/privacy group remapping, deprecated callback removal, and deprecated_argument_run events"
  },
  {
    id: "settings:rest-array-schema-boundary",
    symbol: "register_setting",
    focus: "array settings exposed through REST schema item requirements and _doing_it_wrong action capture"
  },
  {
    id: "settings:initial-settings-seed",
    symbol: "register_initial_settings",
    focus: "built-in settings registration seed shape, selected defaults, default filters, and REST names/schema hints"
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

class WPHX_304_06_Fake_WPDB {
\tpublic $options = 'wp_options';
\tpublic $queries = array();
\tpublic $last_error = '';
\tprivate $suppress_errors = false;

\tpublic function reset() {
\t\t$this->queries = array();
\t}

\tpublic function suppress_errors( $suppress = null ) {
\t\t$previous = $this->suppress_errors;
\t\tif ( null !== $suppress ) {
\t\t\t$this->suppress_errors = (bool) $suppress;
\t\t}
\t\treturn $previous;
\t}

\tpublic function strip_invalid_text_for_column( $table, $column, $value ) {
\t\treturn $value;
\t}

\tpublic function _escape( $data ) {
\t\tif ( is_array( $data ) ) {
\t\t\treturn array_map( array( $this, '_escape' ), $data );
\t\t}
\t\treturn str_replace( \"'\", \"\\\\'\", (string) $data );
\t}

\tpublic function esc_like( $text ) {
\t\treturn addcslashes( $text, '_%\\\\' );
\t}

\tpublic function prepare( $query, ...$args ) {
\t\tif ( 1 === count( $args ) && is_array( $args[0] ) ) {
\t\t\t$args = $args[0];
\t\t}
\t\treturn array(
\t\t\t'query' => $query,
\t\t\t'args'  => array_values( $args ),
\t\t);
\t}

\tprivate function unpack_query( $query ) {
\t\tif ( is_array( $query ) ) {
\t\t\treturn array( $query['query'], $query['args'] );
\t\t}
\t\treturn array( $query, array() );
\t}

\tprivate function record( $operation, $query, $args = array() ) {
\t\t$this->queries[] = array(
\t\t\t'operation' => $operation,
\t\t\t'query'     => preg_replace( '/\\s+/', ' ', trim( (string) $query ) ),
\t\t\t'args'      => $args,
\t\t);
\t}

\tpublic function get_results( $query ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'get_results', $sql, $args );
\t\treturn array();
\t}

\tpublic function get_row( $query ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'get_row', $sql, $args );
\t\treturn null;
\t}

\tpublic function get_var( $query ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'get_var', $sql, $args );
\t\treturn null;
\t}
}

global $wpdb;
$wpdb = new WPHX_304_06_Fake_WPDB();

require_once ABSPATH . WPINC . '/plugin.php';
require_once ABSPATH . WPINC . '/compat.php';
require_once ABSPATH . WPINC . '/utf8.php';
require_once ABSPATH . WPINC . '/load.php';
require_once ABSPATH . WPINC . '/pomo/translations.php';
require_once ABSPATH . WPINC . '/l10n.php';
require_once ABSPATH . WPINC . '/functions.php';
require_once ABSPATH . WPINC . '/cache.php';
require_once ABSPATH . WPINC . '/formatting.php';
require_once ABSPATH . WPINC . '/option.php';

wp_cache_init();

function wphx_304_06_sanitize_upper( $value ) {
\t$GLOBALS['wphx_304_06_events'][] = array( 'hook' => 'sanitize_upper', 'args' => func_get_args() );
\treturn strtoupper( trim( (string) $value ) );
}

function wphx_304_06_sanitize_suffix( $value ) {
\t$GLOBALS['wphx_304_06_events'][] = array( 'hook' => 'sanitize_suffix', 'args' => func_get_args() );
\treturn (string) $value . '|suffix';
}

function wphx_304_06_sanitize_deprecated( $value ) {
\t$GLOBALS['wphx_304_06_events'][] = array( 'hook' => 'sanitize_deprecated', 'args' => func_get_args() );
\treturn (string) $value . '|deprecated';
}

function wphx_304_06_scalar( $value ) {
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

function wphx_304_06_value( $value ) {
\tif ( is_array( $value ) ) {
\t\t$entries = array();
\t\tforeach ( $value as $key => $entry_value ) {
\t\t\t$entries[] = array(
\t\t\t\t'key'   => wphx_304_06_scalar( $key ),
\t\t\t\t'value' => wphx_304_06_value( $entry_value ),
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
\t\t\t'properties' => wphx_304_06_value( get_object_vars( $value ) ),
\t\t);
\t}
\treturn wphx_304_06_scalar( $value );
}

function wphx_304_06_callback_label( $callback ) {
\tif ( null === $callback || '' === $callback ) {
\t\treturn null;
\t}
\tif ( is_string( $callback ) ) {
\t\treturn array( 'type' => 'function', 'name' => $callback );
\t}
\tif ( is_array( $callback ) ) {
\t\treturn array(
\t\t\t'type'   => 'array',
\t\t\t'target' => is_object( $callback[0] ?? null ) ? get_class( $callback[0] ) : (string) ( $callback[0] ?? '' ),
\t\t\t'method' => (string) ( $callback[1] ?? '' ),
\t\t);
\t}
\tif ( $callback instanceof Closure ) {
\t\treturn array( 'type' => 'closure' );
\t}
\treturn array( 'type' => gettype( $callback ) );
}

function wphx_304_06_setting_summary( $settings, $names ) {
\t$result = array();
\tforeach ( $names as $name ) {
\t\tif ( ! isset( $settings[ $name ] ) ) {
\t\t\t$result[ $name ] = null;
\t\t\tcontinue;
\t\t}
\t\t$setting = $settings[ $name ];
\t\t$summary = array(
\t\t\t'type'              => $setting['type'] ?? null,
\t\t\t'group'             => $setting['group'] ?? null,
\t\t\t'label'             => $setting['label'] ?? null,
\t\t\t'description'       => $setting['description'] ?? null,
\t\t\t'sanitize_callback' => wphx_304_06_callback_label( $setting['sanitize_callback'] ?? null ),
\t\t\t'show_in_rest'      => $setting['show_in_rest'] ?? null,
\t\t);
\t\tif ( array_key_exists( 'default', $setting ) ) {
\t\t\t$summary['default'] = $setting['default'];
\t\t}
\t\t$result[ $name ] = $summary;
\t}
\treturn $result;
}

function wphx_304_06_case( $id, $symbol, $value, $meta = array() ) {
\treturn array(
\t\t'id'     => $id,
\t\t'symbol' => $symbol,
\t\t'value'  => wphx_304_06_value( $value ),
\t\t'meta'   => wphx_304_06_value( $meta ),
\t);
}

function wphx_304_06_reset_state() {
\tglobal $wpdb, $wp_filter, $wp_actions, $wp_filters, $wp_current_filter, $wp_registered_settings, $new_allowed_options;
\t$wpdb->reset();
\twp_cache_flush();
\t$wp_filter              = array();
\t$wp_actions             = array();
\t$wp_filters             = array();
\t$wp_current_filter      = array();
\t$wp_registered_settings = array();
\t$new_allowed_options    = array();
\t$GLOBALS['new_whitelist_options'] = &$new_allowed_options;
\t$GLOBALS['wphx_304_06_events']   = array();
}

function wphx_304_06_registry_snapshot( $setting_names = array() ) {
\tglobal $wpdb, $new_allowed_options;
\t$settings = get_registered_settings();
\treturn array(
\t\t'allowedOptions' => $new_allowed_options,
\t\t'settingKeys'    => array_keys( $settings ),
\t\t'settings'       => wphx_304_06_setting_summary( $settings, $setting_names ),
\t\t'filters'        => array(
\t\t\t'sanitize' => array(
\t\t\t\t'wphx_text'         => has_filter( 'sanitize_option_wphx_text', 'wphx_304_06_sanitize_upper' ),
\t\t\t\t'wphx_callable_arg' => has_filter( 'sanitize_option_wphx_callable_arg', 'wphx_304_06_sanitize_suffix' ),
\t\t\t\t'wphx_defaulted'    => has_filter( 'default_option_wphx_defaulted', 'filter_default_option' ),
\t\t\t),
\t\t),
\t\t'queryCount'     => count( $wpdb->queries ),
\t\t'queryTail'      => array_slice( $wpdb->queries, -6 ),
\t);
}

function wphx_304_06_run_cases() {
\tglobal $new_allowed_options;
\t$cases = array();

\twphx_304_06_reset_state();
\t$register_events = array();
\tadd_filter(
\t\t'register_setting_args',
\t\tfunction ( $args, $defaults, $option_group, $option_name ) use ( &$register_events ) {
\t\t\t$register_events[] = array(
\t\t\t\t'hook'     => 'register_setting_args',
\t\t\t\t'args'     => $args,
\t\t\t\t'defaults' => $defaults,
\t\t\t\t'group'    => $option_group,
\t\t\t\t'name'     => $option_name,
\t\t\t);
\t\t\tif ( 'wphx_text' === $option_name ) {
\t\t\t\t$args['label'] = 'Filtered label';
\t\t\t}
\t\t\treturn $args;
\t\t},
\t\t10,
\t\t4
\t);
\tadd_action(
\t\t'register_setting',
\t\tfunction ( $option_group, $option_name, $args ) use ( &$register_events ) {
\t\t\t$register_events[] = array(
\t\t\t\t'hook'  => 'register_setting',
\t\t\t\t'group' => $option_group,
\t\t\t\t'name'  => $option_name,
\t\t\t\t'args'  => wphx_304_06_setting_summary( array( $option_name => $args ), array( $option_name ) ),
\t\t\t);
\t\t},
\t\t10,
\t\t3
\t);
\tregister_setting(
\t\t'wphx_group',
\t\t'wphx_text',
\t\tarray(
\t\t\t'type'              => 'string',
\t\t\t'description'       => 'Plain text setting',
\t\t\t'sanitize_callback' => 'wphx_304_06_sanitize_upper',
\t\t\t'show_in_rest'      => true,
\t\t\t'default'           => 'fallback-text',
\t\t)
\t);
\tregister_setting( 'wphx_group', 'wphx_callable_arg', 'wphx_304_06_sanitize_suffix' );
\t$cases[] = wphx_304_06_case(
\t\t'settings:basic-registration-shape',
\t\t'register_setting/get_registered_settings',
\t\twphx_304_06_registry_snapshot( array( 'wphx_text', 'wphx_callable_arg' ) ),
\t\tarray( 'events' => $register_events )
\t);

\twphx_304_06_reset_state();
\tregister_setting(
\t\t'wphx_group',
\t\t'wphx_defaulted',
\t\tarray(
\t\t\t'type'    => 'array',
\t\t\t'default' => array( 'enabled' => true, 'label' => 'registered-default' ),
\t\t)
\t);
\t$cases[] = wphx_304_06_case(
\t\t'settings:default-option-filter',
\t\t'filter_default_option',
\t\tarray(
\t\t\t'directNoPassedDefault' => filter_default_option( 'incoming-default', 'wphx_defaulted', false ),
\t\t\t'directPassedDefault'   => filter_default_option( 'caller-default', 'wphx_defaulted', true ),
\t\t\t'directUnknown'         => filter_default_option( 'incoming-default', 'wphx_unknown_default', false ),
\t\t\t'appliedFilter'         => apply_filters( 'default_option_wphx_defaulted', false, 'wphx_defaulted', false ),
\t\t\t'getOptionNoDefault'    => get_option( 'wphx_defaulted' ),
\t\t\t'getOptionWithDefault'  => get_option( 'wphx_defaulted', 'caller-default' ),
\t\t),
\t\twphx_304_06_registry_snapshot( array( 'wphx_defaulted' ) )
\t);

\twphx_304_06_reset_state();
\tregister_setting(
\t\t'wphx_group',
\t\t'wphx_sanitized',
\t\tarray(
\t\t\t'sanitize_callback' => 'wphx_304_06_sanitize_upper',
\t\t)
\t);
\tadd_filter(
\t\t'sanitize_option_wphx_sanitized',
\t\tfunction ( $value, $option, $original_value ) {
\t\t\t$GLOBALS['wphx_304_06_events'][] = array(
\t\t\t\t'hook'     => 'sanitize_second',
\t\t\t\t'value'    => $value,
\t\t\t\t'option'   => $option,
\t\t\t\t'original' => $original_value,
\t\t\t);
\t\t\treturn $value . '|second';
\t\t},
\t\t20,
\t\t3
\t);
\t$cases[] = wphx_304_06_case(
\t\t'settings:sanitize-callbacks',
\t\t'register_setting/sanitize_option',
\t\tarray(
\t\t\t'sanitized' => sanitize_option( 'wphx_sanitized', '  abc  ' ),
\t\t\t'unknown'   => sanitize_option( 'wphx_unknown_sanitized', '  abc  ' ),
\t\t),
\t\tarray(
\t\t\t'events'   => $GLOBALS['wphx_304_06_events'],
\t\t\t'snapshot' => wphx_304_06_registry_snapshot( array( 'wphx_sanitized' ) ),
\t\t)
\t);

\twphx_304_06_reset_state();
\t$unregister_events = array();
\tregister_setting(
\t\t'wphx_group',
\t\t'wphx_cleanup',
\t\tarray(
\t\t\t'sanitize_callback' => 'wphx_304_06_sanitize_upper',
\t\t\t'default'           => 'cleanup-default',
\t\t)
\t);
\tadd_action(
\t\t'unregister_setting',
\t\tfunction ( $option_group, $option_name ) use ( &$unregister_events ) {
\t\t\t$unregister_events[] = array(
\t\t\t\t'hook'  => 'unregister_setting',
\t\t\t\t'group' => $option_group,
\t\t\t\t'name'  => $option_name,
\t\t\t);
\t\t},
\t\t10,
\t\t2
\t);
\t$before_unregister = array(
\t\t'hasSanitize' => has_filter( 'sanitize_option_wphx_cleanup', 'wphx_304_06_sanitize_upper' ),
\t\t'hasDefault'  => has_filter( 'default_option_wphx_cleanup', 'filter_default_option' ),
\t\t'snapshot'    => wphx_304_06_registry_snapshot( array( 'wphx_cleanup' ) ),
\t);
\tunregister_setting( 'wphx_group', 'wphx_cleanup' );
\t$after_unregister = array(
\t\t'hasSanitize'       => has_filter( 'sanitize_option_wphx_cleanup', 'wphx_304_06_sanitize_upper' ),
\t\t'hasDefault'        => has_filter( 'default_option_wphx_cleanup', 'filter_default_option' ),
\t\t'sanitizeAfter'     => apply_filters( 'sanitize_option_wphx_cleanup', 'raw-after', 'wphx_cleanup', 'raw-after' ),
\t\t'defaultAfter'      => apply_filters( 'default_option_wphx_cleanup', false, 'wphx_cleanup', false ),
\t\t'events'            => $unregister_events,
\t\t'snapshot'          => wphx_304_06_registry_snapshot( array( 'wphx_cleanup' ) ),
\t);
\t$cases[] = wphx_304_06_case(
\t\t'settings:unregister-cleanup',
\t\t'unregister_setting',
\t\tarray( 'before' => $before_unregister, 'after' => $after_unregister )
\t);

\twphx_304_06_reset_state();
\t$deprecated_events = array();
\tadd_action(
\t\t'deprecated_argument_run',
\t\tfunction ( $function_name, $message, $version ) use ( &$deprecated_events ) {
\t\t\t$deprecated_events[] = array(
\t\t\t\t'function' => $function_name,
\t\t\t\t'message'  => $message,
\t\t\t\t'version'  => $version,
\t\t\t);
\t\t},
\t\t10,
\t\t3
\t);
\tregister_setting( 'misc', 'wphx_misc' );
\tregister_setting( 'privacy', 'wphx_privacy' );
\tadd_filter( 'sanitize_option_wphx_deprecated', 'wphx_304_06_sanitize_deprecated' );
\tregister_setting(
\t\t'wphx_group',
\t\t'wphx_deprecated',
\t\tarray(
\t\t\t'sanitize_callback' => 'wphx_304_06_sanitize_upper',
\t\t)
\t);
\t$deprecated_before = array(
\t\t'oldCallback' => has_filter( 'sanitize_option_wphx_deprecated', 'wphx_304_06_sanitize_deprecated' ),
\t\t'newCallback' => has_filter( 'sanitize_option_wphx_deprecated', 'wphx_304_06_sanitize_upper' ),
\t);
\tunregister_setting( 'wphx_group', 'wphx_deprecated', 'wphx_304_06_sanitize_deprecated' );
\t$cases[] = wphx_304_06_case(
\t\t'settings:deprecated-groups-and-callback',
\t\t'register_setting/unregister_setting',
\t\tarray(
\t\t\t'allowedOptions' => $new_allowed_options,
\t\t\t'before'         => $deprecated_before,
\t\t\t'after'          => array(
\t\t\t\t'oldCallback' => has_filter( 'sanitize_option_wphx_deprecated', 'wphx_304_06_sanitize_deprecated' ),
\t\t\t\t'newCallback' => has_filter( 'sanitize_option_wphx_deprecated', 'wphx_304_06_sanitize_upper' ),
\t\t\t),
\t\t\t'events'         => $deprecated_events,
\t\t)
\t);

\twphx_304_06_reset_state();
\t$doing_it_wrong_events = array();
\tadd_action(
\t\t'doing_it_wrong_run',
\t\tfunction ( $function_name, $message, $version ) use ( &$doing_it_wrong_events ) {
\t\t\t$doing_it_wrong_events[] = array(
\t\t\t\t'function' => $function_name,
\t\t\t\t'message'  => $message,
\t\t\t\t'version'  => $version,
\t\t\t);
\t\t},
\t\t10,
\t\t3
\t);
\tregister_setting(
\t\t'wphx_group',
\t\t'wphx_array_bad',
\t\tarray(
\t\t\t'type'         => 'array',
\t\t\t'show_in_rest' => true,
\t\t)
\t);
\tregister_setting(
\t\t'wphx_group',
\t\t'wphx_array_good',
\t\tarray(
\t\t\t'type'         => 'array',
\t\t\t'show_in_rest' => array(
\t\t\t\t'schema' => array(
\t\t\t\t\t'items' => array( 'type' => 'string' ),
\t\t\t\t),
\t\t\t),
\t\t)
\t);
\t$cases[] = wphx_304_06_case(
\t\t'settings:rest-array-schema-boundary',
\t\t'register_setting',
\t\twphx_304_06_registry_snapshot( array( 'wphx_array_bad', 'wphx_array_good' ) ),
\t\tarray( 'events' => $doing_it_wrong_events )
\t);

\twphx_304_06_reset_state();
\tregister_initial_settings();
\t$initial_settings = get_registered_settings();
\t$cases[] = wphx_304_06_case(
\t\t'settings:initial-settings-seed',
\t\t'register_initial_settings',
\t\tarray(
\t\t\t'count'           => count( $initial_settings ),
\t\t\t'firstKeys'       => array_slice( array_keys( $initial_settings ), 0, 8 ),
\t\t\t'selected'        => wphx_304_06_setting_summary( $initial_settings, array( 'blogname', 'WPLANG', 'use_smilies', 'posts_per_page', 'default_comment_status' ) ),
\t\t\t'allowedOptions' => $new_allowed_options,
\t\t\t'defaultFilters' => array(
\t\t\t\t'WPLANG'         => has_filter( 'default_option_WPLANG', 'filter_default_option' ),
\t\t\t\t'use_smilies'    => has_filter( 'default_option_use_smilies', 'filter_default_option' ),
\t\t\t\t'posts_per_page' => has_filter( 'default_option_posts_per_page', 'filter_default_option' ),
\t\t\t),
\t\t)
\t);

\treturn $cases;
}

$snapshot = array(
\t'mode'                  => $mode,
\t'phpVersion'            => PHP_VERSION,
\t'coveredFunctionExists' => array(
\t\t'register_initial_settings' => function_exists( 'register_initial_settings' ),
\t\t'register_setting'          => function_exists( 'register_setting' ),
\t\t'unregister_setting'        => function_exists( 'unregister_setting' ),
\t\t'get_registered_settings'   => function_exists( 'get_registered_settings' ),
\t\t'filter_default_option'     => function_exists( 'filter_default_option' ),
\t\t'sanitize_option'           => function_exists( 'sanitize_option' ),
\t),
\t'cases'                 => wphx_304_06_run_cases(),
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
      throw new Error(`${path} is stale; run npm run wp:core:wphx-304-settings-defaults`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha, upstreamDigest) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/settings-defaults-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "workset",
      name: "settings/default-option registry differential fixture harness",
      area: "wp-includes/option.php wp-includes/formatting.php",
      public_contract:
        "WordPress settings registry globals, sanitize/default option filters, deprecated group compatibility, and REST schema warning hooks remain observable while the candidate side is still an oracle source mirror."
    },
    ownership_state: "external_oracle",
    upstream: {
      repo: UPSTREAM_ROOT,
      ref: WP_REF,
      paths: SOURCE_FILES,
      digest: upstreamDigest
    },
    owned_paths: ["tools/wp-core/run-settings-defaults-fixture.mjs", OUT, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-304-settings-defaults",
        "npm run wp:core:wphx-304-settings-defaults:check",
        "npm run wp:core:wphx-304-option-storage:check",
        "npm run beads:validate",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-304-06-settings-defaults-fixture", "receipt:wphx-304-02-option-storage-fixture"],
      manifest_digest: manifestSha
    },
    notes:
      "The candidate fixture root is an oracle source mirror for WPHX-304.06. Registry mutation and callbacks stay PHP-native here; later Haxe ownership must preserve the global registry, filter timing, callable ABI, and REST warning hooks."
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
const sourceDomain = surface.domains.find((domain) => domain.id === "settings_defaults");
const manifest = {
  schema: "wphx.wp-core-settings-defaults-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-settings-defaults-fixture.mjs",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    source_units: sourceUnits,
    upstream_digest: upstreamDigest
  },
  fixture: {
    candidate_kind: "oracle_source_mirror",
    source_domain: sourceDomain
      ? {
          id: sourceDomain.id,
          label: sourceDomain.label,
          symbol_count: sourceDomain.symbol_count,
          test_count: sourceDomain.test_count
        }
      : {
          id: "settings_defaults",
          label: "Settings registry and default option filters"
        },
    covered_symbols: COVERED_SYMBOLS,
    cases: FIXTURE_CASES,
    native_boundaries: [
      {
        id: "global-settings-registries",
        reason:
          "$wp_registered_settings, $new_allowed_options, and the legacy $new_whitelist_options alias are PHP request globals. Haxe ownership must preserve mutation timing and alias visibility."
      },
      {
        id: "plugin-filter-callbacks",
        reason:
          "register_setting_args, sanitize_option_*, default_option_*, register_setting, unregister_setting, deprecated_argument_run, and doing_it_wrong_run remain native WordPress hook boundaries with plugin-callable PHP callbacks."
      },
      {
        id: "callable-abi-and-arity",
        reason:
          "register_setting() accepts legacy callable arguments and installs sanitize callbacks with WordPress's default accepted_args=1 behavior, while later filters can observe the wider sanitize_option argument list."
      },
      {
        id: "rest-schema-warning-bridge",
        reason:
          "REST visibility is represented by show_in_rest registry shape and _doing_it_wrong warning hooks here. REST settings controller request/response behavior remains a REST API domain boundary."
      },
      {
        id: "l10n-warning-text",
        reason:
          "register_initial_settings(), deprecated group messages, and REST schema warnings call __()/translate(); the fixture keeps l10n as PHP-native observable text and hook behavior."
      },
      {
        id: "missing-option-storage-test-double",
        reason:
          "The get_option default case uses a deterministic wpdb/cache test double to prove default_option filter behavior without turning this slice into full wpdb/storage parity."
      },
      {
        id: "sanitize-option-core-switch",
        reason:
          "sanitize_option() has broad option-specific validation and escaping branches. This fixture covers registered callback chaining for custom settings; full sanitize_option parity remains broader formatting/options work."
      }
    ],
    follow_up_owner: "WPHX-304"
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
      owner: "WPHX-304",
      detail:
        "The candidate side is a copied WordPress oracle source tree. This receipt identifies the registry/callback boundaries a future Haxe candidate must preserve."
    },
    {
      id: "rest-settings-controller-deferred",
      owner: "WPHX-318/WPHX-400",
      detail:
        "show_in_rest registry shape and array-schema warnings are covered here, but WP_REST_Settings_Controller request validation and schema emission are not part of this option.php slice."
    },
    {
      id: "full-sanitize-option-matrix-deferred",
      owner: "WPHX-303/WPHX-304",
      detail:
        "This fixture covers registered custom sanitize callbacks. The full sanitize_option() option-name switch and related escaping/email/URL validation stay in broader formatting and option-storage parity work."
    },
    {
      id: "real-wpdb-not-yet-ported",
      owner: "WPHX-305",
      detail:
        "The get_option default case uses a deterministic missing-option wpdb double. Full database query preparation, errors, and storage parity remain WPHX-305."
    },
    {
      id: "full-upstream-phpunit-not-yet-ported",
      owner: "WPHX-304",
      detail:
        "This fixture covers seed traces from registration.php and sanitizeOption.php. Full upstream PHPUnit parity remains a domain-level closure requirement."
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
  id: "receipt:wphx-304-06-settings-defaults-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    {
      path: OUT,
      role: "settings/default-option registry differential fixture manifest"
    },
    {
      path: OWNERSHIP,
      role: "external-oracle ownership manifest for the fixture harness"
    },
    {
      path: "tools/wp-core/run-settings-defaults-fixture.mjs",
      role: "fixture generator and check-mode validator"
    }
  ],
  verification_commands: [
    "npm run wp:core:wphx-304-settings-defaults",
    "npm run wp:core:wphx-304-settings-defaults:check",
    "npm run wp:core:wphx-304-option-storage:check",
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
