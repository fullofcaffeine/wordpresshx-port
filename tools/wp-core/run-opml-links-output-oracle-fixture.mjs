#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.18.14",
  external_ref: "WPHX-312.14",
  title: "WPHX-312.14 - Add OPML links output oracle fixture"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-opml-links-output-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-312-14";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const OUT = "manifests/wp-core/wphx-312-14-opml-links-output-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-312-14-opml-links-output-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-312-14-opml-links-output-oracle-fixture.v1.json";
const SURFACE = "manifests/wp-core/wphx-312-01-http-cron-mail-feed-embed-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate.v1.json";
const FEED_EMBED_FIXTURE = "manifests/wp-core/wphx-312-04-feed-embed-https-oracle-fixture.v1.json";
const REMOTE_FETCH_FIXTURE = "manifests/wp-core/wphx-312-08-remote-fetch-oembed-oracle-fixture.v1.json";
const INSTALLED_GATE = "manifests/wp-core/wphx-312-09-http-mail-feed-embed-installed-gate.v1.json";

const SOURCE_FILES = ["src/wp-links-opml.php"];
const COVERED_SYMBOLS = [
  "wp-links-opml.php",
  "get_option",
  "get_bloginfo",
  "get_categories",
  "get_bookmarks",
  "apply_filters('link_category')",
  "apply_filters('link_title')",
  "do_action('opml_head')",
  "esc_attr",
  "esc_url",
  "absint"
];
const CASES = [
  { id: "opml:default-all-categories", path: "/wp-links-opml.php", focus: "default request emits all link categories, OPML header action output, escaped titles, link URLs, and updated timestamps" },
  { id: "opml:numeric-category", path: "/wp-links-opml.php?link_cat=2", focus: "numeric link_cat request narrows get_categories include and returns only that category" },
  { id: "opml:encoded-category", path: "/wp-links-opml.php?link_cat=2%20fixture", focus: "encoded link_cat is urldecoded and absint-normalized before include selection" },
  { id: "opml:all-category-token", path: "/wp-links-opml.php?link_cat=all", focus: "the all token is preserved through include selection and treated as all categories by the fixture data provider" },
  { id: "opml:zero-category-token", path: "/wp-links-opml.php?link_cat=0", focus: "the zero token is empty under PHP rules and falls back to the default all-category query" }
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

function writeLoadStub(root) {
  writeFileSync(
    `${root}/wp-load.php`,
    `<?php
error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

$GLOBALS['wphx_312_14_category_args'] = array();
$GLOBALS['wphx_312_14_filter_calls'] = array();
$GLOBALS['wphx_312_14_action_calls'] = array();

function get_option( $name, $default = false ) {
\t$options = array(
\t\t'blog_charset' => 'UTF-8',
\t);
\treturn array_key_exists( $name, $options ) ? $options[ $name ] : $default;
}
function __( $text ) { return $text; }
function absint( $value ) { return abs( (int) $value ); }
function esc_attr( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' ); }
function esc_url( $value ) {
\t$value = trim( (string) $value );
\treturn preg_match( '/^https?:\\/\\//', $value ) ? $value : '';
}
function get_bloginfo( $show = '', $filter = 'raw' ) {
\tif ( 'name' === $show ) {
\t\treturn 'Fixture & Links <Site>';
\t}
\treturn 'Fixture Links';
}
function apply_filters( $hook_name, $value, ...$args ) {
\t$GLOBALS['wphx_312_14_filter_calls'][] = array( 'hook' => $hook_name, 'value' => $value );
\tif ( 'link_category' === $hook_name ) {
\t\treturn 'Filtered ' . $value;
\t}
\tif ( 'link_title' === $hook_name ) {
\t\treturn 'Filtered ' . $value;
\t}
\treturn $value;
}
function do_action( $hook_name, ...$args ) {
\t$GLOBALS['wphx_312_14_action_calls'][] = array( 'hook' => $hook_name, 'arg_count' => count( $args ) );
\tif ( 'opml_head' === $hook_name ) {
\t\techo "\\t\\t<ownerName>Fixture OPML Head</ownerName>\\n";
\t}
}
function get_categories( $args = array() ) {
\t$GLOBALS['wphx_312_14_category_args'][] = $args;
\t$all = array(
\t\t(object) array( 'term_id' => 1, 'name' => 'News & Updates' ),
\t\t(object) array( 'term_id' => 2, 'name' => 'Dev <Links>' ),
\t\t(object) array( 'term_id' => 3, 'name' => 'Empty Category' ),
\t);
\tif ( ! array_key_exists( 'include', $args ) || 'all' === $args['include'] ) {
\t\treturn $all;
\t}
\t$include = (int) $args['include'];
\treturn array_values(
\t\tarray_filter(
\t\t\t$all,
\t\t\tfunction ( $cat ) use ( $include ) {
\t\t\t\treturn $cat->term_id === $include;
\t\t\t}
\t\t)
\t);
}
function get_bookmarks( $args = array() ) {
\t$category = (int) ( $args['category'] ?? 0 );
\t$links = array(
\t\t1 => array(
\t\t\t(object) array(
\t\t\t\t'link_name' => 'Alpha & Omega',
\t\t\t\t'link_rss' => 'https://feeds.example.test/alpha.xml',
\t\t\t\t'link_url' => 'https://example.test/alpha?x=1&y=2',
\t\t\t\t'link_updated' => '2026-06-01 02:03:04',
\t\t\t),
\t\t\t(object) array(
\t\t\t\t'link_name' => 'Unsafe URL',
\t\t\t\t'link_rss' => 'javascript:alert(1)',
\t\t\t\t'link_url' => 'ftp://example.test/file',
\t\t\t\t'link_updated' => '0000-00-00 00:00:00',
\t\t\t),
\t\t),
\t\t2 => array(
\t\t\t(object) array(
\t\t\t\t'link_name' => 'Haxe <Compiler>',
\t\t\t\t'link_rss' => 'https://feeds.example.test/haxe.xml',
\t\t\t\t'link_url' => 'https://haxe.example.test/',
\t\t\t\t'link_updated' => '2026-06-02 03:04:05',
\t\t\t),
\t\t),
\t\t3 => array(),
\t);
\treturn $links[ $category ] ?? array();
}
`
  );
}

function normalizeBody(body) {
  return body
    .replace(/<dateCreated>[^<]+ GMT<\/dateCreated>/, "<dateCreated><normalized-date> GMT</dateCreated>")
    .replace(/\r\n/g, "\n");
}

function observation(caseDef, response) {
  const body = normalizeBody(response.body);
  const categoryMatches = body.match(/<outline type="category"/g) ?? [];
  const linkMatches = body.match(/type="link"/g) ?? [];
  return {
    case: caseDef.id,
    request_path: caseDef.path,
    status: response.status,
    content_type: response.headers.get("content-type") ?? "",
    body_sha256: sha256(body),
    body,
    category_outline_count: categoryMatches.length,
    link_outline_count: linkMatches.length,
    has_opml_head_action_output: body.includes("<ownerName>Fixture OPML Head</ownerName>"),
    has_filtered_category: body.includes("Filtered Dev &lt;Links&gt;"),
    has_filtered_link_title: body.includes("Filtered Haxe &lt;Compiler&gt;"),
    has_empty_unsafe_url: body.includes('xmlUrl="" htmlUrl=""'),
    has_updated_timestamp: body.includes("2026-06-02 03:04:05")
  };
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function startPhpServer(root) {
  const port = await freePort();
  const proc = spawn("php", ["-S", `127.0.0.1:${port}`, "-t", root], {
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
      const response = await fetch(`http://127.0.0.1:${port}/wp-links-opml.php`, { method: "GET" });
      await response.text();
      return {
        baseUrl: `http://127.0.0.1:${port}`,
        stop: () =>
          new Promise((resolve) => {
            proc.once("exit", resolve);
            proc.kill("SIGTERM");
          })
      };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
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
      const response = await fetch(`${server.baseUrl}${caseDef.path}`, { method: "GET" });
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
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-312-opml-links-output-oracle-fixture`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/opml-links-output-oracle-fixture",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "oracle_source_mirror_fixture",
      name: "wp-links-opml.php OPML link category and bookmark output behavior",
      area: SOURCE_FILES.join(" "),
      public_contract:
        "This fixture executes copied WordPress 7.0 wp-links-opml.php through PHP's built-in HTTP server against deterministic wp-load.php stubs for options, link categories, bookmarks, filters, and the opml_head action. It observes content-type headers and normalized XML output without a database or installed link manager."
    },
    ownership_state: "oracle_mirror_behavior_fixture",
    bridge: {
      exists: true,
      kind: "copied-oracle-public-php-with-stubbed-link-data-boundary",
      removal_gate:
        "Replace copied public PHP with generated original-path adapters and pass installed feed template rendering, database-backed bookmark/link manager, OPML endpoint, selected upstream PHPUnit, and ecosystem fixtures before claiming public PHP ownership."
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-312-opml-links-output-oracle-fixture",
        "npm run wp:core:wphx-312-opml-links-output-oracle-fixture:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-312-14-opml-links-output-oracle-fixture"],
      manifest_digest: manifestSha
    }
  };
}

async function main() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeLoadStub(ORACLE_ROOT);
  writeLoadStub(CANDIDATE_ROOT);

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
    schema: "wphx.wp-core-opml-links-output-oracle-fixture.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_classes: ["oracle_source_mirror", "candidate_package_mirror", "http_observed_fixture"],
    artifact_scope: "fixture",
    inputs: {
      surface_manifest: inputRecord(SURFACE),
      adapter_contract_manifest: inputRecord(CONTRACT),
      feed_embed_fixture_manifest: inputRecord(FEED_EMBED_FIXTURE),
      remote_fetch_fixture_manifest: inputRecord(REMOTE_FETCH_FIXTURE),
      installed_gate_manifest: inputRecord(INSTALLED_GATE),
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
        timestamp_normalization: "dateCreated is normalized to <normalized-date> while preserving OPML shape"
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
        id: "installed-feed-template-rendering-not-executed",
        owner: ISSUE.external_ref,
        detail: "The fixture executes only wp-links-opml.php with deterministic link stubs. RSS/Atom feed templates, post embed rendering, REST oEmbed dispatch, and browser-observed installed routing remain later gates."
      },
      {
        id: "bookmark-database-link-manager-not-executed",
        owner: ISSUE.external_ref,
        detail: "The fixture stubs get_categories and get_bookmarks. Database-backed bookmark storage, admin link-manager workflows, and legacy ecosystem behavior remain later coverage."
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
      database_backed_bookmarks_claimed: false
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestText);
  const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-312-14-opml-links-output-oracle-fixture",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "OPML links output oracle-source-mirror fixture manifest" },
      { path: OWNERSHIP, role: "ownership manifest for copied-oracle OPML link output boundary" },
      { path: RUNNER, role: "deterministic HTTP-observed oracle/candidate fixture generator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-312-opml-links-output-oracle-fixture",
      "npm run wp:core:wphx-312-opml-links-output-oracle-fixture:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-312-01-http-cron-mail-feed-embed-surface",
      "receipt:wphx-312-02-http-cron-mail-feed-embed-adapter-contract-candidate",
      "receipt:wphx-312-04-feed-embed-https-oracle-fixture",
      "receipt:wphx-312-08-remote-fetch-oembed-oracle-fixture",
      "receipt:wphx-312-09-http-mail-feed-embed-installed-gate"
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
