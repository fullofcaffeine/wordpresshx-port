#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { filesUnder as stableFilesUnder } from "../wp-linker/original-path-linker.mjs";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const HXML = "fixtures/php-facade/f2-references.hxml";
const OUT_ROOT = "build/php-references";
const HAXE_OUT = `${OUT_ROOT}/haxe`;
const SHELL = `${OUT_ROOT}/generated/wp-includes/reference-boundary.php`;
const PROBE = `${OUT_ROOT}/probe.php`;
const ORACLE = "fixtures/php-facade/oracle/references.php";
const OUT = "manifests/php-facade/wphx-103-f2-references.v1.json";
const RECORDED_AT = "2026-06-20T05:50:00Z";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function command(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 50
  }).trim();
}

function maybeCommand(commandName, commandArgs) {
  try {
    return command(commandName, commandArgs);
  } catch {
    return null;
  }
}

function phpVersionFamily(version) {
  return version.split(".").slice(0, 2).join(".");
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return [path];
  });
}

function filesUnder(dir) {
  return stableFilesUnder(dir);
}

function writeGeneratedShell() {
  mkdirSync(dirname(SHELL), { recursive: true });
  writeFileSync(
    SHELL,
    `<?php

if ( ! defined( 'WPHX_F2_REFERENCES_BOOTSTRAPPED' ) ) {
\tdefine( 'WPHX_F2_REFERENCES_BOOTSTRAPPED', true );
\t$wphx_f2_lib = dirname( __DIR__, 2 ) . '/haxe/lib';
\tset_include_path( get_include_path() . PATH_SEPARATOR . $wphx_f2_lib );
\tspl_autoload_register(
\t\tfunction ( $class ) {
\t\t\t$file = stream_resolve_include_path( str_replace( '\\\\', '/', $class ) . '.php' );
\t\t\tif ( $file ) {
\t\t\t\tinclude_once $file;
\t\t\t}
\t\t}
\t);
\t\\php\\Boot::__hx__init();
}

if ( ! isset( $GLOBALS['wphx_f2_reference_store'] ) ) {
\t$GLOBALS['wphx_f2_reference_store'] = \\wphx\\fixtures\\php\\facade\\ReferenceKernel::initialStore();
}

if ( ! function_exists( 'wphx_reference_param' ) ) {
\tfunction wphx_reference_param( &$value, $suffix = '-ref' ) {
\t\t$value = \\wphx\\fixtures\\php\\facade\\ReferenceKernel::transform( $value, $suffix );

\t\treturn strlen( $value );
\t}
}

if ( ! function_exists( 'wphx_reference_return' ) ) {
\tfunction &wphx_reference_return() {
\t\treturn $GLOBALS['wphx_f2_reference_store'];
\t}
}

if ( ! function_exists( 'wphx_reference_callback' ) ) {
\tfunction wphx_reference_callback( $callback, &$value ) {
\t\t$callback( $value );

\t\treturn $value;
\t}
}
`
  );
}

function writeProbe() {
  mkdirSync(dirname(PROBE), { recursive: true });
  writeFileSync(
    PROBE,
    `<?php

$mode = $argv[1];
$shell = $argv[2];

$before = array(
\t'wphx_reference_param' => function_exists( 'wphx_reference_param' ),
\t'wphx_reference_return' => function_exists( 'wphx_reference_return' ),
\t'wphx_reference_callback' => function_exists( 'wphx_reference_callback' ),
);

require $shell;
require $shell;

$after = array(
\t'wphx_reference_param' => function_exists( 'wphx_reference_param' ),
\t'wphx_reference_return' => function_exists( 'wphx_reference_return' ),
\t'wphx_reference_callback' => function_exists( 'wphx_reference_callback' ),
);

$param_reflection = new ReflectionFunction( 'wphx_reference_param' );
$return_reflection = new ReflectionFunction( 'wphx_reference_return' );
$callback_reflection = new ReflectionFunction( 'wphx_reference_callback' );

function wphx_f2_params( $reflection ) {
\t$params = array();
\tforeach ( $reflection->getParameters() as $parameter ) {
\t\t$params[] = array(
\t\t\t'name' => $parameter->getName(),
\t\t\t'position' => $parameter->getPosition(),
\t\t\t'isOptional' => $parameter->isOptional(),
\t\t\t'hasDefault' => $parameter->isDefaultValueAvailable(),
\t\t\t'default' => $parameter->isDefaultValueAvailable() ? $parameter->getDefaultValue() : null,
\t\t\t'hasType' => $parameter->hasType(),
\t\t\t'isPassedByReference' => $parameter->isPassedByReference(),
\t\t\t'isVariadic' => $parameter->isVariadic(),
\t\t);
\t}

\treturn $params;
}

$param_value = 'core';
$param_return = wphx_reference_param( $param_value, '-tail' );

$store_before = $GLOBALS['wphx_f2_reference_store'];
$store_ref =& wphx_reference_return();
$store_ref = 'changed-through-reference';
$store_after = $GLOBALS['wphx_f2_reference_store'];

$callback_value = 'callback';
$callback_return = wphx_reference_callback(
\tfunction ( &$item ) {
\t\t$item .= '-mutated';
\t},
\t$callback_value
);

echo json_encode(
\tarray(
\t\t'mode' => $mode,
\t\t'before' => $before,
\t\t'afterSecondRequire' => $after,
\t\t'paramReflection' => array(
\t\t\t'name' => $param_reflection->getName(),
\t\t\t'numberOfParameters' => $param_reflection->getNumberOfParameters(),
\t\t\t'numberOfRequiredParameters' => $param_reflection->getNumberOfRequiredParameters(),
\t\t\t'returnsReference' => $param_reflection->returnsReference(),
\t\t\t'hasReturnType' => $param_reflection->hasReturnType(),
\t\t\t'parameters' => wphx_f2_params( $param_reflection ),
\t\t),
\t\t'returnReflection' => array(
\t\t\t'name' => $return_reflection->getName(),
\t\t\t'numberOfParameters' => $return_reflection->getNumberOfParameters(),
\t\t\t'numberOfRequiredParameters' => $return_reflection->getNumberOfRequiredParameters(),
\t\t\t'returnsReference' => $return_reflection->returnsReference(),
\t\t\t'hasReturnType' => $return_reflection->hasReturnType(),
\t\t\t'parameters' => wphx_f2_params( $return_reflection ),
\t\t),
\t\t'callbackReflection' => array(
\t\t\t'name' => $callback_reflection->getName(),
\t\t\t'numberOfParameters' => $callback_reflection->getNumberOfParameters(),
\t\t\t'numberOfRequiredParameters' => $callback_reflection->getNumberOfRequiredParameters(),
\t\t\t'returnsReference' => $callback_reflection->returnsReference(),
\t\t\t'hasReturnType' => $callback_reflection->hasReturnType(),
\t\t\t'parameters' => wphx_f2_params( $callback_reflection ),
\t\t),
\t\t'paramCase' => array(
\t\t\t'return' => $param_return,
\t\t\t'valueAfterCall' => $param_value,
\t\t),
\t\t'returnCase' => array(
\t\t\t'storeBefore' => $store_before,
\t\t\t'referenceValueAfterAssignment' => $store_ref,
\t\t\t'storeAfter' => $store_after,
\t\t),
\t\t'callbackCase' => array(
\t\t\t'return' => $callback_return,
\t\t\t'valueAfterCall' => $callback_value,
\t\t),
\t),
\tJSON_UNESCAPED_SLASHES
);
`
  );
}

function normalizeProbe(result) {
  return {
    before: result.before,
    afterSecondRequire: result.afterSecondRequire,
    paramReflection: result.paramReflection,
    returnReflection: result.returnReflection,
    callbackReflection: result.callbackReflection,
    paramCase: result.paramCase,
    returnCase: result.returnCase,
    callbackCase: result.callbackCase
  };
}

function runProbe(commandPath, label, mode, shell) {
  const output = command(commandPath, [PROBE, mode, shell]);
  return {
    id: `${label}:${mode}`,
    command: `${commandPath} ${PROBE} ${mode} ${shell}`,
    result: JSON.parse(output)
  };
}

function runDockerProbe(id, image, mode, shell) {
  const output = command("docker", ["run", "--rm", "-v", `${process.cwd()}:/work`, "-w", "/work", image, "php", PROBE, mode, shell]);
  return {
    id: `${id}:${mode}`,
    command: `docker run --rm -v $PWD:/work -w /work ${image} php ${PROBE} ${mode} ${shell}`,
    image,
    result: JSON.parse(output)
  };
}

function compareResults(oracleResult, generatedResult) {
  const oracle = normalizeProbe(oracleResult);
  const generated = normalizeProbe(generatedResult);
  return {
    matches: JSON.stringify(oracle) === JSON.stringify(generated),
    oracle,
    generated
  };
}

const lock = readJson("toolchain.lock.json");
rmSync(OUT_ROOT, { recursive: true, force: true });
command("haxe", [HXML]);
writeGeneratedShell();
writeProbe();

const dockerVersion = maybeCommand("docker", ["info", "--format", "{{.ServerVersion}}"]);
const runs = [];
const comparisons = [];

const localOracle = runProbe("php", "local-php-cli", "oracle", ORACLE);
const localGenerated = runProbe("php", "local-php-cli", "generated", SHELL);
runs.push(localOracle, localGenerated);
comparisons.push({
  id: "local-php-cli",
  ...compareResults(localOracle.result, localGenerated.result)
});

if (dockerVersion) {
  for (const [id, image] of [
    ["docker-php-8.4-cli", `${lock.container_images.php_8_4_cli.repository}@${lock.container_images.php_8_4_cli.index_digest}`],
    ["docker-php-8.5-cli", `${lock.container_images.php_8_5_cli.repository}@${lock.container_images.php_8_5_cli.index_digest}`]
  ]) {
    const oracle = runDockerProbe(id, image, "oracle", ORACLE);
    const generated = runDockerProbe(id, image, "generated", SHELL);
    runs.push(oracle, generated);
    comparisons.push({
      id,
      ...compareResults(oracle.result, generated.result)
    });
  }
}

const failures = comparisons.filter((comparison) => !comparison.matches);
if (failures.length > 0) {
  console.error(JSON.stringify({ status: "failed", failures }, null, 2));
  process.exit(1);
}

const manifest = {
  schema: "wphx.php-facade-f2-references.v1",
  issue: "WPHX-103",
  generated_at: RECORDED_AT,
  generator: "tools/php-facade/run-f2-references.mjs",
  fixture: {
    hxml: HXML,
    haxe_sources: [
      "fixtures/php-facade/src/wphx/fixtures/php/facade/ReferenceEntry.hx",
      "fixtures/php-facade/src/wphx/fixtures/php/facade/ReferenceKernel.hx"
    ],
    oracle_shell: ORACLE,
    generated_shell: SHELL,
    probe: PROBE
  },
  toolchain: {
    haxe_version: command("haxe", ["--version"]),
    locked_haxe_version: lock.tools.haxe.version,
    php_cli_version_family: phpVersionFamily(command("php", ["-r", "echo PHP_VERSION;"])),
    docker_available: dockerVersion != null
  },
  build: {
    command: `haxe ${HXML}`,
    haxe_output_dir: HAXE_OUT,
    generated_file_count: filesUnder(HAXE_OUT).length,
    generated_files: filesUnder(HAXE_OUT),
    shell: {
      path: SHELL,
      sha256: sha256(SHELL)
    },
    probe: {
      path: PROBE,
      sha256: sha256(PROBE)
    }
  },
  runtime_runs: runs,
  comparisons,
  reference_strategy: {
    php_shell_owns_exact_reference_abi: true,
    haxe_owns_value_transformation: true,
    backend_pressure: "Stock Haxe PHP output is kept behind an original-path PHP shell for by-reference procedural signatures."
  },
  validation_result: {
    status: "passed",
    runtime_run_count: runs.length,
    comparison_count: comparisons.length,
    by_reference_parameter: true,
    by_reference_return: true,
    by_reference_callback_argument: true
  }
};

const serialized = JSON.stringify(manifest, null, 2) + "\n";

if (checkOnly) {
  if (!existsSync(OUT)) {
    console.error(JSON.stringify({ status: "failed", error: `${OUT} does not exist` }, null, 2));
    process.exit(1);
  }
  if (readFileSync(OUT, "utf8") !== serialized) {
    console.error(JSON.stringify({ status: "failed", error: `${OUT} is stale` }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ status: "passed", output: OUT, comparison_count: comparisons.length }, null, 2));
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, serialized);
console.log(JSON.stringify({ status: "passed", output: OUT, comparison_count: comparisons.length }, null, 2));
