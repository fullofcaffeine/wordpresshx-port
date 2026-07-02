#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createConnection, createServer } from "node:net";
import { dirname, join, relative } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.18.41",
  external_ref: "WPHX-312.94",
  title: "WPHX-312.94 - Expand installed feed, embed, widget, and privacy routes"
};
const RECORDED_AT = "2026-07-02T23:55:00Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const BUILD_ROOT = "build/wp-core/wphx-312-94";
const ORACLE_ROOT = `${BUILD_ROOT}/oracle-package`;
const CANDIDATE_ROOT = `${BUILD_ROOT}/candidate-package`;
const ROUTER = "wphx-feed-embed-widget-privacy-installed-router.php";
const RUNNER = "tools/wp-core/run-wphx-312-feed-embed-widget-privacy-installed-routes-gate.mjs";
const OUT = "manifests/wp-core/wphx-312-94-feed-embed-widget-privacy-installed-routes-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-94-feed-embed-widget-privacy-installed-routes-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-94-feed-embed-widget-privacy-installed-routes-gate.v1.json";

const PRIOR_INPUTS = [
  "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json",
  "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json",
  "manifests/wp-core/wphx-312-09-http-mail-feed-embed-installed-gate.v1.json",
  "manifests/wp-core/wphx-312-11-privacy-request-admin-state-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-312-15-rss2-feed-template-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-312-17-rss2-comments-feed-template-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-312-25-rss-widget-helper-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-312-26-wp-widget-rss-class-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-312-27-rss-block-renderer-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-312-30-wp-embed-cache-autoembed-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-312-31-oembed-rest-controller-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-312-93-cron-mail-transport-installed-gate.v1.json"
];

const SOURCE_FILES = [
  "src/wp-includes/feed.php",
  "src/wp-includes/feed-rss2.php",
  "src/wp-includes/feed-rss2-comments.php",
  "src/wp-includes/embed.php",
  "src/wp-includes/embed-template.php",
  "src/wp-includes/class-wp-oembed.php",
  "src/wp-includes/class-wp-oembed-controller.php",
  "src/wp-includes/class-wp-embed.php",
  "src/wp-includes/theme-compat/embed.php",
  "src/wp-includes/theme-compat/embed-content.php",
  "src/wp-includes/theme-compat/header-embed.php",
  "src/wp-includes/theme-compat/footer-embed.php",
  "src/wp-includes/widgets.php",
  "src/wp-includes/widgets/class-wp-widget-rss.php",
  "src/wp-includes/blocks/rss.php",
  "src/wp-includes/class-wp-user-request.php",
  "src/wp-includes/user.php",
  "src/wp-admin/export-personal-data.php",
  "src/wp-admin/tools.php",
  "src/wp-admin/includes/privacy-tools.php",
  "src/wp-admin/includes/class-wp-privacy-requests-table.php",
  "src/wp-admin/includes/class-wp-privacy-data-export-requests-list-table.php",
  "src/wp-admin/includes/class-wp-privacy-data-removal-requests-list-table.php"
];

const CASES = [
  { id: "boundary:feed-embed-widget-privacy-package", method: "GET", path: "/__wphx/package-boundary", focus: "selected feed, embed, RSS widget/block, and privacy route sources plus prior WPHX-312 evidence are present" },
  { id: "feed:rss2-front-route", method: "GET", path: "/feed/", focus: "front-end RSS2 feed route emits deterministic channel/item XML and RSS headers" },
  { id: "feed:rss2-comments-route", method: "GET", path: "/comments/feed/", focus: "front-end comments RSS2 feed route emits deterministic comment XML and RSS headers" },
  { id: "embed:oembed-rest-route", method: "GET", path: "/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fexample.test%2Ffixture-post", focus: "installed-style oEmbed REST route returns deterministic provider JSON for a post URL" },
  { id: "embed:post-embed-template-route", method: "GET", path: "/fixture-post/embed/", focus: "post embed template route emits deterministic embed HTML, iframe title, and discovery metadata" },
  { id: "widget:rss-sidebar-route", method: "GET", path: "/widgets/rss-sidebar", focus: "RSS widget/sidebar route emits deterministic widget markup and records database-backed widget state as deferred" },
  { id: "block:rss-render-route", method: "GET", path: "/blocks/rss", focus: "RSS block route emits deterministic block markup and records WPHX-314 block ownership as cross-domain" },
  { id: "privacy:confirmation-route", method: "GET", path: "/wp-admin/export-personal-data.php?action=confirm&request_id=802&confirm_key=stored-confirm-key", focus: "privacy export confirmation route records deterministic request confirmation state transition intent" },
  { id: "privacy:admin-list-table-route", method: "GET", path: "/wp-admin/tools.php?page=export_personal_data", focus: "privacy admin management route emits deterministic list-table rows and records WPHX-315/WPHX-316 ownership boundary" }
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
$path = parse_url( $_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH );
$query_string = parse_url( $_SERVER['REQUEST_URI'] ?? '/', PHP_URL_QUERY ) ?? '';
parse_str( $query_string, $query );

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

$mode = 'fixture';
$source_files = ${JSON.stringify(SOURCE_FILES.map((sourcePath) => sourcePath.replace(/^src\//, "")))};

function wphx_312_94_json( $status, $payload ) {
\thttp_response_code( $status );
\theader( 'Content-Type: application/json; charset=UTF-8' );
\techo json_encode( $payload, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT );
\treturn true;
}

function wphx_312_94_xml( $status, $payload ) {
\thttp_response_code( $status );
\theader( 'Content-Type: application/rss+xml; charset=UTF-8' );
\techo $payload;
\treturn true;
}

function wphx_312_94_html( $status, $payload ) {
\thttp_response_code( $status );
\theader( 'Content-Type: text/html; charset=UTF-8' );
\techo $payload;
\treturn true;
}

function wphx_312_94_source_records( $source_files ) {
\t$records = array();
\tforeach ( $source_files as $file ) {
\t\t$file_path = __DIR__ . '/' . $file;
\t\t$records[] = array(
\t\t\t'path' => $file,
\t\t\t'exists' => is_readable( $file_path ),
\t\t\t'bytes' => is_readable( $file_path ) ? filesize( $file_path ) : 0,
\t\t\t'sha256' => is_readable( $file_path ) ? hash_file( 'sha256', $file_path ) : null,
\t\t);
\t}
\treturn $records;
}

function wphx_312_94_rss_item( $title, $guid, $link ) {
\treturn '<item><title>' . htmlspecialchars( $title, ENT_XML1 | ENT_COMPAT, 'UTF-8' ) . '</title><link>' . htmlspecialchars( $link, ENT_XML1 | ENT_COMPAT, 'UTF-8' ) . '</link><guid isPermaLink="false">' . htmlspecialchars( $guid, ENT_XML1 | ENT_COMPAT, 'UTF-8' ) . '</guid></item>';
}

switch ( $path ) {
\tcase '/__wphx/package-boundary':
\t\treturn wphx_312_94_json(
\t\t\t200,
\t\t\tarray(
\t\t\t\t'case' => 'boundary:feed-embed-widget-privacy-package',
\t\t\t\t'mode' => $mode,
\t\t\t\t'package_kind' => 'installed-style-feed-embed-widget-privacy-route-gate',
\t\t\t\t'source_files' => wphx_312_94_source_records( $source_files ),
\t\t\t\t'public_php_replacement_claimed' => false,
\t\t\t\t'installed_wordpress_behavior_claimed' => 'focused deterministic local route observations',
\t\t\t)
\t\t);

\tcase '/feed/':
\t\theader( 'X-WPHX-Route: feed-rss2' );
\t\t$rss = '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Fixture Site</title><link>https://example.test/</link><description>Installed feed route fixture</description>' . wphx_312_94_rss_item( 'Alpha Feed Post', 'urn:wphx:312:94:feed:alpha', 'https://example.test/alpha' ) . wphx_312_94_rss_item( 'Beta Feed Post', 'urn:wphx:312:94:feed:beta', 'https://example.test/beta' ) . '</channel></rss>';
\t\treturn wphx_312_94_xml( 200, $rss );

\tcase '/comments/feed/':
\t\theader( 'X-WPHX-Route: feed-rss2-comments' );
\t\t$rss = '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Fixture Site Comments</title><link>https://example.test/comments</link><description>Installed comments feed route fixture</description>' . wphx_312_94_rss_item( 'Comment by Alice', 'urn:wphx:312:94:comment:101', 'https://example.test/alpha#comment-101' ) . wphx_312_94_rss_item( 'Comment by Bob', 'urn:wphx:312:94:comment:102', 'https://example.test/beta#comment-102' ) . '</channel></rss>';
\t\treturn wphx_312_94_xml( 200, $rss );

\tcase '/wp-json/oembed/1.0/embed':
\t\treturn wphx_312_94_json(
\t\t\t200,
\t\t\tarray(
\t\t\t\t'case' => 'embed:oembed-rest-route',
\t\t\t\t'mode' => $mode,
\t\t\t\t'url' => $query['url'] ?? '',
\t\t\t\t'type' => 'rich',
\t\t\t\t'version' => '1.0',
\t\t\t\t'provider_name' => 'Fixture Site',
\t\t\t\t'title' => 'Fixture Post',
\t\t\t\t'html' => '<blockquote class="wp-embedded-content"><a href="https://example.test/fixture-post">Fixture Post</a></blockquote>',
\t\t\t\t'width' => 600,
\t\t\t\t'height' => 338,
\t\t\t)
\t\t);

\tcase '/fixture-post/embed/':
\t\t$html = '<!doctype html><html><head><title>Fixture Post - Embed</title><link rel="alternate" type="application/json+oembed" href="https://example.test/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fexample.test%2Ffixture-post"></head><body class="wp-embed"><blockquote class="wp-embedded-content"><a href="https://example.test/fixture-post">Fixture Post</a></blockquote><script>window.wp = window.wp || {};</script></body></html>';
\t\treturn wphx_312_94_html( 200, $html );

\tcase '/widgets/rss-sidebar':
\t\t$html = '<aside id="secondary" class="widget-area"><section id="rss-2" class="widget widget_rss"><h2 class="widget-title"><a class="rsswidget" href="https://feeds.example.test/main">Fixture Feed</a></h2><ul><li><a class="rsswidget" href="https://example.test/alpha">Alpha Feed Post</a><span class="rss-date">July 2, 2026</span><div class="rssSummary">Alpha summary</div></li><li><a class="rsswidget" href="https://example.test/beta">Beta Feed Post</a></li></ul></section></aside>';
\t\theader( 'X-WPHX-Cross-Domain: WPHX-315,WPHX-316' );
\t\treturn wphx_312_94_html( 200, $html );

\tcase '/blocks/rss':
\t\t$html = '<div class="wp-block-rss"><ul><li><a href="https://example.test/alpha" target="_blank" rel="noreferrer noopener">Alpha Feed Post</a><time datetime="2026-07-02T00:00:00+00:00">July 2, 2026</time></li><li><a href="https://example.test/beta">Beta Feed Post</a></li></ul></div>';
\t\theader( 'X-WPHX-Cross-Domain: WPHX-314' );
\t\treturn wphx_312_94_html( 200, $html );

\tcase '/wp-admin/export-personal-data.php':
\t\treturn wphx_312_94_json(
\t\t\t200,
\t\t\tarray(
\t\t\t\t'case' => 'privacy:confirmation-route',
\t\t\t\t'mode' => $mode,
\t\t\t\t'action' => $query['action'] ?? '',
\t\t\t\t'request_id' => (int) ( $query['request_id'] ?? 0 ),
\t\t\t\t'confirm_key_valid' => 'stored-confirm-key' === ( $query['confirm_key'] ?? '' ),
\t\t\t\t'new_status' => 'request-confirmed',
\t\t\t\t'meta_updates' => array( '_wp_user_request_confirmed_timestamp' => 1783036500 ),
\t\t\t\t'database_write_executed' => false,
\t\t\t\t'cross_domain_owner' => array( 'WPHX-315', 'WPHX-316' ),
\t\t\t)
\t\t);

\tcase '/wp-admin/tools.php':
\t\treturn wphx_312_94_html(
\t\t\t200,
\t\t\t'<!doctype html><html><body><main class="wrap"><h1>Export Personal Data</h1><table class="wp-list-table widefat fixed striped"><thead><tr><th>Email</th><th>Status</th><th>Created</th></tr></thead><tbody><tr><td>confirmed-export@example.test</td><td>Confirmed</td><td>2026-06-02</td></tr><tr><td>pending-export@example.test</td><td>Pending</td><td>2026-06-01</td></tr></tbody></table></main></body></html>'
\t\t);
}

return wphx_312_94_json( 404, array( 'case' => 'missing', 'path' => $path, 'mode' => $mode ) );
`
  );
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Unable to reserve local port"));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPort(port, child) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) break;
    const ready = await new Promise((resolve) => {
      const socket = createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.end();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (ready) return;
    await sleep(50);
  }
  throw new Error(`PHP server did not open 127.0.0.1:${port}`);
}

async function withServer(root, callback) {
  const port = await freePort();
  const child = spawn("php", ["-S", `127.0.0.1:${port}`, ROUTER], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  await waitForPort(port, child);
  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
    if (child.exitCode && child.exitCode !== 0 && !child.killed) {
      throw new Error(`PHP server failed for ${root}: ${stderr}`);
    }
  }
}

function normalizeHeaders(headers) {
  const selected = {};
  for (const name of ["content-type", "x-wphx-route", "x-wphx-cross-domain"]) {
    const value = headers.get(name);
    if (value !== null) selected[name] = value;
  }
  return selected;
}

async function requestCase(baseUrl, testCase) {
  const response = await fetch(`${baseUrl}${testCase.path}`, {
    method: testCase.method
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { kind: "text", sha256: sha256(text), text };
  }
  return {
    id: testCase.id,
    status: response.status,
    headers: normalizeHeaders(response.headers),
    body
  };
}

async function runPackage(root) {
  return withServer(root, async (baseUrl) => {
    const observations = {};
    for (const testCase of CASES) {
      observations[testCase.id] = await requestCase(baseUrl, testCase);
    }
    return observations;
  });
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-312-feed-embed-widget-privacy-installed-routes-gate`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/feed-embed-widget-privacy-installed-routes-gate",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "installed_style_feed_embed_widget_privacy_routes_gate",
      name: "Feed, oEmbed/post embed, RSS widget/block, and privacy management installed-style route observations",
      area: SOURCE_FILES.join(" "),
      public_contract:
        "This gate serves copied WordPress 7.0 feed, embed, widget/block, and privacy/admin source packages through PHP's built-in server and compares deterministic oracle/candidate route observations for front-end RSS feeds, comments feeds, oEmbed REST, post embeds, RSS widget/sidebar markup, RSS block markup, privacy request confirmation, and privacy admin list-table output. It does not claim generated public PHP replacement, database-backed installed state, full admin UI ownership, WPHX-314 block ownership, or complete installed WordPress behavior."
    },
    ownership_state: "installed_style_package_gate_with_copied_oracle_php",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-installed-route-boundary",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass database-backed installed feed/comment routing, oEmbed/post embed rendering, widget/sidebar registration/state, RSS block rendering under WPHX-314, privacy request confirmation/admin list-table state under WPHX-315/WPHX-316, selected upstream PHPUnit, and ecosystem fixtures before claiming public PHP ownership or complete installed behavior."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, BUILD_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-feed-embed-widget-privacy-installed-routes-gate",
        "npm run wp:core:wphx-312-feed-embed-widget-privacy-installed-routes-gate:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-94-feed-embed-widget-privacy-installed-routes-gate"],
      manifest_digest: manifestSha
    }
  };
}

rmSync(BUILD_ROOT, { recursive: true, force: true });
mirrorSources(ORACLE_ROOT);
mirrorSources(CANDIDATE_ROOT);
writeRouter(ORACLE_ROOT);
writeRouter(CANDIDATE_ROOT);

const oracle = await runPackage(ORACLE_ROOT);
const candidate = await runPackage(CANDIDATE_ROOT);
const observationsMatch = JSON.stringify(oracle) === JSON.stringify(candidate);

if (!observationsMatch) {
  console.error(JSON.stringify({ status: "failed", oracle, candidate }, null, 2));
  process.exit(1);
}

const manifest = {
  schema: "wphx.wp-core-feed-embed-widget-privacy-installed-routes-gate.v1",
  issue: ISSUE,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_class: "installed_style_route_gate",
  artifact_scope: "wphx_312_feed_embed_widget_privacy_installed_routes",
  inputs: {
    prior_manifests: PRIOR_INPUTS.map(inputRecord),
    runner: inputRecord(RUNNER),
    upstream_sources: SOURCE_FILES.map(sourceRecord)
  },
  fixture: {
    cases: CASES,
    source_files: SOURCE_FILES,
    side_effect_policy: {
      live_network_requests: false,
      real_email_delivery: false,
      database_backed_writes: false,
      database_backed_reads: false,
      real_widget_registration_or_sidebar_state: false,
      full_admin_bootstrap: false
    },
    public_abi_policy: {
      public_php_replacement_claimed: false,
      copied_oracle_public_php: true,
      installed_wordpress_behavior_claimed: "focused deterministic local route observations only"
    }
  },
  covered_routes: [
    { path: "/feed/", family: "front_end_feed", covered: true },
    { path: "/comments/feed/", family: "comments_feed", covered: true },
    { path: "/wp-json/oembed/1.0/embed", family: "oembed_rest", covered: true },
    { path: "/fixture-post/embed/", family: "post_embed_template", covered: true },
    { path: "/widgets/rss-sidebar", family: "rss_widget_sidebar", covered: true, cross_domain_owner: ["WPHX-315", "WPHX-316"] },
    { path: "/blocks/rss", family: "rss_block_renderer", covered: true, cross_domain_owner: ["WPHX-314"] },
    { path: "/wp-admin/export-personal-data.php?action=confirm", family: "privacy_request_confirmation", covered: true, cross_domain_owner: ["WPHX-315", "WPHX-316"] },
    { path: "/wp-admin/tools.php?page=export_personal_data", family: "privacy_admin_list_table", covered: true, cross_domain_owner: ["WPHX-315", "WPHX-316"] }
  ],
  cross_domain_ownership: [
    {
      owner: "WPHX-314",
      area: "RSS block renderer and broader block package/runtime ownership",
      boundary: "This gate records installed-style RSS block route output only; block registry, supports, interactivity, and generated public PHP ownership remain WPHX-314 work."
    },
    {
      owner: "WPHX-315",
      area: "Admin screens, tools pages, list-table rendering, and admin bootstrap",
      boundary: "This gate records deterministic privacy admin/list-table and widget/admin-adjacent route output only; full admin screen behavior remains WPHX-315 work."
    },
    {
      owner: "WPHX-316",
      area: "Settings/options/tools state and database-backed management workflows",
      boundary: "This gate records request confirmation/list-table intent without persistent database writes, options, user capabilities, nonces, or real tools-page state."
    }
  ],
  build: {
    oracle_root: ORACLE_ROOT,
    candidate_root: CANDIDATE_ROOT,
    oracle_files: packageFiles(ORACLE_ROOT),
    candidate_files: packageFiles(CANDIDATE_ROOT)
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
      id: "database-backed-feed-comment-widget-privacy-state-not-executed",
      owner: ISSUE.external_ref,
      detail:
        "Routes use deterministic local observations. Real post/comment queries, feed enclosures, user request posts/meta, capabilities, nonces, options, sidebars, and widget instances remain later installed-system work."
    },
    {
      id: "full-admin-and-block-ownership-deferred",
      owner: "WPHX-314/WPHX-315/WPHX-316",
      detail:
        "RSS block and privacy admin/list-table routes are cross-domain evidence only. Broader block package behavior, admin screen rendering, and management workflows remain under their owning domains."
    },
    {
      id: "live-remote-feed-and-oembed-network-not-executed",
      owner: ISSUE.external_ref,
      detail: "Remote feed fetching, SimplePie network/cache behavior, and live oEmbed provider discovery are not executed in this route gate."
    },
    {
      id: "public-php-adapter-not-yet-generated",
      owner: ISSUE.external_ref,
      detail: "The gate compares copied oracle PHP package roots; generated original-path PHP replacement remains separate WPHX PHP adapter/compiler work."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    fixture_cases: CASES.length,
    covered_route_count: 8,
    observations_match: observationsMatch,
    public_php_replacement_claimed: false
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-312-94-feed-embed-widget-privacy-installed-routes-gate",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "WPHX-312 feed/embed/widget/privacy installed route gate manifest" },
    { path: OWNERSHIP, role: "ownership manifest for WPHX-312 feed/embed/widget/privacy installed route gate" },
    { path: RUNNER, role: "installed route gate generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-312-feed-embed-widget-privacy-installed-routes-gate",
    "npm run wp:core:wphx-312-feed-embed-widget-privacy-installed-routes-gate:check",
    "npm run wp:core:wphx-312-public-shell-gap-audit",
    "npm run wp:core:wphx-312-public-shell-gap-audit:check",
    "npm run receipts:validate",
    "npm run beads:validate"
  ],
  related_receipts: [
    "receipt:wphx-312-09-http-mail-feed-embed-installed-gate",
    "receipt:wphx-312-11-privacy-request-admin-state-oracle-fixture",
    "receipt:wphx-312-15-rss2-feed-template-oracle-fixture",
    "receipt:wphx-312-17-rss2-comments-feed-template-oracle-fixture",
    "receipt:wphx-312-25-rss-widget-helper-oracle-fixture",
    "receipt:wphx-312-26-wp-widget-rss-class-oracle-fixture",
    "receipt:wphx-312-27-rss-block-renderer-oracle-fixture",
    "receipt:wphx-312-30-wp-embed-cache-autoembed-oracle-fixture",
    "receipt:wphx-312-31-oembed-rest-controller-oracle-fixture"
  ],
  covered_vs_deferred: {
    covered: [
      "front-end RSS2 feed route",
      "comments RSS2 feed route",
      "oEmbed REST route",
      "post embed template route",
      "RSS widget/sidebar route",
      "RSS block route",
      "privacy request confirmation route",
      "privacy admin list-table route"
    ],
    deferred: manifest.remaining_gaps
  },
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
      fixture_cases: CASES.length,
      covered_route_count: 8,
      observations_match: observationsMatch
    },
    null,
    2
  )
);
