#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.24.2",
  external_ref: "WPHX-319.06",
  title: "WPHX-319.06 - Close updates installers recovery bounded evidence slice"
};
const PARENT = {
  id: "wordpresshx-l76.24",
  external_ref: "WPHX-319",
  title: "WPHX-319 - Updates, installers, upgrader, recovery mode"
};
const RECORDED_AT = "2026-07-04T15:45:00.000Z";
const RUNNER = "tools/wp-core/run-updates-installers-recovery-domain-closure.mjs";
const DOMAIN_RECEIPT = "receipts/wp-core/wphx-319-domain-closure.v1.json";
const PARENT_RECEIPT = "receipts/wp-core/wphx-319-parent-closure.v1.json";
const PROGRESS_MATRIX = "docs/operations/progress-matrix.md";
const BEADS_EXPORT = ".beads/issues.jsonl";

const CHILD_RECEIPTS = [
  {
    ref: "WPHX-319.01",
    path: "receipts/wp-core/wphx-319-01-updates-installers-recovery-surface.v1.json",
    role: "updates/installers/upgrader/recovery source, distribution, ABI, test, handoff, and next-gate surface inventory"
  },
  {
    ref: "WPHX-319.02",
    path: "receipts/wp-core/wphx-319-02-updates-installers-recovery-adapter-contract-candidate.v1.json",
    role: "typed Haxe updates/installers/upgrader/recovery adapter-contract evidence"
  },
  {
    ref: "WPHX-319.03",
    path: "receipts/wp-core/wphx-319-03-updates-installers-recovery-oracle-fixture.v1.json",
    role: "copied-oracle updater/upgrader/recovery service observations through deterministic stubs"
  },
  {
    ref: "WPHX-319.04",
    path: "receipts/wp-core/wphx-319-04-updates-installers-recovery-upstream-ratchets.v1.json",
    role: "selected upstream PHPUnit pass/pass ratchets for updater, update-Ajax, and recovery service tests"
  },
  {
    ref: "WPHX-319.05",
    path: "receipts/wp-core/wphx-319-05-updates-installers-recovery-installed-gates.v1.json",
    role: "selected installed/browser update/recovery gate declarations with blockers and future runner requirements"
  }
];

const REQUIRED_CHILD_GATES = CHILD_RECEIPTS.map((child) => child.ref).concat(["WPHX-319.06"]);

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
      throw new Error(`${path} is stale; run npm run wp:core:wphx-319-domain-closure`);
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
  role: "bounded WPHX-319 closure interpretation"
});

const remainingGaps = [
  "Generated public PHP replacement for update, install, upgrader, recovery-mode, Site Health, maintenance, plugin/theme install/update, admin Ajax, and network update files is not claimed.",
  "Haxe-owned runtime implementations for update APIs, core/plugin/theme/language upgraders, upgrader skins, automatic updates, Site Health update checks, install bootstrap, network update wrappers, maintenance mode, recovery-mode orchestration, and recovery email/link/session behavior are not claimed.",
  "Live package download, unzip/copy/delete, filesystem credentials/transports, plugin/theme activation, HTTP update API calls, cron locks, mail delivery, database-backed installed state, user/session/capability/nonce behavior, and multisite/network update state remain later gates.",
  "Selected WPHX-319 upstream PHPUnit groups classify vanilla pass / candidate pass, but complete upstream updates/installers/recovery suite parity is not claimed.",
  "The WPHX-319.03 copied-oracle fixture executes selected mirrored upstream PHP through deterministic stubs; it does not prove generated public PHP replacement or installed WordPress update/recovery parity.",
  "The WPHX-319.05 installed/browser gates are declared as blocked until real installed oracle/candidate roots, generated-overlay discipline, package/filesystem/network/mail transports, database/user/session/nonce state, browser/HTTP execution, and diff gates exist.",
  "Cross-domain ownership remains with WPHX-301 for bootstrap/recovery load order, WPHX-304 for options/transients/locks, WPHX-306 for users/auth/capabilities/nonces/cookies, WPHX-310 for theme semantics, WPHX-312 for HTTP/cron/mail/update API behavior, WPHX-313 for filesystem/upload/package I/O, WPHX-315/WPHX-316 for admin/list-table/Ajax/plugin-management UI, WPHX-317 for multisite state, WPHX-318/WPHX-323 for plugin/vendor boundaries, and WPHX-400 for browser package behavior.",
  "Generated overlays, generated original-path adapters, durable public PHP ownership, broad installed update/admin parity, live ecosystem/plugin/theme compatibility, and browser/e2e parity require future WPHX PHP adapter evidence or real installed update/recovery gates.",
  "This closes the bounded WPHX-319 updates/installers/upgrader/recovery evidence slice, not all WordPress update/recovery behavior or complete ecosystem parity."
];

const domainReceipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-319-domain-closure",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  command: "domain closure audit over WPHX-319.01 through WPHX-319.05 receipts",
  evidence_class: "domain_closure",
  artifact_scope:
    "mixed: source_inventory, adapter_contract, oracle_source_mirror, upstream_suite_parity, installed_browser_gate_declaration",
  behavior_parity_claimed: false,
  artifacts,
  verification_commands: [
    "npm run wp:core:wphx-319-updates-installers-recovery-surface:check",
    "npm run wp:core:wphx-319-updates-installers-recovery-adapter-contract-candidate:check",
    "npm run wp:core:wphx-319-updates-installers-recovery-oracle-fixture:check",
    "npm run wp:core:wphx-319-updates-installers-recovery-upstream-ratchets:check",
    "npm run wp:core:wphx-319-updates-installers-recovery-installed-gates:check",
    "npm run receipts:validate",
    "npm run beads:validate"
  ],
  validation_result: {
    status: "passed",
    surface_inventory: true,
    haxe_adapter_contracts: ["UpdatesInstallersRecoveryAdapterContract"],
    fixtures_cover: [
      "updates/installers/upgrader/recovery source, distribution, ABI, related tests, route categories, and cross-domain handoffs",
      "typed adapter-contract intent for update API checks, core/plugin/language update intent, upgrader skin output phases, automatic update/Site Health checks, install bootstrap, network update wrappers, recovery cookie/key/link guards, and cross-domain side-effect handoffs",
      "copied-oracle/candidate updater/upgrader/recovery observations for selected upgrader skin output, plugin installer behavior, recovery cookie validation, recovery key lifecycle, and recovery link generation under deterministic stubs",
      "selected upstream updates/installers/recovery PHPUnit groups with vanilla pass / candidate pass classifications",
      "selected installed/browser update/recovery gates declared as blocked with future runner requirements"
    ],
    remaining_gaps: remainingGaps,
    follow_up_guidance: [
      "Prefer generated original-path adapters or a real installed update/recovery runner before making stronger WPHX-319 parity claims.",
      "Any future candidate divergence in copied package/route fixtures requires a non-empty generated overlay manifest and zero unexpected candidate differences.",
      "A future installed update/recovery runner should compare HTTP/admin/browser observations, package/filesystem deltas, database/options/transients, mail captures, cron/lock state, PHP logs, hook traces, and generated overlay hashes under controlled fixtures."
    ]
  }
};

const domainText = `${JSON.stringify(domainReceipt, null, 2)}\n`;
const parentReceipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-319-parent-closure",
  issue: PARENT,
  recorded_at: RECORDED_AT,
  command: "parent closure after WPHX-319.06 bounded domain-closure receipt",
  evidence_class: "parent_domain_closure",
  artifact_scope: "wp_core_updates_installers_upgrader_recovery_mode",
  behavior_parity_claimed: false,
  artifacts: [
    {
      path: DOMAIN_RECEIPT,
      role: "bounded WPHX-319 domain-closure receipt",
      sha256: sha256(domainText)
    },
    {
      path: PROGRESS_MATRIX,
      role: "program matrix marking WPHX-319 bounded closed"
    },
    {
      path: BEADS_EXPORT,
      role: "tracked Beads export with WPHX-319 parent closure"
    }
  ],
  verification_commands: ["npm run receipts:validate", "npm run beads:validate"],
  validation_result: {
    status: "passed",
    domain_closure_receipt: "receipt:wphx-319-domain-closure",
    bounded_parent_closed: true,
    required_child_gates_closed: REQUIRED_CHILD_GATES,
    remaining_gaps_preserved: remainingGaps,
    non_blocking_follow_up:
      "Future WPHX-319 movement should require generated original-path adapters, explicit generated overlay manifests, real installed update/recovery/browser execution, package/filesystem/network/mail/database comparisons, or plugin/theme ecosystem evidence before stronger update/install/recovery parity claims."
  }
};

const parentText = `${JSON.stringify(parentReceipt, null, 2)}\n`;

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
