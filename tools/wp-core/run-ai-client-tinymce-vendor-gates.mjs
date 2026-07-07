#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.33",
  external_ref: "WPHX-323.07",
  title: "Plan AI client and TinyMCE PHP loader vendor gates"
};
const RECORDED_AT = "2026-07-07T18:45:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-ai-client-tinymce-vendor-gates.mjs";
const BEADS_EXPORT = ".beads/issues.jsonl";
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const AI_HTTP_FIXTURE = "manifests/wp-core/wphx-312-05-ai-http-oracle-fixture.v1.json";
const LICENSE_PROVENANCE = "manifests/license-provenance.v1.json";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const SOURCE_INVENTORY = "manifests/source-inventory.jsonl";
const OUT = "manifests/wp-core/wphx-323-07-ai-client-tinymce-vendor-gates.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-07-ai-client-tinymce-vendor-gates.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-07-ai-client-tinymce-vendor-gates.v1.json";

const PHP_AI_CLIENT_ROOT = "src/wp-includes/php-ai-client";
const WORDPRESS_AI_WRAPPER_FILES = [
  "src/wp-includes/ai-client.php",
  "src/wp-includes/ai-client/adapters/class-wp-ai-client-cache.php",
  "src/wp-includes/ai-client/adapters/class-wp-ai-client-discovery-strategy.php",
  "src/wp-includes/ai-client/adapters/class-wp-ai-client-event-dispatcher.php",
  "src/wp-includes/ai-client/adapters/class-wp-ai-client-http-client.php",
  "src/wp-includes/ai-client/class-wp-ai-client-ability-function-resolver.php",
  "src/wp-includes/ai-client/class-wp-ai-client-prompt-builder.php"
];
const TINYMCE_LOADER_SOURCE = "src/js/_enqueues/vendor/tinymce/wp-tinymce.php";
const TINYMCE_LOADER_DISTRIBUTION = "wp-includes/js/tinymce/wp-tinymce.php";

const CHILD_REFS = [
  "WPHX-323.23",
  "WPHX-323.24",
  "WPHX-323.25",
  "WPHX-323.26",
  "WPHX-323.27",
  "WPHX-323.28",
  "WPHX-323.29",
  "WPHX-323.30"
];

const WRAPPER_ADAPTER_CANDIDATES = [
  {
    path: "wp-includes/ai-client.php",
    first_step: true,
    candidate_scope: ["wp_supports_ai", "wp_ai_client_prompt"],
    why_first: "small public WordPress function API surface that can be generated at the original path over preserved php-ai-client internals"
  },
  {
    path: "wp-includes/ai-client/adapters/class-wp-ai-client-event-dispatcher.php",
    first_step: true,
    candidate_scope: ["event class name to hook name conversion", "do_action payload identity", "returned event object"],
    why_first: "deterministic WordPress hook adapter behavior with high plugin visibility and low provider/network coupling"
  },
  {
    path: "wp-includes/ai-client/adapters/class-wp-ai-client-cache.php",
    first_step: true,
    candidate_scope: ["PSR-16 method shape", "WordPress object cache group behavior", "false/miss semantics", "TTL conversion"],
    why_first: "first-party WordPress cache adapter behavior is observable without live provider calls"
  },
  {
    path: "wp-includes/ai-client/adapters/class-wp-ai-client-http-client.php",
    first_step: false,
    candidate_scope: ["headers/body/error/response edge cases", "fake transport expansion of WPHX-312.05"],
    why_first: "important adapter bridge, but it should expand the existing AI HTTP fixture before generated replacement is claimed"
  },
  {
    path: "wp-includes/ai-client/class-wp-ai-client-prompt-builder.php",
    first_step: false,
    candidate_scope: ["dynamic __call", "WP_Error conversion", "support checks", "filters", "ability declarations"],
    why_first: "richer compatibility surface; fixture after simpler wrappers"
  },
  {
    path: "wp-includes/ai-client/class-wp-ai-client-ability-function-resolver.php",
    first_step: false,
    candidate_scope: ["ability-to-tool-call schema", "missing/error/success calls"],
    why_first: "valuable after tool/function-call schema fixtures exist"
  }
];

const REQUIRED_EVIDENCE = {
  generated_wordpress_ai_wrapper_replacement: [
    "WPHX PHP compiler/linker output at the original WordPress path",
    "non-empty generated overlay manifest with replaced upstream path/hash",
    "unsupported=[] or named unsupported items that block ownership",
    "php -l across emitted files",
    "ABI/reflection snapshots for functions, classes, methods, parameters, defaults, types, visibility, constants, interfaces, and traits where relevant",
    "include/load timing fixture for original path, ABSPATH/WPINC assumptions, idempotent include behavior, and dependency availability",
    "oracle/candidate behavior fixtures for filters/actions, WP_Error conversion, cache behavior, HTTP adapter behavior, and dynamic calls where relevant",
    "explicit non-claims for preserved php-ai-client internals and live provider behavior"
  ],
  haxe_owned_php_ai_client_subset: [
    "sub-boundary ADR or manifest identifying the exact subset",
    "reflection/API inventory for the subset",
    "DTO/schema roundtrip fixtures where applicable",
    "public method, constructor, default, and type fixtures",
    "autoload/namespace/class-exists behavior fixture",
    "fake transport/provider tests if provider-facing code is included",
    "PHP version matrix for WordPress-supported PHP baselines",
    "license/provenance review and plugin/ecosystem visibility scan",
    "generated PHP emitted from typed Haxe, Adapter IR, or compiler output rather than hand-edited PHP"
  ],
  tinymce_loader_replacement: [
    "direct script execution fixture",
    "exact output behavior for c=1 with wp-tinymce.js, no c, c=1 when wp-tinymce.js is missing, and missing fallback files",
    "header fixture for Content-Type, Vary: Accept-Encoding, Expires, and Cache-Control",
    "cache max-age and expiry calculation tolerance",
    "distribution path fixture for wp-includes/js/tinymce/wp-tinymce.php",
    "asset path/hash inventory for wp-tinymce.js, tinymce.min.js, and plugins/compat3x/plugin.min.js",
    "browser-vendor coordination with WPHX-609",
    "explicit non-claim of TinyMCE JS/CSS/editor behavior",
    "generated direct-script adapter evidence if replacing, not hand-edited PHP"
  ]
};

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .trimEnd()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
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

function sourceToDistribution(path) {
  if (path.startsWith("src/")) return path.slice("src/".length);
  return path;
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

function sourceInventoryRecords(sourcePaths) {
  const wanted = new Set(sourcePaths);
  return readJsonl(SOURCE_INVENTORY)
    .filter((record) => wanted.has(record.path))
    .map((record) => ({
      path: record.path,
      kind: record.kind,
      status: record.status,
      owner: record.owner,
      notes: record.notes
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function countMatches(text, regex) {
  return Array.from(text.matchAll(regex)).length;
}

function phpSurfaceSummary(paths) {
  const summary = {
    php_file_count: paths.length,
    namespace_count: 0,
    class_count: 0,
    interface_count: 0,
    trait_count: 0,
    enum_keyword_count: 0,
    function_count: 0,
    files_with_ai_client_dependency_namespace: 0,
    files_with_wordpress_ai_client_namespace: 0
  };
  for (const path of paths) {
    const text = readFileSync(upstreamPath(path), "utf8");
    summary.namespace_count += countMatches(text, /\bnamespace\s+[^;{]+/g);
    summary.class_count += countMatches(text, /\b(?:abstract\s+|final\s+)?class\s+[A-Za-z_][A-Za-z0-9_]*/g);
    summary.interface_count += countMatches(text, /\binterface\s+[A-Za-z_][A-Za-z0-9_]*/g);
    summary.trait_count += countMatches(text, /\btrait\s+[A-Za-z_][A-Za-z0-9_]*/g);
    summary.enum_keyword_count += countMatches(text, /\benum\s+[A-Za-z_][A-Za-z0-9_]*/g);
    summary.function_count += countMatches(text, /\bfunction\s+[A-Za-z_][A-Za-z0-9_]*\s*\(/g);
    if (text.includes("WordPress\\AiClientDependencies")) summary.files_with_ai_client_dependency_namespace += 1;
    if (text.includes("WordPress\\AiClient")) summary.files_with_wordpress_ai_client_namespace += 1;
  }
  return summary;
}

function subset(paths, predicate) {
  return paths.filter((path) => {
    const text = readFileSync(upstreamPath(path), "utf8");
    return predicate(path, text);
  });
}

function subBoundary(id, title, classification, paths, removalGate) {
  return {
    id,
    title,
    classification,
    php_file_count: paths.length,
    sample_paths: paths.slice(0, 10),
    near_term_decision: classification.startsWith("candidate")
      ? "fixture_first_then_bounded_generated_or_haxe_subset_candidate"
      : "preserve_until_specific_evidence_gate_passes",
    removal_gate: removalGate
  };
}

function childIssues() {
  const allIssues = readJsonl(BEADS_EXPORT).filter((issue) => issue._type === "issue");
  const byId = new Map(allIssues.map((issue) => [issue.id, issue]));
  const byRef = new Map(allIssues.map((issue) => [issue.external_ref, issue]));
  const children = CHILD_REFS.map((externalRef) => {
    const issue = byRef.get(externalRef);
    if (!issue) throw new Error(`Missing Beads child issue for ${externalRef}`);
    return {
      issue_id: issue.id,
      external_ref: issue.external_ref,
      title: issue.title,
      status: issue.status,
      priority: issue.priority,
      dependency_refs: (issue.dependencies ?? [])
        .map((dependency) => byId.get(dependency.depends_on_id)?.external_ref ?? dependency.depends_on_id)
        .filter((ref) => ref !== ISSUE.external_ref)
        .sort(),
      acceptance_criteria: issue.acceptance_criteria
    };
  });
  return children;
}

function main() {
  const strategy = readJson(STRATEGY);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const aiHttpFixture = readJson(AI_HTTP_FIXTURE);
  const licenseProvenance = readJson(LICENSE_PROVENANCE);
  const phpAiClientBoundary = vendorClosure.vendor_boundaries.find((boundary) => boundary.id === "php_ai_client");
  const tinymceBoundary = vendorClosure.vendor_boundaries.find((boundary) => boundary.id === "tinymce_php_loader");
  const originalPhpAiClientStrategy = strategy.boundary_replacement_plan.find((boundary) => boundary.id === "php_ai_client");
  const tinymceStrategy = strategy.boundary_replacement_plan.find((boundary) => boundary.id === "tinymce_php_loader");
  if (!phpAiClientBoundary || !tinymceBoundary || !originalPhpAiClientStrategy || !tinymceStrategy) {
    throw new Error("Required php_ai_client/tinymce_php_loader boundary records are missing");
  }

  const phpAiClientFiles = listFiles(PHP_AI_CLIENT_ROOT).filter((path) => path.endsWith(".php"));
  const wrapperFiles = WORDPRESS_AI_WRAPPER_FILES.filter((path) => path.endsWith(".php"));
  const wrapperDistributionPaths = wrapperFiles.map(sourceToDistribution);
  const phpAiClientDistributionPaths = phpAiClientFiles.map(sourceToDistribution);
  const tinymceDistributionPaths = [TINYMCE_LOADER_DISTRIBUTION];
  const allDistributionPaths = [...phpAiClientDistributionPaths, ...wrapperDistributionPaths, ...tinymceDistributionPaths];
  const artifactRows = artifactRecords(allDistributionPaths);
  const sourceRows = sourceInventoryRecords([...phpAiClientFiles, ...wrapperFiles, TINYMCE_LOADER_SOURCE]);
  const childIssueRows = childIssues();

  if (phpAiClientFiles.length !== 146) throw new Error(`Expected 146 php-ai-client PHP files, found ${phpAiClientFiles.length}`);
  for (const path of wrapperFiles) {
    if (!existsSync(upstreamPath(path))) throw new Error(`Missing WordPress AI wrapper source file ${path}`);
  }
  if (!existsSync(upstreamPath(TINYMCE_LOADER_SOURCE))) throw new Error(`Missing TinyMCE loader source ${TINYMCE_LOADER_SOURCE}`);
  if (childIssueRows.length !== CHILD_REFS.length) throw new Error("Unexpected child issue count");

  const shadedDependencyPaths = subset(phpAiClientFiles, (path, text) => path.includes("/third-party/") || text.includes("WordPress\\AiClientDependencies"));
  const dtoSchemaPaths = subset(
    phpAiClientFiles,
    (path) =>
      /\/(Common|Enums|Messages|Results|Schemas|Tools|Value|Files|Attachments)\//.test(path) ||
      /(AbstractDataTransferObject|AbstractEnum|WithJsonSchema)/.test(path)
  );
  const providerPaths = subset(phpAiClientFiles, (path) => /\/Providers\//.test(path));
  const transportPaths = subset(
    phpAiClientFiles,
    (path, text) =>
      /\/(Http|Transport|Discovery|Psr|Nyholm)\//.test(path) ||
      path.includes("/third-party/") && /\/(?:Psr|Nyholm|Http)/.test(path) ||
      /\bRequestInterface\b|\bClientInterface\b|\bStreamInterface\b/.test(text)
  );
  const eventCachePaths = subset(
    phpAiClientFiles,
    (path, text) => /\/Events\//.test(path) || /\bCachesData\b|\bCacheInterface\b|\bSimpleCache\b/.test(text)
  );
  const autoloadPaths = subset(phpAiClientFiles, (path) => path.endsWith("/autoload.php"));
  const liveProviderPaths = subset(phpAiClientFiles, (path, text) => /\/Providers\//.test(path) && /\b(?:OpenAI|Gemini|Anthropic|Provider)\b/i.test(text));

  const tinymceLoaderText = readFileSync(upstreamPath(TINYMCE_LOADER_SOURCE), "utf8");
  const tinymceAssetCandidates = [
    "src/js/_enqueues/vendor/tinymce/wp-tinymce.js",
    "src/js/_enqueues/vendor/tinymce/tinymce.min.js",
    "src/js/_enqueues/vendor/tinymce/plugins/compat3x/plugin.min.js"
  ].map((path) => ({
    path,
    exists_in_wordpress_develop: existsSync(upstreamPath(path)),
    sha256: existsSync(upstreamPath(path)) ? sha256File(upstreamPath(path)) : null
  }));

  const validationResult = {
    status: "passed",
    php_ai_client_php_file_count: phpAiClientFiles.length,
    wordpress_ai_wrapper_file_count: wrapperFiles.length,
    tinymce_loader_file_count: 1,
    source_inventory_record_count: sourceRows.length,
    artifact_provenance_record_count: artifactRows.length,
    child_issue_count: childIssueRows.length,
    all_child_issues_open: childIssueRows.every((issue) => issue.status === "open"),
    wphx_312_05_ai_http_fixture_present:
      aiHttpFixture.issue === "WPHX-312.05" || aiHttpFixture.issue?.external_ref === "WPHX-312.05",
    php_ai_client_preserved_exception_renewed: true,
    wordpress_ai_wrapper_generated_adapter_path_chosen_first: true,
    tinymce_loader_preserved_exception_renewed: true,
    generated_overlay_manifest_present: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_php_ai_client_runtime_claimed: false,
    tinymce_browser_runtime_claimed: false,
    live_provider_behavior_claimed: false
  };

  const manifest = {
    schema: "wphx.wp-core.ai-client-tinymce-vendor-gates.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "ai_client_tinymce_boundary_classification_and_future_gate_plan",
    behavior_parity_claimed: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_php_ai_client_runtime_claimed: false,
    live_provider_behavior_claimed: false,
    tinymce_browser_runtime_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false,
    inputs: {
      runner: fileRecord(RUNNER),
      beads_export: fileRecord(BEADS_EXPORT),
      vendor_strategy_manifest: fileRecord(STRATEGY),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      ai_http_fixture_manifest: fileRecord(AI_HTTP_FIXTURE),
      license_provenance_manifest: fileRecord(LICENSE_PROVENANCE),
      artifact_provenance_manifest: fileRecord(ARTIFACT_PROVENANCE),
      source_inventory_manifest: fileRecord(SOURCE_INVENTORY)
    },
    oracle_review: {
      reviewer: "GPT 5.5 Pro web, referred to by this project as the oracle",
      integrated_at: RECORDED_AT,
      verdict:
        "The whole-port architecture is sound only if copied upstream, bridge routers, preserved vendor boundaries, generated adapters, and Haxe-owned runtime claims remain separate evidence lanes.",
      integrated_decisions: [
        "wp-includes/php-ai-client/ remains a preserved bundled-library dependency now, with sub-boundaries and fixtures required before any bounded subset port.",
        "wp-includes/ai-client.php and wp-includes/ai-client/* are WordPress API/adapter surfaces, not vendor internals; generated WPHX PHP original-path adapters should move first over preserved php-ai-client internals.",
        "TinyMCE wp-tinymce.php remains a preserved browser-vendor PHP loader until direct loader fixtures and browser asset coordination pass.",
        "WPHX-323.07 is split into child gates instead of closing as a broad direct php-ai-client or TinyMCE loader port."
      ]
    },
    strategy_refinement: {
      php_ai_client_previous_strategy: {
        source_manifest: STRATEGY,
        replacement_strategy: originalPhpAiClientStrategy.replacement_strategy,
        rationale: originalPhpAiClientStrategy.rationale
      },
      php_ai_client_wphx_323_07_refined_strategy:
        "renewed_preserved_bundled_library_exception_with_subboundary_fixture_plan; direct Haxe port is allowed only for named pure subsets after reflection/schema/autoload/provider evidence",
      wordpress_ai_wrappers_strategy:
        "generated_wphx_php_original_path_adapter_candidates_first_over_preserved_php_ai_client_internals",
      tinymce_loader_strategy: tinymceStrategy.replacement_strategy,
      fixture_to_generated_candidate_rule:
        "Every new first-party WordPress wrapper fixture must declare whether it is oracle-only, candidate-Haxe-only, generated adapter candidate, or ownership gate."
    },
    source_surfaces: {
      php_ai_client: {
        boundary_record: {
          id: phpAiClientBoundary.id,
          kind: phpAiClientBoundary.kind,
          source_path: phpAiClientBoundary.source_path,
          distribution_path: phpAiClientBoundary.distribution_path,
          closure_state: phpAiClientBoundary.closure_state,
          source_tree: phpAiClientBoundary.source_tree,
          distribution_artifacts: phpAiClientBoundary.distribution_artifacts,
          license_provenance: phpAiClientBoundary.license_provenance,
          removal_gate: phpAiClientBoundary.removal_gate
        },
        near_term_decision: "renew_preserved_bundled_library_exception_and_subdivide_before_porting",
        surface_summary: phpSurfaceSummary(phpAiClientFiles),
        sub_boundaries: [
          subBoundary(
            "dto_enum_schema_candidates",
            "DTO, enum, message, result, file, tool, and schema shapes",
            "candidate_for_later_bounded_haxe_port_after_roundtrip_reflection_fixtures",
            dtoSchemaPaths,
            "Do not claim any Haxe-owned subset until reflection/API and DTO/schema roundtrip fixtures name the subset and generated output proves it."
          ),
          subBoundary(
            "provider_model_registry",
            "Provider, model, and registry behavior",
            "preserved_until_fake_provider_and_model_support_fixtures_exist",
            providerPaths,
            "Do not replace provider behavior until fake-provider fixtures cover registration, model support, generation request shape, and error classification."
          ),
          subBoundary(
            "transport_discovery_http",
            "Transport, discovery, PSR HTTP, stream, and request/response surfaces",
            "preserved_until_fake_transport_and_discovery_fixtures_exist",
            transportPaths,
            "Do not replace transport/discovery surfaces until deterministic fake transport evidence covers headers, body streams, options, exceptions, and discovery."
          ),
          subBoundary(
            "event_cache_contracts",
            "Event and cache contracts inside the bundled library",
            "preserved_until_wrapper_event_cache_gates_pass",
            eventCachePaths,
            "Move WordPress wrapper adapters first; do not replace library internals until event/cache contracts have reflection and behavior evidence."
          ),
          subBoundary(
            "shaded_third_party_dependencies",
            "Shaded WordPress\\AiClientDependencies third-party code",
            "preserved_dependency_boundary_unless_separately_justified",
            shadedDependencyPaths,
            "Do not substitute shaded dependencies without separate dependency classification, license/provenance, reflection, and behavior receipts."
          ),
          subBoundary(
            "autoload_bootstrap",
            "php-ai-client autoload/bootstrap behavior",
            "preserved_until_namespace_class_exists_and_idempotent_include_fixtures_exist",
            autoloadPaths,
            "Do not claim namespace/autoload parity until class_exists/interface_exists/trait_exists and idempotent include behavior are recorded."
          ),
          subBoundary(
            "live_provider_behavior",
            "Live provider/network/model behavior",
            "explicit_non_claim_until_privacy_security_and_opt_in_provider_policy_exists",
            liveProviderPaths,
            "Do not run or claim live provider behavior until AI privacy/security/provenance policy and opt-in cassette rules exist."
          )
        ]
      },
      wordpress_ai_wrappers: {
        classification: "wordpress_public_api_and_adapter_surface_not_vendor_internals",
        near_term_decision: "move_first_to_generated_wphx_php_original_path_adapter_candidates_over_preserved_internals",
        source_files: wrapperFiles.map((path) => ({
          source_path: path,
          distribution_path: sourceToDistribution(path),
          source_sha256: sha256File(upstreamPath(path))
        })),
        surface_summary: phpSurfaceSummary(wrapperFiles),
        generated_adapter_candidates: WRAPPER_ADAPTER_CANDIDATES,
        minimized_fixture_requirements: {
          wp_supports_ai: [
            "WP_AI_SUPPORT defined false returns false",
            "constant absent applies wp_supports_ai filter",
            "truthy/falsy filter returns are boolean-cast",
            "multiple filters preserve WordPress filter ordering"
          ],
          wp_ai_client_prompt: [
            "no prompt returns WP_AI_Client_Prompt_Builder",
            "string and supported array/message prompt shapes are preserved",
            "AI disabled behavior is delegated rather than guessed",
            "class identity and constructor side effects match upstream"
          ],
          event_dispatcher: [
            "event class name converts to the expected wp_ai_client_* hook",
            "same event object is passed and returned",
            "hook observer mutation remains visible where upstream allows it",
            "namespace stripping matches upstream"
          ],
          cache: [
            "miss with default",
            "cached false/null/zero distinguished from miss",
            "null, int, and DateInterval TTL behavior",
            "multiple get/set/delete ordering and return shape",
            "invalid iterable/key behavior"
          ],
          http_client_expansion: [
            "duplicate headers, casing, and numeric values",
            "empty, string, and stream body",
            "timeout, redirect, and header/body option merge",
            "WP_Error to NetworkException mapping",
            "status, reason phrase, headers, and body stream response behavior"
          ]
        }
      },
      tinymce_php_loader: {
        boundary_record: {
          id: tinymceBoundary.id,
          kind: tinymceBoundary.kind,
          source_path: tinymceBoundary.source_path,
          distribution_path: tinymceBoundary.distribution_path,
          closure_state: tinymceBoundary.closure_state,
          source_tree: tinymceBoundary.source_tree,
          distribution_artifacts: tinymceBoundary.distribution_artifacts,
          license_provenance: tinymceBoundary.license_provenance,
          removal_gate: tinymceBoundary.removal_gate
        },
        classification: "browser_vendor_php_loader",
        near_term_decision: "renew_preserved_browser_vendor_php_loader_exception_with_direct_loader_fixture",
        source_file: {
          source_path: TINYMCE_LOADER_SOURCE,
          distribution_path: TINYMCE_LOADER_DISTRIBUTION,
          source_sha256: sha256File(upstreamPath(TINYMCE_LOADER_SOURCE)),
          references_dirname: tinymceLoaderText.includes("__DIR__"),
          emits_javascript_content_type: tinymceLoaderText.includes("Content-Type: application/javascript"),
          sends_cache_headers: tinymceLoaderText.includes("Cache-Control") && tinymceLoaderText.includes("Expires")
        },
        asset_candidates: tinymceAssetCandidates,
        minimized_fixture_requirements: [
          "c=1 and wp-tinymce.js exists emits only wp-tinymce.js contents",
          "no c emits tinymce.min.js plus plugins/compat3x/plugin.min.js",
          "c=1 with wp-tinymce.js missing falls back to concatenated loader behavior",
          "missing fallback files suppress warning leakage",
          "headers match Content-Type, Vary, Expires, and Cache-Control behavior",
          "uses __DIR__ rather than current working directory",
          "exits without trailing framework output",
          "source and distribution paths are both covered"
        ]
      }
    },
    child_work: childIssueRows,
    required_evidence_before_stronger_claims: REQUIRED_EVIDENCE,
    artifact_provenance_records: {
      count: artifactRows.length,
      sample: artifactRows.slice(0, 20)
    },
    source_inventory_records: {
      count: sourceRows.length,
      sample: sourceRows.slice(0, 20)
    },
    progress_reporting_policy: [
      "Keep provenance/exception closure separate from generated public adapter coverage.",
      "Keep generated public adapter coverage separate from Haxe-authored runtime ownership.",
      "Keep Haxe-authored runtime ownership separate from installed WordPress behavior and browser/Gutenberg parity.",
      "Do not use preserved vendor closure as runtime implementation progress."
    ],
    validation_result: validationResult,
    claims: [
      "WPHX-323.07 integrates oracle review into a boundary strategy for php-ai-client, WordPress AI wrappers, and the TinyMCE PHP loader.",
      "php-ai-client internals remain a preserved bundled-library dependency with sub-boundary fixtures required before any bounded Haxe-owned subset claim.",
      "WordPress AI wrapper files are classified as WordPress API/adapter surfaces and routed toward generated WPHX PHP original-path adapter evidence first.",
      "TinyMCE wp-tinymce.php remains a preserved browser-vendor PHP loader pending direct loader fixtures and browser asset coordination.",
      "Eight Beads child issues WPHX-323.23 through WPHX-323.30 record the execution split."
    ],
    non_claims: [
      "This gate does not claim Haxe-owned wp-includes/php-ai-client/ runtime.",
      "This gate does not claim generated public PHP replacement for php-ai-client, WordPress AI wrappers, or the TinyMCE PHP loader.",
      "This gate does not claim live provider behavior, external provider discovery parity, model generation parity, installed WordPress AI behavior, or plugin ecosystem compatibility.",
      "This gate does not claim third-party dependency substitution for WordPress\\AiClientDependencies or any shaded dependency.",
      "This gate does not claim TinyMCE JavaScript, CSS, font, browser-editor, Gutenberg, or browser package ownership.",
      "This gate does not retire copied or preserved upstream artifacts.",
      "This gate does not admit hand-edited generated PHP as an implementation strategy."
    ]
  };
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestContent);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-07-ai-client-tinymce-vendor-gates",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    ownership_state: "preserved_ai_client_library_and_tinymce_loader_with_generated_wordpress_wrapper_adapter_plan",
    source_authority: "../wordpress-develop WordPress 7.0 php-ai-client, WordPress AI wrappers, and TinyMCE loader source paths",
    emission_strategy: "planning_gate_over_preserved_upstream_artifacts_and_future_wphx_php_original_path_adapters",
    whole_file_owned: false,
    behavior_parity_claimed: false,
    durable_haxe_runtime_claimed: false,
    public_php_replacement_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false,
    generated_overlay_manifest_present: false,
    preserved_upstream_exceptions_renewed: true,
    wrapper_generated_adapter_candidates_declared: true,
    removal_gate:
      "Do not claim generated replacement or Haxe-owned runtime for these boundaries until the relevant child gate records non-empty generated overlay manifests, ABI/reflection/load behavior, deterministic fake-provider/transport fixtures, license/provenance review, and browser asset coordination where applicable.",
    receipt_refs: ["receipt:wphx-323-07-ai-client-tinymce-vendor-gates"],
    non_claims: manifest.non_claims
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-07-ai-client-tinymce-vendor-gates",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: manifest.evidence_class,
    artifact_scope: "wordpress-7.0-ai-client-tinymce-boundary-classification-and-future-gate-plan",
    commands: [
      "npm run wp:core:wphx-323-ai-client-tinymce-vendor-gates",
      "npm run wp:core:wphx-323-ai-client-tinymce-vendor-gates:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      vendor_strategy_manifest: STRATEGY,
      vendor_closure_manifest: VENDOR_CLOSURE,
      ai_http_fixture_manifest: AI_HTTP_FIXTURE,
      license_provenance_manifest: LICENSE_PROVENANCE,
      beads_export: BEADS_EXPORT
    },
    manifest_sha256: sha256(manifestContent),
    validation_result: validationResult,
    decision: {
      php_ai_client: manifest.source_surfaces.php_ai_client.near_term_decision,
      wordpress_ai_wrappers: manifest.source_surfaces.wordpress_ai_wrappers.near_term_decision,
      tinymce_php_loader: manifest.source_surfaces.tinymce_php_loader.near_term_decision
    },
    child_work: childIssueRows.map(({ issue_id, external_ref, title, status, dependency_refs }) => ({
      issue_id,
      external_ref,
      title,
      status,
      dependency_refs
    })),
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
        php_ai_client_decision: manifest.source_surfaces.php_ai_client.near_term_decision,
        wordpress_ai_wrapper_decision: manifest.source_surfaces.wordpress_ai_wrappers.near_term_decision,
        tinymce_loader_decision: manifest.source_surfaces.tinymce_php_loader.near_term_decision,
        child_issue_count: manifest.validation_result.child_issue_count,
        generated_public_php_replacement_claimed: manifest.generated_public_php_replacement_claimed
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
