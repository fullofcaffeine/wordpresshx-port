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
const RECORDED_AT = "2026-07-02T23:59:30Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wphx-php/run-wp-embed-handlers.mjs";
const HXML = "fixtures/wphx-php/wp-embed-handlers.hxml";
const OUT_ROOT = "build/wphx-php/wp-embed-handlers";
const GENERATED_ROOT = `${OUT_ROOT}/generated`;
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const PROBE = `${OUT_ROOT}/probe.php`;
const GENERATED_SHELL = `${GENERATED_ROOT}/wp-includes/class-wp-embed.php`;
const ORACLE_SHELL = `${ORACLE_ROOT}/wp-includes/class-wp-embed.php`;
const EMISSION_MANIFEST = `${GENERATED_ROOT}/wphx-php-emission.v1.json`;
const MANIFEST = "manifests/wphx-php/wp-embed-handlers.v1.json";
const RECEIPT = "receipts/compiler/wphx-comp-php-wp-embed-handlers.v1.json";
const SOURCE_FILES = [
  "src/wphx/compiler/php/WphxPhpCompiler.hx",
  "src/wphx/compiler/php/WphxPhpWordPressAdapters.hx",
  "fixtures/wphx-php/wp-embed-handlers.hxml",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/embed/WpEmbedHandlersEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/embed/WpEmbedShell.hx"
];
const EXACT_PATTERNS = [
  "if (!defined('WPHX_WP_EMBED_BOOTSTRAPPED'))",
  "#[AllowDynamicProperties]",
  "class WP_Embed",
  "public $handlers;",
  "public function register_handler($id, $regex, $callback, $priority = 10)",
  "$this->handlers[ $priority ][ $id ] = array(",
  "'regex'    => $regex",
  "'callback' => $callback",
  "public function unregister_handler($id, $priority = 10)",
  "unset( $this->handlers[ $priority ][ $id ] );"
];
const CASES = [
  { id: "wp-embed-handlers:register-default", focus: "default priority handler registration" },
  { id: "wp-embed-handlers:register-priorities", focus: "separate priority buckets preserve handler payloads" },
  { id: "wp-embed-handlers:unregister", focus: "unregister removes only the selected priority/id slot" }
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
  copyFileSync(`${UPSTREAM_ROOT}/src/wp-includes/class-wp-embed.php`, ORACLE_SHELL);
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
if ( ! defined( 'WPHX_WP_EMBED_BOOTSTRAPPED' ) ) {
\tdefine( 'WPHX_WP_EMBED_BOOTSTRAPPED', true );
}

require ABSPATH . WPINC . '/class-wp-embed.php';

function wphx_new_embed_without_constructor( $handlers = array() ) {
\t$class = new ReflectionClass( 'WP_Embed' );
\t$embed = $class->newInstanceWithoutConstructor();
\t$embed->handlers = $handlers;
\treturn $embed;
}

$assertions = array();
$result = array( 'case' => $case );

switch ( $case ) {
\tcase 'wp-embed-handlers:register-default':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$embed->register_handler( 'video', '#https://video.example/.+#i', 'wphx_video_callback' );
\t\t$result['handlers'] = $embed->handlers;
\t\t$assertions['default_priority'] = array(
\t\t\t'video' => array(
\t\t\t\t'regex' => '#https://video.example/.+#i',
\t\t\t\t'callback' => 'wphx_video_callback',
\t\t\t),
\t\t) === $embed->handlers[10];
\t\tbreak;

\tcase 'wp-embed-handlers:register-priorities':
\t\t$embed = wphx_new_embed_without_constructor();
\t\t$embed->register_handler( 'early', '#early#', 'early_callback', 1 );
\t\t$embed->register_handler( 'normal', '#normal#', array( 'Fixture_Handler', 'render' ), 10 );
\t\t$embed->register_handler( 'late', '#late#', 'late_callback', 20 );
\t\t$result['handlers'] = $embed->handlers;
\t\t$assertions['priority_buckets'] = array( 1, 10, 20 ) === array_keys( $embed->handlers );
\t\t$assertions['early_payload'] = '#early#' === $embed->handlers[1]['early']['regex'];
\t\t$assertions['array_callback_payload'] = array( 'Fixture_Handler', 'render' ) === $embed->handlers[10]['normal']['callback'];
\t\tbreak;

\tcase 'wp-embed-handlers:unregister':
\t\t$embed = wphx_new_embed_without_constructor( array(
\t\t\t1 => array(
\t\t\t\t'shared' => array( 'regex' => '#early#', 'callback' => 'early_callback' ),
\t\t\t),
\t\t\t10 => array(
\t\t\t\t'shared' => array( 'regex' => '#normal#', 'callback' => 'normal_callback' ),
\t\t\t\t'keep' => array( 'regex' => '#keep#', 'callback' => 'keep_callback' ),
\t\t\t),
\t\t) );
\t\t$embed->unregister_handler( 'shared', 10 );
\t\t$result['handlers'] = $embed->handlers;
\t\t$assertions['removed_selected_slot'] = ! isset( $embed->handlers[10]['shared'] );
\t\t$assertions['kept_same_priority_other_id'] = isset( $embed->handlers[10]['keep'] );
\t\t$assertions['kept_other_priority_same_id'] = isset( $embed->handlers[1]['shared'] );
\t\tbreak;

\tdefault:
\t\tthrow new RuntimeException( 'Unknown case ' . $case );
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

function assertDeepEqual(left, right, label) {
  const leftJson = JSON.stringify(left);
  const rightJson = JSON.stringify(right);
  if (leftJson !== rightJson) {
    throw new Error(`${label} mismatch\nleft=${leftJson}\nright=${rightJson}`);
  }
}

function assertAllCaseAssertions(observations, label) {
  for (const [caseId, observation] of Object.entries(observations)) {
    for (const [assertion, passed] of Object.entries(observation.assertions ?? {})) {
      if (passed !== true) throw new Error(`${label} ${caseId} assertion failed: ${assertion}`);
    }
  }
}

function buildManifest({ generatedSource, oracleObservations, candidateObservations, emission }) {
  const oracleComparable = Object.fromEntries(Object.entries(oracleObservations).map(([key, value]) => [key, value.handlers]));
  const candidateComparable = Object.fromEntries(Object.entries(candidateObservations).map(([key, value]) => [key, value.handlers]));
  return {
    schema: "wphx.wphx-php-wp-embed-handlers.v1",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    evidence_class: "compiler_emitted_original_path_shell",
    source_files: SOURCE_FILES.map(inputRecord),
    oracle_source: {
      path: "../wordpress-develop/src/wp-includes/class-wp-embed.php",
      sha256: sha256File("../wordpress-develop/src/wp-includes/class-wp-embed.php")
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
    comparable_handlers: {
      oracle: oracleComparable,
      candidate: candidateComparable
    },
    claims: [
      "WPHX PHP emits original-path wp-includes/class-wp-embed.php with class WP_Embed.",
      "The generated shell preserves #[AllowDynamicProperties] and public handler-related property declarations.",
      "WP_Embed::register_handler writes the native PHP nested handlers array at $this->handlers[$priority][$id].",
      "WP_Embed::unregister_handler unsets only the selected native PHP nested handlers slot.",
      "The behavior probe matches upstream for default registration, multi-priority registration, and selected unregister behavior when constructor side effects are bypassed."
    ],
    non_claims: [
      "This fixture does not claim WP_Embed::__construct hook/shortcode registration.",
      "This fixture does not claim run_shortcode, shortcode, get_embed_handler_html, cache_oembed, autoembed, post-meta/object-cache behavior, remote oEmbed, installed editor/admin behavior, or full class-wp-embed.php ownership.",
      "This fixture does not claim generic arbitrary Haxe nested array assignment lowering; the two method bodies are bounded WordPress-profile Adapter IR pressure."
    ]
  };
}

function buildReceipt(manifest) {
  return {
    schema: "wphx.receipt.v1",
    id: "receipt:wphx-comp-php-wp-embed-handlers",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "passed",
    commands: ["npm run wphx:php:wp-embed-handlers", "npm run wphx:php:wp-embed-handlers:check"],
    artifacts: [
      { path: MANIFEST, role: "WPHX PHP WP_Embed handler-registry manifest", sha256: sha256(JSON.stringify(manifest, null, 2) + "\n") },
      { path: GENERATED_SHELL, role: "compiler-emitted original-path class-wp-embed.php", sha256: sha256File(GENERATED_SHELL) },
      { path: EMISSION_MANIFEST, role: "WPHX PHP emission manifest", sha256: sha256File(EMISSION_MANIFEST) },
      { path: RUNNER, role: "deterministic WP_Embed handler-registry runner", sha256: sha256File(RUNNER) }
    ],
    summary: [
      "WPHX PHP emits a bounded WP_Embed public class shell for register_handler and unregister_handler.",
      "The generated shell preserves native nested handlers array write/unset behavior against the upstream oracle with constructor side effects bypassed."
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
if (!generatedSource.includes("class WP_Embed")) throw new Error("generated shell did not emit class WP_Embed");

const oracleObservations = runProbe(ORACLE_ROOT);
const candidateObservations = runProbe(GENERATED_ROOT);
assertAllCaseAssertions(oracleObservations, "oracle");
assertAllCaseAssertions(candidateObservations, "candidate");
for (const fixtureCase of CASES) {
  assertDeepEqual(oracleObservations[fixtureCase.id].handlers, candidateObservations[fixtureCase.id].handlers, fixtureCase.id);
}

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
