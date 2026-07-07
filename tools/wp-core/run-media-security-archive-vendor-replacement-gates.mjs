#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.31",
  external_ref: "WPHX-323.05",
  title: "Plan media security archive vendor replacement gates"
};
const RECORDED_AT = "2026-07-08T05:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-media-security-archive-vendor-replacement-gates.mjs";
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const LICENSE_PROVENANCE = "manifests/license-provenance.v1.json";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const OUT = "manifests/wp-core/wphx-323-05-media-security-archive-vendor-replacement-gates.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-05-media-security-archive-vendor-replacement-gates.v1.json";

const BOUNDARIES = {
  getid3: {
    id: "getid3",
    source_root: "src/wp-includes/ID3",
    expected_php_count: 16,
    replacement_strategy: "renewed_preserved_artifact_exception_with_tests_provenance"
  },
  sodium_compat: {
    id: "sodium_compat",
    source_root: "src/wp-includes/sodium_compat",
    expected_php_count: 104,
    replacement_strategy: "host_primitive_backed_reimplementation_with_preserved_fallback"
  },
  pclzip: {
    id: "pclzip",
    source_file: "src/wp-admin/includes/class-pclzip.php",
    expected_php_count: 1,
    replacement_strategy: "host_primitive_backed_reimplementation_with_preserved_fallback"
  },
  phpass: {
    id: "phpass",
    source_file: "src/wp-includes/class-phpass.php",
    expected_php_count: 1,
    replacement_strategy: "host_primitive_backed_reimplementation_with_preserved_fallback"
  }
};
const DOWNSTREAM_ISSUES = {
  sodium_native_fallback_security: {
    issue_id: "wordpresshx-gufh",
    external_ref: "WPHX-323.18",
    title: "Add sodium_compat native fallback security gate"
  },
  getid3_media_metadata_corpus: {
    issue_id: "wordpresshx-h571",
    external_ref: "WPHX-323.19",
    title: "Add getID3 media metadata corpus gate"
  },
  pclzip_archive_api_security: {
    issue_id: "wordpresshx-rq2t",
    external_ref: "WPHX-323.20",
    title: "Add PclZip archive API and security gate"
  },
  phpass_password_compatibility: {
    issue_id: "wordpresshx-9cb6",
    external_ref: "WPHX-323.21",
    title: "Add phpass password compatibility gate"
  },
  provenance_decision: {
    issue_id: "wordpresshx-9626",
    external_ref: "WPHX-323.22",
    title: "Add media security archive provenance decision gate"
  }
};
const EXISTING_EVIDENCE = [
  {
    id: "wphx-313-01-media-filesystem-upload-surface",
    manifest: "manifests/wp-core/wphx-313-01-media-filesystem-upload-surface.v1.json",
    receipt: "receipts/wp-core/wphx-313-01-media-filesystem-upload-surface.v1.json",
    boundary_ids: ["getid3", "pclzip"],
    role: "media/filesystem/upload surface inventory that records getID3 metadata and PclZip archive handoffs"
  },
  {
    id: "wphx-313-04-image-metadata-editor-oracle-fixture",
    manifest: "manifests/wp-core/wphx-313-04-image-metadata-editor-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-313-04-image-metadata-editor-oracle-fixture.v1.json",
    boundary_ids: ["getid3"],
    role: "image metadata/editor oracle fixture floor adjacent to media metadata behavior"
  },
  {
    id: "wphx-319-01-updates-installers-recovery-surface",
    manifest: "manifests/wp-core/wphx-319-01-updates-installers-recovery-surface.v1.json",
    receipt: "receipts/wp-core/wphx-319-01-updates-installers-recovery-surface.v1.json",
    boundary_ids: ["pclzip"],
    role: "updates/installers/recovery surface inventory that records archive extraction handoffs"
  },
  {
    id: "wphx-319-03-updates-installers-recovery-oracle-fixture",
    manifest: "manifests/wp-core/wphx-319-03-updates-installers-recovery-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-319-03-updates-installers-recovery-oracle-fixture.v1.json",
    boundary_ids: ["pclzip"],
    role: "updates/installers/recovery oracle fixture floor for installer/upgrader behavior"
  },
  {
    id: "wphx-306-01-user-auth-surface",
    manifest: "manifests/wp-core/wphx-306-01-user-auth-surface.v1.json",
    receipt: "receipts/wp-core/wphx-306-01-user-auth-surface.v1.json",
    boundary_ids: ["phpass", "sodium_compat"],
    role: "user/auth surface inventory that records phpass and sodium-backed password hashing handoffs"
  },
  {
    id: "wphx-306-05-password-application-fixture",
    manifest: "manifests/wp-core/wphx-306-05-password-application-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-306-05-password-application-fixture.v1.json",
    boundary_ids: ["phpass", "sodium_compat"],
    role: "password/application fixture floor for WordPress password hashing and sodium-backed fast hashes"
  },
  {
    id: "wphx-306-07-auth-installed-distribution-gate",
    manifest: "manifests/wp-core/wphx-306-07-auth-installed-distribution-gate.v1.json",
    receipt: "receipts/wp-core/wphx-306-07-auth-installed-distribution-gate.v1.json",
    boundary_ids: ["phpass", "sodium_compat"],
    role: "installed auth distribution gate blocker/evidence for password behavior"
  },
  {
    id: "wphx-315-01-admin-common-list-table-surface",
    manifest: "manifests/wp-core/wphx-315-01-admin-common-list-table-surface.v1.json",
    receipt: "receipts/wp-core/wphx-315-01-admin-common-list-table-surface.v1.json",
    boundary_ids: ["pclzip"],
    role: "admin surface inventory that preserves PclZip as bundled-library boundary"
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
  const head = content.slice(0, 6000);
  return {
    path,
    distribution_path: path.replace(/^src\//, ""),
    getid3_marker: /getID3/i.test(head),
    sodium_marker: /sodium|ParagonIE|libsodium/i.test(head),
    pclzip_marker: /PclZip/i.test(head),
    phpass_marker: /PasswordHash|phpass|Portable PHP password/i.test(head),
    license_marker: /license|copyright|public domain|LGPL|GPL|MIT|BSD|Apache/i.test(head),
    public_domain_marker: /public domain/i.test(head),
    security_marker: /constant.?time|timing|crypto|password|hash|encrypt|decrypt|signature|nonce|key/i.test(content),
    zip_security_marker: /extract|path|dir|chmod|symlink|overwrite|delete|archive|zip/i.test(content),
    host_primitive_marker: /ZipArchive|password_hash|password_verify|sodium_|SODIUM_|extension_loaded/i.test(content)
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

function boundaryPhpFiles(boundary) {
  const descriptor = BOUNDARIES[boundary];
  const files = descriptor.source_root ? listFiles(descriptor.source_root) : [descriptor.source_file];
  return files.filter((path) => path.endsWith(".php")).sort();
}

function validateInputs({ selectedStrategy, selectedClosure, sourceFiles, artifactEvidence }) {
  const failures = [];
  for (const id of Object.keys(BOUNDARIES)) {
    const plan = selectedStrategy[id];
    const boundary = selectedClosure[id];
    const descriptor = BOUNDARIES[id];
    const files = boundaryPhpFiles(id);
    if (!plan) failures.push(`${id} is missing from WPHX-323.01 replacement strategy`);
    if (!boundary) failures.push(`${id} is missing from WPHX-323 vendor closure`);
    if (plan?.followup_issue.external_ref !== ISSUE.external_ref) failures.push(`${id} is not routed to ${ISSUE.external_ref}`);
    if (plan?.replacement_strategy !== descriptor.replacement_strategy) {
      failures.push(`${id} has unexpected replacement strategy ${plan?.replacement_strategy}`);
    }
    if (files.length !== descriptor.expected_php_count) {
      failures.push(`${id} expected ${descriptor.expected_php_count} PHP files, found ${files.length}`);
    }
    if (boundary?.source_inventory.count !== descriptor.expected_php_count) {
      failures.push(`${id} source inventory count is ${boundary?.source_inventory.count}`);
    }
    if (boundary?.distribution_artifacts.count !== descriptor.expected_php_count) {
      failures.push(`${id} distribution artifact count is ${boundary?.distribution_artifacts.count}`);
    }
  }
  for (const evidence of EXISTING_EVIDENCE) {
    if (!existsSync(evidence.manifest)) failures.push(`${evidence.id} manifest missing: ${evidence.manifest}`);
    if (!existsSync(evidence.receipt)) failures.push(`${evidence.id} receipt missing: ${evidence.receipt}`);
  }
  if (sourceFiles.length !== 122) failures.push(`expected 122 selected PHP source files, found ${sourceFiles.length}`);
  if (artifactEvidence.length !== sourceFiles.length) {
    failures.push(`expected ${sourceFiles.length} artifact provenance records, found ${artifactEvidence.length}`);
  }
  if (failures.length > 0) {
    throw new Error(`WPHX-323.05 media/security/archive vendor gate plan failed:\n- ${failures.join("\n- ")}`);
  }
}

function main() {
  const strategy = readJson(STRATEGY);
  const closure = readJson(VENDOR_CLOSURE);
  const licenseProvenance = readJson(LICENSE_PROVENANCE);
  const wordpressLicense = licenseProvenance.upstreams.find((entry) => entry.id === "upstream:wordpress-7.0.0");
  const selectedStrategy = Object.fromEntries(Object.keys(BOUNDARIES).map((id) => [id, strategy.boundary_replacement_plan.find((entry) => entry.id === id)]));
  const selectedClosure = Object.fromEntries(Object.keys(BOUNDARIES).map((id) => [id, closure.vendor_boundaries.find((entry) => entry.id === id)]));
  const sourceFiles = Object.keys(BOUNDARIES).flatMap(boundaryPhpFiles).sort();
  const artifactEvidence = artifactRecords(sourceFiles.map((path) => path.replace(/^src\//, "")));
  validateInputs({ selectedStrategy, selectedClosure, sourceFiles, artifactEvidence });

  const source_records = sourceFiles.map(sourceRecord);
  const source_markers = sourceFiles.map(sourceMarkers);
  const selected_boundaries = Object.keys(BOUNDARIES).map((id) => ({
    id,
    name: selectedClosure[id].name,
    kind: selectedClosure[id].kind,
    source_path: selectedClosure[id].source_path,
    distribution_path: selectedClosure[id].distribution_path,
    current_strategy: selectedStrategy[id].current_strategy,
    replacement_strategy: selectedStrategy[id].replacement_strategy,
    source_inventory_count: selectedClosure[id].source_inventory.count,
    distribution_artifact_count: selectedClosure[id].distribution_artifacts.count,
    license_provenance: selectedClosure[id].license_provenance,
    removal_gate: selectedStrategy[id].removal_gate
  }));

  const gate_plan = [
    {
      id: "sodium-compat-api-security-native-fallback",
      boundary_id: "sodium_compat",
      downstream_issue: DOWNSTREAM_ISSUES.sodium_native_fallback_security,
      gate_kind: "security_sensitive_host_primitive_differential",
      required_before: ["host_primitive_replacement_claim", "haxe_owned_crypto_claim", "copied_sodium_compat_retirement"],
      required_observations: [
        "sodium_* and ParagonIE\\Sodium\\Compat API/reflection over bundled functions, constants, classes, and error shapes",
        "native sodium extension available/unavailable differential behavior",
        "key-size, nonce-size, encoding, base64, random bytes, detached signature, secretbox, generichash, password hash, and invalid-input corpus",
        "constant-time/security review for equality, verification, and unsupported host fallback behavior",
        "WordPress password/application security handoffs through WPHX-306 surfaces"
      ],
      acceptance:
        "Native sodium-backed behavior and preserved sodium_compat fallback behavior are explicitly compared before any security-sensitive replacement claim.",
      fallback_policy:
        "Preserve upstream sodium_compat whenever native sodium is unavailable, error shapes diverge, timing-sensitive behavior is unreviewed, or coverage is incomplete.",
      removal_gate:
        "Do not retire copied sodium_compat artifacts until WPHX-323.18 records API/security/native differential evidence and WPHX-323.22 accepts the decision."
    },
    {
      id: "getid3-media-metadata-corpus",
      boundary_id: "getid3",
      downstream_issue: DOWNSTREAM_ISSUES.getid3_media_metadata_corpus,
      gate_kind: "media_metadata_corpus_and_exception_review",
      required_before: ["bounded_haxe_parser_subset_claim", "external_dependency_wrapper_claim", "copied_getid3_retirement"],
      required_observations: [
        "MP3/ID3, MP4/QuickTime, WAV/RIFF, FLAC, Ogg/Vorbis, WebM/Matroska, image, empty, malformed, and truncated metadata corpus",
        "attachment metadata wrapper handoff through WPHX-313 media upload and metadata surfaces",
        "encoding, duration, dimensions, bitrate, mime, artwork, tag, and warning/error observations",
        "file-format risk review for parser breadth, memory use, malformed binary input, and hostile metadata",
        "license/readme preservation for getID3 package notice files"
      ],
      acceptance:
        "getID3 remains a renewed preserved-artifact exception unless a deliberately bounded parser subset or upstream-equivalent dependency wrapper has corpus evidence and provenance.",
      fallback_policy:
        "Preserve upstream getID3 for formats, binary edge cases, and metadata behavior outside the admitted subset.",
      removal_gate:
        "Do not retire copied getID3 artifacts until WPHX-323.19 records corpus/provenance evidence and WPHX-323.22 accepts a replacement decision."
    },
    {
      id: "pclzip-api-ziparchive-security",
      boundary_id: "pclzip",
      downstream_issue: DOWNSTREAM_ISSUES.pclzip_archive_api_security,
      gate_kind: "archive_api_security_and_host_primitive_differential",
      required_before: ["ziparchive_backed_replacement_claim", "installer_upgrader_archive_claim", "copied_pclzip_retirement"],
      required_observations: [
        "PclZip create, add, listContent, extract, extractByIndex, delete, merge, callbacks, options, constants, public fields, and error APIs",
        "ZipArchive-backed differential behavior where host support exists, with preserved PclZip fallback for unsupported hosts",
        "path traversal, absolute paths, symlink entries, overwrite behavior, permissions, directory creation, malformed ZIPs, zip bombs, and temporary-file cleanup",
        "WPHX-319 installer/upgrader integration behavior and failure shape",
        "license/header provenance for class-pclzip.php"
      ],
      acceptance:
        "Archive replacement claims require both legacy API parity and explicit archive-security review before installer/upgrader use.",
      fallback_policy:
        "Preserve upstream PclZip whenever ZipArchive is unavailable, legacy options/callbacks diverge, or archive-security evidence is incomplete.",
      removal_gate:
        "Do not retire copied class-pclzip.php until WPHX-323.20 records API/security/differential evidence and WPHX-323.22 accepts the decision."
    },
    {
      id: "phpass-password-compatibility-security",
      boundary_id: "phpass",
      downstream_issue: DOWNSTREAM_ISSUES.phpass_password_compatibility,
      gate_kind: "authentication_security_and_host_primitive_differential",
      required_before: ["password_hash_backed_replacement_claim", "auth_runtime_replacement_claim", "copied_phpass_retirement"],
      required_observations: [
        "PasswordHash constructor, HashPassword, CheckPassword, gensalt_private, gensalt_blowfish, crypt_private, encode64, and legacy public behavior",
        "portable phpass, bcrypt, invalid, truncated, high-cost, low-cost, non-ASCII, empty, and edge-case hash corpus",
        "password_hash/password_verify host handoff only where WordPress behavior permits it",
        "timing/error-shape security review for verification and fallback behavior",
        "WPHX-306 authentication/password integration behavior"
      ],
      acceptance:
        "phpass replacement claims require legacy password compatibility and authentication security evidence before any host-primitive-backed path is admitted.",
      fallback_policy:
        "Preserve upstream phpass for portable hashes, legacy edge cases, and timing-sensitive behavior outside the admitted replacement evidence.",
      removal_gate:
        "Do not retire copied class-phpass.php until WPHX-323.21 records password/security/differential evidence and WPHX-323.22 accepts the decision."
    },
    {
      id: "media-security-archive-provenance-and-decision",
      boundary_ids: ["sodium_compat", "getid3", "pclzip", "phpass"],
      downstream_issue: DOWNSTREAM_ISSUES.provenance_decision,
      gate_kind: "license_security_ecosystem_fallback_and_replacement_decision",
      required_before: ["distribution_divergence", "copied_artifact_retirement", "haxe_owned_vendor_runtime_claim"],
      required_observations: [
        "license/provenance and notice treatment for getID3, sodium_compat, PclZip, and phpass",
        "host-primitive fallback matrix for sodium, ZipArchive, password_hash/password_verify, and unsupported hosts",
        "security review completion for cryptography, archive extraction, binary media parsing, and password hashing",
        "ecosystem-visible API/reflection and caller pressure review for all four boundaries",
        "explicit replacement decision choosing host-primitive-backed path, bounded Haxe subset, dependency wrapper, or renewed preserved exception per boundary"
      ],
      acceptance:
        "A future receipt chooses admitted replacement or renewed exception per boundary only after the concrete gates pass and provenance/security evidence is complete.",
      fallback_policy:
        "Default to preserved upstream artifacts until each boundary has passing evidence and accepted replacement/removal criteria.",
      removal_gate:
        "Do not claim Haxe-owned media/security/archive vendor runtime logic or copied artifact retirement without WPHX-323.22 decision evidence."
    }
  ];

  const manifest = {
    schema: "wphx.wp-core-media-security-archive-vendor-replacement-gates.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    scope: {
      parent_strategy_manifest: STRATEGY,
      covered_boundaries: selected_boundaries,
      source_records,
      source_markers
    },
    inputs: {
      replacement_strategy_manifest: fileRecord(STRATEGY),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      license_provenance_manifest: fileRecord(LICENSE_PROVENANCE),
      artifact_provenance: fileRecord(ARTIFACT_PROVENANCE),
      artifact_provenance_records: artifactEvidence,
      existing_evidence: EXISTING_EVIDENCE.map((evidence) => ({
        ...evidence,
        manifest_sha256: sha256File(evidence.manifest),
        receipt_sha256: sha256File(evidence.receipt)
      })),
      wordpress_license_record: {
        package_license: wordpressLicense.package_license,
        composer_license: wordpressLicense.composer_license,
        project_license_file: wordpressLicense.project_license_file
      }
    },
    downstream_issues: DOWNSTREAM_ISSUES,
    gate_plan,
    fallback_matrix: [
      {
        boundary_id: "sodium_compat",
        condition: "native sodium is unavailable or security/error/timing evidence is incomplete",
        decision: "preserve_upstream_sodium_compat_fallback"
      },
      {
        boundary_id: "getid3",
        condition: "media format, malformed binary input, or metadata behavior is outside admitted corpus",
        decision: "renew_preserved_getid3_exception"
      },
      {
        boundary_id: "pclzip",
        condition: "ZipArchive is unavailable or archive-security/API parity evidence is incomplete",
        decision: "preserve_upstream_pclzip_fallback"
      },
      {
        boundary_id: "phpass",
        condition: "legacy portable hash compatibility or timing/error-shape evidence is incomplete",
        decision: "preserve_upstream_phpass_fallback"
      }
    ],
    validation_result: {
      status: "passed",
      planned_boundary_ids: Object.keys(BOUNDARIES),
      planned_boundary_count: Object.keys(BOUNDARIES).length,
      source_record_count: source_records.length,
      artifact_provenance_record_count: artifactEvidence.length,
      gate_count: gate_plan.length,
      downstream_issue_count: Object.keys(DOWNSTREAM_ISSUES).length,
      existing_evidence_count: EXISTING_EVIDENCE.length,
      getid3_php_file_count: boundaryPhpFiles("getid3").length,
      sodium_compat_php_file_count: boundaryPhpFiles("sodium_compat").length,
      pclzip_php_file_count: boundaryPhpFiles("pclzip").length,
      phpass_php_file_count: boundaryPhpFiles("phpass").length,
      host_primitive_backed_boundary_count: ["sodium_compat", "pclzip", "phpass"].length,
      renewed_exception_boundary_count: ["getid3"].length,
      haxe_owned_vendor_runtime_claimed: false,
      generated_public_php_replacement_claimed: false,
      copied_artifact_retirement_claimed: false,
      security_review_completed_claimed: false
    },
    claims: [
      "getID3, sodium_compat, PclZip, and phpass now have a machine-readable replacement gate plan linked to WPHX-323.01 and WPHX-323 preserved-vendor closure.",
      "The selected getID3 path is a renewed preserved-artifact exception until media metadata corpus, WPHX-313 wrapper, provenance, and file-format risk evidence admit a narrower path.",
      "The selected sodium_compat, PclZip, and phpass paths are host-primitive-backed replacement candidates with preserved upstream fallback until security/differential/provenance gates pass.",
      "Concrete downstream gates WPHX-323.18 through WPHX-323.22 are recorded for security, media, archive, password, and final decision evidence."
    ],
    non_claims: [
      "This plan does not implement Haxe-owned getID3, sodium_compat, PclZip, or phpass runtime logic.",
      "This plan does not generate, validate, or distribute public replacement PHP for media/security/archive/auth vendor boundaries.",
      "This plan does not retire copied getID3, sodium_compat, PclZip, or phpass artifacts.",
      "This plan does not claim cryptographic security parity, archive extraction security, media parser coverage, authentication installed parity, installer/upgrader installed parity, or ecosystem compatibility.",
      "Existing WPHX-306, WPHX-313, WPHX-315, and WPHX-319 evidence remains prerequisite floor/context, not durable vendor replacement ownership."
    ]
  };
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-05-media-security-archive-vendor-replacement-gates",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "media_security_archive_vendor_replacement_gate_plan",
    artifact_scope: "getid3-sodium-compat-pclzip-phpass-preserved-vendor-boundaries",
    commands: [
      "npm run wp:core:wphx-323-media-security-archive-vendor-replacement-gates",
      "npm run wp:core:wphx-323-media-security-archive-vendor-replacement-gates:check"
    ],
    artifacts: {
      manifest: OUT,
      parent_strategy_manifest: STRATEGY,
      vendor_closure_manifest: VENDOR_CLOSURE,
      license_provenance_manifest: LICENSE_PROVENANCE
    },
    manifest_sha256: sha256(manifestContent),
    validation_result: manifest.validation_result,
    downstream_issue_refs: Object.values(DOWNSTREAM_ISSUES).map((issue) => issue.external_ref),
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };

  writeOrCheck(OUT, manifestContent);
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
        planned_boundary_count: manifest.validation_result.planned_boundary_count,
        downstream_issue_count: manifest.validation_result.downstream_issue_count
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
