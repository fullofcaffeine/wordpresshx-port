#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const ISSUE = {
  id: "wordpresshx-l76.34",
  external_ref: "WPHX-323.14",
  title: "Add SimplePie API/reflection and feed corpus fixture"
};
const RECORDED_AT = "2026-07-08T01:30:00.000Z";
const UPSTREAM_ROOT = "../wordpress-develop";
const RUNNER = "tools/wp-core/run-simplepie-api-reflection-corpus-fixture.mjs";
const OUT_ROOT = "build/wp-core/wphx-323-14";
const ORACLE_ROOT = `${OUT_ROOT}/oracle`;
const CANDIDATE_ROOT = `${OUT_ROOT}/candidate`;
const PROBE = `${OUT_ROOT}/simplepie-api-corpus-probe.php`;
const STRATEGY = "manifests/wp-core/wphx-323-01-php-vendor-replacement-strategy.v1.json";
const FEED_GATES = "manifests/wp-core/wphx-323-04-feed-vendor-replacement-gates.v1.json";
const VENDOR_CLOSURE = "manifests/wp-core/wphx-323-php-vendor-manifest-closure.v1.json";
const OUT = "manifests/wp-core/wphx-323-14-simplepie-api-reflection-corpus-fixture.v1.json";
const OWNERSHIP = "manifests/ownership/wphx-323-14-simplepie-api-reflection-corpus-fixture.v1.json";
const RECEIPT = "receipts/wp-core/wphx-323-14-simplepie-api-reflection-corpus-fixture.v1.json";

const SIMPLEPIE_ROOT = "src/wp-includes/SimplePie";
const SUPPORT_FILES = ["src/wp-includes/class-simplepie.php"];
const CASES = [
  { id: "simplepie-api:modern-symbol-reflection", focus: "namespaced SimplePie classes, interfaces, constants, properties, and method signatures" },
  { id: "simplepie-api:legacy-symbol-reflection", focus: "legacy SimplePie class alias, SimplePie_Autoloader, SimplePie_* constants, and compatibility files" },
  { id: "simplepie-corpus:rss2-rich-item", focus: "RSS2 channel/item title, author, category, enclosure, namespace, date, and sanitized HTML observations" },
  { id: "simplepie-corpus:atom10-rich-entry", focus: "Atom 1.0 title, alternate link, author, category, updated date, content, and namespace observations" },
  { id: "simplepie-corpus:rdf-rss10", focus: "RDF/RSS 1.0 channel/item shape and dc namespace observations" },
  { id: "simplepie-corpus:malformed-feed", focus: "malformed XML failure and parser error shape" },
  { id: "simplepie-api:generated-wrapper-gates", focus: "future generated wrappers must preserve autoload, API/reflection, corpus, and overlay manifests" }
];

const REQUIRED_AREAS = [
  "SimplePie\\SimplePie namespaced public API",
  "legacy SimplePie class alias and SIMPLEPIE_* constants",
  "SimplePie_Autoloader and class-simplepie.php load behavior",
  "SimplePie\\Item, Author, Category, Enclosure, Registry, Parser, Sanitize, Misc, Locator, Source, and HTTP/Cache helper families",
  "public constants, properties, method signatures, constructor signatures, and reflection-visible files",
  "RSS2, Atom 1.0, RDF/RSS 1.0, malformed XML, charsets, dates, categories, authors, enclosures, namespaces, and error observations",
  "PSR HTTP/cache dependency markers recorded as wrapper/dependency blockers rather than replacement evidence"
];

const FEED_CORPUS = {
  "rss2-rich-item": `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>WPHX RSS Channel</title>
    <link>https://example.test/feed</link>
    <description>RSS channel description</description>
    <language>en-US</language>
    <item>
      <title>RSS Item &amp; Entities</title>
      <link>https://example.test/posts/rss-item</link>
      <guid isPermaLink="false">rss-guid-1</guid>
      <pubDate>Tue, 07 Jul 2026 12:34:56 +0000</pubDate>
      <dc:creator>RSS Author</dc:creator>
      <category domain="topic">Porting</category>
      <description><![CDATA[<p>Rich <strong>RSS</strong> description.</p>]]></description>
      <enclosure url="https://example.test/audio.mp3" length="12345" type="audio/mpeg" />
      <media:thumbnail url="https://example.test/thumb.jpg" />
    </item>
  </channel>
</rss>`,
  "atom10-rich-entry": `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>WPHX Atom Feed</title>
  <link href="https://example.test/atom" rel="alternate" />
  <id>tag:example.test,2026:atom</id>
  <updated>2026-07-07T12:34:56Z</updated>
  <entry>
    <title>Atom Entry</title>
    <link href="https://example.test/posts/atom-entry" rel="alternate" />
    <id>tag:example.test,2026:atom-entry</id>
    <updated>2026-07-07T12:35:56Z</updated>
    <author><name>Atom Author</name><email>atom@example.test</email></author>
    <category term="templates" label="Templates" />
    <content type="html">&lt;p&gt;Atom &lt;em&gt;content&lt;/em&gt; body.&lt;/p&gt;</content>
  </entry>
</feed>`,
  "rdf-rss10": `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel rdf:about="https://example.test/rdf">
    <title>WPHX RDF Channel</title>
    <link>https://example.test/rdf</link>
    <description>RDF channel description</description>
    <items><rdf:Seq><rdf:li rdf:resource="https://example.test/posts/rdf-item" /></rdf:Seq></items>
  </channel>
  <item rdf:about="https://example.test/posts/rdf-item">
    <title>RDF Item</title>
    <link>https://example.test/posts/rdf-item</link>
    <dc:creator>RDF Author</dc:creator>
    <dc:date>2026-07-07T12:36:56Z</dc:date>
    <description>RDF item description</description>
  </item>
</rdf:RDF>`,
  "malformed-feed": `<?xml version="1.0" encoding="UTF-8"?><rss><channel><title>Broken</title><item><title>Unclosed`
};

function command(commandName, commandArgs) {
  return execFileSync(commandName, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 160
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
    repo_path: upstreamPath(path),
    bytes: statSync(upstreamPath(path)).size,
    sha256: sha256File(upstreamPath(path))
  };
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

function phpClassFromSimplePieSource(path) {
  if (!path.startsWith(`${SIMPLEPIE_ROOT}/src/`) || !path.endsWith(".php")) return null;
  return `SimplePie\\${path
    .slice(`${SIMPLEPIE_ROOT}/src/`.length, -".php".length)
    .split("/")
    .join("\\")}`;
}

function legacyClassFromLibrarySource(path) {
  if (!path.startsWith(`${SIMPLEPIE_ROOT}/library/`) || !path.endsWith(".php")) return null;
  if (path.endsWith("/gzdecode.php")) return null;
  return path
    .slice(`${SIMPLEPIE_ROOT}/library/`.length, -".php".length)
    .split("/")
    .join("_");
}

function mirrorSources(root) {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(mirrorPath(root, SIMPLEPIE_ROOT), { recursive: true });
  cpSync(upstreamPath(SIMPLEPIE_ROOT), mirrorPath(root, SIMPLEPIE_ROOT), { recursive: true });
  for (const path of SUPPORT_FILES) {
    mkdirSync(dirname(mirrorPath(root, path)), { recursive: true });
    copyFileSync(upstreamPath(path), mirrorPath(root, path));
  }
}

function writeProbe({ modernSymbols, legacySymbols }) {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php
namespace Psr\\Http\\Client {
\tinterface ClientInterface {}
\tinterface ClientExceptionInterface {}
\tinterface NetworkExceptionInterface extends ClientExceptionInterface {}
\tinterface RequestExceptionInterface extends ClientExceptionInterface {}
}
namespace Psr\\Http\\Message {
\tinterface MessageInterface {}
\tinterface RequestInterface extends MessageInterface {}
\tinterface ResponseInterface extends MessageInterface {}
\tinterface StreamInterface {}
\tinterface UriInterface {}
\tinterface RequestFactoryInterface {}
\tinterface UriFactoryInterface {}
}
namespace Psr\\SimpleCache {
\tinterface CacheInterface {}
\tinterface InvalidArgumentException {}
}
namespace {
$root = rtrim($argv[1], '/\\\\');
$corpus_json = $argv[2] ?? '{}';
$feed_corpus = json_decode($corpus_json, true);

error_reporting(E_ALL);
ini_set('display_errors', 'stderr');
ini_set('log_errors', '0');

define('ABSPATH', $root . '/');
define('WPINC', 'wp-includes');

$captured_errors = array();
$deprecated_functions = array();
set_error_handler(
\tfunction ($errno, $errstr, $errfile, $errline) use (&$captured_errors, $root) {
\t\t$captured_errors[] = array(
\t\t\t'errno' => $errno,
\t\t\t'message' => $errstr,
\t\t\t'file' => wphx_relative_path($errfile, $root),
\t\t\t'line' => $errline,
\t\t);
\t\treturn true;
\t}
);

function _deprecated_function($function, $version, $replacement = '') {
\t$GLOBALS['deprecated_functions'][] = array(
\t\t'function' => $function,
\t\t'version' => $version,
\t\t'replacement' => $replacement,
\t);
}

function wphx_relative_path($path, $root) {
\t$real = realpath($path);
\t$base = realpath($root);
\tif (false !== $real && false !== $base && 0 === strpos($real, $base . DIRECTORY_SEPARATOR)) {
\t\treturn str_replace('\\\\', '/', substr($real, strlen($base) + 1));
\t}
\treturn str_replace('\\\\', '/', (string) $path);
}

function wphx_type($type) {
\treturn $type ? (string) $type : null;
}

function wphx_value($value) {
\tif (is_array($value)) {
\t\treturn array(
\t\t\t'kind' => 'array',
\t\t\t'count' => count($value),
\t\t\t'keys' => array_slice(array_map('strval', array_keys($value)), 0, 20),
\t\t);
\t}
\tif (is_object($value)) {
\t\treturn array('kind' => 'object', 'class' => get_class($value));
\t}
\tif (is_resource($value)) {
\t\treturn array('kind' => 'resource', 'type' => get_resource_type($value));
\t}
\treturn $value;
}

function wphx_param(ReflectionParameter $param) {
\t$record = array(
\t\t'name' => $param->getName(),
\t\t'type' => wphx_type($param->getType()),
\t\t'optional' => $param->isOptional(),
\t\t'by_ref' => $param->isPassedByReference(),
\t\t'variadic' => $param->isVariadic(),
\t\t'allows_null' => $param->allowsNull(),
\t);
\ttry {
\t\tif ($param->isDefaultValueAvailable()) {
\t\t\t$record['default'] = wphx_value($param->getDefaultValue());
\t\t} elseif ($param->isDefaultValueConstant()) {
\t\t\t$record['default_constant'] = $param->getDefaultValueConstantName();
\t\t}
\t} catch (ReflectionException $exception) {
\t\t$record['default_unavailable'] = $exception->getMessage();
\t}
\treturn $record;
}

function wphx_method(ReflectionMethod $method, $root) {
\treturn array(
\t\t'name' => $method->getName(),
\t\t'declaring_class' => $method->getDeclaringClass()->getName(),
\t\t'visibility' => $method->isPublic() ? 'public' : ($method->isProtected() ? 'protected' : 'private'),
\t\t'static' => $method->isStatic(),
\t\t'final' => $method->isFinal(),
\t\t'abstract' => $method->isAbstract(),
\t\t'return_type' => wphx_type($method->getReturnType()),
\t\t'returns_reference' => $method->returnsReference(),
\t\t'parameters' => array_map('wphx_param', $method->getParameters()),
\t\t'file' => wphx_relative_path($method->getFileName(), $root),
\t);
}

function wphx_property(ReflectionProperty $property) {
\treturn array(
\t\t'name' => $property->getName(),
\t\t'declaring_class' => $property->getDeclaringClass()->getName(),
\t\t'visibility' => $property->isPublic() ? 'public' : ($property->isProtected() ? 'protected' : 'private'),
\t\t'static' => $property->isStatic(),
\t\t'type' => wphx_type($property->getType()),
\t);
}

function wphx_reflect($symbol, $root) {
\t$exists = class_exists($symbol) || interface_exists($symbol) || trait_exists($symbol);
\tif (!$exists) {
\t\treturn array('symbol' => $symbol, 'exists' => false);
\t}
\t$class = new ReflectionClass($symbol);
\t$methods = array_map(fn($method) => wphx_method($method, $root), $class->getMethods());
\tusort($methods, fn($a, $b) => strcmp($a['name'], $b['name']) ?: strcmp($a['declaring_class'], $b['declaring_class']));
\t$properties = array_map('wphx_property', $class->getProperties());
\tusort($properties, fn($a, $b) => strcmp($a['name'], $b['name']) ?: strcmp($a['declaring_class'], $b['declaring_class']));
\t$constants = array();
\tforeach ($class->getConstants() as $name => $value) {
\t\t$constants[$name] = wphx_value($value);
\t}
\tksort($constants);
\treturn array(
\t\t'symbol' => $symbol,
\t\t'exists' => true,
\t\t'kind' => $class->isInterface() ? 'interface' : ($class->isTrait() ? 'trait' : 'class'),
\t\t'name' => $class->getName(),
\t\t'parent' => ($parent = $class->getParentClass()) ? $parent->getName() : null,
\t\t'interfaces' => array_values($class->getInterfaceNames()),
\t\t'file' => wphx_relative_path($class->getFileName(), $root),
\t\t'final' => $class->isFinal(),
\t\t'abstract' => $class->isAbstract(),
\t\t'constants' => $constants,
\t\t'public_method_count' => count(array_filter($methods, fn($method) => 'public' === $method['visibility'])),
\t\t'methods' => $methods,
\t\t'properties' => $properties,
\t);
}

function wphx_names($objects, $method) {
\t$out = array();
\tforeach ((array) $objects as $object) {
\t\t$out[] = method_exists($object, $method) ? $object->$method() : null;
\t}
\treturn $out;
}

function wphx_item($item) {
\t$enclosures = array();
\tforeach ((array) $item->get_enclosures() as $enclosure) {
\t\t$enclosures[] = array(
\t\t\t'link' => $enclosure->get_link(),
\t\t\t'type' => $enclosure->get_type(),
\t\t\t'length' => $enclosure->get_length(),
\t\t\t'medium' => $enclosure->get_medium(),
\t\t\t'thumbnail' => $enclosure->get_thumbnail(),
\t\t);
\t}
\treturn array(
\t\t'title' => $item->get_title(),
\t\t'permalink' => $item->get_permalink(),
\t\t'date_c' => $item->get_date('c'),
\t\t'description' => $item->get_description(),
\t\t'content' => $item->get_content(),
\t\t'categories' => wphx_names($item->get_categories(), 'get_label'),
\t\t'authors' => wphx_names($item->get_authors(), 'get_name'),
\t\t'enclosures' => $enclosures,
\t);
}

function wphx_parse_feed($id, $xml) {
\t$feed = new SimplePie\\SimplePie();
\t$feed->enable_cache(false);
\t$feed->set_raw_data($xml);
\t$ok = $feed->init();
\t$items = array();
\tif ($ok) {
\t\tforeach ($feed->get_items(0, 5) as $item) {
\t\t\t$items[] = wphx_item($item);
\t\t}
\t}
\treturn array(
\t\t'id' => $id,
\t\t'ok' => $ok,
\t\t'error' => $feed->error(),
\t\t'type' => $ok ? $feed->get_type() : null,
\t\t'encoding' => $ok ? $feed->get_encoding() : null,
\t\t'title' => $ok ? $feed->get_title() : null,
\t\t'permalink' => $ok ? $feed->get_permalink() : null,
\t\t'description' => $ok ? $feed->get_description() : null,
\t\t'language' => $ok ? $feed->get_language() : null,
\t\t'item_quantity' => $ok ? $feed->get_item_quantity() : 0,
\t\t'feed_tags' => $ok ? array(
\t\t\t'atom_entries' => count($feed->get_feed_tags(SimplePie\\SimplePie::NAMESPACE_ATOM_10, 'entry') ?: array()),
\t\t\t'rss_items' => count($feed->get_feed_tags(SimplePie\\SimplePie::NAMESPACE_RSS_20, 'item') ?: array()),
\t\t\t'rdf_items' => count($feed->get_feed_tags(SimplePie\\SimplePie::NAMESPACE_RSS_10, 'item') ?: array()),
\t\t) : array(),
\t\t'items' => $items,
\t);
}

require ABSPATH . WPINC . '/class-simplepie.php';

$modern_symbols = ${JSON.stringify(modernSymbols)};
$legacy_symbols = ${JSON.stringify(legacySymbols)};
$modern_reflection = array();
$legacy_reflection = array();
foreach ($modern_symbols as $symbol) {
\t$modern_reflection[$symbol] = wphx_reflect($symbol, $root);
}
foreach ($legacy_symbols as $symbol) {
\t$legacy_reflection[$symbol] = wphx_reflect($symbol, $root);
}
$constant_sample = array();
foreach (array('SIMPLEPIE_NAME', 'SIMPLEPIE_VERSION', 'SIMPLEPIE_LINKBACK', 'SIMPLEPIE_LOCATOR_NONE', 'SIMPLEPIE_TYPE_RSS_20', 'SIMPLEPIE_TYPE_ATOM_10', 'SIMPLEPIE_FILE_SOURCE_REMOTE') as $name) {
\t$constant_sample[$name] = defined($name) ? constant($name) : null;
}

$corpus = array();
foreach ($feed_corpus as $id => $xml) {
\t$corpus[$id] = wphx_parse_feed($id, $xml);
}

ksort($modern_reflection);
ksort($legacy_reflection);
ksort($constant_sample);
ksort($corpus);

echo json_encode(array(
\t'loaded' => array(
\t\t'modern_simplepie' => class_exists('SimplePie\\\\SimplePie', false),
\t\t'legacy_simplepie' => class_exists('SimplePie', false),
\t\t'autoloader' => class_exists('SimplePie_Autoloader', false),
\t\t'wp_autoload_callback' => function_exists('wp_simplepie_autoload'),
\t),
\t'constant_sample' => $constant_sample,
\t'modern_reflection' => $modern_reflection,
\t'legacy_reflection' => $legacy_reflection,
\t'corpus' => $corpus,
\t'deprecated_functions' => $GLOBALS['deprecated_functions'],
\t'captured_errors' => $GLOBALS['captured_errors'],
), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
}
`
  );
}

function runProbe(root, feedCorpus) {
  return JSON.parse(command("php", [PROBE, root, JSON.stringify(feedCorpus)]));
}

function lintPhpFiles(root, paths) {
  return paths.map((path) => {
    const mirrored = mirrorPath(root, path);
    return {
      path: mirrored.replace(`${root}/`, ""),
      result: command("php", ["-l", mirrored])
    };
  });
}

function main() {
  const failures = [];
  const strategy = readJson(STRATEGY);
  const feedGates = readJson(FEED_GATES);
  const vendorClosure = readJson(VENDOR_CLOSURE);
  const simplepiePlan = strategy.boundary_replacement_plan.find((entry) => entry.id === "simplepie");
  const simplepieBoundary = vendorClosure.vendor_boundaries.find((entry) => entry.id === "simplepie");
  const apiGate = feedGates.gate_plan.find((entry) => entry.id === "simplepie-api-reflection-and-feed-corpus");
  const simplepieFiles = listFiles(SIMPLEPIE_ROOT);
  const sourceFiles = [...simplepieFiles, ...SUPPORT_FILES].sort();
  const modernSymbols = simplepieFiles.map(phpClassFromSimplePieSource).filter(Boolean).sort();
  const legacySymbols = [
    "SimplePie",
    "SimplePie_Autoloader",
    ...simplepieFiles.map(legacyClassFromLibrarySource).filter(Boolean)
  ].sort();

  if (simplepiePlan?.replacement_strategy !== "generated_wrapper_around_upstream_equivalent_dependency") {
    failures.push(`unexpected SimplePie strategy ${simplepiePlan?.replacement_strategy}`);
  }
  if (simplepieBoundary?.source_inventory.count !== simplepieFiles.length) {
    failures.push(`expected ${simplepieFiles.length} SimplePie source files, found ${simplepieBoundary?.source_inventory.count}`);
  }
  if (apiGate?.downstream_issue.external_ref !== ISSUE.external_ref) {
    failures.push("WPHX-323.04 API/reflection corpus gate does not route to WPHX-323.14");
  }
  if (modernSymbols.length < 45) failures.push(`expected at least 45 modern SimplePie symbols, found ${modernSymbols.length}`);
  if (Object.keys(FEED_CORPUS).length !== 4) failures.push("expected 4 feed corpus cases");
  if (failures.length > 0) {
    throw new Error(`WPHX-323.14 setup failed:\n- ${failures.join("\n- ")}`);
  }

  mirrorSources(ORACLE_ROOT);
  mirrorSources(CANDIDATE_ROOT);
  writeProbe({ modernSymbols, legacySymbols });

  const lintedFiles = lintPhpFiles(ORACLE_ROOT, sourceFiles);
  const oracleObservation = runProbe(ORACLE_ROOT, FEED_CORPUS);
  const candidateObservation = runProbe(CANDIDATE_ROOT, FEED_CORPUS);
  const observationsEqual = JSON.stringify(oracleObservation) === JSON.stringify(candidateObservation);

  if (!observationsEqual) failures.push("oracle and candidate SimplePie API/corpus observations differ");
  if (!oracleObservation.loaded.modern_simplepie || !oracleObservation.loaded.legacy_simplepie) {
    failures.push("SimplePie modern or legacy class did not load");
  }
  if (Object.values(oracleObservation.modern_reflection).filter((entry) => entry.exists).length !== modernSymbols.length) {
    failures.push("not all modern SimplePie symbols reflected");
  }
  if (oracleObservation.corpus["malformed-feed"].ok !== false || !oracleObservation.corpus["malformed-feed"].error) {
    failures.push("malformed feed did not record parser error");
  }
  for (const id of ["rss2-rich-item", "atom10-rich-entry", "rdf-rss10"]) {
    if (oracleObservation.corpus[id]?.ok !== true || oracleObservation.corpus[id]?.item_quantity < 1) {
      failures.push(`${id} corpus case did not parse with items`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`WPHX-323.14 SimplePie API/corpus fixture failed:\n- ${failures.join("\n- ")}`);
  }

  const sourceRecords = sourceFiles.map(sourceRecord);
  const validationResult = {
    observations_equal: observationsEqual,
    source_file_count: simplepieFiles.length,
    support_file_count: SUPPORT_FILES.length,
    linted_php_file_count: lintedFiles.length,
    case_count: CASES.length,
    corpus_case_count: Object.keys(FEED_CORPUS).length,
    modern_symbol_count: modernSymbols.length,
    legacy_symbol_count: legacySymbols.length,
    reflected_modern_symbol_count: Object.values(oracleObservation.modern_reflection).filter((entry) => entry.exists).length,
    reflected_legacy_symbol_count: Object.values(oracleObservation.legacy_reflection).filter((entry) => entry.exists).length,
    parsed_success_case_count: Object.values(oracleObservation.corpus).filter((entry) => entry.ok).length,
    malformed_error_case_count: Object.values(oracleObservation.corpus).filter((entry) => !entry.ok && entry.error).length,
    generated_overlay_manifest_present: false,
    copied_artifact_retirement_claimed: false,
    haxe_runtime_ownership_claimed: false
  };

  const manifest = {
    schema: "wphx.wp-core-simplepie-api-reflection-corpus-fixture.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: {
      runner: RUNNER,
      mode: "deterministic_preserved_package_fixture"
    },
    scope: {
      boundary_id: "simplepie",
      source_path: "wp-includes/SimplePie",
      distribution_path: "wp-includes/SimplePie",
      support_files: SUPPORT_FILES.map((path) => path.replace(/^src\//, "")),
      strategy: simplepiePlan.replacement_strategy,
      cases: CASES,
      required_areas: REQUIRED_AREAS
    },
    inputs: {
      replacement_strategy_manifest: fileRecord(STRATEGY),
      feed_vendor_gates_manifest: fileRecord(FEED_GATES),
      vendor_closure_manifest: fileRecord(VENDOR_CLOSURE),
      source_records: sourceRecords
    },
    lint: {
      command: "php -l",
      files: lintedFiles
    },
    observations: {
      oracle_root: ORACLE_ROOT,
      candidate_root: CANDIDATE_ROOT,
      oracle: oracleObservation,
      candidate: candidateObservation,
      observations_equal: observationsEqual
    },
    wrapper_requirements: [
      "Generated SimplePie original-path wrappers must preserve class-simplepie.php load behavior, SimplePie native autoloaders, modern SimplePie namespaces, legacy SimplePie alias/constants, and reflection-visible files.",
      "Any candidate package divergence requires a non-empty overlay manifest for every generated wrapper or dependency-backed file, including replaced upstream hashes.",
      "Generated wrappers must pass this API/reflection and feed-corpus fixture plus WPHX-323.15 WordPress wrapper/cache/transport gates before copied SimplePie artifacts can be retired.",
      "The PSR HTTP/cache interface stubs used by this probe are deterministic test harness inputs only; they are not admitted WordPress distribution dependencies or WPHX runtime code."
    ],
    validation_result: validationResult,
    claims: [
      "Preserved upstream SimplePie API/reflection behavior is recorded for mirrored oracle and candidate package roots.",
      "A representative feed corpus records deterministic RSS2, Atom 1.0, RDF/RSS 1.0, and malformed-feed parser observations.",
      "Future generated SimplePie wrapper claims now have explicit API/reflection, corpus, overlay-manifest, and non-claim requirements."
    ],
    non_claims: [
      "This fixture does not implement or claim Haxe-owned SimplePie runtime logic.",
      "This fixture does not emit generated SimplePie wrappers or original-path public PHP replacements.",
      "This fixture does not retire copied SimplePie package files or class-simplepie.php.",
      "This fixture does not claim live external feed, TLS, proxy, DNS, persistent cache, database-backed installed feed state, widget/block browser behavior, or installed WordPress feed parity.",
      "The mirrored upstream files and probe-local PSR stubs are deterministic test inputs, not distributable WPHX runtime code."
    ]
  };

  const ownership = {
    schema: "wphx.ownership-manifest.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    evidence: OUT,
    boundary: {
      id: "simplepie",
      paths: ["wp-includes/SimplePie", "wp-includes/class-simplepie.php"],
      ownership_state: "preserved_upstream_vendor_boundary_with_api_corpus_fixture",
      emission_strategy: "copied_upstream_package_fixture_with_deterministic_php_probe",
      behavior_parity_claimed: true,
      behavior_parity_scope: "preserved_upstream_simplepie_api_reflection_and_local_feed_corpus_only",
      haxe_runtime_ownership_claimed: false,
      generated_public_php_replacement_claimed: false,
      copied_artifact_retirement_claimed: false,
      generated_overlay_manifest_present: false
    },
    removal_gate:
      "Before retiring copied SimplePie artifacts or claiming generated wrapper ownership, provide non-empty generated overlay manifests, generated original-path wrapper evidence, PHP lint and shape/AST contracts, this API/reflection/corpus fixture passing after divergence, WPHX-323.15 wrapper/cache/transport evidence, WPHX-323.17 provenance/replacement decision evidence, selected upstream feed PHPUnit, installed route/database/browser gates, and ecosystem compatibility evidence appropriate to the claimed boundary.",
    non_claims: manifest.non_claims
  };

  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrCheck(OUT, manifestText);
  writeOrCheck(OWNERSHIP, `${JSON.stringify(ownership, null, 2)}\n`);

  const receipt = {
    schema: "wphx.wp-core-receipt.v1",
    id: "wphx-323-14-simplepie-api-reflection-corpus-fixture",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "closed",
    evidence_class: "preserved_simplepie_api_reflection_and_feed_corpus_fixture",
    artifact_scope: "wp-includes/SimplePie plus class-simplepie.php preserved package roots",
    commands: ["npm run wp:core:wphx-323-simplepie-api-reflection-corpus", "npm run wp:core:wphx-323-simplepie-api-reflection-corpus:check"],
    artifacts: {
      manifest: OUT,
      ownership_manifest: OWNERSHIP,
      feed_vendor_gates_manifest: FEED_GATES,
      vendor_closure_manifest: VENDOR_CLOSURE
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
  console.log(`covered ${modernSymbols.length} modern SimplePie symbols and ${Object.keys(FEED_CORPUS).length} corpus cases`);
}

main();
