#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-6z1",
  external_ref: "WPHX-308.01",
  title: "Inventory taxonomy, terms, and comments surface"
};
const RECORDED_AT = "2026-06-23T18:40:00.000Z";
const SOURCE = "manifests/source-inventory.jsonl";
const ARTIFACTS = "manifests/artifact-provenance.jsonl";
const TESTS = "manifests/test-inventory.jsonl";
const ABI = "manifests/php-abi/wordpress-7.0-core-abi.v1.json";
const FIRST_PARTY_CLOSURE = "manifests/wp-core/wphx-322-php-first-party-manifest-closure.v1.json";
const OUT = "manifests/wp-core/wphx-308-01-taxonomy-comments-surface.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-308-01-taxonomy-comments-surface.v1.json";
const RECEIPT = "receipts/wp-core/wphx-308-01-taxonomy-comments-surface.v1.json";
const RUNNER = "tools/wp-core/run-taxonomy-comments-surface.mjs";

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
    p.startsWith("wp-admin/network/") ||
    p.startsWith("wp-admin/includes/network.php") ||
    p.startsWith("wp-admin/includes/ms") ||
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
  if (p.includes("taxonomy.php") || p.includes("class-wp-taxonomy.php")) return "taxonomy_registration";
  if (p.includes("class-wp-term.php") || p.includes("term.php") || p.includes("block-bindings/term-data.php")) return "term_model_crud_meta";
  if (p.includes("class-wp-comment.php") || p.endsWith("comment.php") || p.includes("comment-template.php")) return "comment_model_template";
  if (p.includes("class-wp-comments-list-table.php") || p.startsWith("wp-admin/")) return "admin_comment_term_screens";
  if (p.includes("blocks/") || p.includes("theme-compat/comments.php")) return "block_comment_term_bridges";
  if (p.includes("feed-") && p.includes("comments")) return "comment_feed_output";
  if (p.includes("class-walker-comment.php")) return "comment_walker_output";
  if (p.includes("widgets/")) return "comment_widgets";
  return "taxonomy_comment_related";
}

function isC1Source(entry) {
  return entry.baseline === "wordpress-7.0.0" && entry.language === "php" && entry.kind === "runtime_source" && ownerForPath(entry.path) === "WPHX-308";
}

function isC1Artifact(entry) {
  return entry.baseline === "wordpress-7.0.0-distribution" && entry.language === "php" && ownerForPath(entry.path) === "WPHX-308";
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
    if (entry.kind === "function" && byGroup[group].functions.length < 100) byGroup[group].functions.push(entry.name);
    if (entry.kind === "class" && byGroup[group].classes.length < 40) byGroup[group].classes.push(entry.name);
    if (entry.kind === "method" && byGroup[group].methods.length < 100) byGroup[group].methods.push(entry.qualified_name ?? entry.name);
    if (entry.kind === "property" && byGroup[group].properties.length < 80) byGroup[group].properties.push(entry.qualified_name ?? entry.name);
  }
  return Object.fromEntries(Object.entries(byGroup).sort(([a], [b]) => a.localeCompare(b)));
}

function testMatches(path) {
  const p = path.toLowerCase();
  return (
    p.includes("/taxonomy") ||
    p.includes("/term") ||
    p.includes("/comment") ||
    p.includes("comments-controller") ||
    p.includes("terms-controller") ||
    p.includes("taxonomies-controller") ||
    p.includes("commentcount") ||
    p.includes("comment-count")
  );
}

function semanticKeywordPath(path) {
  const p = stripSrc(path).toLowerCase();
  return p.includes("taxonomy") || p.includes("term") || p.includes("comment");
}

function handoffCandidates(entries) {
  const candidates = entries
    .filter((entry) => semanticKeywordPath(entry.path) && ownerForPath(entry.path) !== "WPHX-308")
    .map((entry) => ({
      path: entry.path,
      owner: ownerForPath(entry.path),
      reason:
        ownerForPath(entry.path) === "WPHX-307"
          ? "Current owner rules give query/post precedence; WPHX-308 fixtures must still cover taxonomy/comment semantics exercised through this file."
          : "Current owner rules assign this path to another domain; WPHX-308 must coordinate behavior without changing ownership here."
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return candidates.slice(0, 80);
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-308-taxonomy-comments-surface`);
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
const sourcePaths = new Set(source.map((entry) => entry.path));
const abiEntries = abi.entries.filter((entry) => sourcePaths.has(entry.path));
const functionsWithReferences = abiEntries.filter((entry) => entry.kind === "function" && entry.parameters?.some((parameter) => parameter.by_reference));
const methodsWithReferences = abiEntries.filter((entry) => entry.kind === "method" && entry.parameters?.some((parameter) => parameter.by_reference));
const variadicFunctions = abiEntries.filter((entry) => entry.kind === "function" && entry.parameters?.some((parameter) => parameter.variadic));
const conditionalFunctions = abiEntries.filter((entry) => entry.kind === "function" && entry.declaration_timing !== "top_level");
const classes = abiEntries.filter((entry) => entry.kind === "class").map((entry) => entry.qualified_name ?? entry.name).sort();

const manifest = {
  schema: "wphx.wp-core-taxonomy-comments-surface.v1",
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
    owner: "WPHX-308",
    included:
      "C1 WordPress 7.0 PHP source and distribution artifacts classified to taxonomy, terms, comments, comment templates, comment feeds, and related block/admin bridges by the WPHX-322 owner rules.",
    cross_domain_notes: [
      {
        owner: "WPHX-307",
        reason: "WP_Query, WP_Tax_Query, WP_Term_Query, WP_Comment_Query, post comment submission, and post comment block paths may be classified to posts/query by current precedence; WPHX-308 fixtures must cover the taxonomy/comment semantics they expose."
      },
      {
        owner: "WPHX-311",
        reason: "REST comments, terms, and taxonomies controllers remain REST transport/domain work even when they exercise taxonomy/comment rules."
      },
      {
        owner: "WPHX-314",
        reason: "Block rendering for comments/terms needs later block-render coordination before broad Gutenberg-facing claims."
      },
      {
        owner: "WPHX-316",
        reason: "Admin comment and term screens are included here where owner rules classify them to WPHX-308, but full admin UX/AJAX parity remains an admin feature-screen gate."
      },
      {
        owner: "WPHX-304/WPHX-305",
        reason: "Term/comment CRUD, counts, relationships, and meta depend on object-cache and wpdb SQL/result behavior that must remain separately evidenced."
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
      "A typed taxonomy/comment adapter-contract model for taxonomy registration visibility, term CRUD routing, relationship updates, count/cache invalidation, comment approval/moderation routing, comment query filters, and hook intent.",
    required_next_fixtures: [
      "taxonomy registration and object-type attachment oracle fixture",
      "term insert/update/delete/slash/sanitize oracle fixture",
      "object-term relationship and term-count invalidation fixture",
      "term metadata and cache warmup/invalidation fixture",
      "comment insert/update/delete/approval/moderation oracle fixture",
      "WP_Comment_Query and WP_Term_Query runtime ABI/query-state fixture",
      "comment template/feed/walker output fixture",
      "live database taxonomy/comment SQL/result parity fixture",
      "selected upstream PHPUnit taxonomy/term/comment ratchet"
    ],
    claim:
      "This surface manifest bounds WPHX-308 and names fixture gates. It does not claim public PHP replacement, Haxe-owned runtime logic, live database parity, or installed-distribution taxonomy/comment parity."
  },
  validation_result: {
    status: "passed",
    source_count: source.length,
    artifact_count: artifacts.length,
    abi_entry_count: abiEntries.length,
    class_count: classes.length,
    test_count: tests.length
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const ownership = {
  schema: "wphx.ownership-manifest.v1",
  manifest_id: "ownership:wp-core/taxonomy-comments-surface",
  issue: {
    id: ISSUE.id,
    external_ref: ISSUE.external_ref
  },
  unit: {
    kind: "surface_inventory",
    name: "taxonomy, terms, comments, comment templates, and moderation surface",
    area: "wp-includes/taxonomy.php wp-includes/comment.php wp-includes/comment-template.php wp-admin/comment.php wp-admin/term.php",
    public_contract:
      "This slice inventories WordPress taxonomy/comment runtime boundaries and fixture targets. It does not claim migrated runtime behavior or public PHP ABI replacement."
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
      "Promote bounded taxonomy/comment decisions to typed Haxe adapter contracts, then later to typed Adapter IR/original-path PHP with differential and upstream PHPUnit evidence."
  },
  owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
  generated_paths: [OUT, OWNERSHIP, RECEIPT],
  verification: {
    oracle_commands: [
      "npm run wp:core:wphx-308-taxonomy-comments-surface",
      "npm run wp:core:wphx-308-taxonomy-comments-surface:check",
      "npm run receipts:validate"
    ],
    receipt_refs: ["receipt:wphx-308-01-taxonomy-comments-surface"],
    manifest_digest: sha256(manifestText)
  }
};
const ownershipText = JSON.stringify(ownership, null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-308-01-taxonomy-comments-surface",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "taxonomy/term/comment surface inventory" },
    { path: OWNERSHIP, role: "taxonomy/term/comment surface ownership manifest" },
    { path: RUNNER, role: "deterministic surface generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-308-taxonomy-comments-surface",
    "npm run wp:core:wphx-308-taxonomy-comments-surface:check"
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
