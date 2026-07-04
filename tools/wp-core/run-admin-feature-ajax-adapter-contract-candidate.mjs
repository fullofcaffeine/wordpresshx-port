#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-567a",
  external_ref: "WPHX-316.02",
  title: "Add admin feature AJAX adapter contract candidate"
};
const RECORDED_AT = "2026-07-04T01:15:00.000Z";
const HXML = "fixtures/wp-core/admin-feature-ajax-adapter-contract-candidate.hxml";
const OUT_ROOT = "build/wp-core/wphx-316-02";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const ENTRY = `${HAXE_OUT}/index.php`;
const PRIOR_MANIFEST = "manifests/wp-core/wphx-316-01-admin-feature-ajax-surface.v1.json";
const OUT = "manifests/wp-core/wphx-316-02-admin-feature-ajax-adapter-contract-candidate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-316-02-admin-feature-ajax-adapter-contract-candidate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-316-02-admin-feature-ajax-adapter-contract-candidate.v1.json";
const RUNNER = "tools/wp-core/run-admin-feature-ajax-adapter-contract-candidate.mjs";
const HAXE_SOURCES = [
  HXML,
  "src/wphx/wp/admin/AdminFeatureAjaxAdapterContract.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/AdminFeatureAjaxAdapterContractCandidateEntry.hx"
];

const EXPECTED = {
  "ajax:missing": "ajax_action_missing",
  "ajax:heartbeat": "ajax_heartbeat",
  "ajax:media": "ajax_media_action",
  "ajax:privileged": "ajax_privileged_action",
  "ajax:nopriv": "ajax_nopriv_action",
  "ajax:destructive": "ajax_destructive_action",
  "ajax:denied": "ajax_action_denied",
  "post:missing": "admin_post_action_missing",
  "post:capability": "admin_post_capability_denied",
  "post:method": "admin_post_non_post_method",
  "post:handler": "admin_post_handler_missing",
  "post:redirect": "admin_post_redirect",
  "post:dispatch": "admin_post_dispatch",
  "guard:capability": "feature_guard_capability_denied",
  "guard:nonce-missing": "feature_guard_nonce_missing",
  "guard:nonce-failed": "feature_guard_nonce_failed",
  "guard:locked": "feature_guard_locked",
  "guard:ready": "feature_guard_ready",
  "response:error": "ajax_response_error",
  "response:validation": "ajax_response_validation_failed",
  "response:json": "ajax_response_json",
  "response:xml": "ajax_response_xml",
  "response:no-content": "ajax_response_no_content",
  "response:html": "ajax_response_html",
  "settings:capability": "settings_capability_denied",
  "settings:network": "settings_network_options",
  "settings:render": "settings_render_form",
  "settings:save": "settings_save_options",
  "settings:idle": "settings_idle",
  "content:missing": "content_action_missing_object",
  "content:autosave": "content_action_autosave",
  "content:bulk": "content_action_bulk",
  "content:post": "content_action_post",
  "content:term": "content_action_term",
  "content:comment": "content_action_comment",
  "content:unknown": "content_action_unknown",
  "privacy:missing": "privacy_action_missing_request",
  "privacy:ajax-export": "privacy_ajax_export",
  "privacy:ajax-erase": "privacy_ajax_erase",
  "privacy:email": "privacy_email_request",
  "privacy:export": "privacy_export_screen",
  "privacy:erase": "privacy_erase_screen",
  "privacy:overview": "privacy_overview",
  "network:not-network": "network_not_network_admin",
  "network:capability": "network_capability_denied",
  "network:site": "network_site_context",
  "network:user": "network_user_context",
  "network:action": "network_action_dispatch",
  "network:dashboard": "network_dashboard"
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
      throw new Error(`${path} is stale; run npm run wp:core:wphx-316-admin-feature-ajax-adapter-contract-candidate`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/admin-feature-ajax-adapter-contract-candidate",
    issue: { id: ISSUE.id, external_ref: ISSUE.external_ref },
    unit: {
      kind: "haxe_adapter_contract",
      name: "admin Ajax/action routing, guard, response, settings, content, privacy, and network-admin decisions",
      area:
        "wp-admin/admin-ajax.php wp-admin/admin-post.php wp-admin/includes/ajax-actions.php wp-admin/options-*.php wp-admin/edit*.php wp-admin/network/*",
      public_contract:
        "Haxe owns a typed WPHX-316 adapter-contract decision model. Public PHP ABI replacement, live Ajax response parity, database-backed installed admin behavior, browser/editor behavior, and route file execution are not claimed in this slice."
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
        "Install these decisions through typed Adapter IR/original-path generation and pass admin-ajax, admin-post, settings screen, content/taxonomy/privacy/network feature, nonce/capability, selected upstream PHPUnit/e2e, and installed admin fixtures before claiming public PHP ABI ownership or installed admin parity."
    },
    owned_paths: HAXE_SOURCES.concat([RUNNER, OUT, OWNERSHIP, RECEIPT]),
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-316-admin-feature-ajax-adapter-contract-candidate",
        "npm run wp:core:wphx-316-admin-feature-ajax-adapter-contract-candidate:check",
        "npm run haxe:escape-hatches:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-316-02-admin-feature-ajax-adapter-contract-candidate"],
      manifest_digest: manifestSha
    },
    notes:
      "This is a PHP-hosted Haxe candidate with module-level Haxe functions. It adds no handwritten production PHP shell and no public WordPress file replacement."
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

const manifest = {
  schema: "wphx.wp-core-admin-feature-ajax-adapter-contract-candidate.v1",
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
    candidate_kind: "haxe_admin_feature_ajax_adapter_contract_candidate",
    promoted_contracts: [
      "admin-ajax action intent for missing actions, heartbeat, media actions, privileged/nopriv hooks, destructive actions, and denied actions",
      "admin-post action intent for missing actions, capability denial, non-POST methods, missing handlers, redirects, and dispatch",
      "shared feature guard intent for capability denial, missing/failed nonces, locks, and ready state",
      "Ajax response-family intent for error, validation failure, JSON, XML, no-content, and HTML responses",
      "settings/options screen intent for capability denial, network options, render form, save options, and idle screens",
      "content feature action intent for missing objects, autosave, bulk actions, post, term, comment, and unknown object types",
      "privacy export/erase intent for missing requests, Ajax export/erase, email, screen export/erase, and overview",
      "network-admin route intent for non-network requests, capability denial, site/user context, action dispatch, and dashboard"
    ],
    observations,
    expected: EXPECTED,
    observation_count: Object.keys(observations).length,
    generated_files: generatedFiles,
    generated_php_lint: generatedPhpLintRecords(generatedFiles),
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
    installed_admin_parity_claimed: false,
    ajax_response_parity_claimed: false,
    browser_editor_behavior_claimed: false,
    database_backed_state_claimed: false,
    generated_original_path_adapter_claimed: false
  },
  non_claims: [
    "Does not replace wp-admin/admin-ajax.php, wp-admin/admin-post.php, wp-admin/includes/ajax-actions.php, settings screens, feature screens, or network admin route files.",
    "Does not execute WordPress bootstrap, nonce/capability APIs, hooks, wp_die, JSON/XML response helpers, redirects, database writes, list tables, or browser/editor behavior.",
    "Does not claim installed admin parity, upstream PHPUnit pass/pass parity, public PHP ABI replacement, or durable original-path adapter ownership."
  ],
  validation_result: {
    status: "passed",
    matches_expected: matchesExpected,
    observation_count: Object.keys(observations).length,
    generated_file_count: generatedFiles.length,
    generated_php_lint_count: generatedPhpLintRecords(generatedFiles).length,
    source_escape_audit_passed: sourceEscapeAuditPassed
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const ownershipText = JSON.stringify(ownershipManifest(sha256(manifestText)), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-316-02-admin-feature-ajax-adapter-contract-candidate",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "admin feature/AJAX adapter-contract candidate manifest" },
    { path: OWNERSHIP, role: "admin feature/AJAX adapter-contract candidate ownership manifest" },
    { path: RUNNER, role: "deterministic Haxe candidate generator/check runner" },
    { path: "src/wphx/wp/admin/AdminFeatureAjaxAdapterContract.hx", role: "typed Haxe adapter-contract source" },
    { path: "fixtures/wp-core/src/wphx/fixtures/wp/core/AdminFeatureAjaxAdapterContractCandidateEntry.hx", role: "executable stock-Haxe PHP probe" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-316-admin-feature-ajax-adapter-contract-candidate",
    "npm run wp:core:wphx-316-admin-feature-ajax-adapter-contract-candidate:check",
    "npm run haxe:escape-hatches:check"
  ],
  validation_result: manifest.validation_result,
  manifest_sha256: sha256(manifestText),
  ownership_sha256: sha256(ownershipText),
  related_receipts: ["receipt:wphx-316-01-admin-feature-ajax-surface"]
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
