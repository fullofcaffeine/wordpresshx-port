#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.28",
  external_ref: "WPHX-323.04",
  title: "Plan feed vendor replacement gates"
};
const RECORDED_AT = "2026-07-08T00:30:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-php-feed-vendor-replacement-gates.mjs";
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const OUT = "manifests/wp-core/wphx-323-04-feed-vendor-replacement-gates.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-04-feed-vendor-replacement-gates.v1.json";

const SIMPLEPIE_ROOT = "src/wp-includes/SimplePie";
const MAGPIE_SOURCE = "src/wp-includes/rss.php";
const LEGACY_RSS_WRAPPER = "src/wp-includes/rss-functions.php";

const DOWNSTREAM_ISSUES = {
  simplepie_api_reflection_corpus: {
    issue_id: "wordpresshx-l76.34",
    external_ref: "WPHX-323.14",
    title: "Add SimplePie API/reflection and feed corpus fixture"
  },
  simplepie_wrapper_cache_transport: {
    issue_id: "wordpresshx-l76.35",
    external_ref: "WPHX-323.15",
    title: "Add SimplePie feed wrapper cache and transport gate"
  },
  magpie_legacy_exception: {
    issue_id: "wordpresshx-l76.36",
    external_ref: "WPHX-323.16",
    title: "Add MagpieRSS legacy exception gate"
  },
  feed_vendor_provenance_decision: {
    issue_id: "wordpresshx-l76.37",
    external_ref: "WPHX-323.17",
    title: "Add feed vendor provenance and replacement decision gate"
  }
};

const EXISTING_EVIDENCE = [
  {
    id: "wphx-312-21-deprecated-embed-rss-wrapper",
    manifest: "manifests/wp-core/wphx-312-21-deprecated-embed-rss-wrapper-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-21-deprecated-embed-rss-wrapper-oracle-fixture.v1.json",
    boundary_ids: ["magpie_rss"],
    role: "deprecated rss-functions.php handoff into rss.php and class-simplepie.php under deterministic stubs"
  },
  {
    id: "wphx-312-22-magpie-rss-parser",
    manifest: "manifests/wp-core/wphx-312-22-magpie-rss-parser-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-22-magpie-rss-parser-oracle-fixture.v1.json",
    boundary_ids: ["magpie_rss"],
    role: "MagpieRSS parser and pure helper fixture for RSS2, RDF, Atom, namespace, status, and cache helper observations"
  },
  {
    id: "wphx-312-23-magpie-rss-fetch-cache",
    manifest: "manifests/wp-core/wphx-312-23-magpie-rss-fetch-cache-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-23-magpie-rss-fetch-cache-oracle-fixture.v1.json",
    boundary_ids: ["magpie_rss"],
    role: "MagpieRSS fetch_rss, remote response conversion, and transient cache hit/miss fixture"
  },
  {
    id: "wphx-312-24-magpie-rss-display-helper",
    manifest: "manifests/wp-core/wphx-312-24-magpie-rss-display-helper-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-24-magpie-rss-display-helper-oracle-fixture.v1.json",
    boundary_ids: ["magpie_rss"],
    role: "MagpieRSS wp_rss/get_rss display helper output and failure-shape fixture"
  },
  {
    id: "wphx-312-25-rss-widget-helper",
    manifest: "manifests/wp-core/wphx-312-25-rss-widget-helper-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-25-rss-widget-helper-oracle-fixture.v1.json",
    boundary_ids: ["simplepie"],
    role: "RSS widget helper fixture over deterministic SimplePie-like feed stubs"
  },
  {
    id: "wphx-312-26-wp-widget-rss-class",
    manifest: "manifests/wp-core/wphx-312-26-wp-widget-rss-class-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-26-wp-widget-rss-class-oracle-fixture.v1.json",
    boundary_ids: ["simplepie"],
    role: "WP_Widget_RSS class fixture for widget form/update/output handoffs using feed helper behavior"
  },
  {
    id: "wphx-312-27-rss-block-renderer",
    manifest: "manifests/wp-core/wphx-312-27-rss-block-renderer-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-27-rss-block-renderer-oracle-fixture.v1.json",
    boundary_ids: ["simplepie"],
    role: "RSS block renderer fixture over fetch_feed and SimplePie-like item stubs"
  },
  {
    id: "wphx-312-35-feed-cache-transient",
    manifest: "manifests/wp-core/wphx-312-35-feed-cache-transient-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-35-feed-cache-transient-oracle-fixture.v1.json",
    boundary_ids: ["simplepie"],
    role: "WP_Feed_Cache_Transient fixture for cache key, save/load/mtime/touch/unlink, and expiration behavior"
  },
  {
    id: "wphx-312-36-simplepie-file-http",
    manifest: "manifests/wp-core/wphx-312-36-simplepie-file-http-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-36-simplepie-file-http-oracle-fixture.v1.json",
    boundary_ids: ["simplepie"],
    role: "WP_SimplePie_File HTTP constructor and response/error mapping fixture"
  },
  {
    id: "wphx-312-37-simplepie-feed-wrapper",
    manifest: "manifests/wp-core/wphx-312-37-simplepie-feed-wrapper-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-37-simplepie-feed-wrapper-oracle-fixture.v1.json",
    boundary_ids: ["simplepie"],
    role: "class-simplepie.php and class-feed.php load-order and autoloader compatibility fixture"
  },
  {
    id: "wphx-312-94-feed-embed-widget-privacy-installed-routes",
    manifest: "manifests/wp-core/wphx-312-94-feed-embed-widget-privacy-installed-routes-gate.v1.json",
    receipt: "receipts/wp-core/wphx-312-94-feed-embed-widget-privacy-installed-routes-gate.v1.json",
    boundary_ids: ["simplepie", "magpie_rss"],
    role: "installed-style feed/embed/widget/privacy route observations with copied package roots and deterministic bridge data"
  }
];

const SIMPLEPIE_API_AREAS = [
  "SimplePie\\SimplePie namespaced class",
  "legacy SimplePie global class stub and SIMPLEPIE_* constants",
  "SimplePie\\Item, Feed, Author, Category, Enclosure, Caption, Credit, Source, Rating, Registry, Misc, Parser, Sanitize, and Locator families",
  "public constants, public methods, constructor signatures, exception classes, and reflection-visible namespaces",
  "autoload behavior across wp-includes/class-simplepie.php and wp-includes/SimplePie/autoloader.php",
  "PSR HTTP/cache dependency seams currently bundled with WordPress SimplePie source",
  "deprecation and compatibility behavior for legacy SimplePie symbols"
];

const FEED_CORPUS_AREAS = [
  "RSS 0.91/0.92/1.0/2.0",
  "Atom 0.3/1.0",
  "RDF channel/item/image/textinput shape",
  "malformed XML and parser errors",
  "charsets and content-type sniffing",
  "date parsing and timezone normalization",
  "enclosures, media, categories, authors, contributors, and namespaces",
  "relative URL/base URI handling",
  "empty feed, duplicate item, and invalid link/title/description cases"
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

function sourceMarkers(path) {
  const content = readFileSync(upstreamPath(path), "utf8");
  const head = content.slice(0, 4000);
  return {
    path,
    distribution_path: path.replace(/^src\//, ""),
    simplepie_marker: /SimplePie/i.test(head),
    magpie_marker: /MagpieRSS/i.test(head),
    bsd_3_clause_marker: /BSD-3-Clause/i.test(head),
    gpl_marker: /@license\s+GPL|GNU General Public License|GPL/i.test(head),
    deprecated_marker: /@deprecated|_deprecated_file/i.test(head),
    psr_dependency_marker: /Psr\\/i.test(content),
    simplepie_version_markers: [
      ...new Set([...content.matchAll(/(?:public\s+)?const\s+VERSION\s*=\s*['"]([^'"]+)['"]/g)].map((match) => match[1]))
    ]
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

function main() {
  const failures = [];
  const strategy = readJson(STRATEGY);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const simplepiePlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "simplepie");
  const magpiePlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "magpie_rss");
  const followupGroup = strategy.followup_groups.find((entry) => entry.issue.external_ref === ISSUE.external_ref);
  const simplepieBoundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "simplepie");
  const magpieBoundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "magpie_rss");

  if (simplepiePlan?.followup_issue.external_ref !== ISSUE.external_ref) {
    failures.push("WPHX-323.01 SimplePie plan is not routed to WPHX-323.04");
  }
  if (magpiePlan?.followup_issue.external_ref !== ISSUE.external_ref) {
    failures.push("WPHX-323.01 MagpieRSS plan is not routed to WPHX-323.04");
  }
  if (simplepiePlan?.replacement_strategy !== "generated_wrapper_around_upstream_equivalent_dependency") {
    failures.push(`unexpected SimplePie replacement strategy: ${simplepiePlan?.replacement_strategy}`);
  }
  if (magpiePlan?.replacement_strategy !== "renewed_preserved_artifact_exception_with_tests_provenance") {
    failures.push(`unexpected MagpieRSS replacement strategy: ${magpiePlan?.replacement_strategy}`);
  }
  if (followupGroup?.source_inventory_count !== 83 || followupGroup?.distribution_artifact_count !== 83) {
    failures.push("WPHX-323.04 follow-up group does not cover the expected 83 feed vendor artifacts");
  }

  const simplepieSourceFiles = listFiles(SIMPLEPIE_ROOT);
  const boundarySourceFiles = [...simplepieSourceFiles, MAGPIE_SOURCE].sort();
  const supportSourceFiles = [LEGACY_RSS_WRAPPER];
  const sourceRecords = boundarySourceFiles.map(sourceRecord);
  const supportSourceRecords = supportSourceFiles.map(sourceRecord);
  const artifactEvidence = artifactRecords([...boundarySourceFiles, ...supportSourceFiles].map((path) => path.replace(/^src\//, "")));
  const headerEvidence = [...boundarySourceFiles, ...supportSourceFiles].map(sourceMarkers);
  const simplepieBsdMarkerCount = headerEvidence.filter((record) => record.path.startsWith(SIMPLEPIE_ROOT) && record.bsd_3_clause_marker).length;
  const simplepiePsrDependencyFiles = headerEvidence
    .filter((record) => record.path.startsWith(SIMPLEPIE_ROOT) && record.psr_dependency_marker)
    .map((record) => record.distribution_path);
  const simplepieVersions = [...new Set(headerEvidence.flatMap((record) => record.simplepie_version_markers))].sort();
  const magpieMarkers = headerEvidence.find((record) => record.path === MAGPIE_SOURCE);
  const evidenceRecords = EXISTING_EVIDENCE.map((entry) => ({
    ...entry,
    manifest_record: fileRecord(entry.manifest),
    receipt_record: fileRecord(entry.receipt)
  }));

  if (simplepieSourceFiles.length !== 82) {
    failures.push(`expected 82 SimplePie source files, found ${simplepieSourceFiles.length}`);
  }
  if (simplepieBoundary?.source_inventory.count !== simplepieSourceFiles.length) {
    failures.push(`expected SimplePie source inventory count ${simplepieSourceFiles.length}, found ${simplepieBoundary?.source_inventory.count}`);
  }
  if (simplepieBoundary?.distribution_artifacts.count !== simplepieSourceFiles.length) {
    failures.push(`expected SimplePie distribution artifact count ${simplepieSourceFiles.length}, found ${simplepieBoundary?.distribution_artifacts.count}`);
  }
  if (magpieBoundary?.source_inventory.count !== 1 || magpieBoundary?.distribution_artifacts.count !== 1) {
    failures.push("expected MagpieRSS source and distribution artifact counts of 1");
  }
  if (artifactEvidence.length !== boundarySourceFiles.length + supportSourceFiles.length) {
    failures.push(`expected ${boundarySourceFiles.length + supportSourceFiles.length} artifact provenance records, found ${artifactEvidence.length}`);
  }
  if (simplepieBsdMarkerCount < 1) failures.push("expected SimplePie BSD-3-Clause header marker evidence");
  if (magpieMarkers?.gpl_marker !== true || magpieMarkers?.deprecated_marker !== true) {
    failures.push("expected MagpieRSS GPL and deprecated header markers");
  }
  if (evidenceRecords.length !== 11) failures.push(`expected 11 existing feed evidence records, found ${evidenceRecords.length}`);
  if (Object.keys(DOWNSTREAM_ISSUES).length !== 4) failures.push("expected 4 downstream feed vendor issues");

  const gatePlan = [
    {
      id: "simplepie-api-reflection-and-feed-corpus",
      boundary_id: "simplepie",
      downstream_issue: DOWNSTREAM_ISSUES.simplepie_api_reflection_corpus,
      gate_kind: "api_reflection_corpus_and_generated_wrapper_shape",
      required_before: ["generated_wrapper_claim", "simplepie_distribution_divergence", "copied_simplepie_retirement"],
      required_api_observations: SIMPLEPIE_API_AREAS,
      required_corpus_observations: FEED_CORPUS_AREAS,
      acceptance:
        "SimplePie public API, legacy symbols, autoload behavior, parser corpus, malformed-feed behavior, and generated wrapper/original-path shape are proven before any SimplePie package divergence.",
      fallback_policy:
        "If wrapper emission cannot preserve SimplePie public API, parser corpus behavior, legacy symbols, or dependency assumptions, renew the preserved upstream SimplePie exception.",
      removal_gate:
        "Do not claim generated SimplePie wrapper ownership or retire copied SimplePie artifacts until WPHX-323.14 records passing API/reflection, corpus, and wrapper-shape evidence."
    },
    {
      id: "simplepie-wordpress-wrapper-cache-widget-block-and-transport",
      boundary_id: "simplepie",
      downstream_issue: DOWNSTREAM_ISSUES.simplepie_wrapper_cache_transport,
      gate_kind: "wordpress_feed_wrapper_cache_transport_matrix",
      required_before: ["generated_wrapper_claim", "feed_transport_replacement_claim", "installed_feed_parity_claim"],
      existing_evidence_ids: [
        "wphx-312-25-rss-widget-helper",
        "wphx-312-26-wp-widget-rss-class",
        "wphx-312-27-rss-block-renderer",
        "wphx-312-35-feed-cache-transient",
        "wphx-312-36-simplepie-file-http",
        "wphx-312-37-simplepie-feed-wrapper",
        "wphx-312-94-feed-embed-widget-privacy-installed-routes"
      ],
      required_observations: [
        "fetch_feed wrapper initialization, error handling, and SimplePie object handoff",
        "WP_Feed_Cache_Transient cache hit, miss, expiration, touch, unlink, and object serialization behavior",
        "WP_SimplePie_File local/remote HTTP response, header, status, body, and WP_Error mapping behavior",
        "WP_SimplePie_Sanitize_KSES allowlist and sanitizer handoff behavior",
        "RSS widget helper, WP_Widget_RSS, and core/rss block renderer outputs",
        "Requests transport handoff for local loopback success and deterministic connection failure",
        "installed-style feed/widget/block route observations without claiming live provider parity"
      ],
      acceptance:
        "WordPress SimplePie wrappers, cache behavior, widget/block handoffs, and controlled local transport cases remain matched before replacement claims.",
      fallback_policy:
        "Keep preserved upstream SimplePie active for live providers, TLS/proxy/DNS, persistent object-cache backends, database-backed feed state, and installed routes until dedicated gates pass.",
      removal_gate:
        "Do not retire SimplePie package files or claim installed feed parity until WPHX-323.15 passes and records unresolved live-network/cache/provider blockers."
    },
    {
      id: "magpie-rss-legacy-parser-cache-display-exception",
      boundary_id: "magpie_rss",
      downstream_issue: DOWNSTREAM_ISSUES.magpie_legacy_exception,
      gate_kind: "legacy_exception_with_parser_cache_display_floor",
      required_before: ["magpie_distribution_divergence", "copied_magpie_retirement", "haxe_owned_magpie_runtime_claim"],
      existing_evidence_ids: [
        "wphx-312-21-deprecated-embed-rss-wrapper",
        "wphx-312-22-magpie-rss-parser",
        "wphx-312-23-magpie-rss-fetch-cache",
        "wphx-312-24-magpie-rss-display-helper"
      ],
      required_observations: [
        "MagpieRSS parser fields, namespace handling, RSS/RDF/Atom normalization, and error behavior",
        "fetch_rss remote-response conversion, RSSCache transient behavior, and stale/cache quirks",
        "wp_rss/get_rss output, escaping quirks, slicing, failure return, and deprecated wrapper handoff",
        "load_feed_engine hook and deprecation surfaces remain ecosystem-visible",
        "caller review confirms deprecated MagpieRSS pressure does not justify direct Haxe port yet"
      ],
      acceptance:
        "MagpieRSS gets a renewed preserved-artifact exception with parser/cache/display evidence and explicit caller pressure review unless ecosystem evidence requires replacement.",
      fallback_policy:
        "Default to renewed preserved upstream rss.php because the file is deprecated compatibility code and SimplePie is the preferred feed path.",
      removal_gate:
        "Do not claim Haxe-owned MagpieRSS runtime logic or retire rss.php until WPHX-323.16 proves either a direct replacement path or a renewed exception with tests and provenance."
    },
    {
      id: "feed-vendor-license-provenance-and-dependency-review",
      boundary_ids: ["simplepie", "magpie_rss"],
      downstream_issue: DOWNSTREAM_ISSUES.feed_vendor_provenance_decision,
      gate_kind: "license_provenance_dependency_review",
      required_before: ["distribution_divergence", "external_dependency_wrapper_claim", "copied_feed_vendor_retirement"],
      required_observations: [
        "SimplePie BSD-3-Clause source headers, version markers, WordPress bundled provenance, and absence/presence of package notice files",
        "MagpieRSS GPL/deprecated source header, WordPress project license treatment, and rss-functions.php support wrapper provenance",
        "Artifact provenance for all SimplePie, rss.php, and rss-functions.php distribution paths",
        "PSR HTTP/cache interface dependency assumptions and official WordPress distribution dependency policy",
        "Any upstream-equivalent dependency wrapper records source, version, license, notices, update policy, and exact distribution paths"
      ],
      acceptance:
        "License/provenance and dependency assumptions are accepted before SimplePie wrapper distribution or MagpieRSS exception renewal becomes durable policy.",
      fallback_policy:
        "Do not broaden official WordPress distribution dependency assumptions or diverge feed vendor files while provenance, notices, or dependency paths are unsettled.",
      removal_gate:
        "Do not distribute divergent SimplePie or rss.php files without WPHX-323.17 provenance and replacement-decision evidence."
    },
    {
      id: "feed-vendor-ecosystem-fallback-and-replacement-decision",
      boundary_ids: ["simplepie", "magpie_rss"],
      downstream_issue: DOWNSTREAM_ISSUES.feed_vendor_provenance_decision,
      gate_kind: "ecosystem_fallback_and_decision",
      required_before: ["copied_feed_vendor_retirement", "haxe_owned_feed_vendor_runtime_claim", "generated_feed_wrapper_claim"],
      required_observations: [
        "plugin-visible SimplePie class_exists/interface_exists, constants, methods, autoload, and reflection behavior",
        "deprecated MagpieRSS globals, constants, hooks, functions, and class fields used by plugins or legacy callers",
        "fallback matrix records when preserved upstream SimplePie or rss.php remains active",
        "replacement decision chooses generated SimplePie wrapper, renewed SimplePie exception, renewed MagpieRSS exception, or direct Haxe port using recorded evidence",
        "browser/widget/block/database installed evidence is separated from parser/library evidence"
      ],
      acceptance:
        "A future receipt chooses wrapper or renewed exceptions based on concrete ecosystem, parser, cache, transport, provenance, and installed-route evidence.",
      fallback_policy:
        "Default to preserved upstream SimplePie and renewed MagpieRSS exception until WPHX-323.14, WPHX-323.15, WPHX-323.16, and WPHX-323.17 together prove safer replacement paths.",
      removal_gate:
        "Do not claim Haxe-owned feed vendor runtime logic or copied artifact retirement without an explicit WPHX-323.17 replacement decision receipt."
    }
  ];

  if (gatePlan.length !== 5) failures.push(`expected 5 feed vendor gates, found ${gatePlan.length}`);
  if (failures.length > 0) {
    throw new Error(`WPHX-323.04 feed vendor gate plan failed:\n- ${failures.join("\n- ")}`);
  }

  const validationResult = {
    planned_boundary_ids: ["simplepie", "magpie_rss"],
    planned_boundary_count: 2,
    simplepie_source_inventory_count: simplepieBoundary.source_inventory.count,
    simplepie_distribution_artifact_count: simplepieBoundary.distribution_artifacts.count,
    magpie_source_inventory_count: magpieBoundary.source_inventory.count,
    magpie_distribution_artifact_count: magpieBoundary.distribution_artifacts.count,
    feed_support_artifact_count: supportSourceFiles.length,
    source_record_count: sourceRecords.length,
    support_source_record_count: supportSourceRecords.length,
    artifact_provenance_record_count: artifactEvidence.length,
    gate_count: gatePlan.length,
    downstream_issue_count: Object.keys(DOWNSTREAM_ISSUES).length,
    existing_evidence_count: evidenceRecords.length,
    simplepie_bsd_3_clause_marker_count: simplepieBsdMarkerCount,
    simplepie_psr_dependency_file_count: simplepiePsrDependencyFiles.length,
    simplepie_version_markers: simplepieVersions,
    magpie_gpl_marker: magpieMarkers.gpl_marker,
    magpie_deprecated_marker: magpieMarkers.deprecated_marker
  };

  const manifest = {
    schema: "wphx.wp-core-feed-vendor-replacement-gates.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: {
      runner: RUNNER,
      mode: "deterministic"
    },
    scope: {
      parent_strategy_manifest: STRATEGY,
      covered_boundaries: [
        {
          id: simplepiePlan.id,
          name: simplepiePlan.name,
          kind: simplepiePlan.kind,
          source_path: simplepiePlan.source_path,
          distribution_path: simplepiePlan.distribution_path,
          current_strategy: simplepiePlan.current_strategy,
          replacement_strategy: simplepiePlan.replacement_strategy,
          source_inventory_count: simplepieBoundary.source_inventory.count,
          distribution_artifact_count: simplepieBoundary.distribution_artifacts.count
        },
        {
          id: magpiePlan.id,
          name: magpiePlan.name,
          kind: magpiePlan.kind,
          source_path: magpiePlan.source_path,
          distribution_path: magpiePlan.distribution_path,
          current_strategy: magpiePlan.current_strategy,
          replacement_strategy: magpiePlan.replacement_strategy,
          source_inventory_count: magpieBoundary.source_inventory.count,
          distribution_artifact_count: magpieBoundary.distribution_artifacts.count
        }
      ],
      selected_paths: [
        {
          boundary_id: "simplepie",
          decision: "generated_wrapper_around_upstream_equivalent_dependency_with_preserved_upstream_fallback",
          rationale:
            "SimplePie is a broad public parser API with feed corpus, cache, sanitizer, autoload, and dependency behavior. The near-term WPHX path requires generated wrappers or an explicitly renewed preserved exception, not a from-scratch parser claim.",
          fallback_required_until: [
            "WPHX-323.14 SimplePie API/reflection and feed corpus fixture",
            "WPHX-323.15 WordPress feed wrapper cache and transport gate",
            "WPHX-323.17 feed vendor provenance and replacement decision receipt"
          ]
        },
        {
          boundary_id: "magpie_rss",
          decision: "renewed_preserved_artifact_exception_with_tests_provenance",
          rationale:
            "MagpieRSS is deprecated legacy feed compatibility code. Renewing the preserved artifact exception is safer unless ecosystem evidence shows direct replacement pressure.",
          fallback_required_until: [
            "WPHX-323.16 MagpieRSS legacy exception gate",
            "WPHX-323.17 feed vendor provenance and replacement decision receipt"
          ]
        }
      ],
      support_artifacts: [
        {
          path: "wp-includes/rss-functions.php",
          role: "deprecated support wrapper that hands off to rss.php and class-simplepie.php",
          source_record: supportSourceRecords[0]
        }
      ]
    },
    inputs: {
      replacement_strategy_manifest: fileRecord(STRATEGY),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      artifact_provenance: fileRecord(ARTIFACT_PROVENANCE),
      source_records: sourceRecords,
      support_source_records: supportSourceRecords,
      artifact_evidence: artifactEvidence,
      source_marker_summary: {
        simplepie_bsd_3_clause_marker_count: simplepieBsdMarkerCount,
        simplepie_psr_dependency_files: simplepiePsrDependencyFiles,
        simplepie_version_markers: simplepieVersions,
        magpie_gpl_marker: magpieMarkers.gpl_marker,
        magpie_deprecated_marker: magpieMarkers.deprecated_marker
      },
      existing_evidence: evidenceRecords
    },
    downstream_issues: DOWNSTREAM_ISSUES,
    gate_plan: gatePlan,
    fallback_matrix: [
      {
        condition: "generated wrapper shape cannot preserve SimplePie public API, constants, autoload, parser behavior, cache/sanitizer handoffs, or reflection names",
        required_behavior: "Renew preserved upstream SimplePie exception; do not distribute divergent SimplePie package files."
      },
      {
        condition: "SimplePie replacement would require new external PSR/composer runtime dependencies not assumed by the official WordPress distribution",
        required_behavior: "Preserve upstream SimplePie until an ADR and dependency/provenance receipt admit the dependency path."
      },
      {
        condition: "feed transport reaches live providers, TLS, proxy, DNS, redirects, provider-specific malformed content, persistent object caches, or database-backed installed state",
        required_behavior: "Use preserved upstream SimplePie and WordPress wrappers until dedicated controlled, live, and installed gates pass."
      },
      {
        condition: "MagpieRSS deprecated parser/cache/display compatibility remains plugin-visible or caller pressure is unknown",
        required_behavior: "Renew preserved upstream rss.php exception with tests and provenance instead of direct Haxe port."
      },
      {
        condition: "license/provenance notices, version policy, artifact paths, or package-header preservation are unsettled",
        required_behavior: "Do not diverge feed vendor distribution files."
      }
    ],
    wrapper_requirements: [
      "Generated SimplePie original-path wrappers must be produced by WPHX PHP, Adapter IR, linker/profile metadata, or accepted compiler/backend evidence.",
      "Wrappers must preserve SimplePie namespaces, legacy global class/constants, autoload behavior, public API/reflection, parser error shapes, cache/sanitizer hooks, and WordPress feed wrapper handoffs.",
      "Candidate package divergence requires a non-empty overlay manifest listing each generated wrapper or dependency-backed file and its replaced upstream hash.",
      "SimplePie parser behavior must be backed by a feed corpus before wrapper distribution; MagpieRSS must stay a renewed preserved exception unless a direct replacement receipt proves ecosystem need.",
      "Wrapper or replacement bodies must not be durable hand-authored public PHP or JavaScript-runner string replacements."
    ],
    validation_result: validationResult,
    claims: [
      "SimplePie and MagpieRSS now have a machine-readable replacement gate plan linked to WPHX-323.01 and WPHX-323 preserved-vendor closure.",
      "The selected SimplePie path is generated wrapper around an upstream-equivalent dependency with preserved upstream fallback until API/reflection, corpus, wrapper/cache/transport, and provenance/replacement decision gates pass.",
      "The selected MagpieRSS path is a renewed preserved-artifact exception with parser/cache/display fixtures, caller review, provenance, and replacement-decision evidence.",
      "Existing WPHX-312 feed, cache, widget, block, and installed-style evidence is recorded as prerequisite behavior floor, not copied artifact retirement."
    ],
    non_claims: [
      "This plan does not implement a Haxe-owned SimplePie or MagpieRSS runtime.",
      "This plan does not generate, validate, or distribute public SimplePie wrapper files.",
      "This plan does not replace copied SimplePie, rss.php, rss-functions.php, or WordPress feed wrapper public PHP artifacts.",
      "This plan does not claim live external feed provider behavior, TLS, proxy, DNS, persistent object-cache, database-backed installed feed state, browser/widget/block parity, or installed WordPress feed parity.",
      "Existing WPHX-312 evidence remains preserved/copy-oracle, deterministic wrapper, and installed-style bridge evidence, not durable public PHP ownership."
    ]
  };

  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestText);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-04-feed-vendor-replacement-gates",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "feed_vendor_replacement_gate_plan",
    artifact_scope: "simplepie-and-magpie-rss-preserved-vendor-boundaries",
    commands: ["npm run wp:core:wphx-323-feed-vendor-replacement-gates", "npm run wp:core:wphx-323-feed-vendor-replacement-gates:check"],
    artifacts: {
      manifest: OUT,
      parent_strategy_manifest: STRATEGY,
      vendor_closure_manifest: VENDOR_CLOSURE
    },
    manifest_sha256: sha256(manifestText),
    validation_result: validationResult,
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };
  writeOrCheck(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);

  const verb = checkOnly ? "validated" : "wrote";
  console.log(`${verb} ${OUT}`);
  console.log(`${verb} ${RECEIPT}`);
  console.log(`planned ${gatePlan.length} feed vendor gates for SimplePie and MagpieRSS`);
}

main();
