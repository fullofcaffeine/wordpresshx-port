#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.18.6",
  external_ref: "WPHX-312.06",
  title: "WPHX-312.06 — Add trackback oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-trackback-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-312-06";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-312-06-trackback-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-06-trackback-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-06-trackback-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const AI_FIXTURE = "manifests/wp-core/wphx-312-05-ai-http-oracle-fixture.v1.json";

const SOURCE_FILES = ["src/wp-trackback.php"];
const COVERED_SYMBOLS = [
  "trackback_response",
  "wp_set_current_user",
  "sanitize_url",
  "sanitize_text_field",
  "sanitize_textarea_field",
  "wp_unslash",
  "wp_slash",
  "is_single",
  "pings_open",
  "wp_html_excerpt",
  "wpdb::prepare",
  "wpdb::get_results",
  "wp_new_comment",
  "do_action:pre_trackback_post",
  "do_action:trackback_post"
];
const FIXTURE_CASES = [
  { id: "trackback:success", focus: "valid trackback creates a comment, fires pre/post hooks, and emits success XML" },
  { id: "trackback:closed", focus: "closed pings emit trackback error XML before comment insertion" },
  { id: "trackback:duplicate", focus: "duplicate author URL lookup emits duplicate ping error XML" },
  { id: "trackback:new-comment-error", focus: "wp_new_comment WP_Error is converted into trackback error XML" },
  { id: "trackback:missing-id", focus: "missing post ID emits the expected trackback error XML" },
  { id: "trackback:utf7-rejected", focus: "UTF-7 charset is rejected through the endpoint's silent die path" }
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

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
$root = rtrim( $argv[1], '/\\\\' );
$case = $argv[2];

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );

$GLOBALS['wphx_312_06_case'] = $case;
$GLOBALS['wphx_312_06_actions'] = array();
$GLOBALS['wphx_312_06_errors'] = array();
$GLOBALS['wphx_312_06_new_comments'] = array();
$GLOBALS['wphx_312_06_redirects'] = array();
$GLOBALS['wphx_312_06_current_user'] = null;
$GLOBALS['wphx_312_06_config'] = array(
\t'pings_open' => true,
\t'dupe' => false,
\t'new_comment_error' => false,
\t'is_single' => true,
);

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_312_06_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

ob_start();
register_shutdown_function(
\tfunction () {
\t\t$output = ob_get_clean();
\t\t$response_error = null;
\t\t$response_message = null;
\t\tif ( preg_match( '#<error>(.*?)</error>#s', $output, $match ) ) {
\t\t\t$response_error = $match[1];
\t\t}
\t\tif ( preg_match( '#<message>(.*?)</message>#s', $output, $match ) ) {
\t\t\t$response_message = $match[1];
\t\t}
\t\techo json_encode(
\t\t\tarray(
\t\t\t\t'case' => $GLOBALS['wphx_312_06_case'],
\t\t\t\t'output' => $output,
\t\t\t\t'output_sha256' => hash( 'sha256', $output ),
\t\t\t\t'response_error' => $response_error,
\t\t\t\t'response_message' => $response_message,
\t\t\t\t'actions' => $GLOBALS['wphx_312_06_actions'],
\t\t\t\t'new_comments' => $GLOBALS['wphx_312_06_new_comments'],
\t\t\t\t'db' => $GLOBALS['wpdb']->records,
\t\t\t\t'current_user' => $GLOBALS['wphx_312_06_current_user'],
\t\t\t\t'redirects' => $GLOBALS['wphx_312_06_redirects'],
\t\t\t\t'php_errors' => $GLOBALS['wphx_312_06_errors'],
\t\t\t),
\t\t\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
\t\t);
\t}
);

class WP_Error {
\tprivate $code;
\tprivate $message;
\tpublic function __construct( $code = '', $message = '' ) {
\t\t$this->code = $code;
\t\t$this->message = $message;
\t}
\tpublic function get_error_code() { return $this->code; }
\tpublic function get_error_message() { return $this->message; }
}

class WPHX_312_06_WPDB {
\tpublic $comments = 'wp_comments';
\tpublic $insert_id = 777;
\tpublic $records = array();
\tpublic function prepare( $query, ...$args ) {
\t\t$this->records['prepare'][] = array( 'query' => $query, 'args' => $args );
\t\treturn 'prepared-trackback-dupe-query';
\t}
\tpublic function get_results( $query ) {
\t\t$this->records['get_results'][] = array( 'query' => $query );
\t\treturn $GLOBALS['wphx_312_06_config']['dupe'] ? array( (object) array( 'comment_ID' => 11 ) ) : array();
\t}
}

function __( $text ) { return $text; }
function get_option( $name, $default = false ) {
\treturn 'blog_charset' === $name ? 'UTF-8' : $default;
}
function wp_set_current_user( $user_id ) {
\t$GLOBALS['wphx_312_06_current_user'] = (int) $user_id;
}
function sanitize_url( $value ) {
\treturn trim( strip_tags( (string) $value ) );
}
function sanitize_text_field( $value ) {
\treturn trim( preg_replace( '/\\s+/', ' ', strip_tags( (string) $value ) ) );
}
function sanitize_textarea_field( $value ) {
\treturn trim( strip_tags( (string) $value ) );
}
function wp_unslash( $value ) {
\treturn is_string( $value ) ? stripslashes( $value ) : $value;
}
function wp_slash( $value ) {
\treturn is_string( $value ) ? addslashes( $value ) : $value;
}
function is_single() {
\treturn $GLOBALS['wphx_312_06_config']['is_single'];
}
function is_page() { return false; }
function pings_open( $post_id ) {
\treturn $GLOBALS['wphx_312_06_config']['pings_open'];
}
function wp_html_excerpt( $str, $count, $more = null ) {
\t$str = strip_tags( (string) $str );
\treturn strlen( $str ) > $count ? substr( $str, 0, $count ) . $more : $str;
}
function is_wp_error( $thing ) {
\treturn $thing instanceof WP_Error;
}
function wp_new_comment( $commentdata ) {
\t$GLOBALS['wphx_312_06_new_comments'][] = $commentdata;
\tif ( $GLOBALS['wphx_312_06_config']['new_comment_error'] ) {
\t\treturn new WP_Error( 'comment_failed', 'Comment insertion failed.' );
\t}
\treturn 777;
}
function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_312_06_actions'][] = array( 'hook' => $hook_name, 'args' => $args );
}
function get_permalink( $post_id ) {
\treturn 'https://example.test/post/' . (int) $post_id . '/';
}
function wp_redirect( $location, $status = 302 ) {
\t$GLOBALS['wphx_312_06_redirects'][] = array( 'location' => $location, 'status' => $status );
\treturn true;
}

$wp = (object) array( 'fixture' => true );
$wpdb = new WPHX_312_06_WPDB();
$posts = array( (object) array( 'ID' => 123 ) );
$_SERVER['REQUEST_URI'] = '/2026/06/fixture/123';
$_GET = array( 'tb_id' => '123' );
$_POST = array(
\t'url' => 'https://sender.example/post',
\t'charset' => 'UTF-8',
\t'title' => 'Sender <b>Title</b>',
\t'excerpt' => 'Excerpt with \\\\slashes and <em>markup</em>',
\t'blog_name' => 'Sender Blog',
);

switch ( $case ) {
\tcase 'closed':
\t\t$GLOBALS['wphx_312_06_config']['pings_open'] = false;
\t\tbreak;
\tcase 'duplicate':
\t\t$GLOBALS['wphx_312_06_config']['dupe'] = true;
\t\tbreak;
\tcase 'new-comment-error':
\t\t$GLOBALS['wphx_312_06_config']['new_comment_error'] = true;
\t\tbreak;
\tcase 'missing-id':
\t\t$GLOBALS['wphx_312_06_config']['is_single'] = false;
\t\t$posts = array();
\t\t$_GET = array();
\t\t$_SERVER['REQUEST_URI'] = '/trackback/';
\t\tbreak;
\tcase 'utf7-rejected':
\t\t$_POST['charset'] = 'UTF-7';
\t\tbreak;
}

require ABSPATH . 'wp-trackback.php';
`
  );
}

function runProbe(root, mode) {
  return JSON.parse(command("php", [PROBE, root, mode]));
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-312-trackback-oracle-fixture`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/trackback-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "trackback endpoint sanitization, duplicate detection, comment insertion, hooks, and XML responses",
      area: SOURCE_FILES.join(" "),
      public_contract:
        "This fixture executes copied WordPress 7.0 wp-trackback.php against deterministic in-process bootstrap, database, comment, redirect, and hook stubs. It does not perform real database writes, live HTTP pings, installed request routing, privacy request mail/list-table behavior, upstream PHPUnit parity, or generated public PHP replacement."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-haxe-adapter-contract-foundation",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass installed trackback routing, database-backed duplicate/comment behavior, selected upstream tests, and ecosystem ping fixtures before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-trackback-oracle-fixture",
        "npm run wp:core:wphx-312-trackback-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-06-trackback-oracle-fixture"],
      manifest_digest: manifestSha
    }
  };
}

rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
writeProbe();

const caseIds = ["success", "closed", "duplicate", "new-comment-error", "missing-id", "utf7-rejected"];
const oracle = Object.fromEntries(caseIds.map((id) => [id, runProbe(ORACLE_ROOT, id)]));
const candidate = Object.fromEntries(caseIds.map((id) => [id, runProbe(CANDIDATE_ROOT, id)]));
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

const manifest = {
  schema: "wphx.wp-core-trackback-oracle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["oracle_source_mirror", "candidate_package_mirror"],
  artifact_scope: "fixture",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT),
    ai_http_fixture_manifest: inputRecord(AI_FIXTURE),
    runner: inputRecord(RUNNER),
    upstream_sources: SOURCE_FILES.map(sourceRecord)
  },
  fixture: {
    cases: FIXTURE_CASES,
    covered_symbols: COVERED_SYMBOLS,
    source_files: SOURCE_FILES,
    probe: { path: PROBE, sha256: sha256File(PROBE) },
    side_effect_policy: {
      real_database_writes: false,
      live_http_pings: false,
      installed_request_routing: false,
      privacy_request_mail: false
    },
    public_abi_policy: {
      public_php_replacement_claimed: false,
      copied_oracle_public_php: true,
      adapter_contract_foundation: CONTRACT,
      installed_wordpress_behavior_claimed: false
    }
  },
  build: {
    oracle_root: ORACLE_ROOT,
    candidate_root: CANDIDATE_ROOT,
    php_lint: phpLint
  },
  observations: {
    oracle,
    candidate,
    match: observationsMatch,
    oracle_sha256: sha256(JSON.stringify(oracle)),
    candidate_sha256: sha256(JSON.stringify(candidate))
  },
  remaining_gaps: [
    {
      id: "installed-trackback-routing-not-executed",
      owner: ISSUE.external_ref,
      detail:
        "The fixture bypasses wp-load.php and WordPress request parsing with deterministic stubs. Installed route dispatch, query integration, and real HTTP request/response headers remain later gates."
    },
    {
      id: "database-backed-trackback-side-effects-not-executed",
      owner: ISSUE.external_ref,
      detail:
        "Duplicate lookup and wp_new_comment are stubbed. Real comments table reads/writes, moderation, cache invalidation, and plugin side effects remain later gates."
    },
    {
      id: "privacy-request-mail-not-executed",
      owner: ISSUE.external_ref,
      detail:
        "Privacy request mail/list-table behavior is still outside this fixture."
    },
    {
      id: "public-php-adapter-not-yet-generated",
      owner: ISSUE.external_ref,
      detail:
        "The fixture compares copied oracle PHP in both roots; generated original-path PHP replacement remains a later cross-domain gate."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    fixture_cases: FIXTURE_CASES.length,
    covered_symbols: COVERED_SYMBOLS.length,
    observations_match: observationsMatch,
    public_php_replacement_claimed: false
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-312-06-trackback-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "trackback oracle-source-mirror fixture manifest" },
    { path: OWNERSHIP, role: "ownership manifest for copied-oracle trackback boundary" },
    { path: RUNNER, role: "deterministic oracle/candidate fixture generator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-312-trackback-oracle-fixture",
    "npm run wp:core:wphx-312-trackback-oracle-fixture:check",
    "npm run receipts:validate",
    "npm run beads:validate"
  ],
  related_receipts: [
    "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
    "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
    "receipt:wphx-312-03-http-cron-mail-oracle-fixture",
    "receipt:wphx-312-04-feed-embed-https-oracle-fixture",
    "receipt:wphx-312-05-ai-http-oracle-fixture"
  ],
  validation_result: manifest.validation_result
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
      fixture_cases: FIXTURE_CASES.length,
      observations_match: observationsMatch
    },
    null,
    2
  )
);
