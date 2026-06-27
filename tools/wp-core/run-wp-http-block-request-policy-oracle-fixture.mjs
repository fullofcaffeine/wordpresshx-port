#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.18.34",
  external_ref: "WPHX-312.47",
  title: "WPHX-312.47 - Add WP_Http block-request policy oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-wp-http-block-request-policy-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-312-47";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-312-47-wp-http-block-request-policy-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-47-wp-http-block-request-policy-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-47-wp-http-block-request-policy-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const HTTP_PROXY_FIXTURE = "manifests/wp-core/wphx-312-32-http-proxy-oracle-fixture.v1.json";
const HTTP_API_FIXTURE = "manifests/wp-core/wphx-312-43-http-api-wrapper-safety-oracle-fixture.v1.json";
const HTTP_REQUEST_FIXTURE = "manifests/wp-core/wphx-312-46-wp-http-request-orchestration-oracle-fixture.v1.json";

const SOURCE_FILES = ["src/wp-includes/class-wp-http.php"];
const COVERED_SYMBOLS = [
  "WP_Http::block_request",
  "WP_HTTP_BLOCK_EXTERNAL",
  "WP_ACCESSIBLE_HOSTS",
  "block_local_requests",
  "get_option",
  "parse_url",
  "localhost",
  "siteurl",
  "wildcard host allowlist",
  "exact host allowlist"
];
const CASES = [
  { id: "wp-http-block:disabled", focus: "missing/false WP_HTTP_BLOCK_EXTERNAL leaves all requests unblocked" },
  { id: "wp-http-block:default-external", focus: "WP_HTTP_BLOCK_EXTERNAL blocks malformed and external URLs while allowing localhost and site host" },
  { id: "wp-http-block:local-filter", focus: "block_local_requests filter can block local/site-host requests" },
  { id: "wp-http-block:accessible-exact", focus: "WP_ACCESSIBLE_HOSTS exact host allowlist bypasses external blocking" },
  { id: "wp-http-block:accessible-wildcard", focus: "WP_ACCESSIBLE_HOSTS wildcard allowlist bypasses matching subdomains only" }
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

if ( 'wp-http-block:default-external' === $case || 'wp-http-block:local-filter' === $case ) {
\tdefine( 'WP_HTTP_BLOCK_EXTERNAL', true );
}
if ( 'wp-http-block:accessible-exact' === $case ) {
\tdefine( 'WP_HTTP_BLOCK_EXTERNAL', true );
\tdefine( 'WP_ACCESSIBLE_HOSTS', 'api.wordpress.org,updates.example.test' );
}
if ( 'wp-http-block:accessible-wildcard' === $case ) {
\tdefine( 'WP_HTTP_BLOCK_EXTERNAL', true );
\tdefine( 'WP_ACCESSIBLE_HOSTS', '*.wordpress.org,downloads.example.test' );
}

$GLOBALS['wphx_filter_calls'] = array();
$GLOBALS['wphx_force_block_local'] = 'wp-http-block:local-filter' === $case;

function apply_filters( $hook, $value, ...$args ) {
\t$GLOBALS['wphx_filter_calls'][] = array( 'hook' => $hook, 'value' => $value, 'args' => $args );
\tif ( 'block_local_requests' === $hook && ! empty( $GLOBALS['wphx_force_block_local'] ) ) {
\t\treturn true;
\t}
\treturn $value;
}

function get_option( $name ) {
\treturn 'siteurl' === $name ? 'https://site.example.test/wp' : null;
}

require ABSPATH . WPINC . '/class-wp-http.php';

$http = new WP_Http();
$assertions = array();
$result = array( 'case' => $case );

switch ( $case ) {
\tcase 'wp-http-block:disabled':
\t\t$result['blocked'] = array(
\t\t\t'external' => $http->block_request( 'https://blocked.example.test/path' ),
\t\t\t'malformed' => $http->block_request( 'http://' ),
\t\t\t'localhost' => $http->block_request( 'http://localhost/path' ),
\t\t);
\t\t$assertions['nothing_blocked_when_disabled'] = array( 'external' => false, 'malformed' => false, 'localhost' => false ) === $result['blocked'];
\t\tbreak;

\tcase 'wp-http-block:default-external':
\t\t$result['blocked'] = array(
\t\t\t'external' => $http->block_request( 'https://blocked.example.test/path' ),
\t\t\t'malformed' => $http->block_request( 'http://' ),
\t\t\t'localhost' => $http->block_request( 'http://localhost/path' ),
\t\t\t'site_host' => $http->block_request( 'https://site.example.test/wp-json/' ),
\t\t);
\t\t$result['filter_calls'] = $GLOBALS['wphx_filter_calls'];
\t\t$assertions['external_and_malformed_blocked'] = true === $result['blocked']['external'] && true === $result['blocked']['malformed'];
\t\t$assertions['local_and_site_allowed'] = false === $result['blocked']['localhost'] && false === $result['blocked']['site_host'];
\t\t$assertions['local_filter_called_twice'] = 2 === count( array_filter( $GLOBALS['wphx_filter_calls'], static function ( $call ) { return 'block_local_requests' === $call['hook']; } ) );
\t\tbreak;

\tcase 'wp-http-block:local-filter':
\t\t$result['blocked'] = array(
\t\t\t'localhost' => $http->block_request( 'http://localhost/path' ),
\t\t\t'site_host' => $http->block_request( 'https://site.example.test/wp-json/' ),
\t\t);
\t\t$result['filter_calls'] = $GLOBALS['wphx_filter_calls'];
\t\t$assertions['local_filter_can_block_local_and_site'] = array( 'localhost' => true, 'site_host' => true ) === $result['blocked'];
\t\tbreak;

\tcase 'wp-http-block:accessible-exact':
\t\t$result['blocked'] = array(
\t\t\t'api_wordpress_org' => $http->block_request( 'https://api.wordpress.org/core/version-check/1.7/' ),
\t\t\t'updates_example' => $http->block_request( 'https://updates.example.test/package.zip' ),
\t\t\t'subdomain_not_exact' => $http->block_request( 'https://downloads.wordpress.org/plugin/example.zip' ),
\t\t\t'other_external' => $http->block_request( 'https://blocked.example.test/path' ),
\t\t);
\t\t$assertions['exact_hosts_allowed'] = false === $result['blocked']['api_wordpress_org'] && false === $result['blocked']['updates_example'];
\t\t$assertions['non_exact_and_other_blocked'] = true === $result['blocked']['subdomain_not_exact'] && true === $result['blocked']['other_external'];
\t\tbreak;

\tcase 'wp-http-block:accessible-wildcard':
\t\t$result['blocked'] = array(
\t\t\t'api_wordpress_org' => $http->block_request( 'https://api.wordpress.org/core/version-check/1.7/' ),
\t\t\t'downloads_wordpress_org' => $http->block_request( 'https://downloads.wordpress.org/plugin/example.zip' ),
\t\t\t'root_wordpress_org' => $http->block_request( 'https://wordpress.org/news/' ),
\t\t\t'downloads_example_exact' => $http->block_request( 'https://downloads.example.test/file.zip' ),
\t\t\t'blocked_external' => $http->block_request( 'https://blocked.example.test/path' ),
\t\t);
\t\t$assertions['wildcard_subdomains_allowed'] = false === $result['blocked']['api_wordpress_org'] && false === $result['blocked']['downloads_wordpress_org'];
\t\t$assertions['root_and_other_external_blocked'] = true === $result['blocked']['root_wordpress_org'] && true === $result['blocked']['blocked_external'];
\t\t$assertions['exact_entry_still_allowed'] = false === $result['blocked']['downloads_example_exact'];
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
    manifest_id: "ownership:wp-core/wp-http-block-request-policy-oracle-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "WP_Http external request blocking policy behavior",
      area: "src/wp-includes/class-wp-http.php WP_Http::block_request",
      public_contract:
        "This fixture executes copied WordPress 7.0 WP_Http::block_request in isolated PHP CLI probes. It observes WP_HTTP_BLOCK_EXTERNAL, WP_ACCESSIBLE_HOSTS exact and wildcard allowlists, malformed URL blocking, localhost/site-host bypasses, and block_local_requests filtering without claiming live HTTP transport, Requests network I/O, DNS resolution, proxy/TLS behavior, installed distribution behavior, or generated public PHP ownership."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-deterministic-option-and-filter-boundary",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass external request blocking, selected upstream HTTP PHPUnit, installed distribution, and ecosystem HTTP policy gates before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-wp-http-block-request-policy-oracle-fixture",
        "npm run wp:core:wphx-312-wp-http-block-request-policy-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-47-wp-http-block-request-policy-oracle-fixture"],
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
    schema: "wphx.wp-core-wp-http-block-request-policy-oracle-fixture.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_classes: ["oracle_source_mirror", "candidate_package_mirror", "php_cli_observed_fixture"],
    artifact_scope: "fixture",
    inputs: {
      surface_manifest: inputRecord(SURFACE),
      adapter_contract_manifest: inputRecord(CONTRACT),
      http_proxy_fixture_manifest: inputRecord(HTTP_PROXY_FIXTURE),
      http_api_wrapper_safety_fixture_manifest: inputRecord(HTTP_API_FIXTURE),
      http_request_orchestration_fixture_manifest: inputRecord(HTTP_REQUEST_FIXTURE),
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
          "Requests Autoload/Requests, get_option('siteurl'), and apply_filters are deterministic local stubs. Copied WP_Http remains the executed policy source; no HTTP request is dispatched."
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
          "The fixture observes external request blocking policy only. It does not execute WP_Http::request, live Requests network I/O, DNS, proxy, TLS, redirects, or transport execution."
      },
      {
        id: "installed-distribution-behavior-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "The fixture uses PHP CLI with deterministic support stubs rather than an installed WordPress distribution, wp-config constants in situ, or ecosystem HTTP callers."
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
      dns_resolution_claimed: false
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestText);
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-312-47-wp-http-block-request-policy-oracle-fixture",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "WP_Http block-request policy oracle-source-mirror fixture manifest" },
      { path: OWNERSHIP, role: "ownership manifest for copied-oracle WP_Http request-blocking policy boundary" },
      { path: RUNNER, role: "deterministic PHP CLI oracle/candidate fixture generator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-312-wp-http-block-request-policy-oracle-fixture",
      "npm run wp:core:wphx-312-wp-http-block-request-policy-oracle-fixture:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
      "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
      "receipt:wphx-312-32-http-proxy-oracle-fixture",
      "receipt:wphx-312-43-http-api-wrapper-safety-oracle-fixture",
      "receipt:wphx-312-46-wp-http-request-orchestration-oracle-fixture"
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
