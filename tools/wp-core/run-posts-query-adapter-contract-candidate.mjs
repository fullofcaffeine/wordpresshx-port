#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.14",
  external_ref: "WPHX-307",
  title: "Posts, metadata, revisions, WP_Query"
};
const RECORDED_AT = "2026-06-23T22:15:00.000Z";
const HXML = "fixtures/wp-core/posts-query-adapter-contract-candidate.hxml";
const OUT_ROOT = "build/wp-core/wphx-307-02";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const ENTRY = `${HAXE_OUT}/index.php`;
const SURFACE = "manifests/wp-core/wphx-307-01-posts-query-surface.v1.json";
const OUT = "manifests/wp-core/wphx-307-02-posts-query-adapter-contract-candidate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-307-02-posts-query-adapter-contract-candidate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-307-02-posts-query-adapter-contract-candidate.v1.json";
const RUNNER = "tools/wp-core/run-posts-query-adapter-contract-candidate.mjs";
const HAXE_SOURCES = [
  HXML,
  "src/wphx/wp/posts/PostsQueryAdapterContract.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/PostsQueryAdapterContractCandidateEntry.hx"
];

const EXPECTED = {
  semantic_owner: "haxe",
  adapter_contract_owner: "haxe_typed",
  emission_strategy: "stock_haxe_php_private_impl",
  execution_provider: "haxe_php",
  compatibility_evidence: "targeted_semantic_parity",
  "query:paged": "pagination",
  "query:orderby": "ordering",
  "query:post_parent": "content_filter",
  "query:author__in": "author_filter",
  "query:tax_query": "taxonomy_filter",
  "query:meta_query": "meta_filter",
  "query:date_query": "date_filter",
  "query:s": "search",
  "query:post_status": "post_status",
  "query:post_type": "post_type",
  "query:unknown": "unknown",
  "order:empty": "DESC",
  "order:asc-lower": "ASC",
  "order:garbage": "DESC",
  "status:publish": "public",
  "status:private": "private",
  "status:future": "scheduled",
  "status:draft": "draft_like",
  "status:trash": "trashed",
  "status:inherit": "revision",
  "status:custom": "custom",
  "lifecycle:no-change": "no_change",
  "lifecycle:publish": "becomes_public",
  "lifecycle:unpublish": "leaves_public",
  "lifecycle:trash": "trash",
  "lifecycle:restore": "restore",
  "lifecycle:revision": "revision",
  "meta:post": "post_meta",
  "meta:revision": "revision_parent_post_meta",
  "meta:unsupported": "unsupported_meta",
  "cache:none": "none",
  "cache:post": "post_cache",
  "cache:meta": "post_and_meta_cache",
  "cache:post-query": "post_and_query_cache",
  "cache:post-meta-query": "post_meta_and_query_cache"
};

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

function filesUnder(root) {
  const files = [];
  function visit(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) visit(child);
      if (entry.isFile()) {
        const data = readFileSync(child);
        files.push({
          path: relative(root, child),
          bytes: data.length,
          sha256: createHash("sha256").update(data).digest("hex")
        });
      }
    }
  }
  visit(root);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function sourceEscapeAudit(path) {
  const source = readFileSync(path, "utf8");
  return {
    path,
    contains_dynamic: /\bDynamic\b/.test(source),
    contains_untyped: /\buntyped\b/.test(source),
    contains_cast: /\bcast\b/.test(source),
    contains_php_syntax_code: /php\.Syntax\.code/.test(source),
    contains_raw_javascript: /\bjs\.Syntax\b/.test(source)
  };
}

function parseOutput(output) {
  const result = {};
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const separator = line.indexOf("=");
    if (separator < 0) throw new Error(`Unexpected output line: ${line}`);
    result[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return result;
}

function generatedPhpLintRecords(paths) {
  return paths
    .filter((record) => record.path.endsWith(".php"))
    .map((record) => ({
      path: `${HAXE_OUT}/${record.path}`,
      relative_path: record.path,
      sha256: `sha256:${record.sha256}`,
      php_lint: command("php", ["-l", `${HAXE_OUT}/${record.path}`])
    }));
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-307-posts-query-adapter-contract-candidate`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/posts-query-adapter-contract-candidate",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "haxe_adapter_contract",
      name: "posts, metadata, revisions, and WP_Query routing decision model",
      area: "wp-includes/post.php wp-includes/meta.php wp-includes/class-wp-query.php wp-includes/revision.php",
      public_contract:
        "Haxe owns the first typed posts/query adapter-contract decision model. Public PHP ABI replacement, SQL parity, object-cache parity, and installed post/query behavior are not claimed in this slice."
    },
    ownership_state: "haxe_parity_candidate",
    ownership_axes: {
      semantic_owner: "haxe",
      adapter_contract_owner: "haxe_typed",
      emission_strategy: "stock_haxe_php_private_impl",
      execution_provider: "haxe_php",
      compatibility_evidence: "targeted_semantic_parity"
    },
    bridge: {
      exists: true,
      kind: "adapter-contract-candidate-without-public-php-installation",
      removal_gate:
        "Move these contracts into typed Adapter IR/original-path generation and pass post CRUD, metadata, revisions, WP_Query, live database, and upstream PHPUnit oracle fixtures before claiming public PHP ABI ownership."
    },
    owned_paths: HAXE_SOURCES.concat([RUNNER, OUT, OWNERSHIP, RECEIPT]),
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-307-posts-query-adapter-contract-candidate",
        "npm run wp:core:wphx-307-posts-query-adapter-contract-candidate:check",
        "npm run haxe:escape-hatches:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-307-02-posts-query-adapter-contract-candidate"],
      manifest_digest: manifestSha
    },
    notes:
      "This is a PHP-hosted Haxe candidate. It adds no native provider and no handwritten production PHP shell."
  };
}

const lock = JSON.parse(readFileSync("toolchain.lock.json", "utf8"));
rmSync(OUT_ROOT, { recursive: true, force: true });
command("haxe", [HXML]);

const generatedFiles = filesUnder(HAXE_OUT);
const output = command("php", [ENTRY]);
const observations = parseOutput(output);
const matchesExpected = JSON.stringify(observations) === JSON.stringify(EXPECTED);
const haxeSourceAudits = HAXE_SOURCES.filter((path) => path.endsWith(".hx")).map(sourceEscapeAudit);
const sourceEscapeAuditPassed = haxeSourceAudits.every(
  (audit) =>
    !audit.contains_dynamic &&
    !audit.contains_untyped &&
    !audit.contains_cast &&
    !audit.contains_php_syntax_code &&
    !audit.contains_raw_javascript
);

if (!matchesExpected || !sourceEscapeAuditPassed) {
  console.error(JSON.stringify({ status: "failed", matchesExpected, observations, haxeSourceAudits }, null, 2));
  process.exit(1);
}

const manifest = {
  schema: "wphx.wp-core-posts-query-adapter-contract-candidate.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  inputs: {
    surface_manifest: inputRecord(SURFACE),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    hxml: inputRecord(HXML),
    haxe_sources: HAXE_SOURCES.map(inputRecord)
  },
  fixture: {
    candidate_kind: "haxe_posts_query_adapter_contract_candidate",
    promoted_contracts: [
      "WP_Query query-var classification",
      "query order normalization",
      "post status family classification",
      "post lifecycle transition route",
      "post metadata route",
      "post/query cache-invalidation intent"
    ],
    expected_observations: EXPECTED,
    public_abi_policy: {
      public_php_replacement_claimed: false,
      handwritten_php_shells_added: false,
      adapter_contract_owner: "haxe_typed",
      semantic_owner: "haxe",
      native_provider_claimed: false,
      removal_gate:
        "Install through typed Adapter IR/original-path generation and run differential posts/query fixtures before claiming public PHP ABI ownership."
    },
    source_escape_audits: haxeSourceAudits
  },
  toolchain: {
    haxe_version: command("haxe", ["--version"]),
    locked_haxe_version: lock.tools.haxe.version,
    php_cli_profile: command("php", ["-r", "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;"])
  },
  build: {
    generated_haxe_files: generatedFiles,
    php_lint: generatedPhpLintRecords(generatedFiles)
  },
  run: {
    command: `php ${ENTRY}`,
    raw_output_sha256: sha256(output),
    observations,
    matches_expected: matchesExpected
  },
  remaining_gaps: [
    {
      id: "public-php-adapter-not-yet-generated",
      owner: ISSUE.external_ref,
      detail:
        "The candidate has not replaced wp-includes/post.php, wp-includes/meta.php, wp-includes/class-wp-query.php, wp-includes/revision.php, public post-type APIs, or packaged distribution files."
    },
    {
      id: "database-and-cache-parity-not-yet-proven",
      owner: ISSUE.external_ref,
      detail:
        "Post CRUD, metadata persistence, revisions, WP_Query SQL/result behavior, hooks, and cache invalidation still require oracle fixtures and live database parity."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    candidate_kind: "haxe_posts_query_adapter_contract_candidate",
    promoted_contracts: 6,
    runtime_runs: 1,
    source_escape_audit_passed: sourceEscapeAuditPassed,
    public_php_replacement_claimed: false
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-307-02-posts-query-adapter-contract-candidate",
  issue: { ...ISSUE, title: "Promote first posts/query pure helpers to Haxe parity candidates" },
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "posts/query Haxe semantic/adapter-contract candidate manifest" },
    { path: OWNERSHIP, role: "ADR-004-aware ownership manifest for posts/query Haxe candidate" },
    { path: "src/wphx/wp/posts/PostsQueryAdapterContract.hx", role: "typed Haxe posts/query semantic and adapter-contract model" },
    { path: RUNNER, role: "candidate generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-307-posts-query-adapter-contract-candidate",
    "npm run wp:core:wphx-307-posts-query-adapter-contract-candidate:check",
    "npm run haxe:escape-hatches:check",
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
