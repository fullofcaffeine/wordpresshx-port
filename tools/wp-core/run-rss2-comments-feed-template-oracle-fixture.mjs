#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.18.17",
  external_ref: "WPHX-312.17",
  title: "WPHX-312.17 - Add RSS2 comments feed template oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-rss2-comments-feed-template-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-312-17";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const OUT = "manifests/wp-core/wphx-312-17-rss2-comments-feed-template-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-17-rss2-comments-feed-template-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-17-rss2-comments-feed-template-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const RSS2_FIXTURE = "manifests/wp-core/wphx-312-15-rss2-feed-template-oracle-fixture.v1.json";
const ATOM_FIXTURE = "manifests/wp-core/wphx-312-16-atom-feed-template-oracle-fixture.v1.json";

const SOURCE_FILES = ["src/wp-includes/feed-rss2-comments.php"];
const COVERED_SYMBOLS = [
  "feed-rss2-comments.php",
  "feed_content_type",
  "rss_tag_pre",
  "rss2_ns",
  "rss2_comments_ns",
  "is_singular",
  "is_search",
  "get_bloginfo_rss",
  "get_wp_title_rss",
  "commentsrss2_head",
  "have_comments",
  "the_comment",
  "get_post",
  "the_title_rss",
  "the_title_rss filter",
  "get_comment_author_rss",
  "comment_link",
  "comment_guid",
  "post_password_required",
  "comment_text_rss",
  "comment_text",
  "commentrss2_item"
];
const CASES = [
  { id: "rss2-comments:default", path: "/wp-includes/feed-rss2-comments.php?case=default", focus: "default site comments feed title, channel metadata, namespace actions, update filters, and comment item output" },
  { id: "rss2-comments:singular", path: "/wp-includes/feed-rss2-comments.php?case=singular", focus: "singular comments feed title and item title use post/comment-author branches" },
  { id: "rss2-comments:search", path: "/wp-includes/feed-rss2-comments.php?case=search", focus: "search comments feed title includes site title and search query" },
  { id: "rss2-comments:protected", path: "/wp-includes/feed-rss2-comments.php?case=protected", focus: "protected comment branch emits protected description and password form content" },
  { id: "rss2-comments:multi", path: "/wp-includes/feed-rss2-comments.php?case=multi", focus: "comment loop renders multiple comments with post lookup, authors, dates, GUIDs, and item hooks" }
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

function mirrorSources(root) {
  for (const path of SOURCE_FILES) {
    const target = mirrorPath(root, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(upstreamPath(path), target);
  }
}

function writePrependStub(root) {
  writeFileSync(
    `${root}/rss2-comments-prepend.php`,
    `<?php
error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

$GLOBALS['wphx_312_17_case'] = $_GET['case'] ?? 'default';
$GLOBALS['wphx_312_17_index'] = -1;
$GLOBALS['comment'] = null;
$GLOBALS['post'] = null;

function wphx_312_17_posts() {
\treturn array(
\t\t101 => (object) array( 'ID' => 101, 'title' => 'Alpha & Commented', 'permalink' => 'https://example.test/posts/alpha', 'protected' => 'protected' === $GLOBALS['wphx_312_17_case'] ),
\t\t202 => (object) array( 'ID' => 202, 'title' => 'Beta Commented', 'permalink' => 'https://example.test/posts/beta', 'protected' => false ),
\t);
}
function wphx_312_17_comments() {
\t$base = array(
\t\t(object) array( 'comment_ID' => 501, 'comment_post_ID' => 101, 'author' => 'Alice & Author', 'time' => '2026-06-01 03:04:05', 'guid' => 'comment-guid-501', 'rss' => 'Alice rss text', 'html' => '<p>Alice <strong>html</strong></p>' ),
\t\t(object) array( 'comment_ID' => 502, 'comment_post_ID' => 202, 'author' => 'Bob Author', 'time' => '2026-06-02 04:05:06', 'guid' => 'comment-guid-502', 'rss' => 'Bob rss text', 'html' => '<p>Bob html</p>' ),
\t);
\treturn 'multi' === $GLOBALS['wphx_312_17_case'] ? $base : array( $base[0] );
}
function wphx_312_17_current_comment() {
\t$comments = wphx_312_17_comments();
\treturn $comments[ $GLOBALS['wphx_312_17_index'] ] ?? $comments[0];
}
function feed_content_type( $type = '' ) { return 'rss2' === $type ? 'application/rss+xml' : 'application/octet-stream'; }
function get_option( $name, $default = false ) { return 'blog_charset' === $name ? 'UTF-8' : $default; }
function do_action( $hook_name, ...$args ) {
\tif ( 'rss_tag_pre' === $hook_name ) {
\t\techo "\\n<!-- rss_tag_pre:" . $args[0] . " -->\\n";
\t}
\tif ( 'rss2_ns' === $hook_name ) {
\t\techo 'xmlns:fixture="https://fixture.example/rss2-comments"';
\t}
\tif ( 'rss2_comments_ns' === $hook_name ) {
\t\techo "\\n\\txmlns:commentsfixture=\\"https://fixture.example/rss2-comments/ns\\"";
\t}
\tif ( 'commentsrss2_head' === $hook_name ) {
\t\techo "\\t<fixture:head>comments</fixture:head>\\n";
\t}
\tif ( 'commentrss2_item' === $hook_name ) {
\t\techo "\\t\\t<fixture:comment marker=\\"" . $args[0] . ":" . $args[1] . "\\" />\\n";
\t}
}
function apply_filters( $hook_name, $value, ...$args ) {
\tif ( 'rss_update_period' === $hook_name ) {
\t\treturn 'daily';
\t}
\tif ( 'rss_update_frequency' === $hook_name ) {
\t\treturn '2';
\t}
\tif ( 'the_title_rss' === $hook_name ) {
\t\treturn 'Filtered ' . $value;
\t}
\treturn $value;
}
function __( $text ) { return $text; }
function ent2ncr( $text ) { return (string) $text; }
function is_singular() { return in_array( $GLOBALS['wphx_312_17_case'], array( 'singular', 'protected' ), true ); }
function is_search() { return 'search' === $GLOBALS['wphx_312_17_case']; }
function is_single() { return is_singular(); }
function get_the_title_rss() { return 'Alpha &amp; Commented'; }
function get_bloginfo_rss( $show = '' ) {
\t$values = array( 'name' => 'Fixture Site', 'url' => 'https://example.test', 'description' => 'Fixture comments feed' );
\treturn $values[ $show ] ?? 'Fixture Site';
}
function bloginfo_rss( $show = '' ) { echo get_bloginfo_rss( $show ); }
function get_search_query() { return 'haxe ports'; }
function get_wp_title_rss() { return 'Fixture Site Comments'; }
function self_link() { echo 'https://example.test/comments/feed/'; }
function get_feed_build_date( $format ) { return 'Sat, 27 Jun 2026 00:00:00 +0000'; }
function the_permalink_rss() { echo 'https://example.test/posts/alpha'; }
function have_comments() { return $GLOBALS['wphx_312_17_index'] + 1 < count( wphx_312_17_comments() ); }
function the_comment() {
\t$GLOBALS['wphx_312_17_index']++;
\t$GLOBALS['comment'] = wphx_312_17_current_comment();
}
function get_post( $post_id ) {
\t$posts = wphx_312_17_posts();
\treturn $posts[ $post_id ] ?? null;
}
function get_the_title( $post_id = 0 ) {
\t$post = get_post( $post_id );
\treturn $post ? $post->title : '';
}
function get_comment_author_rss() { return wphx_312_17_current_comment()->author; }
function comment_link() { echo 'https://example.test/comments/' . wphx_312_17_current_comment()->comment_ID; }
function mysql2date( $format, $date, $translate = false ) { return gmdate( 'D, d M Y H:i:s +0000', strtotime( $date . ' UTC' ) ); }
function get_comment_time( $format, $gmt = true, $translate = false ) { return wphx_312_17_current_comment()->time; }
function comment_guid() { echo wphx_312_17_current_comment()->guid; }
function post_password_required( $post = null ) { return $post && ! empty( $post->protected ); }
function get_the_password_form() { return '<form>Password</form>'; }
function comment_text_rss() { echo wphx_312_17_current_comment()->rss; }
function comment_text() { echo wphx_312_17_current_comment()->html; }
`
  );
}

function observation(caseDef, response) {
  const body = response.body.replace(/\r\n/g, "\n");
  return {
    case: caseDef.id,
    request_path: caseDef.path,
    status: response.status,
    content_type: response.headers.get("content-type") ?? "",
    body_sha256: sha256(body),
    body,
    item_count: (body.match(/<item>/g) ?? []).length,
    has_fixture_namespace: body.includes('xmlns:fixture="https://fixture.example/rss2-comments"'),
    has_comments_namespace: body.includes('xmlns:commentsfixture="https://fixture.example/rss2-comments/ns"'),
    has_head_action_output: body.includes("<fixture:head>comments</fixture:head>"),
    has_item_action_output: body.includes("<fixture:comment marker="),
    has_search_title: body.includes("Comments for Fixture Site searching on haxe ports"),
    has_singular_title: body.includes("Comments on: Alpha &amp; Commented"),
    has_protected_description: body.includes("Protected Comments: Please enter your password"),
    has_password_form: body.includes("<form>Password</form>"),
    has_comment_content: body.includes("<content:encoded><![CDATA[<p>Alice <strong>html</strong></p>]]></content:encoded>")
  };
}

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePort(address.port));
    });
  });
}

async function startPhpServer(root) {
  const port = await freePort();
  const prepend = resolve(`${root}/rss2-comments-prepend.php`);
  const proc = spawn("php", ["-d", `auto_prepend_file=${prepend}`, "-S", `127.0.0.1:${port}`, "-t", root], {
    stdio: ["ignore", "ignore", "pipe"]
  });
  let stderr = "";
  proc.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (proc.exitCode !== null) {
      throw new Error(`php -S exited early for ${root}: ${stderr}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/wp-includes/feed-rss2-comments.php?case=default`);
      await response.text();
      return {
        baseUrl: `http://127.0.0.1:${port}`,
        stop: () =>
          new Promise((resolveStop) => {
            proc.once("exit", resolveStop);
            proc.kill("SIGTERM");
          })
      };
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    }
  }
  proc.kill("SIGTERM");
  throw new Error(`php -S did not become ready for ${root}: ${stderr}`);
}

async function runRoot(root) {
  const server = await startPhpServer(root);
  try {
    const entries = [];
    for (const caseDef of CASES) {
      const response = await fetch(`${server.baseUrl}${caseDef.path}`);
      const body = await response.text();
      entries.push([caseDef.id, observation(caseDef, { status: response.status, headers: response.headers, body })]);
    }
    return Object.fromEntries(entries);
  } finally {
    await server.stop();
  }
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-312-rss2-comments-feed-template-oracle-fixture`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/rss2-comments-feed-template-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "RSS2 comments feed template output behavior",
      area: SOURCE_FILES.join(" "),
      public_contract:
        "This fixture executes copied WordPress 7.0 wp-includes/feed-rss2-comments.php through PHP's built-in HTTP server with a deterministic auto-prepended comment-loop stub. It observes content-type headers and RSS2 comments XML output without database-backed comments, installed feed routing, or live network behavior."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-stubbed-comment-loop-boundary",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass installed feed routing, database-backed comment/post/password behavior, selected upstream PHPUnit, and ecosystem fixtures before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-rss2-comments-feed-template-oracle-fixture",
        "npm run wp:core:wphx-312-rss2-comments-feed-template-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-17-rss2-comments-feed-template-oracle-fixture"],
      manifest_digest: manifestSha
    }
  };
}

async function main() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writePrependStub(ORACLE_ROOT);
  writePrependStub(CANDIDATE_ROOT);

  const oracle = await runRoot(ORACLE_ROOT);
  const candidate = await runRoot(CANDIDATE_ROOT);
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
    schema: "wphx.wp-core-rss2-comments-feed-template-oracle-fixture.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_classes: ["oracle_source_mirror", "candidate_package_mirror", "http_observed_fixture"],
    artifact_scope: "fixture",
    inputs: {
      surface_manifest: inputRecord(SURFACE),
      adapter_contract_manifest: inputRecord(CONTRACT),
      rss2_fixture_manifest: inputRecord(RSS2_FIXTURE),
      atom_fixture_manifest: inputRecord(ATOM_FIXTURE),
      runner: inputRecord(RUNNER),
      upstream_sources: SOURCE_FILES.map(sourceRecord)
    },
    fixture: {
      cases: CASES,
      covered_symbols: COVERED_SYMBOLS,
      source_files: SOURCE_FILES,
      side_effect_policy: {
        external_network_io: false,
        database_io: false,
        live_installed_wordpress: false,
        php_builtin_server: true,
        auto_prepend_stub: "rss2-comments-prepend.php supplies deterministic comment-loop functions; copied feed-rss2-comments.php remains the executed template."
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
        id: "installed-comments-feed-routing-not-executed",
        owner: ISSUE.external_ref,
        detail: "The fixture executes the RSS2 comments template directly through a local PHP server. do_feed_rss2_comments routing, query resolution, canonical URL behavior, and browser-observed installed routing remain later gates."
      },
      {
        id: "database-backed-comment-post-loop-not-executed",
        owner: ISSUE.external_ref,
        detail: "The fixture stubs comments, posts, title/search/singular state, protected-post checks, dates, and content. Database-backed comment, post, password, taxonomy, and cache behavior remain covered by other domains or later integration gates."
      },
      {
        id: "public-php-adapter-not-yet-generated",
        owner: ISSUE.external_ref,
        detail: "The fixture compares copied oracle PHP in both roots; generated original-path PHP replacement remains a later cross-domain gate."
      }
    ],
    ownership_manifest: OWNERSHIP,
    validation_result: {
      status: "passed",
      fixture_cases: CASES.length,
      covered_symbols: COVERED_SYMBOLS.length,
      observations_match: observationsMatch,
      public_php_replacement_claimed: false,
      installed_wordpress_behavior_claimed: false,
      database_backed_comment_loop_claimed: false
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestText);
  const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-312-17-rss2-comments-feed-template-oracle-fixture",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "RSS2 comments feed template oracle-source-mirror fixture manifest" },
      { path: OWNERSHIP, role: "ownership manifest for copied-oracle RSS2 comments feed template boundary" },
      { path: RUNNER, role: "deterministic HTTP-observed oracle/candidate fixture generator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-312-rss2-comments-feed-template-oracle-fixture",
      "npm run wp:core:wphx-312-rss2-comments-feed-template-oracle-fixture:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
      "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
      "receipt:wphx-312-15-rss2-feed-template-oracle-fixture",
      "receipt:wphx-312-16-atom-feed-template-oracle-fixture"
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
        fixture_cases: CASES.length,
        observations_match: observationsMatch
      },
      null,
      2
    )
  );
}

await main();
