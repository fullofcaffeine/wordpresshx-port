#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.27",
  external_ref: "WPHX-323.01",
  title: "Plan Haxe-owned PHP vendor replacement strategy"
};
const RECORDED_AT = "2026-07-07T13:00:00.000Z";
const RUNNER = "tools/wp-core/run-php-vendor-replacement-strategy.mjs";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const VENDOR_RECEIPT = "receipts/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const OUT = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";

const FOLLOWUPS = {
  http_vendor: {
    issue_id: "wordpresshx-l76.30",
    external_ref: "WPHX-323.02",
    title: "Plan HTTP vendor replacement gates"
  },
  mail_vendor: {
    issue_id: "wordpresshx-l76.29",
    external_ref: "WPHX-323.03",
    title: "Plan mail vendor replacement gates"
  },
  feed_vendor: {
    issue_id: "wordpresshx-l76.28",
    external_ref: "WPHX-323.04",
    title: "Plan feed vendor replacement gates"
  },
  media_security_archive_vendor: {
    issue_id: "wordpresshx-l76.31",
    external_ref: "WPHX-323.05",
    title: "Plan media security archive vendor replacement gates"
  },
  localization_legacy_data_vendor: {
    issue_id: "wordpresshx-l76.32",
    external_ref: "WPHX-323.06",
    title: "Plan localization and legacy data vendor gates"
  },
  ai_tinymce_vendor: {
    issue_id: "wordpresshx-l76.33",
    external_ref: "WPHX-323.07",
    title: "Plan AI client and TinyMCE PHP loader vendor gates"
  }
};

const ALLOWED_STRATEGIES = new Set([
  "direct_haxe_port_preserving_vendor_api",
  "host_primitive_backed_reimplementation_with_preserved_fallback",
  "generated_wrapper_around_upstream_equivalent_dependency",
  "renewed_preserved_artifact_exception_with_tests_provenance"
]);

const BOUNDARY_PLANS = {
  requests: {
    replacement_strategy: "host_primitive_backed_reimplementation_with_preserved_fallback",
    followup: FOLLOWUPS.http_vendor,
    priority: 100,
    rationale:
      "Requests is the highest-blast-radius vendor boundary because WP_Http and remote fetch behavior depend on it; replacement needs host transport parity before any copied artifact can retire.",
    required_gates: [
      "Requests class/function API and reflection fixture against the preserved upstream package",
      "WP_Http differential gate across curl, streams, redirects, cookies, proxies, SSL, timeouts, nonblocking requests, and WordPress error shapes",
      "Live transport and package-root gates with the preserved upstream package retained as fallback until the Haxe-owned path is proven",
      "License and provenance review before distribution divergence"
    ]
  },
  phpmailer: {
    replacement_strategy: "generated_wrapper_around_upstream_equivalent_dependency",
    followup: FOLLOWUPS.mail_vendor,
    priority: 94,
    rationale:
      "PHPMailer has a public ecosystem API and transport side effects, so the first durable path should preserve the official package API or renew the exception rather than silently reimplement mail behavior.",
    required_gates: [
      "wp_mail and PHPMailer setup fixture for headers, attachments, embeds, init hooks, and failure behavior",
      "SMTP and phpmail transport differential gate with WordPress error and hook observations",
      "Generated wrapper or explicit preserved-package exception that preserves PHPMailer public API and reflection-visible classes",
      "License and provenance review before distribution divergence"
    ]
  },
  simplepie: {
    replacement_strategy: "generated_wrapper_around_upstream_equivalent_dependency",
    followup: FOLLOWUPS.feed_vendor,
    priority: 90,
    rationale:
      "SimplePie owns feed parsing complexity and a broad public API; wrappers and corpus-backed gates are safer than a from-scratch parser until feed parity is proven.",
    required_gates: [
      "RSS and Atom corpus for malformed feeds, charsets, dates, enclosures, namespaces, and feed errors",
      "WordPress feed cache, widget, and RSS block wrapper gates",
      "Network/local corpus differential evidence with preserved upstream fallback",
      "License and provenance review before distribution divergence"
    ]
  },
  sodium_compat: {
    replacement_strategy: "host_primitive_backed_reimplementation_with_preserved_fallback",
    followup: FOLLOWUPS.media_security_archive_vendor,
    priority: 88,
    rationale:
      "sodium_compat is security-sensitive; replacement should be backed by native sodium where available and keep the upstream polyfill until constant-time and error-shape evidence exists.",
    required_gates: [
      "Security review for sodium API coverage, constant-time expectations, and unsupported-host fallback behavior",
      "Native sodium extension on/off differential gate",
      "Error-shape, encoding, key-size, and edge-case corpus against upstream sodium_compat",
      "Preserved upstream fallback until security review and parity gates pass"
    ]
  },
  getid3: {
    replacement_strategy: "renewed_preserved_artifact_exception_with_tests_provenance",
    followup: FOLLOWUPS.media_security_archive_vendor,
    priority: 78,
    rationale:
      "getID3 covers many media formats; renewing the preserved-vendor exception is safer until a small Haxe-owned parser subset or official dependency wrapper has corpus evidence.",
    required_gates: [
      "Media metadata corpus for common audio/video/image files and malformed inputs",
      "Attachment metadata wrapper gate through the WPHX-313 media domain",
      "License, notice-file, and file-format risk review",
      "Renewed preserved exception unless a bounded Haxe parser subset is explicitly admitted"
    ]
  },
  pclzip: {
    replacement_strategy: "host_primitive_backed_reimplementation_with_preserved_fallback",
    followup: FOLLOWUPS.media_security_archive_vendor,
    priority: 76,
    rationale:
      "PclZip sits on installer/upgrader paths and should move toward a ZipArchive-backed implementation only after archive-security and legacy API behavior are covered.",
    required_gates: [
      "PclZip public API fixture for archive creation, extraction, listing, callbacks, and errors",
      "ZipArchive-backed differential gate with upstream PclZip fallback",
      "Path traversal, symlink, overwrite, permissions, and malformed archive security gate",
      "WPHX-319 installer/upgrader integration gate"
    ]
  },
  phpass: {
    replacement_strategy: "host_primitive_backed_reimplementation_with_preserved_fallback",
    followup: FOLLOWUPS.media_security_archive_vendor,
    priority: 74,
    rationale:
      "phpass is authentication-adjacent; host password primitives can help, but legacy portable hash behavior and timing/error surfaces need direct evidence.",
    required_gates: [
      "Password hash verify/generate corpus for portable, phpass, bcrypt, invalid, and edge-case inputs",
      "password_hash/password_verify host handoff fixture where WordPress behavior allows it",
      "Portable fallback timing and error-shape review",
      "WPHX-306 authentication integration gate"
    ]
  },
  pomo: {
    replacement_strategy: "direct_haxe_port_preserving_vendor_api",
    followup: FOLLOWUPS.localization_legacy_data_vendor,
    priority: 72,
    rationale:
      "POMO is comparatively bounded and central to localization; a typed Haxe port can own parsing while preserving WordPress-visible classes and errors.",
    required_gates: [
      "PO/MO corpus for plurals, contexts, encodings, malformed files, and headers",
      "Translation cache, bootstrap, and admin localization gates",
      "Public class/function API and reflection fixture",
      "License and provenance review before distribution divergence"
    ]
  },
  ixr: {
    replacement_strategy: "direct_haxe_port_preserving_vendor_api",
    followup: FOLLOWUPS.localization_legacy_data_vendor,
    priority: 68,
    rationale:
      "IXR is legacy but bounded; a Haxe-owned implementation is plausible once XML-RPC request, value, and error behavior are protected.",
    required_gates: [
      "IXR request, message, value, error, and client corpus against upstream classes",
      "XML-RPC route integration through WPHX-318",
      "Public class API and reflection fixture",
      "Preserved fallback until installed XML-RPC behavior passes"
    ]
  },
  php_ai_client: {
    replacement_strategy: "direct_haxe_port_preserving_vendor_api",
    followup: FOLLOWUPS.ai_tinymce_vendor,
    priority: 64,
    rationale:
      "The WordPress PHP AI Client is a newer bundled library with DTO/provider/transporter surfaces that can be typed well once the WPHX-312 HTTP wrapper gates are in place.",
    required_gates: [
      "DTO, provider, transporter, exception, and utility API corpus",
      "WordPress AI HTTP wrapper gate through WPHX-312",
      "Generated API and reflection-visible class shape fixture",
      "Preserved exception until provider/network behavior is covered"
    ]
  },
  text_diff: {
    replacement_strategy: "direct_haxe_port_preserving_vendor_api",
    followup: FOLLOWUPS.localization_legacy_data_vendor,
    priority: 58,
    rationale:
      "Text_Diff is algorithmic and bounded enough for a typed Haxe port, but WordPress renderer behavior must stay identical for revisions and admin diffs.",
    required_gates: [
      "Diff algorithm and renderer corpus against upstream Text_Diff",
      "Admin revision, plugin, theme, and post diff integration gates",
      "Public API and reflection fixture",
      "License and provenance review before distribution divergence"
    ]
  },
  services_json: {
    replacement_strategy: "host_primitive_backed_reimplementation_with_preserved_fallback",
    followup: FOLLOWUPS.localization_legacy_data_vendor,
    priority: 54,
    rationale:
      "Services_JSON is deprecated compatibility code; host JSON primitives may replace most behavior, but legacy edge cases and warnings need explicit protection.",
    required_gates: [
      "Legacy encode/decode corpus for invalid UTF-8, objects, arrays, numbers, comments, and malformed payloads",
      "json_encode/json_decode differential gate for allowed host-primitive handoff",
      "Deprecated warning and error-shape fixture",
      "Preserved fallback for ecosystem-visible edge behavior"
    ]
  },
  magpie_rss: {
    replacement_strategy: "renewed_preserved_artifact_exception_with_tests_provenance",
    followup: FOLLOWUPS.feed_vendor,
    priority: 52,
    rationale:
      "MagpieRSS is deprecated legacy feed code; renewing the exception is acceptable unless ecosystem evidence justifies a direct port.",
    required_gates: [
      "Legacy RSS parser, cache, and display helper fixtures from WPHX-312",
      "Deprecated feed wrapper integration gate",
      "License and provenance review before distribution divergence",
      "Renewed preserved exception unless ecosystem pressure justifies replacement"
    ]
  },
  snoopy: {
    replacement_strategy: "renewed_preserved_artifact_exception_with_tests_provenance",
    followup: FOLLOWUPS.http_vendor,
    priority: 46,
    rationale:
      "Snoopy is deprecated HTTP compatibility code; preserve it unless real plugin pressure requires a replacement path.",
    required_gates: [
      "Legacy Snoopy API fixture",
      "WPHX-312 and WPHX-318 integration review for deprecated HTTP/XML-RPC callers",
      "License and provenance review before distribution divergence",
      "Renewed preserved exception unless ecosystem pressure justifies replacement"
    ]
  },
  php_compat: {
    replacement_strategy: "host_primitive_backed_reimplementation_with_preserved_fallback",
    followup: FOLLOWUPS.localization_legacy_data_vendor,
    priority: 44,
    rationale:
      "php-compat is host-version-sensitive; replacement needs narrow host primitive checks rather than a broad port.",
    required_gates: [
      "Host-version compatibility fixture for each shimmed behavior",
      "Bootstrap and deprecation checks through WPHX-301 and WPHX-303",
      "Preserved fallback for hosts that still need upstream shim behavior",
      "License and provenance review before distribution divergence"
    ]
  },
  tinymce_php_loader: {
    replacement_strategy: "renewed_preserved_artifact_exception_with_tests_provenance",
    followup: FOLLOWUPS.ai_tinymce_vendor,
    priority: 38,
    rationale:
      "The TinyMCE PHP loader belongs to the browser vendor asset boundary; keep it preserved until browser package emission and loader output are jointly tested.",
    required_gates: [
      "TinyMCE loader output, cache, and header fixture",
      "Browser vendor and asset-bundling gate through WPHX-609",
      "License and provenance review before distribution divergence",
      "Renewed preserved exception until generated browser/package emission owns the boundary"
    ]
  }
};

const COPIED_SURFACE_TO_BOUNDARY = {
  "WPHX-312.05": "php_ai_client",
  "WPHX-312.13": "phpmailer",
  "WPHX-312.22": "magpie_rss",
  "WPHX-312.23": "magpie_rss",
  "WPHX-312.24": "magpie_rss",
  "WPHX-312.37": "simplepie"
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
  const closure = readJson(VENDOR_CLOSURE);
  const vendorReceipt = readJson(VENDOR_RECEIPT);
  const boundaryById = new Map(closure.vendor_boundaries.map((boundary) => [boundary.id, boundary]));

  if (closure.vendor_boundaries.length !== 16) {
    failures.push(`expected 16 vendor boundaries, found ${closure.vendor_boundaries.length}`);
  }
  if (closure.wphx_312_preserved_vendor_surfaces.length !== 6) {
    failures.push(`expected 6 WPHX-312 preserved-vendor copied surfaces, found ${closure.wphx_312_preserved_vendor_surfaces.length}`);
  }

  const missingPlans = closure.vendor_boundaries.filter((boundary) => !BOUNDARY_PLANS[boundary.id]).map((boundary) => boundary.id);
  if (missingPlans.length > 0) failures.push(`vendor boundaries missing replacement plans: ${missingPlans.join(", ")}`);

  const stalePlans = Object.keys(BOUNDARY_PLANS).filter((id) => !boundaryById.has(id));
  if (stalePlans.length > 0) failures.push(`replacement plans reference unknown vendor boundaries: ${stalePlans.join(", ")}`);

  const boundaryPlans = closure.vendor_boundaries
    .map((boundary) => {
      const plan = BOUNDARY_PLANS[boundary.id];
      if (!plan) return null;
      if (!ALLOWED_STRATEGIES.has(plan.replacement_strategy)) {
        failures.push(`${boundary.id} uses unsupported replacement strategy ${plan.replacement_strategy}`);
      }
      if (!plan.followup?.issue_id || !plan.followup?.external_ref) {
        failures.push(`${boundary.id} has no follow-up issue`);
      }
      if (!Array.isArray(plan.required_gates) || plan.required_gates.length < 3) {
        failures.push(`${boundary.id} needs at least three required gates`);
      }
      return {
        id: boundary.id,
        name: boundary.name,
        kind: boundary.kind,
        source_path: boundary.source_path,
        distribution_path: boundary.distribution_path,
        c3_php_vendor_inventory: boundary.c3_php_vendor_inventory,
        source_inventory_count: boundary.source_inventory.count,
        distribution_artifact_count: boundary.distribution_artifacts.count,
        current_strategy: boundary.strategy,
        replacement_strategy: plan.replacement_strategy,
        priority: plan.priority,
        followup_issue: plan.followup,
        rationale: plan.rationale,
        required_gates: plan.required_gates,
        removal_gate:
          "Do not claim Haxe-owned replacement or generated public PHP retirement for this vendor boundary until the follow-up issue records passing evidence for each required gate and updates the WPHX-323 ownership manifest."
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  const copiedSurfacePlans = closure.wphx_312_preserved_vendor_surfaces.map((surface) => {
    const boundaryId = COPIED_SURFACE_TO_BOUNDARY[surface.external_ref];
    if (!boundaryId) failures.push(`${surface.external_ref} has no copied-surface replacement boundary mapping`);
    const boundaryPlan = boundaryPlans.find((plan) => plan.id === boundaryId);
    if (!boundaryPlan) failures.push(`${surface.external_ref} maps to missing boundary plan ${boundaryId}`);
    return {
      external_ref: surface.external_ref,
      issue_id: surface.issue_id,
      unit_name: surface.unit_name,
      ownership_manifest: surface.ownership_manifest,
      preserved_vendor_boundary_id: boundaryId,
      replacement_followup_issue: boundaryPlan?.followup_issue,
      replacement_strategy: boundaryPlan?.replacement_strategy,
      closure_state: "routed_to_wphx_323_01_replacement_strategy_followup"
    };
  });

  const plannedSourceCount = boundaryPlans.reduce((sum, plan) => sum + plan.source_inventory_count, 0);
  const plannedArtifactCount = boundaryPlans.reduce((sum, plan) => sum + plan.distribution_artifact_count, 0);
  const plannedC3SourceCount = boundaryPlans
    .filter((plan) => plan.c3_php_vendor_inventory)
    .reduce((sum, plan) => sum + plan.source_inventory_count, 0);
  const plannedC3ArtifactCount = boundaryPlans
    .filter((plan) => plan.c3_php_vendor_inventory)
    .reduce((sum, plan) => sum + plan.distribution_artifact_count, 0);
  const plannedBundledSourceCount = plannedSourceCount - plannedC3SourceCount;
  const plannedBundledArtifactCount = plannedArtifactCount - plannedC3ArtifactCount;
  const byFollowup = {};
  for (const plan of boundaryPlans) {
    const ref = plan.followup_issue.external_ref;
    byFollowup[ref] ??= {
      issue: plan.followup_issue,
      boundary_ids: [],
      source_inventory_count: 0,
      distribution_artifact_count: 0
    };
    byFollowup[ref].boundary_ids.push(plan.id);
    byFollowup[ref].source_inventory_count += plan.source_inventory_count;
    byFollowup[ref].distribution_artifact_count += plan.distribution_artifact_count;
  }

  if (plannedC3SourceCount !== closure.validation_result.c3_php_vendor_entries_covered) {
    failures.push(
      `planned C3 source count ${plannedC3SourceCount} does not match closure C3 covered count ${closure.validation_result.c3_php_vendor_entries_covered}`
    );
  }
  if (plannedC3ArtifactCount !== closure.validation_result.c3_php_vendor_distribution_artifacts) {
    failures.push(
      `planned C3 artifact count ${plannedC3ArtifactCount} does not match closure C3 artifact count ${closure.validation_result.c3_php_vendor_distribution_artifacts}`
    );
  }

  if (failures.length > 0) {
    throw new Error(`WPHX-323.01 vendor replacement strategy failed:\n- ${failures.join("\n- ")}`);
  }

  const validationResult = {
    vendor_boundary_count: closure.vendor_boundaries.length,
    replacement_plan_count: boundaryPlans.length,
    wphx_312_preserved_vendor_surface_count: closure.wphx_312_preserved_vendor_surfaces.length,
    copied_surface_replacement_plan_count: copiedSurfacePlans.length,
    planned_source_inventory_count: plannedSourceCount,
    planned_distribution_artifact_count: plannedArtifactCount,
    planned_c3_source_inventory_count: plannedC3SourceCount,
    planned_c3_distribution_artifact_count: plannedC3ArtifactCount,
    planned_bundled_library_source_inventory_count: plannedBundledSourceCount,
    planned_bundled_library_distribution_artifact_count: plannedBundledArtifactCount,
    followup_issue_count: Object.keys(byFollowup).length,
    highest_priority_boundaries: boundaryPlans.slice(0, 6).map((plan) => plan.id),
    allowed_replacement_strategies: [...ALLOWED_STRATEGIES].sort()
  };

  const manifest = {
    schema: "wphx.wp-core-php-vendor-replacement-strategy.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: {
      runner: RUNNER,
      mode: "deterministic"
    },
    scope: {
      parent_issue: {
        issue_id: "wordpresshx-l76.26",
        external_ref: "WPHX-323",
        title: "PHP vendor manifest closure"
      },
      strategy_owner_issue: ISSUE,
      description:
        "Plans removal paths for every PHP vendor or bundled-library boundary preserved by WPHX-323 and routes the six WPHX-312 copied preserved-vendor surfaces to replacement follow-up work."
    },
    inputs: {
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      vendor_closure_receipt: fileRecord(VENDOR_RECEIPT),
      vendor_closure_manifest_sha256_recorded_in_receipt: vendorReceipt.manifest_sha256
    },
    policy: {
      replacement_claim_requires_followup_receipt: true,
      generated_public_php_replacement_claimed: false,
      haxe_owned_vendor_runtime_claimed: false,
      copied_vendor_exception_retired: false,
      allowed_replacement_strategies: [...ALLOWED_STRATEGIES].sort()
    },
    boundary_replacement_plan: boundaryPlans,
    wphx_312_copied_surface_replacement_plan: copiedSurfacePlans,
    followup_groups: Object.values(byFollowup).sort((a, b) => a.issue.external_ref.localeCompare(b.issue.external_ref)),
    validation_result: validationResult,
    claims: [
      "Every WPHX-323 preserved PHP vendor or bundled-library boundary has a machine-readable replacement strategy and follow-up owner.",
      "Every WPHX-312 copied preserved-vendor surface is linked to a WPHX-323.01 boundary replacement plan.",
      "The plan prioritizes HTTP, mail, feed, security, archive, localization, legacy, AI-client, and browser-loader boundaries by runtime blast radius and replacement risk."
    ],
    non_claims: [
      "This plan does not implement Haxe-owned vendor runtime logic.",
      "This plan does not generate replacement public PHP or retire copied/vendor artifacts.",
      "This plan does not complete legal, security, C3 runtime, live-network, browser, installed WordPress, or ecosystem parity review.",
      "This plan does not authorize using copied vendor PHP as durable WPHX implementation source."
    ]
  };

  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestText);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-01-php-vendor-replacement-strategy",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "vendor_replacement_strategy_plan",
    artifact_scope: "wordpress-7.0-php-vendor-preserved-boundaries",
    commands: [
      "npm run wp:core:wphx-323-vendor-replacement-strategy",
      "npm run wp:core:wphx-323-vendor-replacement-strategy:check"
    ],
    artifacts: {
      manifest: OUT,
      vendor_closure_manifest: VENDOR_CLOSURE,
      vendor_closure_receipt: VENDOR_RECEIPT
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
  console.log(
    `planned ${boundaryPlans.length} vendor boundaries and ${copiedSurfacePlans.length} copied preserved-vendor surfaces across ${Object.keys(byFollowup).length} follow-up issues`
  );
}

main();
