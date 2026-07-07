#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-d8d8",
  external_ref: "WPHX-320.07",
  title: "WPHX-320.07 - Close default theme PHP bounded evidence slice"
};
const PARENT = {
  id: "wordpresshx-l76.25",
  external_ref: "WPHX-320",
  title: "WPHX-320 - Default theme PHP"
};
const RECORDED_AT = "2026-07-07T22:00:00.000Z";
const RUNNER = "tools/wp-core/run-default-theme-domain-closure.mjs";
const DOMAIN_RECEIPT = "receipts/wp-core/wphx-320-domain-closure.v1.json";
const PARENT_RECEIPT = "receipts/wp-core/wphx-320-parent-closure.v1.json";
const PROGRESS_MATRIX = "docs/operations/progress-matrix.md";
const BEADS_EXPORT = ".beads/issues.jsonl";

const CHILD_RECEIPTS = [
  {
    ref: "WPHX-320.01",
    path: "receipts/wp-core/wphx-320-01-default-theme-php-surface.v1.json",
    role: "default-theme PHP source, distribution, ABI, test, HXX-candidate, handoff, and next-gate surface inventory"
  },
  {
    ref: "WPHX-320.02",
    path: "receipts/wp-core/wphx-320-02-theme-hxx-markup-pilot.v1.json",
    role: "bounded typed HXX-style default-theme hero/navigation markup-unit pilot"
  },
  {
    ref: "WPHX-320.03",
    path: "receipts/wp-core/wphx-320-03-default-theme-upstream-browser-ratchets.v1.json",
    role: "selected upstream theme/template PHPUnit dependency ratchets and blocked browser/performance/visual scope declarations"
  },
  {
    ref: "WPHX-320.04",
    path: "receipts/wp-core/wphx-320-04-default-theme-pattern-oracle-fixture.v1.json",
    role: "selected copied-oracle bundled default-theme pattern PHP output observations"
  },
  {
    ref: "WPHX-320.05",
    path: "receipts/wp-core/wphx-320-05-default-theme-functions-oracle-fixture.v1.json",
    role: "selected copied-oracle bundled default-theme functions.php hook/callback observations"
  },
  {
    ref: "WPHX-320.06",
    path: "receipts/wp-core/wphx-320-06-default-theme-installed-rendering-gates.v1.json",
    role: "selected installed/browser default-theme rendering gate declarations with blockers and future runner requirements"
  }
];

const REQUIRED_CHILD_GATES = CHILD_RECEIPTS.map((child) => child.ref).concat(["WPHX-320.07"]);

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
      throw new Error(`${path} is stale; run npm run wp:core:wphx-320-domain-closure`);
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
  role: "bounded WPHX-320 closure interpretation"
});

const remainingGaps = [
  "Generated public PHP replacement for bundled default-theme PHP, HTML template, pattern, functions.php, theme.json/style, asset, browser package, template-loader, block-template, block-pattern, block-binding, global-styles, and theme-adjacent admin files is not claimed.",
  "Haxe-owned existing default-theme runtime logic for bundled theme files is not claimed; WPHX-320.02 owns only a bounded representative HXX-style hero/navigation markup unit, not arbitrary existing mixed PHP/HTML theme migration.",
  "Installed WordPress bootstrap, real template-loader execution, block-template hierarchy execution, pattern registry consumption, block rendering, functions.php hook execution under WordPress bootstrap, theme support/asset behavior under real routes, and browser-observed rendering are not claimed.",
  "Browser/e2e, visual-regression, performance, accessibility, asset/network, screenshot, and console parity for bundled default themes are not executed or claimed.",
  "Database-backed posts/pages/search/archive/comment/term/media/menu/widget/customizer/global-styles state, user/session/capability/nonce state, locale/cache behavior, filesystem/media asset reads, and admin/theme-adjacent state remain later gates.",
  "Selected WPHX-320 upstream PHPUnit dependency groups classify vanilla pass / candidate pass, but complete upstream default-theme/theme/template/block-template suite parity is not claimed.",
  "The WPHX-320.04 and WPHX-320.05 copied-oracle fixtures execute selected mirrored upstream PHP under deterministic stubs; they do not prove generated public PHP replacement, installed pattern registry behavior, installed functions.php behavior, or installed theme rendering parity.",
  "The WPHX-320.06 installed/browser rendering gates are declared as blocked until real installed oracle/candidate roots, generated-overlay discipline, database/content/media/theme state, template-loader/block-rendering execution, and browser/HTTP/DOM/visual/performance diff evidence exist.",
  "Cross-domain ownership remains with WPHX-307/WPHX-308 for content/query/comment/term state, WPHX-309/WPHX-310 for routing/template/theme/theme-json/customizer/widgets/nav menus, WPHX-312/WPHX-313 for HTTP/assets/uploads/media/filesystem, WPHX-314 for block rendering/supports/bindings/global styles, WPHX-315/WPHX-316/WPHX-319 for admin/theme-adjacent/update flows, and WPHX-400/WPHX-500/WPHX-700 for browser/Gutenberg/distribution evidence.",
  "Generated overlays, generated original-path adapters, durable public PHP ownership, broad installed default-theme parity, browser/editor package ownership, ecosystem/theme/plugin compatibility, and release-grade visual/performance parity require future WPHX PHP adapter evidence, typed segment plans, or real installed/browser gates.",
  "This closes the bounded WPHX-320 default-theme PHP evidence slice, not all bundled default-theme behavior or complete installed WordPress theme parity."
];

const domainReceipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-320-domain-closure",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  command: "domain closure audit over WPHX-320.01 through WPHX-320.06 receipts",
  evidence_class: "domain_closure",
  artifact_scope:
    "mixed: source_inventory, typed_hxx_markup_unit, upstream_suite_dependency_parity, copied_oracle_source_mirror, installed_browser_gate_declaration",
  behavior_parity_claimed: false,
  installed_theme_rendering_parity_claimed: false,
  generated_public_php_replacement_claimed: false,
  haxe_owned_existing_theme_file_claimed: false,
  artifacts,
  verification_commands: [
    "npm run wp:core:wphx-320-default-theme-php-surface:check",
    "npm run wp:core:wphx-320-theme-hxx-markup-pilot:check",
    "npm run wp:core:wphx-320-default-theme-upstream-browser-ratchets:check",
    "npm run wp:core:wphx-320-default-theme-pattern-oracle-fixture:check",
    "npm run wp:core:wphx-320-default-theme-functions-oracle-fixture:check",
    "npm run wp:core:wphx-320-default-theme-installed-rendering-gates:check",
    "npm run receipts:validate",
    "npm run beads:validate"
  ],
  validation_result: {
    status: "passed",
    surface_inventory: true,
    typed_hxx_markup_units: ["ThemeHxxMarkupPilot hero/navigation representative unit"],
    fixtures_cover: [
      "default-theme PHP source, distribution artifacts, ABI entries, related tests/e2e references, template roles, HXX candidate classifications, and cross-domain handoffs",
      "bounded Haxe-owned hero/navigation markup-unit output through a WPHX PHP file-segment shell",
      "selected upstream PHP theme/template/canonical/block-template dependency groups with vanilla pass / candidate pass classifications and blocked browser/performance/visual references",
      "copied-oracle/candidate output observations for selected bundled default-theme pattern PHP files under deterministic translation, escaping, and theme-URI stubs",
      "copied-oracle/candidate hook/callback observations for selected bundled default-theme functions.php files under deterministic hook/theme/enqueue/block-style/pattern-category/block-binding/post-format stubs",
      "selected installed/browser default-theme rendering gates declared as blocked with future runner requirements"
    ],
    remaining_gaps: remainingGaps,
    follow_up_guidance: [
      "Prefer generated original-path adapters, typed HXX/file-segment plans for owned markup units, or a real installed default-theme rendering runner before making stronger WPHX-320 parity claims.",
      "Any future candidate divergence in copied package/route/theme fixtures requires a non-empty generated overlay manifest and zero unexpected candidate differences.",
      "A future installed default-theme runner should compare HTTP/admin/browser observations, rendered DOM, block comments, template-selection traces, global-style CSS, asset requests, media/filesystem reads, database state, PHP logs, hook traces, screenshots, performance metrics, and generated overlay hashes under controlled fixtures.",
      "Do not use copied pattern/functions fixtures as precedent for durable theme implementation; existing bundled theme files need generated adapters, typed segment plans, or installed/browser evidence before ownership claims."
    ]
  }
};

const domainText = `${JSON.stringify(domainReceipt, null, 2)}\n`;
const parentReceipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-320-parent-closure",
  issue: PARENT,
  recorded_at: RECORDED_AT,
  command: "parent closure after WPHX-320.07 bounded domain-closure receipt",
  evidence_class: "parent_domain_closure",
  artifact_scope: "wp_core_default_theme_php",
  behavior_parity_claimed: false,
  installed_theme_rendering_parity_claimed: false,
  generated_public_php_replacement_claimed: false,
  artifacts: [
    {
      path: DOMAIN_RECEIPT,
      role: "bounded WPHX-320 domain-closure receipt",
      sha256: sha256(domainText)
    },
    {
      path: PROGRESS_MATRIX,
      role: "program matrix marking WPHX-320 bounded closed"
    },
    {
      path: BEADS_EXPORT,
      role: "tracked Beads export with WPHX-320 parent closure"
    }
  ],
  verification_commands: ["npm run receipts:validate", "npm run beads:validate"],
  validation_result: {
    status: "passed",
    domain_closure_receipt: "receipt:wphx-320-domain-closure",
    bounded_parent_closed: true,
    required_child_gates_closed: REQUIRED_CHILD_GATES,
    remaining_gaps_preserved: remainingGaps,
    non_blocking_follow_up:
      "Future WPHX-320 movement should require generated original-path adapters, typed HXX/segment-plan ownership for bounded markup units, explicit generated overlay manifests, real installed default-theme rendering, browser/visual/performance execution, or ecosystem/theme compatibility evidence before stronger default-theme parity claims."
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
