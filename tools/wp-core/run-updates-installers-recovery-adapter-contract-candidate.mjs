#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-pp5t",
  external_ref: "WPHX-319.02",
  title: "WPHX-319.02 - Add updates installers recovery adapter-contract candidate"
};
const RECORDED_AT = "2026-07-04T17:00:00.000Z";
const HXML = "fixtures/wp-core/updates-installers-recovery-adapter-contract-candidate.hxml";
const OUT_ROOT = "build/wp-core/wphx-319-02";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const ENTRY = `${HAXE_OUT}/index.php`;
const PRIOR_MANIFEST = "manifests/wp-core/wphx-319-01-updates-installers-recovery-surface.v1.json";
const OUT = "manifests/wp-core/wphx-319-02-updates-installers-recovery-adapter-contract-candidate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-319-02-updates-installers-recovery-adapter-contract-candidate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-319-02-updates-installers-recovery-adapter-contract-candidate.v1.json";
const RUNNER = "tools/wp-core/run-updates-installers-recovery-adapter-contract-candidate.mjs";
const HAXE_SOURCES = [
  HXML,
  "src/wphx/wp/updates/UpdatesInstallersRecoveryAdapterContract.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/UpdatesInstallersRecoveryAdapterContractCandidateEntry.hx"
];

const EXPECTED = {
  "update-check:disabled": "update_check_disabled",
  "update-check:transient": "update_check_transient_hit",
  "update-check:remote-blocked": "update_check_remote_blocked",
  "update-check:force": "update_check_force_remote",
  "update-check:remote": "update_check_remote_allowed",
  "core:none": "core_update_none",
  "core:minor": "core_update_minor",
  "core:major": "core_update_major",
  "core:reinstall": "core_update_reinstall",
  "core:rollback": "core_update_rollback",
  "plugin:missing-slug": "plugin_action_missing_slug",
  "plugin:capability": "plugin_action_capability_denied",
  "plugin:nonce": "plugin_action_nonce_failed",
  "plugin:filesystem": "plugin_action_filesystem_credentials",
  "plugin:install": "plugin_action_install",
  "plugin:update": "plugin_action_update",
  "plugin:delete": "plugin_action_delete",
  "language:no-locale": "language_update_no_locale",
  "language:current": "language_update_already_current",
  "language:download": "language_update_download",
  "language:activate": "language_update_activate",
  "skin:header": "upgrader_skin_header",
  "skin:feedback": "upgrader_skin_feedback",
  "skin:error": "upgrader_skin_error",
  "skin:bulk-footer": "upgrader_skin_bulk_footer",
  "skin:ajax": "upgrader_skin_ajax_response",
  "automatic:disabled": "automatic_update_disabled",
  "automatic:lock": "automatic_update_lock_held",
  "automatic:filesystem": "automatic_update_filesystem_denied",
  "automatic:core-minor": "automatic_update_core_minor",
  "automatic:extension": "automatic_update_extension",
  "automatic:ok": "site_health_automatic_updates_ok",
  "site-health:ok": "site_health_automatic_updates_ok",
  "site-health:warning": "site_health_automatic_updates_warning",
  "install:config": "install_bootstrap_config_missing",
  "install:db": "install_bootstrap_db_unavailable",
  "install:admin": "install_bootstrap_admin_required",
  "install:ready": "install_bootstrap_ready",
  "network:not-network": "network_update_not_network_admin",
  "network:capability": "network_update_capability_denied",
  "network:core": "network_update_core",
  "network:plugin": "network_update_plugin",
  "network:dashboard": "network_update_dashboard",
  "recovery-cookie:missing": "recovery_cookie_missing",
  "recovery-cookie:invalid": "recovery_cookie_invalid",
  "recovery-cookie:expired": "recovery_cookie_expired",
  "recovery-cookie:valid": "recovery_cookie_valid",
  "recovery-key:missing": "recovery_key_missing",
  "recovery-key:rate": "recovery_key_rate_limited",
  "recovery-key:mismatch": "recovery_key_mismatch",
  "recovery-key:expired": "recovery_key_expired",
  "recovery-key:valid": "recovery_key_valid",
  "recovery-link:email": "recovery_link_email_unavailable",
  "recovery-link:storage": "recovery_link_token_storage_failed",
  "recovery-link:ready": "recovery_link_ready",
  "handoff:auth": "wphx_319_handoff_auth_caps_nonces",
  "handoff:http": "wphx_319_handoff_http_cron_mail",
  "handoff:filesystem": "wphx_319_handoff_filesystem_media",
  "handoff:admin": "wphx_319_handoff_admin_ui",
  "handoff:multisite": "wphx_319_handoff_multisite",
  "handoff:theme": "wphx_319_handoff_theme_domain",
  "handoff:vendor": "wphx_319_handoff_vendor_boundary",
  "handoff:unknown": "wphx_319_handoff_unknown"
};

function command(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 50
  }).trim();
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

function stableGeneratedContents(data) {
  return data.toString("utf8").replace(/#(?:[A-Za-z]:)?[^#\r\n]*[/\\](std[/\\][^\r\n]*)/g, "#$HAXE_STD_PATH/$1");
}

function filesUnder(root) {
  const files = [];
  function visit(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) visit(child);
      if (entry.isFile()) {
        const stableContents = stableGeneratedContents(readFileSync(child));
        files.push({
          path: relative(root, child),
          bytes: Buffer.byteLength(stableContents),
          sha256: createHash("sha256").update(stableContents).digest("hex")
        });
      }
    }
  }
  visit(root);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function sourceEscapeAudit(path) {
  const source = readFileSync(path, "utf8");
  return {
    path,
    contains_dynamic: /\bDynamic\b/.test(source),
    contains_untyped: /\buntyped\b/.test(source),
    contains_cast: /\bcast\b/.test(source),
    contains_php_syntax_code: /php\.Syntax\.code/.test(source),
    contains_raw_javascript: /\bjs\.Syntax\b/.test(source)
  };
}

function parseOutput(output) {
  const result = {};
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const separator = line.indexOf("=");
    if (separator < 0) throw new Error(`Unexpected output line: ${line}`);
    result[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return result;
}

function generatedPhpLintRecords(paths) {
  return paths
    .filter((record) => record.path.endsWith(".php"))
    .map((record) => ({
      path: `${HAXE_OUT}/${record.path}`,
      relative_path: record.path,
      sha256: `sha256:${record.sha256}`,
      php_lint: command("php", ["-l", `${HAXE_OUT}/${record.path}`])
    }));
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    if (readFileSync(path, "utf8") !== content) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-319-updates-installers-recovery-adapter-contract-candidate`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/updates-installers-recovery-adapter-contract-candidate",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "haxe_adapter_contract",
      name: "Updates, installers, upgrader, automatic update, install bootstrap, network wrapper, and recovery-mode decisions",
      area:
        "wp-admin/update.php wp-admin/update-core.php wp-admin/includes/update.php wp-admin/includes/class-wp-upgrader.php wp-admin/includes/class-wp-automatic-updater.php wp-includes/update.php wp-includes/class-wp-recovery-mode*.php",
      public_contract:
        "Haxe owns a typed WPHX-319 adapter-contract decision model. Public PHP replacement, live update/install side effects, installed route execution, recovery email/session parity, upstream PHPUnit pass/pass evidence, and generated original-path adapter ownership are not claimed in this slice."
    },
    ownership_state: "haxe_parity_candidate",
    ownership_axes: {
      semantic_owner: "haxe",
      adapter_contract_owner: "haxe_typed",
      emission_strategy: "stock_haxe_php_private_impl",
      execution_provider: "haxe_php",
      compatibility_evidence: "targeted_adapter_contract"
    },
    bridge: {
      exists: true,
      kind: "adapter-contract-candidate-without-public-php-installation",
      removal_gate:
        "Install these decisions through typed Adapter IR/original-path generation and pass update API, package download/unpack/copy/delete, filesystem credentials, admin screen/Ajax, nonce/capability/session, cron/mail/HTTP, Site Health, recovery cookie/key/link, selected upstream PHPUnit, installed route/browser/database, generated-overlay, and public PHP ABI gates before claiming WPHX-319 runtime parity or public PHP ownership."
    },
    owned_paths: HAXE_SOURCES.concat([RUNNER, OUT, OWNERSHIP, RECEIPT]),
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-319-updates-installers-recovery-adapter-contract-candidate",
        "npm run wp:core:wphx-319-updates-installers-recovery-adapter-contract-candidate:check",
        "npm run haxe:escape-hatches:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-319-02-updates-installers-recovery-adapter-contract-candidate"],
      manifest_digest: manifestSha
    },
    notes:
      "This is a PHP-hosted Haxe candidate with module-level Haxe functions. It adds no handwritten production PHP shell, no public WordPress file replacement, and no live update/recovery side-effect execution."
  };
}

const lock = JSON.parse(readFileSync("toolchain.lock.json", "utf8"));
rmSync(OUT_ROOT, { recursive: true, force: true });
command("haxe", [HXML]);

const generatedFiles = filesUnder(HAXE_OUT);
const output = command("php", [ENTRY]);
const observations = parseOutput(output);
const matchesExpected = JSON.stringify(observations) === JSON.stringify(EXPECTED);
const haxeSourceAudits = HAXE_SOURCES.filter((path) => path.endsWith(".hx")).map(sourceEscapeAudit);
const sourceEscapeAuditPassed = haxeSourceAudits.every(
  (audit) =>
    !audit.contains_dynamic &&
    !audit.contains_untyped &&
    !audit.contains_cast &&
    !audit.contains_php_syntax_code &&
    !audit.contains_raw_javascript
);

if (!matchesExpected || !sourceEscapeAuditPassed) {
  console.error(JSON.stringify({ status: "failed", matchesExpected, observations, haxeSourceAudits }, null, 2));
  process.exit(1);
}

const generatedPhpLint = generatedPhpLintRecords(generatedFiles);
const manifest = {
  schema: "wphx.wp-core-updates-installers-recovery-adapter-contract-candidate.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["targeted_semantic_parity", "generated_shape"],
  artifact_scope: "helper",
  inputs: {
    prior_manifest: inputRecord(PRIOR_MANIFEST),
    toolchain_lock: inputRecord("toolchain.lock.json"),
    hxml: inputRecord(HXML),
    haxe_sources: HAXE_SOURCES.map(inputRecord)
  },
  fixture: {
    candidate_kind: "haxe_updates_installers_recovery_adapter_contract_candidate",
    promoted_contracts: [
      "update API check intent for disabled checks, transient hits, blocked remote checks, forced checks, and remote-allowed checks",
      "core update intent for no update, minor update, major update, reinstall, and rollback routing",
      "plugin install/update/delete intent for slug, capability, nonce, filesystem credential, install, update, and delete branches",
      "language pack update intent for missing locale, already-current locale, download, and activate-after-install branches",
      "upgrader skin output phase intent for header, feedback, error, bulk footer, and Ajax response families",
      "automatic update and Site Health intent for disabled updates, locks, filesystem denial, core minor updates, extension updates, and warning/OK status",
      "install bootstrap and network update wrapper intent before config, database, admin-user, multisite, capability, and route side effects execute",
      "recovery mode cookie, key, and link guard intent before cookie serialization, option storage, session binding, mail transport, and URL generation execute",
      "cross-domain handoff intent for auth/capability/nonce, HTTP/cron/mail, filesystem/media, admin UI, multisite, theme, vendor/library, and unknown side effects"
    ],
    observations,
    expected: EXPECTED,
    observation_count: Object.keys(observations).length,
    generated_files: generatedFiles,
    generated_php_lint: generatedPhpLint,
    haxe_source_escape_audit: haxeSourceAudits,
    source_escape_audit_passed: sourceEscapeAuditPassed,
    toolchain: {
      haxe: command("haxe", ["--version"]),
      php: command("php", ["-r", "echo PHP_VERSION;"]),
      toolchain_lock_sha256: inputRecord("toolchain.lock.json").sha256,
      haxe_version_pinned: lock.haxe?.version ?? null
    }
  },
  claims: {
    semantic_parity_claimed: false,
    targeted_adapter_contract_claimed: true,
    public_php_replacement_claimed: false,
    update_installer_runtime_behavior_claimed: false,
    filesystem_side_effects_claimed: false,
    network_side_effects_claimed: false,
    database_backed_state_claimed: false,
    recovery_email_session_parity_claimed: false,
    installed_route_execution_claimed: false,
    browser_e2e_parity_claimed: false,
    upstream_phpunit_pass_pass_claimed: false,
    generated_original_path_adapter_claimed: false,
    generated_overlay_claimed: false
  },
  non_claims: [
    "Does not replace wp-admin/update.php, wp-admin/update-core.php, wp-admin/includes/update*.php, wp-admin/includes/class-wp-upgrader*.php, wp-admin/includes/class-wp-automatic-updater.php, wp-includes/update.php, or wp-includes/class-wp-recovery-mode*.php.",
    "Does not execute WordPress update HTTP requests, package download/unpack/copy/delete, filesystem credential prompts, plugin/theme activation, cron locks, Site Health checks, database writes, cookies, recovery email, redirects, admin screens, Ajax routes, or installed update/recovery routes.",
    "Does not claim update/installer/upgrader/recovery runtime parity, selected upstream PHPUnit pass/pass, browser/e2e parity, generated overlays, public PHP ABI replacement, or durable original-path adapter ownership."
  ],
  validation_result: {
    status: "passed",
    matches_expected: matchesExpected,
    observation_count: Object.keys(observations).length,
    generated_file_count: generatedFiles.length,
    generated_php_lint_count: generatedPhpLint.length,
    source_escape_audit_passed: sourceEscapeAuditPassed
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const ownershipText = JSON.stringify(ownershipManifest(sha256(manifestText)), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-319-02-updates-installers-recovery-adapter-contract-candidate",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "updates/installers/recovery adapter-contract candidate manifest" },
    { path: OWNERSHIP, role: "updates/installers/recovery adapter-contract candidate ownership manifest" },
    { path: RUNNER, role: "deterministic Haxe candidate generator/check runner" },
    { path: "src/wphx/wp/updates/UpdatesInstallersRecoveryAdapterContract.hx", role: "typed Haxe adapter-contract source" },
    {
      path: "fixtures/wp-core/src/wphx/fixtures/wp/core/UpdatesInstallersRecoveryAdapterContractCandidateEntry.hx",
      role: "executable stock-Haxe PHP probe"
    }
  ],
  verification_commands: [
    "npm run wp:core:wphx-319-updates-installers-recovery-adapter-contract-candidate",
    "npm run wp:core:wphx-319-updates-installers-recovery-adapter-contract-candidate:check",
    "npm run haxe:escape-hatches:check"
  ],
  validation_result: manifest.validation_result,
  manifest_sha256: sha256(manifestText),
  ownership_sha256: sha256(ownershipText),
  related_receipts: ["receipt:wphx-319-01-updates-installers-recovery-surface"]
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
