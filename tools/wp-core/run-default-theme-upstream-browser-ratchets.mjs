#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-53pe",
  external_ref: "WPHX-320.03",
  title: "WPHX-320.03 - Declare default theme upstream/browser ratchets"
};
const RECORDED_AT = "2026-07-07T17:00:00.000Z";
const RUNNER = "tools/wp-core/run-default-theme-upstream-browser-ratchets.mjs";
const GROUPS = "tests/upstream/phpunit/groups.json";
const GLOBAL_RATCHET = "manifests/operations/wphx-700-05-upstream-phpunit-ratchet.v1.json";
const GLOBAL_PROVISION = "manifests/operations/wphx-700-09-phpunit-ratchet-env.v1.json";
const GLOBAL_RATCHET_RECEIPT = "receipts/operations/wphx-700-05-upstream-phpunit-ratchet.v1.json";
const GLOBAL_PROVISION_RECEIPT = "receipts/operations/wphx-700-09-phpunit-ratchet-env.v1.json";
const RATCHET_DOC = "docs/operations/upstream-phpunit-ratchet.md";
const SURFACE = "manifests/wp-core/wphx-320-01-default-theme-php-surface.v1.json";
const HXX_PILOT = "manifests/wp-core/wphx-320-02-theme-hxx-markup-pilot.v1.json";
const HXX_PILOT_OWNERSHIP = "manifests/ownership/wphx-320-02-theme-hxx-markup-pilot.v1.json";
const HXX_PILOT_RECEIPT = "receipts/wp-core/wphx-320-02-theme-hxx-markup-pilot.v1.json";
const OUT = "manifests/wp-core/wphx-320-03-default-theme-upstream-browser-ratchets.v1.json";
const RECEIPT = "receipts/wp-core/wphx-320-03-default-theme-upstream-browser-ratchets.v1.json";
const WP_DEVELOP_ROOT = "../wordpress-develop";

const SELECTED_GROUPS = [
  "canonical-link-template-core",
  "theme-template-core",
  "theme-json-global-styles",
  "block-template-core"
];

const BLOCKED_BROWSER_RATCHETS = [
  {
    id: "default-theme-home-performance",
    upstream_path: "tests/performance/specs/home.test.js",
    runner_family: "performance",
    routes: ["/"],
    default_theme_scope: ["twentytwentyone", "twentytwentythree", "twentytwentyfour", "twentytwentyfive"],
    blocked_until: [
      "real installed oracle/candidate WordPress roots exist",
      "generated-overlay discipline is enforced for theme files",
      "database-backed seeded content, site options, locales, and cache state are reproducible",
      "browser/performance measurements can compare rendered theme output instead of upstream-only runs"
    ]
  },
  {
    id: "default-theme-single-post-performance",
    upstream_path: "tests/performance/specs/single-post.test.js",
    runner_family: "performance",
    routes: ["/2018/11/03/block-image/"],
    default_theme_scope: ["twentytwentyone", "twentytwentythree", "twentytwentyfour", "twentytwentyfive"],
    blocked_until: [
      "real installed oracle/candidate WordPress roots exist",
      "post/query/comment/media fixtures are owned or explicitly seeded",
      "template-loader execution and default-theme PHP output can be diffed through HTTP/browser probes",
      "browser/performance measurements can compare rendered theme output instead of upstream-only runs"
    ]
  },
  {
    id: "visual-admin-theme-adjacent-snapshots",
    upstream_path: "tests/visual-regression/specs/visual-snapshots.test.js",
    runner_family: "visual_regression",
    routes: ["/wp-admin/widgets.php", "/wp-admin/nav-menus.php"],
    default_theme_scope: ["widgets", "menus", "theme-adjacent admin surfaces"],
    blocked_until: [
      "real installed admin roots exist",
      "admin/theme/customizer/widget/menu ownership boundaries are narrowed",
      "Playwright screenshot baselines are reproducible against oracle and generated candidate packages"
    ]
  }
];

const UPSTREAM_SUPPORT_FILES = [
  "tests/performance/utils.js",
  "tests/performance/log-results.js",
  "tests/performance/wp-content/mu-plugins/server-timing.php"
];

function sha256File(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function inputRecord(path) {
  return { path, bytes: statSync(path).size, sha256: sha256File(path) };
}

function upstreamRecord(relativePath) {
  const path = join(WP_DEVELOP_ROOT, relativePath);
  return {
    authority: "wordpress-develop",
    path,
    upstream_path: relativePath,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run npm run wp:core:wphx-320-default-theme-upstream-browser-ratchets`);
    const current = readFileSync(path, "utf8");
    if (current !== body) throw new Error(`${path} is stale; run npm run wp:core:wphx-320-default-theme-upstream-browser-ratchets`);
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
  const selectedGroups = SELECTED_GROUPS.map((id) => {
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
      classification,
      wphx_320_relevance:
        id === "canonical-link-template-core"
          ? "Locks permalink, canonical, theme-file URL, and general template references reached by default-theme rendering."
          : id === "theme-template-core"
            ? "Locks theme support, theme mods, WP_Theme, custom header, body class, and general template behavior that default themes depend on."
            : id === "theme-json-global-styles"
              ? "Locks theme.json resolver/global-styles behavior used by block default themes and style output."
              : "Locks block template and block-template hierarchy behavior used by block default themes."
    };
  });
  const failures = selectedGroups.filter((group) => group.classification.classification !== "parity_pass");
  if (failures.length > 0) {
    throw new Error(`WPHX-320 selected ratchet groups are not all parity_pass: ${failures.map((group) => group.id).join(", ")}`);
  }
  if (globalProvision.validation_result.unowned_candidate_regression_count !== 0) {
    throw new Error("The provisioned upstream ratchet records unowned candidate regressions");
  }

  const selectedFileCount = selectedGroups.reduce((count, group) => count + group.file_count, 0);
  const blockedBrowserRatchets = BLOCKED_BROWSER_RATCHETS.map((ratchet) => ({
    ...ratchet,
    upstream_source: upstreamRecord(ratchet.upstream_path),
    execution_status: "blocked_not_run",
    browser_or_visual_parity_claimed: false
  }));
  const supportFiles = UPSTREAM_SUPPORT_FILES.map((path) => upstreamRecord(path));

  const manifest = {
    schema_version: 1,
    issue: ISSUE.external_ref,
    beads_issue: ISSUE.id,
    title: ISSUE.title,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "selected_upstream_phpunit_and_blocked_browser_ratchet_scope",
    artifact_scope: "default_theme_php_rendering_dependencies",
    behavior_parity_claimed: false,
    selected_upstream_phpunit_parity_claimed: true,
    browser_e2e_execution_claimed: false,
    browser_or_visual_parity_claimed: false,
    installed_theme_rendering_parity_claimed: false,
    public_php_replacement_claimed: false,
    candidate_generated_overlay_claimed: false,
    generated_original_path_adapter_claimed: false,
    haxe_owned_existing_theme_file_claimed: false,
    selected_group_count: selectedGroups.length,
    selected_test_file_count: selectedFileCount,
    selected_groups: selectedGroups,
    selected_classification_summary: {
      all_selected_parity_pass: true,
      parity_pass_groups: selectedGroups.map((group) => group.id),
      baseline_failure_groups: []
    },
    blocked_browser_ratchet_count: blockedBrowserRatchets.length,
    blocked_browser_ratchets: blockedBrowserRatchets,
    upstream_support_files: supportFiles,
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
      hxx_pilot_manifest: inputRecord(HXX_PILOT),
      hxx_pilot_ownership_manifest: inputRecord(HXX_PILOT_OWNERSHIP),
      hxx_pilot_receipt: inputRecord(HXX_PILOT_RECEIPT)
    },
    cross_domain_handoffs: [
      {
        owner: "WPHX-307/WPHX-308",
        reason: "Default-theme home and single-post rendering depends on post/query/comment/term state, loop globals, pagination, and seeded content that remain posts/query/taxonomy/comment ownership."
      },
      {
        owner: "WPHX-309/WPHX-310",
        reason: "Template resolution, theme support, theme mods, theme.json/global styles, block templates, widgets, and navigation remain routing/template and theme-system ownership when WPHX-320 theme files execute."
      },
      {
        owner: "WPHX-312/WPHX-313",
        reason: "Feed/embed/media/file URLs, attachments, filesystem paths, image assets, and theme asset loading remain HTTP/feed/embed and media/filesystem ownership."
      },
      {
        owner: "WPHX-314/WPHX-400/WPHX-500",
        reason: "Block markup, block templates, patterns, global styles, front-end scripts, editor packages, and browser rendering remain block/browser/Gutenberg ownership beyond this default-theme PHP ratchet declaration."
      },
      {
        owner: "WPHX-315/WPHX-316/WPHX-319",
        reason: "Widgets, menus, customizer/admin screens, theme install/update flows, capabilities, nonces, and admin browser routes remain admin and updates ownership."
      }
    ],
    non_claims: [
      "No generated public PHP replacement for any bundled default-theme file.",
      "No Haxe-owned existing mixed PHP/HTML template runtime or broad HXX migration of bundled theme files.",
      "No installed template-loader, front-end theme rendering, browser, visual-regression, or performance parity execution.",
      "No database-backed post/query/menu/widget/customizer/global-styles state, locale switching, cache behavior, media asset behavior, generated overlay, or generated original-path adapter ownership.",
      "The selected upstream PHPUnit groups are dependency ratchets over the pinned WordPress 7.0 oracle/candidate worktree; pass/pass evidence is not WPHX runtime ownership.",
      "The blocked browser/performance/visual ratchets lock future evidence scope only; they are not executed by this runner."
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
      ratchet_documentation: RATCHET_DOC,
      upstream_browser_sources: blockedBrowserRatchets.map((ratchet) => ratchet.upstream_source)
    },
    summary: `Declares four selected default-theme-related upstream PHPUnit ratchet dependency groups covering ${selectedFileCount} theme/template/canonical/block-template test files, all classified vanilla pass / candidate pass. It also locks three future browser/performance/visual ratchet references as blocked scope only, with no installed theme rendering, browser execution, generated public PHP replacement, generated overlay, or Haxe-owned existing-theme-file claim.`,
    checks: [
      "npm run upstream:phpunit-ratchet:provision",
      "npm run upstream:phpunit-ratchet:provision:check",
      "npm run wp:core:wphx-320-default-theme-upstream-browser-ratchets",
      "npm run wp:core:wphx-320-default-theme-upstream-browser-ratchets:check",
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
        selected_group_count: selectedGroups.length,
        selected_test_file_count: selectedFileCount,
        blocked_browser_ratchet_count: blockedBrowserRatchets.length,
        global_ratchet_runs_executed: globalRatchet.validation_result.runs_executed,
        wphx_320_dependency_classifications: selectedGroups.map((group) => ({
          group: group.id,
          owner: group.owner,
          classification: group.classification.classification
        }))
      },
      null,
      2
    )
  );
}

main();
