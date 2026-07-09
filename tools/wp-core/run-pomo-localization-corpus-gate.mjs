#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.32.1",
  external_ref: "WPHX-323.31",
  title: "Add POMO localization corpus gate"
};
const RECORDED_AT = "2026-07-09T04:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-pomo-localization-corpus-gate.mjs";
const OUT_ROOT = "build/wp-core/wphx-323-31";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const ORACLE_WORK = `${OUT_ROOT}/oracle-work`;
const CANDIDATE_WORK = `${OUT_ROOT}/candidate-work`;
const PROBE = `${OUT_ROOT}/pomo-localization-corpus-probe.php`;
const POMO_ROOT = "src/wp-includes/pomo";
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const LOCALIZATION_GATES = "manifests/wp-core/wphx-323-06-localization-legacy-vendor-replacement-gates.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const SOURCE_INVENTORY = "manifests/source-inventory.jsonl";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const OUT = "manifests/wp-core/wphx-323-31-pomo-localization-corpus-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-31-pomo-localization-corpus-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-31-pomo-localization-corpus-gate.v1.json";

const POMO_FILES = [
  "src/wp-includes/pomo/entry.php",
  "src/wp-includes/pomo/mo.php",
  "src/wp-includes/pomo/plural-forms.php",
  "src/wp-includes/pomo/po.php",
  "src/wp-includes/pomo/streams.php",
  "src/wp-includes/pomo/translations.php"
];

const CASES = [
  { id: "pomo:api-reflection-load", focus: "POMO classes, methods, constants, public state, conditional declarations, and deprecated constructor shape" },
  { id: "pomo:entry-translations", focus: "Translation_Entry keys, references, flags, comments, merges, context translation, plural fallback, and NOOP behavior" },
  { id: "pomo:plural-forms", focus: "Plural-Forms header parsing, ternary plural expressions, invalid-header fallback, and translated plural selection" },
  { id: "pomo:po-import-export", focus: "PO headers, comments, contexts, plural entries, multiline strings, export_to_file, and invalid PO handling" },
  { id: "pomo:mo-roundtrip", focus: "MO binary export/import, headers, context/plural entries, filename recording, byte order, and malformed MO rejection" },
  { id: "pomo:stream-readers", focus: "POMO string, file, cached file, and cached int file readers, endian reads, seeks, read_all, and ASCII length behavior" },
  { id: "pomo:malformed-inputs", focus: "missing files, empty files, truncated MO files, unsupported MO revisions, and PO unpoify line-ending normalization" },
  { id: "pomo:generated-replacement-fallback-policy", focus: "generated original-path PHP requirements, preserved fallback conditions, and explicit non-claims" }
];

const COVERED_SYMBOLS = [
  "Translation_Entry",
  "Translation_Entry::__construct",
  "Translation_Entry::Translation_Entry",
  "Translation_Entry::key",
  "Translation_Entry::merge_with",
  "Translations",
  "Translations::add_entry",
  "Translations::add_entry_or_merge",
  "Translations::set_header",
  "Translations::set_headers",
  "Translations::get_header",
  "Translations::translate_entry",
  "Translations::translate",
  "Translations::select_plural_form",
  "Translations::get_plural_forms_count",
  "Translations::translate_plural",
  "Translations::merge_with",
  "Translations::merge_originals_with",
  "Gettext_Translations",
  "Gettext_Translations::gettext_select_plural_form",
  "Gettext_Translations::nplurals_and_expression_from_header",
  "Gettext_Translations::make_plural_form_function",
  "Gettext_Translations::parenthesize_plural_exression",
  "Gettext_Translations::make_headers",
  "NOOP_Translations",
  "Plural_Forms",
  "Plural_Forms::get",
  "Plural_Forms::execute",
  "Plural_Forms::OP_CHARS",
  "Plural_Forms::NUM_CHARS",
  "PO",
  "PO::export_headers",
  "PO::export_entries",
  "PO::export",
  "PO::export_to_file",
  "PO::set_comment_before_headers",
  "PO::poify",
  "PO::unpoify",
  "PO::prepend_each_line",
  "PO::comment_block",
  "PO::export_entry",
  "PO::match_begin_and_end_newlines",
  "PO::import_from_file",
  "PO::read_entry",
  "PO::read_line",
  "PO::add_comment_to_entry",
  "PO::trim_quotes",
  "PO_MAX_LINE_LEN",
  "MO",
  "MO::get_filename",
  "MO::import_from_file",
  "MO::export_to_file",
  "MO::export",
  "MO::is_entry_good_for_export",
  "MO::export_to_file_handle",
  "MO::export_original",
  "MO::export_translations",
  "MO::export_headers",
  "MO::get_byteorder",
  "MO::import_from_reader",
  "MO::make_entry",
  "POMO_Reader",
  "POMO_Reader::readint32",
  "POMO_Reader::readint32array",
  "POMO_Reader::substr",
  "POMO_Reader::strlen",
  "POMO_Reader::str_split",
  "POMO_FileReader",
  "POMO_StringReader",
  "POMO_CachedFileReader",
  "POMO_CachedIntFileReader"
];

const BLOCKED_CONDITIONS = [
  {
    id: "direct-haxe-pomo-runtime",
    status: "blocked",
    reason: "This gate executes copied upstream POMO in oracle and candidate roots only. No Haxe-owned catalog parser, plural evaluator, stream reader, or public PHP replacement is introduced."
  },
  {
    id: "generated-original-path-pomo-shells",
    status: "blocked",
    reason: "Future replacement must emit original-path WPHX PHP preserving POMO class names, conditional declarations, public properties, include timing, native arrays, binary streams, and reflection-visible methods."
  },
  {
    id: "installed-localization-bootstrap",
    status: "blocked",
    reason: "This corpus covers POMO library behavior but does not execute installed WordPress textdomain loading, locale switching, translation caches, admin localization, theme/plugin language files, or database-backed bootstrap."
  },
  {
    id: "copied-pomo-retirement",
    status: "blocked",
    reason: "Copied POMO artifacts stay preserved until WPHX-323.36 accepts a provenance/replacement decision with generated-overlay, bootstrap/admin integration, fallback, and ecosystem evidence."
  }
];

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 120
  }).trim();
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

function mirrorPath(root, path) {
  return `${root}/${path.replace(/^src\//, "")}`;
}

function listFiles(path) {
  const full = upstreamPath(path);
  const stat = statSync(full);
  if (stat.isFile()) return [path];
  return readdirSync(full, { withFileTypes: true })
    .flatMap((entry) => listFiles(`${path}/${entry.name}`))
    .sort();
}

function sourceRecord(path) {
  return {
    path,
    distribution_path: path.replace(/^src\//, ""),
    repo_path: upstreamPath(path),
    bytes: statSync(upstreamPath(path)).size,
    sha256: sha256File(upstreamPath(path))
  };
}

function sourceInventoryRecords(paths) {
  const wanted = new Set(paths);
  return readJsonl(SOURCE_INVENTORY)
    .filter((record) => wanted.has(record.path))
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
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function artifactRecords(paths) {
  const wanted = new Set(paths.map((path) => path.replace(/^src\//, "")));
  return readJsonl(ARTIFACT_PROVENANCE)
    .filter((record) => wanted.has(record.path))
    .map((record) => ({
      path: record.path,
      baseline: record.baseline,
      artifact_kind: record.artifactKind,
      artifact_digest: record.artifactDigest,
      origin: record.origin,
      migration_status: record.migrationStatus,
      classified: record.classified
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
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

function mirrorSources(root) {
  rmSync(root, { recursive: true, force: true });
  for (const path of POMO_FILES) {
    mkdirSync(dirname(mirrorPath(root, path)), { recursive: true });
    copyFileSync(upstreamPath(path), mirrorPath(root, path));
  }
}

function sourceMarkers(path) {
  const content = readFileSync(upstreamPath(path), "utf8");
  return {
    path,
    distribution_path: path.replace(/^src\//, ""),
    conditional_declaration_marker: /class_exists\(/i.test(content),
    deprecated_constructor_marker: /_deprecated_constructor|@deprecated/i.test(content),
    allow_dynamic_properties_marker: /AllowDynamicProperties/.test(content),
    gettext_marker: /gettext|translation|plural|msgid|msgstr|msgctxt|POMO/i.test(content),
    po_marker: /msgid|msgstr|poify|unpoify|PO_MAX_LINE_LEN/i.test(content),
    mo_binary_marker: /pack\(|unpack\(|readint32|byteorder|magic|endian|fseek|fread/i.test(content),
    stream_marker: /POMO_.*Reader|fread|stream_get_contents|seekto|read_all/i.test(content),
    license_or_package_marker: /package pomo|version \$Id|copyright|license/i.test(content)
  };
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
$root = rtrim($argv[1], '/\\\\');
$work = rtrim($argv[2], '/\\\\');

error_reporting(E_ALL);
ini_set('display_errors', 'stderr');
ini_set('log_errors', '0');

if (!is_dir($work)) {
\tmkdir($work, 0777, true);
}

$captured_errors = array();
$deprecated_constructors = array();
set_error_handler(
\tfunction ($errno, $errstr, $errfile, $errline) use (&$captured_errors, $root, $work) {
\t\t$captured_errors[] = array(
\t\t\t'errno' => $errno,
\t\t\t'message_sha256' => wphx_pomo_sha(str_replace(array($root, $work), array('<root>', '<work>'), $errstr)),
\t\t\t'file' => wphx_pomo_norm_path($errfile, $root, $work),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

function _deprecated_constructor($class, $version, $parent_class = '') {
\t$GLOBALS['deprecated_constructors'][] = array(
\t\t'class' => $class,
\t\t'version' => $version,
\t\t'parent_class' => $parent_class,
\t);
}

function wphx_pomo_sha($value) {
\treturn 'sha256:' . hash('sha256', (string) $value);
}

function wphx_pomo_norm_path($path, $root, $work) {
\t$path = str_replace('\\\\', '/', (string) $path);
\t$root = str_replace('\\\\', '/', (string) $root);
\t$work = str_replace('\\\\', '/', (string) $work);
\treturn str_replace(array($root, $work), array('<root>', '<work>'), $path);
}

function wphx_pomo_summary_string($value) {
\treturn array(
\t\t'length' => strlen((string) $value),
\t\t'sha256' => wphx_pomo_sha($value),
\t);
}

function wphx_pomo_capture_warnings($callable) {
\tglobal $root, $work;
\t$warnings = array();
\t$previous = set_error_handler(
\t\tfunction ($errno, $errstr, $errfile, $errline) use (&$warnings, $root, $work) {
\t\t\t$normalized_message = str_replace('\\\\', '/', $errstr);
\t\t\t$normalized_message = str_replace(
\t\t\t\tarray(str_replace('\\\\', '/', $root), str_replace('\\\\', '/', $work)),
\t\t\t\tarray('<root>', '<work>'),
\t\t\t\t$normalized_message
\t\t\t);
\t\t\t$warnings[] = array(
\t\t\t\t'errno' => $errno,
\t\t\t\t'message_sha256' => wphx_pomo_sha($normalized_message),
\t\t\t\t'file' => basename($errfile),
\t\t\t\t'line' => $errline,
\t\t\t);
\t\t\treturn true;
\t\t}
\t);
\t$result = $callable();
\trestore_error_handler();
\tif (null !== $previous) {
\t\tset_error_handler($previous);
\t}
\treturn array('result' => $result, 'warnings' => $warnings);
}

function wphx_pomo_reflect_class($class) {
\t$reflection = new ReflectionClass($class);
\t$methods = array();
\tforeach ($reflection->getMethods() as $method) {
\t\tif ($method->getDeclaringClass()->getName() !== $class) {
\t\t\tcontinue;
\t\t}
\t\t$methods[] = array(
\t\t\t'name' => $method->getName(),
\t\t\t'public' => $method->isPublic(),
\t\t\t'protected' => $method->isProtected(),
\t\t\t'static' => $method->isStatic(),
\t\t\t'parameters' => $method->getNumberOfParameters(),
\t\t\t'required_parameters' => $method->getNumberOfRequiredParameters(),
\t\t);
\t}
\tusort($methods, fn($a, $b) => strcmp($a['name'], $b['name']));
\t$properties = array();
\tforeach ($reflection->getProperties() as $property) {
\t\tif ($property->getDeclaringClass()->getName() !== $class) {
\t\t\tcontinue;
\t\t}
\t\t$properties[] = array(
\t\t\t'name' => $property->getName(),
\t\t\t'public' => $property->isPublic(),
\t\t\t'protected' => $property->isProtected(),
\t\t\t'static' => $property->isStatic(),
\t\t);
\t}
\tusort($properties, fn($a, $b) => strcmp($a['name'], $b['name']));
\treturn array(
\t\t'name' => $class,
\t\t'parent' => ($reflection->getParentClass() ? $reflection->getParentClass()->getName() : null),
\t\t'constants' => $reflection->getConstants(),
\t\t'attributes' => array_map(fn($attribute) => $attribute->getName(), $reflection->getAttributes()),
\t\t'methods' => $methods,
\t\t'properties' => $properties,
\t);
}

require $root . '/wp-includes/pomo/entry.php';
require $root . '/wp-includes/pomo/plural-forms.php';
require $root . '/wp-includes/pomo/translations.php';
require $root . '/wp-includes/pomo/streams.php';
require $root . '/wp-includes/pomo/po.php';
require $root . '/wp-includes/pomo/mo.php';

$observations = array();

$classes = array(
\t'Translation_Entry',
\t'Translations',
\t'Gettext_Translations',
\t'NOOP_Translations',
\t'Plural_Forms',
\t'PO',
\t'MO',
\t'POMO_Reader',
\t'POMO_FileReader',
\t'POMO_StringReader',
\t'POMO_CachedFileReader',
\t'POMO_CachedIntFileReader',
);
$legacy_entry = new Translation_Entry();
$legacy_entry->Translation_Entry(array('singular' => 'legacy', 'translations' => array('legacy-translated')));
$legacy_reader = new POMO_Reader();
$legacy_reader->POMO_Reader();
$observations['pomo:api-reflection-load'] = array(
\t'class_count' => count($classes),
\t'classes' => array_map('wphx_pomo_reflect_class', $classes),
\t'po_max_line_len' => PO_MAX_LINE_LEN,
\t'legacy_entry_key' => $legacy_entry->key(),
\t'legacy_reader_pos' => $legacy_reader->pos(),
\t'deprecated_constructor_count' => count($GLOBALS['deprecated_constructors']),
\t'deprecated_constructors' => $GLOBALS['deprecated_constructors'],
);

$translations = new Translations();
$translations->set_headers(array('Project-Id-Version' => 'WPHX POMO', 'X-Test' => 'Header Value'));
$translations->add_entry(array('singular' => 'Hello', 'translations' => array('Hola')));
$translations->add_entry(array('singular' => 'Save', 'context' => 'button', 'translations' => array('Guardar')));
$translations->add_entry(array('singular' => 'file', 'plural' => 'files', 'translations' => array('archivo', 'archivos')));
$merge_a = new Translation_Entry(array(
\t'singular' => "line\\r\\nbreak",
\t'translations' => array('line break'),
\t'references' => array('a.php:1'),
\t'flags' => array('php-format'),
\t'extracted_comments' => 'first',
));
$merge_b = new Translation_Entry(array(
\t'singular' => "line\\nbreak",
\t'translations' => array('line break two'),
\t'references' => array('b.php:2', 'a.php:1'),
\t'flags' => array('php-format', 'fuzzy'),
\t'extracted_comments' => 'second',
));
$merge_a->merge_with($merge_b);
$translations->add_entry_or_merge($merge_a);
$noop = new NOOP_Translations();
$observations['pomo:entry-translations'] = array(
\t'header_project' => $translations->get_header('Project-Id-Version'),
\t'missing_header' => $translations->get_header('Missing'),
\t'translate_hello' => $translations->translate('Hello'),
\t'translate_missing' => $translations->translate('Missing'),
\t'translate_context_save' => $translations->translate('Save', 'button'),
\t'translate_context_missing' => $translations->translate('Save', 'menu'),
\t'translate_plural_1' => $translations->translate_plural('file', 'files', 1),
\t'translate_plural_2' => $translations->translate_plural('file', 'files', 2),
\t'merge_key' => $merge_a->key(),
\t'merge_references' => $merge_a->references,
\t'merge_flags' => $merge_a->flags,
\t'merge_comments_sha256' => wphx_pomo_sha($merge_a->extracted_comments),
\t'noop_add_entry' => $noop->add_entry(array('singular' => 'x')),
\t'noop_translate' => $noop->translate('Noop'),
\t'noop_plural' => $noop->translate_plural('item', 'items', 4),
);

$plural = new Gettext_Translations();
$plural_header = 'nplurals=3; plural=n%3;';
$plural->set_header('Plural-Forms', $plural_header);
$plural->add_entry(array('singular' => 'thing', 'plural' => 'things', 'translations' => array('one', 'few', 'many')));
$plural_counts = array(0, 1, 2, 5, 11, 21, 22, 25);
$plural_forms = array();
$gettext_plural_forms = array();
$plural_translations = array();
$plural_translations_by_index = array();
foreach ($plural_counts as $count) {
\t$plural_forms[(string) $count] = $plural->select_plural_form($count);
\t$gettext_plural_forms[(string) $count] = $plural->gettext_select_plural_form($count);
\t$plural_translations[(string) $count] = $plural->translate_plural('thing', 'things', $count);
\t$plural_translations_by_index[(string) $count] = array('one', 'few', 'many')[$plural->gettext_select_plural_form($count)];
}
$invalid_plural = new Gettext_Translations();
$invalid_plural->set_header('Plural-Forms', 'nplurals=2; plural=n ?');
$direct_plural = new Plural_Forms('n != 1');
$observations['pomo:plural-forms'] = array(
\t'parsed_header' => $plural->nplurals_and_expression_from_header($plural_header),
\t'nplurals_property' => $plural->_nplurals,
\t'inherited_plural_forms_count' => $plural->get_plural_forms_count(),
\t'inherited_select_forms' => $plural_forms,
\t'gettext_select_forms' => $gettext_plural_forms,
\t'translations' => $plural_translations,
\t'translations_by_selected_index' => $plural_translations_by_index,
\t'invalid_fallback_1' => $invalid_plural->select_plural_form(1),
\t'invalid_fallback_2' => $invalid_plural->select_plural_form(2),
\t'direct_get_0' => $direct_plural->get(0),
\t'direct_get_1' => $direct_plural->get(1),
\t'direct_get_2_cached' => array($direct_plural->get(2), $direct_plural->get(2)),
\t'parenthesized' => $plural->parenthesize_plural_exression('n ? 1 : n ? 2 : 3'),
);

$po_text = <<<'PO'
# Header translator note
msgid ""
msgstr ""
"Project-Id-Version: WPHX POMO 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<12 || n%100>14) ? 1 : 2);\\n"

# Translator comment one
#. Extracted comment one
#: src/file.php:10 src/other.php:20
#, php-format, fuzzy
msgctxt "button"
msgid "Save"
msgstr "Guardar"

msgid "thing"
msgid_plural "things"
msgstr[0] "one"
msgstr[1] "few"
msgstr[2] "many"

msgid ""
"multi"
"line"
msgstr ""
"multi-"
"translated"
PO;
$po_file = $work . '/fixture.po';
file_put_contents($po_file, $po_text);
$po = new PO();
$po_import_ok = $po->import_from_file($po_file);
$po_export = $po->export();
$po_export_file = $work . '/exported.po';
$po_export_file_ok = $po->export_to_file($po_export_file);
$button_entry = $po->entries["button\\4Save"];
$invalid_po_file = $work . '/invalid.po';
file_put_contents($invalid_po_file, "msgid \\"broken\\"\\nmsgid_plural \\"brokens\\"\\nmsgstr \\"wrong\\"\\n");
$invalid_po = new PO();
$observations['pomo:po-import-export'] = array(
\t'import_ok' => $po_import_ok,
\t'entry_count' => count($po->entries),
\t'headers' => $po->headers,
\t'comments_before_headers_sha256' => wphx_pomo_sha($po->comments_before_headers),
\t'button_translation' => $po->translate('Save', 'button'),
\t'button_comments' => array(
\t\t'translator' => $button_entry->translator_comments,
\t\t'extracted' => $button_entry->extracted_comments,
\t\t'references' => $button_entry->references,
\t\t'flags' => $button_entry->flags,
\t),
\t'plural_1' => $po->translate_plural('thing', 'things', 1),
\t'plural_2' => $po->translate_plural('thing', 'things', 2),
\t'plural_5' => $po->translate_plural('thing', 'things', 5),
\t'multiline_translation' => $po->translate('multiline'),
\t'poify_multiline' => wphx_pomo_summary_string(PO::poify("alpha\\nbeta\\t\\"quote\\"")),
\t'unpoify_multiline' => PO::unpoify("\\"\\"\\n\\"alpha\\\\n\\"\\n\\"beta\\\\t\\""),
\t'export' => wphx_pomo_summary_string($po_export),
\t'export_to_file_ok' => $po_export_file_ok,
\t'export_file' => wphx_pomo_summary_string(file_get_contents($po_export_file)),
\t'invalid_import_ok' => $invalid_po->import_from_file($invalid_po_file),
);

$mo = new MO();
$mo->set_headers($po->headers);
$mo->add_entry(array('singular' => 'Save', 'context' => 'button', 'translations' => array('Guardar')));
$mo->add_entry(array('singular' => 'thing', 'plural' => 'things', 'translations' => array('one', 'few', 'many')));
$mo->add_entry(array('singular' => 'empty', 'translations' => array('')));
$mo_file = $work . '/fixture.mo';
$mo_export_to_file_ok = $mo->export_to_file($mo_file);
$mo_export = $mo->export();
$mo_imported = new MO();
$mo_import_ok = $mo_imported->import_from_file($mo_file);
$malformed_mo = new MO();
$malformed_mo_file = $work . '/bad.mo';
file_put_contents($malformed_mo_file, 'not-a-mo');
$truncated_mo = new MO();
$truncated_mo_file = $work . '/truncated.mo';
file_put_contents($truncated_mo_file, pack('V', 0x950412de) . pack('V', 0));
$observations['pomo:mo-roundtrip'] = array(
\t'export_to_file_ok' => $mo_export_to_file_ok,
\t'export' => wphx_pomo_summary_string($mo_export),
\t'file' => wphx_pomo_summary_string(file_get_contents($mo_file)),
\t'import_ok' => $mo_import_ok,
\t'imported_filename_basename' => basename($mo_imported->get_filename()),
\t'imported_entry_count' => count($mo_imported->entries),
\t'imported_headers' => $mo_imported->headers,
\t'imported_context_translation' => $mo_imported->translate('Save', 'button'),
\t'imported_plural_1' => $mo_imported->translate_plural('thing', 'things', 1),
\t'imported_plural_2' => $mo_imported->translate_plural('thing', 'things', 2),
\t'imported_plural_5' => $mo_imported->translate_plural('thing', 'things', 5),
\t'byteorder_little' => $mo_imported->get_byteorder((int) -1794895138),
\t'byteorder_big' => $mo_imported->get_byteorder(((int) -569244523) & 0xFFFFFFFF),
\t'byteorder_invalid' => $mo_imported->get_byteorder(1234),
\t'malformed_import_ok' => $malformed_mo->import_from_file($malformed_mo_file),
\t'truncated_import_ok' => $truncated_mo->import_from_file($truncated_mo_file),
);

$binary_file = $work . '/binary.dat';
file_put_contents($binary_file, 'ABCD' . pack('V', 0x01020304) . 'tail');
$string_reader = new POMO_StringReader('ABCD' . pack('V', 0x01020304) . 'tail');
$read_ab = $string_reader->read(2);
$pos_after_ab = $string_reader->pos();
$string_reader->seekto(4);
$little_int = $string_reader->readint32();
$string_reader->seekto(0);
$all_string = $string_reader->read_all();
$big_reader = new POMO_StringReader(pack('N', 0x01020304));
$big_reader->setEndian('big');
$file_reader = new POMO_FileReader($binary_file);
$cached_reader = new POMO_CachedFileReader($binary_file);
$cached_int_reader = new POMO_CachedIntFileReader($binary_file);
$observations['pomo:stream-readers'] = array(
\t'string_read_ab' => $read_ab,
\t'string_pos_after_ab' => $pos_after_ab,
\t'string_little_int' => $little_int,
\t'string_read_all' => wphx_pomo_summary_string($all_string),
\t'big_int' => $big_reader->readint32(),
\t'file_is_resource' => $file_reader->is_resource(),
\t'file_read_4' => $file_reader->read(4),
\t'file_seekto_4' => $file_reader->seekto(4),
\t'file_readint32' => $file_reader->readint32(),
\t'file_read_all' => wphx_pomo_summary_string($file_reader->read_all()),
\t'cached_length' => $cached_reader->length(),
\t'cached_read_all' => wphx_pomo_summary_string($cached_reader->read_all()),
\t'cached_int_length' => $cached_int_reader->length(),
\t'str_split' => $string_reader->str_split('abcdef', 2),
);
$file_reader->close();

$empty_po = new PO();
$empty_po_file = $work . '/empty.po';
file_put_contents($empty_po_file, '');
$unsupported_revision_mo_file = $work . '/unsupported-revision.mo';
file_put_contents($unsupported_revision_mo_file, pack('V*', 0x950412de, 1, 0, 28, 28, 0, 28));
$unsupported_revision_mo = new MO();
$missing_po = wphx_pomo_capture_warnings(function () use ($work) {
\t$po = new PO();
\treturn $po->import_from_file($work . '/missing.po');
});
$missing_mo = wphx_pomo_capture_warnings(function () use ($work) {
\t$mo = new MO();
\treturn $mo->import_from_file($work . '/missing.mo');
});
$observations['pomo:malformed-inputs'] = array(
\t'missing_po_import_ok' => $missing_po['result'],
\t'missing_po_warning_count' => count($missing_po['warnings']),
\t'missing_po_warnings' => $missing_po['warnings'],
\t'empty_po_import_ok' => $empty_po->import_from_file($empty_po_file),
\t'missing_mo_import_ok' => $missing_mo['result'],
\t'missing_mo_warning_count' => count($missing_mo['warnings']),
\t'missing_mo_warnings' => $missing_mo['warnings'],
\t'unsupported_revision_mo_import_ok' => $unsupported_revision_mo->import_from_file($unsupported_revision_mo_file),
\t'unpoify_crlf' => PO::unpoify("\\"line\\\\r\\\\nnext\\""),
\t'match_newline_begin_end' => PO::match_begin_and_end_newlines('translated', "\\noriginal\\n"),
\t'trim_quotes' => PO::trim_quotes('"quoted"'),
);

$observations['pomo:generated-replacement-fallback-policy'] = array(
\t'direct_haxe_port_candidate' => true,
\t'generated_public_php_replacement_claimed' => false,
\t'haxe_owned_pomo_runtime_claimed' => false,
\t'copied_pomo_artifact_retirement_claimed' => false,
\t'installed_localization_parity_claimed' => false,
\t'fallback_policy' => 'Preserve upstream POMO for catalog parsing, plural evaluation, stream handling, malformed input, and localization bootstrap behavior outside the admitted corpus.',
\t'required_future_gates' => array(
\t\t'generated original-path WPHX PHP preserving POMO class names and public properties',
\t\t'translation cache/bootstrap/admin localization integration',
\t\t'theme/plugin language file and textdomain handoff coverage',
\t\t'license/provenance review before distribution divergence',
\t\t'WPHX-323.36 accepted replacement decision',
\t),
);

ksort($observations);
echo json_encode(
\tarray(
\t\t'observations' => $observations,
\t\t'captured_errors' => $captured_errors,
\t),
\tJSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\\n";
`
  );
}

function runProbe(root, workRoot) {
  rmSync(workRoot, { recursive: true, force: true });
  mkdirSync(workRoot, { recursive: true });
  const output = command("php", [PROBE, root, workRoot]);
  return {
    command: `php ${PROBE} ${root} ${workRoot}`,
    raw_output_sha256: sha256(output),
    result: JSON.parse(output)
  };
}

function lintFiles(root) {
  return POMO_FILES.map((path) => {
    const target = mirrorPath(root, path);
    const output = command("php", ["-l", target]);
    if (!/No syntax errors detected/.test(output)) {
      throw new Error(`PHP lint failed for ${target}: ${output}`);
    }
    return {
      path: target,
      source_path: path,
      output_sha256: sha256(output),
      ok: true
    };
  });
}

function validateInputs({ strategy, localizationGates, vendorClosure, sourceInventory, artifactEvidence }) {
  const failures = [];
  const strategyPlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "pomo");
  const parentGate = localizationGates.gate_plan.find((entry) => entry.id === "pomo-localization-corpus");
  const boundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "pomo");
  const actualFiles = listFiles(POMO_ROOT).filter((path) => path.endsWith(".php")).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(POMO_FILES)) {
    failures.push(`POMO file list drifted: ${actualFiles.join(", ")}`);
  }
  if (strategyPlan?.replacement_strategy !== "direct_haxe_port_preserving_vendor_api") {
    failures.push(`unexpected POMO replacement strategy: ${strategyPlan?.replacement_strategy}`);
  }
  if (parentGate?.downstream_issue.external_ref !== ISSUE.external_ref) {
    failures.push(`WPHX-323.06 POMO gate is not routed to ${ISSUE.external_ref}`);
  }
  if (boundary?.source_inventory.count !== 6 || boundary?.distribution_artifacts.count !== 6 || boundary?.source_tree.php_file_count !== 6) {
    failures.push("WPHX-323 vendor closure POMO counts do not match the expected six PHP files");
  }
  if (sourceInventory.length !== 6) failures.push(`expected 6 source inventory records, found ${sourceInventory.length}`);
  if (artifactEvidence.length !== 6) failures.push(`expected 6 artifact provenance records, found ${artifactEvidence.length}`);
  if (failures.length > 0) {
    throw new Error(`WPHX-323.31 POMO gate failed input validation:\n- ${failures.join("\n- ")}`);
  }
  return { strategyPlan, parentGate, boundary };
}

function main() {
  const strategy = readJson(STRATEGY);
  const localizationGates = readJson(LOCALIZATION_GATES);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const sourceInventory = sourceInventoryRecords(POMO_FILES);
  const artifactEvidence = artifactRecords(POMO_FILES);
  const inputs = validateInputs({ strategy, localizationGates, vendorClosure, sourceInventory, artifactEvidence });

  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe();

  const oracleLint = lintFiles(ORACLE_ROOT);
  const candidateLint = lintFiles(CANDIDATE_ROOT);
  const oracleRun = runProbe(ORACLE_ROOT, ORACLE_WORK);
  const candidateRun = runProbe(CANDIDATE_ROOT, CANDIDATE_WORK);
  const observationsMatch = JSON.stringify(oracleRun.result.observations) === JSON.stringify(candidateRun.result.observations);
  if (!observationsMatch) {
    throw new Error("oracle and candidate POMO observations diverged");
  }

  const validationResult = {
    status: "passed",
    source_php_file_count: POMO_FILES.length,
    source_inventory_record_count: sourceInventory.length,
    artifact_provenance_record_count: artifactEvidence.length,
    covered_symbol_count: COVERED_SYMBOLS.length,
    case_count: CASES.length,
    oracle_candidate_observations_match: observationsMatch,
    oracle_lint_ok: oracleLint.every((entry) => entry.ok),
    candidate_lint_ok: candidateLint.every((entry) => entry.ok),
    reflection_class_count: oracleRun.result.observations["pomo:api-reflection-load"].class_count,
    po_import_ok: oracleRun.result.observations["pomo:po-import-export"].import_ok === true,
    po_invalid_import_rejected: oracleRun.result.observations["pomo:po-import-export"].invalid_import_ok === false,
    mo_roundtrip_import_ok: oracleRun.result.observations["pomo:mo-roundtrip"].import_ok === true,
    mo_malformed_rejected: oracleRun.result.observations["pomo:mo-roundtrip"].malformed_import_ok === false,
    stream_reader_int_ok: oracleRun.result.observations["pomo:stream-readers"].string_little_int === 16909060,
    plural_header_count_ok:
      oracleRun.result.observations["pomo:plural-forms"].nplurals_property === 3 &&
      oracleRun.result.observations["pomo:plural-forms"].gettext_select_forms["2"] === 2 &&
      oracleRun.result.observations["pomo:plural-forms"].gettext_select_forms["5"] === 2,
    fallback_policy_recorded: oracleRun.result.observations["pomo:generated-replacement-fallback-policy"].copied_pomo_artifact_retirement_claimed === false,
    captured_error_count: oracleRun.result.captured_errors.length
  };

  const manifest = {
    schema: "wphx.wp-core.pomo-localization-corpus-gate.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "preserved_pomo_localization_corpus_gate",
    boundary_id: "pomo",
    source_root: POMO_ROOT,
    distribution_root: "wp-includes/pomo",
    inputs: {
      vendor_strategy_manifest: fileRecord(STRATEGY),
      localization_legacy_vendor_gate_manifest: fileRecord(LOCALIZATION_GATES),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      source_inventory: fileRecord(SOURCE_INVENTORY),
      artifact_provenance: fileRecord(ARTIFACT_PROVENANCE)
    },
    replacement_strategy: {
      current_strategy: inputs.strategyPlan.current_strategy,
      planned_strategy: inputs.strategyPlan.replacement_strategy,
      parent_gate_id: inputs.parentGate.id,
      fallback_policy: inputs.parentGate.fallback_policy,
      removal_gate: inputs.parentGate.removal_gate,
      generated_public_wrapper_requirements: inputs.parentGate.generated_public_wrapper_requirements
    },
    source_files: POMO_FILES.map(sourceRecord),
    source_inventory_records: sourceInventory,
    artifact_provenance_records: artifactEvidence,
    package_markers: {
      source_tree_file_count: inputs.boundary.source_tree.file_count,
      php_source_count: inputs.boundary.source_inventory.count,
      distribution_artifact_count: inputs.boundary.distribution_artifacts.count,
      license_provenance: inputs.boundary.license_provenance,
      source_markers: POMO_FILES.map(sourceMarkers)
    },
    fixture: {
      cases: CASES,
      covered_symbols: COVERED_SYMBOLS,
      normalization: [
        "Oracle and candidate roots both execute copied upstream WordPress 7.0 POMO files.",
        "Generated PO and MO bytes are recorded by SHA-256/length, not by embedding full binary output in the receipt.",
        "File paths in PHP warnings are normalized before JSON output.",
        "Deprecated constructor calls are captured through a probe-local _deprecated_constructor stub.",
        "The fixture records local POMO behavior only; installed WordPress localization bootstrap remains blocked."
      ]
    },
    runs: {
      oracle: {
        ...oracleRun,
        lint: oracleLint
      },
      candidate: {
        ...candidateRun,
        lint: candidateLint
      }
    },
    blocked_conditions: BLOCKED_CONDITIONS,
    validation_result: validationResult,
    claims: {
      copied_pomo_files_mirrored: true,
      oracle_candidate_observation_parity_claimed: true,
      po_import_export_corpus_recorded: validationResult.po_import_ok,
      mo_import_export_corpus_recorded: validationResult.mo_roundtrip_import_ok,
      plural_forms_corpus_recorded: validationResult.plural_header_count_ok,
      stream_reader_corpus_recorded: validationResult.stream_reader_int_ok,
      installed_localization_parity_claimed: false,
      haxe_owned_pomo_runtime_claimed: false,
      generated_public_php_replacement_claimed: false,
      copied_pomo_artifact_retirement_claimed: false,
      legal_review_completed_claimed: false
    },
    non_claims: [
      "This gate does not claim Haxe-owned POMO runtime implementation.",
      "This gate does not claim generated public PHP replacement for wp-includes/pomo/*.php.",
      "This gate does not claim copied POMO artifact retirement.",
      "This gate does not execute installed WordPress textdomain loading, locale switching, translation caches, admin localization, theme/plugin language files, or database-backed bootstrap.",
      "This gate does not claim legal review completion; it preserves upstream headers/project notice and records future provenance gates."
    ]
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestText);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-31-pomo-localization-corpus-gate",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    ownership_state: "preserved_upstream_pomo_localization_corpus_gate",
    boundary_id: "pomo",
    source_paths: POMO_FILES,
    distribution_paths: POMO_FILES.map((path) => path.replace(/^src\//, "")),
    emission_strategy: "copied_upstream_pomo_library_with_po_mo_plural_stream_probe",
    durable_haxe_runtime_claimed: false,
    public_php_replacement_claimed: false,
    copied_artifact_retirement_claimed: false,
    generated_overlay_manifest_present: false,
    installed_localization_parity_claimed: false,
    legal_review_complete: false,
    notes: [
      "Oracle and candidate roots execute copied upstream WordPress 7.0 POMO files.",
      "The corpus records PO, MO, plural-form, translation-entry, and stream-reader behavior as a preserved-library floor.",
      "Keep upstream POMO preserved until WPHX-323.36 records an accepted provenance/replacement decision."
    ],
    removal_gates: [
      "non-empty generated overlay manifest for any candidate divergence",
      "generated WPHX PHP original-path POMO class files preserving reflection-visible API and native arrays",
      "PO/MO/plural/stream corpus pass against generated candidate output",
      "installed localization bootstrap/admin/theme/plugin textdomain gates with candidate overlays",
      "license/provenance review and WPHX-323.36 localization legacy provenance decision acceptance"
    ],
    receipt_refs: ["receipt:wphx-323-31-pomo-localization-corpus-gate"]
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-31-pomo-localization-corpus-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "preserved_pomo_localization_corpus_gate",
    artifact_scope: "wordpress-7.0-pomo-preserved-library-po-mo-plural-stream-corpus",
    commands: [
      "npm run wp:core:wphx-323-pomo-localization-corpus",
      "npm run wp:core:wphx-323-pomo-localization-corpus:check"
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
  console.log(`recorded ${CASES.length} POMO cases across ${COVERED_SYMBOLS.length} symbols`);
}

main();
