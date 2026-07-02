#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const checkOnly = process.argv.includes("--check");
const RECORDED_AT = "2026-07-02T23:59:00Z";
const ISSUE = {
  id: "wordpresshx-f2w7",
  external_ref: "WPHX-COMP-PHP-FEED-EMBED-HTTPS-REMAINDER",
  title: "Expand feed embed HTTPS original-path adapters"
};
const RUNNER = "tools/wphx-php/run-https-module-functions.mjs";
const IMPL_HXML = "fixtures/wphx-php/https-module-functions-impl.hxml";
const SHELL_HXML = "fixtures/wphx-php/https-module-functions.hxml";
const SOURCE_FILES = [
  "src/wphx/compiler/php/WphxPhpCompiler.hx",
  "fixtures/wphx-php/src/wphx/fixtures/php/https/HttpsImplEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/php/https/HttpsKernel.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/https/HttpsModuleEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/https/HttpsModuleSurface.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/https/HaxeHttpsKernel.hx"
];
const OUT_ROOT = "build/wphx-php/https-module-functions";
const GENERATED_ROOT = `${OUT_ROOT}/generated`;
const GENERATED_DETECTION = `${GENERATED_ROOT}/wp-includes/https-detection.php`;
const GENERATED_MIGRATION = `${GENERATED_ROOT}/wp-includes/https-migration.php`;
const EMISSION_MANIFEST = `${GENERATED_ROOT}/wphx-php-emission.v1.json`;
const ORACLE_DETECTION = `${OUT_ROOT}/oracle/wp-includes/https-detection.php`;
const ORACLE_MIGRATION = `${OUT_ROOT}/oracle/wp-includes/https-migration.php`;
const PROBE = `${OUT_ROOT}/probe.php`;
const MANIFEST = "manifests/wphx-php/https-module-functions.v1.json";
const RECEIPT = "receipts/compiler/wphx-comp-php-https-module-functions.v1.json";
const EXACT_PATTERNS = [
  {
    path: GENERATED_DETECTION,
    patterns: [
      "if (!defined('WPHX_HTTPS_MODULE_BOOTSTRAPPED'))",
      "function wp_is_using_https()",
      "function wp_is_home_url_using_https()",
      "function wp_is_site_url_using_https()",
      "function wp_is_local_html_output($html)",
      "HttpsKernel::isUsingHttps()",
      "HttpsKernel::isLocalHtmlOutput($html)"
    ]
  },
  {
    path: GENERATED_MIGRATION,
    patterns: [
      "if (!defined('WPHX_HTTPS_MODULE_BOOTSTRAPPED'))",
      "function wp_should_replace_insecure_home_url()",
      "function wp_replace_insecure_home_url($content)",
      "function wp_update_urls_to_https()",
      "function wp_update_https_migration_required($old_url, $new_url)",
      "HttpsKernel::shouldReplaceInsecureHomeUrl()",
      "HttpsKernel::updateHttpsMigrationRequired($old_url, $new_url)"
    ]
  }
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    ...options
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\nstdout:\n${result.stdout ?? ""}\nstderr:\n${result.stderr ?? ""}`);
  }
  return result.stdout ?? "";
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function inputRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
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

function oracleDetectionSource() {
  return `<?php
function wp_is_using_https() {
\tif ( ! wp_is_home_url_using_https() ) {
\t\treturn false;
\t}

\treturn wp_is_site_url_using_https();
}

function wp_is_home_url_using_https() {
\treturn 'https' === wp_parse_url( home_url(), PHP_URL_SCHEME );
}

function wp_is_site_url_using_https() {
\t$site_url = apply_filters( 'site_url', get_option( 'siteurl' ), '', null, null );

\treturn 'https' === wp_parse_url( $site_url, PHP_URL_SCHEME );
}

function wp_is_local_html_output( $html ) {
\tif ( has_action( 'wp_head', 'rsd_link' ) ) {
\t\t$pattern = preg_replace( '#^https?:(?=//)#', '', esc_url( site_url( 'xmlrpc.php?rsd', 'rpc' ) ) );
\t\treturn str_contains( $html, $pattern );
\t}

\tif ( has_action( 'wp_head', 'rest_output_link_wp_head' ) ) {
\t\t$pattern = preg_replace( '#^https?:(?=//)#', '', esc_url( get_rest_url() ) );
\t\treturn str_contains( $html, $pattern );
\t}

\treturn null;
}
`;
}

function oracleMigrationSource() {
  return `<?php
function wp_should_replace_insecure_home_url() {
\t$should_replace_insecure_home_url = wp_is_using_https()
\t\t&& get_option( 'https_migration_required' )
\t\t&& wp_parse_url( home_url(), PHP_URL_HOST ) === wp_parse_url( site_url(), PHP_URL_HOST );

\treturn apply_filters( 'wp_should_replace_insecure_home_url', $should_replace_insecure_home_url );
}

function wp_replace_insecure_home_url( $content ) {
\tif ( ! wp_should_replace_insecure_home_url() ) {
\t\treturn $content;
\t}

\t$https_url = home_url( '', 'https' );
\t$http_url  = str_replace( 'https://', 'http://', $https_url );

\t$escaped_https_url = str_replace( '/', '\\/', $https_url );
\t$escaped_http_url  = str_replace( '/', '\\/', $http_url );

\treturn str_replace(
\t\tarray(
\t\t\t$http_url,
\t\t\t$escaped_http_url,
\t\t),
\t\tarray(
\t\t\t$https_url,
\t\t\t$escaped_https_url,
\t\t),
\t\t$content
\t);
}

function wp_update_urls_to_https() {
\t$orig_home    = get_option( 'home' );
\t$orig_siteurl = get_option( 'siteurl' );

\t$home    = str_replace( 'http://', 'https://', $orig_home );
\t$siteurl = str_replace( 'http://', 'https://', $orig_siteurl );

\tupdate_option( 'home', $home );
\tupdate_option( 'siteurl', $siteurl );

\tif ( ! wp_is_using_https() ) {
\t\tupdate_option( 'home', $orig_home );
\t\tupdate_option( 'siteurl', $orig_siteurl );
\t\treturn false;
\t}

\treturn true;
}

function wp_update_https_migration_required( $old_url, $new_url ) {
\tif ( wp_installing() ) {
\t\treturn;
\t}

\tif ( untrailingslashit( (string) $old_url ) !== str_replace( 'https://', 'http://', untrailingslashit( (string) $new_url ) ) ) {
\t\tdelete_option( 'https_migration_required' );
\t\treturn;
\t}

\t$https_migration_required = get_option( 'fresh_site' ) ? false : true;

\tupdate_option( 'https_migration_required', $https_migration_required );
}
`;
}

function probeSource() {
  return `<?php
$mode = $argv[1];
$detection_shell = $argv[2];
$migration_shell = $argv[3];

$GLOBALS['wphx_options'] = array();
$GLOBALS['wphx_filter_log'] = array();
$GLOBALS['wphx_filter_overrides'] = array();
$GLOBALS['wphx_actions'] = array();
$GLOBALS['wphx_installing'] = false;

function wphx_https_truthy( $value ) {
\treturn (bool) $value;
}

function get_option( $name, $default = false ) {
\treturn array_key_exists( $name, $GLOBALS['wphx_options'] ) ? $GLOBALS['wphx_options'][ $name ] : $default;
}

function update_option( $name, $value, $autoload = null ) {
\t$GLOBALS['wphx_options'][ $name ] = $value;
\treturn true;
}

function delete_option( $name ) {
\tunset( $GLOBALS['wphx_options'][ $name ] );
\treturn true;
}

function home_url( $path = '', $scheme = null ) {
\t$url = rtrim( (string) get_option( 'home' ), '/' ) . $path;
\tif ( 'https' === $scheme ) {
\t\t$url = preg_replace( '#^http://#', 'https://', $url );
\t} elseif ( 'http' === $scheme ) {
\t\t$url = preg_replace( '#^https://#', 'http://', $url );
\t}
\treturn $url;
}

function site_url( $path = '', $scheme = null ) {
\t$url = rtrim( (string) get_option( 'siteurl' ), '/' );
\tif ( '' !== $path ) {
\t\t$url .= '/' . ltrim( $path, '/' );
\t}
\tif ( 'https' === $scheme ) {
\t\t$url = preg_replace( '#^http://#', 'https://', $url );
\t} elseif ( 'http' === $scheme || 'rpc' === $scheme ) {
\t\t$url = preg_replace( '#^https://#', 'http://', $url );
\t}
\treturn $url;
}

function wp_parse_url( $url, $component = -1 ) {
\t$parsed = parse_url( $url );
\tif ( -1 === $component ) {
\t\treturn $parsed;
\t}
\treturn parse_url( $url, $component );
}

function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_filter_log'][] = array(
\t\t'hook' => $hook_name,
\t\t'value' => $value,
\t\t'args' => $args,
\t);
\tif ( array_key_exists( $hook_name, $GLOBALS['wphx_filter_overrides'] ) ) {
\t\t$override = $GLOBALS['wphx_filter_overrides'][ $hook_name ];
\t\treturn is_callable( $override ) ? $override( $value, ...$args ) : $override;
\t}
\treturn $value;
}

function has_action( $hook_name, $callback = false ) {
\t$key = $hook_name . ':' . ( false === $callback ? '*' : $callback );
\treturn $GLOBALS['wphx_actions'][ $key ] ?? false;
}

function esc_url( $value ) {
\treturn (string) $value;
}

function get_rest_url() {
\treturn home_url( '/wp-json/', 'https' );
}

function wp_installing() {
\treturn $GLOBALS['wphx_installing'];
}

function untrailingslashit( $value ) {
\treturn rtrim( (string) $value, '/\\\\' );
}

require $detection_shell;
require $migration_shell;

function wphx_case( $id, $options, $filters, $actions, $callback ) {
\t$GLOBALS['wphx_options'] = array_merge(
\t\tarray(
\t\t\t'home' => 'http://example.test',
\t\t\t'siteurl' => 'http://example.test',
\t\t\t'https_migration_required' => false,
\t\t\t'fresh_site' => false,
\t\t),
\t\t$options
\t);
\t$GLOBALS['wphx_filter_log'] = array();
\t$GLOBALS['wphx_filter_overrides'] = $filters;
\t$GLOBALS['wphx_actions'] = $actions;
\t$GLOBALS['wphx_installing'] = false;
\t$value = $callback();
\treturn array(
\t\t'id' => $id,
\t\t'value' => $value,
\t\t'options' => $GLOBALS['wphx_options'],
\t\t'filters' => $GLOBALS['wphx_filter_log'],
\t);
}

$cases = array();
$cases[] = wphx_case( 'using-https:false-home', array(), array(), array(), function () {
\treturn wp_is_using_https();
} );
$cases[] = wphx_case( 'using-https:true', array( 'home' => 'https://example.test', 'siteurl' => 'https://example.test/wp' ), array(), array(), function () {
\treturn array(
\t\t'home' => wp_is_home_url_using_https(),
\t\t'site' => wp_is_site_url_using_https(),
\t\t'using' => wp_is_using_https(),
\t);
} );
$cases[] = wphx_case( 'site-url-filtered', array( 'home' => 'https://example.test', 'siteurl' => 'http://example.test/wp' ), array( 'site_url' => 'https://filtered.example/wp' ), array(), function () {
\treturn wp_is_site_url_using_https();
} );
$cases[] = wphx_case( 'should-replace:true', array( 'home' => 'https://example.test', 'siteurl' => 'https://example.test/wp', 'https_migration_required' => true ), array(), array(), function () {
\treturn wp_should_replace_insecure_home_url();
} );
$cases[] = wphx_case( 'should-replace:host-mismatch', array( 'home' => 'https://example.test', 'siteurl' => 'https://wp.example.test', 'https_migration_required' => true ), array(), array(), function () {
\treturn wp_should_replace_insecure_home_url();
} );
$cases[] = wphx_case( 'should-replace:filtered-false', array( 'home' => 'https://example.test', 'siteurl' => 'https://example.test/wp', 'https_migration_required' => true ), array( 'wp_should_replace_insecure_home_url' => false ), array(), function () {
\treturn wp_should_replace_insecure_home_url();
} );
$cases[] = wphx_case( 'replace-insecure:enabled', array( 'home' => 'https://example.test', 'siteurl' => 'https://example.test/wp', 'https_migration_required' => true ), array(), array(), function () {
\treturn wp_replace_insecure_home_url( 'Visit http://example.test and http:\\/\\/example.test' );
} );
$cases[] = wphx_case( 'replace-insecure:disabled', array( 'home' => 'https://example.test', 'siteurl' => 'https://example.test/wp', 'https_migration_required' => false ), array(), array(), function () {
\treturn wp_replace_insecure_home_url( 'Visit http://example.test' );
} );
$cases[] = wphx_case( 'update-urls:success', array(), array(), array(), function () {
\treturn wp_update_urls_to_https();
} );
$cases[] = wphx_case( 'update-urls:revert-on-filtered-site-http', array(), array( 'site_url' => 'http://constant.example/wp' ), array(), function () {
\treturn wp_update_urls_to_https();
} );
$cases[] = wphx_case( 'migration-required:sets-true', array( 'fresh_site' => false ), array(), array(), function () {
\twp_update_https_migration_required( 'http://example.test', 'https://example.test/' );
\treturn get_option( 'https_migration_required', null );
} );
$cases[] = wphx_case( 'migration-required:fresh-site-false', array( 'fresh_site' => true ), array(), array(), function () {
\twp_update_https_migration_required( 'http://example.test', 'https://example.test' );
\treturn get_option( 'https_migration_required', null );
} );
$cases[] = wphx_case( 'migration-required:delete-mismatch', array( 'https_migration_required' => true ), array(), array(), function () {
\twp_update_https_migration_required( 'http://example.test/old', 'https://example.test/new' );
\treturn get_option( 'https_migration_required', null );
} );
$cases[] = wphx_case( 'local-html:rsd-true', array( 'home' => 'https://example.test', 'siteurl' => 'https://example.test/wp' ), array(), array( 'wp_head:rsd_link' => 10 ), function () {
\treturn wp_is_local_html_output( '<html><link href="//example.test/wp/xmlrpc.php?rsd" /></html>' );
} );
$cases[] = wphx_case( 'local-html:rsd-false', array( 'home' => 'https://example.test', 'siteurl' => 'https://example.test/wp' ), array(), array( 'wp_head:rsd_link' => 10 ), function () {
\treturn wp_is_local_html_output( '<html><link href="//other.example/xmlrpc.php?rsd" /></html>' );
} );
$cases[] = wphx_case( 'local-html:rest-true', array( 'home' => 'https://example.test', 'siteurl' => 'https://example.test/wp' ), array(), array( 'wp_head:rest_output_link_wp_head' => 10 ), function () {
\treturn wp_is_local_html_output( '<html><link href="//example.test/wp-json/" /></html>' );
} );
$cases[] = wphx_case( 'local-html:unknown', array(), array(), array(), function () {
\treturn wp_is_local_html_output( '<html></html>' );
} );

$reflection = array();
foreach ( array( 'wp_is_using_https', 'wp_is_home_url_using_https', 'wp_is_site_url_using_https', 'wp_is_local_html_output', 'wp_should_replace_insecure_home_url', 'wp_replace_insecure_home_url', 'wp_update_urls_to_https', 'wp_update_https_migration_required' ) as $function_name ) {
\t$function = new ReflectionFunction( $function_name );
\t$params = array();
\tforeach ( $function->getParameters() as $parameter ) {
\t\t$params[] = array(
\t\t\t'name' => $parameter->getName(),
\t\t\t'position' => $parameter->getPosition(),
\t\t\t'isOptional' => $parameter->isOptional(),
\t\t\t'hasDefault' => $parameter->isDefaultValueAvailable(),
\t\t\t'default' => $parameter->isDefaultValueAvailable() ? $parameter->getDefaultValue() : null,
\t\t\t'hasType' => $parameter->hasType(),
\t\t\t'isPassedByReference' => $parameter->isPassedByReference(),
\t\t\t'isVariadic' => $parameter->isVariadic(),
\t\t);
\t}
\t$reflection[ $function_name ] = array(
\t\t'name' => $function->getName(),
\t\t'numberOfParameters' => $function->getNumberOfParameters(),
\t\t'numberOfRequiredParameters' => $function->getNumberOfRequiredParameters(),
\t\t'returnsReference' => $function->returnsReference(),
\t\t'hasReturnType' => $function->hasReturnType(),
\t\t'parameters' => $params,
\t);
}

echo json_encode(
\tarray(
\t\t'mode' => $mode,
\t\t'cases' => $cases,
\t\t'reflection' => $reflection,
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\\n";
`;
}

function normalizeProbe(result) {
  return {
    cases: result.cases,
    reflection: result.reflection
  };
}

function assertJsonEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected ${label}:\nactual=${JSON.stringify(actual, null, 2)}\nexpected=${JSON.stringify(expected, null, 2)}`);
  }
}

function main() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  mkdirSync(dirname(ORACLE_DETECTION), { recursive: true });
  writeFileSync(ORACLE_DETECTION, oracleDetectionSource());
  writeFileSync(ORACLE_MIGRATION, oracleMigrationSource());
  writeFileSync(PROBE, probeSource());

  run("haxe", [IMPL_HXML]);
  run("haxe", [SHELL_HXML]);

  const oracleDetectionLint = run("php", ["-l", ORACLE_DETECTION]).trim();
  const oracleMigrationLint = run("php", ["-l", ORACLE_MIGRATION]).trim();
  const generatedDetectionLint = run("php", ["-l", GENERATED_DETECTION]).trim();
  const generatedMigrationLint = run("php", ["-l", GENERATED_MIGRATION]).trim();
  for (const contract of EXACT_PATTERNS) {
    const source = readFileSync(contract.path, "utf8");
    const missing = contract.patterns.filter((pattern) => !source.includes(pattern));
    if (missing.length > 0) {
      throw new Error(`${contract.path} is missing exact patterns: ${JSON.stringify(missing)}`);
    }
  }

  const oracle = JSON.parse(run("php", [PROBE, "oracle", ORACLE_DETECTION, ORACLE_MIGRATION]));
  const generated = JSON.parse(run("php", [PROBE, "generated", GENERATED_DETECTION, GENERATED_MIGRATION]));
  assertJsonEqual(normalizeProbe(generated), normalizeProbe(oracle), "HTTPS module oracle/candidate probe");

  const emissionManifest = JSON.parse(readFileSync(EMISSION_MANIFEST, "utf8"));
  const declarations = emissionManifest.files.flatMap((file) => file.declarations.map((entry) => `${file.path}:${entry.kind}:${entry.name}`)).sort();
  const expectedDeclarations = [
    "wp-includes/https-detection.php:global-function:wp_is_home_url_using_https",
    "wp-includes/https-detection.php:global-function:wp_is_local_html_output",
    "wp-includes/https-detection.php:global-function:wp_is_site_url_using_https",
    "wp-includes/https-detection.php:global-function:wp_is_using_https",
    "wp-includes/https-migration.php:global-function:wp_replace_insecure_home_url",
    "wp-includes/https-migration.php:global-function:wp_should_replace_insecure_home_url",
    "wp-includes/https-migration.php:global-function:wp_update_https_migration_required",
    "wp-includes/https-migration.php:global-function:wp_update_urls_to_https"
  ];
  assertJsonEqual(declarations, expectedDeclarations, "HTTPS module declarations");
  if ((emissionManifest.unsupported ?? []).length !== 0) {
    throw new Error(`Unexpected unsupported constructs: ${JSON.stringify(emissionManifest.unsupported)}`);
  }
  const guardedValues = emissionManifest.files.flatMap((file) => file.declarations.map((entry) => entry.guarded));
  if (guardedValues.some(Boolean)) {
    throw new Error(`HTTPS module functions must be unguarded WordPress module declarations: ${JSON.stringify(guardedValues)}`);
  }

  const manifest = {
    schema: "wphx.wphx-php-https-module-functions.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "module_function_original_path_adapter",
    artifact_scope: "selected_wphx_312_04_https_module_functions",
    inputs: [IMPL_HXML, SHELL_HXML, ...SOURCE_FILES].map(inputRecord),
    upstream_oracle: {
      repo_paths: [
        "../wordpress-develop/src/wp-includes/https-detection.php",
        "../wordpress-develop/src/wp-includes/https-migration.php"
      ],
      selected_symbols: [
        "wp_is_using_https",
        "wp_is_home_url_using_https",
        "wp_is_site_url_using_https",
        "wp_is_local_html_output",
        "wp_should_replace_insecure_home_url",
        "wp_replace_insecure_home_url",
        "wp_update_urls_to_https",
        "wp_update_https_migration_required"
      ],
      selected_source_lines: {
        "https-detection.php": ["15-22", "34-36", "51-57", "148-164"],
        "https-migration.php": ["17-34", "45-66", "78-101", "114-134"]
      }
    },
    generated_shells: [
      {
        path: GENERATED_DETECTION,
        bytes: statSync(GENERATED_DETECTION).size,
        sha256: sha256File(GENERATED_DETECTION),
        php_lint: "passed",
        php_lint_output: generatedDetectionLint
      },
      {
        path: GENERATED_MIGRATION,
        bytes: statSync(GENERATED_MIGRATION).size,
        sha256: sha256File(GENERATED_MIGRATION),
        php_lint: "passed",
        php_lint_output: generatedMigrationLint
      }
    ],
    oracle_shells: [
      {
        path: ORACLE_DETECTION,
        bytes: statSync(ORACLE_DETECTION).size,
        sha256: sha256File(ORACLE_DETECTION),
        php_lint: "passed",
        php_lint_output: oracleDetectionLint
      },
      {
        path: ORACLE_MIGRATION,
        bytes: statSync(ORACLE_MIGRATION).size,
        sha256: sha256File(ORACLE_MIGRATION),
        php_lint: "passed",
        php_lint_output: oracleMigrationLint
      }
    ],
    emission_manifest: {
      path: EMISSION_MANIFEST,
      bytes: statSync(EMISSION_MANIFEST).size,
      sha256: sha256File(EMISSION_MANIFEST),
      declarations,
      unsupported: emissionManifest.unsupported,
      core_ir_features: emissionManifest.core_ir_features,
      segment_plans: emissionManifest.segment_plans,
      adapter_templates: emissionManifest.adapter_templates
    },
    observations: {
      oracle,
      generated,
      match: true
    },
    validation_result: {
      status: "passed",
      php_lint_passed: true,
      exact_contracts_passed: true,
      oracle_candidate_behavior_matched: true,
      reflection_abi_matched: true,
      unsupported_empty: true,
      unguarded_module_functions: true,
      original_path_https_detection_php: true,
      original_path_https_migration_php: true,
      haxe_bootstrap_delegation: true
    },
    claims: [
      "WPHX PHP emits selected unguarded module-level public functions at original paths wp-includes/https-detection.php and wp-includes/https-migration.php.",
      "The generated selected HTTPS helpers preserve reflection-visible parameters/defaults for the selected fixture.",
      "The minimized oracle/candidate probe matches WordPress 7.0 behavior for home/site HTTPS URL detection, site_url filtering, insecure home URL replacement, URL option HTTPS migration and revert behavior, migration-required option updates, local RSD/REST HTML source checks, and filter payloads."
    ],
    non_claims: [
      "This fixture does not claim full wp-includes/https-detection.php or wp-includes/https-migration.php ownership.",
      "This fixture does not retire the WPHX-312.04 copied feed/embed/HTTPS oracle fixture.",
      "This fixture does not claim wp_get_https_detection_errors(), wp_is_https_supported(), live remote HTTPS probing, TLS verification, WP_Error native-array boundaries, embed.php, class-wp-oembed.php, class-wp-embed.php, or installed WordPress behavior ownership."
    ]
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const receipt = {
    schema: "wphx.compiler-receipt.v1",
    id: "receipt:wphx-comp-php-https-module-functions",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "passed",
    evidence_class: "module_function_original_path_adapter",
    artifact_scope: "selected_wphx_312_04_https_module_functions",
    commands: ["npm run wphx:php:https-module-functions", "npm run wphx:php:https-module-functions:check"],
    artifacts: [
      { path: RUNNER, role: "deterministic HTTPS module function adapter runner" },
      { path: SHELL_HXML, role: "WPHX PHP original-path HTTPS module shell hxml" },
      { path: IMPL_HXML, role: "stock Haxe PHP HTTPS helper implementation hxml" },
      { path: "fixtures/wphx-php/src/wphx/fixtures/compiler/php/https/HttpsModuleSurface.hx", role: "typed Haxe public HTTPS module-function shell metadata" },
      { path: "fixtures/wphx-php/src/wphx/fixtures/php/https/HttpsKernel.hx", role: "typed Haxe HTTPS helper behavior" },
      { path: MANIFEST, role: "HTTPS module function adapter manifest" }
    ],
    manifest_sha256: sha256(manifestText),
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };

  writeOrCheck(MANIFEST, manifestText);
  writeOrCheck(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        status: "passed",
        manifest: MANIFEST,
        receipt: RECEIPT,
        generated_shells: [GENERATED_DETECTION, GENERATED_MIGRATION],
        selected_symbols: manifest.upstream_oracle.selected_symbols
      },
      null,
      2
    )
  );
}

main();
