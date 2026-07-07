#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.37",
  external_ref: "WPHX-323.17",
  title: "Add feed vendor provenance and replacement decision gate"
};
const RECORDED_AT = "2026-07-08T04:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-feed-vendor-provenance-decision-gate.mjs";
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const FEED_GATES = "manifests/wp-core/wphx-323-04-feed-vendor-replacement-gates.v1.json";
const SIMPLEPIE_API = "manifests/wp-core/wphx-323-14-simplepie-api-reflection-corpus-fixture.v1.json";
const SIMPLEPIE_WRAPPER = "manifests/wp-core/wphx-323-15-simplepie-wrapper-cache-transport-gate.v1.json";
const MAGPIE_EXCEPTION = "manifests/wp-core/wphx-323-16-magpie-rss-legacy-exception-gate.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const LICENSE_PROVENANCE = "manifests/license-provenance.v1.json";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const OUT = "manifests/wp-core/wphx-323-17-feed-vendor-provenance-decision-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-17-feed-vendor-provenance-decision-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-17-feed-vendor-provenance-decision-gate.v1.json";

const SIMPLEPIE_ROOT = "src/wp-includes/SimplePie";
const MAGPIE_FILES = ["src/wp-includes/rss.php", "src/wp-includes/rss-functions.php"];
const WORDPRESS_FEED_SUPPORT_FILES = [
  "src/wp-includes/feed.php",
  "src/wp-includes/class-simplepie.php",
  "src/wp-includes/class-feed.php",
  "src/wp-includes/class-wp-feed-cache.php",
  "src/wp-includes/class-wp-feed-cache-transient.php",
  "src/wp-includes/class-wp-simplepie-file.php",
  "src/wp-includes/class-wp-simplepie-sanitize-kses.php"
];
const REQUIRED_PRIOR_GATES = [
  {
    id: "wphx-323-14-simplepie-api-reflection-corpus-fixture",
    manifest: SIMPLEPIE_API,
    expected_external_ref: "WPHX-323.14",
    role: "SimplePie API/reflection and feed corpus floor"
  },
  {
    id: "wphx-323-15-simplepie-wrapper-cache-transport-gate",
    manifest: SIMPLEPIE_WRAPPER,
    expected_external_ref: "WPHX-323.15",
    role: "WordPress SimplePie wrapper/cache/transport floor"
  },
  {
    id: "wphx-323-16-magpie-rss-legacy-exception-gate",
    manifest: MAGPIE_EXCEPTION,
    expected_external_ref: "WPHX-323.16",
    role: "MagpieRSS legacy exception and caller-pressure floor"
  }
];
const REQUIRED_REPLACEMENT_EVIDENCE = [
  "non-empty generated candidate overlay manifest for every diverged SimplePie, MagpieRSS, or WordPress feed wrapper path",
  "generated original-path wrapper evidence for WordPress feed.php/class-simplepie/class-feed/cache/file/sanitize adapter boundaries",
  "SimplePie upstream-equivalent dependency record with exact source, version, license, notices, update policy, and accepted WordPress distribution dependency assumptions",
  "PHP lint plus generated-shape/AST contracts for every generated wrapper and public adapter path",
  "WPHX-323.14 SimplePie API/reflection and feed corpus fixture remains passing after divergence",
  "WPHX-323.15 SimplePie wrapper/cache/transport gate remains passing after divergence",
  "WPHX-323.16 MagpieRSS parser/cache/display/deprecated-wrapper floors remain passing after divergence",
  "selected upstream PHPUnit feed-simplepie-core and relevant widget/block/feed groups pass with candidate overlays",
  "installed database-backed feed, RSS widget, RSS block, dashboard, and route evidence appropriate to the claimed boundary",
  "live external provider, TLS, proxy, DNS, persistent object-cache, and fallback policy gates for any broadened transport/provider claim",
  "ecosystem/caller scan covering plugin-visible SimplePie APIs, deprecated MagpieRSS symbols, hooks, include timing, reflection, stack traces, and file paths",
  "license/provenance receipt preserving WordPress GPL project notice, SimplePie BSD-3-Clause SPDX headers, MagpieRSS GPL/deprecated headers, and any external dependency notices"
];
const FALLBACK_MATRIX = [
  {
    condition: "generated wrapper cannot preserve SimplePie namespaced classes, legacy aliases, constants, reflection-visible methods/properties, parser corpus, autoload behavior, or PSR dependency assumptions",
    decision: "preserve_upstream_simplepie_package_and_wordpress_wrappers"
  },
  {
    condition: "generated wrapper would introduce a new external dependency assumption not already accepted by the official WordPress distribution",
    decision: "preserve_upstream_simplepie_package_until_ADR_and_dependency_receipt"
  },
  {
    condition: "replacement cannot preserve fetch_feed, WP_Feed_Cache_Transient, WP_SimplePie_File, WP_SimplePie_Sanitize_KSES, RSS widget, RSS block, or installed feed route behavior",
    decision: "keep_preserved_wordpress_feed_wrapper_files_active"
  },
  {
    condition: "direct MagpieRSS replacement cannot preserve parser fields, cache quirks, display helper output, deprecated wrappers, load_feed_engine timing, or legacy symbol pressure",
    decision: "renew_preserved_upstream_rss_php_exception"
  },
  {
    condition: "live provider/TLS/proxy/DNS/persistent-cache/database/browser/editor/installed behavior is outside deterministic evidence",
    decision: "use_preserved_upstream_fallback_for_uncovered_runtime_conditions"
  },
  {
    condition: "license/provenance, generated overlay records, package notices, or ecosystem evidence are incomplete",
    decision: "do_not_diverge_feed_vendor_distribution_files"
  }
];
const CALLER_PATTERNS = [
  { id: "simplepie_namespace", regex: /SimplePie\\/g },
  { id: "simplepie_legacy_prefix", regex: /\bSimplePie_[A-Za-z0-9_]+/g },
  { id: "simplepie_global_class", regex: /\bSimplePie\b/g },
  { id: "fetch_feed", regex: /\bfetch_feed\s*\(/g },
  { id: "wp_widget_rss", regex: /\bwp_widget_rss_(?:output|process|form)\s*\(/g },
  { id: "wp_widget_rss_class", regex: /\bWP_Widget_RSS\b/g },
  { id: "rss_block_renderer", regex: /\brender_block_core_rss\s*\(/g },
  { id: "magpie_class", regex: /\bMagpieRSS\b/g },
  { id: "magpie_fetch_rss", regex: /\bfetch_rss\s*\(/g },
  { id: "magpie_display_helpers", regex: /\b(?:wp_rss|get_rss)\s*\(/g },
  { id: "magpie_cache", regex: /\bRSSCache\b/g },
  { id: "load_feed_engine", regex: /\bload_feed_engine\b/g }
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
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

function listFiles(path) {
  const full = upstreamPath(path);
  const stat = statSync(full);
  if (stat.isFile()) return [path];
  return readdirSync(full, { withFileTypes: true })
    .flatMap((entry) => listFiles(`${path}/${entry.name}`))
    .sort();
}

function sourceRecord(path) {
  return {
    path,
    distribution_path: path.replace(/^src\//, ""),
    repo_path: upstreamPath(path),
    bytes: statSync(upstreamPath(path)).size,
    sha256: sha256File(upstreamPath(path))
  };
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

function artifactRecords(distributionPaths) {
  const wanted = new Set(distributionPaths);
  return readFileSync(ARTIFACT_PROVENANCE, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .filter((record) => wanted.has(record.path))
    .map((record) => ({
      path: record.path,
      baseline: record.baseline,
      artifact_kind: record.artifactKind,
      artifact_digest: record.artifactDigest,
      origin: record.origin,
      migration_status: record.migrationStatus,
      classified: record.classified
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function headerMarkers(path) {
  const content = readFileSync(upstreamPath(path), "utf8");
  const head = content.slice(0, 5000);
  const family = path.startsWith(`${SIMPLEPIE_ROOT}/`)
    ? "simplepie"
    : path.endsWith("/rss.php") || path.endsWith("/rss-functions.php")
      ? "magpie_rss"
      : "wordpress_feed_wrapper";
  return {
    path,
    distribution_path: path.replace(/^src\//, ""),
    package_family: family,
    simplepie_marker: /SimplePie/i.test(head),
    magpie_marker: /MagpieRSS/i.test(head),
    bsd_3_clause_marker: /BSD-3-Clause/i.test(head),
    gpl_marker: /@license\s+GPL|GNU General Public License|\bGPL\b/i.test(head),
    spdx_marker: /SPDX-License-Identifier/i.test(head),
    deprecated_marker: /@deprecated|_deprecated_file|Deprecated/i.test(head),
    psr_dependency_marker: /Psr\\/i.test(content),
    wordpress_package_marker: /@package WordPress|WordPress/i.test(head),
    load_feed_engine_marker: /load_feed_engine/.test(content),
    version_markers: [...new Set([...content.matchAll(/(?:public\s+)?const\s+VERSION\s*=\s*['"]([^'"]+)['"]/g)].map((match) => match[1]))]
  };
}

function listPhpFiles(root = "src") {
  return listFiles(root).filter((path) => path.endsWith(".php"));
}

function callerScan() {
  const phpFiles = listPhpFiles("src").sort();
  const matches = [];
  for (const path of phpFiles) {
    const content = readFileSync(upstreamPath(path), "utf8");
    const relative = path.replace(/^src\//, "");
    const patternCounts = {};
    for (const pattern of CALLER_PATTERNS) {
      pattern.regex.lastIndex = 0;
      const count = [...content.matchAll(pattern.regex)].length;
      if (count > 0) patternCounts[pattern.id] = count;
    }
    if (Object.keys(patternCounts).length > 0) {
      matches.push({
        path: relative,
        pattern_counts: patternCounts,
        owned_feed_boundary_file:
          relative.startsWith("wp-includes/SimplePie/") ||
          [
            "wp-includes/rss.php",
            "wp-includes/rss-functions.php",
            "wp-includes/feed.php",
            "wp-includes/class-simplepie.php",
            "wp-includes/class-feed.php",
            "wp-includes/class-wp-feed-cache.php",
            "wp-includes/class-wp-feed-cache-transient.php",
            "wp-includes/class-wp-simplepie-file.php",
            "wp-includes/class-wp-simplepie-sanitize-kses.php",
            "wp-includes/widgets/class-wp-widget-rss.php",
            "wp-includes/blocks/rss.php"
          ].includes(relative)
      });
    }
  }
  const outside = matches.filter((record) => !record.owned_feed_boundary_file);
  const totals = {};
  for (const record of matches) {
    for (const [id, count] of Object.entries(record.pattern_counts)) {
      totals[id] = (totals[id] ?? 0) + count;
    }
  }
  return {
    php_file_count: phpFiles.length,
    match_file_count: matches.length,
    outside_owned_boundary_match_file_count: outside.length,
    pattern_totals: Object.fromEntries(Object.entries(totals).sort(([a], [b]) => a.localeCompare(b))),
    outside_owned_boundary_matches: outside.sort((a, b) => a.path.localeCompare(b.path))
  };
}

function priorGateSummary(gate) {
  const manifest = readJson(gate.manifest);
  return {
    ...gate,
    manifest_sha256: sha256File(gate.manifest),
    issue: manifest.issue,
    validation_result: manifest.validation_result ?? manifest.validation_summary,
    non_claims: manifest.non_claims
  };
}

function validateInputs({ simplepieFiles, sourceFiles, artifactEvidence, priorGates }) {
  const failures = [];
  const strategy = readJson(STRATEGY);
  const feedGates = readJson(FEED_GATES);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const licenseProvenance = readJson(LICENSE_PROVENANCE);
  const wordpressLicense = licenseProvenance.upstreams.find((entry) => entry.id === "upstream:wordpress-7.0.0");
  const simplepiePlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "simplepie");
  const magpiePlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "magpie_rss");
  const simplepieBoundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "simplepie");
  const magpieBoundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "magpie_rss");
  const provenanceGate = feedGates.gate_plan.find((gate) => gate.id === "feed-vendor-license-provenance-and-dependency-review");
  const decisionGate = feedGates.gate_plan.find((gate) => gate.id === "feed-vendor-ecosystem-fallback-and-replacement-decision");

  if (simplepiePlan?.replacement_strategy !== "generated_wrapper_around_upstream_equivalent_dependency") {
    failures.push(`unexpected SimplePie replacement strategy ${simplepiePlan?.replacement_strategy}`);
  }
  if (magpiePlan?.replacement_strategy !== "renewed_preserved_artifact_exception_with_tests_provenance") {
    failures.push(`unexpected MagpieRSS replacement strategy ${magpiePlan?.replacement_strategy}`);
  }
  if (simplepieBoundary?.source_tree.file_count !== simplepieFiles.length || simplepieBoundary?.distribution_artifacts.count !== simplepieFiles.length) {
    failures.push(`expected ${simplepieFiles.length} SimplePie source/distribution files`);
  }
  if (magpieBoundary?.source_tree.file_count !== 1 || magpieBoundary?.distribution_artifacts.count !== 1) {
    failures.push("MagpieRSS vendor boundary count changed unexpectedly");
  }
  if (provenanceGate?.downstream_issue.external_ref !== ISSUE.external_ref) {
    failures.push("WPHX-323.04 provenance gate does not route to WPHX-323.17");
  }
  if (decisionGate?.downstream_issue.external_ref !== ISSUE.external_ref) {
    failures.push("WPHX-323.04 decision gate does not route to WPHX-323.17");
  }
  for (const gate of priorGates) {
    if (gate.issue?.external_ref !== gate.expected_external_ref) {
      failures.push(`${gate.id} has unexpected issue ref ${gate.issue?.external_ref}`);
    }
    const validation = gate.validation_result ?? {};
    if (gate.expected_external_ref === "WPHX-323.14" && validation.observations_equal !== true) {
      failures.push("WPHX-323.14 SimplePie API/corpus fixture is not passing");
    }
    if (gate.expected_external_ref === "WPHX-323.15" && (validation.status !== "passed" || validation.observations_match !== true)) {
      failures.push("WPHX-323.15 SimplePie wrapper/cache/transport gate is not passing");
    }
    if (gate.expected_external_ref === "WPHX-323.16" && (validation.status !== "passed" || validation.renewed_preserved_exception !== true)) {
      failures.push("WPHX-323.16 MagpieRSS exception gate is not passing");
    }
    if (validation.generated_overlay_manifest_present !== false && gate.expected_external_ref !== "WPHX-323.15") {
      failures.push(`${gate.id} unexpectedly records generated overlay evidence`);
    }
    if (validation.copied_artifact_retirement_claimed !== false) {
      failures.push(`${gate.id} unexpectedly claims copied artifact retirement`);
    }
  }
  if (artifactEvidence.length !== sourceFiles.length) {
    failures.push(`expected ${sourceFiles.length} artifact provenance records, found ${artifactEvidence.length}`);
  }
  if (wordpressLicense?.package_license !== "GPL-2.0-or-later" || wordpressLicense?.composer_license !== "GPL-2.0-or-later") {
    failures.push("WordPress 7.0 license record is not GPL-2.0-or-later");
  }

  if (failures.length > 0) {
    throw new Error(`WPHX-323.17 feed vendor provenance decision failed:\n- ${failures.join("\n- ")}`);
  }

  return {
    strategy: fileRecord(STRATEGY),
    feed_gates: fileRecord(FEED_GATES),
    simplepie_api: fileRecord(SIMPLEPIE_API),
    simplepie_wrapper: fileRecord(SIMPLEPIE_WRAPPER),
    magpie_exception: fileRecord(MAGPIE_EXCEPTION),
    vendor_closure: fileRecord(VENDOR_CLOSURE),
    license_provenance: fileRecord(LICENSE_PROVENANCE),
    artifact_provenance: fileRecord(ARTIFACT_PROVENANCE),
    planned_provenance_gate: provenanceGate,
    planned_decision_gate: decisionGate,
    vendor_boundaries: {
      simplepie: {
        source_inventory_count: simplepieBoundary.source_inventory.count,
        distribution_artifact_count: simplepieBoundary.distribution_artifacts.count,
        header_notice_markers: simplepieBoundary.license_provenance.header_notice_markers,
        treatment: simplepieBoundary.license_provenance.treatment,
        current_strategy: simplepiePlan.current_strategy,
        replacement_strategy: simplepiePlan.replacement_strategy,
        removal_gate: simplepiePlan.removal_gate
      },
      magpie_rss: {
        source_inventory_count: magpieBoundary.source_inventory.count,
        distribution_artifact_count: magpieBoundary.distribution_artifacts.count,
        header_notice_markers: magpieBoundary.license_provenance.header_notice_markers,
        treatment: magpieBoundary.license_provenance.treatment,
        current_strategy: magpiePlan.current_strategy,
        replacement_strategy: magpiePlan.replacement_strategy,
        removal_gate: magpiePlan.removal_gate
      }
    },
    wordpress_license_record: {
      package_license: wordpressLicense.package_license,
      composer_license: wordpressLicense.composer_license,
      project_license_file: wordpressLicense.project_license_file,
      bundled_notice_file_count: wordpressLicense.bundled_notice_files.length
    }
  };
}

function main() {
  const simplepieFiles = listFiles(SIMPLEPIE_ROOT);
  const sourceFiles = [...simplepieFiles, ...MAGPIE_FILES, ...WORDPRESS_FEED_SUPPORT_FILES].sort();
  const distributionPaths = sourceFiles.map((path) => path.replace(/^src\//, ""));
  const artifactEvidence = artifactRecords(distributionPaths);
  const headerEvidence = sourceFiles.map(headerMarkers);
  const priorGates = REQUIRED_PRIOR_GATES.map(priorGateSummary);
  const inputs = validateInputs({ simplepieFiles, sourceFiles, artifactEvidence, priorGates });
  const callerReview = callerScan();
  const simplepieBsdCount = headerEvidence.filter((record) => record.package_family === "simplepie" && record.bsd_3_clause_marker).length;
  const simplepiePsrDependencyFiles = headerEvidence.filter((record) => record.package_family === "simplepie" && record.psr_dependency_marker).map((record) => record.distribution_path);
  const simplepieVersionMarkers = [...new Set(headerEvidence.flatMap((record) => (record.package_family === "simplepie" ? record.version_markers : [])))].sort();
  const magpieGplCount = headerEvidence.filter((record) => record.package_family === "magpie_rss" && record.gpl_marker).length;
  const magpieDeprecatedCount = headerEvidence.filter((record) => record.package_family === "magpie_rss" && record.deprecated_marker).length;
  const wordpressWrapperMarkerCount = headerEvidence.filter((record) => record.package_family === "wordpress_feed_wrapper" && record.wordpress_package_marker).length;
  const decision = {
    current_distribution_decision: "renew_preserved_feed_vendor_exceptions",
    simplepie_decision: {
      current_distribution_decision: "preserve_upstream_simplepie_package_and_wordpress_feed_wrappers",
      generated_wrapper_path_status: "conditionally_admitted_but_blocked",
      rationale:
        "WPHX-323.14 and WPHX-323.15 establish preserved-package API/corpus and WordPress wrapper/cache/transport floors, but no generated overlay, upstream-equivalent dependency policy, installed feed parity, live provider policy, or ecosystem compatibility scan sufficient for distribution divergence exists yet."
    },
    magpie_rss_decision: {
      current_distribution_decision: "renew_preserved_upstream_rss_php_exception",
      generated_or_direct_port_status: "blocked",
      rationale:
        "WPHX-323.16 renews the MagpieRSS preserved-artifact exception because MagpieRSS is deprecated compatibility code, SimplePie is the preferred feed path, and WordPress 7.0 core runtime symbol pressure is contained to rss.php/rss-functions.php."
    },
    allowed_now: [
      "Keep upstream WordPress 7.0 SimplePie package files, WordPress feed wrapper files, rss.php, and rss-functions.php as preserved fallback artifacts.",
      "Use WPHX-323.14, WPHX-323.15, and WPHX-323.16 as golden floors for future generated wrapper or direct replacement work.",
      "Continue planning generated WPHX PHP wrapper overlays for WordPress feed wrapper files only with explicit overlay manifests and prerequisite gates."
    ],
    forbidden_now: [
      "Do not claim Haxe-owned SimplePie or MagpieRSS runtime implementation.",
      "Do not claim generated SimplePie wrapper or MagpieRSS public PHP replacement ownership.",
      "Do not retire copied SimplePie, rss.php, rss-functions.php, or WordPress feed wrapper artifacts.",
      "Do not broaden official WordPress distribution dependency assumptions for PSR HTTP/cache or external SimplePie packages without ADR/provenance evidence.",
      "Do not claim live external feed, TLS, proxy, DNS, persistent cache, database-backed installed state, browser/editor widget/block, installed WordPress feed parity, or broad ecosystem compatibility."
    ]
  };
  const manifest = {
    schema: "wphx.wp-core.feed-vendor-provenance-decision-gate.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "preserved_feed_vendor_provenance_and_replacement_decision",
    boundary_ids: ["simplepie", "magpie_rss"],
    behavior_parity_claimed: false,
    generated_public_php_replacement_claimed: false,
    copied_feed_vendor_artifact_retirement_claimed: false,
    haxe_owned_runtime_claimed: false,
    installed_wordpress_feed_parity_claimed: false,
    live_external_feed_parity_claimed: false,
    generated_simplepie_wrapper_path_admitted_now: false,
    preserved_upstream_exceptions_renewed: true,
    inputs,
    prior_gates: priorGates,
    source_files: sourceFiles.map(sourceRecord),
    artifact_provenance_records: artifactEvidence,
    provenance_review: {
      wordpress_project_license: "GPL-2.0-or-later",
      simplepie_package_license: "BSD-3-Clause SPDX markers in bundled SimplePie source headers",
      magpie_rss_license: "GPL marker in deprecated rss.php header, under WordPress project distribution treatment",
      package_notice_files_recorded_in_wordpress_license_manifest: [],
      required_notice_treatment: [
        "Preserve WordPress project notice for distributions derived from WordPress 7.0.",
        "Preserve SimplePie BSD-3-Clause SPDX/file headers while the bundled package remains copied or wrapped.",
        "Preserve MagpieRSS GPL/deprecated file header while rss.php remains copied/preserved.",
        "Record source/version/license/notices/update policy for any future upstream-equivalent SimplePie dependency wrapper."
      ],
      header_evidence: headerEvidence,
      simplepie_bsd_3_clause_header_count: simplepieBsdCount,
      simplepie_version_markers: simplepieVersionMarkers,
      magpie_gpl_header_count: magpieGplCount,
      magpie_deprecated_header_count: magpieDeprecatedCount,
      wordpress_feed_wrapper_marker_count: wordpressWrapperMarkerCount
    },
    dependency_review: {
      official_wordpress_distribution_dependency_broadening_allowed: false,
      simplepie_psr_dependency_files: simplepiePsrDependencyFiles,
      simplepie_psr_dependency_status:
        "WordPress 7.0 bundles the SimplePie source tree, including PSR-adjacent interfaces/usages required by that source. Generated wrapper work must not silently change official distribution dependency assumptions or require Composer-installed PSR packages.",
      generated_wrapper_dependency_requirements: [
        "Record whether the wrapper targets bundled upstream SimplePie source, an upstream-equivalent external package, or Haxe-owned implementation.",
        "If using an external package, lock exact version/source/license/notices and prove the official WordPress distribution dependency assumption is accepted.",
        "Keep preserved upstream SimplePie fallback active for PSR, parser, cache, HTTP, and dependency-adjacent behavior until dedicated evidence exists."
      ]
    },
    ecosystem_review: {
      plugin_visible_surfaces: [
        "SimplePie\\SimplePie and SimplePie modern namespace classes",
        "legacy SimplePie_* aliases and SIMPLEPIE_* constants",
        "SimplePie_Autoloader and wp_simplepie_autoload",
        "fetch_feed",
        "WP_Feed_Cache and WP_Feed_Cache_Transient",
        "WP_SimplePie_File",
        "WP_SimplePie_Sanitize_KSES",
        "wp_feed_options and wp_feed_cache_transient_lifetime hooks",
        "wp_widget_rss_output/wp_widget_rss_process/wp_widget_rss_form",
        "WP_Widget_RSS",
        "render_block_core_rss",
        "MagpieRSS, RSSCache, fetch_rss, wp_rss, get_rss, and load_feed_engine"
      ],
      core_caller_review: callerReview,
      current_evidence: [
        "WPHX-323.14 records preserved SimplePie API/reflection and local feed corpus floors.",
        "WPHX-323.15 records preserved WordPress SimplePie wrapper/cache/transport floors.",
        "WPHX-323.16 records a MagpieRSS preserved-artifact exception, provenance, and core caller-pressure review.",
        "No generated feed vendor wrapper, broad plugin ecosystem scan, or installed database-backed feed parity is present yet."
      ],
      required_future_evidence: [
        "class_exists/interface_exists and include-order compatibility over SimplePie modern and legacy symbols",
        "reflection-visible file names, class names, methods, constants, properties, inheritance, exceptions, and aliases",
        "stack traces and error messages with acceptable original-path behavior",
        "plugin/caller ecosystem scan before replacing SimplePie, MagpieRSS, feed wrappers, widget helpers, or block renderer handoffs",
        "installed route/browser/database evidence before installed feed/widget/block parity claims"
      ]
    },
    replacement_decision: decision,
    required_replacement_evidence: REQUIRED_REPLACEMENT_EVIDENCE,
    fallback_matrix: FALLBACK_MATRIX,
    validation_result: {
      status: "passed",
      simplepie_source_file_count: simplepieFiles.length,
      magpie_source_file_count: MAGPIE_FILES.length,
      wordpress_feed_support_file_count: WORDPRESS_FEED_SUPPORT_FILES.length,
      source_file_count: sourceFiles.length,
      artifact_provenance_record_count: artifactEvidence.length,
      header_evidence_record_count: headerEvidence.length,
      simplepie_bsd_3_clause_header_count: simplepieBsdCount,
      simplepie_psr_dependency_file_count: simplepiePsrDependencyFiles.length,
      simplepie_version_markers: simplepieVersionMarkers,
      magpie_gpl_header_count: magpieGplCount,
      magpie_deprecated_header_count: magpieDeprecatedCount,
      wordpress_feed_wrapper_marker_count: wordpressWrapperMarkerCount,
      prior_gate_count: REQUIRED_PRIOR_GATES.length,
      prior_gates_passing: true,
      caller_scan_php_file_count: callerReview.php_file_count,
      caller_match_file_count: callerReview.match_file_count,
      outside_owned_boundary_match_file_count: callerReview.outside_owned_boundary_match_file_count,
      required_replacement_evidence_count: REQUIRED_REPLACEMENT_EVIDENCE.length,
      fallback_condition_count: FALLBACK_MATRIX.length,
      generated_overlay_manifest_present: false,
      generated_simplepie_wrapper_path_admitted_now: false,
      preserved_upstream_exceptions_renewed: true,
      copied_feed_vendor_artifact_retirement_claimed: false,
      haxe_owned_runtime_claimed: false
    },
    claims: [
      "Feed vendor provenance, bundled-file artifact records, header license markers, dependency assumptions, ecosystem-visible surfaces, fallback matrix, and replacement decision criteria are recorded for WPHX-323.17.",
      "The current distribution decision renews preserved upstream feed vendor exceptions and keeps copied WordPress 7.0 SimplePie, MagpieRSS, and feed wrapper artifacts as fallback evidence.",
      "A generated SimplePie wrapper path remains conditionally possible only after explicit overlay, API/reflection, wrapper/cache/transport, provenance, ecosystem, upstream PHPUnit, installed-route, and live/fallback gates pass."
    ],
    non_claims: [
      "This gate does not implement Haxe-owned SimplePie or MagpieRSS runtime logic.",
      "This gate does not generate, validate, distribute, or admit current generated SimplePie wrapper or MagpieRSS replacement files.",
      "This gate does not retire copied SimplePie, rss.php, rss-functions.php, or WordPress feed wrapper artifacts.",
      "This gate does not broaden official WordPress distribution dependency assumptions.",
      "This gate does not prove live external feed provider behavior, TLS, proxy, DNS, persistent object-cache behavior, database-backed installed feed state, browser/editor widget or block parity, installed WordPress feed parity, or broad plugin ecosystem compatibility."
    ]
  };
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    artifact: OUT,
    ownership_state: "preserved_upstream_feed_vendor_exception_renewal",
    boundary_ids: ["simplepie", "magpie_rss"],
    source_authority: "../wordpress-develop WordPress 7.0 SimplePie, MagpieRSS, feed wrapper files, and artifact/license provenance manifests",
    whole_file_owned: false,
    behavior_parity_claimed: false,
    generated_public_php_replacement_claimed: false,
    copied_feed_vendor_artifact_retirement_claimed: false,
    haxe_owned_runtime_claimed: false,
    installed_wordpress_feed_parity_claimed: false,
    live_external_feed_parity_claimed: false,
    generated_simplepie_wrapper_path_admitted_now: false,
    preserved_upstream_exceptions_renewed: true,
    durable_original_path_adapter_claimed: false,
    generated_overlay_manifest_present: false,
    removal_gate:
      "Do not replace or retire preserved feed vendor artifacts until generated overlay manifests, wrapper/dependency provenance, API/reflection parity, wrapper/cache/transport parity, MagpieRSS floors, upstream PHPUnit, installed feed/widget/block gates, ecosystem compatibility evidence, live/fallback evidence, and license notice preservation all pass.",
    non_claims: manifest.non_claims
  };
  const ownershipContent = `${JSON.stringify(ownership, null, 2)}\n`;
  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-17-feed-vendor-provenance-decision-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: manifest.evidence_class,
    artifact_scope: "wordpress-7.0-feed-vendor-provenance-dependency-ecosystem-decision",
    commands: [
      "npm run wp:core:wphx-323-feed-vendor-provenance-decision",
      "npm run wp:core:wphx-323-feed-vendor-provenance-decision:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      parent_feed_vendor_gate_manifest: FEED_GATES,
      simplepie_api_reflection_corpus_manifest: SIMPLEPIE_API,
      simplepie_wrapper_cache_transport_manifest: SIMPLEPIE_WRAPPER,
      magpie_rss_legacy_exception_manifest: MAGPIE_EXCEPTION,
      vendor_closure_manifest: VENDOR_CLOSURE,
      license_provenance_manifest: LICENSE_PROVENANCE
    },
    manifest_sha256: sha256(manifestContent),
    validation_result: manifest.validation_result,
    decision: decision.current_distribution_decision,
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };

  writeOrCheck(OUT, manifestContent);
  writeOrCheck(OWNERSHIP, ownershipContent);
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
        decision: manifest.replacement_decision.current_distribution_decision,
        required_replacement_evidence_count: manifest.validation_result.required_replacement_evidence_count,
        fallback_condition_count: manifest.validation_result.fallback_condition_count
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
