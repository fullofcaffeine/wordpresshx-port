#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-o58",
  external_ref: "WPHX-312.59",
  title: "WPHX-312.59 - Promote WP_Http redirect orchestration decisions to Haxe candidate"
};
const RECORDED_AT = "2026-06-28T01:20:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-wp-http-redirect-orchestration-candidate.mjs";
const HXML = "fixtures/wp-core/http-redirect-orchestration-candidate.hxml";
const WPHX_PHP_HXML = "fixtures/wphx-php/wp-http-grouped-helpers.hxml";
const OUT_ROOT = "build/wp-core/wphx-312-59";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const WPHX_PHP_ROOT = `${OUT_ROOT}/wphx-php`;
const WPHX_PHP_MANIFEST = `${WPHX_PHP_ROOT}/wphx-php-emission.v1.json`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-312-59-wp-http-redirect-orchestration-candidate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-59-wp-http-redirect-orchestration-candidate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-59-wp-http-redirect-orchestration-candidate.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const HELPER_FIXTURE = "manifests/wp-core/wphx-312-41-wp-http-helper-oracle-fixture.v1.json";
const ABSOLUTE_URL_CANDIDATE = "manifests/wp-core/wphx-312-58-wp-http-absolute-url-candidate.v1.json";

const SOURCE_FILES = ["src/wp-includes/class-wp-http-cookie.php", "src/wp-includes/class-wp-http.php"];
const HAXE_SOURCES = [
  HXML,
  WPHX_PHP_HXML,
  "src/wphx/wp/http/HttpProcessResponse.hx",
  "src/wphx/wp/http/HttpChunkTransferDecode.hx",
  "src/wphx/wp/http/HttpDeprecatedParseUrl.hx",
  "src/wphx/wp/http/HttpCookieHeaderAssembly.hx",
  "src/wphx/wp/http/HttpProcessHeaders.hx",
  "src/wphx/wp/http/HttpIpAddress.hx",
  "src/wphx/wp/http/HttpRedirectCompatibility.hx",
  "src/wphx/wp/http/HttpRedirectValidation.hx",
  "src/wphx/wp/http/HttpAbsoluteUrl.hx",
  "src/wphx/wp/http/HttpBlockRequestPolicy.hx",
  "src/wphx/wp/http/HttpRedirectOrchestration.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/HttpGroupedHelpersCandidateEntry.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/HttpRedirectOrchestrationCandidateEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/HttpGroupedHelpersEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/WpHttpGroupedHelpersShell.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/HaxeHttpCookieHeaderAssembly.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/HaxeHttpProcessHeaders.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/HaxeHttpProcessResponse.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/HaxeHttpChunkTransferDecode.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/HaxeHttpDeprecatedParseUrl.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/HaxeHttpIpAddress.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/HaxeHttpRedirectCompatibility.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/HaxeHttpRedirectValidation.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/HaxeHttpAbsoluteUrl.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/HaxeHttpBlockRequestPolicy.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/HaxeHttpRedirectOrchestration.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/PhpHttpGlobals.hx"
];
const PROMOTED_SYMBOLS = [
  "WP_Http::handle_redirects no-location/requested-redirection/status short-circuit",
  "WP_Http::handle_redirects too-many-redirects decision",
  "WP_Http::handle_redirects POST 302/303 to GET method decision"
];
const CASES = [
  {
    id: "wp-http:handle-redirects",
    focus:
      "redirect guards, too-many-redirects error, last Location selection, POST-to-GET conversion, cookie filtering, and wp_remote_request handoff"
  }
];

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 50
  }).trim();
}

function compileGroupedHelpersToCandidateHaxe() {
  command("haxe", [
    "-cp",
    "src",
    "-cp",
    "fixtures/wp-core/src",
    "-main",
    "wphx.fixtures.wp.core.HttpGroupedHelpersCandidateEntry",
    "-php",
    HAXE_OUT
  ]);
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

function installCompilerEmittedCandidateShell() {
  const source = `${WPHX_PHP_ROOT}/wp-includes/class-wp-http.php`;
  const target = `${CANDIDATE_ROOT}/wp-includes/class-wp-http.php`;
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
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
\t\tpublic static function set_certificate_path( $path ) {}
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

$GLOBALS['wphx_remote_requests'] = array();

function __( $text ) {
\treturn $text;
}

function wp_parse_url( $url ) {
\treturn parse_url( $url );
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
\t\t$assertions['redirect_budget_decremented'] = 1 === $GLOBALS['wphx_remote_requests'][0]['args']['redirection'];
\t\t$assertions['matching_cookie_only'] = 1 === count( $GLOBALS['wphx_remote_requests'][0]['args']['cookies'] ) && 'session' === $GLOBALS['wphx_remote_requests'][0]['args']['cookies'][0]['name'];
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
    manifest_id: "ownership:wp-core/wp-http-redirect-orchestration-candidate",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "haxe_parity_candidate",
      name: "WP_Http redirect orchestration decisions",
      area: "src/wp-includes/class-wp-http.php WP_Http::handle_redirects",
      public_contract:
        "This candidate preserves the WP_Http PHP class shell, native Location header arrays, redirect budget mutation, WP_Error construction, cookie tests, absolute URL resolution, and wp_remote_request ABI while delegating bounded redirect branch decisions to module-level Haxe source."
    },
    ownership_state: "compiler_emitted_original_path_shell",
    bridge: {
      exists: true,
      kind: "compiler-emitted-grouped-original-path-public-php-shell",
      removal_gate:
        "Pass broader redirect helper, upstream HTTP PHPUnit, installed distribution, live/recorded network, ecosystem redirect, and whole-file WP_Http gates before claiming durable public PHP or whole-file ownership."
    },
    owned_paths: [
      RUNNER,
      HXML,
      WPHX_PHP_HXML,
      "src/wphx/wp/http/HttpRedirectOrchestration.hx",
      "fixtures/wp-core/src/wphx/fixtures/wp/core/HttpRedirectOrchestrationCandidateEntry.hx",
      "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/WpHttpGroupedHelpersShell.hx",
      OUT,
      OWNERSHIP,
      RECEIPT
    ],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, WPHX_PHP_MANIFEST, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-wp-http-redirect-orchestration-candidate",
        "npm run wp:core:wphx-312-wp-http-redirect-orchestration-candidate:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-59-wp-http-redirect-orchestration-candidate"],
      manifest_digest: manifestSha
    }
  };
}

async function main() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  command("haxe", [HXML]);
  compileGroupedHelpersToCandidateHaxe();
  command("haxe", [WPHX_PHP_HXML, "-D", `wphx_php_output=${WPHX_PHP_ROOT}`, "-D", `wphx_php_manifest=${WPHX_PHP_MANIFEST}`]);
  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  installCompilerEmittedCandidateShell();
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
  const compiledPhp = command("find", [HAXE_OUT, "-type", "f", "-name", "*.php"]);
  const wphxPhpManifest = JSON.parse(readFileSync(WPHX_PHP_MANIFEST, "utf8"));
  const wphxDeclarations = wphxPhpManifest.files.flatMap((file) => file.declarations.map((entry) => `${entry.kind}:${entry.name}`));
  if (JSON.stringify(wphxDeclarations) !== JSON.stringify(["class:WP_Http"])) {
    console.error(JSON.stringify({ status: "failed", reason: "unexpected WPHX PHP declarations", declarations: wphxDeclarations }, null, 2));
    process.exit(1);
  }
  if (wphxPhpManifest.unsupported.length !== 0) {
    console.error(JSON.stringify({ status: "failed", reason: "unexpected WPHX PHP unsupported constructs", unsupported: wphxPhpManifest.unsupported }, null, 2));
    process.exit(1);
  }
  const generatedShellPath = mirrorPath(CANDIDATE_ROOT, "src/wp-includes/class-wp-http.php");
  const generatedShell = readFileSync(generatedShellPath, "utf8");
  const handleRedirectsEmitted =
    /public\s+static\s+function\s+handle_redirects\s*\(\s*\$url\s*,\s*\$args\s*,\s*\$response\s*\)/.test(generatedShell) &&
    generatedShell.includes("HttpRedirectOrchestration_Fields_::shouldShortCircuit") &&
    generatedShell.includes("HttpRedirectOrchestration_Fields_::isTooManyRedirects") &&
    generatedShell.includes("HttpRedirectOrchestration_Fields_::shouldSwitchPostRedirectToGet") &&
    generatedShell.includes("self::make_absolute_url( $redirect_location, $url )") &&
    generatedShell.includes("wp_remote_request( $redirect_location, $args )");
  if (!handleRedirectsEmitted) {
    console.error(JSON.stringify({ status: "failed", reason: "generated shell is missing handle_redirects adapter shape" }, null, 2));
    process.exit(1);
  }
  const manifest = {
    schema: "wphx.wp-core-wp-http-redirect-orchestration-candidate.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_classes: ["haxe_source", "generated_php_candidate", "oracle_source_mirror", "php_cli_observed_fixture"],
    artifact_scope: "haxe_parity_candidate",
    inputs: {
      surface_manifest: inputRecord(SURFACE),
      adapter_contract_manifest: inputRecord(CONTRACT),
      helper_oracle_fixture_manifest: inputRecord(HELPER_FIXTURE),
      absolute_url_candidate_manifest: inputRecord(ABSOLUTE_URL_CANDIDATE),
      runner: inputRecord(RUNNER),
      haxe_sources: HAXE_SOURCES.map(inputRecord),
      wphx_php_manifest: inputRecord(WPHX_PHP_MANIFEST),
      upstream_sources: SOURCE_FILES.map(sourceRecord)
    },
    candidate: {
      hxml: HXML,
      wphx_php_hxml: WPHX_PHP_HXML,
      haxe_output: HAXE_OUT,
      compiled_php_files: compiledPhp.split("\n").filter(Boolean).sort(),
      compiler_emitted_public_shell: {
        path: generatedShellPath,
        source_path: `${WPHX_PHP_ROOT}/wp-includes/class-wp-http.php`,
        manifest: WPHX_PHP_MANIFEST,
        declarations: wphxDeclarations,
        emitted_methods: [
          {
            name: "handle_redirects",
            visibility: "public",
            static: true,
            by_reference_parameters: []
          }
        ],
        unsupported: wphxPhpManifest.unsupported
      },
      promoted_symbols: PROMOTED_SYMBOLS,
      public_shell_policy: {
        public_php_replacement_claimed: true,
        public_php_abi_preserved: true,
        shell_body_ownership:
          "compiler-emitted original-path class-wp-http.php shell preserves the WP_Http public static method ABI and PHP-native redirect orchestration effects while delegating bounded branch decisions to generated Haxe PHP",
        native_boundaries: [
          "PHP isset/is_array/array_pop Location header handling",
          "local $args redirect budget mutation before wp_remote_request",
          "WP_Error construction and translation",
          "WP_Http_Cookie::test",
          "self::make_absolute_url",
          "wp_remote_request",
          "compiler-emitted original-path class-wp-http.php shell"
        ]
      }
    },
    fixture: {
      cases: CASES,
      source_files: SOURCE_FILES,
      probe: { path: PROBE, sha256: sha256File(PROBE) },
      side_effect_policy: {
        external_network_io: false,
        database_io: false,
        live_installed_wordpress: false,
        php_cli: true,
        runtime_stubs:
          "Requests Autoload/Requests, translation, WP_Error, wp_parse_url, and wp_remote_request are deterministic local stubs. Redirect dispatch is recorded locally and no HTTP request is dispatched."
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
        id: "php-native-header-cookie-dispatch-boundaries-preserved",
        owner: ISSUE.external_ref,
        detail:
          "This candidate promotes only bounded branch decisions. Native Location array selection, redirect URL absolutization, cookie filtering, WP_Error construction, and wp_remote_request dispatch remain in the PHP shell."
      },
      {
        id: "whole-wp-http-file-not-yet-owned",
        owner: ISSUE.external_ref,
        detail:
          "The candidate consumes a compiler-emitted grouped original-path class-wp-http.php shell for the handle_redirects boundary, but broader WP_Http methods and whole-file original-path ownership remain later compiler-driven gates."
      },
      {
        id: "live-http-transport-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "The fixture observes redirect orchestration decisions and local dispatch handoff only. It does not execute WP_Http::request, Requests network I/O, DNS, proxy, TLS, redirect following, or transport execution."
      }
    ],
    ownership_manifest: OWNERSHIP,
    validation_result: {
      status: "passed",
      fixture_cases: CASES.length,
      promoted_symbols: PROMOTED_SYMBOLS.length,
      observations_match: observationsMatch,
      observations_assert: observationsAssert,
      public_php_replacement_claimed: true,
      compiler_emitted_public_php: true,
      handle_redirects_emitted: handleRedirectsEmitted,
      unsupported_empty: wphxPhpManifest.unsupported.length === 0,
      installed_wordpress_behavior_claimed: false,
      live_http_claimed: false,
      dns_resolution_claimed: false
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestText);
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-312-59-wp-http-redirect-orchestration-candidate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "WP_Http redirect orchestration Haxe parity candidate manifest" },
      { path: OWNERSHIP, role: "ownership manifest for Haxe-owned WP_Http redirect decisions" },
      { path: RUNNER, role: "deterministic PHP CLI oracle/candidate Haxe runner" },
      { path: "src/wphx/wp/http/HttpRedirectOrchestration.hx", role: "module-level Haxe source for WP_Http::handle_redirects branch decisions" },
      { path: WPHX_PHP_MANIFEST, role: "WPHX PHP emission manifest for compiler-emitted class-wp-http.php" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-312-wp-http-redirect-orchestration-candidate",
      "npm run wp:core:wphx-312-wp-http-redirect-orchestration-candidate:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
      "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
      "receipt:wphx-312-41-wp-http-helper-oracle-fixture",
      "receipt:wphx-312-58-wp-http-absolute-url-candidate",
      "receipt:wphx-comp-php-group-wp-http-helpers"
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
