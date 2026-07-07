#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.20.9",
  external_ref: "WPHX-314.13",
  title: "WPHX-314.13 - Unblock blocks/interactivity upstream PHPUnit ratchet"
};
const RECORDED_AT = "2026-07-07T23:00:00.000Z";
const RUNNER = "tools/wp-core/run-blocks-interactivity-upstream-phpunit-executable.mjs";
const GROUPS = "tests/upstream/phpunit/groups.json";
const GLOBAL_RATCHET = "manifests/operations/wphx-700-05-upstream-phpunit-ratchet.v1.json";
const GLOBAL_PROVISION = "manifests/operations/wphx-700-09-phpunit-ratchet-env.v1.json";
const GLOBAL_RATCHET_RECEIPT = "receipts/operations/wphx-700-05-upstream-phpunit-ratchet.v1.json";
const GLOBAL_PROVISION_RECEIPT = "receipts/operations/wphx-700-09-phpunit-ratchet-env.v1.json";
const RATCHET_REPORT = "build/upstream-phpunit/wphx-700-05/reports/upstream-phpunit-ratchet.json";
const PRIOR_RATCHET_RECEIPT = "receipts/wp-core/wphx-314-11-blocks-interactivity-upstream-phpunit-ratchet-groups.v1.json";
const OUT = "manifests/wp-core/wphx-314-13-blocks-interactivity-upstream-phpunit-executable.v1.json";
const RECEIPT = "receipts/wp-core/wphx-314-13-blocks-interactivity-upstream-phpunit-executable.v1.json";
const SELECTED_GROUPS = [
  "blocks-parser-render-core",
  "blocks-supports-bindings-core",
  "blocks-hooks-patterns-core",
  "style-engine-core",
  "html-api-core",
  "interactivity-api-core"
];
const ACCEPTED_BASELINE_FAILURES = new Set([
  "blocks-supports-bindings-core",
  "style-engine-core",
  "interactivity-api-core"
]);

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const groups = readJson(GROUPS);
  const globalRatchet = readJson(GLOBAL_RATCHET);
  const globalProvision = readJson(GLOBAL_PROVISION);
  const report = readJson(RATCHET_REPORT);

  assert(globalRatchet.validation_result.status === "passed", "Global PHPUnit ratchet check is not passed.");
  assert(globalRatchet.validation_result.environment_ready === true, "Global PHPUnit ratchet environment is not ready.");
  assert(globalProvision.validation_result.status === "passed", "Provisioned PHPUnit environment check is not passed.");
  assert(globalProvision.validation_result.environment_ready === true, "Provisioned PHPUnit environment is not ready.");
  assert(
    globalProvision.validation_result.unowned_candidate_regression_count === 0,
    "Provisioned PHPUnit ratchet has unowned candidate regressions."
  );
  assert(report.execution.status === "passed", "Runtime PHPUnit ratchet report is not passed.");

  const groupById = new Map(groups.groups.map((group) => [group.id, group]));
  const classificationByGroup = new Map(
    globalRatchet.execution_summary.classifications.map((entry) => [entry.group, entry])
  );
  const reportClassificationByGroup = new Map(report.execution.classifications.map((entry) => [entry.group, entry]));
  const runsByGroup = new Map();
  for (const run of report.execution.runs) {
    const runs = runsByGroup.get(run.group) ?? {};
    runs[run.side] = {
      status: run.status,
      exit_code: run.exit_code,
      junit: run.junit,
      stdout: run.stdout,
      stderr: run.stderr
    };
    runsByGroup.set(run.group, runs);
  }

  const selected = SELECTED_GROUPS.map((id) => {
    const group = groupById.get(id);
    const classification = classificationByGroup.get(id);
    const reportClassification = reportClassificationByGroup.get(id);
    const runs = runsByGroup.get(id);
    assert(group, `Missing selected group ${id}`);
    assert(classification, `Missing global classification for ${id}`);
    assert(reportClassification, `Missing report classification for ${id}`);
    assert(JSON.stringify(classification) === JSON.stringify(reportClassification), `Report classification drift for ${id}`);
    assert(runs?.vanilla && runs?.candidate, `Missing vanilla/candidate runtime runs for ${id}`);

    const cls = classification.classification;
    const passPass = cls === "parity_pass" && classification.vanilla_status === "pass" && classification.candidate_status === "pass";
    const acceptedBaselineFailure =
      cls === "environment_or_upstream_baseline_failure" &&
      classification.vanilla_status === "fail" &&
      classification.candidate_status === "fail" &&
      ACCEPTED_BASELINE_FAILURES.has(id);
    assert(passPass || acceptedBaselineFailure, `Unexpected WPHX-314 classification for ${id}: ${cls}`);

    return {
      id,
      owner: group.owner,
      filter: group.filter ?? null,
      files: group.files,
      file_count: group.files.length,
      classification,
      runtime_runs: runs
    };
  });

  const passPassGroups = selected.filter((group) => group.classification.classification === "parity_pass");
  const baselineFailureGroups = selected.filter(
    (group) => group.classification.classification === "environment_or_upstream_baseline_failure"
  );
  const selectedFileCount = selected.reduce((count, group) => count + group.file_count, 0);

  const nonClaims = [
    "This records executable upstream PHPUnit classifications for the selected WPHX-314 groups; it does not claim complete upstream block PHPUnit pass/pass parity.",
    "The three baseline-failure groups are accepted only because vanilla and candidate both fail and the ratchet reports zero unowned candidate regressions.",
    "No generated public PHP replacement, generated original-path adapter ownership, or Haxe-owned blocks/interactivity runtime logic is claimed.",
    "No installed WordPress route execution, database-backed block rendering, theme/template/global-styles integration, browser/editor execution, or Gutenberg package ownership is claimed.",
    "The candidate assembly remains the pinned WordPress 7.0 worktree without generated/Haxe overlays, so pass/pass groups are ratchet evidence rather than Haxe runtime ownership."
  ];

  const manifest = {
    schema_version: 1,
    issue: ISSUE.external_ref,
    beads_issue: ISSUE.id,
    title: ISSUE.title,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "selected_upstream_phpunit_executable_ratchet",
    artifact_scope: "packaged_distribution",
    behavior_parity_claimed: false,
    complete_upstream_block_suite_parity_claimed: false,
    selected_group_count: selected.length,
    selected_test_file_count: selectedFileCount,
    selected_groups: selected,
    validation_result: {
      status: "passed",
      environment_ready: true,
      ratchet_runs_executed: globalRatchet.validation_result.runs_executed,
      selected_wphx_314_run_count: selected.length * 2,
      selected_wphx_314_group_count: selected.length,
      selected_wphx_314_test_file_count: selectedFileCount,
      pass_pass_groups: passPassGroups.map((group) => group.id),
      accepted_baseline_failure_groups: baselineFailureGroups.map((group) => group.id),
      unowned_candidate_regression_count: globalProvision.validation_result.unowned_candidate_regression_count,
      rejects_new_vanilla_pass_candidate_fail: globalRatchet.validation_result.rejects_new_vanilla_pass_candidate_fail,
      behavior_parity_claimed: false,
      complete_upstream_block_suite_parity_claimed: false
    },
    inputs: {
      runner: inputRecord(RUNNER),
      phpunit_groups: inputRecord(GROUPS),
      global_ratchet_manifest: inputRecord(GLOBAL_RATCHET),
      global_provision_manifest: inputRecord(GLOBAL_PROVISION),
      global_ratchet_receipt: inputRecord(GLOBAL_RATCHET_RECEIPT),
      global_provision_receipt: inputRecord(GLOBAL_PROVISION_RECEIPT),
      runtime_ratchet_report: inputRecord(RATCHET_REPORT),
      prior_wphx_314_ratchet_scope_receipt: inputRecord(PRIOR_RATCHET_RECEIPT)
    },
    remaining_gates: [
      "Resolve or own the upstream-baseline failures in blocks-supports-bindings-core, style-engine-core, and interactivity-api-core before claiming complete selected WPHX-314 pass/pass parity.",
      "Add generated Haxe/WPHX PHP candidates or generated original-path adapters before claiming WPHX-owned blocks/interactivity runtime behavior.",
      "Expand installed, database-backed, REST/admin-adjacent, browser/editor, theme/template/global-styles, and Gutenberg package evidence before broad block rendering parity claims."
    ],
    non_claims: nonClaims
  };

  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-314-13-blocks-interactivity-upstream-phpunit-executable",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref,
      title: ISSUE.title
    },
    recorded_at: RECORDED_AT,
    command: `node ${RUNNER}`,
    evidence_class: manifest.evidence_class,
    artifact_scope: manifest.artifact_scope,
    behavior_parity_claimed: false,
    complete_upstream_block_suite_parity_claimed: false,
    artifacts: [
      {
        path: OUT,
        role: "WPHX-314 executable selected upstream PHPUnit ratchet manifest",
        sha256: `sha256:${createHash("sha256").update(JSON.stringify(manifest, null, 2) + "\n").digest("hex")}`
      },
      {
        path: GLOBAL_RATCHET,
        role: "global upstream PHPUnit ratchet manifest with WPHX-314 executable classifications",
        sha256: sha256File(GLOBAL_RATCHET)
      },
      {
        path: GLOBAL_PROVISION,
        role: "provisioned upstream PHPUnit runtime environment manifest",
        sha256: sha256File(GLOBAL_PROVISION)
      },
      {
        path: RATCHET_REPORT,
        role: "runtime upstream PHPUnit report with vanilla/candidate JUnit and logs",
        sha256: sha256File(RATCHET_REPORT)
      },
      {
        path: PRIOR_RATCHET_RECEIPT,
        role: "prior WPHX-314.11 selected ratchet group declaration receipt",
        sha256: sha256File(PRIOR_RATCHET_RECEIPT)
      },
      {
        path: "docs/operations/progress-matrix.md",
        role: "bounded WPHX-314.13 progress interpretation"
      }
    ],
    verification_commands: [
      "npm run upstream:phpunit-ratchet:provision:check",
      "npm run upstream:phpunit-ratchet:check",
      `node ${RUNNER}`,
      `node ${RUNNER} --check`,
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    validation_result: manifest.validation_result,
    summary:
      "Records executable upstream PHPUnit ratchet evidence for the six selected WPHX-314 block/style/HTML/interactivity groups. Three groups classify vanilla pass / candidate pass; three classify vanilla fail / candidate fail as accepted upstream-baseline failures with zero unowned candidate regressions.",
    remaining_gates: manifest.remaining_gates,
    non_claims: nonClaims
  };

  writeJson(OUT, manifest);
  writeJson(RECEIPT, receipt);
  console.log(
    JSON.stringify(
      {
        status: "passed",
        selected_group_count: selected.length,
        selected_test_file_count: selectedFileCount,
        pass_pass_groups: passPassGroups.map((group) => group.id),
        accepted_baseline_failure_groups: baselineFailureGroups.map((group) => group.id),
        unowned_candidate_regression_count: globalProvision.validation_result.unowned_candidate_regression_count
      },
      null,
      2
    )
  );
}

main();
