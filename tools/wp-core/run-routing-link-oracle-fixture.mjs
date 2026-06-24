#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-kvm",
  external_ref: "WPHX-309.06",
  title: "Routing/link oracle-state fixture"
};
const RECORDED_AT = "2026-06-24T03:20:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-routing-link-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-309-06";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-309-06-routing-link-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-309-06-routing-link-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-309-06-routing-link-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-309-01-routing-template-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-309-04-routing-template-adapter-contract-candidate.v1.json";

const SOURCE_FILES = [
  "src/wp-includes/class-wp-matchesmapregex.php",
  "src/wp-includes/class-wp-rewrite.php",
  "src/wp-includes/class-wp.php",
  "src/wp-includes/rewrite.php",
  "src/wp-includes/link-template.php"
];

const COVERED_SYMBOLS = [
  "WP",
  "WP::parse_request",
  "WP::add_query_var",
  "WP_Rewrite",
  "WP_Rewrite::add_rewrite_tag",
  "WP_Rewrite::add_rule",
  "WP_Rewrite::add_permastruct",
  "WP_Rewrite::wp_rewrite_rules",
  "add_rewrite_rule",
  "add_rewrite_tag",
  "add_permastruct",
  "home_url",
  "get_home_url",
  "user_trailingslashit"
];

const FIXTURE_CASES = [
  { id: "rewrite:tag-rule-permastruct", focus: "rewrite tag, top/bottom rules, external rules, and permastruct state" },
  { id: "link:home-url-schemes", focus: "home_url scheme/path handling and filter observations" },
  { id: "link:user-trailingslashit", focus: "trailing slash policy for slash and non-slash permalink structures" },
  { id: "request:matched-rewrite", focus: "WP::parse_request rewrite match and query-var extraction" },
  { id: "request:extra-query-vars", focus: "extra query vars and custom public query vars" },
  { id: "request:404", focus: "unmatched permalink request error routing" }
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
define( 'OBJECT', 'OBJECT' );

$GLOBALS['wphx_309_06_options'] = array(
\t'home' => 'http://example.test/base',
\t'permalink_structure' => '/%postname%/',
\t'rewrite_rules' => array(
\t\t'books/([^/]+)/?$' => 'index.php?book=$matches[1]',
\t\t'category/([^/]+)/?$' => 'index.php?category_name=$matches[1]',
\t),
);
$GLOBALS['wphx_309_06_filters'] = array();
$GLOBALS['wphx_309_06_actions'] = array();
$GLOBALS['wphx_309_06_php_errors'] = array();

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_309_06_php_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

class WP_Post {}

function wp_parse_args( $args, $defaults = array() ) {
\tif ( is_object( $args ) ) {
\t\t$parsed = get_object_vars( $args );
\t} elseif ( is_array( $args ) ) {
\t\t$parsed = $args;
\t} else {
\t\tparse_str( (string) $args, $parsed );
\t}
\treturn array_merge( $defaults, $parsed );
}

function add_query_arg( ...$args ) {
\tif ( count( $args ) < 2 ) {
\t\treturn '';
\t}
\t$uri = array_pop( $args );
\t$query = array_pop( $args );
\tif ( is_array( $query ) ) {
\t\t$vars = $query;
\t} else {
\t\t$vars = array( $query => array_pop( $args ) );
\t}
\t$separator = str_contains( $uri, '?' ) ? '&' : '?';
\treturn $uri . $separator . http_build_query( $vars, '', '&' );
}

function get_option( $name, $default = false ) {
\treturn array_key_exists( $name, $GLOBALS['wphx_309_06_options'] ) ? $GLOBALS['wphx_309_06_options'][ $name ] : $default;
}

function update_option( $name, $value ) {
\t$GLOBALS['wphx_309_06_options'][ $name ] = $value;
\treturn true;
}

function delete_option( $name ) {
\tunset( $GLOBALS['wphx_309_06_options'][ $name ] );
\treturn true;
}

function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_309_06_filters'][] = array(
\t\t'hook' => $hook_name,
\t\t'arg_count' => count( $args ) + 1,
\t);
\tif ( 'do_parse_request' === $hook_name ) {
\t\treturn $value;
\t}
\tif ( 'query_vars' === $hook_name ) {
\t\t$value[] = 'book';
\t\t$value[] = 'custom';
\t\treturn array_values( array_unique( $value ) );
\t}
\treturn $value;
}

function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_309_06_actions'][] = array(
\t\t'hook' => $hook_name,
\t\t'arg_count' => count( $args ),
\t);
}

function do_action_ref_array( $hook_name, $args ) {
\t$GLOBALS['wphx_309_06_actions'][] = array(
\t\t'hook' => $hook_name,
\t\t'arg_count' => count( $args ),
\t);
}

function add_action( $hook_name, $callback ) {
\t$GLOBALS['wphx_309_06_actions'][] = array(
\t\t'hook' => 'add_action:' . $hook_name,
\t\t'arg_count' => 1,
\t);
}

function did_action( $hook_name ) {
\treturn 'wp_loaded' === $hook_name ? 1 : 0;
}

function is_multisite() {
\treturn false;
}

function is_ssl() {
\treturn false;
}

function trailingslashit( $value ) {
\treturn rtrim( $value, '/\\\\' ) . '/';
}

function untrailingslashit( $value ) {
\treturn rtrim( $value, '/\\\\' );
}

function get_page_by_path( $path, $output = OBJECT, $post_type = 'page' ) {
\treturn null;
}

function get_post_status_object( $status ) {
\treturn (object) array(
\t\t'public' => true,
\t\t'protected' => false,
\t\t'private' => false,
\t\t'exclude_from_search' => false,
\t);
}

function get_post_types( $args = array(), $output = 'names' ) {
\t$objects = array(
\t\t'post' => (object) array( 'name' => 'post', 'query_var' => 'name', 'publicly_queryable' => true ),
\t\t'book' => (object) array( 'name' => 'book', 'query_var' => 'book', 'publicly_queryable' => true ),
\t\t'secret' => (object) array( 'name' => 'secret', 'query_var' => 'secret', 'publicly_queryable' => false ),
\t);
\tif ( isset( $args['publicly_queryable'] ) ) {
\t\t$objects = array_filter(
\t\t\t$objects,
\t\t\tfn( $object ) => (bool) $object->publicly_queryable === (bool) $args['publicly_queryable']
\t\t);
\t}
\treturn 'objects' === $output ? $objects : array_keys( $objects );
}

function is_post_type_viewable( $post_type ) {
\treturn ! empty( $post_type->publicly_queryable );
}

function get_taxonomies( $args = array(), $output = 'names' ) {
\t$objects = array(
\t\t'category' => (object) array( 'name' => 'category', 'query_var' => 'category_name', 'publicly_queryable' => true ),
\t\t'private_tax' => (object) array( 'name' => 'private_tax', 'query_var' => 'private_tax', 'publicly_queryable' => false ),
\t);
\tif ( isset( $args['publicly_queryable'] ) ) {
\t\t$objects = array_filter(
\t\t\t$objects,
\t\t\tfn( $object ) => (bool) $object->publicly_queryable === (bool) $args['publicly_queryable']
\t\t);
\t}
\treturn 'objects' === $output ? $objects : array_keys( $objects );
}

function is_admin() {
\treturn false;
}

function wp_die( $message = '', $title = '', $args = array() ) {
\tthrow new RuntimeException( 'wp_die:' . $message );
}

function __( $text ) {
\treturn $text;
}

function wphx_309_06_reset_observers() {
\t$GLOBALS['wphx_309_06_filters'] = array();
\t$GLOBALS['wphx_309_06_actions'] = array();
}

function wphx_309_06_selected_filters() {
\treturn $GLOBALS['wphx_309_06_filters'];
}

function wphx_309_06_selected_actions() {
\treturn $GLOBALS['wphx_309_06_actions'];
}

function wphx_309_06_jsonable( $value ) {
\tif ( is_array( $value ) ) {
\t\t$result = array();
\t\tforeach ( $value as $key => $entry ) {
\t\t\t$result[ $key ] = wphx_309_06_jsonable( $entry );
\t\t}
\t\treturn $result;
\t}
\tif ( is_object( $value ) ) {
\t\treturn array(
\t\t\t'__class' => get_class( $value ),
\t\t\t'props' => wphx_309_06_jsonable( get_object_vars( $value ) ),
\t\t);
\t}
\treturn $value;
}

require $root . '/wp-includes/class-wp-matchesmapregex.php';
require $root . '/wp-includes/class-wp-rewrite.php';
require $root . '/wp-includes/class-wp.php';
require $root . '/wp-includes/rewrite.php';
require $root . '/wp-includes/link-template.php';

function wphx_309_06_new_rewrite() {
\t$GLOBALS['wp_rewrite'] = new WP_Rewrite();
\t$GLOBALS['wp_rewrite']->init();
\treturn $GLOBALS['wp_rewrite'];
}

function wphx_309_06_reflection() {
\t$classes = array();
\tforeach ( array( 'WP', 'WP_Rewrite' ) as $class_name ) {
\t\t$class = new ReflectionClass( $class_name );
\t\t$declaring_file = str_replace( '\\\\', '/', realpath( $class->getFileName() ) );
\t\t$root_path = str_replace( '\\\\', '/', realpath( ABSPATH ) );
\t\tif ( str_starts_with( $declaring_file, $root_path . '/' ) ) {
\t\t\t$declaring_file = substr( $declaring_file, strlen( $root_path ) + 1 );
\t\t}
\t\t$classes[] = array(
\t\t\t'class' => $class->getName(),
\t\t\t'declaring_file' => $declaring_file,
\t\t\t'public_property_count' => count( $class->getProperties( ReflectionProperty::IS_PUBLIC ) ),
\t\t\t'public_method_count' => count( $class->getMethods( ReflectionMethod::IS_PUBLIC ) ),
\t\t);
\t}
\treturn $classes;
}

function wphx_309_06_rewrite_case() {
\twphx_309_06_reset_observers();
\t$wp = new WP();
\t$GLOBALS['wp'] = $wp;
\t$rewrite = wphx_309_06_new_rewrite();
\tadd_rewrite_tag( '%book%', '([^/]+)' );
\tadd_rewrite_rule( 'books/([^/]+)/?$', 'index.php?book=$matches[1]', 'top' );
\tadd_rewrite_rule( 'legacy/(.*)$', 'legacy.php?path=$matches[1]', 'bottom' );
\tadd_permastruct( 'book', 'library/%book%', array( 'with_front' => false, 'feed' => false ) );
\treturn array(
\t\t'id' => 'rewrite:tag-rule-permastruct',
\t\t'public_query_vars_tail' => array_slice( $wp->public_query_vars, -2 ),
\t\t'rewritecode_tail' => array_slice( $rewrite->rewritecode, -2 ),
\t\t'queryreplace_tail' => array_slice( $rewrite->queryreplace, -2 ),
\t\t'extra_rules_top' => $rewrite->extra_rules_top,
\t\t'extra_rules' => $rewrite->extra_rules,
\t\t'non_wp_rules' => $rewrite->non_wp_rules,
\t\t'extra_permastructs' => $rewrite->extra_permastructs,
\t\t'filters' => wphx_309_06_selected_filters(),
\t\t'actions' => wphx_309_06_selected_actions(),
\t);
}

function wphx_309_06_home_url_case() {
\twphx_309_06_reset_observers();
\treturn array(
\t\t'id' => 'link:home-url-schemes',
\t\t'default' => home_url(),
\t\t'nested' => home_url( '/wp-json/wp/v2/posts' ),
\t\t'https' => home_url( 'admin/', 'https' ),
\t\t'relative' => home_url( '/feed/', 'relative' ),
\t\t'filters' => wphx_309_06_selected_filters(),
\t);
}

function wphx_309_06_trailing_case() {
\twphx_309_06_reset_observers();
\t$rewrite = wphx_309_06_new_rewrite();
\t$rewrite->use_trailing_slashes = true;
\t$slash = user_trailingslashit( 'http://example.test/base/path', 'single' );
\t$rewrite->use_trailing_slashes = false;
\t$noslash = user_trailingslashit( 'http://example.test/base/path/', 'single' );
\treturn array(
\t\t'id' => 'link:user-trailingslashit',
\t\t'slash' => $slash,
\t\t'no_slash' => $noslash,
\t\t'filters' => wphx_309_06_selected_filters(),
\t);
}

function wphx_309_06_request_case( $id, $request_uri, $extra_query_vars = array() ) {
\twphx_309_06_reset_observers();
\twphx_309_06_new_rewrite();
\t$_GET = array();
\t$_POST = array();
\t$_SERVER['REQUEST_URI'] = $request_uri;
\t$_SERVER['PATH_INFO'] = '';
\t$_SERVER['PHP_SELF'] = '/index.php';
\t$wp = new WP();
\t$parsed = $wp->parse_request( $extra_query_vars );
\t$selected = array();
\tforeach ( array( 'book', 'category_name', 'custom', 'error', 'post_type', 'name' ) as $key ) {
\t\tif ( array_key_exists( $key, $wp->query_vars ) ) {
\t\t\t$selected[ $key ] = $wp->query_vars[ $key ];
\t\t}
\t}
\treturn array(
\t\t'id' => $id,
\t\t'parsed' => $parsed,
\t\t'request' => $wp->request,
\t\t'matched_rule' => $wp->matched_rule,
\t\t'matched_query' => $wp->matched_query,
\t\t'did_permalink' => $wp->did_permalink,
\t\t'query_vars' => $selected,
\t\t'filters' => wphx_309_06_selected_filters(),
\t\t'actions' => wphx_309_06_selected_actions(),
\t);
}

$cases = array(
\twphx_309_06_rewrite_case(),
\twphx_309_06_home_url_case(),
\twphx_309_06_trailing_case(),
\twphx_309_06_request_case( 'request:matched-rewrite', '/base/books/dune/' ),
\twphx_309_06_request_case( 'request:extra-query-vars', '/base/', array( 'custom' => 'value', 'book' => 'override' ) ),
\twphx_309_06_request_case( 'request:404', '/base/missing-route/' ),
);

echo json_encode(
\tarray(
\t\t'mode' => $mode,
\t\t'reflection' => wphx_309_06_reflection(),
\t\t'cases' => wphx_309_06_jsonable( $cases ),
\t\t'php_errors' => $GLOBALS['wphx_309_06_php_errors'],
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . PHP_EOL;
`
  );
}

function normalizeRun(run) {
  return {
    reflection: run.reflection,
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
    throw new Error(`Unexpected routing/link fixture cases: ${actual.join(", ")}`);
  }
  if (run.php_errors.length !== 0) {
    throw new Error(`Routing/link fixture emitted PHP errors: ${JSON.stringify(run.php_errors)}`);
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
      throw new Error(`${path} is stale; run npm run wp:core:wphx-309-routing-link-oracle-fixture`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/routing-link-oracle-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "rewrite, request, and link oracle-state fixture",
      area: "wp-includes/class-wp.php wp-includes/class-wp-rewrite.php wp-includes/rewrite.php wp-includes/link-template.php",
      public_contract:
        "Mirrored upstream routing/link source is executed in a constrained fixture to capture selected rewrite, link, and parse_request observations. This does not claim Haxe-owned public PHP replacement, canonical redirect parity, template-loader include parity, or installed front-end HTTP parity."
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
        "Replace with Haxe-owned routing/link Adapter IR/public PHP output and installed front-end route/canonical/template evidence before claiming migrated WPHX-309 ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    upstream_mirrored_paths: SOURCE_FILES,
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-309-routing-link-oracle-fixture",
        "npm run wp:core:wphx-309-routing-link-oracle-fixture:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-309-06-routing-link-oracle-fixture"],
      manifest_digest: manifestSha
    }
  };
}

function receipt(manifestSha) {
  return {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-309-06-routing-link-oracle-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref,
      title: ISSUE.title
    },
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "routing/link oracle-state manifest" },
      { path: OWNERSHIP, role: "routing/link oracle-state ownership manifest" },
      { path: RUNNER, role: "deterministic oracle-source-mirror fixture generator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-309-routing-link-oracle-fixture",
      "npm run wp:core:wphx-309-routing-link-oracle-fixture:check",
      "npm run ci:php-conformance:check",
      "npm run receipts:validate"
    ],
    related_receipts: [
      "receipt:wphx-309-01-routing-template-surface",
      "receipt:wphx-309-04-routing-template-adapter-contract-candidate"
    ],
    manifest_sha256: manifestSha,
    validation_result: {
      status: "passed",
      evidence_classes: ["targeted_semantic_parity", "runtime_abi"],
      artifact_scope: "oracle_source_mirror_fixture",
      covered_symbols: COVERED_SYMBOLS.length,
      fixture_cases: FIXTURE_CASES.length,
      public_php_replacement_claimed: false,
      canonical_redirect_parity_claimed: false,
      template_loader_parity_claimed: false,
      installed_frontend_http_parity_claimed: false
    }
  };
}

const wpRef = maybeCommand("git", ["-C", UPSTREAM_ROOT, "rev-parse", "HEAD"]);

rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
writeProbe();

const oracle = runProbe("oracle", ORACLE_ROOT);
const candidate = runProbe("candidate", CANDIDATE_ROOT);
assertCaseCoverage(oracle);
assertCaseCoverage(candidate);
const comparison = compareRuns(oracle, candidate);
if (comparison.status !== "passed") {
  throw new Error("Routing/link oracle/candidate comparison failed");
}

const manifest = {
  schema: "wphx.wp-core-routing-link-oracle-fixture.v1",
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
    sources: SOURCE_FILES.map(sourceRecord)
  },
  covered_symbols: COVERED_SYMBOLS,
  fixture_cases: FIXTURE_CASES,
  claims: {
    public_php_replacement: false,
    haxe_semantic_ownership: false,
    rewrite_link_parse_request_oracle_fixture: true,
    canonical_redirect_parity: false,
    template_loader_parity: false,
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
