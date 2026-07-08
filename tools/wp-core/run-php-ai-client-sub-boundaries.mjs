#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.33.1",
  external_ref: "WPHX-323.23",
  title: "Classify php-ai-client sub-boundaries"
};
const RECORDED_AT = "2026-07-08T19:30:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-php-ai-client-sub-boundaries.mjs";
const UPSTREAM_LOCK = "upstream.lock.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const AI_TINYMCE_GATES = "manifests/wp-core/wphx-323-07-ai-client-tinymce-vendor-gates.v1.json";
const LICENSE_PROVENANCE = "manifests/license-provenance.v1.json";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const SOURCE_INVENTORY = "manifests/source-inventory.jsonl";
const OUT = "manifests/wp-core/wphx-323-23-php-ai-client-sub-boundaries.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-23-php-ai-client-sub-boundaries.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-23-php-ai-client-sub-boundaries.v1.json";

const PHP_AI_CLIENT_ROOT = "src/wp-includes/php-ai-client";
const EXPECTED_PHP_FILE_COUNT = 146;

const SUB_BOUNDARY_DEFINITIONS = [
  {
    id: "dto_schema_enum_core_contracts",
    title: "DTO, schema, enum, value, result, tool, and core contract shapes",
    classification: "candidate_for_later_bounded_haxe_subset_after_dto_schema_corpus_gate",
    next_gate_refs: ["WPHX-323.26"],
    ownership_requirement:
      "Roundtrip fixtures, constructor/default/type reflection, JSON/schema shape evidence, namespace/autoload checks, and generated Haxe or WPHX PHP output for the named subset."
  },
  {
    id: "provider_model_registry",
    title: "Provider, model, registry, provider metadata, and model requirement behavior",
    classification: "preserved_until_fake_provider_and_model_registry_gate",
    next_gate_refs: ["WPHX-323.27"],
    ownership_requirement:
      "Fake-provider fixtures for registration, metadata lookup, model support, operation routing, provider availability, model requirements, and exception classification."
  },
  {
    id: "transport_discovery_http",
    title: "Transport, discovery, HTTP DTO, request authentication, PSR HTTP, and stream behavior",
    classification: "preserved_until_fake_transport_and_discovery_gate",
    next_gate_refs: ["WPHX-312.05", "WPHX-323.27"],
    ownership_requirement:
      "Fake transport/discovery fixtures for headers, bodies, streams, request options, authentication insertion, response/error mapping, PSR-17/18 discovery, and exception behavior."
  },
  {
    id: "event_cache_contracts",
    title: "Event and cache contracts inside the bundled library",
    classification: "preserved_until_wordpress_wrapper_event_cache_gates_pass",
    next_gate_refs: ["WPHX-323.24", "WPHX-323.26"],
    ownership_requirement:
      "Wrapper event/cache fixtures plus library-level reflection evidence for dispatcher/cache contracts, event payload identity, cache key/value/TTL behavior, and trait/interface semantics."
  },
  {
    id: "shaded_third_party_dependencies",
    title: "Shaded WordPress\\AiClientDependencies third-party dependency tree",
    classification: "preserved_shaded_dependency_boundary",
    next_gate_refs: ["WPHX-323.27", "WPHX-323.30"],
    ownership_requirement:
      "Separate dependency-substitution decision, license/SBOM provenance, scoped namespace collision scan, API/reflection snapshots, behavior fixtures, and fallback policy before unscoping, replacing, or deduplicating."
  },
  {
    id: "autoload_bootstrap",
    title: "Autoload and bootstrap behavior",
    classification: "preserved_until_autoload_namespace_idempotency_fixture",
    next_gate_refs: ["WPHX-323.26"],
    ownership_requirement:
      "class_exists/interface_exists/trait_exists probes, idempotent include behavior, namespace-prefix mapping checks, include-order checks, and original path/hash evidence."
  },
  {
    id: "live_provider_behavior_boundary",
    title: "Client orchestration and live provider/model behavior boundary",
    classification: "explicit_non_claim_until_privacy_security_and_opt_in_provider_policy",
    next_gate_refs: ["WPHX-323.27", "WPHX-323.30"],
    ownership_requirement:
      "Privacy/security/provenance ADR, credential and prompt/file handling policy, opt-in provider cassette rules, fake-provider floors, live-network disabled-by-default runner policy, and installed WordPress AI gate scope."
  }
];

const SUB_BOUNDARY_IDS = SUB_BOUNDARY_DEFINITIONS.map((boundary) => boundary.id);

const NON_CLAIMS = [
  "This gate does not claim Haxe-owned wp-includes/php-ai-client/ runtime.",
  "This gate does not claim generated public PHP replacement for wp-includes/php-ai-client/.",
  "This gate does not claim generated WordPress AI wrapper adapter replacement; WPHX-323.24 and WPHX-323.25 own that path.",
  "This gate does not claim live provider behavior, external provider discovery parity, model generation parity, installed WordPress AI behavior, credential handling safety, prompt/file privacy, or plugin ecosystem compatibility.",
  "This gate does not claim third-party dependency substitution, unscoping, deduplication, Composer replacement, or copied artifact retirement for WordPress\\AiClientDependencies.",
  "This gate does not treat static symbol inventory as executable behavior parity; WPHX-323.26 and WPHX-323.27 own the first executable php-ai-client fixture gates.",
  "This gate does not admit hand-edited generated PHP or broad inline raw-block adapters as an implementation strategy."
];

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 80
  }).trim();
}

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

function sourceToDistribution(path) {
  return path.startsWith("src/") ? path.slice("src/".length) : path;
}

function listFiles(path) {
  const full = upstreamPath(path);
  const stat = statSync(full);
  if (stat.isFile()) return [path];
  return readdirSync(full, { withFileTypes: true })
    .flatMap((entry) => listFiles(`${path}/${entry.name}`))
    .sort();
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

function stripPhpComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1")
    .replace(/(^|\s)#.*$/gm, "$1");
}

function matchNames(text, regex) {
  return Array.from(text.matchAll(regex)).map((match) => match[1]);
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort();
}

function namespaceOf(cleanText) {
  return cleanText.match(/\bnamespace\s+([^;{]+)[;{]/)?.[1].trim() ?? null;
}

function firstLine(value) {
  return value.replace(/\s+/g, " ").trim();
}

function extractApiInventory(path) {
  const text = readFileSync(upstreamPath(path), "utf8");
  const cleanText = stripPhpComments(text);
  const namespace = namespaceOf(cleanText);
  const symbols = [];
  const classLikeRegex = /\b(?:(?:abstract|final|readonly)\s+)*(class|interface|trait|enum)\s+([A-Za-z_][A-Za-z0-9_]*)([^{;]*)\{/g;
  for (const match of cleanText.matchAll(classLikeRegex)) {
    const [, kind, name, tail] = match;
    const extendsMatch = tail.match(/\bextends\s+([^{]+?)(?:\s+implements\b|$)/);
    const implementsMatch = tail.match(/\bimplements\s+([^{]+)$/);
    symbols.push({
      kind,
      name,
      fqn: namespace ? `${namespace}\\${name}` : name,
      extends: extendsMatch ? firstLine(extendsMatch[1]) : null,
      implements: implementsMatch ? firstLine(implementsMatch[1]) : null
    });
  }

  const functionNames = matchNames(cleanText, /\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g);
  const publicMethodNames = matchNames(cleanText, /\bpublic\s+(?:static\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g);
  const constants = matchNames(cleanText, /\b(?:public|protected|private)?\s*const\s+([A-Za-z_][A-Za-z0-9_]*)/g);
  const properties = matchNames(cleanText, /\b(?:public|protected|private)\s+(?:static\s+)?(?:[?A-Za-z_\\][A-Za-z0-9_\\|?]*\s+)?\$([A-Za-z_][A-Za-z0-9_]*)/g);
  const uses = matchNames(cleanText, /\buse\s+([^;]+);/g).map(firstLine);

  return {
    namespace,
    symbols,
    declared_symbol_fqns: symbols.map((symbol) => symbol.fqn),
    uses,
    counts: {
      class_count: symbols.filter((symbol) => symbol.kind === "class").length,
      interface_count: symbols.filter((symbol) => symbol.kind === "interface").length,
      trait_count: symbols.filter((symbol) => symbol.kind === "trait").length,
      enum_keyword_count: symbols.filter((symbol) => symbol.kind === "enum").length,
      function_or_method_count: functionNames.length,
      public_function_or_method_count: publicMethodNames.length,
      constant_declaration_count: constants.length,
      property_declaration_count: properties.length,
      use_statement_count: uses.length
    },
    representative_members: {
      functions_or_methods: uniqueSorted(functionNames).slice(0, 20),
      public_functions_or_methods: uniqueSorted(publicMethodNames).slice(0, 20),
      constants: uniqueSorted(constants).slice(0, 20),
      properties: uniqueSorted(properties).slice(0, 20)
    },
    dependency_markers: {
      uses_wordpress_ai_client_namespace: /WordPress\\AiClient(?!Dependencies)(?:\\|;|\s|$)/.test(text),
      uses_shaded_dependency_namespace: text.includes("WordPress\\AiClientDependencies\\"),
      mentions_psr_http: /Psr\\Http|Psr\/Http/.test(text),
      mentions_psr_simple_cache: /Psr\\SimpleCache|SimpleCache/.test(text),
      mentions_event_dispatcher: /EventDispatcherInterface|BeforeGenerateResultEvent|AfterGenerateResultEvent/.test(text),
      mentions_provider_registry: /ProviderRegistry|ProviderInterface|ModelInterface/.test(text),
      mentions_json_schema: /JsonSchema|WithJsonSchema|toArray|jsonSerialize|fromArray/.test(text)
    }
  };
}

function primarySubBoundary(path) {
  if (path === `${PHP_AI_CLIENT_ROOT}/autoload.php`) return "autoload_bootstrap";
  if (path.includes("/third-party/")) return "shaded_third_party_dependencies";
  if (path === `${PHP_AI_CLIENT_ROOT}/src/AiClient.php` || path.includes("/src/Builders/")) {
    return "live_provider_behavior_boundary";
  }
  if (
    path.includes("/src/Events/") ||
    path.endsWith("/src/Common/Contracts/CachesDataInterface.php") ||
    path.endsWith("/src/Common/Traits/WithDataCachingTrait.php")
  ) {
    return "event_cache_contracts";
  }
  if (path.includes("/src/Providers/Http/")) return "transport_discovery_http";
  if (path.includes("/src/Providers/")) return "provider_model_registry";
  if (/\/src\/(Common|Files|Messages|Operations|Results|Tools)\//.test(path)) return "dto_schema_enum_core_contracts";
  return "unclassified";
}

function boundaryTags(path, api) {
  const tags = new Set([primarySubBoundary(path)]);
  const textMarkers = api.dependency_markers;
  if (path === `${PHP_AI_CLIENT_ROOT}/autoload.php`) tags.add("autoload_bootstrap");
  if (path.includes("/third-party/") || textMarkers.uses_shaded_dependency_namespace) tags.add("shaded_third_party_dependencies");
  if (
    path.includes("/Providers/Http/") ||
    path.includes("/third-party/Http/") ||
    path.includes("/third-party/Nyholm/") ||
    path.includes("/third-party/Psr/Http/") ||
    textMarkers.mentions_psr_http
  ) {
    tags.add("transport_discovery_http");
  }
  if (path.includes("/src/Providers/") || textMarkers.mentions_provider_registry) tags.add("provider_model_registry");
  if (
    path.includes("/src/Events/") ||
    path.includes("/third-party/Psr/EventDispatcher/") ||
    path.includes("/third-party/Psr/SimpleCache/") ||
    textMarkers.mentions_psr_simple_cache ||
    textMarkers.mentions_event_dispatcher ||
    path.endsWith("/src/Common/Contracts/CachesDataInterface.php") ||
    path.endsWith("/src/Common/Traits/WithDataCachingTrait.php")
  ) {
    tags.add("event_cache_contracts");
  }
  if (
    /\/src\/(Common|Files|Messages|Operations|Results|Tools)\//.test(path) ||
    /\/DTO\/|\/Enums\/|\/ValueObjects\//.test(path) ||
    textMarkers.mentions_json_schema
  ) {
    tags.add("dto_schema_enum_core_contracts");
  }
  if (
    path === `${PHP_AI_CLIENT_ROOT}/src/AiClient.php` ||
    path.includes("/src/Builders/") ||
    path.includes("/src/Providers/") ||
    /generate(Text|Image|Speech|Video)|ProviderAvailability|OpenAiCompatible/i.test(path)
  ) {
    tags.add("live_provider_behavior_boundary");
  }
  return SUB_BOUNDARY_IDS.filter((id) => tags.has(id));
}

function ownershipForBoundary(id) {
  switch (id) {
    case "dto_schema_enum_core_contracts":
      return "preserved_bundled_library_now_candidate_haxe_subset_after_wphx_323_26";
    case "provider_model_registry":
      return "preserved_bundled_library_now_fake_provider_gate_required";
    case "transport_discovery_http":
      return "preserved_bundled_library_now_fake_transport_gate_required";
    case "event_cache_contracts":
      return "preserved_bundled_library_now_wordpress_wrapper_gate_required";
    case "shaded_third_party_dependencies":
      return "preserved_shaded_dependency_no_substitution_claim";
    case "autoload_bootstrap":
      return "preserved_autoload_bootstrap_namespace_fixture_required";
    case "live_provider_behavior_boundary":
      return "explicit_non_claim_live_provider_orchestration";
    default:
      return "unclassified";
  }
}

function countBy(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function sumCounts(records, field) {
  return records.reduce((total, record) => total + record.api.counts[field], 0);
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
      task_external_ref: record.taskExternalRef,
      classified: record.classified,
      exceptions: record.exceptions ?? []
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
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
      haxe_owners: record.haxeOwners ?? [],
      generated_artifacts: record.generatedArtifacts ?? [],
      task_external_ref: record.taskExternalRef,
      classified: record.classified,
      exceptions: record.exceptions ?? []
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
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

function buildInventory(files) {
  return files.map((path, index) => {
    const api = extractApiInventory(path);
    const primary = primarySubBoundary(path);
    return {
      index: index + 1,
      source_path: path,
      distribution_path: sourceToDistribution(path),
      bytes: statSync(upstreamPath(path)).size,
      sha256: sha256File(upstreamPath(path)),
      primary_sub_boundary: primary,
      sub_boundary_tags: boundaryTags(path, api),
      ownership_state: ownershipForBoundary(primary),
      api
    };
  });
}

function subBoundaryRecords(inventory) {
  return SUB_BOUNDARY_DEFINITIONS.map((definition) => {
    const primary = inventory.filter((record) => record.primary_sub_boundary === definition.id);
    const tagged = inventory.filter((record) => record.sub_boundary_tags.includes(definition.id));
    const symbolFqns = uniqueSorted(tagged.flatMap((record) => record.api.declared_symbol_fqns));
    return {
      ...definition,
      primary_file_count: primary.length,
      tagged_file_count: tagged.length,
      primary_paths: primary.map((record) => record.source_path),
      tagged_sample_paths: tagged.map((record) => record.source_path).slice(0, 20),
      representative_declared_symbols: symbolFqns.slice(0, 30),
      current_ownership_state: ownershipForBoundary(definition.id),
      generated_or_haxe_ownership_allowed_now: false,
      preserved_exception_active: true
    };
  });
}

function validate({ files, inventory, sourceRows, artifactRows, vendorClosure, aiTinymceGates }) {
  const failures = [];
  const phpAiClientBoundary = vendorClosure.vendor_boundaries.find((boundary) => boundary.id === "php_ai_client");
  if (!phpAiClientBoundary) failures.push("WPHX-323 vendor closure is missing php_ai_client boundary");
  if (phpAiClientBoundary?.source_tree?.php_file_count !== EXPECTED_PHP_FILE_COUNT) {
    failures.push("WPHX-323 vendor closure php_ai_client count does not match 146 PHP files");
  }
  if (aiTinymceGates?.issue?.external_ref !== "WPHX-323.07") {
    failures.push("AI/TinyMCE gate manifest is not WPHX-323.07");
  }
  if (!aiTinymceGates?.source_surfaces?.php_ai_client?.sub_boundaries) {
    failures.push("WPHX-323.07 does not expose php-ai-client sub-boundary plan");
  }
  if (files.length !== EXPECTED_PHP_FILE_COUNT) failures.push(`Expected ${EXPECTED_PHP_FILE_COUNT} php-ai-client PHP files, found ${files.length}`);
  if (inventory.length !== EXPECTED_PHP_FILE_COUNT) failures.push("Inventory length does not match expected php-ai-client file count");
  if (sourceRows.length !== EXPECTED_PHP_FILE_COUNT) failures.push(`Expected ${EXPECTED_PHP_FILE_COUNT} source inventory records, found ${sourceRows.length}`);
  if (artifactRows.length !== EXPECTED_PHP_FILE_COUNT) {
    failures.push(`Expected ${EXPECTED_PHP_FILE_COUNT} artifact provenance records, found ${artifactRows.length}`);
  }

  const unclassified = inventory.filter((record) => record.primary_sub_boundary === "unclassified");
  if (unclassified.length) failures.push(`Unclassified files: ${unclassified.map((record) => record.source_path).join(", ")}`);

  const primaryTotal = SUB_BOUNDARY_IDS.reduce(
    (total, id) => total + inventory.filter((record) => record.primary_sub_boundary === id).length,
    0
  );
  if (primaryTotal !== EXPECTED_PHP_FILE_COUNT) failures.push(`Primary sub-boundary total ${primaryTotal} does not equal ${EXPECTED_PHP_FILE_COUNT}`);

  for (const id of SUB_BOUNDARY_IDS) {
    if (!inventory.some((record) => record.primary_sub_boundary === id || record.sub_boundary_tags.includes(id))) {
      failures.push(`No inventory coverage for sub-boundary ${id}`);
    }
  }

  if (!inventory.some((record) => record.api.dependency_markers.uses_shaded_dependency_namespace)) {
    failures.push("No files detected using WordPress\\AiClientDependencies");
  }
  if (!inventory.some((record) => record.api.dependency_markers.mentions_provider_registry)) {
    failures.push("No provider registry/model dependency markers detected");
  }
  if (!inventory.some((record) => record.api.dependency_markers.mentions_psr_http)) {
    failures.push("No PSR HTTP dependency markers detected");
  }

  if (failures.length) throw new Error(`WPHX-323.23 php-ai-client sub-boundary classification failed:\n- ${failures.join("\n- ")}`);
}

function main() {
  const upstreamLock = readJson(UPSTREAM_LOCK);
  const wordpressCheckout = currentWordPressCheckout(upstreamLock);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const aiTinymceGates = readJson(AI_TINYMCE_GATES);
  const licenseProvenance = readJson(LICENSE_PROVENANCE);
  const phpAiClientBoundary = vendorClosure.vendor_boundaries.find((boundary) => boundary.id === "php_ai_client");
  const files = listFiles(PHP_AI_CLIENT_ROOT).filter((path) => path.endsWith(".php"));
  const distributionPaths = files.map(sourceToDistribution);
  const inventory = buildInventory(files);
  const sourceRows = sourceInventoryRecords(files);
  const artifactRows = artifactRecords(distributionPaths);
  validate({ files, inventory, sourceRows, artifactRows, vendorClosure, aiTinymceGates });

  const primaryCounts = countBy(inventory.map((record) => record.primary_sub_boundary));
  const taggedCounts = Object.fromEntries(
    SUB_BOUNDARY_IDS.map((id) => [id, inventory.filter((record) => record.sub_boundary_tags.includes(id)).length])
  );
  const declaredSymbolFqns = uniqueSorted(inventory.flatMap((record) => record.api.declared_symbol_fqns));
  const shadedPrimary = inventory.filter((record) => record.primary_sub_boundary === "shaded_third_party_dependencies");
  const shadedTagged = inventory.filter((record) => record.sub_boundary_tags.includes("shaded_third_party_dependencies"));

  const validationResult = {
    status: "passed",
    php_ai_client_php_file_count: files.length,
    primary_sub_boundary_total: Object.values(primaryCounts).reduce((total, count) => total + count, 0),
    primary_sub_boundary_counts: primaryCounts,
    tagged_sub_boundary_counts: taggedCounts,
    source_inventory_record_count: sourceRows.length,
    artifact_provenance_record_count: artifactRows.length,
    declared_symbol_count: declaredSymbolFqns.length,
    static_class_count: sumCounts(inventory, "class_count"),
    static_interface_count: sumCounts(inventory, "interface_count"),
    static_trait_count: sumCounts(inventory, "trait_count"),
    static_enum_keyword_count: sumCounts(inventory, "enum_keyword_count"),
    generated_public_php_replacement_claimed: false,
    haxe_owned_php_ai_client_runtime_claimed: false,
    live_provider_behavior_claimed: false,
    dependency_substitution_claimed: false,
    executable_behavior_parity_claimed: false
  };

  const manifest = {
    schema: "wphx.wp-core.php-ai-client-sub-boundaries.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "php_ai_client_source_api_reflection_inventory_and_subboundary_classification",
    behavior_parity_claimed: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_php_ai_client_runtime_claimed: false,
    live_provider_behavior_claimed: false,
    dependency_substitution_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false,
    inputs: {
      runner: fileRecord(RUNNER),
      upstream_lock: fileRecord(UPSTREAM_LOCK),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      ai_tinymce_gate_manifest: fileRecord(AI_TINYMCE_GATES),
      license_provenance_manifest: fileRecord(LICENSE_PROVENANCE),
      artifact_provenance_manifest: fileRecord(ARTIFACT_PROVENANCE),
      source_inventory_manifest: fileRecord(SOURCE_INVENTORY)
    },
    upstream_authority: wordpressCheckout,
    boundary_source: {
      source_root: PHP_AI_CLIENT_ROOT,
      distribution_root: sourceToDistribution(PHP_AI_CLIENT_ROOT),
      vendor_closure_record: {
        id: phpAiClientBoundary.id,
        kind: phpAiClientBoundary.kind,
        closure_state: phpAiClientBoundary.closure_state,
        source_tree: phpAiClientBoundary.source_tree,
        distribution_artifacts: phpAiClientBoundary.distribution_artifacts,
        removal_gate: phpAiClientBoundary.removal_gate
      },
      wphx_323_07_refined_strategy:
        aiTinymceGates.strategy_refinement?.php_ai_client_wphx_323_07_refined_strategy ??
        "renewed_preserved_bundled_library_exception_with_subboundary_fixture_plan"
    },
    inventory_summary: {
      file_count: inventory.length,
      primary_sub_boundary_counts: primaryCounts,
      tagged_sub_boundary_counts: taggedCounts,
      declared_symbol_count: declaredSymbolFqns.length,
      declared_symbol_samples: declaredSymbolFqns.slice(0, 40),
      static_api_counts: {
        class_count: validationResult.static_class_count,
        interface_count: validationResult.static_interface_count,
        trait_count: validationResult.static_trait_count,
        enum_keyword_count: validationResult.static_enum_keyword_count,
        function_or_method_count: sumCounts(inventory, "function_or_method_count"),
        public_function_or_method_count: sumCounts(inventory, "public_function_or_method_count"),
        constant_declaration_count: sumCounts(inventory, "constant_declaration_count"),
        property_declaration_count: sumCounts(inventory, "property_declaration_count")
      },
      dependency_marker_counts: {
        files_using_wordpress_ai_client_namespace: inventory.filter((record) => record.api.dependency_markers.uses_wordpress_ai_client_namespace).length,
        files_using_shaded_dependency_namespace: inventory.filter((record) => record.api.dependency_markers.uses_shaded_dependency_namespace).length,
        files_mentioning_psr_http: inventory.filter((record) => record.api.dependency_markers.mentions_psr_http).length,
        files_mentioning_psr_simple_cache: inventory.filter((record) => record.api.dependency_markers.mentions_psr_simple_cache).length,
        files_mentioning_event_dispatcher: inventory.filter((record) => record.api.dependency_markers.mentions_event_dispatcher).length,
        files_mentioning_provider_registry: inventory.filter((record) => record.api.dependency_markers.mentions_provider_registry).length,
        files_mentioning_json_schema: inventory.filter((record) => record.api.dependency_markers.mentions_json_schema).length
      },
      static_inventory_note:
        "This is a static source/API symbol inventory for boundary classification. It is not an executable behavior parity fixture; WPHX-323.26 and WPHX-323.27 own executable reflection, DTO/schema, provider, and transport gates."
    },
    sub_boundaries: subBoundaryRecords(inventory),
    file_inventory: inventory,
    provenance: {
      license_manifest_schema: licenseProvenance.schema,
      php_ai_client_license_status:
        phpAiClientBoundary.license_provenance?.treatment ??
        "Preserve upstream file headers and WordPress project notice; run license/provenance review before generated replacement or distribution divergence.",
      package_notice_files_recorded: phpAiClientBoundary.license_provenance?.package_notice_files ?? [],
      notice_files_recorded_in_license_manifest: phpAiClientBoundary.license_provenance?.notice_files_recorded_in_license_manifest ?? [],
      source_inventory_status_counts: countBy(sourceRows.map((record) => record.status)),
      artifact_migration_status_counts: countBy(artifactRows.map((record) => record.migration_status)),
      artifact_records_sample: artifactRows.slice(0, 20),
      source_records_sample: sourceRows.slice(0, 20)
    },
    shaded_dependency_policy: {
      scoped_namespace: "WordPress\\AiClientDependencies",
      primary_file_count: shadedPrimary.length,
      tagged_file_count: shadedTagged.length,
      primary_paths: shadedPrimary.map((record) => record.source_path),
      package_families_from_paths: ["Http\\Discovery", "Nyholm\\Psr7", "Psr\\EventDispatcher", "Psr\\Http", "Psr\\SimpleCache"],
      current_policy:
        "Preserve the scoped dependency tree exactly as bundled. Do not unscope, deduplicate, substitute Composer packages, change PSR implementations, or claim dependency replacement from this gate.",
      divergence_requirements: [
        "License and SBOM provenance review for every substituted dependency family.",
        "Scoped namespace collision and plugin/ecosystem visibility scan.",
        "API/reflection snapshots for interfaces, classes, traits, constants, constructors, methods, parameter defaults, and thrown exception surfaces.",
        "Deterministic fake transport/discovery/cache/event behavior fixtures covering both success and failure paths.",
        "Fallback policy for hosts lacking expected native extensions or Composer packages.",
        "Accepted WPHX-323.30 privacy/security/provenance policy before live provider or credential-bearing tests."
      ]
    },
    generated_haxe_ownership_requirements: {
      broad_php_ai_client_replacement_allowed_now: false,
      bounded_subset_candidate_path:
        "Only a named subset may move toward Haxe ownership after its sub-boundary gate records reflection/API inventory, executable behavior fixtures, generated output provenance, PHP lint, autoload/original-path compatibility, and explicit unsupported=[] or blockers.",
      dto_schema_enum_subset_gate: "WPHX-323.26",
      provider_transport_gate: "WPHX-323.27",
      privacy_security_policy_gate: "WPHX-323.30",
      wordpress_wrapper_adapter_gate: "WPHX-323.24",
      first_generated_wrapper_adapter_gate: "WPHX-323.25",
      requirements: [
        "Non-empty generated overlay manifest when any public distribution path diverges.",
        "Generated PHP emitted from typed Haxe, Adapter IR, WPHX PHP, or generic compiler support rather than hand-edited target PHP.",
        "PHP lint and reflection snapshots for generated or replaced files.",
        "Original path include/load/autoload timing evidence.",
        "Oracle/candidate behavior fixtures for the exact sub-boundary.",
        "License/provenance and dependency-substitution review before any shaded dependency divergence.",
        "Explicit non-claims for live provider behavior unless WPHX-323.30 and opt-in provider evidence exist."
      ]
    },
    validation_result: validationResult,
    claims: [
      "WPHX-323.23 records a deterministic 146-file source/API/static-reflection inventory for wp-includes/php-ai-client/.",
      "Every php-ai-client PHP file now has one primary sub-boundary and additional cross-boundary tags where applicable.",
      "The manifest records license/provenance status, artifact/source inventory coverage, shaded dependency policy, and generated/Haxe ownership requirements.",
      "The gate keeps php-ai-client as a preserved bundled-library exception while routing bounded future evidence to WPHX-323.26, WPHX-323.27, and WPHX-323.30."
    ],
    non_claims: NON_CLAIMS
  };
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestContent);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-23-php-ai-client-sub-boundaries",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    ownership_state: "preserved_php_ai_client_bundled_library_with_static_subboundary_inventory",
    source_authority: "../wordpress-develop WordPress 7.0 wp-includes/php-ai-client/ source tree",
    emission_strategy: "classification_gate_only_no_generated_php_replacement",
    whole_file_owned: false,
    behavior_parity_claimed: false,
    durable_haxe_runtime_claimed: false,
    public_php_replacement_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false,
    generated_overlay_manifest_present: false,
    preserved_upstream_exception_active: true,
    primary_sub_boundary_counts: primaryCounts,
    removal_gate:
      "Do not claim Haxe-owned php-ai-client runtime, generated replacement, dependency substitution, or live provider behavior until the named sub-boundary gates record executable fixtures, generated output provenance, license/SBOM review, and accepted privacy/security policy where applicable.",
    receipt_refs: ["receipt:wphx-323-23-php-ai-client-sub-boundaries"],
    non_claims: NON_CLAIMS
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-23-php-ai-client-sub-boundaries",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: manifest.evidence_class,
    artifact_scope: "wordpress-7.0-php-ai-client-sub-boundary-classification",
    commands: [
      "npm run wp:core:wphx-323-php-ai-client-sub-boundaries",
      "npm run wp:core:wphx-323-php-ai-client-sub-boundaries:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      vendor_closure_manifest: VENDOR_CLOSURE,
      ai_tinymce_gate_manifest: AI_TINYMCE_GATES,
      license_provenance_manifest: LICENSE_PROVENANCE,
      source_inventory_manifest: SOURCE_INVENTORY,
      artifact_provenance_manifest: ARTIFACT_PROVENANCE
    },
    manifest_sha256: sha256(manifestContent),
    validation_result: validationResult,
    sub_boundary_counts: primaryCounts,
    decision: {
      php_ai_client_current_state: "preserved_bundled_library_exception",
      bounded_future_candidate: "dto_schema_enum_core_contracts_after_wphx_323_26",
      provider_transport_candidate: "fake_provider_transport_discovery_after_wphx_323_27",
      live_provider_behavior: "non_claim_until_wphx_323_30_policy_and_opt_in_evidence"
    },
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
        php_ai_client_php_file_count: manifest.validation_result.php_ai_client_php_file_count,
        primary_sub_boundary_counts: manifest.validation_result.primary_sub_boundary_counts,
        generated_public_php_replacement_claimed: manifest.generated_public_php_replacement_claimed,
        haxe_owned_php_ai_client_runtime_claimed: manifest.haxe_owned_php_ai_client_runtime_claimed,
        live_provider_behavior_claimed: manifest.live_provider_behavior_claimed,
        dependency_substitution_claimed: manifest.dependency_substitution_claimed
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
