#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-zbb4",
  external_ref: "WPHX-316.05",
  title: "WPHX-316.05 - Add taxonomy feature screen oracle fixture"
};
const RECORDED_AT = "2026-07-04T04:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-taxonomy-feature-screen-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-316-05";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-316-05-taxonomy-feature-screen-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-316-05-taxonomy-feature-screen-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-316-05-taxonomy-feature-screen-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-316-01-admin-feature-ajax-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-316-02-admin-feature-ajax-adapter-contract-candidate.v1.json";
const SETTINGS_FIXTURE = "manifests/wp-core/wphx-316-04-settings-options-oracle-fixture.v1.json";

const SOURCE_FILES = ["src/wp-admin/edit-tags.php"];
const SUPPORT_STUBS = ["wp-admin/admin.php", "wp-admin/admin-header.php", "wp-admin/admin-footer.php", "wp-admin/includes/edit-tag-messages.php"];
const COVERED_SYMBOLS = [
  "wp-admin/edit-tags.php",
  "get_taxonomy",
  "get_taxonomies",
  "WP_Terms_List_Table::current_action",
  "WP_Terms_List_Table::prepare_items",
  "WP_Terms_List_Table::display",
  "check_admin_referer",
  "wp_insert_term",
  "wp_delete_term",
  "get_edit_term_link",
  "handle_bulk_actions-{$screen}",
  "redirect_term_location",
  "add_screen_option",
  "wp_admin_notice"
];
const CASES = [
  { id: "taxonomy:invalid-taxnow", focus: "missing taxonomy request is rejected before list-table setup" },
  { id: "taxonomy:capability-denied", focus: "taxonomy manage_terms capability gate emits wp_die 403" },
  { id: "taxonomy:add-tag-success", focus: "add-tag action checks nonce, inserts a term, and redirects with success message" },
  { id: "taxonomy:delete-term", focus: "delete action checks term nonce, deletes term, removes action args, and redirects" },
  { id: "taxonomy:edit-redirect", focus: "edit action validates term and redirects to edit term link" },
  { id: "taxonomy:custom-bulk-filter", focus: "custom bulk action delegates redirect location to handle_bulk_actions screen filter" },
  { id: "taxonomy:render-list", focus: "default route prepares items, enqueues scripts, adds help, and renders stable screen fragments" }
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

function writeStub(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function mirrorSources(root) {
  for (const path of SOURCE_FILES) {
    const target = mirrorPath(root, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(upstreamPath(path), target);
  }

  writeStub(
    `${root}/wp-admin/admin.php`,
    `<?php
class Wphx_Wp_Die extends Exception {
\tpublic $payload;

\tpublic function __construct( $payload ) {
\t\tparent::__construct( 'wp_die' );
\t\t$this->payload = $payload;
\t}
}

class WP_Term {
\tpublic $term_id;
\tpublic $name;
\tpublic function __construct( $term_id, $name = 'Fixture Term' ) {
\t\t$this->term_id = $term_id;
\t\t$this->name = $name;
\t}
}

$GLOBALS['wphx_actions'] = $GLOBALS['wphx_actions'] ?? array();
$GLOBALS['wphx_filters'] = $GLOBALS['wphx_filters'] ?? array();
$GLOBALS['wphx_redirects'] = $GLOBALS['wphx_redirects'] ?? array();
$GLOBALS['wphx_nonce_checks'] = $GLOBALS['wphx_nonce_checks'] ?? array();
$GLOBALS['wphx_deleted_terms'] = $GLOBALS['wphx_deleted_terms'] ?? array();
$GLOBALS['wphx_inserted_terms'] = $GLOBALS['wphx_inserted_terms'] ?? array();
$GLOBALS['wphx_screen_options'] = $GLOBALS['wphx_screen_options'] ?? array();
$GLOBALS['wphx_enqueued_scripts'] = $GLOBALS['wphx_enqueued_scripts'] ?? array();
$GLOBALS['wphx_caps'] = $GLOBALS['wphx_caps'] ?? array();
$GLOBALS['taxonomy'] = $_REQUEST['taxonomy'] ?? ( $GLOBALS['taxonomy'] ?? 'category' );
$GLOBALS['taxnow'] = ! empty( $GLOBALS['wphx_force_no_taxnow'] ) ? '' : $GLOBALS['taxonomy'];
$GLOBALS['post_type'] = $_REQUEST['post_type'] ?? 'post';
$GLOBALS['current_screen'] = null;

class Wphx_Screen {
\tpublic $id = 'edit-category';
\tpublic $help_tabs = array();
\tpublic $reader_content = array();
\tpublic $sidebar = '';

\tpublic function add_help_tab( $args ) { $this->help_tabs[] = $args['id'] ?? ''; }
\tpublic function set_help_sidebar( $content ) { $this->sidebar = $content; }
\tpublic function set_screen_reader_content( $content ) { $this->reader_content = $content; }
}

class Wphx_Terms_List_Table {
\tpublic $screen;
\tprivate $action;
\tpublic function __construct() {
\t\t$this->screen = get_current_screen();
\t\t$this->action = $_REQUEST['action'] ?? '';
\t\tif ( '-1' === $this->action || '' === $this->action ) {
\t\t\t$this->action = $_REQUEST['action2'] ?? '';
\t\t}
\t}
\tpublic function get_pagenum() { return isset( $_REQUEST['paged'] ) ? max( 1, (int) $_REQUEST['paged'] ) : 1; }
\tpublic function current_action() { return $this->action; }
\tpublic function prepare_items() { $GLOBALS['wphx_actions'][] = array( 'hook' => 'terms_table_prepare_items' ); }
\tpublic function get_pagination_arg( $key ) { return 'total_pages' === $key ? 3 : null; }
\tpublic function search_box( $text, $input_id ) { echo '<input class="search-box" id="' . esc_attr( $input_id ) . '-search-input" value="' . esc_attr( $text ) . '" />'; }
\tpublic function views() { echo '<ul class="subsubsub"><li>All</li></ul>'; }
\tpublic function display() { echo '<table class="wp-list-table"><tr><td>Fixture Term Row</td></tr></table>'; }
\tpublic function inline_edit() { echo '<script id="inline-edit-tax">inline-edit</script>'; }
}

function __( $text, $domain = 'default' ) { return $text; }
function _e( $text, $domain = 'default' ) { echo $text; }
function _ex( $text, $context, $domain = 'default' ) { echo $text; }
function esc_attr( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function esc_html( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function esc_html_e( $text, $domain = 'default' ) { echo esc_html( $text ); }
function esc_url( $url ) { return (string) $url; }
function sanitize_url( $url ) { return (string) $url; }
function wp_unslash( $value ) { return is_array( $value ) ? array_map( 'wp_unslash', $value ) : stripslashes( (string) $value ); }
function current_user_can( $capability ) { return $GLOBALS['wphx_caps'][ $capability ] ?? true; }
function get_option( $name, $default = false ) { return 'default_category' === $name ? 1 : $default; }
function get_cat_name( $cat_id ) { return 'Uncategorized'; }
function wp_is_mobile() { return false; }

function wp_die( $message = '', $title = '', $args = array() ) {
\t$response = is_int( $title ) ? $title : ( is_array( $args ) && isset( $args['response'] ) ? $args['response'] : null );
\tthrow new Wphx_Wp_Die( array( 'kind' => 'wp_die', 'message' => wp_strip_all_tags( (string) $message ), 'response' => $response ) );
}
function wp_strip_all_tags( $text ) { return strip_tags( (string) $text ); }
function wp_redirect( $location, $status = 302 ) { $GLOBALS['wphx_redirects'][] = array( 'location' => $location, 'status' => $status ); return true; }
function admin_url( $path = '', $scheme = 'admin' ) { return 'https://example.test/wp-admin/' . ltrim( (string) $path, '/' ); }
function wp_get_referer() { return 'https://example.test/wp-admin/edit-tags.php?taxonomy=category&paged=2&_wpnonce=x'; }
function remove_query_arg( $keys, $url = null ) {
\t$url = $url ?? ( $_SERVER['REQUEST_URI'] ?? '' );
\tforeach ( (array) $keys as $key ) {
\t\t$url = preg_replace( '/([?&])' . preg_quote( $key, '/' ) . '=[^&]*/', '$1', $url );
\t}
\treturn rtrim( str_replace( '?&', '?', preg_replace( '/[?&]$/', '', $url ) ), '?' );
}
function add_query_arg( $key, $value = null, $url = null ) {
\tif ( is_array( $key ) ) {
\t\t$result = $url ?? ( $_SERVER['REQUEST_URI'] ?? '' );
\t\tforeach ( $key as $k => $v ) $result = add_query_arg( $k, $v, $result );
\t\treturn $result;
\t}
\t$url = $url ?? ( $_SERVER['REQUEST_URI'] ?? '' );
\treturn $url . ( str_contains( $url, '?' ) ? '&' : '?' ) . rawurlencode( $key ) . '=' . rawurlencode( (string) $value );
}

function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_filters'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) + 1 );
\tif ( 'handle_bulk_actions-edit-category' === $hook_name ) {
\t\treturn 'edit-tags.php?taxonomy=category&bulk=custom&ids=' . implode( ',', (array) ( $args[1] ?? array() ) );
\t}
\treturn $value;
}
function do_action( $hook_name, ...$args ) { $GLOBALS['wphx_actions'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) ); }
function do_action_deprecated( $hook_name, $args, $version, $replacement = '', $message = '' ) { $GLOBALS['wphx_actions'][] = array( 'hook' => 'deprecated:' . $hook_name, 'replacement' => $replacement ); }
function check_admin_referer( $action = -1, $query_arg = '_wpnonce' ) { $GLOBALS['wphx_nonce_checks'][] = array( 'action' => $action, 'query_arg' => $query_arg ); return 1; }

function get_current_screen() {
\tif ( ! $GLOBALS['current_screen'] ) $GLOBALS['current_screen'] = new Wphx_Screen();
\treturn $GLOBALS['current_screen'];
}
function add_screen_option( $option, $args = array() ) { $GLOBALS['wphx_screen_options'][] = array( 'option' => $option, 'args' => $args ); }
function _get_list_table( $class, $args = array() ) { return new Wphx_Terms_List_Table(); }
function wp_enqueue_script( $handle ) { $GLOBALS['wphx_enqueued_scripts'][] = $handle; }
function wp_admin_notice( $message, $args = array() ) { echo '<div id="' . esc_attr( $args['id'] ?? '' ) . '" class="notice">' . $message . '</div>'; }
function wp_nonce_field( $action, $name = '_wpnonce' ) { echo '<input type="hidden" name="' . esc_attr( $name ) . '" value="nonce-' . esc_attr( $action ) . '" />'; }
function submit_button( $text, $type = 'primary', $name = 'submit', $wrap = true ) { echo '<button type="submit" name="' . esc_attr( $name ) . '">' . esc_html( $text ) . '</button>'; }

function get_taxonomy( $taxonomy ) {
\tif ( 'missing_tax' === $taxonomy ) return false;
\t$labels = (object) array(
\t\t'name' => 'Categories',
\t\t'items_list_navigation' => 'Categories list navigation',
\t\t'items_list' => 'Categories list',
\t\t'search_items' => 'Search Categories',
\t\t'add_new_item' => 'Add New Category',
\t\t'name_field_description' => 'The name is how it appears on your site.',
\t\t'slug_field_description' => 'The slug is URL-friendly.',
\t\t'parent_item' => 'Parent Category',
\t\t'parent_field_description' => 'Parent category description.',
\t\t'desc_field_description' => 'The description is not prominent by default.',
\t);
\t$cap = (object) array( 'manage_terms' => 'manage_categories', 'edit_terms' => 'edit_categories', 'delete_terms' => 'delete_categories' );
\treturn (object) array( 'name' => $taxonomy, 'labels' => $labels, 'cap' => $cap );
}
function get_taxonomies( $args = array() ) { return array( 'category', 'post_tag' ); }
function is_taxonomy_hierarchical( $taxonomy ) { return 'category' === $taxonomy; }
function wp_dropdown_categories( $args ) { echo '<select name="' . esc_attr( $args['name'] ?? 'parent' ) . '"><option>None</option></select>'; }
function is_plugin_active( $plugin ) { return false; }

function wp_insert_term( $name, $taxonomy, $args = array() ) {
\t$GLOBALS['wphx_inserted_terms'][] = array( 'name' => $name, 'taxonomy' => $taxonomy, 'args_keys' => array_keys( $args ) );
\treturn array( 'term_id' => 77, 'term_taxonomy_id' => 88 );
}
function wp_delete_term( $term_id, $taxonomy ) { $GLOBALS['wphx_deleted_terms'][] = array( 'term_id' => (int) $term_id, 'taxonomy' => $taxonomy ); return true; }
function get_term( $term_id, $taxonomy = '' ) { return 404 === (int) $term_id ? null : new WP_Term( (int) $term_id ); }
function is_wp_error( $value ) { return false; }
function get_edit_term_link( $term_id, $taxonomy, $post_type = '' ) { return 'edit-tags.php?action=edit&taxonomy=' . rawurlencode( $taxonomy ) . '&tag_ID=' . (int) $term_id . '&post_type=' . rawurlencode( $post_type ); }
`
  );

  writeStub(`${root}/wp-admin/admin-header.php`, "<?php echo '<header id=\"wpadminbar\">admin-header</header>'; ?>\n");
  writeStub(`${root}/wp-admin/admin-footer.php`, "<?php echo '<footer id=\"wpfooter\">admin-footer</footer>'; ?>\n");
  writeStub(`${root}/wp-admin/includes/edit-tag-messages.php`, "<?php $message = isset( $_REQUEST['message'] ) ? 'Fixture term message' : ''; ?>\n");
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
$root = rtrim( $argv[1], '/\\\\' );
$case = $argv[2] ?? '';
$emitted = false;
$exception_payload = null;
$completed = false;

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

define( 'ABSPATH', $root . '/' );
$_GET = array();
$_POST = array();
$_REQUEST = array( 'taxonomy' => 'category' );
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['REQUEST_URI'] = '/wp-admin/edit-tags.php?taxonomy=category&paged=2';

function wphx_prepare_case( $case ) {
\tswitch ( $case ) {
\t\tcase 'taxonomy:invalid-taxnow':
\t\t\t$_REQUEST = array();
\t\t\t$GLOBALS['wphx_force_no_taxnow'] = true;
\t\t\tbreak;
\t\tcase 'taxonomy:capability-denied':
\t\t\t$GLOBALS['wphx_caps'] = array( 'manage_categories' => false );
\t\t\tbreak;
\t\tcase 'taxonomy:add-tag-success':
\t\t\t$_SERVER['REQUEST_METHOD'] = 'POST';
\t\t\t$_POST = array( 'action' => 'add-tag', 'taxonomy' => 'category', 'tag-name' => 'New Category', '_wpnonce_add-tag' => 'nonce' );
\t\t\t$_REQUEST = $_POST;
\t\t\tbreak;
\t\tcase 'taxonomy:delete-term':
\t\t\t$_REQUEST = array( 'taxonomy' => 'category', 'action' => 'delete', 'tag_ID' => '12', '_wpnonce' => 'nonce', 'paged' => '2' );
\t\t\tbreak;
\t\tcase 'taxonomy:edit-redirect':
\t\t\t$_REQUEST = array( 'taxonomy' => 'category', 'action' => 'edit', 'tag_ID' => '12' );
\t\t\tbreak;
\t\tcase 'taxonomy:custom-bulk-filter':
\t\t\t$_REQUEST = array( 'taxonomy' => 'category', 'action' => 'wphx-bulk', 'delete_tags' => array( '4', '5' ), '_wpnonce' => 'nonce' );
\t\t\tbreak;
\t\tcase 'taxonomy:render-list':
\t\t\t$_REQUEST = array( 'taxonomy' => 'category', 's' => 'alpha', 'message' => '1' );
\t\t\tbreak;
\t\tdefault:
\t\t\tfwrite( STDERR, 'Unknown case: ' . $case . PHP_EOL );
\t\t\texit( 2 );
\t}
\t$_GET = $_REQUEST;
}

function wphx_emit_result() {
\tglobal $case, $emitted, $exception_payload, $completed;
\tif ( $emitted ) return;
\t$emitted = true;
\t$output = '';
\twhile ( ob_get_level() > 0 ) $output = ob_get_clean() . $output;
\techo json_encode(
\t\tarray(
\t\t\t'case' => $case,
\t\t\t'completed' => $completed,
\t\t\t'exception' => $exception_payload,
\t\t\t'redirects' => $GLOBALS['wphx_redirects'] ?? array(),
\t\t\t'nonce_checks' => $GLOBALS['wphx_nonce_checks'] ?? array(),
\t\t\t'inserted_terms' => $GLOBALS['wphx_inserted_terms'] ?? array(),
\t\t\t'deleted_terms' => $GLOBALS['wphx_deleted_terms'] ?? array(),
\t\t\t'filters' => array_values( array_map( fn( $entry ) => $entry['hook'] ?? '', $GLOBALS['wphx_filters'] ?? array() ) ),
\t\t\t'actions' => array_values( array_map( fn( $entry ) => $entry['hook'] ?? '', $GLOBALS['wphx_actions'] ?? array() ) ),
\t\t\t'screen_options' => $GLOBALS['wphx_screen_options'] ?? array(),
\t\t\t'enqueued_scripts' => $GLOBALS['wphx_enqueued_scripts'] ?? array(),
\t\t\t'help_tabs' => $GLOBALS['current_screen']->help_tabs ?? array(),
\t\t\t'output_contains' => array(
\t\t\t\t'heading' => str_contains( $output, 'Categories' ),
\t\t\t\t'search_subtitle' => str_contains( $output, 'Search results for:' ),
\t\t\t\t'message_notice' => str_contains( $output, 'Fixture term message' ),
\t\t\t\t'add_form' => str_contains( $output, 'id="addtag"' ),
\t\t\t\t'list_table' => str_contains( $output, 'Fixture Term Row' ),
\t\t\t\t'nonce_field' => str_contains( $output, '_wpnonce_add-tag' ),
\t\t\t),
\t\t\t'output_length' => strlen( $output ),
\t\t),
\t\tJSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
\t);
}

register_shutdown_function( 'wphx_emit_result' );
wphx_prepare_case( $case );
ob_start();
try {
\trequire $root . '/wp-admin/edit-tags.php';
\t$completed = true;
} catch ( Wphx_Wp_Die $e ) {
\t$exception_payload = $e->payload;
}
wphx_emit_result();
`
  );
}

function runCase(root, testCase) {
  return JSON.parse(command("php", [PROBE, root, testCase.id]));
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    if (readFileSync(path, "utf8") !== content) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-316-taxonomy-feature-screen-oracle-fixture`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function observationsFor(root) {
  const observations = {};
  for (const testCase of CASES) observations[testCase.id] = runCase(root, testCase);
  return observations;
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/taxonomy-feature-screen-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "copied_oracle_fixture",
      name: "taxonomy feature-screen route fixture",
      area: "wp-admin/edit-tags.php taxonomy management screen actions and output phases",
      public_contract:
        "This slice executes copied upstream WordPress edit-tags.php under deterministic stubs for oracle/candidate behavior observations. Term storage/query semantics remain WPHX-308; this does not claim generated public PHP replacement, installed admin parity, database-backed term persistence, or Haxe-owned route execution."
    },
    ownership_state: "external_oracle_fixture",
    ownership_axes: {
      semantic_owner: "upstream_wordpress_oracle",
      adapter_contract_owner: "haxe_typed_prior_slice",
      emission_strategy: "copied_upstream_public_php_with_deterministic_bootstrap_stubs",
      execution_provider: "php_oracle_candidate_probe",
      compatibility_evidence: "targeted_copied_oracle_behavior"
    },
    cross_domain_handoffs: [
      { owner: "WPHX-308", reason: "Term CRUD/storage/query semantics are stubbed observations here and remain taxonomy/comment domain work." },
      { owner: "WPHX-315", reason: "List-table primitive behavior is stubbed; WPHX-315 owns common list-table machinery." }
    ],
    bridge: {
      exists: true,
      kind: "copied-upstream-oracle-candidate-fixture",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass taxonomy feature-screen route actions, term CRUD/query integration, list-table behavior, nonce/capability checks, database-backed persistence, selected upstream PHPUnit/e2e, and installed admin fixtures before claiming public PHP ownership or installed admin parity."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    copied_upstream_inputs: SOURCE_FILES,
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-316-taxonomy-feature-screen-oracle-fixture",
        "npm run wp:core:wphx-316-taxonomy-feature-screen-oracle-fixture:check",
        "npm run operations:bridge-claim-guardrails:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-316-05-taxonomy-feature-screen-oracle-fixture"],
      manifest_digest: manifestSha
    },
    notes:
      "Mirrored PHP is regenerated under build/ only. The candidate currently matches the upstream oracle by construction; future generated overlays require an explicit overlay manifest and additional gates."
  };
}

rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
writeProbe();

const oracle = observationsFor(ORACLE_ROOT);
const candidate = observationsFor(CANDIDATE_ROOT);
const matches = JSON.stringify(oracle) === JSON.stringify(candidate);
if (!matches) throw new Error("oracle/candidate observations differ");

const manifest = {
  schema: "wphx.wp-core-taxonomy-feature-screen-oracle-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["copied_oracle_fixture", "targeted_behavior_observation"],
  artifact_scope: "bridge_fixture",
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    adapter_contract_manifest: inputRecord(CONTRACT),
    settings_options_fixture_manifest: inputRecord(SETTINGS_FIXTURE),
    upstream_sources: SOURCE_FILES.map(sourceRecord),
    support_stubs: SUPPORT_STUBS,
    runner: inputRecord(RUNNER)
  },
  fixture: {
    source_files: SOURCE_FILES,
    support_stubs: SUPPORT_STUBS,
    covered_symbols: COVERED_SYMBOLS,
    cases: CASES,
    oracle,
    candidate,
    observation_count: CASES.length,
    matching_observations: matches
  },
  claims: {
    targeted_copied_oracle_behavior_claimed: true,
    broad_behavior_parity_claimed: false,
    public_php_replacement_claimed: false,
    haxe_runtime_ownership_claimed: false,
    installed_admin_parity_claimed: false,
    database_backed_state_claimed: false,
    browser_editor_behavior_claimed: false,
    generated_original_path_adapter_claimed: false,
    generated_candidate_overlay_claimed: false
  },
  non_claims: [
    "Does not claim generated replacement for wp-admin/edit-tags.php or taxonomy feature-screen route files.",
    "Does not execute WordPress bootstrap, a real database, real users/sessions, real nonces, real headers, browser/editor behavior, or installed admin routes.",
    "Does not claim term CRUD/query ownership, broad taxonomy screen parity, upstream PHPUnit pass/pass parity, public PHP ABI ownership, or durable original-path adapter ownership."
  ],
  validation_result: {
    status: "passed",
    observation_count: CASES.length,
    source_file_count: SOURCE_FILES.length,
    covered_symbol_count: COVERED_SYMBOLS.length,
    oracle_candidate_match: matches
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const ownershipText = JSON.stringify(ownershipManifest(sha256(manifestText)), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-316-05-taxonomy-feature-screen-oracle-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "taxonomy feature-screen copied-oracle fixture manifest" },
    { path: OWNERSHIP, role: "taxonomy feature-screen copied-oracle fixture ownership manifest" },
    { path: RUNNER, role: "deterministic copied-oracle generator/check runner" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-316-taxonomy-feature-screen-oracle-fixture",
    "npm run wp:core:wphx-316-taxonomy-feature-screen-oracle-fixture:check",
    "npm run operations:bridge-claim-guardrails:check"
  ],
  validation_result: manifest.validation_result,
  manifest_sha256: sha256(manifestText),
  ownership_sha256: sha256(ownershipText),
  related_receipts: [
    "receipt:wphx-316-01-admin-feature-ajax-surface",
    "receipt:wphx-316-02-admin-feature-ajax-adapter-contract-candidate",
    "receipt:wphx-316-03-admin-ajax-post-oracle-fixture",
    "receipt:wphx-316-04-settings-options-oracle-fixture"
  ]
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

console.log(JSON.stringify(manifest.validation_result, null, 2));
