#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-lky1",
  external_ref: "WPHX-318.03",
  title: "WPHX-318.03 - Add XML-RPC endpoint server oracle fixture"
};
const RECORDED_AT = "2026-07-04T12:10:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-xmlrpc-endpoint-server-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-318-03";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const ENDPOINT_PROBE = `${OUT_ROOT}/endpoint-probe.php`;
const OUT = "manifests/wp-core/wphx-318-03-xmlrpc-endpoint-server-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-318-03-xmlrpc-endpoint-server-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-318-03-xmlrpc-endpoint-server-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-318-01-xmlrpc-legacy-deprecated-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-318-02-xmlrpc-legacy-adapter-contract-candidate.v1.json";

const SOURCE_FILES = [
  "src/xmlrpc.php",
  "src/wp-includes/class-IXR.php",
  "src/wp-includes/class-wp-xmlrpc-server.php"
];
const SUPPORT_PATHS = ["src/wp-includes/IXR"];
const COVERED_SYMBOLS = [
  "xmlrpc.php",
  "logIO",
  "wp_xmlrpc_server::__construct",
  "wp_xmlrpc_server::serve_request",
  "wp_xmlrpc_server::sayHello",
  "wp_xmlrpc_server::addTwoNumbers",
  "wp_xmlrpc_server::login",
  "wp_xmlrpc_server::login_pass_ok",
  "wp_xmlrpc_server::escape",
  "wp_xmlrpc_server::error",
  "wp_xmlrpc_server::minimum_args",
  "wp_xmlrpc_server::blogger_getUsersBlogs",
  "wp_xmlrpc_server::initialise_blog_option_info",
  "IXR_Server",
  "IXR_Error",
  "xmlrpc_methods",
  "xmlrpc_enabled",
  "xmlrpc_call",
  "xmlrpc_rsd_apis",
  "wp_xmlrpc_server_class"
];
const CASES = [
  { id: "endpoint:rsd", focus: "xmlrpc.php emits RSD XML through copied endpoint route and deterministic WordPress stubs" },
  { id: "endpoint:dispatch-filtered-class", focus: "xmlrpc.php trims request data, applies wp_xmlrpc_server_class, constructs server, and calls serve_request" },
  { id: "server:method-registry", focus: "wp_xmlrpc_server constructor registers method families, applies xmlrpc_methods, and records enabled state" },
  { id: "server:demo-error-escape", focus: "demo methods, invalid argument IXR_Error, escape recursion, minimum args, and error output" },
  { id: "server:login-auth", focus: "login success, login_pass_ok deprecation path, failed auth filter, and auth_failed short-circuit" },
  { id: "server:blogger-users-blogs", focus: "single-site Blogger users-blogs authentication, xmlrpc_call hook, option/site URL shaping, and capability flag" }
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
  return { path, bytes: statSync(path).size, sha256: sha256File(path) };
}

function upstreamPath(path) {
  return `${UPSTREAM_ROOT}/${path}`;
}

function mirrorPath(root, path) {
  return `${root}/${path.replace(/^src\//, "")}`;
}

function sourceRecord(path) {
  return {
    path,
    repo_path: upstreamPath(path),
    bytes: statSync(upstreamPath(path)).size,
    sha256: sha256File(upstreamPath(path))
  };
}

function listFiles(path) {
  const source = upstreamPath(path);
  const stat = statSync(source);
  if (stat.isFile()) return [path];
  return readdirSync(upstreamPath(path), { withFileTypes: true }).flatMap((entry) => {
    const child = `${path}/${entry.name}`;
    return entry.isDirectory() ? listFiles(child) : [child];
  }).sort();
}

function writeStub(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function mirrorSources(root) {
  for (const path of SOURCE_FILES) {
    const target = mirrorPath(root, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(upstreamPath(path), target);
  }
  for (const path of SUPPORT_PATHS) {
    const target = mirrorPath(root, path);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(upstreamPath(path), target, { recursive: true });
  }
  writeStub(`${root}/wp-admin/includes/admin.php`, "<?php\n$GLOBALS['wphx_required_admin'] = true;\n");
  writeStub(
    `${root}/wp-load.php`,
    `<?php
if ( ! defined( 'ABSPATH' ) ) {
\tdefine( 'ABSPATH', __DIR__ . '/' );
}
if ( ! defined( 'WPINC' ) ) {
\tdefine( 'WPINC', 'wp-includes' );
}

$GLOBALS['wphx_actions'] = $GLOBALS['wphx_actions'] ?? array();
$GLOBALS['wphx_filters'] = $GLOBALS['wphx_filters'] ?? array();
$GLOBALS['wphx_case'] = $GLOBALS['wphx_case'] ?? getenv( 'WPHX_CASE' );

class WP_Error {
\tprivate $code;
\tprivate $message;
\tpublic function __construct( $code = '', $message = '' ) {
\t\t$this->code = $code;
\t\t$this->message = $message;
\t}
\tpublic function get_error_code() { return $this->code; }
\tpublic function get_error_message() { return $this->message; }
}

class Wphx_Recording_XMLRPC_Server {
\tpublic function serve_request() {
\t\techo json_encode( array(
\t\t\t'kind' => 'endpoint-dispatch',
\t\t\t'class' => __CLASS__,
\t\t\t'xmlrpc_request' => defined( 'XMLRPC_REQUEST' ) && XMLRPC_REQUEST,
\t\t\t'cookies_cleared' => array() === $_COOKIE,
\t\t\t'raw_post_data' => $GLOBALS['HTTP_RAW_POST_DATA'] ?? null,
\t\t\t'required_admin' => ! empty( $GLOBALS['wphx_required_admin'] ),
\t\t\t'filters' => $GLOBALS['wphx_filters'],
\t\t) );
\t}
}

function __( $text, $domain = 'default' ) { return $text; }
function _deprecated_function( $function_name, $version, $replacement = '' ) {
\t$GLOBALS['wphx_deprecated'][] = array( 'function' => $function_name, 'version' => $version, 'replacement' => $replacement );
}
function get_option( $name, $default = false ) {
\t$options = array(
\t\t'blog_charset' => 'UTF-8',
\t\t'home' => 'https://example.test',
\t\t'blogname' => 'Fixture Blog',
\t\t'siteurl' => 'https://example.test',
\t);
\treturn array_key_exists( $name, $options ) ? $options[ $name ] : $default;
}
function bloginfo_rss( $show = '' ) { echo 'url' === $show ? 'https://example.test' : ''; }
function site_url( $path = '', $scheme = null ) { return 'https://example.test/' . ltrim( $path, '/' ); }
function home_url( $path = '' ) { return 'https://example.test/' . ltrim( $path, '/' ); }
function get_bloginfo( $show = '' ) { return 'version' === $show ? '7.0-fixture' : ''; }
function wp_login_url() { return 'https://example.test/wp-login.php'; }
function get_admin_url() { return 'https://example.test/wp-admin/'; }
function current_theme_supports( $feature ) { return 'post-thumbnails' === $feature; }
function is_wp_error( $thing ) { return $thing instanceof WP_Error; }
function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_actions'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) );
\tif ( 'xmlrpc_rsd_apis' === $hook_name ) {
\t\techo '<api name="Fixture" blogID="1" preferred="false" apiLink="https://example.test/fixture-rpc" />';
\t}
}
function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_filters'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) + 1 );
\tif ( 'wp_xmlrpc_server_class' === $hook_name && 'endpoint:dispatch-filtered-class' === $GLOBALS['wphx_case'] ) {
\t\treturn 'Wphx_Recording_XMLRPC_Server';
\t}
\treturn $value;
}
`
  );
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    ENDPOINT_PROBE,
    `<?php
$root = realpath( rtrim( $argv[1], '/\\\\' ) );
$case = $argv[2] ?? '';

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

$GLOBALS['wphx_case'] = $case;
putenv( 'WPHX_CASE=' . $case );

if ( 'endpoint:rsd' === $case ) {
\t$_GET['rsd'] = '1';
\t$_SERVER['REQUEST_METHOD'] = 'GET';
\tchdir( $root );
\trequire $root . '/xmlrpc.php';
}

if ( 'endpoint:dispatch-filtered-class' === $case ) {
\t$_SERVER['REQUEST_METHOD'] = 'POST';
\t$_COOKIE = array( 'session' => 'discard-me' );
\t$HTTP_RAW_POST_DATA = "  <?xml version=\\"1.0\\"?><methodCall><methodName>demo.sayHello</methodName></methodCall>  ";
\t$GLOBALS['HTTP_RAW_POST_DATA'] = $HTTP_RAW_POST_DATA;
\tchdir( $root );
\trequire $root . '/xmlrpc.php';
}

throw new RuntimeException( 'Unknown endpoint case ' . $case );
`
  );
  writeFileSync(
    PROBE,
    `<?php
$root = realpath( rtrim( $argv[1], '/\\\\' ) );
$case = $argv[2] ?? '';

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

$GLOBALS['wphx_case'] = $case;
putenv( 'WPHX_CASE=' . $case );

if ( 'endpoint:rsd' === $case ) {
\t$_GET['rsd'] = '1';
\t$_SERVER['REQUEST_METHOD'] = 'GET';
\tchdir( $root );
\trequire $root . '/xmlrpc.php';
}

if ( 'endpoint:dispatch-filtered-class' === $case ) {
\t$_SERVER['REQUEST_METHOD'] = 'POST';
\t$_COOKIE = array( 'session' => 'discard-me' );
\t$HTTP_RAW_POST_DATA = "  <?xml version=\\"1.0\\"?><methodCall><methodName>demo.sayHello</methodName></methodCall>  ";
\t$GLOBALS['HTTP_RAW_POST_DATA'] = $HTTP_RAW_POST_DATA;
\tchdir( $root );
\trequire $root . '/xmlrpc.php';
}

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );

$GLOBALS['wphx_filters'] = array();
$GLOBALS['wphx_actions'] = array();
$GLOBALS['wphx_deprecated'] = array();
$GLOBALS['wphx_status_headers'] = array();
$GLOBALS['wphx_current_user'] = null;
$GLOBALS['wphx_auth_fail'] = false;
$GLOBALS['wphx_manage_options'] = true;

class WP_Error {
\tprivate $code;
\tprivate $message;
\tpublic function __construct( $code = '', $message = '' ) {
\t\t$this->code = $code;
\t\t$this->message = $message;
\t}
\tpublic function get_error_code() { return $this->code; }
\tpublic function get_error_message() { return $this->message; }
}

function __( $text, $domain = 'default' ) { return $text; }
function is_wp_error( $thing ) { return $thing instanceof WP_Error; }
function _deprecated_function( $function_name, $version, $replacement = '' ) {
\t$GLOBALS['wphx_deprecated'][] = array( 'function' => $function_name, 'version' => $version, 'replacement' => $replacement );
}
function wp_slash( $value ) {
\treturn is_array( $value ) ? array_map( 'wp_slash', $value ) : addslashes( (string) $value );
}
function wp_unslash( $value ) {
\treturn is_array( $value ) ? array_map( 'wp_unslash', $value ) : stripslashes( (string) $value );
}
function get_option( $name, $default = false ) {
\t$options = array(
\t\t'blog_charset' => 'UTF-8',
\t\t'home' => 'https://example.test',
\t\t'blogname' => 'Fixture Blog',
\t\t'siteurl' => 'https://example.test',
\t\t'gmt_offset' => -6,
\t\t'blogdescription' => 'Fixture Tagline',
\t);
\treturn array_key_exists( $name, $options ) ? $options[ $name ] : $default;
}
function get_bloginfo( $show = '' ) { return 'version' === $show ? '7.0-fixture' : ''; }
function wp_login_url() { return 'https://example.test/wp-login.php'; }
function get_admin_url() { return 'https://example.test/wp-admin/'; }
function current_theme_supports( $feature ) { return 'post-thumbnails' === $feature; }
function current_user_can( $capability ) { return 'manage_options' === $capability ? $GLOBALS['wphx_manage_options'] : true; }
function is_multisite() { return false; }
function site_url( $path = '', $scheme = null ) { return 'https://example.test/' . ltrim( $path, '/' ); }
function home_url( $path = '' ) { return 'https://example.test/' . ltrim( $path, '/' ); }
function wp_authenticate( $username, $password ) {
\tif ( $GLOBALS['wphx_auth_fail'] || 'fixture-user' !== $username || 'secret' !== $password ) {
\t\treturn new WP_Error( 'invalid_login', 'bad credentials' );
\t}
\treturn (object) array( 'ID' => 42, 'user_login' => $username );
}
function wp_set_current_user( $user_id ) { $GLOBALS['wphx_current_user'] = (int) $user_id; }
function status_header( $code ) { $GLOBALS['wphx_status_headers'][] = (int) $code; }
function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_actions'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) );
}
function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_filters'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) + 1 );
\tif ( 'xmlrpc_methods' === $hook_name ) {
\t\t$value['fixture.echo'] = 'this:sayHello';
\t\tunset( $value['demo.addTwoNumbers'] );
\t}
\tif ( 'xmlrpc_login_error' === $hook_name && $value instanceof IXR_Error ) {
\t\t$value->message = 'filtered login failure';
\t}
\tif ( 'xmlrpc_blog_options' === $hook_name ) {
\t\t$value['fixture_option'] = array( 'desc' => 'Fixture Option', 'readonly' => true, 'value' => 'fixture-value' );
\t}
\tif ( 'xmlrpc_enabled' === $hook_name && ! empty( $GLOBALS['wphx_disable_xmlrpc'] ) ) {
\t\treturn false;
\t}
\treturn $value;
}

require ABSPATH . WPINC . '/class-IXR.php';
require ABSPATH . WPINC . '/class-wp-xmlrpc-server.php';

class Wphx_Test_XMLRPC_Server extends wp_xmlrpc_server {
\tpublic $captured_output = array();
\tpublic function output( $xml ) {
\t\t$this->captured_output[] = $xml;
\t}
\tpublic function minimum_args_public( $args, $count ) {
\t\treturn $this->minimum_args( $args, $count );
\t}
\tpublic function enabled_reflection() {
\t\t$property = new ReflectionProperty( wp_xmlrpc_server::class, 'is_enabled' );
\t\t$property->setAccessible( true );
\t\treturn $property->getValue( $this );
\t}
}

function ixr_summary( $value ) {
\tif ( $value instanceof IXR_Error ) {
\t\treturn array( 'class' => get_class( $value ), 'code' => $value->code, 'message' => $value->message );
\t}
\treturn $value;
}

$server = new Wphx_Test_XMLRPC_Server();
$result = array( 'case' => $case );
$assertions = array();

switch ( $case ) {
\tcase 'server:method-registry':
\t\t$result['method_count'] = count( $server->methods );
\t\t$result['has_wp_get_posts'] = isset( $server->methods['wp.getPosts'] );
\t\t$result['has_pingback_ping'] = isset( $server->methods['pingback.ping'] );
\t\t$result['has_fixture_echo'] = isset( $server->methods['fixture.echo'] );
\t\t$result['has_demo_add_two_numbers'] = isset( $server->methods['demo.addTwoNumbers'] );
\t\t$result['blog_options'] = array(
\t\t\t'has_software_name' => isset( $server->blog_options['software_name'] ),
\t\t\t'has_fixture_option' => isset( $server->blog_options['fixture_option'] ),
\t\t\t'blog_title_readonly' => $server->blog_options['blog_title']['readonly'],
\t\t);
\t\t$result['enabled'] = $server->enabled_reflection();
\t\t$result['filters'] = $GLOBALS['wphx_filters'];
\t\t$assertions['core_methods_present'] = $result['method_count'] >= 60 && $result['has_wp_get_posts'] && $result['has_pingback_ping'];
\t\t$assertions['method_filter_applied'] = $result['has_fixture_echo'] && ! $result['has_demo_add_two_numbers'];
\t\t$assertions['blog_options_filter_applied'] = $result['blog_options']['has_software_name'] && $result['blog_options']['has_fixture_option'] && false === $result['blog_options']['blog_title_readonly'];
\t\t$assertions['enabled'] = true === $result['enabled'];
\t\tbreak;

\tcase 'server:demo-error-escape':
\t\t$escaped = array( 'quote' => "a'b", 'nested' => array( 'slash' => 'c\\\\d' ) );
\t\t$server->escape( $escaped );
\t\t$bad_add = $server->addTwoNumbers( array( 2, '3' ) );
\t\t$minimum_ok = $server->minimum_args_public( array( 'one', 'two' ), 2 );
\t\t$minimum_bad = $server->minimum_args_public( array( 'one' ), 2 );
\t\t$server->error( 499, 'fixture error' );
\t\t$result['hello'] = $server->sayHello();
\t\t$result['bad_add'] = ixr_summary( $bad_add );
\t\t$result['escaped'] = $escaped;
\t\t$result['minimum_ok'] = $minimum_ok;
\t\t$result['minimum_bad'] = $minimum_bad;
\t\t$result['minimum_error'] = ixr_summary( $server->error );
\t\t$result['captured_output_contains_fault'] = str_contains( $server->captured_output[0] ?? '', '<int>499</int>' ) && str_contains( $server->captured_output[0] ?? '', 'fixture error' );
\t\t$assertions['hello'] = 'Hello!' === $result['hello'];
\t\t$assertions['bad_add_error'] = 400 === $result['bad_add']['code'];
\t\t$assertions['escape_recursive'] = "a\\\\'b" === $escaped['quote'] && 'c\\\\\\\\d' === $escaped['nested']['slash'];
\t\t$assertions['minimum_args'] = true === $minimum_ok && false === $minimum_bad && 400 === $result['minimum_error']['code'];
\t\t$assertions['error_output'] = true === $result['captured_output_contains_fault'];
\t\tbreak;

\tcase 'server:login-auth':
\t\t$user = $server->login( 'fixture-user', 'secret' );
\t\t$login_pass_ok = $server->login_pass_ok( 'fixture-user', 'secret' );
\t\t$GLOBALS['wphx_auth_fail'] = true;
\t\t$failed = $server->login( 'fixture-user', 'secret' );
\t\t$GLOBALS['wphx_auth_fail'] = false;
\t\t$short_circuit = $server->login( 'fixture-user', 'secret' );
\t\t$result['user'] = array( 'id' => $user->ID, 'login' => $user->user_login );
\t\t$result['current_user'] = $GLOBALS['wphx_current_user'];
\t\t$result['login_pass_ok'] = $login_pass_ok;
\t\t$result['failed'] = $failed;
\t\t$result['failed_error'] = ixr_summary( $server->error );
\t\t$result['short_circuit'] = $short_circuit;
\t\t$result['filters'] = $GLOBALS['wphx_filters'];
\t\t$result['deprecated'] = $GLOBALS['wphx_deprecated'];
\t\t$assertions['success'] = 42 === $user->ID && 42 === $GLOBALS['wphx_current_user'];
\t\t$assertions['login_pass_ok'] = true === $login_pass_ok;
\t\t$assertions['failed_error_filtered'] = false === $failed && 'filtered login failure' === $result['failed_error']['message'];
\t\t$assertions['auth_failed_short_circuit'] = false === $short_circuit && 'filtered login failure' === ixr_summary( $server->error )['message'];
\t\t$assertions['login_pass_ok_has_no_deprecation_call'] = count( $GLOBALS['wphx_deprecated'] ) === 0;
\t\tbreak;

\tcase 'server:blogger-users-blogs':
\t\t$result['blogs'] = $server->blogger_getUsersBlogs( array( 1, 'fixture-user', 'secret' ) );
\t\t$result['actions'] = $GLOBALS['wphx_actions'];
\t\t$blog = $result['blogs'][0];
\t\t$assertions['shape'] = true === $blog['isAdmin'] && 'https://example.test/' === $blog['url'] && '1' === $blog['blogid'] && 'Fixture Blog' === $blog['blogName'] && 'https://example.test/xmlrpc.php' === $blog['xmlrpc'];
\t\t$assertions['hook'] = 'xmlrpc_call' === $GLOBALS['wphx_actions'][0]['hook'] && 3 === $GLOBALS['wphx_actions'][0]['arg_count'];
\t\tbreak;

\tdefault:
\t\tthrow new RuntimeException( 'Unknown case ' . $case );
}

$result['assertions'] = $assertions;
$result['passed'] = ! in_array( false, $assertions, true );
echo json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\\n";
`
  );
}

function parseCaseOutput(caseId, output) {
  if (caseId === "endpoint:rsd") {
    return {
      case: caseId,
      contains_rsd: output.includes("<rsd version=\"1.0\""),
      contains_wordpress_api: output.includes('api name="WordPress"'),
      contains_fixture_api: output.includes('api name="Fixture"'),
      contains_xmlrpc_url: output.includes('https://example.test/xmlrpc.php'),
      output_sha256: sha256(output),
      passed:
        output.includes("<rsd version=\"1.0\"") &&
        output.includes('api name="WordPress"') &&
        output.includes('api name="Fixture"') &&
        output.includes('https://example.test/xmlrpc.php')
    };
  }
  if (caseId === "endpoint:dispatch-filtered-class") {
    const parsed = JSON.parse(output);
    parsed.passed =
      parsed.kind === "endpoint-dispatch" &&
      parsed.class === "Wphx_Recording_XMLRPC_Server" &&
      parsed.xmlrpc_request === true &&
      parsed.cookies_cleared === true &&
      parsed.raw_post_data === '<?xml version="1.0"?><methodCall><methodName>demo.sayHello</methodName></methodCall>' &&
      parsed.required_admin === true &&
      parsed.filters.some((filter) => filter.hook === "wp_xmlrpc_server_class");
    return parsed;
  }
  return JSON.parse(output);
}

function runCase(root, caseId) {
  const probe = caseId.startsWith("endpoint:") ? ENDPOINT_PROBE : PROBE;
  const output = command("php", [probe, root, caseId]);
  return parseCaseOutput(caseId, output);
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    if (readFileSync(path, "utf8") !== content) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-318-xmlrpc-endpoint-server-oracle-fixture`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/xmlrpc-endpoint-server-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "copied_oracle_fixture",
      name: "selected xmlrpc.php endpoint and wp_xmlrpc_server behavior",
      area: "xmlrpc.php wp-includes/class-wp-xmlrpc-server.php wp-includes/class-IXR.php wp-includes/IXR/*",
      public_contract:
        "This fixture executes mirrored WordPress 7.0 XML-RPC endpoint/server PHP under deterministic stubs. It proves selected copied-oracle/candidate behavior matches, not Haxe-owned runtime logic or generated public PHP replacement."
    },
    ownership_state: "copied_oracle_evidence",
    ownership_axes: {
      semantic_owner: "upstream_wordpress",
      adapter_contract_owner: "haxe_typed_precedent",
      emission_strategy: "copied_upstream_public_php_with_deterministic_stubs",
      execution_provider: "php_cli",
      compatibility_evidence: "targeted_copied_oracle_fixture"
    },
    bridge: {
      exists: true,
      kind: "copied-upstream-public-php-oracle-candidate-fixture",
      removal_gate:
        "Replace copied XML-RPC public PHP with generated original-path adapters or whole-file WPHX PHP evidence, then pass endpoint bootstrap, wp_xmlrpc_server method registry/auth/error/fault, IXR serialization, selected upstream PHPUnit, installed HTTP route, database-backed, and generated-overlay gates before claiming durable ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    upstream_copied_paths: SOURCE_FILES.concat(SUPPORT_PATHS),
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-318-xmlrpc-endpoint-server-oracle-fixture",
        "npm run wp:core:wphx-318-xmlrpc-endpoint-server-oracle-fixture:check",
        "npm run operations:bridge-claim-guardrails:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-318-03-xmlrpc-endpoint-server-oracle-fixture"],
      manifest_digest: manifestSha
    },
    notes:
      "Oracle and candidate package roots are regenerated from ../wordpress-develop. Candidate divergence requires an explicit generated overlay manifest before any public PHP replacement claim."
  };
}

rmSync(OUT_ROOT, { recursive: true, force: true });
mkdirSync(OUT_ROOT, { recursive: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
writeProbe();

const oracleObservations = {};
const candidateObservations = {};
for (const testCase of CASES) {
  oracleObservations[testCase.id] = runCase(ORACLE_ROOT, testCase.id);
  candidateObservations[testCase.id] = runCase(CANDIDATE_ROOT, testCase.id);
}

const matches = JSON.stringify(oracleObservations) === JSON.stringify(candidateObservations);
const allCasesPassed = Object.values(candidateObservations).every((observation) => observation.passed === true);
if (!matches || !allCasesPassed) {
  console.error(JSON.stringify({ status: "failed", matches, allCasesPassed, oracleObservations, candidateObservations }, null, 2));
  process.exit(1);
}

const manifest = {
  schema: "wphx.wp-core-xmlrpc-endpoint-server-oracle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["copied_oracle_behavior", "targeted_runtime_observation"],
  artifact_scope: "bridge",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT),
    upstream_sources: SOURCE_FILES.map(sourceRecord),
    upstream_support_paths: SUPPORT_PATHS.map((path) => ({
      path,
      repo_path: upstreamPath(path),
      file_count: listFiles(path).length,
      files: listFiles(path).map(sourceRecord)
    }))
  },
  fixture: {
    candidate_kind: "copied_upstream_xmlrpc_endpoint_server_fixture",
    cases: CASES,
    covered_symbols: COVERED_SYMBOLS,
    source_files: SOURCE_FILES,
    support_paths: SUPPORT_PATHS,
    oracle_root: ORACLE_ROOT,
    candidate_root: CANDIDATE_ROOT,
    oracle_observations: oracleObservations,
    candidate_observations: candidateObservations,
    observation_count: CASES.length,
    matched: matches,
    all_cases_passed: allCasesPassed
  },
  claims: {
    behavior_parity_claimed: false,
    copied_oracle_candidate_match_claimed: true,
    public_php_replacement_claimed: false,
    haxe_runtime_ownership_claimed: false,
    xmlrpc_request_response_parity_claimed: false,
    ixr_serialization_ownership_claimed: false,
    installed_http_route_execution_claimed: false,
    database_backed_state_claimed: false,
    upstream_phpunit_pass_pass_claimed: false,
    bundled_plugin_implementation_ownership_claimed: false,
    generated_original_path_adapter_claimed: false,
    generated_overlay_claimed: false
  },
  non_claims: [
    "Does not replace xmlrpc.php, wp-includes/class-wp-xmlrpc-server.php, wp-includes/class-IXR.php, or wp-includes/IXR/* with generated WPHX PHP.",
    "Does not claim full XML-RPC request/response parity, full IXR XML parser/serializer ownership, installed HTTP route execution, database-backed behavior, post/comment/term/media/pingback behavior, upstream PHPUnit pass/pass, or bundled plugin implementation ownership.",
    "Does not claim Haxe-owned XML-RPC runtime logic or durable original-path adapter ownership; the candidate root is copied upstream PHP with deterministic stubs."
  ],
  validation_result: {
    status: "passed",
    matches,
    all_cases_passed: allCasesPassed,
    observation_count: CASES.length,
    covered_symbol_count: COVERED_SYMBOLS.length
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const ownershipText = JSON.stringify(ownershipManifest(sha256(manifestText)), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-318-03-xmlrpc-endpoint-server-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "XML-RPC endpoint/server copied-oracle fixture manifest" },
    { path: OWNERSHIP, role: "XML-RPC endpoint/server copied-oracle fixture ownership manifest" },
    { path: RUNNER, role: "deterministic copied-oracle/candidate runner" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-318-xmlrpc-endpoint-server-oracle-fixture",
    "npm run wp:core:wphx-318-xmlrpc-endpoint-server-oracle-fixture:check",
    "npm run operations:bridge-claim-guardrails:check"
  ],
  validation_result: manifest.validation_result,
  manifest_sha256: sha256(manifestText),
  ownership_sha256: sha256(ownershipText),
  related_receipts: [
    "receipt:wphx-318-01-xmlrpc-legacy-deprecated-surface",
    "receipt:wphx-318-02-xmlrpc-legacy-adapter-contract-candidate",
    "receipt:wphx-312-34-http-ixr-client-oracle-fixture"
  ]
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

console.log(JSON.stringify(manifest.validation_result, null, 2));
