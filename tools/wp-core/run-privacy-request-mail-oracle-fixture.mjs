#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.18.7",
  external_ref: "WPHX-312.07",
  title: "WPHX-312.07 — Add privacy request mail oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-privacy-request-mail-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-312-07";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-312-07-privacy-request-mail-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-07-privacy-request-mail-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-07-privacy-request-mail-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const TRACKBACK_FIXTURE = "manifests/wp-core/wphx-312-06-trackback-oracle-fixture.v1.json";

const SOURCE_FILES = [
  "src/wp-includes/class-wp-user-request.php",
  "src/wp-includes/user.php",
  "src/wp-admin/includes/privacy-tools.php"
];
const COVERED_SYMBOLS = [
  "WP_User_Request::__construct",
  "wp_get_user_request",
  "wp_user_request_action_description",
  "wp_privacy_send_personal_data_export_email",
  "_wp_privacy_send_request_confirmation_notification",
  "_wp_privacy_send_erasure_fulfillment_notification",
  "wp_privacy_personal_data_email_to",
  "wp_privacy_personal_data_email_subject",
  "wp_privacy_personal_data_email_content",
  "wp_privacy_personal_data_email_headers",
  "user_request_confirmed_email_to",
  "user_request_confirmed_email_subject",
  "user_request_confirmed_email_content",
  "user_request_confirmed_email_headers",
  "user_erasure_fulfillment_email_to",
  "user_erasure_fulfillment_email_subject",
  "user_erasure_fulfillment_email_content",
  "user_erasure_fulfillment_email_headers",
  "wp_mail",
  "update_post_meta"
];
const FIXTURE_CASES = [
  { id: "privacy:export-email-success", focus: "export request mail builds recipient, subject, content placeholders, headers, locale switch, and wp_mail payload" },
  { id: "privacy:export-email-invalid", focus: "invalid export request returns invalid_request without mail dispatch" },
  { id: "privacy:request-confirmed-admin", focus: "confirmed export request notifies admin and records _wp_admin_notified meta" },
  { id: "privacy:request-confirmed-already-notified", focus: "confirmed request with existing admin notification skips mail and meta writes" },
  { id: "privacy:erasure-fulfilled-user", focus: "completed erasure request notifies user, includes privacy policy URL, restores locale, and records _wp_user_notified meta" }
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
define( 'WPINC', 'wp-includes' );
define( 'DAY_IN_SECONDS', 86400 );

$GLOBALS['wphx_312_07_case'] = $case;
$GLOBALS['wphx_312_07_errors'] = array();
$GLOBALS['wphx_312_07_filters'] = array();
$GLOBALS['wphx_312_07_deprecated_filters'] = array();
$GLOBALS['wphx_312_07_mail'] = array();
$GLOBALS['wphx_312_07_meta_updates'] = array();
$GLOBALS['wphx_312_07_locale'] = array();
$GLOBALS['wphx_312_07_meta'] = array(
\t701 => array(
\t\t'_export_file_name' => 'wp-personal-data-file.zip',
\t\t'_wp_user_request_confirmed_timestamp' => 1710000000,
\t\t'_wp_user_request_completed_timestamp' => 1710003600,
\t),
\t702 => array(),
\t703 => array(),
\t704 => array( '_wp_admin_notified' => true ),
\t705 => array(),
);
$GLOBALS['wphx_312_07_posts'] = array(
\t701 => array( 'ID' => 701, 'post_author' => 9, 'post_title' => 'export-user@example.test', 'post_name' => 'export_personal_data', 'post_status' => 'request-completed' ),
\t702 => array( 'ID' => 702, 'post_author' => 0, 'post_title' => 'erase-user@example.test', 'post_name' => 'remove_personal_data', 'post_status' => 'request-completed' ),
\t703 => array( 'ID' => 703, 'post_author' => 0, 'post_title' => 'confirmed-user@example.test', 'post_name' => 'export_personal_data', 'post_status' => 'request-confirmed' ),
\t704 => array( 'ID' => 704, 'post_author' => 0, 'post_title' => 'already-notified@example.test', 'post_name' => 'remove_personal_data', 'post_status' => 'request-confirmed' ),
\t705 => array( 'ID' => 705, 'post_author' => 13, 'post_title' => 'erased-user@example.test', 'post_name' => 'remove_personal_data', 'post_status' => 'request-completed' ),
);

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_312_07_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
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

function __( $text ) { return $text; }
function absint( $maybeint ) { return abs( (int) $maybeint ); }
function is_wp_error( $thing ) { return $thing instanceof WP_Error; }
function get_post( $post_id ) {
\t$post_id = absint( $post_id );
\tif ( ! isset( $GLOBALS['wphx_312_07_posts'][ $post_id ] ) ) {
\t\treturn null;
\t}
\t$post = $GLOBALS['wphx_312_07_posts'][ $post_id ];
\treturn (object) array(
\t\t'ID' => $post['ID'],
\t\t'post_author' => $post['post_author'],
\t\t'post_title' => $post['post_title'],
\t\t'post_name' => $post['post_name'],
\t\t'post_status' => $post['post_status'],
\t\t'post_type' => 'user_request',
\t\t'post_date_gmt' => '2026-06-01 00:00:00',
\t\t'post_modified_gmt' => '2026-06-02 00:00:00',
\t\t'post_content' => '{\"source\":\"fixture\"}',
\t\t'post_password' => 'confirm-key',
\t);
}
function get_post_meta( $post_id, $key = '', $single = false ) {
\t$meta = $GLOBALS['wphx_312_07_meta'][ absint( $post_id ) ] ?? array();
\tif ( '' === $key ) {
\t\treturn $meta;
\t}
\t$value = $meta[ $key ] ?? '';
\treturn $single ? $value : array( $value );
}
function update_post_meta( $post_id, $key, $value ) {
\t$GLOBALS['wphx_312_07_meta_updates'][] = array( 'post_id' => absint( $post_id ), 'key' => $key, 'value' => $value );
\t$GLOBALS['wphx_312_07_meta'][ absint( $post_id ) ][ $key ] = $value;
\treturn true;
}
function get_option( $name, $default = false ) {
\tif ( 'blogname' === $name ) return 'Fixture &amp; Site';
\tif ( 'date_format' === $name ) return 'F j, Y';
\treturn $default;
}
function get_site_option( $name, $default = false ) {
\treturn 'admin_email' === $name ? 'admin@example.test' : $default;
}
function get_locale() { return 'en_US'; }
function switch_to_user_locale( $user_id ) {
\t$GLOBALS['wphx_312_07_locale'][] = array( 'switch_to_user_locale' => (int) $user_id );
\treturn true;
}
function switch_to_locale( $locale ) {
\t$GLOBALS['wphx_312_07_locale'][] = array( 'switch_to_locale' => $locale );
\treturn true;
}
function restore_previous_locale() {
\t$GLOBALS['wphx_312_07_locale'][] = array( 'restore_previous_locale' => true );
\treturn true;
}
function date_i18n( $format, $timestamp = false ) {
\treturn 'July 1, 2026';
}
function wp_privacy_exports_url() { return 'https://example.test/wp-content/uploads/wp-personal-data-exports/'; }
function home_url( $path = '', $scheme = null ) { return 'https://example.test' . $path; }
function admin_url( $path = '', $scheme = 'admin' ) { return 'https://example.test/wp-admin/' . ltrim( $path, '/' ); }
function get_privacy_policy_url() { return 'https://example.test/privacy-policy/'; }
function sanitize_url( $value ) { return trim( strip_tags( (string) $value ) ); }
function wp_specialchars_decode( $text, $quote_style = ENT_NOQUOTES ) { return html_entity_decode( $text, $quote_style, 'UTF-8' ); }
function wp_mail( $to, $subject, $message, $headers = '', $attachments = array(), $embeds = array() ) {
\t$GLOBALS['wphx_312_07_mail'][] = array(
\t\t'to' => $to,
\t\t'subject' => $subject,
\t\t'message' => $message,
\t\t'headers' => $headers,
\t\t'attachments' => $attachments,
\t\t'embeds' => $embeds,
\t\t'message_sha256' => hash( 'sha256', $message ),
\t);
\treturn true;
}
function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_312_07_filters'][] = array(
\t\t'hook' => $hook_name,
\t\t'value_type' => gettype( $value ),
\t\t'arg_count' => count( $args ),
\t);
\tswitch ( $hook_name ) {
\t\tcase 'wp_privacy_export_expiration':
\t\t\treturn DAY_IN_SECONDS;
\t\tcase 'wp_privacy_personal_data_email_to':
\t\t\treturn 'export-recipient@example.test';
\t\tcase 'wp_privacy_personal_data_email_subject':
\t\t\treturn '[Fixture Site] Export Ready';
\t\tcase 'wp_privacy_personal_data_email_content':
\t\t\treturn 'EXPORT ###EMAIL### ###EXPIRATION### ###LINK### ###SITENAME### ###SITEURL###';
\t\tcase 'wp_privacy_personal_data_email_headers':
\t\t\treturn array( 'X-Fixture: export' );
\t\tcase 'user_request_confirmed_email_to':
\t\t\treturn 'privacy-admin@example.test';
\t\tcase 'user_request_action_description':
\t\t\treturn 'Fixture ' . $value;
\t\tcase 'user_request_confirmed_email_subject':
\t\t\treturn '[Fixture Site] Request Confirmed';
\t\tcase 'user_request_confirmed_email_content':
\t\t\treturn 'CONFIRMED ###USER_EMAIL### ###DESCRIPTION### ###MANAGE_URL### ###SITENAME### ###SITEURL###';
\t\tcase 'user_request_confirmed_email_headers':
\t\t\treturn array( 'X-Fixture: confirmed' );
\t\tcase 'user_erasure_fulfillment_email_to':
\t\t\treturn 'erasure-recipient@example.test';
\t\tcase 'user_erasure_fulfillment_email_subject':
\t\t\treturn '[Fixture Site] Erasure Complete';
\t\tcase 'user_erasure_fulfillment_email_content':
\t\t\treturn 'ERASURE ###PRIVACY_POLICY_URL### ###SITENAME### ###SITEURL###';
\t\tcase 'user_erasure_fulfillment_email_headers':
\t\t\treturn array( 'X-Fixture: erasure' );
\t}
\treturn $value;
}
function apply_filters_deprecated( $hook_name, $args, $version, $replacement = '', $message = '' ) {
\t$GLOBALS['wphx_312_07_deprecated_filters'][] = array(
\t\t'hook' => $hook_name,
\t\t'version' => $version,
\t\t'replacement' => $replacement,
\t\t'arg_count' => count( $args ),
\t);
\treturn $args[0];
}

require ABSPATH . WPINC . '/class-wp-user-request.php';
require ABSPATH . WPINC . '/user.php';
require ABSPATH . 'wp-admin/includes/privacy-tools.php';

switch ( $case ) {
\tcase 'export-email-success':
\t\t$result = wp_privacy_send_personal_data_export_email( 701 );
\t\tbreak;
\tcase 'export-email-invalid':
\t\t$result = wp_privacy_send_personal_data_export_email( 702 );
\t\tbreak;
\tcase 'request-confirmed-admin':
\t\t_wp_privacy_send_request_confirmation_notification( 703 );
\t\t$result = true;
\t\tbreak;
\tcase 'request-confirmed-already-notified':
\t\t_wp_privacy_send_request_confirmation_notification( 704 );
\t\t$result = true;
\t\tbreak;
\tcase 'erasure-fulfilled-user':
\t\t$result = _wp_privacy_send_erasure_fulfillment_notification( 705 );
\t\tbreak;
\tdefault:
\t\t$result = new WP_Error( 'unknown_case', $case );
}

echo json_encode(
\tarray(
\t\t'case' => $case,
\t\t'result' => $result instanceof WP_Error ? array( 'wp_error' => $result->get_error_code(), 'message' => $result->get_error_message() ) : $result,
\t\t'mail' => $GLOBALS['wphx_312_07_mail'],
\t\t'filters' => $GLOBALS['wphx_312_07_filters'],
\t\t'deprecated_filters' => $GLOBALS['wphx_312_07_deprecated_filters'],
\t\t'locale' => $GLOBALS['wphx_312_07_locale'],
\t\t'meta_updates' => $GLOBALS['wphx_312_07_meta_updates'],
\t\t'php_errors' => $GLOBALS['wphx_312_07_errors'],
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
);
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
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-312-privacy-request-mail-oracle-fixture`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/privacy-request-mail-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "privacy request export, confirmation, and erasure notification mail behavior",
      area: SOURCE_FILES.join(" "),
      public_contract:
        "This fixture executes copied WordPress 7.0 privacy request mail source against deterministic in-process post, metadata, URL, locale, filter, and mail stubs. It does not perform real email delivery, admin list-table rendering, installed confirmation/management routing, upstream PHPUnit parity, or generated public PHP replacement."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-haxe-adapter-contract-foundation",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass installed privacy request confirmation, admin management, mail delivery, selected upstream tests, and ecosystem fixtures before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-privacy-request-mail-oracle-fixture",
        "npm run wp:core:wphx-312-privacy-request-mail-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-07-privacy-request-mail-oracle-fixture"],
      manifest_digest: manifestSha
    }
  };
}

rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
writeProbe();

const caseIds = ["export-email-success", "export-email-invalid", "request-confirmed-admin", "request-confirmed-already-notified", "erasure-fulfilled-user"];
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
  schema: "wphx.wp-core-privacy-request-mail-oracle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["oracle_source_mirror", "candidate_package_mirror"],
  artifact_scope: "fixture",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT),
    trackback_fixture_manifest: inputRecord(TRACKBACK_FIXTURE),
    runner: inputRecord(RUNNER),
    upstream_sources: SOURCE_FILES.map(sourceRecord)
  },
  fixture: {
    cases: FIXTURE_CASES,
    covered_symbols: COVERED_SYMBOLS,
    source_files: SOURCE_FILES,
    probe: { path: PROBE, sha256: sha256File(PROBE) },
    side_effect_policy: {
      real_email_delivery: false,
      installed_request_confirmation_routing: false,
      admin_list_table_rendering: false,
      real_database_writes: false
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
      id: "real-email-delivery-not-executed",
      owner: ISSUE.external_ref,
      detail: "The fixture records wp_mail payloads through an in-process stub. SMTP/PHPMailer transport, mail headers normalization beyond the captured inputs, and operational delivery remain later gates."
    },
    {
      id: "installed-privacy-request-flow-not-executed",
      owner: ISSUE.external_ref,
      detail: "The fixture bypasses request-confirmation URLs, nonce flow, admin pages, and list-table rendering. Installed export/erase request management remains later distribution work."
    },
    {
      id: "database-backed-request-state-not-executed",
      owner: ISSUE.external_ref,
      detail: "User request posts and metadata are deterministic stubs. Real posts table reads/writes, status transitions, permissions, and plugin side effects remain later gates."
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
  id: "receipt:wphx-312-07-privacy-request-mail-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "privacy request mail oracle-source-mirror fixture manifest" },
    { path: OWNERSHIP, role: "ownership manifest for copied-oracle privacy request mail boundary" },
    { path: RUNNER, role: "deterministic oracle/candidate fixture generator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-312-privacy-request-mail-oracle-fixture",
    "npm run wp:core:wphx-312-privacy-request-mail-oracle-fixture:check",
    "npm run receipts:validate",
    "npm run beads:validate"
  ],
  related_receipts: [
    "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
    "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
    "receipt:wphx-312-03-http-cron-mail-oracle-fixture",
    "receipt:wphx-312-04-feed-embed-https-oracle-fixture",
    "receipt:wphx-312-05-ai-http-oracle-fixture",
    "receipt:wphx-312-06-trackback-oracle-fixture"
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
