#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.19.3",
  external_ref: "WPHX-313.03",
  title: "WPHX-313.03 - Add media upload validation oracle fixture"
};
const RECORDED_AT = "2026-06-29T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-media-upload-validation-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-313-03";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-313-03-media-upload-validation-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-313-03-media-upload-validation-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-313-03-media-upload-validation-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-313-01-media-filesystem-upload-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-313-02-media-upload-adapter-contract-candidate.v1.json";

const SOURCE_FILES = [
  "src/wp-includes/compat.php",
  "src/wp-includes/utf8.php",
  "src/wp-includes/formatting.php",
  "src/wp-includes/functions.php",
  "src/wp-admin/includes/file.php"
];
const COVERED_SYMBOLS = [
  "wp_unique_filename",
  "wp_check_filetype",
  "wp_check_filetype_and_ext",
  "_wp_handle_upload",
  "wp_handle_sideload",
  "wp_upload_dir",
  "get_allowed_mime_types"
];
const FIXTURE_CASES = [
  { id: "unique:collision", focus: "wp_unique_filename increments colliding names and fires wp_unique_filename" },
  { id: "unique:uppercase-extension", focus: "wp_unique_filename lowercases uppercase extensions for compatibility" },
  { id: "mime:allowed-text", focus: "wp_check_filetype_and_ext accepts allowed text files with real MIME validation" },
  { id: "mime:missing-file", focus: "wp_check_filetype_and_ext falls back to extension mapping when the file is absent" },
  { id: "mime:rejected-exe", focus: "wp_check_filetype_and_ext rejects disallowed executable extension/content mismatches" },
  { id: "upload:invalid-form", focus: "wp_handle_sideload form-action validation error path" },
  { id: "upload:php-error", focus: "wp_handle_sideload PHP upload error-string conversion" },
  { id: "upload:empty-file", focus: "wp_handle_sideload empty sideload file validation" },
  { id: "upload:mime-reject", focus: "wp_handle_sideload MIME/type rejection for users without unfiltered_upload" },
  { id: "upload:success-sideload", focus: "wp_handle_sideload success return shape, pre-move short-circuit, unique filename, and final upload filter" }
];

function command(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 50
  }).trim();
}

function maybeCommand(commandName, commandArgs) {
  try {
    return command(commandName, commandArgs);
  } catch {
    return null;
  }
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function inputRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
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
  const optionStub = `${root}/wp-includes/option.php`;
  mkdirSync(dirname(optionStub), { recursive: true });
  writeFileSync(
    optionStub,
    `<?php
function get_option( $name, $default = false ) {
\t$values = array(
\t\t'siteurl' => 'https://example.test',
\t\t'upload_path' => '',
\t\t'upload_url_path' => '',
\t\t'uploads_use_yearmonth_folders' => false,
\t);
\treturn array_key_exists( $name, $values ) ? $values[ $name ] : $default;
}
function get_site_option( $name, $default = false ) {
\treturn $default;
}
`
  );
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
$mode = $argv[1];
$root = rtrim( $argv[2], '/\\\\' );

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'WP_DEBUG', false );
define( 'WP_CONTENT_DIR', $root . '/wp-content' );
define( 'WP_CONTENT_URL', 'https://example.test/wp-content' );

$GLOBALS['wphx_313_03_filters'] = array();
$GLOBALS['wphx_313_03_errors'] = array();

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_313_03_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

function __( $text ) { return $text; }
function current_user_can( $capability ) { return false; }
function user_can( $user, $capability ) { return false; }
function is_multisite() { return false; }
function ms_is_switched() { return false; }
function get_current_blog_id() { return 1; }
function wp_get_image_editor_output_format( $filename, $mime_type ) { return array(); }
function get_locale() { return 'en_US'; }

function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_313_03_filters'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) + 1 );
\tif ( 'pre_move_uploaded_file' === $hook_name ) {
\t\t$new_file = $args[1] ?? null;
\t\tif ( is_string( $new_file ) ) {
\t\t\tif ( ! is_dir( dirname( $new_file ) ) ) {
\t\t\t\tmkdir( dirname( $new_file ), 0777, true );
\t\t\t}
\t\t\tfile_put_contents( $new_file, 'moved-by-filter' );
\t\t}
\t\treturn true;
\t}
\treturn $value;
}

function add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wphx_313_03_filters'][] = array( 'hook' => 'add_filter:' . $hook_name, 'arg_count' => 4 );
\treturn true;
}

function wphx_rel( $value ) {
\tif ( is_array( $value ) ) {
\t\t$result = array();
\t\tforeach ( $value as $key => $item ) {
\t\t\t$result[ $key ] = wphx_rel( $item );
\t\t}
\t\treturn $result;
\t}
\tif ( ! is_string( $value ) ) {
\t\treturn $value;
\t}
\t$value = str_replace( '\\\\', '/', $value );
\t$root = str_replace( '\\\\', '/', ABSPATH );
\treturn str_starts_with( $value, $root ) ? '$ROOT/' . substr( $value, strlen( $root ) ) : $value;
}

function wphx_tmp_file( $name, $contents ) {
\t$path = ABSPATH . 'tmp/' . $name;
\tif ( ! is_dir( dirname( $path ) ) ) {
\t\tmkdir( dirname( $path ), 0777, true );
\t}
\tfile_put_contents( $path, $contents );
\treturn $path;
}

function wphx_case_file( $name ) {
\treturn ABSPATH . 'tmp/' . $name;
}

function wphx_sideload_file( $name, $contents, $type = 'text/plain', $error = 0 ) {
\t$tmp = wphx_tmp_file( 'tmp-' . preg_replace( '/[^a-z0-9.]+/i', '-', $name ), $contents );
\treturn array(
\t\t'name' => $name,
\t\t'type' => $type,
\t\t'tmp_name' => $tmp,
\t\t'size' => filesize( $tmp ),
\t\t'error' => $error,
\t);
}

function wphx_reset_filters() {
\t$GLOBALS['wphx_313_03_filters'] = array();
\t$GLOBALS['wphx_313_03_errors'] = array();
}

require ABSPATH . WPINC . '/compat.php';
require ABSPATH . WPINC . '/utf8.php';
require ABSPATH . WPINC . '/formatting.php';
require ABSPATH . WPINC . '/functions.php';
require ABSPATH . 'wp-admin/includes/file.php';

$upload_dir = WP_CONTENT_DIR . '/uploads';
if ( ! is_dir( $upload_dir ) ) {
\tmkdir( $upload_dir, 0777, true );
}
file_put_contents( $upload_dir . '/photo.txt', 'existing' );
file_put_contents( $upload_dir . '/report.pdf', 'existing lowercase extension twin' );

$cases = array();

wphx_reset_filters();
$cases['unique:collision'] = array(
\t'result' => wp_unique_filename( $upload_dir, 'photo.txt' ),
\t'filters' => $GLOBALS['wphx_313_03_filters'],
);

wphx_reset_filters();
$cases['unique:uppercase-extension'] = array(
\t'result' => wp_unique_filename( $upload_dir, 'REPORT.PDF' ),
\t'filters' => $GLOBALS['wphx_313_03_filters'],
);

wphx_reset_filters();
$text_file = wphx_tmp_file( 'notes.txt', "plain text\\n" );
$cases['mime:allowed-text'] = array(
\t'result' => wp_check_filetype_and_ext( $text_file, 'notes.txt' ),
\t'filters' => $GLOBALS['wphx_313_03_filters'],
);

wphx_reset_filters();
$cases['mime:missing-file'] = array(
\t'result' => wp_check_filetype_and_ext( wphx_case_file( 'missing.txt' ), 'missing.txt' ),
\t'filters' => $GLOBALS['wphx_313_03_filters'],
);

wphx_reset_filters();
$exe_file = wphx_tmp_file( 'danger.exe', "not really executable\\n" );
$cases['mime:rejected-exe'] = array(
\t'result' => wp_check_filetype_and_ext( $exe_file, 'danger.exe' ),
\t'filters' => $GLOBALS['wphx_313_03_filters'],
);

wphx_reset_filters();
$_POST = array( 'action' => 'wrong-action' );
$invalid_form = wphx_sideload_file( 'valid.txt', 'hello' );
$cases['upload:invalid-form'] = array(
\t'result' => wphx_rel( wp_handle_sideload( $invalid_form ) ),
\t'filters' => $GLOBALS['wphx_313_03_filters'],
);

wphx_reset_filters();
$_POST = array( 'action' => 'wp_handle_sideload' );
$php_error = wphx_sideload_file( 'error.txt', 'hello', 'text/plain', 1 );
$cases['upload:php-error'] = array(
\t'result' => wphx_rel( wp_handle_sideload( $php_error ) ),
\t'filters' => $GLOBALS['wphx_313_03_filters'],
);

wphx_reset_filters();
$_POST = array( 'action' => 'wp_handle_sideload' );
$empty_file = wphx_sideload_file( 'empty.txt', '' );
$cases['upload:empty-file'] = array(
\t'result' => wphx_rel( wp_handle_sideload( $empty_file ) ),
\t'filters' => $GLOBALS['wphx_313_03_filters'],
);

wphx_reset_filters();
$_POST = array( 'action' => 'wp_handle_sideload' );
$bad_file = wphx_sideload_file( 'danger.exe', 'payload', 'application/x-msdownload' );
$cases['upload:mime-reject'] = array(
\t'result' => wphx_rel( wp_handle_sideload( $bad_file ) ),
\t'filters' => $GLOBALS['wphx_313_03_filters'],
);

wphx_reset_filters();
$_POST = array( 'action' => 'wp_handle_sideload' );
$ok_file = wphx_sideload_file( 'photo.txt', "fresh text\\n" );
$cases['upload:success-sideload'] = array(
\t'result' => wphx_rel( wp_handle_sideload( $ok_file ) ),
\t'filters' => $GLOBALS['wphx_313_03_filters'],
\t'created_files' => array_values( array_map( 'basename', glob( $upload_dir . '/*' ) ?: array() ) ),
);

ksort( $cases );
echo json_encode(
\tarray(
\t\t'mode' => $mode,
\t\t'cases' => $cases,
\t\t'php_errors' => $GLOBALS['wphx_313_03_errors'],
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\\n";
`
  );
}

function normalizeRun(run) {
  const parsed = JSON.parse(run);
  parsed.mode = "$MODE";
  return parsed;
}

function runProbe(mode, root) {
  return normalizeRun(command("php", [PROBE, mode, root]));
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-313-media-upload-validation-oracle-fixture`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function validationSummary(oracle, candidate) {
  return {
    status: JSON.stringify(oracle.cases) === JSON.stringify(candidate.cases) ? "passed" : "failed",
    fixture_cases: Object.keys(oracle.cases).length,
    covered_symbols: COVERED_SYMBOLS.length,
    oracle_php_errors: oracle.php_errors.length,
    candidate_php_errors: candidate.php_errors.length
  };
}

rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
writeProbe();

const oracle = runProbe("oracle", ORACLE_ROOT);
const candidate = runProbe("candidate", CANDIDATE_ROOT);
const validation = validationSummary(oracle, candidate);

if (validation.status !== "passed") {
  console.error(JSON.stringify({ status: "failed", validation, oracle, candidate }, null, 2));
  process.exit(1);
}

const manifest = {
  schema: "wphx.wp-core-media-upload-validation-oracle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["oracle_candidate_behavior", "copied_oracle_source"],
  artifact_scope: "helper",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT),
    upstream_sources: SOURCE_FILES.map(sourceRecord),
    runner: inputRecord(RUNNER)
  },
  fixture: {
    copied_source_policy:
      "Oracle and candidate roots both mirror the same locked upstream WordPress PHP source. This is bridge evidence for media/upload behavior and does not claim Haxe-owned public PHP replacement.",
    upstream_reference_commit: maybeCommand("git", ["-C", UPSTREAM_ROOT, "rev-parse", "HEAD"]),
    source_files: SOURCE_FILES,
    covered_symbols: COVERED_SYMBOLS,
    cases: FIXTURE_CASES,
    public_abi_policy: {
      public_php_replacement_claimed: false,
      handwritten_php_shells_added: false,
      adapter_contract_owner: "haxe_typed_prior_candidate",
      semantic_owner: "upstream_php_oracle_observed",
      native_provider_claimed: false,
      removal_gate:
        "Promote the covered upload validation, MIME/filetype, and unique filename decisions to generated original-path PHP adapters or Haxe-owned helpers, then replace this copied candidate root with generated artifacts and rerun the same probes."
    }
  },
  runs: {
    oracle,
    candidate,
    match: JSON.stringify(oracle.cases) === JSON.stringify(candidate.cases),
    normalized_output_sha256: {
      oracle: sha256(JSON.stringify(oracle)),
      candidate: sha256(JSON.stringify(candidate))
    }
  },
  remaining_gaps: [
    {
      id: "image-editor-and-attachment-metadata-not-covered",
      owner: ISSUE.external_ref,
      detail:
        "This fixture covers upload validation, MIME/filetype, and unique filename behavior only. Attachment metadata generation, image editor selection, subsizes, EXIF/IPTC, and image save paths remain later WPHX-313 fixtures."
    },
    {
      id: "rest-admin-installed-upload-flows-not-covered",
      owner: ISSUE.external_ref,
      detail:
        "The fixture runs PHP CLI probes against mirrored helper files. It does not claim REST attachment uploads, admin async uploads, multisite quotas, browser/admin UI behavior, or installed distribution parity."
    },
    {
      id: "public-php-adapter-not-yet-generated",
      owner: ISSUE.external_ref,
      detail:
        "Candidate behavior still comes from copied upstream PHP. Generated original-path public PHP adapter ownership is not claimed."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: validation
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const ownership = {
  schema: "wphx.ownership-manifest.v1",
  manifest_id: "ownership:wp-core/media-upload-validation-oracle-fixture",
  issue: {
    id: ISSUE.id,
    external_ref: ISSUE.external_ref
  },
  unit: {
    kind: "oracle_candidate_fixture",
    name: "media upload validation, MIME/filetype, and unique filename behavior",
    area: "wp-admin/includes/file.php wp-includes/functions.php",
    public_contract:
      "This slice observes upstream WordPress media upload helper behavior in mirrored oracle/candidate roots. It does not claim Haxe-owned runtime behavior or public PHP ABI replacement."
  },
  ownership_state: "bridge_shell",
  ownership_axes: {
    semantic_owner: "upstream_oracle_observed",
    adapter_contract_owner: "haxe_typed_prior_candidate",
    emission_strategy: "copied_oracle_php_fixture",
    execution_provider: "upstream_php_oracle",
    compatibility_evidence: "oracle_candidate_behavior"
  },
  bridge: {
    exists: true,
    kind: "copied_oracle_source_fixture",
    removal_gate:
      "Replace candidate copied PHP with Haxe-owned/generated media upload helpers or original-path Adapter IR output, then rerun this oracle fixture with equal behavior."
  },
  owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
  generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
  verification: {
    oracle_commands: [
      "npm run wp:core:wphx-313-media-upload-validation-oracle-fixture",
      "npm run wp:core:wphx-313-media-upload-validation-oracle-fixture:check",
      "npm run receipts:validate"
    ],
    receipt_refs: ["receipt:wphx-313-03-media-upload-validation-oracle-fixture"],
    manifest_digest: sha256(manifestText)
  }
};
const ownershipText = JSON.stringify(ownership, null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-313-03-media-upload-validation-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "media upload validation oracle/candidate fixture manifest" },
    { path: OWNERSHIP, role: "ownership manifest for media upload validation bridge fixture" },
    { path: RUNNER, role: "deterministic oracle/candidate generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-313-media-upload-validation-oracle-fixture",
    "npm run wp:core:wphx-313-media-upload-validation-oracle-fixture:check"
  ],
  related_receipts: [
    "receipt:wphx-313-01-media-filesystem-upload-surface",
    "receipt:wphx-313-02-media-upload-adapter-contract-candidate"
  ],
  validation_result: validation,
  manifest_sha256: sha256(manifestText),
  ownership_sha256: sha256(ownershipText)
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
      fixture_cases: validation.fixture_cases,
      covered_symbols: validation.covered_symbols
    },
    null,
    2
  )
);
