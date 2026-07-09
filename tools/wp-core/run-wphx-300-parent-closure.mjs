#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76",
  external_ref: "WPHX-300",
  title: "WPHX-300 — WordPress PHP core"
};
const RECORDED_AT = "2026-07-09T07:45:00.000Z";
const RUNNER = "tools/wp-core/run-wphx-300-parent-closure.mjs";
const RECEIPT = "receipts/wp-core/wphx-300-parent-closure.v1.json";
const PROGRESS_MATRIX = "docs/operations/progress-matrix.md";
const BEADS_EXPORT = ".beads/issues.jsonl";

const EXPECTED_DIRECT_CHILD_REFS = [
  "WPHX-301",
  "WPHX-302",
  "WPHX-303",
  "WPHX-304",
  "WPHX-305",
  "WPHX-306",
  "WPHX-307",
  "WPHX-308",
  "WPHX-309",
  "WPHX-310",
  "WPHX-311",
  "WPHX-312",
  "WPHX-312.101",
  "WPHX-313",
  "WPHX-314",
  "WPHX-315",
  "WPHX-316",
  "WPHX-317",
  "WPHX-318",
  "WPHX-319",
  "WPHX-320",
  "WPHX-322",
  "WPHX-323",
  "WPHX-323.01",
  "WPHX-323.02",
  "WPHX-323.03",
  "WPHX-323.04",
  "WPHX-323.05",
  "WPHX-323.06",
  "WPHX-323.07",
  "WPHX-323.14",
  "WPHX-323.15",
  "WPHX-323.16",
  "WPHX-323.17"
];

const EVIDENCE_RECEIPTS = [
  { ref: "WPHX-301", path: "receipts/wp-bootstrap/wphx-301-bootstrap-traces.v1.json", role: "bootstrap/load-order trace scaffold" },
  { ref: "WPHX-302", path: "receipts/wp-hooks/wphx-302-hook-surface.v1.json", role: "hooks/plugin API workset surface" },
  { ref: "WPHX-303", path: "receipts/wp-core/wphx-303-domain-closure.v1.json", role: "error/deprecation/formatting/escaping/KSES bounded domain closure" },
  { ref: "WPHX-304", path: "receipts/wp-core/wphx-304-domain-closure.v1.json", role: "options/transients/object-cache bounded domain closure" },
  { ref: "WPHX-305", path: "receipts/wp-core/wphx-305-domain-closure.v1.json", role: "wpdb/database bounded domain closure" },
  { ref: "WPHX-306", path: "receipts/wp-core/wphx-306-domain-closure.v1.json", role: "users/auth/capabilities bounded domain closure" },
  { ref: "WPHX-307", path: "receipts/wp-core/wphx-307-domain-closure.v1.json", role: "posts/metadata/revisions/WP_Query bounded domain closure" },
  { ref: "WPHX-308", path: "receipts/wp-core/wphx-308-domain-closure.v1.json", role: "taxonomy/terms/comments bounded domain closure" },
  { ref: "WPHX-309", path: "receipts/wp-core/wphx-309-domain-closure.v1.json", role: "rewrite/routing/canonical/template bounded domain closure" },
  { ref: "WPHX-310", path: "receipts/wp-core/wphx-310-domain-closure.v1.json", role: "themes/theme-json/template hierarchy bounded domain closure" },
  { ref: "WPHX-311", path: "receipts/wp-core/wphx-311-domain-closure.v1.json", role: "REST API/schema bounded domain closure" },
  { ref: "WPHX-312", path: "receipts/wp-core/wphx-312-parent-closure.v1.json", role: "HTTP/cron/mail/feed/embed bounded parent closure" },
  { ref: "WPHX-312.101", path: "receipts/wp-core/wphx-312-101-generated-adapter-coverage.v1.json", role: "copied HTTP/feed/embed public-surface generated-adapter follow-up coverage" },
  { ref: "WPHX-313", path: "receipts/wp-core/wphx-313-parent-closure.v1.json", role: "media/filesystem/uploads bounded parent closure" },
  { ref: "WPHX-314", path: "receipts/wp-core/wphx-314-parent-closure.v1.json", role: "blocks/interactivity PHP bounded parent closure" },
  { ref: "WPHX-315", path: "receipts/wp-core/wphx-315-parent-closure.v1.json", role: "admin common/list-table bounded parent closure" },
  { ref: "WPHX-316", path: "receipts/wp-core/wphx-316-parent-closure.v1.json", role: "admin feature/AJAX bounded parent closure" },
  { ref: "WPHX-317", path: "receipts/wp-core/wphx-317-domain-closure.v1.json", role: "multisite/network bounded domain closure" },
  { ref: "WPHX-318", path: "receipts/wp-core/wphx-318-parent-closure.v1.json", role: "XML-RPC/legacy/deprecated bounded parent closure" },
  { ref: "WPHX-319", path: "receipts/wp-core/wphx-319-parent-closure.v1.json", role: "updates/installers/upgrader/recovery bounded parent closure" },
  { ref: "WPHX-320", path: "receipts/wp-core/wphx-320-parent-closure.v1.json", role: "default theme PHP bounded parent closure" },
  { ref: "WPHX-322", path: "receipts/wp-core/wphx-322-php-first-party-manifest-closure.v1.json", role: "first-party PHP manifest split/closure" },
  { ref: "WPHX-323", path: "receipts/wp-core/wphx-323-php-vendor-manifest-closure.v1.json", role: "PHP vendor manifest preserved-boundary closure" },
  { ref: "WPHX-323.01", path: "receipts/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json", role: "preserved PHP vendor replacement strategy split" },
  { ref: "WPHX-323.02", path: "receipts/wp-core/wphx-323-02-http-vendor-replacement-gates.v1.json", role: "HTTP vendor replacement gate plan" },
  { ref: "WPHX-323.03", path: "receipts/wp-core/wphx-323-03-mail-vendor-replacement-gates.v1.json", role: "mail vendor replacement gate plan" },
  { ref: "WPHX-323.04", path: "receipts/wp-core/wphx-323-04-feed-vendor-replacement-gates.v1.json", role: "feed vendor replacement gate plan" },
  { ref: "WPHX-323.05", path: "receipts/wp-core/wphx-323-05-media-security-archive-vendor-replacement-gates.v1.json", role: "media/security/archive vendor replacement gate plan" },
  { ref: "WPHX-323.06", path: "receipts/wp-core/wphx-323-06-localization-legacy-vendor-replacement-gates.v1.json", role: "localization/legacy vendor replacement gate plan" },
  { ref: "WPHX-323.07", path: "receipts/wp-core/wphx-323-07-ai-client-tinymce-vendor-gates.v1.json", role: "AI client and TinyMCE loader vendor gate plan" },
  { ref: "WPHX-323.14", path: "receipts/wp-core/wphx-323-14-simplepie-api-reflection-corpus-fixture.v1.json", role: "SimplePie API/reflection/feed corpus floor" },
  { ref: "WPHX-323.15", path: "receipts/wp-core/wphx-323-15-simplepie-wrapper-cache-transport-gate.v1.json", role: "SimplePie wrapper/cache/transport floor" },
  { ref: "WPHX-323.16", path: "receipts/wp-core/wphx-323-16-magpie-rss-legacy-exception-gate.v1.json", role: "MagpieRSS renewed preserved exception" },
  { ref: "WPHX-323.17", path: "receipts/wp-core/wphx-323-17-feed-vendor-provenance-decision-gate.v1.json", role: "feed vendor provenance/replacement decision" }
];

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 80
  }).trim();
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function inputRecord(path, role = null) {
  const record = { path, bytes: statSync(path).size, sha256: sha256File(path) };
  if (role) record.role = role;
  return record;
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run without --check to generate it`);
    if (readFileSync(path, "utf8") !== content) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-300-parent-closure`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function parentIssue() {
  const parsed = JSON.parse(command("bd", ["show", ISSUE.id, "--json"]));
  if (!Array.isArray(parsed) || parsed.length !== 1) throw new Error("bd show WPHX-300 did not return one issue");
  return parsed[0];
}

function validateParent(parent) {
  const failures = [];
  const children = (parent.dependents ?? [])
    .filter((child) => child.dependency_type === "parent-child")
    .map((child) => ({
      id: child.id,
      external_ref: child.external_ref,
      title: child.title,
      status: child.status,
      close_reason: child.close_reason ?? null
    }))
    .sort((a, b) => a.external_ref.localeCompare(b.external_ref, undefined, { numeric: true }));
  const refs = children.map((child) => child.external_ref).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const expected = [...EXPECTED_DIRECT_CHILD_REFS].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const missing = expected.filter((ref) => !refs.includes(ref));
  const extra = refs.filter((ref) => !expected.includes(ref));
  const openChildren = children.filter((child) => child.status !== "closed");
  if (parent.external_ref !== ISSUE.external_ref) failures.push(`unexpected parent ref ${parent.external_ref}`);
  if (!["in_progress", "closed"].includes(parent.status)) failures.push(`unexpected parent status ${parent.status}`);
  if (children.length !== EXPECTED_DIRECT_CHILD_REFS.length) failures.push(`expected ${EXPECTED_DIRECT_CHILD_REFS.length} direct children, found ${children.length}`);
  if (missing.length > 0) failures.push(`missing direct children: ${missing.join(", ")}`);
  if (extra.length > 0) failures.push(`unexpected direct children: ${extra.join(", ")}`);
  if (openChildren.length > 0) failures.push(`open direct children: ${openChildren.map((child) => child.external_ref).join(", ")}`);
  for (const receipt of EVIDENCE_RECEIPTS) {
    if (!existsSync(receipt.path)) failures.push(`missing evidence receipt ${receipt.path}`);
  }
  if (failures.length > 0) {
    throw new Error(`WPHX-300 parent closure validation failed:\n- ${failures.join("\n- ")}`);
  }
  return { children, refs };
}

function main() {
  const parent = parentIssue();
  const { children } = validateParent(parent);
  const evidenceArtifacts = EVIDENCE_RECEIPTS.map((receipt) => ({
    ref: receipt.ref,
    ...inputRecord(receipt.path, receipt.role)
  }));
  const remainingGaps = [
    "WPHX-300 closes the bounded PHP-core evidence workset, not complete Haxe ownership of all WordPress PHP runtime logic.",
    "Generated public PHP replacement for all first-party WordPress original paths remains incomplete and requires WPHX PHP generated-overlay/original-path adapter evidence before stronger claims.",
    "Many domain closures intentionally preserve copied-oracle fixtures, bridge routers, adapter-contract candidates, selected upstream ratchets, or blocked installed/e2e gate declarations rather than installed distribution parity.",
    "Full installed WordPress behavior across database-backed state, browser/admin/editor flows, plugin/theme ecosystem compatibility, filesystem/network/mail side effects, and production-like runtimes remains WPHX-700 or later distribution work.",
    "Preserved PHP vendor and bundled-library boundaries remain governed by WPHX-323 replacement/provenance decisions; copied artifact retirement is not claimed by this parent closure.",
    "Browser/Gutenberg package ownership, editor UI behavior, visual/performance parity, and asset pipeline ownership remain WPHX-400/WPHX-500/WPHX-700 work.",
    "This receipt does not change the super-progress score; it reconciles Beads parent status with already-recorded child receipts and non-claims."
  ];
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-300-parent-closure",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    generator: RUNNER,
    command: "parent closure after all WPHX-300 direct child worksets closed",
    evidence_class: "top_level_parent_closure",
    artifact_scope: "wordpress_php_core_bounded_evidence_workset",
    behavior_parity_claimed: false,
    generated_public_php_replacement_claimed: false,
    installed_wordpress_parity_claimed: false,
    complete_haxe_runtime_ownership_claimed: false,
    artifacts: [
      ...evidenceArtifacts,
      {
        path: PROGRESS_MATRIX,
        role: "program matrix marking WPHX-300 bounded parent closure"
      },
      {
        path: BEADS_EXPORT,
        role: "tracked Beads export with WPHX-300 parent closure"
      }
    ],
    direct_children: children,
    verification_commands: [
      "npm run wp:core:wphx-300-parent-closure:check",
      "npm run receipts:validate",
      "npm run beads:validate",
      "npm run operations:bridge-claim-guardrails:check"
    ],
    validation_result: {
      status: "passed",
      parent_status_policy: "validated while WPHX-300 is in_progress or closed; direct child closure and evidence receipts are the stable invariants",
      allowed_parent_statuses: ["in_progress", "closed"],
      direct_child_count: children.length,
      closed_direct_child_count: children.filter((child) => child.status === "closed").length,
      expected_direct_child_refs: EXPECTED_DIRECT_CHILD_REFS,
      evidence_receipt_count: EVIDENCE_RECEIPTS.length,
      bounded_parent_closeable: true,
      remaining_gaps_preserved: remainingGaps
    },
    non_claims: remainingGaps
  };
  const receiptText = `${JSON.stringify(receipt, null, 2)}\n`;
  writeOrCheck(RECEIPT, receiptText);
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
        direct_child_count: receipt.validation_result.direct_child_count,
        evidence_receipt_count: receipt.validation_result.evidence_receipt_count,
        behavior_parity_claimed: receipt.behavior_parity_claimed
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
