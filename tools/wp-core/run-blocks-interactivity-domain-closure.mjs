#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.20.11",
  external_ref: "WPHX-314.17",
  title: "WPHX-314.17 - Close bounded blocks/interactivity PHP domain"
};
const PARENT = {
  id: "wordpresshx-l76.20",
  external_ref: "WPHX-314",
  title: "WPHX-314 - Blocks, block parser, render, supports, bindings, interactivity PHP"
};
const RECORDED_AT = "2026-07-08T05:00:00.000Z";
const RUNNER = "tools/wp-core/run-blocks-interactivity-domain-closure.mjs";
const DOMAIN_RECEIPT = "receipts/wp-core/wphx-314-domain-closure.v1.json";
const PARENT_RECEIPT = "receipts/wp-core/wphx-314-parent-closure.v1.json";
const PROGRESS_MATRIX = "docs/operations/progress-matrix.md";
const BEADS_EXPORT = ".beads/issues.jsonl";

const CHILD_RECEIPTS = [
  {
    ref: "WPHX-314.01",
    path: "receipts/wp-core/wphx-314-01-blocks-interactivity-surface.v1.json",
    role: "blocks/interactivity source, distribution, ABI, upstream test, handoff, and next-gate surface inventory"
  },
  {
    ref: "WPHX-314.02",
    path: "receipts/wp-core/wphx-314-02-blocks-interactivity-adapter-contract-candidate.v1.json",
    role: "typed Haxe blocks/interactivity adapter-contract evidence"
  },
  {
    ref: "WPHX-314.03",
    path: "receipts/wp-core/wphx-314-03-block-parser-render-oracle-fixture.v1.json",
    role: "copied-oracle parser, serializer, block registration, WP_Block, and render_block observations"
  },
  {
    ref: "WPHX-314.04",
    path: "receipts/wp-core/wphx-314-04-block-supports-bindings-oracle-fixture.v1.json",
    role: "copied-oracle block supports, wrapper attributes, block bindings, and WP_Block binding observations"
  },
  {
    ref: "WPHX-314.05",
    path: "receipts/wp-core/wphx-314-05-block-patterns-registry-oracle-fixture.v1.json",
    role: "copied-oracle block pattern and pattern-category registry observations"
  },
  {
    ref: "WPHX-314.06",
    path: "receipts/wp-core/wphx-314-06-block-hooks-insertion-oracle-fixture.v1.json",
    role: "copied-oracle block hooks insertion and ignored metadata observations"
  },
  {
    ref: "WPHX-314.07",
    path: "receipts/wp-core/wphx-314-07-style-engine-oracle-fixture.v1.json",
    role: "copied-oracle style engine declaration, rule, processor, preset, and context observations"
  },
  {
    ref: "WPHX-314.08",
    path: "receipts/wp-core/wphx-314-08-html-api-tag-processor-oracle-fixture.v1.json",
    role: "copied-oracle HTML API tag processor, decoder, token map, bookmark, and mutation observations"
  },
  {
    ref: "WPHX-314.09",
    path: "receipts/wp-core/wphx-314-09-interactivity-api-oracle-fixture.v1.json",
    role: "copied-oracle interactivity API state, context, directive, router, and template observations"
  },
  {
    ref: "WPHX-314.10",
    path: "receipts/wp-core/wphx-314-10-core-block-renderer-oracle-fixture.v1.json",
    role: "copied-oracle selected categories, archives, and tag-cloud core block renderer observations"
  },
  {
    ref: "WPHX-314.11",
    path: "receipts/wp-core/wphx-314-11-blocks-interactivity-upstream-phpunit-ratchet-groups.v1.json",
    role: "selected upstream block/style/HTML/interactivity PHPUnit ratchet group declaration"
  },
  {
    ref: "WPHX-314.12",
    path: "receipts/wp-core/wphx-314-12-blocks-installed-gate.v1.json",
    role: "package-topology and deterministic bridge-router observations for selected block rendering paths"
  },
  {
    ref: "WPHX-314.13",
    path: "receipts/wp-core/wphx-314-13-blocks-interactivity-upstream-phpunit-executable.v1.json",
    role: "executable selected upstream PHPUnit ratchet classifications for WPHX-314 groups"
  },
  {
    ref: "WPHX-314.14",
    path: "receipts/wp-core/wphx-314-14-blocks-installed-expanded-gate.v1.json",
    role: "expanded package-topology and deterministic bridge-router observations over front, REST, admin-post, template, and global-styles paths"
  },
  {
    ref: "WPHX-314.15",
    path: "receipts/wp-core/wphx-314-15-block-wrapper-support-candidate.v1.json",
    role: "typed Haxe helper-level block wrapper support decision candidate"
  },
  {
    ref: "WPHX-314.16",
    path: "receipts/wp-core/wphx-314-16-public-shell-gap-audit.v1.json",
    role: "public PHP shell-gap classification showing zero durable generated WPHX-314 public shells"
  }
];

const REQUIRED_CHILD_GATES = CHILD_RECEIPTS.map((child) => child.ref).concat(["WPHX-314.17"]);

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
      throw new Error(`${path} is stale; run npm run wp:core:wphx-314-domain-closure`);
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
  role: "bounded WPHX-314 closure interpretation"
});

const remainingGaps = [
  "Generated public PHP replacement for blocks.php, class-wp-block*.php, block supports, block bindings, block hooks, pattern registries, style engine, HTML API, interactivity API, selected core block renderers, REST block endpoints, template/global-styles files, and related original-path public files is not claimed.",
  "WPHX-314 currently records two typed Haxe candidates, but those candidates are private/helper or adapter-contract evidence; durable generated original-path public PHP ownership remains unclaimed.",
  "Full Haxe-owned block parser, WP_Block, WP_Block_Type, WP_Block_Supports, WP_HTML_Tag_Processor, WP_Interactivity_API, style engine, pattern registry, block hooks, and core block renderer runtime ownership is not claimed.",
  "The selected upstream PHPUnit ratchet has executable classifications for six WPHX-314 groups, but only blocks-parser-render-core, blocks-hooks-patterns-core, and html-api-core classify vanilla pass / candidate pass; blocks-supports-bindings-core, style-engine-core, and interactivity-api-core remain accepted vanilla fail / candidate fail baseline failures, so complete selected upstream block PHPUnit pass/pass parity is not claimed.",
  "The WPHX-314.12 and WPHX-314.14 package-root gates are package-topology and deterministic bridge-router observation evidence only; they do not dispatch through real installed WordPress bootstrap for the mirrored route files and do not prove installed route parity.",
  "Database-backed block rendering, theme.json/global-styles resolution, template-loader/block-template execution, REST controller dispatch, admin-post/admin route behavior, user/session/capability/nonce state, persistent options/cache/meta state, media/filesystem-backed blocks, and real installed distribution behavior remain later gates.",
  "Browser/editor/Gutenberg package behavior, @wordpress/interactivity client behavior, block editor serialization/UI behavior, visual DOM parity, asset bundling, and package export ownership remain WPHX-400/WPHX-500/WPHX-700 work.",
  "Copied-oracle fixtures and copied package roots remain bridge evidence. Any future candidate divergence requires generated original-path adapters or non-empty generated overlay manifests with zero unexpected candidate package differences.",
  "HXX/HHX markup ownership for block/template-heavy PHP remains limited to separate admin/theme pilots; WPHX-314 does not yet claim typed HXX ownership of existing block template files or mixed PHP/HTML block markup.",
  "Cross-domain ownership remains with WPHX-307/WPHX-308 for post/query/taxonomy/comment state, WPHX-310/WPHX-320 for themes/templates/theme JSON/default themes, WPHX-311/WPHX-316 for REST/admin dispatch, WPHX-312/WPHX-313 for feed/embed/media/upload/file behavior, and WPHX-400/WPHX-500 for browser/Gutenberg packages.",
  "This closes the bounded WPHX-314 blocks/interactivity PHP evidence slice, not the whole WordPress block subsystem, not Gutenberg, and not complete installed WordPress block parity."
];

const domainReceipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-314-domain-closure",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  command: "domain closure audit over WPHX-314.01 through WPHX-314.16 receipts",
  evidence_class: "domain_closure",
  artifact_scope:
    "mixed: source_inventory, adapter_contract, haxe_helper_candidate, oracle_source_mirror, selected_upstream_phpunit_ratchet, packaged_distribution_bridge_router, public_shell_gap_audit",
  behavior_parity_claimed: false,
  generated_public_php_replacement_claimed: false,
  installed_block_rendering_parity_claimed: false,
  durable_original_path_adapter_claimed: false,
  artifacts,
  verification_commands: [
    "npm run wp:core:wphx-314-blocks-interactivity-surface:check",
    "npm run wp:core:wphx-314-blocks-interactivity-adapter-contract-candidate:check",
    "npm run wp:core:wphx-314-block-parser-render-oracle-fixture:check",
    "npm run wp:core:wphx-314-block-supports-bindings-oracle-fixture:check",
    "npm run wp:core:wphx-314-block-patterns-registry-oracle-fixture:check",
    "npm run wp:core:wphx-314-block-hooks-insertion-oracle-fixture:check",
    "npm run wp:core:wphx-314-style-engine-oracle-fixture:check",
    "npm run wp:core:wphx-314-html-api-tag-processor-oracle-fixture:check",
    "npm run wp:core:wphx-314-interactivity-api-oracle-fixture:check",
    "npm run wp:core:wphx-314-core-block-renderer-oracle-fixture:check",
    "npm run upstream:phpunit-ratchet:check",
    "npm run wp:core:wphx-314-blocks-interactivity-upstream-phpunit-executable:check",
    "npm run wp:core:wphx-314-blocks-installed:check",
    "npm run wp:core:wphx-314-blocks-installed-expanded-gate:check",
    "npm run wp:core:wphx-314-block-wrapper-support-candidate:check",
    "npm run wp:core:wphx-314-public-shell-gap-audit:check",
    "npm run receipts:validate",
    "npm run beads:validate"
  ],
  validation_result: {
    status: "passed",
    surface_inventory: true,
    haxe_adapter_contracts: ["BlocksInteractivityAdapterContract"],
    haxe_helper_candidates: ["BlockWrapperSupportCandidate"],
    public_shell_audit: {
      audited_boundary_count: 13,
      durable_generated_public_shell_count: 0,
      copied_oracle_public_surface_count: 8,
      installed_package_bridge_router_count: 2,
      haxe_candidate_without_public_php_replacement_count: 2
    },
    upstream_phpunit_status: {
      selected_group_count: 6,
      selected_test_file_count: 89,
      vanilla_candidate_runs: 12,
      pass_pass_groups: ["blocks-parser-render-core", "blocks-hooks-patterns-core", "html-api-core"],
      accepted_vanilla_fail_candidate_fail_groups: [
        "blocks-supports-bindings-core",
        "style-engine-core",
        "interactivity-api-core"
      ],
      unowned_candidate_regressions: 0,
      complete_selected_pass_pass_parity_claimed: false
    },
    fixtures_cover: [
      "blocks/interactivity source, distribution, ABI, upstream tests, risk classification, and cross-domain handoffs",
      "typed adapter-contract intent across parser/render, supports, bindings, hooks, patterns, style engine, HTML API, interactivity, fonts/assets, and hook behavior",
      "copied-oracle/candidate parser, serializer, block registration, WP_Block, render_block, supports, bindings, patterns, hooks, style engine, HTML API, interactivity, and selected core block renderer observations",
      "selected upstream block/style/HTML/interactivity PHPUnit ratchet declarations and executable classifications",
      "package-topology and deterministic bridge-router observations for selected front, REST, admin-post, bindings, supports, style-engine, HTML API, interactivity, template, and global-styles paths",
      "helper-level typed Haxe candidate evidence for bounded block wrapper support branch/class/style/attribute shaping",
      "public PHP shell-gap classification with zero durable generated WPHX-314 public shells and explicit future removal gates"
    ],
    remaining_gaps: remainingGaps,
    follow_up_guidance: [
      "Prefer generated original-path adapters, typed WPHX PHP Adapter IR, or real installed route execution before making stronger WPHX-314 public PHP ownership claims.",
      "Resolve or explicitly own the three selected upstream baseline-failing WPHX-314 PHPUnit groups before claiming complete selected pass/pass parity.",
      "Use non-empty generated overlay manifests for any future candidate package-root divergence.",
      "Move block/template-heavy markup through typed HXX/file-segment pilots only where Haxe owns the markup unit and caller scope/include/global/output behavior is modeled.",
      "Do not treat copied upstream PHP plus deterministic router PHP as a durable implementation path for later block, admin, theme, or template-heavy closures."
    ]
  },
  non_claims: remainingGaps
};

const domainText = `${JSON.stringify(domainReceipt, null, 2)}\n`;
const parentReceipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-314-parent-closure",
  issue: PARENT,
  recorded_at: RECORDED_AT,
  command: "parent closure after WPHX-314.17 bounded domain-closure receipt",
  evidence_class: "parent_domain_closure",
  artifact_scope: "wp_core_blocks_block_parser_render_supports_bindings_interactivity_php",
  behavior_parity_claimed: false,
  generated_public_php_replacement_claimed: false,
  installed_block_rendering_parity_claimed: false,
  artifacts: [
    {
      path: DOMAIN_RECEIPT,
      role: "bounded WPHX-314 domain-closure receipt",
      sha256: sha256(domainText)
    },
    {
      path: PROGRESS_MATRIX,
      role: "program matrix marking WPHX-314 bounded closed"
    },
    {
      path: BEADS_EXPORT,
      role: "tracked Beads export with WPHX-314 parent closure"
    }
  ],
  verification_commands: ["npm run receipts:validate", "npm run beads:validate"],
  validation_result: {
    status: "passed",
    domain_closure_receipt: "receipt:wphx-314-domain-closure",
    bounded_parent_closed: true,
    required_child_gates_closed: REQUIRED_CHILD_GATES,
    remaining_gaps_preserved: remainingGaps,
    non_blocking_follow_up:
      "Future WPHX-314 movement should require generated original-path adapters, explicit generated overlay manifests, complete selected upstream pass/pass ownership, real installed database-backed block rendering, REST/admin route execution, or browser/editor/Gutenberg evidence before stronger block/interactivity parity claims."
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
