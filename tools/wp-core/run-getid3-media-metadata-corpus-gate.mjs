#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-h571",
  external_ref: "WPHX-323.19",
  title: "Add getID3 media metadata corpus gate"
};
const RECORDED_AT = "2026-07-08T09:00:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-getid3-media-metadata-corpus-gate.mjs";
const OUT_ROOT = "build/wp-core/wphx-323-19";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/getid3-media-metadata-corpus-probe.php`;
const SOURCE_ROOT = "src/wp-includes/ID3";
const DISTRIBUTION_ROOT = "wp-includes/ID3";
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const MEDIA_GATES = "manifests/wp-core/wphx-323-05-media-security-archive-vendor-replacement-gates.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const ARTIFACT_PROVENANCE = "manifests/artifact-provenance.jsonl";
const WPHX_313_01 = "manifests/wp-core/wphx-313-01-media-filesystem-upload-surface.v1.json";
const WPHX_313_04 = "manifests/wp-core/wphx-313-04-image-metadata-editor-oracle-fixture.v1.json";
const WPHX_313_08 = "manifests/wp-core/wphx-313-08-media-upload-installed-gate.v1.json";
const OUT = "manifests/wp-core/wphx-323-19-getid3-media-metadata-corpus-gate.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-19-getid3-media-metadata-corpus-gate.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-19-getid3-media-metadata-corpus-gate.v1.json";

const SOURCE_FILES = [
  "src/wp-includes/ID3/getid3.lib.php",
  "src/wp-includes/ID3/getid3.php",
  "src/wp-includes/ID3/module.audio-video.asf.php",
  "src/wp-includes/ID3/module.audio-video.flv.php",
  "src/wp-includes/ID3/module.audio-video.matroska.php",
  "src/wp-includes/ID3/module.audio-video.quicktime.php",
  "src/wp-includes/ID3/module.audio-video.riff.php",
  "src/wp-includes/ID3/module.audio.ac3.php",
  "src/wp-includes/ID3/module.audio.dts.php",
  "src/wp-includes/ID3/module.audio.flac.php",
  "src/wp-includes/ID3/module.audio.mp3.php",
  "src/wp-includes/ID3/module.audio.ogg.php",
  "src/wp-includes/ID3/module.tag.apetag.php",
  "src/wp-includes/ID3/module.tag.id3v1.php",
  "src/wp-includes/ID3/module.tag.id3v2.php",
  "src/wp-includes/ID3/module.tag.lyrics3.php"
];
const NOTICE_FILES = ["src/wp-includes/ID3/license.txt", "src/wp-includes/ID3/readme.txt"];
const CASES = [
  { id: "getid3:api-reflection-package", focus: "getID3 class, library helpers, module files, package notices, and runtime options" },
  { id: "getid3:mp3-id3v1", focus: "MP3/ID3 path with deterministic ID3v1 tag and malformed MPEG payload warnings" },
  { id: "getid3:mp3-id3v2-truncated", focus: "truncated ID3v2 header and warning/error normalization" },
  { id: "getid3:wav-riff-pcm", focus: "minimal RIFF/WAVE PCM metadata, bitrate, duration, and audio format fields" },
  { id: "getid3:mp4-quicktime-minimal", focus: "minimal QuickTime/MP4 atom structure and empty-track warning shape" },
  { id: "getid3:flac-streaminfo", focus: "minimal FLAC STREAMINFO marker and parser warning/error behavior" },
  { id: "getid3:ogg-vorbis-truncated", focus: "truncated Ogg page and parser warning/error behavior" },
  { id: "getid3:webm-matroska-truncated", focus: "minimal EBML/WebM marker and Matroska parser warning/error behavior" },
  { id: "getid3:image-jpeg", focus: "image file-format detection and image handoff boundary" },
  { id: "getid3:empty-malformed", focus: "empty, random, and truncated binary hostile-input error normalization" },
  { id: "getid3:wp-media-wrapper-handoff", focus: "source-level wp_read_audio_metadata/wp_read_video_metadata handoff through WPHX-313 media surfaces" },
  { id: "getid3:risk-license-review", focus: "parser-breadth, malformed binary, memory-risk, and license/readme preservation review" }
];
const COVERED_SYMBOLS = [
  "getID3",
  "getID3::__construct",
  "getID3::analyze",
  "getID3::openfile",
  "getID3::include_module",
  "getID3::error",
  "getID3::warning",
  "getid3_lib",
  "getid3_lib::CopyTagsToComments",
  "getid3_mp3",
  "getid3_id3v1",
  "getid3_id3v2",
  "getid3_riff",
  "getid3_quicktime",
  "getid3_flac",
  "getid3_ogg",
  "getid3_matroska",
  "getid3_flv",
  "getid3_asf",
  "getid3_apetag",
  "wp_read_audio_metadata",
  "wp_read_video_metadata",
  "wp_read_image_metadata"
];
const BLOCKED_CONDITIONS = [
  {
    id: "bounded-haxe-parser-subset",
    status: "blocked",
    reason:
      "The gate records upstream getID3 corpus behavior and parser risk only. No bounded Haxe parser subset for any media format is admitted."
  },
  {
    id: "upstream-equivalent-dependency-wrapper",
    status: "blocked",
    reason:
      "No external upstream-equivalent dependency wrapper is selected, packaged, licensed, or proven against WordPress attachment metadata behavior."
  },
  {
    id: "installed-attachment-metadata-parity",
    status: "blocked",
    reason:
      "WPHX-313 media floors and wrapper source markers are reconciled, but this gate does not execute database-backed installed attachment metadata generation."
  },
  {
    id: "copied-getid3-retirement",
    status: "blocked",
    reason:
      "Copied getID3 artifacts remain preserved until WPHX-323.22 accepts a provenance/replacement decision with generated-overlay, corpus, security, license, and ecosystem evidence."
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

function artifactRecords(distributionPaths) {
  const records = readFileSync(ARTIFACT_PROVENANCE, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  return distributionPaths.map((path) => {
    const record = records.find((entry) => entry.path === path);
    if (!record) throw new Error(`artifact provenance record missing for ${path}`);
    return {
      path: record.path,
      baseline: record.baseline,
      artifact_kind: record.artifactKind,
      artifact_digest: record.artifactDigest,
      origin: record.origin,
      migration_status: record.migrationStatus,
      classified: record.classified
    };
  });
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
  for (const path of [...SOURCE_FILES, ...NOTICE_FILES]) {
    mkdirSync(dirname(mirrorPath(root, path)), { recursive: true });
    copyFileSync(upstreamPath(path), mirrorPath(root, path));
  }
}

function sourceMarkers() {
  const getid3 = readFileSync(upstreamPath("src/wp-includes/ID3/getid3.php"), "utf8");
  const lib = readFileSync(upstreamPath("src/wp-includes/ID3/getid3.lib.php"), "utf8");
  const media = readFileSync(upstreamPath("src/wp-admin/includes/media.php"), "utf8");
  const image = readFileSync(upstreamPath("src/wp-admin/includes/image.php"), "utf8");
  return {
    getid3: {
      path: "src/wp-includes/ID3/getid3.php",
      version_marker: /getID3\(\) by James Heinrich|getID3/i.test(getid3),
      analyze_marker: /function analyze\s*\(/.test(getid3),
      include_module_marker: /function include_module\s*\(/.test(getid3),
      warning_marker: /function warning\s*\(/.test(getid3),
      error_marker: /function error\s*\(/.test(getid3),
      temp_dir_marker: /GETID3_TEMP_DIR/.test(getid3),
      php_memory_marker: /memory_get_usage|memory_limit|filesize/i.test(getid3)
    },
    getid3_lib: {
      path: "src/wp-includes/ID3/getid3.lib.php",
      copy_tags_to_comments_marker: /function CopyTagsToComments\s*\(/.test(lib),
      image_size_marker: /GetDataImageSize|image/i.test(lib),
      safe_parse_marker: /BigEndian2Int|LittleEndian2Int|Bin2String/i.test(lib)
    },
    wordpress_wrappers: {
      media_path: "src/wp-admin/includes/media.php",
      image_path: "src/wp-admin/includes/image.php",
      audio_wrapper_marker: /function wp_read_audio_metadata\s*\(/.test(media),
      video_wrapper_marker: /function wp_read_video_metadata\s*\(/.test(media),
      wrapper_getid3_marker: /new getID3\s*\(/.test(media),
      wrapper_analyze_marker: /->analyze\s*\(/.test(media),
      wrapper_copy_tags_marker: /CopyTagsToComments/.test(media),
      image_metadata_marker: /function wp_read_image_metadata\s*\(/.test(image)
    }
  };
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
$root = rtrim($argv[1], '/\\\\');
$fixture_root = $root . '/tmp/wphx-getid3-corpus';

error_reporting(E_ALL);
ini_set('display_errors', 'stderr');
ini_set('log_errors', '0');

if (!defined('GETID3_TEMP_DIR')) {
\tdefine('GETID3_TEMP_DIR', $root . '/tmp/getid3-temp');
}
if (!is_dir(GETID3_TEMP_DIR)) {
\tmkdir(GETID3_TEMP_DIR, 0777, true);
}

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

require $root . '/wp-includes/ID3/getid3.php';

function wphx_getid3_sha($value) {
\treturn 'sha256:' . hash('sha256', (string) $value);
}

function wphx_getid3_put($path, $bytes) {
\t$dir = dirname($path);
\tif (!is_dir($dir)) {
\t\tmkdir($dir, 0777, true);
\t}
\tfile_put_contents($path, $bytes);
}

function wphx_getid3_pad($value, $length) {
\treturn str_pad(substr($value, 0, $length), $length, "\\0");
}

function wphx_getid3_box($type, $payload) {
\treturn pack('N', strlen($payload) + 8) . $type . $payload;
}

function wphx_getid3_make_fixtures($root) {
\tif (is_dir($root)) {
\t\t$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
\t\tforeach ($it as $file) {
\t\t\t$file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
\t\t}
\t}
\tmkdir($root, 0777, true);

\t$id3v1 = 'TAG'
\t\t. wphx_getid3_pad('WPHX Song', 30)
\t\t. wphx_getid3_pad('WPHX Artist', 30)
\t\t. wphx_getid3_pad('WPHX Album', 30)
\t\t. wphx_getid3_pad('2026', 4)
\t\t. wphx_getid3_pad('Fixture comment', 30)
\t\t. chr(13);
\twphx_getid3_put($root . '/id3v1.mp3', str_repeat("\\0", 128) . $id3v1);
\twphx_getid3_put($root . '/truncated-id3v2.mp3', "ID3\\x04\\x00\\x00\\x00\\x00\\x00\\x10WPHX");

\t$pcm = str_repeat("\\0", 320);
\t$fmt = 'fmt ' . pack('V', 16) . pack('v', 1) . pack('v', 1) . pack('V', 8000) . pack('V', 16000) . pack('v', 2) . pack('v', 16);
\t$riff_payload = 'WAVE' . $fmt . 'data' . pack('V', strlen($pcm)) . $pcm;
\twphx_getid3_put($root . '/pcm.wav', 'RIFF' . pack('V', strlen($riff_payload)) . $riff_payload);

\t$ftyp = wphx_getid3_box('ftyp', 'isom' . pack('N', 0x00000200) . 'isomiso2mp41');
\t$moov = wphx_getid3_box('moov', '');
\twphx_getid3_put($root . '/minimal.mp4', $ftyp . $moov);

\t$streaminfo = str_repeat("\\0", 34);
\twphx_getid3_put($root . '/minimal.flac', 'fLaC' . "\\x80\\x00\\x00\\x22" . $streaminfo);
\twphx_getid3_put($root . '/truncated.ogg', "OggS\\x00\\x02" . str_repeat("\\0", 22) . "\\x00");
\twphx_getid3_put($root . '/truncated.webm', "\\x1A\\x45\\xDF\\xA3\\x9F\\x42\\x86\\x81\\x01\\x42\\xF7\\x81\\x01\\x42\\xF2\\x81\\x04\\x42\\xF3\\x81\\x08");
\twphx_getid3_put($root . '/minimal.flv', "FLV\\x01\\x05\\x00\\x00\\x00\\x09\\x00\\x00\\x00\\x00");
\twphx_getid3_put($root . '/tiny.jpg', base64_decode('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Al//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z'));
\twphx_getid3_put($root . '/empty.bin', '');
\twphx_getid3_put($root . '/random.bin', "WPHX-not-media-" . str_repeat("\\xff\\x00", 8));
\twphx_getid3_put($root . '/truncated.bin', "\\x00\\x00\\x00\\x20ftyp");

\treturn array(
\t\t'getid3:mp3-id3v1' => $root . '/id3v1.mp3',
\t\t'getid3:mp3-id3v2-truncated' => $root . '/truncated-id3v2.mp3',
\t\t'getid3:wav-riff-pcm' => $root . '/pcm.wav',
\t\t'getid3:mp4-quicktime-minimal' => $root . '/minimal.mp4',
\t\t'getid3:flac-streaminfo' => $root . '/minimal.flac',
\t\t'getid3:ogg-vorbis-truncated' => $root . '/truncated.ogg',
\t\t'getid3:webm-matroska-truncated' => $root . '/truncated.webm',
\t\t'getid3:image-jpeg' => $root . '/tiny.jpg',
\t\t'getid3:empty-bin' => $root . '/empty.bin',
\t\t'getid3:random-malformed' => $root . '/random.bin',
\t\t'getid3:truncated-binary' => $root . '/truncated.bin',
\t);
}

function wphx_getid3_message_summary($messages, $root) {
\tif (!is_array($messages)) {
\t\treturn array();
\t}
\t$out = array();
\tforeach ($messages as $message) {
\t\t$out[] = wphx_getid3_sha(str_replace($root, '<fixture>', (string) $message));
\t}
\tsort($out);
\treturn $out;
}

function wphx_getid3_value_summary($value) {
\tif (is_array($value)) {
\t\t$keys = array_keys($value);
\t\tsort($keys);
\t\treturn array('kind' => 'array', 'keys' => $keys, 'count' => count($keys));
\t}
\tif (is_bool($value) || is_int($value) || is_float($value) || $value === null) {
\t\treturn $value;
\t}
\treturn array('kind' => gettype($value), 'length' => strlen((string) $value), 'sha256' => wphx_getid3_sha((string) $value));
}

function wphx_getid3_tag_summary($values) {
\tif (!is_array($values)) {
\t\treturn array();
\t}
\t$out = array();
\tforeach ($values as $family => $tags) {
\t\tif (!is_array($tags)) {
\t\t\tcontinue;
\t\t}
\t\t$tag_keys = array_keys($tags);
\t\tsort($tag_keys);
\t\t$out[$family] = array('keys' => $tag_keys, 'count' => count($tag_keys));
\t}
\tksort($out);
\treturn $out;
}

function wphx_getid3_format_summary($data) {
\treturn array(
\t\t'fileformat' => $data['fileformat'] ?? null,
\t\t'mime_type' => $data['mime_type'] ?? null,
\t\t'encoding' => $data['encoding'] ?? null,
\t\t'filesize' => $data['filesize'] ?? null,
\t\t'playtime_seconds' => isset($data['playtime_seconds']) ? round((float) $data['playtime_seconds'], 6) : null,
\t\t'bitrate' => isset($data['bitrate']) ? (int) round((float) $data['bitrate']) : null,
\t\t'audio' => array(
\t\t\t'present' => isset($data['audio']),
\t\t\t'dataformat' => $data['audio']['dataformat'] ?? null,
\t\t\t'codec' => $data['audio']['codec'] ?? null,
\t\t\t'sample_rate' => $data['audio']['sample_rate'] ?? null,
\t\t\t'channels' => $data['audio']['channels'] ?? null,
\t\t\t'bits_per_sample' => $data['audio']['bits_per_sample'] ?? null,
\t\t),
\t\t'video' => array(
\t\t\t'present' => isset($data['video']),
\t\t\t'dataformat' => $data['video']['dataformat'] ?? null,
\t\t\t'codec' => $data['video']['codec'] ?? null,
\t\t\t'resolution_x' => $data['video']['resolution_x'] ?? null,
\t\t\t'resolution_y' => $data['video']['resolution_y'] ?? null,
\t\t),
\t);
}

function wphx_getid3_analyze($root, $case_id, $path) {
\t$getid3 = new getID3();
\t$getid3->encoding = 'UTF-8';
\t$data = $getid3->analyze($path);
\tif (class_exists('getid3_lib')) {
\t\tgetid3_lib::CopyTagsToComments($data);
\t}
\t$top_keys = array_keys($data);
\tsort($top_keys);
\t$summary = wphx_getid3_format_summary($data);
\t$summary['case_id'] = $case_id;
\t$summary['fixture'] = basename($path);
\t$summary['fixture_sha256'] = wphx_getid3_sha(file_get_contents($path));
\t$summary['top_level_keys'] = $top_keys;
\t$summary['tags'] = wphx_getid3_tag_summary($data['tags'] ?? array());
\t$summary['comments'] = wphx_getid3_tag_summary($data['comments'] ?? array());
\t$summary['warnings_count'] = isset($data['warning']) && is_array($data['warning']) ? count($data['warning']) : 0;
\t$summary['warnings_sha256'] = wphx_getid3_message_summary($data['warning'] ?? array(), dirname($path));
\t$summary['errors_count'] = isset($data['error']) && is_array($data['error']) ? count($data['error']) : 0;
\t$summary['errors_sha256'] = wphx_getid3_message_summary($data['error'] ?? array(), dirname($path));
\t$summary['quicktime'] = wphx_getid3_value_summary($data['quicktime'] ?? null);
\t$summary['riff'] = wphx_getid3_value_summary($data['riff'] ?? null);
\t$summary['flac'] = wphx_getid3_value_summary($data['flac'] ?? null);
\t$summary['ogg'] = wphx_getid3_value_summary($data['ogg'] ?? null);
\t$summary['matroska'] = wphx_getid3_value_summary($data['matroska'] ?? null);
\tksort($summary);
\treturn $summary;
}

$fixture_paths = wphx_getid3_make_fixtures($fixture_root);
$observations = array();

$reflection_methods = array();
foreach (array('__construct', 'analyze', 'openfile', 'include_module', 'error', 'warning') as $method) {
\t$reflection = new ReflectionMethod('getID3', $method);
\t$reflection_methods[] = array(
\t\t'name' => $method,
\t\t'public' => $reflection->isPublic(),
\t\t'static' => $reflection->isStatic(),
\t\t'parameters' => $reflection->getNumberOfParameters(),
\t\t'required_parameters' => $reflection->getNumberOfRequiredParameters(),
\t);
}
$observations['getid3:api-reflection-package'] = array(
\t'php_version' => PHP_VERSION,
\t'class_exists' => class_exists('getID3'),
\t'lib_class_exists' => class_exists('getid3_lib'),
\t'version' => defined('GETID3_VERSION') ? GETID3_VERSION : null,
\t'temp_dir_defined' => defined('GETID3_TEMP_DIR'),
\t'temp_dir_basename' => basename(GETID3_TEMP_DIR),
\t'methods' => $reflection_methods,
\t'fixture_count' => count($fixture_paths),
);

foreach ($fixture_paths as $case_id => $path) {
\t$group = str_starts_with($case_id, 'getid3:empty') || str_starts_with($case_id, 'getid3:random') || str_starts_with($case_id, 'getid3:truncated-binary')
\t\t? 'getid3:empty-malformed'
\t\t: $case_id;
\t$observations[$group][$case_id] = wphx_getid3_analyze($fixture_root, $case_id, $path);
}
$observations['getid3:wp-media-wrapper-handoff'] = array(
\t'wrappers_executed' => false,
\t'wrapper_source_markers_recorded_in_manifest' => true,
\t'wphx_313_floor_reconciled_by_runner' => true,
\t'claim' => 'This gate records getID3 corpus behavior and wrapper handoff markers only; installed attachment metadata generation is out of scope.',
);
$observations['getid3:risk-license-review'] = array(
\t'preserve_upstream_getid3_fallback' => true,
\t'bounded_haxe_parser_subset_admitted' => false,
\t'upstream_equivalent_dependency_wrapper_admitted' => false,
\t'hostile_binary_input_review_required_before_replacement' => true,
\t'license_and_readme_notice_preservation_required' => true,
);

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

function validateInputs({ strategy, mediaGates, vendorClosure, artifacts }) {
  const failures = [];
  const strategyPlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "getid3");
  const mediaGate = mediaGates.gate_plan.find((entry) => entry.id === "getid3-media-metadata-corpus");
  const boundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "getid3");
  if (strategyPlan?.replacement_strategy !== "renewed_preserved_artifact_exception_with_tests_provenance") {
    failures.push(`unexpected getID3 replacement strategy: ${strategyPlan?.replacement_strategy}`);
  }
  if (mediaGate?.downstream_issue.external_ref !== ISSUE.external_ref) {
    failures.push(`WPHX-323.05 getID3 gate is not routed to ${ISSUE.external_ref}`);
  }
  if (boundary?.source_tree.file_count !== 18 || boundary?.source_inventory.count !== 16 || boundary?.distribution_artifacts.count !== 16) {
    failures.push("WPHX-323 vendor closure getID3 counts do not match 18 source-tree files and 16 PHP artifacts");
  }
  if (artifacts.length !== SOURCE_FILES.length) {
    failures.push(`expected ${SOURCE_FILES.length} getID3 artifact provenance records, found ${artifacts.length}`);
  }
  for (const path of [WPHX_313_01, WPHX_313_04, WPHX_313_08]) {
    if (!existsSync(path)) failures.push(`required WPHX-313 behavior floor is missing: ${path}`);
  }
  if (failures.length > 0) {
    throw new Error(`WPHX-323.19 getID3 gate failed input validation:\n- ${failures.join("\n- ")}`);
  }
  return { strategyPlan, mediaGate, boundary };
}

function lintAll(root) {
  return SOURCE_FILES.map((path) => {
    const target = mirrorPath(root, path);
    const output = command("php", ["-l", target]);
    const ok = /No syntax errors detected/.test(output);
    if (!ok) throw new Error(`PHP lint failed for ${target}: ${output}`);
    return {
      path: target.replace(`${root}/`, ""),
      command: `php -l ${target}`,
      output_sha256: sha256(output),
      ok
    };
  });
}

function main() {
  const strategy = readJson(STRATEGY);
  const mediaGates = readJson(MEDIA_GATES);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const artifacts = artifactRecords(SOURCE_FILES.map((path) => path.replace(/^src\//, "")));
  const inputs = validateInputs({ strategy, mediaGates, vendorClosure, artifacts });
  const markers = sourceMarkers();

  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe();

  const oracleLint = lintAll(ORACLE_ROOT);
  const candidateLint = lintAll(CANDIDATE_ROOT);
  const oracleRun = runProbe(ORACLE_ROOT);
  const candidateRun = runProbe(CANDIDATE_ROOT);
  const observationsMatch = JSON.stringify(oracleRun.result.observations) === JSON.stringify(candidateRun.result.observations);
  if (!observationsMatch) {
    throw new Error("oracle and candidate getID3 observations diverged");
  }

  const corpus = oracleRun.result.observations;
  const validationResult = {
    status: "passed",
    source_tree_file_count: inputs.boundary.source_tree.file_count,
    source_php_file_count: SOURCE_FILES.length,
    notice_file_count: NOTICE_FILES.length,
    artifact_provenance_record_count: artifacts.length,
    covered_symbol_count: COVERED_SYMBOLS.length,
    case_count: CASES.length,
    direct_corpus_fixture_count: corpus["getid3:api-reflection-package"].fixture_count,
    oracle_candidate_observations_match: observationsMatch,
    oracle_lint_ok: oracleLint.every((entry) => entry.ok),
    candidate_lint_ok: candidateLint.every((entry) => entry.ok),
    wav_riff_audio_detected:
      corpus["getid3:wav-riff-pcm"]["getid3:wav-riff-pcm"].fileformat === "wav" &&
      corpus["getid3:wav-riff-pcm"]["getid3:wav-riff-pcm"].audio.dataformat === "wav",
    mp3_id3_tag_path_exercised: Object.keys(corpus["getid3:mp3-id3v1"]["getid3:mp3-id3v1"].tags).includes("id3v1"),
    malformed_error_or_warning_cases: Object.values(corpus["getid3:empty-malformed"]).filter(
      (entry) => entry.errors_count > 0 || entry.warnings_count > 0
    ).length,
    wrapper_handoff_markers_recorded: markers.wordpress_wrappers.audio_wrapper_marker && markers.wordpress_wrappers.video_wrapper_marker,
    license_notice_preservation_recorded: inputs.boundary.license_provenance.package_notice_files.length === 2,
    captured_error_count: oracleRun.result.captured_errors.length
  };

  const manifest = {
    schema: "wphx.wp-core.getid3-media-metadata-corpus-gate.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "preserved_getid3_media_metadata_corpus_gate",
    boundary_id: "getid3",
    source_root: SOURCE_ROOT,
    distribution_root: DISTRIBUTION_ROOT,
    inputs: {
      vendor_strategy_manifest: fileRecord(STRATEGY),
      media_security_archive_gate_manifest: fileRecord(MEDIA_GATES),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      wphx_313_media_surface_manifest: fileRecord(WPHX_313_01),
      wphx_313_image_metadata_editor_fixture_manifest: fileRecord(WPHX_313_04),
      wphx_313_media_upload_installed_gate_manifest: fileRecord(WPHX_313_08)
    },
    replacement_strategy: {
      current_strategy: inputs.strategyPlan.current_strategy,
      planned_strategy: inputs.strategyPlan.replacement_strategy,
      parent_gate_id: inputs.mediaGate.id,
      gate_kind: inputs.mediaGate.gate_kind,
      fallback_policy: inputs.mediaGate.fallback_policy,
      removal_gate: inputs.mediaGate.removal_gate
    },
    source_files: SOURCE_FILES.map(sourceRecord),
    notice_files: NOTICE_FILES.map(sourceRecord),
    artifact_provenance: artifacts,
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
        "Tiny binary fixtures are generated under build/ at probe time; media blobs are not committed.",
        "Raw metadata values, paths, warnings, errors, and tags are summarized by stable keys, counts, primitive fields, and SHA-256 digests.",
        "Malformed and truncated fixture observations are expected parser behavior, not replacement readiness for hostile binary input.",
        "WordPress wp_read_audio_metadata/wp_read_video_metadata wrapper execution is not claimed; wrapper source handoff markers and WPHX-313 floors are recorded."
      ]
    },
    runs: {
      oracle: {
        ...oracleRun,
        lint: {
          file_count: oracleLint.length,
          results: oracleLint
        }
      },
      candidate: {
        ...candidateRun,
        lint: {
          file_count: candidateLint.length,
          results: candidateLint
        }
      }
    },
    behavior_floors: [
      {
        id: "wphx-313-01-media-filesystem-upload-surface",
        manifest: WPHX_313_01,
        role: "media/upload source inventory that records wp_read_audio_metadata and wp_read_video_metadata wrapper ownership"
      },
      {
        id: "wphx-313-04-image-metadata-editor-oracle-fixture",
        manifest: WPHX_313_04,
        role: "image metadata/editor fixture floor for wp_read_image_metadata and image handoff behavior"
      },
      {
        id: "wphx-313-08-media-upload-installed-gate",
        manifest: WPHX_313_08,
        role: "installed-style media/upload bridge floor; referenced as package context, not installed getID3 route execution"
      }
    ],
    risk_review: {
      parser_breadth: "getID3 covers many binary container, audio, video, and tag formats beyond the deterministic corpus; preserve upstream outside any later admitted subset.",
      malformed_binary_inputs: "Malformed/truncated observations are recorded, but this is not a fuzzing campaign, memory-safety proof, or hostile-input security audit.",
      memory_and_resource_use: "Source markers record filesize/memory-sensitive paths. Replacement requires bounded resource policy and adversarial media corpus evidence.",
      license_and_notice: "Preserve wp-includes/ID3/license.txt and wp-includes/ID3/readme.txt plus WordPress project notice while this remains a preserved artifact."
    },
    blocked_conditions: BLOCKED_CONDITIONS,
    validation_result: validationResult,
    claims: {
      copied_getid3_package_mirrored: true,
      direct_getid3_corpus_observation_parity_claimed: true,
      wphx_313_wrapper_handoff_markers_recorded: validationResult.wrapper_handoff_markers_recorded,
      behavior_parity_claimed: false,
      installed_attachment_metadata_parity_claimed: false,
      bounded_haxe_parser_subset_claimed: false,
      upstream_equivalent_dependency_wrapper_claimed: false,
      haxe_owned_media_parser_claimed: false,
      generated_public_php_replacement_claimed: false,
      copied_getid3_artifact_retirement_claimed: false
    },
    non_claims: [
      "This gate does not claim Haxe-owned getID3 or media parser implementation.",
      "This gate does not claim a bounded Haxe parser subset or an upstream-equivalent dependency wrapper.",
      "This gate does not claim generated public PHP replacement for wp-includes/ID3 files.",
      "This gate does not claim copied getID3 artifact retirement.",
      "This gate does not execute wp_read_audio_metadata, wp_read_video_metadata, or database-backed installed attachment metadata generation.",
      "This gate does not prove broad media metadata parity, hostile binary input safety, memory-safety, or complete getID3 format coverage."
    ]
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestText);

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    manifest_id: "ownership:wp-core/wphx-323-19-getid3-media-metadata-corpus-gate",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    ownership_state: "preserved_upstream_getid3_media_metadata_corpus_gate",
    boundary_id: "getid3",
    source_paths: [SOURCE_ROOT],
    distribution_paths: [DISTRIBUTION_ROOT],
    emission_strategy: "copied_upstream_vendor_package_with_direct_getid3_corpus_probe",
    durable_haxe_runtime_claimed: false,
    public_php_replacement_claimed: false,
    installed_wordpress_parity_claimed: false,
    copied_artifact_retirement_claimed: false,
    generated_overlay_manifest_present: false,
    security_review_complete: false,
    notes: [
      "Oracle and candidate roots execute copied upstream WordPress 7.0 getID3 files against a deterministic synthetic corpus.",
      "WordPress media wrappers are represented by source handoff markers and WPHX-313 floor manifests, not by installed attachment metadata execution.",
      "Keep upstream getID3 preserved until WPHX-323.22 records an accepted provenance/replacement decision."
    ],
    removal_gates: [
      "non-empty generated overlay manifest for any candidate divergence",
      "bounded Haxe parser subset or upstream-equivalent dependency wrapper admission with corpus evidence",
      "WordPress wp_read_audio_metadata/wp_read_video_metadata wrapper behavior evidence through WPHX-313 media surfaces",
      "hostile binary input, resource, license, and ecosystem compatibility review",
      "WPHX-323.22 media/security/archive provenance decision acceptance"
    ],
    receipt_refs: ["receipt:wphx-323-19-getid3-media-metadata-corpus-gate"]
  };
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-19-getid3-media-metadata-corpus-gate",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "preserved_getid3_media_metadata_corpus_gate",
    artifact_scope: "wordpress-7.0-getid3-preserved-package-media-metadata-corpus",
    commands: [
      "npm run wp:core:wphx-323-getid3-media-metadata-corpus",
      "npm run wp:core:wphx-323-getid3-media-metadata-corpus:check"
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
  console.log(`recorded ${CASES.length} getID3 cases across ${COVERED_SYMBOLS.length} symbols`);
}

main();
