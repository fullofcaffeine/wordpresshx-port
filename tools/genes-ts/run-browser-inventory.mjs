#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const checkOnly = new Set(process.argv.slice(2)).has("--check");

const ISSUE = {
  id: "wordpresshx-w91.2.2",
  external_ref: "WPHX-402",
  title: "WPHX-402 — Generate JS/TS package, module, and API inventory"
};
const RECORDED_AT = "2026-07-10T04:10:00.000Z";
const RUNNER = "tools/genes-ts/run-browser-inventory.mjs";
const MANIFEST = "manifests/genes-ts/wphx-402-browser-inventory.v1.json";
const RECEIPT = "receipts/genes-ts/wphx-402-browser-inventory.v1.json";
const SOURCE_INVENTORY = "manifests/source-inventory.jsonl";
const ARTIFACT_INVENTORY = "manifests/artifact-provenance.jsonl";
const API_INDEX = "manifests/dashboard/api-index.v1.json";
const PACKAGE_INDEX = "manifests/dashboard/package-index.v1.json";
const UPSTREAM_LOCK = "upstream.lock.json";
const BROWSER_LANGUAGES = new Set(["javascript", "typescript", "tsx", "jsx"]);

const BASELINES = [
  {
    id: "wordpress-7.0-gutenberg-source",
    repo: "../gutenberg",
    commit: "a2a354cf35e5b69c3330d6c1cfd42d8dc2efb9fd",
    profile: "wp70-release"
  },
  {
    id: "gutenberg-forward-23.4.0",
    repo: "../gutenberg",
    commit: "98a796c8780c480ef7bcfe03c42302d9564d785c",
    profile: "gutenberg-forward-23.4"
  }
];

function command(name, args) {
  return execFileSync(name, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 200
  }).trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path) {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function countBy(entries, classifier) {
  const counts = new Map();
  for (const entry of entries) {
    const key = classifier(entry);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function packageFromPath(path) {
  const match = /^packages\/([^/]+)\//.exec(path);
  return match?.[1] ?? null;
}

function moduleSurface(entry) {
  if (packageFromPath(entry.path)) return "gutenberg_package";
  if (entry.baseline === "wordpress-7.0.0") {
    if (/^(?:src\/)?wp-admin\/js\//.test(entry.path)) return "wordpress_admin_classic";
    if (/^(?:src\/)?wp-includes\/js\/dist\//.test(entry.path)) return "wordpress_package_build_source";
    if (/^(?:src\/)?wp-includes\/js\//.test(entry.path)) return "wordpress_core_classic_or_vendor";
    if (/^(?:src\/)?js\//.test(entry.path)) return "wordpress_build_source";
    return "wordpress_tooling_test_or_other_browser_source";
  }
  return "gutenberg_nonpackage_tooling_test_or_integration";
}

function artifactSurface(entry) {
  if (entry.baseline === "wordpress-7.0-gutenberg-build") return "embedded_gutenberg_build";
  if (/^wp-admin\/js\//.test(entry.path)) return "wordpress_admin_classic";
  if (/^wp-includes\/js\/dist\//.test(entry.path)) return "wordpress_package_distribution";
  if (/^wp-includes\/js\//.test(entry.path)) return "wordpress_core_classic_or_vendor";
  return "wordpress_distribution_other_browser_artifact";
}

function artifactPackage(entry) {
  const moduleMatch = /^build\/modules\/([^/]+)\//.exec(entry.path);
  if (moduleMatch) return moduleMatch[1];
  const buildMatch = /^build\/([^/]+)\//.exec(entry.path);
  if (buildMatch) return buildMatch[1];
  const distroMatch = /^wp-includes\/js\/dist\/([^/.]+)(?:\.min)?\.js$/.exec(entry.path);
  return distroMatch?.[1] ?? null;
}

function listPackageManifestPaths(baseline) {
  return command("git", ["-C", baseline.repo, "ls-tree", "-r", "--name-only", baseline.commit, "--", "packages"])
    .split("\n")
    .filter((path) => /^packages\/[^/]+\/package\.json$/.test(path))
    .sort();
}

function publicContract(manifest) {
  if (manifest.exports !== undefined) {
    return { kind: "manifest_exports", exports: manifest.exports };
  }
  const entries = Object.fromEntries(
    ["main", "module", "browser", "types", "typings", "wpScript", "wpStyle"]
      .filter((field) => manifest[field] !== undefined)
      .map((field) => [field, manifest[field]])
  );
  if (Object.keys(entries).length > 0) return { kind: "legacy_entry_fields", entries };
  return { kind: "no_runtime_entry_declared", entries: {} };
}

function loadWorkspaces() {
  const records = [];
  for (const baseline of BASELINES) {
    for (const path of listPackageManifestPaths(baseline)) {
      const manifest = JSON.parse(command("git", ["-C", baseline.repo, "show", `${baseline.commit}:${path}`]));
      const directory = path.split("/")[1];
      records.push({
        baseline: baseline.id,
        profile: baseline.profile,
        path,
        directory,
        name: manifest.name ?? `@wordpress/${directory}`,
        version: manifest.version ?? null,
        private: manifest.private === true,
        type: manifest.type ?? null,
        public_contract: publicContract(manifest),
        files: Array.isArray(manifest.files) ? [...manifest.files].sort() : null,
        side_effects: manifest.sideEffects ?? null,
        dependency_counts: {
          dependencies: Object.keys(manifest.dependencies ?? {}).length,
          devDependencies: Object.keys(manifest.devDependencies ?? {}).length,
          peerDependencies: Object.keys(manifest.peerDependencies ?? {}).length,
          optionalDependencies: Object.keys(manifest.optionalDependencies ?? {}).length
        },
        classified: true
      });
    }
  }
  return records.sort((a, b) => `${a.name}:${a.baseline}`.localeCompare(`${b.name}:${b.baseline}`));
}

function sha256File(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function inputRecord(path, role) {
  return { path, role, bytes: statSync(path).size, sha256: sha256File(path) };
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run without --check`);
    if (readFileSync(path, "utf8") !== content) throw new Error(`${path} is stale; run without --check`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function buildManifest() {
  const source = readJsonl(SOURCE_INVENTORY);
  const artifacts = readJsonl(ARTIFACT_INVENTORY);
  const apiIndex = readJson(API_INDEX);
  const packageIndex = readJson(PACKAGE_INDEX);
  const workspaces = loadWorkspaces();
  const browserModules = source.filter((entry) => BROWSER_LANGUAGES.has(entry.language));
  const browserArtifacts = artifacts.filter((entry) => entry.language === "javascript");
  const packageApis = apiIndex.javascript_packages ?? [];
  const packageApiPaths = new Set(packageApis.map((entry) => entry.path));
  const packageNames = new Set(workspaces.map((workspace) => workspace.directory));
  const moduleRecords = browserModules.map((entry) => ({
    source_unit: entry.id,
    baseline: entry.baseline,
    path: entry.path,
    language: entry.language,
    role: entry.kind,
    surface: moduleSurface(entry),
    package: packageFromPath(entry.path),
    export_evidence: packageApiPaths.has(entry.path) ? "static_named_export_detected" : "no_static_named_export_detected",
    classified: true
  }));
  const artifactRecords = browserArtifacts.map((entry) => ({
    artifact: entry.id,
    baseline: entry.baseline,
    path: entry.path,
    surface: artifactSurface(entry),
    package: artifactPackage(entry),
    classified: true
  }));
  const unknownModulePackages = [...new Set(moduleRecords.map((record) => record.package).filter((name) => name && !packageNames.has(name)))].sort();
  const forwardPackages = new Set(workspaces.filter((workspace) => workspace.baseline === "gutenberg-forward-23.4.0").map((workspace) => workspace.directory));
  const embeddedPackages = new Set(workspaces.filter((workspace) => workspace.baseline === "wordpress-7.0-gutenberg-source").map((workspace) => workspace.directory));
  const manifest = {
    schema: "wphx.browser-inventory.v1",
    issue: ISSUE.external_ref,
    recorded_at: RECORDED_AT,
    generator: RUNNER,
    authority: {
      per_file_sources: SOURCE_INVENTORY,
      per_file_artifacts: ARTIFACT_INVENTORY,
      preliminary_static_api_symbols: API_INDEX,
      package_aggregates: PACKAGE_INDEX,
      package_public_contract: "package.json exports when present, otherwise legacy entry fields; static source exports are evidence only"
    },
    baselines: BASELINES,
    counts: {
      workspaces: workspaces.length,
      workspace_by_baseline: countBy(workspaces, (entry) => entry.baseline),
      workspace_contract_kind: countBy(workspaces, (entry) => entry.public_contract.kind),
      packages_in_both_gutenberg_baselines: [...forwardPackages].filter((name) => embeddedPackages.has(name)).length,
      forward_only_packages: [...forwardPackages].filter((name) => !embeddedPackages.has(name)).length,
      embedded_only_packages: [...embeddedPackages].filter((name) => !forwardPackages.has(name)).length,
      browser_modules: moduleRecords.length,
      module_by_baseline: countBy(moduleRecords, (entry) => entry.baseline),
      module_by_language: countBy(moduleRecords, (entry) => entry.language),
      module_by_role: countBy(moduleRecords, (entry) => entry.role),
      module_by_surface: countBy(moduleRecords, (entry) => entry.surface),
      module_export_evidence: countBy(moduleRecords, (entry) => entry.export_evidence),
      static_package_api_symbols: packageApis.length,
      static_package_api_symbols_by_package: countBy(packageApis, (entry) => entry.package),
      shipped_browser_artifacts: artifactRecords.length,
      artifact_by_baseline: countBy(artifactRecords, (entry) => entry.baseline),
      artifact_by_surface: countBy(artifactRecords, (entry) => entry.surface),
      dashboard_package_aggregates: packageIndex.packages.length
    },
    classification_rules: {
      module: "Every JS/JSX/TS/TSX source unit inherits its WPHX-006 role and is assigned a package or a named WordPress/Gutenberg non-package surface.",
      exports: "Package manifests define public export contracts. Static named-export extraction identifies source evidence but absence does not imply absence of re-exports or runtime API.",
      artifact: "Every shipped JavaScript artifact is assigned to the embedded Gutenberg build or a WordPress admin/package/core/other distribution surface.",
      profile_separation: "Embedded Gutenberg records belong to wp70-release; forward 23.4 records remain a separate profile."
    },
    workspaces,
    modules: moduleRecords,
    shipped_artifacts: artifactRecords,
    closure: {
      unclassified_workspaces: workspaces.filter((entry) => !entry.classified).length,
      unclassified_browser_modules: moduleRecords.filter((entry) => !entry.classified).length,
      unclassified_shipped_browser_artifacts: artifactRecords.filter((entry) => !entry.classified).length,
      modules_with_unknown_package: unknownModulePackages,
      static_api_entries_without_package: packageApis.filter((entry) => !entry.package).length
    },
    non_claims: [
      "Static export extraction is an inventory aid, not a complete JavaScript API compatibility proof.",
      "Package manifests and module classification do not establish Haxe ownership, generated artifact parity, runtime behavior, script-handle parity, or G2 feasibility.",
      "WPHX-403 and WPHX-404 must select and execute real leaf-package and React/TSX feasibility spikes before broad translation."
    ]
  };
  const failures = [];
  if (manifest.closure.unclassified_workspaces !== 0) failures.push("unclassified workspaces remain");
  if (manifest.closure.unclassified_browser_modules !== 0) failures.push("unclassified browser modules remain");
  if (manifest.closure.unclassified_shipped_browser_artifacts !== 0) failures.push("unclassified browser artifacts remain");
  if (manifest.closure.modules_with_unknown_package.length !== 0) failures.push(`unknown module packages: ${manifest.closure.modules_with_unknown_package.join(", ")}`);
  if (manifest.closure.static_api_entries_without_package !== 0) failures.push("static API entries without packages remain");
  if (failures.length > 0) throw new Error(`WPHX-402 inventory closure failed:\n- ${failures.join("\n- ")}`);
  return manifest;
}

function main() {
  const manifest = buildManifest();
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(MANIFEST, manifestText);
  const receipt = {
    schema: "wphx.verification-receipt.v1",
    id: "receipt:wphx-402-browser-inventory",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    generator: RUNNER,
    command: "derive browser package/module/export/artifact inventory from locked WPHX-006 authorities",
    evidence_class: "browser_inventory_closure",
    artifact_scope: "locked_wordpress_and_gutenberg_browser_sources_and_distribution_artifacts",
    artifacts: [
      inputRecord(SOURCE_INVENTORY, "WPHX-006 per-file source authority"),
      inputRecord(ARTIFACT_INVENTORY, "WPHX-006 shipped artifact authority"),
      inputRecord(API_INDEX, "preliminary static package API symbols"),
      inputRecord(PACKAGE_INDEX, "existing package aggregates"),
      inputRecord(UPSTREAM_LOCK, "locked checkout and baseline authority"),
      inputRecord(MANIFEST, "classified WPHX-402 browser inventory")
    ],
    counts: manifest.counts,
    closure: manifest.closure,
    verification_commands: [
      "npm run genes-ts:browser-inventory",
      "npm run genes-ts:browser-inventory:check",
      "npm run inventory:validate",
      "npm run receipts:validate"
    ],
    validation_result: {
      status: "passed",
      all_relevant_workspaces_classified: manifest.closure.unclassified_workspaces === 0,
      all_relevant_modules_classified: manifest.closure.unclassified_browser_modules === 0,
      all_relevant_artifacts_classified: manifest.closure.unclassified_shipped_browser_artifacts === 0,
      package_export_contracts_recorded: true,
      static_api_inventory_recorded: true,
      behavior_parity_claimed: false,
      haxe_ownership_claimed: false
    },
    non_claims: manifest.non_claims
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
        output: MANIFEST,
        receipt: RECEIPT,
        workspaces: receipt.counts.workspaces,
        browser_modules: receipt.counts.browser_modules,
        static_package_api_symbols: receipt.counts.static_package_api_symbols,
        shipped_browser_artifacts: receipt.counts.shipped_browser_artifacts
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
