#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.18.28",
  external_ref: "WPHX-312.41",
  title: "WPHX-312.41 - Add WP_Http helper oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-wp-http-helper-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-312-41";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-312-41-wp-http-helper-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-41-wp-http-helper-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-41-wp-http-helper-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const HTTP_CORE_FIXTURE = "manifests/wp-core/wphx-312-03-http-cron-mail-oracle-fixture.v1.json";
const COOKIE_FIXTURE = "manifests/wp-core/wphx-312-39-http-cookie-object-oracle-fixture.v1.json";
const ENCODING_FIXTURE = "manifests/wp-core/wphx-312-40-http-encoding-oracle-fixture.v1.json";

const SOURCE_FILES = ["src/wp-includes/class-wp-http.php", "src/wp-includes/class-wp-http-cookie.php"];
const COVERED_SYMBOLS = [
  "WP_Http::normalize_cookies",
  "WP_Http::browser_redirect_compatibility",
  "WP_Http::validate_redirects",
  "WP_Http::make_absolute_url",
  "WP_Http::handle_redirects",
  "WP_Http::is_ip_address",
  "WP_Http_Cookie",
  "WpOrg\\Requests\\Cookie\\Jar",
  "WpOrg\\Requests\\Cookie",
  "WpOrg\\Requests\\Response",
  "WpOrg\\Requests\\Exception",
  "WpOrg\\Requests\\Requests::GET",
  "wp_http_validate_url",
  "wp_parse_url",
  "wp_remote_request",
  "WP_Error",
  "__"
];
const CASES = [
  { id: "wp-http:normalize-cookies", focus: "WP_Http_Cookie and scalar cookies convert into Requests cookies while non-cookie objects are ignored" },
  { id: "wp-http:browser-redirect-compatibility", focus: "302 redirects switch POST to GET while other redirect statuses preserve request type" },
  { id: "wp-http:validate-redirects", focus: "redirect validation accepts safe URLs and throws the Requests exception/type for invalid URLs" },
  { id: "wp-http:make-absolute-url", focus: "absolute, schemeless, root-relative, relative-parent, query, fragment, empty-base, and parse-failure URL resolution" },
  { id: "wp-http:handle-redirects", focus: "redirect guards, too-many-redirects error, last Location selection, POST-to-GET conversion, cookie filtering, and wp_remote_request handoff" },
  { id: "wp-http:is-ip-address", focus: "IPv4, IPv6, bracketed IPv6, host, and regex-shaped invalid IPv4 detection" }
];

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
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

function mirrorSources(root) {
  for (const path of SOURCE_FILES) {
    const target = mirrorPath(root, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(upstreamPath(path), target);
  }
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
namespace WpOrg\\Requests {
\tclass Autoload {
\t\tpublic static function register() {}
\t}

\tclass Requests {
\t\tpublic const GET = 'GET';

\t\tpublic static function set_certificate_path( $path ) {}
\t}

\tclass Exception extends \\Exception {
\t\tpublic $type;

\t\tpublic function __construct( $message = '', $type = '' ) {
\t\t\tparent::__construct( $message );
\t\t\t$this->type = $type;
\t\t}
\t}

\tclass Response {
\t\tpublic $status_code;

\t\tpublic function __construct( $status_code = 200 ) {
\t\t\t$this->status_code = $status_code;
\t\t}
\t}

\tclass Cookie {
\t\tpublic $name;
\t\tpublic $value;
\t\tpublic $attributes;
\t\tpublic $flags;

\t\tpublic function __construct( $name, $value, $attributes = array(), $flags = array() ) {
\t\t\t$this->name       = $name;
\t\t\t$this->value      = $value;
\t\t\t$this->attributes = $attributes;
\t\t\t$this->flags      = $flags;
\t\t}
\t}
}

namespace WpOrg\\Requests\\Cookie {
\tclass Jar implements \\ArrayAccess, \\IteratorAggregate, \\Countable {
\t\tprivate $cookies = array();

\t\tpublic function offsetExists( $offset ): bool {
\t\t\treturn isset( $this->cookies[ $offset ] );
\t\t}

\t\tpublic function offsetGet( $offset ): mixed {
\t\t\treturn $this->cookies[ $offset ] ?? null;
\t\t}

\t\tpublic function offsetSet( $offset, $value ): void {
\t\t\tif ( null === $offset ) {
\t\t\t\t$this->cookies[] = $value;
\t\t\t} else {
\t\t\t\t$this->cookies[ $offset ] = $value;
\t\t\t}
\t\t}

\t\tpublic function offsetUnset( $offset ): void {
\t\t\tunset( $this->cookies[ $offset ] );
\t\t}

\t\tpublic function getIterator(): \\Traversable {
\t\t\treturn new \\ArrayIterator( $this->cookies );
\t\t}

\t\tpublic function count(): int {
\t\t\treturn count( $this->cookies );
\t\t}
\t}
}

namespace {
$root = rtrim( $argv[1], '/\\\\' );
$case = $argv[2] ?? '';

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );

$GLOBALS['wphx_filters'] = array();
$GLOBALS['wphx_remote_requests'] = array();

function __( $text ) {
\treturn $text;
}

function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_filters'][] = array( 'hook' => $hook_name, 'value' => wphx_summarize( $value ), 'args' => wphx_summarize( $args ) );
\treturn $value;
}

function wp_parse_url( $url ) {
\tif ( 'fixture://parse-fail' === $url || 'fixture://relative-parse-fail' === $url ) {
\t\treturn false;
\t}
\treturn parse_url( $url );
}

function wp_http_validate_url( $location ) {
\t$valid_prefixes = array(
\t\t'https://valid.example/',
\t\t'https://redirect.example/',
\t\t'https://example.test/',
\t);
\tforeach ( $valid_prefixes as $prefix ) {
\t\tif ( 0 === strpos( $location, $prefix ) ) {
\t\t\treturn $location;
\t\t}
\t}
\treturn false;
}

class WP_Error {
\tprivate $code;
\tprivate $message;

\tpublic function __construct( $code, $message = '' ) {
\t\t$this->code    = $code;
\t\t$this->message = $message;
\t}

\tpublic function get_error_code() {
\t\treturn $this->code;
\t}

\tpublic function get_error_message() {
\t\treturn $this->message;
\t}
}

function is_wp_error( $value ) {
\treturn $value instanceof WP_Error;
}

function wp_remote_request( $url, $args ) {
\t$entry = array( 'url' => $url, 'args' => wphx_summarize( $args ) );
\t$GLOBALS['wphx_remote_requests'][] = $entry;
\treturn array( 'fixture_remote_request' => $entry );
}

function wphx_summarize( $value ) {
\tif ( $value instanceof WP_Error ) {
\t\treturn array( 'class' => get_class( $value ), 'code' => $value->get_error_code(), 'message' => $value->get_error_message() );
\t}
\tif ( $value instanceof WP_Http_Cookie ) {
\t\treturn array(
\t\t\t'class' => get_class( $value ),
\t\t\t'name' => $value->name,
\t\t\t'value' => $value->value,
\t\t\t'expires' => $value->expires,
\t\t\t'path' => $value->path,
\t\t\t'domain' => $value->domain,
\t\t\t'port' => $value->port,
\t\t\t'host_only' => $value->host_only,
\t\t\t'attributes' => $value->get_attributes(),
\t\t);
\t}
\tif ( $value instanceof WpOrg\\Requests\\Cookie\\Jar ) {
\t\t$out = array();
\t\tforeach ( $value as $key => $cookie ) {
\t\t\t$out[ $key ] = wphx_summarize( $cookie );
\t\t}
\t\treturn array( 'class' => get_class( $value ), 'count' => count( $value ), 'cookies' => $out );
\t}
\tif ( $value instanceof WpOrg\\Requests\\Cookie ) {
\t\treturn array( 'class' => get_class( $value ), 'name' => $value->name, 'value' => $value->value, 'attributes' => $value->attributes, 'flags' => $value->flags );
\t}
\tif ( is_object( $value ) ) {
\t\treturn array( 'class' => get_class( $value ), 'vars' => get_object_vars( $value ) );
\t}
\tif ( is_array( $value ) ) {
\t\t$out = array();
\t\tforeach ( $value as $key => $item ) {
\t\t\t$out[ $key ] = wphx_summarize( $item );
\t\t}
\t\treturn $out;
\t}
\treturn $value;
}

require ABSPATH . WPINC . '/class-wp-http-cookie.php';
require ABSPATH . WPINC . '/class-wp-http.php';

$assertions = array();
$result = array( 'case' => $case );

switch ( $case ) {
\tcase 'wp-http:normalize-cookies':
\t\t$wp_cookie = new WP_Http_Cookie(
\t\t\tarray(
\t\t\t\t'name' => 'auth',
\t\t\t\t'value' => 'token',
\t\t\t\t'expires' => 1893456000,
\t\t\t\t'path' => '/wp/',
\t\t\t\t'domain' => 'example.test',
\t\t\t\t'host_only' => false,
\t\t\t),
\t\t\t'https://example.test/wp/login.php'
\t\t);
\t\t$jar = WP_Http::normalize_cookies(
\t\t\tarray(
\t\t\t\t'auth' => $wp_cookie,
\t\t\t\t'scalar' => 'plain',
\t\t\t\t'int' => 42,
\t\t\t\t'ignored_array' => array( 'array' ),
\t\t\t\t'ignored_object' => (object) array( 'nope' => true ),
\t\t\t)
\t\t);
\t\t$result['jar'] = wphx_summarize( $jar );
\t\t$assertions['count'] = 3 === count( $jar );
\t\t$assertions['wp_cookie_keyed_by_cookie_name'] = isset( $jar['auth'] ) && 'token' === $jar['auth']->value;
\t\t$assertions['wp_cookie_attributes_and_flags'] = array( 'expires' => 1893456000, 'path' => '/wp/', 'domain' => 'example.test' ) === $jar['auth']->attributes && array( 'host-only' => false ) === $jar['auth']->flags;
\t\t$assertions['scalar_values_stringified'] = 'plain' === $jar['scalar']->value && '42' === $jar['int']->value;
\t\t$assertions['ignored_values_absent'] = ! isset( $jar['ignored_array'] ) && ! isset( $jar['ignored_object'] );
\t\tbreak;

\tcase 'wp-http:browser-redirect-compatibility':
\t\t$options302 = array( 'type' => 'POST' );
\t\tWP_Http::browser_redirect_compatibility( 'https://redirect.example/next', array(), 'payload', $options302, new WpOrg\\Requests\\Response( 302 ) );
\t\t$options301 = array( 'type' => 'POST' );
\t\tWP_Http::browser_redirect_compatibility( 'https://redirect.example/next', array(), 'payload', $options301, new WpOrg\\Requests\\Response( 301 ) );
\t\t$result['options_302'] = $options302;
\t\t$result['options_301'] = $options301;
\t\t$assertions['status_302_switches_to_get'] = 'GET' === $options302['type'];
\t\t$assertions['status_301_preserves_type'] = 'POST' === $options301['type'];
\t\tbreak;

\tcase 'wp-http:validate-redirects':
\t\t$valid = 'no-throw';
\t\t$error = null;
\t\tWP_Http::validate_redirects( 'https://valid.example/path' );
\t\ttry {
\t\t\tWP_Http::validate_redirects( 'ftp://invalid.example/path' );
\t\t} catch ( WpOrg\\Requests\\Exception $exception ) {
\t\t\t$error = array( 'class' => get_class( $exception ), 'message' => $exception->getMessage(), 'type' => $exception->type );
\t\t}
\t\t$result['valid'] = $valid;
\t\t$result['error'] = $error;
\t\t$assertions['valid_no_throw'] = 'no-throw' === $valid;
\t\t$assertions['invalid_exception'] = array( 'class' => 'WpOrg\\\\Requests\\\\Exception', 'message' => 'A valid URL was not provided.', 'type' => 'wp_http.redirect_failed_validation' ) === $error;
\t\tbreak;

\tcase 'wp-http:make-absolute-url':
\t\t$base = 'https://example.test/wp-admin/css/edit.css';
\t\t$result['urls'] = array(
\t\t\t'absolute' => WP_Http::make_absolute_url( 'https://other.test/x', $base ),
\t\t\t'schemeless' => WP_Http::make_absolute_url( '//cdn.example.test:8443/lib.js', $base ),
\t\t\t'root_relative' => WP_Http::make_absolute_url( '/assets/app.js?ver=1#top', $base ),
\t\t\t'relative_parent' => WP_Http::make_absolute_url( '../img/logo.png?x=1#frag', $base ),
\t\t\t'query_fragment' => WP_Http::make_absolute_url( '?updated=1#section', $base ),
\t\t\t'empty_base' => WP_Http::make_absolute_url( 'relative/file.txt', '' ),
\t\t\t'base_parse_fail' => WP_Http::make_absolute_url( 'relative/file.txt', 'fixture://parse-fail' ),
\t\t\t'relative_parse_fail' => WP_Http::make_absolute_url( 'fixture://relative-parse-fail', $base ),
\t\t);
\t\t$assertions['absolute'] = 'https://other.test/x' === $result['urls']['absolute'];
\t\t$assertions['schemeless'] = 'https://cdn.example.test:8443/lib.js' === $result['urls']['schemeless'];
\t\t$assertions['root_relative'] = 'https://example.test/assets/app.js?ver=1#top' === $result['urls']['root_relative'];
\t\t$assertions['relative_parent'] = 'https://example.test/wp-admin/img/logo.png?x=1#frag' === $result['urls']['relative_parent'];
\t\t$assertions['query_fragment'] = 'https://example.test/wp-admin/css/edit.css?updated=1#section' === $result['urls']['query_fragment'];
\t\t$assertions['parse_failures_passthrough'] = 'relative/file.txt' === $result['urls']['empty_base'] && 'relative/file.txt' === $result['urls']['base_parse_fail'] && 'fixture://relative-parse-fail' === $result['urls']['relative_parse_fail'];
\t\tbreak;

\tcase 'wp-http:handle-redirects':
\t\t$base_args = array( '_redirection' => 5, 'redirection' => 2, 'method' => 'POST', 'cookies' => array() );
\t\t$result['guards'] = array(
\t\t\t'no_location' => WP_Http::handle_redirects( 'https://example.test/wp-admin/post.php', $base_args, array( 'headers' => array(), 'response' => array( 'code' => 302 ), 'cookies' => array() ) ),
\t\t\t'non_3xx' => WP_Http::handle_redirects( 'https://example.test/wp-admin/post.php', $base_args, array( 'headers' => array( 'location' => '/next' ), 'response' => array( 'code' => 200 ), 'cookies' => array() ) ),
\t\t\t'no_redirection_requested' => WP_Http::handle_redirects( 'https://example.test/wp-admin/post.php', array( '_redirection' => 0, 'redirection' => 2, 'method' => 'POST', 'cookies' => array() ), array( 'headers' => array( 'location' => '/next' ), 'response' => array( 'code' => 302 ), 'cookies' => array() ) ),
\t\t);
\t\t$too_many = WP_Http::handle_redirects( 'https://example.test/wp-admin/post.php', array( '_redirection' => 5, 'redirection' => 0, 'method' => 'POST', 'cookies' => array() ), array( 'headers' => array( 'location' => '/next' ), 'response' => array( 'code' => 302 ), 'cookies' => array() ) );
\t\t$matching_cookie = new WP_Http_Cookie( array( 'name' => 'session', 'value' => 'ok', 'expires' => 1893456000, 'path' => '/', 'domain' => 'example.test' ), 'https://example.test/' );
\t\t$blocked_cookie = new WP_Http_Cookie( array( 'name' => 'blocked', 'value' => 'no', 'expires' => 1893456000, 'path' => '/blocked/', 'domain' => 'example.test' ), 'https://example.test/blocked/' );
\t\t$success = WP_Http::handle_redirects(
\t\t\t'https://example.test/wp-admin/post.php',
\t\t\t$base_args,
\t\t\tarray(
\t\t\t\t'headers' => array( 'location' => array( '/first', '../next?x=1' ) ),
\t\t\t\t'response' => array( 'code' => 302 ),
\t\t\t\t'cookies' => array( $matching_cookie, $blocked_cookie ),
\t\t\t)
\t\t);
\t\t$result['too_many'] = wphx_summarize( $too_many );
\t\t$result['success'] = wphx_summarize( $success );
\t\t$result['remote_requests'] = $GLOBALS['wphx_remote_requests'];
\t\t$assertions['guards_false'] = false === $result['guards']['no_location'] && false === $result['guards']['non_3xx'] && false === $result['guards']['no_redirection_requested'];
\t\t$assertions['too_many_error'] = $too_many instanceof WP_Error && 'http_request_failed' === $too_many->get_error_code() && 'Too many redirects.' === $too_many->get_error_message();
\t\t$assertions['remote_called_once'] = 1 === count( $GLOBALS['wphx_remote_requests'] );
\t\t$assertions['last_location_and_absolute'] = 'https://example.test/next?x=1' === $GLOBALS['wphx_remote_requests'][0]['url'];
\t\t$assertions['post_302_converted_to_get'] = 'GET' === $GLOBALS['wphx_remote_requests'][0]['args']['method'];
\t\t$assertions['matching_cookie_only'] = 1 === count( $GLOBALS['wphx_remote_requests'][0]['args']['cookies'] ) && 'session' === $GLOBALS['wphx_remote_requests'][0]['args']['cookies'][0]['name'];
\t\tbreak;

\tcase 'wp-http:is-ip-address':
\t\t$result['addresses'] = array(
\t\t\t'ipv4' => WP_Http::is_ip_address( '192.0.2.10' ),
\t\t\t'ipv6' => WP_Http::is_ip_address( '2001:db8::1' ),
\t\t\t'bracketed_ipv6' => WP_Http::is_ip_address( '[2001:db8::1]' ),
\t\t\t'host' => WP_Http::is_ip_address( 'example.test' ),
\t\t\t'regex_shaped_invalid_ipv4' => WP_Http::is_ip_address( '999.999.999.999' ),
\t\t);
\t\t$assertions['ipv4'] = 4 === $result['addresses']['ipv4'];
\t\t$assertions['ipv6'] = 6 === $result['addresses']['ipv6'] && 6 === $result['addresses']['bracketed_ipv6'];
\t\t$assertions['host_false'] = false === $result['addresses']['host'];
\t\t$assertions['regex_shaped_invalid_ipv4_returns_4'] = 4 === $result['addresses']['regex_shaped_invalid_ipv4'];
\t\tbreak;
}

$result['assertions'] = $assertions;
echo json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL;
}
`
  );
}

function runProbe(root) {
  const observations = {};
  for (const fixtureCase of CASES) {
    const output = command("php", [PROBE, root, fixtureCase.id]);
    observations[fixtureCase.id] = JSON.parse(output);
  }
  return observations;
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run without --check to generate it`);
    const existing = readFileSync(path, "utf8");
    if (existing !== content) throw new Error(`${path} is stale; run without --check to refresh it`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wp-http-helper-oracle-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "WP_Http static helper and redirect behavior",
      area: "src/wp-includes/class-wp-http.php src/wp-includes/class-wp-http-cookie.php",
      public_contract:
        "This fixture executes copied WordPress 7.0 wp-includes/class-wp-http.php and class-wp-http-cookie.php in isolated PHP CLI probes with deterministic WordPress and Requests stubs. It observes normalize_cookies, browser_redirect_compatibility, validate_redirects, make_absolute_url, handle_redirects, wp_remote_request handoff, cookie filtering, and is_ip_address behavior without claiming live HTTP transport, Requests network I/O, redirect safety beyond helper validation, proxy/TLS behavior, installed distribution behavior, or generated public PHP ownership."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-stubbed-requests-and-wordpress-boundary",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass live/recorded HTTP transport, Requests redirect/cookie integration, proxy/TLS behavior, selected upstream HTTP PHPUnit, installed distribution routes, and ecosystem fixtures before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-wp-http-helper-oracle-fixture",
        "npm run wp:core:wphx-312-wp-http-helper-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-41-wp-http-helper-oracle-fixture"],
      manifest_digest: manifestSha
    }
  };
}

async function main() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe();

  const oracle = runProbe(ORACLE_ROOT);
  const candidate = runProbe(CANDIDATE_ROOT);
  const observationsMatch = JSON.stringify(oracle) === JSON.stringify(candidate);
  const observationsAssert = Object.values(oracle).every((entry) => Object.values(entry.assertions).every(Boolean));
  if (!observationsMatch) {
    console.error(JSON.stringify({ status: "failed", oracle, candidate }, null, 2));
    process.exit(1);
  }
  if (!observationsAssert) {
    console.error(JSON.stringify({ status: "failed", reason: "fixture assertions failed", oracle }, null, 2));
    process.exit(1);
  }

  const phpLint = SOURCE_FILES.map((path) => ({
    path,
    oracle_lint: command("php", ["-l", mirrorPath(ORACLE_ROOT, path)]),
    candidate_lint: command("php", ["-l", mirrorPath(CANDIDATE_ROOT, path)])
  }));
  const manifest = {
    schema: "wphx.wp-core-wp-http-helper-oracle-fixture.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_classes: ["oracle_source_mirror", "candidate_package_mirror", "php_cli_observed_fixture"],
    artifact_scope: "fixture",
    inputs: {
      surface_manifest: inputRecord(SURFACE),
      adapter_contract_manifest: inputRecord(CONTRACT),
      http_core_fixture_manifest: inputRecord(HTTP_CORE_FIXTURE),
      http_cookie_fixture_manifest: inputRecord(COOKIE_FIXTURE),
      http_encoding_fixture_manifest: inputRecord(ENCODING_FIXTURE),
      runner: inputRecord(RUNNER),
      upstream_sources: SOURCE_FILES.map(sourceRecord)
    },
    fixture: {
      cases: CASES,
      covered_symbols: COVERED_SYMBOLS,
      source_files: SOURCE_FILES,
      probe: { path: PROBE, sha256: sha256File(PROBE) },
      side_effect_policy: {
        external_network_io: false,
        database_io: false,
        live_installed_wordpress: false,
        php_cli: true,
        runtime_stubs:
          "Requests Autoload, Requests, Response, Exception, Cookie, and Cookie\\Jar are deterministic structural stubs; WordPress functions __, apply_filters, wp_parse_url, wp_http_validate_url, is_wp_error, and wp_remote_request are deterministic stubs; copied class-wp-http.php and class-wp-http-cookie.php remain the executed public HTTP helper sources."
      },
      public_abi_policy: {
        public_php_replacement_claimed: false,
        copied_oracle_public_php: true,
        adapter_contract_foundation: CONTRACT,
        installed_wordpress_behavior_claimed: false
      }
    },
    build: { oracle_root: ORACLE_ROOT, candidate_root: CANDIDATE_ROOT, php_lint: phpLint },
    observations: {
      oracle,
      candidate,
      match: observationsMatch,
      oracle_sha256: sha256(JSON.stringify(oracle)),
      candidate_sha256: sha256(JSON.stringify(candidate)),
      assertions_pass: observationsAssert
    },
    remaining_gaps: [
      {
        id: "live-http-transport-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "The fixture observes WP_Http helpers in isolation. Live Requests transport, cURL/streams behavior, DNS/proxy/TLS behavior, network I/O, timeout races, and response streaming remain later WPHX-312 gates."
      },
      {
        id: "requests-network-redirects-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "The fixture structurally stubs the Requests classes and records helper-level redirect callbacks and handoff. It does not execute real Requests redirect dispatch, cookie jar internals, or transport-level redirect safety."
      },
      {
        id: "installed-distribution-behavior-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "The fixture uses PHP CLI with deterministic stubs rather than an installed WordPress distribution, live plugin filters, or ecosystem HTTP callers."
      },
      {
        id: "public-php-adapter-not-yet-generated",
        owner: ISSUE.external_ref,
        detail: "The fixture compares copied oracle PHP in both roots; generated original-path PHP replacement remains a later cross-domain gate."
      }
    ],
    ownership_manifest: OWNERSHIP,
    validation_result: {
      status: "passed",
      fixture_cases: CASES.length,
      covered_symbols: COVERED_SYMBOLS.length,
      observations_match: observationsMatch,
      observations_assert: observationsAssert,
      public_php_replacement_claimed: false,
      installed_wordpress_behavior_claimed: false,
      live_http_claimed: false,
      requests_network_io_claimed: false,
      redirect_safety_claimed: false
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestText);
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-312-41-wp-http-helper-oracle-fixture",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "WP_Http helper oracle-source-mirror fixture manifest" },
      { path: OWNERSHIP, role: "ownership manifest for copied-oracle WP_Http helper boundary" },
      { path: RUNNER, role: "deterministic PHP CLI oracle/candidate fixture generator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-312-wp-http-helper-oracle-fixture",
      "npm run wp:core:wphx-312-wp-http-helper-oracle-fixture:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
      "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
      "receipt:wphx-312-03-http-cron-mail-oracle-fixture",
      "receipt:wphx-312-39-http-cookie-object-oracle-fixture",
      "receipt:wphx-312-40-http-encoding-oracle-fixture"
    ],
    validation_result: manifest.validation_result
  };

  try {
    writeOrCheck(OUT, manifestText);
    writeOrCheck(OWNERSHIP, JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n");
    writeOrCheck(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
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
        fixture_cases: CASES.length,
        observations_match: observationsMatch
      },
      null,
      2
    )
  );
}

await main();
