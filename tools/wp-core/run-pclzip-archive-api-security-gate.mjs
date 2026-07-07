#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-rq2t",
  external_ref: "WPHX-323.20",
  title: "Add PclZip archive API and security gate"
};
const RECORDED_AT = "2026-07-08T07:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-pclzip-archive-api-security-gate.mjs";
const OUT_ROOT = "build/wp-core/wphx-323-20";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/pclzip-archive-api-security-probe.php`;
const SOURCE_FILE = "src/wp-admin/includes/class-pclzip.php";
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const MEDIA_GATES = "manifests/wp-core/wphx-323-05-media-security-archive-vendor-replacement-gates.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const WPHX_319_01 = "manifests/wp-core/wphx-319-01-updates-installers-recovery-surface.v1.json";
const WPHX_319_03 = "manifests/wp-core/wphx-319-03-updates-installers-recovery-oracle-fixture.v1.json";
const OUT = "manifests/wp-core/wphx-323-20-pclzip-archive-api-security-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-20-pclzip-archive-api-security-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-20-pclzip-archive-api-security-gate.v1.json";

const CASES = [
  { id: "pclzip:api-reflection-constants", focus: "PclZip class, public methods, public fields, helper functions, constants, and host ZipArchive support" },
  { id: "pclzip:create-add-list-ziparchive", focus: "create/add/list/properties behavior compared with ZipArchive names and content summaries" },
  { id: "pclzip:extract-callbacks-index-string", focus: "extract, extractByIndex, EXTRACT_AS_STRING, named callback skip behavior, and callback event shape" },
  { id: "pclzip:delete-duplicate-merge", focus: "delete by name, deprecated deleteByIndex, duplicate, merge, and resulting archive contents" },
  { id: "pclzip:malformed-error-shape", focus: "malformed archive handling and ZipArchive open-code comparison" },
  { id: "pclzip:traversal-restriction", focus: "PCLZIP_OPT_EXTRACT_DIR_RESTRICTION blocks traversal archive extraction in a sandbox" },
  { id: "pclzip:overwrite-permissions-security", focus: "default overwrite behavior and SET_CHMOD extraction permissions in a sandbox" },
  { id: "pclzip:callback-closure-boundary", focus: "legacy callback option rejects closures on this PHP host, preserving named-function callback requirements" }
];
const COVERED_SYMBOLS = [
  "PclZip",
  "PclZip::__construct",
  "PclZip::PclZip",
  "PclZip::create",
  "PclZip::add",
  "PclZip::listContent",
  "PclZip::extract",
  "PclZip::extractByIndex",
  "PclZip::delete",
  "PclZip::deleteByIndex",
  "PclZip::duplicate",
  "PclZip::merge",
  "PclZip::properties",
  "PclZip::errorCode",
  "PclZip::errorName",
  "PclZip::errorInfo",
  "PCLZIP_OPT_PATH",
  "PCLZIP_OPT_ADD_PATH",
  "PCLZIP_OPT_REMOVE_PATH",
  "PCLZIP_OPT_REMOVE_ALL_PATH",
  "PCLZIP_OPT_EXTRACT_AS_STRING",
  "PCLZIP_OPT_EXTRACT_DIR_RESTRICTION",
  "PCLZIP_OPT_SET_CHMOD",
  "PCLZIP_OPT_BY_NAME",
  "PCLZIP_OPT_BY_INDEX",
  "PCLZIP_OPT_REPLACE_NEWER",
  "PCLZIP_CB_PRE_ADD",
  "PCLZIP_CB_POST_ADD",
  "PCLZIP_CB_PRE_EXTRACT",
  "PCLZIP_CB_POST_EXTRACT",
  "PCLZIP_ERR_INVALID_ZIP",
  "PCLZIP_ERR_DIRECTORY_RESTRICTION",
  "PclZipUtilPathInclusion",
  "PclZipUtilPathReduction",
  "PclZipUtilTranslateWinPath"
];
const BLOCKED_CONDITIONS = [
  {
    id: "ziparchive-backed-replacement-runtime",
    status: "blocked",
    reason:
      "ZipArchive is used only as a host primitive differential oracle. No ZipArchive-backed generated WPHX adapter, Haxe-owned runtime, or public PHP replacement is introduced."
  },
  {
    id: "installer-upgrader-installed-integration",
    status: "blocked",
    reason:
      "The gate reconciles WPHX-319 installer/upgrader floors but does not execute installed update, plugin/theme install, filesystem transport, credential, rollback, or recovery flows."
  },
  {
    id: "symlink-and-platform-permission-matrix",
    status: "blocked",
    reason:
      "The gate records traversal, overwrite, chmod, and source-review markers. Symlink preservation/extraction semantics, Windows path behavior, umask variance, and archive permission portability need a dedicated platform matrix before replacement."
  },
  {
    id: "copied-pclzip-retirement",
    status: "blocked",
    reason:
      "Copied class-pclzip.php stays preserved until WPHX-323.22 accepts a provenance/replacement decision with generated-overlay, installer/upgrader, security, and ecosystem evidence."
  }
];

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 80
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

function upstreamPath(path) {
  return `${UPSTREAM_ROOT}/${path}`;
}

function mirrorPath(root, path) {
  return `${root}/${path.replace(/^src\//, "")}`;
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

function artifactRecord(distributionPath) {
  return readFileSync(ARTIFACT_PROVENANCE, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .find((record) => record.path === distributionPath);
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
  mkdirSync(dirname(mirrorPath(root, SOURCE_FILE)), { recursive: true });
  copyFileSync(upstreamPath(SOURCE_FILE), mirrorPath(root, SOURCE_FILE));
}

function sourceMarkers() {
  const content = readFileSync(upstreamPath(SOURCE_FILE), "utf8");
  return {
    path: SOURCE_FILE,
    distribution_path: SOURCE_FILE.replace(/^src\//, ""),
    pclzip_version_marker: /Zip Module 2\.8\.2/.test(content),
    lgpl_header_marker: /License GNU\/LGPL/i.test(content),
    warning_header_marker: /use of this software is at the risk of the user/i.test(content),
    traversal_restriction_marker: /PCLZIP_OPT_EXTRACT_DIR_RESTRICTION|PclZipUtilPathInclusion/i.test(content),
    chmod_marker: /PCLZIP_OPT_SET_CHMOD|chmod/i.test(content),
    overwrite_marker: /PCLZIP_OPT_REPLACE_NEWER|overwrite|file_exists/i.test(content),
    symlink_marker: /symlink|linkinfo|readlink|lstat/i.test(content),
    callback_marker: /PCLZIP_CB_PRE_ADD|PCLZIP_CB_PRE_EXTRACT|function_exists/i.test(content)
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

$captured_errors = array();
set_error_handler(
\tfunction ($errno, $errstr, $errfile, $errline) use (&$captured_errors, $root) {
\t\t$captured_errors[] = array(
\t\t\t'errno' => $errno,
\t\t\t'message_sha256' => 'sha256:' . hash('sha256', str_replace($root, '<root>', $errstr)),
\t\t\t'file' => str_replace($root, '<root>', str_replace('\\\\', '/', $errfile)),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

require $root . '/wp-admin/includes/class-pclzip.php';

$callback_events = array();

function wphx_pclzip_sha($value) {
\treturn 'sha256:' . hash('sha256', (string) $value);
}

function wphx_pclzip_norm($path) {
\tglobal $root;
\treturn str_replace('\\\\', '/', str_replace($root, '<root>', (string) $path));
}

function wphx_pclzip_pre_add($event, $header) {
\tglobal $callback_events;
\t$callback_events[] = array(
\t\t'callback' => 'pre_add',
\t\t'event' => $event,
\t\t'filename' => wphx_pclzip_norm($header['filename'] ?? ''),
\t);
\treturn str_ends_with($header['filename'] ?? '', 'skip.txt') ? 0 : 1;
}

function wphx_pclzip_post_add($event, $header) {
\tglobal $callback_events;
\t$callback_events[] = array(
\t\t'callback' => 'post_add',
\t\t'event' => $event,
\t\t'stored_filename' => $header['stored_filename'] ?? null,
\t\t'status' => $header['status'] ?? null,
\t);
\treturn 1;
}

function wphx_pclzip_pre_extract($event, $header) {
\tglobal $callback_events;
\t$callback_events[] = array(
\t\t'callback' => 'pre_extract',
\t\t'event' => $event,
\t\t'filename' => isset($header['filename']) ? wphx_pclzip_norm($header['filename']) : null,
\t);
\treturn str_ends_with($header['filename'] ?? '', 'beta.txt') ? 0 : 1;
}

function wphx_pclzip_post_extract($event, $header) {
\tglobal $callback_events;
\t$callback_events[] = array(
\t\t'callback' => 'post_extract',
\t\t'event' => $event,
\t\t'filename' => isset($header['filename']) ? wphx_pclzip_norm($header['filename']) : null,
\t\t'status' => $header['status'] ?? null,
\t);
\treturn 1;
}

function wphx_pclzip_reset_dir($path) {
\tif (is_dir($path)) {
\t\t$iterator = new RecursiveIteratorIterator(
\t\t\tnew RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
\t\t\tRecursiveIteratorIterator::CHILD_FIRST
\t\t);
\t\tforeach ($iterator as $file) {
\t\t\t$file->isDir() && !$file->isLink() ? rmdir($file->getPathname()) : unlink($file->getPathname());
\t\t}
\t\trmdir($path);
\t}
\tmkdir($path, 0777, true);
}

function wphx_pclzip_write_file($path, $content) {
\t$dir = dirname($path);
\tif (!is_dir($dir)) {
\t\tmkdir($dir, 0777, true);
\t}
\tfile_put_contents($path, $content);
\ttouch($path, 1700000000);
}

function wphx_pclzip_summary_entry($entry) {
\t$summary = array(
\t\t'filename' => $entry['filename'] ?? null,
\t\t'stored_filename' => $entry['stored_filename'] ?? null,
\t\t'size' => $entry['size'] ?? null,
\t\t'compressed_size' => $entry['compressed_size'] ?? null,
\t\t'folder' => $entry['folder'] ?? null,
\t\t'index' => $entry['index'] ?? null,
\t\t'status' => $entry['status'] ?? null,
\t\t'crc' => $entry['crc'] ?? null,
\t);
\tif (isset($entry['content'])) {
\t\t$summary['content'] = array('length' => strlen($entry['content']), 'sha256' => wphx_pclzip_sha($entry['content']));
\t}
\tforeach (array('filename', 'stored_filename') as $key) {
\t\tif (isset($summary[$key])) {
\t\t\t$summary[$key] = wphx_pclzip_norm($summary[$key]);
\t\t}
\t}
\treturn $summary;
}

function wphx_pclzip_summary_list($list) {
\tif (!is_array($list)) {
\t\treturn $list;
\t}
\t$summary = array_map('wphx_pclzip_summary_entry', $list);
\tusort($summary, fn($a, $b) => strcmp((string) ($a['stored_filename'] ?? $a['filename']), (string) ($b['stored_filename'] ?? $b['filename'])));
\treturn $summary;
}

function wphx_pclzip_error($archive) {
\treturn array(
\t\t'code' => $archive->errorCode(),
\t\t'name' => $archive->errorName(true),
\t\t'info_sha256' => wphx_pclzip_sha(wphx_pclzip_norm($archive->errorInfo(true))),
\t);
}

function wphx_ziparchive_summary($zip_path) {
\tif (!class_exists('ZipArchive')) {
\t\treturn array('available' => false);
\t}
\t$zip = new ZipArchive();
\t$open = $zip->open($zip_path);
\tif (true !== $open) {
\t\treturn array('available' => true, 'open' => $open);
\t}
\t$entries = array();
\tfor ($i = 0; $i < $zip->numFiles; $i++) {
\t\t$stat = $zip->statIndex($i);
\t\t$name = $stat['name'];
\t\t$content = $zip->getFromIndex($i);
\t\t$entries[] = array(
\t\t\t'name' => $name,
\t\t\t'size' => $stat['size'],
\t\t\t'compressed_size' => $stat['comp_size'],
\t\t\t'crc' => $stat['crc'],
\t\t\t'content' => false === $content ? null : array('length' => strlen($content), 'sha256' => wphx_pclzip_sha($content)),
\t\t);
\t}
\t$zip->close();
\tusort($entries, fn($a, $b) => strcmp($a['name'], $b['name']));
\treturn array('available' => true, 'open' => true, 'entries' => $entries);
}

function wphx_reflect_method($method) {
\t$reflection = new ReflectionMethod('PclZip', $method);
\treturn array(
\t\t'name' => $method,
\t\t'public' => $reflection->isPublic(),
\t\t'static' => $reflection->isStatic(),
\t\t'parameters' => $reflection->getNumberOfParameters(),
\t\t'required_parameters' => $reflection->getNumberOfRequiredParameters(),
\t);
}

function wphx_closure_callback_probe($zip_path, $file_path) {
\t$archive = new PclZip($zip_path);
\ttry {
\t\t$result = $archive->create(array($file_path), PCLZIP_OPT_REMOVE_ALL_PATH, PCLZIP_CB_PRE_ADD, function () {
\t\t\treturn 1;
\t\t});
\t\treturn array('ok' => true, 'result' => wphx_pclzip_summary_list($result), 'error' => wphx_pclzip_error($archive));
\t} catch (Throwable $throwable) {
\t\treturn array(
\t\t\t'ok' => false,
\t\t\t'error_class' => get_class($throwable),
\t\t\t'message_sha256' => wphx_pclzip_sha($throwable->getMessage()),
\t\t);
\t}
}

$work = $root . '/fixture-work';
wphx_pclzip_reset_dir($work);
$src = $work . '/src';
$extract = $work . '/extract';
$zip_path = $work . '/pclzip.zip';
$ziparchive_path = $work . '/ziparchive.zip';
$second_zip = $work . '/second.zip';
$duplicate_zip = $work . '/duplicate.zip';
$malformed_zip = $work . '/malformed.zip';
$traversal_zip = $work . '/traversal.zip';
$overwrite_zip = $work . '/overwrite.zip';

wphx_pclzip_write_file($src . '/alpha.txt', 'alpha-content');
wphx_pclzip_write_file($src . '/nested/beta.txt', 'beta-content');
wphx_pclzip_write_file($src . '/skip.txt', 'skip-content');
wphx_pclzip_write_file($src . '/overwrite.txt', 'archive-version');

$observations = array();
$observations['pclzip:api-reflection-constants'] = array(
\t'php_version' => PHP_VERSION,
\t'zlib_loaded' => extension_loaded('zlib'),
\t'ziparchive_available' => class_exists('ZipArchive'),
\t'class_exists' => class_exists('PclZip'),
\t'public_properties' => array_keys(get_class_vars('PclZip')),
\t'methods' => array_map('wphx_reflect_method', array('create', 'add', 'listContent', 'extract', 'extractByIndex', 'delete', 'deleteByIndex', 'duplicate', 'merge', 'properties', 'errorCode', 'errorName', 'errorInfo')),
\t'constants' => array(
\t\t'PCLZIP_READ_BLOCK_SIZE' => PCLZIP_READ_BLOCK_SIZE,
\t\t'PCLZIP_SEPARATOR' => PCLZIP_SEPARATOR,
\t\t'PCLZIP_OPT_PATH' => PCLZIP_OPT_PATH,
\t\t'PCLZIP_OPT_ADD_PATH' => PCLZIP_OPT_ADD_PATH,
\t\t'PCLZIP_OPT_REMOVE_PATH' => PCLZIP_OPT_REMOVE_PATH,
\t\t'PCLZIP_OPT_EXTRACT_AS_STRING' => PCLZIP_OPT_EXTRACT_AS_STRING,
\t\t'PCLZIP_OPT_EXTRACT_DIR_RESTRICTION' => PCLZIP_OPT_EXTRACT_DIR_RESTRICTION,
\t\t'PCLZIP_CB_PRE_ADD' => PCLZIP_CB_PRE_ADD,
\t\t'PCLZIP_CB_PRE_EXTRACT' => PCLZIP_CB_PRE_EXTRACT,
\t\t'PCLZIP_ERR_DIRECTORY_RESTRICTION' => PCLZIP_ERR_DIRECTORY_RESTRICTION,
\t),
);

$archive = new PclZip($zip_path);
$create = $archive->create(
\tarray($src . '/alpha.txt', $src . '/nested/beta.txt', $src . '/skip.txt'),
\tPCLZIP_OPT_REMOVE_PATH,
\t$src,
\tPCLZIP_OPT_ADD_PATH,
\t'pkg',
\tPCLZIP_CB_PRE_ADD,
\t'wphx_pclzip_pre_add',
\tPCLZIP_CB_POST_ADD,
\t'wphx_pclzip_post_add'
);
$add = $archive->add(
\tarray($src . '/overwrite.txt'),
\tPCLZIP_OPT_REMOVE_PATH,
\t$src,
\tPCLZIP_OPT_ADD_PATH,
\t'pkg'
);
$list = $archive->listContent();
$props = $archive->properties();

$zip_compare = array('available' => class_exists('ZipArchive'));
if (class_exists('ZipArchive')) {
\t$zip = new ZipArchive();
\t$zip->open($ziparchive_path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
\tforeach (array('alpha.txt', 'nested/beta.txt', 'overwrite.txt') as $name) {
\t\t$zip->addFile($src . '/' . $name, 'pkg/' . $name);
\t}
\t$zip->close();
\t$zip_compare = array(
\t\t'available' => true,
\t\t'pclzip_archive' => wphx_ziparchive_summary($zip_path),
\t\t'ziparchive_archive' => wphx_ziparchive_summary($ziparchive_path),
\t);
}
$observations['pclzip:create-add-list-ziparchive'] = array(
\t'create' => wphx_pclzip_summary_list($create),
\t'add' => wphx_pclzip_summary_list($add),
\t'list' => wphx_pclzip_summary_list($list),
\t'properties' => $props,
\t'error' => wphx_pclzip_error($archive),
\t'ziparchive_differential' => $zip_compare,
);

wphx_pclzip_reset_dir($extract);
$extract_all = $archive->extract(
\tPCLZIP_OPT_PATH,
\t$extract,
\tPCLZIP_CB_PRE_EXTRACT,
\t'wphx_pclzip_pre_extract',
\tPCLZIP_CB_POST_EXTRACT,
\t'wphx_pclzip_post_extract'
);
$extract_string = $archive->extractByIndex('0', PCLZIP_OPT_EXTRACT_AS_STRING);
$observations['pclzip:extract-callbacks-index-string'] = array(
\t'extract' => wphx_pclzip_summary_list($extract_all),
\t'extract_by_index_string' => wphx_pclzip_summary_list($extract_string),
\t'alpha_exists' => file_exists($extract . '/pkg/alpha.txt'),
\t'beta_skipped' => !file_exists($extract . '/pkg/nested/beta.txt'),
\t'callback_events' => $callback_events,
);

$second = new PclZip($second_zip);
$second->create(array(array(PCLZIP_ATT_FILE_NAME => 'virtual-gamma.txt', PCLZIP_ATT_FILE_CONTENT => 'gamma-content', PCLZIP_ATT_FILE_MTIME => 1700000000)));
$duplicate = new PclZip($duplicate_zip);
$duplicate_result = $duplicate->duplicate($zip_path);
$merge_result = $duplicate->merge($second);
$delete_result = $duplicate->delete(PCLZIP_OPT_BY_NAME, 'pkg/overwrite.txt');
$delete_by_index_result = $duplicate->deleteByIndex('0');
$observations['pclzip:delete-duplicate-merge'] = array(
\t'duplicate_result' => $duplicate_result,
\t'merge_result' => $merge_result,
\t'delete_result' => wphx_pclzip_summary_list($delete_result),
\t'delete_by_index_result' => wphx_pclzip_summary_list($delete_by_index_result),
\t'final_list' => wphx_pclzip_summary_list($duplicate->listContent()),
\t'ziparchive_final' => wphx_ziparchive_summary($duplicate_zip),
);

file_put_contents($malformed_zip, 'not-a-zip');
$bad = new PclZip($malformed_zip);
$bad_list = $bad->listContent();
$zip_bad = class_exists('ZipArchive') ? (new ZipArchive())->open($malformed_zip) : null;
$observations['pclzip:malformed-error-shape'] = array(
\t'pclzip_list_result' => $bad_list,
\t'pclzip_error' => wphx_pclzip_error($bad),
\t'ziparchive_open_result' => $zip_bad,
);

if (class_exists('ZipArchive')) {
\t$zip = new ZipArchive();
\t$zip->open($traversal_zip, ZipArchive::CREATE | ZipArchive::OVERWRITE);
\t$zip->addFromString('../escape.txt', 'owned');
\t$zip->addFromString('safe.txt', 'safe');
\t$zip->close();
}
$traversal = new PclZip($traversal_zip);
$restriction_dir = $work . '/restricted';
wphx_pclzip_reset_dir($restriction_dir);
file_put_contents($work . '/escape.txt', 'original');
$traversal_result = $traversal->extract(
\tPCLZIP_OPT_PATH,
\t$restriction_dir,
\tPCLZIP_OPT_EXTRACT_DIR_RESTRICTION,
\t$restriction_dir
);
$observations['pclzip:traversal-restriction'] = array(
\t'ziparchive_available' => class_exists('ZipArchive'),
\t'extract_result' => wphx_pclzip_summary_list($traversal_result),
\t'error' => wphx_pclzip_error($traversal),
\t'outside_file_preserved' => file_get_contents($work . '/escape.txt') === 'original',
\t'safe_file_not_written_after_stop' => !file_exists($restriction_dir . '/safe.txt'),
);

$overwrite_archive = new PclZip($overwrite_zip);
$overwrite_archive->create(array(array(PCLZIP_ATT_FILE_NAME => 'overwrite.txt', PCLZIP_ATT_FILE_CONTENT => 'archive-version', PCLZIP_ATT_FILE_MTIME => 1700000000)));
$overwrite_dir = $work . '/overwrite-out';
wphx_pclzip_reset_dir($overwrite_dir);
wphx_pclzip_write_file($overwrite_dir . '/overwrite.txt', 'existing-version');
$overwrite_result = $overwrite_archive->extract(PCLZIP_OPT_PATH, $overwrite_dir, PCLZIP_OPT_SET_CHMOD, 0640);
$perms = substr(sprintf('%o', fileperms($overwrite_dir . '/overwrite.txt')), -4);
$observations['pclzip:overwrite-permissions-security'] = array(
\t'extract_result' => wphx_pclzip_summary_list($overwrite_result),
\t'overwritten_content_sha256' => wphx_pclzip_sha(file_get_contents($overwrite_dir . '/overwrite.txt')),
\t'overwritten_content_length' => strlen(file_get_contents($overwrite_dir . '/overwrite.txt')),
\t'permissions' => $perms,
\t'set_chmod_honored' => $perms === '0640',
);

$observations['pclzip:callback-closure-boundary'] = wphx_closure_callback_probe($work . '/closure.zip', $src . '/alpha.txt');

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

function runProbe(root) {
  const output = command("php", [PROBE, root]);
  return {
    command: `php ${PROBE} ${root}`,
    raw_output_sha256: sha256(output),
    result: JSON.parse(output)
  };
}

function validateInputs({ strategy, mediaGates, vendorClosure, artifact }) {
  const failures = [];
  const strategyPlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "pclzip");
  const mediaGate = mediaGates.gate_plan.find((entry) => entry.id === "pclzip-api-ziparchive-security");
  const boundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "pclzip");
  if (strategyPlan?.replacement_strategy !== "host_primitive_backed_reimplementation_with_preserved_fallback") {
    failures.push(`unexpected PclZip replacement strategy: ${strategyPlan?.replacement_strategy}`);
  }
  if (mediaGate?.downstream_issue.external_ref !== ISSUE.external_ref) {
    failures.push(`WPHX-323.05 PclZip gate is not routed to ${ISSUE.external_ref}`);
  }
  if (boundary?.source_inventory.count !== 1 || boundary?.distribution_artifacts.count !== 1) {
    failures.push("WPHX-323 vendor closure PclZip counts do not match the expected single PHP file");
  }
  if (!artifact) failures.push("artifact provenance record missing for wp-admin/includes/class-pclzip.php");
  for (const path of [WPHX_319_01, WPHX_319_03]) {
    if (!existsSync(path)) failures.push(`required WPHX-319 behavior floor is missing: ${path}`);
  }
  if (failures.length > 0) {
    throw new Error(`WPHX-323.20 PclZip gate failed input validation:\n- ${failures.join("\n- ")}`);
  }
  return { strategyPlan, mediaGate, boundary };
}

function main() {
  const strategy = readJson(STRATEGY);
  const mediaGates = readJson(MEDIA_GATES);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const artifact = artifactRecord("wp-admin/includes/class-pclzip.php");
  const inputs = validateInputs({ strategy, mediaGates, vendorClosure, artifact });
  const markers = sourceMarkers();

  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe();

  const oracleLint = command("php", ["-l", mirrorPath(ORACLE_ROOT, SOURCE_FILE)]);
  const candidateLint = command("php", ["-l", mirrorPath(CANDIDATE_ROOT, SOURCE_FILE)]);
  const oracleRun = runProbe(ORACLE_ROOT);
  const candidateRun = runProbe(CANDIDATE_ROOT);
  const observationsMatch = JSON.stringify(oracleRun.result.observations) === JSON.stringify(candidateRun.result.observations);
  if (!/No syntax errors detected/.test(oracleLint) || !/No syntax errors detected/.test(candidateLint)) {
    throw new Error("PclZip PHP lint failed");
  }
  if (!observationsMatch) {
    throw new Error("oracle and candidate PclZip observations diverged");
  }

  const validationResult = {
    status: "passed",
    source_php_file_count: 1,
    artifact_provenance_record_count: artifact ? 1 : 0,
    covered_symbol_count: COVERED_SYMBOLS.length,
    case_count: CASES.length,
    oracle_candidate_observations_match: observationsMatch,
    oracle_lint_ok: true,
    candidate_lint_ok: true,
    ziparchive_available: oracleRun.result.observations["pclzip:api-reflection-constants"].ziparchive_available,
    zlib_loaded: oracleRun.result.observations["pclzip:api-reflection-constants"].zlib_loaded,
    captured_error_count: oracleRun.result.captured_errors.length,
    traversal_restriction_recorded: oracleRun.result.observations["pclzip:traversal-restriction"].outside_file_preserved === true,
    chmod_case_recorded: oracleRun.result.observations["pclzip:overwrite-permissions-security"].set_chmod_honored === true,
    closure_callback_boundary_recorded: oracleRun.result.observations["pclzip:callback-closure-boundary"].ok === false
  };

  const manifest = {
    schema: "wphx.wp-core.pclzip-archive-api-security-gate.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "preserved_pclzip_archive_api_ziparchive_security_gate",
    boundary_id: "pclzip",
    source_path: SOURCE_FILE,
    distribution_path: "wp-admin/includes/class-pclzip.php",
    inputs: {
      vendor_strategy_manifest: fileRecord(STRATEGY),
      media_security_archive_gate_manifest: fileRecord(MEDIA_GATES),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      wphx_319_surface_manifest: fileRecord(WPHX_319_01),
      wphx_319_oracle_fixture_manifest: fileRecord(WPHX_319_03)
    },
    replacement_strategy: {
      current_strategy: inputs.strategyPlan.current_strategy,
      planned_strategy: inputs.strategyPlan.replacement_strategy,
      parent_gate_id: inputs.mediaGate.id,
      fallback_policy: inputs.mediaGate.fallback_policy,
      removal_gate: inputs.mediaGate.removal_gate
    },
    source_files: [sourceRecord(SOURCE_FILE)],
    artifact_provenance: [
      {
        path: artifact.path,
        baseline: artifact.baseline,
        artifact_kind: artifact.artifactKind,
        artifact_digest: artifact.artifactDigest,
        origin: artifact.origin,
        migration_status: artifact.migrationStatus,
        classified: artifact.classified
      }
    ],
    package_markers: {
      source_tree_file_count: inputs.boundary.source_tree.file_count,
      php_source_count: inputs.boundary.source_inventory.count,
      distribution_artifact_count: inputs.boundary.distribution_artifacts.count,
      license_provenance: inputs.boundary.license_provenance,
      source_markers: markers
    },
    fixture: {
      cases: CASES,
      covered_symbols: COVERED_SYMBOLS,
      normalization: [
        "Archive entry filenames are normalized relative to the fixture root.",
        "Extracted contents are recorded by length and SHA-256 digest.",
        "PclZip errorInfo strings are hashed after fixture-root normalization.",
        "ZipArchive is used as a host primitive differential oracle only when available."
      ]
    },
    runs: {
      oracle: {
        ...oracleRun,
        lint: {
          command: `php -l ${mirrorPath(ORACLE_ROOT, SOURCE_FILE)}`,
          output_sha256: sha256(oracleLint),
          ok: true
        }
      },
      candidate: {
        ...candidateRun,
        lint: {
          command: `php -l ${mirrorPath(CANDIDATE_ROOT, SOURCE_FILE)}`,
          output_sha256: sha256(candidateLint),
          ok: true
        }
      }
    },
    behavior_floors: [
      {
        id: "wphx-319-01-updates-installers-recovery-surface",
        manifest: WPHX_319_01,
        role: "updates/installers/recovery surface inventory that records PclZip archive handoffs"
      },
      {
        id: "wphx-319-03-updates-installers-recovery-oracle-fixture",
        manifest: WPHX_319_03,
        role: "updater/recovery copied-oracle fixture floor adjacent to archive extraction behavior"
      }
    ],
    blocked_conditions: BLOCKED_CONDITIONS,
    validation_result: validationResult,
    claims: {
      copied_pclzip_file_mirrored: true,
      oracle_candidate_observation_parity_claimed: true,
      ziparchive_host_primitive_differential_recorded: validationResult.ziparchive_available,
      installer_upgrader_installed_parity_claimed: false,
      haxe_owned_archive_runtime_claimed: false,
      generated_public_php_replacement_claimed: false,
      copied_pclzip_artifact_retirement_claimed: false
    },
    non_claims: [
      "This gate does not claim Haxe-owned PclZip or archive runtime implementation.",
      "This gate does not claim a ZipArchive-backed WPHX replacement implementation.",
      "This gate does not claim generated public PHP replacement for wp-admin/includes/class-pclzip.php.",
      "This gate does not claim copied class-pclzip.php artifact retirement.",
      "This gate does not execute installed WordPress update, plugin/theme install, filesystem transport, rollback, recovery, credential, or browser flows.",
      "This gate does not complete symlink, Windows-path, umask, permission portability, or broad ecosystem archive compatibility review."
    ]
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestText);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-20-pclzip-archive-api-security-gate",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    ownership_state: "preserved_upstream_pclzip_archive_api_ziparchive_security_gate",
    boundary_id: "pclzip",
    source_paths: [SOURCE_FILE],
    distribution_paths: ["wp-admin/includes/class-pclzip.php"],
    emission_strategy: "copied_upstream_legacy_library_file_with_ziparchive_differential_probe",
    durable_haxe_runtime_claimed: false,
    public_php_replacement_claimed: false,
    copied_artifact_retirement_claimed: false,
    generated_overlay_manifest_present: false,
    security_review_complete: false,
    notes: [
      "Oracle and candidate roots execute copied upstream WordPress 7.0 class-pclzip.php.",
      "ZipArchive is used only as a host primitive comparison for archive names/content and malformed-open behavior.",
      "Keep upstream PclZip preserved until WPHX-323.22 records an accepted provenance/replacement decision."
    ],
    removal_gates: [
      "non-empty generated overlay manifest for any candidate divergence",
      "generated ZipArchive-backed or Haxe-owned adapter evidence with PclZip API compatibility",
      "archive security matrix for traversal, symlink, overwrite, chmod/umask, malformed archives, and platform paths",
      "WPHX-319 installer/upgrader installed integration pass with candidate overlays",
      "WPHX-323.22 media/security/archive provenance decision acceptance"
    ],
    receipt_refs: ["receipt:wphx-323-20-pclzip-archive-api-security-gate"]
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-20-pclzip-archive-api-security-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "preserved_pclzip_archive_api_ziparchive_security_gate",
    artifact_scope: "wordpress-7.0-pclzip-preserved-library-ziparchive-differential-security",
    commands: [
      "npm run wp:core:wphx-323-pclzip-archive-api-security",
      "npm run wp:core:wphx-323-pclzip-archive-api-security:check"
    ],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      parent_media_security_archive_gate_manifest: MEDIA_GATES,
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
  console.log(`recorded ${CASES.length} PclZip cases across ${COVERED_SYMBOLS.length} symbols`);
}

main();
