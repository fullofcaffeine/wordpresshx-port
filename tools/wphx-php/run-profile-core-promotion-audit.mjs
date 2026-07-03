#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const checkOnly = process.argv.includes("--check");
const RECORDED_AT = "2026-07-03T06:00:00Z";
const RUNNER = "tools/wphx-php/run-profile-core-promotion-audit.mjs";
const MANIFEST = "manifests/wphx-php/profile-core-promotion-audit.v1.json";
const RECEIPT = "receipts/compiler/wphx-comp-php-profile-core-promotion-audit.v1.json";
const COMPILER = "src/wphx/compiler/php/WphxPhpCompiler.hx";
const WORDPRESS_PROFILE = "src/wphx/compiler/php/WphxPhpWordPressAdapters.hx";
const ORACLE_RESPONSE = "docs/operations/oracle-wphx-php-pivot-soundness-response.md";
const ISSUE = {
  id: "wordpresshx-sm45",
  external_ref: "WPHX-COMP-PHP-PROFILE-CORE-PROMOTION-AUDIT",
  title: "Classify profile adapters for core promotion"
};

const ALLOWED_CLASSIFICATIONS = new Set([
  "profile_only_abi_constraint",
  "core_ir_candidate",
  "temporary_bridge",
  "backend_promotion_pressure"
]);
const FOLLOW_UP_ISSUES = {
  "WPHX-COMP-PHP-NATIVE-ARRAY-MUTATION-CORE": "wordpresshx-f808",
  "WPHX-COMP-PHP-CALLABLE-CLOSURE-CORE": "wordpresshx-ze8a",
  "WPHX-COMP-PHP-STATIC-DYNAMIC-MEMBER-CORE": "wordpresshx-sbot",
  "WPHX-COMP-PHP-FILE-SEGMENT-CORE-API": "wordpresshx-jcyk",
  "WPHX-COMP-PHP-FILE-OWNERSHIP-INVENTORIES": "wordpresshx-9esi",
  "WPHX-COMP-PHP-PRIVATE-EMITTER-PILOT": "wordpresshx-4j86"
};

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function normalizePath(path) {
  return path.split("\\").join("/");
}

function fileRecord(path) {
  return {
    path: normalizePath(path),
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function lineNumberForOffset(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function methodAdapterRegistry() {
  const source = readFileSync(WORDPRESS_PROFILE, "utf8");
  const start = source.indexOf("public static function methodBody");
  const end = source.indexOf("case _:", start);
  const slice = start === -1 || end === -1 ? "" : source.slice(start, end);
  const entries = [];
  const adapterCase = /case "([^"]+)":/g;
  let match;
  while ((match = adapterCase.exec(slice)) !== null) {
    entries.push({
      registry_kind: "method_adapter",
      adapter: match[1],
      source_path: WORDPRESS_PROFILE,
      source_line: lineNumberForOffset(source, start + match.index)
    });
  }
  return entries.sort((left, right) => left.adapter.localeCompare(right.adapter));
}

function scriptAdapterRegistry() {
  const source = readFileSync(COMPILER, "utf8");
  const start = source.indexOf("function fileSegmentPlans");
  const end = source.indexOf("function emitFunction", start);
  const slice = start === -1 || end === -1 ? "" : source.slice(start, end);
  const entries = [];
  const adapterCase = /adapter:\s*"([^"]+)"/g;
  let match;
  while ((match = adapterCase.exec(slice)) !== null) {
    entries.push({
      registry_kind: "script_adapter",
      adapter: match[1],
      source_path: COMPILER,
      source_line: lineNumberForOffset(source, start + match.index)
    });
  }
  return entries.sort((left, right) => left.adapter.localeCompare(right.adapter));
}

function domainFor(adapter, registryKind) {
  if (registryKind === "script_adapter") {
    if (adapter.startsWith("template-segment-")) return "template_segment";
    if (adapter === "include-side-effects") return "direct_file_scope";
    if (adapter === "deprecated-class-http") return "deprecated_file_whole_file_pilot";
    return "script_adapter";
  }
  if (adapter.startsWith("wp-http-encoding-")) return "http_encoding";
  if (adapter.startsWith("wp-http-proxy-")) return "http_proxy";
  if (adapter.startsWith("wp-http-response-")) return "http_response";
  if (adapter.startsWith("wp-http-cookie-")) return "http_cookie";
  if (adapter.startsWith("wp-http-transport-")) return "http_transport";
  if (adapter.startsWith("wp-embed-")) return "embed";
  if (adapter.startsWith("wp-oembed-")) return "oembed";
  if (adapter.startsWith("wp-http-")) return "http";
  return "wordpress_profile";
}

function classificationGroups() {
  return [
    {
      registry_kind: "method_adapter",
      classification: "core_ir_candidate",
      follow_up_owner: "WPHX-COMP-PHP-NATIVE-ARRAY-MUTATION-CORE",
      adapters: [
        "wp-http-process-headers",
        "wp-http-build-cookie-header",
        "wp-http-response-construct",
        "wp-http-response-get-data",
        "wp-http-response-set-data",
        "wp-http-response-get-headers",
        "wp-http-response-set-headers",
        "wp-http-response-header",
        "wp-http-response-get-status",
        "wp-http-response-set-status",
        "wp-http-response-json-serialize",
        "wp-http-cookie-construct",
        "wp-http-cookie-test",
        "wp-http-cookie-get-header-value",
        "wp-http-cookie-get-full-header",
        "wp-http-cookie-get-attributes",
        "wp-http-normalize-cookies"
      ],
      rationale:
        "These adapters repeatedly exercise native associative arrays, object-field storage, falsey-value-preserving reads, array appends, and structured header/cookie mutation that should be reusable PHP core IR.",
      promotion_gate:
        "Before adding similar header, response, or cookie profile bodies, promote the repeated array read/write/append/isset/empty/null distinction behavior into a generic native-array core fixture."
    },
    {
      registry_kind: "method_adapter",
      classification: "core_ir_candidate",
      follow_up_owner: "WPHX-COMP-PHP-CALLABLE-CLOSURE-CORE",
      adapters: [
        "wp-http-handle-redirects",
        "wp-http-transport-get-first-available",
        "wp-http-transport-dispatch-request",
        "wp-embed-register-handler",
        "wp-embed-unregister-handler",
        "wp-embed-get-handler-html",
        "wp-embed-delete-oembed-caches",
        "wp-embed-autoembed-callback",
        "wp-embed-autoembed",
        "wp-embed-find-oembed-post-id"
      ],
      rationale:
        "These bodies combine WordPress ABI calls with reusable PHP mechanics: callable arrays, dynamic helper calls, hook payload arrays, nested mutation, and callback-style control flow.",
      promotion_gate:
        "Before expanding callback-heavy HTTP/embed adapters, add a core callable/closure fixture that covers callable arrays, call_user_func-style dispatch, accepted-args behavior, and reference-sensitive payload mutation."
    },
    {
      registry_kind: "method_adapter",
      classification: "core_ir_candidate",
      follow_up_owner: "WPHX-COMP-PHP-STATIC-DYNAMIC-MEMBER-CORE",
      adapters: ["wp-oembed-add-provider-early", "wp-oembed-remove-provider-early"],
      rationale:
        "The early-provider adapters exist because WP_oEmbed exposes static provider queues and mutable native arrays; the useful compiler pressure is static-property and dynamic-member lowering.",
      promotion_gate:
        "Before claiming broader WP_oEmbed ownership, move static property defaults, static array mutation, dynamic class/member access, and class-string behavior into reusable core IR fixtures."
    },
    {
      registry_kind: "method_adapter",
      classification: "profile_only_abi_constraint",
      follow_up_owner: "WPHX-COMP-PHP-FILE-OWNERSHIP-INVENTORIES",
      adapters: [
        "wp-http-is-ip-address",
        "wp-http-browser-redirect-compatibility",
        "wp-http-validate-redirects",
        "wp-http-make-absolute-url",
        "wp-http-block-request"
      ],
      rationale:
        "These are WordPress HTTP policy and URL-safety boundaries whose observable value is matching core constants, filters, and public method ABI, even though individual expressions may later use core IR.",
      promotion_gate:
        "Keep these classified as profile ABI constraints until whole-file HTTP inventory shows repeated generic lowering pressure that is not specific to WordPress HTTP policy."
    },
    {
      registry_kind: "method_adapter",
      classification: "profile_only_abi_constraint",
      follow_up_owner: "WPHX-COMP-PHP-FILE-OWNERSHIP-INVENTORIES",
      adapters: [
        "wp-http-encoding-compress",
        "wp-http-encoding-decompress",
        "wp-http-encoding-compatible-gzinflate",
        "wp-http-encoding-accept-encoding",
        "wp-http-encoding-content-encoding",
        "wp-http-encoding-should-decode",
        "wp-http-encoding-is-available",
        "wp-http-proxy-is-enabled",
        "wp-http-proxy-use-authentication",
        "wp-http-proxy-constant",
        "wp-http-proxy-authentication",
        "wp-http-proxy-authentication-header",
        "wp-http-proxy-send-through-proxy"
      ],
      rationale:
        "These wrappers are dominated by WordPress-visible proxy/encoding constants, method names, and PHP extension handoff policy; broad behavior remains a file/domain ownership question.",
      promotion_gate:
        "Do not broaden beyond selected adapters until HTTP whole-file ownership gates inventory proxy, TLS, headers, streams, live transport, and Requests handoff behavior."
    },
    {
      registry_kind: "method_adapter",
      classification: "profile_only_abi_constraint",
      follow_up_owner: "WPHX-COMP-PHP-FILE-OWNERSHIP-INVENTORIES",
      adapters: [
        "wp-embed-construct",
        "wp-embed-run-shortcode",
        "wp-embed-maybe-run-ajax-cache",
        "wp-embed-maybe-make-link"
      ],
      rationale:
        "These WP_Embed methods are profile-sensitive because their value is hook timing, shortcode registration, cache-post timing, and filter-visible WordPress output behavior.",
      promotion_gate:
        "Hold these as profile-only until the embed whole-file inventory separates hook/shortcode ABI from generic callback, array, and output-buffer lowering needs."
    },
    {
      registry_kind: "method_adapter",
      classification: "backend_promotion_pressure",
      follow_up_owner: "WPHX-COMP-PHP-PRIVATE-EMITTER-PILOT",
      adapters: ["wp-http-request-nonblocking", "wp-embed-shortcode", "wp-embed-cache-oembed"],
      rationale:
        "These adapters are larger orchestration bodies. If similar slices keep appearing, Adapter IR will be doing backend work rather than bounded public ABI shaping.",
      promotion_gate:
        "Before adding comparable orchestration adapters, either reduce the repeated constructs into reusable core IR or file backend-promotion evidence through the private-emitter ladder."
    },
    {
      registry_kind: "script_adapter",
      classification: "core_ir_candidate",
      follow_up_owner: "WPHX-COMP-PHP-FILE-SEGMENT-CORE-API",
      adapters: ["include-side-effects", "deprecated-class-http"],
      rationale:
        "These named script switches represent generic file-scope statement emission, require/require_once, include timing, and return/direct-script behavior.",
      promotion_gate:
        "Move direct file-scope statements and include/require emission toward a reusable file-segment IR API before adding more named script switches."
    },
    {
      registry_kind: "script_adapter",
      classification: "temporary_bridge",
      follow_up_owner: "WPHX-COMP-PHP-FILE-SEGMENT-CORE-API",
      adapters: ["template-segment-admin-style", "template-segment-nested-parent", "template-segment-nested-partial"],
      rationale:
        "The template-segment switches are minimized mixed-template probes; keeping them named is acceptable only while the segment model is still fixture-bounded.",
      promotion_gate:
        "Replace named template script switches with generic segment registration and caller-scope metadata before claiming mixed-template ownership."
    }
  ];
}

function buildClassificationTable() {
  const table = new Map();
  const duplicateAssignments = [];
  for (const group of classificationGroups()) {
    for (const adapter of group.adapters) {
      const key = `${group.registry_kind}:${adapter}`;
      if (table.has(key)) {
        duplicateAssignments.push(key);
      }
      table.set(key, {
        registry_kind: group.registry_kind,
        adapter,
        classification: group.classification,
        follow_up_owner: group.follow_up_owner,
        rationale: group.rationale,
        promotion_gate: group.promotion_gate
      });
    }
  }
  return { table, duplicateAssignments };
}

function countBy(records, key) {
  const counts = {};
  for (const record of records) {
    const value = record[key] ?? "(none)";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.keys(counts)
    .sort()
    .map((value) => ({ value, count: counts[value] }));
}

function buildAudit() {
  const methodRegistry = methodAdapterRegistry();
  const scriptRegistry = scriptAdapterRegistry();
  const registry = [...methodRegistry, ...scriptRegistry];
  const registryKeys = new Set(registry.map((record) => `${record.registry_kind}:${record.adapter}`));
  const { table, duplicateAssignments } = buildClassificationTable();
  const tableKeys = new Set(table.keys());
  const unclassified = registry.filter((record) => !tableKeys.has(`${record.registry_kind}:${record.adapter}`));
  const staleClassifications = [...table.values()]
    .filter((record) => !registryKeys.has(`${record.registry_kind}:${record.adapter}`))
    .sort((left, right) => left.registry_kind.localeCompare(right.registry_kind) || left.adapter.localeCompare(right.adapter));

  const classifications = registry
    .map((record) => {
      const classified = table.get(`${record.registry_kind}:${record.adapter}`);
      return {
        ...record,
        domain: domainFor(record.adapter, record.registry_kind),
        classification: classified?.classification ?? "unclassified",
        follow_up_owner: classified?.follow_up_owner ?? null,
        follow_up_issue_id: classified?.follow_up_owner ? (FOLLOW_UP_ISSUES[classified.follow_up_owner] ?? null) : null,
        rationale: classified?.rationale ?? null,
        promotion_gate: classified?.promotion_gate ?? null
      };
    })
    .sort((left, right) => left.registry_kind.localeCompare(right.registry_kind) || left.adapter.localeCompare(right.adapter));

  const failures = [];
  if (methodRegistry.length === 0) failures.push("no WordPress-profile method adapters were found");
  if (scriptRegistry.length === 0) failures.push("no compiler script adapters were found");
  if (duplicateAssignments.length > 0) failures.push(`duplicate classifications: ${duplicateAssignments.join(", ")}`);
  if (unclassified.length > 0) {
    failures.push(`unclassified adapters: ${unclassified.map((record) => `${record.registry_kind}:${record.adapter}`).join(", ")}`);
  }
  if (staleClassifications.length > 0) {
    failures.push(
      `stale classifications: ${staleClassifications.map((record) => `${record.registry_kind}:${record.adapter}`).join(", ")}`
    );
  }
  for (const record of classifications) {
    if (!ALLOWED_CLASSIFICATIONS.has(record.classification)) {
      failures.push(`invalid classification for ${record.registry_kind}:${record.adapter}: ${record.classification}`);
    }
    if (!record.follow_up_owner) failures.push(`missing follow_up_owner for ${record.registry_kind}:${record.adapter}`);
    if (!record.follow_up_issue_id) failures.push(`missing follow_up_issue_id for ${record.registry_kind}:${record.adapter}`);
    if (!record.rationale) failures.push(`missing rationale for ${record.registry_kind}:${record.adapter}`);
    if (!record.promotion_gate) failures.push(`missing promotion_gate for ${record.registry_kind}:${record.adapter}`);
  }
  if (!classifications.some((record) => record.classification === "core_ir_candidate")) {
    failures.push("audit must identify at least one core_ir_candidate");
  }
  if (!classifications.some((record) => record.classification === "backend_promotion_pressure")) {
    failures.push("audit must identify at least one backend_promotion_pressure adapter");
  }
  if (!classifications.some((record) => record.registry_kind === "script_adapter" && record.classification === "temporary_bridge")) {
    failures.push("audit must identify temporary bridge script adapters");
  }

  const classificationCounts = countBy(classifications, "classification");
  const domainCounts = countBy(classifications, "domain");
  const ownerCounts = countBy(classifications, "follow_up_owner");
  const validationResult = {
    status: failures.length === 0 ? "passed" : "failed",
    failures,
    method_adapter_count: methodRegistry.length,
    script_adapter_count: scriptRegistry.length,
    classified_method_adapter_count: classifications.filter((record) => record.registry_kind === "method_adapter").length,
    classified_script_adapter_count: classifications.filter((record) => record.registry_kind === "script_adapter").length,
    unclassified_count: unclassified.length,
    stale_classification_count: staleClassifications.length,
    duplicate_assignment_count: duplicateAssignments.length,
    classification_counts: classificationCounts,
    domain_counts: domainCounts,
    owner_counts: ownerCounts,
    profile_accretion_gate_active: failures.length === 0
  };

  return {
    schema: "wphx.wphx-php-profile-core-promotion-audit.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "compiler_profile_core_promotion_audit",
    artifact_scope: "wphx_php_wordpress_profile_adapter_accretion_gate",
    review_basis: {
      oracle_response: ORACLE_RESPONSE,
      source_inputs: [fileRecord(COMPILER), fileRecord(WORDPRESS_PROFILE), fileRecord(ORACLE_RESPONSE)]
    },
    policy: {
      accepted_classifications: [...ALLOWED_CLASSIFICATIONS].sort(),
      rule: "Every current WordPress-profile method adapter and compiler script adapter must have an explicit classification, rationale, follow-up owner, and promotion gate before adoption CI can remain green.",
      oracle_condition:
        "Keep moving repeated generic constructs out of WphxPhpWordPressAdapters.hx and into reusable core IR; make profile growth trend-gated, not merely pass/fail gated."
    },
    summary: {
      method_adapter_count: methodRegistry.length,
      script_adapter_count: scriptRegistry.length,
      classified_adapter_count: classifications.length,
      core_ir_candidate_count: classifications.filter((record) => record.classification === "core_ir_candidate").length,
      profile_only_abi_constraint_count: classifications.filter((record) => record.classification === "profile_only_abi_constraint").length,
      temporary_bridge_count: classifications.filter((record) => record.classification === "temporary_bridge").length,
      backend_promotion_pressure_count: classifications.filter((record) => record.classification === "backend_promotion_pressure").length,
      unclassified_count: unclassified.length,
      stale_classification_count: staleClassifications.length
    },
    adapter_classifications: classifications,
    unclassified_adapters: unclassified,
    stale_classifications: staleClassifications,
    validation_result: validationResult,
    claims: [
      "All current WPHX PHP WordPress-profile method adapters and compiler script adapters are explicitly classified for profile/core promotion pressure.",
      "The audit is executable and fails when adapter registries drift without updating classification, rationale, owner, and promotion gate.",
      "The audit records which current adapters are profile-only ABI constraints, reusable core IR candidates, temporary bridges, or backend-promotion pressure."
    ],
    non_claims: [
      "This audit does not move any adapter out of the WordPress profile by itself.",
      "This audit does not claim WPHX PHP is a mature arbitrary-Haxe PHP backend.",
      "This audit does not claim stock Haxe PHP can be abandoned as private implementation emitter.",
      "This audit does not claim full class-wp-http.php, class-wp-embed.php, or class-wp-oembed.php ownership."
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

const manifest = buildAudit();
const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const receipt = {
  schema: "wphx.compiler-core-driver-receipt.v1",
  id: "receipt:wphx-comp-php-profile-core-promotion-audit",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  status: manifest.validation_result.status,
  evidence_class: "compiler_profile_core_promotion_audit",
  artifact_scope: "wphx_php_wordpress_profile_adapter_accretion_gate",
  commands: ["npm run wphx:php:profile-core-promotion-audit", "npm run wphx:php:profile-core-promotion-audit:check"],
  artifacts: [
    {
      path: RUNNER,
      role: "deterministic profile/core promotion audit runner"
    },
    {
      path: MANIFEST,
      role: "machine-readable adapter classification and promotion-gate manifest"
    },
    {
      path: "docs/operations/wphx-php-compiler.md",
      role: "compiler operations documentation updated with profile/core audit scope"
    },
    {
      path: "docs/operations/progress-matrix.md",
      role: "program rollup updated with the oracle amber-condition profile-accretion gate"
    }
  ],
  manifest_sha256: sha256(manifestText),
  validation_result: manifest.validation_result,
  claims: manifest.claims,
  non_claims: manifest.non_claims
};
const receiptText = JSON.stringify(receipt, null, 2) + "\n";

if (manifest.validation_result.status !== "passed") {
  console.error(JSON.stringify(manifest.validation_result, null, 2));
  process.exit(1);
}

writeOrCheck(MANIFEST, manifestText);
writeOrCheck(RECEIPT, receiptText);
console.log(
  JSON.stringify(
    {
      status: "passed",
      output: MANIFEST,
      receipt: RECEIPT,
      method_adapter_count: manifest.summary.method_adapter_count,
      script_adapter_count: manifest.summary.script_adapter_count,
      core_ir_candidate_count: manifest.summary.core_ir_candidate_count,
      backend_promotion_pressure_count: manifest.summary.backend_promotion_pressure_count
    },
    null,
    2
  )
);
