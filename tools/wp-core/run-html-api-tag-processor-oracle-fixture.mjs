#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.20.2",
  external_ref: "WPHX-314.08",
  title: "WPHX-314.08 - Add HTML API tag processor oracle fixture"
};
const RECORDED_AT = "2026-06-29T00:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-html-api-tag-processor-oracle-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-314-08";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const OUT = "manifests/wp-core/wphx-314-08-html-api-tag-processor-oracle-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-314-08-html-api-tag-processor-oracle-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-314-08-html-api-tag-processor-oracle-fixture.v1.json";
const PRIOR_EVIDENCE = [
  "manifests/wp-core/wphx-314-01-blocks-interactivity-surface.v1.json",
  "manifests/wp-core/wphx-314-02-blocks-interactivity-adapter-contract-candidate.v1.json",
  "manifests/wp-core/wphx-314-03-block-parser-render-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-04-block-supports-bindings-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-05-block-patterns-registry-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-06-block-hooks-insertion-oracle-fixture.v1.json",
  "manifests/wp-core/wphx-314-07-style-engine-oracle-fixture.v1.json"
];

const SOURCE_FILES = [
  "src/wp-includes/class-wp-token-map.php",
  "src/wp-includes/html-api/html5-named-character-references.php",
  "src/wp-includes/html-api/class-wp-html-attribute-token.php",
  "src/wp-includes/html-api/class-wp-html-span.php",
  "src/wp-includes/html-api/class-wp-html-text-replacement.php",
  "src/wp-includes/html-api/class-wp-html-decoder.php",
  "src/wp-includes/html-api/class-wp-html-tag-processor.php"
];
const COVERED_SYMBOLS = [
  "WP_HTML_Tag_Processor",
  "WP_HTML_Tag_Processor::__construct",
  "WP_HTML_Tag_Processor::next_tag",
  "WP_HTML_Tag_Processor::next_token",
  "WP_HTML_Tag_Processor::paused_at_incomplete_token",
  "WP_HTML_Tag_Processor::class_list",
  "WP_HTML_Tag_Processor::has_class",
  "WP_HTML_Tag_Processor::set_bookmark",
  "WP_HTML_Tag_Processor::release_bookmark",
  "WP_HTML_Tag_Processor::has_bookmark",
  "WP_HTML_Tag_Processor::seek",
  "WP_HTML_Tag_Processor::get_attribute",
  "WP_HTML_Tag_Processor::get_attribute_names_with_prefix",
  "WP_HTML_Tag_Processor::get_tag",
  "WP_HTML_Tag_Processor::get_qualified_tag_name",
  "WP_HTML_Tag_Processor::get_namespace",
  "WP_HTML_Tag_Processor::has_self_closing_flag",
  "WP_HTML_Tag_Processor::is_tag_closer",
  "WP_HTML_Tag_Processor::get_token_type",
  "WP_HTML_Tag_Processor::get_token_name",
  "WP_HTML_Tag_Processor::get_comment_type",
  "WP_HTML_Tag_Processor::get_full_comment_text",
  "WP_HTML_Tag_Processor::subdivide_text_appropriately",
  "WP_HTML_Tag_Processor::get_modifiable_text",
  "WP_HTML_Tag_Processor::set_modifiable_text",
  "WP_HTML_Tag_Processor::set_attribute",
  "WP_HTML_Tag_Processor::remove_attribute",
  "WP_HTML_Tag_Processor::add_class",
  "WP_HTML_Tag_Processor::remove_class",
  "WP_HTML_Tag_Processor::get_updated_html",
  "WP_HTML_Decoder::decode_attribute",
  "WP_HTML_Decoder::decode_text_node",
  "WP_Token_Map::read_token"
];
const CASES = [
  { id: "html-api:query-attributes-classes", focus: "tag query, decoded attributes, data prefix names, class list, and class membership" },
  { id: "html-api:attribute-class-mutations", focus: "attribute escaping, URI filtering, boolean attributes, class add/remove, and updated HTML" },
  { id: "html-api:bookmarks-seek", focus: "bookmark creation, seek, release, and mutation after returning to a prior tag" },
  { id: "html-api:token-text-comment", focus: "token traversal, decoded text/comment reads, text/comment mutation, and comment safety rejection" },
  { id: "html-api:special-modifiable-text", focus: "script, style, title, and textarea modifiable text escaping" },
  { id: "html-api:incomplete-closers-namespace", focus: "incomplete-token pause, self-closing flag, tag closers, BR special case, and namespace switching" }
];

function command(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 80
  }).trim();
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function inputRecord(path) {
  return { path, bytes: statSync(path).size, sha256: sha256File(path) };
}

function upstreamPath(path) {
  return `${UPSTREAM_ROOT}/${path}`;
}

function mirrorPath(root, path) {
  return `${root}/${path.replace(/^src\//, "")}`;
}

function sourceRecord(path) {
  return {
    path,
    repo_path: upstreamPath(path),
    bytes: statSync(upstreamPath(path)).size,
    sha256: sha256File(upstreamPath(path))
  };
}

function mirrorSources(root) {
  for (const path of SOURCE_FILES) {
    const target = mirrorPath(root, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(upstreamPath(path), target);
  }
}

function writeProbe(root) {
  writeFileSync(
    `${root}/probe.php`,
    `<?php
error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );
ini_set( 'log_errors', '0' );

$case = $argv[1] ?? '';
$GLOBALS['wphx_wrong'] = array();

define( 'ABSPATH', __DIR__ . '/' );
define( 'WPINC', 'wp-includes' );

function __( $value ) { return $value; }
function _doing_it_wrong( $function_name, $message, $version ) { $GLOBALS['wphx_wrong'][] = compact( 'function_name', 'message', 'version' ); }
function wp_json_encode( $value, $flags = 0, $depth = 512 ) { return json_encode( $value, $flags, $depth ); }
function wp_has_noncharacters( $text ) { return false; }
function wp_kses_uri_attributes() { return array( 'action', 'background', 'cite', 'href', 'longdesc', 'poster', 'src', 'usemap' ); }
function esc_url( $url ) {
\t$url = trim( (string) $url );
\tif ( preg_match( '/^javascript:/i', $url ) ) {
\t\treturn '';
\t}
\treturn strtr( $url, array( '<' => '%3C', '>' => '%3E', '"' => '%22', "'" => '%27' ) );
}

require ABSPATH . WPINC . '/class-wp-token-map.php';
require ABSPATH . WPINC . '/html-api/html5-named-character-references.php';
require ABSPATH . WPINC . '/html-api/class-wp-html-attribute-token.php';
require ABSPATH . WPINC . '/html-api/class-wp-html-span.php';
require ABSPATH . WPINC . '/html-api/class-wp-html-text-replacement.php';
require ABSPATH . WPINC . '/html-api/class-wp-html-decoder.php';
require ABSPATH . WPINC . '/html-api/class-wp-html-tag-processor.php';

function query_attributes_classes_case() {
\t$html = '<main><div DATA-enabled class="free &lt;egg&lt; lang-en free" DATA-test-id="14" enabled>Test</div><span class="other">No</span></main>';
\t$p = new WP_HTML_Tag_Processor( $html );
\t$matched = $p->next_tag( array( 'tag_name' => 'div', 'class_name' => '<egg<' ) );
\treturn array(
\t\t'matched'       => $matched,
\t\t'tag'           => $p->get_tag(),
\t\t'qualified'     => $p->get_qualified_tag_name(),
\t\t'namespace'     => $p->get_namespace(),
\t\t'class'         => $p->get_attribute( 'class' ),
\t\t'class_list'    => iterator_to_array( $p->class_list() ),
\t\t'has_free'      => $p->has_class( 'free' ),
\t\t'has_missing'   => $p->has_class( 'missing' ),
\t\t'data_names'    => $p->get_attribute_names_with_prefix( 'data-' ),
\t\t'data_enabled'  => $p->get_attribute( 'data-enabled' ),
\t\t'data_test_id'  => $p->get_attribute( 'DATA-test-id' ),
\t\t'enabled'       => $p->get_attribute( 'enabled' ),
\t\t'updated_html'  => $p->get_updated_html(),
\t\t'next_missing'  => $p->next_tag( array( 'tag_name' => 'article' ) ),
\t\t'after_missing' => $p->get_attribute( 'class' ),
\t);
}

function attribute_class_mutations_case() {
\t$html = '<div class="one two" data-old="x"><a href="http://example.com/?a=1&amp;b=2">Link</a><img src="old.png"></div>';
\t$p = new WP_HTML_Tag_Processor( $html );
\t$p->next_tag( 'div' );
\t$p->add_class( 'three' );
\t$p->remove_class( 'one' );
\t$p->set_attribute( 'aria-label', 'Eggs & Milk' );
\t$p->remove_attribute( 'data-old' );
\t$div_class = $p->get_attribute( 'class' );
\t$p->next_tag( 'a' );
\t$p->set_attribute( 'href', 'javascript:alert(1)' );
\t$href_rejected = null === $p->get_attribute( 'href' );
\t$p->set_attribute( 'download', true );
\t$p->set_attribute( 'target', false );
\t$p->next_tag( 'img' );
\t$p->set_attribute( 'src', 'photo <one>.png' );
\treturn array(
\t\t'div_class_after_queue' => $div_class,
\t\t'href_rejected'         => $href_rejected,
\t\t'updated_html'          => $p->get_updated_html(),
\t\t'wrong'                 => $GLOBALS['wphx_wrong'],
\t);
}

function bookmarks_seek_case() {
\t$p = new WP_HTML_Tag_Processor( '<ul><li>One</li><li>Two</li><li>Three</li></ul>' );
\t$seen = array();
\twhile ( $p->next_tag( array( 'tag_name' => 'li' ) ) ) {
\t\t$seen[] = $p->get_tag();
\t\t$p->set_bookmark( 'last-li' );
\t}
\t$has_before = $p->has_bookmark( 'last-li' );
\t$seeked = $p->seek( 'last-li' );
\t$p->add_class( 'last-li' );
\t$has_after_seek = $p->has_bookmark( 'last-li' );
\t$released = $p->release_bookmark( 'last-li' );
\treturn array(
\t\t'seen'           => $seen,
\t\t'has_before'     => $has_before,
\t\t'seeked'         => $seeked,
\t\t'has_after_seek' => $has_after_seek,
\t\t'released'       => $released,
\t\t'has_after'      => $p->has_bookmark( 'last-li' ),
\t\t'updated_html'   => $p->get_updated_html(),
\t);
}

function token_text_comment_case() {
\t$p = new WP_HTML_Tag_Processor( 'Hello &amp; <em>world</em><!--note--><?pi yes?>' );
\t$p->next_token();
\t$text_before = array( 'type' => $p->get_token_type(), 'name' => $p->get_token_name(), 'text' => $p->get_modifiable_text() );
\t$p->set_modifiable_text( 'A < B & C' );
\t$p->next_token();
\t$em = array( 'type' => $p->get_token_type(), 'name' => $p->get_token_name(), 'tag' => $p->get_tag() );
\t$p->next_token();
\t$inner = array( 'type' => $p->get_token_type(), 'text' => $p->get_modifiable_text() );
\t$p->next_token();
\t$p->next_token();
\t$p->next_token();
\t$comment_before = array( 'type' => $p->get_token_type(), 'name' => $p->get_token_name(), 'comment_type' => $p->get_comment_type(), 'full' => $p->get_full_comment_text(), 'text' => $p->get_modifiable_text() );
\t$unsafe_comment = $p->set_modifiable_text( 'bad --> close' );
\t$safe_comment = $p->set_modifiable_text( 'safe note' );
\treturn array(
\t\t'text_before'    => $text_before,
\t\t'em'             => $em,
\t\t'inner'          => $inner,
\t\t'comment_before' => $comment_before,
\t\t'unsafe_comment' => $unsafe_comment,
\t\t'safe_comment'   => $safe_comment,
\t\t'updated_html'   => $p->get_updated_html(),
\t);
}

function special_modifiable_text_case() {
\t$p = new WP_HTML_Tag_Processor( '<script type="application/json">{"ok":true}</script><style>.a{color:red}</style><title>Old &amp; title</title><textarea>Old text</textarea>' );
\t$p->next_tag( 'script' );
\t$script_before = $p->get_modifiable_text();
\t$p->set_modifiable_text( '{"close":"</script><script>bad</script>"}' );
\t$p->next_tag( 'style' );
\t$style_before = $p->get_modifiable_text();
\t$p->set_modifiable_text( '.x:before{content:"</style>"}' );
\t$p->next_tag( 'title' );
\t$title_before = $p->get_modifiable_text();
\t$p->set_modifiable_text( 'New </title> & title' );
\t$p->next_tag( 'textarea' );
\t$textarea_before = $p->get_modifiable_text();
\t$p->set_modifiable_text( "\\nLine </textarea> & more" );
\treturn array(
\t\t'script_before'   => $script_before,
\t\t'style_before'    => $style_before,
\t\t'title_before'    => $title_before,
\t\t'textarea_before' => $textarea_before,
\t\t'updated_html'    => $p->get_updated_html(),
\t);
}

function incomplete_closers_namespace_case() {
\t$partial = new WP_HTML_Tag_Processor( 'Text <div class="unterminated' );
\t$partial_found = $partial->next_tag();
\t$tokens = new WP_HTML_Tag_Processor( '<br></br><img src="x" /><div></div>' );
\t$rows = array();
\twhile ( $tokens->next_tag( array( 'tag_closers' => 'visit' ) ) ) {
\t\t$rows[] = array(
\t\t\t'tag'          => $tokens->get_tag(),
\t\t\t'type'         => $tokens->get_token_type(),
\t\t\t'closer'       => $tokens->is_tag_closer(),
\t\t\t'self_closing' => $tokens->has_self_closing_flag(),
\t\t);
\t}
\t$namespace = new WP_HTML_Tag_Processor( '<svg><path /></svg>' );
\t$namespace->change_parsing_namespace( 'svg' );
\t$namespace_changed = $namespace->next_tag();
\t$invalid_namespace = $namespace->change_parsing_namespace( 'bogus' );
\treturn array(
\t\t'partial_found'      => $partial_found,
\t\t'partial_paused'     => $partial->paused_at_incomplete_token(),
\t\t'rows'               => $rows,
\t\t'namespace_changed'  => $namespace_changed,
\t\t'namespace'          => $namespace->get_namespace(),
\t\t'qualified_svg_tag'  => $namespace->get_qualified_tag_name(),
\t\t'invalid_namespace'  => $invalid_namespace,
\t);
}

$cases = array(
\t'html-api:query-attributes-classes'    => 'query_attributes_classes_case',
\t'html-api:attribute-class-mutations'   => 'attribute_class_mutations_case',
\t'html-api:bookmarks-seek'              => 'bookmarks_seek_case',
\t'html-api:token-text-comment'          => 'token_text_comment_case',
\t'html-api:special-modifiable-text'     => 'special_modifiable_text_case',
\t'html-api:incomplete-closers-namespace'=> 'incomplete_closers_namespace_case',
);

if ( ! isset( $cases[ $case ] ) ) {
\tfwrite( STDERR, 'Unknown fixture case: ' . $case . PHP_EOL );
\texit( 2 );
}

$observation = array(
\t'case'        => $case,
\t'observation' => call_user_func( $cases[ $case ] ),
\t'wrong'       => $GLOBALS['wphx_wrong'],
);
echo wp_json_encode( $observation, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL;
`
  );
}

function runFixture(root) {
  rmSync(root, { force: true, recursive: true });
  mkdirSync(root, { recursive: true });
  mirrorSources(root);
  writeProbe(root);
  command("php", ["-l", `${root}/probe.php`]);

  const observations = [];
  for (const fixtureCase of CASES) {
    observations.push(JSON.parse(command("php", [`${root}/probe.php`, fixtureCase.id])));
  }

  return {
    root,
    probe: `${root}/probe.php`,
    probe_sha256: sha256File(`${root}/probe.php`),
    source_files: SOURCE_FILES.map((path) => inputRecord(mirrorPath(root, path))),
    observations
  };
}

function writeJsonChecked(path, value) {
  const rendered = `${JSON.stringify(value, null, 2)}\n`;
  if (checkOnly) {
    if (!existsSync(path)) {
      throw new Error(`${path} is missing; run npm run wp:core:wphx-314-html-api-tag-processor-oracle-fixture`);
    }
    if (readFileSync(path, "utf8") !== rendered) {
      throw new Error(`${path} is stale; run npm run wp:core:wphx-314-html-api-tag-processor-oracle-fixture`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, rendered);
}

function main() {
  const oracle = runFixture(ORACLE_ROOT);
  const candidate = runFixture(CANDIDATE_ROOT);
  const oracleComparable = oracle.observations;
  const candidateComparable = candidate.observations;
  if (JSON.stringify(oracleComparable) !== JSON.stringify(candidateComparable)) {
    throw new Error("Oracle and candidate HTML API tag processor observations diverged");
  }

  const validationResult = {
    status: "passed",
    issue: ISSUE.external_ref,
    case_count: CASES.length,
    covered_symbol_count: COVERED_SYMBOLS.length,
    source_file_count: SOURCE_FILES.length,
    oracle_candidate_match: true,
    public_php_replacement_claimed: false
  };

  const manifest = {
    schema: "wphx.wp_core.html_api_tag_processor_oracle_fixture.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: {
      path: RUNNER,
      sha256: sha256File(RUNNER),
      check_command: "npm run wp:core:wphx-314-html-api-tag-processor-oracle-fixture:check"
    },
    evidence_class: "copied_oracle_candidate_php_fixture",
    artifact_scope: {
      domain: "blocks_html_api_tag_processor",
      public_php_replacement_claimed: false,
      haxe_runtime_logic_claimed: false,
      installed_block_parity_claimed: false,
      upstream_phpunit_pass_pass_claimed: false,
      browser_gutenberg_ownership_claimed: false
    },
    inputs: {
      upstream_root: UPSTREAM_ROOT,
      source_files: SOURCE_FILES.map(sourceRecord),
      prior_evidence: PRIOR_EVIDENCE.filter(existsSync).map(inputRecord)
    },
    fixture: {
      cases: CASES,
      covered_symbols: COVERED_SYMBOLS,
      deterministic_boundaries: [
        "WordPress 7.0 PHP HTML API tag processor, decoder, token-map, and helper token classes are mirrored into oracle and candidate roots.",
        "Core helpers outside the HTML API ownership boundary are deterministic stubs for translation, diagnostics, URL filtering, URI attribute names, JSON, and noncharacter detection.",
        "The fixture observes public tag traversal, decoded attributes/classes, bookmarks, mutable attributes/classes, token text/comment mutation, special-element modifiable text, incomplete-token pausing, tag closers, and namespace switching.",
        "The full HTML5 processor/tree builder, active formatting/open element stacks, block interactivity directives, installed block rendering, and browser/Gutenberg behavior remain outside this slice."
      ]
    },
    runs: {
      oracle,
      candidate,
      comparable_sha256: sha256(JSON.stringify(oracleComparable))
    },
    remaining_gaps: [
      "Haxe-owned runtime implementation for the HTML API tag processor is not claimed.",
      "Generated original-path public PHP adapter replacement is not claimed.",
      "Full HTML5 processor/tree ownership, active formatting/open element stack behavior, interactivity directive processing, installed block rendering, selected upstream PHPUnit pass/pass, editor/browser, and Gutenberg package ownership remain later gates.",
      "Full interactivity ownership remains outside this fixture."
    ],
    ownership_manifest: OWNERSHIP,
    validation_result: validationResult
  };

  const ownership = {
    schema: "wphx.ownership_manifest.v1",
    manifest_id: "wphx-314-08-html-api-tag-processor-oracle-fixture",
    issue: ISSUE,
    unit: {
      kind: "wp_core_oracle_fixture",
      domain: "blocks_html_api_tag_processor",
      source_files: SOURCE_FILES
    },
    ownership_state: "bridge_shell",
    ownership_axes: {
      semantic_behavior: "upstream_wordpress_php_oracle",
      haxe_source: "not_claimed",
      public_php_abi: "copied_oracle_candidate_fixture_only",
      installed_distribution: "not_claimed",
      browser_gutenberg: "not_claimed"
    },
    bridge: {
      kind: "copied_oracle_candidate_php_fixture",
      removal_gate: "Replace the copied public PHP fixture with typed Haxe-owned HTML API tag processor decisions plus WPHX Adapter IR/generated original-path public PHP evidence, or explicitly supersede this bridge with an accepted backend/custom-target improvement.",
      non_claims: manifest.remaining_gaps
    },
    owned_paths: [],
    generated_paths: [OUT, OWNERSHIP, RECEIPT, `${ORACLE_ROOT}/probe.php`, `${CANDIDATE_ROOT}/probe.php`],
    verification: validationResult,
    notes: [
      "This fixture is a behavior target for future Haxe ownership. It records decoded attribute/class traversal, attribute/class mutation, bookmarks, token text/comment mutation, special-element text escaping, incomplete-token pausing, tag closer semantics, and namespace switching.",
      "The fixture-owned Core helper stubs are deterministic harness boundaries, not replacement evidence for KSES, URL policy, or the full HTML5 processor."
    ]
  };

  const receipt = {
    schema: "wphx.receipt.v1",
    id: "wphx-314-08-html-api-tag-processor-oracle-fixture",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    artifacts: {
      manifest: OUT,
      ownership,
      runner: RUNNER,
      generated_oracle_probe: `${ORACLE_ROOT}/probe.php`,
      generated_candidate_probe: `${CANDIDATE_ROOT}/probe.php`
    },
    verification_commands: [
      "npm run wp:core:wphx-314-html-api-tag-processor-oracle-fixture",
      "npm run wp:core:wphx-314-html-api-tag-processor-oracle-fixture:check",
      "npm run receipts:validate",
      "npm run beads:validate",
      "npm run precommit"
    ],
    related_receipts: [
      "receipts/wp-core/wphx-314-01-blocks-interactivity-surface.v1.json",
      "receipts/wp-core/wphx-314-02-blocks-interactivity-adapter-contract-candidate.v1.json",
      "receipts/wp-core/wphx-314-03-block-parser-render-oracle-fixture.v1.json",
      "receipts/wp-core/wphx-314-04-block-supports-bindings-oracle-fixture.v1.json",
      "receipts/wp-core/wphx-314-05-block-patterns-registry-oracle-fixture.v1.json",
      "receipts/wp-core/wphx-314-06-block-hooks-insertion-oracle-fixture.v1.json",
      "receipts/wp-core/wphx-314-07-style-engine-oracle-fixture.v1.json"
    ].filter(existsSync),
    validation_result: validationResult,
    manifest_sha256: sha256(JSON.stringify(manifest)),
    ownership_sha256: sha256(JSON.stringify(ownership))
  };

  writeJsonChecked(OUT, manifest);
  writeJsonChecked(OWNERSHIP, ownership);
  writeJsonChecked(RECEIPT, receipt);

  console.log(JSON.stringify(validationResult, null, 2));
}

main();
