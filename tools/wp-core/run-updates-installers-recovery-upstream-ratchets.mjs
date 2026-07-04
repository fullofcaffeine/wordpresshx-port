#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-8kbk",
  external_ref: "WPHX-319.04",
  title: "WPHX-319.04 - Add updates installers recovery upstream PHPUnit ratchets"
};
const RECORDED_AT = "2026-07-04T20:00:00.000Z";
const RUNNER = "tools/wp-core/run-updates-installers-recovery-upstream-ratchets.mjs";
const GROUPS = "tests/upstream/phpunit/groups.json";
const GLOBAL_RATCHET = "manifests/operations/wphx-700-05-upstream-phpunit-ratchet.v1.json";
const GLOBAL_PROVISION = "manifests/operations/wphx-700-09-phpunit-ratchet-env.v1.json";
const GLOBAL_RATCHET_RECEIPT = "receipts/operations/wphx-700-05-upstream-phpunit-ratchet.v1.json";
const GLOBAL_PROVISION_RECEIPT = "receipts/operations/wphx-700-09-phpunit-ratchet-env.v1.json";
const RATCHET_DOC = "docs/operations/upstream-phpunit-ratchet.md";
const SURFACE = "manifests/wp-core/wphx-319-01-updates-installers-recovery-surface.v1.json";
const CONTRACT = "manifests/wp-core/wphx-319-02-updates-installers-recovery-adapter-contract-candidate.v1.json";
const ORACLE_FIXTURE = "manifests/wp-core/wphx-319-03-updates-installers-recovery-oracle-fixture.v1.json";
const OUT = "manifests/wp-core/wphx-319-04-updates-installers-recovery-upstream-ratchets.v1.json";
const RECEIPT = "receipts/wp-core/wphx-319-04-updates-installers-recovery-upstream-ratchets.v1.json";
const SELECTED_GROUPS = ["updates-upgrader-core", "updates-ajax-plugin-theme", "recovery-mode-services"];

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
  const failures = selected.filter((group) => group.classification.classification !== "parity_pass");
  if (failures.length > 0) {
    throw new Error(`WPHX-319 ratchet groups are not all parity_pass: ${failures.map((group) => group.id).join(", ")}`);
  }
  if (globalProvision.validation_result.unowned_candidate_regression_count !== 0) {
    throw new Error("The provisioned upstream ratchet records unowned candidate regressions");
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
    selected_behavior_parity_claimed: true,
    candidate_generated_overlay_claimed: false,
    installed_update_route_execution_claimed: false,
    selected_group_count: selected.length,
    selected_test_file_count: selectedFileCount,
    selected_groups: selected,
    selected_classification_summary: {
      all_selected_parity_pass: true,
      parity_pass_groups: selected.map((group) => group.id),
      baseline_failure_groups: []
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
      copied_oracle_fixture_manifest: inputRecord(ORACLE_FIXTURE)
    },
    cross_domain_handoffs: [
      {
        owner: "WPHX-306",
        reason: "Update and recovery tests exercise real capabilities, nonces, users, cookies, salts, sessions, and current-user state that remain users/auth ownership."
      },
      {
        owner: "WPHX-312",
        reason: "Automatic updates, Site Health checks, recovery notifications, cron, HTTP, and mail behavior remain HTTP/cron/mail ownership when reached by updater tests."
      },
      {
        owner: "WPHX-313",
        reason: "Filesystem credentials, package unzip/copy/delete, upload paths, and filesystem transport behavior remain media/filesystem/upload ownership."
      },
      {
        owner: "WPHX-315/WPHX-316",
        reason: "Admin UI, Ajax dispatch, notices, list tables, and plugin/theme admin route behavior remain admin common and admin feature/AJAX ownership."
      },
      {
        owner: "WPHX-310/WPHX-317/WPHX-323",
        reason: "Theme updater behavior, multisite/network update state, and preserved vendor/library boundaries are not closed by selected WPHX-319 upstream ratchets."
      }
    ],
    non_claims: [
      "No generated public PHP replacement for update, upgrader, installer, Site Health, admin Ajax, or recovery-mode files.",
      "No Haxe-owned update/installer/upgrader/recovery runtime implementation or installed update behavior.",
      "No live package download, unzip/copy/delete, filesystem transport, remote HTTP, cron, mail, database-backed installed state, browser/e2e behavior, generated overlay, or generated original-path adapter ownership.",
      "No complete upstream updates/installers/recovery suite parity; this records three selected WPHX-319 groups only.",
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
    summary: `Declares and provisions three selected WPHX-319 upstream PHPUnit ratchet groups covering ${selectedFileCount} updater, update-Ajax, and recovery-mode service test files. All selected WPHX-319 groups classify vanilla pass / candidate pass, while global behavior parity remains false because unrelated WPHX-314 baseline failures persist.`,
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
        wphx_319_classifications: selected.map((group) => ({
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
