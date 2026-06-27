#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.18.38",
  external_ref: "WPHX-312.51",
  title: "WPHX-312.51 - Promote WP_HTTP_Proxy bypass routing to Haxe candidate"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-http-proxy-candidate.mjs";
const HXML = "fixtures/wp-core/http-proxy-candidate.hxml";
const OUT_ROOT = "build/wp-core/wphx-312-51";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-312-51-http-proxy-candidate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-51-http-proxy-candidate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-51-http-proxy-candidate.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const PROXY_FIXTURE = "manifests/wp-core/wphx-312-32-http-proxy-oracle-fixture.v1.json";

const SOURCE_FILES = ["src/wp-includes/class-wp-http-proxy.php"];
const HAXE_SOURCES = [
  HXML,
  "src/wphx/wp/http/HttpProxyStrategy.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/HttpProxyCandidateEntry.hx"
];
const PROMOTED_SYMBOLS = ["WP_HTTP_Proxy::send_through_proxy post-filter routing decision"];
const CASES = [
  { id: "http-proxy:disabled-defaults", focus: "proxy constants absent returns disabled state and empty authentication accessors" },
  { id: "http-proxy:enabled-auth", focus: "proxy host/port and authentication constants drive accessors, auth string, header, and external proxy routing" },
  { id: "http-proxy:bypass-local-site", focus: "localhost and current site URL hosts bypass proxy while external hosts use it" },
  { id: "http-proxy:bypass-exact", focus: "WP_PROXY_BYPASS_HOSTS exact host list bypasses configured hosts only" },
  { id: "http-proxy:bypass-wildcard", focus: "WP_PROXY_BYPASS_HOSTS wildcard patterns bypass matching hosts and do not match bare domains" },
  { id: "http-proxy:filter-overrides", focus: "pre_http_send_through_proxy true/false overrides proxy routing before default host rules" },
  { id: "http-proxy:malformed-url", focus: "malformed parse_url failure passes through proxy decision without filters or host checks" }
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
  return `if ( ! function_exists( 'wphx_312_51_bootstrap_haxe' ) ) {
\tfunction wphx_312_51_bootstrap_haxe() {
\t\tstatic $bootstrapped = false;
\t\tif ( $bootstrapped ) {
\t\t\treturn;
\t\t}
\t\t$bootstrapped = true;

\t\t$wphx_312_51_lib = dirname( __DIR__, 2 ) . '/haxe/lib';
\t\tset_include_path( get_include_path() . PATH_SEPARATOR . $wphx_312_51_lib );
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
wphx_312_51_bootstrap_haxe();
`;
}

function installBootstrap(source) {
  const marker = "<?php\n";
  if (!source.startsWith(marker)) throw new Error("class-wp-http-proxy.php did not start with PHP open tag");
  return `${marker}\n${haxeBootstrapBlock()}\n${source.slice(marker.length)}`;
}

function replaceMethod(source, methodName, replacement) {
  const pattern = new RegExp(`public\\s+function\\s+${methodName}\\s*\\(`, "m");
  const match = pattern.exec(source);
  if (!match) throw new Error(`Unable to locate method ${methodName}`);
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

function transformCandidateProxy() {
  const path = `${CANDIDATE_ROOT}/wp-includes/class-wp-http-proxy.php`;
  let source = installBootstrap(readFileSync(path, "utf8"));
  source = replaceMethod(
    source,
    "send_through_proxy",
    `public function send_through_proxy( $uri ) {
\t$check = parse_url( $uri );

\t// Malformed URL, can not process, but this could mean ssl, so let through anyway.
\tif ( false === $check ) {
\t\treturn true;
\t}

\t$home = parse_url( get_option( 'siteurl' ) );

\t/**
\t * Filters whether to preempt sending the request through the proxy.
\t *
\t * Returning false will bypass the proxy; returning true will send
\t * the request through the proxy. Returning null bypasses the filter.
\t *
\t * @since 3.5.0
\t *
\t * @param bool|null $override Whether to send the request through the proxy. Default null.
\t * @param string    $uri      URL of the request.
\t * @param array     $check    Associative array result of parsing the request URL with \`parse_url()\`.
\t * @param array     $home     Associative array result of parsing the site URL with \`parse_url()\`.
\t */
\t$result = apply_filters( 'pre_http_send_through_proxy', null, $uri, $check, $home );
\tif ( ! is_null( $result ) ) {
\t\treturn $result;
\t}

\t$request_host = $check['host'] ?? '';
\t$site_host    = isset( $home['host'] ) ? $home['host'] : '';
\t$bypass_hosts = defined( 'WP_PROXY_BYPASS_HOSTS' ) ? WP_PROXY_BYPASS_HOSTS : '';
\treturn \\wphx\\wp\\http\\HttpProxyStrategy::shouldSendThroughProxy( $request_host, $site_host, $bypass_hosts );
}`
  );
  writeFileSync(path, source);
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

$GLOBALS['wphx_case'] = $case;
$GLOBALS['wphx_filters'] = array();
$GLOBALS['wphx_options'] = array( 'siteurl' => 'https://site.example.test' );

switch ( $case ) {
\tcase 'http-proxy:enabled-auth':
\t\tdefine( 'WP_PROXY_HOST', 'proxy.example' );
\t\tdefine( 'WP_PROXY_PORT', '8080' );
\t\tdefine( 'WP_PROXY_USERNAME', 'proxy-user' );
\t\tdefine( 'WP_PROXY_PASSWORD', 'proxy-pass' );
\t\tbreak;
\tcase 'http-proxy:bypass-local-site':
\tcase 'http-proxy:filter-overrides':
\tcase 'http-proxy:malformed-url':
\t\tdefine( 'WP_PROXY_HOST', 'proxy.example' );
\t\tdefine( 'WP_PROXY_PORT', '8080' );
\t\tbreak;
\tcase 'http-proxy:bypass-exact':
\t\tdefine( 'WP_PROXY_HOST', 'proxy.example' );
\t\tdefine( 'WP_PROXY_PORT', '8080' );
\t\tdefine( 'WP_PROXY_BYPASS_HOSTS', 'api.example.test,static.example.test' );
\t\tbreak;
\tcase 'http-proxy:bypass-wildcard':
\t\tdefine( 'WP_PROXY_HOST', 'proxy.example' );
\t\tdefine( 'WP_PROXY_PORT', '8080' );
\t\tdefine( 'WP_PROXY_BYPASS_HOSTS', '*.wordpress.org,api.*.example.test' );
\t\tbreak;
}

function get_option( $name, $default = false ) {
\treturn array_key_exists( $name, $GLOBALS['wphx_options'] ) ? $GLOBALS['wphx_options'][ $name ] : $default;
}

function apply_filters( $hook_name, $value, ...$args ) {
\t$record = array(
\t\t'hook' => $hook_name,
\t\t'value' => $value,
\t\t'uri' => $args[0] ?? null,
\t\t'check_host' => $args[1]['host'] ?? null,
\t\t'home_host' => $args[2]['host'] ?? null,
\t);

\tif ( 'pre_http_send_through_proxy' === $hook_name && 'http-proxy:filter-overrides' === $GLOBALS['wphx_case'] ) {
\t\tif ( 'https://force-bypass.example/path' === ( $args[0] ?? null ) ) {
\t\t\t$record['return'] = false;
\t\t\t$GLOBALS['wphx_filters'][] = $record;
\t\t\treturn false;
\t\t}
\t\tif ( 'https://force-proxy.example/path' === ( $args[0] ?? null ) ) {
\t\t\t$record['return'] = true;
\t\t\t$GLOBALS['wphx_filters'][] = $record;
\t\t\treturn true;
\t\t}
\t}

\t$record['return'] = $value;
\t$GLOBALS['wphx_filters'][] = $record;
\treturn $value;
}

require ABSPATH . WPINC . '/class-wp-http-proxy.php';

function wphx_proxy_state( $proxy ) {
\treturn array(
\t\t'is_enabled' => $proxy->is_enabled(),
\t\t'use_authentication' => $proxy->use_authentication(),
\t\t'host' => $proxy->host(),
\t\t'port' => $proxy->port(),
\t\t'username' => $proxy->username(),
\t\t'password' => $proxy->password(),
\t\t'authentication' => $proxy->authentication(),
\t\t'authentication_header' => $proxy->authentication_header(),
\t);
}

$proxy = new WP_HTTP_Proxy();
$send = array();

switch ( $case ) {
\tcase 'http-proxy:enabled-auth':
\t\t$send['external'] = $proxy->send_through_proxy( 'https://external.example.test/path' );
\t\tbreak;
\tcase 'http-proxy:bypass-local-site':
\t\t$send['localhost'] = $proxy->send_through_proxy( 'http://localhost/wp-cron.php' );
\t\t$send['site'] = $proxy->send_through_proxy( 'https://site.example.test/wp-json/' );
\t\t$send['external'] = $proxy->send_through_proxy( 'https://external.example.test/' );
\t\tbreak;
\tcase 'http-proxy:bypass-exact':
\t\t$send['api'] = $proxy->send_through_proxy( 'https://api.example.test/v1' );
\t\t$send['static'] = $proxy->send_through_proxy( 'https://static.example.test/file.css' );
\t\t$send['subdomain'] = $proxy->send_through_proxy( 'https://cdn.api.example.test/v1' );
\t\t$send['external'] = $proxy->send_through_proxy( 'https://external.example.test/' );
\t\tbreak;
\tcase 'http-proxy:bypass-wildcard':
\t\t$send['wordpress_subdomain'] = $proxy->send_through_proxy( 'https://downloads.wordpress.org/plugin.zip' );
\t\t$send['api_subdomain'] = $proxy->send_through_proxy( 'https://api.v1.example.test/path' );
\t\t$send['wordpress_bare'] = $proxy->send_through_proxy( 'https://wordpress.org/path' );
\t\t$send['external'] = $proxy->send_through_proxy( 'https://external.example.test/' );
\t\tbreak;
\tcase 'http-proxy:filter-overrides':
\t\t$send['force_bypass'] = $proxy->send_through_proxy( 'https://force-bypass.example/path' );
\t\t$send['force_proxy'] = $proxy->send_through_proxy( 'https://force-proxy.example/path' );
\t\t$send['neutral_external'] = $proxy->send_through_proxy( 'https://neutral.example/path' );
\t\tbreak;
\tcase 'http-proxy:malformed-url':
\t\t$send['malformed'] = $proxy->send_through_proxy( 'http://' );
\t\tbreak;
}

$state = wphx_proxy_state( $proxy );
$assertions = array();

switch ( $case ) {
\tcase 'http-proxy:disabled-defaults':
\t\t$assertions['disabled'] = false === $state['is_enabled'];
\t\t$assertions['auth_disabled'] = false === $state['use_authentication'];
\t\t$assertions['empty_accessors'] = '' === $state['host'] && '' === $state['port'] && '' === $state['username'] && '' === $state['password'];
\t\t$assertions['empty_auth_pair'] = ':' === $state['authentication'];
\t\t$assertions['empty_auth_header'] = 'Proxy-Authorization: Basic Og==' === $state['authentication_header'];
\t\tbreak;
\tcase 'http-proxy:enabled-auth':
\t\t$assertions['enabled'] = true === $state['is_enabled'];
\t\t$assertions['auth_enabled'] = true === $state['use_authentication'];
\t\t$assertions['accessors'] = 'proxy.example' === $state['host'] && '8080' === $state['port'] && 'proxy-user' === $state['username'] && 'proxy-pass' === $state['password'];
\t\t$assertions['auth_pair'] = 'proxy-user:proxy-pass' === $state['authentication'];
\t\t$assertions['auth_header'] = 'Proxy-Authorization: Basic cHJveHktdXNlcjpwcm94eS1wYXNz' === $state['authentication_header'];
\t\t$assertions['external_uses_proxy'] = true === $send['external'];
\t\tbreak;
\tcase 'http-proxy:bypass-local-site':
\t\t$assertions['localhost_bypasses'] = false === $send['localhost'];
\t\t$assertions['site_bypasses'] = false === $send['site'];
\t\t$assertions['external_uses_proxy'] = true === $send['external'];
\t\tbreak;
\tcase 'http-proxy:bypass-exact':
\t\t$assertions['api_bypasses'] = false === $send['api'];
\t\t$assertions['static_bypasses'] = false === $send['static'];
\t\t$assertions['subdomain_not_exact'] = true === $send['subdomain'];
\t\t$assertions['external_uses_proxy'] = true === $send['external'];
\t\tbreak;
\tcase 'http-proxy:bypass-wildcard':
\t\t$assertions['wordpress_subdomain_bypasses'] = false === $send['wordpress_subdomain'];
\t\t$assertions['api_subdomain_bypasses'] = false === $send['api_subdomain'];
\t\t$assertions['bare_domain_not_wildcard'] = true === $send['wordpress_bare'];
\t\t$assertions['external_uses_proxy'] = true === $send['external'];
\t\tbreak;
\tcase 'http-proxy:filter-overrides':
\t\t$assertions['force_bypass'] = false === $send['force_bypass'];
\t\t$assertions['force_proxy'] = true === $send['force_proxy'];
\t\t$assertions['neutral_external'] = true === $send['neutral_external'];
\t\t$assertions['filters_recorded'] = 3 === count( $GLOBALS['wphx_filters'] );
\t\tbreak;
\tcase 'http-proxy:malformed-url':
\t\t$assertions['malformed_passthrough'] = true === $send['malformed'];
\t\t$assertions['malformed_short_circuits_filters'] = array() === $GLOBALS['wphx_filters'];
\t\tbreak;
}

echo json_encode(
\tarray(
\t\t'case' => $case,
\t\t'state' => $state,
\t\t'send_through_proxy' => $send,
\t\t'filters' => $GLOBALS['wphx_filters'],
\t\t'assertions' => $assertions,
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . PHP_EOL;
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
    manifest_id: "ownership:wp-core/http-proxy-candidate",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "haxe_parity_candidate",
      name: "WP_HTTP_Proxy bypass routing Haxe parity candidate",
      area: "src/wp-includes/class-wp-http-proxy.php public class shell backed by src/wphx/wp/http/HttpProxyStrategy.hx",
      public_contract:
        "The candidate preserves the WP_HTTP_Proxy public PHP class/method ABI while delegating the post-filter send_through_proxy host/bypass decision to generated Haxe PHP. PHP keeps parse_url, get_option('siteurl'), pre_http_send_through_proxy, constants, and authentication header boundaries."
    },
    ownership_state: "haxe_parity_candidate",
    bridge: {
      exists: true,
      kind: "generated-haxe-php-behind-public-php-class-shell",
      removal_gate:
        "Promote from candidate shell to generated original-path adapter only after class-wp-http-proxy.php ownership/linker work proves reflection, include timing, selected upstream HTTP PHPUnit, installed distribution behavior, and live/recorded proxy transport parity."
    },
    owned_paths: [...HAXE_SOURCES, RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-http-proxy-candidate",
        "npm run wp:core:wphx-312-http-proxy-candidate:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-51-http-proxy-candidate", "receipt:wphx-312-32-http-proxy-oracle-fixture"],
      manifest_digest: manifestSha
    }
  };
}

async function main() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  command("haxe", [HXML]);
  transformCandidateProxy();
  writeProbe();

  const oracle = runProbe(ORACLE_ROOT);
  const candidate = runProbe(CANDIDATE_ROOT);
  const observationsMatch = JSON.stringify(oracle) === JSON.stringify(candidate);
  const observationsAssert = Object.values(oracle).every((entry) => Object.values(entry.assertions).every(Boolean));
  if (!observationsMatch || !observationsAssert) {
    console.error(JSON.stringify({ status: "failed", observationsMatch, observationsAssert, oracle, candidate }, null, 2));
    process.exit(1);
  }

  const phpLint = SOURCE_FILES.map((path) => ({
    path,
    oracle_lint: command("php", ["-l", mirrorPath(ORACLE_ROOT, path)]),
    candidate_lint: command("php", ["-l", mirrorPath(CANDIDATE_ROOT, path)])
  }));
  const haxeOutputFiles = command("find", [HAXE_OUT, "-type", "f"]).split("\n").filter(Boolean).sort();
  const manifest = {
    schema: "wphx.wp-core-http-proxy-candidate.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_classes: ["oracle_source_mirror", "haxe_generated_candidate", "php_cli_observed_fixture"],
    artifact_scope: "candidate",
    inputs: {
      surface_manifest: inputRecord(SURFACE),
      adapter_contract_manifest: inputRecord(CONTRACT),
      proxy_oracle_fixture_manifest: inputRecord(PROXY_FIXTURE),
      runner: inputRecord(RUNNER),
      haxe_sources: HAXE_SOURCES.map(inputRecord),
      upstream_sources: SOURCE_FILES.map(sourceRecord)
    },
    candidate: {
      kind: "haxe_generated_http_proxy_routing_strategy",
      hxml: HXML,
      promoted_symbols: PROMOTED_SYMBOLS,
      public_shell: `${CANDIDATE_ROOT}/wp-includes/class-wp-http-proxy.php`,
      generated_php_files: haxeOutputFiles.map(inputRecord),
      boundary_notes: [
        "PHP-native parse_url, get_option('siteurl'), pre_http_send_through_proxy, and wp-config constants remain in the public shell.",
        "Haxe owns the deterministic localhost/site-host, exact bypass, and wildcard bypass routing decision after native PHP preemption."
      ]
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
          "get_option('siteurl') and pre_http_send_through_proxy are deterministic stubs. Oracle executes copied class-wp-http-proxy.php; candidate executes the same public class shell with send_through_proxy's post-filter routing decision delegated to generated Haxe PHP."
      }
    },
    build: { haxe_out: HAXE_OUT, oracle_root: ORACLE_ROOT, candidate_root: CANDIDATE_ROOT, php_lint: phpLint },
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
        id: "public-original-path-adapter-not-yet-generated",
        owner: ISSUE.external_ref,
        detail:
          "The candidate shell is transformed in the fixture build root. Durable class-wp-http-proxy.php generation through the linker/original-path adapter remains later work."
      },
      {
        id: "live-http-transport-proxy-routing-not-executed",
        owner: ISSUE.external_ref,
        detail: "The fixture calls WP_HTTP_Proxy directly and does not execute Requests, cURL, fsockopen, streams, TLS CONNECT, or proxy authentication negotiation."
      },
      {
        id: "installed-distribution-behavior-not-executed",
        owner: ISSUE.external_ref,
        detail: "The candidate is compared in a PHP CLI fixture rather than an installed WordPress distribution."
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
      live_proxy_transport_claimed: false
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestText);
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-312-51-http-proxy-candidate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "WP_HTTP_Proxy Haxe parity candidate manifest" },
      { path: OWNERSHIP, role: "ownership manifest for Haxe-backed HTTP proxy routing candidate" },
      { path: RUNNER, role: "candidate generator and oracle comparator" },
      { path: "src/wphx/wp/http/HttpProxyStrategy.hx", role: "Haxe-owned HTTP proxy routing source" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-312-http-proxy-candidate",
      "npm run wp:core:wphx-312-http-proxy-candidate:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
      "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
      "receipt:wphx-312-32-http-proxy-oracle-fixture"
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

  console.log(JSON.stringify({ status: "passed", output: OUT, ownership: OWNERSHIP, receipt: RECEIPT, fixture_cases: CASES.length }, null, 2));
}

await main();
