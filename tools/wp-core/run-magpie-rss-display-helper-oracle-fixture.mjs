#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-d7p",
  external_ref: "WPHX-312.24",
  title: "WPHX-312.24 - Add MagpieRSS display helper oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-magpie-rss-display-helper-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-312-24";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const OUT = "manifests/wp-core/wphx-312-24-magpie-rss-display-helper-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-24-magpie-rss-display-helper-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-24-magpie-rss-display-helper-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const FETCH_FIXTURE = "manifests/wp-core/wphx-312-23-magpie-rss-fetch-cache-oracle-fixture.v1.json";

const SOURCE_FILES = ["src/wp-includes/rss.php"];
const COVERED_SYMBOLS = [
  "rss.php",
  "wp_rss",
  "get_rss",
  "fetch_rss",
  "RSSCache::check_cache",
  "RSSCache::get",
  "get_transient",
  "esc_url",
  "esc_attr",
  "esc_html",
  "_e",
  "strip_tags",
  "array_slice",
  "printf",
  "MAGPIE_CACHE_DIR",
  "MAGPIE_CACHE_AGE"
];
const CASES = [
  { id: "magpie:wp-rss-one-item", focus: "wp_rss wraps a limited cached feed in ul/li and escapes URL, stripped description, and title" },
  { id: "magpie:wp-rss-all-items", focus: "wp_rss with -1 emits every cached item" },
  { id: "magpie:wp-rss-error-message", focus: "wp_rss failure path echoes the translated feed-down message" },
  { id: "magpie:get-rss-two-items", focus: "get_rss emits limited bare li rows and preserves raw link/description attributes" },
  { id: "magpie:get-rss-failure", focus: "get_rss failure returns false and emits no markup" }
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

function mirrorSources(root) {
  for (const path of SOURCE_FILES) {
    const target = mirrorPath(root, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(upstreamPath(path), target);
  }
}

function writeProbe(root) {
  writeFileSync(
    `${root}/probe.php`,
    `<?php
error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

$case = $argv[1] ?? '';

$GLOBALS['wp_version'] = '7.0-fixture';
$GLOBALS['wphx_case'] = $case;
$GLOBALS['wphx_deprecated'] = array();
$GLOBALS['wphx_actions'] = array();
$GLOBALS['wphx_trigger_errors'] = array();
$GLOBALS['wphx_transients'] = array();
$GLOBALS['wphx_get_transients'] = array();
$GLOBALS['wphx_remote_requests'] = array();
$GLOBALS['wphx_escape_calls'] = array();
$GLOBALS['wphx_translate_calls'] = array();

define( 'WPINC', 'wp-includes' );
define( 'WP_CONTENT_DIR', __DIR__ . '/wp-content' );
define( 'MAGPIE_CACHE_DIR', __DIR__ . '/wp-content/cache' );
define( 'MAGPIE_CACHE_AGE', 456 );

class WP_Error {
\tpublic $errors;

\tpublic function __construct( $code, $message ) {
\t\t$this->errors = array( $code => array( $message ) );
\t}
}

function _deprecated_file( $file, $version, $replacement = '' ) {
\t$GLOBALS['wphx_deprecated'][] = array( $file, $version, $replacement );
}

function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_actions'][] = array( 'hook' => $hook_name, 'args' => $args );
}

function wp_trigger_error( $function_name, $message, $error_level = E_USER_NOTICE ) {
\t$GLOBALS['wphx_trigger_errors'][] = array( $function_name, $message, $error_level );
}

function esc_url( $value ) {
\t$GLOBALS['wphx_escape_calls'][] = array( 'esc_url', $value );
\treturn 'esc_url:' . htmlspecialchars( $value, ENT_QUOTES, 'UTF-8' );
}

function esc_attr( $value ) {
\t$GLOBALS['wphx_escape_calls'][] = array( 'esc_attr', $value );
\treturn 'esc_attr:' . htmlspecialchars( $value, ENT_QUOTES, 'UTF-8' );
}

function esc_html( $value ) {
\t$GLOBALS['wphx_escape_calls'][] = array( 'esc_html', $value );
\treturn 'esc_html:' . htmlspecialchars( $value, ENT_QUOTES, 'UTF-8' );
}

function _e( $value ) {
\t$GLOBALS['wphx_translate_calls'][] = $value;
\techo 'translated:' . $value;
}

function is_wp_error( $thing ) {
\treturn $thing instanceof WP_Error;
}

function wp_safe_remote_request( $url, $args = array() ) {
\t$GLOBALS['wphx_remote_requests'][] = array( 'url' => $url, 'headers' => $args['headers'] ?? null );
\treturn new WP_Error( 'display_fixture_remote_disabled', 'Display fixture remote disabled' );
}

function wp_remote_retrieve_headers( $resp ) {
\treturn array();
}

function wp_remote_retrieve_response_code( $resp ) {
\treturn 500;
}

function wp_remote_retrieve_body( $resp ) {
\treturn '';
}

function set_transient( $key, $value, $expiration ) {
\t$GLOBALS['wphx_transients'][ $key ] = $value;
\treturn true;
}

function get_transient( $key ) {
\t$GLOBALS['wphx_get_transients'][] = $key;
\treturn $GLOBALS['wphx_transients'][ $key ] ?? false;
}

require __DIR__ . '/wp-includes/rss.php';

function wphx_cache_key( $url ) {
\treturn 'rss_' . md5( $url );
}

function wphx_feed_object() {
\treturn (object) array(
\t\t'channel' => array( 'title' => 'Display Fixture RSS' ),
\t\t'items' => array(
\t\t\tarray(
\t\t\t\t'title' => 'Alpha & One',
\t\t\t\t'link' => 'https://example.test/alpha?x=1&y=2',
\t\t\t\t'description' => '<strong>Alpha</strong> "quoted" summary',
\t\t\t),
\t\t\tarray(
\t\t\t\t'title' => 'Beta <Two>',
\t\t\t\t'link' => 'https://example.test/beta',
\t\t\t\t'description' => 'Beta plain summary',
\t\t\t),
\t\t\tarray(
\t\t\t\t'title' => 'Gamma Three',
\t\t\t\t'link' => 'https://example.test/gamma',
\t\t\t\t'description' => 'Gamma summary',
\t\t\t),
\t\t),
\t);
}

function wphx_seed_feed( $url ) {
\t$GLOBALS['wphx_transients'][ wphx_cache_key( $url ) ] = wphx_feed_object();
}

function wphx_capture( $callback ) {
\tob_start();
\t$return = $callback();
\t$output = ob_get_clean();
\treturn array( $output, $return );
}

function wphx_base_result() {
\treturn array(
\t\t'case' => $GLOBALS['wphx_case'],
\t\t'include_side_effects' => array(
\t\t\t'deprecated' => $GLOBALS['wphx_deprecated'],
\t\t\t'actions' => $GLOBALS['wphx_actions'],
\t\t),
\t);
}

function wphx_output_result( $output, $return ) {
\treturn array_merge( wphx_base_result(), array(
\t\t'output' => $output,
\t\t'output_sha256' => hash( 'sha256', $output ),
\t\t'return_value' => $return,
\t\t'escape_calls' => $GLOBALS['wphx_escape_calls'],
\t\t'translate_calls' => $GLOBALS['wphx_translate_calls'],
\t\t'get_transients' => $GLOBALS['wphx_get_transients'],
\t\t'remote_requests' => $GLOBALS['wphx_remote_requests'],
\t) );
}

function wphx_wp_rss_one_item() {
\t$url = 'https://example.test/display';
\twphx_seed_feed( $url );
\tlist( $output, $return ) = wphx_capture( function () use ( $url ) {
\t\treturn wp_rss( $url, 1 );
\t} );
\treturn wphx_output_result( $output, $return );
}

function wphx_wp_rss_all_items() {
\t$url = 'https://example.test/display';
\twphx_seed_feed( $url );
\tlist( $output, $return ) = wphx_capture( function () use ( $url ) {
\t\treturn wp_rss( $url, -1 );
\t} );
\treturn wphx_output_result( $output, $return );
}

function wphx_wp_rss_error_message() {
\t$url = 'https://example.test/missing';
\tlist( $output, $return ) = wphx_capture( function () use ( $url ) {
\t\treturn wp_rss( $url, 1 );
\t} );
\treturn wphx_output_result( $output, $return );
}

function wphx_get_rss_two_items() {
\t$url = 'https://example.test/display';
\twphx_seed_feed( $url );
\tlist( $output, $return ) = wphx_capture( function () use ( $url ) {
\t\treturn get_rss( $url, 2 );
\t} );
\treturn wphx_output_result( $output, $return );
}

function wphx_get_rss_failure() {
\t$url = 'https://example.test/missing';
\tlist( $output, $return ) = wphx_capture( function () use ( $url ) {
\t\treturn get_rss( $url, 2 );
\t} );
\treturn wphx_output_result( $output, $return );
}

$handlers = array(
\t'magpie:wp-rss-one-item' => 'wphx_wp_rss_one_item',
\t'magpie:wp-rss-all-items' => 'wphx_wp_rss_all_items',
\t'magpie:wp-rss-error-message' => 'wphx_wp_rss_error_message',
\t'magpie:get-rss-two-items' => 'wphx_get_rss_two_items',
\t'magpie:get-rss-failure' => 'wphx_get_rss_failure',
);

if ( ! isset( $handlers[ $case ] ) ) {
\tfwrite( STDERR, "Unknown case: $case\\n" );
\texit( 2 );
}

echo json_encode( $handlers[ $case ](), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\\n";
`
  );
}

function runProbe(root, caseId) {
  const stdout = command("php", ["probe.php", caseId], { cwd: root });
  return JSON.parse(stdout);
}

function runAllCases(root) {
  return Object.fromEntries(CASES.map((fixtureCase) => [fixtureCase.id, runProbe(root, fixtureCase.id)]));
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-312-magpie-rss-display-helper-oracle-fixture`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/magpie-rss-display-helper-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "MagpieRSS display helper behavior",
      area: SOURCE_FILES.join(" "),
      public_contract:
        "This fixture executes copied WordPress 7.0 wp-includes/rss.php in PHP CLI with deterministic transient-backed feed objects and escaping/translation stubs. It observes wp_rss and get_rss display-helper output without live network, widgets, installed routes, broad SimplePie behavior, database-backed feeds, or generated public PHP replacement."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-stubbed-wordpress-boundary",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass display helper, widget, installed route, selected upstream PHPUnit, and ecosystem fixtures before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-magpie-rss-display-helper-oracle-fixture",
        "npm run wp:core:wphx-312-magpie-rss-display-helper-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-24-magpie-rss-display-helper-oracle-fixture"],
      manifest_digest: manifestSha
    }
  };
}

function summarize(observations) {
  return {
    wp_rss_one_item_sha256: observations["magpie:wp-rss-one-item"].output_sha256,
    wp_rss_all_item_count: observations["magpie:wp-rss-all-items"].escape_calls.filter((call) => call[0] === "esc_html").length,
    wp_rss_error_message: observations["magpie:wp-rss-error-message"].output,
    get_rss_two_item_li_count: (observations["magpie:get-rss-two-items"].output.match(/<li>/g) ?? []).length,
    get_rss_failure_return: observations["magpie:get-rss-failure"].return_value,
    get_rss_failure_output_sha256: observations["magpie:get-rss-failure"].output_sha256
  };
}

function buildRoot(root) {
  mirrorSources(root);
  writeProbe(root);
}

async function main() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  buildRoot(ORACLE_ROOT);
  buildRoot(CANDIDATE_ROOT);

  const oracle = runAllCases(ORACLE_ROOT);
  const candidate = runAllCases(CANDIDATE_ROOT);
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
  const probeLint = {
    oracle_lint: command("php", ["-l", `${ORACLE_ROOT}/probe.php`]),
    candidate_lint: command("php", ["-l", `${CANDIDATE_ROOT}/probe.php`])
  };

  const manifest = {
    schema: "wphx.wp-core-magpie-rss-display-helper-oracle-fixture.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_classes: ["oracle_source_mirror", "candidate_package_mirror", "php_cli_observed_fixture"],
    artifact_scope: "fixture",
    inputs: {
      surface_manifest: inputRecord(SURFACE),
      adapter_contract_manifest: inputRecord(CONTRACT),
      fetch_cache_fixture_manifest: inputRecord(FETCH_FIXTURE),
      runner: inputRecord(RUNNER),
      upstream_sources: SOURCE_FILES.map(sourceRecord)
    },
    fixture: {
      cases: CASES,
      covered_symbols: COVERED_SYMBOLS,
      source_files: SOURCE_FILES,
      side_effect_policy: {
        external_network_io: false,
        database_io: false,
        transients_io: false,
        live_installed_wordpress: false,
        php_cli: true,
        wordPress_stubs:
          "esc_url, esc_attr, esc_html, _e, get_transient, set_transient, wp_safe_remote_request, wp_remote_retrieve_headers, wp_remote_retrieve_response_code, wp_remote_retrieve_body, is_wp_error, _deprecated_file, do_action, and wp_trigger_error are deterministic local stubs; copied rss.php remains the executed display-helper source."
      },
      public_abi_policy: {
        public_php_replacement_claimed: false,
        copied_oracle_public_php: true,
        adapter_contract_foundation: CONTRACT,
        installed_wordpress_behavior_claimed: false
      },
      display_quirks_observed: [
        "wp_rss wraps output in a ul and escapes URL, stripped description title attribute, and title text.",
        "get_rss emits bare li rows, escapes only the title text, and preserves raw link and description attributes."
      ]
    },
    build: { oracle_root: ORACLE_ROOT, candidate_root: CANDIDATE_ROOT, php_lint: phpLint, probe_lint: probeLint },
    observations: {
      oracle,
      candidate,
      match: observationsMatch,
      summary: summarize(oracle),
      oracle_sha256: sha256(JSON.stringify(oracle)),
      candidate_sha256: sha256(JSON.stringify(candidate))
    },
    remaining_gaps: [
      {
        id: "live-network-and-installed-routes-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "The fixture uses cached transient objects and disables remote HTTP. Installed feed routes, widgets, admin screens, and database-backed feed behavior remain later gates."
      },
      {
        id: "simplepie-and-modern-feed-display-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "The fixture covers deprecated MagpieRSS rss.php display helpers only; SimplePie parsing/cache behavior and modern widget rendering remain outside this claim."
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
      public_php_replacement_claimed: false,
      installed_wordpress_behavior_claimed: false,
      live_network_behavior_claimed: false,
      widget_route_behavior_claimed: false
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestText);
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-312-24-magpie-rss-display-helper-oracle-fixture",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "MagpieRSS display-helper oracle-source-mirror fixture manifest" },
      { path: OWNERSHIP, role: "ownership manifest for copied-oracle MagpieRSS display-helper boundary" },
      { path: RUNNER, role: "deterministic PHP CLI oracle/candidate fixture generator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-312-magpie-rss-display-helper-oracle-fixture",
      "npm run wp:core:wphx-312-magpie-rss-display-helper-oracle-fixture:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
      "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
      "receipt:wphx-312-23-magpie-rss-fetch-cache-oracle-fixture"
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
