#!/usr/bin/env node
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { canonicalSourceMapRecord, findMachineLocalPaths } from "../evidence/canonical-source-map.mjs";

const checkOnly = process.argv.includes("--check");
const RECORDED_AT = "2026-07-03T13:00:00Z";
const ISSUE = {
  id: "wordpresshx-b2pt",
  external_ref: "WPHX-COMP-PHP-PLUGIN-REFLECTION-STACKTRACE",
  title: "Add public generated PHP ecosystem gate"
};
const RUNNER = "tools/wphx-php/run-plugin-reflection-stacktrace.mjs";
const OUT_ROOT = "build/wphx-php/plugin-reflection-stacktrace";
const PACKAGE_ROOT = `${OUT_ROOT}/package`;
const HAXE_LIB_ROOT = `${OUT_ROOT}/haxe/lib`;
const PLUGIN = `${PACKAGE_ROOT}/wp-content/plugins/wphx-ecosystem-probe/wphx-ecosystem-probe.php`;
const PROBE_OUTPUT = `${OUT_ROOT}/probe-output.json`;
const MANIFEST = "manifests/wphx-php/plugin-reflection-stacktrace.v1.json";
const RECEIPT = "receipts/compiler/wphx-comp-php-plugin-reflection-stacktrace.v1.json";

const SOURCE_COMMANDS = [
  "wphx:php:f1",
  "wphx:php:f4",
  "wphx:php:wp-oembed-providers",
  "wphx:php:bootstrap-debug"
];

const SHELLS = [
  {
    id: "f1-plugin-function",
    source: "build/wphx-php/f1/generated/wp-includes/plugin.php",
    package_path: "wp-includes/plugin.php",
    emission_manifest: "build/wphx-php/f1/generated/wphx-php-emission.v1.json"
  },
  {
    id: "f4-public-class",
    source: "build/wphx-php/f4/generated/wp-includes/class-wphx-public-class.php",
    package_path: "wp-includes/class-wphx-public-class.php",
    emission_manifest: "build/wphx-php/f4/generated/wphx-php-emission.v1.json"
  },
  {
    id: "wp-oembed-provider-shell",
    source: "build/wphx-php/wp-oembed-providers/generated/wp-includes/class-wp-oembed.php",
    package_path: "wp-includes/class-wp-oembed.php",
    emission_manifest: "build/wphx-php/wp-oembed-providers/generated/wphx-php-emission.v1.json"
  },
  {
    id: "bootstrap-debug-shell",
    source: "build/wphx-php/bootstrap-debug/debug/generated/wp-includes/wphx-bootstrap-debug.php",
    package_path: "wp-includes/wphx-bootstrap-debug.php",
    emission_manifest: "build/wphx-php/bootstrap-debug/debug/generated/wphx-php-emission.v1.json"
  }
];

const HAXE_LIBS = [
  "build/wphx-php/f1/haxe/lib",
  "build/wphx-php/f4/haxe/lib",
  "build/wphx-php/bootstrap-debug/debug/haxe/lib"
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
    ...options
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\nstdout:\n${result.stdout ?? ""}\nstderr:\n${result.stderr ?? ""}`);
  }
  return result.stdout ?? "";
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function fileRecord(path) {
  return {
    path,
    bytes: statSync(path).size,
    sha256: sha256File(path)
  };
}

function packagePath(path) {
  return `${PACKAGE_ROOT}/${path}`;
}

function normalizePath(path) {
  if (typeof path !== "string") return path;
  const normalized = path.split("\\").join("/");
  const cwd = process.cwd().split("\\").join("/");
  if (normalized.startsWith(`${cwd}/`)) return normalized.slice(cwd.length + 1);
  return normalized;
}

function pathRelativeToPackage(path) {
  if (typeof path !== "string") return path;
  const normalized = normalizePath(path);
  const pkg = PACKAGE_ROOT.split("\\").join("/");
  return normalized.startsWith(`${pkg}/`) ? normalized.slice(pkg.length + 1) : normalized;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
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

function copyFileIntoPackage(source, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(source, dest, { force: true });
}

function copyHaxeLibs() {
  const dest = HAXE_LIB_ROOT;
  mkdirSync(dest, { recursive: true });
  for (const lib of HAXE_LIBS) {
    cpSync(lib, dest, { recursive: true, force: true });
  }
}

function buildPackage() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  mkdirSync(PACKAGE_ROOT, { recursive: true });
  for (const script of SOURCE_COMMANDS) run("npm", ["run", checkOnly ? `${script}:check` : script]);
  for (const shell of SHELLS) copyFileIntoPackage(shell.source, packagePath(shell.package_path));
  copyHaxeLibs();
}

function writePlugin() {
  mkdirSync(dirname(PLUGIN), { recursive: true });
  writeFileSync(
    PLUGIN,
    `<?php
$root = realpath( $argv[1] );
if ( false === $root ) {
\t$root = $argv[1];
}
$root = rtrim( $root, '/\\\\' );
define( 'ABSPATH', $root . '/' );
define( 'WPINC', 'wp-includes' );

require ABSPATH . WPINC . '/plugin.php';
require ABSPATH . WPINC . '/class-wphx-public-class.php';
require ABSPATH . WPINC . '/class-wp-oembed.php';
require ABSPATH . WPINC . '/wphx-bootstrap-debug.php';

class WPHX_Ecosystem_Child extends WPHX_Public_Class {
\tpublic function describe() {
\t\treturn parent::describe() . ':child';
\t}
}

function wphx_probe_relative_path( $path, $root ) {
\t$path = str_replace( '\\\\', '/', $path );
\t$root = str_replace( '\\\\', '/', $root );
\tif ( str_starts_with( $path, $root . '/' ) ) {
\t\treturn substr( $path, strlen( $root ) + 1 );
\t}
\t$bundle = dirname( $root );
\treturn str_starts_with( $path, $bundle . '/' ) ? '../' . substr( $path, strlen( $bundle ) + 1 ) : $path;
}

function wphx_probe_params( $reflection ) {
\t$params = array();
\tforeach ( $reflection->getParameters() as $parameter ) {
\t\t$params[] = array(
\t\t\t'name' => $parameter->getName(),
\t\t\t'position' => $parameter->getPosition(),
\t\t\t'optional' => $parameter->isOptional(),
\t\t\t'has_default' => $parameter->isDefaultValueAvailable(),
\t\t\t'default' => $parameter->isDefaultValueAvailable() ? $parameter->getDefaultValue() : null,
\t\t\t'by_reference' => $parameter->isPassedByReference(),
\t\t\t'variadic' => $parameter->isVariadic(),
\t\t\t'has_type' => $parameter->hasType(),
\t\t);
\t}
\treturn $params;
}

function wphx_probe_method( $class, $method ) {
\t$reflection = new ReflectionMethod( $class, $method );
\treturn array(
\t\t'name' => $reflection->getName(),
\t\t'class' => $reflection->getDeclaringClass()->getName(),
\t\t'public' => $reflection->isPublic(),
\t\t'protected' => $reflection->isProtected(),
\t\t'private' => $reflection->isPrivate(),
\t\t'static' => $reflection->isStatic(),
\t\t'params' => wphx_probe_params( $reflection ),
\t);
}

function wphx_probe_property( $class, $property ) {
\t$reflection = new ReflectionProperty( $class, $property );
\treturn array(
\t\t'name' => $reflection->getName(),
\t\t'class' => $reflection->getDeclaringClass()->getName(),
\t\t'public' => $reflection->isPublic(),
\t\t'protected' => $reflection->isProtected(),
\t\t'private' => $reflection->isPrivate(),
\t\t'static' => $reflection->isStatic(),
\t);
}

$add_filter = new ReflectionFunction( 'add_filter' );
$add_return = add_filter( 'the_content', array( 'WPHX_Ecosystem_Child', 'describe' ), 11, 1 );
$class = new ReflectionClass( 'WPHX_Public_Class' );
$child = new ReflectionClass( 'WPHX_Ecosystem_Child' );
$oembed = new ReflectionClass( 'WP_oEmbed' );
$defaults = $oembed->getDefaultProperties();

$instance = new WPHX_Ecosystem_Child( 'plugin', array( 'role' => 'ecosystem' ) );
$factory = WPHX_Public_Class::factory( 'factory' );
WP_oEmbed::$early_providers = array();
WP_oEmbed::_add_provider_early( 'https://plugin.example/*', 'https://plugin.example/oembed' );
WP_oEmbed::_remove_provider_early( 'https://old-plugin.example/*' );

$exception = null;
try {
\twphx_bootstrap_debug_fail( 'plugin' );
} catch ( Throwable $throwable ) {
\t$trace = array();
\tforeach ( $throwable->getTrace() as $frame ) {
\t\t$trace[] = array(
\t\t\t'file' => isset( $frame['file'] ) ? wphx_probe_relative_path( $frame['file'], $root ) : null,
\t\t\t'line' => $frame['line'] ?? null,
\t\t\t'function' => $frame['function'] ?? null,
\t\t\t'class' => $frame['class'] ?? null,
\t\t\t'type' => $frame['type'] ?? null,
\t\t);
\t}
\t$exception = array(
\t\t'class' => get_class( $throwable ),
\t\t'message' => $throwable->getMessage(),
\t\t'file' => wphx_probe_relative_path( $throwable->getFile(), $root ),
\t\t'line' => $throwable->getLine(),
\t\t'trace' => $trace,
\t);
}

$result = array(
\t'package_root' => '.',
\t'plugin_file' => wphx_probe_relative_path( __FILE__, $root ),
\t'function_reflection' => array(
\t\t'name' => $add_filter->getName(),
\t\t'file' => wphx_probe_relative_path( $add_filter->getFileName(), $root ),
\t\t'line_start' => $add_filter->getStartLine(),
\t\t'line_end' => $add_filter->getEndLine(),
\t\t'params' => wphx_probe_params( $add_filter ),
\t\t'returns_reference' => $add_filter->returnsReference(),
\t\t'has_return_type' => $add_filter->hasReturnType(),
\t),
\t'function_invocation' => array(
\t\t'add_filter_return' => $add_return,
\t\t'facade_snapshot' => json_decode( \\wphx\\fixtures\\php\\facade\\FacadeKernel::snapshot(), true ),
\t),
\t'class_reflection' => array(
\t\t'name' => $class->getName(),
\t\t'file' => wphx_probe_relative_path( $class->getFileName(), $root ),
\t\t'parent' => $class->getParentClass()->getName(),
\t\t'interfaces' => $class->getInterfaceNames(),
\t\t'constants' => $class->getConstants(),
\t\t'attributes' => array_map( fn( $attribute ) => $attribute->getName(), $class->getAttributes() ),
\t\t'methods' => array(
\t\t\t'__construct' => wphx_probe_method( 'WPHX_Public_Class', '__construct' ),
\t\t\t'factory' => wphx_probe_method( 'WPHX_Public_Class', 'factory' ),
\t\t\t'describe' => wphx_probe_method( 'WPHX_Public_Class', 'describe' ),
\t\t\t'get_meta' => wphx_probe_method( 'WPHX_Public_Class', 'get_meta' ),
\t\t),
\t\t'properties' => array(
\t\t\t'instances' => wphx_probe_property( 'WPHX_Public_Class', 'instances' ),
\t\t\t'name' => wphx_probe_property( 'WPHX_Public_Class', 'name' ),
\t\t\t'meta' => wphx_probe_property( 'WPHX_Public_Class', 'meta' ),
\t\t),
\t),
\t'subclass_probe' => array(
\t\t'class' => $child->getName(),
\t\t'parent' => $child->getParentClass()->getName(),
\t\t'file' => wphx_probe_relative_path( $child->getFileName(), $root ),
\t\t'instance_of_public_class' => $instance instanceof WPHX_Public_Class,
\t\t'instance_of_interface' => $instance instanceof WPHX_Public_Interface,
\t\t'describe' => $instance->describe(),
\t\t'meta_role' => $instance->get_meta( 'role', 'missing' ),
\t\t'factory_class' => get_class( $factory ),
\t\t'factory_describe' => $factory->describe(),
\t),
\t'oembed_reflection' => array(
\t\t'name' => $oembed->getName(),
\t\t'file' => wphx_probe_relative_path( $oembed->getFileName(), $root ),
\t\t'attributes' => array_map( fn( $attribute ) => $attribute->getName(), $oembed->getAttributes() ),
\t\t'default_properties' => array(
\t\t\t'providers' => $defaults['providers'] ?? null,
\t\t\t'early_providers' => $defaults['early_providers'] ?? null,
\t\t),
\t\t'properties' => array(
\t\t\t'providers' => wphx_probe_property( 'WP_oEmbed', 'providers' ),
\t\t\t'early_providers' => wphx_probe_property( 'WP_oEmbed', 'early_providers' ),
\t\t),
\t\t'methods' => array(
\t\t\t'_add_provider_early' => wphx_probe_method( 'WP_oEmbed', '_add_provider_early' ),
\t\t\t'_remove_provider_early' => wphx_probe_method( 'WP_oEmbed', '_remove_provider_early' ),
\t\t),
\t\t'early_providers_after_calls' => WP_oEmbed::$early_providers,
\t),
\t'stacktrace_probe' => $exception,
);

echo json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\\n";
`
  );
}

function packageArtifacts() {
  const shellRecords = SHELLS.map((shell) => {
    const packageFile = packagePath(shell.package_path);
    const emission = readJson(shell.emission_manifest);
    return {
      id: shell.id,
      source: fileRecord(shell.source),
      packaged: fileRecord(packageFile),
      package_path: shell.package_path,
      php_lint: run("php", ["-l", packageFile]).trim(),
      emission_manifest: {
        path: shell.emission_manifest,
        sha256: sha256File(shell.emission_manifest),
        unsupported: emission.unsupported ?? [],
        declarations: (emission.files ?? []).flatMap((file) => file.declarations ?? [])
      }
    };
  });
  const sourceMap = `${HAXE_LIB_ROOT}/wphx/fixtures/php/bootstrap/BootstrapKernel.php.map`;
  const haxeFile = `${HAXE_LIB_ROOT}/wphx/fixtures/php/bootstrap/BootstrapKernel.php`;
  return {
    package_root: PACKAGE_ROOT,
    haxe_library_root: HAXE_LIB_ROOT,
    plugin: {
      ...fileRecord(PLUGIN),
      php_lint: run("php", ["-l", PLUGIN]).trim()
    },
    shells: shellRecords,
    debug_haxe_file: fileRecord(haxeFile),
    debug_source_map: canonicalSourceMapRecord(sourceMap, { repositoryRoot: process.cwd(), path: sourceMap })
  };
}

function runProbe() {
  const output = run("php", [PLUGIN, PACKAGE_ROOT]);
  mkdirSync(dirname(PROBE_OUTPUT), { recursive: true });
  writeFileSync(PROBE_OUTPUT, output);
  return JSON.parse(output);
}

function paramByName(params, name) {
  return params.find((param) => param.name === name);
}

function validate(observed, artifacts) {
  const failures = [];
  const expect = (condition, message) => {
    if (!condition) failures.push(message);
  };

  expect(observed.package_root === ".", "package root evidence must use the stable package-relative root");
  expect(findMachineLocalPaths(observed).length === 0, "probe evidence must not contain machine-local absolute paths");
  expect(observed.plugin_file === "wp-content/plugins/wphx-ecosystem-probe/wphx-ecosystem-probe.php", "plugin executes from packaged plugin path");
  expect(observed.function_reflection.file === "wp-includes/plugin.php", "add_filter reflection file must be packaged wp-includes/plugin.php");
  expect(observed.function_reflection.params.length === 4, "add_filter must expose four parameters");
  expect(paramByName(observed.function_reflection.params, "priority")?.default === 10, "add_filter priority default must be 10");
  expect(paramByName(observed.function_reflection.params, "accepted_args")?.default === 1, "add_filter accepted_args default must be 1");
  expect(observed.function_invocation.add_filter_return === true, "add_filter invocation must return true");
  expect(
    observed.function_invocation.facade_snapshot?.[0]?.hookName === "the_content",
    "add_filter should delegate into the Haxe facade snapshot"
  );

  expect(observed.class_reflection.file === "wp-includes/class-wphx-public-class.php", "WPHX_Public_Class reflection file must be packaged original path");
  expect(observed.class_reflection.parent === "WPHX_Public_Base", "WPHX_Public_Class parent must be WPHX_Public_Base");
  expect(observed.class_reflection.interfaces.includes("WPHX_Public_Interface"), "WPHX_Public_Class must implement WPHX_Public_Interface");
  expect(observed.class_reflection.properties.meta.protected === true, "WPHX_Public_Class::$meta must be protected");
  expect(observed.class_reflection.properties.instances.static === true, "WPHX_Public_Class::$instances must be static");
  expect(paramByName(observed.class_reflection.methods.__construct.params, "meta")?.default?.length === 0, "constructor meta default must be []");
  expect(paramByName(observed.class_reflection.methods.get_meta.params, "default")?.default === null, "get_meta default must be null");
  expect(observed.subclass_probe.file === "wp-content/plugins/wphx-ecosystem-probe/wphx-ecosystem-probe.php", "subclass must be declared by plugin");
  expect(observed.subclass_probe.instance_of_public_class === true, "plugin subclass must be instance of generated public class");
  expect(observed.subclass_probe.instance_of_interface === true, "plugin subclass must satisfy generated interface");
  expect(observed.subclass_probe.describe === "PLUGIN:1:child", "plugin subclass parent dispatch must work");
  expect(observed.subclass_probe.meta_role === "ecosystem", "plugin subclass must read inherited protected metadata through public method");
  expect(observed.subclass_probe.factory_class === "WPHX_Public_Class", "static factory must return WPHX_Public_Class");
  expect(observed.subclass_probe.factory_describe === "FACTORY:1", "static factory result must keep generated describe behavior");

  expect(observed.oembed_reflection.file === "wp-includes/class-wp-oembed.php", "WP_oEmbed reflection file must be packaged original path");
  expect(observed.oembed_reflection.attributes.includes("AllowDynamicProperties"), "WP_oEmbed must expose AllowDynamicProperties attribute");
  expect(Array.isArray(observed.oembed_reflection.default_properties.providers), "WP_oEmbed providers default must be array");
  expect(Array.isArray(observed.oembed_reflection.default_properties.early_providers), "WP_oEmbed early_providers default must be array");
  expect(observed.oembed_reflection.properties.early_providers.static === true, "WP_oEmbed::$early_providers must be static");
  expect(paramByName(observed.oembed_reflection.methods._add_provider_early.params, "regex")?.default === false, "_add_provider_early regex default must be false");
  expect(
    observed.oembed_reflection.early_providers_after_calls.add?.["https://plugin.example/*"]?.[0] === "https://plugin.example/oembed",
    "WP_oEmbed add queue must preserve plugin provider"
  );
  expect(
    observed.oembed_reflection.early_providers_after_calls.remove?.[0] === "https://old-plugin.example/*",
    "WP_oEmbed remove queue must preserve plugin removal"
  );

  const trace = observed.stacktrace_probe?.trace ?? [];
  expect(observed.stacktrace_probe?.message === "WPHX-BOOTSTRAP-DEBUG:PLUGIN", "debug stacktrace exception message must match");
  expect(trace.some((frame) => frame.file === "wp-content/plugins/wphx-ecosystem-probe/wphx-ecosystem-probe.php"), "stack trace must include plugin frame");
  expect(trace.some((frame) => frame.file === "wp-includes/wphx-bootstrap-debug.php"), "stack trace must include original-path WPHX shell frame");
  expect(
    trace.some((frame) => frame.file === "../haxe/lib/wphx/fixtures/php/bootstrap/BootstrapKernel.php"),
    "stack trace must include packaged Haxe implementation frame adjacent to the WordPress package root"
  );
  expect(artifacts.debug_source_map.path.endsWith("BootstrapKernel.php.map"), "packaged debug source map must exist");
  for (const shell of artifacts.shells) {
    expect((shell.emission_manifest.unsupported ?? []).length === 0, `${shell.id} emission manifest must have unsupported=[]`);
  }

  return {
    status: failures.length === 0 ? "passed" : "failed",
    failures,
    plugin_reflection_files_are_packaged_original_paths:
      observed.function_reflection.file === "wp-includes/plugin.php" &&
      observed.class_reflection.file === "wp-includes/class-wphx-public-class.php" &&
      observed.oembed_reflection.file === "wp-includes/class-wp-oembed.php",
    subclass_probe_passed: observed.subclass_probe.describe === "PLUGIN:1:child" && observed.subclass_probe.instance_of_interface === true,
    allow_dynamic_properties_attribute_seen: observed.oembed_reflection.attributes.includes("AllowDynamicProperties"),
    packaged_stacktrace_has_plugin_shell_and_haxe_frames:
      trace.some((frame) => frame.file === "wp-content/plugins/wphx-ecosystem-probe/wphx-ecosystem-probe.php") &&
      trace.some((frame) => frame.file === "wp-includes/wphx-bootstrap-debug.php") &&
      trace.some((frame) => frame.file === "../haxe/lib/wphx/fixtures/php/bootstrap/BootstrapKernel.php"),
    packaged_debug_source_map_present: artifacts.debug_source_map.path.endsWith("BootstrapKernel.php.map"),
    all_emission_manifests_unsupported_empty: artifacts.shells.every((shell) => (shell.emission_manifest.unsupported ?? []).length === 0)
  };
}

function main() {
  buildPackage();
  writePlugin();
  const artifacts = packageArtifacts();
  const observed = runProbe();
  const validationResult = validate(observed, artifacts);
  if (validationResult.status !== "passed") {
    throw new Error(`plugin reflection/stacktrace validation failed: ${JSON.stringify(validationResult.failures, null, 2)}`);
  }

  const manifest = {
    schema: "wphx.wphx-php-plugin-reflection-stacktrace.v1",
    issue: ISSUE,
    generated_at: RECORDED_AT,
    generator: RUNNER,
    evidence_class: "plugin_theme_reflection_stacktrace_gate",
    artifact_scope: "packaged_plugin_fixture_reflecting_selected_generated_public_php_shells",
    package: {
      root: PACKAGE_ROOT,
      haxe_library_root: HAXE_LIB_ROOT,
      plugin_file: relative(process.cwd(), PLUGIN),
      probe_output: fileRecord(PROBE_OUTPUT)
    },
    inputs: [
      ...SHELLS.map((shell) => shell.source),
      ...SHELLS.map((shell) => shell.emission_manifest),
      RUNNER
    ].map(fileRecord),
    artifacts,
    observed,
    validation_result: validationResult,
    claims: [
      "A plugin-style PHP fixture can reflect selected WPHX-generated public function/class shells from packaged original paths.",
      "The fixture verifies generated function parameter defaults, generated class properties/methods/defaults, plugin subclassing, WP_oEmbed AllowDynamicProperties/static property reflection, and static provider queue behavior.",
      "The fixture captures a packaged stack trace crossing plugin, WPHX original-path shell, and the adjacent Haxe implementation library with a packaged debug source map present."
    ],
    non_claims: [
      "This does not claim broad public distribution readiness for all generated PHP.",
      "This does not claim full plugin/theme ecosystem compatibility, installed WordPress parity, complete WP_Http/WP_Embed/WP_oEmbed ownership, warning/deprecation matrix coverage, or source-map frame rewriting.",
      "This does not remove the need for whole-file ownership inventories, installed package gates, selected upstream PHPUnit ratchets, and human/AST generated-PHP readability review before stronger claims."
    ]
  };

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const receipt = {
    schema: "wphx.compiler-core-driver-receipt.v1",
    id: "receipt:wphx-comp-php-plugin-reflection-stacktrace",
    issue: ISSUE,
    recorded_at: RECORDED_AT,
    status: "passed",
    evidence_class: manifest.evidence_class,
    artifact_scope: manifest.artifact_scope,
    command: "npm run wphx:php:plugin-reflection-stacktrace",
    check_command: "npm run wphx:php:plugin-reflection-stacktrace:check",
    artifacts: [
      { path: RUNNER, role: "deterministic plugin/reflection/stacktrace runner" },
      { path: "tools/evidence/canonical-source-map.mjs", role: "path-independent source-map and probe-path evidence helper" },
      { path: MANIFEST, role: "plugin reflection and packaged stacktrace manifest" },
      { path: PLUGIN, role: "generated package plugin probe artifact", generated: true }
    ],
    manifest_sha256: sha256(manifestText),
    validation_result: validationResult,
    claims: manifest.claims,
    non_claims: manifest.non_claims
  };

  writeOrCheck(MANIFEST, manifestText);
  writeOrCheck(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        status: "passed",
        output: MANIFEST,
        receipt: RECEIPT,
        reflected_files: [
          observed.function_reflection.file,
          observed.class_reflection.file,
          observed.oembed_reflection.file
        ],
        stacktrace_frame_count: observed.stacktrace_probe.trace.length
      },
      null,
      2
    )
  );
}

main();
