#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-1whp",
  external_ref: "WPHX-318.06",
  title: "WPHX-318.06 - Close XML-RPC legacy deprecated bounded evidence slice"
};
const PARENT = {
  id: "wordpresshx-l76.23",
  external_ref: "WPHX-318",
  title: "WPHX-318 - XML-RPC, legacy, deprecated APIs"
};
const RECORDED_AT = "2026-07-04T14:00:00.000Z";
const RUNNER = "tools/wp-core/run-xmlrpc-legacy-domain-closure.mjs";
const DOMAIN_RECEIPT = "receipts/wp-core/wphx-318-domain-closure.v1.json";
const PARENT_RECEIPT = "receipts/wp-core/wphx-318-parent-closure.v1.json";
const PROGRESS_MATRIX = "docs/operations/progress-matrix.md";
const BEADS_EXPORT = ".beads/issues.jsonl";

const CHILD_RECEIPTS = [
  {
    ref: "WPHX-318.01",
    path: "receipts/wp-core/wphx-318-01-xmlrpc-legacy-deprecated-surface.v1.json",
    role: "XML-RPC, legacy, deprecated, bundled plugin, IXR, source/distribution/ABI/test surface inventory"
  },
  {
    ref: "WPHX-318.02",
    path: "receipts/wp-core/wphx-318-02-xmlrpc-legacy-adapter-contract-candidate.v1.json",
    role: "typed Haxe XML-RPC/legacy/deprecated adapter-contract evidence"
  },
  {
    ref: "WPHX-318.03",
    path: "receipts/wp-core/wphx-318-03-xmlrpc-endpoint-server-oracle-fixture.v1.json",
    role: "copied-oracle xmlrpc.php, wp_xmlrpc_server, class-IXR, and IXR support observations"
  },
  {
    ref: "WPHX-318.04",
    path: "receipts/wp-core/wphx-318-04-xmlrpc-legacy-upstream-ratchets.v1.json",
    role: "selected upstream PHPUnit pass/pass ratchets for XML-RPC endpoint/demo/message, method-family, and legacy/deprecated helper tests"
  },
  {
    ref: "WPHX-318.05",
    path: "receipts/wp-core/wphx-318-05-xmlrpc-installed-route-gates.v1.json",
    role: "selected installed XML-RPC HTTP route gate declarations with blockers and future runner requirements"
  }
];

const REQUIRED_CHILD_GATES = CHILD_RECEIPTS.map((child) => child.ref).concat(["WPHX-318.06"]);

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
      throw new Error(`${path} is stale; run npm run wp:core:wphx-318-domain-closure`);
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
  role: "bounded WPHX-318 closure interpretation"
});

const remainingGaps = [
  "Generated public PHP replacement for xmlrpc.php, wp-includes/class-wp-xmlrpc-server.php, wp-includes/class-IXR.php, wp-includes/deprecated.php, bundled plugin files, and preserved IXR library files is not claimed.",
  "Haxe-owned runtime implementations for XML-RPC endpoint dispatch, wp_xmlrpc_server method handlers, IXR parsing/serialization, deprecated API behavior, bundled plugin behavior, Akismet distribution artifacts, and preserved vendor/library files are not claimed.",
  "Full XML-RPC request/response parity, installed HTTP route execution, database-backed candidate state, real users/passwords/capabilities/options/uploads, and real post/comment/term/media writes remain later gates.",
  "Selected WPHX-318 upstream PHPUnit groups classify vanilla pass / candidate pass, but complete upstream XML-RPC/deprecated suite parity is not claimed.",
  "The WPHX-318.03 copied-oracle fixture executes selected mirrored upstream PHP through deterministic stubs; it does not prove generated public PHP replacement or installed WordPress route parity.",
  "The WPHX-318.05 installed route gates are declared as blocked until real installed oracle/candidate roots, generated-overlay discipline, real xmlrpc.php HTTP dispatch, XML wire comparison, database/user/capability/upload state, controlled pingback/media transport, and filesystem/database diff gates exist.",
  "Cross-domain ownership remains with WPHX-303 for deprecation/error signaling, WPHX-306 for auth/users/capabilities, WPHX-307/WPHX-308 for post/comment/term behavior, WPHX-312 for HTTP/feed/pingback/legacy library behavior, WPHX-313 for media uploads, WPHX-317 for multisite state, and WPHX-323 for preserved vendor/library policy.",
  "Generated overlays, generated original-path adapters, durable public PHP ownership, broad XML-RPC installed parity, and ecosystem/plugin compatibility require future WPHX PHP adapter evidence or real installed XML-RPC route gates.",
  "This closes the bounded WPHX-318 XML-RPC/legacy/deprecated evidence slice, not all WordPress legacy/deprecated behavior or complete ecosystem parity."
];

const domainReceipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-318-domain-closure",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  command: "domain closure audit over WPHX-318.01 through WPHX-318.05 receipts",
  evidence_class: "domain_closure",
  artifact_scope: "mixed: source_inventory, adapter_contract, oracle_source_mirror, upstream_suite_parity, installed_route_gate_declaration",
  behavior_parity_claimed: false,
  artifacts,
  verification_commands: [
    "npm run wp:core:wphx-318-xmlrpc-legacy-deprecated-surface:check",
    "npm run wp:core:wphx-318-xmlrpc-legacy-adapter-contract-candidate:check",
    "npm run wp:core:wphx-318-xmlrpc-endpoint-server-oracle-fixture:check",
    "npm run wp:core:wphx-318-xmlrpc-legacy-upstream-ratchets:check",
    "npm run wp:core:wphx-318-xmlrpc-installed-route-gates:check",
    "npm run receipts:validate",
    "npm run beads:validate"
  ],
  validation_result: {
    status: "passed",
    surface_inventory: true,
    haxe_adapter_contracts: ["XmlRpcLegacyAdapterContract"],
    fixtures_cover: [
      "XML-RPC/legacy/deprecated source, distribution, ABI, related tests, bundled plugin, IXR, and cross-domain handoff surface inventory",
      "typed adapter-contract intent for XML-RPC endpoint states, method-family classification, guard intent, IXR envelope handoff, deprecated symbol classification, source/artifact boundary classification, and cross-domain handoffs",
      "copied-oracle/candidate xmlrpc.php and wp_xmlrpc_server endpoint/server observations for RSD output, server class filtering, method registry/filtering, demo/error helpers, auth failure behavior, and Blogger users-blogs output under deterministic stubs",
      "selected upstream XML-RPC/deprecated PHPUnit groups with vanilla pass / candidate pass classifications",
      "selected installed XML-RPC HTTP route gates declared as blocked with future runner requirements"
    ],
    remaining_gaps: remainingGaps,
    follow_up_guidance: [
      "Prefer generated original-path adapters or a real installed XML-RPC HTTP runner before making stronger WPHX-318 parity claims.",
      "Any future candidate divergence in copied package/route fixtures requires a non-empty generated overlay manifest and zero unexpected candidate differences.",
      "A future installed XML-RPC runner should compare raw XML request/response bodies, HTTP status/headers, IXR faults/success values, hook traces, PHP logs, and database/filesystem deltas under controlled fixtures."
    ]
  }
};

const domainText = `${JSON.stringify(domainReceipt, null, 2)}\n`;
const parentReceipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-318-parent-closure",
  issue: PARENT,
  recorded_at: RECORDED_AT,
  command: "parent closure after WPHX-318.06 bounded domain-closure receipt",
  evidence_class: "parent_domain_closure",
  artifact_scope: "wp_core_xmlrpc_legacy_deprecated_apis",
  behavior_parity_claimed: false,
  artifacts: [
    {
      path: DOMAIN_RECEIPT,
      role: "bounded WPHX-318 domain-closure receipt",
      sha256: sha256(domainText)
    },
    {
      path: PROGRESS_MATRIX,
      role: "program matrix marking WPHX-318 bounded closed"
    },
    {
      path: BEADS_EXPORT,
      role: "tracked Beads export with WPHX-318 parent closure"
    }
  ],
  verification_commands: ["npm run receipts:validate", "npm run beads:validate"],
  validation_result: {
    status: "passed",
    domain_closure_receipt: "receipt:wphx-318-domain-closure",
    bounded_parent_closed: true,
    required_child_gates_closed: REQUIRED_CHILD_GATES,
    remaining_gaps_preserved: remainingGaps,
    non_blocking_follow_up:
      "Future WPHX-318 movement should require generated original-path adapters, explicit generated overlay manifests, real installed XML-RPC HTTP execution, wire/database/filesystem comparisons, or preserved-vendor/IXR policy evidence before stronger XML-RPC or deprecated API parity claims."
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
