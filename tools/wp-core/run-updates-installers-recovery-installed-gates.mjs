#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.24.1",
  external_ref: "WPHX-319.05",
  title: "WPHX-319.05 - Declare updates installers recovery installed browser gates"
};
const RECORDED_AT = "2026-07-04T15:15:00.000Z";
const RUNNER = "tools/wp-core/run-updates-installers-recovery-installed-gates.mjs";
const UPSTREAM_ROOT = "../wordpress-develop";
const OUT = "manifests/wp-core/wphx-319-05-updates-installers-recovery-installed-gates.v1.json";
const RECEIPT = "receipts/wp-core/wphx-319-05-updates-installers-recovery-installed-gates.v1.json";

const EVIDENCE_DEPENDENCIES = [
  {
    id: "wphx-319-01-surface",
    path: "manifests/wp-core/wphx-319-01-updates-installers-recovery-surface.v1.json",
    role: "updates/installers/upgrader/recovery source, artifact, ABI, test, and handoff surface inventory"
  },
  {
    id: "wphx-319-02-adapter-contract",
    path: "manifests/wp-core/wphx-319-02-updates-installers-recovery-adapter-contract-candidate.v1.json",
    role: "typed Haxe adapter-contract intent for selected update, upgrader, install, and recovery decisions"
  },
  {
    id: "wphx-319-03-oracle-fixture",
    path: "manifests/wp-core/wphx-319-03-updates-installers-recovery-oracle-fixture.v1.json",
    role: "copied-oracle updater/upgrader/recovery service observations through deterministic stubs"
  },
  {
    id: "wphx-319-04-upstream-ratchets",
    path: "manifests/wp-core/wphx-319-04-updates-installers-recovery-upstream-ratchets.v1.json",
    role: "selected upstream PHPUnit ratchet scope for updater, update-Ajax, and recovery service tests"
  },
  {
    id: "wphx-316-08-e2e-precedent",
    path: "manifests/wp-core/wphx-316-08-admin-feature-ajax-installed-e2e-gates.v1.json",
    role: "precedent for declaring blocked installed/browser admin e2e flows without execution claims"
  },
  {
    id: "upstream-lock",
    path: "upstream.lock.json",
    role: "WordPress 7.0 oracle checkout path and revision authority"
  }
];

const UPSTREAM_SOURCE_FILES = [
  "src/wp-admin/update-core.php",
  "src/wp-admin/update.php",
  "src/wp-admin/plugin-install.php",
  "src/wp-admin/theme-install.php",
  "src/wp-admin/includes/update.php",
  "src/wp-admin/includes/update-core.php",
  "src/wp-admin/includes/class-wp-upgrader.php",
  "src/wp-admin/includes/class-wp-upgrader-skin.php",
  "src/wp-admin/includes/class-wp-upgrader-skins.php",
  "src/wp-admin/includes/class-wp-automatic-updater.php",
  "src/wp-admin/includes/class-core-upgrader.php",
  "src/wp-admin/includes/class-plugin-upgrader.php",
  "src/wp-admin/includes/class-theme-upgrader.php",
  "src/wp-admin/includes/class-language-pack-upgrader.php",
  "src/wp-admin/includes/plugin-install.php",
  "src/wp-admin/includes/theme-install.php",
  "src/wp-admin/network/update-core.php",
  "src/wp-admin/network/update.php",
  "src/wp-includes/update.php",
  "src/wp-includes/class-wp-recovery-mode.php",
  "src/wp-includes/class-wp-recovery-mode-cookie-service.php",
  "src/wp-includes/class-wp-recovery-mode-key-service.php",
  "src/wp-includes/class-wp-recovery-mode-link-service.php",
  "src/wp-includes/class-wp-recovery-mode-email-service.php",
  "src/js/_enqueues/wp/updates.js"
];

const UPSTREAM_TEST_FILES = [
  "tests/e2e/specs/install.test.js",
  "tests/e2e/specs/gutenberg-plugin.test.js",
  "tests/phpunit/tests/admin/wpAutomaticUpdater.php",
  "tests/phpunit/tests/admin/wpUpgrader.php",
  "tests/phpunit/tests/admin/wpSiteHealth.php",
  "tests/phpunit/tests/ajax/wpAjaxUpdatePlugin.php",
  "tests/phpunit/tests/ajax/wpAjaxUpdateTheme.php",
  "tests/phpunit/tests/error-protection/wpRecoveryModeCookieService.php",
  "tests/phpunit/tests/error-protection/wpRecoveryModeKeyService.php",
  "tests/phpunit/tests/admin/wpPluginInstallListTable.php",
  "tests/phpunit/tests/admin/wpThemeInstallListTable.php"
];

const SELECTED_INSTALLED_GATES = [
  {
    id: "install-bootstrap-browser-flow",
    kind: "browser_e2e",
    upstream_refs: ["tests/e2e/specs/install.test.js"],
    scope:
      "initial install form, database bootstrap handoff, admin user creation, option seeding, redirect behavior, and installed site readiness",
    existing_evidence_refs: ["WPHX-319.01", "WPHX-319.02"],
    cross_domain_handoffs: ["WPHX-301", "WPHX-304", "WPHX-306", "WPHX-315"],
    blockers: [
      "No oracle/candidate installed roots are provisioned with isolated database state for install.php execution.",
      "No generated candidate overlay manifest exists for install or update-related public PHP paths.",
      "No Playwright/browser run compares the upstream install flow across oracle and candidate packages."
    ]
  },
  {
    id: "core-update-screen-and-package-flow",
    kind: "installed_http_admin",
    upstream_refs: [
      "src/wp-admin/update-core.php",
      "src/wp-admin/includes/update-core.php",
      "src/wp-admin/includes/class-core-upgrader.php",
      "tests/phpunit/tests/admin/wpUpgrader.php"
    ],
    scope:
      "update-core.php screen, core package download/unpack/copy/delete intent, maintenance-mode side effects, redirects, admin notices, and filesystem/database deltas",
    existing_evidence_refs: ["WPHX-319.01", "WPHX-319.02", "WPHX-319.04"],
    cross_domain_handoffs: ["WPHX-312", "WPHX-313", "WPHX-315"],
    blockers: [
      "No controlled package download/unpack/copy/delete fixture exists for installed oracle/candidate comparison.",
      "No generated original-path adapters or non-empty candidate overlay manifest exist for core update paths.",
      "No filesystem/database/PHP-log diff gate records maintenance mode, partial failure cleanup, and update result state."
    ]
  },
  {
    id: "plugin-install-update-activation-flow",
    kind: "browser_e2e",
    upstream_refs: [
      "tests/e2e/specs/gutenberg-plugin.test.js",
      "src/wp-admin/plugin-install.php",
      "src/wp-admin/update.php",
      "src/wp-admin/includes/plugin-install.php",
      "src/wp-admin/includes/class-plugin-upgrader.php",
      "tests/phpunit/tests/ajax/wpAjaxUpdatePlugin.php"
    ],
    scope:
      "plugin search/install/update/activate route family, admin update JavaScript handoff, filesystem writes, dependency checks, activation redirect/notices, and plugin state",
    existing_evidence_refs: ["WPHX-319.01", "WPHX-319.02", "WPHX-319.04"],
    cross_domain_handoffs: ["WPHX-306", "WPHX-316", "WPHX-318", "WPHX-400"],
    blockers: [
      "No installed package root exercises plugin install/update/activation with real plugin files and admin nonces.",
      "No generated overlay exists for plugin install/update public PHP paths or admin update JavaScript ownership.",
      "No browser/filesystem/database diff gate records plugin state, admin notices, and activation side effects."
    ]
  },
  {
    id: "theme-install-update-flow",
    kind: "installed_http_admin",
    upstream_refs: [
      "src/wp-admin/theme-install.php",
      "src/wp-admin/includes/theme-install.php",
      "src/wp-admin/includes/class-theme-upgrader.php",
      "tests/phpunit/tests/ajax/wpAjaxUpdateTheme.php",
      "tests/phpunit/tests/admin/wpThemeInstallListTable.php"
    ],
    scope:
      "theme install/update screens and Ajax routes, theme package filesystem writes, admin notices, current theme state, and list-table/theme preview handoffs",
    existing_evidence_refs: ["WPHX-319.01", "WPHX-319.02", "WPHX-319.04"],
    cross_domain_handoffs: ["WPHX-310", "WPHX-315", "WPHX-316", "WPHX-400"],
    blockers: [
      "No installed oracle/candidate fixture provisions theme packages, writable theme directories, and browser/admin state.",
      "No generated overlay exists for theme install/update public PHP paths.",
      "No filesystem/database/browser diff gate records theme availability, update notices, and preview/admin behavior."
    ]
  },
  {
    id: "automatic-updates-site-health-flow",
    kind: "installed_http_cron_admin",
    upstream_refs: [
      "src/wp-admin/includes/class-wp-automatic-updater.php",
      "src/wp-admin/includes/class-wp-site-health-auto-updates.php",
      "src/wp-includes/update.php",
      "tests/phpunit/tests/admin/wpAutomaticUpdater.php",
      "tests/phpunit/tests/admin/wpSiteHealth.php"
    ],
    scope:
      "automatic updater decision gates, Site Health update checks, cron/lock/options state, HTTP update transient behavior, email/reporting handoffs, and admin visibility",
    existing_evidence_refs: ["WPHX-319.01", "WPHX-319.02", "WPHX-319.04"],
    cross_domain_handoffs: ["WPHX-304", "WPHX-312", "WPHX-315"],
    blockers: [
      "No installed candidate executes automatic-update cron paths with controlled update API responses and locks.",
      "No generated overlay exists for automatic updater or Site Health update-check paths.",
      "No cron/HTTP/mail/database diff gate records lock handling, transient updates, notification behavior, and Site Health output."
    ]
  },
  {
    id: "recovery-mode-email-link-cookie-flow",
    kind: "installed_http_mail_auth",
    upstream_refs: [
      "src/wp-includes/class-wp-recovery-mode.php",
      "src/wp-includes/class-wp-recovery-mode-cookie-service.php",
      "src/wp-includes/class-wp-recovery-mode-key-service.php",
      "src/wp-includes/class-wp-recovery-mode-link-service.php",
      "src/wp-includes/class-wp-recovery-mode-email-service.php",
      "tests/phpunit/tests/error-protection/wpRecoveryModeCookieService.php",
      "tests/phpunit/tests/error-protection/wpRecoveryModeKeyService.php"
    ],
    scope:
      "fatal-error recovery email, token/key storage, login-link entry, cookie/session validation, exit behavior, admin notices, and cleanup",
    existing_evidence_refs: ["WPHX-319.01", "WPHX-319.02", "WPHX-319.03", "WPHX-319.04"],
    cross_domain_handoffs: ["WPHX-301", "WPHX-306", "WPHX-312", "WPHX-315"],
    blockers: [
      "No installed fatal-error/recovery-mode fixture captures real recovery emails, login links, cookies, and session state.",
      "No generated overlay exists for recovery-mode public PHP/class paths.",
      "No mail/auth/database/browser diff gate records key lifecycle, cookie headers, admin notices, and recovery exit behavior."
    ]
  },
  {
    id: "network-admin-update-flow",
    kind: "installed_multisite_admin",
    upstream_refs: [
      "src/wp-admin/network/update-core.php",
      "src/wp-admin/network/update.php",
      "src/wp-admin/includes/class-language-pack-upgrader.php",
      "src/wp-admin/includes/class-wp-upgrader-skins.php"
    ],
    scope:
      "network admin wrappers for core/plugin/theme/language updates, multisite capability checks, network redirects/notices, and shared updater state",
    existing_evidence_refs: ["WPHX-319.01", "WPHX-319.02"],
    cross_domain_handoffs: ["WPHX-306", "WPHX-317", "WPHX-315"],
    blockers: [
      "No multisite installed oracle/candidate roots exist for network update route execution.",
      "No generated overlay exists for network update public PHP paths.",
      "No multisite database/capability/redirect/filesystem diff gate records network update behavior."
    ]
  }
];

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

function upstreamRecord(relativePath) {
  const path = join(UPSTREAM_ROOT, relativePath);
  if (!existsSync(path)) throw new Error(`Missing upstream reference: ${path}`);
  return {
    path,
    relative_path: relativePath,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function writeJson(path, value) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run ${RUNNER}`);
    const current = readFileSync(path, "utf8");
    if (current !== body) throw new Error(`${path} is stale; run ${RUNNER}`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

function main() {
  for (const dependency of EVIDENCE_DEPENDENCIES) {
    if (!existsSync(dependency.path)) throw new Error(`Missing evidence dependency: ${dependency.path}`);
  }

  const upstreamSources = UPSTREAM_SOURCE_FILES.map(upstreamRecord);
  const upstreamTests = [...new Set(UPSTREAM_TEST_FILES)].map(upstreamRecord);
  const upstreamByPath = new Map([...upstreamSources, ...upstreamTests].map((record) => [record.relative_path, record]));
  const installedGates = SELECTED_INSTALLED_GATES.map((gate) => ({
    ...gate,
    upstream_references: gate.upstream_refs.map((path) => upstreamByPath.get(path) ?? upstreamRecord(path)),
    provisioning_status: "blocked",
    classification: "blocked_no_wphx_319_installed_update_recovery_runner",
    generated_overlay_required_before_candidate_divergence: true
  }));

  const manifest = {
    schema_version: 1,
    issue: ISSUE.external_ref,
    beads_issue: ISSUE.id,
    title: ISSUE.title,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "installed_update_recovery_gate_declaration",
    artifact_scope: "selected_installed_browser_http_admin_cron_mail_multisite_scope",
    behavior_parity_claimed: false,
    installed_update_recovery_execution_claimed: false,
    browser_e2e_execution_claimed: false,
    filesystem_network_mail_side_effects_claimed: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_update_runtime_claimed: false,
    candidate_generated_overlay_claimed: false,
    selected_gate_scope_declared: true,
    selected_installed_gate_count: installedGates.length,
    selected_upstream_source_count: upstreamSources.length,
    selected_upstream_test_count: upstreamTests.length,
    upstream_source_authority: {
      path: UPSTREAM_ROOT,
      role: "read-only WordPress 7.0 oracle checkout",
      source_roots: ["src/wp-admin", "src/wp-includes", "src/js/_enqueues"],
      test_roots: ["tests/phpunit/tests", "tests/e2e/specs"]
    },
    inputs: {
      runner: inputRecord(RUNNER),
      evidence_dependencies: EVIDENCE_DEPENDENCIES.map((dependency) => ({
        ...dependency,
        ...inputRecord(dependency.path)
      })),
      upstream_sources: upstreamSources,
      upstream_tests: upstreamTests
    },
    selected_installed_update_recovery_gates: installedGates,
    future_runner_requirements: [
      "Provision oracle and candidate installed WordPress roots with identical database seeds, users, salts, cookies, plugins, themes, uploads, filesystem permissions, cron state, mail capture, and network/multisite configuration where applicable.",
      "Dispatch selected requests through real install.php, wp-admin/update-core.php, wp-admin/update.php, plugin-install.php, theme-install.php, admin-ajax.php, recovery-mode login/admin paths, and network admin wrappers, not deterministic bridge routers.",
      "Require a non-empty generated candidate overlay manifest before any candidate package file differs from copied upstream PHP.",
      "Run selected upstream WordPress e2e specs where they exist and manifest-linked HTTP/cron/mail/filesystem probes where upstream e2e coverage is absent.",
      "Compare HTTP status, redirects, headers, DOM fragments, admin notices, PHP logs, hook traces, update transients/options, database deltas, filesystem package deltas, mail captures, and browser traces where applicable.",
      "Keep package download/network behavior behind controlled local fixtures or recorded-provider gates before live-network claims."
    ],
    cross_domain_handoffs: [
      {
        owner: "WPHX-301/WPHX-304",
        reason: "Install bootstrap, recovery bootstrap, options, transients, locks, and update state remain bootstrap/options ownership when reached by installed flows."
      },
      {
        owner: "WPHX-306",
        reason: "Users, capabilities, nonces, cookies, login links, sessions, and recovery authentication remain users/auth ownership."
      },
      {
        owner: "WPHX-310/WPHX-315/WPHX-316",
        reason: "Theme behavior, admin chrome/list tables/screens, admin Ajax, plugin-management screens, and update JavaScript UI remain neighboring admin/theme/browser surfaces."
      },
      {
        owner: "WPHX-312/WPHX-313",
        reason: "HTTP update API calls, cron, mail, package download, uploads, filesystem transports, unzip/copy/delete, and media/filesystem state remain HTTP/filesystem ownership."
      },
      {
        owner: "WPHX-317/WPHX-318/WPHX-400",
        reason: "Network-admin multisite wrappers, preserved plugin/vendor boundaries, and browser/editor package behavior remain separate gates."
      }
    ],
    non_claims: [
      "This artifact declares WPHX-319 installed/browser gate scope only; it does not execute installed WordPress routes, Playwright specs, cron, mail, package downloads, filesystem writes, or network calls.",
      "No generated public PHP replacement for update, install, upgrader, recovery-mode, Site Health, maintenance, plugin/theme install, admin Ajax, or network update files is claimed.",
      "No Haxe-owned update/installer/upgrader/recovery runtime logic, installed update/recovery behavior, live filesystem/network/database/mail side effects, browser/e2e parity, or complete upstream updates suite parity is claimed.",
      "No generated overlay, generated original-path adapter ownership, durable public PHP ownership, broad installed admin/update parity, or ecosystem/plugin/theme compatibility is claimed.",
      "The selected installed gates are future blockers and scope declarations; their source/test hashes are not pass/pass installed execution evidence."
    ],
    validation_result: {
      status: "passed",
      selected_installed_gate_count: installedGates.length,
      selected_upstream_source_count: upstreamSources.length,
      selected_upstream_test_count: upstreamTests.length,
      provisioning_status: "blocked",
      behavior_parity_claimed: false,
      installed_update_recovery_execution_claimed: false,
      browser_e2e_execution_claimed: false,
      future_runner_required: true
    }
  };

  const receipt = {
    schema_version: 1,
    issue: ISSUE.external_ref,
    beads_issue: ISSUE.id,
    title: ISSUE.title,
    generated_at: RECORDED_AT,
    status: "passed",
    generator: RUNNER,
    evidence: {
      manifest: OUT,
      surface_manifest: "manifests/wp-core/wphx-319-01-updates-installers-recovery-surface.v1.json",
      adapter_contract_manifest: "manifests/wp-core/wphx-319-02-updates-installers-recovery-adapter-contract-candidate.v1.json",
      oracle_fixture_manifest: "manifests/wp-core/wphx-319-03-updates-installers-recovery-oracle-fixture.v1.json",
      upstream_ratchets_manifest: "manifests/wp-core/wphx-319-04-updates-installers-recovery-upstream-ratchets.v1.json",
      upstream_lock: "upstream.lock.json"
    },
    summary:
      "Declares seven selected WPHX-319 installed/browser gates over install bootstrap, core update, plugin install/update/activation, theme install/update, automatic updater/Site Health, recovery-mode email/link/cookie, and network-admin update flows. Every selected gate remains blocked until real installed oracle/candidate roots, generated-overlay discipline, database/user/session/nonce state, package/filesystem/network/mail transports, and browser/HTTP diff evidence exist.",
    checks: [`node ${RUNNER}`, `node ${RUNNER} --check`, "npm run receipts:validate", "npm run beads:validate"],
    non_claims: manifest.non_claims
  };

  writeJson(OUT, manifest);
  writeJson(RECEIPT, receipt);
  console.log(
    JSON.stringify(
      {
        status: "passed",
        selected_installed_gate_count: installedGates.length,
        provisioning_status: "blocked",
        behavior_parity_claimed: false,
        installed_update_recovery_execution_claimed: false,
        output: OUT,
        receipt: RECEIPT
      },
      null,
      2
    )
  );
}

main();
