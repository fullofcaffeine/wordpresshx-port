#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const checkOnly = process.argv.includes("--check");

const ISSUE = {
  id: "wordpresshx-u87c",
  external_ref: "WPHX-315.08",
  title: "Pilot typed HXX admin PHP markup authoring"
};
const RECORDED_AT = "2026-07-03T18:00:00.000Z";
const RUNNER = "tools/wp-core/run-admin-hxx-markup-pilot.mjs";
const HAXE_HXML = "fixtures/wp-core/admin-hxx-markup-pilot.hxml";
const WPHX_HXML = "fixtures/wphx-php/admin-hxx-markup-pilot.hxml";
const OUT_ROOT = "build/wp-core/wphx-315-08";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const HAXE_ENTRY = `${HAXE_OUT}/index.php`;
const WPHX_ROOT = `${OUT_ROOT}/wphx/generated`;
const WPHX_SHELL = `${WPHX_ROOT}/wp-admin/wphx-admin-hxx-markup-pilot.php`;
const WPHX_EMISSION_MANIFEST = `${WPHX_ROOT}/wphx-php-emission.v1.json`;
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const ORACLE_SHELL = `${ORACLE_ROOT}/wp-admin/wphx-admin-hxx-markup-pilot.php`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-315-08-admin-hxx-markup-pilot.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-315-08-admin-hxx-markup-pilot.v1.json";
const RECEIPT = "receipts/wp-core/wphx-315-08-admin-hxx-markup-pilot.v1.json";
const HAXE_SOURCES = [
  HAXE_HXML,
  WPHX_HXML,
  "src/wphx/wp/admin/AdminHxxMarkupPilot.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/AdminHxxMarkupPilotEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/template/AdminHxxMarkupPilotEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/template/AdminHxxMarkupPilotScript.hx"
];

const EXPECTED_NOTICE = '<div class="notice notice-success is-dismissible"><p>Saved &amp; Ready</p></div>\n';
const EXPECTED_ROW =
  '<tr id="post-42" class="iedit author-self level-0">\n' +
  '\t<td class="title column-title has-row-actions column-primary" data-colname="Title">\n' +
  '\t\t<strong><a class="row-title" href="post.php?post=42&amp;action=edit">Hello &amp; World</a></strong>\n' +
  '\t\t<div class="row-actions"><span class="edit"><a href="post.php?post=42&amp;action=edit">Edit</a> | </span><span class="trash"><a href="post.php?post=42&amp;action=trash&amp;_wpnonce=abc123">Trash</a></span></div>\n' +
  '\t\t<button type="button" class="toggle-row"><span class="screen-reader-text">Show more details</span></button>\n' +
  "\t</td>\n" +
  "</tr>\n";
const EXPECTED_COMBINED = EXPECTED_NOTICE + EXPECTED_ROW;

const EXPECTED_SEGMENT_PLAN = {
  path: "wp-admin/wphx-admin-hxx-markup-pilot.php",
  adapter: "admin-hxx-markup-pilot",
  adoption_mode: "haxe_owned_template_unit",
  segments: ["guard", "declaration", "script", "literal_output", "template_expression", "return_exit"],
  caller_scope: [{ kind: "reads_locals", names: ["notice", "row"] }],
  include_semantics: [],
  observable_effects: [
    "guard_return",
    "typed_hxx_markup_lowering",
    "notice_markup_output",
    "list_table_row_markup_output",
    "escaped_output",
    "include_return_value"
  ],
  unsupported: []
};

const EXPECTED_FEATURES = [
  "file-segment.plan-registry",
  "hxx.typed-admin-markup-unit",
  "hxx.wordpress-escaping",
  "segment.caller-scope-local",
  "segment.declaration",
  "segment.guard",
  "segment.literal-output",
  "segment.plan-printer",
  "segment.return",
  "segment.script",
  "segment.template-expression"
];

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
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

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run npm run wp:core:wphx-315-admin-hxx-markup-pilot`);
    if (readFileSync(path, "utf8") !== content) throw new Error(`${path} is stale; run npm run wp:core:wphx-315-admin-hxx-markup-pilot`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
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

function decode(value) {
  return value.replace(/\\\\/g, "\u0000").replace(/\\n/g, "\n").replace(/\u0000/g, "\\");
}

function parseHaxeOutput(output) {
  const observations = {};
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const separator = line.indexOf("=");
    if (separator < 0) throw new Error(`Unexpected Haxe output line: ${line}`);
    observations[line.slice(0, separator)] = decode(line.slice(separator + 1));
  }
  return observations;
}

function normalizeSegmentPlan(plan) {
  return {
    path: plan.path,
    adapter: plan.adapter,
    adoption_mode: plan.adoption_mode,
    segments: plan.segments,
    caller_scope: plan.caller_scope.map((entry) => ({ kind: entry.kind, names: entry.names })),
    include_semantics: plan.include_semantics,
    observable_effects: plan.observable_effects,
    unsupported: plan.unsupported
  };
}

function assertJsonEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected ${label}:\nactual=${JSON.stringify(actual, null, 2)}\nexpected=${JSON.stringify(expected, null, 2)}`);
  }
}

function writeOracle() {
  mkdirSync(dirname(ORACLE_SHELL), { recursive: true });
  writeFileSync(
    ORACLE_SHELL,
    `<?php
if (!defined('ABSPATH')) {
\treturn 'ABSPATH_REQUIRED';
}

function wphx_oracle_hxx_escape($value) {
\treturn htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function wphx_oracle_hxx_render_notice($notice) {
\t$classes = array('notice', 'notice-' . $notice['level']);
\tif (!empty($notice['dismissible'])) {
\t\t$classes[] = 'is-dismissible';
\t}
\treturn '<div class="' . wphx_oracle_hxx_escape(implode(' ', $classes)) . '"><p>' . wphx_oracle_hxx_escape($notice['message']) . '</p></div>' . "\\n";
}

function wphx_oracle_hxx_render_row_actions($actions) {
\t$html = '';
\tforeach ($actions as $action) {
\t\t$html .= '<span class="' . wphx_oracle_hxx_escape($action['key']) . '"><a href="' . wphx_oracle_hxx_escape($action['href']) . '">' . wphx_oracle_hxx_escape($action['label']) . '</a>' . $action['separator'] . '</span>';
\t}
\treturn $html;
}

function wphx_oracle_hxx_render_list_table_row($row) {
\treturn '<tr id="post-' . wphx_oracle_hxx_escape($row['id']) . '" class="' . wphx_oracle_hxx_escape(implode(' ', $row['classes'])) . '">' . "\\n"
\t\t. "\\t" . '<td class="title column-title has-row-actions column-primary" data-colname="Title">' . "\\n"
\t\t. "\\t\\t" . '<strong><a class="row-title" href="' . wphx_oracle_hxx_escape($row['editHref']) . '">' . wphx_oracle_hxx_escape($row['title']) . '</a></strong>' . "\\n"
\t\t. "\\t\\t" . '<div class="row-actions">' . wphx_oracle_hxx_render_row_actions($row['actions']) . '</div>' . "\\n"
\t\t. "\\t\\t" . '<button type="button" class="toggle-row"><span class="screen-reader-text">Show more details</span></button>' . "\\n"
\t\t. "\\t" . '</td>' . "\\n"
\t\t. '</tr>' . "\\n";
}

echo wphx_oracle_hxx_render_notice($notice);
echo wphx_oracle_hxx_render_list_table_row($row);

return array(
\t'kind' => 'admin-hxx-markup-pilot',
\t'fragments' => 2,
\t'marker' => 'hxx:ADMIN',
);
`
  );
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
$root = rtrim($argv[1], '/\\\\');
$mode = $argv[2] ?? 'normal';
$file = $root . '/wp-admin/wphx-admin-hxx-markup-pilot.php';

$notice = array(
\t'level' => 'success',
\t'message' => 'Saved & Ready',
\t'dismissible' => true,
);
$row = array(
\t'id' => 42,
\t'title' => 'Hello & World',
\t'editHref' => 'post.php?post=42&action=edit',
\t'classes' => array('iedit', 'author-self', 'level-0'),
\t'actions' => array(
\t\tarray(
\t\t\t'key' => 'edit',
\t\t\t'label' => 'Edit',
\t\t\t'href' => 'post.php?post=42&action=edit',
\t\t\t'separator' => ' | ',
\t\t),
\t\tarray(
\t\t\t'key' => 'trash',
\t\t\t'label' => 'Trash',
\t\t\t'href' => 'post.php?post=42&action=trash&_wpnonce=abc123',
\t\t\t'separator' => '',
\t\t),
\t),
);

if ('guard' !== $mode && !defined('ABSPATH')) {
\tdefine('ABSPATH', dirname($file, 2) . '/');
}

ob_start();
$return = include $file;
$output = ob_get_clean();

echo json_encode(
\tarray(
\t\t'output' => $output,
\t\t'returnValue' => $return,
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\\n";
`
  );
}

function runProbe(root, mode) {
  return JSON.parse(command("php", [PROBE, root, mode]));
}

function ownershipManifest(manifestSha) {
  return {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/admin-hxx-markup-pilot",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "haxe_owned_template_unit",
      name: "admin notice and list-table row HXX markup pilot",
      area: "wp-admin/includes/template.php wp-admin/includes/class-wp-list-table.php",
      public_contract:
        "Haxe owns one representative typed markup unit for admin notice/list-table row fixture output. Existing WordPress admin screens, WP_List_Table display internals, installed route execution, and public PHP replacement are not claimed."
    },
    ownership_state: "haxe_parity_candidate",
    ownership_axes: {
      semantic_owner: "haxe",
      adapter_contract_owner: "haxe_typed_hxx_markup",
      emission_strategy: "wphx_php_file_segment_haxe_owned_template_unit",
      execution_provider: "stock_haxe_php_probe_and_wphx_php_segment_shell",
      compatibility_evidence: "oracle_haxe_wphx_markup_output_match"
    },
    bridge: {
      exists: true,
      kind: "typed_hxx_markup_pilot_with_segment_shell",
      removal_gate:
        "Promote the HXX AST entrypoint into compiler-owned inline markup parsing/lowering and install generated original-path adapters with caller-scope, globals, output buffering, hook/filter, selected PHPUnit, and installed admin evidence before using this for broader admin template ownership."
    },
    owned_paths: HAXE_SOURCES.concat([RUNNER, OUT, OWNERSHIP, RECEIPT]),
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-315-admin-hxx-markup-pilot",
        "npm run wp:core:wphx-315-admin-hxx-markup-pilot:check",
        "npm run haxe:escape-hatches:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-315-08-admin-hxx-markup-pilot"],
      manifest_digest: manifestSha
    },
    notes:
      "This is a bounded typed HXX-style markup pilot. It records raw PHP oracle/probe boundaries as fixture evidence only and does not claim broad mixed PHP/HTML parity."
  };
}

rmSync(OUT_ROOT, { recursive: true, force: true });
command("haxe", [HAXE_HXML]);
command("haxe", [WPHX_HXML]);
writeOracle();
writeProbe();
command("php", ["-l", HAXE_ENTRY]);
command("php", ["-l", WPHX_SHELL]);
command("php", ["-l", ORACLE_SHELL]);

const haxeObservations = parseHaxeOutput(command("php", [HAXE_ENTRY]));
const expectedObservations = {
  notice: EXPECTED_NOTICE,
  row: EXPECTED_ROW,
  combined: EXPECTED_COMBINED
};
assertJsonEqual(haxeObservations, expectedObservations, "typed Haxe HXX observations");

const oracleNormal = runProbe(ORACLE_ROOT, "normal");
const candidateNormal = runProbe(WPHX_ROOT, "normal");
const oracleGuard = runProbe(ORACLE_ROOT, "guard");
const candidateGuard = runProbe(WPHX_ROOT, "guard");
assertJsonEqual(oracleNormal.output, EXPECTED_COMBINED, "oracle output");
assertJsonEqual(candidateNormal.output, EXPECTED_COMBINED, "candidate output");
assertJsonEqual(candidateNormal.output, haxeObservations.combined, "typed Haxe/WPHX output");
assertJsonEqual(candidateNormal.returnValue, { kind: "admin-hxx-markup-pilot", fragments: 2, marker: "hxx:ADMIN" }, "candidate return");
assertJsonEqual(oracleNormal, candidateNormal, "oracle/candidate normal observation");
assertJsonEqual(oracleGuard.returnValue, "ABSPATH_REQUIRED", "oracle guard");
assertJsonEqual(candidateGuard.returnValue, "ABSPATH_REQUIRED", "candidate guard");

const emissionManifest = JSON.parse(readFileSync(WPHX_EMISSION_MANIFEST, "utf8"));
assertJsonEqual(emissionManifest.files.flatMap((file) => file.declarations.map((entry) => `${file.path}:${entry.kind}:${entry.name}`)), [
  "wp-admin/wphx-admin-hxx-markup-pilot.php:script:admin-hxx-markup-pilot"
], "WPHX declarations");
assertJsonEqual([...emissionManifest.core_ir_features].sort(), EXPECTED_FEATURES, "WPHX features");
assertJsonEqual(emissionManifest.segment_plans.map(normalizeSegmentPlan), [EXPECTED_SEGMENT_PLAN], "WPHX segment plan");
if (emissionManifest.unsupported.length !== 0) {
  throw new Error(`Unexpected WPHX unsupported constructs: ${JSON.stringify(emissionManifest.unsupported)}`);
}

const haxeSourceAudits = HAXE_SOURCES.filter((path) => path.endsWith(".hx")).map(sourceEscapeAudit);
const sourceEscapeAuditPassed = haxeSourceAudits.every(
  (audit) =>
    !audit.contains_dynamic &&
    !audit.contains_untyped &&
    !audit.contains_cast &&
    !audit.contains_php_syntax_code &&
    !audit.contains_raw_javascript
);
if (!sourceEscapeAuditPassed) {
  throw new Error(`Typed HXX source escape audit failed: ${JSON.stringify(haxeSourceAudits, null, 2)}`);
}

const manifest = {
  schema: "wphx.wp-core-admin-hxx-markup-pilot.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["typed_hxx_markup_authoring", "compiler_emitted_segment_shell", "oracle_candidate_behavior"],
  artifact_scope: "representative_admin_notice_and_list_table_row_markup",
  behavior_parity_claimed: false,
  installed_wordpress_route_execution_claimed: false,
  public_php_replacement_claimed: false,
  haxe_owned_template_unit_claimed: true,
  inputs: {
    haxe_hxml: inputRecord(HAXE_HXML),
    wphx_hxml: inputRecord(WPHX_HXML),
    haxe_sources: HAXE_SOURCES.map(inputRecord)
  },
  typed_hxx_authoring: {
    source: "src/wphx/wp/admin/AdminHxxMarkupPilot.hx",
    model: "typed_ast_helpers_before_inline_parser_promotion",
    typed_locals: ["AdminNoticeMarkup", "AdminListTableRowMarkup", "AdminRowAction", "AdminNoticeLevel"],
    typed_markup_nodes: ["AdminHxxNode", "AdminHxxTag", "AdminHxxAttr"],
    escaping_policy: "escape text and attribute values with WordPress-compatible HTML entity replacement",
    phoenixhx_railshx_precedent:
      "Matches the PhoenixHx/RailsHx direction by using typed Haxe markup data and helper entrypoints that lower to ordinary target markup; this pilot deliberately stops short of claiming full inline parser support."
  },
  wphx_php: {
    generated_shell: inputRecord(WPHX_SHELL),
    emission_manifest: {
      ...inputRecord(WPHX_EMISSION_MANIFEST),
      core_ir_features: EXPECTED_FEATURES,
      segment_plans: [EXPECTED_SEGMENT_PLAN],
      unsupported_empty: true
    }
  },
  oracle: {
    shell: inputRecord(ORACLE_SHELL),
    fixture_boundary: "hand-authored PHP oracle for representative notice/list-table row markup only"
  },
  observations: {
    expected: expectedObservations,
    typed_haxe: haxeObservations,
    oracle: {
      normal: oracleNormal,
      guard: oracleGuard
    },
    candidate: {
      normal: candidateNormal,
      guard: candidateGuard
    }
  },
  adoption_boundaries: [
    {
      boundary: "inline_hxx_parser",
      state: "not_claimed",
      removal_gate: "Promote typed AST helper calls to parser-backed inline HXX syntax with source-position diagnostics and compile-time invalid-template checks."
    },
    {
      boundary: "existing_wp_admin_mixed_php_html_files",
      state: "not_claimed",
      removal_gate:
        "Model caller scope, globals, includes, output buffering, hooks, filters, return/exit behavior, selected upstream PHPUnit, and installed admin route execution before claiming existing file parity."
    },
    {
      boundary: "raw_php_oracle_and_probe",
      state: "fixture_only",
      removal_gate: "Replace with upstream-executed oracle or generated original-path adapter evidence for the claimed WordPress boundary."
    }
  ],
  claims: [
    "One representative admin notice/list-table row markup unit is authored as typed Haxe HXX-style AST helpers and renders deterministic WordPress-compatible HTML.",
    "The same representative output is emitted through a WPHX PHP original-path file-segment shell with adoption_mode=haxe_owned_template_unit.",
    "PHP oracle, typed Haxe renderer, and WPHX PHP candidate shell match for escaped notice markup, list-table row action markup, combined output, include return value, and ABSPATH guard behavior."
  ],
  non_claims: [
    "This does not claim broad behavior parity for wp-admin screens or list tables.",
    "This does not claim installed WordPress route execution, database-backed state, user/session/capability/nonce behavior, hooks, filters, or browser/e2e parity.",
    "This does not claim generated public PHP replacement for existing WordPress admin files.",
    "This does not claim arbitrary existing mixed PHP/HTML templates can be migrated through HXX without segment plans and caller-scope evidence.",
    "This does not claim full inline HXX parser support; the pilot uses typed AST helpers as the accepted first authoring path."
  ],
  ownership_manifest: OWNERSHIP,
  validation_result: {
    status: "passed",
    typed_haxe_output_matches_expected: true,
    oracle_candidate_behavior_match: true,
    typed_haxe_candidate_output_match: true,
    guard_behavior_passed: true,
    php_lint_passed: true,
    source_escape_audit_passed: sourceEscapeAuditPassed,
    unsupported_empty: true,
    haxe_owned_template_unit_claimed: true,
    public_php_replacement_claimed: false,
    installed_wordpress_route_execution_claimed: false
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-315-08-admin-hxx-markup-pilot",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "typed HXX admin markup pilot manifest", sha256: manifestSha },
    { path: OWNERSHIP, role: "ownership manifest for typed HXX admin markup pilot" },
    { path: "src/wphx/wp/admin/AdminHxxMarkupPilot.hx", role: "typed Haxe HXX-style admin markup source" },
    { path: WPHX_HXML, role: "WPHX PHP original-path segment shell driver" },
    { path: RUNNER, role: "deterministic typed HXX/admin markup pilot runner" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-315-admin-hxx-markup-pilot",
    "npm run wp:core:wphx-315-admin-hxx-markup-pilot:check",
    "npm run haxe:escape-hatches:check",
    "npm run receipts:validate"
  ],
  status: "passed",
  evidence_class: "typed_hxx_markup_authoring",
  artifact_scope: manifest.artifact_scope,
  validation_result: manifest.validation_result,
  claims: manifest.claims,
  non_claims: manifest.non_claims
};

writeOrCheck(OUT, manifestText);
writeOrCheck(OWNERSHIP, ownershipText);
writeOrCheck(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");

console.log(
  JSON.stringify(
    {
      status: "passed",
      output: OUT,
      ownership: OWNERSHIP,
      receipt: RECEIPT,
      typed_fragments: Object.keys(haxeObservations).length,
      segment_plan: EXPECTED_SEGMENT_PLAN.adapter
    },
    null,
    2
  )
);
