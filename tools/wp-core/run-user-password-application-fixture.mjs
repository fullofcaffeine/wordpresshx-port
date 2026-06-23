#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.13.3",
  external_ref: "WPHX-306.05",
  title: "Password and application-password oracle fixture"
};
const OUT_ROOT = "build/wp-core/wphx-306-05";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-306-05-password-application-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-306-05-password-application-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-306-05-password-application-fixture.v1.json";
const FOUNDATION = "manifests/wp-core/wphx-306-02-auth-adapter-contract-candidate.v1.json";
const SURFACE = "manifests/wp-core/wphx-306-01-user-auth-surface.v1.json";
const RECORDED_AT = "2026-06-23T22:45:00.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const UPSTREAM_ROOT = "../wordpress-develop";

const SOURCE_FILES = [
  "src/wp-includes/class-wp-error.php",
  "src/wp-includes/class-wp-application-passwords.php",
  "src/wp-includes/pluggable.php",
  "src/wp-includes/user.php"
];

const COVERED_SYMBOLS = [
  "wp_hash_password",
  "wp_check_password",
  "wp_password_needs_rehash",
  "WP_Application_Passwords::hash_password",
  "WP_Application_Passwords::check_password",
  "WP_Application_Passwords::get_user_application_passwords",
  "WP_Application_Passwords::record_application_password_usage",
  "wp_authenticate_application_password",
  "wp_validate_application_password",
  "wp_is_application_passwords_available",
  "wp_is_application_passwords_available_for_user"
];

const FIXTURE_CASES = [
  { id: "password:wp-bcrypt", symbol: "wp_hash_password/wp_check_password", focus: "default WordPress-prefixed bcrypt hash family and verification" },
  { id: "password:vanilla-bcrypt", symbol: "wp_check_password/wp_password_needs_rehash", focus: "non-prefixed bcrypt compatibility and rehash requirement" },
  { id: "password:md5-legacy", symbol: "wp_check_password", focus: "legacy 32-character md5 hash compatibility" },
  { id: "password:too-long", symbol: "wp_hash_password/wp_check_password", focus: "4096-byte password limit behavior" },
  { id: "password:filter", symbol: "check_password/password_needs_rehash", focus: "password filter surfaces receive expected booleans" },
  { id: "application-password:fast-hash", symbol: "WP_Application_Passwords::hash_password/check_password", focus: "generic fast-hash family and verification" },
  { id: "application-password:legacy-wp-hash", symbol: "WP_Application_Passwords::check_password", focus: "legacy application password hash delegates to wp_check_password" },
  { id: "application-password:authenticate-success", symbol: "wp_authenticate_application_password", focus: "successful app-password auth records usage and fires success hook" },
  { id: "application-password:authenticate-failure", symbol: "wp_authenticate_application_password", focus: "wrong password and unavailable-user paths return WP_Error and fire failure hook" },
  { id: "application-password:validate-basic-auth", symbol: "wp_validate_application_password", focus: "PHP_AUTH_USER/PHP_AUTH_PW validation returns authenticated user ID" }
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

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );
$_SERVER['PHP_AUTH_USER'] = 'api-user';
$_SERVER['PHP_AUTH_PW'] = 'app pass word';

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'WP_DEBUG', false );
define( 'PASSWORD_BCRYPT_COST', 4 );
define( 'AUTH_KEY', 'wphx-auth-key' );
define( 'AUTH_SALT', 'wphx-auth-salt' );

$GLOBALS['wphx_306_05_filters'] = array();
$GLOBALS['wphx_306_05_actions'] = array();
$GLOBALS['wphx_306_05_user_meta'] = array();
$GLOBALS['wphx_306_05_network_options'] = array( 'using_application_passwords' => true );
$GLOBALS['wphx_306_05_php_errors'] = array();
$GLOBALS['wphx_306_05_users'] = array();

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_306_05_php_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

class WP_User {
\tpublic $ID = 0;
\tpublic $user_login = '';
\tpublic $user_email = '';
\tpublic function __construct( $id = 0, $login = '', $email = '' ) {
\t\t$this->ID = (int) $id;
\t\t$this->user_login = $login;
\t\t$this->user_email = $email;
\t}
\tpublic function exists() {
\t\treturn $this->ID > 0;
\t}
}

function add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wphx_306_05_filters'][ $hook_name ][ $priority ][] = array( $callback, $accepted_args );
\tksort( $GLOBALS['wphx_306_05_filters'][ $hook_name ] );
\treturn true;
}
function apply_filters( $hook_name, $value, ...$args ) {
\tif ( empty( $GLOBALS['wphx_306_05_filters'][ $hook_name ] ) ) {
\t\treturn $value;
\t}
\tforeach ( $GLOBALS['wphx_306_05_filters'][ $hook_name ] as $callbacks ) {
\t\tforeach ( $callbacks as $record ) {
\t\t\t$callback_args = array_merge( array( $value ), $args );
\t\t\t$value = call_user_func_array( $record[0], array_slice( $callback_args, 0, $record[1] ) );
\t\t}
\t}
\treturn $value;
}
function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_306_05_actions'][] = array(
\t\t'hook' => $hook_name,
\t\t'args' => wphx_306_05_normalize_action_args( $args ),
\t);
\tapply_filters( $hook_name, null, ...$args );
}
function __( $text ) { return $text; }
function wp_prime_site_option_caches( $options ) { return null; }
function get_site_option( $name, $default = false ) { return $default; }
function update_site_option( $name, $value ) { return true; }
function wp_generate_password( $length = 12, $special_chars = true, $extra_special_chars = false ) {
\treturn substr( str_repeat( 'aB3cD4eF5gH6', 3 ), 0, $length );
}
function wp_generate_uuid4() { return '11111111-2222-4333-8444-555555555555'; }
function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function is_email( $value ) { return false !== strpos( (string) $value, '@' ); }
function get_main_network_id() { return 1; }
function get_network_option( $network_id, $name, $default = false ) {
\treturn array_key_exists( $name, $GLOBALS['wphx_306_05_network_options'] ) ? $GLOBALS['wphx_306_05_network_options'][ $name ] : $default;
}
function update_network_option( $network_id, $name, $value ) {
\t$GLOBALS['wphx_306_05_network_options'][ $name ] = $value;
\treturn true;
}
function is_ssl() { return true; }
function wp_get_environment_type() { return 'local'; }
function get_user_meta( $user_id, $key, $single = false ) {
\t$value = $GLOBALS['wphx_306_05_user_meta'][ (int) $user_id ][ $key ] ?? '';
\treturn $single ? $value : array( $value );
}
function update_user_meta( $user_id, $key, $value ) {
\t$GLOBALS['wphx_306_05_user_meta'][ (int) $user_id ][ $key ] = $value;
\treturn true;
}
function get_userdata( $user_id ) {
\treturn $GLOBALS['wphx_306_05_users'][ (int) $user_id ] ?? false;
}
function get_user_by( $field, $value ) {
\tforeach ( $GLOBALS['wphx_306_05_users'] as $user ) {
\t\tif ( 'login' === $field && $user->user_login === $value ) {
\t\t\treturn $user;
\t\t}
\t\tif ( 'email' === $field && $user->user_email === $value ) {
\t\t\treturn $user;
\t\t}
\t}
\treturn false;
}
function wp_fast_hash( string $message ): string {
\t$hashed = sodium_crypto_generichash( $message, 'wp_fast_hash_6.8+', 30 );
\treturn '$generic$' . sodium_bin2base64( $hashed, SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING );
}
function wp_verify_fast_hash( string $message, string $hash ): bool {
\tif ( ! str_starts_with( $hash, '$generic$' ) ) {
\t\treturn wp_check_password( $message, $hash );
\t}
\treturn hash_equals( $hash, wp_fast_hash( $message ) );
}

require $root . '/wp-includes/class-wp-error.php';
require $root . '/wp-includes/pluggable.php';
require $root . '/wp-includes/class-wp-application-passwords.php';

function wphx_306_05_token_text( $token ) {
\treturn is_array( $token ) ? $token[1] : $token;
}
function wphx_306_05_extract_functions( $source, $names ) {
\t$tokens = token_get_all( "<?php\\n" . $source );
\t$output = '';
\t$count = count( $tokens );
\tfor ( $i = 0; $i < $count; $i++ ) {
\t\t$token = $tokens[ $i ];
\t\tif ( ! is_array( $token ) || T_FUNCTION !== $token[0] ) {
\t\t\tcontinue;
\t\t}
\t\t$j = $i + 1;
\t\twhile ( $j < $count && ( ( is_array( $tokens[ $j ] ) && T_WHITESPACE === $tokens[ $j ][0] ) || '&' === $tokens[ $j ] ) ) {
\t\t\t$j++;
\t\t}
\t\tif ( $j >= $count || ! is_array( $tokens[ $j ] ) || T_STRING !== $tokens[ $j ][0] || ! in_array( $tokens[ $j ][1], $names, true ) ) {
\t\t\tcontinue;
\t\t}

\t\t$depth = 0;
\t\t$seen_body = false;
\t\tfor ( $k = $i; $k < $count; $k++ ) {
\t\t\t$text = wphx_306_05_token_text( $tokens[ $k ] );
\t\t\t$output .= $text;
\t\t\tif ( is_string( $tokens[ $k ] ) ) {
\t\t\t\tif ( '{' === $tokens[ $k ] ) {
\t\t\t\t\t$depth++;
\t\t\t\t\t$seen_body = true;
\t\t\t\t} elseif ( '}' === $tokens[ $k ] ) {
\t\t\t\t\t$depth--;
\t\t\t\t\tif ( $seen_body && 0 === $depth ) {
\t\t\t\t\t\t$output .= "\\n";
\t\t\t\t\t\tbreak;
\t\t\t\t\t}
\t\t\t\t}
\t\t\t}
\t\t}
\t}
\treturn $output;
}
$user_php = file_get_contents( $root . '/wp-includes/user.php' );
eval(
\twphx_306_05_extract_functions(
\t\t$user_php,
\t\tarray(
\t\t\t'wp_authenticate_application_password',
\t\t\t'wp_validate_application_password',
\t\t\t'wp_is_application_passwords_supported',
\t\t\t'wp_is_application_passwords_available',
\t\t\t'wp_is_application_passwords_available_for_user',
\t\t)
\t)
);

function wphx_306_05_normalize_action_args( $args ) {
\t$result = array();
\tforeach ( $args as $arg ) {
\t\tif ( $arg instanceof WP_User ) {
\t\t\t$result[] = array( 'WP_User' => array( 'ID' => $arg->ID, 'user_login' => $arg->user_login ) );
\t\t} elseif ( $arg instanceof WP_Error ) {
\t\t\t$result[] = array( 'WP_Error' => $arg->get_error_codes() );
\t\t} elseif ( is_array( $arg ) ) {
\t\t\t$item = array();
\t\t\tforeach ( $arg as $key => $value ) {
\t\t\t\tif ( 'password' === $key ) {
\t\t\t\t\t$item[ $key ] = wphx_306_05_hash_summary( $value );
\t\t\t\t} elseif ( 'created' === $key || 'last_used' === $key ) {
\t\t\t\t\t$item[ $key ] = is_null( $value ) ? null : 'timestamp';
\t\t\t\t} else {
\t\t\t\t\t$item[ $key ] = is_array( $value ) ? wphx_306_05_normalize_action_args( $value ) : $value;
\t\t\t\t}
\t\t\t}
\t\t\t$result[] = $item;
\t\t} elseif ( is_string( $arg ) && strlen( $arg ) >= 12 ) {
\t\t\t$result[] = array( 'string_length' => strlen( $arg ), 'sha256' => hash( 'sha256', $arg ) );
\t\t} else {
\t\t\t$result[] = $arg;
\t\t}
\t}
\treturn $result;
}
function wphx_306_05_hash_summary( $hash ) {
\tif ( str_starts_with( $hash, '$wp$2y$' ) ) {
\t\t$family = 'wordpress_bcrypt';
\t} elseif ( str_starts_with( $hash, '$2y$' ) ) {
\t\t$family = 'bcrypt';
\t} elseif ( str_starts_with( $hash, '$generic$' ) ) {
\t\t$family = 'generic_fast_hash';
\t} elseif ( strlen( $hash ) === 32 ) {
\t\t$family = 'md5';
\t} else {
\t\t$family = 'unknown';
\t}
\treturn array( 'family' => $family, 'length' => strlen( $hash ) );
}
function wphx_306_05_error_summary( $value ) {
\treturn $value instanceof WP_Error ? array( 'WP_Error' => $value->get_error_codes() ) : $value;
}
function wphx_306_05_user_summary( $value ) {
\treturn $value instanceof WP_User ? array( 'WP_User' => array( 'ID' => $value->ID, 'user_login' => $value->user_login ) ) : wphx_306_05_error_summary( $value );
}
function wphx_306_05_recent_actions( $hook_name ) {
\treturn array_values(
\t\tarray_filter(
\t\t\t$GLOBALS['wphx_306_05_actions'],
\t\t\tfunction ( $action ) use ( $hook_name ) {
\t\t\t\treturn $action['hook'] === $hook_name;
\t\t\t}
\t\t)
\t);
}

add_filter( 'wp_hash_password_options', function ( $options, $algorithm ) { return array( 'cost' => 4 ); }, 10, 2 );
$GLOBALS['wphx_306_05_users'][7] = new WP_User( 7, 'api-user', 'api@example.test' );

$observations = array();
$password = 'correct horse battery staple';
$wp_hash = wp_hash_password( $password );
$observations['password:wp-hash-summary'] = wphx_306_05_hash_summary( $wp_hash );
$observations['password:wp-check-ok'] = wp_check_password( $password, $wp_hash, 7 );
$observations['password:wp-check-bad'] = wp_check_password( 'wrong', $wp_hash, 7 );
$observations['password:wp-needs-rehash'] = wp_password_needs_rehash( $wp_hash, 7 );

$bcrypt_hash = password_hash( $password, PASSWORD_BCRYPT, array( 'cost' => 4 ) );
$observations['password:bcrypt-summary'] = wphx_306_05_hash_summary( $bcrypt_hash );
$observations['password:bcrypt-check-ok'] = wp_check_password( $password, $bcrypt_hash, 7 );
$observations['password:bcrypt-needs-rehash'] = wp_password_needs_rehash( $bcrypt_hash, 7 );
$observations['password:md5-check-ok'] = wp_check_password( $password, md5( $password ), 7 );
$observations['password:too-long-hash'] = wp_hash_password( str_repeat( 'x', 4097 ) );
$observations['password:too-long-check'] = wp_check_password( str_repeat( 'x', 4097 ), $wp_hash, 7 );

add_filter( 'check_password', function ( $check, $plain, $hash, $user_id ) { return 'filter-pass' === $plain ? true : $check; }, 10, 4 );
$observations['password:check-filter'] = wp_check_password( 'filter-pass', 'not-a-real-hash', 7 );
add_filter( 'password_needs_rehash', function ( $needs, $hash, $user_id ) { return 'force_rehash' === $user_id ? true : $needs; }, 10, 3 );
$observations['password:rehash-filter'] = wp_password_needs_rehash( $wp_hash, 'force_rehash' );

$app_hash = WP_Application_Passwords::hash_password( 'app-password' );
$observations['app-password:hash-summary'] = wphx_306_05_hash_summary( $app_hash );
$observations['app-password:check-ok'] = WP_Application_Passwords::check_password( 'app-password', $app_hash );
$observations['app-password:check-bad'] = WP_Application_Passwords::check_password( 'wrong', $app_hash );
$observations['app-password:legacy-check'] = WP_Application_Passwords::check_password( $password, $wp_hash );
$observations['app-password:chunk'] = WP_Application_Passwords::chunk_password( 'abcd efgh-ijkl mnop' );

$GLOBALS['wphx_306_05_user_meta'][7][WP_Application_Passwords::USERMETA_KEY_APPLICATION_PASSWORDS] = array(
\tarray(
\t\t'uuid' => 'app-pass-uuid',
\t\t'app_id' => 'client-app',
\t\t'name' => 'Client App',
\t\t'password' => $app_hash,
\t\t'created' => 1700000000,
\t\t'last_used' => null,
\t\t'last_ip' => null,
\t),
);
$success = wp_authenticate_application_password( null, 'api-user', 'app password' );
$observations['app-password:auth-success'] = wphx_306_05_user_summary( $success );
$stored_after_success = WP_Application_Passwords::get_user_application_password( 7, 'app-pass-uuid' );
$observations['app-password:usage-recorded'] = array(
\t'last_used_set' => isset( $stored_after_success['last_used'] ),
\t'last_ip' => $stored_after_success['last_ip'],
);
$observations['app-password:success-actions'] = wphx_306_05_recent_actions( 'application_password_did_authenticate' );

$wrong = wp_authenticate_application_password( null, 'api-user', 'wrong password' );
$observations['app-password:auth-wrong'] = wphx_306_05_error_summary( $wrong );
$missing = wp_authenticate_application_password( null, 'missing-user', 'app password' );
$observations['app-password:auth-missing'] = wphx_306_05_error_summary( $missing );
$observations['app-password:failure-actions'] = wphx_306_05_recent_actions( 'application_password_failed_authentication' );
$observations['app-password:validate-basic-auth'] = wp_validate_application_password( false );

$created_error = WP_Application_Passwords::create_new_application_password( 7, array( 'name' => '' ) );
$observations['app-password:create-empty-name'] = wphx_306_05_error_summary( $created_error );
$observations['errors'] = $GLOBALS['wphx_306_05_php_errors'];

ksort( $observations );
echo json_encode(
\tarray(
\t\t'mode' => $mode,
\t\t'observations' => $observations,
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
);
`
  );
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-306-password-application`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function runProbe(mode, root) {
  const output = command("php", [PROBE, mode, root]);
  return {
    mode,
    command: `php ${PROBE} ${mode} ${root}`,
    raw_output_sha256: sha256(output),
    result: JSON.parse(output)
  };
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/user-password-application-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "oracle_fixture",
      name: "users/auth password and application-password differential fixture",
      area: "wp-includes/pluggable.php wp-includes/class-wp-application-passwords.php wp-includes/user.php",
      public_contract:
        "This fixture records vanilla WordPress password and application-password behavior that the Haxe auth adapter must satisfy. It does not claim Haxe-owned public PHP replacement."
    },
    ownership_state: "oracle_fixture",
    ownership_axes: {
      semantic_owner: "upstream_oracle",
      adapter_contract_owner: "not_claimed",
      emission_strategy: "upstream_source_mirror_fixture",
      execution_provider: "php_oracle_process",
      compatibility_evidence: "targeted_semantic_parity"
    },
    bridge: {
      exists: true,
      kind: "oracle-source-mirror-fixture",
      removal_gate:
        "Replace candidate mirror with generated original-path PHP once WPHX-306 public adapter contracts exist."
    },
    owned_paths: ["tools/wp-core/run-user-password-application-fixture.mjs", OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-306-password-application",
        "npm run wp:core:wphx-306-password-application:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-306-05-password-application-fixture"],
      manifest_digest: manifestSha
    }
  };
}

rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
writeProbe();

const oracleRun = runProbe("oracle", ORACLE_ROOT);
const candidateRun = runProbe("candidate", CANDIDATE_ROOT);
const observationsEqual = JSON.stringify(oracleRun.result.observations) === JSON.stringify(candidateRun.result.observations);

if (!observationsEqual) {
  console.error(JSON.stringify({ status: "failed", oracle: oracleRun.result, candidate: candidateRun.result }, null, 2));
  process.exit(1);
}

const manifest = {
  schema: "wphx.wp-core-user-password-application-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-user-password-application-fixture.mjs",
  upstream: {
    repo: UPSTREAM_ROOT,
    commit: WP_REF,
    source_files: SOURCE_FILES.map(sourceRecord)
  },
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    foundation_manifest: inputRecord(FOUNDATION)
  },
  fixture: {
    evidence_class: "targeted_semantic_parity",
    artifact_scope: "oracle_source_mirror_fixture",
    source_files: SOURCE_FILES,
    covered_symbols: COVERED_SYMBOLS,
    cases: FIXTURE_CASES,
    normalization: [
      "Password and application-password hashes are summarized by family and length rather than committed raw values.",
      "Action arguments containing generated passwords or hash values are summarized by length/digest or hash family.",
      "Bcrypt cost is reduced through the public wp_hash_password_options filter for fixture speed; behavior family remains the asserted contract."
    ],
    candidate_policy: {
      public_php_replacement_claimed: false,
      haxe_semantic_ownership_claimed: false,
      handwritten_production_php_added: false,
      note:
        "The candidate side currently mirrors locked upstream source to establish a stable differential fixture. A later WPHX-306 slice must replace the candidate mirror with generated original-path PHP before ownership can be upgraded."
    }
  },
  runs: {
    oracle: oracleRun,
    candidate: candidateRun,
    observations_equal: observationsEqual
  },
  parity: {
    status: observationsEqual ? "passed" : "failed",
    oracle_observation_sha256: sha256(JSON.stringify(oracleRun.result.observations)),
    candidate_observation_sha256: sha256(JSON.stringify(candidateRun.result.observations))
  },
  remaining_gaps: [
    {
      id: "generated-auth-adapter-not-installed",
      owner: "WPHX-306",
      detail:
        "Password and application-password behavior is only proven between upstream mirrors. Generated public PHP and typed Adapter IR are not yet installed."
    },
    {
      id: "full-application-password-ui-rest-not-covered",
      owner: "WPHX-306/WPHX-311/WPHX-316",
      detail:
        "This fixture covers core authentication functions and class methods, not admin UI or REST controller flows."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: observationsEqual ? "passed" : "failed",
    cases: FIXTURE_CASES.length,
    covered_symbols: COVERED_SYMBOLS.length,
    public_php_replacement_claimed: false,
    artifact_scope: "oracle_source_mirror_fixture"
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-306-05-password-application-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "password and application-password differential fixture manifest" },
    { path: OWNERSHIP, role: "ownership manifest for password and application-password fixture" },
    { path: "tools/wp-core/run-user-password-application-fixture.mjs", role: "fixture generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-306-password-application",
    "npm run wp:core:wphx-306-password-application:check",
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

console.log(JSON.stringify({ status: "passed", output: OUT, ownership: OWNERSHIP, receipt: RECEIPT }, null, 2));
