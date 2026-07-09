#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.32",
  external_ref: "WPHX-323.06",
  title: "Plan localization and legacy data vendor gates"
};
const RECORDED_AT = "2026-07-09T03:30:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-localization-legacy-vendor-replacement-gates.mjs";
const UPSTREAM_LOCK = "upstream.lock.json";
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const LICENSE_PROVENANCE = "manifests/license-provenance.v1.json";
const SOURCE_INVENTORY = "manifests/source-inventory.jsonl";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const BEADS_EXPORT = ".beads/issues.jsonl";
const OUT = "manifests/wp-core/wphx-323-06-localization-legacy-vendor-replacement-gates.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-06-localization-legacy-vendor-replacement-gates.v1.json";

const BOUNDARIES = {
  pomo: {
    id: "pomo",
    source_root: "src/wp-includes/pomo",
    expected_php_count: 6,
    replacement_strategy: "direct_haxe_port_preserving_vendor_api",
    direct_haxe_port_candidate: true,
    host_primitive_backed_candidate: false,
    followup_key: "pomo_localization_corpus"
  },
  php_compat: {
    id: "php_compat",
    source_root: "src/wp-includes/php-compat",
    expected_php_count: 1,
    replacement_strategy: "host_primitive_backed_reimplementation_with_preserved_fallback",
    direct_haxe_port_candidate: false,
    host_primitive_backed_candidate: true,
    followup_key: "php_compat_readonly_shim"
  },
  text_diff: {
    id: "text_diff",
    source_root: "src/wp-includes/Text",
    expected_php_count: 8,
    replacement_strategy: "direct_haxe_port_preserving_vendor_api",
    direct_haxe_port_candidate: true,
    host_primitive_backed_candidate: false,
    followup_key: "text_diff_api_renderer_corpus"
  },
  services_json: {
    id: "services_json",
    source_file: "src/wp-includes/class-json.php",
    expected_php_count: 1,
    replacement_strategy: "host_primitive_backed_reimplementation_with_preserved_fallback",
    direct_haxe_port_candidate: false,
    host_primitive_backed_candidate: true,
    followup_key: "services_json_legacy_compatibility"
  },
  ixr: {
    id: "ixr",
    source_root: "src/wp-includes/IXR",
    expected_php_count: 10,
    replacement_strategy: "direct_haxe_port_preserving_vendor_api",
    direct_haxe_port_candidate: true,
    host_primitive_backed_candidate: false,
    followup_key: "ixr_xmlrpc_value_message_corpus"
  }
};

const DOWNSTREAM_ISSUES = {
  pomo_localization_corpus: {
    issue_id: "wordpresshx-l76.32.1",
    external_ref: "WPHX-323.31",
    title: "Add POMO localization corpus gate"
  },
  php_compat_readonly_shim: {
    issue_id: "wordpresshx-l76.32.2",
    external_ref: "WPHX-323.32",
    title: "Add php-compat readonly shim gate"
  },
  text_diff_api_renderer_corpus: {
    issue_id: "wordpresshx-l76.32.3",
    external_ref: "WPHX-323.33",
    title: "Add Text_Diff API renderer corpus gate"
  },
  services_json_legacy_compatibility: {
    issue_id: "wordpresshx-l76.32.4",
    external_ref: "WPHX-323.34",
    title: "Add Services_JSON legacy compatibility gate"
  },
  ixr_xmlrpc_value_message_corpus: {
    issue_id: "wordpresshx-l76.32.5",
    external_ref: "WPHX-323.35",
    title: "Add IXR XML-RPC value message corpus gate"
  },
  provenance_decision: {
    issue_id: "wordpresshx-l76.32.6",
    external_ref: "WPHX-323.36",
    title: "Add localization legacy vendor provenance decision gate"
  }
};

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

function readJsonl(path) {
  const content = readFileSync(path, "utf8").trim();
  if (!content) return [];
  return content.split("\n").map((line) => JSON.parse(line));
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

function boundaryPhpFiles(boundaryId) {
  const descriptor = BOUNDARIES[boundaryId];
  const files = descriptor.source_root ? listFiles(descriptor.source_root) : [descriptor.source_file];
  return files.filter((path) => path.endsWith(".php")).sort();
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
      classified: record.classified
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
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

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function apiSurfaceForFile(path) {
  const content = readFileSync(upstreamPath(path), "utf8");
  return {
    path,
    distribution_path: path.replace(/^src\//, ""),
    classes: uniqueSorted([...content.matchAll(/\b(?:abstract\s+|final\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1])),
    interfaces: uniqueSorted([...content.matchAll(/\binterface\s+([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1])),
    traits: uniqueSorted([...content.matchAll(/\btrait\s+([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1])),
    function_names: uniqueSorted([...content.matchAll(/\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map((match) => match[1])),
    constant_names: uniqueSorted([...content.matchAll(/\bconst\s+([A-Za-z_][A-Za-z0-9_]*)\b/g)].map((match) => match[1]))
  };
}

function sourceMarkers(path) {
  const content = readFileSync(upstreamPath(path), "utf8");
  const head = content.slice(0, 6000);
  return {
    path,
    distribution_path: path.replace(/^src\//, ""),
    license_marker: /license|copyright|LGPL|GPL|MIT|BSD|Apache/i.test(head),
    deprecated_marker: /@deprecated|_deprecated_file|_deprecated_function|deprecated/i.test(content),
    conditional_declaration_marker: /(class_exists|function_exists|interface_exists|trait_exists|defined)\s*\(/i.test(content),
    require_marker: /\b(require|require_once|include|include_once)\b/i.test(content),
    gettext_translation_marker: /gettext|translation|plural|context|msgid|msgstr|msgctxt|PO|MO|POMO/i.test(content),
    mo_binary_marker: /unpack|pack|fread|fseek|stream|endian|magic/i.test(content),
    diff_marker: /Text_Diff|diff|edits|lcs|xdiff|shell/i.test(content),
    renderer_marker: /Renderer|inline|context|ins|del|changed|emptyLine/i.test(content),
    json_marker: /Services_JSON|json_encode|json_decode|decode|encode|UTF-?8|comment/i.test(content),
    xmlrpc_marker: /IXR|XML-?RPC|xmlrpc|fault|methodCall|methodResponse|base64|dateTime\.iso8601/i.test(content),
    xml_extension_marker: /xml_parser_create|xml_parse|SimpleXML|DOMDocument|libxml/i.test(content),
    host_primitive_marker: /json_encode|json_decode|readonly|PHP_VERSION_ID|ZipArchive|xml_parser|extension_loaded|function_exists/i.test(
      content
    )
  };
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

function downstreamIssueRecords() {
  const issueRows = readJsonl(BEADS_EXPORT);
  return Object.fromEntries(Object.values(DOWNSTREAM_ISSUES).map((issue) => [issue.external_ref, issueRows.find((row) => row.id === issue.issue_id)]));
}

function validateDownstreamIssues(records) {
  const failures = [];
  for (const issue of Object.values(DOWNSTREAM_ISSUES)) {
    const record = records[issue.external_ref];
    if (!record) {
      failures.push(`${issue.external_ref} is missing from ${BEADS_EXPORT}`);
      continue;
    }
    if (record.external_ref !== issue.external_ref) failures.push(`${issue.issue_id} external_ref is ${record.external_ref}`);
    if (record.status !== "open") failures.push(`${issue.external_ref} expected open status, found ${record.status}`);
    if (!record.dependencies?.some((dependency) => dependency.depends_on_id === ISSUE.id && dependency.type === "parent-child")) {
      failures.push(`${issue.external_ref} is missing parent-child dependency on ${ISSUE.external_ref}`);
    }
  }
  const decision = DOWNSTREAM_ISSUES.provenance_decision;
  for (const issue of Object.values(DOWNSTREAM_ISSUES).filter((entry) => entry.external_ref !== decision.external_ref)) {
    const record = records[issue.external_ref];
    if (!record?.dependencies?.some((dependency) => dependency.depends_on_id === decision.issue_id && dependency.type === "blocks")) {
      failures.push(`${issue.external_ref} is missing blocks dependency to ${decision.external_ref}`);
    }
  }
  return failures;
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

function validateInputs({ selectedStrategy, selectedClosure, sourceFiles, sourceInventory, artifactEvidence, wordpressLicense, issueRecords }) {
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
    if (boundary?.source_tree.php_file_count !== descriptor.expected_php_count) {
      failures.push(`${id} source tree PHP file count is ${boundary?.source_tree.php_file_count}`);
    }
  }
  const phpCompatFiles = boundaryPhpFiles("php_compat");
  if (phpCompatFiles.length !== 1 || phpCompatFiles[0] !== "src/wp-includes/php-compat/readonly.php") {
    failures.push(`php_compat boundary must remain limited to readonly.php, found ${phpCompatFiles.join(", ")}`);
  }
  if (sourceFiles.some((path) => path === "src/wp-includes/compat.php" || path === "src/wp-includes/compat-utf8.php")) {
    failures.push("compat.php or compat-utf8.php leaked into the WPHX-323.06 php_compat boundary");
  }
  if (sourceFiles.length !== 26) failures.push(`expected 26 selected PHP source files, found ${sourceFiles.length}`);
  if (sourceInventory.length !== sourceFiles.length) {
    failures.push(`expected ${sourceFiles.length} source inventory records, found ${sourceInventory.length}`);
  }
  if (artifactEvidence.length !== sourceFiles.length) {
    failures.push(`expected ${sourceFiles.length} artifact provenance records, found ${artifactEvidence.length}`);
  }
  if (wordpressLicense?.package_license !== "GPL-2.0-or-later") {
    failures.push(`expected WordPress package license GPL-2.0-or-later, found ${wordpressLicense?.package_license}`);
  }
  failures.push(...validateDownstreamIssues(issueRecords));
  if (failures.length > 0) {
    throw new Error(`WPHX-323.06 localization/legacy vendor gate plan failed:\n- ${failures.join("\n- ")}`);
  }
}

function main() {
  const strategy = readJson(STRATEGY);
  const closure = readJson(VENDOR_CLOSURE);
  const licenseProvenance = readJson(LICENSE_PROVENANCE);
  const upstreamLock = readJson(UPSTREAM_LOCK);
  const wordpressLicense = licenseProvenance.upstreams.find((entry) => entry.id === "upstream:wordpress-7.0.0");
  const selectedStrategy = Object.fromEntries(
    Object.keys(BOUNDARIES).map((id) => [id, strategy.boundary_replacement_plan.find((entry) => entry.id === id)])
  );
  const selectedClosure = Object.fromEntries(Object.keys(BOUNDARIES).map((id) => [id, closure.vendor_boundaries.find((entry) => entry.id === id)]));
  const sourceFiles = Object.keys(BOUNDARIES).flatMap(boundaryPhpFiles).sort();
  const sourceInventory = sourceInventoryRecords(sourceFiles);
  const artifactEvidence = artifactRecords(sourceFiles.map((path) => path.replace(/^src\//, "")));
  const issueRecords = downstreamIssueRecords();

  validateInputs({ selectedStrategy, selectedClosure, sourceFiles, sourceInventory, artifactEvidence, wordpressLicense, issueRecords });

  const source_records = sourceFiles.map(sourceRecord);
  const source_markers = sourceFiles.map(sourceMarkers);
  const api_surface = sourceFiles.map(apiSurfaceForFile);
  const selected_boundaries = Object.keys(BOUNDARIES).map((id) => ({
    id,
    name: selectedClosure[id].name,
    kind: selectedClosure[id].kind,
    source_path: selectedClosure[id].source_path,
    distribution_path: selectedClosure[id].distribution_path,
    current_strategy: selectedStrategy[id].current_strategy,
    replacement_strategy: selectedStrategy[id].replacement_strategy,
    direct_haxe_port_candidate: BOUNDARIES[id].direct_haxe_port_candidate,
    host_primitive_backed_candidate: BOUNDARIES[id].host_primitive_backed_candidate,
    source_inventory_count: selectedClosure[id].source_inventory.count,
    distribution_artifact_count: selectedClosure[id].distribution_artifacts.count,
    source_tree: selectedClosure[id].source_tree,
    license_provenance: selectedClosure[id].license_provenance,
    required_gates: selectedStrategy[id].required_gates,
    removal_gate: selectedStrategy[id].removal_gate
  }));

  const gate_plan = [
    {
      id: "pomo-localization-corpus",
      boundary_id: "pomo",
      downstream_issue: DOWNSTREAM_ISSUES.pomo_localization_corpus,
      gate_kind: "localization_catalog_parser_api_and_bootstrap_corpus",
      required_before: ["direct_haxe_pomo_port_claim", "generated_public_pomo_replacement", "copied_pomo_artifact_retirement"],
      required_observations: [
        "PO and MO import/export over contexts, plural forms, obsolete entries, headers, encodings, stream backends, and malformed files",
        "POMO class/function reflection and public property/method compatibility for Entries, Translations, PO, MO, streams, and Plural_Forms",
        "bootstrap, translation cache, locale switching, admin localization, theme/plugin language file, and textdomain handoff requirements",
        "native PHP array/string/binary behavior, warning/error shapes, include order, and path handling around translation loading",
        "license/provenance review for POMO source headers and WordPress project notice before distribution divergence"
      ],
      generated_public_wrapper_requirements:
        "WPHX PHP must emit original-path public PHP preserving POMO class names, include timing, reflection-visible properties/methods, binary stream behavior, and native arrays before the copied library can retire.",
      acceptance:
        "A future POMO receipt may admit a direct Haxe port only after localization catalog fixtures and bootstrap/admin integration requirements pass.",
      fallback_policy:
        "Preserve upstream POMO for all catalog parsing, plural evaluation, stream handling, malformed input, and localization bootstrap behavior outside the admitted corpus.",
      removal_gate:
        "Do not retire copied POMO artifacts until WPHX-323.31 records passing corpus/API/provenance evidence and WPHX-323.36 accepts the replacement decision."
    },
    {
      id: "php-compat-readonly-shim",
      boundary_id: "php_compat",
      downstream_issue: DOWNSTREAM_ISSUES.php_compat_readonly_shim,
      gate_kind: "host_version_readonly_shim_bootstrap_fixture",
      required_before: ["host_primitive_php_compat_replacement_claim", "generated_readonly_shim_replacement", "copied_php_compat_artifact_retirement"],
      required_observations: [
        "readonly.php include policy across supported PHP versions, including the PHP 8.1 reserved-keyword blocker and unsupported-host behavior",
        "readonly() reflection/API shape, deprecated-function signaling, wp_readonly() handoff, output return/echo behavior, and argument defaults",
        "bootstrap timing through WPHX-301/WPHX-303, function_exists guards, repeated include behavior, and fatal/warning preservation",
        "host-version detection and fallback matrix for hosts that still require the upstream compatibility shim",
        "license/provenance review for the preserved php-compat/readonly.php boundary"
      ],
      generated_public_wrapper_requirements:
        "Any generated replacement must stay narrowed to wp-includes/php-compat/readonly.php, preserve conditional declaration timing, and must not pull compat.php or compat-utf8.php into the WPHX-323 php_compat boundary.",
      acceptance:
        "A future php-compat receipt may admit a host-primitive-backed readonly shim only after version, bootstrap, deprecation, and fallback fixtures pass.",
      fallback_policy:
        "Preserve upstream readonly.php whenever host version behavior, deprecated signaling, include timing, or wp_readonly handoff evidence is incomplete.",
      removal_gate:
        "Do not retire copied php-compat/readonly.php until WPHX-323.32 records passing shim evidence and WPHX-323.36 accepts the replacement decision."
    },
    {
      id: "text-diff-api-renderer-corpus",
      boundary_id: "text_diff",
      downstream_issue: DOWNSTREAM_ISSUES.text_diff_api_renderer_corpus,
      gate_kind: "diff_algorithm_engine_renderer_api_corpus",
      required_before: ["direct_haxe_text_diff_port_claim", "generated_public_text_diff_replacement", "copied_text_diff_artifact_retirement"],
      required_observations: [
        "Text_Diff edit sequence behavior across native, string, shell, and xdiff engines, including unavailable-host fallbacks",
        "Text_Diff_Renderer and inline renderer output over additions, deletions, changes, context, empty lines, escaping, and whitespace",
        "Text_Diff_Exception, class loading, public API/reflection shape, constants, public properties, and constructor argument behavior",
        "admin revision, plugin, theme, post, and list-table diff caller requirements from WPHX-315/WPHX-316 surfaces",
        "license/provenance review for Text_Diff headers before distribution divergence"
      ],
      generated_public_wrapper_requirements:
        "WPHX PHP must emit original-path classes under wp-includes/Text with legacy class names, engine/renderer include paths, reflection shape, and renderer output matching WordPress callers.",
      acceptance:
        "A future Text_Diff receipt may admit a direct Haxe port only after algorithm, engine, renderer, API, and admin-integration fixtures pass.",
      fallback_policy:
        "Preserve upstream Text_Diff when optional engines are unavailable, renderer edge cases diverge, or admin diff integration evidence is incomplete.",
      removal_gate:
        "Do not retire copied Text_Diff artifacts until WPHX-323.33 records passing corpus/API/provenance evidence and WPHX-323.36 accepts the replacement decision."
    },
    {
      id: "services-json-legacy-compatibility",
      boundary_id: "services_json",
      downstream_issue: DOWNSTREAM_ISSUES.services_json_legacy_compatibility,
      gate_kind: "legacy_json_host_primitive_differential_fixture",
      required_before: ["host_json_primitive_replacement_claim", "generated_services_json_replacement", "copied_services_json_artifact_retirement"],
      required_observations: [
        "Services_JSON reflection/API shape, constants/options, deprecated-file behavior, constructor flags, and error/warning behavior",
        "legacy encode/decode corpus over arrays, objects, associative/object output modes, numbers, strings, invalid UTF-8, comments, and malformed payloads",
        "json_encode/json_decode host-primitive differential results, including unsupported edge behavior that must stay on upstream fallback",
        "deprecated route/caller pressure through WPHX-303 and WPHX-318 legacy/deprecated surfaces",
        "license/provenance review for class-json.php headers before distribution divergence"
      ],
      generated_public_wrapper_requirements:
        "Any generated replacement must preserve wp-includes/class-json.php class names, constants, options, deprecation behavior, warnings/errors, and legacy ecosystem-visible edge cases.",
      acceptance:
        "A future Services_JSON receipt may admit a host-primitive-backed replacement only after legacy corpus and deprecation/error-shape fixtures pass.",
      fallback_policy:
        "Preserve upstream Services_JSON for invalid UTF-8, malformed payloads, comments, object/array ambiguity, warnings/errors, and plugin-visible edge behavior outside admitted evidence.",
      removal_gate:
        "Do not retire copied class-json.php until WPHX-323.34 records passing legacy JSON evidence and WPHX-323.36 accepts the replacement decision."
    },
    {
      id: "ixr-xmlrpc-value-message-corpus",
      boundary_id: "ixr",
      downstream_issue: DOWNSTREAM_ISSUES.ixr_xmlrpc_value_message_corpus,
      gate_kind: "xmlrpc_value_message_request_api_and_route_corpus",
      required_before: ["direct_haxe_ixr_port_claim", "generated_public_ixr_replacement", "copied_ixr_artifact_retirement"],
      required_observations: [
        "IXR_Value serialization and parsing for scalar, array, struct, date, base64, nil, and malformed XML-RPC values",
        "IXR_Message, IXR_Request, IXR_Error, IXR_Client, IXR_Server, multicall, introspection, date, and base64 API/reflection behavior",
        "XML parser extension behavior, malformed XML, fault handling, HTTP client/server edge cases, and warning/error shapes",
        "installed XML-RPC route integration requirements through WPHX-318 before route behavior can be claimed",
        "license/provenance review for IXR source headers and project notice before distribution divergence"
      ],
      generated_public_wrapper_requirements:
        "WPHX PHP must emit original-path IXR class files preserving class names, include order, reflection shape, XML-RPC serialization, error/fault behavior, and XML extension fallback policy.",
      acceptance:
        "A future IXR receipt may admit a direct Haxe port only after XML-RPC value/message/client/server corpus and WPHX-318 route integration evidence pass.",
      fallback_policy:
        "Preserve upstream IXR for XML extension differences, malformed XML, client/server edge cases, and installed XML-RPC behavior until all route/corpus fixtures pass.",
      removal_gate:
        "Do not retire copied IXR artifacts until WPHX-323.35 records passing XML-RPC corpus evidence and WPHX-323.36 accepts the replacement decision."
    },
    {
      id: "localization-legacy-provenance-decision",
      boundary_ids: ["pomo", "php_compat", "text_diff", "services_json", "ixr"],
      downstream_issue: DOWNSTREAM_ISSUES.provenance_decision,
      gate_kind: "license_provenance_ecosystem_fallback_and_replacement_decision",
      required_before: ["distribution_divergence", "copied_artifact_retirement", "haxe_owned_vendor_runtime_claim"],
      required_observations: [
        "WPHX-323.31 through WPHX-323.35 passing fixture, API/reflection, fallback, and provenance evidence",
        "license/provenance and notice treatment across POMO, php-compat/readonly.php, Text_Diff, Services_JSON, and IXR",
        "caller/ecosystem pressure review for localization, admin diff, legacy JSON, deprecated APIs, XML-RPC, and host-version shims",
        "generated/public wrapper requirements and WPHX PHP original-path emission feasibility per boundary",
        "explicit accepted decision choosing direct Haxe port, host-primitive-backed replacement with preserved fallback, or renewed preserved exception per boundary"
      ],
      generated_public_wrapper_requirements:
        "The decision receipt must update ownership state only for boundaries with generated original-path PHP evidence or accepted durable replacement evidence; otherwise preserved exceptions remain active.",
      acceptance:
        "A future decision receipt chooses admitted replacement or renewed exception per boundary only after the concrete gates pass and provenance/fallback/ecosystem evidence is complete.",
      fallback_policy:
        "Default to preserved upstream artifacts for all five boundaries until each boundary has passing evidence and an accepted replacement/removal decision.",
      removal_gate:
        "Do not claim Haxe-owned localization/legacy vendor runtime logic or copied artifact retirement without WPHX-323.36 decision evidence."
    }
  ];

  const manifest = {
    schema: "wphx.wp-core-localization-legacy-vendor-replacement-gates.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    scope: {
      parent_strategy_manifest: STRATEGY,
      covered_boundaries: selected_boundaries,
      source_records,
      source_markers,
      api_surface
    },
    inputs: {
      replacement_strategy_manifest: fileRecord(STRATEGY),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      license_provenance_manifest: fileRecord(LICENSE_PROVENANCE),
      source_inventory: fileRecord(SOURCE_INVENTORY),
      source_inventory_records: sourceInventory,
      artifact_provenance: fileRecord(ARTIFACT_PROVENANCE),
      artifact_provenance_records: artifactEvidence,
      beads_export: fileRecord(BEADS_EXPORT),
      downstream_issue_records: Object.fromEntries(
        Object.entries(issueRecords).map(([externalRef, record]) => [
          externalRef,
          {
            id: record.id,
            external_ref: record.external_ref,
            status: record.status,
            dependency_count: record.dependency_count,
            dependent_count: record.dependent_count,
            dependencies: record.dependencies.map((dependency) => ({
              depends_on_id: dependency.depends_on_id,
              type: dependency.type
            }))
          }
        ])
      ),
      upstream_lock: fileRecord(UPSTREAM_LOCK),
      wordpress_checkout: currentWordPressCheckout(upstreamLock),
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
        boundary_id: "pomo",
        condition: "catalog parsing, plural/context behavior, stream handling, bootstrap/admin integration, or provenance evidence is incomplete",
        decision: "preserve_upstream_pomo_fallback"
      },
      {
        boundary_id: "php_compat",
        condition: "host-version readonly shim behavior, include timing, deprecation signaling, or wp_readonly handoff evidence is incomplete",
        decision: "preserve_upstream_php_compat_readonly_fallback"
      },
      {
        boundary_id: "text_diff",
        condition: "diff engine, renderer, optional host engine, admin integration, or provenance evidence is incomplete",
        decision: "preserve_upstream_text_diff_fallback"
      },
      {
        boundary_id: "services_json",
        condition: "legacy JSON edge behavior, deprecated warnings/errors, malformed payload, or host json differential evidence is incomplete",
        decision: "preserve_upstream_services_json_fallback"
      },
      {
        boundary_id: "ixr",
        condition: "XML-RPC value/message/client/server behavior, XML extension behavior, installed route evidence, or provenance evidence is incomplete",
        decision: "preserve_upstream_ixr_fallback"
      }
    ],
    validation_result: {
      status: "passed",
      planned_boundary_ids: Object.keys(BOUNDARIES),
      planned_boundary_count: Object.keys(BOUNDARIES).length,
      source_record_count: source_records.length,
      source_inventory_record_count: sourceInventory.length,
      artifact_provenance_record_count: artifactEvidence.length,
      gate_count: gate_plan.length,
      downstream_issue_count: Object.keys(DOWNSTREAM_ISSUES).length,
      pomo_php_file_count: boundaryPhpFiles("pomo").length,
      php_compat_php_file_count: boundaryPhpFiles("php_compat").length,
      text_diff_php_file_count: boundaryPhpFiles("text_diff").length,
      services_json_php_file_count: boundaryPhpFiles("services_json").length,
      ixr_php_file_count: boundaryPhpFiles("ixr").length,
      direct_haxe_port_candidate_count: Object.values(BOUNDARIES).filter((entry) => entry.direct_haxe_port_candidate).length,
      host_primitive_backed_candidate_count: Object.values(BOUNDARIES).filter((entry) => entry.host_primitive_backed_candidate).length,
      renewed_preserved_fallback_boundary_count: Object.keys(BOUNDARIES).length,
      php_compat_boundary_limited_to_readonly: true,
      compat_php_or_compat_utf8_included: false,
      haxe_owned_vendor_runtime_claimed: false,
      generated_public_php_replacement_claimed: false,
      copied_artifact_retirement_claimed: false,
      localization_installed_parity_claimed: false,
      admin_diff_installed_parity_claimed: false,
      legacy_json_behavior_parity_claimed: false,
      xmlrpc_installed_parity_claimed: false,
      host_version_support_closed_claimed: false,
      legal_review_completed_claimed: false
    },
    claims: [
      "POMO, php-compat/readonly.php, Text_Diff, Services_JSON, and IXR now have a machine-readable replacement gate plan linked to WPHX-323.01 and WPHX-323 preserved-vendor closure.",
      "POMO, Text_Diff, and IXR are direct Haxe port candidates only after public API/reflection, fixture corpus, generated original-path PHP, integration, fallback, and provenance gates pass.",
      "php-compat/readonly.php and Services_JSON are host-primitive-backed replacement candidates with preserved upstream fallback until host-version, deprecation, legacy behavior, and provenance gates pass.",
      "Concrete downstream gates WPHX-323.31 through WPHX-323.36 are recorded for localization, readonly shim, diff, legacy JSON, XML-RPC, and final provenance decision evidence.",
      "The WPHX-323.06 php_compat boundary is explicitly limited to wp-includes/php-compat/readonly.php; wp-includes/compat.php and wp-includes/compat-utf8.php remain outside this vendor gate."
    ],
    non_claims: [
      "This plan does not implement Haxe-owned POMO, php-compat, Text_Diff, Services_JSON, or IXR runtime logic.",
      "This plan does not generate, validate, or distribute public replacement PHP for localization, diff, legacy JSON, XML-RPC, or php-compat boundaries.",
      "This plan does not retire copied or preserved POMO, php-compat/readonly.php, Text_Diff, Services_JSON, or IXR artifacts.",
      "This plan does not claim installed localization parity, admin diff/revision parity, legacy JSON behavior parity, XML-RPC route parity, host-version support closure, or broad plugin ecosystem compatibility.",
      "This plan does not claim legal review completion; it records the required license/provenance gates before any distribution divergence."
    ]
  };

  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-06-localization-legacy-vendor-replacement-gates",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "localization_legacy_vendor_replacement_gate_plan",
    artifact_scope: "pomo-php-compat-readonly-text-diff-services-json-ixr-preserved-vendor-boundaries",
    commands: [
      "npm run wp:core:wphx-323-localization-legacy-vendor-replacement-gates",
      "npm run wp:core:wphx-323-localization-legacy-vendor-replacement-gates:check"
    ],
    artifacts: {
      manifest: OUT,
      parent_strategy_manifest: STRATEGY,
      vendor_closure_manifest: VENDOR_CLOSURE,
      license_provenance_manifest: LICENSE_PROVENANCE,
      source_inventory: SOURCE_INVENTORY,
      artifact_provenance: ARTIFACT_PROVENANCE,
      beads_export: BEADS_EXPORT
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
        source_record_count: manifest.validation_result.source_record_count,
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
