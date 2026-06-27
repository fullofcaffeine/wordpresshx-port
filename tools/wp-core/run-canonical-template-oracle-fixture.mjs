#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.16.1",
  external_ref: "WPHX-309.09",
  title: "WPHX-309.09 — Add canonical/template-loader oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-canonical-template-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-309-09";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-309-09-canonical-template-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-309-09-canonical-template-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-309-09-canonical-template-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-309-01-routing-template-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-309-04-routing-template-adapter-contract-candidate.v1.json";
const ROUTING_LINK = "manifests/wp-core/wphx-309-06-routing-link-oracle-fixture.v1.json";

const SOURCE_FILES = [
  "src/wp-includes/canonical.php",
  "src/wp-includes/template-loader.php",
  "src/wp-includes/template.php",
  "src/wp-includes/link-template.php",
  "src/wp-includes/class-wp.php",
  "src/wp-includes/class-wp-query.php"
];

const COVERED_SYMBOLS = [
  "redirect_canonical",
  "_remove_qs_args_if_not_in_url",
  "strip_fragment_from_url",
  "get_query_template",
  "locate_template",
  "load_template",
  "get_single_template",
  "template-loader.php",
  "template_redirect",
  "template_include",
  "wp_before_include_template"
];

const FIXTURE_CASES = [
  { id: "canonical:post-method-bail", focus: "redirect_canonical returns early for non-GET/HEAD requests" },
  { id: "canonical:invalid-url-bail", focus: "redirect_canonical rejects unparsable requested URLs before redirect output" },
  { id: "canonical:query-arg-removal-helper", focus: "_remove_qs_args_if_not_in_url removes canonical-only query vars" },
  { id: "canonical:strip-fragment-helper", focus: "strip_fragment_from_url normalizes fragments for same-URL redirect comparison" },
  { id: "template:query-template-hierarchy", focus: "get_query_template applies hierarchy and template filters around locate_template" },
  { id: "template:locate-and-load", focus: "locate_template(load=true) invokes load_template and before/after load hooks with args" },
  { id: "template-loader:single-include", focus: "template-loader chooses a single template, filters it, and includes a readable PHP template" },
  { id: "template-loader:robots-return", focus: "template-loader returns through robots action without including a theme template" }
];

function command(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 50
  }).trim();
}

function maybeCommand(commandName, commandArgs, options = {}) {
  try {
    return command(commandName, commandArgs, options);
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
}

function writeThemeFixtures(root) {
  const themeRoot = `${root}/wp-content/themes/wphx-fixture`;
  mkdirSync(themeRoot, { recursive: true });
  const files = {
    "index.php": "<?php echo 'template:index';\n",
    "single.php": "<?php echo 'template:single';\n",
    "single-book-dune.php": "<?php echo 'template:single-book-dune';\n",
    "partial.php": "<?php echo 'partial:' . ($args['label'] ?? 'missing');\n",
    "robots.php": "<?php echo 'template:robots-should-not-load';\n"
  };
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(`${themeRoot}/${name}`, contents);
  }
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
define( 'STYLESHEETPATH', $root . '/wp-content/themes/wphx-fixture' );
define( 'TEMPLATEPATH', $root . '/wp-content/themes/wphx-fixture' );

$GLOBALS['wphx_309_09_mode'] = $mode;
$GLOBALS['wphx_309_09_filters'] = array();
$GLOBALS['wphx_309_09_actions'] = array();
$GLOBALS['wphx_309_09_php_errors'] = array();
$GLOBALS['wphx_309_09_query_vars'] = array();
$GLOBALS['wphx_309_09_flags'] = array();
$GLOBALS['wp_query'] = (object) array( 'query_vars' => array(), 'post_count' => 1, 'queried_object' => null, 'post' => null );
$GLOBALS['wp'] = (object) array( 'query_vars' => array() );
$GLOBALS['is_IIS'] = false;

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_309_09_php_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

class WP_Post {}
class WP_User {}
class WP_Post_Type {}
class WPHX_309_09_Rewrite_Stub {
\tpublic $use_trailing_slashes = true;
\tpublic function using_permalinks() {
\t\treturn true;
\t}
\tpublic function using_index_permalinks() {
\t\treturn false;
\t}
}
$GLOBALS['wp_rewrite'] = new WPHX_309_09_Rewrite_Stub();

function wphx_309_09_reset_observers() {
\t$GLOBALS['wphx_309_09_filters'] = array();
\t$GLOBALS['wphx_309_09_actions'] = array();
\t$GLOBALS['wphx_309_09_query_vars'] = array();
\t$GLOBALS['wphx_309_09_flags'] = array();
\t$GLOBALS['wp_query'] = (object) array( 'query_vars' => array(), 'post_count' => 1, 'queried_object' => null, 'post' => null );
\t$GLOBALS['wp'] = (object) array( 'query_vars' => array() );
\t$_GET = array();
\t$_POST = array();
\t$_SERVER['REQUEST_METHOD'] = 'GET';
}

function wphx_309_09_relative_path( $path ) {
\t$normalized = str_replace( '\\\\', '/', (string) $path );
\t$root = str_replace( '\\\\', '/', ABSPATH );
\tif ( str_starts_with( $normalized, $root ) ) {
\t\treturn substr( $normalized, strlen( $root ) );
\t}
\treturn $normalized;
}

function wphx_309_09_case_result( $id, $payload ) {
\t$payload['id'] = $id;
\t$payload['filters'] = $GLOBALS['wphx_309_09_filters'];
\t$payload['actions'] = $GLOBALS['wphx_309_09_actions'];
\treturn $payload;
}

function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_309_09_filters'][] = array(
\t\t'hook' => $hook_name,
\t\t'arg_count' => count( $args ) + 1,
\t);
\treturn $value;
}

function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_309_09_actions'][] = array(
\t\t'hook' => $hook_name,
\t\t'arg_count' => count( $args ),
\t);
}

function remove_filter( $hook_name, $callback ) {
\t$GLOBALS['wphx_309_09_actions'][] = array(
\t\t'hook' => 'remove_filter:' . $hook_name,
\t\t'arg_count' => 1,
\t);
}

function has_filter( $hook_name ) {
\treturn false;
}

function has_action( $hook_name ) {
\treturn false;
}

function esc_attr( $value ) {
\treturn htmlspecialchars( (string) $value, ENT_QUOTES );
}

function is_child_theme() {
\treturn false;
}

function get_stylesheet_directory() {
\treturn STYLESHEETPATH;
}

function get_template_directory() {
\treturn TEMPLATEPATH;
}

function locate_block_template( $template, $type, $templates ) {
\treturn $template;
}

function validate_file( $file ) {
\treturn str_contains( (string) $file, '..' ) ? 1 : 0;
}

function get_page_template_slug( $post = null ) {
\treturn '';
}

function get_post_format( $post = null ) {
\treturn false;
}

function get_queried_object() {
\treturn (object) array( 'ID' => 101, 'post_type' => 'book', 'post_name' => 'dune' );
}

function get_query_var( $key, $default = '' ) {
\treturn $GLOBALS['wphx_309_09_query_vars'][ $key ] ?? $default;
}

function wp_using_themes() {
\treturn $GLOBALS['wphx_309_09_flags']['using_themes'] ?? true;
}

function current_user_can( $capability, ...$args ) {
\treturn false;
}

function wp_get_theme() {
\treturn new class {
\t\tpublic function errors() {
\t\t\treturn false;
\t\t}
\t};
}

function wp_die( $message = '' ) {
\tthrow new RuntimeException( 'wp_die:' . (string) $message );
}

function do_feed() {
\tdo_action( 'do_feed' );
}

function is_embed() { return $GLOBALS['wphx_309_09_flags']['is_embed'] ?? false; }
function is_404() { return $GLOBALS['wphx_309_09_flags']['is_404'] ?? false; }
function is_search() { return $GLOBALS['wphx_309_09_flags']['is_search'] ?? false; }
function is_front_page() { return $GLOBALS['wphx_309_09_flags']['is_front_page'] ?? false; }
function is_home() { return $GLOBALS['wphx_309_09_flags']['is_home'] ?? false; }
function is_privacy_policy() { return $GLOBALS['wphx_309_09_flags']['is_privacy_policy'] ?? false; }
function is_post_type_archive() { return $GLOBALS['wphx_309_09_flags']['is_post_type_archive'] ?? false; }
function is_tax() { return $GLOBALS['wphx_309_09_flags']['is_tax'] ?? false; }
function is_attachment() { return $GLOBALS['wphx_309_09_flags']['is_attachment'] ?? false; }
function is_single() { return $GLOBALS['wphx_309_09_flags']['is_single'] ?? false; }
function is_page() { return $GLOBALS['wphx_309_09_flags']['is_page'] ?? false; }
function is_singular() { return $GLOBALS['wphx_309_09_flags']['is_singular'] ?? false; }
function is_category() { return $GLOBALS['wphx_309_09_flags']['is_category'] ?? false; }
function is_tag() { return $GLOBALS['wphx_309_09_flags']['is_tag'] ?? false; }
function is_author() { return $GLOBALS['wphx_309_09_flags']['is_author'] ?? false; }
function is_date() { return $GLOBALS['wphx_309_09_flags']['is_date'] ?? false; }
function is_archive() { return $GLOBALS['wphx_309_09_flags']['is_archive'] ?? false; }
function is_robots() { return $GLOBALS['wphx_309_09_flags']['is_robots'] ?? false; }
function is_favicon() { return $GLOBALS['wphx_309_09_flags']['is_favicon'] ?? false; }
function is_feed() { return $GLOBALS['wphx_309_09_flags']['is_feed'] ?? false; }
function is_trackback() { return $GLOBALS['wphx_309_09_flags']['is_trackback'] ?? false; }
function is_preview() { return $GLOBALS['wphx_309_09_flags']['is_preview'] ?? false; }
function is_admin() { return $GLOBALS['wphx_309_09_flags']['is_admin'] ?? false; }
function is_ssl() { return false; }
function iis7_supports_permalinks() { return true; }
function wp_verify_nonce( $nonce, $action ) { return false; }
function get_post_status( $post = null ) { return 'publish'; }
function get_post_status_object( $status ) { return (object) array( 'private' => false ); }
function is_post_publicly_viewable( $post = null ) { return true; }
function get_post( $post = null ) { return $post ? (object) array( 'ID' => (int) $post, 'post_type' => 'post', 'post_status' => 'publish' ) : null; }
function get_post_type_object( $post_type ) { return (object) array( 'public' => true ); }
function get_permalink( $post = null ) { return 'http://example.test/post/' . ( is_object( $post ) ? $post->ID : (int) $post ) . '/'; }
function get_post_comments_feed_link( $post_id, $feed = '' ) { return 'http://example.test/post/' . (int) $post_id . '/feed/'; }
function get_attachment_link( $post_id = 0 ) { return 'http://example.test/attachment/' . (int) $post_id . '/'; }
function get_month_link( $year, $month ) { return 'http://example.test/' . (int) $year . '/' . str_pad( (string) $month, 2, '0', STR_PAD_LEFT ) . '/'; }
function get_year_link( $year ) { return 'http://example.test/' . (int) $year . '/'; }
function wp_checkdate( $month, $day, $year, $source_date ) { return checkdate( (int) $month, (int) $day, (int) $year ); }
function wp_redirect( $location, $status = 302 ) { do_action( 'wp_redirect', $location, $status ); }
function network_site_url( $path = '' ) { return 'http://example.test/' . ltrim( $path, '/' ); }
function home_url( $path = '' ) { return 'http://example.test/' . ltrim( $path, '/' ); }
function wp_parse_url( $url, $component = -1 ) { return parse_url( $url, $component ); }
function trailingslashit( $value ) { return rtrim( (string) $value, '/\\\\' ) . '/'; }
function untrailingslashit( $value ) { return rtrim( (string) $value, '/\\\\' ); }

function remove_query_arg( $key, $query = false ) {
\tif ( false === $query ) {
\t\t$query = $_SERVER['REQUEST_URI'] ?? '';
\t}
\t$keys = (array) $key;
\t$prefix = '';
\t$fragment = '';
\tif ( str_contains( $query, '#' ) ) {
\t\tlist( $query, $fragment ) = explode( '#', $query, 2 );
\t\t$fragment = '#' . $fragment;
\t}
\tif ( str_contains( $query, '?' ) ) {
\t\tlist( $prefix, $query ) = explode( '?', $query, 2 );
\t\t$prefix .= '?';
\t}
\tparse_str( ltrim( (string) $query, '?' ), $vars );
\tforeach ( $keys as $entry ) {
\t\tunset( $vars[ $entry ] );
\t}
\t$rebuilt = http_build_query( $vars, '', '&' );
\treturn $prefix . $rebuilt . $fragment;
}

function add_query_arg( ...$args ) {
\t$uri = array_pop( $args );
\t$key = array_shift( $args );
\t$value = array_shift( $args );
\t$vars = is_array( $key ) ? $key : array( $key => $value );
\t$separator = str_contains( $uri, '?' ) ? '&' : '?';
\treturn $uri . $separator . http_build_query( $vars, '', '&' );
}

require $root . '/wp-includes/canonical.php';
require $root . '/wp-includes/template.php';

function wphx_309_09_canonical_post_bail() {
\twphx_309_09_reset_observers();
\t$_SERVER['REQUEST_METHOD'] = 'POST';
\treturn wphx_309_09_case_result(
\t\t'canonical:post-method-bail',
\t\tarray( 'result' => redirect_canonical( 'http://example.test/post/?p=1', false ) )
\t);
}

function wphx_309_09_canonical_invalid_url() {
\twphx_309_09_reset_observers();
\treturn wphx_309_09_case_result(
\t\t'canonical:invalid-url-bail',
\t\tarray( 'result' => redirect_canonical( 'http:///path', false ) )
\t);
}

function wphx_309_09_canonical_query_helper() {
\twphx_309_09_reset_observers();
\treturn wphx_309_09_case_result(
\t\t'canonical:query-arg-removal-helper',
\t\tarray(
\t\t\t'input' => 'p=1&feed=rss&keep=1',
\t\t\t'result' => _remove_qs_args_if_not_in_url( 'p=1&feed=rss&keep=1', array( 'p', 'feed', 'missing' ), 'http://example.test/post/?keep=1' ),
\t\t)
\t);
}

function wphx_309_09_canonical_strip_fragment() {
\twphx_309_09_reset_observers();
\treturn wphx_309_09_case_result(
\t\t'canonical:strip-fragment-helper',
\t\tarray( 'result' => strip_fragment_from_url( 'http://example.test/post/#comments' ) )
\t);
}

function wphx_309_09_template_query_hierarchy() {
\twphx_309_09_reset_observers();
\t$template = get_query_template( 'single', array( 'single-book-dune.php', 'single-book.php', 'single.php' ) );
\treturn wphx_309_09_case_result(
\t\t'template:query-template-hierarchy',
\t\tarray( 'template' => wphx_309_09_relative_path( $template ) )
\t);
}

function wphx_309_09_template_locate_and_load() {
\twphx_309_09_reset_observers();
\tob_start();
\t$located = locate_template( array( 'missing.php', 'partial.php' ), true, false, array( 'label' => 'loaded' ) );
\t$output = ob_get_clean();
\treturn wphx_309_09_case_result(
\t\t'template:locate-and-load',
\t\tarray(
\t\t\t'located' => wphx_309_09_relative_path( $located ),
\t\t\t'output' => $output,
\t\t)
\t);
}

function wphx_309_09_template_loader_case( $id, $flags ) {
\twphx_309_09_reset_observers();
\t$GLOBALS['wphx_309_09_flags'] = array_merge( array( 'using_themes' => true ), $flags );
\t$_SERVER['REQUEST_METHOD'] = 'GET';
\tob_start();
\tinclude ABSPATH . WPINC . '/template-loader.php';
\t$output = ob_get_clean();
\treturn wphx_309_09_case_result(
\t\t$id,
\t\tarray( 'output' => $output )
\t);
}

$cases = array(
\twphx_309_09_canonical_post_bail(),
\twphx_309_09_canonical_invalid_url(),
\twphx_309_09_canonical_query_helper(),
\twphx_309_09_canonical_strip_fragment(),
\twphx_309_09_template_query_hierarchy(),
\twphx_309_09_template_locate_and_load(),
\twphx_309_09_template_loader_case( 'template-loader:single-include', array( 'is_single' => true, 'is_singular' => true ) ),
\twphx_309_09_template_loader_case( 'template-loader:robots-return', array( 'is_robots' => true ) ),
);

echo json_encode(
\tarray(
\t\t'mode' => $mode,
\t\t'cases' => $cases,
\t\t'php_errors' => $GLOBALS['wphx_309_09_php_errors'],
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . PHP_EOL;
`
  );
}

function normalizeRun(run) {
  return {
    cases: run.cases,
    php_errors: run.php_errors
  };
}

function runProbe(mode, root) {
  return JSON.parse(command("php", [PROBE, mode, root]));
}

function assertCaseCoverage(run) {
  const actual = run.cases.map((entry) => entry.id).sort();
  const expected = FIXTURE_CASES.map((entry) => entry.id).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected canonical/template fixture cases: ${actual.join(", ")}`);
  }
  if (run.php_errors.length !== 0) {
    throw new Error(`Canonical/template fixture emitted PHP errors: ${JSON.stringify(run.php_errors)}`);
  }
}

function compareRuns(oracle, candidate) {
  const oracleNormalized = normalizeRun(oracle);
  const candidateNormalized = normalizeRun(candidate);
  return {
    status: JSON.stringify(oracleNormalized) === JSON.stringify(candidateNormalized) ? "passed" : "failed",
    oracle: oracleNormalized,
    candidate: candidateNormalized
  };
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-309-canonical-template-oracle-fixture`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/canonical-template-oracle-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "canonical URL and template-loader oracle fixture",
      area: "wp-includes/canonical.php wp-includes/template.php wp-includes/template-loader.php",
      public_contract:
        "Mirrored upstream canonical/template source is executed in a constrained fixture to capture selected redirect_canonical helper, template hierarchy, locate/load, and template-loader observations. This does not claim Haxe-owned public PHP replacement, complete canonical redirect parity, full template include behavior, or installed front-end HTTP parity."
    },
    ownership_state: "upstream_oracle_source_mirror",
    ownership_axes: {
      semantic_owner: "upstream_wordpress_oracle",
      adapter_contract_owner: "not_claimed",
      emission_strategy: "oracle_source_mirror_fixture",
      execution_provider: "php",
      compatibility_evidence: "targeted_semantic_parity"
    },
    bridge: {
      exists: true,
      kind: "fixture-only-upstream-source-mirror",
      removal_gate:
        "Replace with Haxe-owned routing/template Adapter IR/public PHP output and installed front-end canonical/template evidence before claiming migrated WPHX-309 ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    upstream_mirrored_paths: SOURCE_FILES,
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-309-canonical-template-oracle-fixture",
        "npm run wp:core:wphx-309-canonical-template-oracle-fixture:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-309-09-canonical-template-oracle-fixture"],
      manifest_digest: manifestSha
    }
  };
}

function receipt(manifestSha) {
  return {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-309-09-canonical-template-oracle-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref,
      title: ISSUE.title
    },
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "canonical/template oracle fixture manifest" },
      { path: OWNERSHIP, role: "canonical/template oracle fixture ownership manifest" },
      { path: RUNNER, role: "deterministic canonical/template oracle-source-mirror fixture generator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-309-canonical-template-oracle-fixture",
      "npm run wp:core:wphx-309-canonical-template-oracle-fixture:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-309-01-routing-template-surface",
      "receipt:wphx-309-04-routing-template-adapter-contract-candidate",
      "receipt:wphx-309-06-routing-link-oracle-fixture"
    ],
    manifest_sha256: manifestSha,
    validation_result: {
      status: "passed",
      evidence_classes: ["targeted_semantic_parity", "runtime_abi"],
      artifact_scope: "oracle_source_mirror_fixture",
      covered_symbols: COVERED_SYMBOLS.length,
      fixture_cases: FIXTURE_CASES.length,
      public_php_replacement_claimed: false,
      complete_canonical_redirect_parity_claimed: false,
      complete_template_loader_parity_claimed: false,
      installed_frontend_http_parity_claimed: false
    }
  };
}

const wpRef = maybeCommand("git", ["-C", UPSTREAM_ROOT, "rev-parse", "HEAD"]);

rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
writeThemeFixtures(ORACLE_ROOT);
writeThemeFixtures(CANDIDATE_ROOT);
writeProbe();

const oracle = runProbe("oracle", ORACLE_ROOT);
const candidate = runProbe("candidate", CANDIDATE_ROOT);
assertCaseCoverage(oracle);
assertCaseCoverage(candidate);
const comparison = compareRuns(oracle, candidate);
if (comparison.status !== "passed") {
  throw new Error("Canonical/template oracle/candidate comparison failed");
}

const manifest = {
  schema: "wphx.wp-core-canonical-template-oracle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["targeted_semantic_parity", "runtime_abi"],
  artifact_scope: "oracle_source_mirror_fixture",
  baseline: {
    upstream_root: UPSTREAM_ROOT,
    upstream_ref: wpRef
  },
  inputs: {
    runner: inputRecord(RUNNER),
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT),
    routing_link_manifest: inputRecord(ROUTING_LINK),
    sources: SOURCE_FILES.map(sourceRecord)
  },
  covered_symbols: COVERED_SYMBOLS,
  fixture_cases: FIXTURE_CASES,
  claims: {
    public_php_replacement: false,
    haxe_semantic_ownership: false,
    canonical_template_oracle_fixture: true,
    complete_canonical_redirect_parity: false,
    complete_template_loader_parity: false,
    installed_frontend_http_parity: false
  },
  comparison
};

const manifestContents = `${JSON.stringify(manifest, null, 2)}\n`;
writeOrCheck(OUT, manifestContents);
const manifestSha = sha256(manifestContents);
writeOrCheck(OWNERSHIP, `${JSON.stringify(ownershipManifest(manifestSha), null, 2)}\n`);
writeOrCheck(RECEIPT, `${JSON.stringify(receipt(manifestSha), null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      status: "passed",
      output: OUT,
      ownership: OWNERSHIP,
      receipt: RECEIPT,
      covered_symbols: COVERED_SYMBOLS.length,
      fixture_cases: FIXTURE_CASES.length
    },
    null,
    2
  )
);
