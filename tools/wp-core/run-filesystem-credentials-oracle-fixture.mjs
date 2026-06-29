#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.19.4",
  external_ref: "WPHX-313.05",
  title: "WPHX-313.05 - Add filesystem credentials oracle fixture"
};
const RECORDED_AT = "2026-06-29T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-filesystem-credentials-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-313-05";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-313-05-filesystem-credentials-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-313-05-filesystem-credentials-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-313-05-filesystem-credentials-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-313-01-media-filesystem-upload-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-313-02-media-upload-adapter-contract-candidate.v1.json";
const UPLOAD_FIXTURE = "manifests/wp-core/wphx-313-03-media-upload-validation-oracle-fixture.v1.json";
const IMAGE_FIXTURE = "manifests/wp-core/wphx-313-04-image-metadata-editor-oracle-fixture.v1.json";

const SOURCE_FILES = [
  "src/wp-includes/class-wp-error.php",
  "src/wp-includes/compat.php",
  "src/wp-includes/utf8.php",
  "src/wp-includes/kses.php",
  "src/wp-includes/formatting.php",
  "src/wp-includes/functions.php",
  "src/wp-admin/includes/file.php",
  "src/wp-admin/includes/class-wp-filesystem-base.php",
  "src/wp-admin/includes/class-wp-filesystem-direct.php"
];
const COVERED_SYMBOLS = [
  "get_filesystem_method",
  "request_filesystem_credentials",
  "WP_Filesystem",
  "WP_Filesystem_Base",
  "WP_Filesystem_Direct",
  "WP_Filesystem_Direct::connect",
  "WP_Filesystem_Direct::put_contents",
  "WP_Filesystem_Direct::get_contents",
  "WP_Filesystem_Direct::copy",
  "WP_Filesystem_Direct::move",
  "WP_Filesystem_Direct::delete",
  "WP_Filesystem_Direct::dirlist"
];
const FIXTURE_CASES = [
  { id: "method:direct-writable", focus: "get_filesystem_method selects direct for a writable same-owner context and records file_owner mode" },
  { id: "method:filter-override", focus: "filesystem_method filter can override the selected method and receives args/context/relaxed flag" },
  { id: "credentials:filter-short-circuit", focus: "request_filesystem_credentials honors request_filesystem_credentials filter short-circuit values" },
  { id: "credentials:direct-returns-true", focus: "request_filesystem_credentials returns true when the resolved filesystem type is direct" },
  { id: "credentials:submitted-valid-nonce", focus: "request_filesystem_credentials returns submitted credentials, strips URL scheme, splits numeric port, and stores non-secret fields" },
  { id: "credentials:invalid-nonce-form", focus: "request_filesystem_credentials clears submitted secrets and emits the credentials form when nonce verification fails" },
  { id: "filesystem:direct-bootstrap", focus: "WP_Filesystem bootstraps WP_Filesystem_Direct, connects, and sets permission constants" },
  { id: "filesystem:missing-method-file", focus: "WP_Filesystem returns null when a filtered method file does not exist" },
  { id: "filesystem:direct-io", focus: "WP_Filesystem_Direct exercises native put/get/copy/move/delete/dirlist behavior on local files" }
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
  mkdirSync(`${root}/wp-content/languages`, { recursive: true });
  mkdirSync(`${root}/wp-content/plugins`, { recursive: true });
  mkdirSync(`${root}/wp-admin/includes`, { recursive: true });
  writeFileSync(`${root}/index.php`, "<?php\n");

  const optionStub = `${root}/wp-includes/option.php`;
  mkdirSync(dirname(optionStub), { recursive: true });
  writeFileSync(
    optionStub,
    `<?php
if ( ! function_exists( 'get_option' ) ) {
function get_option( $name, $default = false ) {
\t$values = array(
\t\t'siteurl' => 'https://example.test',
\t\t'home' => 'https://example.test',
\t\t'ftp_credentials' => array(
\t\t\t'hostname' => 'stored.example.test',
\t\t\t'username' => 'stored-user',
\t\t\t'connection_type' => 'ftp',
\t\t),
\t);
\treturn array_key_exists( $name, $values ) ? $values[ $name ] : $default;
}
}
if ( ! function_exists( 'update_option' ) ) {
function update_option( $name, $value, $autoload = null ) {
\t$GLOBALS['wphx_313_05_options_updated'][] = array( 'name' => $name, 'value' => $value, 'autoload' => $autoload );
\treturn true;
}
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
define( 'WP_CONTENT_DIR', $root . '/wp-content' );
define( 'WP_CONTENT_URL', 'https://example.test/wp-content' );
define( 'WP_LANG_DIR', WP_CONTENT_DIR . '/languages' );
define( 'WP_PLUGIN_DIR', WP_CONTENT_DIR . '/plugins' );
define( 'WP_DEBUG', false );

$GLOBALS['pagenow'] = 'plugins.php';
$GLOBALS['wphx_313_05_filters'] = array();
$GLOBALS['wphx_313_05_errors'] = array();
$GLOBALS['wphx_313_05_filter_overrides'] = array();
$GLOBALS['wphx_313_05_nonce_valid'] = true;
$GLOBALS['wphx_313_05_options_updated'] = array();

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_313_05_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

function __( $text ) { return $text; }
function _e( $text ) { echo $text; }
function esc_attr_e( $text ) { echo esc_attr( $text ); }
function disabled( $disabled, $current = true, $display = true ) {
\t$result = (bool) $disabled === (bool) $current ? ' disabled="disabled"' : '';
\tif ( $display ) {
\t\techo $result;
\t}
\treturn $result;
}
function checked( $checked, $current = true, $display = true ) {
\t$result = (string) $checked === (string) $current ? ' checked="checked"' : '';
\tif ( $display ) {
\t\techo $result;
\t}
\treturn $result;
}
function wp_create_nonce( $action = -1 ) { return 'nonce'; }
function wp_verify_nonce( $nonce, $action = -1 ) { return $GLOBALS['wphx_313_05_nonce_valid']; }
function submit_button( $text = null, $type = 'primary', $name = 'submit', $wrap = true, $other_attributes = null ) {
\techo '<button type="submit" name="' . esc_attr( $name ) . '">' . esc_html( $text ) . '</button>';
}
function wp_installing() { return false; }
function current_user_can( $capability ) { return false; }
function do_action( $hook_name, ...$args ) { return null; }
function did_action( $hook_name ) { return 0; }

require ABSPATH . WPINC . '/class-wp-error.php';
function is_wp_error( $thing ) {
\treturn $thing instanceof WP_Error;
}
require ABSPATH . WPINC . '/option.php';
require ABSPATH . WPINC . '/compat.php';
require ABSPATH . WPINC . '/utf8.php';
require ABSPATH . WPINC . '/kses.php';
require ABSPATH . WPINC . '/formatting.php';
require ABSPATH . WPINC . '/functions.php';
require ABSPATH . 'wp-admin/includes/file.php';

function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_313_05_filters'][] = array(
\t\t'hook' => $hook_name,
\t\t'value' => wphx_rel( $value ),
\t\t'args' => wphx_rel( $args ),
\t);
\tif ( array_key_exists( $hook_name, $GLOBALS['wphx_313_05_filter_overrides'] ) ) {
\t\treturn $GLOBALS['wphx_313_05_filter_overrides'][ $hook_name ];
\t}
\treturn $value;
}

function wphx_reset_state() {
\t$GLOBALS['wphx_313_05_filters'] = array();
\t$GLOBALS['wphx_313_05_errors'] = array();
\t$GLOBALS['wphx_313_05_filter_overrides'] = array();
\t$GLOBALS['wphx_313_05_nonce_valid'] = true;
\t$GLOBALS['wphx_313_05_options_updated'] = array();
\t$GLOBALS['_wp_filesystem_direct_method'] = null;
\t$GLOBALS['wp_filesystem'] = null;
\t$_POST = array();
}

function wphx_rel( $value ) {
\tif ( is_array( $value ) ) {
\t\t$result = array();
\t\tforeach ( $value as $key => $item ) {
\t\t\t$result[ $key ] = wphx_rel( $item );
\t\t}
\t\treturn $result;
\t}
\tif ( is_object( $value ) ) {
\t\tif ( is_wp_error( $value ) ) {
\t\t\treturn array(
\t\t\t\t'wp_error' => true,
\t\t\t\t'codes' => $value->get_error_codes(),
\t\t\t\t'messages' => $value->get_error_messages(),
\t\t\t);
\t\t}
\t\treturn array( 'object_class' => get_class( $value ) );
\t}
\tif ( ! is_string( $value ) ) {
\t\treturn $value;
\t}
\t$value = str_replace( '\\\\', '/', $value );
\t$root = str_replace( '\\\\', '/', ABSPATH );
\treturn str_starts_with( $value, $root ) ? '$ROOT/' . substr( $value, strlen( $root ) ) : $value;
}

function wphx_summarize_dirlist( $dirlist ) {
\tif ( ! is_array( $dirlist ) ) {
\t\treturn $dirlist;
\t}
\t$result = array();
\tforeach ( $dirlist as $name => $info ) {
\t\t$result[ $name ] = array(
\t\t\t'name' => $info['name'] ?? '',
\t\t\t'type' => $info['type'] ?? '',
\t\t\t'size' => $info['size'] ?? false,
\t\t\t'has_files' => array_key_exists( 'files', $info ),
\t\t);
\t}
\tksort( $result );
\treturn $result;
}

function wphx_output_summary( $output ) {
\treturn array(
\t\t'length' => strlen( $output ),
\t\t'has_form' => str_contains( $output, 'request-filesystem-credentials-form' ),
\t\t'has_hostname' => str_contains( $output, 'name="hostname"' ),
\t\t'has_password' => str_contains( $output, 'name="password"' ),
\t\t'has_upgrade_button' => str_contains( $output, 'name="upgrade"' ),
\t\t'contains_submitted_host' => str_contains( $output, 'bad.example.test' ),
\t\t'contains_stored_host' => str_contains( $output, 'stored.example.test' ),
\t);
}

function wphx_tmp_path( $name ) {
\t$path = ABSPATH . 'tmp/' . $name;
\tif ( ! is_dir( dirname( $path ) ) ) {
\t\tmkdir( dirname( $path ), 0777, true );
\t}
\treturn $path;
}

$cases = array();
$io_root = ABSPATH . 'tmp/fs';
if ( ! is_dir( $io_root ) ) {
\tmkdir( $io_root, 0777, true );
}

wphx_reset_state();
$direct_context = WP_CONTENT_DIR . '/';
$cases['method:direct-writable'] = array(
\t'result' => get_filesystem_method( array(), $direct_context, false ),
\t'direct_method' => $GLOBALS['_wp_filesystem_direct_method'],
\t'filters' => $GLOBALS['wphx_313_05_filters'],
);

wphx_reset_state();
$GLOBALS['wphx_313_05_filter_overrides']['filesystem_method'] = 'ftpsockets';
$cases['method:filter-override'] = array(
\t'result' => get_filesystem_method( array( 'connection_type' => 'ssh' ), WP_CONTENT_DIR, true ),
\t'direct_method' => $GLOBALS['_wp_filesystem_direct_method'],
\t'filters' => $GLOBALS['wphx_313_05_filters'],
);

wphx_reset_state();
$GLOBALS['wphx_313_05_filter_overrides']['request_filesystem_credentials'] = array(
\t'hostname' => 'filtered.example.test',
\t'username' => 'filtered-user',
\t'connection_type' => 'ftp',
);
$cases['credentials:filter-short-circuit'] = array(
\t'result' => request_filesystem_credentials( 'https://example.test/update.php', 'ftpext', false, WP_CONTENT_DIR ),
\t'filters' => $GLOBALS['wphx_313_05_filters'],
);

wphx_reset_state();
$cases['credentials:direct-returns-true'] = array(
\t'result' => request_filesystem_credentials( 'https://example.test/update.php', 'direct', false, WP_CONTENT_DIR ),
\t'filters' => $GLOBALS['wphx_313_05_filters'],
);

wphx_reset_state();
$_POST = array(
\t'_fs_nonce' => 'valid',
\t'hostname' => 'ftp://files.example.test:2121',
\t'username' => 'posted-user',
\t'password' => 'posted-pass',
\t'connection_type' => 'ftp',
\t'version' => '7.0',
);
$cases['credentials:submitted-valid-nonce'] = array(
\t'result' => request_filesystem_credentials( 'https://example.test/update.php', 'ftpext', false, WP_CONTENT_DIR ),
\t'options_updated' => $GLOBALS['wphx_313_05_options_updated'],
\t'filters' => $GLOBALS['wphx_313_05_filters'],
);

wphx_reset_state();
$GLOBALS['wphx_313_05_nonce_valid'] = false;
$_POST = array(
\t'_fs_nonce' => 'invalid',
\t'hostname' => 'bad.example.test',
\t'username' => 'bad-user',
\t'password' => 'bad-pass',
\t'connection_type' => 'ftp',
\t'version' => '7.0',
);
ob_start();
$invalid_result = request_filesystem_credentials( 'https://example.test/update.php', 'ftpext', false, WP_CONTENT_DIR, array( 'version' ) );
$invalid_output = ob_get_clean();
$cases['credentials:invalid-nonce-form'] = array(
\t'result' => $invalid_result,
\t'output' => wphx_output_summary( $invalid_output ),
\t'filters' => $GLOBALS['wphx_313_05_filters'],
);

wphx_reset_state();
$cases['filesystem:direct-bootstrap'] = array(
\t'result' => WP_Filesystem( array(), WP_CONTENT_DIR ),
\t'filesystem_class' => is_object( $GLOBALS['wp_filesystem'] ) ? get_class( $GLOBALS['wp_filesystem'] ) : null,
\t'filesystem_method' => is_object( $GLOBALS['wp_filesystem'] ) ? $GLOBALS['wp_filesystem']->method : null,
\t'connect_timeout_defined' => defined( 'FS_CONNECT_TIMEOUT' ),
\t'fs_timeout_defined' => defined( 'FS_TIMEOUT' ),
\t'chmod_dir_defined' => defined( 'FS_CHMOD_DIR' ),
\t'chmod_file_defined' => defined( 'FS_CHMOD_FILE' ),
\t'filters' => $GLOBALS['wphx_313_05_filters'],
);

wphx_reset_state();
$GLOBALS['wphx_313_05_filter_overrides']['filesystem_method'] = 'missingtransport';
$GLOBALS['wphx_313_05_filter_overrides']['filesystem_method_file'] = ABSPATH . 'wp-admin/includes/class-wp-filesystem-missingtransport.php';
$cases['filesystem:missing-method-file'] = array(
\t'result' => WP_Filesystem( array(), WP_CONTENT_DIR ),
\t'filesystem_class' => is_object( $GLOBALS['wp_filesystem'] ) ? get_class( $GLOBALS['wp_filesystem'] ) : null,
\t'filters' => $GLOBALS['wphx_313_05_filters'],
);

wphx_reset_state();
require_once ABSPATH . 'wp-admin/includes/class-wp-filesystem-base.php';
require_once ABSPATH . 'wp-admin/includes/class-wp-filesystem-direct.php';
$fs = new WP_Filesystem_Direct( array() );
$source = wphx_tmp_path( 'fs/source.txt' );
$copy = wphx_tmp_path( 'fs/copy.txt' );
$move = wphx_tmp_path( 'fs/moved.txt' );
$nested = wphx_tmp_path( 'fs/nested/child.txt' );
if ( ! is_dir( dirname( $nested ) ) ) {
\tmkdir( dirname( $nested ), 0777, true );
}
$cases['filesystem:direct-io'] = array(
\t'connect' => $fs->connect(),
\t'put_contents' => $fs->put_contents( $source, 'filesystem-body' ),
\t'get_contents' => $fs->get_contents( $source ),
\t'copy' => $fs->copy( $source, $copy, false ),
\t'copy_no_overwrite' => $fs->copy( $source, $copy, false ),
\t'move' => $fs->move( $copy, $move, false ),
\t'exists_after_move' => array( 'copy' => $fs->exists( $copy ), 'moved' => $fs->exists( $move ) ),
\t'mkdir' => $fs->mkdir( dirname( $nested ) ),
\t'put_nested' => $fs->put_contents( $nested, 'child' ),
\t'dirlist_visible' => wphx_summarize_dirlist( $fs->dirlist( $io_root, false, false ) ),
\t'delete_empty' => $fs->delete( '', true ),
\t'delete_recursive' => $fs->delete( $io_root, true ),
\t'exists_after_delete' => $fs->exists( $io_root ),
);

ksort( $cases );
echo json_encode(
\tarray(
\t\t'mode' => $mode,
\t\t'cases' => wphx_rel( $cases ),
\t\t'php_errors' => $GLOBALS['wphx_313_05_errors'],
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
      throw new Error(`${path} is stale; run npm run wp:core:wphx-313-filesystem-credentials-oracle-fixture`);
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
  schema: "wphx.wp-core-filesystem-credentials-oracle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["oracle_candidate_behavior", "copied_oracle_source", "direct_filesystem_local_io"],
  artifact_scope: "helper",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT),
    upload_validation_fixture_manifest: inputRecord(UPLOAD_FIXTURE),
    image_metadata_editor_fixture_manifest: inputRecord(IMAGE_FIXTURE),
    upstream_sources: SOURCE_FILES.map(sourceRecord),
    runner: inputRecord(RUNNER)
  },
  fixture: {
    copied_source_policy:
      "Oracle and candidate roots both mirror the same locked upstream WordPress PHP source. This is bridge evidence for filesystem credential/method behavior and direct local filesystem behavior; it does not claim Haxe-owned public PHP replacement.",
    local_io_policy:
      "The fixture exercises WP_Filesystem_Direct on temporary files inside the build root only. FTP extension, FTP sockets, SSH2, updater/install orchestration, and remote transport behavior remain unclaimed.",
    upstream_reference_commit: maybeCommand("git", ["-C", UPSTREAM_ROOT, "rev-parse", "HEAD"]),
    source_files: SOURCE_FILES,
    covered_symbols: COVERED_SYMBOLS,
    cases: FIXTURE_CASES,
    public_abi_policy: {
      public_php_replacement_claimed: false,
      handwritten_php_shells_added: false,
      adapter_contract_owner: "haxe_typed_prior_candidate",
      semantic_owner: "upstream_php_oracle_observed",
      ftp_ssh_transport_claimed: false,
      installed_updater_claimed: false,
      removal_gate:
        "Promote the covered filesystem method, credentials, WP_Filesystem bootstrap, and direct local I/O decisions to generated original-path PHP adapters or Haxe-owned helpers, then rerun these probes against generated candidate artifacts."
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
      id: "remote-filesystem-transports-not-covered",
      owner: ISSUE.external_ref,
      detail:
        "The fixture does not claim FTP extension, FTP sockets, SSH2, authentication failure behavior, network timeouts, or remote path mapping parity."
    },
    {
      id: "updater-installer-flows-not-covered",
      owner: ISSUE.external_ref,
      detail:
        "The fixture covers helper-level credential/method/direct-filesystem behavior only. Plugin/theme/core updater flows, filesystem modals in admin screens, AJAX installers, package unzip/copy/delete orchestration, and installed distribution behavior remain later gates."
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
  manifest_id: "ownership:wp-core/filesystem-credentials-oracle-fixture",
  issue: {
    id: ISSUE.id,
    external_ref: ISSUE.external_ref
  },
  unit: {
    kind: "oracle_candidate_fixture",
    name: "filesystem method, credentials, bootstrap, and direct local I/O behavior",
    area: "wp-admin/includes/file.php wp-admin/includes/class-wp-filesystem-direct.php",
    public_contract:
      "This slice observes upstream WordPress filesystem credential/method and direct local filesystem behavior in mirrored oracle/candidate roots. It does not claim Haxe-owned runtime behavior, remote transport execution, updater/install orchestration, or public PHP ABI replacement."
  },
  ownership_state: "bridge_shell",
  ownership_axes: {
    semantic_owner: "upstream_oracle_observed",
    adapter_contract_owner: "haxe_typed_prior_candidate",
    emission_strategy: "copied_oracle_php_fixture",
    execution_provider: "upstream_php_oracle_with_local_direct_filesystem",
    compatibility_evidence: "oracle_candidate_behavior"
  },
  bridge: {
    exists: true,
    kind: "copied_oracle_source_fixture",
    removal_gate:
      "Replace candidate copied PHP with Haxe-owned/generated filesystem helpers or original-path Adapter IR output, then rerun this oracle fixture with equal behavior."
  },
  owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
  generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
  verification: {
    oracle_commands: [
      "npm run wp:core:wphx-313-filesystem-credentials-oracle-fixture",
      "npm run wp:core:wphx-313-filesystem-credentials-oracle-fixture:check",
      "npm run receipts:validate"
    ],
    receipt_refs: ["receipt:wphx-313-05-filesystem-credentials-oracle-fixture"],
    manifest_digest: sha256(manifestText)
  }
};
const ownershipText = JSON.stringify(ownership, null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-313-05-filesystem-credentials-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "filesystem credentials oracle/candidate fixture manifest" },
    { path: OWNERSHIP, role: "ownership manifest for filesystem credentials bridge fixture" },
    { path: RUNNER, role: "deterministic oracle/candidate generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-313-filesystem-credentials-oracle-fixture",
    "npm run wp:core:wphx-313-filesystem-credentials-oracle-fixture:check"
  ],
  related_receipts: [
    "receipt:wphx-313-01-media-filesystem-upload-surface",
    "receipt:wphx-313-02-media-upload-adapter-contract-candidate",
    "receipt:wphx-313-03-media-upload-validation-oracle-fixture",
    "receipt:wphx-313-04-image-metadata-editor-oracle-fixture"
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
