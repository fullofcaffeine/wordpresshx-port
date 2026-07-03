#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.21.1",
  external_ref: "WPHX-315.01",
  title: "Inventory admin common and list-table PHP surface"
};
const RECORDED_AT = "2026-07-03T14:00:00.000Z";
const SOURCE = "manifests/source-inventory.jsonl";
const ARTIFACTS = "manifests/artifact-provenance.jsonl";
const TESTS = "manifests/test-inventory.jsonl";
const ABI = "manifests/php-abi/wordpress-7.0-core-abi.v1.json";
const FIRST_PARTY_CLOSURE = "manifests/wp-core/wphx-322-php-first-party-manifest-closure.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const OUT = "manifests/wp-core/wphx-315-01-admin-common-list-table-surface.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-315-01-admin-common-list-table-surface.v1.json";
const RECEIPT = "receipts/wp-core/wphx-315-01-admin-common-list-table-surface.v1.json";
const RUNNER = "tools/wp-core/run-admin-common-list-table-surface.mjs";

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

function isMediaPath(path) {
  const p = stripSrc(path).toLowerCase();
  return (
    p.includes("media") ||
    p.includes("image") ||
    p.includes("upload") ||
    p.includes("filesystem") ||
    p.includes("mime") ||
    p.includes("attachment") ||
    p.includes("post-thumbnail") ||
    p.endsWith("/file.php") ||
    p === "wp-admin/includes/file.php" ||
    p.includes("class-wp-filesystem")
  );
}

function isBlockPath(path) {
  const p = stripSrc(path).toLowerCase();
  return p.includes("block") || p.includes("interactivity") || p.includes("style-engine") || p.includes("html-api") || p.includes("font") || p.includes("assets");
}

function ownerForPath(path) {
  const p = stripSrc(path).toLowerCase();
  if (isVendorPhpPath(p)) return "WPHX-323";
  if (p.startsWith("wp-content/themes/")) return "WPHX-320";
  if (p.startsWith("wp-content/plugins/")) return "WPHX-318";
  if (p.includes("wpdb") || p.includes("db.php") || p.includes("dbdelta")) return "WPHX-305";
  if (p.includes("ms-") || p.includes("multisite") || p.includes("signup") || (p.includes("site-health") && p.includes("multisite"))) return "WPHX-317";
  if (p.includes("rest-api") || p.includes("class-wp-rest") || p.includes("rest-")) return "WPHX-311";
  if (p.includes("user") || p.includes("capabilities") || p.includes("session-token") || p.includes("pluggable") || p.includes("auth") || p.includes("application-password") || p.includes("wp-login.php") || p.includes("wp-activate.php")) return "WPHX-306";
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
  if (p.includes("class-wp-list-table") || p.includes("list-table")) return "list_table_base_and_specializations";
  if (p.includes("class-wp-screen") || p.endsWith("/screen.php") || p.includes("screen")) return "screen_help_options";
  if (p.includes("menu") || p.includes("nav-menu") || p.includes("walker-nav") || p.includes("walker-category")) return "menus_navigation_common";
  if (p.includes("privacy") || p.includes("erase-personal-data") || p.includes("export-personal-data")) return "privacy_tools_admin";
  if (p.includes("site-health") || p.includes("debug-data") || p.includes("community-events") || p.includes("dashboard")) return "dashboard_site_health";
  if (p.includes("import") || p.includes("export")) return "import_export_tools";
  if (p.includes("plugin")) return "plugin_admin_common";
  if (p.includes("bookmark") || p.includes("link-")) return "links_bookmarks_admin";
  if (p.includes("admin-header") || p.includes("admin-footer") || p.includes("admin-functions") || p.endsWith("/admin.php") || p.includes("/admin.php")) return "admin_bootstrap_chrome";
  if (p.includes("load-scripts") || p.includes("load-styles")) return "admin_asset_loader";
  if (p.includes("ftp") || p.includes("pclzip") || p.includes("filesystem") || p.includes("upgrade")) return "filesystem_update_handoff";
  if (p.includes("about") || p.includes("freedoms") || p.includes("contribute")) return "about_credits_pages";
  if (p.includes("moderation") || p.includes("noop") || p.includes("deprecated") || p.includes("misc") || p.includes("continents-cities")) return "admin_misc_compat";
  return "admin_common_shared";
}

function isC1Source(entry) {
  return entry.baseline === "wordpress-7.0.0" && entry.language === "php" && entry.kind === "runtime_source" && ownerForPath(entry.path) === "WPHX-315";
}

function isC1Artifact(entry) {
  return entry.baseline === "wordpress-7.0.0-distribution" && entry.language === "php" && ownerForPath(entry.path) === "WPHX-315";
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
    if (entry.kind === "function" && byGroup[group].functions.length < 180) byGroup[group].functions.push(entry.name);
    if (entry.kind === "class" && byGroup[group].classes.length < 100) byGroup[group].classes.push(entry.name);
    if (entry.kind === "method" && byGroup[group].methods.length < 240) byGroup[group].methods.push(entry.qualified_name ?? entry.name);
    if (entry.kind === "property" && byGroup[group].properties.length < 160) byGroup[group].properties.push(entry.qualified_name ?? entry.name);
  }
  return Object.fromEntries(Object.entries(byGroup).sort(([a], [b]) => a.localeCompare(b)));
}

function testMatches(path) {
  const p = path.toLowerCase();
  return (
    p.includes("/admin/") ||
    p.includes("/adminbar") ||
    p.includes("/dashboard") ||
    p.includes("/screen") ||
    p.includes("listtable") ||
    p.includes("list-table") ||
    p.includes("wpadminnotice") ||
    p.includes("wpgetadminnotice") ||
    p.includes("selfadminurl") ||
    p.includes("getdashboardurl") ||
    p.includes("/privacy/") ||
    p.includes("/import/") ||
    p.includes("/menu/") ||
    p.includes("site-health") ||
    p.includes("application-password")
  );
}

function semanticKeywordPath(path) {
  const p = stripSrc(path).toLowerCase();
  return (
    p.startsWith("wp-admin/") ||
    p.includes("admin") ||
    p.includes("screen") ||
    p.includes("list-table") ||
    p.includes("dashboard") ||
    p.includes("site-health") ||
    p.includes("menu") ||
    p.includes("privacy")
  );
}

function handoffReason(owner) {
  if (owner === "WPHX-306") return "Admin screens depend on users, capabilities, nonces, application passwords, and auth state, but those primitives remain WPHX-306 ownership.";
  if (owner === "WPHX-307" || owner === "WPHX-308") return "Admin post, taxonomy, and comment screens expose list-table behavior while storage/query/comment semantics remain their source-domain owners.";
  if (owner === "WPHX-310") return "Customizer, theme, widget, and nav-menu admin surfaces share admin chrome but remain theme/customizer ownership.";
  if (owner === "WPHX-311") return "REST-backed admin flows and site-health REST controllers need REST transport/schema evidence before installed claims.";
  if (owner === "WPHX-312") return "Privacy export/erasure mail, HTTP, and feed/embed helpers remain WPHX-312 behavior beneath admin UI entry points.";
  if (owner === "WPHX-313") return "Media/image/filesystem helpers are used by admin screens but remain WPHX-313 source-domain behavior.";
  if (owner === "WPHX-316") return "Feature screens and AJAX are the next admin layer after common chrome, request state, and list-table primitives.";
  if (owner === "WPHX-317") return "Network admin, multisite list tables, and site/user network state remain WPHX-317 behavior.";
  if (owner === "WPHX-319") return "Updater, installer, recovery, and filesystem transport flows wrap admin common surfaces but remain WPHX-319.";
  if (owner === "WPHX-323") return "Bundled vendor/library internals remain preserved-vendor boundaries and are not Haxe-owned by WPHX-315.";
  return "Current owner rules assign this path to another domain; WPHX-315 must coordinate behavior without changing ownership there.";
}

function handoffCandidates(entries) {
  return entries
    .filter((entry) => semanticKeywordPath(entry.path) && ownerForPath(entry.path) !== "WPHX-315")
    .map((entry) => ({
      path: entry.path,
      owner: ownerForPath(entry.path),
      reason: handoffReason(ownerForPath(entry.path))
    }))
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, 180);
}

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) throw new Error(`${path} is stale; run npm run wp:core:wphx-315-admin-common-list-table-surface`);
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
const firstPartyClosure = readJson(FIRST_PARTY_CLOSURE);
const sourcePaths = new Set(source.map((entry) => entry.path));
const abiEntries = abi.entries.filter((entry) => sourcePaths.has(entry.path));
const functionsWithReferences = abiEntries.filter((entry) => entry.kind === "function" && entry.parameters?.some((parameter) => parameter.by_reference));
const methodsWithReferences = abiEntries.filter((entry) => entry.kind === "method" && entry.parameters?.some((parameter) => parameter.by_reference));
const variadicFunctions = abiEntries.filter((entry) => entry.kind === "function" && entry.parameters?.some((parameter) => parameter.variadic));
const conditionalFunctions = abiEntries.filter((entry) => entry.kind === "function" && entry.declaration_timing !== "top_level");
const classEntries = abiEntries.filter((entry) => entry.kind === "class");
const namedClasses = classEntries.filter((entry) => !entry.flags?.anonymous).map((entry) => entry.qualified_name ?? entry.name).sort();
const closureOwner = firstPartyClosure.coverage.owner_coverage["WPHX-315"];
const validationFailures = [];

if (!closureOwner) validationFailures.push("WPHX-315 is missing from WPHX-322 owner coverage");
if (closureOwner && source.length !== closureOwner.source_count) validationFailures.push(`source count mismatch with WPHX-322: ${source.length} != ${closureOwner.source_count}`);
if (closureOwner && artifacts.length !== closureOwner.artifact_count) validationFailures.push(`artifact count mismatch with WPHX-322: ${artifacts.length} != ${closureOwner.artifact_count}`);

const manifest = {
  schema: "wphx.wp-core-admin-common-list-table-surface.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  inputs: {
    source_inventory: inputRecord(SOURCE),
    artifact_provenance: inputRecord(ARTIFACTS),
    test_inventory: inputRecord(TESTS),
    php_abi: inputRecord(ABI),
    first_party_closure: inputRecord(FIRST_PARTY_CLOSURE),
    vendor_closure: inputRecord(VENDOR_CLOSURE)
  },
  scope: {
    owner: "WPHX-315",
    included:
      "C1 WordPress 7.0 PHP source and distribution artifacts classified to admin bootstrap/chrome, shared admin helpers, screens/help/options, menu/navigation helpers, list-table base and selected specializations, dashboard/site-health helpers, privacy tools, import/export helpers, and shared admin output by the WPHX-322 owner rules.",
    cross_domain_notes: [
      {
        owner: "WPHX-306",
        reason: "Admin common behavior depends on users, capabilities, auth cookies, nonces, and application passwords without moving those primitives into WPHX-315."
      },
      {
        owner: "WPHX-307/WPHX-308",
        reason: "Post, comment, taxonomy, and term admin list tables need source-domain query/storage behavior before installed admin claims."
      },
      {
        owner: "WPHX-310",
        reason: "Customizer, theme, widget, and navigation menu admin surfaces share admin chrome but remain theme/customizer ownership."
      },
      {
        owner: "WPHX-312/WPHX-313",
        reason: "Privacy export/erasure, media, filesystem, and upload admin paths coordinate with HTTP/mail/privacy and media/filesystem source domains."
      },
      {
        owner: "WPHX-316",
        reason: "Feature screens and AJAX flows build on admin common/list-table primitives and remain the next admin layer."
      },
      {
        owner: "WPHX-317/WPHX-319",
        reason: "Network admin, updater/installer/recovery, and filesystem transport behavior require multisite/update domain evidence before admin ownership claims."
      },
      {
        owner: "WPHX-323",
        reason: "PclZip and any other bundled-library internals remain preserved-vendor/library boundaries and are not claimed as Haxe-owned admin logic."
      }
    ],
    semantic_handoff_candidates: handoffCandidates(allSource)
  },
  coverage: {
    source_count: source.length,
    artifact_count: artifacts.length,
    abi_entry_count: abiEntries.length,
    class_count: classEntries.length,
    named_class_count: namedClasses.length,
    test_count: tests.length,
    source_by_group: summarizeByGroup(source),
    artifact_by_group: summarizeByGroup(artifacts),
    abi_by_group: symbolSummary(abiEntries),
    classes: namedClasses,
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
      "A typed admin common/list-table adapter-contract model for admin request state, screen/help/options, list-table columns/actions/pagination, admin notices, menu registration, capability/nonce hook intent, and selected output fragments.",
    required_next_fixtures: [
      "admin request/bootstrap state and screen setup oracle fixture",
      "WP_Screen help tabs/options/current-screen fixture",
      "WP_List_Table base ABI, columns, bulk actions, pagination, and output fixture",
      "selected users/plugins/privacy list-table specializations fixture",
      "admin menu/submenu registration and ordering fixture",
      "admin notices, header/footer, and common output helpers fixture",
      "admin nonce/capability integration fixture",
      "selected upstream PHPUnit admin/list-table ratchet",
      "installed-style admin common/list-table package gate"
    ],
    claim:
      "This surface manifest bounds WPHX-315 and names fixture gates. It does not claim public PHP replacement, Haxe-owned runtime logic, complete admin feature screens, admin AJAX, installed WordPress admin parity, or browser/editor ownership."
  },
  validation_result: {
    status: validationFailures.length === 0 ? "passed" : "failed",
    failures: validationFailures,
    source_count: source.length,
    artifact_count: artifacts.length,
    abi_entry_count: abiEntries.length,
    class_count: classEntries.length,
    test_count: tests.length
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const ownership = {
  schema: "wphx.ownership-manifest.v1",
  manifest_id: "ownership:wp-core/admin-common-list-table-surface",
  issue: {
    id: ISSUE.id,
    external_ref: ISSUE.external_ref
  },
  unit: {
    kind: "surface_inventory",
    name: "admin common, admin chrome, current screen, menus, notices, and list-table surface",
    area: "wp-admin/admin.php wp-admin/admin-header.php wp-admin/admin-footer.php wp-admin/includes/class-wp-screen.php wp-admin/includes/class-wp-list-table.php wp-admin/includes/list-table.php wp-admin/menu.php",
    public_contract:
      "This slice inventories WordPress admin common/list-table runtime boundaries and fixture targets. It does not claim migrated runtime behavior, feature-screen ownership, admin AJAX ownership, or public PHP ABI replacement."
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
      "Promote bounded admin common/list-table decisions to typed Haxe adapter contracts, then later to typed Adapter IR/original-path PHP with admin request, screen, list-table, menu, notices, installed admin, and upstream PHPUnit/e2e evidence."
  },
  owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
  generated_paths: [OUT, OWNERSHIP, RECEIPT],
  verification: {
    oracle_commands: [
      "npm run wp:core:wphx-315-admin-common-list-table-surface",
      "npm run wp:core:wphx-315-admin-common-list-table-surface:check",
      "npm run receipts:validate"
    ],
    receipt_refs: ["receipt:wphx-315-01-admin-common-list-table-surface"],
    manifest_digest: sha256(manifestText)
  }
};
const ownershipText = JSON.stringify(ownership, null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-315-01-admin-common-list-table-surface",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "admin common/list-table surface inventory" },
    { path: OWNERSHIP, role: "admin common/list-table surface ownership manifest" },
    { path: RUNNER, role: "deterministic surface generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-315-admin-common-list-table-surface",
    "npm run wp:core:wphx-315-admin-common-list-table-surface:check"
  ],
  validation_result: manifest.validation_result,
  manifest_sha256: sha256(manifestText),
  ownership_sha256: sha256(ownershipText)
};
const receiptText = JSON.stringify(receipt, null, 2) + "\n";

if (validationFailures.length > 0) {
  console.error(JSON.stringify(manifest.validation_result, null, 2));
  process.exit(1);
}

try {
  writeOrCheck(OUT, manifestText);
  writeOrCheck(OWNERSHIP, ownershipText);
  writeOrCheck(RECEIPT, receiptText);
} catch (error) {
  console.error(JSON.stringify({ status: "failed", error: error.message }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(manifest.validation_result, null, 2));
