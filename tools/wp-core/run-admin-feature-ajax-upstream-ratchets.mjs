#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-wixe",
  external_ref: "WPHX-316.07",
  title: "WPHX-316.07 - Add admin feature AJAX upstream PHPUnit ratchets"
};
const RECORDED_AT = "2026-07-04T06:00:00.000Z";
const RUNNER = "tools/wp-core/run-admin-feature-ajax-upstream-ratchets.mjs";
const GROUPS = "tests/upstream/phpunit/groups.json";
const GLOBAL_RATCHET = "manifests/operations/wphx-700-05-upstream-phpunit-ratchet.v1.json";
const GLOBAL_PROVISION = "manifests/operations/wphx-700-09-phpunit-ratchet-env.v1.json";
const GLOBAL_RATCHET_RECEIPT = "receipts/operations/wphx-700-05-upstream-phpunit-ratchet.v1.json";
const GLOBAL_PROVISION_RECEIPT = "receipts/operations/wphx-700-09-phpunit-ratchet-env.v1.json";
const RATCHET_DOC = "docs/operations/upstream-phpunit-ratchet.md";
const SURFACE = "manifests/wp-core/wphx-316-01-admin-feature-ajax-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-316-02-admin-feature-ajax-adapter-contract-candidate.v1.json";
const AJAX_FIXTURE = "manifests/wp-core/wphx-316-03-admin-ajax-post-oracle-fixture.v1.json";
const PRIVACY_FIXTURE = "manifests/wp-core/wphx-316-06-privacy-export-erase-oracle-fixture.v1.json";
const OUT = "manifests/wp-core/wphx-316-07-admin-feature-ajax-upstream-ratchets.v1.json";
const RECEIPT = "receipts/wp-core/wphx-316-07-admin-feature-ajax-upstream-ratchets.v1.json";
const SELECTED_GROUPS = ["admin-ajax-feature-core", "admin-feature-plugin-dependencies", "admin-privacy-ajax-feature"];

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

function main() {
  const groups = readJson(GROUPS);
  const globalRatchet = readJson(GLOBAL_RATCHET);
  const globalProvision = readJson(GLOBAL_PROVISION);
  const groupById = new Map(groups.groups.map((group) => [group.id, group]));
  const classificationByGroup = new Map(globalRatchet.execution_summary.classifications.map((entry) => [entry.group, entry]));
  const selected = SELECTED_GROUPS.map((id) => {
    const group = groupById.get(id);
    const classification = classificationByGroup.get(id);
    if (!group) throw new Error(`Missing selected group ${id}`);
    if (!classification) throw new Error(`Missing classification for ${id}`);
    return {
      id,
      owner: group.owner,
      filter: group.filter ?? null,
      files: group.files,
      file_count: group.files.length,
      classification
    };
  });
  const failures = selected.filter((group) => group.classification.classification !== "parity_pass");
  if (failures.length > 0) {
    throw new Error(`WPHX-316 ratchet groups are not all parity_pass: ${failures.map((group) => group.id).join(", ")}`);
  }

  const selectedFileCount = selected.reduce((count, group) => count + group.file_count, 0);
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
    selected_group_count: selected.length,
    selected_test_file_count: selectedFileCount,
    selected_groups: selected,
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
      ajax_fixture_manifest: inputRecord(AJAX_FIXTURE),
      privacy_fixture_manifest: inputRecord(PRIVACY_FIXTURE)
    },
    cross_domain_handoffs: [
      {
        owner: "WPHX-306",
        reason: "Upstream AJAX/admin tests exercise real capabilities, users, roles, nonces, cookies, and current-user state that remain WPHX-306 ownership."
      },
      {
        owner: "WPHX-312",
        reason: "Privacy export/erase request internals, privacy mail, and export/erase processing remain WPHX-312 ownership even when reached through admin AJAX tests."
      },
      {
        owner: "WPHX-315",
        reason: "Admin bootstrap/common/list-table primitives and plugin list-table helpers remain WPHX-315 ownership."
      },
      {
        owner: "WPHX-317/WPHX-319/WPHX-313",
        reason: "Network state, update/upgrader flows, and media upload/editor AJAX remain neighboring domains and are not closed by this selected WPHX-316 ratchet."
      }
    ],
    non_claims: [
      "No generated public PHP replacement for admin route, AJAX, plugin, or privacy files.",
      "No Haxe-owned admin feature/AJAX route implementation or installed admin behavior.",
      "No complete upstream admin suite parity; this records three selected WPHX-316 groups only.",
      "No browser/e2e behavior, database-backed installed admin state, generated overlay, or generated original-path adapter ownership.",
      "The candidate assembly remains the pinned WordPress 7.0 worktree without generated/Haxe overlays, so pass/pass is ratchet evidence, not Haxe runtime ownership."
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
    summary:
      "Declares and provisions three selected WPHX-316 upstream PHPUnit ratchet groups covering 24 admin feature/AJAX test files. All selected WPHX-316 groups classify vanilla pass / candidate pass, while global behavior parity remains false because unrelated WPHX-314 baseline failures persist.",
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
        global_ratchet_runs_executed: globalRatchet.validation_result.runs_executed,
        wphx_316_classifications: selected.map((group) => ({
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
