#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.18.20",
  external_ref: "WPHX-312.20",
  title: "WPHX-312.20 - Add RSS 0.92 feed template oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-rss-feed-template-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-312-20";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const OUT = "manifests/wp-core/wphx-312-20-rss-feed-template-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-20-rss-feed-template-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-20-rss-feed-template-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const RSS2_FIXTURE = "manifests/wp-core/wphx-312-15-rss2-feed-template-oracle-fixture.v1.json";
const RDF_FIXTURE = "manifests/wp-core/wphx-312-19-rdf-feed-template-oracle-fixture.v1.json";

const SOURCE_FILES = ["src/wp-includes/feed-rss.php"];
const COVERED_SYMBOLS = [
  "feed-rss.php",
  "feed_content_type",
  "wp_title_rss",
  "bloginfo_rss",
  "get_feed_build_date",
  "rss_head",
  "have_posts",
  "the_post",
  "the_title_rss",
  "the_excerpt_rss",
  "the_permalink_rss",
  "rss_item"
];
const CASES = [
  { id: "rss092:single", path: "/wp-includes/feed-rss.php?case=single", focus: "RSS 0.92 channel metadata, header hook, one item, excerpt, permalink, and item hook output" },
  { id: "rss092:multi", path: "/wp-includes/feed-rss.php?case=multi", focus: "post loop renders multiple RSS 0.92 items with per-post titles, descriptions, links, and hook markers" },
  { id: "rss092:special-chars", path: "/wp-includes/feed-rss.php?case=special", focus: "title/excerpt/link escaping boundaries remain observable in RSS 0.92 output" },
  { id: "rss092:empty-excerpt", path: "/wp-includes/feed-rss.php?case=empty-excerpt", focus: "empty excerpt branch emits an empty CDATA description without suppressing item output" },
  { id: "rss092:no-posts", path: "/wp-includes/feed-rss.php?case=empty", focus: "empty post loop still emits channel metadata and header hook without items" }
];

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
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
    `${root}/rss-prepend.php`,
    `<?php
error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

$GLOBALS['wphx_312_20_case'] = $_GET['case'] ?? 'single';
$GLOBALS['wphx_312_20_index'] = -1;
$GLOBALS['post'] = null;

function wphx_312_20_posts() {
\t$case = $GLOBALS['wphx_312_20_case'];
\tif ( 'empty' === $case ) {
\t\treturn array();
\t}
\t$base = array(
\t\t(object) array(
\t\t\t'ID' => 101,
\t\t\t'title' => 'special' === $case ? 'Alpha & RSS <One>' : 'Alpha RSS',
\t\t\t'permalink' => 'https://example.test/posts/alpha-rss',
\t\t\t'excerpt' => 'empty-excerpt' === $case ? '' : 'Alpha rss excerpt',
\t\t),
\t\t(object) array(
\t\t\t'ID' => 202,
\t\t\t'title' => 'Beta RSS',
\t\t\t'permalink' => 'https://example.test/posts/beta-rss',
\t\t\t'excerpt' => 'Beta rss excerpt',
\t\t),
\t);
\treturn 'multi' === $case ? $base : array( $base[0] );
}
function wphx_312_20_current_post() {
\t$posts = wphx_312_20_posts();
\treturn $posts[ $GLOBALS['wphx_312_20_index'] ] ?? $posts[0] ?? null;
}
function feed_content_type( $type = '' ) { return 'rss' === $type ? 'application/rss+xml' : 'application/octet-stream'; }
function get_option( $name, $default = false ) { return 'blog_charset' === $name ? 'UTF-8' : $default; }
function wp_title_rss() { echo 'Fixture RSS 0.92 &amp; Title'; }
function bloginfo_rss( $show = '' ) {
\t$values = array(
\t\t'url' => 'https://example.test',
\t\t'description' => 'Fixture RSS description',
\t\t'language' => 'en-US',
\t);
\techo $values[ $show ] ?? 'Fixture RSS Site';
}
function get_feed_build_date( $format ) { return 'Sat, 27 Jun 2026 00:00:00 +0000'; }
function do_action( $hook_name, ...$args ) {
\tif ( 'rss_head' === $hook_name ) {
\t\techo "\\t<fixture:head>rss092</fixture:head>\\n";
\t}
\tif ( 'rss_item' === $hook_name ) {
\t\t$post = wphx_312_20_current_post();
\t\techo "\\t\\t<fixture:item marker=\\"" . $post->ID . "\\" />\\n";
\t}
}
function have_posts() { return $GLOBALS['wphx_312_20_index'] + 1 < count( wphx_312_20_posts() ); }
function the_post() {
\t$GLOBALS['wphx_312_20_index']++;
\t$GLOBALS['post'] = wphx_312_20_current_post();
}
function the_title_rss() { echo htmlspecialchars( wphx_312_20_current_post()->title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' ); }
function the_excerpt_rss() { echo wphx_312_20_current_post()->excerpt; }
function the_permalink_rss() { echo wphx_312_20_current_post()->permalink; }
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
    has_header_action_output: body.includes("<fixture:head>rss092</fixture:head>"),
    has_item_action_output: body.includes("<fixture:item marker="),
    has_channel_metadata:
      body.includes("<title>Fixture RSS 0.92 &amp; Title</title>") &&
      body.includes("<lastBuildDate>Sat, 27 Jun 2026 00:00:00 +0000</lastBuildDate>") &&
      body.includes("<language>en-US</language>"),
    has_special_title: body.includes("<title>Alpha &amp; RSS &lt;One&gt;</title>"),
    has_empty_excerpt: body.includes("<description><![CDATA[]]></description>"),
    has_multi_output: body.includes("<title>Beta RSS</title>") && body.includes("<link>https://example.test/posts/beta-rss</link>")
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
  const prepend = resolve(`${root}/rss-prepend.php`);
  const proc = spawn("php", ["-d", `auto_prepend_file=${prepend}`, "-S", `127.0.0.1:${port}`, "-t", root], {
    stdio: ["ignore", "ignore", "pipe"]
  });
  let stderr = "";
  proc.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (proc.exitCode !== null) throw new Error(`php -S exited early for ${root}: ${stderr}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/wp-includes/feed-rss.php?case=single`);
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
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-312-rss-feed-template-oracle-fixture`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/rss-feed-template-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "RSS 0.92 feed template output behavior",
      area: SOURCE_FILES.join(" "),
      public_contract:
        "This fixture executes copied WordPress 7.0 wp-includes/feed-rss.php through PHP's built-in HTTP server with a deterministic auto-prepended feed-loop stub. It observes content-type headers and RSS 0.92 XML output without database-backed WP_Query, installed feed routing, or live network behavior."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-stubbed-feed-loop-boundary",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass installed feed routing, database-backed WP_Query/post behavior, selected upstream PHPUnit, and ecosystem fixtures before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-rss-feed-template-oracle-fixture",
        "npm run wp:core:wphx-312-rss-feed-template-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-20-rss-feed-template-oracle-fixture"],
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
    schema: "wphx.wp-core-rss-feed-template-oracle-fixture.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_classes: ["oracle_source_mirror", "candidate_package_mirror", "http_observed_fixture"],
    artifact_scope: "fixture",
    inputs: {
      surface_manifest: inputRecord(SURFACE),
      adapter_contract_manifest: inputRecord(CONTRACT),
      rss2_fixture_manifest: inputRecord(RSS2_FIXTURE),
      rdf_fixture_manifest: inputRecord(RDF_FIXTURE),
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
        auto_prepend_stub: "rss-prepend.php supplies deterministic feed-loop functions; copied feed-rss.php remains the executed template."
      },
      public_abi_policy: {
        public_php_replacement_claimed: false,
        copied_oracle_public_php: true,
        adapter_contract_foundation: CONTRACT,
        installed_wordpress_behavior_claimed: false
      }
    },
    build: { oracle_root: ORACLE_ROOT, candidate_root: CANDIDATE_ROOT, php_lint: phpLint },
    observations: {
      oracle,
      candidate,
      match: observationsMatch,
      oracle_sha256: sha256(JSON.stringify(oracle)),
      candidate_sha256: sha256(JSON.stringify(candidate))
    },
    remaining_gaps: [
      {
        id: "installed-rss-feed-routing-not-executed",
        owner: ISSUE.external_ref,
        detail: "The fixture executes the RSS 0.92 template directly through a local PHP server. do_feed_rss routing, query resolution, canonical URL behavior, and browser-observed installed routing remain later gates."
      },
      {
        id: "database-backed-post-loop-not-executed",
        owner: ISSUE.external_ref,
        detail: "The fixture stubs the post loop, titles, excerpts, links, and dates. Database-backed WP_Query, post cache, and content filter behavior remain covered by other domains or later integration gates."
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
      database_backed_feed_loop_claimed: false
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestText);
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-312-20-rss-feed-template-oracle-fixture",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "RSS 0.92 feed template oracle-source-mirror fixture manifest" },
      { path: OWNERSHIP, role: "ownership manifest for copied-oracle RSS 0.92 feed template boundary" },
      { path: RUNNER, role: "deterministic HTTP-observed oracle/candidate fixture generator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-312-rss-feed-template-oracle-fixture",
      "npm run wp:core:wphx-312-rss-feed-template-oracle-fixture:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
      "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
      "receipt:wphx-312-15-rss2-feed-template-oracle-fixture",
      "receipt:wphx-312-19-rdf-feed-template-oracle-fixture"
    ],
    validation_result: manifest.validation_result
  };

  try {
    writeOrCheck(OUT, manifestText);
    writeOrCheck(OWNERSHIP, JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n");
    writeOrCheck(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
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
