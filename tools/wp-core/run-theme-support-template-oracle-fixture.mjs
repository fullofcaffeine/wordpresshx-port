#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.17.3",
  external_ref: "WPHX-310.03",
  title: "WPHX-310.03 — Add theme support/template oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-theme-support-template-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-310-03";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-310-03-theme-support-template-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-310-03-theme-support-template-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-310-03-theme-support-template-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-310-01-themes-template-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-310-02-theme-template-adapter-contract-candidate.v1.json";

const SOURCE_FILES = ["src/wp-includes/theme.php", "src/wp-includes/template.php"];
const COVERED_SYMBOLS = [
  "add_theme_support",
  "get_theme_support",
  "current_theme_supports",
  "remove_theme_support",
  "register_theme_feature",
  "get_registered_theme_feature",
  "_add_default_theme_supports",
  "get_query_template",
  "locate_template",
  "load_template"
];
const FIXTURE_CASES = [
  { id: "support:post-thumbnails-merge", focus: "add_theme_support merges post-thumbnail post type lists and current_theme_supports checks content type" },
  { id: "support:html5-defaults", focus: "html5 support back-compat defaults plus per-type checks" },
  { id: "support:custom-logo-defaults", focus: "custom-logo defaults enable flex dimensions when no size is specified" },
  { id: "support:register-feature-rest-schema", focus: "register_theme_feature fills REST schema defaults and additionalProperties policy" },
  { id: "support:block-theme-defaults", focus: "_add_default_theme_supports adds block-theme default supports and asset filters" },
  { id: "template:classic-hierarchy", focus: "get_query_template sanitizes type, filters hierarchy, locates first matching classic template, and applies template filter" },
  { id: "template:locate-load-args", focus: "locate_template(load=true) loads selected template with args and before/after hooks" },
  { id: "template:theme-compat-fallback", focus: "locate_template falls back to wp-includes/theme-compat when the active theme lacks the template" }
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

function writeFixtureTheme(root) {
  const themeRoot = `${root}/wp-content/themes/wphx-theme`;
  const compatRoot = `${root}/wp-includes/theme-compat`;
  mkdirSync(themeRoot, { recursive: true });
  mkdirSync(compatRoot, { recursive: true });
  writeFileSync(`${themeRoot}/index.php`, "<?php echo 'template:index';\n");
  writeFileSync(`${themeRoot}/home.php`, "<?php echo 'template:home';\n");
  writeFileSync(`${themeRoot}/page-special.php`, "<?php echo 'template:page-special';\n");
  writeFileSync(`${themeRoot}/partial.php`, "<?php echo 'partial:' . ($args['label'] ?? 'missing');\n");
  writeFileSync(`${compatRoot}/fallback.php`, "<?php echo 'compat:fallback';\n");
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
$root = rtrim( $argv[1], '/\\\\' );

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'WP_DEBUG', false );
define( 'WP_CONTENT_DIR', $root . '/wp-content' );

$GLOBALS['_wp_theme_features'] = array();
$GLOBALS['_wp_registered_theme_features'] = array();
$GLOBALS['wp_filter'] = array();
$GLOBALS['wp_actions'] = array();
$GLOBALS['wphx_310_03_filters'] = array();
$GLOBALS['wphx_310_03_actions'] = array();
$GLOBALS['wphx_310_03_errors'] = array();
$GLOBALS['wphx_310_03_block_theme'] = false;
$GLOBALS['wp_stylesheet_path'] = $root . '/wp-content/themes/wphx-theme';
$GLOBALS['wp_template_path'] = $root . '/wp-content/themes/wphx-theme';
$GLOBALS['wp_theme_directories'] = array( $root . '/wp-content/themes' );
$GLOBALS['wp_query'] = (object) array( 'query_vars' => array() );

set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_310_03_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

class WP_Error {
\tpublic $code;
\tpublic $message;
\tpublic function __construct( $code = '', $message = '' ) {
\t\t$this->code = $code;
\t\t$this->message = $message;
\t}
\tpublic function get_error_code() {
\t\treturn $this->code;
\t}
}
class WP_Customize_Panel {
\tpublic $id = '';
}
class WP_Theme {
\tprivate $stylesheet;
\tprivate $theme_root;
\tpublic function __construct( $stylesheet, $theme_root ) {
\t\t$this->stylesheet = $stylesheet;
\t\t$this->theme_root = $theme_root;
\t}
\tpublic function is_block_theme() {
\t\treturn $GLOBALS['wphx_310_03_block_theme'];
\t}
\tpublic function errors() {
\t\treturn false;
\t}
\tpublic function cache_delete() {}
}

function __( $text ) { return $text; }
function get_option( $name, $default = false ) {
\tif ( 'stylesheet' === $name || 'template' === $name ) {
\t\treturn 'wphx-theme';
\t}
\treturn $default;
}
function _doing_it_wrong( $function_name, $message, $version ) {
\t$GLOBALS['wphx_310_03_actions'][] = array( 'hook' => 'doing_it_wrong', 'function' => $function_name, 'version' => $version );
}
function did_action( $hook_name ) { return $GLOBALS['wp_actions'][ $hook_name ] ?? 0; }
function wp_parse_args( $args, $defaults = array() ) {
\tif ( is_object( $args ) ) {
\t\t$args = get_object_vars( $args );
\t}
\tif ( ! is_array( $args ) ) {
\t\tparse_str( (string) $args, $args );
\t}
\treturn array_merge( $defaults, $args );
}
function rest_default_additional_properties_to_false( $schema ) {
\tif ( is_array( $schema ) && ( ( $schema['type'] ?? null ) === 'object' || in_array( 'object', (array) ( $schema['type'] ?? array() ), true ) ) && ! array_key_exists( 'additionalProperties', $schema ) ) {
\t\t$schema['additionalProperties'] = false;
\t}
\treturn $schema;
}
function get_post_format_slugs() {
\treturn array( 'standard' => 'Standard', 'aside' => 'Aside', 'gallery' => 'Gallery', 'link' => 'Link' );
}
function add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wp_filter'][ $hook_name ][] = array( 'priority' => $priority, 'accepted_args' => $accepted_args );
\treturn true;
}
function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_310_03_filters'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) + 1 );
\treturn $value;
}
function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_310_03_actions'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) );
}
function remove_action( $hook_name, $callback ) {
\t$GLOBALS['wphx_310_03_actions'][] = array( 'hook' => 'remove_action:' . $hook_name );
}
function locate_block_template( $template, $type, $templates ) {
\treturn $GLOBALS['wphx_310_03_block_theme'] ? 'block-template:' . $type : $template;
}
function wphx_rel( $path ) {
\t$path = str_replace( '\\\\', '/', (string) $path );
\t$root = str_replace( '\\\\', '/', ABSPATH );
\treturn str_starts_with( $path, $root ) ? substr( $path, strlen( $root ) ) : $path;
}
function wphx_reset() {
\t$GLOBALS['_wp_theme_features'] = array();
\t$GLOBALS['_wp_registered_theme_features'] = array();
\t$GLOBALS['wp_filter'] = array();
\t$GLOBALS['wphx_310_03_filters'] = array();
\t$GLOBALS['wphx_310_03_actions'] = array();
\t$GLOBALS['wphx_310_03_block_theme'] = false;
\t$GLOBALS['wp_stylesheet_path'] = ABSPATH . 'wp-content/themes/wphx-theme';
\t$GLOBALS['wp_template_path'] = ABSPATH . 'wp-content/themes/wphx-theme';
}

require ABSPATH . WPINC . '/theme.php';
require ABSPATH . WPINC . '/template.php';

$cases = array();

wphx_reset();
add_theme_support( 'post-thumbnails', array( 'post' ) );
add_theme_support( 'post-thumbnails', array( 'page', 'book' ) );
$cases['support:post-thumbnails-merge'] = array(
\t'support' => get_theme_support( 'post-thumbnails' ),
\t'post' => current_theme_supports( 'post-thumbnails', 'post' ),
\t'book' => current_theme_supports( 'post-thumbnails', 'book' ),
\t'attachment' => current_theme_supports( 'post-thumbnails', 'attachment' ),
\t'filters' => $GLOBALS['wphx_310_03_filters'],
);

wphx_reset();
add_theme_support( 'html5' );
$cases['support:html5-defaults'] = array(
\t'support' => get_theme_support( 'html5' ),
\t'comment_form' => current_theme_supports( 'html5', 'comment-form' ),
\t'script' => current_theme_supports( 'html5', 'script' ),
\t'actions' => $GLOBALS['wphx_310_03_actions'],
);

wphx_reset();
add_theme_support( 'custom-logo' );
$cases['support:custom-logo-defaults'] = get_theme_support( 'custom-logo' );

wphx_reset();
$registered = register_theme_feature(
\t'wphx-feature',
\tarray(
\t\t'type' => 'object',
\t\t'description' => 'Fixture feature.',
\t\t'show_in_rest' => array(
\t\t\t'schema' => array(
\t\t\t\t'properties' => array(
\t\t\t\t\t'enabled' => array( 'type' => 'boolean' ),
\t\t\t\t),
\t\t\t),
\t\t),
\t)
);
$cases['support:register-feature-rest-schema'] = array(
\t'registered' => true === $registered ? 'true' : ( $registered instanceof WP_Error ? $registered->get_error_code() : 'unknown' ),
\t'feature' => get_registered_theme_feature( 'wphx-feature' ),
);

wphx_reset();
$GLOBALS['wphx_310_03_block_theme'] = true;
_add_default_theme_supports();
$cases['support:block-theme-defaults'] = array(
\t'post_thumbnails' => current_theme_supports( 'post-thumbnails' ),
\t'responsive_embeds' => current_theme_supports( 'responsive-embeds' ),
\t'editor_styles' => current_theme_supports( 'editor-styles' ),
\t'html5_script' => current_theme_supports( 'html5', 'script' ),
\t'asset_filters' => array_keys( $GLOBALS['wp_filter'] ),
);

wphx_reset();
$cases['template:classic-hierarchy'] = array(
\t'page' => wphx_rel( get_query_template( 'page special', array( 'page-missing.php', 'page-special.php', 'index.php' ) ) ),
\t'block' => wphx_rel( get_query_template( 'page', array( 'page-special.php' ) ) ),
\t'filters' => $GLOBALS['wphx_310_03_filters'],
);

wphx_reset();
ob_start();
$located = locate_template( array( 'missing.php', 'partial.php' ), true, false, array( 'label' => 'loaded' ) );
$output = ob_get_clean();
$cases['template:locate-load-args'] = array(
\t'located' => wphx_rel( $located ),
\t'output' => $output,
\t'actions' => $GLOBALS['wphx_310_03_actions'],
);

wphx_reset();
$cases['template:theme-compat-fallback'] = array(
\t'located' => wphx_rel( locate_template( array( 'fallback.php' ) ) ),
);

ksort( $cases );
echo json_encode(
\tarray(
\t\t'cases' => $cases,
\t\t'php_errors' => $GLOBALS['wphx_310_03_errors'],
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
);
`
  );
}

function runProbe(root) {
  return JSON.parse(command("php", [PROBE, root]));
}

function stableObservation(value) {
  return JSON.parse(JSON.stringify(value));
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-310-theme-support-template-oracle-fixture`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/theme-support-template-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "theme support, theme feature registration, block-theme default supports, and classic template location behavior",
      area: SOURCE_FILES.join(" "),
      public_contract:
        "This fixture executes copied WordPress 7.0 theme/template source for selected theme support and template hierarchy behavior while requiring the WPHX-310.02 Haxe adapter-contract receipt. It does not claim generated public PHP replacement, full theme.json merge behavior, customizer transaction parity, or installed rendering parity."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-haxe-adapter-contract-foundation",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass installed front-end/admin theme gates plus selected upstream PHPUnit groups before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-310-theme-support-template-oracle-fixture",
        "npm run wp:core:wphx-310-theme-support-template-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-310-03-theme-support-template-oracle-fixture"],
      manifest_digest: manifestSha
    }
  };
}

rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
writeFixtureTheme(ORACLE_ROOT);
writeFixtureTheme(CANDIDATE_ROOT);
writeProbe();

const oracle = stableObservation(runProbe(ORACLE_ROOT));
const candidate = stableObservation(runProbe(CANDIDATE_ROOT));
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
  schema: "wphx.wp-core-theme-support-template-oracle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["oracle_source_mirror", "candidate_package_mirror"],
  artifact_scope: "fixture",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT),
    runner: inputRecord(RUNNER),
    upstream_sources: SOURCE_FILES.map(sourceRecord)
  },
  fixture: {
    cases: FIXTURE_CASES,
    covered_symbols: COVERED_SYMBOLS,
    source_files: SOURCE_FILES,
    probe: {
      path: PROBE,
      sha256: sha256File(PROBE)
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
      id: "theme-json-merge-not-executed",
      owner: ISSUE.external_ref,
      detail: "This fixture records theme-feature/default-support and template-location behavior. Full WP_Theme_JSON resolver merge, stylesheet generation, variation, and global-styles post behavior remain later WPHX-310 gates."
    },
    {
      id: "customizer-admin-installed-behavior-not-executed",
      owner: ISSUE.external_ref,
      detail: "Customizer transactions, admin-visible theme state, nav-menu/widget admin screens, and installed front-end rendering are not claimed by this fixture."
    },
    {
      id: "public-php-adapter-not-yet-generated",
      owner: ISSUE.external_ref,
      detail: "theme.php and template.php are copied oracle PHP in this fixture; generated original-path PHP replacement remains a later cross-domain gate."
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
  id: "receipt:wphx-310-03-theme-support-template-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "theme support/template oracle-source-mirror fixture manifest" },
    { path: OWNERSHIP, role: "ownership manifest for copied-oracle fixture boundary" },
    { path: RUNNER, role: "deterministic oracle/candidate fixture generator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-310-theme-support-template-oracle-fixture",
    "npm run wp:core:wphx-310-theme-support-template-oracle-fixture:check",
    "npm run receipts:validate",
    "npm run beads:validate"
  ],
  related_receipts: [
    "receipt:wphx-310-01-themes-template-surface",
    "receipt:wphx-310-02-theme-template-adapter-contract-candidate"
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
