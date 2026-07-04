#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-zt0d",
  external_ref: "WPHX-318.04",
  title: "WPHX-318.04 - Add XML-RPC legacy upstream PHPUnit ratchets"
};
const RECORDED_AT = "2026-07-04T12:00:00.000Z";
const RUNNER = "tools/wp-core/run-xmlrpc-legacy-upstream-ratchets.mjs";
const GROUPS = "tests/upstream/phpunit/groups.json";
const GLOBAL_RATCHET = "manifests/operations/wphx-700-05-upstream-phpunit-ratchet.v1.json";
const GLOBAL_PROVISION = "manifests/operations/wphx-700-09-phpunit-ratchet-env.v1.json";
const GLOBAL_RATCHET_RECEIPT = "receipts/operations/wphx-700-05-upstream-phpunit-ratchet.v1.json";
const GLOBAL_PROVISION_RECEIPT = "receipts/operations/wphx-700-09-phpunit-ratchet-env.v1.json";
const RATCHET_DOC = "docs/operations/upstream-phpunit-ratchet.md";
const SURFACE = "manifests/wp-core/wphx-318-01-xmlrpc-legacy-deprecated-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-318-02-xmlrpc-legacy-adapter-contract-candidate.v1.json";
const ENDPOINT_FIXTURE = "manifests/wp-core/wphx-318-03-xmlrpc-endpoint-server-oracle-fixture.v1.json";
const OUT = "manifests/wp-core/wphx-318-04-xmlrpc-legacy-upstream-ratchets.v1.json";
const RECEIPT = "receipts/wp-core/wphx-318-04-xmlrpc-legacy-upstream-ratchets.v1.json";
const SELECTED_GROUPS = [
  "xmlrpc-endpoint-demo-core",
  "xmlrpc-method-family-core",
  "xmlrpc-legacy-deprecated-core"
];
const ACCEPTED_CLASSIFICATIONS = new Set(["parity_pass", "environment_or_upstream_baseline_failure"]);

function sha256File(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function inputRecord(path) {
  return { path, bytes: statSync(path).size, sha256: sha256File(path) };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run ${RUNNER}`);
    const current = readFileSync(path, "utf8");
    if (current !== body) throw new Error(`${path} is stale; run ${RUNNER}`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

function classifySelectedGroups(groups, globalRatchet) {
  const groupById = new Map(groups.groups.map((group) => [group.id, group]));
  const classificationByGroup = new Map(
    globalRatchet.execution_summary.classifications.map((entry) => [entry.group, entry])
  );
  return SELECTED_GROUPS.map((id) => {
    const group = groupById.get(id);
    const classification = classificationByGroup.get(id);
    if (!group) throw new Error(`Missing selected group ${id}`);
    if (!classification) throw new Error(`Missing classification for ${id}; run npm run upstream:phpunit-ratchet:provision`);
    return {
      id,
      owner: group.owner,
      filter: group.filter ?? null,
      files: group.files,
      file_count: group.files.length,
      classification
    };
  });
}

function main() {
  const groups = readJson(GROUPS);
  const globalRatchet = readJson(GLOBAL_RATCHET);
  const globalProvision = readJson(GLOBAL_PROVISION);
  const selected = classifySelectedGroups(groups, globalRatchet);
  const unsupported = selected.filter((group) => !ACCEPTED_CLASSIFICATIONS.has(group.classification.classification));
  if (unsupported.length > 0) {
    throw new Error(`WPHX-318 ratchet groups have unsupported classifications: ${unsupported.map((group) => group.id).join(", ")}`);
  }
  if (globalProvision.validation_result.unowned_candidate_regression_count !== 0) {
    throw new Error("The provisioned upstream ratchet records unowned candidate regressions");
  }

  const selectedFileCount = selected.reduce((count, group) => count + group.file_count, 0);
  const selectedParityPass = selected.filter((group) => group.classification.classification === "parity_pass");
  const selectedBaselineFailures = selected.filter(
    (group) => group.classification.classification === "environment_or_upstream_baseline_failure"
  );
  const allSelectedParityPass = selectedParityPass.length === selected.length;
  const manifest = {
    schema_version: 1,
    issue: ISSUE.external_ref,
    beads_issue: ISSUE.id,
    title: ISSUE.title,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "selected_upstream_phpunit_ratchet_scope",
    artifact_scope: "packaged_distribution",
    behavior_parity_claimed: false,
    selected_behavior_parity_claimed: allSelectedParityPass,
    candidate_generated_overlay_claimed: false,
    installed_xmlrpc_route_execution_claimed: false,
    selected_group_count: selected.length,
    selected_test_file_count: selectedFileCount,
    selected_groups: selected,
    selected_classification_summary: {
      all_selected_parity_pass: allSelectedParityPass,
      parity_pass_groups: selectedParityPass.map((group) => group.id),
      baseline_failure_groups: selectedBaselineFailures.map((group) => group.id),
      accepted_classifications: Array.from(ACCEPTED_CLASSIFICATIONS)
    },
    global_ratchet_summary: {
      status: globalRatchet.validation_result.status,
      runs_executed: globalRatchet.validation_result.runs_executed,
      classifications_recorded: globalRatchet.validation_result.classifications_recorded,
      behavior_parity_claimed: globalRatchet.behavior_parity_claimed,
      provision_status: globalProvision.validation_result.status,
      baseline_failure_count: globalProvision.validation_result.baseline_failure_count,
      baseline_failure_groups: globalProvision.validation_result.baseline_failure_groups,
      unowned_candidate_regression_count: globalProvision.validation_result.unowned_candidate_regression_count
    },
    inputs: {
      runner: inputRecord(RUNNER),
      phpunit_groups: inputRecord(GROUPS),
      global_ratchet_manifest: inputRecord(GLOBAL_RATCHET),
      global_provision_manifest: inputRecord(GLOBAL_PROVISION),
      global_ratchet_receipt: inputRecord(GLOBAL_RATCHET_RECEIPT),
      global_provision_receipt: inputRecord(GLOBAL_PROVISION_RECEIPT),
      ratchet_documentation: inputRecord(RATCHET_DOC),
      surface_manifest: inputRecord(SURFACE),
      adapter_contract_manifest: inputRecord(CONTRACT),
      endpoint_server_fixture_manifest: inputRecord(ENDPOINT_FIXTURE)
    },
    cross_domain_handoffs: [
      {
        owner: "WPHX-303",
        reason: "Deprecated helper notices, wp_die shaping, and error signaling remain WPHX-303-owned even when XML-RPC tests exercise them."
      },
      {
        owner: "WPHX-306",
        reason: "XML-RPC authentication, current-user, user lookup, password, role, and capability behavior remain users/auth ownership."
      },
      {
        owner: "WPHX-307/WPHX-308",
        reason: "XML-RPC post, page, taxonomy, term, and comment method-family tests exercise posts/query and taxonomy/comment behavior outside WPHX-318 ownership."
      },
      {
        owner: "WPHX-312/WPHX-313",
        reason: "Pingback/HTTP handoff and media upload behavior remain neighboring HTTP/feed and media/filesystem ownership."
      },
      {
        owner: "WPHX-317/WPHX-323",
        reason: "Multisite blog state and preserved IXR/vendor-library policy are not closed by selected WPHX-318 upstream ratchets."
      }
    ],
    non_claims: [
      "No generated public PHP replacement for xmlrpc.php, wp-includes/class-wp-xmlrpc-server.php, wp-includes/class-IXR.php, wp-includes/deprecated.php, bundled plugin files, or preserved IXR library files.",
      "No Haxe-owned XML-RPC runtime logic, IXR serialization/parser implementation, or deprecated API runtime implementation.",
      "No installed XML-RPC HTTP route execution, database-backed candidate state, browser/e2e behavior, generated overlay, or generated original-path adapter ownership.",
      "No complete upstream XML-RPC/deprecated suite parity; this records three selected WPHX-318 groups only.",
      "The candidate assembly remains the pinned WordPress 7.0 worktree without generated/Haxe overlays, so pass/pass is upstream ratchet evidence rather than WPHX runtime ownership."
    ]
  };

  const receipt = {
    schema_version: 1,
    issue: ISSUE.external_ref,
    beads_issue: ISSUE.id,
    title: ISSUE.title,
    generated_at: RECORDED_AT,
    status: "passed",
    generator: RUNNER,
    evidence: {
      manifest: OUT,
      phpunit_groups: GROUPS,
      global_ratchet_manifest: GLOBAL_RATCHET,
      global_provision_manifest: GLOBAL_PROVISION,
      global_ratchet_receipt: GLOBAL_RATCHET_RECEIPT,
      global_provision_receipt: GLOBAL_PROVISION_RECEIPT,
      ratchet_documentation: RATCHET_DOC
    },
    summary: `Declares and provisions three selected WPHX-318 upstream PHPUnit ratchet groups covering ${selectedFileCount} XML-RPC, method-family, legacy, and deprecated helper test files. ${allSelectedParityPass ? "All selected WPHX-318 groups classify vanilla pass / candidate pass." : `Selected WPHX-318 groups include baseline failures for ${selectedBaselineFailures.map((group) => group.id).join(", ")} without candidate-only regressions.`} Global behavior parity remains false while unrelated baseline failures persist.`,
    checks: [
      "npm run upstream:phpunit-ratchet:provision",
      "npm run upstream:phpunit-ratchet:provision:check",
      `node ${RUNNER}`,
      `node ${RUNNER} --check`,
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    non_claims: manifest.non_claims
  };

  writeJson(OUT, manifest);
  writeJson(RECEIPT, receipt);
  console.log(
    JSON.stringify(
      {
        status: "passed",
        selected_group_count: selected.length,
        selected_test_file_count: selectedFileCount,
        all_selected_parity_pass: allSelectedParityPass,
        global_ratchet_runs_executed: globalRatchet.validation_result.runs_executed,
        wphx_318_classifications: selected.map((group) => ({
          group: group.id,
          classification: group.classification.classification
        }))
      },
      null,
      2
    )
  );
}

main();
