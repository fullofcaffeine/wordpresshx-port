#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.30",
  external_ref: "WPHX-323.02",
  title: "Plan HTTP vendor replacement gates"
};
const RECORDED_AT = "2026-07-07T14:00:00.000Z";
const RUNNER = "tools/wp-core/run-php-http-vendor-replacement-gates.mjs";
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const OUT = "manifests/wp-core/wphx-323-02-http-vendor-replacement-gates.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-02-http-vendor-replacement-gates.v1.json";

const DOWNSTREAM_ISSUES = {
  requests_api_reflection: {
    issue_id: "wordpresshx-wgwq",
    external_ref: "WPHX-323.08",
    title: "Add Requests API and reflection fixture"
  },
  requests_live_transport: {
    issue_id: "wordpresshx-l5yn",
    external_ref: "WPHX-323.09",
    title: "Add Requests live transport replacement parity gate"
  },
  snoopy_legacy_exception: {
    issue_id: "wordpresshx-jh34",
    external_ref: "WPHX-323.10",
    title: "Add Snoopy legacy compatibility and exception gate"
  }
};

const EXISTING_EVIDENCE = [
  {
    id: "wphx-312-33-http-requests-bridge",
    manifest: "manifests/wp-core/wphx-312-33-http-requests-bridge-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-33-http-requests-bridge-oracle-fixture.v1.json",
    role: "deterministic Requests bridge behavior for response/header/cookie/hook wrapping"
  },
  {
    id: "wphx-312-41-wp-http-helper",
    manifest: "manifests/wp-core/wphx-312-41-wp-http-helper-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-41-wp-http-helper-oracle-fixture.v1.json",
    role: "deterministic WP_Http helper behavior around redirects, cookies, and URL handling"
  },
  {
    id: "wphx-312-43-http-api-wrapper-safety",
    manifest: "manifests/wp-core/wphx-312-43-http-api-wrapper-safety-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-43-http-api-wrapper-safety-oracle-fixture.v1.json",
    role: "deterministic HTTP API wrapper and safe URL behavior"
  },
  {
    id: "wphx-312-46-wp-http-request-orchestration",
    manifest: "manifests/wp-core/wphx-312-46-wp-http-request-orchestration-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-46-wp-http-request-orchestration-oracle-fixture.v1.json",
    role: "deterministic WP_Http::request Requests option handoff behavior"
  },
  {
    id: "wphx-312-48-wp-http-transport-dispatch",
    manifest: "manifests/wp-core/wphx-312-48-wp-http-transport-dispatch-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-48-wp-http-transport-dispatch-oracle-fixture.v1.json",
    role: "deprecated transport selection and dispatch control-flow behavior"
  },
  {
    id: "wphx-312-92-http-transport-parity",
    manifest: "manifests/wp-core/wphx-312-92-http-transport-parity-gate.v1.json",
    receipt: "receipts/wp-core/wphx-312-92-http-transport-parity-gate.v1.json",
    role: "recorded Requests-boundary parity over generated WP_Http request shells without live network I/O"
  },
  {
    id: "wphx-312-23-magpie-rss-fetch-cache",
    manifest: "manifests/wp-core/wphx-312-23-magpie-rss-fetch-cache-oracle-fixture.v1.json",
    receipt: "receipts/wp-core/wphx-312-23-magpie-rss-fetch-cache-oracle-fixture.v1.json",
    role: "MagpieRSS fetch/cache behavior that converts WP HTTP responses into Snoopy-compatible shapes"
  },
  {
    id: "wphx-318-01-legacy-surface",
    manifest: "manifests/wp-core/wphx-318-01-xmlrpc-legacy-deprecated-surface.v1.json",
    receipt: "receipts/wp-core/wphx-318-01-xmlrpc-legacy-deprecated-surface.v1.json",
    role: "legacy/deprecated and XML-RPC surface inventory that records Snoopy handoffs"
  }
];

const REQUESTS_REQUIRED_AREAS = [
  "WpOrg\\Requests\\Requests",
  "WpOrg\\Requests\\Session",
  "WpOrg\\Requests\\Response",
  "WpOrg\\Requests\\Response\\Headers",
  "WpOrg\\Requests\\Cookie",
  "WpOrg\\Requests\\Cookie\\Jar",
  "WpOrg\\Requests\\Hooks",
  "WpOrg\\Requests\\HookManager",
  "WpOrg\\Requests\\Iri",
  "WpOrg\\Requests\\Ipv6",
  "WpOrg\\Requests\\Ssl",
  "WpOrg\\Requests\\Proxy\\Http",
  "WpOrg\\Requests\\Transport\\Curl",
  "WpOrg\\Requests\\Transport\\Fsockopen",
  "WpOrg\\Requests\\Utility\\CaseInsensitiveDictionary",
  "WpOrg\\Requests\\Exception and HTTP status exception classes"
];

const SNOOPY_REQUIRED_AREAS = [
  "Snoopy::fetch",
  "Snoopy::submit",
  "Snoopy::fetchlinks",
  "Snoopy::fetchform",
  "Snoopy::fetchtext",
  "Snoopy::submitlinks",
  "Snoopy::submittext",
  "Snoopy::set_submit_multipart",
  "Snoopy::set_submit_normal",
  "Snoopy::_httprequest",
  "Snoopy::_httpsrequest",
  "Snoopy::setcookies",
  "Snoopy::_connect",
  "Snoopy::_prepare_post_body",
  "public response/status/header/body/cookie/error fields"
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
  const closure = readJson(VENDOR_CLOSURE);
  const selectedIds = ["requests", "snoopy"];
  const selectedStrategy = selectedIds.map((id) => strategy.boundary_replacement_plan.find((plan) => plan.id === id));
  const selectedClosure = selectedIds.map((id) => closure.vendor_boundaries.find((boundary) => boundary.id === id));

  for (const id of selectedIds) {
    const plan = strategy.boundary_replacement_plan.find((entry) => entry.id === id);
    const boundary = closure.vendor_boundaries.find((entry) => entry.id === id);
    if (!plan) failures.push(`${id} is missing from WPHX-323.01 replacement strategy`);
    if (!boundary) failures.push(`${id} is missing from WPHX-323 vendor closure`);
    if (plan?.followup_issue.external_ref !== ISSUE.external_ref) {
      failures.push(`${id} is not routed to ${ISSUE.external_ref}`);
    }
  }

  if (selectedClosure[0]?.source_inventory.count !== 65) {
    failures.push(`expected Requests to cover 65 PHP source entries, found ${selectedClosure[0]?.source_inventory.count}`);
  }
  if (selectedClosure[1]?.source_inventory.count !== 1) {
    failures.push(`expected Snoopy to cover 1 PHP source entry, found ${selectedClosure[1]?.source_inventory.count}`);
  }

  for (const evidence of EXISTING_EVIDENCE) {
    if (!existsSync(evidence.manifest)) failures.push(`${evidence.id} manifest is missing: ${evidence.manifest}`);
    if (!existsSync(evidence.receipt)) failures.push(`${evidence.id} receipt is missing: ${evidence.receipt}`);
  }

  const gatePlan = [
    {
      id: "requests-api-reflection-fixture",
      boundary_id: "requests",
      downstream_issue: DOWNSTREAM_ISSUES.requests_api_reflection,
      gate_kind: "minimized_behavior_fixture",
      required_before: ["generated_wrapper_claim", "host_primitive_replacement_claim", "copied_requests_retirement"],
      required_observations: REQUESTS_REQUIRED_AREAS,
      acceptance:
        "Preserved upstream Requests package and candidate replacement expose matching public classes, constants, constructor/method signatures, exception classes, hook interfaces, cookie/header/session/proxy/transport objects, namespace aliases, and reflection-visible behavior.",
      fallback_policy:
        "Keep wp-includes/Requests copied from upstream until this fixture exists and passes for both preserved upstream and candidate replacement paths.",
      removal_gate:
        "Do not replace the Requests package or cite generated wrapper ownership until WPHX-323.02.1 records passing API/reflection evidence."
    },
    {
      id: "requests-live-transport-matrix",
      boundary_id: "requests",
      downstream_issue: DOWNSTREAM_ISSUES.requests_live_transport,
      gate_kind: "live_or_recorded_local_transport_parity",
      required_before: ["host_primitive_replacement_claim", "wp_http_live_transport_claim", "copied_requests_retirement"],
      required_observations: [
        "GET, HEAD, POST, PUT, DELETE, custom method, query string, form body, raw body, and multipart body handoff",
        "status codes, reason phrases, repeated headers, case-insensitive headers, redirects, cookies, and cookie jar mutation",
        "curl and fsockopen/streams capability paths or documented host capability skips",
        "proxy address/authentication, proxy bypass, TLS verification, certificate failure, timeout, DNS failure, connection refusal, and invalid URL errors",
        "streaming filename, max bytes, blocking=false response shape, and WordPress WP_Error mapping",
        "WP_HTTP_Requests_Hooks forwarding and http_api_debug/http_response observations"
      ],
      acceptance:
        "A deterministic local HTTP/TLS/proxy service or recorded equivalent compares preserved Requests behavior with the candidate host-primitive-backed path through WP_Http and direct Requests entry points.",
      fallback_policy:
        "Preserved upstream Requests remains the runtime fallback for unsupported host capability, divergent transport behavior, or unmodeled live network/TLS/proxy cases.",
      removal_gate:
        "Do not retire copied Requests artifacts until WPHX-323.02.2 records live/local transport parity and an explicit fallback matrix."
    },
    {
      id: "requests-generated-public-wrapper",
      boundary_id: "requests",
      downstream_issue: DOWNSTREAM_ISSUES.requests_api_reflection,
      gate_kind: "generated_public_wrapper_shape",
      required_before: ["generated_wrapper_claim", "distribution_divergence"],
      required_observations: [
        "Generated original-path files preserve wp-includes/Requests package paths or documented autoload-compatible aliases",
        "Composer/autoload, namespace, class_exists, interface_exists, trait_exists, and stack-trace behavior stay plugin-visible",
        "Generated wrapper bodies contain no hand-authored durable public PHP and cite WPHX PHP or approved compiler/profile evidence",
        "Package overlay manifest records each candidate file difference from preserved upstream Requests"
      ],
      acceptance:
        "Generated wrapper or adapter emission is proven as a public ABI artifact before any Requests distribution file diverges from upstream.",
      fallback_policy:
        "If wrapper emission cannot preserve ecosystem-visible Requests behavior, renew the preserved upstream exception instead of replacing the package.",
      removal_gate:
        "Do not ship a divergent Requests package without generated wrapper evidence, overlay manifest evidence, and passing API/transport gates."
    },
    {
      id: "requests-license-provenance-review",
      boundary_id: "requests",
      downstream_issue: DOWNSTREAM_ISSUES.requests_api_reflection,
      gate_kind: "license_provenance_review",
      required_before: ["distribution_divergence", "copied_requests_retirement"],
      required_observations: [
        "Requests notice and license files remain preserved while copied",
        "Replacement/wrapper distribution records source, license, notices, and file-level provenance",
        "Any external runtime dependency is accepted only when the official WordPress distribution has an equivalent dependency assumption"
      ],
      acceptance:
        "License/provenance review is updated before generated replacement or dependency-wrapper distribution changes.",
      fallback_policy:
        "Keep the preserved upstream Requests package if provenance, notice, or dependency assumptions are not settled.",
      removal_gate:
        "Do not remove Requests notice/provenance records or distribute replacement files without an updated license manifest."
    },
    {
      id: "snoopy-legacy-api-fixture",
      boundary_id: "snoopy",
      downstream_issue: DOWNSTREAM_ISSUES.snoopy_legacy_exception,
      gate_kind: "minimized_legacy_behavior_fixture",
      required_before: ["renewed_snoopy_exception", "snoopy_replacement_claim", "copied_snoopy_retirement"],
      required_observations: SNOOPY_REQUIRED_AREAS,
      acceptance:
        "Preserved Snoopy behavior is locked through deterministic legacy API fixtures before the exception is renewed or any replacement trigger is admitted.",
      fallback_policy:
        "Keep upstream class-snoopy.php preserved unless a plugin/ecosystem audit proves real replacement pressure and the replacement preserves legacy property/method behavior.",
      removal_gate:
        "Do not replace Snoopy or claim Haxe-owned legacy HTTP behavior until WPHX-323.02.3 records passing legacy API evidence."
    },
    {
      id: "snoopy-caller-ecosystem-review",
      boundary_id: "snoopy",
      downstream_issue: DOWNSTREAM_ISSUES.snoopy_legacy_exception,
      gate_kind: "caller_and_ecosystem_review",
      required_before: ["snoopy_replacement_claim", "copied_snoopy_retirement"],
      required_observations: [
        "MagpieRSS fetch/cache callers from WPHX-312 remain compatible with Snoopy-compatible response shapes",
        "WPHX-318 XML-RPC, legacy, and deprecated inventories are reviewed for direct or indirect Snoopy exposure",
        "Plugin-visible class_exists('Snoopy'), public fields, timeout/connect/cookie behavior, and deprecated usage remain preserved",
        "Replacement trigger records actual ecosystem pressure; absence of pressure renews the preserved-artifact exception"
      ],
      acceptance:
        "Snoopy replacement is blocked unless caller/effect evidence shows it is safer than renewal; otherwise the receipt renews the preserved exception with explicit tests and provenance.",
      fallback_policy:
        "Preserve class-snoopy.php as an upstream artifact for deprecated compatibility when no replacement pressure is documented.",
      removal_gate:
        "Do not retire class-snoopy.php until caller review and ecosystem pressure evidence choose a replacement path."
    },
    {
      id: "snoopy-license-provenance-review",
      boundary_id: "snoopy",
      downstream_issue: DOWNSTREAM_ISSUES.snoopy_legacy_exception,
      gate_kind: "license_provenance_review",
      required_before: ["renewed_snoopy_exception", "distribution_divergence"],
      required_observations: [
        "class-snoopy.php file header/provenance remains recorded while preserved",
        "Renewed exception receipt records why deprecated legacy compatibility is safer than replacement",
        "Any replacement wrapper records source, generated-emission path, notice treatment, and fallback policy"
      ],
      acceptance:
        "Snoopy has explicit provenance and exception-renewal evidence before the preserved library status is relied on by later closure receipts.",
      fallback_policy:
        "Keep the preserved upstream file if provenance or replacement safety is unsettled.",
      removal_gate:
        "Do not distribute a divergent Snoopy file without updated license/provenance and caller compatibility evidence."
    }
  ];

  const evidenceRecords = EXISTING_EVIDENCE.map((entry) => ({
    ...entry,
    manifest_record: fileRecord(entry.manifest),
    receipt_record: fileRecord(entry.receipt)
  }));

  const validationResult = {
    planned_boundary_ids: selectedIds,
    planned_boundary_count: selectedIds.length,
    requests_source_inventory_count: selectedClosure[0]?.source_inventory.count,
    requests_distribution_artifact_count: selectedClosure[0]?.distribution_artifacts.count,
    snoopy_source_inventory_count: selectedClosure[1]?.source_inventory.count,
    snoopy_distribution_artifact_count: selectedClosure[1]?.distribution_artifacts.count,
    gate_count: gatePlan.length,
    downstream_issue_count: Object.keys(DOWNSTREAM_ISSUES).length,
    existing_evidence_count: evidenceRecords.length,
    requests_required_area_count: REQUESTS_REQUIRED_AREAS.length,
    snoopy_required_area_count: SNOOPY_REQUIRED_AREAS.length
  };

  if (gatePlan.length !== 7) failures.push(`expected 7 HTTP vendor gates, found ${gatePlan.length}`);
  if (Object.keys(DOWNSTREAM_ISSUES).length !== 3) failures.push("expected 3 downstream issues");
  if (failures.length > 0) {
    throw new Error(`WPHX-323.02 HTTP vendor gate plan failed:\n- ${failures.join("\n- ")}`);
  }

  const manifest = {
    schema: "wphx.wp-core-http-vendor-replacement-gates.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: {
      runner: RUNNER,
      mode: "deterministic"
    },
    scope: {
      parent_strategy_manifest: STRATEGY,
      covered_boundaries: selectedStrategy.map((plan, index) => ({
        id: plan.id,
        name: plan.name,
        kind: plan.kind,
        source_path: plan.source_path,
        distribution_path: plan.distribution_path,
        current_strategy: plan.current_strategy,
        replacement_strategy: plan.replacement_strategy,
        source_inventory_count: selectedClosure[index].source_inventory.count,
        distribution_artifact_count: selectedClosure[index].distribution_artifacts.count
      }))
    },
    inputs: {
      replacement_strategy_manifest: fileRecord(STRATEGY),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      existing_evidence: evidenceRecords
    },
    chosen_paths: [
      {
        boundary_id: "requests",
        chosen_path: "host_primitive_backed_reimplementation_with_preserved_fallback",
        replacement_owner: DOWNSTREAM_ISSUES.requests_live_transport,
        prerequisite_owner: DOWNSTREAM_ISSUES.requests_api_reflection,
        decision:
          "Requests may move toward a host-primitive-backed implementation only after public API/reflection and live/local transport parity pass; preserved upstream Requests remains fallback until then."
      },
      {
        boundary_id: "snoopy",
        chosen_path: "renewed_preserved_artifact_exception_with_tests_provenance",
        replacement_owner: DOWNSTREAM_ISSUES.snoopy_legacy_exception,
        decision:
          "Snoopy stays a preserved legacy artifact unless deterministic legacy fixtures plus caller/ecosystem review show stronger pressure for a generated wrapper or Haxe-owned replacement."
      }
    ],
    gate_plan: gatePlan,
    downstream_issues: DOWNSTREAM_ISSUES,
    validation_result: validationResult,
    claims: [
      "Requests and Snoopy now have explicit HTTP vendor replacement gate plans linked to WPHX-323.01.",
      "Requests replacement is blocked on API/reflection, generated wrapper shape, live/local transport parity, fallback, and license/provenance gates.",
      "Snoopy replacement is blocked on legacy API, caller/ecosystem, renewed-exception, fallback, and license/provenance gates."
    ],
    non_claims: [
      "This plan does not implement a Haxe-owned Requests or Snoopy runtime.",
      "This plan does not replace copied Requests or class-snoopy.php distribution artifacts.",
      "This plan does not claim live HTTP, TLS, proxy, DNS, curl, streams/fsockopen, or installed WordPress parity.",
      "This plan does not claim generated public PHP wrapper ownership or ecosystem compatibility by itself."
    ]
  };

  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestText);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-02-http-vendor-replacement-gates",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "http_vendor_replacement_gate_plan",
    artifact_scope: "requests-and-snoopy-preserved-http-vendor-boundaries",
    commands: [
      "npm run wp:core:wphx-323-http-vendor-replacement-gates",
      "npm run wp:core:wphx-323-http-vendor-replacement-gates:check"
    ],
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
  console.log(`planned ${gatePlan.length} HTTP vendor gates for Requests and Snoopy`);
}

main();
