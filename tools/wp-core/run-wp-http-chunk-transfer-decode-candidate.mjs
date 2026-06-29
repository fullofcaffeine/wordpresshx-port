#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-4iw",
  external_ref: "WPHX-312.61",
  title: "WPHX-312.61 - Promote WP_Http chunkTransferDecode parsing to Haxe candidate"
};
const RECORDED_AT = "2026-06-28T02:30:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-wp-http-chunk-transfer-decode-candidate.mjs";
const HXML = "fixtures/wp-core/http-chunk-transfer-decode-candidate.hxml";
const WPHX_PHP_HXML = "fixtures/wphx-php/wp-http-chunk-transfer-decode.hxml";
const OUT_ROOT = "build/wp-core/wphx-312-61";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/generated`;
const WPHX_PHP_MANIFEST = `${CANDIDATE_ROOT}/wphx-php-emission.v1.json`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-312-61-wp-http-chunk-transfer-decode-candidate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-61-wp-http-chunk-transfer-decode-candidate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-61-wp-http-chunk-transfer-decode-candidate.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const PARSER_FIXTURE = "manifests/wp-core/wphx-312-42-wp-http-parser-header-oracle-fixture.v1.json";

const SOURCE_FILES = ["src/wp-includes/class-wp-http.php"];
const HAXE_SOURCES = [
  HXML,
  WPHX_PHP_HXML,
  "src/wphx/wp/http/HttpChunkTransferDecode.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/HttpChunkTransferDecodeCandidateEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/HttpChunkTransferDecodeEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/WpHttpChunkTransferDecodeShell.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/HaxeHttpChunkTransferDecode.hx"
];
const PROMOTED_SYMBOLS = [
  "WP_Http::chunkTransferDecode chunk header detection",
  "WP_Http::chunkTransferDecode chunk extension handling",
  "WP_Http::chunkTransferDecode single chunk body decode",
  "WP_Http::chunkTransferDecode malformed or non-chunk passthrough"
];
const CASES = [
  {
    id: "wp-http-parser:chunk-transfer-decode",
    focus: "chunkTransferDecode decodes valid chunk bodies and returns malformed/non-chunk bodies unchanged"
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

require ABSPATH . WPINC . '/class-wp-http.php';

$assertions = array();
$result = array( 'case' => $case );

switch ( $case ) {
\tcase 'wp-http-parser:chunk-transfer-decode':
\t\t$valid = "9\\r\\nWikipedia\\r\\n0";
\t\t$extension = "4;ext=value\\r\\nTest\\r\\n0";
\t\t$inter_chunk_crlf = "4\\r\\nWiki\\r\\n5\\r\\npedia\\r\\n0";
\t\t$malformed = "4\\r\\nWiki\\r\\n5\\r\\nped";
\t\t$plain = "plain body";
\t\t$result['decoded'] = array(
\t\t\t'valid' => WP_Http::chunkTransferDecode( $valid ),
\t\t\t'extension' => WP_Http::chunkTransferDecode( $extension ),
\t\t\t'inter_chunk_crlf' => WP_Http::chunkTransferDecode( $inter_chunk_crlf ),
\t\t\t'plain' => WP_Http::chunkTransferDecode( $plain ),
\t\t\t'malformed' => WP_Http::chunkTransferDecode( $malformed ),
\t\t);
\t\t$assertions['valid_decoded'] = 'Wikipedia' === $result['decoded']['valid'];
\t\t$assertions['extension_decoded'] = 'Test' === $result['decoded']['extension'];
\t\t$assertions['inter_chunk_crlf_passthrough'] = $inter_chunk_crlf === $result['decoded']['inter_chunk_crlf'];
\t\t$assertions['plain_passthrough'] = $plain === $result['decoded']['plain'];
\t\t$assertions['malformed_passthrough'] = $malformed === $result['decoded']['malformed'];
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
    manifest_id: "ownership:wp-core/wp-http-chunk-transfer-decode-candidate",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "haxe_parity_candidate",
      name: "WP_Http chunk transfer decode parser",
      area: "src/wp-includes/class-wp-http.php WP_Http::chunkTransferDecode",
      public_contract:
        "This candidate preserves the WP_Http PHP class shell, public static method ABI, and string return shape while delegating chunk-header parsing and observed decode/passthrough decisions to module-level Haxe source."
    },
    ownership_state: "haxe_owned_candidate_with_public_php_shell",
    bridge: {
      exists: true,
      kind: "compiler-emitted-original-path-public-php-shell",
      removal_gate:
        "Expand generated original-path public PHP adapters and pass broader parser/header, upstream HTTP PHPUnit, installed distribution, and transfer-encoding gates before claiming durable whole-file WP_Http ownership."
    },
    owned_paths: [RUNNER, HXML, WPHX_PHP_HXML, "src/wphx/wp/http/HttpChunkTransferDecode.hx", "fixtures/wp-core/src/wphx/fixtures/wp/core/HttpChunkTransferDecodeCandidateEntry.hx", "fixtures/wphx-php/src/wphx/fixtures/compiler/php/wp/WpHttpChunkTransferDecodeShell.hx", OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, WPHX_PHP_MANIFEST, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-wp-http-chunk-transfer-decode-candidate",
        "npm run wp:core:wphx-312-wp-http-chunk-transfer-decode-candidate:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-61-wp-http-chunk-transfer-decode-candidate"],
      manifest_digest: manifestSha
    }
  };
}

async function main() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  command("haxe", [HXML]);
  command("haxe", [WPHX_PHP_HXML]);
  mirrorSources(ORACLE_ROOT);
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
  const manifest = {
    schema: "wphx.wp-core-wp-http-chunk-transfer-decode-candidate.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_classes: ["haxe_source", "generated_php_candidate", "oracle_source_mirror", "php_cli_observed_fixture"],
    artifact_scope: "haxe_parity_candidate",
    inputs: {
      surface_manifest: inputRecord(SURFACE),
      adapter_contract_manifest: inputRecord(CONTRACT),
      parser_header_oracle_fixture_manifest: inputRecord(PARSER_FIXTURE),
      runner: inputRecord(RUNNER),
      haxe_sources: HAXE_SOURCES.map(inputRecord),
      upstream_sources: SOURCE_FILES.map(sourceRecord)
    },
    candidate: {
      hxml: HXML,
      wphx_php_hxml: WPHX_PHP_HXML,
      haxe_output: HAXE_OUT,
      compiled_php_files: compiledPhp.split("\n").filter(Boolean).sort(),
      compiler_emitted_public_shell: {
        path: mirrorPath(CANDIDATE_ROOT, "src/wp-includes/class-wp-http.php"),
        manifest: WPHX_PHP_MANIFEST,
        declarations: wphxDeclarations,
        unsupported: wphxPhpManifest.unsupported
      },
      promoted_symbols: PROMOTED_SYMBOLS,
      public_shell_policy: {
        public_php_replacement_claimed: true,
        public_php_abi_preserved: true,
        shell_body_ownership:
          "compiler-emitted original-path class-wp-http.php shell preserves the WP_Http public static method ABI and string return shape while delegating observed chunk-transfer decode and passthrough decisions to generated Haxe PHP",
        native_boundaries: ["compiler-emitted WP_Http public shell", "stock Haxe PHP runtime bootstrap"]
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
        runtime_stubs: "Requests Autoload/Requests are deterministic local stubs. No network, cookie, or header-processing side effects are exercised."
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
        id: "broader-parser-header-helpers-not-promoted",
        owner: ISSUE.external_ref,
        detail:
          "This candidate promotes only WP_Http::chunkTransferDecode observed parser behavior. processResponse, processHeaders, buildCookieHeader, parse_url, WP_Http_Cookie, and header/cookie side effects remain separate PHP boundaries or future candidates."
      },
      {
        id: "multi-chunk-behavior-is-upstream-passthrough",
        owner: ISSUE.external_ref,
        detail:
          "The fixture records upstream WordPress behavior where an inter-chunk CRLF multi-chunk body returns the original string. This candidate preserves that behavior rather than correcting it."
      },
      {
        id: "whole-wp-http-file-not-yet-owned",
        owner: ISSUE.external_ref,
        detail:
          "This candidate generates only the bounded WP_Http::chunkTransferDecode public adapter in class-wp-http.php. Broader WP_Http methods and whole-file original-path ownership remain later compiler-driven gates."
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
      installed_wordpress_behavior_claimed: false,
      live_http_claimed: false
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestText);
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-312-61-wp-http-chunk-transfer-decode-candidate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "WP_Http chunkTransferDecode Haxe parity candidate manifest" },
      { path: OWNERSHIP, role: "ownership manifest for Haxe-owned WP_Http chunkTransferDecode parser" },
      { path: RUNNER, role: "deterministic PHP CLI oracle/candidate Haxe runner" },
      { path: "src/wphx/wp/http/HttpChunkTransferDecode.hx", role: "module-level Haxe source for WP_Http::chunkTransferDecode parser behavior" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-312-wp-http-chunk-transfer-decode-candidate",
      "npm run wp:core:wphx-312-wp-http-chunk-transfer-decode-candidate:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
      "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
      "receipt:wphx-312-42-wp-http-parser-header-oracle-fixture"
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
