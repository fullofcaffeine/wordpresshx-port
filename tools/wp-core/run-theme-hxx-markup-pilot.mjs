#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const checkOnly = process.argv.includes("--check");

const ISSUE = {
  id: "wordpresshx-rwsf",
  external_ref: "WPHX-320.02",
  title: "WPHX-320.02 - Pilot typed HXX default theme markup authoring"
};
const RECORDED_AT = "2026-07-07T18:00:00.000Z";
const RUNNER = "tools/wp-core/run-theme-hxx-markup-pilot.mjs";
const HAXE_HXML = "fixtures/wp-core/theme-hxx-markup-pilot.hxml";
const WPHX_HXML = "fixtures/wphx-php/theme-hxx-markup-pilot.hxml";
const OUT_ROOT = "build/wp-core/wphx-320-02";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const HAXE_ENTRY = `${HAXE_OUT}/index.php`;
const WPHX_ROOT = `${OUT_ROOT}/wphx/generated`;
const THEME_SHELL_PATH = "wp-content/themes/twentytwentysix/patterns/wphx-theme-hxx-markup-pilot.php";
const WPHX_SHELL = `${WPHX_ROOT}/${THEME_SHELL_PATH}`;
const WPHX_EMISSION_MANIFEST = `${WPHX_ROOT}/wphx-php-emission.v1.json`;
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const ORACLE_SHELL = `${ORACLE_ROOT}/${THEME_SHELL_PATH}`;
const PROBE = `${OUT_ROOT}/probe.php`;
const OUT = "manifests/wp-core/wphx-320-02-theme-hxx-markup-pilot.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-320-02-theme-hxx-markup-pilot.v1.json";
const RECEIPT = "receipts/wp-core/wphx-320-02-theme-hxx-markup-pilot.v1.json";
const HAXE_SOURCES = [
  HAXE_HXML,
  WPHX_HXML,
  "src/wphx/wp/themes/ThemeHxxMarkupPilot.hx",
  "fixtures/wp-core/src/wphx/fixtures/wp/core/ThemeHxxMarkupPilotEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/template/ThemeHxxMarkupPilotEntry.hx",
  "fixtures/wphx-php/src/wphx/fixtures/compiler/php/template/ThemeHxxMarkupPilotScript.hx"
];

const EXPECTED_HERO =
  '<section class="wp-block-group alignwide wphx-theme-hero">\n' +
  '\t<div class="wp-block-group__inner-container">\n' +
  "\t\t<h2>Build &amp; Ship</h2>\n" +
  "\t\t<p>Typed theme markup &lt;safe&gt;</p>\n" +
  '\t\t<a class="wp-block-button__link" href="/start?ref=wphx&amp;mode=theme">Start &amp; Go</a>\n' +
  "\t</div>\n" +
  "</section>\n";
const EXPECTED_NAVIGATION =
  '<nav class="wp-block-navigation" aria-label="Primary &amp; Footer">\n' +
  '\t<ul class="wp-block-navigation__container">\n' +
  '\t\t<li class="wp-block-navigation-item current-menu-item"><a href="/">Home</a></li>\n' +
  '\t\t<li class="wp-block-navigation-item"><a href="/blog?view=all&amp;sort=new">Blog &amp; Notes</a></li>\n' +
  "\t</ul>\n" +
  "</nav>\n";
const EXPECTED_COMBINED = EXPECTED_HERO + EXPECTED_NAVIGATION;

const EXPECTED_SEGMENT_PLAN = {
  path: THEME_SHELL_PATH,
  adapter: "theme-hxx-markup-pilot",
  adoption_mode: "haxe_owned_template_unit",
  segments: ["guard", "declaration", "script", "literal_output", "template_expression", "return_exit"],
  caller_scope: [{ kind: "reads_locals", names: ["hero", "navigation"] }],
  include_semantics: [],
  observable_effects: [
    "guard_return",
    "typed_hxx_markup_lowering",
    "theme_pattern_markup_output",
    "theme_navigation_markup_output",
    "escaped_output",
    "include_return_value"
  ],
  unsupported: []
};

const EXPECTED_FEATURES = [
  "file-segment.plan-registry",
  "hxx.typed-theme-markup-unit",
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
    if (!existsSync(path)) throw new Error(`${path} is missing; run npm run wp:core:wphx-320-theme-hxx-markup-pilot`);
    if (readFileSync(path, "utf8") !== content) throw new Error(`${path} is stale; run npm run wp:core:wphx-320-theme-hxx-markup-pilot`);
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

function wphx_oracle_theme_hxx_escape($value) {
\treturn htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function wphx_oracle_theme_hxx_hero_class($hero) {
\t$classes = array('wp-block-group', 'wphx-theme-hero');
\tif (!empty($hero['alignWide'])) {
\t\tarray_splice($classes, 1, 0, array('alignwide'));
\t}
\treturn implode(' ', $classes);
}

function wphx_oracle_theme_hxx_nav_item_class($item) {
\t$classes = array('wp-block-navigation-item');
\tif (!empty($item['current'])) {
\t\t$classes[] = 'current-menu-item';
\t}
\treturn implode(' ', $classes);
}

function wphx_oracle_theme_hxx_render_hero($hero) {
\treturn '<section class="' . wphx_oracle_theme_hxx_escape(wphx_oracle_theme_hxx_hero_class($hero)) . '">' . "\\n"
\t\t. "\\t" . '<div class="wp-block-group__inner-container">' . "\\n"
\t\t. "\\t\\t" . '<h2>' . wphx_oracle_theme_hxx_escape($hero['title']) . '</h2>' . "\\n"
\t\t. "\\t\\t" . '<p>' . wphx_oracle_theme_hxx_escape($hero['summary']) . '</p>' . "\\n"
\t\t. "\\t\\t" . '<a class="wp-block-button__link" href="' . wphx_oracle_theme_hxx_escape($hero['ctaHref']) . '">' . wphx_oracle_theme_hxx_escape($hero['ctaLabel']) . '</a>' . "\\n"
\t\t. "\\t" . '</div>' . "\\n"
\t\t. '</section>' . "\\n";
}

function wphx_oracle_theme_hxx_render_navigation_items($items) {
\t$html = '';
\tforeach ($items as $item) {
\t\t$html .= "\\n\\t\\t" . '<li class="' . wphx_oracle_theme_hxx_escape(wphx_oracle_theme_hxx_nav_item_class($item)) . '"><a href="' . wphx_oracle_theme_hxx_escape($item['href']) . '">' . wphx_oracle_theme_hxx_escape($item['label']) . '</a></li>';
\t}
\treturn $html . "\\n\\t";
}

function wphx_oracle_theme_hxx_render_navigation($navigation) {
\treturn '<nav class="wp-block-navigation" aria-label="' . wphx_oracle_theme_hxx_escape($navigation['ariaLabel']) . '">' . "\\n"
\t\t. "\\t" . '<ul class="wp-block-navigation__container">'
\t\t. wphx_oracle_theme_hxx_render_navigation_items($navigation['items'])
\t\t. '</ul>' . "\\n"
\t\t. '</nav>' . "\\n";
}

echo wphx_oracle_theme_hxx_render_hero($hero);
echo wphx_oracle_theme_hxx_render_navigation($navigation);

return array(
\t'kind' => 'theme-hxx-markup-pilot',
\t'fragments' => 2,
\t'marker' => 'hxx:THEME',
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
$file = $root . '/${THEME_SHELL_PATH}';

$hero = array(
\t'title' => 'Build & Ship',
\t'summary' => 'Typed theme markup <safe>',
\t'ctaLabel' => 'Start & Go',
\t'ctaHref' => '/start?ref=wphx&mode=theme',
\t'alignWide' => true,
);
$navigation = array(
\t'ariaLabel' => 'Primary & Footer',
\t'items' => array(
\t\tarray(
\t\t\t'label' => 'Home',
\t\t\t'href' => '/',
\t\t\t'current' => true,
\t\t),
\t\tarray(
\t\t\t'label' => 'Blog & Notes',
\t\t\t'href' => '/blog?view=all&sort=new',
\t\t\t'current' => false,
\t\t),
\t),
);

if ('guard' !== $mode && !defined('ABSPATH')) {
\tdefine('ABSPATH', dirname($file, 4) . '/');
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
    manifest_id: "ownership:wp-core/theme-hxx-markup-pilot",
    issue: {
      id: ISSUE.id,
      external_ref: ISSUE.external_ref
    },
    unit: {
      kind: "haxe_owned_template_unit",
      name: "default theme hero and navigation HXX markup pilot",
      area: "wp-content/themes/twentytwentysix/patterns representative block-pattern and navigation fragments",
      public_contract:
        "Haxe owns two representative typed default-theme markup units for fixture output. Existing bundled theme PHP files, template-loader behavior, installed rendering, browser/visual parity, and public PHP replacement are not claimed."
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
        "Promote the HXX AST entrypoint into compiler-owned inline markup parsing/lowering and add generated original-path adapters with theme template-loader, caller-scope, globals, loop state, output buffering, selected PHPUnit, installed rendering, and browser/visual evidence before using this for broader default-theme ownership."
    },
    owned_paths: HAXE_SOURCES.concat([RUNNER, OUT, OWNERSHIP, RECEIPT]),
    generated_paths: [OUT, OWNERSHIP, RECEIPT, OUT_ROOT],
    verification: {
      oracle_commands: [
        "npm run wp:core:wphx-320-theme-hxx-markup-pilot",
        "npm run wp:core:wphx-320-theme-hxx-markup-pilot:check",
        "npm run wphx:php:file-segment-core-api:check",
        "npm run wphx:php:profile-core-promotion-audit:check",
        "npm run haxe:escape-hatches:check",
        "npm run receipts:validate"
      ],
      receipt_refs: ["receipt:wphx-320-02-theme-hxx-markup-pilot"],
      manifest_digest: manifestSha
    },
    notes:
      "This is a bounded typed HXX-style theme markup pilot. It records raw PHP oracle/probe boundaries as fixture evidence only and does not claim broad default-theme mixed PHP/HTML parity."
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
  hero: EXPECTED_HERO,
  navigation: EXPECTED_NAVIGATION,
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
assertJsonEqual(candidateNormal.returnValue, { kind: "theme-hxx-markup-pilot", fragments: 2, marker: "hxx:THEME" }, "candidate return");
assertJsonEqual(oracleNormal, candidateNormal, "oracle/candidate normal observation");
assertJsonEqual(oracleGuard.returnValue, "ABSPATH_REQUIRED", "oracle guard");
assertJsonEqual(candidateGuard.returnValue, "ABSPATH_REQUIRED", "candidate guard");

const emissionManifest = JSON.parse(readFileSync(WPHX_EMISSION_MANIFEST, "utf8"));
assertJsonEqual(emissionManifest.files.flatMap((file) => file.declarations.map((entry) => `${file.path}:${entry.kind}:${entry.name}`)), [
  `${THEME_SHELL_PATH}:script:theme-hxx-markup-pilot`
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
  schema: "wphx.wp-core-theme-hxx-markup-pilot.v1",
  issue: ISSUE.external_ref,
  generated_at: RECORDED_AT,
  generator: RUNNER,
  evidence_classes: ["typed_hxx_markup_authoring", "compiler_emitted_segment_shell", "oracle_candidate_behavior"],
  artifact_scope: "representative_default_theme_hero_pattern_and_navigation_markup",
  behavior_parity_claimed: false,
  installed_wordpress_route_execution_claimed: false,
  installed_theme_rendering_parity_claimed: false,
  public_php_replacement_claimed: false,
  haxe_owned_template_unit_claimed: true,
  inputs: {
    haxe_hxml: inputRecord(HAXE_HXML),
    wphx_hxml: inputRecord(WPHX_HXML),
    haxe_sources: HAXE_SOURCES.map(inputRecord),
    hhx_policy: inputRecord("docs/operations/hhx-template-policy.md"),
    prior_surface_inventory: inputRecord("manifests/wp-core/wphx-320-01-default-theme-php-surface.v1.json")
  },
  typed_hxx_authoring: {
    source: "src/wphx/wp/themes/ThemeHxxMarkupPilot.hx",
    model: "typed_ast_helpers_before_inline_parser_promotion",
    typed_locals: ["ThemeHeroPatternMarkup", "ThemeNavigationMarkup", "ThemeNavigationItem"],
    typed_markup_nodes: ["ThemeHxxNode", "ThemeHxxTag", "ThemeHxxAttr"],
    escaping_policy: "escape text and attribute values with WordPress-compatible HTML entity replacement",
    theme_units: ["block-pattern-style hero section", "navigation list fragment"],
    phoenixhx_railshx_precedent:
      "Matches the PhoenixHx/RailsHx direction by using typed Haxe markup data and helper entrypoints that lower to ordinary target markup; this pilot deliberately stops short of claiming full inline parser support or existing mixed theme PHP ownership."
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
    fixture_boundary: "hand-authored PHP oracle for representative default-theme hero/navigation markup only"
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
      boundary: "existing_default_theme_mixed_php_html_files",
      state: "not_claimed",
      removal_gate:
        "Model template-loader path selection, caller scope, globals, loop state, includes, output buffering, hooks, filters, return/exit behavior, selected upstream PHPUnit, installed rendering, and browser/visual evidence before claiming existing theme file parity."
    },
    {
      boundary: "raw_php_oracle_and_probe",
      state: "fixture_only",
      removal_gate: "Replace with upstream-executed oracle or generated original-path adapter evidence for the claimed WordPress theme boundary."
    }
  ],
  claims: [
    "Two representative default-theme hero/navigation markup units are authored as typed Haxe HXX-style AST helpers and render deterministic WordPress-compatible HTML.",
    "The same representative output is emitted through a WPHX PHP original-path file-segment shell with adoption_mode=haxe_owned_template_unit.",
    "PHP oracle, typed Haxe renderer, and WPHX PHP candidate shell match for escaped hero markup, navigation markup, combined output, include return value, and ABSPATH guard behavior."
  ],
  non_claims: [
    "This does not claim broad behavior parity for bundled WordPress default themes.",
    "This does not claim installed WordPress theme rendering, template-loader execution, database-backed content, loop/query state, hooks, filters, browser/e2e parity, or visual parity.",
    "This does not claim generated public PHP replacement for existing default theme files.",
    "This does not claim arbitrary existing mixed PHP/HTML theme templates can be migrated through HXX without segment plans and caller-scope evidence.",
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
    installed_wordpress_route_execution_claimed: false,
    installed_theme_rendering_parity_claimed: false
  }
};

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const manifestSha = sha256(manifestText);
const ownershipText = JSON.stringify(ownershipManifest(manifestSha), null, 2) + "\n";
const receipt = {
  schema: "wphx.verification-receipt.v1",
  id: "receipt:wphx-320-02-theme-hxx-markup-pilot",
  issue: ISSUE,
  recorded_at: RECORDED_AT,
  artifacts: [
    { path: OUT, role: "typed HXX theme markup pilot manifest", sha256: manifestSha },
    { path: OWNERSHIP, role: "ownership manifest for typed HXX theme markup pilot" },
    { path: "src/wphx/wp/themes/ThemeHxxMarkupPilot.hx", role: "typed Haxe HXX-style default theme markup source" },
    { path: WPHX_HXML, role: "WPHX PHP original-path segment shell driver" },
    { path: RUNNER, role: "deterministic typed HXX/theme markup pilot runner" }
  ],
  verification_commands: [
    "npm run wp:core:wphx-320-theme-hxx-markup-pilot",
    "npm run wp:core:wphx-320-theme-hxx-markup-pilot:check",
    "npm run wphx:php:file-segment-core-api:check",
    "npm run wphx:php:profile-core-promotion-audit:check",
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
