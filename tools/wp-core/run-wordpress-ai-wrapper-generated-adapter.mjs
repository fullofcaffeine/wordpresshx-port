#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.33.3",
  external_ref: "WPHX-323.25",
  title: "Emit first generated AI wrapper adapter"
};
const RECORDED_AT = "2026-07-08T22:45:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-wordpress-ai-wrapper-generated-adapter.mjs";
const HXML = "fixtures/wphx-php/ai-client-wrapper.hxml";
const OUT_ROOT = "build/wp-core/wphx-323-25";
const GENERATED_ROOT = `${OUT_ROOT}/generated`;
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/wordpress-ai-wrapper-generated-probe.php`;
const GENERATED_SHELL = `${GENERATED_ROOT}/wp-includes/ai-client.php`;
const EMISSION_MANIFEST = `${GENERATED_ROOT}/wphx-php-emission.v1.json`;
const GENERATED_SHELL_ARTIFACT = "build/wp-core/wphx-323-25/generated/wp-includes/ai-client.php";
const EMISSION_MANIFEST_ARTIFACT = "build/wp-core/wphx-323-25/generated/wphx-php-emission.v1.json";
const UPSTREAM_LOCK = "upstream.lock.json";
const AI_TINYMCE_GATES = "manifests/wp-core/wphx-323-07-ai-client-tinymce-vendor-gates.v1.json";
const WORDPRESS_AI_WRAPPER_SURFACE = "manifests/wp-core/wphx-323-24-wordpress-ai-wrapper-api-surface.v1.json";
const PHP_AI_CLIENT_SUB_BOUNDARIES = "manifests/wp-core/wphx-323-23-php-ai-client-sub-boundaries.v1.json";
const OUT = "manifests/wp-core/wphx-323-25-wordpress-ai-wrapper-generated-adapter.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-25-wordpress-ai-wrapper-generated-adapter.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-25-wordpress-ai-wrapper-generated-adapter.v1.json";

const AI_CLIENT_SOURCE = "src/wp-includes/ai-client.php";
const AI_CLIENT_DISTRIBUTION = "wp-includes/ai-client.php";
const PHP_AI_CLIENT_ROOT = "src/wp-includes/php-ai-client";
const WORDPRESS_AI_SUPPORT_FILES = [
  "src/wp-includes/ai-client/adapters/class-wp-ai-client-cache.php",
  "src/wp-includes/ai-client/adapters/class-wp-ai-client-discovery-strategy.php",
  "src/wp-includes/ai-client/adapters/class-wp-ai-client-event-dispatcher.php",
  "src/wp-includes/ai-client/adapters/class-wp-ai-client-http-client.php",
  "src/wp-includes/ai-client/class-wp-ai-client-ability-function-resolver.php",
  "src/wp-includes/ai-client/class-wp-ai-client-prompt-builder.php"
];
const PROBE_MODES = [
  "include_load",
  "support_filter",
  "support_disabled_constant",
  "prompt_prevent_filter",
  "prompt_disabled_constant"
];
const EXPECTED_GENERATED_PATTERNS = [
  "function wp_supports_ai(): bool",
  "defined('WP_AI_SUPPORT')",
  "boolval(constant('WP_AI_SUPPORT')) == false",
  "boolval(apply_filters('wp_supports_ai', true))",
  "function wp_ai_client_prompt($prompt = null): WP_AI_Client_Prompt_Builder",
  "new WP_AI_Client_Prompt_Builder(\\WordPress\\AiClient\\AiClient::defaultRegistry(), $prompt)"
];
const COMPILER_SOURCE_FILES = [
  "src/wphx/compiler/php/WphxPhpCompiler.hx",
  "src/wphx/compiler/php/CompilerInit.hx",
  "src/wphx/wp/ai/AiClientWrapperEntry.hx",
  "src/wphx/wp/ai/AiClientWrapperSurface.hx",
  "src/wphx/wp/boundary/NativeValue.hx",
  HXML
];
const NON_CLAIMS = [
  "This gate does not claim Haxe-owned php-ai-client internals; wp-includes/php-ai-client/ remains preserved bundled-library support for this adapter.",
  "This gate does not claim generated replacement for wp-includes/ai-client/* support classes.",
  "This gate does not claim live provider behavior, external provider discovery parity, model generation parity, installed WordPress AI behavior, credential handling safety, prompt/file privacy, or plugin ecosystem compatibility.",
  "This gate does not claim third-party dependency substitution, unscoping, deduplication, Composer replacement, or copied artifact retirement for WordPress\\AiClientDependencies.",
  "This gate does not claim whole-file WordPress AI ownership beyond the two generated global functions in wp-includes/ai-client.php.",
  "This gate does not use a copied candidate body for wp-includes/ai-client.php."
];

function command(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 120
  }).trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function fileRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function upstreamPath(path) {
  return `${UPSTREAM_ROOT}/${path}`;
}

function sourceToDistribution(path) {
  return path.startsWith("src/") ? path.slice("src/".length) : path;
}

function mirrorPath(root, path) {
  return `${root}/${sourceToDistribution(path)}`;
}

function listFiles(path) {
  const full = upstreamPath(path);
  const stat = statSync(full);
  if (stat.isFile()) return [path];
  return readdirSync(full, { withFileTypes: true })
    .flatMap((entry) => listFiles(`${path}/${entry.name}`))
    .sort();
}

function listRelativeFiles(root, prefix = "") {
  const full = prefix ? `${root}/${prefix}` : root;
  return readdirSync(full, { withFileTypes: true })
    .flatMap((entry) => {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory() ? listRelativeFiles(root, path) : [path];
    })
    .sort();
}

function mirrorOracle() {
  cpSync(upstreamPath(PHP_AI_CLIENT_ROOT), mirrorPath(ORACLE_ROOT, PHP_AI_CLIENT_ROOT), { recursive: true });
  for (const path of [AI_CLIENT_SOURCE, ...WORDPRESS_AI_SUPPORT_FILES]) {
    mkdirSync(dirname(mirrorPath(ORACLE_ROOT, path)), { recursive: true });
    copyFileSync(upstreamPath(path), mirrorPath(ORACLE_ROOT, path));
  }
}

function mirrorCandidate() {
  cpSync(upstreamPath(PHP_AI_CLIENT_ROOT), mirrorPath(CANDIDATE_ROOT, PHP_AI_CLIENT_ROOT), { recursive: true });
  for (const path of WORDPRESS_AI_SUPPORT_FILES) {
    mkdirSync(dirname(mirrorPath(CANDIDATE_ROOT, path)), { recursive: true });
    copyFileSync(upstreamPath(path), mirrorPath(CANDIDATE_ROOT, path));
  }
  mkdirSync(dirname(`${CANDIDATE_ROOT}/${AI_CLIENT_DISTRIBUTION}`), { recursive: true });
  copyFileSync(GENERATED_SHELL, `${CANDIDATE_ROOT}/${AI_CLIENT_DISTRIBUTION}`);
}

function currentWordPressCheckout(upstreamLock) {
  const wordpressRepo = upstreamLock.repositories.find((repo) => repo.id === "wordpress-vanilla");
  if (!wordpressRepo) throw new Error("upstream.lock.json is missing wordpress-vanilla");
  const currentCommit = command("git", ["-C", UPSTREAM_ROOT, "rev-parse", "HEAD"]);
  const currentTree = command("git", ["-C", UPSTREAM_ROOT, "rev-parse", "HEAD^{tree}"]);
  const statusText = command("git", ["-C", UPSTREAM_ROOT, "status", "--short"]);
  if (currentCommit !== wordpressRepo.git.commit) {
    throw new Error(`wordpress-develop commit drift: lock=${wordpressRepo.git.commit} actual=${currentCommit}`);
  }
  if (currentTree !== wordpressRepo.git.tree) {
    throw new Error(`wordpress-develop tree drift: lock=${wordpressRepo.git.tree} actual=${currentTree}`);
  }
  return {
    relative_path: wordpressRepo.relativePath,
    authority: wordpressRepo.authority,
    role: wordpressRepo.role,
    locked_commit: wordpressRepo.git.commit,
    locked_tree: wordpressRepo.git.tree,
    locked_tag: wordpressRepo.git.tag,
    current_commit: currentCommit,
    current_tree: currentTree,
    observed_dirty_state_from_lock: wordpressRepo.observedDirtyState,
    current_status_short: statusText ? statusText.split("\n") : []
  };
}

function reflectionSummary(functionName) {
  return `function wphx_323_25_reflection_${functionName}() {
\t$reflection = new ReflectionFunction('${functionName}');
\t$params = array();
\tforeach ( $reflection->getParameters() as $parameter ) {
\t\t$type = $parameter->getType();
\t\t$params[] = array(
\t\t\t'name' => $parameter->getName(),
\t\t\t'position' => $parameter->getPosition(),
\t\t\t'isOptional' => $parameter->isOptional(),
\t\t\t'hasDefault' => $parameter->isDefaultValueAvailable(),
\t\t\t'default' => $parameter->isDefaultValueAvailable() ? $parameter->getDefaultValue() : null,
\t\t\t'hasType' => $parameter->hasType(),
\t\t\t'type' => $type ? array(
\t\t\t\t'name' => $type instanceof ReflectionNamedType ? $type->getName() : (string) $type,
\t\t\t\t'allowsNull' => $type->allowsNull(),
\t\t\t\t'isBuiltin' => $type instanceof ReflectionNamedType ? $type->isBuiltin() : null,
\t\t\t) : null,
\t\t\t'isPassedByReference' => $parameter->isPassedByReference(),
\t\t\t'isVariadic' => $parameter->isVariadic(),
\t\t);
\t}
\t$return_type = $reflection->getReturnType();
\treturn array(
\t\t'name' => $reflection->getName(),
\t\t'numberOfParameters' => $reflection->getNumberOfParameters(),
\t\t'numberOfRequiredParameters' => $reflection->getNumberOfRequiredParameters(),
\t\t'returnsReference' => $reflection->returnsReference(),
\t\t'hasReturnType' => $reflection->hasReturnType(),
\t\t'returnType' => $return_type ? array(
\t\t\t'name' => $return_type instanceof ReflectionNamedType ? $return_type->getName() : (string) $return_type,
\t\t\t'allowsNull' => $return_type->allowsNull(),
\t\t\t'isBuiltin' => $return_type instanceof ReflectionNamedType ? $return_type->isBuiltin() : null,
\t\t) : null,
\t\t'parameters' => $params,
\t);
}`;
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
$root = rtrim( $argv[1], '/\\\\' );
$mode = $argv[2] ?? '';

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
if ( in_array( $mode, array( 'support_disabled_constant', 'prompt_disabled_constant' ), true ) ) {
\tdefine( 'WP_AI_SUPPORT', false );
}

$GLOBALS['wphx_323_25_errors'] = array();
$GLOBALS['wphx_323_25_filters'] = array();
$GLOBALS['wphx_323_25_filter_log'] = array();
$GLOBALS['wphx_323_25_doing_it_wrong'] = array();

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\tif ( E_USER_DEPRECATED === $errno ) {
\t\t\treturn true;
\t\t}
\t\t$GLOBALS['wphx_323_25_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

class WP_Error {
\tprivate string $code;
\tprivate string $message;
\tprivate $data;
\tpublic function __construct( $code = '', $message = '', $data = null ) {
\t\t$this->code = (string) $code;
\t\t$this->message = (string) $message;
\t\t$this->data = $data;
\t}
\tpublic function get_error_code() { return $this->code; }
\tpublic function get_error_message() { return $this->message; }
\tpublic function get_error_data() { return $this->data; }
}

function __( $text ) { return $text; }
function esc_html( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function is_wp_error( $thing ) { return $thing instanceof WP_Error; }
function _doing_it_wrong( $function_name, $message, $version ) {
\t$GLOBALS['wphx_323_25_doing_it_wrong'][] = compact( 'function_name', 'message', 'version' );
}

function add_filter( $tag, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wphx_323_25_filters'][ $tag ][ $priority ][] = array( $callback, $accepted_args );
}

function apply_filters( $tag, $value, ...$args ) {
\t$GLOBALS['wphx_323_25_filter_log'][] = array(
\t\t'tag' => $tag,
\t\t'value' => wphx_323_25_json_value( $value ),
\t\t'args' => array_map( 'wphx_323_25_json_value', $args ),
\t);
\tif ( empty( $GLOBALS['wphx_323_25_filters'][ $tag ] ) ) {
\t\treturn $value;
\t}
\tksort( $GLOBALS['wphx_323_25_filters'][ $tag ] );
\tforeach ( $GLOBALS['wphx_323_25_filters'][ $tag ] as $callbacks ) {
\t\tforeach ( $callbacks as $entry ) {
\t\t\t$callback = $entry[0];
\t\t\t$accepted = $entry[1];
\t\t\t$value = $callback( ...array_slice( array_merge( array( $value ), $args ), 0, $accepted ) );
\t\t}
\t}
\treturn $value;
}

function wphx_323_25_json_value( $value ) {
\tif ( $value instanceof WP_Error ) {
\t\treturn array( 'kind' => 'WP_Error', 'code' => $value->get_error_code(), 'message' => $value->get_error_message(), 'data' => $value->get_error_data() );
\t}
\tif ( is_object( $value ) ) {
\t\treturn array( 'kind' => 'object', 'class' => get_class( $value ), 'id' => spl_object_id( $value ) );
\t}
\tif ( is_resource( $value ) ) {
\t\treturn array( 'kind' => 'resource', 'type' => get_resource_type( $value ) );
\t}
\treturn $value;
}

function wphx_323_25_wp_error_record( $value ) {
\tif ( $value instanceof WP_Error ) {
\t\treturn array(
\t\t\t'is_wp_error' => true,
\t\t\t'code' => $value->get_error_code(),
\t\t\t'message' => $value->get_error_message(),
\t\t\t'data' => $value->get_error_data(),
\t\t);
\t}
\treturn array( 'is_wp_error' => false, 'value' => wphx_323_25_json_value( $value ) );
}

function wphx_323_25_require_ai_client_api() {
\trequire_once ABSPATH . WPINC . '/php-ai-client/autoload.php';
\trequire_once ABSPATH . WPINC . '/ai-client/class-wp-ai-client-prompt-builder.php';
\trequire_once ABSPATH . WPINC . '/ai-client.php';
}

${reflectionSummary("wp_supports_ai")}
${reflectionSummary("wp_ai_client_prompt")}

function wphx_323_25_include_load_case(): array {
\t$before = array(
\t\t'wp_supports_ai' => function_exists( 'wp_supports_ai' ),
\t\t'wp_ai_client_prompt' => function_exists( 'wp_ai_client_prompt' ),
\t);
\t$first = require_once ABSPATH . WPINC . '/ai-client.php';
\t$after_first = array(
\t\t'wp_supports_ai' => function_exists( 'wp_supports_ai' ),
\t\t'wp_ai_client_prompt' => function_exists( 'wp_ai_client_prompt' ),
\t);
\t$second = require_once ABSPATH . WPINC . '/ai-client.php';
\treturn array(
\t\t'before' => $before,
\t\t'afterFirstRequire' => $after_first,
\t\t'firstRequire' => wphx_323_25_json_value( $first ),
\t\t'secondRequire' => wphx_323_25_json_value( $second ),
\t\t'reflection' => array(
\t\t\t'wp_supports_ai' => wphx_323_25_reflection_wp_supports_ai(),
\t\t\t'wp_ai_client_prompt' => wphx_323_25_reflection_wp_ai_client_prompt(),
\t\t),
\t);
}

function wphx_323_25_support_filter_case(): array {
\trequire_once ABSPATH . WPINC . '/ai-client.php';
\t$default = wp_supports_ai();
\tadd_filter( 'wp_supports_ai', fn( $enabled ) => 0, 10, 1 );
\t$filtered_false = wp_supports_ai();
\t$GLOBALS['wphx_323_25_filters']['wp_supports_ai'] = array();
\tadd_filter( 'wp_supports_ai', fn( $enabled ) => 'enabled-by-filter', 10, 1 );
\t$filtered_true = wp_supports_ai();
\treturn array(
\t\t'default' => $default,
\t\t'filtered_false' => $filtered_false,
\t\t'filtered_true' => $filtered_true,
\t\t'filter_log' => $GLOBALS['wphx_323_25_filter_log'],
\t);
}

function wphx_323_25_support_disabled_constant_case(): array {
\trequire_once ABSPATH . WPINC . '/ai-client.php';
\tadd_filter( 'wp_supports_ai', fn( $enabled ) => true, 10, 1 );
\treturn array(
\t\t'wp_ai_support_defined' => defined( 'WP_AI_SUPPORT' ),
\t\t'wp_ai_support_value' => defined( 'WP_AI_SUPPORT' ) ? WP_AI_SUPPORT : null,
\t\t'result' => wp_supports_ai(),
\t\t'filter_log_count' => count( $GLOBALS['wphx_323_25_filter_log'] ),
\t);
}

function wphx_323_25_prompt_prevent_filter_case(): array {
\twphx_323_25_require_ai_client_api();
\t$timeout_values = array();
\t$prevent_payloads = array();
\tadd_filter(
\t\t'wp_ai_client_default_request_timeout',
\t\tfunction ( $timeout ) use ( &$timeout_values ) {
\t\t\t$timeout_values[] = $timeout;
\t\t\treturn 7.25;
\t\t},
\t\t10,
\t\t1
\t);
\tadd_filter(
\t\t'wp_ai_client_prevent_prompt',
\t\tfunction ( $prevent, $builder ) use ( &$prevent_payloads ) {
\t\t\t$prevent_payloads[] = array(
\t\t\t\t'prevent_in' => $prevent,
\t\t\t\t'builder_class' => get_class( $builder ),
\t\t\t\t'builder_id' => spl_object_id( $builder ),
\t\t\t);
\t\t\treturn true;
\t\t},
\t\t10,
\t\t2
\t);
\t$builder = wp_ai_client_prompt( 'Write a fixture sentence.' );
\t$builder_id = spl_object_id( $builder );
\t$supported = $builder->is_supported_for_text_generation();
\t$generated = $builder->generate_text();
\t$chain = $builder->using_temperature( 0.3 );
\treturn array(
\t\t'builder_class' => get_class( $builder ),
\t\t'builder_id' => $builder_id,
\t\t'supported' => $supported,
\t\t'generated' => wphx_323_25_wp_error_record( $generated ),
\t\t'chain_returns_same_instance' => $chain === $builder,
\t\t'timeout_filter_values' => $timeout_values,
\t\t'prevent_payloads' => $prevent_payloads,
\t\t'filter_log' => $GLOBALS['wphx_323_25_filter_log'],
\t\t'doing_it_wrong' => $GLOBALS['wphx_323_25_doing_it_wrong'],
\t);
}

function wphx_323_25_prompt_disabled_constant_case(): array {
\twphx_323_25_require_ai_client_api();
\t$builder = wp_ai_client_prompt();
\t$supported = $builder->is_supported_for_text_generation();
\t$generated = $builder->generate_text();
\treturn array(
\t\t'builder_class' => get_class( $builder ),
\t\t'supported' => $supported,
\t\t'generated' => wphx_323_25_wp_error_record( $generated ),
\t\t'filter_log' => $GLOBALS['wphx_323_25_filter_log'],
\t);
}

$map = array(
\t'include_load' => 'wphx_323_25_include_load_case',
\t'support_filter' => 'wphx_323_25_support_filter_case',
\t'support_disabled_constant' => 'wphx_323_25_support_disabled_constant_case',
\t'prompt_prevent_filter' => 'wphx_323_25_prompt_prevent_filter_case',
\t'prompt_disabled_constant' => 'wphx_323_25_prompt_disabled_constant_case',
);

if ( ! isset( $map[ $mode ] ) ) {
\tfwrite( STDERR, 'Unknown probe mode: ' . $mode . PHP_EOL );
\texit( 2 );
}

$result = call_user_func( $map[ $mode ] );
echo json_encode(
\tarray(
\t\t'mode' => $mode,
\t\t'case' => $result,
\t\t'php_errors' => $GLOBALS['wphx_323_25_errors'],
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
);
`
  );
}

function runProbe(root, mode) {
  return JSON.parse(command("php", [PROBE, root, mode]));
}

function runAllProbes(root) {
  return Object.fromEntries(PROBE_MODES.map((mode) => [mode, runProbe(root, mode)]));
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

function lintFiles(paths, root) {
  return paths.map((path) => {
    const output = command("php", ["-l", `${root}/${path}`]);
    return {
      path,
      ok: output.includes("No syntax errors detected"),
      output
    };
  });
}

function packageDiffs(oracleRoot, candidateRoot) {
  const oracleFiles = listRelativeFiles(oracleRoot);
  const candidateFiles = listRelativeFiles(candidateRoot);
  const all = Array.from(new Set([...oracleFiles, ...candidateFiles])).sort();
  return all
    .map((path) => {
      const oraclePath = `${oracleRoot}/${path}`;
      const candidatePath = `${candidateRoot}/${path}`;
      const oracleExists = existsSync(oraclePath);
      const candidateExists = existsSync(candidatePath);
      if (!oracleExists || !candidateExists) {
        return {
          path,
          kind: oracleExists ? "missing_from_candidate" : "extra_in_candidate"
        };
      }
      const oracleSha = sha256File(oraclePath);
      const candidateSha = sha256File(candidatePath);
      if (oracleSha === candidateSha) {
        return null;
      }
      return {
        path,
        kind: "hash_mismatch",
        oracle_sha256: oracleSha,
        candidate_sha256: candidateSha
      };
    })
    .filter(Boolean);
}

function assertGeneratedShell(generatedSource, upstreamSource, emissionManifest) {
  const missing = EXPECTED_GENERATED_PATTERNS.filter((pattern) => !generatedSource.includes(pattern));
  if (missing.length > 0) {
    throw new Error(`Generated AI wrapper shell is missing patterns: ${JSON.stringify(missing)}`);
  }
  if (generatedSource === upstreamSource) {
    throw new Error("Generated AI wrapper shell unexpectedly matches the upstream source byte-for-byte");
  }
  if (emissionManifest.unsupported.length !== 0) {
    throw new Error(`Unexpected WPHX PHP unsupported constructs: ${JSON.stringify(emissionManifest.unsupported)}`);
  }
  const declarations = emissionManifest.files.flatMap((file) => file.declarations.map((entry) => `${entry.kind}:${entry.name}`));
  const expectedDeclarations = ["global-function:wp_supports_ai", "global-function:wp_ai_client_prompt"];
  if (JSON.stringify(declarations) !== JSON.stringify(expectedDeclarations)) {
    throw new Error(`Unexpected generated declarations: ${JSON.stringify(declarations)}`);
  }
}

function main() {
  const upstreamLock = readJson(UPSTREAM_LOCK);
  const wordpressCheckout = currentWordPressCheckout(upstreamLock);
  const aiTinymceGate = readJson(AI_TINYMCE_GATES);
  const wrapperSurface = readJson(WORDPRESS_AI_WRAPPER_SURFACE);
  const phpAiClientSubBoundaries = readJson(PHP_AI_CLIENT_SUB_BOUNDARIES);

  rmSync(OUT_ROOT, { recursive: true, force: true });
  mkdirSync(OUT_ROOT, { recursive: true });

  command("haxe", [HXML]);
  const generatedLint = command("php", ["-l", GENERATED_SHELL]);
  const generatedSource = readFileSync(GENERATED_SHELL, "utf8");
  const upstreamSource = readFileSync(upstreamPath(AI_CLIENT_SOURCE), "utf8");
  const emissionManifest = readJson(EMISSION_MANIFEST);
  assertGeneratedShell(generatedSource, upstreamSource, emissionManifest);

  mirrorOracle();
  mirrorCandidate();
  writeProbe();

  const packageFiles = listRelativeFiles(CANDIDATE_ROOT);
  const lint = lintFiles(packageFiles, CANDIDATE_ROOT);
  const lintFailures = lint.filter((entry) => !entry.ok);
  if (lintFailures.length > 0) {
    throw new Error(`Candidate package PHP lint failures: ${JSON.stringify(lintFailures, null, 2)}`);
  }

  const oracle = runAllProbes(ORACLE_ROOT);
  const candidate = runAllProbes(CANDIDATE_ROOT);
  const observation_matches = Object.fromEntries(
    PROBE_MODES.map((mode) => [mode, JSON.stringify(oracle[mode]) === JSON.stringify(candidate[mode])])
  );
  const failedModes = Object.entries(observation_matches)
    .filter(([, matched]) => !matched)
    .map(([mode]) => mode);
  if (failedModes.length > 0) {
    throw new Error(`Oracle/candidate AI wrapper probes diverged: ${failedModes.join(", ")}`);
  }

  const diffs = packageDiffs(ORACLE_ROOT, CANDIDATE_ROOT);
  const expectedDiffs = diffs.filter((diff) => diff.path === AI_CLIENT_DISTRIBUTION);
  const unexpectedDiffs = diffs.filter((diff) => diff.path !== AI_CLIENT_DISTRIBUTION);
  if (expectedDiffs.length !== 1 || expectedDiffs[0].kind !== "hash_mismatch") {
    throw new Error(`Expected exactly one generated overlay diff for ${AI_CLIENT_DISTRIBUTION}, found ${JSON.stringify(expectedDiffs)}`);
  }
  if (unexpectedDiffs.length > 0) {
    throw new Error(`Unexpected candidate package differences: ${JSON.stringify(unexpectedDiffs, null, 2)}`);
  }

  const phpAiClientFiles = listFiles(PHP_AI_CLIENT_ROOT).filter((path) => path.endsWith(".php"));
  const supportFiles = WORDPRESS_AI_SUPPORT_FILES.map(sourceToDistribution);
  const overlay = {
    path: AI_CLIENT_DISTRIBUTION,
    source_path: AI_CLIENT_SOURCE,
    replaced_upstream: {
      repo: UPSTREAM_ROOT,
      commit: wordpressCheckout.current_commit,
      path: AI_CLIENT_SOURCE,
      sha256: sha256(upstreamSource),
      bytes: Buffer.byteLength(upstreamSource)
    },
    generated_candidate: {
      path: GENERATED_SHELL_ARTIFACT,
      package_path: `${CANDIDATE_ROOT}/${AI_CLIENT_DISTRIBUTION}`,
      sha256: sha256File(GENERATED_SHELL),
      bytes: statSync(GENERATED_SHELL).size,
      expected_patterns: EXPECTED_GENERATED_PATTERNS,
      copied_candidate_body_used: false
    },
    compiler_provenance: {
      generator: "wphx.compiler.php.WphxPhpCompiler",
      runner: RUNNER,
      hxml: HXML,
      compiler_source: COMPILER_SOURCE_FILES.map(fileRecord),
      adapter_source: fileRecord("src/wphx/wp/ai/AiClientWrapperSurface.hx"),
      adapter_entry: fileRecord("src/wphx/wp/ai/AiClientWrapperEntry.hx")
    },
    adapter_manifest: {
      path: EMISSION_MANIFEST_ARTIFACT,
      sha256: sha256File(EMISSION_MANIFEST),
      unsupported: emissionManifest.unsupported,
      unsupported_empty: emissionManifest.unsupported.length === 0,
      declarations: emissionManifest.files.flatMap((file) => file.declarations)
    },
    unexpected_candidate_package_differences: unexpectedDiffs
  };

  const validationResult = {
    status: "passed",
    generated_overlay_manifest_present: true,
    generated_overlay_count: 1,
    generated_shell_php_lint: generatedLint,
    generated_shell_php_lint_ok: generatedLint.includes("No syntax errors detected"),
    candidate_package_php_lint_file_count: lint.length,
    candidate_package_php_lint_ok: lint.every((entry) => entry.ok),
    unsupported_empty: emissionManifest.unsupported.length === 0,
    abi_reflection_match: observation_matches.include_load,
    include_load_fixture_match: observation_matches.include_load,
    oracle_candidate_observations_match: failedModes.length === 0,
    probe_case_count: PROBE_MODES.length,
    expected_candidate_package_difference_count: expectedDiffs.length,
    unexpected_candidate_package_differences_empty: unexpectedDiffs.length === 0,
    copied_candidate_body_used: false,
    preserved_php_ai_client_support_file_count: phpAiClientFiles.length,
    copied_support_wrapper_file_count: supportFiles.length,
    public_php_replacement_claimed: true,
    whole_file_owned: false,
    installed_wordpress_parity_claimed: false,
    live_provider_behavior_claimed: false,
    dependency_substitution_claimed: false
  };

  const manifest = {
    schema: "wphx.wp-core.generated-overlay.v1",
    id: "wphx-323-25-wordpress-ai-wrapper-generated-adapter",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "wphx_php_generated_original_path_ai_wrapper_adapter",
    behavior_parity_claimed: true,
    generated_public_php_replacement_claimed: true,
    durable_original_path_adapter_claimed: false,
    whole_file_owned: false,
    installed_wordpress_parity_claimed: false,
    live_provider_behavior_claimed: false,
    dependency_substitution_claimed: false,
    copied_artifact_retirement_claimed: false,
    inputs: {
      runner: fileRecord(RUNNER),
      hxml: fileRecord(HXML),
      upstream_lock: fileRecord(UPSTREAM_LOCK),
      ai_tinymce_gate_manifest: fileRecord(AI_TINYMCE_GATES),
      wordpress_ai_wrapper_surface_manifest: fileRecord(WORDPRESS_AI_WRAPPER_SURFACE),
      php_ai_client_sub_boundaries_manifest: fileRecord(PHP_AI_CLIENT_SUB_BOUNDARIES)
    },
    upstream_authority: wordpressCheckout,
    dependency_context: {
      ai_tinymce_gate_state: aiTinymceGate.validation_result?.status,
      wordpress_ai_wrapper_surface_state: wrapperSurface.validation_result?.status,
      php_ai_client_sub_boundary_state: phpAiClientSubBoundaries.validation_result?.status,
      preserved_php_ai_client_support_file_count: phpAiClientFiles.length
    },
    generated_overlays: [overlay],
    support_package: {
      oracle_root: ORACLE_ROOT,
      candidate_root: CANDIDATE_ROOT,
      preserved_php_ai_client_root: sourceToDistribution(PHP_AI_CLIENT_ROOT),
      preserved_php_ai_client_support_file_count: phpAiClientFiles.length,
      copied_wordpress_ai_support_files: supportFiles,
      expected_candidate_package_differences: expectedDiffs,
      unexpected_candidate_package_differences: unexpectedDiffs
    },
    php_lint: {
      generated_shell: {
        path: GENERATED_SHELL_ARTIFACT,
        output: generatedLint,
        ok: generatedLint.includes("No syntax errors detected")
      },
      candidate_package: lint
    },
    abi_reflection_snapshots: {
      oracle: oracle.include_load.case.reflection,
      candidate: candidate.include_load.case.reflection,
      match: observation_matches.include_load
    },
    include_load_fixture: {
      oracle: oracle.include_load.case,
      candidate: candidate.include_load.case,
      match: observation_matches.include_load
    },
    behavior_receipt: {
      modes: PROBE_MODES.filter((mode) => mode !== "include_load"),
      oracle,
      candidate,
      observation_matches
    },
    validation_result: validationResult,
    claims: [
      "WPHX PHP emits wp-includes/ai-client.php at the original WordPress distribution path for wp_supports_ai and wp_ai_client_prompt.",
      "The generated candidate has unsupported=[] and passes PHP lint.",
      "Reflection snapshots match the upstream wrapper ABI for the two generated global functions, including return types.",
      "Oracle and generated candidate observations match for include/load, wp_supports_ai filters/disabled constant behavior, and wp_ai_client_prompt prompt-builder behavior over preserved php-ai-client internals.",
      "The candidate package differs from the oracle package only at the expected generated overlay path wp-includes/ai-client.php."
    ],
    non_claims: NON_CLAIMS
  };
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestContent);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-25-wordpress-ai-wrapper-generated-adapter",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    unit: {
      kind: "generated_original_path_public_adapter",
      name: "WordPress AI client wrapper generated adapter",
      area: "wp-includes/ai-client.php",
      public_contract: "WPHX PHP emits the original-path public functions wp_supports_ai and wp_ai_client_prompt while preserved upstream php-ai-client internals and WordPress AI support classes remain copied support for this gate."
    },
    ownership_state: "compiler_emitted_original_path_shell",
    bridge: {
      exists: true,
      kind: "wphx-php-generated-overlay-over-preserved-php-ai-client-support",
      removal_gate:
        "Promote to durable_public_adapter only after the remaining wp-includes/ai-client/* wrappers have generated overlays or explicit preservation decisions, selected upstream PHPUnit and installed WordPress AI gates pass, and live provider/privacy/security gates are resolved."
    },
    whole_file_owned: false,
    behavior_parity_claimed: true,
    public_php_replacement_claimed: true,
    durable_original_path_adapter_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false,
    generated_overlay_manifest_present: true,
    generated_overlay_paths: [OUT],
    generated_overlay_count: 1,
    preserved_php_ai_client_internals: true,
    owned_paths: [
      RUNNER,
      HXML,
      "src/wphx/wp/ai/AiClientWrapperEntry.hx",
      "src/wphx/wp/ai/AiClientWrapperSurface.hx",
      OUT,
      OWNERSHIP,
      RECEIPT
    ],
    generated_paths: [
      OUT,
      OWNERSHIP,
      RECEIPT,
      GENERATED_SHELL_ARTIFACT,
      EMISSION_MANIFEST_ARTIFACT,
      OUT_ROOT
    ],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-323-wordpress-ai-wrapper-generated-adapter",
        "npm run wp:core:wphx-323-wordpress-ai-wrapper-generated-adapter:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-323-25-wordpress-ai-wrapper-generated-adapter"],
      manifest_digest: sha256(manifestContent)
    },
    non_claims: NON_CLAIMS
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-25-wordpress-ai-wrapper-generated-adapter",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: manifest.evidence_class,
    artifact_scope: "wordpress-7.0-wordpress-ai-wrapper-generated-overlay",
    commands: [
      "npm run wp:core:wphx-323-wordpress-ai-wrapper-generated-adapter",
      "npm run wp:core:wphx-323-wordpress-ai-wrapper-generated-adapter:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      generated_shell: GENERATED_SHELL_ARTIFACT,
      emission_manifest: EMISSION_MANIFEST_ARTIFACT,
      ai_tinymce_gate_manifest: AI_TINYMCE_GATES,
      wordpress_ai_wrapper_surface_manifest: WORDPRESS_AI_WRAPPER_SURFACE,
      php_ai_client_sub_boundaries_manifest: PHP_AI_CLIENT_SUB_BOUNDARIES
    },
    manifest_sha256: sha256(manifestContent),
    validation_result: validationResult,
    generated_overlay: overlay,
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };
  writeOrCheck(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);

  return manifest;
}

try {
  const manifest = main();
  console.log(
    JSON.stringify(
      {
        ok: true,
        check: checkOnly,
        manifest: OUT,
        receipt: RECEIPT,
        generated_overlay_count: manifest.validation_result.generated_overlay_count,
        probe_case_count: manifest.validation_result.probe_case_count,
        observations_match: manifest.validation_result.oracle_candidate_observations_match,
        unexpected_candidate_package_differences_empty:
          manifest.validation_result.unexpected_candidate_package_differences_empty,
        copied_candidate_body_used: manifest.validation_result.copied_candidate_body_used
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
}
