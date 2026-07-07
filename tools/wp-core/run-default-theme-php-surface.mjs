#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.25.1",
  external_ref: "WPHX-320.01",
  title: "WPHX-320.01 - Inventory default theme PHP surface"
};
const RECORDED_AT = "2026-07-06T12:00:00.000Z";
const SOURCE = "manifests/source-inventory.jsonl";
const ARTIFACTS = "manifests/artifact-provenance.jsonl";
const TESTS = "manifests/test-inventory.jsonl";
const ABI = "manifests/php-abi/wordpress-7.0-core-abi.v1.json";
const FIRST_PARTY_CLOSURE = "manifests/wp-core/wphx-322-php-first-party-manifest-closure.v1.json";
const HHX_POLICY = "docs/operations/hhx-template-policy.md";
const OUT = "manifests/wp-core/wphx-320-01-default-theme-php-surface.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-320-01-default-theme-php-surface.v1.json";
const RECEIPT = "receipts/wp-core/wphx-320-01-default-theme-php-surface.v1.json";
const RUNNER = "tools/wp-core/run-default-theme-php-surface.mjs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path) {
  return readFileSync(path, "utf8")
    .trimEnd()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function inputRecord(path) {
  return { path, bytes: statSync(path).size, sha256: sha256File(path) };
}

function stripSrc(path) {
  return path.startsWith("src/") ? path.slice(4) : path;
}

function themeName(path) {
  const parts = stripSrc(path).split("/");
  if (parts[0] !== "wp-content" || parts[1] !== "themes") return "(not-theme)";
  return parts[2] ?? "(theme-root)";
}

function extension(path) {
  const base = path.split("/").pop() ?? "";
  const index = base.lastIndexOf(".");
  return index === -1 ? "(none)" : base.slice(index + 1).toLowerCase();
}

function isDefaultThemePath(path) {
  const p = stripSrc(path).toLowerCase();
  return p === "wp-content/themes/index.php" || p.startsWith("wp-content/themes/twenty");
}

function isDefaultThemePhpSource(entry) {
  return entry.baseline === "wordpress-7.0.0" && entry.language === "php" && entry.kind === "runtime_source" && isDefaultThemePath(entry.path);
}

function isDefaultThemePhpArtifact(entry) {
  const p = stripSrc(entry.path);
  return entry.baseline === "wordpress-7.0.0-distribution" && entry.language === "php" && p.startsWith("wp-content/themes/") && isDefaultThemePath(p);
}

function roleForPath(path) {
  const p = stripSrc(path).toLowerCase();
  if (p === "wp-content/themes/index.php") return "theme_directory_guard";
  if (p.endsWith("/functions.php")) return "theme_functions";
  if (p.includes("/patterns/")) return "block_pattern_php";
  if (p.includes("/parts/") && p.endsWith(".php")) return "php_template_part";
  if (p.includes("/template-parts/")) return "classic_template_part";
  if (p.includes("/templates/") && p.endsWith(".php")) return "php_template";
  if (p.includes("/page-templates/")) return "classic_page_template";
  if (p.includes("/classes/")) return "theme_support_class";
  if (p.includes("/inc/")) {
    if (p.includes("block-pattern")) return "legacy_block_pattern_registration";
    if (p.includes("custom")) return "customizer_or_custom_header";
    if (p.includes("template")) return "template_helper";
    if (p.includes("widget")) return "theme_widget_helper";
    if (p.includes("icon") || p.includes("svg")) return "theme_icon_helper";
    return "theme_include_helper";
  }
  if (p.endsWith("/comments.php")) return "comments_template";
  if (p.endsWith("/header.php") || p.endsWith("/footer.php") || p.includes("/sidebar")) return "layout_chrome_template";
  if (p.endsWith("/searchform.php")) return "search_form_template";
  if (p.endsWith("/404.php") || p.endsWith("/archive.php") || p.endsWith("/index.php") || p.endsWith("/single.php") || p.endsWith("/page.php") || p.endsWith("/search.php") || p.endsWith("/image.php") || p.endsWith("/attachment.php")) return "classic_route_template";
  if (p.includes("/content") || p.includes("/loop") || p.includes("/author")) return "classic_content_loop_template";
  if (p.includes("back-compat")) return "back_compat_helper";
  return "default_theme_php_misc";
}

function hxxCandidateForPath(path) {
  const p = stripSrc(path).toLowerCase();
  const role = roleForPath(path);
  if (role === "block_pattern_php") {
    return {
      classification: "future_hxx_candidate",
      rationale: "Block pattern PHP files mostly emit static or lightly parameterized block markup and can become typed HXX markup units after pattern metadata, escaping, and block grammar gates exist."
    };
  }
  if (role === "classic_template_part" || role === "layout_chrome_template" || role === "search_form_template") {
    return {
      classification: "future_segment_hxx_candidate",
      rationale: "Small repeated theme fragments may be good typed HXX candidates only after caller-scope locals, globals, loop state, include order, and output buffering are modeled."
    };
  }
  if (role === "classic_route_template" || role === "classic_content_loop_template" || role === "comments_template" || role === "classic_page_template") {
    return {
      classification: "mixed_php_html_adoption_boundary",
      rationale: "Existing route, loop, and comments templates rely on WordPress template-loader state, loop globals, comments state, includes, and direct output; inventory only."
    };
  }
  if (p.endsWith("/functions.php") || p.includes("/inc/") || p.includes("/classes/")) {
    return {
      classification: "typed_adapter_or_runtime_candidate",
      rationale: "Behavioral helpers and registrations should first move through typed Haxe adapter contracts or generated original-path adapters, not HXX markup."
    };
  }
  return {
    classification: "not_initial_hxx_candidate",
    rationale: "No typed markup ownership is claimed for this inventory slice."
  };
}

function summarizeBy(entries, keyFn) {
  const groups = {};
  for (const entry of entries) {
    const key = keyFn(entry);
    groups[key] ??= { count: 0, paths: [] };
    groups[key].count++;
    if (groups[key].paths.length < 180) groups[key].paths.push(entry.path);
  }
  return Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)));
}

function countBy(entries, keyFn) {
  const counts = {};
  for (const entry of entries) counts[keyFn(entry)] = (counts[keyFn(entry)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function testMatches(path) {
  const p = path.toLowerCase();
  return (
    p.includes("theme") ||
    p.includes("template") ||
    p.includes("pattern") ||
    p.includes("block-template") ||
    p.includes("global-styles") ||
    p.includes("style-engine") ||
    p.includes("customize") ||
    p.includes("widget") ||
    p.includes("twenty")
  );
}

function symbolSummary(entries) {
  const groups = {};
  for (const entry of entries) {
    const role = roleForPath(entry.path);
    groups[role] ??= { count: 0, functions: [], classes: [], methods: [], properties: [] };
    groups[role].count++;
    if (entry.kind === "function" && groups[role].functions.length < 160) groups[role].functions.push(entry.name);
    if (entry.kind === "class" && groups[role].classes.length < 80) groups[role].classes.push(entry.name);
    if (entry.kind === "method" && groups[role].methods.length < 160) groups[role].methods.push(entry.qualified_name ?? entry.name);
    if (entry.kind === "property" && groups[role].properties.length < 120) groups[role].properties.push(entry.qualified_name ?? entry.name);
  }
  return Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)));
}

function closureSnapshot(closure) {
  const owner = closure.coverage?.owner_coverage?.["WPHX-320"] ?? {};
  return {
    owner_status: owner.status ?? null,
    source_count: owner.source_count ?? null,
    artifact_count: owner.artifact_count ?? null,
    receipt_refs: owner.receipt_refs ?? []
  };
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-320-default-theme-php-surface`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

const source = readJsonl(SOURCE).filter(isDefaultThemePhpSource);
const artifacts = readJsonl(ARTIFACTS).filter(isDefaultThemePhpArtifact);
const tests = readJsonl(TESTS).filter((entry) => entry.baseline === "wordpress-7.0.0" && testMatches(entry.path));
const abi = readJson(ABI);
const closure = readJson(FIRST_PARTY_CLOSURE);
const sourcePaths = new Set(source.map((entry) => entry.path));
const abiEntries = abi.entries.filter((entry) => sourcePaths.has(entry.path));
const hxxCandidates = source.map((entry) => ({
  path: entry.path,
  theme: themeName(entry.path),
  role: roleForPath(entry.path),
  ...hxxCandidateForPath(entry.path)
}));

const hxxClassificationCounts = countBy(hxxCandidates, (entry) => entry.classification);
const hxxCandidateSamples = hxxCandidates
  .filter((entry) => entry.classification === "future_hxx_candidate" || entry.classification === "future_segment_hxx_candidate")
  .slice(0, 80);

const expectedOwner = closure.coverage?.owner_coverage?.["WPHX-320"];
const validationFailures = [];
if (!expectedOwner) validationFailures.push("WPHX-320 is missing from WPHX-322 owner coverage");
if (expectedOwner && expectedOwner.source_count !== source.length) validationFailures.push(`WPHX-322 source count ${expectedOwner.source_count} does not match inventory ${source.length}`);
if (expectedOwner && expectedOwner.artifact_count !== artifacts.length) validationFailures.push(`WPHX-322 artifact count ${expectedOwner.artifact_count} does not match inventory ${artifacts.length}`);

const manifest = {
  schema: "wphx.wp-core-default-theme-php-surface.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  inputs: {
    runner: inputRecord(RUNNER),
    source_inventory: inputRecord(SOURCE),
    artifact_inventory: inputRecord(ARTIFACTS),
    test_inventory: inputRecord(TESTS),
    abi_manifest: inputRecord(ABI),
    first_party_closure: inputRecord(FIRST_PARTY_CLOSURE),
    hhx_template_policy: inputRecord(HHX_POLICY)
  },
  scope: {
    source_files: {
      count: source.length,
      by_theme: summarizeBy(source, (entry) => themeName(entry.path)),
      by_role: summarizeBy(source, (entry) => roleForPath(entry.path)),
      by_extension: countBy(source, (entry) => extension(entry.path))
    },
    distribution_artifacts: {
      count: artifacts.length,
      by_theme: summarizeBy(artifacts, (entry) => themeName(entry.path)),
      by_role: summarizeBy(artifacts, (entry) => roleForPath(entry.path)),
      by_extension: countBy(artifacts, (entry) => extension(entry.path))
    },
    abi: {
      count: abiEntries.length,
      by_role: symbolSummary(abiEntries),
      functions_with_reference_parameters: abiEntries
        .filter((entry) => entry.kind === "function" && entry.parameters?.some((parameter) => parameter.by_reference))
        .map((entry) => entry.name),
      methods_with_reference_parameters: abiEntries
        .filter((entry) => entry.kind === "method" && entry.parameters?.some((parameter) => parameter.by_reference))
        .map((entry) => entry.qualified_name ?? entry.name)
    },
    upstream_tests: {
      count: tests.length,
      paths: tests.map((entry) => entry.path).sort()
    },
    first_party_closure: closureSnapshot(closure)
  },
  hxx_template_authoring: {
    policy: "Use HXX only where Haxe owns the markup unit; existing mixed theme PHP/HTML remains an adoption boundary until segment, caller-scope, template-loader, globals, and output behavior are modeled.",
    classification_counts: hxxClassificationCounts,
    candidate_samples: hxxCandidateSamples,
    non_claim: "This inventory identifies future HXX candidates only. It does not claim broad HXX migration or HXX-owned default theme templates."
  },
  cross_domain_handoffs: [
    {
      owner: "WPHX-309/WPHX-310",
      reason: "Template loader, theme registry, theme supports, theme.json, global styles, and block template resolution decide how bundled theme files are reached."
    },
    {
      owner: "WPHX-307/WPHX-308",
      reason: "Posts, loops, metadata, comments, taxonomy archives, and author/date/status data remain posts/query and taxonomy/comment ownership."
    },
    {
      owner: "WPHX-312/WPHX-313",
      reason: "Feeds, embeds, images, attachments, uploads, and filesystem/media behavior consumed by default theme templates remain neighboring domains."
    },
    {
      owner: "WPHX-314/WPHX-400/WPHX-500",
      reason: "Block pattern markup, block template HTML, style engine, editor/browser behavior, and Gutenberg packages remain block/browser gates."
    },
    {
      owner: "WPHX-315/WPHX-316/WPHX-319",
      reason: "Theme admin screens, customizer/admin Ajax, plugin/theme install/update, and updater side effects are not WPHX-320 runtime ownership."
    }
  ],
  expected_followup_gates: [
    "typed_haxe_default_theme_adapter_contract",
    "bounded_hxx_theme_markup_pilot",
    "copied_oracle_default_theme_template_fixture",
    "selected_upstream_theme_phpunit_ratchets",
    "installed_frontend_theme_rendering_gate",
    "browser_visual_or_dom_parity_gate",
    "generated_overlay_manifest_before_candidate_divergence"
  ],
  evidence_plan: {
    current_claim: "surface_inventory_only",
    behavior_parity_claimed: false,
    haxe_runtime_ownership_claimed: false,
    public_php_replacement_claimed: false,
    installed_theme_rendering_claimed: false,
    browser_visual_parity_claimed: false,
    hxx_template_ownership_claimed: false,
    generated_overlay_claimed: false
  },
  non_claims: [
    "No generated public PHP replacement for bundled default theme PHP files.",
    "No Haxe-owned default theme runtime logic or theme template execution.",
    "No installed theme rendering parity, visual parity, browser/e2e parity, or database-backed front-end behavior.",
    "No broad HXX/HHX migration of existing mixed PHP/HTML theme files.",
    "No generated overlays or generated original-path adapter ownership."
  ],
  validation_result: {
    status: validationFailures.length === 0 ? "passed" : "failed",
    validation_failures: validationFailures,
    source_files: source.length,
    distribution_artifacts: artifacts.length,
    abi_entries: abiEntries.length,
    upstream_tests: tests.length,
    behavior_parity_claimed: false
  }
};

if (validationFailures.length > 0) {
  console.error(JSON.stringify(manifest.validation_result, null, 2));
  process.exit(1);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/default-theme-php-surface",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "source_surface_inventory",
      name: "bundled default theme PHP",
      area: "WordPress 7.0 bundled default theme PHP source, distribution artifacts, templates, functions, patterns, and helpers",
      public_contract:
        "This inventory maps the WPHX-320 default-theme PHP source, distribution, ABI, test, HXX-candidate, and handoff surface. It does not claim Haxe runtime ownership, installed rendering parity, HXX template ownership, or generated public PHP replacement."
    },
    ownership_state: "inventory_only",
    ownership_axes: {
      semantic_owner: "upstream_wordpress_oracle",
      adapter_contract_owner: "not_claimed",
      emission_strategy: "not_claimed",
      execution_provider: "not_claimed",
      compatibility_evidence: "surface_inventory"
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT],
    verification: {
      commands: [
        "npm run wp:core:wphx-320-default-theme-php-surface",
        "npm run wp:core:wphx-320-default-theme-php-surface:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-320-01-default-theme-php-surface"],
      manifest_digest: manifestSha
    },
    non_claims: manifest.non_claims
  };
}

function receipt(manifestSha) {
  return {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-320-01-default-theme-php-surface",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref,
      title: ISSUE.title
    },
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "default theme PHP surface manifest", sha256: manifestSha },
      { path: OWNERSHIP, role: "default theme PHP surface ownership manifest" },
      { path: RUNNER, role: "deterministic default theme PHP surface inventory generator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-320-default-theme-php-surface",
      "npm run wp:core:wphx-320-default-theme-php-surface:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-322-php-first-party-manifest-closure",
      "receipt:wphx-310-domain-closure",
      "receipt:wphx-315-08-admin-hxx-markup-pilot"
    ],
    summary:
      "Inventories the bounded WPHX-320 bundled default theme PHP surface, reconciles WPHX-322 source/artifact coverage, records theme/template role groupings, related tests, future HXX candidates, cross-domain handoffs, next gates, and explicit non-claims.",
    manifest_sha256: manifestSha,
    validation_result: manifest.validation_result,
    non_claims: manifest.non_claims
  };
}

const manifestContents = `${JSON.stringify(manifest, null, 2)}\n`;
const manifestSha = sha256(manifestContents);
writeOrCheck(OUT, manifestContents);
writeOrCheck(OWNERSHIP, `${JSON.stringify(ownershipManifest(manifestSha), null, 2)}\n`);
writeOrCheck(RECEIPT, `${JSON.stringify(receipt(manifestSha), null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      status: "passed",
      output: OUT,
      ownership: OWNERSHIP,
      receipt: RECEIPT,
      source_files: source.length,
      distribution_artifacts: artifacts.length,
      abi_entries: abiEntries.length,
      upstream_tests: tests.length
    },
    null,
    2
  )
);
