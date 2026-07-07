#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-9626",
  external_ref: "WPHX-323.22",
  title: "Add media security archive provenance decision gate"
};
const RECORDED_AT = "2026-07-08T10:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-media-security-archive-provenance-decision-gate.mjs";
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const MEDIA_GATES = "manifests/wp-core/wphx-323-05-media-security-archive-vendor-replacement-gates.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const LICENSE_PROVENANCE = "manifests/license-provenance.v1.json";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const SODIUM_GATE = "manifests/wp-core/wphx-323-18-sodium-compat-native-fallback-security-gate.v1.json";
const GETID3_GATE = "manifests/wp-core/wphx-323-19-getid3-media-metadata-corpus-gate.v1.json";
const PCLZIP_GATE = "manifests/wp-core/wphx-323-20-pclzip-archive-api-security-gate.v1.json";
const PHPASS_GATE = "manifests/wp-core/wphx-323-21-phpass-password-compatibility-gate.v1.json";
const OUT = "manifests/wp-core/wphx-323-22-media-security-archive-provenance-decision-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-22-media-security-archive-provenance-decision-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-22-media-security-archive-provenance-decision-gate.v1.json";

const BOUNDARY_IDS = ["sodium_compat", "getid3", "pclzip", "phpass"];
const REQUIRED_PRIOR_GATES = [
  {
    id: "wphx-323-18-sodium-compat-native-fallback-security-gate",
    boundary_id: "sodium_compat",
    manifest: SODIUM_GATE,
    expected_external_ref: "WPHX-323.18",
    role: "sodium_compat API/security/native-direct-fallback floor"
  },
  {
    id: "wphx-323-19-getid3-media-metadata-corpus-gate",
    boundary_id: "getid3",
    manifest: GETID3_GATE,
    expected_external_ref: "WPHX-323.19",
    role: "getID3 media metadata corpus and WPHX-313 wrapper handoff floor"
  },
  {
    id: "wphx-323-20-pclzip-archive-api-security-gate",
    boundary_id: "pclzip",
    manifest: PCLZIP_GATE,
    expected_external_ref: "WPHX-323.20",
    role: "PclZip API/security/ZipArchive differential floor"
  },
  {
    id: "wphx-323-21-phpass-password-compatibility-gate",
    boundary_id: "phpass",
    manifest: PHPASS_GATE,
    expected_external_ref: "WPHX-323.21",
    role: "phpass PasswordHash compatibility/security floor"
  }
];
const CALLER_PATTERNS = [
  { id: "sodium_functions", boundary_id: "sodium_compat", regex: /\bsodium_[A-Za-z0-9_]+\b/g },
  { id: "paragonie_sodium", boundary_id: "sodium_compat", regex: /ParagonIE\\Sodium|ParagonIE_Sodium|SodiumException/g },
  { id: "getid3_class", boundary_id: "getid3", regex: /\bgetID3\b/g },
  { id: "getid3_wrappers", boundary_id: "getid3", regex: /\bwp_read_(?:audio|video|image)_metadata\s*\(/g },
  { id: "getid3_copy_tags", boundary_id: "getid3", regex: /\bCopyTagsToComments\b/g },
  { id: "pclzip_class", boundary_id: "pclzip", regex: /\bPclZip\b/g },
  { id: "pclzip_constants", boundary_id: "pclzip", regex: /\bPCLZIP_[A-Z0-9_]+\b/g },
  { id: "phpass_class", boundary_id: "phpass", regex: /\bPasswordHash\b/g },
  { id: "wordpress_password_wrappers", boundary_id: "phpass", regex: /\bwp_(?:hash|check)_password\s*\(/g },
  { id: "host_password_primitives", boundary_id: "phpass", regex: /\bpassword_(?:hash|verify|needs_rehash)\s*\(/g }
];
const BOUNDARY_PATHS = {
  sodium_compat: ["wp-includes/sodium_compat/"],
  getid3: ["wp-includes/ID3/"],
  pclzip: ["wp-admin/includes/class-pclzip.php"],
  phpass: ["wp-includes/class-phpass.php"]
};
const REQUIRED_REPLACEMENT_EVIDENCE = {
  sodium_compat: [
    "non-empty generated overlay manifest for any diverged sodium_compat public PHP path",
    "native sodium-on and true extension-off/direct-fallback differential evidence on hosts where ext/sodium can actually be disabled",
    "constant-time/security review for compare, auth, signatures, secretbox, generichash, password hashing, random bytes, and unsupported hosts",
    "API/reflection/error-shape compatibility for bundled sodium_compat functions, classes, constants, and exceptions",
    "WPHX-306 auth/password/application integration evidence after any generated divergence",
    "ecosystem caller scan for plugins/themes expecting bundled sodium_compat files, class names, constants, or fallback semantics",
    "license/notice preservation for sodium_compat LICENSE, composer metadata, and package README files"
  ],
  getid3: [
    "non-empty generated overlay manifest for any diverged getID3 public PHP path",
    "admitted bounded Haxe parser subset or upstream-equivalent dependency wrapper with exact source/version/license/notices",
    "expanded corpus for valid and malformed MP3/ID3, MP4/QuickTime, WAV/RIFF, FLAC, Ogg/Vorbis, WebM/Matroska, image, artwork, tags, duration, dimensions, encoding, and bitrate behavior",
    "hostile binary input, memory/resource, and parser-breadth review before any media parser replacement claim",
    "WPHX-313 wp_read_audio_metadata/wp_read_video_metadata/wp_read_image_metadata installed/database-backed attachment metadata evidence",
    "ecosystem caller scan for direct getID3, module, and CopyTagsToComments usage",
    "license/readme preservation for wp-includes/ID3/license.txt and wp-includes/ID3/readme.txt"
  ],
  pclzip: [
    "non-empty generated overlay manifest for wp-admin/includes/class-pclzip.php divergence",
    "ZipArchive-backed implementation evidence with preserved upstream fallback where ZipArchive is unavailable or behavior diverges",
    "archive creation/list/extract/delete/merge/callback/error compatibility after generated divergence",
    "path traversal, symlink, overwrite, chmod, platform path, umask, malformed archive, and callback security matrix",
    "WPHX-319 installer/upgrader/update installed integration evidence",
    "ecosystem caller scan for PclZip public methods, constants, callback options, and error codes",
    "license/header provenance review for PclZip file header and WordPress project distribution treatment"
  ],
  phpass: [
    "non-empty generated overlay manifest for wp-includes/class-phpass.php divergence",
    "generated PasswordHash-compatible adapter preserving constructor, public properties, methods, portable $P$/$H$ hashes, bcrypt handoff, invalid hashes, and random-state behavior",
    "constant-time/timing and error-shape review for CheckPassword and legacy portable hash compatibility",
    "WPHX-306 installed auth/users/password reset/application-password/multisite integration evidence",
    "host password_hash/password_verify fallback policy for unsupported algorithms, low/high cost, PHP versions, and legacy hashes",
    "ecosystem caller scan for direct PasswordHash use and public property/method reflection",
    "public-domain/header provenance review for phpass file and WordPress project distribution treatment"
  ]
};

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
  return listFiles(root).filter((path) => path.endsWith(".php"));
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

function priorGateSummary(gate) {
  const manifest = readJson(gate.manifest);
  return {
    ...gate,
    manifest_sha256: sha256File(gate.manifest),
    issue: manifest.issue,
    validation_result: manifest.validation_result,
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };
}

function isBoundaryPath(boundaryId, distributionPath) {
  return BOUNDARY_PATHS[boundaryId].some((prefix) =>
    prefix.endsWith("/") ? distributionPath.startsWith(prefix) : distributionPath === prefix
  );
}

function callerScan() {
  const phpFiles = listPhpFiles("src").sort();
  const matches = [];
  for (const path of phpFiles) {
    const content = readFileSync(upstreamPath(path), "utf8");
    const distributionPath = path.replace(/^src\//, "");
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
        path: distributionPath,
        boundary_ids: boundaryIds,
        pattern_counts: patternCounts,
        boundary_owned_file: boundaryIds.some((id) => isBoundaryPath(id, distributionPath))
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

function validateInputs({ mediaGates, strategy, vendorClosure, licenseProvenance, priorGates, sourceRecords, artifactEvidence }) {
  const failures = [];
  const planById = Object.fromEntries(strategy.boundary_replacement_plan.filter((entry) => BOUNDARY_IDS.includes(entry.id)).map((entry) => [entry.id, entry]));
  const mediaBoundaries = Object.fromEntries(mediaGates.scope.covered_boundaries.map((entry) => [entry.id, entry]));
  const closureBoundaries = Object.fromEntries(vendorClosure.vendor_boundaries.filter((entry) => BOUNDARY_IDS.includes(entry.id)).map((entry) => [entry.id, entry]));
  const decisionGate = mediaGates.gate_plan.find((gate) => gate.id === "media-security-archive-provenance-and-decision");
  const wordpressLicense = licenseProvenance.upstreams.find((entry) => entry.id === "upstream:wordpress-7.0.0");
  const expectedStrategies = {
    sodium_compat: "host_primitive_backed_reimplementation_with_preserved_fallback",
    getid3: "renewed_preserved_artifact_exception_with_tests_provenance",
    pclzip: "host_primitive_backed_reimplementation_with_preserved_fallback",
    phpass: "host_primitive_backed_reimplementation_with_preserved_fallback"
  };

  if (decisionGate?.downstream_issue.external_ref !== ISSUE.external_ref) {
    failures.push("WPHX-323.05 media/security/archive decision gate does not route to WPHX-323.22");
  }
  for (const id of BOUNDARY_IDS) {
    if (planById[id]?.replacement_strategy !== expectedStrategies[id]) {
      failures.push(`${id} has unexpected strategy ${planById[id]?.replacement_strategy}`);
    }
    if (!mediaBoundaries[id]) failures.push(`${id} missing from WPHX-323.05 covered boundaries`);
    if (!closureBoundaries[id]) failures.push(`${id} missing from WPHX-323 vendor closure`);
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
    if (claims.generated_public_php_replacement_claimed !== false) {
      failures.push(`${gate.id} unexpectedly claims generated public PHP replacement`);
    }
    const retirementClaim = Object.entries(claims).find(([key, value]) => key.includes("artifact_retirement_claimed") && value !== false);
    if (retirementClaim) failures.push(`${gate.id} unexpectedly claims copied artifact retirement through ${retirementClaim[0]}`);
  }
  if (sourceRecords.length !== 122) {
    failures.push(`expected 122 media/security/archive PHP source records, found ${sourceRecords.length}`);
  }
  if (artifactEvidence.length !== 122) {
    failures.push(`expected 122 artifact provenance records, found ${artifactEvidence.length}`);
  }
  if (wordpressLicense?.package_license !== "GPL-2.0-or-later" || wordpressLicense?.composer_license !== "GPL-2.0-or-later") {
    failures.push("WordPress 7.0 license record is not GPL-2.0-or-later");
  }
  if (failures.length > 0) {
    throw new Error(`WPHX-323.22 media/security/archive provenance decision failed:\n- ${failures.join("\n- ")}`);
  }
  return {
    planned_decision_gate: decisionGate,
    strategy_by_boundary: Object.fromEntries(BOUNDARY_IDS.map((id) => [id, planById[id]])),
    media_gate_boundaries: mediaBoundaries,
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

function sourceRecordsFromPriorGates(priorGates) {
  return priorGates
    .flatMap((gate) => readJson(gate.manifest).source_files ?? [])
    .map((record) => ({
      path: record.path,
      distribution_path: record.distribution_path,
      repo_path: record.repo_path,
      bytes: record.bytes,
      sha256: record.sha256
    }))
    .sort((a, b) => a.distribution_path.localeCompare(b.distribution_path));
}

function boundaryDecisions({ priorGates, inputs, callerReview }) {
  const priorByBoundary = Object.fromEntries(priorGates.map((gate) => [gate.boundary_id, gate]));
  return {
    sodium_compat: {
      current_distribution_decision: "preserve_upstream_sodium_compat_package_with_native_sodium_compatibility_floor",
      future_replacement_path_status: "host_primitive_backed_path_conditionally_planned_but_blocked",
      rationale:
        "WPHX-323.18 records native sodium and direct compat fallback observations, but true extension-off installed hosts, constant-time/security proof, generated overlays, WPHX-306 installed auth integration, and ecosystem evidence remain incomplete.",
      evidence_floor: priorByBoundary.sodium_compat.id,
      required_replacement_evidence: REQUIRED_REPLACEMENT_EVIDENCE.sodium_compat,
      fallback_policy: inputs.media_gate_boundaries.sodium_compat.removal_gate,
      caller_review: callerReview.by_boundary.sodium_compat
    },
    getid3: {
      current_distribution_decision: "renew_preserved_getid3_exception",
      future_replacement_path_status: "bounded_haxe_parser_subset_or_dependency_wrapper_blocked",
      rationale:
        "WPHX-323.19 records a deterministic corpus and WPHX-313 wrapper handoff markers, but getID3's parser breadth, hostile binary/resource risk, installed attachment metadata behavior, expanded valid corpus, generated overlays, and ecosystem evidence remain incomplete.",
      evidence_floor: priorByBoundary.getid3.id,
      required_replacement_evidence: REQUIRED_REPLACEMENT_EVIDENCE.getid3,
      fallback_policy: inputs.media_gate_boundaries.getid3.removal_gate,
      caller_review: callerReview.by_boundary.getid3
    },
    pclzip: {
      current_distribution_decision: "preserve_upstream_pclzip_file_with_ziparchive_differential_floor",
      future_replacement_path_status: "ziparchive_backed_path_conditionally_planned_but_blocked",
      rationale:
        "WPHX-323.20 records PclZip API/security and ZipArchive differential evidence, but generated overlays, installed updater/installer behavior, platform/symlink/permission matrix, ecosystem pressure, and fallback evidence remain incomplete.",
      evidence_floor: priorByBoundary.pclzip.id,
      required_replacement_evidence: REQUIRED_REPLACEMENT_EVIDENCE.pclzip,
      fallback_policy: inputs.media_gate_boundaries.pclzip.removal_gate,
      caller_review: callerReview.by_boundary.pclzip
    },
    phpass: {
      current_distribution_decision: "preserve_upstream_phpass_file_with_password_hash_compatibility_floor",
      future_replacement_path_status: "password_hash_backed_path_conditionally_planned_but_blocked",
      rationale:
        "WPHX-323.21 records PasswordHash compatibility and host bcrypt handoff evidence, but generated PasswordHash-compatible overlays, timing/security review, installed auth/password reset/application-password integration, and ecosystem reflection evidence remain incomplete.",
      evidence_floor: priorByBoundary.phpass.id,
      required_replacement_evidence: REQUIRED_REPLACEMENT_EVIDENCE.phpass,
      fallback_policy: inputs.media_gate_boundaries.phpass.removal_gate,
      caller_review: callerReview.by_boundary.phpass
    }
  };
}

function main() {
  const strategy = readJson(STRATEGY);
  const mediaGates = readJson(MEDIA_GATES);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const licenseProvenance = readJson(LICENSE_PROVENANCE);
  const priorGates = REQUIRED_PRIOR_GATES.map(priorGateSummary);
  const sourceRecords = sourceRecordsFromPriorGates(REQUIRED_PRIOR_GATES);
  const artifactEvidence = artifactRecords(sourceRecords.map((record) => record.distribution_path));
  const inputs = validateInputs({ mediaGates, strategy, vendorClosure, licenseProvenance, priorGates, sourceRecords, artifactEvidence });
  const callerReview = callerScan();
  const decisions = boundaryDecisions({ priorGates, inputs, callerReview });
  const replacementEvidenceCount = Object.values(REQUIRED_REPLACEMENT_EVIDENCE).reduce((count, entries) => count + entries.length, 0);
  const validationResult = {
    status: "passed",
    boundary_count: BOUNDARY_IDS.length,
    source_php_file_count: sourceRecords.length,
    artifact_provenance_record_count: artifactEvidence.length,
    prior_gate_count: priorGates.length,
    prior_gates_passing: true,
    decision_gate_routed_to_wphx_323_22: inputs.planned_decision_gate.downstream_issue.external_ref === ISSUE.external_ref,
    caller_scan_php_file_count: callerReview.php_file_count,
    caller_scan_match_file_count: callerReview.total_match_file_count,
    required_replacement_evidence_count: replacementEvidenceCount,
    generated_overlay_manifest_present: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_vendor_runtime_claimed: false,
    copied_artifact_retirement_claimed: false,
    preserved_upstream_exceptions_renewed: true,
    boundary_decisions: Object.fromEntries(
      Object.entries(decisions).map(([id, decision]) => [id, decision.current_distribution_decision])
    )
  };
  const manifest = {
    schema: "wphx.wp-core.media-security-archive-provenance-decision-gate.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "preserved_media_security_archive_provenance_and_replacement_decision",
    boundary_ids: BOUNDARY_IDS,
    behavior_parity_claimed: false,
    generated_public_php_replacement_claimed: false,
    copied_artifact_retirement_claimed: false,
    haxe_owned_vendor_runtime_claimed: false,
    installed_wordpress_parity_claimed: false,
    preserved_upstream_exceptions_renewed: true,
    inputs: {
      vendor_strategy_manifest: fileRecord(STRATEGY),
      media_security_archive_gate_manifest: fileRecord(MEDIA_GATES),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      license_provenance_manifest: fileRecord(LICENSE_PROVENANCE),
      artifact_provenance_manifest: fileRecord(ARTIFACT_PROVENANCE)
    },
    planned_decision_gate: inputs.planned_decision_gate,
    prior_gates: priorGates,
    source_files: sourceRecords,
    artifact_provenance_records: artifactEvidence,
    provenance_review: {
      wordpress_project_license: inputs.wordpress_license_record,
      boundary_license_and_notice_treatment: Object.fromEntries(
        BOUNDARY_IDS.map((id) => [
          id,
          {
            package_notice_files: inputs.media_gate_boundaries[id].license_provenance.package_notice_files,
            notice_files_recorded_in_license_manifest:
              inputs.media_gate_boundaries[id].license_provenance.notice_files_recorded_in_license_manifest,
            header_notice_markers: inputs.media_gate_boundaries[id].license_provenance.header_notice_markers,
            treatment: inputs.media_gate_boundaries[id].license_provenance.treatment
          }
        ])
      ),
      required_notice_treatment: [
        "Preserve WordPress GPL project notice for all distributions derived from WordPress 7.0.",
        "Preserve getID3 license.txt/readme.txt while the bundled package remains copied, wrapped, or partially replaced.",
        "Preserve sodium_compat LICENSE/composer metadata/README notice files while copied fallback remains active.",
        "Preserve PclZip file header and WordPress project treatment before any generated divergence.",
        "Preserve phpass public-domain/header treatment and WordPress project treatment before any generated divergence.",
        "Record exact source, version, hash, license, notice, update policy, and fallback semantics for any future dependency wrapper or generated overlay."
      ]
    },
    security_review: {
      sodium_compat: [
        "Native sodium and direct compat fallback observations exist.",
        "True extension-off host evidence remains blocked on this PHP binary.",
        "Constant-time/security proof and unsupported-host policy are not complete."
      ],
      getid3: [
        "Deterministic corpus and malformed/truncated observations exist.",
        "Hostile binary input, parser breadth, memory/resource, and expanded valid-media corpus remain incomplete.",
        "Installed attachment metadata generation is not executed by this decision gate."
      ],
      pclzip: [
        "Archive API, ZipArchive differential, traversal restriction, chmod/overwrite, callbacks, and malformed archive observations exist.",
        "Symlink/platform permission matrix and installed updater/installer execution remain incomplete."
      ],
      phpass: [
        "PasswordHash portable hash, phpBB $H$, bcrypt handoff, invalid/edge, and timing-marker observations exist.",
        "Constant-time proof and installed auth/password reset/application-password integration remain incomplete."
      ]
    },
    ecosystem_review: {
      caller_scan: callerReview,
      plugin_visible_surfaces: {
        sodium_compat: ["sodium_* polyfill functions", "ParagonIE\\Sodium\\Compat", "ParagonIE_Sodium_Compat", "SodiumException", "sodium_compat package files"],
        getid3: ["getID3", "getid3_lib", "getid3_* modules", "CopyTagsToComments", "wp_read_audio_metadata", "wp_read_video_metadata", "wp_read_image_metadata"],
        pclzip: ["PclZip", "PCLZIP_* constants", "legacy callbacks", "archive operation methods", "errorCode/errorName/errorInfo"],
        phpass: ["PasswordHash", "public PasswordHash properties", "HashPassword", "CheckPassword", "portable $P$/$H$ hash behavior"]
      },
      current_evidence: [
        "WPHX-323.18 records preserved sodium_compat security/native-direct-fallback evidence.",
        "WPHX-323.19 records preserved getID3 media corpus and WPHX-313 wrapper handoff evidence.",
        "WPHX-323.20 records preserved PclZip archive API/security and ZipArchive differential evidence.",
        "WPHX-323.21 records preserved phpass PasswordHash compatibility and host password primitive handoff evidence.",
        "No generated overlay manifest, installed parity suite, or broad plugin ecosystem compatibility scan is present for these boundaries yet."
      ]
    },
    replacement_decision: {
      current_distribution_decision: "renew_preserved_media_security_archive_vendor_exceptions",
      per_boundary: decisions,
      allowed_now: [
        "Keep upstream WordPress 7.0 sodium_compat, getID3, PclZip, and phpass artifacts as preserved fallback/source-authority artifacts.",
        "Use WPHX-323.18 through WPHX-323.21 as golden floors for future generated overlay or bounded replacement work.",
        "Plan generated WPHX PHP overlays only with explicit candidate overlay manifests and boundary-specific prerequisite gates."
      ],
      forbidden_now: [
        "Do not claim Haxe-owned media/security/archive vendor runtime implementation.",
        "Do not claim generated public PHP replacement for sodium_compat, getID3, PclZip, or phpass.",
        "Do not retire copied sodium_compat, getID3, PclZip, or phpass artifacts.",
        "Do not claim installed WordPress auth, attachment metadata, updater/installer, unsupported-host, live media, or broad ecosystem parity.",
        "Do not broaden distribution dependencies or replace security-sensitive fallback behavior without license/provenance/security/installed evidence."
      ]
    },
    required_replacement_evidence: REQUIRED_REPLACEMENT_EVIDENCE,
    fallback_matrix: mediaGates.fallback_matrix,
    validation_result: validationResult,
    claims: [
      "Media/security/archive vendor provenance, artifact records, license/notice treatment, caller pressure, fallback matrix, and replacement decision criteria are recorded for WPHX-323.22.",
      "The current distribution decision renews preserved upstream exceptions/fallbacks for sodium_compat, getID3, PclZip, and phpass.",
      "Host-primitive-backed or bounded replacement paths remain conditional future paths only after explicit generated-overlay, security, installed, ecosystem, and provenance evidence passes."
    ],
    non_claims: [
      "This gate does not implement Haxe-owned sodium_compat, getID3, PclZip, or phpass runtime logic.",
      "This gate does not generate, validate, distribute, or admit current generated public PHP replacement files for these boundaries.",
      "This gate does not retire copied sodium_compat, getID3, PclZip, or phpass artifacts.",
      "This gate does not prove constant-time cryptographic/password behavior, hostile binary media parser safety, archive platform-security parity, installed auth/media/updater behavior, unsupported-host behavior, or broad plugin ecosystem compatibility.",
      "This gate does not broaden official WordPress distribution dependency assumptions."
    ]
  };
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestContent);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-22-media-security-archive-provenance-decision-gate",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    ownership_state: "preserved_upstream_media_security_archive_vendor_exception_renewal",
    boundary_ids: BOUNDARY_IDS,
    source_authority: "../wordpress-develop WordPress 7.0 media/security/archive vendor artifacts plus WPHX-323.18 through WPHX-323.21 evidence floors",
    emission_strategy: "provenance_decision_over_copied_upstream_vendor_and_legacy_library_evidence",
    whole_file_owned: false,
    behavior_parity_claimed: false,
    durable_haxe_runtime_claimed: false,
    public_php_replacement_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false,
    generated_overlay_manifest_present: false,
    preserved_upstream_exceptions_renewed: true,
    removal_gate:
      "Do not replace or retire preserved media/security/archive vendor artifacts until non-empty generated overlay manifests, boundary-specific security/corpus/API evidence, installed auth/media/updater gates, ecosystem compatibility evidence, and license notice preservation all pass.",
    receipt_refs: ["receipt:wphx-323-22-media-security-archive-provenance-decision-gate"],
    non_claims: manifest.non_claims
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-22-media-security-archive-provenance-decision-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: manifest.evidence_class,
    artifact_scope: "wordpress-7.0-media-security-archive-vendor-provenance-security-ecosystem-decision",
    commands: [
      "npm run wp:core:wphx-323-media-security-archive-provenance-decision",
      "npm run wp:core:wphx-323-media-security-archive-provenance-decision:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      parent_media_security_archive_gate_manifest: MEDIA_GATES,
      sodium_compat_gate_manifest: SODIUM_GATE,
      getid3_gate_manifest: GETID3_GATE,
      pclzip_gate_manifest: PCLZIP_GATE,
      phpass_gate_manifest: PHPASS_GATE,
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
