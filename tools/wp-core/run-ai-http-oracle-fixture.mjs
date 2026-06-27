#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.18.5",
  external_ref: "WPHX-312.05",
  title: "WPHX-312.05 — Add AI HTTP oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-ai-http-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-312-05";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-312-05-ai-http-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-05-ai-http-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-05-ai-http-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const HTTP_FIXTURE = "manifests/wp-core/wphx-312-03-http-cron-mail-oracle-fixture.v1.json";
const FEED_EMBED_FIXTURE = "manifests/wp-core/wphx-312-04-feed-embed-https-oracle-fixture.v1.json";

const SOURCE_FILES = [
  "src/wp-includes/php-ai-client/autoload.php",
  "src/wp-includes/php-ai-client/src/Providers/Http/Collections/HeadersCollection.php",
  "src/wp-includes/php-ai-client/src/Providers/Http/DTO/Request.php",
  "src/wp-includes/php-ai-client/src/Providers/Http/DTO/RequestOptions.php",
  "src/wp-includes/php-ai-client/src/Providers/Http/DTO/Response.php",
  "src/wp-includes/php-ai-client/src/Providers/Http/Enums/HttpMethodEnum.php",
  "src/wp-includes/php-ai-client/src/Providers/Http/HttpTransporter.php",
  "src/wp-includes/php-ai-client/src/Providers/Http/HttpTransporterFactory.php",
  "src/wp-includes/php-ai-client/src/Providers/Http/Util/ErrorMessageExtractor.php",
  "src/wp-includes/php-ai-client/src/Providers/Http/Util/ResponseUtil.php",
  "src/wp-includes/ai-client/adapters/class-wp-ai-client-http-client.php"
];
const SUPPORT_PATHS = ["src/wp-includes/php-ai-client"];

const COVERED_SYMBOLS = [
  "HeadersCollection::__construct",
  "HeadersCollection::get",
  "HeadersCollection::getAll",
  "HeadersCollection::getAsString",
  "HeadersCollection::withHeader",
  "HttpMethodEnum::GET",
  "HttpMethodEnum::POST",
  "HttpMethodEnum::hasBody",
  "Request::__construct",
  "Request::getUri",
  "Request::getBody",
  "Request::withHeader",
  "Request::withData",
  "Request::withOptions",
  "Request::toArray",
  "Request::fromArray",
  "RequestOptions::setTimeout",
  "RequestOptions::setConnectTimeout",
  "RequestOptions::setMaxRedirects",
  "RequestOptions::allowsRedirects",
  "RequestOptions::toArray",
  "Response::__construct",
  "Response::getData",
  "Response::isSuccessful",
  "Response::toArray",
  "ErrorMessageExtractor::extractFromResponseData",
  "ResponseUtil::throwIfNotSuccessful",
  "HttpTransporter::send",
  "WP_AI_Client_HTTP_Client::sendRequest",
  "WP_AI_Client_HTTP_Client::sendRequestWithOptions"
];

const FIXTURE_CASES = [
  { id: "ai-http:headers-request-options", focus: "headers are case-insensitive, requests encode query/body data, and options serialize redirect/timeout policy" },
  { id: "ai-http:response-utilities", focus: "response DTO JSON decoding, success status, centralized error extraction, and redirect/client/server exception classification" },
  { id: "ai-http:transporter-fake-client", focus: "HttpTransporter converts DTO requests into PSR-7 requests and merges request/parameter options for a fake client" },
  { id: "ai-http:wordpress-adapter-success", focus: "WP_AI_Client_HTTP_Client prepares WordPress HTTP args and converts a fake WordPress HTTP response into PSR-7" },
  { id: "ai-http:wordpress-adapter-error", focus: "WP_AI_Client_HTTP_Client maps a fake WP_Error response into an AI-client NetworkException" }
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
  return readdirSync(source, { withFileTypes: true })
    .flatMap((entry) => listFiles(`${path}/${entry.name}`))
    .sort();
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
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
$root = rtrim( $argv[1], '/\\\\' );

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );

$GLOBALS['wphx_312_05_errors'] = array();
$GLOBALS['wphx_312_05_remote_requests'] = array();
$GLOBALS['wphx_312_05_remote_response'] = null;
$GLOBALS['wphx_312_05_remote_error'] = null;

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\tif ( E_USER_DEPRECATED === $errno ) {
\t\t\treturn true;
\t\t}
\t\t$GLOBALS['wphx_312_05_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

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

function __( $text ) { return $text; }
function is_wp_error( $thing ) { return $thing instanceof WP_Error; }
function wp_safe_remote_request( $url, $args ) {
\t$GLOBALS['wphx_312_05_remote_requests'][] = array( 'url' => $url, 'args' => $args );
\tif ( $GLOBALS['wphx_312_05_remote_error'] instanceof WP_Error ) {
\t\treturn $GLOBALS['wphx_312_05_remote_error'];
\t}
\treturn $GLOBALS['wphx_312_05_remote_response'];
}
function wp_remote_retrieve_response_code( $response ) { return $response['response']['code'] ?? 0; }
function wp_remote_retrieve_response_message( $response ) { return $response['response']['message'] ?? ''; }
function wp_remote_retrieve_headers( $response ) { return $response['headers'] ?? array(); }
function wp_remote_retrieve_body( $response ) { return $response['body'] ?? ''; }

require ABSPATH . WPINC . '/php-ai-client/autoload.php';
require ABSPATH . WPINC . '/ai-client/adapters/class-wp-ai-client-http-client.php';

use WordPress\\AiClient\\Providers\\Http\\Collections\\HeadersCollection;
use WordPress\\AiClient\\Providers\\Http\\DTO\\Request;
use WordPress\\AiClient\\Providers\\Http\\DTO\\RequestOptions;
use WordPress\\AiClient\\Providers\\Http\\DTO\\Response;
use WordPress\\AiClient\\Providers\\Http\\Enums\\HttpMethodEnum;
use WordPress\\AiClient\\Providers\\Http\\HttpTransporter;
use WordPress\\AiClient\\Providers\\Http\\Util\\ErrorMessageExtractor;
use WordPress\\AiClient\\Providers\\Http\\Util\\ResponseUtil;
use WordPress\\AiClient\\Providers\\Http\\Contracts\\ClientWithOptionsInterface;
use WordPress\\AiClientDependencies\\Nyholm\\Psr7\\Factory\\Psr17Factory;
use WordPress\\AiClientDependencies\\Nyholm\\Psr7\\Response as Psr7Response;
use WordPress\\AiClientDependencies\\Psr\\Http\\Client\\ClientInterface;
use WordPress\\AiClientDependencies\\Psr\\Http\\Message\\RequestInterface;
use WordPress\\AiClientDependencies\\Psr\\Http\\Message\\ResponseInterface;

class WPHX_312_05_Fake_Client implements ClientInterface, ClientWithOptionsInterface {
\tpublic array $calls = array();
\tprivate ResponseInterface $response;
\tpublic function __construct( ResponseInterface $response ) {
\t\t$this->response = $response;
\t}
\tpublic function sendRequest( RequestInterface $request ): ResponseInterface {
\t\t$this->calls[] = $this->record( $request, null );
\t\treturn $this->response;
\t}
\tpublic function sendRequestWithOptions( RequestInterface $request, RequestOptions $options ): ResponseInterface {
\t\t$this->calls[] = $this->record( $request, $options );
\t\treturn $this->response;
\t}
\tprivate function record( RequestInterface $request, ?RequestOptions $options ): array {
\t\t$body = (string) $request->getBody();
\t\treturn array(
\t\t\t'method' => $request->getMethod(),
\t\t\t'uri' => (string) $request->getUri(),
\t\t\t'headers' => $request->getHeaders(),
\t\t\t'body' => $body,
\t\t\t'options' => $options ? $options->toArray() : null,
\t\t);
\t}
}

function wphx_312_05_exception_record( callable $callback ): array {
\ttry {
\t\t$callback();
\t\treturn array( 'threw' => false );
\t} catch ( Throwable $e ) {
\t\treturn array(
\t\t\t'threw' => true,
\t\t\t'class' => get_class( $e ),
\t\t\t'message' => $e->getMessage(),
\t\t\t'code' => $e->getCode(),
\t\t);
\t}
}

$headers = new HeadersCollection( array( 'X-Test' => 'one, two', 'content-type' => array( 'application/json' ) ) );
$headers2 = $headers->withHeader( 'x-test', array( 'three' ) );

$base_options = new RequestOptions();
$base_options->setTimeout( 4.5 );
$base_options->setConnectTimeout( 1.25 );
$base_options->setMaxRedirects( 0 );

$parameter_options = new RequestOptions();
$parameter_options->setTimeout( 8.0 );
$parameter_options->setMaxRedirects( 3 );

$get_request = new Request( HttpMethodEnum::GET(), 'https://api.example/items', array( 'Accept' => 'application/json' ), array( 'q' => 'blue sky', 'page' => 2 ) );
$post_request = new Request( HttpMethodEnum::POST(), 'https://api.example/items', array( 'Content-Type' => 'application/json', 'X-Test' => array( 'a', 'b' ) ), array( 'name' => 'Fixture' ), $base_options );
$post_clone = $post_request->withHeader( 'X-Trace', 'trace-1' )->withData( array( 'name' => 'Updated' ) )->withOptions( $base_options );
$roundtrip_request = Request::fromArray( $post_clone->toArray() );
$invalid_options = wphx_312_05_exception_record(
\tfunction () {
\t\t$options = new RequestOptions();
\t\t$options->setTimeout( -1.0 );
\t}
);

$success_response = new Response( 201, array( 'Content-Type' => 'application/json', 'X-Test' => array( 'one', 'two' ) ), '{"ok":true,"id":7}' );
$invalid_response = wphx_312_05_exception_record(
\tfn() => new Response( 99, array(), null )
);
$extract_errors = array(
\t'nested' => ErrorMessageExtractor::extractFromResponseData( array( 'error' => array( 'message' => 'Nested error' ) ) ),
\t'string' => ErrorMessageExtractor::extractFromResponseData( array( 'error' => 'String error' ) ),
\t'message' => ErrorMessageExtractor::extractFromResponseData( array( 'message' => 'Message error' ) ),
);
$redirect_exception = wphx_312_05_exception_record( fn() => ResponseUtil::throwIfNotSuccessful( new Response( 302, array( 'Location' => 'https://next.example' ), null ) ) );
$client_exception = wphx_312_05_exception_record( fn() => ResponseUtil::throwIfNotSuccessful( new Response( 429, array(), '{"error":{"message":"Slow down"}}' ) ) );
$server_exception = wphx_312_05_exception_record( fn() => ResponseUtil::throwIfNotSuccessful( new Response( 503, array(), '{"message":"Try later"}' ) ) );

$factory = new Psr17Factory();
$fake_client = new WPHX_312_05_Fake_Client( new Psr7Response( 202, array( 'Content-Type' => 'application/json' ), '{"accepted":true}' ) );
$transporter = new HttpTransporter( $fake_client, $factory, $factory );
$transport_response = $transporter->send( $post_clone, $parameter_options );

$GLOBALS['wphx_312_05_remote_response'] = array(
\t'headers' => array( 'content-type' => 'application/json', 'x-fixture' => 'yes' ),
\t'body' => '{"wp":true}',
\t'response' => array( 'code' => 203, 'message' => 'Non-Authoritative Information' ),
);
$GLOBALS['wphx_312_05_remote_error'] = null;
$wp_client = new WP_AI_Client_HTTP_Client( $factory, $factory );
$wp_request = $factory->createRequest( 'POST', 'https://wp.example/ai' )
\t->withHeader( 'Content-Type', 'application/json' )
\t->withHeader( 'X-Test', array( 'one', 'two' ) )
\t->withBody( $factory->createStream( '{"prompt":"hello"}' ) );
$wp_options = new RequestOptions();
$wp_options->setTimeout( 12.0 );
$wp_options->setMaxRedirects( 2 );
$wp_psr_response = $wp_client->sendRequestWithOptions( $wp_request, $wp_options );
$wp_success_call = $GLOBALS['wphx_312_05_remote_requests'][0];

$GLOBALS['wphx_312_05_remote_error'] = new WP_Error( '0', 'Connection refused' );
$wp_error = wphx_312_05_exception_record( fn() => $wp_client->sendRequest( $factory->createRequest( 'GET', 'https://wp.example/fail' ) ) );

$cases = array(
\t'ai-http:headers-request-options' => array(
\t\t'header_original' => $headers->getAll(),
\t\t'header_case_insensitive' => $headers->get( 'CONTENT-TYPE' ),
\t\t'header_as_string' => $headers->getAsString( 'x-test' ),
\t\t'header_clone_replaced' => $headers2->getAll(),
\t\t'get_uri' => $get_request->getUri(),
\t\t'get_body' => $get_request->getBody(),
\t\t'post_body' => $post_request->getBody(),
\t\t'post_clone_array' => $post_clone->toArray(),
\t\t'roundtrip_array' => $roundtrip_request->toArray(),
\t\t'options_array' => $base_options->toArray(),
\t\t'options_allows_redirects' => $base_options->allowsRedirects(),
\t\t'invalid_options' => $invalid_options,
\t),
\t'ai-http:response-utilities' => array(
\t\t'response_array' => $success_response->toArray(),
\t\t'response_data' => $success_response->getData(),
\t\t'response_successful' => $success_response->isSuccessful(),
\t\t'extract_errors' => $extract_errors,
\t\t'invalid_response' => $invalid_response,
\t\t'redirect_exception' => $redirect_exception,
\t\t'client_exception' => $client_exception,
\t\t'server_exception' => $server_exception,
\t),
\t'ai-http:transporter-fake-client' => array(
\t\t'client_call' => $fake_client->calls[0],
\t\t'response_array' => $transport_response->toArray(),
\t\t'response_data' => $transport_response->getData(),
\t),
\t'ai-http:wordpress-adapter-success' => array(
\t\t'wp_call' => $wp_success_call,
\t\t'status' => $wp_psr_response->getStatusCode(),
\t\t'reason' => $wp_psr_response->getReasonPhrase(),
\t\t'headers' => $wp_psr_response->getHeaders(),
\t\t'body' => (string) $wp_psr_response->getBody(),
\t),
\t'ai-http:wordpress-adapter-error' => $wp_error,
);

ksort( $cases );
echo json_encode(
\tarray(
\t\t'cases' => $cases,
\t\t'php_errors' => $GLOBALS['wphx_312_05_errors'],
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
);
`
  );
}

function runProbe(root) {
  return JSON.parse(command("php", [PROBE, root]));
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-312-ai-http-oracle-fixture`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/ai-http-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "bundled PHP AI Client HTTP DTO, utility, transporter, and WordPress HTTP adapter behavior",
      area: SOURCE_FILES.join(" "),
      public_contract:
        "This fixture executes copied WordPress 7.0 php-ai-client HTTP source and the WordPress AI HTTP adapter against fake in-process PSR-18 and WordPress HTTP transports. It does not perform live network I/O, external provider discovery, provider model generation, installed behavior, upstream PHPUnit parity, or generated public PHP replacement."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-haxe-adapter-contract-foundation",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass real WordPress HTTP transport, provider discovery, model operation, installed distribution, and selected upstream PHPUnit gates before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-ai-http-oracle-fixture",
        "npm run wp:core:wphx-312-ai-http-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-05-ai-http-oracle-fixture"],
      manifest_digest: manifestSha
    }
  };
}

rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
writeProbe();

const oracle = runProbe(ORACLE_ROOT);
const candidate = runProbe(CANDIDATE_ROOT);
const observationsMatch = JSON.stringify(oracle) === JSON.stringify(candidate);

if (!observationsMatch) {
  console.error(JSON.stringify({ status: "failed", oracle, candidate }, null, 2));
  process.exit(1);
}

const phpLint = SOURCE_FILES.map((path) => ({
  path,
  oracle_lint: command("php", ["-l", mirrorPath(ORACLE_ROOT, path)]),
  candidate_lint: command("php", ["-l", mirrorPath(CANDIDATE_ROOT, path)])
}));

const manifest = {
  schema: "wphx.wp-core-ai-http-oracle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["oracle_source_mirror", "candidate_package_mirror"],
  artifact_scope: "fixture",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT),
    http_cron_mail_fixture_manifest: inputRecord(HTTP_FIXTURE),
    feed_embed_https_fixture_manifest: inputRecord(FEED_EMBED_FIXTURE),
    runner: inputRecord(RUNNER),
    upstream_sources: SOURCE_FILES.map(sourceRecord),
    support_sources: SUPPORT_PATHS.flatMap(listFiles).map(sourceRecord)
  },
  fixture: {
    cases: FIXTURE_CASES,
    covered_symbols: COVERED_SYMBOLS,
    source_files: SOURCE_FILES,
    support_paths: SUPPORT_PATHS,
    probe: { path: PROBE, sha256: sha256File(PROBE) },
    side_effect_policy: {
      live_network_io: false,
      external_provider_discovery: false,
      model_generation: false,
      installed_wordpress_behavior: false
    },
    public_abi_policy: {
      public_php_replacement_claimed: false,
      copied_oracle_public_php: true,
      adapter_contract_foundation: CONTRACT,
      installed_wordpress_behavior_claimed: false
    }
  },
  build: {
    oracle_root: ORACLE_ROOT,
    candidate_root: CANDIDATE_ROOT,
    php_lint: phpLint
  },
  observations: {
    oracle,
    candidate,
    match: observationsMatch,
    oracle_sha256: sha256(JSON.stringify(oracle)),
    candidate_sha256: sha256(JSON.stringify(candidate))
  },
  remaining_gaps: [
    {
      id: "live-ai-http-provider-requests-not-executed",
      owner: ISSUE.external_ref,
      detail:
        "The fixture uses fake PSR-18 and WordPress HTTP transports. Real wp_safe_remote_request network behavior, HTTPlug discovery against environment clients, provider API calls, and TLS/error propagation remain later gates."
    },
    {
      id: "ai-model-provider-generation-not-executed",
      owner: ISSUE.external_ref,
      detail:
        "The fixture covers the HTTP boundary only. Provider registry, model metadata, text/image generation operations, event dispatch, caching, and tool/function call behavior remain later AI-client gates."
    },
    {
      id: "trackback-privacy-mail-not-executed",
      owner: ISSUE.external_ref,
      detail:
        "Trackback receipt/ping behavior and privacy request mail/list-table flows are still outside this fixture."
    },
    {
      id: "public-php-adapter-not-yet-generated",
      owner: ISSUE.external_ref,
      detail:
        "The fixture compares copied oracle PHP in both roots; generated original-path PHP replacement remains a later cross-domain gate."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    fixture_cases: FIXTURE_CASES.length,
    covered_symbols: COVERED_SYMBOLS.length,
    observations_match: observationsMatch,
    public_php_replacement_claimed: false
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-312-05-ai-http-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "AI HTTP oracle-source-mirror fixture manifest" },
    { path: OWNERSHIP, role: "ownership manifest for copied-oracle AI HTTP boundary" },
    { path: RUNNER, role: "deterministic oracle/candidate fixture generator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-312-ai-http-oracle-fixture",
    "npm run wp:core:wphx-312-ai-http-oracle-fixture:check",
    "npm run receipts:validate",
    "npm run beads:validate"
  ],
  related_receipts: [
    "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
    "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
    "receipt:wphx-312-03-http-cron-mail-oracle-fixture",
    "receipt:wphx-312-04-feed-embed-https-oracle-fixture"
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
      fixture_cases: FIXTURE_CASES.length,
      observations_match: observationsMatch
    },
    null,
    2
  )
);
