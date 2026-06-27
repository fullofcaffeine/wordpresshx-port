#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.18.32",
  external_ref: "WPHX-312.45",
  title: "WPHX-312.45 - Add HTTP transport callback/test oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-http-transport-callback-test-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-312-45";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-312-45-http-transport-callback-test-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-45-http-transport-callback-test-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-45-http-transport-callback-test-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const HTTP_HELPER_FIXTURE = "manifests/wp-core/wphx-312-41-wp-http-helper-oracle-fixture.v1.json";
const HTTP_PARSER_FIXTURE = "manifests/wp-core/wphx-312-42-wp-http-parser-header-oracle-fixture.v1.json";
const HTTP_API_FIXTURE = "manifests/wp-core/wphx-312-43-http-api-wrapper-safety-oracle-fixture.v1.json";

const SOURCE_FILES = ["src/wp-includes/class-wp-http-streams.php", "src/wp-includes/class-wp-http-curl.php"];
const COVERED_SYMBOLS = [
  "WP_Http_Streams",
  "WP_Http_Streams::test",
  "WP_HTTP_Fsockopen",
  "WP_Http_Curl",
  "WP_Http_Curl::test",
  "WP_Http_Curl::stream_headers",
  "WP_Http_Curl::stream_body",
  "use_streams_transport",
  "use_curl_transport",
  "stream_socket_client",
  "openssl",
  "curl_init",
  "curl_exec",
  "curl_version",
  "CURL_VERSION_SSL",
  "max_body_length",
  "stream_handle",
  "bytes_written_total"
];
const CASES = [
  { id: "transport-test:streams", focus: "WP_Http_Streams::test base, SSL, and use_streams_transport behavior" },
  { id: "transport-test:curl", focus: "WP_Http_Curl::test base, SSL, and use_curl_transport behavior" },
  { id: "transport-test:inheritance", focus: "WP_HTTP_Fsockopen remains a compatibility subclass of WP_Http_Streams" },
  { id: "curl-callback:headers-body-memory", focus: "private cURL header/body callbacks append in-memory data and totals" },
  { id: "curl-callback:body-limit-and-stream", focus: "private cURL body callback truncates to max_body_length and writes streams" }
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
$root = rtrim( $argv[1], '/\\\\' );
$case = $argv[2] ?? '';

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'WP_DEBUG', true );

$GLOBALS['wphx_filter_calls'] = array();

function apply_filters( $hook, $value, ...$args ) {
\t$GLOBALS['wphx_filter_calls'][] = array( 'hook' => $hook, 'value' => $value, 'args' => $args );
\t$request_args = $args[0] ?? array();
\tif ( in_array( $hook, array( 'use_streams_transport', 'use_curl_transport' ), true )
\t\t&& is_array( $request_args )
\t\t&& ! empty( $request_args['force_false'] )
\t) {
\t\treturn false;
\t}
\treturn $value;
}

class WP_Http {
\tpublic static function is_ip_address( $maybe_ip ) {
\t\tif ( filter_var( $maybe_ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 ) ) {
\t\t\treturn 4;
\t\t}
\t\tif ( filter_var( $maybe_ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6 ) ) {
\t\t\treturn 6;
\t\t}
\t\treturn false;
\t}
}

require ABSPATH . WPINC . '/class-wp-http-streams.php';
require ABSPATH . WPINC . '/class-wp-http-curl.php';

function read_private_property( $object, $property ) {
\t$ref = new ReflectionProperty( $object, $property );
\t$ref->setAccessible( true );
\treturn $ref->getValue( $object );
}

function write_private_property( $object, $property, $value ) {
\t$ref = new ReflectionProperty( $object, $property );
\t$ref->setAccessible( true );
\t$ref->setValue( $object, $value );
}

function private_method( $class, $method ) {
\t$ref = new ReflectionMethod( $class, $method );
\t$ref->setAccessible( true );
\treturn $ref;
}

$assertions = array();
$result = array( 'case' => $case );

switch ( $case ) {
\tcase 'transport-test:streams':
\t\t$capabilities = array(
\t\t\t'stream_socket_client' => function_exists( 'stream_socket_client' ),
\t\t\t'openssl' => extension_loaded( 'openssl' ),
\t\t\t'openssl_x509_parse' => function_exists( 'openssl_x509_parse' ),
\t\t);
\t\t$result['capabilities'] = $capabilities;
\t\t$result['base'] = WP_Http_Streams::test( array() );
\t\t$result['filtered_false'] = WP_Http_Streams::test( array( 'force_false' => true ) );
\t\t$result['ssl'] = WP_Http_Streams::test( array( 'ssl' => true ) );
\t\t$result['filter_calls'] = $GLOBALS['wphx_filter_calls'];
\t\t$expected_ssl = $capabilities['stream_socket_client'] && $capabilities['openssl'] && $capabilities['openssl_x509_parse'];
\t\t$assertions['base_matches_stream_socket_client_capability'] = $result['base'] === $capabilities['stream_socket_client'];
\t\t$assertions['filtered_false_when_reachable_or_early_false'] = false === $result['filtered_false'];
\t\t$assertions['ssl_matches_streams_ssl_capability'] = $result['ssl'] === $expected_ssl;
\t\tbreak;

\tcase 'transport-test:curl':
\t\t$curl_available = function_exists( 'curl_init' ) && function_exists( 'curl_exec' );
\t\t$curl_ssl_available = false;
\t\tif ( $curl_available ) {
\t\t\t$curl_version = curl_version();
\t\t\t$curl_ssl_available = defined( 'CURL_VERSION_SSL' ) && (bool) ( CURL_VERSION_SSL & $curl_version['features'] );
\t\t}
\t\t$result['capabilities'] = array(
\t\t\t'curl_init' => function_exists( 'curl_init' ),
\t\t\t'curl_exec' => function_exists( 'curl_exec' ),
\t\t\t'curl_available' => $curl_available,
\t\t\t'curl_ssl_available' => $curl_ssl_available,
\t\t);
\t\t$result['base'] = WP_Http_Curl::test( array() );
\t\t$result['filtered_false'] = WP_Http_Curl::test( array( 'force_false' => true ) );
\t\t$result['ssl'] = WP_Http_Curl::test( array( 'ssl' => true ) );
\t\t$result['filter_calls'] = $GLOBALS['wphx_filter_calls'];
\t\t$assertions['base_matches_curl_capability'] = $result['base'] === $curl_available;
\t\t$assertions['filtered_false_when_reachable_or_early_false'] = false === $result['filtered_false'];
\t\t$assertions['ssl_matches_curl_ssl_capability'] = $result['ssl'] === ( $curl_available && $curl_ssl_available );
\t\tbreak;

\tcase 'transport-test:inheritance':
\t\t$result['class_exists'] = class_exists( 'WP_HTTP_Fsockopen', false );
\t\t$result['parent'] = get_parent_class( 'WP_HTTP_Fsockopen' );
\t\t$result['is_subclass'] = is_subclass_of( 'WP_HTTP_Fsockopen', 'WP_Http_Streams' );
\t\t$assertions['class_exists'] = true === $result['class_exists'];
\t\t$assertions['parent_is_streams'] = 'WP_Http_Streams' === $result['parent'];
\t\t$assertions['subclass'] = true === $result['is_subclass'];
\t\tbreak;

\tcase 'curl-callback:headers-body-memory':
\t\t$transport = new WP_Http_Curl();
\t\t$stream_headers = private_method( 'WP_Http_Curl', 'stream_headers' );
\t\t$stream_body = private_method( 'WP_Http_Curl', 'stream_body' );
\t\t$result['header_returns'] = array(
\t\t\t$stream_headers->invoke( $transport, null, \"HTTP/1.1 200 OK\\r\\n\" ),
\t\t\t$stream_headers->invoke( $transport, null, \"X-Test: yes\\r\\n\\r\\n\" ),
\t\t);
\t\twrite_private_property( $transport, 'max_body_length', false );
\t\twrite_private_property( $transport, 'bytes_written_total', 0 );
\t\twrite_private_property( $transport, 'stream_handle', false );
\t\t$result['body_returns'] = array(
\t\t\t$stream_body->invoke( $transport, null, 'hello ' ),
\t\t\t$stream_body->invoke( $transport, null, 'world' ),
\t\t);
\t\t$result['headers'] = read_private_property( $transport, 'headers' );
\t\t$result['body'] = read_private_property( $transport, 'body' );
\t\t$result['bytes_written_total'] = read_private_property( $transport, 'bytes_written_total' );
\t\t$assertions['header_returns_lengths'] = array( 17, 15 ) === $result['header_returns'];
\t\t$assertions['headers_appended'] = \"HTTP/1.1 200 OK\\r\\nX-Test: yes\\r\\n\\r\\n\" === $result['headers'];
\t\t$assertions['body_returns_lengths'] = array( 6, 5 ) === $result['body_returns'];
\t\t$assertions['body_appended'] = 'hello world' === $result['body'];
\t\t$assertions['bytes_written_total'] = 11 === $result['bytes_written_total'];
\t\tbreak;

\tcase 'curl-callback:body-limit-and-stream':
\t\t$limited = new WP_Http_Curl();
\t\t$stream_body = private_method( 'WP_Http_Curl', 'stream_body' );
\t\twrite_private_property( $limited, 'max_body_length', 5 );
\t\twrite_private_property( $limited, 'bytes_written_total', 0 );
\t\twrite_private_property( $limited, 'stream_handle', false );
\t\t$result['limited_returns'] = array(
\t\t\t$stream_body->invoke( $limited, null, 'abcdef' ),
\t\t\t$stream_body->invoke( $limited, null, 'XYZ' ),
\t\t);
\t\t$result['limited_body'] = read_private_property( $limited, 'body' );
\t\t$result['limited_bytes_written_total'] = read_private_property( $limited, 'bytes_written_total' );

\t\t$streamed = new WP_Http_Curl();
\t\t$handle = fopen( 'php://temp', 'w+' );
\t\twrite_private_property( $streamed, 'max_body_length', false );
\t\twrite_private_property( $streamed, 'bytes_written_total', 0 );
\t\twrite_private_property( $streamed, 'stream_handle', $handle );
\t\t$result['stream_return'] = $stream_body->invoke( $streamed, null, 'filedata' );
\t\trewind( $handle );
\t\t$result['stream_contents'] = stream_get_contents( $handle );
\t\t$result['stream_body_property'] = read_private_property( $streamed, 'body' );
\t\t$result['stream_bytes_written_total'] = read_private_property( $streamed, 'bytes_written_total' );
\t\tfclose( $handle );

\t\t$assertions['limited_truncates_first_chunk'] = array( 5, 0 ) === $result['limited_returns'];
\t\t$assertions['limited_body_and_total'] = 'abcde' === $result['limited_body'] && 5 === $result['limited_bytes_written_total'];
\t\t$assertions['stream_writes_file_and_not_body'] = 8 === $result['stream_return'] && 'filedata' === $result['stream_contents'] && '' === $result['stream_body_property'];
\t\t$assertions['stream_total'] = 8 === $result['stream_bytes_written_total'];
\t\tbreak;
}

$result['assertions'] = $assertions;
echo json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL;
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
    manifest_id: "ownership:wp-core/http-transport-callback-test-oracle-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "HTTP streams/cURL transport test and private callback behavior",
      area: "src/wp-includes/class-wp-http-streams.php src/wp-includes/class-wp-http-curl.php",
      public_contract:
        "This fixture executes copied WordPress 7.0 HTTP streams and cURL transport classes in isolated PHP CLI probes. It observes transport capability gates, transport filters, WP_HTTP_Fsockopen inheritance, and private cURL header/body callback state through reflection without claiming live HTTP transport, socket/cURL execution, DNS/TLS/proxy behavior, certificate verification, redirect handling, streaming download over network, installed distribution behavior, or generated public PHP ownership."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-deterministic-hook-and-reflection-boundary",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass transport capability, callback, selected upstream HTTP PHPUnit, installed distribution, and live/recorded network parity gates before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-http-transport-callback-test-oracle-fixture",
        "npm run wp:core:wphx-312-http-transport-callback-test-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-45-http-transport-callback-test-oracle-fixture"],
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
    schema: "wphx.wp-core-http-transport-callback-test-oracle-fixture.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_classes: ["oracle_source_mirror", "candidate_package_mirror", "php_cli_observed_fixture"],
    artifact_scope: "fixture",
    inputs: {
      surface_manifest: inputRecord(SURFACE),
      adapter_contract_manifest: inputRecord(CONTRACT),
      http_helper_fixture_manifest: inputRecord(HTTP_HELPER_FIXTURE),
      http_parser_header_fixture_manifest: inputRecord(HTTP_PARSER_FIXTURE),
      http_api_wrapper_safety_fixture_manifest: inputRecord(HTTP_API_FIXTURE),
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
          "apply_filters and a minimal WP_Http::is_ip_address support class are deterministic local stubs. The fixture invokes transport test methods and cURL callbacks only; it does not call request(), open sockets, or execute live cURL transfers."
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
          "The fixture observes local transport capability gates and callback state. It does not execute WP_Http_Streams::request, WP_Http_Curl::request, socket I/O, cURL transfers, DNS, proxy, TLS, redirects, or live response streaming."
      },
      {
        id: "ssl-certificate-verification-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "The fixture records OpenSSL capability gating but does not construct peer certificate streams or verify subjectAltName/Common Name matching."
      },
      {
        id: "installed-distribution-behavior-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "The fixture uses PHP CLI with deterministic hook/support stubs rather than an installed WordPress distribution or ecosystem HTTP callers."
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
      socket_or_curl_execution_claimed: false,
      ssl_certificate_verification_claimed: false
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestText);
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-312-45-http-transport-callback-test-oracle-fixture",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "HTTP transport callback/test oracle-source-mirror fixture manifest" },
      { path: OWNERSHIP, role: "ownership manifest for copied-oracle HTTP transport callback/test boundary" },
      { path: RUNNER, role: "deterministic PHP CLI oracle/candidate fixture generator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-312-http-transport-callback-test-oracle-fixture",
      "npm run wp:core:wphx-312-http-transport-callback-test-oracle-fixture:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
      "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
      "receipt:wphx-312-41-http-helper-oracle-fixture",
      "receipt:wphx-312-42-http-parser-header-oracle-fixture",
      "receipt:wphx-312-43-http-api-wrapper-safety-oracle-fixture"
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
