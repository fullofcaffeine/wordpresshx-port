#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.32.3",
  external_ref: "WPHX-323.33",
  title: "Add Text_Diff API renderer corpus gate"
};
const RECORDED_AT = "2026-07-09T04:45:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-text-diff-api-renderer-corpus-gate.mjs";
const OUT_ROOT = "build/wp-core/wphx-323-33";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/text-diff-api-renderer-probe.php`;

const SOURCE_FILES = [
  "src/wp-includes/Text/Diff.php",
  "src/wp-includes/Text/Diff/Engine/native.php",
  "src/wp-includes/Text/Diff/Engine/shell.php",
  "src/wp-includes/Text/Diff/Engine/string.php",
  "src/wp-includes/Text/Diff/Engine/xdiff.php",
  "src/wp-includes/Text/Diff/Renderer.php",
  "src/wp-includes/Text/Diff/Renderer/inline.php",
  "src/wp-includes/Text/Exception.php"
];

const ADMIN_INTEGRATION_FILES = [
  "src/wp-includes/pluggable.php",
  "src/wp-includes/wp-diff.php",
  "src/wp-includes/class-wp-text-diff-renderer-table.php",
  "src/wp-includes/class-wp-text-diff-renderer-inline.php",
  "src/wp-admin/includes/revision.php",
  "src/wp-admin/includes/ajax-actions.php"
];

const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const LOCALIZATION_GATES = "manifests/wp-core/wphx-323-06-localization-legacy-vendor-replacement-gates.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const SOURCE_INVENTORY = "manifests/source-inventory.jsonl";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const OUT = "manifests/wp-core/wphx-323-33-text-diff-api-renderer-corpus-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-33-text-diff-api-renderer-corpus-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-33-text-diff-api-renderer-corpus-gate.v1.json";

const CASES = [
  { id: "text-diff:source-boundary", focus: "eight-file wp-includes/Text package boundary and provenance markers" },
  { id: "text-diff:api-reflection", focus: "legacy class names, PHP4 constructor shims, properties, methods, and Text_Exception shape" },
  { id: "text-diff:native-engine", focus: "native engine edit sequences, counts, LCS, reverse, original/final reconstruction, and _check behavior" },
  { id: "text-diff:string-engine", focus: "unified and context diff parser edit sequences" },
  { id: "text-diff:shell-engine", focus: "shell diff engine execution when shell_exec and diff are available, with host availability recorded" },
  { id: "text-diff:xdiff-engine", focus: "xdiff PECL engine behavior when available and preserved fallback when unavailable" },
  { id: "text-diff:renderers", focus: "classic renderer and inline renderer output over additions, deletions, changes, context, empty lines, escaping, whitespace, word and character splits" },
  { id: "text-diff:mapped-diff-and-ops", focus: "Text_MappedDiff plus manual copy/add/delete/change operation behavior" },
  { id: "text-diff:admin-integration-requirements", focus: "wp_text_diff, wp-diff.php, revision AJAX, and WordPress table/inline renderer source anchors" },
  { id: "text-diff:generated-replacement-fallback-policy", focus: "generated replacement requirements, preserved fallback conditions, and explicit non-claims" }
];

const COVERED_SYMBOLS = [
  "Text_Diff",
  "Text_MappedDiff",
  "Text_Diff_Op",
  "Text_Diff_Op_copy",
  "Text_Diff_Op_delete",
  "Text_Diff_Op_add",
  "Text_Diff_Op_change",
  "Text_Diff_Engine_native",
  "Text_Diff_Engine_string",
  "Text_Diff_Engine_shell",
  "Text_Diff_Engine_xdiff",
  "Text_Diff_Renderer",
  "Text_Diff_Renderer_inline",
  "Text_Exception",
  "wp_text_diff integration contract",
  "WP_Text_Diff_Renderer_Table integration contract",
  "WP_Text_Diff_Renderer_inline integration contract",
  "wp_get_revision_ui_diff integration contract"
];

const BLOCKED_CONDITIONS = [
  {
    id: "haxe-owned-text-diff-runtime",
    status: "blocked",
    reason: "The gate executes copied upstream Text_Diff under regenerated oracle/candidate roots. No Haxe-owned Text_Diff runtime implementation is introduced."
  },
  {
    id: "generated-public-text-diff-replacement",
    status: "blocked",
    reason: "No WPHX PHP original-path classes are emitted for wp-includes/Text. Generated replacement still requires matching class names, include paths, reflection shape, renderer output, and WordPress diff callers."
  },
  {
    id: "optional-engine-host-matrix",
    status: "blocked",
    reason: "The gate records current-host shell/xdiff availability. A broader host matrix is still required before replacing optional engine behavior."
  },
  {
    id: "installed-admin-revision-integration",
    status: "blocked",
    reason: "The gate records wp_text_diff(), wp-diff.php, AJAX revision, and WordPress renderer source anchors but does not execute installed admin revision screens or plugin/theme/list-table callers."
  },
  {
    id: "copied-text-diff-retirement",
    status: "blocked",
    reason: "Copied Text_Diff artifacts stay preserved until WPHX-323.36 accepts a provenance/replacement decision with generated replacement, optional-engine, renderer, admin integration, and license evidence."
  }
];

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 80
  }).trim();
}

function commandResult(commandName, commandArgs) {
  const result = spawnSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 80
  });
  const normalizedCommandArgs = commandArgs.map((arg) => normalizeProcessText(arg));
  const normalizedStdout = normalizeProcessText((result.stdout || "").trim());
  const normalizedStderr = normalizeProcessText((result.stderr || "").trim());
  return {
    command: `${commandName} ${normalizedCommandArgs.map((arg) => JSON.stringify(arg)).join(" ")}`,
    status: result.status,
    signal: result.signal,
    stdout_sha256: sha256(normalizedStdout),
    stderr_sha256: sha256(normalizedStderr),
    stdout_preview: normalizedStdout.slice(0, 240),
    stderr_preview: normalizedStderr.slice(0, 240)
  };
}

function normalizeProcessText(value) {
  return String(value)
    .replaceAll(process.cwd(), "<repo>")
    .replaceAll(ORACLE_ROOT, "<oracle-root>")
    .replaceAll(CANDIDATE_ROOT, "<candidate-root>")
    .replaceAll(OUT_ROOT, "<out-root>");
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function fileRecord(path) {
  return { path, bytes: statSync(path).size, sha256: sha256File(path) };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path) {
  const content = readFileSync(path, "utf8").trim();
  if (!content) return [];
  return content.split("\n").map((line) => JSON.parse(line));
}

function upstreamPath(path) {
  return `${UPSTREAM_ROOT}/${path}`;
}

function distributionPath(path) {
  return path.replace(/^src\//, "");
}

function mirrorPath(root, path) {
  return `${root}/${distributionPath(path)}`;
}

function sourceRecord(path) {
  return {
    path,
    distribution_path: distributionPath(path),
    repo_path: upstreamPath(path),
    bytes: statSync(upstreamPath(path)).size,
    sha256: sha256File(upstreamPath(path))
  };
}

function sourceInventoryRecords() {
  const expected = new Set(SOURCE_FILES);
  return readJsonl(SOURCE_INVENTORY)
    .filter((record) => expected.has(record.path))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((record) => ({
      path: record.path,
      baseline: record.baseline,
      repo: record.repo,
      commit: record.commit,
      tree: record.tree,
      language: record.language,
      area: record.area,
      kind: record.kind,
      status: record.status,
      classified: record.classified
    }));
}

function artifactRecords() {
  const expected = new Set(SOURCE_FILES.map(distributionPath));
  return readJsonl(ARTIFACT_PROVENANCE)
    .filter((record) => expected.has(record.path))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((record) => ({
      path: record.path,
      baseline: record.baseline,
      artifact_kind: record.artifactKind,
      artifact_digest: record.artifactDigest,
      origin: record.origin,
      migration_status: record.migrationStatus,
      classified: record.classified
    }));
}

function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run without --check to generate it`);
    if (readFileSync(path, "utf8") !== content) throw new Error(`${path} is stale; run without --check to refresh it`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function walkFiles(root, prefix = "") {
  const dir = `${root}${prefix ? `/${prefix}` : ""}`;
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = `${root}/${relative}`;
    if (entry.isDirectory()) return walkFiles(root, relative);
    if (entry.isFile()) return [full];
    return [];
  });
}

function actualTextSourceFiles() {
  return walkFiles(upstreamPath("src/wp-includes/Text"))
    .filter((path) => path.endsWith(".php"))
    .map((path) => path.replace(`${UPSTREAM_ROOT}/`, ""))
    .sort();
}

function mirrorSources(root) {
  rmSync(root, { recursive: true, force: true });
  for (const path of SOURCE_FILES) {
    mkdirSync(dirname(mirrorPath(root, path)), { recursive: true });
    copyFileSync(upstreamPath(path), mirrorPath(root, path));
  }
}

function packageDiffs(oracleRoot, candidateRoot) {
  const oracleFiles = walkFiles(oracleRoot).map((path) => path.replace(`${oracleRoot}/`, "")).sort();
  const candidateFiles = walkFiles(candidateRoot).map((path) => path.replace(`${candidateRoot}/`, "")).sort();
  const allFiles = [...new Set([...oracleFiles, ...candidateFiles])].sort();
  return allFiles.flatMap((path) => {
    const oraclePath = `${oracleRoot}/${path}`;
    const candidatePath = `${candidateRoot}/${path}`;
    if (!existsSync(oraclePath)) return [{ path, kind: "missing_from_oracle" }];
    if (!existsSync(candidatePath)) return [{ path, kind: "missing_from_candidate" }];
    const oracleHash = sha256File(oraclePath);
    const candidateHash = sha256File(candidatePath);
    if (oracleHash !== candidateHash) return [{ path, kind: "hash_mismatch", oracle_sha256: oracleHash, candidate_sha256: candidateHash }];
    return [];
  });
}

function textDiffSourceMarkers() {
  return Object.fromEntries(
    SOURCE_FILES.map((path) => {
      const content = readFileSync(upstreamPath(path), "utf8");
      return [
        path,
        {
          distribution_path: distributionPath(path),
          package_text_diff_marker: /@package\s+Text_Diff/.test(content),
          wordpress_exception_marker: /WP native addition to the external Text_Diff package/.test(content),
          copyright_marker: /Copyright/i.test(content),
          lgpl_marker: /LGPL|opensource\.org\/license\/lgpl-2-1/i.test(content),
          php4_constructor_marker: /function\s+Text_[A-Za-z0-9_]+\s*\(/.test(content),
          require_path_marker: /require_once|require\s+ABSPATH|dirname\(__FILE__\)/.test(content),
          algorithm_marker: /Algorithm::Diff|diffutils|xdiff|shell_exec|unified|context|render/i.test(content)
        }
      ];
    })
  );
}

function adminIntegrationMarkers() {
  const pluggable = readFileSync(upstreamPath("src/wp-includes/pluggable.php"), "utf8");
  const wpDiff = readFileSync(upstreamPath("src/wp-includes/wp-diff.php"), "utf8");
  const table = readFileSync(upstreamPath("src/wp-includes/class-wp-text-diff-renderer-table.php"), "utf8");
  const inline = readFileSync(upstreamPath("src/wp-includes/class-wp-text-diff-renderer-inline.php"), "utf8");
  const revision = readFileSync(upstreamPath("src/wp-admin/includes/revision.php"), "utf8");
  const ajax = readFileSync(upstreamPath("src/wp-admin/includes/ajax-actions.php"), "utf8");
  return {
    pluggable_wp_text_diff: {
      function_exists_guard_marker: /if\s*\(\s*!\s*function_exists\(\s*'wp_text_diff'\s*\)\s*\)/.test(pluggable),
      lazy_wp_diff_require_marker: /class_exists\(\s*'WP_Text_Diff_Renderer_Table'\s*,\s*false\s*\).*?require\s+ABSPATH\s*\.\s*WPINC\s*\.\s*'\/wp-diff\.php'/s.test(pluggable),
      normalize_whitespace_marker: /normalize_whitespace\(\s*\$left_string\s*\).*normalize_whitespace\(\s*\$right_string\s*\)/s.test(pluggable),
      text_diff_constructor_marker: /new\s+Text_Diff\(\s*\$left_lines\s*,\s*\$right_lines\s*\)/.test(pluggable),
      table_renderer_marker: /new\s+WP_Text_Diff_Renderer_Table\(\s*\$args\s*\)/.test(pluggable),
      table_shell_marker: /<table class='diff/.test(pluggable),
      split_view_arg_marker: /'show_split_view'\s*=>\s*true/.test(pluggable)
    },
    wp_diff_loader: {
      abspath_guard_marker: /if\s*\(\s*!\s*defined\(\s*'ABSPATH'\s*\)\s*\)\s*\{\s*die\(\s*'-1'\s*\)/s.test(wpDiff),
      text_diff_require_marker: /require\s+ABSPATH\s*\.\s*WPINC\s*\.\s*'\/Text\/Diff\.php'/.test(wpDiff),
      renderer_require_marker: /require\s+ABSPATH\s*\.\s*WPINC\s*\.\s*'\/Text\/Diff\/Renderer\.php'/.test(wpDiff),
      inline_require_marker: /require\s+ABSPATH\s*\.\s*WPINC\s*\.\s*'\/Text\/Diff\/Renderer\/inline\.php'/.test(wpDiff),
      exception_require_marker: /require\s+ABSPATH\s*\.\s*WPINC\s*\.\s*'\/Text\/Exception\.php'/.test(wpDiff),
      wordpress_renderer_requires_marker:
        /class-wp-text-diff-renderer-table\.php/.test(wpDiff) && /class-wp-text-diff-renderer-inline\.php/.test(wpDiff)
    },
    wordpress_table_renderer: {
      extends_text_diff_renderer_marker: /class\s+WP_Text_Diff_Renderer_Table\s+extends\s+Text_Diff_Renderer/.test(table),
      allow_dynamic_properties_marker: /#\[AllowDynamicProperties\]/.test(table),
      show_split_view_marker: /\$_show_split_view\s*=\s*true/.test(table),
      inline_renderer_property_marker: /\$inline_diff_renderer\s*=\s*'WP_Text_Diff_Renderer_inline'/.test(table),
      inline_text_diff_auto_marker: /new\s+Text_Diff\(\s*'auto'\s*,\s*array\(\s*array\(\s*\$orig/.test(table),
      process_text_diff_html_filter_marker: /apply_filters\(\s*'process_text_diff_html'/.test(table),
      compat_fields_marker: /\$compat_fields\s*=\s*array\(\s*'_show_split_view'/.test(table)
    },
    wordpress_inline_renderer: {
      extends_text_diff_renderer_inline_marker: /class\s+WP_Text_Diff_Renderer_inline\s+extends\s+Text_Diff_Renderer_inline/.test(inline),
      unicode_word_split_marker: /preg_split\(\s*'\/\(\[\^\\w\]\)\/u'/.test(inline),
      nul_removal_marker: /str_replace\(\s*"\\0"\s*,\s*''\s*,\s*\$string\s*\)/.test(inline)
    },
    revision_and_ajax: {
      revision_wp_text_diff_marker: /wp_text_diff\(\s*\$content_from\s*,\s*\$content_to\s*,\s*\$args\s*\)/.test(revision),
      revision_filter_marker: /apply_filters\(\s*'revision_text_diff_options'/.test(revision),
      ajax_get_revision_diffs_marker: /function\s+wp_ajax_get_revision_diffs\(\)/.test(ajax),
      ajax_revision_require_marker: /require\s+ABSPATH\s*\.\s*'wp-admin\/includes\/revision\.php'/.test(ajax),
      ajax_fields_marker: /'fields'\s*=>\s*wp_get_revision_ui_diff\(\s*\$post\s*,\s*\$compare_from\s*,\s*\$compare_to\s*\)/.test(ajax)
    }
  };
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
$root = rtrim($argv[1], '/\\\\');

error_reporting(E_ALL);
ini_set('display_errors', 'stderr');
ini_set('log_errors', '0');

if (!function_exists('get_temp_dir')) {
\tfunction get_temp_dir() {
\t\treturn rtrim(sys_get_temp_dir(), '/\\\\') . DIRECTORY_SEPARATOR;
\t}
}

require_once $root . '/wp-includes/Text/Exception.php';
require_once $root . '/wp-includes/Text/Diff.php';
require_once $root . '/wp-includes/Text/Diff/Engine/native.php';
require_once $root . '/wp-includes/Text/Diff/Engine/string.php';
require_once $root . '/wp-includes/Text/Diff/Engine/shell.php';
require_once $root . '/wp-includes/Text/Diff/Engine/xdiff.php';
require_once $root . '/wp-includes/Text/Diff/Renderer.php';
require_once $root . '/wp-includes/Text/Diff/Renderer/inline.php';

function wphx_hash_value($value) {
\treturn 'sha256:' . hash('sha256', is_string($value) ? $value : json_encode($value, JSON_UNESCAPED_SLASHES));
}

function wphx_text_summary($text) {
\treturn array(
\t\t'sha256' => wphx_hash_value($text),
\t\t'bytes' => strlen($text),
\t\t'preview' => substr($text, 0, 240),
\t\t'value' => $text,
\t);
}

function wphx_public_properties($object) {
\t$properties = get_object_vars($object);
\tksort($properties);
\treturn $properties;
}

function wphx_edit_summary($edits) {
\t$summary = array();
\tforeach ($edits as $edit) {
\t\t$summary[] = array(
\t\t\t'class' => get_class($edit),
\t\t\t'orig' => $edit->orig,
\t\t\t'final' => $edit->final,
\t\t\t'norig' => $edit->norig(),
\t\t\t'nfinal' => $edit->nfinal(),
\t\t);
\t}
\treturn $summary;
}

function wphx_diff_summary($diff) {
\t$reverse = $diff->reverse();
\treturn array(
\t\t'class' => get_class($diff),
\t\t'edit_summary' => wphx_edit_summary($diff->getDiff()),
\t\t'count_added' => $diff->countAddedLines(),
\t\t'count_deleted' => $diff->countDeletedLines(),
\t\t'is_empty' => $diff->isEmpty(),
\t\t'lcs' => $diff->lcs(),
\t\t'original' => $diff->getOriginal(),
\t\t'final' => $diff->getFinal(),
\t\t'reverse_edit_summary' => wphx_edit_summary($reverse->getDiff()),
\t\t'reverse_original' => $reverse->getOriginal(),
\t\t'reverse_final' => $reverse->getFinal(),
\t);
}

function wphx_method_summary($method) {
\t$params = array();
\tforeach ($method->getParameters() as $parameter) {
\t\t$params[] = array(
\t\t\t'name' => $parameter->getName(),
\t\t\t'position' => $parameter->getPosition(),
\t\t\t'optional' => $parameter->isOptional(),
\t\t\t'default_available' => $parameter->isDefaultValueAvailable(),
\t\t\t'default' => $parameter->isDefaultValueAvailable() ? $parameter->getDefaultValue() : null,
\t\t\t'by_reference' => $parameter->isPassedByReference(),
\t\t);
\t}
\treturn array(
\t\t'name' => $method->getName(),
\t\t'visibility' => $method->isPublic() ? 'public' : ($method->isProtected() ? 'protected' : 'private'),
\t\t'static' => $method->isStatic(),
\t\t'abstract' => $method->isAbstract(),
\t\t'returns_reference' => $method->returnsReference(),
\t\t'parameter_count' => $method->getNumberOfParameters(),
\t\t'required_parameter_count' => $method->getNumberOfRequiredParameters(),
\t\t'parameters' => $params,
\t);
}

function wphx_reflect_class($class) {
\t$reflection = new ReflectionClass($class);
\t$properties = array();
\tforeach ($reflection->getProperties() as $property) {
\t\t$properties[] = array(
\t\t\t'name' => $property->getName(),
\t\t\t'visibility' => $property->isPublic() ? 'public' : ($property->isProtected() ? 'protected' : 'private'),
\t\t\t'static' => $property->isStatic(),
\t\t\t'default_available' => array_key_exists($property->getName(), $reflection->getDefaultProperties()),
\t\t\t'default' => $reflection->getDefaultProperties()[$property->getName()] ?? null,
\t\t);
\t}
\tusort($properties, fn($a, $b) => strcmp($a['name'], $b['name']));
\t$methods = array_map('wphx_method_summary', $reflection->getMethods());
\tusort($methods, fn($a, $b) => strcmp($a['name'], $b['name']));
\treturn array(
\t\t'name' => $reflection->getName(),
\t\t'parent' => $reflection->getParentClass() ? $reflection->getParentClass()->getName() : null,
\t\t'is_abstract' => $reflection->isAbstract(),
\t\t'is_instantiable' => $reflection->isInstantiable(),
\t\t'properties' => $properties,
\t\t'methods' => $methods,
\t\t'php4_constructor_method_present' => $reflection->hasMethod($class),
\t);
}

function wphx_render_outputs($diff) {
\t$classic = new Text_Diff_Renderer();
\t$classic_context = new Text_Diff_Renderer(array('leading_context_lines' => 1, 'trailing_context_lines' => 1));
\t$inline = new Text_Diff_Renderer_inline();
\t$inline_characters = new Text_Diff_Renderer_inline(array('split_characters' => true));
\t$inline_custom = new Text_Diff_Renderer_inline(array(
\t\t'ins_prefix' => '[+',
\t\t'ins_suffix' => '+]',
\t\t'del_prefix' => '[-',
\t\t'del_suffix' => '-]',
\t\t'block_header' => 'BLOCK:' . \"\\n\",
\t));
\treturn array(
\t\t'classic' => wphx_text_summary($classic->render($diff)),
\t\t'classic_context' => wphx_text_summary($classic_context->render($diff)),
\t\t'inline' => wphx_text_summary($inline->render($diff)),
\t\t'inline_characters' => wphx_text_summary($inline_characters->render($diff)),
\t\t'inline_custom' => wphx_text_summary($inline_custom->render($diff)),
\t\t'classic_params' => $classic_context->getParams(),
\t\t'inline_params' => $inline_custom->getParams(),
\t);
}

$observations = array();

$classes = array(
\t'Text_Diff',
\t'Text_MappedDiff',
\t'Text_Diff_Op',
\t'Text_Diff_Op_copy',
\t'Text_Diff_Op_delete',
\t'Text_Diff_Op_add',
\t'Text_Diff_Op_change',
\t'Text_Diff_Engine_native',
\t'Text_Diff_Engine_string',
\t'Text_Diff_Engine_shell',
\t'Text_Diff_Engine_xdiff',
\t'Text_Diff_Renderer',
\t'Text_Diff_Renderer_inline',
\t'Text_Exception',
);
$reflection = array();
foreach ($classes as $class) {
\t$reflection[$class] = wphx_reflect_class($class);
}
$exception = new Text_Exception('text diff fixture error', 32333);
$observations['text-diff:api-reflection'] = array(
\t'classes' => $reflection,
\t'text_exception' => array(
\t\t'class' => get_class($exception),
\t\t'parent' => get_parent_class($exception),
\t\t'instanceof_exception' => $exception instanceof Exception,
\t\t'message' => $exception->getMessage(),
\t\t'code' => $exception->getCode(),
\t),
\t'temp_dir' => Text_Diff::_getTempDir(),
);

$mixed_from = array('alpha' . \"\\n\", 'remove me' . \"\\n\", 'beta' . \"\\n\", 'old words here' . \"\\n\", 'same <tag>' . \"\\n\", '' . \"\\n\", 'omega' . \"\\n\");
$mixed_to = array('alpha' . \"\\n\", 'beta' . \"\\n\", 'new words here' . \"\\n\", 'same <tag>' . \"\\n\", '' . \"\\n\", 'inserted line' . \"\\n\", 'omega!' . \"\\n\");
$identical_from = array('same one' . \"\\n\", 'same two' . \"\\r\\n\", '' . \"\\n\");
$identical_to = array('same one' . \"\\n\", 'same two' . \"\\n\", '' . \"\\n\");
$native_mixed = new Text_Diff('native', array($mixed_from, $mixed_to));
$native_identical = new Text_Diff('native', array($identical_from, $identical_to));
$auto_diff = new Text_Diff($mixed_from, $mixed_to);
$check_results = array();
try {
\t$native_mixed->_check($native_mixed->getOriginal(), $native_mixed->getFinal());
\t$check_results['valid_check'] = array('threw' => false, 'result' => true);
} catch (Throwable $throwable) {
\t$check_results['valid_check'] = array('threw' => true, 'class' => get_class($throwable), 'message' => $throwable->getMessage());
}
try {
\t$native_mixed->_check(array('wrong'), $native_mixed->getFinal());
\t$check_results['invalid_check'] = array('threw' => false);
} catch (Throwable $throwable) {
\t$check_results['invalid_check'] = array('threw' => true, 'class' => get_class($throwable), 'message' => $throwable->getMessage(), 'is_text_exception' => $throwable instanceof Text_Exception);
}
$observations['text-diff:native-engine'] = array(
\t'mixed' => wphx_diff_summary($native_mixed),
\t'identical' => wphx_diff_summary($native_identical),
\t'auto_expected_engine' => extension_loaded('xdiff') ? 'xdiff' : 'native',
\t'auto_legacy_constructor_summary' => wphx_diff_summary($auto_diff),
\t'check_results' => $check_results,
);

$unified_patch = \"--- old\\n+++ new\\n@@ -1,4 +1,5 @@\\n alpha\\n-beta\\n+beta changed\\n gamma\\n+inserted\\n delta\\n\";
$context_patch = \"*** old\\n--- new\\n***************\\n*** 1,4 ****\\n  alpha\\n! beta\\n  gamma\\n  delta\\n--- 1,5 ----\\n  alpha\\n! beta changed\\n  gamma\\n+ inserted\\n  delta\\n\";
$string_unified = new Text_Diff('string', array($unified_patch, 'unified'));
$string_context = new Text_Diff('string', array($context_patch, 'context'));
$observations['text-diff:string-engine'] = array(
\t'unified' => wphx_diff_summary($string_unified),
\t'context' => wphx_diff_summary($string_context),
\t'unified_patch_sha256' => wphx_hash_value($unified_patch),
\t'context_patch_sha256' => wphx_hash_value($context_patch),
);

$shell_available = function_exists('shell_exec') && trim((string) @shell_exec('command -v diff 2>/dev/null')) !== '';
$shell_observation = array(
\t'function_exists_shell_exec' => function_exists('shell_exec'),
\t'diff_command_path' => function_exists('shell_exec') ? trim((string) @shell_exec('command -v diff 2>/dev/null')) : '',
\t'executed' => false,
);
if ($shell_available) {
\t$shell_diff = new Text_Diff('shell', array($mixed_from, $mixed_to));
\t$shell_observation['executed'] = true;
\t$shell_observation['summary'] = wphx_diff_summary($shell_diff);
} else {
\t$shell_observation['fallback_policy'] = 'Preserve upstream shell engine behavior and fall back to native/Text_Diff coverage when shell_exec or diff is unavailable on a host.';
}
$observations['text-diff:shell-engine'] = $shell_observation;

$xdiff_observation = array(
\t'extension_loaded' => extension_loaded('xdiff'),
\t'function_exists_xdiff_string_diff' => function_exists('xdiff_string_diff'),
\t'executed' => false,
);
if (extension_loaded('xdiff') && function_exists('xdiff_string_diff')) {
\t$xdiff_diff = new Text_Diff('xdiff', array($mixed_from, $mixed_to));
\t$xdiff_observation['executed'] = true;
\t$xdiff_observation['summary'] = wphx_diff_summary($xdiff_diff);
} else {
\t$xdiff_observation['fallback_policy'] = 'Preserve upstream xdiff engine as an optional PECL-dependent path and require native/string/shell coverage when xdiff is unavailable.';
}
$observations['text-diff:xdiff-engine'] = $xdiff_observation;

$observations['text-diff:renderers'] = wphx_render_outputs($native_mixed);

$mapped = new Text_MappedDiff(
\tarray('Alpha', 'Beta value', 'Gamma'),
\tarray('alpha', 'Beta changed', 'Gamma'),
\tarray('alpha', 'beta value', 'gamma'),
\tarray('alpha', 'beta changed', 'gamma')
);
$manual_ops = array(
\t'copy' => new Text_Diff_Op_copy(array('one'), array('one')),
\t'add' => new Text_Diff_Op_add(array('added')),
\t'delete' => new Text_Diff_Op_delete(array('deleted')),
\t'change' => new Text_Diff_Op_change(array('old'), array('new')),
);
$manual_summary = array();
foreach ($manual_ops as $id => $op) {
\t$reverse = $op->reverse();
\t$manual_summary[$id] = array(
\t\t'class' => get_class($op),
\t\t'properties' => wphx_public_properties($op),
\t\t'norig' => $op->norig(),
\t\t'nfinal' => $op->nfinal(),
\t\t'reverse_class' => get_class($reverse),
\t\t'reverse_properties' => wphx_public_properties($reverse),
\t);
}
$observations['text-diff:mapped-diff-and-ops'] = array(
\t'mapped_diff' => wphx_diff_summary($mapped),
\t'manual_ops' => $manual_summary,
);

$observations['text-diff:generated-replacement-fallback-policy'] = array(
\t'direct_haxe_port_candidate' => true,
\t'haxe_owned_text_diff_runtime_claimed' => false,
\t'generated_public_php_replacement_claimed' => false,
\t'copied_text_diff_artifact_retirement_claimed' => false,
\t'installed_admin_revision_parity_claimed' => false,
\t'fallback_policy' => 'Preserve upstream Text_Diff when optional engines are unavailable, renderer edge cases diverge, or admin diff integration evidence is incomplete.',
);

ksort($observations);
echo json_encode(array('observations' => $observations), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . \"\\n\";
`
  );
}

function runProbe(root) {
  const output = command("php", [PROBE, root]);
  return {
    command: `php ${PROBE} ${root}`,
    raw_output_sha256: sha256(output),
    result: JSON.parse(output)
  };
}

function validateInputs({ strategy, localizationGates, vendorClosure, sourceInventory, artifactEvidence }) {
  const failures = [];
  const strategyPlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "text_diff");
  const parentGate = localizationGates.gate_plan.find((entry) => entry.id === "text-diff-api-renderer-corpus");
  const boundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "text_diff");
  const actualFiles = actualTextSourceFiles();
  if (JSON.stringify(actualFiles) !== JSON.stringify(SOURCE_FILES)) {
    failures.push(`Text_Diff source boundary drifted: ${actualFiles.join(", ")}`);
  }
  if (strategyPlan?.replacement_strategy !== "direct_haxe_port_preserving_vendor_api") {
    failures.push(`unexpected Text_Diff replacement strategy: ${strategyPlan?.replacement_strategy}`);
  }
  if (parentGate?.downstream_issue.external_ref !== ISSUE.external_ref) {
    failures.push(`WPHX-323.06 Text_Diff gate is not routed to ${ISSUE.external_ref}`);
  }
  if (boundary?.source_inventory.count !== SOURCE_FILES.length || boundary?.distribution_artifacts.count !== SOURCE_FILES.length || boundary?.source_tree.php_file_count !== SOURCE_FILES.length) {
    failures.push("WPHX-323 vendor closure Text_Diff counts do not match the expected eight PHP files");
  }
  if (sourceInventory.length !== SOURCE_FILES.length) failures.push(`expected ${SOURCE_FILES.length} source inventory records, found ${sourceInventory.length}`);
  if (artifactEvidence.length !== SOURCE_FILES.length) failures.push(`expected ${SOURCE_FILES.length} artifact provenance records, found ${artifactEvidence.length}`);
  if (failures.length > 0) {
    throw new Error(`WPHX-323.33 Text_Diff corpus gate failed input validation:\n- ${failures.join("\n- ")}`);
  }
  return { strategyPlan, parentGate, boundary };
}

function main() {
  const strategy = readJson(STRATEGY);
  const localizationGates = readJson(LOCALIZATION_GATES);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const sourceInventory = sourceInventoryRecords();
  const artifactEvidence = artifactRecords();
  const inputs = validateInputs({ strategy, localizationGates, vendorClosure, sourceInventory, artifactEvidence });
  const sourceMarkers = textDiffSourceMarkers();
  const integrationMarkers = adminIntegrationMarkers();

  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  const packageDiff = packageDiffs(ORACLE_ROOT, CANDIDATE_ROOT);
  if (packageDiff.length > 0) {
    throw new Error(`Copied oracle and candidate Text_Diff packages diverged: ${JSON.stringify(packageDiff, null, 2)}`);
  }
  writeProbe();

  const lintResults = Object.fromEntries(
    SOURCE_FILES.map((path) => [path, commandResult("php", ["-l", mirrorPath(ORACLE_ROOT, path)])])
  );
  const candidateLintResults = Object.fromEntries(
    SOURCE_FILES.map((path) => [path, commandResult("php", ["-l", mirrorPath(CANDIDATE_ROOT, path)])])
  );
  const oracleRun = runProbe(ORACLE_ROOT);
  const candidateRun = runProbe(CANDIDATE_ROOT);
  const observationsMatch = JSON.stringify(oracleRun.result.observations) === JSON.stringify(candidateRun.result.observations);
  if (!observationsMatch) {
    throw new Error("oracle and candidate Text_Diff observations diverged");
  }

  const currentPhpVersion = command("php", ["-r", "echo PHP_VERSION;"]);
  const currentPhpVersionId = Number(command("php", ["-r", "echo PHP_VERSION_ID;"]));
  const currentPhpExtensions = command("php", ["-m"]).split("\n").sort();
  const allLintOk = Object.values(lintResults).every((result) => result.status === 0) && Object.values(candidateLintResults).every((result) => result.status === 0);
  const reflection = oracleRun.result.observations["text-diff:api-reflection"];
  const native = oracleRun.result.observations["text-diff:native-engine"];
  const stringEngine = oracleRun.result.observations["text-diff:string-engine"];
  const shellEngine = oracleRun.result.observations["text-diff:shell-engine"];
  const xdiffEngine = oracleRun.result.observations["text-diff:xdiff-engine"];
  const renderer = oracleRun.result.observations["text-diff:renderers"];
  const fallback = oracleRun.result.observations["text-diff:generated-replacement-fallback-policy"];
  const integrationMarkersFlat = Object.values(integrationMarkers).flatMap((group) => Object.values(group));
  const validationResult = {
    status: "passed",
    source_php_file_count: SOURCE_FILES.length,
    source_inventory_record_count: sourceInventory.length,
    artifact_provenance_record_count: artifactEvidence.length,
    covered_symbol_count: COVERED_SYMBOLS.length,
    case_count: CASES.length,
    oracle_candidate_observations_match: observationsMatch,
    oracle_candidate_package_diffs_empty: packageDiff.length === 0,
    all_lint_exit_statuses_ok: allLintOk,
    current_php_version: currentPhpVersion,
    current_php_version_id: currentPhpVersionId,
    xdiff_extension_loaded: currentPhpExtensions.includes("xdiff"),
    reflected_class_count: Object.keys(reflection.classes).length,
    text_exception_extends_exception: reflection.text_exception.instanceof_exception === true,
    native_mixed_edit_count: native.mixed.edit_summary.length,
    native_identical_is_empty: native.identical.is_empty === true,
    native_valid_check_passed: native.check_results.valid_check.result === true,
    native_invalid_check_throws_text_exception: native.check_results.invalid_check.is_text_exception === true,
    string_engine_unified_edit_count: stringEngine.unified.edit_summary.length,
    string_engine_context_edit_count: stringEngine.context.edit_summary.length,
    shell_engine_availability_recorded: typeof shellEngine.function_exists_shell_exec === "boolean",
    shell_engine_executed_or_fallback_recorded: shellEngine.executed === true || typeof shellEngine.fallback_policy === "string",
    xdiff_engine_executed_or_fallback_recorded: xdiffEngine.executed === true || typeof xdiffEngine.fallback_policy === "string",
    renderer_output_count: ["classic", "classic_context", "inline", "inline_characters", "inline_custom"].filter((key) => renderer[key]?.bytes > 0).length,
    admin_integration_markers_recorded: integrationMarkersFlat.every(Boolean),
    source_license_or_wordpress_exception_markers_recorded: Object.values(sourceMarkers).every((markers) => markers.lgpl_marker || markers.wordpress_exception_marker),
    direct_haxe_text_diff_port_claimed: false,
    generated_public_php_replacement_claimed: false,
    copied_text_diff_artifact_retirement_claimed: false,
    installed_admin_revision_parity_claimed: false,
    legal_review_completed_claimed: false,
    fallback_policy_recorded: fallback.copied_text_diff_artifact_retirement_claimed === false
  };

  const manifest = {
    schema: "wphx.wp-core.text-diff-api-renderer-corpus-gate.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "preserved_text_diff_api_renderer_corpus_gate",
    boundary_id: "text_diff",
    source_root: "src/wp-includes/Text",
    distribution_root: "wp-includes/Text",
    inputs: {
      vendor_strategy_manifest: fileRecord(STRATEGY),
      localization_legacy_vendor_gate_manifest: fileRecord(LOCALIZATION_GATES),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      source_inventory: fileRecord(SOURCE_INVENTORY),
      artifact_provenance: fileRecord(ARTIFACT_PROVENANCE),
      admin_integration_files: ADMIN_INTEGRATION_FILES.map(sourceRecord)
    },
    replacement_strategy: {
      current_strategy: inputs.strategyPlan.current_strategy,
      planned_strategy: inputs.strategyPlan.replacement_strategy,
      parent_gate_id: inputs.parentGate.id,
      fallback_policy: inputs.parentGate.fallback_policy,
      removal_gate: inputs.parentGate.removal_gate,
      generated_public_wrapper_requirements: inputs.parentGate.generated_public_wrapper_requirements
    },
    source_files: SOURCE_FILES.map(sourceRecord),
    source_inventory_records: sourceInventory,
    artifact_provenance_records: artifactEvidence,
    package_markers: {
      source_tree_file_count: inputs.boundary.source_tree.file_count,
      php_source_count: inputs.boundary.source_inventory.count,
      distribution_artifact_count: inputs.boundary.distribution_artifacts.count,
      license_provenance: inputs.boundary.license_provenance,
      source_markers: sourceMarkers,
      admin_integration_markers: integrationMarkers
    },
    fixture: {
      cases: CASES,
      covered_symbols: COVERED_SYMBOLS,
      normalization: [
        "Oracle and candidate roots both execute copied upstream WordPress 7.0 Text_Diff files.",
        "The current PHP host records shell_exec, diff command, PHP version, and xdiff extension availability.",
        "The xdiff engine is executed only when the current host has the PECL extension; otherwise the unavailable-host fallback is recorded.",
        "WordPress admin/revision integration is recorded as source anchors, not as installed admin UI parity.",
        "No generated replacement or Haxe-owned Text_Diff implementation is introduced."
      ]
    },
    runs: {
      oracle: {
        ...oracleRun,
        lint: lintResults
      },
      candidate: {
        ...candidateRun,
        lint: candidateLintResults
      },
      package_diffs: packageDiff,
      current_host: {
        php_version: currentPhpVersion,
        php_version_id: currentPhpVersionId,
        php_extensions_sha256: sha256(currentPhpExtensions.join("\n")),
        xdiff_extension_loaded: currentPhpExtensions.includes("xdiff")
      }
    },
    blocked_conditions: BLOCKED_CONDITIONS,
    validation_result: validationResult,
    claims: {
      copied_text_diff_package_mirrored: true,
      oracle_candidate_observation_parity_claimed: true,
      api_reflection_recorded: validationResult.reflected_class_count === COVERED_SYMBOLS.filter((symbol) => symbol.startsWith("Text_")).length,
      native_string_shell_xdiff_engine_behavior_recorded: true,
      renderer_output_recorded: validationResult.renderer_output_count === 5,
      admin_integration_requirements_recorded: validationResult.admin_integration_markers_recorded,
      haxe_owned_text_diff_runtime_claimed: false,
      generated_public_php_replacement_claimed: false,
      copied_text_diff_artifact_retirement_claimed: false,
      installed_admin_revision_parity_claimed: false,
      legal_review_completed_claimed: false
    },
    non_claims: [
      "This gate does not claim Haxe-owned Text_Diff runtime implementation.",
      "This gate does not claim generated public PHP replacement for wp-includes/Text.",
      "This gate does not claim copied Text_Diff artifact retirement.",
      "This gate does not execute full installed wp_text_diff(), revision AJAX, admin revision screens, plugin/theme/list-table callers, or distribution behavior.",
      "This gate does not close optional shell/xdiff host-version support; it records current-host availability and fallback policy.",
      "This gate does not claim legal review completion; it preserves upstream headers/project notice and records future provenance gates."
    ]
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestText);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-33-text-diff-api-renderer-corpus-gate",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    ownership_state: "preserved_upstream_text_diff_api_renderer_corpus_gate",
    boundary_id: "text_diff",
    source_paths: SOURCE_FILES,
    distribution_paths: SOURCE_FILES.map(distributionPath),
    emission_strategy: "copied_upstream_text_diff_package_with_api_renderer_corpus_probe",
    durable_haxe_runtime_claimed: false,
    public_php_replacement_claimed: false,
    copied_artifact_retirement_claimed: false,
    generated_overlay_manifest_present: false,
    installed_admin_revision_parity_claimed: false,
    legal_review_complete: false,
    notes: [
      "Oracle and candidate roots execute copied upstream WordPress 7.0 Text_Diff files.",
      "The Text_Diff boundary includes eight PHP files under wp-includes/Text, including WordPress-native Text/Exception.php.",
      "Current-host shell and xdiff availability is recorded as host evidence and does not close optional engine support.",
      "Keep upstream Text_Diff preserved until WPHX-323.36 records an accepted provenance/replacement decision."
    ],
    removal_gates: [
      "non-empty generated overlay manifest for any candidate divergence",
      "generated WPHX PHP original-path Text_Diff classes preserving legacy class names, include paths, reflection shape, PHP4 constructor shims, and renderer output",
      "native/string/shell/xdiff engine corpus across representative host matrix",
      "installed wp_text_diff(), admin revision AJAX, plugin/theme/list-table diff integration evidence",
      "license/provenance review and WPHX-323.36 localization legacy provenance decision acceptance"
    ],
    receipt_refs: ["receipt:wphx-323-33-text-diff-api-renderer-corpus-gate"]
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-33-text-diff-api-renderer-corpus-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "preserved_text_diff_api_renderer_corpus_gate",
    artifact_scope: "wordpress-7.0-text-diff-api-renderer-preserved-library-corpus",
    commands: [
      "npm run wp:core:wphx-323-text-diff-api-renderer-corpus",
      "npm run wp:core:wphx-323-text-diff-api-renderer-corpus:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      parent_localization_legacy_gate_manifest: LOCALIZATION_GATES,
      parent_vendor_strategy_manifest: STRATEGY,
      parent_vendor_closure_manifest: VENDOR_CLOSURE
    },
    manifest_sha256: sha256(manifestText),
    validation_result: validationResult,
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };
  writeOrCheck(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);

  const verb = checkOnly ? "validated" : "wrote";
  console.log(`${verb} ${OUT}`);
  console.log(`${verb} ${OWNERSHIP}`);
  console.log(`${verb} ${RECEIPT}`);
  console.log(`recorded ${CASES.length} Text_Diff cases across ${COVERED_SYMBOLS.length} symbols`);
}

main();
