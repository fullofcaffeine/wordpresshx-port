#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-twwp",
  external_ref: "WPHX-323.13",
  title: "Add PHPMailer provenance and replacement decision gate"
};
const RECORDED_AT = "2026-07-07T23:30:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-phpmailer-provenance-decision-gate.mjs";
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const MAIL_GATES = "manifests/wp-core/wphx-323-03-mail-vendor-replacement-gates.v1.json";
const API_REFLECTION = "manifests/wp-core/wphx-323-11-phpmailer-api-reflection-fixture.v1.json";
const TRANSPORT_GATE = "manifests/wp-core/wphx-323-12-phpmailer-transport-gate.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const LICENSE_PROVENANCE = "manifests/license-provenance.v1.json";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const OUT = "manifests/wp-core/wphx-323-13-phpmailer-provenance-decision-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-13-phpmailer-provenance-decision-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-13-phpmailer-provenance-decision-gate.v1.json";

const PHPMAILER_ROOT = "src/wp-includes/PHPMailer";
const SUPPORT_FILES = [
  "src/wp-includes/class-phpmailer.php",
  "src/wp-includes/class-smtp.php",
  "src/wp-includes/class-pop3.php",
  "src/wp-includes/class-wp-phpmailer.php"
];
const DISTRIBUTION_SUPPORT_PATHS = SUPPORT_FILES.map((path) => path.replace(/^src\//, ""));
const REQUIRED_PRIOR_GATES = [
  {
    id: "wphx-323-11-phpmailer-api-reflection-fixture",
    manifest: API_REFLECTION,
    expected_external_ref: "WPHX-323.11",
    role: "API/reflection and wrapper-shape floor"
  },
  {
    id: "wphx-323-12-phpmailer-transport-gate",
    manifest: TRANSPORT_GATE,
    expected_external_ref: "WPHX-323.12",
    role: "controlled SMTP/phpmail transport floor"
  }
];
const REQUIRED_REPLACEMENT_EVIDENCE = [
  "non-empty generated candidate overlay manifest for every diverged PHPMailer/support-shim path",
  "generated original-path wrapper or upstream-equivalent dependency mapping with exact package version, source, license, notices, and update policy",
  "PHP lint plus generated-shape/AST contracts for wrapper files and support shims",
  "WPHX-323.11 API/reflection fixture remains passing after divergence",
  "WPHX-323.12 controlled SMTP/phpmail transport fixture remains passing after divergence",
  "dedicated authenticated SMTP, TLS/STARTTLS, proxy, DNS/MX, host mail(), bounce/retry, and operational-delivery gates for any broadened transport claim",
  "plugin-visible class_exists/interface_exists, reflection, stack trace, include-path, and legacy-shim ecosystem compatibility evidence",
  "license/provenance receipt preserving WordPress project notice, PHPMailer file headers, legacy POP3 notice, and any external dependency notices",
  "explicit fallback matrix that keeps preserved upstream PHPMailer active for uncovered behavior"
];
const FALLBACK_MATRIX = [
  {
    condition: "generated wrapper cannot preserve PHPMailer namespace classes, legacy shims, WP_PHPMailer inheritance, reflection names, public constants/properties/methods, or include paths",
    decision: "renew_preserved_upstream_exception"
  },
  {
    condition: "wrapper would require a new external Composer/runtime dependency not assumed by the official WordPress distribution",
    decision: "preserve_upstream_package_until_ADR_and_dependency_receipt"
  },
  {
    condition: "transport behavior reaches authenticated SMTP, TLS/STARTTLS, proxy, DNS/MX, host mail(), remote server policy, bounces, retries, or operational delivery",
    decision: "use_preserved_upstream_phpmailer_until_dedicated_transport_gates_pass"
  },
  {
    condition: "license/provenance notices, version policy, or package-header preservation are unsettled",
    decision: "do_not_diverge_distribution_files"
  },
  {
    condition: "ecosystem pressure shows plugins depend on internals, stack traces, exact file paths, or global legacy aliases beyond wrapper evidence",
    decision: "renew_preserved_upstream_exception_or_narrow_wrapper_scope"
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
  const head = content.slice(0, 3000);
  return {
    path,
    distribution_path: path.replace(/^src\//, ""),
    package_family: path.startsWith(`${PHPMAILER_ROOT}/`) ? "phpmailer" : "wordpress_support_shim",
    copyright_marker: /copyright/i.test(head),
    lgpl_2_1_marker: /lgpl-2\.1|lesser general public license/i.test(head),
    gpl_marker: /gnu public license|gnu gpl|gpl-license/i.test(head),
    phpmailer_project_marker: /github\.com\/PHPMailer\/PHPMailer/i.test(head),
    squirrelmail_marker: /SquirrelMail|mail_fetch\/setup\.php/i.test(head),
    wordpress_class_marker: /WordPress PHPMailer class|_deprecated_file|class_alias/i.test(head),
    oauth_dependency_marker: /League\\\\OAuth2\\\\Client|oauth2-client/i.test(content),
    version_markers: [...new Set([...content.matchAll(/VERSION\s*=\s*['"]([^'"]+)['"]/g)].map((match) => match[1]))]
  };
}

function validateInputs({ phpmailerFiles, sourceFiles, artifactEvidence }) {
  const failures = [];
  const strategy = readJson(STRATEGY);
  const mailGates = readJson(MAIL_GATES);
  const apiReflection = readJson(API_REFLECTION);
  const transportGate = readJson(TRANSPORT_GATE);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const licenseProvenance = readJson(LICENSE_PROVENANCE);
  const wordpressLicense = licenseProvenance.upstreams.find((entry) => entry.id === "upstream:wordpress-7.0.0");
  const phpmailerPlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "phpmailer");
  const phpmailerBoundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "phpmailer");
  const provenanceGate = mailGates.gate_plan.find((gate) => gate.id === "phpmailer-license-provenance-and-dependency-review");
  const decisionGate = mailGates.gate_plan.find((gate) => gate.id === "phpmailer-ecosystem-fallback-and-replacement-decision");

  if (phpmailerPlan?.replacement_strategy !== "generated_wrapper_around_upstream_equivalent_dependency") {
    failures.push(`unexpected PHPMailer strategy ${phpmailerPlan?.replacement_strategy}`);
  }
  if (phpmailerBoundary?.source_inventory.count !== phpmailerFiles.length) {
    failures.push(`expected ${phpmailerFiles.length} PHPMailer source files, found ${phpmailerBoundary?.source_inventory.count}`);
  }
  if (phpmailerBoundary?.distribution_artifacts.count !== phpmailerFiles.length) {
    failures.push(`expected ${phpmailerFiles.length} PHPMailer distribution artifacts, found ${phpmailerBoundary?.distribution_artifacts.count}`);
  }
  if (provenanceGate?.downstream_issue.external_ref !== ISSUE.external_ref) {
    failures.push("WPHX-323.03 provenance gate does not route to WPHX-323.13");
  }
  if (decisionGate?.downstream_issue.external_ref !== ISSUE.external_ref) {
    failures.push("WPHX-323.03 replacement-decision gate does not route to WPHX-323.13");
  }
  if (apiReflection.validation_result?.observations_equal !== true) {
    failures.push("WPHX-323.11 API/reflection fixture is not passing");
  }
  if (apiReflection.validation_result?.generated_overlay_manifest_present !== false) {
    failures.push("WPHX-323.11 unexpectedly records generated overlay evidence");
  }
  if (transportGate.validation_result?.observations_equal !== true) {
    failures.push("WPHX-323.12 transport fixture is not passing");
  }
  if (transportGate.validation_result?.generated_overlay_manifest_present !== false) {
    failures.push("WPHX-323.12 unexpectedly records generated overlay evidence");
  }
  if (artifactEvidence.length !== sourceFiles.length) {
    failures.push(`expected ${sourceFiles.length} artifact provenance records, found ${artifactEvidence.length}`);
  }
  if (wordpressLicense?.package_license !== "GPL-2.0-or-later" || wordpressLicense?.composer_license !== "GPL-2.0-or-later") {
    failures.push("WordPress 7.0 project/package license record is not GPL-2.0-or-later");
  }

  if (failures.length > 0) {
    throw new Error(`WPHX-323.13 PHPMailer provenance decision failed:\n- ${failures.join("\n- ")}`);
  }

  return {
    strategy: fileRecord(STRATEGY),
    mail_gates: fileRecord(MAIL_GATES),
    api_reflection: fileRecord(API_REFLECTION),
    transport_gate: fileRecord(TRANSPORT_GATE),
    vendor_closure: fileRecord(VENDOR_CLOSURE),
    license_provenance: fileRecord(LICENSE_PROVENANCE),
    artifact_provenance: fileRecord(ARTIFACT_PROVENANCE),
    planned_provenance_gate: provenanceGate,
    planned_decision_gate: decisionGate,
    vendor_boundary: {
      source_inventory_count: phpmailerBoundary.source_inventory.count,
      distribution_artifact_count: phpmailerBoundary.distribution_artifacts.count,
      header_notice_markers: phpmailerBoundary.license_provenance.header_notice_markers,
      treatment: phpmailerBoundary.license_provenance.treatment
    },
    wordpress_license_record: {
      package_license: wordpressLicense.package_license,
      composer_license: wordpressLicense.composer_license,
      project_license_file: wordpressLicense.project_license_file,
      bundled_notice_file_count: wordpressLicense.bundled_notice_files.length
    },
    strategy_record: {
      current_strategy: phpmailerPlan.current_strategy,
      replacement_strategy: phpmailerPlan.replacement_strategy,
      removal_gate: phpmailerPlan.removal_gate
    }
  };
}

function main() {
  const phpmailerFiles = listFiles(PHPMAILER_ROOT);
  const sourceFiles = [...phpmailerFiles, ...SUPPORT_FILES].sort();
  const distributionPaths = sourceFiles.map((path) => path.replace(/^src\//, ""));
  const artifactEvidence = artifactRecords(distributionPaths);
  const headerEvidence = sourceFiles.map(headerMarkers);
  const inputs = validateInputs({ phpmailerFiles, sourceFiles, artifactEvidence });
  const oauthDependencyFiles = headerEvidence.filter((record) => record.oauth_dependency_marker).map((record) => record.distribution_path);
  const phpmailerLgplCount = headerEvidence.filter((record) => record.package_family === "phpmailer" && record.lgpl_2_1_marker).length;
  const supportGplCount = headerEvidence.filter((record) => record.package_family === "wordpress_support_shim" && record.gpl_marker).length;
  const supportWordPressCount = headerEvidence.filter((record) => record.package_family === "wordpress_support_shim" && record.wordpress_class_marker).length;
  const decision = {
    current_distribution_decision: "renew_preserved_upstream_phpmailer_exception",
    generated_wrapper_path_status: "conditionally_admitted_but_blocked",
    decision_rationale:
      "PHPMailer remains a public ecosystem API plus transport implementation. WPHX-323.11 and WPHX-323.12 record preserved-package API and controlled transport floors, but no generated overlay, no generated wrapper, no dependency/version policy, and no installed or operational mail parity exist yet.",
    allowed_now: [
      "Keep the upstream WordPress 7.0 PHPMailer package and WordPress support shims as preserved fallback artifacts.",
      "Use WPHX-323.11 and WPHX-323.12 as golden floors for future generated wrapper work.",
      "Require explicit overlay and dependency receipts before any distribution divergence."
    ],
    forbidden_now: [
      "Do not claim Haxe-owned PHPMailer implementation.",
      "Do not claim generated public PHP wrapper ownership.",
      "Do not retire copied PHPMailer or support-shim artifacts.",
      "Do not add external OAuth/composer dependency assumptions to the WordPress distribution without ADR and provenance evidence.",
      "Do not claim installed WordPress mail parity or operational delivery parity."
    ]
  };
  const manifest = {
    schema: "wphx.wp-core.phpmailer-provenance-decision-gate.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "preserved_phpmailer_provenance_and_replacement_decision",
    boundary_id: "phpmailer",
    behavior_parity_claimed: false,
    generated_public_php_replacement_claimed: false,
    copied_phpmailer_artifact_retirement_claimed: false,
    haxe_owned_runtime_claimed: false,
    installed_wordpress_mail_parity_claimed: false,
    operational_mail_delivery_claimed: false,
    generated_wrapper_path_admitted_now: false,
    preserved_upstream_exception_renewed: true,
    inputs,
    source_files: sourceFiles.map(sourceRecord),
    artifact_provenance_records: artifactEvidence,
    provenance_review: {
      wordpress_project_license: "GPL-2.0-or-later",
      phpmailer_package_license: "LGPL-2.1 marker in bundled PHPMailer headers",
      legacy_pop3_support_license: "GPL marker in legacy class-pop3.php header",
      package_notice_files_recorded_in_wordpress_license_manifest: [],
      required_notice_treatment: [
        "Preserve WordPress project notice for distributions derived from WordPress 7.0.",
        "Preserve PHPMailer upstream file headers while the bundled package remains copied/preserved.",
        "Preserve legacy class-pop3.php GPL/SquirrelMail header while the legacy support shim remains copied/preserved.",
        "Any future external dependency wrapper must record package notice files, license, version, source URL, and update policy."
      ],
      header_evidence: headerEvidence,
      phpmailer_lgpl_header_count: phpmailerLgplCount,
      support_gpl_header_count: supportGplCount,
      support_wordpress_marker_count: supportWordPressCount
    },
    dependency_review: {
      official_wordpress_distribution_dependency_broadening_allowed: false,
      optional_oauth_dependency_files: oauthDependencyFiles,
      optional_oauth_dependency_status:
        "PHPMailer/OAuth.php references League OAuth2 client classes, but WordPress 7.0 does not bundle those League classes under wp-includes. Generated wrapper work must not silently add that external dependency to the distribution.",
      generated_wrapper_dependency_requirements: [
        "Record whether the wrapper targets bundled upstream PHPMailer source, an upstream-equivalent external package, or a Haxe implementation.",
        "If using an external package, lock exact version/source/license/notices and prove the official distribution dependency assumption is accepted.",
        "Keep preserved upstream PHPMailer fallback active for OAuth/dependency-adjacent behavior until dedicated evidence exists."
      ]
    },
    ecosystem_review: {
      plugin_visible_surfaces: [
        "PHPMailer\\PHPMailer\\PHPMailer",
        "PHPMailer\\PHPMailer\\SMTP",
        "PHPMailer\\PHPMailer\\POP3",
        "PHPMailer\\PHPMailer\\Exception",
        "PHPMailer\\PHPMailer\\DSNConfigurator",
        "PHPMailer\\PHPMailer\\OAuth",
        "PHPMailer\\PHPMailer\\OAuthTokenProvider",
        "WP_PHPMailer",
        "PHPMailer legacy class alias",
        "phpmailerException legacy class alias",
        "SMTP legacy class alias",
        "POP3 legacy class"
      ],
      required_future_evidence: [
        "class_exists/interface_exists and include-order compatibility over modern and legacy symbols",
        "reflection-visible file names, class names, methods, constants, properties, inheritance, exceptions, and aliases",
        "stack traces and error messages with acceptable original-path behavior",
        "wp_mail, phpmailer_init, wp_mail_succeeded, wp_mail_failed, WP_PHPMailer::setLanguage, and locale-switch behavior",
        "plugin/caller ecosystem scan before replacing legacy support shims"
      ],
      current_evidence: [
        "WPHX-323.11 records preserved API/reflection and wrapper-shape floor.",
        "WPHX-323.12 records controlled local SMTP/phpmail transport floor.",
        "No generated wrapper or ecosystem plugin scan is present yet."
      ]
    },
    replacement_decision: decision,
    required_replacement_evidence: REQUIRED_REPLACEMENT_EVIDENCE,
    fallback_matrix: FALLBACK_MATRIX,
    validation_result: {
      status: "passed",
      source_file_count: sourceFiles.length,
      phpmailer_source_file_count: phpmailerFiles.length,
      support_file_count: SUPPORT_FILES.length,
      artifact_provenance_record_count: artifactEvidence.length,
      header_evidence_record_count: headerEvidence.length,
      phpmailer_lgpl_header_count: phpmailerLgplCount,
      support_gpl_header_count: supportGplCount,
      support_wordpress_marker_count: supportWordPressCount,
      optional_oauth_dependency_file_count: oauthDependencyFiles.length,
      prior_gate_count: REQUIRED_PRIOR_GATES.length,
      prior_gates_passing: true,
      required_replacement_evidence_count: REQUIRED_REPLACEMENT_EVIDENCE.length,
      fallback_condition_count: FALLBACK_MATRIX.length,
      generated_overlay_manifest_present: false,
      generated_wrapper_path_admitted_now: false,
      preserved_upstream_exception_renewed: true
    },
    claims: [
      "PHPMailer provenance, bundled-file artifact records, header license markers, optional dependency assumptions, ecosystem-visible surfaces, fallback matrix, and replacement decision criteria are recorded for WPHX-323.13.",
      "The current distribution decision renews the preserved upstream PHPMailer exception and keeps copied WordPress 7.0 PHPMailer/support-shim artifacts as fallback evidence.",
      "A generated-wrapper path remains conditionally possible only after explicit overlay, API/reflection, controlled transport, dependency/provenance, ecosystem, and installed/operational gates pass."
    ],
    non_claims: [
      "This gate does not implement Haxe-owned PHPMailer runtime logic.",
      "This gate does not generate, validate, distribute, or admit current generated PHPMailer wrapper files.",
      "This gate does not retire copied PHPMailer or support-shim artifacts.",
      "This gate does not broaden official WordPress distribution dependency assumptions.",
      "This gate does not prove installed WordPress mail parity, authenticated SMTP, TLS/STARTTLS, DNS/MX, proxy behavior, host mail() delivery, bounce/retry behavior, or operational delivery."
    ]
  };
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    artifact: OUT,
    ownership_state: "preserved_upstream_vendor_exception_renewal",
    boundary_id: "phpmailer",
    source_authority: "../wordpress-develop WordPress 7.0 PHPMailer package, WordPress PHPMailer shims, and artifact/license provenance manifests",
    whole_file_owned: false,
    behavior_parity_claimed: false,
    generated_public_php_replacement_claimed: false,
    copied_phpmailer_artifact_retirement_claimed: false,
    haxe_owned_runtime_claimed: false,
    installed_wordpress_mail_parity_claimed: false,
    operational_mail_delivery_claimed: false,
    generated_wrapper_path_admitted_now: false,
    preserved_upstream_exception_renewed: true,
    durable_original_path_adapter_claimed: false,
    generated_overlay_manifest_present: false,
    removal_gate:
      "Do not replace or retire preserved PHPMailer artifacts until generated overlay manifests, wrapper/dependency provenance, API/reflection parity, controlled and installed transport gates, ecosystem compatibility evidence, and license notice preservation all pass.",
    non_claims: manifest.non_claims
  };
  const ownershipContent = `${JSON.stringify(ownership, null, 2)}\n`;
  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-13-phpmailer-provenance-decision-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "preserved_phpmailer_provenance_and_replacement_decision",
    artifact_scope: "wordpress-7.0-phpmailer-provenance-dependency-ecosystem-decision",
    commands: [
      "npm run wp:core:wphx-323-phpmailer-provenance-decision",
      "npm run wp:core:wphx-323-phpmailer-provenance-decision:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      parent_mail_vendor_gate_manifest: MAIL_GATES,
      api_reflection_floor_manifest: API_REFLECTION,
      controlled_transport_gate_manifest: TRANSPORT_GATE,
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
