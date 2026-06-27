#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.18.24",
  external_ref: "WPHX-312.37",
  title: "WPHX-312.37 - Add SimplePie feed wrapper oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-simplepie-feed-wrapper-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-312-37";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-312-37-simplepie-feed-wrapper-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-37-simplepie-feed-wrapper-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-37-simplepie-feed-wrapper-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const FEED_CACHE_FIXTURE = "manifests/wp-core/wphx-312-35-feed-cache-transient-oracle-fixture.v1.json";
const SIMPLEPIE_FILE_FIXTURE = "manifests/wp-core/wphx-312-36-simplepie-file-http-oracle-fixture.v1.json";

const SOURCE_FILES = [
  "src/wp-includes/class-simplepie.php",
  "src/wp-includes/class-feed.php",
  "src/wp-includes/class-wp-feed-cache.php",
  "src/wp-includes/class-wp-feed-cache-transient.php",
  "src/wp-includes/class-wp-simplepie-file.php",
  "src/wp-includes/class-wp-simplepie-sanitize-kses.php"
];
const GENERATED_SUPPORT_FILES = ["wp-includes/SimplePie/autoloader.php"];
const COVERED_SYMBOLS = [
  "class-simplepie.php",
  "class-feed.php",
  "wp_simplepie_autoload",
  "_deprecated_file",
  "_deprecated_function",
  "SimplePie\\SimplePie",
  "SimplePie\\Cache",
  "SimplePie\\Cache\\Base",
  "SimplePie\\File",
  "SimplePie\\Sanitize",
  "WP_Feed_Cache",
  "WP_Feed_Cache_Transient",
  "WP_SimplePie_File",
  "WP_SimplePie_Sanitize_KSES"
];
const CASES = [
  { id: "simplepie-wrapper:legacy-class-early-return", focus: "class-simplepie returns early without requiring the native autoloader when the legacy global SimplePie class already exists" },
  { id: "simplepie-wrapper:autoload-and-callback", focus: "class-simplepie requires native autoloader and exposes deprecated wp_simplepie_autoload callback" },
  { id: "feed-wrapper:loads-simplepie-when-absent", focus: "class-feed requires class-simplepie when SimplePie\\SimplePie is absent, then loads feed adapter classes" },
  { id: "feed-wrapper:skips-simplepie-when-present", focus: "class-feed skips class-simplepie when SimplePie\\SimplePie is already loaded, while still loading feed adapter classes" }
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
  writeAutoloaderStub(root);
}

function writeAutoloaderStub(root) {
  const path = `${root}/wp-includes/SimplePie/autoloader.php`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `<?php
$GLOBALS['wphx_autoloader_required'] = ( $GLOBALS['wphx_autoloader_required'] ?? 0 ) + 1;
if ( ! class_exists( 'SimplePie\\\\SimplePie', false ) ) {
\teval( <<<'PHP'
namespace SimplePie {
\tclass SimplePie {
\t\tpublic const FILE_SOURCE_REMOTE = 1;
\t\tpublic const CONSTRUCT_MAYBE_HTML = 1;
\t\tpublic const CONSTRUCT_HTML = 2;
\t\tpublic const CONSTRUCT_TEXT = 4;
\t\tpublic const CONSTRUCT_BASE64 = 8;
\t\tpublic const CONSTRUCT_XHTML = 16;
\t}
\tclass Cache {}
\tclass File {}
\tclass Sanitize {}
}
namespace SimplePie\\Cache {
\tinterface Base {}
}
PHP
\t);
}
`
  );
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
define( 'SIMPLEPIE_PCRE_HTML_ATTRIBUTE', '' );

$GLOBALS['wphx_case'] = $case;
$GLOBALS['wphx_deprecated_files'] = array();
$GLOBALS['wphx_deprecated_functions'] = array();
$GLOBALS['wphx_autoloader_required'] = 0;

function __( $text ) {
\treturn $text;
}
function _deprecated_file( $file, $version, $replacement = '', $message = '' ) {
\t$GLOBALS['wphx_deprecated_files'][] = array(
\t\t'file' => $file,
\t\t'version' => $version,
\t\t'replacement' => $replacement,
\t\t'message' => $message,
\t);
}
function _deprecated_function( $function, $version, $replacement = '' ) {
\t$GLOBALS['wphx_deprecated_functions'][] = array(
\t\t'function' => $function,
\t\t'version' => $version,
\t\t'replacement' => $replacement,
\t);
}
function wphx_preload_simplepie_namespace() {
\tif ( class_exists( 'SimplePie\\\\SimplePie', false ) ) {
\t\treturn;
\t}
\teval( <<<'PHP'
namespace SimplePie {
\tclass SimplePie {
\t\tpublic const FILE_SOURCE_REMOTE = 1;
\t\tpublic const CONSTRUCT_MAYBE_HTML = 1;
\t\tpublic const CONSTRUCT_HTML = 2;
\t\tpublic const CONSTRUCT_TEXT = 4;
\t\tpublic const CONSTRUCT_BASE64 = 8;
\t\tpublic const CONSTRUCT_XHTML = 16;
\t}
\tclass Cache {}
\tclass File {}
\tclass Sanitize {}
}
namespace SimplePie\\Cache {
\tinterface Base {}
}
PHP
\t);
}
function wphx_class_map() {
\treturn array(
\t\t'SimplePie\\\\SimplePie' => class_exists( 'SimplePie\\\\SimplePie', false ),
\t\t'SimplePie\\\\Cache' => class_exists( 'SimplePie\\\\Cache', false ),
\t\t'SimplePie\\\\Cache\\\\Base' => interface_exists( 'SimplePie\\\\Cache\\\\Base', false ),
\t\t'SimplePie\\\\File' => class_exists( 'SimplePie\\\\File', false ),
\t\t'SimplePie\\\\Sanitize' => class_exists( 'SimplePie\\\\Sanitize', false ),
\t\t'WP_Feed_Cache' => class_exists( 'WP_Feed_Cache', false ),
\t\t'WP_Feed_Cache_Transient' => class_exists( 'WP_Feed_Cache_Transient', false ),
\t\t'WP_SimplePie_File' => class_exists( 'WP_SimplePie_File', false ),
\t\t'WP_SimplePie_Sanitize_KSES' => class_exists( 'WP_SimplePie_Sanitize_KSES', false ),
\t);
}

$assertions = array();
$result = array( 'case' => $case );

switch ( $case ) {
\tcase 'simplepie-wrapper:legacy-class-early-return':
\t\teval( 'class SimplePie {}' );
\t\trequire ABSPATH . WPINC . '/class-simplepie.php';
\t\t$result['legacy_class_exists'] = class_exists( 'SimplePie', false );
\t\t$result['autoload_function_exists'] = function_exists( 'wp_simplepie_autoload' );
\t\t$result['autoloader_required'] = $GLOBALS['wphx_autoloader_required'];
\t\t$assertions['legacy_exists'] = true === $result['legacy_class_exists'];
\t\t$assertions['function_declared_by_compile'] = true === $result['autoload_function_exists'];
\t\t$assertions['autoloader_not_required'] = 0 === $GLOBALS['wphx_autoloader_required'];
\t\tbreak;

\tcase 'simplepie-wrapper:autoload-and-callback':
\t\trequire ABSPATH . WPINC . '/class-simplepie.php';
\t\twp_simplepie_autoload( 'SimplePie\\\\Parser' );
\t\t$result['classes'] = wphx_class_map();
\t\t$result['autoload_function_exists'] = function_exists( 'wp_simplepie_autoload' );
\t\t$result['autoloader_required'] = $GLOBALS['wphx_autoloader_required'];
\t\t$result['deprecated_functions'] = $GLOBALS['wphx_deprecated_functions'];
\t\t$assertions['autoloader_required_once'] = 1 === $GLOBALS['wphx_autoloader_required'];
\t\t$assertions['callback_exists'] = true === $result['autoload_function_exists'];
\t\t$assertions['deprecated_callback'] = array( array( 'function' => 'wp_simplepie_autoload', 'version' => '6.7.0', 'replacement' => 'SimplePie_Autoloader' ) ) === $GLOBALS['wphx_deprecated_functions'];
\t\t$assertions['simplepie_namespace_loaded'] = true === $result['classes']['SimplePie\\\\SimplePie'];
\t\tbreak;

\tcase 'feed-wrapper:loads-simplepie-when-absent':
\t\trequire ABSPATH . WPINC . '/class-feed.php';
\t\t$result['classes'] = wphx_class_map();
\t\t$result['autoloader_required'] = $GLOBALS['wphx_autoloader_required'];
\t\t$result['deprecated_files'] = $GLOBALS['wphx_deprecated_files'];
\t\t$assertions['class_simplepie_loaded'] = 1 === $GLOBALS['wphx_autoloader_required'] && true === $result['classes']['SimplePie\\\\SimplePie'];
\t\t$assertions['feed_deprecation'] = 'class-feed.php' === $GLOBALS['wphx_deprecated_files'][0]['file'] && '4.7.0' === $GLOBALS['wphx_deprecated_files'][0]['version'] && 'fetch_feed()' === $GLOBALS['wphx_deprecated_files'][0]['replacement'];
\t\t$assertions['feed_cache_deprecation'] = 'class-wp-feed-cache.php' === $GLOBALS['wphx_deprecated_files'][1]['file'] && '5.6.0' === $GLOBALS['wphx_deprecated_files'][1]['version'];
\t\t$assertions['adapter_classes_loaded'] = true === $result['classes']['WP_Feed_Cache'] && true === $result['classes']['WP_Feed_Cache_Transient'] && true === $result['classes']['WP_SimplePie_File'] && true === $result['classes']['WP_SimplePie_Sanitize_KSES'];
\t\tbreak;

\tcase 'feed-wrapper:skips-simplepie-when-present':
\t\twphx_preload_simplepie_namespace();
\t\trequire ABSPATH . WPINC . '/class-feed.php';
\t\t$result['classes'] = wphx_class_map();
\t\t$result['autoloader_required'] = $GLOBALS['wphx_autoloader_required'];
\t\t$result['deprecated_files'] = $GLOBALS['wphx_deprecated_files'];
\t\t$assertions['class_simplepie_skipped'] = 0 === $GLOBALS['wphx_autoloader_required'] && true === $result['classes']['SimplePie\\\\SimplePie'];
\t\t$assertions['feed_deprecation'] = 'class-feed.php' === $GLOBALS['wphx_deprecated_files'][0]['file'] && '4.7.0' === $GLOBALS['wphx_deprecated_files'][0]['version'];
\t\t$assertions['adapter_classes_loaded'] = true === $result['classes']['WP_Feed_Cache'] && true === $result['classes']['WP_Feed_Cache_Transient'] && true === $result['classes']['WP_SimplePie_File'] && true === $result['classes']['WP_SimplePie_Sanitize_KSES'];
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
    manifest_id: "ownership:wp-core/simplepie-feed-wrapper-oracle-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "SimplePie feed wrapper load-order compatibility",
      area: "src/wp-includes/class-simplepie.php src/wp-includes/class-feed.php",
      public_contract:
        "This fixture executes copied WordPress 7.0 wp-includes/class-simplepie.php and class-feed.php in isolated PHP CLI probes with deterministic SimplePie vendor/autoloader and WordPress deprecation/translation stubs. It observes class-simplepie early return without native autoloader loading, compile-visible wp_simplepie_autoload declaration, native autoloader require handoff, deprecated wp_simplepie_autoload callback behavior, class-feed deprecation metadata, conditional class-simplepie loading, skipped class-simplepie loading when SimplePie\\SimplePie already exists, and required feed adapter class availability without claiming SimplePie vendor parser behavior, live feed fetching, KSES sanitizer behavior, transient cache behavior, installed distribution behavior, or generated public PHP ownership."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-stubbed-simplepie-vendor-boundary",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass real SimplePie autoloader/parser/cache/sanitizer integration, live/recorded feed fetching, selected upstream feed PHPUnit, installed distribution routes, and ecosystem fixtures before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-simplepie-feed-wrapper-oracle-fixture",
        "npm run wp:core:wphx-312-simplepie-feed-wrapper-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-37-simplepie-feed-wrapper-oracle-fixture"],
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
    schema: "wphx.wp-core-simplepie-feed-wrapper-oracle-fixture.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_classes: ["oracle_source_mirror", "candidate_package_mirror", "php_cli_observed_fixture"],
    artifact_scope: "fixture",
    inputs: {
      surface_manifest: inputRecord(SURFACE),
      adapter_contract_manifest: inputRecord(CONTRACT),
      feed_cache_fixture_manifest: inputRecord(FEED_CACHE_FIXTURE),
      simplepie_file_fixture_manifest: inputRecord(SIMPLEPIE_FILE_FIXTURE),
      runner: inputRecord(RUNNER),
      upstream_sources: SOURCE_FILES.map(sourceRecord),
      generated_support_files: GENERATED_SUPPORT_FILES.map((path) => ({ path, role: "deterministic SimplePie vendor autoloader stub" }))
    },
    fixture: {
      cases: CASES,
      covered_symbols: COVERED_SYMBOLS,
      source_files: SOURCE_FILES,
      generated_support_files: GENERATED_SUPPORT_FILES,
      probe: { path: PROBE, sha256: sha256File(PROBE) },
      side_effect_policy: {
        external_network_io: false,
        database_io: false,
        live_installed_wordpress: false,
        php_cli: true,
        runtime_stubs:
          "SimplePie vendor classes/interfaces, SimplePie/autoloader.php, translation, _deprecated_file, and _deprecated_function are deterministic stubs; copied class-simplepie.php, class-feed.php, and feed adapter public PHP files remain the executed WordPress sources."
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
        id: "simplepie-vendor-parser-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "The fixture uses deterministic SimplePie vendor class/interface stubs. Real SimplePie parser, registry, sanitizer, cache, and HTTP/file internals remain separate WPHX-312 gates."
      },
      {
        id: "feed-fetching-and-cache-behavior-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "The fixture observes wrapper include behavior only. Live/recorded feed fetching, cache mutation, KSES sanitization, and feed XML parsing remain outside this scope."
      },
      {
        id: "installed-distribution-behavior-not-executed",
        owner: ISSUE.external_ref,
        detail:
          "The fixture uses PHP CLI with deterministic stubs rather than an installed WordPress distribution, plugin/theme include timing, or production SimplePie autoload configuration."
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
      simplepie_vendor_parser_claimed: false,
      live_feed_fetch_claimed: false
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestText);
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-312-37-simplepie-feed-wrapper-oracle-fixture",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "SimplePie feed wrapper oracle-source-mirror fixture manifest" },
      { path: OWNERSHIP, role: "ownership manifest for copied-oracle SimplePie/feed wrapper boundary" },
      { path: RUNNER, role: "deterministic PHP CLI oracle/candidate fixture generator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-312-simplepie-feed-wrapper-oracle-fixture",
      "npm run wp:core:wphx-312-simplepie-feed-wrapper-oracle-fixture:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
      "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
      "receipt:wphx-312-35-feed-cache-transient-oracle-fixture",
      "receipt:wphx-312-36-simplepie-file-http-oracle-fixture"
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
