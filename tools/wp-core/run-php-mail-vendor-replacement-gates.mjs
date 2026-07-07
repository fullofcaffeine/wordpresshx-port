#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.29",
  external_ref: "WPHX-323.03",
  title: "Plan mail vendor replacement gates"
};
const RECORDED_AT = "2026-07-07T18:00:00.000Z";
const RUNNER = "tools/wp-core/run-php-mail-vendor-replacement-gates.mjs";
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const OUT = "manifests/wp-core/wphx-323-03-mail-vendor-replacement-gates.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-03-mail-vendor-replacement-gates.v1.json";

const DOWNSTREAM_ISSUES = {
  phpmailer_api_reflection_wrapper_shape: {
    issue_id: "wordpresshx-jfwa",
    external_ref: "WPHX-323.11",
    title: "Add PHPMailer API/reflection and wrapper-shape fixture"
  },
  phpmailer_transport_gate: {
    issue_id: "wordpresshx-m1u1",
    external_ref: "WPHX-323.12",
    title: "Add PHPMailer SMTP and phpmail transport gate"
  },
  phpmailer_provenance_replacement_decision: {
    issue_id: "wordpresshx-twwp",
    external_ref: "WPHX-323.13",
    title: "Add PHPMailer provenance and replacement decision gate"
  }
};

const EXISTING_EVIDENCE = [
  {
    id: "wphx-312-13-phpmailer-setup",
    manifest: "manifests/wp-core/wphx-312-13-phpmailer-setup-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-13-phpmailer-setup-oracle-fixture.v1.json",
    role: "wp_mail and PHPMailer setup fixture for headers, attachments, embeds, init hooks, state clearing, and failure behavior without delivery"
  },
  {
    id: "wphx-312-93-cron-mail-transport-installed-gate",
    manifest: "manifests/wp-core/wphx-312-93-cron-mail-transport-installed-gate.v1.json",
    receipt: "receipts/wp-core/wphx-312-93-cron-mail-transport-installed-gate.v1.json",
    role: "controlled installed-style wp_mail/PHPMailer SMTP capture success and controlled SMTP failure evidence"
  },
  {
    id: "wphx-312-07-privacy-request-mail",
    manifest: "manifests/wp-core/wphx-312-07-privacy-request-mail-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-07-privacy-request-mail-oracle-fixture.v1.json",
    role: "privacy request mail wrapper payload and header observations that remain downstream wp_mail callers"
  },
  {
    id: "wphx-312-100-copied-surface-plan",
    manifest: "manifests/wp-core/wphx-312-100-copied-surface-plan.v1.json",
    receipt: "receipts/wp-core/wphx-312-100-copied-surface-plan.v1.json",
    role: "copied-surface routing plan that assigns PHPMailer copied public surfaces to WPHX-323 preserved-vendor policy"
  }
];

const REQUIRED_API_AREAS = [
  "PHPMailer\\PHPMailer\\PHPMailer",
  "PHPMailer\\PHPMailer\\SMTP",
  "PHPMailer\\PHPMailer\\POP3",
  "PHPMailer\\PHPMailer\\Exception",
  "PHPMailer\\PHPMailer\\DSNConfigurator",
  "PHPMailer\\PHPMailer\\OAuth",
  "PHPMailer\\PHPMailer\\OAuthTokenProvider",
  "WP_PHPMailer extends PHPMailer\\PHPMailer\\PHPMailer",
  "legacy class-phpmailer.php, class-smtp.php, and class-pop3.php shims",
  "public constants, properties, method signatures, and reflection-visible paths"
];

const REQUIRED_TRANSPORT_AREAS = [
  "wp_mail header parsing, From/CC/BCC/Reply-To/custom headers, content type, and charset filters",
  "attachment and embedded-image setup",
  "phpmailer_init mutations before send",
  "wp_mail_succeeded and wp_mail_failed hook payloads",
  "controlled local SMTP success capture",
  "controlled local SMTP connection failure",
  "phpmail/mail() boundary shape without external delivery where host permits",
  "exceptions and PHPMailer ErrorInfo propagation",
  "authenticated SMTP, TLS, DNS/MX, remote server policy, bounces, retries, and operational delivery recorded as blocked until dedicated gates exist"
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
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
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
  const phpmailerPlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "phpmailer");
  const phpmailerBoundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "phpmailer");

  if (phpmailerPlan?.followup_issue.external_ref !== ISSUE.external_ref) {
    failures.push("WPHX-323.01 PHPMailer plan is not routed to WPHX-323.03");
  }
  if (phpmailerPlan?.replacement_strategy !== "generated_wrapper_around_upstream_equivalent_dependency") {
    failures.push(`unexpected PHPMailer replacement strategy: ${phpmailerPlan?.replacement_strategy}`);
  }
  if (phpmailerBoundary?.source_inventory.count !== 7) {
    failures.push(`expected PHPMailer source inventory count 7, found ${phpmailerBoundary?.source_inventory.count}`);
  }
  if (phpmailerBoundary?.distribution_artifacts.count !== 7) {
    failures.push(`expected PHPMailer distribution artifact count 7, found ${phpmailerBoundary?.distribution_artifacts.count}`);
  }

  const evidenceRecords = EXISTING_EVIDENCE.map((entry) => ({
    ...entry,
    manifest_record: fileRecord(entry.manifest),
    receipt_record: fileRecord(entry.receipt)
  }));

  const gatePlan = [
    {
      id: "phpmailer-api-reflection-and-wrapper-shape",
      boundary_id: "phpmailer",
      downstream_issue: DOWNSTREAM_ISSUES.phpmailer_api_reflection_wrapper_shape,
      gate_kind: "api_reflection_and_generated_wrapper_shape",
      required_before: ["generated_wrapper_claim", "distribution_divergence", "copied_phpmailer_retirement"],
      required_observations: REQUIRED_API_AREAS,
      acceptance:
        "PHPMailer public API, reflection-visible classes, legacy shims, WP_PHPMailer inheritance, and generated wrapper/original-path shape are proven before any PHPMailer package divergence.",
      fallback_policy:
        "If generated wrapper emission cannot preserve PHPMailer ecosystem-visible API and path behavior, renew the preserved upstream package exception instead of distributing a wrapper.",
      removal_gate:
        "Do not claim generated PHPMailer wrapper ownership or retire copied PHPMailer artifacts until WPHX-323.11 records passing API/reflection and wrapper-shape evidence."
    },
    {
      id: "wp-mail-setup-minimized-fixtures",
      boundary_id: "phpmailer",
      downstream_issue: DOWNSTREAM_ISSUES.phpmailer_api_reflection_wrapper_shape,
      gate_kind: "existing_minimized_mail_setup_fixture",
      required_before: ["generated_wrapper_claim", "transport_replacement_claim"],
      existing_evidence_ids: ["wphx-312-13-phpmailer-setup", "wphx-312-07-privacy-request-mail"],
      required_observations: [
        "wp_mail recipient/header/content-type/charset setup",
        "attachments and embedded images",
        "phpmailer_init, wp_mail_succeeded, and wp_mail_failed hooks",
        "global PHPMailer state clearing and reuse behavior",
        "privacy/recovery/domain mail caller handoff remains covered by domain-specific fixtures"
      ],
      acceptance:
        "Existing WPHX-312 no-delivery mail setup evidence remains the minimized behavior floor for any PHPMailer replacement path.",
      fallback_policy:
        "Keep preserved PHPMailer if generated wrapper or transport candidate cannot reproduce these setup observations.",
      removal_gate:
        "Do not cite WPHX-312 setup fixtures as copied artifact retirement; they are prerequisite behavior floors for WPHX-323.11 and WPHX-323.12."
    },
    {
      id: "phpmailer-controlled-smtp-and-phpmail-transport",
      boundary_id: "phpmailer",
      downstream_issue: DOWNSTREAM_ISSUES.phpmailer_transport_gate,
      gate_kind: "controlled_transport_matrix",
      required_before: ["transport_replacement_claim", "copied_phpmailer_retirement", "installed_mail_parity_claim"],
      existing_evidence_ids: ["wphx-312-93-cron-mail-transport-installed-gate"],
      required_observations: REQUIRED_TRANSPORT_AREAS,
      acceptance:
        "Controlled local SMTP and phpmail/mail() boundary evidence records preserved PHPMailer/wp_mail behavior, unsupported host conditions, and WordPress hook/error observations before replacement claims.",
      fallback_policy:
        "Use preserved upstream PHPMailer for all operational delivery paths until deterministic SMTP/phpmail gates and blocked authenticated/TLS/DNS conditions are resolved.",
      removal_gate:
        "Do not retire PHPMailer transport code or claim installed mail parity until WPHX-323.12 passes with explicit blocked-condition records."
    },
    {
      id: "phpmailer-license-provenance-and-dependency-review",
      boundary_id: "phpmailer",
      downstream_issue: DOWNSTREAM_ISSUES.phpmailer_provenance_replacement_decision,
      gate_kind: "license_provenance_dependency_review",
      required_before: ["distribution_divergence", "external_dependency_wrapper_claim", "copied_phpmailer_retirement"],
      required_observations: [
        "PHPMailer file headers, package notices, WordPress bundled provenance, and license treatment remain recorded while copied",
        "Any external dependency or upstream-equivalent package wrapper records source, version, license, notice, update policy, and exact distribution paths",
        "Official WordPress distribution dependency assumptions are not broadened without an ADR and receipt evidence",
        "OAuth/dependency-adjacent classes are either preserved, wrapped, or explicitly excluded with fallback"
      ],
      acceptance:
        "License/provenance and dependency assumptions are accepted before generated wrapper distribution or preserved-package exception renewal becomes durable policy.",
      fallback_policy:
        "Keep the preserved upstream PHPMailer package if provenance, notices, versioning, or dependency assumptions are unsettled.",
      removal_gate:
        "Do not distribute divergent PHPMailer package files without WPHX-323.13 provenance and dependency-decision evidence."
    },
    {
      id: "phpmailer-ecosystem-fallback-and-replacement-decision",
      boundary_id: "phpmailer",
      downstream_issue: DOWNSTREAM_ISSUES.phpmailer_provenance_replacement_decision,
      gate_kind: "ecosystem_fallback_and_decision",
      required_before: ["copied_phpmailer_retirement", "haxe_owned_vendor_runtime_claim", "generated_wrapper_claim"],
      required_observations: [
        "Plugin-visible class_exists/interface_exists behavior and public PHPMailer API expectations remain preserved",
        "Stack traces, reflection names, include paths, legacy shims, and WP_PHPMailer subclass behavior remain compatible",
        "Fallback matrix records when preserved upstream PHPMailer remains active",
        "Replacement decision chooses generated wrapper, direct Haxe port, host-primitive implementation with fallback, or renewed preserved exception using recorded evidence"
      ],
      acceptance:
        "A future receipt chooses wrapper or renewed exception based on concrete ecosystem and parity evidence, not aspiration.",
      fallback_policy:
        "Default to preserved upstream PHPMailer until WPHX-323.11, WPHX-323.12, and WPHX-323.13 together prove a safer replacement path.",
      removal_gate:
        "Do not claim Haxe-owned PHPMailer runtime logic or copied artifact retirement without an explicit WPHX-323.13 replacement decision receipt."
    }
  ];

  if (gatePlan.length !== 5) failures.push(`expected 5 mail vendor gates, found ${gatePlan.length}`);
  if (Object.keys(DOWNSTREAM_ISSUES).length !== 3) failures.push("expected 3 downstream PHPMailer issues");

  const validationResult = {
    planned_boundary_ids: ["phpmailer"],
    planned_boundary_count: 1,
    phpmailer_source_inventory_count: phpmailerBoundary?.source_inventory.count,
    phpmailer_distribution_artifact_count: phpmailerBoundary?.distribution_artifacts.count,
    gate_count: gatePlan.length,
    downstream_issue_count: Object.keys(DOWNSTREAM_ISSUES).length,
    existing_evidence_count: evidenceRecords.length,
    required_api_area_count: REQUIRED_API_AREAS.length,
    required_transport_area_count: REQUIRED_TRANSPORT_AREAS.length
  };

  if (failures.length > 0) {
    throw new Error(`WPHX-323.03 mail vendor gate plan failed:\n- ${failures.join("\n- ")}`);
  }

  const manifest = {
    schema: "wphx.wp-core-mail-vendor-replacement-gates.v1",
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
          id: phpmailerPlan.id,
          name: phpmailerPlan.name,
          kind: phpmailerPlan.kind,
          source_path: phpmailerPlan.source_path,
          distribution_path: phpmailerPlan.distribution_path,
          current_strategy: phpmailerPlan.current_strategy,
          replacement_strategy: phpmailerPlan.replacement_strategy,
          source_inventory_count: phpmailerBoundary.source_inventory.count,
          distribution_artifact_count: phpmailerBoundary.distribution_artifacts.count
        }
      ],
      selected_path: {
        decision: "generated_wrapper_around_upstream_equivalent_dependency_with_preserved_upstream_fallback",
        rationale:
          "PHPMailer is a public ecosystem API plus transport surface. The first durable WPHX path should preserve official PHPMailer API/path behavior through generated wrappers or renew the preserved upstream exception; direct Haxe mailer ownership is not admitted by this plan.",
        fallback_required_until: [
          "WPHX-323.11 PHPMailer API/reflection and wrapper-shape fixture",
          "WPHX-323.12 controlled SMTP/phpmail transport gate",
          "WPHX-323.13 provenance, dependency, ecosystem, and replacement decision receipt"
        ]
      }
    },
    inputs: {
      replacement_strategy_manifest: fileRecord(STRATEGY),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      existing_evidence: evidenceRecords
    },
    downstream_issues: DOWNSTREAM_ISSUES,
    gate_plan: gatePlan,
    fallback_matrix: [
      {
        condition: "generated wrapper shape cannot preserve PHPMailer public API, reflection names, paths, or legacy shims",
        required_behavior: "Renew preserved upstream PHPMailer exception; do not distribute divergent package files."
      },
      {
        condition: "transport behavior reaches authenticated SMTP, TLS, DNS/MX, remote server policy, retries, bounces, or operational delivery",
        required_behavior: "Route to preserved PHPMailer until dedicated controlled or installed gates cover the behavior."
      },
      {
        condition: "host lacks stable PHP mail() boundary or deterministic local SMTP capture support",
        required_behavior: "Record unsupported host condition and keep preserved upstream fallback active."
      },
      {
        condition: "external dependency/version/provenance assumptions are unsettled",
        required_behavior: "Do not broaden official WordPress distribution dependency assumptions; preserve upstream package."
      }
    ],
    wrapper_requirements: [
      "Generated original-path wrappers must be produced by WPHX PHP, Adapter IR, linker/profile metadata, or accepted compiler/backend evidence.",
      "Wrappers must preserve PHPMailer namespace, class names, legacy shim entry points, WP_PHPMailer inheritance, public constants/properties/methods, exception classes, include paths, and reflection-visible paths.",
      "Candidate package divergence requires a non-empty overlay manifest listing each generated wrapper or dependency-backed file and its replaced upstream hash.",
      "Wrapper bodies must not be hand-authored durable public PHP or JavaScript-runner string replacements."
    ],
    validation_result: validationResult,
    claims: [
      "PHPMailer now has a machine-readable replacement gate plan linked to WPHX-323.01 and WPHX-323 preserved-vendor closure.",
      "The selected near-term path is generated wrapper around an upstream-equivalent dependency with preserved upstream fallback until API/reflection, transport, and provenance/replacement decision gates pass.",
      "Existing WPHX-312 mail setup and controlled SMTP evidence is recorded as prerequisite behavior floor, not copied artifact retirement."
    ],
    non_claims: [
      "This plan does not implement a Haxe-owned PHPMailer runtime.",
      "This plan does not generate, validate, or distribute public PHPMailer wrapper files.",
      "This plan does not replace copied PHPMailer, class-phpmailer.php, class-smtp.php, class-pop3.php, class-wp-phpmailer.php, or wp_mail public PHP artifacts.",
      "This plan does not claim operational mail delivery, authenticated SMTP, TLS, DNS/MX, remote server, bounce, retry, or installed WordPress mail parity.",
      "Existing WPHX-312 evidence remains preserved/copy-oracle and controlled-transport evidence, not durable public PHP ownership."
    ]
  };

  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestText);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-03-mail-vendor-replacement-gates",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "mail_vendor_replacement_gate_plan",
    artifact_scope: "phpmailer-preserved-vendor-boundary",
    commands: ["npm run wp:core:wphx-323-mail-vendor-replacement-gates", "npm run wp:core:wphx-323-mail-vendor-replacement-gates:check"],
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
  console.log(`planned ${gatePlan.length} mail vendor gates for PHPMailer`);
}

main();
