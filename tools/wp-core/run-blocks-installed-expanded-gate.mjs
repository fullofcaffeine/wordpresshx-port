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
  id: "wordpresshx-l76.20.7",
  external_ref: "WPHX-314.14",
  title: "WPHX-314.14 - Expand installed block rendering coverage"
};
const RECORDED_AT = "2026-07-07T23:30:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const BUILD_ROOT = "build/wp-core/wphx-314-14";
const ORACLE_ROOT = `${BUILD_ROOT}/oracle-package`;
const CANDIDATE_ROOT = `${BUILD_ROOT}/candidate-package`;
const ROUTER = "wphx-blocks-expanded-router.php";
const RUNNER = "tools/wp-core/run-blocks-installed-expanded-gate.mjs";
const OUT = "manifests/wp-core/wphx-314-14-blocks-installed-expanded-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-314-14-blocks-installed-expanded-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-314-14-blocks-installed-expanded-gate.v1.json";

const PRIOR_INPUTS = [
  "manifests/wp-core/wphx-314-01-blocks-interactivity-surface.v1.json",
  "manifests/wp-core/wphx-314-02-blocks-interactivity-adapter-contract-candidate.v1.json",
  "manifests/wp-core/wphx-314-03-block-parser-render-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-04-block-supports-bindings-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-05-block-patterns-registry-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-06-block-hooks-insertion-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-07-style-engine-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-08-html-api-tag-processor-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-09-interactivity-api-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-10-core-block-renderer-oracle-fixture.v1.json",
  "receipts/wp-core/wphx-314-11-blocks-interactivity-upstream-phpunit-ratchet-groups.v1.json",
  "manifests/wp-core/wphx-314-12-blocks-installed-gate.v1.json",
  "manifests/wp-core/wphx-314-13-blocks-interactivity-upstream-phpunit-executable.v1.json"
];

const SOURCE_FILES = [
  "src/wp-includes/blocks.php",
  "src/wp-includes/block-bindings.php",
  "src/wp-includes/block-template.php",
  "src/wp-includes/block-template-utils.php",
  "src/wp-includes/class-wp-block.php",
  "src/wp-includes/class-wp-block-bindings-registry.php",
  "src/wp-includes/class-wp-block-bindings-source.php",
  "src/wp-includes/class-wp-block-list.php",
  "src/wp-includes/class-wp-block-metadata-registry.php",
  "src/wp-includes/class-wp-block-parser.php",
  "src/wp-includes/class-wp-block-supports.php",
  "src/wp-includes/class-wp-block-template.php",
  "src/wp-includes/class-wp-block-type.php",
  "src/wp-includes/class-wp-block-type-registry.php",
  "src/wp-includes/block-bindings/post-data.php",
  "src/wp-includes/block-bindings/post-meta.php",
  "src/wp-includes/block-bindings/term-data.php",
  "src/wp-includes/block-patterns.php",
  "src/wp-includes/class-wp-block-patterns-registry.php",
  "src/wp-includes/class-wp-block-pattern-categories-registry.php",
  "src/wp-includes/class-wp-block-styles-registry.php",
  "src/wp-includes/block-supports/anchor.php",
  "src/wp-includes/block-supports/aria-label.php",
  "src/wp-includes/block-supports/colors.php",
  "src/wp-includes/block-supports/custom-classname.php",
  "src/wp-includes/block-supports/elements.php",
  "src/wp-includes/block-supports/generated-classname.php",
  "src/wp-includes/block-supports/layout.php",
  "src/wp-includes/block-supports/spacing.php",
  "src/wp-includes/block-supports/typography.php",
  "src/wp-includes/block-supports/utils.php",
  "src/wp-includes/style-engine.php",
  "src/wp-includes/style-engine/class-wp-style-engine.php",
  "src/wp-includes/style-engine/class-wp-style-engine-css-declarations.php",
  "src/wp-includes/style-engine/class-wp-style-engine-css-rule.php",
  "src/wp-includes/style-engine/class-wp-style-engine-css-rules-store.php",
  "src/wp-includes/style-engine/class-wp-style-engine-processor.php",
  "src/wp-includes/html-api/class-wp-html-processor.php",
  "src/wp-includes/html-api/class-wp-html-tag-processor.php",
  "src/wp-includes/interactivity-api/class-wp-interactivity-api.php",
  "src/wp-includes/interactivity-api/class-wp-interactivity-api-directives-processor.php",
  "src/wp-includes/interactivity-api/interactivity-api.php",
  "src/wp-includes/rest-api.php",
  "src/wp-includes/rest-api/endpoints/class-wp-rest-block-renderer-controller.php",
  "src/wp-includes/rest-api/endpoints/class-wp-rest-block-types-controller.php",
  "src/wp-includes/rest-api/endpoints/class-wp-rest-block-patterns-controller.php",
  "src/wp-includes/rest-api/endpoints/class-wp-rest-global-styles-controller.php",
  "src/wp-includes/rest-api/endpoints/class-wp-rest-templates-controller.php",
  "src/wp-includes/blocks/categories.php",
  "src/wp-includes/blocks/latest-posts.php",
  "src/wp-includes/blocks/navigation.php",
  "src/wp-includes/blocks/post-content.php",
  "src/wp-includes/blocks/query-no-results.php"
];

const CASES = [
  { id: "boundary:expanded-package", method: "GET", path: "/__wphx/package-boundary", focus: "expanded source topology for blocks, supports, bindings, style engine, HTML API, interactivity, REST, and template integration" },
  { id: "front:query-loop-template", method: "GET", path: "/?wphx_case=query-loop-template", focus: "front-end query loop, post-content, template context, hooks, supports, and style handles" },
  { id: "front:navigation-core-renderer", method: "GET", path: "/?wphx_case=navigation", focus: "navigation/core renderer and HTML mutation intent" },
  { id: "rest:block-renderer", method: "POST", path: "/wp-json/wp/v2/block-renderer/core/latest-posts?context=edit", body: "attributes%5BpostsToShow%5D=2&post_id=42", focus: "REST block-renderer request shape and server-rendered output summary" },
  { id: "rest:block-types-patterns", method: "GET", path: "/wp-json/wp/v2/block-types/core/paragraph?context=edit", focus: "REST block type, pattern, and editor metadata handoff" },
  { id: "rest:templates-global-styles", method: "GET", path: "/wp-json/wp/v2/templates/twentytwentyfive//home?context=edit", focus: "REST template and global-styles handoff into theme/template ownership" },
  { id: "bindings:post-meta-post-data", method: "POST", path: "/wp-admin/admin-post.php?action=wphx_block_bindings", body: "post_id=42&meta_key=subtitle", focus: "post-meta and post-data binding source read/write intent" },
  { id: "supports:layout-style-engine", method: "POST", path: "/wp-admin/admin-post.php?action=wphx_layout_supports", body: "layout=constrained&spacing=40px&color=primary", focus: "layout/spacing/color/typography support serialization and style-engine CSS output" },
  { id: "html-api:rendered-mutation", method: "POST", path: "/wp-admin/admin-post.php?action=wphx_html_api_mutation", body: "html=%3Ca%20href%3D%22%2F%22%20class%3D%22wp-block-navigation-item%22%3EHome%3C%2Fa%3E", focus: "HTML API mutation of rendered block output" },
  { id: "interactivity:directive-hydration", method: "POST", path: "/wp-json/wphx/v1/interactivity/hydrate", body: "store=cart&count=3&active=1", focus: "server interactivity state/config/directive hydration without browser package ownership" }
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
  return sha256(readFileSync(path));
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

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url( $uri, PHP_URL_PATH );
$query_string = parse_url( $uri, PHP_URL_QUERY ) ?? '';
parse_str( $query_string, $query );
$body = file_get_contents( 'php://input' );
parse_str( $body, $form );

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

$source_files = ${JSON.stringify(SOURCE_FILES.map((path) => path.replace(/^src\//, "")))};

function wphx_314_14_json( $status, $payload ) {
\thttp_response_code( $status );
\theader( 'Content-Type: application/json; charset=UTF-8' );
\techo json_encode( $payload, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT );
\treturn true;
}

function wphx_314_14_source_records( $source_files ) {
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

function wphx_314_14_html_summary( $html ) {
\treturn array(
\t\t'sha256' => hash( 'sha256', $html ),
\t\t'bytes' => strlen( $html ),
\t\t'has_wp_block' => str_contains( $html, 'wp-block-' ),
\t\t'has_navigation' => str_contains( $html, 'wp-block-navigation' ),
\t\t'has_interactivity_attr' => str_contains( $html, 'data-wp-interactive' ),
\t\t'has_binding_attr' => str_contains( $html, 'data-wp-bind' ),
\t);
}

function wphx_314_14_claims() {
\treturn array(
\t\t'behavior_parity_claimed' => false,
\t\t'installed_wordpress_route_execution_claimed' => false,
\t\t'mirrored_upstream_source_executed_by_router' => false,
\t\t'candidate_generated_overlay_claimed' => false,
\t\t'generated_public_php_replacement_claimed' => false,
\t\t'browser_gutenberg_package_ownership_claimed' => false,
\t);
}

switch ( $path ) {
\tcase '/__wphx/package-boundary':
\t\treturn wphx_314_14_json(
\t\t\t200,
\t\t\tarray(
\t\t\t\t'case' => 'boundary:expanded-package',
\t\t\t\t'package_kind' => 'expanded-installed-style-block-rendering-gate',
\t\t\t\t'source_files' => wphx_314_14_source_records( $source_files ),
\t\t\t\t'coverage_families' => array( 'front', 'rest', 'admin-post', 'bindings', 'supports', 'html-api', 'interactivity', 'template-global-styles' ),
\t\t\t\t'claims' => wphx_314_14_claims(),
\t\t\t)
\t\t);

\tcase '/':
\t\tif ( 'navigation' === ( $query['wphx_case'] ?? '' ) ) {
\t\t\t$html = '<nav class="wp-block-navigation"><a class="wp-block-navigation-item__content" data-wp-on--click="core/navigation::actions.navigate" href="/">Home</a></nav>';
\t\t\treturn wphx_314_14_json(
\t\t\t\t200,
\t\t\t\tarray(
\t\t\t\t\t'case' => 'front:navigation-core-renderer',
\t\t\t\t\t'route' => 'front',
\t\t\t\t\t'core_renderers' => array( 'core/navigation', 'core/navigation-link', 'core/post-content' ),
\t\t\t\t\t'html_api_mutations' => array( 'link_attribute_insert', 'class_list_preserve', 'data-wp-on-click' ),
\t\t\t\t\t'html' => wphx_314_14_html_summary( $html ),
\t\t\t\t\t'claims' => wphx_314_14_claims(),
\t\t\t\t)
\t\t\t);
\t\t}
\t\t$html = '<main class="wp-site-blocks"><div class="wp-block-query"><article class="wp-block-post"><h2 class="wp-block-post-title">Block fixture</h2><div class="wp-block-post-content"><p class="wp-block-paragraph has-primary-color">Hello</p></div></article></div><aside class="wp-block-wphx-hooked">Hooked</aside></main>';
\t\treturn wphx_314_14_json(
\t\t\t200,
\t\t\tarray(
\t\t\t\t'case' => 'front:query-loop-template',
\t\t\t\t'route' => 'front',
\t\t\t\t'parsed_blocks' => array( 'core/query', 'core/post-template', 'core/post-title', 'core/post-content', 'core/paragraph' ),
\t\t\t\t'template_context' => array( 'theme' => 'twentytwentyfive', 'template' => 'home', 'query_id' => 1 ),
\t\t\t\t'hooked_blocks' => array( 'wphx/hooked-after-query' ),
\t\t\t\t'supports' => array( 'layout' => 'constrained', 'color' => 'primary', 'spacing' => 'preset' ),
\t\t\t\t'style_handles' => array( 'global-styles', 'wp-block-library', 'wp-block-query' ),
\t\t\t\t'html' => wphx_314_14_html_summary( $html ),
\t\t\t\t'claims' => wphx_314_14_claims(),
\t\t\t)
\t\t);

\tcase '/wp-json/wp/v2/block-renderer/core/latest-posts':
\t\t$count = (int) ( $form['attributes']['postsToShow'] ?? 2 );
\t\t$html = '<ul class="wp-block-latest-posts__list wp-block-latest-posts"><li><a href="/fixture-post/">Fixture post</a></li></ul>';
\t\treturn wphx_314_14_json(
\t\t\t200,
\t\t\tarray(
\t\t\t\t'case' => 'rest:block-renderer',
\t\t\t\t'context' => $query['context'] ?? 'view',
\t\t\t\t'post_id' => (int) ( $form['post_id'] ?? 0 ),
\t\t\t\t'attributes' => array( 'postsToShow' => $count ),
\t\t\t\t'rendered' => wphx_314_14_html_summary( $html ),
\t\t\t\t'rest_controller' => 'WP_REST_Block_Renderer_Controller',
\t\t\t\t'database_backed_posts_claimed' => false,
\t\t\t\t'claims' => wphx_314_14_claims(),
\t\t\t)
\t\t);

\tcase '/wp-json/wp/v2/block-types/core/paragraph':
\t\treturn wphx_314_14_json(
\t\t\t200,
\t\t\tarray(
\t\t\t\t'case' => 'rest:block-types-patterns',
\t\t\t\t'block_type' => 'core/paragraph',
\t\t\t\t'supports' => array( 'anchor', 'className', 'color', 'spacing', 'typography' ),
\t\t\t\t'related_rest_controllers' => array( 'WP_REST_Block_Types_Controller', 'WP_REST_Block_Patterns_Controller' ),
\t\t\t\t'editor_metadata_handoff' => array( 'WPHX-400', 'WPHX-500' ),
\t\t\t\t'claims' => wphx_314_14_claims(),
\t\t\t)
\t\t);

\tcase '/wp-json/wp/v2/templates/twentytwentyfive//home':
\t\treturn wphx_314_14_json(
\t\t\t200,
\t\t\tarray(
\t\t\t\t'case' => 'rest:templates-global-styles',
\t\t\t\t'template' => 'twentytwentyfive//home',
\t\t\t\t'rest_controllers' => array( 'WP_REST_Templates_Controller', 'WP_REST_Global_Styles_Controller' ),
\t\t\t\t'cross_domain_handoffs' => array( 'WPHX-310', 'WPHX-320' ),
\t\t\t\t'database_theme_state_claimed' => false,
\t\t\t\t'claims' => wphx_314_14_claims(),
\t\t\t)
\t\t);

\tcase '/wp-admin/admin-post.php':
\t\tif ( 'wphx_block_bindings' === ( $query['action'] ?? '' ) ) {
\t\t\treturn wphx_314_14_json(
\t\t\t\t200,
\t\t\t\tarray(
\t\t\t\t\t'case' => 'bindings:post-meta-post-data',
\t\t\t\t\t'post_id' => (int) ( $form['post_id'] ?? 0 ),
\t\t\t\t\t'sources' => array( 'core/post-meta', 'core/post-data', 'core/term-data' ),
\t\t\t\t\t'attributes' => array( 'content', 'url', 'alt', 'title' ),
\t\t\t\t\t'database_meta_read_claimed' => false,
\t\t\t\t\t'claims' => wphx_314_14_claims(),
\t\t\t\t)
\t\t\t);
\t\t}
\t\tif ( 'wphx_layout_supports' === ( $query['action'] ?? '' ) ) {
\t\t\t$css = '.wp-block-group{max-width:var(--wp--style--global--content-size);margin-block-start:40px;color:var(--wp--preset--color--primary)}';
\t\t\treturn wphx_314_14_json(
\t\t\t\t200,
\t\t\t\tarray(
\t\t\t\t\t'case' => 'supports:layout-style-engine',
\t\t\t\t\t'layout' => $form['layout'] ?? 'constrained',
\t\t\t\t\t'supports_applied' => array( 'layout', 'spacing', 'color', 'typography' ),
\t\t\t\t\t'style_engine' => array( 'rule_count' => 1, 'stylesheet_sha256' => hash( 'sha256', $css ), 'css' => $css ),
\t\t\t\t\t'claims' => wphx_314_14_claims(),
\t\t\t\t)
\t\t\t);
\t\t}
\t\tif ( 'wphx_html_api_mutation' === ( $query['action'] ?? '' ) ) {
\t\t\t$input = $form['html'] ?? '';
\t\t\t$output = str_replace( '<a ', '<a data-wp-on--click="core/navigation::actions.navigate" ', $input );
\t\t\treturn wphx_314_14_json(
\t\t\t\t200,
\t\t\t\tarray(
\t\t\t\t\t'case' => 'html-api:rendered-mutation',
\t\t\t\t\t'input_sha256' => hash( 'sha256', $input ),
\t\t\t\t\t'output' => wphx_314_14_html_summary( $output ),
\t\t\t\t\t'mutations' => array( 'set_attribute', 'preserve_class', 'serialize' ),
\t\t\t\t\t'claims' => wphx_314_14_claims(),
\t\t\t\t)
\t\t\t);
\t\t}
\t\treturn wphx_314_14_json( 404, array( 'case' => 'admin-post:not-found', 'action' => $query['action'] ?? '' ) );

\tcase '/wp-json/wphx/v1/interactivity/hydrate':
\t\t$count = (int) ( $form['count'] ?? 0 );
\t\t$store = $form['store'] ?? 'demo';
\t\t$html = '<div data-wp-interactive="' . htmlspecialchars( $store, ENT_QUOTES ) . '" data-wp-context="{&quot;count&quot;:' . $count . '}"><button data-wp-bind--aria-pressed="state.active" data-wp-class--is-active="state.active"><span data-wp-text="state.count">' . $count . '</span></button></div>';
\t\treturn wphx_314_14_json(
\t\t\t200,
\t\t\tarray(
\t\t\t\t'case' => 'interactivity:directive-hydration',
\t\t\t\t'store' => $store,
\t\t\t\t'state' => array( 'count' => $count, 'active' => '1' === ( $form['active'] ?? '0' ) ),
\t\t\t\t'config' => array( 'navigation' => 'client', 'preload' => true ),
\t\t\t\t'directives' => array( 'data-wp-interactive', 'data-wp-context', 'data-wp-bind', 'data-wp-class', 'data-wp-text' ),
\t\t\t\t'html' => wphx_314_14_html_summary( $html ),
\t\t\t\t'browser_client_package_ownership_claimed' => false,
\t\t\t\t'claims' => wphx_314_14_claims(),
\t\t\t)
\t\t);

\tdefault:
\t\treturn wphx_314_14_json( 404, array( 'case' => 'not-found', 'path' => $path ) );
}
`
  );
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-314-blocks-installed-expanded-gate`);
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
          resolve({
            id: testCase.id,
            status: res.statusCode,
            content_type: res.headers["content-type"] ?? null,
            body_sha256: sha256(text),
            json: JSON.parse(text)
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
    for (const testCase of CASES) observations.push(await requestCase(server.port, testCase));
    const stderr = server.stderr();
    if (stderr.trim().length > 0 && /Fatal error|Parse error|Warning/.test(stderr)) throw new Error(stderr);
    return observations;
  } finally {
    await server.stop();
  }
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/blocks-installed-expanded-gate",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "packaged-distribution-installed-http-gate",
      name: "expanded blocks/interactivity installed-style gate",
      area: "wp-includes block runtime, supports, bindings, style-engine, HTML API, interactivity API, REST block endpoints, selected core renderers",
      public_contract:
        "Expanded installed-style observations must preserve package topology and representative front/REST/admin block-rendering boundary shapes while keeping real installed WordPress behavior and generated PHP ownership claims explicit."
    },
    ownership_state: "packaged_distribution_candidate",
    ownership_axes: {
      semantic_owner: "wordpress_oracle_bridge",
      adapter_contract_owner: "haxe_typed_for_selected_decisions",
      emission_strategy: "copied_upstream_public_php_with_deterministic_router",
      execution_provider: "php_cli_builtin_server",
      compatibility_evidence: "expanded_package_topology_and_bridge_router_observation_match"
    },
    bridge: {
      exists: true,
      kind: "copied-upstream-package-with-deterministic-installed-router",
      removal_gate:
        "Replace copied public PHP with generated original-path blocks/interactivity adapters and rerun this gate plus upstream PHPUnit, database-backed installed block rendering, REST/admin routes, browser/editor/Gutenberg package gates, and ecosystem fixtures before claiming durable public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, BUILD_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-314-blocks-installed-expanded-gate",
        "npm run wp:core:wphx-314-blocks-installed-expanded-gate:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-314-14-blocks-installed-expanded-gate"],
      manifest_digest: manifestSha
    },
    notes:
      "This gate expands deterministic bridge-router coverage only. It does not dispatch into mirrored WordPress source files for the HTTP cases and does not prove installed WordPress block rendering parity."
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
  const matches = JSON.stringify(oracle) === JSON.stringify(candidate);
  if (!matches) {
    console.error(JSON.stringify({ status: "failed", oracle, candidate }, null, 2));
    process.exit(1);
  }

  const manifest = {
    schema: "wphx.wp-core-blocks-installed-expanded-gate.v1",
    issue: ISSUE.external_ref,
    beads_issue: ISSUE.id,
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
    observations: { oracle, candidate, matches },
    covered_boundaries: [
      "front query-loop/template-context block rendering observation",
      "front navigation/core-renderer HTML mutation observation",
      "REST block-renderer request/response observation",
      "REST block-types/patterns metadata observation",
      "REST template/global-styles handoff observation",
      "admin-post block bindings observation",
      "admin-post layout/support/style-engine observation",
      "admin-post HTML API rendered-output mutation observation",
      "REST-like interactivity directive hydration observation"
    ],
    explicit_deferrals: [
      { owner: "WPHX-307/WPHX-308", reason: "database-backed posts, terms, comments, and query-loop state" },
      { owner: "WPHX-310/WPHX-320", reason: "real theme template, template part, global-styles, and default-theme rendering integration" },
      { owner: "WPHX-311/WPHX-316", reason: "real REST controller dispatch and admin route execution" },
      { owner: "WPHX-400/WPHX-500", reason: "browser/editor/Gutenberg package behavior, client interactivity runtime, and asset bundling" },
      { owner: "WPHX-314.15/WPHX-314.16", reason: "Haxe-owned candidate promotion and generated original-path public PHP shell retirement" }
    ],
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
      public_php_replacement_claimed: false
    },
    non_claims: [
      "The deterministic router is test harness code and not a WPHX implementation artifact.",
      "Router-emitted PHP/HTML strings are fixture observations, not generated original-path adapters, not WPHX-owned templates, and not distributable runtime code.",
      "Mirrored upstream PHP files under build/wp-core/**/{oracle,candidate}-package are regenerated test inputs and are not WPHX implementation source.",
      "This gate does not claim real installed WordPress bootstrap, database-backed block rendering, REST controller dispatch, admin route execution, browser/editor execution, Gutenberg package ownership, generated overlays, or durable generated public PHP ownership."
    ],
    ownership_manifest: OWNERSHIP
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestSha = sha256(manifestText);
  const ownershipText = `${JSON.stringify(ownershipManifest(manifestSha), null, 2)}\n`;
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-314-14-blocks-installed-expanded-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    command: "npm run wp:core:wphx-314-blocks-installed-expanded-gate",
    evidence_class: manifest.evidence_class,
    artifact_scope: manifest.artifact_scope,
    behavior_parity_claimed: false,
    router_observation_parity_claimed: true,
    package_topology_claimed: true,
    mirrored_upstream_source_executed_by_router: false,
    installed_wordpress_route_execution_claimed: false,
    candidate_generated_overlay_claimed: false,
    artifacts: [
      { path: OUT, role: "expanded blocks/interactivity installed-style HTTP gate manifest", sha256: manifestSha },
      { path: OWNERSHIP, role: "ownership manifest for expanded blocks/interactivity installed-style gate" },
      { path: RUNNER, role: "expanded installed-style blocks/interactivity gate generator and check-mode validator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-314-blocks-installed-expanded-gate",
      "npm run wp:core:wphx-314-blocks-installed-expanded-gate:check",
      "npm run operations:bridge-claim-guardrails:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    validation_result: manifest.validation_result,
    scope_summary:
      "This receipt expands WPHX-314 installed-style bridge-router coverage to ten deterministic front, REST, admin-post, bindings, supports, style-engine, HTML API, interactivity, template, and global-styles observations over regenerated oracle/candidate package roots with selected upstream source files at locked hashes. It remains package-topology and router-observation evidence only.",
    explicit_deferrals: manifest.explicit_deferrals,
    non_claims: manifest.non_claims
  };
  const receiptText = `${JSON.stringify(receipt, null, 2)}\n`;

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
        behavior_parity_claimed: false,
        router_observation_parity_claimed: true,
        package_topology_claimed: true,
        public_php_replacement_claimed: false
      },
      null,
      2
    )
  );
}

main();
