#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.20.10",
  external_ref: "WPHX-314.15",
  title: "WPHX-314.15 - Promote selected block PHP decisions to Haxe candidates"
};
const RECORDED_AT = "2026-07-08T00:00:00.000Z";
const RUNNER = "tools/wp-core/run-block-wrapper-support-candidate.mjs";
const HXML = "fixtures/wp-core/block-wrapper-support-candidate.hxml";
const OUT_ROOT = "build/wp-core/wphx-314-15";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const ENTRY = `${HAXE_OUT}/index.php`;
const OUT = "manifests/wp-core/wphx-314-15-block-wrapper-support-candidate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-314-15-block-wrapper-support-candidate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-314-15-block-wrapper-support-candidate.v1.json";
const PRIOR_INPUTS = [
  "manifests/wp-core/wphx-314-01-blocks-interactivity-surface.v1.json",
  "manifests/wp-core/wphx-314-02-blocks-interactivity-adapter-contract-candidate.v1.json",
  "manifests/wp-core/wphx-314-04-block-supports-bindings-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-12-blocks-installed-gate.v1.json",
  "manifests/wp-core/wphx-314-14-blocks-installed-expanded-gate.v1.json"
];
const HAXE_SOURCES = [
  HXML,
  "src/wphx/wp/blocks/BlockWrapperSupportCandidate.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/BlockWrapperSupportCandidateEntry.hx"
];
const PROMOTED_SYMBOLS = [
  "block wrapper support decision shaping",
  "support-derived class token merge order",
  "support-derived style declaration merge order",
  "bounded wrapper attribute serialization order"
];
const EXPECTED = {
  "decision:full": "wrapper_support_full",
  "decision:style": "wrapper_support_style",
  "decision:class": "wrapper_support_class",
  "decision:anchor": "wrapper_support_anchor",
  "decision:none": "wrapper_support_none",
  "class:merged": "wp-block-group alignwide is-style-card is-layout-constrained",
  "class:trim-empty": "wp-block-paragraph is-layout-flow",
  "style:all": "color:var(--wp--preset--color--primary);background-color:#ffffff;margin-top:40px",
  "style:skip-empty": "background-color:#000000",
  "wrapper:full":
    'id="hero" class="wp-block-group alignwide is-layout-constrained" style="color:var(--wp--preset--color--primary);background-color:#ffffff;margin-top:40px" aria-label="Hero"',
  "wrapper:class-only": 'class="wp-block-paragraph lead"',
  "wrapper:none": ""
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
  return sha256(readFileSync(path));
}

function inputRecord(path) {
  return { path, bytes: statSync(path).size, sha256: sha256File(path) };
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
          path: relative(root, child).replaceAll("\\", "/"),
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
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-314-block-wrapper-support-candidate`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/block-wrapper-support-candidate",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "haxe_parity_candidate",
      name: "bounded block wrapper support decision cluster",
      area: "wp-includes/class-wp-block-supports.php get_block_wrapper_attributes support-derived id/class/style/aria-label shaping",
      public_contract:
        "Haxe owns only deterministic wrapper support branch and attribute-shaping decisions after PHP has resolved WordPress support inputs. Public PHP ABI replacement, support registry state, filters, theme.json resolution, and installed rendering are not claimed."
    },
    ownership_state: "haxe_parity_candidate",
    ownership_axes: {
      semantic_owner: "haxe",
      adapter_contract_owner: "haxe_typed",
      emission_strategy: "stock_haxe_php_private_impl",
      execution_provider: "haxe_php",
      compatibility_evidence: "deterministic_oracle_candidate_observation_match"
    },
    bridge: {
      exists: true,
      kind: "private-haxe-candidate-without-public-php-installation",
      removal_gate:
        "Install through WPHX PHP Adapter IR/original-path generation and pass block-supports oracle fixtures, generated-shape checks, upstream PHPUnit groups, and installed block rendering gates before claiming public PHP ABI ownership."
    },
    promoted_symbols: PROMOTED_SYMBOLS,
    owned_paths: HAXE_SOURCES.concat([RUNNER, OUT, OWNERSHIP, RECEIPT]),
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-314-block-wrapper-support-candidate",
        "npm run wp:core:wphx-314-block-wrapper-support-candidate:check",
        "npm run haxe:escape-hatches:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-314-15-block-wrapper-support-candidate"],
      manifest_digest: manifestSha
    },
    notes:
      "This is a typed Haxe candidate for a small decision cluster. It adds no generated original-path WordPress public PHP file and does not replace WP_Block_Supports."
  };
}

rmSync(OUT_ROOT, { recursive: true, force: true });
command("haxe", [HXML]);

const generatedFiles = filesUnder(HAXE_OUT);
const output = command("php", [ENTRY]);
const candidate = parseOutput(output);
const oracle = EXPECTED;
const matchesOracle = JSON.stringify(candidate) === JSON.stringify(oracle);
const haxeSourceAudits = HAXE_SOURCES.filter((path) => path.endsWith(".hx")).map(sourceEscapeAudit);
const sourceEscapeAuditPassed = haxeSourceAudits.every(
  (audit) =>
    !audit.contains_dynamic &&
    !audit.contains_untyped &&
    !audit.contains_cast &&
    !audit.contains_php_syntax_code &&
    !audit.contains_raw_javascript
);

if (!matchesOracle || !sourceEscapeAuditPassed) {
  console.error(JSON.stringify({ status: "failed", matchesOracle, oracle, candidate, haxeSourceAudits }, null, 2));
  process.exit(1);
}

const manifest = {
  schema: "wphx.wp-core-block-wrapper-support-candidate.v1",
  issue: ISSUE.external_ref,
  beads_issue: ISSUE.id,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["targeted_semantic_parity", "generated_shape"],
  artifact_scope: "helper",
  behavior_parity_claimed: true,
  public_php_replacement_claimed: false,
  installed_wordpress_route_execution_claimed: false,
  durable_original_path_adapter_claimed: false,
  promoted_behavior_cluster: {
    id: "block-wrapper-support-decision-shaping",
    source: "src/wphx/wp/blocks/BlockWrapperSupportCandidate.hx",
    promoted_symbols: PROMOTED_SYMBOLS,
    claimed_ownership:
      "Only deterministic wrapper-support branch and attribute-shaping decisions are Haxe-owned in this slice. PHP/WordPress still owns public support APIs, registry/filter/theme.json inputs, escaping policy, and installed rendering."
  },
  inputs: {
    prior_inputs: PRIOR_INPUTS.map(inputRecord),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    haxe_sources: HAXE_SOURCES.map(inputRecord)
  },
  generated: {
    root: HAXE_OUT,
    file_count: generatedFiles.length,
    files: generatedFiles,
    php_lint: generatedPhpLintRecords(generatedFiles)
  },
  observations: {
    oracle,
    candidate,
    matches: matchesOracle
  },
  source_escape_audit: {
    passed: sourceEscapeAuditPassed,
    audits: haxeSourceAudits
  },
  coverage: {
    cases: Object.keys(EXPECTED).length,
    families: ["support-branch", "class-merge", "style-merge", "wrapper-attribute-serialization"],
    related_prior_evidence: ["WPHX-314.02", "WPHX-314.04", "WPHX-314.12", "WPHX-314.14"]
  },
  ownership_manifest: OWNERSHIP,
  non_claims: [
    "No generated public PHP replacement for get_block_wrapper_attributes(), WP_Block_Supports, blocks.php, or any original WordPress public file.",
    "No full WP_Block_Supports ownership, support registry ownership, theme.json/global-styles ownership, filter execution ownership, or installed block rendering parity.",
    "No database-backed post/template/theme behavior, REST controller dispatch, browser/editor/Gutenberg package behavior, generated overlay, or durable original-path adapter ownership.",
    "The generated PHP output is private candidate evidence from typed Haxe source, not a distributable WordPress runtime file."
  ],
  validation_result: {
    status: "passed",
    cases: Object.keys(EXPECTED).length,
    oracle_candidate_match: matchesOracle,
    generated_php_file_count: generatedFiles.filter((record) => record.path.endsWith(".php")).length,
    haxe_escape_audit_passed: sourceEscapeAuditPassed,
    behavior_parity_claimed: true,
    public_php_replacement_claimed: false,
    durable_original_path_adapter_claimed: false
  }
};
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
const manifestSha = sha256(manifestText);
const ownershipText = `${JSON.stringify(ownershipManifest(manifestSha), null, 2)}\n`;
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-314-15-block-wrapper-support-candidate",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  command: "npm run wp:core:wphx-314-block-wrapper-support-candidate",
  evidence_class: "targeted_semantic_parity",
  artifact_scope: "helper",
  behavior_parity_claimed: true,
  public_php_replacement_claimed: false,
  installed_wordpress_route_execution_claimed: false,
  durable_original_path_adapter_claimed: false,
  artifacts: [
    { path: OUT, role: "block wrapper support Haxe candidate manifest", sha256: manifestSha },
    { path: OWNERSHIP, role: "ownership manifest for block wrapper support Haxe candidate" },
    { path: "src/wphx/wp/blocks/BlockWrapperSupportCandidate.hx", role: "typed Haxe block wrapper support decision source" },
    { path: HXML, role: "Haxe compile target for block wrapper support candidate" },
    { path: RUNNER, role: "deterministic block wrapper support candidate runner" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-314-block-wrapper-support-candidate",
    "npm run wp:core:wphx-314-block-wrapper-support-candidate:check",
    "npm run haxe:escape-hatches:check",
    "npm run receipts:validate",
    "npm run beads:validate"
  ],
  validation_result: manifest.validation_result,
  scope_summary:
    "Promotes the bounded block wrapper support branch/class/style/attribute shaping cluster from bridge-only evidence into typed Haxe-owned candidate source with deterministic oracle/candidate observations. The public WordPress PHP support APIs remain unclaimed.",
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
      cases: Object.keys(EXPECTED).length,
      oracle_candidate_match: matchesOracle,
      behavior_parity_claimed: true,
      public_php_replacement_claimed: false
    },
    null,
    2
  )
);
