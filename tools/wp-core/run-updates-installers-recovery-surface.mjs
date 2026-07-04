#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-580c",
  external_ref: "WPHX-319.01",
  title: "WPHX-319.01 - Inventory updates installers recovery surface"
};
const RECORDED_AT = "2026-07-04T15:00:00.000Z";
const WP_REF = "26b68024931348d267b70e2a29910e1320d0094f";
const SOURCE = "manifests/source-inventory.jsonl";
const ARTIFACTS = "manifests/artifact-provenance.jsonl";
const TESTS = "manifests/test-inventory.jsonl";
const ABI = "manifests/php-abi/wordpress-7.0-core-abi.v1.json";
const FIRST_PARTY_CLOSURE = "manifests/wp-core/wphx-322-php-first-party-manifest-closure.v1.json";
const OUT = "manifests/wp-core/wphx-319-01-updates-installers-recovery-surface.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-319-01-updates-installers-recovery-surface.v1.json";
const RECEIPT = "receipts/wp-core/wphx-319-01-updates-installers-recovery-surface.v1.json";
const RUNNER = "tools/wp-core/run-updates-installers-recovery-surface.mjs";

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
  if (
    p.includes("user") ||
    p.includes("capabilities") ||
    p.includes("session-token") ||
    p.includes("pluggable") ||
    p.includes("auth") ||
    p.includes("application-password") ||
    p.includes("wp-login.php") ||
    p.includes("wp-activate.php")
  )
    return "WPHX-306";
  if (p.includes("post") || p.includes("revision") || p.includes("class-wp-query") || p.includes("query.php") || p.includes("meta.php")) return "WPHX-307";
  if (p.includes("taxonomy") || p.includes("term") || p.includes("comment")) return "WPHX-308";
  if (
    p.includes("rewrite") ||
    p.includes("canonical") ||
    p.includes("link-template") ||
    p.includes("template-loader") ||
    p.includes("class-wp.php") ||
    p.includes("wp-blog-header.php") ||
    p.includes("index.php")
  )
    return "WPHX-309";
  if (
    p.includes("theme") ||
    p.includes("customize") ||
    p.includes("template") ||
    p.includes("theme-compat") ||
    p.includes("class-wp-theme") ||
    p.includes("global-styles") ||
    p.includes("script-modules")
  )
    return "WPHX-310";
  if (
    p.includes("http") ||
    p.includes("requests") ||
    p.includes("cron") ||
    p.includes("mail") ||
    p.includes("feed") ||
    p.includes("embed") ||
    p.includes("oembed") ||
    p.includes("wp-cron.php") ||
    p.includes("wp-mail.php") ||
    p.includes("wp-links-opml.php") ||
    p.includes("wp-trackback.php")
  )
    return "WPHX-312";
  if (
    p.includes("media") ||
    p.includes("image") ||
    p.includes("upload") ||
    p.includes("filesystem") ||
    p.includes("file.php") ||
    p.includes("class-wp-filesystem") ||
    p.includes("wp-content/index.php")
  )
    return "WPHX-313";
  if (p.includes("block") || p.includes("interactivity") || p.includes("style-engine") || p.includes("html-api") || p.includes("fonts") || p.includes("assets")) return "WPHX-314";
  if (p.startsWith("wp-admin/includes/class-wp-list-table") || p.includes("list-table") || p.includes("screen") || p.includes("menu") || p.includes("admin-header") || p.includes("admin-footer")) return "WPHX-315";
  if (p.startsWith("wp-admin/")) {
    if (p.includes("update") || p.includes("install") || p.includes("upgrader") || p.includes("maintenance") || p.includes("recovery")) return "WPHX-319";
    if (p.includes("media") || p.includes("upload")) return "WPHX-313";
    if (p.includes("theme") || p.includes("customize")) return "WPHX-310";
    if (
      p.includes("ajax") ||
      p.includes("async") ||
      p.includes("network/") ||
      p.includes("options-") ||
      p.includes("tools") ||
      p.includes("edit") ||
      p.includes("post") ||
      p.includes("term") ||
      p.includes("comment")
    )
      return "WPHX-316";
    return "WPHX-315";
  }
  if (p.includes("xmlrpc") || p.includes("deprecated") || p.includes("legacy") || p.includes("class-ixr")) return "WPHX-318";
  if (p.includes("update") || p.includes("install") || p.includes("upgrader") || p.includes("recovery") || p.includes("maintenance")) return "WPHX-319";
  if (p.includes("option") || p.includes("transient") || p.includes("cache")) return "WPHX-304";
  if (p.includes("formatting") || p.includes("kses") || p.includes("sanitize") || p.includes("class-wp-error") || p.includes("error") || p.includes("deprecated")) return "WPHX-303";
  if (p.includes("plugin") || p.includes("class-wp-hook") || p.includes("wp-settings.php")) return "WPHX-302";
  if (
    p === "wp-config-sample.php" ||
    p === "wp-tests-config-sample.php" ||
    p.includes("load.php") ||
    p.includes("default-constants") ||
    p.includes("version.php") ||
    p.includes("compat.php") ||
    p.includes("wp-load.php") ||
    p.includes("wp-settings.php")
  )
    return "WPHX-301";
  return "WPHX-301";
}

function groupForPath(path) {
  const p = stripSrc(path).toLowerCase();
  if (p === "wp-includes/update.php" || p === "wp-admin/includes/update.php") return "update_api";
  if (p.includes("update-core") || p.includes("class-core-upgrader")) return "core_update";
  if (p.includes("plugin-install") || p.includes("class-plugin") || p.includes("plugin-upgrader")) return "plugin_install_update";
  if (p.includes("language-pack") || p.includes("translation-install")) return "language_pack_update";
  if (p.includes("automatic-updater") || p.includes("site-health-auto-updates") || p.includes("automatic-upgrader")) return "automatic_updates_site_health";
  if (p.includes("class-wp-upgrader") || p.includes("upgrader-skin") || p.includes("bulk-upgrader")) return "upgrader_base_skins";
  if (p.includes("install.php") || p.includes("install-helper")) return "install_bootstrap";
  if (p.includes("network/")) return "network_update_routes";
  if (p.includes("recovery-mode")) return "recovery_mode";
  return "updates_installers_misc";
}

function sourceRole(path) {
  const group = groupForPath(path);
  if (group === "update_api") return "Core/plugin/theme/translation update transient API, update checks, and update UI helper surface";
  if (group === "core_update") return "Core update route/helper/upgrader surface, package unpack/copy semantics, and update-core screen behavior";
  if (group === "plugin_install_update") return "Plugin install/update route, installer helper, plugin upgrader, and plugin upgrader skin surface";
  if (group === "language_pack_update") return "Language pack and translation install/update helper surface";
  if (group === "automatic_updates_site_health") return "Automatic updater orchestration and Site Health auto-update test surface";
  if (group === "upgrader_base_skins") return "Base upgrader and upgrader skin output/error/feedback surface";
  if (group === "install_bootstrap") return "Install bootstrap and install helper behavior";
  if (group === "network_update_routes") return "Network admin update/install route wrappers";
  if (group === "recovery_mode") return "Recovery mode cookie/key/link orchestration and shutdown/error-protection surface";
  return "Updates/installers/recovery runtime source";
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
    if (entry.kind === "function" && groups[group].functions.length < 220) groups[group].functions.push(entry.name);
    if (entry.kind === "class" && groups[group].classes.length < 80) groups[group].classes.push(entry.qualified_name ?? entry.name);
    if (entry.kind === "method" && groups[group].methods.length < 260) groups[group].methods.push(entry.qualified_name ?? entry.name);
    if (entry.kind === "property" && groups[group].properties.length < 160) groups[group].properties.push(entry.qualified_name ?? entry.name);
    if (entry.kind === "constant" && groups[group].constants.length < 80) groups[group].constants.push(entry.qualified_name ?? entry.name);
  }
  return Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)));
}

function testMatches(path) {
  const p = path.toLowerCase();
  return (
    p === "tests/e2e/specs/install.test.js" ||
    p === "tests/e2e/specs/maintenance-mode.test.js" ||
    p === "tests/qunit/fixtures/updates.js" ||
    p === "tests/phpunit/includes/install.php" ||
    p === "tests/phpunit/tests/admin/wpautomaticupdater.php" ||
    p === "tests/phpunit/tests/admin/wpupgrader.php" ||
    p === "tests/phpunit/tests/admin/wpplugininstalllisttable.php" ||
    p === "tests/phpunit/tests/admin/wpthemeinstalllisttable.php" ||
    p === "tests/phpunit/tests/ajax/wpajaxupdateplugin.php" ||
    p === "tests/phpunit/tests/ajax/wpajaxupdatetheme.php" ||
    p === "tests/phpunit/tests/error-protection/wprecoverymodecookieservice.php" ||
    p === "tests/phpunit/tests/error-protection/wprecoverymodekeyservice.php" ||
    p === "tests/phpunit/data/themedir1/update-uri-theme/index.php"
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

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    if (readFileSync(path, "utf8") !== content) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-319-updates-installers-recovery-surface`);
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
const source = allSource
  .filter((entry) => entry.baseline === "wordpress-7.0.0" && entry.language === "php" && entry.kind === "runtime_source" && ownerForPath(entry.path) === "WPHX-319")
  .sort((a, b) => a.path.localeCompare(b.path));
const artifacts = allArtifacts
  .filter((entry) => entry.baseline === "wordpress-7.0.0-distribution" && entry.language === "php" && ownerForPath(entry.path) === "WPHX-319")
  .sort((a, b) => a.path.localeCompare(b.path));
const sourcePaths = new Set(source.map((entry) => entry.path));
const abiEntries = abi.entries.filter((entry) => sourcePaths.has(entry.path));
const closureOwner = firstPartyClosure.coverage.owner_coverage["WPHX-319"];
const upstreamCheckout = {
  path: "../wordpress-develop",
  head: git(["rev-parse", "HEAD"], "../wordpress-develop"),
  status_short: git(["status", "--short"], "../wordpress-develop").split("\n").filter(Boolean)
};
const validationFailures = [];

if (!closureOwner) validationFailures.push("WPHX-319 is missing from WPHX-322 owner coverage");
if (closureOwner && source.length !== closureOwner.source_count) validationFailures.push(`source count mismatch with WPHX-322: ${source.length} != ${closureOwner.source_count}`);
if (closureOwner && artifacts.length !== closureOwner.artifact_count) validationFailures.push(`artifact count mismatch with WPHX-322: ${artifacts.length} != ${closureOwner.artifact_count}`);
if (upstreamCheckout.head !== WP_REF) validationFailures.push(`unexpected ../wordpress-develop HEAD: ${upstreamCheckout.head}`);

const manifest = {
  schema: "wphx.wp-core-updates-installers-recovery-surface.v1",
  issue: ISSUE.external_ref,
  beads_issue: ISSUE.id,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  baseline: {
    wordpress_ref: WP_REF,
    upstream_checkout: upstreamCheckout,
    source_inventory: inputRecord(SOURCE),
    artifact_provenance: inputRecord(ARTIFACTS),
    test_inventory: inputRecord(TESTS),
    php_abi: inputRecord(ABI),
    first_party_closure: inputRecord(FIRST_PARTY_CLOSURE)
  },
  scope: {
    owner: "WPHX-319",
    domain: "Updates, installers, upgrader, recovery mode",
    source_count: source.length,
    artifact_count: artifacts.length,
    abi_entry_count: abiEntries.length,
    related_test_count: tests.length,
    source_groups: summarizeByGroup(source),
    artifact_groups: summarizeByGroup(artifacts),
    symbol_groups: symbolSummary(abiEntries)
  },
  source_units: source.map(sourceRecord),
  distribution_artifacts: artifacts.map(artifactRecord),
  abi_entries: abiEntries.map((entry) => ({
    path: entry.path,
    group: groupForPath(entry.path),
    kind: entry.kind,
    name: entry.name,
    qualified_name: entry.qualified_name ?? null,
    visibility: entry.visibility ?? null,
    static: entry.static ?? null,
    signature: entry.signature ?? null
  })),
  related_tests: tests.map((entry) => ({
    path: entry.path,
    language: entry.language,
    framework: entry.framework,
    source_unit: entry.sourceUnit
  })),
  cross_domain_handoffs: [
    {
      owner: "WPHX-304",
      reason: "Update transients, options, object cache, and site transient semantics remain options/cache ownership."
    },
    {
      owner: "WPHX-306",
      reason: "Capabilities, current-user state, install credentials, recovery cookies, keys, login flows, and nonces remain users/auth ownership."
    },
    {
      owner: "WPHX-310/WPHX-315/WPHX-316",
      reason: "Theme upgrader classes, install list tables, admin screens, AJAX update actions, notices, menus, and screen chrome remain neighboring admin/theme domains where WPHX-322 assigned them."
    },
    {
      owner: "WPHX-312/WPHX-313",
      reason: "HTTP package downloads, cron scheduling, mail notifications, filesystem credentials, unzip/copy/delete, uploads, and file validation remain HTTP/cron/mail and media/filesystem ownership."
    },
    {
      owner: "WPHX-317/WPHX-320/WPHX-323",
      reason: "Network admin wrappers, default theme files, bundled plugin/vendor package boundaries, and preserved external libraries remain separate gates."
    }
  ],
  next_gates: [
    "Typed Haxe adapter-contract candidate for updater/upgrader decision states, skins, filesystem/download handoffs, maintenance mode, install bootstrap, and recovery-mode orchestration.",
    "Copied-oracle fixtures for selected upgrader skin feedback/output, maintenance mode toggling, recovery cookie/key/link behavior, update transient shaping, and install helper behavior.",
    "Selected upstream PHPUnit ratchet groups for automatic updater/upgrader/recovery tests, plus explicit handoffs for admin AJAX/list-table/theme tests.",
    "Installed/browser gate declarations for install flow, maintenance mode, plugin/theme/core update screens, package download/unpack/copy/delete, and recovery-mode email/link flows.",
    "Generated original-path adapter or overlay manifest evidence before any candidate package diverges from copied upstream PHP."
  ],
  non_claims: [
    "No generated public PHP replacement for update, install, upgrader, recovery-mode, Site Health, or maintenance files.",
    "No Haxe-owned update/installer/upgrader/recovery runtime implementation or installed update behavior.",
    "No filesystem, package download, unzip/copy/delete, cron, mail, HTTP, database, nonce/session/capability, plugin/theme activation, or recovery email/link parity.",
    "No browser/e2e execution, selected upstream PHPUnit pass/pass evidence, generated overlay, or generated original-path adapter ownership.",
    "Theme upgrader/list-table/admin AJAX surfaces assigned to neighboring domains are recorded as handoffs, not claimed WPHX-319 ownership."
  ],
  validation_result: {
    status: validationFailures.length === 0 ? "passed" : "failed",
    failures: validationFailures,
    source_count_matches_wphx_322: closureOwner ? source.length === closureOwner.source_count : false,
    artifact_count_matches_wphx_322: closureOwner ? artifacts.length === closureOwner.artifact_count : false,
    upstream_ref_matches_lock: upstreamCheckout.head === WP_REF
  }
};

const ownership = {
  schema: "wphx.ownership-surface.v1",
  issue: ISSUE.external_ref,
  beads_issue: ISSUE.id,
  generated_at: RECORDED_AT,
  owner: "WPHX-319",
  domain: "Updates, installers, upgrader, recovery mode",
  source_count: source.length,
  artifact_count: artifacts.length,
  abi_entry_count: abiEntries.length,
  related_test_count: tests.length,
  ownership_state: "surface_inventory_only",
  source_authority: "../wordpress-develop",
  candidate_implementation_state: "not_started",
  generated_public_php_replacement_claimed: false,
  haxe_runtime_ownership_claimed: false,
  installed_update_parity_claimed: false,
  durable_original_path_adapter_claimed: false,
  removal_gate:
    "Promote beyond inventory only through typed Haxe adapter contracts, copied-oracle fixtures, selected upstream PHPUnit/browser/database gates, and generated original-path adapter or overlay evidence.",
  groups: manifest.scope.source_groups,
  non_claims: manifest.non_claims
};

const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-319-01-updates-installers-recovery-surface",
  issue: {
    id: ISSUE.id,
    external_ref: ISSUE.external_ref,
    title: ISSUE.title
  },
  recorded_at: RECORDED_AT,
  command: `node ${RUNNER}`,
  evidence_class: "surface_inventory",
  artifact_scope: "wp_core_updates_installers_recovery",
  behavior_parity_claimed: false,
  artifacts: [
    { path: OUT, role: "updates/installers/recovery surface manifest", sha256: sha256(JSON.stringify(manifest, null, 2) + "\n") },
    { path: OWNERSHIP, role: "ownership/non-claim manifest", sha256: sha256(JSON.stringify(ownership, null, 2) + "\n") },
    inputRecord(RUNNER)
  ],
  verification_commands: [
    "npm run wp:core:wphx-319-updates-installers-recovery-surface",
    "npm run wp:core:wphx-319-updates-installers-recovery-surface:check",
    "npm run receipts:validate",
    "npm run beads:validate"
  ],
  validation_result: manifest.validation_result,
  summary:
    "Inventories the bounded WPHX-319 updates/installers/upgrader/recovery surface: 32 runtime source files, 32 distribution artifacts, ABI entries, related tests, WPHX-322 reconciliation, cross-domain handoffs, next gates, and explicit non-claims.",
  non_claims: manifest.non_claims
};

const outputs = [
  [OUT, `${JSON.stringify(manifest, null, 2)}\n`],
  [OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`],
  [RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`]
];

try {
  for (const [path, content] of outputs) writeOrCheck(path, content);
} catch (error) {
  console.error(JSON.stringify({ status: "failed", error: error.message }, null, 2));
  process.exit(1);
}

if (validationFailures.length > 0) {
  console.error(JSON.stringify({ status: "failed", failures: validationFailures }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      source_count: source.length,
      artifact_count: artifacts.length,
      abi_entry_count: abiEntries.length,
      related_test_count: tests.length,
      output: OUT,
      ownership: OWNERSHIP,
      receipt: RECEIPT
    },
    null,
    2
  )
);
