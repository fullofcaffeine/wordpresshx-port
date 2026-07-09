#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.32.6",
  external_ref: "WPHX-323.36",
  title: "Add localization legacy vendor provenance decision gate"
};
const RECORDED_AT = "2026-07-09T05:45:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-localization-legacy-vendor-provenance-decision-gate.mjs";
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const LOCALIZATION_GATES = "manifests/wp-core/wphx-323-06-localization-legacy-vendor-replacement-gates.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const LICENSE_PROVENANCE = "manifests/license-provenance.v1.json";
const SOURCE_INVENTORY = "manifests/source-inventory.jsonl";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const POMO_GATE = "manifests/wp-core/wphx-323-31-pomo-localization-corpus-gate.v1.json";
const PHP_COMPAT_GATE = "manifests/wp-core/wphx-323-32-php-compat-readonly-shim-gate.v1.json";
const TEXT_DIFF_GATE = "manifests/wp-core/wphx-323-33-text-diff-api-renderer-corpus-gate.v1.json";
const SERVICES_JSON_GATE = "manifests/wp-core/wphx-323-34-services-json-legacy-compatibility-gate.v1.json";
const IXR_GATE = "manifests/wp-core/wphx-323-35-ixr-xmlrpc-value-message-corpus-gate.v1.json";
const OUT = "manifests/wp-core/wphx-323-36-localization-legacy-vendor-provenance-decision-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-36-localization-legacy-vendor-provenance-decision-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-36-localization-legacy-vendor-provenance-decision-gate.v1.json";

const BOUNDARY_IDS = ["pomo", "php_compat", "text_diff", "services_json", "ixr"];
const REQUIRED_PRIOR_GATES = [
  {
    id: "wphx-323-31-pomo-localization-corpus-gate",
    boundary_id: "pomo",
    manifest: POMO_GATE,
    expected_external_ref: "WPHX-323.31",
    role: "POMO localization catalog parser/API corpus floor"
  },
  {
    id: "wphx-323-32-php-compat-readonly-shim-gate",
    boundary_id: "php_compat",
    manifest: PHP_COMPAT_GATE,
    expected_external_ref: "WPHX-323.32",
    role: "php-compat readonly host-version shim floor"
  },
  {
    id: "wphx-323-33-text-diff-api-renderer-corpus-gate",
    boundary_id: "text_diff",
    manifest: TEXT_DIFF_GATE,
    expected_external_ref: "WPHX-323.33",
    role: "Text_Diff algorithm/API/renderer corpus floor"
  },
  {
    id: "wphx-323-34-services-json-legacy-compatibility-gate",
    boundary_id: "services_json",
    manifest: SERVICES_JSON_GATE,
    expected_external_ref: "WPHX-323.34",
    role: "Services_JSON legacy compatibility and host JSON differential floor"
  },
  {
    id: "wphx-323-35-ixr-xmlrpc-value-message-corpus-gate",
    boundary_id: "ixr",
    manifest: IXR_GATE,
    expected_external_ref: "WPHX-323.35",
    role: "IXR XML-RPC value/message/client/server corpus floor"
  }
];
const EXPECTED_STRATEGIES = {
  pomo: "direct_haxe_port_preserving_vendor_api",
  php_compat: "host_primitive_backed_reimplementation_with_preserved_fallback",
  text_diff: "direct_haxe_port_preserving_vendor_api",
  services_json: "host_primitive_backed_reimplementation_with_preserved_fallback",
  ixr: "direct_haxe_port_preserving_vendor_api"
};
const BOUNDARY_PATHS = {
  pomo: ["wp-includes/pomo/"],
  php_compat: ["wp-includes/php-compat/readonly.php"],
  text_diff: ["wp-includes/Text/"],
  services_json: ["wp-includes/class-json.php"],
  ixr: ["wp-includes/IXR/", "wp-includes/class-IXR.php"]
};
const CALLER_PATTERNS = [
  { id: "pomo_translation_entry", boundary_id: "pomo", regex: /\bTranslation_Entry\b/g },
  { id: "pomo_translations", boundary_id: "pomo", regex: /\b(?:NOOP_)?Translations\b/g },
  { id: "pomo_po_mo_constructors", boundary_id: "pomo", regex: /\b(?:PO|MO)\s*\(/g },
  { id: "pomo_plural_forms", boundary_id: "pomo", regex: /\bPlural_Forms\b/g },
  { id: "pomo_textdomain_loading", boundary_id: "pomo", regex: /\b(?:load_textdomain|load_theme_textdomain|load_plugin_textdomain)\s*\(/g },
  { id: "pomo_translation_lookup", boundary_id: "pomo", regex: /\bget_translations_for_domain\s*\(/g },
  { id: "php_compat_readonly_function", boundary_id: "php_compat", regex: /\breadonly\s*\(/g },
  { id: "php_compat_wp_readonly_handoff", boundary_id: "php_compat", regex: /\bwp_readonly\s*\(/g },
  { id: "php_compat_readonly_path", boundary_id: "php_compat", regex: /php-compat\/readonly\.php/g },
  { id: "text_diff_classes", boundary_id: "text_diff", regex: /\bText_Diff(?:_[A-Za-z0-9_]+)?\b/g },
  { id: "text_diff_wp_helper", boundary_id: "text_diff", regex: /\bwp_text_diff\s*\(/g },
  { id: "text_diff_table_renderer", boundary_id: "text_diff", regex: /\bWP_Text_Diff_Renderer_Table\b/g },
  { id: "text_diff_mapped_diff", boundary_id: "text_diff", regex: /\bText_MappedDiff\b/g },
  { id: "services_json_classes", boundary_id: "services_json", regex: /\bServices_JSON(?:_Error)?\b/g },
  { id: "services_json_constants", boundary_id: "services_json", regex: /\bJSON_(?:SLICE|IN_STR|IN_ARR|IN_OBJ|IN_CMT|LOOSE_TYPE|SUPPRESS_ERRORS)\b/g },
  { id: "services_json_path", boundary_id: "services_json", regex: /class-json\.php/g },
  { id: "ixr_classes", boundary_id: "ixr", regex: /\bIXR_[A-Za-z0-9_]+\b/g },
  { id: "ixr_http_client", boundary_id: "ixr", regex: /\bWP_HTTP_IXR_Client\b/g },
  { id: "ixr_xmlrpc_server", boundary_id: "ixr", regex: /\bwp_xmlrpc_server\b/g },
  { id: "ixr_xmlrpc_token", boundary_id: "ixr", regex: /\bxmlrpc(?:_|\.php|$)/gi },
  { id: "ixr_xml_rpc_label", boundary_id: "ixr", regex: /\bXML-RPC\b/gi }
];
const REQUIRED_REPLACEMENT_EVIDENCE = {
  pomo: [
    "non-empty generated overlay manifest for any diverged POMO public PHP path",
    "generated WPHX PHP original-path classes preserving POMO class names, include order, public properties/methods, binary stream behavior, and native PHP arrays",
    "PO/MO corpus remains passing after divergence across contexts, plurals, headers, encodings, malformed files, streams, and error shapes",
    "localization bootstrap, translation cache, locale switching, admin localization, theme/plugin language file, and textdomain integration evidence",
    "selected upstream localization PHPUnit and installed theme/plugin/admin language-loading gates after generated divergence",
    "ecosystem scan for direct POMO class/function use, include timing, reflection, stream subclassing, and file path assumptions",
    "license/provenance review preserving WordPress project notice and upstream file header treatment before distribution divergence"
  ],
  php_compat: [
    "non-empty generated overlay manifest for wp-includes/php-compat/readonly.php divergence",
    "generated original-path readonly shim preserving conditional declaration timing, function_exists semantics, wp_readonly handoff, deprecated signaling, return/echo behavior, and repeated include behavior",
    "host-version matrix covering PHP versions that need the shim and PHP versions where readonly is reserved syntax",
    "bootstrap/deprecation evidence through WPHX-301/WPHX-303 and installed template/admin callers",
    "explicit proof that compat.php and compat-utf8.php remain outside this WPHX-323 php_compat boundary unless separately planned",
    "ecosystem scan for direct readonly() and wp_readonly() calls under supported host versions",
    "license/provenance review preserving WordPress project notice and upstream file header treatment before distribution divergence"
  ],
  text_diff: [
    "non-empty generated overlay manifest for any diverged wp-includes/Text public PHP path",
    "generated WPHX PHP original-path classes preserving Text_Diff legacy class names, constructors, engine/renderer include paths, public properties/methods, exceptions, and reflection shape",
    "native, string, shell, and xdiff engine corpus remains passing after divergence, including unavailable optional-engine fallbacks",
    "classic and inline renderer output remains passing for additions, deletions, changes, context, escaping, empty lines, word/character splits, and whitespace",
    "admin revision, plugin/theme editor, post diff, list-table, AJAX revision, and selected upstream admin/revision gates after generated divergence",
    "ecosystem scan for direct Text_Diff classes, custom renderers, optional engine assumptions, includes, and stack traces",
    "license/provenance review preserving Text_Diff header notices and WordPress project notice before distribution divergence"
  ],
  services_json: [
    "non-empty generated overlay manifest for wp-includes/class-json.php divergence",
    "generated original-path Services_JSON adapter preserving class names, constants, options, constructors, deprecated file/function behavior, warnings/errors, and Services_JSON_Error shape",
    "legacy encode/decode corpus remains passing after divergence for invalid UTF-8, comments, malformed payloads, object/array ambiguity, numeric/locale cases, resources, and toJSON",
    "host json_encode/json_decode differential policy explicitly routes divergent legacy edge behavior to preserved fallback",
    "WPHX-303 deprecated signaling and WPHX-318 XML-RPC/legacy callers remain passing after divergence",
    "ecosystem scan for direct Services_JSON use, constants, constructor flags, and deprecated class-json.php includes",
    "license/provenance review preserving Services_JSON header notices and WordPress project notice before distribution divergence"
  ],
  ixr: [
    "non-empty generated overlay manifest for any diverged wp-includes/IXR public PHP path",
    "generated WPHX PHP original-path IXR classes preserving class names, include order through class-IXR.php, public properties/methods, PHP4 constructor shims, and reflection shape",
    "IXR_Value, IXR_Message, IXR_Request, IXR_Error, IXR_Date, IXR_Base64, IXR_Client, IXR_ClientMulticall, IXR_Server, and IXR_IntrospectionServer corpus remains passing after divergence",
    "XML extension host matrix covering available/unavailable XML parser behavior, malformed XML, element limits, faults, base64/date handling, and warning/error shapes",
    "WPHX-318 installed XML-RPC route gates for xmlrpc.php dispatch, method handlers, auth/capabilities, media/pingback, database-backed behavior, and XML wire comparison",
    "ecosystem scan for direct IXR classes, wp_xmlrpc_server, WP_HTTP_IXR_Client, include order, and xmlrpc.php route/file assumptions",
    "license/provenance review preserving IXR/class-IXR.php header treatment and WordPress project notice before distribution divergence"
  ]
};

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path) {
  const content = readFileSync(path, "utf8").trim();
  if (!content) return [];
  return content.split("\n").map((line) => JSON.parse(line));
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

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run without --check to generate it`);
    if (readFileSync(path, "utf8") !== content) throw new Error(`${path} is stale; run without --check to refresh it`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function listFiles(path) {
  const full = upstreamPath(path);
  const stat = statSync(full);
  if (stat.isFile()) return [path];
  return readdirSync(full, { withFileTypes: true })
    .flatMap((entry) => listFiles(`${path}/${entry.name}`))
    .sort();
}

function listPhpFiles(root = "src") {
  return listFiles(root).filter((path) => path.endsWith(".php")).sort();
}

function distributionPath(path) {
  return path.replace(/^src\//, "");
}

function sourceInventoryRecords(sourcePaths) {
  const wanted = new Set(sourcePaths);
  return readJsonl(SOURCE_INVENTORY)
    .filter((record) => wanted.has(record.path))
    .map((record) => ({
      path: record.path,
      baseline: record.baseline,
      repo: record.repo,
      commit: record.commit,
      tree: record.tree,
      language: record.language,
      area: record.area,
      kind: record.kind,
      status: record.status,
      classified: record.classified
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function artifactRecords(distributionPaths) {
  const wanted = new Set(distributionPaths);
  return readJsonl(ARTIFACT_PROVENANCE)
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

function priorGateSummary(gate) {
  const manifest = readJson(gate.manifest);
  return {
    ...gate,
    manifest_sha256: sha256File(gate.manifest),
    issue: manifest.issue,
    validation_result: manifest.validation_result,
    source_file_count: manifest.source_files?.length ?? 0,
    artifact_provenance_record_count: manifest.artifact_provenance_records?.length ?? 0,
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };
}

function sourceRecordsFromPriorGates() {
  return REQUIRED_PRIOR_GATES.flatMap((gate) => readJson(gate.manifest).source_files ?? [])
    .map((record) => ({
      path: record.path,
      distribution_path: record.distribution_path,
      repo_path: record.repo_path,
      bytes: record.bytes,
      sha256: record.sha256
    }))
    .sort((a, b) => a.distribution_path.localeCompare(b.distribution_path));
}

function isBoundaryPath(boundaryId, path) {
  return BOUNDARY_PATHS[boundaryId].some((prefix) => (prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix));
}

function callerScan() {
  const phpFiles = listPhpFiles();
  const matches = [];
  for (const path of phpFiles) {
    const distribution = distributionPath(path);
    const content = readFileSync(upstreamPath(path), "utf8");
    const patternCounts = {};
    const boundaryCounts = {};
    for (const pattern of CALLER_PATTERNS) {
      pattern.regex.lastIndex = 0;
      const count = [...content.matchAll(pattern.regex)].length;
      if (count > 0) {
        patternCounts[pattern.id] = count;
        boundaryCounts[pattern.boundary_id] = (boundaryCounts[pattern.boundary_id] ?? 0) + count;
      }
    }
    if (Object.keys(patternCounts).length > 0) {
      const boundaryIds = Object.keys(boundaryCounts).sort();
      matches.push({
        path: distribution,
        boundary_ids: boundaryIds,
        pattern_counts: Object.fromEntries(Object.entries(patternCounts).sort(([a], [b]) => a.localeCompare(b))),
        boundary_owned_or_support_file: boundaryIds.some((id) => isBoundaryPath(id, distribution))
      });
    }
  }
  const byBoundary = {};
  for (const id of BOUNDARY_IDS) {
    const boundaryMatches = matches.filter((record) => record.boundary_ids.includes(id));
    const outside = boundaryMatches.filter((record) => !isBoundaryPath(id, record.path));
    const patternTotals = {};
    for (const record of boundaryMatches) {
      for (const [patternId, count] of Object.entries(record.pattern_counts)) {
        const pattern = CALLER_PATTERNS.find((entry) => entry.id === patternId);
        if (pattern?.boundary_id === id) patternTotals[patternId] = (patternTotals[patternId] ?? 0) + count;
      }
    }
    byBoundary[id] = {
      match_file_count: boundaryMatches.length,
      outside_boundary_match_file_count: outside.length,
      pattern_totals: Object.fromEntries(Object.entries(patternTotals).sort(([a], [b]) => a.localeCompare(b))),
      outside_boundary_matches: outside
        .map((record) => ({ path: record.path, pattern_counts: record.pattern_counts }))
        .sort((a, b) => a.path.localeCompare(b.path))
    };
  }
  return {
    php_file_count: phpFiles.length,
    total_match_file_count: matches.length,
    by_boundary: byBoundary
  };
}

function validateInputs({ strategy, localizationGates, vendorClosure, licenseProvenance, priorGates, sourceRecords, sourceInventory, artifactEvidence }) {
  const failures = [];
  const planById = Object.fromEntries(strategy.boundary_replacement_plan.filter((entry) => BOUNDARY_IDS.includes(entry.id)).map((entry) => [entry.id, entry]));
  const coveredBoundaries = Object.fromEntries(localizationGates.scope.covered_boundaries.map((entry) => [entry.id, entry]));
  const closureBoundaries = Object.fromEntries(vendorClosure.vendor_boundaries.filter((entry) => BOUNDARY_IDS.includes(entry.id)).map((entry) => [entry.id, entry]));
  const decisionGate = localizationGates.gate_plan.find((gate) => gate.id === "localization-legacy-provenance-decision");
  const wordpressLicense = licenseProvenance.upstreams.find((entry) => entry.id === "upstream:wordpress-7.0.0");

  if (decisionGate?.downstream_issue.external_ref !== ISSUE.external_ref) {
    failures.push("WPHX-323.06 localization/legacy decision gate does not route to WPHX-323.36");
  }
  for (const id of BOUNDARY_IDS) {
    if (planById[id]?.replacement_strategy !== EXPECTED_STRATEGIES[id]) {
      failures.push(`${id} has unexpected strategy ${planById[id]?.replacement_strategy}`);
    }
    if (!coveredBoundaries[id]) failures.push(`${id} missing from WPHX-323.06 covered boundaries`);
    if (!closureBoundaries[id]) failures.push(`${id} missing from WPHX-323 vendor closure`);
    if (coveredBoundaries[id]?.source_inventory_count !== closureBoundaries[id]?.source_inventory.count) {
      failures.push(`${id} source inventory count differs between WPHX-323.06 and vendor closure`);
    }
    if (coveredBoundaries[id]?.distribution_artifact_count !== closureBoundaries[id]?.distribution_artifacts.count) {
      failures.push(`${id} distribution artifact count differs between WPHX-323.06 and vendor closure`);
    }
  }
  for (const gate of priorGates) {
    if (gate.issue?.external_ref !== gate.expected_external_ref) {
      failures.push(`${gate.id} has unexpected issue ref ${gate.issue?.external_ref}`);
    }
    const validation = gate.validation_result ?? {};
    const claims = gate.claims ?? {};
    if (validation.status !== "passed") failures.push(`${gate.id} validation status is not passed`);
    if (validation.oracle_candidate_observations_match !== true) {
      failures.push(`${gate.id} oracle/candidate observations do not match`);
    }
    if (validation.fallback_policy_recorded !== true) failures.push(`${gate.id} does not record fallback policy`);
    if (claims.generated_public_php_replacement_claimed !== false) {
      failures.push(`${gate.id} unexpectedly claims generated public PHP replacement`);
    }
    const haxeClaim = Object.entries(claims).find(([key, value]) => key.includes("haxe_owned") && value !== false);
    if (haxeClaim) failures.push(`${gate.id} unexpectedly claims Haxe-owned runtime through ${haxeClaim[0]}`);
    const retirementClaim = Object.entries(claims).find(([key, value]) => key.includes("artifact_retirement_claimed") && value !== false);
    if (retirementClaim) failures.push(`${gate.id} unexpectedly claims copied artifact retirement through ${retirementClaim[0]}`);
    const legalClaim = Object.entries(claims).find(([key, value]) => key.includes("legal_review") && value !== false);
    if (legalClaim) failures.push(`${gate.id} unexpectedly claims legal review completion through ${legalClaim[0]}`);
  }
  if (sourceRecords.length !== 26) failures.push(`expected 26 localization/legacy source records, found ${sourceRecords.length}`);
  if (sourceInventory.length !== 26) failures.push(`expected 26 source inventory records, found ${sourceInventory.length}`);
  if (artifactEvidence.length !== 26) failures.push(`expected 26 artifact provenance records, found ${artifactEvidence.length}`);
  const parentSourcePaths = localizationGates.scope.source_records.map((record) => record.path).sort();
  const priorSourcePaths = sourceRecords.map((record) => record.path).sort();
  if (JSON.stringify(parentSourcePaths) !== JSON.stringify(priorSourcePaths)) {
    failures.push("WPHX-323.06 source records do not match WPHX-323.31-.35 source files");
  }
  if (wordpressLicense?.package_license !== "GPL-2.0-or-later" || wordpressLicense?.composer_license !== "GPL-2.0-or-later") {
    failures.push("WordPress 7.0 license record is not GPL-2.0-or-later");
  }
  if (failures.length > 0) {
    throw new Error(`WPHX-323.36 localization/legacy provenance decision failed:\n- ${failures.join("\n- ")}`);
  }
  return {
    planned_decision_gate: decisionGate,
    strategy_by_boundary: Object.fromEntries(BOUNDARY_IDS.map((id) => [id, planById[id]])),
    covered_boundaries: coveredBoundaries,
    vendor_closure_boundaries: Object.fromEntries(
      BOUNDARY_IDS.map((id) => [
        id,
        {
          source_tree: closureBoundaries[id].source_tree,
          source_inventory: closureBoundaries[id].source_inventory,
          distribution_artifacts: closureBoundaries[id].distribution_artifacts,
          license_provenance: closureBoundaries[id].license_provenance,
          closure_state: closureBoundaries[id].closure_state,
          removal_gate: closureBoundaries[id].removal_gate
        }
      ])
    ),
    wordpress_license_record: {
      package_license: wordpressLicense.package_license,
      composer_license: wordpressLicense.composer_license,
      project_license_file: wordpressLicense.project_license_file,
      bundled_notice_file_count: wordpressLicense.bundled_notice_files.length
    }
  };
}

function boundaryDecisions({ priorGates, inputs, callerReview }) {
  const priorByBoundary = Object.fromEntries(priorGates.map((gate) => [gate.boundary_id, gate]));
  return {
    pomo: {
      current_distribution_decision: "renew_preserved_pomo_exception_with_direct_haxe_port_path_blocked",
      future_replacement_path_status: "direct_haxe_port_candidate_but_not_admitted",
      rationale:
        "WPHX-323.31 records POMO parser/API corpus evidence, but generated original-path classes, localization bootstrap/admin/theme/plugin integration, selected installed gates, ecosystem caller review closure, and legal/provenance approval remain incomplete.",
      evidence_floor: priorByBoundary.pomo.id,
      required_replacement_evidence: REQUIRED_REPLACEMENT_EVIDENCE.pomo,
      fallback_policy: inputs.planned_decision_gate.fallback_policy,
      caller_review: callerReview.by_boundary.pomo
    },
    php_compat: {
      current_distribution_decision: "preserve_upstream_readonly_shim_with_host_version_floor",
      future_replacement_path_status: "host_primitive_backed_readonly_shim_candidate_but_not_admitted",
      rationale:
        "WPHX-323.32 records readonly.php API, include, deprecation, and current-host behavior, but cross-version host support, generated conditional declaration timing, bootstrap/deprecation installed evidence, and replacement provenance remain incomplete.",
      evidence_floor: priorByBoundary.php_compat.id,
      required_replacement_evidence: REQUIRED_REPLACEMENT_EVIDENCE.php_compat,
      fallback_policy: inputs.planned_decision_gate.fallback_policy,
      caller_review: callerReview.by_boundary.php_compat
    },
    text_diff: {
      current_distribution_decision: "renew_preserved_text_diff_exception_with_direct_haxe_port_path_blocked",
      future_replacement_path_status: "direct_haxe_port_candidate_but_not_admitted",
      rationale:
        "WPHX-323.33 records Text_Diff API, engine, and renderer corpus evidence, but generated original-path class emission, admin/revision/plugin/theme installed integration, optional-engine host matrix closure, ecosystem custom-renderer review, and legal/provenance approval remain incomplete.",
      evidence_floor: priorByBoundary.text_diff.id,
      required_replacement_evidence: REQUIRED_REPLACEMENT_EVIDENCE.text_diff,
      fallback_policy: inputs.planned_decision_gate.fallback_policy,
      caller_review: callerReview.by_boundary.text_diff
    },
    services_json: {
      current_distribution_decision: "preserve_upstream_services_json_with_host_json_differential_floor",
      future_replacement_path_status: "host_json_primitive_backed_candidate_but_not_admitted",
      rationale:
        "WPHX-323.34 records Services_JSON legacy corpus and host JSON differential evidence, but native JSON diverges on legacy comments/unquoted-name/single-quoted and malformed edge cases, and generated adapter, deprecated-signal integration, installed legacy callers, ecosystem review, and legal/provenance approval remain incomplete.",
      evidence_floor: priorByBoundary.services_json.id,
      required_replacement_evidence: REQUIRED_REPLACEMENT_EVIDENCE.services_json,
      fallback_policy: inputs.planned_decision_gate.fallback_policy,
      caller_review: callerReview.by_boundary.services_json
    },
    ixr: {
      current_distribution_decision: "renew_preserved_ixr_exception_with_direct_haxe_port_path_blocked",
      future_replacement_path_status: "direct_haxe_port_candidate_but_not_admitted",
      rationale:
        "WPHX-323.35 records IXR value/message/client/server corpus evidence and WPHX-318 anchors, but generated original-path IXR emission, XML extension host matrix, installed XML-RPC route execution, database/auth/media/pingback behavior, ecosystem include-order review, and legal/provenance approval remain incomplete.",
      evidence_floor: priorByBoundary.ixr.id,
      required_replacement_evidence: REQUIRED_REPLACEMENT_EVIDENCE.ixr,
      fallback_policy: inputs.planned_decision_gate.fallback_policy,
      caller_review: callerReview.by_boundary.ixr
    }
  };
}

function main() {
  const strategy = readJson(STRATEGY);
  const localizationGates = readJson(LOCALIZATION_GATES);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const licenseProvenance = readJson(LICENSE_PROVENANCE);
  const priorGates = REQUIRED_PRIOR_GATES.map(priorGateSummary);
  const sourceRecords = sourceRecordsFromPriorGates();
  const sourceInventory = sourceInventoryRecords(sourceRecords.map((record) => record.path));
  const artifactEvidence = artifactRecords(sourceRecords.map((record) => record.distribution_path));
  const inputs = validateInputs({ strategy, localizationGates, vendorClosure, licenseProvenance, priorGates, sourceRecords, sourceInventory, artifactEvidence });
  const callerReview = callerScan();
  const decisions = boundaryDecisions({ priorGates, inputs, callerReview });
  const directHaxePortCandidateCount = Object.values(inputs.covered_boundaries).filter((entry) => entry.direct_haxe_port_candidate).length;
  const hostPrimitiveBackedCandidateCount = Object.values(inputs.covered_boundaries).filter((entry) => entry.host_primitive_backed_candidate).length;
  const replacementEvidenceCount = Object.values(REQUIRED_REPLACEMENT_EVIDENCE).reduce((count, entries) => count + entries.length, 0);
  const validationResult = {
    status: "passed",
    boundary_count: BOUNDARY_IDS.length,
    source_php_file_count: sourceRecords.length,
    source_inventory_record_count: sourceInventory.length,
    artifact_provenance_record_count: artifactEvidence.length,
    prior_gate_count: priorGates.length,
    prior_gates_passing: true,
    decision_gate_routed_to_wphx_323_36: inputs.planned_decision_gate.downstream_issue.external_ref === ISSUE.external_ref,
    caller_scan_php_file_count: callerReview.php_file_count,
    caller_scan_match_file_count: callerReview.total_match_file_count,
    caller_scan_boundary_count: Object.keys(callerReview.by_boundary).length,
    required_replacement_evidence_count: replacementEvidenceCount,
    direct_haxe_port_candidate_count: directHaxePortCandidateCount,
    host_primitive_backed_candidate_count: hostPrimitiveBackedCandidateCount,
    preserved_upstream_exceptions_renewed: true,
    generated_overlay_manifest_present: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_vendor_runtime_claimed: false,
    copied_artifact_retirement_claimed: false,
    installed_localization_parity_claimed: false,
    installed_admin_diff_parity_claimed: false,
    installed_legacy_json_parity_claimed: false,
    installed_xmlrpc_route_parity_claimed: false,
    host_version_support_closed_claimed: false,
    legal_review_completed_claimed: false,
    boundary_decisions: Object.fromEntries(
      Object.entries(decisions).map(([id, decision]) => [id, decision.current_distribution_decision])
    )
  };
  const requiredValidationFlags = [
    "prior_gates_passing",
    "decision_gate_routed_to_wphx_323_36",
    "preserved_upstream_exceptions_renewed"
  ];
  const failedValidationFlags = requiredValidationFlags.filter((key) => validationResult[key] !== true);
  if (failedValidationFlags.length > 0) {
    throw new Error(`WPHX-323.36 validation flags failed: ${failedValidationFlags.join(", ")}`);
  }

  const manifest = {
    schema: "wphx.wp-core.localization-legacy-vendor-provenance-decision-gate.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "preserved_localization_legacy_vendor_provenance_and_replacement_decision",
    boundary_ids: BOUNDARY_IDS,
    behavior_parity_claimed: false,
    generated_public_php_replacement_claimed: false,
    copied_artifact_retirement_claimed: false,
    haxe_owned_vendor_runtime_claimed: false,
    installed_wordpress_parity_claimed: false,
    preserved_upstream_exceptions_renewed: true,
    inputs: {
      vendor_strategy_manifest: fileRecord(STRATEGY),
      localization_legacy_vendor_gate_manifest: fileRecord(LOCALIZATION_GATES),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      license_provenance_manifest: fileRecord(LICENSE_PROVENANCE),
      source_inventory_manifest: fileRecord(SOURCE_INVENTORY),
      artifact_provenance_manifest: fileRecord(ARTIFACT_PROVENANCE)
    },
    planned_decision_gate: inputs.planned_decision_gate,
    strategy_by_boundary: inputs.strategy_by_boundary,
    prior_gates: priorGates,
    source_files: sourceRecords,
    source_inventory_records: sourceInventory,
    artifact_provenance_records: artifactEvidence,
    provenance_review: {
      wordpress_project_license: inputs.wordpress_license_record,
      boundary_license_and_notice_treatment: Object.fromEntries(
        BOUNDARY_IDS.map((id) => [
          id,
          {
            package_notice_files: inputs.covered_boundaries[id].license_provenance.package_notice_files,
            notice_files_recorded_in_license_manifest:
              inputs.covered_boundaries[id].license_provenance.notice_files_recorded_in_license_manifest,
            header_notice_markers: inputs.covered_boundaries[id].license_provenance.header_notice_markers,
            treatment: inputs.covered_boundaries[id].license_provenance.treatment
          }
        ])
      ),
      required_notice_treatment: [
        "Preserve the WordPress GPL project notice for all distributions derived from WordPress 7.0.",
        "Preserve upstream file headers for POMO, php-compat/readonly.php, Text_Diff, Services_JSON, IXR, and class-IXR.php while copied fallbacks remain active.",
        "Record exact source path, distribution path, hash, provenance, generated overlay, license/header treatment, and fallback semantics for any future divergence.",
        "Do not treat this decision receipt as legal review completion; it records provenance floors and explicit legal-review blockers."
      ]
    },
    ecosystem_review: {
      caller_scan: callerReview,
      plugin_visible_surfaces: {
        pomo: ["Translation_Entry", "Translations", "NOOP_Translations", "PO", "MO", "Plural_Forms", "load_textdomain", "theme/plugin language files"],
        php_compat: ["readonly()", "wp_readonly()", "wp-includes/php-compat/readonly.php include timing"],
        text_diff: ["Text_Diff", "Text_Diff_Renderer", "Text_Diff_Renderer_inline", "Text_MappedDiff", "wp_text_diff", "revision/admin diff renderers"],
        services_json: ["Services_JSON", "Services_JSON_Error", "JSON_* constants", "wp-includes/class-json.php deprecated include behavior"],
        ixr: ["IXR_* classes", "wp-includes/class-IXR.php loader", "wp_xmlrpc_server", "WP_HTTP_IXR_Client", "xmlrpc.php route behavior"]
      },
      current_evidence: [
        "WPHX-323.31 records preserved POMO localization corpus evidence.",
        "WPHX-323.32 records preserved php-compat readonly shim evidence.",
        "WPHX-323.33 records preserved Text_Diff API/renderer corpus evidence.",
        "WPHX-323.34 records preserved Services_JSON legacy compatibility and host JSON differential evidence.",
        "WPHX-323.35 records preserved IXR XML-RPC value/message corpus evidence and WPHX-318 integration anchors.",
        "No generated overlay manifest, installed integration suite, cross-host support matrix, legal-review closure, or broad plugin ecosystem compatibility scan is present for these boundaries yet."
      ]
    },
    replacement_decision: {
      current_distribution_decision: "renew_preserved_localization_legacy_vendor_exceptions",
      per_boundary: decisions,
      allowed_now: [
        "Keep upstream WordPress 7.0 POMO, php-compat/readonly.php, Text_Diff, Services_JSON, and IXR artifacts as preserved fallback/source-authority artifacts.",
        "Use WPHX-323.31 through WPHX-323.35 as golden floors for future generated overlay, direct Haxe port, or host-primitive-backed replacement work.",
        "Plan generated WPHX PHP original-path overlays only with explicit candidate overlay manifests and boundary-specific prerequisite gates."
      ],
      forbidden_now: [
        "Do not claim Haxe-owned localization/legacy vendor runtime implementation.",
        "Do not claim generated public PHP replacement for POMO, php-compat/readonly.php, Text_Diff, Services_JSON, or IXR.",
        "Do not retire copied POMO, php-compat/readonly.php, Text_Diff, Services_JSON, or IXR artifacts.",
        "Do not claim installed localization/admin-diff/legacy-JSON/XML-RPC/host-version parity.",
        "Do not broaden distribution dependencies or replace legacy compatibility behavior without generated overlay, fallback, ecosystem, installed, and provenance evidence."
      ]
    },
    required_replacement_evidence: REQUIRED_REPLACEMENT_EVIDENCE,
    fallback_matrix: localizationGates.fallback_matrix,
    validation_result: validationResult,
    claims: [
      "Localization and legacy vendor provenance, artifact records, license/header treatment, caller pressure, fallback matrix, and replacement decision criteria are recorded for WPHX-323.36.",
      "The current distribution decision renews preserved upstream exceptions/fallbacks for POMO, php-compat/readonly.php, Text_Diff, Services_JSON, and IXR.",
      "Direct Haxe port or host-primitive-backed replacement paths remain conditional future paths only after explicit generated-overlay, installed, ecosystem, legal/provenance, and boundary-specific evidence passes."
    ],
    non_claims: [
      "This gate does not implement Haxe-owned POMO, php-compat, Text_Diff, Services_JSON, or IXR runtime logic.",
      "This gate does not generate, validate, distribute, or admit current generated public PHP replacement files for these boundaries.",
      "This gate does not retire copied POMO, php-compat/readonly.php, Text_Diff, Services_JSON, or IXR artifacts.",
      "This gate does not prove installed localization, admin diff, legacy JSON, XML-RPC route, cross-host readonly shim, broad plugin ecosystem, or legal-review closure.",
      "This gate does not broaden official WordPress distribution dependency assumptions."
    ]
  };
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestContent);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-36-localization-legacy-vendor-provenance-decision-gate",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    ownership_state: "preserved_upstream_localization_legacy_vendor_exception_renewal",
    boundary_ids: BOUNDARY_IDS,
    source_authority: "../wordpress-develop WordPress 7.0 localization/legacy vendor artifacts plus WPHX-323.31 through WPHX-323.35 evidence floors",
    emission_strategy: "provenance_decision_over_copied_upstream_localization_legacy_vendor_evidence",
    whole_file_owned: false,
    behavior_parity_claimed: false,
    durable_haxe_runtime_claimed: false,
    public_php_replacement_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false,
    generated_overlay_manifest_present: false,
    preserved_upstream_exceptions_renewed: true,
    removal_gate:
      "Do not replace or retire preserved localization/legacy vendor artifacts until non-empty generated overlay manifests, boundary-specific corpus/API/fallback evidence, installed localization/admin/legacy-json/XML-RPC/host-version gates, ecosystem compatibility evidence, and license/header notice preservation all pass.",
    receipt_refs: ["receipt:wphx-323-36-localization-legacy-vendor-provenance-decision-gate"],
    non_claims: manifest.non_claims
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-36-localization-legacy-vendor-provenance-decision-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: manifest.evidence_class,
    artifact_scope: "wordpress-7.0-localization-legacy-vendor-provenance-ecosystem-fallback-decision",
    commands: [
      "npm run wp:core:wphx-323-localization-legacy-vendor-provenance-decision",
      "npm run wp:core:wphx-323-localization-legacy-vendor-provenance-decision:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      parent_localization_legacy_gate_manifest: LOCALIZATION_GATES,
      pomo_gate_manifest: POMO_GATE,
      php_compat_gate_manifest: PHP_COMPAT_GATE,
      text_diff_gate_manifest: TEXT_DIFF_GATE,
      services_json_gate_manifest: SERVICES_JSON_GATE,
      ixr_gate_manifest: IXR_GATE,
      vendor_closure_manifest: VENDOR_CLOSURE,
      license_provenance_manifest: LICENSE_PROVENANCE
    },
    manifest_sha256: sha256(manifestContent),
    validation_result: validationResult,
    decision: manifest.replacement_decision.current_distribution_decision,
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
        decision: manifest.replacement_decision.current_distribution_decision,
        boundary_count: manifest.validation_result.boundary_count,
        source_php_file_count: manifest.validation_result.source_php_file_count,
        required_replacement_evidence_count: manifest.validation_result.required_replacement_evidence_count
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
