#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.17.6",
  external_ref: "WPHX-310.06",
  title: "WPHX-310.06 — Inventory theme customizer/widget/nav-menu surface"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-theme-customizer-widget-nav-surface.mjs";
const SOURCE = "manifests/source-inventory.jsonl";
const ARTIFACTS = "manifests/artifact-provenance.jsonl";
const TESTS = "manifests/test-inventory.jsonl";
const ABI = "manifests/php-abi/wordpress-7.0-core-abi.v1.json";
const WPHX_310_SURFACE = "manifests/wp-core/wphx-310-01-themes-template-surface.v1.json";
const WPHX_310_CONTRACT = "manifests/wp-core/wphx-310-02-theme-template-adapter-contract-candidate.v1.json";
const WPHX_310_SUPPORT = "manifests/wp-core/wphx-310-03-theme-support-template-oracle-fixture.v1.json";
const WPHX_310_THEME_JSON = "manifests/wp-core/wphx-310-04-theme-json-global-styles-oracle-fixture.v1.json";
const WPHX_310_RESOLVER = "manifests/wp-core/wphx-310-05-theme-json-resolver-global-styles-fixture.v1.json";
const OUT = "manifests/wp-core/wphx-310-06-theme-customizer-widget-nav-surface.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-310-06-theme-customizer-widget-nav-surface.v1.json";
const RECEIPT = "receipts/wp-core/wphx-310-06-theme-customizer-widget-nav-surface.v1.json";

const TARGET_GROUPS = ["customizer", "widgets_sidebars", "nav_menus", "admin_theme_screens"];
const GROUP_DESCRIPTIONS = {
  customizer:
    "Customizer manager, setting/control/panel/section classes, selective refresh, theme preview, custom CSS, widget and nav-menu customizer adapters.",
  widgets_sidebars:
    "Sidebar registration, widget factory/base classes, bundled widget classes, widget admin forms, legacy/block widget bridge files, and sidebar theme-compat output.",
  nav_menus:
    "Nav-menu CRUD, menu item setup, front-end menu templates, admin menu screen helpers, walkers, and nav-menu widget bridge.",
  admin_theme_screens:
    "Theme list/install/editor screens, theme install/list tables, theme upgrader skins, and admin-visible theme package management surfaces."
};

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
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function inputRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function stripSrc(path) {
  return path.startsWith("src/") ? path.slice(4) : path;
}

function groupForPath(path) {
  const p = stripSrc(path).toLowerCase();
  if (p.startsWith("wp-content/themes/")) return null;
  if (p.includes("customize")) return "customizer";
  if (p.includes("nav-menu")) return "nav_menus";
  if (p.includes("widget") || p.includes("sidebar")) return "widgets_sidebars";
  if (
    p.startsWith("wp-admin/") &&
    (p.endsWith("wp-admin/ms-themes.php") ||
      p.endsWith("wp-admin/themes.php") ||
      p.endsWith("wp-admin/theme-install.php") ||
      p.endsWith("wp-admin/theme-editor.php") ||
      p.endsWith("wp-admin/network/site-themes.php") ||
      p.endsWith("wp-admin/network/themes.php") ||
      p.endsWith("wp-admin/network/theme-install.php") ||
      p.endsWith("wp-admin/network/theme-editor.php") ||
      p.endsWith("wp-admin/includes/template.php") ||
      p.endsWith("wp-admin/includes/theme.php") ||
      p.endsWith("wp-admin/includes/theme-install.php") ||
      p.includes("class-theme-") ||
      p.includes("class-bulk-theme-") ||
      p.includes("class-wp-theme") ||
      p.includes("class-wp-themes") ||
      p.includes("class-wp-ms-themes"))
  ) {
    return "admin_theme_screens";
  }
  return null;
}

function targetPath(path) {
  return TARGET_GROUPS.includes(groupForPath(path));
}

function testMatches(path) {
  const p = path.toLowerCase();
  return (
    p.includes("/customize/") ||
    p.includes("customize-") ||
    p.includes("/widgets") ||
    p.includes("/widget") ||
    p.includes("/nav-menu") ||
    p.includes("/menu/nav-menu") ||
    p.includes("/post/nav-menu") ||
    p.includes("/theme/customheader") ||
    p.includes("/theme/theme") ||
    p.includes("/admin/includes/theme")
  );
}

function summarizePaths(entries) {
  const groups = {};
  for (const entry of entries) {
    const group = groupForPath(entry.path);
    if (!group) continue;
    groups[group] ??= { description: GROUP_DESCRIPTIONS[group], count: 0, paths: [] };
    groups[group].count++;
    groups[group].paths.push(entry.path);
  }
  return Object.fromEntries(
    TARGET_GROUPS.map((group) => [
      group,
      groups[group] ?? { description: GROUP_DESCRIPTIONS[group], count: 0, paths: [] }
    ])
  );
}

function summarizeAbi(entries) {
  const groups = {};
  for (const entry of entries) {
    const group = groupForPath(entry.path);
    if (!group) continue;
    groups[group] ??= {
      count: 0,
      by_kind: {},
      functions: [],
      classes: [],
      methods: [],
      properties: [],
      constants: [],
      by_reference: [],
      variadic: []
    };
    const record = groups[group];
    record.count++;
    record.by_kind[entry.kind] = (record.by_kind[entry.kind] ?? 0) + 1;
    if (entry.kind === "function" && record.functions.length < 140) record.functions.push(entry.name);
    if (entry.kind === "class" && record.classes.length < 120) record.classes.push(entry.name);
    if (entry.kind === "method" && record.methods.length < 200) record.methods.push(entry.qualified_name ?? entry.name);
    if (entry.kind === "property" && record.properties.length < 140) record.properties.push(entry.qualified_name ?? entry.name);
    if (entry.kind === "constant" && record.constants.length < 80) record.constants.push(entry.name);
    if (entry.parameters?.some((parameter) => parameter.by_reference) && record.by_reference.length < 100) {
      record.by_reference.push(entry.qualified_name ?? entry.name);
    }
    if (entry.parameters?.some((parameter) => parameter.variadic) && record.variadic.length < 80) {
      record.variadic.push(entry.qualified_name ?? entry.name);
    }
  }
  for (const group of TARGET_GROUPS) {
    groups[group] ??= {
      count: 0,
      by_kind: {},
      functions: [],
      classes: [],
      methods: [],
      properties: [],
      constants: [],
      by_reference: [],
      variadic: []
    };
  }
  return Object.fromEntries(TARGET_GROUPS.map((group) => [group, groups[group]]));
}

function hookMatches(contents) {
  const hooks = [];
  const hookRegex = /\b(add_action|add_filter|do_action|apply_filters)\s*\(\s*(['"])([^'"]+)\2/g;
  let match;
  while ((match = hookRegex.exec(contents)) !== null) {
    hooks.push({ api: match[1], hook: match[3] });
  }
  return hooks;
}

function hookSummary(sourceEntries) {
  const groups = {};
  for (const entry of sourceEntries) {
    const group = groupForPath(entry.path);
    if (!group) continue;
    const path = `${UPSTREAM_ROOT}/${entry.path}`;
    const hooks = hookMatches(readFileSync(path, "utf8"));
    if (hooks.length === 0) continue;
    groups[group] ??= { count: 0, by_api: {}, hooks: [], paths: {} };
    groups[group].count += hooks.length;
    groups[group].paths[entry.path] = hooks.map((hook) => `${hook.api}:${hook.hook}`);
    for (const hook of hooks) {
      groups[group].by_api[hook.api] = (groups[group].by_api[hook.api] ?? 0) + 1;
      if (!groups[group].hooks.includes(hook.hook) && groups[group].hooks.length < 240) {
        groups[group].hooks.push(hook.hook);
      }
    }
  }
  for (const group of TARGET_GROUPS) {
    groups[group] ??= { count: 0, by_api: {}, hooks: [], paths: {} };
    groups[group].hooks.sort();
    groups[group].paths = Object.fromEntries(Object.entries(groups[group].paths).sort(([a], [b]) => a.localeCompare(b)));
  }
  return Object.fromEntries(TARGET_GROUPS.map((group) => [group, groups[group]]));
}

function testSummary(entries) {
  const buckets = {
    customizer: [],
    widgets_sidebars: [],
    nav_menus: [],
    admin_theme_screens: []
  };
  for (const entry of entries) {
    const p = entry.path.toLowerCase();
    if (p.includes("customize")) buckets.customizer.push(entry.path);
    else if (p.includes("widget")) buckets.widgets_sidebars.push(entry.path);
    else if (p.includes("nav-menu") || p.includes("/menus")) buckets.nav_menus.push(entry.path);
    else buckets.admin_theme_screens.push(entry.path);
  }
  return Object.fromEntries(
    TARGET_GROUPS.map((group) => [group, { count: buckets[group].length, paths: buckets[group].sort() }])
  );
}

function riskPlan(sourceByGroup, abiByGroup, hooksByGroup, testsByGroup) {
  return TARGET_GROUPS.map((group) => {
    const risks = [];
    if (hooksByGroup[group].count > 0) risks.push("hook_order_and_filter_return_values");
    if (abiByGroup[group].by_reference.length > 0) risks.push("reference_parameter_abi");
    if (group === "customizer") risks.push("changeset_preview_ajax_capability_nonce_state");
    if (group === "widgets_sidebars") risks.push("global_widget_registry_and_output_buffering");
    if (group === "nav_menus") risks.push("term_post_meta_integration_and_walker_output");
    if (group === "admin_theme_screens") risks.push("filesystem_network_capability_side_effects");
    return {
      group,
      source_files: sourceByGroup[group].count,
      abi_entries: abiByGroup[group].count,
      hook_observations: hooksByGroup[group].count,
      upstream_tests: testsByGroup[group].count,
      recommended_next_gate:
        group === "customizer"
          ? "deterministic customizer manager/settings oracle fixture before installed customize.php/admin-ajax gate"
          : group === "widgets_sidebars"
            ? "deterministic widget/sidebar registry and dynamic_sidebar output fixture"
            : group === "nav_menus"
              ? "deterministic nav-menu CRUD/setup/template/walker fixture"
              : "admin-visible theme list/install/theme-editor inventory-to-installed gate",
      risks
    };
  });
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-310-theme-customizer-widget-nav-surface`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

const source = readJsonl(SOURCE).filter(
  (entry) => entry.baseline === "wordpress-7.0.0" && entry.language === "php" && entry.kind === "runtime_source" && targetPath(entry.path)
);
const artifacts = readJsonl(ARTIFACTS).filter(
  (entry) => entry.baseline === "wordpress-7.0.0-distribution" && entry.language === "php" && targetPath(entry.path)
);
const tests = readJsonl(TESTS).filter((entry) => entry.baseline === "wordpress-7.0.0" && testMatches(entry.path));
const abi = readJson(ABI);
const sourcePaths = new Set(source.map((entry) => entry.path));
const abiEntries = abi.entries.filter((entry) => sourcePaths.has(entry.path));
const priorSurface = readJson(WPHX_310_SURFACE);

const sourceByGroup = summarizePaths(source);
const artifactByGroup = summarizePaths(artifacts);
const abiByGroup = summarizeAbi(abiEntries);
const hooksByGroup = hookSummary(source);
const testsByGroup = testSummary(tests);

const manifest = {
  schema: "wphx.wp-core-theme-customizer-widget-nav-surface.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  inputs: {
    runner: inputRecord(RUNNER),
    source_inventory: inputRecord(SOURCE),
    artifact_inventory: inputRecord(ARTIFACTS),
    test_inventory: inputRecord(TESTS),
    abi_manifest: inputRecord(ABI),
    parent_theme_surface_manifest: inputRecord(WPHX_310_SURFACE),
    theme_template_adapter_contract_manifest: inputRecord(WPHX_310_CONTRACT),
    theme_support_template_fixture_manifest: inputRecord(WPHX_310_SUPPORT),
    theme_json_global_styles_fixture_manifest: inputRecord(WPHX_310_THEME_JSON),
    theme_json_resolver_fixture_manifest: inputRecord(WPHX_310_RESOLVER)
  },
  scope: {
    groups: TARGET_GROUPS.map((group) => ({ id: group, description: GROUP_DESCRIPTIONS[group] })),
    source_files: {
      count: source.length,
      by_group: sourceByGroup
    },
    distribution_artifacts: {
      count: artifacts.length,
      by_group: artifactByGroup
    },
    abi: {
      count: abiEntries.length,
      by_group: abiByGroup
    },
    hooks: hooksByGroup,
    upstream_tests: {
      count: tests.length,
      by_group: testsByGroup
    },
    parent_surface_context: {
      parent_issue: priorSurface.issue,
      parent_source_files: priorSurface.scope.source_files.count,
      parent_abi_entries: priorSurface.scope.abi.count,
      target_groups_from_parent: Object.fromEntries(
        TARGET_GROUPS.map((group) => [
          group,
          {
            source_files: priorSurface.scope.source_files.by_group[group]?.count ?? 0,
            abi_entries: priorSurface.scope.abi.by_group[group]?.count ?? 0
          }
        ])
      )
    }
  },
  evidence_plan: {
    current_claim: "narrow_surface_inventory_only",
    behavior_parity_claimed: false,
    haxe_runtime_ownership_claimed: false,
    public_php_replacement_claimed: false,
    risk_plan: riskPlan(sourceByGroup, abiByGroup, hooksByGroup, testsByGroup),
    next: [
      "Add deterministic customizer manager/settings oracle fixture for preview/theme switch and changeset state.",
      "Add deterministic widget/sidebar plus nav-menu registry/output fixtures before installed admin gates.",
      "Add installed customize.php, widgets.php, nav-menus.php, and themes.php observations only after in-process fixtures stabilize."
    ]
  },
  validation_result: {
    status: "passed",
    source_files: source.length,
    distribution_artifacts: artifacts.length,
    abi_entries: abiEntries.length,
    hook_observations: Object.values(hooksByGroup).reduce((sum, group) => sum + group.count, 0),
    upstream_tests: tests.length,
    behavior_parity_claimed: false
  }
};

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/theme-customizer-widget-nav-surface",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "source_surface_inventory",
      name: "theme customizer, widget/sidebar, nav-menu, and admin theme surfaces",
      area: TARGET_GROUPS.join(" "),
      public_contract:
        "This inventory narrows the remaining WPHX-310 customizer/widget/nav-menu/admin-theme surface after the theme support and theme JSON gates. It does not claim behavior parity, Haxe runtime ownership, installed admin behavior, or generated public PHP replacement."
    },
    ownership_state: "inventory_only",
    ownership_axes: {
      semantic_owner: "upstream_wordpress_oracle",
      adapter_contract_owner: "not_claimed",
      emission_strategy: "not_claimed",
      execution_provider: "not_claimed",
      compatibility_evidence: "narrow_surface_inventory"
    },
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT],
    verification: {
      commands: [
        "npm run wp:core:wphx-310-theme-customizer-widget-nav-surface",
        "npm run wp:core:wphx-310-theme-customizer-widget-nav-surface:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-310-06-theme-customizer-widget-nav-surface"],
      manifest_digest: manifestSha
    }
  };
}

function receipt(manifestSha) {
  return {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-310-06-theme-customizer-widget-nav-surface",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref,
      title: ISSUE.title
    },
    recorded_at: RECORDED_AT,
    artifacts: [
      { path: OUT, role: "theme customizer/widget/nav-menu/admin surface manifest" },
      { path: OWNERSHIP, role: "surface ownership manifest" },
      { path: RUNNER, role: "deterministic surface inventory generator" }
    ],
    verification_commands: [
      "npm run wp:core:wphx-310-theme-customizer-widget-nav-surface",
      "npm run wp:core:wphx-310-theme-customizer-widget-nav-surface:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    related_receipts: [
      "receipt:wphx-310-01-themes-template-surface",
      "receipt:wphx-310-02-theme-template-adapter-contract-candidate",
      "receipt:wphx-310-03-theme-support-template-oracle-fixture",
      "receipt:wphx-310-04-theme-json-global-styles-oracle-fixture",
      "receipt:wphx-310-05-theme-json-resolver-global-styles-fixture"
    ],
    manifest_sha256: manifestSha,
    validation_result: manifest.validation_result
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
      hook_observations: manifest.validation_result.hook_observations,
      upstream_tests: tests.length
    },
    null,
    2
  )
);
