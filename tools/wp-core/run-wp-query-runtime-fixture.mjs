#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-t27",
  external_ref: "WPHX-307.06",
  title: "WP_Query runtime ABI and query-state fixture"
};
const OUT_ROOT = "build/wp-core/wphx-307-06";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-307-06-wp-query-runtime-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-307-06-wp-query-runtime-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-307-06-wp-query-runtime-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-307-01-posts-query-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-307-02-posts-query-adapter-contract-candidate.v1.json";
const RECORDED_AT = "2026-06-23T20:10:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-wp-query-runtime-fixture.mjs";

const SOURCE_FILES = ["src/wp-includes/class-wp-tax-query.php", "src/wp-includes/class-wp-query.php"];

const COVERED_SYMBOLS = [
  "WP_Query",
  "WP_Query::parse_query",
  "WP_Query::fill_query_vars",
  "WP_Query::parse_tax_query",
  "WP_Query::set_404",
  "WP_Tax_Query"
];

const FIXTURE_CASES = [
  { id: "query-state:home-default", focus: "default query normalization and is_home fallback" },
  { id: "query-state:single-post-id", focus: "scalar p normalization and singular flags" },
  { id: "query-state:page-id", focus: "page_id normalization and page/singular flags" },
  { id: "query-state:search-paged", focus: "search detection, paged normalization, and parsed-query action" },
  { id: "query-state:invalid-date-404", focus: "month bounds, error var, set_404 action, and 404 flags" },
  { id: "query-state:post-type-archive", focus: "post_type sanitization and archive flag routing" },
  { id: "query-state:status-array", focus: "post_status array sanitization and deterministic ordering" },
  { id: "query-state:category-tax", focus: "category query vars, tax_query construction, and category/archive flags" },
  { id: "query-state:comment-feed", focus: "comments feed normalization and comment-feed flags" },
  { id: "query-state:robots-favicon", focus: "robots/favicon request flags and non-home routing" }
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

$GLOBALS['wp_taxonomies'] = array(
\t'category' => (object) array(
\t\t'name' => 'category',
\t\t'query_var' => 'category_name',
\t\t'rewrite' => array( 'hierarchical' => true ),
\t),
\t'post_tag' => (object) array(
\t\t'name' => 'post_tag',
\t\t'query_var' => 'tag',
\t\t'rewrite' => array( 'hierarchical' => false ),
\t),
);
$GLOBALS['wphx_307_06_actions'] = array();
$GLOBALS['wphx_307_06_php_errors'] = array();
$GLOBALS['wp_query'] = null;

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_307_06_php_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

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

function absint( $maybeint ) {
\treturn abs( (int) $maybeint );
}

function wp_checkdate( $month, $day, $year, $source_date ) {
\treturn checkdate( (int) $month, (int) $day, (int) $year );
}

function is_admin() {
\treturn false;
}

function wp_is_serving_rest_request() {
\treturn false;
}

function get_option( $name, $default = false ) {
\t$options = array(
\t\t'show_on_front' => 'posts',
\t\t'page_on_front' => 0,
\t\t'page_for_posts' => 0,
\t\t'wp_page_for_privacy_policy' => 0,
\t\t'permalink_structure' => '/%postname%/',
\t);
\treturn array_key_exists( $name, $options ) ? $options[ $name ] : $default;
}

function get_page_by_path( $path, $output = OBJECT, $post_type = 'page' ) {
\treturn null;
}

function get_post_type_object( $post_type ) {
\tif ( 'book' === $post_type ) {
\t\treturn (object) array( 'name' => 'book', 'has_archive' => true );
\t}
\tif ( 'post' === $post_type ) {
\t\treturn (object) array( 'name' => 'post', 'has_archive' => false );
\t}
\treturn null;
}

function get_taxonomies( $args = array(), $output = 'names' ) {
\tif ( 'objects' === $output ) {
\t\treturn $GLOBALS['wp_taxonomies'];
\t}
\treturn array_keys( $GLOBALS['wp_taxonomies'] );
}

function wp_basename( $path, $suffix = '' ) {
\t$basename = basename( str_replace( '\\\\', '/', $path ) );
\tif ( $suffix && str_ends_with( $basename, $suffix ) ) {
\t\t$basename = substr( $basename, 0, -strlen( $suffix ) );
\t}
\treturn $basename;
}

function sanitize_key( $key ) {
\treturn preg_replace( '/[^a-z0-9_\\-]/', '', strtolower( (string) $key ) );
}

function sanitize_title_for_query( $title ) {
\t$title = strtolower( trim( (string) $title ) );
\t$title = preg_replace( '/[^a-z0-9_\\-]+/', '-', $title );
\treturn trim( $title, '-' );
}

function sanitize_term_field( $field, $value, $term_id, $taxonomy, $context ) {
\treturn sanitize_title_for_query( $value );
}

function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_307_06_actions'][] = array(
\t\t'hook' => $hook_name,
\t\t'arg_count' => count( $args ),
\t);
}

function do_action_ref_array( $hook_name, $args ) {
\t$GLOBALS['wphx_307_06_actions'][] = array(
\t\t'hook' => $hook_name,
\t\t'arg_count' => count( $args ),
\t);
}

function apply_filters( $hook_name, $value, ...$args ) {
\treturn $value;
}

require $root . '/wp-includes/class-wp-tax-query.php';
require $root . '/wp-includes/class-wp-query.php';

function wphx_307_06_jsonable( $value ) {
\tif ( is_array( $value ) ) {
\t\t$result = array();
\t\tforeach ( $value as $key => $entry ) {
\t\t\t$result[ $key ] = wphx_307_06_jsonable( $entry );
\t\t}
\t\treturn $result;
\t}
\tif ( is_object( $value ) ) {
\t\treturn array(
\t\t\t'__class' => get_class( $value ),
\t\t\t'props' => wphx_307_06_jsonable( get_object_vars( $value ) ),
\t\t);
\t}
\treturn $value;
}

function wphx_307_06_selected_vars( WP_Query $query ) {
\t$keys = array(
\t\t'p',
\t\t'page_id',
\t\t's',
\t\t'paged',
\t\t'year',
\t\t'monthnum',
\t\t'error',
\t\t'post_type',
\t\t'post_status',
\t\t'cat',
\t\t'category__in',
\t\t'tag',
\t\t'feed',
\t\t'withcomments',
\t\t'robots',
\t\t'favicon',
\t);
\t$result = array();
\tforeach ( $keys as $key ) {
\t\tif ( array_key_exists( $key, $query->query_vars ) ) {
\t\t\t$result[ $key ] = wphx_307_06_jsonable( $query->query_vars[ $key ] );
\t\t}
\t}
\treturn $result;
}

function wphx_307_06_flags( WP_Query $query ) {
\t$flags = array(
\t\t'is_home',
\t\t'is_single',
\t\t'is_page',
\t\t'is_singular',
\t\t'is_search',
\t\t'is_paged',
\t\t'is_archive',
\t\t'is_date',
\t\t'is_month',
\t\t'is_404',
\t\t'is_post_type_archive',
\t\t'is_category',
\t\t'is_tag',
\t\t'is_tax',
\t\t'is_feed',
\t\t'is_comment_feed',
\t\t'is_robots',
\t\t'is_favicon',
\t);
\t$result = array();
\tforeach ( $flags as $flag ) {
\t\t$result[ $flag ] = (bool) $query->{$flag};
\t}
\treturn $result;
}

function wphx_307_06_case_result( $id, $vars ) {
\t$GLOBALS['wphx_307_06_actions'] = array();
\t$query = new WP_Query();
\t$query->parse_query( $vars );
\treturn array(
\t\t'id' => $id,
\t\t'query_vars' => wphx_307_06_selected_vars( $query ),
\t\t'flags' => wphx_307_06_flags( $query ),
\t\t'tax_query' => $query->tax_query instanceof WP_Tax_Query ? wphx_307_06_jsonable( array(
\t\t\t'queries' => $query->tax_query->queries,
\t\t\t'queried_terms' => $query->tax_query->queried_terms,
\t\t\t'relation' => $query->tax_query->relation,
\t\t) ) : null,
\t\t'query_vars_hash_kind' => is_string( $query->query_vars_hash ) && 32 === strlen( $query->query_vars_hash ) ? 'md5' : gettype( $query->query_vars_hash ),
\t\t'query_vars_changed' => $query->query_vars_changed,
\t\t'actions' => $GLOBALS['wphx_307_06_actions'],
\t);
}

function wphx_307_06_reflection() {
\t$class = new ReflectionClass( 'WP_Query' );
\t$declaring_file = str_replace( '\\\\', '/', realpath( $class->getFileName() ) );
\t$root = str_replace( '\\\\', '/', realpath( ABSPATH ) );
\tif ( str_starts_with( $declaring_file, $root . '/' ) ) {
\t\t$declaring_file = substr( $declaring_file, strlen( $root ) + 1 );
\t}
\t$properties = array();
\tforeach ( $class->getProperties() as $property ) {
\t\t$properties[] = array(
\t\t\t'name' => $property->getName(),
\t\t\t'visibility' => $property->isPublic() ? 'public' : ( $property->isProtected() ? 'protected' : 'private' ),
\t\t\t'static' => $property->isStatic(),
\t\t\t'declaring_class' => $property->getDeclaringClass()->getName(),
\t\t);
\t}
\t$methods = array();
\tforeach ( array( 'parse_query', 'fill_query_vars', 'parse_tax_query', 'set_404', 'query', 'get', 'set', 'is_home', 'is_search', 'is_single', 'is_page', 'is_archive' ) as $name ) {
\t\t$method = $class->getMethod( $name );
\t\t$parameters = array();
\t\tforeach ( $method->getParameters() as $parameter ) {
\t\t\t$parameters[] = array(
\t\t\t\t'name' => $parameter->getName(),
\t\t\t\t'position' => $parameter->getPosition(),
\t\t\t\t'optional' => $parameter->isOptional(),
\t\t\t\t'by_reference' => $parameter->isPassedByReference(),
\t\t\t);
\t\t}
\t\t$methods[] = array(
\t\t\t'name' => $name,
\t\t\t'visibility' => $method->isPublic() ? 'public' : ( $method->isProtected() ? 'protected' : 'private' ),
\t\t\t'static' => $method->isStatic(),
\t\t\t'returns_reference' => $method->returnsReference(),
\t\t\t'declaring_class' => $method->getDeclaringClass()->getName(),
\t\t\t'parameters' => $parameters,
\t\t);
\t}
\treturn array(
\t\t'class' => $class->getName(),
\t\t'declaring_file' => $declaring_file,
\t\t'attributes' => array_map( fn( $attribute ) => $attribute->getName(), $class->getAttributes() ),
\t\t'property_count' => count( $properties ),
\t\t'public_property_count' => count( array_filter( $properties, fn( $property ) => 'public' === $property['visibility'] ) ),
\t\t'properties' => $properties,
\t\t'methods' => $methods,
\t);
}

$cases = array(
\t'query-state:home-default' => array(),
\t'query-state:single-post-id' => array( 'p' => '42' ),
\t'query-state:page-id' => array( 'page_id' => '7' ),
\t'query-state:search-paged' => array( 's' => 'alpha beta', 'paged' => '3' ),
\t'query-state:invalid-date-404' => array( 'year' => '2026', 'monthnum' => '13' ),
\t'query-state:post-type-archive' => array( 'post_type' => 'book' ),
\t'query-state:status-array' => array( 'post_status' => array( 'draft', 'Publish', 'private', 'draft!' ) ),
\t'query-state:category-tax' => array( 'cat' => '9,-2, 4' ),
\t'query-state:comment-feed' => array( 'feed' => 'comments-rss2', 'p' => '42' ),
\t'query-state:robots-favicon' => array( 'robots' => '1', 'favicon' => '1' ),
);

$results = array();
foreach ( $cases as $id => $vars ) {
\t$results[] = wphx_307_06_case_result( $id, $vars );
}

echo json_encode(
\tarray(
\t\t'mode' => $mode,
\t\t'reflection' => wphx_307_06_reflection(),
\t\t'cases' => $results,
\t\t'php_errors' => $GLOBALS['wphx_307_06_php_errors'],
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
    throw new Error(`Unexpected WP_Query fixture cases: ${actual.join(", ")}`);
  }
  if (run.php_errors.length !== 0) {
    throw new Error(`WP_Query fixture emitted PHP errors: ${JSON.stringify(run.php_errors)}`);
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
      throw new Error(`${path} is stale; run npm run wp:core:wphx-307-wp-query-runtime-fixture`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wp-query-runtime-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "WP_Query runtime ABI and query-state fixture",
      area: "wp-includes/class-wp-query.php",
      public_contract:
        "Mirrored upstream WP_Query source is executed in a constrained fixture to capture runtime ABI and query-state observations. This does not claim Haxe-owned public PHP replacement or live database result parity."
    },
    ownership_state: "upstream_oracle_source_mirror",
    ownership_axes: {
      semantic_owner: "upstream_wordpress_oracle",
      adapter_contract_owner: "not_claimed",
      emission_strategy: "oracle_source_mirror_fixture",
      execution_provider: "php",
      compatibility_evidence: "runtime_abi_and_query_state_parity"
    },
    bridge: {
      exists: true,
      kind: "fixture-only-upstream-source-mirror",
      removal_gate:
        "Replace with Haxe-owned WP_Query Adapter IR/public PHP output and live database SQL/result parity before claiming migrated WP_Query ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    upstream_mirrored_paths: SOURCE_FILES,
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-307-wp-query-runtime-fixture",
        "npm run wp:core:wphx-307-wp-query-runtime-fixture:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-307-06-wp-query-runtime-fixture"],
      manifest_digest: manifestSha
    }
  };
}

function receipt(manifestSha) {
  return {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-307-06-wp-query-runtime-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref,
      title: ISSUE.title
    },
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "WP_Query runtime ABI and query-state manifest" },
      { path: OWNERSHIP, role: "WP_Query runtime fixture ownership manifest" },
      { path: RUNNER, role: "deterministic oracle-source-mirror fixture generator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-307-wp-query-runtime-fixture",
      "npm run wp:core:wphx-307-wp-query-runtime-fixture:check",
      "npm run ci:php-conformance:check",
      "npm run receipts:validate"
    ],
    related_receipts: [
      "receipt:wphx-307-01-posts-query-surface",
      "receipt:wphx-307-02-posts-query-adapter-contract-candidate",
      "receipt:wphx-307-03-post-crud-status-adapter-contract-candidate",
      "receipt:wphx-307-04-post-meta-cache-adapter-contract-candidate",
      "receipt:wphx-307-05-post-revision-adapter-contract-candidate"
    ],
    manifest_sha256: manifestSha,
    validation_result: {
      status: "passed",
      evidence_classes: ["runtime_abi", "targeted_semantic_parity"],
      artifact_scope: "oracle_source_mirror_fixture",
      covered_symbols: COVERED_SYMBOLS.length,
      fixture_cases: FIXTURE_CASES.length,
      public_php_replacement_claimed: false,
      live_database_result_parity_claimed: false
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
  throw new Error("WP_Query oracle/candidate query-state comparison failed");
}

const manifest = {
  schema: "wphx.wp-core-wp-query-runtime-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["runtime_abi", "targeted_semantic_parity"],
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
    live_database_result_parity: false,
    sql_execution_parity: false,
    runtime_abi_and_query_state_fixture: true
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
