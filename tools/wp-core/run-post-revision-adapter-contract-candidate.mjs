#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-8mp",
  external_ref: "WPHX-307.05",
  title: "Add post revisions adapter-contract candidate"
};
const RECORDED_AT = "2026-06-23T18:20:00.000Z";
const HXML = "fixtures/wp-core/post-revision-adapter-contract-candidate.hxml";
const OUT_ROOT = "build/wp-core/wphx-307-05";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const ENTRY = `${HAXE_OUT}/index.php`;
const PRIOR_MANIFEST = "manifests/wp-core/wphx-307-04-post-meta-cache-adapter-contract-candidate.v1.json";
const OUT = "manifests/wp-core/wphx-307-05-post-revision-adapter-contract-candidate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-307-05-post-revision-adapter-contract-candidate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-307-05-post-revision-adapter-contract-candidate.v1.json";
const RUNNER = "tools/wp-core/run-post-revision-adapter-contract-candidate.mjs";
const HAXE_SOURCES = [
  HXML,
  "src/wphx/wp/posts/PostRevisionAdapterContract.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/PostRevisionAdapterContractCandidateEntry.hx"
];

const EXPECTED = {
  "name:revision": "10-revision-v1",
  "name:autosave": "10-autosave-v1",
  "name-kind:revision": "revision_name",
  "name-kind:autosave": "autosave_name",
  "is-revision:parent": "revision_parent",
  "is-revision:missing": "not_revision",
  "is-autosave:parent": "autosave_parent",
  "is-autosave:not-autosave": "not_autosave",
  "is-autosave:missing": "not_revision",
  "save:doing-autosave": "skip_doing_autosave",
  "save:after-insert-owner": "skip_after_insert_owner",
  "save:missing-post": "skip_missing_post",
  "save:unsupported": "skip_unsupported_post_type",
  "save:auto-draft": "skip_auto_draft",
  "save:disabled": "skip_revisions_disabled",
  "save:unchanged": "skip_unchanged_since_latest_revision",
  "save:create-no-latest": "create_revision",
  "save:create-changed": "create_revision",
  "put:invalid": "invalid_post",
  "put:revision-of-revision": "revision_of_revision",
  "put:insert": "insert_revision",
  "restore:missing": "restore_missing_revision",
  "restore:no-fields": "restore_no_fields",
  "restore:update-failed": "restore_update_failed",
  "restore:update-post": "restore_update_post",
  "delete:missing": "delete_missing_revision",
  "delete:failed": "delete_failed",
  "delete:revision": "delete_revision",
  "retention:disabled": "retention_disabled",
  "retention:unlimited": "retention_unlimited",
  "retention:keep-all": "retention_keep_all",
  "retention:prune": "retention_prune_oldest",
  "keep:true": "-1",
  "keep:number": "7",
  "keep:unsupported": "0",
  "meta:none": "no_revision_meta",
  "meta:save": "copy_meta_to_revision",
  "meta:restore": "restore_meta_to_parent",
  "meta:compare": "compare_revisioned_meta",
  "hook:put": "put_revision_hook",
  "hook:restore": "restore_revision_hook",
  "hook:delete": "delete_revision_hook",
  "hook:failed": "no_revision_hooks"
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

function stableGeneratedContents(data) {
  return data
    .toString("utf8")
    .replace(/#(?:[A-Za-z]:)?[^#\r\n]*[/\\](std[/\\][^\r\n]*)/g, "#$HAXE_STD_PATH/$1");
}

function filesUnder(root) {
  const files = [];
  function visit(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) visit(child);
      if (entry.isFile()) {
        const stableContents = stableGeneratedContents(readFileSync(child));
        files.push({
          path: relative(root, child),
          bytes: Buffer.byteLength(stableContents),
          sha256: createHash("sha256").update(stableContents).digest("hex")
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
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-307-post-revision-adapter-contract-candidate`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/post-revision-adapter-contract-candidate",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "haxe_adapter_contract",
      name: "post revision save, restore, delete, retention, and meta intent",
      area: "wp-includes/revision.php wp-includes/post.php",
      public_contract:
        "Haxe owns a typed post revision adapter-contract decision model derived from _wp_post_revision_data(), wp_save_post_revision(), wp_is_post_revision(), wp_is_post_autosave(), _wp_put_post_revision(), wp_restore_post_revision(), wp_delete_post_revision(), wp_revisions_to_keep(), and revisioned meta helpers. Public PHP ABI replacement, SQL behavior, and installed revision behavior are not claimed in this slice."
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
        "Install these decisions through typed Adapter IR/original-path generation and pass PHP-authored revision, autosave, restore/delete, revisioned meta, hook, cache, live database, and upstream PHPUnit oracle fixtures before claiming public PHP ABI ownership."
    },
    owned_paths: HAXE_SOURCES.concat([RUNNER, OUT, OWNERSHIP, RECEIPT]),
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-307-post-revision-adapter-contract-candidate",
        "npm run wp:core:wphx-307-post-revision-adapter-contract-candidate:check",
        "npm run haxe:escape-hatches:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-307-05-post-revision-adapter-contract-candidate"],
      manifest_digest: manifestSha
    },
    notes:
      "This is a PHP-hosted Haxe candidate. It adds no native provider, no handwritten production PHP shell, and no public WordPress file replacement."
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
  schema: "wphx.wp-core-post-revision-adapter-contract-candidate.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["targeted_semantic_parity", "generated_shape"],
  artifact_scope: "helper",
  inputs: {
    prior_manifest: inputRecord(PRIOR_MANIFEST),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    hxml: inputRecord(HXML),
    haxe_sources: HAXE_SOURCES.map(inputRecord)
  },
  fixture: {
    candidate_kind: "haxe_post_revision_adapter_contract_candidate",
    promoted_contracts: [
      "revision and autosave post_name construction",
      "wp_is_post_revision and wp_is_post_autosave parent routing",
      "wp_save_post_revision skip/create decision routing",
      "_wp_put_post_revision invalid/revision-of-revision/insert routing",
      "wp_restore_post_revision missing/no-fields/failure/success routing",
      "wp_delete_post_revision missing/failure/success routing",
      "wp_revisions_to_keep and retention pruning intent",
      "revisioned meta save/restore/compare intent",
      "put/restore/delete revision hook intent"
    ],
    upstream_reference_functions: [
      "_wp_post_revision_data",
      "wp_save_post_revision",
      "wp_is_post_revision",
      "wp_is_post_autosave",
      "_wp_put_post_revision",
      "wp_restore_post_revision",
      "wp_delete_post_revision",
      "wp_revisions_to_keep",
      "wp_save_revisioned_meta_fields",
      "wp_restore_post_revision_meta",
      "wp_check_revisioned_meta_fields_have_changed"
    ],
    expected_observations: EXPECTED,
    public_abi_policy: {
      public_php_replacement_claimed: false,
      handwritten_php_shells_added: false,
      adapter_contract_owner: "haxe_typed",
      semantic_owner: "haxe",
      native_provider_claimed: false,
      removal_gate:
        "Install through typed Adapter IR/original-path generation and run differential PHP revision/autosave/restore/delete fixtures before claiming public PHP ABI ownership."
    },
    source_escape_audits: haxeSourceAudits
  },
  toolchain: {
    haxe_version: command("haxe", ["--version"]),
    locked_haxe_version: lock.tools.haxe.version,
    php_cli_profile: command("php", ["-r", "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;"])
  },
  build: {
    generated_file_hash_policy: "normalize_haxe_std_source_map_paths",
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
      id: "php-authored-post-revision-oracle-fixture-not-yet-built",
      owner: ISSUE.external_ref,
      detail:
        "The candidate has not yet run against vanilla WordPress and a packaged candidate through public revision/autosave/restore/delete APIs, revisioned meta fields, hooks, database observations, and upstream PHPUnit groups."
    },
    {
      id: "public-php-adapter-not-yet-generated",
      owner: ISSUE.external_ref,
      detail: "No original-path wp-includes/revision.php or wp-includes/post.php adapter is claimed in this slice."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    candidate_kind: "haxe_post_revision_adapter_contract_candidate",
    promoted_contracts: 9,
    runtime_runs: 1,
    observation_count: Object.keys(EXPECTED).length,
    source_escape_audit_passed: sourceEscapeAuditPassed,
    public_php_replacement_claimed: false
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-307-05-post-revision-adapter-contract-candidate",
  issue: { ...ISSUE, title: "Promote post revision intent to Haxe parity candidate" },
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "post revision Haxe semantic/adapter-contract candidate manifest" },
    { path: OWNERSHIP, role: "ADR-004-aware ownership manifest for post revision Haxe candidate" },
    { path: "src/wphx/wp/posts/PostRevisionAdapterContract.hx", role: "typed Haxe post revision semantic and adapter-contract model" },
    { path: RUNNER, role: "candidate generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-307-post-revision-adapter-contract-candidate",
    "npm run wp:core:wphx-307-post-revision-adapter-contract-candidate:check",
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
