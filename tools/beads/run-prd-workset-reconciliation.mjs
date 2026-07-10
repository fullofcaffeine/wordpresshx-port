#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const checkOnly = new Set(process.argv.slice(2)).has("--check");

const ISSUE = {
  id: "wordpresshx-w91.25",
  external_ref: "WPHX-000.07",
  title: "WPHX-000.07 — Reconcile remaining PRD browser and release worksets into Beads"
};
const RECORDED_AT = "2026-07-10T03:30:49.000Z";
const RUNNER = "tools/beads/run-prd-workset-reconciliation.mjs";
const RECEIPT = "receipts/operations/wphx-000-07-prd-workset-reconciliation.v1.json";
const SEED_MANIFEST = "manifests/beads/prd-seed.v1.json";
const BEADS_EXPORT = ".beads/issues.jsonl";
const PRD = "docs/prd/wordpress-haxe-port.md";
const PROGRESS_MATRIX = "docs/operations/progress-matrix.md";

const EXPECTED_GROUPS = {
  browser_platform: Array.from({ length: 9 }, (_, index) => `WPHX-${401 + index}`),
  gutenberg_packages: ["WPHX-500", ...Array.from({ length: 12 }, (_, index) => `WPHX-${501 + index}`)],
  classic_browser: ["WPHX-600", ...Array.from({ length: 9 }, (_, index) => `WPHX-${601 + index}`)],
  validation_release: Array.from({ length: 14 }, (_, index) => `WPHX-${701 + index}`)
};
const SUPPLEMENTAL_WPHX_700_REFS = Array.from({ length: 10 }, (_, index) => `WPHX-700.${String(index + 1).padStart(2, "0")}`);

function sha256File(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function inputRecord(path, role) {
  return { path, role, bytes: statSync(path).size, sha256: sha256File(path) };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readIssues() {
  return readFileSync(BEADS_EXPORT, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeOrCheck(content) {
  if (checkOnly) {
    if (!existsSync(RECEIPT)) throw new Error(`${RECEIPT} is missing; run without --check`);
    if (readFileSync(RECEIPT, "utf8") !== content) throw new Error(`${RECEIPT} is stale; run without --check`);
    return;
  }
  mkdirSync(dirname(RECEIPT), { recursive: true });
  writeFileSync(RECEIPT, content);
}

function main() {
  const manifest = readJson(SEED_MANIFEST);
  const issues = readIssues();
  const byRef = new Map(issues.map((issue) => [issue.external_ref, issue]));
  const byId = new Map(issues.map((issue) => [issue.id, issue]));
  const seeds = new Map(manifest.issues.map((seed) => [seed.external_ref, seed]));
  const expectedRefs = Object.values(EXPECTED_GROUPS).flat();
  const failures = [];
  const records = [];

  for (const ref of expectedRefs) {
    const seed = seeds.get(ref);
    const issue = byRef.get(ref);
    if (!seed) {
      failures.push(`${ref} is missing from ${SEED_MANIFEST}`);
      continue;
    }
    if (!issue) {
      failures.push(`${ref} is missing from ${BEADS_EXPORT}`);
      continue;
    }
    const parentDependency = (issue.dependencies ?? []).find((dependency) => dependency.type === "parent-child");
    const parentRef = parentDependency ? byId.get(parentDependency.depends_on_id)?.external_ref ?? null : null;
    const blockerRefs = (issue.dependencies ?? [])
      .filter((dependency) => dependency.type === "blocks")
      .map((dependency) => byId.get(dependency.depends_on_id)?.external_ref)
      .filter(Boolean)
      .sort();
    const expectedBlockers = [...(seed.blocks ?? [])].sort();
    if ((seed.parent ?? null) !== parentRef) failures.push(`${ref} parent mismatch: expected ${seed.parent}, found ${parentRef}`);
    for (const blocker of expectedBlockers) {
      if (!blockerRefs.includes(blocker)) failures.push(`${ref} is missing blocker ${blocker}`);
    }
    records.push({
      external_ref: ref,
      id: issue.id,
      issue_type: issue.issue_type,
      status: issue.status,
      parent: parentRef,
      blockers: blockerRefs
    });
  }

  for (const ref of SUPPLEMENTAL_WPHX_700_REFS) {
    if (!byRef.has(ref)) failures.push(`supplemental early gate ${ref} is missing`);
  }
  const reconciliation = byRef.get(ISSUE.external_ref);
  if (!reconciliation) failures.push(`${ISSUE.external_ref} is missing from the export`);
  if (reconciliation && !["in_progress", "closed"].includes(reconciliation.status)) {
    failures.push(`${ISSUE.external_ref} has unexpected status ${reconciliation.status}`);
  }
  if (manifest.issues.length !== 94) failures.push(`expected 94 deterministic seeds, found ${manifest.issues.length}`);
  if (failures.length > 0) throw new Error(`PRD workset reconciliation failed:\n- ${failures.join("\n- ")}`);

  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-000-07-prd-workset-reconciliation",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    generator: RUNNER,
    command: "reconcile PRD browser, package, vendor, and validation/release worksets into Beads",
    evidence_class: "program_task_graph_reconciliation",
    artifact_scope: "beads_prd_seed_and_dependency_graph",
    artifacts: [
      inputRecord(SEED_MANIFEST, "deterministic WPHX external-reference seed manifest"),
      inputRecord(PRD, "product and architecture authority defining the seeded worksets"),
      { path: BEADS_EXPORT, role: "tracked authoritative Beads interchange export" },
      { path: PROGRESS_MATRIX, role: "program matrix recording activation of the browser and release worksets" }
    ],
    groups: Object.fromEntries(
      Object.entries(EXPECTED_GROUPS).map(([name, refs]) => [name, { count: refs.length, refs }])
    ),
    seeded_records: records,
    supplemental_early_wphx_700_refs: SUPPLEMENTAL_WPHX_700_REFS,
    verification_commands: [
      "npm run beads:seed",
      "npm run beads:validate",
      "npm run beads:prd-worksets:check",
      "npm run receipts:validate"
    ],
    validation_result: {
      status: "passed",
      deterministic_seed_count: manifest.issues.length,
      reconciled_workset_count: expectedRefs.length,
      browser_platform_task_count: EXPECTED_GROUPS.browser_platform.length,
      gutenberg_epic_and_task_count: EXPECTED_GROUPS.gutenberg_packages.length,
      classic_browser_epic_and_task_count: EXPECTED_GROUPS.classic_browser.length,
      validation_release_task_count: EXPECTED_GROUPS.validation_release.length,
      supplemental_early_wphx_700_task_count: SUPPLEMENTAL_WPHX_700_REFS.length,
      parent_closure_claimed: false,
      implementation_parity_claimed: false
    },
    non_claims: [
      "Seeding a PRD workset does not implement or close it.",
      "WPHX-400, WPHX-500, WPHX-600, WPHX-700, and WPHX-000 remain open until their technical acceptance gates pass.",
      "The existing WPHX-700.01 through WPHX-700.10 tasks remain bounded early evidence and do not replace WPHX-701 through WPHX-714.",
      "The super-progress score remains unchanged because this receipt repairs task authority rather than adding Haxe ownership or installed parity."
    ]
  };
  const content = `${JSON.stringify(receipt, null, 2)}\n`;
  writeOrCheck(content);
  return receipt;
}

try {
  const receipt = main();
  console.log(
    JSON.stringify(
      {
        status: "passed",
        check: checkOnly,
        output: RECEIPT,
        deterministic_seed_count: receipt.validation_result.deterministic_seed_count,
        reconciled_workset_count: receipt.validation_result.reconciled_workset_count
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
