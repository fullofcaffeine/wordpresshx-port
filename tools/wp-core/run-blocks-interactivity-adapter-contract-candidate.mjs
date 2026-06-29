#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-5n1",
  external_ref: "WPHX-314.02",
  title: "WPHX-314.02 - Add blocks/interactivity adapter-contract candidate"
};
const RECORDED_AT = "2026-06-29T00:00:00.000Z";
const HXML = "fixtures/wp-core/blocks-interactivity-adapter-contract-candidate.hxml";
const OUT_ROOT = "build/wp-core/wphx-314-02";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const ENTRY = `${HAXE_OUT}/index.php`;
const PRIOR_MANIFEST = "manifests/wp-core/wphx-314-01-blocks-interactivity-surface.v1.json";
const OUT = "manifests/wp-core/wphx-314-02-blocks-interactivity-adapter-contract-candidate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-314-02-blocks-interactivity-adapter-contract-candidate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-314-02-blocks-interactivity-adapter-contract-candidate.v1.json";
const RUNNER = "tools/wp-core/run-blocks-interactivity-adapter-contract-candidate.mjs";
const HAXE_SOURCES = [
  HXML,
  "src/wphx/wp/blocks/BlocksInteractivityAdapterContract.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/BlocksInteractivityAdapterContractCandidateEntry.hx"
];

const EXPECTED = {
  "parser:malformed": "block_parser_malformed_comment",
  "parser:nested": "block_parser_nested_blocks",
  "parser:serialized": "block_parser_serialized_block",
  "parser:freeform": "block_parser_freeform",
  "parser:empty": "block_parser_empty",
  "render:unregistered": "block_render_unregistered",
  "render:reusable": "block_render_reusable",
  "render:contextual": "block_render_contextual",
  "render:dynamic": "block_render_dynamic_callback",
  "render:static": "block_render_static",
  "support:full": "block_support_full_wrapper",
  "support:style": "block_support_style_attribute",
  "support:class": "block_support_class_attribute",
  "support:layout": "block_support_layout",
  "support:none": "block_support_none",
  "binding:source-missing": "block_binding_source_missing",
  "binding:unbound": "block_binding_attribute_unbound",
  "binding:pattern": "block_binding_pattern_override",
  "binding:context-missing": "block_binding_context_missing",
  "binding:resolved": "block_binding_resolved",
  "hooked:none": "block_hook_insert_none",
  "hooked:ignored": "block_hook_insert_ignored",
  "hooked:first-child": "block_hook_insert_first_child",
  "hooked:relative": "block_hook_insert_relative",
  "pattern:remote": "block_pattern_remote",
  "pattern:theme": "block_pattern_theme",
  "pattern:category": "block_pattern_category_only",
  "pattern:unregistered": "block_pattern_unregistered",
  "style:empty": "style_engine_empty",
  "style:declarations": "style_engine_declarations_only",
  "style:selector": "style_engine_selector_rule",
  "style:merge": "style_engine_stored_merge",
  "html:unsupported": "html_api_unsupported",
  "html:tag": "html_api_tag_only",
  "html:attribute": "html_api_attribute_mutation",
  "html:text": "html_api_text_replacement",
  "interactivity:disabled": "interactivity_disabled",
  "interactivity:store": "interactivity_store_only",
  "interactivity:directives": "interactivity_directives",
  "interactivity:hydration": "interactivity_hydration",
  "font:none": "font_asset_none",
  "font:collection": "font_asset_collection",
  "font:face": "font_asset_face",
  "font:admin": "font_asset_admin",
  "hook:render": "block_render_hooks",
  "hook:supports": "block_support_hooks",
  "hook:bindings": "block_binding_hooks",
  "hook:patterns": "block_pattern_hooks",
  "hook:interactivity": "block_interactivity_hooks",
  "hook:failed": "block_no_hooks"
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
      throw new Error(`${path} is stale; run npm run wp:core:wphx-314-blocks-interactivity-adapter-contract-candidate`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/blocks-interactivity-adapter-contract-candidate",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "haxe_adapter_contract",
      name: "block parser, rendering, supports, bindings, hooked blocks, patterns, style engine, HTML API, fonts/assets, and interactivity intent",
      area:
        "wp-includes/blocks.php wp-includes/blocks/ wp-includes/class-wp-block*.php wp-includes/block-*.php wp-includes/interactivity-api/ wp-includes/style-engine/ wp-includes/html-api/",
      public_contract:
        "Haxe owns the first typed WPHX-314 blocks/interactivity adapter-contract decision model. Public PHP ABI replacement, editor/browser ownership, installed block parity, and Gutenberg package ownership are not claimed in this slice."
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
        "Install these decisions through typed Adapter IR/original-path generation and pass parser, render, supports, bindings, hooked blocks, patterns, style engine, HTML API, interactivity, installed distribution, browser handoff, and upstream PHPUnit oracle fixtures before claiming public PHP ABI ownership."
    },
    owned_paths: HAXE_SOURCES.concat([RUNNER, OUT, OWNERSHIP, RECEIPT]),
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-314-blocks-interactivity-adapter-contract-candidate",
        "npm run wp:core:wphx-314-blocks-interactivity-adapter-contract-candidate:check",
        "npm run haxe:escape-hatches:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-314-02-blocks-interactivity-adapter-contract-candidate"],
      manifest_digest: manifestSha
    },
    notes:
      "This is a PHP-hosted Haxe candidate with module-level Haxe functions. It adds no browser provider, no handwritten production PHP shell, and no public WordPress file replacement."
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
  schema: "wphx.wp-core-blocks-interactivity-adapter-contract-candidate.v1",
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
    candidate_kind: "haxe_blocks_interactivity_adapter_contract_candidate",
    promoted_contracts: [
      "block parser intent for empty content, freeform content, serialized blocks, malformed block comments, and nested block trees",
      "block render intent for unregistered, static, dynamic callback, reusable, and context-dependent render routes",
      "block supports intent for layout, style attributes, class attributes, full wrapper output, and no-support routes",
      "block bindings intent for missing sources, unbound attributes, missing context, pattern overrides, and resolved values",
      "hooked block insertion intent for none, ignored, first-child, and relative insertion routes",
      "block pattern intent for unregistered, category-only, theme-provided, and remote pattern routes",
      "style engine and HTML API intent for empty/declaration/rule/merge output plus tag, attribute, text, and unsupported markup routes",
      "interactivity and font/asset intent for disabled/store/directive/hydration routes plus collection, face, and admin asset routes",
      "block render, supports, bindings, patterns, interactivity, and failure hook intent"
    ],
    upstream_reference_functions: [
      "parse_blocks",
      "serialize_blocks",
      "do_blocks",
      "render_block",
      "register_block_type",
      "wp_render_elements_support",
      "wp_render_layout_support_flag",
      "register_block_bindings_source",
      "apply_block_hooks_to_content",
      "register_block_pattern",
      "wp_style_engine_get_styles",
      "WP_HTML_Tag_Processor",
      "wp_interactivity_state",
      "wp_register_font_collection"
    ],
    expected_observations: EXPECTED,
    public_abi_policy: {
      public_php_replacement_claimed: false,
      handwritten_php_shells_added: false,
      adapter_contract_owner: "haxe_typed",
      semantic_owner: "haxe",
      browser_or_gutenberg_ownership_claimed: false,
      removal_gate:
        "Install through typed Adapter IR/original-path generation and run differential PHP block parser/render/supports/bindings/hooks/style/html/interactivity fixtures before claiming public PHP ABI ownership."
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
      id: "php-authored-block-oracle-fixtures-not-yet-built",
      owner: ISSUE.external_ref,
      detail:
        "The candidate has not yet run through vanilla WordPress and packaged candidate block parser, render, supports, bindings, hooked blocks, patterns, style engine, HTML API, interactivity, core block renderer, installed distribution, browser handoff, or upstream PHPUnit observations."
    },
    {
      id: "public-php-adapter-not-yet-generated",
      owner: ISSUE.external_ref,
      detail:
        "No original-path block parser, block render, block support, binding, hooked block, style engine, HTML API, font, asset, interactivity, or core block renderer adapter is claimed in this slice."
    }
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    candidate_kind: "haxe_blocks_interactivity_adapter_contract_candidate",
    promoted_contracts: 9,
    runtime_runs: 1,
    observation_count: Object.keys(EXPECTED).length,
    source_escape_audit_passed: sourceEscapeAuditPassed,
    public_php_replacement_claimed: false,
    browser_or_gutenberg_ownership_claimed: false
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const ownership = ownershipManifest(sha256(manifestText));
const ownershipText = JSON.stringify(ownership, null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-314-02-blocks-interactivity-adapter-contract-candidate",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "blocks/interactivity Haxe semantic/adapter-contract candidate manifest" },
    { path: OWNERSHIP, role: "ADR-004-aware ownership manifest for blocks/interactivity Haxe candidate" },
    { path: "src/wphx/wp/blocks/BlocksInteractivityAdapterContract.hx", role: "typed Haxe blocks/interactivity semantic and adapter-contract model" },
    { path: RUNNER, role: "candidate generator and check-mode validator" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-314-blocks-interactivity-adapter-contract-candidate",
    "npm run wp:core:wphx-314-blocks-interactivity-adapter-contract-candidate:check",
    "npm run haxe:escape-hatches:check",
    "npm run receipts:validate"
  ],
  related_receipts: ["receipt:wphx-314-01-blocks-interactivity-surface"],
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

console.log(JSON.stringify(manifest.validation_result, null, 2));
