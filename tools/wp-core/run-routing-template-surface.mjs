#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-s0e",
  external_ref: "WPHX-309.01",
  title: "Inventory rewrite, routing, canonical, and template-loader surface"
};
const RECORDED_AT = "2026-06-24T01:15:00.000Z";
const SOURCE = "manifests/source-inventory.jsonl";
const ARTIFACTS = "manifests/artifact-provenance.jsonl";
const TESTS = "manifests/test-inventory.jsonl";
const ABI = "manifests/php-abi/wordpress-7.0-core-abi.v1.json";
const FIRST_PARTY_CLOSURE = "manifests/wp-core/wphx-322-php-first-party-manifest-closure.v1.json";
const OUT = "manifests/wp-core/wphx-309-01-routing-template-surface.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-309-01-routing-template-surface.v1.json";
const RECEIPT = "receipts/wp-core/wphx-309-01-routing-template-surface.v1.json";
const RUNNER = "tools/wp-core/run-routing-template-surface.mjs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path) {
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
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function inputRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function stripSrc(path) {
  return path.startsWith("src/") ? path.slice(4) : path;
}

function isVendorPhpPath(path) {
  const p = stripSrc(path).toLowerCase();
  return (
    p.startsWith("wp-includes/id3/") ||
    p.startsWith("wp-includes/phpmailer/") ||
    p.startsWith("wp-includes/requests/") ||
    p.startsWith("wp-includes/simplepie/") ||
    p.startsWith("wp-includes/sodium_compat/") ||
    p.includes("/paragonie/") ||
    p.includes("/random_compat/") ||
    p.includes("/simplepie/") ||
    p.includes("/phpmailer/")
  );
}

function isMultisitePath(path) {
  const p = stripSrc(path).toLowerCase();
  return (
    p.startsWith("wp-includes/ms-") ||
    p.includes("multisite") ||
    p.includes("signup") ||
    (p.includes("site-health") && p.includes("multisite"))
  );
}

function ownerForPath(path) {
  const p = stripSrc(path).toLowerCase();
  if (isVendorPhpPath(p)) return "WPHX-323";
  if (p.startsWith("wp-content/themes/")) return "WPHX-320";
  if (p.startsWith("wp-content/plugins/")) return "WPHX-318";
  if (p.includes("wpdb") || p.includes("db.php") || p.includes("dbdelta")) return "WPHX-305";
  if (isMultisitePath(p)) return "WPHX-317";
  if (p.includes("rest-api") || p.includes("class-wp-rest") || p.includes("rest-")) return "WPHX-311";
  if (
    p.includes("user") ||
    p.includes("capabilities") ||
    p.includes("session-token") ||
    p.includes("pluggable") ||
    p.includes("auth") ||
    p.includes("application-password") ||
    p.includes("wp-login.php") ||
    p.includes("wp-activate.php")
  ) {
    return "WPHX-306";
  }
  if (p.includes("post") || p.includes("revision") || p.includes("class-wp-query") || p.includes("query.php") || p.includes("meta.php")) return "WPHX-307";
  if (p.includes("taxonomy") || p.includes("term") || p.includes("comment")) return "WPHX-308";
  if (p.includes("rewrite") || p.includes("canonical") || p.includes("link-template") || p.includes("template-loader") || p.includes("class-wp.php") || p.includes("wp-blog-header.php") || p.includes("index.php")) return "WPHX-309";
  if (p.includes("theme") || p.includes("customize") || p.includes("template") || p.includes("theme-compat") || p.includes("class-wp-theme") || p.includes("global-styles") || p.includes("script-modules")) return "WPHX-310";
  if (p.includes("http") || p.includes("requests") || p.includes("cron") || p.includes("mail") || p.includes("feed") || p.includes("embed") || p.includes("oembed") || p.includes("wp-cron.php") || p.includes("wp-mail.php") || p.includes("wp-links-opml.php") || p.includes("wp-trackback.php")) return "WPHX-312";
  if (p.includes("media") || p.includes("image") || p.includes("upload") || p.includes("filesystem") || p.includes("file.php") || p.includes("class-wp-filesystem") || p.includes("wp-content/index.php")) return "WPHX-313";
  if (p.includes("block") || p.includes("interactivity") || p.includes("style-engine") || p.includes("html-api") || p.includes("fonts") || p.includes("assets")) return "WPHX-314";
  if (p.startsWith("wp-admin/includes/class-wp-list-table") || p.includes("list-table") || p.includes("screen") || p.includes("menu") || p.includes("admin-header") || p.includes("admin-footer")) return "WPHX-315";
  if (p.startsWith("wp-admin/")) {
    if (p.includes("update") || p.includes("install") || p.includes("upgrader") || p.includes("maintenance") || p.includes("recovery")) return "WPHX-319";
    if (p.includes("media") || p.includes("upload")) return "WPHX-313";
    if (p.includes("theme") || p.includes("customize")) return "WPHX-310";
    if (p.includes("ajax") || p.includes("async") || p.includes("network/") || p.includes("options-") || p.includes("tools") || p.includes("edit") || p.includes("post") || p.includes("term") || p.includes("comment")) return "WPHX-316";
    return "WPHX-315";
  }
  if (p.includes("xmlrpc") || p.includes("deprecated") || p.includes("legacy") || p.includes("class-ixr")) return "WPHX-318";
  if (p.includes("update") || p.includes("install") || p.includes("upgrader") || p.includes("recovery") || p.includes("maintenance")) return "WPHX-319";
  if (p.includes("option") || p.includes("transient") || p.includes("cache")) return "WPHX-304";
  if (p.includes("formatting") || p.includes("kses") || p.includes("sanitize") || p.includes("class-wp-error") || p.includes("error") || p.includes("deprecated")) return "WPHX-303";
  if (p.includes("plugin") || p.includes("class-wp-hook") || p.includes("wp-settings.php")) return "WPHX-302";
  if (p === "wp-config-sample.php" || p === "wp-tests-config-sample.php" || p.includes("load.php") || p.includes("default-constants") || p.includes("version.php") || p.includes("compat.php") || p.includes("wp-load.php") || p.includes("wp-settings.php")) return "WPHX-301";
  return "WPHX-301";
}

function groupForPath(path) {
  const p = stripSrc(path).toLowerCase();
  if (p.includes("sitemap")) return "sitemaps";
  if (p.includes("robots")) return "robots";
  if (p.endsWith("wp-blog-header.php") || p.endsWith("index.php") || p.endsWith("_index.php")) return "request_entrypoints";
  if (p.includes("class-wp.php")) return "request_dispatch";
  if (p.includes("class-wp-rewrite.php") || p.includes("rewrite")) return "rewrite_rules";
  if (p.includes("canonical.php")) return "canonical_redirects";
  if (p.includes("link-template.php")) return "link_generation";
  if (p.includes("template-loader.php")) return "template_loading";
  if (p.includes("blocks/index.php")) return "block_index_sentinel";
  return "routing_template_related";
}

function isC1Source(entry) {
  return entry.baseline === "wordpress-7.0.0" && entry.language === "php" && entry.kind === "runtime_source" && ownerForPath(entry.path) === "WPHX-309";
}

function isC1Artifact(entry) {
  return entry.baseline === "wordpress-7.0.0-distribution" && entry.language === "php" && ownerForPath(entry.path) === "WPHX-309";
}

function summarizeByGroup(entries) {
  const groups = {};
  for (const entry of entries) {
    const group = groupForPath(entry.path);
    groups[group] ??= { count: 0, paths: [] };
    groups[group].count++;
    groups[group].paths.push(entry.path);
  }
  return Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)));
}

function symbolSummary(entries) {
  const byGroup = {};
  for (const entry of entries) {
    const group = groupForPath(entry.path);
    byGroup[group] ??= { count: 0, functions: [], classes: [], methods: [], properties: [] };
    byGroup[group].count++;
    if (entry.kind === "function" && byGroup[group].functions.length < 140) byGroup[group].functions.push(entry.name);
    if (entry.kind === "class" && byGroup[group].classes.length < 40) byGroup[group].classes.push(entry.name);
    if (entry.kind === "method" && byGroup[group].methods.length < 140) byGroup[group].methods.push(entry.qualified_name ?? entry.name);
    if (entry.kind === "property" && byGroup[group].properties.length < 80) byGroup[group].properties.push(entry.qualified_name ?? entry.name);
  }
  return Object.fromEntries(Object.entries(byGroup).sort(([a], [b]) => a.localeCompare(b)));
}

function testMatches(path) {
  const p = path.toLowerCase();
  return (
    p.includes("/rewrite") ||
    p.includes("/canonical") ||
    p.includes("/link") ||
    p.includes("/url") ||
    p.includes("/template") ||
    p.includes("/robots") ||
    p.includes("/sitemap") ||
    p.includes("/permalink") ||
    p.includes("/query/conditionals") ||
    p.includes("/query/parsequery") ||
    p.includes("/query/verbose")
  );
}

function semanticKeywordPath(path) {
  const p = stripSrc(path).toLowerCase();
  return (
    p.includes("rewrite") ||
    p.includes("canonical") ||
    p.includes("link-template") ||
    p.includes("template") ||
    p.includes("class-wp.php") ||
    p.includes("wp-blog-header.php") ||
    p.includes("robots") ||
    p.includes("sitemap") ||
    p.includes("feed") ||
    p.includes("embed")
  );
}

function handoffCandidates(entries) {
  return entries
    .filter((entry) => semanticKeywordPath(entry.path) && ownerForPath(entry.path) !== "WPHX-309")
    .map((entry) => {
      const owner = ownerForPath(entry.path);
      return {
        path: entry.path,
        owner,
        reason:
          owner === "WPHX-310"
            ? "Theme and template hierarchy internals consume routing/template-loader decisions but remain theme/template-domain work."
            : owner === "WPHX-312"
              ? "Feed, embed, oEmbed, HTTP, and cron endpoints share routing/canonical observations but remain external-service/runtime-integration work."
              : owner === "WPHX-307"
                ? "WP_Query owns query-state and SQL/result behavior that request parsing feeds."
                : "Current owner rules assign this path to another domain; WPHX-309 must coordinate observable routing behavior without changing ownership here."
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, 100);
}

function closureSnapshot(closure) {
  const source = closure.coverage?.source_by_owner?.["WPHX-309"] ?? null;
  const artifacts = closure.coverage?.artifact_by_owner?.["WPHX-309"] ?? null;
  return {
    source_count: source?.count ?? null,
    artifact_count: artifacts?.count ?? null,
    source_samples: source?.samples ?? [],
    artifact_samples: artifacts?.samples ?? []
  };
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-309-routing-template-surface`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

const allSource = readJsonl(SOURCE).filter((entry) => entry.baseline === "wordpress-7.0.0" && entry.language === "php" && entry.kind === "runtime_source");
const source = allSource.filter(isC1Source);
const artifacts = readJsonl(ARTIFACTS).filter(isC1Artifact);
const tests = readJsonl(TESTS).filter((entry) => entry.baseline === "wordpress-7.0.0" && testMatches(entry.path));
const abi = readJson(ABI);
const closure = readJson(FIRST_PARTY_CLOSURE);
const sourcePaths = new Set(source.map((entry) => entry.path));
const abiEntries = abi.entries.filter((entry) => sourcePaths.has(entry.path));
const functionsWithReferences = abiEntries.filter((entry) => entry.kind === "function" && entry.parameters?.some((parameter) => parameter.by_reference));
const methodsWithReferences = abiEntries.filter((entry) => entry.kind === "method" && entry.parameters?.some((parameter) => parameter.by_reference));
const variadicFunctions = abiEntries.filter((entry) => entry.kind === "function" && entry.parameters?.some((parameter) => parameter.variadic));
const conditionalFunctions = abiEntries.filter((entry) => entry.kind === "function" && entry.declaration_timing !== "top_level");
const classes = abiEntries.filter((entry) => entry.kind === "class").map((entry) => entry.qualified_name ?? entry.name).sort();

const manifest = {
  schema: "wphx.wp-core-routing-template-surface.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  inputs: {
    source_inventory: inputRecord(SOURCE),
    artifact_provenance: inputRecord(ARTIFACTS),
    test_inventory: inputRecord(TESTS),
    php_abi: inputRecord(ABI),
    first_party_closure: inputRecord(FIRST_PARTY_CLOSURE)
  },
  scope: {
    owner: "WPHX-309",
    included:
      "C1 WordPress 7.0 PHP source and distribution artifacts classified to rewrite rules, request dispatch, canonical redirects, link generation, template loading, and request entrypoint sentinels by the WPHX-322 owner rules.",
    excluded:
      "Theme/template hierarchy internals, feed/embed/HTTP endpoint internals, posts/query semantics, multisite routing internals, and block/theme rendering are inventoried as cross-domain handoffs rather than owned here.",
    first_party_closure: closureSnapshot(closure),
    cross_domain_notes: [
      {
        owner: "WPHX-301/WPHX-302",
        reason: "Request bootstrap and hook dispatch are observable during routing; WPHX-309 fixtures must not treat bootstrap/autoload/hook side effects as invisible plumbing."
      },
      {
        owner: "WPHX-304/WPHX-305",
        reason: "Permalink structures, rewrite rules, and canonical URL behavior depend on options/cache and wpdb-backed state."
      },
      {
        owner: "WPHX-307",
        reason: "WP_Query parse/query-state/conditional behavior is the semantic consumer of request parsing and must remain separately evidenced."
      },
      {
        owner: "WPHX-310",
        reason: "Template hierarchy and theme resolution consume template-loader results but belong to the theme/template domain."
      },
      {
        owner: "WPHX-312",
        reason: "Feeds, embeds, oEmbed, cron, HTTP, and endpoint-specific request handling share route/canonical surfaces but remain external-service/runtime-integration work."
      },
      {
        owner: "WPHX-314",
        reason: "Block template and query-block behavior needs block/render coordination before Gutenberg-facing claims."
      }
    ],
    semantic_handoff_candidates: handoffCandidates(allSource)
  },
  coverage: {
    source_count: source.length,
    artifact_count: artifacts.length,
    abi_entry_count: abiEntries.length,
    class_count: classes.length,
    test_count: tests.length,
    source_by_group: summarizeByGroup(source),
    artifact_by_group: summarizeByGroup(artifacts),
    abi_by_group: symbolSummary(abiEntries),
    classes,
    abi_risks: {
      functions_with_reference_parameters: functionsWithReferences.map((entry) => entry.qualified_name ?? entry.name),
      methods_with_reference_parameters: methodsWithReferences.map((entry) => entry.qualified_name ?? entry.name),
      variadic_functions: variadicFunctions.map((entry) => entry.qualified_name ?? entry.name),
      conditional_functions: conditionalFunctions.map((entry) => entry.qualified_name ?? entry.name)
    },
    test_paths: tests.map((entry) => entry.path).sort()
  },
  evidence_plan: {
    first_haxe_candidate:
      "A typed routing/template adapter-contract model for rewrite-rule registration, request query-var matching, canonical redirect decisions, link generation policy, and template-loader intent.",
    required_next_fixtures: [
      "rewrite-rule registration and flush oracle fixture",
      "request parsing and query-var normalization oracle fixture",
      "canonical redirect oracle fixture",
      "permalink/link-template generation oracle fixture",
      "template-loader decision/runtime ABI fixture",
      "robots and sitemap URL-generation fixture",
      "front-end HTTP installed-distribution fixture for route/canonical/template observations",
      "selected upstream PHPUnit rewrite/canonical/link/template ratchet"
    ],
    claim:
      "This surface manifest bounds WPHX-309 and names fixture gates. It does not claim public PHP replacement, Haxe-owned runtime logic, route/canonical parity, template-loader parity, or installed-distribution parity."
  },
  validation_result: {
    status: "passed",
    source_count: source.length,
    artifact_count: artifacts.length,
    abi_entry_count: abiEntries.length,
    class_count: classes.length,
    test_count: tests.length,
    closure_source_count: closureSnapshot(closure).source_count,
    closure_artifact_count: closureSnapshot(closure).artifact_count
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const ownership = {
  schema: "wphx.ownership-manifest.v1",
  manifest_id: "ownership:wp-core/routing-template-surface",
  issue: {
    id: ISSUE.id,
    external_ref: ISSUE.external_ref
  },
  unit: {
    kind: "surface_inventory",
    name: "rewrite, routing, canonical URL, link generation, and template-loader surface",
    area: "wp-includes/class-wp.php wp-includes/class-wp-rewrite.php wp-includes/canonical.php wp-includes/link-template.php wp-includes/template-loader.php wp-blog-header.php index.php",
    public_contract:
      "This slice inventories WordPress routing/template-loader runtime boundaries and fixture targets. It does not claim migrated runtime behavior or public PHP ABI replacement."
  },
  ownership_state: "oracle_surface_inventory",
  ownership_axes: {
    semantic_owner: "upstream_oracle_described",
    adapter_contract_owner: "not_yet_started",
    emission_strategy: "none",
    execution_provider: "upstream_php_oracle",
    compatibility_evidence: "surface_inventory"
  },
  bridge: {
    exists: false,
    kind: "not_applicable",
    removal_gate:
      "Promote bounded routing/template decisions to typed Haxe adapter contracts, then later to typed Adapter IR/original-path PHP with differential, HTTP, and upstream PHPUnit evidence."
  },
  owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
  generated_paths: [OUT, OWNERSHIP, RECEIPT],
  verification: {
    oracle_commands: [
      "npm run wp:core:wphx-309-routing-template-surface",
      "npm run wp:core:wphx-309-routing-template-surface:check",
      "npm run receipts:validate"
    ],
    receipt_refs: ["receipt:wphx-309-01-routing-template-surface"],
    manifest_digest: sha256(manifestText)
  }
};
const ownershipText = JSON.stringify(ownership, null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-309-01-routing-template-surface",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "routing/template surface inventory" },
    { path: OWNERSHIP, role: "routing/template surface ownership manifest" },
    { path: RUNNER, role: "deterministic surface generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-309-routing-template-surface",
    "npm run wp:core:wphx-309-routing-template-surface:check"
  ],
  validation_result: manifest.validation_result,
  manifest_sha256: sha256(manifestText),
  ownership_sha256: sha256(ownershipText)
};
const receiptText = JSON.stringify(receipt, null, 2) + "\n";

try {
  writeOrCheck(OUT, manifestText);
  writeOrCheck(OWNERSHIP, ownershipText);
  writeOrCheck(RECEIPT, receiptText);
} catch (error) {
  console.error(JSON.stringify({ status: "failed", error: error.message }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(manifest.validation_result, null, 2));
