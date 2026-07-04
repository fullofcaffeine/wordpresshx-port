#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-ld82",
  external_ref: "WPHX-316.08",
  title: "WPHX-316.08 - Declare admin feature AJAX installed e2e gates"
};
const RECORDED_AT = "2026-07-04T07:00:00.000Z";
const RUNNER = "tools/wp-core/run-admin-feature-ajax-installed-e2e-gates.mjs";
const UPSTREAM_ROOT = "../wordpress-develop";
const OUT = "manifests/wp-core/wphx-316-08-admin-feature-ajax-installed-e2e-gates.v1.json";
const RECEIPT = "receipts/wp-core/wphx-316-08-admin-feature-ajax-installed-e2e-gates.v1.json";

const EVIDENCE_DEPENDENCIES = [
  {
    id: "wphx-316-01-surface",
    path: "manifests/wp-core/wphx-316-01-admin-feature-ajax-surface.v1.json",
    role: "admin feature/AJAX source, artifact, ABI, test, and handoff surface inventory"
  },
  {
    id: "wphx-316-02-adapter-contract",
    path: "manifests/wp-core/wphx-316-02-admin-feature-ajax-adapter-contract-candidate.v1.json",
    role: "typed Haxe adapter-contract intent for selected admin feature/AJAX decisions"
  },
  {
    id: "wphx-316-03-admin-ajax-post",
    path: "manifests/wp-core/wphx-316-03-admin-ajax-post-oracle-fixture.v1.json",
    role: "copied-oracle admin-ajax/admin-post route observations through deterministic stubs"
  },
  {
    id: "wphx-316-04-settings-options",
    path: "manifests/wp-core/wphx-316-04-settings-options-oracle-fixture.v1.json",
    role: "copied-oracle settings/options route observations through deterministic stubs"
  },
  {
    id: "wphx-316-05-taxonomy-feature-screen",
    path: "manifests/wp-core/wphx-316-05-taxonomy-feature-screen-oracle-fixture.v1.json",
    role: "copied-oracle taxonomy feature-screen route observations through deterministic stubs"
  },
  {
    id: "wphx-316-06-privacy-export-erase",
    path: "manifests/wp-core/wphx-316-06-privacy-export-erase-oracle-fixture.v1.json",
    role: "copied-oracle privacy export/erase route observations through deterministic stubs"
  },
  {
    id: "wphx-316-07-upstream-ratchets",
    path: "manifests/wp-core/wphx-316-07-admin-feature-ajax-upstream-ratchets.v1.json",
    role: "selected upstream PHPUnit ratchet scope for admin feature/AJAX tests"
  },
  {
    id: "wphx-315-05-admin-e2e-precedent",
    path: "manifests/wp-core/wphx-315-05-admin-common-list-table-upstream-ratchets.v1.json",
    role: "precedent for declaring blocked admin browser/e2e flows without execution claims"
  },
  {
    id: "upstream-lock",
    path: "upstream.lock.json",
    role: "WordPress 7.0 oracle checkout path and revision authority"
  }
];

const SELECTED_FLOWS = [
  {
    id: "admin-dashboard-quick-draft",
    file: "tests/e2e/specs/dashboard.test.js",
    tests: [
      "Allows draft to be created with Title and Content",
      "Allows draft to be created without Title or Content"
    ],
    scope:
      "dashboard admin shell, Quick Draft form submission, post creation side effects, admin notice/list handoff, and posts list-table visibility",
    wphx_316_refs: ["WPHX-316.01", "WPHX-316.02"],
    cross_domain_handoffs: ["WPHX-307", "WPHX-315"]
  },
  {
    id: "admin-edit-posts-list-table-actions",
    file: "tests/e2e/specs/edit-posts.test.js",
    tests: [
      "displays a message in the posts table when no posts are present",
      "shows a single post after one is published with the correct title",
      "allows an existing post to be edited using the Edit button",
      "allows an existing post to be quick edited using the Quick Edit button",
      "allows an existing post to be deleted using the Trash button"
    ],
    scope:
      "edit.php list-table screen, row actions, quick-edit chrome, trash action navigation, and post storage/query handoff",
    wphx_316_refs: ["WPHX-316.01", "WPHX-316.02"],
    cross_domain_handoffs: ["WPHX-307", "WPHX-315"]
  },
  {
    id: "admin-trash-restore-notices",
    file: "tests/e2e/specs/empty-trash-restore-trashed-posts.test.js",
    tests: ["Empty Trash", "Restore trash post"],
    scope: "trash view navigation, restore/delete row actions, redirected admin notices, and persistent post status transitions",
    wphx_316_refs: ["WPHX-316.01", "WPHX-316.02"],
    cross_domain_handoffs: ["WPHX-307", "WPHX-315"]
  },
  {
    id: "admin-settings-invalid-timezone",
    file: "tests/e2e/specs/general-settings-invalid-timezone.test.js",
    tests: ['Does not allow saving an invalid timezone string with "../../etc/passwd"', 'Does not allow saving an invalid timezone string with "Europe/Paris"'],
    scope:
      "options-general.php form submission, settings validation, option persistence rejection, redirected errors, and admin notice rendering",
    wphx_316_refs: ["WPHX-316.01", "WPHX-316.04"],
    cross_domain_handoffs: ["WPHX-304", "WPHX-306", "WPHX-315"]
  },
  {
    id: "admin-plugin-activation",
    file: "tests/e2e/specs/gutenberg-plugin.test.js",
    tests: ["should activate"],
    scope:
      "plugins.php activation path, plugin-management screen behavior, filesystem/plugin state, admin notices, and editor package handoff",
    wphx_316_refs: ["WPHX-316.01", "WPHX-316.07"],
    cross_domain_handoffs: ["WPHX-315", "WPHX-319", "WPHX-400"]
  },
  {
    id: "admin-media-upload-failure-dismissal",
    file: "tests/e2e/specs/media-upload.test.js",
    tests: ["Test dismissing failed upload works correctly"],
    scope:
      "upload.php/media modal route handoff, failed upload UI state, admin AJAX/media request behavior, and dismissal persistence",
    wphx_316_refs: ["WPHX-316.01", "WPHX-316.02"],
    cross_domain_handoffs: ["WPHX-313", "WPHX-315", "WPHX-400"]
  },
  {
    id: "admin-profile-application-passwords",
    file: "tests/e2e/specs/profile/applications-passwords.test.js",
    tests: [
      "should correctly create a new application password",
      "should correctly revoke a single application password",
      "should correctly revoke all the application passwords"
    ],
    scope:
      "profile.php application password UI, admin AJAX/REST handoff, user capability/session state, nonce behavior, and persistent user-meta updates",
    wphx_316_refs: ["WPHX-316.01", "WPHX-316.02", "WPHX-316.07"],
    cross_domain_handoffs: ["WPHX-306", "WPHX-311", "WPHX-315"]
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
  if (!existsSync(path)) throw new Error(`Missing upstream e2e spec: ${path}`);
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

  const upstreamFiles = [...new Set(SELECTED_FLOWS.map((flow) => flow.file))].map(upstreamRecord);
  const sourceByRelativePath = new Map(upstreamFiles.map((record) => [record.relative_path, record]));
  const flows = SELECTED_FLOWS.map((flow) => ({
    ...flow,
    upstream_spec: sourceByRelativePath.get(flow.file),
    provisioning_status: "blocked",
    classification: "blocked_no_wphx_316_installed_admin_e2e_runner",
    blockers: [
      "No WPHX-316 installed admin browser/e2e runner exists yet.",
      "No generated candidate overlay manifest exists for the selected admin feature/AJAX public PHP paths.",
      "No database-backed installed candidate package with real user/session/capability/nonce state is provisioned for this domain.",
      "No Playwright/browser evidence has executed the selected upstream WordPress e2e specs against an oracle/candidate pair."
    ]
  }));

  const manifest = {
    schema_version: 1,
    issue: ISSUE.external_ref,
    beads_issue: ISSUE.id,
    title: ISSUE.title,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "installed_browser_e2e_gate_declaration",
    artifact_scope: "selected_upstream_e2e_scope",
    behavior_parity_claimed: false,
    browser_e2e_execution_claimed: false,
    installed_wordpress_route_execution_claimed: false,
    generated_public_php_replacement_claimed: false,
    haxe_owned_admin_runtime_claimed: false,
    candidate_generated_overlay_claimed: false,
    selected_gate_scope_declared: true,
    selected_flow_count: flows.length,
    selected_upstream_spec_count: upstreamFiles.length,
    upstream_source_authority: {
      path: UPSTREAM_ROOT,
      role: "read-only WordPress 7.0 oracle checkout",
      spec_root: "tests/e2e/specs"
    },
    inputs: {
      runner: inputRecord(RUNNER),
      evidence_dependencies: EVIDENCE_DEPENDENCIES.map((dependency) => ({
        ...dependency,
        ...inputRecord(dependency.path)
      })),
      upstream_e2e_specs: upstreamFiles
    },
    selected_installed_e2e_flows: flows,
    future_runner_requirements: [
      "Provision oracle and candidate installed WordPress roots with identical database seeds, admin users, salts, cookies, plugins, uploads, and rewrite configuration.",
      "Dispatch selected flows through real wp-admin/admin-ajax.php/admin-post.php/admin.php/admin-header.php/admin-footer.php bootstrap paths, not deterministic bridge routers.",
      "Require a non-empty generated candidate overlay manifest before any candidate package file differs from copied upstream PHP.",
      "Run the selected upstream WordPress Playwright e2e specs or a manifest-linked subset against both oracle and candidate packages.",
      "Record browser DOM/URL/network observations, screenshots or traces where useful, database diff expectations, PHP logs, and candidate overlay hashes.",
      "Preserve cross-domain ownership for posts/query, options/cache, users/auth/nonces, REST, admin common/list-table, media/upload, updates/plugins, editor/browser packages, and multisite state."
    ],
    non_claims: [
      "This artifact declares WPHX-316 installed/browser gate scope only; it does not execute a browser, Playwright, or installed WordPress route.",
      "No generated public PHP replacement for admin AJAX, admin-post, settings/options, taxonomy, privacy, profile, plugin, media, or feature-screen files is claimed.",
      "No Haxe-owned admin feature/AJAX runtime logic, database-backed installed admin state, real nonce/session/capability behavior, or plugin/media/profile implementation ownership is claimed.",
      "No broad behavior parity, complete upstream admin suite parity, installed admin parity, browser/editor ownership, generated overlay, or generated original-path adapter ownership is claimed.",
      "The selected upstream e2e specs are future gates and blocker evidence; their presence and hashes are not pass/pass execution evidence."
    ],
    validation_result: {
      status: "passed",
      selected_flow_count: flows.length,
      selected_upstream_spec_count: upstreamFiles.length,
      e2e_provisioning_status: "blocked",
      behavior_parity_claimed: false,
      browser_e2e_execution_claimed: false,
      installed_wordpress_route_execution_claimed: false,
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
      upstream_e2e_specs: upstreamFiles.map((record) => record.relative_path),
      evidence_dependencies: EVIDENCE_DEPENDENCIES.map((dependency) => dependency.path)
    },
    summary:
      "Declares seven selected WPHX-316 installed/browser admin feature and AJAX e2e gates over seven upstream WordPress specs, records their source hashes, maps cross-domain handoffs, and leaves every selected flow blocked until a real installed admin e2e runner and generated-overlay discipline exist.",
    checks: [
      `node ${RUNNER}`,
      `node ${RUNNER} --check`,
      "npm run operations:bridge-claim-guardrails:check",
      "npm run receipts:validate",
      "npm run beads:validate"
    ],
    non_claims: manifest.non_claims
  };

  writeJson(OUT, manifest);
  writeJson(RECEIPT, receipt);
  console.log(
    JSON.stringify(
      {
        status: "passed",
        output: OUT,
        receipt: RECEIPT,
        selected_flow_count: flows.length,
        selected_upstream_spec_count: upstreamFiles.length,
        e2e_provisioning_status: "blocked"
      },
      null,
      2
    )
  );
}

main();
