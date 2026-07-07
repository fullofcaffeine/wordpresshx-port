#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.36",
  external_ref: "WPHX-323.16",
  title: "Add MagpieRSS legacy exception gate"
};
const RECORDED_AT = "2026-07-08T02:30:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-magpie-rss-legacy-exception-gate.mjs";
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const FEED_GATES = "manifests/wp-core/wphx-323-04-feed-vendor-replacement-gates.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const OUT = "manifests/wp-core/wphx-323-16-magpie-rss-legacy-exception-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-16-magpie-rss-legacy-exception-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-16-magpie-rss-legacy-exception-gate.v1.json";

const MAGPIE_SOURCE = "src/wp-includes/rss.php";
const MAGPIE_DISTRIBUTION = "wp-includes/rss.php";
const RSS_FUNCTIONS_SOURCE = "src/wp-includes/rss-functions.php";
const RSS_FUNCTIONS_DISTRIBUTION = "wp-includes/rss-functions.php";

const EXISTING_EVIDENCE = [
  {
    id: "wphx-312-21-deprecated-embed-rss-wrapper",
    external_ref: "WPHX-312.21",
    manifest: "manifests/wp-core/wphx-312-21-deprecated-embed-rss-wrapper-oracle-fixture.v1.json",
    ownership_manifest: "manifests/ownership/wphx-312-21-deprecated-embed-rss-wrapper-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-21-deprecated-embed-rss-wrapper-oracle-fixture.v1.json",
    behavior_floor: "rss-functions.php deprecated wrapper handoff into rss.php/class-simplepie.php under deterministic required-file stubs"
  },
  {
    id: "wphx-312-22-magpie-rss-parser",
    external_ref: "WPHX-312.22",
    manifest: "manifests/wp-core/wphx-312-22-magpie-rss-parser-oracle-fixture.v1.json",
    ownership_manifest: "manifests/ownership/wphx-312-22-magpie-rss-parser-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-22-magpie-rss-parser-oracle-fixture.v1.json",
    behavior_floor: "MagpieRSS parser fields, namespace handling, RSS2/RDF/Atom normalization, response headers, status helpers, and pure RSSCache helpers"
  },
  {
    id: "wphx-312-23-magpie-rss-fetch-cache",
    external_ref: "WPHX-312.23",
    manifest: "manifests/wp-core/wphx-312-23-magpie-rss-fetch-cache-oracle-fixture.v1.json",
    ownership_manifest: "manifests/ownership/wphx-312-23-magpie-rss-fetch-cache-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-23-magpie-rss-fetch-cache-oracle-fixture.v1.json",
    behavior_floor: "fetch_rss, _fetch_remote_file, WP HTTP response/error conversion, cache hit/miss, RSSCache transient keys, and stale/cache quirks"
  },
  {
    id: "wphx-312-24-magpie-rss-display-helper",
    external_ref: "WPHX-312.24",
    manifest: "manifests/wp-core/wphx-312-24-magpie-rss-display-helper-oracle-fixture.v1.json",
    ownership_manifest: "manifests/ownership/wphx-312-24-magpie-rss-display-helper-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-24-magpie-rss-display-helper-oracle-fixture.v1.json",
    behavior_floor: "wp_rss/get_rss output, escaping quirks, slicing, failure output/return behavior, and cached feed display helpers"
  }
];

const REQUIRED_REMOVAL_EVIDENCE = [
  "generated original-path adapter or explicit Haxe-owned implementation evidence for rss.php and rss-functions.php",
  "PHP lint plus generated-shape/AST contracts for every diverged MagpieRSS public path",
  "WPHX-312 parser, fetch/cache, display, and deprecated-wrapper fixtures remain passing after divergence",
  "selected upstream feed/widget/dashboard PHPUnit and installed route evidence appropriate to any broadened claim",
  "ecosystem/plugin scan proving direct MagpieRSS/fetch_rss/wp_rss/get_rss usage is either unsupported, preserved, or intentionally replaced",
  "license/provenance receipt preserving WordPress GPL project treatment and MagpieRSS file headers",
  "fallback matrix keeping preserved upstream rss.php active for malformed legacy feeds, transient cache quirks, and display helper edge cases not yet modeled"
];

const FALLBACK_MATRIX = [
  {
    condition: "direct Haxe port cannot preserve MagpieRSS parser fields, namespace normalization, RSS/RDF/Atom quirks, malformed XML behavior, or PHP XML-extension error shape",
    decision: "renew_preserved_upstream_rss_php_exception"
  },
  {
    condition: "replacement cannot preserve fetch_rss remote response conversion, RSSCache transient key behavior, cache hit/miss flags, or stale/cache quirks",
    decision: "renew_preserved_upstream_rss_php_exception"
  },
  {
    condition: "replacement cannot preserve wp_rss/get_rss escaping/output quirks and failure return/output shape",
    decision: "renew_preserved_upstream_rss_php_exception"
  },
  {
    condition: "core or plugin caller pressure depends on deprecated MagpieRSS globals, hooks, functions, class fields, or exact include timing beyond current fixtures",
    decision: "preserve_upstream_until_ecosystem_fixture_or_adapter_evidence_exists"
  },
  {
    condition: "license/provenance, generated wrapper shape, or candidate overlay records are incomplete",
    decision: "do_not_diverge_rss_php_or_rss_functions_php"
  }
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
  return {
    path,
    distribution_path: path.replace(/^src\//, ""),
    magpie_marker: /MagpieRSS/i.test(head),
    wordpress_package_marker: /@package WordPress/i.test(head),
    external_package_marker: /@package External/i.test(head),
    deprecated_marker: /@deprecated|_deprecated_file/i.test(head),
    gpl_marker: /@license\s+GPL|GNU General Public License|GPL/i.test(head),
    load_feed_engine_marker: /load_feed_engine/.test(content),
    simplepie_replacement_marker: /class-simplepie\.php|Use SimplePie/i.test(content),
    version_markers: [...new Set([...content.matchAll(/@version\s+([^\s]+)/g)].map((match) => match[1]))]
  };
}

function walkPhpFiles(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return walkPhpFiles(path);
      if (entry.isFile() && path.endsWith(".php")) return [path];
      return [];
    });
}

function callerReview() {
  const root = `${UPSTREAM_ROOT}/src`;
  const patterns = [
    { id: "magpie_symbol_or_function", regex: /\b(MagpieRSS|fetch_rss|wp_rss|get_rss|load_feed_engine)\b/ },
    { id: "rss_php_include", regex: /WPINC\s*\.\s*['"]\/rss\.php['"]|['"]\/rss\.php['"]/ },
    { id: "rss_functions_reference", regex: /rss-functions\.php/ }
  ];
  const matches = [];
  for (const file of walkPhpFiles(root)) {
    const relative = file.slice(root.length + 1);
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const matched = patterns.filter((pattern) => pattern.regex.test(trimmed)).map((pattern) => pattern.id);
      if (matched.length > 0) {
        matches.push({ path: relative, line: index + 1, matched, text: trimmed });
      }
    });
  }
  const runtimeOutsideMagpie = matches.filter(
    (entry) =>
      !entry.path.endsWith("wp-includes/rss.php") &&
      !entry.path.endsWith("wp-includes/rss-functions.php") &&
      entry.matched.includes("magpie_symbol_or_function")
  );
  const wrapperReferences = matches.filter((entry) => entry.path.endsWith("wp-includes/rss-functions.php"));
  return {
    scanned_php_file_count: walkPhpFiles(root).length,
    match_count: matches.length,
    matches,
    runtime_magpie_symbol_references_outside_rss_files: runtimeOutsideMagpie,
    deprecated_wrapper_references: wrapperReferences,
    conclusion:
      runtimeOutsideMagpie.length === 0
        ? "WordPress 7.0 core PHP references MagpieRSS runtime symbols only inside rss.php plus the deprecated rss-functions.php wrapper; broader plugin ecosystem pressure remains unscanned."
        : "WordPress 7.0 core PHP has runtime MagpieRSS references outside rss.php/rss-functions.php; replacement needs additional caller fixtures."
  };
}

function evidenceRecord(entry) {
  const manifest = readJson(entry.manifest);
  const ownership = readJson(entry.ownership_manifest);
  const receipt = readJson(entry.receipt);
  return {
    ...entry,
    manifest_record: fileRecord(entry.manifest),
    ownership_record: fileRecord(entry.ownership_manifest),
    receipt_record: fileRecord(entry.receipt),
    validation_result: manifest.validation_result,
    ownership_state: ownership.boundary?.ownership_state ?? ownership.ownership_state ?? null,
    receipt_status: receipt.status,
    receipt_evidence_class: receipt.evidence_class
  };
}

function main() {
  const failures = [];
  const strategy = readJson(STRATEGY);
  const feedGates = readJson(FEED_GATES);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const magpiePlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "magpie_rss");
  const magpieBoundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "magpie_rss");
  const magpieGate = feedGates.gate_plan.find((entry) => entry.id === "magpie-rss-legacy-parser-cache-display-exception");
  const evidenceRecords = EXISTING_EVIDENCE.map(evidenceRecord);
  const artifactEvidence = artifactRecords([MAGPIE_DISTRIBUTION, RSS_FUNCTIONS_DISTRIBUTION]);
  const sourceRecords = [sourceRecord(MAGPIE_SOURCE), sourceRecord(RSS_FUNCTIONS_SOURCE)];
  const headerEvidence = [headerMarkers(MAGPIE_SOURCE), headerMarkers(RSS_FUNCTIONS_SOURCE)];
  const callers = callerReview();

  if (magpiePlan?.followup_issue.external_ref !== "WPHX-323.04") {
    failures.push("WPHX-323.01 MagpieRSS plan is not routed to WPHX-323.04");
  }
  if (magpiePlan?.replacement_strategy !== "renewed_preserved_artifact_exception_with_tests_provenance") {
    failures.push(`unexpected MagpieRSS replacement strategy: ${magpiePlan?.replacement_strategy}`);
  }
  if (magpieGate?.downstream_issue.external_ref !== ISSUE.external_ref) {
    failures.push("WPHX-323.04 MagpieRSS exception gate is not routed to WPHX-323.16");
  }
  if (magpieBoundary?.source_inventory.count !== 1 || magpieBoundary?.distribution_artifacts.count !== 1) {
    failures.push("expected MagpieRSS source and distribution artifact counts of 1");
  }
  for (const record of evidenceRecords) {
    if (record.validation_result?.status !== "passed") failures.push(`${record.id} status is not passed`);
    if (record.validation_result?.observations_match !== true) failures.push(`${record.id} observations do not match`);
    if (record.validation_result?.public_php_replacement_claimed !== false) failures.push(`${record.id} unexpectedly claims public PHP replacement`);
  }
  if (artifactEvidence.length !== 2) failures.push(`expected 2 rss.php/rss-functions artifact records, found ${artifactEvidence.length}`);
  const magpieHeader = headerEvidence.find((entry) => entry.path === MAGPIE_SOURCE);
  const wrapperHeader = headerEvidence.find((entry) => entry.path === RSS_FUNCTIONS_SOURCE);
  if (!magpieHeader?.magpie_marker || !magpieHeader?.gpl_marker || !magpieHeader?.deprecated_marker) {
    failures.push("rss.php header markers do not record MagpieRSS GPL deprecated provenance");
  }
  if (!magpieHeader?.load_feed_engine_marker || !magpieHeader?.simplepie_replacement_marker) {
    failures.push("rss.php missing load_feed_engine or SimplePie replacement marker");
  }
  if (!wrapperHeader?.wordpress_package_marker || !wrapperHeader?.deprecated_marker) {
    failures.push("rss-functions.php wrapper header markers are incomplete");
  }
  if (callers.runtime_magpie_symbol_references_outside_rss_files.length !== 0) {
    failures.push("WordPress core PHP runtime MagpieRSS callers outside rss.php/rss-functions.php need explicit fixtures");
  }
  if (failures.length > 0) {
    throw new Error(`WPHX-323.16 MagpieRSS legacy exception gate failed:\n- ${failures.join("\n- ")}`);
  }

  const decision = {
    boundary_id: "magpie_rss",
    current_decision: "renew_preserved_upstream_rss_php_exception",
    replacement_strategy: magpiePlan.replacement_strategy,
    rationale:
      "MagpieRSS is deprecated compatibility code, SimplePie is the preferred feed path, WordPress 7.0 core PHP has no runtime MagpieRSS symbol pressure outside rss.php/rss-functions.php, and WPHX-312 behavior floors already cover parser, fetch/cache, display, and deprecated wrapper behavior. A direct Haxe port is not admitted before ecosystem pressure or generated original-path adapter evidence exists.",
    generated_replacement_blocked_until: REQUIRED_REMOVAL_EVIDENCE,
    fallback_matrix: FALLBACK_MATRIX
  };

  const validationResult = {
    status: "passed",
    renewed_preserved_exception: true,
    planned_boundary_ids: ["magpie_rss"],
    behavior_floor_count: evidenceRecords.length,
    artifact_provenance_record_count: artifactEvidence.length,
    source_record_count: sourceRecords.length,
    caller_scan_php_file_count: callers.scanned_php_file_count,
    caller_match_count: callers.match_count,
    runtime_magpie_symbol_references_outside_rss_files: callers.runtime_magpie_symbol_references_outside_rss_files.length,
    rss_php_gpl_marker: magpieHeader.gpl_marker,
    rss_php_deprecated_marker: magpieHeader.deprecated_marker,
    rss_php_load_feed_engine_marker: magpieHeader.load_feed_engine_marker,
    rss_functions_deprecated_marker: wrapperHeader.deprecated_marker,
    generated_overlay_manifest_present: false,
    generated_public_php_replacement_claimed: false,
    copied_artifact_retirement_claimed: false,
    haxe_runtime_ownership_claimed: false
  };

  const manifest = {
    schema: "wphx.wp-core-magpie-rss-legacy-exception-gate.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: {
      runner: RUNNER,
      mode: "deterministic_exception_decision_gate"
    },
    scope: {
      boundary_id: "magpie_rss",
      source_path: MAGPIE_DISTRIBUTION,
      support_wrapper_path: RSS_FUNCTIONS_DISTRIBUTION,
      current_strategy: magpiePlan.current_strategy,
      replacement_strategy: magpiePlan.replacement_strategy,
      gate_plan: magpieGate
    },
    inputs: {
      replacement_strategy_manifest: fileRecord(STRATEGY),
      feed_vendor_gates_manifest: fileRecord(FEED_GATES),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      artifact_provenance: fileRecord(ARTIFACT_PROVENANCE),
      source_records: sourceRecords,
      artifact_evidence: artifactEvidence,
      header_evidence: headerEvidence,
      behavior_floors: evidenceRecords
    },
    caller_review: callers,
    decision,
    validation_result: validationResult,
    claims: [
      "MagpieRSS has a renewed preserved-artifact exception decision backed by WPHX-312 parser, fetch/cache, display, and deprecated wrapper behavior floors.",
      "rss.php and rss-functions.php provenance, header markers, artifact provenance, and core PHP caller pressure are recorded before any distribution divergence.",
      "Generated replacement or direct Haxe port claims remain blocked on explicit original-path adapter, ecosystem, installed, provenance, and behavior evidence."
    ],
    non_claims: [
      "This gate does not implement or claim Haxe-owned MagpieRSS runtime logic.",
      "This gate does not emit generated rss.php or rss-functions.php public PHP replacements.",
      "This gate does not retire copied/preserved rss.php or rss-functions.php artifacts.",
      "This gate does not claim live external feed behavior, TLS, proxy, DNS, persistent object-cache, database-backed installed feed state, RSS widget/dashboard installed parity, or broad plugin ecosystem compatibility.",
      "The renewed exception is bounded preserved-artifact evidence, not a precedent that copied PHP is a durable implementation path."
    ]
  };

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    evidence: OUT,
    boundary: {
      id: "magpie_rss",
      paths: [MAGPIE_DISTRIBUTION, RSS_FUNCTIONS_DISTRIBUTION],
      ownership_state: "renewed_preserved_upstream_artifact_exception",
      emission_strategy: "preserved_upstream_public_php_exception_with_behavior_floor_receipts",
      behavior_parity_claimed: true,
      behavior_parity_scope: "WPHX-312 parser_fetch_cache_display_and_deprecated_wrapper_behavior_floors_only",
      haxe_runtime_ownership_claimed: false,
      generated_public_php_replacement_claimed: false,
      copied_artifact_retirement_claimed: false,
      generated_overlay_manifest_present: false,
      durable_original_path_adapter_claimed: false
    },
    removal_gate:
      "Do not retire preserved rss.php/rss-functions.php or claim Haxe-owned MagpieRSS runtime until generated original-path adapter or direct Haxe implementation evidence exists, behavior floors remain passing after divergence, ecosystem/direct-caller pressure is reviewed, provenance/license evidence is accepted, installed feed/widget/dashboard gates pass where claimed, and fallback policy is updated.",
    non_claims: manifest.non_claims
  };

  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestText);
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-16-magpie-rss-legacy-exception-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "magpie_rss_renewed_preserved_artifact_exception_gate",
    artifact_scope: "wp-includes/rss.php and wp-includes/rss-functions.php",
    commands: ["npm run wp:core:wphx-323-magpie-rss-legacy-exception", "npm run wp:core:wphx-323-magpie-rss-legacy-exception:check"],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      feed_vendor_gates_manifest: FEED_GATES,
      vendor_closure_manifest: VENDOR_CLOSURE
    },
    manifest_sha256: sha256(manifestText),
    validation_result: validationResult,
    decision,
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };
  writeOrCheck(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);

  const verb = checkOnly ? "validated" : "wrote";
  console.log(`${verb} ${OUT}`);
  console.log(`${verb} ${OWNERSHIP}`);
  console.log(`${verb} ${RECEIPT}`);
  console.log(`renewed MagpieRSS preserved exception with ${evidenceRecords.length} behavior floors`);
}

main();
