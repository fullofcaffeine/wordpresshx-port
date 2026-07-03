#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.21.2",
  external_ref: "WPHX-315.02",
  title: "WPHX-315.02 - Add admin common list-table adapter contract candidate"
};
const RECORDED_AT = "2026-07-03T15:00:00.000Z";
const HXML = "fixtures/wp-core/admin-common-list-table-adapter-contract-candidate.hxml";
const OUT_ROOT = "build/wp-core/wphx-315-02";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const ENTRY = `${HAXE_OUT}/index.php`;
const PRIOR_MANIFEST = "manifests/wp-core/wphx-315-01-admin-common-list-table-surface.v1.json";
const OUT = "manifests/wp-core/wphx-315-02-admin-common-list-table-adapter-contract-candidate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-315-02-admin-common-list-table-adapter-contract-candidate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-315-02-admin-common-list-table-adapter-contract-candidate.v1.json";
const RUNNER = "tools/wp-core/run-admin-common-list-table-adapter-contract-candidate.mjs";
const HAXE_SOURCES = [
  HXML,
  "src/wphx/wp/admin/AdminCommonListTableAdapterContract.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/AdminCommonListTableAdapterContractCandidateEntry.hx"
];

const EXPECTED = {
  "request:denied": "admin_request_access_denied",
  "request:network": "admin_request_network_admin",
  "request:user": "admin_request_user_admin",
  "request:action": "admin_request_do_action",
  "request:screen": "admin_request_screen_bound",
  "request:dashboard": "admin_request_dashboard",
  "screen:missing": "screen_missing",
  "screen:list-table": "screen_list_table",
  "screen:options": "screen_options",
  "screen:help": "screen_help",
  "screen:current": "screen_current",
  "table:empty": "list_table_empty",
  "table:bulk": "list_table_bulk_action",
  "table:row": "list_table_row_action",
  "table:page": "list_table_page_clamped",
  "table:hidden": "list_table_hidden_columns",
  "table:search": "list_table_search_filter",
  "table:display": "list_table_display",
  "menu:capability": "menu_capability_hidden",
  "menu:duplicate": "menu_duplicate_slug",
  "menu:orphan": "menu_orphan_submenu",
  "menu:submenu": "menu_submenu_registered",
  "menu:reorder": "menu_position_reordered",
  "menu:top": "menu_top_registered",
  "notice:suppressed": "notice_suppressed",
  "notice:stored": "notice_stored",
  "notice:dismissible": "notice_dismissible",
  "notice:escaped": "notice_escaped",
  "notice:success": "notice_success",
  "notice:warning": "notice_warning",
  "notice:error": "notice_error",
  "notice:info": "notice_info",
  "guard:capability": "guard_capability_denied",
  "guard:nonce-missing": "guard_nonce_missing",
  "guard:nonce-failed": "guard_nonce_failed",
  "guard:hook": "guard_hook_short_circuit",
  "guard:ready": "guard_ready",
  "output:header": "output_header",
  "output:notices": "output_notice_stack",
  "output:list-table": "output_list_table",
  "output:footer": "output_footer",
  "output:complete": "output_complete"
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
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function inputRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
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

function writeOrCheck(path, contents) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing`);
    const current = readFileSync(path, "utf8");
    if (current !== contents) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-315-admin-common-list-table-adapter-contract-candidate`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/admin-common-list-table-adapter-contract-candidate",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "haxe_adapter_contract",
      name: "admin request, screen, list-table, menu, notice, guard, and output decisions",
      area:
        "wp-admin/admin.php wp-admin/includes/class-wp-screen.php wp-admin/includes/class-wp-list-table.php wp-admin/includes/menu.php wp-admin/includes/template.php wp-admin/menu.php wp-admin/menu-header.php",
      public_contract:
        "Haxe owns a typed WPHX-315 admin common/list-table adapter-contract decision model. Public PHP ABI replacement, admin feature screens, admin Ajax, full WP_Screen/WP_List_Table ownership, installed admin behavior, and browser/editor behavior are not claimed in this slice."
    },
    ownership_state: "haxe_parity_candidate",
    ownership_axes: {
      semantic_owner: "haxe",
      adapter_contract_owner: "haxe_typed",
      emission_strategy: "stock_haxe_php_private_impl",
      execution_provider: "haxe_php",
      compatibility_evidence: "targeted_semantic_parity"
    },
    bridge: {
      exists: true,
      kind: "adapter-contract-candidate-without-public-php-installation",
      removal_gate:
        "Install these decisions through typed Adapter IR/original-path generation and pass PHP-authored admin request, WP_Screen, WP_List_Table, menu, notice/output, nonce/capability, selected upstream PHPUnit/e2e, and installed admin common/list-table fixtures before claiming public PHP ABI ownership."
    },
    owned_paths: HAXE_SOURCES.concat([RUNNER, OUT, OWNERSHIP, RECEIPT]),
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-315-admin-common-list-table-adapter-contract-candidate",
        "npm run wp:core:wphx-315-admin-common-list-table-adapter-contract-candidate:check",
        "npm run haxe:escape-hatches:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-315-02-admin-common-list-table-adapter-contract-candidate"],
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
  schema: "wphx.wp-core-admin-common-list-table-adapter-contract-candidate.v1",
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
    candidate_kind: "haxe_admin_common_list_table_adapter_contract_candidate",
    promoted_contracts: [
      "admin request/bootstrap intent for denied access, network admin, user admin, action dispatch, screen-bound, and dashboard routes",
      "current-screen intent for missing screens, list-table screens, screen options, help tabs, and ordinary current screens",
      "list-table intent for empty tables, bulk actions, row actions, clamped pages, hidden columns, search filters, and ordinary display",
      "admin menu intent for capability-hidden entries, duplicate slugs, orphan submenus, registered submenus, position reordering, and top-level entries",
      "admin notice intent for suppression, stored settings errors, dismissible notices, escaped output, and success/warning/error/info types",
      "capability, nonce, and hook guard intent before admin callbacks mutate state",
      "common admin output phase intent for header, notices, list-table body, footer, and complete responses"
    ],
    upstream_reference_functions: [
      "wp-admin/admin.php",
      "set_current_screen",
      "get_current_screen",
      "WP_Screen::add_help_tab",
      "WP_Screen::add_option",
      "WP_List_Table::display",
      "WP_List_Table::current_action",
      "WP_List_Table::pagination",
      "add_menu_page",
      "add_submenu_page",
      "_wp_menu_output",
      "wp_admin_notice",
      "wp_get_admin_notice",
      "settings_errors",
      "check_admin_referer",
      "current_user_can"
    ],
    expected_observations: EXPECTED,
    public_abi_policy: {
      public_php_replacement_claimed: false,
      handwritten_php_shells_added: false,
      adapter_contract_owner: "haxe_typed",
      semantic_owner: "haxe",
      installed_admin_parity_claimed: false,
      browser_or_editor_ownership_claimed: false,
      removal_gate:
        "Install through typed Adapter IR/original-path generation and run differential PHP admin request, screen, list-table, menu, notice/output, nonce/capability, selected upstream PHPUnit/e2e, and installed admin fixtures before claiming public PHP ABI ownership."
    },
    source_escape_audits: haxeSourceAudits
  },
  toolchain: {
    haxe_version: command("haxe", ["--version"]),
    locked_haxe_version: lock.tools.haxe.version,
    php_cli_profile: command("php", ["-r", "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;"])
  },
  build: {
    generated_file_hash_policy: "normalize_haxe_std_source_map_paths",
    generated_haxe_files: generatedFiles,
    php_lint: generatedPhpLintRecords(generatedFiles)
  },
  run: {
    command: `php ${ENTRY}`,
    raw_output_sha256: sha256(output),
    observations,
    matches_expected: matchesExpected
  },
  remaining_gaps: [
    {
      id: "php-authored-admin-common-list-table-oracle-fixtures-not-yet-built",
      owner: ISSUE.external_ref,
      detail:
        "The candidate has not yet run through vanilla WordPress and packaged candidate admin request/bootstrap, WP_Screen, WP_List_Table, menu/submenu, admin notice/output, nonce/capability, selected upstream PHPUnit/e2e, or installed admin observations."
    },
    {
      id: "public-php-adapter-not-yet-generated",
      owner: ISSUE.external_ref,
      detail:
        "No original-path admin bootstrap, WP_Screen, WP_List_Table, menu, notice/output, feature-screen, or admin Ajax adapter is claimed in this slice."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    candidate_kind: "haxe_admin_common_list_table_adapter_contract_candidate",
    promoted_contracts: 7,
    runtime_runs: 1,
    observation_count: Object.keys(EXPECTED).length,
    source_escape_audit_passed: sourceEscapeAuditPassed,
    public_php_replacement_claimed: false,
    installed_admin_parity_claimed: false,
    browser_or_editor_ownership_claimed: false
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-315-02-admin-common-list-table-adapter-contract-candidate",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "admin common/list-table Haxe semantic/adapter-contract candidate manifest" },
    { path: OWNERSHIP, role: "ADR-004-aware ownership manifest for admin common/list-table Haxe candidate" },
    {
      path: "src/wphx/wp/admin/AdminCommonListTableAdapterContract.hx",
      role: "typed Haxe admin common/list-table semantic and adapter-contract model"
    },
    { path: RUNNER, role: "candidate generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-315-admin-common-list-table-adapter-contract-candidate",
    "npm run wp:core:wphx-315-admin-common-list-table-adapter-contract-candidate:check",
    "npm run haxe:escape-hatches:check",
    "npm run receipts:validate"
  ],
  related_receipts: ["receipt:wphx-315-01-admin-common-list-table-surface"],
  validation_result: manifest.validation_result
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

console.log(
  JSON.stringify(
    {
      status: "passed",
      output: OUT,
      ownership: OWNERSHIP,
      receipt: RECEIPT,
      observations: Object.keys(EXPECTED).length
    },
    null,
    2
  )
);
