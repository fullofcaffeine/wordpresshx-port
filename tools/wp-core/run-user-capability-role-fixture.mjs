#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.13.1",
  external_ref: "WPHX-306.03",
  title: "Capability and role oracle fixture"
};
const OUT_ROOT = "build/wp-core/wphx-306-03";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-306-03-capability-role-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-306-03-capability-role-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-306-03-capability-role-fixture.v1.json";
const FOUNDATION = "manifests/wp-core/wphx-306-02-auth-adapter-contract-candidate.v1.json";
const SURFACE = "manifests/wp-core/wphx-306-01-user-auth-surface.v1.json";
const RECORDED_AT = "2026-06-23T21:20:00.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const UPSTREAM_ROOT = "../wordpress-develop";

const SOURCE_FILES = [
  "src/wp-includes/class-wp-role.php",
  "src/wp-includes/class-wp-roles.php",
  "src/wp-includes/class-wp-user.php",
  "src/wp-includes/capabilities.php"
];

const COVERED_SYMBOLS = [
  "map_meta_cap",
  "current_user_can",
  "user_can",
  "user_can_for_site",
  "wp_roles",
  "get_role",
  "add_role",
  "remove_role",
  "is_super_admin",
  "WP_Role::has_cap",
  "WP_Role::add_cap",
  "WP_Role::remove_cap",
  "WP_Roles::add_role",
  "WP_Roles::remove_role",
  "WP_Roles::for_site",
  "WP_User::has_cap",
  "WP_User::add_role",
  "WP_User::remove_role",
  "WP_User::set_role",
  "WP_User::add_cap",
  "WP_User::remove_cap"
];

const FIXTURE_CASES = [
  { id: "role:numeric-capabilities", symbol: "add_role/WP_Roles::add_role", focus: "numeric capability arrays are normalized to true-valued associative caps" },
  { id: "role:add-remove-cap", symbol: "WP_Role::add_cap/remove_cap/has_cap", focus: "role capability mutation and role_has_cap filter visibility" },
  { id: "user:primitive-role-cap", symbol: "user_can/WP_User::has_cap", focus: "role-derived primitive capability grants and explicit user-level denial" },
  { id: "user:filter-grant", symbol: "user_has_cap", focus: "user_has_cap filter can grant a capability before final all-caps check" },
  { id: "user:missing-anonymous", symbol: "user_can", focus: "missing users become anonymous users with exist but no edit capability" },
  { id: "meta:edit-user-self", symbol: "map_meta_cap", focus: "edit_user self check maps to no primitive caps" },
  { id: "meta:edit-user-missing", symbol: "map_meta_cap", focus: "missing/invalid users map edit_user to do_not_allow" },
  { id: "multisite:super-admin", symbol: "is_super_admin/WP_User::has_cap", focus: "super admin receives all caps except explicit do_not_allow" },
  { id: "site:switch-user-can", symbol: "user_can_for_site", focus: "site-specific capability lookup switches blog context and restores it" }
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

function mirrorSources(root) {
  for (const path of SOURCE_FILES) {
    const target = mirrorPath(root, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(upstreamPath(path), target);
  }
}

function sourceRecord(path) {
  return {
    path,
    repo_path: upstreamPath(path),
    bytes: statSync(upstreamPath(path)).size,
    sha256: sha256File(upstreamPath(path))
  };
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
$GLOBALS['wphx_306_03_php_errors'] = array();
set_error_handler(
\tfunction ( $errno, $errstr, $errfile, $errline ) {
\t\t$GLOBALS['wphx_306_03_php_errors'][] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => basename( $errfile ),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );
define( 'WP_DEBUG', false );

class WPHX_306_03_Fake_WPDB {
\tpublic $prefix = 'wp_';
\tpublic $base_prefix = 'wp_';
\tpublic $users = 'wp_users';
\tpublic $usermeta = 'wp_usermeta';
\tpublic $blogid = 1;

\tpublic function get_blog_prefix( $blog_id = null ) {
\t\tif ( null === $blog_id ) {
\t\t\t$blog_id = $this->blogid;
\t\t}
\t\t$blog_id = (int) $blog_id;
\t\treturn 1 === $blog_id ? $this->base_prefix : $this->base_prefix . $blog_id . '_';
\t}
}

$GLOBALS['wpdb'] = new WPHX_306_03_Fake_WPDB();
$GLOBALS['wphx_306_03_filters'] = array();
$GLOBALS['wphx_306_03_options'] = array();
$GLOBALS['wphx_306_03_user_meta'] = array();
$GLOBALS['wphx_306_03_users'] = array();
$GLOBALS['wphx_306_03_user_data'] = array();
$GLOBALS['wphx_306_03_current_user_id'] = 0;
$GLOBALS['wphx_306_03_current_blog_id'] = 1;
$GLOBALS['wphx_306_03_switch_log'] = array();
$GLOBALS['super_admins'] = array( 'super' );

function add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
\t$GLOBALS['wphx_306_03_filters'][ $hook_name ][ $priority ][] = array( $callback, $accepted_args );
\tksort( $GLOBALS['wphx_306_03_filters'][ $hook_name ] );
\treturn true;
}

function remove_all_filters( $hook_name ) {
\tunset( $GLOBALS['wphx_306_03_filters'][ $hook_name ] );
\treturn true;
}

function apply_filters( $hook_name, $value, ...$args ) {
\tif ( empty( $GLOBALS['wphx_306_03_filters'][ $hook_name ] ) ) {
\t\treturn $value;
\t}
\tforeach ( $GLOBALS['wphx_306_03_filters'][ $hook_name ] as $callbacks ) {
\t\tforeach ( $callbacks as $record ) {
\t\t\t$callback_args = array_merge( array( $value ), $args );
\t\t\t$value = call_user_func_array( $record[0], array_slice( $callback_args, 0, $record[1] ) );
\t\t}
\t}
\treturn $value;
}

function do_action( $hook_name, ...$args ) {
\tapply_filters( $hook_name, null, ...$args );
}

function __( $text ) { return $text; }
function _x( $text ) { return $text; }
function esc_html__( $text ) { return $text; }
function translate_user_role( $name ) { return $name; }
function _deprecated_function( $function_name, $version, $replacement = '' ) {
\t$GLOBALS['wphx_306_03_php_errors'][] = array( 'deprecated_function' => $function_name, 'version' => $version, 'replacement' => $replacement );
}
function _deprecated_argument( $function_name, $version, $message = '' ) {
\t$GLOBALS['wphx_306_03_php_errors'][] = array( 'deprecated_argument' => $function_name, 'version' => $version, 'message' => $message );
}
function _doing_it_wrong( $function_name, $message, $version ) {
\t$GLOBALS['wphx_306_03_php_errors'][] = array( 'doing_it_wrong' => $function_name, 'message' => $message, 'version' => $version );
}
function absint( $value ) { return abs( (int) $value ); }
function wp_is_numeric_array( $data ) {
\tif ( ! is_array( $data ) ) {
\t\treturn false;
\t}
\t$keys = array_keys( $data );
\treturn array_keys( $keys ) === $keys;
}
function wp_cache_get( $key, $group = '' ) { return false; }
function wp_cache_add( $key, $data, $group = '', $expire = 0 ) { return true; }
function wp_cache_set( $key, $data, $group = '', $expire = 0 ) { return true; }
function wp_cache_delete( $key, $group = '' ) { return true; }
function sanitize_user( $username ) { return strtolower( trim( (string) $username ) ); }
function is_multisite() { return true; }
function get_current_blog_id() { return $GLOBALS['wphx_306_03_current_blog_id']; }
function switch_to_blog( $site_id ) {
\t$GLOBALS['wphx_306_03_switch_log'][] = array( 'switch_to_blog', (int) $site_id );
\t$GLOBALS['wphx_306_03_current_blog_id'] = (int) $site_id;
\t$GLOBALS['wpdb']->blogid = (int) $site_id;
\t$GLOBALS['wpdb']->prefix = $GLOBALS['wpdb']->get_blog_prefix( $site_id );
\tif ( function_exists( 'wp_roles' ) ) {
\t\twp_roles()->for_site( $site_id );
\t}
\treturn true;
}
function restore_current_blog() {
\t$GLOBALS['wphx_306_03_switch_log'][] = array( 'restore_current_blog', 1 );
\t$GLOBALS['wphx_306_03_current_blog_id'] = 1;
\t$GLOBALS['wpdb']->blogid = 1;
\t$GLOBALS['wpdb']->prefix = $GLOBALS['wpdb']->get_blog_prefix( 1 );
\tif ( function_exists( 'wp_roles' ) ) {
\t\twp_roles()->for_site( 1 );
\t}
\treturn true;
}
function get_option( $name, $default = false ) {
\treturn array_key_exists( $name, $GLOBALS['wphx_306_03_options'] ) ? $GLOBALS['wphx_306_03_options'][ $name ] : $default;
}
function update_option( $name, $value, $autoload = null ) {
\t$GLOBALS['wphx_306_03_options'][ $name ] = $value;
\treturn true;
}
function get_blog_option( $site_id, $name, $default = false ) {
\t$prefixed = $GLOBALS['wpdb']->get_blog_prefix( $site_id ) . substr( $name, strlen( $GLOBALS['wpdb']->get_blog_prefix( $site_id ) ) );
\treturn get_option( $prefixed, $default );
}
function get_site_option( $name, $default = false ) {
\tif ( 'site_admins' === $name ) {
\t\treturn $GLOBALS['super_admins'];
\t}
\treturn $default;
}
function get_user_meta( $user_id, $key, $single = false ) {
\t$value = $GLOBALS['wphx_306_03_user_meta'][ (int) $user_id ][ $key ] ?? '';
\treturn $single ? $value : array( $value );
}
function update_user_meta( $user_id, $key, $value ) {
\t$GLOBALS['wphx_306_03_user_meta'][ (int) $user_id ][ $key ] = $value;
\treturn true;
}
function delete_user_meta( $user_id, $key ) {
\tunset( $GLOBALS['wphx_306_03_user_meta'][ (int) $user_id ][ $key ] );
\treturn true;
}
function get_userdata( $user_id ) {
\t$user_id = (int) $user_id;
\tif ( ! isset( $GLOBALS['wphx_306_03_user_data'][ $user_id ] ) ) {
\t\treturn false;
\t}
\t$user = new WP_User();
\t$user->init( clone $GLOBALS['wphx_306_03_user_data'][ $user_id ] );
\t$GLOBALS['wphx_306_03_users'][ $user_id ] = $user;
\treturn $user;
}
function wp_get_current_user() {
\treturn get_userdata( $GLOBALS['wphx_306_03_current_user_id'] ) ?: new WP_User( 0 );
}
function get_post( $post = null ) {
\treturn false;
}

require $root . '/wp-includes/class-wp-role.php';
require $root . '/wp-includes/class-wp-roles.php';
require $root . '/wp-includes/class-wp-user.php';
require $root . '/wp-includes/capabilities.php';

function wphx_306_03_seed_roles() {
\t$GLOBALS['wphx_306_03_options'] = array(
\t\t'wp_user_roles' => array(
\t\t\t'administrator' => array(
\t\t\t\t'name' => 'Administrator',
\t\t\t\t'capabilities' => array( 'read' => true, 'edit_posts' => true, 'delete_users' => true, 'manage_options' => true ),
\t\t\t),
\t\t\t'editor' => array(
\t\t\t\t'name' => 'Editor',
\t\t\t\t'capabilities' => array( 'read' => true, 'edit_posts' => true, 'edit_others_posts' => true ),
\t\t\t),
\t\t\t'subscriber' => array(
\t\t\t\t'name' => 'Subscriber',
\t\t\t\t'capabilities' => array( 'read' => true ),
\t\t\t),
\t\t),
\t\t'wp_2_user_roles' => array(
\t\t\t'site_two_editor' => array(
\t\t\t\t'name' => 'Site Two Editor',
\t\t\t\t'capabilities' => array( 'read' => true, 'edit_posts' => true, 'site_two_cap' => true ),
\t\t\t),
\t\t),
\t\t'default_role' => 'subscriber',
\t);
\t$GLOBALS['wp_roles'] = null;
}

function wphx_306_03_make_user( $id, $login, $caps, $site_id = 1 ) {
\t$GLOBALS['wphx_306_03_user_meta'][ $id ] = array(
\t\t$GLOBALS['wpdb']->get_blog_prefix( $site_id ) . 'capabilities' => $caps,
\t);
\t$data = (object) array(
\t\t'ID' => $id,
\t\t'user_login' => $login,
\t\t'user_nicename' => $login,
\t\t'user_email' => $login . '@example.test',
\t\t'user_url' => '',
\t\t'user_registered' => '2026-01-01 00:00:00',
\t\t'user_activation_key' => '',
\t\t'user_status' => '0',
\t\t'display_name' => ucfirst( $login ),
\t);
\t$user = new WP_User();
\t$user->init( $data, $site_id );
\t$GLOBALS['wphx_306_03_user_data'][ $id ] = $data;
\t$GLOBALS['wphx_306_03_users'][ $id ] = $user;
\treturn $user;
}

function wphx_306_03_reset() {
\t$GLOBALS['wphx_306_03_filters'] = array();
\t$GLOBALS['wphx_306_03_user_meta'] = array();
\t$GLOBALS['wphx_306_03_users'] = array();
\t$GLOBALS['wphx_306_03_user_data'] = array();
\t$GLOBALS['wphx_306_03_current_user_id'] = 0;
\t$GLOBALS['wphx_306_03_current_blog_id'] = 1;
\t$GLOBALS['wphx_306_03_switch_log'] = array();
\t$GLOBALS['wpdb']->blogid = 1;
\t$GLOBALS['wpdb']->prefix = $GLOBALS['wpdb']->get_blog_prefix( 1 );
\twphx_306_03_seed_roles();
\twphx_306_03_make_user( 1, 'admin', array( 'administrator' => true ) );
\twphx_306_03_make_user( 2, 'editor', array( 'editor' => true ) );
\twphx_306_03_make_user( 3, 'limited', array( 'editor' => true, 'edit_posts' => false ) );
\twphx_306_03_make_user( 4, 'super', array( 'subscriber' => true ) );
\t$GLOBALS['wphx_306_03_user_meta'][2]['wp_2_capabilities'] = array( 'site_two_editor' => true );
}

function wphx_306_03_export_role( $role ) {
\tif ( ! $role ) {
\t\treturn null;
\t}
\t$caps = $role->capabilities;
\tksort( $caps );
\treturn array( 'name' => $role->name, 'capabilities' => $caps );
}

wphx_306_03_reset();

$observations = array();
$numeric = add_role( 'numeric_role', 'Numeric Role', array( 'read', 'edit_posts' ) );
$observations['role:numeric-capabilities'] = wphx_306_03_export_role( $numeric );
$custom = add_role( 'custom_role', 'Custom Role', array( 'read' => true, 'edit_posts' => true, 'delete_posts' => false ) );
$observations['role:mixed-capabilities'] = wphx_306_03_export_role( $custom );
$custom->add_cap( 'publish_posts' );
$observations['role:add-cap'] = $custom->has_cap( 'publish_posts' );
$custom->remove_cap( 'publish_posts' );
$observations['role:remove-cap'] = $custom->has_cap( 'publish_posts' );
add_filter(
\t'role_has_cap',
\tfunction ( $capabilities, $cap, $name ) {
\t\tif ( 'custom_role' === $name && 'filtered_cap' === $cap ) {
\t\t\t$capabilities['filtered_cap'] = true;
\t\t}
\t\treturn $capabilities;
\t},
\t10,
\t3
);
$observations['role:filter-grant'] = $custom->has_cap( 'filtered_cap' );
remove_role( 'custom_role' );
$observations['role:removed'] = null === get_role( 'custom_role' );

$observations['user:editor-edit-posts'] = user_can( 2, 'edit_posts' );
$observations['user:limited-denied-edit-posts'] = user_can( 3, 'edit_posts' );
add_filter(
\t'user_has_cap',
\tfunction ( $allcaps, $caps, $args, $user ) {
\t\tif ( 2 === $user->ID && 'filtered_user_cap' === $args[0] ) {
\t\t\t$allcaps['filtered_user_cap'] = true;
\t\t}
\t\treturn $allcaps;
\t},
\t10,
\t4
);
$observations['user:filter-grant'] = user_can( 2, 'filtered_user_cap' );
$observations['user:missing-edit-posts'] = user_can( 999, 'edit_posts' );
$observations['user:missing-exist'] = user_can( 999, 'exist' );

$observations['meta:edit-user-self'] = map_meta_cap( 'edit_user', 2, 2 );
$observations['meta:edit-user-other'] = map_meta_cap( 'edit_user', 2, 3 );
$observations['meta:edit-user-invalid'] = map_meta_cap( 'edit_user', 0, 2 );
$observations['meta:remove-user-self-non-super'] = map_meta_cap( 'remove_user', 2, 2 );

$observations['super:is-super-admin'] = is_super_admin( 4 );
$observations['super:manage-network'] = user_can( 4, 'manage_network' );
$observations['super:do-not-allow'] = user_can( 4, 'do_not_allow' );

$GLOBALS['wphx_306_03_current_user_id'] = 2;
$observations['current-user-can:edit-posts'] = current_user_can( 'edit_posts' );
$observations['site:user-can-for-site'] = user_can_for_site( 2, 2, 'site_two_cap' );
$observations['site:switch-log'] = $GLOBALS['wphx_306_03_switch_log'];
$observations['site:restored-blog-id'] = get_current_blog_id();
$observations['errors'] = $GLOBALS['wphx_306_03_php_errors'];

ksort( $observations );
echo json_encode(
\tarray(
\t\t'mode' => $mode,
\t\t'observations' => $observations,
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
);
`
  );
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-306-capability-role`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function runProbe(mode, root) {
  const output = command("php", [PROBE, mode, root]);
  return {
    mode,
    command: `php ${PROBE} ${mode} ${root}`,
    raw_output_sha256: sha256(output),
    result: JSON.parse(output)
  };
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/user-capability-role-fixture",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "oracle_fixture",
      name: "users/auth capability and role differential fixture",
      area: "wp-includes/capabilities.php wp-includes/class-wp-role.php wp-includes/class-wp-roles.php wp-includes/class-wp-user.php",
      public_contract:
        "This fixture records vanilla WordPress capability and role behavior that the Haxe auth adapter must satisfy. It does not claim Haxe-owned public PHP replacement."
    },
    ownership_state: "oracle_fixture",
    ownership_axes: {
      semantic_owner: "upstream_oracle",
      adapter_contract_owner: "not_claimed",
      emission_strategy: "upstream_source_mirror_fixture",
      execution_provider: "php_oracle_process",
      compatibility_evidence: "targeted_semantic_parity"
    },
    bridge: {
      exists: true,
      kind: "oracle-source-mirror-fixture",
      removal_gate:
        "Replace candidate mirror with generated original-path PHP once WPHX-306 public adapter contracts exist."
    },
    owned_paths: [
      "tools/wp-core/run-user-capability-role-fixture.mjs",
      OUT,
      OWNERSHIP,
      RECEIPT
    ],
    generated_paths: [OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-306-capability-role",
        "npm run wp:core:wphx-306-capability-role:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-306-03-capability-role-fixture"],
      manifest_digest: manifestSha
    }
  };
}

rmSync(OUT_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
writeProbe();

const oracleRun = runProbe("oracle", ORACLE_ROOT);
const candidateRun = runProbe("candidate", CANDIDATE_ROOT);
const observationsEqual = JSON.stringify(oracleRun.result.observations) === JSON.stringify(candidateRun.result.observations);

if (!observationsEqual) {
  console.error(JSON.stringify({ status: "failed", oracle: oracleRun.result, candidate: candidateRun.result }, null, 2));
  process.exit(1);
}

const manifest = {
  schema: "wphx.wp-core-user-capability-role-fixture.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: "tools/wp-core/run-user-capability-role-fixture.mjs",
  upstream: {
    repo: UPSTREAM_ROOT,
    commit: WP_REF,
    source_files: SOURCE_FILES.map(sourceRecord)
  },
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    foundation_manifest: inputRecord(FOUNDATION)
  },
  fixture: {
    evidence_class: "targeted_semantic_parity",
    artifact_scope: "oracle_source_mirror_fixture",
    source_files: SOURCE_FILES,
    covered_symbols: COVERED_SYMBOLS,
    cases: FIXTURE_CASES,
    candidate_policy: {
      public_php_replacement_claimed: false,
      haxe_semantic_ownership_claimed: false,
      handwritten_production_php_added: false,
      note:
        "The candidate side currently mirrors locked upstream source to establish a stable differential fixture. A later WPHX-306 slice must replace the candidate mirror with generated original-path PHP before ownership can be upgraded."
    }
  },
  runs: {
    oracle: oracleRun,
    candidate: candidateRun,
    observations_equal: observationsEqual
  },
  parity: {
    status: observationsEqual ? "passed" : "failed",
    oracle_observation_sha256: sha256(JSON.stringify(oracleRun.result.observations)),
    candidate_observation_sha256: sha256(JSON.stringify(candidateRun.result.observations))
  },
  remaining_gaps: [
    {
      id: "generated-auth-adapter-not-installed",
      owner: "WPHX-306",
      detail:
        "Capability and role behavior is only proven between upstream mirrors. Generated public PHP and typed Adapter IR are not yet installed."
    },
    {
      id: "db-backed-role-storage-not-live",
      owner: "WPHX-306",
      detail:
        "The fixture uses deterministic in-memory option/user-meta stubs. Installed distribution and upstream PHPUnit gates must later cover live database behavior."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: observationsEqual ? "passed" : "failed",
    cases: FIXTURE_CASES.length,
    covered_symbols: COVERED_SYMBOLS.length,
    public_php_replacement_claimed: false,
    artifact_scope: "oracle_source_mirror_fixture"
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-306-03-capability-role-fixture",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "capability and role differential fixture manifest" },
    { path: OWNERSHIP, role: "ownership manifest for capability and role fixture" },
    { path: "tools/wp-core/run-user-capability-role-fixture.mjs", role: "fixture generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-306-capability-role",
    "npm run wp:core:wphx-306-capability-role:check",
    "npm run beads:validate",
    "npm run receipts:validate"
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

console.log(JSON.stringify({ status: "passed", output: OUT, ownership: OWNERSHIP, receipt: RECEIPT }, null, 2));
