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
const OUT_ROOT = "build/wp-core/wphx-312-59";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
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
  "src/wphx/wp/http/HttpRedirectOrchestration.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/HttpRedirectOrchestrationCandidateEntry.hx"
];
const HAXE_MODULE = "\\wphx\\wp\\http\\_HttpRedirectOrchestration\\HttpRedirectOrchestration_Fields_";
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

function haxeBootstrapBlock() {
  return `if ( ! function_exists( 'wphx_312_59_bootstrap_haxe' ) ) {
\tfunction wphx_312_59_bootstrap_haxe() {
\t\tstatic $bootstrapped = false;
\t\tif ( $bootstrapped ) {
\t\t\treturn;
\t\t}
\t\t$bootstrapped = true;

\t\t$wphx_312_59_lib = dirname( __DIR__, 2 ) . '/haxe/lib';
\t\tset_include_path( get_include_path() . PATH_SEPARATOR . $wphx_312_59_lib );
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
wphx_312_59_bootstrap_haxe();
`;
}

function installBootstrap(source) {
  const marker = "<?php\n";
  if (!source.startsWith(marker)) throw new Error("class-wp-http.php did not start with PHP open tag");
  return `${marker}\n${haxeBootstrapBlock()}\n${source.slice(marker.length)}`;
}

function replaceStaticMethod(source, methodName, replacement) {
  const pattern = new RegExp(`public\\s+static\\s+function\\s+${methodName}\\s*\\(`, "m");
  const match = pattern.exec(source);
  if (!match) throw new Error(`Unable to locate static method ${methodName}`);
  const openBrace = source.indexOf("{", match.index);
  if (openBrace === -1) throw new Error(`Unable to locate opening brace for ${methodName}`);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return `${source.slice(0, match.index)}${replacement}${source.slice(index + 1)}`;
    }
  }
  throw new Error(`Unable to locate closing brace for ${methodName}`);
}

function transformCandidateRedirectOrchestration() {
  const path = `${CANDIDATE_ROOT}/wp-includes/class-wp-http.php`;
  let source = installBootstrap(readFileSync(path, "utf8"));
  source = replaceStaticMethod(
    source,
    "handle_redirects",
    `public static function handle_redirects( $url, $args, $response ) {
\t$response_code = (int) $response['response']['code'];
\tif ( ${HAXE_MODULE}::shouldShortCircuit( isset( $response['headers']['location'] ), (int) $args['_redirection'], $response_code ) ) {
\t\treturn false;
\t}

\tif ( ${HAXE_MODULE}::isTooManyRedirects( (int) $args['redirection'] ) ) {
\t\treturn new WP_Error( 'http_request_failed', __( 'Too many redirects.' ) );
\t}
\t$args['redirection']--;

\t$redirect_location = $response['headers']['location'];
\tif ( is_array( $redirect_location ) ) {
\t\t$redirect_location = array_pop( $redirect_location );
\t}

\t$redirect_location = self::make_absolute_url( $redirect_location, $url );

\tif ( ${HAXE_MODULE}::shouldSwitchPostRedirectToGet( (string) $args['method'], $response_code ) ) {
\t\t$args['method'] = 'GET';
\t}

\tif ( ! empty( $response['cookies'] ) ) {
\t\tforeach ( $response['cookies'] as $cookie ) {
\t\t\tif ( $cookie->test( $redirect_location ) ) {
\t\t\t\t$args['cookies'][] = $cookie;
\t\t\t}
\t\t}
\t}

\treturn wp_remote_request( $redirect_location, $args );
}`
  );
  writeFileSync(path, source);
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
    ownership_state: "haxe_owned_candidate_with_public_php_shell",
    bridge: {
      exists: true,
      kind: "generated-php-haxe-helper-with-temporary-original-path-shell",
      removal_gate:
        "Replace the temporary candidate shell with generated original-path public PHP adapters and pass broader redirect helper, upstream HTTP PHPUnit, installed distribution, live/recorded network, ecosystem redirect, and generated-shell gates before claiming durable public PHP ownership."
    },
    owned_paths: [RUNNER, HXML, "src/wphx/wp/http/HttpRedirectOrchestration.hx", "fixtures/wp-core/src/wphx/fixtures/wp/core/HttpRedirectOrchestrationCandidateEntry.hx", OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
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
  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  transformCandidateRedirectOrchestration();
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
      upstream_sources: SOURCE_FILES.map(sourceRecord)
    },
    candidate: {
      hxml: HXML,
      haxe_output: HAXE_OUT,
      compiled_php_files: compiledPhp.split("\n").filter(Boolean).sort(),
      promoted_symbols: PROMOTED_SYMBOLS,
      public_shell_policy: {
        public_php_replacement_claimed: false,
        public_php_abi_preserved: true,
        shell_body_ownership:
          "temporary candidate shell preserves the WP_Http public static method ABI and PHP-native redirect orchestration effects while delegating bounded branch decisions to generated Haxe PHP",
        native_boundaries: [
          "PHP isset/is_array/array_pop Location header handling",
          "local $args redirect budget mutation before wp_remote_request",
          "WP_Error construction and translation",
          "WP_Http_Cookie::test",
          "self::make_absolute_url",
          "wp_remote_request"
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
        id: "durable-public-php-adapter-not-yet-generated",
        owner: ISSUE.external_ref,
        detail: "The candidate uses a bounded generated-PHP helper plus temporary original-path shell; durable shell generation remains a later cross-domain gate."
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
      public_php_replacement_claimed: false,
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
      { path: "src/wphx/wp/http/HttpRedirectOrchestration.hx", role: "module-level Haxe source for WP_Http::handle_redirects branch decisions" }
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
      "receipt:wphx-312-58-wp-http-absolute-url-candidate"
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
