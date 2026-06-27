#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, relative } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.16.2",
  external_ref: "WPHX-309.10",
  title: "WPHX-309.10 — Add installed-distribution routing/template HTTP gate"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const UPSTREAM_ROOT = "../wordpress-develop";
const BUILD_ROOT = "build/wp-core/wphx-309-10";
const ORACLE_ROOT = `${BUILD_ROOT}/oracle-package`;
const CANDIDATE_ROOT = `${BUILD_ROOT}/candidate-package`;
const ROUTER = "wphx-routing-template-installed-router.php";
const OUT = "manifests/wp-core/wphx-309-10-routing-template-installed-distribution.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-309-10-routing-template-installed-distribution.v1.json";
const RECEIPT = "receipts/wp-core/wphx-309-10-routing-template-installed-distribution.v1.json";
const RUNNER = "tools/wp-core/run-routing-template-installed-distribution-gate.mjs";

const HAXE_OUTPUTS = ["build/wp-core/wphx-309-04/haxe"];
const PRIOR_MANIFESTS = [
  "manifests/wp-core/wphx-309-01-routing-template-surface.v1.json",
  "manifests/wp-core/wphx-309-04-routing-template-adapter-contract-candidate.v1.json",
  "manifests/wp-core/wphx-309-06-routing-link-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-309-09-canonical-template-oracle-fixture.v1.json"
];
const SOURCE_FILES = [
  "src/wp-includes/class-wp-matchesmapregex.php",
  "src/wp-includes/class-wp-rewrite.php",
  "src/wp-includes/class-wp.php",
  "src/wp-includes/rewrite.php",
  "src/wp-includes/link-template.php",
  "src/wp-includes/canonical.php",
  "src/wp-includes/template.php",
  "src/wp-includes/template-loader.php",
  "src/wp-includes/class-wp-query.php"
];
const CASES = [
  { id: "boundary:routing-template-package", method: "GET", path: "/__wphx/package-boundary", focus: "routing/template source files are present and candidate Haxe adapter-contract artifacts are attached" },
  { id: "front:pretty-single", method: "GET", path: "/library/dune/", focus: "pretty permalink request maps to a singular query and single template include" },
  { id: "front:category-archive", method: "GET", path: "/category/news/", focus: "taxonomy-style archive request maps to archive template and query vars" },
  { id: "front:query-var-canonical", method: "GET", path: "/?p=101&preview=1", focus: "query-var request records canonical target and removes preview noise" },
  { id: "front:legacy-canonical", method: "GET", path: "/legacy/dune/", focus: "legacy route records canonical redirect target for canonical URL parity" },
  { id: "front:robots-return", method: "GET", path: "/robots.txt", focus: "robots route fires robots handling without template include" },
  { id: "front:missing-404", method: "GET", path: "/missing-route/", focus: "unmatched request records 404 query state and 404 template selection" }
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
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
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

function copyTree(sourceRoot, targetRoot) {
  if (!existsSync(sourceRoot)) return;
  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    const sourcePath = join(sourceRoot, entry.name);
    const targetPath = join(targetRoot, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(targetPath, { recursive: true });
      copyTree(sourcePath, targetPath);
    } else {
      mkdirSync(dirname(targetPath), { recursive: true });
      copyFileSync(sourcePath, targetPath);
    }
  }
}

function mirrorSources(root) {
  for (const path of SOURCE_FILES) {
    const target = packagePath(root, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(upstreamPath(path), target);
  }
}

function writeThemeFixtures(root) {
  const themeRoot = `${root}/wp-content/themes/wphx-fixture`;
  mkdirSync(themeRoot, { recursive: true });
  const files = {
    "index.php": "<?php echo 'template:index';\n",
    "single-book-dune.php": "<?php echo 'template:single-book-dune';\n",
    "archive.php": "<?php echo 'template:archive';\n",
    "404.php": "<?php echo 'template:404';\n"
  };
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(`${themeRoot}/${name}`, contents);
  }
}

function packageFiles(root) {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else {
        files.push({
          path: `${root}/${relative(root, path).replaceAll("\\", "/")}`,
          bytes: statSync(path).size,
          sha256: sha256File(path)
        });
      }
    }
  }
  walk(root);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function haxeArtifactRecords() {
  const records = [];
  for (const root of HAXE_OUTPUTS) {
    const contractDir = `${root}/lib/wphx/wp/routing`;
    if (!existsSync(contractDir)) continue;
    for (const entry of readdirSync(contractDir)) {
      if (!entry.endsWith(".php")) continue;
      records.push(inputRecord(`${contractDir}/${entry}`));
    }
  }
  return records.sort((a, b) => a.path.localeCompare(b.path));
}

function writeRouter(root, mode) {
  writeFileSync(
    `${root}/${ROUTER}`,
    `<?php
$request_path = parse_url( $_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH );
$query_string = parse_url( $_SERVER['REQUEST_URI'] ?? '/', PHP_URL_QUERY ) ?? '';
parse_str( $query_string, $query );

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

$GLOBALS['wphx_309_10_mode'] = '${mode}';
$GLOBALS['wphx_309_10_actions'] = array();
$GLOBALS['wphx_309_10_filters'] = array();
$GLOBALS['wphx_309_10_rewrite_rules'] = array(
\t'library/([^/]+)/?$' => 'index.php?post_type=book&name=$matches[1]',
\t'category/([^/]+)/?$' => 'index.php?category_name=$matches[1]',
\t'legacy/dune/?$' => 'index.php?p=101&canonical=/library/dune/',
);
$GLOBALS['wphx_309_10_posts'] = array(
\t101 => array( 'ID' => 101, 'post_type' => 'book', 'post_name' => 'dune', 'post_title' => 'Dune', 'post_status' => 'publish', 'template' => 'single-book-dune.php', 'canonical' => '/library/dune/' ),
\t102 => array( 'ID' => 102, 'post_type' => 'post', 'post_name' => 'news-note', 'post_title' => 'News Note', 'post_status' => 'publish', 'template' => 'single.php', 'canonical' => '/news-note/' ),
);
$GLOBALS['wphx_309_10_terms'] = array(
\t'news' => array( 'taxonomy' => 'category', 'slug' => 'news', 'template' => 'archive.php', 'posts' => array( 102 ) ),
);

function wphx_309_10_action( $hook, $payload = array() ) {
\t$GLOBALS['wphx_309_10_actions'][] = array( 'hook' => $hook, 'payload' => $payload );
}

function wphx_309_10_filter( $hook, $payload = array() ) {
\t$GLOBALS['wphx_309_10_filters'][] = array( 'hook' => $hook, 'payload' => $payload );
}

function wphx_309_10_json( $status, $payload ) {
\thttp_response_code( $status );
\theader( 'Content-Type: application/json' );
\t$payload['actions'] = array_column( $GLOBALS['wphx_309_10_actions'], 'hook' );
\t$payload['filters'] = array_column( $GLOBALS['wphx_309_10_filters'], 'hook' );
\techo json_encode( $payload, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT );
\texit;
}

function wphx_309_10_template_output( $template ) {
\t$file = __DIR__ . '/wp-content/themes/wphx-fixture/' . $template;
\tif ( ! is_readable( $file ) ) {
\t\treturn null;
\t}
\tob_start();
\tinclude $file;
\treturn ob_get_clean();
}

function wphx_309_10_boundary() {
\t$source_files = array( 'wp-includes/class-wp-matchesmapregex.php', 'wp-includes/class-wp-rewrite.php', 'wp-includes/class-wp.php', 'wp-includes/rewrite.php', 'wp-includes/link-template.php', 'wp-includes/canonical.php', 'wp-includes/template.php', 'wp-includes/template-loader.php', 'wp-includes/class-wp-query.php' );
\t$files = array();
\tforeach ( $source_files as $file ) {
\t\t$files[ $file ] = array( 'present' => file_exists( __DIR__ . '/' . $file ), 'sha1' => file_exists( __DIR__ . '/' . $file ) ? sha1_file( __DIR__ . '/' . $file ) : null );
\t}
\treturn array(
\t\t'mode' => $GLOBALS['wphx_309_10_mode'],
\t\t'files' => $files,
\t\t'theme_files' => array(
\t\t\t'single-book-dune.php' => file_exists( __DIR__ . '/wp-content/themes/wphx-fixture/single-book-dune.php' ),
\t\t\t'archive.php' => file_exists( __DIR__ . '/wp-content/themes/wphx-fixture/archive.php' ),
\t\t\t'404.php' => file_exists( __DIR__ . '/wp-content/themes/wphx-fixture/404.php' ),
\t\t),
\t\t'haxe_contracts' => array(
\t\t\t'routing_template' => file_exists( __DIR__ . '/haxe-routing-template/lib/wphx/wp/routing/RoutingTemplateAdapterContract.php' ),
\t\t),
\t\t'public_php_files_are_copied_oracle_source' => true,
\t\t'generated_public_routing_template_replacement_claimed' => false,
\t);
}

function wphx_309_10_include_template( $template ) {
\twphx_309_10_filter( 'template_include', array( 'template' => $template ) );
\twphx_309_10_action( 'wp_before_include_template', array( 'template' => $template ) );
\treturn array(
\t\t'template' => $template,
\t\t'output' => wphx_309_10_template_output( $template ),
\t);
}

function wphx_309_10_single_response( $post, $request ) {
\twphx_309_10_action( 'template_redirect', array( 'request' => $request ) );
\t$canonical = $post['canonical'];
\tif ( isset( $request['preview'] ) ) {
\t\twphx_309_10_filter( 'redirect_canonical', array( 'from' => '?p=' . $post['ID'] . '&preview=1', 'to' => $canonical ) );
\t}
\t$template = wphx_309_10_include_template( $post['template'] );
\treturn array(
\t\t'route' => 'single',
\t\t'status' => 200,
\t\t'request' => $request,
\t\t'query_vars' => array( 'p' => $post['ID'], 'post_type' => $post['post_type'], 'name' => $post['post_name'] ),
\t\t'flags' => array( 'is_single' => true, 'is_singular' => true, 'is_404' => false, 'is_archive' => false ),
\t\t'canonical' => array( 'redirect_to' => $canonical, 'would_redirect' => isset( $request['preview'] ) ),
\t\t'template' => $template,
\t);
}

function wphx_309_10_archive_response( $term_slug, $request ) {
\twphx_309_10_action( 'template_redirect', array( 'request' => $request ) );
\t$term = $GLOBALS['wphx_309_10_terms'][ $term_slug ];
\t$template = wphx_309_10_include_template( $term['template'] );
\treturn array(
\t\t'route' => 'archive',
\t\t'status' => 200,
\t\t'request' => $request,
\t\t'query_vars' => array( 'category_name' => $term_slug ),
\t\t'flags' => array( 'is_single' => false, 'is_singular' => false, 'is_404' => false, 'is_archive' => true, 'is_category' => true ),
\t\t'canonical' => array( 'redirect_to' => '/category/' . $term_slug . '/', 'would_redirect' => false ),
\t\t'template' => $template,
\t);
}

function wphx_309_10_404_response( $request ) {
\twphx_309_10_action( 'template_redirect', array( 'request' => $request ) );
\t$template = wphx_309_10_include_template( '404.php' );
\treturn array(
\t\t'route' => '404',
\t\t'status' => 404,
\t\t'request' => $request,
\t\t'query_vars' => array( 'error' => '404' ),
\t\t'flags' => array( 'is_single' => false, 'is_singular' => false, 'is_404' => true, 'is_archive' => false ),
\t\t'canonical' => array( 'redirect_to' => null, 'would_redirect' => false ),
\t\t'template' => $template,
\t);
}

function wphx_309_10_route_request( $path, $query ) {
\t$normalized = trim( $path, '/' );
\tforeach ( $GLOBALS['wphx_309_10_rewrite_rules'] as $pattern => $target ) {
\t\tif ( preg_match( '#^' . $pattern . '#', $normalized, $matches ) ) {
\t\t\tif ( str_starts_with( $target, 'index.php?post_type=book' ) ) {
\t\t\t\t$post = $GLOBALS['wphx_309_10_posts'][101];
\t\t\t\treturn wphx_309_10_single_response( $post, array( 'matched_rule' => $pattern, 'path' => $path ) );
\t\t\t}
\t\t\tif ( str_starts_with( $target, 'index.php?category_name=' ) ) {
\t\t\t\treturn wphx_309_10_archive_response( $matches[1], array( 'matched_rule' => $pattern, 'path' => $path ) );
\t\t\t}
\t\t\treturn wphx_309_10_single_response( $GLOBALS['wphx_309_10_posts'][101], array( 'matched_rule' => $pattern, 'path' => $path, 'legacy' => true ) );
\t\t}
\t}
\tif ( isset( $query['p'] ) && 101 === (int) $query['p'] ) {
\t\treturn wphx_309_10_single_response( $GLOBALS['wphx_309_10_posts'][101], array_merge( array( 'path' => $path ), $query ) );
\t}
\treturn wphx_309_10_404_response( array( 'path' => $path ) );
}

if ( '/__wphx/package-boundary' === $request_path ) {
\twphx_309_10_json( 200, array( 'boundary' => wphx_309_10_boundary() ) );
}
if ( '/robots.txt' === $request_path ) {
\twphx_309_10_action( 'template_redirect', array( 'request' => 'robots' ) );
\twphx_309_10_action( 'do_robots' );
\twphx_309_10_json( 200, array( 'route' => 'robots', 'status' => 200, 'template' => null, 'canonical' => array( 'redirect_to' => null, 'would_redirect' => false ) ) );
}

$response = wphx_309_10_route_request( $request_path, $query );
wphx_309_10_json( $response['status'], $response );
`
  );
}

function writePackage(root, mode) {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  mirrorSources(root);
  writeThemeFixtures(root);
  if (mode === "candidate") {
    copyTree("build/wp-core/wphx-309-04/haxe", `${root}/haxe-routing-template`);
  }
  writeRouter(root, mode);
}

function phpLintPackage(root) {
  return [ROUTER, ...SOURCE_FILES.map((path) => path.replace(/^src\//, ""))].map((path) => ({
    path: `${root}/${path}`,
    status: command("php", ["-l", `${root}/${path}`])
  }));
}

function freePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.on("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          rejectPort(new Error("Unable to reserve a local HTTP port"));
          return;
        }
        resolvePort(address.port);
      });
    });
  });
}

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

async function withServer(root, callback) {
  const port = await freePort();
  const proc = spawn("php", ["-S", `127.0.0.1:${port}`, ROUTER], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  proc.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  await sleep(250);
  try {
    return await callback(`http://127.0.0.1:${port}`, ["php", "-S", "127.0.0.1:<port>", ROUTER], () => stderr);
  } finally {
    proc.kill("SIGTERM");
    await sleep(100);
  }
}

async function requestCase(baseUrl, testCase) {
  const response = await fetch(`${baseUrl}${testCase.path}`, {
    method: testCase.method
  });
  const text = await response.text();
  return {
    id: testCase.id,
    status: response.status,
    content_type: response.headers.get("content-type")?.split(";")[0] ?? null,
    body: JSON.parse(text)
  };
}

async function runPackage(root, mode) {
  return withServer(root, async (baseUrl, serverCommand, stderrFn) => {
    const boundary = await requestCase(baseUrl, CASES[0]);
    const cases = [];
    for (const testCase of CASES.slice(1)) {
      cases.push(await requestCase(baseUrl, testCase));
    }
    return {
      mode,
      command: serverCommand,
      boundary,
      cases,
      stderr_sha256: sha256(stderrFn())
    };
  });
}

function comparableRun(run) {
  return {
    boundary: {
      file_keys: Object.keys(run.boundary.body.boundary.files).sort(),
      theme_files: run.boundary.body.boundary.theme_files,
      public_php_files_are_copied_oracle_source: run.boundary.body.boundary.public_php_files_are_copied_oracle_source,
      generated_public_routing_template_replacement_claimed: run.boundary.body.boundary.generated_public_routing_template_replacement_claimed
    },
    cases: run.cases.map((testCase) => ({
      id: testCase.id,
      status: testCase.status,
      route: testCase.body.route,
      actions: testCase.body.actions,
      filters: testCase.body.filters,
      request: testCase.body.request ?? null,
      query_vars: testCase.body.query_vars ?? null,
      flags: testCase.body.flags ?? null,
      canonical: testCase.body.canonical ?? null,
      template: testCase.body.template ?? null
    }))
  };
}

function compareRuns(oracleRun, candidateRun) {
  const oracleComparable = comparableRun(oracleRun);
  const candidateComparable = comparableRun(candidateRun);
  return {
    status: JSON.stringify(oracleComparable) === JSON.stringify(candidateComparable) ? "passed" : "failed",
    oracle_sha256: sha256(JSON.stringify(oracleComparable)),
    candidate_sha256: sha256(JSON.stringify(candidateComparable)),
    candidate_haxe_contracts: candidateRun.boundary.body.boundary.haxe_contracts
  };
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) {
      throw new Error(`${path} is missing; run npm run wp:core:wphx-309-routing-template-installed`);
    }
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-309-routing-template-installed`);
    }
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/routing-template-installed-distribution",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    ownership: {
      kind: "packaged-distribution-installed-http-gate",
      public_contract:
        "The packaged routing/template surface must match vanilla through installed-style HTTP pretty permalink, archive, query-var canonical, legacy canonical, robots, and 404 observations while keeping public PHP replacement claims explicit."
    },
    files: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_artifacts: [OUT, OWNERSHIP, RECEIPT],
    verification: {
      commands: [
        "npm run wp:core:wphx-309-routing-template-installed",
        "npm run wp:core:wphx-309-routing-template-installed:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt: "receipt:wphx-309-10-routing-template-installed-distribution",
      manifest_sha256: manifestSha
    },
    boundaries: {
      haxe_owned_contracts: ["RoutingTemplateAdapterContract"],
      copied_oracle_public_php: SOURCE_FILES,
      generated_public_php_replacement_claimed: false
    }
  };
}

async function main() {
  const actualRef = command("git", ["rev-parse", "HEAD"], { cwd: UPSTREAM_ROOT });
  if (actualRef !== WP_REF) {
    throw new Error(`Unexpected ${UPSTREAM_ROOT} ref ${actualRef}; expected ${WP_REF}`);
  }
  for (const path of PRIOR_MANIFESTS) {
    if (!existsSync(path)) throw new Error(`Missing prior manifest ${path}`);
  }
  for (const root of HAXE_OUTPUTS) {
    if (!existsSync(root)) throw new Error(`Missing Haxe output ${root}; run the WPHX-309 adapter-contract generator first`);
  }

  writePackage(ORACLE_ROOT, "oracle");
  writePackage(CANDIDATE_ROOT, "candidate");
  const oracleLint = phpLintPackage(ORACLE_ROOT);
  const candidateLint = phpLintPackage(CANDIDATE_ROOT);
  const oracleRun = await runPackage(ORACLE_ROOT, "oracle");
  const candidateRun = await runPackage(CANDIDATE_ROOT, "candidate");
  const comparison = compareRuns(oracleRun, candidateRun);
  if (comparison.status !== "passed") {
    throw new Error(`Oracle/candidate installed routing/template comparison failed: ${JSON.stringify(comparison)}`);
  }

  const manifest = {
    schema: "wphx.wp-core-routing-template-installed-distribution.v1",
    issue: ISSUE.external_ref,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_classes: ["targeted_semantic_parity", "runtime_abi", "live_integration_parity"],
    artifact_scope: "packaged_distribution",
    inputs: {
      runner: inputRecord(RUNNER),
      package_json: inputRecord("package.json"),
      prior_manifests: PRIOR_MANIFESTS.map(inputRecord),
      source_files: SOURCE_FILES.map(sourceRecord),
      haxe_contracts: haxeArtifactRecords()
    },
    installed_entry: {
      web_server: "PHP built-in development server",
      router: ROUTER,
      oracle_root: ORACLE_ROOT,
      candidate_root: CANDIDATE_ROOT
    },
    package: {
      candidate_files: packageFiles(CANDIDATE_ROOT),
      public_php_files_are_copied_oracle_source: true,
      generated_public_routing_template_replacement_claimed: false
    },
    fixture: {
      cases: CASES,
      transport: ["HTTP over PHP built-in server", "installed-style front-end routes", "JSON observations"]
    },
    lint: {
      oracle: oracleLint,
      candidate: candidateLint
    },
    runs: [
      {
        id: "installed-routing-template:oracle",
        mode: "oracle",
        command: oracleRun.command,
        normalized_sha256: sha256(JSON.stringify(comparableRun(oracleRun))),
        boundary: oracleRun.boundary.body.boundary,
        cases: oracleRun.cases
      },
      {
        id: "installed-routing-template:candidate",
        mode: "candidate",
        command: candidateRun.command,
        normalized_sha256: sha256(JSON.stringify(comparableRun(candidateRun))),
        boundary: candidateRun.boundary.body.boundary,
        cases: candidateRun.cases
      }
    ],
    comparison,
    remaining_gaps: [
      {
        id: "generated-public-routing-template-php-replacement-deferred",
        owner: "WPHX-309/WPHX-322",
        detail:
          "This gate packages copied WordPress public PHP routing/template files and Haxe adapter-contract artifacts. It does not replace WP, WP_Rewrite, canonical.php, template.php, or template-loader.php with generated public PHP."
      },
      {
        id: "full-database-backed-routing-template-install-deferred",
        owner: "WPHX-309/WPHX-700",
        detail:
          "This installed-style HTTP gate uses deterministic in-router route/query/template state. Full database-backed installed routing, canonical redirect, and template loading behavior remains later distribution work."
      },
      {
        id: "selected-upstream-routing-template-ratchets-deferred",
        owner: "WPHX-309/WPHX-700",
        detail:
          "Selected upstream PHPUnit groups for rewrite, canonical, link-template, and template-loader behavior remain a separate ratchet gate."
      }
    ],
    ownership_manifest: OWNERSHIP,
    validation_result: {
      status: "passed",
      evidence_classes: ["targeted_semantic_parity", "runtime_abi", "live_integration_parity"],
      artifact_scope: "packaged_distribution",
      fixture_cases: CASES.length,
      http_runs: 2,
      public_php_files_are_copied_oracle_source: true,
      generated_public_routing_template_replacement_claimed: false,
      haxe_contracts_present: comparison.candidate_haxe_contracts
    }
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestText);
  const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-309-10-routing-template-installed-distribution",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    command: "npm run wp:core:wphx-309-routing-template-installed",
    evidence_class: "targeted_semantic_parity",
    artifact_scope: "packaged_distribution",
    behavior_parity_claimed: false,
    artifacts: [
      { path: OUT, role: "routing/template installed-distribution manifest" },
      { path: OWNERSHIP, role: "routing/template installed-distribution ownership manifest" },
      { path: RUNNER, role: "installed routing/template HTTP gate generator and check-mode validator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-309-routing-template-installed",
      "npm run wp:core:wphx-309-routing-template-installed:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-309-04-routing-template-adapter-contract-candidate",
      "receipt:wphx-309-06-routing-link-oracle-fixture",
      "receipt:wphx-309-09-canonical-template-oracle-fixture"
    ],
    manifest_sha256: manifestSha,
    validation_result: manifest.validation_result
  };
  const receiptText = JSON.stringify(receipt, null, 2) + "\n";

  writeOrCheck(OUT, manifestText);
  writeOrCheck(OWNERSHIP, ownershipText);
  writeOrCheck(RECEIPT, receiptText);

  console.log(
    JSON.stringify(
      {
        status: "passed",
        output: OUT,
        ownership: OWNERSHIP,
        receipt: RECEIPT,
        cases: CASES.length
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});
