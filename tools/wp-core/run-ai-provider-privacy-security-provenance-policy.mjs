#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.33.8",
  external_ref: "WPHX-323.30",
  title: "Add AI provider privacy security provenance ADR"
};
const RECORDED_AT = "2026-07-08T22:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-ai-provider-privacy-security-provenance-policy.mjs";
const UPSTREAM_LOCK = "upstream.lock.json";
const ADR = "docs/adr/ADR-018-ai-provider-privacy-security-provenance.md";
const ORACLE_PROMPT = "docs/operations/oracle-ai-provider-privacy-security-provenance-review.md";
const LICENSE_PROVENANCE = "manifests/license-provenance.v1.json";
const AI_TINYMCE_GATES = "manifests/wp-core/wphx-323-07-ai-client-tinymce-vendor-gates.v1.json";
const PHP_AI_CLIENT_SUB_BOUNDARIES = "manifests/wp-core/wphx-323-23-php-ai-client-sub-boundaries.v1.json";
const WORDPRESS_AI_WRAPPER_API = "manifests/wp-core/wphx-323-24-wordpress-ai-wrapper-api-surface.v1.json";
const WORDPRESS_AI_WRAPPER_GENERATED = "manifests/wp-core/wphx-323-25-wordpress-ai-wrapper-generated-adapter.v1.json";
const PHP_AI_CLIENT_DTO_SCHEMA = "manifests/wp-core/wphx-323-26-php-ai-client-dto-schema-corpus.v1.json";
const PHP_AI_CLIENT_TRANSPORT_PROVIDER =
  "manifests/wp-core/wphx-323-27-php-ai-client-transport-provider-discovery.v1.json";
const OUT = "manifests/wp-core/wphx-323-30-ai-provider-privacy-security-provenance-policy.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-30-ai-provider-privacy-security-provenance-policy.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-30-ai-provider-privacy-security-provenance-policy.v1.json";

const REQUIRED_ADR_SECTIONS = [
  "# ADR-018: AI Provider Privacy, Security, And Provenance Policy",
  "Status: Accepted",
  "## Context",
  "## Decision",
  "## Credential Handling",
  "## Prompt And File Privacy",
  "## Hooks Logs And Cache Leakage",
  "## Provider Cassettes And Live Opt-In",
  "## License SBOM And Dependency Provenance",
  "## Claim Gates",
  "## Oracle Review",
  "## Consequences",
  "## Non-Claims",
  "## Supersession"
];

const POLICY_CHECKS = [
  {
    id: "credential_handling",
    required_terms: [
      "real provider credentials must never be committed",
      "local environment variables",
      "WPHX_AI_LIVE_PROVIDER_OPT_IN=1",
      "must not record credential values",
      "revocable, least-privilege, test-only provider credentials"
    ]
  },
  {
    id: "prompt_file_privacy",
    required_terms: [
      "synthetic prompts and synthetic files are the default",
      "must not send real user content",
      "prompt and file fixtures must classify every payload",
      "provider cassettes and receipts may store synthetic prompt/file bodies only",
      "prompt-builder hooks"
    ]
  },
  {
    id: "hook_log_cache_leakage",
    required_terms: [
      "leakage boundary",
      "must not record raw credentials",
      "cache keys and cache values must not contain raw credentials",
      "hook and event fixtures must prove"
    ]
  },
  {
    id: "provider_cassette_opt_in",
    required_terms: [
      "fake transport remains the normal oracle",
      "live provider gates are disabled",
      "provider cassettes are allowed only",
      "replayable without network access",
      "provider terms/data-retention review"
    ]
  },
  {
    id: "license_sbom_dependency_provenance",
    required_terms: [
      "WordPress\\AiClientDependencies",
      "exact package name, version, source URL or locked ref, artifact digest, license, notice files, and SBOM entry",
      "GPL compatibility",
      "scoped namespace collision review",
      "security-advisory and update-policy review"
    ]
  },
  {
    id: "live_provider_claim_gates",
    required_terms: [
      "A future gate may claim live provider behavior only after all of these are true",
      "WPHX-323.24, WPHX-323.26, WPHX-323.27, and this ADR have passed",
      "explicitly opt-in for network behavior",
      "Secrets scanning passes"
    ]
  },
  {
    id: "dependency_divergence_claim_gates",
    required_terms: [
      "A future gate may claim dependency divergence only after all of these are true",
      "WPHX-323.23, WPHX-323.26, WPHX-323.27, and this ADR have passed",
      "License, notice, SBOM, source, version, hash, and update-policy evidence",
      "No shaded dependency artifact is retired"
    ]
  }
];

const NON_CLAIMS = [
  "This policy gate does not claim live provider behavior parity.",
  "This policy gate does not prove credential handling safety with executable live-provider tests.",
  "This policy gate does not prove prompt/file privacy for installed WordPress data.",
  "This policy gate does not claim provider cassette safety has been proven.",
  "This policy gate does not claim installed WordPress AI behavior parity.",
  "This policy gate does not claim Haxe-owned php-ai-client runtime logic.",
  "This policy gate does not claim generated public PHP replacement for php-ai-client internals.",
  "This policy gate does not claim dependency substitution, unscoping, deduplication, Composer replacement, or copied artifact retirement for WordPress\\AiClientDependencies.",
  "This policy gate is not legal advice."
];

const PREREQUISITE_GATES = [
  {
    id: "WPHX-323.07",
    path: AI_TINYMCE_GATES,
    required_false: ["live_provider_behavior_claimed", "haxe_owned_php_ai_client_runtime_claimed"]
  },
  {
    id: "WPHX-323.23",
    path: PHP_AI_CLIENT_SUB_BOUNDARIES,
    required_false: [
      "live_provider_behavior_claimed",
      "dependency_substitution_claimed",
      "haxe_owned_php_ai_client_runtime_claimed",
      "generated_public_php_replacement_claimed"
    ]
  },
  {
    id: "WPHX-323.24",
    path: WORDPRESS_AI_WRAPPER_API,
    required_false: [
      "live_provider_behavior_claimed",
      "dependency_substitution_claimed",
      "haxe_owned_php_ai_client_runtime_claimed"
    ]
  },
  {
    id: "WPHX-323.25",
    path: WORDPRESS_AI_WRAPPER_GENERATED,
    required_false: ["live_provider_behavior_claimed", "dependency_substitution_claimed", "installed_wordpress_parity_claimed"]
  },
  {
    id: "WPHX-323.26",
    path: PHP_AI_CLIENT_DTO_SCHEMA,
    required_false: [
      "live_provider_behavior_claimed",
      "dependency_substitution_claimed",
      "haxe_owned_php_ai_client_runtime_claimed",
      "generated_public_php_replacement_claimed"
    ]
  },
  {
    id: "WPHX-323.27",
    path: PHP_AI_CLIENT_TRANSPORT_PROVIDER,
    required_false: [
      "live_provider_behavior_claimed",
      "external_discovery_claimed",
      "network_io_claimed",
      "credential_privacy_security_claimed",
      "dependency_substitution_claimed",
      "haxe_owned_php_ai_client_runtime_claimed",
      "generated_public_php_replacement_claimed"
    ]
  }
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

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function fileRecord(path) {
  return { path, bytes: statSync(path).size, sha256: sha256File(path) };
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

function validationValue(manifest, field) {
  return manifest.validation_result?.[field] ?? manifest[field];
}

function validatePrerequisiteGate(gate) {
  const manifest = readJson(gate.path);
  const failures = [];
  if (manifest.validation_result?.status !== "passed") {
    failures.push(`${gate.id} validation_result.status is not passed`);
  }
  for (const field of gate.required_false) {
    if (validationValue(manifest, field) !== false) {
      failures.push(`${gate.id} ${field} is not false`);
    }
  }
  return {
    id: gate.id,
    path: gate.path,
    issue: manifest.issue,
    evidence_class: manifest.evidence_class,
    validation_result: manifest.validation_result,
    required_false: gate.required_false,
    failures
  };
}

function validateAdr(adrText) {
  const lower = adrText.toLowerCase();
  const sectionResults = REQUIRED_ADR_SECTIONS.map((section) => ({
    section,
    present: adrText.includes(section)
  }));
  const policyResults = POLICY_CHECKS.map((check) => ({
    id: check.id,
    required_terms: check.required_terms,
    missing_terms: check.required_terms.filter((term) => !lower.includes(term.toLowerCase()))
  }));
  return {
    section_results: sectionResults,
    policy_results: policyResults,
    missing_sections: sectionResults.filter((result) => !result.present).map((result) => result.section),
    failed_policy_checks: policyResults.filter((result) => result.missing_terms.length > 0)
  };
}

function main() {
  const upstreamLock = readJson(UPSTREAM_LOCK);
  const wordpressCheckout = currentWordPressCheckout(upstreamLock);
  const adrText = readFileSync(ADR, "utf8");
  const oraclePromptText = readFileSync(ORACLE_PROMPT, "utf8");
  const adrValidation = validateAdr(adrText);
  const prerequisiteGates = PREREQUISITE_GATES.map(validatePrerequisiteGate);
  const licenseProvenance = readJson(LICENSE_PROVENANCE);
  const wordpressLicense = licenseProvenance.upstreams.find((entry) => entry.id === "upstream:wordpress-7.0.0");
  const subBoundaries = readJson(PHP_AI_CLIENT_SUB_BOUNDARIES);
  const shadedPolicy = subBoundaries.shaded_dependency_policy;

  const failures = [
    ...adrValidation.missing_sections.map((section) => `ADR is missing required section: ${section}`),
    ...adrValidation.failed_policy_checks.map(
      (check) => `ADR policy check ${check.id} missing terms: ${check.missing_terms.join(", ")}`
    ),
    ...prerequisiteGates.flatMap((gate) => gate.failures),
    ...(oraclePromptText.includes(ADR) ? [] : [`Oracle prompt must reference ${ADR}`]),
    ...(wordpressLicense?.package_license === "GPL-2.0-or-later" ? [] : ["WordPress package license is not GPL-2.0-or-later"]),
    ...(wordpressLicense?.composer_license === "GPL-2.0-or-later" ? [] : ["WordPress composer license is not GPL-2.0-or-later"]),
    ...(shadedPolicy?.scoped_namespace === "WordPress\\AiClientDependencies"
      ? []
      : ["php-ai-client shaded dependency policy is missing WordPress\\AiClientDependencies"]),
    ...(Array.isArray(shadedPolicy?.package_families_from_paths) && shadedPolicy.package_families_from_paths.length >= 5
      ? []
      : ["php-ai-client shaded dependency package families are incomplete"])
  ];

  if (failures.length > 0) {
    throw new Error(`AI provider privacy/security/provenance policy failed: ${JSON.stringify(failures, null, 2)}`);
  }

  const policy = {
    status: "accepted",
    adr: ADR,
    oracle_review_prompt: ORACLE_PROMPT,
    default_provider_evidence: "fake_provider_fake_transport_no_network",
    live_provider_policy: {
      default_enabled: false,
      opt_in_required: true,
      opt_in_environment_variable: "WPHX_AI_LIVE_PROVIDER_OPT_IN=1",
      default_ci_allowed: false,
      precommit_allowed: false,
      prepush_allowed: false,
      offline_replay_or_fake_provider_required: true
    },
    credential_policy: {
      real_credentials_in_repo_allowed: false,
      credentials_in_manifests_or_receipts_allowed: false,
      secret_derived_hashes_in_evidence_allowed: false,
      allowed_source: "explicit local environment variables only",
      evidence_may_record: ["provider family", "model family", "region class", "fixture id", "credential presence boolean"],
      evidence_must_not_record: [
        "credential values",
        "partial credential values",
        "secret-derived hashes",
        "account ids",
        "project ids",
        "organization ids",
        "bearer tokens",
        "refresh tokens",
        "signed URLs",
        "authorization headers"
      ]
    },
    prompt_file_privacy_policy: {
      default_payloads: "synthetic_prompts_and_synthetic_files",
      installed_user_data_blocked: true,
      required_payload_classes: ["synthetic", "public_fixture", "redacted_cassette", "installed_user_data_blocked"],
      blocked_without_later_installed_privacy_gate: [
        "real user content",
        "database content",
        "media library files",
        "uploads",
        "plugin/theme files",
        "site configuration",
        "email addresses",
        "names",
        "IP addresses",
        "cookies",
        "nonces",
        "personal data"
      ]
    },
    hook_log_cache_leakage_policy: {
      hooks_logs_cache_events_and_exceptions_are_leakage_boundaries: true,
      raw_sensitive_payloads_in_logs_receipts_manifests_beads_or_cassettes_allowed: false,
      cache_must_record: ["ttl", "invalidation", "namespace", "redaction policy"],
      plugin_visible_callback_payload_shape_must_be_tested: true
    },
    cassette_policy: {
      cassettes_default_allowed: false,
      cassettes_allowed_for_explicit_live_provider_gates: true,
      redaction_manifest_required: true,
      no_credentials_personal_data_raw_user_prompts_raw_uploads_account_ids_or_secret_headers: true,
      provider_terms_may_block_required_ci_replay: true
    },
    dependency_provenance_policy: {
      preserved_shaded_namespace: "WordPress\\AiClientDependencies",
      dependency_divergence_default_allowed: false,
      required_before_divergence: [
        "license notice SBOM source version hash and update policy evidence",
        "GPL compatibility and WordPress distribution policy review",
        "source and distribution path/hash mapping",
        "scoped namespace collision and plugin/ecosystem visibility scan",
        "API/reflection snapshots",
        "deterministic fake provider/transport/discovery/cache/event fixtures",
        "fallback policy for hosts lacking expected native extensions or Composer packages",
        "security-advisory and update-policy review",
        "Beads follow-up for unresolved notice/license/SBOM/compatibility gaps"
      ],
      shaded_dependency_package_families: shadedPolicy.package_families_from_paths
    },
    claim_gates: {
      live_provider_behavior: [
        "WPHX-323.24, WPHX-323.26, WPHX-323.27, and ADR-018 have passed",
        "network behavior is explicitly opt-in and disabled from default precommit/pre-push/default CI",
        "credentials come only from local environment variables and are never written to evidence",
        "synthetic or approved redacted payloads are used",
        "hook/log/cache/event/exception/cassette redaction checks pass",
        "provider terms, retention, model drift, network, retry, TLS/proxy/DNS, and failure behavior are recorded",
        "offline replay or fake-provider fallback evidence exists",
        "secrets scanning passes after cassette or live-gate evidence changes"
      ],
      dependency_divergence: [
        "WPHX-323.23, WPHX-323.26, WPHX-323.27, and ADR-018 have passed",
        "license/notice/SBOM/source/version/hash/update-policy evidence is recorded",
        "API/reflection, fake transport/discovery/cache/event, fallback, and ecosystem visibility fixtures pass",
        "a Beads issue or ADR accepts the distribution dependency strategy",
        "copied artifact retirement evidence names the replacement and rollback path"
      ]
    }
  };

  const validationResult = {
    status: "passed",
    wordpress_oracle_locked_commit: wordpressCheckout.current_commit,
    adr_present: true,
    oracle_review_prompt_present: true,
    required_adr_section_count: REQUIRED_ADR_SECTIONS.length,
    required_adr_sections_present: adrValidation.missing_sections.length === 0,
    policy_check_count: POLICY_CHECKS.length,
    policy_checks_passed: adrValidation.failed_policy_checks.length === 0,
    prerequisite_gate_count: prerequisiteGates.length,
    prerequisite_gates_passed: prerequisiteGates.every((gate) => gate.failures.length === 0),
    wordpress_license_gpl_compatible_recorded:
      wordpressLicense?.package_license === "GPL-2.0-or-later" &&
      wordpressLicense?.composer_license === "GPL-2.0-or-later",
    shaded_dependency_namespace: shadedPolicy.scoped_namespace,
    shaded_dependency_primary_file_count: shadedPolicy.primary_file_count,
    shaded_dependency_tagged_file_count: shadedPolicy.tagged_file_count,
    shaded_dependency_package_family_count: shadedPolicy.package_families_from_paths.length,
    credential_handling_policy_recorded: true,
    prompt_file_privacy_policy_recorded: true,
    hook_log_cache_leakage_policy_recorded: true,
    provider_cassette_opt_in_policy_recorded: true,
    license_sbom_dependency_provenance_policy_recorded: true,
    live_provider_claim_gates_recorded: true,
    dependency_divergence_claim_gates_recorded: true,
    oracle_review_prompt_recorded: true,
    live_provider_behavior_claimed: false,
    credential_privacy_security_claimed: false,
    prompt_file_privacy_claimed: false,
    provider_cassette_safety_claimed: false,
    dependency_substitution_claimed: false,
    installed_wordpress_ai_parity_claimed: false,
    haxe_owned_php_ai_client_runtime_claimed: false,
    generated_public_php_replacement_for_php_ai_client_claimed: false,
    copied_artifact_retirement_claimed: false
  };

  const manifest = {
    schema: "wphx.wp-core.ai-provider-privacy-security-provenance-policy.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "ai_provider_privacy_security_provenance_policy_gate",
    behavior_parity_claimed: false,
    live_provider_behavior_claimed: false,
    credential_privacy_security_claimed: false,
    prompt_file_privacy_claimed: false,
    provider_cassette_safety_claimed: false,
    dependency_substitution_claimed: false,
    installed_wordpress_ai_parity_claimed: false,
    haxe_owned_php_ai_client_runtime_claimed: false,
    generated_public_php_replacement_for_php_ai_client_claimed: false,
    copied_artifact_retirement_claimed: false,
    inputs: {
      runner: fileRecord(RUNNER),
      upstream_lock: fileRecord(UPSTREAM_LOCK),
      adr: fileRecord(ADR),
      oracle_review_prompt: fileRecord(ORACLE_PROMPT),
      license_provenance: fileRecord(LICENSE_PROVENANCE),
      ai_tinymce_gate_manifest: fileRecord(AI_TINYMCE_GATES),
      php_ai_client_sub_boundaries: fileRecord(PHP_AI_CLIENT_SUB_BOUNDARIES),
      wordpress_ai_wrapper_api_surface: fileRecord(WORDPRESS_AI_WRAPPER_API),
      wordpress_ai_wrapper_generated_adapter: fileRecord(WORDPRESS_AI_WRAPPER_GENERATED),
      php_ai_client_dto_schema: fileRecord(PHP_AI_CLIENT_DTO_SCHEMA),
      php_ai_client_transport_provider: fileRecord(PHP_AI_CLIENT_TRANSPORT_PROVIDER)
    },
    upstream_authority: wordpressCheckout,
    prerequisite_gates: prerequisiteGates,
    adr_validation: adrValidation,
    wordpress_license_record: {
      package_license: wordpressLicense.package_license,
      composer_license: wordpressLicense.composer_license,
      project_license_file: wordpressLicense.project_license_file
    },
    shaded_dependency_policy_input: {
      scoped_namespace: shadedPolicy.scoped_namespace,
      primary_file_count: shadedPolicy.primary_file_count,
      tagged_file_count: shadedPolicy.tagged_file_count,
      package_families_from_paths: shadedPolicy.package_families_from_paths,
      current_policy: shadedPolicy.current_policy,
      divergence_requirements: shadedPolicy.divergence_requirements
    },
    policy,
    validation_result: validationResult,
    claims: [
      "ADR-018 records the AI provider privacy, security, cassette, credential, hook/log/cache leakage, and dependency provenance policy for future live-provider and dependency-divergence work.",
      "Live provider behavior remains opt-in and blocked from default precommit, pre-push, and default CI.",
      "Dependency substitution for WordPress\\AiClientDependencies remains blocked until license/notice/SBOM, API/reflection, fake transport/discovery/cache/event, fallback, ecosystem visibility, and accepted distribution-strategy evidence pass.",
      "An oracle review prompt is recorded for second-pass privacy/security architecture review before the first live-provider or dependency-divergence claim."
    ],
    non_claims: NON_CLAIMS
  };

  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestContent);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-30-ai-provider-privacy-security-provenance-policy",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    unit: {
      kind: "policy_gate",
      name: "AI provider privacy/security/provenance policy",
      area: "wp-includes/ai-client.php, wp-includes/ai-client/*, wp-includes/php-ai-client/, and WordPress\\AiClientDependencies",
      public_contract:
        "Live AI provider behavior and php-ai-client dependency divergence remain blocked until ADR-018 policy gates are satisfied with redacted, opt-in, provenance-backed evidence."
    },
    ownership_state: "ai_provider_privacy_security_provenance_policy_gate",
    bridge: {
      exists: true,
      kind: "policy-and-claim-gate-for-preserved-ai-client-boundaries",
      removal_gate:
        "Replace this policy only with a later ADR or live-provider/dependency-divergence gate that preserves or strengthens credential, prompt/file, cassette, hook/log/cache leakage, license/SBOM, and oracle-review safeguards."
    },
    behavior_parity_claimed: false,
    live_provider_behavior_claimed: false,
    credential_privacy_security_claimed: false,
    prompt_file_privacy_claimed: false,
    provider_cassette_safety_claimed: false,
    dependency_substitution_claimed: false,
    installed_wordpress_ai_parity_claimed: false,
    haxe_owned_php_ai_client_runtime_claimed: false,
    generated_public_php_replacement_for_php_ai_client_claimed: false,
    copied_artifact_retirement_claimed: false,
    owned_paths: [ADR, ORACLE_PROMPT, RUNNER, OUT, OWNERSHIP, RECEIPT],
    generated_paths: [OUT, OWNERSHIP, RECEIPT],
    preserved_paths: ["wp-includes/php-ai-client/", "wp-includes/ai-client.php", "wp-includes/ai-client/"],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-323-ai-provider-privacy-security-provenance-policy",
        "npm run wp:core:wphx-323-ai-provider-privacy-security-provenance-policy:check",
        "npm run receipts:validate",
        "npm run beads:validate"
      ],
      receipt_refs: ["receipt:wphx-323-30-ai-provider-privacy-security-provenance-policy"],
      manifest_digest: sha256(manifestContent)
    },
    non_claims: NON_CLAIMS
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-30-ai-provider-privacy-security-provenance-policy",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: manifest.evidence_class,
    artifact_scope: "wordpress-7.0-ai-provider-privacy-security-provenance-policy",
    commands: [
      "npm run wp:core:wphx-323-ai-provider-privacy-security-provenance-policy",
      "npm run wp:core:wphx-323-ai-provider-privacy-security-provenance-policy:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      adr: ADR,
      oracle_review_prompt: ORACLE_PROMPT,
      php_ai_client_sub_boundaries: PHP_AI_CLIENT_SUB_BOUNDARIES,
      php_ai_client_transport_provider: PHP_AI_CLIENT_TRANSPORT_PROVIDER
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
        policy_check_count: manifest.validation_result.policy_check_count,
        prerequisite_gate_count: manifest.validation_result.prerequisite_gate_count,
        shaded_dependency_package_family_count: manifest.validation_result.shaded_dependency_package_family_count,
        live_provider_behavior_claimed: manifest.validation_result.live_provider_behavior_claimed,
        dependency_substitution_claimed: manifest.validation_result.dependency_substitution_claimed
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
}
