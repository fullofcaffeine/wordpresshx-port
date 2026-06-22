#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { filesUnder } from "../wp-linker/original-path-linker.mjs";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.10.5",
  external_ref: "WPHX-311.05",
  title: "Promote REST settings update-item routing to Haxe candidate"
};
const HXML = "fixtures/wp-core/rest-settings-update-strategy-candidate.hxml";
const OUT_ROOT = "build/wp-core/wphx-311-05";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-311-05-rest-settings-update-strategy-candidate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-311-05-rest-settings-update-strategy-candidate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-311-05-rest-settings-update-strategy-candidate.v1.json";
const CONTROLLER_FIXTURE = "manifests/wp-core/wphx-311-01-rest-settings-controller-fixture.v1.json";
const DISPATCH_FIXTURE = "manifests/wp-core/wphx-311-02-rest-settings-dispatch-fixture.v1.json";
const SCHEMA_CANDIDATE = "manifests/wp-core/wphx-311-03-rest-settings-schema-strategy-candidate.v1.json";
const VALUE_CANDIDATE = "manifests/wp-core/wphx-311-04-rest-settings-value-strategy-candidate.v1.json";
const RECORDED_AT = "2026-06-22T10:45:00.000Z";
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
  "src/wp-includes/class-wp-list-util.php",
  "src/wp-includes/class-wp-error.php",
  "src/wp-includes/class-wp-http-response.php",
  "src/wp-includes/functions.php",
  "src/wp-includes/cache.php",
  "src/wp-includes/class-wp-object-cache.php",
  "src/wp-includes/formatting.php",
  "src/wp-includes/option.php",
  "src/wp-includes/rest-api.php",
  "src/wp-includes/rest-api/class-wp-rest-request.php",
  "src/wp-includes/rest-api/class-wp-rest-response.php",
  "src/wp-includes/rest-api/class-wp-rest-server.php",
  "src/wp-includes/rest-api/endpoints/class-wp-rest-controller.php",
  "src/wp-includes/rest-api/endpoints/class-wp-rest-settings-controller.php"
];

const HAXE_SOURCES = [
  HXML,
  "src/wphx/wp/rest/RestSettingsSchemaStrategy.hx",
  "src/wphx/wp/rest/RestSettingsValueStrategy.hx",
  "src/wphx/wp/rest/RestSettingsUpdateStrategy.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/RestSettingsUpdateStrategyCandidateEntry.hx"
];

const PROMOTED_SYMBOLS = ["WP_REST_Settings_Controller::update_item"];

const FIXTURE_CASES = [
  {
    id: "rest-settings-update:normal-update",
    symbol: "WP_REST_Settings_Controller::update_item",
    focus: "present request params route to update_option and refreshed settings response"
  },
  {
    id: "rest-settings-update:missing-param-skip",
    symbol: "WP_REST_Settings_Controller::update_item",
    focus: "registered settings absent from the request are skipped without storage writes"
  },
  {
    id: "rest-settings-update:pre-update-short-circuit",
    symbol: "rest_pre_update_setting",
    focus: "truthy pre-update filter result skips default update/delete behavior for that setting"
  },
  {
    id: "rest-settings-update:null-delete",
    symbol: "WP_REST_Settings_Controller::update_item",
    focus: "null request value deletes options whose stored value is valid for the schema"
  },
  {
    id: "rest-settings-update:invalid-stored-null-error",
    symbol: "WP_REST_Settings_Controller::update_item",
    focus: "null request value returns rest_invalid_stored_value when current stored option fails schema validation"
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

function sourceEscapeAudit(path) {
  const source = readFileSync(path, "utf8");
  return {
    path,
    contains_dynamic: /\bDynamic\b/.test(source),
    contains_untyped: /\buntyped\b/.test(source),
    contains_cast: /\bcast\b/.test(source),
    contains_php_syntax_code: /php\.Syntax\.code/.test(source)
  };
}

function haxeBootstrapBlock(dirnameDepth) {
  return `if ( ! function_exists( 'wphx_311_05_bootstrap_haxe' ) ) {
\tfunction wphx_311_05_bootstrap_haxe() {
\t\tstatic $bootstrapped = false;
\t\tif ( $bootstrapped ) {
\t\t\treturn;
\t\t}
\t\t$bootstrapped = true;

\t\t$wphx_311_05_lib = dirname( __DIR__, ${dirnameDepth} ) . '/haxe/lib';
\t\tset_include_path( get_include_path() . PATH_SEPARATOR . $wphx_311_05_lib );
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
wphx_311_05_bootstrap_haxe();`;
}

function installBootstrap(source, dirnameDepth) {
  const marker = "<?php\n";
  if (!source.startsWith(marker)) {
    throw new Error("PHP source did not start with an expected PHP open tag");
  }
  return `${marker}\n${haxeBootstrapBlock(dirnameDepth)}\n${source.slice(marker.length)}`;
}

function replaceMethod(source, methodName, replacement) {
  const pattern = new RegExp(`((?:public|protected|private)\\s+function\\s+${methodName}\\s*\\()`, "m");
  const match = pattern.exec(source);
  if (!match) {
    throw new Error(`Unable to locate method ${methodName}`);
  }

  const openBrace = source.indexOf("{", match.index);
  if (openBrace === -1) {
    throw new Error(`Unable to locate opening brace for ${methodName}`);
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
  throw new Error(`Unable to locate closing brace for ${methodName}`);
}

function transformCandidateRestSettingsController() {
  const path = `${CANDIDATE_ROOT}/wp-includes/rest-api/endpoints/class-wp-rest-settings-controller.php`;
  let source = installBootstrap(readFileSync(path, "utf8"), 4);
  source = replaceMethod(
    source,
    "update_item",
    `public function update_item( $request ) {
\t$options         = $this->get_registered_options();
\t$params          = $request->get_params();
\t$update_strategy = '\\\\wphx\\\\wp\\\\rest\\\\RestSettingsUpdateStrategy';

\tforeach ( $options as $name => $args ) {
\t\tif ( $update_strategy::shouldSkipMissingRequestParam( array_key_exists( $name, $params ) ) ) {
\t\t\tcontinue;
\t\t}

\t\t$updated = apply_filters( 'rest_pre_update_setting', false, $name, $request[ $name ], $args );

\t\tif ( $update_strategy::shouldSkipAfterPreUpdate( (bool) $updated ) ) {
\t\t\tcontinue;
\t\t}

\t\t$value_is_null = is_null( $request[ $name ] );

\t\tif ( $update_strategy::shouldDeleteOptionForNullValue( $value_is_null ) ) {
\t\t\t$stored_invalid = is_wp_error( rest_validate_value_from_schema( get_option( $args['option_name'], false ), $args['schema'] ) );

\t\t\tif ( $update_strategy::shouldRejectNullForInvalidStoredValue( $value_is_null, $stored_invalid ) ) {
\t\t\t\treturn new WP_Error(
\t\t\t\t\t'rest_invalid_stored_value',
\t\t\t\t\tsprintf( __( 'The %s property has an invalid stored value, and cannot be updated to null.' ), $name ),
\t\t\t\t\tarray( 'status' => 500 )
\t\t\t\t);
\t\t\t}

\t\t\tdelete_option( $args['option_name'] );
\t\t} elseif ( $update_strategy::shouldUpdateOptionForValue( $value_is_null ) ) {
\t\t\tupdate_option( $args['option_name'], $request[ $name ] );
\t\t}
\t}

\tif ( $update_strategy::shouldRefreshResponse() ) {
\t\treturn $this->get_item( $request );
\t}

\treturn array();
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

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );
$GLOBALS['wphx_311_05_php_errors'] = array();
set_error_handler(
\tfunction ( $errno, $errstr ) {
\t\t$GLOBALS['wphx_311_05_php_errors'][] = array(
\t\t\t'errno'   => $errno,
\t\t\t'message' => $errstr,
\t\t);
\t\treturn true;
\t}
);

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'WP_CONTENT_DIR', $root . '/wp-content' );
define( 'WP_DEBUG', false );

class WPHX_311_05_Fake_WPDB {
\tpublic $options = 'wp_options';
\tpublic $queries = array();
\tpublic $last_error = '';
\tprivate $suppress_errors = false;
\tprivate $store = array();

\tpublic function reset() {
\t\t$this->queries = array();
\t\t$this->store   = array();
\t}

\tpublic function set_option( $name, $value, $autoload = 'off' ) {
\t\t$this->store[ $name ] = array(
\t\t\t'option_value' => maybe_serialize( $value ),
\t\t\t'autoload'     => $autoload,
\t\t);
\t}

\tpublic function snapshot() {
\t\t$result = array();
\t\tforeach ( $this->store as $name => $row ) {
\t\t\t$result[ $name ] = array(
\t\t\t\t'value'    => maybe_unserialize( $row['option_value'] ),
\t\t\t\t'autoload' => $row['autoload'],
\t\t\t);
\t\t}
\t\tksort( $result );
\t\treturn $result;
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

\tprivate function record( $operation, $query, $args = array(), $extra = array() ) {
\t\t$this->queries[] = array_merge(
\t\t\tarray(
\t\t\t\t'operation' => $operation,
\t\t\t\t'query'     => preg_replace( '/\\s+/', ' ', trim( (string) $query ) ),
\t\t\t\t'args'      => $args,
\t\t\t),
\t\t\t$extra
\t\t);
\t}

\tpublic function get_results( $query ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'get_results', $sql, $args );
\t\tif ( false !== strpos( $sql, 'autoload' ) ) {
\t\t\t$rows = array();
\t\t\tforeach ( $this->store as $option_name => $row ) {
\t\t\t\tif ( in_array( $row['autoload'], wp_autoload_values_to_autoload(), true ) ) {
\t\t\t\t\t$rows[] = (object) array(
\t\t\t\t\t\t'option_name'  => $option_name,
\t\t\t\t\t\t'option_value' => $row['option_value'],
\t\t\t\t\t);
\t\t\t\t}
\t\t\t}
\t\t\treturn $rows;
\t\t}
\t\treturn array();
\t}

\tpublic function get_row( $query ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'get_row', $sql, $args );
\t\t$option = $args[0] ?? null;
\t\tif ( null === $option || ! isset( $this->store[ $option ] ) ) {
\t\t\treturn null;
\t\t}
\t\t$row = $this->store[ $option ];
\t\tif ( false !== strpos( $sql, 'autoload' ) && false === strpos( $sql, 'option_value' ) ) {
\t\t\treturn (object) array( 'autoload' => $row['autoload'] );
\t\t}
\t\treturn (object) array(
\t\t\t'option_value' => $row['option_value'],
\t\t\t'autoload'     => $row['autoload'],
\t\t);
\t}

\tpublic function get_var( $query ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'get_var', $sql, $args );
\t\t$option = $args[0] ?? null;
\t\tif ( null === $option || ! isset( $this->store[ $option ] ) ) {
\t\t\treturn null;
\t\t}
\t\tif ( false !== strpos( $sql, 'autoload' ) ) {
\t\t\treturn $this->store[ $option ]['autoload'];
\t\t}
\t\treturn $this->store[ $option ]['option_value'];
\t}

\tpublic function update( $table, $data, $where ) {
\t\t$option = $where['option_name'] ?? null;
\t\t$this->record( 'update', 'UPDATE ' . $table, array(), array( 'data' => $data, 'where' => $where ) );
\t\tif ( null === $option || ! isset( $this->store[ $option ] ) ) {
\t\t\treturn false;
\t\t}
\t\tif ( array_key_exists( 'option_value', $data ) ) {
\t\t\t$this->store[ $option ]['option_value'] = $data['option_value'];
\t\t}
\t\tif ( array_key_exists( 'autoload', $data ) ) {
\t\t\t$this->store[ $option ]['autoload'] = $data['autoload'];
\t\t}
\t\treturn 1;
\t}

\tpublic function delete( $table, $where ) {
\t\t$option = $where['option_name'] ?? null;
\t\t$this->record( 'delete', 'DELETE ' . $table, array(), array( 'where' => $where ) );
\t\tif ( null === $option || ! isset( $this->store[ $option ] ) ) {
\t\t\treturn false;
\t\t}
\t\tunset( $this->store[ $option ] );
\t\treturn 1;
\t}

\tpublic function query( $query ) {
\t\tlist( $sql, $args ) = $this->unpack_query( $query );
\t\t$this->record( 'query', $sql, $args );
\t\tif ( false !== strpos( $sql, 'INSERT INTO' ) && count( $args ) >= 3 ) {
\t\t\t$this->store[ $args[0] ] = array(
\t\t\t\t'option_value' => $args[1],
\t\t\t\t'autoload'     => $args[2],
\t\t\t);
\t\t\treturn 1;
\t\t}
\t\treturn true;
\t}
}

global $wpdb;
$wpdb = new WPHX_311_05_Fake_WPDB();

require_once ABSPATH . WPINC . '/plugin.php';
require_once ABSPATH . WPINC . '/compat.php';
require_once ABSPATH . WPINC . '/utf8.php';
require_once ABSPATH . WPINC . '/load.php';
require_once ABSPATH . WPINC . '/pomo/translations.php';
require_once ABSPATH . WPINC . '/l10n.php';
require_once ABSPATH . WPINC . '/class-wp-list-util.php';
require_once ABSPATH . WPINC . '/class-wp-error.php';
require_once ABSPATH . WPINC . '/class-wp-http-response.php';
require_once ABSPATH . WPINC . '/functions.php';
require_once ABSPATH . WPINC . '/cache.php';
require_once ABSPATH . WPINC . '/formatting.php';
require_once ABSPATH . WPINC . '/option.php';
require_once ABSPATH . WPINC . '/rest-api/class-wp-rest-request.php';
require_once ABSPATH . WPINC . '/rest-api/class-wp-rest-response.php';
require_once ABSPATH . WPINC . '/rest-api/class-wp-rest-server.php';
require_once ABSPATH . WPINC . '/rest-api/endpoints/class-wp-rest-controller.php';
require_once ABSPATH . WPINC . '/rest-api.php';
require_once ABSPATH . WPINC . '/rest-api/endpoints/class-wp-rest-settings-controller.php';

wp_cache_init();

function wphx_311_05_scalar( $value ) {
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

function wphx_311_05_value( $value ) {
\tif ( is_array( $value ) ) {
\t\t$entries = array();
\t\tforeach ( $value as $key => $entry_value ) {
\t\t\t$entries[] = array(
\t\t\t\t'key'   => wphx_311_05_scalar( $key ),
\t\t\t\t'value' => wphx_311_05_value( $entry_value ),
\t\t\t);
\t\t}
\t\treturn array(
\t\t\t'type'    => 'array',
\t\t\t'count'   => count( $value ),
\t\t\t'entries' => $entries,
\t\t);
\t}
\tif ( $value instanceof WP_Error ) {
\t\treturn array(
\t\t\t'type'    => 'wp_error',
\t\t\t'code'    => $value->get_error_code(),
\t\t\t'message' => $value->get_error_message(),
\t\t\t'data'    => wphx_311_05_value( $value->get_error_data() ),
\t\t);
\t}
\tif ( is_object( $value ) ) {
\t\treturn array(
\t\t\t'type'       => 'object',
\t\t\t'class'      => get_class( $value ),
\t\t\t'properties' => wphx_311_05_value( get_object_vars( $value ) ),
\t\t);
\t}
\treturn wphx_311_05_scalar( $value );
}

function wphx_311_05_case( $id, $symbol, $value, $meta = array() ) {
\treturn array(
\t\t'id'     => $id,
\t\t'symbol' => $symbol,
\t\t'value'  => wphx_311_05_value( $value ),
\t\t'meta'   => wphx_311_05_value( $meta ),
\t);
}

function wphx_311_05_reset_state() {
\tglobal $wpdb, $wp_filter, $wp_actions, $wp_filters, $wp_current_filter, $wp_registered_settings, $new_allowed_options;
\t$wpdb->reset();
\twp_cache_flush();
\t$wp_filter              = array();
\t$wp_actions             = array();
\t$wp_filters             = array();
\t$wp_current_filter      = array();
\t$wp_registered_settings = array();
\t$new_allowed_options    = array();
\t$GLOBALS['new_whitelist_options']     = &$new_allowed_options;
\t$GLOBALS['wp_rest_additional_fields'] = array();
}

function wphx_311_05_register_settings() {
\tregister_setting( 'wphx_rest_group', 'wphx_rest_text', array( 'type' => 'string', 'show_in_rest' => true, 'default' => 'fallback-text' ) );
\tregister_setting(
\t\t'wphx_rest_group',
\t\t'wphx_rest_named',
\t\tarray(
\t\t\t'type'         => 'integer',
\t\t\t'default'      => 7,
\t\t\t'show_in_rest' => array(
\t\t\t\t'name'   => 'renamed_count',
\t\t\t\t'schema' => array( 'minimum' => 0 ),
\t\t\t),
\t\t)
\t);
\tregister_setting(
\t\t'wphx_rest_group',
\t\t'wphx_rest_object',
\t\tarray(
\t\t\t'type'         => 'object',
\t\t\t'default'      => array( 'enabled' => false, 'label' => 'fallback' ),
\t\t\t'show_in_rest' => array(
\t\t\t\t'schema' => array(
\t\t\t\t\t'properties' => array(
\t\t\t\t\t\t'enabled' => array( 'type' => 'boolean' ),
\t\t\t\t\t\t'label'   => array( 'type' => 'string' ),
\t\t\t\t\t),
\t\t\t\t),
\t\t\t),
\t\t)
\t);
}

function wphx_311_05_seed_options( $invalid_object = false ) {
\tglobal $wpdb;
\t$wpdb->set_option( 'wphx_rest_text', 'stored text', 'off' );
\t$wpdb->set_option( 'wphx_rest_named', '12', 'off' );
\t$wpdb->set_option( 'wphx_rest_object', $invalid_object ? 'not-an-object' : array( 'enabled' => true, 'label' => 'stored' ), 'off' );
}

function wphx_311_05_request( $params ) {
\t$request = new WP_REST_Request( 'POST', '/wp/v2/settings' );
\t$request->set_body_params( $params );
\treturn $request;
}

function wphx_311_05_run_cases() {
\tglobal $wpdb;
\t$cases      = array();
\t$controller = new WP_REST_Settings_Controller();

\twphx_311_05_reset_state();
\twphx_311_05_register_settings();
\twphx_311_05_seed_options();
\t$result = $controller->update_item(
\t\twphx_311_05_request(
\t\t\tarray(
\t\t\t\t'wphx_rest_text' => 123,
\t\t\t\t'renamed_count'  => '19',
\t\t\t\t'wphx_rest_object' => array( 'enabled' => false, 'label' => 'updated' ),
\t\t\t)
\t\t)
\t);
\t$cases[] = wphx_311_05_case(
\t\t'rest-settings-update:normal-update',
\t\t'WP_REST_Settings_Controller::update_item',
\t\t$result,
\t\tarray(
\t\t\t'options' => $wpdb->snapshot(),
\t\t\t'queries' => $wpdb->queries,
\t\t)
\t);

\twphx_311_05_reset_state();
\twphx_311_05_register_settings();
\twphx_311_05_seed_options();
\t$result = $controller->update_item( wphx_311_05_request( array( 'wphx_rest_text' => 'only text' ) ) );
\t$cases[] = wphx_311_05_case(
\t\t'rest-settings-update:missing-param-skip',
\t\t'WP_REST_Settings_Controller::update_item',
\t\t$result,
\t\tarray( 'options' => $wpdb->snapshot() )
\t);

\twphx_311_05_reset_state();
\twphx_311_05_register_settings();
\twphx_311_05_seed_options();
\t$events = array();
\tadd_filter(
\t\t'rest_pre_update_setting',
\t\tfunction ( $result, $name, $value, $args ) use ( &$events ) {
\t\t\t$events[] = array(
\t\t\t\t'name'       => $name,
\t\t\t\t'value'      => $value,
\t\t\t\t'optionName' => $args['option_name'],
\t\t\t);
\t\t\treturn 'wphx_rest_text' === $name ? true : $result;
\t\t},
\t\t10,
\t\t4
\t);
\t$result = $controller->update_item( wphx_311_05_request( array( 'wphx_rest_text' => 'blocked', 'renamed_count' => '33' ) ) );
\t$cases[] = wphx_311_05_case(
\t\t'rest-settings-update:pre-update-short-circuit',
\t\t'rest_pre_update_setting',
\t\t$result,
\t\tarray(
\t\t\t'events'  => $events,
\t\t\t'options' => $wpdb->snapshot(),
\t\t)
\t);

\twphx_311_05_reset_state();
\twphx_311_05_register_settings();
\twphx_311_05_seed_options();
\t$result = $controller->update_item( wphx_311_05_request( array( 'renamed_count' => null ) ) );
\t$cases[] = wphx_311_05_case(
\t\t'rest-settings-update:null-delete',
\t\t'WP_REST_Settings_Controller::update_item',
\t\t$result,
\t\tarray( 'options' => $wpdb->snapshot() )
\t);

\twphx_311_05_reset_state();
\twphx_311_05_register_settings();
\twphx_311_05_seed_options( true );
\t$result = $controller->update_item( wphx_311_05_request( array( 'wphx_rest_object' => null ) ) );
\t$cases[] = wphx_311_05_case(
\t\t'rest-settings-update:invalid-stored-null-error',
\t\t'WP_REST_Settings_Controller::update_item',
\t\t$result,
\t\tarray( 'options' => $wpdb->snapshot() )
\t);

\treturn $cases;
}

$reflection = new ReflectionMethod( 'WP_REST_Settings_Controller', 'update_item' );
$snapshot   = array(
\t'mode'                  => $mode,
\t'phpVersion'            => PHP_VERSION,
\t'coveredClassExists'    => array(
\t\t'WP_REST_Settings_Controller' => class_exists( 'WP_REST_Settings_Controller' ),
\t\t'WP_REST_Request'             => class_exists( 'WP_REST_Request' ),
\t),
\t'coveredFunctionExists' => array(
\t\t'update_option'                  => function_exists( 'update_option' ),
\t\t'delete_option'                  => function_exists( 'delete_option' ),
\t\t'rest_validate_value_from_schema' => function_exists( 'rest_validate_value_from_schema' ),
\t),
\t'promotedMethodOrigin'  => array(
\t\t'file'           => $reflection->getFileName(),
\t\t'declaringClass' => $reflection->getDeclaringClass()->getName(),
\t),
\t'haxeStrategyLoaded'    => class_exists( '\\\\wphx\\\\wp\\\\rest\\\\RestSettingsUpdateStrategy' ),
\t'cases'                 => wphx_311_05_run_cases(),
\t'phpErrors'             => $GLOBALS['wphx_311_05_php_errors'],
);

echo json_encode( $snapshot, JSON_UNESCAPED_SLASHES );
`
  );
}

function normalize(result) {
  return {
    coveredClassExists: result.coveredClassExists,
    coveredFunctionExists: result.coveredFunctionExists,
    cases: result.cases,
    phpErrors: result.phpErrors
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
  return {
    matches: oracleText === candidateText,
    oracle_sha256: sha256(oracleText),
    candidate_sha256: sha256(candidateText),
    oracle_case_count: oracle.cases.length,
    candidate_case_count: candidate.cases.length,
    ...(oracleText === candidateText ? {} : { oracle, candidate })
  };
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-311-rest-settings-update-candidate`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha, upstreamDigest) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/rest-settings-update-strategy-candidate",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "class-method-strategy",
      name: "WP_REST_Settings_Controller update_item routing strategy",
      area: "wp-includes/rest-api/endpoints/class-wp-rest-settings-controller.php",
      public_contract:
        "The REST settings controller must preserve update_item PHP ABI while typed Haxe owns request presence, pre-update skip, null-delete, invalid-stored-value rejection, and update routing decisions."
    },
    ownership_state: "haxe_parity_candidate",
    upstream: {
      repo: UPSTREAM_ROOT,
      ref: WP_REF,
      paths: SOURCE_FILES,
      digest: upstreamDigest
    },
    owned_paths: [...HAXE_SOURCES, "tools/wp-core/run-rest-settings-update-strategy-candidate.mjs", OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    abi_policy: {
      php_surface_preserved: [
        "WP_REST_Settings_Controller::update_item remains public",
        "WP_REST_Request ArrayAccess and get_params() remain native",
        "rest_pre_update_setting, update_option(), delete_option(), get_option(), and WP_Error remain native WordPress/PHP boundaries"
      ],
      haxe_owned_decisions: [
        "skip missing request params",
        "skip default write after pre-update filter",
        "route null request values to delete_option",
        "reject null update when stored value is invalid",
        "route non-null request values to update_option",
        "refresh response after updates"
      ],
      native_boundaries: [
        "PHP request/array ABI",
        "plugin filter callbacks",
        "option storage functions",
        "REST schema validation and translated WP_Error message construction"
      ]
    },
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-311-rest-settings-update-candidate",
        "npm run wp:core:wphx-311-rest-settings-update-candidate:check",
        "npm run wp:core:wphx-311-rest-settings-controller:check",
        "npm run wp:core:wphx-311-rest-settings-dispatch:check",
        "npm run wp:core:wphx-311-rest-settings-schema-candidate:check",
        "npm run wp:core:wphx-311-rest-settings-value-candidate:check",
        "npm run haxe:escape-hatches:check",
        "npm run beads:validate",
        "npm run receipts:validate"
      ],
      receipt_refs: [
        "receipt:wphx-311-05-rest-settings-update-strategy-candidate",
        "receipt:wphx-311-04-rest-settings-value-strategy-candidate",
        "receipt:wphx-311-03-rest-settings-schema-strategy-candidate",
        "receipt:wphx-311-02-rest-settings-dispatch-fixture",
        "receipt:wphx-311-01-rest-settings-controller-fixture"
      ],
      manifest_digest: manifestSha
    },
    notes:
      "This slice keeps update_item's public PHP method shell and native WordPress option/filter/schema APIs. Broader WP_REST_Server and HTTP serving remain separate WPHX-311 work."
  };
}

const lock = readJson("toolchain.lock.json");
rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
command("haxe", [HXML]);
transformCandidateRestSettingsController();
writeProbe();
command("php", ["-l", `${CANDIDATE_ROOT}/wp-includes/rest-api/endpoints/class-wp-rest-settings-controller.php`]);
command("php", ["-l", `${HAXE_OUT}/lib/wphx/wp/rest/RestSettingsUpdateStrategy.php`]);

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

const haxeSourceAudits = HAXE_SOURCES.filter((path) => path.endsWith(".hx")).map(sourceEscapeAudit);
const sourceEscapeAuditPassed = haxeSourceAudits.every(
  (audit) => !audit.contains_dynamic && !audit.contains_untyped && !audit.contains_cast && !audit.contains_php_syntax_code
);

const sourceUnits = SOURCE_FILES.map(sourceRecord);
const upstreamDigest = sha256(JSON.stringify(sourceUnits.map((unit) => ({ path: unit.path, sha256: unit.sha256 }))));
const manifest = {
  schema: "wphx.wp-core-rest-settings-update-strategy-candidate.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-rest-settings-update-strategy-candidate.mjs",
  inputs: {
    controller_fixture_manifest: inputRecord(CONTROLLER_FIXTURE),
    dispatch_fixture_manifest: inputRecord(DISPATCH_FIXTURE),
    schema_candidate_manifest: inputRecord(SCHEMA_CANDIDATE),
    value_candidate_manifest: inputRecord(VALUE_CANDIDATE),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    haxe_sources: HAXE_SOURCES.map(inputRecord),
    source_units: sourceUnits,
    upstream_digest: upstreamDigest
  },
  fixture: {
    candidate_kind: "haxe_generated_rest_settings_update_strategy_shell",
    evidence_class: "targeted_semantic_parity",
    artifact_scope: "linked_candidate",
    promoted_symbols: PROMOTED_SYMBOLS,
    cases: FIXTURE_CASES,
    haxe_strategy_probe: {
      loaded_in_candidate: localCandidate.result.haxeStrategyLoaded,
      route: "typed_haxe_rest_settings_update_plan",
      owned_methods: ["update_item"]
    },
    haxe_source_audits: haxeSourceAudits,
    source_escape_audit_passed: sourceEscapeAuditPassed,
    native_boundaries: [
      {
        id: "native-wordpress-update-functions",
        reason:
          "update_option(), delete_option(), get_option(), and REST schema validation remain native WordPress behavior authorities in this slice."
      },
      {
        id: "native-filter-boundary",
        reason:
          "rest_pre_update_setting remains a PHP plugin extension point and is deliberately not represented as a typed Haxe callback surface yet."
      }
    ],
    follow_up_owner: "WPHX-311"
  },
  generated: {
    haxe_output: HAXE_OUT,
    generated_haxe_files: filesUnder(HAXE_OUT),
    candidate_controller: inputRecord(`${CANDIDATE_ROOT}/wp-includes/rest-api/endpoints/class-wp-rest-settings-controller.php`),
    strategy_php: inputRecord(`${HAXE_OUT}/lib/wphx/wp/rest/RestSettingsUpdateStrategy.php`),
    php_lint: {
      candidate_controller: "passed",
      strategy_php: "passed"
    }
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
  runs: runs.map((run) => ({
    id: run.id,
    runtime: run.runtime,
    mode: run.mode,
    command: run.command,
    php_version: run.result.phpVersion,
    haxe_strategy_loaded: run.result.haxeStrategyLoaded,
    case_count: run.result.cases.length,
    normalized_sha256: sha256(JSON.stringify(normalize(run.result)))
  })),
  comparisons,
  remaining_gaps: [
    {
      id: "rest-server-and-http-serving-still-upstream",
      owner: "WPHX-311",
      detail:
        "WP_REST_Server dispatch and HTTP serving remain outside this direct controller candidate."
    },
    {
      id: "php-filter-callback-abi-still-native",
      owner: "WPHX-311",
      detail:
        "Plugin filters are intentionally native PHP callbacks until a broader typed hook/callable ABI is proven for REST."
    },
    {
      id: "installed-rest-distribution-not-yet-owned",
      owner: "WPHX-311/WPHX-700",
      detail:
        "This is a linked candidate fixture, not a packaged WordPress REST distribution replacement."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: sourceEscapeAuditPassed ? "passed" : "failed",
    candidate_kind: "haxe_generated_rest_settings_update_strategy_shell",
    evidence_class: "targeted_semantic_parity",
    artifact_scope: "linked_candidate",
    promoted_symbols: PROMOTED_SYMBOLS.length,
    fixture_cases: FIXTURE_CASES.length,
    comparisons: comparisons.length,
    skipped_runtimes: skippedRuntimes.length,
    source_escape_audit_passed: sourceEscapeAuditPassed
  }
};

if (!sourceEscapeAuditPassed) {
  console.error(JSON.stringify({ status: "failed", haxeSourceAudits }, null, 2));
  process.exit(1);
}

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha, upstreamDigest), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-311-05-rest-settings-update-strategy-candidate",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    {
      path: OUT,
      role: "typed Haxe REST settings update strategy candidate manifest"
    },
    {
      path: OWNERSHIP,
      role: "Haxe parity-candidate ownership manifest"
    },
    {
      path: "src/wphx/wp/rest/RestSettingsUpdateStrategy.hx",
      role: "typed Haxe REST settings update strategy source"
    },
    {
      path: "tools/wp-core/run-rest-settings-update-strategy-candidate.mjs",
      role: "candidate generator and check-mode validator"
    }
  ],
  verification_commands: [
    "npm run wp:core:wphx-311-rest-settings-update-candidate",
    "npm run wp:core:wphx-311-rest-settings-update-candidate:check",
    "npm run wp:core:wphx-311-rest-settings-controller:check",
    "npm run wp:core:wphx-311-rest-settings-dispatch:check",
    "npm run wp:core:wphx-311-rest-settings-schema-candidate:check",
    "npm run wp:core:wphx-311-rest-settings-value-candidate:check",
    "npm run haxe:escape-hatches:check",
    "npm run beads:validate",
    "npm run receipts:validate"
  ],
  related_receipts: [
    "receipt:wphx-311-04-rest-settings-value-strategy-candidate",
    "receipt:wphx-311-03-rest-settings-schema-strategy-candidate",
    "receipt:wphx-311-02-rest-settings-dispatch-fixture",
    "receipt:wphx-311-01-rest-settings-controller-fixture"
  ],
  manifest_sha256: manifestSha,
  validation_result: manifest.validation_result
};
const receiptText = JSON.stringify(receipt, null, 2) + "\n";

try {
  writeOrCheck(OUT, manifestText);
  writeOrCheck(OWNERSHIP, ownershipText);
  writeOrCheck(RECEIPT, receiptText);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      manifest: OUT,
      ownership: OWNERSHIP,
      receipt: RECEIPT,
      cases: FIXTURE_CASES.length,
      comparisons: comparisons.length,
      skipped_runtimes: skippedRuntimes.length
    },
    null,
    2
  )
);
