#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.17.2",
  external_ref: "WPHX-310.02",
  title: "WPHX-310.02 — Add theme/template adapter-contract candidate"
};
const RECORDED_AT = "2026-06-27T00:00:00.000Z";
const HXML = "fixtures/wp-core/theme-template-adapter-contract-candidate.hxml";
const OUT_ROOT = "build/wp-core/wphx-310-02";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const ENTRY = `${HAXE_OUT}/index.php`;
const PRIOR_MANIFEST = "manifests/wp-core/wphx-310-01-themes-template-surface.v1.json";
const OUT = "manifests/wp-core/wphx-310-02-theme-template-adapter-contract-candidate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-310-02-theme-template-adapter-contract-candidate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-310-02-theme-template-adapter-contract-candidate.v1.json";
const RUNNER = "tools/wp-core/run-theme-template-adapter-contract-candidate.mjs";
const HAXE_SOURCES = [
  HXML,
  "src/wphx/wp/themes/ThemeTemplateAdapterContract.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/ThemeTemplateAdapterContractCandidateEntry.hx"
];

const EXPECTED = {
  "support:enabled": "theme_support_enabled",
  "support:core-default": "theme_support_core_default",
  "support:block-theme": "theme_support_block_theme",
  "support:disabled": "theme_support_disabled",
  "support:unknown": "theme_support_unknown",
  "theme-json:user": "theme_json_user",
  "theme-json:theme": "theme_json_theme",
  "theme-json:supports": "theme_json_theme_supports",
  "theme-json:core": "theme_json_core",
  "theme-json:empty": "theme_json_empty",
  "template:block": "template_block_theme",
  "template:front-page": "template_front_page",
  "template:home": "template_home",
  "template:single": "template_single",
  "template:page": "template_page",
  "template:archive": "template_archive",
  "template:search": "template_search",
  "template:404": "template_404",
  "template:fallback": "template_classic_fallback",
  "customizer:denied": "customizer_denied",
  "customizer:switch": "customizer_theme_switch",
  "customizer:locked": "customizer_changeset_locked",
  "customizer:preview": "customizer_preview",
  "customizer:controls": "customizer_controls",
  "nav:block": "nav_menu_block",
  "nav:assigned": "nav_menu_assigned_location",
  "nav:fallback": "nav_menu_fallback_pages",
  "nav:unassigned": "nav_menu_unassigned",
  "widget:invalid": "widget_invalid_sidebar",
  "widget:empty": "widget_empty_sidebar",
  "widget:selective-refresh": "widget_selective_refresh",
  "widget:block-editor": "widget_block_editor",
  "widget:classic": "widget_classic",
  "hook:support": "theme_support_hooks",
  "hook:theme-json": "theme_json_hooks",
  "hook:template": "template_hierarchy_hooks",
  "hook:customizer": "customizer_hooks",
  "hook:nav-menu": "nav_menu_hooks",
  "hook:widget": "widget_sidebar_hooks",
  "hook:failed": "theme_template_no_hooks"
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
  return data
    .toString("utf8")
    .replace(/#(?:[A-Za-z]:)?[^#\r\n]*[/\\](std[/\\][^\r\n]*)/g, "#$HAXE_STD_PATH/$1");
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
      throw new Error(`${path} is stale; run npm run wp:core:wphx-310-theme-template-adapter-contract-candidate`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/theme-template-adapter-contract-candidate",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "haxe_adapter_contract",
      name: "theme support, theme JSON, template hierarchy, customizer, nav menu, widget, and hook intent",
      area:
        "wp-includes/theme.php wp-includes/class-wp-theme.php wp-includes/class-wp-theme-json.php wp-includes/class-wp-theme-json-resolver.php wp-includes/template.php wp-includes/block-template.php wp-includes/customize wp-includes/nav-menu.php wp-includes/widgets.php",
      public_contract:
        "Haxe owns the first typed theme/template adapter-contract decision model. Public PHP ABI replacement, theme filesystem scanning, theme.json merge behavior, customizer transactions, rendered templates, admin screens, and installed theme behavior are not claimed in this slice."
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
        "Install these decisions through typed Adapter IR/original-path generation and pass PHP-authored theme support, theme.json/global styles, template hierarchy, customizer, nav-menu, widget, installed HTTP/admin, and upstream PHPUnit oracle fixtures before claiming public PHP ABI ownership."
    },
    owned_paths: HAXE_SOURCES.concat([RUNNER, OUT, OWNERSHIP, RECEIPT]),
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-310-theme-template-adapter-contract-candidate",
        "npm run wp:core:wphx-310-theme-template-adapter-contract-candidate:check",
        "npm run haxe:escape-hatches:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-310-02-theme-template-adapter-contract-candidate"],
      manifest_digest: manifestSha
    },
    notes:
      "This is a PHP-hosted Haxe candidate. It adds no native provider, no handwritten production PHP shell, and no public WordPress file replacement."
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
  schema: "wphx.wp-core-theme-template-adapter-contract-candidate.v1",
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
    candidate_kind: "haxe_theme_template_adapter_contract_candidate",
    promoted_contracts: [
      "theme-support resolution intent for explicit support, core defaults, block-theme implied features, disabled features, and unknown requests",
      "theme.json/global-styles provenance intent for user, theme, theme-support-derived, core, and empty data",
      "template hierarchy intent for block templates, front page, home, single, page, archive, search, 404, and classic fallback",
      "customizer routing intent for capability denial, theme switch, changeset lock, preview, and controls routes",
      "nav-menu routing intent for block themes, assigned locations, page fallback, and unassigned menus",
      "widget/sidebar routing intent for invalid, empty, selective-refresh, block-editor, and classic widget paths",
      "theme-support, theme-json/global-styles, template, customizer, nav-menu, and widget hook intent"
    ],
    upstream_reference_functions: [
      "add_theme_support",
      "current_theme_supports",
      "WP_Theme_JSON_Resolver::get_merged_data",
      "wp_get_global_styles",
      "get_query_template",
      "locate_template",
      "resolve_block_template",
      "WP_Customize_Manager",
      "wp_nav_menu",
      "dynamic_sidebar"
    ],
    expected_observations: EXPECTED,
    public_abi_policy: {
      public_php_replacement_claimed: false,
      handwritten_php_shells_added: false,
      adapter_contract_owner: "haxe_typed",
      semantic_owner: "haxe",
      native_provider_claimed: false,
      removal_gate:
        "Install through typed Adapter IR/original-path generation and run differential PHP theme/template/customizer/widget fixtures before claiming public PHP ABI ownership."
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
      id: "php-authored-theme-template-oracle-fixtures-not-yet-built",
      owner: ISSUE.external_ref,
      detail:
        "The candidate has not yet run through vanilla WordPress and packaged candidate public theme-support, theme.json/global styles, template hierarchy, customizer, nav-menu, widget, HTTP output, admin, hook, and cache observations."
    },
    {
      id: "public-php-adapter-not-yet-generated",
      owner: ISSUE.external_ref,
      detail:
        "No original-path wp-includes/theme.php, class-wp-theme.php, class-wp-theme-json.php, template.php, block-template.php, customize, nav-menu, or widgets adapter is claimed in this slice."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    candidate_kind: "haxe_theme_template_adapter_contract_candidate",
    promoted_contracts: 7,
    runtime_runs: 1,
    observation_count: Object.keys(EXPECTED).length,
    source_escape_audit_passed: sourceEscapeAuditPassed,
    public_php_replacement_claimed: false
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-310-02-theme-template-adapter-contract-candidate",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "theme/template Haxe semantic/adapter-contract candidate manifest" },
    { path: OWNERSHIP, role: "ADR-004-aware ownership manifest for theme/template Haxe candidate" },
    { path: "src/wphx/wp/themes/ThemeTemplateAdapterContract.hx", role: "typed Haxe theme/template semantic and adapter-contract model" },
    { path: RUNNER, role: "candidate generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-310-theme-template-adapter-contract-candidate",
    "npm run wp:core:wphx-310-theme-template-adapter-contract-candidate:check",
    "npm run haxe:escape-hatches:check",
    "npm run receipts:validate"
  ],
  related_receipts: ["receipt:wphx-310-01-themes-template-surface"],
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
