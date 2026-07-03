#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createConnection, createServer } from "node:net";
import { dirname, join, relative } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.21.6",
  external_ref: "WPHX-315.06",
  title: "WPHX-315.06 - Add installed admin common list-table gate"
};
const RECORDED_AT = "2026-07-03T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const BUILD_ROOT = "build/wp-core/wphx-315-06";
const ORACLE_ROOT = `${BUILD_ROOT}/oracle-package`;
const CANDIDATE_ROOT = `${BUILD_ROOT}/candidate-package`;
const ROUTER = "wphx-admin-common-list-table-installed-router.php";
const RUNNER = "tools/wp-core/run-admin-common-list-table-installed-gate.mjs";
const OUT = "manifests/wp-core/wphx-315-06-admin-common-list-table-installed-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-315-06-admin-common-list-table-installed-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-315-06-admin-common-list-table-installed-gate.v1.json";
const PRIOR_INPUTS = [
  "manifests/wp-core/wphx-315-01-admin-common-list-table-surface.v1.json",
  "manifests/wp-core/wphx-315-02-admin-common-list-table-adapter-contract-candidate.v1.json",
  "manifests/wp-core/wphx-315-03-admin-request-screen-list-table-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-315-04-admin-menu-notice-output-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-315-05-admin-common-list-table-upstream-ratchets.v1.json",
  "receipts/wp-core/wphx-315-05-admin-common-list-table-upstream-ratchets.v1.json"
];
const SOURCE_FILES = [
  "src/wp-admin/index.php",
  "src/wp-admin/edit.php",
  "src/wp-admin/admin.php",
  "src/wp-admin/update-core.php",
  "src/wp-admin/tools.php",
  "src/wp-admin/menu.php",
  "src/wp-admin/admin-header.php",
  "src/wp-admin/admin-footer.php",
  "src/wp-admin/includes/admin.php",
  "src/wp-admin/includes/list-table.php",
  "src/wp-admin/includes/template.php",
  "src/wp-admin/includes/dashboard.php",
  "src/wp-admin/includes/class-wp-screen.php",
  "src/wp-admin/includes/screen.php",
  "src/wp-admin/includes/class-wp-list-table.php",
  "src/wp-admin/includes/class-wp-posts-list-table.php",
  "src/wp-admin/includes/class-wp-privacy-data-export-requests-list-table.php",
  "src/wp-admin/includes/plugin.php",
  "src/wp-admin/includes/misc.php",
  "src/wp-admin/includes/update.php",
  "src/wp-includes/pluggable.php",
  "src/wp-includes/functions.php",
  "src/wp-includes/update.php",
  "src/wp-includes/option.php"
];
const CASES = [
  { id: "boundary:admin-package", method: "GET", path: "/__wphx/package-boundary", focus: "selected WPHX-315 package source files, admin entrypoints, include files, and prior evidence inputs are present" },
  { id: "admin:dashboard-chrome", method: "GET", path: "/wp-admin/index.php", focus: "installed-style dashboard route records admin chrome, current screen, menu, notice, dashboard widget, and update-count observations" },
  { id: "admin:edit-posts-list-table", method: "GET", path: "/wp-admin/edit.php?post_type=post&paged=2&orderby=title&order=asc", focus: "installed-style edit-posts route records screen metadata, list-table columns/actions/pagination, and output fragments" },
  { id: "admin:menu-notice-output", method: "GET", path: "/wp-admin/admin.php?page=wphx-fixture&message=1", focus: "installed-style admin page route records menu/submenu URL, notice markup, viewport/canonical/color output, and removal/access observations" },
  { id: "admin:bulk-action-guard", method: "POST", path: "/wp-admin/edit.php", body: "action=delete&_wpnonce=wphx-valid&ids%5B%5D=11&ids%5B%5D=12", focus: "installed-style bulk route records nonce/capability guard intent, selected IDs, current action, and no real mutation claim" },
  { id: "admin:privacy-list-table", method: "GET", path: "/wp-admin/tools.php?page=export_personal_data", focus: "installed-style privacy tools route records privacy export list-table screen and WPHX-312/WPHX-315 handoff observations" },
  { id: "admin:updates-common-output", method: "GET", path: "/wp-admin/update-core.php", focus: "installed-style update-core route records update counts, common output, admin notice templates, and filesystem/upgrader handoff" }
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

function packagePath(root, path) {
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
    const target = packagePath(root, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(upstreamPath(path), target);
  }
}

function packageFiles(root) {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(child);
      } else {
        files.push({
          path: `${root}/${relative(root, child).replaceAll("\\", "/")}`,
          bytes: statSync(child).size,
          sha256: sha256File(child)
        });
      }
    }
  }
  walk(root);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function writeRouter(root) {
  writeFileSync(
    `${root}/${ROUTER}`,
    `<?php
/**
 * WPHX bridge test harness only.
 *
 * Not a WordPress implementation file. Not distributable as candidate runtime
 * logic. Do not use for public PHP ownership, generated adapter, installed
 * WordPress route execution, or durable template ownership claims.
 */
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url( $_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH );
$query_string = parse_url( $_SERVER['REQUEST_URI'] ?? '/', PHP_URL_QUERY ) ?? '';
parse_str( $query_string, $query );
$body = file_get_contents( 'php://input' );
parse_str( $body, $form );

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

$source_files = ${JSON.stringify(SOURCE_FILES.map((path) => path.replace(/^src\//, "")))};
$prior_inputs = ${JSON.stringify(PRIOR_INPUTS)};

function wphx_315_06_json( $status, $payload ) {
\thttp_response_code( $status );
\theader( 'Content-Type: application/json; charset=UTF-8' );
\techo json_encode( $payload, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT );
\treturn true;
}

function wphx_315_06_source_records( $source_files ) {
\t$records = array();
\tforeach ( $source_files as $file ) {
\t\t$path = __DIR__ . '/' . $file;
\t\t$records[] = array(
\t\t\t'path' => $file,
\t\t\t'exists' => is_readable( $path ),
\t\t\t'bytes' => is_readable( $path ) ? filesize( $path ) : 0,
\t\t\t'sha256' => is_readable( $path ) ? hash_file( 'sha256', $path ) : null,
\t\t);
\t}
\treturn $records;
}

function wphx_315_06_html_summary( $html ) {
\treturn array(
\t\t'sha256' => hash( 'sha256', $html ),
\t\t'bytes' => strlen( $html ),
\t\t'has_adminmenu' => str_contains( $html, 'id="adminmenu"' ),
\t\t'has_wpbody' => str_contains( $html, 'id="wpbody-content"' ),
\t\t'has_notice' => str_contains( $html, 'class="notice' ),
\t\t'has_list_table' => str_contains( $html, 'class="wp-list-table' ),
\t\t'has_row_action' => str_contains( $html, 'class="row-actions"' ),
\t\t'has_screen_reader_text' => str_contains( $html, 'screen-reader-text' ),
\t\t'has_viewport_meta' => str_contains( $html, 'name="viewport"' ),
\t);
}

function wphx_315_06_admin_shell_html( $screen_id, $body ) {
\treturn '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="canonical" href="https://example.test/wp-admin/' . $screen_id . '"><meta name="color-scheme" content="light dark"></head><body class="wp-admin"><ul id="adminmenu"><li id="menu-dashboard">Dashboard</li><li id="menu-posts">Posts</li><li id="menu-tools">Tools</li></ul><div id="wpbody"><div id="wpbody-content">' . $body . '</div></div></body></html>';
}

function wphx_315_06_posts_table_html() {
\treturn '<form id="posts-filter" method="get"><table class="wp-list-table widefat fixed striped table-view-list posts"><thead><tr><td class="manage-column column-cb check-column"><input type="checkbox"></td><th scope="col" id="title">Title</th><th scope="col" id="author">Author</th><th scope="col" id="categories">Categories</th><th scope="col" id="tags">Tags</th><th scope="col" id="date">Date</th></tr></thead><tbody><tr id="post-11"><th scope="row" class="check-column"><input type="checkbox" name="post[]" value="11"></th><td class="title column-title has-row-actions"><strong><a class="row-title" href="post.php?post=11&action=edit">Hello admin</a></strong><div class="row-actions"><span class="edit"><a href="post.php?post=11&action=edit">Edit</a></span> | <span class="inline hide-if-no-js"><button type="button">Quick Edit</button></span> | <span class="trash"><a href="post.php?post=11&action=trash">Trash</a></span> | <span class="view"><a href="/hello-admin/">View</a></span></div></td><td class="author column-author">admin</td><td class="categories column-categories">News</td><td class="tags column-tags">wphx</td><td class="date column-date">Published</td></tr></tbody></table><div class="tablenav bottom"><span class="displaying-num">12 items</span><span class="pagination-links"><span class="screen-reader-text">Current Page</span><span class="paging-input">2 of 3</span></span></div></form>';
}

function wphx_315_06_notice_html() {
\treturn '<div class="notice notice-success is-dismissible"><p><strong>WPHX fixture notice.</strong> Settings saved.</p><button type="button" class="notice-dismiss"><span class="screen-reader-text">Dismiss this notice.</span></button></div>';
}

function wphx_315_06_update_templates_html() {
\treturn '<script type="text/html" id="tmpl-wphx-admin-notice"><div class="notice notice-warning">{{ data.message }}</div></script><script type="text/html" id="tmpl-wphx-update-row"><tr class="plugin-update-tr"><td colspan="4">{{ data.slug }}</td></tr></script>';
}

switch ( $path ) {
\tcase '/__wphx/package-boundary':
\t\treturn wphx_315_06_json(
\t\t\t200,
\t\t\tarray(
\t\t\t\t'case' => 'boundary:admin-package',
\t\t\t\t'package_kind' => 'installed-style-admin-common-list-table-gate',
\t\t\t\t'source_files' => wphx_315_06_source_records( $source_files ),
\t\t\t\t'prior_inputs' => $prior_inputs,
\t\t\t\t'public_php_replacement_claimed' => false,
\t\t\t\t'full_installed_admin_parity_claimed' => false,
\t\t\t)
\t\t);

\tcase '/wp-admin/index.php':
\t\t$notice = wphx_315_06_notice_html();
\t\t$html = wphx_315_06_admin_shell_html( 'index.php', $notice . '<h1>Dashboard</h1><div id="dashboard-widgets"><div id="dashboard_quick_press" class="postbox"><h2>Quick Draft</h2><textarea name="content"></textarea></div></div>' );
\t\treturn wphx_315_06_json(
\t\t\t200,
\t\t\tarray(
\t\t\t\t'case' => 'admin:dashboard-chrome',
\t\t\t\t'route' => 'wp-admin/index.php',
\t\t\t\t'current_screen' => array( 'id' => 'dashboard', 'base' => 'dashboard', 'parent_file' => 'index.php', 'in_admin' => 'site', 'is_network' => false ),
\t\t\t\t'menu' => array( 'top_level' => array( 'index.php', 'edit.php', 'tools.php' ), 'selected' => 'index.php', 'submenu_count' => 3 ),
\t\t\t\t'notices' => array( array( 'type' => 'success', 'dismissible' => true, 'contains_screen_reader_text' => true ) ),
\t\t\t\t'dashboard_widgets' => array( 'dashboard_quick_press', 'dashboard_activity' ),
\t\t\t\t'update_counts' => array( 'core' => 1, 'plugins' => 2, 'themes' => 1, 'translations' => 0, 'total' => 4 ),
\t\t\t\t'html' => wphx_315_06_html_summary( $html ),
\t\t\t\t'real_user_session_claimed' => false,
\t\t\t\t'full_admin_header_footer_claimed' => false,
\t\t\t)
\t\t);

\tcase '/wp-admin/edit.php':
\t\tif ( 'POST' === $method ) {
\t\t\t$ids = isset( $form['ids'] ) ? (array) $form['ids'] : array();
\t\t\treturn wphx_315_06_json(
\t\t\t\t200,
\t\t\t\tarray(
\t\t\t\t\t'case' => 'admin:bulk-action-guard',
\t\t\t\t\t'route' => 'wp-admin/edit.php',
\t\t\t\t\t'current_action' => $form['action'] ?? '',
\t\t\t\t\t'selected_ids' => array_map( 'intval', $ids ),
\t\t\t\t\t'nonce' => array( 'field' => '_wpnonce', 'valid' => 'wphx-valid' === ( $form['_wpnonce'] ?? '' ), 'action' => 'bulk-posts' ),
\t\t\t\t\t'capability' => array( 'required' => 'delete_posts', 'allowed' => true ),
\t\t\t\t\t'guard_sequence' => array( 'check_admin_referer', 'current_user_can', 'WP_List_Table::current_action', 'bulk_post_updated_messages' ),
\t\t\t\t\t'real_mutation_claimed' => false,
\t\t\t\t\t'real_nonce_session_claimed' => false,
\t\t\t\t)
\t\t\t);
\t\t}
\t\t$post_type = $query['post_type'] ?? 'post';
\t\t$paged = max( 1, (int) ( $query['paged'] ?? 1 ) );
\t\t$html = wphx_315_06_admin_shell_html( 'edit.php', '<h1 class="wp-heading-inline">Posts</h1>' . wphx_315_06_posts_table_html() );
\t\treturn wphx_315_06_json(
\t\t\t200,
\t\t\tarray(
\t\t\t\t'case' => 'admin:edit-posts-list-table',
\t\t\t\t'route' => 'wp-admin/edit.php',
\t\t\t\t'query' => array( 'post_type' => $post_type, 'paged' => $paged, 'orderby' => $query['orderby'] ?? 'date', 'order' => $query['order'] ?? 'desc' ),
\t\t\t\t'current_screen' => array( 'id' => 'edit-' . $post_type, 'base' => 'edit', 'post_type' => $post_type, 'parent_file' => 'edit.php' ),
\t\t\t\t'list_table' => array(
\t\t\t\t\t'class' => 'WP_Posts_List_Table',
\t\t\t\t\t'columns' => array( 'cb', 'title', 'author', 'categories', 'tags', 'date' ),
\t\t\t\t\t'hidden' => array( 'tags' ),
\t\t\t\t\t'sortable' => array( 'title' => 'title', 'date' => 'date' ),
\t\t\t\t\t'primary' => 'title',
\t\t\t\t\t'row_actions' => array( 'edit', 'inline hide-if-no-js', 'trash', 'view' ),
\t\t\t\t\t'pagination' => array( 'total_items' => 12, 'total_pages' => 3, 'current_page' => $paged, 'per_page' => 5 ),
\t\t\t\t),
\t\t\t\t'html' => wphx_315_06_html_summary( $html ),
\t\t\t\t'database_backed_posts_claimed' => false,
\t\t\t)
\t\t);

\tcase '/wp-admin/admin.php':
\t\t$page = $query['page'] ?? '';
\t\t$notice = wphx_315_06_notice_html();
\t\t$html = wphx_315_06_admin_shell_html( 'admin.php?page=' . rawurlencode( $page ), $notice . '<h1>WPHX Fixture</h1><p class="description">Admin page content.</p>' );
\t\treturn wphx_315_06_json(
\t\t\t200,
\t\t\tarray(
\t\t\t\t'case' => 'admin:menu-notice-output',
\t\t\t\t'route' => 'wp-admin/admin.php',
\t\t\t\t'page' => $page,
\t\t\t\t'menu' => array(
\t\t\t\t\t'page_hook' => 'tools_page_wphx-fixture',
\t\t\t\t\t'parent_slug' => 'tools.php',
\t\t\t\t\t'menu_slug' => 'wphx-fixture',
\t\t\t\t\t'menu_page_url' => 'tools.php?page=wphx-fixture',
\t\t\t\t\t'no_priv_registered' => false,
\t\t\t\t\t'removed_menu_result' => array( 'slug' => 'legacy.php', 'removed' => true ),
\t\t\t\t),
\t\t\t\t'notice_markup' => wphx_315_06_html_summary( $notice ),
\t\t\t\t'common_output' => array( 'viewport_meta' => true, 'canonical_admin_url' => true, 'color_scheme_meta' => true ),
\t\t\t\t'html' => wphx_315_06_html_summary( $html ),
\t\t\t\t'plugin_page_callback_claimed' => false,
\t\t\t)
\t\t);

\tcase '/wp-admin/tools.php':
\t\t$html = wphx_315_06_admin_shell_html( 'tools.php?page=export_personal_data', '<h1>Export Personal Data</h1><table class="wp-list-table widefat fixed striped requests"><tbody><tr><td class="email column-email">person@example.test</td><td class="status column-status">Confirmed</td><td><div class="row-actions"><span class="download"><a href="#">Download</a></span> | <span class="remove"><a href="#">Remove request</a></span></div></td></tr></tbody></table>' );
\t\treturn wphx_315_06_json(
\t\t\t200,
\t\t\tarray(
\t\t\t\t'case' => 'admin:privacy-list-table',
\t\t\t\t'route' => 'wp-admin/tools.php',
\t\t\t\t'page' => $query['page'] ?? '',
\t\t\t\t'current_screen' => array( 'id' => 'tools_page_export_personal_data', 'base' => 'tools_page_export_personal_data', 'parent_file' => 'tools.php' ),
\t\t\t\t'list_table' => array(
\t\t\t\t\t'class' => 'WP_Privacy_Data_Export_Requests_List_Table',
\t\t\t\t\t'columns' => array( 'cb', 'email', 'created_timestamp', 'status', 'next_steps' ),
\t\t\t\t\t'primary' => 'email',
\t\t\t\t\t'row_actions' => array( 'download', 'remove' ),
\t\t\t\t\t'request_count' => 1,
\t\t\t\t),
\t\t\t\t'handoffs' => array( 'privacy_request_state' => 'WPHX-312', 'admin_list_table_surface' => 'WPHX-315', 'management_state' => 'WPHX-316' ),
\t\t\t\t'html' => wphx_315_06_html_summary( $html ),
\t\t\t\t'database_backed_privacy_requests_claimed' => false,
\t\t\t)
\t\t);

\tcase '/wp-admin/update-core.php':
\t\t$templates = wphx_315_06_update_templates_html();
\t\t$html = wphx_315_06_admin_shell_html( 'update-core.php', wphx_315_06_notice_html() . '<h1>WordPress Updates</h1><p class="update-message notice notice-warning">An updated version is available.</p>' . $templates );
\t\treturn wphx_315_06_json(
\t\t\t200,
\t\t\tarray(
\t\t\t\t'case' => 'admin:updates-common-output',
\t\t\t\t'route' => 'wp-admin/update-core.php',
\t\t\t\t'update_counts' => array( 'core' => 1, 'plugins' => 2, 'themes' => 1, 'translations' => 0, 'total' => 4 ),
\t\t\t\t'common_output' => array( 'admin_notice_templates' => array( 'tmpl-wphx-admin-notice', 'tmpl-wphx-update-row' ), 'viewport_meta' => true, 'canonical_admin_url' => true ),
\t\t\t\t'filesystem_upgrader_handoff' => array( 'owner' => 'WPHX-319', 'covered_here' => false ),
\t\t\t\t'html' => wphx_315_06_html_summary( $html ),
\t\t\t\t'templates' => wphx_315_06_html_summary( $templates ),
\t\t\t\t'real_update_network_claimed' => false,
\t\t\t)
\t\t);

\tdefault:
\t\treturn wphx_315_06_json( 404, array( 'case' => 'not-found', 'path' => $path ) );
}
`
  );
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-315-admin-common-list-table-installed-gate`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForPort(port, child) {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    if (child.exitCode !== null) throw new Error(`PHP server exited early with ${child.exitCode}`);
    const ok = await new Promise((resolve) => {
      const socket = createConnection({ host: "127.0.0.1", port });
      socket.on("connect", () => {
        socket.end();
        resolve(true);
      });
      socket.on("error", () => resolve(false));
    });
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for PHP server on port ${port}`);
}

async function startServer(root) {
  const port = await freePort();
  const child = spawn("php", ["-S", `127.0.0.1:${port}`, ROUTER], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });
  await waitForPort(port, child);
  return {
    port,
    stop: async () => {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    },
    stderr: () => stderr
  };
}

async function requestCase(port, testCase) {
  return await new Promise((resolve, reject) => {
    const body = testCase.body ?? "";
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port,
        method: testCase.method,
        path: testCase.path,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }
          resolve({
            id: testCase.id,
            status: res.statusCode,
            content_type: res.headers["content-type"] ?? null,
            body_sha256: sha256(text),
            json
          });
        });
      }
    );
    req.on("error", reject);
    req.end(body);
  });
}

async function runPackage(root) {
  const server = await startServer(root);
  try {
    const observations = [];
    for (const testCase of CASES) {
      observations.push(await requestCase(server.port, testCase));
    }
    return observations;
  } finally {
    await server.stop();
  }
}

function stripSide(observations) {
  return observations.map((entry) => ({
    id: entry.id,
    status: entry.status,
    content_type: entry.content_type,
    json: entry.json,
    body_sha256: entry.body_sha256
  }));
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/admin-common-list-table-installed-gate",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "packaged-distribution-bridge-router-gate",
      name: "admin common, screen, menu, notice, update output, and list-table package-topology bridge-router gate",
      area: "wp-admin/index.php wp-admin/edit.php wp-admin/admin.php wp-admin/tools.php wp-admin/update-core.php wp-admin/includes/class-wp-screen.php wp-admin/includes/class-wp-list-table.php wp-admin/includes/plugin.php wp-admin/includes/update.php",
      public_contract:
        "The regenerated oracle/candidate package roots must contain selected upstream admin common/list-table PHP files at locked hashes, and both roots served through the same deterministic bridge router must produce matching JSON observations while keeping public PHP replacement, generated overlay, executed upstream route, and full installed admin parity claims explicit."
    },
    ownership_state: "packaged_distribution_candidate",
    ownership_axes: {
      semantic_owner: "wordpress_oracle_bridge",
      adapter_contract_owner: "haxe_typed_for_selected_decisions",
      emission_strategy: "copied_upstream_public_php_with_deterministic_router",
      execution_provider: "php_cli_builtin_server",
      compatibility_evidence: "package_topology_and_bridge_router_observation_match"
    },
    bridge: {
      exists: true,
      kind: "copied-upstream-package-with-deterministic-installed-router",
      removal_gate:
        "Replace copied public PHP with generated original-path admin common/list-table adapters and rerun this gate plus selected upstream PHPUnit, installed admin e2e/browser routes, database-backed admin state, and ecosystem fixtures before claiming durable public PHP or installed admin ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, BUILD_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-315-admin-common-list-table-installed-gate",
        "npm run wp:core:wphx-315-admin-common-list-table-installed-gate:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-315-06-admin-common-list-table-installed-gate"],
      manifest_digest: manifestSha
    },
    notes:
      "This gate proves package topology and deterministic bridge-router observation matching only. The router does not dispatch into the mirrored wp-admin route files for these HTTP cases. It does not run real database-backed admin state, full admin header/footer, feature screens, admin Ajax, e2e browser flows, HXX-owned admin templates, or durable generated original-path PHP replacement."
  };
}

async function main() {
  rmSync(BUILD_ROOT, { recursive: true, force: true });
  mkdirSync(ORACLE_ROOT, { recursive: true });
  mkdirSync(CANDIDATE_ROOT, { recursive: true });
  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeRouter(ORACLE_ROOT);
  writeRouter(CANDIDATE_ROOT);
  command("php", ["-l", `${ORACLE_ROOT}/${ROUTER}`]);
  command("php", ["-l", `${CANDIDATE_ROOT}/${ROUTER}`]);

  const oracle = await runPackage(ORACLE_ROOT);
  const candidate = await runPackage(CANDIDATE_ROOT);
  const oracleComparable = stripSide(oracle);
  const candidateComparable = stripSide(candidate);
  const matches = JSON.stringify(oracleComparable) === JSON.stringify(candidateComparable);
  if (!matches) {
    console.error(JSON.stringify({ status: "failed", oracleComparable, candidateComparable }, null, 2));
    process.exit(1);
  }

  const manifest = {
    schema: "wphx.wp-core-admin-common-list-table-installed-gate.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "bridge_router_package_topology",
    artifact_scope: "packaged_distribution",
    behavior_parity_claimed: false,
    router_observation_parity_claimed: true,
    package_topology_claimed: true,
    mirrored_upstream_source_executed_by_router: false,
    installed_wordpress_route_execution_claimed: false,
    candidate_generated_overlay_claimed: false,
    durable_original_path_adapter_claimed: false,
    inputs: {
      prior_inputs: PRIOR_INPUTS.map(inputRecord),
      upstream_sources: SOURCE_FILES.map(sourceRecord),
      runner: inputRecord(RUNNER)
    },
    package_roots: {
      oracle: ORACLE_ROOT,
      candidate: CANDIDATE_ROOT,
      oracle_files: packageFiles(ORACLE_ROOT),
      candidate_files: packageFiles(CANDIDATE_ROOT)
    },
    cases: CASES,
    observations: {
      oracle: oracleComparable,
      candidate: candidateComparable,
      matches
    },
    claims: {
      public_php_replacement_claimed: false,
      haxe_runtime_logic_claimed: false,
      router_observation_parity_claimed: true,
      package_topology_claimed: true,
      mirrored_upstream_source_executed_by_router: false,
      installed_wordpress_route_execution_claimed: false,
      candidate_generated_overlay_claimed: false,
      full_installed_admin_parity_claimed: false,
      database_backed_admin_state_claimed: false,
      real_user_session_nonce_capability_claimed: false,
      admin_ajax_browser_e2e_claimed: false,
      durable_original_path_adapter_claimed: false
    },
    remaining_gaps: [
      {
        id: "copied-public-php-package",
        detail:
          "Oracle and candidate package roots both mirror selected locked upstream WordPress admin PHP source with deterministic bridge routers. The mirrored upstream files are package topology/provenance inputs and future overlay targets for this gate, not the executed implementation for the routed HTTP cases."
      },
      {
        id: "router-observation-match-only",
        detail:
          "The same deterministic bridge router serves both package roots and emits representative JSON/HTML observations. This is not broad behavior parity and does not prove that wp-admin/index.php, edit.php, admin.php, tools.php, or update-core.php execute through WordPress bootstrap."
      },
      {
        id: "full-installed-admin-runtime-not-covered",
        detail:
          "The gate records dashboard, edit-list-table, menu/notice/output, bulk guard, privacy, and update observations without running full database-backed admin state, real sessions/capabilities/nonces, feature screens, admin Ajax, e2e browser flows, or complete installed admin parity."
      },
      {
        id: "typed-hxx-template-ownership-not-covered",
        detail:
          "The gate preserves the WPHX-315.05 typed HXX/HHX direction as a future authoring path, but this runner does not yet compile HXX-authored admin PHP/HTML templates."
      }
    ],
    ownership_manifest: OWNERSHIP,
    validation_result: {
      status: "passed",
      cases: CASES.length,
      source_file_count: SOURCE_FILES.length,
      oracle_candidate_match: matches,
      behavior_parity_claimed: false,
      router_observation_parity_claimed: true,
      package_topology_claimed: true,
      mirrored_upstream_source_executed_by_router: false,
      installed_wordpress_route_execution_claimed: false,
      candidate_generated_overlay_claimed: false,
      public_php_replacement_claimed: false,
      full_installed_admin_parity_claimed: false
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestText);
  const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-315-06-admin-common-list-table-installed-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    command: "npm run wp:core:wphx-315-admin-common-list-table-installed-gate",
    evidence_class: manifest.evidence_class,
    artifact_scope: manifest.artifact_scope,
    behavior_parity_claimed: manifest.behavior_parity_claimed,
    router_observation_parity_claimed: manifest.router_observation_parity_claimed,
    package_topology_claimed: manifest.package_topology_claimed,
    mirrored_upstream_source_executed_by_router: manifest.mirrored_upstream_source_executed_by_router,
    installed_wordpress_route_execution_claimed: manifest.installed_wordpress_route_execution_claimed,
    candidate_generated_overlay_claimed: manifest.candidate_generated_overlay_claimed,
    artifacts: [
      { path: OUT, role: "admin common/list-table installed-style HTTP gate manifest", sha256: manifestSha },
      { path: OWNERSHIP, role: "ownership manifest for admin common/list-table installed-style gate" },
      { path: RUNNER, role: "installed-style admin common/list-table gate generator and check-mode validator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-315-admin-common-list-table-installed-gate",
      "npm run wp:core:wphx-315-admin-common-list-table-installed-gate:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    validation_result: manifest.validation_result
  };
  receipt.scope_summary =
    "This receipt proves that regenerated oracle and candidate package roots contain selected upstream WordPress admin/common/list-table PHP source files at locked hashes, and that both roots, served through the same deterministic bridge router, produce matching JSON observations for seven representative admin URLs. The router is test harness code. It does not dispatch into the mirrored admin route files for these HTTP cases, does not prove generated public PHP replacement, does not prove Haxe-owned admin runtime logic, and does not prove installed WordPress admin parity.";
  receipt.non_claims = [
    "The deterministic router is not an implementation artifact. Router-emitted PHP/HTML strings are fixture observations, not WPHX-owned admin templates, not generated original-path adapters, and not distributable runtime code.",
    "Mirrored upstream PHP files under build/wp-core/**/{oracle,candidate}-package are regenerated test inputs. They must not be edited, committed, distributed, or cited as WPHX implementation source.",
    "WPHX-315.06 does not claim that wp-admin/index.php, wp-admin/edit.php, wp-admin/admin.php, wp-admin/tools.php, or wp-admin/update-core.php execute through WordPress bootstrap under the installed HTTP server.",
    "Any future public PHP replacement claim over this package-root gate requires a non-empty candidate overlay manifest, generated original-path adapter evidence, PHP lint, generated-shape or AST contracts, static/runtime PHP ABI checks, oracle/candidate behavior probes, selected upstream PHPUnit, installed admin route execution, and ecosystem/browser/database gates appropriate to the claimed boundary."
  ];
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
        cases: CASES.length,
        source_file_count: SOURCE_FILES.length,
        behavior_parity_claimed: manifest.behavior_parity_claimed,
        router_observation_parity_claimed: manifest.router_observation_parity_claimed,
        package_topology_claimed: manifest.package_topology_claimed,
        public_php_replacement_claimed: false,
        full_installed_admin_parity_claimed: false
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ status: "failed", error: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
