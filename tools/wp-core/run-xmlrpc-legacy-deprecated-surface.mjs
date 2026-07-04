#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-t848",
  external_ref: "WPHX-318.01",
  title: "WPHX-318.01 - Inventory XML-RPC legacy deprecated API surface"
};
const RECORDED_AT = "2026-07-04T11:00:00.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const SOURCE = "manifests/source-inventory.jsonl";
const ARTIFACTS = "manifests/artifact-provenance.jsonl";
const TESTS = "manifests/test-inventory.jsonl";
const ABI = "manifests/php-abi/wordpress-7.0-core-abi.v1.json";
const FIRST_PARTY_CLOSURE = "manifests/wp-core/wphx-322-php-first-party-manifest-closure.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const OUT = "manifests/wp-core/wphx-318-01-xmlrpc-legacy-deprecated-surface.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-318-01-xmlrpc-legacy-deprecated-surface.v1.json";
const RECEIPT = "receipts/wp-core/wphx-318-01-xmlrpc-legacy-deprecated-surface.v1.json";
const RUNNER = "tools/wp-core/run-xmlrpc-legacy-deprecated-surface.mjs";

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
  if (p === "xmlrpc.php") return "xmlrpc_entrypoint";
  if (p.endsWith("class-wp-xmlrpc-server.php")) return "xmlrpc_server";
  if (p.endsWith("class-ixr.php")) return "ixr_compat_loader";
  if (p.startsWith("wp-includes/ixr/")) return "preserved_ixr_library";
  if (p === "wp-includes/deprecated.php") return "core_deprecated_api";
  if (p.startsWith("wp-content/plugins/akismet/")) return "bundled_akismet_distribution";
  if (p === "wp-content/plugins/hello.php") return "bundled_hello_plugin";
  if (p === "wp-content/plugins/index.php") return "plugin_directory_guard";
  return "xmlrpc_legacy_misc";
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
  const groups = {};
  for (const entry of entries) {
    const group = groupForPath(entry.path);
    groups[group] ??= { count: 0, functions: [], classes: [], methods: [], properties: [], constants: [] };
    groups[group].count++;
    if (entry.kind === "function" && groups[group].functions.length < 260) groups[group].functions.push(entry.name);
    if (entry.kind === "class" && groups[group].classes.length < 80) groups[group].classes.push(entry.qualified_name ?? entry.name);
    if (entry.kind === "method" && groups[group].methods.length < 180) groups[group].methods.push(entry.qualified_name ?? entry.name);
    if (entry.kind === "property" && groups[group].properties.length < 120) groups[group].properties.push(entry.qualified_name ?? entry.name);
    if (entry.kind === "constant" && groups[group].constants.length < 80) groups[group].constants.push(entry.qualified_name ?? entry.name);
  }
  return Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)));
}

function testMatches(path) {
  const p = path.toLowerCase();
  return (
    p.includes("tests/phpunit/includes/testcase-xmlrpc.php") ||
    p.includes("tests/phpunit/tests/xmlrpc/") ||
    p.includes("tests/phpunit/tests/date/xmlrpc.php") ||
    p.includes("tests/phpunit/tests/functions/xmlrpc.php") ||
    p.includes("tests/phpunit/tests/formatting/deprecatedutfencodedecode.php") ||
    p.includes("tests/phpunit/data/plugins/hello.php") ||
    p.includes("tests/e2e/specs/hello.test.js")
  );
}

function artifactRecord(entry) {
  return {
    path: entry.path,
    group: groupForPath(entry.path),
    kind: entry.kind,
    artifact: entry.artifact,
    artifact_digest: entry.artifactDigest,
    origin: entry.origin,
    migration_status: entry.migrationStatus
  };
}

function sourceRecord(entry) {
  const upstreamPath = `../wordpress-develop/${entry.path}`;
  return {
    path: entry.path,
    group: groupForPath(entry.path),
    kind: entry.kind,
    area: entry.area,
    repo: entry.repo,
    commit: entry.commit,
    inventory_status: entry.status,
    bytes: statSync(upstreamPath).size,
    sha256: sha256File(upstreamPath),
    role: sourceRole(entry.path)
  };
}

function sourceRole(path) {
  const group = groupForPath(path);
  if (group === "xmlrpc_entrypoint") return "public XML-RPC endpoint bootstrap, headers, logging helper, and wp_xmlrpc_server dispatch";
  if (group === "xmlrpc_server") return "WordPress XML-RPC method registry, auth, CRUD, media, taxonomy, option, pingback, and legacy Blogger/MetaWeblog APIs";
  if (group === "ixr_compat_loader") return "IXR compatibility loader for XML-RPC library classes preserved as a vendor boundary";
  if (group === "core_deprecated_api") return "large deprecated function surface spanning legacy posts, users, themes, links, widgets, block shims, and compatibility helpers";
  if (group === "bundled_hello_plugin") return "bundled Hello Dolly plugin source shipped with WordPress";
  if (group === "plugin_directory_guard") return "empty plugin directory index guard";
  return "legacy/XML-RPC runtime source";
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    if (readFileSync(path, "utf8") !== content) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-318-xmlrpc-legacy-deprecated-surface`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

const allSource = readJsonl(SOURCE);
const allArtifacts = readJsonl(ARTIFACTS);
const tests = readJsonl(TESTS).filter((entry) => entry.baseline === "wordpress-7.0.0" && testMatches(entry.path));
const abi = readJson(ABI);
const firstPartyClosure = readJson(FIRST_PARTY_CLOSURE);
const vendorClosure = readJson(VENDOR_CLOSURE);
const source = allSource
  .filter((entry) => entry.baseline === "wordpress-7.0.0" && entry.language === "php" && entry.kind === "runtime_source" && ownerForPath(entry.path) === "WPHX-318")
  .sort((a, b) => a.path.localeCompare(b.path));
const artifacts = allArtifacts
  .filter((entry) => entry.baseline === "wordpress-7.0.0-distribution" && entry.language === "php" && ownerForPath(entry.path) === "WPHX-318")
  .sort((a, b) => a.path.localeCompare(b.path));
const sourcePaths = new Set(source.map((entry) => entry.path));
const abiEntries = abi.entries.filter((entry) => sourcePaths.has(entry.path));
const ixrVendorSources = allSource
  .filter((entry) => entry.baseline === "wordpress-7.0.0" && entry.language === "php" && entry.path.startsWith("src/wp-includes/IXR/"))
  .sort((a, b) => a.path.localeCompare(b.path));
const ixrDistributionArtifacts = artifacts.filter((entry) => entry.path.startsWith("wp-includes/IXR/"));
const closureOwner = firstPartyClosure.coverage.owner_coverage["WPHX-318"];
const upstreamCheckout = {
  path: "../wordpress-develop",
  head: git(["rev-parse", "HEAD"], "../wordpress-develop"),
  status_short: git(["status", "--short"], "../wordpress-develop").split("\n").filter(Boolean)
};
const validationFailures = [];

if (!closureOwner) validationFailures.push("WPHX-318 is missing from WPHX-322 owner coverage");
if (closureOwner && source.length !== closureOwner.source_count) validationFailures.push(`source count mismatch with WPHX-322: ${source.length} != ${closureOwner.source_count}`);
if (closureOwner && artifacts.length !== closureOwner.artifact_count) validationFailures.push(`artifact count mismatch with WPHX-322: ${artifacts.length} != ${closureOwner.artifact_count}`);
if (upstreamCheckout.head !== WP_REF) validationFailures.push(`unexpected ../wordpress-develop HEAD: ${upstreamCheckout.head}`);
if (ixrVendorSources.length !== 10) validationFailures.push(`expected 10 IXR vendor source files, found ${ixrVendorSources.length}`);
if (ixrDistributionArtifacts.length !== 10) validationFailures.push(`expected 10 IXR distribution artifacts, found ${ixrDistributionArtifacts.length}`);

const manifest = {
  schema: "wphx.wp-core-xmlrpc-legacy-deprecated-surface.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  inputs: {
    source_inventory: inputRecord(SOURCE),
    artifact_provenance: inputRecord(ARTIFACTS),
    test_inventory: inputRecord(TESTS),
    php_abi: inputRecord(ABI),
    first_party_closure: inputRecord(FIRST_PARTY_CLOSURE),
    vendor_closure: inputRecord(VENDOR_CLOSURE),
    upstream_checkout: upstreamCheckout
  },
  scope: {
    owner: "WPHX-318",
    included:
      "C1 WordPress 7.0 PHP source and distribution artifacts classified to XML-RPC, legacy/deprecated APIs, bundled plugin compatibility files, and compatibility loaders by the WPHX-322 owner rules.",
    boundary_notes: [
      "The six runtime source files are the executable first-party surface that WPHX-318 inventories in this slice.",
      "The 45 distribution artifacts include bundled Akismet PHP files and IXR library files; this inventory records their provenance and future boundary pressure without claiming Haxe-owned Akismet or IXR runtime implementation.",
      "IXR source files under src/wp-includes/IXR are vendor_source entries preserved by WPHX-323, even though matching distribution artifacts are visible to WPHX-318 XML-RPC compatibility."
    ],
    cross_domain_handoffs: [
      { owner: "WPHX-303", reason: "Native deprecation signaling helpers, wp_die handlers, wp_trigger_error, and formatting/escaping primitives remain WPHX-303 boundaries consumed by deprecated APIs." },
      { owner: "WPHX-306", reason: "XML-RPC authentication, user/profile methods, pluggable auth, cookies, application passwords, and capabilities remain users/auth ownership." },
      { owner: "WPHX-307/WPHX-308", reason: "XML-RPC post, page, revision, comment, taxonomy, and term methods are RPC shells over post/comment/term semantics owned by those domains." },
      { owner: "WPHX-312", reason: "HTTP-backed XML-RPC clients, legacy feed wrappers, pingback transport, Snoopy, and deprecated HTTP helpers remain HTTP/feed/embed ownership or preserved-vendor boundaries." },
      { owner: "WPHX-313", reason: "XML-RPC media upload and attachment responses depend on media/upload/filesystem behavior." },
      { owner: "WPHX-317", reason: "Multisite XML-RPC blog enumeration and ms-deprecated.php remain multisite/network state handoffs." },
      { owner: "WPHX-323", reason: "IXR, Services_JSON, Snoopy, and other bundled legacy libraries remain preserved vendor/library boundaries until a separate replacement strategy exists." }
    ]
  },
  coverage: {
    source_count: source.length,
    artifact_count: artifacts.length,
    abi_entry_count: abiEntries.length,
    class_count: abiEntries.filter((entry) => entry.kind === "class").length,
    function_count: abiEntries.filter((entry) => entry.kind === "function").length,
    method_count: abiEntries.filter((entry) => entry.kind === "method").length,
    property_count: abiEntries.filter((entry) => entry.kind === "property").length,
    test_count: tests.length,
    source_units: source.map(sourceRecord),
    artifact_by_group: summarizeByGroup(artifacts),
    source_by_group: summarizeByGroup(source),
    abi_by_group: symbolSummary(abiEntries),
    related_test_paths: tests.map((entry) => entry.path).sort(),
    preserved_vendor_boundaries: {
      ixr_source_count: ixrVendorSources.length,
      ixr_distribution_artifact_count: ixrDistributionArtifacts.length,
      source_paths: ixrVendorSources.map((entry) => entry.path),
      distribution_paths: ixrDistributionArtifacts.map((entry) => entry.path),
      closure_ref: vendorClosure.id ?? "wphx-323-php-vendor-manifest-closure"
    },
    distribution_artifacts: artifacts.map(artifactRecord)
  },
  evidence_plan: {
    first_haxe_candidate:
      "A typed XML-RPC/legacy adapter-contract model for endpoint enablement, method-family routing, auth/capability guard intent, IXR request/response handoff, deprecation metadata, and bundled plugin boundary classification.",
    required_next_fixtures: [
      "xmlrpc.php endpoint bootstrap and disabled/enabled method routing oracle fixture",
      "wp_xmlrpc_server method registry, minimum-args, auth failure, and error-shape fixture",
      "IXR request/message/value serialization fixture with WPHX-323 preserved-vendor non-claims",
      "deprecated.php representative compatibility helper fixture over deprecation signaling and delegation",
      "Hello Dolly/bundled plugin provenance and activation-surface fixture or explicit WPHX-323-style preserved bundled-plugin exception",
      "selected upstream XML-RPC/deprecated PHPUnit ratchet groups",
      "installed XML-RPC HTTP route gate with database/user/auth/media/post/comment/taxonomy blockers recorded"
    ],
    claim:
      "This surface manifest bounds WPHX-318 and names fixture gates. It does not claim generated public PHP replacement, Haxe-owned XML-RPC runtime behavior, XML-RPC request/response parity, deprecated API behavior parity, installed route execution, database-backed behavior, upstream PHPUnit pass/pass, Akismet/IXR implementation ownership, or generated original-path adapters."
  },
  validation_result: {
    status: validationFailures.length === 0 ? "passed" : "failed",
    failures: validationFailures,
    source_count: source.length,
    artifact_count: artifacts.length,
    abi_entry_count: abiEntries.length,
    test_count: tests.length,
    ixr_vendor_source_count: ixrVendorSources.length
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const ownership = {
  schema: "wphx.ownership-manifest.v1",
  manifest_id: "ownership:wp-core/xmlrpc-legacy-deprecated-surface",
  issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
  unit: {
    kind: "surface_inventory",
    name: "XML-RPC, legacy APIs, deprecated APIs, and bundled compatibility surfaces",
    area: "xmlrpc.php wp-includes/class-wp-xmlrpc-server.php wp-includes/deprecated.php wp-includes/class-IXR.php wp-content/plugins/*",
    public_contract:
      "This slice inventories XML-RPC/legacy/deprecated runtime boundaries, bundled plugin distribution artifacts, preserved IXR compatibility libraries, fixture targets, and handoffs. It does not claim migrated runtime behavior, XML-RPC request/response parity, deprecated API parity, installed route execution, or public PHP ABI replacement."
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
      "Promote bounded XML-RPC/deprecated decisions to typed Haxe adapter contracts, then later to typed Adapter IR/original-path PHP with XML-RPC request/response, deprecation signaling, installed route, selected upstream PHPUnit, and database-backed behavior evidence."
  },
  owned_paths: [RUNNER, OUT, OWNERSHIP, RECEIPT],
  generated_paths: [OUT, OWNERSHIP, RECEIPT],
  verification: {
    oracle_commands: [
      "npm run wp:core:wphx-318-xmlrpc-legacy-deprecated-surface",
      "npm run wp:core:wphx-318-xmlrpc-legacy-deprecated-surface:check",
      "npm run receipts:validate"
    ],
    receipt_refs: ["receipt:wphx-318-01-xmlrpc-legacy-deprecated-surface"],
    manifest_digest: sha256(manifestText)
  }
};
const ownershipText = JSON.stringify(ownership, null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-318-01-xmlrpc-legacy-deprecated-surface",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "XML-RPC legacy/deprecated surface inventory" },
    { path: OWNERSHIP, role: "XML-RPC legacy/deprecated surface ownership manifest" },
    { path: RUNNER, role: "deterministic surface generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-318-xmlrpc-legacy-deprecated-surface",
    "npm run wp:core:wphx-318-xmlrpc-legacy-deprecated-surface:check"
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
