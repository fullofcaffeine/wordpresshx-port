#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.33.7",
  external_ref: "WPHX-323.29",
  title: "Add TinyMCE browser-vendor coordination gate"
};
const RECORDED_AT = "2026-07-08T21:30:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-tinymce-browser-vendor-coordination-gate.mjs";
const UPSTREAM_LOCK = "upstream.lock.json";
const PRD = "docs/prd/wordpress-haxe-port.md";
const AI_TINYMCE_GATES = "manifests/wp-core/wphx-323-07-ai-client-tinymce-vendor-gates.v1.json";
const LOADER_PRESERVED_GATE =
  "manifests/wp-core/wphx-323-28-tinymce-php-loader-preserved-exception.v1.json";
const SOURCE_INVENTORY = "manifests/source-inventory.jsonl";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const OUT = "manifests/wp-core/wphx-323-29-tinymce-browser-vendor-coordination.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-29-tinymce-browser-vendor-coordination.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-29-tinymce-browser-vendor-coordination.v1.json";

const TINYMCE_SOURCE_ROOT = "src/js/_enqueues/vendor/tinymce";
const TINYMCE_DISTRIBUTION_ROOT = "wp-includes/js/tinymce";
const TINYMCE_LOADER_SOURCE = `${TINYMCE_SOURCE_ROOT}/wp-tinymce.php`;
const TINYMCE_LOADER_DISTRIBUTION = `${TINYMCE_DISTRIBUTION_ROOT}/wp-tinymce.php`;
const REQUIRED_ASSET_RELATIVE_PATHS = [
  "wp-tinymce.php",
  "wp-tinymce.js",
  "tinymce.min.js",
  "plugins/compat3x/plugin.min.js",
  "license.txt"
];

const NON_CLAIMS = [
  "This gate records TinyMCE browser-vendor coordination for the preserved wp-tinymce.php loader; it does not claim generated loader replacement.",
  "This gate does not claim Haxe-owned TinyMCE PHP loader runtime logic.",
  "This gate does not claim TinyMCE JavaScript, CSS, font, image, browser-editor, plugin, skin, theme, package, or Gutenberg ownership.",
  "This gate does not execute real TinyMCE browser/editor behavior or installed WordPress editor flows.",
  "This gate does not retire copied or preserved upstream TinyMCE browser artifacts.",
  "This gate does not substitute TinyMCE dependencies, change WordPress script handles, or claim source-map/package-export parity.",
  "A generated loader replacement remains blocked on WPHX-609 browser-vendor manifest closure or equivalent asset ownership evidence plus the WPHX-323.28 direct-loader fixture."
];

function command(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 120
  }).trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path) {
  return readFileSync(path, "utf8")
    .trim()
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

function fileRecord(path) {
  return { path, bytes: statSync(path).size, sha256: sha256File(path) };
}

function upstreamPath(path) {
  return `${UPSTREAM_ROOT}/${path}`;
}

function upstreamFileRecord(path) {
  const full = upstreamPath(path);
  return { path, bytes: statSync(full).size, sha256: sha256File(full) };
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run without --check to generate it`);
    if (readFileSync(path, "utf8") !== content) throw new Error(`${path} is stale; run without --check to refresh it`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function currentWordPressCheckout(upstreamLock) {
  const wordpressRepo = upstreamLock.repositories.find((repo) => repo.id === "wordpress-vanilla");
  if (!wordpressRepo) throw new Error("upstream.lock.json is missing wordpress-vanilla");
  const currentCommit = command("git", ["-C", UPSTREAM_ROOT, "rev-parse", "HEAD"]);
  const currentTree = command("git", ["-C", UPSTREAM_ROOT, "rev-parse", "HEAD^{tree}"]);
  const statusText = command("git", ["-C", UPSTREAM_ROOT, "status", "--short"]);
  if (currentCommit !== wordpressRepo.git.commit) {
    throw new Error(`wordpress-develop commit drift: lock=${wordpressRepo.git.commit} actual=${currentCommit}`);
  }
  if (currentTree !== wordpressRepo.git.tree) {
    throw new Error(`wordpress-develop tree drift: lock=${wordpressRepo.git.tree} actual=${currentTree}`);
  }
  return {
    relative_path: wordpressRepo.relativePath,
    authority: wordpressRepo.authority,
    role: wordpressRepo.role,
    locked_commit: wordpressRepo.git.commit,
    locked_tree: wordpressRepo.git.tree,
    locked_tag: wordpressRepo.git.tag,
    current_commit: currentCommit,
    current_tree: currentTree,
    observed_dirty_state_from_lock: wordpressRepo.observedDirtyState,
    current_status_short: statusText ? statusText.split("\n") : []
  };
}

function listRelativeFiles(root, prefix = "") {
  const full = prefix ? `${root}/${prefix}` : root;
  return readdirSync(full, { withFileTypes: true })
    .flatMap((entry) => {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory() ? listRelativeFiles(root, path) : [path];
    })
    .sort();
}

function countBy(values, classifier) {
  return values.reduce((counts, value) => {
    const key = classifier(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function sourcePathFor(relativePath) {
  return `${TINYMCE_SOURCE_ROOT}/${relativePath}`;
}

function distributionPathFor(relativePath) {
  return `${TINYMCE_DISTRIBUTION_ROOT}/${relativePath}`;
}

function assetKind(relativePath) {
  if (relativePath === "wp-tinymce.php") return "preserved_php_loader";
  if (relativePath === "wp-tinymce.js") return "built_tinymce_bundle";
  if (relativePath === "tinymce.min.js") return "tinymce_core_minified_js";
  if (relativePath === "license.txt") return "license_notice";
  if (relativePath.startsWith("plugins/")) return "tinymce_plugin_asset";
  if (relativePath.startsWith("themes/")) return "tinymce_theme_asset";
  if (relativePath.startsWith("skins/")) return "tinymce_skin_or_font_asset";
  if (relativePath.startsWith("langs/")) return "tinymce_language_asset";
  if (relativePath.startsWith("utils/")) return "tinymce_legacy_utility_asset";
  return "tinymce_browser_vendor_asset";
}

function browserSurface(relativePath) {
  const extension = extname(relativePath);
  if (relativePath === "wp-tinymce.php") return "php_loader";
  if (extension === ".js") return "javascript";
  if (extension === ".css") return "css";
  if ([".eot", ".ttf", ".woff", ".svg"].includes(extension) && relativePath.startsWith("skins/")) return "font";
  if ([".gif", ".png", ".svg"].includes(extension)) return "image";
  if (extension === ".txt") return "notice";
  return "other";
}

function summarizePaths(paths) {
  return {
    file_count: paths.length,
    by_extension: countBy(paths, (path) => extname(path) || "(none)"),
    by_top_level: countBy(paths, (path) => (path.includes("/") ? path.split("/")[0] : "(root)")),
    by_surface: countBy(paths, browserSurface),
    by_kind: countBy(paths, assetKind)
  };
}

function sourceDistributionRecords(relativePath, sourceRows, artifactRows) {
  const sourcePath = sourcePathFor(relativePath);
  const distributionPath = distributionPathFor(relativePath);
  const sourceFullPath = upstreamPath(sourcePath);
  const existsInSourceCheckout = existsSync(sourceFullPath);
  const sourceInventoryRecord = sourceRows.find((row) => row.path === sourcePath) ?? null;
  const distributionArtifactRecord = artifactRows.find((row) => row.path === distributionPath) ?? null;
  return {
    relative_path: relativePath,
    kind: assetKind(relativePath),
    browser_surface: browserSurface(relativePath),
    source_path: sourcePath,
    distribution_path: distributionPath,
    exists_in_wordpress_develop_source: existsInSourceCheckout,
    exists_in_source_inventory: sourceInventoryRecord !== null,
    exists_in_distribution_provenance: distributionArtifactRecord !== null,
    source_file: existsInSourceCheckout ? upstreamFileRecord(sourcePath) : null,
    source_inventory_record: sourceInventoryRecord,
    distribution_artifact_provenance_record: distributionArtifactRecord,
    source_to_distribution_contract:
      relativePath === "wp-tinymce.js"
        ? "distribution build artifact; absent from wordpress-develop source tree and must be supplied only by a verified build/provenance contract"
        : "source-relative TinyMCE asset maps to wp-includes/js/tinymce with the same relative path"
  };
}

function prdWphx609Context() {
  const lines = readFileSync(PRD, "utf8").split("\n");
  const taskLineIndex = lines.findIndex((line) => line.includes("| WPHX-609 |"));
  const worksetLineIndex = lines.findIndex((line) => line.includes("ws:browser-vendors"));
  if (taskLineIndex === -1) throw new Error("PRD is missing WPHX-609");
  if (worksetLineIndex === -1) throw new Error("PRD is missing ws:browser-vendors");
  return {
    task: {
      id: "WPHX-609",
      title: "Browser vendor manifest closure",
      dependency: "WPHX-607",
      acceptance: "C3 browser portion verified",
      source: {
        path: PRD,
        line: taskLineIndex + 1,
        text: lines[taskLineIndex]
      }
    },
    workset: {
      id: "ws:browser-vendors",
      source: {
        path: PRD,
        line: worksetLineIndex + 1,
        text: lines[worksetLineIndex]
      }
    }
  };
}

function validatePriorGate(loaderPreservedGate) {
  const validation = loaderPreservedGate.validation_result ?? {};
  const failures = [];
  if (validation.status !== "passed") failures.push("WPHX-323.28 validation did not pass");
  if (validation.source_path_request_count !== 6) failures.push("WPHX-323.28 source-path request count changed");
  if (validation.distribution_path_request_count !== 6) {
    failures.push("WPHX-323.28 distribution-path request count changed");
  }
  if (validation.warning_leakage_count !== 0) failures.push("WPHX-323.28 warning leakage is nonzero");
  if (validation.header_failure_count !== 0) failures.push("WPHX-323.28 header failures are nonzero");
  if (validation.tinymce_browser_runtime_claimed !== false) {
    failures.push("WPHX-323.28 unexpectedly claims TinyMCE browser runtime");
  }
  if (validation.tinymce_js_css_font_editor_ownership_claimed !== false) {
    failures.push("WPHX-323.28 unexpectedly claims TinyMCE JS/CSS/font/editor ownership");
  }
  return failures;
}

function validateRequiredAssets(requiredAssets) {
  const failures = [];
  const expected = {
    "wp-tinymce.php": { source: true, sourceInventory: true, distribution: true },
    "wp-tinymce.js": { source: false, sourceInventory: false, distribution: true },
    "tinymce.min.js": { source: true, sourceInventory: true, distribution: true },
    "plugins/compat3x/plugin.min.js": { source: true, sourceInventory: true, distribution: true },
    "license.txt": { source: true, sourceInventory: false, distribution: false }
  };
  for (const asset of requiredAssets) {
    const assetExpectation = expected[asset.relative_path];
    if (!assetExpectation) continue;
    if (asset.exists_in_wordpress_develop_source !== assetExpectation.source) {
      failures.push(`${asset.relative_path} source existence changed`);
    }
    if (asset.exists_in_source_inventory !== assetExpectation.sourceInventory) {
      failures.push(`${asset.relative_path} source inventory presence changed`);
    }
    if (asset.exists_in_distribution_provenance !== assetExpectation.distribution) {
      failures.push(`${asset.relative_path} distribution provenance presence changed`);
    }
  }
  return failures;
}

function main() {
  const upstreamLock = readJson(UPSTREAM_LOCK);
  const wordpressCheckout = currentWordPressCheckout(upstreamLock);
  const aiTinymceGate = readJson(AI_TINYMCE_GATES);
  const loaderPreservedGate = readJson(LOADER_PRESERVED_GATE);
  const sourceRows = readJsonl(SOURCE_INVENTORY).filter((row) => row.path?.startsWith(`${TINYMCE_SOURCE_ROOT}/`));
  const artifactRows = readJsonl(ARTIFACT_PROVENANCE).filter((row) =>
    row.path?.startsWith(`${TINYMCE_DISTRIBUTION_ROOT}/`)
  );
  const sourceFiles = listRelativeFiles(upstreamPath(TINYMCE_SOURCE_ROOT));
  const sourcePaths = sourceFiles.map(sourcePathFor);
  const distributionPaths = artifactRows.map((row) => row.path);
  const requiredAssets = REQUIRED_ASSET_RELATIVE_PATHS.map((path) =>
    sourceDistributionRecords(path, sourceRows, artifactRows)
  );
  const sourcePathsWithoutDistributionProvenance = sourcePaths
    .filter((path) => {
      const relativePath = path.slice(`${TINYMCE_SOURCE_ROOT}/`.length);
      return !artifactRows.some((row) => row.path === distributionPathFor(relativePath));
    })
    .sort();
  const distributionProvenanceWithoutSourcePath = distributionPaths
    .filter((path) => {
      const relativePath = path.slice(`${TINYMCE_DISTRIBUTION_ROOT}/`.length);
      return !existsSync(upstreamPath(sourcePathFor(relativePath)));
    })
    .sort();

  const priorGateFailures = validatePriorGate(loaderPreservedGate);
  const requiredAssetFailures = validateRequiredAssets(requiredAssets);
  const sourceInventoryMissingCount = sourceFiles.filter(
    (path) => !sourceRows.some((row) => row.path === sourcePathFor(path))
  ).length;
  const validationFailures = [
    ...priorGateFailures,
    ...requiredAssetFailures,
    ...(sourceFiles.length === 0 ? ["TinyMCE source tree is empty"] : []),
    ...(artifactRows.length === 0 ? ["TinyMCE distribution artifact provenance is empty"] : []),
    ...(sourceInventoryMissingCount > 33
      ? [`TinyMCE source inventory missing count exceeded expected generated/vendor-suppressed range: ${sourceInventoryMissingCount}`]
      : [])
  ];

  if (validationFailures.length > 0) {
    throw new Error(`TinyMCE browser-vendor coordination gate failed: ${JSON.stringify(validationFailures, null, 2)}`);
  }

  const prdContext = prdWphx609Context();
  const validationResult = {
    status: "passed",
    wordpress_oracle_locked_commit: wordpressCheckout.current_commit,
    tinymce_source_file_count: sourceFiles.length,
    tinymce_source_inventory_record_count: sourceRows.length,
    tinymce_distribution_artifact_record_count: artifactRows.length,
    source_inventory_missing_count: sourceInventoryMissingCount,
    source_paths_without_distribution_provenance_record_count: sourcePathsWithoutDistributionProvenance.length,
    distribution_provenance_records_without_source_path_count: distributionProvenanceWithoutSourcePath.length,
    required_asset_contract_count: requiredAssets.length,
    wphx_323_28_gate_validated: true,
    wphx_609_prd_task_present: true,
    browser_vendor_workset_present: true,
    asset_path_hash_contract_recorded: true,
    script_resource_path_contract_recorded: true,
    browser_vendor_coordination_recorded: true,
    generated_loader_replacement_conditions_recorded: true,
    generated_public_php_replacement_claimed: false,
    haxe_owned_tinymce_loader_runtime_claimed: false,
    tinymce_browser_runtime_claimed: false,
    tinymce_js_css_font_editor_ownership_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false
  };

  const generatedLoaderReplacementConditions = [
    "A generated direct-script adapter must pass the WPHX-323.28 direct HTTP loader fixture at both src/js/_enqueues/vendor/tinymce/wp-tinymce.php and wp-includes/js/tinymce/wp-tinymce.php.",
    "WPHX-609 browser-vendor manifest closure, or an equivalent accepted browser-vendor asset ownership gate, must record TinyMCE JS/CSS/font/image/plugin/theme/skin paths, hashes, provenance, licenses, build-only artifacts, and script/resource handles.",
    "The generated loader must consume the same asset contract recorded here: wp-tinymce.js is a distribution-only build artifact in the current evidence, while tinymce.min.js and plugins/compat3x/plugin.min.js are source/distribution fallback assets.",
    "If wp-tinymce.js remains absent from the source oracle, generated loader evidence must continue to preserve c=1 fallback behavior and missing-file warning suppression.",
    "Replacement evidence must keep TinyMCE browser/editor/package behavior non-owned unless separate WPHX-609-style browser gates claim it with executable browser/package evidence.",
    "Any path, hash, script-handle, source-map, package-export, or license/provenance drift must be recorded before replacing or retiring preserved upstream TinyMCE artifacts."
  ];

  const manifest = {
    schema: "wphx.wp-core.tinymce-browser-vendor-coordination.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "tinymce_browser_vendor_coordination_gate",
    behavior_parity_claimed: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_tinymce_loader_runtime_claimed: false,
    tinymce_browser_runtime_claimed: false,
    tinymce_js_css_font_editor_ownership_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false,
    inputs: {
      runner: fileRecord(RUNNER),
      upstream_lock: fileRecord(UPSTREAM_LOCK),
      product_requirements: fileRecord(PRD),
      ai_tinymce_gate_manifest: fileRecord(AI_TINYMCE_GATES),
      loader_preserved_exception_manifest: fileRecord(LOADER_PRESERVED_GATE),
      source_inventory: fileRecord(SOURCE_INVENTORY),
      artifact_provenance: fileRecord(ARTIFACT_PROVENANCE)
    },
    upstream_authority: wordpressCheckout,
    prior_gate_context: {
      ai_tinymce_gate: {
        issue: aiTinymceGate.issue,
        evidence_class: aiTinymceGate.evidence_class,
        tinymce_loader_preserved_exception_renewed:
          aiTinymceGate.validation_result?.tinymce_loader_preserved_exception_renewed ?? true,
        tinymce_loader_requirements:
          aiTinymceGate.source_surfaces?.tinymce_php_loader?.minimized_fixture_requirements ?? []
      },
      loader_preserved_exception_gate: {
        issue: loaderPreservedGate.issue,
        evidence_class: loaderPreservedGate.evidence_class,
        validation_result: loaderPreservedGate.validation_result
      },
      prd_browser_vendor_closure: prdContext
    },
    tinymce_browser_vendor_tree: {
      source_root: TINYMCE_SOURCE_ROOT,
      distribution_root: TINYMCE_DISTRIBUTION_ROOT,
      source_tree: {
        root: upstreamPath(TINYMCE_SOURCE_ROOT),
        summary: summarizePaths(sourceFiles),
        files: sourceFiles.map((relativePath) => ({
          relative_path: relativePath,
          source_path: sourcePathFor(relativePath),
          distribution_path: distributionPathFor(relativePath),
          kind: assetKind(relativePath),
          browser_surface: browserSurface(relativePath),
          bytes: statSync(upstreamPath(sourcePathFor(relativePath))).size,
          sha256: sha256File(upstreamPath(sourcePathFor(relativePath)))
        }))
      },
      source_inventory: {
        record_count: sourceRows.length,
        records_by_surface: countBy(sourceRows, (row) => browserSurface(row.path.slice(`${TINYMCE_SOURCE_ROOT}/`.length))),
        records_by_language: countBy(sourceRows, (row) => row.language ?? "unknown"),
        missing_source_tree_record_count: sourceInventoryMissingCount,
        note:
          "The source inventory currently records executable/source TinyMCE units, while several CSS/font/image/browser assets are tracked here from the upstream tree for WPHX-609-style browser-vendor closure."
      },
      distribution_artifacts: {
        record_count: artifactRows.length,
        records_by_surface: countBy(artifactRows, (row) =>
          browserSurface(row.path.slice(`${TINYMCE_DISTRIBUTION_ROOT}/`.length))
        ),
        records_by_language: countBy(artifactRows, (row) => row.language ?? "unknown"),
        migration_status_counts: countBy(artifactRows, (row) => row.migrationStatus ?? "unknown")
      },
      source_paths_without_distribution_provenance_record: sourcePathsWithoutDistributionProvenance,
      distribution_provenance_records_without_source_path: distributionProvenanceWithoutSourcePath
    },
    asset_path_hash_contract: {
      required_assets: requiredAssets,
      source_to_distribution_mapping:
        "For source-tree TinyMCE assets, src/js/_enqueues/vendor/tinymce/<relative> maps to wp-includes/js/tinymce/<relative>. wp-tinymce.js is currently distribution-only provenance and must be treated as a build artifact until WPHX-609-style evidence records its source/build contract.",
      loader_paths: {
        source: TINYMCE_LOADER_SOURCE,
        distribution: TINYMCE_LOADER_DISTRIBUTION,
        source_record: upstreamFileRecord(TINYMCE_LOADER_SOURCE)
      },
      fallback_runtime_assets: [
        "wp-includes/js/tinymce/wp-tinymce.js",
        "wp-includes/js/tinymce/tinymce.min.js",
        "wp-includes/js/tinymce/plugins/compat3x/plugin.min.js"
      ]
    },
    script_resource_path_contract: {
      php_loader_direct_script_paths: [TINYMCE_LOADER_SOURCE, TINYMCE_LOADER_DISTRIBUTION],
      browser_resource_root_contract: {
        source_root: TINYMCE_SOURCE_ROOT,
        distribution_root: TINYMCE_DISTRIBUTION_ROOT,
        relative_path_preservation_required: true
      },
      wordpress_script_handle_coordination_required: true,
      required_future_evidence: [
        "WordPress script-loader/resource handle inventory for TinyMCE and adjacent editor handles.",
        "Distribution/source asset path and hash closure including build-only wp-tinymce.js.",
        "License and notice treatment for TinyMCE browser assets and bundled skins/fonts/images.",
        "Source-map, minified/source relationship, package export, and global object contracts where present.",
        "Browser/editor executable parity gates before any TinyMCE JS/CSS/font/editor ownership claim."
      ]
    },
    browser_vendor_coordination: {
      task_dependency: {
        external_ref: "WPHX-609",
        state: "required_before_generated_loader_replacement_claim_can_broaden",
        prd_context: prdContext.task
      },
      workset: prdContext.workset,
      wphx_609_style_gate_requirements: [
        "Inventory all TinyMCE browser vendor JS/CSS/font/image/plugin/theme/skin artifacts in source and distribution paths.",
        "Record path/hash/provenance/license contracts for source assets and distribution-only build artifacts.",
        "Reconcile WordPress script/resource handle registration and loader path behavior with the PHP direct-loader gate.",
        "Keep browser package/editor behavior ownership separate from the PHP loader boundary until executable browser gates pass.",
        "Document copied/preserved artifact retirement blockers for every TinyMCE browser asset class."
      ]
    },
    generated_loader_replacement_conditions: generatedLoaderReplacementConditions,
    validation_result: validationResult,
    claims: [
      "TinyMCE wp-tinymce.php remains linked to a browser-vendor asset contract rather than a standalone PHP ownership claim.",
      "The gate records source/distribution path and hash contracts for the loader, tinymce.min.js, compat3x fallback asset, license notice, and distribution-only wp-tinymce.js.",
      "Generated loader replacement is blocked on both the WPHX-323.28 direct-loader fixture and WPHX-609-style browser-vendor asset ownership evidence."
    ],
    non_claims: NON_CLAIMS
  };

  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestContent);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-29-tinymce-browser-vendor-coordination",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    unit: {
      kind: "coordination_gate",
      name: "TinyMCE browser-vendor coordination gate for wp-tinymce.php",
      area: `${TINYMCE_SOURCE_ROOT} and ${TINYMCE_DISTRIBUTION_ROOT}`,
      public_contract:
        "The preserved TinyMCE PHP loader cannot be replaced or broadened into ownership until browser-vendor asset path/hash, script/resource, and WPHX-609-style gates agree on the TinyMCE browser asset contract."
    },
    ownership_state: "browser_vendor_coordination_gate",
    bridge: {
      exists: true,
      kind: "preserved-upstream-browser-vendor-coordination-with-loader-replacement-blockers",
      removal_gate: generatedLoaderReplacementConditions.join(" ")
    },
    behavior_parity_claimed: false,
    public_php_replacement_claimed: false,
    haxe_owned_tinymce_loader_runtime_claimed: false,
    tinymce_browser_runtime_claimed: false,
    tinymce_js_css_font_editor_ownership_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false,
    owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT],
    preserved_paths: [TINYMCE_LOADER_SOURCE, TINYMCE_LOADER_DISTRIBUTION, TINYMCE_SOURCE_ROOT, TINYMCE_DISTRIBUTION_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-323-tinymce-browser-vendor-coordination",
        "npm run wp:core:wphx-323-tinymce-browser-vendor-coordination:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-323-29-tinymce-browser-vendor-coordination"],
      manifest_digest: sha256(manifestContent)
    },
    non_claims: NON_CLAIMS
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-29-tinymce-browser-vendor-coordination",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: manifest.evidence_class,
    artifact_scope: "wordpress-7.0-tinymce-browser-vendor-coordination",
    commands: [
      "npm run wp:core:wphx-323-tinymce-browser-vendor-coordination",
      "npm run wp:core:wphx-323-tinymce-browser-vendor-coordination:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      ai_tinymce_gate_manifest: AI_TINYMCE_GATES,
      loader_preserved_exception_manifest: LOADER_PRESERVED_GATE
    },
    manifest_sha256: sha256(manifestContent),
    validation_result: validationResult,
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };
  writeOrCheck(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);

  return manifest;
}

try {
  const manifest = main();
  console.log(
    JSON.stringify(
      {
        ok: true,
        check: checkOnly,
        manifest: OUT,
        receipt: RECEIPT,
        tinymce_source_file_count: manifest.validation_result.tinymce_source_file_count,
        distribution_artifact_record_count: manifest.validation_result.tinymce_distribution_artifact_record_count,
        source_paths_without_distribution_provenance_record_count:
          manifest.validation_result.source_paths_without_distribution_provenance_record_count,
        distribution_provenance_records_without_source_path_count:
          manifest.validation_result.distribution_provenance_records_without_source_path_count,
        wphx_323_28_gate_validated: manifest.validation_result.wphx_323_28_gate_validated,
        wphx_609_prd_task_present: manifest.validation_result.wphx_609_prd_task_present,
        tinymce_browser_runtime_claimed: manifest.validation_result.tinymce_browser_runtime_claimed
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
}
