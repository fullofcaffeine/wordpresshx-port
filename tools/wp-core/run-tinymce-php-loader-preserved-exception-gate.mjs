#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import net from "node:net";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.33.6",
  external_ref: "WPHX-323.28",
  title: "Add TinyMCE PHP loader preserved-exception fixture"
};
const RECORDED_AT = "2026-07-08T21:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-tinymce-php-loader-preserved-exception-gate.mjs";
const UPSTREAM_LOCK = "upstream.lock.json";
const AI_TINYMCE_GATES = "manifests/wp-core/wphx-323-07-ai-client-tinymce-vendor-gates.v1.json";
const SOURCE_INVENTORY = "manifests/source-inventory.jsonl";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const OUT = "manifests/wp-core/wphx-323-28-tinymce-php-loader-preserved-exception.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-28-tinymce-php-loader-preserved-exception.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-28-tinymce-php-loader-preserved-exception.v1.json";

const OUT_ROOT = "build/wp-core/wphx-323-28";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const SERVER_CWD = `${OUT_ROOT}/server-cwd`;
const TINYMCE_SOURCE = "src/js/_enqueues/vendor/tinymce/wp-tinymce.php";
const TINYMCE_DISTRIBUTION = "wp-includes/js/tinymce/wp-tinymce.php";
const UPSTREAM_TINYMCE_MIN = "src/js/_enqueues/vendor/tinymce/tinymce.min.js";
const UPSTREAM_COMPAT3X_MIN = "src/js/_enqueues/vendor/tinymce/plugins/compat3x/plugin.min.js";
const EXPIRES_OFFSET_SECONDS = 31536000;
const EXPIRES_TOLERANCE_SECONDS = 10;

const WP_TINYMCE_BUNDLE = "/* WPHX TinyMCE c=1 bundle fixture */\nwindow.WPHX_TINYMCE_BUNDLE = true;\n";
const TINYMCE_MIN = "/* WPHX TinyMCE fallback tinymce.min fixture */\nwindow.WPHX_TINYMCE_MIN = true;\n";
const COMPAT3X_MIN =
  "/* WPHX TinyMCE fallback compat3x plugin fixture */\nwindow.WPHX_TINYMCE_COMPAT3X = true;\n";
const CWD_DECOY = "/* WPHX wrong current-working-directory decoy */\nwindow.WPHX_TINYMCE_CWD_DECOY = true;\n";
const EXIT_SENTINEL = "WPHX_AFTER_TINYMCE_EXIT";

const LAYOUTS = [
  {
    id: "source_path",
    root_path: "source-layout",
    script_path: TINYMCE_SOURCE,
    role: "WordPress develop source path"
  },
  {
    id: "distribution_path",
    root_path: "distribution-layout",
    script_path: TINYMCE_DISTRIBUTION,
    role: "WordPress distribution path"
  }
];

const SCENARIOS = [
  {
    id: "normal",
    description: "wp-tinymce.js plus fallback files exist",
    assets: {
      wp_bundle: true,
      fallback: true
    }
  },
  {
    id: "wp_bundle_missing",
    description: "wp-tinymce.js is missing and fallback files exist",
    assets: {
      wp_bundle: false,
      fallback: true
    }
  },
  {
    id: "fallback_missing",
    description: "wp-tinymce.js and fallback files are missing",
    assets: {
      wp_bundle: false,
      fallback: false
    }
  }
];

const REQUEST_CASES = [
  {
    id: "c1_wp_bundle_output",
    scenario: "normal",
    query: "?c=1",
    expected_body: WP_TINYMCE_BUNDLE,
    proves: ["c=1 output emits only wp-tinymce.js when present", "__DIR__ asset lookup"]
  },
  {
    id: "fallback_concat_output",
    scenario: "normal",
    query: "",
    expected_body: TINYMCE_MIN + COMPAT3X_MIN,
    proves: ["no c fallback concatenates tinymce.min.js and compat3x plugin"]
  },
  {
    id: "c1_missing_bundle_falls_back",
    scenario: "wp_bundle_missing",
    query: "?c=1",
    expected_body: TINYMCE_MIN + COMPAT3X_MIN,
    proves: ["c=1 falls back when wp-tinymce.js is missing"]
  },
  {
    id: "missing_fallback_no_warning_no_c",
    scenario: "fallback_missing",
    query: "",
    expected_body: "",
    proves: ["missing fallback files do not leak warning text"]
  },
  {
    id: "missing_fallback_no_warning_c1",
    scenario: "fallback_missing",
    query: "?c=1",
    expected_body: "",
    proves: ["missing c=1 and fallback files do not leak warning text"]
  }
];

const NON_CLAIMS = [
  "This gate renews the TinyMCE wp-tinymce.php preserved browser-vendor PHP-loader exception; it does not claim generated replacement.",
  "This gate does not claim Haxe-owned TinyMCE PHP loader runtime logic.",
  "This gate does not claim TinyMCE JavaScript, CSS, font, browser-editor, plugin, skin, theme, Gutenberg, or browser package ownership.",
  "This gate uses a tiny fake asset tree and does not execute real TinyMCE browser behavior.",
  "This gate does not retire copied or preserved upstream TinyMCE artifacts.",
  "This gate does not claim installed WordPress browser/editor parity or plugin ecosystem compatibility.",
  "A generated loader replacement remains blocked on browser-vendor coordination, asset path/hash contracts, and a generated direct-script adapter receipt."
];

function command(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 120
  }).trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function fileRecord(path) {
  return { path, bytes: statSync(path).size, sha256: sha256File(path) };
}

function upstreamPath(path) {
  return `${UPSTREAM_ROOT}/${path}`;
}

function upstreamFileRecord(path) {
  const full = upstreamPath(path);
  return { path, bytes: statSync(full).size, sha256: sha256File(full) };
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function listRelativeFiles(root, prefix = "") {
  const full = prefix ? `${root}/${prefix}` : root;
  return readdirSync(full, { withFileTypes: true })
    .flatMap((entry) => {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory() ? listRelativeFiles(root, path) : [path];
    })
    .sort();
}

function findJsonlRecord(path, predicate) {
  const rows = readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const record = rows.find(predicate);
  if (!record) throw new Error(`Missing JSONL record in ${path}`);
  return record;
}

function currentWordPressCheckout(upstreamLock) {
  const wordpressRepo = upstreamLock.repositories.find((repo) => repo.id === "wordpress-vanilla");
  if (!wordpressRepo) throw new Error("upstream.lock.json is missing wordpress-vanilla");
  const currentCommit = command("git", ["-C", UPSTREAM_ROOT, "rev-parse", "HEAD"]);
  const currentTree = command("git", ["-C", UPSTREAM_ROOT, "rev-parse", "HEAD^{tree}"]);
  const statusText = command("git", ["-C", UPSTREAM_ROOT, "status", "--short"]);
  if (currentCommit !== wordpressRepo.git.commit) {
    throw new Error(`wordpress-develop commit drift: lock=${wordpressRepo.git.commit} actual=${currentCommit}`);
  }
  if (currentTree !== wordpressRepo.git.tree) {
    throw new Error(`wordpress-develop tree drift: lock=${wordpressRepo.git.tree} actual=${currentTree}`);
  }
  return {
    relative_path: wordpressRepo.relativePath,
    authority: wordpressRepo.authority,
    role: wordpressRepo.role,
    locked_commit: wordpressRepo.git.commit,
    locked_tree: wordpressRepo.git.tree,
    locked_tag: wordpressRepo.git.tag,
    current_commit: currentCommit,
    current_tree: currentTree,
    observed_dirty_state_from_lock: wordpressRepo.observedDirtyState,
    current_status_short: statusText ? statusText.split("\n") : []
  };
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run without --check to generate it`);
    if (readFileSync(path, "utf8") !== content) throw new Error(`${path} is stale; run without --check to refresh it`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function writeFileEnsuringDir(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function scriptDir(root, scenario, layout) {
  return `${root}/http/${scenario.id}/${layout.root_path}/${dirname(layout.script_path)}`;
}

function scriptUrlPath(scenario, layout) {
  return `/${scenario.id}/${layout.root_path}/${layout.script_path}`;
}

function createFixtureRoot(root) {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  writeFileEnsuringDir(`${root}/http/__wphx_server_probe.txt`, "ok\n");

  const loader = readFileSync(upstreamPath(TINYMCE_SOURCE), "utf8");
  for (const scenario of SCENARIOS) {
    for (const layout of LAYOUTS) {
      const dir = scriptDir(root, scenario, layout);
      writeFileEnsuringDir(`${dir}/wp-tinymce.php`, loader);
      writeFileEnsuringDir(
        `${dir}/exit-wrapper.php`,
        `<?php\n$_GET['c'] = '1';\ninclude __DIR__ . '/wp-tinymce.php';\necho '${EXIT_SENTINEL}';\n`
      );
      if (scenario.assets.wp_bundle) {
        writeFileEnsuringDir(`${dir}/wp-tinymce.js`, WP_TINYMCE_BUNDLE);
      }
      if (scenario.assets.fallback) {
        writeFileEnsuringDir(`${dir}/tinymce.min.js`, TINYMCE_MIN);
        writeFileEnsuringDir(`${dir}/plugins/compat3x/plugin.min.js`, COMPAT3X_MIN);
      }
    }
  }
}

function createServerCwd() {
  rmSync(SERVER_CWD, { recursive: true, force: true });
  mkdirSync(`${SERVER_CWD}/plugins/compat3x`, { recursive: true });
  writeFileSync(`${SERVER_CWD}/wp-tinymce.js`, CWD_DECOY);
  writeFileSync(`${SERVER_CWD}/tinymce.min.js`, CWD_DECOY);
  writeFileSync(`${SERVER_CWD}/plugins/compat3x/plugin.min.js`, CWD_DECOY);
}

function lintGeneratedPhp(root) {
  return listRelativeFiles(root)
    .filter((path) => path.endsWith(".php"))
    .map((path) => {
      const output = command("php", ["-l", `${root}/${path}`]);
      return {
        path,
        ok: output.includes("No syntax errors detected"),
        output
      };
    });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => {
        if (port === null) reject(new Error("Unable to allocate test HTTP port"));
        else resolve(port);
      });
    });
  });
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function startPhpServer(documentRoot) {
  const port = await getFreePort();
  const absoluteDocumentRoot = resolve(documentRoot);
  const stderr = [];
  const stdout = [];
  const child = spawn("php", ["-S", `127.0.0.1:${port}`, "-t", absoluteDocumentRoot], {
    cwd: SERVER_CWD,
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => stdout.push(chunk.toString("utf8")));
  child.stderr.on("data", (chunk) => stderr.push(chunk.toString("utf8")));

  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) {
      throw new Error(`PHP server exited early: ${stderr.join("").trim()}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/__wphx_server_probe.txt`);
      if (response.ok) {
        await response.text();
        return {
          port,
          stop: async () => {
            if (child.exitCode === null) {
              child.kill("SIGTERM");
              for (let i = 0; i < 40 && child.exitCode === null; i++) {
                await sleep(25);
              }
              if (child.exitCode === null) child.kill("SIGKILL");
            }
          },
          output: () => ({ stderr: stderr.join(""), stdout: stdout.join("") })
        };
      }
    } catch {
      // Server is not accepting connections yet.
    }
    await sleep(50);
  }

  child.kill("SIGKILL");
  throw new Error(`Timed out waiting for PHP server: ${stderr.join("").trim()}`);
}

function warningLeakPresent(body) {
  return /Warning|Notice|Deprecated|Fatal error|failed to open stream|file_get_contents/i.test(body);
}

function headerAssertions(headers, requestStartedAtMs) {
  const contentType = headers.get("content-type");
  const vary = headers.get("vary");
  const expires = headers.get("expires");
  const cacheControl = headers.get("cache-control");
  const expiresMs = expires ? Date.parse(expires) : NaN;
  const expiresOffsetSeconds = Number.isFinite(expiresMs)
    ? Math.round((expiresMs - requestStartedAtMs) / 1000)
    : null;
  return {
    contentType,
    vary,
    expires_present: expires !== null,
    expires_gmt_format: expires !== null && expires.endsWith(" GMT"),
    expires_offset_within_tolerance:
      expiresOffsetSeconds !== null &&
      Math.abs(expiresOffsetSeconds - EXPIRES_OFFSET_SECONDS) <= EXPIRES_TOLERANCE_SECONDS,
    cacheControl,
    cache_control_max_age: cacheControl === `public, max-age=${EXPIRES_OFFSET_SECONDS}`,
    pass:
      contentType === "application/javascript; charset=UTF-8" &&
      vary === "Accept-Encoding" &&
      expires !== null &&
      expires.endsWith(" GMT") &&
      expiresOffsetSeconds !== null &&
      Math.abs(expiresOffsetSeconds - EXPIRES_OFFSET_SECONDS) <= EXPIRES_TOLERANCE_SECONDS &&
      cacheControl === `public, max-age=${EXPIRES_OFFSET_SECONDS}`
  };
}

async function fetchFixture(server, path) {
  const requestStartedAtMs = Date.now();
  const response = await fetch(`http://127.0.0.1:${server.port}${path}`);
  const body = await response.text();
  return {
    status: response.status,
    body,
    body_sha256: sha256(body),
    body_length: body.length,
    headers: headerAssertions(response.headers, requestStartedAtMs)
  };
}

async function runHttpSuite(root) {
  const server = await startPhpServer(`${root}/http`);
  const observations = [];
  try {
    for (const layout of LAYOUTS) {
      for (const requestCase of REQUEST_CASES) {
        const scenario = SCENARIOS.find((entry) => entry.id === requestCase.scenario);
        if (!scenario) throw new Error(`Unknown scenario ${requestCase.scenario}`);
        const path = `${scriptUrlPath(scenario, layout)}${requestCase.query}`;
        const response = await fetchFixture(server, path);
        observations.push({
          id: `${layout.id}:${requestCase.id}`,
          case_id: requestCase.id,
          scenario: scenario.id,
          layout: layout.id,
          layout_role: layout.role,
          path,
          proves: requestCase.proves,
          status: response.status,
          body: response.body,
          body_sha256: response.body_sha256,
          body_length: response.body_length,
          expected_body_sha256: sha256(requestCase.expected_body),
          expected_body_length: requestCase.expected_body.length,
          output_matches_expected: response.body === requestCase.expected_body,
          no_warning_leakage: !warningLeakPresent(response.body),
          cwd_decoy_absent: !response.body.includes("WPHX_TINYMCE_CWD_DECOY"),
          headers: response.headers
        });
      }

      const normalScenario = SCENARIOS[0];
      const exitPath = `/${normalScenario.id}/${layout.root_path}/${dirname(layout.script_path)}/exit-wrapper.php`;
      const exitResponse = await fetchFixture(server, exitPath);
      observations.push({
        id: `${layout.id}:exit_behavior`,
        case_id: "exit_behavior",
        scenario: normalScenario.id,
        layout: layout.id,
        layout_role: layout.role,
        path: exitPath,
        proves: ["loader exit prevents trailing wrapper output"],
        status: exitResponse.status,
        body: exitResponse.body,
        body_sha256: exitResponse.body_sha256,
        body_length: exitResponse.body_length,
        expected_body_sha256: sha256(WP_TINYMCE_BUNDLE),
        expected_body_length: WP_TINYMCE_BUNDLE.length,
        output_matches_expected: exitResponse.body === WP_TINYMCE_BUNDLE,
        sentinel_absent_after_exit: !exitResponse.body.includes(EXIT_SENTINEL),
        no_warning_leakage: !warningLeakPresent(exitResponse.body),
        cwd_decoy_absent: !exitResponse.body.includes("WPHX_TINYMCE_CWD_DECOY"),
        headers: exitResponse.headers
      });
    }
  } finally {
    await server.stop();
  }

  const failures = observations.filter(
    (entry) =>
      entry.status !== 200 ||
      !entry.output_matches_expected ||
      !entry.no_warning_leakage ||
      !entry.cwd_decoy_absent ||
      !entry.headers.pass ||
      (entry.case_id === "exit_behavior" && !entry.sentinel_absent_after_exit)
  );

  return {
    observations,
    counts: {
      request_count: observations.length,
      failure_count: failures.length,
      source_path_request_count: observations.filter((entry) => entry.layout === "source_path").length,
      distribution_path_request_count: observations.filter((entry) => entry.layout === "distribution_path").length,
      exit_behavior_request_count: observations.filter((entry) => entry.case_id === "exit_behavior").length,
      missing_asset_request_count: observations.filter((entry) => entry.scenario === "fallback_missing").length,
      warning_leakage_count: observations.filter((entry) => !entry.no_warning_leakage).length,
      header_failure_count: observations.filter((entry) => !entry.headers.pass).length,
      cwd_decoy_leak_count: observations.filter((entry) => !entry.cwd_decoy_absent).length
    },
    failures
  };
}

function packageDiffs(oracleRoot, candidateRoot) {
  const oracleFiles = listRelativeFiles(oracleRoot);
  const candidateFiles = listRelativeFiles(candidateRoot);
  const all = Array.from(new Set([...oracleFiles, ...candidateFiles])).sort();
  return all
    .map((path) => {
      const oraclePath = `${oracleRoot}/${path}`;
      const candidatePath = `${candidateRoot}/${path}`;
      const oracleExists = existsSync(oraclePath);
      const candidateExists = existsSync(candidatePath);
      if (!oracleExists || !candidateExists) {
        return { path, kind: oracleExists ? "missing_from_candidate" : "extra_in_candidate" };
      }
      const oracleSha = sha256File(oraclePath);
      const candidateSha = sha256File(candidatePath);
      if (oracleSha === candidateSha) return null;
      return {
        path,
        kind: "hash_mismatch",
        oracle_sha256: oracleSha,
        candidate_sha256: candidateSha
      };
    })
    .filter(Boolean);
}

function validateSuite(suite, label) {
  if (suite.counts.failure_count !== 0) {
    throw new Error(`${label} TinyMCE loader fixture failures: ${JSON.stringify(suite.failures, null, 2)}`);
  }
}

function fixturePathRecords(root) {
  return LAYOUTS.map((layout) => {
    const path = `${root}/http/normal/${layout.root_path}/${layout.script_path}`;
    return {
      layout: layout.id,
      role: layout.role,
      path,
      bytes: statSync(path).size,
      sha256: sha256File(path)
    };
  });
}

async function main() {
  const upstreamLock = readJson(UPSTREAM_LOCK);
  const wordpressCheckout = currentWordPressCheckout(upstreamLock);
  const aiTinymceGate = readJson(AI_TINYMCE_GATES);
  const sourceInventoryRecord = findJsonlRecord(SOURCE_INVENTORY, (row) => row.path === TINYMCE_SOURCE);
  const artifactProvenanceRecord = findJsonlRecord(ARTIFACT_PROVENANCE, (row) => row.path === TINYMCE_DISTRIBUTION);

  rmSync(OUT_ROOT, { recursive: true, force: true });
  mkdirSync(OUT_ROOT, { recursive: true });
  createServerCwd();
  createFixtureRoot(ORACLE_ROOT);
  createFixtureRoot(CANDIDATE_ROOT);

  const oracleLint = lintGeneratedPhp(ORACLE_ROOT);
  const candidateLint = lintGeneratedPhp(CANDIDATE_ROOT);
  const lintFailures = [...oracleLint, ...candidateLint].filter((entry) => !entry.ok);
  if (lintFailures.length > 0) {
    throw new Error(`TinyMCE loader PHP lint failures: ${JSON.stringify(lintFailures, null, 2)}`);
  }

  const packageDiff = packageDiffs(ORACLE_ROOT, CANDIDATE_ROOT);
  if (packageDiff.length > 0) {
    throw new Error(`Copied TinyMCE loader fixture roots diverged: ${JSON.stringify(packageDiff, null, 2)}`);
  }

  const oracle = await runHttpSuite(ORACLE_ROOT);
  const candidate = await runHttpSuite(CANDIDATE_ROOT);
  validateSuite(oracle, "oracle");
  validateSuite(candidate, "candidate");

  const observationsMatch = JSON.stringify(stable(oracle)) === JSON.stringify(stable(candidate));
  if (!observationsMatch) {
    throw new Error("Oracle/candidate TinyMCE loader HTTP observations diverged");
  }

  const sourceLoader = upstreamFileRecord(TINYMCE_SOURCE);
  const validationResult = {
    status: "passed",
    wordpress_oracle_locked_commit: wordpressCheckout.current_commit,
    tinymce_loader_source_path: TINYMCE_SOURCE,
    tinymce_loader_distribution_path: TINYMCE_DISTRIBUTION,
    tinymce_loader_source_sha256: sourceLoader.sha256,
    source_distribution_fixture_hashes_match: fixturePathRecords(CANDIDATE_ROOT).every(
      (record) => record.sha256 === sourceLoader.sha256
    ),
    source_inventory_record_present: true,
    artifact_provenance_record_present: true,
    request_fixture_count: candidate.counts.request_count,
    source_path_request_count: candidate.counts.source_path_request_count,
    distribution_path_request_count: candidate.counts.distribution_path_request_count,
    exit_behavior_request_count: candidate.counts.exit_behavior_request_count,
    missing_asset_request_count: candidate.counts.missing_asset_request_count,
    warning_leakage_count: candidate.counts.warning_leakage_count,
    header_failure_count: candidate.counts.header_failure_count,
    cwd_decoy_leak_count: candidate.counts.cwd_decoy_leak_count,
    fixture_failures_empty: candidate.counts.failure_count === 0,
    oracle_candidate_package_diffs_empty: packageDiff.length === 0,
    oracle_candidate_observations_match: observationsMatch,
    oracle_php_lint_count: oracleLint.length,
    candidate_php_lint_count: candidateLint.length,
    php_lint_failures_empty: lintFailures.length === 0,
    tiny_fake_asset_tree_only: true,
    generated_public_php_replacement_claimed: false,
    haxe_owned_tinymce_loader_runtime_claimed: false,
    tinymce_browser_runtime_claimed: false,
    tinymce_js_css_font_editor_ownership_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false
  };

  const manifest = {
    schema: "wphx.wp-core.tinymce-php-loader-preserved-exception.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "tinymce_php_loader_direct_http_preserved_exception_fixture_gate",
    behavior_parity_claimed: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_tinymce_loader_runtime_claimed: false,
    tinymce_browser_runtime_claimed: false,
    tinymce_js_css_font_editor_ownership_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false,
    inputs: {
      runner: fileRecord(RUNNER),
      upstream_lock: fileRecord(UPSTREAM_LOCK),
      ai_tinymce_gate_manifest: fileRecord(AI_TINYMCE_GATES),
      source_inventory: fileRecord(SOURCE_INVENTORY),
      artifact_provenance: fileRecord(ARTIFACT_PROVENANCE)
    },
    upstream_authority: wordpressCheckout,
    prior_gate_context: {
      ai_tinymce_gate: {
        issue: aiTinymceGate.issue,
        evidence_class: aiTinymceGate.evidence_class,
        tinymce_loader_preserved_exception_renewed:
          aiTinymceGate.validation_result?.tinymce_loader_preserved_exception_renewed ?? true,
        tinymce_loader_requirements:
          aiTinymceGate.source_surfaces?.tinymce_php_loader?.minimized_fixture_requirements ?? []
      }
    },
    source_distribution_path_hashes: {
      upstream_source_loader: sourceLoader,
      upstream_tinymce_min_asset: upstreamFileRecord(UPSTREAM_TINYMCE_MIN),
      upstream_compat3x_min_asset: upstreamFileRecord(UPSTREAM_COMPAT3X_MIN),
      source_inventory_record: sourceInventoryRecord,
      distribution_artifact_provenance_record: artifactProvenanceRecord,
      fixture_source_path_records: fixturePathRecords(CANDIDATE_ROOT).filter((record) => record.layout === "source_path"),
      fixture_distribution_path_records: fixturePathRecords(CANDIDATE_ROOT).filter(
        (record) => record.layout === "distribution_path"
      ),
      distribution_artifact_file_available_on_disk: existsSync(artifactProvenanceRecord.artifact ?? "")
    },
    fake_asset_tree: {
      root: `${CANDIDATE_ROOT}/http`,
      layouts: LAYOUTS,
      scenarios: SCENARIOS,
      fake_assets: {
        "wp-tinymce.js": { bytes: Buffer.byteLength(WP_TINYMCE_BUNDLE), sha256: sha256(WP_TINYMCE_BUNDLE) },
        "tinymce.min.js": { bytes: Buffer.byteLength(TINYMCE_MIN), sha256: sha256(TINYMCE_MIN) },
        "plugins/compat3x/plugin.min.js": {
          bytes: Buffer.byteLength(COMPAT3X_MIN),
          sha256: sha256(COMPAT3X_MIN)
        },
        "current-working-directory-decoys": {
          bytes: Buffer.byteLength(CWD_DECOY),
          sha256: sha256(CWD_DECOY)
        }
      },
      note:
        "The fixture intentionally uses tiny fake JS assets to prove loader path, header, cache, warning-suppression, and exit behavior without claiming TinyMCE browser runtime ownership."
    },
    http_observations: candidate.observations,
    validation_result: validationResult,
    removal_gate: [
      "Keep wp-tinymce.php preserved until a generated direct-script adapter reproduces this gate at the source and distribution paths.",
      "Any replacement must preserve exact direct output behavior for c=1, fallback concatenation, missing-file warning suppression, headers, cache expiry, __DIR__ path semantics, and exit behavior.",
      "WPHX-323.29 must record browser-vendor coordination, asset path/hash contracts, and TinyMCE JS/CSS/font/editor non-claims before any loader replacement claim can broaden."
    ],
    claims: [
      "TinyMCE wp-tinymce.php remains a preserved browser-vendor PHP-loader exception with direct HTTP fixture coverage.",
      "The fixture covers c=1 bundle output, fallback concatenation, c=1 fallback when wp-tinymce.js is missing, missing fallback assets without warning leakage, Content-Type/Vary/Expires/Cache-Control headers, __DIR__ path behavior, exit behavior, and source/distribution path mirrors.",
      "The fixture records upstream source/distribution provenance and a tiny fake asset tree as a prerequisite floor for any later generated loader adapter."
    ],
    non_claims: NON_CLAIMS
  };

  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestContent);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-28-tinymce-php-loader-preserved-exception",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    unit: {
      kind: "direct_http_fixture_gate",
      name: "TinyMCE wp-tinymce.php preserved PHP loader fixture",
      area: "src/js/_enqueues/vendor/tinymce/wp-tinymce.php and wp-includes/js/tinymce/wp-tinymce.php",
      public_contract:
        "TinyMCE loader remains preserved as browser-vendor PHP-loader support while this gate records direct script behavior for future generated adapter work."
    },
    ownership_state: "preserved_browser_vendor_php_loader_fixture_gate",
    bridge: {
      exists: true,
      kind: "preserved-upstream-browser-vendor-php-loader-with-direct-http-fixtures",
      removal_gate:
        "Replace only after a generated direct-script loader adapter passes this gate at source and distribution paths, records browser-vendor coordination in WPHX-323.29, and preserves non-claims for TinyMCE JS/CSS/font/editor ownership."
    },
    behavior_parity_claimed: false,
    public_php_replacement_claimed: false,
    haxe_owned_tinymce_loader_runtime_claimed: false,
    tinymce_browser_runtime_claimed: false,
    tinymce_js_css_font_editor_ownership_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false,
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    preserved_paths: [TINYMCE_SOURCE, TINYMCE_DISTRIBUTION],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-323-tinymce-php-loader-preserved-exception",
        "npm run wp:core:wphx-323-tinymce-php-loader-preserved-exception:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-323-28-tinymce-php-loader-preserved-exception"],
      manifest_digest: sha256(manifestContent)
    },
    non_claims: NON_CLAIMS
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-28-tinymce-php-loader-preserved-exception",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: manifest.evidence_class,
    artifact_scope: "wordpress-7.0-tinymce-wp-tinymce-php-loader-preserved-exception",
    commands: [
      "npm run wp:core:wphx-323-tinymce-php-loader-preserved-exception",
      "npm run wp:core:wphx-323-tinymce-php-loader-preserved-exception:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      ai_tinymce_gate_manifest: AI_TINYMCE_GATES
    },
    manifest_sha256: sha256(manifestContent),
    validation_result: validationResult,
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };
  writeOrCheck(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);

  return manifest;
}

try {
  const manifest = await main();
  console.log(
    JSON.stringify(
      {
        ok: true,
        check: checkOnly,
        manifest: OUT,
        receipt: RECEIPT,
        request_fixture_count: manifest.validation_result.request_fixture_count,
        source_path_request_count: manifest.validation_result.source_path_request_count,
        distribution_path_request_count: manifest.validation_result.distribution_path_request_count,
        exit_behavior_request_count: manifest.validation_result.exit_behavior_request_count,
        warning_leakage_count: manifest.validation_result.warning_leakage_count,
        header_failure_count: manifest.validation_result.header_failure_count,
        observations_match: manifest.validation_result.oracle_candidate_observations_match,
        tinymce_browser_runtime_claimed: manifest.validation_result.tinymce_browser_runtime_claimed
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
}
