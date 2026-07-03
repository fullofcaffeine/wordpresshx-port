#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.26",
  external_ref: "WPHX-323",
  title: "PHP vendor manifest closure"
};
const RECORDED_AT = "2026-07-03T13:00:00.000Z";
const RUNNER = "tools/wp-core/run-php-vendor-manifest-closure.mjs";
const WORDPRESS_BASELINE = "manifests/upstream/wordpress-7.0-baseline.v1.json";
const LICENSE_PROVENANCE = "manifests/license-provenance.v1.json";
const SOURCE_INVENTORY = "manifests/source-inventory.jsonl";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const COPIED_SURFACE_PLAN = "manifests/wp-core/wphx-312-100-copied-surface-plan.v1.json";
const OUT = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-php-vendor-manifest-closure.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";

const PRESERVED_VENDOR_OWNER = {
  issue_id: ISSUE.id,
  external_ref: ISSUE.external_ref,
  title: ISSUE.title
};

const C3_VENDOR_REMOVAL_GATE =
  "Before replacing or claiming Haxe ownership, choose and evidence one of the PRD-approved vendor strategies: direct Haxe port preserving vendor API, behavior-compatible Haxe reimplementation over host primitives with fallback, generated wrapper around an external runtime dependency only when the official WordPress distribution has the same dependency assumption, or a renewed temporary upstream artifact exception with explicit tests and provenance.";

const BUNDLED_LIBRARY_REMOVAL_GATE =
  "Before broadening beyond preserved upstream/library code, add a source-surface inventory, API/reflection fixture where observable, license/provenance review, and either Haxe-owned implementation evidence or a generated WordPress wrapper receipt.";

const VENDOR_ENTRIES = [
  {
    id: "getid3",
    name: "getID3",
    kind: "c3_php_vendor_root",
    source_root: "wp-includes/ID3",
    artifact_root: "wp-includes/ID3",
    role: "media metadata parsing library bundled by WordPress",
    related_refs: ["WPHX-313"],
    strategy: "preserved_upstream_vendor_boundary"
  },
  {
    id: "ixr",
    name: "IXR",
    kind: "c3_php_vendor_root",
    source_root: "wp-includes/IXR",
    artifact_root: "wp-includes/IXR",
    role: "Incutio XML-RPC library classes bundled by WordPress",
    related_refs: ["WPHX-318", "WPHX-312"],
    strategy: "preserved_upstream_vendor_boundary"
  },
  {
    id: "phpmailer",
    name: "PHPMailer",
    kind: "c3_php_vendor_root",
    source_root: "wp-includes/PHPMailer",
    artifact_root: "wp-includes/PHPMailer",
    role: "mail transport library used by wp_mail and WordPress mail wrappers",
    related_refs: ["WPHX-312.13"],
    strategy: "preserved_upstream_vendor_boundary"
  },
  {
    id: "requests",
    name: "Requests",
    kind: "c3_php_vendor_root",
    source_root: "wp-includes/Requests",
    artifact_root: "wp-includes/Requests",
    role: "HTTP client library used by WP_Http and Requests bridge paths",
    related_refs: ["WPHX-312"],
    strategy: "preserved_upstream_vendor_boundary"
  },
  {
    id: "simplepie",
    name: "SimplePie",
    kind: "c3_php_vendor_root",
    source_root: "wp-includes/SimplePie",
    artifact_root: "wp-includes/SimplePie",
    role: "feed parsing library used by WordPress feed and RSS wrapper paths",
    related_refs: ["WPHX-312.37"],
    strategy: "preserved_upstream_vendor_boundary"
  },
  {
    id: "text_diff",
    name: "Text_Diff",
    kind: "c3_php_vendor_root",
    source_root: "wp-includes/Text",
    artifact_root: "wp-includes/Text",
    role: "text diff library used by WordPress diff renderers",
    related_refs: ["WPHX-315", "WPHX-316"],
    strategy: "preserved_upstream_vendor_boundary"
  },
  {
    id: "sodium_compat",
    name: "sodium_compat",
    kind: "c3_php_vendor_root",
    source_root: "wp-includes/sodium_compat",
    artifact_root: "wp-includes/sodium_compat",
    role: "Paragon Initiative sodium polyfill library bundled by WordPress",
    related_refs: ["WPHX-306", "WPHX-303"],
    strategy: "preserved_upstream_vendor_boundary"
  },
  {
    id: "tinymce_php_loader",
    name: "TinyMCE PHP loader",
    kind: "c3_php_vendor_php_loader",
    source_file: "js/_enqueues/vendor/tinymce/wp-tinymce.php",
    artifact_file: "wp-includes/js/tinymce/wp-tinymce.php",
    role: "PHP loader shipped with the TinyMCE browser vendor tree",
    related_refs: ["WPHX-609"],
    strategy: "preserved_upstream_vendor_boundary_with_browser_vendor_followup"
  },
  {
    id: "php_ai_client",
    name: "WordPress PHP AI Client",
    kind: "bundled_php_library_root",
    source_root: "wp-includes/php-ai-client",
    artifact_root: "wp-includes/php-ai-client",
    role: "bundled AI client DTO/provider/transporter library used by WordPress AI HTTP wrappers",
    related_refs: ["WPHX-312.05"],
    strategy: "temporary_upstream_library_exception_with_removal_gate"
  },
  {
    id: "php_compat",
    name: "php-compat",
    kind: "bundled_php_library_root",
    source_root: "wp-includes/php-compat",
    artifact_root: "wp-includes/php-compat",
    role: "compatibility shim library shipped under wp-includes",
    related_refs: ["WPHX-301", "WPHX-303"],
    strategy: "temporary_upstream_library_exception_with_removal_gate"
  },
  {
    id: "pomo",
    name: "POMO",
    kind: "bundled_php_library_root",
    source_root: "wp-includes/pomo",
    artifact_root: "wp-includes/pomo",
    role: "PO/MO translation parsing library used by localization code",
    related_refs: ["WPHX-301", "WPHX-315", "WPHX-316"],
    strategy: "temporary_upstream_library_exception_with_removal_gate"
  },
  {
    id: "magpie_rss",
    name: "MagpieRSS",
    kind: "legacy_php_library_file",
    source_file: "wp-includes/rss.php",
    artifact_file: "wp-includes/rss.php",
    role: "legacy MagpieRSS parser/cache/display code preserved for deprecated feed compatibility",
    related_refs: ["WPHX-312.22", "WPHX-312.23", "WPHX-312.24"],
    strategy: "temporary_upstream_library_exception_with_removal_gate"
  },
  {
    id: "pclzip",
    name: "PclZip",
    kind: "legacy_php_library_file",
    source_file: "wp-admin/includes/class-pclzip.php",
    artifact_file: "wp-admin/includes/class-pclzip.php",
    role: "legacy ZIP archive library used by upgrader/install flows",
    related_refs: ["WPHX-319"],
    strategy: "temporary_upstream_library_exception_with_removal_gate"
  },
  {
    id: "phpass",
    name: "phpass",
    kind: "legacy_php_library_file",
    source_file: "wp-includes/class-phpass.php",
    artifact_file: "wp-includes/class-phpass.php",
    role: "portable password hashing framework preserved for WordPress password compatibility",
    related_refs: ["WPHX-306"],
    strategy: "temporary_upstream_library_exception_with_removal_gate"
  },
  {
    id: "services_json",
    name: "Services_JSON",
    kind: "legacy_php_library_file",
    source_file: "wp-includes/class-json.php",
    artifact_file: "wp-includes/class-json.php",
    role: "deprecated Services_JSON compatibility library retained by WordPress",
    related_refs: ["WPHX-303", "WPHX-318"],
    strategy: "temporary_upstream_library_exception_with_removal_gate"
  },
  {
    id: "snoopy",
    name: "Snoopy",
    kind: "legacy_php_library_file",
    source_file: "wp-includes/class-snoopy.php",
    artifact_file: "wp-includes/class-snoopy.php",
    role: "deprecated Snoopy HTTP client compatibility library retained by WordPress",
    related_refs: ["WPHX-312", "WPHX-318"],
    strategy: "temporary_upstream_library_exception_with_removal_gate"
  }
];

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

function fileRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function walkFiles(root) {
  if (!existsSync(root)) return [];
  const stat = statSync(root);
  if (stat.isFile()) return [root];
  const out = [];
  for (const name of readdirSync(root).sort()) {
    const path = join(root, name);
    const child = statSync(path);
    if (child.isDirectory()) out.push(...walkFiles(path));
    else if (child.isFile()) out.push(path);
  }
  return out;
}

function sourceMatch(entry, sourcePath) {
  const full = `src/${sourcePath}`;
  return entry.path === full || entry.path.startsWith(`${full}/`);
}

function artifactMatch(entry, artifactPath) {
  return entry.path === artifactPath || entry.path.startsWith(`${artifactPath}/`);
}

function entrySourceMatches(entry, candidate) {
  if (candidate.source_root) return sourceMatch(entry, candidate.source_root);
  return entry.path === `src/${candidate.source_file}`;
}

function entryArtifactMatches(entry, candidate) {
  if (candidate.artifact_root) return artifactMatch(entry, candidate.artifact_root);
  return entry.path === candidate.artifact_file;
}

function noticeLike(path) {
  const lower = basename(path).toLowerCase();
  return lower === "license" || lower.startsWith("license.") || lower.startsWith("readme") || lower === "copying" || lower === "composer.json";
}

function sourceFilesystemPath(candidate, wpSourceRoot) {
  return join(wpSourceRoot, candidate.source_root ?? candidate.source_file);
}

function headerNoticeMarkers(files) {
  let copyright = false;
  let license = false;
  let publicDomain = false;
  for (const path of files.filter((file) => file.endsWith(".php")).slice(0, 12)) {
    const head = readFileSync(path, "utf8").split("\n").slice(0, 90).join("\n").toLowerCase();
    copyright ||= head.includes("copyright");
    license ||= head.includes("license") || head.includes("licensed");
    publicDomain ||= head.includes("public domain");
  }
  return { copyright, license, public_domain: publicDomain };
}

function inputRecord(path) {
  return fileRecord(path);
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

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) {
    const value = row[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function relativeSourceRecords(files, root) {
  return files.map((path) => {
    const rel = relative(root, path).replaceAll("\\", "/");
    return {
      path: rel,
      bytes: statSync(path).size,
      sha256: sha256File(path)
    };
  });
}

function main() {
  const failures = [];
  const wordpress = readJson(WORDPRESS_BASELINE);
  const license = readJson(LICENSE_PROVENANCE);
  const source = readJsonl(SOURCE_INVENTORY);
  const artifacts = readJsonl(ARTIFACT_PROVENANCE);
  const copiedPlan = readJson(COPIED_SURFACE_PLAN);
  const wpSourceRoot = join(wordpress.repository.relative_path, "src");
  const licenseNoticePaths = new Set(
    license.upstreams
      .find((entry) => entry.id === "upstream:wordpress-7.0.0")
      .bundled_notice_files.map((entry) => entry.path.replace(/^src\//, ""))
  );

  const preservedVendorSurfaces = copiedPlan.boundary_plan.filter((entry) => entry.primary_gate.id === "preserved_vendor");
  if (preservedVendorSurfaces.length !== 6) {
    failures.push(`expected 6 WPHX-312 preserved-vendor surfaces, found ${preservedVendorSurfaces.length}`);
  }
  for (const surface of preservedVendorSurfaces) {
    if (surface.primary_gate.owner_issue.external_ref !== "WPHX-323") {
      failures.push(`${surface.external_ref} preserved-vendor surface is not owned by WPHX-323`);
    }
  }

  const records = VENDOR_ENTRIES.map((candidate) => {
    const sourceEntries = source
      .filter((entry) => entry.baseline === "wordpress-7.0.0" && entry.language === "php" && entrySourceMatches(entry, candidate))
      .sort((a, b) => a.path.localeCompare(b.path));
    const artifactEntries = artifacts
      .filter((entry) => entry.baseline === "wordpress-7.0.0-distribution" && entry.language === "php" && entryArtifactMatches(entry, candidate))
      .sort((a, b) => a.path.localeCompare(b.path));
    const root = sourceFilesystemPath(candidate, wpSourceRoot);
    const files = walkFiles(root);
    const sourceFiles = relativeSourceRecords(files, wpSourceRoot);
    const phpSourceFiles = sourceFiles.filter((entry) => entry.path.endsWith(".php"));
    const noticeFiles = sourceFiles.filter((entry) => noticeLike(entry.path));
    const noticeRefs = noticeFiles.filter((entry) => licenseNoticePaths.has(entry.path)).map((entry) => entry.path).sort();
    const treeSha = sha256(sourceFiles.map((entry) => `${entry.path}\0${entry.sha256}`).join("\n"));
    const c3Inventory = candidate.kind.startsWith("c3_php_vendor");
    const removalGate = c3Inventory ? C3_VENDOR_REMOVAL_GATE : BUNDLED_LIBRARY_REMOVAL_GATE;
    const headerMarkers = headerNoticeMarkers(files);

    if (!existsSync(root)) failures.push(`${candidate.id} source path is missing: ${root}`);
    if (sourceEntries.length === 0) failures.push(`${candidate.id} has no PHP source-inventory entries`);
    if (artifactEntries.length === 0) failures.push(`${candidate.id} has no PHP artifact-provenance entries`);
    if (phpSourceFiles.length === 0) failures.push(`${candidate.id} has no PHP files in locked source tree`);

    return {
      id: candidate.id,
      name: candidate.name,
      kind: candidate.kind,
      source_path: candidate.source_root ?? candidate.source_file,
      distribution_path: candidate.artifact_root ?? candidate.artifact_file,
      role: candidate.role,
      strategy: candidate.strategy,
      owner_issue: PRESERVED_VENDOR_OWNER,
      related_refs: candidate.related_refs,
      source_tree: {
        file_count: sourceFiles.length,
        php_file_count: phpSourceFiles.length,
        sha256: treeSha
      },
      source_inventory: {
        count: sourceEntries.length,
        kind_counts: countBy(sourceEntries, "kind"),
        status_counts: countBy(sourceEntries, "status"),
        sample_paths: sourceEntries.slice(0, 8).map((entry) => entry.path)
      },
      distribution_artifacts: {
        count: artifactEntries.length,
        migration_status_counts: countBy(artifactEntries, "migrationStatus"),
        sample_paths: artifactEntries.slice(0, 8).map((entry) => entry.path)
      },
      license_provenance: {
        package_notice_files: noticeFiles.map((entry) => entry.path).sort(),
        notice_files_recorded_in_license_manifest: noticeRefs,
        header_notice_markers: headerMarkers,
        treatment:
          noticeRefs.length > 0
            ? "Preserve recorded package notice files plus WordPress project notice while this remains a preserved upstream artifact."
            : "No package-level notice file is recorded in the WordPress license manifest for this boundary; preserve upstream file headers and WordPress project notice, and run license/provenance review before generated replacement or distribution divergence."
      },
      c3_php_vendor_inventory: c3Inventory,
      closure_state: c3Inventory
        ? "verified_and_explicitly_excepted_as_preserved_vendor_boundary"
        : "verified_and_explicitly_excepted_as_preserved_bundled_library_boundary",
      removal_gate: removalGate,
      non_claims: [
        "This record does not claim Haxe ownership of the vendor or bundled-library implementation.",
        "This record does not claim C3 runtime parity beyond preserved upstream artifact provenance.",
        "WordPress wrappers around this boundary still need their own adapter, installed-route, or domain receipts before durable Haxe ownership claims."
      ]
    };
  });

  const c3VendorSource = source.filter((entry) => entry.baseline === "wordpress-7.0.0" && entry.language === "php" && entry.kind === "vendor_source");
  const c3VendorArtifact = artifacts.filter(
    (entry) =>
      entry.baseline === "wordpress-7.0.0-distribution" &&
      entry.language === "php" &&
      records.some((record) => record.c3_php_vendor_inventory && (entry.path === record.distribution_path || entry.path.startsWith(`${record.distribution_path}/`)))
  );
  const c3SourceCovered = c3VendorSource.filter((entry) => records.some((record) => record.c3_php_vendor_inventory && entrySourceMatches(entry, VENDOR_ENTRIES.find((candidate) => candidate.id === record.id))));
  const c3SourceUncovered = c3VendorSource.filter((entry) => !c3SourceCovered.includes(entry));
  const c3ArtifactUncovered = c3VendorArtifact.filter(
    (entry) => !records.some((record) => record.c3_php_vendor_inventory && (entry.path === record.distribution_path || entry.path.startsWith(`${record.distribution_path}/`)))
  );

  if (c3VendorSource.length !== c3SourceCovered.length) {
    failures.push(`expected all C3 PHP vendor source entries covered, found ${c3SourceCovered.length}/${c3VendorSource.length}`);
  }
  if (c3SourceUncovered.length > 0) {
    failures.push(`uncovered C3 PHP vendor source entries: ${c3SourceUncovered.slice(0, 8).map((entry) => entry.path).join(", ")}`);
  }
  if (c3VendorArtifact.length !== c3VendorSource.length) {
    failures.push(`expected C3 PHP vendor source/artifact counts to match, found source=${c3VendorSource.length} artifact=${c3VendorArtifact.length}`);
  }
  if (c3ArtifactUncovered.length > 0) {
    failures.push(`uncovered C3 PHP vendor artifacts: ${c3ArtifactUncovered.slice(0, 8).map((entry) => entry.path).join(", ")}`);
  }
  if (license.upstreams.find((entry) => entry.id === "upstream:wordpress-7.0.0").package_license !== "GPL-2.0-or-later") {
    failures.push("WordPress package license is not GPL-2.0-or-later in license provenance");
  }
  if (license.upstreams.find((entry) => entry.id === "upstream:wordpress-7.0.0").composer_license !== "GPL-2.0-or-later") {
    failures.push("WordPress composer license is not GPL-2.0-or-later in license provenance");
  }

  const manifest = {
    schema: "wphx.wp-core.php-vendor-manifest-closure.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    scope: {
      wordpress_baseline: {
        repo: wordpress.repository.relative_path,
        commit: wordpress.repository.commit,
        tag: wordpress.repository.tag,
        distribution_sha256: `sha256:${wordpress.official_distribution.computed_sha256}`
      },
      c3_php_vendor_source_entries: c3VendorSource.length,
      c3_php_vendor_distribution_artifacts: c3VendorArtifact.length,
      additional_preserved_bundled_library_boundaries: records.filter((entry) => !entry.c3_php_vendor_inventory).length,
      closure_state: "verified_and_explicitly_excepted_or_preserved_with_removal_gates"
    },
    inputs: [WORDPRESS_BASELINE, LICENSE_PROVENANCE, SOURCE_INVENTORY, ARTIFACT_PROVENANCE, COPIED_SURFACE_PLAN].map(inputRecord),
    closure_policy: {
      accepted_strategies: [
        "direct Haxe port preserving vendor API",
        "Haxe reimplementation backed by host primitive with fallback",
        "generated wrapper around an external runtime dependency only when the official WordPress distribution has the same assumption",
        "temporary upstream artifact exception with removal gate"
      ],
      current_strategy: "preserve upstream/vendor or bundled-library boundary with explicit removal gates",
      sbom_implications: [
        "The listed PHP vendor and bundled-library files remain upstream-origin artifacts in any distribution until a later port/wrapper receipt replaces them.",
        "Package-specific notice files recorded in license provenance must be preserved.",
        "Boundaries without package notice files in the WordPress distribution require header/provenance review before generated replacement or distribution divergence.",
        "Generated Haxe replacements must record source path, locked upstream commit, generator, artifact hash, and license/notice treatment before shipment."
      ],
      c3_non_claim: "C3 PHP vendor entries are closed by verified preserved-vendor exceptions and removal gates; this does not claim Haxe-authored vendor runtime logic."
    },
    vendor_boundaries: records,
    wphx_312_preserved_vendor_surfaces: preservedVendorSurfaces.map((entry) => ({
      external_ref: entry.external_ref,
      issue_id: entry.issue_id,
      unit_name: entry.unit_name,
      ownership_manifest: entry.ownership_manifest,
      primary_gate: entry.primary_gate,
      closure_state: "linked_to_wphx_323_preserved_vendor_policy"
    })),
    validation_result: {
      status: failures.length === 0 ? "passed" : "failed",
      failures,
      c3_php_vendor_source_entries: c3VendorSource.length,
      c3_php_vendor_distribution_artifacts: c3VendorArtifact.length,
      c3_php_vendor_entries_covered: c3SourceCovered.length,
      preserved_vendor_surface_count: preservedVendorSurfaces.length,
      vendor_boundary_count: records.length,
      c3_vendor_boundary_count: records.filter((entry) => entry.c3_php_vendor_inventory).length,
      additional_bundled_library_boundary_count: records.filter((entry) => !entry.c3_php_vendor_inventory).length
    },
    claims: [
      "All PHP source-inventory entries marked vendor_source for the WordPress 7.0 baseline are covered by a WPHX-323 preserved-vendor record.",
      "The corresponding WordPress 7.0 distribution PHP artifacts for those vendor boundaries are covered by WPHX-323 preserved-vendor records.",
      "Additional bundled PHP library boundaries encountered by current WordPress Core slices are verified and explicitly excepted with removal gates.",
      "The six WPHX-312 preserved-vendor copied-surface gates are linked to this closure."
    ],
    non_claims: [
      "This manifest does not claim the listed vendor or bundled-library internals are Haxe-authored.",
      "This manifest does not claim full PRD C3 runtime ownership, security parity, license legal review, or generated replacement code for vendor libraries.",
      "This manifest does not claim browser vendor internals; the TinyMCE PHP loader is only recorded here because it is a PHP vendor-source entry.",
      "This manifest does not claim WordPress wrapper files around vendor libraries are fully generated or installed-route owned."
    ]
  };

  const manifestSerialized = JSON.stringify(manifest, null, 2) + "\n";
  const manifestSha = sha256(manifestSerialized);
  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-php-vendor-manifest-closure",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "vendor_manifest_closure",
      name: "WordPress 7.0 bundled PHP vendor and library boundaries",
      area: "C3 PHP vendor source/distribution artifacts plus preserved bundled-library boundaries",
      public_contract:
        "This closure owns classification, provenance, license/SBOM implications, and removal gates for preserved PHP vendor/library artifacts. It does not own vendor implementation behavior as Haxe source."
    },
    ownership_state: "preserved_vendor_policy",
    bridge: {
      exists: true,
      kind: "preserved-upstream-vendor-and-library-boundary",
      removal_gate: C3_VENDOR_REMOVAL_GATE
    },
    owned_paths: [
      RUNNER,
      OUT,
      OWNERSHIP,
      RECEIPT,
      "docs/operations/dependent-libraries.md",
      "docs/operations/license-provenance.md",
      "docs/operations/progress-matrix.md"
    ],
    generated_paths: [OUT, OWNERSHIP, RECEIPT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-323-php-vendor-manifest",
        "npm run wp:core:wphx-323-php-vendor-manifest:check",
        "npm run license:provenance:check",
        "npm run wp:core:wphx-312-copied-surface-plan:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-323-php-vendor-manifest-closure"],
      manifest_digest: manifestSha
    }
  };
  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "receipt:wphx-323-php-vendor-manifest-closure",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: failures.length === 0 ? "passed" : "failed",
    evidence_class: "php_vendor_manifest_closure",
    artifact_scope: "wordpress_7_0_php_vendor_and_bundled_library_boundaries",
    commands: [
      "npm run wp:core:wphx-323-php-vendor-manifest",
      "npm run wp:core:wphx-323-php-vendor-manifest:check",
      "npm run license:provenance:check",
      "npm run wp:core:wphx-312-copied-surface-plan:check"
    ],
    artifacts: [
      {
        path: OUT,
        role: "machine-readable PHP vendor manifest closure"
      },
      {
        path: OWNERSHIP,
        role: "ownership manifest for preserved vendor/library policy"
      },
      {
        path: RUNNER,
        role: "deterministic generator and check-mode validator"
      },
      {
        path: LICENSE_PROVENANCE,
        role: "license/provenance input"
      },
      {
        path: COPIED_SURFACE_PLAN,
        role: "WPHX-312 preserved-vendor copied-surface input"
      }
    ],
    manifest_sha256: manifestSha,
    validation_result: manifest.validation_result,
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };

  if (failures.length > 0) {
    console.error(JSON.stringify({ status: "failed", failures }, null, 2));
    process.exit(1);
  }

  writeOrCheck(OUT, manifestSerialized);
  writeOrCheck(OWNERSHIP, JSON.stringify(ownership, null, 2) + "\n");
  writeOrCheck(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        status: "passed",
        output: OUT,
        c3_php_vendor_source_entries: c3VendorSource.length,
        c3_php_vendor_distribution_artifacts: c3VendorArtifact.length,
        vendor_boundary_count: records.length,
        preserved_vendor_surface_count: preservedVendorSurfaces.length
      },
      null,
      2
    )
  );
}

main();
