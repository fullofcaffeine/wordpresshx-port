#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-wf89",
  external_ref: "WPHX-320.04",
  title: "WPHX-320.04 - Add default theme copied-oracle pattern fixture"
};
const RECORDED_AT = "2026-07-07T19:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-default-theme-pattern-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-320-04";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-320-04-default-theme-pattern-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-320-04-default-theme-pattern-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-320-04-default-theme-pattern-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-320-01-default-theme-php-surface.v1.json";
const HXX_PILOT = "manifests/wp-core/wphx-320-02-theme-hxx-markup-pilot.v1.json";
const RATCHETS = "manifests/wp-core/wphx-320-03-default-theme-upstream-browser-ratchets.v1.json";

const SOURCE_FILES = [
  "src/wp-content/themes/twentytwentyfive/patterns/hero-full-width-image.php",
  "src/wp-content/themes/twentytwentyfive/patterns/footer.php",
  "src/wp-content/themes/twentytwentyfour/patterns/footer.php",
  "src/wp-content/themes/twentytwentythree/patterns/call-to-action.php",
  "src/wp-content/themes/twentytwentyfour/patterns/hidden-search.php"
];

const COVERED_SYMBOLS = [
  "twentytwentyfive/patterns/hero-full-width-image.php",
  "twentytwentyfive/patterns/footer.php",
  "twentytwentyfour/patterns/footer.php",
  "twentytwentythree/patterns/call-to-action.php",
  "twentytwentyfour/patterns/hidden-search.php",
  "__",
  "esc_html__",
  "esc_html_e",
  "esc_html_x",
  "esc_attr_e",
  "esc_attr_x",
  "esc_url",
  "get_template_directory_uri",
  "printf",
  "sprintf"
];

const CASES = [
  {
    id: "tt5:hero-full-width-image",
    theme: "twentytwentyfive",
    path: "wp-content/themes/twentytwentyfive/patterns/hero-full-width-image.php",
    focus: "Twenty Twenty-Five hero pattern emits cover markup, escaped sample copy, button text, and theme image URI",
    expected_fragments: [
      "wp-block-cover alignfull",
      "https://example.test/wp-content/themes/twentytwentyfive/assets/images/northern-buttercups-flowers.webp",
      "Tell your story",
      "Like flowers that bloom in unexpected places",
      "Learn more"
    ]
  },
  {
    id: "tt5:footer",
    theme: "twentytwentyfive",
    path: "wp-content/themes/twentytwentyfive/patterns/footer.php",
    focus: "Twenty Twenty-Five footer pattern emits navigation labels, site title placeholder blocks, and designed-with colophon",
    expected_fragments: [
      "wp:navigation-link {\"label\":\"Blog\"",
      "wp:navigation-link {\"label\":\"Authors\"",
      "Twenty Twenty-Five",
      "Designed with <a href=\"https://wordpress.org\" rel=\"nofollow\">WordPress</a>"
    ]
  },
  {
    id: "tt4:footer",
    theme: "twentytwentyfour",
    path: "wp-content/themes/twentytwentyfour/patterns/footer.php",
    focus: "Twenty Twenty-Four footer pattern emits heading/navigation labels and colophon link markup",
    expected_fragments: [
      "wp-block-columns alignwide",
      "About",
      "Privacy Policy",
      "Twitter/X",
      "Designed with <a href=\"https://wordpress.org\" rel=\"nofollow\">WordPress</a>"
    ]
  },
  {
    id: "tt3:call-to-action",
    theme: "twentytwentythree",
    path: "wp-content/themes/twentytwentythree/patterns/call-to-action.php",
    focus: "Twenty Twenty-Three CTA pattern emits columns, sample prompt, and button label",
    expected_fragments: ["wp-block-columns alignwide", "Got any book recommendations?", "Get In Touch", "wp-block-button__link"]
  },
  {
    id: "tt4:hidden-search",
    theme: "twentytwentyfour",
    path: "wp-content/themes/twentytwentyfour/patterns/hidden-search.php",
    focus: "Twenty Twenty-Four hidden search pattern emits escaped label and button text inside block JSON",
    expected_fragments: ["wp:search", "\"label\":\"Search\"", "\"buttonText\":\"Search\"", "\"fontSize\":\"medium\""]
  }
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
    sha256: sha256File(upstreamPath(path)),
    php_lint: command("php", ["-l", upstreamPath(path)])
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
$root = rtrim( $argv[1], '/\\\\' );
$case = json_decode( $argv[2], true );

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

$GLOBALS['wphx_theme'] = $case['theme'];
$GLOBALS['wphx_errors'] = array();

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

function wphx_escape( $text ) {
\treturn htmlspecialchars( (string) $text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' );
}
function __( $text, $domain = null ) {
\treturn $text;
}
function esc_html__( $text, $domain = null ) {
\treturn wphx_escape( $text );
}
function esc_html_e( $text, $domain = null ) {
\techo wphx_escape( $text );
}
function esc_html_x( $text, $context, $domain = null ) {
\treturn wphx_escape( $text );
}
function esc_attr_e( $text, $domain = null ) {
\techo wphx_escape( $text );
}
function esc_attr_x( $text, $context, $domain = null ) {
\treturn wphx_escape( $text );
}
function esc_url( $url ) {
\treturn wphx_escape( trim( (string) $url ) );
}
function get_template_directory_uri() {
\treturn 'https://example.test/wp-content/themes/' . $GLOBALS['wphx_theme'];
}

$file = $root . '/' . $case['path'];
ob_start();
include $file;
$output = ob_get_clean();
restore_error_handler();

$contains = array();
foreach ( $case['expected_fragments'] as $fragment ) {
\t$contains[] = array(
\t\t'fragment' => $fragment,
\t\t'present' => false !== strpos( $output, $fragment ),
\t);
}

echo json_encode(
\tarray(
\t\t'id' => $case['id'],
\t\t'theme' => $case['theme'],
\t\t'path' => $case['path'],
\t\t'output' => $output,
\t\t'output_sha256' => 'sha256:' . hash( 'sha256', $output ),
\t\t'bytes' => strlen( $output ),
\t\t'line_count' => substr_count( $output, "\\n" ) + 1,
\t\t'contains' => $contains,
\t\t'error_count' => count( $GLOBALS['wphx_errors'] ),
\t\t'errors' => $GLOBALS['wphx_errors'],
\t),
\tJSON_UNESCAPED_SLASHES
);
`
  );
}

function runCase(root, fixtureCase) {
  const observation = JSON.parse(command("php", [PROBE, root, JSON.stringify(fixtureCase)]));
  const missing = observation.contains.filter((entry) => !entry.present).map((entry) => entry.fragment);
  if (missing.length > 0) {
    throw new Error(`${fixtureCase.id} missing expected fragments: ${missing.join(", ")}`);
  }
  if (observation.error_count !== 0) {
    throw new Error(`${fixtureCase.id} emitted PHP warnings/notices: ${JSON.stringify(observation.errors)}`);
  }
  return observation;
}

function summarizeObservation(observation) {
  return {
    id: observation.id,
    theme: observation.theme,
    path: observation.path,
    output_sha256: observation.output_sha256,
    bytes: observation.bytes,
    line_count: observation.line_count,
    contains: observation.contains,
    error_count: observation.error_count
  };
}

function writeJson(path, value) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run npm run wp:core:wphx-320-default-theme-pattern-oracle-fixture`);
    if (readFileSync(path, "utf8") !== body) throw new Error(`${path} is stale; run npm run wp:core:wphx-320-default-theme-pattern-oracle-fixture`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

function main() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  mkdirSync(OUT_ROOT, { recursive: true });
  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe();

  const sourceRecords = SOURCE_FILES.map((path) => sourceRecord(path));
  const cases = CASES.map((fixtureCase) => {
    const oracle = runCase(ORACLE_ROOT, fixtureCase);
    const candidate = runCase(CANDIDATE_ROOT, fixtureCase);
    const matched = oracle.output === candidate.output;
    if (!matched) {
      throw new Error(`${fixtureCase.id} oracle/candidate output mismatch`);
    }
    return {
      id: fixtureCase.id,
      theme: fixtureCase.theme,
      path: fixtureCase.path,
      focus: fixtureCase.focus,
      source: sourceRecord(`src/${fixtureCase.path}`),
      expected_fragments: fixtureCase.expected_fragments,
      oracle_observation: summarizeObservation(oracle),
      candidate_observation: summarizeObservation(candidate),
      output_match: matched
    };
  });

  const manifest = {
    schema_version: 1,
    issue: ISSUE.external_ref,
    beads_issue: ISSUE.id,
    title: ISSUE.title,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "copied_oracle_default_theme_pattern_fixture",
    artifact_scope: "selected_default_theme_block_pattern_php",
    behavior_parity_claimed: false,
    selected_copied_oracle_behavior_match_claimed: true,
    installed_theme_rendering_parity_claimed: false,
    browser_or_visual_parity_claimed: false,
    public_php_replacement_claimed: false,
    candidate_generated_overlay_claimed: false,
    generated_original_path_adapter_claimed: false,
    haxe_owned_existing_theme_file_claimed: false,
    hxx_template_ownership_claimed: false,
    source_file_count: sourceRecords.length,
    case_count: cases.length,
    covered_symbol_count: COVERED_SYMBOLS.length,
    covered_symbols: COVERED_SYMBOLS,
    source_files: sourceRecords,
    cases,
    validation_result: {
      status: "passed",
      case_count: cases.length,
      oracle_candidate_output_match: cases.every((entry) => entry.output_match),
      all_expected_fragments_present: cases.every((entry) => entry.oracle_observation.contains.every((fragment) => fragment.present)),
      php_lint_passed: sourceRecords.every((entry) => entry.php_lint.includes("No syntax errors detected")),
      error_count: cases.reduce((count, entry) => count + entry.oracle_observation.error_count + entry.candidate_observation.error_count, 0),
      public_php_replacement_claimed: false,
      installed_theme_rendering_parity_claimed: false,
      haxe_owned_existing_theme_file_claimed: false
    },
    inputs: {
      runner: inputRecord(RUNNER),
      surface_manifest: inputRecord(SURFACE),
      hxx_pilot_manifest: inputRecord(HXX_PILOT),
      upstream_browser_ratchets_manifest: inputRecord(RATCHETS)
    },
    cross_domain_handoffs: [
      {
        owner: "WPHX-314/WPHX-400/WPHX-500",
        reason: "Pattern block comments and front-end block rendering remain block/browser/Gutenberg ownership beyond this raw pattern PHP output fixture."
      },
      {
        owner: "WPHX-309/WPHX-310",
        reason: "Theme discovery, template-loader behavior, theme.json/global styles, block-template hierarchy, and pattern registration remain routing/template and theme-system ownership."
      },
      {
        owner: "WPHX-307/WPHX-308/WPHX-313",
        reason: "Real post/query/comment/media state, featured images, attachments, and asset files are not exercised by these deterministic pattern-output stubs."
      },
      {
        owner: "WPHX-315/WPHX-316/WPHX-319",
        reason: "Theme admin/customizer/update flows and capability/nonce/session behavior remain admin and update ownership."
      }
    ],
    non_claims: [
      "No generated public PHP replacement for any bundled default-theme file.",
      "No Haxe-owned existing mixed PHP/HTML template runtime, broad HXX migration, or HXX template ownership for these copied files.",
      "No installed template-loader, pattern registry, front-end block rendering, browser, visual-regression, or performance parity execution.",
      "No database-backed post/query/menu/widget/customizer/global-styles state, media asset existence, generated overlay, or generated original-path adapter ownership.",
      "The oracle and candidate roots both contain regenerated copies of selected upstream WordPress default-theme pattern PHP files. This is copied-oracle bridge evidence only.",
      "The deterministic translation/escaping/theme-URI stubs are fixture scaffolding, not WordPress runtime ownership."
    ]
  };

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/default-theme-pattern-oracle-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "copied_oracle_public_php_fixture",
      name: "selected bundled default-theme block pattern PHP fixture",
      area: "wp-content/themes/twentytwentyfive, twentytwentyfour, and twentytwentythree pattern PHP files",
      public_contract:
        "This fixture executes selected copied upstream default-theme pattern PHP files under deterministic stubs and compares oracle/candidate output. It does not claim Haxe runtime ownership, installed theme rendering parity, generated public PHP replacement, generated overlays, or HXX ownership of existing theme files."
    },
    ownership_state: "bridge_fixture_only",
    ownership_axes: {
      semantic_owner: "upstream_wordpress",
      adapter_contract_owner: "none",
      emission_strategy: "copied_upstream_public_php_with_deterministic_pattern_probe",
      execution_provider: "php_cli_probe_with_stubbed_translation_escaping_and_theme_uri",
      compatibility_evidence: "selected_copied_oracle_candidate_output_match"
    },
    bridge: {
      exists: true,
      kind: "copied_oracle_candidate_default_theme_pattern_fixture",
      removal_gate:
        "Replace copied default-theme pattern PHP with generated original-path adapters or typed HXX/segment-plan evidence and pass installed theme rendering, pattern registry, browser/visual, selected upstream PHPUnit, and generated-overlay gates before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-320-default-theme-pattern-oracle-fixture",
        "npm run wp:core:wphx-320-default-theme-pattern-oracle-fixture:check",
        "npm run operations:bridge-claim-guardrails:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-320-04-default-theme-pattern-oracle-fixture"],
      manifest_digest: sha256(JSON.stringify(manifest, null, 2) + "\n")
    },
    notes:
      "The copied pattern PHP files are regenerated test inputs. The deterministic probe proves selected output stability only and must not be used as durable default-theme implementation evidence."
  };

  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-320-04-default-theme-pattern-oracle-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref,
      title: ISSUE.title
    },
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "default theme pattern copied-oracle fixture manifest", sha256: ownership.verification.manifest_digest },
      { path: OWNERSHIP, role: "ownership manifest for copied-oracle default theme pattern fixture" },
      { path: RUNNER, role: "deterministic copied-oracle default theme pattern runner" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-320-default-theme-pattern-oracle-fixture",
      "npm run wp:core:wphx-320-default-theme-pattern-oracle-fixture:check",
      "npm run operations:bridge-claim-guardrails:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    status: "passed",
    evidence_class: manifest.evidence_class,
    artifact_scope: manifest.artifact_scope,
    validation_result: manifest.validation_result,
    claims: [
      "Five selected bundled default-theme pattern PHP files execute under deterministic translation, escaping, and theme-URI stubs.",
      "Regenerated copied oracle and copied candidate roots produce byte-identical output for the selected pattern cases.",
      "The selected outputs include expected hero, footer, CTA, and search block fragments with no PHP warnings or syntax errors."
    ],
    non_claims: manifest.non_claims
  };

  writeJson(OUT, manifest);
  writeJson(OWNERSHIP, ownership);
  writeJson(RECEIPT, receipt);
  console.log(
    JSON.stringify(
      {
        status: "passed",
        case_count: cases.length,
        source_file_count: sourceRecords.length,
        covered_symbol_count: COVERED_SYMBOLS.length,
        output_match: manifest.validation_result.oracle_candidate_output_match,
        public_php_replacement_claimed: false,
        installed_theme_rendering_parity_claimed: false
      },
      null,
      2
    )
  );
}

main();
