#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.18.22",
  external_ref: "WPHX-312.22",
  title: "WPHX-312.22 - Add MagpieRSS parser oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-magpie-rss-parser-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-312-22";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const OUT = "manifests/wp-core/wphx-312-22-magpie-rss-parser-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-22-magpie-rss-parser-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-22-magpie-rss-parser-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const WRAPPER_FIXTURE = "manifests/wp-core/wphx-312-21-deprecated-embed-rss-wrapper-oracle-fixture.v1.json";

const SOURCE_FILES = ["src/wp-includes/rss.php"];
const COVERED_SYMBOLS = [
  "rss.php",
  "MagpieRSS",
  "feed_start_element",
  "feed_cdata",
  "feed_end_element",
  "normalize",
  "is_rss",
  "is_atom",
  "_response_to_rss",
  "parse_w3cdtf",
  "is_info",
  "is_success",
  "is_redirect",
  "is_error",
  "is_client_error",
  "is_server_error",
  "RSSCache::file_name",
  "RSSCache::serialize",
  "RSSCache::unserialize"
];
const CASES = [
  { id: "magpie:rss2-normalize", focus: "RSS2 parsing, channel/item normalization, namespaces, and RSS version helpers" },
  { id: "magpie:rdf-about", focus: "RDF root detection and item rdf:about capture" },
  { id: "magpie:atom-normalize", focus: "Atom parsing, summary/content normalization, alternate link mapping, and Atom version helpers" },
  { id: "magpie:response-headers", focus: "_response_to_rss parses body and attaches lower-case etag/last-modified headers" },
  { id: "magpie:pure-helpers", focus: "parse_w3cdtf, HTTP status helpers, and RSSCache pure serialization/file-name helpers" }
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

$GLOBALS['wp_version'] = '7.0-fixture';
$GLOBALS['wphx_deprecated'] = array();
$GLOBALS['wphx_actions'] = array();

define( 'WPINC', 'wp-includes' );
define( 'WP_CONTENT_DIR', __DIR__ . '/wp-content' );

function _deprecated_file( $file, $version, $replacement = '' ) {
\t$GLOBALS['wphx_deprecated'][] = array( $file, $version, $replacement );
}
function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_actions'][] = array( 'hook' => $hook_name, 'args' => $args );
}
function wp_trigger_error( $function_name, $message, $error_level = E_USER_NOTICE ) {
\t$GLOBALS['wphx_trigger_errors'][] = array( $function_name, $message, $error_level );
}

require __DIR__ . '/wp-includes/rss.php';

function wphx_bool( $value ) {
\treturn (bool) $value;
}

$rss2_xml = <<<'XML'
<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Fixture RSS</title>
    <description>RSS description</description>
    <item>
      <title>Alpha item</title>
      <link>https://example.test/alpha</link>
      <description>Alpha summary</description>
      <content:encoded><![CDATA[<p>Alpha content</p>]]></content:encoded>
      <dc:creator>Alice</dc:creator>
    </item>
  </channel>
</rss>
XML;

$rdf_xml = <<<'XML'
<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/">
  <channel rdf:about="https://example.test/rdf">
    <title>Fixture RDF</title>
    <description>RDF description</description>
  </channel>
  <item rdf:about="https://example.test/rdf-item">
    <title>RDF item</title>
    <link>https://example.test/rdf-item</link>
    <description>RDF summary</description>
  </item>
</rdf:RDF>
XML;

$atom_xml = <<<'XML'
<?xml version="1.0"?>
<feed version="0.3">
  <title>Fixture Atom</title>
  <tagline>Atom tagline</tagline>
  <entry>
    <title>Atom item</title>
    <summary>Atom summary</summary>
    <content mode="xml"><p>Atom content</p></content>
    <link rel="alternate" href="https://example.test/atom-item" />
  </entry>
</feed>
XML;

$rss2 = new MagpieRSS( $rss2_xml );
$rdf = new MagpieRSS( $rdf_xml );
$atom = new MagpieRSS( $atom_xml );

$response = (object) array(
\t'headers' => array( 'etag: "fixture-etag"', 'last-modified: Sat, 27 Jun 2026 00:00:00 GMT' ),
\t'results' => $rss2_xml,
);
$response_rss = _response_to_rss( $response );

$cache = new RSSCache( __DIR__ . '/cache', 60 );
$cache_payload = (object) array( 'items' => array( array( 'title' => 'Cached item' ) ) );
$cache_serialized = $cache->serialize( $cache_payload );
$cache_unserialized = $cache->unserialize( $cache_serialized );

$result = array(
\t'magpie_constants' => array(
\t\t'RSS' => RSS,
\t\t'ATOM' => ATOM,
\t\t'MAGPIE_USER_AGENT' => MAGPIE_USER_AGENT,
\t),
\t'include_side_effects' => array(
\t\t'deprecated' => $GLOBALS['wphx_deprecated'],
\t\t'actions' => $GLOBALS['wphx_actions'],
\t),
\t'cases' => array(
\t\t'magpie:rss2-normalize' => array(
\t\t\t'feed_type' => $rss2->feed_type,
\t\t\t'feed_version' => $rss2->feed_version,
\t\t\t'is_rss' => $rss2->is_rss(),
\t\t\t'is_atom' => $rss2->is_atom(),
\t\t\t'channel_title' => $rss2->channel['title'] ?? null,
\t\t\t'channel_tagline' => $rss2->channel['tagline'] ?? null,
\t\t\t'item_count' => count( $rss2->items ),
\t\t\t'item_summary' => $rss2->items[0]['summary'] ?? null,
\t\t\t'item_atom_content' => $rss2->items[0]['atom_content'] ?? null,
\t\t\t'item_creator' => $rss2->items[0]['dc']['creator'] ?? null,
\t\t),
\t\t'magpie:rdf-about' => array(
\t\t\t'feed_type' => $rdf->feed_type,
\t\t\t'feed_version' => $rdf->feed_version,
\t\t\t'is_rss' => $rdf->is_rss(),
\t\t\t'item_about' => $rdf->items[0]['about'] ?? null,
\t\t\t'item_summary' => $rdf->items[0]['summary'] ?? null,
\t\t),
\t\t'magpie:atom-normalize' => array(
\t\t\t'feed_type' => $atom->feed_type,
\t\t\t'feed_version' => $atom->feed_version,
\t\t\t'is_atom' => $atom->is_atom(),
\t\t\t'is_rss' => $atom->is_rss(),
\t\t\t'channel_description' => $atom->channel['description'] ?? null,
\t\t\t'item_description' => $atom->items[0]['description'] ?? null,
\t\t\t'item_content_encoded' => $atom->items[0]['content']['encoded'] ?? null,
\t\t\t'item_link' => $atom->items[0]['link'] ?? null,
\t\t),
\t\t'magpie:response-headers' => array(
\t\t\t'parsed' => wphx_bool( $response_rss ),
\t\t\t'etag' => $response_rss->etag ?? null,
\t\t\t'last_modified' => $response_rss->last_modified ?? null,
\t\t\t'item_count' => $response_rss ? count( $response_rss->items ) : 0,
\t\t),
\t\t'magpie:pure-helpers' => array(
\t\t\t'parse_zulu' => gmdate( 'c', parse_w3cdtf( '2026-06-27T03:04:05Z' ) ),
\t\t\t'parse_offset' => gmdate( 'c', parse_w3cdtf( '2026-06-27T03:04:05+02:30' ) ),
\t\t\t'parse_invalid' => parse_w3cdtf( 'not-a-date' ),
\t\t\t'status' => array(
\t\t\t\t'info' => is_info( 102 ),
\t\t\t\t'success' => is_success( 204 ),
\t\t\t\t'redirect' => is_redirect( 301 ),
\t\t\t\t'error' => is_error( 503 ),
\t\t\t\t'client_error' => is_client_error( 404 ),
\t\t\t\t'server_error' => is_server_error( 503 ),
\t\t\t),
\t\t\t'cache_file_name' => $cache->file_name( 'https://example.test/feed' ),
\t\t\t'cache_unserialized_title' => $cache_unserialized->items[0]['title'] ?? null,
\t\t),
\t),
);

echo json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\\n";
`
  );
}

function runProbe(root) {
  const stdout = command("php", ["probe.php"], { cwd: root });
  return JSON.parse(stdout);
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-312-magpie-rss-parser-oracle-fixture`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/magpie-rss-parser-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "MagpieRSS parser and pure helper behavior",
      area: SOURCE_FILES.join(" "),
      public_contract:
        "This fixture executes copied WordPress 7.0 wp-includes/rss.php in PHP CLI with deterministic RSS/RDF/Atom XML strings and local WordPress stubs. It observes parser normalization, response header handoff, W3C date parsing, status helpers, and pure RSSCache helpers without remote HTTP fetching, transients, wp_rss/get_rss display output, or installed feed behavior."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-stubbed-wordpress-boundary",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass remote fetch/cache/display behavior, installed feed widgets/routes, selected upstream PHPUnit, and ecosystem fixtures before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-magpie-rss-parser-oracle-fixture",
        "npm run wp:core:wphx-312-magpie-rss-parser-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-22-magpie-rss-parser-oracle-fixture"],
      manifest_digest: manifestSha
    }
  };
}

function summarize(observations) {
  const cases = observations.cases;
  return {
    rss2_item_count: cases["magpie:rss2-normalize"].item_count,
    rdf_item_about: cases["magpie:rdf-about"].item_about,
    atom_link: cases["magpie:atom-normalize"].item_link,
    response_etag: cases["magpie:response-headers"].etag,
    parse_invalid: cases["magpie:pure-helpers"].parse_invalid,
    cache_unserialized_title: cases["magpie:pure-helpers"].cache_unserialized_title
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
  const probeLint = {
    oracle_lint: command("php", ["-l", `${ORACLE_ROOT}/probe.php`]),
    candidate_lint: command("php", ["-l", `${CANDIDATE_ROOT}/probe.php`])
  };

  const manifest = {
    schema: "wphx.wp-core-magpie-rss-parser-oracle-fixture.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_classes: ["oracle_source_mirror", "candidate_package_mirror", "php_cli_observed_fixture"],
    artifact_scope: "fixture",
    inputs: {
      surface_manifest: inputRecord(SURFACE),
      adapter_contract_manifest: inputRecord(CONTRACT),
      deprecated_wrapper_fixture_manifest: inputRecord(WRAPPER_FIXTURE),
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
        wordPress_stubs: "_deprecated_file, do_action, and wp_trigger_error are deterministic local stubs; copied rss.php remains the executed parser source."
      },
      public_abi_policy: {
        public_php_replacement_claimed: false,
        copied_oracle_public_php: true,
        adapter_contract_foundation: CONTRACT,
        installed_wordpress_behavior_claimed: false
      }
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
        id: "remote-fetch-cache-display-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "The fixture avoids fetch_rss remote HTTP, _fetch_remote_file, transient-backed RSSCache set/get/check_cache, wp_rss/get_rss display output, and widget behavior. Those remain separate gates."
      },
      {
        id: "installed-feed-widget-routing-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "The fixture executes rss.php directly in PHP CLI with local XML strings. Installed feed routes, widgets, admin screens, and network behavior remain later gates."
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
      remote_fetch_cache_display_claimed: false
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestText);
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-312-22-magpie-rss-parser-oracle-fixture",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "MagpieRSS parser oracle-source-mirror fixture manifest" },
      { path: OWNERSHIP, role: "ownership manifest for copied-oracle MagpieRSS parser boundary" },
      { path: RUNNER, role: "deterministic PHP CLI oracle/candidate fixture generator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-312-magpie-rss-parser-oracle-fixture",
      "npm run wp:core:wphx-312-magpie-rss-parser-oracle-fixture:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
      "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
      "receipt:wphx-312-21-deprecated-embed-rss-wrapper-oracle-fixture"
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
