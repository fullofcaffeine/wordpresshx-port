#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-jq9l",
  external_ref: "WPHX-316.01",
  title: "Inventory admin feature screens and AJAX surface"
};
const RECORDED_AT = "2026-07-04T00:30:00.000Z";
const SOURCE = "manifests/source-inventory.jsonl";
const ARTIFACTS = "manifests/artifact-provenance.jsonl";
const TESTS = "manifests/test-inventory.jsonl";
const ABI = "manifests/php-abi/wordpress-7.0-core-abi.v1.json";
const FIRST_PARTY_CLOSURE = "manifests/wp-core/wphx-322-php-first-party-manifest-closure.v1.json";
const ADMIN_COMMON_SURFACE = "manifests/wp-core/wphx-315-01-admin-common-list-table-surface.v1.json";
const OUT = "manifests/wp-core/wphx-316-01-admin-feature-ajax-surface.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-316-01-admin-feature-ajax-surface.v1.json";
const RECEIPT = "receipts/wp-core/wphx-316-01-admin-feature-ajax-surface.v1.json";
const RUNNER = "tools/wp-core/run-admin-feature-ajax-surface.mjs";

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
  return sha256(readFileSync(path));
}

function inputRecord(path) {
  return { path, bytes: statSync(path).size, sha256: sha256File(path) };
}

function git(args, cwd = ".") {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
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

function ownerForPath(path) {
  const p = stripSrc(path).toLowerCase();
  if (isVendorPhpPath(p)) return "WPHX-323";
  if (p.startsWith("wp-content/themes/")) return "WPHX-320";
  if (p.startsWith("wp-content/plugins/")) return "WPHX-318";
  if (p.includes("wpdb") || p.includes("db.php") || p.includes("dbdelta")) return "WPHX-305";
  if (p.includes("ms-") || p.includes("multisite") || (p.includes("site-health") && p.includes("multisite"))) return "WPHX-317";
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
  if (p.includes("admin-ajax") || p.includes("ajax-actions") || p.includes("async")) return "ajax_entrypoints_and_actions";
  if (p.includes("options-") || p.endsWith("wp-admin/options.php")) return "settings_options_screens";
  if (p.includes("network/")) return "network_admin_feature_screens";
  if (p.includes("privacy") || p.includes("privacy-tools")) return "privacy_management_screens";
  if (p.includes("plugin-editor") || p.endsWith("wp-admin/network/plugins.php")) return "plugin_management_screens";
  if (p.includes("site-editor")) return "site_editor_shell";
  if (p.includes("edit-tag") || p.includes("edit-tags")) return "taxonomy_feature_screens";
  if (p.includes("edit-form") || p.endsWith("wp-admin/edit.php")) return "content_editing_screens";
  if (p.includes("credits") || p.includes("about") || p.includes("freedoms") || p.includes("contribute")) return "about_credits_network_pages";
  if (p.includes("tools.php")) return "tools_feature_shell";
  return "admin_feature_misc";
}

function isOwnedSource(entry) {
  return entry.baseline === "wordpress-7.0.0" && entry.language === "php" && entry.kind === "runtime_source" && ownerForPath(entry.path) === "WPHX-316";
}

function isOwnedArtifact(entry) {
  return entry.baseline === "wordpress-7.0.0-distribution" && entry.language === "php" && ownerForPath(entry.path) === "WPHX-316";
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
    if (entry.kind === "function" && byGroup[group].functions.length < 160) byGroup[group].functions.push(entry.name);
    if (entry.kind === "class" && byGroup[group].classes.length < 80) byGroup[group].classes.push(entry.name);
    if (entry.kind === "method" && byGroup[group].methods.length < 180) byGroup[group].methods.push(entry.qualified_name ?? entry.name);
    if (entry.kind === "property" && byGroup[group].properties.length < 120) byGroup[group].properties.push(entry.qualified_name ?? entry.name);
  }
  return Object.fromEntries(Object.entries(byGroup).sort(([a], [b]) => a.localeCompare(b)));
}

function testMatches(path) {
  const p = path.toLowerCase();
  return (
    p.includes("tests/phpunit/tests/ajax/") ||
    p.includes("tests/phpunit/includes/testcase-ajax.php") ||
    p.includes("tests/phpunit/tests/admin/includespost.php") ||
    p.includes("tests/phpunit/tests/admin/exportwp.php") ||
    p.includes("tests/phpunit/tests/option/usersettings.php") ||
    p.includes("tests/phpunit/tests/option/wpusersettings.php") ||
    p.includes("tests/phpunit/tests/menu/wpajax") ||
    p.includes("tests/e2e/specs/edit-posts.test.js") ||
    p.includes("tests/e2e/specs/empty-trash-restore-trashed-posts.test.js") ||
    p.includes("tests/performance/specs/admin.test.js")
  );
}

function semanticHandoffPath(path) {
  const p = stripSrc(path).toLowerCase();
  return p.startsWith("wp-admin/") && ownerForPath(path) !== "WPHX-316" && (
    p.includes("admin-post") ||
    p.includes("ajax") ||
    p.includes("async") ||
    p.includes("edit") ||
    p.includes("post") ||
    p.includes("comment") ||
    p.includes("term") ||
    p.includes("options") ||
    p.includes("tools") ||
    p.includes("privacy") ||
    p.includes("upload") ||
    p.includes("media") ||
    p.includes("theme") ||
    p.includes("customize") ||
    p.includes("user") ||
    p.includes("update") ||
    p.includes("install") ||
    p.includes("network/")
  );
}

function handoffReason(owner) {
  if (owner === "WPHX-306") return "Admin user/profile/application-password behavior depends on auth, capabilities, nonces, sessions, and user metadata owned by WPHX-306.";
  if (owner === "WPHX-307") return "Admin post/revision/admin-post shells expose feature screens, but post storage, metadata, statuses, and WP_Query semantics remain WPHX-307.";
  if (owner === "WPHX-308") return "Admin comment/term shells expose feature screens, but comment, taxonomy, and term semantics remain WPHX-308.";
  if (owner === "WPHX-310") return "Customizer, theme, widget, nav-menu, and site-editor-adjacent behavior remains theme/customizer ownership.";
  if (owner === "WPHX-313") return "Media/upload/filesystem admin flows depend on image and filesystem behavior owned by WPHX-313.";
  if (owner === "WPHX-315") return "Common admin chrome, menu, screen, and list-table primitives are prerequisites owned by WPHX-315.";
  if (owner === "WPHX-317") return "Multisite/network state and network list tables remain WPHX-317 even when reached through admin routes.";
  if (owner === "WPHX-319") return "Updater, installer, upgrader, maintenance, and recovery flows remain WPHX-319.";
  return "This admin-adjacent path belongs to a neighboring source domain and is a handoff, not WPHX-316 ownership.";
}

function handoffCandidates(entries) {
  return entries
    .filter((entry) => semanticHandoffPath(entry.path))
    .map((entry) => ({ path: entry.path, owner: ownerForPath(entry.path), reason: handoffReason(ownerForPath(entry.path)) }))
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, 220);
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    if (readFileSync(path, "utf8") !== content) throw new Error(`${path} is stale; run npm run wp:core:wphx-316-admin-feature-ajax-surface`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

const allSource = readJsonl(SOURCE).filter((entry) => entry.baseline === "wordpress-7.0.0" && entry.language === "php" && entry.kind === "runtime_source");
const source = allSource.filter(isOwnedSource);
const artifacts = readJsonl(ARTIFACTS).filter(isOwnedArtifact);
const tests = readJsonl(TESTS).filter((entry) => entry.baseline === "wordpress-7.0.0" && testMatches(entry.path));
const abi = readJson(ABI);
const firstPartyClosure = readJson(FIRST_PARTY_CLOSURE);
const sourcePaths = new Set(source.map((entry) => entry.path));
const abiEntries = abi.entries.filter((entry) => sourcePaths.has(entry.path));
const classEntries = abiEntries.filter((entry) => entry.kind === "class");
const namedClasses = classEntries.filter((entry) => !entry.flags?.anonymous).map((entry) => entry.qualified_name ?? entry.name).sort();
const referenceFunctions = abiEntries.filter((entry) => entry.kind === "function" && entry.parameters?.some((parameter) => parameter.by_reference));
const variadicFunctions = abiEntries.filter((entry) => entry.kind === "function" && entry.parameters?.some((parameter) => parameter.variadic));
const conditionalFunctions = abiEntries.filter((entry) => entry.kind === "function" && entry.declaration_timing !== "top_level");
const closureOwner = firstPartyClosure.coverage.owner_coverage["WPHX-316"];
const upstreamCheckout = {
  path: "../wordpress-develop",
  expected_source_prefix: "src/wp-admin",
  head: git(["rev-parse", "HEAD"], "../wordpress-develop"),
  status_short: git(["status", "--short"], "../wordpress-develop").split("\n").filter(Boolean)
};
const validationFailures = [];

if (!closureOwner) validationFailures.push("WPHX-316 is missing from WPHX-322 owner coverage");
if (closureOwner && source.length !== closureOwner.source_count) validationFailures.push(`source count mismatch with WPHX-322: ${source.length} != ${closureOwner.source_count}`);
if (closureOwner && artifacts.length !== closureOwner.artifact_count) validationFailures.push(`artifact count mismatch with WPHX-322: ${artifacts.length} != ${closureOwner.artifact_count}`);
if (upstreamCheckout.head !== "26b68024931348d267b70e2a29910e1320d0094f") validationFailures.push(`unexpected ../wordpress-develop HEAD: ${upstreamCheckout.head}`);

const manifest = {
  schema: "wphx.wp-core-admin-feature-ajax-surface.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  inputs: {
    source_inventory: inputRecord(SOURCE),
    artifact_provenance: inputRecord(ARTIFACTS),
    test_inventory: inputRecord(TESTS),
    php_abi: inputRecord(ABI),
    first_party_closure: inputRecord(FIRST_PARTY_CLOSURE),
    admin_common_surface: inputRecord(ADMIN_COMMON_SURFACE),
    upstream_checkout: upstreamCheckout
  },
  scope: {
    owner: "WPHX-316",
    included:
      "C1 WordPress 7.0 PHP source and distribution artifacts classified to admin feature screens, AJAX entrypoints/actions, settings/options screens, selected network feature pages, privacy management screens, plugin management screens, taxonomy/content edit screens, tools pages, and the site-editor/admin shell by the WPHX-322 owner rules.",
    cross_domain_notes: [
      { owner: "WPHX-315", reason: "WPHX-316 builds on admin common chrome, current screen, menu, notice, and list-table primitives rather than replacing them." },
      { owner: "WPHX-306", reason: "User/profile/application-password behavior, nonces, capabilities, and sessions remain auth-domain ownership." },
      { owner: "WPHX-307/WPHX-308", reason: "Admin post/comment/term screens are feature shells over post, taxonomy, and comment semantics owned by their source domains." },
      { owner: "WPHX-310/WPHX-314/WPHX-400", reason: "Site editor, customization, block-editor, and browser/editor package behavior require theme, block, and browser/Gutenberg evidence before installed claims." },
      { owner: "WPHX-313/WPHX-319", reason: "Media/upload and update/installer feature screens remain separate source-domain and distribution gates." },
      { owner: "WPHX-317", reason: "Network-admin state and multisite behavior remain WPHX-317 even when WPHX-316 inventories route shells." }
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
      functions_with_reference_parameters: referenceFunctions.map((entry) => entry.qualified_name ?? entry.name),
      variadic_functions: variadicFunctions.map((entry) => entry.qualified_name ?? entry.name),
      conditional_functions: conditionalFunctions.map((entry) => entry.qualified_name ?? entry.name)
    },
    test_paths: tests.map((entry) => entry.path).sort()
  },
  evidence_plan: {
    first_haxe_candidate:
      "A typed admin feature/AJAX adapter-contract model for request action routing, nonce/capability guard intent, JSON/XML/HTML response shape, settings-screen routing, and feature-screen output phase boundaries.",
    required_next_fixtures: [
      "admin-ajax action routing, wp_die/JSON response, and nonce/capability guard fixture",
      "admin-post action routing and redirect/notice intent handoff fixture with WPHX-307 ownership noted",
      "settings/options screen registration and form submission oracle fixture",
      "post/comment/term feature-screen route and action-state fixture over copied oracle PHP",
      "privacy management AJAX/export/erase feature-screen fixture coordinated with WPHX-312/WPHX-315",
      "selected upstream PHPUnit ajax/admin feature ratchet groups",
      "installed-style admin feature/AJAX package gate with database/browser blockers recorded"
    ],
    claim:
      "This surface manifest bounds WPHX-316 and names fixture gates. It does not claim public PHP replacement, Haxe-owned runtime logic, AJAX behavior parity, installed admin parity, database-backed state, browser/editor behavior, or generated original-path adapters."
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
  manifest_id: "ownership:wp-core/admin-feature-ajax-surface",
  issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
  unit: {
    kind: "surface_inventory",
    name: "admin feature screens, admin AJAX, settings screens, and feature-route shells",
    area: "wp-admin/admin-ajax.php wp-admin/includes/ajax-actions.php wp-admin/options-*.php wp-admin/edit*.php wp-admin/network/*",
    public_contract:
      "This slice inventories admin feature/AJAX runtime boundaries and fixture targets. It does not claim migrated runtime behavior, AJAX response parity, installed admin parity, or public PHP ABI replacement."
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
      "Promote bounded admin feature/AJAX decisions to typed Haxe adapter contracts, then later to typed Adapter IR/original-path PHP with AJAX response, admin-post, settings screen, feature-screen, installed admin, and upstream PHPUnit/e2e evidence."
  },
  owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
  generated_paths: [OUT, OWNERSHIP, RECEIPT],
  verification: {
    oracle_commands: [
      "npm run wp:core:wphx-316-admin-feature-ajax-surface",
      "npm run wp:core:wphx-316-admin-feature-ajax-surface:check",
      "npm run receipts:validate"
    ],
    receipt_refs: ["receipt:wphx-316-01-admin-feature-ajax-surface"],
    manifest_digest: sha256(manifestText)
  }
};
const ownershipText = JSON.stringify(ownership, null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-316-01-admin-feature-ajax-surface",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "admin feature/AJAX surface inventory" },
    { path: OWNERSHIP, role: "admin feature/AJAX surface ownership manifest" },
    { path: RUNNER, role: "deterministic surface generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-316-admin-feature-ajax-surface",
    "npm run wp:core:wphx-316-admin-feature-ajax-surface:check"
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
