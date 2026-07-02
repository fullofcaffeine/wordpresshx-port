#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const checkOnly = process.argv.includes("--check");
const RECORDED_AT = "2026-07-02T23:59:30Z";
const ISSUE = {
  id: "wordpresshx-f2w7",
  external_ref: "WPHX-COMP-PHP-FEED-EMBED-HTTPS-REMAINDER",
  title: "Expand feed embed HTTPS original-path adapters"
};
const RUNNER = "tools/wphx-php/run-embed-module-functions.mjs";
const IMPL_HXML = "fixtures/wphx-php/embed-module-functions-impl.hxml";
const SHELL_HXML = "fixtures/wphx-php/embed-module-functions.hxml";
const SOURCE_FILES = [
  "src/wphx/compiler/php/WphxPhpCompiler.hx",
  "fixtures/wphx-php/src/wphx/fixtures/php/embed/EmbedImplEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/php/embed/EmbedKernel.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/embed/EmbedModuleEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/embed/EmbedModuleSurface.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/embed/HaxeEmbedKernel.hx"
];
const OUT_ROOT = "build/wphx-php/embed-module-functions";
const GENERATED_ROOT = `${OUT_ROOT}/generated`;
const GENERATED_SHELL = `${GENERATED_ROOT}/wp-includes/embed.php`;
const EMISSION_MANIFEST = `${GENERATED_ROOT}/wphx-php-emission.v1.json`;
const ORACLE_SHELL = `${OUT_ROOT}/oracle/wp-includes/embed.php`;
const PROBE = `${OUT_ROOT}/probe.php`;
const MANIFEST = "manifests/wphx-php/embed-module-functions.v1.json";
const RECEIPT = "receipts/compiler/wphx-comp-php-embed-module-functions.v1.json";
const EXACT_PATTERNS = [
  "if (!defined('WPHX_EMBED_MODULE_BOOTSTRAPPED'))",
  "function wp_embed_defaults($url = '')",
  "function get_oembed_endpoint_url($permalink = '', $format = 'json')",
  "function wp_oembed_ensure_format($format)",
  "function wp_oembed_add_provider($format, $provider, $regex = false)",
  "function wp_oembed_remove_provider($format)",
  "function wp_embed_handler_audio($matches, $attr, $url, $rawattr)",
  "function wp_embed_handler_video($matches, $attr, $url, $rawattr)",
  "EmbedKernel::embedDefaults($url)",
  "EmbedKernel::oembedEndpointUrl($permalink, $format)",
  "EmbedKernel::oembedAddProvider($format, $provider, $regex)",
  "EmbedKernel::oembedRemoveProvider($format)",
  "EmbedKernel::embedHandlerAudio($matches, $attr, $url, $rawattr)"
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

function oracleSource() {
  return `<?php
function wp_embed_defaults( $url = '' ) {
\tif ( ! empty( $GLOBALS['content_width'] ) ) {
\t\t$width = (int) $GLOBALS['content_width'];
\t}

\tif ( empty( $width ) ) {
\t\t$width = 500;
\t}

\t$height = min( (int) ceil( $width * 1.5 ), 1000 );

\treturn apply_filters( 'embed_defaults', compact( 'width', 'height' ), $url );
}

function get_oembed_endpoint_url( $permalink = '', $format = 'json' ) {
\t$url = rest_url( 'oembed/1.0/embed' );

\tif ( '' !== $permalink ) {
\t\t$url = add_query_arg(
\t\t\tarray(
\t\t\t\t'url'    => urlencode( $permalink ),
\t\t\t\t'format' => ( 'json' !== $format ) ? $format : false,
\t\t\t),
\t\t\t$url
\t\t);
\t}

\treturn apply_filters( 'oembed_endpoint_url', $url, $permalink, $format );
}

function wp_oembed_ensure_format( $format ) {
\tif ( ! in_array( $format, array( 'json', 'xml' ), true ) ) {
\t\treturn 'json';
\t}

\treturn $format;
}

function wp_oembed_add_provider( $format, $provider, $regex = false ) {
\tif ( did_action( 'plugins_loaded' ) ) {
\t\t$oembed                       = _wp_oembed_get_object();
\t\t$oembed->providers[ $format ] = array( $provider, $regex );
\t} else {
\t\tWP_oEmbed::_add_provider_early( $format, $provider, $regex );
\t}
}

function wp_oembed_remove_provider( $format ) {
\tif ( did_action( 'plugins_loaded' ) ) {
\t\t$oembed = _wp_oembed_get_object();

\t\tif ( isset( $oembed->providers[ $format ] ) ) {
\t\t\tunset( $oembed->providers[ $format ] );
\t\t\treturn true;
\t\t}
\t} else {
\t\tWP_oEmbed::_remove_provider_early( $format );
\t}

\treturn false;
}

function wp_embed_handler_audio( $matches, $attr, $url, $rawattr ) {
\t$audio = sprintf( '[audio src="%s" /]', esc_url( $url ) );

\treturn apply_filters( 'wp_embed_handler_audio', $audio, $attr, $url, $rawattr );
}

function wp_embed_handler_video( $matches, $attr, $url, $rawattr ) {
\t$dimensions = '';
\tif ( ! empty( $rawattr['width'] ) && ! empty( $rawattr['height'] ) ) {
\t\t$dimensions .= sprintf( 'width="%d" ', (int) $rawattr['width'] );
\t\t$dimensions .= sprintf( 'height="%d" ', (int) $rawattr['height'] );
\t}
\t$video = sprintf( '[video %s src="%s" /]', $dimensions, esc_url( $url ) );

\treturn apply_filters( 'wp_embed_handler_video', $video, $attr, $url, $rawattr );
}
`;
}

function probeSource() {
  return `<?php
$mode = $argv[1];
$shell = $argv[2];

$GLOBALS['wphx_filter_log'] = array();
$GLOBALS['wphx_filter_overrides'] = array();
$GLOBALS['content_width'] = null;

function wphx_embed_truthy( $value ) {
\treturn (bool) $value;
}

function wphx_embed_array_set( &$array, $key, $value ) {
\t$array[ $key ] = $value;
}

function wphx_embed_array_unset( &$array, $key ) {
\tunset( $array[ $key ] );
}

class WP_oEmbed {
\tpublic $providers = array();
\tpublic static $early_providers = array();

\tpublic static function _add_provider_early( $format, $provider, $regex = false ) {
\t\tself::$early_providers['add'][ $format ] = array( $provider, $regex );
\t}

\tpublic static function _remove_provider_early( $format ) {
\t\tself::$early_providers['remove'][] = $format;
\t}
}

function _wp_oembed_get_object() {
\tstatic $oembed = null;
\tif ( null === $oembed ) {
\t\t$oembed = new WP_oEmbed();
\t}
\treturn $oembed;
}

function did_action( $hook_name ) {
\treturn $GLOBALS['wphx_did_actions'][ $hook_name ] ?? 0;
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

function rest_url( $path = '' ) {
\treturn 'https://example.test/wp-json/' . ltrim( $path, '/' );
}

function add_query_arg( $args, $url ) {
\t$query = array();
\tforeach ( $args as $key => $value ) {
\t\tif ( false !== $value ) {
\t\t\t$query[] = rawurlencode( $key ) . '=' . rawurlencode( $value );
\t\t}
\t}
\treturn $url . ( str_contains( $url, '?' ) ? '&' : '?' ) . implode( '&', $query );
}

function esc_url( $url ) {
\treturn str_replace( '&', '&amp;', (string) $url );
}

require $shell;

function wphx_case( $id, $content_width, $filters, $callback ) {
\t$GLOBALS['content_width'] = $content_width;
\t$GLOBALS['wphx_filter_log'] = array();
\t$GLOBALS['wphx_filter_overrides'] = $filters;
\t$GLOBALS['wphx_did_actions'] = array();
\tWP_oEmbed::$early_providers = array();
\t$oembed = _wp_oembed_get_object();
\t$oembed->providers = array();
\t$value = $callback();
\treturn array(
\t\t'id' => $id,
\t\t'value' => $value,
\t\t'providers' => $oembed->providers,
\t\t'early_providers' => WP_oEmbed::$early_providers,
\t\t'filters' => $GLOBALS['wphx_filter_log'],
\t);
}

$cases = array();
$cases[] = wphx_case( 'embed-defaults:fallback', null, array(), function () {
\treturn wp_embed_defaults( 'https://media.example/video' );
} );
$cases[] = wphx_case( 'embed-defaults:content-width', 640, array(), function () {
\treturn wp_embed_defaults( 'https://media.example/video' );
} );
$cases[] = wphx_case( 'embed-defaults:height-capped', 1200, array(), function () {
\treturn wp_embed_defaults( 'https://media.example/video' );
} );
$cases[] = wphx_case( 'embed-defaults:filtered', 320, array( 'embed_defaults' => array( 'width' => 111, 'height' => 222 ) ), function () {
\treturn wp_embed_defaults( 'https://media.example/video' );
} );
$cases[] = wphx_case( 'endpoint:base', null, array(), function () {
\treturn get_oembed_endpoint_url();
} );
$cases[] = wphx_case( 'endpoint:json', null, array(), function () {
\treturn get_oembed_endpoint_url( 'https://example.test/post/7/?a=1&b=2' );
} );
$cases[] = wphx_case( 'endpoint:xml', null, array(), function () {
\treturn get_oembed_endpoint_url( 'https://example.test/post/7/?a=1&b=2', 'xml' );
} );
$cases[] = wphx_case( 'endpoint:filtered', null, array( 'oembed_endpoint_url' => 'https://filtered.example/oembed' ), function () {
\treturn get_oembed_endpoint_url( 'https://example.test/post/7/', 'xml' );
} );
$cases[] = wphx_case( 'format:json', null, array(), function () {
\treturn wp_oembed_ensure_format( 'json' );
} );
$cases[] = wphx_case( 'format:xml', null, array(), function () {
\treturn wp_oembed_ensure_format( 'xml' );
} );
$cases[] = wphx_case( 'format:unknown', null, array(), function () {
\treturn wp_oembed_ensure_format( 'yaml' );
} );
$cases[] = wphx_case( 'provider:add-early', null, array(), function () {
\twp_oembed_add_provider( 'https://early.example/*', 'https://provider.example/oembed', true );
\treturn null;
} );
$cases[] = wphx_case( 'provider:remove-early', null, array(), function () {
\twp_oembed_remove_provider( 'https://early.example/*' );
\treturn null;
} );
$cases[] = wphx_case( 'provider:add-loaded', null, array(), function () {
\t$GLOBALS['wphx_did_actions']['plugins_loaded'] = 1;
\twp_oembed_add_provider( 'https://loaded.example/*', 'https://provider.example/loaded', false );
\treturn null;
} );
$cases[] = wphx_case( 'provider:remove-loaded-existing', null, array(), function () {
\t$GLOBALS['wphx_did_actions']['plugins_loaded'] = 1;
\t$oembed = _wp_oembed_get_object();
\t$oembed->providers['https://loaded.example/*'] = array( 'https://provider.example/loaded', false );
\treturn wp_oembed_remove_provider( 'https://loaded.example/*' );
} );
$cases[] = wphx_case( 'provider:remove-loaded-missing', null, array(), function () {
\t$GLOBALS['wphx_did_actions']['plugins_loaded'] = 1;
\treturn wp_oembed_remove_provider( 'https://missing.example/*' );
} );
$cases[] = wphx_case( 'audio:default', null, array(), function () {
\treturn wp_embed_handler_audio( array( 'match' ), array( 'width' => 300 ), 'https://cdn.example/audio.mp3?a=1&b=2', array() );
} );
$cases[] = wphx_case( 'audio:filtered', null, array( 'wp_embed_handler_audio' => 'Filtered Audio' ), function () {
\treturn wp_embed_handler_audio( array( 'match' ), array( 'width' => 300 ), 'https://cdn.example/audio.mp3', array() );
} );
$cases[] = wphx_case( 'video:default', null, array(), function () {
\treturn wp_embed_handler_video( array( 'match' ), array(), 'https://cdn.example/video.mp4?a=1&b=2', array( 'width' => 640, 'height' => 360 ) );
} );
$cases[] = wphx_case( 'video:no-dimensions', null, array(), function () {
\treturn wp_embed_handler_video( array( 'match' ), array(), 'https://cdn.example/video.mp4', array() );
} );
$cases[] = wphx_case( 'video:filtered', null, array( 'wp_embed_handler_video' => 'Filtered Video' ), function () {
\treturn wp_embed_handler_video( array( 'match' ), array(), 'https://cdn.example/video.mp4', array( 'width' => 640, 'height' => 360 ) );
} );

$reflection = array();
foreach ( array( 'wp_embed_defaults', 'get_oembed_endpoint_url', 'wp_oembed_ensure_format', 'wp_oembed_add_provider', 'wp_oembed_remove_provider', 'wp_embed_handler_audio', 'wp_embed_handler_video' ) as $function_name ) {
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
  mkdirSync(dirname(ORACLE_SHELL), { recursive: true });
  writeFileSync(ORACLE_SHELL, oracleSource());
  writeFileSync(PROBE, probeSource());

  run("haxe", [IMPL_HXML]);
  run("haxe", [SHELL_HXML]);

  const oracleLint = run("php", ["-l", ORACLE_SHELL]).trim();
  const generatedLint = run("php", ["-l", GENERATED_SHELL]).trim();
  const generatedSource = readFileSync(GENERATED_SHELL, "utf8");
  const missingPatterns = EXACT_PATTERNS.filter((pattern) => !generatedSource.includes(pattern));
  if (missingPatterns.length > 0) {
    throw new Error(`Generated embed module shell is missing exact patterns: ${JSON.stringify(missingPatterns)}`);
  }

  const oracle = JSON.parse(run("php", [PROBE, "oracle", ORACLE_SHELL]));
  const generated = JSON.parse(run("php", [PROBE, "generated", GENERATED_SHELL]));
  assertJsonEqual(normalizeProbe(generated), normalizeProbe(oracle), "embed module oracle/candidate probe");

  const emissionManifest = JSON.parse(readFileSync(EMISSION_MANIFEST, "utf8"));
  const declarations = emissionManifest.files.flatMap((file) => file.declarations.map((entry) => `${file.path}:${entry.kind}:${entry.name}`)).sort();
  const expectedDeclarations = [
    "wp-includes/embed.php:global-function:get_oembed_endpoint_url",
    "wp-includes/embed.php:global-function:wp_embed_defaults",
    "wp-includes/embed.php:global-function:wp_embed_handler_audio",
    "wp-includes/embed.php:global-function:wp_embed_handler_video",
    "wp-includes/embed.php:global-function:wp_oembed_add_provider",
    "wp-includes/embed.php:global-function:wp_oembed_ensure_format",
    "wp-includes/embed.php:global-function:wp_oembed_remove_provider"
  ];
  assertJsonEqual(declarations, expectedDeclarations, "embed module declarations");
  if ((emissionManifest.unsupported ?? []).length !== 0) {
    throw new Error(`Unexpected unsupported constructs: ${JSON.stringify(emissionManifest.unsupported)}`);
  }
  const guardedValues = emissionManifest.files.flatMap((file) => file.declarations.map((entry) => entry.guarded));
  if (guardedValues.some(Boolean)) {
    throw new Error(`Embed module functions must be unguarded WordPress module declarations: ${JSON.stringify(guardedValues)}`);
  }

  const manifest = {
    schema: "wphx.wphx-php-embed-module-functions.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "module_function_original_path_adapter",
    artifact_scope: "selected_wphx_312_04_embed_module_functions",
    inputs: [IMPL_HXML, SHELL_HXML, ...SOURCE_FILES].map(inputRecord),
    upstream_oracle: {
      repo_path: "../wordpress-develop/src/wp-includes/embed.php",
      selected_symbols: [
        "wp_embed_defaults",
        "get_oembed_endpoint_url",
        "wp_oembed_ensure_format",
        "wp_oembed_add_provider",
        "wp_oembed_remove_provider",
        "wp_embed_handler_audio",
        "wp_embed_handler_video"
      ],
      selected_source_lines: ["67-93", "455-481", "759-765", "147-158", "166-181", "272-294", "299-321"]
    },
    generated_shell: {
      path: GENERATED_SHELL,
      bytes: statSync(GENERATED_SHELL).size,
      sha256: sha256File(GENERATED_SHELL),
      php_lint: "passed",
      php_lint_output: generatedLint,
      exact_patterns: EXACT_PATTERNS
    },
    oracle_shell: {
      path: ORACLE_SHELL,
      bytes: statSync(ORACLE_SHELL).size,
      sha256: sha256File(ORACLE_SHELL),
      php_lint: "passed",
      php_lint_output: oracleLint
    },
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
      original_path_embed_php: true,
      haxe_bootstrap_delegation: true
    },
    claims: [
      "WPHX PHP emits selected unguarded module-level public functions at original path wp-includes/embed.php.",
      "The generated selected embed helpers preserve reflection-visible parameters/defaults for the selected fixture.",
      "The minimized oracle/candidate probe matches WordPress 7.0 behavior for embed defaults sizing and filters, oEmbed endpoint URL construction and filters, oEmbed format normalization, early and post-plugins-loaded provider add/remove registry behavior, local audio/video shortcode handler output, video dimensions, URL escaping, and filter payloads."
    ],
    non_claims: [
      "This fixture does not claim full wp-includes/embed.php ownership.",
      "This fixture does not retire the WPHX-312.04 copied feed/embed/HTTPS oracle fixture.",
      "This fixture does not claim WP_Embed or WP_oEmbed class method ownership beyond the narrow provider registry interaction required by selected module functions, remote oEmbed discovery/fetch, REST controller dispatch, _oembed_create_xml(), post embed rendering, installed WordPress behavior, or arbitrary module-function lowering beyond the selected original-path embed helpers."
    ]
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const receipt = {
    schema: "wphx.compiler-receipt.v1",
    id: "receipt:wphx-comp-php-embed-module-functions",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "passed",
    evidence_class: "module_function_original_path_adapter",
    artifact_scope: "selected_wphx_312_04_embed_module_functions",
    commands: ["npm run wphx:php:embed-module-functions", "npm run wphx:php:embed-module-functions:check"],
    artifacts: [
      { path: RUNNER, role: "deterministic embed module function adapter runner" },
      { path: SHELL_HXML, role: "WPHX PHP original-path embed module shell hxml" },
      { path: IMPL_HXML, role: "stock Haxe PHP embed helper implementation hxml" },
      { path: "fixtures/wphx-php/src/wphx/fixtures/compiler/php/embed/EmbedModuleSurface.hx", role: "typed Haxe public embed.php module-function shell metadata" },
      { path: "fixtures/wphx-php/src/wphx/fixtures/php/embed/EmbedKernel.hx", role: "typed Haxe embed helper behavior" },
      { path: MANIFEST, role: "embed module function adapter manifest" }
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
        generated_shell: GENERATED_SHELL,
        selected_symbols: manifest.upstream_oracle.selected_symbols
      },
      null,
      2
    )
  );
}

main();
