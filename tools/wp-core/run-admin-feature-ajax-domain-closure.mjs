#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.22.2",
  external_ref: "WPHX-316.10",
  title: "WPHX-316.10 - Close bounded admin feature AJAX evidence slice"
};
const PARENT = {
  id: "wordpresshx-l76.22",
  external_ref: "WPHX-316",
  title: "WPHX-316 - Admin feature screens and AJAX"
};
const RECORDED_AT = "2026-07-04T09:00:00.000Z";
const RUNNER = "tools/wp-core/run-admin-feature-ajax-domain-closure.mjs";
const DOMAIN_RECEIPT = "receipts/wp-core/wphx-316-domain-closure.v1.json";
const PARENT_RECEIPT = "receipts/wp-core/wphx-316-parent-closure.v1.json";
const PROGRESS_MATRIX = "docs/operations/progress-matrix.md";
const BEADS_EXPORT = ".beads/issues.jsonl";

const CHILD_RECEIPTS = [
  {
    ref: "WPHX-316.01",
    path: "receipts/wp-core/wphx-316-01-admin-feature-ajax-surface.v1.json",
    role: "admin feature/AJAX source, distribution, ABI, upstream test, handoff, and fixture surface inventory"
  },
  {
    ref: "WPHX-316.02",
    path: "receipts/wp-core/wphx-316-02-admin-feature-ajax-adapter-contract-candidate.v1.json",
    role: "typed Haxe admin feature/AJAX adapter-contract evidence"
  },
  {
    ref: "WPHX-316.03",
    path: "receipts/wp-core/wphx-316-03-admin-ajax-post-oracle-fixture.v1.json",
    role: "copied-oracle admin-ajax/admin-post route and selected AJAX handler observations"
  },
  {
    ref: "WPHX-316.04",
    path: "receipts/wp-core/wphx-316-04-settings-options-oracle-fixture.v1.json",
    role: "copied-oracle settings/options route observations"
  },
  {
    ref: "WPHX-316.05",
    path: "receipts/wp-core/wphx-316-05-taxonomy-feature-screen-oracle-fixture.v1.json",
    role: "copied-oracle taxonomy feature-screen route observations"
  },
  {
    ref: "WPHX-316.06",
    path: "receipts/wp-core/wphx-316-06-privacy-export-erase-oracle-fixture.v1.json",
    role: "copied-oracle privacy export/erase route and helper observations"
  },
  {
    ref: "WPHX-316.07",
    path: "receipts/wp-core/wphx-316-07-admin-feature-ajax-upstream-ratchets.v1.json",
    role: "selected upstream PHPUnit ratchet scope and pass/pass classifications for admin AJAX, plugin-dependency, and privacy AJAX tests"
  },
  {
    ref: "WPHX-316.08",
    path: "receipts/wp-core/wphx-316-08-admin-feature-ajax-installed-e2e-gates.v1.json",
    role: "selected installed/browser e2e gate declarations with blockers and future runner requirements"
  },
  {
    ref: "WPHX-316.09",
    path: "receipts/wp-core/wphx-316-09-plugin-management-oracle-fixture.v1.json",
    role: "copied-oracle plugin-management route observations"
  }
];

const REQUIRED_CHILD_GATES = CHILD_RECEIPTS.map((child) => child.ref).concat(["WPHX-316.10"]);

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
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    if (readFileSync(path, "utf8") !== content) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-316-domain-closure`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

for (const child of CHILD_RECEIPTS) {
  if (!existsSync(child.path)) throw new Error(`Missing child receipt ${child.path}`);
}

const artifacts = CHILD_RECEIPTS.map((child) => ({
  ...inputRecord(child.path, child.role),
  ref: child.ref
}));
artifacts.push({
  path: PROGRESS_MATRIX,
  role: "bounded WPHX-316 closure interpretation"
});

const remainingGaps = [
  "Generated public PHP replacement for admin feature/AJAX original paths is not claimed; copied public PHP fixtures remain bridge evidence where noted.",
  "Haxe-owned runtime implementations for admin-ajax.php, admin-post.php, settings/options screens, taxonomy feature screens, privacy export/erase screens, plugins.php, network-admin wrappers, media/profile/plugin flows, and feature-specific admin screens are not claimed.",
  "Real WordPress bootstrap, installed wp-admin route execution, database-backed admin state, plugin filesystem/update/delete behavior, media upload state, privacy request persistence, and Settings API persistence remain later work.",
  "Real user/session/capability/nonce/cookie behavior remains owned by WPHX-306 and is not proven by deterministic stubs in WPHX-316 fixtures.",
  "Network-admin and multisite state remain WPHX-317 handoffs; WPHX-316 only inventories and declares route intent where relevant.",
  "Selected WPHX-316 upstream PHPUnit groups classify vanilla pass / candidate pass, but complete upstream admin suite parity is not claimed.",
  "Selected installed/browser e2e flows remain blocked until real installed oracle/candidate roots, generated-overlay discipline, database/user/session/nonce state, and Playwright/browser execution exist.",
  "Typed HXX/HHX admin feature-template ownership remains limited to the WPHX-315 pilot; WPHX-316 does not add HXX-owned feature-screen templates.",
  "Generated overlays, generated original-path adapters, durable public PHP ownership, and broad installed admin parity require future WPHX PHP adapter evidence or real installed admin/browser gates.",
  "This closes the bounded WPHX-316 admin feature/AJAX evidence slice, not all WordPress admin behavior or complete ecosystem parity."
];

const domainReceipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-316-domain-closure",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  command: "domain closure audit over WPHX-316.01 through WPHX-316.09 receipts",
  evidence_class: "domain_closure",
  artifact_scope: "mixed: source_inventory, adapter_contract, oracle_source_mirror, upstream_suite_parity, installed_e2e_gate_declaration",
  behavior_parity_claimed: false,
  artifacts,
  verification_commands: [
    "npm run wp:core:wphx-316-admin-feature-ajax-surface:check",
    "npm run wp:core:wphx-316-admin-feature-ajax-adapter-contract-candidate:check",
    "npm run wp:core:wphx-316-admin-ajax-post-oracle-fixture:check",
    "npm run wp:core:wphx-316-settings-options-oracle-fixture:check",
    "npm run wp:core:wphx-316-taxonomy-feature-screen-oracle-fixture:check",
    "npm run wp:core:wphx-316-privacy-export-erase-oracle-fixture:check",
    "npm run wp:core:wphx-316-admin-feature-ajax-upstream-ratchets:check",
    "npm run wp:core:wphx-316-admin-feature-ajax-installed-e2e-gates:check",
    "npm run wp:core:wphx-316-plugin-management-oracle-fixture:check",
    "npm run receipts:validate",
    "npm run beads:validate"
  ],
  validation_result: {
    status: "passed",
    surface_inventory: true,
    haxe_adapter_contracts: ["AdminFeatureAjaxAdapterContract"],
    fixtures_cover: [
      "admin feature/AJAX source, distribution, ABI, related tests, route categories, and cross-domain handoffs",
      "typed adapter-contract intent for admin-ajax/admin-post routing, feature guards, response families, settings/options, content/taxonomy/comment actions, privacy export/erase, and network-admin route intent",
      "copied-oracle/candidate admin-ajax.php, admin-post.php, and selected ajax-actions.php route observations",
      "copied-oracle/candidate options.php settings/options route observations",
      "copied-oracle/candidate edit-tags.php taxonomy feature-screen route observations",
      "copied-oracle/candidate export-personal-data.php, erase-personal-data.php, and includes/privacy-tools.php privacy route/helper observations",
      "selected upstream admin feature/AJAX PHPUnit groups with vanilla pass / candidate pass classifications",
      "selected installed/browser admin feature and AJAX e2e gates declared as blocked with future runner requirements",
      "copied-oracle/candidate plugins.php plugin-management route observations"
    ],
    remaining_gaps: remainingGaps,
    follow_up_guidance: [
      "Prefer generated original-path adapters or a real installed admin/browser runner before making stronger WPHX-316 feature-screen parity claims.",
      "Any future candidate divergence in copied package/route fixtures requires a non-empty generated overlay manifest and zero unexpected candidate differences.",
      "Network-admin wrapper execution can be added as a narrow follow-up only if it contributes evidence beyond the current WPHX-317 handoff and WPHX-316 plugin-management route fixture."
    ]
  }
};

const domainText = JSON.stringify(domainReceipt, null, 2) + "\n";
const parentReceipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-316-parent-closure",
  issue: PARENT,
  recorded_at: RECORDED_AT,
  command: "parent closure after WPHX-316.10 bounded domain-closure receipt",
  evidence_class: "parent_domain_closure",
  artifact_scope: "wp_core_admin_feature_screens_ajax",
  behavior_parity_claimed: false,
  artifacts: [
    {
      path: DOMAIN_RECEIPT,
      role: "bounded WPHX-316 domain-closure receipt",
      sha256: sha256(domainText)
    },
    {
      path: PROGRESS_MATRIX,
      role: "program matrix marking WPHX-316 bounded closed"
    },
    {
      path: BEADS_EXPORT,
      role: "tracked Beads export with WPHX-316 parent closure"
    }
  ],
  verification_commands: ["npm run receipts:validate", "npm run beads:validate"],
  validation_result: {
    status: "passed",
    domain_closure_receipt: "receipt:wphx-316-domain-closure",
    bounded_parent_closed: true,
    required_child_gates_closed: REQUIRED_CHILD_GATES,
    remaining_gaps_preserved: remainingGaps,
    non_blocking_follow_up:
      "Future WPHX-316 movement should require generated original-path adapters, explicit generated overlay manifests, real installed admin/browser execution, or network-admin wrapper evidence that adds value beyond WPHX-317 handoff coverage."
  }
};
const parentText = JSON.stringify(parentReceipt, null, 2) + "\n";

try {
  writeOrCheck(DOMAIN_RECEIPT, domainText);
  writeOrCheck(PARENT_RECEIPT, parentText);
} catch (error) {
  console.error(JSON.stringify({ status: "failed", error: error.message }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      output: DOMAIN_RECEIPT,
      parent_receipt: PARENT_RECEIPT,
      audited_child_receipt_count: CHILD_RECEIPTS.length,
      behavior_parity_claimed: false
    },
    null,
    2
  )
);
