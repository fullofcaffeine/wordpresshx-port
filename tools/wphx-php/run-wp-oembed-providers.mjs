#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-f2w7",
  external_ref: "WPHX-COMP-PHP-FEED-EMBED-HTTPS-REMAINDER",
  title: "Expand feed embed HTTPS original-path adapters"
};
const RECORDED_AT = "2026-07-02T23:59:45Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wphx-php/run-wp-oembed-providers.mjs";
const HXML = "fixtures/wphx-php/wp-oembed-providers.hxml";
const OUT_ROOT = "build/wphx-php/wp-oembed-providers";
const GENERATED_ROOT = `${OUT_ROOT}/generated`;
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const PROBE = `${OUT_ROOT}/probe.php`;
const GENERATED_SHELL = `${GENERATED_ROOT}/wp-includes/class-wp-oembed.php`;
const ORACLE_SHELL = `${ORACLE_ROOT}/wp-includes/class-wp-oembed.php`;
const EMISSION_MANIFEST = `${GENERATED_ROOT}/wphx-php-emission.v1.json`;
const MANIFEST = "manifests/wphx-php/wp-oembed-providers.v1.json";
const RECEIPT = "receipts/compiler/wphx-comp-php-wp-oembed-providers.v1.json";
const SOURCE_FILES = [
  "src/wphx/compiler/php/WphxPhpCompiler.hx",
  "src/wphx/compiler/php/WphxPhpWordPressAdapters.hx",
  "fixtures/wphx-php/wp-oembed-providers.hxml",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/embed/WpOembedProvidersEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/embed/WpOembedShell.hx"
];
const EXACT_PATTERNS = [
  "if (!defined('WPHX_WP_OEMBED_BOOTSTRAPPED'))",
  "#[AllowDynamicProperties]",
  "class WP_oEmbed",
  "public $providers = array();",
  "public static $early_providers = array();",
  "public static function _add_provider_early($format, $provider, $regex = false)",
  "empty( self::$early_providers['add'] )",
  "self::$early_providers['add'][ $format ] = array(",
  "public static function _remove_provider_early($format)",
  "empty( self::$early_providers['remove'] )",
  "self::$early_providers['remove'][] = $format;"
];
const CASES = [
  { id: "wp-oembed-providers:property-defaults", focus: "reflection-visible providers and early_providers default arrays" },
  { id: "wp-oembed-providers:add-default-regex-false", focus: "_add_provider_early writes provider and default false regex" },
  { id: "wp-oembed-providers:add-regex-true", focus: "_add_provider_early preserves true regex flag" },
  { id: "wp-oembed-providers:remove-order", focus: "_remove_provider_early appends formats in call order" },
  { id: "wp-oembed-providers:add-remove-buckets", focus: "add and remove buckets coexist without clobbering each other" }
];

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 20
  }).trim();
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function inputRecord(path) {
  return { path, bytes: statSync(path).size, sha256: sha256File(path) };
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run without --check to generate it`);
    if (readFileSync(path, "utf8") !== content) throw new Error(`${path} is stale; run without --check to refresh it`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function mirrorOracle() {
  mkdirSync(dirname(ORACLE_SHELL), { recursive: true });
  copyFileSync(`${UPSTREAM_ROOT}/src/wp-includes/class-wp-oembed.php`, ORACLE_SHELL);
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
if ( ! defined( 'WPHX_WP_OEMBED_BOOTSTRAPPED' ) ) {
\tdefine( 'WPHX_WP_OEMBED_BOOTSTRAPPED', true );
}

require ABSPATH . WPINC . '/class-wp-oembed.php';

function wphx_default_properties() {
\t$reflection = new ReflectionClass( 'WP_oEmbed' );
\t$defaults = $reflection->getDefaultProperties();

\treturn array(
\t\t'providers' => $defaults['providers'] ?? null,
\t\t'early_providers' => $defaults['early_providers'] ?? null,
\t);
}

function wphx_reset_early_providers() {
\tWP_oEmbed::$early_providers = array();
}

$assertions = array();
$result = array( 'case' => $case );

switch ( $case ) {
\tcase 'wp-oembed-providers:property-defaults':
\t\t$result['property_defaults'] = wphx_default_properties();
\t\t$assertions['providers_default_array'] = array() === $result['property_defaults']['providers'];
\t\t$assertions['early_providers_default_array'] = array() === $result['property_defaults']['early_providers'];
\t\tbreak;

\tcase 'wp-oembed-providers:add-default-regex-false':
\t\twphx_reset_early_providers();
\t\tWP_oEmbed::_add_provider_early( 'https://early.example/*', 'https://early.example/oembed' );
\t\t$result['early_providers'] = WP_oEmbed::$early_providers;
\t\t$assertions['add_bucket'] = array(
\t\t\t'https://early.example/*' => array( 'https://early.example/oembed', false ),
\t\t) === $result['early_providers']['add'];
\t\tbreak;

\tcase 'wp-oembed-providers:add-regex-true':
\t\twphx_reset_early_providers();
\t\tWP_oEmbed::_add_provider_early( '#https://regex.example/(.*)#i', 'https://regex.example/oembed', true );
\t\t$result['early_providers'] = WP_oEmbed::$early_providers;
\t\t$assertions['regex_true'] = array(
\t\t\t'#https://regex.example/(.*)#i' => array( 'https://regex.example/oembed', true ),
\t\t) === $result['early_providers']['add'];
\t\tbreak;

\tcase 'wp-oembed-providers:remove-order':
\t\twphx_reset_early_providers();
\t\tWP_oEmbed::_remove_provider_early( 'https://removed.example/*' );
\t\tWP_oEmbed::_remove_provider_early( '#https://regex-remove.example/(.*)#i' );
\t\t$result['early_providers'] = WP_oEmbed::$early_providers;
\t\t$assertions['remove_order'] = array(
\t\t\t'https://removed.example/*',
\t\t\t'#https://regex-remove.example/(.*)#i',
\t\t) === $result['early_providers']['remove'];
\t\tbreak;

\tcase 'wp-oembed-providers:add-remove-buckets':
\t\twphx_reset_early_providers();
\t\tWP_oEmbed::_add_provider_early( 'https://both.example/*', 'https://both.example/oembed', false );
\t\tWP_oEmbed::_remove_provider_early( 'https://old.example/*' );
\t\t$result['early_providers'] = WP_oEmbed::$early_providers;
\t\t$assertions['add_bucket_preserved'] = array(
\t\t\t'https://both.example/*' => array( 'https://both.example/oembed', false ),
\t\t) === $result['early_providers']['add'];
\t\t$assertions['remove_bucket_preserved'] = array( 'https://old.example/*' ) === $result['early_providers']['remove'];
\t\tbreak;

\tdefault:
\t\tfwrite( STDERR, 'Unknown case: ' . $case . PHP_EOL );
\t\texit( 2 );
}

$result['assertions'] = $assertions;
echo json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL;
`
  );
}

function runProbe(root) {
  const observations = {};
  for (const fixtureCase of CASES) {
    observations[fixtureCase.id] = JSON.parse(command("php", [PROBE, root, fixtureCase.id]));
  }
  return observations;
}

function assertAllCaseAssertions(observations, label) {
  for (const [caseId, observation] of Object.entries(observations)) {
    const failed = Object.entries(observation.assertions ?? {})
      .filter(([, value]) => value !== true)
      .map(([key]) => key);
    if (failed.length > 0) throw new Error(`${label} failed ${caseId}: ${failed.join(", ")}`);
  }
}

function assertDeepEqual(left, right, label) {
  const leftText = JSON.stringify(left, null, 2);
  const rightText = JSON.stringify(right, null, 2);
  if (leftText !== rightText) {
    throw new Error(`${label} mismatch\noracle:\n${leftText}\ncandidate:\n${rightText}`);
  }
}

function comparable(observations) {
  return Object.fromEntries(
    Object.entries(observations).map(([key, value]) => [
      key,
      {
        property_defaults: value.property_defaults ?? null,
        early_providers: value.early_providers ?? null
      }
    ])
  );
}

function buildManifest({ generatedSource, oracleObservations, candidateObservations, emission }) {
  return {
    schema: "wphx.wphx-php-wp-oembed-providers.v1",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    evidence_class: "compiler_emitted_original_path_shell",
    source_files: SOURCE_FILES.map(inputRecord),
    oracle_source: {
      path: "../wordpress-develop/src/wp-includes/class-wp-oembed.php",
      sha256: sha256File("../wordpress-develop/src/wp-includes/class-wp-oembed.php")
    },
    generated: {
      path: GENERATED_SHELL,
      sha256: sha256File(GENERATED_SHELL),
      lint: command("php", ["-l", GENERATED_SHELL]),
      exact_patterns: Object.fromEntries(EXACT_PATTERNS.map((pattern) => [pattern, generatedSource.includes(pattern)])),
      emission_manifest: {
        path: EMISSION_MANIFEST,
        sha256: sha256File(EMISSION_MANIFEST),
        unsupported: emission.unsupported,
        declarations: emission.files?.[0]?.declarations ?? [],
        core_ir_features: emission.core_ir_features ?? []
      }
    },
    oracle: {
      path: ORACLE_SHELL,
      sha256: sha256File(ORACLE_SHELL),
      lint: command("php", ["-l", ORACLE_SHELL])
    },
    cases: CASES,
    observations: {
      oracle: oracleObservations,
      candidate: candidateObservations
    },
    comparable: {
      oracle: comparable(oracleObservations),
      candidate: comparable(candidateObservations)
    },
    claims: [
      "WPHX PHP emits an original-path wp-includes/class-wp-oembed.php shell with class WP_oEmbed.",
      "The generated shell preserves #[AllowDynamicProperties] plus reflection-visible public providers and public static early_providers default arrays.",
      "The WordPress-profile Adapter IR emits _add_provider_early queue initialization and keyed provider writes through self::$early_providers without raw PHP blocks.",
      "The WordPress-profile Adapter IR emits _remove_provider_early queue initialization and append writes through self::$early_providers without raw PHP blocks.",
      "The compiler core now has PhpStaticProperty IR and static property default metadata support used by this shell."
    ],
    non_claims: [
      "This fixture does not claim WP_oEmbed::__construct, the built-in provider table, provider matching, __call, get_provider, get_data, get_html, discover, fetch, JSON/XML parsing, data2html, _strip_newlines, live oEmbed network behavior, REST controller behavior, or installed WordPress behavior.",
      "This fixture does not claim full class-wp-oembed.php ownership.",
      "This fixture does not claim arbitrary Haxe static property lowering beyond the bounded WPHX PHP IR feature exercised here."
    ]
  };
}

function buildReceipt(manifest) {
  return {
    schema: "wphx.receipt.v1",
    id: "receipt:wphx-comp-php-wp-oembed-providers",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "passed",
    commands: ["npm run wphx:php:wp-oembed-providers", "npm run wphx:php:wp-oembed-providers:check"],
    artifacts: [
      { path: MANIFEST, role: "WPHX PHP WP_oEmbed early-provider manifest", sha256: sha256(JSON.stringify(manifest, null, 2) + "\n") },
      { path: GENERATED_SHELL, role: "compiler-emitted original-path class-wp-oembed.php", sha256: sha256File(GENERATED_SHELL) },
      { path: EMISSION_MANIFEST, role: "WPHX PHP emission manifest", sha256: sha256File(EMISSION_MANIFEST) },
      { path: RUNNER, role: "deterministic WP_oEmbed early-provider runner", sha256: sha256File(RUNNER) }
    ],
    summary: [
      "WPHX PHP emits a bounded WP_oEmbed public class shell for providers/early_providers defaults and the static early-provider add/remove queues.",
      "The generated shell matches the WordPress 7.0 oracle for reflection-visible defaults, add-provider default false regex, add-provider true regex, remove queue ordering, and add/remove bucket coexistence."
    ]
  };
}

rmSync(OUT_ROOT, { recursive: true, force: true });
command("haxe", [HXML]);
mirrorOracle();
writeProbe();

const generatedSource = readFileSync(GENERATED_SHELL, "utf8");
for (const pattern of EXACT_PATTERNS) {
  if (!generatedSource.includes(pattern)) throw new Error(`generated shell missing pattern: ${pattern}`);
}

const emission = JSON.parse(readFileSync(EMISSION_MANIFEST, "utf8"));
if ((emission.unsupported ?? []).length !== 0) throw new Error(`emission unsupported is not empty: ${JSON.stringify(emission.unsupported)}`);
if (!generatedSource.includes("class WP_oEmbed")) throw new Error("generated shell did not emit class WP_oEmbed");

const oracleObservations = runProbe(ORACLE_ROOT);
const candidateObservations = runProbe(GENERATED_ROOT);
assertAllCaseAssertions(oracleObservations, "oracle");
assertAllCaseAssertions(candidateObservations, "candidate");
assertDeepEqual(comparable(oracleObservations), comparable(candidateObservations), "WP_oEmbed early-provider comparable observations");

const manifest = buildManifest({ generatedSource, oracleObservations, candidateObservations, emission });
if (Object.values(manifest.generated.exact_patterns).some((value) => value !== true)) {
  throw new Error("generated exact pattern check failed");
}
const manifestText = JSON.stringify(manifest, null, 2) + "\n";
writeOrCheck(MANIFEST, manifestText);
writeOrCheck(RECEIPT, JSON.stringify(buildReceipt(manifest), null, 2) + "\n");

console.log(
  JSON.stringify(
    {
      ok: true,
      manifest: MANIFEST,
      receipt: RECEIPT,
      generated: GENERATED_SHELL,
      cases: CASES.map((entry) => entry.id)
    },
    null,
    2
  )
);
